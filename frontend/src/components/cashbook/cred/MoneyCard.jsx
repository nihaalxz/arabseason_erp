import React from 'react';
import Money from './Money';
import { ChevronRight } from 'lucide-react';

const MoneyCard = ({
  icon: Icon = null,
  label,
  value,
  variant = 'default', // 'default' | 'positive' | 'danger'
  caption = '',
  actionText = null,
  onClick = null,
  isActive = false,
  tag = null,
  className = '',
  style = {},
  isCount = false,
  iconBg = null,
  iconColor = null,
  iconContainerStyle = {}
}) => {
  const isInteractive = Boolean(onClick);

  return (
    <div 
      className={`cred-money-card ${isActive ? 'is-active' : ''} ${className}`} 
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-pressed={isInteractive ? isActive : undefined}
      onKeyDown={(e) => {
        if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(e);
        }
      }}
      onMouseDown={(e) => {
        if (e.detail > 1) {
          e.preventDefault();
        }
      }}
      style={{
        cursor: isInteractive ? 'pointer' : 'default',
        borderRadius: '20px',
        border: isActive 
          ? '2px solid var(--text, #0A0A0A)' 
          : 'var(--m-card-border, 1px solid var(--border, #E4E4E4))',
        boxSizing: 'border-box',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transition: 'border-color 0.15s ease, transform 0.1s ease',
        ...style
      }}
    >
      <div>
        <div className="cred-money-card-header">
          <div className="cred-money-card-label" style={{ marginBottom: 0 }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {tag && (
              <span style={{
                background: 'var(--tint-mint)',
                color: 'var(--positive)',
                fontSize: '10px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '999px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
              }}>
                {tag}
              </span>
            )}
            {Icon && (
              <div 
                className="cred-money-card-icon" 
                style={{ 
                  background: iconBg || 'var(--bg-panel, #f1f5f9)',
                  color: iconColor || 'var(--text)',
                  ...iconContainerStyle
                }}
              >
                <Icon size={16} strokeWidth={2.2} />
              </div>
            )}
          </div>
        </div>
        <div className={`cred-money-card-value ${variant}`}>
          {React.isValidElement(value) ? (
            value
          ) : isCount ? (
            <span className="cred-tnum">{value !== undefined && value !== null ? value : '—'}</span>
          ) : (
            <Money value={value} />
          )}
        </div>
      </div>
      {(caption || actionText) && (
        <div className="cred-money-card-caption">
          {caption && <span>{caption}</span>}
          {actionText && (
            <span style={{ 
              fontWeight: 600, 
              color: variant === 'positive' ? 'var(--positive)' : 'var(--text)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2
            }}>
              {actionText.replace(/&gt;|>+$/g, '').trim()} {onClick && <ChevronRight size={13} strokeWidth={1.5} />}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default MoneyCard;
