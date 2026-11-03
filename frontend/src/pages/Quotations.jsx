import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  ArrowDownTray, ArrowUpRight, Edit, Trash2, Plus, 
  FileText
} from '../components/icons'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'
import SkeletonLoader from '../components/common/SkeletonLoader'
import PageHeaderButton from '../components/common/PageHeaderButton'
import CredSearchInput from '../components/cashbook/cred/CredSearchInput'
import PlainFilterDropdown from '../components/common/PlainFilterDropdown'
import CredPagination from '../components/cashbook/cred/CredPagination'
import { showConfirm, showError, showToast, showSuccess } from '../utils/swal'
import { handlePdfResponse } from '../utils/pdfDownload'

const STATUS_FILTER_OPTIONS = [
  { value: 'All', label: 'All Statuses' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Sent', label: 'Sent' },
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Declined', label: 'Declined' },
  { value: 'Converted to Invoice', label: 'Converted to Invoice' },
  { value: 'Expired', label: 'Expired' }
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

const Quotations = () => {
  const isAdmin = isCurrentUserAdmin()
  const { settings } = useSettings()
  const currency = settings?.currency || 'SAR'
  const navigate = useNavigate()
  const basePath = '/accounting'

  // Data states
  const [quotations, setQuotations] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingPdfId, setDownloadingPdfId] = useState(null)
  const [convertingId, setConvertingId] = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('All')
  const [customerFilter, setCustomerFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [activeCard, setActiveCard] = useState(null) // null | 'pipeline' | 'accepted' | 'pending' | 'converted'
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  // Dynamic Custom Columns
  const [customColumns, setCustomColumns] = useState([])

  const fetchCustomColumns = async () => {
    try {
      const res = await api.get('custom-fields/', { params: { form_type: 'quotation' } })
      setCustomColumns((res.data || []).filter(f => f.show_in_table))
    } catch (e) {
      console.error('Failed to load custom quotation columns', e)
    }
  }

  useEffect(() => {
    fetchCustomColumns()
    fetchLookups()
    fetchQuotations()
  }, [])

  const fetchLookups = async () => {
    try {
      const cRes = await api.get('customers/?page_size=1000')
      setCustomers(cRes.data.results || cRes.data || [])
    } catch (err) {
      console.error('Failed to load customers lookup:', err)
    }
  }

  const fetchQuotations = async () => {
    try {
      setLoading(true)
      let url = 'quotations/?page_size=1000'
      if (statusFilter && statusFilter !== 'All') url += `&status=${encodeURIComponent(statusFilter)}`
      if (customerFilter) url += `&customer=${customerFilter}`
      if (dateRange.start) url += `&start_date=${dateRange.start}`
      if (dateRange.end) url += `&end_date=${dateRange.end}`
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`

      const res = await api.get(url)
      setQuotations(res.data.results || res.data || [])
    } catch (err) {
      console.error('Failed to fetch quotations:', err)
      showError('Fetch Error', 'Unable to retrieve quotations list from server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuotations()
    }, 250)
    return () => clearTimeout(timer)
  }, [statusFilter, customerFilter, dateRange.start, dateRange.end, searchQuery])

  // PDF Download handler
  const handleDownloadPdf = async (quotation) => {
    try {
      setDownloadingPdfId(quotation.id)
      const res = await api.get(`quotations/${quotation.id}/pdf/`, {
        responseType: 'blob'
      })
      handlePdfResponse(res, `Quotation_${quotation.quotation_number}.pdf`)
      showToast('PDF downloaded successfully', 'success')
    } catch (err) {
      console.error('PDF download error:', err)
      showError('Download Failed', 'Failed to generate quotation PDF.')
    } finally {
      setDownloadingPdfId(null)
    }
  }

  // Convert to invoice action
  const handleConvertToInvoice = async (quotation) => {
    const confirmed = await showConfirm(
      'Convert Quotation to Invoice',
      `Create a Tax Invoice directly from Quotation ${quotation.quotation_number}? All line items and terms will be transferred automatically.`
    )
    if (!confirmed) return

    try {
      setConvertingId(quotation.id)
      const res = await api.post(`quotations/${quotation.id}/convert-to-invoice/`)
      if (res.data?.success) {
        showSuccess('Converted!', `Invoice ${res.data.invoice_number} has been created successfully.`)
        fetchQuotations()
        navigate(`/invoices/${res.data.invoice_id}/edit`)
      }
    } catch (err) {
      console.error('Conversion error:', err)
      showError('Conversion Failed', err.response?.data?.detail || 'Unable to convert quotation to invoice.')
    } finally {
      setConvertingId(null)
    }
  }

  // Delete Quotation
  const handleDelete = async (quotation) => {
    const confirmed = await showConfirm(
      'Delete Quotation',
      `Are you sure you want to delete ${quotation.quotation_number}? This cannot be undone.`
    )
    if (!confirmed) return

    try {
      await api.delete(`quotations/${quotation.id}/`)
      showToast('Quotation deleted', 'success')
      setQuotations(prev => prev.filter(q => q.id !== quotation.id))
    } catch (err) {
      console.error('Delete error:', err)
      showError('Delete Failed', 'Failed to delete quotation.')
    }
  }

  // KPI Metrics Calculation (across all loaded quotations)
  const kpis = useMemo(() => {
    let totalVal = 0
    let acceptedVal = 0
    let pendingVal = 0
    let convertedCount = 0

    quotations.forEach(q => {
      const amt = parseFloat(q.total_amount) || 0
      totalVal += amt
      if (q.status === 'Accepted') acceptedVal += amt
      if (q.status === 'Sent' || q.status === 'Draft') pendingVal += amt
      if (q.status === 'Converted to Invoice') convertedCount += 1
    })

    return { totalVal, acceptedVal, pendingVal, convertedCount }
  }, [quotations])

  // Card click handler (clicking active card clears it)
  const handleCardClick = (cardKey) => {
    if (activeCard === cardKey) {
      setActiveCard(null)
    } else {
      setActiveCard(cardKey)
    }
    setPage(1)
  }

  // Combined client filtering (activeCard filter applied on quotations)
  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      if (activeCard === 'accepted' && q.status !== 'Accepted') return false
      if (activeCard === 'pending' && !(q.status === 'Sent' || q.status === 'Draft')) return false
      if (activeCard === 'converted' && q.status !== 'Converted to Invoice') return false
      // 'pipeline' or null shows all
      return true
    })
  }, [quotations, activeCard])

  // Client pagination
  const totalPages = Math.ceil(filteredQuotations.length / PAGE_SIZE) || 1
  const paginatedQuotations = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredQuotations.slice(start, start + PAGE_SIZE)
  }, [filteredQuotations, page])

  // Customer dropdown options
  const customerDropdownOptions = useMemo(() => [
    { value: '', label: 'All Customers' },
    ...customers.map(c => ({
      value: String(c.id),
      label: c.name + (c.company_name ? ` (${c.company_name})` : '')
    }))
  ], [customers])

  return (
    <div className="quotations-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      
      {/* ── 1. PAGE HEADER (Enquiries style) ── */}
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
            Quotations
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PageHeaderButton to={`${basePath}/quotations/new`}>
            New Quotation
          </PageHeaderButton>
        </div>
      </div>

      {/* ── 2. KPI CARDS (4 cards, Customers/Enquiries style with active 2px ink border) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Card 1: Total Pipeline Value */}
        <div
          onClick={() => handleCardClick('pipeline')}
          style={{
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'pipeline' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Total pipeline value
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span>{isAdmin ? Math.round(kpis.totalVal).toLocaleString('en-US') : '****'}</span>
            {isAdmin && <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>}
          </div>
        </div>

        {/* Card 2: Accepted Quotes */}
        <div
          onClick={() => handleCardClick('accepted')}
          style={{
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'accepted' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Accepted quotes
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span>{isAdmin ? Math.round(kpis.acceptedVal).toLocaleString('en-US') : '****'}</span>
            {isAdmin && <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>}
          </div>
        </div>

        {/* Card 3: Pending Client Decision */}
        <div
          onClick={() => handleCardClick('pending')}
          style={{
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'pending' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Pending client decision
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span>{isAdmin ? Math.round(kpis.pendingVal).toLocaleString('en-US') : '****'}</span>
            {isAdmin && <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>}
          </div>
        </div>

        {/* Card 4: Converted to Invoice */}
        <div
          onClick={() => handleCardClick('converted')}
          style={{
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'converted' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Converted to invoice
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {isAdmin ? kpis.convertedCount : '****'}
          </div>
        </div>
      </div>

      {/* ── 3. TOOLBAR (Borderless filled search + Gooey status + Plain customer + Compact dates) ── */}
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
          placeholder="Search quotations…"
          style={{ flex: '1 1 240px', minWidth: '200px', height: '38px' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status: Plain Filter Dropdown */}
          <PlainFilterDropdown
            id="quotations-status-filter"
            value={statusFilter}
            onChange={(val) => { setStatusFilter(val); setPage(1); }}
            options={STATUS_FILTER_OPTIONS}
            minWidth={140}
            ariaLabel="Filter Quotation Status"
          />

          {/* Customer: Plain Filter Dropdown */}
          <PlainFilterDropdown
            id="quotations-customer-filter"
            value={customerFilter}
            onChange={(val) => { setCustomerFilter(val); setPage(1); }}
            options={customerDropdownOptions}
            minWidth={170}
            ariaLabel="Filter Customer"
          />

          {/* Date: From */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: '38px',
            padding: '0 10px',
            background: 'var(--bg-subtle, #F7F7F7)',
            borderRadius: '8px',
            border: '1px solid var(--border, #E4E4E4)',
            boxSizing: 'border-box'
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', fontWeight: 500, whiteSpace: 'nowrap' }}>From</span>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => { setDateRange(p => ({ ...p, start: e.target.value })); setPage(1); }}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '12px',
                color: 'var(--text, #111111)',
                fontFamily: 'inherit',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Date: To */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: '38px',
            padding: '0 10px',
            background: 'var(--bg-subtle, #F7F7F7)',
            borderRadius: '8px',
            border: '1px solid var(--border, #E4E4E4)',
            boxSizing: 'border-box'
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', fontWeight: 500, whiteSpace: 'nowrap' }}>To</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => { setDateRange(p => ({ ...p, end: e.target.value })); setPage(1); }}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '12px',
                color: 'var(--text, #111111)',
                fontFamily: 'inherit',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>
      </div>

      {/* ── 4. TABLE VIEW ── */}
      {loading ? (
        <div style={{ padding: '24px 0' }}><SkeletonLoader count={5} /></div>
      ) : filteredQuotations.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--card-bg, #FFFFFF)',
          borderRadius: '16px',
          border: '1px solid var(--border, #E4E4E4)',
          color: 'var(--text-muted, #8C8C8C)'
        }}>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>No quotations match your criteria.</p>
          <PageHeaderButton to={`${basePath}/quotations/new`}>
            New Quotation
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
                <col style={{ width: '15%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '15%' }} />
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
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Quote #</th>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Customer</th>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Date</th>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Valid Until</th>
                  <th style={{ padding: '10px 24px 10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', whiteSpace: 'nowrap' }}>Total Amount</th>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Status</th>
                  {customColumns.map(col => (
                    <th key={col.id} style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)' }}>{col.label}</th>
                  ))}
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedQuotations.map(q => {
                  return (
                    <tr
                      key={q.id}
                      onClick={() => navigate(`${basePath}/quotations/${q.id}/edit`)}
                      style={{
                        borderBottom: '1px solid var(--border, #E4E4E4)',
                        cursor: 'pointer',
                        transition: 'background-color 0.1s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Quote # */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <Link
                          to={`${basePath}/quotations/${q.id}/edit`}
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
                          {q.quotation_number}
                        </Link>
                        {q.reference_number && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', fontWeight: 400 }}>
                            Ref: {q.reference_number}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.customer_name || '—'}
                        </div>
                        {q.customer_phone && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                            {q.customer_phone}
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap', color: 'var(--text-muted, #8C8C8C)', fontVariantNumeric: 'tabular-nums' }}>
                        {q.quotation_date || '—'}
                      </td>

                      {/* Valid Until */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap', color: 'var(--text-muted, #8C8C8C)', fontVariantNumeric: 'tabular-nums' }}>
                        {q.valid_until || '—'}
                      </td>

                      {/* Total Amount (right-aligned with padding) */}
                      <td style={{ padding: '12px 24px 12px 14px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--text, #111111)' }}>
                        {formatTabular(q.total_amount)} {currency}
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
                            backgroundColor: q.status === 'Accepted' || q.status === 'Converted to Invoice'
                              ? 'var(--success, #16A34A)'
                              : q.status === 'Sent'
                              ? 'var(--text, #111111)'
                              : (q.status === 'Declined' || q.status === 'Expired')
                              ? 'var(--danger, #DC2626)'
                              : 'var(--text-muted, #8C8C8C)'
                          }} />
                          {q.status || 'Draft'}
                        </span>
                      </td>

                      {/* Dynamic Custom Columns */}
                      {customColumns.map(col => (
                        <td key={col.id} style={{ padding: '12px 14px', verticalAlign: 'top', color: 'var(--text-muted, #8C8C8C)' }}>
                          {q.custom_fields?.[col.name] !== undefined && q.custom_fields?.[col.name] !== null
                            ? String(q.custom_fields[col.name])
                            : '—'}
                        </td>
                      ))}

                      {/* Actions: 4 plain icon-only buttons with divider, right-aligned */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%', whiteSpace: 'nowrap' }}>
                          {/* 1. Convert to Invoice */}
                          {q.status !== 'Converted to Invoice' ? (
                            <button
                              type="button"
                              onClick={() => handleConvertToInvoice(q)}
                              disabled={convertingId === q.id}
                              title="Convert to invoice"
                              aria-label="Convert to invoice"
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
                              <ArrowUpRight size={15} strokeWidth={1.8} />
                            </button>
                          ) : (
                            <div style={{ width: '28px', height: '28px' }} />
                          )}

                          {/* 2. Download PDF */}
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(q)}
                            disabled={downloadingPdfId === q.id}
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
                            <ArrowDownTray size={15} strokeWidth={1.8} className={downloadingPdfId === q.id ? 'animate-spin' : ''} />
                          </button>

                          {/* Thin 1px vertical divider */}
                          <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border, #E4E4E4)', margin: '0 2px', flexShrink: 0 }} />

                          {/* 3. Edit */}
                          <button
                            type="button"
                            onClick={() => navigate(`${basePath}/quotations/${q.id}/edit`)}
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
                            onClick={() => handleDelete(q)}
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
            {paginatedQuotations.map(q => (
              <div
                key={q.id}
                onClick={() => navigate(`${basePath}/quotations/${q.id}/edit`)}
                style={{
                  background: 'var(--card-bg, #FFFFFF)',
                  borderRadius: '12px',
                  padding: '14px',
                  border: '1px solid var(--border, #E4E4E4)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text, #111111)', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                      {q.quotation_number}
                    </span>
                    {q.reference_number && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                        Ref: {q.reference_number}
                      </div>
                    )}
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
                      backgroundColor: q.status === 'Accepted' || q.status === 'Converted to Invoice'
                        ? 'var(--success, #16A34A)'
                        : q.status === 'Sent'
                        ? 'var(--text, #111111)'
                        : (q.status === 'Declined' || q.status === 'Expired')
                        ? 'var(--danger, #DC2626)'
                        : 'var(--text-muted, #8C8C8C)'
                    }} />
                    {q.status || 'Draft'}
                  </span>
                </div>

                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text, #111111)', marginBottom: '4px' }}>
                  {q.customer_name || '—'}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginBottom: '10px' }}>
                  <span>Date: {q.quotation_date || '—'}</span>
                  <span>Valid: {q.valid_until || '—'}</span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--border, #E4E4E4)'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text, #111111)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatTabular(q.total_amount)} {currency}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                    {q.status !== 'Converted to Invoice' && (
                      <button
                        type="button"
                        onClick={() => handleConvertToInvoice(q)}
                        disabled={convertingId === q.id}
                        title="Convert to invoice"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '6px',
                          color: 'var(--text-muted, #8C8C8C)',
                          cursor: 'pointer'
                        }}
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(q)}
                      disabled={downloadingPdfId === q.id}
                      title="Download PDF"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        color: 'var(--text-muted, #8C8C8C)',
                        cursor: 'pointer'
                      }}
                    >
                      <ArrowDownTray size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`${basePath}/quotations/${q.id}/edit`)}
                      title="Edit"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        color: 'var(--text-muted, #8C8C8C)',
                        cursor: 'pointer'
                      }}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(q)}
                      title="Delete"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        color: 'var(--text-muted, #8C8C8C)',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <CredPagination
            page={page}
            totalPages={totalPages}
            total={filteredQuotations.length}
            onPageChange={(p) => setPage(p)}
          />
        </>
      )}

      {/* Responsive Styles Injection */}
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

export default Quotations
