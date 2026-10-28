import React, { useState, useEffect, useMemo, useRef, useCallback, Children } from 'react'
import { 
  Plus, Search, X, RefreshCw, AlertCircle, Trash2, 
  Briefcase, User, Calendar, CreditCard, Receipt, Eye
} from '../icons'
import { 
  Pencil, CheckCircle2, ArrowDownLeft, ArrowUpRight, ArrowDownRight, Clock, 
  ExternalLink, ChevronRight, FileText, Check, DollarSign,
  Filter, ChevronDown, RotateCcw, Wallet, Download, Layers, ArrowRightLeft,
  Building2, Phone, Mail, FolderOpen, HardHat, Users, Landmark, Minus
} from 'lucide-react'
import api from '../../api'
import CashbookSelect from '../common/CashbookSelect'
import { showConfirm, showError, showToast, showSuccess } from '../../utils/swal'

// Reusable Mobile Card Carousel matching Customers tab exactly
const MobileCardCarousel = ({ 
  children, 
  isMobile, 
  isDarkMode, 
  desktopColumns = 4, 
  gap = '0.65rem', 
  marginBottom = '1.25rem',
  style = {} 
}) => {
  const scrollRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const validChildren = Children.toArray(children).filter(Boolean)
  const count = validChildren.length

  const handleScroll = (e) => {
    const el = e.currentTarget
    if (!el || count <= 1) return
    const scrollLeft = el.scrollLeft
    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll <= 0) {
      setActiveIndex(0)
      return
    }
    const firstChild = el.firstElementChild
    const cardStep = firstChild ? (firstChild.getBoundingClientRect().width + 10) : (el.clientWidth * 0.78 + 10)
    const idx = Math.round(scrollLeft / (cardStep || 1))
    setActiveIndex(Math.min(count - 1, Math.max(0, idx)))
  }

  if (!isMobile) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${desktopColumns}, 1fr)`,
        gap: gap,
        marginBottom: marginBottom,
        ...style
      }}>
        {validChildren}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: marginBottom, ...style }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          gap: '0.65rem',
          paddingBottom: '4px',
          boxSizing: 'border-box'
        }}
      >
        {validChildren.map((child, idx) => (
          <div
            key={idx}
            style={{
              flex: '0 0 78%',
              minWidth: '220px',
              maxWidth: '280px',
              scrollSnapAlign: 'start'
            }}
          >
            {child}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '0.5rem' }}>
          {validChildren.map((_, idx) => (
            <span
              key={idx}
              style={{
                width: activeIndex === idx ? '16px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: activeIndex === idx ? (isDarkMode ? '#ffffff' : '#0f172a') : (isDarkMode ? '#33373e' : '#cbd5e1'),
                transition: 'all 0.2s ease'
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Entity Classifier Helper: detects if entry is a payment to Customer, Vendor, Labour, Job Order, or Expense
export const getEntryEntities = (e) => {
  if (!e) return { isCust: false, isVend: false, isLabour: false, isJob: false, isExp: false, primaryEntity: 'Other' }
  
  const isCust = Boolean(
    e.customer || e.customer_name || e.customer_payment ||
    e.debit_type === 'CUSTOMER' ||
    (e.category && (e.category.toLowerCase().includes('customer') || e.category.toLowerCase() === 'sales'))
  )
  const isVend = Boolean(
    e.vendor || e.vendor_name || e.vendor_payment ||
    e.debit_type === 'VENDOR'
  )
  const isLabour = Boolean(
    e.labour || e.labour_name || e.salary_payment || e.staff_user || e.staff_name ||
    e.debit_type === 'LABOUR' || e.debit_type === 'SALARY' ||
    /labour|labor|wage|salary|overtime|worker/i.test(e.category || '')
  )
  const isJob = Boolean(
    e.job_order || e.pending_job_order || e.job_order_title || e.job_order_number
  )
  const isExp = Boolean(
    e.expense || e.debit_type === 'Company Expense' ||
    /expense|food|petrol|fuel|rent|office|supplies|maintenance|utility|software|materials/i.test(e.category || '')
  )

  let primaryEntity = 'General'
  if (isCust) primaryEntity = 'Customer'
  else if (isVend) primaryEntity = 'Vendor'
  else if (isLabour) primaryEntity = 'Labour'
  else if (isJob) primaryEntity = 'Job Order'
  else if (isExp) primaryEntity = 'Expense'

  return { isCust, isVend, isLabour, isJob, isExp, primaryEntity }
}

// Disconnect Books: Entries belonging to a book must NEVER appear in the Cash Ledger
export const isLedgerTransaction = (e) => {
  if (!e) return false
  const bookId = (typeof e.cashbook === 'object' && e.cashbook !== null)
    ? e.cashbook.id
    : (e.cashbook ?? e.cashbook_id)
  if (bookId || e.cashbook_name) return false
  return true
}

export default function PersonalCashLedger({
  isDarkMode = false,
  isMobileScreen: propIsMobile,
  currentUser = {},
  pettyCashAccounts = [],
  onOpenEntryModal,
  onRefreshAll
}) {
  // Account scope: '__all__' = Consolidated Master Ledger across entire ERP, or specific account ID
  const [selectedAccountId, setSelectedAccountId] = useState('__all__')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Filtering Options: Entity, Flow Type, Date Range (Books are completely disconnected)
  const [entityFilter, setEntityFilter] = useState('all') // 'all' | 'customer' | 'vendor' | 'labour' | 'job_order' | 'expense'
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'in' | 'out'
  const [dateRange, setDateRange] = useState('all') // 'all' | 'today' | 'this_month' | 'last_month'
  const [isEntityDropdownOpen, setIsEntityDropdownOpen] = useState(false)
  const entityDropdownRef = useRef(null)

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (entityDropdownRef.current && !entityDropdownRef.current.contains(e.target)) {
        setIsEntityDropdownOpen(false)
      }
    }
    if (isEntityDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isEntityDropdownOpen])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isEntityDropdownOpen) {
        setIsEntityDropdownOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEntityDropdownOpen])

  // Responsive state
  const [isMobileScreen, setIsMobileScreen] = useState(() => 
    typeof propIsMobile === 'boolean' ? propIsMobile : (typeof window !== 'undefined' && window.innerWidth <= 768)
  )

  useEffect(() => {
    if (typeof propIsMobile === 'boolean') {
      setIsMobileScreen(propIsMobile)
      return
    }
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [propIsMobile])

  // Match logged in user's personal petty cash wallet
  const matchedUserAccount = useMemo(() => {
    if (!pettyCashAccounts || pettyCashAccounts.length === 0) return null
    const uid = currentUser?.id
    const uname = (currentUser?.username || '').trim().toLowerCase()
    const fname = (currentUser?.first_name || '').trim().toLowerCase()
    const lname = (currentUser?.last_name || '').trim().toLowerCase()

    // 1. Match by linked user ID (owner / linked_user)
    if (uid) {
      const byOwner = pettyCashAccounts.find(p => p.owner === uid || p.owner_id === uid || String(p.linked_user) === String(uid))
      if (byOwner) return byOwner
    }

    // 2. Match by exact username or name if not admin
    if (uname && uname !== 'admin') {
      const byName = pettyCashAccounts.find(p => {
        const h = (p.holder_name || '').trim().toLowerCase()
        const n = (p.name || '').trim().toLowerCase()
        if (h === uname || n.includes(uname)) return true
        if (fname && (h === fname || n.includes(fname))) return true
        if (lname && (h === lname || n.includes(lname))) return true
        return false
      })
      if (byName) return byName
    }

    // No linked account for this user - do NOT fallback to another user's account
    return null
  }, [pettyCashAccounts, currentUser])

  const activeAccount = useMemo(() => {
    if (selectedAccountId === '__all__') {
      return { 
        id: '__all__', 
        name: 'All Ledger Payments', 
        holder_name: 'Consolidated Cash Ledger',
        balance: pettyCashAccounts.reduce((s, a) => s + (parseFloat(a.balance) || 0), 0) 
      }
    }
    return pettyCashAccounts.find(p => String(p.id) === String(selectedAccountId)) || matchedUserAccount || null
  }, [pettyCashAccounts, selectedAccountId, matchedUserAccount])

  // Fetch entries with ledger_only=true so books transactions are not pulled into ledger
  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page_size: 2000, ledger_only: 'true' }
      if (selectedAccountId && selectedAccountId !== '__all__') {
        params.petty_cash_account = selectedAccountId
      }
      if (entityFilter && entityFilter !== 'all') {
        params.entity = entityFilter
      }

      const res = await api.get('cashbook-entries/', { params })
      const data = res.data?.results || res.data || []
      // Guarantee only payments related to expenses, customers, vendors, job orders, labour are retained
      const rawList = Array.isArray(data) ? data : []
      const strictlyLedger = rawList.filter(isLedgerTransaction)
      setEntries(strictlyLedger)
    } catch (err) {
      console.error('Failed to load cash ledger entries:', err)
      showError('Failed to load transactions', err.message || 'Error communicating with server')
    } finally {
      setLoading(false)
    }
  }, [selectedAccountId, entityFilter])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  useEffect(() => {
    const handleLedgerRefresh = () => {
      fetchEntries()
    }
    window.addEventListener('refresh-cash-ledger', handleLedgerRefresh)
    return () => window.removeEventListener('refresh-cash-ledger', handleLedgerRefresh)
  }, [fetchEntries])

  // Date filtering tokens
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`

  // Compute entity counts
  const { customerCount, vendorCount, labourCount, jobCount, expenseCount } = useMemo(() => {
    let c = 0, v = 0, l = 0, j = 0, x = 0
    entries.forEach(e => {
      const { isCust, isVend, isLabour, isJob, isExp } = getEntryEntities(e)
      if (isCust) c++
      if (isVend) v++
      if (isLabour) l++
      if (isJob) j++
      if (isExp) x++
    })
    return { customerCount: c, vendorCount: v, labourCount: l, jobCount: j, expenseCount: x }
  }, [entries])

  // Client-side multi-dimensional filtering (strictly excluding any book-only transactions)
  // 1. Base filtered entries (by entity, dateRange, and search, but without typeFilter)
  const baseFilteredEntries = useMemo(() => {
    return entries.filter(e => {
      // Must be a ledger payment to customer, vendor, labour, job order, or expense
      if (!isLedgerTransaction(e)) return false

      const { isCust, isVend, isLabour, isJob, isExp } = getEntryEntities(e)

      // Entity filter
      if (entityFilter === 'customer' && !isCust) return false
      if (entityFilter === 'vendor' && !isVend) return false
      if (entityFilter === 'labour' && !isLabour) return false
      if (entityFilter === 'job_order' && !isJob) return false
      if (entityFilter === 'expense' && !isExp) return false

      // Date range filter
      if (dateRange === 'today' && e.date !== todayStr) return false
      if (dateRange === 'this_month' && !(e.date || '').startsWith(curMonthStr)) return false
      if (dateRange === 'last_month' && !(e.date || '').startsWith(lastMonthStr)) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchRemark = (e.remark || '').toLowerCase().includes(q)
        const matchParty = (e.party_name || '').toLowerCase().includes(q)
        const matchCust = (e.customer_name || '').toLowerCase().includes(q)
        const matchVend = (e.vendor_name || '').toLowerCase().includes(q)
        const matchLab = (e.labour_name || '').toLowerCase().includes(q)
        const matchJob = (e.job_order_title || e.job_order_number || '').toLowerCase().includes(q)
        const matchCat = (e.category || '').toLowerCase().includes(q)
        const matchRef = (e.reference_number || '').toLowerCase().includes(q)
        const matchAmount = String(e.amount || '').includes(q)
        if (!matchRemark && !matchParty && !matchCust && !matchVend && !matchLab && !matchJob && !matchCat && !matchRef && !matchAmount) {
          return false
        }
      }

      return true
    })
  }, [entries, entityFilter, dateRange, searchQuery, todayStr, curMonthStr, lastMonthStr])

  // 2. Base metrics for KPI summary cards (shows totals for current scope)
  const { totalIn, totalOut, inCount, outCount } = useMemo(() => {
    let tIn = 0
    let tOut = 0
    let cIn = 0
    let cOut = 0
    baseFilteredEntries.forEach(item => {
      const amt = parseFloat(item.amount) || 0
      if (item.entry_type === 'in') {
        tIn += amt
        cIn++
      } else {
        tOut += amt
        cOut++
      }
    })
    return { totalIn: tIn, totalOut: tOut, inCount: cIn, outCount: cOut }
  }, [baseFilteredEntries])

  // 3. Flow-filtered entries for ledger list (All Flow, Cash In, or Cash Out)
  const filteredEntries = useMemo(() => {
    if (typeFilter === 'all') return baseFilteredEntries
    return baseFilteredEntries.filter(e => e.entry_type === typeFilter)
  }, [baseFilteredEntries, typeFilter])

  // 4. Financial summary and chronological ordering
  const { netMovement, sortedChronologicalEntries } = useMemo(() => {
    const sortedAsc = [...filteredEntries].sort((a, b) => {
      const dComp = (a.date || '').localeCompare(b.date || '')
      if (dComp !== 0) return dComp
      const tComp = (a.time || '').localeCompare(b.time || '')
      if (tComp !== 0) return tComp
      return (a.id || 0) - (b.id || 0)
    })

    const startingBal = parseFloat(activeAccount?.balance || 0) - sortedAsc.reduce((acc, item) => {
      const amt = parseFloat(item.amount) || 0
      return acc + (item.entry_type === 'in' ? amt : -amt)
    }, 0)

    let running = startingBal
    const entriesWithRunning = sortedAsc.map(item => {
      const amt = parseFloat(item.amount) || 0
      if (item.entry_type === 'in') {
        running += amt
      } else {
        running -= amt
      }
      return {
        ...item,
        calculated_running_balance: running
      }
    })

    const reversed = [...entriesWithRunning].reverse()

    return {
      netMovement: totalIn - totalOut,
      sortedChronologicalEntries: reversed
    }
  }, [filteredEntries, activeAccount, totalIn, totalOut])

  const fmt = (n) => (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Export to CSV without any Book columns
  const handleExportCSV = () => {
    if (!sortedChronologicalEntries.length) {
      showToast('No entries to export', 'info')
      return
    }
    const headers = ['Date', 'Time', 'Flow Type', 'Entity', 'Particulars / Payee', 'Amount (SAR)', 'Category', 'Payment Channel', 'Reference']
    const rows = sortedChronologicalEntries.map(e => {
      const { primaryEntity } = getEntryEntities(e)
      const channel = e.petty_cash_account_name || e.bank_account_name || e.payment_mode || 'Cash'
      return [
        e.date || '',
        e.time || '',
        e.entry_type === 'in' ? 'Cash In' : 'Cash Out',
        primaryEntity,
        `"${(e.party_name || e.customer_name || e.vendor_name || e.remark || '').replace(/"/g, '""')}"`,
        e.amount || '0',
        e.category || '',
        channel,
        e.reference_number || ''
      ]
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `cash_ledger_${entityFilter}_payments.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Ledger payments exported successfully!', 'success')
  }

  // Exact Color Tokens from Customers Tab UI
  const cardBg = isDarkMode ? '#121417' : '#ffffff'
  const borderColor = isDarkMode ? '#232528' : '#e2e8f0'
  const textPrimary = isDarkMode ? '#ffffff' : '#0f172a'
  const textMuted = isDarkMode ? '#8b9096' : '#64748b'
  const inputBg = isDarkMode ? '#17191d' : '#f8fafc'
  const inputBorder = isDarkMode ? '#282b32' : '#cbd5e1'

  // Entity Pills: Customers, Vendors, Labour, Job Orders, Expenses (Books disconnected)
  const entityPills = [
    { id: 'all', label: 'All Payments', count: entries.length, icon: Layers },
    { id: 'customer', label: 'Customers', count: customerCount, icon: User },
    { id: 'vendor', label: 'Vendors', count: vendorCount, icon: Building2 },
    { id: 'labour', label: 'Labour', count: labourCount, icon: HardHat },
    { id: 'job_order', label: 'Job Orders', count: jobCount, icon: FileText },
    { id: 'expense', label: 'Expenses', count: expenseCount, icon: Receipt },
  ]

  return (
    <div style={{
      maxWidth: '1440px',
      width: '100%',
      margin: '0 auto',
      boxSizing: 'border-box'
    }}>

      {/* ========================================================= */}
      {/* 1. COMMAND HEADER: CASH LEDGER (DISCONNECTED FROM BOOKS) */}
      {/* ========================================================= */}
      <div style={{
        display: 'flex',
        flexDirection: isMobileScreen ? 'column' : 'row',
        alignItems: isMobileScreen ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2 style={{
              fontSize: isMobileScreen ? '1.35rem' : '1.55rem',
              fontWeight: '800',
              color: textPrimary,
              margin: 0,
              letterSpacing: '-0.02em'
            }}>
              Cash Ledger
            </h2>
          </div>
        </div>

        {/* Right Action Bar */}
        <div style={{
          display: 'flex',
          flexDirection: isMobileScreen ? 'column' : 'row',
          alignItems: isMobileScreen ? 'stretch' : 'center',
          gap: isMobileScreen ? '0.5rem' : '0.55rem',
          width: isMobileScreen ? '100%' : 'auto'
        }}>
          {/* Top Row on Mobile: Account Switcher + Export */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: isMobileScreen ? '100%' : 'auto',
            minWidth: 0
          }}>
            {/* Petty Cash Account Switcher */}
            <div style={{ minWidth: isMobileScreen ? 0 : '230px', flex: 1 }}>
              <CashbookSelect
                value={selectedAccountId}
                onChange={(val) => setSelectedAccountId(val)}
                options={[
                  { id: '__all__', label: 'All Ledger Payments', icon: <Layers size={14} strokeWidth={2} /> },
                  ...pettyCashAccounts.map(p => ({
                    id: String(p.id),
                    label: `${p.name} (${fmt(p.balance)} SAR)`,
                    icon: <Wallet size={14} strokeWidth={2} />
                  }))
                ]}
                variant="desktop-toolbar"
                ariaLabel="Select Ledger Scope"
                isDark={isDarkMode}
                style={{ width: '100%' }}
              />
            </div>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              title="Export CSV Statement"
              style={{
                background: cardBg,
                color: textPrimary,
                border: `1px solid ${borderColor}`,
                borderRadius: '10px',
                height: '38px',
                padding: '0 0.85rem',
                fontSize: '0.82rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <Download size={14} />
              <span>Export</span>
            </button>
          </div>

          {/* Action Buttons: desktop only since mobile has persistent bottom bar floating (+) action button */}
          {!isMobileScreen && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              width: 'auto'
            }}>
              {/* Credit (Customer) Button */}
              <button
                type="button"
                onClick={() => onOpenEntryModal('in', {
                  petty_cash_account: (activeAccount?.id && activeAccount.id !== '__all__') ? activeAccount.id : '',
                  petty_cash_account_name: (activeAccount?.id && activeAccount.id !== '__all__') ? activeAccount.name : '',
                  payment_mode: 'Petty Cash'
                })}
                style={{
                  background: isDarkMode ? '#ffffff' : '#0f172a',
                  color: isDarkMode ? '#0f172a' : '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  height: '38px',
                  padding: '0 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  boxShadow: isDarkMode ? 'none' : '0 2px 8px rgba(15, 23, 42, 0.15)',
                  whiteSpace: 'nowrap',
                  width: 'auto',
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
              >
                <Plus size={15} strokeWidth={2.8} />
                <span>Credit (Customer)</span>
              </button>

              {/* Debit (Expense) Button */}
              <button
                type="button"
                id="btn-record-expense"
                onClick={() => onOpenEntryModal('out', {
                  petty_cash_account: (activeAccount?.id && activeAccount.id !== '__all__') ? activeAccount.id : '',
                  petty_cash_account_name: (activeAccount?.id && activeAccount.id !== '__all__') ? activeAccount.name : '',
                  payment_mode: 'Petty Cash'
                })}
                style={{
                  background: isDarkMode ? '#1e2024' : '#ffffff',
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                  border: isDarkMode ? '1px solid #33363d' : '1px solid #0f172a',
                  borderRadius: '10px',
                  height: '38px',
                  padding: '0 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  boxShadow: isDarkMode ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)',
                  whiteSpace: 'nowrap',
                  width: 'auto',
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
              >
                <Minus size={15} strokeWidth={2.8} />
                <span>Debit (Expense)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. 4 FINANCIAL KPI SUMMARY CARDS / MOBILE CAROUSEL        */}
      {/* ========================================================= */}
      <MobileCardCarousel
        isMobile={isMobileScreen}
        isDarkMode={isDarkMode}
        desktopColumns={4}
        gap={isMobileScreen ? '0.65rem' : '1rem'}
        marginBottom={isMobileScreen ? '1rem' : '1.25rem'}
      >
        {/* Card 1: Ledger Volume / In-Hand (Hero Card matching bank_dashboard NET BALANCE) */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => setTypeFilter('all')}
          style={{
            background: typeFilter === 'all' ? (isDarkMode ? '#ffffff' : '#0f172a') : (isDarkMode ? '#141517' : '#ffffff'),
            color: typeFilter === 'all' ? (isDarkMode ? '#0c0d0e' : '#ffffff') : (isDarkMode ? '#ffffff' : '#0f172a'),
            border: typeFilter === 'all'
              ? (isDarkMode ? '2px solid #0f172a' : '2px solid #ffffff')
              : (isDarkMode ? '1px solid #232528' : '1px solid #e2e8f0'),
            borderRadius: '16px',
            padding: isMobileScreen ? '0.75rem 0.95rem' : '1.25rem 1.35rem',
            minHeight: isMobileScreen ? '84px' : '115px',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: typeFilter === 'all' 
              ? (isDarkMode ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 4px 20px rgba(15, 23, 42, 0.18)')
              : (isDarkMode ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.05)'),
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'all 0.18s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: typeFilter === 'all' ? (isDarkMode ? '#55585d' : '#94a3b8') : (isDarkMode ? '#71767b' : '#64748b')
            }}>
              {entityFilter === 'all' ? (selectedAccountId === '__all__' ? 'Total Ledger Flow' : 'Ledger Balance') : `${entityFilter.toUpperCase()} VOLUME`}
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: typeFilter === 'all' ? (isDarkMode ? '#f1f5f9' : '#1e293b') : (isDarkMode ? '#1a1c20' : '#f1f5f9'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: typeFilter === 'all' ? (isDarkMode ? '#0f172a' : '#ffffff') : (isDarkMode ? '#ffffff' : '#0f172a')
            }}>
              <Wallet size={15} strokeWidth={2.2} />
            </div>
          </div>
          <div style={{
            fontSize: isMobileScreen ? '1.2rem' : '1.5rem',
            fontWeight: '800',
            letterSpacing: '-0.02em',
            color: typeFilter === 'all' ? (isDarkMode ? '#0c0d0e' : '#ffffff') : (isDarkMode ? '#ffffff' : '#0f172a'),
            margin: isMobileScreen ? '0.25rem 0 0' : '0.45rem 0 0.2rem 0'
          }}>
            SAR {fmt(selectedAccountId === '__all__' ? (totalIn + totalOut) : activeAccount?.balance)}
          </div>
          {!isMobileScreen && (
            <div style={{
              fontSize: '11px',
              color: typeFilter === 'all' ? (isDarkMode ? '#6a6e75' : '#cbd5e1') : (isDarkMode ? '#60646c' : '#94a3b8')
            }}>
              {baseFilteredEntries.length} entries recorded
            </div>
          )}
        </div>

        {/* Card 2: Total Cash In (+credit received) */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => setTypeFilter(prev => prev === 'in' ? 'all' : 'in')}
          style={{
            background: isDarkMode ? '#141517' : '#ffffff',
            border: typeFilter === 'in'
              ? (isDarkMode ? '2px solid #ffffff' : '2px solid #0f172a')
              : (isDarkMode ? '1px solid #232528' : '1px solid #e2e8f0'),
            borderRadius: '16px',
            padding: isMobileScreen ? '0.75rem 0.95rem' : '1.25rem 1.35rem',
            minHeight: isMobileScreen ? '84px' : '115px',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: typeFilter === 'in'
              ? (isDarkMode ? '0 0 0 1px #ffffff, 0 4px 16px rgba(255, 255, 255, 0.12)' : '0 0 0 1px #0f172a, 0 4px 16px rgba(15, 23, 42, 0.12)')
              : (isDarkMode ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.05)'),
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'all 0.18s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: isDarkMode ? '#71767b' : '#64748b'
            }}>
              LEDGER CASH IN (+CREDIT)
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: isDarkMode ? '#1a1c20' : '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDarkMode ? '#ffffff' : '#0f172a'
            }}>
              <ArrowDownRight size={15} strokeWidth={2.5} />
            </div>
          </div>
          <div style={{
            fontSize: isMobileScreen ? '1.2rem' : '1.5rem',
            fontWeight: '800',
            letterSpacing: '-0.02em',
            color: isDarkMode ? '#ffffff' : '#0f172a',
            margin: isMobileScreen ? '0.25rem 0 0' : '0.45rem 0 0.2rem 0'
          }}>
            + SAR {fmt(totalIn)}
          </div>
          {!isMobileScreen && (
            <div style={{ fontSize: '11px', color: isDarkMode ? '#60646c' : '#94a3b8' }}>
              {inCount} received ledger transactions
            </div>
          )}
        </div>

        {/* Card 3: Total Cash Out (-debit payouts) */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => setTypeFilter(prev => prev === 'out' ? 'all' : 'out')}
          style={{
            background: isDarkMode ? '#141517' : '#ffffff',
            border: typeFilter === 'out'
              ? (isDarkMode ? '2px solid #ffffff' : '2px solid #0f172a')
              : (isDarkMode ? '1px solid #232528' : '1px solid #e2e8f0'),
            borderRadius: '16px',
            padding: isMobileScreen ? '0.75rem 0.95rem' : '1.25rem 1.35rem',
            minHeight: isMobileScreen ? '84px' : '115px',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: typeFilter === 'out'
              ? (isDarkMode ? '0 0 0 1px #ffffff, 0 4px 16px rgba(255, 255, 255, 0.12)' : '0 0 0 1px #0f172a, 0 4px 16px rgba(15, 23, 42, 0.12)')
              : (isDarkMode ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.05)'),
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'all 0.18s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: isDarkMode ? '#71767b' : '#64748b'
            }}>
              LEDGER CASH OUT (-DEBIT)
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: isDarkMode ? '#1a1c20' : '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDarkMode ? '#ffffff' : '#0f172a'
            }}>
              <ArrowUpRight size={15} strokeWidth={2.5} />
            </div>
          </div>
          <div style={{
            fontSize: isMobileScreen ? '1.2rem' : '1.5rem',
            fontWeight: '800',
            letterSpacing: '-0.02em',
            color: isDarkMode ? '#ffffff' : '#0f172a',
            margin: isMobileScreen ? '0.25rem 0 0' : '0.45rem 0 0.2rem 0'
          }}>
            - SAR {fmt(totalOut)}
          </div>
          {!isMobileScreen && (
            <div style={{ fontSize: '11px', color: isDarkMode ? '#60646c' : '#94a3b8' }}>
              {outCount} paid ledger transactions
            </div>
          )}
        </div>

        {/* Card 4: Net Flow */}
        <div style={{
          background: isDarkMode ? '#141517' : '#ffffff',
          border: isDarkMode ? '1px solid #232528' : '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: isMobileScreen ? '0.75rem 0.95rem' : '1.25rem 1.35rem',
          minHeight: isMobileScreen ? '84px' : '115px',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: isDarkMode ? '#71767b' : '#64748b'
            }}>
              Net Period Flow
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: isDarkMode ? '#1a1c20' : '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDarkMode ? '#ffffff' : '#0f172a'
            }}>
              <ArrowRightLeft size={15} strokeWidth={2.2} />
            </div>
          </div>
          <div style={{
            fontSize: isMobileScreen ? '1.2rem' : '1.5rem',
            fontWeight: '800',
            letterSpacing: '-0.02em',
            color: isDarkMode ? '#ffffff' : '#0f172a',
            margin: isMobileScreen ? '0.25rem 0 0' : '0.45rem 0 0.2rem 0'
          }}>
            {netMovement >= 0 ? '+' : '-'} SAR {fmt(Math.abs(netMovement))}
          </div>
          {!isMobileScreen && (
            <div style={{ fontSize: '11px', color: isDarkMode ? '#60646c' : '#94a3b8' }}>
              Net balance
            </div>
          )}
        </div>
      </MobileCardCarousel>

      {/* ========================================================= */}
      {/* 3. PRIMARY ENTITY FILTER PILLS (CUSTOMERS, VENDORS, ETC.) */}
      {/* ========================================================= */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '0.85rem'
      }}>
        {/* Entity Filter Dropdown */}
        <div ref={entityDropdownRef} style={{ position: 'relative', width: isMobileScreen ? '100%' : 'auto', minWidth: isMobileScreen ? '100%' : '230px' }}>
          {(() => {
            const currentEntity = entityPills.find(p => p.id === entityFilter) || entityPills[0]
            const CurrentIcon = currentEntity.icon
            return (
              <>
                <button
                  type="button"
                  id="btn-ledger-entity-dropdown"
                  onClick={() => setIsEntityDropdownOpen(prev => !prev)}
                  style={{
                    width: '100%',
                    height: '38px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.65rem',
                    padding: '0 0.85rem',
                    borderRadius: '10px',
                    border: `1px solid ${isEntityDropdownOpen ? (isDarkMode ? '#ffffff' : '#0f172a') : inputBorder}`,
                    background: isDarkMode ? '#141619' : '#ffffff',
                    color: textPrimary,
                    fontSize: '0.825rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      background: isDarkMode ? '#1e2024' : '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isDarkMode ? '#ffffff' : '#0f172a',
                      flexShrink: 0
                    }}>
                      <CurrentIcon size={13} strokeWidth={2.2} />
                    </div>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: textPrimary
                    }}>
                      {currentEntity.label}
                    </span>
                  </div>
                  <ChevronDown
                    size={14}
                    style={{
                      color: textMuted,
                      flexShrink: 0,
                      transition: 'transform 0.15s ease',
                      transform: isEntityDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}
                  />
                </button>

                {isEntityDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 5px)',
                    left: 0,
                    width: isMobileScreen ? '100%' : '260px',
                    background: isDarkMode ? '#16181b' : '#ffffff',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '12px',
                    boxShadow: isDarkMode ? '0 12px 30px rgba(0,0,0,0.6)' : '0 10px 25px rgba(15,23,42,0.12)',
                    padding: '4px',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    boxSizing: 'border-box'
                  }}>
                    {entityPills.map(tab => {
                      const active = entityFilter === tab.id
                      const Icon = tab.icon
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setEntityFilter(tab.id)
                            setIsEntityDropdownOpen(false)
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.55rem 0.75rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: active ? (isDarkMode ? '#232528' : '#f1f5f9') : 'transparent',
                            color: active ? (isDarkMode ? '#ffffff' : '#0f172a') : textPrimary,
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: active ? '700' : '500',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'all 0.12s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (!active) {
                              e.currentTarget.style.background = isDarkMode ? '#1c1e21' : '#f8fafc'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              e.currentTarget.style.background = 'transparent'
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              background: active 
                                ? (isDarkMode ? '#ffffff' : '#0f172a') 
                                : (isDarkMode ? '#1f2125' : '#f1f5f9'),
                              color: active 
                                ? (isDarkMode ? '#0f172a' : '#ffffff') 
                                : (isDarkMode ? '#9ca3af' : '#64748b'),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Icon size={13} strokeWidth={active ? 2.5 : 2} />
                            </div>
                            <span>{tab.label}</span>
                          </div>
                          {active && <Check size={14} style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }} />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )
          })()}
        </div>

        {/* Search Bar */}
        <div style={{
          position: 'relative',
          width: isMobileScreen ? '100%' : '300px'
        }}>
          <Search size={15} style={{
            position: 'absolute',
            left: '0.85rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: textMuted
          }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 2rem 0 2.35rem',
              borderRadius: '10px',
              border: `1px solid ${inputBorder}`,
              background: inputBg,
              color: textPrimary,
              fontSize: '0.825rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: textMuted,
                cursor: 'pointer',
                padding: 0
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. SECONDARY FILTERS: FLOW TYPE, DATES, RESET (NO BOOKS)  */}
      {/* ========================================================= */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.65rem',
        marginBottom: '1rem',
        padding: '0.5rem 0.75rem',
        background: isDarkMode ? '#141619' : '#f8fafc',
        border: `1px solid ${borderColor}`,
        borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Date Range quick selector */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: isDarkMode ? '#1b1d22' : '#ffffff',
            border: `1px solid ${borderColor}`,
            padding: '2px',
            borderRadius: '999px',
            gap: '2px'
          }}>
            {[
              { id: 'all', label: 'All Dates' },
              { id: 'today', label: 'Today' },
              { id: 'this_month', label: 'This Month' }
            ].map(d => {
              const active = dateRange === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDateRange(d.id)}
                  style={{
                    background: active ? (isDarkMode ? '#ffffff' : '#0f172a') : 'transparent',
                    color: active ? (isDarkMode ? '#0c0d0e' : '#ffffff') : textMuted,
                    border: 'none',
                    borderRadius: '999px',
                    padding: '4px 9px',
                    fontSize: '0.74rem',
                    fontWeight: active ? '700' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>


      </div>

      {/* ========================================================= */}
      {/* 5. MASTER DATA TABLE / MOBILE CARDS                       */}
      {/* ========================================================= */}
      {loading ? (
        <div style={{
          background: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: '16px',
          padding: '2.5rem',
          textAlign: 'center',
          color: textMuted
        }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
          <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>Loading ledger payments...</div>
        </div>
      ) : sortedChronologicalEntries.length === 0 ? (
        <div style={{
          background: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: '16px',
          padding: '3.5rem 1.5rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: isDarkMode ? '#1a1c20' : '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            color: textMuted
          }}>
            <Wallet size={22} />
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: textPrimary, margin: '0 0 0.35rem' }}>
            No {entityFilter !== 'all' ? `${entityFilter} ` : ''}payments found
          </h3>
          <p style={{ fontSize: '0.825rem', color: textMuted, margin: '0 0 1.25rem' }}>
            {searchQuery 
              ? `No transactions matching "${searchQuery}"` 
              : `No payments recorded for the selected filter. In the Cash Ledger, only payments made to Expenses, Customers, Vendors, Labour, and Job Orders are shown.`}
          </p>
          <button
            type="button"
            onClick={() => onOpenEntryModal('out', {
              petty_cash_account: (activeAccount?.id && activeAccount.id !== '__all__') ? activeAccount.id : '',
              petty_cash_account_name: (activeAccount?.id && activeAccount.id !== '__all__') ? activeAccount.name : '',
              payment_mode: 'Petty Cash'
            })}
            style={{
              background: isDarkMode ? '#ffffff' : '#0f172a',
              color: isDarkMode ? '#0f172a' : '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '0.55rem 1.15rem',
              fontSize: '0.825rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            + Record Payment
          </button>
        </div>
      ) : isMobileScreen ? (
        /* Mobile Cards View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {sortedChronologicalEntries.map((item) => {
            const isIn = item.entry_type === 'in'
            const amt = parseFloat(item.amount) || 0
            const runBal = item.calculated_running_balance !== undefined 
              ? item.calculated_running_balance 
              : (item.running_balance !== null && item.running_balance !== undefined ? parseFloat(item.running_balance) : null)
            const { isCust, isVend, isLabour, isJob, isExp, primaryEntity } = getEntryEntities(item)
            const channel = item.petty_cash_account_name || item.bank_account_name || item.payment_mode || 'Cash'

            return (
              <div
                key={item.id}
                style={{
                  background: cardBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '14px',
                  padding: '0.85rem',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isIn 
                        ? (isDarkMode ? 'rgba(22, 163, 74, 0.15)' : '#dcfce7')
                        : (isDarkMode ? 'rgba(220, 38, 38, 0.15)' : '#fee2e2'),
                      color: isIn 
                        ? (isDarkMode ? '#4ade80' : '#16a34a')
                        : (isDarkMode ? '#f87171' : '#dc2626'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700'
                    }}>
                      {isIn ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.88rem', color: textPrimary }}>
                        {item.remark || (isIn ? 'Cash In Receipt' : 'Disbursement')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: textMuted }}>
                        {item.date} {item.time ? `• ${item.time}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Flow and Entity Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      background: isCust ? (isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe') :
                                  isVend ? (isDarkMode ? 'rgba(168, 85, 247, 0.2)' : '#f3e8ff') :
                                  isLabour ? (isDarkMode ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7') :
                                  isJob ? (isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff') :
                                  (isDarkMode ? '#1e2024' : '#f1f5f9'),
                      color: isCust ? (isDarkMode ? '#93c5fd' : '#1e40af') :
                             isVend ? (isDarkMode ? '#d8b4fe' : '#6b21a8') :
                             isLabour ? (isDarkMode ? '#fcd34d' : '#92400e') :
                             isJob ? (isDarkMode ? '#a5b4fc' : '#3730a3') : textMuted
                    }}>
                      {primaryEntity}
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      padding: '2px 7px',
                      borderRadius: '999px',
                      background: isIn 
                        ? (isDarkMode ? 'rgba(22, 163, 74, 0.15)' : '#dcfce7')
                        : (isDarkMode ? 'rgba(220, 38, 38, 0.15)' : '#fee2e2'),
                      color: isIn 
                        ? (isDarkMode ? '#4ade80' : '#16a34a')
                        : (isDarkMode ? '#f87171' : '#dc2626')
                    }}>
                      {isIn ? 'In' : 'Out'}
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.4rem',
                  padding: '0.55rem',
                  background: isDarkMode ? '#16181b' : '#f8fafc',
                  borderRadius: '10px',
                  marginBottom: '0.5rem',
                  textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Channel</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: '700', color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {channel}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Amount</div>
                    <div style={{
                      fontSize: '0.78rem',
                      fontWeight: '800',
                      color: isIn ? (isDarkMode ? '#4ade80' : '#16a34a') : (isDarkMode ? '#f87171' : '#dc2626')
                    }}>
                      {isIn ? '+' : '-'}{fmt(amt)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Balance</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: '700', color: textPrimary }}>
                      {runBal !== null ? fmt(runBal) : '—'}
                    </div>
                  </div>
                </div>

                {/* Party / Payee subtext */}
                {(item.party_name || item.customer_name || item.vendor_name || item.job_order_title) && (
                  <div style={{ fontSize: '0.74rem', color: textMuted }}>
                    <strong>Party:</strong> {item.party_name || item.customer_name || item.vendor_name}
                    {item.job_order_title ? ` • Job: ${item.job_order_title}` : ''}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Desktop Table View - Pure Ledger Payments (Disconnected from Books) */
        <div style={{
          background: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: '16px',
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.02)',
          width: '100%',
          maxWidth: '100%'
        }}>
          <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{
                borderBottom: `1px solid ${borderColor}`,
                background: isDarkMode ? '#141517' : '#f8fafc'
              }}>
                <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  DATE & TIME
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  TRANSACTION PARTICULARS
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  RELATION / ENTITY
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  PAYMENT CHANNEL
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  CATEGORY
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  FLOW
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  AMOUNT (SAR)
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  RUNNING BALANCE
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedChronologicalEntries.map((item, idx) => {
                const isIn = item.entry_type === 'in'
                const amt = parseFloat(item.amount) || 0
                const runBal = item.calculated_running_balance !== undefined 
                  ? item.calculated_running_balance 
                  : (item.running_balance !== null && item.running_balance !== undefined ? parseFloat(item.running_balance) : null)
                const { isCust, isVend, isLabour, isJob, isExp } = getEntryEntities(item)
                const channel = item.petty_cash_account_name || item.bank_account_name || item.payment_mode || 'Cash'

                return (
                  <tr
                    key={item.id || idx}
                    style={{
                      borderBottom: `1px solid ${borderColor}`,
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = isDarkMode ? '#16181b' : '#f8fafc' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Date & Time */}
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.825rem', color: textPrimary }}>
                        {item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </div>
                      {item.time && (
                        <div style={{ fontSize: '0.72rem', color: textMuted, marginTop: '1px' }}>
                          {item.time}
                        </div>
                      )}
                    </td>

                    {/* Particulars & Remark */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: isIn 
                            ? (isDarkMode ? 'rgba(22, 163, 74, 0.15)' : '#dcfce7')
                            : (isDarkMode ? 'rgba(220, 38, 38, 0.15)' : '#fee2e2'),
                          color: isIn 
                            ? (isDarkMode ? '#4ade80' : '#16a34a')
                            : (isDarkMode ? '#f87171' : '#dc2626'),
                          fontWeight: '700',
                          fontSize: '0.825rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {isIn ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.875rem', color: textPrimary }}>
                            {item.remark || (isIn ? 'Cash In Receipt' : 'Cash Out Disbursement')}
                          </div>
                          {(item.party_name || item.customer_name || item.vendor_name || item.reference_number) && (
                            <div style={{ fontSize: '0.72rem', color: textMuted, marginTop: '1px' }}>
                              {item.party_name || item.customer_name || item.vendor_name}
                              {item.reference_number ? ` • Ref: ${item.reference_number}` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Relation / Entity Badge */}
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                        {isCust && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: '700',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: isDarkMode ? 'rgba(59, 130, 246, 0.18)' : '#dbeafe',
                            color: isDarkMode ? '#93c5fd' : '#1e40af',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <User size={10} />
                            <span>Customer: {item.customer_name || item.party_name || 'Client'}</span>
                          </span>
                        )}
                        {isVend && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: '700',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: isDarkMode ? 'rgba(168, 85, 247, 0.18)' : '#f3e8ff',
                            color: isDarkMode ? '#d8b4fe' : '#6b21a8',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <Building2 size={10} />
                            <span>Vendor: {item.vendor_name || item.party_name || 'Supplier'}</span>
                          </span>
                        )}
                        {isLabour && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: '700',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: isDarkMode ? 'rgba(245, 158, 11, 0.18)' : '#fef3c7',
                            color: isDarkMode ? '#fcd34d' : '#92400e',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <HardHat size={10} />
                            <span>Labour: {item.labour_name || item.staff_name || item.party_name || 'Worker'}</span>
                          </span>
                        )}
                        {isJob && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: '700',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: isDarkMode ? 'rgba(99, 102, 241, 0.18)' : '#e0e7ff',
                            color: isDarkMode ? '#a5b4fc' : '#3730a3',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <FileText size={10} />
                            <span>Job: {item.job_order_number ? `[${item.job_order_number}] ` : ''}{item.job_order_title || 'Job Order'}</span>
                          </span>
                        )}
                        {isExp && !isCust && !isVend && !isLabour && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: '700',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: isDarkMode ? '#1e2024' : '#f1f5f9',
                            color: textMuted,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <Receipt size={10} />
                            <span>Expense</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Payment Channel (Disconnected from Books) */}
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {item.payment_mode === 'Bank Transfer' ? (
                          <Landmark size={13} style={{ color: textMuted }} />
                        ) : (
                          <Wallet size={13} style={{ color: textMuted }} />
                        )}
                        <span style={{ fontSize: '0.78rem', fontWeight: '600', color: textPrimary }}>
                          {channel}
                        </span>
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: '600',
                        color: textMuted,
                        background: isDarkMode ? '#1a1c20' : '#f1f5f9',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        {item.category || 'General'}
                      </span>
                    </td>

                    {/* Flow Type Badge */}
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 9px',
                        borderRadius: '999px',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        background: isIn 
                          ? (isDarkMode ? 'rgba(22, 163, 74, 0.15)' : '#dcfce7')
                          : (isDarkMode ? 'rgba(220, 38, 38, 0.15)' : '#fee2e2'),
                        color: isIn 
                          ? (isDarkMode ? '#4ade80' : '#16a34a')
                          : (isDarkMode ? '#f87171' : '#dc2626')
                      }}>
                        {isIn ? 'Cash In' : 'Cash Out'}
                      </span>
                    </td>

                    {/* Amount */}
                    <td style={{
                      padding: '0.85rem 1rem',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      fontWeight: '800',
                      fontSize: '0.875rem',
                      color: isIn 
                        ? (isDarkMode ? '#4ade80' : '#16a34a')
                        : (isDarkMode ? '#f87171' : '#dc2626')
                    }}>
                      {isIn ? '+' : '-'}{fmt(amt)} SAR
                    </td>

                    {/* Running In-Hand Balance */}
                    <td style={{
                      padding: '0.85rem 1rem',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      fontWeight: '700',
                      fontSize: '0.85rem',
                      color: runBal !== null && runBal < 0 ? (isDarkMode ? '#f87171' : '#dc2626') : textPrimary
                    }}>
                      {runBal !== null ? `${fmt(runBal)} SAR` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
