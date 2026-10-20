import { useState, useEffect } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { Plus, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, User, Calendar, FileText } from '../components/icons'
import api from '../api'
import Modal from '../components/common/Modal'
import SkeletonLoader from '../components/common/SkeletonLoader'
import SearchBar from '../components/common/SearchBar'
import { showConfirm, showError, showToast } from '../utils/swal'

const PaymentRequests = () => {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Lookups
  const [jobOrders, setJobOrders] = useState([])

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    job_order: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const { settings, formatCurrency } = useSettings()

  useEffect(() => {
    fetchRequests()
  }, [page, searchQuery, statusFilter])

  useEffect(() => {
    fetchLookups()
  }, [])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const params = { page }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }
      if (statusFilter) {
        params.status = statusFilter
      }
      const response = await api.get('payment-requests/', { params })
      setRequests(response.data.results || [])
      setTotalPages(Math.ceil((response.data.count || 0) / 25) || 1)
      setError('')
    } catch (err) {
      setError('Failed to fetch payment requests. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (val) => {
    setSearchQuery(val)
    setPage(1)
  }

  const fetchLookups = async () => {
    try {
      const res = await api.get('job-orders/')
      setJobOrders(res.data.results || res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleOpenModal = () => {
    setFormData({
      description: '',
      amount: '',
      job_order: ''
    })
    setFormError('')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.description || !formData.amount) {
      return setFormError('Description and Amount are required')
    }
    
    try {
      setSubmitting(true)
      setFormError('')
      
      const payload = { ...formData, job_order: formData.job_order || null }
      const response = await api.post('payment-requests/', payload)
      setRequests([response.data, ...requests])
      
      setIsModalOpen(false)
    } catch (err) {
      setFormError(err.response?.data?.message || 'Operation failed. Please check your data.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAction = async (id, action) => {
    const isApprove = action === 'approve'
    const confirmed = await showConfirm({
      title: isApprove ? 'Approve Payment Request?' : 'Reject Payment Request?',
      text: `Are you sure you want to ${action} this request?`,
      confirmButtonText: isApprove ? 'Yes, Approve' : 'Yes, Reject',
      isDangerous: !isApprove,
      icon: isApprove ? 'question' : 'warning',
    })
    if (!confirmed) return
    try {
      const statusValue = isApprove ? 'Approved' : 'Rejected'
      const response = await api.patch(`payment-requests/${id}/`, { status: statusValue })
      setRequests(requests.map(req => req.id === id ? response.data : req))
      showToast(`Request ${statusValue.toLowerCase()} successfully`, isApprove ? 'success' : 'info')
    } catch (err) {
      showError('Action Failed', `Failed to ${action} the request.`)
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'Approved': return 'var(--success)'
      case 'Rejected': return 'var(--danger)'
      default: return 'var(--warning)'
    }
  }

  return (
    <div className="payment-requests-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontWeight: '700', letterSpacing: '-0.01em', fontSize: '1.35rem' }}>Payment Requests</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>Submit internal disbursement requests and manage financial approval workflows</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ borderRadius: 'var(--radius-sm)' }}>
            <Plus size={16} /> New Request
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <SearchBar
            value={searchQuery}
            onChange={handleSearchChange}
            style={{ maxWidth: '420px' }}
          />
          <div style={{ width: '160px' }}>
            <select
              className="input-field"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
        <button
          className="btn btn-secondary"
          onClick={fetchRequests}
          title="Refresh table"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="glass-panel" style={{ overflowX: 'auto', minHeight: '200px', position: 'relative' }}>
        {loading ? (
          <div style={{ padding: '1.5rem' }}>
            <SkeletonLoader type="table" />
          </div>
        ) : (
          <>
        {requests.length === 0 && !error && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {searchQuery || statusFilter ? 'No payment requests match the active filter.' : 'No payment requests found. Click "New Request" to create one.'}
          </div>
        )}

        {requests.length > 0 && (
          <>
            {/* Desktop Table View */}
            <div className="desktop-only-table">
              <div className="table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Submission Date</th>
                      <th>Requested By</th>
                      <th>Request Details & Purpose</th>
                      <th>Linked Contract</th>
                      <th style={{ textAlign: 'right' }}>Amount Requested</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'center' }}>Management Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(req => (
                      <tr key={req.id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(req.created_at).toLocaleDateString()}</td>
                        <td style={{ fontWeight: '600' }}>{req.staff_user_name || 'Staff User'}</td>
                        <td>
                          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{req.description}</div>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          {req.job_order ? (
                             <span style={{ background: 'var(--primary-10)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                Linked
                             </span>
                          ) : '---'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--primary)' }}>
                          {formatCurrency(req.amount)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                           <span className={`badge ${req.status === 'Approved' ? 'badge-approved' : req.status === 'Pending' ? 'badge-pending' : 'badge-overdue'}`}>
                              {req.status === 'Pending' && <Clock size={11}/>}
                              {req.status === 'Approved' && <CheckCircle size={11}/>}
                              {req.status === 'Rejected' && <XCircle size={11}/>}
                              {req.status}
                            </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {req.status === 'Pending' ? (
                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                              <button 
                                className="btn-icon" 
                                style={{ width: '30px', height: '30px', color: 'var(--success)', background: 'var(--success-10)' }}
                                onClick={() => handleAction(req.id, 'approve')}
                                title="Approve Request"
                              >
                                <CheckCircle size={14} />
                              </button>
                              <button 
                                className="btn-icon" 
                                style={{ width: '30px', height: '30px', color: 'var(--danger)', background: 'var(--danger-10)' }}
                                onClick={() => handleAction(req.id, 'reject')}
                                title="Reject Request"
                              >
                                <XCircle size={14} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Native Cards View (<= 768px) */}
            <div className="mobile-only-cards" style={{ padding: '0.75rem' }}>
              {requests.map(req => (
                <div key={req.id} className="mobile-entity-card">
                  <div className="mobile-card-header">
                    <div className="mobile-card-title-group">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Calendar size={12} /> {new Date(req.created_at).toLocaleDateString()}
                          </span>
                          <span className={`badge ${req.status === 'Approved' ? 'badge-approved' : req.status === 'Pending' ? 'badge-pending' : 'badge-overdue'}`}>
                            {req.status === 'Pending' && <Clock size={11}/>}
                            {req.status === 'Approved' && <CheckCircle size={11}/>}
                            {req.status === 'Rejected' && <XCircle size={11}/>}
                            {req.status}
                          </span>
                        </div>
                        <div className="mobile-card-title" style={{ fontSize: '0.9rem' }}>
                          {req.description}
                        </div>
                        <div className="mobile-card-sub">
                          <span>By: {req.staff_user_name || 'Staff User'}</span>
                          {req.job_order && (
                            <span style={{ background: '#ebf3fc', color: '#1366d9', padding: '1px 5px', borderRadius: '4px', fontWeight: '700', fontSize: '0.68rem' }}>
                              Linked Contract
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Amount Requested</span>
                      <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(req.amount)}
                      </div>
                    </div>

                    {req.status === 'Pending' ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleAction(req.id, 'approve')}
                          style={{
                            padding: '0.45rem 0.85rem',
                            borderRadius: '8px',
                            border: '1px solid #bbf7d0',
                            background: '#f0fdf4',
                            color: '#16a34a',
                            fontWeight: '700',
                            fontSize: '0.78rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            cursor: 'pointer'
                          }}
                        >
                          <CheckCircle size={14} /> Approve
                        </button>
                        <button
                          onClick={() => handleAction(req.id, 'reject')}
                          style={{
                            padding: '0.45rem 0.85rem',
                            borderRadius: '8px',
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
                            fontWeight: '700',
                            fontSize: '0.78rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            cursor: 'pointer'
                          }}
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>
                        Decision Processed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination" style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                <button 
                  className="btn glass-panel" 
                  disabled={page === 1}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                >
                  Prev
                </button>
                <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
                  Page {page} of {totalPages}
                </span>
                <button 
                  className="btn glass-panel" 
                  disabled={page === totalPages}
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
          </>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Submit Payment Request"
      >
        <form onSubmit={handleSubmit}>
          {formError && <div className="error-message">{formError}</div>}
          
          <div className="form-grid">
            <div className="form-group col-span-2">
              <label>Justification / Description *</label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Amount Required *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{settings.currency}</span>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input-field" 
                  style={{ paddingLeft: '2rem' }}
                  value={formData.amount} 
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Job Order Allocation (Optional)</label>
              <select className="input-field" value={formData.job_order} onChange={e => setFormData({...formData, job_order: e.target.value})}>
                <option value="">No Active Linkage</option>
                {jobOrders.map(j => <option key={j.id} value={j.id}>{j.order_id || `#ID${j.id}`} - {j.title}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request for Approval'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default PaymentRequests
