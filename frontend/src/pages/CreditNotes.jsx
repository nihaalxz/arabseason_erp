import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowDownTray, Edit, Trash2 } from '../components/icons'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'
import SkeletonLoader from '../components/common/SkeletonLoader'
import PageHeaderButton from '../components/common/PageHeaderButton'
import CredSearchInput from '../components/cashbook/cred/CredSearchInput'
import PlainFilterDropdown from '../components/common/PlainFilterDropdown'
import CredPagination from '../components/cashbook/cred/CredPagination'
import { showConfirm, showError, showToast } from '../utils/swal'
import { isCurrentUserAdmin } from '../constants/permissions'
import { handlePdfResponse } from '../utils/pdfDownload'

const STATUS_FILTER_OPTIONS = [
  { value: 'All', label: 'All Statuses' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Issued', label: 'Issued' },
  { value: 'Applied', label: 'Applied' },
  { value: 'Refunded', label: 'Refunded' },
  { value: 'Cancelled', label: 'Cancelled' }
]

const REASON_FILTER_OPTIONS = [
  { value: 'All Reasons', label: 'All Reasons' },
  { value: 'Sales Return', label: 'Sales Return' },
  { value: 'Overbilled / Pricing Error', label: 'Overbilled / Pricing Error' },
  { value: 'Defective / Damaged Goods', label: 'Defective / Damaged Goods' },
  { value: 'Service Cancellation', label: 'Service Cancellation' },
  { value: 'Goodwill / Rebate', label: 'Goodwill / Rebate' },
  { value: 'Other', label: 'Other' }
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

const CreditNotes = () => {
  const isAdmin = isCurrentUserAdmin()
  const { settings } = useSettings()
  const currency = settings?.currency || 'SAR'
  const navigate = useNavigate()

  // Data states
  const [creditNotes, setCreditNotes] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingPdfId, setDownloadingPdfId] = useState(null)

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState('All')
  const [reasonFilter, setReasonFilter] = useState('All Reasons')
  const [customerFilter, setCustomerFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCard, setActiveCard] = useState(null) // null | 'total' | 'issued' | 'applied'
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  // Dynamic Custom Columns
  const [customColumns, setCustomColumns] = useState([])

  const fetchCustomColumns = async () => {
    try {
      const res = await api.get('custom-fields/', { params: { form_type: 'credit_note' } })
      setCustomColumns((res.data || []).filter(f => f.show_in_table))
    } catch (e) {
      console.error('Failed to load custom credit note columns', e)
    }
  }

  useEffect(() => {
    fetchCustomColumns()
    fetchLookups()
    fetchCreditNotes()
  }, [])

  const fetchLookups = async () => {
    try {
      const cRes = await api.get('customers/?page_size=1000')
      setCustomers(cRes.data.results || cRes.data || [])
    } catch (err) {
      console.error('Failed to load customers lookup:', err)
    }
  }

  const fetchCreditNotes = async () => {
    try {
      setLoading(true)
      const res = await api.get('credit-notes/?page_size=1000')
      setCreditNotes(res.data.results || res.data || [])
    } catch (err) {
      console.error('Failed to fetch credit notes:', err)
      showError('Fetch Error', 'Unable to retrieve credit notes list from server.')
    } finally {
      setLoading(false)
    }
  }

  // Delete Credit Note
  const handleDelete = async (cn) => {
    const confirmed = await showConfirm(
      'Move to Recycle Bin?',
      `Are you sure you want to move credit note ${cn.credit_note_number} to the Recycle Bin? It can be restored at any time.`
    )
    if (!confirmed) return

    try {
      await api.delete(`credit-notes/${cn.id}/`)
      showToast(`Credit note ${cn.credit_note_number} moved to Recycle Bin`, 'success')
      setCreditNotes(prev => prev.filter(c => c.id !== cn.id))
    } catch (err) {
      console.error('Delete error:', err)
      showError('Delete Failed', 'Failed to delete credit note.')
    }
  }

  // Download PDF
  const handleDownloadPdf = async (cn) => {
    try {
      setDownloadingPdfId(cn.id)
      const res = await api.get(`credit-notes/${cn.id}/pdf/`, { responseType: 'blob' })
      handlePdfResponse(res, `CreditNote_${cn.credit_note_number}.pdf`)
      showToast('Credit Note PDF downloaded', 'success')
    } catch (err) {
      console.error('PDF error:', err)
      showError('Download Failed', 'Failed to generate credit note PDF.')
    } finally {
      setDownloadingPdfId(null)
    }
  }

  // KPI Metrics
  const metrics = useMemo(() => {
    let totalVal = 0
    let issuedVal = 0
    let appliedVal = 0

    creditNotes.forEach(cn => {
      const amt = parseFloat(cn.total_amount) || 0
      totalVal += amt
      if (cn.status === 'Issued') issuedVal += amt
      if (cn.status === 'Applied') appliedVal += amt
    })

    return { totalVal, issuedVal, appliedVal }
  }, [creditNotes])

  // Filter Handling: KPI card click
  const handleCardClick = (cardType) => {
    if (activeCard === cardType) {
      setActiveCard(null)
    } else {
      setActiveCard(cardType)
      setStatusFilter('All')
    }
    setPage(1)
  }

  // Filter Handling: Status dropdown change
  const handleStatusChange = (val) => {
    setStatusFilter(val)
    setActiveCard(null)
    setPage(1)
  }

  // Customer options for PlainFilterDropdown
  const customerDropdownOptions = useMemo(() => {
    const opts = [{ value: '', label: 'All Customers' }]
    customers.forEach(c => {
      opts.push({ value: String(c.id), label: c.name })
    })
    return opts
  }, [customers])

  // Client-side filtering
  const filteredCreditNotes = useMemo(() => {
    return creditNotes.filter(cn => {
      // KPI Card Filter
      if (activeCard === 'issued' && cn.status !== 'Issued') return false
      if (activeCard === 'applied' && cn.status !== 'Applied') return false

      // Status dropdown
      if (statusFilter !== 'All' && cn.status !== statusFilter) return false

      // Reason dropdown
      if (reasonFilter !== 'All Reasons' && cn.credit_reason !== reasonFilter) return false

      // Customer dropdown
      if (customerFilter && String(cn.customer) !== String(customerFilter) && String(cn.customer_id) !== String(customerFilter)) {
        return false
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchNum = cn.credit_note_number?.toLowerCase().includes(q)
        const matchCust = cn.customer_name?.toLowerCase().includes(q)
        const matchRef = cn.reference_number?.toLowerCase().includes(q)
        const matchInv = cn.invoice_number?.toLowerCase().includes(q)
        const matchReason = cn.credit_reason?.toLowerCase().includes(q)
        if (!matchNum && !matchCust && !matchRef && !matchInv && !matchReason) return false
      }

      return true
    })
  }, [creditNotes, activeCard, statusFilter, reasonFilter, customerFilter, searchQuery])

  // Pagination chunking
  const totalPages = Math.ceil(filteredCreditNotes.length / PAGE_SIZE) || 1
  const paginatedCreditNotes = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredCreditNotes.slice(start, start + PAGE_SIZE)
  }, [filteredCreditNotes, page])

  return (
    <div style={{
      width: '100%',
      maxWidth: '1366px',
      margin: '0 auto',
      padding: '24px 20px',
      boxSizing: 'border-box',
      fontFamily: 'inherit'
    }}>
      {/* ── 1. HEADER (Title "Credit Notes" + Single Plus PageHeaderButton) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--text, #0A0A0A)',
            letterSpacing: '-0.02em'
          }}>
            Credit Notes
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PageHeaderButton to="/credit-notes/new">
            New Credit Note
          </PageHeaderButton>
        </div>
      </div>

      {/* ── 2. KPI CARDS (3 equal columns aligned with toolbar/table) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Card 1: Total Credits Issued */}
        <div
          onClick={() => handleCardClick('total')}
          style={{
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'total' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Total credits issued
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span>{isAdmin ? Math.round(metrics.totalVal).toLocaleString('en-US') : '****'}</span>
            {isAdmin && <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>}
          </div>
        </div>

        {/* Card 2: Active / Issued Credits */}
        <div
          onClick={() => handleCardClick('issued')}
          style={{
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'issued' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Active / issued credits
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span>{isAdmin ? Math.round(metrics.issuedVal).toLocaleString('en-US') : '****'}</span>
            {isAdmin && <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>}
          </div>
        </div>

        {/* Card 3: Applied Credits */}
        <div
          onClick={() => handleCardClick('applied')}
          style={{
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'applied' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Applied credits
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span>{isAdmin ? Math.round(metrics.appliedVal).toLocaleString('en-US') : '****'}</span>
            {isAdmin && <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>}
          </div>
        </div>
      </div>

      {/* ── 3. TOOLBAR (Search + Plain status dropdown + Plain reason dropdown + Plain customer dropdown) ── */}
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
          placeholder="Search credit notes…"
          style={{ flex: '1 1 240px', minWidth: '200px', height: '38px' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status: Plain Filter Dropdown */}
          <PlainFilterDropdown
            id="credit-notes-status-filter"
            value={statusFilter}
            onChange={handleStatusChange}
            options={STATUS_FILTER_OPTIONS}
            minWidth={130}
            ariaLabel="Filter Credit Note Status"
          />

          {/* Reason: Plain Filter Dropdown */}
          <PlainFilterDropdown
            id="credit-notes-reason-filter"
            value={reasonFilter}
            onChange={(val) => { setReasonFilter(val); setPage(1); }}
            options={REASON_FILTER_OPTIONS}
            minWidth={150}
            ariaLabel="Filter Reason"
          />

          {/* Customer: Plain Filter Dropdown */}
          <PlainFilterDropdown
            id="credit-notes-customer-filter"
            value={customerFilter}
            onChange={(val) => { setCustomerFilter(val); setPage(1); }}
            options={customerDropdownOptions}
            minWidth={160}
            ariaLabel="Filter Customer"
          />
        </div>
      </div>

      {/* ── 4. TABLE VIEW ── */}
      {loading && creditNotes.length === 0 ? (
        <div style={{ padding: '24px 0' }}><SkeletonLoader count={5} /></div>
      ) : filteredCreditNotes.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--card-bg, #FFFFFF)',
          borderRadius: '16px',
          border: '1px solid var(--border, #E4E4E4)',
          color: 'var(--text-muted, #8C8C8C)'
        }}>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>No credit notes match your criteria.</p>
          <PageHeaderButton to="/credit-notes/new">
            New Credit Note
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
                <col style={{ width: '16%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '130px' }} />
                {customColumns.map(col => (
                  <col key={col.id} style={{ width: '100px' }} />
                ))}
                <col style={{ width: '170px' }} />
              </colgroup>
              <thead>
                <tr style={{
                  borderBottom: '1px solid var(--border, #E4E4E4)',
                  background: 'var(--bg-subtle, #F7F7F7)'
                }}>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Credit Note #</th>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Customer</th>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Reason</th>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Linked Invoice</th>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Date</th>
                  <th style={{ padding: '10px 16px 10px 8px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', whiteSpace: 'nowrap' }}>Total Amount</th>
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>Status</th>
                  {customColumns.map(col => (
                    <th key={col.id} style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)' }}>{col.label}</th>
                  ))}
                  <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCreditNotes.map(cn => {
                  const tot = parseFloat(cn.total_amount) || 0

                  return (
                    <tr
                      key={cn.id}
                      onClick={() => navigate(`/credit-notes/${cn.id}/edit`)}
                      style={{
                        borderBottom: '1px solid var(--border, #E4E4E4)',
                        cursor: 'pointer',
                        transition: 'background-color 0.1s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Credit Note # */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <Link
                          to={`/credit-notes/${cn.id}/edit`}
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
                          {cn.credit_note_number}
                        </Link>
                        {cn.reference_number && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', fontWeight: 400 }}>
                            Ref: {cn.reference_number}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cn.customer_name || '—'}
                        </div>
                        {cn.customer_phone && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                            {cn.customer_phone}
                          </div>
                        )}
                      </td>

                      {/* Reason */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', color: 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cn.credit_reason || '—'}
                      </td>

                      {/* Linked Invoice */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', color: 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cn.invoice_number ? (
                          <span style={{ color: 'var(--text, #111111)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                            {cn.invoice_number}
                          </span>
                        ) : '—'}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap', color: 'var(--text-muted, #8C8C8C)', fontVariantNumeric: 'tabular-nums' }}>
                        {cn.credit_note_date || '—'}
                      </td>

                      {/* Total Amount */}
                      <td style={{ padding: '12px 16px 12px 8px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--text, #111111)' }}>
                        {formatTabular(tot)} {currency}
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
                            backgroundColor: cn.status === 'Applied'
                              ? 'var(--success, #16A34A)'
                              : cn.status === 'Issued'
                              ? 'var(--text, #111111)'
                              : cn.status === 'Refunded'
                              ? '#0d9488'
                              : (cn.status === 'Cancelled' || cn.status === 'Void')
                              ? 'var(--danger, #DC2626)'
                              : 'var(--text-muted, #8C8C8C)'
                          }} />
                          {cn.status || 'Draft'}
                        </span>
                      </td>

                      {/* Dynamic Custom Columns */}
                      {customColumns.map(col => (
                        <td key={col.id} style={{ padding: '12px 14px', verticalAlign: 'top', color: 'var(--text-muted, #8C8C8C)' }}>
                          {cn.custom_fields?.[col.name] !== undefined && cn.custom_fields?.[col.name] !== null
                            ? String(cn.custom_fields[col.name])
                            : '—'}
                        </td>
                      ))}

                      {/* Actions: plain icon-only buttons with divider, right-aligned */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%', whiteSpace: 'nowrap' }}>
                          
                          {/* 1. Download PDF */}
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(cn)}
                            disabled={downloadingPdfId === cn.id}
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
                            <ArrowDownTray size={15} strokeWidth={1.8} className={downloadingPdfId === cn.id ? 'animate-spin' : ''} />
                          </button>

                          {/* Thin 1px vertical divider */}
                          <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border, #E4E4E4)', margin: '0 2px', flexShrink: 0 }} />

                          {/* 2. Edit */}
                          <button
                            type="button"
                            onClick={() => navigate(`/credit-notes/${cn.id}/edit`)}
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

                          {/* 3. Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(cn)}
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
            {paginatedCreditNotes.map(cn => {
              const tot = parseFloat(cn.total_amount) || 0

              return (
                <div
                  key={cn.id}
                  onClick={() => navigate(`/credit-notes/${cn.id}/edit`)}
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
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text, #111111)', fontVariantNumeric: 'tabular-nums' }}>
                        {cn.credit_note_number}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text, #111111)', marginTop: '2px' }}>
                        {cn.customer_name || '—'}
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
                        backgroundColor: cn.status === 'Applied'
                          ? 'var(--success, #16A34A)'
                          : cn.status === 'Issued'
                          ? 'var(--text, #111111)'
                          : cn.status === 'Refunded'
                          ? '#0d9488'
                          : (cn.status === 'Cancelled' || cn.status === 'Void')
                          ? 'var(--danger, #DC2626)'
                          : 'var(--text-muted, #8C8C8C)'
                      }} />
                      {cn.status || 'Draft'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
                    <span>{cn.credit_reason}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{cn.credit_note_date || '—'}</span>
                  </div>

                  {cn.invoice_number && (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
                      Invoice: {cn.invoice_number}
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border, #E4E4E4)'
                  }}>
                    <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: '14px', color: 'var(--text, #111111)' }}>
                      {formatTabular(tot)} {currency}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(cn)}
                        style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted, #8C8C8C)' }}
                      >
                        <ArrowDownTray size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/credit-notes/${cn.id}/edit`)}
                        style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted, #8C8C8C)' }}
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cn)}
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
            totalItems={filteredCreditNotes.length}
            rangeStart={(page - 1) * PAGE_SIZE + 1}
            rangeEnd={Math.min(page * PAGE_SIZE, filteredCreditNotes.length)}
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

export default CreditNotes
