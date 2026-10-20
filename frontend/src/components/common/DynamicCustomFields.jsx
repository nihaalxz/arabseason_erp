import { useState, useEffect } from 'react'
import api from '../../api'

/**
 * DynamicCustomFields
 * 
 * Automatically loads and renders custom fields configured for a specific form_type.
 * Handles input change propagation to parent state via onChange(fieldName, value).
 * 
 * @param {string} formType - e.g. 'job_order', 'customer_payment', 'invoice', 'expense', 'customer', 'estimation'
 * @param {object} values - Current key-value dictionary of custom fields: { [name]: value }
 * @param {function} onChange - Callback (fieldName, value) => void
 * @param {object} errors - Optional field error messages { [name]: string }
 * @param {boolean} compact - If true, displays in single column or tighter spacing
 * @param {Array} preloadedFields - Optional preloaded list of CustomFormField objects to avoid extra fetch
 */
const DynamicCustomFields = ({
  formType,
  values = {},
  onChange,
  errors = {},
  compact = false,
  preloadedFields = null
}) => {
  const [fields, setFields] = useState(preloadedFields || [])
  const [loading, setLoading] = useState(!preloadedFields)

  useEffect(() => {
    if (preloadedFields) {
      setFields(preloadedFields)
      return
    }

    let isMounted = true
    const fetchFields = async () => {
      try {
        setLoading(true)
        const res = await api.get('custom-fields/', { params: { form_type: formType } })
        if (isMounted) {
          setFields(res.data || [])
        }
      } catch (err) {
        console.error(`Failed to load custom fields for ${formType}:`, err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchFields()
    return () => { isMounted = false }
  }, [formType, preloadedFields])

  if (loading || !fields || fields.length === 0) {
    return null
  }

  const handleFieldChange = (name, val) => {
    if (onChange) {
      onChange(name, val)
    }
  }

  return (
    <div className="dynamic-custom-fields-grid" style={{
      display: 'grid',
      gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '1rem',
      width: '100%'
    }}>
      {fields.map(field => {
        const fieldVal = values && values[field.name] !== undefined ? values[field.name] : (field.default_value || '')
        const error = errors && errors[field.name]

        return (
          <div key={field.id || field.name} className="form-group" style={{ marginBottom: 0 }}>
            <label>
              {field.label}
              {field.is_required && <span style={{ color: 'var(--danger, #ef4444)', marginLeft: '3px' }}>*</span>}
            </label>

            {/* Text Input */}
            {field.field_type === 'text' && (
              <input
                type="text"
                className={`input-field form-input ${error ? 'input-error' : ''}`}
                value={fieldVal}
                required={field.is_required}
                onChange={e => handleFieldChange(field.name, e.target.value)}
              />
            )}

            {/* Number Input */}
            {field.field_type === 'number' && (
              <input
                type="number"
                step="any"
                className={`input-field form-input ${error ? 'input-error' : ''}`}
                value={fieldVal}
                required={field.is_required}
                onChange={e => handleFieldChange(field.name, e.target.value)}
              />
            )}

            {/* Date Input */}
            {field.field_type === 'date' && (
              <input
                type="date"
                className={`input-field form-input ${error ? 'input-error' : ''}`}
                value={fieldVal}
                required={field.is_required}
                onChange={e => handleFieldChange(field.name, e.target.value)}
              />
            )}

            {/* Dropdown / Select Input */}
            {field.field_type === 'dropdown' && (
              <select
                className={`input-field form-select ${error ? 'input-error' : ''}`}
                value={fieldVal}
                required={field.is_required}
                onChange={e => handleFieldChange(field.name, e.target.value)}
              >
                <option value="">-- Select {field.label} --</option>
                {(Array.isArray(field.options) ? field.options : []).map((opt, idx) => (
                  <option key={idx} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {/* Textarea */}
            {field.field_type === 'textarea' && (
              <textarea
                className={`input-field form-input ${error ? 'input-error' : ''}`}
                rows={2}
                value={fieldVal}
                required={field.is_required}
                onChange={e => handleFieldChange(field.name, e.target.value)}
              />
            )}

            {/* Checkbox */}
            {field.field_type === 'checkbox' && (
              <div style={{ display: 'flex', alignItems: 'center', height: '34px', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id={`dyn_chk_${field.name}`}
                  checked={Boolean(fieldVal)}
                  onChange={e => handleFieldChange(field.name, e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary, #3b82f6)' }}
                />
                <label htmlFor={`dyn_chk_${field.name}`} style={{ fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer', margin: 0 }}>
                  {fieldVal ? 'Yes / Enabled' : 'No / Disabled'}
                </label>
              </div>
            )}

            {error && (
              <span style={{ color: 'var(--danger, #ef4444)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                {error}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default DynamicCustomFields
