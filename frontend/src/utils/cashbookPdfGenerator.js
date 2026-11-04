/**
 * Server-Sided Cashbook PDF Generator Bridge
 * Routes all PDF generation to the Django UniversalPDFGenerator backend (pdf_generator.py),
 * matching the exact publication layout of timesheet_nihaal_sep_2026.pdf:
 * - Branded Corporate Header with Arab Season Logo & CR/VAT details
 * - Navy #0f172a Title Banner with dynamic Ref Code & Period
 * - 4-5 Card KPI Summary block
 * - Publication-grade Table with alternating rows & accounting alignment
 * - Standardized 3-Column Verification & Signature Block
 * - Two-pass NumberedCanvas with confidential notice & outer border
 */

import api from '../api';
import { handlePdfResponse } from './pdfDownload';
import { numberToWords } from './numberToWords.js';
import { showError } from './swal';

export { numberToWords };

/**
 * Format currency amount with commas and 2 decimals
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount) || amount === '') return 'SAR 0.00';
  return 'SAR ' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Server-Sided Table Report Export
 * POSTs filtered table dataset to Django server for ReportLab compilation
 */
export async function exportTableToPdf({
  title = 'CASHBOOK REPORT',
  subtitle = '',
  columns = [],
  rows = [],
  totals = null,
  kpis = null,
  filename = 'report.pdf',
  fileName = null,
  orientation = 'portrait',
  filenamePrefix = 'cashbook_report'
}) {
  const fallbackFilename = fileName || filename || 'cashbook_report.pdf';
  try {
    const payload = {
      title,
      period_text: subtitle,
      columns,
      rows,
      totals,
      kpis,
      filename_prefix: filenamePrefix,
      orientation
    };

    const res = await api.post('cashbook/export-table-pdf/', payload, { responseType: 'blob' });
    handlePdfResponse(res, fallbackFilename);
    return true;
  } catch (err) {
    console.error('Failed to generate server-side table report PDF:', err);
    let serverMessage = err.message || 'Unknown network error';
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        try {
          const json = JSON.parse(text);
          serverMessage = json.detail || json.error || text;
        } catch (_) {
          serverMessage = text.slice(0, 300);
        }
      } catch (_) {}
    } else if (err.response?.data) {
      const d = err.response.data;
      serverMessage = typeof d === 'object' ? (d.detail || d.error || JSON.stringify(d)) : String(d);
    }
    const statusPrefix = err.response?.status ? `[HTTP ${err.response.status}] ` : '';
    await showError('PDF Export Failed', `Failed to generate PDF report from server: ${statusPrefix}${serverMessage}`);
    throw err;
  }
}

/**
 * Server-Sided Official Payment / Receipt / Agreement Voucher
 * POSTs voucher payload to Django server for ReportLab compilation
 */
export async function printPaymentVoucher(voucherData) {
  if (!voucherData) return;
  const vType = (voucherData.voucherType || 'voucher').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const vNo = (voucherData.voucherNo || 'vch').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const fallbackFilename = `${vType}_${vNo}_${new Date().toISOString().slice(0, 10)}.pdf`;

  try {
    const res = await api.post('cashbook/voucher-pdf/', voucherData, { responseType: 'blob' });
    handlePdfResponse(res, fallbackFilename);
    return true;
  } catch (err) {
    console.error('Failed to generate server-side payment voucher PDF:', err);
    let serverMessage = err.message || 'Unknown network error';
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        try {
          const json = JSON.parse(text);
          serverMessage = json.detail || json.error || text;
        } catch (_) {
          serverMessage = text.slice(0, 300);
        }
      } catch (_) {}
    } else if (err.response?.data) {
      const d = err.response.data;
      serverMessage = typeof d === 'object' ? (d.detail || d.error || JSON.stringify(d)) : String(d);
    }
    const statusPrefix = err.response?.status ? `[HTTP ${err.response.status}] ` : '';
    await showError('Voucher Export Failed', `Failed to generate voucher PDF from server: ${statusPrefix}${serverMessage}`);
    throw err;
  }
}
