import React from 'react';
import { X, Landmark } from 'lucide-react';
import CredButton from './CredButton';

const Snackbar = ({
  icon: Icon = Landmark,
  message,
  actionText = 'reconnect',
  onAction = null,
  onClose = null,
  statusBadgeColor = 'var(--danger)',
  className = '',
  style = {}
}) => {
  return (
    <div className={`cred-snackbar ${className}`} style={style} role="status">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
        <div style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} strokeWidth={1.5} color="var(--text)" />
          {statusBadgeColor && (
            <span
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: statusBadgeColor,
                border: '1.5px solid var(--bg)',
              }}
            />
          )}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', textTransform: 'lowercase', lineHeight: 1.3 }}>
          {message}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {actionText && onAction && (
          <CredButton variant="primary" onClick={onAction} style={{ padding: '6px 14px', fontSize: '12px' }}>
            {actionText}
          </CredButton>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Snackbar;
