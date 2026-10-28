import React from 'react';

/**
 * CredRowIconButton
 * 32px row icon button with no border, no background, icon color muted at rest.
 * Hover / focus-visible: background var(--fill-ghost-hover) and icon ink.
 * Delete / danger tone turns var(--dot-danger) only on hover.
 */
const CredRowIconButton = ({
  children,
  onClick = () => {},
  title = '',
  ariaLabel = '',
  tone = 'default', // 'default' | 'danger'
  className = '',
  style = {},
  disabled = false
}) => {
  const isDanger = tone === 'danger';
  const label = ariaLabel || title || (isDanger ? 'delete' : 'action');

  return (
    <button
      type="button"
      onClick={onClick}
      title={title || label}
      aria-label={label}
      disabled={disabled}
      className={`cred-row-icon-btn ${isDanger ? 'cred-row-icon-btn--danger' : ''} ${className}`}
      style={style}
    >
      {children}
    </button>
  );
};

export default CredRowIconButton;
