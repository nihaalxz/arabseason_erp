import React, { useRef } from 'react'
import Modal from './Modal'
import { X, Trash2, FileText, Check } from '../icons'
import { UploadCloud, Eye } from 'lucide-react'

/**
 * credSelectStyles
 * Drop-in custom styles for react-select (Select & CreatableSelect) inside modals:
 * - Single border matching inputs (no double border, no inner divider)
 * - No separate chevron box, muted chevron
 * - Plain option panel with light hover row and check on selected item
 * - Hidden scrollbar (scrolling works)
 * - Never gooey
 */
export const credSelectStyles = {
  menuPortal: (base) => ({
    ...base,
    zIndex: 999999
  }),
  control: (base, state) => ({
    ...base,
    backgroundColor: 'var(--card-bg, #FFFFFF)',
    borderColor: state.isFocused ? 'var(--text, #0A0A0A)' : 'var(--border, #E4E4E4)',
    borderRadius: '12px',
    minHeight: '40px',
    height: '40px',
    padding: '0 4px 0 14px',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 10, 10, 0.08)' : 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    '&:hover': {
      borderColor: state.isFocused ? 'var(--text, #0A0A0A)' : 'var(--text-muted, #8C8C8C)'
    }
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '0',
    height: '38px',
    fontSize: '13.5px'
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    color: 'inherit',
    fontSize: '13.5px',
    border: 'none',
    outline: 'none',
    boxShadow: 'none',
    background: 'transparent',
    backgroundColor: 'transparent',
    borderRadius: 0
  }),
  placeholder: (base) => ({
    ...base,
    margin: 0,
    color: 'var(--text-muted, #8C8C8C)',
    fontSize: '13.5px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  }),
  singleValue: (base) => ({
    ...base,
    margin: 0,
    color: 'var(--text, #111111)',
    fontSize: '13.5px'
  }),
  indicatorSeparator: () => ({
    display: 'none'
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? 'var(--text, #0A0A0A)' : 'var(--text-muted, #8C8C8C)',
    padding: '0 8px',
    '&:hover': {
      color: 'var(--text, #0A0A0A)'
    }
  }),
  clearIndicator: (base) => ({
    ...base,
    color: 'var(--text-muted, #8C8C8C)',
    padding: '0 4px',
    '&:hover': {
      color: 'var(--danger, #DC2626)'
    }
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'var(--card-bg, #FFFFFF)',
    border: '1px solid var(--border, #E4E4E4)',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    padding: '4px',
    zIndex: 999999,
    overflow: 'hidden'
  }),
  menuList: (base) => ({
    ...base,
    padding: '2px',
    maxHeight: '280px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    '&::-webkit-scrollbar': {
      display: 'none'
    }
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'var(--fill-ghost-hover, #F4F4F4)'
      : state.isFocused
      ? 'var(--fill-ghost-hover, #F4F4F4)'
      : 'transparent',
    color: 'var(--text, #111111)',
    fontSize: '13px',
    fontWeight: state.isSelected ? 500 : 400,
    borderRadius: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    '&:active': {
      backgroundColor: 'var(--fill-ghost-hover, #F4F4F4)'
    }
  })
}

/**
 * CredOption
 * Option component for react-select with:
 * - Truncated text with ellipsis
 * - Check mark on selected item
 * - Light hover state
 */
export const CredOption = (props) => {
  const { data, innerProps, isFocused, isSelected, children } = props
  if (data && data.__isNew__) {
    return (
      <div
        {...innerProps}
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          backgroundColor: isFocused ? 'var(--fill-ghost-hover, #F4F4F4)' : 'transparent',
          color: 'var(--text, #111111)',
          fontWeight: 500,
          fontSize: '13px',
          borderRadius: '8px'
        }}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      {...innerProps}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        cursor: 'pointer',
        backgroundColor: isSelected
          ? 'var(--fill-ghost-hover, #F4F4F4)'
          : (isFocused ? 'var(--fill-ghost-hover, #F4F4F4)' : 'transparent'),
        color: 'var(--text, #111111)',
        fontSize: '13px',
        borderRadius: '8px',
        transition: 'background-color 0.12s ease'
      }}
    >
      <span style={{
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: isSelected ? 500 : 400
      }}>
        {children}
      </span>
      {isSelected && (
        <Check size={14} style={{ color: 'var(--text, #111111)', marginLeft: '8px', flexShrink: 0 }} />
      )}
    </div>
  )
}

/**
 * ModalShell
 * Unified ERP Modal Container with:
 * - Title only (no subtitle or description)
 * - 24px radius, 1px border, backdrop click and Esc to close
 * - Scrolling body with thin scrollbar
 * - Pinned footer: ghost Cancel + black pill primary action
 */
export const ModalShell = ({
  isOpen,
  onClose,
  title,
  maxWidth = '680px',
  formId,
  submitLabel = 'Save Changes',
  submittingLabel = 'Saving...',
  cancelLabel = 'Cancel',
  submitting = false,
  footer,
  style = {},
  closeOnBackdrop = false,
  className = '',
  overlayClassName = '',
  children
}) => {
  const defaultFooter = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
      <button
        type="button"
        className="cred-modal-cancel-btn"
        onClick={onClose}
        disabled={submitting}
      >
        {cancelLabel}
      </button>
      <button
        type="submit"
        form={formId}
        className="cred-modal-submit-btn"
        disabled={submitting}
      >
        {submitting ? submittingLabel : submitLabel}
      </button>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth={maxWidth}
      closeOnBackdrop={closeOnBackdrop}
      className={`cred-modal-shell ${className}`.trim()}
      overlayClassName={`cred-modal-overlay ${overlayClassName}`.trim()}
      style={{
        borderRadius: '24px',
        background: 'var(--card-bg, #FFFFFF)',
        border: '1px solid var(--border, #E4E4E4)',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.16)',
        ...style
      }}
      footer={footer !== undefined ? footer : defaultFooter}
    >
      {children}
    </Modal>
  )
}

/**
 * Field
 * Label + Required Dot (red dot, not "*") + Error Text + Optional Right Link/Tooltip
 */
export const Field = ({
  label,
  required = false,
  rightAction = null,
  error = null,
  tooltip = null,
  children,
  style = {},
  className = ''
}) => {
  return (
    <div className={`cred-field-group ${className}`} style={{ display: 'flex', flexDirection: 'column', ...style }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label className="cred-form-label" style={{ margin: 0 }}>
            <span>{label}</span>
            {required && <span className="cred-required-dot" title="Required" />}
            {tooltip && (
              <span
                title={tooltip}
                style={{
                  marginLeft: '5px',
                  cursor: 'help',
                  color: 'var(--text-muted, #8C8C8C)',
                  fontSize: '11px'
                }}
              >
                ⓘ
              </span>
            )}
          </label>
          {rightAction}
        </div>
      )}
      {children}
      {error && (
        <span style={{ fontSize: '11.5px', color: 'var(--danger, #DC2626)', marginTop: '4px' }}>
          {error}
        </span>
      )}
    </div>
  )
}

/**
 * TextInput
 * Standard modal text input or prefixed text input (e.g. prefix="JOB")
 */
export const TextInput = ({
  prefix,
  suffix,
  className = '',
  style = {},
  type = 'text',
  disabled,
  ...props
}) => {
  if (prefix || suffix) {
    return (
      <div
        className={`cred-input-wrap ${disabled ? 'is-disabled' : ''} ${className}`}
        style={{
          ...(disabled ? { backgroundColor: 'var(--fill-ghost-hover, #F8F9FA)', cursor: 'not-allowed', opacity: 0.85 } : {}),
          ...style
        }}
      >
        {prefix && <span className="cred-input-prefix">{prefix}</span>}
        <input
          type={type}
          disabled={disabled}
          className="cred-input-prefixed"
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            backgroundColor: 'transparent',
            boxShadow: 'none',
            borderRadius: 0,
            padding: 0,
            cursor: disabled ? 'not-allowed' : undefined,
            ...(props.style || {})
          }}
          {...props}
        />
        {suffix && <span className="cred-input-suffix">{suffix}</span>}
      </div>
    )
  }

  return (
    <input
      type={type}
      disabled={disabled}
      className={`cred-input ${disabled ? 'is-disabled' : ''} ${className}`}
      style={{
        ...(disabled ? { backgroundColor: 'var(--fill-ghost-hover, #F8F9FA)', cursor: 'not-allowed', opacity: 0.85 } : {}),
        ...style
      }}
      {...props}
    />
  )
}

/**
 * NumberInput
 * Number input with wheel blur and optional muted prefix (e.g. "SAR")
 */
export const NumberInput = ({
  prefix,
  step = '0.01',
  className = '',
  style = {},
  disabled,
  onWheel,
  ...props
}) => {
  const handleWheel = (e) => {
    e.currentTarget.blur()
    if (onWheel) onWheel(e)
  }

  if (prefix) {
    return (
      <div
        className={`cred-input-wrap ${disabled ? 'is-disabled' : ''} ${className}`}
        style={{
          ...(disabled ? { backgroundColor: 'var(--fill-ghost-hover, #F8F9FA)', cursor: 'not-allowed', opacity: 0.85 } : {}),
          ...style
        }}
      >
        <span className="cred-input-prefix">{prefix}</span>
        <input
          type="number"
          step={step}
          disabled={disabled}
          className="cred-input-prefixed"
          onWheel={handleWheel}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            backgroundColor: 'transparent',
            boxShadow: 'none',
            borderRadius: 0,
            padding: 0,
            cursor: disabled ? 'not-allowed' : undefined,
            ...(props.style || {})
          }}
          {...props}
        />
      </div>
    )
  }

  return (
    <input
      type="number"
      step={step}
      disabled={disabled}
      className={`cred-input ${disabled ? 'is-disabled' : ''} ${className}`}
      onWheel={handleWheel}
      style={{
        ...(disabled ? { backgroundColor: 'var(--fill-ghost-hover, #F8F9FA)', cursor: 'not-allowed', opacity: 0.85 } : {}),
        ...style
      }}
      {...props}
    />
  )
}

/**
 * Select
 * Plain modal select with custom SVG chevron
 */
export const Select = ({
  options = [],
  placeholder = null,
  children,
  className = '',
  style = {},
  ...props
}) => {
  const hasEmptyOption = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && (child.props.value === '' || child.props.value === null || child.props.value === undefined)
  )

  return (
    <select className={`cred-select ${className}`} style={style} {...props}>
      {placeholder && !hasEmptyOption && <option value="">{placeholder}</option>}
      {options.length > 0
        ? options.map((opt) => {
            const val = typeof opt === 'object' ? opt.value : opt
            const lbl = typeof opt === 'object' ? opt.label : opt
            return (
              <option key={val} value={val}>
                {lbl}
              </option>
            )
          })
        : children}
    </select>
  )
}

/**
 * DateInput
 * Standard date picker input
 */
export const DateInput = ({ className = '', style = {}, ...props }) => {
  return (
    <input
      type="date"
      className={`cred-input ${className}`}
      style={style}
      {...props}
    />
  )
}

/**
 * Textarea
 * Standard multi-line text input
 */
export const Textarea = ({
  rows = 3,
  className = '',
  style = {},
  ...props
}) => {
  return (
    <textarea
      rows={rows}
      className={`cred-textarea ${className}`}
      style={style}
      {...props}
    />
  )
}

/**
 * Dropzone
 * One-line dashed file dropzone with short hint and file removal chip.
 * Supports both single file mode (default) and multi-file mode (multiple=true).
 */
export const Dropzone = ({
  value,
  values,
  onUpload,
  onRemove,
  onPreview,
  accept = 'image/*,.pdf,application/pdf',
  placeholder = 'Click to upload a document or image',
  hint = 'PDF, JPG, PNG up to 10MB',
  multiple = false,
  style = {}
}) => {
  const fileInputRef = useRef(null)

  // Multi-file mode
  if (multiple) {
    const items = Array.isArray(values) ? values : (Array.isArray(value) ? value : (value ? [value] : []))

    const handleDrop = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (onUpload) {
        onUpload(e)
      }
    }

    const handleDragOver = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', ...style }}>
        <div
          className="cred-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={{
            cursor: 'pointer',
            padding: items.length > 0 ? '12px 16px' : '16px 20px'
          }}
        >
          <UploadCloud size={16} strokeWidth={1.8} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)' }}>
            {items.length > 0 ? '+ Upload more images or files' : placeholder}
          </span>
          {hint && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', opacity: 0.7 }}>
              &bull; {hint}
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={accept}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (onUpload) onUpload(e)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          />
        </div>

        {items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {items.map((item, idx) => {
              const fileName = typeof item === 'object' ? item.name || item.attachment_name : 'Attached file'
              const isPdf = typeof item === 'object'
                ? (item.type?.includes('pdf') || fileName?.toLowerCase().endsWith('.pdf'))
                : String(item).toLowerCase().endsWith('.pdf')
              const previewUrl = typeof item === 'object' ? (item.url || item.dataUrl || item.preview) : item
              const sizeStr = item.size ? `(${(item.size / 1024).toFixed(0)} KB)` : ''

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--fill-ghost-hover, #F4F4F4)',
                    border: '1px solid var(--border, #E4E4E4)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    gap: '10px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      overflow: 'hidden',
                      flex: 1,
                      cursor: onPreview ? 'pointer' : 'default'
                    }}
                    onClick={() => onPreview && onPreview(item, idx)}
                  >
                    {isPdf ? (
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '6px',
                          backgroundColor: '#FEE2E2',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <FileText size={18} color="var(--danger, #DC2626)" />
                      </div>
                    ) : previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={fileName}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '6px',
                          objectFit: 'cover',
                          flexShrink: 0,
                          border: '1px solid var(--border, #E4E4E4)'
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--fill-ghost, #ECECEC)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <FileText size={18} color="var(--text-muted, #8C8C8C)" />
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: 'var(--text, #111111)',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap'
                        }}
                        title={fileName}
                      >
                        {fileName}
                      </span>
                      {sizeStr && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>
                          {sizeStr}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {onPreview && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onPreview(item, idx)
                        }}
                        title="Preview attachment"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted, #8C8C8C)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '4px',
                          transition: 'color 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text, #111111)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)')}
                      >
                        <Eye size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onRemove) onRemove(idx)
                      }}
                      title="Remove attachment"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted, #8C8C8C)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '4px',
                        transition: 'color 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger, #DC2626)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (value) {
    const fileName = typeof value === 'object' ? value.name || value.attachment_name : 'Attached file'
    const isPdf = typeof value === 'object'
      ? (value.type?.includes('pdf') || fileName?.toLowerCase().endsWith('.pdf'))
      : String(value).toLowerCase().endsWith('.pdf')
    const previewUrl = typeof value === 'object' ? (value.url || value.dataUrl || value.preview) : value

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--fill-ghost-hover, #F4F4F4)',
          border: '1px solid var(--border, #E4E4E4)',
          borderRadius: '12px',
          padding: '10px 14px',
          ...style
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          {isPdf ? (
            <FileText size={18} color="var(--danger, #DC2626)" style={{ flexShrink: 0 }} />
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="attachment preview"
              style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <FileText size={18} color="var(--text-muted, #8C8C8C)" style={{ flexShrink: 0 }} />
          )}
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text, #111111)',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap'
            }}
          >
            {fileName}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          title="Remove attachment"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #8C8C8C)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger, #DC2626)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)')}
        >
          <Trash2 size={15} />
        </button>
      </div>
    )
  }

  return (
    <div
      className="cred-dropzone"
      onClick={() => fileInputRef.current?.click()}
      style={style}
    >
      <UploadCloud size={16} strokeWidth={1.8} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
      <span style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)' }}>
        {placeholder}
      </span>
      {hint && (
        <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', opacity: 0.7 }}>
          &bull; {hint}
        </span>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={onUpload}
      />
    </div>
  )
}

/**
 * NeutralToggle
 * 36x20 neutral toggle switch (off = neutral grey, on = ink track with white knob)
 */
export const NeutralToggle = ({ checked, onChange, disabled = false }) => (
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

/**
 * ToggleRow
 * Horizontal label on left, neutral toggle on right
 */
export const ToggleRow = ({
  label,
  description = null,
  checked,
  onChange,
  disabled = false,
  style = {}
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid var(--border, #E4E4E4)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style
      }}
      onClick={() => !disabled && onChange && onChange(!checked)}
    >
      <div>
        <div style={{ fontSize: '13px', color: 'var(--text, #111111)', fontWeight: 400 }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
            {description}
          </div>
        )}
      </div>
      <NeutralToggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

/**
 * Checkbox
 * Neutral custom checkbox (16x16 with ink fill)
 */
export const Checkbox = ({ checked, onChange, disabled = false, label = null }) => (
  <label
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      userSelect: 'none'
    }}
  >
    <div
      role="checkbox"
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
        width: '16px',
        height: '16px',
        borderRadius: '4px',
        border: checked ? '1px solid var(--text, #0A0A0A)' : '1px solid var(--border, #D4D4D4)',
        backgroundColor: checked ? 'var(--text, #0A0A0A)' : 'var(--card-bg, #FFFFFF)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        transition: 'all 0.12s ease',
        outline: 'none',
        boxSizing: 'border-box'
      }}
    >
      {checked && <Check size={11} strokeWidth={3} color="var(--bg, #FFFFFF)" />}
    </div>
    {label && (
      <span style={{ fontSize: '13px', color: 'var(--text, #111111)', fontWeight: 400 }}>
        {label}
      </span>
    )}
  </label>
)

/**
 * InlineAddLink
 * Small plain text link: "+ New" or "+ Add ...", ink color, underline on hover.
 */
export const InlineAddLink = ({ onClick, label = '+ New', style = {} }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cred-link-btn"
      style={style}
    >
      {label}
    </button>
  )
}

/**
 * RowList
 * Repeatable rows with plain muted numbers (1, 2, 3), icon-only trash button,
 * and small plain text "+ Add item" link.
 */
export const RowList = ({
  items = [''],
  onAdd,
  onRemove,
  onChange,
  addLabel = '+ Add item',
  placeholder = 'Enter item description...',
  style = {}
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', ...style }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '18px',
              textAlign: 'right',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-muted, #8C8C8C)',
              flexShrink: 0,
              userSelect: 'none'
            }}
          >
            {idx + 1}.
          </span>
          <input
            type="text"
            className="cred-input"
            value={item}
            placeholder={placeholder}
            onChange={(e) => onChange(idx, e.target.value)}
            style={{ flex: 1 }}
          />
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => onRemove(idx)}
              title="Remove item"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #8C8C8C)',
                cursor: 'pointer',
                padding: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                borderRadius: '6px',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger, #DC2626)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)')}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}
      <div>
        <button
          type="button"
          onClick={onAdd}
          className="cred-link-btn"
          style={{ marginTop: '4px' }}
        >
          {addLabel}
        </button>
      </div>
    </div>
  )
}
