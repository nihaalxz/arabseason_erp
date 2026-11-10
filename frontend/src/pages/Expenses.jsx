import { useState, useEffect, useMemo } from 'react'
import PageHeaderButton from '../components/common/PageHeaderButton'
import { useSettings } from '../contexts/SettingsContext'
import { Edit3, Trash2, AlertCircle, Receipt } from 'lucide-react'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { CredAnimatedTabs } from '../components/cashbook/cred/CredAnimatedTabs'
import CredSearchInput from '../components/cashbook/cred/CredSearchInput'
import CredPagination from '../components/cashbook/cred/CredPagination'
import {
  ModalShell,
  Field,
  TextInput,
  NumberInput,
  Select,
  DateInput,
  Textarea,
  Checkbox
} from '../components/common/FormPrimitives'
import { showConfirm, showError, showToast } from '../utils/swal'

const Expenses = () => {
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  // Category Books Navigation
  const [selectedCategoryBook, setSelectedCategoryBook] = useState('all')
  const [summaryData, setSummaryData] = useState({ total_amount: 0, count: 0, by_category: [] })

  // Lookups
  const [jobOrders, setJobOrders] = useState([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [showAddType, setShowAddType] = useState(false)

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: '',
    type: 'Operational',
    notes: '',
    job_order: '',
    is_opening_balance: false
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  
  // Settings Context
  const context = useSettings()
  const settings = context?.settings || {}
  const formatCurrency = context?.formatCurrency || ((v) => v)

  const fetchSummary = async () => {
    try {
      const res = await api.get('expenses/summary/')
      if (res.data) {
        setSummaryData(res.data)
      }
    } catch (err) {
      console.error('Fetch Expense Summary error:', err)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await api.get('expense-categories/?limit=1000')
      const data = res.data.results || res.data || []
      setCategories(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Fetch Categories error:', err)
    }
  }

  const fetchTypes = async () => {
    try {
      const res = await api.get('expense-types/?limit=1000')
      const data = res.data.results || res.data || []
      setTypes(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Fetch Types error:', err)
    }
  }

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      const params = { page }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }
      if (selectedCategoryBook && selectedCategoryBook !== 'all') {
        params.category = selectedCategoryBook
      }
      const response = await api.get('expenses/', { params })
      const results = response.data.results || response.data || []
      setExpenses(results)
      const count = response.data.count || results.length
      setTotalCount(count)
      setTotalPages(Math.ceil(count / 25) || 1)
      setError('')
    } catch (err) {
      console.error('Fetch Expenses error:', err)
      setError('Failed to fetch expenses. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (val) => {
    setSearchQuery(val)
    setPage(1)
  }

  const handleSelectBook = (categoryName) => {
    setSelectedCategoryBook(categoryName)
    setPage(1)
  }

  const fetchLookups = async () => {
    try {
      const res = await api.get('job-orders/')
      const data = res.data.results || res.data || []
      setJobOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Fetch Lookups error:', err)
    }
  }

  useEffect(() => {
    fetchExpenses()
  }, [page, searchQuery, selectedCategoryBook])

  useEffect(() => {
    fetchSummary()
  }, [expenses.length])

  useEffect(() => {
    fetchLookups()
    fetchCategories()
    fetchTypes()
  }, [])

  // Listen to top-strip refresh event
  useEffect(() => {
    const handleAppRefresh = () => {
      fetchExpenses()
      fetchSummary()
    }
    window.addEventListener('app:refresh', handleAppRefresh)
    return () => window.removeEventListener('app:refresh', handleAppRefresh)
  }, [page, searchQuery, selectedCategoryBook])

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      const res = await api.post('expense-categories/', { name: newCategoryName })
      setCategories([...categories, res.data].sort((a,b) => a.name.localeCompare(b.name)))
      setFormData({ ...formData, category: res.data.name })
      setNewCategoryName('')
      setShowAddCategory(false)
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Category already exists or failed to create.')
    }
  }

  const handleAddType = async () => {
    if (!newTypeName.trim()) return
    try {
      const res = await api.post('expense-types/', { name: newTypeName })
      setTypes([...types, res.data].sort((a,b) => a.name.localeCompare(b.name)))
      setFormData({ ...formData, type: res.data.name })
      setNewTypeName('')
      setShowAddType(false)
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Type already exists or failed to create.')
    }
  }

  const handleOpenModal = (expense = null) => {
    setShowAddCategory(false)
    setNewCategoryName('')
    setShowAddType(false)
    setNewTypeName('')
    if (expense) {
      setEditingExpense(expense)
      setFormData({
        description: expense.description || '',
        amount: expense.amount || 0,
        date: expense.date || new Date().toISOString().split('T')[0],
        category: expense.category || '',
        type: expense.type || 'Operational',
        notes: expense.notes || '',
        job_order: expense.job_order || '',
        is_opening_balance: expense.is_opening_balance || false
      })
    } else {
      setEditingExpense(null)
      setFormData({
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        category: categories[0]?.name || '',
        type: 'Operational',
        notes: '',
        job_order: '',
        is_opening_balance: false
      })
    }
    setFormError('')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.description || !formData.amount || !formData.category) {
      return setFormError('Description, Amount, and Category are required')
    }
    
    try {
      setSubmitting(true)
      setFormError('')
      
      const payload = { ...formData, job_order: formData.job_order || null }

      if (editingExpense) {
        const response = await api.put(`expenses/${editingExpense.id}/`, payload)
        setExpenses(expenses.map(exp => exp.id === editingExpense.id ? response.data : exp))
      } else {
        const response = await api.post('expenses/', payload)
        setExpenses([response.data, ...expenses])
      }
      
      setIsModalOpen(false)
      setEditingExpense(null)
    } catch (err) {
      setFormError(err.response?.data?.message || 'Operation failed. Please check your data.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Expense?',
      text: 'Are you sure you want to delete this expense record? This action will adjust financial totals.',
      confirmButtonText: 'Yes, Delete',
      isDangerous: true,
    })
    if (confirmed) {
      try {
        await api.delete(`expenses/${id}/`)
        setExpenses(expenses.filter(e => e.id !== id))
        showToast('Expense record deleted', 'success')
      } catch {
        showError('Delete Failed', 'Failed to delete expense.')
      }
    }
  }

  const safeFormatCurrency = (val) => {
    try {
      return formatCurrency(val || 0)
    } catch {
      return `${settings?.currency || ''} ${val || 0}`
    }
  }

  const activeCategorySummary = summaryData.by_category?.find(c => c.category === selectedCategoryBook)
  const currentTotalAmount = selectedCategoryBook === 'all' 
    ? (summaryData.total_amount || expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0))
    : (activeCategorySummary ? activeCategorySummary.total : expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0))
  const currentCount = selectedCategoryBook === 'all'
    ? (summaryData.count || totalCount || expenses.length)
    : (activeCategorySummary ? activeCategorySummary.count : expenses.length)
  const currentAvg = currentCount > 0 ? (currentTotalAmount / currentCount) : 0

  // Category Animated Tabs list
  const categoryTabs = useMemo(() => {
    const list = [
      { id: 'all', label: 'All Books', count: summaryData.count || totalCount }
    ]
    categories.forEach((c) => {
      const catStat = summaryData.by_category?.find((sc) => sc.category === c.name)
      list.push({
        id: c.name,
        label: c.name,
        count: catStat ? catStat.count : undefined
      })
    })
    return list
  }, [categories, summaryData, totalCount])

  return (
    <div className="expenses-page erp-page-container erp-page-transition" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', paddingBottom: '3rem' }}>
      
      {/* ── 1. PAGE HEADER (Enquiries CRED Style) ── */}
      <div className="page-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontWeight: 600, letterSpacing: '-0.02em', fontSize: '24px', margin: 0, color: 'var(--text, #0A0A0A)' }}>
            Expenses
          </h2>
          <p style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '13px', margin: '4px 0 0' }}>
            Track operational costs, vendor bills, and business expenditures
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <PageHeaderButton onClick={() => handleOpenModal()}>
            Record Expense
          </PageHeaderButton>
        </div>
      </div>

      {/* ── 2. CATEGORY TABS (CRED Animated Tabs) ── */}
      {categoryTabs.length > 1 && (
        <div style={{ width: '100%', overflowX: 'auto', marginBottom: '1.25rem', WebkitOverflowScrolling: 'touch' }}>
          <CredAnimatedTabs
            tabs={categoryTabs}
            value={selectedCategoryBook}
            onChange={handleSelectBook}
            className="case-preserve"
            layoutId="expenses-category-tabs"
          />
        </div>
      )}

      {/* ── 3. BORDERLESS FILLED SEARCH BAR ── */}
      <div style={{ width: '100%', marginBottom: '1.25rem' }}>
        <CredSearchInput
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onClear={() => handleSearchChange('')}
          placeholder="Search expenses by description, category, or note…"
          style={{ width: '100%', height: '38px' }}
        />
      </div>

      {error && (
        <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* ── 4. MAIN DATA TABLE (Customers Table Style) ── */}
      <div style={{ width: '100%', position: 'relative', marginBottom: '2.5rem' }}>
        {loading && expenses.length === 0 ? (
          <div style={{ padding: '1.5rem 0' }}>
            <SkeletonLoader type="table" />
          </div>
        ) : (
          <>
            {expenses.length === 0 && !error && (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                <Receipt size={22} strokeWidth={1.6} style={{ color: 'var(--text-muted, #8C8C8C)', opacity: 0.6, marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>
                  {searchQuery 
                    ? `No expenses matching "${searchQuery}" in ${selectedCategoryBook === 'all' ? 'any book' : selectedCategoryBook}.` 
                    : `No expenses recorded in ${selectedCategoryBook === 'all' ? 'the system' : selectedCategoryBook}. Click "Record Expense" to create one.`}
                </p>
              </div>
            )}

            {expenses.length > 0 && (
              <>
                {/* Desktop Table View */}
                <div className="desktop-only-table" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)' }}>
                        <th style={{ width: '15%', padding: '10px 16px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Date</th>
                        <th style={{ width: '40%', padding: '10px 16px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Description</th>
                        <th style={{ width: '20%', padding: '10px 16px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>Linked Job</th>
                        <th style={{ minWidth: '150px', padding: '10px 16px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Amount</th>
                        <th style={{ width: '80px', minWidth: '80px', padding: '10px 16px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((exp) => (
                        <tr
                          key={exp?.id || Math.random()}
                          className="cred-table-row"
                          onClick={() => handleOpenModal(exp)}
                          style={{
                            borderBottom: '1px solid var(--border, #E4E4E4)',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          {/* Date */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '13px', color: 'var(--text-muted, #8C8C8C)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {exp?.date || '—'}
                          </td>

                          {/* Description */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {exp?.description || 'No Description'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                              {exp?.category || 'General'} &bull; {exp?.type || 'Operational'}
                              {exp?.is_opening_balance && (
                                <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>
                                  (Opening Bal)
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Linked Job */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '13px', color: exp?.job_order ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>
                            {exp?.job_order ? (
                              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {exp.job_order_title || exp.job_order_order_id || (typeof exp.job_order === 'object' ? exp.job_order.title || exp.job_order.order_id : `Job #${exp.job_order}`)}
                              </span>
                            ) : '—'}
                          </td>

                          {/* Amount */}
                          <td style={{ minWidth: '150px', padding: '12px 16px', verticalAlign: 'middle', textAlign: 'right', fontSize: '13px', fontVariantNumeric: 'tabular-nums', color: 'var(--danger, #DC2626)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            − {safeFormatCurrency(exp?.amount)}
                          </td>

                          {/* Actions */}
                          <td style={{ width: '80px', minWidth: '80px', padding: '12px 16px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                              <button
                                type="button"
                                className="cred-action-icon-btn"
                                onClick={() => handleOpenModal(exp)}
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
                              <button
                                type="button"
                                className="cred-action-icon-btn delete"
                                onClick={() => handleDelete(exp?.id)}
                                title="Delete"
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
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger, #DC2626)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)')}
                              >
                                <Trash2 size={15} strokeWidth={1.8} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── 5. BORDERLESS SUMMARY ROW (CRED Typography) ── */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                  padding: '16px 4px',
                  borderTop: '1px solid var(--border, #E4E4E4)',
                  marginTop: '8px',
                  fontSize: '12px',
                  color: 'var(--text-muted, #8C8C8C)'
                }}>
                  <div>
                    <span>Active Book: </span>
                    <strong style={{ color: 'var(--text, #0A0A0A)', fontWeight: 500 }}>
                      {selectedCategoryBook === 'all' ? 'All Expenses' : selectedCategoryBook}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    <div>
                      <span>Total Entries: </span>
                      <strong style={{ color: 'var(--text, #0A0A0A)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                        {currentCount}
                      </strong>
                    </div>
                    <div>
                      <span>Total Expenditure: </span>
                      <strong style={{ color: 'var(--danger, #DC2626)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        − {safeFormatCurrency(currentTotalAmount)}
                      </strong>
                    </div>
                    <div>
                      <span>Average / Entry: </span>
                      <strong style={{ color: 'var(--text, #0A0A0A)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                        {safeFormatCurrency(currentAvg)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* ── 6. PAGINATION (CredPagination) ── */}
                {totalPages > 1 && (
                  <CredPagination
                    page={page}
                    totalPages={totalPages}
                    total={totalCount}
                    rangeStart={(page - 1) * 25 + 1}
                    rangeEnd={Math.min(page * 25, totalCount)}
                    onPageChange={(p) => setPage(p)}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── 7. ADD / EDIT EXPENSE MODAL (Enquiries ModalShell Style) ── */}
      <ModalShell
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense ? 'Edit Expense' : 'New Expense'}
        maxWidth="560px"
        formId="expense-modal-form"
        submitLabel={editingExpense ? 'Save Changes' : 'Create Expense'}
        submittingLabel="Saving..."
        submitting={submitting}
        closeOnBackdrop={false}
      >
        <form id="expense-modal-form" onSubmit={handleSubmit}>
          {formError && (
            <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <AlertCircle size={18} /> {formError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
            <Field label="Description" required>
              <TextInput
                required
                autoFocus
                placeholder="e.g. Office stationery, equipment maintenance..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field
                label="Category"
                required
                rightAction={
                  !showAddCategory ? (
                    <button
                      type="button"
                      onClick={() => setShowAddCategory(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted, #8C8C8C)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text, #111111)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)')}
                    >
                      + Add new
                    </button>
                  ) : null
                }
              >
                {!showAddCategory ? (
                  <Select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Select Category"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <TextInput
                      autoFocus
                      placeholder="Category name..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="page-header-btn"
                      style={{ height: '38px', padding: '0 12px', fontSize: '12px' }}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddCategory(false); setNewCategoryName('') }}
                      className="cred-modal-cancel-btn"
                      style={{ height: '38px', padding: '0 10px', fontSize: '12px' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </Field>

              <Field
                label="Type"
                required
                rightAction={
                  !showAddType ? (
                    <button
                      type="button"
                      onClick={() => setShowAddType(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted, #8C8C8C)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text, #111111)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)')}
                    >
                      + Add new
                    </button>
                  ) : null
                }
              >
                {!showAddType ? (
                  <Select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    placeholder="Select Type"
                  >
                    {types.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <TextInput
                      autoFocus
                      placeholder="Type name..."
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleAddType}
                      className="page-header-btn"
                      style={{ height: '38px', padding: '0 12px', fontSize: '12px' }}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddType(false); setNewTypeName('') }}
                      className="cred-modal-cancel-btn"
                      style={{ height: '38px', padding: '0 10px', fontSize: '12px' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field label="Amount" required>
                <NumberInput
                  required
                  step="0.01"
                  min="0"
                  prefix="SAR"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </Field>

              <Field label="Date of Expense" required>
                <DateInput
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Link to Job Order (Optional)">
              <Select
                value={formData.job_order}
                onChange={(e) => setFormData({ ...formData, job_order: e.target.value })}
              >
                <option value="">No Active Linkage</option>
                {jobOrders && jobOrders.map((j) => (
                  <option key={j?.id || Math.random()} value={j?.id}>
                    {j?.order_id || `#ID${j?.id}`} — {j?.title || 'Job Order'}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Additional Notes">
              <Textarea
                rows={2}
                placeholder="Enter any additional reference notes or remarks..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Field>

            <div style={{ paddingTop: '2px' }}>
              <Checkbox
                checked={formData.is_opening_balance}
                onChange={(checked) => setFormData({ ...formData, is_opening_balance: checked })}
                label={
                  <span style={{ fontSize: '13px', color: 'var(--text, #111111)', fontWeight: 400 }}>
                    Mark as System Opening Balance
                  </span>
                }
              />
            </div>
          </div>
        </form>
      </ModalShell>
    </div>
  )
}

export default Expenses
