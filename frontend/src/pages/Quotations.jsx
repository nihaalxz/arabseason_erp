import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  Plus, Search, RefreshCw, Trash2, Edit, ArrowDownTray, 
  CheckCircle, Clock, AlertCircle, 
  FileText, Users, Briefcase, Calendar, 
  ChevronRight, Receipt, XCircle, ArrowUpRight, Check, RotateCcw
} from '../components/icons'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { showConfirm, showError, showToast, showSuccess } from '../utils/swal'
import { handlePdfResponse } from '../utils/pdfDownload'

const STATUS_CHOICES = [
  'All',
  'Draft',
  'Sent',
  'Accepted',
  'Declined',
  'Converted to Invoice',
  'Expired'
]

const STATUS_CONFIG = {
  'Draft': { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  'Sent': { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  'Accepted': { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  'Declined': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  'Converted to Invoice': { bg: '#f0fdfa', text: '#0d9488', border: '#99f6e4' },
  'Expired': { bg: '#faf5ff', text: '#7c3aed', border: '#e9d5ff' }
}

const Quotations = () => {
  const { settings, formatCurrency } = useSettings()
  const currency = settings?.currency || 'SAR'
  const navigate = useNavigate()

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

  // KPI Metrics Calculation
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
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)'
            }}>
              <FileText size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#1e293b' }}>
                Quotations & Proposals
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Create, track, and convert client price quotes into invoices
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={fetchQuotations}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <Link
            to="/quotations/new"
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: '600',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              borderColor: '#4f46e5'
            }}
          >
            <Plus size={16} />
            New Quotation
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="quotation-kpi-grid" style={{
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
            Total Pipeline Value
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#0f172a', margin: '4px 0' }}>
            {formatCurrency ? formatCurrency(kpis.totalVal) : `${kpis.totalVal.toLocaleString()} ${currency}`}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Across {quotations.length} quotations
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
            Accepted Quotes
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#059669', margin: '4px 0' }}>
            {formatCurrency ? formatCurrency(kpis.acceptedVal) : `${kpis.acceptedVal.toLocaleString()} ${currency}`}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#059669' }}>
            Ready for billing & execution
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
            Pending Client Decision
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#2563eb', margin: '4px 0' }}>
            {formatCurrency ? formatCurrency(kpis.pendingVal) : `${kpis.pendingVal.toLocaleString()} ${currency}`}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#2563eb' }}>
            Sent / Draft status
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          padding: '1rem',
          border: '1px solid #99f6e4',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#0d9488', textTransform: 'uppercase' }}>
            Converted to Invoice
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#0d9488', margin: '4px 0' }}>
            {kpis.convertedCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#0d9488' }}>
            Seamlessly billed to clients
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

        {/* Status Filter */}
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

        {/* Customer Filter */}
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

        {(searchQuery || customerFilter || statusFilter !== 'All' || dateRange.start || dateRange.end) && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setSearchQuery('')
              setStatusFilter('All')
              setCustomerFilter('')
              setDateRange({ start: '', end: '' })
            }}
            style={{ fontSize: '0.8rem', padding: '4px 8px', color: '#64748b' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Quotations List */}
      {loading ? (
        <SkeletonLoader count={5} />
      ) : quotations.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          padding: '1.75rem 1.25rem',
          textAlign: 'center',
          border: '1px solid #e2e8f0'
        }}>
          <FileText size={42} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
          <h3 style={{ margin: '0 0 6px', color: '#334155' }}>No quotations found</h3>
          <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.9rem' }}>
            No quotation matches your current search criteria or none have been created yet.
          </p>
          <Link
            to="/quotations/new"
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
            }}
          >
            <Plus size={16} />
            Create First Quotation
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
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
                  <th style={{ padding: '10px 14px' }}>Quote #</th>
                  <th style={{ padding: '10px 14px' }}>Customer</th>
                  <th style={{ padding: '10px 14px' }}>Date</th>
                  <th style={{ padding: '10px 14px' }}>Valid Until</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Amount</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                  {/* Dynamic Custom Columns */}
                  {customColumns.map(col => (
                    <th key={col.id} style={{ padding: '10px 14px' }}>{col.label}</th>
                  ))}
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map(q => {
                  const stStyle = STATUS_CONFIG[q.status] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
                  return (
                    <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-row">
                      <td style={{ padding: '12px 14px', fontWeight: '600' }}>
                        <Link to={`/quotations/${q.id}/edit`} style={{ color: '#4f46e5', textDecoration: 'none' }}>
                          {q.quotation_number}
                        </Link>
                        {q.reference_number && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '400' }}>
                            Ref: {q.reference_number}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '500', color: '#1e293b' }}>
                          {q.customer_name || 'N/A'}
                        </div>
                        {q.customer_phone && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {q.customer_phone}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        {q.quotation_date || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        {q.valid_until || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                        {formatCurrency ? formatCurrency(q.total_amount) : `${parseFloat(q.total_amount || 0).toLocaleString()} ${currency}`}
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
                          {q.status}
                        </span>
                      </td>
                      {/* Dynamic Custom Columns */}
                      {customColumns.map(col => (
                        <td key={col.id} style={{ padding: '12px 14px', color: '#475569' }}>
                          {q.custom_fields?.[col.name] !== undefined && q.custom_fields?.[col.name] !== null
                            ? String(q.custom_fields[col.name])
                            : '—'}
                        </td>
                      ))}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* Convert to Invoice Button */}
                          {q.status !== 'Converted to Invoice' && (
                            <button
                              type="button"
                              onClick={() => handleConvertToInvoice(q)}
                              disabled={convertingId === q.id}
                              title="Convert to Tax Invoice"
                              style={{
                                padding: '5px 8px',
                                background: '#ecfdf5',
                                color: '#059669',
                                border: '1px solid #a7f3d0',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.78rem',
                                fontWeight: '600'
                              }}
                            >
                              <ArrowUpRight size={13} />
                              Convert
                            </button>
                          )}

                          {/* Download PDF */}
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(q)}
                            disabled={downloadingPdfId === q.id}
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
                            <ArrowDownTray size={14} className={downloadingPdfId === q.id ? 'animate-spin' : ''} />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => navigate(`/quotations/${q.id}/edit`)}
                            title="Edit Quotation"
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

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(q)}
                            title="Delete Quotation"
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
            {quotations.map(q => {
              const stStyle = STATUS_CONFIG[q.status] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
              return (
                <div
                  key={q.id}
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
                        to={`/quotations/${q.id}/edit`}
                        style={{ fontSize: '0.95rem', fontWeight: '700', color: '#4f46e5', textDecoration: 'none' }}
                      >
                        {q.quotation_number}
                      </Link>
                      {q.reference_number && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Ref: {q.reference_number}
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
                      {q.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.88rem', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                    {q.customer_name || 'No Customer'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '8px' }}>
                    <span>Date: {q.quotation_date || '—'}</span>
                    <span>Valid: {q.valid_until || '—'}</span>
                  </div>

                  {/* Custom Fields in Mobile */}
                  {customColumns.length > 0 && (
                    <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '8px' }}>
                      {customColumns.map(col => (
                        <div key={col.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>{col.label}:</span>
                          <span style={{ fontWeight: '500' }}>{q.custom_fields?.[col.name] ?? '—'}</span>
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
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>TOTAL</div>
                      <div style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>
                        {formatCurrency ? formatCurrency(q.total_amount) : `${parseFloat(q.total_amount || 0).toLocaleString()} ${currency}`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {q.status !== 'Converted to Invoice' && (
                        <button
                          type="button"
                          onClick={() => handleConvertToInvoice(q)}
                          disabled={convertingId === q.id}
                          style={{
                            padding: '6px 10px',
                            background: '#ecfdf5',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}
                        >
                          Convert
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(q)}
                        disabled={downloadingPdfId === q.id}
                        style={{
                          padding: '6px 10px',
                          background: '#f8fafc',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px'
                        }}
                      >
                        <ArrowDownTray size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/quotations/${q.id}/edit`)}
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
                        onClick={() => handleDelete(q)}
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

export default Quotations
