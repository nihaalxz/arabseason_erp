import React from 'react';

const SegmentedToggle = ({
  options = [], // [{ id, label, count }]
  selectedId,
  onChange,
  className = '',
  style = {}
}) => {
  return (
    <div className={`cred-segmented-toggle ${className}`} style={style} role="tablist">
      {options.map((opt) => {
        const isSelected = selectedId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange && onChange(opt.id)}
            className={`cred-toggle-option ${isSelected ? 'selected' : ''}`}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && opt.count !== null && (
              <span 
                style={{
                  background: isSelected ? 'var(--black)' : 'var(--border)',
                  color: isSelected ? '#FFFFFF' : 'var(--text)',
                  fontSize: '9.5px',
                  fontWeight: '700',
                  padding: '1px 5px',
                  borderRadius: '999px',
                }}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedToggle;
