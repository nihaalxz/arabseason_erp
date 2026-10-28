import React from 'react';
import { ChevronRight } from 'lucide-react';

const DividerChip = ({
  label,
  onClick = null,
  showChevron = true,
  className = '',
  style = {}
}) => {
  return (
    <div className={`cred-divider-chip-wrap ${className}`} style={style}>
      <div className="cred-divider-chip-line" />
      <button
        type="button"
        onClick={onClick}
        className="cred-divider-chip-pill"
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        <span>{label}</span>
        {showChevron && <ChevronRight size={13} strokeWidth={1.5} />}
      </button>
    </div>
  );
};

export default DividerChip;
