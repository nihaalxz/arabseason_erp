import React from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

/**
 * PageHeaderButton
 * Unified primary header action button (e.g. "+ New Enquiry", "+ New Customer", "+ New Job Order").
 * Follows the approved CRED / Cashbook style:
 * - Solid black (ink) background, white text, fully rounded pill shape (border-radius: 9999px)
 * - 36px height, padding: 0 18px, font-size: 13px, font-weight: 500
 * - Plus icon: size 15, strokeWidth 2, 6px gap to label
 * - Subtle hover, active states, and dark mode support
 * - Can act as a <button> or React Router <Link> when `to` prop is provided
 */
export default function PageHeaderButton({
  onClick,
  to,
  icon,
  children,
  label,
  disabled = false,
  type = 'button',
  className = '',
  style = {},
  ...props
}) {
  const content = label !== undefined ? label : children
  const isTextOnly = typeof content === 'string' || typeof content === 'number'

  // Determine icon to render
  let IconComponent = null
  if (icon !== undefined) {
    IconComponent = icon
  } else if (isTextOnly) {
    IconComponent = Plus
  }

  const innerContent = (
    <>
      {IconComponent && <IconComponent size={15} strokeWidth={2} style={{ flexShrink: 0 }} />}
      {isTextOnly ? <span>{content}</span> : content}
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className={`page-header-btn ${className}`}
        style={style}
        {...props}
      >
        {innerContent}
      </Link>
    )
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`page-header-btn ${className}`}
      style={style}
      {...props}
    >
      {innerContent}
    </button>
  )
}

