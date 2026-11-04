import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import {
  AlertCircle,
  Clock,
  Trash2,
  Check,
  Download,
  Eye,
  FileText
} from 'lucide-react'
import api from '../../api'
import { useSettings } from '../../contexts/SettingsContext'
import { showConfirm, showError, showToast } from '../../utils/swal'
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
} from '../common/FormPrimitives'
import DynamicCustomFields from '../common/DynamicCustomFields'

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

export default function JobOrderModal({
  isOpen,
  onClose,
  editingJob = null,
  selectedPendingForCreation = null,
  onSuccess = null,
  existingJobs = [],
  currentUser = null,
  isAdmin = null
}) {
  const { formatCurrency } = useSettings()

  // User & role detection
  const resolvedUser = useMemo(() => {
    if (currentUser) return currentUser
    try { return JSON.parse(localStorage.getItem('user')) || {} }
    catch { return {} }
  }, [currentUser])

  const existingJobsRef = useRef(existingJobs)
  existingJobsRef.current = existingJobs

  const resolvedUserRef = useRef(resolvedUser)
  resolvedUserRef.current = resolvedUser

  const resolvedIsAdmin = isAdmin !== null
    ? isAdmin
    : Boolean(resolvedUser?.is_staff || resolvedUser?.is_superuser || resolvedUser?.role === 'admin' || resolvedUser?.role === 'Superadmin')

  // Contract ID Prefix & Number
  const [contractPrefix, setContractPrefix] = useState('JOB')
  const [contractNumber, setContractNumber] = useState('')

  // Form Data
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
    advance_amount: 0,
    payment_type: 'full',
    created_by_staff: '',
    payment_collected_by: '',
    assigned_to: '',
    custom_fields: {},
    attachment: '',
    attachment_name: '',
    attachment_type: ''
  })

  // Lookups & Options
  const [jobTitles, setJobTitles] = useState([])
  const [projectOptions, setProjectOptions] = useState([])
  const [staffOptions, setStaffOptions] = useState([])
  const [customers, setCustomers] = useState([])
  const [vendors, setVendors] = useState([])
  const [assignableAdmins, setAssignableAdmins] = useState([])
  const [descriptions, setDescriptions] = useState([''])

  // Status & Validation
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [customerPriorBalance, setCustomerPriorBalance] = useState(0)
  const [fetchingPriorBalance, setFetchingPriorBalance] = useState(false)

  // Quick Customer Creation Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', company_name: '', phone: '', email: '' })
  const [submittingCustomer, setSubmittingCustomer] = useState(false)

  // Attachment Preview Modal
  const [previewAttachment, setPreviewAttachment] = useState(null)

  // Fetch Lookups
  const fetchLookups = useCallback(async () => {
    try {
      const cRes = await api.get('customers/', { params: { nopage: 'true' } })
      const data = cRes.data
      setCustomers(Array.isArray(data) ? data : (data?.results || []))
    } catch (err) {
      console.error('Failed to fetch customers:', err)
    }

    try {
      const vRes = await api.get('vendors/', { params: { nopage: 'true' } })
      const data = vRes.data
      setVendors(Array.isArray(data) ? data : (data?.results || []))
    } catch (err) {
      console.error('Failed to fetch vendors:', err)
    }

    try {
      const tRes = await api.get('job-orders/titles/')
      setJobTitles(tRes.data || [])
    } catch (err) {
      console.error('Failed to fetch job titles:', err)
    }

    try {
      const sRes = await api.get('job-orders/staff-options/')
      setStaffOptions(sRes.data || [])
    } catch (err) {
      console.error('Failed to fetch staff options:', err)
    }

    try {
      const pRes = await api.get('project-plans/', { params: { nopage: 'true' } })
      const pData = pRes.data
      const plans = Array.isArray(pData) ? pData : (pData?.results || [])
      const uniqueProjects = Array.from(new Set(plans.map(p => p.project_name).filter(Boolean)))
      setProjectOptions(uniqueProjects)
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    }

    try {
      const aRes = await api.get('job-orders/assignable-admins/')
      setAssignableAdmins(aRes.data || [])
    } catch (err) {
      console.error('Failed to fetch assignable admins:', err)
    }
  }, [])

  // Fetch prior outstanding balance for a customer
  const fetchCustomerPriorBalance = async (customerId) => {
    if (!customerId) {
      setCustomerPriorBalance(0)
      return
    }
    try {
      setFetchingPriorBalance(true)
      const res = await api.get('job-orders/prior-balance/', { params: { customer: customerId } })
      setCustomerPriorBalance(parseFloat(res.data.prior_balance || 0))
    } catch (err) {
      console.error('Failed to fetch prior balance:', err)
      setCustomerPriorBalance(0)
    } finally {
      setFetchingPriorBalance(false)
    }
  }

  // Delete title suggestion
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

  // Custom option for Job Title creatable select with suggestion delete button
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
        <span style={{ flex: 1, fontWeight: isSelected ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.label}
        </span>
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

  // Populate form on open / edit
  useEffect(() => {
    if (!isOpen) return

    fetchLookups()

    if (editingJob) {
      const initialDescriptions = editingJob.description
        ? editingJob.description.split('\n').map(d => d.trim()).filter(Boolean)
        : ['']
      setDescriptions(initialDescriptions.length > 0 ? initialDescriptions : [''])

      // Parse existing order_id (e.g. JOB0012, #OCT12, 12)
      const rawOrderId = (editingJob.order_id || '').trim()
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
        order_id: editingJob.order_id || '',
        invoice_number: editingJob.invoice_number || '',
        quotation_number: editingJob.quotation_number || '',
        title: editingJob.title || '',
        description: editingJob.description || '',
        project_name: getLinkedProjectTitle(editingJob),
        customer: editingJob.customer || editingJob.customer_id || '',
        vendor: editingJob.vendor || editingJob.vendor_id || '',
        status: editingJob.status || 'Pending',
        total_amount: editingJob.total_amount || 0,
        advance_amount: editingJob.advance_amount || 0,
        payment_type: editingJob.payment_type || 'full',
        created_by_staff: editingJob.created_by_staff || editingJob.created_by_name || '',
        payment_collected_by: editingJob.payment_collected_by || '',
        assigned_to: editingJob.assigned_to || '',
        custom_fields: editingJob.custom_fields || {},
        attachment: editingJob.attachment || editingJob.custom_fields?.attachment || '',
        attachment_name: editingJob.attachment_name || editingJob.custom_fields?.attachment_name || '',
        attachment_type: editingJob.attachment_type || editingJob.custom_fields?.attachment_type || ''
      })
      setCustomerPriorBalance(parseFloat(editingJob.prior_balance || 0))
    } else if (selectedPendingForCreation) {
      const pending = selectedPendingForCreation
      let maxNum = 0
      ;(existingJobsRef.current || []).forEach(j => {
        const m = (j.order_id || '').match(/\d+/)
        if (m) {
          const val = parseInt(m[0], 10)
          if (!isNaN(val) && val > maxNum) maxNum = val
        }
      })
      const nextSeq = maxNum + 1
      setContractPrefix('JOB')
      setContractNumber(nextSeq.toString().padStart(4, '0'))

      const defaultCreator = `${resolvedUserRef.current?.first_name || ''} ${resolvedUserRef.current?.last_name || ''}`.trim() || resolvedUserRef.current?.username || ''
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
        created_by_staff: defaultCreator,
        payment_collected_by: '',
        assigned_to: '',
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
    } else {
      // Suggest next sequence number for JOB
      let maxNum = 0
      ;(existingJobsRef.current || []).forEach(j => {
        const m = (j.order_id || '').match(/\d+/)
        if (m) {
          const val = parseInt(m[0], 10)
          if (!isNaN(val) && val > maxNum) maxNum = val
        }
      })
      const nextSeq = maxNum + 1
      setContractPrefix('JOB')
      setContractNumber(nextSeq.toString().padStart(4, '0'))

      const defaultCreator = `${resolvedUserRef.current?.first_name || ''} ${resolvedUserRef.current?.last_name || ''}`.trim() || resolvedUserRef.current?.username || ''

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
      setDescriptions([''])
      setCustomerPriorBalance(0)
    }

    setFormError('')
    setSubmitting(false)
  }, [isOpen, editingJob, selectedPendingForCreation])

  // Scope of Work handlers
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

  // Attachment handlers
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

  // Quick Customer Creation
  const handleCustomerSubmit = async (e) => {
    e.preventDefault()
    if (!customerForm.name.trim()) return
    try {
      setSubmittingCustomer(true)
      const res = await api.post('customers/', customerForm)
      setCustomers(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)))
      setFormData(prev => ({ ...prev, customer: res.data.id }))
      setIsCustomerModalOpen(false)
      setCustomerForm({ name: '', company_name: '', phone: '', email: '' })
      showToast('Customer created', 'success')
    } catch (err) {
      console.error('Customer creation failed:', err)
      showError('Customer Error', 'Failed to create customer.')
    } finally {
      setSubmittingCustomer(false)
    }
  }

  // Cancel / Restore Actions for existing job order
  const handleCancelJob = async (job) => {
    const confirmed = await showConfirm({
      title: 'Cancel Job Order?',
      text: `Are you sure you want to cancel Job Order ${job.order_id || `#${job.id}`}? The job order number will be retained under Cancelled status and the receivable balance will be cleared.`,
      confirmButtonText: 'Yes, Cancel Job',
      isDangerous: true
    })
    if (!confirmed) return

    try {
      setSubmitting(true)
      const res = await api.post(`job-orders/${job.id}/cancel-job/`)
      showToast(`Job Order ${job.order_id || `#${job.id}`} has been cancelled.`, 'info')
      if (onSuccess) onSuccess(res.data || job, false)
      onClose()
    } catch (err) {
      console.error('Failed to cancel job order', err)
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || 'Failed to cancel job order.'
      showError('Cancellation Failed', errorMsg)
    } finally {
      setSubmitting(false)
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
      setSubmitting(true)
      const res = await api.post(`job-orders/${job.id}/restore-job/`)
      showToast(`Job Order ${job.order_id || `#${job.id}`} restored to active status.`, 'success')
      if (onSuccess) onSuccess(res.data || job, false)
      onClose()
    } catch (err) {
      console.error('Failed to restore job order', err)
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || 'Failed to restore job order.'
      showError('Restore Failed', errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Job Order
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

    // Client-side quick duplicate check
    const duplicate = existingJobs.find(j =>
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
        total_amount: parseFloat(formData.total_amount || 0),
        advance_amount: parseFloat(formData.advance_amount || 0),
        payment_type: formData.payment_type || 'full',
        assigned_to: formData.assigned_to ? formData.assigned_to : null,
        pending_job_order: selectedPendingForCreation?.id || null
      }
      if (payload.vendor === '') payload.vendor = null

      if (editingJob) {
        const response = await api.put(`job-orders/${editingJob.id}/`, payload)
        showToast('Job order updated successfully', 'success')
        if (onSuccess) onSuccess(response.data, false)
        onClose()
      } else {
        const response = await api.post('job-orders/', payload)
        showToast('Job order created successfully', 'success')
        if (onSuccess) onSuccess(response.data, true)
        onClose()
      }
    } catch (err) {
      console.error('Failed to save job order:', err)
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

  return (
    <>
      {/* ── MAIN JOB ORDER MODAL (Create & Edit) ── */}
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
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
                disabled={submitting}
              >
                Cancel Job Order
              </button>
            )}
            {editingJob && editingJob.status === 'Cancelled' && resolvedIsAdmin && (
              <button
                type="button"
                className="cred-modal-cancel-btn"
                style={{ marginRight: 'auto', color: 'var(--positive, #19B25B)', borderColor: 'var(--border, #E4E4E4)' }}
                onClick={() => handleRestoreJob(editingJob)}
                disabled={submitting}
              >
                Restore Job Order
              </button>
            )}
            <button
              type="button"
              className="cred-modal-cancel-btn"
              onClick={onClose}
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
                    label: (v.company_name || v.company) ? `${v.name} (${v.company_name || v.company})` : v.name,
                    value: v.id
                  }))}
                  value={formData.vendor ? {
                    label: (() => {
                      const v = vendors.find(x => String(x.id) === String(formData.vendor))
                      return v ? ((v.company_name || v.company) ? `${v.name} (${v.company_name || v.company})` : v.name) : ''
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
                  value={formData.created_by_staff || resolvedUser?.username || ''}
                  disabled
                  readOnly
                  style={{
                    backgroundColor: 'var(--fill-ghost-hover, #F4F4F4)',
                    color: 'var(--text-muted, #8C8C8C)'
                  }}
                />
              </Field>
            </div>

            {/* 7. Payment Collected By and Assign to Admin side by side */}
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

            <div>
              <Field
                label="Assign to Admin"
                tooltip="When accepted by this Admin, full ownership and all financial calculations/transactions will sit under their account."
              >
                <CredSelect
                  value={formData.assigned_to || ''}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                >
                  <option value="">No admin assigned</option>
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

            {/* 9. Contract ID (required) */}
            <div>
              <Field label="Contract ID" required>
                <TextInput
                  prefix={contractPrefix || 'JOB'}
                  value={contractNumber}
                  placeholder="0012"
                  onChange={(e) => {
                    const clean = e.target.value.replace(/^[A-Za-z]+/i, '').replace(/[^\d]/g, '')
                    setContractNumber(clean)
                  }}
                  required
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

            {/* 11. Attachment */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Attachment">
                <Dropzone
                  value={formData.attachment ? {
                    name: formData.attachment_name,
                    url: formData.attachment,
                    type: formData.attachment_type
                  } : null}
                  onUpload={handleAttachmentChange}
                  onRemove={handleRemoveAttachment}
                  placeholder="Click to upload a document or image"
                  hint="PDF, JPG, PNG up to 10MB"
                />
              </Field>
            </div>
          </div>
        </form>
      </ModalShell>

      {/* ── CREATE CUSTOMER MODAL ── */}
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

      {/* ── PREVIEW ATTACHMENT MODAL ── */}
      {previewAttachment && (
        <ModalShell
          isOpen={!!previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          title={`Attachment: ${previewAttachment.name}`}
          maxWidth="820px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
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
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              maxHeight: '68vh',
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
                  style={{ width: '100%', height: '65vh', border: 'none', borderRadius: '8px' }}
                  title={previewAttachment.name}
                />
              ) : (
                <img
                  src={previewAttachment.blobUrl || previewAttachment.dataUrl}
                  alt={previewAttachment.name}
                  style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '8px' }}
                />
              )}
            </div>
          </div>
        </ModalShell>
      )}
    </>
  )
}
