import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Trash2,
  RotateCcw,
  RefreshCw,
  Search,
  X,
  ArrowLeft,
  Calendar,
  Clock,
  Layers,
  Building2,
  Users,
  User,
  Receipt,
  Briefcase,
  CreditCard,
  BookOpen,
  Landmark,
  Truck,
  HardHat,
  MessageSquareQuote,
  FileText,
  FileSpreadsheet,
  Shield,
  Filter
} from 'lucide-react'

import CredCardCarousel from '../components/cashbook/cred/CredCardCarousel'
import MoneyCard from '../components/cashbook/cred/MoneyCard'
import GooeyMenu from '../components/cashbook/cred/GooeyMenu'
import CredAnimatedTabs from '../components/cashbook/cred/CredAnimatedTabs'
import CredRowIconButton from '../components/cashbook/cred/CredRowIconButton'
import CredPagination from '../components/cashbook/cred/CredPagination'
import { usePagination, PAGE_SIZE_DESKTOP, PAGE_SIZE_MOBILE } from '../components/cashbook/cred/usePagination'
import ExportTablePdfBtn from '../components/cashbook/common/ExportTablePdfBtn'
import { exportTableToPdf } from '../utils/cashbookPdfGenerator'
import { showConfirm, showError, showSuccess, showWarning } from '../utils/swal';
import { isUserAdmin } from '../constants/permissions'
import api from '../api'

// Module-specific category filters
const CASHBOOK_CATEGORIES = [
  { id: 'all', label: 'All Categories', icon: Layers },
  { id: 'cashbook_entry', label: 'Transactions', icon: Receipt, types: ['cashbook_entry'] },
  { id: 'cashbook', label: 'Cash Books', icon: BookOpen, types: ['cashbook'] },
  { id: 'banks', label: 'Bank & Petty Cash', icon: Landmark, types: ['bank_account', 'petty_cash'] },
  { id: 'labour', label: 'Labour', icon: HardHat, types: ['labour'] },
  { id: 'expenses', label: 'Expenses', icon: Receipt, types: ['expense'] },
  { id: 'parties', label: 'Customers & Vendors', icon: Users, types: ['customer', 'vendor'] },
  { id: 'jobs', label: 'Job Orders', icon: Briefcase, types: ['job_order'] },
]

const ACCOUNTING_CATEGORIES = [
  { id: 'all', label: 'All Categories', icon: Layers },
  { id: 'invoices', label: 'Invoices', icon: Receipt, types: ['invoice'] },
  { id: 'quotations', label: 'Quotations', icon: FileText, types: ['quotation'] },
  { id: 'estimations', label: 'Estimations', icon: FileSpreadsheet, types: ['estimation'] },
  { id: 'credit_notes', label: 'Credit Notes', icon: RotateCcw, types: ['credit_note'] },
  { id: 'payments', label: 'Payments & Payroll', icon: CreditCard, types: ['customer_payment', 'vendor_payment', 'salary_payment', 'payment_request'] },
  { id: 'parties', label: 'Customers & Vendors', icon: Users, types: ['customer', 'vendor'] },
]

const ERP_CATEGORIES = [
  { id: 'all', label: 'All Categories', icon: Layers },
  { id: 'jobs', label: 'Job Orders', icon: Briefcase, types: ['job_order'] },
  { id: 'planning', label: 'Project Plans', icon: Layers, types: ['project_plan'] },
  { id: 'delivery', label: 'Delivery Notes', icon: Truck, types: ['delivery_note'] },
  { id: 'enquiries', label: 'Enquiries', icon: MessageSquareQuote, types: ['enquiry'] },
  { id: 'materials', label: 'Materials', icon: FileText, types: ['material'] },
  { id: 'timesheets', label: 'Timesheets', icon: Clock, types: ['staff_timesheet'] },
]

const MODULE_CONFIG = {
  cashbook: {
    id: 'cashbook',
    title: 'Cashbook Recycle Bin',
    subtitle: 'Archived cash books, transactions, labour records, and cashbook expenses.',
    emptyText: 'No deleted cashbook items found.',
    categories: CASHBOOK_CATEGORIES,
  },
  accounting: {
    id: 'accounting',
    title: 'Accounting Recycle Bin',
    subtitle: 'Archived invoices, quotations, credit notes, payments, and accounting records.',
    emptyText: 'No deleted accounting items found.',
    categories: ACCOUNTING_CATEGORIES,
  },
  erp: {
    id: 'erp',
    title: 'ERP Operations Recycle Bin',
    subtitle: 'Archived job orders, project plans, delivery notes, and operations records.',
    emptyText: 'No deleted ERP operations items found.',
    categories: ERP_CATEGORIES,
  }
}

const DURATION_OPTIONS = [
  { value: 'all', id: 'all', label: 'All Time', icon: Calendar },
  { value: 'today', id: 'today', label: 'Today', icon: Calendar },
  { value: '7d', id: '7d', label: 'Last 7 Days', icon: Calendar },
  { value: '30d', id: '30d', label: 'Last 30 Days', icon: Calendar },
  { value: '90d', id: '90d', label: 'Last 90 Days', icon: Calendar },
]

const getItemIcon = (entityType) => {
  if (entityType === 'cashbook_entry') return Receipt
  if (entityType === 'cashbook') return BookOpen
  if (entityType === 'job_order') return Briefcase
  if (entityType === 'expense') return Receipt
  if (entityType === 'customer') return Users
  if (entityType === 'vendor') return Building2
  if (entityType === 'labour') return HardHat
  if (entityType === 'bank_account' || entityType === 'petty_cash') return Landmark
  if (entityType === 'project_plan') return Layers
  if (entityType === 'delivery_note') return Truck
  if (entityType === 'enquiry') return MessageSquareQuote
  if (['customer_payment', 'vendor_payment', 'salary_payment', 'payment_request'].includes(entityType)) return CreditCard
  if (entityType === 'invoice') return Receipt
  if (entityType === 'quotation') return FileText
  if (entityType === 'estimation') return FileSpreadsheet
  if (entityType === 'credit_note') return RotateCcw
  if (entityType === 'staff_timesheet') return Clock
  return FileText
}

const getItemSecondary = (item) => {
  const fields = item.item_data?.fields || {}
  const idStr = item.original_object_id ? `#${item.original_object_id}` : `#${item.id}`
  const extras = []

  if (fields.amount != null && fields.amount !== '') {
    const num = Number(fields.amount)
    if (!isNaN(num)) {
      extras.push(`SAR ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    }
  }
  if (fields.date) {
    extras.push(fields.date)
  } else if (fields.invoice_date) {
    extras.push(fields.invoice_date)
  }
  if (fields.party_name) {
    extras.push(fields.party_name)
  } else if (fields.customer_name) {
    extras.push(fields.customer_name)
  } else if (fields.vendor_name) {
    extras.push(fields.vendor_name)
  } else if (fields.company_name) {
    extras.push(fields.company_name)
  } else if (fields.phone) {
    extras.push(fields.phone)
  } else if (fields.trade) {
    extras.push(fields.trade)
  }

  if (extras.length > 0) {
    return `${idStr} · ${extras.slice(0, 2).join(' · ')}`
  }
  return idStr
}

const RecycleBin = ({
  module: moduleProp = 'cashbook',
  embedded = false,
  cashbookOnly = false,
  isDarkMode: isDarkModeProp,
  onBack,
  isMobile: isMobileProp,
  currentUser: currentUserProp
}) => {
  const activeModule = (cashbookOnly ? 'cashbook' : moduleProp || 'cashbook').toLowerCase()
  const moduleMeta = MODULE_CONFIG[activeModule] || MODULE_CONFIG.cashbook

  const outletCtx = useOutletContext() || {}
  const currentUser = currentUserProp || outletCtx.currentUser || (() => {
    try {
      const u = localStorage.getItem('user')
      return u ? JSON.parse(u) : null
    } catch {
      return null
    }
  })()

  const isAdmin = isUserAdmin(currentUser)

  const [items, setItems] = useState([])
  const [stats, setStats] = useState({ total_active: 0, total_restored: 0, by_type: {} })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [duration, setDuration] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active') // 'active' | 'restored'
  const [restoringId, setRestoringId] = useState(null)

  // Responsive state
  const [internalIsMobile, setInternalIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768
    }
    return false
  })

  useEffect(() => {
    const handleResize = () => {
      setInternalIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isMobile = typeof isMobileProp === 'boolean' ? isMobileProp : internalIsMobile

  // Reactive Dark Mode Detection
  const [isDark, setIsDark] = useState(() => {
    if (typeof isDarkModeProp === 'boolean') return isDarkModeProp
    if (outletCtx.isDarkMode !== undefined) return outletCtx.isDarkMode
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('cb-dark-bw') ||
             document.body.classList.contains('cb-dark-bw') ||
             localStorage.getItem('cashbook_dark_mode') === 'true' ||
             document.documentElement.getAttribute('data-theme') === 'dark'
    }
    return false
  })

  useEffect(() => {
    if (typeof isDarkModeProp === 'boolean') {
      setIsDark(isDarkModeProp)
      return
    }
    if (outletCtx.isDarkMode !== undefined) {
      setIsDark(outletCtx.isDarkMode)
      return
    }
    const checkDark = () => {
      const dark = document.documentElement.classList.contains('cb-dark-bw') ||
                   document.body.classList.contains('cb-dark-bw') ||
                   localStorage.getItem('cashbook_dark_mode') === 'true' ||
                   document.documentElement.getAttribute('data-theme') === 'dark'
      setIsDark(dark)
    }
    const observer = new MutationObserver(checkDark)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [isDarkModeProp, outletCtx.isDarkMode])

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      const url = `recycle-bin/?status=${statusFilter}&module=${activeModule}`
      const res = await api.get(url)
      setItems(res.data.results || res.data || [])
    } catch (err) {
      console.error(err)
      showError('Failed to load items', 'Could not load Recycle Bin data')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, activeModule])

  const fetchStats = useCallback(async () => {
    try {
      const url = `recycle-bin/stats/?module=${activeModule}`
      const res = await api.get(url)
      setStats(res.data || { total_active: 0, total_restored: 0, by_type: {} })
    } catch (err) {
      console.error(err)
    }
  }, [activeModule])

  useEffect(() => {
    fetchItems()
    fetchStats()
  }, [fetchItems, fetchStats])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchItems(), fetchStats()])
    setRefreshing(false)
    showSuccess('Recycle Bin refreshed')
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    }
  }

  const handleRestore = async (item) => {
    const confirmed = await showConfirm(
      'Restore Record?',
      `Restore "${item.item_name}" back to its active records? It will become visible and active immediately.`,
      'Restore Item',
      false
    )
    if (!confirmed) return

    try {
      setRestoringId(item.id)
      const res = await api.post(`recycle-bin/${item.id}/restore/`)
      if (res.data?.success) {
        showSuccess('Restored!', res.data.message || 'Item restored successfully.')
        window.dispatchEvent(new CustomEvent('recycle-bin-updated'))
        await Promise.all([fetchItems(), fetchStats()])
      }
    } catch (err) {
      console.error(err)
      showError('Restore Failed', err.response?.data?.detail || err.response?.data?.error || 'Failed to restore item.')
    } finally {
      setRestoringId(null)
    }
  }

  const handlePermanentDelete = async (item) => {
    const confirmed = await showConfirm({
      title: 'Delete Record Permanently?',
      text: `Are you sure you want to permanently delete "${item.item_name}"? This action cannot be undone.`,
      confirmButtonText: 'Permanent Purge',
      isDangerous: true,
      allowPermanent: false
    })
    if (!confirmed) return

    try {
      setRestoringId(item.id)
      await api.delete(`recycle-bin/${item.id}/`)
      showSuccess('Record permanently deleted from Recycle Bin.')
      window.dispatchEvent(new CustomEvent('recycle-bin-updated'))
      await Promise.all([fetchItems(), fetchStats()])
    } catch (err) {
      console.error(err)
      showError('Delete Failed', err.response?.data?.detail || 'Failed to permanently delete item.')
    } finally {
      setRestoringId(null)
    }
  }

  // Categories list
  const categoriesList = useMemo(() => {
    const base = moduleMeta.categories || []
    if (isAdmin && stats.other?.total_active > 0) {
      return [...base, { id: 'other', label: 'Other Records', icon: Shield, types: ['other'] }]
    }
    return base
  }, [moduleMeta, isAdmin, stats])

  // Extract unique users for admin filter
  const uniqueUsers = useMemo(() => {
    if (!isAdmin) return []
    const set = new Set()
    items.forEach(it => {
      if (it.deleted_by_name) set.add(it.deleted_by_name)
    })
    return Array.from(set).sort()
  }, [items, isAdmin])

  // Dropdown options
  const categoryGooeyOptions = useMemo(() => {
    return categoriesList.map(cat => ({
      value: cat.id,
      label: cat.label,
      icon: cat.icon || Layers
    }))
  }, [categoriesList])

  const userGooeyOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Users', icon: Users },
      ...uniqueUsers.map(u => ({ value: u, label: u, icon: User }))
    ]
  }, [uniqueUsers])

  const formatDate = (isoStr) => {
    if (!isoStr) return '—'
    try {
      const d = new Date(isoStr)
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch (e) {
      return isoStr
    }
  }

  // Filtered records
  const filteredItems = useMemo(() => {
    const now = new Date()
    return items.filter(item => {
      // 1. Category Filter
      if (selectedCategory !== 'all') {
        const cat = categoriesList.find(c => c.id === selectedCategory)
        if (cat?.types && !cat.types.includes(item.entity_type)) {
          return false
        }
      }

      // 2. User Filter (Admin only)
      if (isAdmin && userFilter !== 'all') {
        if (item.deleted_by_name !== userFilter) {
          return false
        }
      }

      // 3. Duration Filter
      if (duration !== 'all') {
        const itemDate = new Date(item.deleted_at || 0)
        if (duration === 'today') {
          if (itemDate.toDateString() !== now.toDateString()) return false
        } else {
          const diffMs = now - itemDate
          const diffDays = diffMs / (1000 * 60 * 60 * 24)
          if (duration === '7d' && diffDays > 7) return false
          if (duration === '30d' && diffDays > 30) return false
          if (duration === '90d' && diffDays > 90) return false
        }
      }

      // 4. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = (item.item_name || '').toLowerCase().includes(q)
        const matchSummary = (item.item_summary || '').toLowerCase().includes(q)
        const matchUser = (item.deleted_by_name || '').toLowerCase().includes(q)
        const matchType = (item.entity_type_display || item.entity_type || '').toLowerCase().includes(q)
        const matchModel = (item.model_name || '').toLowerCase().includes(q)
        if (!matchName && !matchSummary && !matchUser && !matchType && !matchModel) {
          return false
        }
      }

      return true
    })
  }, [items, selectedCategory, userFilter, duration, searchQuery, categoriesList, isAdmin])

  // KPIs
  const kpis = useMemo(() => {
    const todayStr = new Date().toDateString()
    let deletedToday = 0
    const entityTypeSet = new Set()

    items.forEach(it => {
      if (it.deleted_at && new Date(it.deleted_at).toDateString() === todayStr) {
        deletedToday += 1
      }
      if (it.entity_type) {
        entityTypeSet.add(it.entity_type)
      }
    })

    const statsTypesCount = Object.keys(stats.by_type || {}).length
    const totalEntityTypes = Math.max(entityTypeSet.size, statsTypesCount)

    return {
      activeInBin: stats.total_active || 0,
      restored: stats.total_restored || 0,
      deletedToday,
      entityTypesCount: totalEntityTypes
    }
  }, [items, stats])

  // Pagination
  const paginationResetKey = `${statusFilter}_${selectedCategory}_${userFilter}_${duration}_${searchQuery}`
  const {
    pageItems,
    page: currentPage,
    setPage: setCurrentPage,
    totalPages: totalPagesCount,
    rangeStart,
    rangeEnd,
    total: totalRecordsCount
  } = usePagination(filteredItems, isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP, paginationResetKey)

  // Status toggle tabs
  const statusToggleTabs = useMemo(() => [
    { id: 'active', label: `In Bin (${stats.total_active || 0})` },
    { id: 'restored', label: `Restored (${stats.total_restored || 0})` }
  ], [stats.total_active, stats.total_restored])

  // Export PDF handler
  const handleExportPDF = () => {
    const columns = [
      { header: 'ITEM', dataKey: 'item' },
      { header: 'TYPE', dataKey: 'type' },
      { header: 'SUMMARY', dataKey: 'summary' },
      ...(isAdmin ? [{ header: 'DELETED BY', dataKey: 'deleted_by' }] : []),
      { header: 'DELETED AT', dataKey: 'deleted_at' },
      { header: 'STATUS', dataKey: 'status' }
    ]

    const rows = filteredItems.map(item => ({
      item: item.item_name || '—',
      type: item.entity_type_display || item.entity_type || '—',
      summary: item.item_summary || '—',
      ...(isAdmin ? { deleted_by: item.deleted_by_name || 'System' } : {}),
      deleted_at: formatDate(item.deleted_at),
      status: item.is_restored ? 'Restored' : 'In Bin'
    }))

    exportTableToPdf({
      title: moduleMeta.title.toUpperCase(),
      subtitle: `Arab Season Contracting • Records: ${rows.length} • Status: ${statusFilter === 'restored' ? 'Restored' : 'In Bin'}`,
      filename: `${activeModule}_recycle_bin_${new Date().toISOString().split('T')[0]}.pdf`,
      columns,
      rows,
      totals: {
        item: 'TOTAL RECORDS',
        type: `${rows.length} Items`,
        summary: '',
        ...(isAdmin ? { deleted_by: '' } : {}),
        deleted_at: '',
        status: ''
      }
    })
  }

  return (
    <div
      className="cred-page-container"
      style={{
        padding: isMobile ? '12px 14px 80px' : '20px 32px 60px',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        color: 'var(--text, #0A0A0A)'
      }}
    >
      {/* 1. TOP HEADER SECTION */}
      {isMobile ? (
        <div style={{ marginBottom: '16px' }}>
          {onBack && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back"
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 0',
                marginBottom: '10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text, #0A0A0A)',
                outline: 'none',
                width: 'fit-content'
              }}
            >
              <ArrowLeft size={20} strokeWidth={2} />
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em' }}>
                {moduleMeta.title}
              </h1>
              {!isAdmin && (
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>
                  You can see items you deleted.
                </p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeModule !== 'cashbook' && !cashbookOnly && (
                <ExportTablePdfBtn onClick={handleExportPDF} label="PDF" isDarkMode={isDark} />
              )}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                style={{
                  background: isDark ? '#FFFFFF' : '#0A0A0A',
                  color: isDark ? '#0A0A0A' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '20px',
            gap: '12px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {onBack && (
                <button
                  type="button"
                  onClick={handleBack}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text, #0A0A0A)',
                    borderRadius: '8px'
                  }}
                  title="Go Back"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <h1
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 600,
                  margin: 0,
                  color: 'var(--text, #0A0A0A)',
                  letterSpacing: '-0.025em'
                }}
              >
                {moduleMeta.title}
              </h1>
            </div>
            {!isAdmin ? (
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted, #8C8C8C)' }}>
                You can see items you deleted.
              </p>
            ) : (
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted, #8C8C8C)' }}>
                {moduleMeta.subtitle}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeModule !== 'cashbook' && !cashbookOnly && (
              <ExportTablePdfBtn onClick={handleExportPDF} isDarkMode={isDark} />
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                background: isDark ? '#FFFFFF' : '#0A0A0A',
                color: isDark ? '#0A0A0A' : '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: isDark ? '0 2px 12px rgba(255,255,255,0.1)' : '0 2px 10px rgba(15,23,42,0.14)',
                transition: 'transform 0.15s ease, opacity 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh Bin</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. FILTER ROW */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
          position: 'relative',
          zIndex: 40,
          overflow: 'visible'
        }}
      >
        {/* Left: Filter Pills & Dropdowns */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            flex: 1,
            minWidth: 0,
            position: 'relative',
            zIndex: 50,
            overflow: 'visible'
          }}
        >
          {/* Active / Restored switch */}
          <CredAnimatedTabs
            tabs={statusToggleTabs}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            className="case-preserve"
            layoutId={`cred-recycle-status-pill-${activeModule}`}
          />

          {/* Category Dropdown */}
          <GooeyMenu
            id={`recycle-category-filter-${activeModule}`}
            value={selectedCategory}
            onSelect={(opt) => setSelectedCategory(opt.value || opt.id || opt)}
            onChange={(val) => setSelectedCategory(val)}
            options={categoryGooeyOptions}
            width={isMobile ? '100%' : 185}
            pillHeight={36}
            gooey={false}
            className="case-preserve"
            ariaLabel="Filter category"
          />

          {/* Deleted By Dropdown (Admin only) */}
          {isAdmin && uniqueUsers.length > 0 && (
            <GooeyMenu
              id={`recycle-user-filter-${activeModule}`}
              value={userFilter}
              onSelect={(opt) => setUserFilter(opt.value || opt.id || opt)}
              onChange={(val) => setUserFilter(val)}
              options={userGooeyOptions}
              width={isMobile ? '100%' : 160}
              pillHeight={36}
              gooey={false}
              className="case-preserve"
              ariaLabel="Filter deleted by"
            />
          )}

          {/* Date-range Dropdown */}
          <GooeyMenu
            id={`recycle-date-filter-${activeModule}`}
            value={duration}
            onSelect={(opt) => setDuration(opt.value || opt.id || opt)}
            onChange={(val) => setDuration(val)}
            options={DURATION_OPTIONS}
            width={isMobile ? '100%' : 155}
            pillHeight={36}
            ariaLabel="Filter date range"
          />
        </div>

        {/* Right: Search Box */}
        <div
          style={{
            position: 'relative',
            width: isMobile ? '100%' : '270px',
            flexShrink: 0
          }}
        >
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted, #8C8C8C)',
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deleted records..."
            style={{
              width: '100%',
              height: '36px',
              padding: '0 30px 0 34px',
              borderRadius: '12px',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid var(--border, #E4E4E4)',
              background: isDark ? '#16181b' : '#f4f4f4',
              color: isDark ? '#ffffff' : 'var(--text, #0A0A0A)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #8C8C8C)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 4. CONTENT / TABLE SECTION */}
      {loading ? (
        <div
          style={{
            background: 'var(--bg, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '16px',
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--text-muted, #8C8C8C)'
          }}
        >
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading recycle bin items...</div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            background: 'var(--bg, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '16px',
            padding: '54px 24px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--bg-panel, #f1f5f9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              color: 'var(--text-muted, #8C8C8C)'
            }}
          >
            <Trash2 size={22} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text, #0A0A0A)', margin: '0 0 6px' }}>
            {statusFilter === 'restored' ? 'No restored records found' : 'Recycle bin is empty'}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)', margin: '0 0 16px' }}>
            {searchQuery || selectedCategory !== 'all' || (isAdmin && userFilter !== 'all') || duration !== 'all'
              ? 'No items match the current filter selection.'
              : moduleMeta.emptyText}
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            style={{
              background: isDark ? '#FFFFFF' : '#0A0A0A',
              color: isDark ? '#0A0A0A' : '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              padding: '8px 16px',
              fontWeight: 500,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Refresh Records
          </button>
        </div>
      ) : (
        <>
          {isMobile ? (
            /* Mobile Card Layout matching http://localhost:5174/cashbook?tab=ledger */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
              {pageItems.map((item) => {
                const ItemIcon = getItemIcon(item.entity_type)
                const secondaryText = getItemSecondary(item)
                const isRestoring = restoringId === item.id

                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--bg, #FFFFFF)',
                      border: '1px solid var(--border, #E4E4E4)',
                      borderRadius: '16px',
                      padding: '12px 14px',
                      boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.02)',
                      boxSizing: 'border-box',
                      width: '100%'
                    }}
                  >
                    <div className="cred-table-mobile-card">
                      {/* Top Metadata: Deleted Date & Time (left) and Entity Type Chip (right) */}
                      <div className="cred-mobile-card-top">
                        <span className="cred-mobile-card-datetime" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={11} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
                          <span>{formatDate(item.deleted_at)}</span>
                        </span>
                        <div className="cred-mobile-card-top-right">
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 500,
                              background: isDark ? '#1e2024' : '#f1f5f9',
                              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border, #E4E4E4)',
                              color: 'var(--text, #0A0A0A)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <ItemIcon size={11} style={{ color: 'var(--text-muted, #71717A)' }} />
                            <span>{item.entity_type_display || item.entity_type}</span>
                          </span>
                        </div>
                      </div>

                      {/* Middle Row: Avatar + Item Name + Action Buttons */}
                      <div className="cred-mobile-card-main">
                        <div className="cred-mobile-card-entity">
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: isDark ? '#1e2024' : '#e2e8f0',
                              color: isDark ? '#ffffff' : '#0f172a',
                              fontWeight: 700,
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {(item.item_name || 'R').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="cred-mobile-card-title" title={item.item_name}>
                              {item.item_name || 'Untitled Record'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {secondaryText}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <CredRowIconButton
                            title={item.is_restored ? 'Already Restored' : 'Restore Record'}
                            ariaLabel="Restore Record"
                            disabled={item.is_restored || isRestoring}
                            onClick={() => handleRestore(item)}
                          >
                            <RotateCcw size={14} />
                          </CredRowIconButton>

                          {isAdmin && (
                            <CredRowIconButton
                              tone="danger"
                              title="Permanently Purge"
                              ariaLabel="Permanently Purge"
                              disabled={isRestoring}
                              onClick={() => handlePermanentDelete(item)}
                            >
                              <Trash2 size={14} />
                            </CredRowIconButton>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Item Summary and Deleted By */}
                      {(item.item_summary || (isAdmin && item.deleted_by_name)) && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            paddingTop: '6px',
                            borderTop: '1px solid var(--border, #E4E4E4)',
                            fontSize: '11.5px',
                            color: 'var(--text-muted, #8C8C8C)'
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {item.item_summary || '—'}
                          </span>
                          {isAdmin && item.deleted_by_name && (
                            <span style={{ flexShrink: 0, fontSize: '10.5px' }}>
                              by {item.deleted_by_name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Desktop Table View */
          <div
            style={{
              background: 'var(--bg, #FFFFFF)',
              border: '1px solid var(--border, #E4E4E4)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: isDark ? 'none' : '0 2px 10px rgba(0,0,0,0.02)',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            {/* Scrollable table container: scrolls internally on narrow viewports */}
            <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table
                style={{
                  width: '100%',
                  minWidth: '780px',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  tableLayout: 'auto'
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border, #E4E4E4)',
                      background: isDark ? '#141517' : '#f8fafc'
                    }}
                  >
                    <th style={{ ...headerCellStyle, width: '28%' }}>ITEM</th>
                    <th style={{ ...headerCellStyle, width: '16%' }}>TYPE</th>
                    <th style={{ ...headerCellStyle, width: '24%' }}>SUMMARY</th>
                    {isAdmin && <th style={{ ...headerCellStyle, width: '14%' }}>DELETED BY</th>}
                    <th style={{ ...headerCellStyle, width: isAdmin ? '12%' : '20%' }}>DELETED AT</th>
                    <th style={{ ...headerCellStyle, width: '6%', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => {
                    const ItemIcon = getItemIcon(item.entity_type)
                    const secondaryText = getItemSecondary(item)
                    const isRestoring = restoringId === item.id

                    return (
                      <tr
                        key={item.id}
                        className="cred-table-row"
                        style={{
                          borderBottom: '1px solid var(--border, #E4E4E4)'
                        }}
                      >
                        {/* ITEM: Avatar + Name + Secondary Line */}
                        <td style={bodyCellStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                background: isDark ? '#1e2024' : '#e2e8f0',
                                color: isDark ? '#ffffff' : '#0f172a',
                                fontWeight: 700,
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              {(item.item_name || 'R').charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 500,
                                  fontSize: '13px',
                                  color: 'var(--text, #0A0A0A)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '220px'
                                }}
                                title={item.item_name}
                              >
                                {item.item_name || 'Untitled Record'}
                              </div>
                              <div
                                style={{
                                  fontSize: '10.5px',
                                  color: 'var(--text-muted, #8C8C8C)',
                                  marginTop: '1px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '220px'
                                }}
                              >
                                {secondaryText}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* TYPE: Pill Chip */}
                        <td style={bodyCellStyle}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '11.5px',
                              fontWeight: 500,
                              background: isDark ? '#1e2024' : '#f1f5f9',
                              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border, #E4E4E4)',
                              color: 'var(--text, #0A0A0A)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <ItemIcon size={11} style={{ color: 'var(--text-muted, #71717A)' }} />
                            <span>{item.entity_type_display || item.entity_type}</span>
                          </span>
                        </td>

                        {/* SUMMARY */}
                        <td style={bodyCellStyle}>
                          <div
                            style={{
                              fontSize: '12.5px',
                              color: 'var(--text-muted, #8C8C8C)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '260px'
                            }}
                            title={item.item_summary}
                          >
                            {item.item_summary || '—'}
                          </div>
                        </td>

                        {/* DELETED BY (Admin Only) */}
                        {isAdmin && (
                          <td style={bodyCellStyle}>
                            <div
                              style={{
                                fontSize: '12px',
                                color: 'var(--text, #0A0A0A)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <div
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: isDark ? '#232528' : '#e2e8f0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '9.5px',
                                  fontWeight: 600,
                                  color: 'var(--text-muted, #8C8C8C)',
                                  flexShrink: 0
                                }}
                              >
                                {(item.deleted_by_name || 'S').charAt(0).toUpperCase()}
                              </div>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                                {item.deleted_by_name || 'System User'}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* DELETED AT */}
                        <td style={{ ...bodyCellStyle, color: 'var(--text-muted, #8C8C8C)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                            <Calendar size={11} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
                            <span>{formatDate(item.deleted_at)}</span>
                          </div>
                        </td>

                        {/* ACTIONS: Icon-only buttons */}
                        <td style={{ ...bodyCellStyle, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                            <CredRowIconButton
                              title={item.is_restored ? 'Already Restored' : 'Restore Record'}
                              ariaLabel="Restore Record"
                              disabled={item.is_restored || isRestoring}
                              onClick={() => handleRestore(item)}
                            >
                              <RotateCcw size={13} />
                            </CredRowIconButton>

                            {isAdmin && (
                              <CredRowIconButton
                                tone="danger"
                                title="Permanently Purge"
                                ariaLabel="Permanently Purge"
                                disabled={isRestoring}
                                onClick={() => handlePermanentDelete(item)}
                              >
                                <Trash2 size={13} />
                              </CredRowIconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}

          <CredPagination
            page={currentPage}
            totalPages={totalPagesCount}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={totalRecordsCount}
            onPageChange={setCurrentPage}
            isMobile={isMobile}
          />
        </>
      )}
    </div>
  )
}

const headerCellStyle = {
  padding: '10px 8px',
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--text-muted, #8C8C8C)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap'
}

const bodyCellStyle = {
  padding: '9px 8px',
  verticalAlign: 'middle',
  fontSize: '13px'
}

export default RecycleBin
