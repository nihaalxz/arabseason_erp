import React from 'react';
import Money from './Money';
import { formatJobRef } from './usePagination';
import { 
  renderTextWithRefCode, 
  formatLedgerDate, 
  getEntryEntities 
} from './CredLedgerTable';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  Wallet, 
  Landmark, 
  Users, 
  Building2, 
  HardHat, 
  Briefcase, 
  Receipt,
  Coins
} from 'lucide-react';

/**
 * Single mobile transaction card (shared across Home & Dashboard)
 * Layout:
 * - Row 1 (Top Metadata): Date & Time (left) and Running Balance / Thumbnail (right, muted)
 * - Row 2 (Middle/Main Row): Avatar + Entity/Title name (left, Semibold) and Amount (right)
 * - Row 3 (Bottom Row): Dedicated Description Space (wrapping naturally, no truncation)
 */
export const CredMobileTxCard = ({
  item,
  isClickable = undefined,
  onOpenEntry = null,
  onSelect = null,
  onEdit = null,
  onClick = null,
  showBalance = false,
  onOpenImage = null
}) => {
  if (!item) return null;

  // Generic action handler support: interactive only if an action handler is passed and not explicitly disabled
  const actionHandler = onClick || onSelect || onEdit || onOpenEntry;
  const isInteractive = Boolean(actionHandler && isClickable !== false);

  const isCredit = item.entry_type === 'in' || item.type === 'in';
  const isDebit = item.entry_type === 'out' || item.type === 'out';

  const { date, time } = formatLedgerDate(item.date, item.time);
  const { isCust, isVend, isLabour, isJob, isExp } = getEntryEntities(item);

  // Particulars icon
  const EntityIcon = isCust ? Users : isVend ? Building2 : isLabour ? HardHat : isJob ? Briefcase : isExp ? Receipt : Coins;

  // Title / Entity Name
  const title = item.party_name || item.party || item.customer_name || item.vendor_name || item.remark || (isCredit ? 'Cash In' : isDebit ? 'Cash Out' : 'Transfer');
  const subtitle = item.remark || item.reference_number || item.category || 'Ledger transaction';

  // Relation / Entity lines
  const relationLines = [];
  if (item.customer_name || item.customer || isCust) {
    relationLines.push(`customer: ${item.customer_name || item.party_name || 'Client'}`);
  }
  if (item.job_order_title || item.job_order_number || item.job_order || isJob) {
    const jobNum = item.job_order_number ? formatJobRef(item.job_order_number) : '';
    relationLines.push(`job: ${jobNum ? `${jobNum} ` : ''}${item.job_order_title || ''}`);
  }
  if (item.vendor_name || item.vendor || isVend) {
    relationLines.push(`vendor: ${item.vendor_name || item.party_name || ''}`);
  }
  if (item.labour_name || item.staff_name || isLabour) {
    relationLines.push(`labour: ${item.labour_name || item.staff_name || ''}`);
  }

  // Mobile description / particulars text
  const descParts = [];
  if (relationLines.length > 0) {
    descParts.push(...relationLines);
  }
  if (item.remark && item.remark !== title && !relationLines.some(r => r.toLowerCase().includes(String(item.remark).toLowerCase()))) {
    descParts.push(item.remark);
  }
  if (item.reference_number && item.reference_number !== title && !descParts.some(d => d.includes(item.reference_number))) {
    descParts.push(`ref: ${formatJobRef(item.reference_number)}`);
  }
  if (item.category && item.category !== title && !descParts.some(d => d.toLowerCase().includes(String(item.category).toLowerCase()))) {
    descParts.push(item.category);
  }
  const descriptionText = descParts.length > 0 ? descParts.join('  ·  ') : (subtitle || item.category || '');

  // Thumbnail image
  const imgSrc = item.attachment || item.image || item.receipt_image || item.custom_fields?.attachment || item.custom_fields?.image || null;

  return (
    <div 
      className={`cred-ledger-table-row cred-mobile-tx-card ${isInteractive ? 'is-interactive' : 'is-inert'}`}
      onClick={isInteractive ? () => actionHandler(item) : undefined}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          actionHandler(item);
        }
      } : undefined}
      style={{
        cursor: isInteractive ? 'pointer' : 'default',
        userSelect: 'text',
        WebkitUserSelect: 'text',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div className="cred-table-mobile-card">
        {/* Row 1 (Top Metadata): Date & Time (left) and Running Balance / Thumb (right, muted) */}
        <div className="cred-mobile-card-top">
          <span className="cred-mobile-card-datetime">{date}{time ? `, ${time}` : ''}</span>
          <div className="cred-mobile-card-top-right">
            {imgSrc && (
              <img 
                src={imgSrc} 
                alt="attachment" 
                className="cred-mobile-card-thumb"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenImage) onOpenImage(imgSrc, item);
                  else window.open(imgSrc, '_blank');
                }}
              />
            )}
            {showBalance && item.display_running_balance !== undefined && item.display_running_balance !== null && (
              <span className="cred-mobile-card-balance">
                bal: <Money value={item.display_running_balance} />
              </span>
            )}
          </div>
        </div>

        {/* Row 2 (Middle/Main Row): Avatar + Entity/Title name (left, Semibold) and Amount (right) */}
        <div className="cred-mobile-card-main">
          <div className="cred-mobile-card-entity">
            <div className="cred-particulars-icon">
              <EntityIcon size={16} strokeWidth={1.7} />
              <div
                className="cred-direction-badge"
                style={{
                  background: isCredit ? '#19B25B' : isDebit ? '#E5482E' : '#8C8C8C',
                }}
              >
                {isCredit ? (
                  <ArrowDownLeft size={10} strokeWidth={2.5} />
                ) : isDebit ? (
                  <ArrowUpRight size={10} strokeWidth={2.5} />
                ) : (
                  <ArrowLeftRight size={9} strokeWidth={2.5} />
                )}
              </div>
            </div>

            <div className="cred-mobile-card-title">
              {title}
            </div>
          </div>

          <div 
            className="cred-mobile-card-amount"
            style={{
              color: isCredit ? 'var(--positive, #19B25B)' : isDebit ? 'var(--danger, #E5482E)' : 'var(--text, #0A0A0A)'
            }}
          >
            <span style={{ marginRight: '1px' }}>{isCredit ? '+' : isDebit ? '-' : ''}</span>
            <Money value={String(item.amount || '0.00').trim().replace(/^-/, '')} />
          </div>
        </div>

        {/* Row 3 (Bottom Row): Dedicated Description Space (wrapping naturally, no truncation) */}
        {descriptionText && (
          <div className="cred-mobile-card-bottom">
            {renderTextWithRefCode(descriptionText)}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Shared Mobile Transaction Card List Component
 * Used on both the Cash Ledger (Home) and the Dashboard (Overview).
 * Displays transaction cards directly on the page background with 12px gap.
 */
const CredMobileTxList = ({
  entries = [],
  isClickable = undefined,
  onOpenEntry = null,
  onSelect = null,
  onEdit = null,
  onClick = null,
  showBalance = false,
  isLoading = false,
  emptyMessage = 'no entries found',
  onClearFilters = null,
  isAnyFilterActive = false,
  onOpenImage = null,
  className = '',
  style = {}
}) => {
  if (isLoading) {
    return (
      <div className={`cred-ledger-table-wrap cred-mobile-tx-list ${className}`} style={style}>
        {[1, 2, 3, 4, 5].map((n) => (
          <div 
            key={n} 
            className="cred-ledger-table-row cred-mobile-tx-card is-inert"
            style={{ 
              height: '84px', 
              animation: 'pulse 1.5s infinite ease-in-out' 
            }} 
          />
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div 
        className={`cred-ledger-table-wrap cred-mobile-tx-list ${className}`}
        style={{
          padding: '48px 20px',
          textAlign: 'center',
          background: 'var(--bg-panel, #F7F7F7)',
          borderRadius: '20px',
          ...style
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
          {emptyMessage}
        </div>
        {isAnyFilterActive && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            style={{
              marginTop: '12px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-muted, #8C8C8C)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            clear all filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`cred-ledger-table-wrap cred-mobile-tx-list ${className}`} style={style}>
      {entries.map((item) => (
        <CredMobileTxCard
          key={item.id}
          item={item}
          isClickable={isClickable}
          onOpenEntry={onOpenEntry}
          onSelect={onSelect}
          onEdit={onEdit}
          onClick={onClick}
          showBalance={showBalance}
          onOpenImage={onOpenImage}
        />
      ))}
    </div>
  );
};

export default CredMobileTxList;
