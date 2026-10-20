import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import { FileBarChart, TrendingUp, Users, Download, FileSpreadsheet, Briefcase, AlertCircle, CreditCard } from '../components/icons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts'
import * as XLSX from 'xlsx'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { handlePdfResponse } from '../utils/pdfDownload'
import { showError } from '../utils/swal'

// Assets
import logo from '../assets/logo.png'

const Reports = () => {
  const { settings, formatCurrency } = useSettings()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'overview')

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    if (tabId === 'overview') {
      setSearchParams({})
    } else {
      setSearchParams({ tab: tabId })
    }
  }

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingPL, setLoadingPL] = useState(false)
  const [error, setError] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedJobId, setSelectedJobId] = useState('')
  const [jobPL, setJobPL] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const handleExportPDF = async () => {
    try {
      setPdfLoading(true)
      const params = {
        format: 'pdf',
        export_format: 'pdf',
        tab: activeTab
      }
      if (dateRange.start) params.start_date = dateRange.start
      if (dateRange.end) params.end_date = dateRange.end
      if (selectedJobId) params.job_id = selectedJobId

      const res = await api.get('reports/', {
        params,
        responseType: 'blob'
      })
      handlePdfResponse(res, `financial_report_${activeTab}_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      showError('Export Failed', 'Failed to generate PDF report from server. Please try again.')
    } finally {
      setPdfLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async (start = '', end = '') => {
    try {
      setLoading(true)
      let url = 'reports/'
      if (start && end) url += `?start_date=${start}&end_date=${end}`
      const res = await api.get(url)
      setData(res.data)
      setError('')
    } catch (err) {
      setError('System: Analytics synchronization failed. Check backend connectivity.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleJobChange = async (e) => {
    const jobId = e.target.value
    setSelectedJobId(jobId)
    if (!jobId) {
      setJobPL(null)
      return
    }
    try {
      setLoadingPL(true)
      const res = await api.get(`reports/?job_id=${jobId}`)
      setJobPL(res.data.job_pl)
    } catch (err) {
      console.error('System: Job P&L fetch error.')
    } finally {
      setLoadingPL(false)
    }
  }

  const handleDateFilter = () => {
    fetchReports(dateRange.start, dateRange.end)
  }

  const monthlySummary = useMemo(() => {
    if (!data) return []
    const allMonths = Array.from(new Set([
      ...(data.monthly_income || []).map(m => m.month),
      ...(data.monthly_expenses || []).map(e => e.month)
    ])).filter(Boolean).sort()

    return allMonths.map(month => {
      const inc = (data.monthly_income || []).find(m => m.month === month) || { total: 0 }
      const exp = (data.monthly_expenses || []).find(e => e.month === month) || { total: 0 }
      return {
        name: month,
        month,
        revenue: Number(inc.total || 0),
        expenses: Number(exp.total || 0),
        profit: Number(inc.total || 0) - Number(exp.total || 0)
      }
    })
  }, [data])

  const exportToExcel = () => {
    if (!data) return
    const wb = XLSX.utils.book_new()

    const summaryRows = monthlySummary.map(m => ({
      'Date': m.month, 'Revenue': m.revenue, 'Expense': m.expenses, 'Profit': m.profit
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Financial Summary")

    const customerRows = (data.customers || []).map(c => ({
      'Customer ID': `#ID${c.id}`, 'Name': c.name, 'Email': c.email, 'Phone': c.phone,
      'Total Jobs': c.total_jobs, 'Total Revenue': c.total_revenue, 'Balance': c.balance
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customerRows), "Customer Report")

    const vendorRows = (data.vendors || []).map(v => ({
      'Vendor ID': `#VET${v.id}`, 'Name': v.name, 'Business Group': v.business_group,
      'Email': v.email, 'Phone': v.phone, 'Total Purchases': v.total_purchases,
      'Total Paid': v.total_paid, 'Balance': v.balance
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendorRows), "Vendor Report")

    const jobRows = (data.jobs || []).map(j => ({
      'Job ID': j.order_id || j.id, 'Title': j.title, 'Client': j.customer__name,
      'Status': j.status, 'Total Value': j.total_amount, 'Paid': j.paid, 'Balance': j.balance
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(jobRows), "Job Order Report")

    if (data.expense_report) {
      const expRows = [
        { 'Date': 'OPENING BALANCE', 'Description': '', 'Category': '', 'Type': '', 'Amount': data.expense_report.opening_balance },
        { 'Date': 'CLOSING BALANCE', 'Description': '', 'Category': '', 'Type': '', 'Amount': data.expense_report.closing_balance },
        ...data.expense_report.expenses.map(e => ({
          'Date': e.date, 'Description': e.description, 'Category': e.category, 'Type': e.type, 'Amount': e.amount
        }))
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expRows), "Expense Report")
    }

    XLSX.writeFile(wb, `ArabSeason_Reports.xlsx`)
  }

  const fmt = (val) => formatCurrency(Number(val) || 0);

  if (loading && !data) return (
    <div style={{ padding: '2rem', maxWidth: '1450px', margin: '0 auto' }}>
      <SkeletonLoader type="cards" />
      <div style={{ marginTop: '2rem' }}>
        <SkeletonLoader type="table" />
      </div>
    </div>
  )
  if (error && !data) return <div className="error-screen" style={{ textAlign: 'center', padding: '5rem' }}><AlertCircle size={50} color="var(--danger)" /><h2 style={{marginTop: '1rem'}}>{error}</h2><button className="btn btn-primary" style={{marginTop: '1rem'}} onClick={() => fetchReports()}>Try Again</button></div>
  if (!data) return <div style={{textAlign: 'center', padding: '5rem'}}>No report data found.</div>

  // ─── SHARED BRANDED HEADER (print only) ───────────────────────────────────
  const PrintHeader = ({ title }) => (
    <div className="print-only" style={{ display: 'none' }}>
      {/* Row 1: Logo left, company details right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #334155', paddingBottom: '1rem', marginBottom: '1rem' }}>
        <img src={logo} alt="arabSeason Logo" style={{ height: '60px', width: 'auto' }} />
        <div style={{ textAlign: 'right', fontSize: '9px', lineHeight: '1.6' }}>
          <div style={{ fontWeight: '900', fontSize: '13px', color: '#000' }}>arabSeason™</div>
          <div style={{ fontWeight: '700', color: '#334155' }}>TRN: 301374966800003 | JEDDAH, KSA</div>
          <div style={{ color: '#3b82f6', fontWeight: '700' }}>ad@arabseason.net &nbsp;•&nbsp; Published: {new Date().toLocaleString()}</div>
        </div>
      </div>
      {/* Row 2: Report title centered */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem', paddingTop: '0.5rem' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '900', textDecoration: 'underline', margin: 0, color: '#1e293b' }}>{title}</h2>
      </div>
    </div>
  )

  const PrintFooter = () => (
    <div className="print-only" style={{ display: 'none', marginTop: '3rem', borderTop: '2px solid #334155', paddingTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#64748b', fontWeight: '800' }}>
        <div>CORPORATE ARCHIVE • ARABSEASON • VALIDATED</div>
        <div>VALIDATED DOCUMENT - Page 1 of 1</div>
      </div>
    </div>
  )

  const statusColor = (s) => s === 'Completed' ? '#27ae60' : s === 'In Progress' ? '#e67e22' : s === 'Cancelled' ? '#dc2626' : '#64748b'

  if (activeTab === 'salary') {
    return <Navigate to="/salary" replace />
  }

  return (
    <div className="reports-page academy-style erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* ── TOP BAR (screen only) ── */}
      <div className="no-print">
        <div className="page-header reports-header-row" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0, letterSpacing: '-0.01em', color: 'var(--text-main)' }}>Reports & Financial Statements</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>Comprehensive revenue analysis, receivables, disbursements, and ledgers</p>
          </div>
          <div className="reports-top-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={exportToExcel} style={{ borderRadius: 'var(--radius-sm)' }}>
              <FileSpreadsheet size={15} style={{ color: 'var(--success)' }} /> Export Excel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleExportPDF} 
              disabled={pdfLoading}
              style={{ borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Download size={15} /> {pdfLoading ? 'Generating PDF...' : 'Export PDF'}
            </button>
          </div>
        </div>

        <div className="glass-panel tabs-scrollable reports-tabs-bar" style={{ display: 'flex', marginBottom: '1.25rem', padding: '0.35rem', background: '#ffffff', gap: '0.35rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {[
            { id: 'overview', label: 'Company Overview', icon: TrendingUp },
            { id: 'customers', label: 'Customer Report', icon: Users },
            { id: 'vendors', label: 'Vendor Report', icon: Users },
            { id: 'jobs', label: 'Job Order Report', icon: Briefcase },
            { id: 'expenses', label: 'Expense Report', icon: CreditCard }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => handleTabChange(tab.id)} 
              className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ 
                flexShrink: 0, 
                fontWeight: activeTab === tab.id ? '700' : '500', 
                whiteSpace: 'nowrap', 
                fontSize: '0.8rem', 
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                border: activeTab === tab.id ? 'none' : '1px solid transparent'
              }}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB 1 — COMPANY OVERVIEW
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="animate-fade-in">
          <PrintHeader title="Corporate Performance Overview" />

          {/* Chart (screen) */}
          <div className="glass-panel no-print" style={{ padding: '2.5rem' }}>
            <h3 style={{fontWeight: '900', marginBottom: '2rem'}}>Revenue Analysis</h3>
            <div style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlySummary}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="name" /><YAxis /><Tooltip /><Legend />
                  <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={4} />
                  <Line type="monotone" dataKey="expenses" stroke="var(--danger)" strokeWidth={4} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PDF-only data table (replaces unrenderable canvas) */}
          <div className="print-only" style={{ display: 'none', marginTop: '1.5rem' }}>
            <h3 style={{ fontWeight: '900', marginBottom: '1rem', color: '#1e293b' }}>Monthly Financial Performance Summary</h3>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <table className="corporate-statement-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', width: '22%' }}>MONTH</th>
                  <th style={{ textAlign: 'right', width: '26%', whiteSpace: 'nowrap' }}>REVENUE (SAR)</th>
                  <th style={{ textAlign: 'right', width: '26%', whiteSpace: 'nowrap' }}>EXPENSES (SAR)</th>
                  <th style={{ textAlign: 'right', width: '26%', whiteSpace: 'nowrap' }}>NET PROFIT (SAR)</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map((m, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #eee' }}>
                    <td style={{ textAlign: 'left', fontWeight: '800' }}>{m.month}</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: '#059669', whiteSpace: 'nowrap' }}>{fmt(m.revenue)}</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: '#dc2626', whiteSpace: 'nowrap' }}>{fmt(m.expenses)}</td>
                    <td style={{ textAlign: 'right', fontWeight: '900', color: m.profit >= 0 ? '#3b82f6' : '#ef4444', whiteSpace: 'nowrap' }}>{fmt(m.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <PrintFooter />
        </div>
      )}



      {/* ══════════════════════════════════════════════════════
          TAB 3 — CUSTOMER REPORT
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'customers' && (
        <div className="animate-fade-in">
          <PrintHeader title="Customer Account Statement" />
          <h3 className="no-print" style={{ fontWeight: '900', marginBottom: '1.5rem' }}>Detailed Customer List</h3>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table className="corporate-statement-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '55px', textAlign: 'center' }}>ID</th>
                  <th style={{ textAlign: 'left', width: '18%' }}>NAME</th>
                  <th style={{ textAlign: 'left', width: '22%' }}>EMAIL</th>
                  <th style={{ textAlign: 'center', width: '110px' }}>PHONE</th>
                  <th style={{ textAlign: 'center', width: '50px' }}>JOBS</th>
                  <th style={{ textAlign: 'right', width: '18%', whiteSpace: 'nowrap' }}>TOTAL REVENUE</th>
                  <th style={{ textAlign: 'right', width: '18%', whiteSpace: 'nowrap' }}>BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {(data.customers || []).length > 0 ? (data.customers || []).map((c, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #eee' }}>
                    <td style={{ textAlign: 'center', fontWeight: '700', color: '#64748b' }}>#ID{c.id}</td>
                    <td style={{ textAlign: 'left', fontWeight: '800' }}>{c.name}</td>
                    <td style={{ textAlign: 'left', fontSize: '0.8rem', color: '#3b82f6', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{c.email || '-'}</td>
                    <td style={{ textAlign: 'center', fontWeight: '600' }}>{c.phone || '-'}</td>
                    <td style={{ textAlign: 'center', fontWeight: '800' }}>{c.total_jobs || 0}</td>
                    <td style={{ textAlign: 'right', fontWeight: '900', color: '#059669', whiteSpace: 'nowrap' }}>{fmt(c.total_revenue || c.rev_sum)}</td>
                    <td style={{ textAlign: 'right', fontWeight: '900', color: (Number(c.balance) || 0) > 0 ? '#dc2626' : '#059669', whiteSpace: 'nowrap' }}>{fmt(c.balance)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontStyle: 'italic' }}>No customer records found matching the current criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PrintFooter />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 4 — VENDOR REPORT
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'vendors' && (
        <div className="animate-fade-in">
          <PrintHeader title="Vendor Ledger Statement" />
          <h3 className="no-print" style={{ fontWeight: '900', marginBottom: '1.5rem' }}>Vendor Ledger Breakdown</h3>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table className="corporate-statement-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '55px', textAlign: 'center' }}>ID</th>
                  <th style={{ textAlign: 'left', width: '18%' }}>NAME</th>
                  <th style={{ textAlign: 'left', width: '15%' }}>BUSINESS GROUP</th>
                  <th style={{ textAlign: 'left', width: '20%' }}>EMAIL</th>
                  <th style={{ textAlign: 'center', width: '110px' }}>PHONE</th>
                  <th style={{ textAlign: 'right', width: '18%', whiteSpace: 'nowrap' }}>TOTAL AMOUNT</th>
                  <th style={{ textAlign: 'right', width: '18%', whiteSpace: 'nowrap' }}>BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {(data.vendors || []).length > 0 ? (data.vendors || []).map((v, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #eee' }}>
                    <td style={{ textAlign: 'center', fontWeight: '700', color: '#64748b' }}>#VET{v.id}</td>
                    <td style={{ textAlign: 'left', fontWeight: '800' }}>{v.name}</td>
                    <td style={{ textAlign: 'left', fontSize: '0.85rem' }}>{v.business_group || 'Standard'}</td>
                    <td style={{ textAlign: 'left', fontSize: '0.8rem', color: '#6366f1', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{v.email || '-'}</td>
                    <td style={{ textAlign: 'center', fontWeight: '600' }}>{v.phone || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: '900', color: '#dc2626', whiteSpace: 'nowrap' }}>{fmt(v.total_paid || v.purch_sum)}</td>
                    <td style={{ textAlign: 'right', fontWeight: '900', color: (Number(v.balance) || 0) > 0 ? '#ef4444' : '#059669', whiteSpace: 'nowrap' }}>{fmt(v.balance)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontStyle: 'italic' }}>No vendor records found matching the current criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PrintFooter />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 5 — JOB ORDER REPORT
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'jobs' && (
        <div className="animate-fade-in">
          <PrintHeader title={selectedJobId && jobPL ? `Project P&L: ${jobPL.title}` : 'Job Order Performance Record'} />

          {/* Job selector (screen only) */}
          <div className="no-print" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{fontWeight: '800'}}>Single Project:</div>
            <select className="input-field" style={{ width: '380px' }} value={selectedJobId} onChange={handleJobChange}>
              <option value="">-- ALL PROJECTS --</option>
              {(data.jobs || []).map(j => <option key={j.id} value={j.id}>{j.order_id} • {j.title}</option>)}
            </select>
            {loadingPL && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</span>}
          </div>

          {/* ── Single project P&L ── */}
          {jobPL ? (
            <>
              {/* Client info header (always visible, critical for PDF) */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Project ID', val: jobPL.job_id ? `#JOB${jobPL.job_id}` : '—' },
                  { label: 'Title', val: jobPL.title },
                  { label: 'Client', val: jobPL.client_name || '—' },
                  { label: 'Status', val: jobPL.status || '—', color: statusColor(jobPL.status) }
                ].map((x, i) => (
                  <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>{x.label}</div>
                    <div style={{ fontWeight: '800', color: x.color || '#1e293b', fontSize: '0.95rem' }}>{x.val}</div>
                  </div>
                ))}
              </div>

              {/* P&L KPI cards */}
              <div className="glass-panel" style={{ padding: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', border: '1px solid #eee' }}>
                {[
                  { l: 'Contract Value', v: jobPL.contract_total, c: '#1e293b' },
                  { l: 'Revenue Received', v: jobPL.revenue, c: '#059669' },
                  { l: 'Total Expenses', v: jobPL.expenses, c: '#dc2626' },
                  { l: 'Net Profit', v: jobPL.profit, c: jobPL.profit >= 0 ? '#3b82f6' : '#ef4444' }
                ].map((x, i) => (
                  <div key={i} style={{ textAlign: 'center', borderRight: i < 3 ? '1px solid #eee' : 'none' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '900', color: '#64748b' }}>{x.l.toUpperCase()}</div>
                    <div style={{ fontSize: '1.7rem', fontWeight: '900', color: x.c, whiteSpace: 'nowrap' }}>{fmt(x.v || 0)}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* ── All projects table ── */
            <>
              <h3 className="no-print" style={{ fontWeight: '900', marginBottom: '1.5rem' }}>Master Project List</h3>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <table className="corporate-statement-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '75px', textAlign: 'center' }}>JOB ID</th>
                      <th style={{ textAlign: 'left', width: '22%' }}>TITLE</th>
                      <th style={{ textAlign: 'left', width: '20%' }}>CLIENT</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>STATUS</th>
                      <th style={{ textAlign: 'right', width: '16%', whiteSpace: 'nowrap' }}>CONTRACT (SAR)</th>
                      <th style={{ textAlign: 'right', width: '15%', whiteSpace: 'nowrap' }}>PAID (SAR)</th>
                      <th style={{ textAlign: 'right', width: '15%', whiteSpace: 'nowrap' }}>BALANCE (SAR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.jobs || []).length > 0 ? (data.jobs || []).map((j, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #eee' }}>
                        <td style={{ textAlign: 'center', fontWeight: '800' }}>{j.order_id || `#JOB${j.id}`}</td>
                        <td style={{ textAlign: 'left', fontWeight: '700' }}>{j.title}</td>
                        <td style={{ textAlign: 'left', fontWeight: '600' }}>{j.customer__name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <b style={{ color: statusColor(j.status), fontSize: '0.75rem' }}>{(j.status || '').toUpperCase()}</b>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap' }}>{fmt(j.total_amount)}</td>
                        <td style={{ textAlign: 'right', color: '#059669', fontWeight: '700', whiteSpace: 'nowrap' }}>{fmt(j.paid)}</td>
                        <td style={{ textAlign: 'right', color: (Number(j.balance) || 0) > 0 ? '#dc2626' : '#059669', fontWeight: '900', whiteSpace: 'nowrap' }}>{fmt(j.balance)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontStyle: 'italic' }}>No job orders found matching the current criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <PrintFooter />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 6 — EXPENSE REPORT
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'expenses' && data.expense_report && (
        <div className="animate-fade-in">
          <PrintHeader title="Corporate Expense & Financial Statement" />
          
          <h3 className="no-print" style={{ fontWeight: '900', marginBottom: '1.5rem' }}>Financial Overview</h3>
          
          <div className="glass-panel" style={{ padding: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', border: '1px solid #eee', marginBottom: '2rem' }}>
            <div style={{ textAlign: 'center', borderRight: '1px solid #eee' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '900', color: '#64748b' }}>OPENING BALANCE</div>
              <div style={{ fontSize: '1.7rem', fontWeight: '900', color: '#3b82f6', whiteSpace: 'nowrap' }}>{fmt(data.expense_report.opening_balance)}</div>
            </div>
            <div style={{ textAlign: 'center', borderRight: '1px solid #eee' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '900', color: '#64748b' }}>TOTAL EXPENSES (PERIOD)</div>
              <div style={{ fontSize: '1.7rem', fontWeight: '900', color: '#dc2626', whiteSpace: 'nowrap' }}>
                {fmt(data.expense_report.expenses.reduce((sum, e) => sum + Number(e.amount), 0))}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '900', color: '#64748b' }}>CLOSING BANK BALANCE</div>
              <div style={{ fontSize: '1.7rem', fontWeight: '900', color: data.expense_report.closing_balance >= 0 ? '#059669' : '#ef4444', whiteSpace: 'nowrap' }}>{fmt(data.expense_report.closing_balance)}</div>
            </div>
          </div>

          <h3 className="no-print" style={{ fontWeight: '900', marginBottom: '1.5rem' }}>Detailed Expenditure List</h3>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table className="corporate-statement-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '95px', textAlign: 'center' }}>DATE</th>
                  <th style={{ textAlign: 'left', width: '32%' }}>DESCRIPTION</th>
                  <th style={{ textAlign: 'left', width: '18%' }}>CATEGORY</th>
                  <th style={{ textAlign: 'left', width: '16%' }}>TYPE</th>
                  <th style={{ textAlign: 'right', width: '20%', whiteSpace: 'nowrap' }}>AMOUNT (SAR)</th>
                </tr>
              </thead>
              <tbody>
                {(data.expense_report.expenses || []).length > 0 ? (data.expense_report.expenses || []).map((exp, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #eee' }}>
                    <td style={{ textAlign: 'center', fontWeight: '700', color: '#64748b' }}>{exp.date}</td>
                    <td style={{ textAlign: 'left', fontWeight: '800' }}>{exp.description}</td>
                    <td style={{ textAlign: 'left', fontSize: '0.85rem' }}>{exp.category || '-'}</td>
                    <td style={{ textAlign: 'left', fontSize: '0.85rem', color: '#6366f1' }}>{exp.type || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: '900', color: '#dc2626', whiteSpace: 'nowrap' }}>{fmt(exp.amount)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontStyle: 'italic' }}>No expenses found matching the current criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PrintFooter />
        </div>
      )}

    </div>
  )
}

export default Reports
