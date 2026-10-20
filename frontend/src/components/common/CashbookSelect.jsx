import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, X } from '../icons'

/**
 * CashbookSelect – Custom Fintech Dropdown
 * 
 * Supports:
 * - 'filter-pill': 52px mobile pill with 20px radius floating panel
 * - 'form-field': 56px modal/form pill with 20px radius floating panel
 * - 'desktop-toolbar': 38px compact 10px-radius desktop toolbar select
 * - 'sidebar-dark': 42px sleek dark 12px-radius sidebar month selector
 */
const CashbookSelect = ({
  value,
  onChange,
  options = [],
  labelPrefix = '',
  leadingIcon = null,
  ariaLabel = 'Select option',
  variant = 'filter-pill', // 'filter-pill' | 'form-field' | 'desktop-toolbar' | 'sidebar-dark' | 'modal-field'
  placeholder = 'Select...',
  style = {},
  triggerStyle = {},
  disabled = false,
  isDark = null,
  clearable = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Determine if dark mode is active
  const darkActive = isDark !== null
    ? Boolean(isDark)
    : (typeof document !== 'undefined' && (
        document.body.classList.contains('cb-dark-bw') ||
        document.documentElement.classList.contains('cb-dark-bw') ||
        document.body.dataset.theme === 'dark'
      ))

  // Normalize options to [{ id, label, icon, isHeader }]
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return { 
        id: opt.id !== undefined ? opt.id : opt.value, 
        label: opt.label || opt.name || String(opt.id),
        icon: opt.icon || null,
        isHeader: Boolean(opt.isHeader || opt.disabled)
      }
    }
    return { id: opt, label: String(opt), icon: null, isHeader: false }
  })

  const currentOption = normalizedOptions.find(opt => !opt.isHeader && String(opt.id) === String(value))
  const displayLabel = currentOption ? (labelPrefix ? `${labelPrefix}${currentOption.label}` : currentOption.label) : placeholder

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('touchstart', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [isOpen])

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleSelect = (optId) => {
    if (onChange) {
      onChange(optId)
    }
    setIsOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    if (onChange) {
      onChange('')
    }
    setIsOpen(false)
  }

  const isForm = variant === 'form-field'
  const isDesktopToolbar = variant === 'desktop-toolbar'
  const isSidebarDark = variant === 'sidebar-dark'
  const isModalField = variant === 'modal-field'

  // Smart upward dropdown detection when near bottom or inside compact modal
  const [openUpward, setOpenUpward] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setOpenUpward(false)
      return
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const windowHeight = window.innerHeight || (typeof document !== 'undefined' ? document.documentElement.clientHeight : 800)
      const spaceBelow = windowHeight - rect.bottom
      const spaceAbove = rect.top

      // Check distance within closest scroll container (.modal-body, .modal-container, etc.)
      const scrollParent = containerRef.current.closest('.modal-body') || containerRef.current.closest('.modal-container')
      let parentSpaceBelow = spaceBelow
      let parentSpaceAbove = spaceAbove

      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect()
        parentSpaceBelow = parentRect.bottom - rect.bottom
        parentSpaceAbove = rect.top - parentRect.top
      }

      // If available space below is less than 190px and space above has room, open upward so it doesn't overflow
      if (parentSpaceBelow < 190 && parentSpaceAbove > 100) {
        setOpenUpward(true)
      } else if (spaceBelow < 200 && spaceAbove > 120) {
        setOpenUpward(true)
      } else {
        setOpenUpward(false)
      }
    }
  }, [isOpen])

  // Dynamic styling variables based on variant and dark mode
  const triggerHeight = isDesktopToolbar ? '38px' : isSidebarDark ? '42px' : isModalField ? '42px' : isForm ? '56px' : '52px'
  const triggerRadius = isDesktopToolbar ? '10px' : isSidebarDark ? '12px' : isModalField ? '10px' : '999px'
  const triggerBg = isSidebarDark 
    ? '#1A2234' 
    : darkActive
      ? '#17191d'
      : isForm ? '#F6F8FD' : '#ffffff'
  const triggerBorder = isSidebarDark
    ? (isOpen ? '1.5px solid #1366D9' : '1.5px solid #232E42')
    : darkActive
      ? (isOpen ? '1.5px solid #ffffff' : '1px solid #282b32')
      : isModalField
        ? (isOpen ? '1.5px solid #000000' : '1px solid #e2e8f0')
        : isDesktopToolbar
          ? (isOpen ? '1.5px solid #1366D9' : '1px solid #E2E8F0')
          : (isOpen ? '2px solid #1366D9' : '1px solid #E3E8F4')
  const triggerColor = isSidebarDark ? '#ffffff' : darkActive ? '#ffffff' : '#0F1B3D'
  const triggerFontSize = isDesktopToolbar ? '13px' : isSidebarDark ? '13.5px' : isModalField ? '0.85rem' : '15px'
  const triggerFontWeight = isSidebarDark ? '700' : isModalField ? '500' : '600'
  const triggerPadding = isDesktopToolbar
    ? (leadingIcon ? '0 10px 0 8px' : '0 12px')
    : isSidebarDark
      ? (leadingIcon ? '0 12px 0 10px' : '0 14px')
      : isModalField
        ? (leadingIcon ? '0 10px 0 8px' : '0 10px')
        : (leadingIcon ? '0 18px 0 10px' : '0 18px 0 20px')

  const iconBoxSize = isDesktopToolbar ? '22px' : isSidebarDark ? '24px' : '32px'
  const iconBoxBg = isSidebarDark 
    ? 'rgba(255, 255, 255, 0.08)' 
    : darkActive
      ? 'rgba(19, 102, 217, 0.2)' 
      : '#E8EFFF'
  const iconBoxColor = isSidebarDark ? '#93C5FD' : darkActive ? '#60a5fa' : '#1366D9'

  const menuBg = isSidebarDark ? '#131B2E' : darkActive ? '#1c1e22' : '#ffffff'
  const menuBorder = isSidebarDark 
    ? '1px solid #28354E' 
    : darkActive 
      ? '1px solid #33363f' 
      : '1px solid #E2E8F0'
  const menuRadius = (isDesktopToolbar || isSidebarDark) ? '14px' : isModalField ? '10px' : '20px'
  const menuShadow = isSidebarDark
    ? '0 16px 36px rgba(0, 0, 0, 0.5)'
    : darkActive
      ? '0 16px 40px rgba(0, 0, 0, 0.9), 0 4px 14px rgba(0, 0, 0, 0.7)'
      : isDesktopToolbar
        ? '0 10px 25px rgba(15, 23, 42, 0.12)'
        : '0 16px 40px rgba(15, 23, 42, 0.14), 0 4px 12px rgba(15, 23, 42, 0.06)'
  const menuMinWidth = isDesktopToolbar ? '200px' : isSidebarDark ? '280px' : 'auto'

  const optionHeight = (isDesktopToolbar || isSidebarDark) ? '38px' : isModalField ? '34px' : '48px'
  const optionRadius = (isDesktopToolbar || isSidebarDark) ? '8px' : isModalField ? '7px' : '12px'
  const optionFontSize = (isDesktopToolbar || isSidebarDark) ? '13px' : isModalField ? '0.82rem' : '14.5px'
  const optionColor = isSidebarDark ? '#E2E8F0' : darkActive ? '#cbd5e1' : '#0F1B3D'
  const optionActiveBg = isSidebarDark ? '#1366D9' : darkActive ? '#262930' : '#f1f5f9'
  const optionActiveColor = isSidebarDark ? '#ffffff' : darkActive ? '#ffffff' : '#000000'
  const optionHoverBg = isSidebarDark ? '#1E2B4A' : darkActive ? '#23252a' : '#F6F8FD'

  return (
    <div
      ref={containerRef}
      className={`cb-custom-select-container ${isOpen ? 'is-open' : ''}`}
      style={{
        position: 'relative',
        width: isDesktopToolbar ? 'auto' : '100%',
        minWidth: 0,
        maxWidth: '100%',
        display: isDesktopToolbar ? 'inline-block' : 'block',
        zIndex: isOpen ? 1100 : 'auto',
        ...style
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="cb-custom-select-trigger"
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          height: triggerHeight,
          borderRadius: triggerRadius,
          border: triggerBorder,
          background: triggerBg,
          color: triggerColor,
          fontSize: triggerFontSize,
          fontWeight: triggerFontWeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: triggerPadding,
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxShadow: isOpen
            ? (isSidebarDark
              ? '0 0 0 3px rgba(19, 102, 217, 0.28)'
              : darkActive
                ? '0 0 0 2px rgba(255, 255, 255, 0.2)'
                : '0 0 0 2px rgba(0, 0, 0, 0.1)')
            : (isSidebarDark
              ? '0 2px 6px rgba(0, 0, 0, 0.25)'
              : '0 1px 3px rgba(15, 23, 42, 0.04)'),
          transition: 'all 150ms ease',
          opacity: disabled ? 0.6 : 1,
          boxSizing: 'border-box',
          overflow: 'hidden',
          ...triggerStyle
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: isDesktopToolbar ? '6px' : '10px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
          {(currentOption?.icon || leadingIcon) && (
            <div
              style={{
                width: iconBoxSize,
                height: iconBoxSize,
                borderRadius: isDesktopToolbar ? '6px' : '50%',
                background: iconBoxBg,
                color: iconBoxColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {currentOption?.icon || leadingIcon}
            </div>
          )}
          <span
            title={displayLabel}
            style={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: 1,
              textAlign: 'left',
              color: currentOption && currentOption.id !== '' ? triggerColor : (isSidebarDark || darkActive ? '#64748B' : '#97A3BD')
            }}
          >
            {displayLabel}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
          {clearable && value && value !== '' && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClear(e) }}
              title="Clear selection"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: darkActive ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                color: darkActive ? '#cbd5e1' : '#64748b',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
            >
              <X size={12} strokeWidth={2.5} />
            </span>
          )}

          <ChevronDown
            size={isDesktopToolbar ? 13 : isSidebarDark ? 14 : 16}
            style={{
              color: isOpen ? (isSidebarDark || darkActive ? '#93C5FD' : '#1366D9') : (isSidebarDark || darkActive ? '#94A3B8' : '#64708A'),
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 180ms ease, color 150ms ease',
              flexShrink: 0
            }}
          />
        </div>
      </button>

      {/* Floating Options Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="cb-custom-select-menu cb-animate-slide-up"
          style={{
            position: 'absolute',
            ...(openUpward ? {
              bottom: 'calc(100% + 4px)',
              top: 'auto',
              boxShadow: isSidebarDark
                ? '0 -16px 36px rgba(0, 0, 0, 0.5)'
                : darkActive
                  ? '0 -16px 40px rgba(0, 0, 0, 0.9), 0 -4px 14px rgba(0, 0, 0, 0.7)'
                  : '0 -12px 32px rgba(15, 23, 42, 0.14), 0 -4px 12px rgba(15, 23, 42, 0.06)'
            } : {
              top: 'calc(100% + 4px)',
              bottom: 'auto',
              boxShadow: menuShadow
            }),
            left: 0,
            minWidth: menuMinWidth,
            right: (isDesktopToolbar || isSidebarDark) ? 'auto' : 0,
            width: isModalField ? '100%' : 'auto',
            background: menuBg,
            borderRadius: menuRadius,
            border: menuBorder,
            padding: '4px',
            maxHeight: isModalField ? '180px' : '260px',
            overflowY: 'auto',
            zIndex: 1500,
            boxSizing: 'border-box'
          }}
        >
          {normalizedOptions.map((opt, idx) => {
            if (opt.isHeader) {
              return (
                <div
                  key={`hdr_${opt.label}_${idx}`}
                  style={{
                    padding: '8px 12px 4px 12px',
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: darkActive ? '#94a3b8' : '#64748b',
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }}
                >
                  {opt.label}
                </div>
              )
            }
            const isSelected = String(opt.id) === String(value)
            const itemText = labelPrefix ? `${labelPrefix}${opt.label}` : opt.label
            return (
              <div
                key={opt.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.id)}
                className="cb-custom-select-option"
                style={{
                  height: optionHeight,
                  minHeight: optionHeight,
                  borderRadius: optionRadius,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 12px',
                  background: isSelected ? optionActiveBg : 'transparent',
                  color: isSelected ? optionActiveColor : optionColor,
                  fontWeight: isSelected ? '700' : '500',
                  fontSize: optionFontSize,
                  cursor: 'pointer',
                  transition: 'background 120ms ease, color 120ms ease',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = optionHoverBg
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  {opt.icon && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, opacity: isSelected ? 1 : 0.8 }}>
                      {opt.icon}
                    </span>
                  )}
                  <span title={itemText} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {itemText}
                  </span>
                </div>
                {isSelected && (
                  <Check
                    size={isDesktopToolbar ? 14 : 16}
                    color={isSidebarDark ? '#ffffff' : darkActive ? '#ffffff' : '#0f172a'}
                    strokeWidth={2.5}
                    style={{ flexShrink: 0, marginLeft: '8px' }}
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

export default CashbookSelect
