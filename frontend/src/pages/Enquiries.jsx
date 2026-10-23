import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Phone, Mail, MessageSquare, Plus, Search, Calendar, 
  Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, 
  Filter, FileText, ExternalLink, Trash2, Edit3, Eye, 
  ArrowRight, UploadCloud, Paperclip, X, ChevronRight,
  TrendingUp, Users, DollarSign, Send, ArrowUpRight, Check
} from 'lucide-react'
import api from '../api'
import { useTheme } from '../contexts/ThemeContext'
import { useSettings } from '../contexts/SettingsContext'
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
  enquiry: { label: 'New Enquiry', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  quotation_pending: { label: 'Quotation Pending', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  quotation_sent: { label: 'Quotation Sent', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  under_followup: { label: 'Under Follow-up', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
  converted: { label: 'Lead Converted', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  cancelled: { label: 'Cancelled / Lost', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
}

const CANCELLATION_REASONS = [
  { id: 'price_high', label: 'Price Too High / Competitor Cheaper' },
  { id: 'client_postponed', label: 'Client Postponed / Event Cancelled' },
  { id: 'unresponsive', label: 'Client Unresponsive' },
  { id: 'specs_unmet', label: 'Specifications Could Not Be Met' },
  { id: 'turnaround_time', 'label': 'Delivery Deadline Too Tight' },
  { id: 'other', label: 'Other Reason' },
]

export default function Enquiries({ currentUser }) {
  const { isDarkMode } = useTheme()
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
  const [activeTab, setActiveTab] = useState('active') // 'active' | 'converted' | 'cancelled'
  const [selectedChannel, setSelectedChannel] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dueTodayOnly, setDueTodayOnly] = useState(false)

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
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
  const [saving, setSaving] = useState(false)

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

  // Colors & Theme Tokens
  const cardBg = isDarkMode ? '#111317' : '#ffffff'
  const borderColor = isDarkMode ? '#22252a' : '#e2e8f0'
  const textPrimary = isDarkMode ? '#f8fafc' : '#0f172a'
  const textMuted = isDarkMode ? '#94a3b8' : '#64748b'
  const bgSubtle = isDarkMode ? '#1a1d23' : '#f8fafc'

  // Fetch Initial Data
  useEffect(() => {
    fetchCustomers()
    fetchMetrics()
  }, [])

  useEffect(() => {
    fetchEnquiries()
  }, [activeTab, selectedChannel, searchQuery, dueTodayOnly])

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
    try {
      const params = { page_size: 200 }
      if (activeTab === 'active') {
        params.status = 'active'
      } else if (activeTab === 'converted') {
        params.status = 'completed'
      } else if (activeTab === 'cancelled') {
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
      showError('Failed to load enquiries', err?.message)
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

  // Save / Edit Enquiry
  const handleSaveEnquiry = async (e) => {
    e.preventDefault()
    if (!formData.customer_name.trim() && !formData.customer_id) {
      showError('Customer Required', 'Please select an existing customer or enter a prospect name.')
      return
    }

    setSaving(true)
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
        showSuccess('Enquiry Updated', 'Enquiry details have been updated.')
      } else {
        await api.post('enquiries/', payload)
        showSuccess('Enquiry Created', 'New customer enquiry has been captured.')
      }

      setIsCreateModalOpen(false)
      fetchEnquiries()
      fetchMetrics()
    } catch (err) {
      showError('Failed to save enquiry', err?.response?.data?.detail || err?.message)
    } finally {
      setSaving(false)
    }
  }

  // Open Edit Modal
  const handleOpenEdit = (enq) => {
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
    setIsCreateModalOpen(true)
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

  // Submit Follow-Up
  const handleSaveFollowUp = async (e) => {
    e.preventDefault()
    if (!followUpData.notes.trim()) {
      showError('Notes Required', 'Please enter a summary of the follow-up call/conversation.')
      return
    }

    setSaving(true)
    try {
      await api.post(`enquiries/${selectedEnquiry.id}/log-follow-up/`, followUpData)
      showSuccess('Follow-up Logged', 'Follow-up call notes saved and counter incremented.')
      setIsFollowUpModalOpen(false)
      fetchEnquiries()
      fetchMetrics()
    } catch (err) {
      showError('Failed to log follow-up', err?.message)
    } finally {
      setSaving(false)
    }
  }

  // Mark Converted (Won)
  const handleMarkConverted = async (enq) => {
    const confirmed = await showConfirm(
      'Mark Lead as Converted?',
      `Are you sure you want to mark ${enq.enquiry_number} for "${enq.customer_name || enq.customer_detail?.name}" as converted?`
    )
    if (!confirmed) return

    try {
      await api.post(`enquiries/${enq.id}/mark-converted/`, {})
      showSuccess('Lead Converted!', 'The deal has been marked as won and moved to Converted list.')
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
    setSaving(true)
    try {
      await api.post(`enquiries/${selectedEnquiry.id}/mark-cancelled/`, cancelData)
      showToast('Enquiry marked as cancelled / lost.')
      setIsCancelModalOpen(false)
      fetchEnquiries()
      fetchMetrics()
    } catch (err) {
      showError('Failed to cancel enquiry', err?.message)
    } finally {
      setSaving(false)
    }
  }

  // Restore Cancelled Lead
  const handleRestore = async (enq) => {
    try {
      await api.post(`enquiries/${enq.id}/restore/`, {})
      showSuccess('Enquiry Restored', 'Enquiry has been restored to active pipeline.')
      fetchEnquiries()
      fetchMetrics()
    } catch (err) {
      showError('Failed to restore enquiry', err?.message)
    }
  }

  // Delete Enquiry
  const handleDeleteEnquiry = async (enq) => {
    const confirmed = await showConfirm(
      'Delete Enquiry?',
      `Are you sure you want to delete ${enq.enquiry_number}? This action can be undone in Recycle Bin.`
    )
    if (!confirmed) return

    try {
      await api.delete(`enquiries/${enq.id}/`)
      showToast('Enquiry deleted.')
      fetchEnquiries()
      fetchMetrics()
    } catch (err) {
      showError('Failed to delete enquiry', err?.message)
    }
  }

  // 1-Click Navigate to Create Job Order from Converted Lead
  const handleCreateJobOrder = (enq) => {
    const customerId = enq.customer || ''
    const description = encodeURIComponent(enq.description || enq.title || '')
    navigate(`/jobs?action=new&customerId=${customerId}&desc=${description}&ref=${enq.enquiry_number}`)
  }

  // Format date helper
  const fmtDate = (d) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return d
    }
  }

  // Format currency helper
  const fmt = (v) => {
    if (v === null || v === undefined || isNaN(v)) return '—'
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
    if (dateStr < today) return { label: 'Overdue', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' }
    if (dateStr === today) return { label: 'Due Today', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
    return { label: `Due: ${fmtDate(dateStr)}`, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }
  }

  return (
    <div style={{
      maxWidth: '1440px',
      margin: '0 auto',
      padding: '1.25rem 1.5rem 4rem',
      color: textPrimary
    }}>
      {/* ── 1. HEADER SECTION ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
              Enquiries
            </h1>
            <span style={{
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              fontSize: '0.75rem',
              fontWeight: '700',
              padding: '0.2rem 0.6rem',
              borderRadius: '6px'
            }}>
              Sales Pipeline
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: textMuted }}>
            Capture incoming customer inquiries from WhatsApp, calls & emails. Follow up seamlessly and convert leads.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={() => { fetchEnquiries(); fetchMetrics() }}
            title="Refresh Enquiries"
            style={{
              background: cardBg,
              color: textPrimary,
              border: `1px solid ${borderColor}`,
              borderRadius: '10px',
              height: '40px',
              padding: '0 0.85rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
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
              setIsCreateModalOpen(true)
            }}
            style={{
              background: isDarkMode ? '#ffffff' : '#0f172a',
              color: isDarkMode ? '#0f172a' : '#ffffff',
              border: 'none',
              borderRadius: '10px',
              height: '40px',
              padding: '0 1.25rem',
              fontSize: '0.875rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: isDarkMode ? 'none' : '0 2px 8px rgba(15, 23, 42, 0.15)',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={16} strokeWidth={2.8} />
            <span>New Enquiry</span>
          </button>
        </div>
      </div>

      {/* ── 2. TOP METRIC CARDS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '0.85rem',
        marginBottom: '1.5rem'
      }}>
        {/* Metric 1: Follow-ups Due Today */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setDueTodayOnly(!dueTodayOnly)
            if (!dueTodayOnly) setActiveTab('active')
          }}
          style={{
            background: dueTodayOnly ? 'rgba(245, 158, 11, 0.08)' : cardBg,
            border: `1px solid ${dueTodayOnly ? '#f59e0b' : borderColor}`,
            borderRadius: '12px',
            padding: '1rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: '#f59e0b' }}>
              Follow-ups Due Today
            </span>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'rgba(245, 158, 11, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b'
            }}>
              <AlertCircle size={15} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0.4rem 0 0.15rem' }}>
            {metrics.due_today_count}
          </div>
          <div style={{ fontSize: '0.75rem', color: textMuted }}>
            {dueTodayOnly ? '✓ Filter Active (Click to reset)' : 'Click to filter calls due today'}
          </div>
        </div>

        {/* Metric 2: Active Pipeline */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setActiveTab('active'); setDueTodayOnly(false) }}
          style={{
            background: activeTab === 'active' && !dueTodayOnly ? 'rgba(59, 130, 246, 0.08)' : cardBg,
            border: `1px solid ${activeTab === 'active' && !dueTodayOnly ? '#3b82f6' : borderColor}`,
            borderRadius: '12px',
            padding: '1rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: '#3b82f6' }}>
              Active Enquiries
            </span>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'rgba(59, 130, 246, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6'
            }}>
              <Clock size={15} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0.4rem 0 0.15rem' }}>
            {metrics.active_count}
          </div>
          <div style={{ fontSize: '0.75rem', color: textMuted }}>
            Under enquiry, quote or follow-up
          </div>
        </div>

        {/* Metric 3: Converted Leads */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setActiveTab('converted'); setDueTodayOnly(false) }}
          style={{
            background: activeTab === 'converted' ? 'rgba(16, 185, 129, 0.08)' : cardBg,
            border: `1px solid ${activeTab === 'converted' ? '#10b981' : borderColor}`,
            borderRadius: '12px',
            padding: '1rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: '#10b981' }}>
              Lead Converted (Won)
            </span>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'rgba(16, 185, 129, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981'
            }}>
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0.4rem 0 0.15rem', color: '#10b981' }}>
            {metrics.converted_count}
          </div>
          <div style={{ fontSize: '0.75rem', color: textMuted }}>
            {metrics.conversion_rate}% Win Rate
          </div>
        </div>

        {/* Metric 4: Cancelled / Lost */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setActiveTab('cancelled'); setDueTodayOnly(false) }}
          style={{
            background: activeTab === 'cancelled' ? 'rgba(239, 68, 68, 0.08)' : cardBg,
            border: `1px solid ${activeTab === 'cancelled' ? '#ef4444' : borderColor}`,
            borderRadius: '12px',
            padding: '1rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: '#ef4444' }}>
              Cancelled / Lost
            </span>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'rgba(239, 68, 68, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444'
            }}>
              <XCircle size={15} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0.4rem 0 0.15rem' }}>
            {metrics.cancelled_count}
          </div>
          <div style={{ fontSize: '0.75rem', color: textMuted }}>
            Archived with loss reasons
          </div>
        </div>
      </div>

      {/* ── 3. TABS & FILTER BAR ── */}
      <div style={{
        background: cardBg,
        border: `1px solid ${borderColor}`,
        borderRadius: '14px',
        padding: '0.85rem 1rem',
        marginBottom: '1.25rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem'
      }}>
        {/* Left: Tab Switcher (As requested: Pending Tasks vs Completed) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { setActiveTab('active'); setDueTodayOnly(false) }}
            style={{
              background: activeTab === 'active' && !dueTodayOnly ? (isDarkMode ? '#ffffff' : '#0f172a') : 'transparent',
              color: activeTab === 'active' && !dueTodayOnly ? (isDarkMode ? '#0f172a' : '#ffffff') : textMuted,
              border: 'none',
              borderRadius: '8px',
              padding: '0.45rem 0.95rem',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Active Enquiries</span>
            <span style={{
              background: activeTab === 'active' && !dueTodayOnly ? (isDarkMode ? 'rgba(15, 23, 42, 0.2)' : 'rgba(255, 255, 255, 0.25)') : bgSubtle,
              fontSize: '0.72rem',
              padding: '0.1rem 0.45rem',
              borderRadius: '10px'
            }}>
              {metrics.active_count}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('converted'); setDueTodayOnly(false) }}
            style={{
              background: activeTab === 'converted' ? (isDarkMode ? '#ffffff' : '#0f172a') : 'transparent',
              color: activeTab === 'converted' ? (isDarkMode ? '#0f172a' : '#ffffff') : textMuted,
              border: 'none',
              borderRadius: '8px',
              padding: '0.45rem 0.95rem',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Lead Converted</span>
            <span style={{
              background: activeTab === 'converted' ? (isDarkMode ? 'rgba(15, 23, 42, 0.2)' : 'rgba(255, 255, 255, 0.25)') : bgSubtle,
              fontSize: '0.72rem',
              padding: '0.1rem 0.45rem',
              borderRadius: '10px'
            }}>
              {metrics.converted_count}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('cancelled'); setDueTodayOnly(false) }}
            style={{
              background: activeTab === 'cancelled' ? (isDarkMode ? '#ffffff' : '#0f172a') : 'transparent',
              color: activeTab === 'cancelled' ? (isDarkMode ? '#0f172a' : '#ffffff') : textMuted,
              border: 'none',
              borderRadius: '8px',
              padding: '0.45rem 0.95rem',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Cancelled / Lost</span>
            <span style={{
              background: activeTab === 'cancelled' ? (isDarkMode ? 'rgba(15, 23, 42, 0.2)' : 'rgba(255, 255, 255, 0.25)') : bgSubtle,
              fontSize: '0.72rem',
              padding: '0.1rem 0.45rem',
              borderRadius: '10px'
            }}>
              {metrics.cancelled_count}
            </span>
          </button>
        </div>

        {/* Right: Search & Channel Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end', minWidth: '280px' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: textMuted }} />
            <input
              type="text"
              placeholder="Search enquiry or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: bgSubtle,
                border: `1px solid ${borderColor}`,
                borderRadius: '8px',
                height: '36px',
                padding: '0 0.75rem 0 2rem',
                fontSize: '0.82rem',
                color: textPrimary,
                outline: 'none'
              }}
            />
          </div>

          {/* Channel Filter Dropdown */}
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            style={{
              background: bgSubtle,
              color: textPrimary,
              border: `1px solid ${borderColor}`,
              borderRadius: '8px',
              height: '36px',
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
      </div>

      {/* ── 4. ENQUIRIES LIST / TABLE ── */}
      {loading ? (
        <div style={{
          background: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: '14px',
          padding: '3rem',
          textAlign: 'center',
          color: textMuted
        }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
          <div>Loading enquiries...</div>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
      ) : enquiries.length === 0 ? (
        <div style={{
          background: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: '14px',
          padding: '3.5rem 1.5rem',
          textAlign: 'center',
          color: textMuted
        }}>
          <MessageSquare size={36} style={{ color: textMuted, opacity: 0.5, marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: textPrimary, margin: '0 0 0.35rem' }}>
            No Enquiries Found
          </h3>
          <p style={{ fontSize: '0.85rem', margin: '0 0 1.25rem', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
            {activeTab === 'active' 
              ? 'No active enquiries in progress. Click "New Enquiry" to log incoming WhatsApp, call or email requests.'
              : activeTab === 'converted'
              ? 'No converted leads yet. As client orders get confirmed, mark them converted to show here.'
              : 'No cancelled enquiries recorded.'}
          </p>
          {activeTab === 'active' && (
            <button
              type="button"
              onClick={() => {
                setIsEditing(false)
                setIsCreateModalOpen(true)
              }}
              style={{
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.55rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              + Create First Enquiry
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {enquiries.map((enq) => {
            const chCfg = CHANNEL_CONFIG[enq.channel] || CHANNEL_CONFIG.other
            const stCfg = STATUS_CONFIG[enq.status] || STATUS_CONFIG.enquiry
            const followStatus = getFollowUpStatus(enq.next_follow_up_date)
            const clientName = enq.customer_name || enq.customer_detail?.name || 'Walk-in Prospect'
            const phone = enq.phone || enq.customer_detail?.phone || ''

            return (
              <div
                key={enq.id}
                style={{
                  background: cardBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '12px',
                  padding: '1.1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  transition: 'border-color 0.15s ease'
                }}
              >
                {/* Top Row: Ref #, Channel Badge, Status Badge, Date & Actions */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontWeight: '800',
                      fontSize: '0.9rem',
                      letterSpacing: '-0.01em',
                      color: textPrimary
                    }}>
                      {enq.enquiry_number}
                    </span>

                    {/* Channel Badge */}
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px',
                      background: chCfg.bg,
                      color: chCfg.color,
                      border: `1px solid ${chCfg.border}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}>
                      {chCfg.label}
                    </span>

                    {/* Status Badge */}
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px',
                      background: stCfg.bg,
                      color: stCfg.color
                    }}>
                      {stCfg.label}
                    </span>

                    {/* Follow-up Reminder Badge */}
                    {followStatus && enq.status !== 'converted' && enq.status !== 'cancelled' && (
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: followStatus.bg,
                        color: followStatus.color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}>
                        <Clock size={11} />
                        {followStatus.label}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontSize: '0.75rem', color: textMuted }}>
                      {fmtDate(enq.date)}
                    </span>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(enq)}
                      title="Edit Enquiry"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: textMuted,
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px'
                      }}
                    >
                      <Edit3 size={15} />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteEnquiry(enq)}
                      title="Delete Enquiry"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: textMuted,
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px'
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Middle Content: Client Info, Requirement, Attachment Thumbnail */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: enq.attachment ? '1fr 100px' : '1fr',
                  gap: '1rem',
                  alignItems: 'start'
                }}>
                  <div>
                    {/* Customer Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '1rem', fontWeight: '800', color: textPrimary }}>
                        {clientName}
                      </span>

                      {phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.8rem', color: textMuted }}>
                            {phone}
                          </span>

                          {/* WhatsApp Chat Button */}
                          <button
                            type="button"
                            onClick={() => openWhatsApp(phone, `Hello ${clientName}, regarding your enquiry ${enq.enquiry_number} with Arab Season:`)}
                            title="Open WhatsApp Chat"
                            style={{
                              background: 'rgba(22, 163, 74, 0.12)',
                              border: 'none',
                              color: '#16a34a',
                              borderRadius: '5px',
                              padding: '2px 6px',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            <MessageSquare size={11} />
                            <span>WhatsApp</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Specific Work Requested / Title & Description */}
                    {enq.title && (
                      <div style={{ fontSize: '0.875rem', fontWeight: '700', color: textPrimary, marginBottom: '0.2rem' }}>
                        {enq.title}
                      </div>
                    )}

                    <div style={{
                      fontSize: '0.84rem',
                      color: textMuted,
                      lineHeight: '1.45',
                      whiteSpace: 'pre-wrap',
                      background: bgSubtle,
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: `1px solid ${borderColor}`
                    }}>
                      {enq.description || 'No work description specified.'}
                    </div>

                    {/* Cancellation Note if cancelled */}
                    {enq.status === 'cancelled' && (
                      <div style={{
                        marginTop: '0.5rem',
                        fontSize: '0.8rem',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        color: '#ef4444'
                      }}>
                        <strong>Cancellation Reason:</strong> {enq.cancellation_reason_display || 'Other'}
                        {enq.cancellation_notes && ` — "${enq.cancellation_notes}"`}
                      </div>
                    )}
                  </div>

                  {/* Reference Attachment Preview */}
                  {enq.attachment && (
                    <div style={{
                      width: '100px',
                      height: '90px',
                      borderRadius: '8px',
                      border: `1px solid ${borderColor}`,
                      overflow: 'hidden',
                      position: 'relative',
                      background: bgSubtle,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    onClick={() => setPreviewMediaUrl(enq.attachment)}
                    title="Click to view reference photo"
                    >
                      {enq.attachment_type?.includes('pdf') ? (
                        <div style={{ textAlign: 'center', color: '#ef4444' }}>
                          <FileText size={28} />
                          <div style={{ fontSize: '0.65rem', fontWeight: '700', marginTop: '2px' }}>PDF SPEC</div>
                        </div>
                      ) : (
                        <img
                          src={enq.attachment}
                          alt="Reference preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'rgba(0,0,0,0.65)',
                        color: '#ffffff',
                        fontSize: '0.65rem',
                        fontWeight: '600',
                        textAlign: 'center',
                        padding: '2px 0'
                      }}>
                        View Photo
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  paddingTop: '0.65rem',
                  borderTop: `1px solid ${borderColor}`
                }}>
                  {/* Follow-up Counter and History info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      color: enq.follow_up_count > 0 ? '#3b82f6' : textMuted,
                      background: bgSubtle,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px',
                      border: `1px solid ${borderColor}`
                    }}>
                      📞 {enq.follow_up_count} {enq.follow_up_count === 1 ? 'Follow-up' : 'Follow-ups'} Done
                    </span>

                    {enq.estimated_value && (
                      <span style={{ fontSize: '0.78rem', fontWeight: '700', color: textPrimary }}>
                        Est. SAR {fmt(enq.estimated_value)}
                      </span>
                    )}

                    {enq.follow_ups && enq.follow_ups.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setSelectedEnquiry(enq); setIsDetailModalOpen(true) }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#3b82f6',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        View History ({enq.follow_ups.length})
                      </button>
                    )}
                  </div>

                  {/* Action Buttons depending on status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    {enq.status !== 'converted' && enq.status !== 'cancelled' && (
                      <>
                        {/* Log Follow-up Call */}
                        <button
                          type="button"
                          onClick={() => handleOpenFollowUp(enq)}
                          style={{
                            background: bgSubtle,
                            color: textPrimary,
                            border: `1px solid ${borderColor}`,
                            borderRadius: '8px',
                            height: '34px',
                            padding: '0 0.85rem',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <Phone size={13} />
                          <span>+ Log Call</span>
                        </button>

                        {/* Mark Converted (Won) */}
                        <button
                          type="button"
                          onClick={() => handleMarkConverted(enq)}
                          style={{
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            height: '34px',
                            padding: '0 0.95rem',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            boxShadow: '0 1px 4px rgba(16, 185, 129, 0.25)'
                          }}
                        >
                          <CheckCircle2 size={13} />
                          <span>Convert Lead</span>
                        </button>

                        {/* Cancel / Lost */}
                        <button
                          type="button"
                          onClick={() => handleOpenCancel(enq)}
                          style={{
                            background: 'transparent',
                            color: '#ef4444',
                            border: `1px solid rgba(239, 68, 68, 0.3)`,
                            borderRadius: '8px',
                            height: '34px',
                            padding: '0 0.75rem',
                            fontSize: '0.78rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {/* If Converted: Give 1-click Create Job Order button */}
                    {enq.status === 'converted' && (
                      <button
                        type="button"
                        onClick={() => handleCreateJobOrder(enq)}
                        style={{
                          background: isDarkMode ? '#ffffff' : '#0f172a',
                          color: isDarkMode ? '#0f172a' : '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          height: '34px',
                          padding: '0 1rem',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        <span>+ Create Job Order</span>
                        <ArrowUpRight size={13} />
                      </button>
                    )}

                    {/* If Cancelled: Allow Restore */}
                    {enq.status === 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => handleRestore(enq)}
                        style={{
                          background: bgSubtle,
                          color: textPrimary,
                          border: `1px solid ${borderColor}`,
                          borderRadius: '8px',
                          height: '34px',
                          padding: '0 0.85rem',
                          fontSize: '0.78rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Restore to Pipeline
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 5. NEW / EDIT ENQUIRY MODAL ── */}
      {isCreateModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: cardBg,
            border: `1px solid ${borderColor}`,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '620px',
            maxHeight: 'calc(100vh - 3.5rem)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.1rem 1.4rem',
              borderBottom: `1px solid ${borderColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: textPrimary }}>
                  {isEditing ? `Edit Enquiry (${selectedEnquiry?.enquiry_number})` : 'New Customer Enquiry'}
                </h2>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: textMuted }}>
                  Record customer inquiry details, channel, and reference photo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{
                  background: bgSubtle,
                  border: 'none',
                  color: textMuted,
                  borderRadius: '6px',
                  padding: '5px',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Scroll Area */}
            <form onSubmit={handleSaveEnquiry} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.4rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem', marginBottom: '0.9rem' }}>
                {/* Existing Customer (Optional dropdown) */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                    Existing Customer (Optional)
                  </label>
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
                    style={{
                      width: '100%',
                      background: bgSubtle,
                      color: textPrimary,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      height: '38px',
                      padding: '0 0.75rem',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  >
                    <option value="">-- Or type new prospect below --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.company_name ? `(${c.company_name})` : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Prospect / Client Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                    Customer / Prospect Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abdullah Al-Otaibi"
                    value={formData.customer_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: bgSubtle,
                      color: textPrimary,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      height: '38px',
                      padding: '0 0.75rem',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Phone / WhatsApp */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                    Phone / WhatsApp Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +966 50 123 4567"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: bgSubtle,
                      color: textPrimary,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      height: '38px',
                      padding: '0 0.75rem',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Channel */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                    Inquiry Channel
                  </label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData(prev => ({ ...prev, channel: e.target.value }))}
                    style={{
                      width: '100%',
                      background: bgSubtle,
                      color: textPrimary,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      height: '38px',
                      padding: '0 0.75rem',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
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
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                    Enquiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: bgSubtle,
                      color: textPrimary,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      height: '38px',
                      padding: '0 0.75rem',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Short Title */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                    Subject / Project Summary
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 3D Acrylic Glow Signboard for Riyadh Branch"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: bgSubtle,
                      color: textPrimary,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      height: '38px',
                      padding: '0 0.75rem',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Work Requested / Description */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                    Specific Work Requested / Customer Requirements *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe what the customer asked for (dimensions, materials, quantity, specifications)..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: bgSubtle,
                      color: textPrimary,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      padding: '0.65rem 0.75rem',
                      fontSize: '0.85rem',
                      lineHeight: '1.45',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Estimated Budget / Value */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                    Estimated Value (SAR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 4500"
                    value={formData.estimated_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimated_value: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: bgSubtle,
                      color: textPrimary,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      height: '38px',
                      padding: '0 0.75rem',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Next Follow-up Reminder Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                    Next Follow-up Call Date
                  </label>
                  <input
                    type="date"
                    value={formData.next_follow_up_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, next_follow_up_date: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: bgSubtle,
                      color: textPrimary,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      height: '38px',
                      padding: '0 0.75rem',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Reference Photo / Attachment Upload */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                    Reference Photo / Site Attachment (Image or PDF)
                  </label>
                  
                  {formData.attachment ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: bgSubtle,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      padding: '0.65rem 0.85rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', overflow: 'hidden' }}>
                        {formData.attachment_type?.includes('pdf') ? (
                          <FileText size={20} color="#ef4444" />
                        ) : (
                          <img
                            src={formData.attachment}
                            alt="preview"
                            style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover' }}
                          />
                        )}
                        <span style={{ fontSize: '0.82rem', fontWeight: '600', color: textPrimary, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {formData.attachment_name || 'Uploaded Reference'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveAttachment}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
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
                        border: `2px dashed ${borderColor}`,
                        borderRadius: '8px',
                        padding: '1.25rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: bgSubtle,
                        transition: 'border-color 0.15s ease'
                      }}
                    >
                      <UploadCloud size={24} style={{ color: textMuted, marginBottom: '0.25rem' }} />
                      <div style={{ fontSize: '0.82rem', fontWeight: '700', color: textPrimary }}>
                        Click to upload sample photo or drawing
                      </div>
                      <div style={{ fontSize: '0.72rem', color: textMuted }}>
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

              {/* Modal Action Buttons */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.65rem',
                paddingTop: '1rem',
                borderTop: `1px solid ${borderColor}`
              }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{
                    background: bgSubtle,
                    color: textPrimary,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '8px',
                    height: '38px',
                    padding: '0 1rem',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: isDarkMode ? '#ffffff' : '#0f172a',
                    color: isDarkMode ? '#0f172a' : '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    height: '38px',
                    padding: '0 1.35rem',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1
                  }}
                >
                  {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Enquiry')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 6. LOG FOLLOW-UP MODAL ── */}
      {isFollowUpModalOpen && selectedEnquiry && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: cardBg,
            border: `1px solid ${borderColor}`,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            padding: '1.4rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: textPrimary }}>
                  Log Follow-up Call / Interaction
                </h3>
                <div style={{ fontSize: '0.78rem', color: textMuted, marginTop: '0.15rem' }}>
                  {selectedEnquiry.enquiry_number} • {selectedEnquiry.customer_name || selectedEnquiry.customer_detail?.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFollowUpModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: textMuted, cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFollowUp}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
                {/* Contact Mode */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                    Contact Channel
                  </label>
                  <select
                    value={followUpData.contact_mode}
                    onChange={(e) => setFollowUpData(prev => ({ ...prev, contact_mode: e.target.value }))}
                    style={{
                      width: '100%',
                      background: bgSubtle,
                      color: textPrimary,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      height: '38px',
                      padding: '0 0.75rem',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  >
                    <option value="phone_call">Phone Call</option>
                    <option value="whatsapp">WhatsApp Message</option>
                    <option value="email">Email</option>
                    <option value="meeting">In-Person Meeting</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Outcome */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                    Call Outcome
                  </label>
                  <select
                    value={followUpData.outcome}
                    onChange={(e) => setFollowUpData(prev => ({ ...prev, outcome: e.target.value }))}
                    style={{
                      width: '100%',
                      background: bgSubtle,
                      color: textPrimary,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      height: '38px',
                      padding: '0 0.75rem',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
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
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                      Schedule Next Follow-up Call
                    </label>
                    <input
                      type="date"
                      value={followUpData.next_follow_up_date}
                      onChange={(e) => setFollowUpData(prev => ({ ...prev, next_follow_up_date: e.target.value }))}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: bgSubtle,
                        color: textPrimary,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '8px',
                        height: '38px',
                        padding: '0 0.75rem',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                )}

                {/* Notes */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                    Conversation Notes & Updates *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Spoke to client. They requested a 5% discount on the quote. Will confirm order tomorrow."
                    value={followUpData.notes}
                    onChange={(e) => setFollowUpData(prev => ({ ...prev, notes: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: bgSubtle,
                      color: textPrimary,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      padding: '0.65rem 0.75rem',
                      fontSize: '0.85rem',
                      lineHeight: '1.4',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(false)}
                  style={{
                    background: bgSubtle,
                    color: textPrimary,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '8px',
                    height: '36px',
                    padding: '0 0.95rem',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    height: '36px',
                    padding: '0 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: saving ? 'not-allowed' : 'pointer'
                  }}
                >
                  {saving ? 'Logging...' : 'Log Follow-up Call'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 7. CANCEL / LOST MODAL ── */}
      {isCancelModalOpen && selectedEnquiry && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: cardBg,
            border: `1px solid ${borderColor}`,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            padding: '1.4rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#ef4444' }}>
                  Cancel / Mark Lead as Lost
                </h3>
                <div style={{ fontSize: '0.78rem', color: textMuted, marginTop: '0.15rem' }}>
                  Capture why the customer decided not to proceed.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: textMuted, cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCancel}>
              <div style={{ marginBottom: '0.9rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                  Primary Loss Reason *
                </label>
                <select
                  value={cancelData.cancellation_reason}
                  onChange={(e) => setCancelData(prev => ({ ...prev, cancellation_reason: e.target.value }))}
                  style={{
                    width: '100%',
                    background: bgSubtle,
                    color: textPrimary,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '8px',
                    height: '38px',
                    padding: '0 0.75rem',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                >
                  {CANCELLATION_REASONS.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.35rem', color: textMuted }}>
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Customer stated another company offered 15% cheaper for acrylic signage."
                  value={cancelData.cancellation_notes}
                  onChange={(e) => setCancelData(prev => ({ ...prev, cancellation_notes: e.target.value }))}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: bgSubtle,
                    color: textPrimary,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '8px',
                    padding: '0.65rem 0.75rem',
                    fontSize: '0.85rem',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  style={{
                    background: bgSubtle,
                    color: textPrimary,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '8px',
                    height: '36px',
                    padding: '0 0.95rem',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Keep Active
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    height: '36px',
                    padding: '0 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: saving ? 'not-allowed' : 'pointer'
                  }}
                >
                  {saving ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 8. FOLLOW-UP HISTORY DETAIL MODAL ── */}
      {isDetailModalOpen && selectedEnquiry && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: cardBg,
            border: `1px solid ${borderColor}`,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: 'calc(100vh - 4rem)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
          }}>
            <div style={{
              padding: '1.1rem 1.4rem',
              borderBottom: `1px solid ${borderColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: textPrimary }}>
                  Follow-up Timeline
                </h3>
                <div style={{ fontSize: '0.78rem', color: textMuted, marginTop: '0.15rem' }}>
                  {selectedEnquiry.enquiry_number} • {selectedEnquiry.customer_name || selectedEnquiry.customer_detail?.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: textMuted, cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.4rem' }}>
              {selectedEnquiry.follow_ups && selectedEnquiry.follow_ups.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {selectedEnquiry.follow_ups.map((fu, idx) => (
                    <div
                      key={fu.id || idx}
                      style={{
                        background: bgSubtle,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '10px',
                        padding: '0.85rem 1rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#3b82f6' }}>
                          Follow-up #{fu.follow_up_number} • {fu.contact_mode_display || fu.contact_mode}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: textMuted }}>
                          {fmtDate(fu.date)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: textPrimary, lineHeight: '1.4', marginBottom: '0.4rem' }}>
                        "{fu.notes}"
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: textMuted }}>
                        <span>Outcome: <strong>{fu.outcome_display || fu.outcome}</strong></span>
                        {fu.created_by_name && <span>Logged by: {fu.created_by_name}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: textMuted }}>
                  No follow-up calls logged yet.
                </div>
              )}
            </div>

            <div style={{
              padding: '0.9rem 1.4rem',
              borderTop: `1px solid ${borderColor}`,
              display: 'flex',
              justifyContent: 'flex-end',
              flexShrink: 0
            }}>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                style={{
                  background: isDarkMode ? '#ffffff' : '#0f172a',
                  color: isDarkMode ? '#0f172a' : '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  height: '36px',
                  padding: '0 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. FULL IMAGE PREVIEW MODAL ── */}
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
