/**
 * Centralized Route Constants for Arab Season ERP
 * Single source of truth for all application routes.
 */

export const ROUTES = {
  // ERP Operations
  ERP_DASHBOARD: '/',
  ENQUIRIES: '/enquiries',
  JOBS: '/jobs',
  PLANNING: '/jobs?tab=planning',
  DELIVERY_NOTES: '/delivery-notes',
  DELIVERY_NOTES_NEW: '/delivery-notes/new',
  DELIVERY_NOTE_EDIT: (id) => `/delivery-notes/${id}/edit`,

  // Accounting & Books
  ACCOUNTING_DASHBOARD: '/accounting',
  CUSTOMERS: '/accounting/customers',
  CUSTOMER_DETAIL: (id) => `/accounting/customers/${id}`,
  VENDORS: '/accounting/vendors',
  VENDOR_DETAIL: (id) => `/accounting/vendors/${id}`,
  ESTIMATIONS: '/accounting/estimations',
  ESTIMATIONS_NEW: '/accounting/estimations/new',
  ESTIMATION_EDIT: (id) => `/accounting/estimations/${id}/edit`,
  QUOTATIONS: '/accounting/quotations',
  QUOTATIONS_NEW: '/accounting/quotations/new',
  QUOTATION_EDIT: (id) => `/accounting/quotations/${id}/edit`,
  INVOICES: '/invoices',
  INVOICES_NEW: '/invoices/new',
  INVOICE_EDIT: (id) => `/invoices/${id}/edit`,
  CREDIT_NOTES: '/credit-notes',
  CREDIT_NOTES_NEW: '/credit-notes/new',
  CREDIT_NOTE_EDIT: (id) => `/credit-notes/${id}/edit`,
  PAYMENTS: '/payments',
  PAYMENT_REQUESTS: '/payment-requests',
  EXPENSES: '/expenses',
  BANKS: '/banks',
  REPORTS: '/reports',
  SALARY: '/salary',

  // Common & Admin
  SETTINGS: '/settings',
  USERS: '/users',
  SEARCH: '/search',
  RECYCLE_BIN: '/cashbook?tab=recycle_bin',
  CASHBOOK: '/cashbook'
}

export default ROUTES

