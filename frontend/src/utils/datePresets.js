/**
 * Date Range Presets with zero-timezone-shift local date construction.
 * Avoids .toISOString() which produces UTC dates that shift back one day in positive timezones (e.g. UTC+3 AST, UTC+5:30 IST).
 */

const formatLocalDate = (year, monthIndex, day) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`
}

export const toLocalIsoDate = (d = new Date()) => {
  return formatLocalDate(d.getFullYear(), d.getMonth(), d.getDate())
}

export const DATE_PRESETS = [
  { label: 'All Time', value: 'all_time', start: '', end: '' },
  {
    label: 'This Month',
    value: 'this_month',
    start: () => {
      const now = new Date()
      return formatLocalDate(now.getFullYear(), now.getMonth(), 1)
    },
    end: () => {
      const now = new Date()
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      return formatLocalDate(now.getFullYear(), now.getMonth(), lastDay)
    }
  },
  {
    label: 'Last Month',
    value: 'last_month',
    start: () => {
      const now = new Date()
      return formatLocalDate(now.getFullYear(), now.getMonth() - 1, 1)
    },
    end: () => {
      const now = new Date()
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
      return formatLocalDate(now.getFullYear(), now.getMonth() - 1, lastDay)
    }
  },
  {
    label: 'Last 30 Days',
    value: 'last_30_days',
    start: () => {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      return formatLocalDate(d.getFullYear(), d.getMonth(), d.getDate())
    },
    end: () => toLocalIsoDate()
  },
  {
    label: 'This Year',
    value: 'this_year',
    start: () => {
      const now = new Date()
      return formatLocalDate(now.getFullYear(), 0, 1)
    },
    end: () => {
      const now = new Date()
      return formatLocalDate(now.getFullYear(), 11, 31)
    }
  }
]

export const formatStatementDate = (dateStr) => {
  if (!dateStr) return ''
  try {
    const parts = String(dateStr).split('T')[0].split(' ')[0].split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      const d = new Date(year, month, day)
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }
  } catch (e) {
    return dateStr
  }
  return dateStr
}

