import React from 'react';
import { Printer } from 'lucide-react';
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
  label = 'export pdf',
  onClick,
  className = '',
  style = {}
}) {
  const handleExport = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (onClick) { onClick(e); return; }
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

  const mutedColor = isDarkMode ? '#71717a' : '#8c8c8c';
  const hoverColor = isDarkMode ? '#e4e4e7' : '#0a0a0a';

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
        background: 'transparent',
        border: 'none',
        padding: 0,
        fontSize: '13px',
        fontWeight: '500',
        color: mutedColor,
        cursor: 'pointer',
        textTransform: 'lowercase',
        transition: 'color 0.15s ease',
        outline: 'none',
        whiteSpace: 'nowrap',
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = hoverColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = mutedColor;
      }}
    >
      <Printer size={16} style={{ flexShrink: 0 }} />
      <span>{label}</span>
    </button>
  );
}
