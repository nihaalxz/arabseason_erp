import re

fpath = 'frontend/src/pages/Cashbook.jsx'
with open(fpath, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Update import
c = re.sub(
    r"import\s*\{\s*showConfirm,\s*showError,\s*showToast,\s*showWarning\s*\}\s*from\s*'\.\./utils/swal'",
    "import { appDialog } from '../utils/appDialog'",
    c
)

# 2. Update PDF catch blocks to format status + server message
old_pdf_catch_1 = """    } catch (err) {
      console.error('Failed to export cashbook PDF:', err)
      showError('Export Failed', 'Failed to generate cashbook PDF ledger from server.')
    } finally {"""

new_pdf_catch_1 = """    } catch (err) {
      console.error('Failed to export cashbook PDF:', err)
      const statusPrefix = err.response?.status ? `[HTTP ${err.response.status}] ` : ''
      let serverMessage = err.message || 'Unknown network error'
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          try {
            const json = JSON.parse(text)
            serverMessage = json.detail || json.error || text
          } catch (_) {
            serverMessage = text.slice(0, 300)
          }
        } catch (_) {}
      } else if (err.response?.data) {
        const d = err.response.data
        serverMessage = typeof d === 'object' ? (d.detail || d.error || JSON.stringify(d)) : String(d)
      }
      appDialog.error('Export Failed', `Failed to generate cashbook PDF ledger from server: ${statusPrefix}${serverMessage}`)
    } finally {"""

old_pdf_catch_2 = """    } catch (err) {
      console.error('Failed to export bank flow PDF:', err)
      showError('Export Failed', 'Failed to generate bank flow PDF from server.')
    } finally {"""

new_pdf_catch_2 = """    } catch (err) {
      console.error('Failed to export bank flow PDF:', err)
      const statusPrefix = err.response?.status ? `[HTTP ${err.response.status}] ` : ''
      let serverMessage = err.message || 'Unknown network error'
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          try {
            const json = JSON.parse(text)
            serverMessage = json.detail || json.error || text
          } catch (_) {
            serverMessage = text.slice(0, 300)
          }
        } catch (_) {}
      } else if (err.response?.data) {
        const d = err.response.data
        serverMessage = typeof d === 'object' ? (d.detail || d.error || JSON.stringify(d)) : String(d)
      }
      appDialog.error('Export Failed', `Failed to generate bank flow PDF from server: ${statusPrefix}${serverMessage}`)
    } finally {"""

c = c.replace(old_pdf_catch_1.replace('\r\n', '\n'), new_pdf_catch_1.replace('\r\n', '\n'))
c = c.replace(old_pdf_catch_1, new_pdf_catch_1)

c = c.replace(old_pdf_catch_2.replace('\r\n', '\n'), new_pdf_catch_2.replace('\r\n', '\n'))
c = c.replace(old_pdf_catch_2, new_pdf_catch_2)

# 3. Replace calls
c = re.sub(r'\bshowConfirm\s*\(', 'appDialog.confirm(', c)
c = re.sub(r'\bshowDeleteConfirm\s*\(', 'appDialog.confirmDelete(', c)
c = re.sub(r'\bshowError\s*\(', 'appDialog.error(', c)
c = re.sub(r'\bshowWarning\s*\(', 'appDialog.warning(', c)
c = re.sub(r'\bshowToast\s*\(', 'appDialog.toast(', c)
c = re.sub(r'\bshowSuccess\s*\(', 'appDialog.toast(', c)

with open(fpath, 'w', encoding='utf-8') as f:
    f.write(c)

print('Migrated frontend/src/pages/Cashbook.jsx')

