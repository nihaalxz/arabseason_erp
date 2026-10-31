import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import CredTopStrip from '../cashbook/cred/CredTopStrip'
import { useModule } from '../../contexts/ModuleContext'

const DashboardLayout = ({ onLogout, currentUser }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem('cashbook_dark_mode') === 'true'
    } catch (e) {
      return false
    }
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768
    }
    return false
  })
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
    const saved = localStorage.getItem('sidebarPinned')
    return saved !== null ? saved === 'true' : true
  })
  const { activeModule } = useModule()
  const location = useLocation()
  const navigate = useNavigate()
  const isCashbook = location.pathname === '/cashbook' || location.pathname.startsWith('/cashbook/')

  // FIX 1: Universal mobile redirect. Only Cashbook has a mobile experience.
  // All Accounting and ERP routes redirect to /cashbook on mobile view (<= 768px).
  useEffect(() => {
    if (isMobile && !isCashbook) {
      navigate('/cashbook', { replace: true })
    }
  }, [isMobile, isCashbook, navigate, location.pathname])

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      if (mobile && !isCashbook) {
        navigate('/cashbook', { replace: true })
      }
      if (!mobile) {
        setIsSidebarOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isCashbook, navigate])

  useEffect(() => {
    localStorage.setItem('sidebarPinned', isSidebarPinned)
  }, [isSidebarPinned])

  useEffect(() => {
    try {
      localStorage.setItem('cashbook_dark_mode', String(isDarkMode))
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
    document.body.classList.toggle('cb-dark-bw', isDarkMode)
    document.body.style.colorScheme = isDarkMode ? 'dark' : 'light'
  }, [isDarkMode])

  // If on mobile and trying to view any non-cashbook page, immediately redirect to Cashbook
  if (isMobile && !isCashbook) {
    return <Navigate to="/cashbook" replace />
  }

  const toggleSidebar = () => {
    setIsSidebarPinned(prev => !prev)
  }

  const toggleSidebarPinned = () => {
    setIsSidebarPinned(prev => !prev)
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    window.dispatchEvent(new CustomEvent('app:refresh'))
    setTimeout(() => setIsRefreshing(false), 800)
  }

  const handleToggleTheme = () => {
    setIsDarkMode(prev => !prev)
  }

  const sidebarWidth = isSidebarPinned ? 240 : 76

  return (
    <div 
      className={`dashboard-wrapper ${isSidebarPinned && !isMobile && !isCashbook ? 'sidebar-pinned' : ''} ${!isCashbook ? 'theme-soft-fintech' : 'theme-cashbook-pill'} ${isCashbook ? 'is-cashbook' : ''}`}
      data-theme-scope={!isCashbook ? 'soft-fintech' : 'cashbook-pill'}
      style={{ background: 'var(--black, #0A0A0A)', minHeight: '100vh' }}
    >
      {/* Shared Header with Plugin Pills: rendered on desktop for all modules, and mobile for cashbook */}
      {(!isCashbook || !isMobile) && (
        <Header 
          onToggleSidebar={toggleSidebar} 
          onLogout={onLogout} 
          isMobile={isMobile} 
          currentUser={currentUser} 
          onOpenMenuSheet={() => {}}
          isCashbook={isCashbook}
        />
      )}
      
      {!isMobile && isSidebarOpen && !isCashbook && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}
      
      <div 
        className="dashboard-body" 
        style={{ 
          background: 'var(--black, #0A0A0A)', 
          marginTop: '50px', 
          minHeight: 'calc(100vh - 50px)', 
          display: 'flex', 
          position: 'relative',
          width: '100%'
        }}
      >
        {!isMobile && !isCashbook && (
          <Sidebar
            isOpen={isSidebarOpen}
            isPinned={isSidebarPinned}
            isMobile={false}
            onTogglePin={toggleSidebarPinned}
            onClose={() => setIsSidebarOpen(false)}
            currentUser={currentUser}
          />
        )}
        <div 
          className="main-content" 
          style={isCashbook ? { 
            marginLeft: 0, 
            width: '100%', 
            transition: 'none', 
            background: 'transparent' 
          } : {
            marginLeft: isMobile ? 0 : `${sidebarWidth}px`,
            width: isMobile ? '100%' : `calc(100% - ${sidebarWidth}px)`,
            minHeight: 'calc(100vh - 50px)',
            background: 'var(--bg, #FFFFFF)',
            borderTopLeftRadius: isMobile ? 0 : 'var(--radius-panel, 28px)',
            overflowY: 'auto',
            transition: 'margin-left 0.2s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Fixed CredTopStrip on non-mobile ERP & Accounting pages */}
          {!isMobile && !isCashbook && (
            <CredTopStrip
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              isDarkMode={isDarkMode}
              onToggleTheme={handleToggleTheme}
              onOpenMembers={() => navigate('/settings')}
              onOpenRecycleBin={() => navigate('/recycle-bin')}
            />
          )}

          <main 
            className="content-area" 
            style={isCashbook ? { padding: 0 } : {
              padding: isMobile ? '16px 16px 80px' : '24px 32px 80px',
              maxWidth: '1600px',
              margin: '0 auto',
              width: '100%',
              boxSizing: 'border-box',
              flex: 1
            }}
          >
            <div key={isCashbook ? 'cashbook' : location.pathname} className="erp-page-transition">
              <Outlet context={{ currentUser, onLogout }} />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default DashboardLayout
