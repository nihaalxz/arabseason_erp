import React from 'react';
import CredViewAll from './CredViewAll';

const SectionLabel = ({ 
  label, 
  count = null, 
  onViewAll = null, 
  viewAllText = 'view all',
  className = '',
  style = {}
}) => {
  return (
    <div className={`cred-section-label-bar ${className}`} style={style}>
      <h3 className="cred-section-label">
        {label} {count !== null && count !== undefined ? `(${count})` : ''}
      </h3>
      {onViewAll && (
        <CredViewAll
          onClick={onViewAll}
          label={viewAllText}
          ariaLabel={`${viewAllText} ${label}`}
        />
      )}
    </div>
  );
};

export default SectionLabel;
