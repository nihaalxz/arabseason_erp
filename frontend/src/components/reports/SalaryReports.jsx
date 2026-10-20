import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../../api'
import { useSettings } from '../../contexts/SettingsContext'
import { handlePdfResponse } from '../../utils/pdfDownload'
import { showConfirm, showError, showToast } from '../../utils/swal'
import { 
  Plus, Search, Edit2, Trash2, Printer, Calendar, 
  User, Check, X, AlertCircle, CheckCircle2, RefreshCw,
  CreditCard, FileSpreadsheet, Banknote, Download, Building,
  Clock, BookOpen, DollarSign, ChevronRight, ChevronLeft, CalendarDays, ArrowLeft, ArrowRight
} from '../icons'
import * as XLSX from 'xlsx'
import SearchBar from '../common/SearchBar'

const MONTH_OPTIONS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const monthValueToDisplay = (val) => {
  if (!val || val === 'All') return val
  const str = String(val).trim()
  if (/^\d{4}-\d{2}$/.test(str)) {
    const [yStr, mStr] = str.split('-')
    const y = parseInt(yStr, 10)
    const mIdx = parseInt(mStr, 10) - 1
    if (!isNaN(y) && mIdx >= 0 && mIdx < 12) {
      return `${MONTH_OPTIONS[mIdx]} ${y}`
    }
  }
  return val
}

const displayToMonthValue = (val) => {
  if (!val || val === 'All') return ''
  const str = String(val).trim()
  if (/^\d{4}-\d{2}$/.test(str)) {
    return str
  }
  const clean = str.replace(/,/g, ' ').trim()
  const parts = clean.split(/\s+/)
  if (parts.length >= 2) {
    let mIdx = MONTH_OPTIONS.findIndex(m => m.toLowerCase().startsWith(parts[0].toLowerCase()))
    let y = parseInt(parts[1], 10)
    if (mIdx === -1) {
      mIdx = MONTH_OPTIONS.findIndex(m => m.toLowerCase().startsWith(parts[1].toLowerCase()))
      y = parseInt(parts[0], 10)
    }
    if (mIdx !== -1 && !isNaN(y) && y > 1900 && y < 2200) {
      return `${y}-${String(mIdx + 1).padStart(2, '0')}`
    }
  }
  return ''
}

const getCurrentMonthDisplay = () => {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

const getCurrentMonthValue = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const formatApiError = (err, fallback = 'Operation failed') => {
  if (!err) return fallback
  const data = err.response?.data
  if (!data) return err.message || fallback
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  if (Array.isArray(data)) return data.join(' ')
  if (typeof data === 'object') {
    const list = []
    for (const [k, v] of Object.entries(data)) {
      const valText = Array.isArray(v) ? v.join(', ') : String(v)
      list.push(`${k}: ${valText}`)
    }
    return list.join(' | ') || fallback
  }
  return fallback
}

const formatStaffDisplayName = (userOrName) => {
  if (!userOrName) return ''
  let raw = ''
  if (typeof userOrName === 'object') {
    raw = (userOrName.full_name && userOrName.full_name !== userOrName.username)
      ? userOrName.full_name
      : userOrName.username
  } else {
    raw = String(userOrName).trim()
  }
  if (!raw || raw.toLowerCase() === 'all') return ''
  const words = raw.split(/\s+/).filter(Boolean)
  // Deduplicate repeated single words like "john john" -> "John"
  let cleanWords = words
  if (words.length === 2 && words[0].toLowerCase() === words[1].toLowerCase()) {
    cleanWords = [words[0]]
  }
  return cleanWords.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

const formatToTimeInput = (timeStr) => {
  if (!timeStr) return ''
  const trimmed = String(timeStr).trim()
  if (!trimmed) return ''

  // 24-hr format (e.g. "09:00", "09:00:00", "9:00")
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (match24) {
    return `${match24[1].padStart(2, '0')}:${match24[2]}`
  }

  // 12-hr format (e.g. "9:00:00 AM", "1:00 PM", "10:00:00 PM")
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])$/i)
  if (match12) {
    let hours = parseInt(match12[1], 10)
    const mins = match12[2]
    const ampm = match12[3].toUpperCase()
    if (ampm === 'PM' && hours < 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0
    return `${String(hours).padStart(2, '0')}:${mins}`
  }

  return ''
}

const formatTo12Hour = (timeStr) => {
  if (!timeStr) return ''
  const trimmed = String(timeStr).trim()
  if (!trimmed) return ''
  if (/am|pm/i.test(trimmed)) return trimmed

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (match) {
    let h = parseInt(match[1], 10)
    const m = match[2]
    const s = match[3] || '00'
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    return `${h}:${m}:${s} ${ampm}`
  }
  return trimmed
}

const formatTimeDisplay = (timeStr) => {
  if (!timeStr) return '—'
  return formatTo12Hour(timeStr) || '—'
}

const parse12HourTime = (timeStr, defaultHour = '09', defaultMinute = '00', defaultAmpm = 'AM') => {
  if (!timeStr) {
    return { hour: defaultHour, minute: defaultMinute, ampm: defaultAmpm, isEmpty: true }
  }
  const trimmed = String(timeStr).trim()
  if (!trimmed) {
    return { hour: defaultHour, minute: defaultMinute, ampm: defaultAmpm, isEmpty: true }
  }

  // 12-hour format: e.g. "9:00:00 AM", "09:30 AM", "1:00 PM"
  const m12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/i)
  if (m12) {
    let h = parseInt(m12[1], 10)
    const m = m12[2].padStart(2, '0')
    const ampm = (m12[3] || defaultAmpm).toUpperCase()
    if (h > 12) {
      h = h % 12 || 12
      return { hour: String(h).padStart(2, '0'), minute: m, ampm: 'PM', isEmpty: false }
    }
    return { hour: String(h || 12).padStart(2, '0'), minute: m, ampm, isEmpty: false }
  }

  // 24-hour format: e.g. "13:00", "22:00", "09:00"
  const m24 = trimmed.match(/^(\d{1,2}):(\d{2})/i)
  if (m24) {
    let h = parseInt(m24[1], 10)
    const m = m24[2].padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    return { hour: String(h).padStart(2, '0'), minute: m, ampm, isEmpty: false }
  }

  return { hour: defaultHour, minute: defaultMinute, ampm: defaultAmpm, isEmpty: true }
}

const build12HourString = (hour, minute, ampm) => {
  const h = parseInt(hour, 10) || 12
  const m = String(minute).padStart(2, '0')
  return `${h}:${m}:00 ${ampm}`
}

const TimePicker12Hour = ({ label, value, onChange, disabled, defaultHour = '09', defaultMinute = '00', defaultAmpm = 'AM' }) => {
  const { hour, minute, ampm } = parse12HourTime(value, defaultHour, defaultMinute, defaultAmpm)

  const handleHourChange = (e) => {
    const newH = e.target.value
    onChange(build12HourString(newH, minute, ampm))
  }

  const handleMinuteChange = (e) => {
    const newM = e.target.value
    onChange(build12HourString(hour, newM, ampm))
  }

  const handleAmpmChange = (newAmpm) => {
    onChange(build12HourString(hour, minute, newAmpm))
  }

  return (
    <div className="form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
        <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)' }}>
          {label}
        </label>
        {!disabled && value && (
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#047857', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>
            {parseInt(hour, 10)}:{minute} {ampm}
          </span>
        )}
      </div>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px', 
        background: disabled ? '#f1f5f9' : '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        padding: '3px 8px',
        height: '42px',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto'
      }}>
        {/* Hour Dropdown */}
        <select
          value={hour}
          onChange={handleHourChange}
          disabled={disabled}
          style={{
            flex: '1',
            border: 'none',
            background: 'transparent',
            fontWeight: '700',
            fontSize: '0.92rem',
            color: '#0f172a',
            textAlign: 'center',
            cursor: 'pointer',
            outline: 'none',
            padding: '2px'
          }}
        >
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>

        <span style={{ fontWeight: '900', color: '#64748b', fontSize: '1rem' }}>:</span>

        {/* Minute Dropdown */}
        <select
          value={minute}
          onChange={handleMinuteChange}
          disabled={disabled}
          style={{
            flex: '1',
            border: 'none',
            background: 'transparent',
            fontWeight: '700',
            fontSize: '0.92rem',
            color: '#0f172a',
            textAlign: 'center',
            cursor: 'pointer',
            outline: 'none',
            padding: '2px'
          }}
        >
          {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* AM / PM Segmented Toggle */}
        <div style={{
          display: 'inline-flex',
          background: '#e2e8f0',
          borderRadius: '6px',
          padding: '2px',
          marginLeft: '4px'
        }}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAmpmChange('AM')}
            style={{
              border: 'none',
              borderRadius: '4px',
              padding: '4px 9px',
              fontSize: '0.75rem',
              fontWeight: '800',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: ampm === 'AM' ? '#047857' : 'transparent',
              color: ampm === 'AM' ? '#ffffff' : '#475569',
              boxShadow: ampm === 'AM' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            AM
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAmpmChange('PM')}
            style={{
              border: 'none',
              borderRadius: '4px',
              padding: '4px 9px',
              fontSize: '0.75rem',
              fontWeight: '800',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: ampm === 'PM' ? '#047857' : 'transparent',
              color: ampm === 'PM' ? '#ffffff' : '#475569',
              boxShadow: ampm === 'PM' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            PM
          </button>
        </div>
      </div>
    </div>
  )
}

const SalaryReports = ({ onBackToReports }) => {
  const { settings, formatCurrency } = useSettings()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const handleBack = onBackToReports || (() => navigate('/reports'))

  // Page state: 'vouchers' | 'timesheets' | 'ledgers' (Salary Payment is the 1st default tab)
  const subFromUrl = searchParams.get('sub') || 'vouchers'
  const [activePage, setActivePage] = useState(subFromUrl)

  useEffect(() => {
    const s = searchParams.get('sub')
    if (s && s !== activePage) {
      setActivePage(s)
    }
  }, [searchParams])

  const handlePageChange = (pageId) => {
    if (pageId === activePage) return
    setActivePage(pageId)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (next.has('tab')) {
        next.set('tab', 'salary')
      }
      next.set('sub', pageId)
      return next
    }, { replace: true })
  }

  // Data states
  const [salaries, setSalaries] = useState([])
  const [ledgers, setLedgers] = useState([])
  const [timesheets, setTimesheets] = useState([])
  const [staffUsers, setStaffUsers] = useState([])

  const [loading, setLoading] = useState(true)
  const [loadingLedger, setLoadingLedger] = useState(false)
  const [loadingTimesheets, setLoadingTimesheets] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingTimesheet, setSavingTimesheet] = useState(false)
  const [error, setError] = useState(null)
  const [modalError, setModalError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const currentMonthNow = getCurrentMonthDisplay()
  const [timesheetMonthFilter, setTimesheetMonthFilter] = useState(currentMonthNow)
  const defaultTimesheetMonth = currentMonthNow

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [monthFilter, setMonthFilter] = useState(currentMonthNow)
  const [timesheetStaffFilter, setTimesheetStaffFilter] = useState('')

  // Pagination states
  const [timesheetPage, setTimesheetPage] = useState(1)
  const [voucherPage, setVoucherPage] = useState(1)
  const [ledgerPage, setLedgerPage] = useState(1)
  const itemsPerPage = 15

  // Modals
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false)
  const [editingSalaryId, setEditingSalaryId] = useState(null)
  const [salaryFormData, setSalaryFormData] = useState({
    user_id: '',
    staff_name: '',
    paid_month: getCurrentMonthDisplay(),
    payment_date: new Date().toISOString().split('T')[0],
    base_salary: '',
    overtime_hours: '',
    overtime_amount: '',
    amount: '',
    description: ''
  })

  const [isTimesheetModalOpen, setIsTimesheetModalOpen] = useState(false)
  const [editingTimesheetId, setEditingTimesheetId] = useState(null)
  const [timesheetFormData, setTimesheetFormData] = useState({
    user_id: '',
    staff_name: '',
    date: new Date().toISOString().split('T')[0],
    in_time: '9:00:00 AM',
    lunch_time: '1:00:00 PM',
    out_time: '10:00:00 PM',
    debit: '',
    credit: '',
    overtime: '',
    ot_details: '',
    is_off_day: false
  })

  // Bulk Generate 30 Days (One Month) Modal
  const [isGenerateMonthModalOpen, setIsGenerateMonthModalOpen] = useState(false)
  const [generatingMonth, setGeneratingMonth] = useState(false)
  const [generateMonthFormData, setGenerateMonthFormData] = useState({
    user_id: '',
    staff_name: '',
    month: defaultTimesheetMonth,
    in_time: '9:00:00 AM',
    lunch_time: '1:00:00 PM',
    out_time: '10:00:00 PM',
    off_days: 'friday',
    overwrite_existing: false
  })

  // Print modals
  const [voucherToPrint, setVoucherToPrint] = useState(null)
  const [statementEmployee, setStatementEmployee] = useState(null)
  const [voucherPdfLoading, setVoucherPdfLoading] = useState(false)
  const [statementPdfLoading, setStatementPdfLoading] = useState(false)
  const [timesheetPdfLoading, setTimesheetPdfLoading] = useState(false)


  const voucherTimesheets = useMemo(() => {
    if (!voucherToPrint || !Array.isArray(timesheets)) return []
    const staff = (voucherToPrint.staff_name || '').trim().toLowerCase()

    let targetYear = null
    let targetMonth = null
    if (voucherToPrint.paid_month) {
      const ym = displayToMonthValue(voucherToPrint.paid_month)
      if (ym) {
        const [y, m] = ym.split('-').map(Number)
        targetYear = y
        targetMonth = m
      }
    }
    if (!targetYear && voucherToPrint.payment_date) {
      const pDate = new Date(voucherToPrint.payment_date)
      if (!isNaN(pDate.getTime())) {
        targetYear = pDate.getFullYear()
        targetMonth = pDate.getMonth() + 1
      }
    }

    return timesheets.filter(t => {
      const tStaff = (t.staff_name || '').trim().toLowerCase()
      const matchesStaff = tStaff === staff || tStaff.includes(staff) || staff.includes(tStaff)
      if (!matchesStaff) return false

      if (targetYear && targetMonth && t.date) {
        const tDate = new Date(t.date)
        if (!isNaN(tDate.getTime())) {
          return tDate.getFullYear() === targetYear && (tDate.getMonth() + 1) === targetMonth
        }
      }
      return true
    }).sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [voucherToPrint, timesheets])

  const availableStaffList = useMemo(() => {
    const list = []
    const seen = new Set()

    staffUsers.forEach(u => {
      const key = u.username.toLowerCase()
      seen.add(key)
      if (u.full_name) seen.add(u.full_name.toLowerCase())
      list.push({
        id: u.id,
        key: u.username,
        username: u.username,
        displayName: formatStaffDisplayName(u),
        role: u.role
      })
    })

    timesheets.forEach(t => {
      const name = t.staff_name?.trim()
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase())
        list.push({
          id: `custom-${name}`,
          key: name,
          username: name,
          displayName: formatStaffDisplayName(name),
          role: ''
        })
      }
    })

    return list
  }, [staffUsers, timesheets])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    await Promise.all([
      fetchSalaries(),
      fetchLedgers(),
      fetchTimesheets(),
      fetchStaffUsers()
    ])
  }

  const fetchStaffUsers = async () => {
    try {
      const res = await api.get('timesheets/staff-users/')
      const users = Array.isArray(res.data) ? res.data : []
      setStaffUsers(users)
      if (users.length > 0) {
        setTimesheetStaffFilter(prev => {
          if (prev && prev !== 'All' && users.some(u => u.username.toLowerCase() === prev.toLowerCase())) {
            return prev
          }
          return users[0]?.username || ''
        })
      }
    } catch (err) {
      console.error('Error fetching staff users:', err)
    }
  }

  const fetchSalaries = async () => {
    try {
      setLoading(true)
      const res = await api.get('salaries/')
      const data = res.data?.results ? res.data.results : res.data
      setSalaries(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching salaries:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchLedgers = async () => {
    try {
      setLoadingLedger(true)
      const res = await api.get('salaries/ledger/')
      setLedgers(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Error fetching salary ledgers:', err)
    } finally {
      setLoadingLedger(false)
    }
  }

  const fetchTimesheets = async () => {
    try {
      setLoadingTimesheets(true)
      const res = await api.get('timesheets/')
      const data = res.data?.results ? res.data.results : res.data
      const list = Array.isArray(data) ? data : []
      setTimesheets(list)

      if (list.length > 0) {
        setTimesheetMonthFilter(prev => {
          if (!prev || prev === 'All') return prev
          const ym = displayToMonthValue(prev)
          const hasEntries = list.some(t => {
            if (!t.date) return false
            return ym ? t.date.startsWith(ym) : false
          })
          if (hasEntries) return prev

          // If current default month has no entries, default to the latest month present in the data
          const sorted = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          const latestD = new Date(sorted[0].date)
          if (!isNaN(latestD.getTime())) {
            return latestD.toLocaleString('en-US', { month: 'long', year: 'numeric' })
          }
          return prev
        })
      }
    } catch (err) {
      console.error('Error fetching timesheets:', err)
    } finally {
      setLoadingTimesheets(false)
    }
  }

  // Month switcher helpers (seamlessly traverses years 2026, 2027, 2028, etc.)
  const handlePrevMonth = () => {
    let base = new Date()
    const ym = displayToMonthValue(timesheetMonthFilter)
    if (ym) {
      const [y, m] = ym.split('-').map(Number)
      base = new Date(y, m - 1, 1)
    }
    const prevDate = new Date(base.getFullYear(), base.getMonth() - 1, 1)
    setTimesheetMonthFilter(monthValueToDisplay(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`))
    setTimesheetPage(1)
  }

  const handleNextMonth = () => {
    let base = new Date()
    const ym = displayToMonthValue(timesheetMonthFilter)
    if (ym) {
      const [y, m] = ym.split('-').map(Number)
      base = new Date(y, m - 1, 1)
    }
    const nextDate = new Date(base.getFullYear(), base.getMonth() + 1, 1)
    setTimesheetMonthFilter(monthValueToDisplay(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`))
    setTimesheetPage(1)
  }

  const handlePrevVoucherMonth = () => {
    let base = new Date()
    const ym = displayToMonthValue(monthFilter)
    if (ym) {
      const [y, m] = ym.split('-').map(Number)
      base = new Date(y, m - 1, 1)
    }
    const prevDate = new Date(base.getFullYear(), base.getMonth() - 1, 1)
    setMonthFilter(monthValueToDisplay(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`))
    setVoucherPage(1)
  }

  const handleNextVoucherMonth = () => {
    let base = new Date()
    const ym = displayToMonthValue(monthFilter)
    if (ym) {
      const [y, m] = ym.split('-').map(Number)
      base = new Date(y, m - 1, 1)
    }
    const nextDate = new Date(base.getFullYear(), base.getMonth() + 1, 1)
    setMonthFilter(monthValueToDisplay(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`))
    setVoucherPage(1)
  }

  // Bulk 30-Day Monthly Timesheet Generator Handlers
  const handleOpenGenerateMonthModal = () => {
    setModalError(null)
    const activeStaff = staffUsers.find(u => 
      u.username.toLowerCase() === (timesheetStaffFilter || '').toLowerCase() || 
      String(u.id) === String(timesheetStaffFilter)
    ) || staffUsers[0]

    setGenerateMonthFormData({
      user_id: activeStaff ? String(activeStaff.id) : '',
      staff_name: activeStaff ? (activeStaff.full_name || activeStaff.username) : (timesheetStaffFilter || ''),
      month: (timesheetMonthFilter && timesheetMonthFilter !== 'All') ? timesheetMonthFilter : defaultTimesheetMonth,
      in_time: '9:00:00 AM',
      lunch_time: '1:00:00 PM',
      out_time: '10:00:00 PM',
      off_days: 'friday',
      overwrite_existing: false
    })
    setIsGenerateMonthModalOpen(true)
  }

  const handleGenerateMonthStaffChange = (e) => {
    const val = e.target.value
    const found = staffUsers.find(u => String(u.id) === String(val))
    if (found) {
      setGenerateMonthFormData(prev => ({
        ...prev,
        user_id: String(found.id),
        staff_name: found.full_name || found.username
      }))
    } else {
      setGenerateMonthFormData(prev => ({ ...prev, user_id: '', staff_name: '' }))
    }
  }

  const handleGenerateMonthSubmit = async (e) => {
    e.preventDefault()
    if (!generateMonthFormData.staff_name) {
      setModalError('Please select a staff member.')
      return
    }

    try {
      setGeneratingMonth(true)
      setModalError(null)

      let offDaysList = [4] // Friday
      if (generateMonthFormData.off_days === 'none') {
        offDaysList = []
      } else if (generateMonthFormData.off_days === 'friday_saturday') {
        offDaysList = [4, 5]
      } else if (generateMonthFormData.off_days === 'sunday') {
        offDaysList = [6]
      }

      const payload = {
        staff_name: generateMonthFormData.staff_name,
        user_id: generateMonthFormData.user_id ? parseInt(generateMonthFormData.user_id, 10) : null,
        month: generateMonthFormData.month,
        in_time: generateMonthFormData.in_time,
        lunch_time: generateMonthFormData.lunch_time,
        out_time: generateMonthFormData.out_time,
        off_days: offDaysList,
        overwrite_existing: generateMonthFormData.overwrite_existing
      }

      const res = await api.post('timesheets/generate-month/', payload)
      const data = res.data

      setSuccessMsg(data.message || 'Monthly timesheet generated successfully!')

      // Automatically sync UI filters to the generated staff member & month
      if (generateMonthFormData.user_id) {
        const found = staffUsers.find(u => String(u.id) === String(generateMonthFormData.user_id))
        if (found) setTimesheetStaffFilter(found.username)
      } else if (generateMonthFormData.staff_name) {
        setTimesheetStaffFilter(generateMonthFormData.staff_name)
      }

      if (generateMonthFormData.month) {
        setTimesheetMonthFilter(generateMonthFormData.month)
      }
      setTimesheetPage(1)

      setIsGenerateMonthModalOpen(false)
      fetchTimesheets()
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err) {
      console.error('Error generating monthly timesheet:', err)
      const msg = formatApiError(err, 'Failed to generate monthly timesheet.')
      setModalError(msg)
      setError(msg)
    } finally {
      setGeneratingMonth(false)
    }
  }

  // -------------------------------------------------------------
  // Timesheet Modal Handlers
  // -------------------------------------------------------------
  const handleOpenTimesheetModal = (entry = null) => {
    setModalError(null)
    if (entry) {
      setEditingTimesheetId(entry.id)
      let foundUserId = entry.user ? String(entry.user) : ''
      if (!foundUserId && entry.staff_name) {
        const matched = staffUsers.find(u => 
          (u.full_name && u.full_name.trim().toLowerCase() === entry.staff_name.trim().toLowerCase()) ||
          (u.username && u.username.trim().toLowerCase() === entry.staff_name.trim().toLowerCase())
        )
        if (matched) foundUserId = String(matched.id)
      }
      setTimesheetFormData({
        user_id: foundUserId,
        staff_name: entry.staff_name || '',
        date: entry.date || new Date().toISOString().split('T')[0],
        in_time: entry.in_time || '',
        lunch_time: entry.lunch_time || '',
        out_time: entry.out_time || '',
        debit: parseFloat(entry.debit) > 0 ? String(entry.debit) : '',
        credit: parseFloat(entry.credit) > 0 ? String(entry.credit) : '',
        overtime: entry.overtime_text || (parseFloat(entry.overtime_hours) > 0 ? `${entry.overtime_hours}hr` : ''),
        ot_details: entry.ot_details || '',
        is_off_day: !!entry.is_off_day
      })
    } else {
      setEditingTimesheetId(null)
      const defaultUser = staffUsers.find(u => 
        u.username.toLowerCase() === (timesheetStaffFilter || '').toLowerCase() || 
        u.full_name?.toLowerCase() === (timesheetStaffFilter || '').toLowerCase()
      ) || staffUsers[0]

      setTimesheetFormData({
        user_id: defaultUser ? String(defaultUser.id) : '',
        staff_name: defaultUser ? (defaultUser.full_name || defaultUser.username) : (timesheetStaffFilter || ''),
        date: new Date().toISOString().split('T')[0],
        in_time: '9:00:00 AM',
        lunch_time: '1:00:00 PM',
        out_time: '10:00:00 PM',
        debit: '',
        credit: '',
        overtime: '',
        ot_details: '',
        is_off_day: false
      })
    }
    setIsTimesheetModalOpen(true)
    setError(null)
  }

  const handleStaffSelectChange = (e) => {
    const val = e.target.value
    if (!val) {
      setTimesheetFormData(prev => ({ ...prev, user_id: '', staff_name: '' }))
      return
    }
    const found = staffUsers.find(u => String(u.id) === String(val))
    if (found) {
      setTimesheetFormData(prev => ({
        ...prev,
        user_id: String(found.id),
        staff_name: found.full_name || found.username
      }))
    }
  }

  const handleSubmitTimesheet = async (e) => {
    e.preventDefault()
    setModalError(null)
    if (!timesheetFormData.staff_name || !timesheetFormData.staff_name.trim()) {
      setModalError('Please select or specify a staff member.')
      return
    }
    if (!timesheetFormData.date) {
      setModalError('Please provide a date.')
      return
    }

    try {
      setSavingTimesheet(true)
      let otHours = 0
      if (timesheetFormData.overtime) {
        const m = String(timesheetFormData.overtime).match(/[\d.]+/)
        if (m) otHours = parseFloat(m[0]) || 0
      }

      const rawUserId = (timesheetFormData.user_id && timesheetFormData.user_id !== 'custom')
        ? parseInt(timesheetFormData.user_id, 10)
        : null

      const cleanDebit = parseFloat(String(timesheetFormData.debit || 0).replace(/[^\d.]/g, '')) || 0
      const cleanCredit = parseFloat(String(timesheetFormData.credit || 0).replace(/[^\d.]/g, '')) || 0

      const payload = {
        user: (!isNaN(rawUserId) && rawUserId > 0) ? rawUserId : null,
        staff_name: timesheetFormData.staff_name.trim(),
        date: timesheetFormData.date,
        in_time: timesheetFormData.in_time ? formatTo12Hour(timesheetFormData.in_time.trim()) : '',
        lunch_time: timesheetFormData.lunch_time ? formatTo12Hour(timesheetFormData.lunch_time.trim()) : '',
        out_time: timesheetFormData.out_time ? formatTo12Hour(timesheetFormData.out_time.trim()) : '',
        debit: cleanDebit,
        credit: cleanCredit,
        overtime_hours: otHours,
        overtime_text: timesheetFormData.overtime ? String(timesheetFormData.overtime).trim() : '',
        ot_details: timesheetFormData.ot_details ? String(timesheetFormData.ot_details).trim() : '',
        is_off_day: !!timesheetFormData.is_off_day
      }

      let savedItem = null
      if (editingTimesheetId) {
        const res = await api.put(`timesheets/${editingTimesheetId}/`, payload)
        savedItem = res.data
        setTimesheets(prev => prev.map(t => t.id === editingTimesheetId ? savedItem : t))
        setSuccessMsg('Timesheet entry updated successfully!')
      } else {
        const res = await api.post('timesheets/', payload)
        savedItem = res.data
        setTimesheets(prev => [savedItem, ...prev])
        setSuccessMsg('Timesheet entry recorded successfully!')
      }

      // Keep the timesheet view focused on the active/saved staff member
      const matchingUser = staffUsers.find(u => String(u.id) === String(timesheetFormData.user_id))
      const targetStaffKey = matchingUser 
        ? matchingUser.username 
        : (timesheetFormData.staff_name?.trim() || timesheetStaffFilter)

      if (targetStaffKey) {
        setTimesheetStaffFilter(targetStaffKey)
      }
      setTimesheetPage(1)
      setSearchQuery('')
      setIsTimesheetModalOpen(false)
      fetchTimesheets()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      console.error('Error saving timesheet:', err)
      const msg = formatApiError(err, 'Failed to save timesheet entry.')
      setModalError(msg)
      setError(msg)
    } finally {
      setSavingTimesheet(false)
    }
  }

  const handleDeleteTimesheet = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Timesheet Entry?',
      text: 'Are you sure you want to delete this timesheet entry? This cannot be undone.',
      confirmButtonText: 'Yes, delete',
      isDangerous: true
    })
    if (!confirmed) return
    try {
      await api.delete(`timesheets/${id}/`)
      setTimesheets(prev => prev.filter(t => t.id !== id))
      showToast('Timesheet entry deleted successfully')
    } catch (err) {
      showError('Delete Failed', formatApiError(err, 'Failed to delete timesheet entry.'))
    }
  }

  // -------------------------------------------------------------
  // Salary Voucher Modal Handlers
  // -------------------------------------------------------------
  const handleOpenSalaryCreateModal = () => {
    setEditingSalaryId(null)
    setSalaryFormData({
      user_id: '',
      staff_name: '',
      paid_month: getCurrentMonthDisplay(),
      payment_date: new Date().toISOString().split('T')[0],
      base_salary: '',
      overtime_hours: '',
      overtime_amount: '',
      amount: '',
      description: ''
    })
    setIsSalaryModalOpen(true)
    setError(null)
  }

  const handleOpenSalaryEditModal = (item) => {
    setEditingSalaryId(item.id)
    const base = parseFloat(item.base_salary) > 0 ? item.base_salary : (item.amount || '')
    const staffName = item.staff_name || ''
    const matchedUser = staffUsers.find(u => 
      (u.full_name && u.full_name.trim().toLowerCase() === staffName.trim().toLowerCase()) ||
      (u.username && u.username.trim().toLowerCase() === staffName.trim().toLowerCase())
    )
    setSalaryFormData({
      user_id: matchedUser ? String(matchedUser.id) : '',
      staff_name: staffName,
      paid_month: item.paid_month || '',
      payment_date: item.payment_date || '',
      base_salary: base,
      overtime_hours: item.overtime_hours || '',
      overtime_amount: item.overtime_amount || '',
      amount: item.amount || '',
      description: item.description || ''
    })
    setIsSalaryModalOpen(true)
    setError(null)
  }

  const handleSalaryStaffChange = (e) => {
    const val = e.target.value
    if (!val) {
      setSalaryFormData(prev => ({ ...prev, user_id: '', staff_name: '' }))
      return
    }
    const found = staffUsers.find(u => String(u.id) === String(val))
    if (found) {
      setSalaryFormData(prev => ({
        ...prev,
        user_id: String(found.id),
        staff_name: found.full_name || found.username
      }))
    }
  }

  const calcBase = parseFloat(salaryFormData.base_salary) || 0
  const calcOtAmount = parseFloat(salaryFormData.overtime_amount) || 0
  const calcTotalSalary = calcBase + calcOtAmount
  const calcAmountPaid = parseFloat(salaryFormData.amount) || 0
  const calcPending = calcTotalSalary - calcAmountPaid

  const handleSubmitSalary = async (e) => {
    e.preventDefault()
    if (!salaryFormData.staff_name.trim()) {
      setError('Please provide the staff member name.')
      return
    }

    const baseVal = parseFloat(salaryFormData.base_salary) || 0
    const otVal = parseFloat(salaryFormData.overtime_amount) || 0
    const paidVal = parseFloat(salaryFormData.amount) || 0
    const totalOwed = baseVal + otVal

    if (totalOwed <= 0 && paidVal <= 0) {
      setError('Please specify a base salary, overtime amount, or payment amount.')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const payload = {
        staff_name: salaryFormData.staff_name.trim(),
        paid_month: salaryFormData.paid_month.trim(),
        payment_date: salaryFormData.payment_date || new Date().toISOString().split('T')[0],
        base_salary: baseVal,
        overtime_hours: parseFloat(salaryFormData.overtime_hours) || 0,
        overtime_amount: otVal,
        total_salary: totalOwed > 0 ? totalOwed : paidVal,
        amount: paidVal,
        description: salaryFormData.description.trim()
      }

      if (editingSalaryId) {
        await api.put(`salaries/${editingSalaryId}/`, payload)
        setSuccessMsg('Salary payment record updated successfully!')
      } else {
        await api.post('salaries/', payload)
        setSuccessMsg('New salary payment recorded successfully!')
      }

      setIsSalaryModalOpen(false)
      fetchSalaries()
      fetchLedgers()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      console.error('Error saving salary record:', err)
      setError(formatApiError(err, 'Failed to save salary record.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSalary = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Salary Record?',
      text: 'Are you sure you want to delete this salary payment record? This cannot be undone.',
      confirmButtonText: 'Yes, delete',
      isDangerous: true
    })
    if (!confirmed) return
    try {
      await api.delete(`salaries/${id}/`)
      setSalaries(prev => prev.filter(s => s.id !== id))
      fetchLedgers()
      showToast('Salary payment record deleted successfully')
    } catch (err) {
      showError('Delete Failed', formatApiError(err, 'Failed to delete salary record.'))
    }
  }

  const handlePrintVoucher = (salaryRecord) => {
    const empLedger = ledgers.find(l => l.staff_name?.trim().toLowerCase() === salaryRecord.staff_name?.trim().toLowerCase())
    const empEntry = empLedger?.entries?.find(e => e.id === salaryRecord.id)
    setVoucherToPrint({
      ...salaryRecord,
      running_balance: empEntry ? empEntry.running_balance : (parseFloat(salaryRecord.total_salary || salaryRecord.amount) - parseFloat(salaryRecord.amount))
    })
  }

  // -------------------------------------------------------------
  // Filtered Lists & Metrics
  // -------------------------------------------------------------
  const filteredTimesheets = timesheets.filter(t => {
    const matchesSearch = !searchQuery.trim() ||
      t.staff_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.ot_details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.overtime_text?.toLowerCase().includes(searchQuery.toLowerCase())

    let matchesStaff = true
    if (timesheetStaffFilter && timesheetStaffFilter !== 'All') {
      const activeUser = staffUsers.find(u => 
        u.username.toLowerCase() === timesheetStaffFilter.toLowerCase() ||
        String(u.id) === String(timesheetStaffFilter) ||
        (u.full_name && u.full_name.toLowerCase() === timesheetStaffFilter.toLowerCase())
      )


      if (activeUser) {
        if (t.user && String(t.user) === String(activeUser.id)) {
          matchesStaff = true
        } else if (t.user_username && t.user_username.toLowerCase() === activeUser.username.toLowerCase()) {
          matchesStaff = true
        } else {
          const tName = (t.staff_name || '').toLowerCase().trim()
          const uName = activeUser.username.toLowerCase().trim()
          const fName = (activeUser.full_name || '').toLowerCase().trim()
          matchesStaff = tName === uName || tName === fName || tName.includes(uName) || (fName && tName.includes(fName))
        }
      } else {
        const tName = (t.staff_name || '').toLowerCase().trim()
        const fFilter = timesheetStaffFilter.toLowerCase().trim()
        matchesStaff = tName === fFilter || tName.includes(fFilter)
      }
    }

    let matchesMonth = true
    if (timesheetMonthFilter && timesheetMonthFilter !== 'All') {
      const ym = displayToMonthValue(timesheetMonthFilter)
      if (ym && t.date) {
        matchesMonth = t.date.startsWith(ym)
      } else if (t.date) {
        const d = new Date(t.date)
        const tMonthDisplay = d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
        matchesMonth = tMonthDisplay === timesheetMonthFilter
      }
    }

    return matchesSearch && matchesStaff && matchesMonth
  }).sort((a, b) => {
    if (timesheetMonthFilter && timesheetMonthFilter !== 'All') {
      return (a.date || '').localeCompare(b.date || '')
    }
    return (b.date || '').localeCompare(a.date || '')
  })

  const filteredSalaries = salaries.filter(s => {
    const matchesSearch = 
      s.staff_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.paid_month?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchQuery.toLowerCase())

    let matchesMonth = true
    if (monthFilter && monthFilter !== 'All') {
      let sYm = displayToMonthValue(s.paid_month)
      if (!sYm && s.payment_date) {
        sYm = String(s.payment_date).substring(0, 7)
      }
      const filterYm = displayToMonthValue(monthFilter)
      if (sYm && filterYm) {
        matchesMonth = sYm === filterYm
      } else if (s.paid_month) {
        matchesMonth = s.paid_month.trim().toLowerCase() === monthFilter.trim().toLowerCase()
      } else {
        matchesMonth = false
      }
    }
    return matchesSearch && matchesMonth
  })

  const filteredLedgers = ledgers.filter(l => 
    l.staff_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Metrics
  const totalTimesheetCredit = filteredTimesheets.reduce((acc, t) => acc + (parseFloat(t.credit) || 0), 0)
  const totalTimesheetDebit = filteredTimesheets.reduce((acc, t) => acc + (parseFloat(t.debit) || 0), 0)
  const totalTimesheetOtHours = filteredTimesheets.reduce((acc, t) => acc + (parseFloat(t.overtime_hours) || 0), 0)
  const totalWorkedDays = filteredTimesheets.filter(t => !t.is_off_day && (t.in_time || t.out_time)).length

  const totalDisbursed = filteredSalaries.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0)
  const totalOvertimeAmount = filteredSalaries.reduce((sum, s) => sum + parseFloat(s.overtime_amount || 0), 0)
  const totalPendingBalance = ledgers.reduce((sum, l) => sum + Math.max(0, parseFloat(l.current_pending_balance || 0)), 0)

  const currentMonthName = getCurrentMonthDisplay()
  const currentMonthTotal = salaries
    .filter(s => {
      const sYm = displayToMonthValue(s.paid_month)
      const curYm = getCurrentMonthValue()
      return sYm ? sYm === curYm : s.paid_month === currentMonthName
    })
    .reduce((sum, s) => sum + parseFloat(s.amount || 0), 0)

  // Exports
  const exportTimesheetToExcel = () => {
    const rows = filteredTimesheets.map(t => ({
      'Date': t.date,
      'Staff Member': t.staff_name,
      'IN Time': t.in_time || '',
      'Lunch Time': t.lunch_time || '',
      'OUT Time': t.out_time || '',
      'DEBIT (SAR)': parseFloat(t.debit) || 0,
      'CREDIT (SAR)': parseFloat(t.credit) || 0,
      'Overtime': t.overtime_text || (parseFloat(t.overtime_hours) > 0 ? `${t.overtime_hours}hr` : ''),
      'OT Details': t.ot_details || '',
      'Off Day / Holiday': t.is_off_day ? 'Yes' : 'No'
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Staff_Timesheet')
    XLSX.writeFile(wb, `Staff_Timesheet_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const exportSalariesToExcel = () => {
    const rows = filteredSalaries.map(s => {
      const base = parseFloat(s.base_salary) > 0 ? parseFloat(s.base_salary) : parseFloat(s.amount)
      const otAmt = parseFloat(s.overtime_amount || 0)
      const totOwed = parseFloat(s.total_salary) > 0 ? parseFloat(s.total_salary) : (base + otAmt)
      const paid = parseFloat(s.amount)
      const pending = totOwed - paid
      return {
        'Staff Name': s.staff_name,
        'Paid Month': s.paid_month,
        'Payment Date': s.payment_date,
        [`Base Salary (${settings?.currency || 'SAR'})`]: base,
        'Overtime Hours': parseFloat(s.overtime_hours || 0),
        [`Overtime Amount (${settings?.currency || 'SAR'})`]: otAmt,
        [`Total Salary Owed (${settings?.currency || 'SAR'})`]: totOwed,
        [`Amount Paid (${settings?.currency || 'SAR'})`]: paid,
        [`Pending Balance (${settings?.currency || 'SAR'})`]: pending,
        'Description / Notes': s.description || ''
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Salary_Vouchers')
    XLSX.writeFile(wb, `Salary_Vouchers_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Server-Side Universal PDF Exports
  const handleExportVoucherPDF = async (voucher) => {
    if (!voucher || !voucher.id) return
    try {
      setVoucherPdfLoading(true)
      const res = await api.get(`salaries/${voucher.id}/voucher-pdf/`, { responseType: 'blob' })
      const staffSlug = (voucher.staff_name || 'staff').toLowerCase().replace(/[^a-z0-9]/g, '_')
      const monthSlug = (voucher.paid_month || voucher.payment_date || '').toLowerCase().replace(/[^a-z0-9]/g, '_')
      handlePdfResponse(res, `salary_slip_${staffSlug}_${monthSlug}.pdf`)
    } catch (err) {
      console.error('Failed to export voucher PDF:', err)
      showError('Export Failed', 'Failed to generate salary voucher PDF from server.')
    } finally {
      setVoucherPdfLoading(false)
    }
  }

  const handleExportTimesheetPDF = async () => {
    try {
      setTimesheetPdfLoading(true)
      const params = {}
      if (timesheetStaffFilter && timesheetStaffFilter !== 'All') {
        params.staff_name = timesheetStaffFilter
      }
      if (timesheetMonthFilter && timesheetMonthFilter !== 'All') {
        params.month = timesheetMonthFilter
      }
      const res = await api.get('timesheets/pdf/', { params, responseType: 'blob' })
      const staffSlug = (timesheetStaffFilter || 'all_staff').toLowerCase().replace(/[^a-z0-9]/g, '_')
      handlePdfResponse(res, `timesheet_${staffSlug}_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('Failed to export timesheet PDF:', err)
      showError('Export Failed', 'Failed to generate timesheet PDF report from server.')
    } finally {
      setTimesheetPdfLoading(false)
    }
  }

  const handleExportLedgerPDF = async (employee) => {
    if (!employee || !employee.staff_name) return
    try {
      setStatementPdfLoading(true)
      const res = await api.get('salaries/ledger-pdf/', {
        params: { staff_name: employee.staff_name },
        responseType: 'blob'
      })
      const staffSlug = (employee.staff_name || 'employee').toLowerCase().replace(/[^a-z0-9]/g, '_')
      handlePdfResponse(res, `employee_ledger_${staffSlug}_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('Failed to export employee ledger PDF:', err)
      showError('Export Failed', 'Failed to generate employee ledger PDF from server.')
    } finally {
      setStatementPdfLoading(false)
    }
  }

  // Pagination Helper Component
  const Pagination = ({ total, page, setPage, pageSize = itemsPerPage }) => {
    const totalPages = Math.ceil(total / pageSize) || 1
    if (totalPages <= 1) return null
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 10px 10px', fontSize: '0.85rem' }}>
        <span style={{ color: '#64748b' }}>
          Showing <strong>{((page - 1) * pageSize) + 1}</strong> to <strong>{Math.min(page * pageSize, total)}</strong> of <strong>{total}</strong> records
        </span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="btn btn-secondary"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
          >
            &larr; Previous
          </button>
          <span style={{ padding: '0 0.5rem', fontWeight: '800', color: '#0f172a' }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="btn btn-secondary"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', opacity: page >= totalPages ? 0.5 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Next &rarr;
          </button>
        </div>
      </div>
    )
  }

  // Paginated Slices
  const timesheetPageSize = timesheetMonthFilter !== 'All' ? 35 : itemsPerPage
  const paginatedTimesheets = filteredTimesheets.slice((timesheetPage - 1) * timesheetPageSize, timesheetPage * timesheetPageSize)
  const paginatedSalaries = filteredSalaries.slice((voucherPage - 1) * itemsPerPage, voucherPage * itemsPerPage)
  const paginatedLedgers = filteredLedgers.slice((ledgerPage - 1) * itemsPerPage, ledgerPage * itemsPerPage)

  return (
    <div className="salary-suite-wrapper" style={{ width: '100%', maxWidth: '1450px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* ── TOP HEADER & SUB-PAGE NAVIGATION ── */}
      <div className="glass-panel no-print" style={{ padding: '1.25rem 1.5rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', border: '1px solid var(--border-color)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button 
              type="button" 
              onClick={handleBack}
              className="btn btn-secondary" 
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              title="Return to Financial Reports"
            >
              <ArrowLeft size={14} /> Reports
            </button>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              Salary, Timesheet & Payroll
            </h2>
          </div>
          <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            Multi-page workspace for daily staff timesheet attendance, salary disbursements, and running ledger accounts
          </p>
        </div>

        {/* Segmented Page Switcher - 1. Salary Payment, 2. Staff Timesheets, 3. Employee Ledgers */}
        <div style={{ display: 'flex', background: '#e2e8f0', padding: '0.3rem', borderRadius: '10px', gap: '0.25rem' }}>
          {/* TAB 1: Salary Payment */}
          <button
            type="button"
            onClick={() => handlePageChange('vouchers')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '700',
              background: activePage === 'vouchers' ? '#1366d9' : 'transparent',
              color: activePage === 'vouchers' ? '#ffffff' : '#334155',
              boxShadow: activePage === 'vouchers' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Banknote size={16} />
            <span>Salary Payment</span>
            <span style={{ 
              background: activePage === 'vouchers' ? 'rgba(255,255,255,0.25)' : '#cbd5e1', 
              color: activePage === 'vouchers' ? '#ffffff' : '#475569',
              padding: '1px 6px',
              borderRadius: '999px',
              fontSize: '0.725rem',
              fontWeight: '800',
              transition: 'background-color 0.2s ease, color 0.2s ease'
            }}>
              {salaries.length}
            </span>
          </button>

          {/* TAB 2: Staff Timesheets */}
          <button
            type="button"
            onClick={() => handlePageChange('timesheets')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '700',
              background: activePage === 'timesheets' ? '#047857' : 'transparent',
              color: activePage === 'timesheets' ? '#ffffff' : '#334155',
              boxShadow: activePage === 'timesheets' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Clock size={16} />
            <span>Staff Timesheets</span>
            <span style={{ 
              background: activePage === 'timesheets' ? 'rgba(255,255,255,0.25)' : '#cbd5e1', 
              color: activePage === 'timesheets' ? '#ffffff' : '#475569',
              padding: '1px 6px',
              borderRadius: '999px',
              fontSize: '0.725rem',
              fontWeight: '800',
              transition: 'background-color 0.2s ease, color 0.2s ease'
            }}>
              {timesheets.length}
            </span>
          </button>

          {/* TAB 3: Employee Ledgers */}
          <button
            type="button"
            onClick={() => handlePageChange('ledgers')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '700',
              background: activePage === 'ledgers' ? '#1e293b' : 'transparent',
              color: activePage === 'ledgers' ? '#ffffff' : '#334155',
              boxShadow: activePage === 'ledgers' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <BookOpen size={16} />
            <span>Employee Ledgers</span>
            <span style={{ 
              background: activePage === 'ledgers' ? 'rgba(255,255,255,0.25)' : '#cbd5e1', 
              color: activePage === 'ledgers' ? '#ffffff' : '#475569',
              padding: '1px 6px',
              borderRadius: '999px',
              fontSize: '0.725rem',
              fontWeight: '800',
              transition: 'background-color 0.2s ease, color 0.2s ease'
            }}>
              {ledgers.length}
            </span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="success-message no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}
      {error && (
        <div className="error-message no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* ── SUB-PAGES WRAPPER (Smooth animated tab viewport) ── */}
      <div className="salary-tab-viewport">
        {/* =========================================================================
            PAGE 1: STAFF TIMESHEETS
            ========================================================================= */}
        {activePage === 'timesheets' && (
          <div className="timesheet-page-content salary-tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Action Header & Filter Bar */}
          <div className="glass-panel no-print salary-toolbar-panel" style={{ padding: '1rem 1.25rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <SearchBar
                  value={searchQuery}
                  onChange={(val) => { setSearchQuery(val); setTimesheetPage(1); }}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Individual Staff Selection - No All option */}
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <select 
                  className="input-field" 
                  value={timesheetStaffFilter} 
                  onChange={(e) => { setTimesheetStaffFilter(e.target.value); setTimesheetPage(1); }} 
                  style={{ width: '100%', height: '38px', fontWeight: '700', color: '#0f172a' }}
                >
                  {availableStaffList.map(s => (
                    <option key={s.key} value={s.username}>
                      {s.displayName} {s.role ? `(${s.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period / Month filter with Prev / Next switcher & Native Month Picker */}
              <div style={{ flex: '1 1 270px', minWidth: '240px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handlePrevMonth}
                  title="Previous Month"
                  style={{ padding: '0.45rem 0.55rem', height: '38px', borderRadius: '6px' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <input
                  type="month"
                  className="input-field"
                  value={displayToMonthValue(timesheetMonthFilter)}
                  onChange={(e) => {
                    if (e.target.value) {
                      setTimesheetMonthFilter(monthValueToDisplay(e.target.value))
                    } else {
                      setTimesheetMonthFilter('All')
                    }
                    setTimesheetPage(1)
                  }}
                  style={{
                    flex: 1,
                    height: '38px',
                    fontWeight: '700',
                    color: timesheetMonthFilter === 'All' ? '#64748b' : '#0f172a',
                    cursor: 'pointer',
                    background: timesheetMonthFilter === 'All' ? '#f8fafc' : '#ffffff'
                  }}
                  title={timesheetMonthFilter === 'All' ? 'Click to filter by month' : timesheetMonthFilter}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleNextMonth}
                  title="Next Month"
                  style={{ padding: '0.45rem 0.55rem', height: '38px', borderRadius: '6px' }}
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className={timesheetMonthFilter === 'All' ? 'btn btn-primary' : 'btn btn-secondary'}
                  onClick={() => {
                    if (timesheetMonthFilter === 'All') {
                      setTimesheetMonthFilter(getCurrentMonthDisplay())
                    } else {
                      setTimesheetMonthFilter('All')
                    }
                    setTimesheetPage(1)
                  }}
                  title={timesheetMonthFilter === 'All' ? 'Filter by Current Month' : 'Show All Months Combined'}
                  style={{
                    height: '38px',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  All
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button 
                className="btn glass-panel" 
                style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} 
                onClick={exportTimesheetToExcel} 
                title="Export Timesheet Excel"
              >
                <FileSpreadsheet size={16} /> <span>Excel</span>
              </button>
              <button 
                className="btn glass-panel" 
                style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} 
                onClick={handleExportTimesheetPDF} 
                disabled={timesheetPdfLoading}
                title="Export Timesheet PDF"
              >
                <Download size={16} /> <span>{timesheetPdfLoading ? 'Generating...' : 'PDF'}</span>
              </button>
              <button className="btn btn-secondary" onClick={fetchTimesheets} title="Refresh Timesheets">
                <RefreshCw size={16} className={loadingTimesheets ? 'spin' : ''} />
              </button>
              
              <button
                type="button"
                className="btn"
                onClick={handleOpenGenerateMonthModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                  background: '#0284c7',
                  color: '#ffffff',
                  fontWeight: '700',
                  padding: '0.55rem 1rem',
                  borderRadius: '8px'
                }}
                title="Bulk generate 30 days of daily timesheet entries for a full month"
              >
                <CalendarDays size={18} /> <span>Generate Month (30 Days)</span>
              </button>

              <button
                className="btn"
                onClick={() => handleOpenTimesheetModal()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                  background: '#047857',
                  color: '#ffffff',
                  fontWeight: '700',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '8px'
                }}
              >
                <Plus size={18} /> <span>Add Timesheet Entry</span>
              </button>
            </div>
          </div>

          {/* 3 Clean KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>LOGGED WORK DAYS</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0f172a' }}>{totalWorkedDays} Days</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{filteredTimesheets.length} total entries</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>TOTAL OVERTIME</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#dc2626' }}>{totalTimesheetOtHours.toFixed(0)} hrs</div>
                <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: '600' }}>Extra work completed</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>TOTAL CREDIT / ADVANCES</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#059669' }}>{formatCurrency(totalTimesheetCredit)}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Disbursed in cash/mode</div>
              </div>
            </div>
          </div>

          {/* Timesheet Journal Table (Full Width) */}
          <div className="glass-panel" style={{ borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1.25rem', background: '#1c3e38', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: '800', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} />
                <span>
                  DAILY ATTENDANCE & TIMESHEET JOURNAL
                  {timesheetStaffFilter && timesheetStaffFilter !== 'All' ? ` — ${formatStaffDisplayName(timesheetStaffFilter).toUpperCase()}` : ''}
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#a7f3d0' }}>
                Showing {filteredTimesheets.length} records
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#244e45', color: '#ffffff', fontWeight: '800', fontSize: '0.75rem', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.65rem 0.5rem', border: '1px solid #1a3c36', minWidth: '105px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                        <Calendar size={13} /> DATE
                      </div>
                    </th>
                    <th style={{ padding: '0.65rem 0.5rem', border: '1px solid #1a3c36', minWidth: '95px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                        <Clock size={13} /> IN TIME
                      </div>
                    </th>
                    <th style={{ padding: '0.65rem 0.5rem', border: '1px solid #1a3c36', minWidth: '95px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                        <Clock size={13} /> LUNCH
                      </div>
                    </th>
                    <th style={{ padding: '0.65rem 0.5rem', border: '1px solid #1a3c36', minWidth: '95px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                        <Clock size={13} /> OUT
                      </div>
                    </th>
                    <th style={{ padding: '0.65rem 0.5rem', border: '1px solid #1a3c36', minWidth: '80px' }}>DEBIT</th>
                    <th style={{ padding: '0.65rem 0.5rem', border: '1px solid #1a3c36', minWidth: '85px' }}>CREDIT</th>
                    <th style={{ padding: '0.65rem 0.5rem', border: '1px solid #1a3c36', minWidth: '95px' }}>OVER TIME</th>
                    <th style={{ padding: '0.65rem 0.75rem', border: '1px solid #1a3c36', textAlign: 'left', minWidth: '180px' }}>OT DETAILS</th>
                    <th style={{ padding: '0.65rem 0.5rem', border: '1px solid #1a3c36', minWidth: '80px' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTimesheets.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Clock size={38} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                        <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                          No timesheet records found for {timesheetMonthFilter !== 'All' ? timesheetMonthFilter : 'this selection'}.
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
                          Quickly generate 30 days of daily attendance entries for this month in one go, then easily edit day by day.
                        </p>
                        <button
                          type="button"
                          className="btn"
                          onClick={handleOpenGenerateMonthModal}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            background: '#0284c7',
                            color: '#ffffff',
                            fontWeight: '700',
                            padding: '0.55rem 1.25rem',
                            borderRadius: '8px'
                          }}
                        >
                          <CalendarDays size={18} /> <span>Generate {timesheetMonthFilter !== 'All' ? timesheetMonthFilter : 'Month'} Timesheet (30 Days)</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    paginatedTimesheets.map((row, idx) => {
                      let formattedDate = row.date
                      let dayName = ''
                      try {
                        const d = new Date(row.date)
                        if (!isNaN(d.getTime())) {
                          dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
                        }
                        const parts = row.date.split('-')
                        if (parts.length === 3) formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`
                      } catch (e) {}

                      return (
                        <tr 
                          key={row.id || idx} 
                          style={{ 
                            borderBottom: '1px solid #e2e8f0', 
                            background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                            transition: 'background 0.15s ease' 
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                          onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f8fafc'}
                        >
                          {/* Date (Red badge if off-day / holiday) */}
                          <td style={{ padding: '0.5rem 0.4rem', borderRight: '1px solid #e2e8f0' }}>
                            {row.is_off_day ? (
                              <div style={{
                                background: '#dc2626',
                                color: '#ffffff',
                                fontWeight: '800',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <span>{formattedDate}</span>
                                <span style={{ opacity: 0.9, fontSize: '0.72rem' }}>({dayName || 'OFF'})</span>
                              </div>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.825rem' }}>
                                  {formattedDate}
                                </span>
                                {dayName && (
                                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                                    ({dayName})
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* IN TIME */}
                          <td style={{ padding: '0.5rem 0.4rem', borderRight: '1px solid #e2e8f0', fontSize: '0.825rem', color: '#334155' }}>
                            {formatTimeDisplay(row.in_time)}
                          </td>

                          {/* LUNCH */}
                          <td style={{ padding: '0.5rem 0.4rem', borderRight: '1px solid #e2e8f0', fontSize: '0.825rem', color: '#334155' }}>
                            {formatTimeDisplay(row.lunch_time)}
                          </td>

                          {/* OUT */}
                          <td style={{ padding: '0.5rem 0.4rem', borderRight: '1px solid #e2e8f0', fontSize: '0.825rem', color: '#334155' }}>
                            {formatTimeDisplay(row.out_time)}
                          </td>

                          {/* DEBIT */}
                          <td style={{ padding: '0.5rem 0.4rem', borderRight: '1px solid #e2e8f0', fontWeight: '700', color: '#b91c1c', fontSize: '0.85rem' }}>
                            {parseFloat(row.debit) > 0 ? `${parseFloat(row.debit)} SR` : '—'}
                          </td>

                          {/* CREDIT */}
                          <td style={{ padding: '0.5rem 0.4rem', borderRight: '1px solid #e2e8f0', fontWeight: '800', color: '#047857', fontSize: '0.85rem' }}>
                            {parseFloat(row.credit) > 0 ? `${parseFloat(row.credit)} SR` : '—'}
                          </td>

                          {/* OVER TIME (bold red italic font like screenshot) */}
                          <td style={{ padding: '0.5rem 0.4rem', borderRight: '1px solid #e2e8f0', fontWeight: '800', color: '#dc2626', fontStyle: 'italic', fontSize: '0.875rem' }}>
                            {row.overtime_text || (parseFloat(row.overtime_hours) > 0 ? `${parseFloat(row.overtime_hours)}hr` : '—')}
                          </td>

                          {/* OT DETAILS */}
                          <td style={{ padding: '0.5rem 0.75rem', borderRight: '1px solid #e2e8f0', textAlign: 'left', fontWeight: '600', fontSize: '0.8rem', color: '#1e293b' }}>
                            {row.ot_details || '—'}
                          </td>

                          {/* ACTIONS */}
                          <td style={{ padding: '0.4rem', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenTimesheetModal(row)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '3px' }}
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTimesheet(row.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '3px' }}
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination total={filteredTimesheets.length} page={timesheetPage} setPage={setTimesheetPage} pageSize={timesheetPageSize} />
          </div>
        </div>
      )}

        {/* =========================================================================
            PAGE 2: SALARY PAYMENT VOUCHERS
            ========================================================================= */}
        {activePage === 'vouchers' && (
          <div className="vouchers-page-content salary-tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Action Header & Filter Bar */}
          <div className="glass-panel no-print salary-toolbar-panel" style={{ padding: '1rem 1.25rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <SearchBar
                  value={searchQuery}
                  onChange={(val) => { setSearchQuery(val); setVoucherPage(1); }}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Period / Month filter with Prev / Next switcher & Native Month Picker */}
              <div style={{ flex: '1 1 270px', minWidth: '240px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handlePrevVoucherMonth}
                  title="Previous Month"
                  style={{ padding: '0.45rem 0.55rem', height: '38px', borderRadius: '6px' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <input 
                  type="month"
                  className="input-field" 
                  value={displayToMonthValue(monthFilter)} 
                  onChange={(e) => { 
                    if (e.target.value) {
                      setMonthFilter(monthValueToDisplay(e.target.value))
                    } else {
                      setMonthFilter('All')
                    }
                    setVoucherPage(1)
                  }} 
                  style={{ 
                    flex: 1, 
                    height: '38px',
                    fontWeight: '700',
                    color: monthFilter === 'All' ? '#64748b' : '#0f172a',
                    cursor: 'pointer',
                    background: monthFilter === 'All' ? '#f8fafc' : '#ffffff'
                  }}
                  title={monthFilter === 'All' ? 'Click to filter by month' : monthFilter}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleNextVoucherMonth}
                  title="Next Month"
                  style={{ padding: '0.45rem 0.55rem', height: '38px', borderRadius: '6px' }}
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className={monthFilter === 'All' ? 'btn btn-primary' : 'btn btn-secondary'}
                  onClick={() => {
                    if (monthFilter === 'All') {
                      setMonthFilter(getCurrentMonthDisplay())
                    } else {
                      setMonthFilter('All')
                    }
                    setVoucherPage(1)
                  }}
                  title={monthFilter === 'All' ? 'Filter by Current Month' : 'Show All Months'}
                  style={{
                    height: '38px',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  All
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button 
                className="btn glass-panel" 
                style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} 
                onClick={exportSalariesToExcel} 
                title="Export Vouchers Excel"
              >
                <FileSpreadsheet size={16} /> <span>Excel</span>
              </button>
              <button className="btn btn-secondary" onClick={fetchSalaries} title="Refresh Vouchers">
                <RefreshCw size={16} className={loading ? 'spin' : ''} />
              </button>
              
              <button
                className="btn btn-primary"
                onClick={handleOpenSalaryCreateModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '8px'
                }}
              >
                <Plus size={18} /> <span>Record Salary Payment</span>
              </button>
            </div>
          </div>

          {/* 3 Clean KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Banknote size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>TOTAL SALARIES PAID</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0f172a' }}>{formatCurrency(totalDisbursed)}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Cumulative disbursements</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>TOTAL OVERTIME DISBURSED</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#f59e0b' }}>{formatCurrency(totalOvertimeAmount)}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Overtime compensation</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>CURRENT MONTH ({new Date().toLocaleString('en-US', { month: 'long' }).toUpperCase()})</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#3b82f6' }}>{formatCurrency(currentMonthTotal)}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Current cycle payout</div>
              </div>
            </div>
          </div>

          {/* Vouchers Table */}
          <div className="glass-panel" style={{ borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '800', fontSize: '0.775rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Staff Name</th>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Salary Month</th>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Payment Date</th>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Base Salary</th>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Overtime</th>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Total Owed</th>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Amount Paid</th>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Pending</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSalaries.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Banknote size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                        <div style={{ fontWeight: '700' }}>No salary payment vouchers recorded.</div>
                      </td>
                    </tr>
                  ) : (
                    paginatedSalaries.map((item, idx) => {
                      const base = parseFloat(item.base_salary) > 0 ? parseFloat(item.base_salary) : parseFloat(item.amount)
                      const otHrs = parseFloat(item.overtime_hours || 0)
                      const otAmt = parseFloat(item.overtime_amount || 0)
                      const totOwed = parseFloat(item.total_salary) > 0 ? parseFloat(item.total_salary) : (base + otAmt)
                      const paid = parseFloat(item.amount)
                      const pending = totOwed - paid

                      return (
                        <tr 
                          key={item.id || idx} 
                          style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', transition: 'background 0.15s ease' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                          onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f8fafc'}
                        >
                          <td style={{ padding: '0.85rem 1.25rem', fontWeight: '800', color: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.8rem' }}>
                                {item.staff_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div>{item.staff_name}</div>
                                {item.description && <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: '500' }}>{item.description}</div>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1.25rem', fontWeight: '600', color: '#1366d9' }}>{item.paid_month}</td>
                          <td style={{ padding: '0.85rem 1.25rem', color: '#475569' }}>{item.payment_date}</td>
                          <td style={{ padding: '0.85rem 1.25rem', fontWeight: '700', color: '#0f172a' }}>{formatCurrency(base)}</td>
                          <td style={{ padding: '0.85rem 1.25rem', color: '#d97706', fontWeight: '700' }}>
                            {otAmt > 0 ? `+${formatCurrency(otAmt)} (${otHrs}h)` : '—'}
                          </td>
                          <td style={{ padding: '0.85rem 1.25rem', fontWeight: '800', color: '#0f172a' }}>{formatCurrency(totOwed)}</td>
                          <td style={{ padding: '0.85rem 1.25rem', fontWeight: '900', color: '#16a34a' }}>{formatCurrency(paid)}</td>
                          <td style={{ padding: '0.85rem 1.25rem' }}>
                            {pending > 0 ? (
                              <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '0.775rem' }}>
                                {formatCurrency(pending)} Owed
                              </span>
                            ) : (
                              <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '0.775rem' }}>
                                Settled
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={() => handlePrintVoucher(item)}
                                className="btn btn-secondary"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                title="Print Voucher"
                              >
                                <Printer size={13} /> Voucher
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenSalaryEditModal(item)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '3px' }}
                                title="Edit"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSalary(item.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '3px' }}
                                title="Delete"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination total={filteredSalaries.length} page={voucherPage} setPage={setVoucherPage} />
          </div>
        </div>
      )}

        {/* =========================================================================
            PAGE 3: EMPLOYEE RUNNING LEDGERS
            ========================================================================= */}
        {activePage === 'ledgers' && (
          <div className="ledgers-page-content salary-tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Action Header & Filter Bar */}
          <div className="glass-panel no-print salary-toolbar-panel" style={{ padding: '1rem 1.25rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', border: '1px solid var(--border-color)' }}>
            <div style={{ flex: '1 1 250px', minWidth: 0 }}>
              <SearchBar
                value={searchQuery}
                onChange={(val) => { setSearchQuery(val); setLedgerPage(1); }}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={fetchLedgers} title="Refresh Ledgers">
                <RefreshCw size={16} className={loadingLedger ? 'spin' : ''} />
              </button>
            </div>
          </div>

          {/* 2 Clean KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: totalPendingBalance > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', color: totalPendingBalance > 0 ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>TOTAL OUTSTANDING RUNNING BALANCE</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '900', color: totalPendingBalance > 0 ? '#ef4444' : '#10b981' }}>
                  {formatCurrency(totalPendingBalance)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Cumulative pending carry-forward</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>EMPLOYEES ON LEDGER</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0f172a' }}>{filteredLedgers.length} Employees</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Active ongoing accounts</div>
              </div>
            </div>
          </div>

          {/* Ledgers Table */}
          <div className="glass-panel" style={{ borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#ffffff', fontWeight: '800', fontSize: '0.775rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Staff Member</th>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Base Salary</th>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Overtime Work</th>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Total Owed</th>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Total Paid</th>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Pending Balance</th>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Vouchers</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Detailed Statement</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLedgers.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <BookOpen size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                        <div style={{ fontWeight: '700' }}>No ongoing ledger records found.</div>
                      </td>
                    </tr>
                  ) : (
                    paginatedLedgers.map((emp, idx) => (
                      <tr 
                        key={idx}
                        style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', transition: 'background 0.15s ease' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f8fafc'}
                      >
                        <td style={{ padding: '0.85rem 1.25rem', fontWeight: '800', color: '#0f172a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e2e8f0', color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.85rem' }}>
                              {emp.staff_name.charAt(0).toUpperCase()}
                            </div>
                            <span>{emp.staff_name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', color: '#475569' }}>{formatCurrency(emp.total_base_salary)}</td>
                        <td style={{ padding: '0.85rem 1.25rem', color: '#d97706', fontWeight: '700' }}>
                          {formatCurrency(emp.total_overtime_amount)} ({emp.total_overtime_hours}h)
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', fontWeight: '800', color: '#0f172a' }}>{formatCurrency(emp.total_salary_owed)}</td>
                        <td style={{ padding: '0.85rem 1.25rem', fontWeight: '800', color: '#16a34a' }}>{formatCurrency(emp.total_amount_paid)}</td>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          {emp.current_pending_balance > 0 ? (
                            <span style={{ background: '#fee2e2', color: '#dc2626', padding: '3px 9px', borderRadius: '6px', fontWeight: '800', fontSize: '0.825rem' }}>
                              {formatCurrency(emp.current_pending_balance)} Owed
                            </span>
                          ) : (
                            <span style={{ background: '#dcfce7', color: '#16a34a', padding: '3px 9px', borderRadius: '6px', fontWeight: '800', fontSize: '0.825rem' }}>
                              Settled
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', color: '#64748b', fontSize: '0.85rem' }}>
                          {emp.entries_count} records
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => setStatementEmployee(emp)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <BookOpen size={14} /> View Statement
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination total={filteredLedgers.length} page={ledgerPage} setPage={setLedgerPage} />
          </div>
        </div>
        )}
      </div>

      {/* =========================================================================
          MODAL 1: ADD / EDIT STAFF TIMESHEET
          ========================================================================= */}
      {isTimesheetModalOpen && createPortal(
        <div className="modal-overlay no-print" onClick={() => !savingTimesheet && setIsTimesheetModalOpen(false)}>
          <div 
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '640px', 
              width: '94%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '16px',
              padding: '1.75rem',
              background: 'var(--card-bg, #ffffff)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(4, 120, 87, 0.12)', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontWeight: '800', fontSize: '1.2rem', color: 'var(--text-main)' }}>
                    {editingTimesheetId ? 'Edit Timesheet Entry' : 'Add Employee / Staff Timesheet'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Record daily work attendance, timings, credits, and overtime details
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => !savingTimesheet && setIsTimesheetModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitTimesheet}>
              {modalError && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #f87171',
                  color: '#991b1b',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{modalError}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                
                {/* Staff Selection from DB users */}
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>
                    Staff Member *
                  </label>
                  <select 
                    className="input-field" 
                    value={timesheetFormData.user_id} 
                    onChange={handleStaffSelectChange}
                    required
                    style={{ width: '100%', height: '42px', fontWeight: '600' }}
                  >
                    <option value="">-- Select Staff Member --</option>
                    {staffUsers.map(u => (
                      <option key={u.id} value={String(u.id)}>
                        {formatStaffDisplayName(u)} {u.role ? `(${u.role})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>
                    Date *
                  </label>
                  <input 
                    type="date"
                    className="input-field"
                    value={timesheetFormData.date}
                    onChange={(e) => setTimesheetFormData({ ...timesheetFormData, date: e.target.value })}
                    required
                    style={{ width: '100%', height: '40px' }}
                  />
                </div>

                {/* Off Day Checkbox */}
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '1.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.825rem', color: '#dc2626' }}>
                    <input 
                      type="checkbox"
                      checked={timesheetFormData.is_off_day}
                      onChange={(e) => setTimesheetFormData({ 
                        ...timesheetFormData, 
                        is_off_day: e.target.checked,
                        ...(e.target.checked ? { in_time: '', lunch_time: '', out_time: '' } : {})
                      })}
                      style={{ width: '18px', height: '18px', accentColor: '#dc2626' }}
                    />
                    <span>Mark as Off Day / Friday (Red badge)</span>
                  </label>
                  {timesheetFormData.is_off_day && (
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                      Timings cleared automatically for holiday
                    </span>
                  )}
                </div>

                {/* IN time (12-Hour AM/PM Selector) */}
                <TimePicker12Hour
                  label="IN Time"
                  value={timesheetFormData.in_time}
                  onChange={(val) => setTimesheetFormData({ ...timesheetFormData, in_time: val })}
                  disabled={timesheetFormData.is_off_day}
                  defaultHour="09"
                  defaultMinute="00"
                  defaultAmpm="AM"
                />

                {/* Lunch time (12-Hour AM/PM Selector) */}
                <TimePicker12Hour
                  label="Lunch Time"
                  value={timesheetFormData.lunch_time}
                  onChange={(val) => setTimesheetFormData({ ...timesheetFormData, lunch_time: val })}
                  disabled={timesheetFormData.is_off_day}
                  defaultHour="01"
                  defaultMinute="00"
                  defaultAmpm="PM"
                />

                {/* OUT time (12-Hour AM/PM Selector) */}
                <TimePicker12Hour
                  label="OUT Time"
                  value={timesheetFormData.out_time}
                  onChange={(val) => setTimesheetFormData({ ...timesheetFormData, out_time: val })}
                  disabled={timesheetFormData.is_off_day}
                  defaultHour="10"
                  defaultMinute="00"
                  defaultAmpm="PM"
                />

                {/* DEBIT (SAR) */}
                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>
                    DEBIT (SAR)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field"
                    value={timesheetFormData.debit}
                    onChange={(e) => setTimesheetFormData({ ...timesheetFormData, debit: e.target.value })}
                    style={{ width: '100%', height: '40px' }}
                  />
                </div>

                {/* CREDIT (SAR) */}
                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>
                    CREDIT (SAR)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field"
                    value={timesheetFormData.credit}
                    onChange={(e) => setTimesheetFormData({ ...timesheetFormData, credit: e.target.value })}
                    style={{ width: '100%', height: '40px' }}
                  />
                </div>

                {/* Overtime */}
                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>
                    Overtime
                  </label>
                  <input 
                    type="text"
                    className="input-field"
                    value={timesheetFormData.overtime}
                    onChange={(e) => setTimesheetFormData({ ...timesheetFormData, overtime: e.target.value })}
                    style={{ width: '100%', height: '40px' }}
                  />
                </div>

                {/* OT DETAILS */}
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>
                    OT DETAILS
                  </label>
                  <input 
                    type="text"
                    className="input-field"
                    value={timesheetFormData.ot_details}
                    onChange={(e) => setTimesheetFormData({ ...timesheetFormData, ot_details: e.target.value })}
                    style={{ width: '100%', height: '40px' }}
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsTimesheetModalOpen(false)}
                  disabled={savingTimesheet}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn"
                  disabled={savingTimesheet}
                  style={{ background: '#047857', color: '#ffffff', fontWeight: '700', padding: '0.65rem 1.75rem' }}
                >
                  {savingTimesheet ? 'Saving...' : (editingTimesheetId ? 'Update Entry' : 'Save Timesheet Entry')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL 1B: BULK GENERATE 30-DAY MONTHLY TIMESHEET
          ========================================================================= */}
      {isGenerateMonthModalOpen && createPortal(
        <div className="modal-overlay no-print" onClick={() => !generatingMonth && setIsGenerateMonthModalOpen(false)}>
          <div 
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '560px', 
              width: '92%', 
              maxHeight: '90vh', 
              display: 'flex', 
              flexDirection: 'column', 
              borderRadius: '16px',
              padding: '1.75rem',
              background: 'var(--card-bg, #ffffff)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarDays size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontWeight: '800', fontSize: '1.2rem', color: 'var(--text-main)' }}>
                    Generate Monthly Timesheet (30 Days)
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Create daily attendance entries for the full month in one go
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => !generatingMonth && setIsGenerateMonthModalOpen(false)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGenerateMonthSubmit}>
              {modalError && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #f87171',
                  color: '#991b1b',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{modalError}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {/* Staff Member */}
                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>
                    Staff Member *
                  </label>
                  <select 
                    className="input-field" 
                    value={generateMonthFormData.user_id} 
                    onChange={handleGenerateMonthStaffChange}
                    required
                    style={{ width: '100%', height: '42px', fontWeight: '600' }}
                  >
                    <option value="">-- Select Staff Member --</option>
                    {staffUsers.map(u => (
                      <option key={u.id} value={String(u.id)}>
                        {formatStaffDisplayName(u)} {u.role ? `(${u.role})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Month Selection */}
                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>
                    Select Month & Year *
                  </label>
                  <input
                    type="month"
                    className="input-field"
                    value={displayToMonthValue(generateMonthFormData.month) || getCurrentMonthValue()}
                    onChange={(e) => {
                      if (e.target.value) {
                        setGenerateMonthFormData({
                          ...generateMonthFormData,
                          month: monthValueToDisplay(e.target.value)
                        })
                      }
                    }}
                    required
                    style={{ width: '100%', height: '42px', fontWeight: '700', color: '#0f172a' }}
                  />
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                    Target Month: <strong>{monthValueToDisplay(generateMonthFormData.month) || 'Current Month'}</strong>
                  </div>
                </div>

                {/* Default Shift Timings Box */}
                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.825rem', fontWeight: '800', color: '#334155', marginBottom: '0.6rem' }}>
                    Standard Daily Shift Timings
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '3px' }}>IN TIME</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={generateMonthFormData.in_time} 
                        onChange={(e) => setGenerateMonthFormData({ ...generateMonthFormData, in_time: e.target.value })}
                        style={{ width: '100%', height: '36px', fontSize: '0.8rem', textAlign: 'center', fontWeight: '600' }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '3px' }}>LUNCH</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={generateMonthFormData.lunch_time} 
                        onChange={(e) => setGenerateMonthFormData({ ...generateMonthFormData, lunch_time: e.target.value })}
                        style={{ width: '100%', height: '36px', fontSize: '0.8rem', textAlign: 'center', fontWeight: '600' }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '3px' }}>OUT TIME</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={generateMonthFormData.out_time} 
                        onChange={(e) => setGenerateMonthFormData({ ...generateMonthFormData, out_time: e.target.value })}
                        style={{ width: '100%', height: '36px', fontSize: '0.8rem', textAlign: 'center', fontWeight: '600' }} 
                      />
                    </div>
                  </div>
                </div>

                {/* Weekly Off Days */}
                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>
                    Weekly Off-Day Setting
                  </label>
                  <select
                    className="input-field"
                    value={generateMonthFormData.off_days}
                    onChange={(e) => setGenerateMonthFormData({ ...generateMonthFormData, off_days: e.target.value })}
                    style={{ width: '100%', height: '40px' }}
                  >
                    <option value="friday">Every Friday (Standard Off Day)</option>
                    <option value="friday_saturday">Friday & Saturday (2-Day Weekend)</option>
                    <option value="sunday">Every Sunday</option>
                    <option value="none">No Off Days (Full Working Month)</option>
                  </select>
                </div>

                {/* Overwrite option */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0' }}>
                  <input
                    type="checkbox"
                    id="overwrite_check"
                    checked={generateMonthFormData.overwrite_existing}
                    onChange={(e) => setGenerateMonthFormData({ ...generateMonthFormData, overwrite_existing: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="overwrite_check" style={{ fontSize: '0.825rem', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                    Overwrite existing daily entries for this month if any already exist
                  </label>
                </div>
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsGenerateMonthModalOpen(false)}
                  disabled={generatingMonth}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn"
                  disabled={generatingMonth}
                  style={{ background: '#0284c7', color: '#ffffff', fontWeight: '700', padding: '0.65rem 1.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <CalendarDays size={18} />
                  <span>{generatingMonth ? 'Generating 30 Days...' : 'Generate 30 Days Timesheet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL 2: RECORD / EDIT SALARY PAYMENT
          ========================================================================= */}
      {isSalaryModalOpen && createPortal(
        <div className="modal-overlay no-print" onClick={() => !saving && setIsSalaryModalOpen(false)}>
          <div 
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '580px', 
              width: '92%', 
              maxHeight: '90vh', 
              display: 'flex', 
              flexDirection: 'column', 
              borderRadius: '16px',
              padding: '1.75rem',
              background: 'var(--card-bg, #ffffff)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: '800', fontSize: '1.2rem', color: 'var(--text-main)' }}>
                  {editingSalaryId ? 'Edit Salary Payment' : 'Record Salary Payment'}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Issue salary disbursements and generate payroll vouchers
                </p>
              </div>
              <button type="button" onClick={() => !saving && setIsSalaryModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitSalary}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>Staff Member Name *</label>
                  <select
                    className="input-field"
                    value={salaryFormData.user_id}
                    onChange={handleSalaryStaffChange}
                    required
                    style={{ width: '100%', height: '42px', fontWeight: '600' }}
                  >
                    <option value="">-- Select Staff Member --</option>
                    {staffUsers.map(u => (
                      <option key={u.id} value={String(u.id)}>
                        {formatStaffDisplayName(u)} {u.role ? `(${u.role})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>Paid For Month *</label>
                  <input
                    type="month"
                    className="input-field"
                    value={displayToMonthValue(salaryFormData.paid_month) || getCurrentMonthValue()}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSalaryFormData({
                          ...salaryFormData,
                          paid_month: monthValueToDisplay(e.target.value)
                        })
                      }
                    }}
                    required
                    style={{ width: '100%', height: '42px', fontWeight: '700', color: '#0f172a' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div className="form-group">
                    <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>Base Salary (SAR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input-field"
                      value={salaryFormData.base_salary}
                      onChange={(e) => setSalaryFormData({ ...salaryFormData, base_salary: e.target.value })}
                      style={{ width: '100%', height: '40px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>Overtime Amount (SAR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input-field"
                      value={salaryFormData.overtime_amount}
                      onChange={(e) => setSalaryFormData({ ...salaryFormData, overtime_amount: e.target.value })}
                      style={{ width: '100%', height: '40px' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>Amount Paid (SAR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field"
                    value={salaryFormData.amount}
                    onChange={(e) => setSalaryFormData({ ...salaryFormData, amount: e.target.value })}
                    required
                    style={{ width: '100%', height: '40px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '5px', display: 'block' }}>Description & Notes</label>
                  <textarea
                    rows={2}
                    className="input-field"
                    value={salaryFormData.description}
                    onChange={(e) => setSalaryFormData({ ...salaryFormData, description: e.target.value })}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsSalaryModalOpen(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingSalaryId ? 'Update Payment' : 'Save Payment')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL 3: PRINTABLE PAYROLL VOUCHER
          ========================================================================= */}
      {voucherToPrint && createPortal(
        <div className="modal-overlay print-modal-overlay" onClick={() => setVoucherToPrint(null)}>
          <div className="modal-container voucher-modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px', width: '95%', maxHeight: '92vh', overflowY: 'auto', background: '#ffffff', color: '#000000', borderRadius: '12px', padding: '2rem' }}>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setVoucherToPrint(null)}>Close</button>
              <button 
                className="btn btn-primary" 
                onClick={() => handleExportVoucherPDF(voucherToPrint)} 
                disabled={voucherPdfLoading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Printer size={16} /> {voucherPdfLoading ? 'Generating PDF...' : 'Print / Export Voucher'}
              </button>
            </div>

            <div className="printable-voucher-document">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontWeight: '900', fontSize: '1.4rem' }}>{settings?.company_name || 'Arab Season'}</h2>
                  <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '0.85rem' }}>{settings?.address || 'Saudi Arabia, Alsalihia Dist'}</p>
                  <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '0.8rem' }}>{settings?.phone || '+965 57 5287 403'} • {settings?.email || 'ad@arabseason.net'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ background: '#0f172a', color: '#ffffff', padding: '0.35rem 0.8rem', borderRadius: '4px', fontWeight: '800', fontSize: '0.85rem' }}>
                    PAYROLL VOUCHER
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '0.8rem', color: '#64748b' }}>Date: {voucherToPrint.payment_date}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>STAFF MEMBER</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: '800' }}>{voucherToPrint.staff_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>SALARY PERIOD</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#1366d9' }}>{voucherToPrint.paid_month}</div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.65rem 0.75rem' }}>Base Salary</td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>
                      {formatCurrency(voucherToPrint.base_salary || voucherToPrint.amount)}
                    </td>
                  </tr>
                  {parseFloat(voucherToPrint.overtime_amount) > 0 && (
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.65rem 0.75rem' }}>Overtime Work ({voucherToPrint.overtime_hours} hrs)</td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#d97706' }}>
                        +{formatCurrency(voucherToPrint.overtime_amount)}
                      </td>
                    </tr>
                  )}
                  <tr style={{ borderBottom: '2px solid #0f172a', background: '#f8fafc', fontWeight: '800' }}>
                    <td style={{ padding: '0.75rem' }}>Total Salary Owed</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {formatCurrency(voucherToPrint.total_salary || voucherToPrint.amount)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#16a34a', fontWeight: '800' }}>
                    <td style={{ padding: '0.75rem' }}>Amount Paid (Disbursed)</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {formatCurrency(voucherToPrint.amount)}
                    </td>
                  </tr>
                  <tr style={{ background: '#fef2f2', color: '#dc2626', fontWeight: '800' }}>
                    <td style={{ padding: '0.75rem' }}>Period Pending Balance</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {formatCurrency(voucherToPrint.running_balance || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Monthly Timesheet & Attendance Section */}
              <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', borderBottom: '1.5px solid #0f172a', paddingBottom: '0.4rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0f172a' }}>
                    ATTENDANCE & TIMESHEET LOG • {voucherToPrint.paid_month || 'MONTH'}
                  </div>
                  {voucherTimesheets.length > 0 && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {voucherTimesheets.length} Days Recorded
                    </div>
                  )}
                </div>

                {voucherTimesheets.length > 0 ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>Logged Days</div>
                        <div style={{ fontSize: '1rem', fontWeight: '800', color: '#0f172a' }}>{voucherTimesheets.length}</div>
                      </div>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: '700' }}>Work Days</div>
                        <div style={{ fontSize: '1rem', fontWeight: '800', color: '#16a34a' }}>
                          {voucherTimesheets.filter(t => !t.is_off_day).length}
                        </div>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>Off / Rest Days</div>
                        <div style={{ fontSize: '1rem', fontWeight: '800', color: '#64748b' }}>
                          {voucherTimesheets.filter(t => t.is_off_day).length}
                        </div>
                      </div>
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: '700' }}>Overtime Hours</div>
                        <div style={{ fontSize: '1rem', fontWeight: '800', color: '#2563eb' }}>
                          {voucherTimesheets.reduce((acc, t) => acc + (parseFloat(t.overtime_hours) || 0), 0).toFixed(1)} Hrs
                        </div>
                      </div>
                    </div>

                    <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left' }}>Date</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left' }}>In Time</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left' }}>Out Time</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left' }}>Status</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>OT (Hrs)</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left' }}>Work Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {voucherTimesheets.map((t, idx) => {
                            const isOff = t.is_off_day
                            const ot = parseFloat(t.overtime_hours) || 0
                            return (
                              <tr key={t.id || idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                <td style={{ padding: '0.4rem 0.6rem', fontWeight: '700' }}>{t.date}</td>
                                <td style={{ padding: '0.4rem 0.6rem' }}>{t.in_time || '--'}</td>
                                <td style={{ padding: '0.4rem 0.6rem' }}>{t.out_time || '--'}</td>
                                <td style={{ padding: '0.4rem 0.6rem' }}>
                                  {isOff ? (
                                    <span style={{ color: '#64748b', fontStyle: 'italic' }}>Off Day</span>
                                  ) : (
                                    <span>{t.overtime_text || 'Standard Shift'}</span>
                                  )}
                                </td>
                                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: ot > 0 ? '700' : '400', color: ot > 0 ? '#16a34a' : '#64748b' }}>
                                  {ot > 0 ? `${ot.toFixed(1)}` : '0.0'}
                                </td>
                                <td style={{ padding: '0.4rem 0.6rem', color: '#475569', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.ot_details || ''}>
                                  {t.ot_details || '--'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    No timesheet records logged for this staff member during this pay period.
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #cbd5e1', textAlign: 'center' }}>
                <div>
                  <div style={{ borderBottom: '1px solid #94a3b8', minHeight: '30px', marginBottom: '0.4rem' }}></div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569' }}>AUTHORIZED SIGNATURE</div>
                </div>
                <div>
                  <div style={{ borderBottom: '1px solid #94a3b8', minHeight: '30px', marginBottom: '0.4rem' }}></div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569' }}>EMPLOYEE SIGNATURE</div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL 4: EMPLOYEE LEDGER DETAILED STATEMENT
          ========================================================================= */}
      {statementEmployee && createPortal(
        <div className="modal-overlay print-modal-overlay" onClick={() => setStatementEmployee(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px', width: '95%', maxHeight: '90vh', background: '#ffffff', color: '#000000', borderRadius: '12px', padding: '2rem', overflowY: 'auto' }}>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setStatementEmployee(null)}>Close</button>
              <button 
                className="btn btn-primary" 
                onClick={() => handleExportLedgerPDF(statementEmployee)} 
                disabled={statementPdfLoading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Printer size={16} /> {statementPdfLoading ? 'Generating PDF...' : 'Print / Export Statement'}
              </button>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontWeight: '900', fontSize: '1.4rem' }}>{settings?.company_name || 'Arab Season'}</h2>
                  <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '0.85rem' }}>Employee Payroll & Running Account Statement</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: '900' }}>{statementEmployee.staff_name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: '800' }}>
                    Current Pending: {formatCurrency(statementEmployee.current_pending_balance)}
                  </div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                    <th style={{ padding: '0.65rem', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '0.65rem', textAlign: 'left' }}>Month</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>Base</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>Overtime</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>Total Owed</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>Amount Paid</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statementEmployee.entries?.map((entry, eIdx) => (
                    <tr key={eIdx} style={{ borderBottom: '1px solid #e2e8f0', background: eIdx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '0.65rem' }}>{entry.payment_date}</td>
                      <td style={{ padding: '0.65rem', fontWeight: '700' }}>{entry.paid_month}</td>
                      <td style={{ padding: '0.65rem', textAlign: 'right' }}>{formatCurrency(entry.base_salary)}</td>
                      <td style={{ padding: '0.65rem', textAlign: 'right', color: '#d97706' }}>{formatCurrency(entry.overtime_amount)}</td>
                      <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(entry.total_salary)}</td>
                      <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: '800', color: '#16a34a' }}>{formatCurrency(entry.amount_paid)}</td>
                      <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: '900', color: entry.running_balance > 0 ? '#dc2626' : '#16a34a' }}>
                        {formatCurrency(entry.running_balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #cbd5e1', textAlign: 'center' }}>
                <div>
                  <div style={{ borderBottom: '1px solid #94a3b8', minHeight: '30px', marginBottom: '0.4rem' }}></div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569' }}>FINANCE / ACCOUNTANT</div>
                </div>
                <div>
                  <div style={{ borderBottom: '1px solid #94a3b8', minHeight: '30px', marginBottom: '0.4rem' }}></div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569' }}>EMPLOYEE ACKNOWLEDGEMENT</div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}

export default SalaryReports
