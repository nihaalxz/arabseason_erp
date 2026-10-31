import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle } from '../icons'

// Global active modal counter to handle nested or sequential modals without losing scroll position
let activeModalCount = 0
let savedScrollY = 0

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer = null,
  maxWidth = '660px', 
  style = {},
  isDirty = undefined,
  closeOnBackdrop = false 
}) => {
  const overlayRef = useRef(null)
  const containerRef = useRef(null)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const initialSnapshotRef = useRef(null)

  // Capture form snapshot across inputs, selects, and textareas
  const captureFormSnapshot = useCallback((container) => {
    if (!container) return {}
    const snapshot = {}
    const elements = container.querySelectorAll('input, select, textarea')
    elements.forEach((el, index) => {
      if (el.closest('.discard-confirm-dialog')) return
      if (['submit', 'button', 'hidden', 'reset'].includes(el.type)) return
      
      const key = el.name || el.id || `field_${index}`
      if (el.type === 'checkbox' || el.type === 'radio') {
        snapshot[key] = el.checked
      } else {
        snapshot[key] = (el.value || '').trim()
      }
    })
    return snapshot
  }, [])

  // Check whether user has entered or modified anything in the form
  const checkIsDirty = useCallback(() => {
    if (isDirty !== undefined) {
      return typeof isDirty === 'function' ? Boolean(isDirty()) : Boolean(isDirty)
    }

    if (!containerRef.current) return false

    const elements = containerRef.current.querySelectorAll('input, select, textarea')
    let hasFilledField = false
    const initial = initialSnapshotRef.current || {}

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]
      if (el.closest('.discard-confirm-dialog')) continue
      if (['submit', 'button', 'hidden', 'reset'].includes(el.type)) continue
      if (el.disabled || el.readOnly) continue

      const key = el.name || el.id || `field_${i}`
      const initialVal = initial[key]

      if (el.type === 'checkbox' || el.type === 'radio') {
        if (initialVal !== undefined && el.checked !== initialVal) {
          return true
        }
      } else {
        const currentVal = (el.value || '').trim()
        if (initialVal !== undefined) {
          if (currentVal !== initialVal) {
            return true
          }
        } else if (currentVal.length > 0) {
          hasFilledField = true
        }
      }
    }

    return hasFilledField
  }, [isDirty])

  // Handle close request with dirty protection
  const handleRequestClose = useCallback(() => {
    if (checkIsDirty()) {
      setShowDiscardConfirm(true)
    } else {
      onClose?.()
    }
  }, [checkIsDirty, onClose])

  // Capture initial snapshot shortly after opening
  useEffect(() => {
    if (!isOpen) {
      setShowDiscardConfirm(false)
      initialSnapshotRef.current = null
      return
    }

    const timer = setTimeout(() => {
      if (containerRef.current) {
        initialSnapshotRef.current = captureFormSnapshot(containerRef.current)
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [isOpen, captureFormSnapshot])

  // Intercept clicks on Cancel buttons inside modal using event capture phase
  useEffect(() => {
    if (!isOpen) return

    const containerEl = containerRef.current
    if (!containerEl) return

    const handleContainerClickCapture = (e) => {
      if (showDiscardConfirm) return

      const btn = e.target.closest('button')
      if (!btn) return
      if (btn.closest('.discard-confirm-dialog')) return

      const text = (btn.textContent || '').trim().toLowerCase()
      const isCancelBtn = text === 'cancel' || btn.getAttribute('data-action') === 'cancel' || btn.classList.contains('btn-cancel')

      if (isCancelBtn) {
        if (checkIsDirty()) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          setShowDiscardConfirm(true)
        }
      }
    }

    containerEl.addEventListener('click', handleContainerClickCapture, true)
    return () => {
      containerEl.removeEventListener('click', handleContainerClickCapture, true)
    }
  }, [isOpen, showDiscardConfirm, checkIsDirty])

  // Escape key handling
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false)
        } else {
          handleRequestClose()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, showDiscardConfirm, handleRequestClose])

  // Scroll lock and touchmove handling
  useEffect(() => {
    if (!isOpen) return

    if (activeModalCount === 0) {
      savedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
      document.body.classList.add('modal-open')
    }
    activeModalCount++

    const overlayEl = overlayRef.current
    const handleTouchMove = (e) => {
      const scrollableBody = e.target.closest('.modal-body, .form-container, .modal-content, [data-modal-scroll], .cb-modal-scroll, .modal-body-scroll') ||
        (e.target && e.target.scrollHeight > e.target.clientHeight ? e.target : null)
      if (!scrollableBody) {
        if (e.cancelable && e.target === overlayRef.current) {
          e.preventDefault()
        }
      }
    }


    if (overlayEl) {
      overlayEl.addEventListener('touchmove', handleTouchMove, { passive: false })
    }

    return () => {
      if (overlayEl) {
        overlayEl.removeEventListener('touchmove', handleTouchMove)
      }
      activeModalCount = Math.max(0, activeModalCount - 1)
      if (activeModalCount === 0) {
        document.documentElement.style.overflow = ''
        document.body.style.overflow = ''
        document.body.classList.remove('modal-open')
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  // Outside click handler: safely ignore clicks outside the modal (no close, no jiggle/blink)
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      if (closeOnBackdrop) {
        handleRequestClose()
      } else {
        e.preventDefault()
        e.stopPropagation()
      }
    }
  }

  const modalContent = (
    <div 
      ref={overlayRef}
      className="modal-overlay" 
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(0.5rem, 3vw, 1.25rem)',
        boxSizing: 'border-box',
        overflow: 'hidden',
        touchAction: 'none',
        overscrollBehavior: 'contain'
      }}
    >
      <div
        ref={containerRef}
        className="modal-container glass-panel"
        style={{
          position: 'relative',
          maxHeight: 'min(94vh, 850px)',
          maxWidth: maxWidth,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          margin: 'auto',
          boxSizing: 'border-box',
          overscrollBehavior: 'contain',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          ...style
        }}
      >
        <div className="modal-header" style={{ flexShrink: 0, touchAction: 'none' }}>
          <h3>{title}</h3>
          <button 
            className="btn-icon" 
            onClick={handleRequestClose} 
            type="button" 
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>
        <div 
          className="modal-body" 
          style={{ 
            overflowY: 'auto', 
            overflowX: 'hidden', 
            flex: 1, 
            maxHeight: footer ? 'calc(94vh - 135px)' : 'calc(94vh - 65px)', 
            width: '100%', 
            maxWidth: '100%', 
            boxSizing: 'border-box',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {children}
        </div>
        {footer && (
          <div 
            className="modal-footer"
            style={{
              flexShrink: 0,
              borderTop: '1px solid var(--border, #E4E4E4)',
              padding: '16px 24px',
              background: 'var(--card-bg, #FFFFFF)',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '12px',
              zIndex: 50,
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            {footer}
          </div>
        )}

        {/* Discard Confirmation Dialog */}
        {showDiscardConfirm && (
          <div 
            className="discard-confirm-overlay"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.72)',
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100000,
              padding: '1.25rem',
              borderRadius: 'inherit'
            }}
          >
            <div 
              className="discard-confirm-dialog"
              style={{
                borderRadius: '16px',
                padding: '1.5rem',
                maxWidth: '380px',
                width: '100%',
                boxShadow: '0 20px 45px rgba(0, 0, 0, 0.55)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.65rem'
              }}
            >
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.2rem'
              }}>
                <AlertTriangle size={24} strokeWidth={2.4} />
              </div>
              <h3 style={{
                margin: 0,
                fontSize: '1.1rem',
                fontWeight: '800',
                letterSpacing: '-0.01em'
              }}>
                Discard what you've entered?
              </h3>
              <p style={{
                margin: '0 0 0.65rem',
                fontSize: '0.84rem',
                opacity: 0.85,
                lineHeight: 1.45
              }}>
                You have unsaved changes. If you discard now, everything you entered will be lost.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="btn"
                  style={{
                    flex: 1,
                    height: '40px',
                    fontSize: '0.86rem',
                    fontWeight: '600',
                    borderRadius: '10px',
                    cursor: 'pointer'
                  }}
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardConfirm(false)
                    onClose?.()
                  }}
                  className="btn btn-danger"
                  style={{
                    flex: 1,
                    height: '40px',
                    fontSize: '0.86rem',
                    fontWeight: '700',
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer'
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}

export default Modal
