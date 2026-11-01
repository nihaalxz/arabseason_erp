import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, 
  Sun, 
  Moon, 
  Settings as LucideSettings, 
  Users, 
  Trash2 
} from 'lucide-react';

/**
 * CredTopStrip (Task 1)
 * Fixed top utility strip rendered ONCE by AppShell at the top of the desktop content panel.
 * Height: 56px
 * Sticky: top: 0; background: var(--bg); 1px bottom hairline; z-index: 30
 * Left: empty (reserved for breadcrumbs later)
 * Right: cluster of three circular 40px icon buttons (refresh, night mode, settings gear with popover)
 */
const CredTopStrip = ({
  onRefresh = () => {},
  isRefreshing = false,
  isDarkMode = false,
  onToggleTheme = () => {},
  onOpenMembers = () => {},
  onOpenRecycleBin = () => {},
  recycleBinCount = 0,
  breadcrumb = null,
  style = {}
}) => {
  const [isGearOpen, setIsGearOpen] = useState(false);
  const gearRef = useRef(null);

  // Close gear popover on outside click or Escape
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (gearRef.current && !gearRef.current.contains(e.target)) {
        setIsGearOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsGearOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header
      className="cred-top-strip"
      style={{
        position: 'sticky',
        top: 0,
        height: '56px',
        background: 'var(--bg, #FFFFFF)',
        borderBottom: '1px solid var(--border, #E4E4E4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        boxSizing: 'border-box',
        width: '100%',
        userSelect: 'none',
        ...style,
        zIndex: isGearOpen ? 800 : 200
      }}
    >
      {/* Left side: breadcrumb (e.g. back button + books / <book name>) or empty */}
      <div 
        className="cred-top-strip-left" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          minWidth: '1px' 
        }}
      >
        {breadcrumb}
      </div>

      {/* Right-aligned cluster of three circular 40px icon buttons */}
      <div 
        className="cred-top-strip-right"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px' 
        }}
      >
        {/* 1. Refresh Button */}
        <button
          type="button"
          id="cred-topstrip-refresh-btn"
          onClick={onRefresh}
          title="Refresh ledger"
          aria-label="Refresh ledger"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '1px solid var(--border, #E4E4E4)',
            background: 'var(--bg-panel, #FFFFFF)',
            color: 'var(--text, #0A0A0A)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isRefreshing ? 'wait' : 'pointer',
            transition: 'border-color 0.15s, background-color 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text, #0A0A0A)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border, #E4E4E4)'; }}
        >
          <RefreshCw 
            size={16} 
            strokeWidth={1.8} 
            style={{ 
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none' 
            }} 
          />
        </button>

        {/* 2. Theme Toggle Button (Sun/Moon, NOT the avatar!) */}
        <button
          type="button"
          id="cred-topstrip-theme-toggle"
          onClick={onToggleTheme}
          title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle color theme"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '1px solid var(--border, #E4E4E4)',
            background: 'var(--bg-panel, #FFFFFF)',
            color: 'var(--text, #0A0A0A)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.15s, background-color 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text, #0A0A0A)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border, #E4E4E4)'; }}
        >
          {isDarkMode ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}
        </button>

        {/* 3. Settings Gear Button */}
        <div style={{ position: 'relative', zIndex: isGearOpen ? 1000 : 'auto' }} ref={gearRef}>
          <button
            type="button"
            id="cred-topstrip-gear-btn"
            onClick={() => setIsGearOpen(prev => !prev)}
            aria-expanded={isGearOpen}
            aria-haspopup="true"
            title="Settings & Tools"
            aria-label="Settings and tools menu"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: isGearOpen ? '1px solid var(--text, #0A0A0A)' : '1px solid var(--border, #E4E4E4)',
              background: isGearOpen ? 'var(--bg-subtle, #F5F5F5)' : 'var(--bg-panel, #FFFFFF)',
              color: 'var(--text, #0A0A0A)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background-color 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text, #0A0A0A)'; }}
            onMouseLeave={(e) => { 
              if (!isGearOpen) e.currentTarget.style.borderColor = 'var(--border, #E4E4E4)'; 
            }}
          >
            <LucideSettings size={17} strokeWidth={1.8} />
          </button>

          {/* GEAR POPOVER CARD (20px RADIUS) */}
          {isGearOpen && (
            <div 
              className="cred-gear-popover"
              role="menu"
            >
              {/* Members & Permissions */}
              <button
                type="button"
                className="cred-gear-item"
                role="menuitem"
                onClick={() => {
                  setIsGearOpen(false);
                  onOpenMembers();
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Users size={15} strokeWidth={1.8} />
                  <span>members &amp; permissions</span>
                </div>
              </button>

              {/* Recycle Bin */}
              <button
                type="button"
                className="cred-gear-item"
                role="menuitem"
                onClick={() => {
                  setIsGearOpen(false);
                  onOpenRecycleBin();
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Trash2 size={15} strokeWidth={1.8} style={{ color: 'var(--danger, #E5482E)' }} />
                  <span>recycle bin</span>
                </div>

                {recycleBinCount !== null && recycleBinCount !== undefined && recycleBinCount > 0 && (
                  <span 
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: '999px',
                      background: 'rgba(229, 72, 46, 0.12)',
                      color: 'var(--danger, #E5482E)'
                    }}
                  >
                    {recycleBinCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default CredTopStrip;
