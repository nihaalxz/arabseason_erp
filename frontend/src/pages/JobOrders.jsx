import React from 'react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import { Clock, Paperclip, Download, Eye as LucideEye, ExternalLink, UploadCloud } from 'lucide-react'
import { Edit, Trash2, Plus, Eye, RefreshCw, AlertCircle, CreditCard, CheckCircle2, XCircle, UserPlus, User, FileText, ArrowUpDown, ArrowUp, ArrowDown, Briefcase, Layers, BookOpen, Folder, ChevronRight } from '../components/icons'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import api from '../api'
import Modal from '../components/common/Modal'
import SkeletonLoader from '../components/common/SkeletonLoader'
import SearchBar from '../components/common/SearchBar'
import ProjectPlanning from '../components/planning/ProjectPlanning'
import DynamicCustomFields from '../components/common/DynamicCustomFields'
import { showConfirm, showAlert, showSuccess, showError, showWarning, showToast } from '../utils/swal'

const MONTH_CHOICES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const getCurrentMonthCode = () => MONTH_CHOICES[new Date().getMonth()]

const getLinkedProjectTitle = (job) => {
  if (!job) return ''
  if (job.project_name) {
    if (typeof job.project_name === 'object') return job.project_name.title || ''
    return String(job.project_name)
  }
  if (job.linked_project) {
    if (typeof job.linked_project === 'object') return job.linked_project.title || ''
    return String(job.linked_project)
  }
  return ''
}

const JobOrders = ({ embedded = false }) => {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')

  // Client Books Architecture & Summary
  const [selectedClientBook, setSelectedClientBook] = useState('all')
  const [jobSummary, setJobSummary] = useState({ total_value: 0, total_paid: 0, total_balance: 0, count: 0, by_client: [] })

  // Current user & role detection
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user')) || {} }
    catch (e) { return {} }
  })()
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.is_admin || currentUser?.is_superuser

  // Admin Job Order Tabs & Staff Delegation
  const [adminTab, setAdminTab] = useState('my') // 'my' | 'assigned'
  const [assignedStaffFilter, setAssignedStaffFilter] = useState('all')
  const [pendingAssignedCount, setPendingAssignedCount] = useState(0)
  const [assignableAdmins, setAssignableAdmins] = useState([])

  const fetchAssignedCount = useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await api.get('job-orders/', { params: { view_scope: 'assigned', page_size: 1 } })
      const cnt = res.data?.count !== undefined ? res.data.count : (Array.isArray(res.data) ? res.data.length : 0)
      setPendingAssignedCount(cnt)
    } catch (err) {
      console.error('Failed to fetch assigned job count', err)
    }
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin) {
      fetchAssignedCount()
    }
  }, [isAdmin, fetchAssignedCount])

  // Search parameters for sub-sections (orders vs planning vs pending)
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTabParam = searchParams.get('tab')
  const subtabParam = searchParams.get('subtab')
  const [embeddedSection, setEmbeddedSection] = useState(() => {
    return (subtabParam === 'planning' || subtabParam === 'pending') ? subtabParam : 'orders'
  })

  useEffect(() => {
    if (embedded) {
      const st = searchParams.get('subtab')
      if (st === 'planning' || st === 'pending' || st === 'orders') {
        setEmbeddedSection(st)
      }
    }
  }, [embedded, searchParams])

  const activeSection = embedded 
    ? embeddedSection 
    : (currentTabParam === 'planning' ? 'planning' : (currentTabParam === 'pending' ? 'pending' : 'orders'))

  // Pending Job Orders State
  const [pendingJobOrders, setPendingJobOrders] = useState([])
  const [pendingJobsLoading, setPendingJobsLoading] = useState(false)
  const [pendingFilterStatus, setPendingFilterStatus] = useState('pending') // 'pending' | 'converted' | 'all'
  const [pendingSearchQuery, setPendingSearchQuery] = useState('')
  const [selectedPendingForCreation, setSelectedPendingForCreation] = useState(null)
  const [previewAttachment, setPreviewAttachment] = useState(null)

  const handleDownloadAttachment = (dataUrl, fileName, mimeType) => {
    if (!dataUrl) return
    try {
      const arr = dataUrl.split(',')
      const bstr = atob(arr[1])
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }
      const type = mimeType || (fileName?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
      const blob = new Blob([u8arr], { type })
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName || 'attachment'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      console.error('Download error:', err)
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = fileName || 'attachment'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleOpenAttachmentPreview = (dataUrl, fileName, mimeType) => {
    if (!dataUrl) return
    try {
      const arr = dataUrl.split(',')
      const bstr = atob(arr[1])
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }
      const type = mimeType || (fileName?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
      const blob = new Blob([u8arr], { type })
      const blobUrl = URL.createObjectURL(blob)
      setPreviewAttachment({
        blobUrl,
        dataUrl,
        name: fileName || 'Attachment',
        type
      })
    } catch (err) {
      console.error('Preview error:', err)
      setPreviewAttachment({
        blobUrl: dataUrl,
        dataUrl,
        name: fileName || 'Attachment',
        type: mimeType || 'application/octet-stream'
      })
    }
  }

  const fetchPendingJobOrders = useCallback(async () => {
    try {
      setPendingJobsLoading(true)
      const res = await api.get('pending-job-orders/')
      const data = res.data?.results || res.data || []
      setPendingJobOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load pending job orders:', err)
    } finally {
      setPendingJobsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPendingJobOrders()
  }, [fetchPendingJobOrders])

  // Dynamic Custom Columns
  const [customColumns, setCustomColumns] = useState([])

  const fetchCustomColumns = useCallback(async () => {
    try {
      const res = await api.get('custom-fields/', { params: { form_type: 'job_order' } })
      setCustomColumns((res.data || []).filter(f => f.show_in_table))
    } catch (err) {
      console.error('Failed to load custom columns for job orders:', err)
    }
  }, [])

  useEffect(() => {
    fetchCustomColumns()
  }, [fetchCustomColumns])

  const handleTabSwitch = (tab) => {
    if (embedded) {
      setEmbeddedSection(tab)
      setSearchParams(p => {
        const next = new URLSearchParams(p)
        if (tab === 'planning' || tab === 'pending') {
          next.set('subtab', tab)
        } else {
          next.delete('subtab')
        }
        return next
      })
      return
    }
    if (tab === 'planning') {
      setSearchParams({ tab: 'planning' })
    } else if (tab === 'pending') {
      setSearchParams({ tab: 'pending' })
    } else {
      setSearchParams({})
    }
  }

  const fetchJobSummary = async () => {
    try {
      const res = await api.get('job-orders/summary/')
      if (res.data) setJobSummary(res.data)
    } catch (err) {
      console.error('Failed to fetch job summary', err)
    }
  }

  // Refs always hold the latest filter/page/sort values — no stale closures
  const filterRef = useRef({ page: 1, status: '', payment: '', search: '', sortField: 'created_at', sortDirection: 'desc', client: 'all', adminTab: 'my', staffFilter: 'all' })
  filterRef.current = { page, status: filterStatus, payment: filterPayment, search: debouncedSearch, sortField, sortDirection, client: selectedClientBook, adminTab, staffFilter: assignedStaffFilter }

  const fetchJobs = useCallback(async (overrides = {}) => {
    const { page: p, status: s, payment: pay, search: q, sortField: sf, sortDirection: sd, client: cl, adminTab: at, staffFilter: sfFilter } = { ...filterRef.current, ...overrides }
    try {
      setLoading(true)
      const params = {
        page: p,
        page_size: 20
      }
      if (isAdmin) {
        params.view_scope = at || 'my'
        if ((at === 'assigned') && sfFilter && sfFilter !== 'all') {
          params.assigned_by_staff = sfFilter
        }
      }
      if (s) params.status = s
      if (pay) params.payment_status = pay
      if (q) params.search = q
      if (cl && cl !== 'all') params.customer = cl
      if (sf) {
        params.ordering = (sd === 'desc' ? '-' : '') + sf
      }

      const res = await api.get('job-orders/', { params })
      const data = res.data

      if (Array.isArray(data)) {
        setJobs(data)
        setTotalPages(1)
      } else {
        setJobs(data.results || [])
        setTotalPages(Math.ceil((data.count || 0) / 20) || 1)
      }
      setError('')
    } catch (err) {
      console.error(err)
      setError('Failed to fetch jobs. Make sure the backend server is running.')
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 500)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // When any filter/search changes: reset to page 1 and fetch
  useEffect(() => {
    setPage(1)
    fetchJobs({ page: 1, status: filterStatus, payment: filterPayment, search: debouncedSearch, sortField, sortDirection, client: selectedClientBook, adminTab, staffFilter: assignedStaffFilter })
  }, [filterStatus, filterPayment, debouncedSearch, sortField, sortDirection, selectedClientBook, adminTab, assignedStaffFilter])

  useEffect(() => {
    fetchJobSummary()
  }, [jobs.length])

  // When page changes (pagination buttons), fetch using current filter refs
  useEffect(() => {
    fetchJobs({ page })
  }, [page])

  const handleSort = (field) => {
    let nextDirection = 'asc'
    if (sortField === field) {
      nextDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      // Default to ascending for text/id fields, descending for amounts/dates
      nextDirection = ['created_at', 'total_amount'].includes(field) ? 'desc' : 'asc'
    }
    setSortField(field)
    setSortDirection(nextDirection)
    setPage(1)
  }


  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [contractPrefix, setContractPrefix] = useState('JOB')
  const [contractNumber, setContractNumber] = useState('')
  const [formData, setFormData] = useState({
    order_id: '',
    invoice_number: '',
    quotation_number: '',
    title: '',
    description: '',
    project_name: '',
    customer: '',
    vendor: '',
    status: 'Pending',
    total_amount: 0,
    created_by_staff: '',
    payment_collected_by: '',
    assigned_to: '',
    custom_fields: {},
    attachment: '',
    attachment_name: '',
    attachment_type: ''
  })
  const [projectOptions, setProjectOptions] = useState([])
  const [staffOptions, setStaffOptions] = useState([])
  const [descriptions, setDescriptions] = useState([''])
  const [customers, setCustomers] = useState([])
  const [vendors, setVendors] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [customerPriorBalance, setCustomerPriorBalance] = useState(0)
  const [fetchingPriorBalance, setFetchingPriorBalance] = useState(false)
  const { settings, formatCurrency } = useSettings()

  // Inline Payment State
  const [addingPayment, setAddingPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' })
  const [pendingPayments, setPendingPayments] = useState([])
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [jobTitles, setJobTitles] = useState([])
  const [expenses, setExpenses] = useState([])
  const [addingExpense, setAddingExpense] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState(null)
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'Project Material' })
  const [expenseDescriptions, setExpenseDescriptions] = useState([''])
  const [submittingExpense, setSubmittingExpense] = useState(false)
  
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', company_name: '', phone: '', email: '' })
  const [submittingCustomer, setSubmittingCustomer] = useState(false)
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];


  useEffect(() => {
    fetchLookups()
  }, [])

  const fetchLookups = async () => {
    // Fetch each independently so one failure doesn't block others
    try {
      const cRes = await api.get('customers/', { params: { nopage: 'true' } })
      const data = cRes.data
      setCustomers(Array.isArray(data) ? data : (data.results || []))
    } catch (err) {
      console.error('Failed to fetch customers', err)
    }
    try {
      const vRes = await api.get('vendors/', { params: { nopage: 'true' } })
      const data = vRes.data
      setVendors(Array.isArray(data) ? data : (data.results || []))
    } catch (err) {
      console.error('Failed to fetch vendors', err)
    }
    try {
      const tRes = await api.get('job-orders/titles/')
      setJobTitles(tRes.data || [])
    } catch (err) {
      console.error('Failed to fetch job titles', err)
    }
    try {
      const sRes = await api.get('job-orders/staff-options/')
      setStaffOptions(sRes.data || [])
    } catch (err) {
      console.error('Failed to fetch staff options', err)
    }
    try {
      const pRes = await api.get('project-plans/', { params: { nopage: 'true' } })
      const pData = pRes.data
      const plans = Array.isArray(pData) ? pData : (pData.results || [])
      const uniqueProjects = Array.from(new Set(plans.map(p => p.project_name).filter(Boolean)))
      setProjectOptions(uniqueProjects)
    } catch (err) {
      console.error('Failed to fetch projects', err)
    }
    try {
      const aRes = await api.get('job-orders/assignable-admins/')
      setAssignableAdmins(aRes.data || [])
    } catch (err) {
      console.error('Failed to fetch assignable admins', err)
    }
  }

  const handleAcceptJob = async (job) => {
    const confirmed = await showConfirm({
      title: 'Accept Job Order?',
      text: `Are you sure you want to accept Job Order ${job.order_id || `#${job.id}`} (${job.title})? Once accepted, you become the primary owner and all financial ledger entries and future transactions will be recorded under your account.`,
      confirmButtonText: 'Yes, Accept & Take Ownership',
      icon: 'question'
    })
    if (!confirmed) return

    try {
      setLoading(true)
      await api.post(`job-orders/${job.id}/accept/`)
      showToast(`Job Order ${job.order_id || `#${job.id}`} accepted and transferred to you!`, 'success')
      fetchJobs()
      fetchAssignedCount()
      fetchJobSummary()
    } catch (err) {
      console.error('Failed to accept job order', err)
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || 'Failed to accept job order. Please try again.'
      showError('Acceptance Failed', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelJob = async (job) => {
    const confirmed = await showConfirm({
      title: 'Cancel Job Order?',
      text: `Are you sure you want to cancel Job Order ${job.order_id || `#${job.id}`}? The job order number will be retained under Cancelled status and the receivable balance will be cleared.`,
      confirmButtonText: 'Yes, Cancel Job',
      isDangerous: true
    })
    if (!confirmed) return

    try {
      setLoading(true)
      await api.post(`job-orders/${job.id}/cancel-job/`)
      showToast(`Job Order ${job.order_id || `#${job.id}`} has been cancelled.`, 'info')
      if (isModalOpen) setIsModalOpen(false)
      fetchJobs()
      fetchAssignedCount()
      fetchJobSummary()
    } catch (err) {
      console.error('Failed to cancel job order', err)
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || 'Failed to cancel job order.'
      showError('Cancellation Failed', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreJob = async (job) => {
    const confirmed = await showConfirm({
      title: 'Restore Job Order?',
      text: `Are you sure you want to restore Job Order ${job.order_id || `#${job.id}`} back to active status?`,
      confirmButtonText: 'Yes, Restore Job',
    })
    if (!confirmed) return

    try {
      setLoading(true)
      await api.post(`job-orders/${job.id}/restore-job/`)
      showToast(`Job Order ${job.order_id || `#${job.id}`} restored to active status.`, 'success')
      if (isModalOpen) setIsModalOpen(false)
      fetchJobs()
      fetchAssignedCount()
      fetchJobSummary()
    } catch (err) {
      console.error('Failed to restore job order', err)
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || 'Failed to restore job order.'
      showError('Restore Failed', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  // 4.3 — Fetch prior outstanding balance for a customer when selected on new job form
  const fetchCustomerPriorBalance = async (customerId) => {
    if (!customerId) { setCustomerPriorBalance(0); return }
    try {
      setFetchingPriorBalance(true)
      const res = await api.get('job-orders/prior-balance/', { params: { customer: customerId } })
      setCustomerPriorBalance(parseFloat(res.data.prior_balance || 0))
    } catch (err) {
      console.error('Failed to fetch prior balance', err)
      setCustomerPriorBalance(0)
    } finally {
      setFetchingPriorBalance(false)
    }
  }

  const handleDeleteTitle = async (titleToDelete) => {
    const confirmed = await showConfirm({
      title: 'Remove Suggestion?',
      text: `Are you sure you want to remove "${titleToDelete}" from suggested job titles?`,
      confirmButtonText: 'Yes, Remove',
    })
    if (!confirmed) return
    try {
      const res = await api.post('job-orders/delete-title/', { title: titleToDelete })
      setJobTitles(res.data || [])
      if (formData.title === titleToDelete) {
        setFormData(prev => ({ ...prev, title: '' }))
      }
      showToast('Suggestion removed', 'success')
    } catch (err) {
      console.error('Failed to remove job title suggestion', err)
      showError('Action Failed', 'Failed to remove job title suggestion.')
    }
  }

  const CustomTitleOption = (props) => {
    const { data, innerProps, isFocused, isSelected } = props
    if (data.__isNew__) {
      return (
        <div
          {...innerProps}
          style={{
            padding: '10px 14px',
            cursor: 'pointer',
            backgroundColor: isFocused ? 'var(--primary, #3b82f6)' : '#2563eb',
            color: '#ffffff',
            fontWeight: '600',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>➕ Use "{data.label}"</span>
        </div>
      )
    }

    return (
      <div
        {...innerProps}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          cursor: 'pointer',
          backgroundColor: isSelected ? '#e0e7ff' : (isFocused ? '#f1f5f9' : 'transparent'),
          color: isSelected ? 'var(--primary, #2563eb)' : '#1e293b',
          fontSize: '0.875rem'
        }}
      >
        <span style={{ flex: 1, fontWeight: isSelected ? '700' : '500' }}>{data.label}</span>
        <button
          type="button"
          title={`Remove "${data.label}" from suggestions`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleDeleteTitle(data.value)
          }}
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#ef4444',
            cursor: 'pointer',
            padding: '3px 8px',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.75rem',
            fontWeight: '700'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.color = '#ef4444' }}
        >
          <Trash2 size={12} /> Clear
        </button>
      </div>
    )
  }

  const handleDescriptionChange = (index, value) => {
    const updated = [...descriptions]
    updated[index] = value
    setDescriptions(updated)
  }

  const handleAddDescription = () => {
    setDescriptions([...descriptions, ''])
  }

  const handleRemoveDescription = (index) => {
    if (descriptions.length <= 1) {
      setDescriptions([''])
    } else {
      setDescriptions(descriptions.filter((_, i) => i !== index))
    }
  }

  const handleExpenseDescriptionChange = (index, value) => {
    const updated = [...expenseDescriptions]
    updated[index] = value
    setExpenseDescriptions(updated)
  }

  const handleAddExpenseDescription = () => {
    setExpenseDescriptions([...expenseDescriptions, ''])
  }

  const handleRemoveExpenseDescription = (index) => {
    if (expenseDescriptions.length <= 1) {
      setExpenseDescriptions([''])
    } else {
      setExpenseDescriptions(expenseDescriptions.filter((_, i) => i !== index))
    }
  }

  const handleDeleteExpense = async (expenseId) => {
    if (typeof expenseId === 'string' && expenseId.startsWith('draft_')) {
      setExpenses(prev => prev.filter(e => e.id !== expenseId))
      return
    }
    const confirmed = await showConfirm({
      title: 'Delete Expense?',
      text: 'Are you sure you want to delete this expense record?',
      confirmButtonText: 'Yes, Delete',
      isDangerous: true,
    })
    if (!confirmed) return
    try {
      await api.delete(`expenses/${expenseId}/`)
      setExpenses(prev => prev.filter(e => e.id !== expenseId))
      showToast('Expense removed', 'success')
    } catch (err) {
      console.error('Failed to delete expense', err)
      showError('Action Failed', 'Failed to delete expense. Please try again.')
    }
  }

  const handleEditExpense = (exp) => {
    setEditingExpenseId(exp.id)
    const initialDescs = exp.description 
      ? exp.description.split('\n').map(d => d.trim()).filter(Boolean)
      : ['']
    setExpenseDescriptions(initialDescs.length > 0 ? initialDescs : [''])
    setExpenseForm({
      description: exp.description || '',
      amount: exp.amount,
      date: exp.date ? (exp.date.includes('T') ? exp.date.split('T')[0] : exp.date) : new Date().toISOString().split('T')[0],
      category: exp.category || 'Project Material'
    })
    setAddingExpense(true)
  }

  const handleCancelExpenseForm = () => {
    setAddingExpense(false)
    setEditingExpenseId(null)
    setExpenseForm({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'Project Material' })
    setExpenseDescriptions([''])
  }

  const handleDeletePendingPayment = (paymentId) => {
    setPendingPayments(prev => prev.filter(p => p.id !== paymentId))
  }

  const handleOpenModal = (job = null) => {
    // Always re-fetch lookups when opening modal to ensure fresh data in production
    fetchLookups()
    setExpenseDescriptions([''])
    setPendingPayments([])
    setAddingExpense(false)
    setEditingExpenseId(null)
    setAddingPayment(false)
    if (job) {
      setEditingJob(job)
      const initialDescriptions = job.description 
        ? job.description.split('\n').map(d => d.trim()).filter(Boolean)
        : ['']
      setDescriptions(initialDescriptions.length > 0 ? initialDescriptions : [''])

      // Parse existing order_id (e.g. JOB0012, #OCT12, 12)
      const rawOrderId = (job.order_id || '').trim()
      let pfx = 'JOB'
      let num = ''
      const match = rawOrderId.match(/^([A-Za-z]+)(\d*)$/)
      if (match) {
        pfx = match[1].toUpperCase()
        num = match[2]
      } else if (rawOrderId) {
        const mNum = rawOrderId.match(/\d+/)
        num = mNum ? mNum[0] : ''
        pfx = rawOrderId.replace(/\d+/g, '').replace(/^#+/, '').trim().toUpperCase() || 'JOB'
      }
      setContractPrefix(pfx || 'JOB')
      setContractNumber(num ? num.padStart(4, '0') : '')

      setFormData({
        order_id: job.order_id || '',
        invoice_number: job.invoice_number || '',
        quotation_number: job.quotation_number || '',
        title: job.title,
        description: job.description || '',
        project_name: getLinkedProjectTitle(job),
        customer: job.customer,
        vendor: job.vendor || '',
        status: job.status,
        total_amount: job.total_amount,
        advance_amount: job.advance_amount || 0,
        payment_type: job.payment_type || 'full',
        created_by_staff: job.created_by_staff || job.created_by_name || '',
        payment_collected_by: job.payment_collected_by || '',
        assigned_to: job.assigned_to || '',
        custom_fields: job.custom_fields || {},
        attachment: job.attachment || '',
        attachment_name: job.attachment_name || '',
        attachment_type: job.attachment_type || ''
      })
      setCustomerPriorBalance(parseFloat(job.prior_balance || 0))
      api.get('expenses/', { params: { job_order: job.id } }).then(res => {
        setExpenses(res.data.results || res.data)
      }).catch(err => console.error(err))
    } else {
      setEditingJob(null)
      setExpenses([])
      setDescriptions([''])

      // Suggest next sequence number for JOB
      let maxNum = 0
      ;(jobs || []).forEach(j => {
        const m = (j.order_id || '').match(/\d+/)
        if (m) {
          const val = parseInt(m[0], 10)
          if (!isNaN(val) && val > maxNum) maxNum = val
        }
      })
      const nextSeq = maxNum + 1
      setContractPrefix('JOB')
      setContractNumber(nextSeq.toString().padStart(4, '0'))

      let defaultCreator = ''
      try {
        const savedUser = JSON.parse(localStorage.getItem('user') || '{}')
        defaultCreator = `${savedUser.first_name || ''} ${savedUser.last_name || ''}`.trim() || savedUser.username || ''
      } catch (e) {}

      setFormData({
        order_id: '',
        invoice_number: '',
        quotation_number: '',
        title: '',
        description: '',
        project_name: '',
        customer: '',
        vendor: '',
        status: 'Pending',
        total_amount: 0,
        advance_amount: 0,
        payment_type: 'full',
        created_by_staff: defaultCreator,
        payment_collected_by: '',
        assigned_to: '',
        custom_fields: {},
        attachment: '',
        attachment_name: '',
        attachment_type: ''
      })
      setCustomerPriorBalance(0)
    }
    setFormError('')
    setSubmitting(false)
    setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' })
    setSelectedPendingForCreation(null)
    setIsModalOpen(true)
  }

  const handleCreateFromPending = (pending) => {
    // Re-fetch lookups so customer/vendor dropdowns are guaranteed fresh
    fetchLookups()
    setExpenseDescriptions([''])
    setPendingPayments([])
    setAddingExpense(false)
    setEditingExpenseId(null)
    setAddingPayment(false)
    setEditingJob(null)
    setExpenses([])

    // Suggest next sequence number for JOB
    let maxNum = 0
    ;(jobs || []).forEach(j => {
      const m = (j.order_id || '').match(/\d+/)
      if (m) {
        const val = parseInt(m[0], 10)
        if (!isNaN(val) && val > maxNum) maxNum = val
      }
    })
    const nextSeq = maxNum + 1
    setContractPrefix('JOB')
    setContractNumber(nextSeq.toString().padStart(4, '0'))

    let creatorName = ''
    try {
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}')
      creatorName = `${savedUser.first_name || ''} ${savedUser.last_name || ''}`.trim() || savedUser.username || ''
    } catch (e) {}

    const initDeposit = parseFloat(pending?.initial_deposit) || 0
    const estTotal = parseFloat(pending?.estimated_amount) || initDeposit || 0

    setFormData({
      order_id: '',
      invoice_number: '',
      quotation_number: '',
      title: pending?.title || '',
      description: pending?.description || '',
      project_name: pending?.title || '',
      customer: pending?.customer ? String(pending.customer) : '',
      vendor: '',
      status: 'In Progress',
      total_amount: estTotal,
      advance_amount: initDeposit,
      payment_type: initDeposit > 0 ? 'advance' : 'full',
      created_by_staff: creatorName,
      payment_collected_by: '',
      custom_fields: {},
      attachment: '',
      attachment_name: '',
      attachment_type: ''
    })

    const initialDescriptions = pending?.description 
      ? pending.description.split('\n').map(d => d.trim()).filter(Boolean)
      : ['']
    setDescriptions(initialDescriptions.length > 0 ? initialDescriptions : [''])

    if (pending?.customer) {
      fetchCustomerPriorBalance(pending.customer)
    } else {
      setCustomerPriorBalance(0)
    }

    setFormError('')
    setSubmitting(false)
    setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' })
    setSelectedPendingForCreation(pending)
    setIsModalOpen(true)
  }

  const handleDismissPending = async (pendingId) => {
    const confirmed = await showConfirm(
      'Dismiss Pending Entry?',
      'Are you sure you want to dismiss this pending job order entry?'
    )
    if (!confirmed) return
    try {
      await api.patch(`pending-job-orders/${pendingId}/`, { status: 'cancelled' })
      showToast('Pending entry dismissed', 'info')
      fetchPendingJobOrders()
    } catch (err) {
      console.error('Failed to dismiss pending entry:', err)
      showError('Failed to dismiss entry.')
    }
  }

  const handleAttachmentChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      showError('File Too Large', 'Please select an image or PDF smaller than 10MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setFormData(prev => ({
        ...prev,
        attachment: reader.result,
        attachment_name: file.name,
        attachment_type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAttachment = () => {
    setFormData(prev => ({
      ...prev,
      attachment: '',
      attachment_name: '',
      attachment_type: ''
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.customer || !formData.status) {
      return setFormError('Title, Customer, and Current Status are required')
    }

    const pfx = (contractPrefix || 'JOB').trim().toUpperCase().replace(/^#+/, '')
    const numPart = (contractNumber || '').trim().replace(/^[A-Za-z]+/i, '')
    if (!numPart) {
      return setFormError(`Contract ID number is required (e.g. 12 for ${pfx}0012)`)
    }
    const finalOrderId = `${pfx}${numPart.padStart(4, '0')}`

    // Client-side quick check
    const duplicate = jobs.find(j => 
      j.order_id && 
      j.order_id.trim().toLowerCase() === finalOrderId.toLowerCase() && 
      (!editingJob || j.id !== editingJob.id)
    )
    if (duplicate) {
      return setFormError(`Contract ID "${finalOrderId}" is already in use by another Job Order ("${duplicate.title}"). Contract IDs must be unique.`)
    }
    
    try {
      setSubmitting(true)
      setFormError('')
      
      const finalDescription = (descriptions || []).map(d => d.trim()).filter(Boolean).join('\n')
      const payload = { 
        ...formData, 
        order_id: finalOrderId, 
        description: finalDescription,
        custom_fields: formData.custom_fields || {},
        advance_amount: parseFloat(formData.advance_amount || 0),
        payment_type: formData.payment_type || 'full',
        assigned_to: formData.assigned_to ? formData.assigned_to : null,
        pending_job_order: selectedPendingForCreation?.id || null
      }
      if (payload.vendor === '') payload.vendor = null

      if (editingJob) {
        const response = await api.put(`job-orders/${editingJob.id}/`, payload)
        const updatedJob = {
          ...editingJob,
          ...response.data
        }
        setJobs(jobs.map(j => j.id === editingJob.id ? updatedJob : j))
        setEditingJob(updatedJob)
        setIsModalOpen(false)
      } else {
        const response = await api.post('job-orders/', payload)
        const newJob = response.data

        // Save any queued draft expenses
        const draftExpenses = expenses.filter(exp => exp.isDraft)
        let failedQueueCount = 0
        for (const exp of draftExpenses) {
          try {
            await api.post('expenses/', {
              description: exp.description,
              amount: exp.amount,
              date: exp.date,
              category: exp.category,
              job_order: newJob.id
            })
          } catch (err) {
            failedQueueCount++
            console.error('Failed to create queued expense:', err)
          }
        }

        // Save any queued draft payments
        for (const p of pendingPayments) {
          try {
            await api.post('customer-payments/', {
              amount: p.amount,
              payment_date: p.date,
              notes: p.notes,
              customer: newJob.customer,
              job_order: newJob.id
            })
          } catch (err) {
            failedQueueCount++
            console.error('Failed to create queued payment:', err)
          }
        }

        if (failedQueueCount > 0) {
          showToast(`Job created, but ${failedQueueCount} queued items could not be saved. Please review.`, 'warning')
        }


        fetchJobs()
        fetchPendingJobOrders()
        setSelectedPendingForCreation(null)
        setIsModalOpen(false)
        setEditingJob(null)
      }
    } catch (err) {
      const errorData = err.response?.data
      let errorMessage = 'Operation failed. Please check your data.'
      if (errorData) {
        if (typeof errorData === 'object') {
          errorMessage = Object.entries(errorData)
            .map(([key, value]) => {
              const fieldLabel = key === 'order_id' ? 'Contract ID' : key === 'non_field_errors' ? 'Error' : key
              return `${fieldLabel}: ${Array.isArray(value) ? value.join(', ') : value}`
            })
            .join(' | ')
        } else if (typeof errorData === 'string') {
          errorMessage = errorData
        }
      }
      setFormError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const handleTogglePaid = async () => {
    if (!editingJob) {
      const contractTot = parseFloat(formData.total_amount || 0)
      if (contractTot <= 0) {
        showWarning('Missing Total', 'Please specify Estimated Total Amount first.')
        return
      }
      const currentPaid = pendingPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
      const isSettled = contractTot > 0 && currentPaid >= contractTot
      if (isSettled) {
        setPendingPayments([])
      } else {
        const remaining = Math.max(0, contractTot - currentPaid)
        const draftSettlement = {
          id: 'draft_' + Date.now(),
          amount: remaining,
          date: new Date().toISOString().split('T')[0],
          notes: 'Full Settlement (Auto-Marked)',
          isDraft: true
        }
        setPendingPayments([draftSettlement, ...pendingPayments])
      }
      return
    }

    const isSettled = editingJob.balance <= 0
    
    if (isSettled) {
      const confirmed = await showConfirm({
        title: 'Unmark as Paid?',
        text: 'Unmark this job as paid? This will delete all payment records for this job order.',
        confirmButtonText: 'Yes, Unmark',
        isDangerous: true,
      })
      if (!confirmed) return
      
      try {
        setSubmittingPayment(true)
        const paymentsRes = await api.get('customer-payments/', { params: { job_order: editingJob.id, nopage: 'true' } })
        const paymentsToDelete = Array.isArray(paymentsRes.data.results) ? paymentsRes.data.results : (Array.isArray(paymentsRes.data) ? paymentsRes.data : [])
        
        await Promise.all(paymentsToDelete.map(p => api.delete(`customer-payments/${p.id}/`)))

        try {
          await api.patch(`jobs/${editingJob.id}/`, { advance_amount: 0 })
        } catch (e) {
          console.warn('Could not reset job advance amount on backend', e)
        }
        
        const updatedJob = {
           ...editingJob,
           payment_history: [],
           paid_amount: 0,
           balance: parseFloat(editingJob.total_amount)
        }
        
        setEditingJob(updatedJob)
        setJobs(jobs.map(j => j.id === updatedJob.id ? updatedJob : j))
        showToast('Job marked as unpaid', 'info')

      } catch (err) {
        showError('Action Failed', 'Failed to unmark as paid.')
        console.error(err)
      } finally {
        setSubmittingPayment(false)
      }
      return
    }

    const confirmed = await showConfirm({
      title: 'Mark as Fully Paid?',
      text: 'Mark this job as fully paid? This will create a payment record for the remaining balance.',
      confirmButtonText: 'Yes, Mark Paid',
      isDangerous: false,
      icon: 'question',
    })
    if (!confirmed) return

    try {
      setSubmittingPayment(true)
      const payload = {
        amount: parseFloat(editingJob.balance),
        payment_date: new Date().toISOString().split('T')[0],
        notes: 'Full Settlement (Auto-Marked)',
        customer: editingJob.customer,
        job_order: editingJob.id
      }
      const res = await api.post('customer-payments/', payload)
      
      const newPaymentHistory = [{
         id: res.data.id,
         amount: res.data.amount,
         date: res.data.payment_date,
         notes: res.data.notes
      }, ...(editingJob.payment_history || [])]

      const updatedJob = {
         ...editingJob,
         payment_history: newPaymentHistory,
         paid_amount: parseFloat(editingJob.paid_amount) + parseFloat(res.data.amount),
         balance: 0
      }
      
      setEditingJob(updatedJob)
      setJobs(jobs.map(j => j.id === updatedJob.id ? updatedJob : j))
      showToast('Job marked as fully paid', 'success')
    } catch (err) {
      showError('Action Failed', 'Failed to mark as paid.')
    } finally {
      setSubmittingPayment(false)
    }
  }

  const handlePaymentSubmit = async (e) => {
    e.preventDefault()
    if (!paymentForm.amount || !paymentForm.date) return

    if (!editingJob) {
      const draftPayment = {
        id: 'draft_' + Date.now(),
        amount: parseFloat(paymentForm.amount),
        date: paymentForm.date,
        notes: paymentForm.notes || 'Initial Payment',
        isDraft: true
      }
      setPendingPayments([draftPayment, ...pendingPayments])
      setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' })
      setAddingPayment(false)
      return
    }

    try {
      setSubmittingPayment(true)
      const payload = {
        amount: parseFloat(paymentForm.amount),
        payment_date: paymentForm.date,
        notes: paymentForm.notes,
        customer: editingJob.customer,
        job_order: editingJob.id
      }
      const res = await api.post('customer-payments/', payload)
      
      const newPaymentHistory = [{
         id: res.data.id,
         amount: res.data.amount,
         date: res.data.payment_date,
         notes: res.data.notes
      }, ...(editingJob.payment_history || [])]

      const updatedJob = {
         ...editingJob,
         payment_history: newPaymentHistory,
         paid_amount: parseFloat(editingJob.paid_amount) + parseFloat(res.data.amount),
         balance: parseFloat(editingJob.balance) - parseFloat(res.data.amount)
      }
      
      setEditingJob(updatedJob)
      setJobs(jobs.map(j => j.id === updatedJob.id ? updatedJob : j))
      setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' })
      setAddingPayment(false)
    } catch (err) {
      showError('Payment Error', 'Failed to process payment. Please verify input data.')
    } finally {
      setSubmittingPayment(false)
    }
  }

  const handleCustomerSubmit = async (e) => {
    e.preventDefault()
    try {
      setSubmittingCustomer(true)
      const res = await api.post('customers/', customerForm)
      setCustomers([...customers, res.data].sort((a,b) => a.name.localeCompare(b.name)))
      setFormData({...formData, customer: res.data.id})
      setIsCustomerModalOpen(false)
      setCustomerForm({ name: '', company_name: '', phone: '', email: '' })
    } catch (err) {
      showError('Customer Error', 'Failed to create customer.')
    } finally {
      setSubmittingCustomer(false)
    }
  }

  const handleExpenseSubmit = async (e) => {
    e.preventDefault()
    const finalDescription = expenseDescriptions.map(d => d.trim()).filter(Boolean).join('\n')
    if (!finalDescription) {
      showWarning('Missing Description', 'Please provide at least one description item for the expense.')
      return
    }
    if (!expenseForm.amount || !expenseForm.date) return

    // If Editing an Expense
    if (editingExpenseId) {
      if (typeof editingExpenseId === 'string' && editingExpenseId.startsWith('draft_')) {
        // Editing a draft expense in Create mode
        setExpenses(expenses.map(exp => {
          if (exp.id === editingExpenseId) {
            return {
              ...exp,
              description: finalDescription,
              amount: parseFloat(expenseForm.amount),
              date: expenseForm.date,
              category: expenseForm.category || 'Project Material'
            }
          }
          return exp
        }))
        handleCancelExpenseForm()
        return
      }

      // Editing an existing saved expense in database
      try {
        setSubmittingExpense(true)
        const payload = {
          description: finalDescription,
          amount: parseFloat(expenseForm.amount),
          date: expenseForm.date,
          category: expenseForm.category || 'Project Material',
          job_order: editingJob ? editingJob.id : undefined
        }
        const res = await api.put(`expenses/${editingExpenseId}/`, payload)
        setExpenses(expenses.map(exp => exp.id === editingExpenseId ? res.data : exp))
        handleCancelExpenseForm()
      } catch (err) {
        console.error('Failed to update expense', err)
        showError('Update Failed', 'Failed to update expense. Please try again.')
      } finally {
        setSubmittingExpense(false)
      }
      return
    }

    // If Creating a new expense in Create Mode
    if (!editingJob) {
      const draftExp = {
        id: 'draft_' + Date.now(),
        description: finalDescription,
        amount: parseFloat(expenseForm.amount),
        date: expenseForm.date,
        category: expenseForm.category || 'Project Material',
        isDraft: true
      }
      setExpenses([draftExp, ...expenses])
      handleCancelExpenseForm()
      return
    }

    // If Creating a new expense in Edit Mode
    try {
      setSubmittingExpense(true)
      const payload = {
        ...expenseForm,
        description: finalDescription,
        amount: parseFloat(expenseForm.amount),
        job_order: editingJob.id
      }
      const res = await api.post('expenses/', payload)
      setExpenses([res.data, ...expenses])
      handleCancelExpenseForm()
    } catch (err) {
      showError('Expense Error', 'Failed to add expense.')
    } finally {
      setSubmittingExpense(false)
    }
  }
  
  const expenseData = React.useMemo(() => {
    const categories = {}
    expenses.forEach(ex => {
      categories[ex.category] = (categories[ex.category] || 0) + parseFloat(ex.amount)
    })
    return Object.keys(categories).map(k => ({ name: k || 'Other', value: categories[k] }))
  }, [expenses])

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'var(--success)'
      case 'In Progress': return 'var(--primary)'
      case 'Pending': return 'var(--warning)'
      case 'Cancelled': return 'var(--danger)'
      default: return 'var(--text-muted)'
    }
  }

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Move Job Order to Recycle Bin?',
      text: 'Are you sure you want to move this job order to the Recycle Bin? It can be restored at any time.',
      confirmButtonText: 'Move to Recycle Bin',
      isDangerous: true,
    })
    if (confirmed) {
      try {
        await api.delete(`job-orders/${id}/`)
        setJobs(jobs.filter(j => j.id !== id))
        showToast('Job order moved to Recycle Bin', 'success')
      } catch (err) {
        showError('Action Failed', 'Failed to move job order to Recycle Bin.')
      }
    }
  }

  const isCancelledView = filterStatus === 'Cancelled'

  const activeClientStat = jobSummary.by_client?.find(cl => String(cl.customer_id) === String(selectedClientBook))
  const currentJobCount = isCancelledView
    ? (jobSummary.cancelled_summary?.count ?? jobs.filter(j => j.status === 'Cancelled').length)
    : (selectedClientBook === 'all' ? (jobSummary.count || jobs.length) : (activeClientStat?.count || jobs.length))

  const currentTotalVal = isCancelledView
    ? (jobSummary.cancelled_summary?.total_value ?? jobs.reduce((s, j) => s + (parseFloat(j.total_amount) || 0), 0))
    : (selectedClientBook === 'all' 
        ? (jobSummary.total_value || jobs.reduce((s, j) => s + (parseFloat(j.total_amount) || 0), 0))
        : (activeClientStat ? activeClientStat.total_value : jobs.reduce((s, j) => s + (parseFloat(j.total_amount) || 0), 0)))

  const currentTotalPaid = isCancelledView
    ? (jobSummary.cancelled_summary?.total_paid ?? jobs.reduce((s, j) => s + (parseFloat(j.paid_amount) || 0), 0))
    : (selectedClientBook === 'all'
        ? (jobSummary.total_paid || jobs.reduce((s, j) => s + (parseFloat(j.paid_amount) || 0), 0))
        : (activeClientStat ? activeClientStat.total_paid : jobs.reduce((s, j) => s + (parseFloat(j.paid_amount) || 0), 0)))

  const currentTotalBalance = isCancelledView
    ? 0
    : (selectedClientBook === 'all'
        ? (jobSummary.total_balance || jobs.reduce((s, j) => s + (parseFloat(j.balance) || 0), 0))
        : (activeClientStat ? activeClientStat.total_balance : jobs.reduce((s, j) => s + (parseFloat(j.balance) || 0), 0)))

  return (
    <div className={`jobs-page erp-page-container ${embedded ? 'embedded-job-orders' : ''}`} style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', padding: embedded ? '0' : undefined }}>
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontWeight: '700', letterSpacing: '-0.01em', fontSize: '1.35rem' }}>
            {activeSection === 'planning' ? 'Project Planning' : 'Job Orders'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>
            {activeSection === 'planning' 
              ? 'Formulate project work plans, designate tools, and assign skilled workforces' 
              : activeSection === 'pending'
                ? 'Review and formalize rough job order entries recorded from Cash In / Quick Log'
                : 'Manage service delivery, operational milestones, and customer invoicing'}
          </p>
        </div>
        {(activeSection === 'orders' || activeSection === 'pending') && (
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ borderRadius: 'var(--radius-sm)' }}>
              <Plus size={16} /> New Job Order
            </button>
          </div>
        )}
      </div>

      {/* Sub-Navigation Tabs: Segmented Control */}
      <div style={{
        display: 'inline-flex',
        gap: '0.35rem',
        background: 'rgba(0, 0, 0, 0.04)',
        padding: '0.3rem',
        borderRadius: '12px',
        marginBottom: '1.25rem',
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          onClick={() => handleTabSwitch('orders')}
          style={{
            padding: '0.5rem 1.15rem',
            border: 'none',
            borderRadius: '9px',
            background: activeSection === 'orders' ? '#ffffff' : 'transparent',
            color: activeSection === 'orders' ? 'var(--primary, #5B4BDB)' : 'var(--text-muted, #64748b)',
            boxShadow: activeSection === 'orders' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            fontWeight: activeSection === 'orders' ? '700' : '600',
            fontSize: '0.85rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Briefcase size={15} /> Job Orders
          <span style={{
            background: activeSection === 'orders' ? 'rgba(91, 75, 219, 0.1)' : 'rgba(0,0,0,0.05)',
            color: activeSection === 'orders' ? 'var(--primary, #5B4BDB)' : 'inherit',
            padding: '1px 7px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: '700'
          }}>
            {jobs.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleTabSwitch('planning')}
          style={{
            padding: '0.5rem 1.15rem',
            border: 'none',
            borderRadius: '9px',
            background: activeSection === 'planning' ? '#ffffff' : 'transparent',
            color: activeSection === 'planning' ? 'var(--primary, #5B4BDB)' : 'var(--text-muted, #64748b)',
            boxShadow: activeSection === 'planning' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            fontWeight: activeSection === 'planning' ? '700' : '600',
            fontSize: '0.85rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={15} /> Project Planning
        </button>
        <button
          type="button"
          onClick={() => handleTabSwitch('pending')}
          style={{
            padding: '0.5rem 1.15rem',
            border: 'none',
            borderRadius: '9px',
            background: activeSection === 'pending' ? '#ffffff' : 'transparent',
            color: activeSection === 'pending' ? 'var(--primary, #5B4BDB)' : 'var(--text-muted, #64748b)',
            boxShadow: activeSection === 'pending' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            fontWeight: activeSection === 'pending' ? '700' : '600',
            fontSize: '0.85rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Clock size={15} /> Pending Job Order Entries
          {pendingJobOrders.filter(p => p.status === 'pending').length > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#ffffff',
              padding: '1px 7px',
              borderRadius: '999px',
              fontSize: '0.72rem',
              fontWeight: '800'
            }}>
              {pendingJobOrders.filter(p => p.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {activeSection === 'planning' ? (
        <ProjectPlanning jobOrders={jobs} onRefreshJobs={fetchJobs} />
      ) : activeSection === 'pending' ? (
        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
          {/* Top Bar for Pending Entries */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, maxWidth: '420px' }}>
              <SearchBar
                value={pendingSearchQuery}
                onChange={setPendingSearchQuery}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Filter Pills */}
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.04)', padding: '3px', borderRadius: '8px', gap: '2px' }}>
                {['pending', 'converted', 'all'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setPendingFilterStatus(st)}
                    style={{
                      border: 'none',
                      background: pendingFilterStatus === st ? '#ffffff' : 'transparent',
                      color: pendingFilterStatus === st ? 'var(--primary, #5B4BDB)' : 'var(--text-muted, #64748b)',
                      fontWeight: pendingFilterStatus === st ? '700' : '500',
                      fontSize: '0.78rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      boxShadow: pendingFilterStatus === st ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    {st === 'pending' ? `Pending (${pendingJobOrders.filter(p => p.status === 'pending').length})` : st}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="btn glass-panel"
                onClick={fetchPendingJobOrders}
                title="Refresh Pending Entries"
                style={{ padding: '0.45rem 0.65rem' }}
              >
                <RefreshCw size={14} className={pendingJobsLoading ? 'animate-spin' : ''} />
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleOpenModal()}
                title="Open Create Job Order Form"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <Plus size={15} /> Create Job Directly
              </button>
            </div>
          </div>

          {/* Table / List */}
          {pendingJobsLoading ? (
            <SkeletonLoader rows={5} columns={6} />
          ) : pendingJobOrders.filter(p => {
              if (pendingFilterStatus !== 'all' && p.status !== pendingFilterStatus) return false
              if (!pendingSearchQuery.trim()) return true
              const q = pendingSearchQuery.toLowerCase()
              return (
                p.title?.toLowerCase().includes(q) ||
                p.customer_name?.toLowerCase().includes(q) ||
                p.description?.toLowerCase().includes(q)
              )
            }).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <Clock size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)' }}>
                No Pending Job Order Entries
              </div>
              <p style={{ fontSize: '0.82rem', maxWidth: '400px', margin: '0.35rem auto 1.25rem' }}>
                Rough job order entries logged from Cashbook (Cash In / Customer Credit) will automatically appear here for formalization into official Job Orders.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleOpenModal()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1.15rem',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <Plus size={15} /> Create Job Order Directly
              </button>
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Customer</th>
                    <th>Job Name</th>
                    <th>Description</th>
                    <th>Deposit Received</th>
                    <th>Status</th>
                    <th>Logged By</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingJobOrders
                    .filter(p => {
                      if (pendingFilterStatus !== 'all' && p.status !== pendingFilterStatus) return false
                      if (!pendingSearchQuery.trim()) return true
                      const q = pendingSearchQuery.toLowerCase()
                      return (
                        p.title?.toLowerCase().includes(q) ||
                        p.customer_name?.toLowerCase().includes(q) ||
                        p.description?.toLowerCase().includes(q)
                      )
                    })
                    .map((item) => (
                      <tr key={item.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td style={{ fontWeight: '700' }}>
                          <div>{item.customer_name || `Customer #${item.customer}`}</div>
                          {item.customer_phone && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                              {item.customer_phone}
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: '700', color: 'var(--primary, #5B4BDB)' }}>
                          {item.title}
                        </td>
                        <td style={{ maxWidth: '280px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <div>{item.description || <span style={{ opacity: 0.5 }}>—</span>}</div>
                          {item.attachment && (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginTop: '6px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(91, 75, 219, 0.08)',
                              border: '1px solid rgba(91, 75, 219, 0.2)',
                              flexWrap: 'wrap'
                            }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.74rem',
                                  fontWeight: '600',
                                  color: 'var(--primary, #5B4BDB)',
                                  maxWidth: '130px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={item.attachment_name || 'Attached file'}
                              >
                                <Paperclip size={12} />
                                {item.attachment_name || (item.attachment_type?.includes('pdf') ? 'Document.pdf' : 'Image.jpg')}
                              </span>

                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid rgba(91, 75, 219, 0.25)', paddingLeft: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAttachmentPreview(item.attachment, item.attachment_name, item.attachment_type)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: '600',
                                    background: 'rgba(91, 75, 219, 0.15)',
                                    color: 'var(--primary, #5B4BDB)',
                                    border: '1px solid rgba(91, 75, 219, 0.25)',
                                    cursor: 'pointer'
                                  }}
                                  title="View File"
                                >
                                  <LucideEye size={12} /> View
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDownloadAttachment(item.attachment, item.attachment_name, item.attachment_type)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: '600',
                                    background: '#16a34a',
                                    color: '#ffffff',
                                    border: '1px solid #15803d',
                                    cursor: 'pointer'
                                  }}
                                  title="Download File"
                                >
                                  <Download size={12} /> Download
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: '800', color: '#16a34a' }}>
                          {(parseFloat(item.initial_deposit) || 0) > 0 ? (
                            `${(parseFloat(item.initial_deposit)).toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR`
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>0.00 SAR</span>
                          )}
                        </td>
                        <td>
                          {item.status === 'pending' ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#dc2626',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: '700'
                            }}>
                              <Clock size={11} /> Pending Creation
                            </span>
                          ) : item.status === 'converted' ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(34, 197, 94, 0.12)',
                              color: '#15803d',
                              border: '1px solid rgba(34, 197, 94, 0.25)',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: '700'
                            }}>
                              <CheckCircle2 size={11} /> Converted {item.converted_job_order_id ? `(${item.converted_job_order_id})` : ''}
                            </span>
                          ) : (
                            <span style={{
                              background: 'rgba(0,0,0,0.06)',
                              color: 'var(--text-muted)',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: '600'
                            }}>
                              Cancelled
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {item.created_by_name || 'System'}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {item.status === 'pending' ? (
                            <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => handleCreateFromPending(item)}
                                title="Open Create Form populated with this entry"
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  fontSize: '0.78rem',
                                  fontWeight: '600',
                                  borderRadius: '8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem'
                                }}
                              >
                                <Plus size={13} /> Create Job Order
                              </button>
                              <button
                                type="button"
                                className="btn"
                                onClick={() => handleDismissPending(item.id)}
                                title="Dismiss rough entry"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.78rem',
                                  borderRadius: '8px',
                                  color: '#dc2626',
                                  border: '1px solid rgba(220, 38, 38, 0.2)'
                                }}
                              >
                                Dismiss
                              </button>
                            </div>
                          ) : item.status === 'converted' && item.converted_job ? (
                            <button
                              type="button"
                              className="btn glass-panel"
                              onClick={() => {
                                const j = jobs.find(job => job.id === item.converted_job)
                                if (j) handleOpenModal(j)
                                else handleTabSwitch('orders')
                              }}
                              style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontWeight: '600' }}
                            >
                              View Job #{item.converted_job_order_id || item.converted_job}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Admin Job Order Tabs & Staff Filter Toolbar */}
          {isAdmin && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1rem',
              padding: '0.5rem 0.75rem',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(0,0,0,0.04)', padding: '0.25rem', borderRadius: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setAdminTab('my'); setPage(1); }}
                  style={{
                    padding: '0.45rem 1rem',
                    border: 'none',
                    borderRadius: '8px',
                    background: adminTab === 'my' ? '#ffffff' : 'transparent',
                    color: adminTab === 'my' ? 'var(--primary, #5B4BDB)' : 'var(--text-muted, #64748b)',
                    fontWeight: adminTab === 'my' ? '700' : '600',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: adminTab === 'my' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Briefcase size={14} /> My Job Orders
                </button>

                <button
                  type="button"
                  onClick={() => { setAdminTab('assigned'); setPage(1); }}
                  style={{
                    padding: '0.45rem 1rem',
                    border: 'none',
                    borderRadius: '8px',
                    background: adminTab === 'assigned' ? '#ffffff' : 'transparent',
                    color: adminTab === 'assigned' ? 'var(--primary, #5B4BDB)' : 'var(--text-muted, #64748b)',
                    fontWeight: adminTab === 'assigned' ? '700' : '600',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: adminTab === 'assigned' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <User size={14} /> Assigned Job Orders
                  {pendingAssignedCount > 0 && (
                    <span style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      padding: '1px 7px',
                      borderRadius: '999px',
                      fontSize: '0.7rem',
                      fontWeight: '800'
                    }}>
                      {pendingAssignedCount}
                    </span>
                  )}
                </button>
              </div>

              {adminTab === 'assigned' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Staff Filter:
                  </span>
                  <button
                    type="button"
                    onClick={() => { setAssignedStaffFilter('all'); setPage(1); }}
                    style={{
                      padding: '0.25rem 0.7rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      border: assignedStaffFilter === 'all' ? '1px solid var(--primary, #5B4BDB)' : '1px solid #e2e8f0',
                      background: assignedStaffFilter === 'all' ? 'var(--primary, #5B4BDB)' : '#f8fafc',
                      color: assignedStaffFilter === 'all' ? '#ffffff' : '#475569',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    All Staff
                  </button>
                  {staffOptions.map(st => {
                    const isSel = assignedStaffFilter === st.username || String(assignedStaffFilter) === String(st.id)
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => { setAssignedStaffFilter(st.username); setPage(1); }}
                        style={{
                          padding: '0.25rem 0.7rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          border: isSel ? '1px solid var(--primary, #5B4BDB)' : '1px solid #e2e8f0',
                          background: isSel ? 'var(--primary, #5B4BDB)' : '#f8fafc',
                          color: isSel ? '#ffffff' : '#475569',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {st.name || st.username}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {isAdmin && adminTab === 'assigned' && (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontSize: '0.82rem',
              color: '#1e40af'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Incoming Assigned Job Orders:</strong> Staff members created and delegated these job orders to you. Click <strong>Accept</strong> to verify and transfer full ownership & financial ledger into your account, or <strong>Cancel</strong> to cancel the job order.
              </div>
            </div>
          )}

          {/* 4 Financial KPI Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.85rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '1rem 1.15rem',
              border: isCancelledView ? '1px solid #fecaca' : '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: isCancelledView ? '#dc2626' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {isCancelledView ? 'Cancelled Contracts' : 'Total Contracts'}
                </span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: isCancelledView ? '#fef2f2' : 'rgba(91, 75, 219, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isCancelledView ? '#dc2626' : 'var(--primary, #5B4BDB)' }}>
                  {isCancelledView ? <XCircle size={16} /> : <Briefcase size={16} />}
                </div>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: '800', color: isCancelledView ? '#dc2626' : '#0f172a', letterSpacing: '-0.02em' }}>
                {currentJobCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                {isCancelledView ? 'Terminated / Void Orders' : (selectedClientBook === 'all' ? 'All client engagements' : (customers.find(c => String(c.id) === String(selectedClientBook))?.name || 'Selected client'))}
              </div>
            </div>

            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '1rem 1.15rem',
              border: isCancelledView ? '1px solid #fed7aa' : '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: isCancelledView ? '#ea580c' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {isCancelledView ? 'Cancelled Contract Value' : 'Total Contract Value'}
                </span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: isCancelledView ? '#fff7ed' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isCancelledView ? '#ea580c' : '#2563eb' }}>
                  <FileText size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                {formatCurrency(currentTotalVal)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                {isCancelledView ? 'Void contract commitments' : 'Cumulative contract commitments'}
              </div>
            </div>

            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '1rem 1.15rem',
              border: isCancelledView ? '1px solid #fed7aa' : '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: isCancelledView ? '#ea580c' : '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {isCancelledView ? 'Money Collected' : 'Amount Collected'}
                </span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: isCancelledView ? '#fff7ed' : '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isCancelledView ? '#ea580c' : '#059669' }}>
                  <CreditCard size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: '800', color: isCancelledView ? '#ea580c' : '#059669', letterSpacing: '-0.02em' }}>
                {formatCurrency(currentTotalPaid)}
              </div>
              <div style={{ fontSize: '0.75rem', color: isCancelledView ? '#ea580c' : '#059669', marginTop: '2px' }}>
                {isCancelledView ? (currentTotalPaid > 0 ? 'Money collected from clients on cancelled jobs' : 'No money collected') : 'Payments collected to date'}
              </div>
            </div>

            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '1rem 1.15rem',
              border: (!isCancelledView && currentTotalBalance > 0) ? '1px solid #fecaca' : '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: (!isCancelledView && currentTotalBalance > 0) ? '#dc2626' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {isCancelledView ? 'Net Receivable Due' : 'Pending Balance'}
                </span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: (!isCancelledView && currentTotalBalance > 0) ? '#fef2f2' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: (!isCancelledView && currentTotalBalance > 0) ? '#dc2626' : '#64748b' }}>
                  <AlertCircle size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: '800', color: (!isCancelledView && currentTotalBalance > 0) ? '#dc2626' : '#059669', letterSpacing: '-0.02em' }}>
                {formatCurrency(currentTotalBalance)}
              </div>
              <div style={{ fontSize: '0.75rem', color: (!isCancelledView && currentTotalBalance > 0) ? '#dc2626' : '#64748b', marginTop: '2px' }}>
                {isCancelledView ? 'Cancelled orders carry 0 receivable' : (currentTotalBalance > 0 ? 'Outstanding client receivables' : 'All contracts fully settled')}
              </div>
            </div>
          </div>

          {/* Quick Client Filter Pills */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            overflowX: 'auto',
            paddingBottom: '0.4rem',
            marginBottom: '1rem',
            scrollbarWidth: 'thin'
          }}>
            <button 
              type="button"
              onClick={() => setSelectedClientBook('all')}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                border: selectedClientBook === 'all' && !isCancelledView ? '1px solid var(--primary, #5B4BDB)' : '1px solid #e2e8f0',
                background: selectedClientBook === 'all' && !isCancelledView ? 'var(--primary, #5B4BDB)' : '#ffffff',
                color: selectedClientBook === 'all' && !isCancelledView ? '#ffffff' : '#475569',
                boxShadow: selectedClientBook === 'all' && !isCancelledView ? '0 2px 6px rgba(91, 75, 219, 0.25)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              All Active Clients ({jobSummary.count || jobs.length})
            </button>
            <button 
              type="button"
              onClick={() => {
                if (filterStatus === 'Cancelled') {
                  setFilterStatus('')
                } else {
                  setFilterStatus('Cancelled')
                }
                setPage(1)
              }}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: '700',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                border: filterStatus === 'Cancelled' ? '1px solid #dc2626' : '1px solid #fecaca',
                background: filterStatus === 'Cancelled' ? '#dc2626' : '#fff1f2',
                color: filterStatus === 'Cancelled' ? '#ffffff' : '#dc2626',
                boxShadow: filterStatus === 'Cancelled' ? '0 2px 6px rgba(220, 38, 38, 0.25)' : 'none',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <XCircle size={13} />
              Cancelled Orders ({jobSummary.cancelled_summary?.count || 0})
            </button>
            {customers.map(c => {
              const isSelected = String(selectedClientBook) === String(c.id)
              const clientStat = jobSummary.by_client?.find(cl => String(cl.customer_id) === String(c.id))
              return (
                <button 
                  key={c.id} 
                  type="button"
                  onClick={() => setSelectedClientBook(String(c.id))}
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    border: isSelected ? '1px solid var(--primary, #5B4BDB)' : '1px solid #e2e8f0',
                    background: isSelected ? 'var(--primary, #5B4BDB)' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#475569',
                    boxShadow: isSelected ? '0 2px 6px rgba(91, 75, 219, 0.25)' : 'none',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  {c.name}
                  {clientStat?.count ? (
                    <span style={{
                      fontSize: '0.7rem',
                      background: isSelected ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                      color: isSelected ? '#ffffff' : '#64748b',
                      padding: '1px 6px',
                      borderRadius: '10px'
                    }}>
                      {clientStat.count}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {error && (
            <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {/* Search & Filter Panel */}
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '0.75rem 1rem',
            marginBottom: '1.15rem',
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <SearchBar 
              value={searchQuery}
              onChange={(val) => setSearchQuery(val)}
              style={{ flex: '1 1 240px', minWidth: '220px', maxWidth: 'none' }}
            />
            <div style={{ flex: '1 1 140px', minWidth: '130px' }}>
              <select 
                className="input-field" 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  height: '38px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '0.85rem'
                }}
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div style={{ flex: '1 1 140px', minWidth: '130px' }}>
              <select 
                className="input-field" 
                value={filterPayment} 
                onChange={(e) => setFilterPayment(e.target.value)}
                style={{
                  height: '38px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '0.85rem'
                }}
              >
                <option value="">All Payment States</option>
                <option value="paid">Fully Settled</option>
                <option value="unpaid">Has Balance</option>
              </select>
            </div>
            <div style={{ flex: '1 1 160px', minWidth: '150px' }}>
              <select 
                className="input-field" 
                value={`${sortField}:${sortDirection}`} 
                onChange={(e) => {
                  const [sf, sd] = e.target.value.split(':')
                  setSortField(sf)
                  setSortDirection(sd)
                  setPage(1)
                }}
                style={{
                  height: '38px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '0.85rem'
                }}
              >
                <option value="created_at:desc">Date: Newest First</option>
                <option value="created_at:asc">Date: Oldest First</option>
                <option value="order_id:asc">Contract ID: A-Z / 1-9</option>
                <option value="order_id:desc">Contract ID: Z-A / 9-1</option>
                <option value="total_amount:desc">Total Val: High to Low</option>
                <option value="total_amount:asc">Total Val: Low to High</option>
                <option value="title:asc">Title: A to Z</option>
                <option value="title:desc">Title: Z to A</option>
                <option value="customer:asc">Client: A to Z</option>
                <option value="customer:desc">Client: Z to A</option>
                <option value="status:asc">Status: A to Z</option>
              </select>
            </div>
            {(searchQuery || filterStatus || filterPayment || selectedClientBook !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setFilterStatus('')
                  setFilterPayment('')
                  setSelectedClientBook('all')
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '6px 10px',
                  borderRadius: '6px'
                }}
              >
                Clear Filters
              </button>
            )}
          </div>


      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
        marginBottom: '1.5rem'
      }}>
        {loading ? (
          <div style={{ padding: '1.5rem' }}>
            <SkeletonLoader type="table" />
          </div>
        ) : (
          <>
            {jobs.length === 0 && !error && (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Briefcase size={36} style={{ color: '#cbd5e1', margin: '0 auto 0.75rem', display: 'block' }} />
                <div style={{ fontWeight: '700', fontSize: '1rem', color: '#334155', marginBottom: '0.25rem' }}>
                  No Job Orders Found
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {selectedClientBook !== 'all' 
                    ? `No job orders found for ${customers.find(c => String(c.id) === String(selectedClientBook))?.name || 'this client'}.`
                    : (searchQuery ? `No contracts match "${searchQuery}".` : 'No job orders on record yet. Click "+ New Job Order" to create one.')}
                </div>
              </div>
            )}

            {jobs.length > 0 && (
              <>
                {/* Desktop Table View */}
                <div className="desktop-only-table">
                  <div className="table-container" style={{ margin: 0, border: 'none' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th 
                            onClick={() => handleSort('order_id')}
                            style={{ cursor: 'pointer', userSelect: 'none', padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}
                            title="Sort by Contract ID"
                          >
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: sortField === 'order_id' ? 'var(--primary, #5B4BDB)' : 'inherit' }}>
                              Contract ID
                              {sortField === 'order_id' ? (
                                sortDirection === 'asc' ? <ArrowUp size={13} color="var(--primary, #5B4BDB)" /> : <ArrowDown size={13} color="var(--primary, #5B4BDB)" />
                              ) : (
                                <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort('title')}
                            style={{ cursor: 'pointer', userSelect: 'none', padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}
                            title="Sort by Title"
                          >
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: sortField === 'title' ? 'var(--primary, #5B4BDB)' : 'inherit' }}>
                              Engagement Title
                              {sortField === 'title' ? (
                                sortDirection === 'asc' ? <ArrowUp size={13} color="var(--primary, #5B4BDB)" /> : <ArrowDown size={13} color="var(--primary, #5B4BDB)" />
                              ) : (
                                <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort('customer')}
                            style={{ cursor: 'pointer', userSelect: 'none', padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}
                            title="Sort by Client"
                          >
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: sortField === 'customer' ? 'var(--primary, #5B4BDB)' : 'inherit' }}>
                              Associated Client
                              {sortField === 'customer' ? (
                                sortDirection === 'asc' ? <ArrowUp size={13} color="var(--primary, #5B4BDB)" /> : <ArrowDown size={13} color="var(--primary, #5B4BDB)" />
                              ) : (
                                <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort('status')}
                            style={{ cursor: 'pointer', userSelect: 'none', padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}
                            title="Sort by Status"
                          >
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: sortField === 'status' ? 'var(--primary, #5B4BDB)' : 'inherit' }}>
                              Operational Status
                              {sortField === 'status' ? (
                                sortDirection === 'asc' ? <ArrowUp size={13} color="var(--primary, #5B4BDB)" /> : <ArrowDown size={13} color="var(--primary, #5B4BDB)" />
                              ) : (
                                <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort('total_amount')}
                            style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none', padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}
                            title="Sort by Total Value"
                          >
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', color: sortField === 'total_amount' ? 'var(--primary, #5B4BDB)' : 'inherit', width: '100%' }}>
                              Total Val.
                              {sortField === 'total_amount' ? (
                                sortDirection === 'asc' ? <ArrowUp size={13} color="var(--primary, #5B4BDB)" /> : <ArrowDown size={13} color="var(--primary, #5B4BDB)" />
                              ) : (
                                <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                              )}
                            </div>
                          </th>
                          <th style={{ textAlign: 'right', padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>Paid</th>
                          <th style={{ textAlign: 'right', padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>Balance</th>
                          {customColumns.map(col => (
                            <th key={col.id} style={{ whiteSpace: 'nowrap', padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>
                              {col.label}
                            </th>
                          ))}
                          <th style={{ textAlign: 'center', padding: '0.85rem 1rem', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                    {jobs.map(job => (
                      <tr 
                        key={job.id}
                        className="hover-row"
                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                        onClick={() => handleOpenModal(job)}
                      >
                        <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            fontWeight: '700', 
                            color: '#4f46e5', 
                            background: '#eef2ff', 
                            padding: '3px 8px', 
                            borderRadius: '6px', 
                            fontSize: '0.8rem',
                            letterSpacing: '0.02em',
                            border: '1px solid #e0e7ff'
                          }}>
                            {job.order_id || `JOB${job.id.toString().padStart(4, '0')}`}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', maxWidth: '300px' }}>
                          <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.88rem', lineHeight: 1.35 }}>{job.title}</div>
                          {getLinkedProjectTitle(job) && (
                            <div style={{ marginTop: '4px' }}>
                              <span style={{ 
                                display: 'inline-flex', alignItems: 'center', gap: '0.3rem', 
                                fontSize: '0.72rem', fontWeight: '600', color: '#4338ca', 
                                background: '#e0e7ff', padding: '2px 7px', borderRadius: '4px' 
                              }}>
                                <Folder size={11} /> {getLinkedProjectTitle(job)}
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>
                          <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.85rem' }}>{job.customer_name}</div>
                          {job.created_by_name && (
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '2px' }}>
                              <User size={11} /> <span>{job.created_by_name}</span>
                            </div>
                          )}
                          {job.assigned_by_name && (
                            <div style={{ fontSize: '0.72rem', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '2px', fontWeight: '600' }}>
                              <span>Assigned by {job.assigned_by_name}</span>
                            </div>
                          )}
                          {job.payment_collected_by && (
                            <div style={{ fontSize: '0.72rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '2px', fontWeight: '600' }}>
                              <CreditCard size={11} /> <span>Collected: {job.payment_collected_by}</span>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.3rem 0.65rem', 
                            borderRadius: '20px', 
                            fontSize: '0.74rem', 
                            fontWeight: '700',
                            backgroundColor: `${getStatusColor(job.status)}12`, 
                            color: getStatusColor(job.status),
                            border: `1px solid ${getStatusColor(job.status)}30`,
                            letterSpacing: '0.02em'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: getStatusColor(job.status) }}></span>
                            {job.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.88rem' }}>{formatCurrency(job.total_amount)}</div>
                          {parseFloat(job.total_cost || 0) > 0 && (
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '500', marginTop: '2px' }}>
                              Cost: {formatCurrency(job.total_cost)}
                              {job.margin_percentage !== undefined && (
                                <span style={{ 
                                  marginLeft: '4px', 
                                  fontWeight: '700',
                                  color: (job.margin_percentage || 0) >= 20 ? '#16a34a' : ((job.margin_percentage || 0) >= 0 ? '#d97706' : '#dc2626')
                                }}>
                                  ({job.margin_percentage}%)
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: '700', color: '#16a34a', fontSize: '0.88rem' }}>{formatCurrency(job.paid_amount)}</div>
                          {parseFloat(job.advance_amount || 0) > 0 && (
                            <div style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: '600', marginTop: '1px' }} title="Advance paid at job creation">
                              Adv: {formatCurrency(job.advance_amount)}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                          {job.status === 'Cancelled' ? (
                            <div>
                              <div style={{ fontWeight: '800', color: '#64748b', fontSize: '0.8rem', letterSpacing: '0.02em' }}>
                                CANCELLED
                              </div>
                              {parseFloat(job.paid_amount || 0) > 0 ? (
                                <div style={{ fontSize: '0.72rem', color: '#ea580c', fontWeight: '700', marginTop: '2px' }} title="Money collected from customer on this cancelled contract">
                                  Money Collected: {formatCurrency(job.paid_amount)}
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '1px' }}>
                                  No Due (SAR 0.00)
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <div style={{ fontWeight: '800', color: job.balance > 0 ? '#dc2626' : '#16a34a', fontSize: '0.88rem' }}>
                                {job.balance > 0 ? formatCurrency(job.balance) : 'SETTLED'}
                              </div>
                              {parseFloat(job.prior_balance || 0) > 0 && (
                                <div style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: '600', marginTop: '1px' }} title="Prior outstanding carried forward">
                                  + Prior: {formatCurrency(job.prior_balance)}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        {customColumns.map(col => (
                          <td key={col.id} style={{ color: '#334155', fontSize: '0.85rem', padding: '0.85rem 1rem' }}>
                            {job.custom_fields?.[col.name] !== undefined && job.custom_fields?.[col.name] !== ''
                              ? String(job.custom_fields[col.name])
                              : '-'}
                          </td>
                        ))}
                        <td style={{ textAlign: 'center', padding: '0.85rem 1rem', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          {isAdmin && adminTab === 'assigned' ? (
                            <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center' }}>
                              <button 
                                type="button"
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  fontSize: '0.76rem',
                                  fontWeight: '700',
                                  borderRadius: '6px',
                                  background: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  cursor: 'pointer',
                                  boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)'
                                }}
                                onClick={() => handleAcceptJob(job)}
                                title="Accept & take ownership of this job order"
                              >
                                <CheckCircle2 size={13} /> Accept
                              </button>
                              <button 
                                type="button"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.76rem',
                                  fontWeight: '600',
                                  borderRadius: '6px',
                                  background: '#fff1f2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  cursor: 'pointer'
                                }}
                                onClick={() => handleCancelJob(job)}
                                title="Cancel this job order (job order ID retained)"
                              >
                                <XCircle size={13} /> Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', gap: '0.375rem', alignItems: 'center' }}>
                              <button 
                                className="btn-icon" 
                                style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569' }}
                                onClick={() => handleOpenModal(job)}
                                title="Edit Contract & Payments"
                              >
                                <Edit size={14} />
                              </button>
                              {job.status !== 'Cancelled' ? (
                                <button 
                                  className="btn-icon" 
                                  style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #fed7aa', background: '#fff7ed', color: '#ea580c' }}
                                  onClick={() => handleCancelJob(job)}
                                  title="Cancel Job Order"
                                >
                                  <XCircle size={14} />
                                </button>
                              ) : (
                                isAdmin && (
                                  <button 
                                    className="btn-icon" 
                                    style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#16a34a' }}
                                    onClick={() => handleRestoreJob(job)}
                                    title="Restore Cancelled Job Order"
                                  >
                                    <RefreshCw size={13} />
                                  </button>
                                )
                              )}
                              <button 
                                className="btn-icon" 
                                style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fff1f2', color: '#dc2626' }}
                                onClick={() => handleDelete(job.id)}
                                title="Terminate Contract"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Native Cards View (<= 768px) */}
            <div className="mobile-only-cards" style={{ padding: '0.75rem' }}>
              {jobs.map(job => {
                const total = parseFloat(job.total_amount) || 0
                const paid = parseFloat(job.paid_amount) || 0
                const balance = parseFloat(job.balance) || 0
                const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
                const orderId = job.order_id || `JOB${job.id.toString().padStart(4, '0')}`
                const sColor = getStatusColor(job.status)

                return (
                  <div 
                    key={job.id} 
                    className="mobile-entity-card"
                    onClick={() => handleOpenModal(job)}
                  >
                    <div className="mobile-card-header">
                      <div className="mobile-card-title-group">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '3px' }}>
                            <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.82rem' }}>
                              {orderId}
                            </span>
                            <span 
                              className="mobile-card-badge"
                              style={{ 
                                background: `${sColor}15`, 
                                color: sColor,
                                border: `1px solid ${sColor}30` 
                              }}
                            >
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sColor }}></span>
                              {job.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="mobile-card-title" style={{ fontSize: '0.95rem' }}>
                            {job.title}
                          </div>
                          {getLinkedProjectTitle(job) && (
                            <div style={{ marginTop: '2px', marginBottom: '3px' }}>
                              <span style={{ 
                                display: 'inline-flex', alignItems: 'center', gap: '0.25rem', 
                                fontSize: '0.7rem', fontWeight: '700', color: '#4338ca', 
                                background: '#e0e7ff', padding: '1px 6px', borderRadius: '4px' 
                              }}>
                                <Folder size={10} /> {getLinkedProjectTitle(job)}
                              </span>
                            </div>
                          )}
                          <div className="mobile-card-sub">
                            <span style={{ fontWeight: '600', color: '#1e293b' }}>{job.customer_name}</span>
                            {job.created_by_name && <span>&bull; {job.created_by_name}</span>}
                            {job.assigned_by_name && (
                              <span style={{ color: '#7c3aed', fontWeight: '700' }}>&bull; Assigned by {job.assigned_by_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mobile-card-progress">
                      <div 
                        className="mobile-card-progress-fill" 
                        style={{ width: `${pct}%`, background: balance <= 0 ? '#16a34a' : '#1366d9' }} 
                      />
                    </div>

                    <div className="mobile-card-grid">
                      <div className="mobile-card-metric">
                        <span className="mobile-card-metric-label">Total Val</span>
                        <span className="mobile-card-metric-value">{formatCurrency(total)}</span>
                        {parseFloat(job.total_cost || 0) > 0 && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '1px' }}>
                            Cost: {formatCurrency(job.total_cost)}
                          </span>
                        )}
                      </div>
                      <div className="mobile-card-metric">
                        <span className="mobile-card-metric-label">Paid ({pct}%)</span>
                        <span className="mobile-card-metric-value" style={{ color: '#16a34a' }}>{formatCurrency(paid)}</span>
                        {parseFloat(job.advance_amount || 0) > 0 && (
                          <span style={{ fontSize: '0.65rem', color: '#16a34a', display: 'block', marginTop: '1px' }}>
                            Adv: {formatCurrency(job.advance_amount)}
                          </span>
                        )}
                      </div>
                      <div className="mobile-card-metric">
                        <span className="mobile-card-metric-label">Balance</span>
                        {job.status === 'Cancelled' ? (
                          <>
                            <span className="mobile-card-metric-value" style={{ color: '#64748b' }}>
                              CANCELLED
                            </span>
                            {parseFloat(job.paid_amount || 0) > 0 && (
                              <span style={{ fontSize: '0.65rem', color: '#ea580c', display: 'block', fontWeight: '700', marginTop: '1px' }}>
                                Collected: {formatCurrency(job.paid_amount)}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="mobile-card-metric-value" style={{ color: balance > 0 ? '#dc2626' : '#16a34a' }}>
                              {balance > 0 ? formatCurrency(balance) : 'SETTLED'}
                            </span>
                            {parseFloat(job.prior_balance || 0) > 0 && (
                              <span style={{ fontSize: '0.65rem', color: '#b45309', display: 'block', marginTop: '1px' }}>
                                + Prior: {formatCurrency(job.prior_balance)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mobile-card-footer" onClick={(e) => e.stopPropagation()}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Tap card to open contract details & ledger
                      </div>
                      <div className="mobile-card-actions">
                        {isAdmin && adminTab === 'assigned' ? (
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <button 
                              style={{
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.76rem',
                                fontWeight: '700',
                                borderRadius: '6px',
                                background: '#16a34a',
                                color: '#fff',
                                border: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleAcceptJob(job)}
                            >
                              <CheckCircle2 size={13} /> Accept
                            </button>
                            <button 
                              style={{
                                padding: '0.35rem 0.65rem',
                                fontSize: '0.76rem',
                                fontWeight: '600',
                                borderRadius: '6px',
                                background: '#fff1f2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleCancelJob(job)}
                            >
                              <XCircle size={13} /> Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button 
                              className="mobile-card-action-btn" 
                              onClick={() => handleOpenModal(job)}
                              title="Edit Contract & Payments"
                            >
                              <Edit size={14} />
                            </button>
                            {job.status !== 'Cancelled' ? (
                              <button 
                                className="mobile-card-action-btn" 
                                style={{ color: '#ea580c' }}
                                onClick={() => handleCancelJob(job)}
                                title="Cancel Job Order"
                              >
                                <XCircle size={14} />
                              </button>
                            ) : (
                              isAdmin && (
                                <button 
                                  className="mobile-card-action-btn" 
                                  style={{ color: '#16a34a' }}
                                  onClick={() => handleRestoreJob(job)}
                                  title="Restore Cancelled Job Order"
                                >
                                  <RefreshCw size={14} />
                                </button>
                              )
                            )}
                            <button 
                              className="mobile-card-action-btn delete" 
                              onClick={() => handleDelete(job.id)}
                              title="Terminate Contract"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Integrated Table Footer */}
            {(() => {
              const activeClientStat = jobSummary.by_client?.find(cl => String(cl.customer_id) === String(selectedClientBook))
              const currentJobCount = selectedClientBook === 'all' ? (jobSummary.count || jobs.length) : (activeClientStat?.count || jobs.length)

              return (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.25rem',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '0.82rem',
                  color: '#64748b',
                  flexWrap: 'wrap',
                  gap: '0.85rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Briefcase size={15} color="#6366f1" />
                    <span>Showing <strong>{jobs.length}</strong> of <strong>{currentJobCount}</strong> job orders</span>
                    {selectedClientBook !== 'all' && (
                      <span style={{ color: '#475569', fontWeight: '600' }}>
                        &bull; Client: {customers.find(c => String(c.id) === String(selectedClientBook))?.name || 'Selected'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}

            {totalPages > 1 && (
              <div className="pagination" style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: '#ffffff' }}>
                <button 
                  className="btn" 
                  disabled={page === 1}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: page === 1 ? '#f8fafc' : '#ffffff',
                    color: page === 1 ? '#94a3b8' : '#334155',
                    cursor: page === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Previous
                </button>
                <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.75rem', fontSize: '0.82rem', color: '#64748b', fontWeight: '500' }}>
                  Page {page} of {totalPages}
                </span>
                <button 
                  className="btn" 
                  disabled={page === totalPages}
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: page === totalPages ? '#f8fafc' : '#ffffff',
                    color: page === totalPages ? '#94a3b8' : '#334155',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
          </>
        )}
      </div>
        </>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setSubmitting(false); setSelectedPendingForCreation(null); }} 
        title={editingJob ? `Contract ${editingJob.order_id || editingJob.id}` : selectedPendingForCreation ? `Convert Pending Entry: ${selectedPendingForCreation.title || ''}` : 'Create New Job Order'}
        maxWidth="780px"
      >
        <div className="job-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Main Job Order Form */}
          <form onSubmit={handleSubmit} className="form-grid">
            {formError && <div className="error-message col-span-2">{formError}</div>}
            
            {selectedPendingForCreation && (
              <div className="col-span-2" style={{
                background: 'rgba(91, 75, 219, 0.08)',
                border: '1px solid rgba(91, 75, 219, 0.25)',
                borderRadius: '8px',
                padding: '0.65rem 0.9rem',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                color: 'var(--primary, #5B4BDB)'
              }}>
                <Clock size={16} />
                <span>
                  Converting rough entry <strong>{selectedPendingForCreation.title}</strong> into an official Job Order.
                  {(parseFloat(selectedPendingForCreation.initial_deposit) || 0) > 0 && (
                    <> Initial deposit of <strong>{(parseFloat(selectedPendingForCreation.initial_deposit)).toLocaleString()} SAR</strong> is pre-filled as Advance.</>
                  )}
                </span>
              </div>
            )}
            
            <div className="form-group col-span-2">
              <label>Job Title / Subject *</label>
              <CreatableSelect
                isClearable
                options={jobTitles.map(t => ({ label: t, value: t }))}
                value={formData.title ? { label: formData.title, value: formData.title } : null}
                onChange={(selected) => setFormData({...formData, title: selected ? selected.value : ''})}
                onInputChange={(val) => { if (val) setFormData(prev => ({...prev, title: val})) }}
                noOptionsMessage={({ inputValue }) => inputValue ? `Press Enter to use "${inputValue}"` : 'Type to add a title'}
                formatCreateLabel={(val) => `Use "${val}"`}
                components={{ Option: CustomTitleOption }}
                styles={{
                  control: (base) => ({ ...base, borderColor: 'var(--border-color)', padding: '2px', borderRadius: '8px', minHeight: '42px' }),
                  menu: (base) => ({ ...base, zIndex: 999999 }),
                  menuPortal: (base) => ({ ...base, zIndex: 999999 })
                }}
                menuPosition="fixed"
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
              />
            </div>

            <div className="form-group col-span-2">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Folder size={15} style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: '700' }}>Linked Project / Specific Project</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Directly links Job Order to Project Planning)</span>
              </label>
              <CreatableSelect
                isClearable
                options={projectOptions.map(p => ({ label: p, value: p }))}
                value={formData.project_name ? { label: formData.project_name, value: formData.project_name } : null}
                onChange={(selected) => setFormData({...formData, project_name: selected ? selected.value : ''})}
                onInputChange={(val) => { if (val) setFormData(prev => ({...prev, project_name: val})) }}
                formatCreateLabel={(val) => `Link to Project "${val}"`}
                styles={{
                  control: (base) => ({ ...base, borderColor: 'var(--border-color)', padding: '2px', borderRadius: '8px', minHeight: '42px' }),
                  menu: (base) => ({ ...base, zIndex: 999999 }),
                  menuPortal: (base) => ({ ...base, zIndex: 999999 })
                }}
                menuPosition="fixed"
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
              />
            </div>
            
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label>Client / Customer *</label>
                <button type="button" onClick={() => setIsCustomerModalOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', padding: 0 }}>
                  <UserPlus size={14} /> New
                </button>
              </div>
              <Select
                isClearable
                options={customers.map(c => ({ label: c.name, value: c.id }))}
                value={formData.customer ? { label: customers.find(c => String(c.id) === String(formData.customer))?.name || '', value: formData.customer } : null}
                onChange={(selected) => {
                  const newCustomerId = selected ? selected.value : ''
                  setFormData({...formData, customer: newCustomerId})
                  // 4.3 — fetch prior balance only for new jobs
                  if (!editingJob) fetchCustomerPriorBalance(newCustomerId)
                }}
                noOptionsMessage={() => 'No customers found'}
                styles={{
                  control: (base) => ({ ...base, borderColor: 'var(--border-color)', padding: '2px', borderRadius: '8px', minHeight: '42px' }),
                  menu: (base) => ({ ...base, zIndex: 999999 }),
                  menuPortal: (base) => ({ ...base, zIndex: 999999 })
                }}
                menuPosition="fixed"
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
              />
              {/* 4.3 — Prior balance warning for new jobs */}
              {!editingJob && formData.customer && customerPriorBalance > 0 && (
                <div style={{
                  marginTop: '0.5rem', padding: '0.6rem 0.85rem',
                  background: '#fef9c3', border: '1px solid #fde68a',
                  borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1rem' }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#92400e' }}>Prior Outstanding Balance</div>
                    <div style={{ fontSize: '0.75rem', color: '#b45309' }}>
                      This customer has <strong>{formatCurrency(customerPriorBalance)}</strong> outstanding from previous jobs.
                      This will be carried forward and added to this job's grand total.
                    </div>
                  </div>
                </div>
              )}
              {editingJob && parseFloat(editingJob.prior_balance || 0) > 0 && (
                <div style={{
                  marginTop: '0.5rem', padding: '0.6rem 0.85rem',
                  background: '#fef3c7', border: '1px solid #fde68a',
                  borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1rem' }}>ℹ️</span>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#92400e' }}>Carried Forward Prior Balance</div>
                    <div style={{ fontSize: '0.75rem', color: '#b45309' }}>
                      This contract carried forward <strong>{formatCurrency(editingJob.prior_balance)}</strong> from previous engagements.
                      Total owed across contracts: <strong>{formatCurrency(editingJob.outstanding_balance ?? (parseFloat(editingJob.prior_balance) + parseFloat(editingJob.balance || 0)))}</strong>.
                    </div>
                  </div>
                </div>
              )}
              {!editingJob && formData.customer && fetchingPriorBalance && (
                <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Checking prior balance...</div>
              )}
            </div>
            
            <div className="form-group">
              <label>Assigned Vendor</label>
              <Select
                isClearable
                options={vendors.map(v => ({ label: v.name, value: v.id }))}
                value={formData.vendor ? { label: vendors.find(v => String(v.id) === String(formData.vendor))?.name || '', value: formData.vendor } : null}
                onChange={(selected) => setFormData({...formData, vendor: selected ? selected.value : ''})}
                noOptionsMessage={() => 'No vendors found'}
                styles={{
                  control: (base) => ({ ...base, borderColor: 'var(--border-color)', padding: '2px', borderRadius: '8px', minHeight: '42px' }),
                  menu: (base) => ({ ...base, zIndex: 999999 }),
                  menuPortal: (base) => ({ ...base, zIndex: 999999 })
                }}
                menuPosition="fixed"
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
              />
            </div>

            <div className="form-group">
              <label>Current Status *</label>
              <select 
                className="input-field" 
                value={formData.status} 
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                required
              >
                <option value="">-- Select Status --</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="form-group">
              <label>Estimated Total Amount</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                <span style={{ 
                  position: 'absolute', left: '12px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '700', zIndex: 1
                }}>
                  {settings?.currency || ''}
                </span>
                <input 
                  type="number" step="0.01" className="input-field" style={{ paddingLeft: '3.5rem' }}
                  value={formData.total_amount} 
                  onChange={(e) => setFormData({...formData, total_amount: e.target.value})}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
            </div>

            {/* 4.3 — Payment Type */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontWeight: '700' }}>Payment Structure</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(how customer pays)</span>
              </label>
              <select
                className="input-field"
                value={formData.payment_type || 'full'}
                onChange={(e) => setFormData({...formData, payment_type: e.target.value})}
              >
                <option value="full">Full Payment</option>
                <option value="advance">Advance + Balance Later</option>
                <option value="installment">Installments</option>
              </select>
            </div>

            {/* 4.3 — Advance Amount (shown when payment_type is advance or installment) */}
            {(formData.payment_type === 'advance' || formData.payment_type === 'installment') && (
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontWeight: '700' }}>Advance Amount Received</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(collected now)</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                  <span style={{
                    position: 'absolute', left: '12px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '700', zIndex: 1
                  }}>
                    {settings?.currency || ''}
                  </span>
                  <input
                    type="number" step="0.01" min="0" className="input-field" style={{ paddingLeft: '3.5rem' }}
                    value={formData.advance_amount || ''}
                    onChange={(e) => setFormData({...formData, advance_amount: e.target.value})}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
                {formData.advance_amount > 0 && formData.total_amount > 0 && (
                  <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.7rem', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.75rem', color: '#166534' }}>
                    ✓ Advance: <strong>{formatCurrency(formData.advance_amount)}</strong> &nbsp;·&nbsp;
                    Outstanding after advance: <strong>{formatCurrency(Math.max(0, parseFloat(formData.total_amount || 0) - parseFloat(formData.advance_amount || 0)))}</strong>
                    {customerPriorBalance > 0 && <span> + <strong>{formatCurrency(customerPriorBalance)}</strong> carried forward</span>}
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label>Invoice Number</label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.invoice_number || ''} 
                onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
              />
            </div>
            
            <div className="form-group">
              <label>Quotation Number</label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.quotation_number || ''} 
                onChange={(e) => setFormData({...formData, quotation_number: e.target.value})}
              />
            </div>

            {/* Created By & Payment Collected By Fields */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontWeight: '700' }}>Created By</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Staff member)</span>
              </label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.created_by_staff || ''} 
                onChange={(e) => setFormData({...formData, created_by_staff: e.target.value})}
                list="staff-options-list"
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontWeight: '700' }}>Payment Collected By</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Staff member)</span>
              </label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.payment_collected_by || ''} 
                onChange={(e) => setFormData({...formData, payment_collected_by: e.target.value})}
                list="staff-options-list"
              />
            </div>

            <datalist id="staff-options-list">
              {staffOptions.map((s, idx) => (
                <option key={idx} value={s.name}>{s.username}</option>
              ))}
            </datalist>

            {/* Assign to Admin (Staff delegation to Nizam, Shuhaib, or any Admin) */}
            <div className="form-group" style={{
              background: '#f8fafc',
              padding: '0.85rem',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              marginTop: '0.25rem',
              marginBottom: '0.75rem'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
                <span style={{ fontWeight: '700', color: '#1e293b' }}>Assign to Admin</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Send to Admin for review & ownership transfer)</span>
              </label>
              <select 
                className="input-field" 
                value={formData.assigned_to || ''} 
                onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                style={{ background: '#ffffff' }}
              >
                <option value="">-- No Admin Assigned (Keep with creator) --</option>
                {assignableAdmins.map(adm => (
                  <option key={adm.id} value={adm.id}>
                    {adm.name} ({adm.username})
                  </option>
                ))}
              </select>
              {formData.assigned_to ? (
                <div style={{ marginTop: '0.45rem', fontSize: '0.75rem', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '0.4rem', lineHeight: 1.35 }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>
                    When accepted by this Admin, full ownership and all financial calculations/transactions will sit under their account.
                  </span>
                </div>
              ) : (
                <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: '#64748b' }}>
                  Select an Admin (e.g. Nizam, Shuhaib) if you want them to review, accept, and take ownership of this contract.
                </div>
              )}
            </div>

            {/* Scope of Work / Multiple Descriptions */}
            <div className="form-group col-span-2">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <label style={{ margin: 0, fontWeight: '700' }}>Scope of Work / Description</label>
                <button 
                  type="button" 
                  onClick={handleAddDescription} 
                  style={{ 
                    background: 'rgba(59, 130, 246, 0.08)', 
                    border: '1px solid rgba(59, 130, 246, 0.25)', 
                    color: 'var(--primary, #2563eb)', 
                    fontSize: '0.8rem', 
                    fontWeight: '700',
                    borderRadius: '6px',
                    padding: '0.35rem 0.75rem',
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.35rem',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary, #2563eb)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'; e.currentTarget.style.color = 'var(--primary, #2563eb)' }}
                >
                  <Plus size={14} /> Add Description Item
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {descriptions.map((desc, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      minWidth: '28px', height: '28px', borderRadius: '50%',
                      backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.75rem',
                      fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid #e2e8f0', flexShrink: 0
                    }}>
                      {idx + 1}
                    </div>
                    <input
                      type="text"
                      className="input-field"
                      value={desc}
                      onChange={(e) => handleDescriptionChange(idx, e.target.value)}
                    />
                    {descriptions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDescription(idx)}
                        title="Remove this item"
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: 'var(--danger, #ef4444)',
                          cursor: 'pointer',
                          padding: '0.55rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.color = 'var(--danger, #ef4444)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Contract ID — sequence ID (e.g. JOB0012) */}
            <div className="form-group">
              <label>Contract ID *</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span
                  style={{
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg-main, #f1f5f9)',
                    border: '1px solid var(--border-color)',
                    borderRight: 'none',
                    borderRadius: '8px 0 0 8px',
                    fontWeight: '800',
                    fontSize: '0.85rem',
                    color: 'var(--primary, #2563eb)',
                    userSelect: 'none'
                  }}
                >
                  {contractPrefix || 'JOB'}
                </span>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ borderRadius: '0 8px 8px 0', borderLeft: '1px solid var(--border-color)' }}
                  value={contractNumber} 
                  placeholder="0012"
                  onChange={(e) => {
                    const clean = e.target.value.replace(/^[A-Za-z]+/i, '').replace(/[^\d]/g, '')
                    setContractNumber(clean)
                  }}
                  required
                />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Full Contract ID: <strong style={{ color: 'var(--primary, #2563eb)', fontWeight: '800' }}>{(contractPrefix || 'JOB').replace(/^#+/, '')}{contractNumber ? contractNumber.padStart(4, '0') : '????'}</strong>
              </div>
            </div>

            {/* Dynamic Custom Form Fields */}
            <div className="col-span-2">
              <DynamicCustomFields
                formType="job_order"
                values={formData.custom_fields || {}}
                onChange={(fieldName, val) => {
                  setFormData(prev => ({
                    ...prev,
                    custom_fields: {
                      ...(prev.custom_fields || {}),
                      [fieldName]: val
                    }
                  }))
                }}
              />
            </div>

            {/* Attachment / File Upload Section */}
            <div className="col-span-2" style={{ marginTop: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '0.45rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-main)', fontWeight: '700', fontSize: '0.85rem' }}>
                  <Paperclip size={14} style={{ color: 'var(--primary, #5B4BDB)' }} />
                  Attach File (Image or PDF)
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Supports PDF, JPG, PNG up to 10MB</span>
              </div>

              {!formData.attachment ? (
                <label style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1.25rem',
                  borderRadius: '10px',
                  border: '2px dashed var(--border-color)',
                  background: 'var(--bg-card, #f8fafc)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                  gap: '0.35rem'
                }}>
                  <input 
                    type="file" 
                    accept="image/*,.pdf,application/pdf"
                    onChange={handleAttachmentChange}
                    style={{ display: 'none' }}
                  />
                  <UploadCloud size={26} style={{ color: 'var(--primary, #5B4BDB)' }} />
                  <div style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    Click to upload document or image
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Signed contract, quotation copy, drawings or work order photo
                  </div>
                </label>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card, #f1f5f9)',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
                    {formData.attachment_type?.includes('pdf') || formData.attachment_name?.toLowerCase().endsWith('.pdf') ? (
                      <FileText size={24} style={{ color: '#ef4444', flexShrink: 0 }} />
                    ) : (
                      <img 
                        src={formData.attachment} 
                        alt="Preview" 
                        style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)', flexShrink: 0 }} 
                      />
                    )}
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {formData.attachment_name || 'Attached File'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {formData.attachment_type?.includes('pdf') ? 'PDF Document' : 'Image File'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const w = window.open('')
                        if (formData.attachment_type?.includes('pdf') || formData.attachment_name?.toLowerCase().endsWith('.pdf')) {
                          w.document.write(`<iframe src="${formData.attachment}" style="width:100%;height:100%;border:none;"></iframe>`)
                        } else {
                          w.document.write(`<img src="${formData.attachment}" style="max-width:100%;height:auto;display:block;margin:auto;" />`)
                        }
                      }}
                      title="Preview File"
                      className="btn"
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.74rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <LucideEye size={13} /> Preview
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      title="Remove File"
                      className="btn"
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.74rem',
                        color: '#ef4444',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-2 job-form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
              <div>
                {editingJob && editingJob.status !== 'Cancelled' && (
                  <button 
                    type="button" 
                    className="btn" 
                    style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600', fontSize: '0.82rem' }}
                    onClick={() => handleCancelJob(editingJob)}
                  >
                    <XCircle size={15} /> Cancel This Job Order
                  </button>
                )}
                {editingJob && editingJob.status === 'Cancelled' && isAdmin && (
                  <button 
                    type="button" 
                    className="btn" 
                    style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600', fontSize: '0.82rem' }}
                    onClick={() => handleRestoreJob(editingJob)}
                  >
                    <RefreshCw size={15} /> Restore Job Order
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn" onClick={() => { setIsModalOpen(false); setSubmitting(false) }}>Close</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }}></span>
                      Processing...
                    </span>
                  ) : (editingJob ? 'Update Contract' : 'Create Job Order')}
                </button>
              </div>
            </div>
          </form>

          {/* Pricing & Profitability Structure (UPDATE 3.6) */}
          {(() => {
            const purchaseExpensesLive = expenses
              .filter(e => {
                const cat = (e.category || '').toLowerCase()
                return !cat.includes('labor') && !cat.includes('labour') && !cat.includes('vendor') && !cat.includes('subcontractor')
              })
              .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)

            const laborExpensesLive = expenses
              .filter(e => {
                const cat = (e.category || '').toLowerCase()
                return cat.includes('labor') || cat.includes('labour') || cat.includes('vendor') || cat.includes('subcontractor')
              })
              .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)

            const backendPurchase = editingJob ? parseFloat(editingJob.purchase_expenses || 0) : 0
            const backendVendorLabor = editingJob ? parseFloat(editingJob.vendor_labor_costs || 0) : 0

            const purchaseCost = Math.max(purchaseExpensesLive, backendPurchase)
            const vendorLaborCost = Math.max(laborExpensesLive, backendVendorLabor)
            const totalDirectCost = purchaseCost + vendorLaborCost
            const sellingPrice = parseFloat(formData.total_amount || (editingJob ? editingJob.total_amount : 0) || 0)
            const grossMargin = sellingPrice - totalDirectCost
            const marginPct = sellingPrice > 0 ? ((grossMargin / sellingPrice) * 100).toFixed(1) : '0.0'

            const linkedProj = formData.project_name || (editingJob ? getLinkedProjectTitle(editingJob) : '')

            return (
              <div className="glass-panel job-embedded-card" style={{ padding: '1.25rem 1.35rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main, #f8fafc)', marginTop: '-0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.1rem', fontWeight: '800' }}>
                      <Briefcase size={20} style={{ color: 'var(--primary)' }}/> Pricing &amp; Profitability Structure
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Directly tracks purchase expenses, vendor &amp; labor costs, and project margin.
                    </div>
                  </div>
                  {linkedProj ? (
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem', 
                      background: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', 
                      border: '1px solid rgba(99, 102, 241, 0.25)', 
                      padding: '0.35rem 0.85rem', borderRadius: '20px', 
                      fontSize: '0.75rem', fontWeight: '800' 
                    }}>
                      <Folder size={13} /> Project: {linkedProj}
                    </span>
                  ) : (
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem', 
                      background: 'rgba(234, 179, 8, 0.1)', color: '#b45309', 
                      border: '1px solid rgba(234, 179, 8, 0.25)', 
                      padding: '0.35rem 0.85rem', borderRadius: '20px', 
                      fontSize: '0.75rem', fontWeight: '700' 
                    }}>
                      ⚠️ No Project Linked
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
                  {/* Purchase Expenses */}
                  <div style={{ background: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
                      Purchase Expenses
                    </div>
                    <div style={{ fontWeight: '900', fontSize: '1.15rem', color: '#0369a1' }}>
                      {formatCurrency(purchaseCost)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Materials &amp; Purchases</div>
                  </div>

                  {/* Vendor & Labor Costs */}
                  <div style={{ background: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
                      Vendor / Labor
                    </div>
                    <div style={{ fontWeight: '900', fontSize: '1.15rem', color: '#b45309' }}>
                      {formatCurrency(vendorLaborCost)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Subcontracts &amp; Labour</div>
                  </div>

                  {/* Total Direct Cost */}
                  <div style={{ background: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
                      Total Direct Cost
                    </div>
                    <div style={{ fontWeight: '900', fontSize: '1.15rem', color: 'var(--danger)' }}>
                      {formatCurrency(totalDirectCost)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Purchases + Labor</div>
                  </div>

                  {/* Quoted Selling Price */}
                  <div style={{ background: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
                      Contract Price
                    </div>
                    <div style={{ fontWeight: '900', fontSize: '1.15rem', color: 'var(--text-main)' }}>
                      {formatCurrency(sellingPrice)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Quoted Selling Value</div>
                  </div>

                  {/* Gross Profit Margin */}
                  <div style={{ 
                    background: grossMargin >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)', 
                    padding: '1rem', borderRadius: '10px', 
                    border: `1px solid ${grossMargin >= 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`, 
                    boxShadow: 'var(--shadow-sm)' 
                  }}>
                    <div style={{ fontSize: '0.65rem', color: grossMargin >= 0 ? '#15803d' : '#b91c1c', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
                      Gross Margin
                    </div>
                    <div style={{ fontWeight: '900', fontSize: '1.15rem', color: grossMargin >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {formatCurrency(grossMargin)}
                    </div>
                    <div style={{ 
                      fontSize: '0.72rem', 
                      fontWeight: '800', 
                      color: Number(marginPct) >= 20 ? '#15803d' : (Number(marginPct) >= 0 ? '#b45309' : '#b91c1c'), 
                      marginTop: '0.2rem' 
                    }}>
                      {marginPct}% Margin
                    </div>
                  </div>
                </div>

                {/* Visual Absorption & Margin Progress Bar */}
                {sellingPrice > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: '600' }}>
                      <span>Cost Absorption: {((totalDirectCost / sellingPrice) * 100).toFixed(0)}%</span>
                      <span>Gross Margin: {marginPct}%</span>
                    </div>
                    <div style={{ height: '8px', width: '100%', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                      <div 
                        style={{ 
                          width: `${Math.min(100, (totalDirectCost / sellingPrice) * 100)}%`, 
                          backgroundColor: totalDirectCost > sellingPrice ? '#dc2626' : '#f59e0b',
                          transition: 'width 0.3s ease'
                        }}
                        title={`Direct Costs: ${formatCurrency(totalDirectCost)}`}
                      />
                      {grossMargin > 0 && (
                        <div 
                          style={{ 
                            width: `${Math.min(100, (grossMargin / sellingPrice) * 100)}%`, 
                            backgroundColor: '#16a34a',
                            transition: 'width 0.3s ease'
                          }}
                          title={`Profit Margin: ${formatCurrency(grossMargin)}`}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Embedded Expenses Section (Visible in both Create and Edit modes) */}
          <div className="glass-panel job-embedded-card" style={{ padding: '1.15rem 1.25rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main, #f8fafc)', marginTop: '-0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.1rem', fontWeight: '800' }}>
                  <FileText size={20} style={{ color: 'var(--accent)' }}/> Job Expenses
                </h3>
              </div>
              <button 
                type="button" 
                className="btn glass-panel" 
                style={{ fontSize: '0.8rem', background: 'white', border: '1px solid var(--border-color)' }} 
                onClick={() => {
                  if (addingExpense) {
                    handleCancelExpenseForm()
                  } else {
                    setEditingExpenseId(null)
                    setExpenseForm({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'Project Material' })
                    setExpenseDescriptions([''])
                    setAddingExpense(true)
                  }
                }}
              >
                {addingExpense ? 'Cancel' : '+ Add Expense'}
              </button>
            </div>

            {addingExpense && (
              <form onSubmit={handleExpenseSubmit} style={{ 
                 padding: '1.5rem', background: 'white', borderRadius: '12px', 
                 border: '1px solid var(--border-color)', marginBottom: '2rem',
                 boxShadow: 'var(--shadow-md)',
                 animation: 'fadeIn 0.3s ease'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    {editingExpenseId ? 'Edit Job Expense' : 'New Expense Entry'}
                  </h4>
                </div>

                <div className="job-nested-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div className="form-group col-span-2">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ margin: 0, fontWeight: '700' }}>Expense Description(s) *</label>
                      <button
                        type="button"
                        onClick={handleAddExpenseDescription}
                        style={{
                          background: 'rgba(59, 130, 246, 0.08)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          color: 'var(--primary, #2563eb)',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          borderRadius: '6px',
                          padding: '0.25rem 0.6rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary, #2563eb)'; e.currentTarget.style.color = '#fff' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'; e.currentTarget.style.color = 'var(--primary, #2563eb)' }}
                      >
                        <Plus size={12} /> Add Description
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {expenseDescriptions.map((desc, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            minWidth: '24px', height: '24px', borderRadius: '50%',
                            backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.7rem',
                            fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid #e2e8f0', flexShrink: 0
                          }}>
                            {idx + 1}
                          </div>
                          <input
                            type="text"
                            className="input-field"
                            value={desc}
                            onChange={(e) => handleExpenseDescriptionChange(idx, e.target.value)}
                            required={idx === 0}
                          />
                          {expenseDescriptions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveExpenseDescription(idx)}
                              title="Remove this item"
                              style={{
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                color: 'var(--danger, #ef4444)',
                                cursor: 'pointer',
                                padding: '0.5rem',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.color = 'var(--danger, #ef4444)' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Amount</label>
                    <input type="number" step="0.01" className="input-field" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} onWheel={(e) => e.currentTarget.blur()} required />
                  </div>
                  <div className="form-group">
                    <label>Date</label>
                    <input type="date" className="input-field" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} required />
                  </div>
                  <div className="form-group col-span-2">
                    <label>Category (Purchase vs. Vendor/Labor)</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      list="expense-category-suggestions"
                      value={expenseForm.category} 
                      onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} 
                    />
                    <datalist id="expense-category-suggestions">
                      <option value="Project Material" />
                      <option value="Purchase / Supplies" />
                      <option value="Vendor / Subcontractor" />
                      <option value="Labor & Installation" />
                      <option value="Equipment Rental" />
                      <option value="Transport & Logistics" />
                    </datalist>
                  </div>
                  <div className="col-span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button type="button" className="btn" onClick={handleCancelExpenseForm}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={submittingExpense}>
                      {submittingExpense ? 'Saving...' : (editingExpenseId ? 'Update Expense' : 'Add Expense')}
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="job-expenses-display" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '220px' }}>
                {expenses.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {expenses.map(exp => (
                      <div key={exp.id} style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', 
                        background: 'white', borderRadius: '8px', fontSize: '0.8rem',
                        border: '1px solid var(--border-light)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                          <span style={{ fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'pre-line' }}>{exp.description}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{exp.category} &bull; {new Date(exp.date).toLocaleDateString()}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: '800', color: 'var(--danger)', fontSize: '0.9rem', marginRight: '0.25rem' }}>{formatCurrency(exp.amount)}</span>
                          <button
                            type="button"
                            onClick={() => handleEditExpense(exp)}
                            title="Edit this expense"
                            style={{
                              background: 'rgba(59, 130, 246, 0.08)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              color: 'var(--primary, #2563eb)',
                              cursor: 'pointer',
                              padding: '0.35rem 0.55rem',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary, #2563eb)'; e.currentTarget.style.color = '#fff' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'; e.currentTarget.style.color = 'var(--primary, #2563eb)' }}
                          >
                            <Edit size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp.id)}
                            title="Delete this expense"
                            style={{
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              color: 'var(--danger, #ef4444)',
                              cursor: 'pointer',
                              padding: '0.35rem 0.55rem',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.color = 'var(--danger, #ef4444)' }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No expenses recorded for this job.</div>
                )}
              </div>
              
              {expenseData.length > 0 && (
                <div style={{ width: '250px', height: '250px', background: 'white', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {expenseData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Embedded Payment Section (Visible in both Create and Edit modes) */}
          {(() => {
            const currentContractTotal = editingJob 
              ? parseFloat(editingJob.total_amount || 0)
              : parseFloat(formData.total_amount || 0)

            const currentPaidAmount = editingJob
              ? parseFloat(editingJob.paid_amount || 0)
              : pendingPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0)

            const currentBalance = editingJob
              ? parseFloat(editingJob.balance || 0)
              : Math.max(0, currentContractTotal - currentPaidAmount)

            const isFinancialSettled = currentContractTotal > 0 && currentBalance <= 0

            return (
              <div className="glass-panel job-embedded-card" style={{ padding: '1.15rem 1.25rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main, #f8fafc)' }}>
                {/* Header: Title + Status Badge + Actions */}
                <div className="job-settlement-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.1rem', fontWeight: '800' }}>
                      <CreditCard size={20} style={{ color: 'var(--accent)' }}/> Financial Settlement
                    </h3>
                    {/* Visual payment status badge next to title */}
                    {isFinancialSettled ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800',
                        letterSpacing: '0.02em'
                      }}>
                        <CheckCircle2 size={12}/> PAID
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        background: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800',
                        letterSpacing: '0.02em'
                      }}>
                        <XCircle size={12}/> UNPAID
                      </span>
                    )}
                  </div>
                  <div className="job-settlement-actions" style={{ display: 'flex', gap: '0.65rem' }}>
                    {/* Mark as Paid / Mark as Unpaid toggle */}
                    <button 
                      type="button"
                      className="btn"
                      style={{
                        fontSize: '0.8rem',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        background: isFinancialSettled ? 'rgba(239, 68, 68, 0.05)' : 'var(--accent)',
                        color: isFinancialSettled ? 'var(--danger)' : 'white',
                        border: isFinancialSettled ? '1px solid rgba(239, 68, 68, 0.15)' : 'none',
                      }}
                      onClick={handleTogglePaid}
                      disabled={submittingPayment}
                    >
                      {isFinancialSettled
                        ? <><XCircle size={15}/> Mark as Unpaid</>
                        : <><CheckCircle2 size={15}/> Mark as Paid</>
                      }
                    </button>
                    <button type="button" className="btn glass-panel" style={{ fontSize: '0.8rem', background: 'white', border: '1px solid var(--border-color)' }} onClick={() => setAddingPayment(!addingPayment)}>
                      {addingPayment ? 'Cancel' : '+ Add Payment'}
                    </button>
                  </div>
                </div>

                {/* Equal-width, evenly-spaced KPI cards */}
                <div className="job-settlement-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.75rem' }}>
                  <div style={{ 
                    padding: '1.5rem 1rem', background: 'white', borderRadius: '12px', 
                    border: '1px solid var(--border-color)', textAlign: 'center',
                    boxShadow: 'var(--shadow-sm)', transition: 'all 0.3s ease'
                  }} className="settlement-card">
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>Contract Total</div>
                    <div style={{ fontWeight: '900', fontSize: '1.25rem', color: 'var(--text-main)' }}>{formatCurrency(currentContractTotal)}</div>
                  </div>
                  <div style={{ 
                    padding: '1.5rem 1rem', background: 'white', borderRadius: '12px', 
                    border: '1px solid var(--border-color)', textAlign: 'center',
                    boxShadow: 'var(--shadow-sm)', transition: 'all 0.3s ease'
                  }} className="settlement-card">
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>Amount Paid</div>
                    <div style={{ fontWeight: '900', fontSize: '1.25rem', color: 'var(--success)' }}>{formatCurrency(currentPaidAmount)}</div>
                  </div>
                  <div style={{ 
                    padding: '1.5rem 1rem', background: 'white', borderRadius: '12px', 
                    border: '1px solid var(--border-color)', textAlign: 'center',
                    boxShadow: 'var(--shadow-sm)', transition: 'all 0.3s ease'
                  }} className="settlement-card">
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>Pending Balance</div>
                    <div style={{ fontWeight: '900', fontSize: '1.25rem', color: currentBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {currentBalance > 0 ? formatCurrency(currentBalance) : (currentContractTotal > 0 ? 'Settled' : formatCurrency(0))}
                    </div>
                  </div>
                </div>

                {addingPayment && (
                  <form onSubmit={handlePaymentSubmit} style={{ 
                     padding: '1.5rem', background: 'white', borderRadius: '12px', 
                     border: '1px solid var(--border-color)', marginBottom: '2rem',
                     boxShadow: 'var(--shadow-md)',
                     animation: 'fadeIn 0.3s ease'
                  }}>
                    <div className="job-nested-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      <div className="form-group">
                        <label>Payment Amount</label>
                        <input type="number" step="0.01" className="input-field" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} onWheel={(e) => e.currentTarget.blur()} required />
                      </div>
                      <div className="form-group">
                        <label>Payment Date</label>
                        <input type="date" className="input-field" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} required />
                      </div>
                      <div className="form-group col-span-2">
                        <label>Payment Notes</label>
                        <input type="text" className="input-field" value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} />
                      </div>
                      <div className="col-span-2" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn btn-primary" disabled={submittingPayment}>
                          {submittingPayment ? 'Saving...' : 'Confirm Payment'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Minimal Transaction History */}
                {(editingJob?.payment_history?.length > 0 || pendingPayments.length > 0) && (
                  <div style={{ fontSize: 'var(--font-sm)' }}>
                    <div style={{ color: 'var(--text-main)', marginBottom: '0.75rem', fontWeight: '700', fontSize: '0.85rem' }}>
                      {editingJob ? 'Recent Settlement Activity' : 'Queued Payment(s)'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {(editingJob ? (editingJob.payment_history || []).slice(0, 5) : pendingPayments).map(p => (
                        <div key={p.id} style={{ 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', 
                          background: 'white', borderRadius: '8px', fontSize: '0.8rem',
                          border: '1px solid var(--border-light)',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                            <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{p.notes || 'Full Settlement'}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(p.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontWeight: '800', color: 'var(--success)', fontSize: '0.9rem' }}>{formatCurrency(p.amount)}</span>
                            {!editingJob && (
                              <button
                                type="button"
                                onClick={() => handleDeletePendingPayment(p.id)}
                                title="Remove queued payment"
                                style={{
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  color: 'var(--danger, #ef4444)',
                                  cursor: 'pointer',
                                  padding: '0.35rem 0.5rem',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.75rem',
                                  fontWeight: '700'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff' }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.color = 'var(--danger, #ef4444)' }}
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </Modal>
    
      <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title="Create New Customer">
        <form onSubmit={handleCustomerSubmit} className="form-grid">
          <div className="form-group col-span-2">
            <label>Full Name *</label>
            <input type="text" className="input-field" value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} required />
          </div>
          <div className="form-group col-span-2">
            <label>Company Name</label>
            <input type="text" className="input-field" value={customerForm.company_name || ''} onChange={e => setCustomerForm({...customerForm, company_name: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input type="text" className="input-field" value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" className="input-field" value={customerForm.email} onChange={e => setCustomerForm({...customerForm, email: e.target.value})} />
          </div>
          <div className="col-span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn" onClick={() => setIsCustomerModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submittingCustomer}>
              {submittingCustomer ? 'Saving...' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {previewAttachment && (
        <Modal
          isOpen={!!previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          title={`Attachment: ${previewAttachment.name}`}
          maxWidth="820px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              maxHeight: '68vh',
              overflow: 'auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.03)',
              borderRadius: '8px',
              padding: '0.5rem'
            }}>
              {previewAttachment.type?.includes('pdf') || previewAttachment.name?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewAttachment.blobUrl || previewAttachment.dataUrl}
                  style={{ width: '100%', height: '65vh', border: 'none', borderRadius: '6px' }}
                  title={previewAttachment.name}
                />
              ) : (
                <img
                  src={previewAttachment.blobUrl || previewAttachment.dataUrl}
                  alt={previewAttachment.name}
                  style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '6px' }}
                />
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                className="btn"
                onClick={() => window.open(previewAttachment.blobUrl || previewAttachment.dataUrl, '_blank')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}
              >
                <ExternalLink size={14} /> Open in New Tab
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleDownloadAttachment(previewAttachment.dataUrl, previewAttachment.name, previewAttachment.type)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}
              >
                <Download size={14} /> Download File
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPreviewAttachment(null)}
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

export default JobOrders
