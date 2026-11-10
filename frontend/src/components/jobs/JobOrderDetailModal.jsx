import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Download, 
  Printer, 
  Edit3, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Building2, 
  User, 
  ShieldCheck, 
  FileText, 
  Receipt, 
  Coins, 
  Calendar, 
  ExternalLink,
  Eye,
  Paperclip,
  Clock,
  AlertCircle
} from 'lucide-react'
import api from '../../api'
import { showSuccess, showError, showToast } from '../../utils/swal'

export default function JobOrderDetailModal({
  isOpen,
  onClose,
  job,
  currentUser = null,
  onUpdateJob = null,
  onEditOrder = null,
  isDarkMode = false
}) {
  const [activeJob, setActiveJob] = useState(job)
  const [isEditingAmount, setIsEditingAmount] = useState(false)
  const [editedAmount, setEditedAmount] = useState('')
  const [isSavingAmount, setIsSavingAmount] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  
  // Lightbox / Multi-Image Gallery State
  const [activeLightboxIndex, setActiveLightboxIndex] = useState(null)

  useEffect(() => {
    setActiveJob(job)
    if (job) {
      setEditedAmount(job.total_amount != null ? String(job.total_amount) : '0')
    }
    setIsEditingAmount(false)
    setActiveLightboxIndex(null)
  }, [job])

  if (!isOpen || !activeJob) return null

  // Extract all attachments safely
  const allAttachments = (() => {
    if (Array.isArray(activeJob.attachments) && activeJob.attachments.length > 0) {
      return activeJob.attachments
    }
    const cf = (typeof activeJob.custom_fields === 'object' && activeJob.custom_fields) ? activeJob.custom_fields : {}
    if (Array.isArray(cf.attachments) && cf.attachments.length > 0) {
      return cf.attachments
    }
    if (activeJob.attachment || cf.attachment) {
      return [{
        name: activeJob.attachment_name || cf.attachment_name || 'Site Photo',
        url: activeJob.attachment || cf.attachment,
        type: activeJob.attachment_type || cf.attachment_type || 'image/jpeg'
      }]
    }
    return []
  })()

  // Filter image attachments
  const isImageAttachment = (att) => {
    if (!att || !att.url) return false
    const u = String(att.url).toLowerCase()
    const t = String(att.type || '').toLowerCase()
    const n = String(att.name || '').toLowerCase()
    return u.startsWith('data:image/') || t.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(n)
  }

  const imageAttachments = allAttachments.filter(isImageAttachment)

  // Check admin rights
  const isAdmin = Boolean(
    currentUser?.is_superuser || 
    currentUser?.role === 'Admin' || 
    currentUser?.user_permissions?.includes('admin') ||
    String(activeJob.assigned_to) === String(currentUser?.id)
  )

  // Handle in-place update of estimated amount
  const handleSaveEstimatedAmount = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const parsed = parseFloat(editedAmount)
    if (isNaN(parsed) || parsed < 0) {
      showError('Invalid Amount', 'Please enter a valid positive number or 0.')
      return
    }

    try {
      setIsSavingAmount(true)
      const res = await api.patch(`job-orders/${activeJob.id}/`, {
        total_amount: parsed
      })
      const updated = { ...activeJob, ...res.data, total_amount: parsed }
      setActiveJob(updated)
      setIsEditingAmount(false)
      if (onUpdateJob) onUpdateJob(updated)
      showToast('Estimated amount updated successfully', 'success')
    } catch (err) {
      console.error('Failed to update estimated amount:', err)
      showError('Update Failed', 'Failed to update estimated amount. Please try again.')
    } finally {
      setIsSavingAmount(false)
    }
  }

  // Handle server-side PDF download
  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true)
      const res = await api.get(`job-orders/${activeJob.id}/pdf/`, {
        responseType: 'blob'
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const orderRef = activeJob.order_id || `JOB${activeJob.id}`
      const clientName = activeJob.customer_name ? activeJob.customer_name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'client'
      link.download = `job_order_${orderRef}_${clientName}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download job order PDF:', err)
      showError('Download Failed', 'Could not generate official Job Order PDF.')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  // Handle direct print
  const handlePrint = async () => {
    try {
      setIsDownloadingPdf(true)
      const res = await api.get(`job-orders/${activeJob.id}/pdf/`, {
        responseType: 'blob'
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = url
      document.body.appendChild(iframe)
      iframe.onload = () => {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
      }
    } catch (err) {
      console.error('Print failed:', err)
      window.print()
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  // Financial calculations
  const totalVal = parseFloat(activeJob.total_amount || 0)
  const paidVal = parseFloat(activeJob.paid_amount || 0)
  const advVal = parseFloat(activeJob.advance_amount || 0)
  const balanceVal = Math.max(0, totalVal - paidVal)

  // Status Styling
  const getStatusBadge = (status) => {
    const s = (status || 'Pending').toLowerCase()
    if (s === 'completed') {
      return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', label: 'Completed' }
    }
    if (s === 'in progress') {
      return { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe', label: 'In Progress' }
    }
    if (s === 'cancelled') {
      return { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca', label: 'Cancelled' }
    }
    return { bg: '#fef3c7', text: '#b45309', border: '#fde68a', label: 'Pending' }
  }

  const stBadge = getStatusBadge(activeJob.status)

  // Format dates
  const formatDate = (val) => {
    if (!val) return '—'
    try {
      const d = new Date(val)
      if (isNaN(d.getTime())) return String(val)
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
    } catch {
      return String(val)
    }
  }

  const formatDateDDMMYYYY = (val) => {
    if (!val) return '08-11-2026'
    try {
      const d = new Date(val)
      if (isNaN(d.getTime())) return String(val)
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      return `${day}-${month}-${year}`
    } catch {
      return String(val)
    }
  }

  // Parse scope lines
  const scopeLines = (() => {
    const desc = activeJob.description || ''
    const lines = desc.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length > 0) return lines
    return [activeJob.title || 'General Job Contract']
  })()

  const modalContent = (
    <>
      <div 
        className="cred-modal-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(10, 10, 12, 0.78)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          overflowY: 'auto',
          padding: '16px 12px',
          boxSizing: 'border-box'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        {/* SAFE CENTERING WRAPPER */}
        <div 
          style={{ 
            margin: 'auto',
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            width: 'fit-content',
            maxWidth: '96vw',
            flexShrink: 0
          }}
        >
        {/* TOP FLOATING ACTION BAR - System New Design Language (Pill, CRED Style) */}
        <div 
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            background: isDarkMode ? '#18181b' : '#ffffff',
            border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e2e8f0',
            borderRadius: '9999px',
            padding: '6px 14px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            boxSizing: 'border-box',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: isDarkMode ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap' }}>
              Job Order #{activeJob.order_id || `JOB${activeJob.id}`}
            </span>
            <span 
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: stBadge.bg,
                color: stBadge.text,
                border: `1px solid ${stBadge.border}`,
                whiteSpace: 'nowrap'
              }}
            >
              {stBadge.label}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* Download PDF Button - Solid Black Pill (Primary CRED action) */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '32px',
                padding: '0 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '9999px',
                border: isDarkMode ? 'none' : '1px solid rgba(255,255,255,0.1)',
                backgroundColor: isDarkMode ? '#ffffff' : '#0A0A0A',
                color: isDarkMode ? '#0A0A0A' : '#ffffff',
                cursor: isDownloadingPdf ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                whiteSpace: 'nowrap'
              }}
              title="Download Official Job Order PDF"
            >
              <Download size={13} strokeWidth={2.2} />
              <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
            </button>

            {/* Print Button - Outline Pill (Secondary CRED action) */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={isDownloadingPdf}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '32px',
                padding: '0 13px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '9999px',
                border: isDarkMode ? '1px solid rgba(255,255,255,0.14)' : '1px solid #e2e8f0',
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#0A0A0A',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
              title="Print Job Order"
            >
              <Printer size={13} strokeWidth={2} />
              <span>Print</span>
            </button>

            {/* Edit Full Order Button - Outline Pill (Secondary CRED action) */}
            {onEditOrder && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onEditOrder(activeJob)
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '32px',
                  padding: '0 13px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '9999px',
                  border: isDarkMode ? '1px solid rgba(255,255,255,0.14)' : '1px solid #e2e8f0',
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#ffffff',
                  color: isDarkMode ? '#ffffff' : '#0A0A0A',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
                title="Edit complete job order fields"
              >
                <Edit3 size={13} strokeWidth={2} />
                <span>Edit</span>
              </button>
            )}

            {/* Close Button - Circular Pill */}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '9999px',
                border: isDarkMode ? '1px solid rgba(255,255,255,0.14)' : '1px solid #e2e8f0',
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#0A0A0A',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                marginLeft: '2px'
              }}
              aria-label="Close"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* ── REALISTIC A4 PDF DOCUMENT SHEET (DAILY JOB LOG) ── */}
        <div 
          className="job-order-pdf-page"
          style={{
            height: 'min(calc(94vh - 58px), 820px)',
            width: 'calc(min(calc(94vh - 58px), 820px) * 0.7071)',
            aspectRatio: '210 / 297',
            maxWidth: '96vw',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            borderRadius: '4px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08)',
            padding: '22px 26px 16px',
            boxSizing: 'border-box',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          {/* Subtle floral watermark in center of page matching reference */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.045,
            pointerEvents: 'none',
            zIndex: 0
          }}>
            <img src="/logo_black.png" alt="" style={{ width: '220px', height: '220px', objectFit: 'contain' }} />
          </div>

          {/* 1. DOCUMENT HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', position: 'relative', zIndex: 1, flexShrink: 0 }}>
            {/* Left: Logo & Customer / Status */}
            <div>
              <div style={{ marginBottom: '4px' }}>
                <img src="/logo_colored_wordmark.png" alt="Arab Season" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                Client Name : <span style={{ fontWeight: 800, textTransform: 'uppercase' }}>{activeJob.customer_name || 'CLIENT'}</span>
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginTop: '1px' }}>
                Status : <span style={{ fontWeight: 600 }}>{activeJob.status || 'Pending'}</span>
              </div>
              {(activeJob.salesperson_name || activeJob.salesperson_detail?.name) && (
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginTop: '1px' }}>
                  Salesperson : <span style={{ fontWeight: 600 }}>{activeJob.salesperson_name || activeJob.salesperson_detail?.name}</span>
                </div>
              )}
            </div>

            {/* Right: JOB LOG, Date, Order ID */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#1E3A8A', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                JOB LOG
              </div>
              <div style={{ marginTop: '3px', fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>
                Date : <span>{formatDateDDMMYYYY(activeJob.created_at)}</span>
              </div>
              <div style={{ marginTop: '1px', fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>
                Job Order No : <span style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>{activeJob.order_id || `JOB${activeJob.id}`}</span>
              </div>
              {(activeJob.created_by_staff || activeJob.created_by_name) && (
                <div style={{ marginTop: '1px', fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>
                  Created By : <span style={{ fontWeight: 600 }}>{activeJob.created_by_staff || activeJob.created_by_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. MAIN 2-COLUMN TABLE (DESCRIPTION & REMARK) */}
          <div 
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              border: '1px solid #7F8080',
              borderRadius: '10px',
              overflow: 'hidden',
              position: 'relative',
              zIndex: 1,
              backgroundColor: '#ffffff'
            }}
          >
            {/* Header Row */}
            <div style={{ display: 'flex', borderBottom: '1px solid #475569', backgroundColor: '#ffffff', flexShrink: 0 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '5px 8px', fontSize: '10px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.04em', borderRight: '1px solid #475569' }}>
                DESCRIPTION
              </div>
              <div style={{ width: '130px', textAlign: 'center', padding: '5px 8px', fontSize: '10px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.04em' }}>
                REMARK
              </div>
            </div>

            {/* Body Row */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* Left Column (DESCRIPTION) */}
              <div style={{ flex: 1, padding: '12px 14px', borderRight: '1px solid #475569', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                {/* Title */}
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '3px' }}>
                  {activeJob.title || 'GENERAL CONTRACT WORK'}
                </div>

                {/* Optional description lines */}
                {activeJob.description && activeJob.description.trim() && activeJob.description.trim() !== activeJob.title && (
                  <div style={{ fontSize: '9.5px', color: '#475569', marginBottom: '8px', whiteSpace: 'pre-line', lineHeight: '1.35' }}>
                    {activeJob.description.trim()}
                  </div>
                )}

                {/* 3-Column Image Grid */}
                {allAttachments.length > 0 ? (
                  <div 
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '4px 6px',
                      marginTop: '3px'
                    }}
                  >
                    {allAttachments.map((att, idx) => {
                      const isImg = isImageAttachment(att)
                      const rawName = att.name || `ITEM-${idx + 1}`
                      const cleanCaption = rawName.replace(/\.[a-zA-Z0-9]+$/, '').toUpperCase()

                      return (
                        <div 
                          key={idx}
                          onClick={() => {
                            if (isImg) {
                              const imgIdx = imageAttachments.findIndex(i => i.url === att.url)
                              setActiveLightboxIndex(imgIdx >= 0 ? imgIdx : 0)
                            } else {
                              window.open(att.url, '_blank')
                            }
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'transform 0.12s ease'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                        >
                          <div 
                            style={{
                              width: '100%',
                              height: '62px',
                              backgroundColor: '#ffffff',
                              borderRadius: '3px',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid #cbd5e1',
                              boxSizing: 'border-box',
                              position: 'relative'
                            }}
                          >
                            {isImg ? (
                              <>
                                <img 
                                  src={att.url} 
                                  alt={cleanCaption}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    if (e.currentTarget.nextElementSibling) {
                                      e.currentTarget.nextElementSibling.style.display = 'flex';
                                    }
                                  }}
                                  style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#ffffff' }}
                                />
                                <div 
                                  style={{ 
                                    display: 'none', 
                                    flexDirection: 'column', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    gap: '2px', 
                                    color: '#475569', 
                                    width: '100%', 
                                    height: '100%', 
                                    backgroundColor: '#f8fafc' 
                                  }}
                                >
                                  <FileText size={18} style={{ color: '#0F7638' }} />
                                  <span style={{ fontSize: '7.5px', fontWeight: 800, color: '#334155' }}>
                                    {(rawName.split('.').pop() || 'FILE').toUpperCase()}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: '#2563eb', backgroundColor: '#eff6ff', width: '100%', height: '100%', justifyContent: 'center' }}>
                                <FileText size={20} />
                                <span style={{ fontSize: '8px', fontWeight: 700 }}>DOCUMENT</span>
                              </div>
                            )}
                          </div>
                          <div style={{ marginTop: '3px', fontSize: '8px', fontWeight: 800, color: '#0f172a', textAlign: 'center', wordBreak: 'break-word', lineHeight: '1.15' }}>
                            {cleanCaption}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
                    No site images attached.
                  </div>
                )}
              </div>

              {/* Right Column (REMARK + Bottom 3 Financial Boxes) */}
              <div style={{ width: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff' }}>
                {/* Remarks Area */}
                <div style={{ padding: '6px', flex: 1, fontSize: '9.5px', color: '#64748b' }}>
                  {/* Space for notes / comments */}
                </div>

                {/* 3-Row Financial Box at Bottom */}
                <div style={{ borderTop: '1px solid #475569', flexShrink: 0 }}>
                  {/* Box 1: Total Amount with Admin In-Place Editing */}
                  <div style={{ borderBottom: '1px solid #475569', padding: '4px 8px', minHeight: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '9px', fontWeight: 800, color: '#0f172a' }}>Total Amount</span>
                      {isAdmin && !isEditingAmount && (
                        <button
                          type="button"
                          onClick={() => setIsEditingAmount(true)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: '#F4F4F4',
                            border: '1px solid #E4E4E4',
                            color: '#0A0A0A',
                            borderRadius: '9999px',
                            padding: '1px 7px',
                            fontSize: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          title="Edit Total Amount"
                        >
                          <Edit3 size={8} />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                    {isEditingAmount ? (
                      <form onSubmit={handleSaveEstimatedAmount} style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editedAmount}
                          onChange={(e) => setEditedAmount(e.target.value)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '2px 4px',
                            fontSize: '9px',
                            fontWeight: 700,
                            borderRadius: '4px',
                            border: '1px solid #0A0A0A',
                            outline: 'none'
                          }}
                        />
                        <button
                          type="submit"
                          disabled={isSavingAmount}
                          style={{
                            backgroundColor: '#0A0A0A',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '9999px',
                            padding: '2px 6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Check size={8} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingAmount(false)
                            setEditedAmount(activeJob.total_amount != null ? String(activeJob.total_amount) : '0')
                          }}
                          style={{
                            backgroundColor: '#F4F4F4',
                            color: '#0A0A0A',
                            border: '1px solid #E4E4E4',
                            borderRadius: '9999px',
                            padding: '2px 6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <X size={8} />
                        </button>
                      </form>
                    ) : (
                      totalVal > 0 && (
                        <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#0f172a', marginTop: '1px' }}>
                          SAR {totalVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )
                    )}
                  </div>

                  {/* Box 2: Amount Update */}
                  <div style={{ borderBottom: '1px solid #475569', padding: '4px 8px', minHeight: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#0f172a' }}>Amount Update</div>
                    {paidVal > 0 && (
                      <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#0f172a', marginTop: '1px' }}>
                        SAR {paidVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>

                  {/* Box 3: Balance Amount */}
                  <div style={{ padding: '4px 8px', minHeight: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#0f172a' }}>Balance Amount</div>
                    {balanceVal > 0 && (
                      <div style={{ fontSize: '10.5px', fontWeight: 800, color: balanceVal > 0.01 ? '#dc2626' : '#16a34a', marginTop: '1px' }}>
                        SAR {balanceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. FOOTER */}
          <div style={{ marginTop: '8px', textAlign: 'center', position: 'relative', zIndex: 1, flexShrink: 0 }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <span>057 078 7710 / 057 528 7403</span>
              <span>ad@arabseason.net</span>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* ── FULL-SCREEN LIGHTBOX GALLERY MODAL ── */}
      {activeLightboxIndex !== null && imageAttachments[activeLightboxIndex] && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.94)',
            zIndex: 1000000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(10px)',
            padding: '20px'
          }}
          onClick={() => setActiveLightboxIndex(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' && activeLightboxIndex < imageAttachments.length - 1) {
              setActiveLightboxIndex(activeLightboxIndex + 1)
            } else if (e.key === 'ArrowLeft' && activeLightboxIndex > 0) {
              setActiveLightboxIndex(activeLightboxIndex - 1)
            } else if (e.key === 'Escape') {
              setActiveLightboxIndex(null)
            }
          }}
          tabIndex={0}
        >
          {/* Top Bar */}
          <div 
            style={{
              position: 'absolute',
              top: '20px',
              left: '24px',
              right: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#ffffff'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '14px', fontWeight: 700 }}>
              Photo {activeLightboxIndex + 1} of {imageAttachments.length} • {imageAttachments[activeLightboxIndex].name}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <a
                href={imageAttachments[activeLightboxIndex].url}
                download={imageAttachments[activeLightboxIndex].name || 'photo.jpg'}
                style={{
                  color: '#ffffff',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none'
                }}
              >
                <Download size={14} />
                <span>Download</span>
              </a>

              <button
                type="button"
                onClick={() => setActiveLightboxIndex(null)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: '#ffffff',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Active Image */}
          <div 
            style={{
              maxWidth: '90vw',
              maxHeight: '75vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={imageAttachments[activeLightboxIndex].url}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextElementSibling) {
                  e.currentTarget.nextElementSibling.style.display = 'flex';
                }
              }}
              style={{
                maxWidth: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }}
            />
            <div 
              style={{ 
                display: 'none', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '12px', 
                color: '#ffffff', 
                padding: '40px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '12px'
              }}
            >
              <FileText size={48} />
              <div style={{ fontSize: '15px', fontWeight: 600 }}>Preview not supported in browser</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Please download the file using the button above to view it.</div>
            </div>
          </div>

          {/* Prev / Next Controls */}
          {imageAttachments.length > 1 && (
            <>
              {activeLightboxIndex > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveLightboxIndex(activeLightboxIndex - 1)
                  }}
                  style={{
                    position: 'absolute',
                    left: '24px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <ChevronLeft size={28} />
                </button>
              )}

              {activeLightboxIndex < imageAttachments.length - 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveLightboxIndex(activeLightboxIndex + 1)
                  }}
                  style={{
                    position: 'absolute',
                    right: '24px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <ChevronRight size={28} />
                </button>
              )}
            </>
          )}

          {/* Bottom Thumbnail Strip */}
          {imageAttachments.length > 1 && (
            <div 
              style={{
                position: 'absolute',
                bottom: '20px',
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                maxWidth: '80vw',
                padding: '6px 12px',
                backgroundColor: 'rgba(0,0,0,0.6)',
                borderRadius: '12px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {imageAttachments.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveLightboxIndex(idx)}
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: idx === activeLightboxIndex ? '2px solid #22c55e' : '2px solid transparent',
                    opacity: idx === activeLightboxIndex ? 1 : 0.6
                  }}
                >
                  <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}
