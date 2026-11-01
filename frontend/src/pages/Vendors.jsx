import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit3, Trash2, AlertCircle, Building2 } from 'lucide-react'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import PageHeaderButton from '../components/common/PageHeaderButton'
import CredSearchInput from '../components/cashbook/cred/CredSearchInput'
import CredPagination from '../components/cashbook/cred/CredPagination'
import {
  ModalShell,
  Field,
  TextInput,
  NumberInput,
  Textarea
} from '../components/common/FormPrimitives'
import { showConfirm, showError, showToast } from '../utils/swal'

const Vendors = () => {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()
  const basePath = '/accounting'

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

  // Listen to top-strip refresh event
  useEffect(() => {
    const handleAppRefresh = () => {
      fetchVendors()
    }
    window.addEventListener('app:refresh', handleAppRefresh)
    return () => window.removeEventListener('app:refresh', handleAppRefresh)
  }, [page, searchQuery])

  const fetchVendors = async () => {
    try {
      setLoading(true)
      const params = { page }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }
      const response = await api.get('vendors/', { params })
      const results = response.data.results || response.data || []
      setVendors(results)
      const count = response.data.count || results.length
      setTotalCount(count)
      setTotalPages(Math.ceil(count / 25) || 1)
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
      } catch {
        showError('Action Failed', 'Failed to move vendor to Recycle Bin.')
      }
    }
  }

  return (
    <div className="vendors-page erp-page-container erp-page-transition" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', paddingBottom: '3rem' }}>
      
      {/* ── 1. PAGE HEADER (Enquiries CRED Style) ── */}
      <div className="page-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontWeight: 600, letterSpacing: '-0.02em', fontSize: '24px', margin: 0, color: 'var(--text, #0A0A0A)' }}>
            Vendors
          </h2>
          <p style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '13px', margin: '4px 0 0' }}>
            Manage supplier profiles, procurement contracts, and billing terms
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <PageHeaderButton onClick={() => handleOpenModal()}>
            New Vendor
          </PageHeaderButton>
        </div>
      </div>

      {/* ── 2. BORDERLESS FILLED SEARCH BAR (Full width, no outer card, no double border) ── */}
      <div style={{ width: '100%', marginBottom: '1.25rem' }}>
        <CredSearchInput
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onClear={() => handleSearchChange('')}
          placeholder="Search vendors…"
          style={{ width: '100%', height: '38px' }}
        />
      </div>

      {error && (
        <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* ── 3. TABLE ── */}
      <div style={{ width: '100%', position: 'relative', marginBottom: '2.5rem' }}>
        {loading ? (
          <div style={{ padding: '1.5rem 0' }}>
            <SkeletonLoader type="table" />
          </div>
        ) : (
          <>
            {vendors.length === 0 && !error && (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                <Building2 size={22} strokeWidth={1.6} style={{ color: 'var(--text-muted, #8C8C8C)', opacity: 0.6, marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>
                  {searchQuery ? `No vendors matching "${searchQuery}".` : 'No vendors recorded yet.'}
                </p>
              </div>
            )}

            {vendors.length > 0 && (
              <>
                {/* Desktop Table View */}
                <div className="desktop-only-table" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)' }}>
                        <th style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Vendor Name</th>
                        <th style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Company Name</th>
                        <th style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Email Address</th>
                        <th style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Phone Number</th>
                        <th style={{ width: '80px', minWidth: '80px', padding: '10px 16px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendors.map((vendor) => (
                        <tr
                          key={vendor.id}
                          className="cred-table-row"
                          onClick={() => navigate(`${basePath}/vendors/${vendor.id}`)}
                          style={{
                            borderBottom: '1px solid var(--border, #E4E4E4)',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          {/* Vendor Name + VID */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', overflow: 'hidden' }}>
                            <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {vendor.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                              VID-{vendor.id.toString().padStart(5, '0')}
                            </div>
                          </td>

                          {/* Company Name */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '13px', color: vendor.company ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {vendor.company || '—'}
                          </td>

                          {/* Email Address */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '13px', color: vendor.email ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {vendor.email || '—'}
                          </td>

                          {/* Phone Number */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '13px', color: vendor.phone ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {vendor.phone || '—'}
                          </td>

                          {/* Actions */}
                          <td style={{ width: '80px', minWidth: '80px', padding: '12px 16px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                              <button
                                type="button"
                                className="cred-action-icon-btn"
                                onClick={() => handleOpenModal(vendor)}
                                title="Edit"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: '4px',
                                  color: 'var(--text-muted, #8C8C8C)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '4px',
                                  transition: 'color 0.15s ease'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text, #111111)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)')}
                              >
                                <Edit3 size={15} strokeWidth={1.8} />
                              </button>
                              <button
                                type="button"
                                className="cred-action-icon-btn delete"
                                onClick={() => handleDelete(vendor.id)}
                                title="Delete"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: '4px',
                                  color: 'var(--text-muted, #8C8C8C)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '4px',
                                  transition: 'color 0.15s ease'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger, #DC2626)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)')}
                              >
                                <Trash2 size={15} strokeWidth={1.8} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <CredPagination
                    page={page}
                    totalPages={totalPages}
                    total={totalCount}
                    rangeStart={(page - 1) * 25 + 1}
                    rangeEnd={Math.min(page * 25, totalCount)}
                    onPageChange={(p) => setPage(p)}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── 4. ADD / EDIT VENDOR MODAL (Enquiries ModalShell Style) ── */}
      <ModalShell
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVendor ? 'Edit Vendor' : 'New Vendor'}
        maxWidth="540px"
        formId="vendor-modal-form"
        submitLabel={editingVendor ? 'Save Changes' : 'Create Vendor'}
        submittingLabel="Saving..."
        submitting={submitting}
        closeOnBackdrop={false}
      >
        <form id="vendor-modal-form" onSubmit={handleSubmit}>
          {formError && (
            <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <AlertCircle size={18} /> {formError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
            <Field label="Vendor Name" required>
              <TextInput
                required
                autoFocus
                placeholder="e.g. Al-Futtaim Engineering"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Field>

            <Field label="Company / Organization">
              <TextInput
                placeholder="e.g. Al-Futtaim Group"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field label="Email Address">
                <TextInput
                  type="email"
                  placeholder="e.g. vendor@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </Field>
              <Field label="Phone Number">
                <TextInput
                  type="tel"
                  placeholder="e.g. +966 50 123 4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </Field>
            </div>

            <Field
              label="Due Amount / Opening Balance (SAR)"
              rightAction={
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>
                  Initial outstanding payable balance owed
                </span>
              }
            >
              <NumberInput
                step="0.01"
                min="0"
                prefix="SAR"
                placeholder="0.00"
                value={formData.opening_balance}
                onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
              />
            </Field>

            <Field label="Physical Address">
              <Textarea
                rows={3}
                placeholder="Enter street, district, building, city..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </Field>
          </div>
        </form>
      </ModalShell>
    </div>
  )
}

export default Vendors
