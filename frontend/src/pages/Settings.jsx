import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { 
  Shield, Save, LogOut, 
  AlertCircle, CheckCircle, User, Sliders, Check, 
  RotateCcw, CheckCircle2, Landmark, Lock,
  Eye, EyeOff
} from '../components/icons'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { showConfirm } from '../utils/swal'
import ManageBanksPettyCash from '../components/settings/ManageBanksPettyCash'
import { CredAnimatedTabs } from '../components/cashbook/cred/CredAnimatedTabs'
import PageHeaderButton from '../components/common/PageHeaderButton'

const Settings = ({ mode }) => {
  const location = useLocation()
  const isAccounting = mode === 'accounting' || location.pathname.startsWith('/accounting')

  const validTabs = isAccounting
    ? ['manage-banks-cash', 'workspace', 'profile', 'security']
    : ['workspace', 'profile', 'security']

  const defaultTab = isAccounting ? 'manage-banks-cash' : 'workspace'

  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab')
    return validTabs.includes(tabParam) ? tabParam : defaultTab
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { refreshSettings } = useSettings()
  const {
    features,
    toggleFeature,
    resetToDefault,
    accountingFeatureDefinitions,
    operationsFeatureDefinitions,
  } = useWorkspace()

  const activeFeatureDefs = isAccounting
    ? (accountingFeatureDefinitions || [])
    : (operationsFeatureDefinitions || [])

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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [profileData, setProfileData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: ''
  })

  const tabs = useMemo(() => isAccounting
    ? [
        { id: 'manage-banks-cash', name: 'Manage Banks & Petty Cash', icon: Landmark },
        { id: 'workspace', name: 'Financial Modules', icon: Sliders },
        { id: 'profile', name: 'My Profile', icon: User },
        { id: 'security', name: 'Security', icon: Shield },
      ]
    : [
        { id: 'workspace', name: 'Operations Modules', icon: Sliders },
        { id: 'profile', name: 'My Profile', icon: User },
        { id: 'security', name: 'Security', icon: Shield },
      ], [isAccounting])

  const animatedTabList = useMemo(() => tabs.map(tab => ({
    id: tab.id,
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <tab.icon size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span>{tab.name}</span>
      </span>
    )
  })), [tabs])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam) {
      if (validTabs.includes(tabParam)) {
        if (tabParam !== activeTab) {
          setActiveTab(tabParam)
        }
      } else {
        setActiveTab(defaultTab)
        setSearchParams({ tab: defaultTab }, { replace: true })
      }
    }
  }, [searchParams, isAccounting])

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
    return () => { isMounted = false }
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      
      if (activeTab === 'profile') {
        const response = await api.post('accounts/profile/', profileData)
        setProfileData(response.data)
      } else {
        const response = await api.post('settings/', formData)
        setFormData(response.data)
        refreshSettings() // Refresh global context immediately
      }
      
      setSuccess('Settings updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
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
      setSuccess('')
      await api.post('change-password/', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      })
      setSuccess('Password updated successfully!')
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' })
      setTimeout(() => setSuccess(''), 3000)
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

  if (loading) {
    return (
      <div className="erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
        <SkeletonLoader type="form" />
      </div>
    )
  }

  return (
    <div className="erp-page-container erp-page-transition" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', paddingBottom: '3rem' }}>
      
      {/* ── 1. Page Header ── */}
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em' }}>
            {isAccounting ? 'Accounting Settings' : 'Settings'}
          </h1>
          <p style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '13px', margin: '4px 0 0' }}>
            {isAccounting
              ? 'Configure company bank accounts, petty cash custody, and module visibility'
              : 'Configure system preferences, operations module visibility, and security settings'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {['workspace', 'manage-banks-cash'].includes(activeTab) ? (
            <span style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '12.5px', 
              color: 'var(--text, #18181B)',
              background: 'var(--fill-ghost, #F4F4F5)',
              border: '1px solid var(--border, #E4E4E7)',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontWeight: 500
            }}>
              <CheckCircle2 size={14} strokeWidth={2} style={{ color: 'var(--text, #18181B)' }} /> Instant Save Active
            </span>
          ) : (
            <PageHeaderButton
              onClick={handleSave}
              disabled={saving}
              icon={Save}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </PageHeaderButton>
          )}

          <button
            type="button"
            onClick={handleLogout}
            title="Log Out of System"
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '9999px',
              border: '1px solid var(--border, #E4E4E4)',
              background: 'var(--card-bg, #FFFFFF)',
              color: 'var(--danger, #DC2626)',
              fontSize: '13px',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(220, 38, 38, 0.08)'
              e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.35)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--card-bg, #FFFFFF)'
              e.currentTarget.style.borderColor = 'var(--border, #E4E4E4)'
            }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* ── 2. Navigation Tabs (Horizontal Animated Tabs matching other pages) ── */}
      <div style={{ marginBottom: '22px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '4px' }}>
        <CredAnimatedTabs
          tabs={animatedTabList}
          value={activeTab}
          onChange={handleTabChange}
          layoutId="settings-main-tabs"
          className="case-preserve"
        />
      </div>

      {/* ── 3. Feedback Banner ── */}
      {(error || success) && (
        <div style={{
          marginBottom: '20px',
          padding: '12px 16px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13.5px',
          fontWeight: 500,
          background: error ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${error ? '#FCA5A5' : '#86EFAC'}`,
          color: error ? '#991B1B' : '#166534'
        }}>
          {error ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{error || success}</span>
        </div>
      )}

      {/* ── 4. Tab Content Area ── */}

      {/* Manage Banks & Petty Cash (Full Width) */}
      {activeTab === 'manage-banks-cash' && (
        <ManageBanksPettyCash />
      )}

      {/* Operations / Financial Modules */}
      {activeTab === 'workspace' && (
        <div style={{
          background: 'var(--card-bg, #FFFFFF)',
          border: '1px solid var(--border, #E4E4E4)',
          borderRadius: '20px',
          padding: '24px 28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '24px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border, #E4E4E4)'
          }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.01em' }}>
                {isAccounting ? 'Financial Modules & Navigation Visibility' : 'Operations Modules & Navigation Visibility'}
              </h2>
              <p style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '13px', margin: '4px 0 0', maxWidth: '640px', lineHeight: '1.45' }}>
                {isAccounting
                  ? 'Toggle financial modules on/off to declutter your accounting sidebar without deleting any ledger or financial data.'
                  : 'Toggle operations modules on/off to customize which workflows appear in your operations navigation.'}
              </p>
            </div>

            <button
              type="button"
              onClick={resetToDefault}
              style={{
                height: '34px',
                padding: '0 14px',
                borderRadius: '9999px',
                border: '1px solid var(--border, #E4E4E4)',
                background: 'var(--card-bg, #FFFFFF)',
                color: 'var(--text, #0A0A0A)',
                fontSize: '13px',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--fill-ghost-hover, #F4F4F4)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--card-bg, #FFFFFF)'}
              title={isAccounting ? "Reset all financial modules to enabled" : "Reset all operations modules to enabled"}
            >
              <RotateCcw size={13} strokeWidth={2} /> Reset to Default
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {activeFeatureDefs.map((cat, catIdx) => {
              const enabledCount = cat.items.filter(it => (features && features[it.key] !== undefined ? Boolean(features[it.key]) : true)).length
              return (
                <div key={catIdx}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.01em' }}>
                        {cat.category}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', fontWeight: 400 }}>
                        ({enabledCount} of {cat.items.length} enabled)
                      </span>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                    gap: '8px'
                  }}>
                    {cat.items.map((item) => {
                      const isEnabled = features && features[item.key] !== undefined ? Boolean(features[item.key]) : true
                      return (
                        <div
                          key={item.key}
                          id={`toggle-feature-${item.key}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleFeature(item.key)}
                          style={{
                            background: isEnabled ? 'var(--fill-ghost, #F7F7F7)' : 'transparent',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '8px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            opacity: isEnabled ? 1 : 0.6,
                            userSelect: 'none'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--fill-ghost-hover, #F0F0F0)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = isEnabled ? 'var(--fill-ghost, #F7F7F7)' : 'transparent'
                          }}
                        >
                          {/* Toggle Switch + Label */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{
                              width: '32px',
                              height: '18px',
                              borderRadius: '9999px',
                              background: isEnabled ? 'var(--text, #0A0A0A)' : 'var(--border-strong, #D4D4D8)',
                              position: 'relative',
                              flexShrink: 0,
                              transition: 'background-color 0.2s ease'
                            }}>
                              <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: isEnabled ? 'var(--card-bg, #FFFFFF)' : '#FFFFFF',
                                position: 'absolute',
                                top: '3px',
                                left: isEnabled ? '17px' : '3px',
                                transition: 'left 0.2s ease',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
                              }} />
                            </div>

                            <span style={{
                              fontSize: '13px',
                              fontWeight: 500,
                              color: 'var(--text, #0A0A0A)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {item.label}
                            </span>
                          </div>

                          {/* Minimal Status without boundaries */}
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: isEnabled ? 'var(--text, #18181B)' : 'var(--text-muted, #71717A)',
                            letterSpacing: '0.04em',
                            flexShrink: 0
                          }}>
                            {isEnabled ? 'VISIBLE' : 'HIDDEN'}
                          </span>
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

      {/* My Profile */}
      {activeTab === 'profile' && (
        <div style={{ maxWidth: '800px' }}>
          <div style={{
            background: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            {/* User Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border, #E4E4E4)' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--fill-ghost, #F1F5F9)',
                color: 'var(--text, #0A0A0A)',
                border: '1px solid var(--border, #E4E4E4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 600,
                flexShrink: 0
              }}>
                {(profileData.first_name || profileData.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
                  {profileData.first_name || profileData.username} {profileData.last_name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted, #8C8C8C)' }}>
                    @{profileData.username || 'user'}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    background: 'var(--fill-ghost, #F1F5F9)',
                    color: 'var(--text-muted, #475569)',
                    border: '1px solid var(--border, #E2E8F0)'
                  }}>
                    Super Administrator
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Inputs */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px' }}>
                  First Name
                </label>
                <input
                  type="text"
                  value={profileData.first_name || ''}
                  onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                  placeholder="Enter first name"
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--card-bg, #FFFFFF)',
                    color: 'var(--text, #0A0A0A)',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px' }}>
                  Last Name
                </label>
                <input
                  type="text"
                  value={profileData.last_name || ''}
                  onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                  placeholder="Enter last name"
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--card-bg, #FFFFFF)',
                    color: 'var(--text, #0A0A0A)',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={profileData.email || ''}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  placeholder="name@company.com"
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--card-bg, #FFFFFF)',
                    color: 'var(--text, #0A0A0A)',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px' }}>
                  Username (Fixed)
                </label>
                <input
                  type="text"
                  value={profileData.username || ''}
                  disabled
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--fill-ghost, #F8FAFC)',
                    color: 'var(--text-muted, #64748B)',
                    fontSize: '13.5px',
                    outline: 'none',
                    cursor: 'not-allowed',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px' }}>
                  Account Role
                </label>
                <input
                  type="text"
                  value="Super Administrator"
                  disabled
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--fill-ghost, #F8FAFC)',
                    color: 'var(--text-muted, #64748B)',
                    fontSize: '13.5px',
                    outline: 'none',
                    cursor: 'not-allowed',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <PageHeaderButton
                onClick={handleSave}
                disabled={saving}
                icon={Save}
              >
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </PageHeaderButton>
            </div>
          </div>
        </div>
      )}

      {/* Security */}
      {activeTab === 'security' && (
        <div style={{ maxWidth: '520px' }}>
          <div style={{
            background: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text, #0A0A0A)', letterSpacing: '-0.01em' }}>
              Security & Authentication
            </h2>
            <p style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '13px', margin: '0 0 24px 0', lineHeight: '1.45' }}>
              Update your account password. Choose a strong password of at least 8 characters.
            </p>

            <form onSubmit={handleChangePassword}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px' }}>
                    Current Secure Password
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordData.current_password}
                      onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                      placeholder="••••••••"
                      required
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 40px 0 14px',
                        borderRadius: '12px',
                        border: '1px solid var(--border, #E4E4E4)',
                        background: 'var(--card-bg, #FFFFFF)',
                        color: 'var(--text, #0A0A0A)',
                        fontSize: '13.5px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(prev => !prev)}
                      title={showCurrentPassword ? "Hide password" : "Show password"}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted, #8C8C8C)',
                        transition: 'color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text, #0A0A0A)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'}
                    >
                      {showCurrentPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px' }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      placeholder="At least 8 characters"
                      required
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 40px 0 14px',
                        borderRadius: '12px',
                        border: '1px solid var(--border, #E4E4E4)',
                        background: 'var(--card-bg, #FFFFFF)',
                        color: 'var(--text, #0A0A0A)',
                        fontSize: '13.5px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(prev => !prev)}
                      title={showNewPassword ? "Hide password" : "Show password"}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted, #8C8C8C)',
                        transition: 'color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text, #0A0A0A)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'}
                    >
                      {showNewPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', marginBottom: '6px' }}>
                    Verify New Password
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                      placeholder="Repeat new password"
                      required
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 40px 0 14px',
                        borderRadius: '12px',
                        border: '1px solid var(--border, #E4E4E4)',
                        background: 'var(--card-bg, #FFFFFF)',
                        color: 'var(--text, #0A0A0A)',
                        fontSize: '13.5px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(prev => !prev)}
                      title={showConfirmPassword ? "Hide password" : "Show password"}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted, #8C8C8C)',
                        transition: 'color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text, #0A0A0A)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <PageHeaderButton
                  type="submit"
                  disabled={saving}
                  icon={Lock}
                >
                  {saving ? 'Processing...' : 'Change Password'}
                </PageHeaderButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
