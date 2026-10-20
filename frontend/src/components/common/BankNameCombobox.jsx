import { useState, useRef, useEffect } from 'react'
import { Search, X } from '../icons'
import { ChevronDown, Check } from 'lucide-react'

/**
 * BankNameCombobox
 * Searchable dropdown for a string list (e.g. popular bank names).
 * Allows free-text entry when no match is found.
 */
const BankNameCombobox = ({
  value = '',
  onChange,
  options = [],
  isDarkMode = false,
  required = false,
  autoFocus = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('mousedown', handler)
      document.addEventListener('touchstart', handler)
    }
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [isOpen])

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const filtered = value.trim()
    ? options.filter(o => o.toLowerCase().includes(value.toLowerCase()))
    : options

  const bg = isDarkMode ? '#1a1c20' : '#ffffff'
  const border = isDarkMode ? '1px solid #2e323a' : '1px solid #cbd5e1'
  const borderOpen = isDarkMode ? '1px solid #52525b' : '1px solid #94a3b8'
  const color = isDarkMode ? '#ffffff' : '#0f172a'
  const iconColor = isDarkMode ? '#52525b' : '#94a3b8'
  const menuBg = isDarkMode ? '#141517' : '#ffffff'
  const menuBorder = isDarkMode ? '1px solid #232528' : '1px solid #e2e8f0'
  const menuShadow = isDarkMode
    ? '0 12px 32px rgba(0,0,0,0.75)'
    : '0 8px 24px rgba(15,23,42,0.12)'
  const rowHover = isDarkMode ? '#1e2024' : '#f8fafc'
  const rowSel = isDarkMode ? '#27272a' : '#f1f5f9'
  const subColor = isDarkMode ? '#52525b' : '#94a3b8'

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          
          required={required}
          autoFocus={autoFocus}
          autoComplete="off"
          style={{
            width: '100%', boxSizing: 'border-box', height: '44px',
            background: bg, border: isOpen ? borderOpen : border,
            borderRadius: '10px', color, fontSize: '0.88rem', fontWeight: '500',
            padding: '0 36px 0 12px', outline: 'none', transition: 'border 0.15s ease',
          }}
        />
        {value ? (
          <button type="button" onClick={() => { onChange(''); inputRef.current?.focus() }} tabIndex={-1}
            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: iconColor }}>
            <X size={14} strokeWidth={2.5} />
          </button>
        ) : (
          <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: `translateY(-50%) ${isOpen ? 'rotate(180deg)' : ''}`, transition: 'transform 0.15s ease', color: iconColor, pointerEvents: 'none' }} />
        )}
      </div>

      {isOpen && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0, background: menuBg, border: menuBorder, borderRadius: '12px', boxShadow: menuShadow, maxHeight: '220px', overflowY: 'auto', zIndex: 1000, padding: '4px' }}>
          {filtered.map((opt) => {
            const isSel = opt === value
            return (
              <div key={opt}
                onMouseDown={(e) => { e.preventDefault(); onChange(opt); setIsOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', background: isSel ? rowSel : 'transparent', transition: 'background 0.1s ease' }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = rowHover }}
                onMouseLeave={e => { e.currentTarget.style.background = isSel ? rowSel : 'transparent' }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: isSel ? '700' : '500', color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
                {isSel && <Check size={14} strokeWidth={2.5} color={isDarkMode ? '#a1a1aa' : '#64748b'} style={{ flexShrink: 0, marginLeft: '8px' }} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default BankNameCombobox
