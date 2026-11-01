import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToWords } from './numberToWords.js';

export { numberToWords };

/**
 * Format currency amount with commas and 2 decimals
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount) || amount === '') return 'SAR 0.00';
  return 'SAR ' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Universal Table Export to PDF
 */
export function exportTableToPdf({
  title = 'CASHBOOK REPORT',
  subtitle = '',
  columns = [],
  rows = [],
  totals = null,
  filename = 'report.pdf',
  orientation = 'portrait',
  columnStyles = {}
}) {
  const doc = new jsPDF({
    orientation,
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36; // 0.5 in

  // Header Background bar - Slate 900
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 54, 'F');

  // Amber accent strip below header bar
  doc.setFillColor(245, 158, 11); // amber-500
  doc.rect(0, 54, pageWidth, 3, 'F');

  // Brand Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('ARAB SEASON CONTRACTING & ERP', margin, 24);

  // System Label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text('Financial & Cashbook Management System', margin, 38);

  // Date and Time Stamp on top right
  const nowStr = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Generated: ${nowStr}`, pageWidth - margin, 24, { align: 'right' });
  doc.setTextColor(203, 213, 225);
  doc.text('Confidential Internal Report', pageWidth - margin, 38, { align: 'right' });

  // Report Title & Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(title.toUpperCase(), margin, 80);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(subtitle, margin, 94);
  }

  const startY = subtitle ? 104 : 90;

  // Normalize columns: can be array of strings ['DATE', 'NAME'] or array of objects [{ header: 'DATE', dataKey: 'date' }]
  let headRows = [];
  let keys = [];
  if (columns.length > 0 && typeof columns[0] === 'object' && columns[0] !== null) {
    headRows = [columns.map(c => c.header || c.title || c.label || '')];
    keys = columns.map(c => c.dataKey || c.key || c.id || '');
  } else {
    headRows = [columns];
  }

  // Normalize rows: can be array of arrays or array of objects
  let tableBody = [];
  if (rows.length > 0 && !Array.isArray(rows[0]) && typeof rows[0] === 'object' && rows[0] !== null) {
    tableBody = rows.map(r => {
      if (keys.length > 0) {
        return keys.map(k => r[k] !== undefined && r[k] !== null ? String(r[k]) : '');
      }
      return Object.values(r).map(v => v !== undefined && v !== null ? String(v) : '');
    });
  } else {
    tableBody = rows.map(r => Array.isArray(r) ? r.map(c => c !== undefined && c !== null ? String(c) : '') : [String(r)]);
  }

  // Normalize totals: can be array or object
  if (totals) {
    if (Array.isArray(totals)) {
      tableBody.push(totals.map(c => c !== undefined && c !== null ? String(c) : ''));
    } else if (typeof totals === 'object') {
      if (keys.length > 0) {
        tableBody.push(keys.map(k => totals[k] !== undefined && totals[k] !== null ? String(totals[k]) : ''));
      } else {
        tableBody.push(Object.values(totals).map(v => v !== undefined && v !== null ? String(v) : ''));
      }
    }
  }

  autoTable(doc, {
    startY,
    head: headRows,
    body: tableBody,
    margin: { left: margin, right: margin, bottom: 45 },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 4.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 8.5
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // slate-50
    },
    columnStyles: columnStyles || {},
    didParseCell: (data) => {
      // Highlight Totals row if provided
      if (totals && data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [15, 23, 42];
      }
    },
    didDrawPage: () => {
      // Footer on every page
      const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
      const totalPages = doc.internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);

      // Line above footer
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);

      doc.text('Arab Season Contracting • Cashbook Module', margin, pageHeight - 18);
      doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, pageHeight - 18, { align: 'right' });
    }
  });

  // Open in new window or save
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, '_blank');
  if (!win) {
    doc.save(filename);
  }
  return blobUrl;
}

/**
 * Universal Payment Voucher & Disbursement Receipt with Official Signature Box
 * Used for Vendor Payments, Labour Wages, Cash Expenses, and Petty Cash Disbursements.
 */
export function printPaymentVoucher({
  voucherType = 'PAYMENT VOUCHER',
  voucherNo = '',
  date = '',
  payeeName = '',
  payeeRole = 'Vendor / Payee',
  payeePhone = '',
  payeeId = '',
  amount = 0,
  paymentMode = 'Cash',
  referenceNo = '',
  jobOrder = '',
  accountName = 'Cash in Hand (Main)',
  category = '',
  description = '',
  particulars = [],
  preparedBy = 'Accountant',
  approvedBy = 'Project Manager / Director',
  notes = '',
  downloadOnly = false,
  filename = ''
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - (margin * 2);

  // Outer Border
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(1.5);
  doc.roundedRect(margin - 6, margin - 6, contentWidth + 12, pageHeight - (margin * 2) + 12, 4, 4);

  // Inner Thin Border
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin - 3, margin - 3, contentWidth + 6, pageHeight - (margin * 2) + 6, 2, 2);

  // Top Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, margin, contentWidth, 58, 3, 3, 'F');

  // Amber accent line
  doc.setFillColor(245, 158, 11);
  doc.rect(margin, margin + 56, contentWidth, 2, 'F');

  // Company Branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('ARAB SEASON CONTRACTING EST.', margin + 14, margin + 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text('General Contracting • Maintenance • Operations • ERP Cashbook', margin + 14, margin + 36);
  doc.text('Kingdom of Saudi Arabia | CR: 1010XXXXXX', margin + 14, margin + 48);

  // Voucher Badge / Type on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text(String(voucherType).toUpperCase(), pageWidth - margin - 14, margin + 24, { align: 'right' });

  const generatedNo = voucherNo || `VCH-${Date.now().toString().slice(-6)}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`NO: ${generatedNo}`, pageWidth - margin - 14, margin + 42, { align: 'right' });

  let curY = margin + 70;

  // Metadata Grid Box (2 columns)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, curY, contentWidth, 54, 3, 3, 'FD');

  const col1X = margin + 12;
  const col2X = margin + (contentWidth / 2) + 12;

  const dateFormatted = date 
    ? new Date(date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) 
    : new Date().toLocaleDateString('en-US', { dateStyle: 'medium' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('DATE & TIME:', col1X, curY + 16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(dateFormatted, col1X + 70, curY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('PAYMENT MODE:', col1X, curY + 32);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(String(paymentMode || 'Cash').toUpperCase(), col1X + 85, curY + 32);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('ACCOUNT / BOOK:', col1X, curY + 46);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(accountName || 'Cash in Hand (Main)', col1X + 90, curY + 46);

  // Col 2
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('REFERENCE NO:', col2X, curY + 16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(referenceNo || '---', col2X + 80, curY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('JOB / PROJECT:', col2X, curY + 32);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(jobOrder || 'General Project Work', col2X + 75, curY + 32);

  if (category) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('CATEGORY:', col2X, curY + 46);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(category, col2X + 60, curY + 46);
  }

  curY += 64;

  // Payee / Beneficiary Section
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, curY, contentWidth, 40, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`PAID TO (${payeeRole || 'BENEFICIARY'}):`, col1X, curY + 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(payeeName || 'N/A', col1X + 130, curY + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const contactText = [
    payeePhone ? `Phone: ${payeePhone}` : '',
    payeeId ? `National ID / Iqama: ${payeeId}` : ''
  ].filter(Boolean).join('     ');

  if (contactText) {
    doc.text(contactText, col1X, curY + 30);
  } else {
    doc.text('Identity Verified & Recorded in Cashbook', col1X, curY + 30);
  }

  curY += 48;

  // Amount Highlight Box
  doc.setFillColor(254, 243, 199); // amber-100
  doc.setDrawColor(245, 158, 11); // amber-500
  doc.setLineWidth(1);
  doc.roundedRect(margin, curY, contentWidth, 48, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text('AMOUNT DISBURSED / PAID:', col1X, curY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(amount), pageWidth - margin - 14, curY + 22, { align: 'right' });

  // Amount in words
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(8);
  doc.setTextColor(120, 53, 15);
  doc.text(`In Words: ${numberToWords(amount)}`, col1X, curY + 36);

  curY += 58;

  // Particulars / Description Table
  const tableData = [];
  if (particulars && particulars.length > 0) {
    particulars.forEach(p => {
      tableData.push([
        p.item || description || 'Payment disbursement',
        p.qty || '1',
        p.rate ? formatCurrency(p.rate) : formatCurrency(p.amount || amount),
        formatCurrency(p.amount || amount)
      ]);
    });
  } else {
    tableData.push([
      description || `Payment disbursement for ${category || 'services rendered / materials supplied'}.`,
      '1',
      formatCurrency(amount),
      formatCurrency(amount)
    ]);
  }

  autoTable(doc, {
    startY: curY,
    head: [['Particulars / Description', 'Qty / Days', 'Unit Rate', 'Total Amount']],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 5.5,
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.55 },
      1: { cellWidth: contentWidth * 0.15, halign: 'center' },
      2: { cellWidth: contentWidth * 0.15, halign: 'right' },
      3: { cellWidth: contentWidth * 0.15, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalY = doc.lastAutoTable.finalY + 12;

  // Notes if any
  if (notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Remarks / Special Terms: ${notes}`, margin + 5, finalY);
  }

  // -------------------------------------------------------------
  // FORMAL SIGNATURE & STAMP BLOCK (3 COLUMNS)
  // -------------------------------------------------------------
  const sigBoxY = Math.max(finalY + 14, pageHeight - margin - 135);
  const sigBoxHeight = 100;
  const colWidth = (contentWidth - 20) / 3;

  // Box 1: Prepared By
  const box1X = margin;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(box1X, sigBoxY, colWidth, sigBoxHeight, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('1. PREPARED BY', box1X + 8, sigBoxY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(preparedBy || 'Cashier / Accountant', box1X + 8, sigBoxY + 26);

  doc.setDrawColor(226, 232, 240);
  doc.line(box1X + 8, sigBoxY + 68, box1X + colWidth - 8, sigBoxY + 68);
  doc.text('Signature & Date', box1X + 8, sigBoxY + 80);

  // Box 2: Approved By
  const box2X = box1X + colWidth + 10;
  doc.roundedRect(box2X, sigBoxY, colWidth, sigBoxHeight, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('2. APPROVED BY', box2X + 8, sigBoxY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(approvedBy || 'Project Manager / Director', box2X + 8, sigBoxY + 26);

  doc.setDrawColor(226, 232, 240);
  doc.line(box2X + 8, sigBoxY + 68, box2X + colWidth - 8, sigBoxY + 68);
  doc.text('Signature & Approval Stamp', box2X + 8, sigBoxY + 80);

  // Box 3: Receiver's Acknowledgment
  const box3X = box2X + colWidth + 10;
  doc.setDrawColor(245, 158, 11); // highlighted in amber
  doc.setFillColor(255, 251, 235); // amber-50
  doc.roundedRect(box3X, sigBoxY, colWidth, sigBoxHeight, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 83, 9);
  doc.text("3. RECEIVER'S SIGNATURE", box3X + 8, sigBoxY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(146, 64, 14);
  doc.text('Payment received in full without dispute.', box3X + 8, sigBoxY + 25);

  doc.setDrawColor(217, 119, 6);
  doc.line(box3X + 8, sigBoxY + 65, box3X + colWidth - 8, sigBoxY + 65);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Sign / Thumbprint / Stamp', box3X + 8, sigBoxY + 76);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Date Received: ____________', box3X + 8, sigBoxY + 90);

  // Bottom Notice
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Original signed document must be retained in financial records archive.', margin, pageHeight - margin + 8);
  doc.text('Arab Season ERP Financial Management System', pageWidth - margin, pageHeight - margin + 8, { align: 'right' });

  if (downloadOnly) {
    const outName = filename || `${generatedNo}.pdf`;
    doc.save(outName);
    return { doc, filename: outName };
  }

  // Open in browser print dialog directly
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
  return { doc, blobUrl };
}
