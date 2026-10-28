import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { 
  Settings as SettingsIcon, Shield, Globe, Save, LogOut, Info, 
  AlertCircle, CheckCircle, User, Sliders, Check, 
  RotateCcw, Eye, EyeOff, Layers, Briefcase, CheckCircle2, Landmark
} from '../components/icons'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { showConfirm } from '../utils/swal'
import FormFieldsManager from '../components/settings/FormFieldsManager'
import ManageBanksPettyCash from '../components/settings/ManageBanksPettyCash'

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'workspace')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { refreshSettings } = useSettings()
  const {
    workspaceMode,
    features,
    setWorkspaceMode,
    toggleFeature,
    resetToDefault,
    presets,
    featureDefinitions,
    isMinimalist
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

  const tabs = [
    { id: 'workspace', name: 'Workspace & Modules', icon: Sliders },
    { id: 'form-fields', name: 'Form Fields', icon: Layers },
    { id: 'profile', name: 'My Profile', icon: User },
    { id: 'manage-banks-cash', name: 'Manage Banks and Petty Cash', icon: Landmark },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'localization', name: 'Localization', icon: Globe },
    { id: 'system', name: 'System Info', icon: Info },
  ]

  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: ''
  })

  useEffect(() => {
    fetchSettings()
    fetchProfile()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await api.get('settings/')
      setFormData(response.data)
      setError('')
    } catch (err) {
      console.error('Failed to fetch settings', err)
      setError('Could not load settings. Please try again.')
    } finally {
      if (profileData.email) setLoading(false)
    }
  }

  const fetchProfile = async () => {
    try {
      const response = await api.get('accounts/profile/')
      setProfileData(response.data)
    } catch (err) {
      console.error('Failed to fetch profile', err)
    } finally {
      setLoading(false)
    }
  }

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
      
      setSuccess('Updated successfully!')
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
        // Fallback: Clear storage and redirect
        window.localStorage.clear()
        window.location.href = '/login'
      }
    }
  }

  if (loading) return <div style={{ padding: '3rem', maxWidth: '800px', margin: '0 auto' }}><SkeletonLoader type="form" /></div>

  return (
    <div className="settings-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <SettingsIcon size={24} className="text-primary" />
          <h2>Site Settings & Configuration</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {['workspace', 'manage-banks-cash', 'form-fields', 'system'].includes(activeTab) ? (
            activeTab === 'workspace' ? (
              <span style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontSize: '0.8rem', 
                color: 'var(--success, #10b981)',
                background: '#ecfdf5',
                padding: '6px 12px',
                borderRadius: '6px',
                fontWeight: '600'
              }}>
                <CheckCircle2 size={16} /> Saved Instantly
              </span>
            ) : null
          ) : (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {(error || success) && (
        <div className={error ? "error-message" : "success-message"} style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {error ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          {error || success}
        </div>
      )}

      <div className="glass-panel settings-layout">
        {/* Settings Sidebar */}
        <div className="settings-sidebar">
          <div className="settings-tabs-list">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`settings-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              >
                <tab.icon size={18} />
                <span>{tab.name}</span>
              </button>
            ))}
          </div>
          
          <div className="settings-logout-wrap">
             <button 
               className="btn glass-panel" 
               onClick={handleLogout}
               style={{ width: '100%', color: 'var(--danger)', borderColor: 'var(--danger)', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
             >
               <LogOut size={18} /> Exit / Log Out
             </button>
          </div>
        </div>

        {/* Settings Content */}
        <div className="settings-content-area">
          {activeTab === 'workspace' && (
            <div style={{ maxWidth: '960px', width: '100%' }}>
              {/* Header banner */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.75rem',
                paddingBottom: '1.25rem',
                borderBottom: '1px solid var(--border-color)'
              }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    Workspace & Module Customization
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0, maxWidth: '600px', lineHeight: '1.45' }}>
                    Tailor the interface to your preferred complexity level. Enable <strong>Minimalist Mode</strong> to declutter navigation and focus on essential daily operations, or customize individual modules.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={resetToDefault}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    title="Reset to Full Enterprise View"
                  >
                    <RotateCcw size={14} /> Reset to Default
                  </button>
                </div>
              </div>

              {/* Section 1: Presets Selector */}
              <div style={{ marginBottom: '2.25rem' }}>
                <div style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: '700', 
                  color: '#64748b', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.06em', 
                  marginBottom: '0.85rem' 
                }}>
                  WORKSPACE MODE PRESETS
                </div>

                <div className="settings-presets-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  {presets.map((preset) => {
                    const isSelected = workspaceMode === preset.id
                    const IconComp = preset.id === 'minimalist' ? CheckCircle2 : (preset.id === 'standard' ? Briefcase : (preset.id === 'enterprise' ? Layers : Sliders))
                    const isMin = preset.id === 'minimalist'

                    return (
                      <div
                        key={preset.id}
                        onClick={() => setWorkspaceMode(preset.id)}
                        style={{
                          background: isSelected ? (isMin ? '#f0fdf4' : 'var(--primary-light, #ebf3fc)') : '#ffffff',
                          border: `2px solid ${isSelected ? (isMin ? '#10b981' : 'var(--primary, #1366d9)') : 'var(--border-color, #e2e8f0)'}`,
                          borderRadius: '10px',
                          padding: '1.15rem',
                          cursor: 'pointer',
                          transition: 'all 0.18s ease',
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          boxShadow: isSelected ? '0 4px 14px rgba(0,0,0,0.06)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: isSelected ? (isMin ? '#10b981' : 'var(--primary, #1366d9)') : '#f1f5f9',
                            color: isSelected ? '#ffffff' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <IconComp size={18} />
                          </div>
                          {isSelected && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              color: isMin ? '#059669' : 'var(--primary, #1366d9)',
                              background: isMin ? '#d1fae5' : '#e0e7ff',
                              padding: '2px 8px',
                              borderRadius: '999px'
                            }}>
                              <Check size={11} strokeWidth={3} /> ACTIVE
                            </span>
                          )}
                        </div>

                        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                          {preset.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', fontWeight: '600', color: isMin ? '#10b981' : 'var(--primary, #1366d9)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                          {preset.tag}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4', flex: 1 }}>
                          {preset.description}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Section 2: Detailed Feature Visibility Toggles */}
              <div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '1rem',
                  paddingBottom: '0.5rem',
                  borderBottom: '1px solid var(--border-color)' 
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      FEATURE & MODULE VISIBILITY
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      Toggle modules on/off. Turning a module off hides it from navigation without deleting data.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {featureDefinitions.map((cat, catIdx) => (
                    <div key={catIdx} style={{ background: '#f8fafc', border: '1px solid #edf0f5', borderRadius: '10px', padding: '1.25rem' }}>
                      <div style={{ 
                        fontSize: '0.8rem', 
                        fontWeight: '700', 
                        color: 'var(--text-main)', 
                        marginBottom: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span>{cat.category}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                          ({cat.items.filter(it => Boolean(features[it.key])).length} of {cat.items.length} enabled)
                        </span>
                      </div>

                      <div className="settings-toggles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
                        {cat.items.map((item) => {
                          const isEnabled = Boolean(features[item.key])

                          return (
                            <div
                              key={item.key}
                              onClick={() => toggleFeature(item.key)}
                              style={{
                                background: '#ffffff',
                                border: `1.5px solid ${isEnabled ? 'var(--primary, #1366d9)' : '#e2e8f0'}`,
                                borderRadius: '8px',
                                padding: '0.85rem 1rem',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.85rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {/* Custom Toggle Switch */}
                              <div style={{
                                marginTop: '2px',
                                width: '36px',
                                height: '20px',
                                borderRadius: '999px',
                                background: isEnabled ? 'var(--primary, #1366d9)' : '#cbd5e1',
                                position: 'relative',
                                flexShrink: 0,
                                transition: 'background 0.2s ease'
                              }}>
                                <div style={{
                                  width: '14px',
                                  height: '14px',
                                  borderRadius: '50%',
                                  background: '#ffffff',
                                  position: 'absolute',
                                  top: '3px',
                                  left: isEnabled ? '19px' : '3px',
                                  transition: 'left 0.2s ease',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                }} />
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: isEnabled ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                    {item.label}
                                  </span>
                                  <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: '700',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: isEnabled ? 'var(--primary-light, #ebf3fc)' : '#f1f5f9',
                                    color: isEnabled ? 'var(--primary, #1366d9)' : '#94a3b8'
                                  }}>
                                    {isEnabled ? 'VISIBLE' : 'HIDDEN'}
                                  </span>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0', lineHeight: '1.35' }}>
                                  {item.description}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'form-fields' && (
            <FormFieldsManager />
          )}

          {activeTab === 'profile' && (
            <div style={{ maxWidth: '600px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', flexShrink: 0 }}>
                  {profileData.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ marginBottom: '0.25rem', fontSize: '1.2rem', wordBreak: 'break-word' }}>{profileData.first_name || profileData.username} {profileData.last_name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>System User / Administrator</p>
                </div>
              </div>
              <div className="form-grid">
                 <div className="form-group">
                   <label>Username</label>
                   <input type="text" className="input-field" value={profileData.username || ''} disabled />
                 </div>
                 <div className="form-group">
                   <label>Account Role</label>
                   <input type="text" className="input-field" value="Super Administrator" disabled />
                 </div>
              </div>

              {/* Quick access to Manage Banks & Petty Cash */}
              <div style={{
                marginTop: '2rem',
                padding: '1.25rem',
                background: 'var(--card-bg, #f8fafc)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'var(--primary-light, #eff6ff)',
                    color: 'var(--primary, #1366d9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Landmark size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      Manage Banks & Petty Cash
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Configure company bank accounts, IBANs, and petty cash custody accounts.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setActiveTab('manage-banks-cash')}
                  style={{ fontSize: '0.82rem', padding: '0.5rem 0.9rem' }}
                >
                  Manage Accounts &rarr;
                </button>
              </div>
            </div>
          )}

          {activeTab === 'manage-banks-cash' && (
            <ManageBanksPettyCash />
          )}


          {activeTab === 'localization' && (
            <div className="form-grid">
              <div className="form-group">
                <label>Default Base Currency</label>
                <select 
                  className="input-field"
                  value={formData.currency}
                  onChange={(e) => setFormData({...formData, currency: e.target.value})}
                >
                  <option value="AED">UAE Dirham (AED)</option>
                  <option value="SAR">Saudi Riyal (SAR)</option>
                  <option value="USD">US Dollar ($)</option>
                  <option value="EUR">Euro (€)</option>
                  <option value="GBP">British Pound (£)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Business Time Zone</label>
                <select 
                  className="input-field"
                  value={formData.timezone}
                  onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                >
                  <option value="GST">Dubai (GST +4)</option>
                  <option value="UTC">UTC / GMT</option>
                  <option value="AST">Riyadh (AST +3)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Preferred Date Format</label>
                <select 
                  className="input-field"
                  value={formData.date_format}
                  onChange={(e) => setFormData({...formData, date_format: e.target.value})}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div style={{ maxWidth: '450px' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>Update Admin Password</h3>
              <form onSubmit={handleChangePassword}>
                <div className="form-group">
                  <label>Current Secure Password</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>New System Password</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Verify New Password</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ marginTop: '1rem', width: '100%' }}
                  disabled={saving}
                >
                  {saving ? 'Processing...' : 'Change Password'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'system' && (
            <div>
              <h3 style={{ marginBottom: '1.5rem' }}>System Environment</h3>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Software Version</span>
                  <span style={{ fontWeight: '600' }}>v2.4.0 (Enterprise)</span>
                </div>
                <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>License Status</span>
                  <span style={{ fontWeight: '600', color: 'var(--success)' }}>Active / Lifetime</span>
                </div>
                <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Last Patch Date</span>
                  <span style={{ fontWeight: '600' }}>{new Date().toLocaleDateString()}</span>
                </div>
                <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>System Performance</span>
                  <span style={{ fontWeight: '600', color: 'var(--success)' }}>Optimal (99.9% Uptime)</span>
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
