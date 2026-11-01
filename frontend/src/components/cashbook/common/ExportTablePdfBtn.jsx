import React from 'react';
import { FileText } from 'lucide-react';
import { exportTableToPdf } from '../../../utils/cashbookPdfGenerator';

export default function ExportTablePdfBtn({
  title,
  subtitle,
  columns,
  rows,
  totals,
  filename,
  orientation = 'portrait',
  columnStyles,
  isDarkMode = false,
  label = 'Export PDF',
  className = '',
  style = {}
}) {
  const handleExport = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (!columns || !columns.length || !rows) {
      alert('No data available to export.');
      return;
    }
    try {
      exportTableToPdf({
        title,
        subtitle,
        columns,
        rows,
        totals,
        filename: filename || `${(title || 'report').toLowerCase().replace(/\s+/g, '_')}.pdf`,
        orientation,
        columnStyles
      });
    } catch (err) {
      console.error('Failed to export table PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      title={label || 'Export Table as PDF'}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '600',
        border: isDarkMode ? '1px solid #27272a' : '1px solid #e2e8f0',
        background: isDarkMode ? '#18181b' : '#ffffff',
        color: isDarkMode ? '#f4f4f5' : '#0f172a',
        boxShadow: isDarkMode ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = isDarkMode ? '#52525b' : '#cbd5e1';
        e.currentTarget.style.background = isDarkMode ? '#27272a' : '#f8fafc';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isDarkMode ? '#27272a' : '#e2e8f0';
        e.currentTarget.style.background = isDarkMode ? '#18181b' : '#ffffff';
      }}
    >
      <FileText size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
      <span>{label}</span>
    </button>
  );
}
