import React from 'react';
import { AlertCircle, FolderOpen, RefreshCw } from 'lucide-react';
import CredButton from './CredButton';

export const EmptyState = ({
  icon: Icon = FolderOpen,
  title = 'No records found',
  description = 'There are no entries available for the selected view or period.',
  actionLabel = null,
  onAction = null,
  className = '',
  style = {}
}) => {
  return (
    <div
      className={`cred-empty-state ${className}`}
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        background: 'var(--bg-panel)',
        borderRadius: 'var(--radius-panel)',
        border: '1px solid var(--border)',
        margin: '22px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          marginBottom: 14,
        }}
      >
        <Icon size={24} strokeWidth={1.5} />
      </div>
      <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
        {title}
      </h4>
      <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)', maxWidth: '340px' }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <CredButton variant="primary" onClick={onAction}>
          {actionLabel}
        </CredButton>
      )}
    </div>
  );
};

export const LoadingSkeleton = ({ count = 3, type = 'card' }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '16px 0' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: type === 'card' ? 'var(--radius-card)' : '16px',
            height: type === 'card' ? '76px' : '52px',
            animation: 'credPulse 1.5s ease-in-out infinite',
            position: 'relative',
            overflow: 'hidden',
          }}
        />
      ))}
      <style>{`
        @keyframes credPulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};

export const ErrorState = ({
  message = 'Failed to load data. Please check your connection.',
  onRetry = null,
  className = '',
  style = {}
}) => {
  return (
    <div
      className={`cred-error-state ${className}`}
      style={{
        padding: '32px 20px',
        textAlign: 'center',
        background: 'var(--tint-pink)',
        border: '1px solid rgba(229, 72, 46, 0.2)',
        borderRadius: 'var(--radius-card)',
        margin: '20px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        ...style
      }}
    >
      <AlertCircle size={28} strokeWidth={1.5} color="var(--danger)" style={{ marginBottom: 10 }} />
      <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: 'var(--danger)', fontWeight: 600 }}>
        {message}
      </p>
      {onRetry && (
        <CredButton variant="pill-outlined" onClick={onRetry} icon={RefreshCw}>
          Retry
        </CredButton>
      )}
    </div>
  );
};
