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

const Header = ({ onToggleSidebar, onLogout, isMobile, currentUser, onOpenMenuSheet, isCashbook: isCashbookProp }) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [approvingId, setApprovingId] = useState(null)
  const dropdownRef = useRef(null)
  const quickAddRef = useRef(null)
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
      return isFeatureVisible('cashbook') && (isAdmin || (currentUser?.access_list || []).includes('cashbook'))
    }
    if (k === 'accounting') {
      return isFeatureVisible('payments') || isFeatureVisible('expenses') || isFeatureVisible('banks') || isFeatureVisible('reports') || isFeatureVisible('salary')
    }
    return isFeatureVisible('customers') || isFeatureVisible('vendors') || isFeatureVisible('jobs') || isFeatureVisible('estimations')
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setShowDropdown(false)
      if (quickAddRef.current && !quickAddRef.current.contains(event.target)) setShowQuickAdd(false)
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifications(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleModuleSwitch = (modKey) => {
    const mod = MODULES[modKey]
    if (!mod) return
    setActiveModule(mod.id)
    navigate(mod.defaultRoute)
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
      location.pathname === '/payments' ||
      location.pathname === '/expenses' ||
      location.pathname === '/payment-requests' ||
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
      location.pathname.startsWith('/delivery-notes/')
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

        {/* Quick Add "+" (Desktop only — removed in mobile responsive view) */}
        {!isMobile && (
          <div ref={quickAddRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="header-quick-add-btn"
              style={{
                width: '32px', height: '32px',
                background: '#ffffff', color: '#0A0A0A', border: 'none',
                borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', fontWeight: '700',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)', transition: 'all 0.15s ease'
              }}
              title="Create New"
            >
              <Plus size={18} strokeWidth={2.6} />
            </button>

            {showQuickAdd && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '260px',
                padding: '0.5rem', zIndex: 1050, background: '#ffffff',
                border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                borderRadius: '8px', animation: 'slideDown 0.15s ease-out'
              }}>
                {(isFeatureVisible('customers') || isFeatureVisible('jobs') || isFeatureVisible('estimations') || isFeatureVisible('quotations') || isFeatureVisible('delivery_notes')) && (
                  <>
                    <div style={{ padding: '0.35rem 0.6rem', fontSize: '0.675rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sales & Operations</div>
                    {isFeatureVisible('quotations') && <Link to="/accounting/quotations/new" onClick={() => setShowQuickAdd(false)} className="zoho-quick-item"><FileText size={14} style={{ color: 'var(--primary)' }} /><span>New Quotation</span></Link>}
                    {isFeatureVisible('customers') && <Link to="/accounting/customers" onClick={() => setShowQuickAdd(false)} className="zoho-quick-item"><Users size={14} style={{ color: 'var(--primary)' }} /><span>New Customer</span></Link>}
                    {isFeatureVisible('jobs') && <Link to="/jobs" onClick={() => setShowQuickAdd(false)} className="zoho-quick-item"><Briefcase size={14} style={{ color: 'var(--primary)' }} /><span>New Job Order</span></Link>}
                    {isFeatureVisible('estimations') && <Link to="/accounting/estimations/new" onClick={() => setShowQuickAdd(false)} className="zoho-quick-item"><FileSpreadsheet size={14} style={{ color: 'var(--primary)' }} /><span>New Estimation</span></Link>}
                    {isFeatureVisible('delivery_notes') && <Link to="/delivery-notes/new" onClick={() => setShowQuickAdd(false)} className="zoho-quick-item"><FileText size={14} style={{ color: 'var(--primary)' }} /><span>New Delivery Note</span></Link>}
                  </>
                )}
                {(isFeatureVisible('invoices') || isFeatureVisible('credit_notes') || isFeatureVisible('vendors') || isFeatureVisible('expenses') || isFeatureVisible('payments') || isFeatureVisible('payment_requests') || isFeatureVisible('banks')) && (
                  <>
                    <div style={{ height: '1px', background: 'var(--border-light)', margin: '0.35rem 0' }} />
                    <div style={{ padding: '0.35rem 0.6rem', fontSize: '0.675rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Billing & Financials</div>
                    {isFeatureVisible('invoices') && <Link to="/invoices/new" onClick={() => setShowQuickAdd(false)} className="zoho-quick-item"><Receipt size={14} style={{ color: 'var(--primary)' }} /><span>New Invoice</span></Link>}
                    {isFeatureVisible('credit_notes') && <Link to="/credit-notes/new" onClick={() => setShowQuickAdd(false)} className="zoho-quick-item"><Receipt size={14} style={{ color: 'var(--warning)' }} /><span>New Credit Note</span></Link>}
                    {isFeatureVisible('vendors') && <Link to="/accounting/vendors" onClick={() => setShowQuickAdd(false)} className="zoho-quick-item"><Building2 size={14} style={{ color: 'var(--warning)' }} /><span>New Vendor</span></Link>}
                    {isFeatureVisible('expenses') && <Link to="/expenses" onClick={() => setShowQuickAdd(false)} className="zoho-quick-item"><Receipt size={14} style={{ color: 'var(--danger)' }} /><span>Record Expense</span></Link>}
                    {isFeatureVisible('payments') && <Link to="/payments" onClick={() => setShowQuickAdd(false)} className="zoho-quick-item"><CreditCard size={14} style={{ color: 'var(--success)' }} /><span>Record Payment</span></Link>}
                    {isFeatureVisible('payment_requests') && <Link to="/payment-requests" onClick={() => setShowQuickAdd(false)} className="zoho-quick-item"><ShieldCheck size={14} style={{ color: 'var(--info, #0284c7)' }} /><span>Payment Request</span></Link>}
                    
                  </>
                )}
                {isFeatureVisible('cashbook') && (
                  <>
                    <div style={{ height: '1px', background: 'var(--border-light)', margin: '0.35rem 0' }} />
                    <div style={{ padding: '0.35rem 0.6rem', fontSize: '0.675rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cashbook & Vault</div>
                    <Link to="/cashbook" onClick={() => setShowQuickAdd(false)} className="zoho-quick-item"><BookOpen size={14} style={{ color: '#f59e0b' }} /><span>Open Cashbook</span></Link>
                  </>
                )}
              </div>
            )}
          </div>
        )}

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
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: isMobile ? '-40px' : 0,
              width: isMobile ? '300px' : '340px', maxHeight: '440px', overflowY: 'auto',
              zIndex: 1050, background: '#ffffff', border: '1px solid #e2e8f0',
              boxShadow: '0 10px 30px rgba(0,0,0,0.18)', borderRadius: '10px',
              animation: 'slideDown 0.15s ease-out'
            }}>
              {/* Sticky header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.7rem 0.85rem 0.5rem', borderBottom: '1px solid #f1f5f9',
                position: 'sticky', top: 0, background: '#ffffff', zIndex: 1
              }}>
                <span style={{ fontWeight: '700', fontSize: '0.825rem', color: '#0f172a' }}>
                  Notifications{unreadCount > 0 && (
                    <span style={{ background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '0.65rem', padding: '1px 6px', marginLeft: '5px' }}>
                      {unreadCount}
                    </span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button type="button" onClick={handleMarkAllRead}
                    style={{ background: 'none', border: 'none', fontSize: '0.72rem', color: '#3b82f6', cursor: 'pointer', fontWeight: '600' }}>
                    Mark all read
                  </button>
                )}
              </div>

              {/* Items */}
              {notifLoading && notifications.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Loading…</div>
              ) : notifications.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                  <Bell size={28} style={{ opacity: 0.3, display: 'block', margin: '0 auto 0.5rem' }} />
                  No notifications yet
                </div>
              ) : (
                notifications.map(notif => {
                  const isPettyCash = notif.notification_type === 'petty_cash_approval'
                  const isPending = !notif.action_taken || notif.action_taken === 'pending'
                  const isApproving = approvingId === notif.id
                  return (
                    <div key={notif.id} style={{
                      padding: '0.65rem 0.85rem', borderBottom: '1px solid #f8fafc',
                      background: notif.is_read ? '#ffffff' : '#f0f7ff', transition: 'background 0.15s'
                    }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <div style={{
                          width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                          background: isPettyCash ? '#fef3c7' : '#e0f2fe',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {isPettyCash
                            ? <Banknote size={14} style={{ color: '#d97706' }} />
                            : <Bell size={14} style={{ color: '#0284c7' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '600', fontSize: '0.78rem', color: '#0f172a', marginBottom: '2px' }}>{notif.title}</div>
                          <div style={{ fontSize: '0.72rem', color: '#475569', lineHeight: 1.4, marginBottom: '3px' }}>{notif.message}</div>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{formatNotifTime(notif.created_at)}</div>

                          {isPettyCash && isPending && !notif.is_read && (
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '7px' }}>
                              <button type="button" disabled={isApproving} onClick={() => handleApproveEntry(notif)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  padding: '4px 12px', borderRadius: '5px', border: 'none',
                                  background: '#10b981', color: '#fff', fontSize: '0.72rem',
                                  fontWeight: '700', cursor: isApproving ? 'wait' : 'pointer', opacity: isApproving ? 0.7 : 1
                                }}>
                                <Check size={11} /> OK
                              </button>
                              <button type="button" disabled={isApproving} onClick={() => handleRejectEntry(notif)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  padding: '4px 12px', borderRadius: '5px',
                                  border: '1px solid #fca5a5', background: '#fff5f5', color: '#ef4444',
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
                          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: '5px' }} />
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
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: '220px',
              padding: '0.5rem', zIndex: 1050, background: '#ffffff',
              border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              borderRadius: 'var(--radius-md)', animation: 'slideDown 0.15s ease-out'
            }}>
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-light)', marginBottom: '0.35rem' }}>
                <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)' }}>{displayName}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{currentUser?.email || displayRole}</div>
              </div>
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
        .dropdown-item:hover,
        .zoho-quick-item:hover {
          background: var(--border-light, #f1f5f9) !important;
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
