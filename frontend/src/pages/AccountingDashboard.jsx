import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { 
  RefreshCw, AlertCircle
} from '../components/icons'
import api from '../api'
import { Link, useNavigate } from 'react-router-dom'
import SkeletonLoader from '../components/common/SkeletonLoader'
import Money from '../components/cashbook/cred/Money'
import CredViewAll from '../components/cashbook/cred/CredViewAll'
import GooeyMenu from '../components/cashbook/cred/GooeyMenu'

const AccountingDashboard = () => {
  const [data, setData] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { formatCurrency } = useSettings()
  const navigate = useNavigate()

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

  const gooeyOptions = useMemo(() => quickOptions.map(opt => ({
    value: opt.key,
    id: opt.key,
    label: opt.label
  })), [])

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
      const [dashRes, invRes, payRes] = await Promise.all([
        api.get(`dashboard/?start_date=${dateRange.start}&end_date=${dateRange.end}`),
        api.get('invoices/?page_size=5').catch(() => ({ data: { results: [] } })),
        api.get('customer-payments/?page_size=5').catch(() => ({ data: { results: [] } }))
      ])

      setData(dashRes.data)
      setInvoices(invRes.data?.results || invRes.data || [])
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

  // Listen to top-strip refresh event
  useEffect(() => {
    const handleAppRefresh = () => {
      fetchFinancialData()
    }
    window.addEventListener('app:refresh', handleAppRefresh)
    return () => window.removeEventListener('app:refresh', handleAppRefresh)
  }, [fetchFinancialData])

  if (loading && !data) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <SkeletonLoader type="cards" />
        </div>
        <SkeletonLoader type="table" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="error-message" style={{ margin: '2rem 0', padding: '1.5rem', background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border, #E4E4E4)', borderRadius: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger, #DC2626)' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
        <button className="btn btn-primary" onClick={fetchFinancialData} style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    )
  }

  // ── Receivables & Payables Calculations ──
  const totalReceivables = Number(data?.total_receivables || 0)
  const overdueReceivables = Number(data?.overdue_receivables || 0)
  const currentReceivables = Math.max(0, totalReceivables - overdueReceivables)

  const totalPayables = Number(data?.total_payables || 0)
  const overduePayables = Number(data?.overdue_payables || 0)
  const currentPayables = Math.max(0, totalPayables - overduePayables)

  // ── Cash Flow Breakdown ──
  const endingCashBalance = Number(data?.cash_balance || 0)
  const incomingTotal = Number(data?.total_income || 0)
  const outgoingTotal = Number(data?.total_outgoing || 0)
  const initialCashBalance = endingCashBalance - (incomingTotal - outgoingTotal)

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
      <div className="dashboard-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px', position: 'relative', zIndex: 50 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em' }}>
            Dashboard
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Gooey Dropdown Date Filter (Matching Cashbook 1:1) */}
          <div style={{ position: 'relative', zIndex: 60 }}>
            <GooeyMenu
              id="accounting-date-filter"
              value={activeQuick}
              onChange={(val) => {
                const opt = quickOptions.find(o => o.key === val)
                if (opt) applyQuick(opt)
              }}
              options={gooeyOptions}
              width={170}
              pillHeight={38}
              className="case-preserve"
              ariaLabel="Filter Date Range"
            />
          </div>

          <span className="dashboard-filter-date-range cred-tnum" style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)', fontWeight: 400, whiteSpace: 'nowrap' }}>
            {new Date(dateRange.start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – {new Date(dateRange.end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>

          {/* Icon-only refresh button matching Cashbook header strip style */}
          <button 
            type="button"
            className="cred-topstrip-icon-btn" 
            onClick={fetchFinancialData} 
            title="Refresh Data"
            aria-label="Refresh Data"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '1px solid var(--border, #E4E4E4)',
              background: 'var(--bg-card, #FFFFFF)',
              color: 'var(--text, #0A0A0A)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: loading ? 'wait' : 'pointer',
              transition: 'border-color 0.15s, background-color 0.15s'
            }}
          >
            <RefreshCw size={14} strokeWidth={1.8} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* ── ROW 1: MONEY TO COLLECT & MONEY TO PAY (CRED KPI CARDS) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px', marginBottom: '24px' }}>
        
        {/* Card 1: Receivable */}
        <div style={{
          background: 'var(--bg-card, #FFFFFF)',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid var(--border, #E4E4E4)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                RECEIVABLE
              </span>
              <CredViewAll onClick={() => navigate('/invoices')} label="view invoices" />
            </div>

            <div style={{ margin: '12px 0 20px' }}>
              <Money 
                value={totalReceivables} 
                currency="SAR" 
                style={{ fontSize: '32px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em' }} 
              />
            </div>
          </div>

          {/* Clear Breakdown Rows Beneath (No progress bars, no tinted boxes) */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            paddingTop: '16px', 
            borderTop: '1px dotted var(--divider-dotted, #D9D9D9)' 
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current</div>
              <div style={{ marginTop: '4px' }}>
                <Money value={currentReceivables} currency="SAR" style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text, #0A0A0A)' }} />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overdue</div>
              <div style={{ marginTop: '4px' }}>
                <Money 
                  value={overdueReceivables} 
                  currency="SAR" 
                  style={{ fontSize: '15px', fontWeight: 500, color: overdueReceivables > 0 ? 'var(--danger, #DC2626)' : 'var(--text, #0A0A0A)' }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Total Payables */}
        <div style={{
          background: 'var(--bg-card, #FFFFFF)',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid var(--border, #E4E4E4)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                TOTAL PAYABLES
              </span>
              <CredViewAll onClick={() => navigate('/expenses')} label="view bills" />
            </div>

            <div style={{ margin: '12px 0 20px' }}>
              <Money 
                value={totalPayables} 
                currency="SAR" 
                style={{ fontSize: '32px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em' }} 
              />
            </div>
          </div>

          {/* Clear Breakdown Rows Beneath (No progress bars, no tinted boxes) */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            paddingTop: '16px', 
            borderTop: '1px dotted var(--divider-dotted, #D9D9D9)' 
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current</div>
              <div style={{ marginTop: '4px' }}>
                <Money value={currentPayables} currency="SAR" style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text, #0A0A0A)' }} />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overdue</div>
              <div style={{ marginTop: '4px' }}>
                <Money 
                  value={overduePayables} 
                  currency="SAR" 
                  style={{ fontSize: '15px', fontWeight: 500, color: overduePayables > 0 ? 'var(--danger, #DC2626)' : 'var(--text, #0A0A0A)' }} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: CASH FLOW (4 SIMPLE MINIMAL KPI CARDS) ── */}
      <div style={{
        background: 'var(--bg-card, #FFFFFF)',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid var(--border, #E4E4E4)',
        marginBottom: '24px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            CASH FLOW
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Starting Cash */}
          <div style={{
            background: 'var(--bg-subtle, #F5F5F5)',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid var(--border, #E4E4E4)',
            boxSizing: 'border-box'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Cash as on {formatShortDate(dateRange.start)}
            </div>
            <div style={{ marginTop: '10px' }}>
              <Money value={initialCashBalance} currency="SAR" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }} />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '4px', fontWeight: 400 }}>
              Opening Balance
            </div>
          </div>

          {/* Money In */}
          <div style={{
            background: 'var(--bg-subtle, #F5F5F5)',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid var(--border, #E4E4E4)',
            boxSizing: 'border-box'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Incoming (+)
            </div>
            <div style={{ marginTop: '10px' }}>
              <Money value={incomingTotal} currency="SAR" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--success, #16A34A)' }} />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '4px', fontWeight: 400 }}>
              Cash Inflow
            </div>
          </div>

          {/* Money Out */}
          <div style={{
            background: 'var(--bg-subtle, #F5F5F5)',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid var(--border, #E4E4E4)',
            boxSizing: 'border-box'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Outgoing (-)
            </div>
            <div style={{ marginTop: '10px' }}>
              <Money value={outgoingTotal} currency="SAR" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--danger, #DC2626)' }} />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '4px', fontWeight: 400 }}>
              Cash Outflow
            </div>
          </div>

          {/* Net Change / Closing Balance */}
          <div style={{
            background: 'var(--bg-subtle, #F5F5F5)',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid var(--border, #E4E4E4)',
            boxSizing: 'border-box'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Cash as on {formatShortDate(dateRange.end)}
            </div>
            <div style={{ marginTop: '10px' }}>
              <Money value={endingCashBalance} currency="SAR" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }} />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '4px', fontWeight: 400 }}>
              Closing Net Balance
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: RECENT INVOICES & RECENT PAYMENTS RECEIVED ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '20px' }}>
        
        {/* Recent Invoices */}
        <div style={{
          background: 'var(--bg-card, #FFFFFF)',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid var(--border, #E4E4E4)',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
              Recent Invoices
            </span>
            <CredViewAll onClick={() => navigate('/invoices')} label="view all" />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)', textAlign: 'left', background: 'var(--bg-subtle, #F7F7F7)' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)' }}>Invoice #</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)' }}>Customer</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.slice(0, 5).map((inv, idx) => (
                  <tr key={inv.id || idx} style={{ borderBottom: '1px dotted var(--divider-dotted, #D9D9D9)' }}>
                    <td style={{ padding: '12px' }}>
                      <Link 
                        to={`/invoices/${inv.id}/edit`} 
                        style={{ 
                          color: 'var(--text, #0A0A0A)', 
                          textDecoration: 'none', 
                          fontFamily: 'var(--font-mono, "Geist Mono", monospace)', 
                          fontSize: '12px' 
                        }}
                      >
                        {inv.invoice_number || `INV-${inv.id}`}
                      </Link>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text, #0A0A0A)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inv.customer_name || 'Customer'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <Money value={inv.total_amount || 0} currency="SAR" style={{ fontWeight: 500 }} />
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: 400,
                        color: inv.status === 'Paid' ? 'var(--success, #16A34A)' : inv.status === 'Partially Paid' ? '#2563eb' : 'var(--text-muted, #8C8C8C)'
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: inv.status === 'Paid' ? 'var(--success, #16A34A)' : inv.status === 'Partially Paid' ? '#2563eb' : 'var(--text-muted, #8C8C8C)'
                        }} />
                        {inv.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #8C8C8C)' }}>
                      No invoices recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Payments Received */}
        <div style={{
          background: 'var(--bg-card, #FFFFFF)',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid var(--border, #E4E4E4)',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
              Recent Payments Received
            </span>
            <CredViewAll onClick={() => navigate('/payments')} label="view all" />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)', textAlign: 'left', background: 'var(--bg-subtle, #F7F7F7)' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)' }}>Date</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)' }}>Customer</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)' }}>Method</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 5).map((p, idx) => (
                  <tr key={p.id || idx} style={{ borderBottom: '1px dotted var(--divider-dotted, #D9D9D9)' }}>
                    <td style={{ padding: '12px', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>
                      {p.payment_date || p.date ? new Date(p.payment_date || p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 400, color: 'var(--text, #0A0A0A)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.customer_name || p.customer?.name || 'Customer'}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted, #8C8C8C)' }}>
                      {p.payment_method || p.payment_mode || 'Cash'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <Money value={p.amount || 0} currency="SAR" style={{ fontWeight: 500, color: 'var(--success, #16A34A)' }} />
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #8C8C8C)' }}>
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
