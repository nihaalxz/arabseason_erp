import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Building2, 
  Briefcase, 
  Tag, 
  Clock, 
  Filter, 
  RefreshCw, 
  X, 
  FileText, 
  Trash2, 
  Users, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  FolderOpen,
  Layers,
  Phone
} from 'lucide-react';
import api from '../../../../api';
import Money from '../Money';
import GooeyMenu from '../GooeyMenu';
import MoneyCard from '../MoneyCard';
import CredCardCarousel from '../CredCardCarousel';
import CredPagination from '../CredPagination';
import { usePagination, PAGE_SIZE_DESKTOP, PAGE_SIZE_MOBILE, formatCompactKpi } from '../usePagination';
import { showToast, showError, showSuccess, showConfirm } from '../../../../utils/swal';

const DURATION_OPTIONS = [
  { value: 'all', id: 'all', label: 'all time', icon: Calendar },
  { value: '30d', id: '30d', label: 'last 30 days', icon: Calendar },
  { value: '90d', id: '90d', label: 'last 90 days', icon: Calendar },
  { value: '180d', id: '180d', label: 'last 6 months', icon: Calendar },
  { value: 'year', id: 'year', label: 'this year', icon: Calendar }
];

const WORK_CATEGORIES = [
  'Interior Designing',
  'Sticker Work',
  'Electrical',
  'Plumbing',
  'Carpentry & Woodwork',
  'Glass & Aluminium',
  'Steel & Metal Fabrication',
  'Painting & Finishing',
  'HVAC & AC Work',
  'Gypsum & Ceiling',
  'General Maintenance',
  'Other / Custom'
];

const CredCustomerChartView = ({
  isMobile = false,
  isDarkMode = false,
  onBack = () => {},
  onNavigate = () => {}
}) => {
  const [workRecords, setWorkRecords] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [duration, setDuration] = useState('all');

  // Modal State for Recording Customer Work
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalForm, setModalForm] = useState({
    customer_id: '',
    customer_name: '',
    work_category: 'Interior Designing',
    custom_category: '',
    work: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Fetch initial data
  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [worksRes, custRes] = await Promise.all([
        api.get('customer-work-records/').catch(() => ({ data: [] })),
        api.get('customers/?limit=500').catch(() => ({ data: [] }))
      ]);

      const worksData = worksRes.data?.results || worksRes.data || [];
      const custData = custRes.data?.results || custRes.data || [];

      setWorkRecords(Array.isArray(worksData) ? worksData : []);
      setCustomers(Array.isArray(custData) ? custData : []);
    } catch (err) {
      console.error('Error fetching customer work records:', err);
      showError('Failed to load customer work records');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Normalise flat list of work records with lowest rate benchmark per category
  const allRecords = useMemo(() => {
    // 1. Calculate minimum benchmark per work category
    const lowestByCategory = {};
    workRecords.forEach(r => {
      const amt = parseFloat(r.amount || 0);
      const cat = (r.work_category || 'General Work').trim();
      if (amt > 0) {
        if (!lowestByCategory[cat] || amt < lowestByCategory[cat]) {
          lowestByCategory[cat] = amt;
        }
      }
    });

    const list = workRecords.map(r => {
      const amt = parseFloat(r.amount || 0);
      const cat = (r.work_category || 'General Work').trim();
      const recordDate = r.date || (r.created_at ? r.created_at.substring(0, 10) : '2026-01-01');
      const isLowest = amt > 0 && Math.abs(amt - (lowestByCategory[cat] || 0)) < 0.01;

      return {
        id: r.id,
        customerId: r.customer ? String(r.customer) : '',
        customerName: (r.customer_name || 'Customer').trim(),
        workCategory: cat,
        work: (r.work || '').trim(),
        amount: amt,
        isLowest: isLowest,
        date: recordDate.substring(0, 10),
        notes: (r.notes || '').trim(),
        customerCompany: r.customer_company || '',
        customerPhone: r.customer_phone || '',
        created_at: r.created_at
      };
    });

    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [workRecords]);

  // Unique Customer Options present in recorded works for filter dropdown
  const uniqueCustomerOptions = useMemo(() => {
    const set = new Set();
    allRecords.forEach(r => {
      if (r.customerName) set.add(r.customerName);
    });
    return Array.from(set).sort();
  }, [allRecords]);

  // Unique Work Categories present in recorded works for filter dropdown
  const uniqueCategoryOptions = useMemo(() => {
    const set = new Set();
    allRecords.forEach(r => {
      if (r.workCategory) set.add(r.workCategory);
    });
    return Array.from(set).sort();
  }, [allRecords]);

  // Gooey menu options for Category and Customer filters (clean titles without counts)
  const categoryGooeyOptions = useMemo(() => [
    { value: 'all', label: 'All Categories', icon: Layers },
    ...uniqueCategoryOptions.map(cat => ({ value: cat, label: cat, icon: Layers }))
  ], [uniqueCategoryOptions]);

  const customerGooeyOptions = useMemo(() => [
    { value: 'all', label: 'All Customers', icon: Building2 },
    ...uniqueCustomerOptions.map(c => ({ value: c, label: c, icon: Building2 }))
  ], [uniqueCustomerOptions]);

  // Filtered Records based on search, customer selection, category, duration
  const filteredRecords = useMemo(() => {
    const now = new Date();
    return allRecords.filter(r => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = r.customerName.toLowerCase().includes(query);
        const matchCategory = r.workCategory.toLowerCase().includes(query);
        const matchWork = r.work.toLowerCase().includes(query);
        const matchNotes = r.notes.toLowerCase().includes(query);
        const matchCompany = (r.customerCompany || '').toLowerCase().includes(query);
        const matchPhone = (r.customerPhone || '').includes(query);
        if (!matchName && !matchCategory && !matchWork && !matchNotes && !matchCompany && !matchPhone) return false;
      }

      // 2. Customer Filter
      if (selectedCustomerFilter !== 'all') {
        if (r.customerName.toLowerCase() !== selectedCustomerFilter.toLowerCase()) {
          return false;
        }
      }

      // 3. Category Filter
      if (selectedCategoryFilter !== 'all') {
        if (r.workCategory.toLowerCase() !== selectedCategoryFilter.toLowerCase()) {
          return false;
        }
      }

      // 4. Duration Filter
      if (duration !== 'all') {
        const rDate = new Date(r.date);
        const diffMs = now - rDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (duration === '30d' && diffDays > 30) return false;
        if (duration === '90d' && diffDays > 90) return false;
        if (duration === '180d' && diffDays > 180) return false;
        if (duration === 'year' && rDate.getFullYear() !== now.getFullYear()) return false;
      }

      return true;
    });
  }, [allRecords, searchQuery, selectedCustomerFilter, selectedCategoryFilter, duration]);

  // Compute KPI Metrics matching CredLabourChartView and CredVendorPriceChartView
  const kpis = useMemo(() => {
    const categorySet = new Set();
    const customerSet = new Set();
    let totalAmt = 0;
    let validCount = 0;
    let minAmt = Infinity;
    let lowestCustomer = '';
    let lowestCategory = '';

    filteredRecords.forEach(r => {
      if (r.workCategory) categorySet.add(r.workCategory);
      if (r.customerName) customerSet.add(r.customerName);

      if (r.amount > 0) {
        totalAmt += r.amount;
        validCount += 1;
        if (r.amount < minAmt) {
          minAmt = r.amount;
          lowestCustomer = r.customerName;
          lowestCategory = r.workCategory;
        }
      }
    });

    return {
      categoryCount: categorySet.size,
      worksCount: filteredRecords.length,
      customerCount: customerSet.size,
      totalAmount: totalAmt,
      lowestPrice: minAmt === Infinity ? 0 : minAmt,
      lowestCustomer,
      lowestCategory,
      avgPrice: validCount > 0 ? Math.round((totalAmt / validCount) * 100) / 100 : 0
    };
  }, [filteredRecords]);

  // Client-side pagination matching CRED design
  const paginationResetKey = `${duration}_${selectedCustomerFilter}_${selectedCategoryFilter}_${searchQuery}`;
  const {
    pageItems: pagedRecords,
    page: currentPage,
    setPage: setCurrentPage,
    totalPages: totalPagesCount,
    rangeStart,
    rangeEnd,
    total: totalRecordsCount
  } = usePagination(filteredRecords, isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP, paginationResetKey);

  // Open modal with fresh state
  const handleOpenModal = () => {
    setModalForm({
      customer_id: customers[0]?.id ? String(customers[0].id) : '',
      customer_name: customers[0]?.name || '',
      work_category: 'Interior Designing',
      custom_category: '',
      work: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setIsModalOpen(true);
  };

  // Handle Save New Customer Work Record
  const handleSaveWorkRecord = async (e) => {
    e.preventDefault();
    if (!modalForm.customer_name.trim()) {
      showError('Please select a customer from the dropdown');
      return;
    }

    const finalCategory = modalForm.work_category === 'Other / Custom'
      ? (modalForm.custom_category.trim() || 'General Work')
      : modalForm.work_category;

    if (!finalCategory.trim()) {
      showError('Please select or specify a work category');
      return;
    }

    if (!modalForm.work.trim()) {
      showError('Please enter a description of the work done');
      return;
    }

    const amtNum = parseFloat(modalForm.amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      showError('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customer: modalForm.customer_id ? parseInt(modalForm.customer_id) : null,
        customer_name: modalForm.customer_name.trim(),
        work_category: finalCategory.trim(),
        work: modalForm.work.trim(),
        amount: amtNum,
        date: modalForm.date || new Date().toISOString().split('T')[0],
        notes: modalForm.notes.trim()
      };

      await api.post('customer-work-records/', payload);

      showSuccess('Customer work recorded successfully');
      setIsModalOpen(false);
      setModalForm({
        customer_id: '',
        customer_name: '',
        work_category: 'Interior Designing',
        custom_category: '',
        work: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchData(false);
    } catch (err) {
      console.error('Error saving customer work record:', err);
      showError('Failed to record customer work');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Work Record
  const handleDeleteWorkRecord = async (record) => {
    const confirmed = await showConfirm(
      'Delete Work Record?',
      `Are you sure you want to remove "${record.work}" for ${record.customerName} (${record.workCategory})?`,
      'Yes, Delete'
    );
    if (!confirmed) return;

    try {
      await api.delete(`customer-work-records/${record.id}/`);
      showSuccess('Work record removed');
      fetchData(false);
    } catch (err) {
      console.error('Error deleting work record:', err);
      showError('Failed to remove work record');
    }
  };

  return (
    <div 
      className="cred-page-container cred-customer-chart-page" 
      style={{ 
        padding: isMobile ? '12px 14px 80px' : '20px 32px 60px', 
        maxWidth: '1440px', 
        margin: '0 auto', 
        width: '100%',
        boxSizing: 'border-box',
        color: 'var(--text)'
      }}
    >
      {/* 1. TOP HEADER */}
      {isMobile ? (
        <div style={{ marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => onBack ? onBack() : onNavigate && onNavigate('more')}
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
              customer chart
            </h1>
            <button
              type="button"
              id="btn-record-work-mobile"
              onClick={handleOpenModal}
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
              <span>Record</span>
            </button>
          </div>
        </div>
      ) : (
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            gap: '12px'
          }}
        >
          <h1 
            style={{
              fontSize: '1.75rem',
              fontWeight: 600,
              margin: 0,
              color: 'var(--text, #0A0A0A)',
              letterSpacing: '-0.025em'
            }}
          >
            Customer Chart
          </h1>

          <button
            type="button"
            id="btn-record-work"
            onClick={handleOpenModal}
            style={{
              background: isDarkMode ? '#FFFFFF' : '#0A0A0A',
              color: isDarkMode ? '#0A0A0A' : '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: isDarkMode ? '0 2px 12px rgba(255,255,255,0.1)' : '0 2px 10px rgba(15,23,42,0.14)',
              transition: 'transform 0.15s ease, opacity 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Record Customer Work</span>
          </button>
        </div>
      )}

      {/* 2. TOP METRIC CARDS (CredCardCarousel & MoneyCard) */}
      <CredCardCarousel 
        isMobile={isMobile}
        desktopGridColumns="repeat(4, 1fr)"
        style={{ marginBottom: '22px' }}
      >
        <MoneyCard
          label="CATEGORIES TRACKED"
          value={kpis.categoryCount}
          isCount={true}
          caption={`Across ${kpis.worksCount} works logged`}
          icon={Layers}
          iconBg={isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}
          iconColor={isDarkMode ? '#ffffff' : '#0f172a'}
        />

        <MoneyCard
          label="HISTORICAL WORKS"
          value={kpis.worksCount}
          isCount={true}
          caption={`From ${kpis.customerCount} customers`}
          icon={Briefcase}
          iconBg={isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}
          iconColor={isDarkMode ? '#ffffff' : '#0f172a'}
        />

        <MoneyCard
          label="LOWEST RATE FOUND"
          value={
            <span style={{ color: '#16a34a', fontWeight: 800 }}>
              {isMobile && formatCompactKpi(kpis.lowestPrice) ? (
                <span className="cred-tnum">{formatCompactKpi(kpis.lowestPrice)}</span>
              ) : (
                <Money value={kpis.lowestPrice} currency="SAR" />
              )}
            </span>
          }
          caption={kpis.lowestCustomer ? `${kpis.lowestCustomer} (${kpis.lowestCategory})` : 'Best work benchmark'}
          icon={TrendingDown}
          iconBg={isDarkMode ? 'rgba(22, 163, 74, 0.12)' : '#dcfce7'}
          iconColor="#16a34a"
        />

        <MoneyCard
          label="AVERAGE WORK VALUE"
          value={
            <span style={{ fontWeight: 800 }}>
              {isMobile && formatCompactKpi(kpis.avgPrice) ? (
                <span className="cred-tnum">{formatCompactKpi(kpis.avgPrice)}</span>
              ) : (
                <Money value={kpis.avgPrice} currency="SAR" />
              )}
            </span>
          }
          caption="Mean customer charge"
          icon={TrendingUp}
          iconBg={isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}
          iconColor={isDarkMode ? '#ffffff' : '#0f172a'}
        />
      </CredCardCarousel>

      {/* 3. FILTER & SEARCH BAR */}
      <div 
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
          position: 'relative',
          zIndex: 40,
          overflow: 'visible'
        }}
      >
        {/* Left: Filter Dropdowns & Date Filter */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            flex: 1,
            minWidth: 0,
            position: 'relative',
            zIndex: 50,
            overflow: 'visible'
          }}
        >
          {/* Work Category Filter: Non-gooey Dropdown */}
          <GooeyMenu
            id="customer-chart-category-filter"
            value={selectedCategoryFilter}
            onSelect={(opt) => setSelectedCategoryFilter(opt.value || opt.id || opt)}
            onChange={(val) => setSelectedCategoryFilter(val)}
            options={categoryGooeyOptions}
            width={isMobile ? '100%' : 180}
            pillHeight={36}
            gooey={false}
            className="case-preserve"
            ariaLabel="Filter categories"
          />

          {/* Customer Filter: Non-gooey Dropdown */}
          <GooeyMenu
            id="customer-chart-customer-filter"
            value={selectedCustomerFilter}
            onSelect={(opt) => setSelectedCustomerFilter(opt.value || opt.id || opt)}
            onChange={(val) => setSelectedCustomerFilter(val)}
            options={customerGooeyOptions}
            width={isMobile ? '100%' : 175}
            pillHeight={36}
            gooey={false}
            className="case-preserve"
            ariaLabel="Filter customers"
          />

          {/* Duration Date Filter: GooeyMenu Liquid Dropdown */}
          <GooeyMenu
            id="customer-chart-date-filter"
            value={duration}
            onSelect={(opt) => setDuration(opt.value || opt.id || opt)}
            onChange={(val) => setDuration(val)}
            options={DURATION_OPTIONS}
            width={isMobile ? '100%' : 145}
            pillHeight={36}
            ariaLabel="Filter date range"
          />

        </div>

        {/* Right: Search Bar */}
        <div 
          style={{
            position: 'relative',
            width: isMobile ? '100%' : '280px',
            flexShrink: 0
          }}
        >
          <Search 
            size={15} 
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted, #8C8C8C)',
              pointerEvents: 'none'
            }} 
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer work..."
            style={{
              width: '100%',
              height: '36px',
              padding: '0 30px 0 34px',
              borderRadius: '12px',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--border, #E4E4E4)',
              background: 'var(--bg, #FFFFFF)',
              color: 'var(--text, #0A0A0A)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #8C8C8C)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 4. TABLE / CONTENT SECTION */}
      {isLoading ? (
        <div 
          style={{
            background: 'var(--bg, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '16px',
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--text-muted, #8C8C8C)'
          }}
        >
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading customer works history...</div>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div 
          style={{
            background: 'var(--bg, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '16px',
            padding: '54px 24px',
            textAlign: 'center'
          }}
        >
          <div 
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--bg-panel, #f1f5f9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              color: 'var(--text-muted, #8C8C8C)'
            }}
          >
            <Briefcase size={22} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text, #0A0A0A)', margin: '0 0 6px' }}>
            No customer works found
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)', margin: '0 0 16px' }}>
            {searchQuery || selectedCategoryFilter !== 'all' || selectedCustomerFilter !== 'all' || duration !== 'all'
              ? 'No works matching current filter selection'
              : 'Click "+ Record Customer Work" to log previous work completed for customers'}
          </p>
          <button
            type="button"
            onClick={handleOpenModal}
            style={{
              background: isDarkMode ? '#FFFFFF' : '#0A0A0A',
              color: isDarkMode ? '#0A0A0A' : '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              padding: '8px 16px',
              fontWeight: 500,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            + Record Customer Work
          </button>
        </div>
      ) : isMobile ? (
          /* MOBILE TWO-TIER WORK CARDS */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {pagedRecords.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: '12px 0 10px',
                  background: 'transparent',
                  position: 'relative'
                }}
              >
                {/* Tier 1: Avatar + Customer / Category + Quoted Amount / Badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: isDarkMode ? '#1e2024' : '#e2e8f0',
                      color: 'var(--text, #0A0A0A)',
                      fontWeight: '700',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {(r.customerName || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text, #0A0A0A)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.customerName}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: 'var(--bg, #F4F4F5)',
                          border: '1px solid var(--border, #E4E4E4)',
                          color: 'var(--text, #0A0A0A)'
                        }}>
                          {r.workCategory}
                        </span>
                      </div>
                      {r.customerCompany && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Building2 size={10} />
                          <span>{r.customerCompany}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: r.isLowest ? '#16a34a' : 'var(--text, #0A0A0A)' }}>
                      <Money value={r.amount} currency="SAR" />
                    </div>
                    {r.isLowest && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#16a34a',
                        background: 'rgba(22, 163, 74, 0.1)',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        display: 'inline-block',
                        marginTop: '2px'
                      }}>
                        ★ Lowest Rate
                      </span>
                    )}
                  </div>
                </div>

                {/* Tier 2: Quiet inline trio (inset 54px to align with text) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '8px',
                  padding: '6px 0 4px 54px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted, #8C8C8C)', marginBottom: '2px' }}>
                      Work Done
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text, #0A0A0A)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.work}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted, #8C8C8C)', marginBottom: '2px' }}>
                      Category
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text, #0A0A0A)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.workCategory}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted, #8C8C8C)', marginBottom: '2px' }}>
                      Date
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.date}
                    </div>
                  </div>
                </div>

                {/* Notes & Delete Action */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '2px 0 6px 54px',
                  fontSize: '11px',
                  color: 'var(--text-muted, #8C8C8C)'
                }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {r.notes ? <span>{r.notes}</span> : <span style={{ opacity: 0.5 }}>—</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteWorkRecord(r)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '11px'
                    }}
                    title="Delete work record"
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
                </div>

                {/* Inset dashed hairline divider */}
                <div style={{
                  marginLeft: '54px',
                  marginTop: '6px',
                  borderBottom: isDarkMode ? '1px dashed rgba(255,255,255,0.08)' : '1px dashed rgba(0,0,0,0.08)'
                }} />
              </div>
            ))}

            <CredPagination
              page={currentPage}
              totalPages={totalPagesCount}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              total={totalRecordsCount}
              onPageChange={setCurrentPage}
              isMobile={true}
            />
          </div>
        ) : (
          /* DESKTOP TABLE: Sized to match CredCustomersView */
          <>
            <div 
              style={{
                background: 'var(--bg, #FFFFFF)',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: isDarkMode ? 'none' : '0 2px 10px rgba(0,0,0,0.02)',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ width: '100%', overflowX: isMobile ? 'auto' : 'hidden' }}>
                <table 
                  style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse', 
                    textAlign: 'left',
                    tableLayout: 'auto'
                  }}
                >
                  <thead>
                    <tr 
                      style={{
                        borderBottom: '1px solid var(--border, #E4E4E4)',
                        background: isDarkMode ? '#141517' : '#f8fafc'
                      }}
                    >
                      <th style={{ ...headerCellStyle, width: '22%' }}>CUSTOMER</th>
                      <th style={{ ...headerCellStyle, width: '16%' }}>WORK CATEGORY</th>
                      <th style={{ ...headerCellStyle, width: '24%' }}>WORK DESCRIPTION</th>
                      <th style={{ ...headerCellStyle, width: '13%', textAlign: 'right' }}>AMOUNT</th>
                      <th style={{ ...headerCellStyle, width: '11%' }}>WORK DATE</th>
                      <th style={{ ...headerCellStyle, width: '9%' }}>NOTES / SCOPE</th>
                      <th style={{ ...headerCellStyle, width: '5%', textAlign: 'center' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRecords.map((r) => (
                      <tr 
                        key={r.id}
                        className="cred-table-row"
                        style={{
                          borderBottom: '1px solid var(--border, #E4E4E4)'
                        }}
                      >
                        {/* Customer Name & Contact */}
                        <td style={bodyCellStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              background: isDarkMode ? '#1e2024' : '#e2e8f0',
                              color: isDarkMode ? '#ffffff' : '#0f172a',
                              fontWeight: 700,
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {(r.customerName || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{
                                fontWeight: 500,
                                fontSize: '13px',
                                color: 'var(--text, #0A0A0A)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '180px'
                              }} title={r.customerName}>
                                {r.customerName}
                              </div>
                              {r.customerCompany && (
                                <div style={{
                                  fontSize: '10.5px',
                                  color: 'var(--text-muted, #8C8C8C)',
                                  marginTop: '1px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '180px'
                                }}>
                                  {r.customerCompany}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Work Category */}
                        <td style={bodyCellStyle}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: 500,
                            background: isDarkMode ? '#1e2024' : '#f1f5f9',
                            border: '1px solid var(--border, #E4E4E4)',
                            color: 'var(--text, #0A0A0A)'
                          }}>
                            <Briefcase size={11} style={{ color: 'var(--text-muted, #71717A)' }} />
                            <span>{r.workCategory}</span>
                          </span>
                        </td>

                        {/* Work Description */}
                        <td style={bodyCellStyle}>
                          <div style={{
                            fontWeight: 500,
                            fontSize: '13px',
                            color: 'var(--text, #0A0A0A)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '260px'
                          }} title={r.work}>
                            {r.work}
                          </div>
                        </td>

                        {/* Amount */}
                        <td style={{ ...bodyCellStyle, textAlign: 'right' }}>
                          <div style={{
                            fontWeight: 700,
                            fontSize: '13px',
                            fontVariantNumeric: 'tabular-nums',
                            color: r.isLowest ? '#16a34a' : 'var(--text, #0A0A0A)'
                          }}>
                            <Money value={r.amount} currency="SAR" />
                          </div>
                          {r.isLowest && (
                            <span style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              color: '#16a34a',
                              background: 'rgba(22, 163, 74, 0.1)',
                              padding: '1px 6px',
                              borderRadius: '999px',
                              display: 'inline-block',
                              marginTop: '1px'
                            }}>
                              ★ Lowest
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td style={{ ...bodyCellStyle, color: 'var(--text, #0A0A0A)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={11} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
                            <span>{r.date}</span>
                          </div>
                        </td>

                        {/* Notes / Scope */}
                        <td style={{ ...bodyCellStyle, maxWidth: '200px' }}>
                          <div style={{
                            fontSize: '12px',
                            color: 'var(--text-muted, #8C8C8C)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }} title={r.notes}>
                            {r.notes || '—'}
                          </div>
                        </td>

                        {/* Action */}
                        <td style={{ ...bodyCellStyle, textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteWorkRecord(r)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted, #8C8C8C)',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'; }}
                            title="Delete work record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Desktop Pagination */}
            <CredPagination
              page={currentPage}
              totalPages={totalPagesCount}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              total={totalRecordsCount}
              onPageChange={setCurrentPage}
              isMobile={false}
            />
          </>
        )}

      {/* 5. MODAL: RECORD CUSTOMER WORK */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setIsModalOpen(false);
          }}
        >
          <div 
            style={{
              background: 'var(--bg-panel, #FFFFFF)',
              border: '1px solid var(--border, #E4E4E4)',
              borderRadius: '20px',
              maxWidth: '520px',
              width: '100%',
              padding: isMobile ? '20px 16px' : '26px 28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              boxSizing: 'border-box',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text, #0A0A0A)' }}>
                  Record Work Done
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>
                  Log previous work completed for a customer
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                disabled={isSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted, #8C8C8C)',
                  padding: '4px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveWorkRecord} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Field 1: Customer (Dropdown only) */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #0A0A0A)', display: 'block', marginBottom: '6px' }}>
                  Customer *
                </label>
                <select
                  value={modalForm.customer_id}
                  onChange={(e) => {
                    const cId = e.target.value;
                    const cust = customers.find(c => String(c.id) === String(cId));
                    setModalForm(prev => ({
                      ...prev,
                      customer_id: cId,
                      customer_name: cust ? cust.name : ''
                    }));
                  }}
                  required
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--bg, #F9F9F9)',
                    color: 'var(--text, #0A0A0A)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.company_name ? ` (${c.company_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 2: Work Category (Dropdown with Custom option) */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #0A0A0A)', display: 'block', marginBottom: '6px' }}>
                  Work Category *
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <select
                    value={modalForm.work_category}
                    onChange={(e) => setModalForm(prev => ({ ...prev, work_category: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border, #E4E4E4)',
                      background: 'var(--bg, #F9F9F9)',
                      color: 'var(--text, #0A0A0A)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    {WORK_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  {modalForm.work_category === 'Other / Custom' && (
                    <input
                      type="text"
                      placeholder="Type custom work category..."
                      value={modalForm.custom_category}
                      onChange={(e) => setModalForm(prev => ({ ...prev, custom_category: e.target.value }))}
                      required
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 12px',
                        borderRadius: '10px',
                        border: '1px solid var(--border, #E4E4E4)',
                        background: 'var(--bg, #F9F9F9)',
                        color: 'var(--text, #0A0A0A)',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Field 3: Work Description (Text field) */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #0A0A0A)', display: 'block', marginBottom: '6px' }}>
                  Work Done Description *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3D interior design mockups, reception wall branding, sticker pasting, etc."
                  value={modalForm.work}
                  onChange={(e) => setModalForm(prev => ({ ...prev, work: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--bg, #F9F9F9)',
                    color: 'var(--text, #0A0A0A)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Field 4 & 5: Amount & Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #0A0A0A)', display: 'block', marginBottom: '6px' }}>
                    Amount (SAR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={modalForm.amount}
                    onChange={(e) => setModalForm(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border, #E4E4E4)',
                      background: 'var(--bg, #F9F9F9)',
                      color: 'var(--text, #0A0A0A)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #0A0A0A)', display: 'block', marginBottom: '6px' }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    value={modalForm.date}
                    onChange={(e) => setModalForm(prev => ({ ...prev, date: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border, #E4E4E4)',
                      background: 'var(--bg, #F9F9F9)',
                      color: 'var(--text, #0A0A0A)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Field 6: Notes / Scope (Optional) */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #0A0A0A)', display: 'block', marginBottom: '6px' }}>
                  Scope / Project Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional specifications, site location, terms, etc."
                  value={modalForm.notes}
                  onChange={(e) => setModalForm(prev => ({ ...prev, notes: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--bg, #F9F9F9)',
                    color: 'var(--text, #0A0A0A)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '999px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'transparent',
                    color: 'var(--text, #0A0A0A)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '999px',
                    border: 'none',
                    background: 'var(--text, #0A0A0A)',
                    color: 'var(--bg, #FFFFFF)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Work Record</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const headerCellStyle = {
  padding: '10px 8px',
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--text-muted, #8C8C8C)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap'
};

const bodyCellStyle = {
  padding: '9px 8px',
  verticalAlign: 'middle',
  fontSize: '13px'
};

export default CredCustomerChartView;
