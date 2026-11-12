import React, { useState, useMemo, useRef } from 'react'
import { RefreshCw, Printer, Download, Calendar, Filter } from 'lucide-react'
import PlainFilterDropdown from '../common/PlainFilterDropdown'
import { DATE_PRESETS, formatStatementDate } from '../../utils/datePresets'
import { handlePdfResponse } from '../../utils/pdfDownload'
import api from '../../api'

/**
 * StatementSheet
 * Zoho-style Statement of Accounts component shared by CustomerDetail and VendorDetail.
 * - Displays an authentic A4 sheet container on a calm neutral canvas.
 * - Displays exact parity with the PDF: logo, bilingual legal company details,
 *   structured To: recipient block, Account Summary box, dark charcoal ledger table header (#1E293B),
 *   opening balance row, and right-aligned Balance Due / Balance Payable footer.
 * - Negative customer balances render as "Credit Balance" with CR.
 */
export default function StatementSheet({
  entityType = 'customer',
  entity = {},
  ledger = {},
  settings = {},
  startDate = '',
  endDate = '',
  onDateRangeChange,
  onRefresh,
  isRefreshing = false
}) {
  const [filterType, setFilterType] = useState('all')
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [showCustomDates, setShowCustomDates] = useState(false)
  const printIframeRef = useRef(null)

  const isCustomer = entityType === 'customer'
  const currency = settings?.currency || 'SAR'

  // Format currency
  const formatAmt = (val, isCR = false) => {
    const num = parseFloat(val || 0)
    const formatted = Math.abs(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    if (isCR) {
      return `${currency} ${formatted} CR`
    }
    return `${currency} ${formatted}`
  }

  // Format table number cells (omit currency symbol in table data cells to keep clean)
  const formatNumCell = (val) => {
    const num = parseFloat(val || 0)
    if (!num) return ''
    return Math.abs(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  // Determine current active preset
  const activePresetValue = useMemo(() => {
    if (!startDate && !endDate) return 'all_time'
    for (const p of DATE_PRESETS) {
      if (p.value === 'all_time') continue
      const pStart = typeof p.start === 'function' ? p.start() : p.start
      const pEnd = typeof p.end === 'function' ? p.end() : p.end
      if (startDate === pStart && endDate === pEnd) {
        return p.value
      }
    }
    return 'custom'
  }, [startDate, endDate])

  // Period dropdown options
  const periodOptions = useMemo(() => {
    return [
      { value: 'all_time', label: 'All Time' },
      { value: 'this_month', label: 'This Month' },
      { value: 'last_month', label: 'Last Month' },
      { value: 'last_30_days', label: 'Last 30 Days' },
      { value: 'this_year', label: 'This Year' },
      { value: 'custom', label: 'Custom Range...' }
    ]
  }, [])

  // Filter By dropdown options
  const filterOptions = useMemo(() => {
    if (isCustomer) {
      return [
        { value: 'all', label: 'Filter By: All' },
        { value: 'job_order', label: 'Filter By: Job Orders' },
        { value: 'invoice', label: 'Filter By: Tax Invoices' },
        { value: 'payment', label: 'Filter By: Payments' },
        { value: 'credit_note', label: 'Filter By: Credit Notes' },
        { value: 'refund', label: 'Filter By: Refunds' }
      ]
    }
    return [
      { value: 'all', label: 'Filter By: All' },
      { value: 'expense', label: 'Filter By: Expense Bills' },
      { value: 'job_allowance', label: 'Filter By: Contract Allowances' },
      { value: 'labour', label: 'Filter By: Labour Work' },
      { value: 'payment', label: 'Filter By: Vendor Payments' }
    ]
  }, [isCustomer])

  const handlePeriodChange = (val) => {
    if (val === 'custom') {
      setShowCustomDates(true)
      return
    }
    setShowCustomDates(false)
    const preset = DATE_PRESETS.find(p => p.value === val)
    if (preset) {
      const s = typeof preset.start === 'function' ? preset.start() : preset.start
      const e = typeof preset.end === 'function' ? preset.end() : preset.end
      if (onDateRangeChange) {
        onDateRangeChange({ start_date: s, end_date: e })
      }
    }
  }

  // Filter rows without altering ledger running balance
  const allRows = ledger?.rows || []
  const displayedRows = useMemo(() => {
    if (filterType === 'all') return allRows
    return allRows.filter(r => {
      if (r.type === 'opening_balance' || r.id === 'opening-balance-row') return true
      if (isCustomer) {
        if (filterType === 'invoice') return r.type === 'invoice' || r.type === 'invoice_ref'
        return r.type === filterType
      }
      if (filterType === 'labour') return r.type === 'labour' || r.type === 'labour_payment'
      return r.type === filterType
    })
  }, [allRows, filterType, isCustomer])

  // PDF Download
  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true)
      const endpoint = isCustomer
        ? `/customers/${entity.id}/statement-pdf/`
        : `/vendors/${entity.id}/statement-pdf/`
      const res = await api.get(endpoint, {
        params: {
          start_date: startDate || undefined,
          end_date: endDate || undefined
        },
        responseType: 'blob'
      })
      const defaultFilename = `${entityType}_statement_${entity.id}.pdf`
      handlePdfResponse(res, defaultFilename)
    } catch (err) {
      console.error('Failed to download statement PDF:', err)
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  // Print using PDF blob to ensure 100% parity with new-tab fallback
  const handlePrint = async () => {
    let blobUrl = null
    try {
      setIsPrinting(true)
      const endpoint = isCustomer
        ? `/customers/${entity.id}/statement-pdf/`
        : `/vendors/${entity.id}/statement-pdf/`
      const res = await api.get(endpoint, {
        params: {
          start_date: startDate || undefined,
          end_date: endDate || undefined
        },
        responseType: 'blob'
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      blobUrl = window.URL.createObjectURL(blob)

      // Use hidden iframe to trigger native browser print on exact PDF stream
      let iframe = document.getElementById('statement-print-frame')
      if (!iframe) {
        iframe = document.createElement('iframe')
        iframe.id = 'statement-print-frame'
        iframe.style.position = 'fixed'
        iframe.style.right = '0'
        iframe.style.bottom = '0'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = '0'
        document.body.appendChild(iframe)
      }

      let printTriggered = false
      const fallbackToTab = () => {
        if (!printTriggered && blobUrl) {
          printTriggered = true
          window.open(blobUrl, '_blank')
        }
      }

      iframe.onerror = fallbackToTab
      iframe.onload = () => {
        try {
          iframe.contentWindow.focus()
          iframe.contentWindow.print()
          printTriggered = true
        } catch (e) {
          fallbackToTab()
        }
      }

      // 1.5s fallback guard for browsers where PDF object plugin suppresses iframe onload
      setTimeout(() => {
        if (!printTriggered) {
          fallbackToTab()
        }
      }, 1500)

      iframe.src = blobUrl
    } catch (err) {
      console.error('Failed to print statement PDF:', err)
      if (blobUrl) {
        window.open(blobUrl, '_blank')
      }
    } finally {
      setIsPrinting(false)
    }
  }

  const periodText = ledger?.period?.period_text || 'All Time'
  const accountSummary = ledger?.account_summary || []
  const closingBal = parseFloat(ledger?.closing_balance || 0)
  const isCreditBalance = isCustomer && closingBal < 0

  const companyLegalEn = settings.legal_name_en || settings.company_name || 'Arab Season'
  const companyLegalAr = settings.legal_name_ar || ''
  const companyTrn = settings.tax_number || ''
  const companyAddress = settings.address || 'Riyadh, KSA'
  const companyPhone = settings.phone || '0575287403'
  const companyEmail = settings.email || 'ad@arabseason.net'
  const companyWeb = settings.website || 'www.arabseason.club'

  const recipientName = entity.name || (isCustomer ? 'Valued Customer' : 'Valued Vendor')
  const recipientCompany = entity.company_name || entity.company || ''
  const recipientAddress = entity.address || ''
  const recipientTaxNumber = entity.tax_number || ''
  const recipientPhone = entity.phone || ''

  return (
    <div className="statement-sheet-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Zoho Books Toolbar */}
      <div
        className="statement-toolbar no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          background: 'var(--card-bg, #FFFFFF)',
          border: '1px solid var(--border, #E4E4E4)',
          borderRadius: '16px',
          padding: '12px 18px',
          boxSizing: 'border-box'
        }}
      >
        {/* Left: Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '150px' }}>
            <PlainFilterDropdown
              options={periodOptions}
              value={activePresetValue}
              onChange={handlePeriodChange}
              icon={Calendar}
              placeholder="Select Period"
            />
          </div>

          <div style={{ minWidth: '170px' }}>
            <PlainFilterDropdown
              options={filterOptions}
              value={filterType}
              onChange={setFilterType}
              icon={Filter}
              placeholder="Filter By"
            />
          </div>

          {/* Inline Custom Date Range Pickers */}
          {showCustomDates && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-muted, #F8FAFC)', padding: '4px 10px', borderRadius: '10px', border: '1px solid var(--border, #E4E4E4)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748B)' }}>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onDateRangeChange && onDateRangeChange({ start_date: e.target.value, end_date: endDate })}
                style={{ fontSize: '12px', border: '1px solid var(--border, #E4E4E4)', borderRadius: '6px', padding: '3px 6px', background: '#FFFFFF' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748B)' }}>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onDateRangeChange && onDateRangeChange({ start_date: startDate, end_date: e.target.value })}
                style={{ fontSize: '12px', border: '1px solid var(--border, #E4E4E4)', borderRadius: '6px', padding: '3px 6px', background: '#FFFFFF' }}
              />
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh Statement Data"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                border: '1px solid var(--border, #E4E4E4)',
                background: 'var(--card-bg, #FFFFFF)',
                color: 'var(--text, #1E293B)',
                cursor: isRefreshing ? 'wait' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            title="Print Statement (A4)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 14px',
              height: '38px',
              borderRadius: '10px',
              border: '1px solid var(--border, #E4E4E4)',
              background: 'var(--card-bg, #FFFFFF)',
              color: 'var(--text, #1E293B)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: isPrinting ? 'wait' : 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Printer size={15} />
            <span>{isPrinting ? 'Preparing...' : 'Print'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            title="Download Statement PDF"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 14px',
              height: '38px',
              borderRadius: '10px',
              border: '1px solid var(--border, #E4E4E4)',
              background: 'var(--card-bg, #FFFFFF)',
              color: 'var(--text, #1E293B)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: isDownloadingPdf ? 'wait' : 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Download size={15} />
            <span>{isDownloadingPdf ? 'Generating...' : 'PDF'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Document Caption */}
      <div style={{ textAlign: 'center', marginTop: '4px', marginBottom: '4px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text, #0F172A)', margin: 0 }}>
          {isCustomer ? 'Customer Statement for ' : 'Vendor Statement for '}
          {recipientName}
        </h2>
        <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', marginTop: '3px' }}>
          {periodText}
        </div>
      </div>

      {/* 3. A4 Paper Canvas */}
      <div
        className="statement-paper-canvas"
        style={{
          background: '#FFFFFF',
          width: '100%',
          maxWidth: '820px',
          margin: '0 auto',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
          borderRadius: '4px',
          border: '1px solid #E2E8F0',
          padding: '48px 48px',
          boxSizing: 'border-box',
          fontFamily: 'var(--font-ui, system-ui, sans-serif)',
          color: '#1E293B',
          lineHeight: 1.45
        }}
      >
        {/* Paper Header: Logo on Left, Company Details on Right */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', borderBottom: '1px solid #F1F5F9', paddingBottom: '24px' }}>
          <div style={{ flexShrink: 0 }}>
            <img
              src="/logo_colored_wordmark.png"
              alt="Arab Season"
              style={{ width: '160px', height: 'auto', maxHeight: '52px', objectFit: 'contain' }}
              onError={(e) => {
                e.target.src = '/logo_black.png'
              }}
            />
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: '#334155', maxWidth: '340px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>{companyLegalEn}</div>
            {companyLegalAr && (
              <div style={{ fontWeight: 600, fontSize: '12px', color: '#0F172A', marginTop: '1px', direction: 'rtl' }}>
                {companyLegalAr}
              </div>
            )}
            {companyTrn && <div style={{ color: '#475569', marginTop: '2px' }}>TRN {companyTrn}</div>}
            <div style={{ color: '#64748B', marginTop: '2px' }}>{companyAddress}</div>
            <div style={{ color: '#64748B' }}>{companyPhone}</div>
            <div style={{ color: '#64748B' }}>
              {companyEmail} {companyWeb ? ` - ${companyWeb}` : ''}
            </div>
          </div>
        </div>

        {/* Paper Subheader: Recipient ("To:") on Left, Statement of Accounts & Account Summary Box on Right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '24px', marginTop: '24px', alignItems: 'flex-start' }}>
          {/* Recipient Block */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>{recipientName}</div>
            {recipientCompany && recipientCompany.toLowerCase().trim() !== recipientName.toLowerCase().trim() && (
              <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>{recipientCompany}</div>
            )}
            {recipientAddress && (
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px', whiteSpace: 'pre-line' }}>{recipientAddress}</div>
            )}
            {recipientTaxNumber && (
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px', fontWeight: 500 }}>TRN {recipientTaxNumber}</div>
            )}
            {recipientPhone && (
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>Tel: {recipientPhone}</div>
            )}
          </div>

          {/* Statement Meta & Account Summary Box */}
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Statement of Accounts</h1>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px', marginBottom: '12px' }}>{periodText}</div>

            {/* Boxed Account Summary Table */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                overflow: 'hidden',
                textAlign: 'left'
              }}
            >
              <div
                style={{
                  padding: '6px 12px',
                  background: '#F1F5F9',
                  borderBottom: '1px solid #E2E8F0',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#0F172A'
                }}
              >
                Account Summary
              </div>
              <div style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {accountSummary.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '11px',
                      color: item.key.includes('balance') ? '#0F172A' : '#475569',
                      fontWeight: item.key.includes('balance') ? 700 : 400
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: item.is_cr ? '#16A34A' : 'inherit' }}>
                      {formatAmt(item.amount, item.is_cr)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Notice Banner */}
        {filterType !== 'all' && (
          <div
            style={{
              marginTop: '16px',
              padding: '6px 12px',
              background: '#EFF6FF',
              border: '1px solid #DBEAFE',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#1E40AF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>Note: Showing filtered rows only. Historical running balances reflect the full ledger.</span>
          </div>
        )}

        {/* Ledger Table */}
        <div style={{ marginTop: '24px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '11.5px',
              border: '1px solid #E2E8F0'
            }}
          >
            <thead>
              <tr style={{ background: '#1E293B', color: '#FFFFFF' }}>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, width: '90px' }}>Date</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, width: '130px' }}>Transactions</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Details</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, width: '95px' }}>Amount</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, width: '95px' }}>Payments</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, width: '110px' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((r, idx) => {
                const isOb = r.transactions === '***Opening Balance***' || r.type === 'opening_balance'
                const isCR = isCustomer && r.balance < 0

                return (
                  <tr
                    key={r.id || idx}
                    style={{
                      borderBottom: '1px solid #E2E8F0',
                      background: isOb ? '#F8FAFC' : (idx % 2 === 1 ? '#FAFAFA' : '#FFFFFF')
                    }}
                  >
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: '#475569', whiteSpace: 'nowrap' }}>
                      {formatStatementDate(r.date)}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: isOb ? 700 : 500, color: isOb ? '#0F172A' : '#1E293B' }}>
                      {r.transactions}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#64748B' }}>
                      <div>{r.details}</div>
                      {r.ref && r.ref !== 'OPENING-BAL' && (
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>Ref: {r.ref}</div>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#0F172A' }}>
                      {formatNumCell(r.amount)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#0F172A' }}>
                      {formatNumCell(r.payments)}
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        textAlign: 'right',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        color: isCR ? '#16A34A' : (r.balance > 0 ? '#DC2626' : '#0F172A')
                      }}
                    >
                      {isCR ? `${formatNumCell(r.balance)} CR` : formatNumCell(r.balance)}
                    </td>
                  </tr>
                )
              })}

              {displayedRows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                    No transactions found for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Balance Due / Payable Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: isCreditBalance ? '#16A34A' : '#0F172A' }}>
            {isCustomer ? (
              isCreditBalance ? (
                <span>Credit Balance: {formatAmt(closingBal, true)}</span>
              ) : (
                <span>Balance Due: {formatAmt(closingBal)}</span>
              )
            ) : (
              <span>Balance Payable: {formatAmt(closingBal, closingBal < 0)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

