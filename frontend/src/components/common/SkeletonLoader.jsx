import React from 'react'

const SkeletonLoader = ({ type = 'cards' }) => {
  if (type === 'table') {
    return (
      <div className="skeleton-container" style={{ padding: '1rem', width: '100%' }}>
        <div className="skeleton-header shimmer" style={{ height: '30px', marginBottom: '1.5rem', borderRadius: '4px' }}></div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div className="shimmer" style={{ flex: 1, height: '20px', borderRadius: '4px' }}></div>
            <div className="shimmer" style={{ flex: 2, height: '20px', borderRadius: '4px' }}></div>
            <div className="shimmer" style={{ flex: 1, height: '20px', borderRadius: '4px' }}></div>
            <div className="shimmer" style={{ flex: 1, height: '20px', borderRadius: '4px' }}></div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'cards') {
    return (
      <div className="skeleton-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', width: '100%' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-panel" style={{ padding: '2rem', height: '120px' }}>
            <div className="shimmer" style={{ height: '15px', width: '60%', marginBottom: '1rem', borderRadius: '4px' }}></div>
            <div className="shimmer" style={{ height: '30px', width: '40%', borderRadius: '4px' }}></div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'tree') {
    return (
      <div className="skeleton-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingLeft: '1.5rem', borderLeft: '2px solid var(--border-color)', marginLeft: '1rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ position: 'relative' }}>
            <div className="shimmer" style={{ position: 'absolute', left: '-2.15rem', top: '0', width: '24px', height: '24px', borderRadius: '50%' }}></div>
            <div className="glass-panel shimmer" style={{ height: '80px', marginTop: '-0.5rem', borderRadius: '8px' }}></div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'form') {
    return (
      <div className="skeleton-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-form-group">
            <div className="shimmer" style={{ height: '15px', width: '30%', marginBottom: '0.5rem', borderRadius: '4px' }}></div>
            <div className="shimmer" style={{ height: '40px', width: '100%', borderRadius: '8px' }}></div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <div className="shimmer" style={{ height: '40px', width: '100px', borderRadius: '8px' }}></div>
          <div className="shimmer" style={{ height: '40px', width: '120px', borderRadius: '8px' }}></div>
        </div>
      </div>
    )
  }

  // Default fallback (cards)
  return (
    <div className="skeleton-container" style={{ width: '100%', height: '100px' }}>
      <div className="shimmer" style={{ width: '100%', height: '100%', borderRadius: '8px' }}></div>
    </div>
  )
}

export default SkeletonLoader
