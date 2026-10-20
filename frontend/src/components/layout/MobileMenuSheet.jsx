import React, { useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { 
  X, Building2, Receipt, BookOpen, Users, FileSpreadsheet, 
  Briefcase, Layers, CreditCard, ShieldCheck, FileBarChart, 
  Banknote, Settings, UserCog, LogOut, Check, ChevronRight, Landmark, FileText, Trash2
} from '../icons'
import { Truck, RotateCcw } from 'lucide-react'
import { useModule } from '../../contexts/ModuleContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'

const MobileMenuSheet = ({ isOpen, onClose, currentUser, onLogout }) => {
  const { activeModule, setActiveModule, MODULES } = useModule()
  const { isFeatureVisible, isMinimalist } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.is_admin || currentUser?.is_superuser

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleModuleSwitch = (modKey) => {
    const mod = MODULES[modKey]
    if (!mod) return
    setActiveModule(mod.id)
    onClose()
    navigate(mod.defaultRoute)
  }

  const handleNavigate = (path) => {
    onClose()
    navigate(path)
  }

  const displayName = currentUser?.first_name 
    ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() 
    : (currentUser?.username ? (currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1)) : 'User')

  const displayRole = isAdmin ? 'Super User' : (currentUser?.role || 'Staff User')

  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'AS'

  return (
    <div className="mobile-sheet-portal">
      {/* Backdrop */}
      <div 
        className="mobile-sheet-backdrop" 
        onClick={onClose}
        aria-label="Close menu overlay"
      />

      {/* Slide-up Container */}
      <div className="mobile-sheet-container" role="dialog" aria-modal="true">
        {/* Drag handle */}
        <div className="mobile-sheet-handle-bar">
          <div className="mobile-sheet-handle" />
        </div>

        {/* Header */}
        <div className="mobile-sheet-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
              Menu & Modules
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
              Arab Season Enterprise Suite
            </p>
          </div>
          <button 
            type="button" 
            className="mobile-sheet-close-btn" 
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mobile-sheet-body">


          {/* Quick Navigation Items */}
          <div className="mobile-nav-links-section">
            <div className="mobile-section-label">ALL PAGES & WORKSPACES</div>
            <div className="mobile-links-list">
              {/* Cashbook link */}
              {isFeatureVisible('cashbook') && (
                <button type="button" className="mobile-link-item" onClick={() => handleNavigate('/cashbook')}>
                  <BookOpen size={18} className="mobile-link-icon" style={{ color: '#4f46e5' }} />
                  <span>Cashbook & Vault</span>
                  <ChevronRight size={16} className="mobile-link-arrow" />
                </button>
              )}

              {/* Common links */}
              <button type="button" className="mobile-link-item" onClick={() => handleNavigate('/settings')}>
                <Settings size={18} className="mobile-link-icon" />
                <span>System Settings</span>
                <ChevronRight size={16} className="mobile-link-arrow" />
              </button>

              <button type="button" className="mobile-link-item" onClick={() => handleNavigate('/cashbook?tab=recycle_bin')}>
                <Trash2 size={18} className="mobile-link-icon" style={{ color: '#dc2626' }} />
                <span>Recycle Bin</span>
                <ChevronRight size={16} className="mobile-link-arrow" />
              </button>

              {isAdmin && (
                <button type="button" className="mobile-link-item" onClick={() => handleNavigate('/users')}>
                  <UserCog size={18} className="mobile-link-icon" />
                  <span>User Management</span>
                  <ChevronRight size={16} className="mobile-link-arrow" />
                </button>
              )}
            </div>
          </div>

          {/* User Profile Summary & Logout */}
          <div className="mobile-sheet-user-footer">
            <div className="mobile-user-info">
              <div className="mobile-user-avatar">{initials}</div>
              <div>
                <div className="mobile-user-name">{displayName}</div>
                <div className="mobile-user-role">{displayRole}</div>
              </div>
            </div>

            <button
              type="button"
              className="mobile-logout-btn"
              onClick={() => {
                onClose()
                if (onLogout) onLogout()
              }}
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MobileMenuSheet
