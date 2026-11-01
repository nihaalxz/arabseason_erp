import React from 'react';
import { X, Printer, Download, FileText, PenTool } from 'lucide-react';
import { printPaymentVoucher, formatCurrency, numberToWords } from '../../../utils/cashbookPdfGenerator';

export default function VoucherModal({ isOpen, onClose, voucherData, isDarkMode = false }) {
  if (!isOpen || !voucherData) return null;

  const {
    voucherType = 'PAYMENT VOUCHER',
    voucherNo = '',
    date = '',
    payeeName = 'Beneficiary',
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
    notes = ''
  } = voucherData;

  const handlePrint = () => {
    printPaymentVoucher({ ...voucherData, downloadOnly: false });
  };

  const handleDownload = () => {
    printPaymentVoucher({ ...voucherData, downloadOnly: true });
  };

  const cardBg = isDarkMode ? '#18181b' : '#ffffff';
  const borderCol = isDarkMode ? '#27272a' : '#e2e8f0';
  const textPri = isDarkMode ? '#f4f4f5' : '#0f172a';
  const textSec = isDarkMode ? '#a1a1aa' : '#64748b';
  const subBg = isDarkMode ? '#27272a' : '#f8fafc';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '680px',
          background: cardBg,
          border: `1px solid ${borderCol}`,
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: `1px solid ${borderCol}`,
            background: isDarkMode ? '#202024' : '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: textPri, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {voucherType} Preview
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: textSec }}>
                Official receipt voucher with vendor / labour signature & stamp area
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: textSec,
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Paper Sheet Preview Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
          
          {/* Metadata Grid Box */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              border: `1px solid ${borderCol}`,
              background: subBg,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px'
            }}
          >
            <div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: textSec, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                Payee / Beneficiary
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: textPri, display: 'block', marginTop: '2px' }}>
                {payeeName}
              </span>
              <span style={{ fontSize: '11px', color: textSec, display: 'block', marginTop: '2px' }}>
                {payeeRole} {payeePhone ? `• ${payeePhone}` : ''} {payeeId ? `• ID: ${payeeId}` : ''}
              </span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: textSec, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                Date & Payment Mode
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: textPri, display: 'block', marginTop: '2px' }}>
                {date ? new Date(date).toLocaleDateString('en-US', { dateStyle: 'medium' }) : new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}
              </span>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '4px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                  color: isDarkMode ? '#34d399' : '#15803d'
                }}
              >
                {paymentMode || 'Cash'}
              </span>
            </div>
          </div>

          {/* Amount Box */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              border: '2px solid rgba(245, 158, 11, 0.4)',
              background: isDarkMode ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: isDarkMode ? '#fbbf24' : '#b45309' }}>
                Total Amount Paid / Disbursed
              </span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: textPri }}>
                {formatCurrency(amount)}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', fontStyle: 'italic', color: isDarkMode ? '#fde68a' : '#92400e', marginTop: '4px' }}>
              *** {numberToWords(amount)} ***
            </p>
          </div>

          {/* Purpose & Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: textSec, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Particulars & Job Reference
            </span>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                border: `1px solid ${borderCol}`,
                background: cardBg,
                color: textPri
              }}
            >
              <p style={{ margin: 0, fontWeight: 500, fontSize: '13px' }}>
                {description || `Payment disbursement for ${category || 'services rendered / material supplies'}.`}
              </p>
              {jobOrder && (
                <div style={{ marginTop: '6px', fontSize: '11px', color: textSec, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 600, color: textPri }}>Job Order:</span> {jobOrder}
                </div>
              )}
              {referenceNo && (
                <div style={{ marginTop: '2px', fontSize: '11px', color: textSec, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 600, color: textPri }}>Reference:</span> {referenceNo}
                </div>
              )}
            </div>
          </div>

          {/* Signature Guarantee Box */}
          <div
            style={{
              padding: '12px',
              borderRadius: '12px',
              border: isDarkMode ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #bfdbfe',
              background: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            <PenTool size={16} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '11.5px', color: isDarkMode ? '#93c5fd' : '#1e40af', lineHeight: 1.5 }}>
              <strong>Signature Guarantee:</strong> The generated official PDF includes 3 dedicated signature blocks for <strong>Prepared By</strong>, <strong>Approved By</strong>, and a dedicated <strong>Receiver's Signature & Thumbprint</strong> box for physical receipt confirmation.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '12px 20px',
            borderTop: `1px solid ${borderCol}`,
            background: isDarkMode ? '#202024' : '#f8fafc'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              border: `1px solid ${borderCol}`,
              background: 'transparent',
              color: textSec,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              border: `1px solid ${borderCol}`,
              background: isDarkMode ? '#27272a' : '#ffffff',
              color: textPri,
              cursor: 'pointer'
            }}
          >
            <Download size={14} />
            <span>Download PDF</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <Printer size={14} />
            <span>Generate & Print Voucher</span>
          </button>
        </div>
      </div>
    </div>
  );
}
