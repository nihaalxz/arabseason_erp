import React, { useState, useEffect, useRef } from 'react'
import { Search, X } from '../icons'

const SearchBar = ({
  value = '',
  onChange,
  debounceTime = 300,
  style = {},
  className = '',
  autoFocus = false,
}) => {
  const [internalValue, setInternalValue] = useState(value)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    setInternalValue(value)
  }, [value])

  useEffect(() => {
    const handler = setTimeout(() => {
      if (onChange && internalValue !== value) {
        onChange(internalValue)
      }
    }, debounceTime)
    return () => clearTimeout(handler)
  }, [internalValue, debounceTime])

  const handleClear = () => {
    setInternalValue('')
    if (onChange) onChange('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') handleClear()
  }

  return (
    <div
      className={`search-bar-container ${className}`}
      onClick={() => inputRef.current?.focus()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flex: 1,
        minWidth: '220px',
        maxWidth: '500px',
        height: '40px',
        borderRadius: '10px',
        border: focused
          ? '1.5px solid var(--accent, #6366f1)'
          : '1.5px solid var(--border-color, #e2e8f0)',
        background: 'var(--card-bg, #ffffff)',
        boxShadow: focused
          ? '0 0 0 3px rgba(99,102,241,0.12)'
          : '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'border 0.2s, box-shadow 0.2s',
        padding: '0 0.5rem 0 0.65rem',
        cursor: 'text',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Search Icon */}
      <Search
        size={16}
        style={{
          flexShrink: 0,
          color: focused ? 'var(--accent, #6366f1)' : 'var(--text-muted, #94a3b8)',
          transition: 'color 0.2s',
          pointerEvents: 'none',
        }}
      />

      {/* Bare input — NO .input-field class to avoid padding CSS battles */}
      <input
        ref={inputRef}
        type="text"
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: '0.875rem',
          color: 'var(--text-main, #1e293b)',
          padding: 0,
          margin: 0,
          height: '100%',
          fontFamily: 'inherit',
          minWidth: 0,
        }}
        
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
      />

      {/* Clear button */}
      {internalValue && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleClear() }}
          title="Clear search"
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #94a3b8)',
            cursor: 'pointer',
            padding: '3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'background 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-main, #1e293b)'
            e.currentTarget.style.background = 'rgba(0,0,0,0.07)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export default SearchBar
