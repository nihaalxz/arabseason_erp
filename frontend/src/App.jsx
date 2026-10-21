import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import DashboardLayout from './components/layout/DashboardLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AccountingDashboard from './pages/AccountingDashboard'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Vendors from './pages/Vendors'
import VendorDetail from './pages/VendorDetail'
import JobOrders from './pages/JobOrders'
import Payments from './pages/Payments'
import Expenses from './pages/Expenses'
import PaymentRequests from './pages/PaymentRequests'
import Estimations from './pages/Estimations'
import EstimateBuilder from './pages/EstimateBuilder'
import Reports from './pages/Reports'
import Salary from './pages/Salary'
import Settings from './pages/Settings'
import SearchResults from './pages/SearchResults'
import UserManagement from './pages/UserManagement'
import Cashbook from './pages/Cashbook'
import Banks from './pages/Banks'
import Invoices from './pages/Invoices'
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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setIsAuthenticated(false)
      setLoading(false)
      return
    }

    try {
      const response = await api.get('accounts/check-auth/')
      if (response.data.is_authenticated) {
        setIsAuthenticated(true)
        setCurrentUser(response.data.user)
        try { localStorage.setItem('user', JSON.stringify(response.data.user)) } catch(e) {}
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

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Initializing Secure Session...</p>
      </div>
    )
  }

  // Helper: check if current user can access a module
  const canAccess = (moduleKey) => {
    if (!currentUser) return false
    if (currentUser.role === 'Admin' || currentUser.is_admin || currentUser.is_superuser) return true
    const list = currentUser.access_list || []
    if (['quotations', 'credit_notes', 'delivery_notes'].includes(moduleKey)) {
      return list.includes(moduleKey) || list.includes('invoices')
    }
    if (moduleKey === 'salary') return list.includes('salary') || list.includes('reports')
    if (moduleKey === 'planning') return list.includes('planning') || list.includes('jobs')
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

    <ThemeProvider>
      <WorkspaceProvider>
        <ModuleProvider>
          <Router>
          <Routes>
            <Route 
              path="/login" 
              element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} 
            />
            
            <Route 
              path="/" 
              element={
                isAuthenticated ? (
                  <SettingsProvider>
                    <DashboardLayout onLogout={handleLogout} currentUser={currentUser} />
                  </SettingsProvider>
                ) : (
                  <Navigate to="/login" />
                )
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="accounting" element={canAccess('payments') ? <AccountingDashboard /> : <Navigate to="/" />} />
              <Route path="customers" element={canAccess('customers') ? <Customers /> : <Navigate to="/" />} />
              <Route path="customers/:id" element={canAccess('customers') ? <CustomerDetail /> : <Navigate to="/" />} />
              <Route path="vendors" element={canAccess('vendors') ? <Vendors /> : <Navigate to="/" />} />
              <Route path="vendors/:id" element={canAccess('vendors') ? <VendorDetail /> : <Navigate to="/" />} />
              <Route path="jobs" element={(canAccess('jobs') || canAccess('planning')) ? <JobOrders /> : <Navigate to="/" />} />
              
              {/* Invoices */}
              <Route path="invoices" element={canAccess('invoices') ? <Invoices /> : <Navigate to="/" />} />
              <Route path="invoices/new" element={canAccess('invoices') ? <InvoiceBuilder /> : <Navigate to="/" />} />
              <Route path="invoices/:id/edit" element={canAccess('invoices') ? <InvoiceBuilder /> : <Navigate to="/" />} />

              {/* Quotations */}
              <Route path="quotations" element={canAccess('quotations') ? <Quotations /> : <Navigate to="/" />} />
              <Route path="quotations/new" element={canAccess('quotations') ? <QuotationBuilder /> : <Navigate to="/" />} />
              <Route path="quotations/:id/edit" element={canAccess('quotations') ? <QuotationBuilder /> : <Navigate to="/" />} />

              {/* Credit Notes */}
              <Route path="credit-notes" element={canAccess('credit_notes') ? <CreditNotes /> : <Navigate to="/" />} />
              <Route path="credit-notes/new" element={canAccess('credit_notes') ? <CreditNoteBuilder /> : <Navigate to="/" />} />
              <Route path="credit-notes/:id/edit" element={canAccess('credit_notes') ? <CreditNoteBuilder /> : <Navigate to="/" />} />

              {/* Delivery Notes */}
              <Route path="delivery-notes" element={canAccess('delivery_notes') ? <DeliveryNotes /> : <Navigate to="/" />} />
              <Route path="delivery-notes/new" element={canAccess('delivery_notes') ? <DeliveryNoteBuilder /> : <Navigate to="/" />} />
              <Route path="delivery-notes/:id/edit" element={canAccess('delivery_notes') ? <DeliveryNoteBuilder /> : <Navigate to="/" />} />

              <Route path="payments" element={canAccess('payments') ? <Payments /> : <Navigate to="/" />} />
              <Route path="payment-requests" element={canAccess('payment-requests') ? <PaymentRequests /> : <Navigate to="/" />} />
              <Route path="estimations" element={canAccess('estimations') ? <Estimations /> : <Navigate to="/" />} />
              <Route path="estimations/new" element={canAccess('estimations') ? <EstimateBuilder /> : <Navigate to="/" />} />
              <Route path="estimations/:id/edit" element={canAccess('estimations') ? <EstimateBuilder /> : <Navigate to="/" />} />
              <Route path="expenses" element={canAccess('expenses') ? <Expenses /> : <Navigate to="/" />} />
              <Route path="banks" element={<Navigate to="/cashbook?tab=bank_accounts" replace />} />
              <Route path="cashbook" element={(isAdmin || canAccess('cashbook')) ? <Cashbook /> : <Navigate to="/" replace />} />
              <Route path="reports" element={canAccess('reports') ? <Reports /> : <Navigate to="/" />} />
              <Route path="salary" element={canAccess('salary') ? <Salary /> : <Navigate to="/" />} />
              <Route path="settings" element={canAccess('settings') ? <Settings /> : <Navigate to="/" />} />
              <Route path="recycle-bin" element={(isAdmin || canAccess('cashbook')) ? <Navigate to="/cashbook?tab=recycle_bin" replace /> : <RecycleBin />} />
              <Route path="users" element={isAdmin ? <UserManagement /> : <Navigate to="/" />} />
              <Route path="search" element={<SearchResults />} />
              <Route path="*" element={<Dashboard />} />
            </Route>
          </Routes>
        </Router>
      </ModuleProvider>
    </WorkspaceProvider>
  </ThemeProvider>
)
}

export default App
