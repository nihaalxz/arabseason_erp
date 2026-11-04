import { useState, useEffect, useMemo } from 'react'
import { Plus, Edit3, Filter, AlertCircle, Phone, Mail, User } from 'lucide-react'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { CredAnimatedTabs } from '../components/cashbook/cred/CredAnimatedTabs'
import CredSearchInput from '../components/cashbook/cred/CredSearchInput'
import PlainFilterDropdown from '../components/common/PlainFilterDropdown'
import PageHeaderButton from '../components/common/PageHeaderButton'
import CredPagination from '../components/cashbook/cred/CredPagination'
import {
  ModalShell,
  Field,
  TextInput,
  NumberInput,
  Textarea
} from '../components/common/FormPrimitives'
import { showConfirm, showError, showToast } from '../utils/swal'
import { isCurrentUserAdmin } from '../constants/permissions'

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Customers' },
  { value: 'receivable_due', label: 'Receivable Due' },
  { value: 'payable_owed', label: 'Payable Owed' },
  { value: 'fully_paid', label: 'Fully Paid' },
  { value: 'has_advance', label: 'Has Advance' },
]

const Customers = () => {
  const isAdmin = isCurrentUserAdmin()
  const { formatCurrency } = useSettings()
  const basePath = '/accounting'

  // Primary Data State
  const [customers, setCustomers] = useState([])
  const [summary, setSummary] = useState({ 
    total_billed: 0, 
    paid_amount: 0, 
    pending_balance: 0, 
    total_payable: 0, 
    total_count: 0, 
    pending_count: 0 
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  // Section Switcher State: 'pending' (Pending Balance) | 'all' (All Customers)
  const [activeSection, setActiveSection] = useState('pending')

  // KPI Card Filter: null | 'billed' | 'received' | 'due' | 'payable'
  const [activeCard, setActiveCard] = useState(null)

  // Dropdown Filter: 'all' | 'receivable_due' | 'payable_owed' | 'fully_paid' | 'has_advance'
  const [filterStatus, setFilterStatus] = useState('all')

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formData, setFormData] = useState({ 
    name: '', 
    company_name: '', 
    email: '', 
    phone: '', 
    address: '', 
    payable_amount: '' 
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    fetchCustomers()
    fetchSummary()
  }, [page, searchQuery, activeSection])

  const fetchSummary = async () => {
    try {
      const res = await api.get('customers/summary/')
      setSummary(res.data || { 
        total_billed: 0, 
        paid_amount: 0, 
        pending_balance: 0, 
        total_payable: 0, 
        total_count: 0, 
        pending_count: 0 
      })
    } catch (err) {
      console.error('Failed to fetch customer summary:', err)
    }
  }

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const params = { page }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }
      if (activeSection === 'pending') {
        params.pending_only = 'true'
      }
      const response = await api.get('customers/', { params })
      const rawList = response.data.results || response.data || []
      const uniqueMap = new Map()
      rawList.forEach(c => { if (c && c.id && !uniqueMap.has(c.id)) uniqueMap.set(c.id, c) })
      setCustomers(Array.from(uniqueMap.values()))
      setTotalPages(Math.ceil((response.data.count || 0) / 25) || 1)
      setError('')
    } catch (err) {
      setError('Failed to fetch customers. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCardClick = (cardKey) => {
    if (activeCard === cardKey) {
      setActiveCard(null)
    } else {
      setActiveCard(cardKey)
      if (cardKey === 'billed' && activeSection === 'pending') {
        setActiveSection('all')
      }
    }
    setPage(1)
  }

  const handleSectionSwitch = (section) => {
    setActiveSection(section)
    setPage(1)
  }

  const handleSearchChange = (val) => {
    setSearchQuery(val)
    setPage(1)
  }

  const handleOpenModal = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer)
      const rawPa = customer.remaining_payable ?? customer.payable_amount
      const pa = rawPa != null ? parseFloat(rawPa) : 0
      setFormData({ 
        name: customer.name || '', 
        company_name: customer.company_name || customer.company || '',
        email: customer.email || '', 
        phone: customer.phone || '', 
        address: customer.address || '',
        payable_amount: pa > 0 ? String(pa) : (rawPa != null && String(rawPa).trim() !== '' ? String(rawPa) : '')
      })
    } else {
      setEditingCustomer(null)
      setFormData({ name: '', company_name: '', email: '', phone: '', address: '', payable_amount: '' })
    }
    setFormError('')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setFormError('Full Name / Primary Contact is required')
      return
    }
    
    try {
      setSubmitting(true)
      setFormError('')

      const payload = {
        ...formData,
        name: formData.name.trim(),
        company_name: formData.company_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        payable_amount: formData.payable_amount !== '' ? parseFloat(formData.payable_amount) || 0 : 0
      }
      
      if (editingCustomer) {
        const response = await api.put(`customers/${editingCustomer.id}/`, payload)
        setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? response.data : c))
        showToast('Customer record updated', 'success')
      } else {
        const response = await api.post('customers/', payload)
        setCustomers(prev => [response.data, ...prev.filter(c => c.id !== response.data.id)])
        showToast('New customer created', 'success')
      }
      fetchSummary()
      
      setIsModalOpen(false)
      setFormData({ name: '', company_name: '', email: '', phone: '', address: '', payable_amount: '' })
      setEditingCustomer(null)
    } catch (err) {
      const errorData = err.response?.data
      let errorMessage = 'Operation failed. Please check your data.'
      
      if (errorData) {
        if (typeof errorData === 'object') {
          errorMessage = Object.entries(errorData)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
            .join(' | ')
        } else if (typeof errorData === 'string') {
          errorMessage = errorData
        }
      }
      
      setFormError(errorMessage)
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Move Customer to Recycle Bin?',
      text: 'Are you sure you want to move this customer to the Recycle Bin? It can be restored at any time.',
      confirmButtonText: 'Move to Recycle Bin',
      isDangerous: true,
    })
    if (confirmed) {
      try {
        await api.delete(`customers/${id}/`)
        setCustomers(customers.filter(c => c.id !== id))
        fetchSummary()
        showToast('Customer moved to Recycle Bin', 'success')
      } catch {
        showError('Action Failed', 'Failed to move customer to Recycle Bin.')
      }
    }
  }

  // Combined cohesive filtering (KPI card + Dropdown filter)
  const displayedCustomers = useMemo(() => {
    return customers.filter(c => {
      const billed = parseFloat(c.total_billed) || 0
      const paid = parseFloat(c.paid_amount) || 0
      const pending = parseFloat(c.pending_balance) || 0
      const payable = parseFloat(c.remaining_payable ?? c.payable_amount) || 0

      // KPI Card Filter
      if (activeCard === 'received' && !(paid > 0)) return false
      if (activeCard === 'due' && !(pending > 0)) return false
      if (activeCard === 'payable' && !(payable > 0)) return false
      // 'billed' shows all customers

      // Dropdown Filter Menu
      if (filterStatus === 'receivable_due' && !(pending > 0)) return false
      if (filterStatus === 'payable_owed' && !(payable > 0)) return false
      if (filterStatus === 'fully_paid' && !(pending <= 0 && billed > 0)) return false
      if (filterStatus === 'has_advance' && !(paid < 0 || pending < 0)) return false

      return true
    })
  }, [customers, activeCard, filterStatus])

  return (
    <div className="customers-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      
      {/* ── 1. PAGE HEADER (Enquiries CRED Style) ── */}
      <div className="page-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontWeight: 600, letterSpacing: '-0.02em', fontSize: '24px', margin: 0, color: 'var(--text, #0A0A0A)' }}>
            Customers
          </h2>
          <p style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '13px', margin: '4px 0 0' }}>
            Manage client records, receivables, and ledger history
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <PageHeaderButton onClick={() => handleOpenModal()}>
            New Customer
          </PageHeaderButton>
        </div>
      </div>

      {/* ── 2. KPI CARDS (4 cards, Enquiries Style with Active Ink Border) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Card 1: Total Billed */}
        <div 
          onClick={() => handleCardClick('billed')}
          style={{ 
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'billed' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'border-color 0.15s ease, transform 0.1s ease',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Total Billed
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {isAdmin ? formatCurrency(summary.total_billed || 0) : '****'}
          </div>
        </div>

        {/* Card 2: Amount Received */}
        <div 
          onClick={() => handleCardClick('received')}
          style={{ 
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'received' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'border-color 0.15s ease, transform 0.1s ease',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Amount Received
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {isAdmin ? formatCurrency(summary.paid_amount || 0) : '****'}
          </div>
        </div>

        {/* Card 3: Receivables Due */}
        <div 
          onClick={() => handleCardClick('due')}
          style={{ 
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'due' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'border-color 0.15s ease, transform 0.1s ease',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Receivables Due
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {isAdmin ? formatCurrency(summary.pending_balance || 0) : '****'}
          </div>
        </div>

        {/* Card 4: Payables Owed */}
        <div 
          onClick={() => handleCardClick('payable')}
          style={{ 
            background: 'var(--card-bg, #FFFFFF)',
            borderRadius: '20px',
            padding: '18px 20px',
            border: activeCard === 'payable' ? '2px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'border-color 0.15s ease, transform 0.1s ease',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
            Payables Owed
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {isAdmin ? formatCurrency(summary.total_payable || 0) : '****'}
          </div>
        </div>
      </div>

      {/* ── 3. STATUS TABS BAR (CRED Animated Tabs) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '16px',
        flexWrap: 'wrap'
      }}>
        <CredAnimatedTabs
          tabs={[
            { id: 'pending', label: 'Pending Balance', count: summary.pending_count ?? 0 },
            { id: 'all', label: 'All Customers', count: summary.total_count ?? 0 },
          ]}
          value={activeSection}
          onChange={handleSectionSwitch}
          className="case-preserve cred-enquiry-tabs"
          layoutId="cred-customer-tabs"
        />
      </div>

      {/* ── 4. SEARCH + FILTERS ROW (Directly on page, soft filled search) ── */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
          <CredSearchInput
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onClear={() => handleSearchChange('')}
            placeholder="Search customers…"
            style={{ flex: 1 }}
          />
          <PlainFilterDropdown
            icon={Filter}
            value={filterStatus}
            onChange={(val) => { setFilterStatus(val); setPage(1); }}
            options={FILTER_OPTIONS}
            minWidth={160}
            ariaLabel="Filter customers"
          />
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* ── 5. MAIN DATA TABLE (Directly on page, Enquiries Table Style) ── */}
      <div style={{ width: '100%', position: 'relative', marginBottom: '2.5rem' }}>
        {loading ? (
          <div style={{ padding: '1.5rem 0' }}>
            <SkeletonLoader type="table" />
          </div>
        ) : (
          <>
            {displayedCustomers.length === 0 && !error && (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                <User size={22} strokeWidth={1.6} style={{ color: 'var(--text-muted, #8C8C8C)', opacity: 0.6, marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>
                  {searchQuery 
                    ? `No customers matching "${searchQuery}".`
                    : filterStatus !== 'all' || activeCard
                    ? 'No customers match the selected filter.'
                    : activeSection === 'pending'
                    ? 'All customer accounts are fully settled. No pending balance.'
                    : 'No customers found.'}
                </p>
              </div>
            )}

            {displayedCustomers.length > 0 && (
              <>
                {/* Desktop Table View */}
                <div className="desktop-only-table" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)' }}>
                        <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Customer name</th>
                        <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Company name</th>
                        <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Email address</th>
                        <th style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Phone number</th>
                        <th style={{ minWidth: '150px', padding: '10px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Total billed</th>
                        <th style={{ minWidth: '150px', padding: '10px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Amount paid</th>
                        <th style={{ minWidth: '150px', padding: '10px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Receivables due</th>
                        <th style={{ minWidth: '150px', padding: '10px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Payables owed</th>
                        <th style={{ width: '80px', minWidth: '80px', padding: '10px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedCustomers.map((customer) => {
                        const payableBal = parseFloat(customer.remaining_payable ?? customer.payable_amount) || 0
                        return (
                          <tr
                            key={customer.id}
                            className="cred-table-row"
                            style={{
                              borderBottom: '1px solid var(--border, #E4E4E4)',
                              transition: 'background-color 0.15s ease'
                            }}
                          >
                            {/* Customer Name + CID */}
                            <td style={{ padding: '12px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                              <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {customer.name}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                                CID-{customer.id.toString().padStart(5, '0')}
                              </div>
                            </td>

                            {/* Company Name */}
                            <td style={{ padding: '12px 10px', verticalAlign: 'middle', fontSize: '13px', color: customer.company_name ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {customer.company_name || '—'}
                            </td>

                            {/* Email Address */}
                            <td style={{ padding: '12px 10px', verticalAlign: 'middle', fontSize: '13px', color: customer.email ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {customer.email || '—'}
                            </td>

                            {/* Phone Number */}
                            <td style={{ padding: '12px 10px', verticalAlign: 'middle', fontSize: '13px', color: customer.phone ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                              {customer.phone || '—'}
                            </td>

                            {/* Total Billed */}
                            <td style={{ minWidth: '150px', padding: '12px 14px', verticalAlign: 'middle', textAlign: 'right', fontSize: '13px', fontVariantNumeric: 'tabular-nums', color: 'var(--text, #111111)', whiteSpace: 'nowrap' }}>
                              {formatCurrency(customer.total_billed || 0)}
                            </td>

                            {/* Amount Paid */}
                            <td style={{ minWidth: '150px', padding: '12px 14px', verticalAlign: 'middle', textAlign: 'right', fontSize: '13px', fontVariantNumeric: 'tabular-nums', color: 'var(--text, #111111)', whiteSpace: 'nowrap' }}>
                              {formatCurrency(customer.paid_amount || 0)}
                            </td>

                            {/* Receivables Due */}
                            <td style={{ minWidth: '150px', padding: '12px 14px', verticalAlign: 'middle', textAlign: 'right', fontSize: '13px', fontVariantNumeric: 'tabular-nums', color: (customer.pending_balance || 0) > 0 ? 'var(--danger, #DC2626)' : 'var(--text, #111111)', whiteSpace: 'nowrap' }}>
                              {formatCurrency(customer.pending_balance || 0)}
                            </td>

                            {/* Payables Owed */}
                            <td style={{ minWidth: '150px', padding: '12px 14px', verticalAlign: 'middle', textAlign: 'right', fontSize: '13px', fontVariantNumeric: 'tabular-nums', color: 'var(--text, #111111)', whiteSpace: 'nowrap' }}>
                              {formatCurrency(payableBal)}
                            </td>

                            {/* Actions */}
                            <td style={{ width: '80px', minWidth: '80px', padding: '12px 14px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="cred-action-icon-btn"
                                  onClick={() => handleOpenModal(customer)}
                                  title="Edit"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '4px',
                                    color: 'var(--text-muted, #8C8C8C)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '4px',
                                    transition: 'color 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text, #111111)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)')}
                                >
                                  <Edit3 size={15} strokeWidth={1.8} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="mobile-only-cards" style={{ padding: '0.75rem 0' }}>
                  {displayedCustomers.map((customer) => {
                    const hasDue = (customer.pending_balance || 0) > 0
                    const payableBal = parseFloat(customer.remaining_payable ?? customer.payable_amount) || 0
                    const hasPayable = payableBal > 0
                    const initials = customer.name
                      ? customer.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
                      : 'CU'

                    return (
                      <div 
                        key={customer.id} 
                        className="mobile-entity-card"
                        style={{
                          background: 'var(--card-bg, #FFFFFF)',
                          border: '1px solid var(--border, #E4E4E4)',
                          borderRadius: '16px',
                          padding: '16px',
                          marginBottom: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: 'var(--fill-ghost-hover, #F4F4F4)',
                              color: 'var(--text, #111111)',
                              fontSize: '12px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {initials}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {customer.name}
                              </div>
                              {customer.company_name && (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '1px' }}>
                                  {customer.company_name}
                                </div>
                              )}
                              <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>CID-{customer.id.toString().padStart(5, '0')}</span>
                                {customer.phone && <span>&bull; {customer.phone}</span>}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '10px', background: 'var(--fill-ghost-hover, #F4F4F4)', borderRadius: '10px', marginBottom: '12px' }}>
                          <div>
                            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>Billed</span>
                            <span style={{ fontSize: '13px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text, #111111)' }}>{formatCurrency(customer.total_billed || 0)}</span>
                          </div>
                          <div>
                            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>Received</span>
                            <span style={{ fontSize: '13px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text, #111111)' }}>{formatCurrency(customer.paid_amount || 0)}</span>
                          </div>
                          <div>
                            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>Receivables Due</span>
                            <span style={{ fontSize: '13px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: hasDue ? 'var(--danger, #DC2626)' : 'var(--text, #111111)' }}>
                              {formatCurrency(customer.pending_balance || 0)}
                            </span>
                          </div>
                          <div>
                            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>Payables Owed</span>
                            <span style={{ fontSize: '13px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: hasPayable ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)' }}>
                              {formatCurrency(payableBal)}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {customer.phone && (
                              <a 
                                href={`tel:${customer.phone}`} 
                                style={{ padding: '6px', borderRadius: '4px', color: 'var(--text-muted, #8C8C8C)', display: 'inline-flex', alignItems: 'center' }}
                                title="Call customer"
                              >
                                <Phone size={14} />
                              </a>
                            )}
                            {customer.email && (
                              <a 
                                href={`mailto:${customer.email}`} 
                                style={{ padding: '6px', borderRadius: '4px', color: 'var(--text-muted, #8C8C8C)', display: 'inline-flex', alignItems: 'center' }}
                                title="Email customer"
                              >
                                <Mail size={14} />
                              </a>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              type="button"
                              onClick={() => handleOpenModal(customer)}
                              title="Edit Customer"
                              style={{ background: 'none', border: 'none', padding: '6px', color: 'var(--text-muted, #8C8C8C)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                            >
                              <Edit3 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <CredPagination
                    page={page}
                    totalPages={totalPages}
                    total={summary.total_count || customers.length}
                    rangeStart={(page - 1) * 25 + 1}
                    rangeEnd={Math.min(page * 25, summary.total_count || customers.length)}
                    onPageChange={(p) => setPage(p)}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── 6. ADD / EDIT CUSTOMER MODAL (Enquiries ModalShell Style) ── */}
      <ModalShell
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'New Customer'}
        maxWidth="540px"
        formId="customer-modal-form"
        submitLabel={editingCustomer ? 'Save Changes' : 'Create Customer'}
        submittingLabel="Saving..."
        submitting={submitting}
        closeOnBackdrop={false}
      >
        <form id="customer-modal-form" onSubmit={handleSubmit}>
          {formError && (
            <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <AlertCircle size={18} /> {formError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
            <Field label="Full Name / Primary Contact" required>
              <TextInput
                required
                autoFocus
                placeholder="e.g. Faisal Al-Harbi"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Field>

            <Field label="Company Name">
              <TextInput
                placeholder="e.g. Kingdom Trading LLC"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field label="Email Address">
                <TextInput
                  type="email"
                  placeholder="e.g. client@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </Field>
              <Field label="Phone Number">
                <TextInput
                  type="tel"
                  placeholder="e.g. +966 50 123 4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </Field>
            </div>

            <Field
              label="Payable Amount (SAR)"
              rightAction={
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>
                  {editingCustomer ? 'Amount company owes to customer' : 'Initial payable balance owed'}
                </span>
              }
            >
              <NumberInput
                step="0.01"
                min="0"
                prefix="SAR"
                placeholder="0.00"
                value={formData.payable_amount}
                onChange={(e) => setFormData({ ...formData, payable_amount: e.target.value })}
              />
            </Field>

            <Field label="Complete Address">
              <Textarea
                rows={3}
                placeholder="Enter building number, street, district, city..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </Field>
          </div>
        </form>
      </ModalShell>
    </div>
  )
}

export default Customers
