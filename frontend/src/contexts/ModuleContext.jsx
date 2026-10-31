import { createContext, useContext, useState, useEffect } from 'react'

const ModuleContext = createContext(null)

export const MODULES = {
  ERP: {
    id: 'erp',
    name: 'ERP Operations',
    shortName: 'ERP',
    icon: 'Building2',
    color: '#2563eb',
    description: 'CRM, Job Orders, Estimations & Planning',
    defaultRoute: '/'
  },
  ACCOUNTING: {
    id: 'accounting',
    name: 'Accounting',
    shortName: 'Accounting',
    icon: 'Receipt',
    color: '#059669',
    description: 'Payments, Expenses, Payroll & Financials',
    defaultRoute: '/accounting'
  },
  CASHBOOK: {
    id: 'cashbook',
    name: 'Cashbook',
    shortName: 'Cashbook',
    icon: 'BookOpen',
    color: '#f59e0b',
    description: 'Petty Cash, Cash In/Out & Running Balances',
    defaultRoute: '/cashbook'
  }
}

export const ModuleProvider = ({ children }) => {
  const [activeModule, setActiveModuleState] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth <= 768) {
        return 'cashbook'
      }
      if (window.location) {
        if (window.location.pathname === '/cashbook' || window.location.pathname.startsWith('/cashbook/')) {
          return 'cashbook'
        }
        if (window.location.pathname === '/accounting' || window.location.pathname.startsWith('/accounting/')) {
          return 'accounting'
        }
        if (window.location.pathname === '/') {
          return 'erp'
        }
      }
    }
    return localStorage.getItem('arab_season_active_module') || 'erp'
  })

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setActiveModuleState('cashbook')
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const setActiveModule = (moduleId) => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setActiveModuleState('cashbook')
      return
    }
    setActiveModuleState(moduleId)
    try {
      localStorage.setItem('arab_season_active_module', moduleId)
    } catch (e) {}
  }

  const currentModuleInfo = MODULES[activeModule.toUpperCase()] || MODULES.ERP

  return (
    <ModuleContext.Provider value={{
      activeModule,
      setActiveModule,
      currentModuleInfo,
      MODULES
    }}>
      {children}
    </ModuleContext.Provider>
  )
}

export const useModule = () => {
  const ctx = useContext(ModuleContext)
  if (!ctx) {
    return {
      activeModule: 'erp',
      setActiveModule: () => {},
      currentModuleInfo: MODULES.ERP,
      MODULES
    }
  }
  return ctx
}
