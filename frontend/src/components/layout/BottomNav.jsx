import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, Briefcase, Users, Layers, MoreHorizontal, 
  CreditCard, Receipt, Banknote, BookOpen, Settings, FileText, FileBarChart
} from '../icons'
import { useModule } from '../../contexts/ModuleContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import api from '../../api'

const BottomNav = ({ onOpenMore, currentUser }) => {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const currentTab = searchParams.get('tab')
  const { activeModule } = useModule()
  const { isFeatureVisible, isMinimalist } = useWorkspace()

  const [pendingJobCount, setPendingJobCount] = useState(0)

  useEffect(() => {
    let isMounted = true
    const fetchPendingCount = async () => {
      try {
        const res = await api.get('pending-job-orders/pending-count/')
        if (isMounted) {
          setPendingJobCount(res.data?.pending_count || 0)
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

  // Cashbook module uses native full-screen app views without bottom navigation
  // Also hide on document builder / editor pages so bottom action toolbars are never obscured
  const isBuilderPage = 
    location.pathname.endsWith('/new') || 
    location.pathname.includes('/edit') ||
    location.pathname.startsWith('/invoices/new') ||
    location.pathname.startsWith('/quotations/new') ||
    location.pathname.startsWith('/credit-notes/new') ||
    location.pathname.startsWith('/delivery-notes/new') ||
    location.pathname.startsWith('/estimations/new') ||
    location.pathname.startsWith('/jobs/new')

  if (location.pathname === '/cashbook' || location.pathname.startsWith('/cashbook/') || isBuilderPage) {
    return null
  }

  const checkIsActive = (itemPath) => {
    if (itemPath === '/') {
      return location.pathname === '/'
    }
    if (itemPath === '/accounting') {
      return location.pathname === '/accounting'
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
    if (itemPath.startsWith('/cashbook')) {
      return location.pathname === '/cashbook'
    }
    return location.pathname === itemPath || location.pathname.startsWith(itemPath + '/')
  }

  // Define 4 primary tabs per module + More
  let navItems = []

  if (activeModule === 'cashbook') {
    navItems = [
      { name: 'Cashbooks', path: '/cashbook?view=books', icon: BookOpen },
      { name: 'Reports', path: '/reports?tab=cashbook', icon: Receipt },
      { name: 'Settings', path: '/settings', icon: Settings },
    ]
  } else if (activeModule === 'accounting') {
    navItems = [
      { name: 'Dashboard', path: '/accounting', icon: LayoutDashboard },
      { name: 'Invoices', path: '/invoices', icon: Receipt },
      { name: 'Payments', path: '/payments', icon: CreditCard },
      { name: 'Reports', path: '/reports', icon: FileBarChart },
    ]
  } else {
    // Default ERP Operations
    navItems = [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard },
      { name: 'Jobs', path: '/jobs', icon: Briefcase },
      { name: 'Quotations', path: '/quotations', icon: FileText },
      { name: 'Customers', path: '/customers', icon: Users },
    ]
  }

  const MODULE_PATH_KEY = {
    '/accounting': 'payments',
    '/customers': 'customers',
    '/vendors': 'vendors',
    '/estimations': 'estimations',
    '/jobs': 'jobs',
    '/jobs?tab=planning': 'planning',
    '/invoices': 'invoices',
    '/banks': 'banks',
    '/payments': 'payments',
    '/payment-requests': 'payment_requests',
    '/expenses': 'expenses',
    '/cashbook': 'cashbook',
    '/cashbook?view=books': 'cashbook',
    '/reports': 'reports',
    '/reports?tab=cashbook': 'cashbook',
    '/salary': 'salary',
  }

  const visibleNavItems = navItems.filter(item => {
    if (item.path === '/' || item.path === '/accounting' || item.path === '/settings') return true
    const k = MODULE_PATH_KEY[item.path]
    return k ? isFeatureVisible(k) : true
  })

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
      <div className="mobile-bottom-nav-inner">
        {visibleNavItems.map((item) => {
          const isActive = checkIsActive(item.path)
          const Icon = item.icon

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-nav-tab ${isActive ? 'active' : ''}`}
            >
              <div className="mobile-nav-icon-wrap" style={{ position: 'relative' }}>
                <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
                {item.path === '/jobs' && pendingJobCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '0px',
                      right: '-2px',
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      boxShadow: '0 0 5px rgba(239, 68, 68, 0.9)'
                    }}
                  />
                )}
              </div>
              <span className="mobile-nav-label">{item.name}</span>
            </Link>
          )
        })}

        {/* 5th Action: More Options / Drawer */}
        <button
          type="button"
          onClick={onOpenMore}
          className="mobile-nav-tab mobile-nav-more-btn"
          aria-label="More navigation options"
        >
          <div className="mobile-nav-icon-wrap">
            <MoreHorizontal size={20} strokeWidth={1.8} />
          </div>
          <span className="mobile-nav-label">More</span>
        </button>
      </div>
    </nav>
  )
}

export default BottomNav
