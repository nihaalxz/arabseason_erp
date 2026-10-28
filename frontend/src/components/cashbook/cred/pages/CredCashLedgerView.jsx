import React, { useState } from 'react';
import FilterPill from '../FilterPill';
import MonthHeader from '../MonthHeader';
import Money from '../Money';
import CredPagination from '../CredPagination';
import { usePagination, PAGE_SIZE_DESKTOP, PAGE_SIZE_MOBILE, sortNewestFirst } from '../usePagination';
import { EmptyState } from '../CredStates';
import { 
  ArrowLeft, 
  Check, 
  CheckCircle2, 
  Filter, 
  Calendar, 
  CreditCard, 
  Layers, 
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Download,
  X
} from 'lucide-react';

const CredCashLedgerView = ({
  isMobile = false,
  entries = [],
  onBack,
  onOpenEntry,
  onExportCSV = null,
  activeFilter = 'all',
  activeCategory = 'All',
  activeMode = 'All',
  onFilterChange = null
}) => {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Sort newest first: entry date & time descending, tie-break by id descending
  const sortedEntries = React.useMemo(() => {
    return sortNewestFirst(entries || []);
  }, [entries]);

  // 2. Filter entries by search
  const filteredEntries = React.useMemo(() => {
    if (!searchQuery) return sortedEntries;
    const q = searchQuery.toLowerCase();
    return sortedEntries.filter(e => {
      const party = (e.party_name || e.party || e.customer_name || e.vendor_name || '').toLowerCase();
      const remark = (e.remark || '').toLowerCase();
      const cat = (e.category || '').toLowerCase();
      return party.includes(q) || remark.includes(q) || cat.includes(q);
    });
  }, [sortedEntries, searchQuery]);

  // 3. Client-side pagination
  const resetKey = `${activeFilter}_${activeCategory}_${activeMode}_${searchQuery}`;
  const {
    pageItems: pagedEntries,
    page,
    setPage,
    totalPages,
    rangeStart,
    rangeEnd,
    total
  } = usePagination(filteredEntries, isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP, resetKey);

  // 4. Group paginated entries by month/year for Mobile MonthHeaders
  const groupedEntries = React.useMemo(() => {
    const groups = {};
    pagedEntries.forEach(e => {
      let mKey = 'RECENT TRANSACTIONS';
      if (e.date) {
        try {
          const d = new Date(e.date);
          if (!isNaN(d.getTime())) {
            mKey = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
          }
        } catch (err) {}
      }
      if (!groups[mKey]) groups[mKey] = [];
      groups[mKey].push(e);
    });
    return groups;
  }, [pagedEntries]);

  return (
    <div className="cred-cash-ledger-page">
      {/* 1. TOP HEADER: BACK ARROW AND LOWERCASE TITLE "cash ledger" */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 16px', borderBottom: '1px solid var(--border)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ArrowLeft size={22} strokeWidth={1.5} />
          </button>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text)', textTransform: 'lowercase' }}>
            cash ledger
          </h2>
        </div>

        {onExportCSV && (
          <button
            type="button"
            onClick={onExportCSV}
            className="cred-btn-pill-outlined"
            style={{ fontSize: '11px', padding: '5px 12px' }}
          >
            <Download size={13} strokeWidth={1.5} />
            <span>export</span>
          </button>
        )}
      </div>

      {/* 2. HORIZONTALLY SCROLLABLE FILTER PILLS */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px', scrollbarWidth: 'none' }}>
        <FilterPill
          icon={Filter}
          label="FILTER"
          value={activeFilter !== 'all' ? activeFilter : null}
          active={activeFilter !== 'all'}
          onClick={() => onFilterChange && onFilterChange('filter')}
        />
        <FilterPill
          icon={Layers}
          label="CATEGORY"
          value={activeCategory !== 'All' ? activeCategory : null}
          active={activeCategory !== 'All'}
          onClick={() => onFilterChange && onFilterChange('category')}
        />
        <FilterPill
          icon={CreditCard}
          label="PAYMENT METHOD"
          value={activeMode !== 'All' ? activeMode : null}
          active={activeMode !== 'All'}
          onClick={() => onFilterChange && onFilterChange('mode')}
        />
        <FilterPill
          icon={Calendar}
          label="DATE"
          onClick={() => onFilterChange && onFilterChange('date')}
        />
      </div>

      {/* Search Bar Input */}
      <div style={{ marginBottom: '18px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-pill)',
            padding: '8px 16px'
          }}
        >
          <Search size={16} strokeWidth={1.5} color="var(--text-muted)" style={{ marginRight: '8px' }} />
          <input
            type="text"
            placeholder="search ledger entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              fontFamily: 'var(--font-ui)',
              color: 'var(--text)',
              width: '100%'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 3. CONTENT: MOBILE ROWS OR DESKTOP TABLE + DETAIL PANEL */}
      {entries.length === 0 ? (
        <EmptyState
          title="No Ledger Entries"
          description="Transactions matching your filters will be displayed here."
          actionLabel="clear search"
          onAction={() => setSearchQuery('')}
        />
      ) : isMobile ? (
        /* Mobile: Payment history style rows with dotted separators */
        <div>
          {Object.keys(groupedEntries).map(monthKey => (
            <div key={monthKey}>
              <MonthHeader label={monthKey} />
              {groupedEntries[monthKey].map(e => {
                const isPositive = e.entry_type === 'in' || e.type === 'in';
                const partyName = e.party_name || e.party || e.customer_name || e.vendor_name || 'General Entry';
                const initials = partyName.slice(0, 2).toUpperCase();

                return (
                  <div
                    key={e.id}
                    onClick={() => onOpenEntry && onOpenEntry(e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 0',
                      borderBottom: '1px dotted var(--divider-dotted)',
                      cursor: 'pointer',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      {/* Outlined circular avatar (initials or direction icon) */}
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-panel)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '13px',
                          color: 'var(--text)',
                          flexShrink: 0
                        }}
                      >
                        {initials}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '3px' }}>
                          {partyName}
                        </div>
                        {/* Status line with green check icon and lowercase date */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          <CheckCircle2 size={12} strokeWidth={2} color="var(--positive)" />
                          <span style={{ textTransform: 'lowercase' }}>
                            {e.category || 'general'} · {e.date || 'today'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right-aligned amount with lighter decimals */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: isPositive ? 'var(--positive)' : 'var(--text)' }}>
                        {isPositive ? '+' : ''}<Money value={e.amount || '0.00'} />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'lowercase', marginTop: '2px' }}>
                        {e.payment_mode || 'petty cash'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        /* Desktop: Wide table inside an outlined card with uppercase headers and a right-hand detail panel */
        <div style={{ display: 'grid', gridTemplateColumns: selectedEntry ? '1.8fr 1.2fr' : '1fr', gap: '24px', alignItems: 'start' }}>
          {/* Table Card */}
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)' }}>PARTY / DETAILS</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)' }}>CATEGORY</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)' }}>DATE</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)' }}>MODE</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)', textAlign: 'right' }}>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {pagedEntries.map(e => {
                  const isPositive = e.entry_type === 'in' || e.type === 'in';
                  const partyName = e.party_name || e.party || e.customer_name || e.vendor_name || 'General Entry';
                  const isSelected = selectedEntry?.id === e.id;

                  return (
                    <tr
                      key={e.id}
                      onClick={() => setSelectedEntry(e)}
                      style={{
                        borderBottom: '1px dotted var(--divider-dotted)',
                        background: isSelected ? 'var(--bg-panel)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background var(--transition-fast)'
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                            {partyName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>{partyName}</div>
                            {e.remark && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{e.remark}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text)' }}>{e.category || 'General'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{e.date}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12.5px', color: 'var(--text-muted)' }}>{e.payment_mode || 'Petty Cash'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', fontWeight: 700, color: isPositive ? 'var(--positive)' : 'var(--text)' }}>
                        {isPositive ? '+' : ''}<Money value={e.amount || '0.00'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Right-Hand Detail Panel */}
          {selectedEntry && (
            <div
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-card)',
                padding: '24px 22px',
                position: 'sticky',
                top: '20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)' }}>
                  ENTRY DETAILS
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="cred-display-serif" style={{ fontSize: '28px', fontWeight: 700, marginBottom: '6px' }}>
                <Money value={selectedEntry.amount || '0.00'} />
              </div>
              <div style={{ fontSize: '13px', color: 'var(--positive)', fontWeight: 600, marginBottom: '20px' }}>
                ✓ reconciled entry
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Party</div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedEntry.party_name || selectedEntry.party || 'General'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date & Mode</div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedEntry.date} · {selectedEntry.payment_mode || 'Petty Cash'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Category</div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedEntry.category || 'General'}</div>
                </div>
                {selectedEntry.remark && (
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remark</div>
                    <div style={{ fontSize: '13px', color: 'var(--text)' }}>{selectedEntry.remark}</div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onOpenEntry && onOpenEntry(selectedEntry)}
                className="cred-btn-primary"
                style={{ width: '100%' }}
              >
                edit transaction
              </button>
            </div>
          )}
        </div>
      )}

      {/* PAGINATION */}
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

export default CredCashLedgerView;
