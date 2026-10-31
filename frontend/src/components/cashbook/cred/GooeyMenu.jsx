import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

const DROP_SPRING = { type: 'spring', stiffness: 240, damping: 17, mass: 1 };
const GROW_SPRING = { type: 'spring', stiffness: 210, damping: 22, mass: 1 };
const SNAP_SPRING = { type: 'spring', stiffness: 240, damping: 20, mass: 0.9 };
const ROW_SPRING = { type: 'spring', stiffness: 420, damping: 26 };
const CHEVRON_SPRING = { type: 'spring', stiffness: 300, damping: 20 };

/**
 * GooeyMenu
 * CRED-style Liquid Dropdown Menu ported from easyui metaball color-matrix filter
 * Pure vanilla CSS + Framer Motion. Zero layout shift.
 */
export const GooeyMenu = ({
  options = [],
  value,
  defaultValue,
  onSelect,
  onChange,
  width = 220,
  pillHeight = 40,
  rowHeight = 40,
  gap = 14,
  blur = 10,
  panelPadding = 8,
  maxVisibleRows = 7,
  className = '',
  ariaLabel = 'Select option',
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  id,
  style = {},
  labelPrefix = '',
  gooey = true,
  ...props
}) => {
  const reactId = useId();
  const cleanId = useMemo(() => 'gooey-' + reactId.replace(/[^a-zA-Z0-9_-]/g, ''), [reactId]);
  const filterId = `${cleanId}-filter`;
  const menuId = id || cleanId;

  // Open / Close state (controlled vs uncontrolled)
  const isControlledOpen = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isControlledOpen ? controlledOpen : internalOpen;

  const setOpen = (next) => {
    const nextVal = typeof next === 'function' ? next(open) : next;
    if (!isControlledOpen) {
      setInternalOpen(nextVal);
    }
    onOpenChange?.(nextVal);
  };

  // Reduced motion preference
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mq.matches);
    const handler = (e) => setIsReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Normalize options array into consistent objects
  const normalizedOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];
    return options.map((opt, idx) => {
      if (typeof opt === 'string') {
        return {
          value: opt,
          label: opt,
          icon: null,
          sub: null,
          key: `opt-${opt}-${idx}`,
          raw: opt
        };
      }
      const val = opt.value ?? opt.id ?? opt.label ?? String(idx);
      const lbl = opt.label ?? opt.name ?? opt.value ?? opt.id ?? '';
      return {
        value: String(val),
        label: String(lbl),
        icon: opt.icon || null,
        sub: opt.sub || null,
        actions: opt.actions || null,
        key: `opt-${val}-${idx}`,
        raw: opt
      };
    });
  }, [options]);

  // Selected value
  const initialValue = defaultValue ?? (normalizedOptions[0] ? normalizedOptions[0].value : '');
  const [internalSelected, setInternalSelected] = useState(initialValue);
  const selectedValue = value !== undefined ? String(value) : String(internalSelected);

  // Active / Focused row index for keyboard & hover
  const currentSelectedIndex = useMemo(() => {
    const idx = normalizedOptions.findIndex((o) => o.value === selectedValue);
    return idx >= 0 ? idx : 0;
  }, [normalizedOptions, selectedValue]);

  const [activeIndex, setActiveIndex] = useState(currentSelectedIndex);

  // Keep active index aligned when selectedValue or options change
  useEffect(() => {
    setActiveIndex(currentSelectedIndex);
  }, [currentSelectedIndex]);

  // Find selected item metadata
  const selectedOption = useMemo(() => {
    return (
      normalizedOptions.find((o) => o.value === selectedValue) ||
      normalizedOptions[0] || {
        value: '',
        label: '',
        icon: null,
        sub: null,
        raw: null
      }
    );
  }, [normalizedOptions, selectedValue]);

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  // Close on outside pointerdown
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  // Selection handler
  const choose = (index) => {
    const opt = normalizedOptions[index];
    if (opt) {
      if (!isControlledOpen && value === undefined) {
        setInternalSelected(opt.value);
      }
      setActiveIndex(index);
      onSelect?.(opt.raw, index);
      onChange?.(opt.value, opt.raw, index);
    }
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % normalizedOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + normalizedOptions.length) % normalizedOptions.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(normalizedOptions.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < normalizedOptions.length) {
        choose(activeIndex);
      }
    }
  };

  // Scroll active option into view when navigating via keyboard in scrolling list
  useEffect(() => {
    if (open && activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex];
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex, open]);

  // Panel sizing
  const visibleRows = Math.min(normalizedOptions.length, maxVisibleRows);
  const panelHeight = visibleRows * rowHeight + panelPadding * 2;
  const panelY = pillHeight + gap;
  const SelectedIcon = selectedOption.icon;

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={`cred-gooey-root ${!gooey ? 'non-gooey' : ''} ${className}`}
      style={{
        width,
        height: pillHeight, // Strictly width x pillHeight — zero layout shift!
        zIndex: open ? 60 : 20,
        ...style
      }}
      {...props}
    >
      {/* SVG Gooey Metamorphic Matrix Filter (Only when gooey=true) */}
      {gooey && (
        <svg
          width="0"
          height="0"
          className="cred-gooey-svg"
          aria-hidden="true"
        >
          <defs>
            <filter
              id={filterId}
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -14"
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>
      )}

      {/* Surface Layer - Pure Solid Blobs for fast 60fps GPU rasterization (Only when gooey=true) */}
      {gooey && (
        <div
          className="cred-gooey-surface"
          style={{
            width,
            height: panelY + panelHeight + 60,
            filter: isReducedMotion ? 'none' : `url(#${filterId})`
          }}
        >
          {/* Top Pill Solid Shape */}
          <div
            className="cred-gooey-pill-shape"
            style={{
              width,
              height: pillHeight,
              borderRadius: pillHeight / 2
            }}
          />

          {/* Morphing Dropping Panel Solid Shape */}
          <motion.div
            className="cred-gooey-panel-shape"
            style={{
              width,
              height: panelHeight,
              borderRadius: 20
            }}
            initial={false}
            animate={
              open
                ? { y: panelY, scaleY: 1 }
                : { y: 0, scaleY: pillHeight / panelHeight }
            }
            transition={
              isReducedMotion
                ? { duration: 0.12 }
                : open
                  ? { y: DROP_SPRING, scaleY: { ...GROW_SPRING, delay: 0.05 } }
                  : { y: SNAP_SPRING, scaleY: SNAP_SPRING }
            }
          />
        </div>
      )}

      {/* Trigger Header Button (Solid black pill when non-gooey) */}
      <button
        type="button"
        ref={triggerRef}
        id={menuId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="cred-gooey-trigger"
        style={{
          height: pillHeight,
          borderRadius: pillHeight / 2
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: 0,
            flex: 1,
            overflow: 'hidden'
          }}
        >
          {SelectedIcon && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: gooey ? 'var(--goo-text, #F4F4F4)' : 'currentColor'
              }}
            >
              <SelectedIcon size={16} strokeWidth={1.8} />
            </span>
          )}
          <span 
            className="cred-gooey-trigger-label"
          >
            {labelPrefix ? `${labelPrefix}${selectedOption.label}` : selectedOption.label}
          </span>
        </div>

        <motion.svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={gooey ? 'var(--goo-chevron, #CFCFCF)' : 'currentColor'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, marginLeft: '6px' }}
          animate={{ rotate: open ? 180 : 0 }}
          transition={
            isReducedMotion
              ? { duration: 0.12 }
              : CHEVRON_SPRING
          }
        >
          <path d="m6 9 6 6 6-6" />
        </motion.svg>
      </button>

      {/* List of Options */}
      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel}
            aria-activedescendant={`${menuId}-opt-${activeIndex}`}
            className={`cred-gooey-options-list ${!gooey ? 'non-gooey-panel' : ''}`}
            style={{
              top: gooey ? panelY : pillHeight + 6,
              width,
              minWidth: '100%',
              height: gooey ? panelHeight : 'auto',
              maxHeight: panelHeight,
              overflowY: normalizedOptions.length > maxVisibleRows ? 'auto' : 'hidden',
              overflowX: 'hidden',
              padding: `${panelPadding}px 0`,
              ...(!gooey ? {
                zIndex: 100
              } : {})
            }}
            initial="closed"
            animate="open"
            exit="closed"
            variants={
              !gooey
                ? {
                    open: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.14, ease: [0.16, 1, 0.3, 1] } },
                    closed: { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1, ease: [0.16, 1, 0.3, 1] } }
                  }
                : isReducedMotion
                  ? {
                      open: { opacity: 1, transition: { duration: 0.12 } },
                      closed: { opacity: 0, transition: { duration: 0.12 } }
                    }
                  : {
                      open: { transition: { staggerChildren: 0.035, delayChildren: 0.12 } },
                      closed: { transition: { staggerChildren: 0.015, staggerDirection: -1 } }
                    }
            }
          >
            {normalizedOptions.map((opt, i) => {
              const isActive = i === activeIndex;
              const isCurrentSelected = opt.value === selectedValue;
              const OptIcon = opt.icon;

              return (
                <motion.li
                  key={opt.key}
                  id={`${menuId}-opt-${i}`}
                  role="option"
                  aria-selected={isCurrentSelected}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(i)}
                  variants={
                    !gooey
                      ? {
                          open: { opacity: 1, y: 0, transition: { duration: 0.1 } },
                          closed: { opacity: 0, y: -4, transition: { duration: 0.1 } }
                        }
                      : isReducedMotion
                        ? {
                            open: { opacity: 1, y: 0, transition: { duration: 0.12 } },
                            closed: { opacity: 0, y: -4, transition: { duration: 0.12 } }
                          }
                        : {
                            open: { opacity: 1, y: 0, transition: ROW_SPRING },
                            closed: { opacity: 0, y: -10, transition: SNAP_SPRING }
                          }
                  }
                  className={`cred-gooey-row ${isActive ? 'is-active' : ''} ${isCurrentSelected ? 'is-selected' : ''}`}
                  style={{
                    height: rowHeight,
                    margin: '0 8px',
                    borderRadius: '12px',
                    padding: '0 12px',
                    ...(gooey ? {
                      background: isActive ? 'var(--goo-row-active, #232323)' : 'transparent',
                      color: isActive ? 'var(--goo-text, #F4F4F4)' : 'var(--goo-text-muted, #DCDCDC)'
                    } : {})
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      minWidth: 0,
                      flex: 1
                    }}
                  >
                    {OptIcon && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          color: 'currentColor'
                        }}
                      >
                        <OptIcon size={16} strokeWidth={1.8} />
                      </span>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'inherit',
                          textTransform: 'lowercase',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.2
                        }}
                      >
                        {opt.label}
                      </span>
                      {opt.sub && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#8A8A8A',
                            marginTop: '1px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {opt.sub}
                        </span>
                      )}
                    </div>
                  </div>

                  {opt.actions && opt.actions.length > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                        marginLeft: '8px'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {opt.actions.map((act, actIdx) => {
                        const ActIcon = act.icon;
                        return (
                          <button
                            key={act.id || actIdx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpen(false);
                              act.onClick?.(e, opt.raw);
                            }}
                            title={act.label}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: act.color || 'var(--goo-text-muted, #94a3b8)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.12s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = act.hoverColor || (act.id === 'delete' ? '#ef4444' : '#ffffff');
                              e.currentTarget.style.background = act.id === 'delete' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = act.color || 'var(--goo-text-muted, #94a3b8)';
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            {ActIcon && <ActIcon size={13} strokeWidth={2} />}
                          </button>
                        );
                      })}
                      {isCurrentSelected && (
                        <Check size={14} strokeWidth={2.8} className="cred-gooey-check" style={{ marginLeft: '2px' }} />
                      )}
                    </div>
                  ) : isCurrentSelected ? (
                    <span 
                      className="cred-gooey-dot" 
                    />
                  ) : null}
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GooeyMenu;
