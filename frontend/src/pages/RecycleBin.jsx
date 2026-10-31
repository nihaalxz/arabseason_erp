import { useState, useEffect, useMemo } from 'react'
import {
  Trash2, RotateCcw, RefreshCw, Search, Shield, Info,
  CheckCircle2, Clock, Eye, AlertCircle, FileText, Filter,
  Building2, Users, Receipt, Briefcase, CreditCard, BookOpen
} from '../components/icons'
import { X, ArrowLeft, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import CredSearchInput from '../components/cashbook/cred/CredSearchInput'
import Money from '../components/cashbook/cred/Money'
import api from '../api'
import Modal from '../components/common/Modal'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { showConfirm, showToast, showError, showSuccess } from '../utils/swal'
import { CredAnimatedTabs } from '../components/cashbook/cred/CredAnimatedTabs'
import CredPagination from '../components/cashbook/cred/CredPagination'
import { usePagination, PAGE_SIZE_MOBILE, getAmountFontSize } from '../components/cashbook/cred/usePagination'

const ENTITY_CATEGORIES = [
  { id: 'all', label: 'All Items', icon: Filter },
  { id: 'cashbook', label: 'Cashbook', icon: BookOpen, types: ['cashbook_entry', 'cashbook'] },
  { id: 'jobs', label: 'Job Orders', icon: Briefcase, types: ['job_order'] },
  { id: 'expenses', label: 'Expenses', icon: Receipt, types: ['expense'] },
  { id: 'contacts', label: 'Customers & Vendors', icon: Users, types: ['customer', 'vendor'] },
  { id: 'billing', label: 'Invoices & Quotes', icon: FileText, types: ['invoice', 'quotation', 'credit_note', 'delivery_note', 'estimation'] },
  { id: 'payments', label: 'Payments & Payroll', icon: CreditCard, types: ['customer_payment', 'vendor_payment', 'salary_payment', 'payment_request'] },
]

const TYPE_COLORS = {
  cashbook_entry: { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.25)', label: 'Cashbook Entry' },
  cashbook: { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.25)', label: 'Cash Book' },
  job_order: { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb', border: 'rgba(59, 130, 246, 0.25)', label: 'Job Order' },
  expense: { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706', border: 'rgba(245, 158, 11, 0.25)', label: 'Expense' },
  customer: { bg: 'rgba(99, 102, 241, 0.12)', text: '#4f46e5', border: 'rgba(99, 102, 241, 0.25)', label: 'Customer' },
  vendor: { bg: 'rgba(236, 72, 153, 0.12)', text: '#db2777', border: 'rgba(236, 72, 153, 0.25)', label: 'Vendor' },
  invoice: { bg: 'rgba(139, 92, 246, 0.12)', text: '#7c3aed', border: 'rgba(139, 92, 246, 0.25)', label: 'Invoice' },
  quotation: { bg: 'rgba(14, 165, 233, 0.12)', text: '#0284c7', border: 'rgba(14, 165, 233, 0.25)', label: 'Quotation' },
  credit_note: { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.25)', label: 'Credit Note' },
  delivery_note: { bg: 'rgba(20, 184, 166, 0.12)', text: '#0d9488', border: 'rgba(20, 184, 166, 0.25)', label: 'Delivery Note' },
  estimation: { bg: 'rgba(168, 85, 247, 0.12)', text: '#9333ea', border: 'rgba(168, 85, 247, 0.25)', label: 'Estimation' },
  customer_payment: { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.25)', label: 'Customer Payment' },
  vendor_payment: { bg: 'rgba(244, 63, 94, 0.12)', text: '#e11d48', border: 'rgba(244, 63, 94, 0.25)', label: 'Vendor Payment' },
  salary_payment: { bg: 'rgba(132, 204, 22, 0.12)', text: '#65a30d', border: 'rgba(132, 204, 22, 0.25)', label: 'Salary Payment' },
  payment_request: { bg: 'rgba(234, 88, 12, 0.12)', text: '#c2410c', border: 'rgba(234, 88, 12, 0.25)', label: 'Payment Request' },
  other: { bg: 'rgba(107, 114, 128, 0.12)', text: '#4b5563', border: 'rgba(107, 114, 128, 0.25)', label: 'Record' }
}

const CASHBOOK_CATEGORIES = [
  { id: 'all', label: 'All Cashbook Items', icon: Filter, types: ['cashbook_entry', 'cashbook'] },
  { id: 'cashbook_entry', label: 'Cash Transactions', icon: Receipt, types: ['cashbook_entry'] },
  { id: 'cashbook', label: 'Cash Books', icon: BookOpen, types: ['cashbook'] },
]

const getMobileItemIcon = (entityType, isDebit) => {
  if (entityType === 'cashbook_entry') {
    return isDebit ? ArrowUpRight : ArrowDownLeft
  }
  if (entityType === 'cashbook') return BookOpen
  if (entityType === 'job_order') return Briefcase
  if (entityType === 'expense') return Receipt
  if (entityType === 'customer') return Users
  if (entityType === 'vendor') return Building2
  if (['customer_payment', 'vendor_payment', 'salary_payment', 'payment_request'].includes(entityType)) return CreditCard
  return FileText
}

const getMobileItemMeta = (item, formatDateFn) => {
  const fields = item.item_data?.fields || {}
  const isCashbookEntry = item.entity_type === 'cashbook_entry' || item.model_name === 'CashBookEntry'
  
  let typeLabel = (item.entity_type_display || item.entity_type || 'RECORD').toUpperCase()
  let title = item.item_name || 'Untitled Record'
  let amountVal = null
  let isDebit = false
  let detailParts = []
  
  if (isCashbookEntry) {
    typeLabel = 'CASHBOOK TRANSACTION'
    const remark = fields.remark || fields.description || ''
    const party = fields.party_name || fields.staff_name || ''
    const category = fields.category || ''
    const entryTypeRaw = String(fields.entry_type || 'out').toLowerCase()
    const isCredit = entryTypeRaw === 'in'
    isDebit = !isCredit
    const shortDir = isCredit ? 'In' : 'Out'
    const dirName = isCredit ? 'Credit (Inflow)' : 'Debit (Outflow)'
    const mainTitle = remark || party || category || 'Cashbook Transaction'
    const partySuffix = (party && remark && !remark.toLowerCase().includes(party.toLowerCase())) ? ` [${party}]` : ''
    
    title = `${shortDir}: ${mainTitle}${partySuffix}`
    amountVal = fields.amount != null && fields.amount !== '' ? fields.amount : null
    
    if (fields.date) detailParts.push(fields.date)
    if (dirName) detailParts.push(dirName)
    if (party && party !== mainTitle) detailParts.push(party)
    else if (category) detailParts.push(category)
    if (fields.payment_mode) detailParts.push(fields.payment_mode)
    if (fields.bank_account_name || fields.petty_cash_account_name) {
      detailParts.push(fields.bank_account_name || fields.petty_cash_account_name)
    }
  } else if (item.entity_type === 'cashbook') {
    typeLabel = 'CASH BOOK'
    title = item.item_name || fields.name || 'Cash Book'
    if (fields.opening_balance != null && fields.opening_balance !== '') {
      amountVal = fields.opening_balance
    }
    if (fields.created_at) detailParts.push(formatDateFn(fields.created_at))
    if (fields.book_type) detailParts.push(fields.book_type)
  } else if (item.entity_type === 'expense') {
    typeLabel = 'EXPENSE'
    title = item.item_name || fields.title || fields.description || 'Expense'
    amountVal = fields.amount != null && fields.amount !== '' ? fields.amount : null
    isDebit = true
    if (fields.date) detailParts.push(fields.date)
    if (fields.category) detailParts.push(fields.category)
    if (fields.payment_mode) detailParts.push(fields.payment_mode)
  } else if (item.entity_type === 'job_order') {
    typeLabel = 'JOB ORDER'
    title = item.item_name || fields.client_name || fields.job_number || 'Job Order'
    amountVal = fields.total_amount || fields.amount || null
    if (fields.date) detailParts.push(fields.date)
    if (fields.status) detailParts.push(fields.status)
    if (fields.client_name) detailParts.push(fields.client_name)
  } else {
    typeLabel = (item.entity_type_display || item.entity_type || 'RECORD').toUpperCase()
    title = item.item_name || 'Record'
    if (fields.amount != null && fields.amount !== '') {
      amountVal = fields.amount
    } else if (fields.total_amount != null && fields.total_amount !== '') {
      amountVal = fields.total_amount
    } else if (fields.grand_total != null && fields.grand_total !== '') {
      amountVal = fields.grand_total
    }
    if (item.item_summary) {
      const parts = item.item_summary.split(' | ').filter(Boolean)
      detailParts.push(...parts)
    }
  }

  const cleanDetailParts = detailParts.map(p => String(p).replace(/ \| /g, ' · ')).filter(Boolean)
  const detailLine = cleanDetailParts.join(' · ')
  const deletedInfo = `Deleted by ${item.deleted_by_name || 'admin'} · ${formatDateFn(item.deleted_at)}`
  
  return {
    typeLabel,
    title,
    amountVal,
    isDebit,
    detailLine,
    deletedInfo
  }
}

const RecycleBin = ({ 
  embedded = false, 
  cashbookOnly = false, 
  isDarkMode: isDarkModeProp,
  onBack,
  isMobile: isMobileProp
}) => {
  const [items, setItems] = useState([])
  const [stats, setStats] = useState({ total_active: 0, total_restored: 0, by_type: {} })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active') // 'active' | 'restored' | 'all'
  const [restoringId, setRestoringId] = useState(null)
  const [detailItem, setDetailItem] = useState(null)

  const [internalIsMobile, setInternalIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768
    }
    return false
  })

  useEffect(() => {
    const handleResize = () => {
      setInternalIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isMobile = typeof isMobileProp === 'boolean' ? isMobileProp : internalIsMobile

  // Reactive Light / Dark Theme State
  const [isDark, setIsDark] = useState(() => {
    if (typeof isDarkModeProp === 'boolean') return isDarkModeProp
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('cb-dark-bw') ||
             document.body.classList.contains('cb-dark-bw') ||
             localStorage.getItem('cashbook_dark_mode') === 'true' ||
             document.documentElement.getAttribute('data-theme') === 'dark'
    }
    return false
  })

  useEffect(() => {
    if (typeof isDarkModeProp === 'boolean') {
      setIsDark(isDarkModeProp)
      return
    }
    const checkDark = () => {
      const dark = document.documentElement.classList.contains('cb-dark-bw') ||
                   document.body.classList.contains('cb-dark-bw') ||
                   localStorage.getItem('cashbook_dark_mode') === 'true' ||
                   document.documentElement.getAttribute('data-theme') === 'dark'
      setIsDark(dark)
    }
    const observer = new MutationObserver(checkDark)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [isDarkModeProp])

  // Semantic Theme Tokens
  const theme = useMemo(() => ({
    cardBg: isDark ? '#111215' : '#ffffff',
    cardBorder: isDark ? '#202226' : '#e2e8f0',
    itemCardBg: isDark ? '#131417' : '#ffffff',
    itemCardBorder: isDark ? '#22252a' : '#e2e8f0',
    textMain: isDark ? '#f8fafc' : '#0f172a',
    textMuted: isDark ? '#8b9096' : '#64748b',
    subText: isDark ? '#60646c' : '#94a3b8',
    inputBg: isDark ? '#16181b' : '#f8fafc',
    inputBorder: isDark ? '#282b30' : '#d1d5db',
    tabContainerBg: isDark ? '#16181b' : '#f1f5f9',
    tabContainerBorder: isDark ? '#26292e' : '#e2e8f0',
    tabActiveBg: isDark ? '#23262b' : '#ffffff',
    tabActiveColor: isDark ? '#ffffff' : '#0f172a',
    tabInactiveColor: isDark ? '#71767b' : '#64748b',
    pillBg: isDark ? '#16181b' : '#f8fafc',
    pillBorder: isDark ? '#26292e' : '#e2e8f0',
    pillColor: isDark ? '#8b9096' : '#475569',
    pillActiveBg: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.08)',
    pillActiveBorder: isDark ? '#3b82f6' : '#2563eb',
    pillActiveColor: isDark ? '#60a5fa' : '#2563eb',
    detailsBtnBg: isDark ? '#181a1d' : '#ffffff',
    detailsBtnBorder: isDark ? '#26292e' : '#d1d5db',
    detailsBtnColor: isDark ? '#cbd5e1' : '#374151',
    divider: isDark ? '#1c1e22' : '#f1f5f9'
  }), [isDark])

  const activeDisplayCount = useMemo(() => {
    if (cashbookOnly) {
      if (typeof stats.total_active === 'number' && stats.by_type) {
        return (stats.by_type?.cashbook_entry || 0) + (stats.by_type?.cashbook || 0)
      }
    }
    return stats.total_active || 0
  }, [cashbookOnly, stats])

  const restoredDisplayCount = useMemo(() => {
    return stats.total_restored || 0
  }, [stats])

  useEffect(() => {
    fetchItems()
    fetchStats()
  }, [statusFilter, cashbookOnly])

  const fetchItems = async () => {
    try {
      setLoading(true)
      const url = `recycle-bin/?status=${statusFilter}${cashbookOnly ? '&module=cashbook' : ''}`
      const res = await api.get(url)
      setItems(res.data.results || res.data || [])
    } catch (err) {
      console.error(err)
      showError('Failed to load items', 'Could not load Recycle Bin data')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const url = `recycle-bin/stats/${cashbookOnly ? '?module=cashbook' : ''}`
      const res = await api.get(url)
      setStats(res.data || { total_active: 0, total_restored: 0, by_type: {} })
    } catch (err) {
      console.error(err)
    }
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchItems(), fetchStats()])
    setRefreshing(false)
    showToast('Recycle Bin refreshed')
  }

  const handleRestore = async (item) => {
    const confirmed = await showConfirm(
      'Restore Record?',
      `Restore "${item.item_name}" back to its active records? It will become visible and active immediately.`,
      'Restore Item',
      false
    )
    if (!confirmed) return

    try {
      setRestoringId(item.id)
      const res = await api.post(`recycle-bin/${item.id}/restore/`)
      if (res.data?.success) {
        showSuccess('Restored!', res.data.message || 'Item restored successfully.')
        await Promise.all([fetchItems(), fetchStats()])
        if (detailItem?.id === item.id) {
          setDetailItem(null)
        }
      }
    } catch (err) {
      console.error(err)
      showError('Restore Failed', err.response?.data?.detail || err.response?.data?.error || 'Failed to restore item.')
    } finally {
      setRestoringId(null)
    }
  }

  const handlePermanentDelete = async (item) => {
    const confirmed = await showConfirm({
      title: 'Delete Record?',
      text: `Are you sure you want to permanently delete "${item.item_name}"? This action cannot be undone.`,
      confirmButtonText: 'Delete',
      isDangerous: true,
      allowPermanent: false
    })
    if (!confirmed) return

    try {
      setRestoringId(item.id)
      await api.delete(`recycle-bin/${item.id}/`)
      showToast('Record permanently deleted from Recycle Bin.', 'success')
      await Promise.all([fetchItems(), fetchStats()])
      if (detailItem?.id === item.id) {
        setDetailItem(null)
      }
    } catch (err) {
      console.error(err)
      showError('Delete Failed', err.response?.data?.detail || 'Failed to permanently delete item.')
    } finally {
      setRestoringId(null)
    }
  }

  const categoriesList = cashbookOnly ? CASHBOOK_CATEGORIES : ENTITY_CATEGORIES

  const filteredItems = useMemo(() => {
    let result = items

    // In cashbook mode, strictly restrict items to cashbook types
    if (cashbookOnly) {
      result = result.filter(item => ['cashbook_entry', 'cashbook'].includes(item.entity_type))
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      const cat = categoriesList.find(c => c.id === selectedCategory)
      if (cat?.types) {
        result = result.filter(item => cat.types.includes(item.entity_type))
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(item =>
        (item.item_name && item.item_name.toLowerCase().includes(q)) ||
        (item.item_summary && item.item_summary.toLowerCase().includes(q)) ||
        (item.deleted_by_name && item.deleted_by_name.toLowerCase().includes(q)) ||
        (item.entity_type_display && item.entity_type_display.toLowerCase().includes(q)) ||
        (item.model_name && item.model_name.toLowerCase().includes(q))
      )
    }

    return result
  }, [items, selectedCategory, searchQuery, cashbookOnly, categoriesList])

  const formatDate = (isoStr) => {
    if (!isoStr) return '—'
    try {
      const d = new Date(isoStr)
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch (e) {
      return isoStr
    }
  }

  const statusTabs = useMemo(() => [
    { id: 'active', label: `In Recycle Bin (${activeDisplayCount})` },
    { id: 'restored', label: `Restored (${restoredDisplayCount})` }
  ], [activeDisplayCount, restoredDisplayCount])

  const mobileStatusTabs = useMemo(() => [
    { id: 'active', label: `Recycle Bin (${activeDisplayCount})` },
    { id: 'restored', label: `Restored (${restoredDisplayCount})` }
  ], [activeDisplayCount, restoredDisplayCount])

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const da = a.deleted_at ? new Date(a.deleted_at).getTime() : 0
      const db = b.deleted_at ? new Date(b.deleted_at).getTime() : 0
      return db - da
    })
  }, [filteredItems])

  const {
    pageItems,
    page,
    setPage,
    totalPages,
    rangeStart,
    rangeEnd,
    total
  } = usePagination(sortedItems, isMobile ? PAGE_SIZE_MOBILE : sortedItems.length, `${statusFilter}-${selectedCategory}-${searchQuery}`)

  return (
    <>
      {isMobile ? (
        <div
          className="recycle-bin-mobile"
          style={{
            width: '100%',
            maxWidth: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
            padding: '4px 0 24px',
            fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
            color: isDark ? '#FFFFFF' : '#0A0A0A'
          }}
        >
          <style>{`
            .cred-recycle-tabs.cred-atabs-list {
              display: flex !important;
              width: 100% !important;
              gap: 3px !important;
              padding: 0 !important;
              box-sizing: border-box !important;
            }
            .cred-recycle-tabs .cred-atabs-tab {
              flex: 1 1 0 !important;
              min-width: 0 !important;
              height: 32px !important;
              padding: 0 4px !important;
              justify-content: center !important;
              text-align: center !important;
            }
            .cred-recycle-tabs .cred-atabs-label {
              font-size: 11.5px !important;
              font-weight: 500 !important;
              letter-spacing: -0.01em !important;
              text-align: center !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
            }
          `}</style>
          {/* 1. TOP BAR */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 0 8px'
            }}
          >
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back to More"
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 0',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDark ? '#FFFFFF' : '#0A0A0A',
                outline: 'none',
                width: 'fit-content'
              }}
            >
              <ArrowLeft size={20} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh"
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDark ? '#FFFFFF' : '#0A0A0A',
                outline: 'none',
                opacity: refreshing ? 0.5 : 1
              }}
            >
              <RefreshCw size={18} strokeWidth={2} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Page Title */}
          <h1
            style={{
              margin: '0 0 16px 0',
              fontSize: '24px',
              fontWeight: 600,
              color: isDark ? '#FFFFFF' : '#0A0A0A',
              letterSpacing: '-0.02em',
              textTransform: 'lowercase'
            }}
          >
            recycle bin
          </h1>

          {/* 2. SEARCH */}
          <div style={{ width: '100%', marginBottom: '14px' }}>
            <CredSearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              placeholder="search deleted items..."
              compact={false}
              ariaLabel="Search deleted items"
            />
          </div>

          {/* 3. FILTER TABS */}
          <div
            style={{
              width: '100%',
              marginBottom: '20px'
            }}
          >
            <CredAnimatedTabs
              tabs={mobileStatusTabs}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              className="case-preserve cred-recycle-tabs"
              ariaLabel="Recycle Bin status filter tabs"
              style={{ width: '100%' }}
            />
          </div>

          {/* 4. LIST */}
          {loading ? (
            <div style={{ padding: '1rem 0' }}>
              <SkeletonLoader count={4} />
            </div>
          ) : sortedItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted, #8C8C8C)' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: 'var(--text-muted, #8C8C8C)'
                }}
              >
                <Trash2 size={20} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 500, color: isDark ? '#FFFFFF' : '#0A0A0A', marginBottom: '4px' }}>
                {statusFilter === 'active' ? 'Recycle Bin is Empty' : 'No Items Found'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', maxWidth: '280px', margin: '0 auto' }}>
                {statusFilter === 'active'
                  ? (cashbookOnly ? 'No deleted cashbook transactions or books.' : 'No active deleted items in the Recycle Bin.')
                  : 'No items match your selected filters.'}
              </div>
            </div>
          ) : (
            <div>
              {pageItems.map(item => {
                const meta = getMobileItemMeta(item, formatDate)
                const Icon = getMobileItemIcon(item.entity_type, meta.isDebit)

                return (
                  <div
                    key={item.id}
                    onClick={() => setDetailItem(item)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '16px 0 8px' }}>
                      {/* Left: 44px circular icon, 1px light outline, neutral */}
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.08)',
                          background: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px',
                          color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)'
                        }}
                      >
                        <Icon size={18} strokeWidth={1.5} />
                      </div>

                      {/* Content column */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        {/* Top line: type label */}
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: isDark ? 'rgba(255,255,255,0.45)' : 'var(--text-muted, #71717A)',
                            marginBottom: '6px',
                            lineHeight: 1.2
                          }}
                        >
                          {meta.typeLabel}
                        </div>

                        {/* Title and Amount row */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', minWidth: 0, marginBottom: '6px' }}>
                          <div
                            style={{
                              fontSize: '15px',
                              fontWeight: 500,
                              color: isDark ? '#FFFFFF' : '#0A0A0A',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: 1.4,
                              minWidth: 0,
                              flex: 1
                            }}
                          >
                            {meta.title}
                          </div>

                          {meta.amountVal != null && meta.amountVal !== '' && (
                            <div
                              className="cred-tnum"
                              style={{
                                fontSize: '15px',
                                fontWeight: 500,
                                fontVariantNumeric: 'tabular-nums lining-nums',
                                fontFeatureSettings: "'tnum' 1, 'lnum' 1",
                                color: meta.isDebit ? (isDark ? '#F87171' : '#DC2626') : (isDark ? '#FFFFFF' : '#0A0A0A'),
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                textAlign: 'right',
                                lineHeight: 1.4
                              }}
                            >
                              <Money value={meta.amountVal} />
                            </div>
                          )}
                        </div>

                        {/* Muted detail line */}
                        {meta.detailLine && (
                          <div
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 400,
                              color: isDark ? 'rgba(255,255,255,0.6)' : '#52525B',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginBottom: '6px',
                              lineHeight: 1.45
                            }}
                          >
                            {meta.detailLine}
                          </div>
                        )}

                        {/* Muted small line */}
                        <div
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 400,
                            color: isDark ? 'rgba(255,255,255,0.45)' : '#71717A',
                            lineHeight: 1.4,
                            marginBottom: '8px'
                          }}
                        >
                          {meta.deletedInfo}
                        </div>
                      </div>
                    </div>

                    {/* Actions line: proper buttons with small borders */}
                    {!item.is_restored ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '8px',
                          padding: '2px 0 14px 58px'
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRestore(item)
                          }}
                          disabled={restoringId === item.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 12px',
                            borderRadius: '7px',
                            fontSize: '12px',
                            fontWeight: 500,
                            border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #D4D4D8',
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                            color: isDark ? '#FFFFFF' : '#18181B',
                            cursor: restoringId === item.id ? 'not-allowed' : 'pointer',
                            opacity: restoringId === item.id ? 0.6 : 1,
                            boxShadow: isDark ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.03)',
                            fontFamily: 'inherit',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <RotateCcw size={12} strokeWidth={2} className={restoringId === item.id ? 'animate-spin' : ''} />
                          <span>{restoringId === item.id ? 'Restoring...' : 'Restore'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePermanentDelete(item)
                          }}
                          disabled={restoringId === item.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 12px',
                            borderRadius: '7px',
                            fontSize: '12px',
                            fontWeight: 500,
                            border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(239, 68, 68, 0.3)',
                            background: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)',
                            color: isDark ? '#F87171' : '#DC2626',
                            cursor: restoringId === item.id ? 'not-allowed' : 'pointer',
                            opacity: restoringId === item.id ? 0.6 : 1,
                            boxShadow: isDark ? 'none' : '0 1px 2px rgba(239, 68, 68, 0.04)',
                            fontFamily: 'inherit',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Trash2 size={12} strokeWidth={2} />
                          <span>Delete</span>
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          padding: '2px 0 14px 58px'
                        }}
                      >
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '7px',
                            border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)',
                            background: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: isDark ? '#34D399' : '#059669'
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: '#10B981',
                              display: 'inline-block'
                            }}
                          />
                          <span>Restored</span>
                        </div>
                      </div>
                    )}

                    {/* Inset dashed separator */}
                    <div
                      style={{
                        marginLeft: '58px',
                        borderBottom: isDark ? '1px dashed rgba(255, 255, 255, 0.12)' : '1px dashed rgba(0, 0, 0, 0.08)'
                      }}
                    />
                  </div>
                )
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ marginTop: '16px', paddingBottom: '24px' }}>
                  <CredPagination
                    page={page}
                    totalPages={totalPages}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    total={total}
                    onPageChange={setPage}
                    isMobile={true}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="recycle-bin-container erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', padding: embedded ? '0' : '0', color: theme.textMain }}>
      {/* Top Header Card (only shown when standalone, hidden when embedded in Cashbook) */}
      {!embedded && (
        <div style={{
          background: theme.cardBg,
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
          border: `1px solid ${theme.cardBorder}`,
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Trash2 size={26} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0, color: theme.textMain }}>
                    Recycle Bin
                  </h1>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#059669',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                  }}>
                    <Shield size={12} /> Immutable Protection Active
                  </span>
                </div>
                <p style={{ margin: '0.25rem 0 0 0', color: theme.textMuted, fontSize: '0.875rem' }}>
                  All records deleted across user accounts are preserved here. Items cannot be permanently deleted and can be restored at any time.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  border: `1px solid ${theme.cardBorder}`,
                  background: theme.cardBg,
                  color: theme.textMain,
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats and Filter Bar */}
      <div style={{
        background: theme.cardBg,
        borderRadius: '16px',
        padding: '1.25rem',
        boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
        border: `1px solid ${theme.cardBorder}`,
        marginBottom: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: cashbookOnly ? '0' : '1rem'
      }}>
        {/* Search & Status Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '480px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: theme.subText }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 1rem 0.55rem 2.3rem',
                borderRadius: '8px',
                border: `1px solid ${theme.inputBorder}`,
                fontSize: '0.875rem',
                background: theme.inputBg,
                color: theme.textMain,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {embedded && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh Records"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.inputBorder}`,
                  background: theme.inputBg,
                  color: theme.textMuted,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              </button>
            )}

            {/* Status Tabs */}
            <div style={{
              display: 'inline-flex',
              padding: '4px',
              background: theme.tabContainerBg,
              borderRadius: '10px',
              border: `1px solid ${theme.tabContainerBorder}`
            }}>
              <button
                onClick={() => setStatusFilter('active')}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '7px',
                  fontSize: '0.8125rem',
                  fontWeight: statusFilter === 'active' ? '700' : '500',
                  border: 'none',
                  background: statusFilter === 'active' ? theme.tabActiveBg : 'transparent',
                  color: statusFilter === 'active' ? (isDark ? '#f87171' : '#dc2626') : theme.tabInactiveColor,
                  boxShadow: statusFilter === 'active' ? (isDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.08)') : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <Trash2 size={13} />
                In Recycle Bin ({activeDisplayCount})
              </button>
              <button
                onClick={() => setStatusFilter('restored')}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '7px',
                  fontSize: '0.8125rem',
                  fontWeight: statusFilter === 'restored' ? '700' : '500',
                  border: 'none',
                  background: statusFilter === 'restored' ? theme.tabActiveBg : 'transparent',
                  color: statusFilter === 'restored' ? (isDark ? '#34d399' : '#059669') : theme.tabInactiveColor,
                  boxShadow: statusFilter === 'restored' ? (isDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.08)') : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <CheckCircle2 size={13} />
                Restored ({restoredDisplayCount})
              </button>
            </div>
          </div>
        </div>

        {/* Entity Category Filter Pills (hidden in Cashbook mode) */}
        {!cashbookOnly && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            borderTop: `1px solid ${theme.divider}`,
            paddingTop: '0.75rem'
          }}>
            {categoriesList.map(cat => {
              const Icon = cat.icon
              const isSelected = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    fontWeight: isSelected ? '700' : '500',
                    border: isSelected ? `1px solid ${theme.pillActiveBorder}` : `1px solid ${theme.pillBorder}`,
                    background: isSelected ? theme.pillActiveBg : theme.pillBg,
                    color: isSelected ? theme.pillActiveColor : theme.pillColor,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} />
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Main Content List / Table */}
      {loading ? (
        <div style={{
          background: theme.cardBg,
          padding: '2rem',
          borderRadius: '16px',
          border: `1px solid ${theme.cardBorder}`
        }}>
          <SkeletonLoader count={6} />
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{
          background: theme.cardBg,
          borderRadius: '16px',
          padding: '4rem 2rem',
          textAlign: 'center',
          boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
          border: `1px solid ${theme.cardBorder}`
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
            color: isDark ? '#34d399' : '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto'
          }}>
            <CheckCircle2 size={32} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: theme.textMain, margin: '0 0 0.5rem 0' }}>
            {statusFilter === 'active' ? 'Recycle Bin is Empty' : 'No Items Found'}
          </h3>
          <p style={{ color: theme.textMuted, fontSize: '0.875rem', maxWidth: '420px', margin: '0 auto' }}>
            {statusFilter === 'active'
              ? (cashbookOnly
                  ? 'No active deleted cashbook items. Any deleted books or entries will appear here safely.'
                  : 'No active deleted items in the Recycle Bin. Any records deleted across accounts will appear here safely.')
              : 'No items match your selected filters.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredItems.map(item => {
            const badgeMeta = TYPE_COLORS[item.entity_type] || TYPE_COLORS.other
            const isRestored = item.is_restored
            const fields = item.item_data?.fields || {}

            let displayName = item.item_name
            let displaySummary = item.item_summary

            if (item.entity_type === 'cashbook_entry' || item.model_name === 'CashBookEntry') {
              const remark = fields.remark || fields.description || ''
              const party = fields.party_name || fields.staff_name || ''
              const category = fields.category || ''
              const amount = fields.amount ? `${parseFloat(fields.amount).toLocaleString()} SAR` : ''
              const dateStr = fields.date || ''
              const entryTypeRaw = String(fields.entry_type || 'out').toLowerCase()
              const shortDir = entryTypeRaw === 'in' ? 'In' : 'Out'
              const dirName = entryTypeRaw === 'in' ? 'Credit (Inflow)' : 'Debit (Outflow)'
              const mainTitle = remark || party || category || 'Cashbook Transaction'
              const partySuffix = (party && remark && !remark.toLowerCase().includes(party.toLowerCase())) ? ` [${party}]` : ''
              
              displayName = `${shortDir}: ${mainTitle} (${amount})${partySuffix}`

              const summaryParts = []
              if (dateStr) summaryParts.push(`Date: ${dateStr}`)
              if (amount) summaryParts.push(`Amount: ${amount}`)
              if (dirName) summaryParts.push(`Type: ${dirName}`)
              if (category) summaryParts.push(`Category: ${category}`)
              if (party && party !== mainTitle) summaryParts.push(`Party: ${party}`)
              if (fields.payment_mode) summaryParts.push(`Mode: ${fields.payment_mode}`)
              if (fields.bank_account_name || fields.petty_cash_account_name) {
                summaryParts.push(`Account: ${fields.bank_account_name || fields.petty_cash_account_name}`)
              }
              if (fields.reference_number) summaryParts.push(`Ref #: ${fields.reference_number}`)
              if (remark && remark !== mainTitle) summaryParts.push(`Remark: ${remark}`)

              if (summaryParts.length > 0) {
                displaySummary = summaryParts.join(' | ')
              }
            }

            return (
              <div
                key={item.id}
                style={{
                  background: theme.itemCardBg,
                  borderRadius: '12px',
                  padding: '1.1rem 1.25rem',
                  boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
                  border: isRestored
                    ? (isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #d1fae5')
                    : `1px solid ${theme.itemCardBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Left info */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', flex: '1 1 350px' }}>
                  <div style={{
                    padding: '0.45rem',
                    borderRadius: '8px',
                    background: isDark ? 'rgba(16, 185, 129, 0.15)' : badgeMeta.bg,
                    color: isDark ? '#34d399' : badgeMeta.text,
                    border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : `1px solid ${badgeMeta.border}`,
                    marginTop: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FileText size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '0.15rem 0.55rem',
                        borderRadius: '6px',
                        background: isDark ? 'rgba(255, 255, 255, 0.06)' : badgeMeta.bg,
                        color: isDark ? '#cbd5e1' : badgeMeta.text,
                        border: isDark ? '1px solid #2d3139' : `1px solid ${badgeMeta.border}`
                      }}>
                        {item.entity_type_display || badgeMeta.label}
                      </span>
                      {isRestored && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.72rem',
                          fontWeight: '600',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                          color: isDark ? '#34d399' : '#059669',
                          border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0'
                        }}>
                          <CheckCircle2 size={11} /> Restored
                        </span>
                      )}
                    </div>

                    <h4 style={{
                      fontSize: '0.975rem',
                      fontWeight: '700',
                      margin: '0 0 0.25rem 0',
                      color: theme.textMain
                    }}>
                      {displayName}
                    </h4>

                    {displaySummary && (
                      <p style={{
                        margin: '0 0 0.35rem 0',
                        fontSize: '0.8125rem',
                        color: theme.textMuted,
                        lineHeight: '1.4'
                      }}>
                        {displaySummary}
                      </p>
                    )}

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      flexWrap: 'wrap',
                      fontSize: '0.75rem',
                      color: theme.subText
                    }}>
                      <span>
                        Deleted by: <strong style={{ color: theme.textMain }}>{item.deleted_by_name || 'System User'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Deleted on: {formatDate(item.deleted_at)}
                      </span>
                      {isRestored && item.restored_at && (
                        <>
                          <span>•</span>
                          <span style={{ color: isDark ? '#34d399' : '#059669' }}>
                            Restored by {item.restored_by_name || 'System'} on {formatDate(item.restored_at)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {!isRestored ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        onClick={() => handleRestore(item)}
                        disabled={restoringId === item.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.45rem 1rem',
                          borderRadius: '8px',
                          fontSize: '0.8125rem',
                          fontWeight: '600',
                          border: '1px solid #10b981',
                          background: '#10b981',
                          color: '#ffffff',
                          cursor: restoringId === item.id ? 'not-allowed' : 'pointer',
                          opacity: restoringId === item.id ? 0.7 : 1,
                          boxShadow: '0 1px 2px rgba(16, 185, 129, 0.2)'
                        }}
                      >
                        <RotateCcw size={14} className={restoringId === item.id ? 'animate-spin' : ''} />
                        {restoringId === item.id ? 'Restoring...' : 'Restore'}
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(item)}
                        disabled={restoringId === item.id}
                        title="Permanently Delete Item"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.45rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.8125rem',
                          fontWeight: '600',
                          border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.25)',
                          background: isDark ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                          color: '#ef4444',
                          cursor: restoringId === item.id ? 'not-allowed' : 'pointer',
                          opacity: restoringId === item.id ? 0.7 : 1
                        }}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        disabled
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.45rem 0.9rem',
                          borderRadius: '8px',
                          fontSize: '0.8125rem',
                          fontWeight: '500',
                          border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid #d1fae5',
                          background: isDark ? 'rgba(16, 185, 129, 0.12)' : '#f0fdf4',
                          color: isDark ? '#34d399' : '#059669',
                          cursor: 'default'
                        }}
                      >
                        <CheckCircle2 size={14} /> Restored
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )}

  {/* Item Detail Modal */}
  {detailItem && (
        <Modal
          isOpen={Boolean(detailItem)}
          onClose={() => setDetailItem(null)}
          title={`Snapshot: ${detailItem.item_name}`}
          size="lg"
        >
          <div style={{ padding: '0.5rem 0', color: theme.textMain }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
              background: theme.inputBg,
              padding: '1rem',
              borderRadius: '8px',
              border: `1px solid ${theme.cardBorder}`,
              marginBottom: '1rem'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>Entity Type:</span>
                <p style={{ margin: '0.2rem 0 0 0', fontWeight: '600', color: theme.textMain }}>
                  {detailItem.entity_type_display} ({detailItem.model_name})
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>Original Record ID:</span>
                <p style={{ margin: '0.2rem 0 0 0', fontWeight: '600', color: theme.textMain }}>
                  #{detailItem.original_id}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>Deleted By:</span>
                <p style={{ margin: '0.2rem 0 0 0', fontWeight: '600', color: theme.textMain }}>
                  {detailItem.deleted_by_name || 'System User'}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>Deleted Timestamp:</span>
                <p style={{ margin: '0.2rem 0 0 0', fontWeight: '600', color: theme.textMain }}>
                  {formatDate(detailItem.deleted_at)}
                </p>
              </div>
              {detailItem.is_restored && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>Restored:</span>
                  <p style={{ margin: '0.2rem 0 0 0', fontWeight: '600', color: '#10b981' }}>
                    Yes (by {detailItem.restored_by_name || 'System'} on {formatDate(detailItem.restored_at)})
                  </p>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <h5 style={{ fontSize: '0.875rem', fontWeight: '600', margin: '0 0 0.5rem 0', color: theme.textMain }}>
                Item Summary
              </h5>
              <p style={{
                background: theme.inputBg,
                padding: '0.75rem',
                borderRadius: '8px',
                border: `1px solid ${theme.cardBorder}`,
                margin: 0,
                fontSize: '0.85rem',
                color: theme.textMuted
              }}>
                {detailItem.item_summary || 'No summary available.'}
              </p>
            </div>

            <div>
              <h5 style={{ fontSize: '0.875rem', fontWeight: '600', margin: '0 0 0.5rem 0', color: theme.textMain }}>
                Complete Snapshot Payload
              </h5>
              <pre style={{
                background: isDark ? '#090a0b' : '#1e293b',
                color: '#f8fafc',
                padding: '1rem',
                borderRadius: '8px',
                border: isDark ? '1px solid #23262a' : 'none',
                fontSize: '0.75rem',
                maxHeight: '300px',
                overflow: 'auto',
                margin: 0
              }}>
                {JSON.stringify(detailItem.item_data, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: `1px solid ${theme.detailsBtnBorder}`,
                  background: theme.detailsBtnBg,
                  color: theme.detailsBtnColor,
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              {!detailItem.is_restored && (
                <button
                  type="button"
                  onClick={() => handlePermanentDelete(detailItem)}
                  disabled={restoringId === detailItem.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    background: isDark ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                    color: '#ef4444',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
              {!detailItem.is_restored && (
                <button
                  type="button"
                  onClick={() => handleRestore(detailItem)}
                  disabled={restoringId === detailItem.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#10b981',
                    color: '#ffffff',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCcw size={14} className={restoringId === detailItem.id ? 'animate-spin' : ''} />
                  Restore This Item
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

export default RecycleBin
