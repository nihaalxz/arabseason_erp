import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, RefreshCw, FileText,
  AlertCircle, CheckCircle, Users, Calendar, Receipt, Download,
  CreditCard, Building, Info, Zap, ShieldCheck, ChevronRight,
  HelpCircle, Settings, Check, FileSpreadsheet
} from 'lucide-react'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import DynamicCustomFields from '../components/common/DynamicCustomFields'
import Modal from '../components/common/Modal'
import { useSettings } from '../contexts/SettingsContext'
import { showError, showToast, showWarning } from '../utils/swal'
import { handlePdfResponse } from '../utils/pdfDownload'

const PAYMENT_TERMS_OPTIONS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Custom']
const STATUS_CHOICES = ['Draft', 'Issued', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled']
const UNIT_OPTIONS = ['Unit', 'Pcs', 'Hours', 'Days', 'Lot', 'Sq. M', 'Kg', 'Service', 'm', 'Roll', 'Box']
const DEFAULT_ITEM = { description: '', quantity: 1, unit: 'Unit', unit_price: 0, discount_rate: 0, tax_rate: 15, tax_amount: 0, total: 0, material: '' }

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

const InvoiceBuilder = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const { settings, formatCurrency } = useSettings()
  const currency = settings?.currency || 'SAR'

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitTargetStatus, setSubmitTargetStatus] = useState('Issued')
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [customers, setCustomers] = useState([])
  const [jobOrders, setJobOrders] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [materials, setMaterials] = useState([])
  const [estimations, setEstimations] = useState([])
  const [formError, setFormError] = useState('')

  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: '',
    customer: '',
    customer_tax_number: '',
    billing_address: '',
    job_order: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    supply_date: new Date().toISOString().split('T')[0],
    payment_terms: 'Due on Receipt',
    status: 'Issued',
    reference_number: '',
    bank_account: '',
    discount_amount: 0,
    notes: 'Thanks for your business. Please remit payment as per bank details below.',
    terms_conditions: 'All payments must be received by the stated due date. Tax Invoice subject to Saudi VAT regulations.',
    items: [{ ...DEFAULT_ITEM }],
    custom_fields: {}
  })

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', company_name: '', phone: '', email: '', address: '' })
  const [submittingCustomer, setSubmittingCustomer] = useState(false)
  const [isFormDirty, setIsFormDirty] = useState(false)

  // Warn on tab/window close if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isFormDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isFormDirty])

  const handleBack = () => {
    if (isFormDirty) {
      if (window.confirm('You have unsaved changes in this invoice. Are you sure you want to leave without saving?')) {
        navigate('/invoices')
      }
    } else {
      navigate('/invoices')
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

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
      const [cRes, jRes, bRes, mRes, eRes] = await Promise.all([
        api.get('customers/?page_size=1000').catch(() => ({ data: [] })),
        api.get('job-orders/?page_size=1000&lookup=true').catch(() => ({ data: [] })),
        api.get('banks/?page_size=100').catch(() => ({ data: [] })),
        api.get('materials/').catch(() => ({ data: [] })),
        api.get('estimations/').catch(() => ({ data: [] }))
      ])
      const custList = toArr(cRes.data)
      const jobList = toArr(jRes.data)
      const bankList = toArr(bRes.data)
      const matList = toArr(mRes.data)
      const estList = toArr(eRes.data)
      setCustomers(custList)
      setJobOrders(jobList)
      setBankAccounts(bankList)
      setMaterials(matList)
      setEstimations(estList)

      if (isEditing) {
        const { data: inv } = await api.get(`invoices/${id}/`)
        const items = (inv.items && inv.items.length > 0)
          ? inv.items.map(it => ({
              id: it.id,
              description: it.description || '',
              quantity: parseFloat(it.quantity) || 1,
              unit: it.unit || 'Unit',
              unit_price: parseFloat(it.unit_price) || 0,
              discount_rate: parseFloat(it.discount_rate) || 0,
              tax_rate: parseFloat(it.tax_rate) ?? 15,
              tax_amount: parseFloat(it.tax_amount) || 0,
              total: parseFloat(it.total) || 0
            }))
          : [{ ...DEFAULT_ITEM }]

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
          notes: inv.notes || '',
          terms_conditions: inv.terms_conditions || '',
          items,
          custom_fields: inv.custom_fields || {}
        })
      } else {
        const nextNum = await fetchNextInvoiceNumber()
        const defaultBank = bankList.find(b => b.status === 'Active') || bankList[0]
        setInvoiceForm(prev => ({
          ...prev,
          invoice_number: nextNum,
          bank_account: defaultBank ? defaultBank.id : ''
        }))

        // Auto-import if query parameter ?from_estimate=ID is present
        const urlParams = new URLSearchParams(window.location.search)
        const estParam = urlParams.get('from_estimate') || urlParams.get('estimate_id')
        if (estParam) {
          setTimeout(() => {
            handleImportFromEstimate(estParam, estList, custList)
          }, 60)
        }
      }
    } catch {
      showError('Load Error', 'Could not load required invoice data.')
    } finally {
      setLoading(false)
    }
  }

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

  const set = (key, val) => {
    setIsFormDirty(true)
    setInvoiceForm(p => ({ ...p, [key]: val }))
  }

  const handleCustomerSelect = (cid) => {
    const c = customers.find(x => String(x.id) === String(cid))
    setInvoiceForm(p => ({
      ...p,
      customer: cid,
      customer_tax_number: c?.tax_number || p.customer_tax_number || '',
      billing_address: c?.address || p.billing_address || ''
    }))
  }

  const handleJobSelect = (jobId) => {
    const job = jobOrders.find(j => String(j.id) === String(jobId))
    if (!job) {
      setInvoiceForm(p => ({ ...p, job_order: '' }))
      return
    }
    setInvoiceForm(p => {
      const u = {
        ...p,
        job_order: jobId,
        customer: p.customer || job.customer || '',
        reference_number: p.reference_number || job.order_id || ''
      }
      if (p.items.length === 1 && (!p.items[0].description || p.items[0].unit_price === 0)) {
        const amt = parseFloat(job.total_amount) || 0
        const base = Number((amt / 1.15).toFixed(2))
        u.items = [{
          description: `Contract Services: ${job.order_id || ''} ${job.title}`.trim(),
          quantity: 1,
          unit: 'Lot',
          unit_price: base > 0 ? base : amt,
          discount_rate: 0,
          tax_rate: 15,
          tax_amount: base > 0 ? Number((amt - base).toFixed(2)) : Number((amt * 0.15).toFixed(2)),
          total: amt
        }]
      }
      return u
    })
  }

  const handleItemChange = (idx, field, value) => {
    setIsFormDirty(true)
    setInvoiceForm(prev => {
      const items = [...prev.items]
      const itm = { ...items[idx], [field]: value }
      const qty = parseFloat(itm.quantity) || 0
      const price = parseFloat(itm.unit_price) || 0
      const disc = parseFloat(itm.discount_rate) || 0
      const tax = parseFloat(itm.tax_rate) ?? 15

      const base = qty * price
      const discAmt = base * (disc / 100)
      const taxable = Math.max(0, base - discAmt)
      itm.tax_amount = Number((taxable * tax / 100).toFixed(2))
      itm.total = Number((taxable + itm.tax_amount).toFixed(2))

      items[idx] = itm
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

    setInvoiceForm(prev => {
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
      const tax = parseFloat(itm.tax_rate) ?? 15

      const base = qty * price
      const discAmt = base * (disc / 100)
      const taxable = Math.max(0, base - discAmt)
      itm.tax_amount = Number((taxable * tax / 100).toFixed(2))
      itm.total = Number((taxable + itm.tax_amount).toFixed(2))

      items[idx] = itm
      return { ...prev, items }
    })
  }

  const handleImportFromEstimate = async (estimateId, directList = null, directCustList = null) => {
    try {
      const list = directList || estimations
      let est = list.find(e => String(e.id) === String(estimateId))
      if (!est || !est.items || est.items.length === 0) {
        const res = await api.get(`estimations/${estimateId}/`)
        est = res.data
      }
      if (!est || !est.items || est.items.length === 0) {
        showWarning('No Items Found', 'This estimation has no line items to import.')
        return
      }

      const newItems = est.items.map(it => {
        const qty = parseFloat(it.quantity) || 1
        const rate = parseFloat(it.unit_price) || 0
        const taxRate = 15
        const sub = qty * rate
        const taxAmount = Number((sub * (taxRate / 100)).toFixed(2))
        const total = Number((sub + taxAmount).toFixed(2))

        const matchedUnit = it.unit
          ? (UNIT_OPTIONS.find(u => u.toLowerCase() === it.unit.toLowerCase()) || it.unit)
          : 'Unit'

        return {
          material: it.material || null,
          description: it.item_name + (it.measurements ? ` (${it.measurements})` : ''),
          quantity: qty,
          unit: matchedUnit,
          unit_price: rate,
          discount_rate: 0,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total: total
        }
      })

      const cList = directCustList || customers
      const matchedCust = cList.find(c => String(c.id) === String(est.customer))

      setInvoiceForm(prev => ({
        ...prev,
        customer: est.customer || prev.customer || '',
        customer_tax_number: matchedCust?.tax_number || prev.customer_tax_number || '',
        billing_address: matchedCust?.address || prev.billing_address || '',
        reference_number: est.estimate_number || prev.reference_number || '',
        notes: est.notes ? `${prev.notes}\nRef: ${est.estimate_number || est.title}`.trim() : prev.notes,
        items: newItems
      }))

      showToast(`Loaded ${newItems.length} items from ${est.estimate_number || est.title}`, 'success')
    } catch (err) {
      console.error('Failed to import estimate items:', err)
      showError('Import Failed', 'Could not load items from estimation.')
    }
  }

  const handleAddItem = () => {
    setInvoiceForm(p => ({ ...p, items: [...p.items, { ...DEFAULT_ITEM }] }))
  }

  const handleRemoveItem = (idx) => {
    if (invoiceForm.items.length <= 1) {
      showToast('At least one line item is required', 'warning')
      return
    }
    setInvoiceForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))
  }

  const totals = useMemo(() => {
    let sub = 0
    let vat = 0
    invoiceForm.items.forEach(it => {
      const qty = parseFloat(it.quantity) || 0
      const price = parseFloat(it.unit_price) || 0
      const disc = parseFloat(it.discount_rate) || 0
      const tax = parseFloat(it.tax_rate) ?? 15
      const base = qty * price
      const taxable = Math.max(0, base - base * (disc / 100))
      sub += taxable
      vat += taxable * tax / 100
    })
    const od = parseFloat(invoiceForm.discount_amount) || 0
    const netTaxable = Math.max(0, sub - od)
    const effectiveVat = sub > 0 ? (vat * (netTaxable / sub)) : 0
    return {
      subtotal: +sub.toFixed(2),
      totalTax: +effectiveVat.toFixed(2),
      overallDiscount: od,
      grandTotal: +(netTaxable + effectiveVat).toFixed(2)
    }
  }, [invoiceForm.items, invoiceForm.discount_amount])

  const executeSave = async (overrideStatus) => {
    setFormError('')
    if (!invoiceForm.invoice_number.trim()) {
      setFormError('Invoice Number is required')
      return
    }
    if (!invoiceForm.customer) {
      setFormError('Please select a customer for this invoice')
      return
    }
    for (let i = 0; i < invoiceForm.items.length; i++) {
      if (!invoiceForm.items[i].description.trim()) {
        setFormError(`Item #${i + 1} requires a description`)
        return
      }
    }

    const finalStatus = overrideStatus || invoiceForm.status || 'Issued'

    try {
      setSubmitting(true)
      const payload = {
        ...invoiceForm,
        invoice_number: invoiceForm.invoice_number.trim(),
        status: finalStatus,
        job_order: invoiceForm.job_order || null,
        due_date: invoiceForm.due_date || null,
        supply_date: invoiceForm.supply_date || null,
        bank_account: invoiceForm.bank_account || null,
        discount_amount: totals.overallDiscount,
        subtotal: totals.subtotal,
        tax_rate: 15,
        tax_amount: totals.totalTax,
        items: invoiceForm.items.map((it, si) => ({
          description: it.description,
          quantity: +it.quantity || 1,
          unit: it.unit || 'Unit',
          unit_price: +it.unit_price || 0,
          discount_rate: +it.discount_rate || 0,
          tax_rate: isNaN(+it.tax_rate) ? 15 : +it.tax_rate,
          tax_amount: +it.tax_amount || 0,
          total: +it.total || 0,
          sort_order: si
        }))
      }

      if (isEditing) {
        await api.put(`invoices/${id}/`, payload)
        showToast('Invoice updated successfully', 'success')
      } else {
        await api.post('invoices/', payload)
        showToast(finalStatus === 'Draft' ? 'Invoice saved as Draft' : 'Invoice issued successfully', 'success')
      }
      setIsFormDirty(false)
      navigate('/invoices')
    } catch (err) {
      console.error('Failed to save invoice:', err)
      const data = err.response?.data
      let msg = 'Failed to save invoice. Please verify all fields.'
      if (typeof data === 'string') {
        msg = data.includes('<html') ? 'Server error occurred while saving invoice.' : data
      } else if (data?.detail) {
        msg = data.detail
      } else if (typeof data === 'object' && data !== null) {
        const parts = []
        for (const [k, v] of Object.entries(data)) {
          const valStr = Array.isArray(v) ? v.join(', ') : (typeof v === 'object' ? JSON.stringify(v) : String(v))
          parts.push(`${k.replace(/_/g, ' ')}: ${valStr}`)
        }
        if (parts.length > 0) msg = parts.join(' | ')
      }
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }

  }

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true)
      const res = await api.get(`invoices/${id}/pdf/`, { responseType: 'blob' })
      handlePdfResponse(res, `tax_invoice_${invoiceForm.invoice_number}.pdf`)
      showToast('PDF downloaded', 'success')
    } catch {
      showError('Download Failed', 'Could not generate PDF.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    if (!newCustomerForm.name.trim()) {
      showToast('Customer name is required', 'error')
      return
    }
    try {
      setSubmittingCustomer(true)
      const { data } = await api.post('customers/', newCustomerForm)
      setCustomers(p => [...p, data])
      setInvoiceForm(p => ({
        ...p,
        customer: data.id,
        billing_address: data.address || p.billing_address
      }))
      setIsCustomerModalOpen(false)
      setNewCustomerForm({ name: '', company_name: '', phone: '', email: '', address: '' })
      showToast('Customer created', 'success')
    } catch {
      showError('Failed', 'Could not create customer.')
    } finally {
      setSubmittingCustomer(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <SkeletonLoader rows={10} />
      </div>
    )
  }

  const selectedCustomer = customers.find(c => String(c.id) === String(invoiceForm.customer))
  const selectedBank = bankAccounts.find(b => String(b.id) === String(invoiceForm.bank_account))

  return (
    <div style={{ background: '#f3f4f7', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#1e293b' }}>

      {/* Top Header / Breadcrumb Bar */}
      <div className="builder-header" style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.85rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        <div className="builder-header-top" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={handleBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e2e8f0' }}
            title="Back to Invoices"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '12px', color: '#64748b' }}>
              <Link to="/invoices" style={{ color: '#1366d9', textDecoration: 'none', fontWeight: '500' }}>Invoices</Link>
              <ChevronRight size={12} />
              <span>{isEditing ? 'Edit Invoice' : 'New Invoice'}</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', lineHeight: '1.2' }}>
              {isEditing ? `Edit Invoice #${invoiceForm.invoice_number}` : 'New Invoice'}
            </h1>
          </div>
        </div>

        {/* Quick actions top right */}
        <div className="builder-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isEditing && (
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                fontSize: '13px',
                fontWeight: '500',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              {downloadingPdf ? <RefreshCw size={14} className="spin" /> : <Download size={14} />} PDF
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '13px',
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
            onClick={() => executeSave('Draft')}
            disabled={submitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.9rem',
              fontSize: '13px',
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
            onClick={() => executeSave('Issued')}
            disabled={submitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1.1rem',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              background: '#1366d9',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(19,102,217,0.3)'
            }}
          >
            {submitting ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
            {isEditing ? 'Save Changes' : 'Save & Send'}
          </button>
        </div>
      </div>

      {/* Main Zoho Document Sheet Canvas */}
      <div className="builder-canvas" style={{ maxWidth: '1180px', width: '100%', margin: '1.5rem auto 3rem', padding: '0 1.5rem', flex: 1, boxSizing: 'border-box' }}>

        {formError && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            fontSize: '13.5px',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{formError}</span>
          </div>
        )}

        <div style={{
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden'
        }}>

          {/* Top Form Header: Customer Details Row */}
          <div className="builder-card-section" style={{ padding: '1.75rem 2rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ maxWidth: '520px' }}>
              
              {/* Customer Selection */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <ZohoLabel required hint="Select or add the customer being billed">Customer Name</ZohoLabel>
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      background: 'none',
                      border: 'none',
                      color: '#1366d9',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <Plus size={13} /> New Customer
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <select
                    className="input-field"
                    value={invoiceForm.customer}
                    onChange={e => handleCustomerSelect(e.target.value)}
                    required
                    style={{
                      height: '38px',
                      fontSize: '13.5px',
                      borderRadius: '6px',
                      borderColor: '#cbd5e1',
                      fontWeight: invoiceForm.customer ? '600' : '400',
                      color: invoiceForm.customer ? '#0f172a' : '#64748b'
                    }}
                  >
                    <option value="">Select or add a customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Customer Details Box if selected */}
                {selectedCustomer && (
                  <div style={{
                    marginTop: '0.65rem',
                    padding: '0.65rem 0.85rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '12.5px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '600', color: '#1e293b' }}>{selectedCustomer.name}</span>
                      {selectedCustomer.tax_number && (
                        <span style={{
                          fontSize: '11px',
                          background: '#eff6ff',
                          color: '#1366d9',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: '600'
                        }}>
                          VAT: {selectedCustomer.tax_number}
                        </span>
                      )}
                    </div>
                    {invoiceForm.billing_address ? (
                      <div style={{ color: '#64748b', lineHeight: '1.4', whiteSpace: 'pre-line' }}>
                        {invoiceForm.billing_address}
                      </div>
                    ) : (
                      <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No billing address recorded</div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Middle Form Grid: Invoice Properties (Zoho Style 4-Column Row) */}
          <div className="builder-card-section" style={{ padding: '1.5rem 2rem', background: '#fafbfc', borderBottom: '1px solid #e2e8f0' }}>
            <div className="builder-form-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem 1.5rem'
            }}>
              
              {/* Invoice# */}
              <div>
                <ZohoLabel required hint="Unique tax invoice reference number">Invoice#</ZohoLabel>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    className="input-field"
                    value={invoiceForm.invoice_number}
                    onChange={e => set('invoice_number', e.target.value)}
                    required
                    style={{
                      height: '36px',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      borderRadius: '6px',
                      borderColor: '#cbd5e1'
                    }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const num = await fetchNextInvoiceNumber()
                      set('invoice_number', num)
                      showToast('Generated next number', 'info')
                    }}
                    title="Auto-generate next invoice number"
                    style={{
                      padding: '0 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    <Zap size={14} />
                  </button>
                </div>
              </div>

              {/* Order Number / Reference */}
              <div>
                <ZohoLabel hint="Client Purchase Order (PO) or reference ID">Order / Reference#</ZohoLabel>
                <input
                  type="text"
                  className="input-field"
                  value={invoiceForm.reference_number}
                  onChange={e => set('reference_number', e.target.value)}
                  style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px', borderColor: '#cbd5e1' }}
                />
              </div>

              {/* Invoice Date */}
              <div>
                <ZohoLabel required>Invoice Date</ZohoLabel>
                <input
                  type="date"
                  className="input-field"
                  value={invoiceForm.invoice_date}
                  required
                  onChange={e => {
                    const nd = e.target.value
                    setInvoiceForm(p => ({
                      ...p,
                      invoice_date: nd,
                      due_date: calcDueDate(nd, p.payment_terms)
                    }))
                  }}
                  style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px', borderColor: '#cbd5e1' }}
                />
              </div>

              {/* Payment Terms */}
              <div>
                <ZohoLabel>Terms</ZohoLabel>
                <select
                  className="input-field"
                  value={invoiceForm.payment_terms}
                  onChange={e => {
                    const nt = e.target.value
                    setInvoiceForm(p => ({
                      ...p,
                      payment_terms: nt,
                      due_date: calcDueDate(p.invoice_date, nt)
                    }))
                  }}
                  style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px', borderColor: '#cbd5e1' }}
                >
                  {PAYMENT_TERMS_OPTIONS.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <ZohoLabel hint="Calculated according to selected payment terms">Due Date</ZohoLabel>
                <input
                  type="date"
                  className="input-field"
                  value={invoiceForm.due_date}
                  onChange={e => set('due_date', e.target.value)}
                  style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px', borderColor: '#cbd5e1' }}
                />
              </div>

              {/* Supply Date */}
              <div>
                <ZohoLabel hint="Date services/goods were delivered (ZATCA requirement)">Supply Date</ZohoLabel>
                <input
                  type="date"
                  className="input-field"
                  value={invoiceForm.supply_date}
                  onChange={e => set('supply_date', e.target.value)}
                  style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px', borderColor: '#cbd5e1' }}
                />
              </div>

              {/* Linked Job Order */}
              <div>
                <ZohoLabel hint="Link with a project or Job Order">Job Order</ZohoLabel>
                <select
                  className="input-field"
                  value={invoiceForm.job_order}
                  onChange={e => handleJobSelect(e.target.value)}
                  style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px', borderColor: '#cbd5e1' }}
                >
                  <option value="">— Direct Invoice (None) —</option>
                  {jobOrders.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.order_id ? `[${j.order_id}] ` : ''}{j.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bank Account */}
              <div>
                <ZohoLabel hint="Remittance bank account printed on PDF invoice">Deposit To / Bank</ZohoLabel>
                <select
                  className="input-field"
                  value={invoiceForm.bank_account}
                  onChange={e => set('bank_account', e.target.value)}
                  style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px', borderColor: '#cbd5e1' }}
                >
                  <option value="">— Select Bank Account —</option>
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} · {b.account_number}
                    </option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* Line Items Table (Classic Zoho Books Item Grid) */}
          <div className="builder-card-section" style={{ padding: '1.75rem 2rem' }}>
            
            {/* Header: Item Details Title + Import from Estimate Shortcut */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.85rem',
              flexWrap: 'wrap',
              gap: '0.6rem'
            }}>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Item Details
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '400' }}>
                  (Pick from price chart or type custom details)
                </span>
              </div>

              {estimations.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileSpreadsheet size={14} color="#2563eb" />
                  <select
                    defaultValue=""
                    onChange={e => {
                      if (e.target.value) {
                        handleImportFromEstimate(e.target.value)
                        e.target.value = ''
                      }
                    }}
                    style={{
                      height: '28px',
                      fontSize: '12px',
                      padding: '0 8px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#1e293b',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    <option value="">📥 Load items from Estimate...</option>
                    {estimations.map(est => (
                      <option key={est.id} value={est.id}>
                        {est.estimate_number || 'EST'} - {est.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="desktop-only-table" style={{
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              overflowX: 'auto',
              marginBottom: '1rem'
            }}>
              <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ width: '38px', padding: '10px 12px', textAlign: 'center', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>#</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Item Details</th>
                    <th style={{ width: '85px', padding: '10px 8px', textAlign: 'center', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Quantity</th>
                    <th style={{ width: '90px', padding: '10px 8px', textAlign: 'center', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Unit</th>
                    <th style={{ width: '115px', padding: '10px 8px', textAlign: 'right', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Rate ({currency})</th>
                    <th style={{ width: '80px', padding: '10px 8px', textAlign: 'center', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Disc (%)</th>
                    <th style={{ width: '95px', padding: '10px 8px', textAlign: 'center', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Tax</th>
                    <th style={{ width: '120px', padding: '10px 16px', textAlign: 'right', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Amount ({currency})</th>
                    <th style={{ width: '40px', padding: '10px 8px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceForm.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
                      
                      {/* Row Index */}
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                        {idx + 1}
                      </td>

                      {/* Description & Quick Material Picker */}
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <textarea
                            rows={2}
                            className="input-field"
                            value={item.description}
                            onChange={e => handleItemChange(idx, 'description', e.target.value)}
                            required
                            style={{
                              fontSize: '13px',
                              padding: '6px 8px',
                              minHeight: '40px',
                              resize: 'vertical',
                              borderRadius: '4px',
                              borderColor: '#e2e8f0'
                            }}
                          />
                          {materials.length > 0 && (
                            <select
                              value={item.material || ''}
                              onChange={e => handleSelectMaterialForItem(idx, e.target.value)}
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
                                marginTop: '4px',
                                transition: 'border-color 0.15s ease'
                              }}
                            >
                              <option value="">⚡ Pick from Price Chart...</option>
                              {materials.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.name} {m.measurements ? `(${m.measurements})` : ''} - {m.customer_price} {currency}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>

                      {/* Quantity */}
                      <td style={{ padding: '8px 8px', verticalAlign: 'top' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="input-field"
                          value={item.quantity}
                          onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                          style={{
                            height: '34px',
                            fontSize: '13px',
                            textAlign: 'center',
                            borderRadius: '4px',
                            borderColor: '#e2e8f0'
                          }}
                        />
                      </td>

                      {/* Unit */}
                      <td style={{ padding: '8px 8px', verticalAlign: 'top' }}>
                        <select
                          className="input-field"
                          value={item.unit}
                          onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                          style={{
                            height: '34px',
                            fontSize: '12.5px',
                            padding: '0 4px',
                            borderRadius: '4px',
                            borderColor: '#e2e8f0'
                          }}
                        >
                          {UNIT_OPTIONS.map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>

                      {/* Rate */}
                      <td style={{ padding: '8px 8px', verticalAlign: 'top' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input-field"
                          value={item.unit_price}
                          onChange={e => handleItemChange(idx, 'unit_price', e.target.value)}
                          style={{
                            height: '34px',
                            fontSize: '13px',
                            textAlign: 'right',
                            fontWeight: '600',
                            borderRadius: '4px',
                            borderColor: '#e2e8f0'
                          }}
                        />
                      </td>

                      {/* Discount % */}
                      <td style={{ padding: '8px 8px', verticalAlign: 'top' }}>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          className="input-field"
                          value={item.discount_rate}
                          onChange={e => handleItemChange(idx, 'discount_rate', e.target.value)}
                          style={{
                            height: '34px',
                            fontSize: '13px',
                            textAlign: 'center',
                            borderRadius: '4px',
                            borderColor: '#e2e8f0'
                          }}
                        />
                      </td>

                      {/* Tax Rate */}
                      <td style={{ padding: '8px 8px', verticalAlign: 'top' }}>
                        <select
                          className="input-field"
                          value={item.tax_rate}
                          onChange={e => handleItemChange(idx, 'tax_rate', e.target.value)}
                          style={{
                            height: '34px',
                            fontSize: '12.5px',
                            borderRadius: '4px',
                            borderColor: '#e2e8f0'
                          }}
                        >
                          <option value={15}>15% VAT</option>
                          <option value={0}>0% Zero</option>
                          <option value={5}>5% VAT</option>
                        </select>
                      </td>

                      {/* Line Amount */}
                      <td style={{ padding: '14px 16px 8px', textAlign: 'right', verticalAlign: 'top', fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                        {formatCurrency(item.total || 0)}
                      </td>

                      {/* Delete button */}
                      <td style={{ padding: '8px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          title="Delete row"
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '4px',
                            border: 'none',
                            background: 'transparent',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.15s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Native App Item Cards */}
            <div className="mobile-only-cards" style={{ marginBottom: '1rem' }}>
              {invoiceForm.items.map((item, idx) => (
                <div key={idx} className="builder-mobile-item-card">
                  <div className="builder-mobile-item-header">
                    <span style={{ fontWeight: '700', fontSize: '13px', color: '#1366d9' }}>
                      Item #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        padding: '2px 6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>

                  <div style={{ marginBottom: '0.65rem' }}>
                    <ZohoLabel required>Item Description</ZohoLabel>
                    <textarea
                      rows={2}
                      className="input-field"
                      value={item.description}
                      onChange={e => handleItemChange(idx, 'description', e.target.value)}
                      required
                      style={{ fontSize: '13px', padding: '6px 8px', width: '100%', resize: 'vertical' }}
                    />
                    {materials.length > 0 && (
                      <div style={{ marginTop: '6px' }}>
                        <select
                          value={item.material || ''}
                          onChange={e => handleSelectMaterialForItem(idx, e.target.value)}
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
                              {m.name} {m.measurements ? `(${m.measurements})` : ''} - {m.customer_price} {currency}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.65rem' }}>
                    <div>
                      <ZohoLabel>Quantity</ZohoLabel>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="input-field"
                        value={item.quantity}
                        onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                        style={{ height: '36px', fontSize: '13px', width: '100%' }}
                      />
                    </div>
                    <div>
                      <ZohoLabel>Unit</ZohoLabel>
                      <select
                        className="input-field"
                        value={item.unit}
                        onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                        style={{ height: '36px', fontSize: '13px', width: '100%' }}
                      >
                        {UNIT_OPTIONS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <ZohoLabel>Rate ({currency})</ZohoLabel>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input-field"
                        value={item.unit_price}
                        onChange={e => handleItemChange(idx, 'unit_price', e.target.value)}
                        style={{ height: '36px', fontSize: '13px', fontWeight: '600', width: '100%' }}
                      />
                    </div>
                    <div>
                      <ZohoLabel>Discount (%)</ZohoLabel>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        className="input-field"
                        value={item.discount_rate}
                        onChange={e => handleItemChange(idx, 'discount_rate', e.target.value)}
                        style={{ height: '36px', fontSize: '13px', width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Tax:</span>
                      <select
                        className="input-field"
                        value={item.tax_rate}
                        onChange={e => handleItemChange(idx, 'tax_rate', e.target.value)}
                        style={{ height: '30px', fontSize: '12px', padding: '0 6px', width: 'auto' }}
                      >
                        <option value={15}>15% VAT</option>
                        <option value={0}>0% Zero</option>
                        <option value={5}>5% VAT</option>
                      </select>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Line Total</span>
                      <span style={{ fontWeight: '800', fontSize: '14.5px', color: '#1366d9' }}>
                        {formatCurrency(item.total || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Zoho Add Row Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                type="button"
                onClick={handleAddItem}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#1366d9',
                  background: 'none',
                  border: 'none',
                  padding: '4px 8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <Plus size={15} /> Add another line
              </button>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                ({invoiceForm.items.length} {invoiceForm.items.length === 1 ? 'item' : 'items'})
              </span>
            </div>

          </div>

          {/* Bottom Split Section: Notes on Left, Zoho Summary Box on Right */}
          <div className="builder-split-bottom" style={{
            padding: '1.75rem 2rem 2.25rem',
            borderTop: '1px solid #f1f5f9',
            display: 'grid',
            gridTemplateColumns: 'minmax(350px, 1fr) 380px',
            gap: '2.5rem',
            alignItems: 'start'
          }}>

            {/* Left: Customer Notes & Terms */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <ZohoLabel hint="Notes that will appear on the printed tax invoice document">Customer Notes</ZohoLabel>
                <textarea
                  className="input-field"
                  rows={3}
                  value={invoiceForm.notes}
                  onChange={e => set('notes', e.target.value)}
                  style={{ fontSize: '13px', borderRadius: '6px', borderColor: '#cbd5e1', resize: 'vertical' }}
                />
              </div>

              <div>
                <ZohoLabel hint="Legal terms, payment terms, or warranties">Terms & Conditions</ZohoLabel>
                <textarea
                  className="input-field"
                  rows={3}
                  value={invoiceForm.terms_conditions}
                  onChange={e => set('terms_conditions', e.target.value)}
                  style={{ fontSize: '13px', borderRadius: '6px', borderColor: '#cbd5e1', resize: 'vertical' }}
                />
              </div>

              {/* Dynamic Custom Fields if present */}
              <div>
                <DynamicCustomFields
                  formType="invoice"
                  values={invoiceForm.custom_fields || {}}
                  onChange={(key, val) => setInvoiceForm(p => ({
                    ...p,
                    custom_fields: { ...(p.custom_fields || {}), [key]: val }
                  }))}
                />
              </div>
            </div>

            {/* Right: Calculation Summary Box (Pure Zoho Books Layout) */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.25rem 1.5rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              
              {/* Sub Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', fontSize: '13.5px' }}>
                <span style={{ color: '#475569', fontWeight: '500' }}>Sub Total</span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>{formatCurrency(totals.subtotal)}</span>
              </div>

              {/* Discount Input */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', fontSize: '13.5px' }}>
                <span style={{ color: '#475569', fontWeight: '500' }}>Discount</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={invoiceForm.discount_amount}
                    onChange={e => set('discount_amount', e.target.value)}
                    style={{
                      width: '90px',
                      height: '30px',
                      textAlign: 'right',
                      padding: '0 6px',
                      fontSize: '13px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontWeight: '600'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{currency}</span>
                </div>
              </div>

              {/* VAT (15%) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', fontSize: '13.5px' }}>
                <span style={{ color: '#475569', fontWeight: '500' }}>VAT (15% KSA)</span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>{formatCurrency(totals.totalTax)}</span>
              </div>

              {/* Grand Total Row (Zoho Books Highlight) */}
              <div style={{
                borderTop: '2px solid #cbd5e1',
                marginTop: '0.75rem',
                paddingTop: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline'
              }}>
                <span style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a' }}>
                  Total ({currency})
                </span>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#1366d9', letterSpacing: '-0.01em' }}>
                  {formatCurrency(totals.grandTotal)}
                </span>
              </div>

              {/* Status Selector in summary box */}
              <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>Invoice Status:</span>
                <select
                  value={invoiceForm.status}
                  onChange={e => set('status', e.target.value)}
                  style={{
                    height: '28px',
                    fontSize: '12px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    borderColor: '#cbd5e1',
                    background: '#ffffff',
                    padding: '0 6px',
                    color: invoiceForm.status === 'Issued' ? '#1366d9' : invoiceForm.status === 'Paid' ? '#16a34a' : '#64748b'
                  }}
                >
                  {STATUS_CHOICES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Sticky Bottom Action Toolbar (Zoho Books Signature Bar) */}
      <div className="builder-sticky-bar" style={{
        position: 'sticky',
        bottom: 0,
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '0.85rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 90,
        boxShadow: '0 -4px 12px rgba(0,0,0,0.04)'
      }}>
        <div className="builder-sticky-info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '12.5px', color: '#64748b' }}>
          <ShieldCheck size={16} style={{ color: '#10b981', flexShrink: 0 }} />
          <span>VAT registered & ZATCA Phase 2 compliant</span>
        </div>

        <div className="builder-sticky-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            style={{
              padding: '0.5rem 1.1rem',
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
            onClick={() => executeSave('Draft')}
            disabled={submitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.5rem 1.1rem',
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
            onClick={() => executeSave('Issued')}
            disabled={submitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1.35rem',
              fontSize: '13.5px',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              background: '#1366d9',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(19,102,217,0.3)'
            }}
          >
            {submitting ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
            {isEditing ? 'Save Changes' : 'Save & Send'}
          </button>
        </div>
      </div>

      {/* Quick Add Customer Modal */}
      <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title="New Customer">
        <form onSubmit={handleCreateCustomer}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1/-1' }}>
              <ZohoLabel required>Customer Name</ZohoLabel>
              <input
                type="text"
                className="input-field"
                value={newCustomerForm.name}
                onChange={e => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                required
                autoFocus
                style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1/-1' }}>
              <ZohoLabel>Company Name</ZohoLabel>
              <input
                type="text"
                className="input-field"
                value={newCustomerForm.company_name || ''}
                onChange={e => setNewCustomerForm({ ...newCustomerForm, company_name: e.target.value })}
                style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <ZohoLabel>Phone Number</ZohoLabel>
              <input
                type="text"
                className="input-field"
                value={newCustomerForm.phone}
                onChange={e => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <ZohoLabel>Email Address</ZohoLabel>
              <input
                type="email"
                className="input-field"
                value={newCustomerForm.email}
                onChange={e => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '1.25rem', gridColumn: '1/-1' }}>
              <ZohoLabel>Billing Address</ZohoLabel>
              <textarea
                className="input-field"
                rows={2}
                value={newCustomerForm.address}
                onChange={e => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                style={{ fontSize: '13px', borderRadius: '6px' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCustomerModalOpen(false)}
              disabled={submittingCustomer}
              style={{ padding: '0.45rem 1rem', fontSize: '13px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submittingCustomer}
              style={{ padding: '0.45rem 1.25rem', fontSize: '13px', background: '#1366d9', borderColor: '#1366d9' }}
            >
              {submittingCustomer ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  )
}

export default InvoiceBuilder
