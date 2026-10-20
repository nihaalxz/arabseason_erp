import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, RotateCcw,
  AlertCircle, Download, Check, Info, FileText, RefreshCw
} from 'lucide-react'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import DynamicCustomFields from '../components/common/DynamicCustomFields'
import Modal from '../components/common/Modal'
import { useSettings } from '../contexts/SettingsContext'
import { showError, showToast, showSuccess } from '../utils/swal'
import { handlePdfResponse } from '../utils/pdfDownload'

const STATUS_CHOICES = ['Draft', 'Issued', 'Applied', 'Refunded', 'Cancelled']
const REASON_CHOICES = [
  'Sales Return',
  'Overbilled / Pricing Error',
  'Defective / Damaged Goods',
  'Service Cancellation',
  'Goodwill / Rebate',
  'Other'
]
const UNIT_OPTIONS = ['Unit', 'Pcs', 'Hours', 'Days', 'Lot', 'Sq. M', 'Kg', 'Service', 'm', 'Roll', 'Box']
const DEFAULT_ITEM = { description: '', quantity: 1, unit: 'Unit', unit_price: 0, discount_rate: 0, tax_rate: 15, tax_amount: 0, total: 0 }

const ZohoLabel = ({ children, required, hint }) => (
  <label style={{
    fontSize: '13px',
    fontWeight: '500',
    color: '#334155',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  }}>
    {children}
    {required && <span style={{ color: '#ef4444', fontWeight: '700' }}>*</span>}
    {hint && (
      <span title={hint} style={{ color: '#94a3b8', cursor: 'help', display: 'inline-flex' }}>
        <Info size={13} />
      </span>
    )}
  </label>
)

const CreditNoteBuilder = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const { settings, formatCurrency } = useSettings()
  const currency = settings?.currency || 'SAR'

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [customers, setCustomers] = useState([])
  const [invoices, setInvoices] = useState([])
  const [materials, setMaterials] = useState([])
  const [formError, setFormError] = useState('')

  const [form, setForm] = useState({
    credit_note_number: '',
    customer: '',
    invoice: '',
    credit_note_date: new Date().toISOString().split('T')[0],
    credit_reason: 'Sales Return',
    status: 'Issued',
    reference_number: '',
    customer_tax_number: '',
    billing_address: '',
    discount_amount: 0,
    notes: 'Credit note issued against returned / adjusted items.',
    terms_conditions: 'This credit amount will be applied to outstanding balances or refunded as agreed.',
    items: [{ ...DEFAULT_ITEM }],
    custom_fields: {}
  })

  // Quick Customer Creation
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', company_name: '', phone: '', email: '', address: '' })
  const [submittingCustomer, setSubmittingCustomer] = useState(false)

  useEffect(() => {
    fetchData()
  }, [id])

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
      const [cRes, iRes, mRes] = await Promise.all([
        api.get('customers/?page_size=1000').catch(() => ({ data: [] })),
        api.get('invoices/?page_size=1000').catch(() => ({ data: [] })),
        api.get('materials/').catch(() => ({ data: [] }))
      ])

      const custList = toArr(cRes.data)
      const invList = toArr(iRes.data)
      const matList = toArr(mRes.data)
      setCustomers(custList)
      setInvoices(invList)
      setMaterials(matList)

      if (isEditing) {
        const { data: cn } = await api.get(`credit-notes/${id}/`)
        const formattedItems = (cn.items && cn.items.length > 0)
          ? cn.items.map(it => ({
              id: it.id,
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

        setForm({
          credit_note_number: cn.credit_note_number,
          customer: cn.customer,
          invoice: cn.invoice || '',
          credit_note_date: cn.credit_note_date || '',
          credit_reason: cn.credit_reason || 'Sales Return',
          status: cn.status || 'Issued',
          reference_number: cn.reference_number || '',
          customer_tax_number: cn.customer_tax_number || '',
          billing_address: cn.billing_address || '',
          discount_amount: parseFloat(cn.discount_amount) || 0,
          notes: cn.notes || '',
          terms_conditions: cn.terms_conditions || '',
          items: formattedItems,
          custom_fields: cn.custom_fields || {}
        })
      } else {
        const nextNum = await fetchNextCreditNoteNumber()
        setForm(prev => ({
          ...prev,
          credit_note_number: nextNum
        }))
      }
    } catch (err) {
      console.error('Failed to load credit note builder:', err)
      showError('Load Error', 'Failed to initialize credit note builder.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Customer Selection
  const handleCustomerChange = (customerId) => {
    const cust = customers.find(c => String(c.id) === String(customerId))
    setForm(prev => ({
      ...prev,
      customer: customerId,
      customer_tax_number: cust?.tax_number || prev.customer_tax_number || '',
      billing_address: cust?.address || prev.billing_address || ''
    }))
  }

  // Handle Linked Invoice Selection (auto populate items!)
  const handleInvoiceChange = (invId) => {
    const inv = invoices.find(i => String(i.id) === String(invId))
    if (!inv) {
      setForm(prev => ({ ...prev, invoice: '' }))
      return
    }

    const itemsFromInvoice = (inv.items && inv.items.length > 0)
      ? inv.items.map(it => ({
          description: it.description,
          quantity: parseFloat(it.quantity) || 1,
          unit: it.unit || 'Unit',
          unit_price: parseFloat(it.unit_price) || 0,
          discount_rate: parseFloat(it.discount_rate) || 0,
          tax_rate: parseFloat(it.tax_rate) !== undefined ? parseFloat(it.tax_rate) : 15,
          tax_amount: parseFloat(it.tax_amount) || 0,
          total: parseFloat(it.total) || 0
        }))
      : [{ ...DEFAULT_ITEM, description: `Credit against ${inv.invoice_number}`, unit_price: parseFloat(inv.subtotal) || 0, total: parseFloat(inv.total_amount) || 0 }]

    setForm(prev => ({
      ...prev,
      invoice: invId,
      customer: prev.customer || inv.customer || '',
      billing_address: prev.billing_address || inv.billing_address || '',
      customer_tax_number: prev.customer_tax_number || inv.customer_tax_number || '',
      reference_number: prev.reference_number || `Credit against ${inv.invoice_number}`,
      items: itemsFromInvoice
    }))
    showToast(`Loaded details from Invoice ${inv.invoice_number}`, 'success')
  }

  // Line Item Math
  const handleItemChange = (index, field, value) => {
    setForm(prev => {
      const items = [...prev.items]
      const current = { ...items[index], [field]: value }

      const qty = parseFloat(current.quantity) || 0
      const price = parseFloat(current.unit_price) || 0
      const disc = parseFloat(current.discount_rate) || 0
      const vatRate = parseFloat(current.tax_rate) || 0

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
  }

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

      itm.unit_price = parseFloat(mat.customer_price) || 0

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
  }

  const handleAddItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { ...DEFAULT_ITEM }]
    }))
  }

  const handleRemoveItem = (index) => {
    if (form.items.length <= 1) {
      showToast('A credit note must have at least one line item', 'warning')
      return
    }
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  // Summary
  const summary = useMemo(() => {
    let subtotal = 0
    let taxTotal = 0

    form.items.forEach(it => {
      const qty = parseFloat(it.quantity) || 0
      const price = parseFloat(it.unit_price) || 0
      const disc = parseFloat(it.discount_rate) || 0
      const vatRate = parseFloat(it.tax_rate) || 0

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

  // PDF
  const handleDownloadPdf = async () => {
    if (!id) {
      showToast('Please save before downloading PDF', 'info')
      return
    }
    try {
      setDownloadingPdf(true)
      const res = await api.get(`credit-notes/${id}/pdf/`, { responseType: 'blob' })
      handlePdfResponse(res, `CreditNote_${form.credit_note_number}.pdf`)
      showToast('PDF downloaded successfully', 'success')
    } catch (err) {
      console.error('PDF error:', err)
      showError('Download Failed', 'Failed to generate credit note PDF.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Save
  const handleSubmit = async (targetStatus) => {
    setFormError('')
    if (!form.customer) {
      setFormError('Please select a customer.')
      showToast('Customer is required', 'warning')
      return
    }
    if (!form.credit_note_number.trim()) {
      setFormError('Credit Note Number is required.')
      return
    }

    const payload = {
      ...form,
      invoice: form.invoice || null,
      status: targetStatus || form.status,
      subtotal: summary.subtotal,
      tax_amount: summary.taxTotal,
      total_amount: summary.grandTotal,
      discount_amount: summary.overallDiscount,
      items: form.items.map((it, idx) => ({
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
        showSuccess('Saved!', `Credit Note ${form.credit_note_number} updated successfully.`)
      } else {
        const res = await api.post('credit-notes/', payload)
        showSuccess('Created!', `Credit Note ${form.credit_note_number} created successfully.`)
        navigate(`/credit-notes/${res.data.id}/edit`, { replace: true })
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

  // Quick Customer
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
      showToast('Customer created', 'success')
    } catch (err) {
      showError('Failed', 'Could not create customer.')
    } finally {
      setSubmittingCustomer(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <SkeletonLoader count={6} />
      </div>
    )
  }

  return (
    <div className="erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', minHeight: '100vh', paddingBottom: '90px', boxSizing: 'border-box' }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => navigate('/credit-notes')}
            style={{
              padding: '6px 10px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#475569',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.85rem'
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>
              {isEditing ? `Edit Credit Note ${form.credit_note_number}` : 'New Credit Note / Sales Return'}
            </h1>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Status: <span style={{ fontWeight: '600', color: '#dc2626' }}>{form.status}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isEditing && (
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              style={{
                padding: '6px 12px',
                background: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Download size={15} className={downloadingPdf ? 'animate-spin' : ''} />
              PDF
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSubmit('Draft')}
            disabled={submitting}
            style={{
              padding: '6px 14px',
              background: '#ffffff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Save Draft
          </button>

          <button
            type="button"
            onClick={() => handleSubmit('Issued')}
            disabled={submitting}
            style={{
              padding: '6px 16px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
            }}
          >
            <Check size={16} />
            {submitting ? 'Saving...' : 'Save & Issue Note'}
          </button>
        </div>
      </div>

      {formError && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          fontSize: '0.85rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          {formError}
        </div>
      )}

      {/* Zoho-Style Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {/* Section 1: Customer & Reason Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
          paddingBottom: '1.5rem',
          borderBottom: '1px solid #f1f5f9'
        }}>
          {/* Left Column: Customer */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <ZohoLabel required>Customer</ZohoLabel>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}
              >
                + New Customer
              </button>
            </div>
            <select
              value={form.customer}
              onChange={(e) => handleCustomerChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '0.88rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                background: '#fff',
                marginBottom: '10px'
              }}
            >
              <option value="">Select Customer...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
              ))}
            </select>

            <ZohoLabel>Linked Tax Invoice (Optional)</ZohoLabel>
            <select
              value={form.invoice}
              onChange={(e) => handleInvoiceChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '0.85rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                background: '#fff',
                marginBottom: '10px'
              }}
            >
              <option value="">Select Invoice to load items...</option>
              {invoices.map(i => (
                <option key={i.id} value={i.id}>{i.invoice_number} - {i.customer_name} ({i.total_amount} {currency})</option>
              ))}
            </select>

            <ZohoLabel>Billing Address</ZohoLabel>
            <textarea
              rows={2}
              value={form.billing_address}
              onChange={(e) => setForm(p => ({ ...p, billing_address: e.target.value }))}
              style={{
                width: '100%',
                padding: '7px 10px',
                fontSize: '0.85rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px'
              }}
            />
          </div>

          {/* Right Column: Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <ZohoLabel required>Credit Note Number</ZohoLabel>
              <input
                type="text"
                value={form.credit_note_number}
                onChange={(e) => setForm(p => ({ ...p, credit_note_number: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#dc2626'
                }}
              />
            </div>

            <div>
              <ZohoLabel required>Credit Date</ZohoLabel>
              <input
                type="date"
                value={form.credit_note_date}
                onChange={(e) => setForm(p => ({ ...p, credit_note_date: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px'
                }}
              />
            </div>

            <div>
              <ZohoLabel required>Credit Reason</ZohoLabel>
              <select
                value={form.credit_reason}
                onChange={(e) => setForm(p => ({ ...p, credit_reason: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  background: '#fff'
                }}
              >
                {REASON_CHOICES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <ZohoLabel>Status</ZohoLabel>
              <select
                value={form.status}
                onChange={(e) => setForm(p => ({ ...p, status: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  background: '#fff'
                }}
              >
                {STATUS_CHOICES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <ZohoLabel>Reference / PO</ZohoLabel>
              <input
                type="text"
                value={form.reference_number}
                onChange={(e) => setForm(p => ({ ...p, reference_number: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px'
                }}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <ZohoLabel>Customer Tax ID</ZohoLabel>
              <input
                type="text"
                maxLength={15}
                placeholder="15-digit ZATCA Tax ID"
                value={form.customer_tax_number}
                onChange={(e) => setForm(p => ({ ...p, customer_tax_number: e.target.value.replace(/\D/g, '').slice(0, 15) }))}

                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px'
                }}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Items Table */}
        <div style={{ margin: '1.5rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#1e293b' }}>
              Credited Items & Services
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
              style={{
                padding: '5px 10px',
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus size={14} />
              Add Row
            </button>
          </div>

          {/* Desktop Table */}
          <div className="table-responsive-wrapper desktop-only" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '8px 10px', width: '4%' }}>#</th>
                  <th style={{ padding: '8px 10px', width: '38%' }}>Item Description</th>
                  <th style={{ padding: '8px 10px', width: '10%' }}>Qty</th>
                  <th style={{ padding: '8px 10px', width: '10%' }}>Unit</th>
                  <th style={{ padding: '8px 10px', width: '12%', textAlign: 'right' }}>Credit Rate ({currency})</th>
                  <th style={{ padding: '8px 10px', width: '8%', textAlign: 'right' }}>Disc %</th>
                  <th style={{ padding: '8px 10px', width: '12%', textAlign: 'right' }}>Credit Total ({currency})</th>
                  <th style={{ padding: '8px 10px', width: '6%', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '5px',
                            fontSize: '0.85rem'
                          }}
                        />
                        {materials.length > 0 && (
                          <select
                            value={item.material || ''}
                            onChange={(e) => handleSelectMaterialForItem(idx, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              fontSize: '0.85rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '5px',
                              background: '#ffffff',
                              color: item.material ? '#0f172a' : '#64748b',
                              outline: 'none',
                              cursor: 'pointer',
                              transition: 'border-color 0.15s ease'
                            }}
                          >
                            <option value="">⚡ Pick from Price Chart...</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} {m.measurements ? `(${m.measurements})` : ''} {m.customer_price ? `- ${m.customer_price} ${currency}` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '5px',
                          fontSize: '0.85rem'
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <select
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '5px',
                          fontSize: '0.85rem',
                          background: '#fff'
                        }}
                      >
                        {UNIT_OPTIONS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '5px',
                          fontSize: '0.85rem',
                          textAlign: 'right'
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={item.discount_rate}
                        onChange={(e) => handleItemChange(idx, 'discount_rate', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '5px',
                          fontSize: '0.85rem',
                          textAlign: 'right'
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600', color: '#dc2626' }}>
                      {parseFloat(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {form.items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>CREDIT ITEM #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '5px',
                      fontSize: '0.85rem'
                    }}
                  />
                  {materials.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      <select
                        value={item.material || ''}
                        onChange={(e) => handleSelectMaterialForItem(idx, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          fontSize: '0.85rem',
                          border: '1px solid #cbd5e1',
                          borderRadius: '5px',
                          background: '#ffffff',
                          color: item.material ? '#0f172a' : '#64748b',
                          outline: 'none',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s ease'
                        }}
                      >
                        <option value="">⚡ Pick from Price Chart...</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.measurements ? `(${m.measurements})` : ''} {m.customer_price ? `- ${m.customer_price} ${currency}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Qty</span>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Rate ({currency})</span>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Disc: {item.discount_rate || 0}% | VAT: 15%</span>
                  <span style={{ fontSize: '0.92rem', fontWeight: '700', color: '#dc2626' }}>
                    Credit: {parseFloat(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Dynamic Custom Form Fields */}
        <div style={{ padding: '1rem 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
          <DynamicCustomFields
            formType="credit_note"
            values={form.custom_fields || {}}
            onChange={(fieldName, val) => {
              setForm(p => ({
                ...p,
                custom_fields: { ...(p.custom_fields || {}), [fieldName]: val }
              }))
            }}
          />
        </div>

        {/* Section 4: Notes & Financials */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
          marginTop: '1.5rem'
        }}>
          <div>
            <ZohoLabel>Internal / Customer Notes</ZohoLabel>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
              style={{
                width: '100%',
                padding: '7px 10px',
                fontSize: '0.85rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                marginBottom: '10px'
              }}
            />

            <ZohoLabel>Adjustment Terms</ZohoLabel>
            <textarea
              rows={2}
              value={form.terms_conditions}
              onChange={(e) => setForm(p => ({ ...p, terms_conditions: e.target.value }))}
              style={{
                width: '100%',
                padding: '7px 10px',
                fontSize: '0.85rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px'
              }}
            />
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.25rem',
            alignSelf: 'start'
          }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: '700', color: '#1e293b' }}>
              Credit Calculation
            </h4>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.88rem' }}>
              <span style={{ color: '#64748b' }}>Credit Subtotal:</span>
              <span style={{ fontWeight: '600', color: '#1e293b' }}>
                {summary.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.88rem' }}>
              <span style={{ color: '#64748b' }}>Adjustment Discount:</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.discount_amount}
                onChange={(e) => setForm(p => ({ ...p, discount_amount: parseFloat(e.target.value) || 0 }))}
                style={{
                  width: '90px',
                  padding: '3px 6px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '5px',
                  textAlign: 'right',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.88rem' }}>
              <span style={{ color: '#64748b' }}>VAT Reversal (15%):</span>
              <span style={{ fontWeight: '600', color: '#1e293b' }}>
                {summary.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
              </span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '10px',
              borderTop: '2px solid #e2e8f0',
              fontSize: '1.1rem',
              fontWeight: '700',
              color: '#dc2626'
            }}>
              <span>Total Credit Value:</span>
              <span>
                {summary.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Toolbar (Accessible on all screen sizes, docked to bottom) */}
      <div className="builder-sticky-bar" style={{
        position: 'sticky',
        bottom: 0,
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '0.85rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1100,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
        marginTop: '1.5rem',
        borderRadius: '8px'
      }}>
        <div className="builder-sticky-info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '13px', color: '#64748b' }}>
          <RotateCcw size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
          <span>Total Credit Value: <strong style={{ color: '#dc2626', fontSize: '15px' }}>{summary.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</strong></span>
        </div>

        <div className="builder-sticky-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={() => navigate('/credit-notes')}
            style={{
              padding: '0.55rem 1.1rem',
              fontSize: '13.5px',
              fontWeight: '500',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSubmit('Draft')}
            disabled={submitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.55rem 1.1rem',
              fontSize: '13.5px',
              fontWeight: '500',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#1e293b',
              cursor: 'pointer'
            }}
          >
            Save as Draft
          </button>

          <button
            type="button"
            onClick={() => handleSubmit('Issued')}
            disabled={submitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1.35rem',
              fontSize: '13.5px',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(220,38,38,0.3)'
            }}
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {isEditing ? 'Save Changes' : 'Save & Issue Note'}
          </button>
        </div>
      </div>

      {/* Quick Customer Modal */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Add New Customer"
      >
        <form onSubmit={handleCreateCustomer}>
          <div style={{ marginBottom: '10px' }}>
            <ZohoLabel required>Customer Name</ZohoLabel>
            <input
              type="text"
              required
              value={newCustomerForm.name}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, name: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <ZohoLabel>Company Name</ZohoLabel>
            <input
              type="text"
              value={newCustomerForm.company_name || ''}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, company_name: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <ZohoLabel>Phone Number</ZohoLabel>
            <input
              type="text"
              value={newCustomerForm.phone}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, phone: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <ZohoLabel>Billing Address</ZohoLabel>
            <textarea
              rows={2}
              value={newCustomerForm.address}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, address: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={submittingCustomer} className="btn btn-primary" style={{ background: '#dc2626' }}>
              {submittingCustomer ? 'Saving...' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
        }
        @media (min-width: 769px) {
          .desktop-only { display: block !important; }
          .mobile-only { display: none !important; }
        }
      `}</style>
    </div>
  )
}

export default CreditNoteBuilder
