import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Helper to compute visible page numbers with ellipsis gaps:
 * e.g., 1 … 4 5 6 … 12
 */
/**
 * Helper to compute visible dots with sliding window:
 * e.g., if totalPages <= 7, returns [1, 2, ..., totalPages]
 * if totalPages > 7, returns a sliding window of max 7 dots centered around current page
 */
function getVisibleDots(currentPage, totalPages, maxDots = 7) {
  if (totalPages <= maxDots) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const half = Math.floor(maxDots / 2);
  let start = Math.max(1, currentPage - half);
  let end = start + maxDots - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - maxDots + 1);
  }
  const dots = [];
  for (let i = start; i <= end; i++) {
    dots.push(i);
  }
  return dots;
}

function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = [];
  pages.push(1);

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    pages.push('ellipsis-prev');
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < totalPages - 1) {
    pages.push('ellipsis-next');
  }

  pages.push(totalPages);
  return pages;
}

/**
 * CredPagination Component
 * Renders CRED-style pagination controls directly below tables or lists.
 */
const CredPagination = ({
  page = 1,
  totalPages = 1,
  rangeStart = 0,
  rangeEnd = 0,
  total = 0,
  onPageChange = () => {},
  scrollTargetRef = null,
  isMobile = false,
  className = '',
  style = {}
}) => {
  const navRef = useRef(null);

  // Hide pagination completely when everything fits on one page
  if (totalPages <= 1) {
    return null;
  }

  const handlePageChange = (newPage, e) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;

    onPageChange(newPage);

    // Scroll smoothly to the top of the page
    const scrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (document.documentElement) {
        document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (document.body) {
        document.body.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // Scroll common inner containers if they are the active scroll parent
      const containers = document.querySelectorAll(
        '.cred-shell-mobile-content, .main-content, .content-area, .cred-page-container, .dashboard-body, .cashbook-real-container, .dashboard-wrapper'
      );
      containers.forEach(el => {
        if (el && typeof el.scrollTo === 'function') {
          el.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });

      // Target element or page top anchor
      if (scrollTargetRef && scrollTargetRef.current) {
        scrollTargetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const topAnchor = document.querySelector(
          '.cred-page-container, .cred-home-page, .cashbook-real-container, .cred-shell-mobile, .header, #root'
        );
        if (topAnchor && typeof topAnchor.scrollIntoView === 'function') {
          topAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    scrollToTop();
    setTimeout(scrollToTop, 60);
  };

  const pageNumbers = getPageNumbers(page, totalPages);
  const visibleDots = getVisibleDots(page, totalPages);
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  return (
    <nav
      ref={navRef}
      className={`cred-pagination ${className}`}
      aria-label="pagination"
      style={{
        marginTop: '16px',
        ...style
      }}
    >
      {/* Polite live region for screen readers */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          border: 0
        }}
      >
        page {page} of {totalPages}
      </div>

      {/* Range text: 1–25 of 54 entries (en dash, tabular numbers) */}
      <div className="cred-pagination-range">
        {rangeStart}–{rangeEnd} of {total} {total === 1 ? 'entry' : 'entries'}
      </div>

      {/* Controls Container */}
      <div className="cred-pagination-controls">
        {/* Previous page arrow */}
        <button
          type="button"
          className="cred-pagination-arrow"
          onClick={(e) => handlePageChange(page - 1, e)}
          disabled={isFirstPage}
          aria-label="previous page"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>

        {/* Mobile-only dots pagination navigator (replaces 'page X of Y') */}
        <div 
          className={`cred-pagination-dots ${isMobile ? 'is-mobile-dots' : 'cred-mobile-only'}`}
          role="tablist"
          aria-label="page navigation dots"
          style={{
            display: isMobile ? 'inline-flex' : undefined,
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '4px 6px'
          }}
        >
          {visibleDots.map((p) => {
            const isActive = p === page;
            return (
              <button
                key={p}
                type="button"
                onClick={(e) => handlePageChange(p, e)}
                aria-label={`page ${p}`}
                aria-current={isActive ? 'page' : undefined}
                className={`cred-pagination-dot ${isActive ? 'is-active' : ''}`}
                style={{
                  width: isActive ? '18px' : '7px',
                  height: '7px',
                  borderRadius: '999px',
                  background: isActive ? 'var(--text, #0A0A0A)' : 'var(--text-muted, #8C8C8C)',
                  opacity: isActive ? 1 : 0.35,
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              />
            );
          })}
        </div>

        {/* Desktop-only page numbers */}
        <div className="cred-pagination-numbers cred-desktop-only">
          {pageNumbers.map((item, idx) => {
            if (typeof item === 'string') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="cred-pagination-ellipsis"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }

            const isActive = item === page;
            return (
              <button
                key={item}
                type="button"
                className={`cred-pagination-btn ${isActive ? 'is-active' : ''}`}
                onClick={(e) => handlePageChange(item, e)}
                aria-label={`page ${item}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Next page arrow */}
        <button
          type="button"
          className="cred-pagination-arrow"
          onClick={(e) => handlePageChange(page + 1, e)}
          disabled={isLastPage}
          aria-label="next page"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>
    </nav>
  );
};

export { CredPagination };
export default CredPagination;
