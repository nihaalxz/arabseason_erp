import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, AlertCircle, Edit, Trash2, MoreVertical, Phone, Mail, ChevronRight, Building2 } from '../components/icons'
import api from '../api'
import Modal from '../components/common/Modal'
import SkeletonLoader from '../components/common/SkeletonLoader'
import SearchBar from '../components/common/SearchBar'
import { showConfirm, showError, showToast } from '../utils/swal'

const Vendors = () => {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  // Modal and Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    opening_balance: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    fetchVendors()
  }, [page, searchQuery])

  const fetchVendors = async () => {
    try {
      setLoading(true)
      const params = { page }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }
      const response = await api.get('vendors/', { params })
      setVendors(response.data.results || [])
      setTotalPages(Math.ceil((response.data.count || 0) / 25) || 1)
      setError('')
    } catch (err) {
      setError('Failed to fetch vendors. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (val) => {
    setSearchQuery(val)
    setPage(1)
  }

  const handleOpenModal = (vendor = null) => {
    if (vendor) {
      setEditingVendor(vendor)
      const ob = vendor.opening_balance != null ? parseFloat(vendor.opening_balance) : 0
      setFormData({
        name: vendor.name,
        company: vendor.company || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        address: vendor.address || '',
        opening_balance: ob > 0 ? String(ob) : (vendor.opening_balance != null && String(vendor.opening_balance).trim() !== '' && String(vendor.opening_balance).trim() !== '0.00' ? String(vendor.opening_balance) : '')
      })
    } else {
      setEditingVendor(null)
      setFormData({
        name: '',
        company: '',
        email: '',
        phone: '',
        address: '',
        opening_balance: ''
      })
    }
    setFormError('')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name) {
      return setFormError('Vendor name is required')
    }
    
    try {
      setSubmitting(true)
      setFormError('')
      
      const payload = {
        ...formData,
        opening_balance: parseFloat(formData.opening_balance) || 0
      }

      if (editingVendor) {
        const response = await api.put(`vendors/${editingVendor.id}/`, payload)
        setVendors(vendors.map(v => v.id === editingVendor.id ? response.data : v))
      } else {
        const response = await api.post('vendors/', payload)
        setVendors([response.data, ...vendors])
      }
      
      setIsModalOpen(false)
      setEditingVendor(null)
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
      title: 'Move Vendor to Recycle Bin?',
      text: 'Are you sure you want to move this vendor to the Recycle Bin? It can be restored at any time.',
      confirmButtonText: 'Move to Recycle Bin',
      isDangerous: true,
    })
    if (confirmed) {
      try {
        await api.delete(`vendors/${id}/`)
        setVendors(vendors.filter(v => v.id !== id))
        showToast('Vendor moved to Recycle Bin', 'success')
      } catch (err) {
        showError('Action Failed', 'Failed to move vendor to Recycle Bin.')
      }
    }
  }

  return (
    <div className="vendors-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontWeight: '700', letterSpacing: '-0.01em', fontSize: '1.35rem' }}>Vendors</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>Manage supplier profiles, procurement contracts, and billing terms</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ borderRadius: 'var(--radius-sm)' }}>
            <Plus size={16} /> New Vendor
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <SearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          style={{ flex: 1, minWidth: '220px', maxWidth: '420px' }}
        />
        <button
          className="btn btn-secondary"
          onClick={fetchVendors}
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
        {vendors.length === 0 && !error && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {searchQuery ? `No vendors matching "${searchQuery}"` : 'No vendors found. Click "+ New Vendor" to create one.'}
          </div>
        )}

        {vendors.length > 0 && (
          <>
            {/* Desktop Table View */}
            <div className="desktop-only-table">
              <div className="table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Vendor Name</th>
                      <th>Company Name</th>
                      <th>Email Address</th>
                      <th>Phone Number</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map(vendor => (
                      <tr key={vendor.id} onClick={() => navigate(`/vendors/${vendor.id}`)} style={{ cursor: 'pointer' }} className="hover-row">
                        <td>
                          <div style={{ fontWeight: '700', color: 'var(--primary)' }}>{vendor.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>VID-{vendor.id.toString().padStart(5, '0')}</div>
                        </td>
                        <td style={{ fontWeight: '600', color: 'var(--text-muted)' }}>{vendor.company || '---'}</td>
                        <td style={{ color: 'var(--text-muted)', fontWeight: '500' }}>{vendor.email || '---'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{vendor.phone || '---'}</td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button 
                              className="btn-icon" 
                              style={{ width: '32px', height: '32px' }}
                              onClick={() => handleOpenModal(vendor)}
                              title="Modify Record"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className="btn-icon" 
                              style={{ width: '32px', height: '32px', color: 'var(--danger)' }}
                              onClick={() => handleDelete(vendor.id)}
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
              {vendors.map(vendor => {
                const initials = vendor.name
                  ? vendor.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
                  : 'VN'

                return (
                  <div 
                    key={vendor.id} 
                    className="mobile-entity-card"
                    onClick={() => navigate(`/vendors/${vendor.id}`)}
                  >
                    <div className="mobile-card-header">
                      <div className="mobile-card-title-group">
                        <div className="mobile-card-avatar" style={{ background: '#fef3c7', color: '#b45309' }}>
                          {initials}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="mobile-card-title">{vendor.name}</div>
                          <div className="mobile-card-sub">
                            <span style={{ fontWeight: '600', color: '#64748b' }}>VID-{vendor.id.toString().padStart(5, '0')}</span>
                            {vendor.company && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                &bull; <Building2 size={11} /> {vendor.company}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={18} color="#94a3b8" />
                    </div>

                    <div className="mobile-card-grid mobile-card-grid-2">
                      <div className="mobile-card-metric">
                        <span className="mobile-card-metric-label">Phone</span>
                        <span className="mobile-card-metric-value" style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                          {vendor.phone || 'No phone'}
                        </span>
                      </div>
                      <div className="mobile-card-metric">
                        <span className="mobile-card-metric-label">Email</span>
                        <span className="mobile-card-metric-value" style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b' }}>
                          {vendor.email || 'No email'}
                        </span>
                      </div>
                    </div>

                    <div className="mobile-card-footer" onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {vendor.phone && (
                          <a 
                            href={`tel:${vendor.phone}`} 
                            className="mobile-card-action-btn"
                            title="Call vendor"
                          >
                            <Phone size={14} />
                          </a>
                        )}
                        {vendor.email && (
                          <a 
                            href={`mailto:${vendor.email}`} 
                            className="mobile-card-action-btn"
                            title="Email vendor"
                          >
                            <Mail size={14} />
                          </a>
                        )}
                      </div>
                      <div className="mobile-card-actions">
                        <button 
                          className="mobile-card-action-btn" 
                          onClick={() => handleOpenModal(vendor)}
                          title="Modify Record"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          className="mobile-card-action-btn delete" 
                          onClick={() => handleDelete(vendor.id)}
                          title="Decommission Record"
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
        title={editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
      >
        <form onSubmit={handleSubmit}>
          {formError && <div className="error-message">{formError}</div>}
          
          <div className="form-grid">
            <div className="form-group col-span-2">
              <label>Vendor Name *</label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group col-span-2">
              <label>Company / Organization</label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.company} 
                onChange={(e) => setFormData({...formData, company: e.target.value})}
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
              <label>Due Amount / Opening Balance (SAR)</label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                className="input-field" 
                value={formData.opening_balance} 
                onChange={(e) => setFormData({...formData, opening_balance: e.target.value})}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                Initial outstanding payable balance owed to this vendor before disbursements.
              </small>
            </div>

            <div className="form-group col-span-2">
              <label>Physical Address</label>
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
              {submitting ? 'Processing...' : (editingVendor ? 'Save Changes' : 'Create Vendor')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Vendors
