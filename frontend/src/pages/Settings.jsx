import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { Check, RotateCcw } from '../components/icons'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { showConfirm } from '../utils/swal'
import FormFieldsManager from '../components/settings/FormFieldsManager'
import ManageBanksPettyCash from '../components/settings/ManageBanksPettyCash'
import { CredAnimatedTabs } from '../components/cashbook/cred/CredAnimatedTabs'

const PRESET_TABS = [
  { id: 'minimalist', label: 'Minimalist' },
  { id: 'standard', label: 'Standard' },
  { id: 'enterprise', label: 'Full' },
  { id: 'custom', label: 'Custom' }
]

const PRESET_DESCRIPTIONS = {
  minimalist: 'Core daily operations only.',
  standard: 'Balanced for regular business.',
  enterprise: 'All features enabled.',
  custom: 'Choose exactly what is visible.'
}

const MODULE_SHORT_NAMES = {
  customers: 'Customers',
  vendors: 'Vendors',
  estimations: 'Estimations',
  quotations: 'Quotations',
  jobs: 'Job Orders',
  planning: 'Project Planning',
  delivery_notes: 'Delivery Notes',
  invoices: 'Invoices',
  credit_notes: 'Credit Notes',
  payments: 'Payments & Receipts',
  expenses: 'Expenses',
  payment_requests: 'Payment Requests',
  banks: 'Bank Accounts',
  cashbook: 'Cashbook',
  reports: 'Reports',
  salary: 'Salary & Payroll',
  minimalist_dashboard: 'Minimal Dashboard'
}

// Small neutral toggle (about 36x20)
// off = neutral grey track, on = ink-colored track with white knob. No blue, no glow.
const NeutralToggle = ({ checked, onChange, disabled = false }) => (
  <div
    role="switch"
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
      width: '36px',
      height: '20px',
      borderRadius: '999px',
      backgroundColor: checked ? 'var(--text, #0A0A0A)' : 'var(--border-strong, #D4D4D4)',
      position: 'relative',
      cursor: disabled ? 'not-allowed' : 'pointer',
      flexShrink: 0,
      transition: 'background-color 0.18s ease',
      outline: 'none',
      userSelect: 'none'
    }}
  >
    <div
      style={{
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        backgroundColor: checked ? 'var(--bg, #FFFFFF)' : '#FFFFFF',
        position: 'absolute',
        top: '3px',
        left: checked ? '19px' : '3px',
        transition: 'left 0.18s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
      }}
    />
  </div>
)

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'workspace')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSavedToast, setShowSavedToast] = useState(false)
  const savedTimerRef = useRef(null)

  const { refreshSettings } = useSettings()
  const {
    workspaceMode,
    features,
    setWorkspaceMode,
    toggleFeature,
    resetToDefault,
    featureDefinitions
  } = useWorkspace()

  // Form States
  const [formData, setFormData] = useState({
    company_name: '',
    email: '',
    phone: '',
    address: '',
    currency: 'AED',
    timezone: 'GST',
    date_format: 'DD/MM/YYYY'
  })

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  const [profileData, setProfileData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: ''
  })

  const tabs = [
    { id: 'workspace', name: 'Workspace' },
    { id: 'form-fields', name: 'Form Fields' },
    { id: 'profile', name: 'My Profile' },
    { id: 'manage-banks-cash', name: 'Manage Banks and Petty Cash' },
    { id: 'security', name: 'Security' },
    { id: 'localization', name: 'Localization' },
    { id: 'system', name: 'System Info' },
  ]

  const triggerSavedToast = () => {
    setShowSavedToast(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => {
      setShowSavedToast(false)
    }, 2000)
  }

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setSearchParams({ tab: tabId })
  }

  useEffect(() => {
    let isMounted = true
    const loadAll = async () => {
      setLoading(true)
      try {
        const [settingsRes, profileRes] = await Promise.allSettled([
          api.get('settings/'),
          api.get('accounts/profile/')
        ])
        if (!isMounted) return
        if (settingsRes.status === 'fulfilled' && settingsRes.value?.data) {
          setFormData(settingsRes.value.data)
        }
        if (profileRes.status === 'fulfilled' && profileRes.value?.data) {
          setProfileData(profileRes.value.data)
        }
        setError('')
      } catch (err) {
        console.error('Failed to load settings data', err)
        if (isMounted) setError('Could not load settings. Please try again.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadAll()
    return () => {
      isMounted = false
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')

      if (activeTab === 'profile') {
        const response = await api.post('accounts/profile/', profileData)
        setProfileData(response.data)
      } else {
        const response = await api.post('settings/', formData)
        setFormData(response.data)
        refreshSettings()
      }

      triggerSavedToast()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passwordData.new_password !== passwordData.confirm_password) {
      return setError('New passwords do not match')
    }

    if (passwordData.new_password.length < 8) {
      return setError('New password must be at least 8 characters long')
    }

    try {
      setSaving(true)
      setError('')
      await api.post('change-password/', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      })
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' })
      triggerSavedToast()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update password.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    const confirmed = await showConfirm({
      title: 'Sign Out?',
      text: 'Are you sure you want to log out of Arab Season ERP?',
      confirmButtonText: 'Yes, Sign Out',
      isDangerous: true,
      icon: 'question',
    })
    if (confirmed) {
      try {
        await api.post('accounts/logout/')
        window.location.href = '/login'
      } catch (err) {
        console.error('Logout failed', err)
        window.localStorage.clear()
        window.location.href = '/login'
      }
    }
  }

  const handleSetPreset = (presetId) => {
    setWorkspaceMode(presetId)
    triggerSavedToast()
  }

  const handleToggle = (key) => {
    toggleFeature(key)
    triggerSavedToast()
  }

  const handleReset = () => {
    resetToDefault()
    triggerSavedToast()
  }

  if (loading) {
    return (
      <div style={{ padding: '3rem', maxWidth: '800px', margin: '0 auto' }}>
        <SkeletonLoader type="form" />
      </div>
    )
  }

  return (
    <div className="settings-page" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* 1. PAGE HEADER */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
        padding: '0 0.25rem'
      }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Settings
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minHeight: '36px' }}>
          {/* Subtle Saved Indicator: fades in for ~2s after changes */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              opacity: showSavedToast ? 1 : 0,
              transition: 'opacity 0.2s ease',
              pointerEvents: 'none'
            }}
          >
            <Check size={14} /> Saved
          </span>

          {['profile', 'localization'].includes(activeTab) && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                height: '36px',
                padding: '0 16px',
                borderRadius: '999px',
                background: 'var(--black, #0A0A0A)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 500,
                fontSize: '0.85rem',
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          border: '1px solid var(--danger, #E5482E)',
          color: 'var(--danger, #E5482E)',
          fontSize: '0.85rem',
          marginBottom: '1.25rem',
          background: 'var(--card-bg)'
        }}>
          {error}
        </div>
      )}

      {/* Main Settings Layout */}
      <div className="settings-layout">
        {/* 2. LEFT SETTINGS NAV */}
        <div className="settings-sidebar">
          <div className="settings-tabs-list">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`settings-tab-btn ${isActive ? 'active' : ''}`}
                >
                  {tab.name}
                </button>
              )
            })}
          </div>

          <div className="settings-logout-wrap">
            <button
              type="button"
              className="settings-logout-btn"
              onClick={handleLogout}
            >
              Exit / Log Out
            </button>
          </div>
        </div>

        {/* Settings Content Area */}
        <div className="settings-content-area">
          {/* 3. WORKSPACE TAB */}
          {activeTab === 'workspace' && (
            <div style={{ maxWidth: '960px', width: '100%' }}>
              {/* 3.1 Heading Row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border)'
              }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                  Workspace
                </h3>

                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.825rem',
                    cursor: 'pointer',
                    padding: '4px 0',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  Reset to default
                </button>
              </div>

              {/* 3.2 Mode Presets: Animated Tabs */}
              <div style={{ marginBottom: '2rem' }}>
                <CredAnimatedTabs
                  tabs={PRESET_TABS}
                  value={workspaceMode}
                  onChange={handleSetPreset}
                  layoutId="settings-preset-tabs"
                  style={{ marginBottom: '0.65rem' }}
                />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                  {PRESET_DESCRIPTIONS[workspaceMode] || 'Select your preferred complexity.'}
                </div>
              </div>

              {/* 3.3 Module Visibility */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                {featureDefinitions.map((cat, catIdx) => {
                  const enabledCount = cat.items.filter(it => Boolean(features[it.key])).length

                  return (
                    <div key={catIdx}>
                      {/* Group Heading with Count */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '0.5rem'
                      }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                          {cat.category}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {enabledCount} / {cat.items.length}
                        </span>
                      </div>

                      {/* 2-Column Module List */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                          gap: '0 2.5rem'
                        }}
                      >
                        {cat.items.map(item => {
                          const isEnabled = Boolean(features[item.key])
                          const label = MODULE_SHORT_NAMES[item.key] || item.label

                          return (
                            <div
                              key={item.key}
                              onClick={() => handleToggle(item.key)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 0',
                                borderBottom: '1px solid var(--border)',
                                cursor: 'pointer'
                              }}
                            >
                              <span style={{ fontSize: '0.855rem', fontWeight: 400, color: 'var(--text)' }}>
                                {label}
                              </span>
                              <NeutralToggle
                                checked={isEnabled}
                                onChange={() => handleToggle(item.key)}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 4. FORM FIELDS TAB */}
          {activeTab === 'form-fields' && (
            <FormFieldsManager />
          )}

          {/* 5. MY PROFILE TAB */}
          {activeTab === 'profile' && (
            <div style={{ maxWidth: '580px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.75rem' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'var(--fill-ghost-hover, #F4F4F4)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.35rem',
                  fontWeight: 600,
                  flexShrink: 0
                }}>
                  {profileData.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 style={{ margin: '0 0 2px 0', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)' }}>
                    {profileData.first_name || profileData.username || 'User'} {profileData.last_name || ''}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Administrator
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                      Username
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={profileData.username || ''}
                      disabled
                      style={{
                        height: '36px',
                        fontSize: '0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--fill-ghost-hover, #F4F4F4)',
                        color: 'var(--text-muted)',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                      Account Role
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value="Super Administrator"
                      disabled
                      style={{
                        height: '36px',
                        fontSize: '0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--fill-ghost-hover, #F4F4F4)',
                        color: 'var(--text-muted)',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                      First Name
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={profileData.first_name || ''}
                      onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                      style={{
                        height: '36px',
                        fontSize: '0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--card-bg)',
                        color: 'var(--text)',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                      Last Name
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={profileData.last_name || ''}
                      onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                      style={{
                        height: '36px',
                        fontSize: '0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--card-bg)',
                        color: 'var(--text)',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    value={profileData.email || ''}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    style={{
                      height: '36px',
                      fontSize: '0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--card-bg)',
                      color: 'var(--text)',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      height: '36px',
                      padding: '0 18px',
                      borderRadius: '999px',
                      background: 'var(--black, #0A0A0A)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 500,
                      fontSize: '0.85rem',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {/* Quick Access to Manage Banks & Petty Cash */}
              <div style={{
                marginTop: '2.5rem',
                padding: '1.25rem',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                background: 'var(--card-bg)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)', marginBottom: '2px' }}>
                    Manage Banks & Petty Cash
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Configure company bank accounts, IBANs, and petty cash custody accounts.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleTabChange('manage-banks-cash')}
                  style={{
                    height: '34px',
                    padding: '0 14px',
                    borderRadius: '999px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Manage Accounts &rarr;
                </button>
              </div>
            </div>
          )}

          {/* MANAGE BANKS AND PETTY CASH TAB: untouched */}
          {activeTab === 'manage-banks-cash' && (
            <ManageBanksPettyCash />
          )}

          {/* 5. LOCALIZATION TAB */}
          {activeTab === 'localization' && (
            <div style={{ maxWidth: '520px', width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                  Default Base Currency
                </label>
                <select
                  className="input-field"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  style={{
                    height: '36px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--card-bg)',
                    color: 'var(--text)',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="AED">UAE Dirham (AED)</option>
                  <option value="SAR">Saudi Riyal (SAR)</option>
                  <option value="USD">US Dollar ($)</option>
                  <option value="EUR">Euro (€)</option>
                  <option value="GBP">British Pound (£)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                  Business Time Zone
                </label>
                <select
                  className="input-field"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  style={{
                    height: '36px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--card-bg)',
                    color: 'var(--text)',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="GST">Dubai (GST +4)</option>
                  <option value="UTC">UTC / GMT</option>
                  <option value="AST">Riyadh (AST +3)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                  Preferred Date Format
                </label>
                <select
                  className="input-field"
                  value={formData.date_format}
                  onChange={(e) => setFormData({ ...formData, date_format: e.target.value })}
                  style={{
                    height: '36px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--card-bg)',
                    color: 'var(--text)',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    height: '36px',
                    padding: '0 18px',
                    borderRadius: '999px',
                    background: 'var(--black, #0A0A0A)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 500,
                    fontSize: '0.85rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* 5. SECURITY TAB */}
          {activeTab === 'security' && (
            <div style={{ maxWidth: '420px', width: '100%' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 1.25rem 0' }}>
                Change Password
              </h3>

              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                    Current Secure Password
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                    required
                    style={{
                      height: '36px',
                      fontSize: '0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--card-bg)',
                      color: 'var(--text)',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                    New System Password
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                    required
                    style={{
                      height: '36px',
                      fontSize: '0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--card-bg)',
                      color: 'var(--text)',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                    Verify New Password
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                    required
                    style={{
                      height: '36px',
                      fontSize: '0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--card-bg)',
                      color: 'var(--text)',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      height: '36px',
                      padding: '0 18px',
                      borderRadius: '999px',
                      background: 'var(--black, #0A0A0A)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 500,
                      fontSize: '0.85rem',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {saving ? 'Processing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 5. SYSTEM INFO TAB */}
          {activeTab === 'system' && (
            <div style={{ maxWidth: '580px', width: '100%' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 1.25rem 0' }}>
                System Environment
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.855rem', color: 'var(--text-muted)' }}>Software Version</span>
                  <span style={{ fontSize: '0.855rem', fontWeight: 500, color: 'var(--text)' }}>v2.4.0 (Enterprise)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.855rem', color: 'var(--text-muted)' }}>License Status</span>
                  <span style={{ fontSize: '0.855rem', fontWeight: 500, color: 'var(--positive, #19B25B)' }}>Active / Lifetime</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.855rem', color: 'var(--text-muted)' }}>Last Patch Date</span>
                  <span style={{ fontSize: '0.855rem', fontWeight: 500, color: 'var(--text)' }}>{new Date().toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                  <span style={{ fontSize: '0.855rem', color: 'var(--text-muted)' }}>System Performance</span>
                  <span style={{ fontSize: '0.855rem', fontWeight: 500, color: 'var(--positive, #19B25B)' }}>Optimal (99.9% Uptime)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings
