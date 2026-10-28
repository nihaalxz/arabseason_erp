import { useState, useEffect } from 'react'
import api from '../../api'
import Modal from '../common/Modal'
import {
  Landmark,
  Wallet,
  Plus,
  Edit,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Check,
  BuildingLibrary,
  Copy
} from '../icons'
import { showConfirm, showToast, showError, showSuccess } from '../../utils/swal'

const ManageBanksPettyCash = () => {
  const [subTab, setSubTab] = useState('banks') // 'banks' | 'petty_cash'
  const [banks, setBanks] = useState([])
  const [pettyCashAccounts, setPettyCashAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  // Modals state
  const [isBankModalOpen, setIsBankModalOpen] = useState(false)
  const [isPettyModalOpen, setIsPettyModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Bank Form State
  const [bankForm, setBankForm] = useState({
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

  // Petty Cash Form State
  const [pettyForm, setPettyForm] = useState({
    name: '',
    holder_name: '',
    balance: '0.00',
    currency: 'SAR',
    status: 'Active',
    notes: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [banksRes, pettyRes] = await Promise.all([
        api.get('banks/'),
        api.get('petty-cash-accounts/')
      ])
      setBanks(banksRes.data || [])
      setPettyCashAccounts(pettyRes.data || [])
    } catch (err) {
      console.error('Failed to load banking data:', err)
      showError('Could not load bank and petty cash accounts.')
    } finally {
      setLoading(false)
    }
  }

  // Copy helper
  const handleCopy = (text, label) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    showToast(`${label} copied to clipboard!`, 'info')
  }

  // Open Bank Modal
  const handleOpenBankModal = (bank = null) => {
    if (bank) {
      setEditingItem(bank)
      setBankForm({
        bank_name: bank.bank_name || '',
        account_number: bank.account_number || '',
        account_holder_name: bank.account_holder_name || '',
        iban: bank.iban || '',
        branch_name: bank.branch_name || '',
        balance: bank.balance !== undefined && bank.balance !== null ? String(bank.balance) : '0.00',
        currency: bank.currency || 'SAR',
        status: bank.status || 'Active',
        notes: bank.notes || ''
      })
    } else {
      setEditingItem(null)
      setBankForm({
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
    setIsBankModalOpen(true)
  }

  // Save Bank
  const handleSaveBank = async (e) => {
    e.preventDefault()
    if (!bankForm.bank_name.trim()) {
      showError('Bank name is required.')
      return
    }
    if (!bankForm.account_number.trim()) {
      showError('Account number is required.')
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        bank_name: bankForm.bank_name.trim(),
        account_number: bankForm.account_number.trim(),
        account_holder_name: bankForm.account_holder_name.trim(),
        iban: bankForm.iban.trim(),
        branch_name: bankForm.branch_name.trim(),
        balance: parseFloat(bankForm.balance) || 0,
        currency: bankForm.currency || 'SAR',
        status: bankForm.status,
        notes: bankForm.notes.trim()
      }

      if (editingItem) {
        await api.put(`banks/${editingItem.id}/`, payload)
        showSuccess('Bank account updated successfully!')
      } else {
        await api.post('banks/', payload)
        showSuccess('New bank account created successfully!')
      }

      setIsBankModalOpen(false)
      fetchData()
    } catch (err) {
      console.error('Error saving bank account:', err)
      const detail = err.response?.data?.detail || err.response?.data?.bank_name?.[0] || 'Failed to save bank account.'
      showError(detail)
    } finally {
      setSubmitting(false)
    }
  }

  // Delete Bank
  const handleDeleteBank = async (bank) => {
    const confirmed = await showConfirm({
      title: 'Delete Bank Account?',
      text: `Are you sure you want to remove "${bank.bank_name}" (${bank.account_number})? This action cannot be undone.`,
      confirmButtonText: 'Yes, Delete',
      isDangerous: true,
      icon: 'warning'
    })

    if (!confirmed) return

    try {
      await api.delete(`banks/${bank.id}/`)
      showSuccess('Bank account removed.')
      fetchData()
    } catch (err) {
      console.error('Failed to delete bank:', err)
      showError(err.response?.data?.detail || 'Failed to delete bank account. It may have associated transactions.')
    }
  }

  // Open Petty Cash Modal
  const handleOpenPettyModal = (account = null) => {
    if (account) {
      setEditingItem(account)
      setPettyForm({
        name: account.name || '',
        holder_name: account.holder_name || '',
        balance: account.balance !== undefined && account.balance !== null ? String(account.balance) : '0.00',
        currency: account.currency || 'SAR',
        status: account.status || 'Active',
        notes: account.notes || ''
      })
    } else {
      setEditingItem(null)
      setPettyForm({
        name: '',
        holder_name: '',
        balance: '0.00',
        currency: 'SAR',
        status: 'Active',
        notes: ''
      })
    }
    setIsPettyModalOpen(true)
  }

  // Save Petty Cash Account
  const handleSavePetty = async (e) => {
    e.preventDefault()
    if (!pettyForm.name.trim()) {
      showError('Account name is required.')
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        name: pettyForm.name.trim(),
        holder_name: pettyForm.holder_name.trim(),
        balance: parseFloat(pettyForm.balance) || 0,
        currency: pettyForm.currency || 'SAR',
        status: pettyForm.status,
        notes: pettyForm.notes.trim()
      }

      if (editingItem) {
        await api.put(`petty-cash-accounts/${editingItem.id}/`, payload)
        showSuccess('Petty cash account updated successfully!')
      } else {
        await api.post('petty-cash-accounts/', payload)
        showSuccess('New petty cash account created successfully!')
      }

      setIsPettyModalOpen(false)
      fetchData()
    } catch (err) {
      console.error('Error saving petty cash account:', err)
      const detail = err.response?.data?.detail || err.response?.data?.name?.[0] || 'Failed to save petty cash account.'
      showError(detail)
    } finally {
      setSubmitting(false)
    }
  }

  // Delete Petty Cash Account
  const handleDeletePetty = async (account) => {
    const confirmed = await showConfirm({
      title: 'Delete Petty Cash Account?',
      text: `Are you sure you want to remove "${account.name}"? This action cannot be undone.`,
      confirmButtonText: 'Yes, Delete',
      isDangerous: true,
      icon: 'warning'
    })

    if (!confirmed) return

    try {
      await api.delete(`petty-cash-accounts/${account.id}/`)
      showSuccess('Petty cash account removed.')
      fetchData()
    } catch (err) {
      console.error('Failed to delete petty cash account:', err)
      showError(err.response?.data?.detail || 'Failed to delete petty cash account.')
    }
  }

  // Filtered Lists
  const filteredBanks = banks.filter((b) => {
    const matchesStatus = statusFilter === 'All' || b.status?.toLowerCase() === statusFilter.toLowerCase()
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      !q ||
      b.bank_name?.toLowerCase().includes(q) ||
      b.account_number?.toLowerCase().includes(q) ||
      b.account_holder_name?.toLowerCase().includes(q) ||
      b.iban?.toLowerCase().includes(q) ||
      b.branch_name?.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  const filteredPetty = pettyCashAccounts.filter((p) => {
    const matchesStatus = statusFilter === 'All' || p.status?.toLowerCase() === statusFilter.toLowerCase()
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.holder_name?.toLowerCase().includes(q) ||
      p.notes?.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  const totalBankBalance = banks.reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0)
  const totalPettyBalance = pettyCashAccounts.reduce((sum, p) => sum + (parseFloat(p.balance) || 0), 0)

  return (
    <div style={{ maxWidth: '1200px', width: '100%' }}>
      {/* Top Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
            Manage Banks & Petty Cash Accounts
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, maxWidth: '650px', lineHeight: '1.45' }}>
            Maintain corporate bank details, IBAN numbers, and employee petty cash custody accounts. Account balances and transactions will be reflected across Cashbook operations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn glass-panel"
            onClick={fetchData}
            title="Refresh"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          {subTab === 'banks' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenBankModal()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Add Bank Account
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenPettyModal()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Add Petty Cash Account
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Bank Reserve
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(19, 102, 217, 0.12)', color: 'var(--primary, #1366d9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Landmark size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '0.5rem' }}>
            {totalBankBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>SAR</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {banks.filter(b => b.status === 'Active').length} of {banks.length} banks active
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Petty Cash Float
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '0.5rem' }}>
            {totalPettyBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>SAR</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {pettyCashAccounts.filter(p => p.status === 'Active').length} of {pettyCashAccounts.length} custody accounts active
          </div>
        </div>
      </div>

      {/* Sub Tabs Selector & Filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem'
        }}
      >
        <div style={{ display: 'inline-flex', background: 'var(--card-bg, #f1f5f9)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => setSubTab('banks')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '700',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              background: subTab === 'banks' ? 'var(--primary, #1366d9)' : 'transparent',
              color: subTab === 'banks' ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 0.2s ease'
            }}
          >
            <Landmark size={16} />
            Bank Accounts ({banks.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('petty_cash')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '700',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              background: subTab === 'petty_cash' ? 'var(--primary, #1366d9)' : 'transparent',
              color: subTab === 'petty_cash' ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 0.2s ease'
            }}
          >
            <Wallet size={16} />
            Petty Cash Accounts ({pettyCashAccounts.length})
          </button>
        </div>

        {/* Search & Filter */}
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-field"
              placeholder={`Search ${subTab === 'banks' ? 'banks, iban...' : 'accounts, staff...'}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', height: '38px', fontSize: '0.82rem' }}
            />
          </div>

          <select
            className="input-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ height: '38px', fontSize: '0.82rem', width: '120px' }}
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* TAB 1: BANK ACCOUNTS */}
      {subTab === 'banks' && (
        <div className="glass-panel" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          {filteredBanks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <Landmark size={44} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
              <h4 style={{ fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-main)' }}>No bank accounts found</h4>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>
                {searchQuery || statusFilter !== 'All' ? 'Try adjusting your filters.' : 'Get started by adding your first corporate bank account.'}
              </p>
              {!searchQuery && statusFilter === 'All' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleOpenBankModal()}
                  style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={16} /> Add Bank Account
                </button>
              )}
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card-bg, #f8fafc)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Bank & Branch</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Account Details</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Account Holder</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Current Balance</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBanks.map((bank) => (
                    <tr key={bank.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--primary-light, #eff6ff)', color: 'var(--primary, #1366d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <BuildingLibrary size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{bank.bank_name}</div>
                            {bank.branch_name && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bank.branch_name}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '0.9rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: '600', color: 'var(--text-main)' }}>
                            {bank.account_number}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(bank.account_number, 'Account number')}
                            title="Copy Account Number"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                        {bank.iban && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            <span>IBAN: {bank.iban}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(bank.iban, 'IBAN')}
                              title="Copy IBAN"
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.9rem 1rem', color: 'var(--text-main)', fontWeight: '500' }}>
                        {bank.account_holder_name || '—'}
                      </td>

                      <td style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.95rem', color: parseFloat(bank.balance) < 0 ? '#ef4444' : '#10b981' }}>
                          {(parseFloat(bank.balance) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '4px', fontWeight: '600' }}>
                          {bank.currency || 'SAR'}
                        </span>
                      </td>

                      <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            background: bank.status === 'Active' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                            color: bank.status === 'Active' ? '#10b981' : '#64748b'
                          }}
                        >
                          {bank.status || 'Active'}
                        </span>
                      </td>

                      <td style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn glass-panel"
                            onClick={() => handleOpenBankModal(bank)}
                            title="Edit Bank Account"
                            style={{ padding: '6px 9px', borderRadius: '6px' }}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn glass-panel"
                            onClick={() => handleDeleteBank(bank)}
                            title="Delete Bank Account"
                            style={{ padding: '6px 9px', borderRadius: '6px', color: 'var(--danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PETTY CASH ACCOUNTS */}
      {subTab === 'petty_cash' && (
        <div className="glass-panel" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          {filteredPetty.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <Wallet size={44} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
              <h4 style={{ fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-main)' }}>No petty cash accounts found</h4>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>
                {searchQuery || statusFilter !== 'All' ? 'Try adjusting your filters.' : 'Set up employee custody floats or office petty cash accounts.'}
              </p>
              {!searchQuery && statusFilter === 'All' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleOpenPettyModal()}
                  style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={16} /> Add Petty Cash Account
                </button>
              )}
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--card-bg, #f8fafc)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Account Name</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Custodian / In-Charge</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Notes / Purpose</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Current Balance</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPetty.map((account) => (
                    <tr key={account.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Wallet size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{account.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: PCA-{account.id}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '0.9rem 1rem', color: 'var(--text-main)', fontWeight: '600' }}>
                        {account.holder_name || account.owner_name || '—'}
                      </td>

                      <td style={{ padding: '0.9rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: '300px' }}>
                        {account.notes || '—'}
                      </td>

                      <td style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.95rem', color: parseFloat(account.balance) < 0 ? '#ef4444' : '#10b981' }}>
                          {(parseFloat(account.balance) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '4px', fontWeight: '600' }}>
                          {account.currency || 'SAR'}
                        </span>
                      </td>

                      <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            background: account.status === 'Active' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                            color: account.status === 'Active' ? '#10b981' : '#64748b'
                          }}
                        >
                          {account.status || 'Active'}
                        </span>
                      </td>

                      <td style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn glass-panel"
                            onClick={() => handleOpenPettyModal(account)}
                            title="Edit Account"
                            style={{ padding: '6px 9px', borderRadius: '6px' }}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn glass-panel"
                            onClick={() => handleDeletePetty(account)}
                            title="Delete Account"
                            style={{ padding: '6px 9px', borderRadius: '6px', color: 'var(--danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* BANK ACCOUNT MODAL */}
      <Modal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        title={editingItem ? 'Edit Bank Account' : 'Add New Bank Account'}
        maxWidth="650px"
      >
        <form onSubmit={handleSaveBank} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>Bank Name *</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Al Rajhi Bank, SNB AlAhli"
                value={bankForm.bank_name}
                onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Account Number *</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 1234567890"
                value={bankForm.account_number}
                onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Account Holder Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Arab Season Enterprise LLC"
                value={bankForm.account_holder_name}
                onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>IBAN</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. SA0380000000608010167519"
                value={bankForm.iban}
                onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Branch Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Main Branch, Riyadh"
                value={bankForm.branch_name}
                onChange={(e) => setBankForm({ ...bankForm, branch_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Opening / Current Balance</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="0.00"
                value={bankForm.balance}
                onChange={(e) => setBankForm({ ...bankForm, balance: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Currency</label>
              <select
                className="input-field"
                value={bankForm.currency}
                onChange={(e) => setBankForm({ ...bankForm, currency: e.target.value })}
              >
                <option value="SAR">SAR (Saudi Riyal)</option>
                <option value="AED">AED (UAE Dirham)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                className="input-field"
                value={bankForm.status}
                onChange={(e) => setBankForm({ ...bankForm, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notes / Purpose</label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="e.g. Primary operating account for vendor transfers and salaries"
              value={bankForm.notes}
              onChange={(e) => setBankForm({ ...bankForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn glass-panel"
              onClick={() => setIsBankModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Bank Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* PETTY CASH ACCOUNT MODAL */}
      <Modal
        isOpen={isPettyModalOpen}
        onClose={() => setIsPettyModalOpen(false)}
        title={editingItem ? 'Edit Petty Cash Account' : 'Add New Petty Cash Account'}
        maxWidth="550px"
      >
        <form onSubmit={handleSavePetty} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label>Account / Float Name *</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Nizam Petty Cash, Main Office Float"
              value={pettyForm.name}
              onChange={(e) => setPettyForm({ ...pettyForm, name: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Staff Custodian / Person in Charge</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Nizam, Shuhaib, Office Manager"
              value={pettyForm.holder_name}
              onChange={(e) => setPettyForm({ ...pettyForm, holder_name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>Opening / Current Balance</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="0.00"
                value={pettyForm.balance}
                onChange={(e) => setPettyForm({ ...pettyForm, balance: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                className="input-field"
                value={pettyForm.status}
                onChange={(e) => setPettyForm({ ...pettyForm, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notes / Operational Scope</label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="e.g. For workshop daily maintenance, fuel, and tea expenses"
              value={pettyForm.notes}
              onChange={(e) => setPettyForm({ ...pettyForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn glass-panel"
              onClick={() => setIsPettyModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Petty Cash Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default ManageBanksPettyCash
