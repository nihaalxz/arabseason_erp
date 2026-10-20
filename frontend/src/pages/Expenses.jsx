import { useState, useEffect } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { Plus, Minus, RefreshCw, AlertCircle, Edit, Trash2, ArrowLeft, X, ChevronDown, BookOpen, Folder, ChevronRight, Layers, ArrowUpDown, Receipt } from '../components/icons'
import api from '../api'
import Modal from '../components/common/Modal'
import SkeletonLoader from '../components/common/SkeletonLoader'
import SearchBar from '../components/common/SearchBar'
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

  // Custom Dropdown Open States
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)

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
  
  // Defensive Context Access
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
      setExpenses(response.data.results || [])
      setTotalCount(response.data.count || 0)
      setTotalPages(Math.ceil((response.data.count || 0) / 25) || 1)
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

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      const res = await api.post('expense-categories/', { name: newCategoryName })
      setCategories([...categories, res.data].sort((a,b) => a.name.localeCompare(b.name)))
      setFormData({ ...formData, category: res.data.name })
      setNewCategoryName('')
      setShowAddCategory(false)
      setCategoryDropdownOpen(false)
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Category already exists or failed to create.')
    }
  }

  const handleDeleteCategory = async (e, id) => {
    e.stopPropagation()
    const confirmed = await showConfirm({
      title: 'Delete Category?',
      text: 'Delete this category? This cannot be undone.',
      confirmButtonText: 'Yes, Delete',
      isDangerous: true,
    })
    if (!confirmed) return
    try {
      await api.delete(`expense-categories/${id}/`)
      setCategories(categories.filter(c => c.id !== id))
      showToast('Category deleted', 'success')
    } catch (err) {
      showError('Delete Failed', err.response?.data?.message || err.response?.data?.detail || 'Failed to delete category.')
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
      setTypeDropdownOpen(false)
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Type already exists or failed to create.')
    }
  }

  const handleDeleteType = async (e, id) => {
    e.stopPropagation()
    const confirmed = await showConfirm({
      title: 'Delete Type?',
      text: 'Delete this type? This cannot be undone.',
      confirmButtonText: 'Yes, Delete',
      isDangerous: true,
    })
    if (!confirmed) return
    try {
      await api.delete(`expense-types/${id}/`)
      setTypes(types.filter(t => t.id !== id))
      showToast('Type deleted', 'success')
    } catch (err) {
      showError('Delete Failed', err.response?.data?.message || err.response?.data?.detail || 'Failed to delete type.')
    }
  }

  const handleOpenModal = (expense = null) => {
    setShowAddCategory(false)
    setNewCategoryName('')
    setShowAddType(false)
    setNewTypeName('')
    setCategoryDropdownOpen(false)
    setTypeDropdownOpen(false)
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
        category: '',
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
      } catch (err) {
        showError('Delete Failed', 'Failed to delete expense.')
      }
    }
  }

  const safeFormatCurrency = (val) => {
    try {
      return formatCurrency(val || 0)
    } catch (e) {
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

  return (
    <div className="expenses-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', paddingBottom: '3rem' }}>
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontWeight: '700', letterSpacing: '-0.01em', fontSize: '1.35rem' }}>Expenses</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>Track operational costs, vendor bills, and business expenditures</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ borderRadius: 'var(--radius-sm)' }}>
            <Plus size={16} /> Record Expense
          </button>
        </div>
      </div>

      {/* Category Books: Breadcrumb when viewing a specific book */}
      {selectedCategoryBook !== 'all' && (
        <div className="breadcrumb-nav-bar" style={{ marginBottom: '1rem' }}>
          <span className="breadcrumb-item" onClick={() => handleSelectBook('all')}>
            <BookOpen size={15} /> All Expense Books
          </span>
          <span className="breadcrumb-separator"><ChevronRight size={14} /></span>
          <span className="breadcrumb-current">
            <Folder size={15} /> {selectedCategoryBook}
          </span>
          <button 
            onClick={() => handleSelectBook('all')}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.825rem', fontWeight: '600' }}
          >
            &larr; View All Books
          </button>
        </div>
      )}

      {/* Category Books Grid (Cashbook Shelf Pattern) */}
      {selectedCategoryBook === 'all' && summaryData.by_category && summaryData.by_category.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={16} color="var(--primary)" />
              Browse by Expense Category Books ({summaryData.by_category.length})
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click any category book to view its records</span>
          </div>
          <div className="category-books-grid">
            {summaryData.by_category.map(cat => (
              <div 
                key={cat.category} 
                className="category-book-card"
                onClick={() => handleSelectBook(cat.category)}
              >
                <div className="category-book-header">
                  <div className="category-book-icon">
                    <BookOpen size={18} />
                  </div>
                  <div className="category-book-badge">
                    {cat.count} {cat.count === 1 ? 'entry' : 'entries'}
                  </div>
                </div>
                <div className="category-book-title">{cat.category}</div>
                <div className="category-book-total">{safeFormatCurrency(cat.total)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Category Books Pill Bar */}
      <div className="category-pill-bar" style={{ marginBottom: '1.25rem' }}>
        <button 
          className={`category-pill ${selectedCategoryBook === 'all' ? 'active' : ''}`}
          onClick={() => handleSelectBook('all')}
        >
          All Books ({summaryData.count || totalCount})
        </button>
        {categories.map(c => {
          const catStat = summaryData.by_category?.find(sc => sc.category === c.name)
          return (
            <button 
              key={c.id} 
              className={`category-pill ${selectedCategoryBook === c.name ? 'active' : ''}`}
              onClick={() => handleSelectBook(c.name)}
            >
              {c.name} {catStat ? `(${catStat.count})` : ''}
            </button>
          )
        })}
      </div>

      <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <SearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          style={{ flex: 1, minWidth: '220px', maxWidth: '420px' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={() => { fetchExpenses(); fetchSummary(); }}
            title="Refresh table"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="glass-panel" style={{ overflowX: 'auto', minHeight: '200px', position: 'relative', paddingBottom: 0 }}>
        {loading ? (
          <div style={{ padding: '1.5rem' }}>
            <SkeletonLoader type="table" />
          </div>
        ) : (
          <>
        {!loading && expenses && expenses.length === 0 && !error && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {searchQuery 
              ? `No expenses matching "${searchQuery}" in ${selectedCategoryBook === 'all' ? 'any book' : selectedCategoryBook}` 
              : `No expenses recorded in ${selectedCategoryBook === 'all' ? 'the system' : selectedCategoryBook}. Click "+ Record Expense" to create one.`}
          </div>
        )}

        {!loading && expenses && expenses.length > 0 && (
          <>
            {/* Desktop Table View */}
            <div className="desktop-only-table">
              <div className="table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Entry Date</th>
                      <th>Classification / Details</th>
                      <th>Linked Entity</th>
                      <th style={{ textAlign: 'right' }}>Expenditure Value</th>
                      <th style={{ textAlign: 'right' }}>Management</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(exp => (
                      <tr key={exp?.id || Math.random()} style={{ borderLeft: '4px solid #dc2626' }}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{exp?.date || 'N/A'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{exp?.description || 'No Description'}</span>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca',
                              padding: '1px 7px',
                              borderRadius: '12px',
                              fontSize: '0.68rem',
                              fontWeight: '800'
                            }}>
                              <Minus size={10} strokeWidth={3} /> Cash Out
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: 'var(--text-muted)' }}>
                            {exp?.category} &bull; {exp?.type} {exp?.is_opening_balance && <span style={{ background: 'var(--warning)', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.5rem' }}>Opening Bal</span>}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          {exp?.job_order ? (
                            <span style={{ background: 'var(--primary-10, rgba(59, 130, 246, 0.1))', color: 'var(--primary)', padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>
                              Linked Job
                            </span>
                          ) : '---'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: '#dc2626' }}>
                          − {safeFormatCurrency(exp?.amount)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button 
                              className="btn-icon" 
                              style={{ width: '32px', height: '32px' }}
                              onClick={() => handleOpenModal(exp)}
                              title="Modify Record"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className="btn-icon" 
                              style={{ width: '32px', height: '32px', color: 'var(--danger)' }}
                              onClick={() => handleDelete(exp?.id)}
                              title="Remove Record"
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
            </div>

            {/* Mobile Native Cards View (<= 768px) */}
            <div className="mobile-only-cards" style={{ padding: '0.75rem' }}>
              {expenses.map(exp => (
                <div 
                  key={exp?.id || Math.random()} 
                  className="mobile-entity-card"
                  style={{ borderLeft: '4px solid #dc2626' }}
                  onClick={() => handleOpenModal(exp)}
                >
                  <div className="mobile-card-header">
                    <div className="mobile-card-title-group">
                      <div 
                        className="mobile-card-avatar" 
                        style={{ background: '#fee2e2', color: '#dc2626' }}
                      >
                        <Receipt size={17} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="mobile-card-title">{exp?.description || 'Expense Entry'}</div>
                        <div className="mobile-card-sub" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fecaca',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            fontSize: '0.65rem',
                            fontWeight: '800'
                          }}>
                            <Minus size={9} strokeWidth={3} /> Cash Out
                          </span>
                          <span style={{ fontWeight: '600', color: '#475569' }}>{exp?.category}</span>
                          <span>&bull; {exp?.date || 'N/A'}</span>
                          {exp?.is_opening_balance && (
                            <span style={{ background: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700' }}>
                              Opening Bal
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '1rem', fontWeight: '800', color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                        -{safeFormatCurrency(exp?.amount)}
                      </div>
                      {exp?.job_order && (
                        <span className="mobile-card-badge" style={{ background: '#ebf3fc', color: '#1366d9', fontSize: '0.65rem' }}>
                          Linked Job
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mobile-card-footer" onClick={(e) => e.stopPropagation()}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Type: {exp?.type || 'Standard'}
                    </div>
                    <div className="mobile-card-actions">
                      <button 
                        className="mobile-card-action-btn" 
                        onClick={() => handleOpenModal(exp)}
                        title="Modify Record"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        className="mobile-card-action-btn delete" 
                        onClick={() => handleDelete(exp?.id)}
                        title="Remove Record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Always Visible Sticky Totals Bar */}
            <div className="sticky-totals-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={16} color="var(--primary)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Book:</span>
                <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.875rem' }}>
                  {selectedCategoryBook === 'all' ? 'All Expenses' : selectedCategoryBook}
                </span>
              </div>
              <div className="sticky-totals-items">
                <div className="sticky-total-item">
                  <span className="sticky-total-label">Total Entries</span>
                  <span className="sticky-total-value">{currentCount}</span>
                </div>
                <div className="sticky-total-item">
                  <span className="sticky-total-label">Total Expenditure</span>
                  <span className="sticky-total-value" style={{ color: 'var(--danger)' }}>
                    {safeFormatCurrency(currentTotalAmount)}
                  </span>
                </div>
                <div className="sticky-total-item">
                  <span className="sticky-total-label">Average / Entry</span>
                  <span className="sticky-total-value">
                    {safeFormatCurrency(currentAvg)}
                  </span>
                </div>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="pagination" style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                <button 
                  className="btn glass-panel" 
                  disabled={page === 1}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                >
                  Prev
                </button>
                <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
                  Page {page} of {totalPages}
                </span>
                <button 
                  className="btn glass-panel" 
                  disabled={page === totalPages}
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
          </>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span>{editingExpense ? 'Edit Expense' : 'Add New Expense'}</span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0.2rem 0.65rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: '800',
              background: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fecaca'
            }}>
              <Minus size={12} strokeWidth={3} /> Cash Out (Debit)
            </span>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="form-grid">
          {formError && <div className="error-message col-span-2">{formError}</div>}
          
          <div className="form-group col-span-2">
            <label>Description *</label>
            <input 
              type="text" 
              className="input-field" 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              required
            />
          </div>
          
          <style dangerouslySetInnerHTML={{__html: `
            .custom-dropdown-item { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem; cursor: pointer; transition: background 0.2s; }
            .custom-dropdown-item:hover { background: var(--border-light); }
            .custom-dropdown-item .delete-btn { opacity: 0; color: var(--danger); background: transparent; border: none; cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
            .custom-dropdown-item:hover .delete-btn { opacity: 1; }
            .custom-dropdown-item .delete-btn:hover { background: rgba(239, 68, 68, 0.1); }
          `}} />
          
          <div className="form-group">
            <label>Category *</label>
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', position: 'relative' }}>
              {!showAddCategory ? (
                <div style={{ position: 'relative', flex: 1 }}>
                  <div 
                    className="input-field" 
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}
                    onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                  >
                    <span>{formData.category || 'Select Category'}</span>
                    <ChevronDown size={16} color="var(--text-muted)" />
                  </div>
                  {categoryDropdownOpen && (
                    <div className="glass-panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '4px', maxHeight: '200px', overflowY: 'auto', padding: 0 }}>
                      {categories.map(c => (
                        <div key={c.id} className="custom-dropdown-item" onClick={() => { setFormData({...formData, category: c.name}); setCategoryDropdownOpen(false); }}>
                          <span>{c.name}</span>
                          <button type="button" className="delete-btn" onClick={(e) => handleDeleteCategory(e, c.id)} title="Delete Category"><X size={14} /></button>
                        </div>
                      ))}
                      <div className="custom-dropdown-item" style={{ fontWeight: 'bold', color: 'var(--primary)' }} onClick={() => { setShowAddCategory(true); setCategoryDropdownOpen(false); }}>
                        + Add New Category
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <input 
                    type="text" className="input-field"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    autoFocus
                  />
                  <button type="button" className="btn btn-primary" style={{ padding: '0.5rem' }} onClick={handleAddCategory}>Add</button>
                  <button type="button" className="btn" style={{ padding: '0.5rem' }} onClick={() => setShowAddCategory(false)}><ArrowLeft size={16}/></button>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Type *</label>
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', position: 'relative' }}>
              {!showAddType ? (
                <div style={{ position: 'relative', flex: 1 }}>
                  <div 
                    className="input-field" 
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}
                    onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                  >
                    <span>{formData.type || 'Select Type'}</span>
                    <ChevronDown size={16} color="var(--text-muted)" />
                  </div>
                  {typeDropdownOpen && (
                    <div className="glass-panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '4px', maxHeight: '200px', overflowY: 'auto', padding: 0 }}>
                      {types.map(t => (
                        <div key={t.id} className="custom-dropdown-item" onClick={() => { setFormData({...formData, type: t.name}); setTypeDropdownOpen(false); }}>
                          <span>{t.name}</span>
                          <button type="button" className="delete-btn" onClick={(e) => handleDeleteType(e, t.id)} title="Delete Type"><X size={14} /></button>
                        </div>
                      ))}
                      <div className="custom-dropdown-item" style={{ fontWeight: 'bold', color: 'var(--primary)' }} onClick={() => { setShowAddType(true); setTypeDropdownOpen(false); }}>
                        + Add New Type
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <input 
                    type="text" className="input-field"
                    value={newTypeName}
                    onChange={e => setNewTypeName(e.target.value)}
                    autoFocus
                  />
                  <button type="button" className="btn btn-primary" style={{ padding: '0.5rem' }} onClick={handleAddType}>Add</button>
                  <button type="button" className="btn" style={{ padding: '0.5rem' }} onClick={() => setShowAddType(false)}><ArrowLeft size={16}/></button>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Amount *</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
              <span style={{ 
                position: 'absolute', left: '12px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '700', zIndex: 1
              }}>{settings?.currency || ''}</span>
              <input 
                type="number" step="0.01" className="input-field" style={{ paddingLeft: '3.5rem' }}
                value={formData.amount} 
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Date of Expense *</label>
            <input 
              type="date" className="input-field" value={formData.date} 
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              required
            />
          </div>

          <div className="form-group col-span-2">
            <label>Link to Job Order (Optional)</label>
            <select className="input-field" value={formData.job_order} onChange={e => setFormData({...formData, job_order: e.target.value})}>
              <option value="">No Active Linkage</option>
              {jobOrders && jobOrders.map(j => <option key={j?.id || Math.random()} value={j?.id}>{j?.order_id || `#ID${j?.id}`} - {j?.title}</option>)}
            </select>
          </div>

          <div className="form-group col-span-2">
            <label>Additional Notes</label>
            <textarea 
              className="input-field" style={{ minHeight: '60px' }} 
              value={formData.notes} 
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
            ></textarea>
          </div>

          <div className="form-group col-span-2" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             <input 
               type="checkbox" checked={formData.is_opening_balance} 
               onChange={e => setFormData({...formData, is_opening_balance: e.target.checked})}
               style={{ width: '18px', height: '18px', cursor: 'pointer' }}
             />
             <label style={{ margin: 0, cursor: 'pointer', fontWeight: '600' }} onClick={() => setFormData({...formData, is_opening_balance: !formData.is_opening_balance})}>
               Mark as System Opening Balance
             </label>
          </div>

          <div className="col-span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="btn" style={{ padding: '0.75rem 1.5rem' }} onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }} disabled={submitting}>
              {submitting ? (
                <><span className="spinner" style={{ marginRight: '8px' }}></span>Processing...</>
              ) : (editingExpense ? 'Save Changes' : 'Create Expense')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Expenses
