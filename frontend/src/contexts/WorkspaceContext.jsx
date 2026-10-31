import React, { createContext, useContext, useState, useEffect } from 'react'

export const WORKSPACE_PRESETS = [
  {
    id: 'minimalist',
    name: 'Minimalist Mode',
    tag: 'Clean & Focused',
    description: 'Hides clutter and non-essential modules. Keeps only core daily operations (Customers, Orders, Payments, Expenses) and a clean summary dashboard.',
    icon: 'CheckCircle2',
    features: {
      customers: true,
      vendors: false,
      jobs: true,
      invoices: true,
      estimations: false,
      planning: false,
      payments: true,
      expenses: true,
      payment_requests: false,
      banks: false,
      cashbook: false,
      reports: false,
      salary: false,
      minimalist_dashboard: true,
    }
  },
  {
    id: 'standard',
    name: 'Standard Operations',
    tag: 'Commercial Daily',
    description: 'Balanced for regular business management: CRM, Orders, Vendors, Invoicing, Expenses, and Financial Reports.',
    icon: 'Briefcase',
    features: {
      customers: true,
      vendors: true,
      jobs: true,
      invoices: true,
      estimations: false,
      planning: false,
      payments: true,
      expenses: true,
      payment_requests: false,
      banks: false,
      cashbook: false,
      reports: true,
      salary: false,
      minimalist_dashboard: false,
    }
  },
  {
    id: 'enterprise',
    name: 'Full Enterprise',
    tag: 'All Features Enabled',
    description: 'Complete suite with cost estimations, project planning tools, petty cash vault, banking, and deep financial analytics.',
    icon: 'Layers',
    features: {
      customers: true,
      vendors: true,
      jobs: true,
      invoices: true,
      estimations: true,
      planning: true,
      payments: true,
      expenses: true,
      payment_requests: true,
      banks: true,
      cashbook: true,
      reports: true,
      salary: true,
      minimalist_dashboard: false,
    }
  },
  {
    id: 'custom',
    name: 'Custom Configuration',
    tag: 'Personalized',
    description: 'Select precisely which modules and features you want visible in your workspace.',
    icon: 'Sliders',
    features: null // Controlled by user toggles
  }
]

export const FEATURE_DEFINITIONS = [
  {
    category: 'Sales & Operations',
    items: [
      {
        key: 'customers',
        label: 'Customers & CRM',
        description: 'Client profiles, customer balances, and account statements.',
        path: '/accounting/customers'
      },
      {
        key: 'vendors',
        label: 'Vendors & Suppliers',
        description: 'Supplier directory, vendor bills, and purchase records.',
        path: '/accounting/vendors'
      },
      {
        key: 'estimations',
        label: 'Cost Estimations',
        description: 'Pre-sale quotations, pricing breakdowns, and cost estimates.',
        path: '/accounting/estimations'
      },
      {
        key: 'quotations',
        label: 'Commercial Quotations',
        description: 'Customer quotes, proposals, and commercial pricing offers.',
        path: '/accounting/quotations'
      },
      {
        key: 'jobs',
        label: 'Job Orders & Contracts',
        description: 'Job orders, engagement tracking, status, and contract values.',
        path: '/jobs'
      },
      {
        key: 'planning',
        label: 'Project Planning & Tools',
        description: 'Work schedules, worker assignments, and project planning.',
        path: '/jobs?tab=planning'
      },
      {
        key: 'delivery_notes',
        label: 'Delivery Notes',
        description: 'Goods dispatch, proof of delivery, and site handover.',
        path: '/delivery-notes'
      },
    ]
  },
  {
    category: 'Finance & Accounts',
    items: [
      {
        key: 'invoices',
        label: 'Invoices & Billing',
        description: 'Customer tax invoices, line items, 15% VAT calculation, and settlement tracking.',
        path: '/invoices'
      },
      {
        key: 'credit_notes',
        label: 'Credit Notes & Adjustments',
        description: 'Returns credit, invoice adjustments, and VAT credit memos.',
        path: '/credit-notes'
      },
      {
        key: 'payments',
        label: 'Payments & Receipts',
        description: 'Incoming customer receipts and payment settlement logs.',
        path: '/payments'
      },
      {
        key: 'expenses',
        label: 'Expenses & Overhead',
        description: 'Operational expenses, categorized bills, and cost tracking.',
        path: '/expenses'
      },
      {
        key: 'payment_requests',
        label: 'Payment Approval Requests',
        description: 'Vendor payment requests, approvals, and disbursement flows.',
        path: '/payment-requests'
      },
      {
        key: 'banks',
        label: 'Bank Accounts & Ledgers',
        description: 'Bank account management and electronic transfers.',
        path: '/banks'
      },
      {
        key: 'cashbook',
        label: 'Petty Cash Book (Vault)',
        description: 'Cash-in, cash-out, petty cash box, and running cash balances.',
        path: '/cashbook'
      },
      {
        key: 'reports',
        label: 'Financial & Tax Reports',
        description: 'P&L, balance summaries, VAT/tax, and operational reports.',
        path: '/reports'
      },
      {
        key: 'salary',
        label: 'Salary & Payroll Suite',
        description: 'Staff payroll, attendance, timesheets, and wage slips.',
        path: '/salary'
      },
    ]
  },
  {
    category: 'Dashboard & Interface',
    items: [
      {
        key: 'minimalist_dashboard',
        label: 'Minimalist Clean Dashboard',
        description: 'Shows high-clarity essential KPI cards and recent orders; removes complex multi-tier charts and heavy graphs.',
        isToggleOnly: true
      }
    ]
  }
]

const WorkspaceContext = createContext(null)

const STORAGE_KEY = 'arabseason_workspace_config'

export const WorkspaceProvider = ({ children }) => {
  const [workspaceMode, setWorkspaceModeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.mode || 'enterprise'
      }
    } catch (e) {}
    return 'enterprise'
  })

  const [features, setFeaturesState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.features) {
          return parsed.features
        }
      }
    } catch (e) {}
    // Default: full enterprise features
    return { ...WORKSPACE_PRESETS.find(p => p.id === 'enterprise').features }
  })

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          mode: workspaceMode,
          features
        })
      )
    } catch (e) {
      console.error('Failed to save workspace config:', e)
    }
  }, [workspaceMode, features])

  const setWorkspaceMode = (modeId) => {
    const preset = WORKSPACE_PRESETS.find(p => p.id === modeId)
    if (!preset) return
    setWorkspaceModeState(modeId)
    if (preset.features) {
      setFeaturesState({ ...preset.features })
    }
  }

  const toggleFeature = (featureKey) => {
    setFeaturesState(prev => {
      const updated = {
        ...prev,
        [featureKey]: !prev[featureKey]
      }
      return updated
    })
    setWorkspaceModeState('custom')
  }

  const setFeature = (featureKey, value) => {
    setFeaturesState(prev => {
      const updated = {
        ...prev,
        [featureKey]: Boolean(value)
      }
      return updated
    })
    setWorkspaceModeState('custom')
  }

  const resetToDefault = () => {
    setWorkspaceMode('enterprise')
  }

  const isFeatureVisible = (featureKey) => {
    // Core routes that are always visible
    if (!featureKey || featureKey === '/' || featureKey === 'dashboard' || featureKey === 'settings') {
      return true
    }
    // Check if feature key is enabled
    if (features[featureKey] !== undefined) {
      return Boolean(features[featureKey])
    }
    return true
  }

  const isMinimalist = workspaceMode === 'minimalist' || Boolean(features.minimalist_dashboard)

  return (
    <WorkspaceContext.Provider
      value={{
        workspaceMode,
        features,
        setWorkspaceMode,
        toggleFeature,
        setFeature,
        resetToDefault,
        isFeatureVisible,
        isMinimalist,
        presets: WORKSPACE_PRESETS,
        featureDefinitions: FEATURE_DEFINITIONS
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext)
  if (!context) {
    // Fallback if accessed outside provider
    return {
      workspaceMode: 'enterprise',
      features: { ...WORKSPACE_PRESETS.find(p => p.id === 'enterprise').features },
      setWorkspaceMode: () => {},
      toggleFeature: () => {},
      setFeature: () => {},
      resetToDefault: () => {},
      isFeatureVisible: () => true,
      isMinimalist: false,
      presets: WORKSPACE_PRESETS,
      featureDefinitions: FEATURE_DEFINITIONS
    }
  }
  return context
}

export default WorkspaceContext
