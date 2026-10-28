import React, { useId, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { springMorph } from './motionTokens';

/**
 * CredAnimatedTabs
 * CRED-style animated segmented date tabs with physical sliding & resizing spring indicator.
 * Sourced from easyui AnimatedTabs (https://easyui.site/components/animated-tabs)
 *
 * Visual design:
 * - Transparent container (no track/container border/shadow)
 * - Single shared sliding indicator pill with springMorph
 * - 13px lowercase, 32px height, 4px gap, 14px horizontal padding
 * - Active: black pill (#0A0A0A) / white text (#FFFFFF) [dark: white pill / black text]
 * - Inactive: muted label (#8C8C8C), hover tint (#111111 / #FFFFFF), no background
 * - Roving tabindex keyboard navigation (ArrowLeft, ArrowRight, Home, End)
 * - Zero layout shift, full reduced-motion accessibility
 */
export const CredAnimatedTabs = ({
  tabs = [],
  value,
  onChange,
  className = '',
  ariaLabel = 'Date range filter',
  layoutId,
  style = {}
}) => {
  const uid = useId().replace(/:/g, '');
  const resolvedLayoutId = layoutId || `cred-atabs-${uid}`;
  const isReducedMotion = useReducedMotion();
  const tabRefs = useRef([]);

  const currentIndex = tabs.findIndex((t) => t.id === value);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  const handleKeyDown = (e, index) => {
    let nextIndex = null;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== null) {
      const nextTab = tabs[nextIndex];
      if (nextTab) {
        onChange?.(nextTab.id);
        tabRefs.current[nextIndex]?.focus();
      }
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`cred-atabs-list ${className}`}
      style={style}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.id === value;

        return (
          <button
            key={tab.id}
            ref={(el) => (tabRefs.current[idx] = el)}
            role="tab"
            type="button"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange?.(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`cred-atabs-tab ${isActive ? 'is-active' : ''}`}
          >
            {isActive && (
              <motion.span
                layoutId={resolvedLayoutId}
                className="cred-atabs-indicator"
                initial={false}
                transition={isReducedMotion ? { duration: 0 } : springMorph}
              />
            )}
            <span className="cred-atabs-label">
              {tab.label}
              {tab.count !== undefined && (
                <span className="cred-atabs-count">
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CredAnimatedTabs;
