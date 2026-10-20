/**
 * Universal PDF Download & Viewing Utilities
 * Handles dynamic filename extraction from Content-Disposition header
 * and ensures seamless display and saving across all browsers.
 */

export const getFilenameFromResponse = (res, fallbackFilename = 'document.pdf') => {
  try {
    const disposition = res?.headers?.['content-disposition'] || res?.headers?.['Content-Disposition']
    if (disposition) {
      // Matches filename*=UTF-8''example.pdf
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
      if (utf8Match && utf8Match[1]) {
        return decodeURIComponent(utf8Match[1].trim())
      }
      // Matches filename="example.pdf" or filename=example.pdf
      const match = disposition.match(/filename=["']?([^"';]+)["']?/i)
      if (match && match[1]) {
        return match[1].trim()
      }
    }
  } catch (err) {
    console.warn('Could not parse Content-Disposition header:', err)
  }
  return fallbackFilename
}

/**
 * Handle server-generated PDF response:
 * 1. Extract dynamic filename from Content-Disposition header.
 * 2. Create blob URL.
 * 3. Open in a new tab (which uses the PDF title metadata for tab name & save dialog)
 *    or trigger download if popup is blocked.
 */
export const handlePdfResponse = (res, fallbackFilename) => {
  const fileName = getFilenameFromResponse(res, fallbackFilename)
  const blob = new Blob([res.data], { type: 'application/pdf' })
  const fileURL = window.URL.createObjectURL(blob)

  // Direct download with exact dynamic filename
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = fileURL
  a.download = fileName
  document.body.appendChild(a)
  a.click()

  setTimeout(() => {
    try {
      document.body.removeChild(a)
      window.URL.revokeObjectURL(fileURL)
    } catch (e) {}
  }, 2000)

  return { fileURL, fileName }
}
