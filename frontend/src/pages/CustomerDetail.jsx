import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Search,
  Filter,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  ExternalLink
} from 'lucide-react'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'
import { DATE_PRESETS } from '../utils/datePresets'
import StatementSheet from '../components/accounting/StatementSheet'
import { CredAnimatedTabs } from '../components/cashbook/cred/CredAnimatedTabs'
import CredPagination from '../components/cashbook/cred/CredPagination'
import CredSearchInput from '../components/cashbook/cred/CredSearchInput'
import PageHeaderButton from '../components/common/PageHeaderButton'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { showError, showToast } from '../utils/swal'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'statement', label: 'Statement' },
  { id: 'transactions', label: 'Transactions' },
]

const TYPE_FILTERS = [
  { value: 'all', label: 'All Types' },
  { value: 'job_order', label: 'Job Orders' },
  { value: 'invoice', label: 'Tax Invoices' },
  { value: 'payment', label: 'Payments' },
  { value: 'refund', label: 'Refunds' },
  { value: 'credit_note', label: 'Credit Notes' },
]

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { settings } = useSettings()

  // State synchronized with URL
  const currentTab = searchParams.get('tab') || 'overview'
  const startDate = searchParams.get('start_date') || ''
  const endDate = searchParams.get('end_date') || ''
  const searchQuery = searchParams.get('search') || ''
  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const [transactionType, setTransactionType] = useState('all')

  const [customer, setCustomer] = useState(null)
  const [ledger, setLedger] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pdfGenerating, setPdfGenerating] = useState(false)

  const pageSize = 15

  // Helper to update search params smoothly
  const updateQuery = useCallback((updates) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === undefined || val === '') {
        next.delete(key)
      } else {
        next.set(key, val)
      }
    })
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // Fetch Customer & Ledger Data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [custRes, ledgerRes] = await Promise.all([
        api.get(`/customers/${id}/`),
        api.get(`/customers/${id}/statement/`, {
          params: {
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            search: searchQuery || undefined,
          }
        })
      ])
      setCustomer(custRes.data)
      setLedger(ledgerRes.data)
    } catch (err) {
      showError('Failed to load customer statement details')
    } finally {
      setLoading(false)
    }
  }, [id, startDate, endDate, searchQuery])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Currency Formatter
  const formatCurrency = (amt, withSign = false) => {
    const val = parseFloat(amt || 0)
    const formatted = Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    if (withSign && val < 0) {
      return `- SAR ${formatted}`
    }
    return `SAR ${formatted}`
  }

  // Handle PDF Export
  const handleExportPdf = async () => {
    try {
      setPdfGenerating(true)
      const res = await api.get(`/customers/${id}/statement-pdf/`, {
        params: {
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          search: searchQuery || undefined,
        },
        responseType: 'blob'
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err) {
      showError('Failed to generate statement PDF')
    } finally {
      setPdfGenerating(false)
    }
  }

  // Rows for statement tab
  const statementRows = ledger?.rows || []

  // Filtered rows for transactions tab
  const transactionRows = useMemo(() => {
    if (!ledger?.rows) return []
    if (transactionType === 'all') return ledger.rows
    return ledger.rows.filter(r => r.type === transactionType || (transactionType === 'invoice' && r.type === 'invoice_ref'))
  }, [ledger?.rows, transactionType])

  // Paginated statement rows
  const paginatedStatement = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return statementRows.slice(start, start + pageSize)
  }, [statementRows, currentPage, pageSize])

  const totalStatementPages = Math.ceil(statementRows.length / pageSize) || 1

  // Paginated transaction rows
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return transactionRows.slice(start, start + pageSize)
  }, [transactionRows, currentPage, pageSize])

  const totalTransactionPages = Math.ceil(transactionRows.length / pageSize) || 1

  if (loading && !customer) {
    return (
      <div className="customer-detail-page erp-page-container erp-page-transition" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', paddingBottom: '3rem' }}>
        <SkeletonLoader rows={8} />
      </div>
    )
  }

  const receivableDue = Math.max(0, parseFloat(customer?.pending_balance || 0))
  const creditOverpayment = parseFloat(customer?.customer_overpayment || 0)
  const totalBilled = parseFloat(customer?.total_billed || 0)
  const totalPaid = parseFloat(customer?.paid_amount || 0)
  const totalRefunded = parseFloat(customer?.total_cashed_out || 0)

  return (
    <div className="customer-detail-page erp-page-container erp-page-transition" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', paddingBottom: '3rem' }}>
      {/* 1. Header & Navigation */}
      <div className="page-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={() => navigate('/accounting/customers')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid var(--border, #E4E4E4)',
              background: 'var(--card-bg, #FFFFFF)',
              color: 'var(--text, #0A0A0A)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
            title="Back to Customers"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text, #0A0A0A)', margin: 0 }}>
                {customer?.name}
              </h2>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'var(--bg-muted, #F4F4F5)',
                color: 'var(--text-muted, #71717A)',
                fontVariantNumeric: 'tabular-nums'
              }}>
                CID-{customer?.id?.toString().padStart(5, '0')}
              </span>
              {customer?.company_name && (
                <span style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)', fontWeight: 400 }}>
                  ({customer.company_name})
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>
              {customer?.phone && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={13} /> {customer.phone}
                </span>
              )}
              {customer?.email && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Mail size={13} /> {customer.email}
                </span>
              )}
              {customer?.address && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={13} /> {customer.address}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <PageHeaderButton
            icon={RefreshCw}
            label={loading ? 'Refreshing...' : 'Refresh'}
            onClick={fetchData}
            disabled={loading}
          />
          <PageHeaderButton
            icon={Download}
            label={pdfGenerating ? 'Generating PDF...' : 'Export Statement PDF'}
            onClick={handleExportPdf}
            disabled={pdfGenerating}
            variant="primary"
          />
        </div>
      </div>

      {/* 2. CRED Animated Tabs */}
      <div style={{ marginBottom: '1.25rem' }}>
        <CredAnimatedTabs
          tabs={TABS}
          value={currentTab}
          onChange={(tabId) => updateQuery({ tab: tabId, page: 1 })}
          ariaLabel="Customer detail views"
        />
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: OVERVIEW */}
      {currentTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* KPI Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '4px'
          }}>
            {/* Total Billed */}
            <div style={{
              background: 'var(--card-bg, #FFFFFF)',
              border: '1px solid var(--border, #E4E4E4)',
              borderRadius: '20px',
              padding: '18px 20px',
              boxSizing: 'border-box'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
                Total Billed
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {formatCurrency(totalBilled)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '6px' }}>
                Jobs & standalone invoices
              </div>
            </div>

            {/* Cash Collected */}
            <div style={{
              background: 'var(--card-bg, #FFFFFF)',
              border: '1px solid var(--border, #E4E4E4)',
              borderRadius: '20px',
              padding: '18px 20px',
              boxSizing: 'border-box'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
                Cash Collected
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {formatCurrency(totalPaid)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '6px' }}>
                Total inflows received
              </div>
            </div>

            {/* Receivables Due (Clamped at 0) */}
            <div style={{
              background: 'var(--card-bg, #FFFFFF)',
              border: '1px solid var(--border, #E4E4E4)',
              borderRadius: '20px',
              padding: '18px 20px',
              boxSizing: 'border-box'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
                Receivables Due
              </div>
              <div style={{
                fontSize: '28px',
                fontWeight: 600,
                color: receivableDue > 0 ? 'var(--danger, #DC2626)' : 'var(--text, #0A0A0A)',
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap'
              }}>
                {formatCurrency(receivableDue)}
              </div>
              <div style={{ fontSize: '12px', color: receivableDue > 0 ? 'var(--danger, #DC2626)' : 'var(--text-muted, #8C8C8C)', marginTop: '6px' }}>
                {receivableDue > 0 ? 'Customer balance due' : 'Settled in full'}
              </div>
            </div>

            {/* Separate Credit / Overpayment Card */}
            <div style={{
              background: 'var(--card-bg, #FFFFFF)',
              border: '1px solid var(--border, #E4E4E4)',
              borderRadius: '20px',
              padding: '18px 20px',
              boxSizing: 'border-box'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
                Customer Credit / Overpayment
              </div>
              <div style={{
                fontSize: '28px',
                fontWeight: 600,
                color: creditOverpayment > 0 ? 'var(--success, #16A34A)' : 'var(--text, #0A0A0A)',
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap'
              }}>
                {formatCurrency(creditOverpayment)}
              </div>
              <div style={{ fontSize: '12px', color: creditOverpayment > 0 ? 'var(--success, #16A34A)' : 'var(--text-muted, #8C8C8C)', marginTop: '6px' }}>
                {creditOverpayment > 0 ? 'Prepaid credit held by company' : 'No excess credit'}
              </div>
            </div>

            {/* Total Cashed Out / Refunds */}
            <div style={{
              background: 'var(--card-bg, #FFFFFF)',
              border: '1px solid var(--border, #E4E4E4)',
              borderRadius: '20px',
              padding: '18px 20px',
              boxSizing: 'border-box'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
                Refunds Disbursed
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {formatCurrency(totalRefunded)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '6px' }}>
                Cash refunded to client
              </div>
            </div>
          </div>

          {/* Customer Profile & Info Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px'
          }}>
            <div style={{
              background: 'var(--card-bg, #FFFFFF)',
              border: '1px solid var(--border, #E4E4E4)',
              borderRadius: '20px',
              padding: '20px 24px',
              boxSizing: 'border-box'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text, #0A0A0A)', margin: '0 0 16px 0', letterSpacing: '-0.01em' }}>
                Contact & Account Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>Full Name:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text, #111111)' }}>{customer?.name || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>Company:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text, #111111)' }}>{customer?.company_name || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>Phone:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text, #111111)' }}>{customer?.phone || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>Email:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text, #111111)' }}>{customer?.email || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>Billing Address:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text, #111111)', maxWidth: '60%', textAlign: 'right' }}>
                    {customer?.address || '—'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{
              background: 'var(--card-bg, #FFFFFF)',
              border: '1px solid var(--border, #E4E4E4)',
              borderRadius: '20px',
              padding: '20px 24px',
              boxSizing: 'border-box'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text, #0A0A0A)', margin: '0 0 16px 0', letterSpacing: '-0.01em' }}>
                Account Standing & Net Balance
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)' }}>Net Signed Balance:</span>
                  <span style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    color: (ledger?.closing_balance || 0) > 0 ? 'var(--danger, #DC2626)' : (ledger?.closing_balance || 0) < 0 ? 'var(--success, #16A34A)' : 'var(--text, #111111)'
                  }}>
                    {formatCurrency(ledger?.closing_balance || 0, true)}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', lineHeight: 1.5 }}>
                  {ledger?.closing_balance > 0
                    ? `Customer owes the company SAR ${formatCurrency(ledger.closing_balance).replace('SAR ', '')} across active contracts and billing.`
                    : ledger?.closing_balance < 0
                    ? `Company holds SAR ${formatCurrency(Math.abs(ledger.closing_balance)).replace('SAR ', '')} in prepaid credit/overpayment on behalf of the customer.`
                    : 'Customer account is completely settled with zero outstanding balance.'}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => updateQuery({ tab: 'statement', page: 1 })}
                    style={{
                      fontSize: '12px',
                      color: 'var(--text, #111111)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    View detailed ledger statement <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Latest 5 Transactions Preview */}
          <div style={{
            background: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '20px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border, #E4E4E4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text, #0A0A0A)', margin: 0, letterSpacing: '-0.01em' }}>
                Recent Activity
              </h3>
              <button
                type="button"
                onClick={() => updateQuery({ tab: 'transactions', page: 1 })}
                style={{
                  fontSize: '12px',
                  color: 'var(--text, #111111)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                View all transactions ({statementRows.length})
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)', background: 'var(--bg-muted, #FAFAFA)' }}>
                    <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)' }}>Date</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)' }}>Ref</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)' }}>Type</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)' }}>Description</th>
                    <th style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)' }}>Debit</th>
                    <th style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)' }}>Credit</th>
                    <th style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statementRows.slice(-5).reverse().map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border, #E4E4E4)' }}>
                      <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>{r.date}</td>
                      <td style={{ padding: '12px 18px', fontWeight: 500 }}>{r.ref}</td>
                      <td style={{ padding: '12px 18px' }}>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: r.type === 'refund' ? '#FEE2E2' : r.type === 'payment' ? '#DCFCE7' : 'var(--bg-muted, #F4F4F5)',
                          color: r.type === 'refund' ? '#991B1B' : r.type === 'payment' ? '#166534' : 'var(--text, #111111)'
                        }}>
                          {r.type_label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 18px', color: 'var(--text-muted, #71717A)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.description}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {r.debit > 0 ? formatCurrency(r.debit) : '—'}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {r.credit > 0 ? formatCurrency(r.credit) : '—'}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(r.running_balance, true)}
                      </td>
                    </tr>
                  ))}
                  {statementRows.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted, #8C8C8C)' }}>
                        No transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STATEMENT */}
      {currentTab === 'statement' && (
        <StatementSheet
          entityType="customer"
          entity={customer}
          ledger={ledger}
          settings={settings}
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={({ start_date, end_date }) => updateQuery({ start_date, end_date, page: 1 })}
          onRefresh={fetchData}
          isRefreshing={loading}
        />
      )}

      {/* TAB 3: TRANSACTIONS */}
      {currentTab === 'transactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Controls: Type Filter + Search */}
          <div style={{
            background: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '20px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            flexWrap: 'wrap',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {TYPE_FILTERS.map((tf) => {
                const isSelected = transactionType === tf.value
                return (
                  <button
                    key={tf.value}
                    type="button"
                    onClick={() => {
                      setTransactionType(tf.value)
                      updateQuery({ page: 1 })
                    }}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 500,
                      border: isSelected ? '1px solid #0A0A0A' : '1px solid var(--border, #E4E4E4)',
                      background: isSelected ? '#0A0A0A' : 'transparent',
                      color: isSelected ? '#FFFFFF' : 'var(--text, #111111)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tf.label}
                  </button>
                )
              })}
            </div>

            <div style={{ width: '280px' }}>
              <CredSearchInput
                value={searchQuery}
                onChange={(val) => updateQuery({ search: val, page: 1 })}
                placeholder="Search transactions..."
              />
            </div>
          </div>

          {/* Transactions Table */}
          <div style={{
            background: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '20px',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)', background: 'var(--bg-muted, #FAFAFA)' }}>
                    <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', width: '110px' }}>Date</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', width: '130px' }}>Ref #</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', width: '120px' }}>Type</th>
                    <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)' }}>Particulars / Description</th>
                    <th style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', width: '120px' }}>Amount</th>
                    <th style={{ padding: '12px 18px', textAlign: 'center', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', width: '110px' }}>Status</th>
                    <th style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', width: '130px' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((r) => {
                    const isDebit = r.debit > 0
                    const amt = isDebit ? r.debit : r.credit
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border, #E4E4E4)' }}>
                        <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>{r.date}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 500 }}>{r.ref}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: r.type === 'refund' ? '#FEE2E2' : r.type === 'payment' ? '#DCFCE7' : '#F4F4F5',
                            color: r.type === 'refund' ? '#991B1B' : r.type === 'payment' ? '#166534' : 'var(--text, #111111)'
                          }}>
                            {r.type_label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px', color: 'var(--text, #111111)' }}>{r.description}</td>
                        <td style={{
                          padding: '12px 18px',
                          textAlign: 'right',
                          fontWeight: 500,
                          fontVariantNumeric: 'tabular-nums',
                          color: isDebit ? 'var(--text, #111111)' : 'var(--success, #16A34A)'
                        }}>
                          {amt > 0 ? (isDebit ? `+ ${formatCurrency(amt)}` : `- ${formatCurrency(amt)}`) : '—'}
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'var(--bg-muted, #F4F4F5)',
                            color: 'var(--text-muted, #71717A)'
                          }}>
                            {r.status || 'Recorded'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(r.running_balance, true)}
                        </td>
                      </tr>
                    )
                  })}
                  {transactionRows.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted, #8C8C8C)' }}>
                        No transactions found matching your filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <CredPagination
              page={currentPage}
              totalPages={totalTransactionPages}
              rangeStart={(currentPage - 1) * pageSize + 1}
              rangeEnd={Math.min(currentPage * pageSize, transactionRows.length)}
              total={transactionRows.length}
              onPageChange={(p) => updateQuery({ page: p })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

