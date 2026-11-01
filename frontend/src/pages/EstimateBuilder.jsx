import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  X, Plus, Trash2, Check, Download, Printer,
  AlertCircle, Search, ChevronDown
} from 'lucide-react'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import {
  ModalShell,
  Field,
  TextInput,
  Textarea
} from '../components/common/FormPrimitives'
import { handlePdfResponse } from '../utils/pdfDownload'
import { showError, showToast, showWarning, showConfirm } from '../utils/swal'

const POPULAR_UNITS = ['pcs', 'sq.m', 'm', 'sheet', 'roll', 'kg', 'set', 'box', 'pack', 'day', 'hour']
const STATUS_OPTIONS = ['Draft', 'Sent', 'Approved', 'Rejected']

// Format numbers in tabular CRED style
const formatTabular = (num) => {
  const val = parseFloat(num) || 0
  const parts = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {parts[0]}<span style={{ opacity: 0.55, fontSize: '0.85em' }}>.{parts[1]}</span>
    </span>
  )
}

const EstimateBuilder = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const basePath = '/accounting'
  const isEditing = Boolean(id)

  // Loading & Action States
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [downloadingClientPdf, setDownloadingClientPdf] = useState(false)
  const [downloadingAdminPdf, setDownloadingAdminPdf] = useState(false)
  const [isPdfDropdownOpen, setIsPdfDropdownOpen] = useState(false)
  const pdfDropdownRef = useRef(null)

  // Dirty state tracking for unsaved changes
  const [isDirty, setIsDirty] = useState(false)

  // System Lookups
  const [materials, setMaterials] = useState([])
  const [customers, setCustomers] = useState([])
  const [categories, setCategories] = useState([])

  // Customer dropdown search
  const [customerSearch, setCustomerSearch] = useState('')
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)
  const customerDropdownRef = useRef(null)

  // Quick Customer Creation Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', company_name: '', phone: '', email: '', address: '' })
  const [submittingCustomer, setSubmittingCustomer] = useState(false)

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

  // Area / Section inline input state
  const [isAddingArea, setIsAddingArea] = useState(false)
  const [newAreaInput, setNewAreaInput] = useState('')
  const [hoveredArea, setHoveredArea] = useState(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setIsCustomerDropdownOpen(false)
      }
      if (pdfDropdownRef.current && !pdfDropdownRef.current.contains(e.target)) {
        setIsPdfDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    fetchInitialData()
  }, [id])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const toArray = (data) => Array.isArray(data) ? data : (data?.results || [])
      const [matRes, custRes, catRes] = await Promise.all([
        api.get('materials/').catch(() => ({ data: [] })),
        api.get('customers/?page_size=1000').catch(() => ({ data: [] })),
        api.get('material-categories/').catch(() => ({ data: [] }))
      ])

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
      setIsDirty(false)
    } catch (err) {
      console.error('Failed to load estimation builder data:', err)
      showError('Load Error', 'Could not load required estimation and material pricing data.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Cancel / Close with unsaved changes prompt
  const handleCancelOrClose = async () => {
    if (isDirty) {
      const confirmed = await showConfirm({
        title: 'Discard unsaved changes?',
        text: 'You have unsaved changes in this estimate. Are you sure you want to discard them?',
        confirmButtonText: 'Discard Changes',
        cancelButtonText: 'Keep Editing',
        isDangerous: true
      })
      if (!confirmed) return
    }
    navigate(`${basePath}/estimations`)
  }

  // Section / Area Management
  const handleAddArea = () => {
    const trimmed = newAreaInput.trim()
    if (!trimmed) {
      setIsAddingArea(false)
      return
    }
    if (!formData.sections_list.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        sections_list: [...prev.sections_list, trimmed],
        activeSectionFilter: trimmed
      }))
      setIsDirty(true)
    }
    setNewAreaInput('')
    setIsAddingArea(false)
  }

  const handleRemoveArea = (secName) => {
    setFormData(prev => ({
      ...prev,
      sections_list: prev.sections_list.filter(s => s !== secName),
      activeSectionFilter: prev.activeSectionFilter === secName ? 'All' : prev.activeSectionFilter
    }))
    setIsDirty(true)
  }

  // Item Management & Calculations
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
    setIsDirty(true)
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
    setIsDirty(true)
  }

  const handleSelectMaterialForItem = (tempId, materialId) => {
    const mat = materials.find(m => String(m.id) === String(materialId))
    if (!mat) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(item => item.temp_id === tempId ? { ...item, material: null } : item)
      }))
      setIsDirty(true)
      return
    }

    setFormData(prev => {
      const updated = prev.items.map(item => {
        if (item.temp_id !== tempId) return item

        const shopPrices = Array.isArray(mat.shop_prices) ? mat.shop_prices : []
        const lowestShop = shopPrices.length > 0
          ? shopPrices.reduce((p, c) => parseFloat(c.price) < parseFloat(p.price) ? c : p, shopPrices[0])
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
    setIsDirty(true)
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
    setIsDirty(true)
  }

  // Live Calculations
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

  // Customer Selection
  const selectedCustomer = useMemo(() => {
    return customers.find(c => String(c.id) === String(formData.customer) || c.name.toLowerCase() === (formData.client_name || '').toLowerCase())
  }, [customers, formData.customer, formData.client_name])

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 20)
    const q = customerSearch.toLowerCase()
    return customers.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [customers, customerSearch])

  const handleSelectCustomer = (c) => {
    setFormData(prev => ({
      ...prev,
      customer: c.id,
      client_name: c.name,
      client_contact: c.phone || c.email || prev.client_contact
    }))
    setIsCustomerDropdownOpen(false)
    setIsDirty(true)
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
      setIsDirty(true)
    } catch (err) {
      console.error('Customer create error:', err)
      showError('Create Customer Failed', 'Could not create customer record.')
    } finally {
      setSubmittingCustomer(false)
    }
  }

  // Form Submit
  const handleSubmit = async (overrideStatus) => {
    if (!formData.title.trim()) {
      showWarning('Title Required', 'Please enter a project or estimate title.')
      return
    }
    if (!formData.client_name.trim()) {
      showWarning('Client Required', 'Please select or enter a client name.')
      return
    }
    if (formData.items.length === 0) {
      showWarning('No Items', 'Please add at least one item to this estimate.')
      return
    }

    const finalStatus = overrideStatus || formData.status || 'Draft'

    try {
      setSubmitting(true)
      setFormError('')
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
      setIsDirty(false)
      navigate(`${basePath}/estimations`)
    } catch (err) {
      console.error('Failed to save estimate:', err)
      let errMsg = 'An error occurred while saving the estimate.'
      if (err.response?.data) {
        if (typeof err.response.data === 'string') errMsg = err.response.data
        else if (err.response.data.detail) errMsg = err.response.data.detail
        else errMsg = JSON.stringify(err.response.data)
      }
      setFormError(errMsg)
      showError('Save Failed', errMsg)
    } finally {
      setSubmitting(false)
    }
  }

  // PDF Exports
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

  if (loading) {
    return (
      <div style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 20px' }}>
        <SkeletonLoader count={8} />
      </div>
    )
  }

  // Filtered items based on active area tab
  const visibleItems = formData.items.filter(item =>
    formData.activeSectionFilter === 'All' || item.section_name === formData.activeSectionFilter
  )

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: 'var(--card-bg, #ffffff)',
      color: 'var(--text, #111111)',
      fontFamily: 'inherit',
      boxSizing: 'border-box'
    }}>
      {/* Outer Centered Shell Matching Delivery Challan */}
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '24px 24px 100px',
        boxSizing: 'border-box'
      }}>

        {/* ── Page Header: Title + Close Icon (and PDF actions if editing) ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border, #E4E4E4)',
          marginBottom: '28px'
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '19px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'var(--text, #111111)'
            }}>
              {isEditing ? `Edit Estimate ${estimateNumber ? `(${estimateNumber})` : ''}` : 'New Estimate'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* When editing: PDF Download dropdown */}
            {isEditing && (
              <div ref={pdfDropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setIsPdfDropdownOpen(!isPdfDropdownOpen)}
                  aria-label="Download PDFs"
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text, #111111)',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-band, #F2F2F2)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--card-bg, #ffffff)'}
                >
                  <Download size={14} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
                  <span>Download</span>
                  <ChevronDown size={13} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
                </button>

                {isPdfDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '36px',
                    right: 0,
                    backgroundColor: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--border, #E4E4E4)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    zIndex: 200,
                    minWidth: '180px',
                    padding: '4px'
                  }}>
                    <button
                      type="button"
                      disabled={downloadingClientPdf}
                      onClick={() => {
                        setIsPdfDropdownOpen(false)
                        handleDownloadClientPdf()
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'none',
                        border: 'none',
                        borderRadius: '4px',
                        textAlign: 'left',
                        fontSize: '12.5px',
                        color: 'var(--text, #111111)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-band, #F2F2F2)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Download size={14} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
                      <span>{downloadingClientPdf ? 'Generating…' : 'Client Checklist PDF'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={downloadingAdminPdf}
                      onClick={() => {
                        setIsPdfDropdownOpen(false)
                        handleDownloadAdminPdf()
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'none',
                        border: 'none',
                        borderRadius: '4px',
                        textAlign: 'left',
                        fontSize: '12.5px',
                        color: 'var(--text, #111111)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-band, #F2F2F2)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Printer size={14} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
                      <span>{downloadingAdminPdf ? 'Generating…' : 'Admin PDF'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Plain X close button */}
            <button
              type="button"
              onClick={handleCancelOrClose}
              aria-label="Close"
              style={{
                background: 'none',
                border: 'none',
                padding: '6px',
                borderRadius: '6px',
                cursor: 'pointer',
                color: 'var(--text-muted, #8C8C8C)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text, #111111)'
                e.currentTarget.style.backgroundColor = 'var(--bg-band, #F2F2F2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {formError && (
          <div style={{
            padding: '10px 14px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '6px',
            color: '#DC2626',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{formError}</span>
          </div>
        )}

        {/* ── TOP SECTION: Zoho Two-Column Form Style (180px Label Left / Field Right) ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginBottom: '36px'
        }}>

          {/* Row 1: Customer / Client Name* */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              paddingTop: '9px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-muted, #8C8C8C)'
            }}>
              Customer Name<span className="cred-required-dot" />
            </label>

            <div ref={customerDropdownRef} style={{ position: 'relative', width: '100%', maxWidth: '480px' }}>
              <div
                onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                style={{
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              >
                <span style={{
                  color: (formData.client_name || selectedCustomer) ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {selectedCustomer
                    ? `${selectedCustomer.name}${selectedCustomer.company_name ? ` (${selectedCustomer.company_name})` : ''}`
                    : (formData.client_name || 'Select or add a customer')}
                </span>
                <ChevronDown size={15} style={{ color: 'var(--text-muted, #8C8C8C)', flexShrink: 0, marginLeft: '8px' }} />
              </div>

              {/* Customer Dropdown Panel */}
              {isCustomerDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '42px',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  zIndex: 200,
                  padding: '8px',
                  maxHeight: '280px',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border, #E4E4E4)', paddingBottom: '6px', marginBottom: '6px' }}>
                    <Search size={14} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{
                        border: 'none',
                        outline: 'none',
                        width: '100%',
                        fontSize: '12.5px',
                        color: 'var(--text, #111111)',
                        background: 'transparent'
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsCustomerDropdownOpen(false)
                      setIsCustomerModalOpen(true)
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 8px',
                      background: 'var(--bg-band, #F2F2F2)',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'var(--text, #111111)',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '6px'
                    }}
                  >
                    <Plus size={14} />
                    <span>New Customer</span>
                  </button>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {filteredCustomers.length === 0 ? (
                      <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', textAlign: 'center' }}>
                        No customers found
                      </div>
                    ) : (
                      filteredCustomers.map(c => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          style={{
                            padding: '7px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12.5px',
                            color: 'var(--text, #111111)',
                            backgroundColor: String(formData.customer) === String(c.id) ? 'var(--bg-band, #F2F2F2)' : 'transparent',
                            transition: 'background 0.1s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-band, #F2F2F2)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = String(formData.customer) === String(c.id) ? 'var(--bg-band, #F2F2F2)' : 'transparent'}
                        >
                          <div style={{ fontWeight: 500 }}>{c.name}</div>
                          {c.company_name && <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>{c.company_name}</div>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Project / Estimate Title* */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-muted, #8C8C8C)'
            }}>
              Project / Title<span className="cred-required-dot" />
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <input
                type="text"
                required
                placeholder="Project or exhibition title for this estimate"
                value={formData.title}
                onChange={(e) => {
                  setFormData(p => ({ ...p, title: e.target.value }))
                  setIsDirty(true)
                }}
                style={{
                  height: '38px',
                  width: '100%',
                  padding: '0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--text, #111111)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Row 3: Status */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-muted, #8C8C8C)'
            }}>
              Status
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <select
                className="cred-select"
                value={formData.status}
                onChange={(e) => {
                  setFormData(p => ({ ...p, status: e.target.value }))
                  setIsDirty(true)
                }}
                style={{
                  height: '38px',
                  width: '100%',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Client Contact Person */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-muted, #8C8C8C)'
            }}>
              Client Contact Person
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <input
                type="text"
                placeholder="Phone number or email address"
                value={formData.client_contact}
                onChange={(e) => {
                  setFormData(p => ({ ...p, client_contact: e.target.value }))
                  setIsDirty(true)
                }}
                style={{
                  height: '38px',
                  width: '100%',
                  padding: '0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--text, #111111)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Row 5: Estimate Date* */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-muted, #8C8C8C)'
            }}>
              Estimate Date<span className="cred-required-dot" />
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => {
                  setFormData(p => ({ ...p, date: e.target.value }))
                  setIsDirty(true)
                }}
                style={{
                  height: '38px',
                  width: '100%',
                  padding: '0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--text, #111111)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Row 6: Valid Until (Optional) */}
          <div className="zoho-form-row" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <label style={{
              width: '180px',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-muted, #8C8C8C)'
            }}>
              Valid Until
            </label>

            <div style={{ width: '100%', maxWidth: '480px' }}>
              <input
                type="date"
                value={formData.valid_until}
                onChange={(e) => {
                  setFormData(p => ({ ...p, valid_until: e.target.value }))
                  setIsDirty(true)
                }}
                style={{
                  height: '38px',
                  width: '100%',
                  padding: '0 12px',
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--text, #111111)',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

        </div>

        {/* ── AREAS SECTION (Animated Segmented Tabs + Hover X + Inline Add) ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '16px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border, #E4E4E4)'
        }}>
          {/* Left: Area Tabs */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'var(--bg-band, #F2F2F2)',
            padding: '4px',
            borderRadius: '9999px'
          }}>
            {/* All Areas Tab */}
            <button
              type="button"
              onClick={() => setFormData(p => ({ ...p, activeSectionFilter: 'All' }))}
              style={{
                height: '28px',
                padding: '0 12px',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: formData.activeSectionFilter === 'All' ? 'var(--black, #0A0A0A)' : 'transparent',
                color: formData.activeSectionFilter === 'All' ? '#FFFFFF' : 'var(--text-muted, #8C8C8C)',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              All Areas ({formData.items.length})
            </button>

            {/* Area Tabs with Hover X */}
            {formData.sections_list.map((sec) => {
              const count = formData.items.filter(i => i.section_name === sec).length
              const isActive = formData.activeSectionFilter === sec
              const isHovered = hoveredArea === sec

              return (
                <div
                  key={sec}
                  onMouseEnter={() => setHoveredArea(sec)}
                  onMouseLeave={() => setHoveredArea(null)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: '28px',
                    borderRadius: '9999px',
                    backgroundColor: isActive ? 'var(--black, #0A0A0A)' : 'transparent',
                    padding: '0 4px 0 10px',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, activeSectionFilter: sec }))}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: isActive ? '#FFFFFF' : 'var(--text-muted, #8C8C8C)',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {sec} ({count})
                  </button>

                  {/* × icon only on hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveArea(sec)
                    }}
                    title={`Remove area "${sec}"`}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px',
                      cursor: 'pointer',
                      color: isActive ? '#FFFFFF' : 'var(--text-muted, #8C8C8C)',
                      opacity: isHovered ? 0.8 : 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'opacity 0.15s ease'
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Right: + Add Area (Plain text link revealing inline input) */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {isAddingArea ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="Area name"
                  value={newAreaInput}
                  onChange={(e) => setNewAreaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddArea()
                    } else if (e.key === 'Escape') {
                      setIsAddingArea(false)
                      setNewAreaInput('')
                    }
                  }}
                  autoFocus
                  style={{
                    height: '28px',
                    padding: '0 8px',
                    fontSize: '12.5px',
                    border: '1px solid var(--border, #E4E4E4)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--card-bg, #ffffff)',
                    color: 'var(--text, #111111)',
                    outline: 'none',
                    width: '120px'
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddArea}
                  style={{
                    height: '28px',
                    padding: '0 10px',
                    backgroundColor: 'var(--black, #0A0A0A)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingArea(false)
                    setNewAreaInput('')
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #8C8C8C)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingArea(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text, #111111)',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '4px 6px'
                }}
              >
                + Add Area
              </button>
            )}
          </div>
        </div>

        <style>{`
          @media (max-width: 1099px) {
            .estimate-table-desktop { display: none !important; }
            .estimate-cards-mobile { display: flex !important; }
          }
          @media (min-width: 1100px) {
            .estimate-table-desktop { display: block !important; }
            .estimate-cards-mobile { display: none !important; }
          }
        `}</style>

        {/* ── DESKTOP ITEM TABLE (100% width, table-layout: fixed, stacked Item Details, no cut off) ── */}
        <div className="estimate-table-desktop" style={{
          width: '100%',
          border: '1px solid var(--border, #E4E4E4)',
          borderRadius: '8px',
          marginBottom: '20px',
          backgroundColor: 'var(--card-bg, #ffffff)',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
            fontSize: '12.5px',
            textAlign: 'left'
          }}>
            <colgroup>
              <col style={{ width: '3%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '33%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '4%' }} />
            </colgroup>
            <thead>
              <tr style={{
                borderBottom: '1px solid var(--border, #E4E4E4)',
                backgroundColor: 'var(--bg-band, #F2F2F2)',
                color: 'var(--text-muted, #8C8C8C)'
              }}>
                <th style={{ padding: '10px 4px', textAlign: 'center', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>#</th>
                <th style={{ padding: '10px 6px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Area / Room</th>
                <th style={{ padding: '10px 8px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Item Details</th>
                <th style={{ padding: '10px 4px', textAlign: 'center', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Qty</th>
                <th style={{ padding: '10px 6px', textAlign: 'left', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Unit</th>
                <th style={{ padding: '10px 6px', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Shop</th>
                <th style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Cost</th>
                <th style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Price</th>
                <th style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Total</th>
                <th style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase' }}>Margin</th>
                <th style={{ padding: '10px 12px 10px 4px', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, idx) => {
                const mat = materials.find(m => m.id === item.material)
                const shopOptions = mat && Array.isArray(mat.shop_prices) ? mat.shop_prices : []

                return (
                  <tr
                    key={item.temp_id}
                    style={{
                      borderBottom: '1px solid var(--border, #E4E4E4)'
                    }}
                  >
                    {/* # (3%) - baseline aligned */}
                    <td style={{
                      padding: '24px 4px 16px',
                      textAlign: 'center',
                      color: 'var(--text-muted, #8C8C8C)',
                      fontSize: '12.5px',
                      verticalAlign: 'top',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {idx + 1}
                    </td>

                    {/* Area / Room (11%) - 34px height */}
                    <td style={{ padding: '16px 4px', verticalAlign: 'top' }}>
                      <select
                        className="cred-select"
                        value={item.section_name}
                        onChange={(e) => handleUpdateItemField(item.temp_id, 'section_name', e.target.value)}
                        style={{
                          width: '100%',
                          height: '34px',
                          fontSize: '12.5px',
                          fontWeight: 500,
                          padding: '0 24px 0 8px',
                          borderRadius: '4px',
                          backgroundPosition: 'right 8px center',
                          backgroundSize: '12px 12px'
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

                    {/* Item Details (33%): Stacked Description + Pick Chart + Specs (8px gap, identical widths & heights) */}
                    <td style={{ padding: '16px 8px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                        {/* Line 1: Item description */}
                        <input
                          type="text"
                          placeholder="Item description"
                          value={item.item_name}
                          onChange={(e) => handleUpdateItemField(item.temp_id, 'item_name', e.target.value)}
                          required
                          style={{
                            height: '34px',
                            width: '100%',
                            padding: '0 10px',
                            fontSize: '13px',
                            lineHeight: '34px',
                            borderRadius: '4px',
                            border: '1px solid var(--border, #E4E4E4)',
                            backgroundColor: 'var(--card-bg, #ffffff)',
                            color: 'var(--text, #111111)',
                            outline: 'none',
                            fontWeight: 500,
                            boxSizing: 'border-box'
                          }}
                        />

                        {/* Line 2: "Pick from Price Chart…" select with same 34px height, padding, line-height */}
                        {materials.length > 0 && (
                          <select
                            className="cred-select"
                            value={item.material || ''}
                            onChange={(e) => handleSelectMaterialForItem(item.temp_id, e.target.value)}
                            style={{
                              width: '100%',
                              height: '34px',
                              lineHeight: '34px',
                              padding: '0 28px 0 10px',
                              fontSize: '12.5px',
                              flexShrink: 0,
                              borderRadius: '4px',
                              border: '1px solid var(--border, #E4E4E4)',
                              backgroundColor: 'var(--bg-subtle, #F7F7F7)',
                              color: 'var(--text-muted, #737373)',
                              outline: 'none',
                              cursor: 'pointer',
                              backgroundPosition: 'right 10px center',
                              backgroundSize: '12px 12px',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="">Pick from Price Chart…</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.customer_price || m.unit_price} SAR)
                              </option>
                            ))}
                          </select>
                        )}

                        {/* Line 3: Specs input beneath it (height 34px, placeholder "Specs (optional)") */}
                        <input
                          type="text"
                          placeholder="Specs (optional)"
                          value={item.measurements}
                          onChange={(e) => handleUpdateItemField(item.temp_id, 'measurements', e.target.value)}
                          style={{
                            width: '100%',
                            height: '34px',
                            lineHeight: '34px',
                            padding: '0 10px',
                            fontSize: '13px',
                            borderRadius: '4px',
                            border: '1px solid var(--border, #E4E4E4)',
                            backgroundColor: 'var(--card-bg, #ffffff)',
                            color: 'var(--text, #111111)',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </td>

                    {/* Qty (6%) */}
                    <td style={{ padding: '16px 4px', verticalAlign: 'top' }}>
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
                          fontVariantNumeric: 'tabular-nums',
                          borderRadius: '4px',
                          border: '1px solid var(--border, #E4E4E4)',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          color: 'var(--text, #111111)',
                          outline: 'none',
                          boxSizing: 'border-box',
                          padding: '0 4px'
                        }}
                      />
                    </td>

                    {/* Unit (9%) - left-aligned, widened so pcs/sheet never clip */}
                    <td style={{ padding: '16px 4px', verticalAlign: 'top' }}>
                      <select
                        className="cred-select"
                        value={item.unit}
                        onChange={(e) => handleUpdateItemField(item.temp_id, 'unit', e.target.value)}
                        style={{
                          width: '100%',
                          height: '34px',
                          fontSize: '12.5px',
                          borderRadius: '4px',
                          textAlign: 'left',
                          padding: '0 18px 0 6px',
                          outline: 'none',
                          backgroundPosition: 'right 6px center',
                          backgroundSize: '10px 10px',
                          boxSizing: 'border-box'
                        }}
                      >
                        {POPULAR_UNITS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>

                    {/* Shop (11%) */}
                    <td style={{ padding: '16px 4px', verticalAlign: 'top' }}>
                      {shopOptions.length > 0 ? (
                        <select
                          className="cred-select"
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
                            fontSize: '12.5px',
                            borderRadius: '4px',
                            padding: '0 20px 0 6px',
                            outline: 'none',
                            backgroundPosition: 'right 6px center',
                            backgroundSize: '10px 10px',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="">Select Shop…</option>
                          {shopOptions.map(s => (
                            <option key={s.shop_name} value={s.shop_name}>
                              {s.shop_name} ({s.price} SAR)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Shop"
                          value={item.selected_shop_name}
                          onChange={(e) => handleUpdateItemField(item.temp_id, 'selected_shop_name', e.target.value)}
                          style={{
                            width: '100%',
                            height: '34px',
                            fontSize: '12.5px',
                            borderRadius: '4px',
                            border: '1px solid var(--border, #E4E4E4)',
                            backgroundColor: 'var(--card-bg, #ffffff)',
                            color: 'var(--text, #111111)',
                            padding: '0 8px',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      )}
                    </td>

                    {/* Cost (SAR) (9%) */}
                    <td style={{ padding: '16px 4px', verticalAlign: 'top' }}>
                      <input
                        type="number"
                        step="0.01"
                        value={item.unit_cost}
                        onChange={(e) => handleUpdateItemField(item.temp_id, 'unit_cost', e.target.value)}
                        style={{
                          width: '100%',
                          height: '34px',
                          textAlign: 'right',
                          fontSize: '13px',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--text-muted, #8C8C8C)',
                          borderRadius: '4px',
                          border: '1px solid var(--border, #E4E4E4)',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          padding: '0 8px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </td>

                    {/* Price (SAR) (9%) */}
                    <td style={{ padding: '16px 4px', verticalAlign: 'top' }}>
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
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--text, #111111)',
                          borderRadius: '4px',
                          border: '1px solid var(--border, #E4E4E4)',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          padding: '0 8px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </td>

                    {/* Total (SAR) (8%) - baseline aligned */}
                    <td style={{
                      padding: '24px 6px 16px',
                      textAlign: 'right',
                      verticalAlign: 'top',
                      fontSize: '13px',
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--text, #111111)',
                      whiteSpace: 'nowrap'
                    }}>
                      {formatTabular(item.total_price)}
                    </td>

                    {/* Margin (SAR) (7%) - baseline aligned, green text only */}
                    <td style={{
                      padding: '24px 6px 16px',
                      textAlign: 'right',
                      verticalAlign: 'top',
                      fontSize: '13px',
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--success, #16A34A)',
                      whiteSpace: 'nowrap'
                    }}>
                      {formatTabular(item.margin)}
                    </td>

                    {/* Delete Icon (4%) - 32px plain icon button */}
                    <td style={{ padding: '17px 12px 16px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(item.temp_id)}
                        title="Delete row"
                        style={{
                          width: '32px',
                          height: '32px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted, #8C8C8C)',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          transition: 'color 0.15s ease, background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#ef4444'
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── MOBILE / NARROW ITEM CARDS (< 1100px: Stacked card per item) ── */}
        <div className="estimate-cards-mobile" style={{
          display: 'none',
          flexDirection: 'column',
          gap: '12px',
          marginBottom: '20px'
        }}>
          {visibleItems.map((item, idx) => {
            const mat = materials.find(m => m.id === item.material)
            const shopOptions = mat && Array.isArray(mat.shop_prices) ? mat.shop_prices : []

            return (
              <div
                key={item.temp_id}
                style={{
                  border: '1px solid var(--border, #E4E4E4)',
                  borderRadius: '10px',
                  padding: '14px',
                  backgroundColor: 'var(--card-bg, #ffffff)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                {/* Header: Item # and Delete */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #8C8C8C)' }}>
                    Item #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveItemRow(item.temp_id)}
                    title="Delete item"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted, #8C8C8C)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Line 1: Description */}
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block', marginBottom: '3px' }}>Description</label>
                  <input
                    type="text"
                    placeholder="Item description"
                    value={item.item_name}
                    onChange={(e) => handleUpdateItemField(item.temp_id, 'item_name', e.target.value)}
                    required
                    style={{
                      height: '32px',
                      width: '100%',
                      padding: '0 8px',
                      fontSize: '12.5px',
                      borderRadius: '4px',
                      border: '1px solid var(--border, #E4E4E4)',
                      backgroundColor: 'var(--card-bg, #ffffff)',
                      color: 'var(--text, #111111)',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Line 2: Pick from price chart */}
                {materials.length > 0 && (
                  <div>
                    <select
                      className="cred-select"
                      value={item.material || ''}
                      onChange={(e) => handleSelectMaterialForItem(item.temp_id, e.target.value)}
                      style={{
                        width: '100%',
                        height: '28px',
                        fontSize: '11.5px',
                        borderRadius: '4px'
                      }}
                    >
                      <option value="">Pick from Price Chart…</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.customer_price || m.unit_price} SAR)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Line 3: Area & Specs (2 cols) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block', marginBottom: '3px' }}>Area / Room</label>
                    <select
                      className="cred-select"
                      value={item.section_name}
                      onChange={(e) => handleUpdateItemField(item.temp_id, 'section_name', e.target.value)}
                      style={{ width: '100%', height: '30px', fontSize: '11.5px', borderRadius: '4px' }}
                    >
                      {formData.sections_list.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block', marginBottom: '3px' }}>Specs</label>
                    <input
                      type="text"
                      placeholder="Specs (optional)"
                      value={item.measurements}
                      onChange={(e) => handleUpdateItemField(item.temp_id, 'measurements', e.target.value)}
                      style={{
                        width: '100%',
                        height: '30px',
                        padding: '0 6px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: '1px solid var(--border, #E4E4E4)',
                        backgroundColor: 'var(--card-bg, #ffffff)',
                        color: 'var(--text, #111111)',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Line 4: Qty, Unit, Shop (3 cols) */}
                <div style={{ display: 'grid', gridTemplateColumns: '80px 80px 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block', marginBottom: '3px' }}>Qty</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItemField(item.temp_id, 'quantity', e.target.value)}
                      style={{
                        width: '100%',
                        height: '30px',
                        textAlign: 'center',
                        fontSize: '12px',
                        fontVariantNumeric: 'tabular-nums',
                        borderRadius: '4px',
                        border: '1px solid var(--border, #E4E4E4)',
                        backgroundColor: 'var(--card-bg, #ffffff)',
                        color: 'var(--text, #111111)',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block', marginBottom: '3px' }}>Unit</label>
                    <select
                      className="cred-select"
                      value={item.unit}
                      onChange={(e) => handleUpdateItemField(item.temp_id, 'unit', e.target.value)}
                      style={{ width: '100%', height: '30px', fontSize: '11.5px', borderRadius: '4px' }}
                    >
                      {POPULAR_UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block', marginBottom: '3px' }}>Shop</label>
                    {shopOptions.length > 0 ? (
                      <select
                        className="cred-select"
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
                        style={{ width: '100%', height: '30px', fontSize: '11.5px', borderRadius: '4px' }}
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
                        placeholder="Shop"
                        value={item.selected_shop_name}
                        onChange={(e) => handleUpdateItemField(item.temp_id, 'selected_shop_name', e.target.value)}
                        style={{
                          width: '100%',
                          height: '30px',
                          fontSize: '11.5px',
                          borderRadius: '4px',
                          border: '1px solid var(--border, #E4E4E4)',
                          backgroundColor: 'var(--card-bg, #ffffff)',
                          color: 'var(--text, #111111)',
                          padding: '0 6px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Line 5: Cost, Price (2 cols) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block', marginBottom: '3px' }}>Cost (SAR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.unit_cost}
                      onChange={(e) => handleUpdateItemField(item.temp_id, 'unit_cost', e.target.value)}
                      style={{
                        width: '100%',
                        height: '30px',
                        textAlign: 'right',
                        fontSize: '12px',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--text-muted, #8C8C8C)',
                        borderRadius: '4px',
                        border: '1px solid var(--border, #E4E4E4)',
                        backgroundColor: 'var(--card-bg, #ffffff)',
                        padding: '0 6px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'block', marginBottom: '3px' }}>Price (SAR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => handleUpdateItemField(item.temp_id, 'unit_price', e.target.value)}
                      style={{
                        width: '100%',
                        height: '30px',
                        textAlign: 'right',
                        fontSize: '12px',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--text, #111111)',
                        borderRadius: '4px',
                        border: '1px solid var(--border, #E4E4E4)',
                        backgroundColor: 'var(--card-bg, #ffffff)',
                        padding: '0 6px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Line 6: Total & Margin summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px dotted var(--border, #E4E4E4)', fontSize: '12.5px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted, #8C8C8C)', marginRight: '6px' }}>Total:</span>
                    <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text, #111111)' }}>{formatTabular(item.total_price)} SAR</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted, #8C8C8C)', marginRight: '6px' }}>Margin:</span>
                    <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--success, #16A34A)' }}>{formatTabular(item.margin)} SAR</strong>
                  </div>
                </div>

              </div>
            )
          })}
        </div>

        {/* "+ Add another line" Button Matching Challan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '36px' }}>
          <button
            type="button"
            onClick={() => handleAddItemRow(formData.activeSectionFilter)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text, #111111)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 0'
            }}
          >
            <Plus size={14} />
            <span>Add another line</span>
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>
            ({formData.items.length} {formData.items.length === 1 ? 'item' : 'items'})
          </span>
        </div>

        {/* ── TOTALS + NOTES SECTION (Two-column layout matching Challan) ── */}
        <div className="zoho-bottom-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: '40px',
          alignItems: 'start'
        }}>

          {/* Left Column: Scope & Production Notes */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-muted, #8C8C8C)',
              marginBottom: '6px'
            }}>
              Scope & Production Notes
            </label>
            <textarea
              rows={4}
              placeholder="Enter notes to be printed on the generated client checklist"
              value={formData.notes}
              onChange={(e) => {
                setFormData(p => ({ ...p, notes: e.target.value }))
                setIsDirty(true)
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--text, #111111)',
                backgroundColor: 'var(--card-bg, #ffffff)',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #8C8C8C)', marginTop: '4px' }}>
              These notes will be printed on the generated client checklist.
            </div>
          </div>

          {/* Right Column: Calculation Summary (Simple Totals Block matching Challan) */}
          <div>
            <div style={{
              backgroundColor: 'var(--bg-band, #F2F2F2)',
              borderRadius: '8px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {/* Internal Cost (Admin) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                color: 'var(--text-muted, #8C8C8C)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Internal Cost</span>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', padding: '1px 5px', borderRadius: '3px', background: 'var(--border, #E4E4E4)', color: 'var(--text-muted, #8C8C8C)' }}>
                    Admin only
                  </span>
                </div>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatTabular(liveTotals.subtotalCost)} SAR
                </span>
              </div>

              {/* Customer Quoted Subtotal */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                color: 'var(--text, #111111)'
              }}>
                <span style={{ fontWeight: 500 }}>Customer Quoted Subtotal</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                  {formatTabular(liveTotals.subtotalPrice)} SAR
                </span>
              </div>

              {/* Tax / VAT (SAR) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                color: 'var(--text, #111111)'
              }}>
                <span>Tax / VAT (SAR)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.tax_amount}
                    onChange={(e) => {
                      setFormData(p => ({ ...p, tax_amount: parseFloat(e.target.value) || 0 }))
                      setIsDirty(true)
                    }}
                    style={{
                      width: '80px',
                      height: '28px',
                      textAlign: 'right',
                      padding: '0 6px',
                      fontSize: '12.5px',
                      fontVariantNumeric: 'tabular-nums',
                      borderRadius: '4px',
                      border: '1px solid var(--border, #E4E4E4)',
                      backgroundColor: 'var(--card-bg, #ffffff)',
                      color: 'var(--text, #111111)',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>SAR</span>
                </div>
              </div>

              {/* Gross Profit Margin */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                color: 'var(--text-muted, #8C8C8C)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Gross Profit Margin</span>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', padding: '1px 5px', borderRadius: '3px', background: 'var(--border, #E4E4E4)', color: 'var(--text-muted, #8C8C8C)' }}>
                    Admin only
                  </span>
                </div>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatTabular(liveTotals.marginAmount)} SAR ({liveTotals.marginPct}%)
                </span>
              </div>

              {/* Hairline Divider */}
              <div style={{ height: '1px', backgroundColor: 'var(--border, #E4E4E4)', margin: '4px 0' }} />

              {/* Grand Total (SAR) */}
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text, #111111)'
                }}>
                  Total ( SAR )
                </span>
                <span style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--text, #111111)'
                }}>
                  {formatTabular(liveTotals.totalPrice)}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ── FOOTER BAR (Sticky at Bottom Matching Challan) ── */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        backgroundColor: 'var(--card-bg, #ffffff)',
        borderTop: '1px solid var(--border, #E4E4E4)',
        padding: '14px 24px',
        zIndex: 100,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Left: Summary text */}
          <div style={{
            fontSize: '12.5px',
            color: 'var(--text-muted, #8C8C8C)',
            fontVariantNumeric: 'tabular-nums'
          }}>
            <span>{formData.items.length} {formData.items.length === 1 ? 'Item' : 'Items'}</span>
            <span style={{ margin: '0 8px' }}>·</span>
            <span>Margin: {liveTotals.marginPct}% ({formatTabular(liveTotals.marginAmount)} SAR)</span>
          </div>

          {/* Right Action Buttons: Cancel, Save as Draft, Save & Build Estimate */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleCancelOrClose}
              style={{
                height: '36px',
                padding: '0 14px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-muted, #8C8C8C)',
                cursor: 'pointer',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text, #111111)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSubmit('Draft')}
              disabled={submitting}
              style={{
                height: '36px',
                padding: '0 16px',
                backgroundColor: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text, #111111)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-band, #F2F2F2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--card-bg, #ffffff)'}
            >
              Save as Draft
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={submitting}
              style={{
                height: '36px',
                padding: '0 24px',
                backgroundColor: 'var(--black, #0A0A0A)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'opacity 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <Check size={14} />
              <span>{isEditing ? 'Update Estimate' : 'Save & Build Estimate'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick Add Customer Modal (Using shared ModalShell) ── */}
      <ModalShell
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="New Customer"
      >
        <form onSubmit={handleCreateCustomer}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            <Field label="Customer Name" required>
              <TextInput
                value={newCustomerForm.name}
                onChange={(e) => setNewCustomerForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Customer or company contact name"
                required
                autoFocus
              />
            </Field>

            <Field label="Company Name">
              <TextInput
                value={newCustomerForm.company_name}
                onChange={(e) => setNewCustomerForm(p => ({ ...p, company_name: e.target.value }))}
                placeholder="Company / Organization"
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Phone Number">
                <TextInput
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+966 5x xxx xxxx"
                />
              </Field>

              <Field label="Email Address">
                <TextInput
                  type="email"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="contact@example.com"
                />
              </Field>
            </div>

            <Field label="Billing Address">
              <Textarea
                rows={2}
                value={newCustomerForm.address}
                onChange={(e) => setNewCustomerForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Street address, city, PO Box"
              />
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(false)}
              disabled={submittingCustomer}
              style={{
                height: '36px',
                padding: '0 16px',
                background: 'none',
                border: 'none',
                borderRadius: '6px',
                color: 'var(--text-muted, #8C8C8C)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingCustomer}
              style={{
                height: '36px',
                padding: '0 20px',
                backgroundColor: 'var(--black, #0A0A0A)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: submittingCustomer ? 'not-allowed' : 'pointer'
              }}
            >
              {submittingCustomer ? 'Saving…' : 'Save Customer'}
            </button>
          </div>
        </form>
      </ModalShell>

    </div>
  )
}

export default EstimateBuilder
