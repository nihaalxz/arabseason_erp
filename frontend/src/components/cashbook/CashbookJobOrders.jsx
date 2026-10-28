import React, { useState, useEffect, useMemo, useRef, useCallback, Children } from 'react'
import { createPortal } from 'react-dom'
import { 
  Plus, Search, X, RefreshCw, AlertCircle, Trash2, 
  Briefcase, User, Calendar, CreditCard, Receipt 
} from '../icons'
import { 
  Pencil, CheckCircle2, Folder, ArrowDownRight, Clock, UserPlus, ArrowLeft
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
import { showConfirm, showError, showToast } from '../../utils/swal'

const MONTH_CODES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const getCurrentMonthCode = () => MONTH_CODES[new Date().getMonth()]

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
        className="cb-mobile-carousel-scroll"
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          gap: '0.65rem',
          paddingBottom: '4px',
          paddingLeft: '0.1rem',
          paddingRight: '1.25rem',
          boxSizing: 'border-box'
        }}

      >
        {validChildren.map((child, idx) => (
          <div
            key={idx}
            style={{
              flex: '0 0 78%',
              minWidth: '78%',
              maxWidth: '78%',
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CashbookJobOrders({ 
  isDarkMode = false, 
  isMobileScreen = false,
  customers: initialCustomers = [],
  vendors: initialVendors = [],
  banks: initialBanks = [],
  pettyCashAccounts: initialPettyCashAccounts = [],
  books: initialBooks = [],
  onReceivePayment = null,
  onBack,
  onNavigate
}) {
  const [internalIsMobile, setInternalIsMobile] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth <= 768
    return isMobileScreen
  })

  useEffect(() => {
    const handleResize = () => {
      setInternalIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const effectiveIsMobile = isMobileScreen || internalIsMobile

  const [jobOrders, setJobOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState(initialCustomers || [])
  const [vendors, setVendors] = useState(initialVendors || [])
  const [banks, setBanks] = useState(initialBanks || [])
  const [pettyCashAccounts, setPettyCashAccounts] = useState(initialPettyCashAccounts || [])
  const [cashbooks, setCashbooks] = useState(initialBooks || [])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [modalSubmitting, setModalSubmitting] = useState(false)
  const [modalError, setModalError] = useState('')
  const [formData, setFormData] = useState({
    order_id: '',
    title: '',
    customer: '',
    vendor: '',
    status: 'Pending',
    total_amount: '',
    advance_amount: '',
    account_type: 'pca', // 'bank' or 'pca'
    selected_account_id: '',
    cashbook: '',
    project_name: '',
    created_by_staff: '',
    assigned_to: '',
    description: ''
  })

  // Assignable Admins State
  const [assignableAdmins, setAssignableAdmins] = useState([])
  useEffect(() => {
    api.get('job-orders/assignable-admins/')
      .then(res => setAssignableAdmins(res.data || []))
      .catch(err => console.error('Failed to load assignable admins:', err))
  }, [])

  // Quick Customer Creation Modal State
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', company_name: '', phone: '', email: '' })
  const [submittingCustomer, setSubmittingCustomer] = useState(false)

  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    if (!customerForm.name.trim()) return
    try {
      setSubmittingCustomer(true)
      const res = await api.post('customers/', customerForm)
      const newCust = res.data
      setCustomers(prev => [newCust, ...prev])
      setFormData(prev => ({ ...prev, customer: newCust.id }))
      setIsCustomerModalOpen(false)
      setCustomerForm({ name: '', company_name: '', phone: '', email: '' })
      showToast('Customer created successfully', 'success')
    } catch (err) {
      console.error('Failed to create customer:', err)
      showError('Failed to create customer.')
    } finally {
      setSubmittingCustomer(false)
    }
  }

  // Quick Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedJobForPayment, setSelectedJobForPayment] = useState(null)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    account_type: 'pca',
    selected_account_id: '',
    cashbook: '',
    payment_mode: 'Petty Cash',
    remark: ''
  })

  useEffect(() => {
    if (initialVendors?.length) {
      setVendors(initialVendors)
    } else {
      api.get('vendors/?nopage=true')
        .then(res => setVendors(Array.isArray(res.data) ? res.data : (res.data?.results || [])))
        .catch(() => {})
    }
  }, [initialVendors])

  useEffect(() => {
    if (!initialBanks?.length || !initialPettyCashAccounts?.length) {
      Promise.all([
        api.get('bank-accounts/?limit=100').catch(() => ({ data: [] })),
        api.get('petty-cash-accounts/?limit=100').catch(() => ({ data: [] })),
        api.get('cashbooks/?limit=100').catch(() => ({ data: [] }))
      ]).then(([bRes, pRes, cRes]) => {
        if (!initialBanks?.length) setBanks(Array.isArray(bRes.data) ? bRes.data : (bRes.data?.results || []))
        if (!initialPettyCashAccounts?.length) setPettyCashAccounts(Array.isArray(pRes.data) ? pRes.data : (pRes.data?.results || []))
        if (!initialBooks?.length) setCashbooks(Array.isArray(cRes.data) ? cRes.data : (cRes.data?.results || []))
      })
    }
  }, [initialBanks, initialPettyCashAccounts, initialBooks])

  // Theme colors matching tab=vendors
  const cardBg = isDarkMode ? '#121417' : '#ffffff'
  const borderColor = isDarkMode ? '#232528' : '#e2e8f0'
  const textPrimary = isDarkMode ? '#ffffff' : '#0f172a'
  const textMuted = isDarkMode ? '#8b9096' : '#64748b'
  const inputBg = isDarkMode ? '#17191d' : '#f8fafc'
  const inputBorder = isDarkMode ? '#282b32' : '#cbd5e1'

  const safeFormatAmount = (val) => {
    try {
      const num = parseFloat(val || 0)
      return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    } catch {
      return val || '0'
    }
  }

  // Fetch job orders
  const fetchJobOrders = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('job-orders/?limit=1000')
      const data = res.data?.results || res.data || []
      setJobOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load job orders for cashbook:', err)
      showError('Failed to load job orders.')
    } finally {
      setLoading(false)
    }
  }, [])

  const customersFetchedRef = useRef(false)

  // Fetch customers if not passed
  const fetchCustomers = useCallback(async () => {
    try {
      const res = await api.get('customers/?nopage=true')
      const data = res.data?.results || res.data || []
      setCustomers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load customers for job orders:', err)
    }
  }, [])

  useEffect(() => {
    fetchJobOrders()
    if (!customersFetchedRef.current) {
      customersFetchedRef.current = true
      if (!initialCustomers || initialCustomers.length === 0) {
        fetchCustomers()
      }
    }
  }, [fetchJobOrders, fetchCustomers, initialCustomers])

  // Sync passed customers if updated
  useEffect(() => {
    if (initialCustomers && initialCustomers.length > 0) {
      setCustomers(initialCustomers)
    }
  }, [initialCustomers])

  // Computed Metrics
  const totalOrdersCount = jobOrders.length
  const totalContractValue = useMemo(() => {
    return jobOrders.reduce((sum, j) => sum + (parseFloat(j.total_amount) || 0), 0)
  }, [jobOrders])

  const totalPaid = useMemo(() => {
    return jobOrders.reduce((sum, j) => sum + (parseFloat(j.paid_amount) || 0), 0)
  }, [jobOrders])

  const totalDue = useMemo(() => {
    return jobOrders.reduce((sum, j) => {
      const bal = parseFloat(j.balance)
      if (!isNaN(bal) && bal > 0) return sum + bal
      const total = parseFloat(j.total_amount) || 0
      const paid = parseFloat(j.paid_amount) || 0
      return sum + Math.max(0, total - paid)
    }, 0)
  }, [jobOrders])

  const inProgressOrders = useMemo(() => {
    return jobOrders.filter(j => (j.status || '').toLowerCase() === 'in progress')
  }, [jobOrders])

  const completedOrders = useMemo(() => {
    return jobOrders.filter(j => (j.status || '').toLowerCase() === 'completed')
  }, [jobOrders])

  const pendingOrders = useMemo(() => {
    return jobOrders.filter(j => (j.status || '').toLowerCase() === 'pending')
  }, [jobOrders])

  const dueOrders = useMemo(() => {
    return jobOrders.filter(j => {
      const bal = parseFloat(j.balance)
      if (!isNaN(bal)) return bal > 0.01
      const total = parseFloat(j.total_amount) || 0
      const paid = parseFloat(j.paid_amount) || 0
      return (total - paid) > 0.01
    })
  }, [jobOrders])

  const settledOrders = useMemo(() => {
    return jobOrders.filter(j => {
      const total = parseFloat(j.total_amount) || 0
      const paid = parseFloat(j.paid_amount) || 0
      const bal = parseFloat(j.balance)
      const due = !isNaN(bal) ? bal : (total - paid)
      return total > 0 && due <= 0.01
    })
  }, [jobOrders])

  // Filtered List
  const filteredJobOrders = useMemo(() => {
    return jobOrders.filter(j => {
      // Status filter
      if (statusFilter === 'In Progress' && (j.status || '').toLowerCase() !== 'in progress') return false
      if (statusFilter === 'Completed' && (j.status || '').toLowerCase() !== 'completed') return false
      if (statusFilter === 'Pending' && (j.status || '').toLowerCase() !== 'pending') return false
      if (statusFilter === 'Payment Due') {
        const bal = parseFloat(j.balance)
        const due = !isNaN(bal) ? bal : ((parseFloat(j.total_amount) || 0) - (parseFloat(j.paid_amount) || 0))
        if (due <= 0.01) return false
      }
      if (statusFilter === 'Settled') {
        const total = parseFloat(j.total_amount) || 0
        const bal = parseFloat(j.balance)
        const due = !isNaN(bal) ? bal : (total - (parseFloat(j.paid_amount) || 0))
        if (total <= 0 || due > 0.01) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const orderId = (j.order_id || '').toLowerCase()
        const title = (j.title || '').toLowerCase()
        const customer = (j.customer_name || '').toLowerCase()
        const project = (j.project_name || '').toLowerCase()
        const desc = (j.description || '').toLowerCase()
        return orderId.includes(q) || title.includes(q) || customer.includes(q) || project.includes(q) || desc.includes(q)
      }

      return true
    })
  }, [jobOrders, statusFilter, searchQuery])

  // Pagination for job orders
  const jobOrdersResetKey = `${statusFilter}_${searchQuery}`;
  const {
    pageItems: pagedJobOrders,
    page: jobOrdersPage,
    setPage: setJobOrdersPage,
    totalPages: totalJobOrdersPages,
    rangeStart: jobOrdersRangeStart,
    rangeEnd: jobOrdersRangeEnd,
    total: totalJobOrdersCount
  } = usePagination(filteredJobOrders, effectiveIsMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP, jobOrdersResetKey);

  const filterPills = [
    { id: 'All', label: 'All', count: totalOrdersCount },
    { id: 'In Progress', label: 'In Progress', count: inProgressOrders.length },
    { id: 'Payment Due', label: 'Payment Due', count: dueOrders.length },
    { id: 'Completed', label: 'Completed', count: completedOrders.length },
    { id: 'Pending', label: 'Pending', count: pendingOrders.length }
  ]

  // Modal open / edit
  const handleOpenAddModal = () => {
    const curMonth = getCurrentMonthCode()
    const monthNumbers = (jobOrders || []).map(j => {
      const m = (j.order_id || '').match(new RegExp(`^#?${curMonth}(\\d+)$`, 'i'))
      return m ? parseInt(m[1], 10) : 0
    }).filter(n => !isNaN(n) && n > 0)
    const nextSeq = monthNumbers.length > 0 ? Math.max(...monthNumbers) + 1 : 1
    const defaultOrderId = `#${curMonth}${nextSeq.toString().padStart(2, '0')}`

    let defaultStaff = ''
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}')
      defaultStaff = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || ''
    } catch {}

    setEditingJob(null)
    setFormData({
      order_id: defaultOrderId,
      title: '',
      customer: customers[0]?.id || '',
      vendor: '',
      status: 'Pending',
      total_amount: '',
      advance_amount: '',
      account_type: 'pca',
      selected_account_id: pettyCashAccounts[0]?.id || '',
      cashbook: cashbooks[0]?.id || '',
      project_name: '',
      created_by_staff: defaultStaff,
      assigned_to: '',
      description: ''
    })
    setModalError('')
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (job) => {
    setEditingJob(job)
    setFormData({
      order_id: job.order_id || '',
      title: job.title || '',
      customer: job.customer || (job.customer_id) || '',
      vendor: job.vendor || job.vendor_id || '',
      status: job.status || 'In Progress',
      total_amount: job.total_amount != null ? String(job.total_amount) : '',
      advance_amount: job.advance_amount != null ? String(job.advance_amount) : (job.paid_amount != null ? String(job.paid_amount) : ''),
      account_type: 'pca',
      selected_account_id: pettyCashAccounts[0]?.id || '',
      cashbook: cashbooks[0]?.id || '',
      project_name: job.project_name || '',
      created_by_staff: job.created_by_staff || '',
      assigned_to: job.assigned_to || '',
      description: job.description || ''
    })
    setModalError('')
    setIsModalOpen(true)
  }

  const handleSaveJobOrder = async (e) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      setModalError('Job Order title is required.')
      return
    }
    if (!formData.customer) {
      setModalError('Please select a customer.')
      return
    }
    const parsedTotal = parseFloat(formData.total_amount)
    if (isNaN(parsedTotal) || parsedTotal < 0) {
      setModalError('Please enter a valid total contract amount.')
      return
    }
    const parsedAdv = parseFloat(formData.advance_amount || 0)
    if (isNaN(parsedAdv) || parsedAdv < 0) {
      setModalError('Advance amount cannot be negative.')
      return
    }
    if (parsedAdv > parsedTotal && parsedTotal > 0) {
      setModalError('Advance amount cannot exceed the total contract amount.')
      return
    }

    try {
      setModalSubmitting(true)
      setModalError('')
      const payload = {
        order_id: formData.order_id.trim(),
        title: formData.title.trim(),
        customer: formData.customer,
        vendor: formData.vendor ? parseInt(formData.vendor, 10) : null,
        status: formData.status,
        total_amount: parsedTotal,
        advance_amount: parsedAdv,
        project_name: formData.project_name.trim(),
        created_by_staff: formData.created_by_staff.trim(),
        assigned_to: formData.assigned_to ? formData.assigned_to : null,
        description: formData.description.trim(),
        ...(parsedAdv > 0 && formData.account_type === 'bank' ? { bank_account: formData.selected_account_id, payment_mode: 'Bank Transfer' } : {}),
        ...(parsedAdv > 0 && formData.account_type === 'pca' ? { petty_cash_account: formData.selected_account_id, payment_mode: 'Petty Cash' } : {}),
        cashbook: formData.cashbook || null
      }

      if (editingJob) {
        const res = await api.put(`job-orders/${editingJob.id}/`, payload)
        setJobOrders(prev => prev.map(j => j.id === editingJob.id ? { ...j, ...res.data } : j))
        showToast('Job order updated successfully', 'success')
      } else {
        const res = await api.post('job-orders/', payload)
        setJobOrders(prev => [res.data, ...prev])
        showToast('Job order created successfully', 'success')
      }
      setIsModalOpen(false)
      fetchJobOrders()
    } catch (err) {
      console.error('Failed to save job order:', err)
      const msg = err.response?.data?.order_id?.[0] || 
                  err.response?.data?.detail || 
                  'Failed to save job order. Please check inputs.'
      setModalError(msg)
    } finally {
      setModalSubmitting(false)
    }
  }

  const handleOpenReceivePaymentModal = (job) => {
    const total = parseFloat(job.total_amount) || 0
    const paid = parseFloat(job.paid_amount) || 0
    const bal = parseFloat(job.due_amount != null ? job.due_amount : job.balance) || Math.max(0, total - paid)

    setSelectedJobForPayment(job)
    setPaymentFormData({
      amount: bal > 0 ? bal.toFixed(2) : '',
      date: new Date().toISOString().split('T')[0],
      account_type: 'pca',
      selected_account_id: pettyCashAccounts[0]?.id || '',
      cashbook: cashbooks[0]?.id || '',
      payment_mode: 'Petty Cash',
      remark: `Payment against Job #${String(job.order_id || job.id).replace(/^#+/, '')} - ${job.title}`
    })
    setPaymentError('')
    setIsPaymentModalOpen(true)
  }

  const handleSavePayment = async (e) => {
    e.preventDefault()
    if (!selectedJobForPayment) return
    const amt = parseFloat(paymentFormData.amount)
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('Please enter a valid payment amount greater than 0.')
      return
    }

    try {
      setPaymentSubmitting(true)
      setPaymentError('')

      const isBank = paymentFormData.account_type === 'bank'
      const bankAcc = isBank ? (banks.find(b => String(b.id) === String(paymentFormData.selected_account_id)) || null) : null
      const pcaAcc = !isBank ? (pettyCashAccounts.find(p => String(p.id) === String(paymentFormData.selected_account_id)) || null) : null

      const payload = {
        entry_type: 'in',
        amount: amt,
        date: paymentFormData.date,
        time: '12:00:00',
        remark: paymentFormData.remark.trim() || `Payment against Job #${String(selectedJobForPayment.order_id || selectedJobForPayment.id).replace(/^#+/, '')} - ${selectedJobForPayment.title}`,
        category: 'Sales',
        payment_mode: isBank ? 'Bank Transfer' : 'Petty Cash',
        transaction_type: 'Customer Payment',
        customer: selectedJobForPayment.customer || selectedJobForPayment.customer_id,
        job_order: selectedJobForPayment.id,
        party_name: selectedJobForPayment.customer_name || 'Customer',
        bank_account: bankAcc?.id || null,
        bank_account_name: bankAcc?.bank_name || '',
        petty_cash_account: pcaAcc?.id || null,
        petty_cash_account_name: pcaAcc?.name || '',
        cashbook: paymentFormData.cashbook || null
      }

      await api.post('cashbook-entries/', payload)
      showToast('Payment received and recorded successfully', 'success')
      setIsPaymentModalOpen(false)
      setSelectedJobForPayment(null)
      fetchJobOrders()
    } catch (err) {
      console.error('Failed to record customer payment:', err)
      const msg = err.response?.data?.detail || 'Failed to record customer payment.'
      setPaymentError(msg)
    } finally {
      setPaymentSubmitting(false)
    }
  }

  const handleDeleteJob = async (job) => {
    const confirmed = await showConfirm(
      'Delete Job Order?',
      `Are you sure you want to delete "${job.title}" (${job.order_id || 'ID #' + job.id})?`
    )
    if (!confirmed) return

    try {
      await api.delete(`job-orders/${job.id}/`)
      setJobOrders(prev => prev.filter(j => j.id !== job.id))
      showToast('Job order deleted', 'info')
    } catch (err) {
      console.error('Failed to delete job order:', err)
      showError('Failed to delete job order.')
    }
  }

  const getStatusBadgeStyle = (status) => {
    const s = (status || '').toLowerCase()
    if (s === 'completed') {
      return {
        background: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7',
        color: isDarkMode ? '#4ade80' : '#16a34a',
        border: `1px solid ${isDarkMode ? 'rgba(74, 222, 128, 0.25)' : '#bbf7d0'}`
      }
    }
    if (s === 'in progress') {
      return {
        background: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe',
        color: isDarkMode ? '#60a5fa' : '#2563eb',
        border: `1px solid ${isDarkMode ? 'rgba(96, 165, 250, 0.25)' : '#bfdbfe'}`
      }
    }
    if (s === 'pending') {
      return {
        background: isDarkMode ? 'rgba(234, 179, 8, 0.15)' : '#fef9c3',
        color: isDarkMode ? '#facc15' : '#ca8a04',
        border: `1px solid ${isDarkMode ? 'rgba(250, 204, 21, 0.25)' : '#fef08a'}`
      }
    }
    if (s === 'cancelled') {
      return {
        background: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
        color: isDarkMode ? '#f87171' : '#dc2626',
        border: `1px solid ${isDarkMode ? 'rgba(248, 113, 113, 0.25)' : '#fecaca'}`
      }
    }
    return {
      background: isDarkMode ? '#1e2024' : '#f1f5f9',
      color: textMuted,
      border: `1px solid ${borderColor}`
    }
  }

  const fieldLabelStyle = {
    display: 'block',
    fontSize: '0.88rem',
    fontWeight: '700',
    color: textPrimary,
    marginBottom: '0.45rem',
    letterSpacing: '-0.01em'
  }

  const inputControlStyle = {
    width: '100%',
    height: '46px',
    padding: '0 0.95rem',
    borderRadius: '12px',
    border: `1px solid ${inputBorder}`,
    background: inputBg,
    color: textPrimary,
    fontSize: '0.92rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease'
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
      {/* ========================================================= */}
      {/* COMMAND HEADER                                            */}
      {/* ========================================================= */}
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
              job orders
            </h1>
            <button
              type="button"
              id="btn-create-job-order-mobile"
              onClick={handleOpenAddModal}
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
              <span>Create</span>
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
                Job Orders
              </h2>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: textMuted }}>
              Manage client job orders, advance deposits, and receivables directly in Cashbook
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              type="button"
              id="btn-create-job-order"
              onClick={handleOpenAddModal}
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
              <span>Create Job Order</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4 KPI SUMMARY CARDS / MOBILE CAROUSEL                     */}
      {/* ========================================================= */}
      <MobileCardCarousel
        isMobile={effectiveIsMobile}
        isDarkMode={isDarkMode}
        desktopColumns={4}
        gap={effectiveIsMobile ? '0.65rem' : '1rem'}
        marginBottom={effectiveIsMobile ? '1rem' : '1.25rem'}
      >
        {/* Card 1: Total Job Orders */}
        <div 
          onClick={() => setStatusFilter('All')}
          style={{
            background: cardBg,
            border: (statusFilter === 'All')
              ? (isDarkMode ? '2px solid #ffffff' : '2px solid #0A0A0A')
              : `1px solid ${borderColor}`,
            borderRadius: '16px',
            padding: isMobileScreen ? '0.75rem 0.95rem' : '1.15rem 1.25rem',
            minHeight: isMobileScreen ? '84px' : 'auto',
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
              Total Orders
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
              <Briefcase size={15} strokeWidth={2.2} />
            </div>
          </div>
          <div style={{ fontSize: isMobileScreen ? '1.2rem' : '1.45rem', fontWeight: '800', color: textPrimary, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {totalOrdersCount}
          </div>
          {!isMobileScreen && (
            <div style={{ fontSize: '0.72rem', color: textMuted, marginTop: '2px' }}>
              {inProgressOrders.length} in progress · {completedOrders.length} completed
            </div>
          )}
        </div>

        {/* Card 2: Total Contract Value */}
        <div 
          onClick={() => setStatusFilter('All')}
          style={{
            background: cardBg,
            border: `1px solid ${borderColor}`,
            borderRadius: '16px',
            padding: isMobileScreen ? '0.75rem 0.95rem' : '1.15rem 1.25rem',
            minHeight: isMobileScreen ? '84px' : 'auto',
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
              Contract Value
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
              <Receipt size={15} strokeWidth={2.2} />
            </div>
          </div>
          <div style={{ fontSize: isMobileScreen ? '1.2rem' : '1.45rem', fontWeight: '800', color: textPrimary, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {effectiveIsMobile && formatCompactKpi(totalContractValue) ? (
              <span className="cred-tnum">{formatCompactKpi(totalContractValue)}</span>
            ) : (
              `SAR ${safeFormatAmount(totalContractValue)}`
            )}
          </div>
          {!isMobileScreen && (
            <div style={{ fontSize: '0.72rem', color: textMuted, marginTop: '2px' }}>
              Total order book value
            </div>
          )}
        </div>

        {/* Card 3: Payments Received */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'Completed' ? 'All' : 'Completed')}
          style={{
            background: cardBg,
            border: (statusFilter === 'Completed' || statusFilter === 'Settled')
              ? (isDarkMode ? '2px solid #ffffff' : '2px solid #0A0A0A')
              : `1px solid ${borderColor}`,
            borderRadius: '16px',
            padding: isMobileScreen ? '0.75rem 0.95rem' : '1.15rem 1.25rem',
            minHeight: isMobileScreen ? '84px' : 'auto',
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
              Cash In Paid
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDarkMode ? '#60a5fa' : '#2563eb'
            }}>
              <ArrowDownRight size={15} strokeWidth={2.5} />
            </div>
          </div>
          <div style={{ fontSize: isMobileScreen ? '1.2rem' : '1.45rem', fontWeight: '800', color: isDarkMode ? '#60a5fa' : '#2563eb', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {effectiveIsMobile && formatCompactKpi(totalPaid) ? (
              <span className="cred-tnum">{formatCompactKpi(totalPaid)}</span>
            ) : (
              `SAR ${safeFormatAmount(totalPaid)}`
            )}
          </div>
          {!isMobileScreen && (
            <div style={{ fontSize: '0.72rem', color: textMuted, marginTop: '2px' }}>
              Collected from customers
            </div>
          )}
        </div>

        {/* Card 4: Outstanding Balance Due */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'Payment Due' ? 'All' : 'Payment Due')}
          style={{
            background: cardBg,
            border: (statusFilter === 'Payment Due')
              ? (isDarkMode ? '2px solid #ffffff' : '2px solid #0A0A0A')
              : `1px solid ${borderColor}`,
            borderRadius: '16px',
            padding: isMobileScreen ? '0.75rem 0.95rem' : '1.15rem 1.25rem',
            minHeight: isMobileScreen ? '84px' : 'auto',
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
              Balance Due
            </span>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: isDarkMode ? 'rgba(220, 38, 38, 0.15)' : '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDarkMode ? '#f87171' : '#dc2626'
            }}>
              <AlertCircle size={15} strokeWidth={2.2} />
            </div>
          </div>
          <div style={{ fontSize: isMobileScreen ? '1.2rem' : '1.45rem', fontWeight: '800', color: isDarkMode ? '#f87171' : '#dc2626', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {effectiveIsMobile && formatCompactKpi(totalDue) ? (
              <span className="cred-tnum">{formatCompactKpi(totalDue)}</span>
            ) : (
              `SAR ${safeFormatAmount(totalDue)}`
            )}
          </div>
          {!isMobileScreen && (
            <div style={{ fontSize: '0.72rem', color: textMuted, marginTop: '2px' }}>
              {dueOrders.length} orders with pending balance
            </div>
          )}
        </div>
      </MobileCardCarousel>

      {/* ========================================================= */}
      {/* FILTER PILLS & SEARCH BAR ROW                             */}
      {/* ========================================================= */}
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
        {/* Filter Pills / Mobile GooeyMenu */}
        {effectiveIsMobile ? (
          <div style={{ position: 'relative', zIndex: 40, overflow: 'visible', width: '100%' }}>
            <GooeyMenu
              id="cred-job-orders-filter-dropdown"
              value={statusFilter}
              onSelect={(opt) => setStatusFilter(opt.value || opt.id || opt)}
              options={filterPills.map(tab => ({
                value: tab.id,
                label: `${tab.label} (${tab.count})`
              }))}
              width="100%"
              pillHeight={40}
              ariaLabel="Filter job orders"
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
              tabs={filterPills}
              value={statusFilter}
              onChange={(newVal) => setStatusFilter(newVal)}
              className="case-preserve"
              layoutId="cred-job-orders-tabs-pill"
            />
          </div>
        )}

        {/* Search Bar */}
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
      {/* JOB ORDERS DATA TABLE / MOBILE CARDS                      */}
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
          <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>Loading job orders...</div>
        </div>
      ) : filteredJobOrders.length === 0 ? (
        <div style={{
          background: effectiveIsMobile ? 'transparent' : cardBg,
          border: effectiveIsMobile ? 'none' : `1px solid ${borderColor}`,
          borderRadius: '16px',
          padding: effectiveIsMobile ? '2.5rem 1rem' : '3rem 1.5rem',
          textAlign: 'center',
          boxShadow: isDarkMode || effectiveIsMobile ? 'none' : '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: isDarkMode ? '#1a1c20' : '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            color: textMuted
          }}>
            <Briefcase size={24} strokeWidth={1.8} />
          </div>
          <h4 style={{ fontSize: '1rem', fontWeight: '700', color: textPrimary, margin: '0 0 0.25rem' }}>
            No job orders found
          </h4>
          <p style={{ fontSize: '0.825rem', color: textMuted, margin: '0 0 1rem', maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>
            {searchQuery 
              ? `No job orders match "${searchQuery}". Try adjusting your search query.`
              : `No job orders in "${statusFilter}".`}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              style={{
                background: isDarkMode ? '#ffffff' : '#0f172a',
                color: isDarkMode ? '#0f172a' : '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.55rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                margin: '0 auto'
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
              Create Job Order
            </button>
          )}
        </div>
      ) : effectiveIsMobile ? (
        /* Mobile Cards View: CRED two-tier row layout with inset dashed separator */
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
          {pagedJobOrders.map((job) => {
            const total = parseFloat(job.total_amount) || 0;
            const paid = parseFloat(job.paid_amount) || 0;
            const bal = parseFloat(job.balance);
            const due = !isNaN(bal) ? bal : (total - paid);
            const hasDue = due > 0.01;
            const initialLetter = (job.title || 'J').charAt(0).toUpperCase();
            const refCode = formatJobRef(job.order_id || job.id);
            const sublineText = `${refCode} · ${job.customer_name || 'Client'}${job.vendor_name ? ' · ' + job.vendor_name : ''}`;
            const s = (job.status || '').toLowerCase();
            const isProgress = s === 'in progress';
            const isCompleted = s === 'completed' || s === 'settled';

            return (
              <div key={job.id} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Tier 1: Avatar | Title + Subline | Status dot + plain text */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 0 4px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <div style={{
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
                    }}>
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
                        {job.title}
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
                      background: isProgress ? 'var(--accent, #3b82f6)' : (hasDue || s === 'pending' || s === 'payment due') ? 'var(--danger, #dc2626)' : 'var(--positive, #16a34a)'
                    }} />
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isProgress ? 'var(--accent, #3b82f6)' : (hasDue || s === 'pending' || s === 'payment due') ? 'var(--danger, #dc2626)' : 'var(--text-muted, #8C8C8C)',
                      textTransform: 'lowercase'
                    }}>
                      {job.status}
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
                    <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px' }}>
                      Total
                    </div>
                    <div style={{ fontSize: getAmountFontSize(total), fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--text, #0A0A0A)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      SAR {safeFormatAmount(total)}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px' }}>
                      Received
                    </div>
                    <div style={{ fontSize: getAmountFontSize(paid), fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--text, #0A0A0A)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      SAR {safeFormatAmount(paid)}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px' }}>
                      Balance
                    </div>
                    <div style={{ fontSize: getAmountFontSize(due), fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: hasDue ? 'var(--danger, #dc2626)' : 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      SAR {hasDue ? safeFormatAmount(due) : '0.00'}
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
                        onReceivePayment ? onReceivePayment(job) : handleOpenReceivePaymentModal(job);
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
                      Receive payment
                    </button>
                  )}
                  <button
                    type="button"
                    title="Edit Job Order"
                    aria-label="Edit Job Order"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditModal(job);
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
                    title="Delete Job Order"
                    aria-label="Delete Job Order"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteJob(job);
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
        /* Desktop Table View */
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
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '23%' }}>
                    JOB ORDER / TITLE
                  </th>
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '15%' }}>
                    CUSTOMER
                  </th>
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '10%' }}>
                    STATUS
                  </th>
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '11%' }}>
                    ESTIMATED TOTAL
                  </th>
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '11%' }}>
                    CUSTOMER PAID
                  </th>
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '12%' }}>
                    DUE AMOUNT (CUSTOMER OWED)
                  </th>
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '9%' }}>
                    CREATED DATE
                  </th>
                  <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '500', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap', width: '9%' }}>
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedJobOrders.map((job, idx) => {
                  const total = parseFloat(job.total_amount) || 0
                  const paid = parseFloat(job.paid_amount) || 0
                  const bal = parseFloat(job.due_amount != null ? job.due_amount : job.balance)
                  const due = !isNaN(bal) ? bal : Math.max(0, total - paid)
                  const hasDue = due > 0.01
                  const orderIdCode = formatJobRef(job.order_id || `${getCurrentMonthCode()}${job.id.toString().padStart(2, '0')}`)
                  
                  const statusNormalized = String(job.status || '').toLowerCase().trim()
                  const statusTone = (statusNormalized === 'in progress' || statusNormalized === 'in_progress')
                    ? 'ink'
                    : statusNormalized === 'pending'
                    ? 'warning'
                    : (statusNormalized === 'completed' || statusNormalized === 'done' || statusNormalized === 'settled')
                    ? 'success'
                    : 'muted'

                  return (
                    <tr
                      key={job.id || idx}
                      className="cred-table-row"
                      style={{
                        borderBottom: `1px solid ${borderColor}`
                      }}
                    >
                      {/* Job Order / Title (Two-line cell: title ink, id muted below, no boxed id) */}
                      <td style={{ padding: '8px 8px', verticalAlign: 'middle' }}>
                        <div className="cred-cell-2l">
                          <span className="cred-cell-2l__primary" title={job.title} style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {job.title}
                          </span>
                          <span className="cred-cell-2l__secondary">
                            {orderIdCode}{job.project_name ? ` · ${job.project_name}` : ''}
                          </span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '8px 8px', fontSize: '0.825rem', color: textPrimary, fontWeight: '600', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: isDarkMode ? '#1e2024' : '#e2e8f0',
                            color: textPrimary,
                            fontWeight: '700',
                            fontSize: '0.72rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {((job.customer_name || 'C').charAt(0)).toUpperCase()}
                          </div>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }} title={job.customer_name}>
                            {job.customer_name || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Status (CredStatus: "in progress" = ink, "pending" = warning, "completed" = success, others = muted) */}
                      <td style={{ padding: '8px 8px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <CredStatus tone={statusTone} label={job.status} />
                      </td>

                      {/* Estimated Total (Ink) */}
                      <td style={{ padding: '8px 8px', fontSize: '0.84rem', fontWeight: '500', color: textPrimary, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        SAR {safeFormatAmount(total)}
                      </td>

                      {/* Customer Paid (Ink, remove blue) */}
                      <td style={{ padding: '8px 8px', fontSize: '0.84rem', fontWeight: '500', color: textPrimary, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        SAR {safeFormatAmount(paid)}
                      </td>

                      {/* Due Amount (Customer Owed) */}
                      <td style={{ padding: '8px 8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {hasDue ? (
                          <span style={{ fontSize: '0.84rem', fontWeight: '500', color: 'var(--dot-danger, #E5482E)' }}>
                            SAR {safeFormatAmount(due)}
                          </span>
                        ) : (
                          <div className="cred-cell-2l">
                            <span className="cred-cell-2l__primary" style={{ fontSize: '0.84rem', fontWeight: '500' }}>
                              SAR 0.00
                            </span>
                            <span className="cred-cell-2l__secondary">
                              settled
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Created Date */}
                      <td style={{ padding: '8px 8px', fontSize: '0.76rem', color: textMuted, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        {job.created_at ? job.created_at.split('T')[0] : '—'}
                      </td>

                      {/* Actions ("receive payment" row text action, CredRowIconButton for edit & delete) */}
                      <td style={{ padding: '8px 8px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', whiteSpace: 'nowrap' }}>
                          {hasDue && (
                            <button
                              type="button"
                              className="cred-row-link"
                              title="Receive Payment from Customer"
                              onClick={() => onReceivePayment ? onReceivePayment(job) : handleOpenReceivePaymentModal(job)}
                            >
                              receive payment
                            </button>
                          )}
                          <CredRowIconButton
                            title="Edit Job Order"
                            ariaLabel="Edit Job Order"
                            onClick={() => handleOpenEditModal(job)}
                          >
                            <Pencil size={13} />
                          </CredRowIconButton>
                          <CredRowIconButton
                            tone="danger"
                            title="Delete Job Order"
                            ariaLabel="Delete Job Order"
                            onClick={() => handleDeleteJob(job)}
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

      {/* PAGINATION (Directly below table/list, 16px gap, outside table card) */}
      <CredPagination
        page={jobOrdersPage}
        totalPages={totalJobOrdersPages}
        rangeStart={jobOrdersRangeStart}
        rangeEnd={jobOrdersRangeEnd}
        total={totalJobOrdersCount}
        onPageChange={setJobOrdersPage}
        isMobile={effectiveIsMobile}
      />

      {/* ========================================================= */}
      {/* ADD / EDIT JOB ORDER MODAL                                */}
      {/* ========================================================= */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-overlay cb-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            height: '100%',
            background: isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(11, 27, 68, 0.50)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: effectiveIsMobile ? 'flex-end' : 'center',
            justifyContent: 'center',
            padding: effectiveIsMobile ? 0 : '2rem 1rem',
            boxSizing: 'border-box',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div
            className="modal-container cb-expense-modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: cardBg,
              colorScheme: isDarkMode ? 'dark' : 'light',
              border: effectiveIsMobile ? 'none' : `1px solid ${borderColor}`,
              borderRadius: effectiveIsMobile ? '24px 24px 0 0' : '20px',
              padding: effectiveIsMobile 
                ? '0.75rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom, 16px)) 1.25rem' 
                : '2rem 2.25rem',
              boxShadow: isDarkMode ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(15,23,42,0.18)',
              maxWidth: effectiveIsMobile ? '100%' : '800px',
              width: '100%',
              maxHeight: effectiveIsMobile ? '90vh' : 'calc(100vh - 3.5rem)',
              overflowX: 'hidden',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              position: 'relative',
              margin: effectiveIsMobile ? 0 : 'auto',
              boxSizing: 'border-box',
              overscrollBehavior: 'contain',
              touchAction: 'pan-y'
            }}
          >
            {/* Close Button Top Right */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              style={{
                position: 'absolute',
                top: effectiveIsMobile ? '1rem' : '1.5rem',
                right: effectiveIsMobile ? '1rem' : '1.5rem',
                background: isDarkMode ? '#1e2025' : '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: textMuted,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                zIndex: 10
              }}
            >
              <X size={16} />
            </button>

            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '800',
                color: textPrimary,
                margin: '0 0 0.25rem',
                letterSpacing: '-0.02em'
              }}>
                {editingJob ? 'Edit Job Order' : 'Add New Job Order'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: textMuted }}>
                Record client contract order details and track receivables
              </p>
            </div>

            {modalError && (
              <div style={{
                background: isDarkMode ? 'rgba(239,68,68,0.15)' : '#fee2e2',
                border: '1px solid #ef4444',
                borderRadius: '10px',
                padding: '0.65rem 0.85rem',
                color: '#ef4444',
                fontSize: '0.8rem',
                fontWeight: '600',
                marginBottom: '1rem'
              }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveJobOrder} autoComplete="off">
              {/* Order ID & Status in 2 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={fieldLabelStyle}>Order / Contract ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.order_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, order_id: e.target.value }))}
                    style={inputControlStyle}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    style={{ ...inputControlStyle, cursor: 'pointer' }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Title */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={fieldLabelStyle}>Job Order Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  style={inputControlStyle}
                  autoFocus
                />
              </div>

              {/* Customer & Assigned Vendor */}
              <div style={{ display: 'grid', gridTemplateColumns: effectiveIsMobile ? '1fr' : '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                    <label style={{ ...fieldLabelStyle, marginBottom: 0 }}>Customer / Client *</label>
                    <button
                      type="button"
                      onClick={() => setIsCustomerModalOpen(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary, #5B4BDB)',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <UserPlus size={13} strokeWidth={2.2} /> New Customer
                    </button>
                  </div>
                  <select
                    required
                    value={formData.customer}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
                    style={{ ...inputControlStyle, cursor: 'pointer' }}
                  >
                    <option value="">Select a customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.company_name} {c.company_name && c.name && c.company_name !== c.name ? `(${c.company_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={fieldLabelStyle}>Assigned Vendor (Optional)</label>
                  <select
                    value={formData.vendor || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
                    style={{ ...inputControlStyle, cursor: 'pointer' }}
                  >
                    <option value="">-- No Vendor Assigned --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.company ? `(${v.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Estimated Total Amount & Advance Amount Paid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={fieldLabelStyle}>Estimated Total Amount (SAR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.total_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_amount: e.target.value }))}
                    placeholder="e.g. 15000"
                    style={inputControlStyle}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Advance Received / Paid (SAR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.advance_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, advance_amount: e.target.value }))}
                    placeholder="0.00"
                    style={inputControlStyle}
                  />
                </div>
              </div>

              {/* Financial Breakdown Card */}
              {(() => {
                const est = parseFloat(formData.total_amount) || 0
                const adv = parseFloat(formData.advance_amount) || 0
                const due = Math.max(0, est - adv)
                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.5rem',
                    padding: '0.65rem 0.85rem',
                    background: isDarkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '12px',
                    marginBottom: '1rem',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Estimated Total</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '800', color: textPrimary, marginTop: '2px' }}>
                        SAR {safeFormatAmount(est)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase' }}>Customer Paid</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                        SAR {safeFormatAmount(adv)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: due > 0 ? '#ef4444' : '#10b981', fontWeight: '700', textTransform: 'uppercase' }}>Due Amount</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '800', color: due > 0 ? '#ef4444' : '#10b981', marginTop: '2px' }}>
                        SAR {safeFormatAmount(due)}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Deposit Account Selector (shown when advance_amount > 0) */}
              {parseFloat(formData.advance_amount || 0) > 0 && (
                <div style={{
                  padding: '0.85rem',
                  background: isDarkMode ? 'rgba(59, 130, 246, 0.08)' : '#eff6ff',
                  border: '1px solid #3b82f6',
                  borderRadius: '12px',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#3b82f6', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CreditCard size={13} /> DEPOSIT ADVANCE PAYMENT TO
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div>
                      <label style={{ ...fieldLabelStyle, fontSize: '0.7rem' }}>Payment Mode</label>
                      <select
                        value={formData.account_type}
                        onChange={(e) => {
                          const type = e.target.value
                          setFormData(prev => ({
                            ...prev,
                            account_type: type,
                            selected_account_id: type === 'bank' ? (banks[0]?.id || '') : (pettyCashAccounts[0]?.id || '')
                          }))
                        }}
                        style={{ ...inputControlStyle, padding: '0.5rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        <option value="pca">Petty Cash Account</option>
                        <option value="bank">Bank Account</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ ...fieldLabelStyle, fontSize: '0.7rem' }}>Destination Account</label>
                      <select
                        value={formData.selected_account_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, selected_account_id: e.target.value }))}
                        style={{ ...inputControlStyle, padding: '0.5rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        {formData.account_type === 'bank' ? (
                          banks.map(b => (
                            <option key={b.id} value={b.id}>{b.bank_name || b.account_name} ({safeFormatAmount(b.balance)} SAR)</option>
                          ))
                        ) : (
                          pettyCashAccounts.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({safeFormatAmount(p.balance)} SAR)</option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                  {cashbooks && cashbooks.length > 0 && (
                    <div>
                      <label style={{ ...fieldLabelStyle, fontSize: '0.7rem' }}>Target Cashbook</label>
                      <select
                        value={formData.cashbook}
                        onChange={(e) => setFormData(prev => ({ ...prev, cashbook: e.target.value }))}
                        style={{ ...inputControlStyle, padding: '0.5rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        <option value="">Default Cashbook</option>
                        {cashbooks.map(cb => (
                          <option key={cb.id} value={cb.id}>{cb.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Project Name & Responsible Staff (2 columns on desktop) */}
              <div style={{ display: 'grid', gridTemplateColumns: effectiveIsMobile ? '1fr' : '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={fieldLabelStyle}>Project Name (Optional)</label>
                  <input
                    type="text"
                    value={formData.project_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, project_name: e.target.value }))}
                    placeholder="e.g. Al-Riyadh Villa Renovation"
                    style={inputControlStyle}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Responsible Staff / Manager</label>
                  <input
                    type="text"
                    value={formData.created_by_staff}
                    onChange={(e) => setFormData(prev => ({ ...prev, created_by_staff: e.target.value }))}
                    style={inputControlStyle}
                  />
                </div>
              </div>

              {/* Assign to Admin (Delegation) */}
              {assignableAdmins && assignableAdmins.length > 0 && (
                <div style={{
                  background: isDarkMode ? '#17191d' : '#f8fafc',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  border: `1px solid ${borderColor}`,
                  marginBottom: '1rem'
                }}>
                  <label style={{ ...fieldLabelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: textPrimary, fontWeight: '700' }}>
                      <User size={14} style={{ color: '#6366f1' }} />
                      Assign to Admin (Optional)
                    </span>
                    <span style={{ fontSize: '0.75rem', color: textMuted, fontWeight: 'normal' }}>Delegates order to Admin for ownership</span>
                  </label>
                  <select
                    value={formData.assigned_to || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))}
                    style={{ ...inputControlStyle, cursor: 'pointer', background: isDarkMode ? '#1e2025' : '#ffffff' }}
                  >
                    <option value="">-- No Admin Assigned (Keep with creator) --</option>
                    {assignableAdmins.map(adm => (
                      <option key={adm.id} value={adm.id}>
                        {adm.name} ({adm.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={fieldLabelStyle}>Scope of Work / Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    ...inputControlStyle,
                    height: 'auto',
                    padding: '0.65rem 0.95rem',
                    resize: 'vertical',
                    minHeight: '70px'
                  }}
                />
              </div>

              {/* Modal Action Buttons */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.65rem',
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: `1px solid ${borderColor}`
              }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={modalSubmitting}
                  style={{
                    background: isDarkMode ? '#1e2025' : '#f1f5f9',
                    color: textPrimary,
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.65rem 1.25rem',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  style={{
                    background: isDarkMode ? '#ffffff' : '#0f172a',
                    color: isDarkMode ? '#0f172a' : '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.65rem 1.5rem',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    cursor: modalSubmitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: isDarkMode ? '0 2px 10px rgba(255,255,255,0.1)' : '0 2px 10px rgba(15,23,42,0.15)'
                  }}
                >
                  {modalSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingJob ? 'Update Job Order' : 'Create Job Order'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* RECEIVE CUSTOMER PAYMENT MODAL                            */}
      {/* ========================================================= */}
      {isPaymentModalOpen && selectedJobForPayment && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-overlay cb-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            height: '100%',
            background: isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(11, 27, 68, 0.50)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: effectiveIsMobile ? 'flex-end' : 'center',
            justifyContent: 'center',
            padding: effectiveIsMobile ? 0 : '2rem 1rem',
            boxSizing: 'border-box',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div
            className="modal-container cb-expense-modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: cardBg,
              colorScheme: isDarkMode ? 'dark' : 'light',
              border: effectiveIsMobile ? 'none' : `1px solid ${borderColor}`,
              borderRadius: effectiveIsMobile ? '24px 24px 0 0' : '20px',
              padding: effectiveIsMobile 
                ? '0.75rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom, 16px)) 1.25rem' 
                : '2rem 2.25rem',
              boxShadow: isDarkMode ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(15,23,42,0.18)',
              maxWidth: effectiveIsMobile ? '100%' : '540px',
              width: '100%',
              maxHeight: effectiveIsMobile ? '90vh' : 'calc(100vh - 3.5rem)',
              overflowX: 'hidden',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              position: 'relative',
              margin: effectiveIsMobile ? 0 : 'auto',
              boxSizing: 'border-box',
              overscrollBehavior: 'contain',
              touchAction: 'pan-y'
            }}
          >
            {/* Close Button Top Right */}
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              style={{
                position: 'absolute',
                top: effectiveIsMobile ? '1rem' : '1.5rem',
                right: effectiveIsMobile ? '1rem' : '1.5rem',
                background: isDarkMode ? '#1e2025' : '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: textMuted,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                zIndex: 10
              }}
            >
              <X size={16} />
            </button>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#059669', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                <CreditCard size={12} /> Receive Customer Payment
              </div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '800',
                color: textPrimary,
                margin: '0 0 0.25rem',
                letterSpacing: '-0.02em'
              }}>
                {selectedJobForPayment.title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: textMuted }}>
                Customer: <strong>{selectedJobForPayment.customer_name || 'Customer'}</strong> • Job: <strong>{selectedJobForPayment.order_id || `#${selectedJobForPayment.id}`}</strong>
              </p>
            </div>

            {/* Quick Balance Overview */}
            {(() => {
              const est = parseFloat(selectedJobForPayment.total_amount) || 0
              const paid = parseFloat(selectedJobForPayment.paid_amount) || 0
              const due = parseFloat(selectedJobForPayment.due_amount != null ? selectedJobForPayment.due_amount : selectedJobForPayment.balance) || Math.max(0, est - paid)
              return (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.5rem',
                  padding: '0.65rem 0.85rem',
                  background: isDarkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '12px',
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Estimated Total</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '800', color: textPrimary, marginTop: '2px' }}>
                      SAR {safeFormatAmount(est)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase' }}>Customer Paid</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                      SAR {safeFormatAmount(paid)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: due > 0 ? '#ef4444' : '#10b981', fontWeight: '700', textTransform: 'uppercase' }}>Due Amount</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '800', color: due > 0 ? '#ef4444' : '#10b981', marginTop: '2px' }}>
                      SAR {safeFormatAmount(due)}
                    </div>
                  </div>
                </div>
              )
            })()}

            {paymentError && (
              <div style={{
                background: isDarkMode ? 'rgba(239,68,68,0.15)' : '#fee2e2',
                border: '1px solid #ef4444',
                borderRadius: '10px',
                padding: '0.65rem 0.85rem',
                color: '#ef4444',
                fontSize: '0.8rem',
                fontWeight: '600',
                marginBottom: '1rem'
              }}>
                {paymentError}
              </div>
            )}

            <form onSubmit={handleSavePayment} autoComplete="off">
              {/* Payment Amount & Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ ...fieldLabelStyle, marginBottom: 0 }}>Amount (SAR) *</label>
                    {(() => {
                      const est = parseFloat(selectedJobForPayment.total_amount) || 0
                      const paid = parseFloat(selectedJobForPayment.paid_amount) || 0
                      const due = parseFloat(selectedJobForPayment.due_amount != null ? selectedJobForPayment.due_amount : selectedJobForPayment.balance) || Math.max(0, est - paid)
                      return due > 0 ? (
                        <button
                          type="button"
                          onClick={() => setPaymentFormData(prev => ({ ...prev, amount: due.toFixed(2) }))}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#10b981',
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          Fill Full Due ({safeFormatAmount(due)})
                        </button>
                      ) : null
                    })()}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={paymentFormData.amount}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    style={inputControlStyle}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentFormData.date}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, date: e.target.value }))}
                    style={inputControlStyle}
                  />
                </div>
              </div>

              {/* Payment Account Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={fieldLabelStyle}>Account Type *</label>
                  <select
                    value={paymentFormData.account_type}
                    onChange={(e) => {
                      const type = e.target.value
                      setPaymentFormData(prev => ({
                        ...prev,
                        account_type: type,
                        selected_account_id: type === 'bank' ? (banks[0]?.id || '') : (pettyCashAccounts[0]?.id || '')
                      }))
                    }}
                    style={{ ...inputControlStyle, cursor: 'pointer' }}
                  >
                    <option value="pca">Petty Cash Account</option>
                    <option value="bank">Bank Account</option>
                  </select>
                </div>
                <div>
                  <label style={fieldLabelStyle}>Destination Account *</label>
                  <select
                    required
                    value={paymentFormData.selected_account_id}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, selected_account_id: e.target.value }))}
                    style={{ ...inputControlStyle, cursor: 'pointer' }}
                  >
                    {paymentFormData.account_type === 'bank' ? (
                      banks.map(b => (
                        <option key={b.id} value={b.id}>{b.bank_name || b.account_name} ({safeFormatAmount(b.balance)} SAR)</option>
                      ))
                    ) : (
                      pettyCashAccounts.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({safeFormatAmount(p.balance)} SAR)</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Cashbook Selection */}
              {cashbooks && cashbooks.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={fieldLabelStyle}>Cashbook</label>
                  <select
                    value={paymentFormData.cashbook}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, cashbook: e.target.value }))}
                    style={{ ...inputControlStyle, cursor: 'pointer' }}
                  >
                    <option value="">Default Cashbook</option>
                    {cashbooks.map(cb => (
                      <option key={cb.id} value={cb.id}>{cb.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Remark */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={fieldLabelStyle}>Remark / Note</label>
                <input
                  type="text"
                  value={paymentFormData.remark}
                  onChange={(e) => setPaymentFormData(prev => ({ ...prev, remark: e.target.value }))}
                  placeholder="e.g. Received partial payment for phase 1"
                  style={inputControlStyle}
                />
              </div>

              {/* Modal Action Buttons */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.65rem',
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: `1px solid ${borderColor}`
              }}>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  disabled={paymentSubmitting}
                  style={{
                    background: isDarkMode ? '#1e2025' : '#f1f5f9',
                    color: textPrimary,
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.65rem 1.25rem',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.65rem 1.5rem',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    cursor: paymentSubmitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: '0 2px 10px rgba(16,185,129,0.3)'
                  }}
                >
                  {paymentSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <span>Record Payment</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Quick Customer Creation Modal */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Add New Customer"
        maxWidth="480px"
      >
        <form onSubmit={handleCreateCustomer}>
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={fieldLabelStyle}>Customer / Client Name *</label>
            <input
              type="text"
              required
              value={customerForm.name}
              onChange={(e) => setCustomerForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Abdullah Al-Otaibi"
              style={inputControlStyle}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '0.85rem' }}>
            <label style={fieldLabelStyle}>Company / Organization (Optional)</label>
            <input
              type="text"
              value={customerForm.company_name}
              onChange={(e) => setCustomerForm(prev => ({ ...prev, company_name: e.target.value }))}
              placeholder="e.g. Al-Arab Est."
              style={inputControlStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={fieldLabelStyle}>Phone Number</label>
              <input
                type="text"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="e.g. +966 50 123 4567"
                style={inputControlStyle}
              />
            </div>
            <div>
              <label style={fieldLabelStyle}>Email Address</label>
              <input
                type="email"
                value={customerForm.email}
                onChange={(e) => setCustomerForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="e.g. client@email.com"
                style={inputControlStyle}
              />
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.65rem',
            paddingTop: '0.85rem',
            borderTop: `1px solid ${borderColor}`
          }}>
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(false)}
              disabled={submittingCustomer}
              style={{
                background: isDarkMode ? '#1e2025' : '#f1f5f9',
                color: textPrimary,
                border: 'none',
                borderRadius: '10px',
                padding: '0.6rem 1.15rem',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingCustomer}
              style={{
                background: 'var(--primary, #5B4BDB)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.6rem 1.35rem',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: submittingCustomer ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              {submittingCustomer ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Customer</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
