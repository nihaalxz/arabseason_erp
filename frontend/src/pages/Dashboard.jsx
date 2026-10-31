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

const Dashboard = () => {
  const [data, setData] = useState(null)
  const [quotations, setQuotations] = useState([])
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

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      const [dashRes, quoteRes] = await Promise.all([
        api.get(`dashboard/?start_date=${dateRange.start}&end_date=${dateRange.end}`),
        api.get('quotations/?page_size=5').catch(() => ({ data: { results: [] } }))
      ])

      setData(dashRes.data)
      setQuotations(quoteRes.data?.results || quoteRes.data || [])
      setError('')
    } catch (err) {
      console.error('Error fetching ERP dashboard data:', err)
      if (err.response) {
        setError(`Failed to fetch dashboard data: ${err.response.status} ${err.response.data?.detail || ''}`)
      } else {
        setError('Failed to fetch dashboard data. Network error or server unreachable.')
      }
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // Listen to top-strip refresh event
  useEffect(() => {
    const handleAppRefresh = () => {
      fetchDashboardData()
    }
    window.addEventListener('app:refresh', handleAppRefresh)
    return () => window.removeEventListener('app:refresh', handleAppRefresh)
  }, [fetchDashboardData])

  if (loading && !data) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '2rem' }}>
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
        <button className="btn btn-primary" onClick={fetchDashboardData} style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    )
  }

  // ── Operations Metrics ──
  const pendingJobs = data?.jobs_by_status?.Pending || 0
  const inProgressJobs = data?.jobs_by_status?.['In Progress'] || 0
  const completedJobs = data?.jobs_by_status?.Completed || 0
  const cancelledJobs = data?.jobs_by_status?.Cancelled || 0
  const totalTrackedJobs = pendingJobs + inProgressJobs + completedJobs + cancelledJobs
  const completionRate = totalTrackedJobs > 0 ? Math.round((completedJobs / totalTrackedJobs) * 100) : 0

  // Active jobs valuation
  const recentJobsList = data?.recent_jobs || []
  const activeJobsValuation = recentJobsList.reduce((sum, j) => sum + (parseFloat(j.total_amount) || 0), 0)

  // Quotations calculations
  const totalQuotesValuation = quotations.reduce((sum, q) => sum + (parseFloat(q.total_amount) || 0), 0)
  const acceptedQuotes = quotations.filter(q => q.status === 'Accepted' || q.status === 'Converted to Invoice')
  const pendingQuotes = quotations.filter(q => q.status !== 'Accepted' && q.status !== 'Converted to Invoice')

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
              id="erp-date-filter"
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

          {/* Icon-only refresh button */}
          <button 
            type="button"
            className="cred-topstrip-icon-btn" 
            onClick={fetchDashboardData} 
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

      {/* ── ROW 1: ACTIVE JOBS & QUOTATIONS (CRED KPI CARDS) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px', marginBottom: '24px' }}>
        
        {/* Card 1: Active Jobs */}
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
                ACTIVE JOBS
              </span>
              <CredViewAll onClick={() => navigate('/jobs')} label="view jobs" />
            </div>

            <div style={{ margin: '12px 0 20px' }}>
              <Money 
                value={activeJobsValuation} 
                currency="SAR" 
                style={{ fontSize: '32px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em' }} 
              />
            </div>
          </div>

          {/* Breakdown Rows (no progress bars, no tinted boxes) */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            paddingTop: '16px', 
            borderTop: '1px dotted var(--divider-dotted, #D9D9D9)' 
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>In Progress</div>
              <div style={{ marginTop: '4px', fontSize: '15px', fontWeight: 500, color: 'var(--text, #0A0A0A)' }}>
                <span className="cred-tnum">{inProgressJobs}</span> <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>jobs</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pending Start</div>
              <div style={{ marginTop: '4px', fontSize: '15px', fontWeight: 500, color: 'var(--text, #0A0A0A)' }}>
                <span className="cred-tnum">{pendingJobs}</span> <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>jobs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Quotations & Proposals */}
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
                QUOTATIONS & PROPOSALS
              </span>
              <CredViewAll onClick={() => navigate('/accounting/quotations')} label="view quotations" />
            </div>

            <div style={{ margin: '12px 0 20px' }}>
              <Money 
                value={totalQuotesValuation} 
                currency="SAR" 
                style={{ fontSize: '32px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em' }} 
              />
            </div>
          </div>

          {/* Breakdown Rows (no progress bars, no tinted boxes) */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            paddingTop: '16px', 
            borderTop: '1px dotted var(--divider-dotted, #D9D9D9)' 
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Accepted</div>
              <div style={{ marginTop: '4px', fontSize: '15px', fontWeight: 500, color: 'var(--success, #16A34A)' }}>
                <span className="cred-tnum">{acceptedQuotes.length}</span> <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>quotes</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sent to Client</div>
              <div style={{ marginTop: '4px', fontSize: '15px', fontWeight: 500, color: 'var(--text, #0A0A0A)' }}>
                <span className="cred-tnum">{pendingQuotes.length}</span> <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>quotes</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── ROW 2: JOB STATUS OVERVIEW (4 PLAIN MINIMAL CARDS) ── */}
      <div style={{
        background: 'var(--bg-card, #FFFFFF)',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid var(--border, #E4E4E4)',
        marginBottom: '24px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              JOB STATUS OVERVIEW
            </span>
          </div>
          <CredViewAll onClick={() => navigate('/jobs?tab=planning')} label="project planning" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Tile 1: Pending */}
          <div style={{
            background: 'var(--bg-subtle, #F5F5F5)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid var(--border, #E4E4E4)',
            boxSizing: 'border-box'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Pending
            </div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text, #0A0A0A)', marginTop: '10px' }}>
              <span className="cred-tnum">{pendingJobs}</span> <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>jobs</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '4px', fontWeight: 400 }}>
              Waiting to start
            </div>
          </div>

          {/* Tile 2: In Progress */}
          <div style={{
            background: 'var(--bg-subtle, #F5F5F5)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid var(--border, #E4E4E4)',
            boxSizing: 'border-box'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              In Progress
            </div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text, #0A0A0A)', marginTop: '10px' }}>
              <span className="cred-tnum">{inProgressJobs}</span> <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>jobs</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '4px', fontWeight: 400 }}>
              Currently in work
            </div>
          </div>

          {/* Tile 3: Completed */}
          <div style={{
            background: 'var(--bg-subtle, #F5F5F5)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid var(--border, #E4E4E4)',
            boxSizing: 'border-box'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Completed
            </div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--success, #16A34A)', marginTop: '10px' }}>
              <span className="cred-tnum">{completedJobs}</span> <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>jobs</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '4px', fontWeight: 400 }}>
              Finished and delivered
            </div>
          </div>

          {/* Tile 4: Completion Rate */}
          <div style={{
            background: 'var(--bg-subtle, #F5F5F5)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid var(--border, #E4E4E4)',
            boxSizing: 'border-box'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Completion Rate
            </div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text, #0A0A0A)', marginTop: '10px' }}>
              <span className="cred-tnum">{completionRate}%</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '4px', fontWeight: 400 }}>
              {completedJobs} of {totalTrackedJobs} completed
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: CUSTOMERS & VENDORS ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          background: 'var(--bg-card, #FFFFFF)',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid var(--border, #E4E4E4)',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
              Customers & Vendors
            </span>
            <CredViewAll onClick={() => navigate('/accounting/customers')} label="view all" />
          </div>

          <div style={{ 
            background: 'var(--bg-subtle, #F5F5F5)', 
            padding: '16px 20px', 
            borderRadius: '16px', 
            border: '1px solid var(--border, #E4E4E4)', 
            marginBottom: '16px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Customers</div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text, #0A0A0A)', marginTop: '4px' }}>
                <span className="cred-tnum">{data?.total_customers || 0}</span> <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>Registered Clients</span>
              </div>
            </div>
          </div>

          {/* Simple Link Rows */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '14px 18px', 
              background: 'var(--bg-card, #FFFFFF)', 
              border: '1px solid var(--border, #E4E4E4)', 
              borderRadius: '14px' 
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text, #0A0A0A)' }}>Customer Accounts</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>Client details, phone numbers, and past orders</div>
              </div>
              <CredViewAll onClick={() => navigate('/accounting/customers')} label="open" />
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '14px 18px', 
              background: 'var(--bg-card, #FFFFFF)', 
              border: '1px solid var(--border, #E4E4E4)', 
              borderRadius: '14px' 
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text, #0A0A0A)' }}>Vendors & Suppliers</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>Material suppliers and service contractors</div>
              </div>
              <CredViewAll onClick={() => navigate('/accounting/vendors')} label="open" />
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 4: RECENT JOBS & RECENT QUOTATIONS (2 Clear Tables) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '20px' }}>
        
        {/* Table 1: Recent Jobs */}
        <div style={{
          background: 'var(--bg-card, #FFFFFF)',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid var(--border, #E4E4E4)',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
              Recent Jobs
            </span>
            <CredViewAll onClick={() => navigate('/jobs')} label="view all" />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)', textAlign: 'left', background: 'var(--bg-subtle, #F7F7F7)' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)' }}>Job #</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)' }}>Job Title</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)' }}>Customer</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentJobsList.slice(0, 5).map((job) => (
                  <tr key={job.id} style={{ borderBottom: '1px dotted var(--divider-dotted, #D9D9D9)' }}>
                    <td style={{ padding: '12px' }}>
                      <Link 
                        to="/jobs" 
                        style={{
                          fontWeight: 500,
                          fontSize: '12px',
                          color: 'var(--text, #0A0A0A)',
                          textDecoration: 'none',
                          fontFamily: 'var(--font-mono, "Geist Mono", monospace)'
                        }}
                      >
                        #ORD-{job.id.toString().padStart(4, '0')}
                      </Link>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 400, color: 'var(--text, #0A0A0A)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.title}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted, #8C8C8C)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.customer_name}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <Money value={job.total_amount} currency="SAR" style={{ fontWeight: 500 }} />
                    </td>
                  </tr>
                ))}
                {recentJobsList.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #8C8C8C)' }}>
                      No jobs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Recent Quotations */}
        <div style={{
          background: 'var(--bg-card, #FFFFFF)',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid var(--border, #E4E4E4)',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
              Recent Quotations
            </span>
            <CredViewAll onClick={() => navigate('/accounting/quotations')} label="view all" />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)', textAlign: 'left', background: 'var(--bg-subtle, #F7F7F7)' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)' }}>Quote #</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)' }}>Customer</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)' }}>Status</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {quotations.slice(0, 5).map((q) => (
                  <tr key={q.id} style={{ borderBottom: '1px dotted var(--divider-dotted, #D9D9D9)' }}>
                    <td style={{ padding: '12px' }}>
                      <Link 
                        to={`/accounting/quotations/${q.id}/edit`} 
                        style={{
                          fontWeight: 500,
                          fontSize: '12px',
                          color: 'var(--text, #0A0A0A)',
                          textDecoration: 'none',
                          fontFamily: 'var(--font-mono, "Geist Mono", monospace)'
                        }}
                      >
                        {q.quotation_number || `#QT-${q.id.toString().padStart(4, '0')}`}
                      </Link>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 400, color: 'var(--text, #0A0A0A)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {q.customer_name || 'Customer'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: 400,
                        color: q.status === 'Accepted' ? 'var(--success, #16A34A)' : q.status === 'Sent' ? '#2563eb' : 'var(--text-muted, #8C8C8C)'
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: q.status === 'Accepted' ? 'var(--success, #16A34A)' : q.status === 'Sent' ? '#2563eb' : 'var(--text-muted, #8C8C8C)'
                        }} />
                        {q.status || 'Draft'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <Money value={q.total_amount || 0} currency="SAR" style={{ fontWeight: 500 }} />
                    </td>
                  </tr>
                ))}
                {quotations.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #8C8C8C)' }}>
                      No quotations created yet.
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

export default Dashboard
