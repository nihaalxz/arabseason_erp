import React, { useState, useEffect } from 'react'
import {
  Plus, Edit, Trash2, AlertCircle, Check, Users
} from 'lucide-react'
import api from '../api'
import Modal from '../components/common/Modal'
import CredSearchInput from '../components/cashbook/cred/CredSearchInput'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { showConfirm, showError, showToast } from '../utils/swal'

const ALL_MODULES = [
  { key: 'customers', label: 'Customers' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'jobs', label: 'Job Orders' },
  { key: 'planning', label: 'Project Planning' },
  { key: 'estimations', label: 'Estimations' },
  { key: 'payments', label: 'Payments' },
  { key: 'payment-requests', label: 'Payment Requests' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'banks', label: 'Banks' },
  { key: 'cashbook', label: 'Cashbook' },
  { key: 'salary', label: 'Salary & Payroll' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' },
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

// Neutral custom checkbox component for modal (no blue, ink fill)
const NeutralCheckbox = ({ checked, onChange, disabled = false }) => (
  <div
    role="checkbox"
    aria-checked={checked}
    tabIndex={disabled ? -1 : 0}
    onClick={(e) => {
      e.stopPropagation()
      if (!disabled && onChange) onChange(!checked)
    }}
    onKeyDown={(e) => {
      if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        if (onChange) onChange(!checked)
      }
    }}
    style={{
      width: '16px',
      height: '16px',
      borderRadius: '4px',
      border: checked ? '1px solid var(--black, #0A0A0A)' : '1px solid var(--border, #D4D4D4)',
      backgroundColor: checked ? 'var(--black, #0A0A0A)' : 'var(--card-bg, #FFFFFF)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      flexShrink: 0,
      transition: 'all 0.12s ease',
      outline: 'none',
      boxSizing: 'border-box'
    }}
  >
    {checked && <Check size={11} strokeWidth={3} color="#FFFFFF" />}
  </div>
)

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

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = {}
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }
      const res = await api.get('accounts/users/', { params })
      setUsers(res.data.results || res.data || [])
      setError('')
    } catch (err) {
      setError('Failed to load users.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [searchQuery])

  // Hook universal top bar refresh event
  useEffect(() => {
    const handleAppRefresh = () => fetchUsers()
    window.addEventListener('app:refresh', handleAppRefresh)
    return () => window.removeEventListener('app:refresh', handleAppRefresh)
  }, [])

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
    if (e && e.preventDefault) e.preventDefault()
    if (!formData.username.trim()) return setFormError('Username is required.')
    if (!editingUser && !formData.password) return setFormError('Password is required for new users.')

    setSubmitting(true)
    setFormError('')
    try {
      const payload = { ...formData, username: formData.username.trim() }
      if (!payload.password) delete payload.password

      if (editingUser) {
        const res = await api.put(`accounts/users/${editingUser.id}/`, payload)
        setUsers(users.map(u => u.id === editingUser.id ? res.data : u))
        showToast('User updated successfully', 'success')
      } else {
        const res = await api.post('accounts/users/', payload)
        setUsers([res.data, ...users])
        showToast('User created successfully', 'success')
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
      showToast('User deleted successfully', 'success')
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

  // Render Module Access Helper
  const renderModuleAccess = (user) => {
    if (user.role === 'Admin') {
      return (
        <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '13px' }}>
          All modules
        </span>
      )
    }

    const list = user.access_list || []
    if (list.length === 0) {
      return (
        <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '13px' }}>
          No access
        </span>
      )
    }

    const labels = list.map(k => {
      const m = ALL_MODULES.find(x => x.key === k)
      return m ? m.label : k
    })
    const fullTooltip = labels.join(', ')

    if (labels.length <= 2) {
      return (
        <span style={{ color: 'var(--text, #111111)', fontSize: '13px' }} title={fullTooltip}>
          {labels.join(', ')}
        </span>
      )
    }

    const firstTwo = labels.slice(0, 2).join(', ')
    const remainingCount = labels.length - 2
    return (
      <span style={{ color: 'var(--text, #111111)', fontSize: '13px' }} title={fullTooltip}>
        {firstTwo}{' '}
        <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '12px' }}>+{remainingCount}</span>
      </span>
    )
  }

  // Render Status Helper (small dot + 8px gap)
  const renderStatus = (isActive) => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '12.5px',
      fontWeight: 400,
      color: 'var(--text, #111111)'
    }}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: isActive ? '#10B981' : '#8C8C8C',
        flexShrink: 0
      }} />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )

  // Modal Pinned Footer
  const modalFooter = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
      <button
        type="button"
        onClick={() => setIsModalOpen(false)}
        style={{
          height: '36px',
          padding: '0 16px',
          backgroundColor: 'transparent',
          border: '1px solid var(--border, #E4E4E4)',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text, #111111)',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        Cancel
      </button>

      <button
        type="submit"
        form="user-management-modal-form"
        disabled={submitting}
        style={{
          height: '36px',
          padding: '0 22px',
          backgroundColor: 'var(--black, #0A0A0A)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '9999px',
          fontSize: '13px',
          fontWeight: 500,
          cursor: submitting ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'opacity 0.15s ease'
        }}
        onMouseEnter={(e) => {
          if (!submitting) e.currentTarget.style.opacity = '0.9'
        }}
        onMouseLeave={(e) => {
          if (!submitting) e.currentTarget.style.opacity = '1'
        }}
      >
        {submitting ? 'Saving...' : (editingUser ? 'Save Changes' : 'Create User')}
      </button>
    </div>
  )

  return (
    <div className="erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      
      {/* 1. Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '20px',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--text, #111111)'
        }}>
          User Management
        </h1>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          style={{
            height: '38px',
            padding: '0 20px',
            backgroundColor: 'var(--black, #0A0A0A)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'opacity 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          <Plus size={15} />
          <span>Add User</span>
        </button>
      </div>

      {/* 2. Full-Width Search Input (Single border, no card wrapper) */}
      <div style={{ width: '100%', marginBottom: '1.25rem' }}>
        <CredSearchInput
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search users by name, username, email or role..."
          style={{ width: '100%', height: '38px' }}
        />
      </div>

      {error && (
        <div style={{
          padding: '10px 14px',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '6px',
          color: '#DC2626',
          fontSize: '13px',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Plain Users Table (No outer card border, fixed layout) */}
      <div style={{ width: '100%', overflowX: 'auto', marginBottom: '2.5rem' }}>
        {loading ? (
          <div style={{ padding: '1.5rem 0' }}>
            <SkeletonLoader type="table" />
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
            <Users size={22} strokeWidth={1.6} style={{ color: 'var(--text-muted, #8C8C8C)', opacity: 0.6, marginBottom: '8px' }} />
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>
              No users found.
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '110px' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)' }}>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Username</th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Name</th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Role</th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Module Access</th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ width: '110px', minWidth: '110px', padding: '10px 8px 10px 16px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || '-'

                return (
                  <tr
                    key={user.id}
                    className="cred-table-row"
                    onClick={() => handleOpenModal(user)}
                    style={{
                      borderBottom: '1px solid var(--border, #E4E4E4)',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    {/* Username (Plain text, weight 500) */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text, #111111)' }}>
                        {user.username}
                      </span>
                    </td>

                    {/* Name (Plain text, "-" if empty) */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--text, #111111)' }}>
                      {fullName}
                    </td>

                    {/* Role (Plain text, normal case) */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--text, #111111)' }}>
                      {user.role}
                    </td>

                    {/* Module Access (Plain muted text) */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {renderModuleAccess(user)}
                    </td>

                    {/* Status (Dot + 8px gap) */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      {renderStatus(user.is_active)}
                    </td>

                    {/* Actions (Edit, Delete plain icon-only buttons) */}
                    <td
                      style={{
                        width: '110px',
                        minWidth: '110px',
                        textAlign: 'right',
                        padding: '10px 8px 10px 16px',
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'inline-flex', gap: '12px', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                        <button
                          type="button"
                          className="cred-icon-action-btn"
                          onClick={() => handleOpenModal(user)}
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
                          onClick={() => handleDelete(user.id)}
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
        )}
      </div>

      {/* 4. Add / Edit User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'Edit User' : 'Add New User'}
        footer={modalFooter}
        maxWidth="640px"
      >
        <form id="user-management-modal-form" onSubmit={handleSubmit} style={{ padding: '4px 0' }}>
          {formError && (
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '6px',
              color: '#DC2626',
              fontSize: '12.5px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{formError}</span>
            </div>
          )}

          {/* Form Fields Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginBottom: '18px' }}>
            {/* Username */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px' }}>
                <span>Username</span>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#EF4444', display: 'inline-block' }} />
              </label>
              <input
                className="user-modal-input"
                type="text"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                disabled={!!editingUser}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #E4E4E4)',
                  backgroundColor: editingUser ? 'var(--bg-band, #F2F2F2)' : 'var(--card-bg, #FFFFFF)',
                  color: editingUser ? 'var(--text-muted, #8C8C8C)' : 'var(--text, #111111)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  cursor: editingUser ? 'not-allowed' : 'text'
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px' }}>
                <span>{editingUser ? 'New Password' : 'Password'}</span>
                {!editingUser ? (
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#EF4444', display: 'inline-block' }} />
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', fontWeight: 400 }}>(leave blank to keep)</span>
                )}
              </label>
              <input
                className="user-modal-input"
                type="password"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #E4E4E4)',
                  backgroundColor: 'var(--card-bg, #FFFFFF)',
                  color: 'var(--text, #111111)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* First Name */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px' }}>
                First Name
              </label>
              <input
                className="user-modal-input"
                type="text"
                value={formData.first_name}
                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #E4E4E4)',
                  backgroundColor: 'var(--card-bg, #FFFFFF)',
                  color: 'var(--text, #111111)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Last Name */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px' }}>
                Last Name
              </label>
              <input
                className="user-modal-input"
                type="text"
                value={formData.last_name}
                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #E4E4E4)',
                  backgroundColor: 'var(--card-bg, #FFFFFF)',
                  color: 'var(--text, #111111)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px' }}>
                Email
              </label>
              <input
                className="user-modal-input"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #E4E4E4)',
                  backgroundColor: 'var(--card-bg, #FFFFFF)',
                  color: 'var(--text, #111111)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Role */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px' }}>
                Role
              </label>
              <select
                className="user-modal-select"
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #E4E4E4)',
                  backgroundColor: 'var(--card-bg, #FFFFFF)',
                  color: 'var(--text, #111111)',
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                <option value="Admin">Admin (Full Access)</option>
                <option value="User">User (Restricted)</option>
              </select>
            </div>
          </div>

          {/* Active User Toggle */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                userSelect: 'none'
              }}
              onClick={() => setFormData(p => ({ ...p, is_active: !p.is_active }))}
            >
              <NeutralCheckbox
                checked={formData.is_active}
                onChange={(val) => setFormData(p => ({ ...p, is_active: val }))}
              />
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text, #111111)' }}>
                Active User
              </span>
            </label>
          </div>

          {/* Module Access (3-column checkbox list) */}
          <div style={{
            borderTop: '1px solid var(--border, #E4E4E4)',
            paddingTop: '16px',
            opacity: formData.role === 'Admin' ? 0.45 : 1,
            pointerEvents: formData.role === 'Admin' ? 'none' : 'auto',
            transition: 'opacity 0.15s ease'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text, #111111)' }}>
                  Module Access
                </span>
                {formData.role === 'Admin' && (
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #8C8C8C)', fontWeight: 400 }}>
                    (Admins have full access automatically)
                  </span>
                )}
              </div>

              {formData.role !== 'Admin' && (
                <button
                  type="button"
                  onClick={toggleAllModules}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text, #0A0A0A)',
                    cursor: 'pointer',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                  {ALL_MODULES.every(m => formData.access_list.includes(m.key)) ? 'Clear all' : 'Select All'}
                </button>
              )}
            </div>

            {/* 3-Column List */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '4px 8px'
            }}>
              {ALL_MODULES.map(mod => {
                const checked = formData.role === 'Admin' || formData.access_list.includes(mod.key)
                return (
                  <div
                    key={mod.key}
                    onClick={() => toggleModule(mod.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      cursor: formData.role === 'Admin' ? 'default' : 'pointer',
                      transition: 'background-color 0.1s ease',
                      userSelect: 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (formData.role !== 'Admin') {
                        e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <NeutralCheckbox
                      checked={checked}
                      onChange={() => toggleModule(mod.key)}
                      disabled={formData.role === 'Admin'}
                    />
                    <span style={{
                      fontSize: '12.5px',
                      color: 'var(--text, #111111)',
                      fontWeight: 400,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {mod.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </form>
      </Modal>

      {/* Scoped Neutral Styles for User Management */}
      <style>{`
        .user-modal-input:focus,
        .user-modal-select:focus {
          border-color: var(--text, #0A0A0A) !important;
          outline: none !important;
          box-shadow: none !important;
        }
        .cred-table-row:hover {
          background-color: var(--fill-ghost-hover, #F7F7F7) !important;
        }
      `}</style>
    </div>
  )
}

export default UserManagement
