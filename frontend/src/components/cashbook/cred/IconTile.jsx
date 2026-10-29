import React from 'react';

const IconTile = ({
  icon: Icon,
  label,
  count = null,
  hasRedDot = false,
  tag = null,
  size = 52,
  iconSize = 21,
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
      <div 
        className="cred-icon-tile"
        style={{
          width: `${size}px`,
          height: `${size}px`
        }}
      >
        <Icon size={iconSize} strokeWidth={1.6} />
        {count !== null && count !== undefined && count > 0 && (
          <div className="cred-tile-tag">{count}</div>
        )}
        {hasRedDot && (
          <div 
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '7px',
              height: '7px',
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
