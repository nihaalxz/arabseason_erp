import React from 'react';
import { ArrowUpRight } from 'lucide-react';

/**
 * CredViewAll
 * Reusable CRED-style "view all" action.
 * Renders the lowercase text "view all" (13px 500, muted) followed by
 * a 28px circle with a 1px border containing ArrowUpRight (14px).
 * On hover / keyboard focus: circle fills with ink, arrow inverts and moves 1px up & right.
 */
const CredViewAll = ({
  onClick = () => {},
  label = 'view all',
  ariaLabel = '',
  className = '',
  style = {}
}) => {
  const accessibleLabel = ariaLabel || (typeof label === 'string' ? label : 'view all');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={accessibleLabel}
      className={`cred-view-all ${className}`}
      style={style}
    >
      <span className="cred-view-all__text">{label}</span>
      <span className="cred-view-all__circle" aria-hidden="true">
        <ArrowUpRight size={14} className="cred-view-all__arrow" />
      </span>
    </button>
  );
};

export default CredViewAll;
