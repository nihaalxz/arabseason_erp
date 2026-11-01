import React from 'react';
import { Receipt, Printer } from 'lucide-react';

export default function VoucherPrintBtn({
  onClick,
  title = 'Print Payment Voucher / Slip',
  isDarkMode = false,
  variant = 'icon', // 'icon' | 'button' | 'badge'
  label = 'Voucher',
  style = {}
}) {
  const handleClick = (e) => {
    e?.stopPropagation?.();
    onClick?.(e);
  };

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={title}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: '600',
          border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e2e8f0',
          background: isDarkMode ? '#27272a' : '#f8fafc',
          color: isDarkMode ? '#fbbf24' : '#b45309',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
          ...style
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = isDarkMode ? '#eab308' : '#f59e0b';
          e.currentTarget.style.background = isDarkMode ? '#3f3f46' : '#fef3c7';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = isDarkMode ? '#3f3f46' : '#e2e8f0';
          e.currentTarget.style.background = isDarkMode ? '#27272a' : '#f8fafc';
        }}
      >
        <Receipt size={13} style={{ flexShrink: 0 }} />
        <span>{label}</span>
      </button>
    );
  }

  // Default: sleek table action icon button
  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '7px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDarkMode ? 'rgba(251, 191, 36, 0.12)' : '#fef3c7',
        border: isDarkMode ? '1px solid rgba(251, 191, 36, 0.25)' : '1px solid #fde68a',
        color: isDarkMode ? '#fbbf24' : '#b45309',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        padding: 0,
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.08)';
        e.currentTarget.style.background = isDarkMode ? 'rgba(251, 191, 36, 0.22)' : '#fde68a';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.background = isDarkMode ? 'rgba(251, 191, 36, 0.12)' : '#fef3c7';
      }}
    >
      <Receipt size={14} />
    </button>
  );
}
