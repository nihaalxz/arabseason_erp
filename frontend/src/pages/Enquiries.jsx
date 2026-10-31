import { useState, useEffect, useRef, useMemo } from 'react'
import { GooeyMenu } from '../components/cashbook/cred/GooeyMenu'
import { CredAnimatedTabs } from '../components/cashbook/cred/CredAnimatedTabs'
import CredSearchInput from '../components/cashbook/cred/CredSearchInput'
import { useNavigate } from 'react-router-dom'
import { 
  Phone, Mail, MessageSquare, Plus, Search, Calendar, 
  Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, 
  FileText, Trash2, Edit3, Eye, UploadCloud, 
  X, ChevronRight, Check, RotateCcw, UserCheck, User,
  Filter, ChevronDown, Printer
} from 'lucide-react'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'
import SearchBar from '../components/common/SearchBar'
import SkeletonLoader from '../components/common/SkeletonLoader'
import Modal from '../components/common/Modal'
import { showConfirm, showError, showToast, showSuccess } from '../utils/swal'
import { handlePdfResponse } from '../utils/pdfDownload'

const CHANNEL_CONFIG = {
  whatsapp: { label: 'WhatsApp', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)', border: 'rgba(22, 163, 74, 0.25)' },
  phone_call: { label: 'Phone Call', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)', border: 'rgba(37, 99, 235, 0.25)' },
  email: { label: 'Email', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.1)', border: 'rgba(147, 51, 234, 0.25)' },
  walk_in: { label: 'Walk-in', color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)', border: 'rgba(217, 119, 6, 0.25)' },
  website: { label: 'Website', color: '#0891b2', bg: 'rgba(8, 145, 178, 0.1)', border: 'rgba(8, 145, 178, 0.25)' },
  other: { label: 'Other', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', border: 'rgba(100, 116, 139, 0.25)' },
}

const STATUS_CONFIG = {
  enquiry: { label: 'New Enquiry', color: '#1366d9', bg: '#ebf3fc' },
  quotation_pending: { label: 'Quotation Pending', color: '#d97706', bg: '#fef3c7' },
  quotation_sent: { label: 'Quotation Sent', color: '#7c3aed', bg: '#ede9fe' },
  under_followup: { label: 'Under Follow-up', color: '#0284c7', bg: '#e0f2fe' },
  converted: { label: 'Lead Converted', color: '#0f7638', bg: '#dcfce7' },
  cancelled: { label: 'Cancelled / Lost', color: '#dc2626', bg: '#fee2e2' },
}

const OUTCOME_CONFIG = {
  interested: { label: 'Interested / Considering', color: '#0284c7', bg: '#e0f2fe' },
  requested_discount: { label: 'Requested Price Discount', color: '#d97706', bg: '#fef3c7' },
  will_revert: { label: 'Will Revert Later', color: '#475569', bg: '#f1f5f9' },
  quotation_requested: { label: 'Asked for Formal Quotation', color: '#7c3aed', bg: '#ede9fe' },
  ready_to_close: { label: 'Ready to Confirm / Won', color: '#0f7638', bg: '#dcfce7' },
  not_interested: { label: 'Declined / Not Interested', color: '#dc2626', bg: '#fee2e2' },
  unreachable: { label: 'Unreachable / No Answer', color: '#64748b', bg: '#f8fafc' },
  other: { label: 'Other Outcome', color: '#64748b', bg: '#f1f5f9' },
}

const CONTACT_MODE_CONFIG = {
  phone_call: { label: 'Phone Call', icon: Phone, color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' },
  email: { label: 'Email', icon: Mail, color: '#9333ea', bg: 'rgba(147, 51, 234, 0.1)' },
  meeting: { label: 'In-Person Meeting', icon: UserCheck, color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)' },
  other: { label: 'Other Mode', icon: Calendar, color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' },
}

const CANCELLATION_REASONS = [
  { id: 'price_high', label: 'Price Too High / Competitor Cheaper' },
  { id: 'client_postponed', label: 'Client Postponed / Event Cancelled' },
  { id: 'unresponsive', label: 'Client Unresponsive' },
  { id: 'specs_unmet', label: 'Specifications Could Not Be Met' },
  { id: 'turnaround_time', label: 'Delivery Deadline Too Tight' },
  { id: 'other', label: 'Other Reason' },
]

export default function Enquiries({ currentUser }) {
  const { formatCurrency } = useSettings()
  const navigate = useNavigate()

  // Primary State
  const [enquiries, setEnquiries] = useState([])
  const [customers, setCustomers] = useState([])
  const [salespersons, setSalespersons] = useState([])
  const [metrics, setMetrics] = useState({
    active_count: 0,
    due_today_count: 0,
    overdue_count: 0,
    converted_count: 0,
    cancelled_count: 0,
    conversion_rate: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Section Switcher State: 'active' | 'converted' | 'cancelled'
  const [activeSection, setActiveSection] = useState('active')
  const [selectedChannel, setSelectedChannel] = useState('all')
  const [salespersonFilter, setSalespersonFilter] = useState('all')
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dueTodayOnly, setDueTodayOnly] = useState(false)
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const [downloadingPdfId, setDownloadingPdfId] = useState(null)
  const filterMenuRef = useRef(null)

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isSalespersonModalOpen, setIsSalespersonModalOpen] = useState(false)
  const [selectedEnquiry, setSelectedEnquiry] = useState(null)
  const [previewMediaUrl, setPreviewMediaUrl] = useState(null)

  // Form State for Quick Salesperson Creation
  const [newSalespersonForm, setNewSalespersonForm] = useState({ name: '', phone: '', email: '' })
  const [savingSalesperson, setSavingSalesperson] = useState(false)

  // Form State for Create / Edit
  const [formData, setFormData] = useState({
    customer_id: '',
    customer_name: '',
    phone: '',
    email: '',
    salesperson: '',
    salesperson_name: '',
    channel: 'whatsapp',
    date: new Date().toISOString().split('T')[0],
    title: '',
    description: '',
    estimated_value: '',
    status: 'enquiry',
    next_follow_up_date: '',
    attachment: '',
    attachment_name: '',
    attachment_type: ''
  })
  const [isEditing, setIsEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Form State for Log Follow-Up
  const [followUpData, setFollowUpData] = useState({
    contact_mode: 'phone_call',
    outcome: 'interested',
    notes: '',
    next_follow_up_date: '',
    cancellation_reason: 'price_high'
  })

  // Form State for Cancel
  const [cancelData, setCancelData] = useState({
    cancellation_reason: 'price_high',
    cancellation_notes: ''
  })

  const fileInputRef = useRef(null)

  // Options for GooeyMenu dropdowns
  const customerOptions = useMemo(() => [
    { value: '', label: 'Select existing customer' },
    ...customers.map(c => ({
      value: String(c.id),
      label: c.name + (c.company_name ? ` (${c.company_name})` : '')
    }))
  ], [customers])

  const channelOptions = useMemo(() => [
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'phone_call', label: 'Phone Call' },
    { value: 'email', label: 'Email' },
    { value: 'walk_in', label: 'Walk-in' },
    { value: 'website', label: 'Website / Online' },
    { value: 'other', label: 'Other' },
  ], [])

  const salespersonOptions = useMemo(() => [
    { value: '', label: 'Select salesperson' },
    ...salespersons.map(s => ({
      value: String(s.id),
      label: s.name + (s.phone ? ` (${s.phone})` : '')
    }))
  ], [salespersons])

  // Universal refresh event listener
  useEffect(() => {
    const handleAppRefresh = () => {
      fetchEnquiries()
      fetchMetrics()
      fetchCustomers()
      fetchSalespersons()
    }
    window.addEventListener('app:refresh', handleAppRefresh)
    return () => window.removeEventListener('app:refresh', handleAppRefresh)
  }, [activeSection, selectedChannel, salespersonFilter, outcomeFilter, searchQuery, dueTodayOnly])

  // Fetch initial data
  useEffect(() => {
    fetchCustomers()
    fetchSalespersons()
    fetchMetrics()
  }, [])

  useEffect(() => {
    fetchEnquiries()
  }, [activeSection, selectedChannel, salespersonFilter, outcomeFilter, searchQuery, dueTodayOnly])

  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setIsFilterMenuOpen(false)
      }
    }
    if (isFilterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isFilterMenuOpen])

  const fetchCustomers = async () => {
    try {
      const res = await api.get('customers/?page_size=200')
      const raw = res.data.results || res.data || []
      setCustomers(raw)
    } catch (err) {
      console.error('Failed to load customers:', err)
    }
  }

  const fetchSalespersons = async () => {
    try {
      const res = await api.get('salespersons/?page_size=200')
      const raw = res.data.results || res.data || []
      setSalespersons(raw)
    } catch (err) {
      console.error('Failed to load salespersons:', err)
    }
  }

  const fetchMetrics = async () => {
    try {
      const res = await api.get('enquiries/metrics/')
      setMetrics(res.data)
    } catch (err) {
      console.error('Failed to load metrics:', err)
    }
  }

  const fetchEnquiries = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page_size: 200 }
      if (activeSection === 'active') {
        params.status = 'active'
      } else if (activeSection === 'converted') {
        params.status = 'completed'
      } else if (activeSection === 'cancelled') {
        params.status = 'cancelled'
      }

      if (selectedChannel !== 'all') {
        params.channel = selectedChannel
      }

      if (salespersonFilter !== 'all') {
        params.salesperson = salespersonFilter
      }

      if (outcomeFilter !== 'all') {
        params.outcome = outcomeFilter
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }

      if (dueTodayOnly) {
        params.follow_up = 'due_today'
      }

      const res = await api.get('enquiries/', { params })
      const raw = res.data.results || res.data || []
      setEnquiries(raw)
    } catch (err) {
      console.error('Failed to load enquiries:', err)
      setError('Failed to load enquiries. Please check connection.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Attachment Upload
  const handleAttachmentChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      showError('File Too Large', 'Please select a photo or document smaller than 10MB.')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setFormData(prev => ({
        ...prev,
        attachment: reader.result,
        attachment_name: file.name,
        attachment_type: file.type
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
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Open Create / Edit Modal
  const handleOpenModal = (enq = null) => {
    setFormError('')
    if (enq) {
      if (enq.status === 'converted' || Boolean(enq.converted_at)) {
        showToast('Converted leads cannot be edited.', 'info')
        return
      }
      setSelectedEnquiry(enq)
      setIsEditing(true)
      setFormData({
        customer_id: enq.customer || '',
        customer_name: enq.customer_name || enq.customer_detail?.name || '',
        phone: enq.phone || enq.customer_detail?.phone || '',
        email: enq.email || enq.customer_detail?.email || '',
        salesperson: enq.salesperson || '',
        salesperson_name: enq.salesperson_name || enq.salesperson_detail?.name || '',
        channel: enq.channel || 'whatsapp',
        date: enq.date || new Date().toISOString().split('T')[0],
        title: enq.title || '',
        description: enq.description || '',
        estimated_value: enq.estimated_value || '',
        status: enq.status || 'enquiry',
        next_follow_up_date: enq.next_follow_up_date || '',
        attachment: enq.attachment || '',
        attachment_name: enq.attachment_name || '',
        attachment_type: enq.attachment_type || ''
      })
    } else {
      setSelectedEnquiry(null)
      setIsEditing(false)
      setFormData({
        customer_id: '',
        customer_name: '',
        phone: '',
        email: '',
        salesperson: '',
        salesperson_name: '',
        channel: 'whatsapp',
        date: new Date().toISOString().split('T')[0],
        title: '',
        description: '',
        estimated_value: '',
        status: 'enquiry',
        next_follow_up_date: '',
        attachment: '',
        attachment_name: '',
        attachment_type: ''
      })
    }
    setIsModalOpen(true)
  }

  // Quick Create Salesperson Handler
  const handleQuickCreateSalesperson = async (e) => {
    e.preventDefault()
    const name = newSalespersonForm.name.trim()
    if (!name) return
    setSavingSalesperson(true)
    try {
      const res = await api.post('salespersons/', {
        name,
        phone: newSalespersonForm.phone.trim(),
        email: newSalespersonForm.email.trim()
      })
      const created = res.data
      setSalespersons(prev => [...prev.filter(s => s.id !== created.id), created].sort((a, b) => a.name.localeCompare(b.name)))
      setFormData(prev => ({
        ...prev,
        salesperson: created.id,
        salesperson_name: created.name
      }))
      setIsSalespersonModalOpen(false)
      setNewSalespersonForm({ name: '', phone: '', email: '' })
      showToast(`Salesperson "${created.name}" created and selected!`, 'success')
    } catch (err) {
      console.error('Failed to create salesperson:', err)
      const errRes = err.response?.data
      const msg = errRes?.name?.[0] || 'Failed to create salesperson. Name might already exist.'
      showError('Salesperson Error', msg)
    } finally {
      setSavingSalesperson(false)
    }
  }

  // Save Enquiry
  const handleSaveEnquiry = async (e) => {
    e.preventDefault()
    if (!formData.customer_name.trim() && !formData.customer_id) {
      setFormError('Please select an existing customer or enter a customer name.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const payload = {
        customer: formData.customer_id || null,
        customer_name: formData.customer_name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        salesperson: formData.salesperson || null,
        salesperson_name: formData.salesperson_name || '',
        channel: formData.channel,
        date: formData.date,
        title: formData.title.trim(),
        description: formData.description.trim(),
        estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
        status: formData.status,
        next_follow_up_date: formData.next_follow_up_date || null,
        attachment: formData.attachment,
        attachment_name: formData.attachment_name,
        attachment_type: formData.attachment_type
      }

      if (isEditing && selectedEnquiry) {
        await api.patch(`enquiries/${selectedEnquiry.id}/`, payload)
        showToast('Enquiry updated successfully', 'success')
      } else {
        await api.post('enquiries/', payload)
        showToast('New enquiry recorded', 'success')
      }

      setIsModalOpen(false)
      fetchEnquiries()
      fetchMetrics()
    } catch (err) {
      const errRes = err.response?.data
      let msg = 'Failed to save enquiry.'
      if (typeof errRes === 'object') {
        msg = Object.entries(errRes).map(([k, v]) => `${k}: ${v}`).join(' | ')
      }
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Open Log Follow-up Modal
  const handleOpenFollowUp = (enq) => {
    setSelectedEnquiry(enq)
    setFollowUpData({
      contact_mode: enq.channel === 'whatsapp' ? 'whatsapp' : 'phone_call',
      outcome: 'interested',
      notes: '',
      next_follow_up_date: '',
      cancellation_reason: 'price_high'
    })
    setIsFollowUpModalOpen(true)
  }

  // Submit Follow-up
  const handleSaveFollowUp = async (e) => {
    e.preventDefault()
    if (!followUpData.notes.trim()) {
      showError('Notes Required', 'Please enter a summary of the follow-up conversation.')
      return
    }

    setSubmitting(true)
    try {
      await api.post(`enquiries/${selectedEnquiry.id}/log-follow-up/`, followUpData)
      showToast('Follow-up call logged', 'success')
      setIsFollowUpModalOpen(false)
      fetchEnquiries()
      fetchMetrics()
    } catch (err) {
      showError('Failed to log follow-up', err?.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Mark Converted (Won)
  const handleMarkConverted = async (enq) => {
    const confirmed = await showConfirm({
      title: 'Convert Lead?',
      text: `Confirm converting ${enq.enquiry_number} for "${enq.customer_name || enq.customer_detail?.name}" to Won?`,
      confirmButtonText: 'Yes, Convert Lead'
    })
    if (!confirmed) return

    try {
      await api.post(`enquiries/${enq.id}/mark-converted/`, {})
      showToast('Lead marked as converted!', 'success')
      fetchEnquiries()
      fetchMetrics()
    } catch (err) {
      showError('Failed to convert lead', err?.message)
    }
  }

  // Open Cancel Modal
  const handleOpenCancel = (enq) => {
    setSelectedEnquiry(enq)
    setCancelData({
      cancellation_reason: 'price_high',
      cancellation_notes: ''
    })
    setIsCancelModalOpen(true)
  }

  // Submit Cancel
  const handleSaveCancel = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post(`enquiries/${selectedEnquiry.id}/mark-cancelled/`, cancelData)
      showToast('Enquiry moved to Cancelled / Lost', 'info')
      setIsCancelModalOpen(false)
      fetchEnquiries()
      fetchMetrics()
    } catch (err) {
      showError('Failed to cancel enquiry', err?.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Restore Cancelled Lead
  const handleRestore = async (enq) => {
    try {
      await api.post(`enquiries/${enq.id}/restore/`, {})
      showToast('Enquiry restored to active pipeline', 'success')
      fetchEnquiries()
      fetchMetrics()
    } catch (err) {
      showError('Failed to restore enquiry', err?.message)
    }
  }

  // Handle PDF Download
  const handleDownloadPdf = async (enquiry) => {
    if (!enquiry) return
    try {
      setDownloadingPdfId(enquiry.id)
      const res = await api.get(`enquiries/${enquiry.id}/pdf/`, {
        responseType: 'blob'
      })
      handlePdfResponse(res, `Enquiry_${enquiry.enquiry_number || enquiry.id}.pdf`)
      showToast('Enquiry PDF downloaded successfully', 'success')
    } catch (err) {
      console.error('Failed to generate enquiry PDF:', err)
      showError('PDF Generation Failed', 'Could not generate enquiry PDF. Please try again.')
    } finally {
      setDownloadingPdfId(null)
    }
  }

  // Delete Enquiry
  const handleDeleteEnquiry = async (id, enqNumber) => {
    const confirmed = await showConfirm({
      title: 'Delete Enquiry?',
      text: `Are you sure you want to delete ${enqNumber}? It can be restored from Recycle Bin.`,
      confirmButtonText: 'Delete Record',
      isDangerous: true
    })
    if (!confirmed) return

    try {
      await api.delete(`enquiries/${id}/`)
      showToast('Enquiry moved to Recycle Bin', 'success')
      fetchEnquiries()
      fetchMetrics()
    } catch (err) {
      showError('Failed to delete enquiry', err?.message)
    }
  }

  // WhatsApp click handler
  const openWhatsApp = (phone, text = '') => {
    if (!phone) return
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const msg = encodeURIComponent(text || 'Hello, thank you for your enquiry with Arab Season!')
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank')
  }

  // Check if follow-up is overdue or today
  const getFollowUpStatus = (dateStr) => {
    if (!dateStr) return null
    const today = new Date().toISOString().split('T')[0]
    if (dateStr < today) return { label: 'Overdue', color: '#dc2626', bg: '#fee2e2' }
    if (dateStr === today) return { label: 'Due Today', color: '#d97706', bg: '#fef3c7' }
    return { label: `Due: ${dateStr}`, color: '#0f7638', bg: '#dcfce7' }
  }

  return (
    <div className="enquiries-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      
      {/* ── 1. PAGE HEADER (CRED Style) ── */}
      <div className="page-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontWeight: 600, letterSpacing: '-0.02em', fontSize: '24px', margin: 0, color: 'var(--text, #0A0A0A)' }}>Enquiries</h2>
          <p style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '13px', margin: '4px 0 0' }}>
            Capture client inquiries from WhatsApp, calls & emails. Follow up seamlessly and convert quality leads.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            type="button"
            className="cred-enquiry-submit-btn" 
            onClick={() => handleOpenModal()} 
            style={{ padding: '8px 18px', fontSize: '13px' }}
          >
            <Plus size={15} /> New Enquiry
          </button>
        </div>
      </div>

      {/* ── 2. SUMMARY CARDS GRID (CRED KPI Style) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Card 1: Follow-ups Due Today */}
        <div 
          onClick={() => { setDueTodayOnly(!dueTodayOnly); if (!dueTodayOnly) setActiveSection('active') }}
          style={{ 
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: dueTodayOnly ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, transform 0.1s ease',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Follow-ups Due Today
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: metrics.due_today_count > 0 ? 'var(--due, #EE7A2E)' : 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {metrics.due_today_count}
          </div>
        </div>

        {/* Card 2: Active Pipeline */}
        <div 
          onClick={() => { setActiveSection('active'); setDueTodayOnly(false) }}
          style={{ 
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: (activeSection === 'active' && !dueTodayOnly) ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, transform 0.1s ease',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Active Enquiries
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {metrics.active_count}
          </div>
        </div>

        {/* Card 3: Converted (Won) */}
        <div 
          onClick={() => { setActiveSection('converted'); setDueTodayOnly(false) }}
          style={{ 
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: (activeSection === 'converted') ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, transform 0.1s ease',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Lead Converted (Won)
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--positive, #19B25B)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {metrics.converted_count}
          </div>
        </div>

        {/* Card 4: Cancelled / Lost */}
        <div 
          onClick={() => { setActiveSection('cancelled'); setDueTodayOnly(false) }}
          style={{ 
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: (activeSection === 'cancelled') ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, transform 0.1s ease',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Cancelled / Lost
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: metrics.cancelled_count > 0 ? 'var(--danger, #E5482E)' : 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {metrics.cancelled_count}
          </div>
        </div>
      </div>

      {/* ── 3. STATUS TABS BAR (CRED Animated Tabs) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '16px',
        flexWrap: 'wrap'
      }}>
        <CredAnimatedTabs
          tabs={[
            { id: 'active', label: 'Active Enquiries', count: metrics.active_count },
            { id: 'converted', label: 'Converted Leads (Won)', count: metrics.converted_count },
            { id: 'cancelled', label: 'Cancelled / Lost', count: metrics.cancelled_count },
          ]}
          value={activeSection}
          onChange={(val) => {
            setActiveSection(val)
            setDueTodayOnly(false)
          }}
          className="case-preserve cred-enquiry-tabs"
          layoutId="cred-enquiry-status-tabs"
        />

        {/* Highlight pill if follow-ups are due */}
        {metrics.due_today_count > 0 && (
          <button
            type="button"
            onClick={() => {
              setDueTodayOnly(!dueTodayOnly)
              setActiveSection('active')
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 14px',
              height: '32px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 500,
              background: dueTodayOnly ? 'var(--black, #0A0A0A)' : 'var(--card-bg, #FFFFFF)',
              color: dueTodayOnly ? '#FFFFFF' : 'var(--due, #EE7A2E)',
              border: dueTodayOnly ? '1px solid var(--black, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--due, #EE7A2E)' }} />
            <span>Follow-up Calls Due Today: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{metrics.due_today_count}</strong></span>
          </button>
        )}
      </div>

      {/* ── 4. SEARCH & UNIFIED FILTER ROW (Directly on page, no outer card) ── */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px', flexWrap: 'wrap' }}>
          <CredSearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            placeholder="search enquiries, customer or project..."
            style={{ flex: '1 1 240px', minWidth: '180px', maxWidth: '420px' }}
          />

          {/* Unified Filter Menu */}
          <div ref={filterMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsFilterMenuOpen(prev => !prev)}
              style={{
                background: (selectedChannel !== 'all' || salespersonFilter !== 'all' || outcomeFilter !== 'all') ? 'var(--fill-ghost-hover, #F4F4F4)' : 'transparent',
                color: 'var(--text, #111111)',
                border: (selectedChannel !== 'all' || salespersonFilter !== 'all' || outcomeFilter !== 'all') ? '1px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
                borderRadius: '9999px',
                height: '36px',
                padding: '0 14px',
                fontSize: '13px',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              title="Filter by Channel, Salesperson, and Call Outcome"
            >
              <Filter size={14} />
              <span>Filters</span>
              {(selectedChannel !== 'all' || salespersonFilter !== 'all' || outcomeFilter !== 'all') && (
                <span
                  style={{
                    background: 'var(--black, #0A0A0A)',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '999px',
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1
                  }}
                >
                  {(selectedChannel !== 'all' ? 1 : 0) + (salespersonFilter !== 'all' ? 1 : 0) + (outcomeFilter !== 'all' ? 1 : 0)}
                </span>
              )}
              <ChevronDown
                size={13}
                style={{
                  transform: isFilterMenuOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                  opacity: 0.65
                }}
              />
            </button>

            {/* Dropdown Menu Popover */}
            {isFilterMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  width: '280px',
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: '16px',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
                  padding: '16px',
                  zIndex: 100
                }}
              >
                {/* Filter 1: Channel */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Channel
                  </label>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="cred-input"
                    style={{ height: '36px', fontSize: '13px' }}
                  >
                    <option value="all">All Channels</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="phone_call">Phone Call</option>
                    <option value="email">Email</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="website">Website</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Filter 2: Salesperson */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Salesperson
                  </label>
                  <select
                    value={salespersonFilter}
                    onChange={(e) => setSalespersonFilter(e.target.value)}
                    className="cred-input"
                    style={{ height: '36px', fontSize: '13px' }}
                  >
                    <option value="all">All Salespersons</option>
                    {salespersons.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Filter 3: Call Outcome */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Call Outcome
                  </label>
                  <select
                    value={outcomeFilter}
                    onChange={(e) => setOutcomeFilter(e.target.value)}
                    className="cred-input"
                    style={{ height: '36px', fontSize: '13px' }}
                  >
                    <option value="all">All Call Outcomes</option>
                    <option value="no_calls">No Calls Yet</option>
                    <option value="interested">Interested / Considering</option>
                    <option value="requested_discount">Requested Price Discount</option>
                    <option value="will_revert">Will Revert Later</option>
                    <option value="quotation_requested">Asked for Formal Quotation</option>
                    <option value="ready_to_close">Ready to Confirm / Won</option>
                    <option value="not_interested">Declined / Not Interested</option>
                    <option value="unreachable">Unreachable / No Answer</option>
                    <option value="other">Other Outcome</option>
                  </select>
                </div>

                {/* Footer action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border, #f1f5f9)' }}>
                  <button
                    type="button"
                    onClick={() => setIsFilterMenuOpen(false)}
                    style={{
                      background: 'var(--black, #0A0A0A)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '6px 16px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Active Filter Chips */}
          {(selectedChannel !== 'all' || salespersonFilter !== 'all' || outcomeFilter !== 'all') && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {selectedChannel !== 'all' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'var(--fill-ghost-hover, #F4F4F4)',
                    border: '1px solid var(--border, #E4E4E4)',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text, #111111)'
                  }}
                >
                  <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>Channel:</span> {CHANNEL_CONFIG[selectedChannel]?.label || selectedChannel}
                  <button
                    type="button"
                    onClick={() => setSelectedChannel('all')}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}
                    title="Remove filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {salespersonFilter !== 'all' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'var(--fill-ghost-hover, #F4F4F4)',
                    border: '1px solid var(--border, #E4E4E4)',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text, #111111)'
                  }}
                >
                  <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>Salesperson:</span> {salespersons.find(s => String(s.id) === String(salespersonFilter))?.name || 'Selected'}
                  <button
                    type="button"
                    onClick={() => setSalespersonFilter('all')}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}
                    title="Remove filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {outcomeFilter !== 'all' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'var(--fill-ghost-hover, #F4F4F4)',
                    border: '1px solid var(--border, #E4E4E4)',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text, #111111)'
                  }}
                >
                  <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>Outcome:</span> {outcomeFilter === 'no_calls' ? 'No Calls Yet' : (OUTCOME_CONFIG[outcomeFilter]?.label || outcomeFilter)}
                  <button
                    type="button"
                    onClick={() => setOutcomeFilter('all')}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}
                    title="Remove filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedChannel('all')
                  setSalespersonFilter('all')
                  setOutcomeFilter('all')
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #8C8C8C)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '2px 4px'
                }}
                title="Clear all filters"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* ── 5. MAIN DATA TABLE (Directly on page, Cashbook style, no horizontal scroll) ── */}
      <div style={{ width: '100%', position: 'relative', marginBottom: '2.5rem' }}>
        {loading ? (
          <div style={{ padding: '1.5rem 0' }}>
            <SkeletonLoader type="table" />
          </div>
        ) : (
          <>
            {enquiries.length === 0 && !error && (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                <MessageSquare size={22} strokeWidth={1.6} style={{ color: 'var(--text-muted, #8C8C8C)', opacity: 0.6, marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>
                  {searchQuery 
                    ? `No enquiries matching "${searchQuery}".`
                    : (selectedChannel !== 'all' || salespersonFilter !== 'all' || outcomeFilter !== 'all')
                    ? 'No enquiries match the selected filters.'
                    : activeSection === 'active'
                    ? 'No active enquiries yet.'
                    : activeSection === 'converted'
                    ? 'No converted leads yet.'
                    : 'No cancelled enquiries.'}
                </p>
                {(selectedChannel !== 'all' || salespersonFilter !== 'all' || outcomeFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedChannel('all')
                      setSalespersonFilter('all')
                      setOutcomeFilter('all')
                    }}
                    style={{
                      marginTop: '12px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text, #111111)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            )}

            {enquiries.length > 0 && (
              <>
                {/* Desktop Table View */}
                <div className="desktop-only-table" style={{ width: '100%', overflow: 'hidden' }}>
                  <table className="enquiries-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)' }}>
                        <th style={{ width: '12%', padding: '10px 10px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none' }}>Enquiry</th>
                        <th style={{ width: '22%', padding: '10px 10px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none' }}>Customer</th>
                        <th style={{ width: '24%', padding: '10px 10px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none' }}>Specific Work Requested</th>
                        <th style={{ width: '9%', padding: '10px 8px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'center', textTransform: 'none' }}>Channel</th>
                        <th style={{ width: '9%', padding: '10px 8px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'center', textTransform: 'none' }}>Date</th>
                        <th style={{ width: '10%', padding: '10px 10px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none' }}>Est. Value</th>
                        <th style={{ width: '5%', padding: '10px 6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'center', textTransform: 'none' }}>Photo</th>
                        <th style={{ width: '14%', padding: '10px 10px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none' }}>Call Outcome</th>
                        <th style={{ width: '5%', padding: '10px 6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'center', textTransform: 'none' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enquiries.map((enq) => {
                        const chCfg = CHANNEL_CONFIG[enq.channel] || CHANNEL_CONFIG.other
                        const clientName = enq.customer_name || enq.customer_detail?.name || 'Walk-in Prospect'
                        const phone = enq.phone || enq.customer_detail?.phone || ''
                        
                        // Determine latest call / follow-up outcome
                        const sortedFollowUps = (enq.follow_ups && enq.follow_ups.length > 0)
                          ? [...enq.follow_ups].sort((a, b) => (a.id || 0) - (b.id || 0))
                          : []
                        const latestFollowUp = sortedFollowUps.length > 0 ? sortedFollowUps[sortedFollowUps.length - 1] : null
                        const outcomeCfg = latestFollowUp ? (OUTCOME_CONFIG[latestFollowUp.outcome] || OUTCOME_CONFIG.other) : null

                        return (
                          <tr 
                            key={enq.id} 
                            className="cred-table-row"
                            onClick={() => {
                              setSelectedEnquiry(enq)
                              setIsDetailModalOpen(true)
                            }}
                            title="Click row to view full timeline & lead history"
                            style={{
                              borderBottom: '1px solid var(--border, #E4E4E4)',
                              cursor: 'pointer',
                              transition: 'background-color 0.15s ease'
                            }}
                          >
                            {/* Enquiry Number */}
                            <td style={{ padding: '10px 10px', verticalAlign: 'middle' }}>
                              <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text, #111111)', fontVariantNumeric: 'tabular-nums' }}>
                                {enq.enquiry_number}
                              </span>
                            </td>

                            {/* Customer */}
                            <td style={{ padding: '10px 10px', verticalAlign: 'middle', overflow: 'hidden' }}>
                              <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {clientName}
                              </div>
                              {phone && (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                  {phone}
                                </div>
                              )}
                              {(enq.salesperson_name || enq.salesperson_detail?.name) && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <UserCheck size={11} style={{ opacity: 0.7 }} /> {enq.salesperson_name || enq.salesperson_detail?.name}
                                </div>
                              )}
                            </td>

                            {/* Specific Work Requested */}
                            <td style={{ padding: '10px 10px', verticalAlign: 'middle', overflow: 'hidden' }}>
                              {enq.title && (
                                <div style={{ fontWeight: 400, fontSize: '12.5px', color: 'var(--text, #111111)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {enq.title}
                                </div>
                              )}
                              <div 
                                style={{ 
                                  fontSize: '12px', 
                                  color: 'var(--text-muted, #8C8C8C)', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap' 
                                }}
                                title={enq.description}
                              >
                                {enq.description || '—'}
                              </div>
                            </td>

                            {/* Channel (Plain muted text, no green pill) */}
                            <td style={{ textAlign: 'center', padding: '10px 8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: '12.5px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>
                                {chCfg.label}
                              </span>
                            </td>

                            {/* Enquiry Date */}
                            <td style={{ textAlign: 'center', padding: '10px 8px', verticalAlign: 'middle', color: 'var(--text-muted, #8C8C8C)', fontSize: '12.5px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                              {enq.date}
                            </td>

                            {/* Estimated Value (Cashbook amount style: tabular-nums, lighter decimals) */}
                            <td style={{ textAlign: 'right', padding: '10px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {enq.estimated_value ? (
                                (() => {
                                  const num = parseFloat(enq.estimated_value)
                                  if (isNaN(num)) return '—'
                                  const parts = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')
                                  return (
                                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '13px', fontWeight: 400, color: 'var(--text, #111111)' }}>
                                      {parts[0]}<span style={{ opacity: 0.55, fontSize: '11px' }}>.{parts[1]}</span>
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginLeft: '3px' }}>SAR</span>
                                    </span>
                                  )
                                })()
                              ) : (
                                <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '12.5px' }}>—</span>
                              )}
                            </td>

                            {/* Reference Photo / Attachment (Smaller 32px, 1px border, no heavy shadow) */}
                            <td style={{ textAlign: 'center', padding: '10px 6px', verticalAlign: 'middle' }}>
                              {enq.attachment ? (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setPreviewMediaUrl(enq.attachment)
                                  }}
                                  title="Click to view reference attachment"
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border, #E4E4E4)',
                                    overflow: 'hidden',
                                    margin: '0 auto',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'var(--fill-ghost-hover, #F4F4F4)',
                                    boxShadow: 'none'
                                  }}
                                >
                                  {enq.attachment_type?.includes('pdf') ? (
                                    <FileText size={16} color="var(--danger, #DC2626)" />
                                  ) : (
                                    <img
                                      src={enq.attachment}
                                      alt="thumbnail"
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '12px' }}>—</span>
                              )}
                            </td>

                            {/* Call Outcome (Plain muted text, no grey pill for "No Calls Yet") */}
                            <td style={{ padding: '10px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {latestFollowUp ? (
                                <span style={{ fontSize: '12.5px', fontWeight: 400, color: 'var(--text, #111111)' }}>
                                  {latestFollowUp.outcome_display || outcomeCfg.label}
                                </span>
                              ) : (
                                <span style={{ fontSize: '12.5px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>
                                  No Calls Yet
                                </span>
                              )}
                            </td>

                            {/* Delete Action (Minimal icon-only button: no bg, no border, grey trash turning red on hover) */}
                            <td style={{ textAlign: 'center', padding: '10px 6px', verticalAlign: 'middle', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="cred-trash-icon-btn"
                                onClick={() => handleDeleteEnquiry(enq.id, enq.enquiry_number)}
                                title="Delete"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: '4px',
                                  color: 'var(--text-muted, #8C8C8C)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '4px',
                                  transition: 'color 0.15s ease'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger, #DC2626)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)')}
                              >
                                <Trash2 size={15} strokeWidth={1.8} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Native Cards View */}
                <div className="mobile-only-cards" style={{ padding: '0.75rem 0' }}>
                  {enquiries.map((enq) => {
                    const clientName = enq.customer_name || enq.customer_detail?.name || 'Walk-in Prospect'
                    const phone = enq.phone || enq.customer_detail?.phone || ''
                    const stCfg = STATUS_CONFIG[enq.status] || STATUS_CONFIG.enquiry
                    const initials = clientName
                      ? clientName.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
                      : 'EN'

                    return (
                      <div 
                        key={enq.id} 
                        className="mobile-entity-card clickable-card" 
                        onClick={() => {
                          setSelectedEnquiry(enq)
                          setIsDetailModalOpen(true)
                        }}
                        style={{ marginBottom: '0.75rem', cursor: 'pointer' }}
                        title="Click to view full lead history and timeline"
                      >
                        <div className="mobile-card-header">
                          <div className="mobile-card-title-group">
                            <div className="mobile-card-avatar" style={{ background: '#ebf3fc', color: '#1366d9' }}>
                              {initials}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div className="mobile-card-title">{clientName}</div>
                              <div className="mobile-card-sub">
                                <span style={{ fontWeight: '500', color: 'var(--text, #111111)' }}>{enq.enquiry_number}</span>
                                {phone && <span> • {phone}</span>}
                                {(enq.salesperson_name || enq.salesperson_detail?.name) && (
                                  <span> • {enq.salesperson_name || enq.salesperson_detail?.name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '500',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: 'var(--fill-ghost-hover, #F4F4F4)',
                            color: 'var(--text, #111111)'
                          }}>
                            {stCfg.label}
                          </span>
                        </div>

                        <div className="mobile-card-body" style={{ padding: '0.5rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {enq.title && <div style={{ fontWeight: '500', color: 'var(--text-main)', marginBottom: '0.2rem' }}>{enq.title}</div>}
                          <div style={{ lineHeight: '1.4' }}>{enq.description}</div>
                        </div>

                        <div className="mobile-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-main)' }}>
                            {enq.estimated_value ? formatCurrency(enq.estimated_value) : `${enq.follow_up_count} Calls`}
                          </span>
                          <div style={{ display: 'flex', gap: '0.4rem' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="cred-trash-icon-btn"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '4px',
                                color: 'var(--text-muted, #8C8C8C)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                transition: 'color 0.15s ease'
                              }}
                              onClick={() => handleDeleteEnquiry(enq.id, enq.enquiry_number)}
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── 6. CREATE / EDIT ENQUIRY MODAL (CRED Style with Plain Selects & Pinned Footer) ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? `Edit Enquiry: ${selectedEnquiry?.enquiry_number}` : 'New Customer Enquiry'}
        maxWidth="680px"
        closeOnBackdrop={true}
        style={{
          borderRadius: '24px',
          background: 'var(--card-bg, #FFFFFF)',
          border: '1px solid var(--border, #E4E4E4)'
        }}
        footer={
          <>
            <button
              type="button"
              className="cred-enquiry-cancel-btn"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="new-enquiry-form"
              className="cred-enquiry-submit-btn"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Enquiry')}
            </button>
          </>
        }
      >
        <form id="new-enquiry-form" onSubmit={handleSaveEnquiry}>
          {formError && (
            <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <AlertCircle size={18} /> {formError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {/* Existing Customer (Optional plain select) */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="cred-form-label">Existing Customer (Optional)</label>
              <select
                value={formData.customer_id}
                onChange={(e) => {
                  const cId = e.target.value
                  const found = customers.find(c => String(c.id) === String(cId))
                  setFormData(prev => ({
                    ...prev,
                    customer_id: cId,
                    customer_name: found ? found.name : prev.customer_name,
                    phone: found && found.phone ? found.phone : prev.phone,
                    email: found && found.email ? found.email : prev.email
                  }))
                }}
              >
                <option value="">Select existing customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company_name ? `(${c.company_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Name */}
            <div>
              <label className="cred-form-label">
                Customer Name
                <span className="cred-required-dot" title="Required" />
              </label>
              <input
                type="text"
                required
                className="cred-input"
                placeholder="e.g. Abdullah Al-Otaibi"
                value={formData.customer_name}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="cred-form-label">Phone Number</label>
              <input
                type="text"
                className="cred-input"
                placeholder="e.g. +966 50 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            {/* Inquiry Channel (Plain select) */}
            <div>
              <label className="cred-form-label">Inquiry Channel</label>
              <select
                value={formData.channel}
                onChange={(e) => setFormData(prev => ({ ...prev, channel: e.target.value }))}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="phone_call">Phone Call</option>
                <option value="email">Email</option>
                <option value="walk_in">Walk-in</option>
                <option value="website">Website / Online</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Enquiry Date */}
            <div>
              <label className="cred-form-label">Enquiry Date</label>
              <input
                type="date"
                className="cred-input"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            {/* Salesperson (Lead Brought By - Plain select) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="cred-form-label" style={{ margin: 0 }}>Salesperson (Lead Brought By)</label>
                <button
                  type="button"
                  onClick={() => {
                    setNewSalespersonForm({ name: '', phone: '', email: '' })
                    setIsSalespersonModalOpen(true)
                  }}
                  className="cred-link-btn"
                >
                  + Add New Salesman
                </button>
              </div>
              <select
                value={formData.salesperson || ''}
                onChange={(e) => {
                  const val = e.target.value
                  const sp = salespersons.find(s => String(s.id) === String(val))
                  setFormData(prev => ({
                    ...prev,
                    salesperson: val,
                    salesperson_name: sp ? sp.name : ''
                  }))
                }}
              >
                <option value="">Select salesperson</option>
                {salespersons.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `(${s.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Project Summary */}
            <div>
              <label className="cred-form-label">Project Summary</label>
              <input
                type="text"
                className="cred-input"
                placeholder="e.g. 3D Acrylic Glow Signboard for Riyadh Branch"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            {/* Customer Requirements */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="cred-form-label">
                Customer Requirements
                <span className="cred-required-dot" title="Required" />
              </label>
              <textarea
                rows={4}
                required
                className="cred-textarea"
                placeholder="Describe what the customer asked for (dimensions, materials, quantity, specifications)..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* Estimated Value (SAR) */}
            <div>
              <label className="cred-form-label">Estimated Value (SAR)</label>
              <input
                type="number"
                step="0.01"
                className="cred-input"
                placeholder="e.g. 4500"
                value={formData.estimated_value}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_value: e.target.value }))}
              />
            </div>

            {/* Next Follow-up Call Date */}
            <div>
              <label className="cred-form-label">Next Follow-up Call Date</label>
              <input
                type="date"
                className="cred-input"
                value={formData.next_follow_up_date}
                onChange={(e) => setFormData(prev => ({ ...prev, next_follow_up_date: e.target.value }))}
              />
            </div>

            {/* Reference Photo / Site Attachment */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="cred-form-label">Reference Photo / Site Attachment</label>
              {formData.attachment ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--fill-ghost-hover, #F4F4F4)',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '16px',
                  padding: '10px 14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    {formData.attachment_type?.includes('pdf') ? (
                      <FileText size={18} color="var(--danger, #DC2626)" />
                    ) : (
                      <img
                        src={formData.attachment}
                        alt="preview"
                        style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }}
                      />
                    )}
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text, #111111)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {formData.attachment_name || 'Uploaded Reference'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--danger, #DC2626)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Remove attachment"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '1px dashed var(--border, #E4E4E4)',
                    borderRadius: '16px',
                    padding: '18px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'var(--fill-ghost-hover, #F9F9F9)',
                    transition: 'border-color 0.15s ease, background-color 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--text-muted, #8C8C8C)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border, #E4E4E4)'
                  }}
                >
                  <UploadCloud size={16} strokeWidth={1.8} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>
                    Click to upload reference photo or PDF document
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    style={{ display: 'none' }}
                    onChange={handleAttachmentChange}
                  />
                </div>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* ── 7. LOG FOLLOW-UP MODAL ── */}
      <Modal
        isOpen={isFollowUpModalOpen && !!selectedEnquiry}
        onClose={() => setIsFollowUpModalOpen(false)}
        title={`Log Follow-up Call: ${selectedEnquiry?.enquiry_number || ''}`}
        maxWidth="540px"
      >
        <form onSubmit={handleSaveFollowUp}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            {/* Contact Mode */}
            <div className="form-group">
              <label>Contact Channel</label>
              <select
                className="input-field"
                value={followUpData.contact_mode}
                onChange={(e) => setFollowUpData(prev => ({ ...prev, contact_mode: e.target.value }))}
              >
                <option value="phone_call">Phone Call</option>
                <option value="whatsapp">WhatsApp Message</option>
                <option value="email">Email</option>
                <option value="meeting">In-Person Meeting</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Outcome */}
            <div className="form-group">
              <label>Call Outcome</label>
              <select
                className="input-field"
                value={followUpData.outcome}
                onChange={(e) => setFollowUpData(prev => ({ ...prev, outcome: e.target.value }))}
              >
                <option value="interested">Interested / In Discussion</option>
                <option value="requested_discount">Asked for Price Discount</option>
                <option value="quotation_requested">Asked for Formal Quotation</option>
                <option value="will_revert">Will Revert Later</option>
                <option value="ready_to_close">Ready to Confirm (Won!)</option>
                <option value="not_interested">Declined / Not Interested</option>
                <option value="unreachable">Unreachable / No Answer</option>
              </select>
            </div>

            {/* Next Follow-up Date */}
            {followUpData.outcome !== 'not_interested' && followUpData.outcome !== 'ready_to_close' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Schedule Next Follow-up Call</label>
                <input
                  type="date"
                  className="input-field"
                  value={followUpData.next_follow_up_date}
                  onChange={(e) => setFollowUpData(prev => ({ ...prev, next_follow_up_date: e.target.value }))}
                />
              </div>
            )}

            {/* Notes */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Conversation Notes & Updates *</label>
              <textarea
                rows={3}
                required
                className="input-field"
                placeholder="e.g. Spoke to client. They requested a 5% discount on the quote. Will confirm order tomorrow."
                value={followUpData.notes}
                onChange={(e) => setFollowUpData(prev => ({ ...prev, notes: e.target.value }))}
                style={{ minHeight: '80px', height: 'auto', resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.65rem 1.25rem' }}
              onClick={() => setIsFollowUpModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.75rem' }}
              disabled={submitting}
            >
              {submitting ? 'Logging...' : 'Log Follow-up Call'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── 8. CANCEL / LOST MODAL ── */}
      <Modal
        isOpen={isCancelModalOpen && !!selectedEnquiry}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel / Mark Lead as Lost"
        maxWidth="480px"
      >
        <form onSubmit={handleSaveCancel}>
          <div className="form-group">
            <label>Primary Loss Reason *</label>
            <select
              className="input-field"
              value={cancelData.cancellation_reason}
              onChange={(e) => setCancelData(prev => ({ ...prev, cancellation_reason: e.target.value }))}
            >
              {CANCELLATION_REASONS.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Additional Notes (Optional)</label>
            <textarea
              rows={3}
              className="input-field"
              placeholder="e.g. Customer stated another company offered 15% cheaper for acrylic signage."
              value={cancelData.cancellation_notes}
              onChange={(e) => setCancelData(prev => ({ ...prev, cancellation_notes: e.target.value }))}
              style={{ minHeight: '80px', height: 'auto', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.65rem 1.25rem' }}
              onClick={() => setIsCancelModalOpen(false)}
            >
              Keep Active
            </button>
            <button
              type="submit"
              className="btn"
              style={{ background: 'var(--danger, #dc2626)', color: '#ffffff', border: 'none', padding: '0.65rem 1.75rem', borderRadius: 'var(--radius-sm)' }}
              disabled={submitting}
            >
              {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── 9. TIMELINE & LEAD HISTORY MODAL ── */}
      <Modal
        isOpen={isDetailModalOpen && !!selectedEnquiry}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Enquiry Details: ${selectedEnquiry?.enquiry_number || ''}`}
        maxWidth="780px"
      >
        {selectedEnquiry && (() => {
          const chCfg = CHANNEL_CONFIG[selectedEnquiry.channel] || CHANNEL_CONFIG.other
          const stCfg = STATUS_CONFIG[selectedEnquiry.status] || STATUS_CONFIG.enquiry
          const salespersonName = selectedEnquiry.salesperson_name || selectedEnquiry.salesperson_detail?.name
          const followStatus = getFollowUpStatus(selectedEnquiry.next_follow_up_date)

          // Sort follow-ups chronologically
          const sortedFollowUps = [...(selectedEnquiry.follow_ups || [])].sort((a, b) => new Date(a.date) - new Date(b.date))

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Compact Summary Header Card */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                background: 'var(--bg-subtle, #f8fafc)',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e2e8f0)',
                gap: '1rem'
              }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-main)' }}>
                    {selectedEnquiry.customer_name || selectedEnquiry.customer_detail?.name || 'Walk-in Prospect'}
                    {selectedEnquiry.phone ? ` • ${selectedEnquiry.phone}` : ''}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {selectedEnquiry.title || selectedEnquiry.description || 'General Enquiry'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {selectedEnquiry.estimated_value && (
                    <div style={{ fontWeight: '800', fontSize: '0.92rem', color: 'var(--text-main)' }}>
                      {formatCurrency(selectedEnquiry.estimated_value)}
                    </div>
                  )}
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    background: stCfg.bg,
                    color: stCfg.color,
                    display: 'inline-block',
                    marginTop: '0.2rem'
                  }}>
                    {stCfg.label}
                  </span>
                </div>
              </div>

              {/* Sequential Lifecycle Stepper */}
              <div style={{ position: 'relative', paddingLeft: '32px', margin: '0.25rem 0' }}>
                {/* Vertical continuous line */}
                <div style={{
                  position: 'absolute',
                  left: '14px',
                  top: '12px',
                  bottom: '16px',
                  width: '2px',
                  background: '#e2e8f0',
                  zIndex: 0
                }} />

                {/* ── STEP 1: INCEPTION / ENQUIRY RECEIVED ── */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{
                    position: 'absolute',
                    left: '-32px',
                    top: '2px',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#1366d9',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '0.75rem',
                    boxShadow: '0 0 0 3px #ffffff'
                  }}>
                    1
                  </div>

                  <div style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '0.75rem 0.95rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        Enquiry Received
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {selectedEnquiry.date}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Received via <strong style={{ color: chCfg.color }}>{chCfg.label}</strong>
                      {selectedEnquiry.created_by_name && ` • Logged by ${selectedEnquiry.created_by_name}`}
                      {salespersonName && ` • Lead owner: ${salespersonName}`}
                    </div>
                    {selectedEnquiry.attachment && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => setPreviewMediaUrl(selectedEnquiry.attachment)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#1366d9',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <FileText size={13} /> View Attached File
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── STEPS 2..N: FOLLOW-UP CALLS & INTERACTIONS ── */}
                {sortedFollowUps.map((fu, idx) => {
                  const outcomeCfg = OUTCOME_CONFIG[fu.outcome] || OUTCOME_CONFIG.other

                  return (
                    <div key={fu.id || idx} style={{ position: 'relative', marginTop: '1rem', zIndex: 1 }}>
                      <div style={{
                        position: 'absolute',
                        left: '-32px',
                        top: '2px',
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: '#0284c7',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '0.75rem',
                        boxShadow: '0 0 0 3px #ffffff'
                      }}>
                        {idx + 2}
                      </div>

                      <div style={{
                        background: '#ffffff',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: '8px',
                        padding: '0.75rem 0.95rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                            {(fu.contact_mode_display || fu.contact_mode) && (
                              <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                Via {fu.contact_mode_display || fu.contact_mode}
                              </span>
                            )}
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              padding: '0.12rem 0.45rem',
                              borderRadius: '4px',
                              background: outcomeCfg.bg,
                              color: outcomeCfg.color
                            }}>
                              {fu.outcome_display || outcomeCfg.label}
                            </span>
                          </div>

                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {fu.date ? new Date(fu.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '---'}
                          </span>
                        </div>

                        {fu.notes && (
                          <div style={{
                            fontSize: '0.82rem',
                            color: 'var(--text-main)',
                            marginTop: '0.35rem',
                            lineHeight: '1.4'
                          }}>
                            {fu.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* ── FINAL STEP: RESOLUTION OR ACTIVE STATUS ── */}
                {selectedEnquiry.status === 'converted' ? (
                  <div style={{ position: 'relative', marginTop: '1rem', zIndex: 1 }}>
                    <div style={{
                      position: 'absolute',
                      left: '-32px',
                      top: '2px',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: '#0f7638',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '0.85rem',
                      boxShadow: '0 0 0 3px #ffffff'
                    }}>
                      ✓
                    </div>

                    <div style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '0.75rem 0.95rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#166534' }}>
                          Deal Won (Converted)
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: '600' }}>
                          {selectedEnquiry.converted_at ? new Date(selectedEnquiry.converted_at).toLocaleDateString() : 'Won'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#15803d', marginTop: '0.2rem' }}>
                        Client confirmed order.
                        {selectedEnquiry.converted_quotation_number && ` Linked Quotation: ${selectedEnquiry.converted_quotation_number}.`}
                        {selectedEnquiry.converted_job_order_title && ` Linked Job: ${selectedEnquiry.converted_job_order_title}.`}
                      </div>
                    </div>
                  </div>
                ) : selectedEnquiry.status === 'cancelled' ? (
                  <div style={{ position: 'relative', marginTop: '1rem', zIndex: 1 }}>
                    <div style={{
                      position: 'absolute',
                      left: '-32px',
                      top: '2px',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: '#dc2626',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '0.85rem',
                      boxShadow: '0 0 0 3px #ffffff'
                    }}>
                      ✕
                    </div>

                    <div style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      padding: '0.75rem 0.95rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#991b1b' }}>
                          Closed / Lost
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '0.1rem 0.45rem',
                          borderRadius: '4px',
                          background: '#fee2e2',
                          color: '#dc2626'
                        }}>
                          {selectedEnquiry.cancellation_reason_display || selectedEnquiry.cancellation_reason || 'Lost'}
                        </span>
                      </div>
                      {selectedEnquiry.cancellation_notes && (
                        <div style={{ fontSize: '0.78rem', color: '#7f1d1d', marginTop: '0.25rem' }}>
                          {selectedEnquiry.cancellation_notes}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Active Pipeline Node */
                  <div style={{ position: 'relative', marginTop: '1rem', zIndex: 1 }}>
                    <div style={{
                      position: 'absolute',
                      left: '-32px',
                      top: '2px',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: '#f1f5f9',
                      border: '2px dashed #0284c7',
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '0.9rem',
                      boxShadow: '0 0 0 3px #ffffff'
                    }}>
                      •
                    </div>

                    <div style={{
                      background: '#f8fafc',
                      border: '1px dashed #cbd5e1',
                      borderRadius: '8px',
                      padding: '0.75rem 0.95rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          Current Status: Under Follow-up
                        </span>
                        {followStatus && (
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            padding: '0.12rem 0.45rem',
                            borderRadius: '4px',
                            background: followStatus.bg,
                            color: followStatus.color
                          }}>
                            {followStatus.label}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {selectedEnquiry.next_follow_up_date
                          ? `Next contact scheduled for: ${selectedEnquiry.next_follow_up_date}`
                          : 'Awaiting next follow-up action'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* MODAL ACTION BUTTONS FOOTER */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.65rem',
                marginTop: '0.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-color, #e2e8f0)'
              }}>
                {/* Left quick action buttons for active leads */}
                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {selectedEnquiry.status !== 'converted' && selectedEnquiry.status !== 'cancelled' ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setIsDetailModalOpen(false)
                          handleOpenFollowUp(selectedEnquiry)
                        }}
                        style={{ height: '36px', padding: '0 0.95rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', borderRadius: '6px' }}
                      >
                        <Phone size={13} /> Log Follow-up
                      </button>

                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setIsDetailModalOpen(false)
                          handleMarkConverted(selectedEnquiry)
                        }}
                        style={{
                          height: '36px',
                          padding: '0 0.9rem',
                          fontSize: '0.8rem',
                          background: 'rgba(15, 118, 56, 0.1)',
                          color: '#0f7638',
                          border: '1px solid rgba(15, 118, 56, 0.3)',
                          borderRadius: '6px',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer'
                        }}
                      >
                        <CheckCircle2 size={13} /> Mark Won
                      </button>

                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setIsDetailModalOpen(false)
                          handleOpenCancel(selectedEnquiry)
                        }}
                        style={{
                          height: '36px',
                          padding: '0 0.85rem',
                          fontSize: '0.8rem',
                          background: 'transparent',
                          color: '#dc2626',
                          border: '1px solid rgba(220, 38, 38, 0.3)',
                          borderRadius: '6px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Mark Lost
                      </button>
                    </>
                  ) : selectedEnquiry.status === 'cancelled' ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setIsDetailModalOpen(false)
                        handleRestore(selectedEnquiry)
                      }}
                      style={{
                        height: '36px',
                        padding: '0 1rem',
                        fontSize: '0.8rem',
                        background: 'rgba(19, 102, 217, 0.1)',
                        color: 'var(--primary, #1366d9)',
                        border: '1px solid rgba(19, 102, 217, 0.3)',
                        borderRadius: '6px',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer'
                      }}
                    >
                      <RotateCcw size={13} /> Restore to Active
                    </button>
                  ) : null}
                </div>

                {/* Right buttons: Print PDF, Edit & Close (neatly aligned to the right) */}
                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleDownloadPdf(selectedEnquiry)}
                    disabled={downloadingPdfId === selectedEnquiry.id}
                    style={{
                      height: '36px',
                      padding: '0 0.85rem',
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      borderRadius: '6px',
                      color: 'var(--primary, #1366d9)',
                      border: '1px solid rgba(19, 102, 217, 0.3)',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                    title="Export Enquiry & Lead History to PDF"
                  >
                    <Printer size={14} className={downloadingPdfId === selectedEnquiry.id ? 'spin' : ''} />
                    {downloadingPdfId === selectedEnquiry.id ? 'Printing...' : 'Print PDF'}
                  </button>

                  {selectedEnquiry.status !== 'converted' && !selectedEnquiry.converted_at && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setIsDetailModalOpen(false)
                        handleOpenModal(selectedEnquiry)
                      }}
                      style={{ height: '36px', padding: '0 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      <Edit3 size={13} /> Edit Enquiry
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ height: '36px', padding: '0 1.1rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', cursor: 'pointer' }}
                    onClick={() => setIsDetailModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ── QUICK-CREATE SALESPERSON MODAL ── */}
      <Modal
        isOpen={isSalespersonModalOpen}
        onClose={() => setIsSalespersonModalOpen(false)}
        title="Add New Salesperson"
        maxWidth="450px"
      >
        <form onSubmit={handleQuickCreateSalesperson}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>Salesperson Name *</label>
              <input
                type="text"
                required
                autoFocus
                className="input-field"
                placeholder="e.g. Tariq Mansoor"
                value={newSalespersonForm.name}
                onChange={(e) => setNewSalespersonForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Phone / WhatsApp Number (Optional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. +966 55 987 6543"
                value={newSalespersonForm.phone}
                onChange={(e) => setNewSalespersonForm(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Email Address (Optional)</label>
              <input
                type="email"
                className="input-field"
                placeholder="e.g. tariq@arabseason.com"
                value={newSalespersonForm.email}
                onChange={(e) => setNewSalespersonForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsSalespersonModalOpen(false)}
              disabled={savingSalesperson}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingSalesperson}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {savingSalesperson ? 'Saving...' : <><Check size={16} /> Save & Select</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── 10. FULL PHOTO PREVIEW MODAL ── */}
      {previewMediaUrl && (
        <div
          onClick={() => setPreviewMediaUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1.5rem',
            cursor: 'zoom-out'
          }}
        >
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <img
              src={previewMediaUrl}
              alt="Reference Preview"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '10px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
            />
            <button
              type="button"
              onClick={() => setPreviewMediaUrl(null)}
              style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                background: '#ffffff',
                color: '#0f172a',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}


      {/* ── Scoped CRED Styles for Enquiries Page ── */}
      <style>{`
        .cred-table-row:hover {
          background: var(--fill-ghost-hover, #F7F7F7) !important;
        }
        .cred-search {
          border: 1px solid var(--border, #E4E4E4) !important;
          border-radius: 9999px !important;
        }
        .cred-search:focus-within {
          border-color: var(--text, #0A0A0A) !important;
        }
        .cred-form-label {
          display: flex;
          align-items: center;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-muted, #8C8C8C);
          margin-bottom: 6px;
          letter-spacing: -0.01em;
        }
        .cred-required-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--danger, #DC2626);
          margin-left: 5px;
          vertical-align: middle;
        }
        .cred-input {
          width: 100%;
          height: 40px;
          padding: 0 14px;
          background: var(--bg, #FFFFFF);
          border: 1px solid var(--border, #E4E4E4);
          border-radius: var(--radius-btn, 12px);
          font-size: 13.5px;
          color: var(--text, #111111);
          font-family: inherit;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .cred-input:focus {
          border-color: var(--text, #0A0A0A);
          box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.08);
        }
        .cred-textarea {
          width: 100%;
          min-height: 84px;
          padding: 10px 14px;
          background: var(--bg, #FFFFFF);
          border: 1px solid var(--border, #E4E4E4);
          border-radius: var(--radius-btn, 12px);
          font-size: 13.5px;
          color: var(--text, #111111);
          font-family: inherit;
          outline: none;
          box-sizing: border-box;
          resize: vertical;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .cred-textarea:focus {
          border-color: var(--text, #0A0A0A);
          box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.08);
        }
        .cred-link-btn {
          background: transparent;
          border: none;
          color: var(--text-muted, #8C8C8C);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          padding: 0 2px;
          transition: color 0.15s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .cred-link-btn:hover {
          color: var(--text, #0A0A0A);
        }
        .cred-enquiry-cancel-btn {
          background: transparent;
          color: var(--text, #111111);
          border: 1px solid var(--border, #E4E4E4);
          border-radius: 9999px;
          padding: 9px 20px;
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .cred-enquiry-cancel-btn:hover {
          background: var(--fill-ghost-hover, #F4F4F4);
        }
        .cred-enquiry-submit-btn {
          background: var(--black, #0A0A0A);
          color: #FFFFFF;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 9999px;
          padding: 9px 24px;
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
        }
        .cred-enquiry-submit-btn:hover:not(:disabled) {
          background: #232323;
        }
        .cred-enquiry-tabs .cred-atabs-count {
          background: transparent !important;
          padding: 0 !important;
          margin-left: 6px !important;
          font-weight: 500 !important;
          font-size: 12px !important;
          opacity: 0.75 !important;
          border-radius: 0 !important;
        }
        .cred-enquiry-tabs .cred-atabs-tab.is-active .cred-atabs-count {
          background: transparent !important;
          color: var(--tab-active-text, #FFFFFF) !important;
          opacity: 0.95 !important;
        }
        .modal-body {
          scrollbar-width: thin !important;
          scrollbar-color: var(--border, #D9D9D9) transparent !important;
        }
        .modal-body::-webkit-scrollbar {
          width: 5px !important;
        }
        .modal-body::-webkit-scrollbar-track {
          background: transparent !important;
        }
        .modal-body::-webkit-scrollbar-thumb {
          background: var(--border, #D9D9D9) !important;
          border-radius: 999px !important;
        }
        [data-theme='dark'] .cred-input,
        body.cb-dark-bw .cred-input,
        [data-theme='dark'] .cred-textarea,
        body.cb-dark-bw .cred-textarea {
          background: #141517;
          border-color: #282B32;
          color: #FFFFFF;
        }
        [data-theme='dark'] .cred-input:focus,
        body.cb-dark-bw .cred-input:focus,
        [data-theme='dark'] .cred-textarea:focus,
        body.cb-dark-bw .cred-textarea:focus {
          border-color: #FFFFFF;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
        }
        [data-theme='dark'] .cred-link-btn:hover,
        body.cb-dark-bw .cred-link-btn:hover {
          color: #FFFFFF;
        }
        [data-theme='dark'] .cred-enquiry-submit-btn,
        body.cb-dark-bw .cred-enquiry-submit-btn {
          background: #FFFFFF;
          color: #0A0A0A;
          border: 1px solid #E4E4E4;
        }
        [data-theme='dark'] .cred-enquiry-submit-btn:hover:not(:disabled),
        body.cb-dark-bw .cred-enquiry-submit-btn:hover:not(:disabled) {
          background: #EAEAEA;
        }
      `}</style>
    </div>

  )
}
