import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

/**
 * CredDropdownSelect
 * Standard CRED-styled dropdown popover.
 * - Trigger: 40px outlined pill, leading icon of selected option, rotating chevron.
 * - Popover: 20px radius card, 1px border, soft shadow, min-width 280px, aligned to trigger left, 8px padding.
 * - Rows: 48px high, 12px radius.
 * - Selected row: #F2F2F2 (dark #1E1E1E), 36px icon tile filled #0A0A0A with white icon, check mark on right.
 * - Supports searchable popover with instant real-time filtering.
 * - Supports clearable trigger with instant reset.
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
  isDarkMode = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  clearable = false,
  placeholder = 'Select option',
  labelPrefix = '',
  popoverWidth = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Normalize options
  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'object' && opt !== null) {
        return {
          id: opt.id !== undefined ? opt.id : opt.value,
          label: opt.label || opt.name || String(opt.id),
          sub: opt.sub || null,
          icon: opt.icon || null,
          avatarText: opt.avatarText || null,
          count: opt.count !== undefined ? opt.count : null
        };
      }
      return { id: opt, label: String(opt), sub: null, icon: null, avatarText: null, count: null };
    });
  }, [options]);

  const selectedOption = normalizedOptions.find(o => String(o.id) === String(value)) || (value === 'all' || !value ? normalizedOptions[0] : null);
  const SelectedIcon = selectedOption?.icon;
  const isSelectedNonDefault = Boolean(value && value !== 'all' && selectedOption && selectedOption.id !== 'all');

  // Filtered options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return normalizedOptions;
    const term = searchTerm.toLowerCase().trim();
    return normalizedOptions.filter(opt => {
      const labelMatch = (opt.label || '').toLowerCase().includes(term);
      const subMatch = (opt.sub || '').toLowerCase().includes(term);
      return labelMatch || subMatch;
    });
  }, [normalizedOptions, searchable, searchTerm]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen && searchable) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchTerm('');
    }
  }, [isOpen, searchable]);

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
        const idx = filteredOptions.findIndex(o => String(o.id) === String(value));
        setFocusedIndex(idx >= 0 ? idx : 0);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev + 1) % (filteredOptions.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev - 1 + filteredOptions.length) % (filteredOptions.length || 1));
    } else if (e.key === 'Enter' && !searchTerm) {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
        onChange(filteredOptions[focusedIndex].id);
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

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange('all');
    }
    setIsOpen(false);
  };

  const displayLabel = selectedOption 
    ? (labelPrefix ? `${labelPrefix}: ${selectedOption.label}` : selectedOption.label)
    : placeholder;

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
          const idx = filteredOptions.findIndex(o => String(o.id) === String(value));
          setFocusedIndex(idx >= 0 ? idx : 0);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className="cred-popover-trigger"
        style={{
          height: '40px',
          padding: '0 14px',
          borderRadius: '999px',
          border: isSelectedNonDefault ? '1.5px solid var(--accent, #3b82f6)' : '1px solid var(--border, #E4E4E4)',
          background: isSelectedNonDefault ? (isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff') : 'var(--bg-panel, #FFFFFF)',
          color: isSelectedNonDefault ? (isDarkMode ? '#93c5fd' : '#1d4ed8') : 'var(--text, #0A0A0A)',
          fontSize: '13px',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s ease',
          outline: 'none',
          boxSizing: 'border-box',
          ...triggerStyle
        }}
        onMouseEnter={(e) => { 
          if (!isSelectedNonDefault) e.currentTarget.style.borderColor = 'var(--text, #0A0A0A)'; 
        }}
        onMouseLeave={(e) => { 
          if (!isSelectedNonDefault) e.currentTarget.style.borderColor = 'var(--border, #E4E4E4)'; 
        }}
      >
        {selectedOption?.avatarText ? (
          <span style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: isDarkMode ? '#2A2A2A' : '#EAEAEA',
            color: 'var(--text, #0A0A0A)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
            flexShrink: 0
          }}>
            {selectedOption.avatarText}
          </span>
        ) : SelectedIcon ? (
          <span style={{ display: 'flex', alignItems: 'center', color: 'inherit', flexShrink: 0 }}>
            <SelectedIcon size={14} strokeWidth={2} />
          </span>
        ) : null}

        <span style={{ 
          maxWidth: '180px', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap' 
        }}>
          {displayLabel}
        </span>

        {clearable && isSelectedNonDefault ? (
          <span
            role="button"
            title="Clear customer filter"
            onClick={handleClear}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              borderRadius: '50%',
              background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
              color: 'inherit',
              marginLeft: '2px',
              cursor: 'pointer'
            }}
          >
            <X size={12} strokeWidth={2.5} />
          </span>
        ) : (
          <ChevronDown 
            size={14} 
            style={{ 
              opacity: 0.6, 
              transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              flexShrink: 0
            }} 
          />
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div 
          className="cred-dropdown-popover"
          role="listbox"
          aria-label={ariaLabel}
          style={{
            maxHeight: '340px',
            overflowY: 'auto',
            width: popoverWidth || undefined,
            minWidth: '280px',
            zIndex: 1000
          }}
        >
          {searchable && (
            <div 
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                padding: '4px 4px 8px 4px',
                background: isDarkMode ? '#141414' : '#FFFFFF',
                borderBottom: isDarkMode ? '1px solid #2A2A2A' : '1px solid var(--border, #E4E4E4)',
                marginBottom: '4px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ position: 'relative', width: '100%' }}>
                <Search 
                  size={14} 
                  style={{ 
                    position: 'absolute', 
                    left: '10px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: 'var(--text-muted, #8C8C8C)',
                    pointerEvents: 'none'
                  }} 
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 28px 0 32px',
                    borderRadius: '10px',
                    border: isDarkMode ? '1px solid #333' : '1px solid var(--border, #E4E4E4)',
                    background: isDarkMode ? '#1A1A1A' : '#F9F9F9',
                    color: 'var(--text, #0A0A0A)',
                    fontSize: '12px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    style={{ 
                      position: 'absolute', 
                      right: '8px', 
                      top: '50%', 
                      transform: 'translateY(-50%)', 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--text-muted, #8C8C8C)', 
                      cursor: 'pointer', 
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {filteredOptions.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>
              No customers found
            </div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = String(opt.id) === String(value);
              const isFocused = focusedIndex === idx;
              const Icon = opt.icon;
              const avatar = opt.avatarText;

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
                  {/* Left side: 36px icon tile / avatar + Label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div 
                      className="cred-dropdown-icon-tile"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '13px',
                        flexShrink: 0
                      }}
                    >
                      {avatar ? (
                        <span>{avatar}</span>
                      ) : Icon ? (
                        <Icon size={16} strokeWidth={2} />
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {opt.label}
                      </span>
                      {opt.sub && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '1px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
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
            })
          )}
        </div>
      )}
    </div>
  );
};

export default CredDropdownSelect;
