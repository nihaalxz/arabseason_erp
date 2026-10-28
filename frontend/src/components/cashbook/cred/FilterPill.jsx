import React from 'react';
import { ChevronDown } from 'lucide-react';

const FilterPill = ({
  label,
  value = null,
  icon: Icon = null,
  active = false,
  showChevron = true,
  onClick,
  className = '',
  style = {},
  ...rest
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cred-filter-pill ${active ? 'active' : ''} ${className}`}
      style={style}
      {...rest}
    >
      {Icon && <Icon size={14} strokeWidth={1.5} />}
      <span>{label}{value ? `: ${value}` : ''}</span>
      {showChevron && <ChevronDown size={13} strokeWidth={1.5} />}
    </button>
  );
};

export default FilterPill;
