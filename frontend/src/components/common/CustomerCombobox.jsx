import { useState, useRef, useEffect } from 'react'
import { Check, X } from '../icons'
import { ChevronDown } from 'lucide-react'
import api from '../../api'
import { showToast } from '../../utils/swal'

/**
 * CustomerCombobox
 * Searchable dropdown that transforms into a customer card view upon selection:
 * 1. Customer Name (bold)
 * 2. Company / Subtitle / Phone (muted)
 * 3. SAR [amount] due
 */
const CustomerCombobox = ({
  value = '',
  onChange,
  customers = [],
  jobOrders = [],
  invoices = [],
  dueAmount = null,
  invoiceDue = null,
  jobOrderDue = null,
  isDarkMode = false,
  required = false,
  autoFocus = false,
  onFillAmount,
  mode = 'receivable', // 'receivable' | 'payable'
  isPayable = false,
  onSelectCustomer,
  onCustomerCreated,
  onCompanyChange,
  customerCompanyName = ''
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [query, setQuery] = useState(value)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // Inline Quick Add Customer State (matches Job Order inline fields design)
  const [localAddedCustomers, setLocalAddedCustomers] = useState([])
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [quickAddForm, setQuickAddForm] = useState({ name: '', company_name: '' })
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false)
  const [quickAddError, setQuickAddError] = useState('')

  const isPayableMode = mode === 'payable' || isPayable

  useEffect(() => {
    setQuery(value || '')
  }, [value])

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setIsEditing(false)
      }
    }
    if (isOpen || isEditing) {
      document.addEventListener('mousedown', handler)
      document.addEventListener('touchstart', handler)
    }
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [isOpen, isEditing])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setIsEditing(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const allCustomers = [
    ...localAddedCustomers.filter(lc => !customers.some(c => c.id === lc.id)),
    ...customers
  ]

  const handleQuickAddSubmit = async (e) => {
    if (e) {
      if (e.preventDefault) e.preventDefault()
      if (e.stopPropagation) e.stopPropagation()
    }
    const trimmedName = quickAddForm.name.trim()
    if (!trimmedName) {
      setQuickAddError('Customer Name is required')
      return
    }

    try {
      setQuickAddSubmitting(true)
      setQuickAddError('')
      const payload = {
        name: trimmedName,
        company_name: quickAddForm.company_name.trim(),
        company: quickAddForm.company_name.trim()
      }
      const res = await api.post('customers/', payload)
      const newCust = res.data

      setLocalAddedCustomers(prev => [newCust, ...prev])
      handleSelect(newCust)
      if (onCustomerCreated) {
        onCustomerCreated(newCust)
      }

      setIsCreatingNew(false)
      setQuickAddForm({ name: '', company_name: '' })
      showToast(`Customer "${newCust.name}" added successfully!`, 'success')
    } catch (err) {
      console.error('Failed to quick add customer:', err)
      const errorData = err.response?.data
      let msg = 'Failed to create customer'
      if (typeof errorData === 'string') {
        msg = errorData.includes('<html') ? 'A server error occurred. Please try again.' : errorData
      } else if (errorData && typeof errorData === 'object') {
        msg = Object.entries(errorData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
      }
      setQuickAddError(msg)
    } finally {
      setQuickAddSubmitting(false)
    }
  }

  const selectedCustomer = allCustomers.find(
    (c) => (c.name || '').trim().toLowerCase() === (value || '').trim().toLowerCase()
  )

  const filtered = query.trim()
    ? allCustomers.filter((c) => {
        const q = query.toLowerCase()
        return (
          c.name?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.company_name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q)
        )
      })
    : allCustomers

  const getJobOrderDue = (c) => {
    if (!c || !Array.isArray(jobOrders) || !jobOrders.length) return 0
    const custId = c.id
    const cName = (c.name || '').trim().toLowerCase()
    const matchingJobs = jobOrders.filter(j => {
      if (custId && (String(j.customer) === String(custId) || String(j.customer_id) === String(custId))) return true
      if (cName && j.customer_name && j.customer_name.trim().toLowerCase() === cName) return true
      return false
    })
    return matchingJobs.reduce((sum, j) => sum + Math.max(0, parseFloat(j.balance) || 0), 0)
  }

  const getInvoiceDue = (c) => {
    if (!c || !Array.isArray(invoices) || !invoices.length) return 0
    const custId = c.id
    const cName = (c.name || '').trim().toLowerCase()
    const matchingInvoices = invoices.filter(inv => {
      if (inv.status === 'Cancelled' || inv.status === 'Draft') return false
      if (custId && (String(inv.customer) === String(custId) || String(inv.customer_id) === String(custId))) return true
      if (cName && inv.customer_name && inv.customer_name.trim().toLowerCase() === cName) return true
      return false
    })
    return matchingInvoices.reduce((sum, inv) => {
      const bal = inv.balance_due !== undefined 
        ? parseFloat(inv.balance_due) 
        : Math.max(0, (parseFloat(inv.total_amount) || 0) - (parseFloat(inv.paid_amount) || 0))
      return sum + (isNaN(bal) ? 0 : Math.max(0, bal))
    }, 0)
  }

  const getPayable = (c) => Math.max(0, (parseFloat(c?.remaining_payable ?? c?.payable_amount) || 0))

  const getBreakdown = (c) => {
    if (!c) return { totalDue: 0, invoiceDue: 0, jobOrderDue: 0 }
    if (isPayableMode) {
      const p = getPayable(c)
      return { totalDue: p, invoiceDue: 0, jobOrderDue: 0 }
    }
    const isSelected = selectedCustomer && (c.id === selectedCustomer.id || (c.name && c.name.trim().toLowerCase() === selectedCustomer.name?.trim().toLowerCase()))
    
    let invDue = (isSelected && invoiceDue !== null && invoiceDue !== undefined) 
      ? Math.max(0, parseFloat(invoiceDue) || 0)
      : getInvoiceDue(c)
    let joDue = (isSelected && jobOrderDue !== null && jobOrderDue !== undefined)
      ? Math.max(0, parseFloat(jobOrderDue) || 0)
      : getJobOrderDue(c)
      
    // If invDue is 0 and customer has a pending_balance greater than joDue, compute difference as invoice/general due
    if (invDue === 0 && (parseFloat(c.pending_balance || c.outstanding_balance) || 0) > joDue) {
      invDue = Math.max(0, (parseFloat(c.pending_balance || c.outstanding_balance) || 0) - joDue)
    }

    let tot = (isSelected && dueAmount !== null && dueAmount !== undefined)
      ? Math.max(0, parseFloat(dueAmount) || 0)
      : (invDue + joDue)

    // Fallback if neither invoices nor job orders were loaded: use customer pending balance
    if (tot === 0 && !isPayableMode) {
      const rawBal = Math.max(0, parseFloat(c.pending_balance || c.outstanding_balance || ((parseFloat(c.total_billed) || 0) - (parseFloat(c.paid_amount) || 0))) || 0)
      if (rawBal > 0) {
        tot = rawBal
        joDue = rawBal
      }
    }

    return { totalDue: tot, invoiceDue: invDue, jobOrderDue: joDue }
  }

  const getDue = (c) => getBreakdown(c).totalDue
  const dueLabel = isPayableMode ? 'payable' : 'due'

  const handleInputChange = (e) => {
    const v = e.target.value
    setQuery(v)
    onChange(v)
    if (onSelectCustomer) {
      const match = customers.find(c => (c.name || '').trim().toLowerCase() === v.trim().toLowerCase())
      onSelectCustomer(match || null)
    }
    setIsOpen(true)
  }

  const handleSelect = (customer) => {
    setIsCreatingNew(false)
    setQuickAddForm({ name: '', company_name: '' })
    setQuickAddError('')
    setQuery(customer.name)
    onChange(customer.name)
    if (onSelectCustomer) {
      onSelectCustomer(customer)
    }
    setIsOpen(false)
    setIsEditing(false)
    inputRef.current?.blur()
  }

  const handleClear = (e) => {
    if (e) e.stopPropagation()
    setQuery('')
    onChange('')
    if (onSelectCustomer) onSelectCustomer(null)
    setIsEditing(true)
    setIsOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const fmt = (n) =>
    (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  // Monochrome / slate palette
  const bg         = isDarkMode ? '#1a1c20' : '#ffffff'
  const border     = isDarkMode ? '1px solid #2e323a' : '1px solid #cbd5e1'
  const borderOpen = isDarkMode ? '1px solid #52525b' : '1px solid #94a3b8'
  const color      = isDarkMode ? '#ffffff' : '#0f172a'
  const iconColor  = isDarkMode ? '#71767b' : '#94a3b8'
  const menuBg     = isDarkMode ? '#141517' : '#ffffff'
  const menuBorder = isDarkMode ? '1px solid #232528' : '1px solid #e2e8f0'
  const menuShadow = isDarkMode ? '0 12px 32px rgba(0,0,0,0.75)' : '0 8px 24px rgba(15,23,42,0.12)'
  const rowHover   = isDarkMode ? '#1e2024' : '#f8fafc'
  const rowSel     = isDarkMode ? '#27272a' : '#f1f5f9'
  const subColor   = isDarkMode ? '#71767b' : '#64748b'

  // When a valid customer is selected and the user is NOT actively typing to search:
  // Render the selected customer card view directly in the dropdown area!
  const showSelectedCard = selectedCustomer && !isEditing

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {isCreatingNew ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {/* Top Selector displaying + Create Customer */}
          <div
            onClick={() => {
              setIsCreatingNew(false)
              setIsOpen(true)
              setIsEditing(true)
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: bg,
              border: border,
              borderRadius: '10px',
              padding: '10px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ fontWeight: '800', fontSize: '0.92rem', color: isDarkMode ? '#60a5fa' : '#2563eb' }}>
              + Create Customer
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsCreatingNew(false)
                setQuickAddForm({ name: '', company_name: '' })
                setQuickAddError('')
                if (!selectedCustomer) {
                  onChange?.('')
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: isDarkMode ? '#94a3b8' : '#64748b',
                fontSize: '0.74rem',
                cursor: 'pointer',
                fontWeight: '600',
                textDecoration: 'underline'
              }}
            >
              Select existing customer
            </button>
          </div>

          {/* Inline fields card exactly matching new job order fields */}
          <div style={{
            padding: '0.75rem 0.9rem',
            borderRadius: '10px',
            background: isDarkMode ? '#141619' : '#f8fafc',
            border: isDarkMode ? '1px solid #282a2e' : '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: '700', color: isDarkMode ? '#cbd5e1' : '#475569', display: 'block', marginBottom: '0.2rem' }}>
                  Customer Name *
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={quickAddForm.name}
                  onChange={(e) => {
                    const val = e.target.value
                    setQuickAddForm(prev => ({ ...prev, name: val }))
                    onChange?.(val)
                  }}
                  style={{ height: '34px', fontSize: '0.8rem', width: '100%', boxSizing: 'border-box' }}
                  autoFocus
                />
              </div>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: '700', color: isDarkMode ? '#cbd5e1' : '#475569', display: 'block', marginBottom: '0.2rem' }}>
                  Company Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={quickAddForm.company_name}
                  onChange={(e) => {
                    const val = e.target.value
                    setQuickAddForm(prev => ({ ...prev, company_name: val }))
                    onCompanyChange?.(val)
                  }}
                  style={{ height: '34px', fontSize: '0.8rem', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {quickAddError && (
              <div style={{
                fontSize: '0.74rem',
                color: '#ef4444',
                marginTop: '0.2rem'
              }}>
                {quickAddError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={handleQuickAddSubmit}
                disabled={quickAddSubmitting || !quickAddForm.name.trim()}
                className="btn btn-primary"
                style={{
                  height: '32px',
                  fontSize: '0.78rem',
                  padding: '0 1rem',
                  fontWeight: '700',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {quickAddSubmitting ? 'Saving...' : 'Save Customer'}
              </button>
            </div>
          </div>
        </div>
      ) : showSelectedCard ? (
        <div
          onClick={() => {
            setIsEditing(true)
            setIsOpen(true)
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
          style={{
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            overflow: 'hidden',
            background: bg,
            border: border,
            borderRadius: '10px',
            padding: '7px 11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = isDarkMode ? '#52525b' : '#94a3b8'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = isDarkMode ? '#2e323a' : '#cbd5e1'
          }}
        >
          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {/* 1. Customer Name (Bold) */}
            <div
              style={{
                fontSize: '1rem',
                fontWeight: '800',
                color: color,
                lineHeight: 1.25,
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {selectedCustomer.name}
            </div>


            {/* 3. Due / Payable Amount Breakdown */}
            {(() => {
              const { totalDue: selTotalDue, invoiceDue: selInvDue, jobOrderDue: selJoDue } = getBreakdown(selectedCustomer)
              return (
                <div style={{ marginTop: '3px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: '800',
                      color: isPayableMode && selTotalDue > 0 ? (isDarkMode ? '#60a5fa' : '#2563eb') : color,
                      lineHeight: 1.25,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>SAR {fmt(selTotalDue)} {isPayableMode ? 'payable' : 'total due'}</span>
                  </div>

                  {!isPayableMode && (selInvDue > 0 || selJoDue > 0) && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.74rem',
                      color: isDarkMode ? '#94a3b8' : '#64748b',
                      flexWrap: 'wrap',
                      marginTop: '2px'
                    }}>
                      <span style={{
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                        padding: '1.5px 7px',
                        borderRadius: '5px',
                        border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>Invoice Due:</span>
                        <strong style={{ color: selInvDue > 0 ? (isDarkMode ? '#e2e8f0' : '#0f172a') : 'inherit' }}>
                          SAR {fmt(selInvDue)}
                        </strong>
                      </span>

                      <span style={{
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                        padding: '1.5px 7px',
                        borderRadius: '5px',
                        border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>Job Order Due:</span>
                        <strong style={{ color: selJoDue > 0 ? (isDarkMode ? '#e2e8f0' : '#0f172a') : 'inherit' }}>
                          SAR {fmt(selJoDue)}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Right Action: Clear / Re-select button */}
          <button
            type="button"
            onClick={handleClear}
            tabIndex={-1}
            title="Clear customer selection"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: iconColor,
              borderRadius: '6px',
              transition: 'color 0.15s ease, background 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = color
              e.currentTarget.style.background = isDarkMode ? '#27272a' : '#f1f5f9'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = iconColor
              e.currentTarget.style.background = 'none'
            }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        /* Searchable Input Field */
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              setIsEditing(true)
              setIsOpen(true)
            }}
            
            required={required}
            autoFocus={autoFocus}
            autoComplete="off"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              height: '44px',
              background: bg,
              border: isOpen ? borderOpen : border,
              borderRadius: '10px',
              color,
              fontSize: '0.88rem',
              fontWeight: '500',
              padding: '0 36px 0 12px',
              outline: 'none',
              transition: 'border 0.15s ease',
            }}
          />
          {query ? (
            <button
              type="button"
              onClick={handleClear}
              tabIndex={-1}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                color: iconColor
              }}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          ) : (
            <ChevronDown
              size={14}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: `translateY(-50%) ${isOpen ? 'rotate(180deg)' : ''}`,
                transition: 'transform 0.15s ease',
                color: iconColor,
                pointerEvents: 'none'
              }}
            />
          )}
        </div>
      )}

      {/* Dropdown Results List */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            left: 0,
            right: 0,
            background: menuBg,
            border: menuBorder,
            borderRadius: '12px',
            boxShadow: menuShadow,
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1000,
            padding: '5px'
          }}
        >
          {/* Quick Add Option */}
          <div
            onMouseDown={(e) => {
              e.preventDefault()
              const draftName = query.trim()
              setQuickAddForm({ name: draftName, company_name: '' })
              setQuickAddError('')
              setIsCreatingNew(true)
              setIsOpen(false)
              setIsEditing(false)
              if (draftName) {
                onChange?.(draftName)
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#2563eb',
              fontWeight: '700',
              fontSize: '0.84rem',
              background: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff',
              border: isDarkMode ? '1px dashed #3b82f6' : '1px dashed #93c5fd',
              marginBottom: '5px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDarkMode ? '#2563eb' : '#dbeafe'
              e.currentTarget.style.color = isDarkMode ? '#ffffff' : '#1d4ed8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDarkMode ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff'
              e.currentTarget.style.color = '#2563eb'
            }}
          >
            <span>+ Create Customer</span>
          </div>

          {filtered.map((c) => {
            const isSel = c.name === query
            return (
              <div
                key={c.id}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(c)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: isSel ? rowSel : 'transparent',
                  transition: 'background 0.1s ease',
                  gap: '10px'
                }}
                onMouseEnter={(e) => {
                  if (!isSel) e.currentTarget.style.background = rowHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isSel ? rowSel : 'transparent'
                }}
              >
                <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {/* Customer Name & Company Name */}
                  <div
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: isSel ? '800' : '700',
                      color,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '6px'
                    }}
                  >
                    <span>{c.name}</span>
                    {(c.company_name || c.company) && (
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: '500',
                        color: isDarkMode ? '#94a3b8' : '#64748b'
                      }}>
                        ({c.company_name || c.company})
                      </span>
                    )}
                  </div>

                  {/* Due / Payable amount in same style */}
                  {(() => {
                    const { totalDue: itemTotalDue, invoiceDue: itemInvDue, jobOrderDue: itemJoDue } = getBreakdown(c)
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '1px' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: '700', color: isPayableMode && itemTotalDue > 0 ? (isDarkMode ? '#60a5fa' : '#2563eb') : color }}>
                          SAR {fmt(itemTotalDue)} {isPayableMode ? 'payable' : 'total due'}
                        </div>
                        {!isPayableMode && (itemInvDue > 0 || itemJoDue > 0) && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.69rem',
                            color: isDarkMode ? '#94a3b8' : '#64748b'
                          }}>
                            <span>Invoices: SAR {fmt(itemInvDue)}</span>
                            <span>•</span>
                            <span>Job Orders: SAR {fmt(itemJoDue)}</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {isSel && (
                  <Check
                    size={16}
                    strokeWidth={2.5}
                    color={isDarkMode ? '#ffffff' : '#0f172a'}
                  />
                )}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div
              style={{
                padding: '12px',
                fontSize: '0.82rem',
                color: subColor,
                textAlign: 'center'
              }}
            >
              No customer found {query.trim() ? `matching "${query}"` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CustomerCombobox
