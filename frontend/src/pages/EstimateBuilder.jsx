import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Check, X,
  FileText, Download, Printer, AlertCircle,
  Building2, Calendar, ShieldCheck, RefreshCw,
  ChevronRight, Info, Zap, Layers
} from 'lucide-react'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import Modal from '../components/common/Modal'
import { handlePdfResponse } from '../utils/pdfDownload'
import { showError, showToast, showWarning } from '../utils/swal'

const POPULAR_UNITS = ['pcs', 'sq.m', 'm', 'sheet', 'roll', 'kg', 'set', 'box', 'pack', 'day', 'hour']
const STATUS_OPTIONS = ['Draft', 'Sent', 'Approved', 'Rejected']

const ZohoLabel = ({ children, required, hint }) => (
  <label style={{
    fontSize: '13px',
    fontWeight: '500',
    color: '#334155',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  }}>
    {children}
    {required && <span style={{ color: '#ef4444', fontWeight: '700' }}>*</span>}
    {hint && (
      <span title={hint} style={{ color: '#94a3b8', cursor: 'help', display: 'inline-flex' }}>
        <Info size={13} />
      </span>
    )}
  </label>
)

const EstimateBuilder = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const basePath = '/accounting'
  const isEditing = Boolean(id)

  // Loading & Action States
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [downloadingClientPdf, setDownloadingClientPdf] = useState(false)
  const [downloadingAdminPdf, setDownloadingAdminPdf] = useState(false)

  // System Data
  const [materials, setMaterials] = useState([])
  const [customers, setCustomers] = useState([])
  const [categories, setCategories] = useState([])

  // Form State
  const [estimateNumber, setEstimateNumber] = useState('')
  const [formData, setFormData] = useState({
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

  const [newSectionInput, setNewSectionInput] = useState('')
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', company_name: '', phone: '', email: '', address: '' })
  const [submittingCustomer, setSubmittingCustomer] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [id])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [matRes, custRes, catRes] = await Promise.all([
        api.get('materials/').catch(() => ({ data: [] })),
        api.get('customers/').catch(() => ({ data: [] })),
        api.get('material-categories/').catch(() => ({ data: [] }))
      ])
      const toArray = (data) => Array.isArray(data) ? data : (data?.results || [])
      setMaterials(toArray(matRes.data))
      setCustomers(toArray(custRes.data))
      setCategories(toArray(catRes.data))

      if (isEditing) {
        const estRes = await api.get(`estimations/${id}/`)
        const est = estRes.data
        if (est) {
          setEstimateNumber(est.estimate_number || '')
          setFormData({
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
            tax_amount: parseFloat(est.tax_amount || 0),
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
        }
      }
    } catch (err) {
      console.error('Failed to load estimation builder data:', err)
      showError('Load Error', 'Could not load required estimation and material pricing data.')
    } finally {
      setLoading(false)
    }
  }

  // Section management
  const handleAddSection = () => {
    const trimmed = newSectionInput.trim()
    if (!trimmed) return
    if (!formData.sections_list.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        sections_list: [...prev.sections_list, trimmed]
      }))
    }
    setNewSectionInput('')
  }

  const handleRemoveSection = (secName) => {
    setFormData(prev => ({
      ...prev,
      sections_list: prev.sections_list.filter(s => s !== secName),
      activeSectionFilter: prev.activeSectionFilter === secName ? 'All' : prev.activeSectionFilter
    }))
  }

  // Items & Calculations
  const handleAddItemRow = (targetSection = 'General') => {
    const defSec = targetSection !== 'All' ? targetSection : (formData.sections_list[0] || 'General')
    const newItem = {
      temp_id: Math.random().toString(36).substring(2, 9),
      material: null,
      section_name: defSec,
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
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
  }

  const handleRemoveItemRow = (tempId) => {
    if (formData.items.length <= 1) {
      showToast('At least one item is required', 'warning')
      return
    }
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.temp_id !== tempId)
    }))
  }

  const handleSelectMaterialForItem = (tempId, materialId) => {
    const mat = materials.find(m => String(m.id) === String(materialId))
    if (!mat) return

    setFormData(prev => {
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

  const handleUpdateItemField = (tempId, field, value) => {
    setFormData(prev => {
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

  const liveTotals = useMemo(() => {
    const items = formData.items || []
    const subtotalCost = items.reduce((acc, i) => acc + (parseFloat(i.total_cost) || 0), 0)
    const subtotalPrice = items.reduce((acc, i) => acc + (parseFloat(i.total_price) || 0), 0)
    const tax = parseFloat(formData.tax_amount || 0)
    const totalPrice = subtotalPrice + tax
    const marginAmount = subtotalPrice - subtotalCost
    const marginPct = subtotalPrice > 0 ? ((marginAmount / subtotalPrice) * 100).toFixed(1) : 0
    return { subtotalCost, subtotalPrice, tax, totalPrice, marginAmount, marginPct }
  }, [formData.items, formData.tax_amount])

  const handleCustomerSelect = (val) => {
    const matched = customers.find(c => String(c.id) === String(val) || c.name.toLowerCase() === val.toLowerCase())
    if (matched) {
      setFormData(prev => ({
        ...prev,
        customer: matched.id,
        client_name: matched.name,
        client_contact: matched.phone || matched.email || prev.client_contact
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        customer: '',
        client_name: val
      }))
    }
  }

  const handleSubmit = async (overrideStatus) => {
    if (!formData.title.trim()) {
      showWarning('Title Required', 'Please enter a project or estimate title.')
      return
    }
    if (!formData.client_name.trim()) {
      showWarning('Client Required', 'Please specify a client name.')
      return
    }
    if (formData.items.length === 0) {
      showWarning('No Items', 'Please add at least one item to this estimate.')
      return
    }

    const finalStatus = overrideStatus || formData.status || 'Draft'

    try {
      setActionLoading(true)
      const payload = {
        title: formData.title.trim(),
        customer: formData.customer || null,
        client_name: formData.client_name.trim(),
        client_contact: formData.client_contact.trim(),
        date: formData.date,
        valid_until: formData.valid_until || null,
        status: finalStatus,
        sections_list: formData.sections_list,
        notes: formData.notes,
        tax_amount: parseFloat(formData.tax_amount || 0),
        items: formData.items.map((item, idx) => ({
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

      if (isEditing) {
        await api.put(`estimations/${id}/`, payload)
        showToast('Estimate updated successfully!', 'success')
      } else {
        await api.post('estimations/', payload)
        showToast(finalStatus === 'Draft' ? 'Estimate saved as Draft!' : 'Estimate saved successfully!', 'success')
      }
      navigate(`${basePath}/estimations`)
    } catch (err) {
      console.error('Failed to save estimate:', err)
      let errMsg = 'An error occurred while saving the estimate.'
      if (err.response?.data) {
        if (typeof err.response.data === 'string') errMsg = err.response.data
        else if (err.response.data.detail) errMsg = err.response.data.detail
        else errMsg = JSON.stringify(err.response.data)
      }
      showError('Save Failed', errMsg)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDownloadClientPdf = async () => {
    if (!id) return
    try {
      setDownloadingClientPdf(true)
      showToast('Generating Client Checklist PDF...', 'info')
      const res = await api.get(`estimations/${id}/client-pdf/`, { responseType: 'blob' })
      handlePdfResponse(res, `client_checklist_${estimateNumber || 'estimate'}.pdf`)
      showToast('Client checklist downloaded!', 'success')
    } catch (err) {
      console.error('Client PDF download error:', err)
      showError('Export Failed', 'Failed to generate client checklist PDF.')
    } finally {
      setDownloadingClientPdf(false)
    }
  }

  const handleDownloadAdminPdf = async () => {
    if (!id) return
    try {
      setDownloadingAdminPdf(true)
      showToast('Generating Admin Estimate PDF...', 'info')
      const res = await api.get(`estimations/${id}/admin-pdf/`, { responseType: 'blob' })
      handlePdfResponse(res, `admin_estimate_${estimateNumber || 'estimate'}.pdf`)
      showToast('Admin estimate downloaded!', 'success')
    } catch (err) {
      console.error('Admin PDF download error:', err)
      showError('Export Failed', 'Failed to generate admin estimate PDF.')
    } finally {
      setDownloadingAdminPdf(false)
    }
  }

  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    if (!newCustomerForm.name.trim()) {
      showToast('Customer name is required', 'error')
      return
    }
    try {
      setSubmittingCustomer(true)
      const { data } = await api.post('customers/', newCustomerForm)
      setCustomers(p => [...p, data])
      setFormData(p => ({
        ...p,
        customer: data.id,
        client_name: data.name,
        client_contact: data.phone || data.email || ''
      }))
      setIsCustomerModalOpen(false)
      setNewCustomerForm({ name: '', company_name: '', phone: '', email: '', address: '' })
      showToast('Customer created', 'success')
    } catch {
      showError('Failed', 'Could not create customer.')
    } finally {
      setSubmittingCustomer(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <SkeletonLoader rows={10} />
      </div>
    )
  }

  const selectedCustomerObj = customers.find(c => String(c.id) === String(formData.customer) || c.name.toLowerCase() === formData.client_name.toLowerCase())

  return (
    <div style={{ background: '#f3f4f7', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#1e293b' }}>

      {/* Top Header / Breadcrumb Bar (Zoho Style) */}
      <div className="builder-header" style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.85rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        <div className="builder-header-top" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => navigate(`${basePath}/estimations`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e2e8f0' }}
            title="Back to Estimations"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '12px', color: '#64748b' }}>
              <Link to={`${basePath}/estimations`} style={{ color: '#1366d9', textDecoration: 'none', fontWeight: '500' }}>Estimations</Link>
              <ChevronRight size={12} />
              <span>{isEditing ? 'Edit Estimate' : 'New Estimate'}</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', lineHeight: '1.2' }}>
              {isEditing ? `Edit Estimate: ${estimateNumber || 'Draft'}` : 'New Estimate & Production Checklist'}
            </h1>
          </div>
        </div>

        {/* Quick actions top right */}
        <div className="builder-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isEditing && (
            <>
              <button
                type="button"
                onClick={handleDownloadClientPdf}
                disabled={downloadingClientPdf}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  fontSize: '13px',
                  fontWeight: '500',
                  borderRadius: '6px',
                  border: '1px solid #bfdbfe',
                  background: '#eff6ff',
                  color: '#1366d9',
                  cursor: 'pointer'
                }}
                title="Client-facing PDF"
              >
                {downloadingClientPdf ? <RefreshCw size={14} className="spin" /> : <Download size={14} />} Client Checklist PDF
              </button>

              <button
                type="button"
                onClick={handleDownloadAdminPdf}
                disabled={downloadingAdminPdf}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  fontSize: '13px',
                  fontWeight: '500',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer'
                }}
                title="Admin full breakdown PDF"
              >
                {downloadingAdminPdf ? <RefreshCw size={14} className="spin" /> : <Printer size={14} />} Admin PDF
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => navigate(`${basePath}/estimations`)}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '13px',
              fontWeight: '500',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSubmit('Draft')}
            disabled={actionLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.9rem',
              fontSize: '13px',
              fontWeight: '500',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#1e293b',
              cursor: 'pointer'
            }}
          >
            Save as Draft
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={actionLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1.1rem',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              background: '#1366d9',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(19,102,217,0.3)'
            }}
          >
            {actionLoading ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
            {isEditing ? 'Update Estimate' : 'Save & Build Estimate'}
          </button>
        </div>
      </div>

      {/* Main Zoho Document Sheet Canvas */}
      <div className="builder-canvas" style={{ maxWidth: '1280px', width: '100%', margin: '1.5rem auto 3rem', padding: '0 1.5rem', flex: 1, boxSizing: 'border-box' }}>

        <div style={{
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden'
        }}>

          {/* Customer Selection Row */}
          <div className="builder-card-section" style={{ padding: '1.75rem 2rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ maxWidth: '520px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <ZohoLabel required hint="Select or add the customer for this estimation">Customer / Client Name</ZohoLabel>
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    background: 'none',
                    border: 'none',
                    color: '#1366d9',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <Plus size={13} /> New Customer
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  list="estimate-customer-suggestions"
                  className="input-field"
                  value={formData.client_name}
                  onChange={e => handleCustomerSelect(e.target.value)}
                  required
                  style={{
                    height: '38px',
                    fontSize: '13.5px',
                    borderRadius: '6px',
                    borderColor: '#cbd5e1',
                    fontWeight: formData.client_name ? '600' : '400',
                    color: formData.client_name ? '#0f172a' : '#64748b'
                  }}
                />
                <datalist id="estimate-customer-suggestions">
                  {customers.map(c => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>

              {/* Selected Customer Info Badge */}
              {selectedCustomerObj && (
                <div style={{
                  marginTop: '0.65rem',
                  padding: '0.65rem 0.85rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '12.5px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '600', color: '#1e293b' }}>{selectedCustomerObj.name}</span>
                    {selectedCustomerObj.phone && (
                      <span style={{ color: '#64748b' }}>Tel: {selectedCustomerObj.phone}</span>
                    )}
                  </div>
                  {selectedCustomerObj.address && (
                    <div style={{ color: '#64748b', lineHeight: '1.4' }}>{selectedCustomerObj.address}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Form Properties Grid (Zoho Style 4-Column Row) */}
          <div className="builder-card-section" style={{ padding: '1.5rem 2rem', background: '#fafbfc', borderBottom: '1px solid #e2e8f0' }}>
            <div className="builder-form-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem 1.5rem'
            }}>
              
              {/* Title */}
              <div className="builder-grid-span2" style={{ gridColumn: 'span 2' }}>
                <ZohoLabel required hint="Project or exhibition title for this estimate">Project / Estimate Title</ZohoLabel>
                <input
                  type="text"
                  className="input-field"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  required
                  style={{ height: '36px', fontSize: '13.5px', fontWeight: '600', borderRadius: '6px', borderColor: '#cbd5e1' }}
                />
              </div>

              {/* Status */}
              <div>
                <ZohoLabel>Status</ZohoLabel>
                <select
                  className="input-field"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  style={{ height: '36px', fontSize: '13.5px', fontWeight: '600', borderRadius: '6px', borderColor: '#cbd5e1' }}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Contact Person */}
              <div>
                <ZohoLabel hint="Direct contact person or phone for this project">Client Contact Person</ZohoLabel>
                <input
                  type="text"
                  className="input-field"
                  value={formData.client_contact}
                  onChange={e => setFormData({ ...formData, client_contact: e.target.value })}
                  style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px', borderColor: '#cbd5e1' }}
                />
              </div>

              {/* Estimate Date */}
              <div>
                <ZohoLabel required>Estimate Date</ZohoLabel>
                <input
                  type="date"
                  className="input-field"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                  style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px', borderColor: '#cbd5e1' }}
                />
              </div>

              {/* Valid Until */}
              <div>
                <ZohoLabel hint="Proposal validity period">Valid Until (Optional)</ZohoLabel>
                <input
                  type="date"
                  className="input-field"
                  value={formData.valid_until}
                  onChange={e => setFormData({ ...formData, valid_until: e.target.value })}
                  style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px', borderColor: '#cbd5e1' }}
                />
              </div>

            </div>
          </div>

          {/* Area / Section / Room Organizer Bar */}
          <div style={{
            padding: '1rem 2rem',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div className="mobile-pills-scroll" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px', flexShrink: 0 }}>
                <Layers size={14} style={{ color: '#1366d9' }} /> Filter Area:
              </span>
              
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, activeSectionFilter: 'All' }))}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: formData.activeSectionFilter === 'All' ? '#1366d9' : '#cbd5e1',
                  background: formData.activeSectionFilter === 'All' ? '#eff6ff' : '#ffffff',
                  color: formData.activeSectionFilter === 'All' ? '#1366d9' : '#475569',
                  fontWeight: '600',
                  fontSize: '12px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
                }}
              >
                All Areas ({formData.items.length})
              </button>

              {formData.sections_list.map((sec) => {
                const count = formData.items.filter(i => i.section_name === sec).length
                const isActive = formData.activeSectionFilter === sec
                return (
                  <div
                    key={sec}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: '6px',
                      background: isActive ? '#eff6ff' : '#ffffff',
                      border: '1px solid',
                      borderColor: isActive ? '#1366d9' : '#cbd5e1',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, activeSectionFilter: sec }))}
                      style={{
                        padding: '4px 8px',
                        border: 'none',
                        background: 'none',
                        color: isActive ? '#1366d9' : '#475569',
                        fontWeight: '600',
                        fontSize: '12px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {sec} ({count})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSection(sec)}
                      title={`Remove area "${sec}"`}
                      style={{
                        padding: '4px 5px',
                        border: 'none',
                        background: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Quick Add Area */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', width: 'auto' }}>
              <input
                type="text"
                value={newSectionInput}
                onChange={(e) => setNewSectionInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSection(); } }}
                style={{
                  padding: '4px 8px',
                  fontSize: '12.5px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  width: '130px'
                }}
              />
              <button
                type="button"
                onClick={handleAddSection}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1366d9',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                + Add Area
              </button>
            </div>
          </div>

          {/* Line Items Table (Classic Zoho Books Item Grid) */}
          <div className="builder-card-section" style={{ padding: '1.5rem 2rem' }}>
            
            {/* Desktop Table View */}
            <div className="desktop-only-table" style={{
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              overflow: 'hidden',
              marginBottom: '1rem'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ width: '36px', padding: '10px 8px', textAlign: 'center', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>#</th>
                    <th style={{ width: '110px', padding: '10px 8px', textAlign: 'left', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Area / Room</th>
                    <th style={{ padding: '10px 10px', textAlign: 'left', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Item Description</th>
                    <th style={{ width: '105px', padding: '10px 8px', textAlign: 'left', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Specs</th>
                    <th style={{ width: '70px', padding: '10px 6px', textAlign: 'center', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Qty</th>
                    <th style={{ width: '75px', padding: '10px 6px', textAlign: 'center', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Unit</th>
                    <th style={{ width: '125px', padding: '10px 6px', textAlign: 'left', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Shop</th>
                    <th style={{ width: '90px', padding: '10px 6px', textAlign: 'right', color: '#dc2626', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Cost (SAR)</th>
                    <th style={{ width: '95px', padding: '10px 6px', textAlign: 'right', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Price (SAR)</th>
                    <th style={{ width: '100px', padding: '10px 8px', textAlign: 'right', color: '#64748b', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Total</th>
                    <th style={{ width: '85px', padding: '10px 8px', textAlign: 'right', color: '#16a34a', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>Margin</th>
                    <th style={{ width: '36px', padding: '10px 6px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items
                    .filter(item => formData.activeSectionFilter === 'All' || item.section_name === formData.activeSectionFilter)
                    .map((item, idx) => {
                      const mat = materials.find(m => m.id === item.material)
                      const shopOptions = mat && Array.isArray(mat.shop_prices) ? mat.shop_prices : []

                      return (
                        <tr key={item.temp_id} style={{ borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
                          
                          {/* Row Index */}
                          <td style={{ padding: '8px 6px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                            {idx + 1}
                          </td>

                          {/* Area / Section */}
                          <td style={{ padding: '8px 6px', verticalAlign: 'top' }}>
                            <select
                              value={item.section_name}
                              onChange={(e) => handleUpdateItemField(item.temp_id, 'section_name', e.target.value)}
                              style={{
                                width: '100%',
                                height: '34px',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                                fontSize: '12px',
                                fontWeight: '600',
                                padding: '0 4px'
                              }}
                            >
                              {formData.sections_list.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                              {!formData.sections_list.includes(item.section_name) && (
                                <option value={item.section_name}>{item.section_name}</option>
                              )}
                            </select>
                          </td>

                          {/* Item Description & Quick Material Selector */}
                          <td style={{ padding: '8px 8px', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <input
                                type="text"
                                value={item.item_name}
                                onChange={(e) => handleUpdateItemField(item.temp_id, 'item_name', e.target.value)}
                                required
                                style={{
                                  height: '34px',
                                  padding: '0 8px',
                                  fontSize: '13px',
                                  borderRadius: '4px',
                                  border: '1px solid #e2e8f0',
                                  fontWeight: '600'
                                }}
                              />
                              {materials.length > 0 && (
                                <select
                                  value={item.material || ''}
                                  onChange={(e) => handleSelectMaterialForItem(item.temp_id, e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    fontSize: '0.85rem',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '5px',
                                    background: '#ffffff',
                                    color: item.material ? '#0f172a' : '#64748b',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    marginTop: '4px',
                                    transition: 'border-color 0.15s ease'
                                  }}
                                >
                                  <option value="">⚡ Pick from Price Chart...</option>
                                  {materials.map(m => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.customer_price} SAR)
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </td>

                          {/* Measurements / Specs */}
                          <td style={{ padding: '8px 6px', verticalAlign: 'top' }}>
                            <input
                              type="text"
                              value={item.measurements}
                              onChange={(e) => handleUpdateItemField(item.temp_id, 'measurements', e.target.value)}
                              style={{
                                width: '100%',
                                height: '34px',
                                padding: '0 6px',
                                fontSize: '12px',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0'
                              }}
                            />
                          </td>

                          {/* Qty */}
                          <td style={{ padding: '8px 6px', verticalAlign: 'top' }}>
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItemField(item.temp_id, 'quantity', e.target.value)}
                              required
                              style={{
                                width: '100%',
                                height: '34px',
                                textAlign: 'center',
                                fontSize: '13px',
                                fontWeight: '700',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0'
                              }}
                            />
                          </td>

                          {/* Unit */}
                          <td style={{ padding: '8px 6px', verticalAlign: 'top' }}>
                            <select
                              value={item.unit}
                              onChange={(e) => handleUpdateItemField(item.temp_id, 'unit', e.target.value)}
                              style={{
                                width: '100%',
                                height: '34px',
                                fontSize: '12px',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                                textAlign: 'center',
                                padding: '0 2px'
                              }}
                            >
                              {POPULAR_UNITS.map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>

                          {/* Shop */}
                          <td style={{ padding: '8px 6px', verticalAlign: 'top' }}>
                            {shopOptions.length > 0 ? (
                              <select
                                value={item.selected_shop_name}
                                onChange={(e) => {
                                  const selShop = shopOptions.find(s => s.shop_name === e.target.value)
                                  if (selShop) {
                                    handleUpdateItemField(item.temp_id, 'selected_shop_name', selShop.shop_name)
                                    handleUpdateItemField(item.temp_id, 'unit_cost', parseFloat(selShop.price || 0))
                                  } else {
                                    handleUpdateItemField(item.temp_id, 'selected_shop_name', e.target.value)
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  height: '34px',
                                  fontSize: '12px',
                                  borderRadius: '4px',
                                  border: '1px solid #e2e8f0',
                                  padding: '0 4px'
                                }}
                              >
                                <option value="">Select Shop...</option>
                                {shopOptions.map(s => (
                                  <option key={s.shop_name} value={s.shop_name}>
                                    {s.shop_name} ({s.price} SAR)
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={item.selected_shop_name}
                                onChange={(e) => handleUpdateItemField(item.temp_id, 'selected_shop_name', e.target.value)}
                                style={{
                                  width: '100%',
                                  height: '34px',
                                  fontSize: '12px',
                                  borderRadius: '4px',
                                  border: '1px solid #e2e8f0',
                                  padding: '0 6px'
                                }}
                              />
                            )}
                          </td>

                          {/* Cost (Admin) */}
                          <td style={{ padding: '8px 6px', verticalAlign: 'top' }}>
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_cost}
                              onChange={(e) => handleUpdateItemField(item.temp_id, 'unit_cost', e.target.value)}
                              style={{
                                width: '100%',
                                height: '34px',
                                textAlign: 'right',
                                fontSize: '12.5px',
                                color: '#dc2626',
                                fontWeight: '600',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                                padding: '0 4px'
                              }}
                            />
                          </td>

                          {/* Price */}
                          <td style={{ padding: '8px 6px', verticalAlign: 'top' }}>
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => handleUpdateItemField(item.temp_id, 'unit_price', e.target.value)}
                              required
                              style={{
                                width: '100%',
                                height: '34px',
                                textAlign: 'right',
                                fontSize: '13px',
                                fontWeight: '700',
                                color: '#0f172a',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                                padding: '0 4px'
                              }}
                            />
                          </td>

                          {/* Line Total */}
                          <td style={{ padding: '14px 8px 8px', textAlign: 'right', verticalAlign: 'top', fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
                            {parseFloat(item.total_price || 0).toLocaleString()} SAR
                          </td>

                          {/* Margin */}
                          <td style={{
                            padding: '14px 8px 8px',
                            textAlign: 'right',
                            verticalAlign: 'top',
                            fontWeight: '700',
                            fontSize: '12.5px',
                            color: parseFloat(item.margin) >= 0 ? '#16a34a' : '#dc2626'
                          }}>
                            {parseFloat(item.margin || 0).toLocaleString()} SAR
                          </td>

                          {/* Remove */}
                          <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'top' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(item.temp_id)}
                              title="Delete row"
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '4px',
                                border: 'none',
                                background: 'transparent',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s ease'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
                              onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>

                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {/* Mobile Native App Item Cards */}
            <div className="mobile-only-cards" style={{ marginBottom: '1rem' }}>
              {formData.items
                .filter(item => formData.activeSectionFilter === 'All' || item.section_name === formData.activeSectionFilter)
                .map((item, idx) => {
                  const mat = materials.find(m => m.id === item.material)
                  const shopOptions = mat && Array.isArray(mat.shop_prices) ? mat.shop_prices : []

                  return (
                    <div key={item.temp_id} className="builder-mobile-item-card">
                      <div className="builder-mobile-item-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '700', fontSize: '13px', color: '#1366d9' }}>
                            Item #{idx + 1}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: '#eff6ff',
                            color: '#1366d9'
                          }}>
                            {item.section_name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(item.temp_id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            padding: '2px 6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>

                      {/* Area / Section Dropdown */}
                      <div style={{ marginBottom: '0.5rem' }}>
                        <ZohoLabel>Area / Room</ZohoLabel>
                        <select
                          value={item.section_name}
                          onChange={(e) => handleUpdateItemField(item.temp_id, 'section_name', e.target.value)}
                          style={{
                            width: '100%',
                            height: '34px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            fontWeight: '600',
                            padding: '0 6px'
                          }}
                        >
                          {formData.sections_list.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      {/* Item Description & Quick Material Selector */}
                      <div style={{ marginBottom: '0.5rem' }}>
                        <ZohoLabel required>Item Description</ZohoLabel>
                        <input
                          type="text"
                          value={item.item_name}
                          onChange={(e) => handleUpdateItemField(item.temp_id, 'item_name', e.target.value)}
                          required
                          style={{
                            width: '100%',
                            height: '36px',
                            padding: '0 8px',
                            fontSize: '13px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            fontWeight: '600'
                          }}
                        />
                        {materials.length > 0 && (
                          <select
                            value={item.material || ''}
                            onChange={(e) => handleSelectMaterialForItem(item.temp_id, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              fontSize: '0.85rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '5px',
                              background: '#ffffff',
                              color: item.material ? '#0f172a' : '#64748b',
                              outline: 'none',
                              cursor: 'pointer',
                              marginTop: '6px',
                              transition: 'border-color 0.15s ease'
                            }}
                          >
                            <option value="">⚡ Pick from Price Chart...</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.customer_price} SAR)
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Specs / Measurements */}
                      <div style={{ marginBottom: '0.5rem' }}>
                        <ZohoLabel>Measurements / Specs</ZohoLabel>
                        <input
                          type="text"
                          value={item.measurements}
                          onChange={(e) => handleUpdateItemField(item.temp_id, 'measurements', e.target.value)}
                          style={{
                            width: '100%',
                            height: '34px',
                            padding: '0 8px',
                            fontSize: '12.5px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1'
                          }}
                        />
                      </div>

                      {/* 2x2 Grid for Qty & Unit, Customer Price & Cost */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div>
                          <ZohoLabel>Qty</ZohoLabel>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItemField(item.temp_id, 'quantity', e.target.value)}
                            required
                            style={{
                              width: '100%',
                              height: '34px',
                              textAlign: 'center',
                              fontSize: '13px',
                              fontWeight: '700',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1'
                            }}
                          />
                        </div>
                        <div>
                          <ZohoLabel>Unit</ZohoLabel>
                          <select
                            value={item.unit}
                            onChange={(e) => handleUpdateItemField(item.temp_id, 'unit', e.target.value)}
                            style={{
                              width: '100%',
                              height: '34px',
                              fontSize: '12.5px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              textAlign: 'center',
                              padding: '0 4px'
                            }}
                          >
                            {POPULAR_UNITS.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <ZohoLabel required>Price (SAR)</ZohoLabel>
                          <input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => handleUpdateItemField(item.temp_id, 'unit_price', e.target.value)}
                            required
                            style={{
                              width: '100%',
                              height: '34px',
                              textAlign: 'right',
                              fontSize: '13px',
                              fontWeight: '700',
                              color: '#0f172a',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              padding: '0 6px'
                            }}
                          />
                        </div>
                        <div>
                          <ZohoLabel hint="Internal shop cost">Cost (Admin)</ZohoLabel>
                          <input
                            type="number"
                            step="0.01"
                            value={item.unit_cost}
                            onChange={(e) => handleUpdateItemField(item.temp_id, 'unit_cost', e.target.value)}
                            style={{
                              width: '100%',
                              height: '34px',
                              textAlign: 'right',
                              fontSize: '12.5px',
                              color: '#dc2626',
                              fontWeight: '600',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              padding: '0 6px'
                            }}
                          />
                        </div>
                      </div>

                      {/* Shop / Supplier Selection */}
                      <div style={{ marginBottom: '0.65rem' }}>
                        <ZohoLabel>Shop / Supplier</ZohoLabel>
                        {shopOptions.length > 0 ? (
                          <select
                            value={item.selected_shop_name}
                            onChange={(e) => {
                              const selShop = shopOptions.find(s => s.shop_name === e.target.value)
                              if (selShop) {
                                handleUpdateItemField(item.temp_id, 'selected_shop_name', selShop.shop_name)
                                handleUpdateItemField(item.temp_id, 'unit_cost', parseFloat(selShop.price || 0))
                              } else {
                                handleUpdateItemField(item.temp_id, 'selected_shop_name', e.target.value)
                              }
                            }}
                            style={{
                              width: '100%',
                              height: '34px',
                              fontSize: '12px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              padding: '0 6px'
                            }}
                          >
                            <option value="">Select Shop...</option>
                            {shopOptions.map(s => (
                              <option key={s.shop_name} value={s.shop_name}>
                                {s.shop_name} ({s.price} SAR)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={item.selected_shop_name}
                            onChange={(e) => handleUpdateItemField(item.temp_id, 'selected_shop_name', e.target.value)}
                            style={{
                              width: '100%',
                              height: '34px',
                              fontSize: '12px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              padding: '0 8px'
                            }}
                          />
                        )}
                      </div>

                      {/* Line Total & Profit Margin Strip */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#f8fafc',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Line Margin</span>
                          <span style={{
                            fontWeight: '700',
                            fontSize: '13px',
                            color: parseFloat(item.margin) >= 0 ? '#16a34a' : '#dc2626'
                          }}>
                            {parseFloat(item.margin || 0).toLocaleString()} SAR
                          </span>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Quoted Total</span>
                          <span style={{ fontWeight: '800', fontSize: '15px', color: '#1366d9' }}>
                            {parseFloat(item.total_price || 0).toLocaleString()} SAR
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Zoho Add Row Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => handleAddItemRow(formData.activeSectionFilter)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#1366d9',
                  background: 'none',
                  border: 'none',
                  padding: '4px 8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <Plus size={15} /> Add another line
              </button>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                ({formData.items.length} {formData.items.length === 1 ? 'item' : 'items'})
              </span>
            </div>

          </div>

          {/* Bottom Split Section: Notes on Left, Zoho Summary Box on Right */}
          <div className="builder-split-bottom" style={{
            padding: '1.75rem 2rem 2.25rem',
            borderTop: '1px solid #f1f5f9',
            display: 'grid',
            gridTemplateColumns: 'minmax(350px, 1fr) 380px',
            gap: '2.5rem',
            alignItems: 'start'
          }}>

            {/* Left: Scope & Production Notes */}
            <div>
              <ZohoLabel hint="Visible in client checklist PDF">Scope & Production Notes</ZohoLabel>
              <textarea
                className="input-field"
                rows={5}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                style={{ fontSize: '13px', borderRadius: '6px', borderColor: '#cbd5e1', resize: 'vertical' }}
              />
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                These notes will be printed on the generated client checklist.
              </div>
            </div>

            {/* Right: Calculation Summary Card (Pure Zoho Books Layout) */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.25rem 1.5rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              
              {/* Internal Cost (Admin) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', fontSize: '13.5px' }}>
                <span style={{ color: '#64748b', fontWeight: '500' }}>Internal Cost (Admin)</span>
                <span style={{ fontWeight: '600', color: '#dc2626' }}>{liveTotals.subtotalCost.toLocaleString()} SAR</span>
              </div>

              {/* Quoted Subtotal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', fontSize: '13.5px' }}>
                <span style={{ color: '#475569', fontWeight: '500' }}>Customer Quoted Subtotal</span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>{liveTotals.subtotalPrice.toLocaleString()} SAR</span>
              </div>

              {/* Tax / VAT */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', fontSize: '13.5px' }}>
                <span style={{ color: '#475569', fontWeight: '500' }}>Tax / VAT (SAR)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.tax_amount}
                    onChange={e => setFormData({ ...formData, tax_amount: parseFloat(e.target.value) || 0 })}
                    style={{
                      width: '90px',
                      height: '30px',
                      textAlign: 'right',
                      padding: '0 6px',
                      fontSize: '13px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontWeight: '600'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>SAR</span>
                </div>
              </div>

              {/* Profit Margin */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', fontSize: '13.5px' }}>
                <span style={{ color: '#475569', fontWeight: '500' }}>Gross Profit Margin</span>
                <span style={{ fontWeight: '700', color: liveTotals.marginAmount >= 0 ? '#16a34a' : '#dc2626' }}>
                  {liveTotals.marginAmount.toLocaleString()} SAR ({liveTotals.marginPct}%)
                </span>
              </div>

              {/* Grand Total Row (Zoho Books Highlight) */}
              <div style={{
                borderTop: '2px solid #cbd5e1',
                marginTop: '0.75rem',
                paddingTop: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline'
              }}>
                <span style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a' }}>
                  Total (SAR)
                </span>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#1366d9', letterSpacing: '-0.01em' }}>
                  {liveTotals.totalPrice.toLocaleString()} SAR
                </span>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Sticky Bottom Action Toolbar (Zoho Books Signature Bar) */}
      <div className="builder-sticky-bar" style={{
        position: 'sticky',
        bottom: 0,
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '0.85rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 90,
        boxShadow: '0 -4px 12px rgba(0,0,0,0.04)'
      }}>
        <div className="builder-sticky-info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '12.5px', color: '#64748b' }}>
          <span style={{ fontWeight: '600', color: '#0f172a' }}>{formData.items.length} Items</span>
          <span>•</span>
          <span style={{ color: liveTotals.marginAmount >= 0 ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
            Margin: {liveTotals.marginPct}% ({liveTotals.marginAmount.toLocaleString()} SAR)
          </span>
        </div>

        <div className="builder-sticky-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={() => navigate(`${basePath}/estimations`)}
            style={{
              padding: '0.5rem 1.1rem',
              fontSize: '13.5px',
              fontWeight: '500',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSubmit('Draft')}
            disabled={actionLoading}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '13.5px',
              fontWeight: '500',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#1e293b',
              cursor: 'pointer'
            }}
          >
            Save as Draft
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={actionLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1.4rem',
              fontSize: '13.5px',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              background: '#1366d9',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(19,102,217,0.35)'
            }}
          >
            {actionLoading ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
            {isEditing ? 'Update Estimate' : 'Save & Build Estimate'}
          </button>
        </div>
      </div>

      {/* Quick Add Customer Modal */}
      <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title="New Customer">
        <form onSubmit={handleCreateCustomer}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1/-1' }}>
              <ZohoLabel required>Customer Name</ZohoLabel>
              <input
                type="text"
                className="input-field"
                value={newCustomerForm.name}
                onChange={e => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                required
                autoFocus
                style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1/-1' }}>
              <ZohoLabel>Company Name</ZohoLabel>
              <input
                type="text"
                className="input-field"
                value={newCustomerForm.company_name || ''}
                onChange={e => setNewCustomerForm({ ...newCustomerForm, company_name: e.target.value })}
                style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <ZohoLabel>Phone Number</ZohoLabel>
              <input
                type="text"
                className="input-field"
                value={newCustomerForm.phone}
                onChange={e => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <ZohoLabel>Email Address</ZohoLabel>
              <input
                type="email"
                className="input-field"
                value={newCustomerForm.email}
                onChange={e => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                style={{ height: '36px', fontSize: '13.5px', borderRadius: '6px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '1.25rem', gridColumn: '1/-1' }}>
              <ZohoLabel>Billing Address</ZohoLabel>
              <textarea
                className="input-field"
                rows={2}
                value={newCustomerForm.address}
                onChange={e => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                style={{ fontSize: '13px', borderRadius: '6px' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCustomerModalOpen(false)}
              disabled={submittingCustomer}
              style={{ padding: '0.45rem 1rem', fontSize: '13px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submittingCustomer}
              style={{ padding: '0.45rem 1.25rem', fontSize: '13px', background: '#1366d9', borderColor: '#1366d9' }}
            >
              {submittingCustomer ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  )
}

export default EstimateBuilder
