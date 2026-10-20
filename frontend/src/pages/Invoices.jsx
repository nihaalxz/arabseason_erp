import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, RefreshCw, Trash2, Edit, ArrowDownTray, 
  CreditCard, CheckCircle, Clock, AlertCircle, 
  FileText, Landmark, Users, Briefcase, Calendar, 
  ChevronRight, Receipt, XCircle, ArrowUpRight
} from '../components/icons'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'
import Modal from '../components/common/Modal'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { showConfirm, showError, showToast } from '../utils/swal'
import { handlePdfResponse } from '../utils/pdfDownload'
import DynamicCustomFields from '../components/common/DynamicCustomFields'

const PAYMENT_TERMS_OPTIONS = [
  'Due on Receipt',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  'Custom'
]

const STATUS_CHOICES = [
  'Draft',
  'Issued',
  'Partially Paid',
  'Paid',
  'Overdue',
  'Cancelled'
]

const DEFAULT_ITEM = {
  description: '',
  quantity: 1,
  unit: 'Unit',
  unit_price: 0,
  discount_rate: 0,
  tax_rate: 15,
  tax_amount: 0,
  total: 0
}

const Invoices = () => {
  const { settings, formatCurrency } = useSettings()
  const currency = settings?.currency || 'SAR'
  const navigate = useNavigate()

  // Data states
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [jobOrders, setJobOrders] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingPdfId, setDownloadingPdfId] = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('All')
  const [customerFilter, setCustomerFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  // Dynamic Custom Columns
  const [customColumns, setCustomColumns] = useState([])

  const fetchCustomColumns = async () => {
    try {
      const res = await api.get('custom-fields/', { params: { form_type: 'invoice' } })
      setCustomColumns((res.data || []).filter(f => f.show_in_table))
    } catch (e) {
      console.error('Failed to load custom invoice columns', e)
    }
  }

  useEffect(() => {
    fetchCustomColumns()
  }, [])

  // Modal States
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [submittingInvoice, setSubmittingInvoice] = useState(false)
  const [formError, setFormError] = useState('')

  // Invoice Form State
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: '',
    customer: '',
    customer_tax_number: '',
    billing_address: '',
    job_order: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    supply_date: '',
    payment_terms: 'Due on Receipt',
    status: 'Issued',
    reference_number: '',
    bank_account: '',
    notes: '',
    terms_conditions: '',
    items: [{ ...DEFAULT_ITEM }],
    custom_fields: {}
  })

  // Quick Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [targetInvoiceForPayment, setTargetInvoiceForPayment] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentNotes, setPaymentNotes] = useState('')
  const [submittingPayment, setSubmittingPayment] = useState(false)

  // Quick Customer Creation Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', company_name: '', phone: '', email: '', address: '' })
  const [submittingCustomer, setSubmittingCustomer] = useState(false)

  useEffect(() => {
    fetchInvoices()
    fetchLookups()
  }, [])

  const fetchLookups = async () => {
    try {
      const [cRes, jRes, bRes] = await Promise.all([
        api.get('customers/?page_size=1000'),
        api.get('job-orders/?page_size=1000&lookup=true'),
        api.get('banks/?page_size=100')
      ])
      setCustomers(cRes.data.results || cRes.data || [])
      setJobOrders(jRes.data.results || jRes.data || [])
      setBankAccounts(bRes.data.results || bRes.data || [])
    } catch (err) {
      console.error('Failed to load invoice lookups:', err)
    }
  }

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      let url = 'invoices/?page_size=1000'
      if (statusFilter && statusFilter !== 'All') url += `&status=${encodeURIComponent(statusFilter)}`
      if (customerFilter) url += `&customer=${customerFilter}`
      if (dateRange.start) url += `&start_date=${dateRange.start}`
      if (dateRange.end) url += `&end_date=${dateRange.end}`
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`

      const res = await api.get(url)
      setInvoices(res.data.results || res.data || [])
    } catch (err) {
      console.error('Failed to fetch invoices:', err)
      showError('Fetch Error', 'Unable to retrieve invoices list from server.')
    } finally {
      setLoading(false)
    }
  }

  // Trigger re-fetch when search filters change with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInvoices()
    }, 250)
    return () => clearTimeout(timer)
  }, [statusFilter, customerFilter, dateRange.start, dateRange.end, searchQuery])

  // Get next sequential invoice number from backend
  const fetchNextInvoiceNumber = async () => {
    try {
      const res = await api.get('invoices/next-number/')
      return res.data?.next_number || `INV-${new Date().getFullYear()}-0001`
    } catch (e) {
      return `INV-${new Date().getFullYear()}-0001`
    }
  }

  // Calculate default due date based on payment terms
  const calculateDueDate = (issueDateStr, terms) => {
    if (!issueDateStr) return ''
    const d = new Date(issueDateStr)
    if (isNaN(d.getTime())) return ''
    if (terms === 'Net 15') d.setDate(d.getDate() + 15)
    else if (terms === 'Net 30') d.setDate(d.getDate() + 30)
    else if (terms === 'Net 45') d.setDate(d.getDate() + 45)
    else if (terms === 'Net 60') d.setDate(d.getDate() + 60)
    else if (terms === 'Due on Receipt') return issueDateStr
    return d.toISOString().split('T')[0]
  }

  // Open Create Invoice Modal
  const handleOpenCreateModal = async () => {
    setEditingInvoice(null)
    setFormError('')
    const nextNum = await fetchNextInvoiceNumber()
    const today = new Date().toISOString().split('T')[0]
    
    // Pick default active bank if exists
    const defaultBank = bankAccounts.find(b => b.status === 'Active') || bankAccounts[0]

    setInvoiceForm({
      invoice_number: nextNum,
      customer: '',
      customer_tax_number: '',
      billing_address: '',
      job_order: '',
      invoice_date: today,
      due_date: today,
      supply_date: today,
      payment_terms: 'Due on Receipt',
      status: 'Issued',
      reference_number: '',
      bank_account: defaultBank ? defaultBank.id : '',
      notes: 'Thank you for your business. Please remit payment as per bank details below.',
      terms_conditions: 'All payments must be received by the stated due date. Tax Invoice subject to Saudi VAT regulations.',
      items: [{ ...DEFAULT_ITEM }],
      custom_fields: {}
    })
    setIsInvoiceModalOpen(true)
  }

  // Open Edit Invoice Modal
  const handleOpenEditModal = (inv) => {
    setEditingInvoice(inv)
    setFormError('')
    
    const formattedItems = (inv.items && inv.items.length > 0)
      ? inv.items.map(it => ({
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
      notes: inv.notes || '',
      terms_conditions: inv.terms_conditions || '',
      items: formattedItems,
      custom_fields: inv.custom_fields || {}
    })
    setIsInvoiceModalOpen(true)
  }

  // Handle Customer Selection in Invoice Form
  const handleCustomerSelect = (customerId) => {
    const cust = customers.find(c => String(c.id) === String(customerId))
    setInvoiceForm(prev => ({
      ...prev,
      customer: customerId,
      customer_tax_number: cust?.tax_number || prev.customer_tax_number || '',
      billing_address: cust?.address || prev.billing_address || ''
    }))
  }

  // Handle Job Order Selection in Invoice Form
  const handleJobSelect = (jobId) => {
    const job = jobOrders.find(j => String(j.id) === String(jobId))
    if (!job) {
      setInvoiceForm(prev => ({ ...prev, job_order: '' }))
      return
    }

    setInvoiceForm(prev => {
      const updated = {
        ...prev,
        job_order: jobId,
        customer: prev.customer || job.customer || '',
        reference_number: prev.reference_number || job.order_id || ''
      }
      // If items only has one empty default item, populate with job title & amount
      if (prev.items.length === 1 && (!prev.items[0].description || prev.items[0].unit_price === 0)) {
        const amt = parseFloat(job.total_amount) || 0
        const basePrice = Number((amt / 1.15).toFixed(2))
        const taxAmt = Number((amt - basePrice).toFixed(2))
        updated.items = [{
          description: `Contract Services: ${job.order_id || ''} ${job.title}`.trim(),
          quantity: 1,
          unit: 'Lot',
          unit_price: basePrice > 0 ? basePrice : amt,
          discount_rate: 0,
          tax_rate: 15,
          tax_amount: basePrice > 0 ? taxAmt : Number((amt * 0.15).toFixed(2)),
          total: amt
        }]
      }
      return updated
    })
  }

  // Handle line item field change
  const handleItemChange = (index, field, value) => {
    setInvoiceForm(prev => {
      const newItems = [...prev.items]
      const itm = { ...newItems[index], [field]: value }

      const qty = parseFloat(itm.quantity) || 0
      const price = parseFloat(itm.unit_price) || 0
      const discPct = parseFloat(itm.discount_rate) || 0
      const taxRate = parseFloat(itm.tax_rate) !== undefined ? parseFloat(itm.tax_rate) : 15

      const base = qty * price
      const disc = base * (discPct / 100)
      const taxable = Math.max(0, base - disc)
      const tax = taxable * (taxRate / 100)
      const lineTotal = taxable + tax

      itm.tax_amount = Number(tax.toFixed(2))
      itm.total = Number(lineTotal.toFixed(2))

      newItems[index] = itm
      return { ...prev, items: newItems }
    })
  }

  const handleAddItem = () => {
    setInvoiceForm(prev => ({
      ...prev,
      items: [...prev.items, { ...DEFAULT_ITEM }]
    }))
  }

  const handleRemoveItem = (index) => {
    if (invoiceForm.items.length <= 1) {
      showToast('Invoice must have at least one line item', 'warning')
      return
    }
    setInvoiceForm(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }))
  }

  // Live Summary Totals
  const calculatedTotals = useMemo(() => {
    let subtotal = 0
    let totalTax = 0

    invoiceForm.items.forEach(itm => {
      const qty = parseFloat(itm.quantity) || 0
      const price = parseFloat(itm.unit_price) || 0
      const discPct = parseFloat(itm.discount_rate) || 0
      const taxRate = parseFloat(itm.tax_rate) !== undefined ? parseFloat(itm.tax_rate) : 15

      const base = qty * price
      const disc = base * (discPct / 100)
      const taxable = Math.max(0, base - disc)
      const tax = taxable * (taxRate / 100)

      subtotal += taxable
      totalTax += tax
    })

    const overallDiscount = parseFloat(invoiceForm.discount_amount) || 0
    const grandTotal = Math.max(0, (subtotal - overallDiscount) + totalTax)

    return {
      subtotal: Number(subtotal.toFixed(2)),
      overallDiscount,
      totalTax: Number(totalTax.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2))
    }
  }, [invoiceForm.items, invoiceForm.discount_amount])

  // Save Invoice (Create or Update)
  const handleSubmitInvoice = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!invoiceForm.invoice_number.trim()) {
      return setFormError('Invoice Number is required')
    }
    if (!invoiceForm.customer) {
      return setFormError('Please select a Customer for this invoice')
    }
    if (!invoiceForm.items || invoiceForm.items.length === 0) {
      return setFormError('Please add at least one line item')
    }
    for (let i = 0; i < invoiceForm.items.length; i++) {
      if (!invoiceForm.items[i].description.trim()) {
        return setFormError(`Line Item #${i + 1} requires a description`)
      }
    }

    try {
      setSubmittingInvoice(true)
      const payload = {
        invoice_number: invoiceForm.invoice_number.trim(),
        customer: invoiceForm.customer,
        customer_tax_number: invoiceForm.customer_tax_number || '',
        billing_address: invoiceForm.billing_address || '',
        job_order: invoiceForm.job_order || null,
        invoice_date: invoiceForm.invoice_date,
        due_date: invoiceForm.due_date || null,
        supply_date: invoiceForm.supply_date || null,
        payment_terms: invoiceForm.payment_terms,
        status: invoiceForm.status,
        reference_number: invoiceForm.reference_number || '',
        bank_account: invoiceForm.bank_account || null,
        discount_amount: calculatedTotals.overallDiscount,
        subtotal: calculatedTotals.subtotal,
        tax_rate: 15.00,
        tax_amount: calculatedTotals.totalTax,
        notes: invoiceForm.notes,
        terms_conditions: invoiceForm.terms_conditions,
        custom_fields: invoiceForm.custom_fields || {},
        items: invoiceForm.items.map((it, idx) => ({
          description: it.description,
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

      if (editingInvoice) {
        const res = await api.put(`invoices/${editingInvoice.id}/`, payload)
        setInvoices(prev => prev.map(inv => inv.id === editingInvoice.id ? res.data : inv))
        showToast('Invoice updated successfully', 'success')
      } else {
        const res = await api.post('invoices/', payload)
        setInvoices(prev => [res.data, ...prev])
        showToast('Invoice created successfully', 'success')
      }

      setIsInvoiceModalOpen(false)
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
      setSubmittingInvoice(false)
    }

  }

  // Delete Invoice
  const handleDeleteInvoice = async (inv) => {
    const confirmed = await showConfirm({
      title: `Move ${inv.invoice_number} to Recycle Bin?`,
      text: `Are you sure you want to move invoice ${inv.invoice_number} for ${inv.customer_name || 'this customer'} to the Recycle Bin? It can be restored at any time.`,
      confirmButtonText: 'Move to Recycle Bin',
      isDangerous: true
    })
    if (!confirmed) return

    try {
      await api.delete(`invoices/${inv.id}/`)
      setInvoices(prev => prev.filter(i => i.id !== inv.id))
      showToast(`Invoice ${inv.invoice_number} moved to Recycle Bin`, 'success')
    } catch (err) {
      console.error('Failed to delete invoice:', err)
      showError('Action Failed', 'Failed to move invoice to Recycle Bin.')
    }
  }

  // Download PDF
  const handleDownloadPDF = async (inv) => {
    try {
      setDownloadingPdfId(inv.id)
      const res = await api.get(`invoices/${inv.id}/pdf/`, {
        responseType: 'blob'
      })
      handlePdfResponse(res, `tax_invoice_${inv.invoice_number}.pdf`)
      showToast(`Invoice ${inv.invoice_number} downloaded`, 'success')
    } catch (err) {
      console.error('Failed to download invoice PDF:', err)
      showError('Download Failed', 'Could not generate or download invoice PDF from server.')
    } finally {
      setDownloadingPdfId(null)
    }
  }

  // Open Quick Payment Modal
  const handleOpenPaymentModal = (inv) => {
    setTargetInvoiceForPayment(inv)
    setPaymentAmount(inv.balance_due > 0 ? Number(inv.balance_due).toFixed(2) : '')
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentNotes(`Payment for Invoice ${inv.invoice_number}`)
    setIsPaymentModalOpen(true)

  }

  // Submit Quick Payment
  const handleSubmitPayment = async (e) => {
    e.preventDefault()
    const amt = parseFloat(paymentAmount)
    if (!amt || amt <= 0) {
      showToast('Please enter a valid payment amount', 'error')
      return
    }

    try {
      setSubmittingPayment(true)
      const payload = {
        customer: targetInvoiceForPayment.customer,
        job_order: targetInvoiceForPayment.job_order || null,
        invoice: targetInvoiceForPayment.id,
        amount: amt,
        payment_date: paymentDate,
        notes: paymentNotes
      }

      await api.post('customer-payments/', payload)
      showToast(`Payment of ${formatCurrency(amt)} recorded successfully!`, 'success')
      setIsPaymentModalOpen(false)
      fetchInvoices()
    } catch (err) {
      console.error('Failed to record invoice payment:', err)
      showError('Payment Failed', 'Failed to record customer payment on server.')
    } finally {
      setSubmittingPayment(false)
    }
  }

  // Quick Customer Creation
  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    if (!newCustomerForm.name.trim()) {
      showToast('Customer name is required', 'error')
      return
    }
    try {
      setSubmittingCustomer(true)
      const res = await api.post('customers/', newCustomerForm)
      setCustomers(prev => [...prev, res.data])
      setInvoiceForm(prev => ({
        ...prev,
        customer: res.data.id,
        billing_address: res.data.address || prev.billing_address
      }))
      setIsCustomerModalOpen(false)
      setNewCustomerForm({ name: '', company_name: '', phone: '', email: '', address: '' })
      showToast('Customer added successfully', 'success')
    } catch (err) {
      showError('Failed to Add Customer', 'Could not create new customer record.')
    } finally {
      setSubmittingCustomer(false)
    }
  }

  // Computed KPI Metrics
  const metrics = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let totalInvoiced = 0
    let totalCollected = 0
    let totalDue = 0
    let overdueCount = 0
    let overdueAmount = 0

    invoices.forEach(inv => {
      const tot = parseFloat(inv.total_amount) || 0
      const paid = parseFloat(inv.paid_amount) || 0
      const bal = parseFloat(inv.balance_due) || 0

      totalInvoiced += tot
      totalCollected += paid
      totalDue += bal

      if (bal > 0 && inv.due_date) {
        const due = new Date(inv.due_date)
        if (due < today) {
          overdueCount++
          overdueAmount += bal
        }
      }
    })

    return {
      totalInvoiced,
      totalCollected,
      totalDue,
      overdueCount,
      overdueAmount,
      totalCount: invoices.length
    }
  }, [invoices])

  const getStatusBadge = (status, dueDate, balanceDue) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const isOverdue = balanceDue > 0 && dueDate && new Date(dueDate) < today

    if (isOverdue && status !== 'Paid') {
      return <span className="badge badge-danger"><AlertCircle size={12} /> Overdue</span>
    }
    switch (status) {
      case 'Paid':
        return <span className="badge badge-success"><CheckCircle size={12} /> Paid</span>
      case 'Partially Paid':
        return <span className="badge badge-warning"><Clock size={12} /> Partially Paid</span>
      case 'Issued':
        return <span className="badge badge-info"><FileText size={12} /> Issued</span>
      case 'Draft':
        return <span className="badge badge-pending">Draft</span>
      case 'Cancelled':
        return <span className="badge badge-danger">Cancelled</span>
      default:
        return <span className="badge">{status}</span>
    }
  }

  return (
    <div className="invoices-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', paddingBottom: '2rem' }}>
      {/* ── Page Header ── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontWeight: '800', letterSpacing: '-0.02em', fontSize: '1.5rem', margin: 0, color: 'var(--text-main)' }}>
            Invoices & Billing
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: '0.2rem 0 0' }}>
            Generate tax invoices, calculate 15% VAT, issue client statements, and track settlement
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={fetchInvoices} 
            title="Refresh Invoices"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => navigate('/invoices/new')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.45rem 1.1rem', fontWeight: '600' }}
          >
            <Plus size={16} /> Create Invoice
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="mobile-2col-grid summary-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '0.85rem' }}>
        {/* Total Invoiced */}
        <div className="glass-panel mobile-kpi-compact" style={{ padding: '0.85rem 1rem', borderRadius: '10px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Total Invoiced
              </span>
              <h3 className="kpi-val" style={{ fontSize: '1.4rem', fontWeight: '800', margin: '0.25rem 0 0.15rem', color: 'var(--text-main)' }}>
                {formatCurrency(metrics.totalInvoiced)}
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>
                {metrics.totalCount} {metrics.totalCount === 1 ? 'invoice' : 'invoices'}
              </span>
            </div>
            <div className="kpi-icon" style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={18} />
            </div>
          </div>
        </div>

        {/* Collected / Paid */}
        <div className="glass-panel mobile-kpi-compact" style={{ padding: '0.85rem 1rem', borderRadius: '10px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Total Collected
              </span>
              <h3 className="kpi-val" style={{ fontSize: '1.4rem', fontWeight: '800', margin: '0.25rem 0 0.15rem', color: '#16a34a' }}>
                {formatCurrency(metrics.totalCollected)}
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>
                {metrics.totalInvoiced > 0 ? `${((metrics.totalCollected / metrics.totalInvoiced) * 100).toFixed(0)}% paid` : 'Settled'}
              </span>
            </div>
            <div className="kpi-icon" style={{ width: '38px', height: '38px', borderRadius: '8px', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(22, 163, 74, 0.12)', flexShrink: 0 }}>
              <CheckCircle size={18} />
            </div>
          </div>
        </div>

        {/* Outstanding Due */}
        <div className="glass-panel mobile-kpi-compact" style={{ padding: '0.85rem 1rem', borderRadius: '10px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Outstanding
              </span>
              <h3 className="kpi-val" style={{ fontSize: '1.4rem', fontWeight: '800', margin: '0.25rem 0 0.15rem', color: metrics.totalDue > 0 ? '#d97706' : 'var(--text-main)' }}>
                {formatCurrency(metrics.totalDue)}
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>
                Pending
              </span>
            </div>
            <div className="kpi-icon" style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(217, 119, 6, 0.12)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Clock size={18} />
            </div>
          </div>
        </div>

        {/* Overdue */}
        <div className="glass-panel mobile-kpi-compact" style={{ padding: '0.85rem 1rem', borderRadius: '10px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Overdue
              </span>
              <h3 className="kpi-val" style={{ fontSize: '1.4rem', fontWeight: '800', margin: '0.25rem 0 0.15rem', color: metrics.overdueAmount > 0 ? '#dc2626' : 'var(--text-main)' }}>
                {formatCurrency(metrics.overdueAmount)}
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>
                {metrics.overdueCount} past due
              </span>
            </div>
            <div className="kpi-icon" style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertCircle size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters & Search Control Bar ── */}
      <div className="glass-panel" style={{ padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Status Pills */}
          <div className="mobile-pills-scroll" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {['All', 'Issued', 'Partially Paid', 'Paid', 'Draft', 'Overdue'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  borderRadius: '20px',
                  border: '1px solid',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: statusFilter === st ? 'var(--primary)' : 'var(--bg-white-5)',
                  color: statusFilter === st ? '#fff' : 'var(--text-muted)',
                  borderColor: statusFilter === st ? 'var(--primary)' : 'var(--border-color)'
                }}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Search & Filter Inputs */}
          <div className="mobile-filter-stack" style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center', flex: '1', justifyContent: 'flex-end', minWidth: '240px' }}>
            {/* Customer Dropdown */}
            <select
              className="input-field mobile-full-input"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              style={{ maxWidth: '200px', fontSize: '0.825rem', padding: '0.45rem 0.75rem' }}
            >
              <option value="">All Customers</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Date Range Start & End */}
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '300px' }} className="mobile-full-input">
              <input
                type="date"
                className="input-field"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                style={{ flex: 1, fontSize: '0.825rem', padding: '0.45rem 0.6rem' }}
              />
              <input
                type="date"
                className="input-field"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                style={{ flex: 1, fontSize: '0.825rem', padding: '0.45rem 0.6rem' }}
              />
            </div>

            {/* Text Search */}
            <div style={{ position: 'relative', width: '220px' }} className="mobile-full-input">
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '2.2rem', fontSize: '0.825rem', paddingRight: '0.6rem' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Invoices Data Table ── */}
      <div className="glass-panel" style={{ padding: '0', borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem' }}>
            <SkeletonLoader type="table" />
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={48} style={{ opacity: 0.25, margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
              No Invoices Found
            </h3>
            <p style={{ fontSize: '0.875rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
              {searchQuery || statusFilter !== 'All' || customerFilter
                ? 'No invoices match your active filters. Try resetting the search or filter criteria.'
                : 'You have not created any customer invoices yet. Get started by clicking "Create Invoice".'}
            </p>
            <button className="btn btn-primary" onClick={handleOpenCreateModal}>
              <Plus size={16} /> Create First Invoice
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View (> 768px) */}
            <div className="desktop-only-table">
              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-white-5)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '0.9rem 1.25rem' }}>Invoice #</th>
                      <th style={{ padding: '0.9rem 1.25rem' }}>Customer / Billed To</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Date & Terms</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Project / Contract</th>
                      <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>Total (SAR)</th>
                      <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>Paid (SAR)</th>
                      <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>Balance Due</th>
                      {customColumns.map(col => (
                        <th key={col.id} style={{ padding: '0.9rem 1rem', whiteSpace: 'nowrap' }}>
                          {col.label}
                        </th>
                      ))}
                      <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => {
                      const tot = parseFloat(inv.total_amount) || 0
                      const paid = parseFloat(inv.paid_amount) || 0
                      const bal = parseFloat(inv.balance_due) || 0

                      return (
                        <tr 
                          key={inv.id} 
                          style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s ease' }}
                        >
                          {/* Invoice # */}
                          <td style={{ padding: '0.85rem 1.25rem' }}>
                            <div style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <FileText size={15} style={{ color: 'var(--primary)', opacity: 0.85 }} />
                              {inv.invoice_number}
                            </div>
                            {inv.reference_number && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.15rem' }}>
                                Ref: {inv.reference_number}
                              </span>
                            )}
                          </td>

                          {/* Customer */}
                          <td style={{ padding: '0.85rem 1.25rem' }}>
                            <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                              {inv.customer_name || 'N/A'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              {inv.customer_phone || inv.customer_email || ''}
                            </div>
                          </td>

                          {/* Date & Terms */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ color: 'var(--text-main)', fontSize: '0.825rem' }}>
                              {inv.invoice_date || 'N/A'}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {inv.payment_terms || 'Due on Receipt'}
                            </span>
                          </td>

                          {/* Project / Contract */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            {inv.job_order ? (
                              <div>
                                <span style={{ 
                                  background: 'rgba(59, 130, 246, 0.1)', 
                                  color: '#2563eb', 
                                  padding: '2px 7px', 
                                  borderRadius: '4px', 
                                  fontSize: '0.72rem', 
                                  fontWeight: '700' 
                                }}>
                                  {inv.job_order_code || 'JOB'}
                                </span>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {inv.job_order_title}
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>Direct Invoice</span>
                            )}
                          </td>

                          {/* Total Amount */}
                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                            {formatCurrency(tot)}
                          </td>

                          {/* Paid Amount */}
                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: '#16a34a', fontWeight: '600' }}>
                            {formatCurrency(paid)}
                          </td>

                          {/* Balance Due */}
                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '700' }}>
                            {bal > 0 ? (
                              <span style={{ color: '#dc2626' }}>{formatCurrency(bal)}</span>
                            ) : (
                              <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                                <CheckCircle size={14} /> Settled
                              </span>
                            )}
                          </td>

                          {/* Dynamic Custom Columns */}
                          {customColumns.map(col => (
                            <td key={col.id} style={{ padding: '0.85rem 1rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                              {inv.custom_fields?.[col.name] !== undefined && inv.custom_fields?.[col.name] !== ''
                                ? String(inv.custom_fields[col.name])
                                : '-'}
                            </td>
                          ))}

                          {/* Status */}
                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                            {getStatusBadge(inv.status, inv.due_date, bal)}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                              {/* Download PDF Button */}
                              <button
                                className="btn-icon"
                                onClick={() => handleDownloadPDF(inv)}
                                title="Download Official Tax Invoice PDF"
                                disabled={downloadingPdfId === inv.id}
                                style={{ padding: '0.45rem', borderRadius: '6px', color: '#2563eb' }}
                              >
                                <ArrowDownTray size={16} />
                              </button>

                              {/* Quick Payment Button (if balance due) */}
                              {bal > 0 && (
                                <button
                                  className="btn-icon"
                                  onClick={() => handleOpenPaymentModal(inv)}
                                  title="Record Payment against Invoice"
                                  style={{ padding: '0.45rem', borderRadius: '6px', color: '#16a34a' }}
                                >
                                  <CreditCard size={16} />
                                </button>
                              )}

                              {/* Edit Button */}
                              <button
                                className="btn-icon"
                                onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                                title="Edit Invoice"
                                style={{ padding: '0.45rem', borderRadius: '6px' }}
                              >
                                <Edit size={16} />
                              </button>

                              {/* Delete Button */}
                              <button
                                className="btn-icon"
                                onClick={() => handleDeleteInvoice(inv)}
                                title="Delete Invoice"
                                style={{ padding: '0.45rem', borderRadius: '6px', color: '#dc2626' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Native Cards View (<= 768px) */}
            <div className="mobile-only-cards" style={{ padding: '0.75rem' }}>
              {invoices.map((inv) => {
                const tot = parseFloat(inv.total_amount) || 0
                const paid = parseFloat(inv.paid_amount) || 0
                const bal = parseFloat(inv.balance_due) || 0

                return (
                  <div
                    key={inv.id}
                    className="mobile-entity-card"
                    onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                  >
                    {/* Header: Invoice # & Status Badge */}
                    <div className="mobile-card-header">
                      <div className="mobile-card-title-group">
                        <div
                          className="mobile-card-avatar"
                          style={{ background: '#eff6ff', color: '#1366d9' }}
                        >
                          <FileText size={18} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="mobile-card-title" style={{ color: '#1366d9', fontWeight: '800' }}>
                            {inv.invoice_number}
                          </div>
                          <div className="mobile-card-sub">
                            <span>{inv.invoice_date || 'N/A'}</span>
                            <span>• {inv.payment_terms || 'Due on Receipt'}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(inv.status, inv.due_date, bal)}
                      </div>
                    </div>

                    {/* Customer & Job Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.825rem' }}>
                      <div style={{ fontWeight: '700', color: '#1e293b' }}>
                        {inv.customer_name || 'N/A'}
                      </div>
                      {inv.job_order_title && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ background: '#eff6ff', color: '#2563eb', padding: '1px 5px', borderRadius: '4px', fontWeight: '600', fontSize: '0.7rem' }}>
                            {inv.job_order_code || 'JOB'}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {inv.job_order_title}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Financial Figures Grid */}
                    <div className="mobile-card-grid">
                      <div className="mobile-card-metric">
                        <span className="mobile-card-metric-label">Total</span>
                        <span className="mobile-card-metric-value">{formatCurrency(tot)}</span>
                      </div>
                      <div className="mobile-card-metric">
                        <span className="mobile-card-metric-label">Paid</span>
                        <span className="mobile-card-metric-value" style={{ color: '#16a34a' }}>{formatCurrency(paid)}</span>
                      </div>
                      <div className="mobile-card-metric">
                        <span className="mobile-card-metric-label">Balance</span>
                        <span className="mobile-card-metric-value" style={{ color: bal > 0 ? '#dc2626' : '#16a34a' }}>
                          {bal > 0 ? formatCurrency(bal) : 'Settled'}
                        </span>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="mobile-card-footer" onClick={e => e.stopPropagation()}>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0 }}>
                        {inv.reference_number ? `Ref: ${inv.reference_number}` : 'Tax Invoice'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(inv)}
                          disabled={downloadingPdfId === inv.id}
                          className="btn-icon"
                          style={{ padding: '0.35rem 0.55rem', borderRadius: '6px', color: '#2563eb', background: '#eff6ff', fontSize: '0.72rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}
                        >
                          <ArrowDownTray size={12} /> PDF
                        </button>
                        {bal > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal(inv)}
                            className="btn-icon"
                            style={{ padding: '0.35rem 0.55rem', borderRadius: '6px', color: '#16a34a', background: '#f0fdf4', fontSize: '0.72rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}
                          >
                            <CreditCard size={12} /> Pay
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                          className="btn-icon"
                          style={{ padding: '0.35rem', borderRadius: '6px', color: '#475569', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteInvoice(inv)}
                          className="btn-icon"
                          style={{ padding: '0.35rem', borderRadius: '6px', color: '#dc2626', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 2: RECORD PAYMENT AGAINST INVOICE ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Record Payment for ${targetInvoiceForPayment?.invoice_number || 'Invoice'}`}
      >
        <form onSubmit={handleSubmitPayment}>
          <div style={{
            background: 'var(--bg-white-5)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0.85rem',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
              <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{targetInvoiceForPayment?.customer_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Invoice Total:</span>
              <span style={{ fontWeight: '600' }}>{formatCurrency(targetInvoiceForPayment?.total_amount || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Balance Due:</span>
              <span style={{ fontWeight: '800', color: '#dc2626' }}>{formatCurrency(targetInvoiceForPayment?.balance_due || 0)}</span>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>
              Payment Amount ({currency}) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={targetInvoiceForPayment?.balance_due || undefined}
              className="input-field"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>
              Payment Date <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="date"
              className="input-field"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Payment Reference / Notes</label>
            <input
              type="text"
              className="input-field"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsPaymentModalOpen(false)}
              disabled={submittingPayment}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submittingPayment}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {submittingPayment ? <RefreshCw size={15} className="spin" /> : <CheckCircle size={16} />}
              Record Payment
            </button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 3: QUICK ADD CUSTOMER ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Quick Add Customer"
      >
        <form onSubmit={handleCreateCustomer}>
          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label style={{ fontSize: '0.825rem', fontWeight: '600' }}>Customer Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              className="input-field"
              value={newCustomerForm.name}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label style={{ fontSize: '0.825rem', fontWeight: '600' }}>Company Name</label>
            <input
              type="text"
              className="input-field"
              value={newCustomerForm.company_name || ''}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, company_name: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label style={{ fontSize: '0.825rem', fontWeight: '600' }}>Phone</label>
            <input
              type="text"
              className="input-field"
              value={newCustomerForm.phone}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label style={{ fontSize: '0.825rem', fontWeight: '600' }}>Email</label>
            <input
              type="email"
              className="input-field"
              value={newCustomerForm.email}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.825rem', fontWeight: '600' }}>Address</label>
            <textarea
              className="input-field"
              rows={2}
              value={newCustomerForm.address}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCustomerModalOpen(false)}
              disabled={submittingCustomer}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submittingCustomer}
            >
              {submittingCustomer ? 'Saving...' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Invoices
