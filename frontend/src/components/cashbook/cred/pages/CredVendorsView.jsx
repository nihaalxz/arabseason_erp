import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Receipt, 
  ArrowUpRight, 
  AlertCircle, 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  X, 
  Phone, 
  Mail,
  RefreshCw,
  ArrowLeft 
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

const getAmountFontSize = (val) => {
  const abs = Math.abs(parseFloat(val) || 0);
  if (abs >= 100000) return '10px';
  if (abs >= 10000) return '11px';
  return '12px';
};

const CredVendorsView = ({
  isMobile = false,
  vendors = [],
  isLoading = false,
  isDarkMode = false,
  onAddVendor,
  onEditVendor,
  onDeleteVendor,
  onNavigate
}) => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Strictly deduplicate vendors by ID
  const deduplicatedVendors = useMemo(() => {
    const seen = new Set();
    return (vendors || []).filter(item => {
      if (!item || item.id == null) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [vendors]);

  // Computed vendor summary metrics
  const metrics = useMemo(() => {
    const totalVendorsCount = deduplicatedVendors.length;
    let totalBilled = 0;
    let totalDisbursed = 0;
    let totalPayablesDue = 0;

    deduplicatedVendors.forEach(v => {
      const billed = parseFloat(v.total_billed) || 0;
      const paid = parseFloat(v.paid_amount) || 0;
      const due = Math.max(0, billed - paid);

      totalBilled += billed;
      totalDisbursed += paid;
      totalPayablesDue += due;
    });

    const payablesDueVendors = deduplicatedVendors.filter(v => {
      const billed = parseFloat(v.total_billed) || 0;
      const paid = parseFloat(v.paid_amount) || 0;
      return (billed - paid) > 0.01;
    });

    const settledVendors = deduplicatedVendors.filter(v => {
      const billed = parseFloat(v.total_billed) || 0;
      const paid = parseFloat(v.paid_amount) || 0;
      return (billed - paid) <= 0.01;
    });

    return {
      totalVendorsCount,
      totalBilled,
      totalDisbursed,
      totalPayablesDue,
      payablesDueCount: payablesDueVendors.length,
      settledCount: settledVendors.length
    };
  }, [deduplicatedVendors]);

  // Filtered vendor records based on filter and search
  const filteredVendors = useMemo(() => {
    return deduplicatedVendors.filter(v => {
      const billed = parseFloat(v.total_billed) || 0;
      const paid = parseFloat(v.paid_amount) || 0;
      const due = billed - paid;

      if (activeFilter === 'Payables Due' && due <= 0.01) return false;
      if (activeFilter === 'Settled' && due > 0.01) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (v.name || '').toLowerCase();
        const company = (v.company || '').toLowerCase();
        const phone = (v.phone || '').toLowerCase();
        const email = (v.email || '').toLowerCase();
        const address = (v.address || '').toLowerCase();
        return name.includes(q) || company.includes(q) || phone.includes(q) || email.includes(q) || address.includes(q);
      }
      return true;
    });
  }, [deduplicatedVendors, activeFilter, searchQuery]);

  // Pagination for vendors
  const vendorResetKey = `${activeFilter}_${searchQuery}`;
  const {
    pageItems: pagedVendors,
    page: vendorPage,
    setPage: setVendorPage,
    totalPages: totalVendorPages,
    rangeStart: vendorRangeStart,
    rangeEnd: vendorRangeEnd,
    total: totalVendorCount
  } = usePagination(filteredVendors, isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP, vendorResetKey);

  // 3 Filter tabs with live count badges
  const filterTabs = [
    { id: 'All', label: 'All', count: metrics.totalVendorsCount },
    { id: 'Payables Due', label: 'Payables Due', count: metrics.payablesDueCount },
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
              vendors
            </h1>
            <button
              type="button"
              id="btn-add-vendor-mobile"
              onClick={() => onAddVendor && onAddVendor()}
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
            Vendors
          </h1>

          <button
            type="button"
            id="btn-add-vendor"
            onClick={() => onAddVendor && onAddVendor()}
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
            <span>Add Vendor</span>
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
        {/* Card 1: Total Suppliers */}
        <MoneyCard
          label="TOTAL SUPPLIERS"
          value={metrics.totalVendorsCount}
          isCount={true}
          caption={`${metrics.settledCount} settled`}
          icon={Building2}
          iconBg={isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}
          iconColor={isDarkMode ? '#ffffff' : '#0f172a'}
          isActive={activeFilter === 'All'}
          onClick={() => setActiveFilter('All')}
        />

        {/* Card 2: Total Billed */}
        <MoneyCard
          label="TOTAL BILLED"
          value={
            isMobile && formatCompactKpi(metrics.totalBilled) ? (
              <span className="cred-tnum">{formatCompactKpi(metrics.totalBilled)}</span>
            ) : (
              metrics.totalBilled.toFixed(2)
            )
          }
          caption="Total bills"
          icon={Receipt}
          iconBg={isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}
          iconColor={isDarkMode ? '#ffffff' : '#0f172a'}
          isActive={false}
          onClick={() => setActiveFilter('All')}
        />

        {/* Card 3: Cash Out Paid */}
        <MoneyCard
          label="CASH OUT PAID"
          value={
            <span style={{ color: isDarkMode ? '#60a5fa' : '#2563eb', fontWeight: 800 }}>
              {isMobile && formatCompactKpi(metrics.totalDisbursed) ? (
                <span className="cred-tnum">{formatCompactKpi(metrics.totalDisbursed)}</span>
              ) : (
                <Money value={metrics.totalDisbursed.toFixed(2)} />
              )}
            </span>
          }
          caption="Total paid"
          icon={ArrowUpRight}
          iconBg={isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe'}
          iconColor={isDarkMode ? '#60a5fa' : '#2563eb'}
          isActive={activeFilter === 'Settled'}
          onClick={() => setActiveFilter(activeFilter === 'Settled' ? 'All' : 'Settled')}
        />

        {/* Card 4: Payables Due */}
        <MoneyCard
          label="PAYABLES DUE"
          value={
            <span style={{ color: 'var(--danger, #dc2626)', fontWeight: 800 }}>
              {isMobile && formatCompactKpi(metrics.totalPayablesDue) ? (
                <span className="cred-tnum">{formatCompactKpi(metrics.totalPayablesDue)}</span>
              ) : (
                <Money value={metrics.totalPayablesDue.toFixed(2)} />
              )}
            </span>
          }
          variant="danger"
          caption={`${metrics.payablesDueCount} unpaid`}
          icon={AlertCircle}
          iconBg={isDarkMode ? 'rgba(220, 38, 38, 0.12)' : '#fee2e2'}
          iconColor={isDarkMode ? '#f87171' : '#dc2626'}
          isActive={activeFilter === 'Payables Due'}
          onClick={() => setActiveFilter(activeFilter === 'Payables Due' ? 'All' : 'Payables Due')}
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
          /* Mobile: GooeyMenu liquid dropdown bar */
          <div style={{ position: 'relative', zIndex: 40, overflow: 'visible', width: '100%' }}>
            <GooeyMenu
              id="cred-vendor-filter-dropdown"
              value={activeFilter}
              onSelect={(opt) => setActiveFilter(opt.value || opt.id || opt)}
              options={filterTabs.map(t => ({ value: t.id, label: `${t.label} (${t.count})` }))}
              width="100%"
              pillHeight={40}
              ariaLabel="Filter vendors"
            />
          </div>
        ) : (
          /* Desktop: Animated Segmented 3-Filter Tabs */
          <div 
            style={{ 
              overflow: 'visible',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0
            }}
          >
            <CredAnimatedTabs
              tabs={filterTabs}
              value={activeFilter}
              onChange={(newVal) => setActiveFilter(newVal)}
              className="case-preserve"
              layoutId="cred-vendor-tabs-pill"
            />
          </div>
        )}

        {/* Search Bar */}
        <div 
          style={{
            position: 'relative',
            width: isMobile ? '100%' : '280px'
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
            placeholder="Search vendors..."
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
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading vendors...</div>
        </div>
      ) : filteredVendors.length === 0 ? (
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
            <Building2 size={22} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text, #0A0A0A)', margin: '0 0 6px' }}>
            No vendors found
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)', margin: '0 0 16px' }}>
            {searchQuery 
              ? `No results matching "${searchQuery}" in ${activeFilter} filter` 
              : `Get started by adding your first supplier / vendor`}
          </p>
          <button
            type="button"
            onClick={() => onAddVendor && onAddVendor()}
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
            + Add Vendor
          </button>
        </div>
      ) : isMobile ? (
        /* MOBILE VIEW: CRED two-tier row layout with inset dashed separator and zero card borders */
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
          {pagedVendors.map((v, idx) => {
            const billed = parseFloat(v.total_billed) || 0;
            const paid = parseFloat(v.paid_amount) || 0;
            const due = Math.max(0, billed - paid);
            const hasDue = due > 0.01;
            const initialLetter = (v.name || v.company_name || v.company || 'V').charAt(0).toUpperCase();

            return (
              <div key={v.id || idx} style={{ display: 'flex', flexDirection: 'column' }}>
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
                        {v.name || 'Unnamed Supplier'}
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
                        {v.phone || v.company_name || v.company || 'Supplier'}
                      </div>
                    </div>
                  </div>

                  {/* Status: small dot + plain text (no chip) */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: hasDue ? 'var(--danger, #dc2626)' : 'var(--positive, #16a34a)'
                    }} />
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      color: hasDue ? 'var(--danger, #dc2626)' : 'var(--text-muted, #8C8C8C)',
                      textTransform: 'lowercase'
                    }}>
                      {hasDue ? 'due' : 'settled'}
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
                      Paid
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
                      Payable Due
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
                        onNavigate && onNavigate('entries', { search: v.name });
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
                      Pay vendor
                    </button>
                  )}
                  <button
                    type="button"
                    title="Edit Vendor"
                    aria-label="Edit Vendor"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditVendor && onEditVendor(v);
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
                    title="Delete Vendor"
                    aria-label="Delete Vendor"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteVendor && onDeleteVendor(v.id, v.name);
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
        /* VENDORS TABLE – fits comfortably on desktop without horizontal scrollbar */
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
                  <th style={{ ...headerCellStyle, width: '28%' }}>SUPPLIER / COMPANY</th>
                  <th style={{ ...headerCellStyle, width: '20%' }}>CONTACT INFO</th>
                  <th style={{ ...headerCellStyle, width: '13%' }}>TOTAL BILLED</th>
                  <th style={{ ...headerCellStyle, width: '13%' }}>PAID (CASH OUT)</th>
                  <th style={{ ...headerCellStyle, width: '13%' }}>PAYABLES DUE</th>
                  <th style={{ ...headerCellStyle, width: '8%' }}>STATUS</th>
                  <th style={{ ...headerCellStyle, width: '5%', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {pagedVendors.map((v, idx) => {
                  const billed = parseFloat(v.total_billed) || 0;
                  const paid = parseFloat(v.paid_amount) || 0;
                  const due = Math.max(0, billed - paid);
                  const hasDue = due > 0.01;
                  const isSettled = !hasDue;

                  const displayName = v.company || v.name || 'Vendor';
                  const initialLetter = displayName.charAt(0).toUpperCase();

                  return (
                    <tr
                      key={v.id || idx}
                      className="cred-table-row"
                      style={{
                        borderBottom: '1px solid var(--border, #E4E4E4)'
                      }}
                    >
                      {/* SUPPLIER / COMPANY */}
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
                                maxWidth: '240px'
                              }}
                              title={displayName}
                            >
                              {displayName}
                            </div>
                            {v.company && v.name && v.company !== v.name && (
                              <div 
                                style={{ 
                                  fontSize: '11px', 
                                  color: 'var(--text-muted, #8C8C8C)', 
                                  marginTop: '1px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '240px'
                                }}
                                title={v.name}
                              >
                                Contact: {v.name}
                              </div>
                            )}
                            {v.address && (
                              <div 
                                style={{ 
                                  fontSize: '10.5px', 
                                  color: 'var(--text-muted, #8C8C8C)', 
                                  marginTop: '1px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '240px'
                                }}
                                title={v.address}
                              >
                                {v.address}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* CONTACT INFO */}
                      <td style={{ ...bodyCellStyle, fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>
                        {v.phone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text, #0A0A0A)', fontWeight: 600 }}>
                            <Phone size={11} style={{ color: 'var(--text-muted, #8C8C8C)', flexShrink: 0 }} />
                            <span>{v.phone}</span>
                          </div>
                        ) : null}
                        {v.email ? (
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
                              maxWidth: '180px'
                            }}
                            title={v.email}
                          >
                            <Mail size={10} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.email}</span>
                          </div>
                        ) : null}
                        {!v.phone && !v.email && (
                          <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>—</span>
                        )}
                      </td>

                      {/* TOTAL BILLED */}
                      <td style={{ ...bodyCellStyle, fontSize: '13px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
                        <Money value={billed.toFixed(2)} />
                      </td>

                      {/* PAID (CASH OUT) (all numeric cells use ink, remove blue) */}
                      <td style={{ ...bodyCellStyle, fontSize: '13px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
                        <Money value={paid.toFixed(2)} />
                      </td>

                      {/* PAYABLES DUE (only red allowed is an outstanding amount > 0) */}
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

                      {/* STATUS (CredStatus: "settled" = success, "payables due" = danger) */}
                      <td style={bodyCellStyle}>
                        {hasDue ? (
                          <CredStatus tone="danger" label="payables due" />
                        ) : (
                          <CredStatus tone="success" label="settled" />
                        )}
                      </td>

                      {/* ACTIONS (CredRowIconButton) */}
                      <td style={{ ...bodyCellStyle, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <CredRowIconButton
                            title="Edit Vendor"
                            ariaLabel="Edit Vendor"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditVendor && onEditVendor(v);
                            }}
                          >
                            <Pencil size={13} />
                          </CredRowIconButton>

                          <CredRowIconButton
                            tone="danger"
                            title="Delete Vendor"
                            ariaLabel="Delete Vendor"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteVendor && onDeleteVendor(v.id, v.company || v.name);
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
        page={vendorPage}
        totalPages={totalVendorPages}
        rangeStart={vendorRangeStart}
        rangeEnd={vendorRangeEnd}
        total={totalVendorCount}
        onPageChange={setVendorPage}
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

export default CredVendorsView;
