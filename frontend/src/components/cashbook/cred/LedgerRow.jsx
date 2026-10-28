import React from 'react';
import Money from './Money';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  Landmark, 
  Wallet,
  Receipt
} from 'lucide-react';

const LedgerRow = ({
  icon: CustomIcon = null,
  entryType = 'in', // 'in' | 'out' | 'transfer'
  title,
  subtitle,
  amount,
  date,
  caption = null,
  onClick = null,
  className = '',
  style = {}
}) => {
  // Select icon if not provided
  let Icon = CustomIcon;
  if (!Icon) {
    if (entryType === 'transfer') Icon = ArrowLeftRight;
    else if (subtitle?.toLowerCase().includes('bank')) Icon = Landmark;
    else if (subtitle?.toLowerCase().includes('petty') || subtitle?.toLowerCase().includes('cash')) Icon = Wallet;
    else Icon = Receipt;
  }

  const defaultCaption = entryType === 'in'
    ? `CASH IN · ${date || 'TODAY'}`
    : entryType === 'out'
    ? `CASH OUT · ${date || 'TODAY'}`
    : 'TRANSFER · NOT COUNTED';

  const finalCaption = caption || defaultCaption;

  return (
    <div 
      className={`cred-ledger-row ${className}`} 
      onClick={onClick}
      style={{
        ...style,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div className="cred-ledger-row-left">
        <div className="cred-ledger-icon-wrap">
          <Icon size={20} strokeWidth={1.5} />
          {entryType === 'in' && (
            <div className="cred-ledger-arrow-badge in" title="Cash In">
              <ArrowDownLeft size={11} strokeWidth={2.5} />
            </div>
          )}
          {entryType === 'out' && (
            <div className="cred-ledger-arrow-badge out" title="Cash Out">
              <ArrowUpRight size={11} strokeWidth={2.5} />
            </div>
          )}
          {entryType === 'transfer' && (
            <div className="cred-ledger-arrow-badge transfer" title="Transfer">
              <ArrowLeftRight size={10} strokeWidth={2.5} />
            </div>
          )}
        </div>
        <div className="cred-ledger-info">
          <div className="cred-ledger-title">{title}</div>
          <div className="cred-ledger-subtitle">{subtitle}</div>
        </div>
      </div>

      <div className="cred-ledger-row-right">
        <div className="cred-amount-pill-btn">
          <span 
            className={`cred-amount-dot ${entryType === 'in' ? 'green' : 'red'}`} 
          />
          <Money value={amount} />
        </div>
        <span 
          className={`cred-ledger-caption-sub ${entryType === 'in' ? 'in' : 'transfer'}`}
        >
          {finalCaption}
        </span>
      </div>
    </div>
  );
};

export default LedgerRow;
