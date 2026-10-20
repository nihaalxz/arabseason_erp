import Swal from 'sweetalert2'

// Base themed SweetAlert2 instance matching Arab Season ERP design
const MySwal = Swal.mixin({
  customClass: {
    container: 'erp-swal-container',
    popup: 'erp-swal-popup',
    title: 'erp-swal-title',
    htmlContainer: 'erp-swal-html',
    confirmButton: 'btn erp-swal-confirm-btn',
    cancelButton: 'btn erp-swal-cancel-btn',
    actions: 'erp-swal-actions',
  },
  buttonsStyling: false,
  reverseButtons: true,
  focusCancel: false,
})

/**
 * Show a sleek confirmation dialog (replacing window.confirm)
 * @param {Object} options
 * @param {string} options.title - Header text
 * @param {string} options.text - Detailed message
 * @param {string} [options.confirmButtonText='Yes, Proceed'] - Confirm button label
 * @param {string} [options.cancelButtonText='Cancel'] - Cancel button label
 * @param {boolean} [options.isDangerous=true] - If true, confirm button is red
 * @param {string} [options.icon='warning'] - 'warning' | 'question' | 'info'
 * @returns {Promise<boolean>} Resolves to true if user clicks confirm, false otherwise
 */
/**
 * Show a sleek confirmation dialog (replacing window.confirm)
 * Supports permanent delete option via a checkbox.
 * @param {Object|string} optionsOrTitle
 * @param {string} [maybeText='']
 * @param {string} [maybeBtnText='']
 * @param {boolean} [maybeDangerous=true]
 * @returns {Promise<boolean|'permanent'|'recycle'>} Resolves to 'permanent', 'recycle' (or true), or false
 */
export const showConfirm = async (optionsOrTitle = {}, maybeText = '', maybeBtnText = '', maybeDangerous = true) => {
  let title = 'Confirmation'
  let text = 'Are you sure you want to proceed?'
  let confirmButtonText = 'Confirm'
  let cancelButtonText = 'Cancel'
  let isDangerous = true
  let icon = 'warning'
  let allowPermanent = false
  let permanentCheckboxLabel = 'Delete permanently (cannot be undone)'

  if (typeof optionsOrTitle === 'string') {
    title = optionsOrTitle
    if (maybeText) text = maybeText
    if (maybeBtnText) confirmButtonText = maybeBtnText
    if (maybeDangerous !== undefined) isDangerous = Boolean(maybeDangerous)
    // If the title/text is deleting, provide the permanent option by default
    if (title.toLowerCase().includes('delete') || text.toLowerCase().includes('delete')) {
      allowPermanent = true
      confirmButtonText = maybeBtnText || 'Move to Recycle Bin'
    }
  } else if (typeof optionsOrTitle === 'object' && optionsOrTitle !== null) {
    if (optionsOrTitle.title) title = optionsOrTitle.title
    if (optionsOrTitle.text) text = optionsOrTitle.text
    if (optionsOrTitle.confirmButtonText) confirmButtonText = optionsOrTitle.confirmButtonText
    if (optionsOrTitle.cancelButtonText) cancelButtonText = optionsOrTitle.cancelButtonText
    if (optionsOrTitle.isDangerous !== undefined) isDangerous = optionsOrTitle.isDangerous
    if (optionsOrTitle.icon) icon = optionsOrTitle.icon
    if (optionsOrTitle.permanentCheckboxLabel) permanentCheckboxLabel = optionsOrTitle.permanentCheckboxLabel
    if (optionsOrTitle.allowPermanent !== undefined) {
      allowPermanent = Boolean(optionsOrTitle.allowPermanent)
    } else if (title.toLowerCase().includes('delete') || text.toLowerCase().includes('delete')) {
      allowPermanent = true
    }
  }

  if (allowPermanent && (!confirmButtonText || confirmButtonText === 'Confirm')) {
    confirmButtonText = 'Move to Recycle Bin'
  }

  const result = await MySwal.fire({
    title,
    text,
    icon,
    input: allowPermanent ? 'checkbox' : undefined,
    inputValue: 0,
    inputPlaceholder: permanentCheckboxLabel,
    showCancelButton: true,
    showDenyButton: false,
    confirmButtonText,
    cancelButtonText,
    customClass: {
      container: 'erp-swal-container',
      popup: 'erp-swal-popup erp-swal-with-checkbox',
      title: 'erp-swal-title',
      htmlContainer: 'erp-swal-html',
      confirmButton: 'btn erp-swal-confirm-btn',
      cancelButton: 'btn btn-secondary erp-swal-cancel-btn',
      actions: 'erp-swal-actions',
      checkbox: 'erp-swal-checkbox',
    },
    didOpen: (popup) => {
      if (allowPermanent) {
        const checkbox = popup.querySelector('.swal2-checkbox input[type="checkbox"]')
        const confirmBtn = popup.querySelector('.swal2-confirm')
        if (checkbox && confirmBtn) {
          const defaultText = confirmButtonText
          checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
              confirmBtn.textContent = 'Delete Permanently'
              confirmBtn.classList.add('erp-swal-btn-danger')
            } else {
              confirmBtn.textContent = defaultText
              confirmBtn.classList.remove('erp-swal-btn-danger')
            }
          })
        }
      }
    }
  })

  if (result.isConfirmed) {
    if (allowPermanent && result.value === 1) {
      return 'permanent'
    }
    return allowPermanent ? 'recycle' : true
  }
  return false
}

/**
 * Convenience helper specifically for deletion dialogs with Recycle Bin vs Permanent Delete
 */
export const showDeleteConfirm = async (optionsOrTitle = {}, maybeText = '') => {
  let opts = typeof optionsOrTitle === 'string'
    ? { title: optionsOrTitle, text: maybeText }
    : { ...optionsOrTitle }
  return showConfirm({
    title: opts.title || 'Delete Record?',
    text: opts.text || 'Are you sure you want to move this item to the Recycle Bin? It can be restored at any time.',
    confirmButtonText: opts.confirmButtonText || 'Move to Recycle Bin',
    cancelButtonText: opts.cancelButtonText || 'Cancel',
    allowPermanent: true,
    isDangerous: true,
    ...opts
  })
}

/**
 * Show an alert modal (replacing window.alert)
 * @param {string} title
 * @param {string} [text='']
 * @param {'success'|'error'|'warning'|'info'|'question'} [icon='info']
 */
export const showAlert = async (title, text = '', icon = 'info') => {
  return await MySwal.fire({
    title,
    text,
    icon,
    confirmButtonText: 'Understood',
    customClass: {
      container: 'erp-swal-container',
      popup: 'erp-swal-popup',
      title: 'erp-swal-title',
      htmlContainer: 'erp-swal-html',
      confirmButton: 'btn btn-primary erp-swal-confirm-btn',
      actions: 'erp-swal-actions',
    },
  })
}

/**
 * Show a success modal
 */
export const showSuccess = async (title = 'Success!', text = '') => {
  return await showAlert(title, text, 'success')
}

/**
 * Show an error modal
 */
export const showError = async (title = 'Error Occurred', text = '') => {
  return await showAlert(title, text, 'error')
}

/**
 * Show a warning modal
 */
export const showWarning = async (title = 'Attention', text = '') => {
  return await showAlert(title, text, 'warning')
}

/**
 * Show an input prompt modal (replacing window.prompt)
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.text='']
 * @param {string} [options.inputPlaceholder='']
 * @param {string} [options.inputValue='']
 * @param {'text'|'number'|'email'|'password'|'textarea'} [options.inputType='text']
 * @param {string} [options.confirmButtonText='Submit']
 * @returns {Promise<string|null>} User input value, or null if cancelled
 */
export const showPrompt = async ({
  title = 'Please Enter Value',
  text = '',
  inputPlaceholder = '',
  inputValue = '',
  inputType = 'text',
  confirmButtonText = 'Submit',
  cancelButtonText = 'Cancel',
} = {}) => {
  const result = await MySwal.fire({
    title,
    text,
    input: inputType,
    inputPlaceholder,
    inputValue,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    inputValidator: (val) => {
      if (!val || !val.trim()) {
        return 'Value cannot be empty!'
      }
      return null
    },
    customClass: {
      container: 'erp-swal-container',
      popup: 'erp-swal-popup',
      title: 'erp-swal-title',
      htmlContainer: 'erp-swal-html',
      confirmButton: 'btn btn-primary erp-swal-confirm-btn',
      cancelButton: 'btn btn-secondary erp-swal-cancel-btn',
      actions: 'erp-swal-actions',
      input: 'input-field erp-swal-input',
    },
  })

  if (result.isConfirmed) {
    return result.value
  }
  return null
}

/**
 * Toast notifications - disabled per request
 */
export const showToast = () => {
  // Toast notifications removed
}

// Global browser fallback override to catch any unexpected native alerts
if (typeof window !== 'undefined') {
  window.erpAlert = showAlert
  window.erpConfirm = showConfirm
  window.erpPrompt = showPrompt
  window.erpToast = showToast
}

export default MySwal
