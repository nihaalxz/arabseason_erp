import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Receipt, 
  Briefcase, 
  Users, 
  Calendar, 
  Trash2, 
  RefreshCw,
  ArrowLeft,
  Building2,
  Wallet,
  Tag
} from 'lucide-react';
import CredPageHeader from '../CredPageHeader';
import MoneyCard from '../MoneyCard';
import CredCardCarousel from '../CredCardCarousel';
import GooeyMenu from '../GooeyMenu';
import CredSearchInput from '../CredSearchInput';
import Money from '../Money';
import CredChannelCell from '../CredChannelCell';
import CredRowIconButton from '../CredRowIconButton';
import { fadeFast } from '../motionTokens';
import CredPagination from '../CredPagination';
import { usePagination, PAGE_SIZE_DESKTOP, PAGE_SIZE_MOBILE, sortNewestFirst, formatJobRef, getAmountFontSize, formatCompactKpi } from '../usePagination';

const getMonthYearLabel = (dateStr) => {
  if (!dateStr) return 'RECENT';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'RECENT';
    const m = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const y = String(d.getFullYear()).slice(-2);
    return `${m} '${y}`;
  } catch (e) {
    return 'RECENT';
  }
};

const getCategoryIcon = (category = '') => {
  const cat = String(category).toLowerCase();
  if (cat.includes('project') || cat.includes('material') || cat.includes('equipment')) return Briefcase;
  if (cat.includes('salary') || cat.includes('wage') || cat.includes('staff')) return Users;
  if (cat.includes('company') || cat.includes('office') || cat.includes('rent')) return Building2;
  if (cat.includes('venture') || cat.includes('invest')) return Wallet;
  return Receipt;
};


// Standard Expense category definitions
const EXPENSE_CATEGORY_GROUPS = {
  Project: [
    'Materials',
    'Labor / Wages',
    'Subcontractor',
    'Equipment & Machinery',
    'Equipment & Tools',
    'Transportation & Logistics',
    'Project - Other'
  ],
  Salary: [
    'Salary',
    'Staff Salary',
    'Worker Wages',
    'Salary Advance',
    'Bonus / Incentive',
    'Allowance',
    'End of Service'
  ],
  Company: [
    'Company',
    'Office Supplies',
    'Rent & Facilities',
    'Utilities',
    'Maintenance',
    'Software & Subscriptions',
    'Marketing & Advertising',
    'Legal & Professional Fees'
  ],
  Venture: [
    'Venture',
    'Venture Investment',
    'Business Development',
    'Partnership Share',
    'Consulting'
  ],
  Other: [
    'Other',
    'General',
    'Food',
    'Petrol',
    'Fuel & Transportation',
    'Travel & Lodging',
    'Miscellaneous'
  ]
};

// Internal transfer exclusion helper
export const isTransferExpense = (item) => {
  if (!item) return false;
  const cat = (item.category || '').toLowerCase().trim();
  const desc = (item.description || '').toLowerCase().trim();
  const notes = (item.notes || '').toLowerCase().trim();
  const type = (item.type || '').toLowerCase().trim();
  if (cat === 'transfer' || type === 'transfer') return true;
  if (notes.includes('internal transfer') || notes.includes('➔') || notes.includes('->')) return true;
  if (desc.startsWith('internal transfer') || desc.includes('bank withdrawal to petty cash') || desc.includes('petty cash to bank')) return true;
  return false;
};

// Date & time helpers
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month}, ${year}`;
  } catch (e) {
    return dateStr;
  }
};

const formatTimeDisplay = (timeStr) => {
  if (!timeStr) return '';
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    let hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  }
  return timeStr;
};

const getExpenseTime = (item) => {
  if (item.time) return formatTimeDisplay(item.time);
  if (item.custom_fields?.time) return formatTimeDisplay(item.custom_fields.time);
  if (item.created_at) {
    try {
      const d = new Date(item.created_at);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
    } catch (e) {}
  }
  return '';
};

const getTypeBadgeStyle = (t, isDark) => {
  const typeLower = (t || '').toLowerCase();
  if (typeLower === 'project') {
    return { 
      bg: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff', 
      text: isDark ? '#93c5fd' : '#1d4ed8', 
      border: isDark ? '#1e3a8a' : '#bfdbfe' 
    };
  }
  if (typeLower === 'salary') {
    return { 
      bg: isDark ? 'rgba(147, 51, 234, 0.2)' : '#faf5ff', 
      text: isDark ? '#d8b4fe' : '#7e22ce', 
      border: isDark ? '#581c87' : '#e9d5ff' 
    };
  }
  if (typeLower === 'venture') {
    return { 
      bg: isDark ? 'rgba(217, 119, 6, 0.2)' : '#fffbeb', 
      text: isDark ? '#fcd34d' : '#b45309', 
      border: isDark ? '#78350f' : '#fde68a' 
    };
  }
  return { 
    bg: isDark ? '#1e2229' : '#f1f5f9', 
    text: isDark ? '#cbd5e1' : '#475569', 
    border: isDark ? '#2d3139' : '#e2e8f0' 
  };
};

/**
 * CredExpensesView
 * 
 * Previous layout restored with CRED aesthetics:
 * 1. 4 Metric KPI Cards (Total Expenses, Project Costs, Salary & Overheads, This Month).
 * 2. Clicking each card filters the table below.
 * 3. Filter section with GooeyMenu liquid dropdown and search input.
 * 4. Dedicated desktop table with columns for date & time, type & category, description & particulars,
 *    payee/vendor, project/job order, payment channel, amount, and delete action.
 */
const CredExpensesView = ({
  isMobile = false,
  expenses = [],
  jobOrders = [],
  isLoading = false,
  isDarkMode = false,
  onAddExpense = () => {},
  onDeleteExpense = () => {},
  onNavigate = null
}) => {
  // Filter States
  const [cardFilter, setCardFilter] = useState('all'); // 'all' | 'project' | 'salary_overhead' | 'this_month'
  const [categoryFilter, setCategoryFilter] = useState('All'); // 'All' | 'Project' | 'Salary' | 'Company' | 'Venture' | 'Other'
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Deduplicate expenses by ID, excluding inter-account transfers
  const deduplicatedExpenses = useMemo(() => {
    const seenExpenseIds = new Set();
    return (expenses || []).filter(item => {
      if (!item || item.id == null) return false;
      if (isTransferExpense(item)) return false;
      if (seenExpenseIds.has(item.id)) return false;
      seenExpenseIds.add(item.id);
      return true;
    });
  }, [expenses]);

  // 2. Computed KPI Card metrics
  const totalExpensesAmount = useMemo(() => {
    return deduplicatedExpenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  }, [deduplicatedExpenses]);

  const projectExpenses = useMemo(() => {
    return deduplicatedExpenses.filter(e => {
      const t = (e.type || '').toLowerCase();
      const c = (e.category || '').toLowerCase();
      if (['salary', 'company', 'venture'].includes(t)) return false;
      const nonProjectCats = [
        ...(EXPENSE_CATEGORY_GROUPS.Salary || []),
        ...(EXPENSE_CATEGORY_GROUPS.Company || []),
        ...(EXPENSE_CATEGORY_GROUPS.Venture || [])
      ].map(x => x.toLowerCase());
      if (nonProjectCats.includes(c)) return false;

      const pCats = (EXPENSE_CATEGORY_GROUPS.Project || []).map(x => x.toLowerCase());
      return t === 'project' || pCats.includes(c) || Boolean(e.job_order);
    });
  }, [deduplicatedExpenses]);
  const projectExpensesAmount = useMemo(() => {
    return projectExpenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  }, [projectExpenses]);

  const salaryCompanyExpenses = useMemo(() => {
    return deduplicatedExpenses.filter(e => {
      const t = (e.type || '').toLowerCase();
      const c = (e.category || '').toLowerCase();
      const scCats = [
        ...(EXPENSE_CATEGORY_GROUPS.Salary || []),
        ...(EXPENSE_CATEGORY_GROUPS.Company || [])
      ].map(x => x.toLowerCase());
      return ['salary', 'company'].includes(t) || scCats.includes(c);
    });
  }, [deduplicatedExpenses]);
  const salaryCompanyExpensesAmount = useMemo(() => {
    return salaryCompanyExpenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  }, [salaryCompanyExpenses]);

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthExpenses = useMemo(() => {
    return deduplicatedExpenses.filter(e => (e.date || '').startsWith(currentMonthPrefix));
  }, [deduplicatedExpenses, currentMonthPrefix]);
  const thisMonthExpensesAmount = useMemo(() => {
    return thisMonthExpenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  }, [thisMonthExpenses]);

  // Helper: Match single category
  const matchesCategory = (item, cat) => {
    if (!cat || cat === 'All') return true;
    const filterLower = cat.toLowerCase();
    const itemType = (item.type || '').toLowerCase();
    const itemCat = (item.category || '').toLowerCase();
    const groupCats = (EXPENSE_CATEGORY_GROUPS[cat] || []).map(c => c.toLowerCase());

    const matchesType = itemType === filterLower || (filterLower === 'company' && itemType === 'operational');
    const matchesCat = itemCat === filterLower || groupCats.includes(itemCat);
    const matchesProject = cat === 'Project' && Boolean(item.job_order) && !['salary', 'company', 'venture'].includes(itemType);

    return matchesType || matchesCat || matchesProject;
  };

  // Helper: Match search query
  const matchesSearch = (item, q) => {
    if (!q.trim()) return true;
    const query = q.toLowerCase().trim();
    const desc = (item.description || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    const type = (item.type || '').toLowerCase();
    const payee = (item.custom_fields?.payee || item.vendor_name || item.vendor?.name || item.payee || '').toLowerCase();
    const inv = (item.custom_fields?.invoice_number || item.reference_number || '').toLowerCase();
    const notes = (item.notes || '').toLowerCase();
    const jobT = (item.job_order_title || (typeof item.job_order === 'object' ? item.job_order?.title : '') || '').toLowerCase();
    const jobN = (item.job_order_number || item.job_order_id || '').toLowerCase();
    const creator = (item.created_by_name || '').toLowerCase();
    return desc.includes(query) || cat.includes(query) || type.includes(query) || payee.includes(query) || inv.includes(query) || notes.includes(query) || jobT.includes(query) || jobN.includes(query) || creator.includes(query);
  };

  // 3. Card click handler (toggles filter or sets active)
  const handleCardClick = (targetFilter) => {
    if (cardFilter === targetFilter) {
      setCardFilter('all');
    } else {
      setCardFilter(targetFilter);
    }
  };

  // 4. Filtered table expenses
  const filteredExpenses = useMemo(() => {
    return deduplicatedExpenses.filter(item => {
      // 1. Card filter
      if (cardFilter === 'project') {
        const isProj = projectExpenses.some(p => p.id === item.id);
        if (!isProj) return false;
      } else if (cardFilter === 'salary_overhead') {
        const isSal = salaryCompanyExpenses.some(s => s.id === item.id);
        if (!isSal) return false;
      } else if (cardFilter === 'this_month') {
        const isMonth = thisMonthExpenses.some(m => m.id === item.id);
        if (!isMonth) return false;
      }

      // 2. Category filter from GooeyMenu
      if (categoryFilter !== 'All' && !matchesCategory(item, categoryFilter)) {
        return false;
      }

      // 3. Search query
      if (searchQuery.trim() && !matchesSearch(item, searchQuery)) {
        return false;
      }

      return true;
    });
  }, [deduplicatedExpenses, cardFilter, categoryFilter, searchQuery, projectExpenses, salaryCompanyExpenses, thisMonthExpenses]);

  // 5. Sorted recent entries first (entry date & time descending, tie-break by id descending)
  const sortedExpenses = useMemo(() => {
    return sortNewestFirst(filteredExpenses);
  }, [filteredExpenses]);

  // Pagination for expenses
  const expenseResetKey = `${cardFilter}_${categoryFilter}_${searchQuery}`;
  const {
    pageItems: pagedExpenses,
    page: expensePage,
    setPage: setExpensePage,
    totalPages: totalExpensePages,
    rangeStart: expenseRangeStart,
    rangeEnd: expenseRangeEnd,
    total: totalExpenseCount
  } = usePagination(sortedExpenses, isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP, expenseResetKey);

  // 6. GooeyMenu Category Options with dynamic counts
  const gooeyCategoryOptions = useMemo(() => {
    const pills = ['All', 'Project', 'Salary', 'Company', 'Venture', 'Other'];
    return pills.map(pill => {
      const count = pill === 'All' 
        ? deduplicatedExpenses.length 
        : deduplicatedExpenses.filter(item => matchesCategory(item, pill)).length;
      return {
        id: pill,
        value: pill,
        label: pill === 'All' ? 'all expenses' : pill.toLowerCase(),
        sub: `${count} ${count === 1 ? 'entry' : 'entries'}`
      };
    });
  }, [deduplicatedExpenses]);

  // Month grouped expenses for CRED mobile payment history layout
  const monthGroups = useMemo(() => {
    const groups = [];
    let curGroup = null;
    (pagedExpenses || []).forEach(item => {
      const label = getMonthYearLabel(item.date);
      if (!curGroup || curGroup.monthLabel !== label) {
        curGroup = { monthLabel: label, items: [] };
        groups.push(curGroup);
      }
      curGroup.items.push(item);
    });
    return groups;
  }, [pagedExpenses]);

  const hasActiveFilters = cardFilter !== 'all' || categoryFilter !== 'All' || Boolean(searchQuery.trim());

  const handleClearAllFilters = () => {
    setCardFilter('all');
    setCategoryFilter('All');
    setSearchQuery('');
  };

  return (
    <div className="cred-expenses-page" style={{ width: '100%', position: 'relative' }}>
      {/* 1. Page Header: Title "expenses" & "+ Add Expense" primary button */}
      {isMobile ? (
        <div style={{ marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('more')}
            aria-label="Back to More"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 0',
              marginBottom: '10px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text, #0A0A0A)',
              outline: 'none',
              width: 'fit-content'
            }}
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em', textTransform: 'lowercase' }}>
              expenses
            </h1>
            <button
              type="button"
              id="btn-open-expense-modal"
              onClick={onAddExpense}
              style={{
                background: isDarkMode ? '#FFFFFF' : '#0A0A0A',
                color: isDarkMode ? '#0A0A0A' : '#FFFFFF',
                border: 'none',
                borderRadius: '999px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Add</span>
            </button>
          </div>
        </div>
      ) : (
        <CredPageHeader
          title="expenses"
          caption={null}
          actions={
            <button
              type="button"
              id="btn-open-expense-modal"
              onClick={onAddExpense}
              className="cred-header-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'var(--text, #0A0A0A)',
                color: 'var(--bg, #FFFFFF)',
                border: 'none',
                borderRadius: '999px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Add Expense</span>
            </button>
          }
        />
      )}

      {/* 2. Exactly 4 KPI Metric Cards (clickable to filter table, scroll snap carousel on mobile) */}
      <CredCardCarousel
        isMobile={isMobile}
        activeId={cardFilter}
        desktopGridColumns="repeat(4, 1fr)"
        style={{ marginBottom: '24px' }}
      >
        {/* Card 1: TOTAL EXPENSES */}
        <MoneyCard
          icon={Receipt}
          label="TOTAL EXPENSES"
          value={isMobile && formatCompactKpi(totalExpensesAmount) ? <span className="cred-tnum">{formatCompactKpi(totalExpensesAmount)}</span> : totalExpensesAmount}
          variant="danger"
          caption={`${deduplicatedExpenses.length} ${deduplicatedExpenses.length === 1 ? 'entry' : 'entries'}`}
          isActive={cardFilter === 'all'}
          onClick={() => handleCardClick('all')}
        />

        {/* Card 2: PROJECT COSTS */}
        <MoneyCard
          icon={Briefcase}
          label="PROJECT COSTS"
          value={isMobile && formatCompactKpi(projectExpensesAmount) ? <span className="cred-tnum">{formatCompactKpi(projectExpensesAmount)}</span> : projectExpensesAmount}
          variant="default"
          caption={`${projectExpenses.length} projects`}
          isActive={cardFilter === 'project'}
          onClick={() => handleCardClick('project')}
        />

        {/* Card 3: SALARY & OVERHEADS */}
        <MoneyCard
          icon={Users}
          label="SALARY & OVERHEADS"
          value={isMobile && formatCompactKpi(salaryCompanyExpensesAmount) ? <span className="cred-tnum">{formatCompactKpi(salaryCompanyExpensesAmount)}</span> : salaryCompanyExpensesAmount}
          variant="default"
          caption={`${salaryCompanyExpenses.length} operations`}
          isActive={cardFilter === 'salary_overhead'}
          onClick={() => handleCardClick('salary_overhead')}
        />

        {/* Card 4: THIS MONTH */}
        <MoneyCard
          icon={Calendar}
          label="THIS MONTH"
          value={isMobile && formatCompactKpi(thisMonthExpensesAmount) ? <span className="cred-tnum">{formatCompactKpi(thisMonthExpensesAmount)}</span> : thisMonthExpensesAmount}
          variant="default"
          caption={`${thisMonthExpenses.length} ${thisMonthExpenses.length === 1 ? 'entry' : 'entries'}`}
          isActive={cardFilter === 'this_month'}
          onClick={() => handleCardClick('this_month')}
        />
      </CredCardCarousel>

      {/* 3. Filter Section: GooeyMenu Dropdown on left, Search on right */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '16px',
          position: 'relative',
          zIndex: 40,
          overflow: 'visible'
        }}
      >
        {/* Left: Category liquid dropdown (GooeyMenu) */}
        <div style={{ position: 'relative', zIndex: 40, overflow: 'visible' }}>
          <GooeyMenu
            id="cred-expenses-category-dropdown"
            value={categoryFilter}
            onSelect={(opt) => setCategoryFilter(opt.value || opt.id || opt)}
            options={gooeyCategoryOptions}
            width={240}
            pillHeight={40}
            ariaLabel="Filter expense category"
          />
        </div>

        {/* Right: Search Box */}
        <div style={{ width: isMobile ? '100%' : '300px' }}>
          <CredSearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="search expenses..."
            compact={false}
            ariaLabel="Search expenses"
          />
        </div>
      </div>

      {/* Filter Info Bar: Entry count & Clear filters link */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '14px',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span 
            style={{ 
              fontSize: '11px', 
              fontWeight: 700, 
              letterSpacing: '0.14em', 
              textTransform: 'uppercase', 
              color: 'var(--text-muted, #8C8C8C)' 
            }}
          >
            {cardFilter === 'project' 
              ? 'PROJECT EXPENSES' 
              : cardFilter === 'salary_overhead' 
              ? 'SALARY & OVERHEADS' 
              : cardFilter === 'this_month' 
              ? 'THIS MONTH EXPENSES' 
              : 'ALL EXPENSES'}
          </span>
          <span 
            style={{ 
              fontSize: '13px', 
              color: 'var(--text-muted, #8C8C8C)', 
              fontWeight: 500 
            }}
          >
            ({sortedExpenses.length} {sortedExpenses.length === 1 ? 'entry' : 'entries'})
          </span>
        </div>
      </div>

      {/* 4. Table Section (with smooth 150ms fade transition) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${cardFilter}-${categoryFilter}-${searchQuery ? 'search' : 'idle'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fadeFast}
        >
          {isLoading ? (
            <div 
              style={{
                background: 'var(--bg, #FFFFFF)',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '20px',
                padding: '3rem',
                textAlign: 'center',
                color: 'var(--text-muted, #8C8C8C)'
              }}
            >
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Loading expenses...</div>
            </div>
          ) : sortedExpenses.length === 0 ? (
            <div 
              style={{
                background: 'var(--bg, #FFFFFF)',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '20px',
                padding: '3.5rem 1.5rem',
                textAlign: 'center'
              }}
            >
              <div 
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--bg-panel, #F4F4F4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  color: 'var(--text-muted, #8C8C8C)'
                }}
              >
                <Receipt size={22} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text, #0A0A0A)', margin: '0 0 0.35rem' }}>
                No expenses found
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted, #8C8C8C)', margin: '0 0 1.25rem' }}>
                {hasActiveFilters 
                  ? 'No expenses matched your filter criteria.'
                  : 'Get started by recording your first expense entry.'}
              </p>
              <button
                type="button"
                onClick={onAddExpense}
                style={{
                  background: 'var(--text, #0A0A0A)',
                  color: 'var(--bg, #FFFFFF)',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.12)'
                }}
              >
                <Plus size={15} strokeWidth={2.5} />
                <span>Add Expense</span>
              </button>
            </div>
          ) : isMobile ? (
            /* MOBILE VIEW: CRED Payment History layout matching reference screenshot */
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
              {monthGroups.map((group) => (
                <div key={group.monthLabel} style={{ marginBottom: '16px' }}>
                  {/* Small uppercase letter-spaced month label */}
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted, #8C8C8C)',
                    padding: '8px 0',
                    userSelect: 'none'
                  }}>
                    {group.monthLabel}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {group.items.map((item) => {
                      const CategoryIcon = getCategoryIcon(item.category || item.type);
                      const expenseTime = getExpenseTime(item);
                      const payMethod = item.payment_method || item.payment_mode || item.custom_fields?.payment_method || 'Cash';
                      const displayCategory = item.category || 'General';
                      const remarkText = (item.description && item.description.trim() !== '0')
                        ? item.description.trim()
                        : (item.custom_fields?.payee || item.vendor_name || item.payee || item.notes || '');

                      return (
                        <div key={item.id} style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            padding: '12px 0',
                            boxSizing: 'border-box'
                          }}>
                            {/* Left: circular 44px avatar with light outline */}
                            <div style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              border: isDarkMode ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--border, #E4E4E4)',
                              background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#fafafa',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              color: isDarkMode ? '#FFFFFF' : '#0A0A0A'
                            }}>
                              <CategoryIcon size={18} strokeWidth={1.8} />
                            </div>

                            {/* Middle: Title in 500 + Date/Time · Payment mode + Ellipsized remark */}
                            <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: 500,
                                color: 'var(--text, #0A0A0A)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                lineHeight: 1.3
                              }}>
                                {displayCategory}
                              </div>
                              <div style={{
                                fontSize: '12px',
                                color: 'var(--text-muted, #8C8C8C)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginTop: '2px',
                                lineHeight: 1.3
                              }}>
                                {formatDateDisplay(item.date)}{expenseTime ? `, ${expenseTime}` : ''}
                                {payMethod ? ` · ${payMethod}` : ''}
                              </div>
                              {remarkText ? (
                                <div style={{
                                  fontSize: '11px',
                                  color: 'var(--text-muted, #8C8C8C)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  marginTop: '2px',
                                  lineHeight: 1.3
                                }}>
                                  {remarkText}
                                </div>
                              ) : null}
                            </div>

                            {/* Right: Amount in red + Quiet delete icon */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              <div style={{
                                textAlign: 'right',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: 'var(--danger, #dc2626)',
                                fontVariantNumeric: 'tabular-nums',
                                whiteSpace: 'nowrap'
                              }}>
                                -<Money value={item.amount} style={{ color: 'var(--danger, #dc2626)' }} />
                              </div>
                              <CredRowIconButton
                                tone="danger"
                                title="Delete expense"
                                ariaLabel="Delete expense"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteExpense(item.id);
                                }}
                                style={{ width: '28px', height: '28px' }}
                              >
                                <Trash2 size={13} />
                              </CredRowIconButton>
                            </div>
                          </div>

                          {/* Inset dashed separator */}
                          <div style={{
                            marginLeft: '56px',
                            borderBottom: isDarkMode ? '1px dashed rgba(255,255,255,0.08)' : '1px dashed rgba(0,0,0,0.08)'
                          }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* DESKTOP VIEW: Full table unchanged */
            <div 
              className="cred-expenses-table-card"
              style={{
                background: 'var(--bg, #FFFFFF)',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
                <table 
                  style={{
                    width: '100%',
                    minWidth: '940px',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: '0.825rem'
                  }}
                >
                  <thead>
                    <tr 
                      style={{
                        background: 'var(--bg-panel, #F8FAFC)',
                        borderBottom: '1px solid var(--border, #E4E4E4)'
                      }}
                    >
                      <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>DATE & TIME</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>TYPE & CATEGORY</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DESCRIPTION & PARTICULARS</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>PAYEE / VENDOR</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PROJECT / JOB ORDER</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>PAYMENT CHANNEL</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap' }}>AMOUNT</th>
                      <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedExpenses.map((item, idx) => {
                      const job = jobOrders.find(j => j.id === item.job_order);
                      const jobTitle = job?.title || item.job_order_title || (typeof item.job_order === 'object' ? item.job_order?.title : '');
                      const jobId = job?.order_id || item.job_order_number || item.job_order_id || '';
                      const payMethod = item.payment_method || item.payment_mode || item.custom_fields?.payment_method || 'Cash';
                      const channelAccount = item.custom_fields?.bank_account_name || item.bank_account_name || item.custom_fields?.petty_cash_account_name || item.petty_cash_account_name || '';
                      const payeeName = item.custom_fields?.payee || item.vendor_name || item.vendor?.name || item.payee || '';
                      const invoiceNum = item.custom_fields?.invoice_number || item.reference_number || '';
                      const isRecurring = item.custom_fields?.recurring && item.custom_fields.recurring !== 'No';
                      const expenseTime = getExpenseTime(item);
                      const displayType = item.type || (item.job_order ? 'Project' : 'Operational');
                      const displayCategory = item.category || 'General';
                      const typeStyle = getTypeBadgeStyle(displayType, isDarkMode);
                      const cleanDescription = (item.description && item.description.trim() !== '0') 
                        ? item.description.trim() 
                        : (displayCategory !== 'General' ? `${displayCategory} Expense` : 'Operational Expense');

                      return (
                        <tr
                          key={item.id}
                          className="cred-table-row"
                          style={{
                            borderBottom: idx === sortedExpenses.length - 1 ? 'none' : '1px solid var(--border, #F1F5F9)'
                          }}
                        >
                          {/* Date & Time (Two-line cell: date ink, time muted) */}
                          <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                            <div className="cred-cell-2l">
                              <span className="cred-cell-2l__primary">
                                {formatDateDisplay(item.date)}
                              </span>
                              {expenseTime ? (
                                <span className="cred-cell-2l__secondary">
                                  {expenseTime}
                                </span>
                              ) : (invoiceNum || item.reference_number) ? (
                                <span className="cred-cell-2l__secondary cred-ref-code">
                                  {invoiceNum ? formatJobRef(invoiceNum) : formatJobRef(item.reference_number)}
                                </span>
                              ) : null}
                            </div>
                            {expenseTime && (invoiceNum || item.reference_number) ? (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                                {invoiceNum ? `inv ${formatJobRef(invoiceNum)}` : `ref ${formatJobRef(item.reference_number)}`}
                              </div>
                            ) : null}
                          </td>

                          {/* Type & Category (Two-line cell: type ink, category muted) */}
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <div className="cred-cell-2l">
                              <span className="cred-cell-2l__primary">
                                {displayType}
                              </span>
                              <span className="cred-cell-2l__secondary">
                                {displayCategory}
                              </span>
                            </div>
                          </td>

                          {/* Description & Particulars */}
                          <td style={{ padding: '0.75rem 0.85rem', maxWidth: '250px' }}>
                            <div 
                              style={{
                                fontWeight: 400,
                                color: 'var(--text, #0A0A0A)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }} 
                              title={cleanDescription}
                            >
                              {cleanDescription}
                            </div>
                            {item.notes && item.notes.trim() && (
                              <div 
                                style={{
                                  fontSize: '0.71rem',
                                  color: 'var(--text-muted, #8C8C8C)',
                                  marginTop: '2px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }} 
                                title={item.notes}
                              >
                                Note: {item.notes}
                              </div>
                            )}
                            {isRecurring && (
                              <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 600, marginTop: '2px' }}>
                                ↻ Recurring: {item.custom_fields.recurring}
                              </div>
                            )}
                            {item.created_by_name && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #8C8C8C)', opacity: 0.8, marginTop: '1px' }}>
                                Logged by: {item.created_by_name}
                              </div>
                            )}
                          </td>

                          {/* Payee / Vendor */}
                          <td style={{ padding: '0.75rem 0.85rem', whiteSpace: 'nowrap' }}>
                            {payeeName ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>{payeeName}</span>
                                {item.vendor && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', fontWeight: 500 }}>
                                    vendor
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>—</span>
                            )}
                          </td>

                          {/* Project / Job Order */}
                          <td style={{ padding: '0.75rem 0.85rem', maxWidth: '220px' }}>
                            {jobTitle ? (
                              <div 
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  color: isDarkMode ? '#93c5fd' : '#2563eb',
                                  fontWeight: 600,
                                  fontSize: '0.78rem'
                                }} 
                                title={`${jobId ? `[${jobId}] ` : ''}${jobTitle}`}
                              >
                                {jobId ? <span className="cred-ref-code" style={{ opacity: 0.85, fontWeight: 700, marginRight: '4px' }}>[{formatJobRef(jobId)}]</span> : null}
                                {jobTitle}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted, #8C8C8C)' }}>—</span>
                            )}
                          </td>

                          {/* Payment Channel (Reuse channel cell primitive) */}
                          <td style={{ padding: '0.75rem 0.85rem', whiteSpace: 'nowrap' }}>
                            <CredChannelCell channel={payMethod} account={channelAccount} />
                          </td>

                          {/* Amount (Negative red expense - amounts stay as they are) */}
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span 
                              style={{
                                fontSize: '0.96rem',
                                fontWeight: 800,
                                color: 'var(--danger, #dc2626)',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              - <Money value={item.amount} style={{ color: 'var(--danger, #dc2626)', fontWeight: 800 }} />
                            </span>
                          </td>

                          {/* Action (Delete uses CredRowIconButton) */}
                          <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>
                            <CredRowIconButton
                              tone="danger"
                              title="Delete expense"
                              ariaLabel="Delete expense"
                              onClick={() => onDeleteExpense(item.id)}
                            >
                              <Trash2 size={15} />
                            </CredRowIconButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. PAGINATION (Directly below table card, 16px gap, outside table card) */}
          <CredPagination
            page={expensePage}
            totalPages={totalExpensePages}
            rangeStart={expenseRangeStart}
            rangeEnd={expenseRangeEnd}
            total={totalExpenseCount}
            onPageChange={setExpensePage}
            isMobile={isMobile}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default CredExpensesView;
