import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Plus, Minus, RefreshCw, AlertCircle, Trash2, Edit, 
  Download, Search, ChevronDown, Check, X,
  Calendar, FileSpreadsheet, Eye, EyeOff, MoreVertical,
  Layers, Briefcase,
  Building2, Printer, ArrowRight, Tag
} from '../components/icons'
import api from '../api'
import Modal from '../components/common/Modal'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { handlePdfResponse } from '../utils/pdfDownload'
import { showConfirm, showError, showToast, showWarning } from '../utils/swal'

const CALCULATION_TYPES = [
  { id: 'unit', label: 'Unit Based (Qty × Unit Price)', desc: 'Standard item pricing' },
  { id: 'area', label: 'Area Based (Width × Height × Qty × Rate)', desc: 'For banners, vinyls, boards' },
  { id: 'fixed', label: 'Fixed / Flat Rate', desc: 'Lump-sum rate irrespective of qty' }
]

const POPULAR_UNITS = ['pcs', 'sq.m', 'm', 'set', 'pack', 'roll', 'box', 'day', 'hour']

const DEFAULT_SECTIONS = ['All Items', 'Outside', 'VIP Room', 'Storage Room']

const Estimations = () => {
  const navigate = useNavigate()
  // Navigation
  const [activeTab, setActiveTab] = useState('estimations') // 'estimations' | 'materials'
  
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

  // Estimate Modal State
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false)
  const [editingEstimate, setEditingEstimate] = useState(null)
  const [estimateFormData, setEstimateFormData] = useState({
    title: '',
    customer: '',
    client_name: '',
    client_contact: '',
    date: new Date().toISOString().slice(0, 10),
    valid_until: '',
    status: 'Draft',
    sections_list: ['Outside', 'VIP Room', 'Storage Room'],
    activeSectionFilter: 'All',
    notes: '',
    tax_amount: 0,
    items: []
  })
  const [newSectionInput, setNewSectionInput] = useState('')

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
    color: '#2563eb'
  })

  // Estimate Detail / Preview Modal State
  const [viewingEstimate, setViewingEstimate] = useState(null)
  const [previewMode, setPreviewMode] = useState('client') // 'client' (no pricing) | 'admin' (full margin)

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
      setEstimations(estRes.data || [])
      setMaterials(matRes.data || [])
      setCategories(catRes.data || [])
      setCustomers(custRes.data || [])
    } catch (err) {
      console.error('Failed to load estimation data:', err)
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
  // ESTIMATION MODAL HANDLERS
  // ──────────────────────────────────────────────
  const handleOpenEstimateModal = (est = null) => {
    if (est) {
      setEditingEstimate(est)
      setEstimateFormData({
        title: est.title || '',
        customer: est.customer || '',
        client_name: est.client_name || (est.customer_name || ''),
        client_contact: est.client_contact || '',
        date: est.date || new Date().toISOString().slice(0, 10),
        valid_until: est.valid_until || '',
        status: est.status || 'Draft',
        sections_list: Array.isArray(est.sections_list) && est.sections_list.length > 0 
          ? est.sections_list 
          : ['Outside', 'VIP Room', 'Storage Room'],
        activeSectionFilter: 'All',
        notes: est.notes || '',
        tax_amount: est.tax_amount || 0,
        items: (est.items || []).map(i => ({
          ...i,
          temp_id: i.id || Math.random().toString(36).substring(2, 9),
          quantity: parseFloat(i.quantity || 1),
          unit_cost: parseFloat(i.unit_cost || 0),
          total_cost: parseFloat(i.total_cost || 0),
          unit_price: parseFloat(i.unit_price || 0),
          total_price: parseFloat(i.total_price || 0),
          margin: parseFloat(i.margin || 0),
          width: parseFloat(i.width || 0),
          height: parseFloat(i.height || 0),
        }))
      })
    } else {
      setEditingEstimate(null)
      setEstimateFormData({
        title: '',
        customer: '',
        client_name: '',
        client_contact: '',
        date: new Date().toISOString().slice(0, 10),
        valid_until: '',
        status: 'Draft',
        sections_list: ['Outside', 'VIP Room', 'Storage Room'],
        activeSectionFilter: 'All',
        notes: '',
        tax_amount: 0,
        items: [
          {
            temp_id: Math.random().toString(36).substring(2, 9),
            section_name: 'Outside',
            item_name: '',
            measurements: '',
            quantity: 1,
            unit: 'pcs',
            calculation_type: 'unit',
            width: 0,
            height: 0,
            selected_shop_name: '',
            unit_cost: 0,
            total_cost: 0,
            unit_price: 0,
            total_price: 0,
            margin: 0,
            notes: ''
          }
        ]
      })
    }
    setIsEstimateModalOpen(true)
  }

  // Add new section to estimate
  const handleAddSection = () => {
    const trimmed = newSectionInput.trim()
    if (!trimmed) return
    if (!estimateFormData.sections_list.includes(trimmed)) {
      setEstimateFormData(prev => ({
        ...prev,
        sections_list: [...prev.sections_list, trimmed]
      }))
    }
    setNewSectionInput('')
  }

  // Remove section from estimate
  const handleRemoveSection = (secName) => {
    setEstimateFormData(prev => ({
      ...prev,
      sections_list: prev.sections_list.filter(s => s !== secName),
      activeSectionFilter: prev.activeSectionFilter === secName ? 'All' : prev.activeSectionFilter
    }))
  }

  // Add item row
  const handleAddItemRow = (targetSection = 'General') => {
    const newItem = {
      temp_id: Math.random().toString(36).substring(2, 9),
      material: null,
      section_name: targetSection !== 'All' ? targetSection : (estimateFormData.sections_list[0] || 'General'),
      item_name: '',
      measurements: '',
      quantity: 1,
      unit: 'pcs',
      calculation_type: 'unit',
      width: 0,
      height: 0,
      selected_shop_name: '',
      unit_cost: 0,
      total_cost: 0,
      unit_price: 0,
      total_price: 0,
      margin: 0,
      notes: ''
    }
    setEstimateFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
  }

  // Remove item row
  const handleRemoveItemRow = (tempId) => {
    setEstimateFormData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.temp_id !== tempId)
    }))
  }

  // Select material from price chart
  const handleSelectMaterialForItem = (tempId, materialId) => {
    const mat = materials.find(m => String(m.id) === String(materialId))
    if (!mat) return

    setEstimateFormData(prev => {
      const updated = prev.items.map(item => {
        if (item.temp_id !== tempId) return item

        const shopPrices = Array.isArray(mat.shop_prices) ? mat.shop_prices : []
        const lowestShop = shopPrices.length > 0 
          ? shopPrices.reduce((prev, curr) => parseFloat(curr.price) < parseFloat(prev.price) ? curr : prev, shopPrices[0])
          : null

        const uCost = lowestShop ? parseFloat(lowestShop.price || 0) : 0
        const uPrice = parseFloat(mat.customer_price || 0)
        const qty = parseFloat(item.quantity || 1)
        const calcType = mat.calculation_type || 'unit'
        const w = parseFloat(item.width || 0)
        const h = parseFloat(item.height || 0)

        let totCost = qty * uCost
        let totPrice = qty * uPrice
        if (calcType === 'area' && w > 0 && h > 0) {
          totCost = qty * (w * h) * uCost
          totPrice = qty * (w * h) * uPrice
        } else if (calcType === 'fixed') {
          totCost = uCost
          totPrice = uPrice
        }

        return {
          ...item,
          material: mat.id,
          item_name: mat.name,
          measurements: mat.measurements || '',
          unit: mat.unit || 'pcs',
          calculation_type: calcType,
          selected_shop_name: lowestShop ? lowestShop.shop_name : '',
          unit_cost: uCost,
          total_cost: totCost,
          unit_price: uPrice,
          total_price: totPrice,
          margin: totPrice - totCost
        }
      })
      return { ...prev, items: updated }
    })
  }

  // Update item field and recalculate
  const handleUpdateItemField = (tempId, field, value) => {
    setEstimateFormData(prev => {
      const updated = prev.items.map(item => {
        if (item.temp_id !== tempId) return item

        const next = { ...item, [field]: value }

        const qty = parseFloat(next.quantity || 0)
        const uCost = parseFloat(next.unit_cost || 0)
        const uPrice = parseFloat(next.unit_price || 0)
        const calcType = next.calculation_type || 'unit'
        const w = parseFloat(next.width || 0)
        const h = parseFloat(next.height || 0)

        let totCost = qty * uCost
        let totPrice = qty * uPrice

        if (calcType === 'area' && w > 0 && h > 0) {
          totCost = qty * (w * h) * uCost
          totPrice = qty * (w * h) * uPrice
        } else if (calcType === 'fixed') {
          totCost = uCost
          totPrice = uPrice
        }

        next.total_cost = totCost
        next.total_price = totPrice
        next.margin = totPrice - totCost

        return next
      })
      return { ...prev, items: updated }
    })
  }

  // Live estimate totals in modal
  const estimateLiveTotals = useMemo(() => {
    const items = estimateFormData.items || []
    const subtotalCost = items.reduce((acc, i) => acc + (parseFloat(i.total_cost) || 0), 0)
    const subtotalPrice = items.reduce((acc, i) => acc + (parseFloat(i.total_price) || 0), 0)
    const tax = parseFloat(estimateFormData.tax_amount || 0)
    const totalPrice = subtotalPrice + tax
    const marginAmount = subtotalPrice - subtotalCost
    const marginPct = subtotalPrice > 0 ? ((marginAmount / subtotalPrice) * 100).toFixed(1) : 0
    return { subtotalCost, subtotalPrice, tax, totalPrice, marginAmount, marginPct }
  }, [estimateFormData.items, estimateFormData.tax_amount])

  // Save Estimate
  const handleSubmitEstimate = async (e) => {
    e.preventDefault()
    if (!estimateFormData.title.trim()) {
      showWarning('Title Required', 'Please enter a job/estimate title.')
      return
    }
    if (!estimateFormData.client_name.trim()) {
      showWarning('Client Required', 'Please specify a client name.')
      return
    }
    if (estimateFormData.items.length === 0) {
      showWarning('No Items', 'Please add at least one material/item to this estimate.')
      return
    }

    try {
      setActionLoading(true)
      const payload = {
        title: estimateFormData.title.trim(),
        customer: estimateFormData.customer || null,
        client_name: estimateFormData.client_name.trim(),
        client_contact: estimateFormData.client_contact.trim(),
        date: estimateFormData.date,
        valid_until: estimateFormData.valid_until || null,
        status: estimateFormData.status,
        sections_list: estimateFormData.sections_list,
        notes: estimateFormData.notes,
        tax_amount: parseFloat(estimateFormData.tax_amount || 0),
        items: estimateFormData.items.map((item, idx) => ({
          material: item.material || null,
          section_name: item.section_name || 'General',
          item_name: item.item_name || 'Untitled Item',
          measurements: item.measurements || '',
          quantity: parseFloat(item.quantity || 1),
          unit: item.unit || 'pcs',
          calculation_type: item.calculation_type || 'unit',
          width: parseFloat(item.width || 0),
          height: parseFloat(item.height || 0),
          selected_shop_name: item.selected_shop_name || '',
          unit_cost: parseFloat(item.unit_cost || 0),
          total_cost: parseFloat(item.total_cost || 0),
          unit_price: parseFloat(item.unit_price || 0),
          total_price: parseFloat(item.total_price || 0),
          margin: parseFloat(item.margin || 0),
          notes: item.notes || '',
          sort_order: idx
        }))
      }

      if (editingEstimate) {
        await api.put(`estimations/${editingEstimate.id}/`, payload)
        showToast('Estimate updated successfully!')
      } else {
        await api.post('estimations/', payload)
        showToast('Estimate created successfully!')
      }

      setIsEstimateModalOpen(false)
      fetchInitialData()
    } catch (err) {
      console.error('Failed to save estimate:', err)
      let errMsg = 'An error occurred while saving the estimate.'
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errMsg = err.response.data
        } else if (err.response.data.detail) {
          errMsg = err.response.data.detail
        } else {
          errMsg = Object.entries(err.response.data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`)
            .join('\n')
        }
      }
      showError('Failed to Save', errMsg)
    } finally {
      setActionLoading(false)
    }
  }

  // Delete Estimate
  const handleDeleteEstimate = async (est) => {
    const confirmed = await showConfirm(
      `Delete ${est.estimate_number}?`,
      'This will permanently remove this estimate and its item records.'
    )
    if (!confirmed) return

    try {
      await api.delete(`estimations/${est.id}/`)
      showToast('Estimate deleted.')
      fetchInitialData()
      if (viewingEstimate?.id === est.id) setViewingEstimate(null)
    } catch (err) {
      showError('Delete Failed', 'Could not delete estimate.')
    }
  }

  // Export Client PDF (Items + Quantities ONLY - zero pricing)
  const handleExportClientPdf = async (est) => {
    try {
      showToast('Generating Client Checklist PDF...', 'info')
      const res = await api.get(`estimations/${est.id}/client-pdf/`, { responseType: 'blob' })
      handlePdfResponse(res, `client_checklist_${est.estimate_number}.pdf`)
      showToast('Client checklist downloaded!')
    } catch (err) {
      console.error('PDF export error:', err)
      showError('Export Failed', 'Failed to generate client checklist PDF.')
    }
  }

  // Export Admin PDF (Complete financial and margin breakdown)
  const handleExportAdminPdf = async (est) => {
    try {
      showToast('Generating Admin Estimate PDF...', 'info')
      const res = await api.get(`estimations/${est.id}/admin-pdf/`, { responseType: 'blob' })
      handlePdfResponse(res, `admin_estimate_${est.estimate_number}.pdf`)
      showToast('Admin estimate downloaded!')
    } catch (err) {
      console.error('Admin PDF export error:', err)
      showError('Export Failed', 'Failed to generate admin estimate PDF.')
    }
  }

  // Convert to Job Order
  const handleConvertToJob = async (est) => {
    const confirmed = await showConfirm(
      `Convert ${est.estimate_number} to Job Order?`,
      `This will create an active Job Order titled "${est.title}" with quotation amount ${parseFloat(est.total_price || 0).toLocaleString()} SAR.`
    )
    if (!confirmed) return

    try {
      setActionLoading(true)
      const res = await api.post(`estimations/${est.id}/convert-to-job/`)
      showToast(res.data.message || 'Converted to Job Order!')
      fetchInitialData()
      if (viewingEstimate?.id === est.id) {
        setViewingEstimate(prev => ({ ...prev, status: 'Converted to Job' }))
      }
    } catch (err) {
      showError('Conversion Failed', err.response?.data?.message || 'Failed to convert to Job Order.')
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
      setMaterialFormData({
        name: mat.name || '',
        category: mat.category || '',
        measurements: mat.measurements || '',
        unit: mat.unit || 'pcs',
        customer_price: mat.customer_price || '',
        calculation_type: mat.calculation_type || 'unit',
        shop_prices: Array.isArray(mat.shop_prices) && mat.shop_prices.length > 0
          ? mat.shop_prices
          : [{ shop_name: '', price: '', notes: '' }],
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
        shop_prices: [
          { shop_name: 'Shop 1', price: '', notes: '' },
          { shop_name: 'Shop 2', price: '', notes: '' }
        ],
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
    } catch (err) {
      console.error('Failed to save material:', err)
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
    } catch (err) {
      showError('Delete Failed', 'Could not delete material.')
    }
  }

  // ──────────────────────────────────────────────
  // CATEGORY MODAL HANDLERS
  // ──────────────────────────────────────────────
  const handleOpenCategoryModal = () => {
    setCategoryFormData({ name: '', description: '', color: '#2563eb' })
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
      setCategories(catRes.data || [])
      // Auto select if in material modal
      if (isMaterialModalOpen) {
        setMaterialFormData(prev => ({ ...prev, category: res.data.id }))
      }
    } catch (err) {
      showError('Failed', 'Could not create category.')
    } finally {
      setActionLoading(false)
    }
  }

  // ──────────────────────────────────────────────
  // FILTERED DATA
  // ──────────────────────────────────────────────
  const filteredEstimations = useMemo(() => {
    return estimations.filter(est => {
      const matchSearch = searchQuery === '' || 
        (est.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (est.estimate_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (est.client_name || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchStatus = statusFilter === 'all' || est.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [estimations, searchQuery, statusFilter])

  const filteredMaterials = useMemo(() => {
    return materials.filter(mat => {
      const matchSearch = searchQuery === '' ||
        (mat.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (mat.measurements || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (mat.category_name || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchCat = selectedCategoryFilter === 'all' || String(mat.category) === String(selectedCategoryFilter)
      return matchSearch && matchCat
    })
  }, [materials, searchQuery, selectedCategoryFilter])

  return (
    <div className="estimations-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box', paddingBottom: '3rem' }}>
      {/* ── HEADER TITLE & CONTROLS ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={26} color="#2563eb" />
            Estimations & Material Pricing
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
            Complete material pricing, supplier comparison, and quoting tool for creating clean client estimates.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchInitialData}
            title="Refresh"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0.45rem 0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>

          {activeTab === 'estimations' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/estimations/new')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1.25rem', fontWeight: '700' }}
            >
              <Plus size={16} strokeWidth={2.5} />
              New Estimate
            </button>
          )}

          {activeTab === 'materials' && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleOpenCategoryModal}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0.5rem 1rem' }}
              >
                <Tag size={15} />
                + New Category
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleOpenMaterialModal()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1.25rem', fontWeight: '700' }}
              >
                <Plus size={16} strokeWidth={2.5} />
                Add Material
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── SEGMENTED TOP NAVIGATION TABS ── */}
      <div className="mobile-tabs-scroll" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '1.25rem',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        WebkitOverflowScrolling: 'touch'
      }}>
        <button
          type="button"
          onClick={() => { setActiveTab('estimations'); setSearchQuery(''); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: '700',
            fontSize: '0.9rem',
            cursor: 'pointer',
            color: activeTab === 'estimations' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'estimations' ? '3px solid #2563eb' : '3px solid transparent',
            marginBottom: '-2px',
            transition: 'all 0.15s ease',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >
          <FileSpreadsheet size={16} />
          Estimates & Quotations
          <span style={{
            fontSize: '0.72rem',
            padding: '2px 7px',
            borderRadius: '10px',
            background: activeTab === 'estimations' ? '#eff6ff' : '#f1f5f9',
            color: activeTab === 'estimations' ? '#2563eb' : '#64748b',
            fontWeight: '800'
          }}>
            {estimations.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('materials'); setSearchQuery(''); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: '700',
            fontSize: '0.9rem',
            cursor: 'pointer',
            color: activeTab === 'materials' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'materials' ? '3px solid #2563eb' : '3px solid transparent',
            marginBottom: '-2px',
            transition: 'all 0.15s ease',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >
          <Layers size={16} />
          Material Price Chart
          <span style={{
            fontSize: '0.72rem',
            padding: '2px 7px',
            borderRadius: '10px',
            background: activeTab === 'materials' ? '#eff6ff' : '#f1f5f9',
            color: activeTab === 'materials' ? '#2563eb' : '#64748b',
            fontWeight: '800'
          }}>
            {materials.length}
          </span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* TAB 1: ESTIMATES & QUOTATIONS                              */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeTab === 'estimations' && (
        <div>
          {/* KPI Ribbon */}
          <div className="summary-cards-grid mobile-2col-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.25rem'
          }}>
            <div className="mobile-kpi-compact" style={{ background: '#ffffff', borderRadius: '10px', padding: '1rem 1.25rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Active Estimates</div>
              <div className="kpi-val" style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{stats.totalCount}</div>
            </div>
            <div className="mobile-kpi-compact" style={{ background: '#ffffff', borderRadius: '10px', padding: '1rem 1.25rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Total Pipeline Value</div>
              <div className="kpi-val" style={{ fontSize: '1.5rem', fontWeight: '800', color: '#2563eb' }}>{stats.totalPipeline.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>SAR</span></div>
            </div>
            <div className="mobile-kpi-compact" style={{ background: '#ffffff', borderRadius: '10px', padding: '1rem 1.25rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Projected Gross Margin</div>
              <div className="kpi-val" style={{ fontSize: '1.5rem', fontWeight: '800', color: '#059669' }}>{stats.totalMargin.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>SAR</span></div>
            </div>
            <div className="mobile-kpi-compact" style={{ background: '#ffffff', borderRadius: '10px', padding: '1rem 1.25rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Average Profit Margin</div>
              <div className="kpi-val" style={{ fontSize: '1.5rem', fontWeight: '800', color: '#7c3aed' }}>{stats.avgMarginPct}%</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mobile-filter-stack" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            marginBottom: '1rem',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div className="mobile-full-input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem 0.45rem 2rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>

            <div className="mobile-full-input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' }}>Status:</span>
              <select
                className="input-field"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: 'auto' }}
              >
                <option value="all">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent to Client</option>
                <option value="Approved">Approved</option>
                <option value="Converted to Job">Converted to Job</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Estimates Table */}
          {loading ? (
            <SkeletonLoader rows={5} />
          ) : filteredEstimations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <FileSpreadsheet size={44} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#1e293b', margin: '0 0 6px' }}>No Estimations Found</h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>
                {searchQuery ? 'Try adjusting your search or filter.' : 'Create your first material estimate to prepare quotes and client checklists.'}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/estimations/new')}
                style={{ fontWeight: '700' }}
              >
                + Create Estimate
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="desktop-only-table" style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Estimate #</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Project / Title</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Client</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Items</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Quoted</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Margin %</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEstimations.map((est) => {
                        const clientName = est.client_name || est.customer_name || 'Client'
                        const itemsCount = est.items?.length || 0
                        const totalP = parseFloat(est.total_price || 0)
                        const marginPct = parseFloat(est.margin_percentage || 0)

                        return (
                          <tr 
                            key={est.id} 
                            style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                            onClick={() => { setViewingEstimate(est); setPreviewMode('client'); }}
                            className="table-row-hover"
                          >
                            <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: '#2563eb' }}>
                              {est.estimate_number}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                              {est.date}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: '#0f172a' }}>
                              {est.title}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                              {clientName}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '10px', background: '#f1f5f9', fontWeight: '700', fontSize: '0.75rem', color: '#475569' }}>
                                {itemsCount} items
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                              {totalP.toLocaleString()} SAR
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              <span style={{
                                fontWeight: '700',
                                color: marginPct >= 30 ? '#059669' : marginPct >= 15 ? '#d97706' : '#dc2626'
                              }}>
                                {marginPct}%
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: est.status === 'Approved' ? '#ecfdf5' : est.status === 'Converted to Job' ? '#eff6ff' : '#f8fafc',
                                color: est.status === 'Approved' ? '#059669' : est.status === 'Converted to Job' ? '#2563eb' : '#64748b',
                                border: '1px solid #e2e8f0'
                              }}>
                                {est.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleExportClientPdf(est)}
                                  title="Download Client Checklist (Zero Pricing)"
                                  style={{
                                    padding: '4px 7px',
                                    background: '#eff6ff',
                                    border: '1px solid #dbeafe',
                                    borderRadius: '6px',
                                    color: '#2563eb',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                >
                                  <Download size={13} />
                                  Client PDF
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleExportAdminPdf(est)}
                                  title="Download Admin Breakdown (Full Cost & Margin)"
                                  style={{
                                    padding: '4px 7px',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '6px',
                                    color: '#475569',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                >
                                  Admin PDF
                                </button>

                                <button
                                  type="button"
                                  onClick={() => navigate(`/estimations/${est.id}/edit`)}
                                  title="Edit Estimate"
                                  style={{
                                    padding: '4px 6px',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    color: '#0f172a',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Edit size={13} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteEstimate(est)}
                                  title="Delete Estimate"
                                  style={{
                                    padding: '4px 6px',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    color: '#dc2626',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Native App Cards */}
              <div className="mobile-only-cards">
                {filteredEstimations.map((est) => {
                  const clientName = est.client_name || est.customer_name || 'Client'
                  const itemsCount = est.items?.length || 0
                  const totalP = parseFloat(est.total_price || 0)
                  const marginPct = parseFloat(est.margin_percentage || 0)

                  return (
                    <div
                      key={est.id}
                      className="mobile-entity-card"
                      onClick={() => { setViewingEstimate(est); setPreviewMode('client'); }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Top row: Estimate #, Date, Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '0.5rem' }}>
                        <div>
                          <span style={{ fontWeight: '800', color: '#2563eb', fontSize: '0.9rem' }}>
                            {est.estimate_number}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '8px' }}>
                            {est.date}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: est.status === 'Approved' ? '#ecfdf5' : est.status === 'Converted to Job' ? '#eff6ff' : '#f8fafc',
                          color: est.status === 'Approved' ? '#059669' : est.status === 'Converted to Job' ? '#2563eb' : '#64748b',
                          border: '1px solid #e2e8f0',
                          flexShrink: 0
                        }}>
                          {est.status}
                        </span>
                      </div>

                      {/* Title / Project */}
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.35rem', lineHeight: '1.3' }}>
                        {est.title}
                      </div>

                      {/* Client */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: '#475569', marginBottom: '0.75rem' }}>
                        <Building2 size={13} color="#94a3b8" />
                        <span style={{ fontWeight: '600' }}>{clientName}</span>
                      </div>

                      {/* 3 Metrics Strip */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.5rem',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        padding: '0.6rem 0.75rem',
                        marginBottom: '0.75rem',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Quoted</div>
                          <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#0f172a', marginTop: '1px' }}>
                            {totalP.toLocaleString()} <span style={{ fontSize: '0.68rem', fontWeight: '600' }}>SAR</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Margin</div>
                          <div style={{
                            fontWeight: '800',
                            fontSize: '0.88rem',
                            marginTop: '1px',
                            color: marginPct >= 30 ? '#059669' : marginPct >= 15 ? '#d97706' : '#dc2626'
                          }}>
                            {marginPct}%
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Items</div>
                          <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#334155', marginTop: '1px' }}>
                            {itemsCount}
                          </div>
                        </div>
                      </div>

                      {/* Mobile Actions Footer */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          borderTop: '1px solid #f1f5f9',
                          paddingTop: '0.6rem'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleExportClientPdf(est)}
                          style={{
                            flex: 1,
                            padding: '0.45rem 0.5rem',
                            background: '#eff6ff',
                            border: '1px solid #dbeafe',
                            borderRadius: '6px',
                            color: '#2563eb',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <Download size={13} />
                          Client PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportAdminPdf(est)}
                          style={{
                            flex: 1,
                            padding: '0.45rem 0.5rem',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            color: '#475569',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <Download size={13} />
                          Admin PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/estimations/${est.id}/edit`)}
                          title="Edit Estimate"
                          style={{
                            padding: '0.45rem 0.65rem',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            color: '#0f172a'
                          }}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEstimate(est)}
                          title="Delete Estimate"
                          style={{
                            padding: '0.45rem 0.65rem',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            color: '#dc2626'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* TAB 2: MATERIAL PRICE CHART                                */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeTab === 'materials' && (
        <div>
          {/* Categories filter pills */}
          <div className="mobile-pills-scroll" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            overflowX: 'auto',
            paddingBottom: '0.5rem',
            marginBottom: '1rem',
            WebkitOverflowScrolling: 'touch'
          }}>
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter('all')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                border: selectedCategoryFilter === 'all' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: selectedCategoryFilter === 'all' ? '#eff6ff' : '#ffffff',
                color: selectedCategoryFilter === 'all' ? '#2563eb' : '#475569',
                fontWeight: '700',
                fontSize: '0.825rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              All Categories ({materials.length})
            </button>
            {categories.map((cat) => {
              const isSelected = String(selectedCategoryFilter) === String(cat.id)
              const count = materials.filter(m => String(m.category) === String(cat.id)).length
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(cat.id)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    border: isSelected ? `2px solid ${cat.color || '#2563eb'}` : '1px solid #cbd5e1',
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    color: isSelected ? (cat.color || '#2563eb') : '#475569',
                    fontWeight: '700',
                    fontSize: '0.825rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color || '#2563eb' }}></span>
                  {cat.name} ({count})
                </button>
              )
            })}
          </div>

          {/* Search bar */}
          <div className="mobile-filter-stack" style={{
            background: '#ffffff',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div className="mobile-full-input" style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 2rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem'
                }}
              />
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Showing <strong>{filteredMaterials.length}</strong> items in price chart
            </div>
          </div>

          {/* Materials Table */}
          {filteredMaterials.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <Layers size={44} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#1e293b', margin: '0 0 6px' }}>No Materials Found</h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>
                Add your first material with measurements, customer price, and multiple shop prices.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleOpenMaterialModal()}
                style={{ fontWeight: '700' }}
              >
                + Add Material
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="desktop-only-table" style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Item / Material Name</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Measurements / Specs</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Unit</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Customer Price</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Supplier / Shop Prices Comparison</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMaterials.map((mat) => {
                        const shopPrices = Array.isArray(mat.shop_prices) ? mat.shop_prices : []
                        const lowest = mat.lowest_shop_price

                        return (
                          <tr key={mat.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="table-row-hover">
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ fontWeight: '700', color: '#0f172a' }}>{mat.name}</div>
                              {mat.notes && (
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{mat.notes}</div>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: '#eff6ff',
                                color: '#2563eb',
                                border: '1px solid #dbeafe'
                              }}>
                                {mat.category_name || 'Uncategorized'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#334155', fontWeight: '500' }}>
                              {mat.measurements || '—'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                              {mat.unit}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                              {parseFloat(mat.customer_price || 0).toLocaleString()} SAR
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              {shopPrices.length === 0 ? (
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No shop quotes added</span>
                              ) : (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  {shopPrices.map((sp, sIdx) => {
                                    const isLowest = lowest && parseFloat(sp.price) === lowest
                                    return (
                                      <span
                                        key={sIdx}
                                        style={{
                                          fontSize: '0.72rem',
                                          padding: '2px 7px',
                                          borderRadius: '6px',
                                          background: isLowest ? '#ecfdf5' : '#f8fafc',
                                          color: isLowest ? '#059669' : '#334155',
                                          border: isLowest ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                                          fontWeight: isLowest ? '800' : '600',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px'
                                        }}
                                        title={sp.notes || ''}
                                      >
                                        {sp.shop_name}: <strong>{parseFloat(sp.price || 0).toLocaleString()} SAR</strong>
                                        {isLowest && <span style={{ fontSize: '0.65rem' }}>★</span>}
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenMaterialModal(mat)}
                                  title="Edit Material"
                                  style={{
                                    padding: '4px 6px',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    color: '#0f172a',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Edit size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMaterial(mat)}
                                  title="Delete Material"
                                  style={{
                                    padding: '4px 6px',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    color: '#dc2626',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Native App Cards */}
              <div className="mobile-only-cards">
                {filteredMaterials.map((mat) => {
                  const shopPrices = Array.isArray(mat.shop_prices) ? mat.shop_prices : []
                  const lowest = mat.lowest_shop_price

                  return (
                    <div key={mat.id} className="mobile-entity-card">
                      {/* Card Top: Material Name & Category */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                        <div>
                          <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0f172a' }}>{mat.name}</div>
                          {mat.notes && (
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{mat.notes}</div>
                          )}
                        </div>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #dbeafe',
                          flexShrink: 0
                        }}>
                          {mat.category_name || 'Uncategorized'}
                        </span>
                      </div>

                      {/* Specs & Pricing Strip */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.5rem',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        padding: '0.6rem 0.75rem',
                        margin: '0.6rem 0',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Measurements</div>
                          <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#334155', marginTop: '1px' }}>
                            {mat.measurements || '—'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Customer Price</div>
                          <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#0f172a', marginTop: '1px' }}>
                            {parseFloat(mat.customer_price || 0).toLocaleString()} SAR <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#64748b' }}>/{mat.unit}</span>
                          </div>
                        </div>
                      </div>

                      {/* Supplier Comparison Quotes */}
                      <div style={{ marginBottom: '0.6rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                          Supplier Quotes ({shopPrices.length})
                        </div>
                        {shopPrices.length === 0 ? (
                          <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>No shop quotes added</div>
                        ) : (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {shopPrices.map((sp, sIdx) => {
                              const isLowest = lowest && parseFloat(sp.price) === lowest
                              return (
                                <span
                                  key={sIdx}
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    background: isLowest ? '#ecfdf5' : '#f8fafc',
                                    color: isLowest ? '#059669' : '#334155',
                                    border: isLowest ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                                    fontWeight: isLowest ? '800' : '600',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                  title={sp.notes || ''}
                                >
                                  {sp.shop_name}: <strong>{parseFloat(sp.price || 0).toLocaleString()} SAR</strong>
                                  {isLowest && <span style={{ fontSize: '0.65rem' }}>★</span>}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Actions Footer */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenMaterialModal(mat)}
                          style={{
                            padding: '0.4rem 0.85rem',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            color: '#0f172a',
                            fontSize: '0.78rem',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Edit size={13} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMaterial(mat)}
                          style={{
                            padding: '0.4rem 0.85rem',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            color: '#dc2626',
                            fontSize: '0.78rem',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}





      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 2: ADD / EDIT MATERIAL (WITH MULTIPLE SHOP PRICES)    */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        title={editingMaterial ? `Edit Material: ${editingMaterial.name}` : 'Add New Material to Price Chart'}
        maxWidth="750px"
      >
        <form onSubmit={handleSubmitMaterial}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group col-span-2">
              <label style={{ fontWeight: '700', fontSize: '0.85rem' }}>Material / Item Name *</label>
              <input
                type="text"
                className="input-field"
                value={materialFormData.name}
                onChange={(e) => setMaterialFormData({ ...materialFormData, name: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ margin: 0, fontWeight: '700', fontSize: '0.85rem' }}>Category</label>
                <button
                  type="button"
                  onClick={handleOpenCategoryModal}
                  style={{ fontSize: '0.72rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '700', padding: 0 }}
                >
                  + New Category
                </button>
              </div>
              <select
                className="input-field"
                value={materialFormData.category}
                onChange={(e) => setMaterialFormData({ ...materialFormData, category: e.target.value })}
              >
                <option value="">Select Category...</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontWeight: '700', fontSize: '0.85rem' }}>Unit of Measure</label>
              <select
                className="input-field"
                value={materialFormData.unit}
                onChange={(e) => setMaterialFormData({ ...materialFormData, unit: e.target.value })}
              >
                {POPULAR_UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontWeight: '700', fontSize: '0.85rem' }}>Measurements / Specifications</label>
              <input
                type="text"
                className="input-field"
                value={materialFormData.measurements}
                onChange={(e) => setMaterialFormData({ ...materialFormData, measurements: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: '700', fontSize: '0.85rem' }}>Customer Price (SAR) *</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                value={materialFormData.customer_price}
                onChange={(e) => setMaterialFormData({ ...materialFormData, customer_price: e.target.value })}
                required
              />
            </div>

            <div className="form-group col-span-2">
              <label style={{ fontWeight: '700', fontSize: '0.85rem' }}>Calculation Formula</label>
              <select
                className="input-field"
                value={materialFormData.calculation_type}
                onChange={(e) => setMaterialFormData({ ...materialFormData, calculation_type: e.target.value })}
              >
                {CALCULATION_TYPES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Supplier / Shop Prices Builder */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <div>
                <label style={{ margin: 0, fontWeight: '700', fontSize: '0.85rem', color: '#0f172a' }}>
                  Multiple Supplier / Shop Prices
                </label>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Compare quotes from multiple vendors/shops for this material (Motorola rollup example).
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddShopPriceRow}
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: '700' }}
              >
                + Add Shop Quote
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {materialFormData.shop_prices.map((sp, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1.5fr 30px', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={sp.shop_name}
                    onChange={(e) => handleUpdateShopPriceField(idx, 'shop_name', e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={sp.price}
                    onChange={(e) => handleUpdateShopPriceField(idx, 'price', e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', textAlign: 'right' }}
                  />
                  <input
                    type="text"
                    value={sp.notes}
                    onChange={(e) => handleUpdateShopPriceField(idx, 'notes', e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveShopPriceRow(idx)}
                    disabled={materialFormData.shop_prices.length <= 1}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontWeight: '700', fontSize: '0.85rem' }}>Notes (Optional)</label>
            <textarea
              className="input-field"
              rows="2"
              value={materialFormData.notes}
              onChange={(e) => setMaterialFormData({ ...materialFormData, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsMaterialModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={actionLoading}
              style={{ fontWeight: '700' }}
            >
              {actionLoading ? 'Saving...' : editingMaterial ? 'Update Material' : 'Save Material'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 3: CREATE CATEGORY                                   */}
      {/* ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Add Material Category"
        maxWidth="450px"
      >
        <form onSubmit={handleSubmitCategory}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: '700', fontSize: '0.85rem' }}>Category Name *</label>
            <input
              type="text"
              className="input-field"
              value={categoryFormData.name}
              onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: '700', fontSize: '0.85rem' }}>Description</label>
            <textarea
              className="input-field"
              rows="2"
              value={categoryFormData.description}
              onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: '700', fontSize: '0.85rem' }}>Category Color</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#475569'].map((c) => (
                <div
                  key={c}
                  onClick={() => setCategoryFormData({ ...categoryFormData, color: c })}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: c,
                    cursor: 'pointer',
                    border: categoryFormData.color === c ? '3px solid #0f172a' : '2px solid transparent'
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCategoryModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={actionLoading}
              style={{ fontWeight: '700' }}
            >
              Save Category
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL 4: ESTIMATE DETAIL & QUICK PREVIEW                    */}
      {/* ─────────────────────────────────────────────────────────── */}
      {viewingEstimate && (
        <Modal
          isOpen={Boolean(viewingEstimate)}
          onClose={() => setViewingEstimate(null)}
          title={`Estimate: ${viewingEstimate.estimate_number}`}
          maxWidth="950px"
        >
          <div className="estimate-preview-modal-content">
            {/* Header meta */}
            <div className="estimate-preview-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '0.75rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', wordBreak: 'break-word', lineHeight: '1.3' }}>
                  {viewingEstimate.title}
                </h3>
                <div className="estimate-preview-meta" style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                  <span>Client: <strong style={{ color: '#1e293b' }}>{viewingEstimate.client_name || viewingEstimate.customer_name}</strong></span>
                  <span>•</span>
                  <span>Date: {viewingEstimate.date}</span>
                  <span>•</span>
                  <span>Status: <span style={{ fontWeight: '700', color: '#2563eb' }}>{viewingEstimate.status}</span></span>
                </div>
              </div>

              {/* View Switcher: Client View vs Admin View */}
              <div className="estimate-preview-switcher" style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <button
                  type="button"
                  onClick={() => setPreviewMode('client')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: previewMode === 'client' ? '#2563eb' : 'transparent',
                    color: previewMode === 'client' ? '#ffffff' : '#475569',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Client View (Zero Prices)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('admin')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: previewMode === 'admin' ? '#0f172a' : 'transparent',
                    color: previewMode === 'admin' ? '#ffffff' : '#475569',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Admin View (Costs & Margins)
                </button>
              </div>
            </div>

            {/* Client View: Clean Checklist (Yokogawa style) */}
            {previewMode === 'client' ? (
              <div>
                <div style={{
                  background: '#eff6ff',
                  border: '1px solid #dbeafe',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '0.8rem',
                  color: '#1e40af',
                  lineHeight: '1.4'
                }}>
                  <EyeOff size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Client Presentation Mode:</strong> All pricing, unit costs, supplier names, and profit margins are strictly hidden.
                  </div>
                </div>

                {/* Group items by section */}
                {(() => {
                  const items = viewingEstimate.items || []
                  const sections = {}
                  items.forEach(i => {
                    const sec = i.section_name || 'General'
                    if (!sections[sec]) sections[sec] = []
                    sections[sec].push(i)
                  })

                  return Object.entries(sections).map(([secName, secItems]) => (
                    <div key={secName} style={{ marginBottom: '1.25rem' }}>
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: '800',
                        color: '#2563eb',
                        textTransform: 'uppercase',
                        marginBottom: '6px',
                        letterSpacing: '0.02em'
                      }}>
                        Area / Section: {secName} ({secItems.length} items)
                      </div>

                      {/* Desktop Table View (> 768px) */}
                      <div className="desktop-only-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left', border: '1px solid #e2e8f0', minWidth: '550px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569' }}>
                              <th style={{ padding: '0.5rem 0.75rem', width: '35px' }}>#</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Item Description</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Measurements / Specs</th>
                              <th style={{ padding: '0.5rem 0.75rem', width: '80px', textAlign: 'center' }}>Qty</th>
                              <th style={{ padding: '0.5rem 0.75rem', width: '70px', textAlign: 'center' }}>Unit</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Notes / Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {secItems.map((item, iIdx) => (
                              <tr key={item.id || iIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.45rem 0.75rem', color: '#94a3b8', fontWeight: '700' }}>{iIdx + 1}</td>
                                <td style={{ padding: '0.45rem 0.75rem', fontWeight: '700', color: '#0f172a' }}>{item.item_name}</td>
                                <td style={{ padding: '0.45rem 0.75rem', color: '#475569' }}>{item.measurements || 'Standard'}</td>
                                <td style={{ padding: '0.45rem 0.75rem', textAlign: 'center', fontWeight: '800' }}>{parseFloat(item.quantity)}</td>
                                <td style={{ padding: '0.45rem 0.75rem', textAlign: 'center', color: '#64748b' }}>{item.unit}</td>
                                <td style={{ padding: '0.45rem 0.75rem', color: '#64748b' }}>{item.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Native Card View (<= 768px) */}
                      <div className="mobile-only-cards" style={{ display: 'none', flexDirection: 'column', gap: '0.6rem' }}>
                        {secItems.map((item, iIdx) => (
                          <div
                            key={item.id || iIdx}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              padding: '0.75rem',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '0.35rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                                <span style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '4px',
                                  background: '#f1f5f9',
                                  color: '#64748b',
                                  fontSize: '0.72rem',
                                  fontWeight: '800',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {iIdx + 1}
                                </span>
                                <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.875rem', wordBreak: 'break-word' }}>
                                  {item.item_name}
                                </span>
                              </div>
                              <span style={{
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontWeight: '800',
                                fontSize: '0.8rem',
                                color: '#0f172a',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}>
                                {parseFloat(item.quantity)} {item.unit}
                              </span>
                            </div>

                            {item.measurements && item.measurements !== 'Standard' && (
                              <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '0.25rem', paddingLeft: '28px' }}>
                                <span style={{ color: '#94a3b8', fontWeight: '600' }}>Specs: </span>
                                <span>{item.measurements}</span>
                              </div>
                            )}

                            {item.notes && item.notes !== '—' && (
                              <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', paddingLeft: '28px', background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', marginTop: '4px' }}>
                                <span style={{ color: '#94a3b8', fontStyle: 'normal' }}>Note: </span>
                                {item.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                })()}
              </div>
            ) : (
              /* Admin View: Full Cost, Supplier, Price & Margin breakdown */
              <div>
                {/* Financial KPI Cards */}
                <div className="estimate-preview-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div className="kpi-label" style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>TOTAL MATERIAL COST</div>
                    <div className="kpi-val" style={{ fontSize: '1.1rem', fontWeight: '800', color: '#dc2626' }}>
                      {parseFloat(viewingEstimate.subtotal_cost || 0).toLocaleString()} SAR
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div className="kpi-label" style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>CUSTOMER QUOTED PRICE</div>
                    <div className="kpi-val" style={{ fontSize: '1.1rem', fontWeight: '800', color: '#2563eb' }}>
                      {parseFloat(viewingEstimate.subtotal_price || 0).toLocaleString()} SAR
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div className="kpi-label" style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>GROSS PROFIT MARGIN</div>
                    <div className="kpi-val" style={{ fontSize: '1.1rem', fontWeight: '800', color: '#059669' }}>
                      {parseFloat(viewingEstimate.margin_amount || 0).toLocaleString()} SAR
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div className="kpi-label" style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>PROFIT MARGIN %</div>
                    <div className="kpi-val" style={{ fontSize: '1.1rem', fontWeight: '800', color: '#7c3aed' }}>
                      {viewingEstimate.margin_percentage}%
                    </div>
                  </div>
                </div>

                {/* Desktop Table View (> 768px) */}
                <div className="desktop-only-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left', border: '1px solid #e2e8f0', minWidth: '680px' }}>
                    <thead>
                      <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                        <th style={{ padding: '0.5rem 0.6rem', width: '30px' }}>#</th>
                        <th style={{ padding: '0.5rem 0.6rem' }}>Item / Area</th>
                        <th style={{ padding: '0.5rem 0.6rem' }}>Supplier</th>
                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>Unit Cost</th>
                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>Total Cost</th>
                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>Unit Price</th>
                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>Total Price</th>
                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewingEstimate.items || []).map((item, idx) => (
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.45rem 0.6rem', color: '#94a3b8' }}>{idx + 1}</td>
                          <td style={{ padding: '0.45rem 0.6rem' }}>
                            <span style={{ fontWeight: '700', color: '#0f172a' }}>{item.item_name}</span>
                            <span style={{ fontSize: '0.7rem', color: '#2563eb', marginLeft: '6px' }}>[{item.section_name}]</span>
                          </td>
                          <td style={{ padding: '0.45rem 0.6rem', color: '#334155' }}>{item.selected_shop_name || '—'}</td>
                          <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center', fontWeight: '700' }}>{parseFloat(item.quantity)} {item.unit}</td>
                          <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#64748b' }}>{parseFloat(item.unit_cost).toLocaleString()}</td>
                          <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#dc2626' }}>{parseFloat(item.total_cost).toLocaleString()}</td>
                          <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#64748b' }}>{parseFloat(item.unit_price).toLocaleString()}</td>
                          <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>{parseFloat(item.total_price).toLocaleString()}</td>
                          <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: '700', color: parseFloat(item.margin) >= 0 ? '#059669' : '#dc2626' }}>
                            {parseFloat(item.margin).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View (<= 768px) */}
                <div className="mobile-only-cards" style={{ display: 'none', flexDirection: 'column', gap: '0.65rem' }}>
                  {(viewingEstimate.items || []).map((item, idx) => (
                    <div
                      key={item.id || idx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                        <div>
                          <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.875rem' }}>
                            {idx + 1}. {item.item_name}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: '700' }}>
                            {item.section_name || 'General'}
                          </span>
                        </div>
                        <span style={{ fontWeight: '800', fontSize: '0.8rem', color: '#0f172a' }}>
                          {parseFloat(item.quantity)} {item.unit}
                        </span>
                      </div>

                      {item.selected_shop_name && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' }}>
                          Supplier: <strong style={{ color: '#334155' }}>{item.selected_shop_name}</strong>
                        </div>
                      )}

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.4rem',
                        background: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        border: '1px solid #f1f5f9'
                      }}>
                        <div>
                          <div style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: '600' }}>COST</div>
                          <div style={{ color: '#dc2626', fontWeight: '800' }}>{parseFloat(item.total_cost).toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: '600' }}>PRICE</div>
                          <div style={{ color: '#0f172a', fontWeight: '800' }}>{parseFloat(item.total_price).toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: '600' }}>MARGIN</div>
                          <div style={{ color: parseFloat(item.margin) >= 0 ? '#059669' : '#dc2626', fontWeight: '800' }}>
                            {parseFloat(item.margin).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="estimate-preview-footer" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '1.25rem',
              borderTop: '1px solid #e2e8f0',
              paddingTop: '1rem',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <div className="estimate-preview-footer-left">
                {viewingEstimate.status !== 'Converted to Job' && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleConvertToJob(viewingEstimate)}
                    disabled={actionLoading}
                    style={{ fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Briefcase size={14} />
                    Convert to Job Order
                  </button>
                )}
              </div>

              <div className="estimate-preview-footer-right" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleExportClientPdf(viewingEstimate)}
                  style={{ fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Download size={14} />
                  Download Client Checklist (PDF)
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleExportAdminPdf(viewingEstimate)}
                  style={{ fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  Download Admin PDF
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const targetId = viewingEstimate?.id
                    setViewingEstimate(null)
                    if (targetId) navigate(`/estimations/${targetId}/edit`)
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Estimations
