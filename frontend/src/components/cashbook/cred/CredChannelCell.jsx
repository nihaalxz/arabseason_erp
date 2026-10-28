import React from 'react';
import { Landmark, Wallet } from 'lucide-react';

/**
 * CredChannelCell
 * Reusable payment channel cell matching Cash Ledger table.
 * Muted line icon (14px) + channel name in ink 12px weight 500.
 * Optional account line underneath. No chip, no border, no background.
 */
const CredChannelCell = ({
  channel = 'Cash',
  account = '',
  className = '',
  style = {}
}) => {
  const isBankChannel = Boolean(account || /bank|card|cheque|online|wire|pos/i.test(channel || ''));
  const ChannelIcon = isBankChannel ? Landmark : Wallet;
  const channelName = channel || (isBankChannel ? 'Bank Transfer' : 'Petty Cash');

  return (
    <div className={`cred-channel-cell ${className}`} style={{ minWidth: 0, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        <ChannelIcon size={14} style={{ color: 'var(--text-muted, #8C8C8C)', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: 'var(--text, #0A0A0A)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {channelName}
        </span>
      </div>
      {account && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', paddingLeft: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {account}
        </div>
      )}
    </div>
  );
};

export default CredChannelCell;
