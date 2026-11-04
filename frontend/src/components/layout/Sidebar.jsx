import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, Users, Building2, Briefcase, FileSpreadsheet, 
  Layers, CreditCard, ShieldCheck, Receipt, FileBarChart, 
  Banknote, Settings, UserCog, BookOpen, Landmark, FileText, Trash2 
} from '../icons'
import { Truck, RotateCcw, HardHat, MessageSquareQuote, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useModule } from '../../contexts/ModuleContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import api from '../../api'
import { canAccessPermission, isUserAdmin } from '../../constants/permissions'

const MODULE_KEY_MAP = {
  '/accounting': 'payments',
  '/accounting/customers': 'customers',
  '/accounting/vendors': 'vendors',
  '/accounting/estimations': 'estimations',
  '/accounting/quotations': 'quotations',
  '/enquiries': 'enquiries',
  '/customers': 'customers',
  '/vendors': 'vendors',
  '/estimations': 'estimations',
  '/quotations': 'quotations',
  '/jobs': 'jobs',
  '/jobs?tab=planning': 'planning',
  '/invoices': 'invoices',
  '/credit-notes': 'credit_notes',
  '/delivery-notes': 'delivery_notes',
  '/banks': 'banks',
  '/cashbook': 'cashbook',
  '/reports': 'reports',
  '/settings': 'settings',
  '/users': 'users',
}

const Sidebar = ({ isOpen, isPinned, isMobile, onTogglePin, onClose, currentUser }) => {
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.is_admin || currentUser?.is_superuser
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const currentTab = searchParams.get('tab')
  const { activeModule, setActiveModule } = useModule()
  const { isFeatureVisible } = useWorkspace()

  // Track pending job order entries for red dot notification
  const [pendingJobCount, setPendingJobCount] = useState(0)
  const [dueEnquiriesCount, setDueEnquiriesCount] = useState(0)
  const [recycleCounts, setRecycleCounts] = useState({ erp: 0, accounting: 0, cashbook: 0 })

  useEffect(() => {
    let isMounted = true
    const fetchRecycleCounts = async () => {
      try {
        const res = await api.get('recycle-bin/stats/')
        if (isMounted && res.data) {
          setRecycleCounts({
            erp: res.data.erp?.total_active || 0,
            accounting: res.data.accounting?.total_active || 0,
            cashbook: res.data.cashbook?.total_active || 0,
          })
        }
      } catch (err) {}
    }
    fetchRecycleCounts()
    const handleUpdate = () => fetchRecycleCounts()
    window.addEventListener('recycle-bin-updated', handleUpdate)
    const timer = setInterval(fetchRecycleCounts, 30000)
    return () => {
      isMounted = false
      window.removeEventListener('recycle-bin-updated', handleUpdate)
      clearInterval(timer)
    }
  }, [location.pathname])

  useEffect(() => {
    let isMounted = true
    const fetchPendingCount = async () => {
      try {
        const [jobRes, enqRes] = await Promise.allSettled([
          api.get('pending-job-orders/pending-count/'),
          api.get('enquiries/metrics/')
        ])
        if (isMounted) {
          if (jobRes.status === 'fulfilled') {
            setPendingJobCount(jobRes.value?.data?.pending_count || 0)
          }
          if (enqRes.status === 'fulfilled') {
            setDueEnquiriesCount(enqRes.value?.data?.due_today_count || 0)
          }
        }
      } catch (err) {
        // quiet fallback
      }
    }
    fetchPendingCount()
    const timer = setInterval(fetchPendingCount, 15000)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [location.pathname])

  const checkIsActive = (itemPath) => {
    if (itemPath === '/') {
      return location.pathname === '/'
    }
    if (itemPath === '/accounting') {
      return location.pathname === '/accounting'
    }
    if (itemPath === '/accounting/recycle-bin') {
      return location.pathname === '/accounting/recycle-bin'
    }
    if (itemPath === '/erp/recycle-bin') {
      return location.pathname === '/erp/recycle-bin'
    }
    if (itemPath === '/cashbook?tab=recycle_bin') {
      return location.pathname === '/cashbook' && currentTab === 'recycle_bin'
    }
    if (itemPath === '/cashbook?tab=bank_accounts') {
      return location.pathname === '/cashbook' && currentTab === 'bank_accounts'
    }
    if (itemPath === '/cashbook?tab=vendors') {
      return location.pathname === '/cashbook' && currentTab === 'vendors'
    }
    if (itemPath === '/cashbook?tab=labour') {
      return location.pathname === '/cashbook' && currentTab === 'labour'
    }
    if (itemPath === '/cashbook?tab=job_orders') {
      return location.pathname === '/cashbook' && currentTab === 'job_orders'
    }
    if (itemPath === '/cashbook') {
      return location.pathname === '/cashbook' && currentTab !== 'recycle_bin' && currentTab !== 'bank_accounts' && currentTab !== 'vendors' && currentTab !== 'labour' && currentTab !== 'job_orders'
    }
    if (itemPath === '/jobs?tab=planning') {
      return location.pathname === '/jobs' && currentTab === 'planning'
    }
    if (itemPath === '/jobs') {
      return location.pathname === '/jobs' && currentTab !== 'planning'
    }
    if (itemPath === '/reports') {
      return location.pathname === '/reports'
    }
    return location.pathname === itemPath || location.pathname.startsWith(itemPath + '/')
  }

  // Define Navigation Items adapted to Active Module
  let allNavItems = []

  if (activeModule === 'cashbook') {
    allNavItems = [
      { name: 'Cash Books (Shelf)', path: '/cashbook', icon: BookOpen, permission: 'cashbook' },
      { name: 'Vendors', path: '/cashbook?tab=vendors', icon: Building2, permission: 'vendors' },
      { name: 'Labour', path: '/cashbook?tab=labour', icon: HardHat, permission: 'labour' },
      { name: 'Job Orders', path: '/cashbook?tab=job_orders', icon: Briefcase, permission: 'jobs' },
      { name: 'Bank & Petty Cash', path: '/cashbook?tab=bank_accounts', icon: Landmark, permission: 'banks' },
      { type: 'divider', label: 'ADMINISTRATION' },
      { name: 'Settings', path: '/settings', icon: Settings, permission: 'settings' },
      { name: 'Recycle Bin', path: '/cashbook?tab=recycle_bin', icon: Trash2, permission: 'recycle_bin', count: recycleCounts.cashbook },
    ]
  } else if (activeModule === 'accounting') {
    allNavItems = [
      { name: 'Accounting Dashboard', path: '/accounting', icon: LayoutDashboard, permission: 'accounting' },
      { type: 'divider', label: 'SALES' },
      { name: 'Customers', path: '/accounting/customers', icon: Users, permission: 'customers' },
      { name: 'Estimations', path: '/accounting/estimations', icon: FileSpreadsheet, permission: 'estimations' },
      { name: 'Quotations', path: '/accounting/quotations', icon: FileText, permission: 'quotations' },
      { name: 'Invoices', path: '/invoices', icon: Receipt, permission: 'invoices' },
      { name: 'Credit Notes', path: '/credit-notes', icon: RotateCcw, permission: 'credit_notes' },
      { type: 'divider', label: 'PURCHASES' },
      { name: 'Vendors', path: '/accounting/vendors', icon: Building2, permission: 'vendors' },
      { type: 'divider', label: 'REPORTS' },
      { name: 'Financial Reports', path: '/reports', icon: FileBarChart, permission: 'reports' },
      { name: 'Settings', path: '/accounting/settings', icon: Settings, permission: 'accounting_settings' },
      ...(isAdmin ? [{ name: 'User Management', path: '/users', icon: UserCog, adminOnly: true }] : []),
    ]
  } else {
    // Default: 'erp' (ERP Operations)
    allNavItems = [
      { name: 'ERP Dashboard', path: '/', icon: LayoutDashboard, permission: 'dashboard' },
      { type: 'divider', label: 'CRM' },
      { name: 'Enquiries', path: '/enquiries', icon: MessageSquareQuote, permission: 'enquiries' },
      { type: 'divider', label: 'OPERATIONS' },
      { name: 'Job Orders', path: '/jobs', icon: Briefcase, permission: 'jobs' },
      { name: 'Project Planning', path: '/jobs?tab=planning', icon: Layers, permission: 'planning' },
      { name: 'Delivery Notes', path: '/delivery-notes', icon: Truck, permission: 'delivery_notes' },
      { name: 'Settings', path: '/settings', icon: Settings, permission: 'settings' },
      ...(isAdmin ? [{ name: 'User Management', path: '/users', icon: UserCog, adminOnly: true }] : []),
    ]
  }

  const rawNavItems = allNavItems.filter(item => {
    if (item.type === 'divider') return true

    // Workspace Navigation Visibility check (Operations & Financial Modules toggles)
    const featureKey = item.featureKey || MODULE_KEY_MAP[item.path]
    if (featureKey && !isFeatureVisible(featureKey)) {
      return false
    }

    if (isAdmin) return true
    if (item.adminOnly) return false

    if (item.permission) {
      return canAccessPermission(currentUser, item.permission)
    }

    const moduleKey = MODULE_KEY_MAP[item.path]
    if (moduleKey) {
      return canAccessPermission(currentUser, moduleKey)
    }

    return true
  })

  // Remove orphan or consecutive empty dividers
  const navItems = rawNavItems.filter((item, idx, arr) => {
    if (item.type !== 'divider') return true
    for (let i = idx + 1; i < arr.length; i++) {
      if (arr[i].type === 'divider') return false
      if (arr[i].path) return true
    }
    return false
  })

  const isMini = !isMobile && !isPinned;

  return (
    <aside 
      className={`sidebar cred-desktop-sidebar ${isOpen ? 'open' : ''} ${isMini ? 'mini is-collapsed' : ''} ${isPinned && !isMobile ? 'pinned' : ''}`} 
      style={{ 
        width: isMini ? '76px' : '240px', 
        minWidth: isMini ? '76px' : '240px', 
        background: 'var(--black, #0A0A0A)', 
        borderRight: '1px solid rgba(255, 255, 255, 0.08)', 
        position: 'fixed', 
        top: '50px', 
        bottom: 0, 
        left: 0, 
        zIndex: 900, 
        display: 'flex', 
        flexDirection: 'column', 
        boxSizing: 'border-box', 
        overflow: 'hidden', 
        transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.2s cubic-bezier(0.16, 1, 0.3, 1)', 
        willChange: 'width, min-width', 
        userSelect: 'none' 
      }}
      aria-label="Navigation"
    >
      {/* Top Header: simple "MENU" title */}
      {(!isMobile && isPinned) ? (
        <div 
          className="sidebar-menu-header" 
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: '#8C8C8C',
            padding: '16px 14px 6px',
            flexShrink: 0
          }}
        >
          MENU
        </div>
      ) : (
        <div style={{ height: '14px', flexShrink: 0 }} />
      )}

      {/* Scrollable list without scrollbar gutter (identical width for ERP and Accounting) */}
      <nav 
        className="sidebar-nav" 
        style={{ 
          padding: isMini ? '8px 6px 60px' : '8px 8px 60px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '3px', 
          background: 'transparent', 
          flex: '1 1 0%', 
          minHeight: 0, 
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        {navItems.map((item, idx) => {
          return item.type === 'divider' ? (
            isMini ? null : (
              <div 
                key={`divider-${idx}-${item.label}`} 
                className="divider-label" 
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#8C8C8C',
                  marginTop: '1.2rem',
                  marginBottom: '0.4rem',
                  padding: '0 12px',
                  letterSpacing: '0.14em',
                  whiteSpace: 'nowrap',
                  textTransform: 'uppercase'
                }}
              >
                {item.label}
              </div>
            )
          ) : (() => {
            const isItemActive = checkIsActive(item.path)

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`cred-side-nav-item ${isItemActive ? 'is-active' : ''}`}
                onClick={() => { 
                  if (item.onSwitch) setActiveModule(item.onSwitch)
                  if (isMobile) onClose() 
                }}
                title={item.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isMini ? 'center' : 'flex-start',
                  gap: isMini ? 0 : '10px',
                  padding: isMini ? '10px 0' : '9px 12px',
                  borderRadius: '12px',
                  background: isItemActive ? '#1A1A1A' : 'transparent',
                  color: isItemActive ? '#FFFFFF' : '#9A9A9A',
                  fontSize: '13px',
                  fontWeight: isItemActive ? 500 : 400,
                  whiteSpace: 'nowrap',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  width: '100%',
                  boxSizing: 'border-box',
                  zIndex: 1
                }}
                onMouseEnter={(e) => {
                  if (!isItemActive) {
                    e.currentTarget.style.background = '#141414';
                    e.currentTarget.style.color = '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isItemActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#9A9A9A';
                  }
                }}
              >
                {/* Icons are always pure white (#FFFFFF) in default, hover and active states */}
                <item.icon 
                  size={17} 
                  strokeWidth={isItemActive ? 2.2 : 1.6} 
                  style={{ 
                    minWidth: '17px', 
                    flexShrink: 0, 
                    color: '#FFFFFF', 
                    stroke: '#FFFFFF',
                    position: 'relative',
                    zIndex: 2
                  }} 
                />
                {!isMini && (
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    position: 'relative',
                    zIndex: 2,
                    color: isItemActive ? '#FFFFFF' : 'inherit'
                  }}>
                    {item.name}
                  </span>
                )}
                {item.path === '/jobs' && pendingJobCount > 0 && (
                  <span
                    className="pending-red-dot"
                    title={`${pendingJobCount} pending job order ${pendingJobCount === 1 ? 'entry' : 'entries'}`}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      boxShadow: '0 0 6px rgba(239, 68, 68, 0.9)',
                      position: isMini ? 'absolute' : 'static',
                      top: isMini ? '7px' : undefined,
                      right: isMini ? '12px' : undefined,
                      marginLeft: isMini ? undefined : 'auto',
                      flexShrink: 0,
                      zIndex: 2
                    }}
                  />
                )}
                {!isMini && item.path === '/enquiries' && dueEnquiriesCount > 0 && (
                  <span
                    title={`${dueEnquiriesCount} follow-up ${dueEnquiriesCount === 1 ? 'call' : 'calls'} due today`}
                    style={{
                      background: isItemActive ? '#282a2e' : 'rgba(255, 255, 255, 0.10)',
                      color: isItemActive ? '#ffffff' : '#8E929E',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '1px 7px',
                      borderRadius: '999px',
                      marginLeft: 'auto',
                      flexShrink: 0,
                      zIndex: 2,
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    {dueEnquiriesCount}
                  </span>
                )}
                {item.count > 0 && (
                  <span
                    className="recycle-bin-nav-badge"
                    title={`${item.count} items in Recycle Bin`}
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: isMini ? '1px 5px' : '1px 7px',
                      borderRadius: '999px',
                      background: 'rgba(239, 68, 68, 0.18)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      position: isMini ? 'absolute' : 'static',
                      top: isMini ? '5px' : undefined,
                      right: isMini ? '6px' : undefined,
                      marginLeft: isMini ? undefined : 'auto',
                      zIndex: 3,
                      lineHeight: '1.2'
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            )
          })()
        })}
      </nav>

      {/* Bottom bar: Collapse / Expand toggle */}
      {!isMobile && (
        <div 
          className="sidebar-bottom-bar"
          style={{ 
            padding: '12px 14px', 
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: isPinned ? 'flex-end' : 'center',
            alignItems: 'center',
            flexShrink: 0,
            background: 'var(--black, #0A0A0A)',
            zIndex: 10
          }}
        >
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onTogglePin}
            title={isPinned ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={isPinned ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              background: 'transparent',
              border: 'none',
              color: '#8C8C8C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              transition: 'background-color 0.15s ease, color 0.15s ease'
            }}
            onMouseEnter={(e) => { 
              e.currentTarget.style.color = '#FFFFFF'; 
              e.currentTarget.style.background = '#1A1A1A';
            }}
            onMouseLeave={(e) => { 
              e.currentTarget.style.color = '#8C8C8C'; 
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {isPinned ? (
              <PanelLeftClose size={18} strokeWidth={1.8} />
            ) : (
              <PanelLeftOpen size={18} strokeWidth={1.8} />
            )}
          </button>
        </div>
      )}
    </aside>
  )
}

export default Sidebar;
