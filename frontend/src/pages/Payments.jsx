import { useState, useEffect } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { Plus, RefreshCw, AlertCircle, Edit, Trash2, BookOpen, Folder, ChevronRight, Briefcase, Layers, ArrowDownLeft, ArrowUpRight } from '../components/icons'
import api from '../api'
import Modal from '../components/common/Modal'
import SkeletonLoader from '../components/common/SkeletonLoader'
import SearchBar from '../components/common/SearchBar'
import DynamicCustomFields from '../components/common/DynamicCustomFields'
import { showConfirm, showError, showToast } from '../utils/swal'

const Payments = () => {
  const [activeTab, setActiveTab] = useState('customer') // 'customer' | 'vendor'
  const [selectedPartyBook, setSelectedPartyBook] = useState('all')
  const [customerPayments, setCustomerPayments] = useState([])
  const [vendorPayments, setVendorPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [formData, setFormData] = useState({
    customer: '',
    vendor: '',
    job_order: '',
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
    custom_fields: {}
  })
  
  const [customers, setCustomers] = useState([])
  const [vendors, setVendors] = useState([])
  const [jobs, setJobs] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const { settings, formatCurrency } = useSettings()

  useEffect(() => {
    fetchPayments()
  }, [activeTab, page, searchQuery, selectedPartyBook])

  useEffect(() => {
    fetchLookups()
  }, [])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const endpoint = activeTab === 'customer' ? 'customer-payments/' : 'vendor-payments/'
      const params = { page }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }
      if (selectedPartyBook && selectedPartyBook !== 'all') {
        if (activeTab === 'customer') params.customer = selectedPartyBook
        else params.vendor = selectedPartyBook
      }
      const response = await api.get(endpoint, { params })
      
      if (activeTab === 'customer') {
        setCustomerPayments(response.data.results || [])
      } else {
        setVendorPayments(response.data.results || [])
      }
      setTotalCount(response.data.count || 0)
      setTotalPages(Math.ceil((response.data.count || 0) / 25) || 1)
      setError('')
    } catch (err) {
      setError(`Failed to fetch ${activeTab} payments. Please try again.`)
      console.error(err)
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
      const [cRes, vRes, jRes] = await Promise.all([
        api.get('customers/?page_size=1000'),
        api.get('vendors/?page_size=1000'),
        api.get('job-orders/?page_size=1000&lookup=true')
      ])
      setCustomers(cRes.data.results || cRes.data)
      setVendors(vRes.data.results || vRes.data)
      setJobs(jRes.data.results || jRes.data)
    } catch (err) {
      console.error('Failed to fetch lookups', err)
    }
  }

  const handleOpenModal = (payment = null) => {
    if (payment) {
      setEditingPayment(payment)
      setFormData({
        customer: payment.customer || '',
        vendor: payment.vendor || '',
        job_order: payment.job_order || '',
        amount: payment.amount,
        payment_date: payment.payment_date,
        notes: payment.notes || '',
        custom_fields: payment.custom_fields || {}
      })
    } else {
      setEditingPayment(null)
      setFormData({
        customer: '',
        vendor: '',
        job_order: '',
        amount: 0,
        payment_date: new Date().toISOString().split('T')[0],
        notes: '',
        custom_fields: {}
      })
    }
    setFormError('')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.amount || formData.amount <= 0) {
      return setFormError('Please enter a valid amount')
    }

    if (activeTab === 'customer' && !formData.customer) {
      return setFormError('Please select a customer')
    }
    if (activeTab === 'vendor' && !formData.vendor) {
      return setFormError('Please select a vendor')
    }

    try {
      setSubmitting(true)
      setFormError('')
      
      const payload = {
        amount: formData.amount,
        payment_date: formData.payment_date,
        notes: formData.notes,
        job_order: formData.job_order || null,
        custom_fields: formData.custom_fields || {}
      }

      if (activeTab === 'customer') {
        payload.customer = formData.customer
      } else {
        payload.vendor = formData.vendor
      }

      const endpoint = activeTab === 'customer' ? 'customer-payments/' : 'vendor-payments/'

      if (editingPayment) {
        const response = await api.put(`${endpoint}${editingPayment.id}/`, payload)
        if (activeTab === 'customer') {
          setCustomerPayments(customerPayments.map(p => p.id === editingPayment.id ? response.data : p))
        } else {
          setVendorPayments(vendorPayments.map(p => p.id === editingPayment.id ? response.data : p))
        }
      } else {
        const response = await api.post(endpoint, payload)
        if (activeTab === 'customer') {
          setCustomerPayments([response.data, ...customerPayments])
        } else {
          setVendorPayments([response.data, ...vendorPayments])
        }
      }
      
      setIsModalOpen(false)
      setEditingPayment(null)
    } catch (err) {
      const errorData = err.response?.data
      let errorMessage = 'Failed to save payment record.'
      
      if (errorData) {
        if (typeof errorData === 'object') {
          errorMessage = Object.entries(errorData)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
            .join(' | ')
        } else if (typeof errorData === 'string') {
          errorMessage = errorData
        }
      }
      
      setFormError(errorMessage)
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Payment?',
      text: 'Are you sure you want to delete this payment record? This will adjust the ledger balance.',
      confirmButtonText: 'Yes, Delete',
      isDangerous: true,
    })
    if (confirmed) {
      try {
        const endpoint = activeTab === 'customer' ? 'customer-payments/' : 'vendor-payments/'
        await api.delete(`${endpoint}${id}/`)
        if (activeTab === 'customer') {
          setCustomerPayments(customerPayments.filter(p => p.id !== id))
        } else {
          setVendorPayments(vendorPayments.filter(p => p.id !== id))
        }
        showToast('Payment record deleted', 'success')
      } catch (err) {
        showError('Delete Failed', 'Failed to delete payment.')
      }
    }
  }

  const data = activeTab === 'customer' ? customerPayments : vendorPayments

  const totalAmount = data.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0)
  const averageAmount = data.length > 0 ? (totalAmount / data.length) : 0
  const activePartyName = selectedPartyBook === 'all'
    ? (activeTab === 'customer' ? 'All Customers' : 'All Vendors')
    : (activeTab === 'customer' 
        ? (customers.find(c => String(c.id) === String(selectedPartyBook))?.name || 'Selected Customer')
        : (vendors.find(v => String(v.id) === String(selectedPartyBook))?.name || 'Selected Vendor'))

  return (
    <div className="payments-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', paddingBottom: '3rem' }}>
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontWeight: '700', letterSpacing: '-0.01em', fontSize: '1.35rem' }}>Payments & Receipts</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>Record customer invoice payments and track vendor disbursements</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ borderRadius: 'var(--radius-sm)' }}>
            <Plus size={16} /> Record Payment
          </button>
        </div>
      </div>

      <div className="tabs-scrollable" style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <button 
          className="btn"
          style={{ 
            width: 'auto', 
            whiteSpace: 'nowrap',
            padding: '0.55rem 1rem',
            background: 'transparent',
            color: activeTab === 'customer' ? 'var(--primary, #1366d9)' : 'var(--text-muted)',
            borderBottom: `2px solid ${activeTab === 'customer' ? 'var(--primary, #1366d9)' : 'transparent'}`,
            borderRadius: '0',
            fontWeight: activeTab === 'customer' ? '700' : '500',
            fontSize: '0.85rem'
          }}
          onClick={() => { setActiveTab('customer'); setSelectedPartyBook('all'); setPage(1); }}
        >
          Customer Receipts
        </button>
        <button 
          className="btn"
          style={{ 
            width: 'auto', 
            whiteSpace: 'nowrap',
            padding: '0.55rem 1rem',
            background: 'transparent',
            color: activeTab === 'vendor' ? 'var(--primary, #1366d9)' : 'var(--text-muted)',
            borderBottom: `2px solid ${activeTab === 'vendor' ? 'var(--primary, #1366d9)' : 'transparent'}`,
            borderRadius: '0',
            fontWeight: activeTab === 'vendor' ? '700' : '500',
            fontSize: '0.85rem'
          }}
          onClick={() => { setActiveTab('vendor'); setSelectedPartyBook('all'); setPage(1); }}
        >
          Vendor Payments
        </button>
      </div>

      {/* Party Breadcrumb Navigation */}
      {selectedPartyBook !== 'all' && (
        <div className="breadcrumb-nav-bar" style={{ marginBottom: '1rem' }}>
          <span className="breadcrumb-item" onClick={() => { setSelectedPartyBook('all'); setPage(1); }}>
            <Briefcase size={15} /> All {activeTab === 'customer' ? 'Customers' : 'Vendors'}
          </span>
          <span className="breadcrumb-separator"><ChevronRight size={14} /></span>
          <span className="breadcrumb-current">
            <Folder size={15} /> {activePartyName}
          </span>
          <button 
            onClick={() => { setSelectedPartyBook('all'); setPage(1); }}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.825rem', fontWeight: '600' }}
          >
            &larr; View All {activeTab === 'customer' ? 'Customers' : 'Vendors'}
          </button>
        </div>
      )}

      {/* Party Books Quick Pill Bar */}
      <div className="category-pill-bar" style={{ marginBottom: '1.25rem' }}>
        <button 
          className={`category-pill ${selectedPartyBook === 'all' ? 'active' : ''}`}
          onClick={() => { setSelectedPartyBook('all'); setPage(1); }}
        >
          All {activeTab === 'customer' ? 'Customers' : 'Vendors'}
        </button>
        {(activeTab === 'customer' ? customers : vendors).map(party => (
          <button 
            key={party.id} 
            className={`category-pill ${String(selectedPartyBook) === String(party.id) ? 'active' : ''}`}
            onClick={() => { setSelectedPartyBook(String(party.id)); setPage(1); }}
          >
            {party.name}
          </button>
        ))}
      </div>

      <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <SearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          style={{ flex: 1, minWidth: '220px', maxWidth: '420px' }}
        />
        <button
          className="btn btn-secondary"
          onClick={fetchPayments}
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

      <div className="glass-panel" style={{ overflowX: 'auto', minHeight: '200px', position: 'relative', paddingBottom: 0 }}>
        {loading ? (
          <div style={{ padding: '1.5rem' }}>
            <SkeletonLoader type="table" />
          </div>
        ) : (
          <>
        {data.length === 0 && !error && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {searchQuery ? `No ${activeTab} payments matching "${searchQuery}"` : `No ${activeTab} payments recorded for ${activePartyName}. Click "+ Record Payment" to add one.`}
          </div>
        )}

        {data.length > 0 && (
          <>
            {/* Desktop Table View */}
            <div className="desktop-only-table">
              <div className="table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Execution Date</th>
                      <th>{activeTab === 'customer' ? 'Entity of Origin' : 'Strategic Supplier'}</th>
                      <th>Linked Engagement</th>
                      <th style={{ textAlign: 'right' }}>Capital Value</th>
                      <th style={{ textAlign: 'right' }}>Management</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(item => (
                      <tr key={item.id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.payment_date}</td>
                        <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{item.customer_name || item.vendor_name || 'N/A'}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: '600' }}>{item.job_order_title || 'General Allocation'}</td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: activeTab === 'customer' ? 'var(--success)' : 'var(--danger)' }}>
                          {formatCurrency(item.amount)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button 
                              className="btn-icon" 
                              style={{ width: '32px', height: '32px' }}
                              onClick={() => handleOpenModal(item)}
                              title="Modify Transaction"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className="btn-icon" 
                              style={{ width: '32px', height: '32px', color: 'var(--danger)' }}
                              onClick={() => handleDelete(item.id)}
                              title="Nulify Transaction"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Native Cards View (<= 768px) */}
            <div className="mobile-only-cards" style={{ padding: '0.75rem' }}>
              {data.map(item => {
                const isCustomer = activeTab === 'customer'
                const partyName = item.customer_name || item.vendor_name || 'N/A'

                return (
                  <div 
                    key={item.id} 
                    className="mobile-entity-card"
                    onClick={() => handleOpenModal(item)}
                  >
                    <div className="mobile-card-header">
                      <div className="mobile-card-title-group">
                        <div 
                          className="mobile-card-avatar" 
                          style={{ 
                            background: isCustomer ? '#dcfce7' : '#fee2e2', 
                            color: isCustomer ? '#16a34a' : '#dc2626' 
                          }}
                        >
                          {isCustomer ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="mobile-card-title">{partyName}</div>
                          <div className="mobile-card-sub">
                            <span>{item.payment_date}</span>
                            <span>&bull; {item.job_order_title || 'General Allocation'}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div 
                          style={{ 
                            fontSize: '1rem', 
                            fontWeight: '800', 
                            color: isCustomer ? '#16a34a' : '#dc2626',
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          {isCustomer ? '+' : '-'}{formatCurrency(item.amount)}
                        </div>
                        <span 
                          className="mobile-card-badge" 
                          style={{ 
                            background: isCustomer ? '#f0fdf4' : '#fef2f2', 
                            color: isCustomer ? '#16a34a' : '#dc2626',
                            fontSize: '0.65rem'
                          }}
                        >
                          {isCustomer ? 'RECEIPT' : 'DISBURSED'}
                        </span>
                      </div>
                    </div>

                    <div className="mobile-card-footer" onClick={(e) => e.stopPropagation()}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Ref: #{item.id.toString().padStart(5, '0')}
                      </div>
                      <div className="mobile-card-actions">
                        <button 
                          className="mobile-card-action-btn" 
                          onClick={() => handleOpenModal(item)}
                          title="Modify Transaction"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          className="mobile-card-action-btn delete" 
                          onClick={() => handleDelete(item.id)}
                          title="Nullify Transaction"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Always Visible Sticky Totals Bar */}
            <div className="sticky-totals-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={16} color="var(--primary)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Scope:</span>
                <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.875rem' }}>
                  {activePartyName}
                </span>
              </div>
              <div className="sticky-totals-items">
                <div className="sticky-total-item">
                  <span className="sticky-total-label">Total Transactions</span>
                  <span className="sticky-total-value">{data.length} records</span>
                </div>
                <div className="sticky-total-item">
                  <span className="sticky-total-label">{activeTab === 'customer' ? 'Total Received' : 'Total Disbursed'}</span>
                  <span className="sticky-total-value" style={{ color: activeTab === 'customer' ? 'var(--success)' : 'var(--danger)' }}>
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                <div className="sticky-total-item">
                  <span className="sticky-total-label">Average Transaction</span>
                  <span className="sticky-total-value">
                    {formatCurrency(averageAmount)}
                  </span>
                </div>
              </div>
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
        title={editingPayment ? `Edit ${activeTab} Payment` : `Record ${activeTab} Payment`}
      >
        <form onSubmit={handleSubmit}>
          {formError && <div className="error-message">{formError}</div>}
          
          <div className="form-grid">
            {activeTab === 'customer' ? (
              <div className="form-group">
                <label>Customer / Client *</label>
                <select 
                  className="input-field" 
                  value={formData.customer} 
                  onChange={(e) => setFormData({...formData, customer: e.target.value})}
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label>Vendor / Supplier *</label>
                <select 
                  className="input-field" 
                  value={formData.vendor} 
                  onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                  required
                >
                  <option value="">Select Vendor</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Link to Job Order</label>
              <select 
                className="input-field" 
                value={formData.job_order} 
                onChange={(e) => setFormData({...formData, job_order: e.target.value})}
              >
                <option value="">General Payment (No Job)</option>
                {jobs.filter(j => {
                  if (activeTab === 'customer') {
                    return !formData.customer || j.customer === parseInt(formData.customer);
                  } else {
                    return !formData.vendor || j.vendor === parseInt(formData.vendor);
                  }
                }).map(j => (
                  <option key={j.id} value={j.id}>#{j.order_id || j.id} - {j.title}</option>
                ))}
              </select>
            </div>

            {formData.job_order && (
              <div className="form-group col-span-2" style={{ marginBottom: '1rem' }}>
                <div style={{ 
                  padding: '1rem', 
                  background: 'var(--bg-color)', 
                  borderRadius: '12px', 
                  border: '1px solid var(--border-color)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1rem',
                  fontSize: '0.85rem'
                }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Contract Total</div>
                    <div style={{ fontWeight: '700' }}>{formatCurrency(jobs.find(j => j.id == formData.job_order)?.total_amount || 0)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Amount Paid</div>
                    <div style={{ fontWeight: '700', color: 'var(--success)' }}>{formatCurrency(jobs.find(j => j.id == formData.job_order)?.paid_amount || 0)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Pending Balance</div>
                    <div style={{ fontWeight: '700', color: 'var(--danger)' }}>{formatCurrency(jobs.find(j => j.id == formData.job_order)?.balance || 0)}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Payment Amount *</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '700' }}>{settings?.currency || ''}</span>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input-field" 
                  style={{ paddingLeft: '3.5rem' }}
                  value={formData.amount} 
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Payment Date *</label>
              <input 
                type="date" 
                className="input-field" 
                value={formData.payment_date} 
                onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                required
              />
            </div>

            <div className="form-group col-span-2">
              <label>Payment Notes / Transaction Details</label>
              <textarea 
                className="input-field" 
                style={{ minHeight: '100px' }} 
                value={formData.notes} 
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              ></textarea>
            </div>

            {/* Dynamic Custom Form Fields */}
            <div className="col-span-2">
              <DynamicCustomFields
                formType={activeTab === 'customer' ? 'customer_payment' : 'expense'}
                values={formData.custom_fields || {}}
                onChange={(name, val) => setFormData(prev => ({
                  ...prev,
                  custom_fields: { ...(prev.custom_fields || {}), [name]: val }
                }))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }} disabled={submitting}>
              {submitting ? 'Processing...' : (editingPayment ? 'Save Changes' : 'Record Payment')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Payments
