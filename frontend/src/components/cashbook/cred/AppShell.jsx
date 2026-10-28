import React, { useState, useEffect } from 'react';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import SideRail from './SideRail';
import CredTopStrip from './CredTopStrip';

const AppShell = ({
  isMobile = false,
  activeDestination = 'HOME',
  activeTab = 'ledger',
  onSelectDestination,
  onNavigate,
  onQuickAdd,
  onOpenCashIn,
  onOpenCashOut,
  onOpenTransfer,
  onRefresh = () => {},
  isRefreshing = false,
  isDarkMode = false,
  onToggleTheme = () => {},
  onOpenMembers = () => {},
  onOpenRecycleBin = () => {},
  recycleBinCount = 0,
  topBarProps = {},
  counts = {},
  booksCount = null,
  books = [],
  selectedBook = null,
  selectedBookId = null,
  onCreateBook,
  moreBadge = null,
  breadcrumb = null,
  children
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('cred_sidebar_collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });

  const handleToggleCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('cred_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  if (isMobile) {
    return (
      <div className="cred-shell-mobile cred-app-root">
        <div className="cred-shell-mobile-content">
          <TopBar {...topBarProps} />
          {children}
        </div>
        <BottomNav
          activeDestination={activeDestination}
          onSelectDestination={onSelectDestination}
          onQuickAdd={onQuickAdd}
          booksCount={booksCount}
          moreBadge={moreBadge}
        />
      </div>
    );
  }

  // Desktop layout: Fixed black Header (via DashboardLayout) + Fixed black Sidebar (240px/76px) + White content panel
  const sidebarWidth = isSidebarCollapsed ? 76 : 240;

  return (
    <div className="cred-shell-desktop cred-app-root" style={{ background: 'var(--black, #0A0A0A)', minHeight: 'calc(100vh - 50px)' }}>
      {/* Fixed Black Sidebar with all Cashbook & Manage items */}
      <SideRail
        activeTab={activeTab}
        onNavigate={onNavigate || onSelectDestination}
        onCreateBook={onCreateBook}
        books={books}
        selectedBook={selectedBook}
        selectedBookId={selectedBookId}
        counts={counts}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Scrollable White Content Panel with 28px rounded top-left corner */}
      <main 
        className="cred-shell-desktop-content"
        style={{
          marginLeft: `${sidebarWidth}px`,
          width: `calc(100% - ${sidebarWidth}px)`,
          minHeight: 'calc(100vh - 50px)',
          background: 'var(--bg)',
          borderTopLeftRadius: 'var(--radius-panel, 28px)',
          overflowY: 'auto',
          padding: '0 0 80px',
          boxSizing: 'border-box',
          transition: 'margin-left 0.2s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Task 1: Fixed top strip on every Cashbook page */}
        <CredTopStrip
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          isDarkMode={isDarkMode}
          onToggleTheme={onToggleTheme}
          onOpenMembers={onOpenMembers}
          onOpenRecycleBin={onOpenRecycleBin}
          recycleBinCount={recycleBinCount}
          breadcrumb={breadcrumb}
        />

        <div 
          className="cred-shell-desktop-container"
          style={{
            maxWidth: '1600px',
            margin: '0 auto',
            width: '100%',
            padding: '24px 32px 0',
            boxSizing: 'border-box'
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppShell;
