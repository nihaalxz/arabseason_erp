import { useState, useEffect, useCallback } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { 
  Users, Briefcase, RefreshCw, AlertCircle, 
  Clock, CheckCircle, Play, XCircle, ArrowRight, Sliders,
  FileText, Plus, Layers, Info
} from '../components/icons'
import { Truck, Building2, ChevronDown, Filter } from 'lucide-react'
import api from '../api'
import { Link, useNavigate } from 'react-router-dom'
import SkeletonLoader from '../components/common/SkeletonLoader'

const Dashboard = () => {
  const [data, setData] = useState(null)
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showContractsInfo, setShowContractsInfo] = useState(false)
  const { formatCurrency } = useSettings()
  const { isMinimalist } = useWorkspace()
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

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '2rem' }}>
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
        <button className="btn btn-primary" onClick={fetchDashboardData} style={{ marginLeft: '1rem' }}>
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
  const activeOrdersCount = pendingJobs + inProgressJobs
  const totalTrackedJobs = pendingJobs + inProgressJobs + completedJobs + cancelledJobs
  const completionRate = totalTrackedJobs > 0 ? Math.round((completedJobs / totalTrackedJobs) * 100) : 0

  // Active jobs valuation
  const recentJobsList = data?.recent_jobs || []
  const activeJobsValuation = recentJobsList.reduce((sum, j) => sum + (parseFloat(j.total_amount) || 0), 0)

  // Quotations calculations
  const totalQuotesValuation = quotations.reduce((sum, q) => sum + (parseFloat(q.total_amount) || 0), 0)
  const acceptedQuotes = quotations.filter(q => q.status === 'Accepted' || q.status === 'Converted to Invoice')
  const pendingQuotes = quotations.filter(q => q.status !== 'Accepted' && q.status !== 'Converted to Invoice')

  const activeOrdersTotal = activeOrdersCount > 0 ? activeOrdersCount : 1
  const inProgressPct = Math.round((inProgressJobs / activeOrdersTotal) * 100)
  const pendingPct = 100 - inProgressPct

  const quotesTotal = (quotations.length > 0) ? quotations.length : 1
  const acceptedPct = Math.round((acceptedQuotes.length / quotesTotal) * 100)
  const pendingQuotesPct = 100 - acceptedPct

  return (
    <div className="dashboard-page erp-page-container erp-page-transition" style={{ maxWidth: '1600px', margin: '0 auto', width: '100%', minWidth: 0, paddingBottom: '3rem' }}>
      
      {/* ── TOP HEADER / FILTER BAR ── */}
      <div className="dashboard-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main, #0f172a)', letterSpacing: '-0.02em' }}>
            ERP Dashboard
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
            Overview of your active jobs, quotations, and customers
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Link to Accounting Dashboard */}
          <Link
            to="/accounting"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: '600',
              background: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0',
              textDecoration: 'none',
              transition: 'all 0.15s ease'
            }}
            title="Open Accounting Dashboard"
          >
            <span>Accounting Dashboard</span>
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
            onClick={fetchDashboardData} 
            title="Refresh Data"
            style={{ borderRadius: '999px', padding: '0.45rem 0.95rem' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── MINIMALIST MODE BANNER ── */}
      {isMinimalist && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem', color: '#166534', fontWeight: '500' }}>
              <strong>Simple View On</strong> — Showing key daily metrics.
            </span>
          </div>
          <Link
            to="/settings?tab=workspace"
            style={{
              fontSize: '0.78rem',
              fontWeight: '600',
              color: '#166534',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#ffffff',
              padding: '4px 10px',
              borderRadius: '5px',
              border: '1px solid #bbf7d0'
            }}
          >
            <Sliders size={13} /> Customize
          </Link>
        </div>
      )}

      {/* ── ROW 1: ACTIVE JOBS & QUOTATIONS (REFERENCE DESIGN CARDS) ── */}
      <div className="dashboard-row-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        
        {/* Card 1: Active Jobs */}
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
                  ACTIVE JOBS
                </span>
                <div 
                  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                  onMouseEnter={() => setShowContractsInfo(true)}
                  onMouseLeave={() => setShowContractsInfo(false)}
                >
                  <button
                    type="button"
                    onClick={() => setShowContractsInfo(prev => !prev)}
                    title="Active job value"
                    style={{
                      background: 'none', border: 'none', padding: '2px', cursor: 'pointer',
                      color: showContractsInfo ? '#4f46e5' : '#94a3b8',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%'
                    }}
                    aria-label="Job information"
                  >
                    <Info size={13} />
                  </button>
                  {showContractsInfo && (
                    <div style={{
                      position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
                      zIndex: 50, background: '#1e293b', color: '#ffffff', fontSize: '0.72rem', fontWeight: '500',
                      padding: '0.35rem 0.65rem', borderRadius: '6px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                      whiteSpace: 'nowrap', pointerEvents: 'none'
                    }}>
                      Total value of active job orders
                    </div>
                  )}
                </div>
              </div>

              <Link 
                to="/jobs" 
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
                View Jobs →
              </Link>
            </div>

            {/* Big Amount */}
            <div style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', margin: '0.45rem 0 0.85rem', letterSpacing: '-0.03em' }}>
              {formatCurrency(activeJobsValuation)}
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
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#6366f1' }}>In Progress</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginTop: '2px', letterSpacing: '-0.02em' }}>
                {inProgressJobs} <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#64748b' }}>jobs</span>
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
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#ea580c' }}>Pending Start</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginTop: '2px', letterSpacing: '-0.02em' }}>
                {pendingJobs} <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#64748b' }}>jobs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Quotations & Proposals */}
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
                QUOTATIONS & PROPOSALS
              </span>
              <Link 
                to="/quotations" 
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
                View Quotations →
              </Link>
            </div>

            {/* Big Amount */}
            <div style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', margin: '0.45rem 0 0.85rem', letterSpacing: '-0.03em' }}>
              {formatCurrency(totalQuotesValuation)}
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
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#6366f1' }}>Accepted</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginTop: '2px', letterSpacing: '-0.02em' }}>
                {acceptedQuotes.length} <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#64748b' }}>quotes</span>
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
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#6366f1' }}>Sent to Client</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginTop: '2px', letterSpacing: '-0.02em' }}>
                {pendingQuotes.length} <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#64748b' }}>quotes</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── ROW 2: JOB STATUS OVERVIEW (REFERENCE DESIGN 4 FLOATING CARDS) ── */}
      <div className="glass-panel" style={{
        background: '#ffffff',
        borderRadius: '20px',
        padding: '1.35rem 1.6rem',
        border: '1px solid #e2e8f0',
        marginBottom: '1.25rem',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.15rem' }}>
          <div>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              JOB STATUS OVERVIEW
            </span>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
              Current stage of all job orders
            </div>
          </div>
          <Link to="/jobs?tab=planning" style={{ fontSize: '0.78rem', color: '#6366f1', fontWeight: '600', textDecoration: 'none' }}>
            Project Planning →
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {/* Tile 1: Pending */}
          <div style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            borderRadius: '18px',
            padding: '1.25rem 1.35rem',
            border: '1px solid rgba(253, 230, 138, 0.8)',
            boxShadow: '0 2px 8px rgba(217, 119, 6, 0.03)'
          }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              color: '#b45309',
              background: '#ffffff',
              padding: '3px 10px',
              borderRadius: '999px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'inline-block'
            }}>
              Pending
            </span>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#b45309', marginTop: '0.55rem', letterSpacing: '-0.02em' }}>
              {pendingJobs} Jobs
            </div>
            <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '4px', fontWeight: '500' }}>
              Waiting to start
            </div>
          </div>

          {/* Tile 2: In Progress */}
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
            borderRadius: '18px',
            padding: '1.25rem 1.35rem',
            border: '1px solid rgba(191, 219, 254, 0.8)',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.03)'
          }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              color: '#1d4ed8',
              background: '#ffffff',
              padding: '3px 10px',
              borderRadius: '999px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'inline-block'
            }}>
              In Progress
            </span>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#1d4ed8', marginTop: '0.55rem', letterSpacing: '-0.02em' }}>
              {inProgressJobs} Jobs
            </div>
            <div style={{ fontSize: '0.75rem', color: '#1e40af', marginTop: '4px', fontWeight: '500' }}>
              Currently in work
            </div>
          </div>

          {/* Tile 3: Completed */}
          <div style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
            borderRadius: '18px',
            padding: '1.25rem 1.35rem',
            border: '1px solid rgba(167, 243, 208, 0.8)',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.03)'
          }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              color: '#15803d',
              background: '#ffffff',
              padding: '3px 10px',
              borderRadius: '999px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'inline-block'
            }}>
              Completed
            </span>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#15803d', marginTop: '0.55rem', letterSpacing: '-0.02em' }}>
              {completedJobs} Jobs
            </div>
            <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '4px', fontWeight: '500' }}>
              Finished and delivered
            </div>
          </div>

          {/* Tile 4: Completion Rate */}
          <div style={{
            background: 'linear-gradient(135deg, #f0f4ff 0%, #f5f3ff 100%)',
            borderRadius: '18px',
            padding: '1.25rem 1.35rem',
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
              Completion Rate
            </span>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#4f46e5', marginTop: '0.55rem', letterSpacing: '-0.02em' }}>
              {completionRate}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontWeight: '500' }}>
              {completedJobs} of {totalTrackedJobs} completed
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: CUSTOMERS & VENDORS ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        
        {/* Customers & Vendors Directory */}
        <div className="glass-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={18} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>
                Customers & Vendors
              </span>
            </div>
            <Link to="/customers" style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: '700', textDecoration: 'none' }}>
              View All →
            </Link>
          </div>

          <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #edf0f5', marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Total Customers</div>
              <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                {data?.total_customers || 0} Registered Clients
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', background: '#eff6ff', color: '#2563eb', padding: '4px 8px', borderRadius: '6px', fontWeight: '700' }}>
              Active Directory
            </span>
          </div>

          {/* Simple Link Rows */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.75rem', background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a' }}>Customer Accounts</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Client details, phone numbers, and past orders</div>
                </div>
              </div>
              <Link to="/customers" style={{ fontSize: '0.75rem', fontWeight: '700', color: '#2563eb', textDecoration: 'none' }}>
                Open →
              </Link>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.75rem', background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a' }}>Vendors & Suppliers</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Material suppliers and service contractors</div>
                </div>
              </div>
              <Link to="/vendors" style={{ fontSize: '0.75rem', fontWeight: '700', color: '#6366f1', textDecoration: 'none' }}>
                Open →
              </Link>
            </div>
          </div>
        </div>

      </div>

      {/* ── ROW 4: RECENT JOBS & RECENT QUOTATIONS (2 Clear Tables) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        
        {/* Table 1: Recent Jobs */}
        <div className="glass-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>
              Recent Jobs
            </span>
            <Link to="/jobs" style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: '700', textDecoration: 'none' }}>
              View All →
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #edf0f5', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '0.45rem 0', fontWeight: '600' }}>Job #</th>
                  <th style={{ padding: '0.45rem 0.5rem', fontWeight: '600' }}>Job Title</th>
                  <th style={{ padding: '0.45rem 0.5rem', fontWeight: '600' }}>Customer</th>
                  <th style={{ padding: '0.45rem 0', fontWeight: '600', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentJobsList.slice(0, 5).map((job) => (
                  <tr key={job.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '0.55rem 0' }}>
                      <Link 
                        to="/jobs" 
                        style={{
                          fontWeight: '700',
                          fontSize: '0.78rem',
                          color: '#2563eb',
                          textDecoration: 'none',
                          background: '#eff6ff',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          border: '1px solid #bfdbfe'
                        }}
                      >
                        #ORD-{job.id.toString().padStart(4, '0')}
                      </Link>
                    </td>
                    <td style={{ padding: '0.55rem 0.5rem', fontWeight: '600', color: '#0f172a', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.title}
                    </td>
                    <td style={{ padding: '0.55rem 0.5rem', color: '#64748b', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.customer_name}
                    </td>
                    <td style={{ padding: '0.55rem 0', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                      {formatCurrency(job.total_amount)}
                    </td>
                  </tr>
                ))}
                {recentJobsList.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                      No jobs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Recent Quotations */}
        <div className="glass-panel" style={{ background: '#ffffff', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>
              Recent Quotations
            </span>
            <Link to="/quotations" style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: '700', textDecoration: 'none' }}>
              View All →
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #edf0f5', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '0.45rem 0', fontWeight: '600' }}>Quote #</th>
                  <th style={{ padding: '0.45rem 0.5rem', fontWeight: '600' }}>Customer</th>
                  <th style={{ padding: '0.45rem 0.5rem', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '0.45rem 0', fontWeight: '600', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {quotations.slice(0, 5).map((q) => (
                  <tr key={q.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '0.55rem 0' }}>
                      <Link 
                        to={`/quotations/${q.id}/edit`} 
                        style={{
                          fontWeight: '700',
                          fontSize: '0.78rem',
                          color: '#2563eb',
                          textDecoration: 'none'
                        }}
                      >
                        {q.quotation_number || `#QT-${q.id.toString().padStart(4, '0')}`}
                      </Link>
                    </td>
                    <td style={{ padding: '0.55rem 0.5rem', fontWeight: '600', color: '#0f172a', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {q.customer_name || 'Customer'}
                    </td>
                    <td style={{ padding: '0.55rem 0.5rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 7px',
                        borderRadius: '999px',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        background: q.status === 'Accepted' ? '#ecfdf5' : q.status === 'Sent' ? '#eff6ff' : '#f1f5f9',
                        color: q.status === 'Accepted' ? '#059669' : q.status === 'Sent' ? '#2563eb' : '#475569',
                        border: `1px solid ${q.status === 'Accepted' ? '#a7f3d0' : q.status === 'Sent' ? '#bfdbfe' : '#cbd5e1'}`
                      }}>
                        {q.status || 'Draft'}
                      </span>
                    </td>
                    <td style={{ padding: '0.55rem 0', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                      {formatCurrency(q.total_amount || 0)}
                    </td>
                  </tr>
                ))}
                {quotations.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
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
