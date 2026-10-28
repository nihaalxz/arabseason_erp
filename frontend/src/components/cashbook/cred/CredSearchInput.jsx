import React from 'react';
import { Search, X } from 'lucide-react';

/**
 * CredSearchInput (Task D)
 * Single shared search component. The container owns the rounded border,
 * while the inner input is unstyled and unbordered, completely preventing
 * the double-border focus bug.
 */
const CredSearchInput = ({
  value = '',
  onChange,
  onClear,
  placeholder = 'search customer, job or remark',
  className = '',
  style = {},
  compact = false,
  id,
  autoFocus = false,
  ariaLabel = 'Search'
}) => {
  const handleClear = (e) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    } else if (onChange) {
      // Create synthetic event or call directly
      onChange({ target: { value: '' } });
    }
  };

  const handleChange = (e) => {
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div 
      className={`cred-search ${compact ? 'cred-search-compact' : ''} ${className}`}
      style={style}
    >
      <span className="cred-search-icon" aria-hidden="true">
        <Search size={compact ? 13 : 14} strokeWidth={2} />
      </span>
      <input
        type="text"
        id={id}
        className="cred-search-input"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck="false"
      />
      {value && String(value).length > 0 && (
        <button
          type="button"
          className="cred-search-clear"
          onClick={handleClear}
          aria-label="Clear search"
          title="Clear search"
        >
          <X size={compact ? 13 : 14} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
};

export default CredSearchInput;
