import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit, Trash2, Plus, RefreshCw, AlertCircle, Phone, Mail, ChevronRight } from '../components/icons'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'
import Modal from '../components/common/Modal'
import SkeletonLoader from '../components/common/SkeletonLoader'
import SearchBar from '../components/common/SearchBar'
import { showConfirm, showError, showToast } from '../utils/swal'

const Customers = () => {
  const { formatCurrency } = useSettings()
  const [customers, setCustomers] = useState([])
  const [summary, setSummary] = useState({ total_billed: 0, paid_amount: 0, pending_balance: 0, total_payable: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  // Section Switcher State: 'pending' (Customers with pending balance) | 'all' (Full list)
  const [activeSection, setActiveSection] = useState('pending')

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formData, setFormData] = useState({ name: '', company_name: '', email: '', phone: '', address: '', payable_amount: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    fetchCustomers()
    fetchSummary()
  }, [page, searchQuery, activeSection])

  const fetchSummary = async () => {
    try {
      const res = await api.get('customers/summary/')
      setSummary(res.data || { total_billed: 0, paid_amount: 0, pending_balance: 0, total_payable: 0, total_count: 0, pending_count: 0 })
    } catch (err) {
      console.error('Failed to fetch customer summary:', err)
    }
  }

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const params = { page }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }
      if (activeSection === 'pending') {
        params.pending_only = 'true'
      }
      const response = await api.get('customers/', { params })
      const rawList = response.data.results || response.data || []
      const uniqueMap = new Map()
      rawList.forEach(c => { if (c && c.id && !uniqueMap.has(c.id)) uniqueMap.set(c.id, c) })
      setCustomers(Array.from(uniqueMap.values()))
      setTotalPages(Math.ceil((response.data.count || 0) / 25) || 1)
      setError('')
    } catch (err) {
      setError('Failed to fetch customers. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSectionSwitch = (section) => {
    setActiveSection(section)
    setPage(1)
  }

  const handleSearchChange = (val) => {
    setSearchQuery(val)
    setPage(1)
  }

  const handleOpenModal = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer)
      const rawPa = customer.remaining_payable ?? customer.payable_amount
      const pa = rawPa != null ? parseFloat(rawPa) : 0
      setFormData({ 
        name: customer.name, 
        company_name: customer.company_name || customer.company || '',
        email: customer.email || '', 
        phone: customer.phone || '', 
        address: customer.address || '',
        payable_amount: pa > 0 ? String(pa) : (rawPa != null && String(rawPa).trim() !== '' ? String(rawPa) : '')
      })
    } else {
      setEditingCustomer(null)
      setFormData({ name: '', company_name: '', email: '', phone: '', address: '', payable_amount: '' })
    }
    setFormError('')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name) return setFormError('Name is required')
    
    try {
      setSubmitting(true)
      setFormError('')

      const payload = {
        ...formData,
        payable_amount: formData.payable_amount !== '' ? parseFloat(formData.payable_amount) || 0 : 0
      }
      
      if (editingCustomer) {
        const response = await api.put(`customers/${editingCustomer.id}/`, payload)
        setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? response.data : c))
      } else {
        const response = await api.post('customers/', payload)
        setCustomers(prev => [response.data, ...prev.filter(c => c.id !== response.data.id)])
      }
      fetchSummary()
      
      setIsModalOpen(false)
      setFormData({ name: '', company_name: '', email: '', phone: '', address: '', payable_amount: '' })
      setEditingCustomer(null)
    } catch (err) {
      const errorData = err.response?.data
      let errorMessage = 'Operation failed. Please check your data.'
      
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
      title: 'Move Customer to Recycle Bin?',
      text: 'Are you sure you want to move this customer to the Recycle Bin? It can be restored at any time.',
      confirmButtonText: 'Move to Recycle Bin',
      isDangerous: true,
    })
    if (confirmed) {
      try {
        await api.delete(`customers/${id}/`)
        setCustomers(customers.filter(c => c.id !== id))
        fetchSummary()
        showToast('Customer moved to Recycle Bin', 'success')
      } catch (err) {
        showError('Action Failed', 'Failed to move customer to Recycle Bin.')
      }
    }
  }

  return (
    <div className="customers-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div className="page-header" style={{ marginBottom: '0.85rem' }}>
        <div>
          <h2 style={{ fontWeight: '700', letterSpacing: '-0.01em', fontSize: '1.35rem' }}>Customers</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>Manage client records, receivables, and ledger history</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ borderRadius: 'var(--radius-sm)' }}>
            <Plus size={16} /> New Customer
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="summary-cards-grid" style={{ marginBottom: '0.85rem' }}>
        <div className="glass-panel" style={{ textAlign: 'left', padding: '0.75rem 1rem', borderTop: '3px solid #1366d9' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Billed</p>
          <h2 style={{ color: 'var(--text-main)', fontWeight: '800', fontSize: '1.35rem', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(summary.total_billed)}</h2>
        </div>
        <div className="glass-panel" style={{ textAlign: 'left', padding: '0.75rem 1rem', borderTop: '3px solid #0f7638' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount Received</p>
          <h2 style={{ color: '#0f7638', fontWeight: '800', fontSize: '1.35rem', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(summary.paid_amount)}</h2>
        </div>
        <div className="glass-panel" style={{ textAlign: 'left', padding: '0.75rem 1rem', borderTop: `3px solid ${summary.pending_balance > 0 ? '#dc2626' : '#0f7638'}` }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receivables Due</p>
          <h2 style={{ color: summary.pending_balance > 0 ? '#dc2626' : '#0f7638', fontWeight: '800', fontSize: '1.35rem', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(summary.pending_balance)}</h2>
        </div>
        <div className="glass-panel" style={{ textAlign: 'left', padding: '0.75rem 1rem', borderTop: `3px solid ${(summary.total_payable || 0) > 0 ? '#2563eb' : '#94a3b8'}` }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payables Owed</p>
          <h2 style={{ color: (summary.total_payable || 0) > 0 ? '#2563eb' : 'var(--text-main)', fontWeight: '800', fontSize: '1.35rem', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(summary.total_payable || 0)}</h2>
        </div>
      </div>

      {/* Customer List Split Section Tabs: (a) Pending Balance Only | (b) Full Customer List */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        marginBottom: '0.85rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ 
          display: 'inline-flex', 
          gap: '0.4rem', 
          background: 'rgba(0,0,0,0.04)', 
          padding: '0.3rem', 
          borderRadius: '10px' 
        }}>
          <button
            type="button"
            className="btn"
            id="tab-pending-customers"
            onClick={() => handleSectionSwitch('pending')}
            style={{
              padding: '0.55rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: activeSection === 'pending' ? '700' : '600',
              borderRadius: '8px',
              border: 'none',
              background: activeSection === 'pending' ? '#ffffff' : 'transparent',
              color: activeSection === 'pending' ? 'var(--danger, #dc2626)' : 'var(--text-muted)',
              boxShadow: activeSection === 'pending' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: activeSection === 'pending' ? '#dc2626' : '#94a3b8',
              display: 'inline-block'
            }} />
            (a) Pending Balance Only
            <span style={{
              background: activeSection === 'pending' ? '#fee2e2' : 'rgba(0,0,0,0.06)',
              color: activeSection === 'pending' ? '#b91c1c' : 'inherit',
              padding: '0.15rem 0.55rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '800'
            }}>
              {summary.pending_count !== undefined ? summary.pending_count : 0}
            </span>
          </button>

          <button
            type="button"
            className="btn"
            id="tab-all-customers"
            onClick={() => handleSectionSwitch('all')}
            style={{
              padding: '0.55rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: activeSection === 'all' ? '700' : '600',
              borderRadius: '8px',
              border: 'none',
              background: activeSection === 'all' ? '#ffffff' : 'transparent',
              color: activeSection === 'all' ? 'var(--primary, #1366d9)' : 'var(--text-muted)',
              boxShadow: activeSection === 'all' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            (b) Full Customer List
            <span style={{
              background: activeSection === 'all' ? '#ebf3fc' : 'rgba(0,0,0,0.06)',
              color: activeSection === 'all' ? '#1366d9' : 'inherit',
              padding: '0.15rem 0.55rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '800'
            }}>
              {summary.total_count !== undefined ? summary.total_count : 0}
            </span>
          </button>
        </div>

        {activeSection === 'pending' && summary.pending_balance > 0 && (
          <div style={{
            fontSize: '0.8rem',
            color: '#b91c1c',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            padding: '0.45rem 0.9rem',
            borderRadius: '8px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <AlertCircle size={15} />
            Unsettled Receivables: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(summary.pending_balance)}</strong>
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <SearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          style={{ flex: 1, minWidth: '220px', maxWidth: '420px' }}
        />
        <button
          className="btn btn-secondary"
          onClick={() => { fetchCustomers(); fetchSummary(); }}
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
        {customers.length === 0 && !error && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {searchQuery 
              ? `No customers matching "${searchQuery}" in ${activeSection === 'pending' ? 'pending accounts' : 'customer directory'}` 
              : activeSection === 'pending'
                ? 'All customer accounts are fully settled! No pending payment balances.'
                : 'No customers found. Click "+ New Customer" to create one.'}
          </div>
        )}

        {customers.length > 0 && (
          <>
            {/* Desktop Table View */}
            <div className="desktop-only-table">
              <div className="table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Company Name</th>
                      <th>Email Address</th>
                      <th>Phone Number</th>
                      <th style={{ textAlign: 'right' }}>Total Billed</th>
                      <th style={{ textAlign: 'right' }}>Amount Paid</th>
                      <th style={{ textAlign: 'right' }}>Receivables Due</th>
                      <th style={{ textAlign: 'right' }}>Payables Owed</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map(customer => (
                      <tr key={customer.id} onClick={() => navigate(`/customers/${customer.id}`)} style={{ cursor: 'pointer' }} className="hover-row">
                        <td>
                          <div style={{ fontWeight: '700', color: 'var(--primary)' }}>{customer.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>CID-{customer.id.toString().padStart(5, '0')}</div>
                        </td>
                        <td style={{ fontWeight: '600', color: customer.company_name ? 'var(--text-main)' : 'var(--text-muted)' }}>
                          {customer.company_name || '---'}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontWeight: '500' }}>{customer.email || '---'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{customer.phone || '---'}</td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                          {formatCurrency(customer.total_billed || 0)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>
                          {formatCurrency(customer.paid_amount || 0)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: (customer.pending_balance || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          {formatCurrency(customer.pending_balance || 0)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: (parseFloat(customer.remaining_payable ?? customer.payable_amount) || 0) > 0 ? '#2563eb' : 'var(--text-muted)' }}>
                          {formatCurrency(parseFloat(customer.remaining_payable ?? customer.payable_amount) || 0)}
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button 
                              className="btn-icon" 
                              style={{ width: '32px', height: '32px' }}
                              onClick={() => handleOpenModal(customer)}
                              title="Edit Record"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className="btn-icon" 
                              style={{ width: '32px', height: '32px', color: 'var(--danger)' }}
                              onClick={() => handleDelete(customer.id)}
                              title="Decommission Record"
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
              {customers.map(customer => {
                const hasDue = (customer.pending_balance || 0) > 0
                const payableBal = parseFloat(customer.remaining_payable ?? customer.payable_amount) || 0
                const hasPayable = payableBal > 0
                const initials = customer.name
                  ? customer.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
                  : 'CU'

                return (
                  <div 
                    key={customer.id} 
                    className="mobile-entity-card"
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    <div className="mobile-card-header">
                      <div className="mobile-card-title-group">
                        <div className="mobile-card-avatar" style={{ background: '#ebf3fc', color: '#1366d9' }}>
                          {initials}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="mobile-card-title">{customer.name}</div>
                          {customer.company_name && (
                            <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: '600', marginTop: '1px' }}>
                              {customer.company_name}
                            </div>
                          )}
                          <div className="mobile-card-sub">
                            <span style={{ fontWeight: '600', color: '#64748b' }}>CID-{customer.id.toString().padStart(5, '0')}</span>
                            {customer.phone && <span>&bull; {customer.phone}</span>}
                            {hasPayable && (
                              <span style={{ 
                                marginLeft: '0.4rem', 
                                background: '#eff6ff', 
                                color: '#2563eb', 
                                padding: '1px 6px', 
                                borderRadius: '4px', 
                                fontSize: '0.65rem', 
                                fontWeight: '700' 
                              }}>
                                Payable Owed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={18} color="#94a3b8" />
                    </div>

                    <div className="mobile-card-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                      <div className="mobile-card-metric">
                        <span className="mobile-card-metric-label">Billed</span>
                        <span className="mobile-card-metric-value">{formatCurrency(customer.total_billed || 0)}</span>
                      </div>
                      <div className="mobile-card-metric">
                        <span className="mobile-card-metric-label">Received</span>
                        <span className="mobile-card-metric-value" style={{ color: '#16a34a' }}>{formatCurrency(customer.paid_amount || 0)}</span>
                      </div>
                      <div className="mobile-card-metric">
                        <span className="mobile-card-metric-label">Receivables Due</span>
                        <span className="mobile-card-metric-value" style={{ color: hasDue ? '#dc2626' : '#16a34a' }}>
                          {formatCurrency(customer.pending_balance || 0)}
                        </span>
                      </div>
                      <div className="mobile-card-metric">
                        <span className="mobile-card-metric-label">Payables Owed</span>
                        <span className="mobile-card-metric-value" style={{ color: hasPayable ? '#2563eb' : '#64748b' }}>
                          {formatCurrency(payableBal)}
                        </span>
                      </div>
                    </div>

                    <div className="mobile-card-footer" onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {customer.phone && (
                          <a 
                            href={`tel:${customer.phone}`} 
                            className="mobile-card-action-btn"
                            title="Call customer"
                          >
                            <Phone size={14} />
                          </a>
                        )}
                        {customer.email && (
                          <a 
                            href={`mailto:${customer.email}`} 
                            className="mobile-card-action-btn"
                            title="Email customer"
                          >
                            <Mail size={14} />
                          </a>
                        )}
                      </div>
                      <div className="mobile-card-actions">
                        <button 
                          className="mobile-card-action-btn" 
                          onClick={() => handleOpenModal(customer)}
                          title="Edit Customer"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          className="mobile-card-action-btn delete" 
                          onClick={() => handleDelete(customer.id)}
                          title="Delete Customer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
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
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
      >
        <form onSubmit={handleSubmit}>
          {formError && <div className="error-message">{formError}</div>}
          
          <div className="form-grid">
            <div className="form-group col-span-2">
              <label>Full Name / Primary Contact *</label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>

            <div className="form-group col-span-2">
              <label>Company Name</label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.company_name} 
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                className="input-field" 
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.phone} 
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>

            <div className="form-group col-span-2">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <label style={{ margin: 0, fontWeight: '600' }}>Payable Amount (SAR)</label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '500' }}>
                  {editingCustomer ? 'Amount company owes to customer' : 'Initial payable balance owed'}
                </span>
              </div>
              <input 
                type="number" 
                step="0.01"
                min="0"
                className="input-field" 
                value={formData.payable_amount} 
                onChange={(e) => setFormData({...formData, payable_amount: e.target.value})}
              />
            </div>

            <div className="form-group col-span-2">
              <label>Complete Address</label>
              <textarea 
                className="input-field" 
                style={{ minHeight: '100px' }} 
                value={formData.address} 
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              ></textarea>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem' }} onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }} disabled={submitting}>
              {submitting ? 'Saving...' : (editingCustomer ? 'Save Changes' : 'Create Customer')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Customers
