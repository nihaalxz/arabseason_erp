import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import CredPageHeader from '../CredPageHeader';
import MoneyCard from '../MoneyCard';
import CredSearchInput from '../CredSearchInput';
import CredDropdownSelect from '../CredDropdownSelect';
import GooeyMenu from '../GooeyMenu';
import CredAnimatedTabs from '../CredAnimatedTabs';
import CredLedgerTable, { getEntryEntities } from '../CredLedgerTable';
import Money from '../Money';
import CredCardCarousel from '../CredCardCarousel';
import CredPagination from '../CredPagination';
import CredMobileTxList from '../CredMobileTxList';
import { usePagination, PAGE_SIZE_DESKTOP, PAGE_SIZE_MOBILE, sortNewestFirst } from '../usePagination';
import { 
  Coins, 
  ArrowDownLeft, 
  ArrowUpRight, 
  TrendingUp, 
  ChevronDown, 
  Check, 
  Wallet, 
  Landmark, 
  Users, 
  User, 
  Building2, 
  HardHat, 
  Briefcase, 
  Receipt,
  ArrowLeftRight,
  Layers,
  FileText
} from 'lucide-react';

/**
 * CredHomeView (Task C: Home Page = Cash Ledger)
 * 1. Shared Page Header at the top
 * 2. Four MoneyCards row (total flow, cash in, cash out, net flow) acting as filters
 * 3. Compact 36px filter toolbar: All Payments dropdown, minimal date tabs, clear all filters, search box
 * 4. LEDGER (n) Section Header
 * 5. Outlined 20px card with CRED table (8 columns, sticky header, 56px rows, dotted separators)
 */
const CredHomeView = ({
  isMobile = false,
  kpi = {},
  transactions = [],
  accounts = [],
  pettyCashAccounts = [],
  duration = 'all',
  onDurationChange = () => {},
  searchQuery = '',
  onSearchChange = () => {},
  onExport = () => {},
  isDarkMode = false,
  onToggleTheme = () => {},
  onOpenEntry = () => {},
  onOpenCashIn = () => {},
  onOpenCashOut = () => {},
  onOpenTransfer = () => {},
  onRefresh = () => {},
  isRefreshing = false,
  onOpenMembers = () => {},
  onOpenRecycleBin = () => {},
  recycleBinCount = 0,
  selectedScope = '__all__',
  onScopeChange = () => {},
  isLoading = false
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Card filter state: null | 'in' | 'out' | 'net' (initialized from URL if present)
  const [cardFilter, setCardFilter] = useState(() => {
    const f = searchParams.get('flow');
    return (f === 'in' || f === 'out' || f === 'net') ? f : null;
  });

  // Sync flow param when searchParams change (e.g. browser back/forward or tab navigation)
  useEffect(() => {
    const flowParam = searchParams.get('flow');
    if (flowParam === 'in' || flowParam === 'out' || flowParam === 'net') {
      setCardFilter(flowParam);
    } else if (!flowParam && cardFilter !== null) {
      setCardFilter(null);
    }
  }, [searchParams]);

  // Table payment type filter from dropdown: 'all' | 'in' | 'out' | 'transfer'
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('all');
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);

  // Card summary values from KPI (these remain constant when a card filter is selected)
  const {
    totalFlow = '0.00',
    cashIn = '0.00',
    cashOut = '0.00',
    netFlow = '0.00',
    entriesCount = transactions.length,
    inCount = 0,
    outCount = 0
  } = kpi;

  // Handle card click with URL sync (Task 4)
  const handleCardClick = (filterType) => {
    let nextFilter = null;
    if (filterType !== 'all') {
      nextFilter = cardFilter === filterType ? null : filterType;
    }
    setCardFilter(nextFilter);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (nextFilter) {
        p.set('flow', nextFilter);
      } else {
        p.delete('flow');
      }
      return p;
    }, { replace: true });
  };

  // Check if any filter is active for the "clear all filters" link
  const isAnyFilterActive = Boolean(
    cardFilter !== null || 
    duration !== 'all' || 
    paymentTypeFilter !== 'all' || 
    (searchQuery && searchQuery.trim().length > 0)
  );

  const handleClearAllFilters = () => {
    setCardFilter(null);
    setPaymentTypeFilter('all');
    if (onDurationChange) onDurationChange('all');
    if (onSearchChange) onSearchChange('');
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.delete('flow');
      return p;
    }, { replace: true });
  };

  // Filter transactions for the table
  const tableEntries = useMemo(() => {
    let list = transactions || [];

    // 1. Card filter
    if (cardFilter === 'in') {
      list = list.filter(e => e.entry_type === 'in' || e.type === 'in');
    } else if (cardFilter === 'out') {
      list = list.filter(e => e.entry_type === 'out' || e.type === 'out');
    } else if (cardFilter === 'net') {
      // credit and debit entries only (transfers excluded)
      list = list.filter(e => e.entry_type === 'in' || e.entry_type === 'out' || e.type === 'in' || e.type === 'out');
    }

    // 2. Payment Entity dropdown filter (Task 1)
    if (paymentTypeFilter === 'customer') {
      list = list.filter(e => getEntryEntities(e).isCust);
    } else if (paymentTypeFilter === 'vendor') {
      list = list.filter(e => getEntryEntities(e).isVend);
    } else if (paymentTypeFilter === 'labour') {
      list = list.filter(e => getEntryEntities(e).isLabour);
    } else if (paymentTypeFilter === 'job_order') {
      list = list.filter(e => getEntryEntities(e).isJob);
    } else if (paymentTypeFilter === 'expense') {
      list = list.filter(e => getEntryEntities(e).isExp);
    }

    return list;
  }, [transactions, cardFilter, paymentTypeFilter]);

  // Chronological running balance calculation (if not already attached to items)
  const entriesWithBalance = useMemo(() => {
    // Check if items already have running_balance or calculated_running_balance
    const hasBalances = tableEntries.some(e => e.calculated_running_balance !== undefined || e.running_balance !== undefined);
    if (hasBalances) {
      return tableEntries.map(e => ({
        ...e,
        display_running_balance: e.calculated_running_balance ?? e.running_balance
      }));
    }

    // Sort ascending for cumulative balance calculation
    const sortedAsc = [...tableEntries].sort((a, b) => {
      const dComp = (a.date || '').localeCompare(b.date || '');
      if (dComp !== 0) return dComp;
      const tComp = (a.time || '').localeCompare(b.time || '');
      if (tComp !== 0) return tComp;
      return (a.id || 0) - (b.id || 0);
    });

    let running = 0;
    const withRunning = sortedAsc.map(item => {
      const amt = parseFloat(item.amount || 0) || 0;
      if (item.entry_type === 'in' || item.type === 'in') {
        running += amt;
      } else {
        running -= amt;
      }
      return {
        ...item,
        display_running_balance: running
      };
    });

    // Reverse back to latest first for table view
    return withRunning.reverse();
  }, [tableEntries]);

  // Ensure strict newest first display order: date desc, time desc, id desc
  const sortedEntries = useMemo(() => {
    return sortNewestFirst(entriesWithBalance);
  }, [entriesWithBalance]);

  // Pagination for cash ledger
  const resetKey = `${cardFilter}_${paymentTypeFilter}_${duration}_${searchQuery}_${selectedScope}`;
  const {
    pageItems,
    page,
    setPage,
    totalPages,
    rangeStart,
    rangeEnd,
    total
  } = usePagination(sortedEntries, isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP, resetKey);

  // Payment entity dropdown options (Task 1: All Payments, Customers, Vendors, Labour, Job Orders, Expenses)
  const paymentEntityOptions = useMemo(() => [
    { value: 'all', id: 'all', label: 'all payments', icon: Layers },
    { value: 'customer', id: 'customer', label: 'customers', icon: User },
    { value: 'vendor', id: 'vendor', label: 'vendors', icon: Building2 },
    { value: 'labour', id: 'labour', label: 'labour', icon: HardHat },
    { value: 'job_order', id: 'job_order', label: 'job orders', icon: FileText },
    { value: 'expense', id: 'expense', label: 'expenses', icon: Receipt },
  ], []);

  return (
    <div className="cred-home-page" style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* 1. SHARED PAGE HEADER (TASK B) */}
      <CredPageHeader
        title="cash ledger"
        isMobile={isMobile}
        selectedScope={selectedScope}
        onScopeChange={onScopeChange}
        pettyCashAccounts={pettyCashAccounts}
        onExport={onExport}
        onOpenCashIn={onOpenCashIn}
        onOpenCashOut={onOpenCashOut}
        onOpenTransfer={onOpenTransfer}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
        onOpenMembers={onOpenMembers}
        onOpenRecycleBin={onOpenRecycleBin}
        recycleBinCount={recycleBinCount}
      />

      {/* 2. FOUR MONEYCARDS: SHARED CAROUSEL */}
      <CredCardCarousel
        isMobile={isMobile}
        activeId={cardFilter}
        desktopGridColumns="repeat(4, 1fr)"
        style={{ marginBottom: '24px' }}
      >
        {/* Card 1: Total Ledger Flow */}
        <MoneyCard
          icon={Coins}
          label="TOTAL LEDGER FLOW"
          value={totalFlow}
          caption={`${entriesCount} ${entriesCount === 1 ? 'entry' : 'entries'} recorded`}
          isActive={cardFilter === null}
          onClick={() => handleCardClick('all')}
        />

        {/* Card 2: Ledger Cash In */}
        <MoneyCard
          icon={ArrowDownLeft}
          label="LEDGER CASH IN"
          value={cashIn}
          variant="positive"
          caption={`${inCount} received transactions`}
          isActive={cardFilter === 'in'}
          onClick={() => handleCardClick('in')}
        />

        {/* Card 3: Ledger Cash Out */}
        <MoneyCard
          icon={ArrowUpRight}
          label="LEDGER CASH OUT"
          value={cashOut}
          variant="danger"
          caption={`${outCount} paid transactions`}
          isActive={cardFilter === 'out'}
          onClick={() => handleCardClick('out')}
        />

        {/* Card 4: Net Period Flow */}
        <MoneyCard
          icon={TrendingUp}
          label="NET PERIOD FLOW"
          value={netFlow}
          variant={parseFloat(String(netFlow).replace(/,/g, '')) >= 0 ? 'positive' : 'danger'}
          caption="net balance"
          isActive={cardFilter === 'net'}
          onClick={() => handleCardClick('net')}
        />
      </CredCardCarousel>

      {/* 3. TOOLBAR DIRECTLY ABOVE TABLE (TASK 2: TWO ROWS) */}
      {/* ROW 1: [all payments v] on left ........ [search] on right (~300px) */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '16px',
          position: 'relative',
          zIndex: 40,
          overflow: 'visible'
        }}
      >
        {/* Left: All Payments Dropdown (GooeyMenu liquid dropdown) */}
        <div style={{ position: 'relative', zIndex: 40, overflow: 'visible' }}>
          <GooeyMenu
            id="cred-payments-dropdown-btn"
            value={paymentTypeFilter}
            onSelect={(opt) => setPaymentTypeFilter(opt.value || opt.id || opt)}
            options={paymentEntityOptions}
            width={220}
            pillHeight={40}
            ariaLabel="Filter payment category"
          />
        </div>

        {/* Right: Search Box (~300px) with Task D / 3 Fix */}
        <div style={{ width: '300px' }}>
          <CredSearchInput
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="search customer, job or remark"
            compact={false}
            ariaLabel="Search cash ledger"
          />
        </div>
      </div>

      {/* ROW 2: [all dates | today | this month] on left ........ "N entries" muted text & "clear all filters" link on right */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '12px'
        }}
      >
        {/* Left: Minimal Date Tabs (all dates | today | this month) animated with EasyUI layoutId spring pill */}
        <CredAnimatedTabs
          tabs={[
            { id: 'all', label: 'all dates' },
            { id: 'today', label: 'today' },
            { id: 'this_month', label: 'this month' }
          ]}
          value={duration}
          onChange={onDurationChange}
          ariaLabel="Date range filter"
        />

        {/* Right side: "N entries" muted text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span 
            className="cred-entries-count"
            style={{ 
              fontSize: '13px', 
              color: 'var(--text-muted, #8C8C8C)', 
              fontWeight: 500 
            }}
          >
            {entriesWithBalance.length} {entriesWithBalance.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </div>

      {/* 5. DENSE CRED TABLE (TASK C.5) */}
      {isMobile ? (
        <CredMobileTxList
          entries={pageItems}
          isClickable={false}
          showBalance={true}
          isLoading={isLoading}
          emptyMessage="no entries match these filters"
          onClearFilters={handleClearAllFilters}
          isAnyFilterActive={isAnyFilterActive}
        />
      ) : (
        <CredLedgerTable
          entries={pageItems}
          columns={['date', 'particulars', 'relation', 'channel', 'category', 'flow', 'amount', 'balance']}
          isClickable={true}
          onOpenEntry={onOpenEntry}
          isLoading={isLoading}
          emptyMessage="no entries match these filters"
          onClearFilters={handleClearAllFilters}
          isAnyFilterActive={isAnyFilterActive}
        />
      )}

      {/* 6. PAGINATION (Directly below table/list, 16px gap, outside table card) */}
      <CredPagination
        page={page}
        totalPages={totalPages}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        total={total}
        onPageChange={setPage}
        isMobile={isMobile}
      />
    </div>
  );
};

export default CredHomeView;
