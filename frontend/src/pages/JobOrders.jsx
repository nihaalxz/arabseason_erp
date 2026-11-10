import React from 'react'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import PlainFilterDropdown from '../components/common/PlainFilterDropdown'
import PageHeaderButton from '../components/common/PageHeaderButton'
import { CredAnimatedTabs } from '../components/cashbook/cred/CredAnimatedTabs'
import CredSearchInput from '../components/cashbook/cred/CredSearchInput'
import { useSearchParams } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import { Clock, Paperclip, Download, Eye as LucideEye, ExternalLink, UploadCloud, FilePlus, X, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { Edit, Trash2, Plus, Eye, RefreshCw, AlertCircle, CreditCard, CheckCircle2, XCircle, UserPlus, User, FileText, ArrowUpDown, ArrowUp, ArrowDown, Briefcase, Layers, BookOpen, Folder } from '../components/icons'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import api from '../api'
import Modal from '../components/common/Modal'
import {
  ModalShell,
  Field,
  TextInput,
  NumberInput,
  Select as CredSelect,
  Dropzone,
  RowList,
  InlineAddLink,
  credSelectStyles,
  CredOption
} from '../components/common/FormPrimitives'
import SkeletonLoader from '../components/common/SkeletonLoader'
import SearchBar from '../components/common/SearchBar'
import ProjectPlanning from '../components/planning/ProjectPlanning'
import { canAccessPermission, isUserAdmin } from '../constants/permissions'
import AccessDenied from '../components/common/AccessDenied'
import DynamicCustomFields from '../components/common/DynamicCustomFields'
import JobOrderDetailModal from '../components/jobs/JobOrderDetailModal'
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

const JobOrders = ({ embedded = false, currentUser: currentUserProp = null }) => {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [filterCreatedBy, setFilterCreatedBy] = useState('all')
  const [filterSalesperson, setFilterSalesperson] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')
  const [totalJobsCount, setTotalJobsCount] = useState(0)

  // Client Books Architecture & Summary
  const [selectedClientBook, setSelectedClientBook] = useState('all')
  const [jobSummary, setJobSummary] = useState({ total_value: 0, total_paid: 0, total_balance: 0, count: 0, by_client: [] })

  // Current user & role detection
  const currentUser = currentUserProp || (() => {
    try { return JSON.parse(localStorage.getItem('user')) || {} }
    catch (e) { return {} }
  })()
  const isAdmin = isUserAdmin(currentUser)
  const hasJobsAccess = isAdmin || canAccessPermission(currentUser, 'jobs')
  const hasPlanningAccess = isAdmin || canAccessPermission(currentUser, 'planning')

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
    return (subtabParam === 'planning' && hasPlanningAccess) ? 'planning' : (subtabParam === 'pending' ? 'pending' : 'orders')
  })

  useEffect(() => {
    if (embedded) {
      const st = searchParams.get('subtab')
      if (st === 'planning' && hasPlanningAccess) {
        setEmbeddedSection('planning')
      } else if (st === 'pending' || st === 'orders') {
        setEmbeddedSection(st)
      } else if (st === 'planning' && !hasPlanningAccess) {
        setEmbeddedSection('orders')
        setSearchParams(p => {
          const next = new URLSearchParams(p)
          next.delete('subtab')
          return next
        }, { replace: true })
      }
    } else {
      if (currentTabParam === 'planning' && !hasPlanningAccess) {
        setSearchParams(p => {
          const next = new URLSearchParams(p)
          next.delete('tab')
          return next
        }, { replace: true })
      } else if (currentTabParam !== 'planning' && !hasJobsAccess && hasPlanningAccess) {
        setSearchParams(p => {
          const next = new URLSearchParams(p)
          next.set('tab', 'planning')
          return next
        }, { replace: true })
      }
    }
  }, [embedded, searchParams, hasPlanningAccess, hasJobsAccess, currentTabParam, setSearchParams])

  const activeSection = embedded 
    ? (embeddedSection === 'planning' && !hasPlanningAccess ? 'orders' : embeddedSection)
    : (currentTabParam === 'planning' && hasPlanningAccess ? 'planning' : (currentTabParam === 'pending' ? 'pending' : (hasJobsAccess ? 'orders' : (hasPlanningAccess ? 'planning' : 'orders'))))

  // Pending Job Orders State
  const [pendingJobOrders, setPendingJobOrders] = useState([])
  const [pendingJobsLoading, setPendingJobsLoading] = useState(false)
  const [pendingFilterStatus, setPendingFilterStatus] = useState('pending') // 'pending' | 'converted' | 'all'
  const [pendingSearchQuery, setPendingSearchQuery] = useState('')
  const [selectedPendingForCreation, setSelectedPendingForCreation] = useState(null)
  const [selectedJobForDetail, setSelectedJobForDetail] = useState(null)
  const [previewAttachment, setPreviewAttachment] = useState(null)
  const projectPlanningRef = useRef(null)

  const getJobAttachments = (job) => {
    if (!job) return []
    if (Array.isArray(job.attachments) && job.attachments.length > 0) {
      return job.attachments
    }
    const cf = (typeof job.custom_fields === 'object' && job.custom_fields) ? job.custom_fields : {}
    if (Array.isArray(cf.attachments) && cf.attachments.length > 0) {
      return cf.attachments
    }
    if (job.attachment || cf.attachment) {
      return [{
        name: job.attachment_name || cf.attachment_name || 'Site Photo',
        url: job.attachment || cf.attachment,
        type: job.attachment_type || cf.attachment_type || 'image/jpeg'
      }]
    }
    return []
  }

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

  const handleOpenAttachmentPreview = (dataUrlOrList, fileNameOrIndex = 0, mimeType = null) => {
    let list = []
    let initialIndex = 0

    if (Array.isArray(dataUrlOrList)) {
      list = dataUrlOrList.map((item, idx) => {
        if (typeof item === 'string') {
          return { url: item, name: `Attachment ${idx + 1}`, type: '' }
        }
        return {
          url: item.url || item.dataUrl || '',
          name: item.name || `Attachment ${idx + 1}`,
          type: item.type || ''
        }
      }).filter(item => Boolean(item.url))
      initialIndex = typeof fileNameOrIndex === 'number' ? Math.max(0, Math.min(fileNameOrIndex, list.length - 1)) : 0
    } else if (typeof dataUrlOrList === 'string' && dataUrlOrList) {
      list = [{
        url: dataUrlOrList,
        name: typeof fileNameOrIndex === 'string' ? fileNameOrIndex : 'Attachment',
        type: mimeType || ''
      }]
      initialIndex = 0
    }

    if (list.length === 0) return

    const item = list[initialIndex]
    const itemType = item.type || (item.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
    let blobUrl = item.url
    try {
      if (item.url.startsWith('data:')) {
        const arr = item.url.split(',')
        const bstr = atob(arr[1])
        let n = bstr.length
        const u8arr = new Uint8Array(n)
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n)
        }
        const blob = new Blob([u8arr], { type: itemType })
        blobUrl = URL.createObjectURL(blob)
      }
    } catch (err) {
      console.error('Preview error:', err)
    }

    setPreviewAttachment({
      list,
      currentIndex: initialIndex,
      blobUrl,
      dataUrl: item.url,
      name: item.name || `Attachment ${initialIndex + 1}`,
      type: itemType
    })
  }

  const handleNextPreview = () => {
    if (!previewAttachment || !previewAttachment.list || previewAttachment.currentIndex >= previewAttachment.list.length - 1) return
    handleOpenAttachmentPreview(previewAttachment.list, previewAttachment.currentIndex + 1)
  }

  const handlePrevPreview = () => {
    if (!previewAttachment || !previewAttachment.list || previewAttachment.currentIndex <= 0) return
    handleOpenAttachmentPreview(previewAttachment.list, previewAttachment.currentIndex - 1)
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
  const filterRef = useRef({ page: 1, status: '', payment: '', search: '', sortField: 'created_at', sortDirection: 'desc', client: 'all', adminTab: 'my', staffFilter: 'all', createdBy: 'all', salesperson: 'all' })
  filterRef.current = { page, status: filterStatus, payment: filterPayment, search: debouncedSearch, sortField, sortDirection, client: selectedClientBook, adminTab, staffFilter: assignedStaffFilter, createdBy: filterCreatedBy, salesperson: filterSalesperson }

  const fetchJobs = useCallback(async (overrides = {}) => {
    const { page: p, status: s, payment: pay, search: q, sortField: sf, sortDirection: sd, client: cl, adminTab: at, staffFilter: sfFilter, createdBy: cb, salesperson: sp } = { ...filterRef.current, ...overrides }
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
      if (cb && cb !== 'all') params.created_by = cb
      if (sp && sp !== 'all') params.salesperson = sp
      if (sf) {
        params.ordering = (sd === 'desc' ? '-' : '') + sf
      }

      const res = await api.get('job-orders/', { params })
      const data = res.data

      if (Array.isArray(data)) {
        setJobs(data)
        setTotalPages(1)
        setTotalJobsCount(data.length)
      } else {
        setJobs(data.results || [])
        setTotalPages(Math.ceil((data.count || 0) / 20) || 1)
        setTotalJobsCount(data.count !== undefined ? data.count : (data.results || []).length)
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
    fetchJobs({ page: 1, status: filterStatus, payment: filterPayment, search: debouncedSearch, sortField, sortDirection, client: selectedClientBook, adminTab, staffFilter: assignedStaffFilter, createdBy: filterCreatedBy, salesperson: filterSalesperson })
  }, [filterStatus, filterPayment, debouncedSearch, sortField, sortDirection, selectedClientBook, adminTab, assignedStaffFilter, filterCreatedBy, filterSalesperson])

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
    salesperson: '',
    salesperson_name: '',
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
  const [salespersons, setSalespersons] = useState([])
  const [isSalespersonModalOpen, setIsSalespersonModalOpen] = useState(false)
  const [newSalespersonForm, setNewSalespersonForm] = useState({ name: '', phone: '', email: '' })
  const [submittingSalesperson, setSubmittingSalesperson] = useState(false)
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
  const [attachments, setAttachments] = useState([])
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
    try {
      const spRes = await api.get('salespersons/', { params: { nopage: 'true' } })
      const spData = spRes.data
      setSalespersons(Array.isArray(spData) ? spData : (spData.results || []))
    } catch (err) {
      console.error('Failed to fetch salespersons', err)
    }
  }

  const handleQuickCreateSalesperson = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!newSalespersonForm.name.trim()) return
    setSubmittingSalesperson(true)
    try {
      const res = await api.post('salespersons/', newSalespersonForm)
      const newSp = res.data
      setSalespersons(prev => [...prev, newSp].sort((a, b) => a.name.localeCompare(b.name)))
      setFormData(prev => ({
        ...prev,
        salesperson: newSp.id,
        salesperson_name: newSp.name
      }))
      setIsSalespersonModalOpen(false)
      setNewSalespersonForm({ name: '', phone: '', email: '' })
      showToast(`Salesperson "${newSp.name}" added successfully!`, 'success')
    } catch (err) {
      console.error('Failed to create salesperson', err)
      showError('Salesperson Error', err.response?.data?.detail || err.response?.data?.name?.[0] || 'Failed to create salesperson.')
    } finally {
      setSubmittingSalesperson(false)
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
            padding: '9px 12px',
            cursor: 'pointer',
            backgroundColor: isFocused ? 'var(--fill-ghost-hover, #F4F4F4)' : 'transparent',
            color: 'var(--text, #111111)',
            fontWeight: 500,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>+ Use "{data.label}"</span>
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
          backgroundColor: isSelected
            ? 'var(--fill-ghost-hover, #F4F4F4)'
            : (isFocused ? 'var(--fill-ghost-hover, #F4F4F4)' : 'transparent'),
          color: 'var(--text, #111111)',
          fontSize: '13px',
          borderRadius: '8px'
        }}
      >
        <span style={{ flex: 1, fontWeight: isSelected ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.label}</span>
        {isSelected && (
          <Check size={14} style={{ color: 'var(--text, #111111)', marginRight: '6px', flexShrink: 0 }} />
        )}
        <button
          type="button"
          title={`Remove "${data.label}" from suggestions`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleDeleteTitle(data.value)
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #8C8C8C)',
            cursor: 'pointer',
            padding: '3px 6px',
            borderRadius: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '12px'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger, #DC2626)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)' }}
        >
          <Trash2 size={12} />
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
        total_amount: job.total_amount ?? '',
        advance_amount: job.advance_amount || 0,
        payment_type: job.payment_type || 'full',
        created_by_staff: job.created_by_staff || job.created_by_name || '',
        payment_collected_by: job.payment_collected_by || '',
        salesperson: job.salesperson || job.salesperson_detail?.id || '',
        salesperson_name: job.salesperson_name || job.salesperson_detail?.name || '',
        assigned_to: job.assigned_to || '',
        custom_fields: job.custom_fields || {},
        attachment: job.attachment || job.custom_fields?.attachment || '',
        attachment_name: job.attachment_name || job.custom_fields?.attachment_name || '',
        attachment_type: job.attachment_type || job.custom_fields?.attachment_type || ''
      })

      let initialAttachments = []
      if (Array.isArray(job.attachments) && job.attachments.length > 0) {
        initialAttachments = job.attachments
      } else if (Array.isArray(job.custom_fields?.attachments) && job.custom_fields.attachments.length > 0) {
        initialAttachments = job.custom_fields.attachments
      } else if (job.attachment || job.custom_fields?.attachment) {
        initialAttachments = [{
          name: job.attachment_name || job.custom_fields?.attachment_name || 'Attachment',
          url: job.attachment || job.custom_fields?.attachment,
          type: job.attachment_type || job.custom_fields?.attachment_type || 'image/jpeg'
        }]
      }
      setAttachments(initialAttachments)
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

      // Authoritative next order ID from server
      api.get('job-orders/next-order-id/')
        .then(res => {
          if (res.data?.number) {
            setContractPrefix(res.data.prefix || 'JOB')
            setContractNumber(res.data.number)
          }
        })
        .catch(() => {})

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
        total_amount: '',
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
      setAttachments([])
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

    // Authoritative next order ID from server
    api.get('job-orders/next-order-id/')
      .then(res => {
        if (res.data?.number) {
          setContractPrefix(res.data.prefix || 'JOB')
          setContractNumber(res.data.number)
        }
      })
      .catch(() => {})

    let creatorName = ''
    try {
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}')
      creatorName = `${savedUser.first_name || ''} ${savedUser.last_name || ''}`.trim() || savedUser.username || ''
    } catch (e) {}

    const initDeposit = parseFloat(pending?.initial_deposit) || 0
    const estTotal = parseFloat(pending?.estimated_amount) || initDeposit || ''

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
      salesperson: pending?.salesperson || '',
      salesperson_name: pending?.salesperson_name || '',
      assigned_to: isAdmin ? (currentUser?.id || '') : '',
      custom_fields: {},
      attachment: '',
      attachment_name: '',
      attachment_type: ''
    })

    let initialAttachments = []
    if (Array.isArray(pending?.attachments) && pending.attachments.length > 0) {
      initialAttachments = pending.attachments
    } else if (pending?.attachment) {
      initialAttachments = [{
        name: pending.attachment_name || 'Attachment',
        url: pending.attachment,
        type: pending.attachment_type || 'image/jpeg'
      }]
    }
    setAttachments(initialAttachments)

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
    const files = Array.from(e.target?.files || e.dataTransfer?.files || e || [])
    if (!files.length) return
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    for (const f of files) {
      if (f.size > MAX_SIZE) {
        showError('File Too Large', `"${f.name}" exceeds the 10MB limit.`)
        return
      }
    }

    const readers = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          resolve({
            name: file.name,
            url: reader.result,
            type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
            size: file.size
          })
        }
        reader.readAsDataURL(file)
      })
    })

    Promise.all(readers).then(newItems => {
      setAttachments(prev => {
        const updated = [...prev, ...newItems]
        const first = updated[0]
        setFormData(f => ({
          ...f,
          attachment: first ? first.url : '',
          attachment_name: first ? first.name : '',
          attachment_type: first ? first.type : ''
        }))
        return updated
      })
    })
  }

  const handleRemoveAttachment = (index) => {
    setAttachments(prev => {
      const updated = prev.filter((_, i) => i !== index)
      const first = updated[0]
      setFormData(f => ({
        ...f,
        attachment: first ? first.url : '',
        attachment_name: first ? first.name : '',
        attachment_type: first ? first.type : ''
      }))
      return updated
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.customer || !formData.status) {
      return setFormError('Title, Customer, and Current Status are required')
    }

    // Estimated Amount is non-mandatory (defaults to 0 if left blank)
    const rawEstimated = formData.total_amount != null && String(formData.total_amount).trim() !== '' ? parseFloat(formData.total_amount) : 0
    if (isNaN(rawEstimated) || rawEstimated < 0) {
      return setFormError('Estimated Amount must be a valid number (0 or greater)')
    }

    // Assign to Admin is mandatory for staff; for admins it defaults to self
    if (!isAdmin && !formData.assigned_to) {
      return setFormError('Assign to Admin is required. Please select an administrator.')
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
      const primaryAttachment = attachments[0] || null
      const payload = { 
        ...formData, 
        order_id: finalOrderId, 
        description: finalDescription,
        custom_fields: {
          ...(formData.custom_fields || {}),
          attachments: attachments,
          attachment: primaryAttachment ? primaryAttachment.url : '',
          attachment_name: primaryAttachment ? primaryAttachment.name : '',
          attachment_type: primaryAttachment ? primaryAttachment.type : ''
        },
        attachment: primaryAttachment ? primaryAttachment.url : '',
        attachment_name: primaryAttachment ? primaryAttachment.name : '',
        attachment_type: primaryAttachment ? primaryAttachment.type : '',
        total_amount: parseFloat(formData.total_amount || 0),
        advance_amount: parseFloat(formData.advance_amount || 0),
        payment_type: formData.payment_type || 'full',
        salesperson: formData.salesperson ? formData.salesperson : null,
        salesperson_name: formData.salesperson_name || '',
        assigned_to: formData.assigned_to ? formData.assigned_to : (isAdmin ? (currentUser?.id || null) : null),
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



  // Cashbook Amount Formatter Helper
  const renderCashbookAmount = (val, suffix = 'SAR') => {
    if (val === null || val === undefined || val === '') return '—'
    const num = parseFloat(val)
    if (isNaN(num)) return '—'
    const parts = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')
    return (
      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '13px', fontWeight: 400, color: 'var(--text, #111111)' }}>
        {parts[0]}<span style={{ opacity: 0.55, fontSize: '11px' }}>.{parts[1]}</span>
        {suffix && <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginLeft: '3px' }}>{suffix}</span>}
      </span>
    )
  }

  // Operational Status Dot + Label Helper
  const renderOperationalStatus = (status) => {
    const s = String(status || '').trim()
    let dotColor = '#8C8C8C'
    let label = s || 'Pending'

    if (s.toLowerCase() === 'pending') {
      dotColor = '#f59e0b'
      label = 'Pending'
    } else if (s.toLowerCase() === 'in progress') {
      dotColor = '#3b82f6'
      label = 'In Progress'
    } else if (s.toLowerCase() === 'completed') {
      dotColor = '#10b981'
      label = 'Completed'
    } else if (s.toLowerCase() === 'cancelled') {
      dotColor = '#dc2626'
      label = 'Cancelled'
    }

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 400, color: 'var(--text, #111111)' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
        {label}
      </span>
    )
  }

  // Pending Entry Status Dot + Label Helper
  const renderPendingStatus = (status) => {
    const s = String(status || '').toLowerCase()
    let dotColor = '#8C8C8C'
    let label = 'Cancelled'

    if (s === 'pending') {
      dotColor = '#f59e0b'
      label = 'Pending creation'
    } else if (s === 'converted') {
      dotColor = '#10b981'
      label = 'Converted'
    } else if (s === 'dismissed' || s === 'cancelled') {
      dotColor = '#8C8C8C'
      label = 'Dismissed'
    }

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 400, color: 'var(--text, #111111)' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
        {label}
      </span>
    )
  }

  // Plain dropdown options with short labels
  const statusDropdownOptions = useMemo(() => [
    { value: '', label: 'All statuses' },
    { value: 'Pending', label: 'Pending' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Cancelled', label: 'Cancelled' }
  ], [])

  const paymentDropdownOptions = useMemo(() => [
    { value: '', label: 'All payments' },
    { value: 'paid', label: 'Fully Settled' },
    { value: 'unpaid', label: 'Has Balance' }
  ], [])

  const sortDropdownOptions = useMemo(() => [
    { value: 'created_at:desc', label: 'Newest first' },
    { value: 'created_at:asc', label: 'Oldest first' },
    { value: 'order_id:asc', label: 'Contract ID: A-Z' },
    { value: 'order_id:desc', label: 'Contract ID: Z-A' },
    { value: 'total_amount:desc', label: 'Total: High to Low' },
    { value: 'total_amount:asc', label: 'Total: Low to High' },
    { value: 'title:asc', label: 'Title: A to Z' },
    { value: 'title:desc', label: 'Title: Z to A' },
    { value: 'customer:asc', label: 'Client: A to Z' },
    { value: 'customer:desc', label: 'Client: Z to A' },
    { value: 'status:asc', label: 'Status: A to Z' }
  ], [])

  const clientDropdownOptions = useMemo(() => [
    { value: 'all', label: 'All clients' },
    ...customers.map(c => ({
      value: String(c.id),
      label: c.name
    }))
  ], [customers])

  const staffDropdownOptions = useMemo(() => [
    { value: 'all', label: 'All staff' },
    ...staffOptions.map(st => ({
      value: st.username,
      label: st.name || st.username
    }))
  ], [staffOptions])

  const createdByDropdownOptions = useMemo(() => {
    const list = [{ value: 'all', label: 'All created by' }]
    const seen = new Set()
    staffOptions.forEach(st => {
      const val = String(st.id)
      const label = st.name || st.username
      if (!seen.has(val) && !seen.has(label.toLowerCase())) {
        seen.add(val)
        seen.add(label.toLowerCase())
        list.push({ value: val, label })
      }
    })
    return list
  }, [staffOptions])

  const salespersonDropdownOptions = useMemo(() => [
    { value: 'all', label: 'All salespersons' },
    ...salespersons.map(sp => ({
      value: String(sp.id),
      label: sp.name
    }))
  ], [salespersons])

  // Universal refresh event listener
  useEffect(() => {
    const handleAppRefresh = () => {
      fetchJobs({ page, status: filterStatus, payment: filterPayment, search: debouncedSearch, sortField, sortDirection, client: selectedClientBook, adminTab, staffFilter: assignedStaffFilter, createdBy: filterCreatedBy, salesperson: filterSalesperson })
      fetchJobSummary()
      fetchPendingJobOrders()
      if (isAdmin) fetchAssignedCount()
      fetchLookups()
    }
    window.addEventListener('app:refresh', handleAppRefresh)
    return () => window.removeEventListener('app:refresh', handleAppRefresh)
  }, [page, filterStatus, filterPayment, debouncedSearch, sortField, sortDirection, selectedClientBook, adminTab, assignedStaffFilter, filterCreatedBy, filterSalesperson, isAdmin, fetchAssignedCount, fetchPendingJobOrders])

  if (!hasJobsAccess && !hasPlanningAccess) {
    return <AccessDenied currentUser={currentUser} requiredPermission="jobs" />
  }

  if (activeSection === 'planning' && !hasPlanningAccess) {
    return <AccessDenied currentUser={currentUser} requiredPermission="planning" />
  }

  if (activeSection !== 'planning' && !hasJobsAccess) {
    return <AccessDenied currentUser={currentUser} requiredPermission="jobs" />
  }

  return (
    <div className={`jobs-page erp-page-container ${embedded ? 'embedded-job-orders' : ''}`} style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', padding: embedded ? '0' : undefined }}>
      
      {/* ── 1. PAGE HEADER (CRED Style) ── */}
      <div className="page-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontWeight: 600, letterSpacing: '-0.02em', fontSize: '24px', margin: 0, color: 'var(--text, #0A0A0A)' }}>
            {activeSection === 'planning' ? 'Project Planning' : 'Job Orders'}
          </h2>
          {activeSection !== 'planning' && (
            <p style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '13px', margin: '4px 0 0' }}>
              {activeSection === 'pending'
                ? 'Review and formalize rough job order entries recorded from Cash In / Quick Log'
                : 'Manage service delivery, operational milestones, and customer invoicing'}
            </p>
          )}
        </div>
        {activeSection === 'planning' ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <PageHeaderButton onClick={() => projectPlanningRef.current?.openCreateModal?.()}>
              Create Project Plan
            </PageHeaderButton>
          </div>
        ) : (activeSection === 'orders' || activeSection === 'pending') && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <PageHeaderButton onClick={() => handleOpenModal()}>
              New Job Order
            </PageHeaderButton>
          </div>
        )}
      </div>

      {/* Top Tabs: Hidden on Project Planning */}
      {activeSection !== 'planning' && (
        <div style={{ marginBottom: '20px' }}>
          <CredAnimatedTabs
            className="cred-jobs-tabs"
            tabs={[
              { id: 'orders', label: 'Job Orders', count: jobs.length },
              { 
                id: 'pending', 
                label: 'Pending Job Order Entries', 
                count: pendingJobOrders.filter(p => p.status === 'pending').length || undefined 
              }
            ]}
            value={activeSection === 'pending' ? 'pending' : 'orders'}
            onChange={(tabId) => handleTabSwitch(tabId)}
            layoutId="job-orders-top-tabs"
          />
        </div>
      )}

      {activeSection === 'planning' ? (
        <ProjectPlanning ref={projectPlanningRef} jobOrders={jobs} onRefreshJobs={fetchJobs} />
      ) : activeSection === 'pending' ? (
        /* ── PART 4: PENDING JOB ORDER ENTRIES ── */
        <div style={{ width: '100%', position: 'relative', marginBottom: '2.5rem' }}>
          {/* Top Bar for Pending Entries: Search on Left, Filter Tabs on Right */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div style={{ flex: '1 1 300px', maxWidth: '420px' }}>
              <CredSearchInput
                value={pendingSearchQuery}
                onChange={(e) => setPendingSearchQuery(e.target.value)}
                onClear={() => setPendingSearchQuery('')}
                placeholder="Search pending entries..."
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <CredAnimatedTabs
                className="cred-jobs-tabs"
                tabs={[
                  { id: 'pending', label: 'Pending', count: pendingJobOrders.filter(p => p.status === 'pending').length },
                  { id: 'converted', label: 'Converted' },
                  { id: 'all', label: 'All' }
                ]}
                value={pendingFilterStatus}
                onChange={(st) => setPendingFilterStatus(st)}
                layoutId="pending-jobs-filter-tabs"
              />
            </div>
          </div>

          {/* Pending Table / List */}
          {pendingJobsLoading && pendingJobOrders.length === 0 ? (
            <div style={{ padding: '1.5rem 0' }}>
              <SkeletonLoader type="table" />
            </div>
          ) : (() => {
            const filteredPending = pendingJobOrders.filter(p => {
              if (pendingFilterStatus !== 'all' && p.status !== pendingFilterStatus) return false
              if (!pendingSearchQuery.trim()) return true
              const q = pendingSearchQuery.toLowerCase()
              return (
                p.title?.toLowerCase().includes(q) ||
                p.customer_name?.toLowerCase().includes(q) ||
                p.description?.toLowerCase().includes(q)
              )
            })

            return filteredPending.length === 0 ? (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                <Clock size={22} strokeWidth={1.6} style={{ color: 'var(--text-muted, #8C8C8C)', opacity: 0.6, marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>
                  {pendingSearchQuery
                    ? `No entries matching "${pendingSearchQuery}".`
                    : pendingFilterStatus === 'converted'
                    ? 'No converted entries.'
                    : pendingFilterStatus === 'pending'
                    ? 'No pending entries.'
                    : 'No job order entries.'}
                </p>
              </div>
            ) : (
              <div className="desktop-only-table" style={{ width: '100%', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)' }}>
                      <th style={{ width: '10%', padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Created</th>
                      <th style={{ width: '16%', padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Customer</th>
                      <th style={{ width: '14%', padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Job Name</th>
                      <th style={{ width: '18%', padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Description</th>
                      <th style={{ width: '12%', padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Deposit Received</th>
                      <th style={{ width: '12%', padding: '10px 12px 10px 24px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Status</th>
                      <th style={{ width: '8%', padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Logged By</th>
                      <th style={{ width: '10%', padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPending.map((item) => (
                      <tr 
                        key={item.id}
                        className="cred-table-row"
                        style={{ borderBottom: '1px solid var(--border, #E4E4E4)', transition: 'background-color 0.15s ease' }}
                      >
                        {/* Created Date */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle', fontSize: '12.5px', color: 'var(--text-muted, #8C8C8C)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB') : '—'}
                        </td>

                        {/* Customer (name only, phone below, '-' if missing) */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                          <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.customer_name || (item.customer ? `Customer #${item.customer}` : '—')}
                          </div>
                          {item.customer_phone && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                              {item.customer_phone}
                            </div>
                          )}
                        </td>

                        {/* Job Name */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                          <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                            {item.title}
                          </div>
                        </td>

                        {/* Description */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                          <div 
                            style={{ fontSize: '12.5px', color: 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={item.description}
                          >
                            {item.description || '—'}
                          </div>
                          {(() => {
                            const att = item.attachment || item.custom_fields?.attachment
                            const attName = item.attachment_name || item.custom_fields?.attachment_name || ''
                            const attType = item.attachment_type || item.custom_fields?.attachment_type || ''
                            if (!att) return null
                            const isImg = att.startsWith('data:image/') || attType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(attName)
                            return (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                {isImg && (
                                  <img
                                    src={att}
                                    alt=""
                                    onClick={() => handleOpenAttachmentPreview(att, attName, attType)}
                                    style={{
                                      width: '24px',
                                      height: '24px',
                                      objectFit: 'cover',
                                      borderRadius: '4px',
                                      border: '1px solid var(--border, #E4E4E4)',
                                      cursor: 'pointer'
                                    }}
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenAttachmentPreview(att, attName, attType)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    fontSize: '11px',
                                    color: 'var(--text-muted, #8C8C8C)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    textDecoration: 'underline'
                                  }}
                                  title={attName || 'View file'}
                                >
                                  <Paperclip size={11} /> {attName || 'View Attachment'}
                                </button>
                              </div>
                            )
                          })()}
                        </td>

                        {/* Deposit Received (Right aligned, Cashbook amount) */}
                        <td style={{ textAlign: 'right', padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {renderCashbookAmount(item.initial_deposit)}
                        </td>

                        {/* Status (Extra left padding so clearly separated from Deposit Received) */}
                        <td style={{ padding: '10px 12px 10px 24px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {renderPendingStatus(item.status)}
                        </td>

                        {/* Logged By (Plain muted text, truncated with ellipsis) */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle', fontSize: '12.5px', color: 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.created_by_name || 'System'}>
                          {item.created_by_name || 'System'}
                        </td>

                        {/* Actions (Icon-only buttons with 8px gap) */}
                        <td style={{ textAlign: 'right', padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {item.status === 'pending' ? (
                            <div style={{ display: 'inline-flex', gap: '12px', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                              <button
                                type="button"
                                className="cred-pending-icon-btn"
                                onClick={() => handleCreateFromPending(item)}
                                title="Create job order"
                                aria-label="Create job order"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: '6px',
                                  borderRadius: '50%',
                                  color: 'var(--text-muted, #8C8C8C)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'color 0.15s ease, background-color 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = 'var(--text, #0A0A0A)'
                                  e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                              >
                                <FilePlus size={16} strokeWidth={1.8} />
                              </button>
                              <button
                                type="button"
                                className="cred-pending-icon-btn"
                                onClick={() => handleDismissPending(item.id)}
                                title="Dismiss"
                                aria-label="Dismiss"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: '6px',
                                  borderRadius: '50%',
                                  color: 'var(--text-muted, #8C8C8C)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'color 0.15s ease, background-color 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = 'var(--danger, #DC2626)'
                                  e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                              >
                                <X size={16} strokeWidth={1.8} />
                              </button>
                            </div>
                          ) : item.status === 'converted' && item.converted_job ? (
                            <button
                              type="button"
                              onClick={() => {
                                const j = jobs.find(job => job.id === item.converted_job)
                                if (j) handleOpenModal(j)
                                else handleTabSwitch('orders')
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text, #0A0A0A)',
                                fontSize: '12px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                padding: '4px 6px',
                                borderRadius: '6px',
                                textDecoration: 'underline'
                              }}
                            >
                              View #{item.converted_job_order_id || item.converted_job}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '12.5px' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </div>
      ) : (
        /* ── PART 2 & PART 3: ORDERS VIEW (MY JOB ORDERS & ASSIGNED JOB ORDERS) ── */
        <>
          {/* Admin Job Order Second Toggle (My Job Orders / Assigned Job Orders) */}
          {isAdmin && (
            <div style={{ marginBottom: '20px' }}>
              <CredAnimatedTabs
                className="cred-jobs-subtabs"
                tabs={[
                  { id: 'my', label: 'All Job Orders' },
                  { 
                    id: 'assigned', 
                    label: 'Assigned Job Orders', 
                    count: pendingAssignedCount > 0 ? pendingAssignedCount : undefined 
                  }
                ]}
                value={adminTab}
                onChange={(val) => { setAdminTab(val); setPage(1); }}
                layoutId="job-orders-admin-tabs"
              />
            </div>
          )}

          {/* 4 Financial KPI Summary Cards (My Job Orders only - Part 2.2 & 3) */}
          {adminTab === 'my' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '20px'
            }}>
              <div style={{
                background: 'var(--card-bg, #FFFFFF)',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '20px',
                padding: '18px 20px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
                  {isCancelledView ? 'Cancelled Contracts' : 'Total Contracts'}
                </div>
                <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text, #0A0A0A)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {isAdmin ? currentJobCount : '****'}
                </div>
              </div>

              <div style={{
                background: 'var(--card-bg, #FFFFFF)',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '20px',
                padding: '18px 20px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
                  {isCancelledView ? 'Cancelled Contract Value' : 'Total Contract Value'}
                </div>
                <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text, #0A0A0A)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {isAdmin ? (() => {
                    const parts = parseFloat(currentTotalVal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')
                    return (
                      <>
                        {parts[0]}<span style={{ opacity: 0.55, fontSize: '18px' }}>.{parts[1]}</span>
                        <span style={{ fontSize: '14px', color: 'var(--text-muted, #8C8C8C)', marginLeft: '4px', fontWeight: 400 }}>SAR</span>
                      </>
                    )
                  })() : '****'}
                </div>
              </div>

              <div style={{
                background: 'var(--card-bg, #FFFFFF)',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '20px',
                padding: '18px 20px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
                  {isCancelledView ? 'Money Collected' : 'Amount Collected'}
                </div>
                <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text, #0A0A0A)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {isAdmin ? (() => {
                    const parts = parseFloat(currentTotalPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')
                    return (
                      <>
                        {parts[0]}<span style={{ opacity: 0.55, fontSize: '18px' }}>.{parts[1]}</span>
                        <span style={{ fontSize: '14px', color: 'var(--text-muted, #8C8C8C)', marginLeft: '4px', fontWeight: 400 }}>SAR</span>
                      </>
                    )
                  })() : '****'}
                </div>
              </div>

              <div style={{
                background: 'var(--card-bg, #FFFFFF)',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '20px',
                padding: '18px 20px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
                  {isCancelledView ? 'Net Receivable Due' : 'Pending Balance'}
                </div>
                <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text, #0A0A0A)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {isAdmin ? (() => {
                    const parts = parseFloat(currentTotalBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')
                    return (
                      <>
                        {parts[0]}<span style={{ opacity: 0.55, fontSize: '18px' }}>.{parts[1]}</span>
                        <span style={{ fontSize: '14px', color: 'var(--text-muted, #8C8C8C)', marginLeft: '4px', fontWeight: 400 }}>SAR</span>
                      </>
                    )
                  })() : '****'}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {/* Search & Plain Filter Row (Part 1) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '20px',
            position: 'relative',
            zIndex: 30
          }}>
            <div style={{ flex: '1 1 240px', minWidth: '200px' }}>
              <CredSearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
                placeholder="Search contract, client or title..."
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <PlainFilterDropdown
                id="jobs-status-filter"
                value={filterStatus}
                onChange={(val) => { setFilterStatus(val); setPage(1); }}
                options={statusDropdownOptions}
                minWidth={110}
                ariaLabel="Filter status"
              />

              <PlainFilterDropdown
                id="jobs-payment-filter"
                value={filterPayment}
                onChange={(val) => { setFilterPayment(val); setPage(1); }}
                options={paymentDropdownOptions}
                minWidth={115}
                ariaLabel="Filter payment"
              />

              <PlainFilterDropdown
                id="jobs-client-filter"
                value={selectedClientBook}
                onChange={(val) => { setSelectedClientBook(val); setPage(1); }}
                options={clientDropdownOptions}
                minWidth={110}
                ariaLabel="Filter client"
              />

              <PlainFilterDropdown
                id="jobs-created-by-filter"
                value={filterCreatedBy}
                onChange={(val) => { setFilterCreatedBy(val); setPage(1); }}
                options={createdByDropdownOptions}
                minWidth={120}
                ariaLabel="Filter created by"
              />

              <PlainFilterDropdown
                id="jobs-salesperson-filter"
                value={filterSalesperson}
                onChange={(val) => { setFilterSalesperson(val); setPage(1); }}
                options={salespersonDropdownOptions}
                minWidth={125}
                ariaLabel="Filter salesperson"
              />

              {adminTab === 'assigned' && (
                <PlainFilterDropdown
                  id="jobs-staff-filter"
                  value={assignedStaffFilter}
                  onChange={(val) => { setAssignedStaffFilter(val); setPage(1); }}
                  options={staffDropdownOptions}
                  minWidth={95}
                  ariaLabel="Filter staff"
                />
              )}

              <PlainFilterDropdown
                id="jobs-sort-filter"
                value={`${sortField}:${sortDirection}`}
                onChange={(val) => {
                  const [sf, sd] = val.split(':')
                  setSortField(sf)
                  setSortDirection(sd)
                  setPage(1)
                }}
                options={sortDropdownOptions}
                minWidth={115}
                align="right"
                ariaLabel="Sort orders"
              />
            </div>
          </div>

          {/* Main Table (Cashbook table style, directly on page, no horizontal scroll) */}
          <div style={{ width: '100%', position: 'relative', marginBottom: '2.5rem' }}>
            {loading && jobs.length === 0 ? (
              <div style={{ padding: '1.5rem 0' }}>
                <SkeletonLoader type="table" />
              </div>
            ) : (
              <>
                {jobs.length === 0 && !error && (
                  <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                    <Briefcase size={22} strokeWidth={1.6} style={{ color: 'var(--text-muted, #8C8C8C)', opacity: 0.6, marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>
                      {searchQuery 
                        ? `No job orders matching "${searchQuery}".`
                        : adminTab === 'assigned'
                        ? 'No assigned job orders yet.'
                        : 'No job orders yet.'}
                    </p>
                  </div>
                )}

                {jobs.length > 0 && (
                  <>
                    <div className="desktop-only-table" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ width: '100%', minWidth: '1080px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: '11%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '11%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '10%' }} />
                          {customColumns.map(col => (
                            <col key={col.id} style={{ width: '100px' }} />
                          ))}
                          <col style={{ width: isAdmin && adminTab === 'assigned' ? '210px' : '180px' }} />
                        </colgroup>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)' }}>
                            <th 
                              onClick={() => handleSort('order_id')}
                              style={{ width: '11%', padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              title="Sort by Contract ID"
                            >
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                Contract ID
                                {sortField === 'order_id' && (
                                  sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleSort('title')}
                              style={{ width: '18%', padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              title="Sort by Title"
                            >
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                Engagement Title
                                {sortField === 'title' && (
                                  sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleSort('customer')}
                              style={{ width: '15%', padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              title="Sort by Client"
                            >
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                Associated Client
                                {sortField === 'customer' && (
                                  sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleSort('status')}
                              style={{ width: '12%', padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              title="Sort by Status"
                            >
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                Operational Status
                                {sortField === 'status' && (
                                  sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                )}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleSort('total_amount')}
                              style={{ width: '11%', padding: '10px 16px 10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              title="Sort by Total Value"
                            >
                              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', width: '100%' }}>
                                Total Val.
                                {sortField === 'total_amount' && (
                                  sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                )}
                              </div>
                            </th>
                            <th style={{ width: '10%', padding: '10px 16px 10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Paid</th>
                            <th style={{ width: '10%', padding: '10px 16px 10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Balance</th>
                            {customColumns.map(col => (
                              <th key={col.id} style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>
                                {col.label}
                              </th>
                            ))}
                            <th style={{ width: isAdmin && adminTab === 'assigned' ? '210px' : '180px', minWidth: isAdmin && adminTab === 'assigned' ? '210px' : '180px', padding: '10px 12px 10px 8px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobs.map(job => (
                            <tr 
                              key={job.id}
                              className="cred-table-row"
                              style={{ borderBottom: '1px solid var(--border, #E4E4E4)', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                              onClick={() => setSelectedJobForDetail(job)}
                            >
                              {/* Contract ID (Plain text, weight 500, tabular-nums) */}
                              <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text, #111111)', fontVariantNumeric: 'tabular-nums' }}>
                                  {job.order_id || `JOB${job.id.toString().padStart(4, '0')}`}
                                </span>
                              </td>

                              {/* Engagement Title (Client-facing Title) */}
                              <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                                <div style={{ fontWeight: 400, fontSize: '13px', color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {job.title}
                                </div>
                              </td>

                              {/* Associated Client (Client name only) */}
                              <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                                <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {job.customer_name}
                                </div>
                              </td>

                              {/* Operational Status (Plain text, small colored dot) */}
                              <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                {renderOperationalStatus(job.status)}
                              </td>

                              {/* Total Val. (Amount only, neutral Cashbook style) */}
                              <td style={{ textAlign: 'right', padding: '10px 16px 10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                {renderCashbookAmount(job.total_amount)}
                              </td>

                              {/* Paid (Neutral Cashbook style) */}
                              <td style={{ textAlign: 'right', padding: '10px 16px 10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                {renderCashbookAmount(job.paid_amount)}
                              </td>

                              {/* Balance (Neutral Cashbook style) */}
                              <td style={{ textAlign: 'right', padding: '10px 16px 10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                {job.status === 'Cancelled' ? (
                                  <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '12.5px' }}>—</span>
                                ) : (
                                  renderCashbookAmount(job.balance)
                                )}
                              </td>

                              {/* Custom columns */}
                              {customColumns.map(col => (
                                <td key={col.id} style={{ padding: '10px 10px', verticalAlign: 'middle', fontSize: '12.5px', color: 'var(--text, #111111)' }}>
                                  {job.custom_fields?.[col.name] !== undefined && job.custom_fields?.[col.name] !== ''
                                    ? String(job.custom_fields[col.name])
                                    : '—'}
                                </td>
                              ))}

                              {/* Actions */}
                              <td style={{ width: isAdmin && adminTab === 'assigned' ? '210px' : '180px', minWidth: isAdmin && adminTab === 'assigned' ? '210px' : '180px', textAlign: 'right', padding: '10px 12px 10px 8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                                {isAdmin && adminTab === 'assigned' ? (
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                                    {(() => {
                                      const jobAtts = getJobAttachments(job)
                                      if (jobAtts.length === 0) return null
                                      return (
                                        <button 
                                          type="button"
                                          className="cred-icon-action-btn" 
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            height: '30px',
                                            minWidth: '30px',
                                            flexShrink: 0,
                                            padding: '0 6px',
                                            color: 'var(--text-muted, #8C8C8C)',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '3px',
                                            borderRadius: '6px',
                                            transition: 'color 0.15s ease, background-color 0.15s ease'
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleOpenAttachmentPreview(jobAtts, 0)
                                          }}
                                          title={`View all ${jobAtts.length} attached photos/files`}
                                          aria-label="View Attachments"
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.color = 'var(--text, #0A0A0A)'
                                            e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                            e.currentTarget.style.backgroundColor = 'transparent'
                                          }}
                                        >
                                          <Paperclip size={15} strokeWidth={1.8} />
                                          <span style={{ fontSize: '11px', fontWeight: 600 }}>{jobAtts.length}</span>
                                        </button>
                                      )
                                    })()}
                                    <button 
                                      type="button"
                                      className="cred-icon-action-btn" 
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        width: '30px',
                                        height: '30px',
                                        flexShrink: 0,
                                        padding: 0,
                                        color: 'var(--text-muted, #8C8C8C)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '6px',
                                        transition: 'color 0.15s ease, background-color 0.15s ease'
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedJobForDetail(job)
                                      }}
                                      title="View Job Order & Contract Details"
                                      aria-label="View Details"
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = 'var(--text, #0A0A0A)'
                                        e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                        e.currentTarget.style.backgroundColor = 'transparent'
                                      }}
                                    >
                                      <LucideEye size={16} strokeWidth={1.8} />
                                    </button>
                                    <button 
                                      type="button"
                                      className="cred-text-action-btn"
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text, #0A0A0A)',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        flexShrink: 0,
                                        transition: 'background-color 0.15s ease'
                                      }}
                                      onClick={() => handleAcceptJob(job)}
                                      title="Accept: verify and take ownership of this job order and its ledger"
                                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)')}
                                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                      Accept
                                    </button>
                                    <button 
                                      type="button"
                                      className="cred-text-action-btn"
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted, #8C8C8C)',
                                        fontSize: '12px',
                                        fontWeight: 400,
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        flexShrink: 0,
                                        transition: 'color 0.15s ease, background-color 0.15s ease'
                                      }}
                                      onClick={() => handleCancelJob(job)}
                                      title="Cancel: cancel this job order"
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = 'var(--danger, #DC2626)'
                                        e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                        e.currentTarget.style.backgroundColor = 'transparent'
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                                    {(() => {
                                      const jobAtts = getJobAttachments(job)
                                      if (jobAtts.length === 0) return null
                                      return (
                                        <button 
                                          type="button"
                                          className="cred-icon-action-btn" 
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            height: '30px',
                                            minWidth: '30px',
                                            flexShrink: 0,
                                            padding: '0 6px',
                                            color: 'var(--text-muted, #8C8C8C)',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '3px',
                                            borderRadius: '6px',
                                            transition: 'color 0.15s ease, background-color 0.15s ease'
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleOpenAttachmentPreview(jobAtts, 0)
                                          }}
                                          title={`View all ${jobAtts.length} attached photos/files`}
                                          aria-label="View Attachments"
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.color = 'var(--text, #0A0A0A)'
                                            e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                            e.currentTarget.style.backgroundColor = 'transparent'
                                          }}
                                        >
                                          <Paperclip size={15} strokeWidth={1.8} />
                                          {jobAtts.length > 1 && (
                                            <span style={{ fontSize: '11px', fontWeight: 600 }}>{jobAtts.length}</span>
                                          )}
                                        </button>
                                      )
                                    })()}
                                    <button 
                                      type="button"
                                      className="cred-icon-action-btn" 
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        width: '30px',
                                        height: '30px',
                                        flexShrink: 0,
                                        padding: 0,
                                        color: 'var(--text-muted, #8C8C8C)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '6px',
                                        transition: 'color 0.15s ease, background-color 0.15s ease'
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedJobForDetail(job)
                                      }}
                                      title="View Job Order & Contract Details"
                                      aria-label="View Details"
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = 'var(--text, #0A0A0A)'
                                        e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                        e.currentTarget.style.backgroundColor = 'transparent'
                                      }}
                                    >
                                      <LucideEye size={16} strokeWidth={1.8} />
                                    </button>
                                    <button 
                                      type="button"
                                      className="cred-icon-action-btn" 
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        width: '30px',
                                        height: '30px',
                                        flexShrink: 0,
                                        padding: 0,
                                        color: 'var(--text-muted, #8C8C8C)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '6px',
                                        transition: 'color 0.15s ease, background-color 0.15s ease'
                                      }}
                                      onClick={() => handleOpenModal(job)}
                                      title="Edit"
                                      aria-label="Edit"
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = 'var(--text, #0A0A0A)'
                                        e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                        e.currentTarget.style.backgroundColor = 'transparent'
                                      }}
                                    >
                                      <Edit size={16} strokeWidth={1.8} />
                                    </button>

                                    {job.status !== 'Cancelled' ? (
                                      <button 
                                        type="button"
                                        className="cred-icon-action-btn" 
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          width: '30px',
                                          height: '30px',
                                          flexShrink: 0,
                                          padding: 0,
                                          color: 'var(--text-muted, #8C8C8C)',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          borderRadius: '6px',
                                          transition: 'color 0.15s ease, background-color 0.15s ease'
                                        }}
                                        onClick={() => handleCancelJob(job)}
                                        title="Cancel job order"
                                        aria-label="Cancel job order"
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.color = '#f59e0b'
                                          e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                          e.currentTarget.style.backgroundColor = 'transparent'
                                        }}
                                      >
                                        <XCircle size={16} strokeWidth={1.8} />
                                      </button>
                                    ) : (
                                      <button 
                                        type="button"
                                        className="cred-icon-action-btn" 
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          width: '30px',
                                          height: '30px',
                                          flexShrink: 0,
                                          padding: 0,
                                          color: 'var(--text-muted, #8C8C8C)',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          borderRadius: '6px',
                                          transition: 'color 0.15s ease, background-color 0.15s ease'
                                        }}
                                        onClick={() => handleRestoreJob(job)}
                                        title="Restore job order"
                                        aria-label="Restore job order"
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.color = 'var(--text, #0A0A0A)'
                                          e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                          e.currentTarget.style.backgroundColor = 'transparent'
                                        }}
                                      >
                                        <RotateCcw size={16} strokeWidth={1.8} />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Native Cards View (<= 768px) */}
                    <div className="mobile-only-cards" style={{ padding: '0.75rem 0' }}>
                      {jobs.map(job => {
                        const total = parseFloat(job.total_amount) || 0
                        const paid = parseFloat(job.paid_amount) || 0
                        const balance = parseFloat(job.balance) || 0
                        const orderId = job.order_id || `JOB${job.id.toString().padStart(4, '0')}`

                        return (
                          <div 
                            key={job.id} 
                            className="mobile-entity-card clickable-card"
                            onClick={() => setSelectedJobForDetail(job)}
                            style={{ marginBottom: '0.75rem', cursor: 'pointer' }}
                          >
                            <div className="mobile-card-header">
                              <div className="mobile-card-title-group">
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '3px' }}>
                                    <span style={{ fontWeight: 500, color: 'var(--text, #111111)', fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                                      {orderId}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {(() => {
                                      const attList = getJobAttachments(job)
                                      if (attList.length === 0) return null
                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleOpenAttachmentPreview(attList, 0)
                                          }}
                                          title={`View ${attList.length} attachment(s)`}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            padding: 0,
                                            color: 'var(--text-muted, #8C8C8C)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            flexShrink: 0,
                                            cursor: 'pointer'
                                          }}
                                        >
                                          <Paperclip size={13} />
                                          {attList.length > 1 && (
                                            <span style={{ fontSize: '11px', fontWeight: 600 }}>{attList.length}</span>
                                          )}
                                        </button>
                                      )
                                    })()}
                                    <div className="mobile-card-title" style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                                      {job.title}
                                    </div>
                                  </div>
                                  <div className="mobile-card-sub">
                                    <span style={{ fontWeight: 500, color: 'var(--text, #111111)' }}>{job.customer_name}</span>
                                  </div>
                                </div>
                              </div>
                              <div>
                                {renderOperationalStatus(job.status)}
                              </div>
                            </div>

                            <div className="mobile-card-grid" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontSize: '0.8rem' }}>
                              <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block' }}>Total Val</span>
                                <span>{renderCashbookAmount(total)}</span>
                              </div>
                              <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block' }}>Paid</span>
                                <span>{renderCashbookAmount(paid)}</span>
                              </div>
                              <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block' }}>Balance</span>
                                <span>{job.status === 'Cancelled' ? '—' : renderCashbookAmount(balance)}</span>
                              </div>
                            </div>

                            <div className="mobile-card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '0.5rem', borderTop: '1px solid var(--border, #E4E4E4)' }} onClick={(e) => e.stopPropagation()}>
                              {isAdmin && adminTab === 'assigned' ? (
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: '4px 6px',
                                      color: 'var(--text-muted, #8C8C8C)',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center'
                                    }}
                                    onClick={() => setSelectedJobForDetail(job)}
                                    title="View Details"
                                  >
                                    <LucideEye size={14} />
                                  </button>
                                  <button 
                                    type="button"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--text, #0A0A0A)',
                                      fontSize: '12px',
                                      fontWeight: 500,
                                      cursor: 'pointer',
                                      padding: '4px 8px',
                                      borderRadius: '6px'
                                    }}
                                    onClick={() => handleAcceptJob(job)}
                                  >
                                    Accept
                                  </button>
                                  <button 
                                    type="button"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--text-muted, #8C8C8C)',
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                      padding: '4px 8px',
                                      borderRadius: '6px'
                                    }}
                                    onClick={() => handleCancelJob(job)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <button 
                                    type="button"
                                    style={{ background: 'none', border: 'none', padding: '4px', color: 'var(--text-muted, #8C8C8C)', cursor: 'pointer' }}
                                    onClick={() => setSelectedJobForDetail(job)}
                                    title="View Details"
                                  >
                                    <LucideEye size={14} />
                                  </button>
                                  <button 
                                    type="button"
                                    style={{ background: 'none', border: 'none', padding: '4px', color: 'var(--text-muted, #8C8C8C)', cursor: 'pointer' }}
                                    onClick={() => handleOpenModal(job)}
                                    title="Edit"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  {job.status !== 'Cancelled' ? (
                                    <button 
                                      type="button"
                                      style={{ background: 'none', border: 'none', padding: '4px', color: 'var(--text-muted, #8C8C8C)', cursor: 'pointer' }}
                                      onClick={() => handleCancelJob(job)}
                                      title="Cancel job order"
                                      aria-label="Cancel job order"
                                    >
                                      <XCircle size={14} />
                                    </button>
                                  ) : (
                                    <button 
                                      type="button"
                                      style={{ background: 'none', border: 'none', padding: '4px', color: 'var(--text-muted, #8C8C8C)', cursor: 'pointer' }}
                                      onClick={() => handleRestoreJob(job)}
                                      title="Restore job order"
                                      aria-label="Restore job order"
                                    >
                                      <RotateCcw size={14} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Integrated Table Footer (Plain text, no border/box - Part 2.5) */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 4px 4px',
                      fontSize: '12px',
                      color: 'var(--text-muted, #8C8C8C)',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <span>Showing {jobs.length} of {Math.max(jobs.length, totalJobsCount)} job orders</span>

                      {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                          <button 
                            type="button"
                            disabled={page === 1}
                            onClick={() => setPage(prev => Math.max(1, prev - 1))}
                            style={{
                              padding: '4px 12px',
                              fontSize: '12px',
                              borderRadius: '9999px',
                              border: '1px solid var(--border, #E4E4E4)',
                              background: 'transparent',
                              color: page === 1 ? 'var(--text-muted, #8C8C8C)' : 'var(--text, #111111)',
                              cursor: page === 1 ? 'not-allowed' : 'pointer',
                              opacity: page === 1 ? 0.45 : 1
                            }}
                          >
                            Previous
                          </button>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', fontVariantNumeric: 'tabular-nums' }}>
                            Page {page} of {totalPages}
                          </span>
                          <button 
                            type="button"
                            disabled={page === totalPages}
                            onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                            style={{
                              padding: '4px 12px',
                              fontSize: '12px',
                              borderRadius: '9999px',
                              border: '1px solid var(--border, #E4E4E4)',
                              background: 'transparent',
                              color: page === totalPages ? 'var(--text-muted, #8C8C8C)' : 'var(--text, #111111)',
                              cursor: page === totalPages ? 'not-allowed' : 'pointer',
                              opacity: page === totalPages ? 0.45 : 1
                            }}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ── JOB ORDER MODAL (Create & Edit) ── */}
      <ModalShell
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSubmitting(false); setSelectedPendingForCreation(null); }}
        title={editingJob ? 'Edit Job Order' : (selectedPendingForCreation ? `Convert Pending Entry: ${selectedPendingForCreation.title || ''}` : 'New Job Order')}
        maxWidth="720px"
        formId="job-order-form"
        submitLabel={editingJob ? 'Save Changes' : 'Create Job Order'}
        submittingLabel={editingJob ? 'Saving...' : 'Creating...'}
        submitting={submitting}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', width: '100%' }}>
            {editingJob && editingJob.status !== 'Cancelled' && (
              <button
                type="button"
                className="cred-modal-cancel-btn"
                style={{ marginRight: 'auto', color: 'var(--danger, #DC2626)', borderColor: 'var(--border, #E4E4E4)' }}
                onClick={() => handleCancelJob(editingJob)}
              >
                Cancel Job Order
              </button>
            )}
            {editingJob && editingJob.status === 'Cancelled' && isAdmin && (
              <button
                type="button"
                className="cred-modal-cancel-btn"
                style={{ marginRight: 'auto', color: 'var(--positive, #19B25B)', borderColor: 'var(--border, #E4E4E4)' }}
                onClick={() => handleRestoreJob(editingJob)}
              >
                Restore Job Order
              </button>
            )}
            <button
              type="button"
              className="cred-modal-cancel-btn"
              onClick={() => { setIsModalOpen(false); setSubmitting(false); setSelectedPendingForCreation(null); }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="job-order-form"
              className="cred-modal-submit-btn"
              disabled={submitting}
            >
              {submitting ? (editingJob ? 'Saving...' : 'Creating...') : (editingJob ? 'Save Changes' : 'Create Job Order')}
            </button>
          </div>
        }
      >
        <form id="job-order-form" onSubmit={handleSubmit}>
          {formError && (
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              color: '#DC2626',
              fontSize: '12.5px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{formError}</span>
            </div>
          )}

          {selectedPendingForCreation && (
            <div style={{
              background: 'var(--fill-ghost-hover, #F4F4F4)',
              border: '1px solid var(--border, #E4E4E4)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--text, #111111)',
              marginBottom: '16px'
            }}>
              <Clock size={16} style={{ color: 'var(--text-muted, #8C8C8C)', flexShrink: 0 }} />
              <span>
                Converting rough entry <strong>{selectedPendingForCreation.title}</strong> into an official Job Order.
                {(parseFloat(selectedPendingForCreation.initial_deposit) || 0) > 0 && (
                  <> Initial deposit of <strong>{(parseFloat(selectedPendingForCreation.initial_deposit)).toLocaleString()} SAR</strong> is pre-filled as Advance.</>
                )}
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 20px', padding: '4px 0' }}>
            {/* 1. Job Title (required, full width) */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Job Title" required>
                <CreatableSelect
                  isClearable
                  options={jobTitles.map(t => ({ label: t, value: t }))}
                  value={formData.title ? { label: formData.title, value: formData.title } : null}
                  onChange={(selected) => setFormData({ ...formData, title: selected ? selected.value : '' })}
                  onInputChange={(val) => { if (val) setFormData(prev => ({ ...prev, title: val })) }}
                  noOptionsMessage={({ inputValue }) => inputValue ? `Press Enter to use "${inputValue}"` : 'Type to add a title'}
                  formatCreateLabel={(val) => `+ Use "${val}"`}
                  components={{ Option: CustomTitleOption }}
                  styles={credSelectStyles}
                  classNamePrefix="cred-react-select"
                  menuPosition="fixed"
                  menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                  placeholder="Select or type job title..."
                />
              </Field>
            </div>

            {/* 2. Linked Project (full width) */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Linked Project">
                <CreatableSelect
                  isClearable
                  options={projectOptions.map(p => ({ label: p, value: p }))}
                  value={formData.project_name ? { label: formData.project_name, value: formData.project_name } : null}
                  onChange={(selected) => setFormData({ ...formData, project_name: selected ? selected.value : '' })}
                  onInputChange={(val) => { if (val) setFormData(prev => ({ ...prev, project_name: val })) }}
                  formatCreateLabel={(val) => `+ Link to Project "${val}"`}
                  components={{ Option: CredOption }}
                  styles={credSelectStyles}
                  classNamePrefix="cred-react-select"
                  menuPosition="fixed"
                  menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                  placeholder="Select or link a project..."
                />
              </Field>
            </div>

            {/* 3. Customer (required) with small "+ New" link & Vendor side by side */}
            <div>
              <Field
                label="Customer"
                required
                rightAction={
                  <InlineAddLink
                    onClick={() => setIsCustomerModalOpen(true)}
                    label="+ New"
                  />
                }
              >
                <Select
                  isClearable
                  options={customers.map(c => ({
                    label: c.company_name ? `${c.name} (${c.company_name})` : c.name,
                    value: c.id
                  }))}
                  value={formData.customer ? {
                    label: (() => {
                      const c = customers.find(x => String(x.id) === String(formData.customer))
                      return c ? (c.company_name ? `${c.name} (${c.company_name})` : c.name) : ''
                    })(),
                    value: formData.customer
                  } : null}
                  onChange={(selected) => {
                    const newCustomerId = selected ? selected.value : ''
                    setFormData({ ...formData, customer: newCustomerId })
                    if (!editingJob) fetchCustomerPriorBalance(newCustomerId)
                  }}
                  noOptionsMessage={() => 'No customers found'}
                  components={{ Option: CredOption }}
                  styles={credSelectStyles}
                  classNamePrefix="cred-react-select"
                  menuPosition="fixed"
                  menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                  placeholder="Select customer..."
                />
                {!editingJob && formData.customer && customerPriorBalance > 0 && (
                  <div style={{
                    marginTop: '6px',
                    fontSize: '12px',
                    color: 'var(--text-muted, #8C8C8C)'
                  }}>
                    Prior outstanding balance: {formatCurrency(customerPriorBalance)}
                  </div>
                )}
                {editingJob && parseFloat(editingJob.prior_balance || 0) > 0 && (
                  <div style={{
                    marginTop: '6px',
                    fontSize: '12px',
                    color: 'var(--text-muted, #8C8C8C)'
                  }}>
                    Carried forward prior balance: {formatCurrency(editingJob.prior_balance)}
                  </div>
                )}
              </Field>
            </div>

            <div>
              <Field label="Vendor">
                <Select
                  isClearable
                  options={vendors.map(v => ({
                    label: v.company_name ? `${v.name} (${v.company_name})` : v.name,
                    value: v.id
                  }))}
                  value={formData.vendor ? {
                    label: (() => {
                      const v = vendors.find(x => String(x.id) === String(formData.vendor))
                      return v ? (v.company_name ? `${v.name} (${v.company_name})` : v.name) : ''
                    })(),
                    value: formData.vendor
                  } : null}
                  onChange={(selected) => setFormData({ ...formData, vendor: selected ? selected.value : '' })}
                  noOptionsMessage={() => 'No vendors found'}
                  components={{ Option: CredOption }}
                  styles={credSelectStyles}
                  classNamePrefix="cred-react-select"
                  menuPosition="fixed"
                  menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                  placeholder="Select vendor..."
                />
              </Field>
            </div>

            {/* 4. Status (required) and Estimated Amount side by side */}
            <div>
              <Field label="Status" required>
                <CredSelect
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  required
                >
                  <option value="">-- Select Status --</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </CredSelect>
              </Field>
            </div>

            <div>
              <Field label="Estimated Amount">
                <NumberInput
                  prefix="SAR"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                  placeholder="0.00"
                />
              </Field>
            </div>

            {/* 5. Payment Structure and Invoice Number side by side */}
            <div>
              <Field label="Payment Structure">
                <CredSelect
                  value={formData.payment_type || 'full'}
                  onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                >
                  <option value="full">Full Payment</option>
                  <option value="advance">Advance + Balance Later</option>
                  <option value="installment">Installments</option>
                </CredSelect>
              </Field>
            </div>

            <div>
              <Field label="Invoice Number">
                <TextInput
                  value={formData.invoice_number || ''}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder="e.g. INV-001"
                />
              </Field>
            </div>

            {/* Advance Amount (if payment_type is advance or installment) */}
            {(formData.payment_type === 'advance' || formData.payment_type === 'installment') && (
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Advance Amount Received">
                  <NumberInput
                    prefix="SAR"
                    value={formData.advance_amount || ''}
                    onChange={(e) => setFormData({ ...formData, advance_amount: e.target.value })}
                    placeholder="0.00"
                  />
                </Field>
              </div>
            )}

            {/* 6. Quotation Number and Created By side by side */}
            <div>
              <Field label="Quotation Number">
                <TextInput
                  value={formData.quotation_number || ''}
                  onChange={(e) => setFormData({ ...formData, quotation_number: e.target.value })}
                  placeholder="e.g. Q-001"
                />
              </Field>
            </div>

            <div>
              <Field label="Created By">
                <TextInput
                  value={formData.created_by_staff || currentUser?.username || ''}
                  disabled
                  readOnly
                  style={{
                    backgroundColor: 'var(--fill-ghost-hover, #F4F4F4)',
                    color: 'var(--text-muted, #8C8C8C)'
                  }}
                />
              </Field>
            </div>

            {/* 7. Salesperson (with + New link & in-dropdown option) and Payment Collected By side by side */}
            <div>
              <Field
                label="Salesperson"
                rightAction={
                  <InlineAddLink
                    onClick={() => setIsSalespersonModalOpen(true)}
                    label="+ New"
                  />
                }
              >
                <Select
                  isClearable
                  options={[
                    ...salespersons.map(s => ({
                      label: s.name + (s.phone ? ` (${s.phone})` : ''),
                      value: s.id,
                      name: s.name
                    })),
                    { label: '+ Add New Salesperson...', value: '__ADD_NEW__', isAction: true }
                  ]}
                  value={formData.salesperson ? {
                    label: (() => {
                      const sp = salespersons.find(x => String(x.id) === String(formData.salesperson))
                      return sp ? (sp.name + (sp.phone ? ` (${sp.phone})` : '')) : (formData.salesperson_name || 'Selected')
                    })(),
                    value: formData.salesperson
                  } : null}
                  onChange={(selected) => {
                    if (selected?.value === '__ADD_NEW__') {
                      setIsSalespersonModalOpen(true)
                      return
                    }
                    setFormData({
                      ...formData,
                      salesperson: selected ? selected.value : '',
                      salesperson_name: selected ? selected.name : ''
                    })
                  }}
                  noOptionsMessage={() => 'No salespersons found'}
                  components={{ Option: CredOption }}
                  styles={credSelectStyles}
                  classNamePrefix="cred-react-select"
                  menuPosition="fixed"
                  menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                  placeholder="Select salesperson..."
                />
              </Field>
            </div>

            <div>
              <Field label="Payment Collected By">
                <TextInput
                  value={formData.payment_collected_by || ''}
                  onChange={(e) => setFormData({ ...formData, payment_collected_by: e.target.value })}
                  list="staff-options-list"
                  placeholder="Staff member"
                />
              </Field>
            </div>

            {/* 8. Assign to Admin */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Field
                label="Assign to Admin"
                required={!isAdmin}
                tooltip="When accepted by this Admin, full ownership and all financial calculations/transactions will sit under their account."
              >
                <CredSelect
                  value={formData.assigned_to || ''}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  required={!isAdmin}
                >
                  <option value="">{isAdmin ? '-- Auto-Assigned to Admin Team --' : 'Select admin...'}</option>
                  {assignableAdmins.map(adm => (
                    <option key={adm.id} value={adm.id}>
                      {adm.name} ({adm.username})
                    </option>
                  ))}
                </CredSelect>
              </Field>
            </div>

            <datalist id="staff-options-list">
              {staffOptions.map((s, idx) => (
                <option key={idx} value={s.name}>{s.username}</option>
              ))}
            </datalist>

            {/* 8. Scope of Work (full width repeatable rows) */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Scope of Work">
                <RowList
                  items={descriptions}
                  onChange={handleDescriptionChange}
                  onAdd={handleAddDescription}
                  onRemove={handleRemoveDescription}
                  placeholder="Enter scope item..."
                  addLabel="+ Add item"
                />
              </Field>
            </div>

            {/* 9. Contract ID (automatic & disabled) */}
            <div>
              <Field label="Contract ID">
                <TextInput
                  prefix={contractPrefix || 'JOB'}
                  value={contractNumber}
                  placeholder="0015"
                  disabled
                  readOnly
                  title="Contract ID is generated automatically"
                />
              </Field>
            </div>

            {/* 10. Dynamic Custom Form Fields */}
            <div style={{ gridColumn: '1 / -1' }}>
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

            {/* 11. Attachments (Supports multiple files) */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Attachments">
                <Dropzone
                  multiple
                  values={attachments}
                  onUpload={handleAttachmentChange}
                  onRemove={handleRemoveAttachment}
                  onPreview={(item) => handleOpenAttachmentPreview(item.url, item.name, item.type)}
                  placeholder="Click or drag files to upload documents or images"
                  hint="PDF, JPG, PNG up to 10MB (Multiple files allowed)"
                />
              </Field>
            </div>
          </div>
        </form>
      </ModalShell>

      {/* ── CREATE CUSTOMER MODAL (Upgraded to shared primitives) ── */}
      <ModalShell
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="New Customer"
        maxWidth="480px"
        formId="quick-customer-form"
        submitLabel="Create Customer"
        submittingLabel="Saving..."
        submitting={submittingCustomer}
      >
        <form id="quick-customer-form" onSubmit={handleCustomerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
          <Field label="Full Name" required>
            <TextInput
              value={customerForm.name}
              onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
              required
              placeholder="e.g. Abdullah Al-Otaibi"
            />
          </Field>

          <Field label="Company Name">
            <TextInput
              value={customerForm.company_name || ''}
              onChange={e => setCustomerForm({ ...customerForm, company_name: e.target.value })}
              placeholder="e.g. Al-Otaibi Trading"
            />
          </Field>

          <Field label="Phone Number">
            <TextInput
              value={customerForm.phone}
              onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })}
              placeholder="e.g. +966 50 123 4567"
            />
          </Field>

          <Field label="Email Address">
            <TextInput
              type="email"
              value={customerForm.email}
              onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })}
              placeholder="e.g. abdullah@example.com"
            />
          </Field>
        </form>
      </ModalShell>

      {/* ── CREATE SALESPERSON MODAL (Upgraded to shared primitives) ── */}
      <ModalShell
        isOpen={isSalespersonModalOpen}
        onClose={() => setIsSalespersonModalOpen(false)}
        title="New Salesperson"
        maxWidth="460px"
        formId="quick-salesperson-form"
        submitLabel="Add Salesperson"
        submittingLabel="Saving..."
        submitting={submittingSalesperson}
      >
        <form id="quick-salesperson-form" onSubmit={handleQuickCreateSalesperson} style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
          <Field label="Salesperson Name" required>
            <TextInput
              required
              autoFocus
              placeholder="e.g. Tariq Mansoor"
              value={newSalespersonForm.name}
              onChange={(e) => setNewSalespersonForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </Field>

          <Field label="Phone Number">
            <TextInput
              placeholder="e.g. +966 55 987 6543"
              value={newSalespersonForm.phone}
              onChange={(e) => setNewSalespersonForm(prev => ({ ...prev, phone: e.target.value }))}
            />
          </Field>

          <Field label="Email Address">
            <TextInput
              type="email"
              placeholder="e.g. tariq@arabseason.club"
              value={newSalespersonForm.email}
              onChange={(e) => setNewSalespersonForm(prev => ({ ...prev, email: e.target.value }))}
            />
          </Field>
        </form>
      </ModalShell>

      {/* ── PREVIEW ATTACHMENT MODAL (Supports Multi-Image Carousel & Inspection) ── */}
      {previewAttachment && (
        <ModalShell
          isOpen={!!previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          title={`Attachment: ${previewAttachment.name}${previewAttachment.list && previewAttachment.list.length > 1 ? ` (${previewAttachment.currentIndex + 1} of ${previewAttachment.list.length})` : ''}`}
          maxWidth="840px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {previewAttachment.list && previewAttachment.list.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="cred-modal-cancel-btn"
                      onClick={handlePrevPreview}
                      disabled={previewAttachment.currentIndex <= 0}
                      style={{ opacity: previewAttachment.currentIndex <= 0 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <button
                      type="button"
                      className="cred-modal-cancel-btn"
                      onClick={handleNextPreview}
                      disabled={previewAttachment.currentIndex >= previewAttachment.list.length - 1}
                      style={{ opacity: previewAttachment.currentIndex >= previewAttachment.list.length - 1 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="cred-modal-cancel-btn"
                  onClick={() => setPreviewAttachment(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="cred-modal-submit-btn"
                  onClick={() => handleDownloadAttachment(previewAttachment.dataUrl, previewAttachment.name, previewAttachment.type)}
                >
                  <Download size={14} /> Download File
                </button>
              </div>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              maxHeight: '65vh',
              overflow: 'auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'var(--fill-ghost-hover, #F4F4F4)',
              borderRadius: '12px',
              padding: '0.5rem',
              border: '1px solid var(--border, #E4E4E4)'
            }}>
              {previewAttachment.type?.includes('pdf') || previewAttachment.name?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewAttachment.blobUrl || previewAttachment.dataUrl}
                  style={{ width: '100%', height: '62vh', border: 'none', borderRadius: '8px' }}
                  title={previewAttachment.name}
                />
              ) : (
                <img
                  src={previewAttachment.blobUrl || previewAttachment.dataUrl}
                  alt={previewAttachment.name}
                  style={{ maxWidth: '100%', maxHeight: '62vh', objectFit: 'contain', borderRadius: '8px' }}
                />
              )}
            </div>

            {/* Thumbnail carousel strip if multiple attachments */}
            {previewAttachment.list && previewAttachment.list.length > 1 && (
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '6px 2px', alignItems: 'center' }}>
                {previewAttachment.list.map((item, idx) => {
                  const isImg = item.url?.startsWith('data:image/') || item.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(item.name || '')
                  const isCur = idx === previewAttachment.currentIndex
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleOpenAttachmentPreview(previewAttachment.list, idx)}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '6px',
                        border: isCur ? '2px solid #0F7638' : '1px solid var(--border, #E4E4E4)',
                        padding: 0,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        background: '#ffffff',
                        flexShrink: 0,
                        opacity: isCur ? 1 : 0.65,
                        transition: 'all 0.15s ease'
                      }}
                      title={item.name || `Photo ${idx + 1}`}
                    >
                      {isImg ? (
                        <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                          <Paperclip size={16} />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </ModalShell>
      )}

      {/* ── JOB ORDER DETAIL / PDF VIEW MODAL ── */}
      {selectedJobForDetail && (
        <JobOrderDetailModal
          isOpen={!!selectedJobForDetail}
          onClose={() => setSelectedJobForDetail(null)}
          job={selectedJobForDetail}
          currentUser={currentUser}
          onUpdateJob={(updated) => {
            setJobs(prev => prev.map(j => j.id === updated.id ? { ...j, ...updated } : j))
            setSelectedJobForDetail(prev => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev))
          }}
          onEditOrder={(job) => {
            setSelectedJobForDetail(null)
            handleOpenModal(job)
          }}
        />
      )}

      {/* ── Scoped CRED Styles for Job Orders Page ── */}
      <style>{`
        .cred-jobs-tabs .cred-atabs-count,
        .cred-jobs-subtabs .cred-atabs-count {
          background: transparent !important;
          padding: 0 !important;
          margin-left: 6px !important;
          font-weight: 500 !important;
          font-size: 12px !important;
          opacity: 0.75 !important;
          border-radius: 0 !important;
        }
        .cred-jobs-tabs .cred-atabs-tab.is-active .cred-atabs-count,
        .cred-jobs-subtabs .cred-atabs-tab.is-active .cred-atabs-count {
          background: transparent !important;
          color: var(--tab-active-text, #FFFFFF) !important;
          opacity: 0.95 !important;
        }
        .cred-table-row:hover {
          background: var(--fill-ghost-hover, #F7F7F7) !important;
        }
        .jobs-page .cred-search {
          height: 38px !important;
          background: var(--card-bg, #FFFFFF) !important;
          border: 1px solid var(--border, #E4E4E4) !important;
          border-radius: 10px !important;
          padding: 0 12px !important;
          box-shadow: none !important;
          transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
        }
        .jobs-page .cred-search:hover {
          border-color: var(--border-hover, #D4D4D4) !important;
        }
        .jobs-page .cred-search:focus-within {
          border-color: var(--text, #0A0A0A) !important;
          box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.08) !important;
          background: var(--card-bg, #FFFFFF) !important;
        }
        [data-theme='dark'] .jobs-page .cred-search,
        body.cb-dark-bw .jobs-page .cred-search {
          background: #141517 !important;
          border-color: #282B32 !important;
        }
        [data-theme='dark'] .jobs-page .cred-search:focus-within,
        body.cb-dark-bw .jobs-page .cred-search:focus-within {
          border-color: #FFFFFF !important;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1) !important;
          background: #141517 !important;
        }
        [data-theme='dark'] .cred-jobs-submit-btn,
        body.cb-dark-bw .cred-jobs-submit-btn {
          background: #FFFFFF !important;
          color: #0A0A0A !important;
          border: 1px solid #E4E4E4 !important;
        }
        [data-theme='dark'] .cred-jobs-submit-btn:hover,
        body.cb-dark-bw .cred-jobs-submit-btn:hover {
          background: #EAEAEA !important;
        }
      `}</style>

    </div>
  )
}

export default JobOrders