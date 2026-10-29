import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Receipt, 
  ArrowDownRight, 
  AlertCircle, 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  X, 
  Phone, 
  Mail,
  RefreshCw,
  ArrowLeft,
  User,
  Filter 
} from 'lucide-react';
import MoneyCard from '../MoneyCard';
import CredCardCarousel from '../CredCardCarousel';
import CredAnimatedTabs from '../CredAnimatedTabs';
import GooeyMenu from '../GooeyMenu';
import Money from '../Money';
import CredStatus from '../CredStatus';
import CredRowIconButton from '../CredRowIconButton';
import { fadeFast } from '../motionTokens';
import CredPagination from '../CredPagination';
import { usePagination, PAGE_SIZE_DESKTOP, PAGE_SIZE_MOBILE, formatCompactKpi } from '../usePagination';
import CredDropdownSelect from '../CredDropdownSelect';

const getAmountFontSize = (val) => {
  const abs = Math.abs(parseFloat(val) || 0);
  if (abs >= 100000) return '10px';
  if (abs >= 10000) return '11px';
  return '12px';
};

const CredCustomersView = ({
  isMobile = false,
  customers = [],
  isLoading = false,
  isDarkMode = false,
  onAddCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onNavigate
}) => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('all');

  // Strictly deduplicate customers by ID
  const deduplicatedCustomers = useMemo(() => {
    const seen = new Set();
    return (customers || []).filter(item => {
      if (!item || item.id == null) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [customers]);

  // Computed summary metrics
  const metrics = useMemo(() => {
    const totalCustomersCount = deduplicatedCustomers.length;
    let totalBilled = 0;
    let totalCollected = 0;
    let totalCreditDue = 0;
    let totalPayableDue = 0;

    deduplicatedCustomers.forEach(c => {
      const billed = parseFloat(c.total_billed) || 0;
      const paid = parseFloat(c.paid_amount) || 0;
      const due = Math.max(0, billed - paid);
      const payable = parseFloat(c.remaining_payable ?? c.payable_amount) || 0;

      totalBilled += billed;
      totalCollected += paid;
      totalCreditDue += due;
      totalPayableDue += Math.max(0, payable);
    });

    const creditDueCustomers = deduplicatedCustomers.filter(c => {
      const billed = parseFloat(c.total_billed) || 0;
      const paid = parseFloat(c.paid_amount) || 0;
      return (billed - paid) > 0.01;
    });

    const payableDueCustomers = deduplicatedCustomers.filter(c => {
      const payable = parseFloat(c.remaining_payable ?? c.payable_amount) || 0;
      return payable > 0.01;
    });

    const settledCustomers = deduplicatedCustomers.filter(c => {
      const billed = parseFloat(c.total_billed) || 0;
      const paid = parseFloat(c.paid_amount) || 0;
      const payable = parseFloat(c.remaining_payable ?? c.payable_amount) || 0;
      return (billed > 0 || payable > 0) && (billed - paid) <= 0.01 && payable <= 0.01;
    });

    return {
      totalCustomersCount,
      totalBilled,
      totalCollected,
      totalCreditDue,
      totalPayableDue,
      creditDueCount: creditDueCustomers.length,
      payableDueCount: payableDueCustomers.length,
      settledCount: settledCustomers.length
    };
  }, [deduplicatedCustomers]);

  // Customer dropdown filter options
  const customerDropdownOptions = useMemo(() => {
    const list = [
      {
        id: 'all',
        value: 'all',
        label: 'All Customers',
        sub: `${metrics.totalCustomersCount} registered`,
        icon: Users
      }
    ];

    // Alphabetically sort customers
    const sorted = [...deduplicatedCustomers].sort((a, b) => 
      (a.name || a.company_name || '').localeCompare(b.name || b.company_name || '')
    );

    sorted.forEach(c => {
      const initial = (c.name || c.company_name || 'C').charAt(0).toUpperCase();
      const billed = parseFloat(c.total_billed) || 0;
      const paid = parseFloat(c.paid_amount) || 0;
      const due = Math.max(0, billed - paid);

      let subText = c.company_name || c.phone || 'Customer';
      if (due > 0.01) {
        subText += ` · Due: SAR ${due.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      }

      list.push({
        id: String(c.id),
        value: String(c.id),
        label: c.name || 'Unnamed Client',
        sub: subText,
        avatarText: initial,
        icon: User
      });
    });

    return list;
  }, [deduplicatedCustomers, metrics.totalCustomersCount]);

  // Filtered customer records
  const filteredCustomers = useMemo(() => {
    return deduplicatedCustomers.filter(c => {
      // 1. Customer dropdown filter
      if (selectedCustomerId && selectedCustomerId !== 'all') {
        if (String(c.id) !== String(selectedCustomerId)) return false;
      }

      // 2. Status tab filter
      const billed = parseFloat(c.total_billed) || 0;
      const paid = parseFloat(c.paid_amount) || 0;
      const due = billed - paid;
      const payable = parseFloat(c.remaining_payable ?? c.payable_amount) || 0;

      if (activeFilter === 'Credit Due' && due <= 0.01) return false;
      if (activeFilter === 'Payables Owed' && payable <= 0.01) return false;
      if (activeFilter === 'Settled' && (due > 0.01 || payable > 0.01 || (billed <= 0 && payable <= 0))) return false;

      // 3. Text search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (c.name || '').toLowerCase();
        const company = (c.company_name || c.company || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const address = (c.address || '').toLowerCase();
        return name.includes(q) || company.includes(q) || phone.includes(q) || email.includes(q) || address.includes(q);
      }
      return true;
    });
  }, [deduplicatedCustomers, selectedCustomerId, activeFilter, searchQuery]);

  // Pagination for customers
  const customerResetKey = `${selectedCustomerId}_${activeFilter}_${searchQuery}`;
  const {
    pageItems: pagedCustomers,
    page: customerPage,
    setPage: setCustomerPage,
    totalPages: totalCustomerPages,
    rangeStart: customerRangeStart,
    rangeEnd: customerRangeEnd,
    total: totalCustomerCount
  } = usePagination(filteredCustomers, isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP, customerResetKey);

  // Filter tabs with live counts
  const filterTabs = [
    { id: 'All', label: 'All', count: metrics.totalCustomersCount },
    { id: 'Credit Due', label: 'Credit Due', count: metrics.creditDueCount },
    { id: 'Payables Owed', label: 'Payables Owed', count: metrics.payableDueCount },
    { id: 'Settled', label: 'Settled', count: metrics.settledCount },
  ];

  return (
    <div 
      className="cred-page-container"
      style={{
        padding: isMobile ? '12px 14px 80px' : '20px 32px 60px',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* HEADER SECTION */}
      {isMobile ? (
        <div style={{ marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('more')}
            aria-label="Back to More"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 0',
              marginBottom: '10px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text, #0A0A0A)',
              outline: 'none',
              width: 'fit-content'
            }}
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', textTransform: 'lowercase' }}>
              customers
            </h1>
            <button
              type="button"
              id="btn-add-customer"
              onClick={() => onAddCustomer && onAddCustomer()}
              style={{
                background: isDarkMode ? '#FFFFFF' : '#0A0A0A',
                color: isDarkMode ? '#0A0A0A' : '#FFFFFF',
                border: 'none',
                borderRadius: '999px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Add</span>
            </button>
          </div>
        </div>
      ) : (
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            gap: '12px'
          }}
        >
          <h1 
            style={{
              fontSize: '1.75rem',
              fontWeight: 600,
              margin: 0,
              color: 'var(--text, #0A0A0A)',
              letterSpacing: '-0.025em'
            }}
          >
            Customers
          </h1>

          <button
            type="button"
            id="btn-add-customer"
            onClick={() => onAddCustomer && onAddCustomer()}
            style={{
              background: isDarkMode ? '#FFFFFF' : '#0A0A0A',
              color: isDarkMode ? '#0A0A0A' : '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: isDarkMode ? '0 2px 12px rgba(255,255,255,0.1)' : '0 2px 10px rgba(15,23,42,0.14)',
              transition: 'transform 0.15s ease, opacity 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add Customer</span>
          </button>
        </div>
      )}

      {/* 4 SUMMARY CARDS */}
      <CredCardCarousel 
        isMobile={isMobile}
        activeId={activeFilter}
        desktopGridColumns="repeat(4, 1fr)"
        style={{ marginBottom: '22px' }}
      >
        {/* Card 1: Total Clients */}
        <MoneyCard
          label="TOTAL CLIENTS"
          value={metrics.totalCustomersCount}
          isCount={true}
          caption={`${metrics.settledCount} settled`}
          icon={Users}
          iconBg={isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}
          iconColor={isDarkMode ? '#ffffff' : '#0f172a'}
          isActive={activeFilter === 'All'}
          onClick={() => setActiveFilter('All')}
        />

        {/* Card 2: Total Invoiced */}
        <MoneyCard
          label="TOTAL INVOICED"
          value={isMobile && formatCompactKpi(metrics.totalBilled) ? <span className="cred-tnum">{formatCompactKpi(metrics.totalBilled)}</span> : metrics.totalBilled.toFixed(2)}
          caption="Total invoiced"
          icon={Receipt}
          iconBg={isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}
          iconColor={isDarkMode ? '#ffffff' : '#0f172a'}
          isActive={false}
          onClick={() => setActiveFilter('All')}
        />

        {/* Card 3: Cash In Collected */}
        <MoneyCard
          label="CASH IN COLLECTED"
          value={
            <span style={{ color: 'var(--positive, #16a34a)', fontWeight: 800 }}>
              {metrics.totalCollected > 0 ? '+ ' : ''}
              {isMobile && formatCompactKpi(metrics.totalCollected) ? (
                <span className="cred-tnum">{formatCompactKpi(metrics.totalCollected)}</span>
              ) : (
                <Money value={metrics.totalCollected.toFixed(2)} />
              )}
            </span>
          }
          variant="positive"
          caption="Settled accounts"
          icon={ArrowDownRight}
          iconBg={isDarkMode ? 'rgba(22, 163, 74, 0.12)' : '#dcfce7'}
          iconColor={isDarkMode ? '#4ade80' : '#16a34a'}
          isActive={activeFilter === 'Settled'}
          onClick={() => setActiveFilter(activeFilter === 'Settled' ? 'All' : 'Settled')}
        />

        {/* Card 4: Credit Due */}
        <MoneyCard
          label="CREDIT DUE"
          value={
            <span style={{ color: 'var(--danger, #dc2626)', fontWeight: 800 }}>
              {isMobile && formatCompactKpi(metrics.totalCreditDue) ? (
                <span className="cred-tnum">{formatCompactKpi(metrics.totalCreditDue)}</span>
              ) : (
                <Money value={metrics.totalCreditDue.toFixed(2)} />
              )}
            </span>
          }
          variant="danger"
          caption={
            <span>
              {metrics.creditDueCount} pending
              {metrics.totalPayableDue > 0 && (
                <span style={{ marginLeft: 8, color: isDarkMode ? '#60a5fa' : '#2563eb', fontWeight: 700 }}>
                  · SAR {metrics.totalPayableDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} payable
                </span>
              )}
            </span>
          }
          icon={AlertCircle}
          iconBg={isDarkMode ? 'rgba(220, 38, 38, 0.12)' : '#fee2e2'}
          iconColor={isDarkMode ? '#f87171' : '#dc2626'}
          isActive={activeFilter === 'Credit Due'}
          onClick={() => setActiveFilter(activeFilter === 'Credit Due' ? 'All' : 'Credit Due')}
        />
      </CredCardCarousel>

      {/* FILTER TABS & SEARCH SECTION */}
      <div 
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
          position: 'relative',
          zIndex: 40,
          overflow: 'visible'
        }}
      >
        {isMobile ? (
          /* Mobile: Status Dropdown + Customer Dropdown */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', position: 'relative', zIndex: 40 }}>
            <GooeyMenu
              id="cred-customer-filter-dropdown"
              value={activeFilter}
              onSelect={(opt) => setActiveFilter(opt.value || opt.id || opt)}
              options={filterTabs.map(t => ({ value: t.id, label: `${t.label} (${t.count})` }))}
              width="100%"
              pillHeight={40}
              ariaLabel="Filter customer status"
            />
            <CredDropdownSelect
              id="cred-customer-dropdown-filter-mobile"
              value={selectedCustomerId}
              onChange={(newVal) => setSelectedCustomerId(newVal)}
              options={customerDropdownOptions}
              searchable={true}
              searchPlaceholder="Search customer name..."
              clearable={true}
              placeholder="All Customers"
              ariaLabel="Filter by customer"
              isDarkMode={isDarkMode}
              style={{ width: '100%' }}
              triggerStyle={{ width: '100%', justifyContent: 'space-between' }}
            />
          </div>
        ) : (
          /* Desktop: Animated Segmented Filter Tabs + Customer Dropdown */
          <div 
            style={{ 
              overflow: 'visible',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              flex: 1,
              minWidth: 0
            }}
          >
            <CredAnimatedTabs
              tabs={filterTabs}
              value={activeFilter}
              onChange={(newVal) => setActiveFilter(newVal)}
              className="case-preserve"
              layoutId="cred-customer-tabs-pill"
            />

            {/* Customer Dropdown Filter */}
            <CredDropdownSelect
              id="cred-customer-dropdown-filter"
              value={selectedCustomerId}
              onChange={(newVal) => setSelectedCustomerId(newVal)}
              options={customerDropdownOptions}
              searchable={true}
              searchPlaceholder="Search customer name..."
              clearable={true}
              placeholder="All Customers"
              ariaLabel="Filter by customer"
              isDarkMode={isDarkMode}
              style={{ minWidth: '220px', maxWidth: '320px' }}
            />
          </div>
        )}

        {/* Search Bar */}
        <div 
          style={{
            position: 'relative',
            width: isMobile ? '100%' : '260px',
            flexShrink: 0
          }}
        >
          <Search 
            size={15} 
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted, #8C8C8C)',
              pointerEvents: 'none'
            }} 
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customers..."
            style={{
              width: '100%',
              height: '36px',
              padding: '0 30px 0 34px',
              borderRadius: '12px',
              border: '1px solid var(--border, #E4E4E4)',
              background: 'var(--bg, #FFFFFF)',
              color: 'var(--text, #0A0A0A)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #8C8C8C)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>


      {/* TABLE / CONTENT SECTION */}
      {isLoading ? (
        <div 
          style={{
            background: 'var(--bg, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '16px',
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--text-muted, #8C8C8C)'
          }}
        >
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading customers...</div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div 
          style={{
            background: 'var(--bg, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '16px',
            padding: '54px 24px',
            textAlign: 'center'
          }}
        >
          <div 
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--bg-panel, #f1f5f9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              color: 'var(--text-muted, #8C8C8C)'
            }}
          >
            <Users size={22} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text, #0A0A0A)', margin: '0 0 6px' }}>
            No customers found
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)', margin: '0 0 16px' }}>
            {searchQuery 
              ? `No results matching "${searchQuery}" in ${activeFilter} filter` 
              : `No customers in the "${activeFilter}" category.`}
          </p>
          <button
            type="button"
            onClick={() => onAddCustomer && onAddCustomer()}
            style={{
              background: isDarkMode ? '#FFFFFF' : '#0A0A0A',
              color: isDarkMode ? '#0A0A0A' : '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              padding: '8px 16px',
              fontWeight: 500,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            + Add Customer
          </button>
        </div>
      ) : isMobile ? (
        /* MOBILE VIEW: CRED two-tier row layout with inset dashed separator and zero card borders */
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
          {pagedCustomers.map((c, idx) => {
            const billed = parseFloat(c.total_billed) || 0;
            const paid = parseFloat(c.paid_amount) || 0;
            const due = Math.max(0, billed - paid);
            const hasDue = due > 0.01;
            const payable = parseFloat(c.remaining_payable ?? c.payable_amount) || 0;
            const hasPayable = payable > 0.01;
            const initialLetter = (c.name || c.company_name || c.company || 'C').charAt(0).toUpperCase();

            return (
              <div key={c.id || idx} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Tier 1: Avatar | Name + Subline | Status dot + plain text */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 0 4px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <div 
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        border: isDarkMode ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--border, #E4E4E4)',
                        background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#fafafa',
                        color: isDarkMode ? '#FFFFFF' : '#0A0A0A',
                        fontWeight: 500,
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {initialLetter}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontWeight: 500,
                        fontSize: '14px',
                        color: 'var(--text, #0A0A0A)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.3
                      }}>
                        {c.name || 'Unnamed Client'}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-muted, #8C8C8C)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: '2px',
                        lineHeight: 1.3
                      }}>
                        {c.phone || c.company_name || c.company || 'Customer'}
                      </div>
                    </div>
                  </div>

                  {/* Status: small dot + plain text (no chip) */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: hasDue ? 'var(--danger, #dc2626)' : hasPayable ? 'var(--accent, #3b82f6)' : 'var(--positive, #16a34a)'
                    }} />
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      color: hasDue ? 'var(--danger, #dc2626)' : hasPayable ? 'var(--accent, #3b82f6)' : 'var(--text-muted, #8C8C8C)',
                      textTransform: 'lowercase'
                    }}>
                      {hasDue ? 'due' : hasPayable ? 'in progress' : 'settled'}
                    </span>
                  </div>
                </div>

                {/* Tier 2: 3 figures as quiet inline trio (inset 56px to align with text) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '8px',
                  padding: '6px 0 4px 56px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted, #8C8C8C)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: '2px'
                    }}>
                      Billed
                    </div>
                    <div style={{ 
                      fontSize: getAmountFontSize(billed), 
                      fontWeight: 500, 
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--text, #0A0A0A)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      <Money value={billed.toFixed(2)} />
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted, #8C8C8C)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: '2px'
                    }}>
                      Collected
                    </div>
                    <div style={{ 
                      fontSize: getAmountFontSize(paid), 
                      fontWeight: 500, 
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--text, #0A0A0A)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      <Money value={paid.toFixed(2)} />
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted, #8C8C8C)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: '2px'
                    }}>
                      Credit Due
                    </div>
                    <div style={{ 
                      fontSize: getAmountFontSize(due), 
                      fontWeight: 500, 
                      fontVariantNumeric: 'tabular-nums',
                      color: hasDue ? 'var(--danger, #dc2626)' : 'var(--text-muted, #8C8C8C)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      <Money value={due.toFixed(2)} />
                    </div>
                  </div>
                </div>

                {/* Row actions: one small right-aligned line of minimal text-or-icon buttons */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  padding: '4px 0 10px 56px'
                }}>
                  {hasDue && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate && onNavigate('entries', { search: c.name });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--text, #0A0A0A)',
                        cursor: 'pointer'
                      }}
                    >
                      Receive payment
                    </button>
                  )}
                  <button
                    type="button"
                    title="Edit Customer"
                    aria-label="Edit Customer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditCustomer && onEditCustomer(c);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--text-muted, #8C8C8C)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    title="Delete Customer"
                    aria-label="Delete Customer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCustomer && onDeleteCustomer(c.id, c.name);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--text-muted, #8C8C8C)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Inset dashed separator */}
                <div style={{
                  marginLeft: '56px',
                  borderBottom: isDarkMode ? '1px dashed rgba(255,255,255,0.08)' : '1px dashed rgba(0,0,0,0.08)'
                }} />
              </div>
            );
          })}
        </div>
      ) : (
        /* CUSTOMERS TABLE – sized to fit comfortably without horizontal scrollbar */
        <div 
          style={{
            background: 'var(--bg, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: isDarkMode ? 'none' : '0 2px 10px rgba(0,0,0,0.02)',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ width: '100%', overflowX: isMobile ? 'auto' : 'hidden' }}>
            <table 
              style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                textAlign: 'left',
                tableLayout: 'auto'
              }}
            >
              <thead>
                <tr 
                  style={{
                    borderBottom: '1px solid var(--border, #E4E4E4)',
                    background: isDarkMode ? '#141517' : '#f8fafc'
                  }}
                >
                  <th style={{ ...headerCellStyle, width: '22%' }}>CLIENT / COMPANY</th>
                  <th style={{ ...headerCellStyle, width: '18%' }}>CONTACT INFO</th>
                  <th style={{ ...headerCellStyle, width: '11%' }}>TOTAL BILLED</th>
                  <th style={{ ...headerCellStyle, width: '12%' }}>CASH COLLECTED</th>
                  <th style={{ ...headerCellStyle, width: '11%' }}>CREDIT DUE</th>
                  <th style={{ ...headerCellStyle, width: '11%' }}>PAYABLE (SAR)</th>
                  <th style={{ ...headerCellStyle, width: '9%' }}>STATUS</th>
                  <th style={{ ...headerCellStyle, width: '6%', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {pagedCustomers.map((c, idx) => {
                  const billed = parseFloat(c.total_billed) || 0;
                  const paid = parseFloat(c.paid_amount) || 0;
                  const due = Math.max(0, billed - paid);
                  const hasDue = due > 0.01;
                  const payable = parseFloat(c.remaining_payable ?? c.payable_amount) || 0;
                  const hasPayable = payable > 0.01;
                  const isSettled = !hasDue && !hasPayable;

                  const initialLetter = (c.name || c.company_name || c.company || 'C').charAt(0).toUpperCase();

                  return (
                    <tr
                      key={c.id || idx}
                      className="cred-table-row"
                      style={{
                        borderBottom: '1px solid var(--border, #E4E4E4)'
                      }}
                    >
                      {/* CLIENT / COMPANY */}
                      <td style={bodyCellStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div 
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              background: isDarkMode ? '#1e2024' : '#e2e8f0',
                              color: isDarkMode ? '#ffffff' : '#0f172a',
                              fontWeight: 700,
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {initialLetter}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div 
                              style={{ 
                                fontWeight: 500, 
                                fontSize: '13px', 
                                color: 'var(--text, #0A0A0A)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '180px'
                              }}
                              title={c.name}
                            >
                              {c.name || '—'}
                            </div>
                            {(c.company_name || c.company) && (
                              <div 
                                style={{ 
                                  fontSize: '11px', 
                                  color: 'var(--text-muted, #8C8C8C)', 
                                  marginTop: '1px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '180px'
                                }}
                                title={c.company_name || c.company}
                              >
                                {c.company_name || c.company}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* CONTACT INFO */}
                      <td style={{ ...bodyCellStyle, fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>
                        {c.phone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text, #0A0A0A)', fontWeight: 600 }}>
                            <Phone size={11} style={{ color: 'var(--text-muted, #8C8C8C)', flexShrink: 0 }} />
                            <span>{c.phone}</span>
                          </div>
                        ) : null}
                        {c.email ? (
                          <div 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px', 
                              fontSize: '11px', 
                              color: 'var(--text-muted, #8C8C8C)', 
                              marginTop: '1px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '160px'
                            }}
                            title={c.email}
                          >
                            <Mail size={10} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</span>
                          </div>
                        ) : null}
                        {!c.phone && !c.email && (
                          <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>—</span>
                        )}
                      </td>

                      {/* TOTAL BILLED */}
                      <td style={{ ...bodyCellStyle, fontSize: '13px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
                        <Money value={billed.toFixed(2)} />
                      </td>

                      {/* CASH COLLECTED (all numeric cells use ink, remove green) */}
                      <td style={{ ...bodyCellStyle, fontSize: '13px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
                        <Money value={paid.toFixed(2)} />
                      </td>

                      {/* CREDIT DUE (only red allowed is an outstanding amount > 0) */}
                      <td 
                        style={{ 
                          ...bodyCellStyle, 
                          fontSize: '13px', 
                          fontWeight: 700, 
                          color: hasDue ? 'var(--dot-danger, #E5482E)' : 'var(--text, #0A0A0A)' 
                        }}
                      >
                        {hasDue ? (
                          <Money value={due.toFixed(2)} />
                        ) : (
                          'SAR 0.00'
                        )}
                      </td>

                      {/* PAYABLE (SAR) (all numeric cells use ink, remove blue) */}
                      <td 
                        style={{ 
                          ...bodyCellStyle, 
                          fontSize: '13px', 
                          fontWeight: 600, 
                          color: 'var(--text, #0A0A0A)' 
                        }}
                      >
                        {hasPayable ? (
                          <Money value={payable.toFixed(2)} />
                        ) : (
                          'SAR 0.00'
                        )}
                      </td>

                      {/* STATUS (CredStatus: danger = credit due, warning = payables owed, success = settled; stacked) */}
                      <td style={bodyCellStyle}>
                        <div className="cred-status-stack">
                          {hasDue && (
                            <CredStatus tone="danger" label="credit due" />
                          )}
                          {hasPayable && (
                            <CredStatus tone="warning" label="payables owed" />
                          )}
                          {isSettled && (
                            <CredStatus tone="success" label="settled" />
                          )}
                        </div>
                      </td>

                      {/* ACTIONS (CredRowIconButton) */}
                      <td style={{ ...bodyCellStyle, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <CredRowIconButton
                            title="Edit Customer"
                            ariaLabel="Edit Customer"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditCustomer && onEditCustomer(c);
                            }}
                          >
                            <Pencil size={13} />
                          </CredRowIconButton>

                          <CredRowIconButton
                            tone="danger"
                            title="Delete Customer"
                            ariaLabel="Delete Customer"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCustomer && onDeleteCustomer(c.id, c.name);
                            }}
                          >
                            <Trash2 size={13} />
                          </CredRowIconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAGINATION (Directly below table, 16px gap, outside table card) */}
      <CredPagination
        page={customerPage}
        totalPages={totalCustomerPages}
        rangeStart={customerRangeStart}
        rangeEnd={customerRangeEnd}
        total={totalCustomerCount}
        onPageChange={setCustomerPage}
        isMobile={isMobile}
      />
    </div>
  );
};

const headerCellStyle = {
  padding: '10px 8px',
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--text-muted, #8C8C8C)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap'
};

const bodyCellStyle = {
  padding: '9px 8px',
  verticalAlign: 'middle',
  fontSize: '13px'
};

export default CredCustomersView;
