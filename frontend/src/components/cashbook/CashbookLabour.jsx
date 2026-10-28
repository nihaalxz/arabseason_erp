import React, { useState, useEffect, useMemo, useRef, useCallback, Children } from 'react'
import { 
  Plus, Search, X, RefreshCw, AlertCircle, Trash2, 
  Briefcase, User, Calendar, CreditCard, Receipt 
} from '../icons'
import { 
  Pencil, CheckCircle2, ArrowDownRight, Clock, HardHat, Phone, 
  ExternalLink, ChevronRight, FileText, Check, DollarSign,
  Filter, ChevronDown, RotateCcw, ArrowLeft
} from 'lucide-react'
import api from '../../api'
import Modal from '../common/Modal'
import CashbookSelect from '../common/CashbookSelect'
import CredAnimatedTabs from './cred/CredAnimatedTabs'
import GooeyMenu from './cred/GooeyMenu'
import CredStatus from './cred/CredStatus'
import CredRowIconButton from './cred/CredRowIconButton'
import CredPagination from './cred/CredPagination'
import { usePagination, PAGE_SIZE_DESKTOP, PAGE_SIZE_MOBILE, formatJobRef, formatCompactKpi, getAmountFontSize } from './cred/usePagination'
import { showConfirm, showError, showToast, showSuccess } from '../../utils/swal'

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

  const scrollToCard = (index) => {
    if (!scrollRef.current) return
    const container = scrollRef.current
    const items = container.children
    if (items[index]) {
      items[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
      setActiveIndex(index)
    }
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
          gap: '0.65rem',
          paddingBottom: '0.35rem',
          paddingLeft: '0.15rem',
          paddingRight: '0.15rem',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {validChildren.map((child, idx) => (
          <div
            key={idx}
            style={{
              flex: '0 0 78%',
              minWidth: '220px',
              maxWidth: '300px',
              scrollSnapAlign: 'start',
              boxSizing: 'border-box'
            }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CashbookLabour({ 
  isDarkMode = false, 
  isMobileScreen = false,
  onBack,
  onNavigate
}) {
  const [internalIsMobile, setInternalIsMobile] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth <= 768
    return isMobileScreen
  })

  useEffect(() => {
    const handleResize = () => setInternalIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const effectiveIsMobile = isMobileScreen || internalIsMobile

  // Data states
  const [labourEntries, setLabourEntries] = useState([])
  const [jobOrders, setJobOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const filterMenuRef = useRef(null)
  const [viewMode, setViewMode] = useState('ledger') // 'ledger' (customer-style by labourer) | 'entries' (all work orders)

  // Close filter menu when clicked outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setIsFilterMenuOpen(false)
      }
    }
    if (isFilterMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('touchstart', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [isFilterMenuOpen])

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [modalSubmitting, setModalSubmitting] = useState(false)
  const [modalError, setModalError] = useState('')

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    job_order: '',
    work_done: '',
    payment_amount: '',
    paid_amount: '0.00',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: ''
  })

  // Record Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [payingEntry, setPayingEntry] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)

  // Labourer Statement Modal State (Customer-style ledger)
  const [statementLabourer, setStatementLabourer] = useState(null)

  // Styling tokens matching Cashbook tab=vendors
  const cardBg = isDarkMode ? '#121417' : '#ffffff'
  const borderColor = isDarkMode ? '#232528' : '#e2e8f0'
  const textPrimary = isDarkMode ? '#ffffff' : '#0f172a'
  const textMuted = isDarkMode ? '#8b9096' : '#64748b'
  const inputBg = isDarkMode ? '#17191d' : '#f8fafc'
  const inputBorder = isDarkMode ? '#282b32' : '#cbd5e1'

  const safeFormatAmount = (val) => {
    const num = parseFloat(val)
    if (isNaN(num)) return '0.00'
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Fetch Labour Entries
  const fetchLabourEntries = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('labours/')
      const data = res.data?.results || res.data || []
      setLabourEntries(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load labour entries:', err)
      showError('Failed to load labour entries.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch Job Orders for dropdown
  const fetchJobOrders = useCallback(async () => {
    try {
      const res = await api.get('job-orders/?limit=500')
      const data = res.data?.results || res.data || []
      setJobOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load job orders for labour:', err)
    }
  }, [])

  useEffect(() => {
    fetchLabourEntries()
    fetchJobOrders()
  }, [fetchLabourEntries, fetchJobOrders])

  // Extract unique labourer names for suggestions
  const existingLabourerNames = useMemo(() => {
    const names = new Set()
    labourEntries.forEach(item => {
      if (item.name?.trim()) names.add(item.name.trim())
    })
    return Array.from(names)
  }, [labourEntries])

  // Aggregate by Labourer (Customer-style ledger data)
  const labourerLedgers = useMemo(() => {
    const map = new Map()

    labourEntries.forEach(entry => {
      const key = (entry.name || '').trim().toLowerCase()
      if (!key) return

      if (!map.has(key)) {
        map.set(key, {
          name: entry.name.trim(),
          phone: entry.phone || '',
          entries: [],
          totalAmount: 0,
          paidAmount: 0,
          dueAmount: 0,
          jobs: new Set(),
          lastDate: entry.date || ''
        })
      }

      const rec = map.get(key)
      rec.entries.push(entry)
      if (entry.phone && !rec.phone) rec.phone = entry.phone

      const total = parseFloat(entry.payment_amount) || 0
      const paid = parseFloat(entry.paid_amount) || 0
      rec.totalAmount += total
      rec.paidAmount += paid

      if (entry.job_order) {
        rec.jobs.add(entry.job_order_number || entry.job_order_title || `#${entry.job_order}`)
      }
      if (entry.date && entry.date > rec.lastDate) {
        rec.lastDate = entry.date
      }
    })

    const list = Array.from(map.values()).map(l => {
      const due = Math.max(0, l.totalAmount - l.paidAmount)
      let status = 'pending'
      if (due <= 0.01 && l.totalAmount > 0) status = 'paid'
      else if (l.paidAmount > 0.01) status = 'partially_paid'

      return {
        ...l,
        dueAmount: due,
        status,
        jobsList: Array.from(l.jobs)
      }
    })

    return list.sort((a, b) => b.dueAmount - a.dueAmount || a.name.localeCompare(b.name))
  }, [labourEntries])

  // KPI Calculations
  const metrics = useMemo(() => {
    const totalWork = labourEntries.reduce((acc, e) => acc + (parseFloat(e.payment_amount) || 0), 0)
    const totalPaid = labourEntries.reduce((acc, e) => acc + (parseFloat(e.paid_amount) || 0), 0)
    const totalDue = Math.max(0, totalWork - totalPaid)
    const pendingCount = labourEntries.filter(e => {
      const total = parseFloat(e.payment_amount) || 0
      const paid = parseFloat(e.paid_amount) || 0
      return (total - paid) > 0.01
    }).length

    return {
      totalLabourers: labourerLedgers.length,
      totalWork,
      totalPaid,
      totalDue,
      pendingCount
    }
  }, [labourEntries, labourerLedgers])

  // Filtered Ledgers
  const filteredLedgers = useMemo(() => {
    return labourerLedgers.filter(item => {
      if (statusFilter === 'Pending' && item.status !== 'pending' && item.status !== 'partially_paid') return false
      if (statusFilter === 'Partially Paid' && item.status !== 'partially_paid') return false
      if (statusFilter === 'Settled' && item.status !== 'paid') return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const nameMatch = item.name.toLowerCase().includes(q)
        const phoneMatch = item.phone.toLowerCase().includes(q)
        const jobMatch = item.jobsList.some(j => j.toLowerCase().includes(q))
        return nameMatch || phoneMatch || jobMatch
      }
      return true
    })
  }, [labourerLedgers, statusFilter, searchQuery])

  // Filtered Entries (Detailed view)
  const filteredEntries = useMemo(() => {
    return labourEntries.filter(item => {
      const total = parseFloat(item.payment_amount) || 0
      const paid = parseFloat(item.paid_amount) || 0
      const due = Math.max(0, total - paid)

      if (statusFilter === 'Pending' && due <= 0.01) return false
      if (statusFilter === 'Partially Paid' && (paid <= 0.01 || due <= 0.01)) return false
      if (statusFilter === 'Settled' && (due > 0.01 || total <= 0)) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const nameMatch = (item.name || '').toLowerCase().includes(q)
        const phoneMatch = (item.phone || '').toLowerCase().includes(q)
        const workMatch = (item.work_done || '').toLowerCase().includes(q)
        const jobMatch = (item.job_order_title || '').toLowerCase().includes(q) || (item.job_order_number || '').toLowerCase().includes(q)
        return nameMatch || phoneMatch || workMatch || jobMatch
      }
      return true
    })
  }, [labourEntries, statusFilter, searchQuery])

  // Pagination for labour entries and ledgers
  const labourResetKey = `${statusFilter}_${searchQuery}_${viewMode}`;
  const {
    pageItems: pagedEntries,
    page: entriesPage,
    setPage: setEntriesPage,
    totalPages: totalEntriesPages,
    rangeStart: entriesRangeStart,
    rangeEnd: entriesRangeEnd,
    total: totalEntriesCount
  } = usePagination(filteredEntries, effectiveIsMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP, labourResetKey);

  const {
    pageItems: pagedLedgers,
    page: ledgersPage,
    setPage: setLedgersPage,
    totalPages: totalLedgersPages,
    rangeStart: ledgersRangeStart,
    rangeEnd: ledgersRangeEnd,
    total: totalLedgersCount
  } = usePagination(filteredLedgers, effectiveIsMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP, labourResetKey);

  // Filter options with contextual counts for the Filter Menu
  const filterOptions = useMemo(() => {
    if (viewMode === 'ledger') {
      const totalCount = labourerLedgers.length
      const pendingCount = labourerLedgers.filter(l => l.status === 'pending' || l.status === 'partially_paid').length
      const partialCount = labourerLedgers.filter(l => l.status === 'partially_paid').length
      const settledCount = labourerLedgers.filter(l => l.status === 'paid').length
      return [
        { id: 'All', label: 'All Statuses', desc: 'All labourers in ledger', count: totalCount, color: '#64748b' },
        { id: 'Pending', label: 'Pending / Due', desc: 'Labourers with unpaid balance', count: pendingCount, color: '#f59e0b' },
        { id: 'Partially Paid', label: 'Partially Paid', desc: 'Labourers with partial payouts', count: partialCount, color: '#3b82f6' },
        { id: 'Settled', label: 'Settled (Paid)', desc: 'Zero balance remaining', count: settledCount, color: '#10b981' }
      ]
    } else {
      const totalCount = labourEntries.length
      const pendingCount = labourEntries.filter(e => {
        const tot = parseFloat(e.payment_amount) || 0
        const pd = parseFloat(e.paid_amount) || 0
        return (tot - pd) > 0.01
      }).length
      const partialCount = labourEntries.filter(e => {
        const tot = parseFloat(e.payment_amount) || 0
        const pd = parseFloat(e.paid_amount) || 0
        return (tot - pd) > 0.01 && pd > 0.01
      }).length
      const settledCount = labourEntries.filter(e => {
        const tot = parseFloat(e.payment_amount) || 0
        const pd = parseFloat(e.paid_amount) || 0
        return (tot - pd) <= 0.01 && tot > 0
      }).length
      return [
        { id: 'All', label: 'All Statuses', desc: 'All work order entries', count: totalCount, color: '#64748b' },
        { id: 'Pending', label: 'Pending / Due', desc: 'Entries with pending balance', count: pendingCount, color: '#f59e0b' },
        { id: 'Partially Paid', label: 'Partially Paid', desc: 'Entries with partial payments', count: partialCount, color: '#3b82f6' },
        { id: 'Settled', label: 'Settled (Paid)', desc: 'Fully paid work orders', count: settledCount, color: '#10b981' }
      ]
    }
  }, [viewMode, labourerLedgers, labourEntries])

  // Open Create / Edit Modal
  const handleOpenModal = (entry = null) => {
    setEditingEntry(entry)
    setModalError('')
    if (entry) {
      setFormData({
        name: entry.name || '',
        phone: entry.phone || '',
        job_order: entry.job_order ? String(entry.job_order) : '',
        work_done: entry.work_done || '',
        payment_amount: entry.payment_amount != null ? String(entry.payment_amount) : '',
        paid_amount: entry.paid_amount != null ? String(entry.paid_amount) : '0.00',
        date: entry.date || new Date().toISOString().split('T')[0],
        due_date: entry.due_date || '',
        notes: entry.notes || ''
      })
    } else {
      setFormData({
        name: '',
        phone: '',
        job_order: '',
        work_done: '',
        payment_amount: '',
        paid_amount: '0.00',
        date: new Date().toISOString().split('T')[0],
        due_date: '',
        notes: ''
      })
    }
    setIsModalOpen(true)
  }

  // Quick Assign Job to Existing Labourer
  const handleAssignJobToLabourer = (labourer) => {
    setEditingEntry(null)
    setModalError('')
    setFormData({
      name: labourer.name || '',
      phone: labourer.phone || '',
      job_order: '',
      work_done: '',
      payment_amount: '',
      paid_amount: '0.00',
      date: new Date().toISOString().split('T')[0],
      due_date: '',
      notes: ''
    })
    setIsModalOpen(true)
  }

  // Save Entry (Create / Edit)
  const handleSaveEntry = async (e) => {
    e.preventDefault()
    if (!formData.name?.trim()) {
      setModalError('Labourer name is required')
      return
    }
    const totalAmt = parseFloat(formData.payment_amount)
    if (isNaN(totalAmt) || totalAmt < 0) {
      setModalError('Please enter a valid total amount')
      return
    }
    const paidAmt = parseFloat(formData.paid_amount) || 0
    if (isNaN(paidAmt) || paidAmt < 0) {
      setModalError('Paid amount cannot be negative')
      return
    }

    try {
      setModalSubmitting(true)
      setModalError('')

      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        job_order: formData.job_order ? parseInt(formData.job_order) : null,
        work_done: formData.work_done.trim(),
        payment_amount: totalAmt,
        paid_amount: paidAmt,
        date: formData.date || new Date().toISOString().split('T')[0],
        due_date: formData.due_date || null,
        notes: formData.notes.trim()
      }

      if (editingEntry) {
        await api.put(`labours/${editingEntry.id}/`, payload)
        showToast('Labour entry updated', 'success')
      } else {
        await api.post('labours/', payload)
        showToast('Labour entry recorded', 'success')
      }

      setIsModalOpen(false)
      fetchLabourEntries()
    } catch (err) {
      console.error('Failed to save labour entry:', err)
      setModalError(err.response?.data?.message || err.response?.data?.error || 'Failed to save labour entry.')
    } finally {
      setModalSubmitting(false)
    }
  }

  // Delete Entry
  const handleDeleteEntry = async (id, labourName) => {
    const confirmed = await showConfirm(
      'Delete Labour Entry?',
      `Are you sure you want to delete the entry for ${labourName || 'this labourer'}?`
    )
    if (!confirmed) return

    try {
      await api.delete(`labours/${id}/`)
      showToast('Labour entry deleted', 'info')
      fetchLabourEntries()
      if (statementLabourer) {
        // Refresh statement modal data
        setLabourEntries(prev => prev.filter(e => e.id !== id))
      }
    } catch (err) {
      console.error('Failed to delete labour entry:', err)
      showError('Failed to delete entry.')
    }
  }

  // Open Quick Pay Modal
  const handleOpenPayModal = (entry) => {
    setPayingEntry(entry)
    const due = Math.max(0, (parseFloat(entry.payment_amount) || 0) - (parseFloat(entry.paid_amount) || 0))
    setPayAmount(due > 0 ? due.toFixed(2) : '')
    setIsPayModalOpen(true)
  }

  // Submit Quick Payment
  const handleSubmitPayment = async (e) => {
    e.preventDefault()
    if (!payingEntry) return

    const amt = parseFloat(payAmount)
    if (isNaN(amt) || amt <= 0) {
      showError('Please enter a valid payment amount')
      return
    }

    try {
      setPaySubmitting(true)
      await api.post(`labours/${payingEntry.id}/record-payment/`, { amount: amt })
      showToast(`Payment of SAR ${safeFormatAmount(amt)} recorded`, 'success')
      setIsPayModalOpen(false)
      fetchLabourEntries()
    } catch (err) {
      console.error('Failed to record payment:', err)
      showError(err.response?.data?.error || 'Failed to record payment.')
    } finally {
      setPaySubmitting(false)
    }
  }

  // Status Badge Helper
  const renderStatusBadge = (status, total, paid) => {
    const due = Math.max(0, (parseFloat(total) || 0) - (parseFloat(paid) || 0))
    if (due <= 0.01 && (parseFloat(total) || 0) > 0) {
      return <CredStatus tone="success" label="settled" />
    }
    if ((parseFloat(paid) || 0) > 0.01) {
      return <CredStatus tone="warning" label="partially paid" />
    }
    return <CredStatus tone="danger" label="pending payment" />
  }

  return (
    <div style={{
      padding: effectiveIsMobile ? '0.75rem 0.75rem 5rem' : '1.25rem 2rem 3rem',
      maxWidth: '1440px',
      width: '100%',
      margin: '0 auto',
      boxSizing: 'border-box',
      overflowY: 'auto'
    }}>

      {/* ── 1. COMMAND HEADER ── */}
      {effectiveIsMobile ? (
        <div style={{ marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => onBack ? onBack() : onNavigate && onNavigate('more')}
            aria-label="Back to More"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 0',
              marginBottom: '10px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text, #0A0A0A)',
              outline: 'none',
              width: 'fit-content'
            }}
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', textTransform: 'lowercase' }}>
              labour
            </h1>
            <button
              type="button"
              id="btn-add-labour-mobile"
              onClick={() => handleOpenModal()}
              style={{
                background: isDarkMode ? '#FFFFFF' : '#0A0A0A',
                color: isDarkMode ? '#0A0A0A' : '#FFFFFF',
                border: 'none',
                borderRadius: '999px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Add</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.25rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{
                fontSize: '1.55rem',
                fontWeight: '600',
                color: textPrimary,
                margin: 0,
                letterSpacing: '-0.02em'
              }}>
                Labour
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              type="button"
              id="btn-add-labour"
              onClick={() => handleOpenModal()}
              style={{
                background: isDarkMode ? '#ffffff' : '#0f172a',
                color: isDarkMode ? '#0f172a' : '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '0.65rem 1.25rem',
                fontWeight: '700',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                boxShadow: isDarkMode ? '0 2px 12px rgba(255,255,255,0.1)' : '0 2px 10px rgba(15,23,42,0.15)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Add Labour</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 2. KPI METRIC CARDS (Clickable filtering) ── */}
      <MobileCardCarousel isMobile={effectiveIsMobile} isDarkMode={isDarkMode} desktopColumns={4}>
        {/* Card 1: Total Labourers */}
        <div 
          onClick={() => setStatusFilter('All')}
          style={{
            background: cardBg,
            border: (statusFilter === 'All')
              ? (isDarkMode ? '2px solid #ffffff' : '2px solid #0A0A0A')
              : `1px solid ${borderColor}`,
            borderRadius: '16px',
            padding: effectiveIsMobile ? '0.75rem 0.95rem' : '1.15rem 1.25rem',
            minHeight: effectiveIsMobile ? '84px' : 'auto',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Labourers
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: isDarkMode ? '#1a1c20' : '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: textPrimary
            }}>
              <HardHat size={15} strokeWidth={2.2} />
            </div>
          </div>
          <div style={{ fontSize: effectiveIsMobile ? '1.25rem' : '1.45rem', fontWeight: '800', color: textPrimary, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {metrics.totalLabourers}
          </div>
          <div style={{ fontSize: '0.72rem', color: textMuted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {labourEntries.length} total work records
          </div>
        </div>

        {/* Card 2: Total Work Value */}
        <div 
          onClick={() => setStatusFilter('All')}
          style={{
            background: cardBg,
            border: `1px solid ${borderColor}`,
            borderRadius: '16px',
            padding: effectiveIsMobile ? '0.75rem 0.95rem' : '1.15rem 1.25rem',
            minHeight: effectiveIsMobile ? '84px' : 'auto',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Work Value
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: isDarkMode ? '#1a1c20' : '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: textPrimary
            }}>
              <Receipt size={15} strokeWidth={2.2} />
            </div>
          </div>
          <div style={{ fontSize: effectiveIsMobile ? '1.25rem' : '1.45rem', fontWeight: '800', color: textPrimary, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {effectiveIsMobile && formatCompactKpi(metrics.totalWork) ? (
              <span className="cred-tnum">{formatCompactKpi(metrics.totalWork)}</span>
            ) : (
              `SAR ${safeFormatAmount(metrics.totalWork)}`
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: textMuted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Agreed job wages
          </div>
        </div>

        {/* Card 3: Paid Amount */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'Settled' ? 'All' : 'Settled')}
          style={{
            background: cardBg,
            border: (statusFilter === 'Settled')
              ? (isDarkMode ? '2px solid #ffffff' : '2px solid #0A0A0A')
              : `1px solid ${borderColor}`,
            borderRadius: '16px',
            padding: effectiveIsMobile ? '0.75rem 0.95rem' : '1.15rem 1.25rem',
            minHeight: effectiveIsMobile ? '84px' : 'auto',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Paid Amount
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: isDarkMode ? 'rgba(22, 163, 74, 0.15)' : '#dcfce7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDarkMode ? '#4ade80' : '#16a34a'
            }}>
              <CheckCircle2 size={15} strokeWidth={2.2} />
            </div>
          </div>
          <div style={{ fontSize: effectiveIsMobile ? '1.25rem' : '1.45rem', fontWeight: '800', color: isDarkMode ? '#4ade80' : '#16a34a', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {effectiveIsMobile && formatCompactKpi(metrics.totalPaid) ? (
              <span className="cred-tnum">{formatCompactKpi(metrics.totalPaid)}</span>
            ) : (
              `SAR ${safeFormatAmount(metrics.totalPaid)}`
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: textMuted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Disbursed wages
          </div>
        </div>

        {/* Card 4: Total Due (Pending) */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'Pending' ? 'All' : 'Pending')}
          style={{
            background: cardBg,
            border: (statusFilter === 'Pending')
              ? (isDarkMode ? '2px solid #ffffff' : '2px solid #0A0A0A')
              : `1px solid ${borderColor}`,
            borderRadius: '16px',
            padding: effectiveIsMobile ? '0.75rem 0.95rem' : '1.15rem 1.25rem',
            minHeight: effectiveIsMobile ? '84px' : 'auto',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pending Wages Due
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDarkMode ? '#f87171' : '#dc2626'
            }}>
              <Clock size={15} strokeWidth={2.2} />
            </div>
          </div>
          <div style={{ fontSize: effectiveIsMobile ? '1.25rem' : '1.45rem', fontWeight: '800', color: metrics.totalDue > 0 ? (isDarkMode ? '#f87171' : '#dc2626') : textPrimary, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {effectiveIsMobile && formatCompactKpi(metrics.totalDue) ? (
              <span className="cred-tnum">{formatCompactKpi(metrics.totalDue)}</span>
            ) : (
              `SAR ${safeFormatAmount(metrics.totalDue)}`
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: textMuted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {metrics.pendingCount} unpaid entries
          </div>
        </div>
      </MobileCardCarousel>

      {/* ── 3. CONTROLS BAR: VIEW TOGGLE, FILTER PILLS & SEARCH (UNIFIED SYSTEM) ── */}
      <div style={{
        display: 'flex',
        flexDirection: effectiveIsMobile ? 'column' : 'row',
        alignItems: effectiveIsMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        marginBottom: '1rem',
        position: 'relative',
        zIndex: 40,
        overflow: 'visible'
      }}>
        {/* Left Side: Filter Pills / Mobile GooeyMenu */}
        {effectiveIsMobile ? (
          <div style={{ position: 'relative', zIndex: 40, overflow: 'visible', width: '100%' }}>
            <GooeyMenu
              id="cred-labour-filter-dropdown"
              value={statusFilter}
              onSelect={(opt) => setStatusFilter(opt.value || opt.id || opt)}
              options={filterOptions.map(opt => ({
                value: opt.id,
                label: `${opt.label === 'All Statuses' ? 'All' : opt.label.replace(' / Due', '').replace(' (Paid)', '')} (${opt.count})`
              }))}
              width="100%"
              pillHeight={40}
              ariaLabel="Filter labour"
            />
          </div>
        ) : (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            overflow: 'visible',
            flexShrink: 0
          }}>
            <CredAnimatedTabs
              tabs={filterOptions.map(opt => ({
                id: opt.id,
                label: opt.label === 'All Statuses' ? 'All' : opt.label.replace(' / Due', '').replace(' (Paid)', ''),
                count: opt.count
              }))}
              value={statusFilter}
              onChange={(newVal) => setStatusFilter(newVal)}
              className="case-preserve"
              layoutId="cred-labour-tabs-pill"
            />
          </div>
        )}

        {/* Right Side: Search Bar */}
        <div style={{
          position: 'relative',
          width: effectiveIsMobile ? '100%' : '320px'
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
            placeholder="Search labourer name, phone, job order..."
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

      {/* ── 4. MAIN CONTENT ── */}
      {loading ? (
        <div style={{
          background: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: '16px',
          padding: '3rem 1rem',
          textAlign: 'center',
          color: textMuted
        }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem' }} />
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Loading labour records...</p>
        </div>
      ) : viewMode === 'ledger' ? (
        filteredLedgers.length === 0 ? (
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
              <HardHat size={22} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: textPrimary, margin: '0 0 0.35rem' }}>
              No Labourers Found
            </h3>
            <p style={{ fontSize: '0.825rem', color: textMuted, margin: '0 0 1.25rem' }}>
              {searchQuery || statusFilter !== 'All' ? 'Try adjusting your search query or filters.' : 'Add your first labour entry to track wages and job order costs.'}
            </p>
            <button
              type="button"
              onClick={() => handleOpenModal()}
              style={{
                background: isDarkMode ? '#ffffff' : '#0f172a',
                color: isDarkMode ? '#0f172a' : '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.6rem 1.25rem',
                fontWeight: '700',
                fontSize: '0.825rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Add Labour Entry</span>
            </button>
          </div>
        ) : (
          <>
            {effectiveIsMobile ? (
              /* MOBILE VIEW: CRED two-tier row layout with inset dashed separator and zero card borders */
              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
                {pagedLedgers.map(l => {
                  const initialLetter = (l.name || 'L').charAt(0).toUpperCase();
                  const hasDue = l.dueAmount > 0.01;
                  const jobsText = l.jobsList && l.jobsList.length > 0 ? l.jobsList.join(', ') : '';
                  const sublineText = l.phone ? (jobsText ? `${l.phone} · ${jobsText}` : l.phone) : (jobsText || 'Labourer');

                  return (
                    <div key={l.name} style={{ display: 'flex', flexDirection: 'column' }}>
                      {/* Tier 1: Avatar | Name + Subline | Status dot + plain text */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '12px 0 4px',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                          <div 
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              border: isDarkMode ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--border, #E4E4E4)',
                              background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#fafafa',
                              color: isDarkMode ? '#FFFFFF' : '#0A0A0A',
                              fontWeight: 500,
                              fontSize: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {initialLetter}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{
                              fontWeight: 500,
                              fontSize: '14px',
                              color: 'var(--text, #0A0A0A)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: 1.3
                            }}>
                              {l.name}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: 'var(--text-muted, #8C8C8C)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginTop: '2px',
                              lineHeight: 1.3
                            }}>
                              {sublineText}
                            </div>
                          </div>
                        </div>

                        {/* Status: small dot + plain text (no chip) */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: hasDue ? 'var(--danger, #dc2626)' : 'var(--positive, #16a34a)'
                          }} />
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: hasDue ? 'var(--danger, #dc2626)' : 'var(--text-muted, #8C8C8C)',
                            textTransform: 'lowercase'
                          }}>
                            {hasDue ? 'due' : 'settled'}
                          </span>
                        </div>
                      </div>

                      {/* Tier 2: 3 figures as quiet inline trio (inset 56px to align with text) */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: '8px',
                        padding: '6px 0 4px 56px',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: '9px',
                            fontWeight: 500,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: 'var(--text-muted, #8C8C8C)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginBottom: '2px'
                          }}>
                            Total Work
                          </div>
                          <div style={{ 
                            fontSize: getAmountFontSize(l.totalAmount), 
                            fontWeight: 500, 
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--text, #0A0A0A)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            SAR {safeFormatAmount(l.totalAmount)}
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: '9px',
                            fontWeight: 500,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: 'var(--text-muted, #8C8C8C)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginBottom: '2px'
                          }}>
                            Paid
                          </div>
                          <div style={{ 
                            fontSize: getAmountFontSize(l.paidAmount), 
                            fontWeight: 500, 
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--text, #0A0A0A)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            SAR {safeFormatAmount(l.paidAmount)}
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: '9px',
                            fontWeight: 500,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: 'var(--text-muted, #8C8C8C)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginBottom: '2px'
                          }}>
                            Due
                          </div>
                          <div style={{ 
                            fontSize: getAmountFontSize(l.dueAmount), 
                            fontWeight: 500, 
                            fontVariantNumeric: 'tabular-nums',
                            color: hasDue ? 'var(--danger, #dc2626)' : 'var(--text-muted, #8C8C8C)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            SAR {safeFormatAmount(l.dueAmount)}
                          </div>
                        </div>
                      </div>

                      {/* Row actions: one small right-aligned line of minimal text-or-icon buttons */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        padding: '4px 0 10px 56px'
                      }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAssignJobToLabourer(l);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            fontSize: '12px',
                            fontWeight: 500,
                            color: 'var(--text, #0A0A0A)',
                            cursor: 'pointer'
                          }}
                        >
                          Assign job
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatementLabourer(l);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            fontSize: '12px',
                            fontWeight: 400,
                            color: 'var(--text-muted, #8C8C8C)',
                            cursor: 'pointer'
                          }}
                        >
                          Statement
                        </button>
                      </div>

                      {/* Inset dashed separator */}
                      <div style={{
                        marginLeft: '56px',
                        borderBottom: isDarkMode ? '1px dashed rgba(255,255,255,0.08)' : '1px dashed rgba(0,0,0,0.08)'
                      }} />
                    </div>
                  );
                })}
              </div>
            ) : (
          <div style={{
            background: cardBg,
            border: `1px solid ${borderColor}`,
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.02)',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ width: '100%', overflowX: effectiveIsMobile ? 'auto' : 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
                <thead>
                  <tr style={{
                    borderBottom: `1px solid ${borderColor}`,
                    background: isDarkMode ? '#141517' : '#f8fafc'
                  }}>
                    <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '22%' }}>LABOURER NAME</th>
                    <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '13%' }}>CONTACT</th>
                    <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '16%' }}>LINKED JOB ORDERS</th>
                    <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '12%' }}>TOTAL WORK (SAR)</th>
                    <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '11%' }}>PAID (SAR)</th>
                    <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '11%' }}>DUE AMOUNT (SAR)</th>
                    <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '9%' }}>STATUS</th>
                    <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap', width: '6%' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLedgers.map(l => (
                    <tr
                      key={l.name}
                      className="cred-table-row"
                      style={{
                        borderBottom: `1px solid ${borderColor}`
                      }}
                    >
                      <td style={{ padding: '8px 8px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: isDarkMode ? '#1e2024' : '#e2e8f0',
                            color: textPrimary,
                            fontWeight: '700',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {l.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontWeight: '500', fontSize: '0.85rem', color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }} title={l.name}>
                              {l.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {l.entries.length} {l.entries.length === 1 ? 'work entry' : 'work entries'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '8px 8px', fontSize: '0.8rem', color: textMuted, verticalAlign: 'middle' }}>
                        {l.phone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: textPrimary, fontWeight: '600' }}>
                            <Phone size={11} style={{ color: textMuted, flexShrink: 0 }} />
                            <span>{l.phone}</span>
                          </div>
                        ) : (
                          <span>—</span>
                        )}
                      </td>

                      {/* Linked Job Orders: plain muted text, no box */}
                      <td style={{ padding: '8px 8px', maxWidth: '200px', verticalAlign: 'middle' }}>
                        {l.jobsList.length > 0 ? (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {l.jobsList.slice(0, 2).map((jb, i) => (
                              <span key={i} style={{
                                fontSize: '12px',
                                fontWeight: 500,
                                color: 'var(--text-muted, #8C8C8C)',
                                whiteSpace: 'nowrap'
                              }}>
                                {jb}
                              </span>
                            ))}
                            {l.jobsList.length > 2 && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>
                                +{l.jobsList.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '12px' }}>Direct / General</span>
                        )}
                      </td>

                      {/* Total Amount (Ink) */}
                      <td style={{ padding: '8px 8px', fontSize: '0.84rem', fontWeight: '500', color: textPrimary, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {safeFormatAmount(l.totalAmount)}
                      </td>

                      {/* Paid Amount (Ink, remove green) */}
                      <td style={{ padding: '8px 8px', fontSize: '0.84rem', fontWeight: '500', color: textPrimary, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {safeFormatAmount(l.paidAmount)}
                      </td>

                      {/* Due Amount (Only red allowed is outstanding amount > 0) */}
                      <td style={{ padding: '8px 8px', fontSize: '0.84rem', fontWeight: '500', color: l.dueAmount > 0 ? 'var(--dot-danger, #E5482E)' : textPrimary, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {safeFormatAmount(l.dueAmount)}
                      </td>

                      {/* Status (CredStatus) */}
                      <td style={{ padding: '8px 8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {renderStatusBadge(l.status, l.totalAmount, l.paidAmount)}
                      </td>

                      {/* Actions ("assign job" row text action, "statement" muted row text action) */}
                      <td style={{ padding: '8px 8px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px' }}>
                          <button
                            type="button"
                            className="cred-row-link"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAssignJobToLabourer(l)
                            }}
                            title={`Assign a job order to ${l.name}`}
                          >
                            assign job
                          </button>
                          <button
                            type="button"
                            className="cred-row-link cred-row-link--muted"
                            onClick={(e) => {
                              e.stopPropagation()
                              setStatementLabourer(l)
                            }}
                            title={`View ledger statement for ${l.name}`}
                          >
                            statement
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAGINATION FOR LEDGER VIEW */}
        <CredPagination
          page={ledgersPage}
          totalPages={totalLedgersPages}
          rangeStart={ledgersRangeStart}
          rangeEnd={ledgersRangeEnd}
          total={totalLedgersCount}
          onPageChange={setLedgersPage}
          isMobile={effectiveIsMobile}
        />
      </>
        )
      ) : (
        filteredEntries.length === 0 ? (
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
              <FileText size={22} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: textPrimary, margin: '0 0 0.35rem' }}>
              No Work Entries Found
            </h3>
            <p style={{ fontSize: '0.825rem', color: textMuted, margin: '0 0 1.25rem' }}>
              {searchQuery || statusFilter !== 'All' ? 'Try adjusting your search query or filters.' : 'Record labour work orders against job orders.'}
            </p>
            <button
              type="button"
              onClick={() => handleOpenModal()}
              style={{
                background: isDarkMode ? '#ffffff' : '#0f172a',
                color: isDarkMode ? '#0f172a' : '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.6rem 1.25rem',
                fontWeight: '700',
                fontSize: '0.825rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Add Labour Entry</span>
            </button>
          </div>
        ) : (
          <>
            {effectiveIsMobile ? (
              /* MOBILE VIEW: CRED two-tier row layout with inset dashed separator and zero card borders */
              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
                {pagedEntries.map(e => {
                  const total = parseFloat(e.payment_amount) || 0;
                  const paid = parseFloat(e.paid_amount) || 0;
                  const due = Math.max(0, total - paid);
                  const hasDue = due > 0.01;
                  const initialLetter = (e.name || 'L').charAt(0).toUpperCase();
                  const jobSubline = e.job_order_title 
                    ? `${e.job_order_number ? formatJobRef(e.job_order_number) + ' · ' : ''}${e.job_order_title}`
                    : (e.phone ? `${e.date || ''} · ${e.phone}` : (e.date || 'Work Entry'));

                  return (
                    <div key={e.id} style={{ display: 'flex', flexDirection: 'column' }}>
                      {/* Tier 1: Avatar | Name + Subline | Status dot + plain text */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '12px 0 4px',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                          <div 
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              border: isDarkMode ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--border, #E4E4E4)',
                              background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#fafafa',
                              color: isDarkMode ? '#FFFFFF' : '#0A0A0A',
                              fontWeight: 500,
                              fontSize: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {initialLetter}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{
                              fontWeight: 500,
                              fontSize: '14px',
                              color: 'var(--text, #0A0A0A)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: 1.3
                            }}>
                              {e.name}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: 'var(--text-muted, #8C8C8C)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginTop: '2px',
                              lineHeight: 1.3
                            }}>
                              {jobSubline}
                            </div>
                          </div>
                        </div>

                        {/* Status: small dot + plain text (no chip) */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: hasDue ? 'var(--danger, #dc2626)' : 'var(--positive, #16a34a)'
                          }} />
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: hasDue ? 'var(--danger, #dc2626)' : 'var(--text-muted, #8C8C8C)',
                            textTransform: 'lowercase'
                          }}>
                            {hasDue ? 'due' : 'settled'}
                          </span>
                        </div>
                      </div>

                      {/* Tier 2: 3 figures as quiet inline trio (inset 56px to align with text) */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: '8px',
                        padding: '6px 0 4px 56px',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: '9px',
                            fontWeight: 500,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: 'var(--text-muted, #8C8C8C)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginBottom: '2px'
                          }}>
                            Agreed
                          </div>
                          <div style={{ 
                            fontSize: getAmountFontSize(total), 
                            fontWeight: 500, 
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--text, #0A0A0A)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            SAR {safeFormatAmount(total)}
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: '9px',
                            fontWeight: 500,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: 'var(--text-muted, #8C8C8C)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginBottom: '2px'
                          }}>
                            Paid
                          </div>
                          <div style={{ 
                            fontSize: getAmountFontSize(paid), 
                            fontWeight: 500, 
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--text, #0A0A0A)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            SAR {safeFormatAmount(paid)}
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: '9px',
                            fontWeight: 500,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: 'var(--text-muted, #8C8C8C)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginBottom: '2px'
                          }}>
                            Due
                          </div>
                          <div style={{ 
                            fontSize: getAmountFontSize(due), 
                            fontWeight: 500, 
                            fontVariantNumeric: 'tabular-nums',
                            color: hasDue ? 'var(--danger, #dc2626)' : 'var(--text-muted, #8C8C8C)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            SAR {safeFormatAmount(due)}
                          </div>
                        </div>
                      </div>

                      {/* Row actions: one small right-aligned line of minimal text-or-icon buttons */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        padding: '4px 0 10px 56px'
                      }}>
                        {hasDue && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPayModal(e);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              fontSize: '12px',
                              fontWeight: 500,
                              color: 'var(--text, #0A0A0A)',
                              cursor: 'pointer'
                            }}
                          >
                            Pay
                          </button>
                        )}
                        <button
                          type="button"
                          title="Edit Entry"
                          aria-label="Edit Entry"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(e);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: 'var(--text-muted, #8C8C8C)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          title="Delete Entry"
                          aria-label="Delete Entry"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEntry(e.id, e.name);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: 'var(--text-muted, #8C8C8C)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Inset dashed separator */}
                      <div style={{
                        marginLeft: '56px',
                        borderBottom: isDarkMode ? '1px dashed rgba(255,255,255,0.08)' : '1px dashed rgba(0,0,0,0.08)'
                      }} />
                    </div>
                  );
                })}
              </div>
            ) : (
                    <div style={{
            background: cardBg,
            border: `1px solid ${borderColor}`,
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.02)',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ width: '100%', overflowX: effectiveIsMobile ? 'auto' : 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
              <thead>
                <tr style={{
                  borderBottom: `1px solid ${borderColor}`,
                  background: isDarkMode ? '#141517' : '#f8fafc'
                }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>DATE</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>LABOURER</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>LINKED JOB ORDER</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>WORK SCOPE</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AGREED (SAR)</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAID (SAR)</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>DUE (SAR)</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>STATUS</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {pagedEntries.map(e => {
                  const total = parseFloat(e.payment_amount) || 0
                  const paid = parseFloat(e.paid_amount) || 0
                  const due = Math.max(0, total - paid)

                  return (
                    <tr
                      key={e.id}
                      className="cred-table-row"
                      style={{
                        borderBottom: `1px solid ${borderColor}`
                      }}
                    >
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: textMuted, whiteSpace: 'nowrap' }}>
                        {e.date || '—'}
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: '500', fontSize: '0.88rem', color: textPrimary }}>
                          {e.name}
                        </div>
                        {e.phone && (
                          <div style={{ fontSize: '0.72rem', color: textMuted }}>
                            {e.phone}
                          </div>
                        )}
                      </td>

                      {/* Linked Job Order: plain muted text, no box */}
                      <td style={{ padding: '0.85rem 1rem', maxWidth: '220px' }}>
                        {e.job_order_title ? (
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            color: 'var(--text-muted, #8C8C8C)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }} title={`${e.job_order_number ? `${formatJobRef(e.job_order_number)} ` : ''}${e.job_order_title}`}>
                            {e.job_order_number ? <span className="cred-ref-code">{formatJobRef(e.job_order_number)} </span> : null}{e.job_order_title}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '12px' }}>Direct / None</span>
                        )}
                      </td>

                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: textMuted, maxWidth: '260px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.work_done || '—'}
                        </div>
                      </td>

                      {/* Agreed (Ink) */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '500', color: textPrimary }}>
                        {safeFormatAmount(total)}
                      </td>

                      {/* Paid (Ink, remove green) */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '500', color: textPrimary }}>
                        {safeFormatAmount(paid)}
                      </td>

                      {/* Due (Only red allowed is outstanding amount > 0) */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '500', color: due > 0 ? 'var(--dot-danger, #E5482E)' : textPrimary }}>
                        {safeFormatAmount(due)}
                      </td>

                      {/* Status (CredStatus) */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {renderStatusBadge(e.status, total, paid)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          {due > 0.01 && (
                            <button
                              type="button"
                              className="cred-row-link"
                              onClick={() => handleOpenPayModal(e)}
                              title="Record payment"
                            >
                              pay
                            </button>
                          )}
                          <CredRowIconButton
                            title="Edit entry"
                            ariaLabel="Edit entry"
                            onClick={() => handleOpenModal(e)}
                          >
                            <Pencil size={13} />
                          </CredRowIconButton>
                          <CredRowIconButton
                            tone="danger"
                            title="Delete entry"
                            ariaLabel="Delete entry"
                            onClick={() => handleDeleteEntry(e.id, e.name)}
                          >
                            <Trash2 size={13} />
                          </CredRowIconButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* PAGINATION FOR LABOUR ENTRIES */}
        <CredPagination
          page={entriesPage}
          totalPages={totalEntriesPages}
          rangeStart={entriesRangeStart}
          rangeEnd={entriesRangeEnd}
          total={totalEntriesCount}
          onPageChange={setEntriesPage}
          isMobile={effectiveIsMobile}
        />
      </>
        )
      )}

      {/* MODAL: CREATE / EDIT LABOUR ENTRY */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEntry ? 'Edit Labour Entry' : (formData.name ? `Assign Job to ${formData.name}` : 'Create Labour Entry')}
        maxWidth="620px"
      >
        <form onSubmit={handleSaveEntry} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {modalError && (
            <div style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertCircle size={15} />
              <span>{modalError}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: effectiveIsMobile ? '1fr' : 'repeat(2, 1fr)', gap: '0.75rem' }}>
            {/* Labourer Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: textPrimary, marginBottom: '0.25rem' }}>
                Labourer Name *
              </label>
              <input
                type="text"
                list="labourer-suggestions"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '8px',
                  border: `1px solid ${inputBorder}`,
                  background: inputBg,
                  color: textPrimary,
                  padding: '0 0.75rem',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
              <datalist id="labourer-suggestions">
                {existingLabourerNames.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>

            {/* Phone */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: textPrimary, marginBottom: '0.25rem' }}>
                Contact Phone
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '8px',
                  border: `1px solid ${inputBorder}`,
                  background: inputBg,
                  color: textPrimary,
                  padding: '0 0.75rem',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Linked Job Order */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: textPrimary, marginBottom: '0.25rem' }}>
              Link to Job Order <span style={{ color: textMuted, fontWeight: 'normal' }}>(Optional)</span>
            </label>
            <CashbookSelect
              value={formData.job_order}
              onChange={val => setFormData({ ...formData, job_order: val })}
              options={[
                { id: '', label: '-- General / No Specific Job Order --' },
                ...jobOrders.map(j => ({
                  id: String(j.id),
                  label: `#${String(j.order_id || j.id).replace(/^#+/, '')} — ${j.title} (${j.customer_name || 'Customer'})`
                }))
              ]}
              variant="modal-field"
              isDark={isDarkMode}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: effectiveIsMobile ? '1fr' : 'repeat(2, 1fr)', gap: '0.75rem' }}>
            {/* Date of Work */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: textPrimary, marginBottom: '0.25rem' }}>
                Date of Work *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '8px',
                  border: `1px solid ${inputBorder}`,
                  background: inputBg,
                  color: textPrimary,
                  padding: '0 0.75rem',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            {/* Expected Due Date */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: textPrimary, marginBottom: '0.25rem' }}>
                Expected Payment Date <span style={{ color: textMuted, fontWeight: 'normal' }}>(Optional)</span>
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '8px',
                  border: `1px solid ${inputBorder}`,
                  background: inputBg,
                  color: textPrimary,
                  padding: '0 0.75rem',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Work Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: textPrimary, marginBottom: '0.25rem' }}>
              Work Done / Scope Description *
            </label>
            <textarea
              required
              rows={2}
              value={formData.work_done}
              onChange={e => setFormData({ ...formData, work_done: e.target.value })}
              style={{
                width: '100%',
                borderRadius: '8px',
                border: `1px solid ${inputBorder}`,
                background: inputBg,
                color: textPrimary,
                padding: '0.5rem 0.75rem',
                fontSize: '0.85rem',
                boxSizing: 'border-box',
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: effectiveIsMobile ? '1fr' : 'repeat(2, 1fr)', gap: '0.75rem' }}>
            {/* Agreed Total Amount */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: textPrimary, marginBottom: '0.25rem' }}>
                Total Agreed Amount (SAR) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.payment_amount}
                onChange={e => setFormData({ ...formData, payment_amount: e.target.value })}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '8px',
                  border: `1px solid ${inputBorder}`,
                  background: inputBg,
                  color: textPrimary,
                  padding: '0 0.75rem',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            {/* Paid Amount */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: textPrimary, marginBottom: '0.25rem' }}>
                Paid Amount (SAR) <span style={{ color: textMuted, fontWeight: 'normal' }}>(Default: 0)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.paid_amount}
                onChange={e => setFormData({ ...formData, paid_amount: e.target.value })}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '8px',
                  border: `1px solid ${inputBorder}`,
                  background: inputBg,
                  color: isDarkMode ? '#4ade80' : '#16a34a',
                  padding: '0 0.75rem',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: textPrimary, marginBottom: '0.25rem' }}>
              Notes <span style={{ color: textMuted, fontWeight: 'normal' }}>(Optional)</span>
            </label>
            <input
              type="text"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              style={{
                width: '100%',
                height: '36px',
                borderRadius: '8px',
                border: `1px solid ${inputBorder}`,
                background: inputBg,
                color: textPrimary,
                padding: '0 0.75rem',
                fontSize: '0.82rem',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={modalSubmitting}
            >
              {modalSubmitting ? 'Saving...' : (editingEntry ? 'Update Entry' : 'Save Labour Entry')}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: RECORD PAYMENT */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Record Labour Payment"
        maxWidth="460px"
      >
        {payingEntry && (
          <form onSubmit={handleSubmitPayment} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{
              background: isDarkMode ? '#17191d' : '#f8fafc',
              border: `1px solid ${inputBorder}`,
              borderRadius: '10px',
              padding: '0.75rem 0.85rem'
            }}>
              <div style={{ fontWeight: '700', fontSize: '0.95rem', color: textPrimary, marginBottom: '2px' }}>
                {payingEntry.name}
              </div>
              {payingEntry.job_order_title && (
                <div style={{ fontSize: '0.75rem', color: 'var(--primary, #5B4BDB)', fontWeight: '600', marginBottom: '4px' }}>
                  Job: {payingEntry.job_order_title}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '6px' }}>
                <span style={{ color: textMuted }}>Agreed Amount:</span>
                <span style={{ fontWeight: '700', color: textPrimary }}>SAR {safeFormatAmount(payingEntry.payment_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '2px' }}>
                <span style={{ color: textMuted }}>Already Paid:</span>
                <span style={{ fontWeight: '700', color: '#16a34a' }}>SAR {safeFormatAmount(payingEntry.paid_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '4px', borderTop: `1px solid ${borderColor}`, paddingTop: '4px' }}>
                <span style={{ fontWeight: '700', color: textPrimary }}>Remaining Due:</span>
                <span style={{ fontWeight: '800', color: '#dc2626' }}>
                  SAR {safeFormatAmount(Math.max(0, (parseFloat(payingEntry.payment_amount) || 0) - (parseFloat(payingEntry.paid_amount) || 0)))}
                </span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: textPrimary, marginBottom: '0.25rem' }}>
                Payment Amount (SAR) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '8px',
                  border: `1px solid ${inputBorder}`,
                  background: inputBg,
                  color: isDarkMode ? '#4ade80' : '#16a34a',
                  padding: '0 0.85rem',
                  fontSize: '1rem',
                  fontWeight: '800',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsPayModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={paySubmitting}
                style={{ background: '#16a34a', borderColor: '#15803d' }}
              >
                {paySubmitting ? 'Recording...' : 'Confirm Payment'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: LABOURER STATEMENT / LEDGER */}
      {statementLabourer && (
        <Modal
          isOpen={!!statementLabourer}
          onClose={() => setStatementLabourer(null)}
          title={`Labour Ledger: ${statementLabourer.name}`}
          maxWidth="780px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Header info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
              padding: '0.85rem',
              background: isDarkMode ? '#17191d' : '#f8fafc',
              borderRadius: '12px',
              border: `1px solid ${inputBorder}`
            }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: '800', color: textPrimary }}>
                  {statementLabourer.name}
                </div>
                {statementLabourer.phone && (
                  <div style={{ fontSize: '0.78rem', color: textMuted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={11} /> {statementLabourer.phone}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', textAlign: 'right' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: textMuted, textTransform: 'uppercase', fontWeight: '600' }}>Total Value</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: textPrimary }}>SAR {safeFormatAmount(statementLabourer.totalAmount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: textMuted, textTransform: 'uppercase', fontWeight: '600' }}>Total Paid</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: isDarkMode ? '#4ade80' : '#16a34a' }}>SAR {safeFormatAmount(statementLabourer.paidAmount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: textMuted, textTransform: 'uppercase', fontWeight: '600' }}>Balance Due</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '800', color: statementLabourer.dueAmount > 0 ? (isDarkMode ? '#f87171' : '#dc2626') : textMuted }}>
                    SAR {safeFormatAmount(statementLabourer.dueAmount)}
                  </div>
                </div>
              </div>
            </div>

            {/* Entries list for this labourer */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: textPrimary }}>
                  Work Orders & Disbursements ({statementLabourer.entries.length})
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const l = statementLabourer
                    setStatementLabourer(null)
                    handleAssignJobToLabourer(l)
                  }}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    borderRadius: '8px',
                    background: isDarkMode ? '#ffffff' : '#0f172a',
                    color: isDarkMode ? '#0f172a' : '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Briefcase size={12} strokeWidth={2.5} />
                  <span>+ Assign Job Order</span>
                </button>
              </div>

              <div style={{
                maxHeight: '42vh',
                overflowY: 'auto',
                border: `1px solid ${borderColor}`,
                borderRadius: '10px'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: isDarkMode ? '#1a1c20' : '#f1f5f9', borderBottom: `1px solid ${borderColor}` }}>
                      <th style={{ padding: '0.6rem 0.75rem', color: textMuted, fontSize: '0.7rem', fontWeight: '500' }}>DATE</th>
                      <th style={{ padding: '0.6rem 0.75rem', color: textMuted, fontSize: '0.7rem', fontWeight: '500' }}>JOB ORDER</th>
                      <th style={{ padding: '0.6rem 0.75rem', color: textMuted, fontSize: '0.7rem', fontWeight: '500' }}>WORK DONE</th>
                      <th style={{ padding: '0.6rem 0.75rem', color: textMuted, fontSize: '0.7rem', fontWeight: '500' }}>AGREED</th>
                      <th style={{ padding: '0.6rem 0.75rem', color: textMuted, fontSize: '0.7rem', fontWeight: '500' }}>PAID</th>
                      <th style={{ padding: '0.6rem 0.75rem', color: textMuted, fontSize: '0.7rem', fontWeight: '500', textAlign: 'right' }}>DUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementLabourer.entries.map(ent => {
                      const t = parseFloat(ent.payment_amount) || 0
                      const p = parseFloat(ent.paid_amount) || 0
                      const d = Math.max(0, t - p)
                      const cleanJobNum = ent.job_order_number ? String(ent.job_order_number).replace(/^#+/, '') : ''

                      return (
                        <tr key={ent.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                          <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap', color: textMuted }}>
                            {ent.date || '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            {ent.job_order_title ? (
                              <span style={{ fontWeight: '600', color: 'var(--primary, #5B4BDB)' }}>
                                {cleanJobNum ? `#${cleanJobNum} ` : ''}{ent.job_order_title}
                              </span>
                            ) : (
                              <span style={{ color: textMuted }}>Direct</span>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ent.work_done || '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: '600', color: textPrimary }}>
                            {safeFormatAmount(t)}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: '600', color: isDarkMode ? '#4ade80' : '#16a34a' }}>
                            {safeFormatAmount(p)}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: '700', color: d > 0 ? (isDarkMode ? '#f87171' : '#dc2626') : textMuted, textAlign: 'right' }}>
                            {safeFormatAmount(d)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStatementLabourer(null)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}
