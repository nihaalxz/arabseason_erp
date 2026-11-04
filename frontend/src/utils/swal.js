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
 * Supports permanent delete option via a checkbox.
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
      confirmButton: isDangerous ? 'btn erp-swal-confirm-btn erp-swal-btn-danger' : 'btn erp-swal-confirm-btn',
      cancelButton: 'btn erp-swal-cancel-btn',
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
 */
export const showAlert = async (title, text = '', icon = 'info', confirmButtonText = 'OK') => {
  return await MySwal.fire({
    title,
    text,
    icon,
    confirmButtonText,
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
export const showSuccess = async (title = 'Success!', text = '', confirmButtonText = 'OK') => {
  return await showAlert(title, text, 'success', confirmButtonText)
}

/**
 * Show an error modal
 */
export const showError = async (title = 'Error Occurred', text = '', confirmButtonText = 'OK') => {
  return await showAlert(title, text, 'error', confirmButtonText)
}

/**
 * Show a warning modal
 */
export const showWarning = async (title = 'Attention', text = '', confirmButtonText = 'OK') => {
  return await showAlert(title, text, 'warning', confirmButtonText)
}

/**
 * Show an input prompt modal (replacing window.prompt)
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
 * Show loading dialog
 */
export const showLoading = (title = 'Loading...', text = '') => {
  MySwal.fire({
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading()
    }
  })
}

/**
 * Close any active Swal dialog
 */
export const closeDialog = () => {
  Swal.close()
}

/**
 * Toast notifications - disabled
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
  window.showSuccess = showSuccess
  window.showError = showError
  window.showWarning = showWarning
  window.showLoading = showLoading
  window.closeDialog = closeDialog
}

export default MySwal
