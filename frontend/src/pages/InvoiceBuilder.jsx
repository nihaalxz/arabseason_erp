import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  X, Plus, Trash2, Search, Settings, AlertCircle, Check,
  Paperclip, ChevronDown, GripVertical, Upload, Info
} from 'lucide-react'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import {
  ModalShell
} from '../components/common/FormPrimitives'
import { useSettings } from '../contexts/SettingsContext'
import { showError, showToast, showSuccess, showConfirm } from '../utils/swal'
import { handlePdfResponse } from '../utils/pdfDownload'

const getTodayStr = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const PAYMENT_TERMS_OPTIONS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Custom']
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

const InvoiceBuilder = () => {
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

  // Main Form State
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: '',
    customer: '',
    customer_tax_number: '',
    billing_address: '',
    job_order: '', // Project Name
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    supply_date: new Date().toISOString().split('T')[0],
    payment_terms: 'Due on Receipt',
    status: 'Issued',
    reference_number: '', // Order Number
    bank_account: '', // Preserved in state for backend payload
    discount_amount: 0,
    salesperson: '', // Zoho field (UI only)
    subject: '', // Zoho field (UI only)
    notes: 'Thanks for your business. Please remit payment as per bank details below.',
    terms_conditions: 'All payments must be received by the stated due date. Tax Invoice subject to Saudi VAT regulations.',
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

  // Due Date Calculator
  const calcDueDate = (dateStr, terms) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    if (terms === 'Net 15') d.setDate(d.getDate() + 15)
    else if (terms === 'Net 30') d.setDate(d.getDate() + 30)
    else if (terms === 'Net 45') d.setDate(d.getDate() + 45)
    else if (terms === 'Net 60') d.setDate(d.getDate() + 60)
    else if (terms === 'Due on Receipt') return dateStr
    return d.toISOString().split('T')[0]
  }

  const fetchNextInvoiceNumber = async () => {
    try {
      const res = await api.get('invoices/next-number/')
      return res.data?.next_number || `INV-${new Date().getFullYear()}-0001`
    } catch {
      return `INV-${new Date().getFullYear()}-0001`
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const toArr = (d) => Array.isArray(d) ? d : (d?.results || [])
      const [cRes, jRes, bRes, mRes, sRes] = await Promise.all([
        api.get('customers/?page_size=1000').catch(() => ({ data: [] })),
        api.get('job-orders/?page_size=1000&lookup=true').catch(() => ({ data: [] })),
        api.get('banks/?page_size=100').catch(() => ({ data: [] })),
        api.get('materials/').catch(() => ({ data: [] })),
        api.get('job-orders/staff-options/').catch(() => ({ data: [] }))
      ])

      const custList = toArr(cRes.data)
      const jobList = toArr(jRes.data)
      const bankList = toArr(bRes.data)
      const matList = toArr(mRes.data)
      const staffList = Array.isArray(sRes.data) ? sRes.data : []

      setCustomers(custList)
      setJobOrders(jobList)
      setMaterials(matList)
      setStaffOptions(staffList)

      if (isEditing) {
        const { data: inv } = await api.get(`invoices/${id}/`)
        const formattedItems = (inv.items && inv.items.length > 0)
          ? inv.items.map(it => ({
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
          : [{ ...DEFAULT_ITEM, unit_price: parseFloat(inv.subtotal) || 0, total: parseFloat(inv.total_amount) || 0 }]

        setInvoiceForm({
          invoice_number: inv.invoice_number,
          customer: inv.customer,
          customer_tax_number: inv.customer_tax_number || '',
          billing_address: inv.billing_address || '',
          job_order: inv.job_order || '',
          invoice_date: inv.invoice_date || '',
          due_date: inv.due_date || '',
          supply_date: inv.supply_date || inv.invoice_date || '',
          payment_terms: inv.payment_terms || 'Due on Receipt',
          status: inv.status || 'Issued',
          reference_number: inv.reference_number || '',
          bank_account: inv.bank_account || '',
          discount_amount: parseFloat(inv.discount_amount) || 0,
          salesperson: inv.created_by_staff || '',
          subject: '',
          notes: inv.notes || 'Thanks for your business. Please remit payment as per bank details below.',
          terms_conditions: inv.terms_conditions || 'All payments must be received by the stated due date. Tax Invoice subject to Saudi VAT regulations.',
          items: formattedItems,
          custom_fields: inv.custom_fields || {}
        })
      } else {
        const nextNum = await fetchNextInvoiceNumber()
        const defaultBank = bankList.find(b => b.status === 'Active') || bankList[0]
        const today = new Date().toISOString().split('T')[0]

        // Check query params in case navigated from estimate or quotation
        const urlParams = new URLSearchParams(window.location.search)
        const refParam = urlParams.get('ref') || urlParams.get('reference')
        const custParam = urlParams.get('customer')

        setInvoiceForm(prev => ({
          ...prev,
          invoice_number: nextNum,
          customer: custParam || prev.customer || '',
          reference_number: refParam || prev.reference_number || '',
          bank_account: defaultBank?.id || '',
          invoice_date: today,
          due_date: today,
          supply_date: today,
          payment_terms: 'Due on Receipt',
          status: 'Issued'
        }))
      }
    } catch (err) {
      console.error('Failed to load invoice builder data:', err)
      showError('Load Error', 'Failed to initialize invoice builder.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return customers.find(c => String(c.id) === String(invoiceForm.customer))
  }, [customers, invoiceForm.customer])

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
    if (!invoiceForm.customer) return []
    return jobOrders.filter(j =>
      String(j.customer) === String(invoiceForm.customer) ||
      String(j.customer_id) === String(invoiceForm.customer) ||
      String(j.client) === String(invoiceForm.customer) ||
      String(j.client_id) === String(invoiceForm.customer)
    )
  }, [jobOrders, invoiceForm.customer])

  // Handle customer selection
  const handleSelectCustomer = (c) => {
    setInvoiceForm(prev => ({
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
    setInvoiceForm(prev => {
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

    setInvoiceForm(prev => {
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
    setInvoiceForm(prev => ({
      ...prev,
      items: [...prev.items, { ...DEFAULT_ITEM }]
    }))
    setIsDirty(true)
  }

  const handleRemoveItem = (index) => {
    if (invoiceForm.items.length <= 1) {
      showToast('An invoice must have at least one line item', 'warning')
      return
    }
    setInvoiceForm(prev => ({
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

  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === dropIndex) return
    setInvoiceForm(prev => {
      const updated = [...prev.items]
      const [moved] = updated.splice(draggedIdx, 1)
      updated.splice(dropIndex, 0, moved)
      return { ...prev, items: updated }
    })
    setDraggedIdx(null)
    setIsDirty(true)
  }

  // Bulk Items Modal handlers
  const handleToggleBulkItem = (matId) => {
    setSelectedBulkItems(prev => {
      const next = { ...prev }
      if (next[matId]) {
        delete next[matId]
      } else {
        next[matId] = 1
      }
      return next
    })
  }

  const handleBulkQuantityChange = (matId, qty) => {
    const val = parseFloat(qty) || 1
    setSelectedBulkItems(prev => ({ ...prev, [matId]: val }))
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

    setInvoiceForm(prev => {
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

  // File Upload handling (Zoho: max 10 files, 10MB each)
  const handleFileUpload = (e) => {
    setFileError('')
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    if (attachments.length + files.length > 10) {
      setFileError('You can upload a maximum of 10 files.')
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
  const totals = useMemo(() => {
    let subtotal = 0
    let taxTotal = 0
    let totalQty = 0

    invoiceForm.items.forEach(it => {
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
      totalQty += qty
    })

    const overallDiscount = parseFloat(invoiceForm.discount_amount) || 0
    const finalSubtotal = Math.max(0, subtotal - overallDiscount)
    const effectiveVat = subtotal > 0 ? (taxTotal * (finalSubtotal / subtotal)) : 0
    const grandTotal = finalSubtotal + effectiveVat

    return {
      subtotal: Number(subtotal.toFixed(2)),
      overallDiscount,
      taxTotal: Number(effectiveVat.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2)),
      totalQty: Math.round(totalQty * 100) / 100
    }
  }, [invoiceForm.items, invoiceForm.discount_amount])

  // Quick Customer Creation
  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    if (!newCustomerForm.name.trim()) return
    try {
      setSubmittingCustomer(true)
      const res = await api.post('customers/', newCustomerForm)
      const created = res.data
      setCustomers(prev => [created, ...prev])
      setInvoiceForm(prev => ({
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
    navigate('/invoices')
  }

  // Save Invoice
  const handleSubmit = async (targetStatus) => {
    setFormError('')
    if (!invoiceForm.customer) {
      setFormError('Please select a customer.')
      showToast('Customer is required', 'warning')
      return
    }
    if (!invoiceForm.invoice_number.trim()) {
      setFormError('Invoice Number is required.')
      return
    }
    for (let i = 0; i < invoiceForm.items.length; i++) {
      if (!invoiceForm.items[i].description.trim()) {
        setFormError(`Item #${i + 1} requires a description.`)
        return
      }
    }

    const todayCheck = getTodayStr()
    if (invoiceForm.due_date && invoiceForm.due_date < todayCheck) {
      setFormError('Invoice due date cannot be before today.')
      return
    }
    if (invoiceForm.supply_date && invoiceForm.supply_date < todayCheck) {
      setFormError('Supply date cannot be before today.')
      return
    }

    const finalStatus = targetStatus || invoiceForm.status || 'Issued'

    // Prepare payload (Persistence Rule: salesperson, subject, attachments are UI-only and stripped)
    const payload = {
      invoice_number: invoiceForm.invoice_number.trim(),
      customer: invoiceForm.customer,
      customer_tax_number: invoiceForm.customer_tax_number || '',
      billing_address: invoiceForm.billing_address || '',
      job_order: invoiceForm.job_order || null, // Project Name
      invoice_date: invoiceForm.invoice_date,
      due_date: invoiceForm.due_date || null,
      supply_date: invoiceForm.supply_date || null,
      payment_terms: invoiceForm.payment_terms || 'Due on Receipt',
      status: finalStatus,
      reference_number: invoiceForm.reference_number || '', // Order Number
      bank_account: invoiceForm.bank_account || null, // Preserved loaded bank
      notes: invoiceForm.notes || '',
      terms_conditions: invoiceForm.terms_conditions || '',
      subtotal: totals.subtotal,
      tax_rate: 15,
      tax_amount: totals.taxTotal,
      total_amount: totals.grandTotal,
      discount_amount: totals.overallDiscount,
      items: invoiceForm.items.map((it, idx) => ({
        material: it.material || null,
        description: it.description || '',
        quantity: parseFloat(it.quantity) || 1,
        unit: it.unit || 'Unit',
        unit_price: parseFloat(it.unit_price) || 0,
        discount_rate: parseFloat(it.discount_rate) || 0,
        tax_rate: parseFloat(it.tax_rate) !== undefined ? parseFloat(it.tax_rate) : 15,
        tax_amount: parseFloat(it.tax_amount) || 0,
        total: parseFloat(it.total) || 0,
        sort_order: idx
      })),
      custom_fields: invoiceForm.custom_fields || {}
    }

    try {
      setSubmitting(true)
      if (isEditing) {
        await api.put(`invoices/${id}/`, payload)
        setIsDirty(false)
        showSuccess('Saved!', `Invoice ${invoiceForm.invoice_number} updated successfully.`)
        navigate('/invoices')
      } else {
        await api.post('invoices/', payload)
        setIsDirty(false)
        showSuccess('Created!', `Invoice ${invoiceForm.invoice_number} created successfully.`)
        navigate('/invoices')
      }
    } catch (err) {
      console.error('Submit error:', err)
      const data = err.response?.data
      let msg = 'Failed to save invoice. Please check fields.'
      if (typeof data === 'string') {
        msg = data
      } else if (data?.invoice_number) {
        msg = Array.isArray(data.invoice_number) ? data.invoice_number[0] : data.invoice_number
      } else if (data?.detail) {
        msg = data.detail
      }
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
            {isEditing ? `Edit Invoice ${invoiceForm.invoice_number}` : 'New Invoice'}
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
                            backgroundColor: String(invoiceForm.customer) === String(c.id) ? 'var(--bg-band, #F2F2F2)' : 'transparent',
                            transition: 'background 0.1s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-band, #F2F2F2)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = String(invoiceForm.customer) === String(c.id) ? 'var(--bg-band, #F2F2F2)' : 'transparent'}
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
                value={invoiceForm.billing_address}
                onChange={(e) => { setInvoiceForm(p => ({ ...p, billing_address: e.target.value })); setIsDirty(true); }}
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

        {/* ── SECTION B: INVOICE DETAILS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          
          {/* Invoice Number* */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Invoice#<span className="cred-required-dot" />
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '480px' }}>
              <input
                type="text"
                required
                value={invoiceForm.invoice_number}
                onChange={(e) => { setInvoiceForm(p => ({ ...p, invoice_number: e.target.value })); setIsDirty(true); }}
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
                  const num = await fetchNextInvoiceNumber()
                  setInvoiceForm(p => ({ ...p, invoice_number: num }))
                  setIsDirty(true)
                  showToast('Generated sequential invoice number', 'info')
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

          {/* Order Number (Reference#) */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Order Number
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <input
                type="text"
                placeholder="PO / Reference number"
                value={invoiceForm.reference_number}
                onChange={(e) => { setInvoiceForm(p => ({ ...p, reference_number: e.target.value })); setIsDirty(true); }}
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

          {/* Invoice Date*, Terms and Due Date (ON ONE ROW) */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Invoice Date<span className="cred-required-dot" />
            </label>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              maxWidth: '680px',
              flexWrap: 'wrap'
            }}>
              {/* Invoice Date */}
              <div style={{ flex: '1 1 140px', minWidth: '130px' }}>
                <input
                  type="date"
                  required
                  value={invoiceForm.invoice_date}
                  onChange={(e) => {
                    const newD = e.target.value
                    setInvoiceForm(p => ({
                      ...p,
                      invoice_date: newD,
                      due_date: calcDueDate(newD, p.payment_terms)
                    }))
                    setIsDirty(true)
                  }}
                  style={{
                    height: '38px',
                    width: '100%',
                    padding: '0 10px',
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

              {/* Terms Label + Select */}
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569', whiteSpace: 'nowrap' }}>
                Terms
              </span>
              <div style={{ flex: '1 1 130px', minWidth: '120px' }}>
                <select
                  className="cred-select"
                  value={invoiceForm.payment_terms}
                  onChange={(e) => {
                    const newTerms = e.target.value
                    setInvoiceForm(p => ({
                      ...p,
                      payment_terms: newTerms,
                      due_date: calcDueDate(p.invoice_date, newTerms)
                    }))
                    setIsDirty(true)
                  }}
                  style={{
                    height: '38px',
                    width: '100%',
                    lineHeight: 'normal',
                    fontSize: '13px',
                    borderRadius: '6px',
                    padding: '0 30px 0 10px',
                    border: '1px solid var(--border, #E4E4E4)',
                    backgroundColor: 'var(--card-bg, #ffffff)',
                    color: 'var(--text, #111111)',
                    boxSizing: 'border-box'
                  }}
                >
                  {PAYMENT_TERMS_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Due Date Label + Input */}
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569', whiteSpace: 'nowrap' }}>
                Due Date
              </span>
              <div style={{ flex: '1 1 140px', minWidth: '130px' }}>
                <input
                  type="date"
                  min={getTodayStr()}
                  value={invoiceForm.due_date}
                  onChange={(e) => {
                    const val = e.target.value
                    const todayStr = getTodayStr()
                    if (val && val < todayStr) return
                    setInvoiceForm(p => ({ ...p, due_date: val }))
                    setIsDirty(true)
                  }}
                  style={{
                    height: '38px',
                    width: '100%',
                    padding: '0 10px',
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

          {/* Supply Date / Service Period */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              Supply Date / Service Period
              <span title="Date the goods or services were supplied" style={{ color: 'var(--text-muted, #8C8C8C)', cursor: 'help', display: 'inline-flex' }}>
                <Info size={13} />
              </span>
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <input
                type="date"
                min={getTodayStr()}
                value={invoiceForm.supply_date}
                onChange={(e) => {
                  const val = e.target.value
                  const todayStr = getTodayStr()
                  if (val && val < todayStr) return
                  setInvoiceForm(p => ({ ...p, supply_date: val }))
                  setIsDirty(true)
                }}
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
                value={invoiceForm.salesperson}
                onChange={(e) => { setInvoiceForm(p => ({ ...p, salesperson: e.target.value })); setIsDirty(true); }}
                style={{
                  height: '38px',
                  width: '100%',
                  lineHeight: 'normal',
                  fontSize: '13px',
                  borderRadius: '6px',
                  padding: '0 32px 0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  color: invoiceForm.salesperson ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)',
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

          {/* Project Name (Replaces Job Order, disabled until customer chosen) */}
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
                disabled={!invoiceForm.customer}
                value={invoiceForm.job_order}
                onChange={(e) => { setInvoiceForm(p => ({ ...p, job_order: e.target.value })); setIsDirty(true); }}
                style={{
                  height: '38px',
                  width: '100%',
                  lineHeight: 'normal',
                  fontSize: '13px',
                  borderRadius: '6px',
                  padding: '0 32px 0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  backgroundColor: !invoiceForm.customer ? 'var(--bg-subtle, #F5F5F5)' : 'var(--card-bg, #ffffff)',
                  color: invoiceForm.job_order ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)',
                  cursor: !invoiceForm.customer ? 'not-allowed' : 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select a project</option>
                {customerProjects.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.order_id || `JOB-${j.id}`} - {j.title || 'Untitled Project'}
                  </option>
                ))}
                {invoiceForm.customer && customerProjects.length === 0 && (
                  <option value="" disabled>No projects found</option>
                )}
              </select>
              {!invoiceForm.customer && (
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #8C8C8C)', marginTop: '4px' }}>
                  Select a customer to associate a project.
                </div>
              )}
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
              <span title="Let your customer know what this Invoice is for" style={{ color: 'var(--text-muted, #8C8C8C)', cursor: 'help', display: 'inline-flex' }}>
                <Info size={13} />
              </span>
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <textarea
                rows={2}
                placeholder="Let your customer know what this Invoice is for"
                value={invoiceForm.subject}
                onChange={(e) => { setInvoiceForm(p => ({ ...p, subject: e.target.value })); setIsDirty(true); }}
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
                <col style={{ width: '32%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
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
                  <th style={{ padding: '10px 10px', textAlign: 'left', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Tax</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Amount</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {invoiceForm.items.map((item, idx) => (
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

                    {/* Tax (full text 15% VAT, never cut off) */}
                    <td style={{ padding: '16px 4px', verticalAlign: 'top' }}>
                      <select
                        className="cred-select"
                        value={item.tax_rate !== undefined ? item.tax_rate : 15}
                        onChange={(e) => handleItemChange(idx, 'tax_rate', e.target.value)}
                        style={{
                          width: '100%',
                          height: '36px',
                          lineHeight: 'normal',
                          fontSize: '13px',
                          borderRadius: '4px',
                          padding: '0 28px 0 10px',
                          border: '1px solid var(--border, #E4E4E4)',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          color: 'var(--text, #111111)',
                          boxSizing: 'border-box',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <option value={15}>15% VAT</option>
                        <option value={0}>0% VAT</option>
                      </select>
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
            {invoiceForm.items.map((item, idx) => (
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
                  <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>Discount: {item.discount_rate}% · 15% VAT</span>
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
                placeholder="Thanks for your business."
                value={invoiceForm.notes}
                onChange={(e) => { setInvoiceForm(p => ({ ...p, notes: e.target.value })); setIsDirty(true); }}
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
                Will be displayed on the invoice
              </div>
            </div>

            {/* Terms & Conditions (Auto-growing) */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                Terms & Conditions
              </label>
              <AutoGrowingTermsTextarea
                placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
                value={invoiceForm.terms_conditions}
                onChange={(e) => { setInvoiceForm(p => ({ ...p, terms_conditions: e.target.value })); setIsDirty(true); }}
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

            {/* Attach File(s) to Invoice */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>
                  Attach File(s) to Invoice
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
                  value={invoiceForm.discount_amount}
                  onChange={(e) => {
                    setInvoiceForm(p => ({ ...p, discount_amount: parseFloat(e.target.value) || 0 }))
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

              {/* VAT 15% */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                color: 'var(--text-muted, #8C8C8C)'
              }}>
                <span>VAT (15% KSA)</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatTabular(totals.taxTotal)}
                </span>
              </div>

              {/* Hairline Divider */}
              <div style={{ borderBottom: '1px solid var(--border, #E4E4E4)', margin: '4px 0' }} />

              {/* Total (SAR) */}
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

          {/* Right Actions: Cancel (ghost), Save as Draft (secondary), Save & Send (black pill) */}
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
                const issueStatus = (isEditing && invoiceForm.status && invoiceForm.status !== 'Draft') ? invoiceForm.status : 'Issued'
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
              <span>{submitting ? 'Saving…' : 'Save & Send'}</span>
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
            <input
              type="text"
              placeholder="Search materials by name, specs or category…"
              value={bulkSearch}
              onChange={(e) => setBulkSearch(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px 0 34px',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--text, #111111)',
                backgroundColor: 'var(--card-bg, #ffffff)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <Search size={15} style={{ position: 'absolute', left: '11px', top: '11px', color: 'var(--text-muted, #8C8C8C)' }} />
          </div>

          {/* Material items list */}
          <div style={{
            maxHeight: '340px',
            overflowY: 'auto',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '6px'
          }}>
            {filteredBulkMaterials.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted, #8C8C8C)', fontSize: '13px' }}>
                No materials found matching "{bulkSearch}".
              </div>
            ) : (
              filteredBulkMaterials.map(m => {
                const isSelected = Boolean(selectedBulkItems[m.id])
                const qty = selectedBulkItems[m.id] || 1
                return (
                  <div
                    key={m.id}
                    onClick={() => handleToggleBulkItem(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border, #E4E4E4)',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--bg-band, #F2F2F2)' : 'transparent',
                      transition: 'background 0.1s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Controlled by parent div click
                        style={{ cursor: 'pointer', accentColor: 'var(--text, #111111)' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text, #111111)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>
                          {m.measurements ? `${m.measurements} · ` : ''}{m.category_name || 'General'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <span style={{ fontSize: '13px', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--text, #111111)' }}>
                        {m.customer_price || m.unit_price} {currency}
                      </span>
                      {isSelected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>Qty:</span>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={qty}
                            onChange={(e) => handleBulkQuantityChange(m.id, e.target.value)}
                            style={{
                              width: '56px',
                              height: '28px',
                              textAlign: 'center',
                              fontSize: '12.5px',
                              border: '1px solid var(--border, #E4E4E4)',
                              borderRadius: '4px',
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

          {/* Action buttons inside modal */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>
              {Object.keys(selectedBulkItems).length} item(s) selected
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                style={{
                  height: '34px',
                  padding: '0 12px',
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
                type="button"
                onClick={handleAddBulkItemsToTable}
                style={{
                  height: '34px',
                  padding: '0 16px',
                  backgroundColor: 'var(--black, #0A0A0A)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Add Items to Table
              </button>
            </div>
          </div>
        </div>
      </ModalShell>

      {/* ── MODAL: QUICK NEW CUSTOMER ── */}
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
                value={newCustomerForm.name}
                onChange={(e) => setNewCustomerForm(p => ({ ...p, name: e.target.value }))}
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

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                Company Name
              </label>
              <input
                type="text"
                value={newCustomerForm.company_name}
                onChange={(e) => setNewCustomerForm(p => ({ ...p, company_name: e.target.value }))}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                  Phone
                </label>
                <input
                  type="text"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm(p => ({ ...p, phone: e.target.value }))}
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

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm(p => ({ ...p, email: e.target.value }))}
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

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                Billing Address
              </label>
              <textarea
                rows={2}
                value={newCustomerForm.address}
                onChange={(e) => setNewCustomerForm(p => ({ ...p, address: e.target.value }))}
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
                padding: '0 18px',
                backgroundColor: 'var(--black, #0A0A0A)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: submittingCustomer ? 'not-allowed' : 'pointer'
              }}
            >
              {submittingCustomer ? 'Saving…' : 'Create & Select'}
            </button>
          </div>
        </form>
      </ModalShell>

    </div>
  )
}

export default InvoiceBuilder
