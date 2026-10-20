import React, { useState, useEffect } from 'react'
import { 
  Plus, Edit, Trash2, Shield, User, AlertCircle, CheckSquare, Square, RefreshCw,
  Users, Building2, Briefcase, Layers, FileSpreadsheet, CreditCard, ShieldCheck,
  Receipt, Landmark, BookOpen, Banknote, FileBarChart, Settings as SettingsIcon
} from '../components/icons'
import api from '../api'
import Modal from '../components/common/Modal'
import SearchBar from '../components/common/SearchBar'
import { showConfirm, showError, showToast } from '../utils/swal'

const ALL_MODULES = [
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'vendors', label: 'Vendors', icon: Building2 },
  { key: 'jobs', label: 'Job Orders', icon: Briefcase },
  { key: 'planning', label: 'Project Planning', icon: Layers },
  { key: 'estimations', label: 'Estimations', icon: FileSpreadsheet },
  { key: 'payments', label: 'Payments', icon: CreditCard },
  { key: 'payment-requests', label: 'Payment Requests', icon: ShieldCheck },
  { key: 'expenses', label: 'Expenses', icon: Receipt },
  { key: 'banks', label: 'Banks', icon: Landmark },
  { key: 'cashbook', label: 'Cashbook', icon: BookOpen },
  { key: 'salary', label: 'Salary & Payroll', icon: Banknote },
  { key: 'reports', label: 'Reports', icon: FileBarChart },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
]

const EMPTY_FORM = {
  username: '',
  password: '',
  first_name: '',
  last_name: '',
  email: '',
  role: 'User',
  access_list: [],
  is_active: true,
}

const UserManagement = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [searchQuery])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = {}
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }
      const res = await api.get('accounts/users/', { params })
      setUsers(res.data.results || res.data)
      setError('')
    } catch (err) {
      setError('Failed to load users.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (val) => {
    setSearchQuery(val)
  }

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        username: user.username,
        password: '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        role: user.role,
        access_list: user.access_list || [],
        is_active: user.is_active,
      })
    } else {
      setEditingUser(null)
      setFormData(EMPTY_FORM)
    }
    setFormError('')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.username) return setFormError('Username is required.')
    if (!editingUser && !formData.password) return setFormError('Password is required for new users.')

    setSubmitting(true)
    setFormError('')
    try {
      const payload = { ...formData }
      if (!payload.password) delete payload.password

      if (editingUser) {
        const res = await api.put(`accounts/users/${editingUser.id}/`, payload)
        setUsers(users.map(u => u.id === editingUser.id ? res.data : u))
      } else {
        const res = await api.post('accounts/users/', payload)
        setUsers([res.data, ...users])
      }
      setIsModalOpen(false)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        setFormError(Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | '))
      } else {
        setFormError('Operation failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete User?',
      text: 'Are you sure you want to delete this user? This action cannot be undone.',
      confirmButtonText: 'Yes, delete',
      isDangerous: true
    })
    if (!confirmed) return
    try {
      await api.delete(`accounts/users/${id}/`)
      setUsers(users.filter(u => u.id !== id))
      showToast('User deleted successfully')
    } catch {
      showError('Delete Failed', 'Failed to delete user.')
    }
  }

  const toggleModule = (key) => {
    setFormData(prev => ({
      ...prev,
      access_list: prev.access_list.includes(key)
        ? prev.access_list.filter(m => m !== key)
        : [...prev.access_list, key]
    }))
  }

  const toggleAllModules = () => {
    const allKeys = ALL_MODULES.map(m => m.key)
    const allSelected = allKeys.every(k => formData.access_list.includes(k))
    setFormData(prev => ({ ...prev, access_list: allSelected ? [] : allKeys }))
  }

  return (
    <div className="erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontWeight: '800', letterSpacing: '-0.025em' }}>User Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Create and manage system users and their module access</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} /> Add User
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <SearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          style={{ maxWidth: '450px' }}
        />
        <button
          className="btn btn-secondary"
          onClick={fetchUsers}
          title="Refresh table"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Users Table */}
      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading users...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {searchQuery ? `No users matching "${searchQuery}"` : 'No users found.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Username', 'Name', 'Role', 'Module Access', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: '600' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {user.role === 'Admin' ? <Shield size={14} color="var(--accent)" /> : <User size={14} color="var(--text-muted)" />}
                      {user.username}
                    </div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>{[user.first_name, user.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{
                      padding: '0.2rem 0.65rem',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      background: user.role === 'Admin' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)',
                      color: user.role === 'Admin' ? '#6366f1' : '#10b981',
                    }}>{user.role}</span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    {user.role === 'Admin' ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>All Modules</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {(user.access_list || []).length === 0 ? (
                          <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>No Access</span>
                        ) : (user.access_list || []).map(m => {
                          const mod = ALL_MODULES.find(x => x.key === m)
                          return (
                            <span key={m} style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: '600',
                              background: 'rgba(99,102,241,0.1)',
                              color: '#6366f1'
                            }}>{mod?.label || m}</span>
                          )
                        })}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{
                      padding: '0.2rem 0.65rem',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      background: user.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                      color: user.is_active ? '#10b981' : '#ef4444',
                    }}>{user.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" onClick={() => handleOpenModal(user)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                        <Edit size={14} />
                      </button>
                      <button className="btn" onClick={() => handleDelete(user.id)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No users found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit User Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? 'Edit User' : 'Add New User'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {formError && (
            <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} /> {formError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="form-label">Username *</label>
              <input className="input-field" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} disabled={!!editingUser} />
            </div>
            <div>
              <label className="form-label">{editingUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input className="input-field" type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
            </div>
            <div>
              <label className="form-label">First Name</label>
              <input className="input-field" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Last Name</label>
              <input className="input-field" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input className="input-field" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Role</label>
              <select className="input-field" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                <option value="Admin">Admin (Full Access)</option>
                <option value="User">User (Restricted)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} style={{ marginRight: '0.5rem' }} />
              Active User
            </label>
          </div>

          {/* Module Access (only for User role) */}
          {formData.role === 'User' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Module Access</label>
                <button type="button" onClick={toggleAllModules} style={{ fontSize: '0.8rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                  {ALL_MODULES.every(m => formData.access_list.includes(m.key)) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.55rem' }}>
                {ALL_MODULES.map(mod => {
                  const checked = formData.access_list.includes(mod.key)
                  const Icon = mod.icon
                  return (
                    <label 
                      key={mod.key} 
                      onClick={() => toggleModule(mod.key)} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: `1px solid ${checked ? 'var(--accent, #6366f1)' : 'var(--border, #e2e8f0)'}`,
                        background: checked ? 'rgba(99,102,241,0.08)' : 'transparent',
                        transition: 'all 0.15s ease',
                        userSelect: 'none',
                      }}
                    >
                      {checked
                        ? <CheckSquare size={16} color="var(--accent, #6366f1)" />
                        : <Square size={16} color="var(--text-muted, #94a3b8)" />}
                      {Icon && <Icon size={14} style={{ color: checked ? 'var(--accent, #6366f1)' : 'var(--text-muted, #64748b)', flexShrink: 0 }} />}
                      <span style={{ fontSize: '0.82rem', fontWeight: checked ? '600' : '500', color: checked ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #475569)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {mod.label}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : (editingUser ? 'Update User' : 'Create User')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default UserManagement
