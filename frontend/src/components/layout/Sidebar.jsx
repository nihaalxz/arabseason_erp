import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, Users, Building2, Briefcase, FileSpreadsheet, 
  Layers, CreditCard, ShieldCheck, Receipt, FileBarChart, 
  Banknote, Settings, UserCog, Pin, PinOff, X, BookOpen, Landmark, FileText, Trash2 
} from '../icons'
import { Truck, RotateCcw, ChevronLeft, ChevronRight, HardHat, MessageSquareQuote } from 'lucide-react'
import { useModule } from '../../contexts/ModuleContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import api from '../../api'

const MODULE_KEY_MAP = {
  '/accounting': 'payments',
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
  '/payments': 'payments',
  '/payment-requests': 'payment_requests',
  '/expenses': 'expenses',
  '/cashbook': 'cashbook',
  '/reports': 'reports',
  '/reports?tab=salary': 'salary',
  '/salary': 'salary',
  '/settings': 'settings',
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
    if (itemPath === '/salary' || itemPath === '/reports?tab=salary') {
      return location.pathname === '/salary' || (location.pathname === '/reports' && currentTab === 'salary')
    }
    if (itemPath === '/reports') {
      return location.pathname === '/reports' && currentTab !== 'salary'
    }
    return location.pathname === itemPath || location.pathname.startsWith(itemPath + '/')
  }

  // Define Navigation Items adapted to Active Module (or Unified View)
  let allNavItems = []

  if (activeModule === 'cashbook') {
    allNavItems = (isAdmin || (currentUser?.access_list || []).includes('cashbook')) ? [
      { name: 'Cash Books (Shelf)', path: '/cashbook', icon: BookOpen },
      { name: 'Vendors', path: '/cashbook?tab=vendors', icon: Building2 },
      { name: 'Labour', path: '/cashbook?tab=labour', icon: HardHat },
      { name: 'Job Orders', path: '/cashbook?tab=job_orders', icon: Briefcase },
      { name: 'Bank & Petty Cash', path: '/cashbook?tab=bank_accounts', icon: Landmark },
      { type: 'divider', label: 'ADMINISTRATION' },
      { name: 'Settings', path: '/settings', icon: Settings },
      { name: 'Recycle Bin', path: '/cashbook?tab=recycle_bin', icon: Trash2 },
    ] : [
      { name: 'ERP Dashboard', path: '/', icon: LayoutDashboard },
    ]
  } else if (activeModule === 'accounting') {
    allNavItems = [
      { name: 'Accounting Dashboard', path: '/accounting', icon: LayoutDashboard },
      { type: 'divider', label: 'BILLING & INVOICING' },
      { name: 'Invoices', path: '/invoices', icon: Receipt },
      { name: 'Credit Notes', path: '/credit-notes', icon: RotateCcw },
      { type: 'divider', label: 'TREASURY & PAYMENTS' },
      { name: 'Payments & Receipts', path: '/payments', icon: CreditCard },
      { name: 'Payment Requests', path: '/payment-requests', icon: ShieldCheck },
      { type: 'divider', label: 'COST & PAYROLL' },
      { name: 'Expenses', path: '/expenses', icon: Receipt },
      { name: 'Salary & Payroll', path: '/salary', icon: Banknote },
      { type: 'divider', label: 'FINANCIAL INTELLIGENCE' },
      { name: 'Financial Reports', path: '/reports', icon: FileBarChart },
      { type: 'divider', label: 'ADMINISTRATION' },
      { name: 'Settings', path: '/settings', icon: Settings },
      ...(isAdmin ? [{ name: 'User Management', path: '/users', icon: UserCog }] : []),
    ]
  } else {
    // Default: 'erp' (ERP Operations)
    allNavItems = [
      { name: 'ERP Dashboard', path: '/', icon: LayoutDashboard },
      { type: 'divider', label: 'CRM & DIRECTORY' },
      { name: 'Enquiries', path: '/enquiries', icon: MessageSquareQuote },
      { name: 'Customers', path: '/customers', icon: Users },
      { name: 'Vendors', path: '/vendors', icon: Building2 },
      { type: 'divider', label: 'SALES & ESTIMATION' },
      { name: 'Estimations', path: '/estimations', icon: FileSpreadsheet },
      { name: 'Quotations', path: '/quotations', icon: FileText },
      { type: 'divider', label: 'OPERATIONS & FULFILLMENT' },
      { name: 'Job Orders', path: '/jobs', icon: Briefcase },
      { name: 'Project Planning', path: '/jobs?tab=planning', icon: Layers },
      { name: 'Delivery Notes', path: '/delivery-notes', icon: Truck },
      { type: 'divider', label: 'ADMINISTRATION' },
      { name: 'Settings', path: '/settings', icon: Settings },
      ...(isAdmin ? [{ name: 'User Management', path: '/users', icon: UserCog }] : []),
    ]
  }

  const rawNavItems = allNavItems.filter(item => {
    if (!item.path) return true // dividers (processed below)
    if (item.path === '/' || item.path === '/accounting' || item.path === '/settings' || item.path === '/recycle-bin' || item.path.startsWith('/cashbook')) return true

    // Check workspace feature visibility first
    const moduleKey = MODULE_KEY_MAP[item.path]
    if (moduleKey && !isFeatureVisible(moduleKey)) {
      return false
    }

    if (isAdmin) return true // admins see all permitted active features
    if (!moduleKey) return true
    const accessList = currentUser?.access_list || []
    if (['/quotations', '/credit-notes', '/delivery-notes'].includes(item.path)) {
      return accessList.includes(moduleKey) || accessList.includes('invoices')
    }
    if (item.path === '/jobs?tab=planning') {
      return accessList.includes('planning') || accessList.includes('jobs')
    }
    if (item.path === '/salary' || item.path === '/reports?tab=salary') {
      return accessList.includes('salary') || accessList.includes('reports')
    }
    return accessList.includes(moduleKey)
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

  return (
    <aside className={`sidebar zoho-sidebar ${isOpen ? 'open' : ''} ${!isPinned && !isMobile ? 'mini' : ''} ${isPinned && !isMobile ? 'pinned' : ''}`}>
      {/* Top bar: Title & Pin/Unpin */}
      <div className="sidebar-top-bar" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isPinned ? 'space-between' : 'center',
        padding: '0.5rem 0.75rem',
        borderBottom: '1px solid #edf0f5',
        height: '40px'
      }}>
        {(!isMobile && isPinned) && (
          <span style={{ fontSize: '0.675rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Navigation
          </span>
        )}
        {!isMobile ? (
          <button
            type="button"
            className={`pin-button ${isPinned ? 'active' : ''}`}
            onClick={onTogglePin}
            title={isPinned ? 'Contract Sidebar' : 'Expand Sidebar'}
            style={{
              background: isPinned ? 'transparent' : '#F0EEFD',
              border: isPinned ? 'none' : '1px solid #ECEBF7',
              color: isPinned ? '#64748b' : '#5B4BDB',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.18s ease',
              width: isPinned ? '28px' : '36px',
              height: isPinned ? '28px' : '36px'
            }}
          >
            {isPinned ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            style={{ 
              color: '#64748b', 
              background: '#f1f5f9', 
              border: 'none', 
              padding: '0.35rem', 
              borderRadius: '4px',
              marginLeft: 'auto',
              cursor: 'pointer'
            }}
            title="Close Menu"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, idx) => (
          item.type === 'divider' ? (
            <div key={idx} className="divider-label" style={{
              fontSize: '0.65rem',
              fontWeight: '700',
              color: '#94a3b8',
              marginTop: '1.1rem',
              marginBottom: '0.35rem',
              padding: '0 0.65rem',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
              textTransform: 'uppercase'
            }}>
              {item.label}
            </div>
          ) : (() => {
            const isItemActive = checkIsActive(item.path)

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link zoho-nav-item ${isItemActive ? 'active' : ''}`}
                onClick={() => { 
                  if (item.onSwitch) setActiveModule(item.onSwitch)
                  if (isMobile) onClose() 
                }}
                title={item.name}
              >
                <item.icon size={17} style={{ minWidth: '17px', flexShrink: 0 }} />
                <span>{item.name}</span>
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
                      marginLeft: 'auto',
                      flexShrink: 0
                    }}
                  />
                )}
                {item.path === '/enquiries' && dueEnquiriesCount > 0 && (
                  <span
                    title={`${dueEnquiriesCount} follow-up ${dueEnquiriesCount === 1 ? 'call' : 'calls'} due today`}
                    style={{
                      background: '#f59e0b',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: '800',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      marginLeft: 'auto',
                      flexShrink: 0
                    }}
                  >
                    {dueEnquiriesCount}
                  </span>
                )}
              </Link>
            )
          })()
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
