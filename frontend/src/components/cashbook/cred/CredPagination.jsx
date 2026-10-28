import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Helper to compute visible page numbers with ellipsis gaps:
 * e.g., 1 … 4 5 6 … 12
 */
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

    // Scroll table (or list) back to its top
    if (scrollTargetRef && scrollTargetRef.current) {
      scrollTargetRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      const navEl = navRef.current || e?.currentTarget?.closest('.cred-pagination');
      const prevElement = navEl?.previousElementSibling;
      if (prevElement) {
        prevElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  const pageNumbers = getPageNumbers(page, totalPages);
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

        {/* Mobile-only compact center text: page 2 of 3 */}
        <span className="cred-pagination-mobile-label cred-mobile-only">
          page {page} of {totalPages}
        </span>

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
