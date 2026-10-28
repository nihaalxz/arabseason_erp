import React from 'react';
import { 
  Download, 
  Plus, 
  Minus, 
  Layers,
  Wallet
} from 'lucide-react';
import GooeyMenu from './GooeyMenu';

/**
 * CredPageHeader (Task 1)
 * Shared page header used by desktop Cashbook pages.
 * Left: Page title (28px lowercase bold) + optional muted caption (+ optional dateHeadline).
 * Right: Actions slot. If actions is undefined, defaults to ledger actions [scope, export, +credit, -debit].
 * (Utility cluster: refresh, theme toggle, settings gear has moved to CredTopStrip).
 */
const CredPageHeader = ({
  title = 'cash ledger',
  caption = null,
  dateHeadline = null,
  actions = undefined, // Allows overriding right actions if needed (null = no buttons)
  selectedScope = '__all__',
  onScopeChange = () => {},
  scopeOptions = [],
  pettyCashAccounts = [],
  onExport = () => {},
  onOpenCashIn = () => {},
  onOpenCashOut = () => {},
  onOpenTransfer = () => {},
  isDarkMode = false,
  isMobile = false,
  style = {}
}) => {
  // Build normalized options for scope dropdown
  const normalizedScopeOptions = scopeOptions.length > 0 
    ? scopeOptions 
    : [
        { id: '__all__', value: '__all__', label: 'all ledger payments', icon: Layers },
        ...pettyCashAccounts.map(p => ({
          id: String(p.id),
          value: String(p.id),
          label: `${p.name || 'Petty Cash'}`,
          sub: p.balance ? `${p.balance} SAR` : null,
          icon: Wallet
        }))
      ];

  return (
    <header 
      className="cred-shared-page-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
        width: '100%',
        position: 'relative',
        zIndex: 50,
        overflow: 'visible',
        ...style
      }}
    >
      {/* LEFT: TITLE & OPTIONAL CAPTION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
        {dateHeadline && (
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted, #8C8C8C)' }}>
            {dateHeadline}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <h1 
            style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 600,
              color: 'var(--text, #0A0A0A)',
              textTransform: 'lowercase',
              letterSpacing: '-0.02em',
              lineHeight: 1.15
            }}
          >
            {title}
          </h1>
          {caption && (
            <span 
              style={{ 
                fontSize: '13px', 
                color: 'var(--text-muted, #8C8C8C)', 
                fontWeight: 500,
                letterSpacing: '-0.01em'
              }}
            >
              {caption}
            </span>
          )}
        </div>
      </div>

      {/* RIGHT GROUP */}
      {actions !== undefined ? (
        actions ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {actions}
          </div>
        ) : null
      ) : (
        <div 
          className="cred-header-actions-right"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            position: 'relative',
            zIndex: 50,
            overflow: 'visible'
          }}
        >
          {/* 1. LEDGER SCOPE DROPDOWN (GooeyMenu liquid dropdown) */}
          <GooeyMenu
            id="cred-scope-dropdown-btn"
            className="cred-header-scope-dropdown"
            value={selectedScope}
            onSelect={(opt) => onScopeChange(opt.id || opt.value || opt)}
            options={normalizedScopeOptions}
            width={260}
            pillHeight={40}
            maxVisibleRows={7}
            ariaLabel="Select Ledger Scope"
          />

          {/* 2. EXPORT (OUTLINED PILL) */}
          <button
            type="button"
            id="cred-header-export-btn"
            onClick={onExport}
            className="cred-header-btn-outlined cred-header-export-btn"
            style={{
              height: '40px',
              padding: '0 16px',
              borderRadius: '999px',
              border: isDarkMode ? '1px solid #3A3A3A' : '1px solid var(--border, #E4E4E4)',
              background: 'transparent',
              color: isDarkMode ? '#FFFFFF' : 'var(--text, #0A0A0A)',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'border-color 0.15s ease'
            }}
          >
            <Download size={14} strokeWidth={1.8} />
            <span>export</span>
          </button>

          {/* 3. + CREDIT (CUSTOMER) - Standalone action omitted on mobile since integrated into central + button */}
          {!isMobile && (
            <button
              type="button"
              id="cred-header-credit-btn"
              onClick={onOpenCashIn}
              className="cred-header-btn-primary cred-header-action-credit"
              style={{
                height: '40px',
                padding: '0 16px',
                borderRadius: '12px',
                background: isDarkMode ? '#FFFFFF' : 'var(--black, #0A0A0A)',
                color: isDarkMode ? '#0A0A0A' : '#FFFFFF',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.15s ease, transform 0.1s ease'
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <Plus size={15} strokeWidth={2.4} />
              <span>credit (customer)</span>
            </button>
          )}

          {/* 4. - DEBIT (EXPENSE) - Standalone action omitted on mobile since integrated into central + button */}
          {!isMobile && (
            <button
              type="button"
              id="cred-header-debit-btn"
              onClick={onOpenCashOut}
              className="cred-header-btn-outlined cred-header-action-debit"
              style={{
                height: '40px',
                padding: '0 16px',
                borderRadius: '12px',
                border: isDarkMode ? '1px solid #3A3A3A' : '1px solid var(--border, #E4E4E4)',
                background: 'transparent',
                color: isDarkMode ? '#FFFFFF' : 'var(--text, #0A0A0A)',
                fontSize: '13px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'border-color 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = isDarkMode ? '#FFFFFF' : 'var(--text, #0A0A0A)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = isDarkMode ? '#3A3A3A' : 'var(--border, #E4E4E4)'; }}
            >
              <Minus size={15} strokeWidth={2.4} />
              <span>debit (expense)</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};

export default CredPageHeader;

