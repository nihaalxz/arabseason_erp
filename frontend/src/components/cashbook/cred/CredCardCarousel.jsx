import React, { useRef, useEffect } from 'react';

/**
 * CredCardCarousel Component
 * Shared component for mobile horizontal scroll card carousel and desktop grid layout.
 * Used on mobile Cash Ledger and mobile Dashboard.
 * 
 * - Mobile (< 768px): One row, horizontal scroll snap, next card peeking, no scrollbar.
 * - Desktop: Clean grid row layout.
 * - Auto-scrolls selected card smoothly into view.
 */
const CredCardCarousel = ({
  children,
  activeId = null,
  isMobile = false,
  desktopGridColumns = null, // e.g., 'repeat(5, 1fr)' or 'repeat(4, 1fr)'
  className = '',
  style = {}
}) => {
  const containerRef = useRef(null);

  // Smoothly scroll active card into view on mobile
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Find the active card element
    const activeCard = containerRef.current.querySelector('.is-active, [aria-pressed="true"]');
    if (activeCard) {
      activeCard.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [activeId]);

  // Click capture to immediately scroll clicked card into view
  const handleClick = (e) => {
    const cardEl = e.target.closest('.cred-money-card');
    if (cardEl && containerRef.current) {
      setTimeout(() => {
        cardEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }, 50);
    }
  };

  const desktopStyle = desktopGridColumns
    ? { gridTemplateColumns: desktopGridColumns }
    : {};

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={`cred-card-carousel ${isMobile ? 'cred-money-cards-scroll' : 'cred-money-cards-grid'} ${className}`}
      style={{
        ...desktopStyle,
        ...style
      }}
    >
      {children}
    </div>
  );
};

export default CredCardCarousel;
