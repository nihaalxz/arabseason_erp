import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  ArrowDownTray, Edit, Trash2, Plus, 
  CreditCard, X
} from '../components/icons'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'
import SkeletonLoader from '../components/common/SkeletonLoader'
import PageHeaderButton from '../components/common/PageHeaderButton'
import CredSearchInput from '../components/cashbook/cred/CredSearchInput'
import PlainFilterDropdown from '../components/common/PlainFilterDropdown'
import CredPagination from '../components/cashbook/cred/CredPagination'
import { ModalShell } from '../components/common/FormPrimitives'
import { showConfirm, showError, showToast, showSuccess } from '../utils/swal'
import { handlePdfResponse } from '../utils/pdfDownload'

const STATUS_FILTER_OPTIONS = [
  { value: 'All', label: 'All Statuses' },
  { value: 'Issued', label: 'Issued' },
  { value: 'Partially Paid', label: 'Partially Paid' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Overdue', label: 'Overdue' }
]

const formatTabular = (num) => {
  const val = parseFloat(num) || 0
  const parts = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {parts[0]}<span style={{ opacity: 0.55, fontSize: '0.85em' }}>.{parts[1]}</span>
    </span>
  )
}

const Invoices = () => {
  const { settings } = useSettings()
  const currency = settings?.currency || 'SAR'
  const navigate = useNavigate()

  // Data states
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingPdfId, setDownloadingPdfId] = useState(null)

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState('All')
  const [customerFilter, setCustomerFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCard, setActiveCard] = useState(null) // null | 'invoiced' | 'collected' | 'outstanding' | 'overdue'
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  // Quick Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [targetInvoiceForPayment, setTargetInvoiceForPayment] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentNotes, setPaymentNotes] = useState('')
  const [submittingPayment, setSubmittingPayment] = useState(false)

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
    fetchLookups()
    fetchInvoices()
  }, [])

  const fetchLookups = async () => {
    try {
      const cRes = await api.get('customers/?page_size=1000')
      setCustomers(cRes.data.results || cRes.data || [])
    } catch (err) {
      console.error('Failed to load customers lookup:', err)
    }
  }

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const res = await api.get('invoices/?page_size=1000')
      setInvoices(res.data.results || res.data || [])
    } catch (err) {
      console.error('Failed to fetch invoices:', err)
      showError('Fetch Error', 'Unable to retrieve invoices list from server.')
    } finally {
      setLoading(false)
    }
  }

  // Delete Invoice
  const handleDeleteInvoice = async (inv) => {
    const confirmed = await showConfirm(
      'Move to Recycle Bin?',
      `Are you sure you want to move invoice ${inv.invoice_number} to the Recycle Bin? It can be restored at any time.`
    )
    if (!confirmed) return

    try {
      await api.delete(`invoices/${inv.id}/`)
      showToast(`Invoice ${inv.invoice_number} moved to Recycle Bin`, 'success')
      setInvoices(prev => prev.filter(i => i.id !== inv.id))
    } catch (err) {
      console.error('Failed to delete invoice:', err)
      showError('Delete Failed', 'Failed to delete invoice.')
    }
  }

  // Download PDF
  const handleDownloadPDF = async (inv) => {
    try {
      setDownloadingPdfId(inv.id)
      const res = await api.get(`invoices/${inv.id}/pdf/`, { responseType: 'blob' })
      handlePdfResponse(res, `tax_invoice_${inv.invoice_number}.pdf`)
      showToast('PDF downloaded successfully', 'success')
    } catch (err) {
      console.error('Failed to download invoice PDF:', err)
      showError('Download Failed', 'Could not generate or download invoice PDF from server.')
    } finally {
      setDownloadingPdfId(null)
    }
  }

  // Quick Payment Modal Handlers
  const handleOpenPaymentModal = (inv) => {
    setTargetInvoiceForPayment(inv)
    const bal = parseFloat(inv.balance_due) || 0
    setPaymentAmount(bal > 0 ? Number(bal).toFixed(2) : '')
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentNotes(`Payment for Invoice ${inv.invoice_number}`)
    setIsPaymentModalOpen(true)
  }

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
      showSuccess('Payment Recorded', `Payment of ${amt.toFixed(2)} ${currency} recorded successfully!`)
      setIsPaymentModalOpen(false)
      fetchInvoices()
    } catch (err) {
      console.error('Failed to record payment:', err)
      showError('Payment Failed', err.response?.data?.detail || 'Could not record payment.')
    } finally {
      setSubmittingPayment(false)
    }
  }

  // KPI Metrics Calculation (across all loaded invoices)
  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    let totalInvoiced = 0
    let totalCollected = 0
    let totalOutstanding = 0
    let totalOverdue = 0

    invoices.forEach(inv => {
      const tot = parseFloat(inv.total_amount) || 0
      const paid = parseFloat(inv.paid_amount) || 0
      const bal = parseFloat(inv.balance_due) !== undefined ? parseFloat(inv.balance_due) : Math.max(0, tot - paid)

      totalInvoiced += tot
      totalCollected += paid
      totalOutstanding += bal

      const isOverdue = inv.status === 'Overdue' || (bal > 0 && inv.due_date && inv.due_date < today)
      if (isOverdue) {
        totalOverdue += bal
      }
    })

    return { totalInvoiced, totalCollected, totalOutstanding, totalOverdue }
  }, [invoices])

  // KPI Card Click Handler: resets status dropdown to "All Statuses"
  const handleCardClick = (cardKey) => {
    if (activeCard === cardKey) {
      setActiveCard(null)
    } else {
      setActiveCard(cardKey)
      setStatusFilter('All')
    }
    setPage(1)
  }

  // Status Filter Change Handler: clears active card
  const handleStatusChange = (val) => {
    setStatusFilter(val)
    setActiveCard(null)
    setPage(1)
  }

  // Combined client filtering
  const filteredInvoices = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return invoices.filter(inv => {
      const tot = parseFloat(inv.total_amount) || 0
      const paid = parseFloat(inv.paid_amount) || 0
      const bal = parseFloat(inv.balance_due) !== undefined ? parseFloat(inv.balance_due) : Math.max(0, tot - paid)

      // Active card filter
      if (activeCard === 'collected') {
        if (!(inv.status === 'Paid' || inv.status === 'Partially Paid' || paid > 0)) return false
      } else if (activeCard === 'outstanding') {
        if (bal <= 0) return false
      } else if (activeCard === 'overdue') {
        const isOverdue = inv.status === 'Overdue' || (bal > 0 && inv.due_date && inv.due_date < today)
        if (!isOverdue) return false
      }
      // 'invoiced' or null shows all

      // Status dropdown filter
      if (statusFilter && statusFilter !== 'All') {
        if (statusFilter === 'Overdue') {
          const isOverdue = inv.status === 'Overdue' || (bal > 0 && inv.due_date && inv.due_date < today)
          if (!isOverdue) return false
        } else if (inv.status !== statusFilter) {
          return false
        }
      }

      // Customer filter
      if (customerFilter && String(inv.customer) !== String(customerFilter)) {
        return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const num = (inv.invoice_number || '').toLowerCase()
        const cname = (inv.customer_name || '').toLowerCase()
        const ref = (inv.reference_number || '').toLowerCase()
        const job = (inv.job_order_title || inv.job_order_code || '').toLowerCase()
        if (!num.includes(q) && !cname.includes(q) && !ref.includes(q) && !job.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [invoices, activeCard, statusFilter, customerFilter, searchQuery])

  // Client pagination
  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE) || 1
  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredInvoices.slice(start, start + PAGE_SIZE)
  }, [filteredInvoices, page])

  // Customer dropdown options
  const customerDropdownOptions = useMemo(() => [
    { value: '', label: 'All Customers' },
    ...customers.map(c => ({
      value: String(c.id),
      label: c.name + (c.company_name ? ` (${c.company_name})` : '')
    }))
  ], [customers])

  return (
    <div className="invoices-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      
      {/* ── 1. PAGE HEADER (Quotations / Enquiries style) ── */}
      <div className="page-header" style={{
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--text, #0A0A0A)',
            letterSpacing: '-0.02em'
          }}>
            Invoices
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PageHeaderButton to="/invoices/new">
            New Invoice
          </PageHeaderButton>
        </div>
      </div>

      {/* ── 2. KPI CARDS (4 cards, Customers/Quotations style with active 2px ink border) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Card 1: Total Invoiced */}
        <div
          onClick={() => handleCardClick('invoiced')}
          style={{
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'invoiced' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Total invoiced
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span>{Math.round(metrics.totalInvoiced).toLocaleString('en-US')}</span>
            <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>
          </div>
        </div>

        {/* Card 2: Total Collected */}
        <div
          onClick={() => handleCardClick('collected')}
          style={{
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'collected' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Total collected
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span>{Math.round(metrics.totalCollected).toLocaleString('en-US')}</span>
            <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>
          </div>
        </div>

        {/* Card 3: Outstanding */}
        <div
          onClick={() => handleCardClick('outstanding')}
          style={{
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'outstanding' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Outstanding
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span>{Math.round(metrics.totalOutstanding).toLocaleString('en-US')}</span>
            <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>
          </div>
        </div>

        {/* Card 4: Overdue */}
        <div
          onClick={() => handleCardClick('overdue')}
          style={{
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'overdue' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Overdue
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span>{Math.round(metrics.totalOverdue).toLocaleString('en-US')}</span>
            <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>
          </div>
        </div>
      </div>

      {/* ── 3. TOOLBAR (Search + Plain status dropdown + Plain customer dropdown) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '16px',
        flexWrap: 'wrap'
      }}>
        {/* Search: borderless filled bar */}
        <CredSearchInput
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          onClear={() => { setSearchQuery(''); setPage(1); }}
          placeholder="Search invoices…"
          style={{ flex: '1 1 240px', minWidth: '200px', height: '38px' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status: Plain Filter Dropdown */}
          <PlainFilterDropdown
            id="invoices-status-filter"
            value={statusFilter}
            onChange={handleStatusChange}
            options={STATUS_FILTER_OPTIONS}
            minWidth={140}
            ariaLabel="Filter Invoice Status"
          />

          {/* Customer: Plain Filter Dropdown */}
          <PlainFilterDropdown
            id="invoices-customer-filter"
            value={customerFilter}
            onChange={(val) => { setCustomerFilter(val); setPage(1); }}
            options={customerDropdownOptions}
            minWidth={170}
            ariaLabel="Filter Customer"
          />
        </div>
      </div>

      {/* ── 4. TABLE VIEW ── */}
      {loading ? (
        <div style={{ padding: '24px 0' }}><SkeletonLoader count={5} /></div>
      ) : filteredInvoices.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--card-bg, #FFFFFF)',
          borderRadius: '16px',
          border: '1px solid var(--border, #E4E4E4)',
          color: 'var(--text-muted, #8C8C8C)'
        }}>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>No invoices match your criteria.</p>
          <PageHeaderButton to="/invoices/new">
            New Invoice
          </PageHeaderButton>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="table-responsive-wrapper desktop-only" style={{
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--border, #E4E4E4)',
            overflowX: 'auto',
            overflowY: 'hidden',
            marginBottom: '16px'
          }}>
            <table style={{
              width: '100%',
              tableLayout: 'fixed',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px'
            }}>
              <colgroup>
                <col style={{ width: '14%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '130px' }} />
                {customColumns.map(col => (
                  <col key={col.id} style={{ width: '100px' }} />
                ))}
                <col style={{ width: '180px' }} />
              </colgroup>
              <thead>
                <tr style={{
                  borderBottom: '1px solid var(--border, #E4E4E4)',
                  background: 'var(--bg-subtle, #F7F7F7)'
                }}>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Invoice #</th>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Customer</th>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Date</th>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Project</th>
                  <th style={{ padding: '10px 16px 10px 8px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', whiteSpace: 'nowrap' }}>Total</th>
                  <th style={{ padding: '10px 16px 10px 8px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', whiteSpace: 'nowrap' }}>Paid</th>
                  <th style={{ padding: '10px 16px 10px 8px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', whiteSpace: 'nowrap' }}>Balance Due</th>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Status</th>
                  {customColumns.map(col => (
                    <th key={col.id} style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)' }}>{col.label}</th>
                  ))}
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInvoices.map(inv => {
                  const today = new Date().toISOString().split('T')[0]
                  const tot = parseFloat(inv.total_amount) || 0
                  const paid = parseFloat(inv.paid_amount) || 0
                  const bal = parseFloat(inv.balance_due) !== undefined ? parseFloat(inv.balance_due) : Math.max(0, tot - paid)
                  const isOverdue = inv.status === 'Overdue' || (bal > 0 && inv.due_date && inv.due_date < today)
                  const canRecordPayment = inv.status !== 'Draft' && inv.status !== 'Paid' && bal > 0

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                      style={{
                        borderBottom: '1px solid var(--border, #E4E4E4)',
                        cursor: 'pointer',
                        transition: 'background-color 0.1s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Invoice # */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <Link
                          to={`/invoices/${inv.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            color: 'var(--text, #111111)',
                            textDecoration: 'none',
                            fontFamily: 'inherit',
                            fontWeight: 500,
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: '13px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                        >
                          {inv.invoice_number}
                        </Link>
                        {inv.reference_number && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', fontWeight: 400 }}>
                            Ref: {inv.reference_number}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {inv.customer_name || '—'}
                        </div>
                        {inv.customer_phone && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                            {inv.customer_phone}
                          </div>
                        )}
                      </td>

                      {/* Date & Terms */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <div style={{ color: 'var(--text-muted, #8C8C8C)', fontVariantNumeric: 'tabular-nums' }}>
                          {inv.invoice_date || '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                          {inv.payment_terms || 'Due on Receipt'}
                        </div>
                      </td>

                      {/* Project */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', color: 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inv.job_order_title || inv.job_order_code ? (
                          <span style={{ color: 'var(--text, #111111)' }}>
                            {inv.job_order_code ? `${inv.job_order_code} · ` : ''}{inv.job_order_title || ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Total */}
                      <td style={{ padding: '12px 16px 12px 8px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--text, #111111)' }}>
                        {formatTabular(tot)} {currency}
                      </td>

                      {/* Paid */}
                      <td style={{ padding: '12px 16px 12px 8px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted, #8C8C8C)' }}>
                        {formatTabular(paid)} {currency}
                      </td>

                      {/* Balance Due */}
                      <td style={{ padding: '12px 16px 12px 8px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        {bal <= 0 ? (
                          <span style={{ color: 'var(--text-muted, #8C8C8C)', fontWeight: 400 }}>Settled</span>
                        ) : isOverdue ? (
                          <span style={{ color: '#dc2626' }}>{formatTabular(bal)} {currency}</span>
                        ) : (
                          <span style={{ color: 'var(--text, #111111)' }}>{formatTabular(bal)} {currency}</span>
                        )}
                      </td>

                      {/* Status: Plain text with small 6px dot */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12.5px',
                          color: 'var(--text, #111111)'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            flexShrink: 0,
                            backgroundColor: isOverdue && inv.status !== 'Paid'
                              ? 'var(--danger, #DC2626)'
                              : inv.status === 'Paid'
                              ? 'var(--success, #16A34A)'
                              : inv.status === 'Partially Paid'
                              ? '#f59e0b'
                              : inv.status === 'Issued'
                              ? 'var(--text, #111111)'
                              : 'var(--text-muted, #8C8C8C)'
                          }} />
                          {isOverdue && inv.status !== 'Paid' ? 'Overdue' : (inv.status || 'Issued')}
                        </span>
                      </td>

                      {/* Dynamic Custom Columns */}
                      {customColumns.map(col => (
                        <td key={col.id} style={{ padding: '12px 14px', verticalAlign: 'top', color: 'var(--text-muted, #8C8C8C)' }}>
                          {inv.custom_fields?.[col.name] !== undefined && inv.custom_fields?.[col.name] !== null
                            ? String(inv.custom_fields[col.name])
                            : '—'}
                        </td>
                      ))}

                      {/* Actions: 4 plain icon-only buttons with divider, right-aligned */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%', whiteSpace: 'nowrap' }}>
                          
                          {/* 1. Record Payment */}
                          {canRecordPayment ? (
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentModal(inv)}
                              title="Record payment"
                              aria-label="Record payment"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '6px',
                                cursor: 'pointer',
                                color: 'var(--text-muted, #8C8C8C)',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '28px',
                                height: '28px',
                                transition: 'color 0.15s ease, background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--text, #111111)'
                                e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              <CreditCard size={15} strokeWidth={1.8} />
                            </button>
                          ) : (
                            <div style={{ width: '28px', height: '28px' }} />
                          )}

                          {/* 2. Download PDF */}
                          <button
                            type="button"
                            onClick={() => handleDownloadPDF(inv)}
                            disabled={downloadingPdfId === inv.id}
                            title="Download PDF"
                            aria-label="Download PDF"
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '6px',
                              cursor: 'pointer',
                              color: 'var(--text-muted, #8C8C8C)',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              transition: 'color 0.15s ease, background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--text, #111111)'
                              e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }}
                          >
                            <ArrowDownTray size={15} strokeWidth={1.8} className={downloadingPdfId === inv.id ? 'animate-spin' : ''} />
                          </button>

                          {/* Thin 1px vertical divider */}
                          <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border, #E4E4E4)', margin: '0 2px', flexShrink: 0 }} />

                          {/* 3. Edit */}
                          <button
                            type="button"
                            onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                            title="Edit"
                            aria-label="Edit"
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '6px',
                              cursor: 'pointer',
                              color: 'var(--text-muted, #8C8C8C)',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              transition: 'color 0.15s ease, background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--text, #111111)'
                              e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }}
                          >
                            <Edit size={15} strokeWidth={1.8} />
                          </button>

                          {/* 4. Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(inv)}
                            title="Delete"
                            aria-label="Delete"
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '6px',
                              cursor: 'pointer',
                              color: 'var(--text-muted, #8C8C8C)',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
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
                            <Trash2 size={15} strokeWidth={1.8} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="mobile-only" style={{ display: 'none', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {paginatedInvoices.map(inv => {
              const today = new Date().toISOString().split('T')[0]
              const tot = parseFloat(inv.total_amount) || 0
              const paid = parseFloat(inv.paid_amount) || 0
              const bal = parseFloat(inv.balance_due) !== undefined ? parseFloat(inv.balance_due) : Math.max(0, tot - paid)
              const isOverdue = inv.status === 'Overdue' || (bal > 0 && inv.due_date && inv.due_date < today)
              const canRecordPayment = inv.status !== 'Draft' && inv.status !== 'Paid' && bal > 0

              return (
                <div
                  key={inv.id}
                  onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                  style={{
                    background: 'var(--card-bg, #FFFFFF)',
                    border: '1px solid var(--border, #E4E4E4)',
                    borderRadius: '12px',
                    padding: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text, #111111)', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                        {inv.invoice_number}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text, #111111)', marginTop: '2px' }}>
                        {inv.customer_name || '—'}
                      </div>
                    </div>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      color: 'var(--text, #111111)'
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: isOverdue && inv.status !== 'Paid' ? '#dc2626' : (inv.status === 'Paid' ? '#16A34A' : '#111111')
                      }} />
                      {isOverdue && inv.status !== 'Paid' ? 'Overdue' : (inv.status || 'Issued')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
                    <span>Date: {inv.invoice_date || '—'}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text, #111111)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatTabular(tot)} {currency}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border, #E4E4E4)' }}>
                    <div style={{ fontSize: '12px' }}>
                      {bal <= 0 ? (
                        <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>Settled</span>
                      ) : (
                        <span style={{ color: isOverdue ? '#dc2626' : 'var(--text, #111111)' }}>
                          Due: {formatTabular(bal)} {currency}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                      {canRecordPayment && (
                        <button
                          type="button"
                          onClick={() => handleOpenPaymentModal(inv)}
                          style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted, #8C8C8C)' }}
                        >
                          <CreditCard size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDownloadPDF(inv)}
                        style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted, #8C8C8C)' }}
                      >
                        <ArrowDownTray size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteInvoice(inv)}
                        style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted, #8C8C8C)' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          <CredPagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={filteredInvoices.length}
            rangeStart={(page - 1) * PAGE_SIZE + 1}
            rangeEnd={Math.min(page * PAGE_SIZE, filteredInvoices.length)}
          />
        </>
      )}

      {/* ── 5. RECORD PAYMENT MODAL (Enquiry Modal Shell Style) ── */}
      <ModalShell
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Record Payment for ${targetInvoiceForPayment?.invoice_number || 'Invoice'}`}
        maxWidth="500px"
      >
        <form onSubmit={handleSubmitPayment}>
          <div style={{
            background: 'var(--bg-subtle, #F7F7F7)',
            borderRadius: '10px',
            padding: '14px 16px',
            marginBottom: '18px',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>Customer:</span>
              <span style={{ fontWeight: 500, color: 'var(--text, #111111)' }}>{targetInvoiceForPayment?.customer_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>Invoice Total:</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--text, #111111)' }}>
                {formatTabular(targetInvoiceForPayment?.total_amount || 0)} {currency}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--border, #E4E4E4)' }}>
              <span style={{ fontWeight: 500, color: 'var(--text, #111111)' }}>Balance Due:</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#dc2626' }}>
                {formatTabular(targetInvoiceForPayment?.balance_due || 0)} {currency}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                Payment Amount ({currency})<span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={targetInvoiceForPayment?.balance_due || undefined}
                required
                autoFocus
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
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
                Payment Date<span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
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
                Payment Reference / Notes
              </label>
              <input
                type="text"
                placeholder="Optional transaction reference"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              disabled={submittingPayment}
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
              disabled={submittingPayment}
              style={{
                height: '36px',
                padding: '0 20px',
                backgroundColor: 'var(--black, #0A0A0A)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: submittingPayment ? 'not-allowed' : 'pointer'
              }}
            >
              {submittingPayment ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </ModalShell>

    </div>
  )
}

export default Invoices
