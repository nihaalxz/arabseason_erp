import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Landmark, 
  Wallet, 
  Coins, 
  ArrowLeftRight, 
  Search, 
  X, 
  RefreshCw, 
  Download, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Folder
} from 'lucide-react';
import CredAnimatedTabs from '../CredAnimatedTabs';
import GooeyMenu from '../GooeyMenu';
import CredPagination from '../CredPagination';
import CredCardCarousel from '../CredCardCarousel';
import MoneyCard from '../MoneyCard';
import { usePagination, PAGE_SIZE_DESKTOP, PAGE_SIZE_MOBILE, sortNewestFirst, formatJobRef } from '../usePagination';

const PERIOD_OPTIONS = [
  { id: 'all', value: 'all', label: 'All Time' },
  { id: 'today', value: 'today', label: 'Today' },
  { id: '7d', value: '7d', label: 'Last 7 Days' },
  { id: 'month', value: 'month', label: 'This Month' },
  { id: '30d', value: '30d', label: 'Last 30 Days' },
  { id: 'year', value: 'year', label: 'This Year' }
];

const CredAccountsView = ({
  isMobile = false,
  isDarkMode = false,
  banks = [],
  pettyCashAccounts = [],
  selectedAccountForStatement = null,
  onSelectAccount,
  accountsFilterTab = 'banks',
  onAccountsFilterTabChange,
  statementData = null,
  statementLoading = false,
  statementFlowFilter = 'all',
  onFlowFilterChange,
  statementSearchQuery = '',
  onSearchChange,
  statementDateRangePreset = 'all',
  onPresetChange,
  onOpenTransfer,
  onAddBank,
  onEditBank,
  onDeleteBank,
  onAddPettyCash,
  onEditPettyCash,
  onDeletePettyCash,
  onExportStatementCSV,
  formatDateDisplay = (d) => d || '—',
  formatTimeDisplay = (t) => t || '',
  safeFormatAmount = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}) => {
  const isBanksTab = accountsFilterTab === 'banks';
  const activeAccObj = selectedAccountForStatement?.account || (isBanksTab ? banks[0] : pettyCashAccounts[0]) || {};
  const isBankType = (selectedAccountForStatement?.type || (isBanksTab ? 'bank' : 'petty_cash')) === 'bank';
  const activeAccName = activeAccObj.bank_name || activeAccObj.name || (isBankType ? 'Selected Bank' : 'Selected Petty Cash');

  // Handle switching between Banks and Petty Cash
  const handleTabChange = (newTab) => {
    onAccountsFilterTabChange?.(newTab);
    if (newTab === 'banks') {
      if (banks.length > 0) {
        onSelectAccount?.({ type: 'bank', account: banks[0] });
      }
    } else {
      if (pettyCashAccounts.length > 0) {
        onSelectAccount?.({ type: 'petty_cash', account: pettyCashAccounts[0] });
      }
    }
  };

  // Gooey Account Selector Options
  const accountOptions = useMemo(() => {
    const currentList = isBanksTab ? banks : pettyCashAccounts;
    return currentList.map((item) => {
      const itemName = isBanksTab ? item.bank_name : item.name;
      const bal = safeFormatAmount(item.balance || item.current_balance || '0.00');
      return {
        id: String(item.id),
        value: String(item.id),
        label: itemName,
        sub: `${bal} SAR`,
        icon: isBanksTab ? Landmark : Wallet,
        raw: item
      };
    });
  }, [isBanksTab, banks, pettyCashAccounts, safeFormatAmount]);

  const selectedAccountId = activeAccObj?.id ? String(activeAccObj.id) : (accountOptions[0]?.value || '');

  // Statement Summary
  const summary = statementData?.summary || {
    opening_balance: parseFloat(activeAccObj.balance || activeAccObj.current_balance) || 0,
    total_credits: 0,
    total_debits: 0,
    net_change: 0,
    closing_balance: parseFloat(activeAccObj.balance || activeAccObj.current_balance) || 0,
    transactions_count: 0
  };

  const transactionsList = statementData?.transactions || [];

  // Sort newest first: entry date & time descending, tie-break by id descending
  const sortedTransactions = useMemo(() => sortNewestFirst(transactionsList), [transactionsList]);

  // Pagination for statement transactions
  const statementResetKey = `${statementFlowFilter}_${statementSearchQuery}_${statementDateRangePreset}_${activeAccObj?.id}`;
  const {
    pageItems: pagedTransactions,
    page: statementPage,
    setPage: setStatementPage,
    totalPages: totalStatementPages,
    rangeStart: statementRangeStart,
    rangeEnd: statementRangeEnd,
    total: totalStatementTransactions
  } = usePagination(sortedTransactions, isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP, statementResetKey);

  // Local card active indicator
  const isOpeningActive = statementFlowFilter === 'all';
  const isInActive = statementFlowFilter === 'in';
  const isOutActive = statementFlowFilter === 'out';
  const isClosingActive = statementFlowFilter === 'all';

  // Theme tokens
  const cardBg = isDarkMode ? '#111214' : '#ffffff';
  const borderColor = isDarkMode ? '#232528' : '#e2e8f0';
  const textPrimary = isDarkMode ? '#ffffff' : '#0f172a';
  const textMuted = isDarkMode ? '#94a3b8' : '#64748b';
  const activeBorderColor = isDarkMode ? '#ffffff' : '#0f172a';

  return (
    <div style={{
      width: '100%',
      maxWidth: '1440px',
      margin: '0 auto',
      boxSizing: 'border-box',
      padding: isMobile ? '0.5rem 0.5rem 4rem' : '0.5rem 0 3rem'
    }}>
      {/* ── 1. BREADCRUMB & HEADER ROW ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.45rem',
        marginBottom: '0.65rem',
        fontSize: '0.8rem',
        fontWeight: '600',
        color: textMuted
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '6px',
          background: isDarkMode ? '#1c1e22' : '#f1f5f9',
          color: textPrimary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {isBankType ? <Landmark size={13} /> : <Wallet size={13} />}
        </div>
        <span>Accounts</span>
        <span>/</span>
        <span style={{ color: textPrimary, fontWeight: '700' }}>{activeAccName}</span>
      </div>

      {/* ── 2. COMMAND BAR (TITLE & TOP ACTION BUTTONS) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        gap: '0.75rem',
        marginBottom: '1rem'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: isMobile ? '1.25rem' : '1.5rem',
          fontWeight: '800',
          color: textPrimary,
          letterSpacing: '-0.02em'
        }}>
          Accounts
        </h1>

        {/* Transfer Funds Button - Desktop only; mobile already has it in the floating plus button */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onOpenTransfer}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '999px',
                padding: '0.55rem 1.15rem',
                fontSize: '0.825rem',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                boxShadow: isDarkMode ? '0 2px 10px rgba(37, 99, 235, 0.35)' : '0 2px 8px rgba(37, 99, 235, 0.2)',
                transition: 'all 0.15s ease'
              }}
            >
              <ArrowLeftRight size={15} strokeWidth={2.4} />
              <span>Transfer Funds</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 3. TOOLBAR: BANKS/PETTY TABS (CRED ANIMATED) + GOOEY ACCOUNT SELECTOR ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        gap: '0.75rem',
        marginBottom: '1rem',
        position: 'relative',
        zIndex: 35
      }}>
        {/* Animated Tabs: Banks vs Petty Cash */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          overflow: 'visible',
          flexShrink: 0
        }}>
          <CredAnimatedTabs
            tabs={[
              { id: 'banks', label: 'Banks', count: banks.length },
              { id: 'petty_cash', label: 'Petty Cash', count: pettyCashAccounts.length }
            ]}
            value={accountsFilterTab}
            onChange={handleTabChange}
            className="case-preserve"
            layoutId="cred-accounts-type-tabs-pill"
          />
        </div>

        {/* Gooey Account Selector Dropdown with Edit, Delete & Checkmark */}
        <div style={{ position: 'relative', zIndex: 35, flexShrink: 0, width: isMobile ? '100%' : 'auto' }}>
          <GooeyMenu
            key={`cred-account-selector-dropdown-${accountsFilterTab}`}
            id={`cred-account-selector-dropdown-${accountsFilterTab}`}
            options={accountOptions}
            value={selectedAccountId}
            onSelect={(raw) => {
              if (raw) {
                onSelectAccount?.({ type: isBanksTab ? 'bank' : 'petty_cash', account: raw });
              }
            }}
            onChange={(val, raw) => {
              if (raw) {
                onSelectAccount?.({ type: isBanksTab ? 'bank' : 'petty_cash', account: raw });
              }
            }}
            width={isMobile ? 320 : 360}
            pillHeight={40}
            rowHeight={46}
            className="case-preserve"
            ariaLabel={`Select ${isBanksTab ? 'Bank Account' : 'Petty Cash Account'}`}
          />
        </div>
      </div>

      {/* ── 4. 4 KPI CARDS DECK (CRED CARD CAROUSEL SLIDESHOW ON MOBILE, GRID ON DESKTOP) ── */}
      <CredCardCarousel
        isMobile={isMobile}
        activeId={statementFlowFilter}
        desktopGridColumns="repeat(4, 1fr)"
        style={{
          marginBottom: isMobile ? '16px' : '20px'
        }}
      >
        {/* Card 1: Opening Balance */}
        <MoneyCard
          icon={Coins}
          label="OPENING BALANCE"
          value={summary.opening_balance}
          caption="Starting balance"
          isActive={isOpeningActive && statementFlowFilter === 'all'}
          onClick={() => onFlowFilterChange?.('all')}
          iconBg={isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9'}
          iconColor={isDarkMode ? '#ffffff' : '#0f172a'}
        />

        {/* Card 2: Cash In / Received */}
        <MoneyCard
          icon={ArrowUpRight}
          label="TOTAL CASH IN"
          value={summary.total_credits}
          variant="positive"
          caption="Total received"
          isActive={isInActive}
          onClick={() => {
            const next = statementFlowFilter === 'in' ? 'all' : 'in';
            onFlowFilterChange?.(next);
          }}
          iconBg={isDarkMode ? 'rgba(22, 163, 74, 0.12)' : '#dcfce7'}
          iconColor="#16a34a"
        />

        {/* Card 3: Cash Out / Spent */}
        <MoneyCard
          icon={ArrowDownRight}
          label="TOTAL CASH OUT"
          value={summary.total_debits}
          variant="danger"
          caption="Total spent"
          isActive={isOutActive}
          onClick={() => {
            const next = statementFlowFilter === 'out' ? 'all' : 'out';
            onFlowFilterChange?.(next);
          }}
          iconBg={isDarkMode ? 'rgba(220, 38, 38, 0.12)' : '#fee2e2'}
          iconColor="#dc2626"
        />

        {/* Card 4: Closing Balance */}
        <MoneyCard
          icon={TrendingUp}
          label="CLOSING BALANCE"
          value={summary.closing_balance}
          caption={`${summary.transactions_count || transactionsList.length} entries`}
          isActive={false}
          onClick={() => onFlowFilterChange?.('all')}
          iconBg={isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9'}
          iconColor={isDarkMode ? '#ffffff' : '#0f172a'}
        />
      </CredCardCarousel>

      {/* ── 5. SEARCH & GOOEY PERIOD DROPDOWN TOOLBAR ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1rem',
        position: 'relative',
        zIndex: 30
      }}>
        {/* Search Bar */}
        <div style={{
          position: 'relative',
          flex: 1,
          minWidth: isMobile ? '100%' : '260px',
          maxWidth: isMobile ? 'none' : '360px'
        }}>
          <Search size={15} style={{
            position: 'absolute',
            left: '0.85rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: textMuted,
            pointerEvents: 'none'
          }} />
          <input
            type="text"
            placeholder="Search remark, party, ref #..."
            value={statementSearchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 2rem 0 2.35rem',
              borderRadius: '10px',
              border: `1px solid ${borderColor}`,
              background: isDarkMode ? '#16181b' : '#f8fafc',
              color: textPrimary,
              fontSize: '0.825rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {statementSearchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: textMuted,
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Gooey Period Selection Menu */}
        <div style={{ position: 'relative', zIndex: 30 }}>
          <GooeyMenu
            id="cred-accounts-period-dropdown"
            options={PERIOD_OPTIONS}
            value={statementDateRangePreset}
            onSelect={(raw) => {
              if (raw?.value || raw?.id) {
                onPresetChange?.(raw.value || raw.id);
              }
            }}
            width={200}
            pillHeight={38}
            rowHeight={38}
            labelPrefix="Period: "
            className="case-preserve"
            ariaLabel="Filter Statement Period"
          />
        </div>
      </div>

      {/* ── 6. STATEMENT TRANSACTIONS TABLE CARD (COMPATIBLE, NO SIDE-SCROLL) ── */}
      <div style={{
        background: cardBg,
        border: `1px solid ${borderColor}`,
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.02)',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Table Top Action Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: isDarkMode ? '#141517' : '#f8fafc',
          borderBottom: `1px solid ${borderColor}`,
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '0.74rem', fontWeight: '800', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {activeAccName} STATEMENT TRANSACTIONS
          </span>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="cred-quiet-btn"
              onClick={onExportStatementCSV}
              title="Export CSV"
            >
              <Download size={16} />
              <span>export csv</span>
            </button>
          </div>
        </div>

        {/* Proportional Table */}
        <div style={{ width: '100%', overflowX: isMobile ? 'auto' : 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
            <thead>
              <tr style={{
                borderBottom: `1px solid ${borderColor}`,
                background: isDarkMode ? '#141517' : '#f8fafc'
              }}>
                <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', width: '13%' }}>DATE & TIME</th>
                <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', width: '13%' }}>REF # / VOUCHER</th>
                <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', width: '22%' }}>DESCRIPTION</th>
                <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', width: '15%' }}>PARTY / BENEFICIARY</th>
                <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', width: '10%' }}>CATEGORY</th>
                <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', whiteSpace: 'nowrap', width: '9%' }}>MONEY OUT</th>
                <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', whiteSpace: 'nowrap', width: '9%' }}>MONEY IN</th>
                <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: '700', color: textPrimary, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', whiteSpace: 'nowrap', width: '9%' }}>RUNNING BALANCE</th>
              </tr>
            </thead>
            <tbody>
              {statementLoading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: textMuted, fontSize: '0.85rem' }}>
                      <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Loading statement ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : pagedTransactions.length > 0 ? (
                pagedTransactions.map((tx, idx) => {
                  return (
                    <tr
                      key={tx.id || idx}
                      className="cred-table-row"
                      style={{
                        borderBottom: `1px solid ${borderColor}`
                      }}
                    >
                      <td style={{ padding: '8px 8px', fontSize: '0.8rem', color: textPrimary, verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: '600' }}>{formatDateDisplay(tx.date)}</div>
                        {tx.time && (
                          <div style={{ fontSize: '0.68rem', color: textMuted }}>
                            {formatTimeDisplay(tx.time)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: '0.74rem', fontFamily: 'monospace', color: textMuted, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {tx.reference_number || `TX-${tx.id}`}
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: '0.825rem', fontWeight: '600', color: textPrimary, verticalAlign: 'middle', maxWidth: '180px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.remark || 'Transaction'}>
                          {tx.remark || 'Transaction'}
                        </div>
                        {tx.cashbook_name && (
                          <div style={{ fontSize: '0.68rem', color: textMuted, fontWeight: '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Via: {tx.cashbook_name}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: '0.8rem', color: textPrimary, verticalAlign: 'middle', maxWidth: '130px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.party_name}>
                          {tx.party_name || '—'}
                        </div>
                      </td>
                      {/* Category: plain muted text, no chip */}
                      <td style={{ padding: '8px 8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span style={{
                          color: 'var(--text-muted, #8C8C8C)',
                          fontSize: '12px',
                          fontWeight: 500
                        }}>
                          {tx.category || 'General'}
                        </span>
                      </td>
                      {/* Flow columns: Money Out / Money In colors stay untouched */}
                      <td style={{ padding: '8px 8px', fontSize: '0.825rem', fontWeight: '700', textAlign: 'right', color: tx.debit > 0 ? '#dc2626' : textMuted, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {tx.debit > 0 ? `-${safeFormatAmount(tx.debit)}` : '—'}
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: '0.825rem', fontWeight: '700', textAlign: 'right', color: tx.credit > 0 ? '#16a34a' : textMuted, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {tx.credit > 0 ? `+${safeFormatAmount(tx.credit)}` : '—'}
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: '0.84rem', fontWeight: '800', textAlign: 'right', color: textPrimary, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {safeFormatAmount(tx.running_balance)} <span style={{ fontSize: '0.7rem', fontWeight: '600', color: textMuted }}>SAR</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: isDarkMode ? '#1e2024' : '#f1f5f9',
                      border: `1px solid ${borderColor}`,
                      color: textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 0.75rem'
                    }}>
                      <Coins size={20} />
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: textPrimary, marginBottom: '0.25rem' }}>
                      No Statement Transactions Recorded
                    </div>
                    <div style={{ fontSize: '0.75rem', color: textMuted }}>
                      {statementSearchQuery || statementFlowFilter !== 'all' ? 'Try adjusting your search query or flow filter.' : `No entries recorded for ${activeAccName}.`}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. PAGINATION (Directly below table card, 16px gap, outside table card) */}
      <CredPagination
        page={statementPage}
        totalPages={totalStatementPages}
        rangeStart={statementRangeStart}
        rangeEnd={statementRangeEnd}
        total={totalStatementTransactions}
        onPageChange={setStatementPage}
        isMobile={isMobile}
      />
    </div>
  );
};

export default CredAccountsView;
