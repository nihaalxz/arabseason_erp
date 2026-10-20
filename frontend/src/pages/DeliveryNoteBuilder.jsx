import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Truck,
  AlertCircle, Download, Check, Info, RefreshCw
} from 'lucide-react'
import api from '../api'
import SkeletonLoader from '../components/common/SkeletonLoader'
import DynamicCustomFields from '../components/common/DynamicCustomFields'
import Modal from '../components/common/Modal'
import { useSettings } from '../contexts/SettingsContext'
import { showError, showToast, showSuccess } from '../utils/swal'
import { handlePdfResponse } from '../utils/pdfDownload'

const STATUS_CHOICES = ['Draft', 'Dispatched', 'In Transit', 'Delivered', 'Signed & Returned', 'Cancelled']
const UNIT_OPTIONS = ['Unit', 'Pcs', 'Hours', 'Days', 'Lot', 'Sq. M', 'Kg', 'Service', 'm', 'Roll', 'Box', 'Pallet', 'Carton']
const PACKAGE_TYPES = ['Carton', 'Pallet', 'Wooden Crate', 'Bundle', 'Bag', 'Roll', 'Box', 'Drum', 'Loose']
const DEFAULT_ITEM = { description: '', quantity: 1, unit: 'Unit', packages_count: '1', package_type: 'Carton', unit_price: 0, total: 0, remarks: 'Good condition' }

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

const DeliveryNoteBuilder = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const { settings } = useSettings()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [customers, setCustomers] = useState([])
  const [jobOrders, setJobOrders] = useState([])
  const [invoices, setInvoices] = useState([])
  const [materials, setMaterials] = useState([])
  const [formError, setFormError] = useState('')

  const [form, setForm] = useState({
    delivery_note_number: '',
    customer: '',
    job_order: '',
    invoice: '',
    delivery_date: new Date().toISOString().split('T')[0],
    dispatch_date: new Date().toISOString().split('T')[0],
    status: 'Delivered',
    delivery_address: '',
    shipping_method: 'Direct Company Truck',
    driver_name: '',
    driver_phone: '',
    vehicle_number: '',
    tracking_number: '',
    receiver_name: '',
    receiver_phone: '',
    customer_po_number: '',
    reference_number: '',
    total_packages: 1,
    show_prices: false,
    notes: 'Please inspect cargo upon receipt and verify package count before signing.',
    terms_conditions: 'Any damages or shortages must be reported within 24 hours of delivery.',
    items: [{ ...DEFAULT_ITEM }],
    custom_fields: {}
  })

  // Quick Customer Creation
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', company_name: '', phone: '', email: '', address: '' })
  const [submittingCustomer, setSubmittingCustomer] = useState(false)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchNextDeliveryNoteNumber = async () => {
    try {
      const res = await api.get('delivery-notes/next-number/')
      return res.data?.next_number || `DN-${new Date().getFullYear()}-0001`
    } catch {
      return `DN-${new Date().getFullYear()}-0001`
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const toArr = (d) => Array.isArray(d) ? d : (d?.results || [])
      const [cRes, jRes, iRes, mRes] = await Promise.all([
        api.get('customers/?page_size=1000').catch(() => ({ data: [] })),
        api.get('job-orders/?page_size=1000&lookup=true').catch(() => ({ data: [] })),
        api.get('invoices/?page_size=1000').catch(() => ({ data: [] })),
        api.get('materials/').catch(() => ({ data: [] }))
      ])

      const custList = toArr(cRes.data)
      const jobList = toArr(jRes.data)
      const invList = toArr(iRes.data)
      const matList = toArr(mRes.data)
      setCustomers(custList)
      setJobOrders(jobList)
      setInvoices(invList)
      setMaterials(matList)

      if (isEditing) {
        const { data: dn } = await api.get(`delivery-notes/${id}/`)
        const formattedItems = (dn.items && dn.items.length > 0)
          ? dn.items.map(it => ({
              id: it.id,
              description: it.description || '',
              quantity: parseFloat(it.quantity) || 1,
              unit: it.unit || 'Unit',
              packages_count: it.packages_count || '',
              package_type: it.package_type || 'Carton',
              unit_price: parseFloat(it.unit_price) || 0,
              total: parseFloat(it.total) || 0,
              remarks: it.remarks || ''
            }))
          : [{ ...DEFAULT_ITEM }]

        setForm({
          delivery_note_number: dn.delivery_note_number,
          customer: dn.customer,
          job_order: dn.job_order || '',
          invoice: dn.invoice || '',
          delivery_date: dn.delivery_date || '',
          dispatch_date: dn.dispatch_date || '',
          status: dn.status || 'Delivered',
          delivery_address: dn.delivery_address || '',
          shipping_method: dn.shipping_method || '',
          driver_name: dn.driver_name || '',
          driver_phone: dn.driver_phone || '',
          vehicle_number: dn.vehicle_number || '',
          tracking_number: dn.tracking_number || '',
          receiver_name: dn.receiver_name || '',
          receiver_phone: dn.receiver_phone || '',
          customer_po_number: dn.customer_po_number || '',
          reference_number: dn.reference_number || '',
          total_packages: dn.total_packages || 1,
          show_prices: Boolean(dn.show_prices),
          notes: dn.notes || '',
          terms_conditions: dn.terms_conditions || '',
          items: formattedItems,
          custom_fields: dn.custom_fields || {}
        })
      } else {
        const nextNum = await fetchNextDeliveryNoteNumber()
        setForm(prev => ({
          ...prev,
          delivery_note_number: nextNum
        }))
      }
    } catch (err) {
      console.error('Failed to load delivery note builder:', err)
      showError('Load Error', 'Failed to initialize delivery note builder.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Customer Selection
  const handleCustomerChange = (customerId) => {
    const cust = customers.find(c => String(c.id) === String(customerId))
    setForm(prev => ({
      ...prev,
      customer: customerId,
      delivery_address: cust?.address || prev.delivery_address || '',
      receiver_name: cust?.contact_person || prev.receiver_name || '',
      receiver_phone: cust?.phone || prev.receiver_phone || ''
    }))
  }

  // Handle Linked Job Order Selection
  const handleJobOrderChange = (jobId) => {
    const job = jobOrders.find(j => String(j.id) === String(jobId))
    if (!job) {
      setForm(prev => ({ ...prev, job_order: '' }))
      return
    }

    setForm(prev => ({
      ...prev,
      job_order: jobId,
      customer: prev.customer || job.customer || '',
      reference_number: prev.reference_number || job.order_id || '',
      items: prev.items.length === 1 && !prev.items[0].description
        ? [{ ...DEFAULT_ITEM, description: `Delivery for Job ${job.order_id}: ${job.title}` }]
        : prev.items
    }))
    showToast(`Linked Job Order ${job.order_id}`, 'success')
  }

  // Handle Linked Invoice Selection
  const handleInvoiceChange = (invId) => {
    const inv = invoices.find(i => String(i.id) === String(invId))
    if (!inv) {
      setForm(prev => ({ ...prev, invoice: '' }))
      return
    }

    const itemsFromInvoice = (inv.items && inv.items.length > 0)
      ? inv.items.map(it => ({
          description: it.description,
          quantity: parseFloat(it.quantity) || 1,
          unit: it.unit || 'Unit',
          packages_count: '1',
          package_type: 'Carton',
          unit_price: parseFloat(it.unit_price) || 0,
          total: parseFloat(it.total) || 0,
          remarks: 'Good condition'
        }))
      : prev.items

    setForm(prev => ({
      ...prev,
      invoice: invId,
      customer: prev.customer || inv.customer || '',
      delivery_address: prev.delivery_address || inv.billing_address || '',
      customer_po_number: prev.customer_po_number || inv.reference_number || '',
      items: itemsFromInvoice
    }))
    showToast(`Loaded items from Invoice ${inv.invoice_number}`, 'success')
  }

  // Line Item Update
  const handleItemChange = (index, field, value) => {
    setForm(prev => {
      const items = [...prev.items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, items }
    })
  }

  const handleSelectMaterialForItem = (idx, materialId) => {
    if (!materialId) {
      handleItemChange(idx, 'material', '')
      return
    }
    const mat = materials.find(m => String(m.id) === String(materialId))
    if (!mat) return

    setForm(prev => {
      const items = [...prev.items]
      const itm = { ...items[idx] }
      itm.material = mat.id
      itm.description = mat.name + (mat.measurements ? ` (${mat.measurements})` : '')

      if (mat.unit) {
        const matched = UNIT_OPTIONS.find(u => u.toLowerCase() === mat.unit.toLowerCase())
        itm.unit = matched || mat.unit
      }

      itm.unit_price = parseFloat(mat.customer_price) || 0
      const qty = parseFloat(itm.quantity) || 1
      itm.total = Number((qty * itm.unit_price).toFixed(2))

      items[idx] = itm
      return { ...prev, items }
    })
  }

  const handleAddItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { ...DEFAULT_ITEM }]
    }))
  }

  const handleRemoveItem = (index) => {
    if (form.items.length <= 1) {
      showToast('Delivery note must have at least one line item', 'warning')
      return
    }
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  // PDF
  const handleDownloadPdf = async () => {
    if (!id) {
      showToast('Please save before downloading PDF', 'info')
      return
    }
    try {
      setDownloadingPdf(true)
      const res = await api.get(`delivery-notes/${id}/pdf/`, { responseType: 'blob' })
      handlePdfResponse(res, `DeliveryNote_${form.delivery_note_number}.pdf`)
      showToast('Delivery note PDF downloaded', 'success')
    } catch (err) {
      console.error('PDF error:', err)
      showError('Download Failed', 'Failed to generate delivery note PDF.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Save
  const handleSubmit = async (targetStatus) => {
    setFormError('')
    if (!form.customer) {
      setFormError('Please select a customer.')
      showToast('Customer is required', 'warning')
      return
    }
    if (!form.delivery_note_number.trim()) {
      setFormError('Delivery Note Number is required.')
      return
    }

    const payload = {
      ...form,
      job_order: form.job_order || null,
      invoice: form.invoice || null,
      status: targetStatus || form.status,
      total_packages: parseInt(form.total_packages) || 1,
      items: form.items.map((it, idx) => ({
        description: it.description || 'Delivered item',
        quantity: parseFloat(it.quantity) || 1,
        unit: it.unit || 'Unit',
        packages_count: String(it.packages_count || ''),
        package_type: String(it.package_type || ''),
        unit_price: parseFloat(it.unit_price) || 0,
        total: parseFloat(it.total) || 0,
        remarks: it.remarks || '',
        sort_order: idx
      }))
    }

    try {
      setSubmitting(true)
      if (isEditing) {
        await api.put(`delivery-notes/${id}/`, payload)
        showSuccess('Saved!', `Delivery Note ${form.delivery_note_number} updated successfully.`)
      } else {
        const res = await api.post('delivery-notes/', payload)
        showSuccess('Created!', `Delivery Note ${form.delivery_note_number} created successfully.`)
        navigate(`/delivery-notes/${res.data.id}/edit`, { replace: true })
      }
    } catch (err) {
      console.error('Submit error:', err)
      const msg = err.response?.data?.delivery_note_number?.[0] || err.response?.data?.detail || 'Failed to save delivery note.'
      setFormError(msg)
      showError('Error Saving', msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Quick Customer
  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    if (!newCustomerForm.name.trim()) return
    try {
      setSubmittingCustomer(true)
      const res = await api.post('customers/', newCustomerForm)
      const created = res.data
      setCustomers(prev => [created, ...prev])
      setForm(prev => ({
        ...prev,
        customer: created.id,
        delivery_address: created.address || '',
        receiver_phone: created.phone || ''
      }))
      setIsCustomerModalOpen(false)
      setNewCustomerForm({ name: '', company_name: '', phone: '', email: '', address: '' })
      showToast('Customer created', 'success')
    } catch (err) {
      showError('Failed', 'Could not create customer.')
    } finally {
      setSubmittingCustomer(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <SkeletonLoader count={6} />
      </div>
    )
  }

  return (
    <div className="erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', minHeight: '100vh', paddingBottom: '90px', boxSizing: 'border-box' }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => navigate('/delivery-notes')}
            style={{
              padding: '6px 10px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#475569',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.85rem'
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>
              {isEditing ? `Edit Delivery Note ${form.delivery_note_number}` : 'New Delivery Note & Challan'}
            </h1>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Status: <span style={{ fontWeight: '600', color: '#0d9488' }}>{form.status}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isEditing && (
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              style={{
                padding: '6px 12px',
                background: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Download size={15} className={downloadingPdf ? 'animate-spin' : ''} />
              PDF
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSubmit('Draft')}
            disabled={submitting}
            style={{
              padding: '6px 14px',
              background: '#ffffff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Save Draft
          </button>

          <button
            type="button"
            onClick={() => handleSubmit('Delivered')}
            disabled={submitting}
            style={{
              padding: '6px 16px',
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(13, 148, 136, 0.4)'
            }}
          >
            <Check size={16} />
            {submitting ? 'Saving...' : 'Save & Confirm Dispatch'}
          </button>
        </div>
      </div>

      {formError && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          fontSize: '0.85rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          {formError}
        </div>
      )}

      {/* Zoho-Style Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {/* Section 1: Receiver & Logistics Grid */}
        <div className="dn-builder-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          paddingBottom: '1.5rem',
          borderBottom: '1px solid #f1f5f9'
        }}>

          {/* Left Column: Customer & Delivery Address */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <ZohoLabel required>Customer / Consignee</ZohoLabel>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                style={{ background: 'none', border: 'none', color: '#0d9488', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}
              >
                + New Customer
              </button>
            </div>
            <select
              value={form.customer}
              onChange={(e) => handleCustomerChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '0.88rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                background: '#fff',
                marginBottom: '10px'
              }}
            >
              <option value="">Select Customer...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
              ))}
            </select>

            <ZohoLabel required>Ship-To / Delivery Address</ZohoLabel>
            <textarea
              rows={2}
              value={form.delivery_address}
              onChange={(e) => setForm(p => ({ ...p, delivery_address: e.target.value }))}
              style={{
                width: '100%',
                padding: '7px 10px',
                fontSize: '0.85rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                marginBottom: '10px'
              }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <ZohoLabel>Receiver Contact</ZohoLabel>
                <input
                  type="text"
                  value={form.receiver_name}
                  onChange={(e) => setForm(p => ({ ...p, receiver_name: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>
              <div>
                <ZohoLabel>Receiver Phone</ZohoLabel>
                <input
                  type="text"
                  value={form.receiver_phone}
                  onChange={(e) => setForm(p => ({ ...p, receiver_phone: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Dispatch & Logistics Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <ZohoLabel required>Delivery Note Number</ZohoLabel>
              <input
                type="text"
                value={form.delivery_note_number}
                onChange={(e) => setForm(p => ({ ...p, delivery_note_number: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#0d9488'
                }}
              />
            </div>

            <div>
              <ZohoLabel required>Delivery Date</ZohoLabel>
              <input
                type="date"
                value={form.delivery_date}
                onChange={(e) => setForm(p => ({ ...p, delivery_date: e.target.value }))}
                style={{ width: '100%', padding: '6px 8px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            <div>
              <ZohoLabel>Dispatch Date</ZohoLabel>
              <input
                type="date"
                value={form.dispatch_date}
                onChange={(e) => setForm(p => ({ ...p, dispatch_date: e.target.value }))}
                style={{ width: '100%', padding: '6px 8px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            <div>
              <ZohoLabel>Status</ZohoLabel>
              <select
                value={form.status}
                onChange={(e) => setForm(p => ({ ...p, status: e.target.value }))}
                style={{ width: '100%', padding: '6px 8px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff' }}
              >
                {STATUS_CHOICES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <ZohoLabel>Total Packages</ZohoLabel>
              <input
                type="number"
                min="1"
                value={form.total_packages}
                onChange={(e) => setForm(p => ({ ...p, total_packages: e.target.value }))}
                style={{ width: '100%', padding: '6px 8px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            <div>
              <ZohoLabel>Carrier / Driver Name</ZohoLabel>
              <input
                type="text"
                value={form.driver_name}
                onChange={(e) => setForm(p => ({ ...p, driver_name: e.target.value }))}
                style={{ width: '100%', padding: '6px 8px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            <div>
              <ZohoLabel>Driver Phone</ZohoLabel>
              <input
                type="text"
                value={form.driver_phone}
                onChange={(e) => setForm(p => ({ ...p, driver_phone: e.target.value }))}
                style={{ width: '100%', padding: '6px 8px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            <div>
              <ZohoLabel>Vehicle / Truck Reg #</ZohoLabel>
              <input
                type="text"
                value={form.vehicle_number}
                onChange={(e) => setForm(p => ({ ...p, vehicle_number: e.target.value }))}
                style={{ width: '100%', padding: '6px 8px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            <div>
              <ZohoLabel>Tracking / Waybill #</ZohoLabel>
              <input
                type="text"
                value={form.tracking_number}
                onChange={(e) => setForm(p => ({ ...p, tracking_number: e.target.value }))}
                style={{ width: '100%', padding: '6px 8px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Quick Links Strip */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: '#f8fafc',
          padding: '8px 12px',
          borderRadius: '8px',
          margin: '1rem 0',
          fontSize: '0.82rem',
          border: '1px solid #e2e8f0',
          flexWrap: 'wrap'
        }}>
          <Truck size={16} style={{ color: '#0d9488' }} />
          <span style={{ fontWeight: '600', color: '#475569' }}>Import From:</span>
          {invoices.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleInvoiceChange(e.target.value)
                  e.target.value = ''
                }
              }}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#fff' }}
            >
              <option value="">Load from Invoice...</option>
              {invoices.map(i => (
                <option key={i.id} value={i.id}>{i.invoice_number} - {i.customer_name}</option>
              ))}
            </select>
          )}

          {jobOrders.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleJobOrderChange(e.target.value)
                  e.target.value = ''
                }
              }}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#fff' }}
            >
              <option value="">Load from Job Order...</option>
              {jobOrders.map(j => (
                <option key={j.id} value={j.id}>{j.order_id} - {j.title}</option>
              ))}
            </select>
          )}
        </div>

        {/* Section 3: Line Items */}
        <div style={{ margin: '1.5rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#1e293b' }}>
              Dispatched Packages & Itemized Cargo
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
              style={{
                padding: '5px 10px',
                background: '#f0fdfa',
                color: '#0d9488',
                border: '1px solid #99f6e4',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus size={14} />
              Add Row
            </button>
          </div>

          {/* Desktop Table */}
          <div className="table-responsive-wrapper desktop-only" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '8px 10px', width: '4%' }}>#</th>
                  <th style={{ padding: '8px 10px', width: '40%' }}>Description of Goods</th>
                  <th style={{ padding: '8px 10px', width: '12%' }}>Quantity</th>
                  <th style={{ padding: '8px 10px', width: '10%' }}>Unit</th>
                  <th style={{ padding: '8px 10px', width: '12%' }}>Packaging</th>
                  <th style={{ padding: '8px 10px', width: '16%' }}>Condition / Remarks</th>
                  <th style={{ padding: '8px 10px', width: '6%', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.85rem' }}
                        />
                        {materials.length > 0 && (
                          <select
                            value={item.material || ''}
                            onChange={(e) => handleSelectMaterialForItem(idx, e.target.value)}
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
                              transition: 'border-color 0.15s ease'
                            }}
                          >
                            <option value="">⚡ Pick from Price Chart...</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} {m.measurements ? `(${m.measurements})` : ''} {m.customer_price ? `- ${m.customer_price} SAR` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.85rem' }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <select
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.85rem', background: '#fff' }}
                      >
                        {UNIT_OPTIONS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                          type="text"
                          value={item.packages_count}
                          onChange={(e) => handleItemChange(idx, 'packages_count', e.target.value)}
                          style={{ width: '45px', padding: '6px 4px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.85rem', textAlign: 'center' }}
                        />
                        <select
                          value={item.package_type}
                          onChange={(e) => handleItemChange(idx, 'package_type', e.target.value)}
                          style={{ flex: 1, padding: '6px 4px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.8rem', background: '#fff' }}
                        >
                          {PACKAGE_TYPES.map(pt => (
                            <option key={pt} value={pt}>{pt}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={(e) => handleItemChange(idx, 'remarks', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.85rem' }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {form.items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>CARGO ITEM #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.85rem' }}
                  />
                  {materials.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      <select
                        value={item.material || ''}
                        onChange={(e) => handleSelectMaterialForItem(idx, e.target.value)}
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
                          transition: 'border-color 0.15s ease'
                        }}
                      >
                        <option value="">⚡ Pick from Price Chart...</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.measurements ? `(${m.measurements})` : ''} {m.customer_price ? `- ${m.customer_price} SAR` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Qty</span>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Unit</span>
                    <select
                      value={item.unit}
                      onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.85rem', background: '#fff' }}
                    >
                      {UNIT_OPTIONS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Package Type</span>
                    <select
                      value={item.package_type}
                      onChange={(e) => handleItemChange(idx, 'package_type', e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.8rem', background: '#fff' }}
                    >
                      {PACKAGE_TYPES.map(pt => (
                        <option key={pt} value={pt}>{pt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Remarks</span>
                    <input
                      type="text"
                      value={item.remarks}
                      onChange={(e) => handleItemChange(idx, 'remarks', e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Dynamic Custom Form Fields */}
        <div style={{ padding: '1rem 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
          <DynamicCustomFields
            formType="delivery_note"
            values={form.custom_fields || {}}
            onChange={(fieldName, val) => {
              setForm(p => ({
                ...p,
                custom_fields: { ...(p.custom_fields || {}), [fieldName]: val }
              }))
            }}
          />
        </div>

        {/* Section 5: Notes & Acknowledgment Preview */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
          marginTop: '1.5rem'
        }}>
          <div>
            <ZohoLabel>Driver & Dispatch Notes</ZohoLabel>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '10px' }}
            />

            <ZohoLabel>Delivery Terms & Inspection Policy</ZohoLabel>
            <textarea
              rows={2}
              value={form.terms_conditions}
              onChange={(e) => setForm(p => ({ ...p, terms_conditions: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.25rem'
          }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '0.92rem', fontWeight: '700', color: '#1e293b' }}>
              Receiver Acknowledgment Block
            </h4>
            <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#64748b' }}>
              This formal acknowledgment block is included on the printed & downloaded PDF for physical signature and company stamp:
            </p>
            <div style={{
              background: '#ffffff',
              padding: '10px',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.82rem',
              color: '#334155'
            }}>
              <div style={{ fontStyle: 'italic', marginBottom: '8px' }}>
                "Received the above goods in full quantity and good condition without any damages."
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}>
                <span>Receiver: ________________</span>
                <span>Date: ____________</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Toolbar (Accessible on all screen sizes, docked to bottom) */}
      <div className="builder-sticky-bar" style={{
        position: 'sticky',
        bottom: 0,
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '0.85rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1100,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
        marginTop: '1.5rem',
        borderRadius: '8px'
      }}>
        <div className="builder-sticky-info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '13px', color: '#64748b' }}>
          <Truck size={16} style={{ color: '#0d9488', flexShrink: 0 }} />
          <span>Total Packages: <strong style={{ color: '#0d9488', fontSize: '15px' }}>{form.total_packages || 1} Pkgs</strong></span>
        </div>

        <div className="builder-sticky-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={() => navigate('/delivery-notes')}
            style={{
              padding: '0.55rem 1.1rem',
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
            disabled={submitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.55rem 1.1rem',
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
            onClick={() => handleSubmit('Delivered')}
            disabled={submitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1.35rem',
              fontSize: '13.5px',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(13,148,136,0.3)'
            }}
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {isEditing ? 'Save Changes' : 'Save & Dispatch'}
          </button>
        </div>
      </div>

      {/* Quick Customer Modal */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Add New Customer"
      >
        <form onSubmit={handleCreateCustomer}>
          <div style={{ marginBottom: '10px' }}>
            <ZohoLabel required>Customer Name</ZohoLabel>
            <input
              type="text"
              required
              value={newCustomerForm.name}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, name: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <ZohoLabel>Company Name</ZohoLabel>
            <input
              type="text"
              value={newCustomerForm.company_name || ''}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, company_name: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <ZohoLabel>Phone Number</ZohoLabel>
            <input
              type="text"
              value={newCustomerForm.phone}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, phone: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <ZohoLabel>Delivery / Site Address</ZohoLabel>
            <textarea
              rows={2}
              value={newCustomerForm.address}
              onChange={(e) => setNewCustomerForm(p => ({ ...p, address: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={submittingCustomer} className="btn btn-primary" style={{ background: '#0d9488' }}>
              {submittingCustomer ? 'Saving...' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
          .dn-builder-grid { grid-template-columns: 1fr !important; gap: 1rem !important; }
        }
        @media (min-width: 769px) {
          .desktop-only { display: block !important; }
          .mobile-only { display: none !important; }
        }
      `}</style>

    </div>
  )
}

export default DeliveryNoteBuilder
