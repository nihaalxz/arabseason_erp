import React from 'react';
import { Home, BookOpen, Plus, LayoutDashboard, LayoutGrid } from 'lucide-react';

const BottomNav = ({
  activeDestination = 'HOME', // 'HOME' | 'BOOKS' | 'OVERVIEW' | 'MORE'
  onSelectDestination,
  onQuickAdd,
  booksCount = null,
  moreBadge = null,
  className = '',
  style = {}
}) => {
  return (
    <nav className={`cred-bottom-nav ${className}`} style={style} aria-label="Bottom Navigation">
      {/* 1. HOME */}
      <button
        type="button"
        className={`cred-nav-item ${activeDestination === 'HOME' ? 'active' : ''}`}
        onClick={() => onSelectDestination('HOME')}
        aria-label="Home"
      >
        <Home size={22} strokeWidth={1.5} />
        <span className="cred-nav-label">HOME</span>
      </button>

      {/* 2. OVERVIEW */}
      <button
        type="button"
        className={`cred-nav-item ${activeDestination === 'OVERVIEW' ? 'active' : ''}`}
        onClick={() => onSelectDestination('OVERVIEW')}
        aria-label="Overview"
      >
        <LayoutDashboard size={22} strokeWidth={1.5} />
        <span className="cred-nav-label">OVERVIEW</span>
      </button>

      {/* 3. CENTER FLOATING "+" ACTION BUTTON */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          type="button"
          className="cred-fab-center"
          onClick={onQuickAdd}
          aria-label="Quick Action: Cash In, Cash Out, Transfer"
          title="Quick Action"
        >
          <Plus size={28} strokeWidth={2} />
        </button>
      </div>

      {/* 4. BOOKS */}
      <button
        type="button"
        className={`cred-nav-item ${activeDestination === 'BOOKS' ? 'active' : ''}`}
        onClick={() => onSelectDestination('BOOKS')}
        aria-label="Books"
      >
        <div style={{ position: 'relative' }}>
          <BookOpen size={22} strokeWidth={1.5} />
          {booksCount !== null && booksCount !== undefined && booksCount > 0 && (
            <span className="cred-badge-num" style={{ top: -4, right: -8, minWidth: 14, height: 14, fontSize: '9px' }}>
              {booksCount}
            </span>
          )}
        </div>
        <span className="cred-nav-label">BOOKS</span>
      </button>

      {/* 5. MORE */}
      <button
        type="button"
        className={`cred-nav-item ${activeDestination === 'MORE' ? 'active' : ''}`}
        onClick={() => onSelectDestination('MORE')}
        aria-label="More"
      >
        <div style={{ position: 'relative' }}>
          <LayoutGrid size={22} strokeWidth={1.5} />
          {moreBadge && (
            <span className="cred-badge-num" style={{ top: -4, right: -8, minWidth: 14, height: 14, fontSize: '9px' }}>
              {moreBadge}
            </span>
          )}
        </div>
        <span className="cred-nav-label">MORE</span>
      </button>
    </nav>
  );
};

export default BottomNav;
