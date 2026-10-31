import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  X, Plus, Trash2, Upload, Search, Settings,
  AlertCircle, Check, Paperclip, ChevronDown
} from 'lucide-react'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import Modal from '../components/common/Modal'
import { showError, showToast, showSuccess } from '../utils/swal'

const CHALLAN_TYPES = [
  'Supply of Goods',
  'Job Work',
  'Supply on Approval',
  'Others'
]

const TAX_OPTIONS = [
  { label: 'Select a Tax', rate: 0 },
  { label: '15% Standard Rate', rate: 0.15 },
  { label: '0% Zero Rate', rate: 0 },
  { label: '5% VAT', rate: 0.05 },
  { label: 'Exempt (0%)', rate: 0 }
]

const DEFAULT_ITEM = {
  name: '',
  description: '',
  quantity: 1.00,
  rate: 0.00,
  discount: 0,
  discount_type: '%',
  tax_rate: 0,
  tax_label: 'Select a Tax',
  amount: 0.00,
  unit: 'Unit'
}

// Calculate individual item amount
const calculateItemAmount = (item) => {
  const qty = parseFloat(item.quantity) || 0
  const rate = parseFloat(item.rate) || 0
  const discountVal = parseFloat(item.discount) || 0
  const rawTotal = qty * rate

  let discountAmt = 0
  if (item.discount_type === '%') {
    discountAmt = (rawTotal * discountVal) / 100
  } else {
    discountAmt = Math.min(discountVal, rawTotal)
  }
  discountAmt = Math.max(0, discountAmt)

  const taxable = Math.max(0, rawTotal - discountAmt)
  const taxRate = parseFloat(item.tax_rate) || 0
  const taxAmt = taxable * taxRate

  return Number((taxable + taxAmt).toFixed(2))
}

// Format numbers in tabular CRED style
const formatTabular = (num) => {
  const val = parseFloat(num) || 0
  const parts = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {parts[0]}<span style={{ opacity: 0.55, fontSize: '0.85em' }}>.{parts[1]}</span>
    </span>
  )
}

const DeliveryNoteBuilder = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Lookups
  const [customers, setCustomers] = useState([])
  const [materials, setMaterials] = useState([])

  // Customer dropdown search
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
  const [selectedBulkMaterials, setSelectedBulkMaterials] = useState([])

  // Main Form State
  const [form, setForm] = useState({
    delivery_note_number: '',
    customer: '',
    reference_number: '',
    delivery_date: new Date().toISOString().split('T')[0],
    challan_type: 'Supply of Goods',
    notes: '',
    terms_conditions: '',
    status: 'Delivered',
    // Background / silent fallback defaults
    job_order: null,
    invoice: null,
    delivery_address: '',
    total_packages: 1,
    shipping_method: 'Supply of Goods',
    driver_name: '',
    driver_phone: '',
    vehicle_number: '',
    tracking_number: '',
    custom_fields: {},
    items: [{ ...DEFAULT_ITEM }]
  })

  // Attached files state
  const [attachments, setAttachments] = useState([])
  const [fileError, setFileError] = useState('')
  const fileInputRef = useRef(null)

  // Item dropdown suggestions state
  const [activeItemDropdownIdx, setActiveItemDropdownIdx] = useState(null)

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

  const fetchNextDeliveryNoteNumber = async () => {
    try {
      const res = await api.get('delivery-notes/next-number/')
      return res.data?.next_number || `DC-${String(new Date().getFullYear()).slice(-2)}001`
    } catch {
      return `DC-${new Date().getFullYear()}-0001`
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const toArr = (d) => Array.isArray(d) ? d : (d?.results || [])
      const [cRes, mRes] = await Promise.all([
        api.get('customers/?page_size=1000').catch(() => ({ data: [] })),
        api.get('materials/').catch(() => ({ data: [] }))
      ])

      const custList = toArr(cRes.data)
      const matList = toArr(mRes.data)
      setCustomers(custList)
      setMaterials(matList)

      if (isEditing) {
        const { data: dn } = await api.get(`delivery-notes/${id}/`)

        // Format items: either from custom_fields.items_data or legacy items
        let formattedItems = [{ ...DEFAULT_ITEM }]
        if (Array.isArray(dn.custom_fields?.items_data) && dn.custom_fields.items_data.length > 0) {
          formattedItems = dn.custom_fields.items_data.map(it => ({
            id: it.id,
            name: it.name || '',
            description: it.description || '',
            quantity: parseFloat(it.quantity) || 1,
            rate: parseFloat(it.rate) || 0,
            discount: parseFloat(it.discount) || 0,
            discount_type: it.discount_type || '%',
            tax_rate: it.tax_rate ?? 0,
            tax_label: it.tax_label || (it.tax_rate === 0.15 ? '15% Standard Rate' : (it.tax_rate === 0.05 ? '5% VAT' : 'Select a Tax')),
            amount: parseFloat(it.amount) || calculateItemAmount(it),
            unit: it.unit || 'Unit'
          }))
        } else if (Array.isArray(dn.items) && dn.items.length > 0) {
          formattedItems = dn.items.map(it => {
            const rawItem = {
              id: it.id,
              name: it.description || '',
              description: '',
              quantity: parseFloat(it.quantity) || 1,
              rate: parseFloat(it.unit_price) || 0,
              discount: 0,
              discount_type: '%',
              tax_rate: 0,
              tax_label: 'Select a Tax',
              unit: it.unit || 'Unit'
            }
            return {
              ...rawItem,
              amount: parseFloat(it.total) || calculateItemAmount(rawItem)
            }
          })
        }

        setForm({
          delivery_note_number: dn.delivery_note_number || '',
          customer: dn.customer || '',
          reference_number: dn.reference_number || dn.customer_po_number || '',
          delivery_date: dn.delivery_date || new Date().toISOString().split('T')[0],
          challan_type: dn.custom_fields?.challan_type || dn.shipping_method || 'Supply of Goods',
          notes: dn.notes || '',
          terms_conditions: dn.terms_conditions || '',
          status: dn.status || 'Delivered',
          job_order: dn.job_order || null,
          invoice: dn.invoice || null,
          delivery_address: dn.delivery_address || '',
          total_packages: dn.total_packages || 1,
          shipping_method: dn.shipping_method || 'Supply of Goods',
          driver_name: dn.driver_name || '',
          driver_phone: dn.driver_phone || '',
          vehicle_number: dn.vehicle_number || '',
          tracking_number: dn.tracking_number || '',
          custom_fields: dn.custom_fields || {},
          items: formattedItems
        })

        if (Array.isArray(dn.custom_fields?.attachments)) {
          setAttachments(dn.custom_fields.attachments)
        }
      } else {
        const nextNum = await fetchNextDeliveryNoteNumber()
        setForm(prev => ({
          ...prev,
          delivery_note_number: nextNum
        }))
      }
    } catch (err) {
      console.error('Failed to load delivery note builder:', err)
      showError('Load Error', 'Failed to initialize delivery note builder.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return customers.find(c => String(c.id) === String(form.customer)) || null
  }, [customers, form.customer])

  // Filtered customer list for combobox
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.company_name && c.company_name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    )
  }, [customers, customerSearch])

  // Select a customer
  const handleSelectCustomer = (cust) => {
    setForm(prev => ({
      ...prev,
      customer: cust.id,
      delivery_address: cust.address || prev.delivery_address || ''
    }))
    setCustomerSearch('')
    setIsCustomerDropdownOpen(false)
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
      setForm(prev => ({
        ...prev,
        customer: created.id,
        delivery_address: created.address || ''
      }))
      setIsCustomerModalOpen(false)
      setNewCustomerForm({ name: '', company_name: '', phone: '', email: '', address: '' })
      showToast('Customer created and selected', 'success')
    } catch {
      showError('Failed', 'Could not create customer.')
    } finally {
      setSubmittingCustomer(false)
    }
  }

  // Line item handlers
  const handleItemChange = (index, field, value) => {
    setForm(prev => {
      const items = [...prev.items]
      const current = { ...items[index], [field]: value }

      // If tax rate changed via tax dropdown
      if (field === 'tax_label') {
        const found = TAX_OPTIONS.find(t => t.label === value)
        current.tax_rate = found ? found.rate : 0
      }

      current.amount = calculateItemAmount(current)
      items[index] = current
      return { ...prev, items }
    })
  }

  const handleSelectMaterialForItem = (index, material) => {
    setForm(prev => {
      const items = [...prev.items]
      const current = {
        ...items[index],
        name: material.name + (material.measurements ? ` (${material.measurements})` : ''),
        rate: parseFloat(material.customer_price) || parseFloat(material.unit_price) || 0,
        unit: material.unit || items[index].unit || 'Unit'
      }
      current.amount = calculateItemAmount(current)
      items[index] = current
      return { ...prev, items }
    })
    setActiveItemDropdownIdx(null)
  }

  const handleAddItemRow = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { ...DEFAULT_ITEM }]
    }))
  }

  const handleRemoveItemRow = (index) => {
    if (form.items.length <= 1) {
      showToast('Delivery note must have at least one line item', 'warning')
      return
    }
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  // Bulk items modal logic
  const filteredBulkMaterials = useMemo(() => {
    const q = bulkSearch.trim().toLowerCase()
    if (!q) return materials
    return materials.filter(m =>
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.measurements && m.measurements.toLowerCase().includes(q)) ||
      (m.category && m.category.toLowerCase().includes(q))
    )
  }, [materials, bulkSearch])

  const handleToggleBulkMaterial = (matId) => {
    setSelectedBulkMaterials(prev =>
      prev.includes(matId) ? prev.filter(id => id !== matId) : [...prev, matId]
    )
  }

  const handleAddBulkToTable = () => {
    if (selectedBulkMaterials.length === 0) {
      setIsBulkModalOpen(false)
      return
    }

    const selectedObjs = materials.filter(m => selectedBulkMaterials.includes(m.id))
    const newRows = selectedObjs.map(m => {
      const it = {
        ...DEFAULT_ITEM,
        name: m.name + (m.measurements ? ` (${m.measurements})` : ''),
        rate: parseFloat(m.customer_price) || parseFloat(m.unit_price) || 0,
        unit: m.unit || 'Unit'
      }
      it.amount = calculateItemAmount(it)
      return it
    })

    setForm(prev => {
      // If the first row is totally blank, replace it
      const hasEmptyFirstRow = prev.items.length === 1 && !prev.items[0].name.trim() && prev.items[0].rate === 0
      const baseItems = hasEmptyFirstRow ? [] : prev.items
      return {
        ...prev,
        items: [...baseItems, ...newRows]
      }
    })

    setSelectedBulkMaterials([])
    setBulkSearch('')
    setIsBulkModalOpen(false)
    showToast(`Added ${newRows.length} items to table`, 'success')
  }

  // Calculations for summary block
  const totals = useMemo(() => {
    let subTotal = 0
    let totalDiscount = 0
    let totalTax = 0

    form.items.forEach(it => {
      const qty = parseFloat(it.quantity) || 0
      const rate = parseFloat(it.rate) || 0
      const raw = qty * rate
      subTotal += raw

      const d = parseFloat(it.discount) || 0
      const discountAmt = it.discount_type === '%' ? (raw * d) / 100 : Math.min(d, raw)
      totalDiscount += Math.max(0, discountAmt)

      const taxable = Math.max(0, raw - discountAmt)
      const tr = parseFloat(it.tax_rate) || 0
      totalTax += (taxable * tr)
    })

    const grandTotal = Math.max(0, subTotal - totalDiscount) + totalTax

    return {
      subTotal: Number(subTotal.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      totalTax: Number(totalTax.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2))
    }
  }, [form.items])

  // File Upload Handlers
  const handleFileUpload = (e) => {
    setFileError('')
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    if (attachments.length + files.length > 5) {
      setFileError('You can upload a maximum of 5 files.')
      return
    }

    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    for (const f of files) {
      if (f.size > MAX_SIZE) {
        setFileError(`"${f.name}" exceeds the 10MB limit.`)
        return
      }
    }

    const newAttachments = files.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      lastModified: f.lastModified
    }))

    setAttachments(prev => [...prev, ...newAttachments])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  // Submission handler
  const handleSubmit = async (targetStatus) => {
    setFormError('')
    if (!form.customer) {
      setFormError('Please select or add a customer.')
      showToast('Customer is required', 'warning')
      return
    }
    if (!form.delivery_note_number.trim()) {
      setFormError('Delivery Note Number is required.')
      showToast('Delivery Note # is required', 'warning')
      return
    }

    const finalStatus = targetStatus || form.status || 'Delivered'

    const payload = {
      delivery_note_number: form.delivery_note_number.trim(),
      customer: form.customer,
      reference_number: form.reference_number || '',
      delivery_date: form.delivery_date,
      dispatch_date: form.delivery_date,
      status: finalStatus,
      total_packages: 1,
      shipping_method: form.challan_type || 'Supply of Goods',
      delivery_address: selectedCustomer?.address || form.delivery_address || '',
      driver_name: form.driver_name || '',
      vehicle_number: form.vehicle_number || '',
      tracking_number: form.tracking_number || '',
      show_prices: true,
      notes: form.notes || '',
      terms_conditions: form.terms_conditions || '',
      job_order: form.job_order || null,
      invoice: form.invoice || null,
      items: form.items.map((it, idx) => {
        const fullDesc = it.name.trim()
          ? (it.description.trim() ? `${it.name.trim()} - ${it.description.trim()}` : it.name.trim())
          : (it.description.trim() || 'Item')

        return {
          id: it.id,
          description: fullDesc,
          quantity: parseFloat(it.quantity) || 1,
          unit: it.unit || 'Unit',
          packages_count: '1',
          package_type: 'Carton',
          unit_price: parseFloat(it.rate) || 0,
          total: parseFloat(it.amount) || 0,
          remarks: '',
          sort_order: idx
        }
      }),
      custom_fields: {
        ...(form.custom_fields || {}),
        challan_type: form.challan_type,
        items_data: form.items.map(it => ({
          id: it.id,
          name: it.name || '',
          description: it.description || '',
          quantity: parseFloat(it.quantity) || 1,
          rate: parseFloat(it.rate) || 0,
          discount: parseFloat(it.discount) || 0,
          discount_type: it.discount_type || '%',
          tax_rate: parseFloat(it.tax_rate) || 0,
          tax_label: it.tax_label || 'Select a Tax',
          amount: parseFloat(it.amount) || 0,
          unit: it.unit || 'Unit'
        })),
        sub_total: totals.subTotal,
        total_discount: totals.totalDiscount,
        total_tax: totals.totalTax,
        total_amount: totals.grandTotal,
        attachments: attachments
      }
    }

    try {
      setSubmitting(true)
      if (isEditing) {
        await api.put(`delivery-notes/${id}/`, payload)
        showSuccess('Saved!', `Delivery Note ${form.delivery_note_number} updated.`)
        navigate('/delivery-notes')
      } else {
        await api.post('delivery-notes/', payload)
        showSuccess('Created!', `Delivery Note ${form.delivery_note_number} created successfully.`)
        navigate('/delivery-notes')
      }
    } catch (err) {
      console.error('Submit error:', err)
      const msg = err.response?.data?.delivery_note_number?.[0] ||
        err.response?.data?.detail ||
        'Failed to save delivery note.'
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
      {/* Outer Centered Shell */}
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '24px 24px 100px',
        boxSizing: 'border-box'
      }}>

        {/* Page Title & Close Header */}
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
            {isEditing ? `Edit Delivery Note ${form.delivery_note_number}` : 'New Delivery Challan'}
          </h1>

          <button
            type="button"
            onClick={() => navigate('/delivery-notes')}
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

        {/* TOP SECTION: Zoho Two-Column Form Style */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginBottom: '36px'
        }}>

          {/* Row 1: Customer Name* */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              paddingTop: '9px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Customer Name<span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
            </label>

            <div ref={customerDropdownRef} style={{ position: 'relative', width: '100%', maxWidth: '480px' }}>
              <div
                onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                style={{
                  height: '38px',
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
                    <span>+ New Customer</span>
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

          {/* Row 2: Delivery Note #* */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Delivery Challan#<span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '480px' }}>
              <input
                type="text"
                required
                value={form.delivery_note_number}
                onChange={(e) => setForm(p => ({ ...p, delivery_note_number: e.target.value }))}
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

          {/* Row 3: Reference# */}
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
                placeholder=""
                value={form.reference_number}
                onChange={(e) => setForm(p => ({ ...p, reference_number: e.target.value }))}
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

          {/* Row 4: Delivery Note Date* */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Delivery Challan Date<span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <input
                type="date"
                required
                value={form.delivery_date}
                onChange={(e) => setForm(p => ({ ...p, delivery_date: e.target.value }))}
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

          {/* Row 5: Challan Type* */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569'
            }}>
              Challan Type<span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <select
                value={form.challan_type}
                onChange={(e) => setForm(p => ({ ...p, challan_type: e.target.value }))}
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
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                {CHALLAN_TYPES.map(ct => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ITEM TABLE SECTION */}
        <div style={{ marginTop: '36px', marginBottom: '28px' }}>
          {/* Header Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text, #111111)'
            }}>
              Item Table
            </h2>

            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px'
              }}
            >
              <span>+ Add Items in Bulk</span>
            </button>
          </div>

          {/* Table Container */}
          <div style={{
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '6px',
            overflow: 'visible',
            backgroundColor: 'var(--card-bg, #ffffff)'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              textAlign: 'left'
            }}>
              <thead>
                <tr style={{
                  backgroundColor: 'var(--bg-band, #F2F2F2)',
                  borderBottom: '1px solid var(--border, #E4E4E4)',
                  color: 'var(--text-muted, #8C8C8C)',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  <th style={{ padding: '10px 14px', width: '38%' }}>Item Details</th>
                  <th style={{ padding: '10px 12px', width: '12%' }}>Quantity</th>
                  <th style={{ padding: '10px 12px', width: '13%' }}>Rate</th>
                  <th style={{ padding: '10px 12px', width: '15%' }}>Discount</th>
                  <th style={{ padding: '10px 12px', width: '12%' }}>Tax</th>
                  <th style={{ padding: '10px 14px', width: '10%', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '10px 8px', width: '36px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: idx === form.items.length - 1 ? 'none' : '1px solid var(--border, #E4E4E4)',
                      verticalAlign: 'top'
                    }}
                  >
                    {/* Item Details */}
                    <td style={{ padding: '12px 14px', position: 'relative' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder="Type or click to select an item."
                          value={item.name}
                          onChange={(e) => {
                            handleItemChange(idx, 'name', e.target.value)
                            setActiveItemDropdownIdx(idx)
                          }}
                          onFocus={() => setActiveItemDropdownIdx(idx)}
                          style={{
                            width: '100%',
                            height: '34px',
                            padding: '0 10px',
                            border: '1px solid var(--border, #E4E4E4)',
                            borderRadius: '4px',
                            fontSize: '13px',
                            color: 'var(--text, #111111)',
                            backgroundColor: 'var(--card-bg, #ffffff)',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />

                        {/* Dropdown Suggestions for Material */}
                        {activeItemDropdownIdx === idx && materials.length > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '48px',
                              left: '14px',
                              width: 'calc(100% - 28px)',
                              maxHeight: '200px',
                              overflowY: 'auto',
                              backgroundColor: 'var(--card-bg, #ffffff)',
                              border: '1px solid var(--border, #E4E4E4)',
                              borderRadius: '6px',
                              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                              zIndex: 300,
                              padding: '4px'
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '4px 8px',
                              borderBottom: '1px solid var(--border, #E4E4E4)',
                              fontSize: '11px',
                              color: 'var(--text-muted, #8C8C8C)'
                            }}>
                              <span>Price Chart Materials</span>
                              <button
                                type="button"
                                onClick={() => setActiveItemDropdownIdx(null)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted, #8C8C8C)', cursor: 'pointer', padding: 0 }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                            {materials
                              .filter(m => !item.name || m.name.toLowerCase().includes(item.name.toLowerCase()))
                              .slice(0, 15)
                              .map(m => (
                                <div
                                  key={m.id}
                                  onClick={() => handleSelectMaterialForItem(idx, m)}
                                  style={{
                                    padding: '6px 8px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-band, #F2F2F2)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <div>
                                    <span style={{ fontWeight: 500, color: 'var(--text, #111111)' }}>{m.name}</span>
                                    {m.measurements && <span style={{ color: 'var(--text-muted, #8C8C8C)', marginLeft: '4px' }}>({m.measurements})</span>}
                                  </div>
                                  <div style={{ color: 'var(--text-muted, #8C8C8C)', fontVariantNumeric: 'tabular-nums' }}>
                                    {m.customer_price || m.unit_price ? `${m.customer_price || m.unit_price} SAR` : ''}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}

                        <input
                          type="text"
                          placeholder="Add a description"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          style={{
                            width: '100%',
                            height: '28px',
                            padding: '0 8px',
                            border: '1px solid transparent',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: 'var(--text-muted, #8C8C8C)',
                            backgroundColor: 'transparent',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border, #E4E4E4)'
                            e.currentTarget.style.backgroundColor = 'var(--bg-band, #F2F2F2)'
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'transparent'
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        />
                      </div>
                    </td>

                    {/* Quantity */}
                    <td style={{ padding: '12px 12px' }}>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        style={{
                          width: '100%',
                          height: '34px',
                          padding: '0 8px',
                          border: '1px solid var(--border, #E4E4E4)',
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--text, #111111)',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </td>

                    {/* Rate */}
                    <td style={{ padding: '12px 12px' }}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.rate}
                        onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                        style={{
                          width: '100%',
                          height: '34px',
                          padding: '0 8px',
                          border: '1px solid var(--border, #E4E4E4)',
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--text, #111111)',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </td>

                    {/* Discount (% / SAR) */}
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.discount}
                          onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                          style={{
                            width: '100%',
                            height: '34px',
                            padding: '0 6px',
                            border: '1px solid var(--border, #E4E4E4)',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--text, #111111)',
                            backgroundColor: 'var(--card-bg, #ffffff)',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleItemChange(idx, 'discount_type', item.discount_type === '%' ? 'SAR' : '%')}
                          title="Toggle Discount Type"
                          style={{
                            height: '34px',
                            padding: '0 8px',
                            border: '1px solid var(--border, #E4E4E4)',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-band, #F2F2F2)',
                            color: 'var(--text, #111111)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                        >
                          {item.discount_type}
                        </button>
                      </div>
                    </td>

                    {/* Tax */}
                    <td style={{ padding: '12px 12px' }}>
                      <select
                        value={item.tax_label}
                        onChange={(e) => handleItemChange(idx, 'tax_label', e.target.value)}
                        style={{
                          width: '100%',
                          height: '34px',
                          padding: '0 6px',
                          border: '1px solid var(--border, #E4E4E4)',
                          borderRadius: '4px',
                          fontSize: '12.5px',
                          color: 'var(--text, #111111)',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          outline: 'none',
                          cursor: 'pointer',
                          boxSizing: 'border-box'
                        }}
                      >
                        {TAX_OPTIONS.map(to => (
                          <option key={to.label} value={to.label}>{to.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* Amount */}
                    <td style={{
                      padding: '18px 14px 12px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 400,
                      color: 'var(--text, #111111)'
                    }}>
                      {formatTabular(item.amount)}
                    </td>

                    {/* Row Delete */}
                    <td style={{ padding: '16px 8px 12px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        title="Delete Row"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          cursor: 'pointer',
                          color: 'var(--text-muted, #8C8C8C)',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Buttons below table */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginTop: '12px'
          }}>
            <button
              type="button"
              onClick={handleAddItemRow}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 0'
              }}
            >
              <Plus size={14} />
              <span>+ Add New Row</span>
            </button>
          </div>
        </div>

        {/* BOTTOM SECTION: Zoho Two-Column Layout */}
        <div className="zoho-bottom-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: '40px',
          marginTop: '36px'
        }}>

          {/* Left Column: Customer Notes, Terms, File Upload */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Customer Notes */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#475569',
                marginBottom: '6px'
              }}>
                Customer Notes
              </label>
              <textarea
                rows={3}
                placeholder="Enter any notes to be displayed in your transaction"
                value={form.notes}
                onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
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

            {/* Terms & Conditions */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#475569',
                marginBottom: '6px'
              }}>
                Terms & Conditions
              </label>
              <textarea
                rows={3}
                placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
                value={form.terms_conditions}
                onChange={(e) => setForm(p => ({ ...p, terms_conditions: e.target.value }))}
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

            {/* Attach File(s) */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#475569',
                marginBottom: '8px'
              }}>
                Attach File(s) to Delivery Challan
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

              {/* Uploaded Files List */}
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
                  {formatTabular(totals.subTotal)}
                </span>
              </div>

              {/* Discount if present */}
              {totals.totalDiscount > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                  color: 'var(--text-muted, #8C8C8C)'
                }}>
                  <span>Discount</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    - {formatTabular(totals.totalDiscount)}
                  </span>
                </div>
              )}

              {/* Tax if present */}
              {totals.totalTax > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                  color: 'var(--text-muted, #8C8C8C)'
                }}>
                  <span>Tax (VAT)</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    + {formatTabular(totals.totalTax)}
                  </span>
                </div>
              )}

              {/* Divider */}
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
                  {formatTabular(totals.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* FOOTER BAR (Sticky at bottom) */}
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
          justifyContent: 'space-between'
        }}>
          {/* Left Buttons: Save as Draft & Cancel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              onClick={() => navigate('/delivery-notes')}
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
          </div>

          {/* Right Button: Primary Save (Black Pill) */}
          <div>
            <button
              type="button"
              onClick={() => handleSubmit('Delivered')}
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
              onMouseEnter={(e) => {
                if (!submitting) e.currentTarget.style.opacity = '0.9'
              }}
              onMouseLeave={(e) => {
                if (!submitting) e.currentTarget.style.opacity = '1'
              }}
            >
              {submitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>{isEditing ? 'Save Changes' : 'Save'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* QUICK CUSTOMER MODAL */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Add New Customer"
      >
        <form onSubmit={handleCreateCustomer}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: '#475569', marginBottom: '4px' }}>
              Customer Name<span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={newCustomerForm.name}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, name: e.target.value }))}
              style={{
                width: '100%',
                height: '36px',
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

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: '#475569', marginBottom: '4px' }}>
              Company Name
            </label>
            <input
              type="text"
              value={newCustomerForm.company_name}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, company_name: e.target.value }))}
              style={{
                width: '100%',
                height: '36px',
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

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: '#475569', marginBottom: '4px' }}>
              Phone Number
            </label>
            <input
              type="text"
              value={newCustomerForm.phone}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, phone: e.target.value }))}
              style={{
                width: '100%',
                height: '36px',
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

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: '#475569', marginBottom: '4px' }}>
              Delivery / Billing Address
            </label>
            <textarea
              rows={2}
              value={newCustomerForm.address}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, address: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--text, #111111)',
                backgroundColor: 'var(--card-bg, #ffffff)',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(false)}
              style={{
                height: '34px',
                padding: '0 14px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '6px',
                fontSize: '12.5px',
                color: 'var(--text, #111111)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingCustomer}
              style={{
                height: '34px',
                padding: '0 18px',
                backgroundColor: 'var(--black, #0A0A0A)',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 500,
                color: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              {submittingCustomer ? 'Saving...' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* BULK MATERIALS MODAL */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Add Items in Bulk"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

          {/* List of items */}
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
                const isChecked = selectedBulkMaterials.includes(m.id)
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
                      backgroundColor: isChecked ? 'var(--bg-band, #F2F2F2)' : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by row click
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

                    <div style={{ fontSize: '13px', fontVariantNumeric: 'tabular-nums', color: 'var(--text, #111111)' }}>
                      {m.customer_price || m.unit_price ? `${m.customer_price || m.unit_price} SAR` : ''}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>
              {selectedBulkMaterials.length} item(s) selected
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  color: 'var(--text, #111111)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddBulkToTable}
                style={{
                  height: '34px',
                  padding: '0 18px',
                  backgroundColor: 'var(--black, #0A0A0A)',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  color: '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                Add Selected Items
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Responsive Breakpoint Styles */}
      <style>{`
        @media (max-width: 768px) {
          .zoho-form-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 6px !important;
          }
          .zoho-form-row > label {
            width: 100% !important;
            padding-top: 0 !important;
          }
          .zoho-form-row > div {
            max-width: 100% !important;
          }
          .zoho-bottom-grid {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
        }
      `}</style>
    </div>
  )
}

export default DeliveryNoteBuilder
