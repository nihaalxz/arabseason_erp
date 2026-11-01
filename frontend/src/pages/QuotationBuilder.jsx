import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  X, Plus, Trash2, Search, Settings, AlertCircle, Check,
  Paperclip, ChevronDown, GripVertical, Upload, Info
} from 'lucide-react'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import {
  ModalShell,
  Field,
  TextInput,
  Textarea
} from '../components/common/FormPrimitives'
import { useSettings } from '../contexts/SettingsContext'
import { showError, showToast, showSuccess, showConfirm } from '../utils/swal'
import { handlePdfResponse } from '../utils/pdfDownload'

const DEFAULT_QUOTATION_TERMS = `1. Production will begin after approval of cost and receipt of PO from the client.
2. The above cost is as per the project brief provided; any changes in artwork and specification will be charged additionally.
3. All artwork and approvals are to be provided by the client before starting production. Any delay in providing approvals will delay the project accordingly.
4. This quotation is valid for 30 days from the date of issue.
5. Any cancellation of projects after receiving PO will be charged at 80% of the total PO value.
6. Expenses relating to the requirements of the venue and organizer, including insurance, electricity, rigs, etc., are not included unless specifically mentioned in the quotation.
7. All disputes are subject to KSA jurisdiction.
8. Payment Terms 80% payment is required in advance before starting production, and the remaining 20% must be settled before installation.`

const UNIT_OPTIONS = ['Unit', 'Pcs', 'Hours', 'Days', 'Lot', 'Sq. M', 'Kg', 'Service', 'm', 'Roll', 'Box']
const DEFAULT_ITEM = { description: '', material: '', quantity: 1, unit: 'Unit', unit_price: 0, discount_rate: 0, tax_rate: 15, tax_amount: 0, total: 0 }

const formatTabular = (num) => {
  const val = parseFloat(num) || 0
  const parts = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {parts[0]}<span style={{ opacity: 0.55, fontSize: '0.85em' }}>.{parts[1]}</span>
    </span>
  )
}

const QuotationBuilder = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const basePath = '/accounting'
  const isEditing = Boolean(id)
  const { settings } = useSettings()
  const currency = settings?.currency || 'SAR'

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [formError, setFormError] = useState('')

  // Lookups
  const [customers, setCustomers] = useState([])
  const [jobOrders, setJobOrders] = useState([])
  const [materials, setMaterials] = useState([])
  const [staffOptions, setStaffOptions] = useState([])

  // Customer dropdown state
  const [customerSearch, setCustomerSearch] = useState('')
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)
  const customerDropdownRef = useRef(null)

  // Quick Customer Creation Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', company_name: '', phone: '', email: '', address: '' })
  const [submittingCustomer, setSubmittingCustomer] = useState(false)

  // Bulk Materials Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [bulkSearch, setBulkSearch] = useState('')
  const [selectedBulkItems, setSelectedBulkItems] = useState({}) // { [matId]: quantity }

  // Drag-and-drop row reorder state
  const [draggedIdx, setDraggedIdx] = useState(null)

  // Attachments state
  const [attachments, setAttachments] = useState([])
  const [fileError, setFileError] = useState('')
  const fileInputRef = useRef(null)

  // Terms textarea ref for auto-grow
  const termsTextareaRef = useRef(null)

  // Main Form State
  const [form, setForm] = useState({
    quotation_number: '',
    customer: '',
    customer_tax_number: '',
    billing_address: '',
    job_order: '', // Project Name (supported by backend)
    quotation_date: new Date().toISOString().split('T')[0],
    valid_until: '',
    payment_terms: 'Due on Receipt',
    status: 'Draft',
    reference_number: '',
    bank_account: '',
    discount_amount: 0,
    salesperson: '', // New Zoho field (UI only)
    subject: '', // New Zoho field (UI only)
    notes: 'Thank you for giving us the opportunity to quote. Please feel free to reach out with any questions.',
    terms_conditions: DEFAULT_QUOTATION_TERMS,
    items: [{ ...DEFAULT_ITEM }],
    custom_fields: {}
  })

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setIsCustomerDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Auto-grow terms textarea on mount or text change
  useEffect(() => {
    if (termsTextareaRef.current) {
      termsTextareaRef.current.style.height = 'auto'
      termsTextareaRef.current.style.height = `${Math.max(180, termsTextareaRef.current.scrollHeight)}px`
    }
  }, [form.terms_conditions])

  const fetchNextQuotationNumber = async () => {
    try {
      const res = await api.get('quotations/next-number/')
      return res.data?.next_number || `QT-${new Date().getFullYear()}-0001`
    } catch {
      return `QT-${new Date().getFullYear()}-0001`
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const toArr = (d) => Array.isArray(d) ? d : (d?.results || [])
      const [cRes, jRes, mRes, sRes] = await Promise.all([
        api.get('customers/?page_size=1000').catch(() => ({ data: [] })),
        api.get('job-orders/?page_size=1000&lookup=true').catch(() => ({ data: [] })),
        api.get('materials/').catch(() => ({ data: [] })),
        api.get('job-orders/staff-options/').catch(() => ({ data: [] }))
      ])

      const custList = toArr(cRes.data)
      const jobList = toArr(jRes.data)
      const matList = toArr(mRes.data)
      const staffList = Array.isArray(sRes.data) ? sRes.data : []

      setCustomers(custList)
      setJobOrders(jobList)
      setMaterials(matList)
      setStaffOptions(staffList)

      if (isEditing) {
        const { data: q } = await api.get(`quotations/${id}/`)
        const formattedItems = (q.items && q.items.length > 0)
          ? q.items.map(it => ({
              id: it.id,
              material: it.material || '',
              description: it.description || '',
              quantity: parseFloat(it.quantity) || 1,
              unit: it.unit || 'Unit',
              unit_price: parseFloat(it.unit_price) || 0,
              discount_rate: parseFloat(it.discount_rate) || 0,
              tax_rate: parseFloat(it.tax_rate) !== undefined ? parseFloat(it.tax_rate) : 15,
              tax_amount: parseFloat(it.tax_amount) || 0,
              total: parseFloat(it.total) || 0
            }))
          : [{ ...DEFAULT_ITEM, unit_price: parseFloat(q.subtotal) || 0, total: parseFloat(q.total_amount) || 0 }]

        setForm({
          quotation_number: q.quotation_number,
          customer: q.customer,
          customer_tax_number: q.customer_tax_number || '',
          billing_address: q.billing_address || '',
          job_order: q.job_order || '',
          quotation_date: q.quotation_date || '',
          valid_until: q.valid_until || '',
          payment_terms: q.payment_terms || 'Due on Receipt',
          status: q.status || 'Draft',
          reference_number: q.reference_number || '',
          bank_account: q.bank_account || '',
          discount_amount: parseFloat(q.discount_amount) || 0,
          salesperson: q.created_by_staff || '',
          subject: '',
          notes: q.notes || 'Thank you for giving us the opportunity to quote. Please feel free to reach out with any questions.',
          terms_conditions: q.terms_conditions || DEFAULT_QUOTATION_TERMS,
          items: formattedItems,
          custom_fields: q.custom_fields || {}
        })
      } else {
        const nextNum = await fetchNextQuotationNumber()
        const today = new Date().toISOString().split('T')[0]
        const validDate = new Date()
        validDate.setDate(validDate.getDate() + 30)

        setForm(prev => ({
          ...prev,
          quotation_number: nextNum,
          bank_account: '',
          payment_terms: 'Due on Receipt',
          status: 'Draft',
          quotation_date: today,
          valid_until: validDate.toISOString().split('T')[0]
        }))
      }
    } catch (err) {
      console.error('Failed to load quotation builder data:', err)
      showError('Load Error', 'Failed to initialize quotation builder.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return customers.find(c => String(c.id) === String(form.customer))
  }, [customers, form.customer])

  // Filtered customer list for dropdown
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers
    const q = customerSearch.toLowerCase()
    return customers.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.company_name && c.company_name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    )
  }, [customers, customerSearch])

  // Projects associated with selected customer
  const customerProjects = useMemo(() => {
    if (!form.customer) return []
    return jobOrders.filter(j =>
      String(j.customer) === String(form.customer) ||
      String(j.customer_id) === String(form.customer) ||
      String(j.client) === String(form.customer) ||
      String(j.client_id) === String(form.customer)
    )
  }, [jobOrders, form.customer])

  // Handle customer selection
  const handleSelectCustomer = (c) => {
    setForm(prev => ({
      ...prev,
      customer: c.id,
      customer_tax_number: c.tax_number || '',
      billing_address: c.address || '',
      job_order: '' // Reset project when customer changes
    }))
    setIsCustomerDropdownOpen(false)
    setCustomerSearch('')
    setIsDirty(true)
  }

  // Recalculate Line Item
  const handleItemChange = (index, field, value) => {
    setForm(prev => {
      const items = [...prev.items]
      const current = { ...items[index], [field]: value }

      const qty = parseFloat(current.quantity) || 0
      const price = parseFloat(current.unit_price) || 0
      const disc = parseFloat(current.discount_rate) || 0
      const vatRate = parseFloat(current.tax_rate) !== undefined ? parseFloat(current.tax_rate) : 15

      const base = qty * price
      const discAmt = base * (disc / 100)
      const taxable = Math.max(0, base - discAmt)
      const vatAmt = taxable * (vatRate / 100)
      const tot = taxable + vatAmt

      current.tax_amount = Number(vatAmt.toFixed(2))
      current.total = Number(tot.toFixed(2))
      items[index] = current
      return { ...prev, items }
    })
    setIsDirty(true)
  }

  // Pick from price chart
  const handleSelectMaterialForItem = (idx, materialId) => {
    if (!materialId) {
      handleItemChange(idx, 'material', '')
      return
    }
    const mat = materials.find(m => String(m.id) === String(materialId))
    if (!mat) return

    setForm(prev => {
      const items = [...prev.items]
      const itm = { ...items[idx] }
      itm.material = mat.id
      itm.description = mat.name + (mat.measurements ? ` (${mat.measurements})` : '')

      if (mat.unit) {
        const matched = UNIT_OPTIONS.find(u => u.toLowerCase() === mat.unit.toLowerCase())
        itm.unit = matched || mat.unit
      }

      itm.unit_price = parseFloat(mat.customer_price) || parseFloat(mat.unit_price) || 0

      const qty = parseFloat(itm.quantity) || 1
      const price = parseFloat(itm.unit_price) || 0
      const disc = parseFloat(itm.discount_rate) || 0
      const tax = parseFloat(itm.tax_rate) !== undefined ? parseFloat(itm.tax_rate) : 15

      const base = qty * price
      const discAmt = base * (disc / 100)
      const taxable = Math.max(0, base - discAmt)
      itm.tax_amount = Number((taxable * tax / 100).toFixed(2))
      itm.total = Number((taxable + itm.tax_amount).toFixed(2))

      items[idx] = itm
      return { ...prev, items }
    })
    setIsDirty(true)
  }

  const handleAddItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { ...DEFAULT_ITEM }]
    }))
    setIsDirty(true)
  }

  const handleRemoveItem = (index) => {
    if (form.items.length <= 1) {
      showToast('A quotation must have at least one line item', 'warning')
      return
    }
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
    setIsDirty(true)
  }

  // Drag and drop reordering
  const handleDragStart = (e, index) => {
    setDraggedIdx(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, targetIndex) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === targetIndex) return
    setForm(prev => {
      const items = [...prev.items]
      const [moved] = items.splice(draggedIdx, 1)
      items.splice(targetIndex, 0, moved)
      return { ...prev, items }
    })
    setIsDirty(true)
    setDraggedIdx(null)
  }

  // Bulk Materials Selection
  const handleToggleBulkMaterial = (matId) => {
    setSelectedBulkItems(prev => {
      const next = { ...prev }
      if (next[matId] !== undefined) {
        delete next[matId]
      } else {
        next[matId] = 1
      }
      return next
    })
  }

  const handleBulkQtyChange = (matId, qty) => {
    const val = Math.max(0.01, parseFloat(qty) || 1)
    setSelectedBulkItems(prev => ({
      ...prev,
      [matId]: val
    }))
  }

  const handleAddBulkItemsToTable = () => {
    const selectedIds = Object.keys(selectedBulkItems)
    if (selectedIds.length === 0) {
      setIsBulkModalOpen(false)
      return
    }

    const newRows = selectedIds.map(matId => {
      const mat = materials.find(m => String(m.id) === String(matId))
      if (!mat) return null
      const qty = selectedBulkItems[matId] || 1
      const price = parseFloat(mat.customer_price) || parseFloat(mat.unit_price) || 0
      const matchedUnit = mat.unit ? (UNIT_OPTIONS.find(u => u.toLowerCase() === mat.unit.toLowerCase()) || mat.unit) : 'Unit'
      const base = qty * price
      const vatAmt = Number((base * 0.15).toFixed(2))
      const tot = Number((base + vatAmt).toFixed(2))

      return {
        material: mat.id,
        description: mat.name + (mat.measurements ? ` (${mat.measurements})` : ''),
        quantity: qty,
        unit: matchedUnit,
        unit_price: price,
        discount_rate: 0,
        tax_rate: 15,
        tax_amount: vatAmt,
        total: tot
      }
    }).filter(Boolean)

    setForm(prev => {
      const hasEmptyFirstRow = prev.items.length === 1 && !prev.items[0].description.trim() && prev.items[0].unit_price === 0
      const baseItems = hasEmptyFirstRow ? [] : prev.items
      return {
        ...prev,
        items: [...baseItems, ...newRows]
      }
    })

    setSelectedBulkItems({})
    setBulkSearch('')
    setIsBulkModalOpen(false)
    setIsDirty(true)
    showToast(`Added ${newRows.length} items to table`, 'success')
  }

  const filteredBulkMaterials = useMemo(() => {
    if (!bulkSearch.trim()) return materials
    const q = bulkSearch.toLowerCase()
    return materials.filter(m =>
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.measurements && m.measurements.toLowerCase().includes(q)) ||
      (m.category_name && m.category_name.toLowerCase().includes(q))
    )
  }, [materials, bulkSearch])

  // File Upload handling
  const handleFileUpload = (e) => {
    setFileError('')
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    if (attachments.length + files.length > 5) {
      setFileError('You can upload a maximum of 5 files.')
      return
    }

    const invalidSize = files.find(f => f.size > 10 * 1024 * 1024)
    if (invalidSize) {
      setFileError(`File "${invalidSize.name}" exceeds the 10MB limit.`)
      return
    }

    setAttachments(prev => [...prev, ...files])
    setIsDirty(true)
    e.target.value = ''
  }

  const handleRemoveAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
    setIsDirty(true)
  }

  // Summary calculations
  const summary = useMemo(() => {
    let subtotal = 0
    let taxTotal = 0

    form.items.forEach(it => {
      const qty = parseFloat(it.quantity) || 0
      const price = parseFloat(it.unit_price) || 0
      const disc = parseFloat(it.discount_rate) || 0
      const vatRate = parseFloat(it.tax_rate) !== undefined ? parseFloat(it.tax_rate) : 15

      const base = qty * price
      const discAmt = base * (disc / 100)
      const taxable = Math.max(0, base - discAmt)
      const vatAmt = taxable * (vatRate / 100)

      subtotal += taxable
      taxTotal += vatAmt
    })

    const overallDiscount = parseFloat(form.discount_amount) || 0
    const finalSubtotal = Math.max(0, subtotal - overallDiscount)
    const effectiveVat = subtotal > 0 ? (taxTotal * (finalSubtotal / subtotal)) : 0
    const grandTotal = finalSubtotal + effectiveVat

    return {
      subtotal: Number(subtotal.toFixed(2)),
      overallDiscount,
      taxTotal: Number(effectiveVat.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2))
    }
  }, [form.items, form.discount_amount])

  // Quick Customer Creation
  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    if (!newCustomerForm.name.trim()) return
    try {
      setSubmittingCustomer(true)
      const res = await api.post('customers/', newCustomerForm)
      const created = res.data
      setCustomers(prev => [created, ...prev])
      setForm(prev => ({
        ...prev,
        customer: created.id,
        billing_address: created.address || '',
        customer_tax_number: created.tax_number || ''
      }))
      setIsCustomerModalOpen(false)
      setNewCustomerForm({ name: '', company_name: '', phone: '', email: '', address: '' })
      setIsDirty(true)
      showToast('Customer created and selected', 'success')
    } catch (err) {
      console.error('Customer create error:', err)
      showError('Failed', 'Could not create customer.')
    } finally {
      setSubmittingCustomer(false)
    }
  }

  // Close handler with confirmation
  const handleClose = async () => {
    if (isDirty) {
      const confirmed = await showConfirm(
        'Discard unsaved changes?',
        'You have unsaved changes that will be lost. Are you sure you want to leave?'
      )
      if (!confirmed) return
    }
    navigate(`${basePath}/quotations`)
  }

  // Save Quotation
  const handleSubmit = async (targetStatus) => {
    setFormError('')
    if (!form.customer) {
      setFormError('Please select a customer.')
      showToast('Customer is required', 'warning')
      return
    }
    if (!form.quotation_number.trim()) {
      setFormError('Quotation Number is required.')
      return
    }

    // Prepare payload (Persistence Rule: salesperson, subject, attachments are UI-only and stripped)
    const payload = {
      quotation_number: form.quotation_number.trim(),
      customer: form.customer,
      customer_tax_number: form.customer_tax_number || '',
      billing_address: form.billing_address || '',
      job_order: form.job_order || null, // Project Name (supported by backend)
      quotation_date: form.quotation_date,
      valid_until: form.valid_until || null,
      payment_terms: form.payment_terms || 'Due on Receipt',
      status: targetStatus || form.status,
      reference_number: form.reference_number || '',
      bank_account: form.bank_account || null,
      notes: form.notes || '',
      terms_conditions: form.terms_conditions || '',
      subtotal: summary.subtotal,
      tax_amount: summary.taxTotal,
      total_amount: summary.grandTotal,
      discount_amount: summary.overallDiscount,
      items: form.items.map((it, idx) => ({
        id: it.id,
        description: it.description || 'Quotation item',
        quantity: parseFloat(it.quantity) || 1,
        unit: it.unit || 'Unit',
        unit_price: parseFloat(it.unit_price) || 0,
        discount_rate: parseFloat(it.discount_rate) || 0,
        tax_rate: parseFloat(it.tax_rate) !== undefined ? parseFloat(it.tax_rate) : 15,
        tax_amount: parseFloat(it.tax_amount) || 0,
        total: parseFloat(it.total) || 0,
        sort_order: idx
      }))
    }

    try {
      setSubmitting(true)
      if (isEditing) {
        await api.put(`quotations/${id}/`, payload)
        setIsDirty(false)
        showSuccess('Saved!', `Quotation ${form.quotation_number} updated successfully.`)
        navigate(`${basePath}/quotations`)
      } else {
        const res = await api.post('quotations/', payload)
        setIsDirty(false)
        showSuccess('Created!', `Quotation ${form.quotation_number} created successfully.`)
        navigate(`${basePath}/quotations/${res.data.id}/edit`, { replace: true })
      }
    } catch (err) {
      console.error('Submit error:', err)
      const msg = err.response?.data?.quotation_number?.[0] || err.response?.data?.detail || 'Failed to save quotation.'
      setFormError(msg)
      showError('Error Saving', msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 20px' }}>
        <SkeletonLoader count={6} />
      </div>
    )
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: 'var(--card-bg, #ffffff)',
      color: 'var(--text, #111111)',
      fontFamily: 'inherit',
      boxSizing: 'border-box'
    }}>
      {/* Outer Shell */}
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '24px 24px 100px',
        boxSizing: 'border-box'
      }}>

        {/* ── HEADER (Title + Plain X Close Icon) ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border, #E4E4E4)',
          marginBottom: '28px'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: '19px',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--text, #111111)'
          }}>
            {isEditing ? `Edit Quotation ${form.quotation_number}` : 'New Quotation'}
          </h1>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'var(--text-muted, #8C8C8C)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text, #111111)'
              e.currentTarget.style.backgroundColor = 'var(--bg-band, #F2F2F2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Error Banner */}
        {formError && (
          <div style={{
            padding: '10px 14px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '6px',
            color: '#DC2626',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{formError}</span>
          </div>
        )}

        {/* ── SECTION A: CUSTOMER ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          
          {/* Customer Name* */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              paddingTop: '9px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Customer Name<span className="cred-required-dot" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
            </label>

            <div ref={customerDropdownRef} style={{ position: 'relative', width: '100%', maxWidth: '480px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  style={{
                    height: '38px',
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 12px',
                    border: '1px solid var(--border, #E4E4E4)',
                    borderRadius: '6px',
                    backgroundColor: 'var(--card-bg, #ffffff)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                >
                  <span style={{
                    color: selectedCustomer ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {selectedCustomer ? `${selectedCustomer.name}${selectedCustomer.company_name ? ` (${selectedCustomer.company_name})` : ''}` : 'Select or add a customer'}
                  </span>
                  <ChevronDown size={15} style={{ color: 'var(--text-muted, #8C8C8C)', flexShrink: 0, marginLeft: '8px' }} />
                </div>

                {/* Search Button (Ink color) */}
                <button
                  type="button"
                  onClick={() => setIsCustomerDropdownOpen(prev => !prev)}
                  title="Search customers"
                  style={{
                    height: '38px',
                    width: '38px',
                    border: '1px solid var(--border, #E4E4E4)',
                    borderRadius: '6px',
                    background: 'var(--bg-band, #F2F2F2)',
                    color: 'var(--text, #111111)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <Search size={15} />
                </button>
              </div>

              {/* Customer Dropdown Panel */}
              {isCustomerDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '42px',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  zIndex: 200,
                  padding: '8px',
                  maxHeight: '280px',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border, #E4E4E4)', paddingBottom: '6px', marginBottom: '6px' }}>
                    <Search size={14} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{
                        border: 'none',
                        outline: 'none',
                        width: '100%',
                        fontSize: '12.5px',
                        color: 'var(--text, #111111)',
                        background: 'transparent'
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsCustomerDropdownOpen(false)
                      setIsCustomerModalOpen(true)
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 8px',
                      background: 'var(--bg-band, #F2F2F2)',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'var(--text, #111111)',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '6px'
                    }}
                  >
                    <Plus size={14} />
                    <span>New Customer</span>
                  </button>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {filteredCustomers.length === 0 ? (
                      <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', textAlign: 'center' }}>
                        No customers found
                      </div>
                    ) : (
                      filteredCustomers.map(c => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          style={{
                            padding: '7px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12.5px',
                            color: 'var(--text, #111111)',
                            backgroundColor: String(form.customer) === String(c.id) ? 'var(--bg-band, #F2F2F2)' : 'transparent',
                            transition: 'background 0.1s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-band, #F2F2F2)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = String(form.customer) === String(c.id) ? 'var(--bg-band, #F2F2F2)' : 'transparent'}
                        >
                          <div style={{ fontWeight: 500 }}>{c.name}</div>
                          {c.company_name && <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>{c.company_name}</div>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Billing Address (2 rows) */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              paddingTop: '8px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Billing Address
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <textarea
                rows={2}
                value={form.billing_address}
                onChange={(e) => { setForm(p => ({ ...p, billing_address: e.target.value })); setIsDirty(true); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--text, #111111)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        </div>

        {/* Hairline Divider */}
        <div style={{ borderBottom: '1px solid var(--border, #E4E4E4)', marginBottom: '24px' }} />

        {/* ── SECTION B: QUOTE DETAILS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          
          {/* Quotation Number* */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Quote#<span className="cred-required-dot" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '480px' }}>
              <input
                type="text"
                required
                value={form.quotation_number}
                onChange={(e) => { setForm(p => ({ ...p, quotation_number: e.target.value })); setIsDirty(true); }}
                style={{
                  height: '38px',
                  width: '100%',
                  padding: '0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--text, #111111)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                title="Numbering Settings"
                onClick={() => showToast('Numbering sequence is automatically managed', 'info')}
                style={{
                  height: '38px',
                  width: '38px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  background: 'var(--bg-band, #F2F2F2)',
                  color: 'var(--text-muted, #8C8C8C)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <Settings size={15} />
              </button>
            </div>
          </div>

          {/* Reference / PO Number */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Reference#
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <input
                type="text"
                value={form.reference_number}
                onChange={(e) => { setForm(p => ({ ...p, reference_number: e.target.value })); setIsDirty(true); }}
                style={{
                  height: '38px',
                  width: '100%',
                  padding: '0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--text, #111111)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Quote Date* and Valid Until (Same Row, Two Columns) */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Quote Date<span className="cred-required-dot" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
            </label>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              maxWidth: '520px'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  type="date"
                  required
                  value={form.quotation_date}
                  onChange={(e) => { setForm(p => ({ ...p, quotation_date: e.target.value })); setIsDirty(true); }}
                  style={{
                    height: '38px',
                    width: '100%',
                    padding: '0 12px',
                    border: '1px solid var(--border, #E4E4E4)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: 'var(--text, #111111)',
                    backgroundColor: 'var(--card-bg, #ffffff)',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <span style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#475569',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                Expiry Date
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  type="date"
                  placeholder="Expiry Date"
                  title="Expiry Date"
                  value={form.valid_until}
                  onChange={(e) => { setForm(p => ({ ...p, valid_until: e.target.value })); setIsDirty(true); }}
                  style={{
                    height: '38px',
                    width: '100%',
                    padding: '0 12px',
                    border: '1px solid var(--border, #E4E4E4)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: 'var(--text, #111111)',
                    backgroundColor: 'var(--card-bg, #ffffff)',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Hairline Divider */}
        <div style={{ borderBottom: '1px solid var(--border, #E4E4E4)', marginBottom: '24px' }} />

        {/* ── SECTION C: NEW ZOHO FIELDS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          
          {/* Salesperson (Searchable Select / Select) */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Salesperson
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <select
                className="cred-select"
                value={form.salesperson}
                onChange={(e) => { setForm(p => ({ ...p, salesperson: e.target.value })); setIsDirty(true); }}
                style={{
                  height: '38px',
                  width: '100%',
                  lineHeight: 'normal',
                  fontSize: '13px',
                  borderRadius: '6px',
                  padding: '0 32px 0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  color: form.salesperson ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select or Add Salesperson</option>
                {staffOptions.map((s, idx) => (
                  <option key={idx} value={s.username || s.name || s}>
                    {s.name || s.username || s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Project Name (Select, disabled until customer chosen) */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              paddingTop: '9px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Project Name
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <select
                className="cred-select"
                disabled={!form.customer}
                value={form.job_order}
                onChange={(e) => { setForm(p => ({ ...p, job_order: e.target.value })); setIsDirty(true); }}
                style={{
                  height: '38px',
                  width: '100%',
                  lineHeight: 'normal',
                  fontSize: '13px',
                  borderRadius: '6px',
                  padding: '0 32px 0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  backgroundColor: !form.customer ? 'var(--bg-subtle, #F5F5F5)' : 'var(--card-bg, #ffffff)',
                  color: form.job_order ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)',
                  cursor: !form.customer ? 'not-allowed' : 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select a project</option>
                {customerProjects.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.order_id || `JOB-${j.id}`} - {j.title || 'Untitled Project'}
                  </option>
                ))}
                {form.customer && customerProjects.length === 0 && (
                  <option value="" disabled>No projects found</option>
                )}
              </select>
              {!form.customer && (
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #8C8C8C)', marginTop: '4px' }}>
                  Select a customer to associate a project.
                </div>
              )}
            </div>
          </div>

          {/* Subject (2-row textarea with ⓘ icon) */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              paddingTop: '8px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              Subject
              <span title="Let your customer know what this Quote is for" style={{ color: 'var(--text-muted, #8C8C8C)', cursor: 'help', display: 'inline-flex' }}>
                <Info size={13} />
              </span>
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <textarea
                rows={2}
                placeholder="Let your customer know what this Quote is for"
                value={form.subject}
                onChange={(e) => { setForm(p => ({ ...p, subject: e.target.value })); setIsDirty(true); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--text, #111111)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        </div>

        {/* Hairline Divider */}
        <div style={{ borderBottom: '1px solid var(--border, #E4E4E4)', marginBottom: '24px' }} />

        {/* ── ITEM TABLE ── */}
        <div style={{ marginBottom: '32px' }}>
          
          {/* Header Row above table: "Item Table" */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <h2 style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'var(--text, #111111)'
            }}>
              Item Table
            </h2>
          </div>

          {/* Desktop Table View */}
          <div className="quotation-desktop-table" style={{
            width: '100%',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '8px',
            backgroundColor: 'var(--card-bg, #ffffff)',
            overflow: 'hidden'
          }}>
            <table className="estimate-items-table" style={{
              width: '100%',
              tableLayout: 'fixed',
              borderCollapse: 'collapse',
              fontSize: '13px',
              textAlign: 'left'
            }}>
              <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '36%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '5%' }} />
              </colgroup>
              <thead>
                <tr style={{
                  borderBottom: '1px solid var(--border, #E4E4E4)',
                  backgroundColor: 'var(--bg-band, #F2F2F2)',
                  color: 'var(--text-muted, #8C8C8C)'
                }}>
                  <th style={{ padding: '10px 4px', textAlign: 'center' }}></th>
                  <th style={{ padding: '10px 10px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Item Details</th>
                  <th style={{ padding: '10px 4px', textAlign: 'center', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Quantity</th>
                  <th style={{ padding: '10px 6px', textAlign: 'left', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Unit</th>
                  <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Rate</th>
                  <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Discount %</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Amount</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, idx) => (
                  <tr
                    key={idx}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                    style={{
                      borderBottom: '1px solid var(--border, #E4E4E4)',
                      opacity: draggedIdx === idx ? 0.4 : 1,
                      transition: 'background 0.1s ease'
                    }}
                  >
                    {/* Drag Handle */}
                    <td style={{
                      padding: '24px 2px 16px',
                      textAlign: 'center',
                      verticalAlign: 'top',
                      cursor: 'grab'
                    }}>
                      <GripVertical size={14} style={{ color: 'var(--text-muted, #8C8C8C)', display: 'inline-block' }} />
                    </td>

                    {/* Item Details (Stacked: Description + Pick from Price Chart) */}
                    <td style={{ padding: '16px 8px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                        <input
                          type="text"
                          placeholder="Item description"
                          className="est-row-input"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          required
                          style={{
                            height: '36px',
                            width: '100%',
                            padding: '0 12px',
                            fontSize: '14px',
                            lineHeight: 'normal',
                            borderRadius: '4px',
                            border: '1px solid var(--border, #E4E4E4)',
                            backgroundColor: 'var(--card-bg, #ffffff)',
                            color: 'var(--text, #111111)',
                            outline: 'none',
                            fontWeight: 500,
                            boxSizing: 'border-box'
                          }}
                        />

                        {materials.length > 0 && (
                          <select
                            className="cred-select"
                            value={item.material || ''}
                            onChange={(e) => handleSelectMaterialForItem(idx, e.target.value)}
                            style={{
                              width: '100%',
                              height: '36px',
                              lineHeight: 'normal',
                              padding: '0 32px 0 12px',
                              fontSize: '14px',
                              borderRadius: '4px',
                              border: '1px solid var(--border, #E4E4E4)',
                              backgroundColor: 'var(--bg-subtle, #F7F7F7)',
                              color: item.material ? 'var(--text, #111111)' : 'var(--text-muted, #737373)',
                              outline: 'none',
                              cursor: 'pointer',
                              backgroundPosition: 'right 12px center',
                              backgroundSize: '12px 12px',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="">Pick from Price Chart…</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} {m.measurements ? `(${m.measurements})` : ''} ({m.customer_price || m.unit_price} SAR)
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>

                    {/* Quantity */}
                    <td style={{ padding: '16px 4px', verticalAlign: 'top' }}>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        required
                        style={{
                          width: '100%',
                          height: '36px',
                          lineHeight: 'normal',
                          textAlign: 'center',
                          fontSize: '14px',
                          fontVariantNumeric: 'tabular-nums',
                          borderRadius: '4px',
                          border: '1px solid var(--border, #E4E4E4)',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          color: 'var(--text, #111111)',
                          outline: 'none',
                          boxSizing: 'border-box',
                          padding: '0 4px'
                        }}
                      />
                    </td>

                    {/* Unit */}
                    <td style={{ padding: '16px 4px', verticalAlign: 'top' }}>
                      <select
                        className="cred-select"
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        style={{
                          width: '100%',
                          height: '36px',
                          lineHeight: 'normal',
                          fontSize: '14px',
                          borderRadius: '4px',
                          textAlign: 'left',
                          padding: '0 28px 0 10px',
                          outline: 'none',
                          backgroundPosition: 'right 8px center',
                          backgroundSize: '10px 10px',
                          boxSizing: 'border-box'
                        }}
                      >
                        {UNIT_OPTIONS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>

                    {/* Rate (Price) */}
                    <td style={{ padding: '16px 4px', verticalAlign: 'top' }}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                        style={{
                          width: '100%',
                          height: '36px',
                          lineHeight: 'normal',
                          textAlign: 'right',
                          fontSize: '14px',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--text, #111111)',
                          borderRadius: '4px',
                          border: '1px solid var(--border, #E4E4E4)',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          padding: '0 12px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </td>

                    {/* Discount % */}
                    <td style={{ padding: '16px 4px', verticalAlign: 'top' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={item.discount_rate}
                        onChange={(e) => handleItemChange(idx, 'discount_rate', e.target.value)}
                        style={{
                          width: '100%',
                          height: '36px',
                          lineHeight: 'normal',
                          textAlign: 'right',
                          fontSize: '14px',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--text, #111111)',
                          borderRadius: '4px',
                          border: '1px solid var(--border, #E4E4E4)',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          padding: '0 12px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </td>

                    {/* Amount (Baseline aligned with first input) */}
                    <td style={{
                      padding: '24px 14px 16px',
                      textAlign: 'right',
                      verticalAlign: 'top',
                      fontSize: '14px',
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--text, #111111)',
                      whiteSpace: 'nowrap'
                    }}>
                      {formatTabular(item.total)}
                    </td>

                    {/* Delete Icon */}
                    <td style={{ padding: '18px 12px 16px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        title="Delete row"
                        style={{
                          width: '32px',
                          height: '32px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted, #8C8C8C)',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          transition: 'color 0.15s ease, background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#ef4444'
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Links under table: "Add New Row" & "Add Items in Bulk" */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={handleAddItem}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text, #111111)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 0'
              }}
            >
              <Plus size={14} strokeWidth={2} />
              <span>Add New Row</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text, #111111)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 0'
              }}
            >
              <Plus size={14} strokeWidth={2} />
              <span>Add Items in Bulk</span>
            </button>
          </div>

          {/* Mobile Cards (< 1100px) */}
          <div className="quotation-mobile-cards" style={{ display: 'none', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            {form.items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '10px',
                  padding: '14px',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #8C8C8C)' }}>
                    Item #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block', marginBottom: '3px' }}>Description</label>
                  <input
                    type="text"
                    placeholder="Item description"
                    className="est-row-input"
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    style={{
                      height: '36px',
                      width: '100%',
                      padding: '0 12px',
                      fontSize: '14px',
                      lineHeight: 'normal',
                      borderRadius: '4px',
                      border: '1px solid var(--border, #E4E4E4)',
                      backgroundColor: 'var(--card-bg, #ffffff)',
                      color: 'var(--text, #111111)',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {materials.length > 0 && (
                  <div>
                    <select
                      className="cred-select"
                      value={item.material || ''}
                      onChange={(e) => handleSelectMaterialForItem(idx, e.target.value)}
                      style={{
                        width: '100%',
                        height: '36px',
                        lineHeight: 'normal',
                        padding: '0 32px 0 12px',
                        fontSize: '14px',
                        borderRadius: '4px',
                        border: '1px solid var(--border, #E4E4E4)',
                        backgroundColor: 'var(--bg-subtle, #F7F7F7)',
                        color: item.material ? 'var(--text, #111111)' : 'var(--text-muted, #737373)',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="">Pick from Price Chart…</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.customer_price || m.unit_price} SAR)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block', marginBottom: '3px' }}>Qty</label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      style={{
                        width: '100%',
                        height: '36px',
                        textAlign: 'center',
                        fontSize: '14px',
                        borderRadius: '4px',
                        border: '1px solid var(--border, #E4E4E4)',
                        backgroundColor: 'var(--card-bg, #ffffff)',
                        color: 'var(--text, #111111)',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block', marginBottom: '3px' }}>Unit</label>
                    <select
                      className="cred-select"
                      value={item.unit}
                      onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                      style={{ width: '100%', height: '36px', fontSize: '14px', borderRadius: '4px', padding: '0 28px 0 10px', boxSizing: 'border-box' }}
                    >
                      {UNIT_OPTIONS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block', marginBottom: '3px' }}>Rate</label>
                    <input
                      type="number"
                      step="any"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                      style={{
                        width: '100%',
                        height: '36px',
                        textAlign: 'right',
                        fontSize: '14px',
                        borderRadius: '4px',
                        border: '1px solid var(--border, #E4E4E4)',
                        backgroundColor: 'var(--card-bg, #ffffff)',
                        color: 'var(--text, #111111)',
                        padding: '0 8px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px dotted var(--border, #E4E4E4)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>Discount: {item.discount_rate}%</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text, #111111)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatTabular(item.total)} SAR
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* ── NOTES, TERMS, ATTACHMENTS & TOTALS (Zoho Two-Column Layout) ── */}
        <div className="zoho-bottom-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: '40px',
          marginTop: '36px'
        }}>
          {/* Left Column: Notes, Terms, Attachments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Client Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                Customer Notes
              </label>
              <textarea
                rows={3}
                placeholder="Enter any notes to be displayed in your transaction"
                value={form.notes}
                onChange={(e) => { setForm(p => ({ ...p, notes: e.target.value })); setIsDirty(true); }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--text, #111111)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Terms & Conditions (Auto-growing tall textarea, min 8 rows) */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                Terms & Conditions
              </label>
              <textarea
                ref={termsTextareaRef}
                rows={8}
                value={form.terms_conditions}
                onChange={(e) => {
                  setForm(p => ({ ...p, terms_conditions: e.target.value }))
                  setIsDirty(true)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${Math.max(180, e.target.scrollHeight)}px`
                }}
                style={{
                  width: '100%',
                  minHeight: '180px',
                  padding: '10px 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  lineHeight: '1.55',
                  color: 'var(--text, #111111)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'none',
                  overflowY: 'hidden'
                }}
              />
            </div>

            {/* Attach File(s) to Quote */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '8px' }}>
                Attach File(s) to Quote
              </label>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={{
                  padding: '7px 14px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  color: 'var(--text, #111111)',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Upload size={14} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
                <span>Upload File</span>
              </button>

              <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #8C8C8C)', marginTop: '6px' }}>
                You can upload a maximum of 5 files, 10MB each
              </div>

              {fileError && (
                <div style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>
                  {fileError}
                </div>
              )}

              {attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                  {attachments.map((f, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        backgroundColor: 'var(--bg-band, #F2F2F2)',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <Paperclip size={13} style={{ color: 'var(--text-muted, #8C8C8C)', flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text, #111111)' }}>
                          {f.name}
                        </span>
                        <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '11px', flexShrink: 0 }}>
                          ({(f.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(i)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted, #8C8C8C)',
                          padding: '2px',
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Calculation Summary */}
          <div>
            <div style={{
              backgroundColor: 'var(--bg-band, #F2F2F2)',
              borderRadius: '8px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {/* Sub Total */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                color: 'var(--text, #111111)'
              }}>
                <span style={{ fontWeight: 500 }}>Sub Total</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                  {formatTabular(summary.subtotal)}
                </span>
              </div>

              {/* Overall Discount Input */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                color: 'var(--text-muted, #8C8C8C)'
              }}>
                <span>Discount ({currency})</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.discount_amount}
                  onChange={(e) => {
                    setForm(p => ({ ...p, discount_amount: parseFloat(e.target.value) || 0 }))
                    setIsDirty(true)
                  }}
                  style={{
                    width: '90px',
                    height: '28px',
                    padding: '0 8px',
                    border: '1px solid var(--border, #E4E4E4)',
                    borderRadius: '4px',
                    textAlign: 'right',
                    fontSize: '12.5px',
                    fontVariantNumeric: 'tabular-nums',
                    backgroundColor: 'var(--card-bg, #ffffff)',
                    color: 'var(--text, #111111)',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* VAT (15%) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                color: 'var(--text-muted, #8C8C8C)'
              }}>
                <span>VAT (15%)</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatTabular(summary.taxTotal)}
                </span>
              </div>

              {/* Hairline Divider */}
              <div style={{ height: '1px', backgroundColor: 'var(--border, #E4E4E4)', margin: '4px 0' }} />

              {/* Total ( SAR ) */}
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text, #111111)'
                }}>
                  Total ( SAR )
                </span>
                <span style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--text, #111111)'
                }}>
                  {formatTabular(summary.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── FOOTER ACTION BAR (Sticky at bottom) ── */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        backgroundColor: 'var(--card-bg, #ffffff)',
        borderTop: '1px solid var(--border, #E4E4E4)',
        padding: '14px 24px',
        zIndex: 100,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Left: Quotation Total info */}
          <div style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)' }}>
            Quotation Total: <strong style={{ color: 'var(--text, #111111)', fontVariantNumeric: 'tabular-nums' }}>{formatTabular(summary.grandTotal)} SAR</strong>
          </div>

          {/* Right Actions: Cancel (ghost), Save as Draft (secondary), Save & Issue Quote (black pill) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                height: '36px',
                padding: '0 14px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-muted, #8C8C8C)',
                cursor: 'pointer',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text, #111111)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSubmit('Draft')}
              disabled={submitting}
              style={{
                height: '36px',
                padding: '0 16px',
                backgroundColor: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text, #111111)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-band, #F2F2F2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--card-bg, #ffffff)'}
            >
              Save as Draft
            </button>

            <button
              type="button"
              onClick={() => {
                const issueStatus = (isEditing && form.status && form.status !== 'Draft') ? form.status : 'Sent'
                handleSubmit(issueStatus)
              }}
              disabled={submitting}
              style={{
                height: '36px',
                padding: '0 24px',
                backgroundColor: 'var(--black, #0A0A0A)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'opacity 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <Check size={14} />
              <span>{isEditing ? 'Save Changes' : 'Save & Issue Quote'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── QUICK CUSTOMER CREATION MODAL ── */}
      <ModalShell
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Add New Customer"
        formId="quick-customer-form"
        submitLabel="Create Customer"
        submittingLabel="Saving..."
        submitting={submittingCustomer}
      >
        <form id="quick-customer-form" onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
          <Field label="Customer Name" required>
            <TextInput
              required
              autoFocus
              value={newCustomerForm.name}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, name: e.target.value }))}
            />
          </Field>

          <Field label="Company Name">
            <TextInput
              value={newCustomerForm.company_name}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, company_name: e.target.value }))}
            />
          </Field>

          <Field label="Phone Number">
            <TextInput
              value={newCustomerForm.phone}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, phone: e.target.value }))}
            />
          </Field>

          <Field label="Email Address">
            <TextInput
              type="email"
              value={newCustomerForm.email}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, email: e.target.value }))}
            />
          </Field>

          <Field label="Billing Address">
            <Textarea
              rows={2}
              value={newCustomerForm.address}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, address: e.target.value }))}
            />
          </Field>
        </form>
      </ModalShell>

      {/* ── BULK MATERIALS MODAL ── */}
      <ModalShell
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Add Items in Bulk"
        maxWidth="540px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>
              {Object.keys(selectedBulkItems).length} item(s) selected
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="cred-modal-cancel-btn"
                onClick={() => setIsBulkModalOpen(false)}
                style={{
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #E4E4E4)',
                  background: 'var(--card-bg, #ffffff)',
                  color: 'var(--text, #111111)',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddBulkItemsToTable}
                style={{
                  height: '36px',
                  padding: '0 18px',
                  borderRadius: '9999px',
                  border: 'none',
                  background: 'var(--black, #0A0A0A)',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                Add Items
              </button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '6px',
            padding: '0 10px',
            height: '36px'
          }}>
            <Search size={14} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
            <input
              type="text"
              placeholder="Search price chart items..."
              value={bulkSearch}
              onChange={(e) => setBulkSearch(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '12.5px',
                color: 'var(--text, #111111)',
                background: 'transparent'
              }}
            />
          </div>

          <div style={{
            maxHeight: '320px',
            overflowY: 'auto',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '6px'
          }}>
            {filteredBulkMaterials.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted, #8C8C8C)', fontSize: '13px' }}>
                No materials found
              </div>
            ) : (
              filteredBulkMaterials.map(m => {
                const isChecked = selectedBulkItems[m.id] !== undefined
                return (
                  <div
                    key={m.id}
                    onClick={() => handleToggleBulkMaterial(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border, #E4E4E4)',
                      cursor: 'pointer',
                      backgroundColor: isChecked ? 'var(--fill-ghost-hover, #F2F2F2)' : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text, #111111)' }}>
                          {m.name}
                        </div>
                        {m.measurements && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #8C8C8C)' }}>
                            {m.measurements}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ fontSize: '13px', fontVariantNumeric: 'tabular-nums', color: 'var(--text, #111111)' }}>
                        {m.customer_price || m.unit_price ? `${m.customer_price || m.unit_price} SAR` : ''}
                      </div>
                      {isChecked && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>Qty:</span>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={selectedBulkItems[m.id] || 1}
                            onChange={(e) => handleBulkQtyChange(m.id, e.target.value)}
                            style={{
                              width: '60px',
                              height: '28px',
                              textAlign: 'center',
                              fontSize: '12px',
                              borderRadius: '4px',
                              border: '1px solid var(--border, #E4E4E4)',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </ModalShell>

      {/* Responsive Styles Injection */}
      <style>{`
        @media (max-width: 1099px) {
          .quotation-desktop-table { display: none !important; }
          .quotation-mobile-cards { display: flex !important; }
          .zoho-bottom-grid {
            grid-template-columns: 1fr !important;
          }
          .zoho-form-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 6px !important;
          }
          .zoho-form-row label {
            width: 100% !important;
            padding-top: 0 !important;
          }
        }
        @media (min-width: 1100px) {
          .quotation-desktop-table { display: block !important; }
          .quotation-mobile-cards { display: none !important; }
        }
      `}</style>
    </div>
  )
}

export default QuotationBuilder
