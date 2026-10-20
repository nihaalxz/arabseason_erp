import { useState, useRef, useEffect } from 'react'
import { Check, X } from '../icons'
import { ChevronDown } from 'lucide-react'
import api from '../../api'
import { showToast } from '../../utils/swal'

/**
 * VendorCombobox
 * Searchable dropdown that transforms into a vendor card view upon selection:
 * 1. Vendor Name (bold)
 * 2. Company / Subtitle (muted)
 * 3. SAR [amount] balance / payable
 */
const VendorCombobox = ({
  value = '',
  onChange,
  onSelectVendor,
  vendors = [],
  isDarkMode = false,
  required = false,
  autoFocus = false,
  onFillAmount,
  onVendorCreated,
  onCompanyChange,
  vendorCompanyName = '',
  compact = false,
  showPayable = true
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [query, setQuery] = useState(value)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // Inline Quick Add Vendor State (matches Customer inline fields design)
  const [localAddedVendors, setLocalAddedVendors] = useState([])
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [quickAddForm, setQuickAddForm] = useState({ name: '', company: '' })
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false)
  const [quickAddError, setQuickAddError] = useState('')

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

  const allVendors = [
    ...localAddedVendors.filter(lv => !vendors.some(v => v.id === lv.id)),
    ...vendors
  ]

  const selectedVendor = allVendors.find(
    (v) => (v.name || '').trim().toLowerCase() === (value || '').trim().toLowerCase()
  )

  const filtered = query.trim()
    ? allVendors.filter((v) => {
        const q = query.toLowerCase()
        return (
          v.name?.toLowerCase().includes(q) ||
          v.company?.toLowerCase().includes(q) ||
          v.phone?.toLowerCase().includes(q)
        )
      })
    : allVendors

  const handleInputChange = (e) => {
    const v = e.target.value
    setQuery(v)
    onChange(v)
    if (onSelectVendor) {
      const match = allVendors.find(ven => (ven.name || '').trim().toLowerCase() === v.trim().toLowerCase())
      onSelectVendor(match || null)
    }
    setIsOpen(true)
  }

  const handleSelect = (vendor) => {
    setQuery(vendor.name)
    onChange(vendor.name)
    if (onSelectVendor) {
      onSelectVendor(vendor)
    }
    setIsCreatingNew(false)
    setIsOpen(false)
    setIsEditing(false)
    inputRef.current?.blur()
  }

  const handleClear = (e) => {
    if (e) e.stopPropagation()
    setQuery('')
    onChange('')
    if (onSelectVendor) onSelectVendor(null)
    setIsCreatingNew(false)
    setIsEditing(true)
    setIsOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleQuickAddSubmit = async (e) => {
    if (e) {
      if (e.preventDefault) e.preventDefault()
      if (e.stopPropagation) e.stopPropagation()
    }
    const trimmedName = quickAddForm.name.trim()
    if (!trimmedName) {
      setQuickAddError('Vendor Name is required')
      return
    }

    try {
      setQuickAddSubmitting(true)
      setQuickAddError('')
      const payload = {
        name: trimmedName,
        company: quickAddForm.company.trim()
      }
      const res = await api.post('vendors/', payload)
      const newVen = res.data

      setLocalAddedVendors(prev => [newVen, ...prev])
      setIsCreatingNew(false)
      handleSelect(newVen)
      if (onVendorCreated) {
        onVendorCreated(newVen)
      }
      setQuickAddForm({ name: '', company: '' })
      showToast(`Vendor "${newVen.name}" added successfully!`, 'success')
    } catch (err) {
      console.error('Failed to quick add vendor:', err)
      const errorData = err.response?.data
      let msg = 'Failed to create vendor'
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

  const getDue = (v) =>
    Math.max(0, (parseFloat(v.total_billed) || 0) - (parseFloat(v.paid_amount) || 0))

  const fmt = (n) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  // Monochrome / slate palette matching Cashbook theme
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

  const showSelectedCard = selectedVendor && !isEditing && !isCreatingNew

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {isCreatingNew ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%' }}>
          {/* Top Selector Bar to switch back */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 12px',
              borderRadius: '8px',
              background: isDarkMode ? '#1a1c20' : '#f1f5f9',
              border: border
            }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--primary, #5B4BDB)' }}>
              + Create Vendor
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsCreatingNew(false)
                setQuickAddForm({ name: '', company: '' })
                setQuickAddError('')
                if (!selectedVendor) {
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
              Select existing vendor
            </button>
          </div>

          {/* Inline fields card exactly matching customer / job order fields */}
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
                  Vendor Name *
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
                  value={quickAddForm.company}
                  onChange={(e) => {
                    const val = e.target.value
                    setQuickAddForm(prev => ({ ...prev, company: val }))
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
                {quickAddSubmitting ? 'Saving...' : 'Save Vendor'}
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
            height: compact ? '42px' : 'auto',
            minHeight: '42px',
            boxSizing: 'border-box',
            background: bg,
            border: border,
            borderRadius: '10px',
            padding: compact ? '0 10px' : '11px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: compact ? '8px' : '12px',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = isDarkMode ? '#52525b' : '#94a3b8'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = isDarkMode ? '#2e323a' : '#cbd5e1'
          }}
        >
          {compact ? (
            <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  color: color,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {selectedVendor.name}
              </span>
              {selectedVendor.company && (
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: '500',
                    color: subColor,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  ({selectedVendor.company})
                </span>
              )}
              {showPayable && (
                <span
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: '700',
                    color: getDue(selectedVendor) > 0 ? (isDarkMode ? '#fb923c' : '#c2410c') : color,
                    whiteSpace: 'nowrap',
                    marginLeft: 'auto'
                  }}
                >
                  SAR {fmt(getDue(selectedVendor))} payable
                </span>
              )}
            </div>
          ) : (
            <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {/* 1. Vendor Name (Bold) */}
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
                {selectedVendor.name}
              </div>

              {/* Subtitle / Company if present */}
              {selectedVendor.company && (
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: '500',
                    color: subColor,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {selectedVendor.company}
                </div>
              )}

              {/* 3. Due / Payable Amount */}
              {showPayable && (
                <div
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: '700',
                    color: getDue(selectedVendor) > 0 ? (isDarkMode ? '#fb923c' : '#c2410c') : color,
                    lineHeight: 1.25,
                    marginTop: '2px'
                  }}
                >
                  SAR {fmt(getDue(selectedVendor))} payable
                </div>
              )}
            </div>
          )}

          {/* Right Actions: Fill Amount Button (if applicable) + Clear Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
            {showPayable && onFillAmount && getDue(selectedVendor) > 0 && (
              <button
                type="button"
                onClick={() => onFillAmount(getDue(selectedVendor))}
                style={{
                  background: isDarkMode ? '#27272a' : '#f1f5f9',
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                  border: isDarkMode ? '1px solid #3f3f46' : '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
                title="Fill full balance due"
              >
                Fill Due
              </button>
            )}
            <button
              type="button"
              onClick={handleClear}
              tabIndex={-1}
              title="Clear vendor selection"
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
      {isOpen && !isCreatingNew && (
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
            maxHeight: '280px',
            overflowY: 'auto',
            zIndex: 1000,
            padding: '5px'
          }}
        >
          {/* Create New Vendor Option */}
          <div
            onMouseDown={(e) => {
              e.preventDefault()
              setIsCreatingNew(true)
              setIsOpen(false)
              setIsEditing(false)
              setQuickAddForm({
                name: query.trim() || '',
                company: ''
              })
              setQuickAddError('')
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              background: isDarkMode ? '#1e2126' : '#f1f5f9',
              borderBottom: isDarkMode ? '1px solid #282a2e' : '1px solid #e2e8f0',
              marginBottom: '4px',
              color: 'var(--primary, #5B4BDB)',
              fontWeight: '700',
              fontSize: '0.84rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDarkMode ? '#27272a' : '#e2e8f0'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDarkMode ? '#1e2126' : '#f1f5f9'
            }}
          >
            + Create Vendor
          </div>

          {filtered.map((v) => {
            const due = getDue(v)
            const isSel = v.name === query
            return (
              <div
                key={v.id}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(v)
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
                  {/* Vendor Name */}
                  <div
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: isSel ? '800' : '700',
                      color,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {v.name}
                  </div>

                  {v.company && (
                    <div style={{ fontSize: '0.74rem', color: subColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.company}
                    </div>
                  )}

                  {showPayable && (
                    <div style={{ fontSize: '0.78rem', fontWeight: '700', color: due > 0 ? (isDarkMode ? '#fb923c' : '#c2410c') : color, marginTop: '1px' }}>
                      SAR {fmt(due)} payable
                    </div>
                  )}
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
              No vendor found {query.trim() ? `matching "${query}"` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VendorCombobox
