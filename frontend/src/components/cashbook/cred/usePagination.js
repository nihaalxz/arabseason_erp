import { useState, useEffect, useMemo, useRef } from 'react';

export const PAGE_SIZE_DESKTOP = 25;
export const PAGE_SIZE_MOBILE = 20;

/**
 * Shared client-side pagination hook.
 * 
 * @param {Array} items - The filtered items list to paginate
 * @param {number} pageSize - Page size (PAGE_SIZE_DESKTOP or PAGE_SIZE_MOBILE)
 * @param {any} resetKey - Any key/filter dependency that resets to page 1
 * @returns {object} { pageItems, page, setPage, totalPages, rangeStart, rangeEnd, total }
 */
export function usePagination(items = [], pageSize = PAGE_SIZE_DESKTOP, resetKey = null) {
  const [page, setPage] = useState(1);

  const total = Array.isArray(items) ? items.length : 0;
  const safePageSize = Math.max(1, pageSize || PAGE_SIZE_DESKTOP);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  // Reset page to 1 when resetKey (filter, tab, search, card) changes
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  // When a newly added item increases total count, return to page 1
  const prevTotalRef = useRef(total);
  useEffect(() => {
    if (total > prevTotalRef.current) {
      setPage(1);
    }
    prevTotalRef.current = total;
  }, [total]);

  // Clamp page if total pages shrink (e.g., after deletion)
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const currentPage = Math.min(Math.max(1, page), totalPages);

  const pageItems = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return [];
    const startIdx = (currentPage - 1) * safePageSize;
    return items.slice(startIdx, startIdx + safePageSize);
  }, [items, currentPage, safePageSize]);

  const rangeStart = total === 0 ? 0 : (currentPage - 1) * safePageSize + 1;
  const rangeEnd = Math.min(total, currentPage * safePageSize);

  return {
    pageItems,
    page: currentPage,
    setPage,
    totalPages,
    rangeStart,
    rangeEnd,
    total,
  };
}

/**
 * Sorts any list of dated transactions newest first:
 * Entry date and time descending (newest on top), tie-break by id descending.
 */
export function sortNewestFirst(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    // 1. Date string (YYYY-MM-DD)
    const dateA = a?.date ? String(a.date).split('T')[0] : (a?.created_at ? String(a.created_at).split('T')[0] : '');
    const dateB = b?.date ? String(b.date).split('T')[0] : (b?.created_at ? String(b.created_at).split('T')[0] : '');
    const dComp = dateB.localeCompare(dateA);
    if (dComp !== 0) return dComp;

    // 2. Time string (HH:MM or HH:MM:SS)
    const timeA = a?.time || (a?.created_at && a.created_at.includes('T') ? a.created_at.split('T')[1].slice(0, 5) : '');
    const timeB = b?.time || (b?.created_at && b.created_at.includes('T') ? b.created_at.split('T')[1].slice(0, 5) : '');
    const tComp = String(timeB).localeCompare(String(timeA));
    if (tComp !== 0) return tComp;

    // 3. Tie-break by id descending
    return (Number(b?.id) || 0) - (Number(a?.id) || 0);
  });
}

/**
 * Ensures a single '#' prefix, preserves original capitalization,
 * and strips any leading '#' characters before adding one.
 */
export function formatJobRef(id) {
  if (id === null || id === undefined) return '';
  const str = String(id).trim();
  if (!str) return '';
  const clean = str.replace(/^#+/, '');
  return `#${clean}`;
}

/**
 * Dynamic amount font size for tables/cards to prevent overflow:
 * Shrinks font by one step if length is > 9 characters or value >= 100k
 */
export function getAmountFontSize(val) {
  const str = String(val != null ? val : '').replace(/[^\d.-]/g, '');
  const num = Math.abs(parseFloat(str) || 0);
  if (num >= 1000000 || str.length > 11) return '10px';
  if (num >= 100000 || str.length > 9) return '11px';
  return '12px';
}

/**
 * Compact formatter for KPI cards only on mobile view (e.g. SAR 1.2M, SAR 495K).
 * Returns null if below 100k so full value is rendered normally.
 */
export function formatCompactKpi(val, currency = 'SAR') {
  const num = parseFloat(String(val != null ? val : '').replace(/,/g, '')) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1000000) {
    return `${sign}${currency} ${(abs / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 100000) {
    return `${sign}${currency} ${(abs / 1000).toFixed(0)}K`;
  }
  return null;
}

