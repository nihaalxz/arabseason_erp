import React, { useState } from 'react';
import IconTile from '../IconTile';
import SectionLabel from '../SectionLabel';
import { 
  Search, 
  SlidersHorizontal, 
  Receipt, 
  Users, 
  Building2, 
  HardHat, 
  Briefcase, 
  Landmark, 
  Trash2, 
  FileText,
  Settings,
  ArrowRight
} from 'lucide-react';

const CredMoreView = ({
  isMobile = false,
  counts = {},
  onNavigateTab,
  onSearch = null
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const quickSearchTags = [
    'petty cash',
    'bank transfers',
    'pending credit',
    'salary advances',
    'job orders',
    'vendor dues'
  ];

  const menuItems = [
    { id: 'expenses', label: 'expenses', icon: Receipt, count: counts.expenses || 0 },
    { id: 'customers', label: 'customers', icon: Users, count: counts.customers || 0 },
    { id: 'vendors', label: 'vendors', icon: Building2, count: counts.vendors || 0 },
    { id: 'labour', label: 'labour', icon: HardHat, count: counts.labour || 0 },
    { id: 'job_orders', label: 'job orders', icon: Briefcase, count: counts.jobOrders || 0 },
    { id: 'bank_accounts', label: 'accounts', icon: Landmark, count: counts.accounts || 0 },
    { id: 'recycle_bin', label: 'recycle bin', icon: Trash2, count: counts.recycleBin || 0 },
  ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchTerm);
  };

  if (isMobile) {
    return (
      <div className="cred-more-page cred-more-mobile" style={{ paddingTop: '10px' }}>
        {/* MENU GRID OF ICON TILES WITH COUNT BADGES */}
        <SectionLabel label="MENU" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px 12px',
            padding: '12px 0 32px'
          }}
        >
          {menuItems.map(item => (
            <IconTile
              key={item.id}
              icon={item.icon}
              label={item.label}
              count={item.count}
              onClick={() => onNavigateTab && onNavigateTab(item.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="cred-more-page">
      {/* 1. LARGE ROUNDED SEARCH PILL WITH CIRCULAR ICON BUTTON BESIDE IT */}
      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '14px 0 20px' }}>
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-pill)',
            padding: '10px 18px',
            transition: 'border-color var(--transition-fast)'
          }}
        >
          <Search size={18} strokeWidth={1.5} color="var(--text-muted)" style={{ marginRight: '10px', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="search transactions, parties, bills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              fontFamily: 'var(--font-ui)',
              color: 'var(--text)',
              width: '100%'
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => onSearch && onSearch(searchTerm)}
          aria-label="Filter"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all var(--transition-fast)'
          }}
        >
          <SlidersHorizontal size={18} strokeWidth={1.5} />
        </button>
      </form>

      {/* 2. "TRY SEARCHING FOR" BAND WITH WHITE CHIPS */}
      <div style={{ margin: '0 0 28px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '10px' }}>
          TRY SEARCHING FOR
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {quickSearchTags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setSearchTerm(tag);
                if (onSearch) onSearch(tag);
              }}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-pill)',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* 3. "MENU" GRID OF ICONTILES WITH COUNT BADGES */}
      <SectionLabel label="MENU" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
          gap: isMobile ? '24px 12px' : '32px 20px',
          padding: '12px 0 32px'
        }}
      >
        {menuItems.map(item => (
          <IconTile
            key={item.id}
            icon={item.icon}
            label={item.label}
            count={item.count}
            onClick={() => onNavigateTab && onNavigateTab(item.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default CredMoreView;
