import React from 'react';
import { 
  BookText, 
  LayoutDashboard, 
  Receipt, 
  Users, 
  Building2, 
  HardHat, 
  Briefcase, 
  Landmark, 
  Library, 
  PanelLeftClose, 
  PanelLeftOpen 
} from 'lucide-react';

/**
 * SideRail
 * Fixed black sidebar for desktop Cashbook.
 * - Starts with section MENU: 9 items in exact order:
 *   cash ledger, dashboard, expenses, customers, vendors, labour, job orders, accounts, books
 * - Bottom: 36px rounded 12px icon-only collapse toggle (PanelLeftClose / PanelLeftOpen)
 * - Collapsed mode: icons with tooltips
 * - No scrollbars (only MENU, which fits)
 */
const SideRail = ({
  activeTab = 'ledger',
  onNavigate = () => {},
  onCreateBook = () => {},
  books = [],
  selectedBook = null,
  selectedBookId = null,
  counts = {},
  isCollapsed = false,
  onToggleCollapse = () => {},
  className = '',
  style = {}
}) => {
  const menuItems = [
    { 
      key: 'ledger', 
      label: 'cash ledger', 
      icon: BookText, 
      isActive: activeTab === 'ledger' || activeTab === 'home' || activeTab === 'cash_ledger' 
    },
    { 
      key: 'bank_dashboard', 
      label: 'dashboard', 
      icon: LayoutDashboard, 
      isActive: activeTab === 'bank_dashboard' || activeTab === 'overview' 
    },
    { 
      key: 'expenses', 
      label: 'expenses', 
      icon: Receipt, 
      count: counts.expenses ?? null, 
      isActive: activeTab === 'expenses' 
    },
    { 
      key: 'customers', 
      label: 'customers', 
      icon: Users, 
      count: counts.customers ?? null, 
      isActive: activeTab === 'customers' 
    },
    { 
      key: 'vendors', 
      label: 'vendors', 
      icon: Building2, 
      count: counts.vendors ?? null, 
      isActive: activeTab === 'vendors' 
    },
    { 
      key: 'labour', 
      label: 'labour', 
      icon: HardHat, 
      count: counts.labour ?? null, 
      isActive: activeTab === 'labour' 
    },
    { 
      key: 'job_orders', 
      label: 'job orders', 
      icon: Briefcase, 
      count: counts.jobOrders ?? null, 
      isActive: activeTab === 'job_orders' || activeTab === 'jobs' 
    },
    { 
      key: 'bank_accounts', 
      label: 'accounts', 
      icon: Landmark, 
      count: counts.accounts ?? null, 
      isActive: activeTab === 'bank_accounts' || activeTab === 'accounts' 
    },
    { 
      key: 'books', 
      label: 'books', 
      icon: Library, 
      count: books.length, 
      isActive: activeTab === 'books' || activeTab === 'book' 
    },
  ];

  return (
    <aside 
      className={`cred-desktop-sidebar ${isCollapsed ? 'is-collapsed' : ''} ${className}`}
      style={{
        width: isCollapsed ? '76px' : '240px',
        minWidth: isCollapsed ? '76px' : '240px',
        background: 'var(--black, #0A0A0A)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        position: 'fixed',
        top: '50px',
        bottom: 0,
        left: 0,
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
        transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
        ...style
      }}
      aria-label="Cashbook Navigation"
    >
      {/* MIDDLE NAVIGATION: Fixed MENU */}
      <div 
        style={{ 
          flex: 1, 
          overflow: 'hidden', 
          padding: '16px 8px 12px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}
      >
        {/* SECTION: MENU */}
        <div style={{ flexShrink: 0 }}>
          {!isCollapsed ? (
            <div 
              style={{ 
                fontSize: '11px', 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                letterSpacing: '0.14em', 
                color: '#8C8C8C',
                padding: '4px 12px 8px'
              }}
            >
              MENU
            </div>
          ) : (
            <div style={{ height: '8px' }} />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  title={isCollapsed ? item.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                    gap: '10px',
                    padding: isCollapsed ? '10px 0' : '9px 12px',
                    borderRadius: '12px',
                    background: item.isActive ? '#1A1A1A' : 'transparent',
                    color: item.isActive ? '#FFFFFF' : '#9A9A9A',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: item.isActive ? 500 : 400,
                    textTransform: 'lowercase',
                    transition: 'all 0.15s ease',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => {
                    if (!item.isActive) {
                      e.currentTarget.style.background = '#141414';
                      e.currentTarget.style.color = '#FFFFFF';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!item.isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#9A9A9A';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Icon size={17} strokeWidth={item.isActive ? 2.2 : 1.6} style={{ flexShrink: 0 }} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>

                  {!isCollapsed && item.count !== null && item.count !== undefined && item.count > 0 && (
                    <span 
                      style={{ 
                        fontSize: '11px', 
                        fontWeight: 600, 
                        background: '#222222', 
                        color: '#E4E4E4', 
                        padding: '1px 7px', 
                        borderRadius: '999px',
                        minWidth: '18px',
                        textAlign: 'center'
                      }}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. BOTTOM COLLAPSE / EXPAND TOGGLE */}
      <div 
        style={{ 
          padding: '12px 14px', 
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: isCollapsed ? 'center' : 'flex-end',
          alignItems: 'center'
        }}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? "expand sidebar" : "collapse sidebar"}
          aria-label={isCollapsed ? "expand sidebar" : "collapse sidebar"}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '12px',
            background: 'transparent',
            border: 'none',
            color: '#8C8C8C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            transition: 'background-color 0.15s, color 0.15s'
          }}
          onMouseEnter={(e) => { 
            e.currentTarget.style.color = '#FFFFFF'; 
            e.currentTarget.style.background = '#1A1A1A';
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.color = '#8C8C8C'; 
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {isCollapsed ? (
            <PanelLeftOpen size={18} strokeWidth={1.8} />
          ) : (
            <PanelLeftClose size={18} strokeWidth={1.8} />
          )}
        </button>
      </div>
    </aside>
  );
};

export default SideRail;
