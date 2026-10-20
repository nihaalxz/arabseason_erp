import { TrendingUp, TrendingDown } from '../icons'

/**
 * Zoho Books-style KPI Stat Card.
 * Color stripe on the left edge, icon in a tinted circle.
 */
const StatCard = ({ title, value, icon: Icon, trend, color = '#336699' }) => {
  // Derive a faint background tint from the icon color
  const tintMap = {
    '#336699': { bg: '#ebf3fc', icon: '#336699' },
    '#1a9e5c': { bg: '#e6f7f0', icon: '#1a9e5c' },
    '#e53e3e': { bg: '#fdf0f0', icon: '#e53e3e' },
    '#8b5cf6': { bg: '#f3effe', icon: '#8b5cf6' },
    '#d97706': { bg: '#fef9ec', icon: '#d97706' },
  }
  const tint = tintMap[color] || { bg: '#ebf3fc', icon: color }

  return (
    <div
      className="glass-panel stat-card"
      style={{
        padding: '1.1rem 1.2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem',
        position: 'relative',
        overflow: 'hidden',
        borderLeft: `3px solid ${color}`,
        borderTop: 'none',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: '0.7rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.055em',
          margin: 0,
          lineHeight: 1.2,
        }}>
          {title}
        </p>
        {/* Icon bubble */}
        <div style={{
          width: '32px',
          height: '32px',
          background: tint.bg,
          borderRadius: '6px',
          color: tint.icon,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={15} strokeWidth={2} />
        </div>
      </div>

      {/* Value row */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
        <h3 style={{
          fontSize: 'clamp(1.2rem, 2.8vw, 1.5rem)',
          fontWeight: '800',
          letterSpacing: '-0.025em',
          color: 'var(--text-main)',
          wordBreak: 'break-word',
          lineHeight: '1.15',
          margin: 0,
        }}>
          {value}
        </h3>

        {trend !== undefined && trend !== null && (
          <div style={{
            fontSize: '0.7rem',
            fontWeight: '700',
            color: trend >= 0 ? 'var(--success)' : 'var(--danger)',
            background: trend >= 0 ? 'var(--success-light)' : 'var(--danger-light)',
            border: `1px solid ${trend >= 0 ? 'var(--success-border)' : 'var(--danger-border)'}`,
            padding: '0.15rem 0.45rem',
            borderRadius: '3px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.2rem',
            flexShrink: 0,
          }}>
            {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
  )
}

export default StatCard
