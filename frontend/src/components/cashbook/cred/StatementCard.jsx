import React from 'react';
import Money from './Money';
import { ChevronRight } from 'lucide-react';

const StatementCard = ({
  title,
  subline,
  dateRange,
  amount,
  onClick = null,
  className = '',
  style = {}
}) => {
  return (
    <div
      className={`cred-statement-card ${className}`}
      onClick={onClick}
      style={{
        ...style,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div>
        <div className="cred-statement-title">{title}</div>
        {subline && <div className="cred-statement-sub">{subline}</div>}
        {dateRange && (
          <div className="cred-statement-sub" style={{ marginTop: '2px', fontSize: '11px' }}>
            {dateRange}
          </div>
        )}
      </div>

      <div className="cred-statement-amount">
        <Money value={amount} />
        {onClick && <ChevronRight size={16} strokeWidth={1.5} color="var(--text-muted)" />}
      </div>
    </div>
  );
};

export default StatementCard;
