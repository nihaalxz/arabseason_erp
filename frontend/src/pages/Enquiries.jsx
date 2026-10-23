import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Phone, Mail, MessageSquare, Plus, Search, Calendar, 
  Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, 
  FileText, Trash2, Edit3, Eye, UploadCloud, 
  X, ChevronRight, Check, RotateCcw
} from 'lucide-react'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'
import SearchBar from '../components/common/SearchBar'
import SkeletonLoader from '../components/common/SkeletonLoader'
import Modal from '../components/common/Modal'
import { showConfirm, showError, showToast, showSuccess } from '../utils/swal'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [dueTodayOnly, setDueTodayOnly] = useState(false)

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedEnquiry, setSelectedEnquiry] = useState(null)
  const [previewMediaUrl, setPreviewMediaUrl] = useState(null)

  // Form State for Create / Edit
  const [formData, setFormData] = useState({
    customer_id: '',
    customer_name: '',
    phone: '',
    email: '',
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

  // Fetch initial data
  useEffect(() => {
    fetchCustomers()
    fetchMetrics()
  }, [])

  useEffect(() => {
    fetchEnquiries()
  }, [activeSection, selectedChannel, searchQuery, dueTodayOnly])

  const fetchCustomers = async () => {
    try {
      const res = await api.get('customers/?page_size=200')
      const raw = res.data.results || res.data || []
      setCustomers(raw)
    } catch (err) {
      console.error('Failed to load customers:', err)
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
      setSelectedEnquiry(enq)
      setIsEditing(true)
      setFormData({
        customer_id: enq.customer || '',
        customer_name: enq.customer_name || enq.customer_detail?.name || '',
        phone: enq.phone || enq.customer_detail?.phone || '',
        email: enq.email || enq.customer_detail?.email || '',
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
      
      {/* ── 1. PAGE HEADER (Matches Customers.jsx exactly) ── */}
      <div className="page-header" style={{ marginBottom: '0.85rem' }}>
        <div>
          <h2 style={{ fontWeight: '700', letterSpacing: '-0.01em', fontSize: '1.35rem' }}>Enquiries</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>
            Capture client inquiries from WhatsApp, calls & emails. Follow up seamlessly and convert quality leads.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => handleOpenModal()} 
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <Plus size={16} /> New Enquiry
          </button>
        </div>
      </div>

      {/* ── 2. SUMMARY CARDS GRID (Matches Customers.jsx glass-panel grid) ── */}
      <div className="summary-cards-grid" style={{ marginBottom: '0.85rem' }}>
        {/* Card 1: Follow-ups Due Today */}
        <div 
          className="glass-panel" 
          onClick={() => { setDueTodayOnly(!dueTodayOnly); if (!dueTodayOnly) setActiveSection('active') }}
          style={{ 
            textAlign: 'left', 
            padding: '0.75rem 1rem', 
            borderTop: '3px solid #d97706',
            cursor: 'pointer',
            background: dueTodayOnly ? 'rgba(217, 119, 6, 0.08)' : undefined
          }}
        >
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Follow-ups Due Today
          </p>
          <h2 style={{ color: '#d97706', fontWeight: '800', fontSize: '1.35rem', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {metrics.due_today_count}
          </h2>
        </div>

        {/* Card 2: Active Pipeline */}
        <div 
          className="glass-panel" 
          onClick={() => { setActiveSection('active'); setDueTodayOnly(false) }}
          style={{ 
            textAlign: 'left', 
            padding: '0.75rem 1rem', 
            borderTop: '3px solid #1366d9',
            cursor: 'pointer',
            background: activeSection === 'active' && !dueTodayOnly ? 'rgba(19, 102, 217, 0.05)' : undefined
          }}
        >
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Enquiries
          </p>
          <h2 style={{ color: 'var(--text-main)', fontWeight: '800', fontSize: '1.35rem', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {metrics.active_count}
          </h2>
        </div>

        {/* Card 3: Converted (Won) */}
        <div 
          className="glass-panel" 
          onClick={() => { setActiveSection('converted'); setDueTodayOnly(false) }}
          style={{ 
            textAlign: 'left', 
            padding: '0.75rem 1rem', 
            borderTop: '3px solid #0f7638',
            cursor: 'pointer',
            background: activeSection === 'converted' ? 'rgba(15, 118, 56, 0.05)' : undefined
          }}
        >
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Lead Converted (Won)
          </p>
          <h2 style={{ color: '#0f7638', fontWeight: '800', fontSize: '1.35rem', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {metrics.converted_count}
          </h2>
        </div>

        {/* Card 4: Cancelled / Lost */}
        <div 
          className="glass-panel" 
          onClick={() => { setActiveSection('cancelled'); setDueTodayOnly(false) }}
          style={{ 
            textAlign: 'left', 
            padding: '0.75rem 1rem', 
            borderTop: '3px solid #dc2626',
            cursor: 'pointer',
            background: activeSection === 'cancelled' ? 'rgba(220, 38, 38, 0.05)' : undefined
          }}
        >
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Cancelled / Lost
          </p>
          <h2 style={{ color: '#dc2626', fontWeight: '800', fontSize: '1.35rem', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {metrics.cancelled_count}
          </h2>
        </div>
      </div>

      {/* ── 3. SECTION TABS BAR (Matches Customers.jsx pill tabs exactly) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        marginBottom: '0.85rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ 
          display: 'inline-flex', 
          gap: '0.4rem', 
          background: 'rgba(0,0,0,0.04)', 
          padding: '0.3rem', 
          borderRadius: '10px' 
        }}>
          {/* Tab A: Active Enquiries */}
          <button
            type="button"
            className="btn"
            id="tab-active-enquiries"
            onClick={() => { setActiveSection('active'); setDueTodayOnly(false) }}
            style={{
              padding: '0.55rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: activeSection === 'active' && !dueTodayOnly ? '700' : '600',
              borderRadius: '8px',
              border: 'none',
              background: activeSection === 'active' && !dueTodayOnly ? '#ffffff' : 'transparent',
              color: activeSection === 'active' && !dueTodayOnly ? 'var(--primary, #1366d9)' : 'var(--text-muted)',
              boxShadow: activeSection === 'active' && !dueTodayOnly ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: activeSection === 'active' && !dueTodayOnly ? '#1366d9' : '#94a3b8',
              display: 'inline-block'
            }} />
            (a) Active Enquiries
            <span style={{
              background: activeSection === 'active' && !dueTodayOnly ? '#ebf3fc' : 'rgba(0,0,0,0.06)',
              color: activeSection === 'active' && !dueTodayOnly ? '#1366d9' : 'inherit',
              padding: '0.15rem 0.55rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '800'
            }}>
              {metrics.active_count}
            </span>
          </button>

          {/* Tab B: Converted Leads */}
          <button
            type="button"
            className="btn"
            id="tab-converted-enquiries"
            onClick={() => { setActiveSection('converted'); setDueTodayOnly(false) }}
            style={{
              padding: '0.55rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: activeSection === 'converted' ? '700' : '600',
              borderRadius: '8px',
              border: 'none',
              background: activeSection === 'converted' ? '#ffffff' : 'transparent',
              color: activeSection === 'converted' ? 'var(--success, #0f7638)' : 'var(--text-muted)',
              boxShadow: activeSection === 'converted' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: activeSection === 'converted' ? '#0f7638' : '#94a3b8',
              display: 'inline-block'
            }} />
            (b) Converted Leads (Won)
            <span style={{
              background: activeSection === 'converted' ? '#dcfce7' : 'rgba(0,0,0,0.06)',
              color: activeSection === 'converted' ? '#0f7638' : 'inherit',
              padding: '0.15rem 0.55rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '800'
            }}>
              {metrics.converted_count}
            </span>
          </button>

          {/* Tab C: Cancelled / Lost */}
          <button
            type="button"
            className="btn"
            id="tab-cancelled-enquiries"
            onClick={() => { setActiveSection('cancelled'); setDueTodayOnly(false) }}
            style={{
              padding: '0.55rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: activeSection === 'cancelled' ? '700' : '600',
              borderRadius: '8px',
              border: 'none',
              background: activeSection === 'cancelled' ? '#ffffff' : 'transparent',
              color: activeSection === 'cancelled' ? 'var(--danger, #dc2626)' : 'var(--text-muted)',
              boxShadow: activeSection === 'cancelled' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: activeSection === 'cancelled' ? '#dc2626' : '#94a3b8',
              display: 'inline-block'
            }} />
            (c) Cancelled / Lost
            <span style={{
              background: activeSection === 'cancelled' ? '#fee2e2' : 'rgba(0,0,0,0.06)',
              color: activeSection === 'cancelled' ? '#b91c1c' : 'inherit',
              padding: '0.15rem 0.55rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '800'
            }}>
              {metrics.cancelled_count}
            </span>
          </button>
        </div>

        {/* Highlight notification if follow-ups are due */}
        {metrics.due_today_count > 0 && (
          <div 
            onClick={() => { setDueTodayOnly(!dueTodayOnly); setActiveSection('active') }}
            style={{
              fontSize: '0.8rem',
              color: '#b45309',
              background: '#fef3c7',
              border: '1px solid #fde68a',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer'
            }}
          >
            <AlertCircle size={15} />
            <span>Follow-up Calls Due Today: <strong>{metrics.due_today_count}</strong></span>
          </div>
        )}
      </div>

      {/* ── 4. SEARCH & FILTER PANEL (Matches Customers.jsx exactly) ── */}
      <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '260px', maxWidth: '640px' }}>
          <SearchBar
            value={searchQuery}
            onChange={(val) => setSearchQuery(val)}
            style={{ flex: 1 }}
          />

          {/* Channel Filter */}
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            style={{
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: 'var(--radius-sm, 6px)',
              height: '38px',
              padding: '0 0.75rem',
              fontSize: '0.82rem',
              fontWeight: '600',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Channels</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone_call">Phone Call</option>
            <option value="email">Email</option>
            <option value="walk_in">Walk-in</option>
            <option value="website">Website</option>
          </select>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => { fetchEnquiries(); fetchMetrics() }}
          title="Refresh table"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* ── 5. MAIN DATA TABLE (Matches Customers.jsx desktop-only-table and table-container) ── */}
      <div className="glass-panel" style={{ overflowX: 'auto', minHeight: '200px', position: 'relative' }}>
        {loading ? (
          <div style={{ padding: '1.5rem' }}>
            <SkeletonLoader type="table" />
          </div>
        ) : (
          <>
            {enquiries.length === 0 && !error && (
              <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <MessageSquare size={32} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                <div style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  {searchQuery 
                    ? `No enquiries matching "${searchQuery}"`
                    : activeSection === 'active'
                    ? 'No active enquiries in progress. Click "+ New Enquiry" to record an inquiry.'
                    : activeSection === 'converted'
                    ? 'No converted leads yet. As enquiries confirm orders, they will appear here.'
                    : 'No cancelled enquiries recorded.'}
                </div>
              </div>
            )}

            {enquiries.length > 0 && (
              <>
                {/* Desktop Table View */}
                <div className="desktop-only-table">
                  <div className="table-container">
                    <table className="enquiries-table" style={{ width: '100%', minWidth: '1140px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '95px' }}>Enquiry #</th>
                          <th style={{ minWidth: '150px' }}>Customer / Prospect</th>
                          <th style={{ minWidth: '180px' }}>Specific Work Requested</th>
                          <th style={{ width: '90px' }}>Channel</th>
                          <th style={{ width: '90px' }}>Date</th>
                          <th style={{ width: '125px' }}>Follow-Up</th>
                          <th style={{ width: '100px', textAlign: 'right' }}>Est. Value</th>
                          <th style={{ width: '45px', textAlign: 'center' }}>Photo</th>
                          <th style={{ width: '120px' }}>Status</th>
                          <th style={{ width: '145px', textAlign: 'right', paddingRight: '0.9rem' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enquiries.map((enq) => {
                          const chCfg = CHANNEL_CONFIG[enq.channel] || CHANNEL_CONFIG.other
                          const stCfg = STATUS_CONFIG[enq.status] || STATUS_CONFIG.enquiry
                          const followStatus = getFollowUpStatus(enq.next_follow_up_date)
                          const clientName = enq.customer_name || enq.customer_detail?.name || 'Walk-in Prospect'
                          const phone = enq.phone || enq.customer_detail?.phone || ''

                          return (
                            <tr key={enq.id} className="hover-row">
                              {/* Enquiry Number */}
                              <td>
                                <div style={{ fontWeight: '700', color: 'var(--primary, #1366d9)' }}>
                                  {enq.enquiry_number}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '0.15rem' }}>
                                  ID-{enq.id.toString().padStart(4, '0')}
                                </div>
                              </td>

                              {/* Customer / Prospect */}
                              <td>
                                <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                                  {clientName}
                                </div>
                                {phone && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      {phone}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); openWhatsApp(phone, `Hello ${clientName}, regarding your enquiry ${enq.enquiry_number} with Arab Season:`) }}
                                      title="Open WhatsApp Chat"
                                      style={{
                                        background: 'rgba(22, 163, 74, 0.1)',
                                        border: 'none',
                                        color: '#16a34a',
                                        borderRadius: '4px',
                                        padding: '1px 5px',
                                        fontSize: '0.68rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.2rem'
                                      }}
                                    >
                                      <MessageSquare size={10} /> WA
                                    </button>
                                  </div>
                                )}
                              </td>

                              {/* Specific Work Requested */}
                              <td style={{ maxWidth: '220px' }}>
                                {enq.title && (
                                  <div style={{ fontWeight: '700', fontSize: '0.82rem', color: 'var(--text-main)', marginBottom: '0.15rem' }}>
                                    {enq.title}
                                  </div>
                                )}
                                <div style={{ 
                                  fontSize: '0.78rem', 
                                  color: 'var(--text-muted)', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap' 
                                }}
                                title={enq.description}
                                >
                                  {enq.description || '---'}
                                </div>
                              </td>

                              {/* Channel */}
                              <td>
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: '700',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '6px',
                                  background: chCfg.bg,
                                  color: chCfg.color,
                                  border: `1px solid ${chCfg.border}`,
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}>
                                  {chCfg.label}
                                </span>
                              </td>

                              {/* Enquiry Date */}
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                {enq.date}
                              </td>

                              {/* Follow-Up Status */}
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: '700',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '4px',
                                    background: 'rgba(0,0,0,0.05)',
                                    color: 'var(--text-main)'
                                  }}>
                                    📞 {enq.follow_up_count} {enq.follow_up_count === 1 ? 'call' : 'calls'}
                                  </span>

                                  {followStatus && enq.status !== 'converted' && enq.status !== 'cancelled' && (
                                    <span style={{
                                      fontSize: '0.7rem',
                                      fontWeight: '700',
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: '4px',
                                      background: followStatus.bg,
                                      color: followStatus.color
                                    }}>
                                      {followStatus.label}
                                    </span>
                                  )}

                                  {enq.follow_ups && enq.follow_ups.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => { setSelectedEnquiry(enq); setIsDetailModalOpen(true) }}
                                      title="View History Timeline"
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--primary, #1366d9)',
                                        fontSize: '0.72rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        padding: 0
                                      }}
                                    >
                                      History
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* Estimated Value */}
                              <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                                {enq.estimated_value ? formatCurrency(enq.estimated_value) : '---'}
                              </td>

                              {/* Reference Photo / Attachment */}
                              <td style={{ textAlign: 'center' }}>
                                {enq.attachment ? (
                                  <div
                                    onClick={() => setPreviewMediaUrl(enq.attachment)}
                                    title="Click to view reference attachment"
                                    style={{
                                      width: '34px',
                                      height: '34px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-color, #e2e8f0)',
                                      overflow: 'hidden',
                                      margin: '0 auto',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      background: '#f8fafc'
                                    }}
                                  >
                                    {enq.attachment_type?.includes('pdf') ? (
                                      <FileText size={18} color="#dc2626" />
                                    ) : (
                                      <img
                                        src={enq.attachment}
                                        alt="thumbnail"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>---</span>
                                )}
                              </td>

                              {/* Status Badge */}
                              <td>
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: '700',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '6px',
                                  background: stCfg.bg,
                                  color: stCfg.color,
                                  whiteSpace: 'nowrap'
                                }}>
                                  {stCfg.label}
                                </span>
                              </td>

                              {/* Actions */}
                              <td style={{ textAlign: 'right', whiteSpace: 'nowrap', paddingRight: '0.9rem' }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                                  {/* Log Follow-up button */}
                                  {enq.status !== 'converted' && enq.status !== 'cancelled' && (
                                    <>
                                      <button
                                        type="button"
                                        className="btn-icon"
                                        onClick={() => handleOpenFollowUp(enq)}
                                        title="Log Follow-up Call"
                                        style={{
                                          width: '28px',
                                          height: '28px',
                                          borderRadius: '6px',
                                          color: '#2563eb',
                                          background: 'rgba(37, 99, 235, 0.08)',
                                          border: '1px solid rgba(37, 99, 235, 0.2)'
                                        }}
                                      >
                                        <Phone size={13} />
                                      </button>

                                      <button
                                        type="button"
                                        className="btn-icon"
                                        onClick={() => handleMarkConverted(enq)}
                                        title="Mark as Converted (Won)"
                                        style={{
                                          width: '28px',
                                          height: '28px',
                                          borderRadius: '6px',
                                          color: '#0f7638',
                                          background: 'rgba(15, 118, 56, 0.08)',
                                          border: '1px solid rgba(15, 118, 56, 0.25)'
                                        }}
                                      >
                                        <CheckCircle2 size={13} />
                                      </button>
                                    </>
                                  )}

                                  {/* If Cancelled: Allow Restore */}
                                  {enq.status === 'cancelled' && (
                                    <button
                                      type="button"
                                      className="btn-icon"
                                      onClick={() => handleRestore(enq)}
                                      title="Restore to Active Pipeline"
                                      style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '6px',
                                        color: 'var(--primary, #1366d9)',
                                        background: 'rgba(19, 102, 217, 0.08)',
                                        border: '1px solid rgba(19, 102, 217, 0.25)'
                                      }}
                                    >
                                      <RotateCcw size={13} />
                                    </button>
                                  )}

                                  {/* Edit button */}
                                  <button
                                    type="button"
                                    className="btn-icon"
                                    style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                                    onClick={() => handleOpenModal(enq)}
                                    title="Edit Enquiry"
                                  >
                                    <Edit3 size={13} />
                                  </button>

                                  {/* Delete button */}
                                  <button
                                    type="button"
                                    className="btn-icon"
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '6px',
                                      color: 'var(--danger, #dc2626)',
                                      background: 'rgba(220, 38, 38, 0.05)',
                                      border: '1px solid rgba(220, 38, 38, 0.2)'
                                    }}
                                    onClick={() => handleDeleteEnquiry(enq.id, enq.enquiry_number)}
                                    title="Move to Recycle Bin"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Native Cards View (Matches Customers.jsx mobile-only-cards) */}
                <div className="mobile-only-cards" style={{ padding: '0.75rem' }}>
                  {enquiries.map((enq) => {
                    const clientName = enq.customer_name || enq.customer_detail?.name || 'Walk-in Prospect'
                    const phone = enq.phone || enq.customer_detail?.phone || ''
                    const stCfg = STATUS_CONFIG[enq.status] || STATUS_CONFIG.enquiry
                    const initials = clientName
                      ? clientName.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
                      : 'EN'

                    return (
                      <div key={enq.id} className="mobile-entity-card" style={{ marginBottom: '0.75rem' }}>
                        <div className="mobile-card-header">
                          <div className="mobile-card-title-group">
                            <div className="mobile-card-avatar" style={{ background: '#ebf3fc', color: '#1366d9' }}>
                              {initials}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div className="mobile-card-title">{clientName}</div>
                              <div className="mobile-card-sub">
                                <span style={{ fontWeight: '700', color: '#1366d9' }}>{enq.enquiry_number}</span>
                                {phone && <span> • {phone}</span>}
                              </div>
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: stCfg.bg,
                            color: stCfg.color
                          }}>
                            {stCfg.label}
                          </span>
                        </div>

                        <div className="mobile-card-body" style={{ padding: '0.5rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {enq.title && <div style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.2rem' }}>{enq.title}</div>}
                          <div style={{ lineHeight: '1.4' }}>{enq.description}</div>
                        </div>

                        <div className="mobile-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)' }}>
                            {enq.estimated_value ? formatCurrency(enq.estimated_value) : `📞 ${enq.follow_up_count} Calls`}
                          </span>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {enq.status !== 'converted' && enq.status !== 'cancelled' && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => handleOpenFollowUp(enq)}
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                              >
                                + Call
                              </button>
                            )}
                            <button
                              className="btn-icon"
                              style={{ width: '28px', height: '28px' }}
                              onClick={() => handleOpenModal(enq)}
                            >
                              <Edit3 size={13} />
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

      {/* ── 6. CREATE / EDIT ENQUIRY MODAL (Using ERP Modal component) ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? `Edit Enquiry: ${selectedEnquiry?.enquiry_number}` : 'New Customer Enquiry'}
        maxWidth="680px"
      >
        <form onSubmit={handleSaveEnquiry}>
          {formError && (
            <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <AlertCircle size={18} /> {formError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            {/* Existing Customer (Optional dropdown) */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Existing Customer (Optional)</label>
              <select
                className="input-field"
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
                <option value="">-- Or type new prospect name below --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.company_name ? `(${c.company_name})` : ''}</option>
                ))}
              </select>
            </div>

            {/* Customer / Prospect Name */}
            <div className="form-group">
              <label>Customer / Prospect Name *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="e.g. Abdullah Al-Otaibi"
                value={formData.customer_name}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
              />
            </div>

            {/* Phone / WhatsApp */}
            <div className="form-group">
              <label>Phone / WhatsApp Number</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. +966 50 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            {/* Channel */}
            <div className="form-group">
              <label>Inquiry Channel</label>
              <select
                className="input-field"
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

            {/* Date */}
            <div className="form-group">
              <label>Enquiry Date</label>
              <input
                type="date"
                className="input-field"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            {/* Subject / Title */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Subject / Project Summary</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 3D Acrylic Glow Signboard for Riyadh Branch"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            {/* Specific Work Requested / Description */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Specific Work Requested / Customer Requirements *</label>
              <textarea
                rows={4}
                required
                className="input-field"
                placeholder="Describe what the customer asked for (dimensions, materials, quantity, specifications)..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                style={{ minHeight: '90px', height: 'auto', resize: 'vertical' }}
              />
            </div>

            {/* Estimated Budget / Value */}
            <div className="form-group">
              <label>Estimated Value (SAR)</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="e.g. 4500"
                value={formData.estimated_value}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_value: e.target.value }))}
              />
            </div>

            {/* Next Follow-up Reminder Date */}
            <div className="form-group">
              <label>Next Follow-up Call Date</label>
              <input
                type="date"
                className="input-field"
                value={formData.next_follow_up_date}
                onChange={(e) => setFormData(prev => ({ ...prev, next_follow_up_date: e.target.value }))}
              />
            </div>

            {/* Reference Photo / Attachment Upload */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Reference Photo / Site Attachment (Image or PDF)</label>
              
              {formData.attachment ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(0,0,0,0.03)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.85rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', overflow: 'hidden' }}>
                    {formData.attachment_type?.includes('pdf') ? (
                      <FileText size={20} color="#dc2626" />
                    ) : (
                      <img
                        src={formData.attachment}
                        alt="preview"
                        style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover' }}
                      />
                    )}
                    <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {formData.attachment_name || 'Uploaded Reference'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--danger, #dc2626)',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border-color, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'rgba(0,0,0,0.02)',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <UploadCloud size={24} style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }} />
                  <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    Click to upload sample photo or drawing
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    JPG, PNG, WebP, or PDF up to 10MB
                  </div>
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

          {/* Modal Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.65rem 1.25rem' }}
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.75rem' }}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Enquiry')}
            </button>
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

      {/* ── 9. TIMELINE HISTORY MODAL ── */}
      <Modal
        isOpen={isDetailModalOpen && !!selectedEnquiry}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Follow-up Timeline: ${selectedEnquiry?.enquiry_number || ''}`}
        maxWidth="560px"
      >
        <div>
          {selectedEnquiry?.follow_ups && selectedEnquiry.follow_ups.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {selectedEnquiry.follow_ups.map((fu, idx) => (
                <div
                  key={fu.id || idx}
                  style={{
                    background: 'rgba(0,0,0,0.02)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '0.75rem 0.9rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1366d9' }}>
                      Follow-up #{fu.follow_up_number} • {fu.contact_mode_display || fu.contact_mode}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {fu.date ? new Date(fu.date).toLocaleDateString() : '---'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: '1.4', marginBottom: '0.35rem' }}>
                    "{fu.notes}"
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span>Outcome: <strong>{fu.outcome_display || fu.outcome}</strong></span>
                    {fu.created_by_name && <span>Logged by: {fu.created_by_name}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              No follow-up calls logged yet.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.65rem 1.5rem' }}
              onClick={() => setIsDetailModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
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

    </div>
  )
}
