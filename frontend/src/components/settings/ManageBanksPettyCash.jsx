import { useState, useEffect } from 'react'
import api from '../../api'
import { ModalShell, Field, TextInput, NumberInput, Select as CredSelect, Textarea } from '../common/FormPrimitives'
import {
  Landmark,
  Wallet,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Check,
  BuildingLibrary,
  Copy,
  User
} from '../icons'
import { showConfirm, showToast, showError, showSuccess } from '../../utils/swal'
import PageHeaderButton from '../common/PageHeaderButton'
import { CredAnimatedTabs } from '../cashbook/cred/CredAnimatedTabs'
import CredSearchInput from '../cashbook/cred/CredSearchInput'
import PlainFilterDropdown from '../common/PlainFilterDropdown'

const ManageBanksPettyCash = () => {
  const [subTab, setSubTab] = useState('banks') // 'banks' | 'petty_cash'
  const [banks, setBanks] = useState([])
  const [pettyCashAccounts, setPettyCashAccounts] = useState([])
  const [staffUsers, setStaffUsers] = useState([])
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
    linked_user: '',
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
      const [banksRes, pettyRes, usersRes] = await Promise.allSettled([
        api.get('banks/?page_size=100'),
        api.get('petty-cash-accounts/?page_size=100'),
        api.get('timesheets/staff-users/?page_size=100')
      ])

      if (banksRes.status === 'fulfilled') {
        const bData = Array.isArray(banksRes.value?.data)
          ? banksRes.value.data
          : (Array.isArray(banksRes.value?.data?.results) ? banksRes.value.data.results : [])
        setBanks(bData)
      }

      if (pettyRes.status === 'fulfilled') {
        const pData = Array.isArray(pettyRes.value?.data)
          ? pettyRes.value.data
          : (Array.isArray(pettyRes.value?.data?.results) ? pettyRes.value.data.results : [])
        setPettyCashAccounts(pData)
      }

      // Populate staff users
      let usersList = []
      if (usersRes.status === 'fulfilled') {
        const uData = usersRes.value?.data?.results || usersRes.value?.data || []
        if (Array.isArray(uData) && uData.length > 0) {
          usersList = uData
        }
      }

      if (usersList.length === 0) {
        try {
          const fallbackRes = await api.get('accounts/users/?page_size=100')
          const fData = fallbackRes.data?.results || fallbackRes.data || []
          if (Array.isArray(fData)) {
            usersList = fData.map(u => ({
              id: u.id,
              username: u.username,
              full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username,
              email: u.email
            }))
          }
        } catch (e) {
          // ignore fallback error
        }
      }
      setStaffUsers(usersList)
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
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text)
        showToast(`${label} copied to clipboard!`, 'info')
      }
    } catch (e) {
      console.warn('Clipboard write error:', e)
    }
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
        linked_user: account.owner || account.linked_user ? String(account.owner || account.linked_user) : '',
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
        linked_user: '',
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
      const linkedUserId = pettyForm.linked_user ? parseInt(pettyForm.linked_user) : null
      const payload = {
        name: pettyForm.name.trim(),
        holder_name: pettyForm.holder_name.trim() || pettyForm.name.trim(),
        owner: linkedUserId,
        linked_user: linkedUserId,
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

  // Safe array guards
  const safeBanks = Array.isArray(banks) ? banks : (Array.isArray(banks?.results) ? banks.results : [])
  const safePetty = Array.isArray(pettyCashAccounts) ? pettyCashAccounts : (Array.isArray(pettyCashAccounts?.results) ? pettyCashAccounts.results : [])

  // Filtered Lists
  const filteredBanks = safeBanks.filter((b) => {
    const matchesStatus = statusFilter === 'All' || b.status?.toLowerCase() === statusFilter.toLowerCase()
    const q = searchQuery.trim().toLowerCase()
    const matchesSearch =
      !q ||
      b.bank_name?.toLowerCase().includes(q) ||
      b.account_number?.toLowerCase().includes(q) ||
      b.account_holder_name?.toLowerCase().includes(q) ||
      b.iban?.toLowerCase().includes(q) ||
      b.branch_name?.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  const filteredPetty = safePetty.filter((p) => {
    const matchesStatus = statusFilter === 'All' || p.status?.toLowerCase() === statusFilter.toLowerCase()
    const q = searchQuery.trim().toLowerCase()
    const matchesSearch =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.holder_name?.toLowerCase().includes(q) ||
      p.owner_name?.toLowerCase().includes(q) ||
      p.linked_user_name?.toLowerCase().includes(q) ||
      p.notes?.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  const totalBankBalance = safeBanks.reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0)
  const totalPettyBalance = safePetty.reduce((sum, p) => sum + (parseFloat(p.balance) || 0), 0)

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      {/* ── 1. Summary KPI Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Card 1: Bank Reserve */}
        <div style={{
          background: 'var(--card-bg, #FFFFFF)',
          borderRadius: '20px',
          padding: '20px 24px',
          border: '1px solid var(--border, #E4E4E4)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em' }}>
              Total Bank Reserve
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid var(--border, #E4E4E4)',
              background: 'var(--fill-ghost, #FBFBFB)',
              color: 'var(--text, #0A0A0A)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Landmark size={15} strokeWidth={1.8} />
            </div>
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 600,
            color: 'var(--text, #0A0A0A)',
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px'
          }}>
            <span>{totalBankBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '4px' }}>
            {safeBanks.filter(b => b.status === 'Active').length} of {safeBanks.length} bank accounts active
          </div>
        </div>

        {/* Card 2: Petty Cash Float */}
        <div style={{
          background: 'var(--card-bg, #FFFFFF)',
          borderRadius: '20px',
          padding: '20px 24px',
          border: '1px solid var(--border, #E4E4E4)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em' }}>
              Total Petty Cash Float
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid var(--border, #E4E4E4)',
              background: 'var(--fill-ghost, #FBFBFB)',
              color: 'var(--text, #0A0A0A)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Wallet size={15} strokeWidth={1.8} />
            </div>
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 600,
            color: 'var(--text, #0A0A0A)',
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px'
          }}>
            <span>{totalPettyBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '4px' }}>
            {safePetty.filter(p => p.status === 'Active').length} of {safePetty.length} custody accounts active
          </div>
        </div>
      </div>

      {/* ── 2. Controls & Actions Bar ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px'
      }}>
        {/* Animated Subtabs */}
        <CredAnimatedTabs
          tabs={[
            { id: 'banks', label: `Bank Accounts (${safeBanks.length})` },
            { id: 'petty_cash', label: `Petty Cash Accounts (${safePetty.length})` }
          ]}
          value={subTab}
          onChange={setSubTab}
          layoutId="manage-banks-sub-tabs"
          className="case-preserve"
        />

        {/* Right Actions: Search, Filter, Refresh, Add Button */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: '230px' }}>
            <CredSearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={subTab === 'banks' ? 'Search banks, IBAN...' : 'Search accounts, staff...'}
              style={{ width: '100%', height: '38px' }}
            />
          </div>

          <PlainFilterDropdown
            options={[
              { value: 'All', label: 'All Status' },
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' }
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            minWidth={115}
          />

          <button
            type="button"
            className="cred-topstrip-icon-btn"
            onClick={fetchData}
            title="Refresh Data"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              border: '1px solid var(--border, #E4E4E4)',
              background: 'var(--card-bg, #FFFFFF)',
              color: 'var(--text, #0A0A0A)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: loading ? 'wait' : 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={14} strokeWidth={1.8} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>

          <PageHeaderButton
            onClick={subTab === 'banks' ? () => handleOpenBankModal() : () => handleOpenPettyModal()}
          >
            {subTab === 'banks' ? 'Add Bank Account' : 'Add Petty Cash Account'}
          </PageHeaderButton>
        </div>
      </div>

      {/* ── 3. Table Card ── */}
      <div style={{
        background: 'var(--card-bg, #FFFFFF)',
        border: '1px solid var(--border, #E4E4E4)',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {/* TAB 1: BANK ACCOUNTS */}
        {subTab === 'banks' && (
          <div>
            {filteredBanks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted, #8C8C8C)' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--fill-ghost, #FBFBFB)',
                  border: '1px solid var(--border, #E4E4E4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: 'var(--text-muted, #8C8C8C)'
                }}>
                  <Landmark size={22} strokeWidth={1.8} />
                </div>
                <h4 style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px', color: 'var(--text, #0A0A0A)' }}>No bank accounts found</h4>
                <p style={{ fontSize: '13px', margin: 0 }}>
                  {searchQuery || statusFilter !== 'All' ? 'Try adjusting your search or status filter.' : 'Get started by adding your first corporate bank account.'}
                </p>
                {!searchQuery && statusFilter === 'All' && (
                  <div style={{ marginTop: '16px' }}>
                    <PageHeaderButton onClick={() => handleOpenBankModal()}>
                      Add Bank Account
                    </PageHeaderButton>
                  </div>
                )}
              </div>
            ) : (
              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{
                      background: 'var(--fill-ghost, #FBFBFB)',
                      borderBottom: '1px solid var(--border, #E4E4E4)',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-muted, #8C8C8C)',
                      letterSpacing: '0.02em',
                      textTransform: 'uppercase'
                    }}>
                      <th style={{ padding: '12px 18px' }}>Bank & Branch</th>
                      <th style={{ padding: '12px 18px' }}>Account Details</th>
                      <th style={{ padding: '12px 18px' }}>Account Holder</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Current Balance</th>
                      <th style={{ padding: '12px 18px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBanks.map((bank) => (
                      <tr
                        key={bank.id}
                        style={{
                          borderBottom: '1px solid var(--border, #E4E4E4)',
                          fontSize: '13px',
                          transition: 'background-color 0.12s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              background: 'var(--fill-ghost, #F8FAFC)',
                              border: '1px solid var(--border, #E4E4E4)',
                              color: 'var(--text, #0A0A0A)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <BuildingLibrary size={16} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>{bank.bank_name}</div>
                              {bank.branch_name && (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>{bank.branch_name}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text, #0A0A0A)', fontSize: '13px' }}>
                              {bank.account_number}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(bank.account_number, 'Account number')}
                              title="Copy Account Number"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '2px 4px',
                                cursor: 'pointer',
                                color: 'var(--text-muted, #8C8C8C)',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                          {bank.iban && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '3px' }}>
                              <span>IBAN: {bank.iban}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(bank.iban, 'IBAN')}
                                title="Copy IBAN"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: '2px 4px',
                                  cursor: 'pointer',
                                  color: 'var(--text-muted, #8C8C8C)',
                                  borderRadius: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '14px 18px', color: 'var(--text, #0A0A0A)', fontWeight: 500 }}>
                          {bank.account_holder_name || '—'}
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <span style={{
                            fontWeight: 600,
                            fontSize: '14px',
                            fontVariantNumeric: 'tabular-nums',
                            color: parseFloat(bank.balance) < 0 ? '#DC2626' : '#15803D'
                          }}>
                            {(parseFloat(bank.balance) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginLeft: '4px', fontWeight: 500 }}>
                            {bank.currency || 'SAR'}
                          </span>
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: bank.status === 'Active' ? 'var(--fill-ghost, #F4F4F5)' : 'transparent',
                            color: bank.status === 'Active' ? 'var(--text, #18181B)' : 'var(--text-muted, #71717A)',
                            border: '1px solid var(--border, #E4E4E7)',
                            letterSpacing: '0.02em'
                          }}>
                            {bank.status || 'Active'}
                          </span>
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenBankModal(bank)}
                              title="Edit Bank Account"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                border: '1px solid var(--border, #E4E4E4)',
                                background: 'var(--card-bg, #FFFFFF)',
                                color: 'var(--text, #0A0A0A)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--card-bg, #FFFFFF)'}
                            >
                              <Edit size={13} strokeWidth={2} />
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
          <div>
            {filteredPetty.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted, #8C8C8C)' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--fill-ghost, #FBFBFB)',
                  border: '1px solid var(--border, #E4E4E4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: 'var(--text-muted, #8C8C8C)'
                }}>
                  <Wallet size={22} strokeWidth={1.8} />
                </div>
                <h4 style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px', color: 'var(--text, #0A0A0A)' }}>No petty cash accounts found</h4>
                <p style={{ fontSize: '13px', margin: 0 }}>
                  {searchQuery || statusFilter !== 'All' ? 'Try adjusting your search or status filter.' : 'Set up employee custody floats or office petty cash accounts.'}
                </p>
                {!searchQuery && statusFilter === 'All' && (
                  <div style={{ marginTop: '16px' }}>
                    <PageHeaderButton onClick={() => handleOpenPettyModal()}>
                      Add Petty Cash Account
                    </PageHeaderButton>
                  </div>
                )}
              </div>
            ) : (
              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{
                      background: 'var(--fill-ghost, #FBFBFB)',
                      borderBottom: '1px solid var(--border, #E4E4E4)',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-muted, #8C8C8C)',
                      letterSpacing: '0.02em',
                      textTransform: 'uppercase'
                    }}>
                      <th style={{ padding: '12px 18px' }}>Account Name</th>
                      <th style={{ padding: '12px 18px' }}>Custodian / In-Charge</th>
                      <th style={{ padding: '12px 18px' }}>Notes / Purpose</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Current Balance</th>
                      <th style={{ padding: '12px 18px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPetty.map((account) => (
                      <tr
                        key={account.id}
                        style={{
                          borderBottom: '1px solid var(--border, #E4E4E4)',
                          fontSize: '13px',
                          transition: 'background-color 0.12s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              background: 'var(--fill-ghost, #F8FAFC)',
                              border: '1px solid var(--border, #E4E4E4)',
                              color: 'var(--text, #0A0A0A)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Wallet size={16} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>{account.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>ID: PCA-{account.id}</div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              background: 'var(--fill-ghost, #F1F5F9)',
                              color: 'var(--text, #0A0A0A)',
                              border: '1px solid var(--border, #E4E4E4)',
                              fontSize: '11px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {(account.holder_name || account.owner_name || account.linked_user_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 500, color: 'var(--text, #0A0A0A)' }}>
                                {account.holder_name || account.owner_name || account.linked_user_name || 'Unassigned'}
                              </div>
                              {account.linked_user_name && account.holder_name && account.linked_user_name !== account.holder_name && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>
                                  User: @{account.linked_user_name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '14px 18px', color: 'var(--text-muted, #8C8C8C)', fontSize: '12.5px', maxWidth: '280px' }}>
                          <span style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: '1.4'
                          }}>
                            {account.notes || '—'}
                          </span>
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <span style={{
                            fontWeight: 600,
                            fontSize: '14px',
                            fontVariantNumeric: 'tabular-nums',
                            color: parseFloat(account.balance) < 0 ? '#DC2626' : '#15803D'
                          }}>
                            {(parseFloat(account.balance) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginLeft: '4px', fontWeight: 500 }}>
                            {account.currency || 'SAR'}
                          </span>
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: account.status === 'Active' ? 'var(--fill-ghost, #F4F4F5)' : 'transparent',
                            color: account.status === 'Active' ? 'var(--text, #18181B)' : 'var(--text-muted, #71717A)',
                            border: '1px solid var(--border, #E4E4E7)',
                            letterSpacing: '0.02em'
                          }}>
                            {account.status || 'Active'}
                          </span>
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenPettyModal(account)}
                              title="Edit Account"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                border: '1px solid var(--border, #E4E4E4)',
                                background: 'var(--card-bg, #FFFFFF)',
                                color: 'var(--text, #0A0A0A)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--card-bg, #FFFFFF)'}
                            >
                              <Edit size={13} strokeWidth={2} />
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
      </div>


      {/* BANK ACCOUNT MODAL */}
      <ModalShell
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        title={editingItem ? 'Edit Bank Account' : 'Add New Bank Account'}
        maxWidth="650px"
        formId="manage-bank-form"
        submitLabel={editingItem ? 'Save Changes' : 'Create Bank Account'}
        submittingLabel="Saving..."
        submitting={submitting}
      >
        <form id="manage-bank-form" onSubmit={handleSaveBank} style={{ padding: '4px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 20px' }}>
            <Field label="Bank Name" required>
              <TextInput
                placeholder="e.g. Al Rajhi Bank, SNB AlAhli"
                value={bankForm.bank_name}
                onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                required
                autoFocus
              />
            </Field>

            <Field label="Account Number" required>
              <TextInput
                placeholder="e.g. 1234567890"
                value={bankForm.account_number}
                onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                required
                style={{ fontFamily: 'monospace' }}
              />
            </Field>

            <Field label="Account Holder Name">
              <TextInput
                placeholder="e.g. Arab Season Enterprise LLC"
                value={bankForm.account_holder_name}
                onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })}
              />
            </Field>

            <Field label="IBAN">
              <TextInput
                placeholder="e.g. SA0380000000608010167519"
                value={bankForm.iban}
                onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })}
                style={{ fontFamily: 'monospace' }}
              />
            </Field>

            <Field label="Branch Name">
              <TextInput
                placeholder="e.g. Main Branch, Riyadh"
                value={bankForm.branch_name}
                onChange={(e) => setBankForm({ ...bankForm, branch_name: e.target.value })}
              />
            </Field>

            <Field label="Opening / Current Balance">
              <NumberInput
                prefix={bankForm.currency || 'SAR'}
                step="0.01"
                placeholder="0.00"
                value={bankForm.balance}
                onChange={(e) => setBankForm({ ...bankForm, balance: e.target.value })}
              />
            </Field>

            <Field label="Currency">
              <CredSelect
                value={bankForm.currency}
                onChange={(e) => setBankForm({ ...bankForm, currency: e.target.value })}
              >
                <option value="SAR">SAR (Saudi Riyal)</option>
                <option value="AED">AED (UAE Dirham)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </CredSelect>
            </Field>

            <Field label="Status">
              <CredSelect
                value={bankForm.status}
                onChange={(e) => setBankForm({ ...bankForm, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </CredSelect>
            </Field>

            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Notes / Purpose">
                <Textarea
                  rows={2}
                  placeholder="e.g. Primary operating account for vendor transfers and salaries"
                  value={bankForm.notes}
                  onChange={(e) => setBankForm({ ...bankForm, notes: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </form>
      </ModalShell>

      {/* PETTY CASH ACCOUNT MODAL */}
      <ModalShell
        isOpen={isPettyModalOpen}
        onClose={() => setIsPettyModalOpen(false)}
        title={editingItem ? 'Edit Petty Cash Account' : 'Add New Petty Cash Account'}
        maxWidth="560px"
        formId="manage-petty-form"
        submitLabel={editingItem ? 'Save Changes' : 'Create Petty Cash Account'}
        submittingLabel="Saving..."
        submitting={submitting}
      >
        <form id="manage-petty-form" onSubmit={handleSavePetty} style={{ padding: '4px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Field label="Account / Float Name" required>
              <TextInput
                placeholder="e.g. Nizam Petty Cash, Main Office Float"
                value={pettyForm.name}
                onChange={(e) => setPettyForm({ ...pettyForm, name: e.target.value })}
                required
                autoFocus
              />
            </Field>

            {/* Link to User (System Login) */}
            <Field
              label="Link to User (System Login)"
              tooltip="Auto-selects & filters when this user logs in"
            >
              <CredSelect
                value={pettyForm.linked_user || ''}
                onChange={(e) => {
                  const val = e.target.value
                  const foundUser = staffUsers.find(u => String(u.id) === String(val))
                  setPettyForm(prev => ({
                    ...prev,
                    linked_user: val,
                    holder_name: prev.holder_name || (foundUser ? (foundUser.full_name || foundUser.username) : '')
                  }))
                }}
              >
                <option value="">-- No Linked User (Unrestricted) --</option>
                {staffUsers.map(u => (
                  <option key={u.id} value={String(u.id)}>
                    {u.full_name || u.username} ({u.username})
                  </option>
                ))}
              </CredSelect>
            </Field>

            <Field label="Staff Custodian / Person in Charge">
              <TextInput
                placeholder="e.g. Nizam, Shuhaib, Office Manager"
                value={pettyForm.holder_name}
                onChange={(e) => setPettyForm({ ...pettyForm, holder_name: e.target.value })}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 20px' }}>
              <Field label="Opening / Current Balance">
                <NumberInput
                  prefix="SAR"
                  step="0.01"
                  placeholder="0.00"
                  value={pettyForm.balance}
                  onChange={(e) => setPettyForm({ ...pettyForm, balance: e.target.value })}
                />
              </Field>

              <Field label="Status">
                <CredSelect
                  value={pettyForm.status}
                  onChange={(e) => setPettyForm({ ...pettyForm, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </CredSelect>
              </Field>
            </div>

            <Field label="Notes / Operational Scope">
              <Textarea
                rows={2}
                placeholder="e.g. For workshop daily maintenance, fuel, and tea expenses"
                value={pettyForm.notes}
                onChange={(e) => setPettyForm({ ...pettyForm, notes: e.target.value })}
              />
            </Field>
          </div>
        </form>
      </ModalShell>
    </div>
  )
}

export default ManageBanksPettyCash
