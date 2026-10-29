import React, { useState, useEffect } from 'react';
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
  PanelLeftOpen,
  ChevronDown,
  LineChart,
  TrendingUp,
  BarChart3
} from 'lucide-react';

/**
 * SideRail
 * Fixed black sidebar for desktop Cashbook with expandable submenus.
 * - Starts with section MENU: items in exact order:
 *   cash ledger, dashboard, expenses, customers, vendors, labour, job orders, accounts, books
 * - Submenus for:
 *   - Customers -> customers, customer chart
 *   - Vendors -> vendors, vendor price chart
 *   - Labour -> labour, labour chart
 * - Bottom: 36px rounded 12px icon-only collapse toggle (PanelLeftClose / PanelLeftOpen)
 * - Collapsed mode: icons with tooltips
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
  const [expandedKeys, setExpandedKeys] = useState(() => {
    const initial = {};
    if (activeTab === 'customers' || activeTab === 'customer_chart') initial['customers'] = true;
    if (activeTab === 'vendors' || activeTab === 'vendor_price_chart') initial['vendors'] = true;
    if (activeTab === 'labour' || activeTab === 'labour_chart') initial['labour'] = true;
    return initial;
  });

  // Automatically keep parent submenu expanded when its child is active
  useEffect(() => {
    if (activeTab === 'customers' || activeTab === 'customer_chart') {
      setExpandedKeys(prev => ({ ...prev, customers: true }));
    } else if (activeTab === 'vendors' || activeTab === 'vendor_price_chart') {
      setExpandedKeys(prev => ({ ...prev, vendors: true }));
    } else if (activeTab === 'labour' || activeTab === 'labour_chart') {
      setExpandedKeys(prev => ({ ...prev, labour: true }));
    }
  }, [activeTab]);

  const toggleExpand = (key, e) => {
    if (e) e.stopPropagation();
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
      isActive: activeTab === 'customers' || activeTab === 'customer_chart',
      isExactActive: activeTab === 'customers',
      children: [
        { key: 'customer_chart', label: 'customer chart', icon: LineChart, isActive: activeTab === 'customer_chart' }
      ]
    },
    { 
      key: 'vendors', 
      label: 'vendors', 
      icon: Building2, 
      count: counts.vendors ?? null, 
      isActive: activeTab === 'vendors' || activeTab === 'vendor_price_chart' || activeTab === 'vendor_chart',
      isExactActive: activeTab === 'vendors',
      children: [
        { key: 'vendor_price_chart', label: 'vendor chart', icon: TrendingUp, isActive: activeTab === 'vendor_price_chart' || activeTab === 'vendor_chart' }
      ]
    },
    { 
      key: 'labour', 
      label: 'labour', 
      icon: HardHat, 
      count: counts.labour ?? null, 
      isActive: activeTab === 'labour' || activeTab === 'labour_chart',
      isExactActive: activeTab === 'labour',
      children: [
        { key: 'labour_chart', label: 'labour chart', icon: BarChart3, isActive: activeTab === 'labour_chart' }
      ]
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
          overflowY: 'auto', 
          overflowX: 'hidden',
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
              const hasChildren = Boolean(item.children && item.children.length > 0);
              const isExpanded = Boolean(expandedKeys[item.key]);

              return (
                <div key={item.key} style={{ display: 'flex', flexDirection: 'column' }}>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(item.key);
                      if (hasChildren && !isCollapsed) {
                        setExpandedKeys(prev => ({ ...prev, [item.key]: true }));
                      }
                    }}
                    title={isCollapsed ? item.label : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      gap: '10px',
                      padding: isCollapsed ? '10px 0' : '9px 12px',
                      borderRadius: '12px',
                      background: item.isExactActive ? '#1A1A1A' : 'transparent',
                      color: item.isActive ? '#FFFFFF' : '#9A9A9A',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: item.isExactActive ? 600 : item.isActive ? 500 : 400,
                      textTransform: 'lowercase',
                      transition: 'all 0.15s ease',
                      width: '100%'
                    }}
                    onMouseEnter={(e) => {
                      if (!item.isExactActive) {
                        e.currentTarget.style.background = '#141414';
                        e.currentTarget.style.color = '#FFFFFF';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!item.isExactActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = item.isActive ? '#FFFFFF' : '#9A9A9A';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <Icon size={17} strokeWidth={item.isActive ? 2.2 : 1.6} style={{ flexShrink: 0 }} />
                      {!isCollapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
                    </div>

                    {!isCollapsed && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {item.count !== null && item.count !== undefined && item.count > 0 && (
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

                        {hasChildren && (
                          <span
                            role="button"
                            aria-label={`Toggle ${item.label} submenu`}
                            onClick={(e) => toggleExpand(item.key, e)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#8C8C8C',
                              padding: '2px',
                              transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                            }}
                          >
                            <ChevronDown size={14} />
                          </span>
                        )}
                      </div>
                    )}
                  </button>

                  {/* SUBMENU ITEMS */}
                  {!isCollapsed && hasChildren && isExpanded && (
                    <div 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '2px', 
                        margin: '2px 0 4px',
                        paddingLeft: '14px',
                        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
                        marginLeft: '18px'
                      }}
                    >
                      {item.children.map(child => (
                        <button
                          key={child.key}
                          type="button"
                          onClick={() => onNavigate(child.key)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            background: child.isActive ? '#1E1E1E' : 'transparent',
                            color: child.isActive ? '#FFFFFF' : '#8C8C8C',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: child.isActive ? 600 : 400,
                            textTransform: 'lowercase',
                            transition: 'all 0.15s ease',
                            width: '100%',
                            textAlign: 'left'
                          }}
                          onMouseEnter={(e) => {
                            if (!child.isActive) {
                              e.currentTarget.style.background = '#141414';
                              e.currentTarget.style.color = '#FFFFFF';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!child.isActive) {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = '#8C8C8C';
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <span 
                              style={{
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                background: child.isActive ? '#FFFFFF' : '#555555',
                                flexShrink: 0
                              }} 
                            />
                            <span>{child.label}</span>
                          </div>

                          {child.count !== null && child.count !== undefined && child.count > 0 && (
                            <span 
                              style={{ 
                                fontSize: '10px', 
                                fontWeight: 600, 
                                background: '#222222', 
                                color: '#A0A0A0', 
                                padding: '1px 6px', 
                                borderRadius: '999px',
                                minWidth: '16px',
                                textAlign: 'center'
                              }}
                            >
                              {child.count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
