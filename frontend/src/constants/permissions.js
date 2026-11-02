0/**
 * Centralized Permission & Access Control Registry for Arab Season ERP
 */

export const PERMISSIONS = {
  // ── ERP Operations ──
  ERP_DASHBOARD: 'dashboard',
  ENQUIRIES: 'enquiries',
  JOB_ORDERS: 'jobs',
  PROJECT_PLANNING: 'planning',
  DELIVERY_NOTES: 'delivery_notes',
  ERP_SETTINGS: 'settings',

  // ── Accounting Module ──
  ACCOUNTING_DASHBOARD: 'accounting',
  CUSTOMERS: 'customers',
  VENDORS: 'vendors',
  ESTIMATIONS: 'estimations',
  QUOTATIONS: 'quotations',
  INVOICES: 'invoices',
  CREDIT_NOTES: 'credit_notes',
  SALARY: 'salary',
  REPORTS: 'reports',
  ACCOUNTING_SETTINGS: 'accounting_settings',

  // ── Cashbook Module ──
  CASHBOOK_SHELF: 'cashbook',
  EXPENSES: 'expenses',
  LABOUR: 'labour',
  BANKS: 'banks',
  RECYCLE_BIN: 'recycle_bin',
}

export const MODULE_PERMISSION_GROUPS = [
  {
    moduleId: 'erp',
    title: 'ERP Operations',
    description: 'Core CRM, Operations, Project Planning & Fulfillment',
    permissions: [
      { key: 'dashboard', label: 'ERP Dashboard', description: 'Access main ERP overview and activity', defaultRoute: '/' },
      { key: 'enquiries', label: 'Enquiries & CRM', description: 'Manage client inquiries, leads & RFQs', defaultRoute: '/enquiries' },
      { key: 'jobs', label: 'Job Orders', description: 'Create and track production job orders', defaultRoute: '/jobs' },
      { key: 'planning', label: 'Project Planning', description: 'Manage project schedule, gantt and tasks', defaultRoute: '/jobs?tab=planning' },
      { key: 'delivery_notes', label: 'Delivery Notes', description: 'Generate delivery challans and dispatch notes', defaultRoute: '/delivery-notes' },
      { key: 'settings', label: 'ERP Settings', description: 'System configurations and form field setups', defaultRoute: '/settings' },
    ]
  },
  {
    moduleId: 'accounting',
    title: 'Accounting & Sales',
    description: 'Invoicing, Billing, Customer & Vendor Balances, Financials',
    permissions: [
      { key: 'accounting', label: 'Accounting Dashboard', description: 'Accounting overview, metrics and KPI stats', defaultRoute: '/accounting' },
      { key: 'customers', label: 'Customers', description: 'Customer directory, statements and balances', defaultRoute: '/accounting/customers' },
      { key: 'vendors', label: 'Vendors', description: 'Vendor directory, statements and payables', defaultRoute: '/accounting/vendors' },
      { key: 'estimations', label: 'Estimations', description: 'Cost sheet estimation builder and approvals', defaultRoute: '/accounting/estimations' },
      { key: 'quotations', label: 'Quotations', description: 'Create and issue client price quotations', defaultRoute: '/accounting/quotations' },
      { key: 'invoices', label: 'Tax Invoices', description: 'Issue VAT tax invoices and payment tracking', defaultRoute: '/invoices' },
      { key: 'credit_notes', label: 'Credit Notes', description: 'Generate customer returns and credit notes', defaultRoute: '/credit-notes' },
      { key: 'salary', label: 'Salary & Payroll', description: 'Staff payroll, salary vouchers and timesheets', defaultRoute: '/salary' },
      { key: 'reports', label: 'Financial Reports', description: 'Ledgers, trial balances, statements and cash flows', defaultRoute: '/reports' },
      { key: 'accounting_settings', label: 'Accounting Settings', description: 'Tax configurations, bank accounts and currency', defaultRoute: '/accounting/settings' },
    ]
  },
  {
    moduleId: 'cashbook',
    title: 'Cashbook & Ledgers',
    description: 'Petty Cash, Cash Registers, Labour & Expense Tracking',
    permissions: [
      { key: 'cashbook', label: 'Cash Books (Shelf)', description: 'View cashbook accounts and running ledger balances', defaultRoute: '/cashbook' },
      { key: 'expenses', label: 'Expenses', description: 'Record company and project expense entries', defaultRoute: '/cashbook?tab=expenses' },
      { key: 'labour', label: 'Labour & Contractors', description: 'Track daily site labour and contractor disbursements', defaultRoute: '/cashbook?tab=labour' },
      { key: 'banks', label: 'Bank & Petty Cash', description: 'Manage bank accounts, petty cash drawers & transfers', defaultRoute: '/cashbook?tab=bank_accounts' },
      { key: 'recycle_bin', label: 'Recycle Bin', description: 'Audit and restore deleted cashbook entries', defaultRoute: '/cashbook?tab=recycle_bin' },
    ]
  }
]

/**
 * Quick Role Presets for User Management
 */
export const ROLE_PRESETS = {
  Admin: {
    label: 'Administrator',
    description: 'Full, unrestricted access to all modules, pages and administration',
    permissions: 'ALL'
  },
  Accountant: {
    label: 'Accountant',
    description: 'Full access to Accounting & Cashbook ledgers and financial reports',
    permissions: [
      'accounting', 'customers', 'vendors', 'estimations', 'quotations',
      'invoices', 'credit_notes', 'salary', 'reports', 'accounting_settings',
      'cashbook', 'expenses', 'labour', 'banks', 'recycle_bin'
    ]
  },
  Operations: {
    label: 'Operations / Project Manager',
    description: 'Access to CRM enquiries, job orders, project planning and delivery notes',
    permissions: [
      'dashboard', 'enquiries', 'jobs', 'planning', 'delivery_notes',
      'customers', 'quotations', 'estimations'
    ]
  },
  Staff: {
    label: 'Staff / Viewer',
    description: 'Standard access for operations tracking',
    permissions: [
      'dashboard', 'enquiries', 'jobs', 'delivery_notes'
    ]
  },
  Custom: {
    label: 'Custom Role',
    description: 'Manually select granular module and page permissions',
    permissions: []
  }
}

/**
 * Check if a user is an administrator
 */
export const isUserAdmin = (user) => {
  if (!user) return false
  return Boolean(user.role === 'Admin' || user.is_admin || user.is_superuser)
}

/**
 * Universal Permission Evaluator
 */
export const canAccessPermission = (user, permissionKey) => {
  if (!user) return false
  if (isUserAdmin(user)) return true

  const list = user.access_list || []

  // If asking for a specific permission
  if (!permissionKey) return true

  return list.includes(permissionKey)
}

/**
 * Check if user has access to at least one page in a top-level module (erp, accounting, cashbook)
 */
export const hasModuleAccess = (user, moduleId) => {
  if (!user) return false
  if (isUserAdmin(user)) return true

  const group = MODULE_PERMISSION_GROUPS.find(g => g.moduleId.toLowerCase() === moduleId.toLowerCase())
  if (!group) return false

  return group.permissions.some(p => canAccessPermission(user, p.key))
}

/**
 * Get the first accessible route for a user in a given module
 */
export const getFirstAccessibleRoute = (user, moduleId) => {
  if (!user) return '/login'
  const group = MODULE_PERMISSION_GROUPS.find(g => g.moduleId.toLowerCase() === moduleId.toLowerCase())
  if (!group) return '/'

  if (isUserAdmin(user)) {
    return group.permissions[0]?.defaultRoute || '/'
  }

  const allowed = group.permissions.find(p => canAccessPermission(user, p.key))
  return allowed ? allowed.defaultRoute : '/'
}

/**
 * Get the initial landing page for a user after login based on their permissions
 */
export const getUserInitialRoute = (user) => {
  if (!user) return '/login'
  if (isUserAdmin(user)) return '/'

  if (hasModuleAccess(user, 'erp')) {
    return getFirstAccessibleRoute(user, 'erp')
  }
  if (hasModuleAccess(user, 'accounting')) {
    return getFirstAccessibleRoute(user, 'accounting')
  }
  if (hasModuleAccess(user, 'cashbook')) {
    return getFirstAccessibleRoute(user, 'cashbook')
  }
  return '/'
}
