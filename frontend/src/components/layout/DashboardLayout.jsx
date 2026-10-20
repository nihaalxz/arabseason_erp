import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import MobileMenuSheet from './MobileMenuSheet'
import { useModule } from '../../contexts/ModuleContext'

const DashboardLayout = ({ onLogout, currentUser }) => {
  const [theme, setTheme] = useState('light')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
    const saved = localStorage.getItem('sidebarPinned')
    return saved !== null ? saved === 'true' : true
  })
  const [isSidebarAnimating, setIsSidebarAnimating] = useState(false)
  const { activeModule } = useModule()
  const location = useLocation()
  const navigate = useNavigate()
  const isCashbook = location.pathname === '/cashbook' || location.pathname.startsWith('/cashbook/')

  useEffect(() => {
    if (isMobile && location.pathname === '/') {
      navigate('/cashbook', { replace: true })
    }
  }, [isMobile, location.pathname, navigate])

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      if (!mobile) {
        setIsSidebarOpen(false)
        setIsMobileMenuOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebarPinned', isSidebarPinned)
  }, [isSidebarPinned])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileMenuOpen(prev => !prev)
    } else {
      setIsSidebarAnimating(true)
      setIsSidebarPinned(prev => !prev)
      setTimeout(() => setIsSidebarAnimating(false), 300)
    }
  }

  const toggleSidebarPinned = () => {
    setIsSidebarAnimating(true)
    setIsSidebarPinned(prev => !prev)
    setTimeout(() => setIsSidebarAnimating(false), 300)
  }

  return (
    <div 
      className={`dashboard-wrapper ${isSidebarPinned && !isMobile && !isCashbook ? 'sidebar-pinned' : ''} ${!isCashbook ? 'theme-soft-fintech' : 'theme-cashbook-pill'} ${isSidebarAnimating ? 'sidebar-animating' : ''} ${isCashbook ? 'is-cashbook' : ''}`}
      data-theme-scope={!isCashbook ? 'soft-fintech' : 'cashbook-pill'}
    >
      {/* Full-width Zoho Books Header with SSO Switcher */}
      <Header 
        onToggleSidebar={toggleSidebar} 
        onLogout={onLogout} 
        isMobile={isMobile} 
        currentUser={currentUser} 
        onOpenMenuSheet={() => setIsMobileMenuOpen(true)}
        isCashbook={isCashbook}
      />
      
      {!isMobile && isSidebarOpen && !isCashbook && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}
      
      <div className="dashboard-body">
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
          style={isCashbook ? { marginLeft: 0, width: '100%', transition: 'none' } : (isSidebarAnimating ? undefined : { transition: 'none' })}
        >
          <main className="content-area" style={isCashbook ? { padding: 0 } : {}}>
            <div key={isCashbook ? 'cashbook' : location.pathname} className="erp-page-transition">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Native Mobile Bottom Navigation (Hidden in Cashbook module) */}
      {isMobile && !isCashbook && (
        <BottomNav 
          onOpenMore={() => setIsMobileMenuOpen(true)} 
          currentUser={currentUser} 
        />
      )}

      {/* Native Mobile Slide-up Menu Sheet */}
      {isMobile && !isCashbook && (
        <MobileMenuSheet
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          currentUser={currentUser}
          onLogout={onLogout}
        />
      )}
    </div>
  )
}

export default DashboardLayout
