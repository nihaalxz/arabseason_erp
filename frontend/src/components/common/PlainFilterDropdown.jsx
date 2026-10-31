import React, { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, Check } from 'lucide-react'

/**
 * PlainFilterDropdown
 * Minimal shared page-level filter dropdown for ERP & Accounting.
 * - Trigger: white/surface background, 1px border token, 10px radius, 38px height,
 *   normal text weight, ink color, small muted chevron on the right. Auto width with sensible min-width.
 * - Open panel: simple bordered white card, 12px radius, light shadow, quick 120ms fade,
 *   check mark on right for selected option, hidden scrollbar (up to 280px scrollable).
 * - Keyboard navigation (Arrows, Enter, Escape, Space).
 * - Full dark mode support.
 */
export default function PlainFilterDropdown({
  options = [],
  value,
  onChange,
  onSelect,
  placeholder = 'Select option',
  ariaLabel,
  minWidth = 105,
  align = 'left',
  id,
  className = '',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const generatedId = useId()
  const dropdownId = id || `plain-dropdown-${generatedId}`

  // Normalize options: handles { value, label } or primitive strings/numbers
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      const val = opt.value !== undefined ? opt.value : opt.id
      return {
        value: val,
        label: opt.label || opt.name || String(val)
      }
    }
    return { value: opt, label: String(opt) }
  })

  // Find selected option
  const selectedOption = normalizedOptions.find(
    (o) => String(o.value) === String(value)
  ) || normalizedOptions[0]

  const displayLabel = selectedOption?.label || placeholder

  const handleSelectOption = (opt) => {
    setIsOpen(false)
    if (onChange) onChange(opt.value, opt)
    if (onSelect) onSelect(opt)
    triggerRef.current?.focus()
  }

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex]
      if (item && item.scrollIntoView) {
        item.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, isOpen])

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
        const idx = normalizedOptions.findIndex((o) => String(o.value) === String(value))
        setHighlightedIndex(idx >= 0 ? idx : 0)
      }
      return
    }

    if (e.key === 'Escape' || e.key === 'Tab') {
      setIsOpen(false)
      if (e.key === 'Escape') triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev + 1) % normalizedOptions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev - 1 + normalizedOptions.length) % normalizedOptions.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < normalizedOptions.length) {
        handleSelectOption(normalizedOptions[highlightedIndex])
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={`plain-filter-dropdown-container ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        ...style
      }}
    >
      <button
        ref={triggerRef}
        id={dropdownId}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel || displayLabel}
        onClick={() => {
          setIsOpen((prev) => !prev)
          const idx = normalizedOptions.findIndex((o) => String(o.value) === String(value))
          setHighlightedIndex(idx >= 0 ? idx : 0)
        }}
        onKeyDown={handleKeyDown}
        className="plain-filter-dropdown-trigger"
        style={{
          height: '38px',
          padding: '0 12px',
          background: 'var(--card-bg, #FFFFFF)',
          border: '1px solid var(--border, #E4E4E4)',
          borderRadius: '10px',
          color: 'var(--text, #111111)',
          fontSize: '13px',
          fontWeight: 400,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          cursor: 'pointer',
          width: 'auto',
          minWidth: minWidth ? `${minWidth}px` : '105px',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          boxSizing: 'border-box',
          outline: 'none',
          transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease'
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {displayLabel}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.8}
          style={{
            color: 'var(--text-muted, #8C8C8C)',
            transition: 'transform 0.15s ease',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            flexShrink: 0
          }}
        />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          className="plain-filter-dropdown-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            [align === 'right' ? 'right' : 'left']: 0,
            minWidth: '100%',
            maxWidth: '280px',
            maxHeight: '280px',
            overflowY: 'auto',
            background: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '12px',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
            padding: '4px',
            zIndex: 1000,
            boxSizing: 'border-box',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {normalizedOptions.map((opt, idx) => {
            const isSelected = String(opt.value) === String(value)
            const isHighlighted = idx === highlightedIndex

            return (
              <div
                key={`${opt.value}-${idx}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelectOption(opt)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`plain-filter-dropdown-row ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: isSelected ? 500 : 400,
                  color: 'var(--text, #111111)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: isHighlighted || isSelected ? 'var(--fill-ghost-hover, #F4F4F4)' : 'transparent',
                  transition: 'background-color 0.1s ease'
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}
                  title={opt.label}
                >
                  {opt.label}
                </span>
                {isSelected && (
                  <Check
                    size={14}
                    strokeWidth={2}
                    style={{
                      color: 'var(--text, #0A0A0A)',
                      flexShrink: 0,
                      marginLeft: '6px'
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

