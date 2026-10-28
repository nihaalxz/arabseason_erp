import React, { useState } from 'react';
import SegmentedToggle from '../SegmentedToggle';
import FilterPill from '../FilterPill';
import Money from '../Money';
import CredPageHeader from '../CredPageHeader';
import CredSearchInput from '../CredSearchInput';
import { EmptyState } from '../CredStates';
import { 
  ArrowLeft, 
  Search, 
  Plus, 
  ChevronRight, 
  Building2, 
  Users, 
  HardHat, 
  Briefcase, 
  Landmark, 
  Receipt,
  Download,
  X,
  Phone,
  Mail,
  ExternalLink,
  ArrowLeftRight
} from 'lucide-react';

const CredListPageView = ({
  isMobile = false,
  pageType = 'customers', // 'customers' | 'vendors' | 'labour' | 'job_orders' | 'accounts' | 'expenses'
  pageTitle,
  headlineText,
  headlineAmount = null,
  items = [],
  filterOptions = [],
  activeFilter = 'all',
  onFilterChange,
  onBack,
  onAdd,
  onItemClick,
  onExport = null,
  onOpenCashIn = () => {},
  onOpenCashOut = () => {},
  onOpenTransfer = () => {},
  onRefresh = () => {},
  isRefreshing = false,
  isDarkMode = false,
  onToggleTheme = () => {},
  onOpenMembers = () => {},
  onOpenRecycleBin = () => {},
  recycleBinCount = 0,
  pettyCashAccounts = [],
  selectedScope = '__all__',
  onScopeChange = () => {}
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  // Filter items by search
  const filteredItems = (items || []).filter(item => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    const name = (item.name || item.title || item.bank_name || '').toLowerCase();
    const phone = (item.phone || '').toLowerCase();
    const company = (item.company || item.category || '').toLowerCase();
    return name.includes(q) || phone.includes(q) || company.includes(q);
  });

  const titleText = pageTitle || pageType;
  const countLabel = `${filteredItems.length} ${filteredItems.length === 1 ? 'record' : 'records'}`;

  // =========================================================================
  // MOBILE LAYOUT (<768px)
  // =========================================================================
  if (isMobile) {
    return (
      <div className="cred-list-page" style={{ width: '100%' }}>
        {/* Top Bar: Back Arrow + Search Pill with "+ add" */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0 16px', borderBottom: '1px solid var(--border)', marginBottom: '18px' }}>
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
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ArrowLeft size={22} strokeWidth={1.5} />
          </button>

          <CredSearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`search ${titleText}...`}
            ariaLabel={`Search ${titleText}`}
            style={{ flex: 1 }}
          />

          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="cred-btn-pill-outlined"
              style={{ padding: '6px 14px', fontSize: '12px', flexShrink: 0 }}
            >
              <Plus size={14} strokeWidth={2} />
              <span>add</span>
            </button>
          )}
        </div>

        {/* Headline Summary */}
        <div style={{ textAlign: 'center', padding: '8px 16px 20px' }}>
          <div className="cred-display-serif" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, marginBottom: '6px' }}>
            {headlineText}
          </div>
          {headlineAmount !== null && (
            <div className="cred-display-serif" style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>
              <Money value={headlineAmount} />
            </div>
          )}
        </div>

        {/* Filter Switcher */}
        {filterOptions && filterOptions.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
            <SegmentedToggle
              options={filterOptions}
              value={activeFilter}
              onChange={onFilterChange}
            />
          </div>
        )}

        {/* List Items */}
        {filteredItems.length === 0 ? (
          <EmptyState
            title={`No ${titleText} found`}
            description={`No items recorded yet or none match your search.`}
            actionLabel={onAdd ? `+ add ${titleText.slice(0, -1) || 'item'}` : undefined}
            onAction={onAdd}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredItems.map(item => (
              <div
                key={item.id}
                onClick={() => onItemClick && onItemClick(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 0',
                  borderBottom: '1px dashed var(--divider-dotted)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      border: '1.5px solid var(--border)',
                      background: 'var(--bg-panel)',
                      color: 'var(--text)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '13px',
                      flexShrink: 0
                    }}
                  >
                    {(item.name || item.title || 'I')[0].toUpperCase()}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name || item.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.subtitle || item.company || item.phone || 'General Record'}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                  <div className="cred-amount-pill-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>
                    <Money value={item.amount || '0.00'} />
                  </div>
                  {item.statusLabel && (
                    <div
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        marginTop: '4px',
                        color: item.isOverdue ? 'var(--danger)' : item.statusLabel === 'DUE' ? 'var(--due)' : 'var(--positive)'
                      }}
                    >
                      {item.statusLabel}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // DESKTOP LAYOUT (≥1100px): DENSE WORKSPACE TABLE + DETAIL PANEL
  // =========================================================================
  return (
    <div className="cred-desktop-list-frame" style={{ width: '100%' }}>
      {/* 1. Shared Page Header (Task B & Task 5: Transfer only on Accounts) */}
      <CredPageHeader
        title={titleText}
        caption={`${filteredItems.length} ${filteredItems.length === 1 ? 'record' : 'records'}`}
        onExport={onExport}
        onOpenCashIn={onOpenCashIn}
        onOpenCashOut={onOpenCashOut}
        actions={
          (pageType === 'accounts' || pageType === 'bank_accounts') ? (
            <button
              type="button"
              id="cred-header-transfer-btn"
              onClick={onOpenTransfer}
              className="cred-header-btn-outlined"
              style={{
                height: '40px',
                padding: '0 16px',
                borderRadius: '12px',
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
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = isDarkMode ? '#FFFFFF' : 'var(--text, #0A0A0A)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = isDarkMode ? '#3A3A3A' : 'var(--border, #E4E4E4)'; }}
            >
              <ArrowLeftRight size={14} strokeWidth={1.8} />
              <span>transfer</span>
            </button>
          ) : null
        }
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
        onOpenMembers={onOpenMembers}
        onOpenRecycleBin={onOpenRecycleBin}
        recycleBinCount={recycleBinCount}
        pettyCashAccounts={pettyCashAccounts}
        selectedScope={selectedScope}
        onScopeChange={onScopeChange}
      />

      {/* 2. Toolbar: Search, Filters, Primary Action */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: '16px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ width: '280px' }}>
          <CredSearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`search ${titleText}...`}
            compact={true}
            ariaLabel={`Search ${titleText}`}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Filter options */}
          {filterOptions && filterOptions.length > 0 && (
            <SegmentedToggle
              options={filterOptions}
              value={activeFilter}
              onChange={onFilterChange}
              size="small"
            />
          )}

          {/* Primary Action Button */}
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="cred-btn-primary"
              style={{ height: '36px', padding: '0 18px', fontSize: '12px' }}
            >
              <Plus size={16} strokeWidth={2.4} />
              <span>+ add {titleText.slice(0, -1) || 'item'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Container: Split 65% Table / 35% Detail Panel when item selected, or 100% Table */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: selectedItem ? '1fr 380px' : '1fr', 
          gap: '24px',
          alignItems: 'start'
        }}
      >
        {/* Table in Outlined 20px Card */}
        <div 
          style={{ 
            background: 'var(--bg)',
            borderRadius: 'var(--radius-card, 20px)',
            border: '1px solid var(--border)',
            overflow: 'hidden'
          }}
        >
          {filteredItems.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <EmptyState
                title={`No ${titleText} found`}
                description="No items match your criteria."
                actionLabel={onAdd ? `+ add ${titleText.slice(0, -1) || 'item'}` : undefined}
                onAction={onAdd}
              />
            </div>
          ) : (
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)' }}>
                      NAME / TITLE
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)' }}>
                      CONTACT / DETAILS
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)' }}>
                      STATUS
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)', textAlign: 'right' }}>
                      BALANCE / AMOUNT
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)', textAlign: 'center', width: '60px' }}>
                      
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const isSelected = selectedItem?.id === item.id;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        style={{
                          borderBottom: '1px dashed var(--divider-dotted)',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--bg-panel)' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-panel)'; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                border: '1px solid var(--border)',
                                background: 'var(--bg-panel)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '12px',
                                color: 'var(--text)',
                                flexShrink: 0
                              }}
                            >
                              {(item.name || item.title || 'I')[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>
                                {item.name || item.title}
                              </div>
                              {item.company && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {item.company}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '14px 18px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {item.subtitle || item.phone || item.email || '—'}
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          {item.statusLabel ? (
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                padding: '3px 8px',
                                borderRadius: '999px',
                                background: item.isOverdue 
                                  ? 'rgba(229, 72, 46, 0.12)' 
                                  : item.statusLabel === 'DUE' 
                                    ? 'rgba(238, 122, 46, 0.12)' 
                                    : 'rgba(25, 178, 91, 0.12)',
                                color: item.isOverdue 
                                  ? 'var(--danger)' 
                                  : item.statusLabel === 'DUE' 
                                    ? 'var(--due)' 
                                    : 'var(--positive)'
                              }}
                            >
                              {item.statusLabel}
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>active</span>
                          )}
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <span className="cred-amount-pill-btn" style={{ padding: '4px 12px', fontSize: '12px' }}>
                            <Money value={item.amount || '0.00'} />
                          </span>
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          <ChevronRight size={16} color="var(--text-muted)" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right-Hand Detail Panel (When a row is selected) */}
        {selectedItem && (
          <aside
            style={{
              background: 'var(--bg)',
              borderRadius: 'var(--radius-card, 20px)',
              border: '1px solid var(--border)',
              padding: '24px',
              position: 'sticky',
              top: '70px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.06)'
            }}
          >
            {/* Header with Close Button */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  RECORD DETAILS
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>
                  {selectedItem.name || selectedItem.title}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedItem.company || selectedItem.subtitle || 'Active Profile'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                aria-label="Close detail panel"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Balance Stat Card */}
            <div style={{ background: 'var(--bg-panel)', borderRadius: '16px', padding: '16px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                CURRENT BALANCE
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>
                <Money value={selectedItem.amount || '0.00'} />
              </div>
            </div>

            {/* Quick Contact & Metadata */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              {selectedItem.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)' }}>
                  <Phone size={14} color="var(--text-muted)" />
                  <span>{selectedItem.phone}</span>
                </div>
              )}
              {selectedItem.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)' }}>
                  <Mail size={14} color="var(--text-muted)" />
                  <span>{selectedItem.email}</span>
                </div>
              )}
              {selectedItem.address && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)' }}>
                  <MapPin size={14} color="var(--text-muted)" />
                  <span>{selectedItem.address}</span>
                </div>
              )}
            </div>

            {/* Action Buttons: Edit / Open Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => onItemClick && onItemClick(selectedItem)}
                className="cred-btn-primary"
                style={{ height: '40px', width: '100%', fontSize: '13px' }}
              >
                <span>edit / view full record</span>
                <ChevronRight size={15} />
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default CredListPageView;
