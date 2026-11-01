import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download, Edit, Trash2, Plus, Search, Check, X,
  Layers, Briefcase, ChevronDown, Eye, EyeOff,
  FileUser, FileLock
} from 'lucide-react'
import api from '../api'
import PageHeaderButton from '../components/common/PageHeaderButton'
import { CredAnimatedTabs } from '../components/cashbook/cred/CredAnimatedTabs'
import CredSearchInput from '../components/cashbook/cred/CredSearchInput'
import CredPagination from '../components/cashbook/cred/CredPagination'
import GooeyMenu from '../components/cashbook/cred/GooeyMenu'
import PlainFilterDropdown from '../components/common/PlainFilterDropdown'
import {
  ModalShell,
  Field,
  TextInput,
  NumberInput,
  Select,
  Textarea
} from '../components/common/FormPrimitives'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { handlePdfResponse } from '../utils/pdfDownload'
import { showConfirm, showError, showToast, showWarning } from '../utils/swal'

const CALCULATION_TYPES = [
  { value: 'unit', label: 'Unit Based (Qty × Unit Price)' },
  { value: 'area', label: 'Area Based (Width × Height × Qty × Rate)' },
  { value: 'fixed', label: 'Fixed / Flat Rate' }
]

const POPULAR_UNITS = [
  { value: 'pcs', label: 'pcs' },
  { value: 'sq.m', label: 'sq.m' },
  { value: 'm', label: 'm' },
  { value: 'sheet', label: 'sheet' },
  { value: 'roll', label: 'roll' },
  { value: 'kg', label: 'kg' },
  { value: 'set', label: 'set' },
  { value: 'box', label: 'box' },
  { value: 'pack', label: 'pack' },
  { value: 'day', label: 'day' },
  { value: 'hour', label: 'hour' }
]

const Estimations = () => {
  const navigate = useNavigate()
  const basePath = '/accounting'

  // Navigation Tabs: 'estimations' | 'materials'
  const [activeTab, setActiveTab] = useState('estimations')

  // Data States
  const [estimations, setEstimations] = useState([])
  const [materials, setMaterials] = useState([])
  const [categories, setCategories] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all')

  // Pagination States
  const [estimatePage, setEstimatePage] = useState(1)
  const [materialPage, setMaterialPage] = useState(1)
  const pageSize = 15

  // Material Modal State
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState(null)
  const [materialFormData, setMaterialFormData] = useState({
    name: '',
    category: '',
    measurements: '',
    unit: 'pcs',
    customer_price: '',
    calculation_type: 'unit',
    shop_prices: [{ shop_name: '', price: '', notes: '' }],
    notes: ''
  })

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    color: '#0A0A0A'
  })

  // Estimate Detail / Preview Modal State
  const [viewingEstimate, setViewingEstimate] = useState(null)
  const [previewMode, setPreviewMode] = useState('client') // 'client' | 'admin'

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [estRes, matRes, catRes, custRes] = await Promise.all([
        api.get('estimations/').catch(() => ({ data: [] })),
        api.get('materials/').catch(() => ({ data: [] })),
        api.get('material-categories/').catch(() => ({ data: [] })),
        api.get('customers/').catch(() => ({ data: [] }))
      ])
      const toArr = (d) => Array.isArray(d) ? d : (d?.results || [])
      setEstimations(toArr(estRes.data))
      setMaterials(toArr(matRes.data))
      setCategories(toArr(catRes.data))
      setCustomers(toArr(custRes.data))
    } catch {
      showError('Failed to load data', 'Could not load estimations and material pricing.')
    } finally {
      setLoading(false)
    }
  }

  // ──────────────────────────────────────────────
  // STATS & KPIS
  // ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalCount = estimations.length
    const totalPipeline = estimations.reduce((acc, e) => acc + parseFloat(e.total_price || 0), 0)
    const totalMargin = estimations.reduce((acc, e) => acc + parseFloat(e.margin_amount || 0), 0)
    const avgMarginPct = totalPipeline > 0 ? ((totalMargin / totalPipeline) * 100).toFixed(1) : 0
    return { totalCount, totalPipeline, totalMargin, avgMarginPct }
  }, [estimations])

  // ──────────────────────────────────────────────
  // FILTERED ESTIMATIONS & PAGINATION
  // ──────────────────────────────────────────────
  const filteredEstimations = useMemo(() => {
    return estimations.filter(est => {
      const q = searchQuery.toLowerCase().trim()
      const matchSearch = !q ||
        (est.title && est.title.toLowerCase().includes(q)) ||
        (est.estimate_number && est.estimate_number.toLowerCase().includes(q)) ||
        (est.client_name && est.client_name.toLowerCase().includes(q)) ||
        (est.customer_name && est.customer_name.toLowerCase().includes(q))

      const matchStatus = statusFilter === 'all' || est.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [estimations, searchQuery, statusFilter])

  const paginatedEstimations = useMemo(() => {
    const start = (estimatePage - 1) * pageSize
    return filteredEstimations.slice(start, start + pageSize)
  }, [filteredEstimations, estimatePage, pageSize])

  // ──────────────────────────────────────────────
  // FILTERED MATERIALS & PAGINATION
  // ──────────────────────────────────────────────
  const filteredMaterials = useMemo(() => {
    return materials.filter(mat => {
      const q = searchQuery.toLowerCase().trim()
      const matchSearch = !q ||
        (mat.name && mat.name.toLowerCase().includes(q)) ||
        (mat.measurements && mat.measurements.toLowerCase().includes(q)) ||
        (mat.notes && mat.notes.toLowerCase().includes(q))

      const matchCat = selectedCategoryFilter === 'all' || String(mat.category) === String(selectedCategoryFilter)
      return matchSearch && matchCat
    })
  }, [materials, searchQuery, selectedCategoryFilter])

  const paginatedMaterials = useMemo(() => {
    const start = (materialPage - 1) * pageSize
    return filteredMaterials.slice(start, start + pageSize)
  }, [filteredMaterials, materialPage, pageSize])

  // ──────────────────────────────────────────────
  // STATUS & CATEGORY DROPDOWN OPTIONS
  // ──────────────────────────────────────────────
  const statusGooeyOptions = useMemo(() => [
    { id: 'all', value: 'all', label: 'All Statuses' },
    { id: 'Draft', value: 'Draft', label: 'Draft' },
    { id: 'Converted to Job', value: 'Converted to Job', label: 'Converted to Job' },
    { id: 'Sent', value: 'Sent', label: 'Sent' },
    { id: 'Approved', value: 'Approved', label: 'Approved' },
    { id: 'Rejected', value: 'Rejected', label: 'Rejected' },
  ], [])

  const categoryOptions = useMemo(() => [
    { value: 'all', label: `All Categories (${materials.length})` },
    ...categories.map(cat => ({
      value: String(cat.id),
      label: `${cat.name} (${materials.filter(m => String(m.category) === String(cat.id)).length})`
    }))
  ], [categories, materials])

  const categorySelectOptions = useMemo(() => [
    { value: '', label: 'Select category' },
    ...categories.map(c => ({ value: String(c.id), label: c.name }))
  ], [categories])

  // ──────────────────────────────────────────────
  // PDF & ACTION HANDLERS
  // ──────────────────────────────────────────────
  const handleExportClientPdf = async (est) => {
    try {
      showToast('Generating Client Checklist PDF...', 'info')
      const res = await api.get(`estimations/${est.id}/client-pdf/`, { responseType: 'blob' })
      handlePdfResponse(res, `client_checklist_${est.estimate_number || est.id}.pdf`)
      showToast('Client checklist downloaded!')
    } catch {
      showError('Export Failed', 'Failed to generate client checklist PDF.')
    }
  }

  const handleExportAdminPdf = async (est) => {
    try {
      showToast('Generating Admin Estimate PDF...', 'info')
      const res = await api.get(`estimations/${est.id}/admin-pdf/`, { responseType: 'blob' })
      handlePdfResponse(res, `admin_estimate_${est.estimate_number || est.id}.pdf`)
      showToast('Admin estimate downloaded!')
    } catch {
      showError('Export Failed', 'Failed to generate admin estimate PDF.')
    }
  }

  const handleDeleteEstimate = async (est) => {
    const confirmed = await showConfirm(
      `Delete ${est.estimate_number}?`,
      'This action cannot be undone and will delete all associated estimation line items.'
    )
    if (!confirmed) return

    try {
      await api.delete(`estimations/${est.id}/`)
      showToast('Estimate deleted successfully.')
      fetchInitialData()
    } catch {
      showError('Delete Failed', 'Could not delete estimate.')
    }
  }

  const handleConvertToJob = async (est) => {
    const confirmed = await showConfirm(
      `Convert ${est.estimate_number} to Job Order?`,
      'This will create a production Job Order with financial data locked into the cashbook.'
    )
    if (!confirmed) return

    try {
      setActionLoading(true)
      const res = await api.post(`estimations/${est.id}/convert-to-job/`, {})
      showToast('Converted to Job Order successfully!', 'success')
      setViewingEstimate(null)
      if (res.data?.job_order?.id) {
        navigate(`/jobs`)
      } else {
        fetchInitialData()
      }
    } catch {
      showError('Conversion Failed', 'Could not convert estimate to job order.')
    } finally {
      setActionLoading(false)
    }
  }

  // ──────────────────────────────────────────────
  // MATERIAL MODAL HANDLERS
  // ──────────────────────────────────────────────
  const handleOpenMaterialModal = (mat = null) => {
    if (mat) {
      setEditingMaterial(mat)
      const shopPrices = Array.isArray(mat.shop_prices) && mat.shop_prices.length > 0
        ? mat.shop_prices.map(p => ({ shop_name: p.shop_name || '', price: p.price ?? '', notes: p.notes || '' }))
        : [{ shop_name: '', price: '', notes: '' }]

      setMaterialFormData({
        name: mat.name || '',
        category: mat.category || '',
        measurements: mat.measurements || '',
        unit: mat.unit || 'pcs',
        customer_price: mat.customer_price ?? '',
        calculation_type: mat.calculation_type || 'unit',
        shop_prices: shopPrices,
        notes: mat.notes || ''
      })
    } else {
      setEditingMaterial(null)
      setMaterialFormData({
        name: '',
        category: categories[0]?.id || '',
        measurements: '',
        unit: 'pcs',
        customer_price: '',
        calculation_type: 'unit',
        shop_prices: [{ shop_name: '', price: '', notes: '' }],
        notes: ''
      })
    }
    setIsMaterialModalOpen(true)
  }

  const handleAddShopPriceRow = () => {
    setMaterialFormData(prev => ({
      ...prev,
      shop_prices: [...prev.shop_prices, { shop_name: '', price: '', notes: '' }]
    }))
  }

  const handleRemoveShopPriceRow = (idx) => {
    if (materialFormData.shop_prices.length <= 1) {
      setMaterialFormData(prev => ({
        ...prev,
        shop_prices: [{ shop_name: '', price: '', notes: '' }]
      }))
      return
    }
    setMaterialFormData(prev => ({
      ...prev,
      shop_prices: prev.shop_prices.filter((_, i) => i !== idx)
    }))
  }

  const handleUpdateShopPriceField = (idx, field, value) => {
    setMaterialFormData(prev => {
      const updated = [...prev.shop_prices]
      updated[idx] = { ...updated[idx], [field]: value }
      return { ...prev, shop_prices: updated }
    })
  }

  const handleSubmitMaterial = async (e) => {
    e.preventDefault()
    if (!materialFormData.name.trim()) {
      showWarning('Name Required', 'Please enter a material name.')
      return
    }

    try {
      setActionLoading(true)
      const payload = {
        name: materialFormData.name.trim(),
        category: materialFormData.category || null,
        measurements: materialFormData.measurements.trim(),
        unit: materialFormData.unit || 'pcs',
        customer_price: parseFloat(materialFormData.customer_price || 0),
        calculation_type: materialFormData.calculation_type,
        shop_prices: materialFormData.shop_prices
          .filter(p => p.shop_name.trim())
          .map(p => ({
            shop_name: p.shop_name.trim(),
            price: parseFloat(p.price || 0),
            notes: p.notes || ''
          })),
        notes: materialFormData.notes
      }

      if (editingMaterial) {
        await api.put(`materials/${editingMaterial.id}/`, payload)
        showToast('Material updated successfully!')
      } else {
        await api.post('materials/', payload)
        showToast('Material added to price chart!')
      }

      setIsMaterialModalOpen(false)
      fetchInitialData()
    } catch {
      showError('Failed to Save', 'Could not save material to price chart.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteMaterial = async (mat) => {
    const confirmed = await showConfirm(
      `Delete "${mat.name}"?`,
      'This will remove the item from the Material Price Chart.'
    )
    if (!confirmed) return

    try {
      await api.delete(`materials/${mat.id}/`)
      showToast('Material removed.')
      fetchInitialData()
    } catch {
      showError('Delete Failed', 'Could not delete material.')
    }
  }

  // ──────────────────────────────────────────────
  // CATEGORY MODAL HANDLERS
  // ──────────────────────────────────────────────
  const handleOpenCategoryModal = () => {
    setCategoryFormData({ name: '', description: '', color: '#0A0A0A' })
    setIsCategoryModalOpen(true)
  }

  const handleSubmitCategory = async (e) => {
    e.preventDefault()
    if (!categoryFormData.name.trim()) return

    try {
      setActionLoading(true)
      const res = await api.post('material-categories/', {
        name: categoryFormData.name.trim(),
        description: categoryFormData.description.trim(),
        color: categoryFormData.color
      })
      showToast(`Category "${res.data.name}" created!`)
      setIsCategoryModalOpen(false)
      const catRes = await api.get('material-categories/')
      const cats = Array.isArray(catRes.data) ? catRes.data : (catRes.data?.results || [])
      setCategories(cats)
      if (isMaterialModalOpen) {
        setMaterialFormData(prev => ({ ...prev, category: res.data.id }))
      }
    } catch {
      showError('Failed', 'Could not create category.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="estimations-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', paddingBottom: '3rem' }}>
      
      {/* Table overflow and scrollbar styles */}
      <style>{`
        .est-table-wrapper {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .est-table-wrapper::-webkit-scrollbar {
          display: none;
        }
        @media (min-width: 1100px) {
          .est-table-wrapper {
            overflow-x: hidden !important;
          }
        }
      `}</style>
      
      {/* ── 1. PAGE HEADER ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--text, #0A0A0A)'
        }}>
          Estimation
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeTab === 'estimations' && (
            <PageHeaderButton onClick={() => navigate(`${basePath}/estimations/new`)}>
              New Estimate
            </PageHeaderButton>
          )}

          {activeTab === 'materials' && (
            <>
              <button
                type="button"
                onClick={handleOpenCategoryModal}
                style={{
                  height: '36px',
                  padding: '0 14px',
                  background: 'transparent',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '9999px',
                  color: 'var(--text, #111111)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Plus size={14} />
                <span>New Category</span>
              </button>

              <PageHeaderButton onClick={() => handleOpenMaterialModal()}>
                Add Material
              </PageHeaderButton>
            </>
          )}
        </div>
      </div>

      {/* ── 2. ANIMATED TABS ── */}
      <div style={{ marginBottom: '20px' }}>
        <CredAnimatedTabs
          tabs={[
            { id: 'estimations', label: 'Estimates & Quotations', count: estimations.length },
            { id: 'materials', label: 'Material Price Chart', count: materials.length },
          ]}
          value={activeTab}
          onChange={(val) => {
            setActiveTab(val)
            setSearchQuery('')
            setEstimatePage(1)
            setMaterialPage(1)
          }}
          className="case-preserve"
          layoutId="estimations-main-tabs"
        />
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* TAB 1: ESTIMATES & QUOTATIONS                               */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeTab === 'estimations' && (
        <div>
          {/* 4 KPI CARDS (CRED Style - Display Only) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '20px'
          }}>
            {/* Card 1: Active Estimates */}
            <div style={{
              background: 'var(--card-bg, #FFFFFF)',
              borderRadius: '20px',
              padding: '18px 20px',
              border: '1px solid var(--border, #E4E4E4)',
              boxSizing: 'border-box',
              userSelect: 'none'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
                Active estimates
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                {stats.totalCount}
              </div>
            </div>

            {/* Card 2: Total Pipeline Value */}
            <div style={{
              background: 'var(--card-bg, #FFFFFF)',
              borderRadius: '20px',
              padding: '18px 20px',
              border: '1px solid var(--border, #E4E4E4)',
              boxSizing: 'border-box',
              userSelect: 'none'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
                Total pipeline value
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span>{Math.round(stats.totalPipeline).toLocaleString('en-US')}</span>
                <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>
              </div>
            </div>

            {/* Card 3: Projected Gross Margin */}
            <div style={{
              background: 'var(--card-bg, #FFFFFF)',
              borderRadius: '20px',
              padding: '18px 20px',
              border: '1px solid var(--border, #E4E4E4)',
              boxSizing: 'border-box',
              userSelect: 'none'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
                Projected gross margin
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span>{Math.round(stats.totalMargin).toLocaleString('en-US')}</span>
                <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>
              </div>
            </div>

            {/* Card 4: Average Profit Margin */}
            <div style={{
              background: 'var(--card-bg, #FFFFFF)',
              borderRadius: '20px',
              padding: '18px 20px',
              border: '1px solid var(--border, #E4E4E4)',
              boxSizing: 'border-box',
              userSelect: 'none'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', letterSpacing: '-0.01em', marginBottom: '8px' }}>
                Average profit margin
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                {stats.avgMarginPct}%
              </div>
            </div>
          </div>

          {/* TOOLBAR: Search + Gooey Status Filter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '16px',
            flexWrap: 'wrap'
          }}>
            <CredSearchInput
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setEstimatePage(1); }}
              onClear={() => { setSearchQuery(''); setEstimatePage(1); }}
              placeholder="Search estimates…"
              style={{ flex: '1 1 300px', maxWidth: '440px', height: '38px' }}
            />

            <div style={{ position: 'relative', zIndex: 60 }}>
              <GooeyMenu
                id="estimations-status-filter"
                value={statusFilter}
                onChange={(val) => { setStatusFilter(val); setEstimatePage(1); }}
                options={statusGooeyOptions}
                width={170}
                pillHeight={38}
                className="case-preserve"
                ariaLabel="Filter Estimates Status"
              />
            </div>
          </div>

          {/* TABLE */}
          {loading ? (
            <div style={{ padding: '24px 0' }}><SkeletonLoader count={5} /></div>
          ) : filteredEstimations.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: 'var(--card-bg, #FFFFFF)',
              borderRadius: '16px',
              border: '1px solid var(--border, #E4E4E4)',
              color: 'var(--text-muted, #8C8C8C)'
            }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>No estimates match your criteria.</p>
              <button
                type="button"
                className="page-header-btn"
                onClick={() => navigate(`${basePath}/estimations/new`)}
              >
                + New Estimate
              </button>
            </div>
          ) : (
            <div className="est-table-wrapper">
              <table style={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px'
              }}>
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                </colgroup>
                <thead>
                  <tr style={{
                    borderBottom: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--bg-subtle, #F7F7F7)'
                  }}>
                    <th style={{ padding: '10px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Estimate #</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Date</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Project / Title</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Client</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Items</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Total Quoted</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Margin %</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Status</th>
                    <th style={{ padding: '10px 12px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEstimations.map((est) => {
                    const clientName = est.client_name || est.customer_name || '—'
                    const itemsCount = est.items?.length || 0
                    const totalP = parseFloat(est.total_price || 0)
                    const marginPct = parseFloat(est.margin_percentage || 0)

                    return (
                      <tr
                        key={est.id}
                        onClick={() => { setViewingEstimate(est); setPreviewMode('client'); }}
                        style={{
                          borderBottom: '1px solid var(--border, #E4E4E4)',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {/* Estimate # */}
                        <td style={{ padding: '12px 12px', verticalAlign: 'top', whiteSpace: 'nowrap', fontWeight: 500, color: 'var(--text, #111111)', fontFamily: 'var(--font-mono, monospace)', fontSize: '12.5px' }}>
                          {est.estimate_number}
                        </td>

                        {/* Date */}
                        <td style={{ padding: '12px 12px', verticalAlign: 'top', whiteSpace: 'nowrap', color: 'var(--text-muted, #8C8C8C)', fontVariantNumeric: 'tabular-nums' }}>
                          {est.date || '—'}
                        </td>

                        {/* Project / Title (Wrap onto 2 lines instead of truncating with "…") */}
                        <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                          <div
                            title={est.title}
                            style={{
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.35,
                              wordBreak: 'break-word',
                              color: 'var(--text, #111111)',
                              fontWeight: 500
                            }}
                          >
                            {est.title || 'Untitled Estimate'}
                          </div>
                        </td>

                        {/* Client (Wrap onto 2 lines instead of truncating with "…") */}
                        <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                          <div
                            title={clientName}
                            style={{
                              color: 'var(--text, #111111)',
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.35,
                              wordBreak: 'break-word'
                            }}
                          >
                            {clientName}
                          </div>
                        </td>

                        {/* Items (plain right-aligned number) */}
                        <td style={{ padding: '12px 12px', verticalAlign: 'top', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text, #111111)' }}>
                          {itemsCount}
                        </td>

                        {/* Total Quoted */}
                        <td style={{ padding: '12px 12px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--text, #111111)' }}>
                          {totalP.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                        </td>

                        {/* Margin % (colored green text only, no pill) */}
                        <td style={{ padding: '12px 12px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--success, #16A34A)' }}>
                          {marginPct.toFixed(1)}%
                        </td>

                        {/* Status (plain text with small 6px dot) */}
                        <td style={{ padding: '12px 12px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12.5px',
                            color: 'var(--text, #111111)'
                          }}>
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: est.status === 'Converted to Job' || est.status === 'Approved'
                                ? 'var(--success, #16A34A)'
                                : est.status === 'Sent'
                                ? 'var(--warning, #D97706)'
                                : est.status === 'Rejected'
                                ? 'var(--danger, #DC2626)'
                                : 'var(--text-muted, #8C8C8C)'
                            }} />
                            {est.status || 'Draft'}
                          </span>
                        </td>

                        {/* Actions: 4 plain icon-only buttons with divider */}
                        <td style={{ padding: '10px 12px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            {/* 1. Client PDF */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleExportClientPdf(est)
                              }}
                              title="Download client PDF"
                              aria-label="Download client PDF"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '6px',
                                cursor: 'pointer',
                                color: 'var(--text-muted, #8C8C8C)',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s ease, background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--text, #111111)'
                                e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              <FileUser size={15} strokeWidth={1.8} />
                            </button>

                            {/* 2. Admin PDF */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleExportAdminPdf(est)
                              }}
                              title="Download admin PDF"
                              aria-label="Download admin PDF"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '6px',
                                cursor: 'pointer',
                                color: 'var(--text-muted, #8C8C8C)',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s ease, background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--text, #111111)'
                                e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              <FileLock size={15} strokeWidth={1.8} />
                            </button>

                            {/* Thin vertical divider between PDF pair and edit/delete pair */}
                            <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border, #E4E4E4)', margin: '0 1px', flexShrink: 0 }} />

                            {/* 3. Edit */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`${basePath}/estimations/${est.id}/edit`)
                              }}
                              title="Edit estimate"
                              aria-label="Edit estimate"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '6px',
                                cursor: 'pointer',
                                color: 'var(--text-muted, #8C8C8C)',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s ease, background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--text, #111111)'
                                e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              <Edit size={15} strokeWidth={1.8} />
                            </button>

                            {/* 4. Delete (Red on hover only) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteEstimate(est)
                              }}
                              title="Delete estimate"
                              aria-label="Delete estimate"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '6px',
                                cursor: 'pointer',
                                color: 'var(--text-muted, #8C8C8C)',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s ease, background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--danger, #DC2626)'
                                e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              <Trash2 size={15} strokeWidth={1.8} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filteredEstimations.length > pageSize && (
            <div style={{ marginTop: '16px' }}>
              <CredPagination
                currentPage={estimatePage}
                totalCount={filteredEstimations.length}
                pageSize={pageSize}
                onPageChange={setEstimatePage}
              />
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* TAB 2: MATERIAL PRICE CHART                                */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeTab === 'materials' && (
        <div>
          {/* TOOLBAR: Search + Plain Category Dropdown + Item count */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '16px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 360px', flexWrap: 'wrap' }}>
              <CredSearchInput
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setMaterialPage(1); }}
                onClear={() => { setSearchQuery(''); setMaterialPage(1); }}
                placeholder="Search materials…"
                style={{ flex: '1 1 240px', maxWidth: '420px', height: '38px' }}
              />

              <PlainFilterDropdown
                id="materials-category-filter"
                value={selectedCategoryFilter}
                onChange={(val) => { setSelectedCategoryFilter(val); setMaterialPage(1); }}
                options={categoryOptions}
                minWidth={170}
                ariaLabel="Filter Material Category"
              />
            </div>

            <span style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)', fontWeight: 400, whiteSpace: 'nowrap' }}>
              Showing <strong style={{ color: 'var(--text, #111111)', fontVariantNumeric: 'tabular-nums' }}>{filteredMaterials.length}</strong> items in price chart
            </span>
          </div>

          {/* TABLE */}
          {loading ? (
            <div style={{ padding: '24px 0' }}><SkeletonLoader count={5} /></div>
          ) : filteredMaterials.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: 'var(--card-bg, #FFFFFF)',
              borderRadius: '16px',
              border: '1px solid var(--border, #E4E4E4)',
              color: 'var(--text-muted, #8C8C8C)'
            }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>No materials match your search.</p>
              <button
                type="button"
                className="page-header-btn"
                onClick={() => handleOpenMaterialModal()}
              >
                + Add Material
              </button>
            </div>
          ) : (
            <div className="est-table-wrapper">
              <table style={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px'
              }}>
                <colgroup>
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '27.5%' }} />
                  <col style={{ width: '7.5%' }} />
                </colgroup>
                <thead>
                  <tr style={{
                    borderBottom: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--bg-subtle, #F7F7F7)'
                  }}>
                    <th style={{ padding: '10px 16px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Item / Material Name</th>
                    <th style={{ padding: '10px 16px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Category</th>
                    <th style={{ padding: '10px 16px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Specs</th>
                    <th style={{ padding: '10px 16px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Unit</th>
                    <th style={{ padding: '10px 24px 10px 16px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Customer Price</th>
                    <th style={{ minWidth: '280px', padding: '10px 16px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Supplier / Shop Prices</th>
                    <th style={{ minWidth: '80px', padding: '10px 16px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMaterials.map((mat) => {
                    const shopPrices = Array.isArray(mat.shop_prices) ? mat.shop_prices : []
                    const lowest = mat.lowest_shop_price

                    return (
                      <tr
                        key={mat.id}
                        style={{
                          borderBottom: '1px solid var(--border, #E4E4E4)',
                          transition: 'background-color 0.1s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {/* Name + Muted description */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 500, color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mat.name}>
                            {mat.name}
                          </div>
                          {mat.notes && (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mat.notes}>
                              {mat.notes}
                            </div>
                          )}
                        </td>

                        {/* Category (plain muted text, nowrap, no pill) */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'top', whiteSpace: 'nowrap', color: 'var(--text-muted, #8C8C8C)', fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={mat.category_name || ''}>
                          {mat.category_name || '—'}
                        </td>

                        {/* Specs (wrap onto second line, no truncation with "…") */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'top', color: 'var(--text, #111111)', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4 }} title={mat.measurements || ''}>
                          {mat.measurements || '—'}
                        </td>

                        {/* Unit (left-aligned with 16px padding on both sides) */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'left', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap' }}>
                          {mat.unit || 'pcs'}
                        </td>

                        {/* Customer Price (right-aligned with 24px right padding) */}
                        <td style={{ padding: '12px 24px 12px 16px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--text, #111111)' }}>
                          {parseFloat(mat.customer_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                        </td>

                        {/* Supplier / Shop Prices (Always top-to-bottom vertical list, one quote per line, no truncation) */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'top', minWidth: '280px' }}>
                          {shopPrices.length === 0 ? (
                            <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '12.5px' }}>—</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {shopPrices.map((sp, sIdx) => {
                                const isLowest = lowest && parseFloat(sp.price) === lowest
                                const spPrice = parseFloat(sp.price || 0)
                                return (
                                  <div
                                    key={sIdx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '12px',
                                      height: '22px',
                                      lineHeight: '22px',
                                      fontSize: '12.5px',
                                      color: isLowest ? 'var(--success, #16A34A)' : 'var(--text, #111111)',
                                      fontWeight: isLowest ? 500 : 400,
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    <span
                                      title={sp.shop_name}
                                      style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        flex: 1
                                      }}
                                    >
                                      {sp.shop_name}
                                    </span>
                                    <span
                                      style={{
                                        fontVariantNumeric: 'tabular-nums',
                                        textAlign: 'right',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0
                                      }}
                                    >
                                      {isLowest && <span style={{ marginRight: '3px' }} title="Best Price">★</span>}
                                      {spPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </td>

                        {/* Actions (Top aligned with first line, right-aligned) */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap', minWidth: '80px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenMaterialModal(mat)}
                              title="Edit Material"
                              aria-label="Edit Material"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '6px',
                                cursor: 'pointer',
                                color: 'var(--text-muted, #8C8C8C)',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s ease, background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--text, #111111)'
                                e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              <Edit size={15} strokeWidth={1.8} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteMaterial(mat)}
                              title="Delete Material"
                              aria-label="Delete Material"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '6px',
                                cursor: 'pointer',
                                color: 'var(--text-muted, #8C8C8C)',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s ease, background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--danger, #DC2626)'
                                e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              <Trash2 size={15} strokeWidth={1.8} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filteredMaterials.length > pageSize && (
            <div style={{ marginTop: '16px' }}>
              <CredPagination
                currentPage={materialPage}
                totalCount={filteredMaterials.length}
                pageSize={pageSize}
                onPageChange={setMaterialPage}
              />
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* ADD / EDIT MATERIAL MODAL (Enquiry ModalShell Reference)     */}
      {/* ─────────────────────────────────────────────────────────── */}
      <ModalShell
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        title={editingMaterial ? 'Edit Material' : 'New Material'}
        maxWidth="620px"
        formId="material-modal-form"
        submitLabel={editingMaterial ? 'Save Changes' : 'Create Material'}
        submittingLabel="Saving..."
        submitting={actionLoading}
      >
        <form id="material-modal-form" onSubmit={handleSubmitMaterial} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Material / Item Name* */}
          <Field label="Material / Item Name" required>
            <TextInput
              required
              placeholder="e.g. 5mm White Foam Board"
              value={materialFormData.name}
              onChange={(e) => setMaterialFormData(p => ({ ...p, name: e.target.value }))}
            />
          </Field>

          {/* Category + Unit of Measure (Two columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field
              label="Category"
              rightAction={
                <button
                  type="button"
                  onClick={handleOpenCategoryModal}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #8C8C8C)',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: 0
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text, #111111)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'}
                >
                  + New Category
                </button>
              }
            >
              <Select
                value={materialFormData.category}
                onChange={(e) => setMaterialFormData(p => ({ ...p, category: e.target.value }))}
                options={categorySelectOptions}
              />
            </Field>

            <Field label="Unit of Measure">
              <Select
                value={materialFormData.unit}
                onChange={(e) => setMaterialFormData(p => ({ ...p, unit: e.target.value }))}
                options={POPULAR_UNITS}
              />
            </Field>
          </div>

          {/* Measurements / Specs + Customer Price (SAR)* (Two columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Measurements / Specifications">
              <TextInput
                placeholder="e.g. 240cm × 120cm, 5mm"
                value={materialFormData.measurements}
                onChange={(e) => setMaterialFormData(p => ({ ...p, measurements: e.target.value }))}
              />
            </Field>

            <Field label="Customer Price (SAR)" required>
              <NumberInput
                prefix="SAR"
                required
                placeholder="0.00"
                value={materialFormData.customer_price}
                onChange={(e) => setMaterialFormData(p => ({ ...p, customer_price: e.target.value }))}
              />
            </Field>
          </div>

          {/* Calculation Formula */}
          <Field label="Calculation Formula">
            <Select
              value={materialFormData.calculation_type}
              onChange={(e) => setMaterialFormData(p => ({ ...p, calculation_type: e.target.value }))}
              options={CALCULATION_TYPES}
            />
          </Field>

          {/* Multiple Supplier / Shop Prices Section */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            paddingTop: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <label className="cred-form-label" style={{ margin: 0 }}>
                  Multiple Supplier / Shop Prices
                </label>
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                  Compare supplier rates. The lowest price will automatically be marked with a star glyph.
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddShopPriceRow}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text, #111111)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0
                }}
              >
                <Plus size={13} />
                <span>Add Shop Quote</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {materialFormData.shop_prices.map((sp, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr 32px', gap: '8px', alignItems: 'center' }}>
                  <TextInput
                    placeholder="Supplier / Shop Name"
                    value={sp.shop_name}
                    onChange={(e) => handleUpdateShopPriceField(idx, 'shop_name', e.target.value)}
                  />
                  <NumberInput
                    prefix="SAR"
                    placeholder="0.00"
                    value={sp.price}
                    onChange={(e) => handleUpdateShopPriceField(idx, 'price', e.target.value)}
                  />
                  <TextInput
                    placeholder="Specs / notes"
                    value={sp.notes}
                    onChange={(e) => handleUpdateShopPriceField(idx, 'notes', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveShopPriceRow(idx)}
                    title="Remove shop quote"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '6px',
                      cursor: 'pointer',
                      color: 'var(--text-muted, #8C8C8C)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '6px',
                      transition: 'color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger, #DC2626)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes (Optional) */}
          <Field label="Notes (Optional)">
            <Textarea
              rows={2}
              placeholder="Internal reminders, alternate specifications, or supplier contact details..."
              value={materialFormData.notes}
              onChange={(e) => setMaterialFormData(p => ({ ...p, notes: e.target.value }))}
            />
          </Field>
        </form>
      </ModalShell>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* CATEGORY MODAL (Enquiry ModalShell Reference)               */}
      {/* ─────────────────────────────────────────────────────────── */}
      <ModalShell
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="New Category"
        maxWidth="440px"
        formId="category-modal-form"
        submitLabel="Save Category"
        submittingLabel="Saving..."
        submitting={actionLoading}
      >
        <form id="category-modal-form" onSubmit={handleSubmitCategory} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Field label="Category Name" required>
            <TextInput
              required
              placeholder="e.g. Acrylic Sheets, Print Media"
              value={categoryFormData.name}
              onChange={(e) => setCategoryFormData(p => ({ ...p, name: e.target.value }))}
            />
          </Field>

          <Field label="Description (Optional)">
            <Textarea
              rows={2}
              placeholder="Brief description of materials in this category..."
              value={categoryFormData.description}
              onChange={(e) => setCategoryFormData(p => ({ ...p, description: e.target.value }))}
            />
          </Field>
        </form>
      </ModalShell>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* ESTIMATE DETAIL / PREVIEW MODAL                             */}
      {/* ─────────────────────────────────────────────────────────── */}
      {viewingEstimate && (
        <ModalShell
          isOpen={Boolean(viewingEstimate)}
          onClose={() => setViewingEstimate(null)}
          title={`Estimate: ${viewingEstimate.estimate_number}`}
          maxWidth="760px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                {viewingEstimate.status !== 'Converted to Job' && (
                  <button
                    type="button"
                    onClick={() => handleConvertToJob(viewingEstimate)}
                    disabled={actionLoading}
                    style={{
                      height: '36px',
                      padding: '0 14px',
                      background: 'transparent',
                      border: '1px solid var(--border, #E4E4E4)',
                      borderRadius: '9999px',
                      color: 'var(--text, #111111)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Briefcase size={14} />
                    <span>Convert to Job Order</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleExportClientPdf(viewingEstimate)}
                  style={{
                    height: '36px',
                    padding: '0 14px',
                    background: 'transparent',
                    border: '1px solid var(--border, #E4E4E4)',
                    borderRadius: '9999px',
                    color: 'var(--text, #111111)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={14} />
                  <span>Client Checklist</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportAdminPdf(viewingEstimate)}
                  style={{
                    height: '36px',
                    padding: '0 14px',
                    background: 'transparent',
                    border: '1px solid var(--border, #E4E4E4)',
                    borderRadius: '9999px',
                    color: 'var(--text, #111111)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={14} />
                  <span>Admin PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const tid = viewingEstimate.id
                    setViewingEstimate(null)
                    navigate(`${basePath}/estimations/${tid}/edit`)
                  }}
                  className="page-header-btn"
                >
                  Edit Estimate
                </button>
              </div>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Meta Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: 'var(--bg-subtle, #F7F7F7)', padding: '14px', borderRadius: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project / Title</div>
                <div style={{ fontWeight: 600, color: 'var(--text, #111111)', marginTop: '2px' }}>{viewingEstimate.title}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client</div>
                <div style={{ fontWeight: 500, color: 'var(--text, #111111)', marginTop: '2px' }}>{viewingEstimate.client_name || viewingEstimate.customer_name || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</div>
                <div style={{ fontWeight: 500, color: 'var(--text, #111111)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>{viewingEstimate.date || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
                <div style={{ fontWeight: 500, color: 'var(--text, #111111)', marginTop: '2px' }}>{viewingEstimate.status || 'Draft'}</div>
              </div>
            </div>

            {/* Financial Overview (Admin vs Client toggle) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text, #111111)' }}>
                Line Items ({viewingEstimate.items?.length || 0})
              </div>

              <div style={{ display: 'inline-flex', gap: '4px', background: 'var(--bg-subtle, #F7F7F7)', padding: '2px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPreviewMode('client')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: previewMode === 'client' ? 'var(--card-bg, #FFFFFF)' : 'transparent',
                    color: previewMode === 'client' ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)',
                    boxShadow: previewMode === 'client' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Client View
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('admin')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: previewMode === 'admin' ? 'var(--card-bg, #FFFFFF)' : 'transparent',
                    color: previewMode === 'admin' ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)',
                    boxShadow: previewMode === 'admin' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Admin Breakdown
                </button>
              </div>
            </div>

            {/* Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(viewingEstimate.items || []).map((it, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid var(--border, #E4E4E4)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontWeight: 500, color: 'var(--text, #111111)' }}>
                        {idx + 1}. {it.item_name}
                      </span>
                      {it.section_name && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginLeft: '8px' }}>
                          ({it.section_name})
                        </span>
                      )}
                    </div>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--text, #111111)' }}>
                      {it.quantity} {it.unit}
                    </span>
                  </div>

                  {previewMode === 'admin' && (
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', paddingTop: '4px', borderTop: '1px dotted var(--border, #E4E4E4)' }}>
                      <div><span style={{ color: 'var(--text-muted, #8C8C8C)' }}>Cost:</span> <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{parseFloat(it.total_cost || 0).toLocaleString()} SAR</strong></div>
                      <div><span style={{ color: 'var(--text-muted, #8C8C8C)' }}>Price:</span> <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{parseFloat(it.total_price || 0).toLocaleString()} SAR</strong></div>
                      <div><span style={{ color: 'var(--text-muted, #8C8C8C)' }}>Margin:</span> <strong style={{ color: 'var(--success, #16A34A)', fontVariantNumeric: 'tabular-nums' }}>{parseFloat(it.margin || 0).toLocaleString()} SAR</strong></div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals Summary */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--border, #E4E4E4)' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>Total Quoted</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text, #111111)', fontVariantNumeric: 'tabular-nums' }}>
                  {parseFloat(viewingEstimate.total_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                </div>
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  )
}

export default Estimations
