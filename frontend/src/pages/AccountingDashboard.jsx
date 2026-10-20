import { useState, useEffect, useCallback } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { 
  CreditCard, Receipt, RefreshCw, AlertCircle, 
  Landmark, FileText, ChevronDown, Filter, Info,
  ArrowRight, RotateCcw
} from '../components/icons'
import api from '../api'
import { Link } from 'react-router-dom'
import SkeletonLoader from '../components/common/SkeletonLoader'

const AccountingDashboard = () => {
  const [data, setData] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [banks, setBanks] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showReceivableInfo, setShowReceivableInfo] = useState(false)
  const { formatCurrency } = useSettings()

  // Date range state - default last 30 days
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0]
  const [dateRange, setDateRange] = useState({ start: thirtyDaysAgo, end: today })
  const [activeQuick, setActiveQuick] = useState('30d')

  const quickOptions = [
    { label: 'Today', key: 'today', days: 0 },
    { label: 'Last 7 Days', key: '7d', days: 6 },
    { label: 'Last 14 Days', key: '14d', days: 13 },
    { label: 'Last 30 Days', key: '30d', days: 29 },
    { label: 'This Month', key: 'month', days: null },
  ]

  const applyQuick = (opt) => {
    const endD = new Date()
    let startD
    if (opt.key === 'month') {
      startD = new Date(endD.getFullYear(), endD.getMonth(), 1)
    } else {
      startD = new Date(Date.now() - opt.days * 86400000)
    }
    setDateRange({ start: startD.toISOString().split('T')[0], end: endD.toISOString().split('T')[0] })
    setActiveQuick(opt.key)
  }

  const fetchFinancialData = useCallback(async () => {
    try {
      setLoading(true)
      const [dashRes, invRes, bankRes, payRes] = await Promise.all([
        api.get(`dashboard/?start_date=${dateRange.start}&end_date=${dateRange.end}`),
        api.get('invoices/?page_size=5').catch(() => ({ data: { results: [] } })),
        api.get('banks/').catch(() => ({ data: [] })),
        api.get('customer-payments/?page_size=5').catch(() => ({ data: { results: [] } }))
      ])

      setData(dashRes.data)
      setInvoices(invRes.data?.results || invRes.data || [])
      setBanks(Array.isArray(bankRes.data) ? bankRes.data : (bankRes.data?.results || []))
      setPayments(payRes.data?.results || payRes.data || [])
      setError('')
    } catch (err) {
      console.error('Error fetching accounting dashboard data:', err)
      setError('Failed to fetch accounting financial data. Network error or server unreachable.')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchFinancialData()
  }, [fetchFinancialData])

  if (loading) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <SkeletonLoader type="cards" />
        </div>
        <SkeletonLoader type="table" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-message" style={{ margin: '2rem', padding: '1.5rem' }}>
        <AlertCircle size={20} /> {error}
        <button className="btn btn-primary" onClick={fetchFinancialData} style={{ marginLeft: '1rem' }}>
          Retry
        </button>
      </div>
    )
  }

  // ── Receivables & Payables Calculations ──
  const totalReceivables = Number(data?.total_receivables || 0)
  const overdueReceivables = Number(data?.overdue_receivables || 0)
  const currentReceivables = Math.max(0, totalReceivables - overdueReceivables)
  const currentReceivablesPct = totalReceivables > 0 ? Math.round((currentReceivables / totalReceivables) * 100) : 100
  const overdueReceivablesPct = totalReceivables > 0 ? 100 - currentReceivablesPct : 0

  const totalPayables = Number(data?.total_payables || 0)
  const overduePayables = Number(data?.overdue_payables || 0)
  const currentPayables = Math.max(0, totalPayables - overduePayables)
  const currentPayablesPct = totalPayables > 0 ? Math.round((currentPayables / totalPayables) * 100) : 100
  const overduePayablesPct = totalPayables > 0 ? 100 - currentPayablesPct : 0

  // ── Cash Flow Breakdown ──
  const endingCashBalance = Number(data?.cash_balance || 0)
  const incomingTotal = Number(data?.total_income || 0)
  const outgoingTotal = Number(data?.total_outgoing || 0)
  const initialCashBalance = endingCashBalance - (incomingTotal - outgoingTotal)
  const netProfit = incomingTotal - outgoingTotal

  // Total Bank reserves
  const totalBankReserves = banks.reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0)

  // Helper to format short date DD/MM/YY
  const formatShortDate = (d) => {
    if (!d) return ''
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return ''
    const day = String(dt.getDate()).padStart(2, '0')
    const month = String(dt.getMonth() + 1).padStart(2, '0')
    const year = String(dt.getFullYear()).slice(-2)
    return `${day}/${month}/${year}`
  }

  return (
    <div className="dashboard-page erp-page-container erp-page-transition" style={{ maxWidth: '1600px', margin: '0 auto', width: '100%', minWidth: 0, paddingBottom: '3rem' }}>
      
      {/* ── TOP HEADER / FILTER BAR ── */}
      <div className="dashboard-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main, #0f172a)', letterSpacing: '-0.02em' }}>
            Accounting & Books Dashboard
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
            Track unpaid invoices, bills, cash flow, and bank balances
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Link to ERP Dashboard */}
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: '600',
              background: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              textDecoration: 'none',
              transition: 'all 0.15s ease'
            }}
            title="Open ERP Dashboard"
          >
            <span>ERP Dashboard</span>
            <ArrowRight size={13} />
          </Link>

          {/* Consolidated Filter Dropdown */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <Filter size={14} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted, #8B8FA8)', pointerEvents: 'none' }} />
            <select
              value={activeQuick}
              onChange={(e) => {
                const opt = quickOptions.find(o => o.key === e.target.value)
                if (opt) applyQuick(opt)
              }}
              aria-label="Filter Date Range"
              className="dashboard-filter-select"
              style={{
                paddingLeft: '32px',
                paddingRight: '32px',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                borderRadius: '999px',
                background: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              {quickOptions.map(opt => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '12px', color: 'var(--text-muted, #8B8FA8)', pointerEvents: 'none' }} />
          </div>

          <span className="dashboard-filter-date-range" style={{ fontSize: '0.78rem', color: 'var(--text-muted, #8B8FA8)', fontWeight: '500' }}>
            {new Date(dateRange.start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – {new Date(dateRange.end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>

          <button 
            className="btn btn-secondary dashboard-refresh-btn" 
            onClick={fetchFinancialData} 
            title="Refresh Data"
            style={{ borderRadius: '999px', padding: '0.45rem 0.95rem' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── ROW 1: MONEY TO COLLECT & MONEY TO PAY (REFERENCE DESIGN CARDS) ── */}
      <div className="dashboard-row-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        
        {/* Card 1: Receivable */}
        <div style={{
          background: 'linear-gradient(135deg, #fff9f0 0%, #fef2f2 40%, #eef2ff 100%)',
          borderRadius: '20px',
          padding: '1.4rem 1.6rem',
          border: '1px solid rgba(224, 231, 255, 0.8)',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', position: 'relative' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  RECEIVABLE
                </span>
                <div 
                  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                  onMouseEnter={() => setShowReceivableInfo(true)}
                  onMouseLeave={() => setShowReceivableInfo(false)}
                >
                  <button
                    type="button"
                    onClick={() => setShowReceivableInfo(prev => !prev)}
                    title="Total unpaid invoice amount"
                    style={{
                      background: 'none', border: 'none', padding: '2px', cursor: 'pointer',
                      color: showReceivableInfo ? '#4f46e5' : '#94a3b8',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%'
                    }}
                    aria-label="Receivable information"
                  >
                    <Info size={13} />
                  </button>
                  {showReceivableInfo && (
                    <div style={{
                      position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
                      zIndex: 50, background: '#1e293b', color: '#ffffff', fontSize: '0.72rem', fontWeight: '500',
                      padding: '0.35rem 0.65rem', borderRadius: '6px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                      whiteSpace: 'nowrap', pointerEvents: 'none'
                    }}>
                      Money customers owe you
                    </div>
                  )}
                </div>
              </div>
              <Link 
                to="/invoices" 
                style={{
                  background: '#ffffff',
                  color: '#6366f1',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Total Unpaid Invoices
              </Link>
            </div>

            <div style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', margin: '0.45rem 0 0.85rem', letterSpacing: '-0.03em' }}>
              {formatCurrency(totalReceivables)}
            </div>

            {/* Solid Vibrant Indigo Bar */}
            <div style={{
              height: '6px',
              borderRadius: '999px',
              background: 'linear-gradient(90deg, #4f46e5 0%, #6366f1 100%)',
              marginBottom: '1.15rem',
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)'
            }} />
          </div>

          {/* 2 Clear Breakdown Floating Boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div style={{
              background: '#ffffff',
              padding: '0.75rem 1.1rem',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.9)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#6366f1' }}>Current</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginTop: '2px', letterSpacing: '-0.02em' }}>
                {formatCurrency(currentReceivables)}
              </div>
            </div>
            <div style={{
              background: '#ffffff',
              padding: '0.75rem 1.1rem',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.9)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
              textAlign: 'right'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#ea580c' }}>Overdue</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginTop: '2px', letterSpacing: '-0.02em' }}>
                {formatCurrency(overdueReceivables)}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Total Payables */}
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fff1f2 50%, #fdf2f8 100%)',
          borderRadius: '20px',
          padding: '1.4rem 1.6rem',
          border: '1px solid rgba(254, 205, 211, 0.6)',
          boxShadow: '0 4px 20px rgba(244, 63, 94, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                TOTAL PAYABLES
              </span>
              <Link 
                to="/expenses" 
                style={{
                  background: '#ffffff',
                  color: '#6366f1',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Total Unpaid Bills
              </Link>
            </div>

            <div style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', margin: '0.45rem 0 0.85rem', letterSpacing: '-0.03em' }}>
              {formatCurrency(totalPayables)}
            </div>

            {/* Solid Vibrant Indigo Bar */}
            <div style={{
              height: '6px',
              borderRadius: '999px',
              background: 'linear-gradient(90deg, #4f46e5 0%, #6366f1 100%)',
              marginBottom: '1.15rem',
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)'
            }} />
          </div>

          {/* 2 Clear Breakdown Floating Boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div style={{
              background: '#ffffff',
              padding: '0.75rem 1.1rem',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.9)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#6366f1' }}>Current</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginTop: '2px', letterSpacing: '-0.02em' }}>
                {formatCurrency(currentPayables)}
              </div>
            </div>
            <div style={{
              background: '#ffffff',
              padding: '0.75rem 1.1rem',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.9)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
              textAlign: 'right'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#ea580c' }}>Overdue</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginTop: '2px', letterSpacing: '-0.02em' }}>
                {formatCurrency(overduePayables)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: CASH FLOW (REFERENCE DESIGN 4 FLOATING CARDS) ── */}
      <div className="glass-panel" style={{
        background: '#ffffff',
        borderRadius: '20px',
        padding: '1.35rem 1.6rem',
        border: '1px solid #e2e8f0',
        marginBottom: '1.25rem',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.15rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            CASH FLOW
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>
            Period Liquidity & Balances
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {/* Starting Cash */}
          <div style={{
            background: 'linear-gradient(135deg, #fff7ed 0%, #f5f3ff 100%)',
            padding: '1.25rem 1.35rem',
            borderRadius: '18px',
            border: '1px solid rgba(237, 233, 254, 0.8)',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.03)'
          }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              color: '#4f46e5',
              background: '#ffffff',
              padding: '3px 10px',
              borderRadius: '999px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'inline-block'
            }}>
              Cash as on {formatShortDate(dateRange.start)}
            </span>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#0f172a', marginTop: '0.55rem', letterSpacing: '-0.02em' }}>
              {formatCurrency(initialCashBalance)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontWeight: '500' }}>
              Opening Period Balance
            </div>
          </div>

          {/* Money In */}
          <div style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
            padding: '1.25rem 1.35rem',
            borderRadius: '18px',
            border: '1px solid rgba(167, 243, 208, 0.7)',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.03)'
          }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              color: '#059669',
              background: '#ffffff',
              padding: '3px 10px',
              borderRadius: '999px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'inline-block'
            }}>
              Incoming (+)
            </span>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#059669', marginTop: '0.55rem', letterSpacing: '-0.02em' }}>
              {formatCurrency(incomingTotal)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontWeight: '500' }}>
              Cash Inflow / Receipts
            </div>
          </div>

          {/* Money Out */}
          <div style={{
            background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
            padding: '1.25rem 1.35rem',
            borderRadius: '18px',
            border: '1px solid rgba(254, 205, 211, 0.7)',
            boxShadow: '0 2px 8px rgba(244, 63, 94, 0.03)'
          }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              color: '#e11d48',
              background: '#ffffff',
              padding: '3px 10px',
              borderRadius: '999px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'inline-block'
            }}>
              Outgoing (-)
            </span>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#e11d48', marginTop: '0.55rem', letterSpacing: '-0.02em' }}>
              {formatCurrency(outgoingTotal)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontWeight: '500' }}>
              Cash Outflow / Payments
            </div>
          </div>

          {/* Net Change / Closing Balance */}
          <div style={{
            background: 'linear-gradient(135deg, #f0f4ff 0%, #eef2ff 100%)',
            padding: '1.25rem 1.35rem',
            borderRadius: '18px',
            border: '1px solid rgba(224, 231, 255, 0.8)',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.03)'
          }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              color: '#4f46e5',
              background: '#ffffff',
              padding: '3px 10px',
              borderRadius: '999px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'inline-block'
            }}>
              Cash as on {formatShortDate(dateRange.end)}
            </span>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#4f46e5', marginTop: '0.55rem', letterSpacing: '-0.02em' }}>
              {formatCurrency(initialCashBalance + incomingTotal - outgoingTotal)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontWeight: '500' }}>
              Closing Net Balance (=)
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: BANK ACCOUNTS ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        
        {/* Bank Accounts */}
        <div className="glass-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Landmark size={18} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>
                Bank Accounts
              </span>
            </div>
            <Link to="/banks" style={{ fontSize: '0.75rem', fontWeight: '700', color: '#2563eb', textDecoration: 'none' }}>
              Manage Banks →
            </Link>
          </div>

          <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #edf0f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Total in Banks</div>
              <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                {formatCurrency(totalBankReserves)}
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#059669', background: '#ecfdf5', padding: '4px 8px', borderRadius: '6px' }}>
              {banks.length} Accounts
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
            {banks.slice(0, 6).map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.75rem', borderRadius: '6px', background: '#ffffff', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#0f172a' }}>{b.name || b.bank_name}</div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{b.account_number || b.iban || 'Account'}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a' }}>
                  {formatCurrency(b.balance || 0)}
                </div>
              </div>
            ))}
            {banks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                No bank accounts added yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 4: RECENT INVOICES & PAYMENTS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '1.25rem' }}>
        
        {/* Recent Invoices */}
        <div className="glass-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>
              Recent Invoices
            </div>
            <Link to="/invoices" style={{ fontSize: '0.75rem', fontWeight: '700', color: '#2563eb', textDecoration: 'none' }}>
              View All →
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #edf0f5', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '0.45rem 0', fontWeight: '600' }}>Invoice #</th>
                  <th style={{ padding: '0.45rem 0.5rem', fontWeight: '600' }}>Customer</th>
                  <th style={{ padding: '0.45rem 0.5rem', fontWeight: '600', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '0.45rem 0', fontWeight: '600', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.slice(0, 5).map((inv, idx) => (
                  <tr key={inv.id || idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '0.55rem 0', fontWeight: '700', color: '#0f172a' }}>
                      <Link to={`/invoices/${inv.id}/edit`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                        {inv.invoice_number || `INV-${inv.id}`}
                      </Link>
                    </td>
                    <td style={{ padding: '0.55rem 0.5rem', color: '#475569', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inv.customer_name || 'Customer'}
                    </td>
                    <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                      {formatCurrency(inv.total_amount || 0)}
                    </td>
                    <td style={{ padding: '0.55rem 0', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 7px',
                        borderRadius: '999px',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        background: inv.status === 'Paid' ? '#ecfdf5' : inv.status === 'Partially Paid' ? '#eff6ff' : '#fef2f2',
                        color: inv.status === 'Paid' ? '#059669' : inv.status === 'Partially Paid' ? '#2563eb' : '#dc2626'
                      }}>
                        {inv.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                      No invoices recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Payments */}
        <div className="glass-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>
                Recent Payments Received
              </div>
            </div>
            <Link to="/payments" style={{ fontSize: '0.75rem', fontWeight: '700', color: '#2563eb', textDecoration: 'none' }}>
              View All →
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #edf0f5', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '0.45rem 0', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '0.45rem 0.5rem', fontWeight: '600' }}>Customer</th>
                  <th style={{ padding: '0.45rem 0.5rem', fontWeight: '600' }}>Method</th>
                  <th style={{ padding: '0.45rem 0', fontWeight: '600', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 5).map((p, idx) => (
                  <tr key={p.id || idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '0.55rem 0', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {p.payment_date || p.date ? new Date(p.payment_date || p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                    <td style={{ padding: '0.55rem 0.5rem', fontWeight: '600', color: '#0f172a', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.customer_name || p.customer?.name || 'Customer'}
                    </td>
                    <td style={{ padding: '0.55rem 0.5rem', color: '#64748b' }}>
                      <span style={{ fontSize: '0.72rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                        {p.payment_method || p.payment_mode || 'Bank'}
                      </span>
                    </td>
                    <td style={{ padding: '0.55rem 0', textAlign: 'right', fontWeight: '800', color: '#059669' }}>
                      +{formatCurrency(p.amount || 0)}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                      No payments received yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  )
}

export default AccountingDashboard
