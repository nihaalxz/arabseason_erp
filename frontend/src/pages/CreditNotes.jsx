import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  Plus, Search, RefreshCw, Trash2, Edit, Download, 
  RotateCcw, FileText, Users, Calendar, AlertCircle
} from 'lucide-react'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { showConfirm, showError, showToast } from '../utils/swal'
import { handlePdfResponse } from '../utils/pdfDownload'

const STATUS_CHOICES = [
  'All',
  'Draft',
  'Issued',
  'Applied',
  'Refunded',
  'Cancelled'
]

const REASON_CHOICES = [
  'All Reasons',
  'Sales Return',
  'Overbilled / Pricing Error',
  'Defective / Damaged Goods',
  'Service Cancellation',
  'Goodwill / Rebate',
  'Other'
]

const STATUS_CONFIG = {
  'Draft': { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  'Issued': { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  'Applied': { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  'Refunded': { bg: '#f0fdfa', text: '#0d9488', border: '#99f6e4' },
  'Cancelled': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' }
}

const CreditNotes = () => {
  const { settings, formatCurrency } = useSettings()
  const currency = settings?.currency || 'SAR'
  const navigate = useNavigate()

  // Data states
  const [creditNotes, setCreditNotes] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingPdfId, setDownloadingPdfId] = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('All')
  const [reasonFilter, setReasonFilter] = useState('All Reasons')
  const [customerFilter, setCustomerFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

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
      let url = 'credit-notes/?page_size=1000'
      if (statusFilter && statusFilter !== 'All') url += `&status=${encodeURIComponent(statusFilter)}`
      if (reasonFilter && reasonFilter !== 'All Reasons') url += `&reason=${encodeURIComponent(reasonFilter)}`
      if (customerFilter) url += `&customer=${customerFilter}`
      if (dateRange.start) url += `&start_date=${dateRange.start}`
      if (dateRange.end) url += `&end_date=${dateRange.end}`
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`

      const res = await api.get(url)
      setCreditNotes(res.data.results || res.data || [])
    } catch (err) {
      console.error('Failed to fetch credit notes:', err)
      showError('Fetch Error', 'Unable to retrieve credit notes list from server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCreditNotes()
    }, 250)
    return () => clearTimeout(timer)
  }, [statusFilter, reasonFilter, customerFilter, dateRange.start, dateRange.end, searchQuery])

  // PDF Download
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

  // Delete
  const handleDelete = async (cn) => {
    const confirmed = await showConfirm(
      'Delete Credit Note',
      `Are you sure you want to delete ${cn.credit_note_number}? This cannot be undone.`
    )
    if (!confirmed) return

    try {
      await api.delete(`credit-notes/${cn.id}/`)
      showToast('Credit note deleted', 'success')
      setCreditNotes(prev => prev.filter(c => c.id !== cn.id))
    } catch (err) {
      console.error('Delete error:', err)
      showError('Delete Failed', 'Failed to delete credit note.')
    }
  }

  // KPI Calculations
  const kpis = useMemo(() => {
    let totalVal = 0
    let appliedVal = 0
    let issuedVal = 0

    creditNotes.forEach(cn => {
      const amt = parseFloat(cn.total_amount) || 0
      totalVal += amt
      if (cn.status === 'Applied') appliedVal += amt
      if (cn.status === 'Issued') issuedVal += amt
    })

    return { totalVal, appliedVal, issuedVal, count: creditNotes.length }
  }, [creditNotes])

  return (
    <div className="invoices-page-container erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)'
            }}>
              <RotateCcw size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#1e293b' }}>
                Credit Notes & Adjustments
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Issue returns, rebates, overbilling reversals, and customer credits
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={fetchCreditNotes}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <Link
            to="/credit-notes/new"
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: '600',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              borderColor: '#dc2626'
            }}
          >
            <Plus size={16} />
            New Credit Note
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="credit-kpi-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.85rem',
        marginBottom: '1.25rem'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          padding: '1rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
            Total Credits Issued
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#dc2626', margin: '4px 0' }}>
            {formatCurrency ? formatCurrency(kpis.totalVal) : `${kpis.totalVal.toLocaleString()} ${currency}`}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Across {kpis.count} credit notes
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          padding: '1rem',
          border: '1px solid #bfdbfe',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#2563eb', textTransform: 'uppercase' }}>
            Active / Issued Credits
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#2563eb', margin: '4px 0' }}>
            {formatCurrency ? formatCurrency(kpis.issuedVal) : `${kpis.issuedVal.toLocaleString()} ${currency}`}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#2563eb' }}>
            Pending client application
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          padding: '1rem',
          border: '1px solid #a7f3d0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#059669', textTransform: 'uppercase' }}>
            Applied Credits
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#059669', margin: '4px 0' }}>
            {formatCurrency ? formatCurrency(kpis.appliedVal) : `${kpis.appliedVal.toLocaleString()} ${currency}`}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#059669' }}>
            Settled against invoices
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: '10px',
        padding: '0.85rem',
        border: '1px solid #e2e8f0',
        marginBottom: '1rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        {/* Search */}
        <div style={{ flex: '1 1 200px', position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              fontSize: '0.85rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px'
            }}
          />
        </div>

        {/* Status */}
        <div style={{ minWidth: '130px' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: '0.85rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              background: '#fff'
            }}
          >
            {STATUS_CHOICES.map(st => (
              <option key={st} value={st}>{st === 'All' ? 'All Statuses' : st}</option>
            ))}
          </select>
        </div>

        {/* Reason */}
        <div style={{ minWidth: '160px' }}>
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
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

        {/* Customer */}
        <div style={{ minWidth: '160px' }}>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: '0.85rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              background: '#fff'
            }}
          >
            <option value="">All Customers</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div>
          <input
            type="date"
            title="Start Date"
            value={dateRange.start}
            onChange={(e) => setDateRange(p => ({ ...p, start: e.target.value }))}
            style={{
              padding: '5px 8px',
              fontSize: '0.85rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px'
            }}
          />
        </div>

        {/* End Date */}
        <div>
          <input
            type="date"
            title="End Date"
            value={dateRange.end}
            onChange={(e) => setDateRange(p => ({ ...p, end: e.target.value }))}
            style={{
              padding: '5px 8px',
              fontSize: '0.85rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px'
            }}
          />
        </div>

        {(searchQuery || customerFilter || statusFilter !== 'All' || reasonFilter !== 'All Reasons' || dateRange.start || dateRange.end) && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setSearchQuery('')
              setStatusFilter('All')
              setReasonFilter('All Reasons')
              setCustomerFilter('')
              setDateRange({ start: '', end: '' })
            }}
            style={{ fontSize: '0.8rem', padding: '4px 8px', color: '#64748b' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Table / Cards */}
      {loading ? (
        <SkeletonLoader count={5} />
      ) : creditNotes.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          padding: '1.75rem 1.25rem',
          textAlign: 'center',
          border: '1px solid #e2e8f0'
        }}>
          <RotateCcw size={42} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
          <h3 style={{ margin: '0 0 6px', color: '#334155' }}>No credit notes found</h3>
          <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.9rem' }}>
            Create credit notes to handle customer returns or billing corrections.
          </p>
          <Link
            to="/credit-notes/new"
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            }}
          >
            <Plus size={16} />
            Create Credit Note
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="table-responsive-wrapper desktop-only" style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px 14px' }}>Credit Note #</th>
                  <th style={{ padding: '10px 14px' }}>Customer</th>
                  <th style={{ padding: '10px 14px' }}>Reason</th>
                  <th style={{ padding: '10px 14px' }}>Linked Invoice</th>
                  <th style={{ padding: '10px 14px' }}>Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Credit Total</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                  {/* Dynamic Custom Columns */}
                  {customColumns.map(col => (
                    <th key={col.id} style={{ padding: '10px 14px' }}>{col.label}</th>
                  ))}
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {creditNotes.map(cn => {
                  const stStyle = STATUS_CONFIG[cn.status] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
                  return (
                    <tr key={cn.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-row">
                      <td style={{ padding: '12px 14px', fontWeight: '600' }}>
                        <Link to={`/credit-notes/${cn.id}/edit`} style={{ color: '#dc2626', textDecoration: 'none' }}>
                          {cn.credit_note_number}
                        </Link>
                        {cn.reference_number && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '400' }}>
                            Ref: {cn.reference_number}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '500', color: '#1e293b' }}>
                          {cn.customer_name || 'N/A'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        <span style={{
                          background: '#f8fafc',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.78rem'
                        }}>
                          {cn.credit_reason}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        {cn.invoice_number ? (
                          <span style={{ fontWeight: '500', color: '#2563eb' }}>
                            {cn.invoice_number}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        {cn.credit_note_date || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>
                        {formatCurrency ? formatCurrency(cn.total_amount) : `${parseFloat(cn.total_amount || 0).toLocaleString()} ${currency}`}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: stStyle.bg,
                          color: stStyle.text,
                          border: `1px solid ${stStyle.border}`
                        }}>
                          {cn.status}
                        </span>
                      </td>
                      {/* Dynamic Custom Columns */}
                      {customColumns.map(col => (
                        <td key={col.id} style={{ padding: '12px 14px', color: '#475569' }}>
                          {cn.custom_fields?.[col.name] !== undefined && cn.custom_fields?.[col.name] !== null
                            ? String(cn.custom_fields[col.name])
                            : '—'}
                        </td>
                      ))}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(cn)}
                            disabled={downloadingPdfId === cn.id}
                            title="Download PDF"
                            style={{
                              padding: '5px 8px',
                              background: '#f8fafc',
                              color: '#475569',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                          >
                            <Download size={14} className={downloadingPdfId === cn.id ? 'animate-spin' : ''} />
                          </button>

                          <button
                            type="button"
                            onClick={() => navigate(`/credit-notes/${cn.id}/edit`)}
                            title="Edit Credit Note"
                            style={{
                              padding: '5px 8px',
                              background: '#f8fafc',
                              color: '#2563eb',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                          >
                            <Edit size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(cn)}
                            title="Delete Credit Note"
                            style={{
                              padding: '5px 8px',
                              background: '#fef2f2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (100% Mobile Responsive) */}
          <div className="mobile-cards-list mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {creditNotes.map(cn => {
              const stStyle = STATUS_CONFIG[cn.status] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
              return (
                <div
                  key={cn.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    padding: '0.9rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <Link
                        to={`/credit-notes/${cn.id}/edit`}
                        style={{ fontSize: '0.95rem', fontWeight: '700', color: '#dc2626', textDecoration: 'none' }}
                      >
                        {cn.credit_note_number}
                      </Link>
                      {cn.reference_number && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Ref: {cn.reference_number}
                        </div>
                      )}
                    </div>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '0.72rem',
                      fontWeight: '600',
                      backgroundColor: stStyle.bg,
                      color: stStyle.text,
                      border: `1px solid ${stStyle.border}`
                    }}>
                      {cn.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.88rem', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                    {cn.customer_name || 'No Customer'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '6px' }}>
                    <span>Reason: <b>{cn.credit_reason}</b></span>
                    <span>Date: {cn.credit_note_date || '—'}</span>
                  </div>

                  {cn.invoice_number && (
                    <div style={{ fontSize: '0.78rem', color: '#2563eb', marginBottom: '8px' }}>
                      Invoice: {cn.invoice_number}
                    </div>
                  )}

                  {/* Custom Fields in Mobile */}
                  {customColumns.length > 0 && (
                    <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '8px' }}>
                      {customColumns.map(col => (
                        <div key={col.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>{col.label}:</span>
                          <span style={{ fontWeight: '500' }}>{cn.custom_fields?.[col.name] ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid #f1f5f9'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>CREDIT VALUE</div>
                      <div style={{ fontSize: '1rem', fontWeight: '700', color: '#dc2626' }}>
                        {formatCurrency ? formatCurrency(cn.total_amount) : `${parseFloat(cn.total_amount || 0).toLocaleString()} ${currency}`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(cn)}
                        disabled={downloadingPdfId === cn.id}
                        style={{
                          padding: '6px 10px',
                          background: '#f8fafc',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px'
                        }}
                      >
                        <Download size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/credit-notes/${cn.id}/edit`)}
                        style={{
                          padding: '6px 10px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          borderRadius: '6px'
                        }}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cn)}
                        style={{
                          padding: '6px 10px',
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '6px'
                        }}
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
        .hover-row:hover {
          background-color: #f8fafc;
        }
      `}</style>
    </div>
  )
}

export default CreditNotes
