import React from 'react';

const IconTile = ({
  icon: Icon,
  label,
  count = null,
  hasRedDot = false,
  tag = null,
  onClick,
  className = '',
  style = {}
}) => {
  return (
    <div 
      className={`cred-icon-tile-wrap ${className}`} 
      onClick={onClick}
      style={style}
    >
      <div className="cred-icon-tile">
        <Icon size={26} strokeWidth={1.5} />
        {count !== null && count !== undefined && count > 0 && (
          <div className="cred-tile-tag">{count}</div>
        )}
        {hasRedDot && (
          <div 
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--danger)',
              border: '1.5px solid var(--bg)'
            }} 
          />
        )}
        {tag && (
          <div className="cred-tile-tag">{tag}</div>
        )}
      </div>
      <span className="cred-icon-tile-label">{label}</span>
    </div>
  );
};

export default IconTile;
