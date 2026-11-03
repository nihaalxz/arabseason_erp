import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import DashboardLayout from './components/layout/DashboardLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AccountingDashboard from './pages/AccountingDashboard'
import Customers from './pages/Customers'
import Vendors from './pages/Vendors'
import JobOrders from './pages/JobOrders'
import Expenses from './pages/Expenses'
import Estimations from './pages/Estimations'
import EstimateBuilder from './pages/EstimateBuilder'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import SearchResults from './pages/SearchResults'
import UserManagement from './pages/UserManagement'
import Cashbook from './pages/Cashbook'
import Banks from './pages/Banks'
import Invoices from './pages/Invoices'
import Enquiries from './pages/Enquiries'
import InvoiceBuilder from './pages/InvoiceBuilder'
import Quotations from './pages/Quotations'
import QuotationBuilder from './pages/QuotationBuilder'
import CreditNotes from './pages/CreditNotes'
import CreditNoteBuilder from './pages/CreditNoteBuilder'
import DeliveryNotes from './pages/DeliveryNotes'
import DeliveryNoteBuilder from './pages/DeliveryNoteBuilder'
import RecycleBin from './pages/RecycleBin'
import api from './api'
import { useEffect } from 'react'
import { SettingsProvider } from './contexts/SettingsContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ModuleProvider } from './contexts/ModuleContext'
import { WorkspaceProvider } from './contexts/WorkspaceContext'
import ErrorBoundary from './components/common/ErrorBoundary'
import RouteGuard from './components/common/RouteGuard'
import { canAccessPermission, isUserAdmin } from './constants/permissions'

// Legacy ERP route redirector: preserves full path and query string with replace
const RedirectToAccounting = () => {
  const location = useLocation()
  return <Navigate to={`/accounting${location.pathname}${location.search}`} replace />
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
    const handleRefresh = () => checkAuth()
    window.addEventListener('app:refresh', handleRefresh)
    window.addEventListener('storage', handleRefresh)
    return () => {
      window.removeEventListener('app:refresh', handleRefresh)
      window.removeEventListener('storage', handleRefresh)
    }
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setIsAuthenticated(false)
      setLoading(false)
      return
    }

    try {
      const response = await api.get('accounts/check-auth/', { timeout: 8000 })
      if (response.data.is_authenticated) {
        setIsAuthenticated(true)
        setCurrentUser(response.data.user)
        try { localStorage.setItem('user', JSON.stringify(response.data.user)) } catch(e) {}
      } else {
        setIsAuthenticated(false)
      }
    } catch (error) {
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (username, password) => {
    try {
      const response = await api.post('accounts/token/', { username, password })
      if (response.status === 200) {
        localStorage.setItem('access_token', response.data.access)
        localStorage.setItem('refresh_token', response.data.refresh)
        setIsAuthenticated(true)
        setCurrentUser(response.data.user)
        try { localStorage.setItem('user', JSON.stringify(response.data.user)) } catch(e) {}
        return { success: true }
      }
    } catch (error) {
      const resData = error.response?.data
      let errMsg = ''
      if (resData?.detail) {
        errMsg = resData.detail
      } else if (resData?.non_field_errors) {
        errMsg = Array.isArray(resData.non_field_errors) ? resData.non_field_errors.join(' ') : String(resData.non_field_errors)
      } else if (resData && typeof resData === 'object') {
        const firstKey = Object.keys(resData)[0]
        const firstVal = resData[firstKey]
        if (Array.isArray(firstVal)) {
          errMsg = `${firstKey}: ${firstVal.join(' ')}`
        } else if (typeof firstVal === 'string') {
          errMsg = `${firstKey}: ${firstVal}`
        } else {
          errMsg = 'Please check your login details and try again.'
        }
      } else if (error.message === 'Network Error' || !error.response) {
        errMsg = 'Cannot connect to backend server. Make sure the backend is running.'
      } else {
        errMsg = 'Invalid credentials or server error.'
      }

      if (errMsg.toLowerCase().includes('no active account found')) {
        errMsg = 'No account found with the given credentials. Please verify your username/email and password.'
      }

      return { 
        success: false, 
        message: errMsg
      }
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setIsAuthenticated(false)
    setCurrentUser(null)
  }

  

  // Helper: check if current user can access a module
  const canAccess = (moduleKey) => {
    if (!currentUser) return false
    if (currentUser.role === 'Admin' || currentUser.is_admin || currentUser.is_superuser) return true
    const list = currentUser.access_list || []
    if (['quotations', 'credit_notes', 'delivery_notes'].includes(moduleKey)) {
      return list.includes(moduleKey) || list.includes('invoices')
    }
    if (moduleKey === 'planning') return list.includes('planning') || list.includes('jobs')
    if (moduleKey === 'enquiries') return true
    return list.includes(moduleKey)
  }

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.is_admin || currentUser?.is_superuser

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#0f172a',
        color: '#94a3b8',
        gap: '12px',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid #334155',
          borderTopColor: '#38bdf8',
          borderRadius: '50%',
          animation: 'appSpin 0.8s linear infinite'
        }} />
        <style>{`@keyframes appSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
      <WorkspaceProvider>
        <ModuleProvider>
          <Router>
          <Routes>
            <Route 
              path="/login" 
              element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/" replace />} 
            />
            
            <Route 
              path="/" 
              element={
                isAuthenticated ? (
                  <SettingsProvider>
                    <DashboardLayout onLogout={handleLogout} currentUser={currentUser} />
                  </SettingsProvider>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            >
              <Route index element={
                <RouteGuard permission="dashboard" currentUser={currentUser}>
                  <Dashboard />
                </RouteGuard>
              } />

              {/* Accounting Module Root & Sections */}
              <Route path="accounting" element={
                <RouteGuard moduleId="accounting" permission="accounting" currentUser={currentUser}>
                  <AccountingDashboard />
                </RouteGuard>
              } />
              <Route path="accounting/customers" element={
                <RouteGuard permission="customers" currentUser={currentUser}>
                  <Customers />
                </RouteGuard>
              } />
              <Route path="accounting/vendors" element={
                <RouteGuard permission="vendors" currentUser={currentUser}>
                  <Vendors />
                </RouteGuard>
              } />
              <Route path="accounting/estimations" element={
                <RouteGuard permission="estimations" currentUser={currentUser}>
                  <Estimations />
                </RouteGuard>
              } />
              <Route path="accounting/estimations/new" element={
                <RouteGuard permission="estimations" currentUser={currentUser}>
                  <EstimateBuilder />
                </RouteGuard>
              } />
              <Route path="accounting/estimations/:id/edit" element={
                <RouteGuard permission="estimations" currentUser={currentUser}>
                  <EstimateBuilder />
                </RouteGuard>
              } />
              <Route path="accounting/quotations" element={
                <RouteGuard permission="quotations" currentUser={currentUser}>
                  <Quotations />
                </RouteGuard>
              } />
              <Route path="accounting/quotations/new" element={
                <RouteGuard permission="quotations" currentUser={currentUser}>
                  <QuotationBuilder />
                </RouteGuard>
              } />
              <Route path="accounting/quotations/:id/edit" element={
                <RouteGuard permission="quotations" currentUser={currentUser}>
                  <QuotationBuilder />
                </RouteGuard>
              } />
              <Route path="accounting/banks" element={<Navigate to="/cashbook?tab=bank_accounts" replace />} />
              <Route path="accounting/settings" element={
                <RouteGuard permission="accounting_settings" currentUser={currentUser}>
                  <Settings mode="accounting" />
                </RouteGuard>
              } />

              {/* ERP Operations Routes */}
              <Route path="enquiries" element={
                <RouteGuard permission="enquiries" currentUser={currentUser}>
                  <Enquiries currentUser={currentUser} />
                </RouteGuard>
              } />
              <Route path="jobs" element={
                <RouteGuard permission={['jobs', 'planning']} currentUser={currentUser}>
                  <JobOrders currentUser={currentUser} />
                </RouteGuard>
              } />

              {/* Invoices */}
              <Route path="invoices" element={
                <RouteGuard permission="invoices" currentUser={currentUser}>
                  <Invoices />
                </RouteGuard>
              } />
              <Route path="invoices/new" element={
                <RouteGuard permission="invoices" currentUser={currentUser}>
                  <InvoiceBuilder />
                </RouteGuard>
              } />
              <Route path="invoices/:id/edit" element={
                <RouteGuard permission="invoices" currentUser={currentUser}>
                  <InvoiceBuilder />
                </RouteGuard>
              } />

              {/* Credit Notes */}
              <Route path="credit-notes" element={
                <RouteGuard permission="credit_notes" currentUser={currentUser}>
                  <CreditNotes />
                </RouteGuard>
              } />
              <Route path="credit-notes/new" element={
                <RouteGuard permission="credit_notes" currentUser={currentUser}>
                  <CreditNoteBuilder />
                </RouteGuard>
              } />
              <Route path="credit-notes/:id/edit" element={
                <RouteGuard permission="credit_notes" currentUser={currentUser}>
                  <CreditNoteBuilder />
                </RouteGuard>
              } />

              {/* Delivery Notes */}
              <Route path="delivery-notes" element={
                <RouteGuard permission="delivery_notes" currentUser={currentUser}>
                  <DeliveryNotes />
                </RouteGuard>
              } />
              <Route path="delivery-notes/new" element={
                <RouteGuard permission="delivery_notes" currentUser={currentUser}>
                  <DeliveryNoteBuilder />
                </RouteGuard>
              } />
              <Route path="delivery-notes/:id/edit" element={
                <RouteGuard permission="delivery_notes" currentUser={currentUser}>
                  <DeliveryNoteBuilder />
                </RouteGuard>
              } />

              {/* Cashbook Module (Admin only) */}
              <Route path="cashbook" element={
                <RouteGuard adminOnly currentUser={currentUser}>
                  <Cashbook currentUser={currentUser} />
                </RouteGuard>
              } />

              {/* Financial Reports & Payroll */}
              <Route path="reports" element={
                <RouteGuard permission="reports" currentUser={currentUser}>
                  <Reports />
                </RouteGuard>
              } />

              {/* System & Administration */}
              <Route path="settings" element={
                <RouteGuard permission="settings" currentUser={currentUser}>
                  <Settings mode="erp" />
                </RouteGuard>
              } />
              <Route path="users" element={
                <RouteGuard adminOnly currentUser={currentUser}>
                  <UserManagement />
                </RouteGuard>
              } />
              <Route path="search" element={
                <RouteGuard currentUser={currentUser}>
                  <SearchResults />
                </RouteGuard>
              } />
              <Route path="recycle-bin" element={
                <RouteGuard adminOnly currentUser={currentUser}>
                  <Navigate to="/cashbook?tab=recycle_bin" replace />
                </RouteGuard>
              } />

              {/* Legacy ERP Route Redirects to Accounting */}
              <Route path="customers" element={<RedirectToAccounting />} />
              <Route path="vendors" element={<RedirectToAccounting />} />
              <Route path="quotations" element={<RedirectToAccounting />} />
              <Route path="quotations/new" element={<RedirectToAccounting />} />
              <Route path="quotations/:id/edit" element={<RedirectToAccounting />} />
              <Route path="estimations" element={<RedirectToAccounting />} />
              <Route path="estimations/new" element={<RedirectToAccounting />} />
              <Route path="estimations/:id/edit" element={<RedirectToAccounting />} />
              <Route path="payments" element={<Navigate to="/accounting" replace />} />
              <Route path="payment-requests" element={<Navigate to="/accounting" replace />} />
              <Route path="expenses" element={<Navigate to="/accounting" replace />} />
              <Route path="banks" element={<Navigate to="/cashbook?tab=bank_accounts" replace />} />

              {/* Wildcard Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Router>
      </ModuleProvider>
    </WorkspaceProvider>
  </ThemeProvider>
    </ErrorBoundary>
)
}

export default App
