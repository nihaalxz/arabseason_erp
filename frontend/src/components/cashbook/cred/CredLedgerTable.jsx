import React from 'react';
import Money from './Money';
import { formatJobRef } from './usePagination';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  RotateCcw, 
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
 * Wraps any #ID or reference in Geist Mono with preserved case
 */
export const renderTextWithRefCode = (text) => {
  if (!text || typeof text !== 'string') return text;
  const parts = text.split(/(#[A-Za-z0-9_-]+)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      return (
        <span 
          key={i} 
          className="cred-ref-code" 
          style={{ 
            fontFamily: 'var(--font-mono, "Geist Mono", monospace)', 
            textTransform: 'none',
            letterSpacing: '-0.01em'
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
};

// Helper for date formatting
export const formatLedgerDate = (dateStr, timeStr) => {
  if (!dateStr) return { date: '—', time: '' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: dateStr, time: timeStr || '' };
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const formattedDate = `${day} ${month} ${year}`;
    
    let formattedTime = timeStr || '';
    if (formattedTime && formattedTime.includes(':')) {
      const parts = formattedTime.split(':');
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      formattedTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }
    return { date: formattedDate, time: formattedTime };
  } catch (e) {
    return { date: dateStr, time: timeStr || '' };
  }
};

// Helper for entity classification
export const getEntryEntities = (e) => {
  if (!e) return { isCust: false, isVend: false, isLabour: false, isJob: false, isExp: false, primaryEntity: 'Other' };
  
  const isCust = Boolean(
    e.customer || e.customer_name || e.customer_payment ||
    e.debit_type === 'CUSTOMER' ||
    (e.category && (e.category.toLowerCase().includes('customer') || e.category.toLowerCase() === 'sales'))
  );
  const isVend = Boolean(
    e.vendor || e.vendor_name || e.vendor_payment ||
    e.debit_type === 'VENDOR'
  );
  const isLabour = Boolean(
    e.labour || e.labour_name || e.salary_payment || e.staff_user || e.staff_name ||
    e.debit_type === 'LABOUR' || e.debit_type === 'SALARY' ||
    /labour|labor|wage|salary|overtime|worker/i.test(e.category || '')
  );
  const isJob = Boolean(
    e.job_order || e.pending_job_order || e.job_order_title || e.job_order_number
  );
  const isExp = Boolean(
    e.expense || e.debit_type === 'Company Expense' ||
    /expense|food|petrol|fuel|rent|office|supplies|maintenance|utility|software|materials/i.test(e.category || '')
  );

  let primaryEntity = 'General';
  if (isCust) primaryEntity = 'Customer';
  else if (isVend) primaryEntity = 'Vendor';
  else if (isLabour) primaryEntity = 'Labour';
  else if (isJob) primaryEntity = 'Job Order';
  else if (isExp) primaryEntity = 'Expense';

  return { isCust, isVend, isLabour, isJob, isExp, primaryEntity };
};

/**
 * Shared CRED Ledger Table Component
 * Reused on both Cash Ledger (8 columns, clickable) and Dashboard (5 columns, display-only)
 */
const CredLedgerTable = ({
  entries = [],
  columns = ['date', 'particulars', 'relation', 'channel', 'category', 'flow', 'amount', 'balance'],
  isClickable = true,
  onOpenEntry = () => {},
  isLoading = false,
  emptyMessage = 'no entries match these filters',
  onClearFilters = null,
  isAnyFilterActive = false,
  style = {},
  variant = 'default', // 'default' | 'book'
  emptyActionLabel = null,
  onEmptyAction = null,
  onOpenImage = null
}) => {
  const isBookVariant = variant === 'book';
  const showChannel = columns.includes('channel');
  const showCategory = columns.includes('category');
  const showBalance = columns.includes('balance');

  // Compute grid template columns dynamically
  const gridTemplateColumns = isBookVariant
    ? '130px minmax(200px, 2.2fr) minmax(120px, 1.2fr) minmax(150px, 1.5fr) 60px 130px 130px'
    : (columns.length === 5
        ? '130px minmax(200px, 2.5fr) minmax(160px, 1.8fr) 100px 140px'
        : '130px minmax(170px, 2fr) minmax(140px, 1.4fr) minmax(150px, 1.4fr) minmax(110px, 1.1fr) 90px 130px 140px');

  return (
    <div className="cred-ledger-table-wrap" style={style}>
      {/* Table Header Row */}
      <div 
        className="cred-ledger-table-head"
        style={{ gridTemplateColumns }}
      >
        <div>DATE &amp; TIME</div>
        {isBookVariant ? (
          <>
            <div>REMARK</div>
            <div>CATEGORY</div>
            <div>MODE</div>
            <div>IMAGE</div>
            <div style={{ textAlign: 'right' }}>AMOUNT (SAR)</div>
            <div style={{ textAlign: 'right' }}>BALANCE</div>
          </>
        ) : (
          <>
            <div>PARTICULARS</div>
            <div>RELATION / ENTITY</div>
            {showChannel && <div>PAYMENT CHANNEL</div>}
            {showCategory && <div>CATEGORY</div>}
            <div>FLOW</div>
            <div style={{ textAlign: 'right' }}>AMOUNT (SAR)</div>
            {showBalance && <div style={{ textAlign: 'right' }}>RUNNING BALANCE</div>}
          </>
        )}
      </div>

      {/* Table Rows or States */}
      {isLoading ? (
        <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[1, 2, 3, 4, 5].map(n => (
            <div 
              key={n} 
              style={{ 
                height: '42px', 
                borderRadius: '10px', 
                background: 'var(--bg-subtle, #F5F5F5)', 
                animation: 'pulse 1.5s infinite ease-in-out' 
              }} 
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
            {emptyMessage}
          </div>
          {emptyActionLabel && onEmptyAction && (
            <button
              type="button"
              onClick={onEmptyAction}
              className="cred-btn-primary"
              style={{
                height: '38px',
                padding: '0 18px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 700,
                background: 'var(--text, #0A0A0A)',
                color: 'var(--bg, #FFFFFF)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {emptyActionLabel}
            </button>
          )}
        </div>
      ) : (
        entries.map((item) => {
          const isCredit = item.entry_type === 'in' || item.type === 'in';
          const isDebit = item.entry_type === 'out' || item.type === 'out';

          const { date, time } = formatLedgerDate(item.date, item.time);
          const { isCust, isVend, isLabour, isJob, isExp } = getEntryEntities(item);

          // Particulars icon
          const EntityIcon = isCust ? Users : isVend ? Building2 : isLabour ? HardHat : isJob ? Briefcase : isExp ? Receipt : Coins;

          // Book variant specific fields
          const remarkTitle = item.remark || item.party_name || (isCredit ? 'Cash In' : isDebit ? 'Cash Out' : 'Transfer');
          let relationText = '';
          if (item.customer_name || isCust) relationText = `customer: ${item.customer_name || item.party_name || ''}`;
          else if (item.vendor_name || isVend) relationText = `vendor: ${item.vendor_name || item.party_name || ''}`;
          else if (item.labour_name || isLabour) relationText = `labour: ${item.labour_name || item.staff_name || ''}`;
          else if (item.job_order_title || item.job_order_number || item.job_order || isJob) {
            const jobNum = item.job_order_number ? formatJobRef(item.job_order_number) : '';
            relationText = `job: ${jobNum ? `${jobNum} ` : ''}${item.job_order_title || ''}`;
          }
          else if (item.reference_number) relationText = `ref: ${formatJobRef(item.reference_number)}`;
          else if (item.party_name) relationText = `payee: ${item.party_name}`;

          // Payment channel & account name
          const channelName = item.payment_mode || (item.bank_account_name ? 'Bank Transfer' : 'Petty Cash');
          const isBankChannel = Boolean(item.bank_account_name || /bank/i.test(item.payment_mode || ''));
          const ChannelIcon = isBankChannel ? Landmark : Wallet;
          const accountLine = item.bank_account_name || item.petty_cash_account_name || '';

          // Image
          const imgSrc = item.attachment || item.image || item.receipt_image || item.custom_fields?.attachment || item.custom_fields?.image || null;

          if (isBookVariant) {
            return (
              <div 
                key={item.id}
                className={`cred-ledger-table-row ${isClickable && onOpenEntry ? 'is-interactive' : 'is-inert'}`}
                onClick={isClickable && onOpenEntry ? () => onOpenEntry(item) : undefined}
                role={isClickable && onOpenEntry ? 'row' : undefined}
                tabIndex={isClickable && onOpenEntry ? 0 : undefined}
                style={{
                  gridTemplateColumns,
                  cursor: isClickable && onOpenEntry ? 'pointer' : 'default',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* DESKTOP ROW COLUMNS (hidden on mobile <= 768px via CSS) */}
                <div className="cred-table-desktop-cols">
                  {/* 1. DATE & TIME */}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text, #0A0A0A)' }}>
                      {date}
                    </div>
                    {time && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                        {time}
                      </div>
                    )}
                  </div>

                  {/* 2. REMARK (circular icon with direction badge, bold remark, muted relation line) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
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
                        ) : (
                          <ArrowUpRight size={10} strokeWidth={2.5} />
                        )}
                      </div>
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text, #0A0A0A)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {remarkTitle}
                      </div>
                      {relationText && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {renderTextWithRefCode(relationText)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. CATEGORY */}
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.category || item.sub_category || '—'}
                  </div>

                  {/* 4. MODE (channel icon + name, with muted account line below) */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <ChannelIcon size={14} style={{ color: 'var(--text-muted, #8C8C8C)', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', color: 'var(--text, #0A0A0A)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {channelName}
                      </span>
                    </div>
                    {accountLine && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', paddingLeft: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {accountLine}
                      </div>
                    )}
                  </div>

                  {/* 5. IMAGE */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {imgSrc ? (
                      <img 
                        src={imgSrc} 
                        alt="attachment" 
                        style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '6px', 
                          objectFit: 'cover', 
                          border: '1px solid var(--border, #E4E4E4)',
                          cursor: 'pointer' 
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenImage) onOpenImage(imgSrc, item);
                          else window.open(imgSrc, '_blank');
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)' }}>—</span>
                    )}
                  </div>

                  {/* 6. AMOUNT */}
                  <div 
                    style={{ 
                      textAlign: 'right', 
                      fontSize: '13px', 
                      fontWeight: 500,
                      color: isCredit ? 'var(--positive, #19B25B)' : 'var(--danger, #E5482E)'
                    }}
                  >
                    <span style={{ marginRight: '1px' }}>{isCredit ? '+' : '-'}</span>
                    <Money value={item.amount || '0.00'} />
                  </div>

                  {/* 7. BALANCE */}
                  <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text, #0A0A0A)', fontWeight: 500 }}>
                    {item.display_running_balance !== undefined && item.display_running_balance !== null ? (
                      <Money value={item.display_running_balance} />
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </div>

                {/* MOBILE CARD VIEW (visible only on mobile <= 768px via CSS) */}
                <div className="cred-table-mobile-card">
                  {/* Row 1 (Top Metadata): Date & Time (left) and Running Balance (right, muted) */}
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
                      {item.display_running_balance !== undefined && item.display_running_balance !== null && (
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
                          ) : (
                            <ArrowUpRight size={10} strokeWidth={2.5} />
                          )}
                        </div>
                      </div>

                      <div className="cred-mobile-card-title">
                        {remarkTitle}
                      </div>
                    </div>

                    <div 
                      className="cred-mobile-card-amount"
                      style={{
                        color: isCredit ? 'var(--positive, #19B25B)' : 'var(--danger, #E5482E)'
                      }}
                    >
                      <span style={{ marginRight: '1px' }}>{isCredit ? '+' : '-'}</span>
                      <Money value={String(item.amount || '0.00').trim().replace(/^-/, '')} />
                    </div>
                  </div>

                  {/* Row 3 (Bottom Row): Dedicated Description Space (wrapping naturally, no truncation) */}
                  {(relationText || item.category) && (
                    <div className="cred-mobile-card-bottom">
                      {renderTextWithRefCode([relationText, item.category && item.category !== remarkTitle ? item.category : null].filter(Boolean).join('  ·  ') || relationText || item.category)}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Particulars title & subtitle
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

          return (
            <div 
              key={item.id}
              className={`cred-ledger-table-row ${isClickable && onOpenEntry ? 'is-interactive' : 'is-inert'}`}
              onClick={isClickable && onOpenEntry ? () => onOpenEntry(item) : undefined}
              role={isClickable && onOpenEntry ? 'row' : undefined}
              tabIndex={isClickable && onOpenEntry ? 0 : undefined}
              style={{
                gridTemplateColumns,
                cursor: isClickable && onOpenEntry ? 'pointer' : 'default',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* DESKTOP ROW COLUMNS (hidden on mobile <= 768px via CSS) */}
              <div className="cred-table-desktop-cols">
                {/* 1. DATE & TIME */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text, #0A0A0A)' }}>
                  {date}
                </div>
                {time && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                    {time}
                  </div>
                )}
              </div>

              {/* 2. PARTICULARS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                {/* Circular 36px icon with direction arrow badge */}
                <div className="cred-particulars-icon">
                  <EntityIcon size={16} strokeWidth={1.7} />
                  
                  {/* Small direction arrow badge at bottom-right with 2px cutout ring */}
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

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text, #0A0A0A)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {subtitle}
                  </div>
                </div>
              </div>

              {/* 3. RELATION / ENTITY */}
              <div style={{ minWidth: 0 }}>
                {relationLines.length > 0 ? (
                  relationLines.slice(0, 2).map((line, idx) => (
                    <div 
                      key={idx}
                      style={{ 
                        fontSize: '12px', 
                        color: 'var(--text-muted, #8C8C8C)', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap' 
                      }}
                    >
                      {renderTextWithRefCode(line)}
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>—</span>
                )}
              </div>

              {/* 4. PAYMENT CHANNEL (optional) */}
              {showChannel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <ChannelIcon size={14} style={{ color: 'var(--text-muted, #8C8C8C)', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: 'var(--text, #0A0A0A)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {channelName}
                  </span>
                </div>
              )}

              {/* 5. CATEGORY (optional) */}
              {showCategory && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.category || item.sub_category || '—'}
                </div>
              )}

              {/* 6. FLOW */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span 
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: isCredit ? 'var(--positive, #19B25B)' : isDebit ? 'var(--danger, #E5482E)' : 'var(--text-muted, #8C8C8C)'
                  }} 
                />
                <span 
                  style={{
                    fontSize: '12px',
                    fontWeight: 400,
                    color: isCredit ? 'var(--positive, #19B25B)' : isDebit ? 'var(--danger, #E5482E)' : 'var(--text-muted, #8C8C8C)'
                  }}
                >
                  {isCredit ? 'cash in' : isDebit ? 'cash out' : 'transfer'}
                </span>
              </div>

              {/* 7. AMOUNT (SAR) */}
              <div 
                style={{ 
                  textAlign: 'right', 
                  fontSize: '13px', 
                  fontWeight: 500,
                  color: isCredit ? 'var(--positive, #19B25B)' : isDebit ? 'var(--danger, #E5482E)' : 'var(--text, #0A0A0A)'
                }}
              >
                <Money 
                  value={item.amount || '0.00'} 
                  prefix={isCredit ? '+SAR ' : isDebit ? '-SAR ' : 'SAR '} 
                />
              </div>

              {/* 8. RUNNING BALANCE (optional) */}
              {showBalance && (
                <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text, #0A0A0A)', fontWeight: 500 }}>
                  {item.display_running_balance !== undefined && item.display_running_balance !== null ? (
                    <Money value={item.display_running_balance} />
                  ) : (
                    <span>—</span>
                  )}
                </div>
              )}
            </div>

            {/* MOBILE CARD VIEW (visible only on mobile <= 768px via CSS) */}
            <div className="cred-table-mobile-card">
              {/* Row 1 (Top Metadata): Date & Time (left) and Running Balance (right, muted) */}
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
        })
      )}
    </div>
  );
};

export default CredLedgerTable;
