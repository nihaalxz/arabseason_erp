import React from 'react';
import { Search, Bell, Sun, Moon } from 'lucide-react';

const TopBar = ({
  currentUser = null,
  onSearchClick = null,
  onNotificationClick = null,
  onProfileClick = null,
  isDarkMode = false,
  onToggleTheme = null,
  unreadCount = 0,
  avatarUrl = null,
  className = '',
  style = {}
}) => {
  const userInitials = (currentUser?.username || currentUser?.email || 'AS').slice(0, 2).toUpperCase();

  return (
    <header className={`cred-topbar ${className}`} style={style}>
      {/* 1. Left Avatar with Thin Ring and Red Dot (Keeps profile behavior, no theme toggle) */}
      <div 
        className="cred-avatar-wrap" 
        onClick={onProfileClick}
        role="button"
        tabIndex={0}
        aria-label="Profile"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="User Avatar" className="cred-avatar" />
        ) : (
          <div className="cred-avatar">{userInitials}</div>
        )}
        <span className="cred-avatar-dot" />
      </div>

      {/* 2. Theme Toggle, Search and Notifications */}
      <div className="cred-topbar-actions">
        {onToggleTheme && (
          <button
            type="button"
            className="cred-icon-btn"
            id="cred-mobile-theme-toggle"
            data-testid="cred-theme-toggle"
            onClick={onToggleTheme}
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
          </button>
        )}

        <button
          type="button"
          className="cred-icon-btn"
          onClick={onSearchClick}
          aria-label="Search"
        >
          <Search size={18} strokeWidth={1.5} />
        </button>

        <button
          type="button"
          className="cred-icon-btn"
          onClick={onNotificationClick}
          aria-label="Notifications"
        >
          <Bell size={18} strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span className="cred-badge-num">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
      </div>
    </header>
  );
};

export default TopBar;
