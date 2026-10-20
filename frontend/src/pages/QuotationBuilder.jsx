import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, RefreshCw, FileText,
  AlertCircle, CheckCircle, Users, Calendar, Download,
  Building, Info, ChevronRight, Check, ArrowUpRight
} from 'lucide-react'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import DynamicCustomFields from '../components/common/DynamicCustomFields'
import Modal from '../components/common/Modal'
import { useSettings } from '../contexts/SettingsContext'
import { showError, showToast, showSuccess, showConfirm } from '../utils/swal'
import { handlePdfResponse } from '../utils/pdfDownload'

const PAYMENT_TERMS_OPTIONS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Custom']
const STATUS_CHOICES = ['Draft', 'Sent', 'Accepted', 'Declined', 'Converted to Invoice', 'Expired']
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

const QuotationBuilder = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const { settings, formatCurrency } = useSettings()
  const currency = settings?.currency || 'SAR'

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitTargetStatus, setSubmitTargetStatus] = useState('Sent')
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [customers, setCustomers] = useState([])
  const [jobOrders, setJobOrders] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [estimations, setEstimations] = useState([])
  const [materials, setMaterials] = useState([])
  const [formError, setFormError] = useState('')

  const [form, setForm] = useState({
    quotation_number: '',
    customer: '',
    customer_tax_number: '',
    billing_address: '',
    job_order: '',
    quotation_date: new Date().toISOString().split('T')[0],
    valid_until: '',
    payment_terms: 'Due on Receipt',
    status: 'Draft',
    reference_number: '',
    bank_account: '',
    discount_amount: 0,
    notes: 'Thank you for giving us the opportunity to quote. Please feel free to reach out with any questions.',
    terms_conditions: 'This quotation is valid for 30 days from date of issue. Prices subject to Saudi VAT.',
    items: [{ ...DEFAULT_ITEM }],
    custom_fields: {}
  })

  // Quick Customer Creation Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', company_name: '', phone: '', email: '', address: '' })
  const [submittingCustomer, setSubmittingCustomer] = useState(false)

  useEffect(() => {
    fetchData()
  }, [id])

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
      const [cRes, jRes, bRes, eRes, mRes] = await Promise.all([
        api.get('customers/?page_size=1000').catch(() => ({ data: [] })),
        api.get('job-orders/?page_size=1000&lookup=true').catch(() => ({ data: [] })),
        api.get('banks/?page_size=100').catch(() => ({ data: [] })),
        api.get('estimations/').catch(() => ({ data: [] })),
        api.get('materials/').catch(() => ({ data: [] }))
      ])

      const custList = toArr(cRes.data)
      const jobList = toArr(jRes.data)
      const bankList = toArr(bRes.data)
      const estList = toArr(eRes.data)
      const matList = toArr(mRes.data)

      setCustomers(custList)
      setJobOrders(jobList)
      setBankAccounts(bankList)
      setEstimations(estList)
      setMaterials(matList)

      if (isEditing) {
        const { data: q } = await api.get(`quotations/${id}/`)
        const formattedItems = (q.items && q.items.length > 0)
          ? q.items.map(it => ({
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
          notes: q.notes || '',
          terms_conditions: q.terms_conditions || '',
          items: formattedItems,
          custom_fields: q.custom_fields || {}
        })
      } else {
        const nextNum = await fetchNextQuotationNumber()
        const defaultBank = bankList.find(b => b.status === 'Active') || bankList[0]
        const today = new Date().toISOString().split('T')[0]
        const validDate = new Date()
        validDate.setDate(validDate.getDate() + 30)

        setForm(prev => ({
          ...prev,
          quotation_number: nextNum,
          bank_account: defaultBank?.id || '',
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

  // Handle Customer Select
  const handleCustomerChange = (customerId) => {
    const cust = customers.find(c => String(c.id) === String(customerId))
    setForm(prev => ({
      ...prev,
      customer: customerId,
      customer_tax_number: cust?.tax_number || prev.customer_tax_number || '',
      billing_address: cust?.address || prev.billing_address || ''
    }))
  }

  // Recalculate Line Item
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
      showToast('A quotation must have at least one line item', 'warning')
      return
    }
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  // Import from Estimation
  const handleImportEstimation = (estId) => {
    const est = estimations.find(e => String(e.id) === String(estId))
    if (!est) return

    const price = parseFloat(est.total_price) || 0
    const base = Number((price / 1.15).toFixed(2))
    const vat = Number((price - base).toFixed(2))

    setForm(prev => ({
      ...prev,
      customer: prev.customer || est.customer || '',
      reference_number: prev.reference_number || est.estimate_number || '',
      items: [
        ...prev.items.filter(it => it.description.trim() !== '' || it.unit_price > 0),
        {
          description: `Quote as per Estimate ${est.estimate_number}: ${est.title || ''}`.trim(),
          quantity: 1,
          unit: 'Lot',
          unit_price: base > 0 ? base : price,
          discount_rate: 0,
          tax_rate: 15,
          tax_amount: vat,
          total: price
        }
      ]
    }))
    showToast(`Imported Estimate ${est.estimate_number}`, 'success')
  }

  // Calculations for summary
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

  // PDF Download
  const handleDownloadPdf = async () => {
    if (!id) {
      showToast('Please save the quotation before generating PDF', 'info')
      return
    }
    try {
      setDownloadingPdf(true)
      const res = await api.get(`quotations/${id}/pdf/`, { responseType: 'blob' })
      handlePdfResponse(res, `Quotation_${form.quotation_number}.pdf`)
      showToast('PDF downloaded successfully', 'success')
    } catch (err) {
      console.error('PDF error:', err)
      showError('Download Failed', 'Failed to generate quotation PDF.')
    } finally {
      setDownloadingPdf(false)
    }
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
        billing_address: created.address || '',
        customer_tax_number: created.tax_number || ''
      }))
      setIsCustomerModalOpen(false)
      setNewCustomerForm({ name: '', company_name: '', phone: '', email: '', address: '' })
      showToast('Customer created and selected', 'success')
    } catch (err) {
      console.error('Customer create error:', err)
      showError('Failed', 'Could not create customer.')
    } finally {
      setSubmittingCustomer(false)
    }
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

    const payload = {
      ...form,
      status: targetStatus || form.status,
      subtotal: summary.subtotal,
      tax_amount: summary.taxTotal,
      total_amount: summary.grandTotal,
      discount_amount: summary.overallDiscount,
      items: form.items.map((it, idx) => ({
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
      setSubmitTargetStatus(targetStatus)
      if (isEditing) {
        await api.put(`quotations/${id}/`, payload)
        showSuccess('Saved!', `Quotation ${form.quotation_number} updated successfully.`)
      } else {
        const res = await api.post('quotations/', payload)
        showSuccess('Created!', `Quotation ${form.quotation_number} created successfully.`)
        navigate(`/quotations/${res.data.id}/edit`, { replace: true })
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

  // Convert directly to invoice
  const handleConvertToInvoice = async () => {
    if (!id) return
    const confirmed = await showConfirm(
      'Convert to Invoice',
      `Create a Tax Invoice directly from this Quotation? All lines and totals will be transferred.`
    )
    if (!confirmed) return

    try {
      const res = await api.post(`quotations/${id}/convert-to-invoice/`)
      if (res.data?.success) {
        showSuccess('Converted!', `Invoice ${res.data.invoice_number} has been created.`)
        navigate(`/invoices/${res.data.invoice_id}/edit`)
      }
    } catch (err) {
      showError('Conversion Failed', err.response?.data?.detail || 'Unable to convert to invoice.')
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
      {/* Top Header Bar */}
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
            onClick={() => navigate('/quotations')}
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
              {isEditing ? `Edit Quotation ${form.quotation_number}` : 'New Quotation / Proposal'}
            </h1>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Status: <span style={{ fontWeight: '600', color: '#4f46e5' }}>{form.status}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isEditing && (
            <>
              {form.status !== 'Converted to Invoice' && (
                <button
                  type="button"
                  onClick={handleConvertToInvoice}
                  style={{
                    padding: '6px 12px',
                    background: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ArrowUpRight size={15} />
                  Convert to Invoice
                </button>
              )}
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
            </>
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
            onClick={() => handleSubmit('Sent')}
            disabled={submitting}
            style={{
              padding: '6px 16px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(99, 102, 241, 0.4)'
            }}
          >
            <Check size={16} />
            {submitting ? 'Saving...' : 'Save & Issue Quote'}
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

      {/* Zoho-Style Paper Document Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {/* Section 1: Customer & Metadata Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
          paddingBottom: '1.5rem',
          borderBottom: '1px solid #f1f5f9'
        }}>
          {/* Left Column: Customer Details */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <ZohoLabel required>Client / Customer</ZohoLabel>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4f46e5',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: 0
                }}
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

            <ZohoLabel>Billing Address</ZohoLabel>
            <textarea
              rows={2}
              value={form.billing_address}
              onChange={(e) => setForm(p => ({ ...p, billing_address: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '0.85rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                marginBottom: '10px'
              }}
            />

            <ZohoLabel>VAT / Tax ID</ZohoLabel>
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

          {/* Right Column: Quotation Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <ZohoLabel required>Quotation Number</ZohoLabel>
              <input
                type="text"
                value={form.quotation_number}
                onChange={(e) => setForm(p => ({ ...p, quotation_number: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#1e293b'
                }}
              />
            </div>

            <div>
              <ZohoLabel required>Quotation Date</ZohoLabel>
              <input
                type="date"
                value={form.quotation_date}
                onChange={(e) => setForm(p => ({ ...p, quotation_date: e.target.value }))}
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
              <ZohoLabel>Valid Until</ZohoLabel>
              <input
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm(p => ({ ...p, valid_until: e.target.value }))}
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
              <ZohoLabel>Payment Terms</ZohoLabel>
              <select
                value={form.payment_terms}
                onChange={(e) => setForm(p => ({ ...p, payment_terms: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  background: '#fff'
                }}
              >
                {PAYMENT_TERMS_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
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

            <div style={{ gridColumn: 'span 2' }}>
              <ZohoLabel>Reference / PO Number</ZohoLabel>
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
          </div>
        </div>

        {/* Section 2: Quick Import Strip */}
        {estimations.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#f8fafc',
            padding: '8px 12px',
            borderRadius: '8px',
            margin: '1rem 0',
            fontSize: '0.82rem',
            border: '1px solid #e2e8f0',
            flexWrap: 'wrap'
          }}>
            <Download size={16} style={{ color: '#6366f1' }} />
            <span style={{ fontWeight: '600', color: '#475569' }}>Quick Import:</span>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleImportEstimation(e.target.value)
                  e.target.value = ''
                }
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
                background: '#fff'
              }}
            >
              <option value="">Choose Estimation to insert...</option>
              {estimations.map(e => (
                <option key={e.id} value={e.id}>{e.estimate_number} - {e.title || 'Estimate'} ({e.total_price} {currency})</option>
              ))}
            </select>
          </div>
        )}

        {/* Section 3: Line Items Table */}
        <div style={{ margin: '1.5rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#1e293b' }}>
              Itemized Quotation Lines
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
              style={{
                padding: '5px 10px',
                background: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
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

          {/* Desktop Items Table */}
          <div className="table-responsive-wrapper desktop-only" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '8px 10px', width: '4%' }}>#</th>
                  <th style={{ padding: '8px 10px', width: '38%' }}>Item & Description</th>
                  <th style={{ padding: '8px 10px', width: '10%' }}>Qty</th>
                  <th style={{ padding: '8px 10px', width: '10%' }}>Unit</th>
                  <th style={{ padding: '8px 10px', width: '12%', textAlign: 'right' }}>Price ({currency})</th>
                  <th style={{ padding: '8px 10px', width: '8%', textAlign: 'right' }}>Disc %</th>
                  <th style={{ padding: '8px 10px', width: '12%', textAlign: 'right' }}>Total ({currency})</th>
                  <th style={{ padding: '8px 10px', width: '6%', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', color: '#94a3b8', verticalAlign: 'top' }}>
                      {idx + 1}
                    </td>
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
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                      {parseFloat(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                        title="Remove row"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Item Cards (100% Mobile Responsive) */}
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
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>ITEM #{idx + 1}</span>
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
                      style={{
                        width: '100%',
                        padding: '5px 8px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '5px',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Price ({currency})</span>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '5px 8px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '5px',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Disc: {item.discount_rate || 0}% | VAT: 15%</span>
                  <span style={{ fontSize: '0.92rem', fontWeight: '700', color: '#0f172a' }}>
                    Total: {parseFloat(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Dynamic Custom Form Fields */}
        <div style={{ padding: '1rem 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
          <DynamicCustomFields
            formType="quotation"
            values={form.custom_fields || {}}
            onChange={(fieldName, val) => {
              setForm(p => ({
                ...p,
                custom_fields: { ...(p.custom_fields || {}), [fieldName]: val }
              }))
            }}
          />
        </div>

        {/* Section 5: Bottom Grid (Banking & Notes on Left, Financials on Right) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
          marginTop: '1.5rem'
        }}>
          {/* Left: Bank details and terms */}
          <div>
            <ZohoLabel>Remittance / Bank Account</ZohoLabel>
            <select
              value={form.bank_account}
              onChange={(e) => setForm(p => ({ ...p, bank_account: e.target.value }))}
              style={{
                width: '100%',
                padding: '7px 10px',
                fontSize: '0.85rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                marginBottom: '10px',
                background: '#fff'
              }}
            >
              <option value="">None / Cash</option>
              {bankAccounts.map(b => (
                <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number} ({b.currency})</option>
              ))}
            </select>

            <ZohoLabel>Client Notes</ZohoLabel>
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

            <ZohoLabel>Terms & Conditions</ZohoLabel>
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

          {/* Right: Summary Box */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.25rem',
            alignSelf: 'start'
          }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: '700', color: '#1e293b' }}>
              Quotation Summary
            </h4>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.88rem' }}>
              <span style={{ color: '#64748b' }}>Subtotal (Excl. VAT):</span>
              <span style={{ fontWeight: '600', color: '#1e293b' }}>
                {summary.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.88rem' }}>
              <span style={{ color: '#64748b' }}>Overall Discount ({currency}):</span>
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
              <span style={{ color: '#64748b' }}>VAT (15%):</span>
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
              color: '#4f46e5'
            }}>
              <span>Quotation Total:</span>
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
          <FileText size={16} style={{ color: '#4f46e5', flexShrink: 0 }} />
          <span>Quotation Total: <strong style={{ color: '#4f46e5', fontSize: '15px' }}>{summary.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</strong></span>
        </div>

        <div className="builder-sticky-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={() => navigate('/quotations')}
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
            onClick={() => handleSubmit('Sent')}
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
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(79,70,229,0.3)'
            }}
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {isEditing ? 'Save Changes' : 'Save & Issue Quote'}
          </button>
        </div>
      </div>

      {/* Quick Customer Creation Modal */}
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
          <div style={{ marginBottom: '10px' }}>
            <ZohoLabel>Email Address</ZohoLabel>
            <input
              type="email"
              value={newCustomerForm.email}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, email: e.target.value }))}
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
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(false)}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingCustomer}
              className="btn btn-primary"
              style={{ background: '#4f46e5' }}
            >
              {submittingCustomer ? 'Saving...' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Responsive Style Overrides */}
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

export default QuotationBuilder
