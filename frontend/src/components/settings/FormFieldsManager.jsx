import { useState, useEffect } from 'react'
import api from '../../api'
import {
  ModalShell,
  Field,
  TextInput,
  Select as CredSelect,
  Textarea,
  ToggleRow
} from '../common/FormPrimitives'
import { Plus, Edit, Trash2, Layers, Check } from '../icons'
import { CredAnimatedTabs } from '../cashbook/cred/CredAnimatedTabs'
import { showConfirm, showToast, showError, showSuccess } from '../../utils/swal'

const FORM_OPTIONS = [
  { id: 'job_order', label: 'Job Orders' },
  { id: 'invoice', label: 'Invoices' },
  { id: 'quotation', label: 'Quotations' },
  { id: 'credit_note', label: 'Credit Notes' },
  { id: 'delivery_note', label: 'Delivery Notes' },
  { id: 'customer_payment', label: 'Payments' },
  { id: 'expense', label: 'Expenses' },
  { id: 'customer', label: 'Customers' },
  { id: 'estimation', label: 'Estimations' },
  { id: 'cashbook', label: 'Cashbook' },
]

const FIELD_TYPE_OPTIONS = [
  { id: 'text', label: 'Text' },
  { id: 'number', label: 'Number' },
  { id: 'date', label: 'Date' },
  { id: 'dropdown', label: 'Dropdown' },
  { id: 'textarea', label: 'Text area' },
  { id: 'checkbox', label: 'Checkbox' },
]

// Small neutral toggle (about 36x20)
// off = neutral grey track, on = ink-colored track with white knob. No blue, no glow.
const NeutralToggle = ({ checked, onChange, disabled = false }) => (
  <div
    role="switch"
    aria-checked={checked}
    tabIndex={disabled ? -1 : 0}
    onClick={(e) => {
      e.stopPropagation()
      if (!disabled && onChange) onChange(!checked)
    }}
    onKeyDown={(e) => {
      if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        if (onChange) onChange(!checked)
      }
    }}
    style={{
      width: '36px',
      height: '20px',
      borderRadius: '999px',
      backgroundColor: checked ? 'var(--text, #0A0A0A)' : 'var(--border-strong, #D4D4D4)',
      position: 'relative',
      cursor: disabled ? 'not-allowed' : 'pointer',
      flexShrink: 0,
      transition: 'background-color 0.18s ease',
      outline: 'none',
      userSelect: 'none'
    }}
  >
    <div
      style={{
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        backgroundColor: checked ? 'var(--bg, #FFFFFF)' : '#FFFFFF',
        position: 'absolute',
        top: '3px',
        left: checked ? '19px' : '3px',
        transition: 'left 0.18s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
      }}
    />
  </div>
)

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
    optionsText: '',
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
        showSuccess(`Field "${res.data.label}" added successfully!`)
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
      confirmButtonColor: 'var(--danger, #ef4444)'
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

  const formatTypeLabel = (typeId) => {
    const found = FIELD_TYPE_OPTIONS.find(f => f.id === typeId)
    return found ? found.label : typeId
  }

  return (
    <div className="form-fields-manager" style={{ width: '100%', maxWidth: '1080px' }}>
      {/* 4.1 Header: Custom Fields with black pill Add Field */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border)'
      }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Custom Fields
        </h3>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          style={{
            height: '36px',
            padding: '0 16px',
            borderRadius: '999px',
            background: 'var(--black, #0A0A0A)',
            color: '#FFFFFF',
            border: 'none',
            fontWeight: 500,
            fontSize: '0.85rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            transition: 'opacity 0.15s ease'
          }}
        >
          <Plus size={15} />
          <span>Add Field</span>
        </button>
      </div>

      {/* 4.2 Form Selector: Animated Tabs (wrap allowed) */}
      <div style={{ marginBottom: '1.75rem' }}>
        <CredAnimatedTabs
          tabs={FORM_OPTIONS}
          value={selectedForm}
          onChange={(tabId) => setSelectedForm(tabId)}
          layoutId="settings-form-fields-tabs"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px'
          }}
        />
      </div>

      {/* 4.3 Configured Columns: Heading + count */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '0.85rem'
      }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
          Columns
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {fields.length}
        </span>
      </div>

      {/* Table / Empty State */}
      {loading ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Loading columns...
        </div>
      ) : fields.length === 0 ? (
        <div style={{
          padding: '2.5rem 1rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Layers size={20} style={{ opacity: 0.6 }} />
          <span style={{ fontSize: '0.855rem' }}>No custom columns yet.</span>
        </div>
      ) : (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              tableLayout: 'fixed'
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)', width: '24%' }}>
                  Label
                </th>
                <th style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)', width: '22%' }}>
                  Key
                </th>
                <th style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)', width: '18%' }}>
                  Type
                </th>
                <th style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)', width: '12%' }}>
                  Required
                </th>
                <th style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)', width: '12%' }}>
                  In Table
                </th>
                <th style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)', width: '12%', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map(field => (
                <tr
                  key={field.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    transition: 'background-color 0.12s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '0.75rem', fontSize: '0.855rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {field.label}
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <code>{field.name}</code>
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    {formatTypeLabel(field.field_type)}
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    {field.is_required ? 'Yes' : 'No'}
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    {field.show_in_table ? 'Yes' : 'No'}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenModal(field)}
                        title="Edit Field"
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'color 0.15s ease, background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--text)'
                          e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)'
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(field)}
                        title="Delete Field"
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'color 0.15s ease, background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--danger, #E5482E)'
                          e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)'
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.4 Add / Edit Field Modal */}
      <ModalShell
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingField ? 'Edit Custom Field' : 'Add Custom Field'}
        maxWidth="520px"
        formId="custom-field-modal-form"
        submitLabel={editingField ? 'Save Changes' : 'Add Field'}
        submittingLabel="Saving..."
        submitting={submitting}
      >
        <form id="custom-field-modal-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
          {/* Label & Key */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <Field label="Label" required>
              <TextInput
                value={formData.label}
                onChange={e => handleLabelChange(e.target.value)}
                required
                autoFocus
              />
            </Field>

            <Field label="Key">
              <TextInput
                value={formData.name}
                disabled={Boolean(editingField)}
                onChange={e => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                required
                style={{ fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '12px' }}
              />
            </Field>
          </div>

          {/* Field Input Type */}
          <Field label="Field Input Type">
            <CredSelect
              value={formData.field_type}
              onChange={e => setFormData({ ...formData, field_type: e.target.value })}
            >
              {FIELD_TYPE_OPTIONS.map(type => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </CredSelect>
          </Field>

          {/* Dropdown Choices */}
          {formData.field_type === 'dropdown' && (
            <Field label="Dropdown Choices" required>
              <Textarea
                rows={3}
                placeholder="Comma or line separated options"
                value={formData.optionsText}
                onChange={e => setFormData({ ...formData, optionsText: e.target.value })}
                required={formData.field_type === 'dropdown'}
              />
            </Field>
          )}

          {/* Placeholder & Default Value */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Placeholder">
              <TextInput
                value={formData.placeholder}
                onChange={e => setFormData({ ...formData, placeholder: e.target.value })}
              />
            </Field>

            <Field label="Default Value">
              <TextInput
                value={formData.default_value}
                onChange={e => setFormData({ ...formData, default_value: e.target.value })}
              />
            </Field>
          </div>

          {/* Mandatory field & Show in table view */}
          <div style={{ borderTop: '1px solid var(--border, #E4E4E4)', paddingTop: '4px', marginTop: '4px' }}>
            <ToggleRow
              label="Mandatory field"
              checked={formData.is_required}
              onChange={val => setFormData(p => ({ ...p, is_required: val }))}
            />
            <ToggleRow
              label="Show in table view"
              checked={formData.show_in_table}
              onChange={val => setFormData(p => ({ ...p, show_in_table: val }))}
              style={{ borderBottom: 'none' }}
            />
          </div>
        </form>
      </ModalShell>
    </div>
  )
}

export default FormFieldsManager
