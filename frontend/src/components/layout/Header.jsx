import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Menu, LogOut, Settings, ChevronDown, Plus, 
  Building2, Users, Briefcase, CreditCard, Receipt, FileSpreadsheet, 
  ShieldCheck, Banknote, X, Bell, BookOpen, Check, Landmark, FileText
} from '../icons'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useModule } from '../../contexts/ModuleContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import api from '../../api'
import { hasModuleAccess, getFirstAccessibleRoute } from '../../constants/permissions'

const Header = ({ onToggleSidebar, onLogout, isMobile, currentUser, onOpenMenuSheet, isCashbook: isCashbookProp }) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [approvingId, setApprovingId] = useState(null)
  const dropdownRef = useRef(null)
  const notifRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  const { activeModule, setActiveModule, currentModuleInfo, MODULES } = useModule()
  const isCashbook = isCashbookProp !== undefined 
    ? isCashbookProp 
    : (location.pathname === '/cashbook' || location.pathname.startsWith('/cashbook/'))
  const { isFeatureVisible } = useWorkspace()
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.is_admin || currentUser?.is_superuser

  const unreadCount = notifications.filter(n => !n.is_read).length

  const fetchNotifications = useCallback(async () => {
    try {
      setNotifLoading(true)
      const res = await api.get('notifications/', { params: { page_size: 20 } })
      const data = res.data?.results || res.data || []
      setNotifications(Array.isArray(data) ? data : [])
    } catch (err) {
      // silently fail — notifications are non-critical
    } finally {
      setNotifLoading(false)
    }
  }, [])

  // Initial fetch + poll every 30 seconds
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const isModuleActiveInWorkspace = (modKey) => {
    const k = modKey.toLowerCase()
    if (k === 'cashbook') {
      return isUserAdmin(currentUser) && isFeatureVisible('cashbook')
    }
    if (k === 'accounting') {
      return hasModuleAccess(currentUser, 'accounting')
    }
    return hasModuleAccess(currentUser, 'erp')
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setShowDropdown(false)
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifications(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleModuleSwitch = (modKey) => {
    const mod = MODULES[modKey]
    if (!mod) return
    setActiveModule(mod.id)
    const targetRoute = getFirstAccessibleRoute(currentUser, mod.id) || mod.defaultRoute
    navigate(targetRoute)
  }

  useEffect(() => {
    if (location.pathname === '/cashbook' || location.pathname.startsWith('/cashbook/')) {
      if (activeModule !== 'cashbook') setActiveModule('cashbook')
    } else if (
      location.pathname === '/accounting' ||
      location.pathname.startsWith('/accounting/') ||
      location.pathname === '/invoices' ||
      location.pathname.startsWith('/invoices/') ||
      location.pathname === '/credit-notes' ||
      location.pathname.startsWith('/credit-notes/') ||
      location.pathname === '/banks' ||
      location.pathname === '/reports' ||
      location.pathname === '/salary'
    ) {
      if (activeModule !== 'accounting') setActiveModule('accounting')
    } else if (
      location.pathname === '/' ||
      location.pathname === '/jobs' ||
      location.pathname.startsWith('/jobs/') ||
      location.pathname === '/enquiries' ||
      location.pathname.startsWith('/enquiries/') ||
      location.pathname === '/delivery-notes' ||
      location.pathname.startsWith('/delivery-notes/') ||
      location.pathname === '/settings' ||
      location.pathname.startsWith('/settings/')
    ) {
      if (activeModule !== 'erp') setActiveModule('erp')
    }
  }, [location.pathname])

  const displayName = currentUser?.first_name
    ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim()
    : (currentUser?.username ? (currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1)) : 'User')

  const displayRole = (currentUser?.role === 'Admin' || currentUser?.is_admin)
    ? 'Super User'
    : (currentUser?.role || 'Staff User')

  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'AS'

  const handleMarkAllRead = async () => {
    try {
      await api.post('notifications/mark_all_read/')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {}
  }

  const handleApproveEntry = async (notification) => {
    const entryId = notification.action_data?.entry_id
    if (!entryId) return
    setApprovingId(notification.id)
    try {
      await api.post(`cashbook-entries/${entryId}/approve/`)
      await api.post(`notifications/${notification.id}/mark_read/`)
      setNotifications(prev => prev.map(n =>
        n.id === notification.id ? { ...n, is_read: true, action_taken: 'approved' } : n
      ))
    } catch (err) {
      console.error('Approve failed:', err)
    } finally {
      setApprovingId(null)
    }
  }

  const handleRejectEntry = async (notification) => {
    const entryId = notification.action_data?.entry_id
    if (!entryId) return
    setApprovingId(notification.id)
    try {
      await api.post(`cashbook-entries/${entryId}/reject/`)
      await api.post(`notifications/${notification.id}/mark_read/`)
      setNotifications(prev => prev.map(n =>
        n.id === notification.id ? { ...n, is_read: true, action_taken: 'rejected' } : n
      ))
    } catch (err) {
      console.error('Reject failed:', err)
    } finally {
      setApprovingId(null)
    }
  }

  const formatNotifTime = (ts) => {
    if (!ts) return ''
    try {
      const diffMs = new Date() - new Date(ts)
      const mins = Math.floor(diffMs / 60000)
      if (mins < 1) return 'just now'
      if (mins < 60) return `${mins}m ago`
      const hrs = Math.floor(mins / 60)
      if (hrs < 24) return `${hrs}h ago`
      return `${Math.floor(hrs / 24)}d ago`
    } catch { return '' }
  }

  return (
    <header className="header zoho-header" style={{ background: 'var(--black, #0A0A0A)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#FFFFFF', position: 'fixed', top: 0, left: 0, right: 0, width: '100%', height: '50px', zIndex: 1010, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 0.85rem' : '0 1.25rem', boxSizing: 'border-box' }}>
      {/* Left: Logo + Module Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.4rem' : '0.85rem', minWidth: 0 }}>
        <Link to={isMobile ? "/cashbook" : "/"} className="header-logo-link" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0, marginRight: isMobile ? '0.2rem' : '0.4rem' }}>
          <img
            src="/logo.png"
            alt="Arab Season"
            className="header-logo-img"
            style={{ height: isMobile ? '24px' : '32px', width: 'auto', maxHeight: '34px', objectFit: 'contain', borderRadius: '4px' }}
          />
        </Link>

        {!isMobile && (
          <div 
            className="header-module-switcher cashbook-pill-switcher"
            style={{
              display: 'flex', alignItems: 'center',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: '999px', padding: '3px', gap: '3px', marginLeft: '0.5rem'
            }}
          >
            {Object.keys(MODULES).filter(key => isModuleActiveInWorkspace(key)).map((key) => {
              const mod = MODULES[key]
              const isActive = activeModule === mod.id
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => handleModuleSwitch(key)}
                  className={`header-module-btn ${isActive ? 'active' : ''} cb-header-pill-btn`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 14px',
                    borderRadius: '999px', border: 'none', cursor: 'pointer', fontSize: '0.8rem',
                    fontWeight: isActive ? '600' : '400',
                    background: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? '#0A0A0A' : '#9A9A9A',
                    boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { 
                    if (!isActive) { 
                      e.currentTarget.style.color = '#ffffff'; 
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)' 
                    } 
                  }}
                  onMouseLeave={(e) => { 
                    if (!isActive) { 
                      e.currentTarget.style.color = '#9A9A9A'; 
                      e.currentTarget.style.background = 'transparent' 
                    } 
                  }}
                  title={mod.description}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'inherit' }}>
                    {mod.id === 'erp' && <Building2 size={14} />}
                    {mod.id === 'accounting' && <Receipt size={14} />}
                    {mod.id === 'cashbook' && <BookOpen size={14} />}
                  </span>
                  <span style={{ whiteSpace: 'nowrap' }}>{mod.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Right: Quick Add + Bell + Settings + Avatar */}
      <div className="header-actions" style={{ display: 'flex', gap: isMobile ? '0.45rem' : '0.65rem', alignItems: 'center', flexShrink: 0 }}>



        {/* Notification Bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => { setShowNotifications(v => !v); if (!showNotifications) fetchNotifications() }}
            className="header-notif-btn"
            style={{
              width: isMobile ? '28px' : '32px', height: isMobile ? '28px' : '32px',
              background: showNotifications ? 'rgba(255,255,255,0.12)' : 'transparent',
              border: 'none', color: unreadCount > 0 ? '#fbbf24' : '#cbd5e1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%', cursor: 'pointer', transition: 'color 0.15s ease', position: 'relative'
            }}
            title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            onMouseEnter={(e) => { if (unreadCount === 0) e.currentTarget.style.color = '#ffffff' }}
            onMouseLeave={(e) => { if (unreadCount === 0) e.currentTarget.style.color = '#cbd5e1' }}
          >
            <Bell size={isMobile ? 16 : 18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: isMobile ? '2px' : '3px', right: isMobile ? '2px' : '3px',
                minWidth: '16px', height: '16px', background: '#ef4444', color: '#fff',
                borderRadius: '999px', fontSize: '0.6rem', fontWeight: '700',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', lineHeight: 1, boxShadow: '0 0 0 2px #1e293b'
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div 
              className="header-notifications-dropdown"
              style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: isMobile ? '-40px' : 0,
                width: isMobile ? '300px' : '340px', maxHeight: '440px', overflowY: 'auto',
                zIndex: 1050, borderRadius: '12px',
                animation: 'slideDown 0.15s ease-out'
              }}
            >
              {/* Sticky header */}
              <div 
                className="notif-header"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.75rem 0.9rem 0.6rem',
                  position: 'sticky', top: 0, zIndex: 1
                }}
              >
                <span className="notif-header-title" style={{ fontWeight: '700', fontSize: '0.825rem' }}>
                  Notifications{unreadCount > 0 && (
                    <span style={{ background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '0.65rem', padding: '1px 6px', marginLeft: '5px' }}>
                      {unreadCount}
                    </span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button type="button" onClick={handleMarkAllRead}
                    className="notif-mark-read"
                    style={{ background: 'none', border: 'none', fontSize: '0.72rem', cursor: 'pointer', fontWeight: '600' }}>
                    Mark all read
                  </button>
                )}
              </div>

              {/* Items */}
              {notifLoading && notifications.length === 0 ? (
                <div className="notif-loading-state" style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.8rem' }}>Loading…</div>
              ) : notifications.length === 0 ? (
                <div className="notif-empty-state" style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.8rem' }}>
                  <Bell size={28} className="notif-empty-bell" style={{ display: 'block', margin: '0 auto 0.5rem' }} />
                  No notifications yet
                </div>
              ) : (
                notifications.map(notif => {
                  const isPettyCash = notif.notification_type === 'petty_cash_approval'
                  const isPending = !notif.action_taken || notif.action_taken === 'pending'
                  const isApproving = approvingId === notif.id
                  return (
                    <div 
                      key={notif.id} 
                      className={`notif-item ${notif.is_read ? 'is-read' : 'is-unread'}`}
                      style={{
                        padding: '0.65rem 0.85rem',
                        transition: 'background 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start' }}>
                        <div 
                          className={`notif-icon-bubble ${isPettyCash ? 'is-petty' : 'is-bell'}`}
                          style={{
                            width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          {isPettyCash
                            ? <Banknote size={14} />
                            : <Bell size={14} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="notif-title" style={{ fontWeight: '600', fontSize: '0.78rem', marginBottom: '2px' }}>{notif.title}</div>
                          <div className="notif-message" style={{ fontSize: '0.72rem', lineHeight: 1.4, marginBottom: '3px' }}>{notif.message}</div>
                          <div className="notif-time" style={{ fontSize: '0.65rem' }}>{formatNotifTime(notif.created_at)}</div>

                          {isPettyCash && isPending && !notif.is_read && (
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '7px' }}>
                              <button type="button" disabled={isApproving} onClick={() => handleApproveEntry(notif)}
                                className="notif-btn-ok"
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  padding: '4px 12px', borderRadius: '5px', border: 'none',
                                  background: '#10b981', color: '#fff', fontSize: '0.72rem',
                                  fontWeight: '700', cursor: isApproving ? 'wait' : 'pointer', opacity: isApproving ? 0.7 : 1
                                }}>
                                <Check size={11} /> OK
                              </button>
                              <button type="button" disabled={isApproving} onClick={() => handleRejectEntry(notif)}
                                className="notif-btn-reject"
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  padding: '4px 12px', borderRadius: '5px',
                                  fontSize: '0.72rem', fontWeight: '700', cursor: isApproving ? 'wait' : 'pointer', opacity: isApproving ? 0.7 : 1
                                }}>
                                <X size={11} /> Reject
                              </button>
                            </div>
                          )}
                          {isPettyCash && notif.action_taken === 'approved' && (
                            <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: '600', marginTop: '4px', display: 'block' }}>✓ Approved</span>
                          )}
                          {isPettyCash && notif.action_taken === 'rejected' && (
                            <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: '600', marginTop: '4px', display: 'block' }}>✗ Rejected</span>
                          )}
                        </div>
                        {!notif.is_read && (
                          <div className="notif-unread-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, marginTop: '5px' }} />
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div
            className="header-avatar-btn"
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', borderRadius: '50%', padding: 0 }}
            onClick={() => {
              setShowDropdown(!showDropdown)
            }}
            title={displayName}
          >
            <div style={{
              width: isMobile ? '28px' : '30px', height: isMobile ? '28px' : '30px',
              borderRadius: '50%', background: '#ffffff', color: '#0A0A0A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: '700', fontSize: isMobile ? '0.7rem' : '0.75rem',
              border: '1.5px solid rgba(255,255,255,0.6)'
            }}>
              {initials}
            </div>
          </div>

          {showDropdown && (
            <div className="profile-dropdown" style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: '220px',
              padding: '0.5rem', zIndex: 1050,
              borderRadius: 'var(--radius-md)', animation: 'slideDown 0.15s ease-out'
            }}>
              <div className="profile-dropdown-header">
                <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)' }}>{displayName}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{currentUser?.email || displayRole}</div>
              </div>
              <Link
                to="/settings?tab=profile"
                className="dropdown-item"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem',
                  padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-main)', background: 'transparent', border: 'none',
                  fontSize: '0.825rem', fontWeight: '500', cursor: 'pointer', textDecoration: 'none'
                }}
                onClick={() => setShowDropdown(false)}
              >
                <Settings size={15} />
                My Profile
              </Link>
              <Link
                to="/settings?tab=manage-banks-cash"
                className="dropdown-item"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem',
                  padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-main)', background: 'transparent', border: 'none',
                  fontSize: '0.825rem', fontWeight: '500', cursor: 'pointer', textDecoration: 'none'
                }}
                onClick={() => setShowDropdown(false)}
              >
                <Landmark size={15} />
                Manage Banks and Petty Cash
              </Link>
              <div className="profile-dropdown-divider" />
              <button
                type="button"
                className="dropdown-item"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem',
                  padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)',
                  color: 'var(--danger)', background: 'transparent', border: 'none',
                  fontSize: '0.825rem', fontWeight: '600', cursor: 'pointer', transition: 'background 0.15s'
                }}
                onClick={() => { setShowDropdown(false); onLogout() }}
              >
                <LogOut size={15} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Profile Dropdown ── */
        .profile-dropdown {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
        .profile-dropdown-header {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 0.35rem;
        }
        .profile-dropdown-divider {
          height: 1px;
          background: #e2e8f0;
          margin: 0.35rem 0;
        }
        .dropdown-item:hover,
        .zoho-quick-item:hover {
          background: #f1f5f9 !important;
        }

        /* ── Dark mode: data-theme="dark" / .cb-dark-bw ── */
        [data-theme='dark'] .profile-dropdown,
        body.cb-dark-bw .profile-dropdown {
          background: #1C1D20 !important;
          border-color: #282B32 !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.45) !important;
        }
        [data-theme='dark'] .profile-dropdown-header,
        body.cb-dark-bw .profile-dropdown-header {
          border-bottom-color: #282B32 !important;
        }
        [data-theme='dark'] .profile-dropdown-divider,
        body.cb-dark-bw .profile-dropdown-divider {
          background: #282B32 !important;
        }
        [data-theme='dark'] .dropdown-item:hover,
        body.cb-dark-bw .dropdown-item:hover {
          background: #222428 !important;
        }

        /* ── Dark mode: obsidian theme ── */
        [data-theme-id='obsidian'] .profile-dropdown {
          background: #151d2e !important;
          border-color: #1f2d44 !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
        }
        [data-theme-id='obsidian'] .profile-dropdown-header {
          border-bottom-color: #1f2d44 !important;
        }
        [data-theme-id='obsidian'] .profile-dropdown-divider {
          background: #1f2d44 !important;
        }
        [data-theme-id='obsidian'] .dropdown-item:hover {
          background: rgba(51,102,153,0.12) !important;
        }

        
        /* ── Notifications Dropdown: Default Light ── */
        .header-notifications-dropdown {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        }
        .header-notifications-dropdown::-webkit-scrollbar {
          width: 5px;
        }
        .header-notifications-dropdown::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 4px;
        }

        .notif-header {
          background: #ffffff;
          border-bottom: 1px solid #f1f5f9;
        }
        .notif-header-title {
          color: #0f172a;
        }
        .notif-mark-read {
          color: #3b82f6;
        }
        .notif-mark-read:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }

        .notif-empty-state,
        .notif-loading-state {
          color: #94a3b8;
        }
        .notif-empty-bell {
          color: #94a3b8;
          opacity: 0.35;
        }

        .notif-item {
          border-bottom: 1px solid #f8fafc;
        }
        .notif-item.is-read {
          background: #ffffff;
        }
        .notif-item.is-unread {
          background: #f0f7ff;
        }
        .notif-item:hover {
          background: #f8fafc;
        }
        .notif-item.is-unread:hover {
          background: #e6f0fd;
        }

        .notif-title {
          color: #0f172a;
        }
        .notif-message {
          color: #475569;
        }
        .notif-time {
          color: #94a3b8;
        }

        .notif-icon-bubble.is-petty {
          background: #fef3c7;
          color: #d97706;
        }
        .notif-icon-bubble.is-bell {
          background: #e0f2fe;
          color: #0284c7;
        }

        .notif-btn-reject {
          border: 1px solid #fca5a5;
          background: #fff5f5;
          color: #ef4444;
        }
        .notif-btn-reject:hover {
          background: #fee2e2;
        }

        .notif-unread-dot {
          background: #3b82f6;
        }

        /* ── Notifications Dropdown: Dark Mode ── */
        [data-theme='dark'] .header-notifications-dropdown,
        body.cb-dark-bw .header-notifications-dropdown,
        html.dark .header-notifications-dropdown,
        [data-theme-id='obsidian'] .header-notifications-dropdown {
          background: #141517 !important;
          border-color: #282B32 !important;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6) !important;
        }
        [data-theme='dark'] .header-notifications-dropdown::-webkit-scrollbar-thumb,
        body.cb-dark-bw .header-notifications-dropdown::-webkit-scrollbar-thumb,
        html.dark .header-notifications-dropdown::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.16) !important;
        }

        [data-theme='dark'] .notif-header,
        body.cb-dark-bw .notif-header,
        html.dark .notif-header,
        [data-theme-id='obsidian'] .notif-header {
          background: #141517 !important;
          border-bottom-color: #282B32 !important;
        }
        [data-theme='dark'] .notif-header-title,
        body.cb-dark-bw .notif-header-title,
        html.dark .notif-header-title,
        [data-theme-id='obsidian'] .notif-header-title {
          color: #ffffff !important;
        }
        [data-theme='dark'] .notif-mark-read,
        body.cb-dark-bw .notif-mark-read,
        html.dark .notif-mark-read,
        [data-theme-id='obsidian'] .notif-mark-read {
          color: #60a5fa !important;
        }
        [data-theme='dark'] .notif-mark-read:hover,
        body.cb-dark-bw .notif-mark-read:hover,
        html.dark .notif-mark-read:hover,
        [data-theme-id='obsidian'] .notif-mark-read:hover {
          color: #93c5fd !important;
        }

        [data-theme='dark'] .notif-empty-state,
        body.cb-dark-bw .notif-empty-state,
        html.dark .notif-empty-state,
        [data-theme-id='obsidian'] .notif-empty-state,
        [data-theme='dark'] .notif-loading-state,
        body.cb-dark-bw .notif-loading-state,
        html.dark .notif-loading-state,
        [data-theme-id='obsidian'] .notif-loading-state {
          color: #8E929E !important;
        }
        [data-theme='dark'] .notif-empty-bell,
        body.cb-dark-bw .notif-empty-bell,
        html.dark .notif-empty-bell,
        [data-theme-id='obsidian'] .notif-empty-bell {
          color: #8E929E !important;
          opacity: 0.45 !important;
        }

        [data-theme='dark'] .notif-item,
        body.cb-dark-bw .notif-item,
        html.dark .notif-item,
        [data-theme-id='obsidian'] .notif-item {
          border-bottom-color: #22242a !important;
        }
        [data-theme='dark'] .notif-item.is-read,
        body.cb-dark-bw .notif-item.is-read,
        html.dark .notif-item.is-read,
        [data-theme-id='obsidian'] .notif-item.is-read {
          background: #141517 !important;
        }
        [data-theme='dark'] .notif-item.is-unread,
        body.cb-dark-bw .notif-item.is-unread,
        html.dark .notif-item.is-unread,
        [data-theme-id='obsidian'] .notif-item.is-unread {
          background: rgba(59, 130, 246, 0.08) !important;
        }
        [data-theme='dark'] .notif-item:hover,
        body.cb-dark-bw .notif-item:hover,
        html.dark .notif-item:hover,
        [data-theme-id='obsidian'] .notif-item:hover {
          background: #1c1d21 !important;
        }
        [data-theme='dark'] .notif-item.is-unread:hover,
        body.cb-dark-bw .notif-item.is-unread:hover,
        html.dark .notif-item.is-unread:hover,
        [data-theme-id='obsidian'] .notif-item.is-unread:hover {
          background: rgba(59, 130, 246, 0.14) !important;
        }

        [data-theme='dark'] .notif-title,
        body.cb-dark-bw .notif-title,
        html.dark .notif-title,
        [data-theme-id='obsidian'] .notif-title {
          color: #f1f5f9 !important;
        }
        [data-theme='dark'] .notif-message,
        body.cb-dark-bw .notif-message,
        html.dark .notif-message,
        [data-theme-id='obsidian'] .notif-message {
          color: #a0a6b5 !important;
        }
        [data-theme='dark'] .notif-time,
        body.cb-dark-bw .notif-time,
        html.dark .notif-time,
        [data-theme-id='obsidian'] .notif-time {
          color: #64748b !important;
        }

        [data-theme='dark'] .notif-icon-bubble.is-petty,
        body.cb-dark-bw .notif-icon-bubble.is-petty,
        html.dark .notif-icon-bubble.is-petty,
        [data-theme-id='obsidian'] .notif-icon-bubble.is-petty {
          background: rgba(245, 158, 11, 0.15) !important;
          color: #fbbf24 !important;
        }
        [data-theme='dark'] .notif-icon-bubble.is-bell,
        body.cb-dark-bw .notif-icon-bubble.is-bell,
        html.dark .notif-icon-bubble.is-bell,
        [data-theme-id='obsidian'] .notif-icon-bubble.is-bell {
          background: rgba(59, 130, 246, 0.15) !important;
          color: #60a5fa !important;
        }

        [data-theme='dark'] .notif-btn-reject,
        body.cb-dark-bw .notif-btn-reject,
        html.dark .notif-btn-reject,
        [data-theme-id='obsidian'] .notif-btn-reject {
          border: 1px solid rgba(239, 68, 68, 0.35) !important;
          background: rgba(239, 68, 68, 0.12) !important;
          color: #f87171 !important;
        }
        [data-theme='dark'] .notif-btn-reject:hover,
        body.cb-dark-bw .notif-btn-reject:hover,
        html.dark .notif-btn-reject:hover,
        [data-theme-id='obsidian'] .notif-btn-reject:hover {
          background: rgba(239, 68, 68, 0.22) !important;
          color: #ffffff !important;
        }

        [data-theme='dark'] .notif-unread-dot,
        body.cb-dark-bw .notif-unread-dot,
        html.dark .notif-unread-dot,
        [data-theme-id='obsidian'] .notif-unread-dot {
          background: #3b82f6 !important;
          box-shadow: 0 0 6px rgba(59, 130, 246, 0.6) !important;
        }

        .zoho-quick-item {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.5rem 0.65rem;
          border-radius: 4px;
          color: var(--text-main);
          text-decoration: none;
          font-size: 0.825rem;
          font-weight: 500;
          transition: background 0.15s;
        }
      `}</style>
    </header>
  )
}

export default Header
