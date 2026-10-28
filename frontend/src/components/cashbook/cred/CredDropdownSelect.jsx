import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * CredDropdownSelect (Task 1)
 * Standard CRED-styled dropdown popover.
 * - Trigger: 40px outlined pill, leading icon of selected option, lowercase label, rotating chevron.
 * - Popover: 20px radius card, 1px border, soft shadow, min-width 280px, aligned to trigger left, 8px padding.
 * - Rows: 48px high, 12px radius.
 * - Selected row: #F2F2F2 (dark #1E1E1E), 36px icon tile filled #0A0A0A with white icon (dark: white with black icon), check mark on right.
 * - Keyboard: ArrowDown, ArrowUp, Enter, Escape.
 */
const CredDropdownSelect = ({
  value,
  onChange,
  options = [],
  id = 'cred-dropdown',
  ariaLabel = 'Select option',
  className = '',
  style = {},
  triggerStyle = {},
  isDarkMode = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);

  // Normalize options
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        id: opt.id !== undefined ? opt.id : opt.value,
        label: opt.label || opt.name || String(opt.id),
        sub: opt.sub || null,
        icon: opt.icon || null,
        count: opt.count !== undefined ? opt.count : null
      };
    }
    return { id: opt, label: String(opt), sub: null, icon: null, count: null };
  });

  const selectedOption = normalizedOptions.find(o => String(o.id) === String(value)) || normalizedOptions[0];
  const SelectedIcon = selectedOption?.icon;

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        const idx = normalizedOptions.findIndex(o => String(o.id) === String(value));
        setFocusedIndex(idx >= 0 ? idx : 0);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev + 1) % normalizedOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev - 1 + normalizedOptions.length) % normalizedOptions.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < normalizedOptions.length) {
        onChange(normalizedOptions[focusedIndex].id);
        setIsOpen(false);
      }
    }
  };

  const handleSelect = (optId) => {
    if (onChange) {
      onChange(optId);
    }
    setIsOpen(false);
  };

  return (
    <div 
      ref={containerRef} 
      className={`cred-dropdown-container ${className}`} 
      style={{ position: 'relative', display: 'inline-block', ...style }}
      onKeyDown={handleKeyDown}
    >
      {/* 40px high Outlined Pill Trigger */}
      <button
        type="button"
        id={id}
        onClick={() => {
          setIsOpen(prev => !prev);
          const idx = normalizedOptions.findIndex(o => String(o.id) === String(value));
          setFocusedIndex(idx >= 0 ? idx : 0);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className="cred-popover-trigger"
        style={{
          height: '40px',
          padding: '0 16px',
          borderRadius: '999px',
          border: '1px solid var(--border, #E4E4E4)',
          background: 'var(--bg-panel, #FFFFFF)',
          color: 'var(--text, #0A0A0A)',
          fontSize: '13px',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'border-color 0.15s ease',
          outline: 'none',
          ...triggerStyle
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text, #0A0A0A)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border, #E4E4E4)'; }}
      >
        {SelectedIcon && (
          <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text, #0A0A0A)' }}>
            <SelectedIcon size={14} strokeWidth={2} />
          </span>
        )}
        <span style={{ textTransform: 'lowercase' }}>{selectedOption?.label}</span>
        <ChevronDown 
          size={14} 
          style={{ 
            opacity: 0.6, 
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }} 
        />
      </button>

      {/* Popover Card (Task 1) */}
      {isOpen && (
        <div 
          className="cred-dropdown-popover"
          role="listbox"
          aria-label={ariaLabel}
        >
          {normalizedOptions.map((opt, idx) => {
            const isSelected = String(opt.id) === String(value);
            const isFocused = focusedIndex === idx;
            const Icon = opt.icon;

            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.id)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={`cred-dropdown-row ${isSelected ? 'is-selected' : ''}`}
                style={{
                  background: isFocused && !isSelected ? (isDarkMode ? '#191919' : '#F7F7F7') : undefined
                }}
              >
                {/* Left side: 36px icon tile + Label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div className="cred-dropdown-icon-tile">
                    {Icon ? <Icon size={16} strokeWidth={2} /> : null}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                      {opt.label}
                    </span>
                    {opt.sub && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '1px' }}>
                        {opt.sub}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: Check mark on selected row */}
                {isSelected && (
                  <Check size={16} strokeWidth={2.4} style={{ color: 'var(--text, #0A0A0A)', flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CredDropdownSelect;
