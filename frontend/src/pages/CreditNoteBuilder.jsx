import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  X, Plus, Trash2, Search, Settings, AlertCircle, Check,
  Paperclip, ChevronDown, GripVertical, Upload, Info
} from 'lucide-react'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { ModalShell } from '../components/common/FormPrimitives'
import { useSettings } from '../contexts/SettingsContext'
import { showError, showToast, showSuccess, showConfirm } from '../utils/swal'
import { handlePdfResponse } from '../utils/pdfDownload'

const REASON_CHOICES = [
  'Sales Return',
  'Overbilled / Pricing Error',
  'Defective / Damaged Goods',
  'Service Cancellation',
  'Goodwill / Rebate',
  'Other'
]

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

const AutoGrowingTextarea = ({ value, onChange, placeholder, className, style, ...props }) => {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = '36px'
      const scrollH = ref.current.scrollHeight
      ref.current.style.height = Math.max(36, scrollH) + 'px'
    }
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      rows={1}
      style={{
        ...style,
        minHeight: '36px',
        resize: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
      {...props}
    />
  )
}

const AutoGrowingTermsTextarea = ({ value, onChange, placeholder, style, ...props }) => {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = Math.max(100, ref.current.scrollHeight) + 'px'
    }
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        ...style,
        minHeight: '100px',
        resize: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
      {...props}
    />
  )
}

const CreditNoteBuilder = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const { settings } = useSettings()
  const currency = settings?.currency || 'SAR'

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [formError, setFormError] = useState('')

  // Lookups
  const [customers, setCustomers] = useState([])
  const [invoices, setInvoices] = useState([])
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

  // Main Form State
  const [creditNoteForm, setCreditNoteForm] = useState({
    credit_note_number: '',
    customer: '',
    invoice: '',
    credit_reason: 'Sales Return',
    credit_note_date: new Date().toISOString().split('T')[0],
    reference_number: '',
    customer_tax_number: '',
    billing_address: '',
    status: 'Issued',
    discount_amount: 0,
    salesperson: '',
    subject: '',
    notes: 'Credit note issued against returned / adjusted items.',
    terms_conditions: 'This credit amount will be applied to outstanding balances or refunded as agreed.',
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

  // Warn on tab/window close if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const fetchNextCreditNoteNumber = async () => {
    try {
      const res = await api.get('credit-notes/next-number/')
      return res.data?.next_number || `CN-${new Date().getFullYear()}-0001`
    } catch {
      return `CN-${new Date().getFullYear()}-0001`
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const toArr = (d) => Array.isArray(d) ? d : (d?.results || [])
      const [cRes, iRes, mRes, sRes] = await Promise.all([
        api.get('customers/?page_size=1000').catch(() => ({ data: [] })),
        api.get('invoices/?page_size=1000').catch(() => ({ data: [] })),
        api.get('materials/').catch(() => ({ data: [] })),
        api.get('job-orders/staff-options/').catch(() => ({ data: [] }))
      ])

      const custList = toArr(cRes.data)
      const invList = toArr(iRes.data)
      const matList = toArr(mRes.data)
      const staffList = Array.isArray(sRes.data) ? sRes.data : []

      setCustomers(custList)
      setInvoices(invList)
      setMaterials(matList)
      setStaffOptions(staffList)

      if (isEditing) {
        const { data: cn } = await api.get(`credit-notes/${id}/`)
        const formattedItems = (cn.items && cn.items.length > 0)
          ? cn.items.map(it => ({
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
          : [{ ...DEFAULT_ITEM, unit_price: parseFloat(cn.subtotal) || 0, total: parseFloat(cn.total_amount) || 0 }]

        setCreditNoteForm({
          credit_note_number: cn.credit_note_number,
          customer: cn.customer,
          invoice: cn.invoice || '',
          credit_reason: cn.credit_reason || 'Sales Return',
          credit_note_date: cn.credit_note_date || '',
          reference_number: cn.reference_number || '',
          customer_tax_number: cn.customer_tax_number || '',
          billing_address: cn.billing_address || '',
          status: cn.status || 'Issued',
          discount_amount: parseFloat(cn.discount_amount) || 0,
          salesperson: cn.created_by_staff || '',
          subject: '',
          notes: cn.notes || 'Credit note issued against returned / adjusted items.',
          terms_conditions: cn.terms_conditions || 'This credit amount will be applied to outstanding balances or refunded as agreed.',
          items: formattedItems,
          custom_fields: cn.custom_fields || {}
        })
      } else {
        const nextNum = await fetchNextCreditNoteNumber()
        const today = new Date().toISOString().split('T')[0]

        // Check query params in case navigated with pre-filled invoice or customer
        const urlParams = new URLSearchParams(window.location.search)
        const invParam = urlParams.get('invoice')
        const custParam = urlParams.get('customer')

        setCreditNoteForm(prev => ({
          ...prev,
          credit_note_number: nextNum,
          customer: custParam || prev.customer || '',
          invoice: invParam || prev.invoice || '',
          credit_note_date: today,
          status: 'Issued'
        }))

        if (invParam) {
          const inv = invList.find(i => String(i.id) === String(invParam))
          if (inv) {
            handleInvoiceSelect(inv)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load credit note builder data:', err)
      showError('Load Error', 'Failed to initialize credit note builder.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return customers.find(c => String(c.id) === String(creditNoteForm.customer))
  }, [customers, creditNoteForm.customer])

  // Customer options filtered by customer search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers
    const q = customerSearch.toLowerCase()
    return customers.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    )
  }, [customers, customerSearch])

  // Invoices filtered by selected customer (if chosen)
  const customerInvoices = useMemo(() => {
    if (!creditNoteForm.customer) return invoices
    return invoices.filter(inv => String(inv.customer) === String(creditNoteForm.customer))
  }, [invoices, creditNoteForm.customer])

  const handleSelectCustomer = (cust) => {
    setCreditNoteForm(prev => ({
      ...prev,
      customer: cust.id,
      customer_tax_number: cust.tax_number || prev.customer_tax_number || '',
      billing_address: cust.address || prev.billing_address || ''
    }))
    setIsCustomerDropdownOpen(false)
    setIsDirty(true)
  }

  // Linked Invoice Selection: auto-populate items from invoice
  const handleInvoiceSelect = (inv) => {
    if (!inv) {
      setCreditNoteForm(prev => ({ ...prev, invoice: '' }))
      setIsDirty(true)
      return
    }

    const itemsFromInvoice = (inv.items && inv.items.length > 0)
      ? inv.items.map(it => {
          const qty = parseFloat(it.quantity) || 1
          const price = parseFloat(it.unit_price) || 0
          const disc = parseFloat(it.discount_rate) || 0
          const tax = parseFloat(it.tax_rate) !== undefined ? parseFloat(it.tax_rate) : 15
          const base = qty * price
          const discAmt = base * (disc / 100)
          const taxable = Math.max(0, base - discAmt)
          const vatAmt = taxable * (tax / 100)
          const tot = taxable + vatAmt

          return {
            description: it.description || '',
            material: it.material || '',
            quantity: qty,
            unit: it.unit || 'Unit',
            unit_price: price,
            discount_rate: disc,
            tax_rate: tax,
            tax_amount: Number(vatAmt.toFixed(2)),
            total: Number(tot.toFixed(2))
          }
        })
      : [{
          ...DEFAULT_ITEM,
          description: `Credit against ${inv.invoice_number}`,
          unit_price: parseFloat(inv.subtotal) || 0,
          total: parseFloat(inv.total_amount) || 0
        }]

    setCreditNoteForm(prev => ({
      ...prev,
      invoice: inv.id,
      customer: prev.customer || inv.customer || '',
      billing_address: prev.billing_address || inv.billing_address || '',
      customer_tax_number: prev.customer_tax_number || inv.customer_tax_number || '',
      reference_number: prev.reference_number || `Credit against ${inv.invoice_number}`,
      items: itemsFromInvoice
    }))
    setIsDirty(true)
    showToast(`Loaded details from Invoice ${inv.invoice_number}`, 'success')
  }

  // Item Table Handlers
  const handleItemChange = (index, field, value) => {
    setCreditNoteForm(prev => {
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

  const handleSelectMaterialForItem = (idx, materialId) => {
    if (!materialId) {
      handleItemChange(idx, 'material', '')
      return
    }
    const mat = materials.find(m => String(m.id) === String(materialId))
    if (!mat) return

    setCreditNoteForm(prev => {
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
    setCreditNoteForm(prev => ({
      ...prev,
      items: [...prev.items, { ...DEFAULT_ITEM }]
    }))
    setIsDirty(true)
  }

  const handleRemoveItem = (index) => {
    if (creditNoteForm.items.length <= 1) {
      showToast('A credit note must have at least one line item', 'warning')
      return
    }
    setCreditNoteForm(prev => ({
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

  const handleDrop = (e, dropIdx) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === dropIdx) return
    setCreditNoteForm(prev => {
      const items = [...prev.items]
      const [draggedItem] = items.splice(draggedIdx, 1)
      items.splice(dropIdx, 0, draggedItem)
      return { ...prev, items }
    })
    setDraggedIdx(null)
    setIsDirty(true)
  }

  // Bulk add modal
  const handleAddBulkItemsToForm = () => {
    const newItems = []
    Object.entries(selectedBulkItems).forEach(([matId, qty]) => {
      const numQty = parseFloat(qty)
      if (numQty > 0) {
        const mat = materials.find(m => String(m.id) === String(matId))
        if (mat) {
          const price = parseFloat(mat.customer_price) || parseFloat(mat.unit_price) || 0
          const taxable = numQty * price
          const taxAmt = taxable * 0.15
          newItems.push({
            description: mat.name + (mat.measurements ? ` (${mat.measurements})` : ''),
            material: mat.id,
            quantity: numQty,
            unit: mat.unit || 'Unit',
            unit_price: price,
            discount_rate: 0,
            tax_rate: 15,
            tax_amount: Number(taxAmt.toFixed(2)),
            total: Number((taxable + taxAmt).toFixed(2))
          })
        }
      }
    })

    if (newItems.length === 0) {
      showToast('No items selected', 'info')
      return
    }

    setCreditNoteForm(prev => {
      const hasOnlyEmptyDefault = prev.items.length === 1 && !prev.items[0].description && prev.items[0].unit_price === 0
      const finalItems = hasOnlyEmptyDefault ? newItems : [...prev.items, ...newItems]
      return { ...prev, items: finalItems }
    })

    setSelectedBulkItems({})
    setIsBulkModalOpen(false)
    setIsDirty(true)
    showToast(`Added ${newItems.length} items to credit note`, 'success')
  }

  // Attachments Handling (Client-side validation max 10 files, 10MB each)
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setFileError('')

    if (attachments.length + files.length > 10) {
      setFileError('You can upload a maximum of 10 files.')
      return
    }

    const oversized = files.find(f => f.size > 10 * 1024 * 1024)
    if (oversized) {
      setFileError(`File "${oversized.name}" exceeds the 10MB limit.`)
      return
    }

    setAttachments(prev => [...prev, ...files])
    setIsDirty(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
    setIsDirty(true)
  }

  // Quick Customer Creation
  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    if (!newCustomerForm.name.trim()) return
    try {
      setSubmittingCustomer(true)
      const res = await api.post('customers/', newCustomerForm)
      const created = res.data
      setCustomers(prev => [created, ...prev])
      setCreditNoteForm(prev => ({
        ...prev,
        customer: created.id,
        billing_address: created.address || prev.billing_address || '',
        customer_tax_number: created.tax_number || prev.customer_tax_number || ''
      }))
      setIsCustomerModalOpen(false)
      setNewCustomerForm({ name: '', company_name: '', phone: '', email: '', address: '' })
      setIsDirty(true)
      showToast('Customer created successfully', 'success')
    } catch (err) {
      console.error('Failed to create customer:', err)
      showError('Failed', 'Could not create customer.')
    } finally {
      setSubmittingCustomer(false)
    }
  }

  // Summary Totals Calculation
  const totals = useMemo(() => {
    let subtotal = 0
    let taxTotal = 0

    creditNoteForm.items.forEach(it => {
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

    const overallDiscount = parseFloat(creditNoteForm.discount_amount) || 0
    const finalSubtotal = Math.max(0, subtotal - overallDiscount)
    const effectiveVat = subtotal > 0 ? (taxTotal * (finalSubtotal / subtotal)) : 0
    const grandTotal = finalSubtotal + effectiveVat
    const totalQty = creditNoteForm.items.reduce((acc, it) => acc + (parseFloat(it.quantity) || 0), 0)

    return {
      subtotal: Number(subtotal.toFixed(2)),
      overallDiscount,
      taxTotal: Number(effectiveVat.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2)),
      totalQty
    }
  }, [creditNoteForm.items, creditNoteForm.discount_amount])

  // Close / Cancel confirmation
  const handleClose = async () => {
    if (isDirty) {
      const confirmed = await showConfirm(
        'Discard changes?',
        'You have unsaved changes. Are you sure you want to leave?'
      )
      if (!confirmed) return
    }
    navigate('/credit-notes')
  }

  // Submit Handler
  const handleSubmit = async (targetStatus) => {
    setFormError('')
    if (!creditNoteForm.customer) {
      setFormError('Please select a customer.')
      showToast('Customer is required', 'warning')
      return
    }
    if (!creditNoteForm.credit_note_number.trim()) {
      setFormError('Credit Note Number is required.')
      showToast('Credit Note Number is required', 'warning')
      return
    }

    const payload = {
      credit_note_number: creditNoteForm.credit_note_number,
      customer: creditNoteForm.customer,
      invoice: creditNoteForm.invoice || null,
      credit_note_date: creditNoteForm.credit_note_date,
      credit_reason: creditNoteForm.credit_reason,
      status: targetStatus || creditNoteForm.status || 'Issued',
      reference_number: creditNoteForm.reference_number || '',
      customer_tax_number: creditNoteForm.customer_tax_number || '',
      billing_address: creditNoteForm.billing_address || '',
      created_by_staff: creditNoteForm.salesperson || '',
      subtotal: totals.subtotal,
      tax_rate: 15.00,
      tax_amount: totals.taxTotal,
      total_amount: totals.grandTotal,
      discount_amount: totals.overallDiscount,
      notes: creditNoteForm.notes || '',
      terms_conditions: creditNoteForm.terms_conditions || '',
      custom_fields: creditNoteForm.custom_fields || {},
      items: creditNoteForm.items.map((it, idx) => ({
        ...(it.id ? { id: it.id } : {}),
        description: it.description || 'Credit line item',
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
        await api.put(`credit-notes/${id}/`, payload)
        setIsDirty(false)
        showSuccess('Saved!', `Credit Note ${creditNoteForm.credit_note_number} updated successfully.`)
        navigate('/credit-notes')
      } else {
        const res = await api.post('credit-notes/', payload)
        setIsDirty(false)
        showSuccess('Created!', `Credit Note ${creditNoteForm.credit_note_number} created successfully.`)
        navigate('/credit-notes')
      }
    } catch (err) {
      console.error('Submit error:', err)
      const msg = err.response?.data?.credit_note_number?.[0] || err.response?.data?.detail || 'Failed to save credit note.'
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
            {isEditing ? `Edit Credit Note ${creditNoteForm.credit_note_number}` : 'New Credit Note'}
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

        {/* ── SECTION A: CUSTOMER & REASON ── */}
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
              Customer Name<span className="cred-required-dot" />
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

                {/* Search Button */}
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
                            backgroundColor: String(creditNoteForm.customer) === String(c.id) ? 'var(--bg-band, #F2F2F2)' : 'transparent',
                            transition: 'background 0.1s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-band, #F2F2F2)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = String(creditNoteForm.customer) === String(c.id) ? 'var(--bg-band, #F2F2F2)' : 'transparent'}
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

          {/* Linked Invoice (Optional) */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Linked Invoice
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <select
                className="cred-select"
                value={creditNoteForm.invoice}
                onChange={(e) => {
                  const val = e.target.value
                  const inv = invoices.find(i => String(i.id) === String(val))
                  handleInvoiceSelect(inv)
                }}
                style={{
                  height: '38px',
                  width: '100%',
                  lineHeight: 'normal',
                  fontSize: '13px',
                  borderRadius: '6px',
                  padding: '0 32px 0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  color: creditNoteForm.invoice ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select Invoice to load items…</option>
                {customerInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} - {inv.customer_name || 'Customer'} ({parseFloat(inv.total_amount || 0).toLocaleString()} SAR)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reason* (Existing Options) */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Reason<span className="cred-required-dot" />
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <select
                className="cred-select"
                value={creditNoteForm.credit_reason}
                onChange={(e) => { setCreditNoteForm(p => ({ ...p, credit_reason: e.target.value })); setIsDirty(true); }}
                style={{
                  height: '38px',
                  width: '100%',
                  lineHeight: 'normal',
                  fontSize: '13px',
                  borderRadius: '6px',
                  padding: '0 32px 0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  color: 'var(--text, #111111)',
                  boxSizing: 'border-box'
                }}
              >
                {REASON_CHOICES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
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
                value={creditNoteForm.billing_address}
                onChange={(e) => { setCreditNoteForm(p => ({ ...p, billing_address: e.target.value })); setIsDirty(true); }}
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

        {/* ── SECTION B: CREDIT NOTE DETAILS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          
          {/* Credit Note#* */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Credit Note#<span className="cred-required-dot" />
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '480px' }}>
              <input
                type="text"
                required
                value={creditNoteForm.credit_note_number}
                onChange={(e) => { setCreditNoteForm(p => ({ ...p, credit_note_number: e.target.value })); setIsDirty(true); }}
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
                title="Numbering Settings / Auto-generate"
                onClick={async () => {
                  const num = await fetchNextCreditNoteNumber()
                  setCreditNoteForm(p => ({ ...p, credit_note_number: num }))
                  setIsDirty(true)
                  showToast('Generated sequential credit note number', 'info')
                }}
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

          {/* Reference# */}
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
                placeholder="PO / Reference number"
                value={creditNoteForm.reference_number}
                onChange={(e) => { setCreditNoteForm(p => ({ ...p, reference_number: e.target.value })); setIsDirty(true); }}
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

          {/* Credit Note Date* */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Credit Note Date<span className="cred-required-dot" />
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <input
                type="date"
                required
                value={creditNoteForm.credit_note_date}
                onChange={(e) => { setCreditNoteForm(p => ({ ...p, credit_note_date: e.target.value })); setIsDirty(true); }}
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

        {/* Hairline Divider */}
        <div style={{ borderBottom: '1px solid var(--border, #E4E4E4)', marginBottom: '24px' }} />

        {/* ── SECTION C: ZOHO FIELDS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          
          {/* Salesperson */}
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
                value={creditNoteForm.salesperson}
                onChange={(e) => { setCreditNoteForm(p => ({ ...p, salesperson: e.target.value })); setIsDirty(true); }}
                style={{
                  height: '38px',
                  width: '100%',
                  lineHeight: 'normal',
                  fontSize: '13px',
                  borderRadius: '6px',
                  padding: '0 32px 0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  color: creditNoteForm.salesperson ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)',
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

          {/* Subject */}
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
              <span title="Let your customer know what this Credit Note is for" style={{ color: 'var(--text-muted, #8C8C8C)', cursor: 'help', display: 'inline-flex' }}>
                <Info size={13} />
              </span>
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <textarea
                rows={2}
                placeholder="Let your customer know what this Credit Note is for"
                value={creditNoteForm.subject}
                onChange={(e) => { setCreditNoteForm(p => ({ ...p, subject: e.target.value })); setIsDirty(true); }}
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
          
          {/* Header Row: Title alone */}
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
                {creditNoteForm.items.map((item, idx) => (
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

                    {/* Item Details: Stacked Description + Pick from Price Chart */}
                    <td style={{ padding: '16px 8px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                        <AutoGrowingTextarea
                          placeholder="Item description"
                          className="est-row-input"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: '14px',
                            lineHeight: '1.4',
                            borderRadius: '4px',
                            border: '1px solid var(--border, #E4E4E4)',
                            backgroundColor: 'var(--card-bg, #ffffff)',
                            color: 'var(--text, #111111)',
                            outline: 'none',
                            fontWeight: 500
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
                          border: '1px solid var(--border, #E4E4E4)',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          color: 'var(--text, #111111)',
                          boxSizing: 'border-box'
                        }}
                      >
                        {UNIT_OPTIONS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>

                    {/* Rate */}
                    <td style={{ padding: '16px 4px', verticalAlign: 'top' }}>
                      <input
                        type="number"
                        step="any"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                        required
                        style={{
                          width: '100%',
                          height: '36px',
                          lineHeight: 'normal',
                          textAlign: 'right',
                          fontSize: '14px',
                          fontVariantNumeric: 'tabular-nums',
                          borderRadius: '4px',
                          border: '1px solid var(--border, #E4E4E4)',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          color: 'var(--text, #111111)',
                          outline: 'none',
                          boxSizing: 'border-box',
                          padding: '0 10px'
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
                          borderRadius: '4px',
                          border: '1px solid var(--border, #E4E4E4)',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          color: 'var(--text, #111111)',
                          outline: 'none',
                          boxSizing: 'border-box',
                          padding: '0 10px'
                        }}
                      />
                    </td>

                    {/* Amount */}
                    <td style={{
                      padding: '24px 14px 16px 6px',
                      verticalAlign: 'top',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text, #111111)'
                    }}>
                      {formatTabular(item.total)}
                    </td>

                    {/* Delete Action */}
                    <td style={{ padding: '18px 8px 16px', textAlign: 'center', verticalAlign: 'top' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        title="Delete line"
                        aria-label="Delete line"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted, #8C8C8C)',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
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
            {creditNoteForm.items.map((item, idx) => (
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
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <textarea
                  placeholder="Item description"
                  value={item.description}
                  onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    borderRadius: '4px',
                    border: '1px solid var(--border, #E4E4E4)',
                    boxSizing: 'border-box'
                  }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block', marginBottom: '3px' }}>Qty</label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      style={{ width: '100%', height: '36px', textAlign: 'center', fontSize: '14px', borderRadius: '4px', border: '1px solid var(--border, #E4E4E4)', boxSizing: 'border-box' }}
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
                      style={{ width: '100%', height: '36px', textAlign: 'right', fontSize: '14px', borderRadius: '4px', border: '1px solid var(--border, #E4E4E4)', boxSizing: 'border-box' }}
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
          {/* Left Column: Customer Notes, Terms, Attachments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Customer Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                Customer Notes
              </label>
              <textarea
                rows={3}
                placeholder="Credit note issued against returned / adjusted items."
                value={creditNoteForm.notes}
                onChange={(e) => { setCreditNoteForm(p => ({ ...p, notes: e.target.value })); setIsDirty(true); }}
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
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #8C8C8C)', marginTop: '4px' }}>
                Will be displayed on the credit note
              </div>
            </div>

            {/* Terms & Conditions (Auto-growing) */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                Terms & Conditions
              </label>
              <AutoGrowingTermsTextarea
                placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
                value={creditNoteForm.terms_conditions}
                onChange={(e) => { setCreditNoteForm(p => ({ ...p, terms_conditions: e.target.value })); setIsDirty(true); }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  color: 'var(--text, #111111)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Attach File(s) to Credit Note */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>
                  Attach File(s) to Credit Note
                </label>
              </div>

              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  height: '36px',
                  padding: '0 14px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-band, #F2F2F2)',
                  color: 'var(--text, #111111)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border, #E4E4E4)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-band, #F2F2F2)'}
              >
                <Upload size={14} />
                <span>Upload File</span>
              </button>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #8C8C8C)', marginLeft: '10px' }}>
                You can upload a maximum of 10 files, 10MB each
              </span>

              {fileError && (
                <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>
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
                  {formatTabular(totals.subtotal)}
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
                  value={creditNoteForm.discount_amount}
                  onChange={(e) => {
                    setCreditNoteForm(p => ({ ...p, discount_amount: parseFloat(e.target.value) || 0 }))
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

              {/* VAT Reversal (15%) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                color: 'var(--text-muted, #8C8C8C)'
              }}>
                <span>VAT Reversal (15%)</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatTabular(totals.taxTotal)}
                </span>
              </div>

              {/* Hairline Divider */}
              <div style={{ borderBottom: '1px solid var(--border, #E4E4E4)', margin: '4px 0' }} />

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
                  {formatTabular(totals.grandTotal)}
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
          {/* Left: Total Amount and Quantity Info */}
          <div style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Total Amount: <strong style={{ color: 'var(--text, #111111)', fontVariantNumeric: 'tabular-nums' }}>SAR {formatTabular(totals.grandTotal)}</strong></span>
            <span>·</span>
            <span>Total Quantity: <strong style={{ color: 'var(--text, #111111)', fontVariantNumeric: 'tabular-nums' }}>{totals.totalQty}</strong></span>
          </div>

          {/* Right Actions: Cancel (ghost), Save as Draft (secondary), Save & Issue Note (black pill) */}
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
                const issueStatus = (isEditing && creditNoteForm.status && creditNoteForm.status !== 'Draft') ? creditNoteForm.status : 'Issued'
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
              <span>{submitting ? 'Saving…' : 'Save & Issue Note'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL: BULK ADD ITEMS FROM PRICE CHART ── */}
      <ModalShell
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Add Items in Bulk"
        maxWidth="640px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Search bar inside modal */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #8C8C8C)' }} />
            <input
              type="text"
              placeholder="Search materials from price chart..."
              value={bulkSearch}
              onChange={(e) => setBulkSearch(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                padding: '0 10px 0 32px',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '6px',
                fontSize: '13px',
                backgroundColor: 'var(--card-bg, #ffffff)',
                color: 'var(--text, #111111)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* List of items */}
          <div style={{
            maxHeight: '340px',
            overflowY: 'auto',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '6px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {materials
              .filter(m => !bulkSearch.trim() || m.name?.toLowerCase().includes(bulkSearch.toLowerCase()))
              .map(m => {
                const isSelected = Boolean(selectedBulkItems[m.id])
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border, #E4E4E4)',
                      backgroundColor: isSelected ? 'var(--bg-band, #F2F2F2)' : 'transparent',
                      fontSize: '13px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text, #111111)' }}>{m.name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #8C8C8C)' }}>
                        {m.measurements ? `${m.measurements} · ` : ''}{m.customer_price || m.unit_price} SAR / {m.unit || 'Unit'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={selectedBulkItems[m.id] || ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setSelectedBulkItems(prev => ({
                            ...prev,
                            [m.id]: val
                          }))
                        }}
                        style={{
                          width: '60px',
                          height: '30px',
                          padding: '0 6px',
                          textAlign: 'center',
                          border: '1px solid var(--border, #E4E4E4)',
                          borderRadius: '4px',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(false)}
              style={{
                height: '36px',
                padding: '0 14px',
                background: 'none',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--text-muted, #8C8C8C)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddBulkItemsToForm}
              style={{
                height: '36px',
                padding: '0 20px',
                backgroundColor: 'var(--black, #0A0A0A)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Add Selected Items
            </button>
          </div>
        </div>
      </ModalShell>

      {/* ── MODAL: QUICK CUSTOMER CREATION ── */}
      <ModalShell
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="New Customer"
        maxWidth="500px"
      >
        <form onSubmit={handleCreateCustomer}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                Customer Name<span className="cred-required-dot" />
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Individual or representative name"
                value={newCustomerForm.name}
                onChange={(e) => setNewCustomerForm(p => ({ ...p, name: e.target.value }))}
                style={{
                  height: '36px',
                  width: '100%',
                  padding: '0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                Company Name
              </label>
              <input
                type="text"
                placeholder="Organization or business name"
                value={newCustomerForm.company_name}
                onChange={(e) => setNewCustomerForm(p => ({ ...p, company_name: e.target.value }))}
                style={{
                  height: '36px',
                  width: '100%',
                  padding: '0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                  Phone
                </label>
                <input
                  type="text"
                  placeholder="+966 5..."
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm(p => ({ ...p, phone: e.target.value }))}
                  style={{
                    height: '36px',
                    width: '100%',
                    padding: '0 12px',
                    border: '1px solid var(--border, #E4E4E4)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                  Email
                </label>
                <input
                  type="email"
                  placeholder="billing@company.com"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm(p => ({ ...p, email: e.target.value }))}
                  style={{
                    height: '36px',
                    width: '100%',
                    padding: '0 12px',
                    border: '1px solid var(--border, #E4E4E4)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                Address
              </label>
              <textarea
                rows={2}
                placeholder="Street address, city, postal code"
                value={newCustomerForm.address}
                onChange={(e) => setNewCustomerForm(p => ({ ...p, address: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(false)}
              disabled={submittingCustomer}
              style={{
                height: '36px',
                padding: '0 14px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #8C8C8C)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingCustomer}
              style={{
                height: '36px',
                padding: '0 20px',
                backgroundColor: 'var(--black, #0A0A0A)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: submittingCustomer ? 'not-allowed' : 'pointer'
              }}
            >
              {submittingCustomer ? 'Creating…' : 'Create Customer'}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Responsive Styles Injection */}
      <style>{`
        @media (max-width: 1100px) {
          .quotation-desktop-table { display: none !important; }
          .quotation-mobile-cards { display: flex !important; }
          .zoho-bottom-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 768px) {
          .zoho-form-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 6px !important;
          }
          .zoho-form-row label {
            width: 100% !important;
            padding-top: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}

export default CreditNoteBuilder
