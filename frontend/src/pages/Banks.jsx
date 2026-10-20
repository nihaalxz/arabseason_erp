import { useState, useEffect } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import * as XLSX from 'xlsx'
import { 
  Landmark, Plus, RefreshCw, AlertCircle, Edit, Trash2, 
  Search, Check, X, Building2, CreditCard, Wallet, Copy, CheckCheck, ExternalLink,
  FileText, Download, Printer, ArrowDownLeft, ArrowUpRight, Calendar, Filter, ChevronRight, FileSpreadsheet, ArrowUpDown, ChevronDown
} from '../components/icons'
import api from '../api'
import Modal from '../components/common/Modal'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { handlePdfResponse } from '../utils/pdfDownload'
import { showConfirm, showError, showToast } from '../utils/swal'

const POPULAR_BANKS = [
  'Al Rajhi Bank',
  'SNB AlAhli (National Commercial Bank)',
  'Riyad Bank',
  'Alinma Bank',
  'Banque Saudi Fransi',
  'Arab National Bank (ANB)',
  'Saudi Awwal Bank (SAB)',
  'Bank AlJazira',
  'Bank Albilad',
  'Gulf International Bank (GIB)'
]

const Banks = () => {
  // Navigation State: 'accounts' | 'statements'
  const [activeTab, setActiveTab] = useState('accounts')

  // Accounts List State
  const [banks, setBanks] = useState([])
  const [summary, setSummary] = useState({ total_balance: 0, active_accounts: 0, total_accounts: 0, currency: 'SAR' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [copiedId, setCopiedId] = useState(null)

  // Statement State
  const [selectedBankId, setSelectedBankId] = useState(null)
  const [statementData, setStatementData] = useState(null)
  const [statementLoading, setStatementLoading] = useState(false)
  const [statementError, setStatementError] = useState('')
  const [statementStartDate, setStatementStartDate] = useState('')
  const [statementEndDate, setStatementEndDate] = useState('')
  const [statementSearch, setStatementSearch] = useState('')
  const [statementFlowType, setStatementFlowType] = useState('all') // 'all' | 'in' | 'out'
  const [statementQuickPreset, setStatementQuickPreset] = useState('all')
  const [statementSort, setStatementSort] = useState('asc') // 'asc' = oldest to newest | 'desc' = newest to oldest

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBank, setEditingBank] = useState(null)
  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    account_holder_name: '',
    iban: '',
    branch_name: '',
    balance: '0.00',
    currency: 'SAR',
    status: 'Active',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const { formatCurrency } = useSettings()

  const safeFormatAmount = (val) => {
    try {
      const num = parseFloat(val || 0)
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    } catch (e) {
      return val || '0.00'
    }
  }

  const fetchBanks = async () => {
    try {
      setLoading(true)
      const params = {}
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (statusFilter !== 'All') params.status = statusFilter

      const [resBanks, resSummary] = await Promise.all([
        api.get('banks/', { params }),
        api.get('banks/summary/')
      ])

      const data = resBanks.data.results || resBanks.data || []
      setBanks(data)
      if (resSummary.data) {
        setSummary(resSummary.data)
      }
      if (!selectedBankId && data.length > 0) {
        setSelectedBankId(data[0].id)
      }
      setError('')
    } catch (err) {
      console.error('Fetch banks error:', err)
      setError('Failed to fetch bank accounts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBanks()
  }, [statusFilter])

  // Fetch Statement for selected bank
  const fetchStatement = async (bankId, start = statementStartDate, end = statementEndDate, flow = statementFlowType, search = statementSearch) => {
    const targetId = bankId || selectedBankId
    if (!targetId) return
    try {
      setStatementLoading(true)
      setStatementError('')
      const params = {}
      if (start) params.start_date = start
      if (end) params.end_date = end
      if (flow && flow !== 'all') params.flow_type = flow
      if (search && search.trim()) params.search = search.trim()

      const res = await api.get(`banks/${targetId}/statement/`, { params })
      setStatementData(res.data)
    } catch (err) {
      console.error('Fetch statement error:', err)
      setStatementError('Failed to fetch bank statement.')
    } finally {
      setStatementLoading(false)
    }
  }

  // Reload statement when bank or filters change
  useEffect(() => {
    if (activeTab === 'statements' && selectedBankId) {
      fetchStatement(selectedBankId, statementStartDate, statementEndDate, statementFlowType, statementSearch)
    }
  }, [selectedBankId, activeTab, statementStartDate, statementEndDate, statementFlowType])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchBanks()
  }

  const handleStatementSearchSubmit = (e) => {
    e.preventDefault()
    fetchStatement(selectedBankId, statementStartDate, statementEndDate, statementFlowType, statementSearch)
  }

  const handleViewStatement = (bankId) => {
    setSelectedBankId(bankId)
    setActiveTab('statements')
    fetchStatement(bankId, statementStartDate, statementEndDate, statementFlowType, statementSearch)
  }

  // Quick Date Preset Handler
  const applyQuickDatePreset = (preset) => {
    setStatementQuickPreset(preset)
    const now = new Date()
    const formatDate = (d) => d.toISOString().split('T')[0]

    if (preset === 'all') {
      setStatementStartDate('')
      setStatementEndDate('')
      return
    }
    if (preset === 'today') {
      const todayStr = formatDate(now)
      setStatementStartDate(todayStr)
      setStatementEndDate(todayStr)
      return
    }
    if (preset === 'this_week') {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
      const monday = new Date(now.setDate(diff))
      setStatementStartDate(formatDate(monday))
      setStatementEndDate(formatDate(new Date()))
      return
    }
    if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      setStatementStartDate(formatDate(firstDay))
      setStatementEndDate(formatDate(new Date()))
      return
    }
    if (preset === 'last_month') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      setStatementStartDate(formatDate(firstDayLastMonth))
      setStatementEndDate(formatDate(lastDayLastMonth))
      return
    }
    if (preset === 'this_year') {
      const firstDayYear = new Date(now.getFullYear(), 0, 1)
      setStatementStartDate(formatDate(firstDayYear))
      setStatementEndDate(formatDate(new Date()))
      return
    }
  }

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!statementData || !statementData.bank) return
    const { bank, summary: stmtSummary, transactions } = statementData
    const wb = XLSX.utils.book_new()

    // Title & Bank Info rows
    const headerRows = [
      ['ARAB SEASON ENTERPRISE LLC'],
      ['OFFICIAL BANK ACCOUNT STATEMENT'],
      [''],
      ['Bank Name:', bank.bank_name, '', 'Account Number:', bank.account_number],
      ['Account Holder:', bank.account_holder_name, '', 'IBAN:', bank.iban || 'N/A'],
      ['Branch / Location:', bank.branch_name || 'Head Office', '', 'Currency:', bank.currency || 'SAR'],
      ['Statement Period:', `${statementStartDate || 'Inception'} to ${statementEndDate || 'Current Date'}`],
      ['Generated On:', new Date().toLocaleString()],
      [''],
      ['STATEMENT FINANCIAL SUMMARY'],
      ['Opening Balance (SAR):', stmtSummary.opening_balance],
      ['Total Deposits / Credits (+ SAR):', stmtSummary.total_credits],
      ['Total Withdrawals / Debits (- SAR):', stmtSummary.total_debits],
      ['Net Period Movement (SAR):', stmtSummary.net_change],
      ['Closing Balance (SAR):', stmtSummary.closing_balance],
      ['Total Transactions:', stmtSummary.transactions_count],
      [''],
      ['Date', 'Time', 'Reference #', 'Description / Particulars', 'Counterparty / Party', 'Category', 'Cashbook', 'Payment Mode', 'Credit / Inflow (+ SAR)', 'Debit / Outflow (- SAR)', 'Running Balance (SAR)']
    ]

    // Sort transactions if needed
    const txList = statementSort === 'desc' ? [...transactions].reverse() : [...transactions]

    const txRows = txList.map(tx => [
      tx.date,
      tx.time || '',
      tx.reference_number,
      tx.remark,
      tx.party_name,
      tx.category,
      tx.cashbook_name,
      tx.payment_mode,
      tx.credit > 0 ? tx.credit : 0,
      tx.debit > 0 ? tx.debit : 0,
      tx.running_balance
    ])

    const footerRows = [
      [''],
      ['CLOSING BALANCE', '', '', '', '', '', '', '', stmtSummary.total_credits, stmtSummary.total_debits, stmtSummary.closing_balance]
    ]

    const allSheetData = [...headerRows, ...txRows, ...footerRows]
    const ws = XLSX.utils.aoa_to_sheet(allSheetData)

    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 10 }, // Time
      { wch: 16 }, // Ref
      { wch: 28 }, // Remark
      { wch: 22 }, // Party
      { wch: 16 }, // Category
      { wch: 16 }, // Cashbook
      { wch: 15 }, // Mode
      { wch: 22 }, // Credit
      { wch: 22 }, // Debit
      { wch: 22 }  // Balance
    ]

    const sheetName = `${bank.bank_name.slice(0, 20)}_Statement`
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    const cleanBank = bank.bank_name.replace(/[^a-zA-Z0-9]/g, '_')
    const fileName = `Statement_${cleanBank}_${statementStartDate || 'Inception'}_to_${statementEndDate || 'Today'}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  // Server-Sided Universal PDF Export Handler
  const [pdfGenerating, setPdfGenerating] = useState(false)

  const handlePrintPDF = async () => {
    if (!selectedBankId) return
    try {
      setPdfGenerating(true)
      const params = {}
      if (statementStartDate) params.start_date = statementStartDate
      if (statementEndDate) params.end_date = statementEndDate
      if (statementFlowType && statementFlowType !== 'all') params.flow_type = statementFlowType
      if (statementSearch && statementSearch.trim()) params.search = statementSearch.trim()
      if (statementSort) params.sort = statementSort

      const res = await api.get(`banks/${selectedBankId}/statement-pdf/`, {
        params,
        responseType: 'blob'
      })

      const bankSlug = (selectedBank?.bank_name || 'bank').toLowerCase().replace(/[^a-z0-9]/g, '_')
      handlePdfResponse(res, `bank_statement_${bankSlug}_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('Server PDF generation error:', err)
      showError('Export Failed', 'Failed to generate server-side bank statement PDF. Please try again.')
    } finally {
      setPdfGenerating(false)
    }
  }

  const handleOpenModal = (bank = null) => {
    setEditingBank(bank)
    setFormError('')
    if (bank) {
      setFormData({
        bank_name: bank.bank_name || '',
        account_number: bank.account_number || '',
        account_holder_name: bank.account_holder_name || '',
        iban: bank.iban || '',
        branch_name: bank.branch_name || '',
        balance: bank.balance !== undefined ? String(bank.balance) : '0.00',
        currency: bank.currency || 'SAR',
        status: bank.status || 'Active',
        notes: bank.notes || ''
      })
    } else {
      setFormData({
        bank_name: '',
        account_number: '',
        account_holder_name: 'Arab Season Enterprise LLC',
        iban: '',
        branch_name: '',
        balance: '0.00',
        currency: 'SAR',
        status: 'Active',
        notes: ''
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.bank_name.trim()) {
      setFormError('Bank name is required.')
      return
    }
    if (!formData.account_number.trim()) {
      setFormError('Account number is required.')
      return
    }

    try {
      setSubmitting(true)
      setFormError('')

      const payload = {
        bank_name: formData.bank_name.trim(),
        account_number: formData.account_number.trim(),
        account_holder_name: formData.account_holder_name.trim(),
        iban: formData.iban.trim(),
        branch_name: formData.branch_name.trim(),
        balance: parseFloat(formData.balance || 0),
        currency: formData.currency || 'SAR',
        status: formData.status || 'Active',
        notes: formData.notes.trim()
      }

      if (editingBank) {
        await api.put(`banks/${editingBank.id}/`, payload)
      } else {
        await api.post('banks/', payload)
      }

      setIsModalOpen(false)
      fetchBanks()
    } catch (err) {
      console.error('Save bank error:', err)
      const detail = err.response?.data
        ? Object.entries(err.response.data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')
        : (err.message || 'Failed to save bank account.')
      setFormError(detail)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id, name) => {
    const confirmed = await showConfirm({
      title: 'Delete Bank Account?',
      text: `Are you sure you want to delete bank account "${name}"? This action cannot be undone.`,
      confirmButtonText: 'Yes, Delete',
      isDangerous: true,
    })
    if (!confirmed) return
    try {
      await api.delete(`banks/${id}/`)
      fetchBanks()
      if (selectedBankId === id) {
        setSelectedBankId(null)
        setStatementData(null)
      }
      showToast('Bank account deleted', 'success')
    } catch (err) {
      console.error('Delete bank error:', err)
      showError('Delete Failed', 'Failed to delete bank account.')
    }
  }

  const handleCopy = (text, id) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1800)
  }

  // Active bank object for statement header
  const activeBankObj = banks.find(b => b.id === selectedBankId) || statementData?.bank || banks[0]

  return (
    <div className="banks-page-container erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Top Header */}
      <div className="page-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main, #0f172a)', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #1366d9 0%, #2563eb 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(19, 102, 217, 0.25)'
            }}>
              <Landmark size={22} />
            </div>
            <span>Banks & Financial Statements</span>
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted, #64748b)', fontSize: '0.825rem' }}>
            Manage corporate bank accounts, monitor liquidity, and generate audited individual bank statements
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (activeTab === 'accounts') fetchBanks()
              else fetchStatement(selectedBankId, statementStartDate, statementEndDate, statementFlowType, statementSearch)
            }}
            disabled={loading || statementLoading}
            title="Refresh data"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', height: '38px' }}
          >
            <RefreshCw size={15} className={loading || statementLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          {activeTab === 'accounts' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenModal()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px', fontWeight: '700' }}
            >
              <Plus size={17} strokeWidth={2.5} />
              <span>Add Bank Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Top View Mode Switcher Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        background: '#f1f5f9',
        padding: '4px',
        borderRadius: '10px',
        marginBottom: '1.25rem',
        width: 'fit-content',
        border: '1px solid #e2e8f0'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 16px',
            borderRadius: '7px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            background: activeTab === 'accounts' ? '#ffffff' : 'transparent',
            color: activeTab === 'accounts' ? '#2563eb' : '#64748b',
            boxShadow: activeTab === 'accounts' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
          }}
        >
          <Building2 size={16} />
          <span>Bank Accounts ({banks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('statements')
            if (selectedBankId) {
              fetchStatement(selectedBankId, statementStartDate, statementEndDate, statementFlowType, statementSearch)
            } else if (banks.length > 0) {
              setSelectedBankId(banks[0].id)
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 16px',
            borderRadius: '7px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            background: activeTab === 'statements' ? '#ffffff' : 'transparent',
            color: activeTab === 'statements' ? '#2563eb' : '#64748b',
            boxShadow: activeTab === 'statements' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
          }}
        >
          <FileText size={16} />
          <span>Individual Bank Statements</span>
        </button>
      </div>

      {error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* =========================================================================
          TAB 1: BANK ACCOUNTS MANAGEMENT
          ========================================================================= */}
      {activeTab === 'accounts' && (
        <>
          {/* KPI Stats Overview */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
            marginBottom: '1.25rem'
          }}>
            {/* Card 1: Total Liquid Balance */}
            <div className="glass-panel" style={{
              background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
              color: '#ffffff',
              borderRadius: '14px',
              padding: '1.25rem',
              boxShadow: '0 8px 24px rgba(4, 120, 87, 0.2)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Bank Balance
                </span>
                <div style={{ background: 'rgba(255,255,255,0.2)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
                {safeFormatAmount(summary.total_balance)} <span style={{ fontSize: '1rem', fontWeight: '600', opacity: 0.85 }}>SAR</span>
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.35rem' }}>
                Aggregated across all registered institutional accounts
              </div>
            </div>

            {/* Card 2: Active Accounts */}
            <div className="glass-panel" style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '1.25rem',
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Active Bank Accounts
                </span>
                <div style={{ background: '#e0f2fe', color: '#0284c7', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>
                {summary.active_accounts} <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#64748b' }}>/ {summary.total_accounts} Total</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.35rem', fontWeight: '600' }}>
                ✓ Ready for transactions and settlements
              </div>
            </div>

            {/* Card 3: Operating Currency */}
            <div className="glass-panel" style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '1.25rem',
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Primary Currency
                </span>
                <div style={{ background: '#f3e8ff', color: '#7e22ce', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>
                SAR <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#64748b' }}>Saudi Riyal</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                Standard national corporate accounting
              </div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="glass-panel" style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            border: '1.5px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '260px' }}>
              <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '380px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem 0.45rem 2rem',
                    borderRadius: '8px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '0.85rem',
                    outline: 'none',
                    background: '#f8fafc'
                  }}
                />
              </div>
              <button type="submit" className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem' }}>
                Search
              </button>
            </form>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '0.85rem',
                  outline: 'none',
                  background: '#ffffff',
                  fontWeight: '600',
                  color: '#1e293b'
                }}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Bank Accounts Table */}
          <div className="table-container" style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1.5px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <SkeletonLoader count={4} />
              </div>
            ) : banks.length === 0 ? (
              <div style={{ padding: '4rem 1.5rem', textAlign: 'center', color: '#64748b' }}>
                <Landmark size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
                <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a', fontSize: '1.1rem' }}>No Bank Accounts Found</h3>
                <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                  {searchQuery ? 'No accounts matched your search terms.' : 'Add your company bank account to begin tracking liquidity.'}
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleOpenModal()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Plus size={16} />
                  <span>Add First Bank Account</span>
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '820px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '0.85rem 1.25rem' }}>Bank & Institution</th>
                      <th style={{ padding: '0.85rem 1.25rem' }}>Account Number & IBAN</th>
                      <th style={{ padding: '0.85rem 1.25rem' }}>Branch / Location</th>
                      <th style={{ padding: '0.85rem 1.25rem' }}>Status</th>
                      <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Current Balance</th>
                      <th style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>Actions & Statement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banks.map((b) => {
                      const isActive = b.status === 'Active'
                      return (
                        <tr 
                          key={b.id} 
                          style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          {/* Bank & Name */}
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '8px',
                                background: '#eff6ff',
                                color: '#2563eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <Landmark size={20} />
                              </div>
                              <div>
                                <div 
                                  onClick={() => handleViewStatement(b.id)}
                                  style={{ fontWeight: '700', color: '#1d4ed8', fontSize: '0.925rem', cursor: 'pointer', textDecoration: 'underline' }}
                                  title="Click to view bank statement"
                                >
                                  {b.bank_name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                  {b.account_holder_name || 'Arab Season Enterprise LLC'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Account Number & IBAN */}
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'monospace', fontWeight: '700', fontSize: '0.9rem', color: '#1e293b' }}>
                              <span>{b.account_number}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(b.account_number, `acc-${b.id}`)}
                                title="Copy Account Number"
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                              >
                                {copiedId === `acc-${b.id}` ? <CheckCheck size={14} color="#16a34a" /> : <Copy size={14} />}
                              </button>
                            </div>
                            {b.iban && (
                              <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>IBAN: {b.iban}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(b.iban, `iban-${b.id}`)}
                                  title="Copy IBAN"
                                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                                >
                                  {copiedId === `iban-${b.id}` ? <CheckCheck size={12} color="#16a34a" /> : <Copy size={12} />}
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Branch */}
                          <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: '#475569' }}>
                            {b.branch_name || 'Head Office'}
                            {b.notes && (
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                {b.notes}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 9px',
                              borderRadius: '999px',
                              fontSize: '0.725rem',
                              fontWeight: '700',
                              background: isActive ? '#ecfdf5' : '#f1f5f9',
                              color: isActive ? '#059669' : '#64748b'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActive ? '#10b981' : '#94a3b8' }} />
                              <span>{b.status}</span>
                            </span>
                          </td>

                          {/* Balance */}
                          <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                            <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#047857' }}>
                              {safeFormatAmount(b.balance)}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                              {b.currency || 'SAR'}
                            </div>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                              <button
                                type="button"
                                onClick={() => handleViewStatement(b.id)}
                                className="btn btn-secondary"
                                title="View Statement for this bank"
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: '#2563eb',
                                  borderColor: '#bfdbfe',
                                  background: '#eff6ff',
                                  fontWeight: '700',
                                  fontSize: '0.78rem'
                                }}
                              >
                                <FileText size={14} />
                                <span>Statement</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenModal(b)}
                                className="btn btn-secondary"
                                title="Edit Bank Account"
                                style={{ padding: '5px 8px', borderRadius: '6px' }}
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(b.id, b.bank_name)}
                                className="btn btn-secondary"
                                title="Delete Bank Account"
                                style={{ padding: '5px 8px', borderRadius: '6px', color: '#dc2626', borderColor: '#fee2e2' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* =========================================================================
          TAB 2: INDIVIDUAL BANK STATEMENTS WITH DATEWISE FILTERING, EXCEL & PDF
          ========================================================================= */}
      {activeTab === 'statements' && (
        <div className="bank-statement-section">
          {/* Top Bank Selection & Metadata Banner */}
          <div className="glass-panel" style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#ffffff',
            borderRadius: '14px',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.25rem',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            {/* Left: Bank Info & Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '300px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(8px)',
                flexShrink: 0
              }}>
                <Landmark size={24} color="#60a5fa" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: '700' }}>
                    Select Account:
                  </span>
                  <select
                    value={selectedBankId || ''}
                    onChange={(e) => setSelectedBankId(Number(e.target.value))}
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      color: '#ffffff',
                      border: '1px solid rgba(255,255,255,0.25)',
                      borderRadius: '8px',
                      padding: '0.4rem 0.75rem',
                      fontWeight: '700',
                      fontSize: '0.95rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {banks.map(b => (
                      <option key={b.id} value={b.id} style={{ background: '#0f172a', color: '#ffffff' }}>
                        {b.bank_name} — {b.account_number} ({safeFormatAmount(b.balance)} SAR)
                      </option>
                    ))}
                  </select>
                </div>
                {activeBankObj && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.4rem', fontSize: '0.78rem', color: '#cbd5e1', flexWrap: 'wrap' }}>
                    <span>Account: <strong>{activeBankObj.account_number}</strong></span>
                    {activeBankObj.iban && <span>IBAN: <strong>{activeBankObj.iban}</strong></span>}
                    <span>Branch: <strong>{activeBankObj.branch_name || 'Head Office'}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Balance & Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right', paddingRight: '0.5rem', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '700' }}>Current Balance</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#34d399' }}>
                  {safeFormatAmount(activeBankObj?.balance || 0)} <span style={{ fontSize: '0.85rem' }}>SAR</span>
                </div>
              </div>

              {/* Excel Export */}
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={statementLoading || !statementData}
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#ffffff',
                  color: '#065f46',
                  fontWeight: '700',
                  fontSize: '0.825rem',
                  border: 'none',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  height: '38px',
                  padding: '0 1rem'
                }}
                title="Export Bank Statement to Microsoft Excel (.xlsx)"
              >
                <FileSpreadsheet size={16} color="#059669" />
                <span>Export Excel</span>
              </button>

              {/* PDF Print / Export */}
              <button
                type="button"
                onClick={handlePrintPDF}
                disabled={statementLoading || !statementData || pdfGenerating}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  fontWeight: '700',
                  fontSize: '0.825rem',
                  height: '38px',
                  padding: '0 1rem'
                }}
                title="Download or Print Server-Sided PDF Bank Statement"
              >
                <Printer size={16} className={pdfGenerating ? 'animate-spin' : ''} />
                <span>{pdfGenerating ? 'Generating PDF...' : 'Print / PDF'}</span>
              </button>
            </div>
          </div>

          {/* Datewise Filtering & Preset Controls */}
          <div className="glass-panel" style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1.5px solid #e2e8f0',
            padding: '1rem',
            marginBottom: '1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            {/* Row 1: Quick Date Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={14} color="#6366f1" />
                <span>Period Presets:</span>
              </span>
              {[
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'this_year', label: 'This Year' }
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyQuickDatePreset(p.id)}
                  style={{
                    padding: '4px 11px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: statementQuickPreset === p.id ? '700' : '600',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: statementQuickPreset === p.id ? '#6366f1' : '#e2e8f0',
                    background: statementQuickPreset === p.id ? '#eef2ff' : '#ffffff',
                    color: statementQuickPreset === p.id ? '#4338ca' : '#64748b',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Row 2: Custom Date Range, Flow Type, Search, and Sort */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #f1f5f9'
            }}>
              {/* Date Inputs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '600' }}>From:</span>
                  <input
                    type="date"
                    value={statementStartDate}
                    onChange={(e) => {
                      setStatementStartDate(e.target.value)
                      setStatementQuickPreset('custom')
                    }}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '7px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.825rem',
                      outline: 'none',
                      color: '#1e293b'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '600' }}>To:</span>
                  <input
                    type="date"
                    value={statementEndDate}
                    onChange={(e) => {
                      setStatementEndDate(e.target.value)
                      setStatementQuickPreset('custom')
                    }}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '7px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.825rem',
                      outline: 'none',
                      color: '#1e293b'
                    }}
                  />
                </div>
                {(statementStartDate || statementEndDate) && (
                  <button
                    type="button"
                    onClick={() => applyQuickDatePreset('all')}
                    style={{
                      background: '#f1f5f9',
                      border: 'none',
                      color: '#64748b',
                      borderRadius: '6px',
                      padding: '0.35rem 0.6rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Clear Dates ✕
                  </button>
                )}
              </div>

              {/* Flow Type Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '600' }}>Movement:</span>
                  <select
                    value={statementFlowType}
                    onChange={(e) => setStatementFlowType(e.target.value)}
                    style={{
                      padding: '0.4rem 0.65rem',
                      borderRadius: '7px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.825rem',
                      outline: 'none',
                      background: '#ffffff',
                      color: '#1e293b',
                      fontWeight: '600'
                    }}
                  >
                    <option value="all">All Movements</option>
                    <option value="in">Credits / Deposits Only</option>
                    <option value="out">Debits / Withdrawals Only</option>
                  </select>
                </div>

                {/* Sort Toggle */}
                <button
                  type="button"
                  onClick={() => setStatementSort(prev => prev === 'asc' ? 'desc' : 'asc')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '7px',
                    border: '1.5px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    color: '#334155',
                    cursor: 'pointer'
                  }}
                  title="Toggle Chronological Order"
                >
                  <ArrowUpDown size={13} />
                  <span>{statementSort === 'asc' ? 'Oldest First' : 'Newest First'}</span>
                </button>

                {/* Search Bar */}
                <form onSubmit={handleStatementSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '8px' }} />
                    <input
                      type="text"
                      value={statementSearch}
                      onChange={(e) => setStatementSearch(e.target.value)}
                      style={{
                        padding: '0.4rem 0.6rem 0.4rem 1.8rem',
                        borderRadius: '7px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.825rem',
                        outline: 'none',
                        width: '190px',
                        background: '#f8fafc'
                      }}
                    />
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                    Go
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Statement Error Display */}
          {statementError && (
            <div style={{
              background: '#fee2e2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem'
            }}>
              <AlertCircle size={18} />
              <span>{statementError}</span>
            </div>
          )}

          {/* Statement KPI Cards */}
          {statementData?.summary && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '0.85rem',
              marginBottom: '1.25rem'
            }}>
              {/* Card 1: Period Opening Balance */}
              <div className="glass-panel" style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '1rem',
                border: '1.5px solid #e2e8f0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: '0.725rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
                  Period Opening Balance
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#334155' }}>
                  {safeFormatAmount(statementData.summary.opening_balance)} <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>SAR</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                  As of {statementStartDate || 'Inception'}
                </div>
              </div>

              {/* Card 2: Total Credits / Inflows */}
              <div className="glass-panel" style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '1rem',
                border: '1.5px solid #bbf7d0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.725rem', fontWeight: '700', textTransform: 'uppercase', color: '#166534' }}>
                    Total Credits (Inflow)
                  </span>
                  <div style={{ background: '#dcfce7', color: '#15803d', width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowDownLeft size={13} />
                  </div>
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#16a34a' }}>
                  +{safeFormatAmount(statementData.summary.total_credits)} <span style={{ fontSize: '0.8rem', color: '#86efac' }}>SAR</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#15803d', marginTop: '2px', fontWeight: '600' }}>
                  Deposits & incoming receipts
                </div>
              </div>

              {/* Card 3: Total Debits / Outflows */}
              <div className="glass-panel" style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '1rem',
                border: '1.5px solid #fde68a',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.725rem', fontWeight: '700', textTransform: 'uppercase', color: '#92400e' }}>
                    Total Debits (Outflow)
                  </span>
                  <div style={{ background: '#fef3c7', color: '#b45309', width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowUpRight size={13} />
                  </div>
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#d97706' }}>
                  -{safeFormatAmount(statementData.summary.total_debits)} <span style={{ fontSize: '0.8rem', color: '#fcd34d' }}>SAR</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#b45309', marginTop: '2px', fontWeight: '600' }}>
                  Payments & outgoing disbursements
                </div>
              </div>

              {/* Card 4: Net Movement */}
              <div className="glass-panel" style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '1rem',
                border: '1.5px solid #e2e8f0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: '0.725rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
                  Net Period Movement
                </div>
                <div style={{
                  fontSize: '1.35rem',
                  fontWeight: '800',
                  color: statementData.summary.net_change >= 0 ? '#16a34a' : '#dc2626'
                }}>
                  {statementData.summary.net_change >= 0 ? '+' : ''}{safeFormatAmount(statementData.summary.net_change)} <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>SAR</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                  Credits minus debits
                </div>
              </div>

              {/* Card 5: Period Closing Balance */}
              <div className="glass-panel" style={{
                background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
                color: '#ffffff',
                borderRadius: '12px',
                padding: '1rem',
                boxShadow: '0 4px 12px rgba(4, 120, 87, 0.2)'
              }}>
                <div style={{ fontSize: '0.725rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.9, marginBottom: '4px' }}>
                  Period Closing Balance
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: '900', letterSpacing: '-0.02em' }}>
                  {safeFormatAmount(statementData.summary.closing_balance)} <span style={{ fontSize: '0.85rem', opacity: 0.85 }}>SAR</span>
                </div>
                <div style={{ fontSize: '0.7rem', opacity: 0.85, marginTop: '2px' }}>
                  Effective liquidity as of {statementEndDate || 'Current Date'}
                </div>
              </div>
            </div>
          )}

          {/* Statement Transactions Table */}
          <div className="table-container" style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1.5px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            {statementLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <SkeletonLoader count={5} />
              </div>
            ) : !statementData ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                Select a bank account to generate statement.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '0.85rem 1rem', width: '100px' }}>Date</th>
                      <th style={{ padding: '0.85rem 1rem', width: '110px' }}>Reference #</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Description & Particulars</th>
                      <th style={{ padding: '0.85rem 1rem', width: '150px' }}>Counterparty</th>
                      <th style={{ padding: '0.85rem 1rem', width: '120px' }}>Category</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'right', width: '130px', color: '#166534' }}>Credit (+ SAR)</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'right', width: '130px', color: '#92400e' }}>Debit (- SAR)</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'right', width: '140px' }}>Balance (SAR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Period Opening Balance Row */}
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '700' }}>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.825rem' }}>
                        {statementStartDate || 'INCEPTION'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                        --
                      </td>
                      <td colSpan={3} style={{ padding: '0.75rem 1rem', color: '#1e293b', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748b' }} />
                          <span>PERIOD OPENING BALANCE BROUGHT FORWARD</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#94a3b8' }}>--</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#94a3b8' }}>--</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '800', color: '#0f172a', fontSize: '0.925rem' }}>
                        {safeFormatAmount(statementData.summary.opening_balance)}
                      </td>
                    </tr>

                    {/* Transaction Rows */}
                    {statementData.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                          <FileText size={36} color="#cbd5e1" style={{ margin: '0 auto 0.75rem' }} />
                          <div style={{ fontWeight: '700', color: '#475569', fontSize: '0.95rem' }}>No Transactions Found</div>
                          <p style={{ margin: '4px 0 0', fontSize: '0.825rem' }}>
                            {statementSearch || statementStartDate || statementEndDate || statementFlowType !== 'all'
                              ? 'No transactions matched the selected period or filters.'
                              : 'This bank account has no recorded transaction history.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      (statementSort === 'desc' ? [...statementData.transactions].reverse() : statementData.transactions).map((tx) => {
                        const isCredit = tx.entry_type === 'in'
                        return (
                          <tr 
                            key={tx.id}
                            style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {/* Date */}
                            <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.825rem', color: '#334155' }}>
                              <div>{tx.date}</div>
                              {tx.time && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{tx.time}</div>}
                            </td>

                            {/* Reference # */}
                            <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b' }}>
                              {tx.reference_number}
                            </td>

                            {/* Description & Particulars */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.875rem' }}>
                                {tx.remark || 'Bank Settlement'}
                              </div>
                              <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>Book: <strong>{tx.cashbook_name}</strong></span>
                                <span>•</span>
                                <span>Mode: {tx.payment_mode}</span>
                                {tx.created_by_name && (
                                  <>
                                    <span>•</span>
                                    <span>User: {tx.created_by_name}</span>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* Counterparty */}
                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.825rem', color: '#334155', fontWeight: '500' }}>
                              {tx.party_name || 'Direct Transaction'}
                            </td>

                            {/* Category */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: '#f1f5f9',
                                color: '#475569',
                                fontSize: '0.725rem',
                                fontWeight: '600'
                              }}>
                                {tx.category || 'General'}
                              </span>
                            </td>

                            {/* Credit (Inflow) */}
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                              {tx.credit > 0 ? (
                                <div style={{ fontWeight: '800', color: '#16a34a', fontSize: '0.925rem' }}>
                                  +{safeFormatAmount(tx.credit)}
                                </div>
                              ) : (
                                <span style={{ color: '#cbd5e1' }}>-</span>
                              )}
                            </td>

                            {/* Debit (Outflow) */}
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                              {tx.debit > 0 ? (
                                <div style={{ fontWeight: '800', color: '#d97706', fontSize: '0.925rem' }}>
                                  -{safeFormatAmount(tx.debit)}
                                </div>
                              ) : (
                                <span style={{ color: '#cbd5e1' }}>-</span>
                              )}
                            </td>

                            {/* Running Balance */}
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                              <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.925rem' }}>
                                {safeFormatAmount(tx.running_balance)}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}

                    {/* Period Closing Totals & Balance Row */}
                    <tr style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1', fontWeight: '800' }}>
                      <td colSpan={5} style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#0f172a', fontSize: '0.85rem' }}>
                        PERIOD CLOSING TOTALS & BALANCE:
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#16a34a', fontSize: '0.95rem', fontWeight: '800' }}>
                        +{safeFormatAmount(statementData.summary.total_credits)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#d97706', fontSize: '0.95rem', fontWeight: '800' }}>
                        -{safeFormatAmount(statementData.summary.total_debits)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#047857', fontSize: '1.05rem', fontWeight: '900' }}>
                        {safeFormatAmount(statementData.summary.closing_balance)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Bank Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBank ? `Edit Bank Account: ${editingBank.bank_name}` : 'Add New Bank Account'}
      >
        <form onSubmit={handleSubmit} style={{ padding: '0.5rem 0' }}>
          {formError && (
            <div style={{
              background: '#fee2e2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              marginBottom: '1rem',
              fontSize: '0.825rem'
            }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Bank Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                Bank Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                list="bank-suggestions"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                required
                className="input-field"
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '7px', border: '1.5px solid #cbd5e1' }}
              />
              <datalist id="bank-suggestions">
                {POPULAR_BANKS.map((bank) => (
                  <option key={bank} value={bank} />
                ))}
              </datalist>
            </div>

            {/* Account Number */}
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                Bank Account Number <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                required
                className="input-field"
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '7px', border: '1.5px solid #cbd5e1', fontFamily: 'monospace' }}
              />
            </div>

            {/* Account Holder & IBAN (2 columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Account Holder Name
                </label>
                <input
                  type="text"
                  value={formData.account_holder_name}
                  onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                  className="input-field"
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '7px', border: '1.5px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  IBAN Number (Optional)
                </label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="input-field"
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '7px', border: '1.5px solid #cbd5e1', fontFamily: 'monospace' }}
                />
              </div>
            </div>

            {/* Balance & Status (2 columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  {editingBank ? 'Current Balance (SAR)' : 'Initial Balance (SAR)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                  className="input-field"
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '7px', border: '1.5px solid #cbd5e1', fontWeight: '700' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Account Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '7px', border: '1.5px solid #cbd5e1', background: '#ffffff', fontWeight: '600' }}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Branch Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                Branch / Location
              </label>
              <input
                type="text"
                value={formData.branch_name}
                onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                className="input-field"
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '7px', border: '1.5px solid #cbd5e1' }}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                Notes / Description
              </label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-field"
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '7px', border: '1.5px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ minWidth: '110px' }}
            >
              {submitting ? 'Saving...' : editingBank ? 'Update Account' : 'Save Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Banks
