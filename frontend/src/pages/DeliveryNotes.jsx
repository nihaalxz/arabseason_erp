import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  Plus, Search, RefreshCw, Trash2, Edit, Download, 
  Truck, CheckCircle, Clock, AlertCircle, 
  Users, Calendar, Package, MapPin
} from 'lucide-react'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'
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

const STATUS_CONFIG = {
  'Draft': { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  'Dispatched': { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  'In Transit': { bg: '#fefce8', text: '#ca8a04', border: '#fef08a' },
  'Delivered': { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  'Signed & Returned': { bg: '#f0fdfa', text: '#0d9488', border: '#99f6e4' },
  'Cancelled': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' }
}

const DeliveryNotes = () => {
  const { settings } = useSettings()
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

  // Dynamic Custom Columns
  const [customColumns, setCustomColumns] = useState([])

  const fetchCustomColumns = async () => {
    try {
      const res = await api.get('custom-fields/', { params: { form_type: 'delivery_note' } })
      setCustomColumns((res.data || []).filter(f => f.show_in_table))
    } catch (e) {
      console.error('Failed to load custom delivery note columns', e)
    }
  }

  useEffect(() => {
    fetchCustomColumns()
    fetchLookups()
    fetchDeliveryNotes()
  }, [])

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
    const confirmed = await showConfirm(
      'Delete Delivery Note',
      `Are you sure you want to delete ${dn.delivery_note_number}? This cannot be undone.`
    )
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
    let totalPkgs = 0

    deliveryNotes.forEach(dn => {
      if (dn.status === 'Delivered' || dn.status === 'Signed & Returned') deliveredCount += 1
      if (dn.status === 'Dispatched' || dn.status === 'In Transit') inTransitCount += 1
      totalPkgs += parseInt(dn.total_packages) || 1
    })

    return { total: deliveryNotes.length, deliveredCount, inTransitCount, totalPkgs }
  }, [deliveryNotes])

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
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 10px rgba(13, 148, 136, 0.3)'
            }}>
              <Truck size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#1e293b' }}>
                Delivery Notes & Dispatch
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Manage physical cargo dispatch, shipping tracking, and receiver signed proofs
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={fetchDeliveryNotes}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <Link
            to="/delivery-notes/new"
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: '600',
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              borderColor: '#0f766e'
            }}
          >
            <Plus size={16} />
            New Delivery Note
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="delivery-kpi-grid" style={{
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
            Total Dispatches
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#0f172a', margin: '4px 0' }}>
            {kpis.total}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            All recorded shipments
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
            Delivered & Signed
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#059669', margin: '4px 0' }}>
            {kpis.deliveredCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#059669' }}>
            Successfully completed
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          padding: '1rem',
          border: '1px solid #fef08a',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#ca8a04', textTransform: 'uppercase' }}>
            In Transit / Dispatched
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#ca8a04', margin: '4px 0' }}>
            {kpis.inTransitCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#ca8a04' }}>
            On vehicle or en route
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
            Total Packages
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#0d9488', margin: '4px 0' }}>
            {kpis.totalPkgs}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#0d9488' }}>
            Parcels / crates handled
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
            style={{ padding: '5px 8px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          />
        </div>

        {/* End Date */}
        <div>
          <input
            type="date"
            title="End Date"
            value={dateRange.end}
            onChange={(e) => setDateRange(p => ({ ...p, end: e.target.value }))}
            style={{ padding: '5px 8px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
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

      {/* Main Content */}
      {loading ? (
        <SkeletonLoader count={5} />
      ) : deliveryNotes.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          padding: '1.75rem 1.25rem',
          textAlign: 'center',
          border: '1px solid #e2e8f0'
        }}>
          <Truck size={42} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
          <h3 style={{ margin: '0 0 6px', color: '#334155' }}>No delivery notes found</h3>
          <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.9rem' }}>
            Create delivery notes to issue official delivery challans and track signed dispatch receipts.
          </p>
          <Link
            to="/delivery-notes/new"
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)'
            }}
          >
            <Plus size={16} />
            Create Delivery Note
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
                  <th style={{ padding: '10px 14px' }}>Delivery Note #</th>
                  <th style={{ padding: '10px 14px' }}>Customer</th>
                  <th style={{ padding: '10px 14px' }}>Carrier / Driver</th>
                  <th style={{ padding: '10px 14px' }}>Vehicle #</th>
                  <th style={{ padding: '10px 14px' }}>Delivery Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Packages</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                  {/* Dynamic Custom Columns */}
                  {customColumns.map(col => (
                    <th key={col.id} style={{ padding: '10px 14px' }}>{col.label}</th>
                  ))}
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveryNotes.map(dn => {
                  const stStyle = STATUS_CONFIG[dn.status] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
                  return (
                    <tr key={dn.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-row">
                      <td style={{ padding: '12px 14px', fontWeight: '600' }}>
                        <Link to={`/delivery-notes/${dn.id}/edit`} style={{ color: '#0d9488', textDecoration: 'none' }}>
                          {dn.delivery_note_number}
                        </Link>
                        {dn.reference_number && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '400' }}>
                            Ref: {dn.reference_number}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '500', color: '#1e293b' }}>
                          {dn.customer_name || 'N/A'}
                        </div>
                        {dn.receiver_name && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Attn: {dn.receiver_name}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        {dn.driver_name ? (
                          <div>
                            <span style={{ fontWeight: '500' }}>{dn.driver_name}</span>
                            {dn.driver_phone && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}> ({dn.driver_phone})</span>}
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        {dn.vehicle_number || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        {dn.delivery_date || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '600' }}>
                        {dn.total_packages || 1}
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
                          {dn.status}
                        </span>
                      </td>
                      {/* Dynamic Custom Columns */}
                      {customColumns.map(col => (
                        <td key={col.id} style={{ padding: '12px 14px', color: '#475569' }}>
                          {dn.custom_fields?.[col.name] !== undefined && dn.custom_fields?.[col.name] !== null
                            ? String(dn.custom_fields[col.name])
                            : '—'}
                        </td>
                      ))}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(dn)}
                            disabled={downloadingPdfId === dn.id}
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
                            <Download size={14} className={downloadingPdfId === dn.id ? 'animate-spin' : ''} />
                          </button>

                          <button
                            type="button"
                            onClick={() => navigate(`/delivery-notes/${dn.id}/edit`)}
                            title="Edit Delivery Note"
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
                            onClick={() => handleDelete(dn)}
                            title="Delete Delivery Note"
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
            {deliveryNotes.map(dn => {
              const stStyle = STATUS_CONFIG[dn.status] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
              return (
                <div
                  key={dn.id}
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
                        to={`/delivery-notes/${dn.id}/edit`}
                        style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0d9488', textDecoration: 'none' }}
                      >
                        {dn.delivery_note_number}
                      </Link>
                      {dn.reference_number && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Ref: {dn.reference_number}
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
                      {dn.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.88rem', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                    {dn.customer_name || 'No Customer'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '6px' }}>
                    <span>Date: {dn.delivery_date || '—'}</span>
                    <span>Packages: <b>{dn.total_packages || 1}</b></span>
                  </div>

                  {dn.driver_name && (
                    <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '4px' }}>
                      Driver: <b>{dn.driver_name}</b> {dn.vehicle_number ? `(${dn.vehicle_number})` : ''}
                    </div>
                  )}

                  {/* Custom Fields in Mobile */}
                  {customColumns.length > 0 && (
                    <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '8px' }}>
                      {customColumns.map(col => (
                        <div key={col.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>{col.label}:</span>
                          <span style={{ fontWeight: '500' }}>{dn.custom_fields?.[col.name] ?? '—'}</span>
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
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {dn.shipping_method || 'Direct Dispatch'}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(dn)}
                        disabled={downloadingPdfId === dn.id}
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
                        onClick={() => navigate(`/delivery-notes/${dn.id}/edit`)}
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
                        onClick={() => handleDelete(dn)}
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
        .hover-row:hover {
          background-color: #f8fafc;
        }
      `}</style>
    </div>
  )
}

export default DeliveryNotes
