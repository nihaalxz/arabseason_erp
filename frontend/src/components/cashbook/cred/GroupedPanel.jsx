import React from 'react';
import { ChevronRight } from 'lucide-react';

const GroupedPanel = ({
  items = [], // [{ icon: Icon, label, value, onClick }]
  className = '',
  style = {}
}) => {
  return (
    <div className={`cred-grouped-panel ${className}`} style={style}>
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className="cred-grouped-row"
            onClick={item.onClick}
            role={item.onClick ? 'button' : undefined}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {Icon && <Icon size={18} strokeWidth={1.5} color="var(--text)" />}
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>
                {item.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {item.value && (
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {item.value}
                </span>
              )}
              {item.onClick && <ChevronRight size={15} strokeWidth={1.5} color="var(--text-muted)" />}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GroupedPanel;
