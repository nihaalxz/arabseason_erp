import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, Trash2, Download, Truck } from 'lucide-react'
import PlainFilterDropdown from '../components/common/PlainFilterDropdown'
import CredSearchInput from '../components/cashbook/cred/CredSearchInput'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { showConfirm, showError, showToast } from '../utils/swal'
import { handlePdfResponse } from '../utils/pdfDownload'

const STATUS_CHOICES = [
  'All',
  'Draft',
  'Dispatched',
  'In Transit',
  'Delivered',
  'Signed & Returned',
  'Cancelled'
]

const getDeliveryNoteAmount = (dn) => {
  if (dn.total_amount !== undefined && dn.total_amount !== null && dn.total_amount !== '') {
    return parseFloat(dn.total_amount) || 0
  }
  if (dn.custom_fields?.total_amount !== undefined && dn.custom_fields?.total_amount !== null && dn.custom_fields?.total_amount !== '') {
    return parseFloat(dn.custom_fields.total_amount) || 0
  }
  if (Array.isArray(dn.items) && dn.items.length > 0) {
    const sum = dn.items.reduce((acc, item) => acc + (parseFloat(item.total) || ((parseFloat(item.quantity) || 1) * (parseFloat(item.unit_price) || 0)) || 0), 0)
    return sum > 0 ? sum : null
  }
  return null
}

const renderCashbookAmount = (val) => {
  if (val === null || val === undefined || isNaN(val)) {
    return <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '12.5px' }}>—</span>
  }
  const num = parseFloat(val)
  const parts = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 400, fontSize: '13px', color: 'var(--text, #111111)' }}>
      {parts[0]}<span style={{ opacity: 0.55, fontSize: '11px' }}>.{parts[1]}</span>
      <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginLeft: '3px', fontWeight: 400 }}>SAR</span>
    </span>
  )
}

const renderDeliveryStatus = (status) => {
  const s = String(status || '').trim().toLowerCase()
  let dotColor = '#8C8C8C'
  let label = status || 'Draft'

  if (s === 'draft') {
    dotColor = '#8C8C8C'
    label = 'Draft'
  } else if (s === 'dispatched' || s === 'in transit') {
    dotColor = '#3b82f6'
    label = s === 'dispatched' ? 'Dispatched' : 'In Transit'
  } else if (s === 'delivered' || s === 'signed & returned') {
    dotColor = '#10b981'
    label = s === 'delivered' ? 'Delivered' : 'Signed & Returned'
  } else if (s === 'cancelled') {
    dotColor = '#dc2626'
    label = 'Cancelled'
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 400, color: 'var(--text, #111111)' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
      {label}
    </span>
  )
}

const DeliveryNotes = () => {
  const navigate = useNavigate()

  // Data states
  const [deliveryNotes, setDeliveryNotes] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingPdfId, setDownloadingPdfId] = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('All')
  const [customerFilter, setCustomerFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  const fetchLookups = async () => {
    try {
      const cRes = await api.get('customers/?page_size=1000')
      setCustomers(cRes.data.results || cRes.data || [])
    } catch (err) {
      console.error('Failed to load customers lookup:', err)
    }
  }

  const fetchDeliveryNotes = async () => {
    try {
      setLoading(true)
      let url = 'delivery-notes/?page_size=1000'
      if (statusFilter && statusFilter !== 'All') url += `&status=${encodeURIComponent(statusFilter)}`
      if (customerFilter) url += `&customer=${customerFilter}`
      if (dateRange.start) url += `&start_date=${dateRange.start}`
      if (dateRange.end) url += `&end_date=${dateRange.end}`
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`

      const res = await api.get(url)
      setDeliveryNotes(res.data.results || res.data || [])
    } catch (err) {
      console.error('Failed to fetch delivery notes:', err)
      showError('Fetch Error', 'Unable to retrieve delivery notes from server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLookups()
    fetchDeliveryNotes()
  }, [])

  // Universal top strip refresh handler
  useEffect(() => {
    const handleAppRefresh = () => {
      fetchDeliveryNotes()
    }
    window.addEventListener('app:refresh', handleAppRefresh)
    return () => window.removeEventListener('app:refresh', handleAppRefresh)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDeliveryNotes()
    }, 250)
    return () => clearTimeout(timer)
  }, [statusFilter, customerFilter, dateRange.start, dateRange.end, searchQuery])

  // PDF Download
  const handleDownloadPdf = async (dn) => {
    try {
      setDownloadingPdfId(dn.id)
      const res = await api.get(`delivery-notes/${dn.id}/pdf/`, { responseType: 'blob' })
      handlePdfResponse(res, `DeliveryNote_${dn.delivery_note_number}.pdf`)
      showToast('Delivery note PDF downloaded', 'success')
    } catch (err) {
      console.error('PDF error:', err)
      showError('Download Failed', 'Failed to generate delivery note PDF.')
    } finally {
      setDownloadingPdfId(null)
    }
  }

  // Delete
  const handleDelete = async (dn) => {
    const confirmed = await showConfirm({
      title: 'Delete Delivery Note?',
      text: `Are you sure you want to delete ${dn.delivery_note_number}? This cannot be undone.`,
      confirmButtonText: 'Yes, delete',
      isDangerous: true
    })
    if (!confirmed) return

    try {
      await api.delete(`delivery-notes/${dn.id}/`)
      showToast('Delivery note deleted', 'success')
      setDeliveryNotes(prev => prev.filter(d => d.id !== dn.id))
    } catch (err) {
      console.error('Delete error:', err)
      showError('Delete Failed', 'Failed to delete delivery note.')
    }
  }

  // KPI Metrics
  const kpis = useMemo(() => {
    let deliveredCount = 0
    let inTransitCount = 0
    let totalVal = 0
    let hasAnyAmount = false

    deliveryNotes.forEach(dn => {
      if (dn.status === 'Delivered' || dn.status === 'Signed & Returned') deliveredCount += 1
      if (dn.status === 'Dispatched' || dn.status === 'In Transit') inTransitCount += 1
      const amt = getDeliveryNoteAmount(dn)
      if (amt !== null && amt > 0) {
        totalVal += amt
        hasAnyAmount = true
      }
    })

    return { 
      total: deliveryNotes.length, 
      deliveredCount, 
      inTransitCount, 
      totalVal,
      hasAnyAmount
    }
  }, [deliveryNotes])

  return (
    <div className="delivery-notes-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* 1. Header (Title only + Black Pill New Button) */}
      <div className="page-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontWeight: 600, letterSpacing: '-0.02em', fontSize: '24px', margin: 0, color: 'var(--text, #0A0A0A)' }}>
            Delivery Notes
          </h2>
        </div>

        <div>
          <button
            type="button"
            className="cred-jobs-submit-btn"
            onClick={() => navigate('/delivery-notes/new')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '9999px',
              background: 'var(--text, #0A0A0A)',
              color: 'var(--card-bg, #FFFFFF)',
              fontSize: '13px',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={15} strokeWidth={2} />
            <span>New Delivery Note</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Cards (Cashbook CRED style: 1px outline, muted label, 26px ink number, no colored borders) */}
      <div 
        className="delivery-kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: kpis.hasAnyAmount ? 'repeat(auto-fit, minmax(220px, 1fr))' : 'repeat(3, minmax(0, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}
      >
        <div style={{ background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--border, #E4E4E4)', borderRadius: '20px', padding: '18px 20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
            Total dispatches
          </div>
          <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text, #0A0A0A)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {kpis.total}
          </div>
        </div>

        <div style={{ background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--border, #E4E4E4)', borderRadius: '20px', padding: '18px 20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
            Delivered & signed
          </div>
          <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text, #0A0A0A)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {kpis.deliveredCount}
          </div>
        </div>

        <div style={{ background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--border, #E4E4E4)', borderRadius: '20px', padding: '18px 20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
            In transit / dispatched
          </div>
          <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text, #0A0A0A)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {kpis.inTransitCount}
          </div>
        </div>

        {kpis.hasAnyAmount && (
          <div style={{ background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--border, #E4E4E4)', borderRadius: '20px', padding: '18px 20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
              Total value
            </div>
            <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text, #0A0A0A)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
              {(() => {
                const parts = kpis.totalVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')
                return (
                  <>
                    {parts[0]}<span style={{ opacity: 0.55, fontSize: '18px' }}>.{parts[1]}</span>
                    <span style={{ fontSize: '14px', color: 'var(--text-muted, #8C8C8C)', marginLeft: '4px', fontWeight: 400 }}>SAR</span>
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </div>

      {/* 3. Search and Filter Row (Directly on page, single outer border, compact controls) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '20px'
      }}>
        {/* Search */}
        <div style={{ flex: '1 1 260px', minWidth: '220px' }}>
          <CredSearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            placeholder="Search delivery notes..."
          />
        </div>

        {/* Compact Filters Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Status Dropdown */}
          <PlainFilterDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_CHOICES.map(st => ({
              value: st,
              label: st === 'All' ? 'All statuses' : st
            }))}
            ariaLabel="Filter by status"
            minWidth={130}
          />

          {/* Customer Dropdown */}
          <PlainFilterDropdown
            value={customerFilter}
            onChange={setCustomerFilter}
            options={[
              { value: '', label: 'All customers' },
              ...customers.map(c => ({
                value: String(c.id),
                label: c.name
              }))
            ]}
            ariaLabel="Filter by customer"
            minWidth={150}
          />

          {/* From Date */}
          <input
            type="date"
            aria-label="From Date"
            title="From Date"
            value={dateRange.start}
            onChange={(e) => setDateRange(p => ({ ...p, start: e.target.value }))}
            style={{
              height: '38px',
              borderRadius: '10px',
              border: '1px solid var(--border, #E4E4E4)',
              background: 'var(--card-bg, #FFFFFF)',
              color: 'var(--text, #111111)',
              padding: '0 10px',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />

          {/* To Date */}
          <input
            type="date"
            aria-label="To Date"
            title="To Date"
            value={dateRange.end}
            onChange={(e) => setDateRange(p => ({ ...p, end: e.target.value }))}
            style={{
              height: '38px',
              borderRadius: '10px',
              border: '1px solid var(--border, #E4E4E4)',
              background: 'var(--card-bg, #FFFFFF)',
              color: 'var(--text, #111111)',
              padding: '0 10px',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* 4. Table / Empty State */}
      <div style={{ width: '100%', position: 'relative', marginBottom: '2.5rem' }}>
        {loading ? (
          <div style={{ padding: '1.5rem 0' }}>
            <SkeletonLoader type="table" />
          </div>
        ) : deliveryNotes.length === 0 ? (
          <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
            <Truck size={22} strokeWidth={1.6} style={{ color: 'var(--text-muted, #8C8C8C)', opacity: 0.6, marginBottom: '8px' }} />
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>
              No delivery notes yet.
            </p>
          </div>
        ) : (
          <>
            <div className="desktop-only-table" style={{ width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '144px' }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)' }}>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Date</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Delivery Note</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Reference</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Customer</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Type</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '10px 24px 10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Amount</th>
                    <th style={{ width: '144px', minWidth: '144px', padding: '10px 8px 10px 16px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryNotes.map(dn => {
                    const amount = getDeliveryNoteAmount(dn)
                    const challanType = dn.custom_fields?.challan_type || dn.shipping_method || '—'

                    return (
                      <tr 
                        key={dn.id} 
                        className="cred-table-row"
                        style={{ borderBottom: '1px solid var(--border, #E4E4E4)', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                        onClick={() => navigate(`/delivery-notes/${dn.id}/edit`)}
                      >
                        {/* Date */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--text, #111111)', fontVariantNumeric: 'tabular-nums' }}>
                          {dn.delivery_date || '—'}
                        </td>

                        {/* Delivery Note # (Plain text, weight 500, no blue link, no second line) */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                          <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text, #111111)', fontVariantNumeric: 'tabular-nums' }}>
                            {dn.delivery_note_number}
                          </span>
                        </td>

                        {/* Reference */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden', fontSize: '13px', color: dn.reference_number ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)' }}>
                          {dn.reference_number || '—'}
                        </td>

                        {/* Customer (Name only, no Attn line) */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                          <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {dn.customer_name || '—'}
                          </div>
                        </td>

                        {/* Type */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden', fontSize: '12.5px', color: challanType !== '—' ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {challanType}
                          </span>
                        </td>

                        {/* Status (Plain text, small colored dot) */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {renderDeliveryStatus(dn.status)}
                        </td>

                        {/* Amount (Cashbook amount style, right aligned, >=24px right padding) */}
                        <td style={{ textAlign: 'right', padding: '10px 24px 10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {renderCashbookAmount(amount)}
                        </td>

                        {/* Actions (Download PDF, Edit, Delete) */}
                        <td style={{ width: '144px', minWidth: '144px', textAlign: 'right', padding: '10px 8px 10px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', gap: '12px', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                            <button
                              type="button"
                              className="cred-icon-action-btn"
                              onClick={() => handleDownloadPdf(dn)}
                              disabled={downloadingPdfId === dn.id}
                              title="Download PDF"
                              aria-label="Download PDF"
                              style={{
                                background: 'none',
                                border: 'none',
                                width: '32px',
                                height: '32px',
                                flexShrink: 0,
                                padding: 0,
                                color: 'var(--text-muted, #8C8C8C)',
                                cursor: downloadingPdfId === dn.id ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                transition: 'color 0.15s ease, background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--text, #0A0A0A)'
                                e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              <Download size={16} strokeWidth={1.8} className={downloadingPdfId === dn.id ? 'animate-spin' : ''} />
                            </button>

                            <button
                              type="button"
                              className="cred-icon-action-btn"
                              onClick={() => navigate(`/delivery-notes/${dn.id}/edit`)}
                              title="Edit"
                              aria-label="Edit"
                              style={{
                                background: 'none',
                                border: 'none',
                                width: '32px',
                                height: '32px',
                                flexShrink: 0,
                                padding: 0,
                                color: 'var(--text-muted, #8C8C8C)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                transition: 'color 0.15s ease, background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--text, #0A0A0A)'
                                e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              <Edit size={16} strokeWidth={1.8} />
                            </button>

                            <button
                              type="button"
                              className="cred-icon-action-btn"
                              onClick={() => handleDelete(dn)}
                              title="Delete"
                              aria-label="Delete"
                              style={{
                                background: 'none',
                                border: 'none',
                                width: '32px',
                                height: '32px',
                                flexShrink: 0,
                                padding: 0,
                                color: 'var(--text-muted, #8C8C8C)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                transition: 'color 0.15s ease, background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--danger, #DC2626)'
                                e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              <Trash2 size={16} strokeWidth={1.8} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Integrated Table Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 4px 4px',
              fontSize: '12px',
              color: 'var(--text-muted, #8C8C8C)'
            }}>
              <span>Showing {deliveryNotes.length} delivery notes</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default DeliveryNotes
