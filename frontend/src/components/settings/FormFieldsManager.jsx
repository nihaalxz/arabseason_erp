import { useState, useEffect } from 'react'
import api from '../../api'
import Modal from '../common/Modal'
import { 
  Plus, Edit, Trash2, Layers, Briefcase, 
  ReceiptPercent, CreditCard, DollarSign, Users, Rocket,
  Check, AlertCircle, RefreshCw, Eye, EyeOff, BookOpen
} from '../icons'
import { 
  Type, Hash, Calendar, ListFilter, AlignLeft, CheckSquare, Lock,
  FileText, RotateCcw, Truck
} from 'lucide-react'
import { showConfirm, showToast, showError, showSuccess } from '../../utils/swal'

const FORM_OPTIONS = [
  { id: 'job_order', label: 'Job Orders', icon: Briefcase, color: '#3b82f6', desc: 'Contracts, projects, and work orders' },
  { id: 'invoice', label: 'Tax Invoices', icon: ReceiptPercent, color: '#10b981', desc: 'Customer billing and VAT statements' },
  { id: 'quotation', label: 'Quotations', icon: FileText, color: '#6366f1', desc: 'Price proposals, tenders, and client bids' },
  { id: 'credit_note', label: 'Credit Notes', icon: RotateCcw, color: '#ef4444', desc: 'Sales returns, refunds, and adjustments' },
  { id: 'delivery_note', label: 'Delivery Notes', icon: Truck, color: '#0d9488', desc: 'Goods dispatch, logistics, and proof of receipt' },
  { id: 'customer_payment', label: 'Customer Payments', icon: CreditCard, color: '#8b5cf6', desc: 'Receipts and client collections' },
  { id: 'expense', label: 'Expenses', icon: DollarSign, color: '#f59e0b', desc: 'Operational and site expenses' },
  { id: 'customer', label: 'Customers', icon: Users, color: '#06b6d4', desc: 'Client accounts and directories' },
  { id: 'estimation', label: 'Estimations', icon: Rocket, color: '#ec4899', desc: 'Proposals and quotes engine' },
  { id: 'cashbook', label: 'Cashbook', icon: BookOpen, color: '#0284c7', desc: 'Cash In / Out entries and ledger tracking' },
]

const FIELD_TYPES = [
  { id: 'text', label: 'Text (Single Line)', desc: 'Names, references, short notes', icon: Type },
  { id: 'number', label: 'Number', desc: 'Quantities, percentages, rates', icon: Hash },
  { id: 'date', label: 'Date Picker', desc: 'Deadlines, milestones, review dates', icon: Calendar },
  { id: 'dropdown', label: 'Dropdown Choices', desc: 'Predefined selectable list of values', icon: ListFilter },
  { id: 'textarea', label: 'Text Area (Multi-line)', desc: 'Detailed specifications or scopes', icon: AlignLeft },
  { id: 'checkbox', label: 'Checkbox (Yes / No)', desc: 'Boolean toggles or flags', icon: CheckSquare },
]

const FormFieldsManager = () => {
  const [selectedForm, setSelectedForm] = useState('job_order')
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    label: '',
    name: '',
    field_type: 'text',
    placeholder: '',
    default_value: '',
    is_required: false,
    show_in_table: true,
    optionsText: '', // for dropdown comma-separated / newline
    options: []
  })

  useEffect(() => {
    fetchFields(selectedForm)
  }, [selectedForm])

  const fetchFields = async (formType) => {
    try {
      setLoading(true)
      const res = await api.get('custom-fields/', { params: { form_type: formType } })
      setFields(res.data || [])
    } catch (err) {
      console.error('Failed to fetch custom fields:', err)
      showError('Failed to load custom fields. Please check backend connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (fieldToEdit = null) => {
    if (fieldToEdit) {
      setEditingField(fieldToEdit)
      setFormData({
        label: fieldToEdit.label,
        name: fieldToEdit.name,
        field_type: fieldToEdit.field_type,
        placeholder: fieldToEdit.placeholder || '',
        default_value: fieldToEdit.default_value || '',
        is_required: fieldToEdit.is_required || false,
        show_in_table: fieldToEdit.show_in_table || false,
        optionsText: Array.isArray(fieldToEdit.options) ? fieldToEdit.options.join(', ') : '',
        options: fieldToEdit.options || []
      })
    } else {
      setEditingField(null)
      setFormData({
        label: '',
        name: '',
        field_type: 'text',
        placeholder: '',
        default_value: '',
        is_required: false,
        show_in_table: true,
        optionsText: '',
        options: []
      })
    }
    setIsModalOpen(true)
  }

  // Auto-generate identifier key from label
  const handleLabelChange = (val) => {
    const autoKey = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    setFormData(prev => ({
      ...prev,
      label: val,
      // Only auto-generate key if creating new field or key was untouched
      name: !editingField ? autoKey : prev.name
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.label.trim()) {
      return showError('Please provide a field display label.')
    }
    if (!formData.name.trim()) {
      return showError('Field key identifier cannot be empty.')
    }

    // Process dropdown options
    let finalOptions = []
    if (formData.field_type === 'dropdown') {
      finalOptions = formData.optionsText
        .split(/[,\n]/)
        .map(opt => opt.trim())
        .filter(Boolean)

      if (finalOptions.length === 0) {
        return showError('Please provide at least one option for the dropdown list.')
      }
    }

    const payload = {
      form_type: selectedForm,
      label: formData.label.trim(),
      name: formData.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      field_type: formData.field_type,
      placeholder: formData.placeholder.trim(),
      default_value: formData.default_value.trim(),
      is_required: formData.is_required,
      show_in_table: formData.show_in_table,
      options: finalOptions
    }

    try {
      setSubmitting(true)
      if (editingField) {
        const res = await api.put(`custom-fields/${editingField.id}/`, payload)
        setFields(prev => prev.map(f => f.id === editingField.id ? res.data : f))
        showSuccess('Custom field updated successfully!')
      } else {
        const res = await api.post('custom-fields/', payload)
        setFields(prev => [...prev, res.data])
        showSuccess(`Field "${res.data.label}" is now live on ${activeFormMeta?.label}!`)
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Failed to save custom field:', err)
      const errorMsg = err.response?.data?.name || err.response?.data?.detail || 'Failed to save custom field.'
      showError(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (field) => {
    const confirmed = await showConfirm({
      title: 'Delete Custom Field?',
      text: `Are you sure you want to delete "${field.label}"? Existing recorded values for this field will remain in the database, but this field will no longer be shown on the form.`,
      confirmButtonText: 'Yes, Delete Field',
      confirmButtonColor: '#ef4444'
    })

    if (!confirmed) return

    try {
      await api.delete(`custom-fields/${field.id}/`)
      setFields(prev => prev.filter(f => f.id !== field.id))
      showToast({ title: `Field "${field.label}" removed`, icon: 'success' })
    } catch (err) {
      console.error('Failed to delete custom field:', err)
      showError('Failed to remove custom field.')
    }
  }

  const activeFormMeta = FORM_OPTIONS.find(f => f.id === selectedForm) || FORM_OPTIONS[0]

  return (
    <div className="form-fields-manager" style={{ width: '100%', maxWidth: '1080px' }}>
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.75rem',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.12)',
              color: 'var(--primary, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={18} />
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0, color: 'var(--text-main)' }}>
              Custom Form Fields & Columns
            </h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, maxWidth: '650px', lineHeight: '1.5' }}>
            Empower your team to add custom inputs (text, numbers, dates, dropdowns) to any form without requiring developer changes. Fields immediately reflect live across modals and table columns.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => handleOpenModal()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-sm, 8px)',
            fontWeight: '600'
          }}
        >
          <Plus size={18} />
          <span>Add New Field</span>
        </button>
      </div>

      {/* Form Section Selector Pills */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ 
          fontSize: '0.8rem', 
          fontWeight: '700', 
          textTransform: 'uppercase', 
          letterSpacing: '0.05em', 
          color: 'var(--text-muted)',
          marginBottom: '0.75rem' 
        }}>
          1. Select Form or Section
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '0.75rem'
        }}>
          {FORM_OPTIONS.map(form => {
            const Icon = form.icon
            const isSelected = selectedForm === form.id

            return (
              <button
                key={form.id}
                type="button"
                onClick={() => setSelectedForm(form.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md, 10px)',
                  background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-white-5, rgba(255,255,255,0.03))',
                  border: isSelected ? '1.5px solid var(--primary, #3b82f6)' : '1px solid var(--border-color, rgba(255,255,255,0.08))',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: isSelected ? 'var(--primary, #3b82f6)' : 'rgba(255, 255, 255, 0.08)',
                  color: isSelected ? '#ffffff' : form.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon size={16} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: isSelected ? '700' : '600',
                    color: isSelected ? 'var(--primary, #3b82f6)' : 'var(--text-main)',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden'
                  }}>
                    {form.label}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Fields List Header & Action */}
      <div style={{
        background: 'var(--bg-white-5, rgba(255,255,255,0.02))',
        borderRadius: 'var(--radius-md, 12px)',
        border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        padding: '1.25rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{
              fontSize: '1rem',
              fontWeight: '700',
              color: 'var(--text-main)'
            }}>
              Configured Columns for {activeFormMeta.label}
            </span>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--primary, #3b82f6)'
            }}>
              {fields.length} {fields.length === 1 ? 'column' : 'columns'}
            </span>
          </div>

          <button
            type="button"
            className="btn glass-panel"
            onClick={() => fetchFields(selectedForm)}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: 'var(--text-muted)'
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Loading / Empty / Fields Content */}
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem auto', color: 'var(--primary)' }} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Loading configured form fields...</p>
          </div>
        ) : fields.length === 0 ? (
          <div style={{
            padding: '1.75rem 1.25rem',
            textAlign: 'center',
            borderRadius: 'var(--radius-sm, 8px)',
            background: 'rgba(255, 255, 255, 0.015)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.08)',
              color: 'var(--primary, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto'
            }}>
              <Layers size={24} />
            </div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-main)' }}>
              No custom columns for {activeFormMeta.label} yet
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '480px', margin: '0 auto 1.5rem auto', lineHeight: '1.5' }}>
              Add new fields to track specific project information, site details, payment terms, or custom client data.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenModal()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}
            >
              <Plus size={16} />
              <span>Create First Column</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Field Label</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Key Identifier</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Type</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Table Column</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Required</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fields.map(field => {
                  return (
                    <tr 
                      key={field.id}
                      style={{ 
                        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '0.9rem 1rem', fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                        {field.label}
                      </td>
                      <td style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        <code>{field.name}</code>
                      </td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          textTransform: 'capitalize',
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: 'var(--text-main)'
                        }}>
                          {field.field_type}
                        </span>
                        {field.field_type === 'dropdown' && Array.isArray(field.options) && (
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                            {field.options.slice(0, 3).map((opt, i) => (
                              <span key={i} style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                background: 'rgba(0,0,0,0.15)',
                                padding: '1px 5px',
                                borderRadius: '4px'
                              }}>
                                {opt}
                              </span>
                            ))}
                            {field.options.length > 3 && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>
                                +{field.options.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        {field.show_in_table ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            color: 'var(--success, #10b981)',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            <Eye size={13} /> Active Column
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            color: 'var(--text-muted)',
                            fontSize: '0.75rem'
                          }}>
                            <EyeOff size={13} /> Form Only
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        {field.is_required ? (
                          <span style={{ color: 'var(--danger, #ef4444)', fontSize: '0.75rem', fontWeight: '700' }}>
                            Yes (Mandatory)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            Optional
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleOpenModal(field)}
                            title="Edit Field"
                            style={{ padding: '6px', borderRadius: '6px' }}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleDelete(field)}
                            title="Delete Field"
                            style={{ padding: '6px', borderRadius: '6px', color: 'var(--danger, #ef4444)' }}
                          >
                            <Trash2 size={14} />
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
      </div>

      {/* Add / Edit Field Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingField ? `Edit Column: ${editingField.label}` : `Add Custom Column to ${activeFormMeta.label}`}
        maxWidth="720px"
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '0.25rem' }}>
          {/* Form Context Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(19, 102, 217, 0.06) 0%, rgba(19, 102, 217, 0.02) 100%)',
            border: '1px solid rgba(19, 102, 217, 0.16)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '9px',
              background: 'var(--primary-light, #ebf3fc)',
              color: 'var(--primary, #1366d9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 1px 3px rgba(19, 102, 217, 0.12)'
            }}>
              <activeFormMeta.icon size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
                <span style={{ fontSize: '0.885rem', fontWeight: '700', color: 'var(--text-main)' }}>
                  {activeFormMeta.label}
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: '700',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  background: 'rgba(19, 102, 217, 0.1)',
                  color: 'var(--primary, #1366d9)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  Target Module
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {activeFormMeta.desc}
              </p>
            </div>
          </div>

          {/* Field Display Label & Key Identifier */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '1rem', alignItems: 'start' }}>
            {/* Field Display Label */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.825rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Field Display Label <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.label}
                onChange={e => handleLabelChange(e.target.value)}
                required
                style={{ height: '38px', fontSize: '0.85rem' }}
              />
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                Friendly title shown on forms and table headers.
              </span>
            </div>

            {/* Key Identifier (Machine Name) */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.825rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  System Key Identifier <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: '500', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  {editingField ? (
                    <>
                      <Lock size={11} style={{ color: 'var(--text-muted)' }} />
                      <span>Locked</span>
                    </>
                  ) : (
                    <>
                      <Hash size={11} style={{ color: 'var(--primary, #1366d9)' }} />
                      <span>Auto-slug</span>
                    </>
                  )}
                </span>
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.name}
                disabled={Boolean(editingField)}
                onChange={e => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                required
                style={{
                  height: '38px',
                  fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.82rem',
                  backgroundColor: editingField ? '#f8fafc' : '#ffffff',
                  color: editingField ? 'var(--text-muted)' : 'var(--primary, #1366d9)',
                  fontWeight: '600'
                }}
              />
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                Unique slug stored in JSON database.
              </span>
            </div>
          </div>

          {/* Field Input Type Selector */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.825rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.5rem', display: 'block' }}>
              Field Input Type <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.65rem'
            }}>
              {FIELD_TYPES.map(type => {
                const isSelected = formData.field_type === type.id
                const Icon = type.icon
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, field_type: type.id })}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.65rem',
                      padding: '0.75rem 0.85rem',
                      borderRadius: '9px',
                      background: isSelected ? 'rgba(19, 102, 217, 0.06)' : '#ffffff',
                      border: isSelected ? '2px solid var(--primary, #1366d9)' : '1px solid var(--border-color, #e2e8f0)',
                      boxShadow: isSelected ? '0 2px 8px rgba(19, 102, 217, 0.12)' : '0 1px 2px rgba(0,0,0,0.03)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '7px',
                      background: isSelected ? 'var(--primary, #1366d9)' : 'var(--bg-main, #f1f5f9)',
                      color: isSelected ? '#ffffff' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}>
                      <Icon size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.82rem',
                        fontWeight: isSelected ? '700' : '600',
                        color: isSelected ? 'var(--primary, #1366d9)' : 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {type.label}
                      </div>
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                        lineHeight: '1.25'
                      }}>
                        {type.desc}
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '-5px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'var(--primary, #1366d9)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 5px rgba(19, 102, 217, 0.35)'
                      }}>
                        <Check size={11} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dropdown Options Builder */}
          {formData.field_type === 'dropdown' && (
            <div style={{
              padding: '1rem',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(19, 102, 217, 0.04) 0%, rgba(19, 102, 217, 0.01) 100%)',
              border: '1px solid rgba(19, 102, 217, 0.22)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <label style={{ fontSize: '0.825rem', fontWeight: '600', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Dropdown Choices List <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
                </label>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Separate with commas or new lines
                </span>
              </div>
              <textarea
                className="input-field"
                rows={3}
                value={formData.optionsText}
                onChange={e => setFormData({ ...formData, optionsText: e.target.value })}
                required={formData.field_type === 'dropdown'}
                style={{ width: '100%', fontSize: '0.85rem', height: 'auto', minHeight: '76px', resize: 'vertical' }}
              />
              {/* Option Chips Preview */}
              {formData.optionsText.split(/[,\n]/).filter(s => s.trim()).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.65rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)' }}>Parsed Choices:</span>
                  {formData.optionsText.split(/[,\n]/).map((opt, i) => opt.trim() && (
                    <span key={i} style={{
                      fontSize: '0.72rem',
                      fontWeight: '500',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '5px',
                      background: '#ffffff',
                      border: '1px solid rgba(19, 102, 217, 0.25)',
                      color: 'var(--primary, #1366d9)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}>
                      {opt.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Optional Placeholder & Default Value */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.825rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.4rem', display: 'block' }}>
                Input Placeholder (Optional)
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.placeholder}
                onChange={e => setFormData({ ...formData, placeholder: e.target.value })}
                style={{ height: '38px', fontSize: '0.85rem' }}
              />
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                Grey hint shown inside empty field.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.825rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.4rem', display: 'block' }}>
                Default Value (Optional)
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.default_value}
                onChange={e => setFormData({ ...formData, default_value: e.target.value })}
                style={{ height: '38px', fontSize: '0.85rem' }}
              />
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                Pre-populated initial value for records.
              </span>
            </div>
          </div>

          {/* Validation & Display Flags with Modern Toggle Switch Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Mandatory Field Card */}
            <div
              onClick={() => setFormData({ ...formData, is_required: !formData.is_required })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                background: formData.is_required ? 'rgba(19, 102, 217, 0.05)' : '#ffffff',
                border: formData.is_required ? '1.5px solid var(--primary, #1366d9)' : '1px solid var(--border-color, #e2e8f0)',
                boxShadow: formData.is_required ? '0 2px 6px rgba(19, 102, 217, 0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                userSelect: 'none'
              }}
            >
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-main)' }}>
                  Mandatory Field
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Require staff to enter value before saving
                </div>
              </div>
              {/* iOS style toggle switch */}
              <div style={{
                width: '38px',
                height: '22px',
                borderRadius: '11px',
                background: formData.is_required ? 'var(--primary, #1366d9)' : '#cbd5e1',
                position: 'relative',
                transition: 'background-color 0.2s ease',
                flexShrink: 0,
                marginLeft: '0.75rem'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: '3px',
                  left: formData.is_required ? '19px' : '3px',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </div>
            </div>

            {/* Show in Table View Card */}
            <div
              onClick={() => setFormData({ ...formData, show_in_table: !formData.show_in_table })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                background: formData.show_in_table ? 'rgba(19, 102, 217, 0.05)' : '#ffffff',
                border: formData.show_in_table ? '1.5px solid var(--primary, #1366d9)' : '1px solid var(--border-color, #e2e8f0)',
                boxShadow: formData.show_in_table ? '0 2px 6px rgba(19, 102, 217, 0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                userSelect: 'none'
              }}
            >
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-main)' }}>
                  Show in Table View
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Add as an active column in data tables
                </div>
              </div>
              {/* iOS style toggle switch */}
              <div style={{
                width: '38px',
                height: '22px',
                borderRadius: '11px',
                background: formData.show_in_table ? 'var(--primary, #1366d9)' : '#cbd5e1',
                position: 'relative',
                transition: 'background-color 0.2s ease',
                flexShrink: 0,
                marginLeft: '0.75rem'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: '3px',
                  left: formData.show_in_table ? '19px' : '3px',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </div>
            </div>
          </div>

          {/* Live Preview Card */}
          <div style={{
            padding: '1rem 1.15rem',
            borderRadius: '10px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Eye size={14} style={{ color: 'var(--primary, #1366d9)' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--primary, #1366d9)', letterSpacing: '0.04em' }}>
                  Live Field Preview
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: '600',
                  padding: '0.12rem 0.45rem',
                  borderRadius: '4px',
                  background: '#e2e8f0',
                  color: 'var(--text-secondary)'
                }}>
                  Type: {FIELD_TYPES.find(f => f.id === formData.field_type)?.label || 'Text'}
                </span>
                {formData.is_required && (
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: '700',
                    padding: '0.12rem 0.45rem',
                    borderRadius: '4px',
                    background: 'var(--danger-light, #fdf0f0)',
                    color: 'var(--danger, #ef4444)',
                    border: '1px solid var(--danger-border, #fdb5b5)'
                  }}>
                    Required
                  </span>
                )}
                {formData.show_in_table && (
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: '600',
                    padding: '0.12rem 0.45rem',
                    borderRadius: '4px',
                    background: 'var(--success-light, #e6f7f0)',
                    color: 'var(--success, #10b981)',
                    border: '1px solid var(--success-border, #a3dfc0)'
                  }}>
                    Table Column
                  </span>
                )}
              </div>
            </div>

            <div style={{ maxWidth: '380px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                {formData.label || 'Sample Field Label'} {formData.is_required && <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>}
              </label>

              {formData.field_type === 'dropdown' ? (
                <select className="input-field" disabled style={{ width: '100%', fontSize: '0.85rem', height: '36px', background: '#ffffff' }}>
                  <option>-- Select {formData.label || 'Choice'} --</option>
                  {(formData.optionsText.split(/[,\n]/).filter(Boolean).length > 0
                    ? formData.optionsText.split(/[,\n]/).filter(Boolean)
                    : ['Sample Option A', 'Sample Option B']
                  ).map((opt, i) => (
                    <option key={i}>{opt.trim()}</option>
                  ))}
                </select>
              ) : formData.field_type === 'date' ? (
                <input type="date" className="input-field" disabled style={{ width: '100%', fontSize: '0.85rem', height: '36px', background: '#ffffff' }} />
              ) : formData.field_type === 'number' ? (
                <input type="number" className="input-field" disabled style={{ width: '100%', fontSize: '0.85rem', height: '36px', background: '#ffffff' }} />
              ) : formData.field_type === 'textarea' ? (
                <textarea className="input-field" disabled rows={2} style={{ width: '100%', fontSize: '0.85rem', background: '#ffffff', minHeight: '60px' }} />
              ) : formData.field_type === 'checkbox' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.25rem 0' }}>
                  <input type="checkbox" disabled style={{ width: '17px', height: '17px', accentColor: 'var(--primary, #1366d9)' }} />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Toggle status (Yes / No)</span>
                </div>
              ) : (
                <input type="text" className="input-field" disabled style={{ width: '100%', fontSize: '0.85rem', height: '36px', background: '#ffffff' }} />
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.35rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light, #edf0f5)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
              style={{ minWidth: '90px', height: '36px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: '160px', height: '36px', boxShadow: '0 2px 8px rgba(19, 102, 217, 0.2)' }}
            >
              {submitting ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
              <span>{editingField ? 'Update Column' : 'Save & Publish Column'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default FormFieldsManager
