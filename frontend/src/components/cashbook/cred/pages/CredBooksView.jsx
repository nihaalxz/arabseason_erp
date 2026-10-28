import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import CredPageHeader from '../CredPageHeader';
import CredSearchInput from '../CredSearchInput';
import CredAnimatedTabs from '../CredAnimatedTabs';
import CredLedgerTable from '../CredLedgerTable';
import MoneyCard from '../MoneyCard';
import Money from '../Money';
import SegmentedToggle from '../SegmentedToggle';
import CredPagination from '../CredPagination';
import CredCardCarousel from '../CredCardCarousel';
import CredMobileTxList from '../CredMobileTxList';
import { usePagination, PAGE_SIZE_DESKTOP, PAGE_SIZE_MOBILE, sortNewestFirst } from '../usePagination';
import { EmptyState } from '../CredStates';
import { 
  Plus, 
  Download, 
  BookOpen, 
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Pencil,
  Users
} from 'lucide-react';

// Helper to determine if an entry is a bank outflow
const isBankEntry = (entry) => {
  if (!entry) return false;
  if (entry.bank_account || entry.bank_account_name) return true;
  const mode = (entry.payment_mode || '').trim().toLowerCase();
  return mode === 'bank transfer' || mode === 'card' || mode === 'cheque' || mode === 'online';
};

/**
 * CredBooksView (Task 2 & Task 3)
 * Rebuilt CRED-style Cash Books view for desktop (>= 1100px).
 * - Mobile: preserves existing mobile layout.
 * - Desktop:
 *   1. List View (?tab=books): Grid of books + dashed "+ new book" tile, search, empty/skeleton states.
 *   2. Detail View (?tab=books&book=<id>): 3 MoneyCards, compact toolbar with animated tabs,
 *      reused CredLedgerTable with custom columns, "new entry" modal trigger, edit book & members.
 */
const CredBooksView = ({
  isMobile = false,
  books = [],
  selectedBook = null,
  bookEntries = [],
  allEntries = [],
  onSelectBook = () => {},
  onCreateBook = () => {},
  onEditBook = () => {},
  onOpenMembers = () => {},
  onExportStatement = () => {},
  onNewEntry = () => {},
  onOpenEntry = () => {},
  onRefresh = () => {},
  isRefreshing = false,
  isDarkMode = false,
  onToggleTheme = () => {},
  onOpenRecycleBin = () => {},
  recycleBinCount = 0,
  pettyCashAccounts = [],
  selectedScope = '__all__',
  onScopeChange = () => {},
  isLoading = false,
  error = null
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state: ?tab=books (List) or ?tab=books&book=<id> (Detail)
  const bookIdParam = searchParams.get('book') || searchParams.get('bookId');

  // Local state for Books List View
  const [searchBookTerm, setSearchBookTerm] = useState('');

  // Local state for Book Detail View
  const [flowFilter, setFlowFilter] = useState('net'); // 'net' (all) | 'in' | 'out'
  const [duration, setDuration] = useState('all'); // 'all' | 'today' | 'this_month'
  const [detailSearchQuery, setDetailSearchQuery] = useState('');

  // Mobile state
  const [mobileFilterType, setMobileFilterType] = useState('all');
  const [toggleTab, setToggleTab] = useState('books');

  // Resolve active book from URL parameter or selectedBook prop
  const activeBook = useMemo(() => {
    if (!bookIdParam) return null;
    return books.find(b => String(b.id) === String(bookIdParam)) || (selectedBook && String(selectedBook.id) === String(bookIdParam) ? selectedBook : null);
  }, [books, bookIdParam, selectedBook]);

  // Helper to compute stats for a single book (used for card list)
  const computeBookStats = (b) => {
    if (!b) return { totalIn: '0.00', totalOut: '0.00', net: '—', count: 0 };
    const ents = (allEntries && allEntries.length > 0)
      ? allEntries.filter(e => String(e.cashbook) === String(b.id))
      : (b.id === activeBook?.id ? bookEntries : []);
    
    let sumIn = 0;
    let sumOut = 0;
    ents.forEach(e => {
      const amt = parseFloat(e.amount || 0) || 0;
      if (e.entry_type === 'in' || e.type === 'in') sumIn += amt;
      else sumOut += amt;
    });

    const opening = parseFloat(b.opening_balance || 0) || 0;
    const net = (opening + sumIn - sumOut).toFixed(2);
    const count = ents.length || b.entries_count || b.total_entries || 0;

    // "—" when the book has no entries or no balance
    const hasData = count > 0 || (b.balance !== undefined && b.balance !== null);
    const finalBalance = hasData ? (b.balance !== undefined && b.balance !== null ? b.balance : net) : '—';

    return {
      totalIn: sumIn > 0 ? sumIn.toFixed(2) : (b.total_in || '0.00'),
      totalOut: sumOut > 0 ? sumOut.toFixed(2) : (b.total_out || '0.00'),
      net: finalBalance,
      count
    };
  };

  // Filtered books list for Search in List View
  const filteredBooks = useMemo(() => {
    return (books || []).filter(b => {
      if (!searchBookTerm.trim()) return true;
      const q = searchBookTerm.toLowerCase().trim();
      return (b.name || '').toLowerCase().includes(q) || (b.description || '').toLowerCase().includes(q);
    });
  }, [books, searchBookTerm]);

  // =========================================================================
  // DETAIL VIEW COMPUTED ENTRIES & STATS
  // =========================================================================
  const activeBookEntries = useMemo(() => {
    if (!activeBook) return [];
    if (bookEntries && bookEntries.length > 0 && String(bookEntries[0]?.cashbook) === String(activeBook.id)) {
      return bookEntries;
    }
    if (allEntries && allEntries.length > 0) {
      const matched = allEntries.filter(e => String(e.cashbook) === String(activeBook.id));
      if (matched.length > 0) return matched;
    }
    return bookEntries || [];
  }, [activeBook, bookEntries, allEntries]);

  // Filter active book entries by date duration tabs
  const periodEntries = useMemo(() => {
    if (duration === 'today') {
      const todayStr = new Date().toISOString().substring(0, 10);
      return activeBookEntries.filter(e => e.date === todayStr);
    }
    if (duration === 'this_month') {
      const monthStr = new Date().toISOString().substring(0, 7);
      return activeBookEntries.filter(e => e.date && e.date.startsWith(monthStr));
    }
    return activeBookEntries;
  }, [activeBookEntries, duration]);

  // Card summary values summarize the active period (do not change when a card is selected)
  const periodStats = useMemo(() => {
    if (!activeBook) {
      return { totalIn: '0.00', totalOut: '0.00', net: '—', outBank: 0, outCash: 0, hasBreakdown: false };
    }
    let sumIn = 0;
    let sumOut = 0;
    let sumBank = 0;
    let sumHand = 0;
    let hasBreakdown = false;

    periodEntries.forEach(e => {
      const amt = parseFloat(e.amount || 0) || 0;
      const isCredit = e.entry_type === 'in' || e.type === 'in';
      if (isCredit) {
        sumIn += amt;
      } else {
        sumOut += amt;
        hasBreakdown = true;
        if (isBankEntry(e)) {
          sumBank += amt;
        } else {
          sumHand += amt;
        }
      }
    });

    const opening = parseFloat(activeBook.opening_balance || 0) || 0;
    const net = (opening + sumIn - sumOut).toFixed(2);
    const hasData = periodEntries.length > 0 || (activeBook.balance !== undefined && activeBook.balance !== null);
    const finalBalance = hasData ? net : '—';

    return {
      totalIn: sumIn.toFixed(2),
      totalOut: sumOut.toFixed(2),
      net: finalBalance,
      outBank: sumBank,
      outCash: sumHand,
      hasBreakdown: hasBreakdown && (sumBank > 0 || sumHand > 0)
    };
  }, [activeBook, periodEntries]);

  // Breakdown line for Card 2 ("bank 1,000 · in hand 1,000")
  const breakdownText = useMemo(() => {
    if (!periodStats.hasBreakdown) return null;
    const formatInt = (num) => Math.round(num).toLocaleString('en-US');
    return `bank ${formatInt(periodStats.outBank)} · in hand ${formatInt(periodStats.outCash)}`;
  }, [periodStats]);

  // Filter entries for the table based on selected card flow and search box
  const filteredTableEntries = useMemo(() => {
    let list = periodEntries;

    // 1. Flow Filter: 'net' = all entries; 'in' = credit entries; 'out' = debit entries
    if (flowFilter === 'in') {
      list = list.filter(e => e.entry_type === 'in' || e.type === 'in');
    } else if (flowFilter === 'out') {
      list = list.filter(e => e.entry_type === 'out' || e.type === 'out');
    }

    // 2. Search query (search remark, customer, payee, or category)
    if (detailSearchQuery.trim()) {
      const q = detailSearchQuery.toLowerCase().trim();
      list = list.filter(e => {
        const remark = (e.remark || '').toLowerCase();
        const party = (e.party_name || e.party || '').toLowerCase();
        const cust = (e.customer_name || '').toLowerCase();
        const vend = (e.vendor_name || '').toLowerCase();
        const lab = (e.labour_name || e.staff_name || '').toLowerCase();
        const cat = (e.category || '').toLowerCase();
        return remark.includes(q) || party.includes(q) || cust.includes(q) || vend.includes(q) || lab.includes(q) || cat.includes(q);
      });
    }

    return list;
  }, [periodEntries, flowFilter, detailSearchQuery]);

  // Chronological running balance calculation within this book
  const entriesWithBalance = useMemo(() => {
    // Check if items already have calculated_running_balance or running_balance
    const hasBalances = filteredTableEntries.some(e => e.calculated_running_balance !== undefined || e.running_balance !== undefined);
    if (hasBalances) {
      return filteredTableEntries.map(e => ({
        ...e,
        display_running_balance: e.calculated_running_balance ?? e.running_balance
      }));
    }

    // Sort ascending for cumulative balance calculation within activeBook
    const sortedAsc = [...filteredTableEntries].sort((a, b) => {
      const dComp = (a.date || '').localeCompare(b.date || '');
      if (dComp !== 0) return dComp;
      const tComp = (a.time || '').localeCompare(b.time || '');
      if (tComp !== 0) return tComp;
      return (a.id || 0) - (b.id || 0);
    });

    const opening = parseFloat(activeBook?.opening_balance || 0) || 0;
    let running = opening;
    const withRunning = sortedAsc.map(item => {
      const amt = parseFloat(item.amount || 0) || 0;
      if (item.entry_type === 'in' || item.type === 'in') {
        running += amt;
      } else {
        running -= amt;
      }
      return {
        ...item,
        display_running_balance: running.toFixed(2)
      };
    });

    return withRunning.reverse();
  }, [filteredTableEntries, activeBook]);

  // Ensure strict newest first display order: date desc, time desc, id desc
  const sortedBookEntries = useMemo(() => {
    return sortNewestFirst(entriesWithBalance);
  }, [entriesWithBalance]);

  // Pagination for book detail table
  const bookResetKey = `${flowFilter}_${duration}_${detailSearchQuery}_${activeBook?.id}`;
  const {
    pageItems: pagedBookEntries,
    page: bookPage,
    setPage: setBookPage,
    totalPages: totalBookPages,
    rangeStart: bookRangeStart,
    rangeEnd: bookRangeEnd,
    total: totalBookEntries
  } = usePagination(sortedBookEntries, isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP, bookResetKey);

  // Clear all filters handler for Detail View
  const handleClearDetailFilters = () => {
    setFlowFilter('net');
    setDuration('all');
    setDetailSearchQuery('');
  };

  const isAnyDetailFilterActive = flowFilter !== 'net' || duration !== 'all' || detailSearchQuery.trim() !== '';

  // Table section title based on active card filter
  const tableSectionTitle = flowFilter === 'in'
    ? `CASH IN TRANSACTIONS (${filteredTableEntries.length})`
    : flowFilter === 'out'
      ? `CASH OUT TRANSACTIONS (${filteredTableEntries.length})`
      : `ALL TRANSACTIONS (${filteredTableEntries.length})`;

  // =========================================================================
  // MOBILE LAYOUT
  // =========================================================================
  if (isMobile) {
    // A. BOOK DETAIL VIEW (when a book is selected via URL or activeBook)
    if (activeBook) {
      return (
        <div className="cred-books-detail-view cred-books-mobile-view" style={{ width: '100%', boxSizing: 'border-box' }}>
          {/* 1. Header with Back Arrow, Book Title & Clean Minimal Icon Buttons (edit / members / export) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
              <button
                type="button"
                onClick={() => {
                  onSelectBook(null);
                  setSearchParams(prev => {
                    const p = new URLSearchParams(prev);
                    p.delete('book');
                    p.delete('bookId');
                    return p;
                  });
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text, #0A0A0A)',
                  cursor: 'pointer',
                  padding: '4px',
                  margin: '-4px 0 -4px -4px',
                  flexShrink: 0
                }}
                aria-label="Back to books"
                title="Back to books"
              >
                <ArrowLeft size={20} strokeWidth={2.4} />
              </button>

              <h1 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--text, #0A0A0A)',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {activeBook.name}
              </h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                id="cred-mobile-book-edit-btn"
                onClick={() => onEditBook && onEditBook(activeBook)}
                className="cred-icon-btn"
                title="Edit book"
                aria-label="Edit book"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  flexShrink: 0
                }}
              >
                <Pencil size={15} strokeWidth={1.8} />
              </button>

              <button
                type="button"
                id="cred-mobile-book-members-btn"
                onClick={() => onOpenMembers && onOpenMembers(activeBook)}
                className="cred-icon-btn"
                title="Book members"
                aria-label="Book members"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  flexShrink: 0
                }}
              >
                <Users size={15} strokeWidth={1.8} />
              </button>

              <button
                type="button"
                id="cred-mobile-book-export-btn"
                onClick={() => onExportStatement && onExportStatement(activeBook)}
                className="cred-icon-btn"
                title="Export statement"
                aria-label="Export statement"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  flexShrink: 0
                }}
              >
                <Download size={15} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {activeBook.description && (
            <p style={{ margin: '-4px 0 14px', fontSize: '13px', color: 'var(--text-muted, #8C8C8C)', lineHeight: 1.4 }}>
              {activeBook.description}
            </p>
          )}

          {/* 2. Action Buttons Row: "+ new entry" */}
          <div style={{ marginBottom: '16px' }}>
            <button
              type="button"
              id="cred-mobile-book-new-entry-btn"
              onClick={() => onNewEntry && onNewEntry(activeBook)}
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={15} strokeWidth={2.4} />
              <span>new entry</span>
            </button>
          </div>

          {/* 3. Three MoneyCards in Horizontal Carousel (right to left scrolling, dynamically filtering table on tap) */}
          <CredCardCarousel
            isMobile={true}
            activeId={flowFilter}
            style={{ marginBottom: '20px' }}
          >
            <MoneyCard
              label="total cash in"
              value={periodStats.totalIn}
              variant="positive"
              caption="total received"
              isActive={flowFilter === 'in'}
              onClick={() => setFlowFilter(prev => prev === 'in' ? 'net' : 'in')}
            />

            <MoneyCard
              label="total cash out"
              value={periodStats.totalOut}
              variant="danger"
              caption={
                breakdownText ? (
                  <span>
                    total cash out
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                      {breakdownText}
                    </span>
                  </span>
                ) : "total cash out"
              }
              isActive={flowFilter === 'out'}
              onClick={() => setFlowFilter(prev => prev === 'out' ? 'net' : 'out')}
            />

            <MoneyCard
              label="net period balance"
              value={periodStats.net}
              variant="default"
              caption="net balance"
              isActive={flowFilter === 'net'}
              onClick={() => setFlowFilter('net')}
            />
          </CredCardCarousel>

          {/* 4. Date Tabs & Search Toolbar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ overflow: 'visible' }}>
                <CredAnimatedTabs
                  tabs={[
                    { id: 'all', label: 'all dates' },
                    { id: 'today', label: 'today' },
                    { id: 'this_month', label: 'this month' }
                  ]}
                  value={duration}
                  onChange={setDuration}
                  ariaLabel="Date range filter"
                />
              </div>

              <span 
                style={{ 
                  fontSize: '12px', 
                  color: 'var(--text-muted, #8C8C8C)', 
                  fontWeight: 500,
                  whiteSpace: 'nowrap'
                }}
              >
                {isAnyDetailFilterActive
                  ? `${filteredTableEntries.length} of ${activeBookEntries.length} entries`
                  : `${filteredTableEntries.length} ${filteredTableEntries.length === 1 ? 'entry' : 'entries'}`}
              </span>
            </div>

            <CredSearchInput
              value={detailSearchQuery}
              onChange={(e) => setDetailSearchQuery(e.target.value)}
              placeholder="search remark, customer or payee"
              compact={false}
              ariaLabel="Search book transactions"
            />
          </div>

          {/* 5. Section Title */}
          <div 
            style={{ 
              marginBottom: '10px', 
              fontSize: '11px', 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              letterSpacing: '0.14em', 
              color: 'var(--text-muted, #8C8C8C)' 
            }}
          >
            {tableSectionTitle}
          </div>

          {/* 6. Transaction Cards (same style as ledger & dashboard) */}
          <CredMobileTxList
            entries={pagedBookEntries}
            isClickable={false}
            showBalance={true}
            isLoading={isLoading}
            emptyMessage={
              activeBookEntries.length === 0
                ? "no entries in this book yet"
                : "no entries match these filters"
            }
          />

          {/* 9. Pagination */}
          <CredPagination
            page={bookPage}
            totalPages={totalBookPages}
            rangeStart={bookRangeStart}
            rangeEnd={bookRangeEnd}
            total={totalBookEntries}
            onPageChange={setBookPage}
            isMobile={true}
          />
        </div>
      );
    }

    // Detail state when bookIdParam is in URL but activeBook is loading
    if (bookIdParam && !activeBook && isLoading) {
      return (
        <div className="cred-books-detail-view cred-books-mobile-view" style={{ width: '100%', padding: '20px 0' }}>
          <div style={{ height: '24px', width: '180px', borderRadius: '12px', background: 'var(--bg-panel, #F7F7F7)', marginBottom: '16px', animation: 'pulse 1.5s infinite ease-in-out' }} />
          <div style={{ height: '36px', width: '220px', borderRadius: '12px', background: 'var(--bg-panel, #F7F7F7)', marginBottom: '20px', animation: 'pulse 1.5s infinite ease-in-out' }} />
          <div style={{ height: '110px', borderRadius: '20px', background: 'var(--bg-panel, #F7F7F7)', animation: 'pulse 1.5s infinite ease-in-out' }} />
        </div>
      );
    }

    // Detail state when bookIdParam is in URL but book is not found
    if (bookIdParam && !activeBook && !isLoading && books.length > 0) {
      return (
        <div className="cred-books-detail-view cred-books-mobile-view" style={{ width: '100%', padding: '40px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text, #0A0A0A)', marginBottom: '8px' }}>
            cash book not found
          </div>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted, #8C8C8C)' }}>
            The cash book with ID #{bookIdParam} could not be found.
          </p>
          <button
            type="button"
            onClick={() => {
              onSelectBook(null);
              setSearchParams({ tab: 'books' });
            }}
            className="cred-header-btn-outlined"
            style={{ height: '36px', padding: '0 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}
          >
            <ArrowLeft size={14} style={{ marginRight: '6px' }} />
            <span>back to books</span>
          </button>
        </div>
      );
    }

    // B. BOOKS LIST VIEW (when no book is selected)
    return (
      <div className="cred-books-list-view cred-books-mobile-view" style={{ width: '100%', boxSizing: 'border-box' }}>
        {/* Header */}
        <CredPageHeader
          title="books"
          caption={`${books.length} ${books.length === 1 ? 'cash book' : 'cash books'}`}
          actions={null}
          style={{ marginBottom: '14px' }}
        />

        {/* Toolbar: "+ new book" + search field */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <button
              type="button"
              id="cred-mobile-books-new-book-btn"
              onClick={onCreateBook}
              style={{
                height: '38px',
                padding: '0 18px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 700,
                background: 'var(--text, #0A0A0A)',
                color: 'var(--bg, #FFFFFF)',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={16} strokeWidth={2.4} />
              <span>new book</span>
            </button>
          </div>

          <div style={{ width: '100%' }}>
            <CredSearchInput
              value={searchBookTerm}
              onChange={(e) => setSearchBookTerm(e.target.value)}
              placeholder="search books"
              compact={false}
              ariaLabel="Search books"
            />
          </div>
        </div>

        {/* List of Book Cards */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            {[1, 2, 3, 4].map(n => (
              <div
                key={n}
                style={{
                  height: '130px',
                  borderRadius: '20px',
                  background: 'var(--bg-panel, #F7F7F7)',
                  animation: 'pulse 1.5s infinite ease-in-out'
                }}
              />
            ))}
          </div>
        ) : books.length === 0 ? (
          <EmptyState
            title="no books yet"
            description="Create your first cash book to start recording and segregating cash flows."
            actionLabel="+ create book"
            onAction={onCreateBook}
          />
        ) : filteredBooks.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text, #0A0A0A)' }}>
              no books match "{searchBookTerm}"
            </div>
            <button
              type="button"
              onClick={() => setSearchBookTerm('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #8C8C8C)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              clear search
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            {filteredBooks.map(b => {
              const stats = computeBookStats(b);
              const monogram = (b.name ? b.name.trim().charAt(0) : 'B').toUpperCase();
              const entryCountText = stats.count === 0 
                ? "no entries yet" 
                : `${stats.count} ${stats.count === 1 ? 'entry' : 'entries'}`;
              
              const hasNoEntries = !stats.count || stats.count === 0;
              const hasNoBalance = stats.net === null || stats.net === undefined || stats.net === '' || stats.net === '—';
              const displayBalance = (hasNoEntries || hasNoBalance) ? '—' : stats.net;

              return (
                <div
                  key={b.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelectBook(b);
                    setSearchParams(prev => {
                      const p = new URLSearchParams(prev);
                      p.set('tab', 'books');
                      p.set('book', b.id);
                      return p;
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectBook(b);
                      setSearchParams(prev => {
                        const p = new URLSearchParams(prev);
                        p.set('tab', 'books');
                        p.set('book', b.id);
                        return p;
                      });
                    }
                  }}
                  className="cred-book-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '20px',
                    borderRadius: '20px',
                    background: 'var(--bg-panel, #F7F7F7)',
                    border: 'var(--m-card-border, 0)',
                    cursor: 'pointer'
                  }}
                >
                  {/* Top: monogram on left, ArrowUpRight on right */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'var(--bg, #FFFFFF)',
                        border: '1px solid var(--border, #E4E4E4)',
                        color: 'var(--text, #111111)',
                        fontFamily: 'var(--font-display, "Newsreader", Georgia, serif)',
                        fontSize: '17px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {monogram}
                    </div>
                    <ArrowUpRight size={18} className="cred-book-card-arrow" />
                  </div>

                  {/* Middle: book name + entry count */}
                  <div style={{ margin: '14px 0 16px', minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '17px',
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                        color: 'var(--text, #111111)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={b.name}
                    >
                      {b.name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                      {entryCountText}
                    </div>
                  </div>

                  {/* Bottom: BALANCE label + Money */}
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.14em',
                        color: 'var(--text-muted, #8C8C8C)',
                        marginBottom: '3px'
                      }}
                    >
                      BALANCE
                    </div>
                    <div className="cred-book-card-balance" style={{ fontSize: '20px' }}>
                      <Money value={displayBalance} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // DESKTOP: DETAIL VIEW (?tab=books&book=<id>) - TASK 3
  // =========================================================================
  if (bookIdParam) {
    // If book id does not exist in books and loading is complete: show error state
    if (!activeBook && !isLoading && books.length > 0) {
      return (
        <div className="cred-books-detail-view" style={{ width: '100%' }}>
          <div 
            style={{ 
              padding: '80px 24px', 
              textAlign: 'center', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '16px' 
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text, #0A0A0A)' }}>
              cash book not found
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted, #8C8C8C)', maxWidth: '420px', lineHeight: 1.5 }}>
              The cash book with ID #{bookIdParam} could not be found or you do not have permission to view it.
            </p>
            <button
              type="button"
              onClick={() => {
                onSelectBook(null);
                setSearchParams({ tab: 'books' });
              }}
              className="cred-header-btn-outlined"
              style={{
                height: '40px',
                padding: '0 20px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={15} strokeWidth={2} style={{ marginRight: '6px' }} />
              <span>back to books</span>
            </button>
          </div>
        </div>
      );
    }

    if (!activeBook && isLoading) {
      return (
        <div className="cred-books-detail-view" style={{ width: '100%', padding: '24px 0' }}>
          <div style={{ height: '36px', width: '240px', borderRadius: '12px', background: 'var(--bg-subtle, #F5F5F5)', marginBottom: '24px', animation: 'pulse 1.5s infinite ease-in-out' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[1, 2, 3].map(n => (
              <div key={n} style={{ height: '110px', borderRadius: '20px', background: 'var(--bg-subtle, #F5F5F5)', animation: 'pulse 1.5s infinite ease-in-out' }} />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="cred-books-detail-view" style={{ width: '100%', boxSizing: 'border-box' }}>
        {/* 1. PAGE HEADER: Title (28px) + "edit" and "members" outlined pills + description under it.
               Right: "export statement" (outlined pill) and "new entry" (primary pill). No other buttons. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: '28px',
                  fontWeight: 700,
                  color: 'var(--text, #0A0A0A)',
                  lineHeight: 1.2
                }}
              >
                {activeBook?.name || 'cash book'}
              </h1>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  id="cred-book-edit-btn"
                  onClick={() => onEditBook && onEditBook(activeBook)}
                  className="cred-header-btn-outlined"
                  style={{
                    height: '28px',
                    padding: '0 12px',
                    fontSize: '11px',
                    borderRadius: '999px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  edit
                </button>

                <button
                  type="button"
                  id="cred-book-members-btn"
                  onClick={() => onOpenMembers && onOpenMembers(activeBook)}
                  className="cred-header-btn-outlined"
                  style={{
                    height: '28px',
                    padding: '0 12px',
                    fontSize: '11px',
                    borderRadius: '999px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  members
                </button>
              </div>
            </div>

            {activeBook?.description && (
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: '13px',
                  color: 'var(--text-muted, #8C8C8C)',
                  lineHeight: 1.4
                }}
              >
                {activeBook.description}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              id="cred-book-export-statement-btn"
              onClick={() => onExportStatement && onExportStatement(activeBook)}
              className="cred-header-btn-outlined"
              style={{
                height: '40px',
                padding: '0 18px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Download size={14} strokeWidth={2} style={{ marginRight: '6px' }} />
              <span>export statement</span>
            </button>

            <button
              type="button"
              id="cred-book-new-entry-btn"
              onClick={() => onNewEntry && onNewEntry(activeBook)}
              className="cred-btn-primary"
              style={{
                height: '40px',
                padding: '0 20px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 700,
                background: 'var(--text, #0A0A0A)',
                color: 'var(--bg, #FFFFFF)',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'transform 0.1s ease, opacity 0.15s ease'
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <Plus size={16} strokeWidth={2.4} />
              <span>new entry</span>
            </button>
          </div>
        </div>

        {/* 2. THREE MONEYCARDS IN ONE ROW:
               1. total cash in: green value, caption "total received"
               2. total cash out: red value, breakdown "bank X · in hand Y"
               3. net period balance: value, caption "net balance", active by default (all entries) */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '16px',
            marginBottom: '24px' 
          }}
        >
          <MoneyCard
            label="total cash in"
            value={periodStats.totalIn}
            variant="positive"
            caption="total received"
            isActive={flowFilter === 'in'}
            onClick={() => setFlowFilter(prev => prev === 'in' ? 'net' : 'in')}
          />

          <MoneyCard
            label="total cash out"
            value={periodStats.totalOut}
            variant="danger"
            caption={
              breakdownText ? (
                <span>
                  total cash out
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                    {breakdownText}
                  </span>
                </span>
              ) : "total cash out"
            }
            isActive={flowFilter === 'out'}
            onClick={() => setFlowFilter(prev => prev === 'out' ? 'net' : 'out')}
          />

          <MoneyCard
            label="net period balance"
            value={periodStats.net}
            variant="default"
            caption="net balance"
            isActive={flowFilter === 'net'}
            onClick={() => setFlowFilter('net')}
          />
        </div>

        {/* 3. TOOLBAR ABOVE TABLE (one compact row):
               Left: CredAnimatedTabs "all dates | today | this month"
               Right: CredSearchInput (placeholder "search remark, customer or payee")
               Far right: "N of M entries" muted + "clear all filters" when active */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '16px'
          }}
        >
          {/* Left: Minimal Date Tabs animated with LayoutId spring */}
          <div style={{ overflow: 'visible' }}>
            <CredAnimatedTabs
              tabs={[
                { id: 'all', label: 'all dates' },
                { id: 'today', label: 'today' },
                { id: 'this_month', label: 'this month' }
              ]}
              value={duration}
              onChange={setDuration}
              ariaLabel="Date range filter"
            />
          </div>

          {/* Right: Search box + entry count & clear all filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ width: '320px' }}>
              <CredSearchInput
                value={detailSearchQuery}
                onChange={(e) => setDetailSearchQuery(e.target.value)}
                placeholder="search remark, customer or payee"
                compact={false}
                ariaLabel="Search book transactions"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span 
                style={{ 
                  fontSize: '13px', 
                  color: 'var(--text-muted, #8C8C8C)', 
                  fontWeight: 500,
                  whiteSpace: 'nowrap'
                }}
              >
                {isAnyDetailFilterActive
                  ? `${filteredTableEntries.length} of ${activeBookEntries.length} entries`
                  : `${filteredTableEntries.length} ${filteredTableEntries.length === 1 ? 'entry' : 'entries'}`}
              </span>
            </div>
          </div>
        </div>

        {/* 4. TABLE SECTION HEADER */}
        <div 
          style={{ 
            marginBottom: '8px', 
            fontSize: '11px', 
            fontWeight: 700, 
            textTransform: 'uppercase', 
            letterSpacing: '0.14em', 
            color: 'var(--text-muted, #8C8C8C)' 
          }}
        >
          {tableSectionTitle}
        </div>

        {/* 5. TABLE: Reusing CredLedgerTable with variant="book" */}
        <CredLedgerTable
          variant="book"
          entries={pagedBookEntries}
          isClickable={true}
          onOpenEntry={onOpenEntry}
          isLoading={isLoading}
          emptyMessage={
            activeBookEntries.length === 0
              ? "no entries in this book yet"
              : "no entries match these filters"
          }
          emptyActionLabel={activeBookEntries.length === 0 ? "+ new entry" : null}
          onEmptyAction={activeBookEntries.length === 0 ? () => onNewEntry(activeBook) : null}
          onClearFilters={handleClearDetailFilters}
          isAnyFilterActive={isAnyDetailFilterActive}
        />

        {/* 6. PAGINATION (Directly below table, 16px gap, outside table card) */}
        <CredPagination
          page={bookPage}
          totalPages={totalBookPages}
          rangeStart={bookRangeStart}
          rangeEnd={bookRangeEnd}
          total={totalBookEntries}
          onPageChange={setBookPage}
          isMobile={isMobile}
        />
      </div>
    );
  }

  // =========================================================================
  // DESKTOP: LIST VIEW (?tab=books) - TASK 2
  // =========================================================================
  return (
    <div className="cred-books-list-view" style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* 1. PAGE HEADER: Title "books", caption "N cash books", empty actions slot (16px bottom margin) */}
      <CredPageHeader
        title="books"
        caption={`${books.length} ${books.length === 1 ? 'cash book' : 'cash books'}`}
        actions={null}
        style={{ marginBottom: '16px' }}
      />

      {/* 2. ONE TOOLBAR ROW: on the left "+ new book" button, on the right the search field (24px bottom margin) */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '24px',
          width: '100%',
          gap: '16px'
        }}
      >
        {/* Left: "+ new book" primary pill button */}
        <button
          type="button"
          id="cred-books-new-book-btn"
          onClick={onCreateBook}
          style={{
            height: '40px',
            padding: '0 20px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 700,
            background: 'var(--text, #0A0A0A)',
            color: 'var(--bg, #FFFFFF)',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            transition: 'transform 0.1s ease, opacity 0.15s ease',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <Plus size={16} strokeWidth={2.4} />
          <span>new book</span>
        </button>

        {/* Right: search field (CredSearchInput, ~320px) */}
        <div style={{ width: '320px', maxWidth: '100%' }}>
          <CredSearchInput
            value={searchBookTerm}
            onChange={(e) => setSearchBookTerm(e.target.value)}
            placeholder="search books"
            compact={false}
            ariaLabel="Search books"
          />
        </div>
      </div>

      {/* 3. GRID OF BOOKS */}
      {isLoading ? (
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
            gap: '20px',
            width: '100%'
          }}
        >
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div
              key={n}
              style={{
                borderRadius: '24px',
                border: '1px solid var(--border, #E4E4E4)',
                padding: '24px',
                minHeight: '176px',
                background: 'var(--card-bg, #FFFFFF)',
                boxSizing: 'border-box',
                animation: 'pulse 1.5s infinite ease-in-out'
              }}
            />
          ))}
        </div>
      ) : books.length === 0 ? (
        <EmptyState
          title="no books yet"
          description="Create your first cash book to start recording and segregating cash flows."
          actionLabel="+ create book"
          onAction={onCreateBook}
        />
      ) : filteredBooks.length === 0 ? (
        <div 
          style={{ 
            padding: '80px 24px', 
            textAlign: 'center', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '12px' 
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text, #0A0A0A)' }}>
            no books match "{searchBookTerm}"
          </div>
          <button
            type="button"
            onClick={() => setSearchBookTerm('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #8C8C8C)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            clear search
          </button>
        </div>
      ) : (
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
            gap: '20px',
            width: '100%'
          }}
        >
          {filteredBooks.map(b => {
            const stats = computeBookStats(b);
            const monogram = (b.name ? b.name.trim().charAt(0) : 'B').toUpperCase();
            const entryCountText = stats.count === 0 
              ? "no entries yet" 
              : `${stats.count} ${stats.count === 1 ? 'entry' : 'entries'}`;
            
            // When the book has no entries or no balance, show a muted "—"
            const hasNoEntries = !stats.count || stats.count === 0;
            const hasNoBalance = stats.net === null || stats.net === undefined || stats.net === '' || stats.net === '—';
            const displayBalance = (hasNoEntries || hasNoBalance) ? '—' : stats.net;

            return (
              <div
                key={b.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectBook(b)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectBook(b);
                  }
                }}
                className="cred-book-card"
              >
                {/* 1. Top row: monogram circle on left, ArrowUpRight on right */}
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    width: '100%'
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'var(--bg-panel, #F7F7F7)',
                      border: '1px solid var(--avatar-border, #E4E4E4)',
                      color: 'var(--text, #111111)',
                      fontFamily: 'var(--font-display, "Newsreader", Georgia, serif)',
                      fontSize: '18px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {monogram}
                  </div>

                  <ArrowUpRight 
                    size={18} 
                    className="cred-book-card-arrow"
                  />
                </div>

                {/* 2. Middle group: book name + entry count */}
                <div style={{ margin: '16px 0', minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '17px',
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                      color: 'var(--text, #111111)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={b.name}
                  >
                    {b.name}
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-muted, #8C8C8C)',
                      marginTop: '4px'
                    }}
                  >
                    {entryCountText}
                  </div>
                </div>

                {/* 3. Bottom group: BALANCE label + Money value */}
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.14em',
                      color: 'var(--text-muted, #8C8C8C)',
                      marginBottom: '4px'
                    }}
                  >
                    BALANCE
                  </div>
                  <div className="cred-book-card-balance">
                    <Money value={displayBalance} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CredBooksView;
