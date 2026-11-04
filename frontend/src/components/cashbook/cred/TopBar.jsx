import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, Sun, Moon, LogOut, Check, X, Banknote, User
} from 'lucide-react';
import api from '../../../api';

const TopBar = ({
  currentUser = null,
  onSearchClick = null,
  onNotificationClick = null,
  onProfileClick = null,
  onLogout = null,
  isDarkMode = false,
  onToggleTheme = null,
  unreadCount: propUnreadCount = 0,
  avatarUrl = null,
  className = '',
  style = {}
}) => {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const userInitials = (currentUser?.username || currentUser?.email || 'AS').slice(0, 2).toUpperCase();
  const displayName = currentUser?.first_name
    ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim()
    : (currentUser?.username ? (currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1)) : 'User');
  const displayRole = (currentUser?.role === 'Admin' || currentUser?.is_admin || currentUser?.is_superuser)
    ? 'Super User'
    : (currentUser?.role || 'Staff User');

  const fetchNotifications = useCallback(async () => {
    try {
      setNotifLoading(true);
      const res = await api.get('notifications/', { params: { page_size: 20 } });
      const data = res.data?.results || res.data || [];
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      // non-critical
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const unreadCount = notifications.length > 0
    ? notifications.filter(n => !n.is_read).length
    : propUnreadCount;

  const handleMarkAllRead = async () => {
    try {
      await api.post('notifications/mark_all_read/');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {}
  };

  const handleApproveEntry = async (notification) => {
    const entryId = notification.action_data?.entry_id;
    if (!entryId) return;
    setApprovingId(notification.id);
    try {
      await api.post(`cashbook-entries/${entryId}/approve/`);
      await api.post(`notifications/${notification.id}/mark_read/`);
      setNotifications(prev => prev.map(n =>
        n.id === notification.id ? { ...n, is_read: true, action_taken: 'approved' } : n
      ));
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectEntry = async (notification) => {
    const entryId = notification.action_data?.entry_id;
    if (!entryId) return;
    setApprovingId(notification.id);
    try {
      await api.post(`cashbook-entries/${entryId}/reject/`);
      await api.post(`notifications/${notification.id}/mark_read/`);
      setNotifications(prev => prev.map(n =>
        n.id === notification.id ? { ...n, is_read: true, action_taken: 'rejected' } : n
      ));
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setApprovingId(null);
    }
  };

  const formatNotifTime = (timestamp) => {
    if (!timestamp) return '';
    const diff = (Date.now() - new Date(timestamp)) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const handleAvatarClick = (e) => {
    if (typeof onProfileClick === 'function' && onProfileClick.length > 0) {
      onProfileClick(e);
    } else {
      setShowProfile(prev => !prev);
      setShowNotifications(false);
    }
  };

  const handleBellClick = (e) => {
    if (typeof onNotificationClick === 'function' && onNotificationClick.length > 0) {
      onNotificationClick(e);
    } else {
      setShowNotifications(prev => {
        const next = !prev;
        if (next) fetchNotifications();
        return next;
      });
      setShowProfile(false);
    }
  };

  const handleLogoutClick = () => {
    setShowProfile(false);
    if (typeof onLogout === 'function') {
      onLogout();
    } else {
      localStorage.clear();
      window.location.href = '/login';
    }
  };

  return (
    <header className={`cred-topbar ${className}`} style={{ ...style, position: 'relative' }}>
      {/* 1. Left Avatar with Thin Ring and Red Dot */}
      <div ref={profileRef} style={{ position: 'relative' }}>
        <div 
          className="cred-avatar-wrap" 
          onClick={handleAvatarClick}
          role="button"
          tabIndex={0}
          aria-label="Profile"
          style={{ cursor: 'pointer' }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="User Avatar" className="cred-avatar" />
          ) : (
            <div className="cred-avatar">{userInitials}</div>
          )}
          <span className="cred-avatar-dot" />
        </div>

        {/* User Profile Dropdown / Card */}
        {showProfile && (
          <div 
            className="cred-profile-dropdown"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              width: '260px',
              maxWidth: '85vw',
              background: isDarkMode ? '#121417' : '#FFFFFF',
              border: isDarkMode ? '1px solid #232528' : '1px solid #E5E7EB',
              borderRadius: '16px',
              boxShadow: isDarkMode ? '0 16px 40px rgba(0,0,0,0.8)' : '0 12px 32px rgba(0,0,0,0.12)',
              padding: '12px',
              zIndex: 9999,
              animation: 'credTopBarFadeDown 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Header / Info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              paddingBottom: '10px',
              marginBottom: '8px',
              borderBottom: isDarkMode ? '1px solid #232528' : '1px solid #F1F5F9'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: isDarkMode ? '#232528' : '#0A0A0A',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px',
                flexShrink: 0
              }}>
                {userInitials}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: isDarkMode ? '#F4F4F5' : '#0A0A0A',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {displayName}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted, #8C8C8C)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {currentUser?.email || displayRole}
                </div>
              </div>
            </div>

            {/* Sign Out Button */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button
                type="button"
                onClick={handleLogoutClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: 'none',
                  border: 'none',
                  color: '#DC2626',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(220, 38, 38, 0.1)' : '#FEF2F2'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Theme Toggle, Search and Notifications */}
      <div className="cred-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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



        {/* Notifications Button & Dropdown */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="cred-icon-btn"
            onClick={handleBellClick}
            aria-label="Notifications"
          >
            <Bell size={18} strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span className="cred-badge-num">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>

          {showNotifications && (
            <div 
              className="cred-notifications-dropdown"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '320px',
                maxWidth: '90vw',
                maxHeight: '440px',
                overflowY: 'auto',
                background: isDarkMode ? '#121417' : '#FFFFFF',
                border: isDarkMode ? '1px solid #232528' : '1px solid #E5E7EB',
                borderRadius: '16px',
                boxShadow: isDarkMode ? '0 16px 40px rgba(0,0,0,0.8)' : '0 12px 32px rgba(0,0,0,0.12)',
                zIndex: 9999,
                animation: 'credTopBarFadeDown 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px 10px',
                borderBottom: isDarkMode ? '1px solid #232528' : '1px solid #F1F5F9',
                position: 'sticky',
                top: 0,
                background: isDarkMode ? '#121417' : '#FFFFFF',
                zIndex: 1
              }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: isDarkMode ? '#F4F4F5' : '#0A0A0A' }}>
                  Notifications
                  {unreadCount > 0 && (
                    <span style={{
                      background: '#EF4444',
                      color: '#FFFFFF',
                      borderRadius: '999px',
                      fontSize: '10.5px',
                      padding: '1px 6px',
                      marginLeft: '6px',
                      fontWeight: 700
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '11.5px',
                      color: 'var(--primary, #5B4BDB)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: 0
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Items List */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {notifLoading && notifications.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '12.5px', color: 'var(--text-muted, #8C8C8C)' }}>
                    Loading notifications…
                  </div>
                ) : notifications.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: '12.5px', color: 'var(--text-muted, #8C8C8C)' }}>
                    <Bell size={24} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                    No notifications yet
                  </div>
                ) : (
                  notifications.map(notif => {
                    const isPettyCash = notif.notification_type === 'petty_cash_approval';
                    const isPending = !notif.action_taken || notif.action_taken === 'pending';
                    const isApproving = approvingId === notif.id;

                    return (
                      <div 
                        key={notif.id}
                        style={{
                          padding: '10px 14px',
                          borderBottom: isDarkMode ? '1px solid #1A1C20' : '1px solid #F1F5F9',
                          background: notif.is_read ? 'transparent' : (isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.05)'),
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isPettyCash ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: isPettyCash ? '#F59E0B' : '#3B82F6'
                          }}>
                            {isPettyCash ? <Banknote size={14} /> : <Bell size={14} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 600,
                              fontSize: '12px',
                              color: isDarkMode ? '#F4F4F5' : '#0A0A0A',
                              marginBottom: '2px'
                            }}>
                              {notif.title}
                            </div>
                            <div style={{
                              fontSize: '11.5px',
                              lineHeight: 1.4,
                              color: 'var(--text-muted, #8C8C8C)',
                              marginBottom: '4px'
                            }}>
                              {notif.message}
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted, #8C8C8C)' }}>
                              {formatNotifTime(notif.created_at)}
                            </div>

                            {/* Approval actions if petty cash request */}
                            {isPettyCash && isPending && !notif.is_read && (
                              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                <button
                                  type="button"
                                  disabled={isApproving}
                                  onClick={() => handleApproveEntry(notif)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: '#10B981',
                                    color: '#FFFFFF',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: isApproving ? 'wait' : 'pointer'
                                  }}
                                >
                                  <Check size={11} /> OK
                                </button>
                                <button
                                  type="button"
                                  disabled={isApproving}
                                  onClick={() => handleRejectEntry(notif)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #FECACA',
                                    background: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                                    color: '#EF4444',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: isApproving ? 'wait' : 'pointer'
                                  }}
                                >
                                  <X size={11} /> Reject
                                </button>
                              </div>
                            )}
                            {isPettyCash && notif.action_taken === 'approved' && (
                              <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                                ✓ Approved
                              </span>
                            )}
                            {isPettyCash && notif.action_taken === 'rejected' && (
                              <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                                ✗ Rejected
                              </span>
                            )}
                          </div>
                          {!notif.is_read && (
                            <div style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: '#3B82F6',
                              flexShrink: 0,
                              marginTop: '4px'
                            }} />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes credTopBarFadeDown {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </header>
  );
};

export default TopBar;
