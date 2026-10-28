import React from 'react';

/**
 * CredStatus
 * Shared primitive: renders a 6px dot + label in lowercase, 13px, ink color, 8px gap.
 * Tone: "danger" | "warning" | "success" | "ink" | "muted"
 */
const CredStatus = ({ tone = 'muted', label = '', className = '', style = {} }) => {
  const normalizedTone = ['danger', 'warning', 'success', 'ink', 'muted'].includes(tone)
    ? tone
    : 'muted';

  return (
    <span className={`cred-status cred-status--${normalizedTone} ${className}`} style={style}>
      <span className="cred-status__dot" />
      <span>{String(label || '').toLowerCase()}</span>
    </span>
  );
};

export default CredStatus;
