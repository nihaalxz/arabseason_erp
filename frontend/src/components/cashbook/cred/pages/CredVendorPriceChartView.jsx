import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  ArrowLeft, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Building2, 
  Layers, 
  Tag, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Filter, 
  RefreshCw, 
  DollarSign,
  ChevronDown,
  X,
  FileText,
  BarChart2,
  Trash2
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

const COMMON_UNITS = [
  'pcs',
  'sq.m',
  'm',
  'sheet',
  'roll',
  'kg',
  'set',
  'box',
  'pack',
  'sq.ft',
  'liter',
  'hour',
  'day'
];

const CredVendorPriceChartView = ({
  isMobile = false,
  isDarkMode = false,
  onBack = () => {},
  onNavigate = () => {}
}) => {
  const [quoteRecords, setQuoteRecords] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [materialCategories, setMaterialCategories] = useState([]);
  const [jobOrders, setJobOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState('all');
  const [selectedMaterialFilter, setSelectedMaterialFilter] = useState('all');
  const [duration, setDuration] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [modalForm, setModalForm] = useState({
    material_id: '',
    custom_material_name: '',
    category_id: '',
    vendor_id: '',
    vendor_name: '',
    price: '',
    unit: 'pcs',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    job_order: ''
  });

  useEffect(() => {
    if (isModalOpen) {
      const cur = modalForm.unit || 'pcs';
      setIsCustomUnit(!COMMON_UNITS.includes(cur.toLowerCase()) && cur !== 'pcs');
    }
  }, [isModalOpen]);

  // Fetch initial data
  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [quotesRes, matRes, venRes, catRes, jobsRes] = await Promise.all([
        api.get('vendor-price-quotes/').catch(() => ({ data: [] })),
        api.get('materials/').catch(() => ({ data: [] })),
        api.get('vendors/').catch(() => ({ data: [] })),
        api.get('material-categories/').catch(() => ({ data: [] })),
        api.get('job-orders/').catch(() => ({ data: [] }))
      ]);

      const quotesData = quotesRes.data?.results || quotesRes.data || [];
      const matData = matRes.data?.results || matRes.data || [];
      const venData = venRes.data?.results || venRes.data || [];
      const catData = catRes.data?.results || catRes.data || [];
      const jobsData = jobsRes.data?.results || jobsRes.data || [];

      setQuoteRecords(Array.isArray(quotesData) ? quotesData : []);
      setMaterials(Array.isArray(matData) ? matData : []);
      setVendors(Array.isArray(venData) ? venData : []);
      setMaterialCategories(Array.isArray(catData) ? catData : []);
      setJobOrders(Array.isArray(jobsData) ? jobsData : []);
    } catch (err) {
      console.error('Error fetching vendor price chart data:', err);
      showError('Failed to load vendor price data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Extract all categories from both MaterialCategory table and price quotes
  const categories = useMemo(() => {
    const set = new Set();
    materialCategories.forEach(c => {
      if (c.name) set.add(c.name);
    });
    quoteRecords.forEach(q => {
      if (q.category_name) set.add(q.category_name);
    });
    return Array.from(set).sort();
  }, [quoteRecords, materialCategories]);

  // Normalize quotes from dedicated vendor-price-quotes table
  const allQuotes = useMemo(() => {
    // 1. Calculate lowest benchmark price per material
    const lowestByMaterial = {};
    quoteRecords.forEach(r => {
      const pNum = parseFloat(r.price || 0);
      const mKey = (r.material_name || '').trim().toLowerCase();
      if (pNum > 0 && mKey) {
        if (!lowestByMaterial[mKey] || pNum < lowestByMaterial[mKey]) {
          lowestByMaterial[mKey] = pNum;
        }
      }
    });

    const list = quoteRecords.map(r => {
      const pNum = parseFloat(r.price || 0);
      const mKey = (r.material_name || '').trim().toLowerCase();
      const quoteDate = r.date || (r.created_at ? r.created_at.substring(0, 10) : '2026-01-01');
      const isLowest = pNum > 0 && Math.abs(pNum - (lowestByMaterial[mKey] || 0)) < 0.01;

      return {
        id: r.id,
        materialId: String(r.id),
        materialName: r.material_name || 'Material',
        measurements: '',
        categoryName: r.category_name || 'General',
        customerPrice: 0,
        unit: r.unit || 'pcs',
        vendorName: r.vendor_name || 'Vendor',
        vendorId: r.vendor ? String(r.vendor) : '',
        price: pNum,
        isLowest: isLowest,
        date: quoteDate.substring(0, 10),
        notes: r.notes || '',
        jobOrder: r.job_order || ''
      };
    });

    // Sort newest date first
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [quoteRecords]);

  // Unique Materials present in quotes (for filter dropdown)
  const uniqueMaterialOptions = useMemo(() => {
    const set = new Set();
    allQuotes.forEach(q => {
      if (q.materialName) set.add(q.materialName);
    });
    return Array.from(set).sort();
  }, [allQuotes]);

  // Unique Vendors present in quotes (for filter dropdown)
  const uniqueVendorOptions = useMemo(() => {
    const set = new Set();
    allQuotes.forEach(q => {
      if (q.vendorName) set.add(q.vendorName);
    });
    return Array.from(set).sort();
  }, [allQuotes]);

  // Gooey menu options for Material and Vendor filters (clean titles without counts)
  const materialGooeyOptions = useMemo(() => [
    { value: 'all', label: 'All Materials', icon: Layers },
    ...uniqueMaterialOptions.map(m => ({ value: m, label: m, icon: Layers }))
  ], [uniqueMaterialOptions]);

  const vendorGooeyOptions = useMemo(() => [
    { value: 'all', label: 'All Vendors', icon: Building2 },
    ...uniqueVendorOptions.map(v => ({ value: v, label: v, icon: Building2 }))
  ], [uniqueVendorOptions]);

  // Duration Filter Calculation
  const filteredQuotes = useMemo(() => {
    const now = new Date();
    return allQuotes.filter(q => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = q.materialName.toLowerCase().includes(query);
        const matchVendor = q.vendorName.toLowerCase().includes(query);
        const matchSpecs = q.measurements.toLowerCase().includes(query);
        const matchNotes = q.notes.toLowerCase().includes(query);
        if (!matchName && !matchVendor && !matchSpecs && !matchNotes) return false;
      }

      // 2. Vendor Filter
      if (selectedVendorFilter !== 'all') {
        const target = selectedVendorFilter.toLowerCase();
        if (q.vendorName.toLowerCase() !== target && q.vendorId !== selectedVendorFilter) {
          return false;
        }
      }

      // 3. Material Filter
      if (selectedMaterialFilter !== 'all') {
        const target = selectedMaterialFilter.toLowerCase();
        if (q.materialName.toLowerCase() !== target) {
          return false;
        }
      }

      // 4. Duration Filter
      if (duration !== 'all') {
        const qDate = new Date(q.date);
        const diffMs = now - qDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (duration === '30d' && diffDays > 30) return false;
        if (duration === '90d' && diffDays > 90) return false;
        if (duration === '180d' && diffDays > 180) return false;
        if (duration === 'year' && qDate.getFullYear() !== now.getFullYear()) return false;
      }

      return true;
    });
  }, [allQuotes, searchQuery, selectedVendorFilter, selectedMaterialFilter, duration]);

  // Compute KPI Metrics
  const kpis = useMemo(() => {
    const uniqueMaterials = new Set(filteredQuotes.map(q => q.materialId)).size;
    const uniqueVendors = new Set(filteredQuotes.map(q => q.vendorName)).size;
    const prices = filteredQuotes.map(q => q.price);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

    return {
      totalMaterials: uniqueMaterials,
      totalQuotes: filteredQuotes.length,
      activeVendors: uniqueVendors,
      lowestPrice: minPrice,
      avgPrice: avgPrice
    };
  }, [filteredQuotes]);

  // Client-side pagination matching CredVendorsView
  const quoteResetKey = `${duration}_${selectedMaterialFilter}_${selectedVendorFilter}_${searchQuery}`;
  const {
    pageItems: pagedQuotes,
    page: quotePage,
    setPage: setQuotePage,
    totalPages: totalQuotePages,
    rangeStart: quoteRangeStart,
    rangeEnd: quoteRangeEnd,
    total: totalQuoteCount
  } = usePagination(filteredQuotes, isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP, quoteResetKey);

  // Handle Save New Vendor Price Quote
  const handleSavePriceQuote = async (e) => {
    e.preventDefault();
    if (!modalForm.price || parseFloat(modalForm.price) <= 0) {
      showError('Please enter a valid price amount');
      return;
    }
    if (!modalForm.vendor_name.trim()) {
      showError('Please select a vendor or supplier from the dropdown');
      return;
    }

    setIsSubmitting(true);
    try {
      let targetMat = materials.find(m => String(m.id) === String(modalForm.material_id));
      const matName = targetMat ? targetMat.name : (modalForm.custom_material_name.trim() || 'Material');
      const finalUnit = (modalForm.unit === '__custom__' || !modalForm.unit?.trim())
        ? (targetMat?.unit || 'pcs')
        : modalForm.unit.trim();

      let categoryName = 'General';
      if (modalForm.category_id) {
        const catObj = materialCategories.find(c => String(c.id) === String(modalForm.category_id));
        if (catObj) categoryName = catObj.name;
      } else if (targetMat) {
        categoryName = targetMat.category_name || (typeof targetMat.category === 'string' ? targetMat.category : 'General');
      }

      const payload = {
        vendor: modalForm.vendor_id ? parseInt(modalForm.vendor_id) : null,
        vendor_name: modalForm.vendor_name.trim(),
        material_name: matName,
        category_name: categoryName,
        price: parseFloat(modalForm.price),
        unit: finalUnit,
        date: modalForm.date || new Date().toISOString().split('T')[0],
        notes: modalForm.notes.trim(),
        job_order: modalForm.job_order ? modalForm.job_order.trim() : ''
      };

      await api.post('vendor-price-quotes/', payload);

      showSuccess('Vendor price quote recorded successfully');
      setIsModalOpen(false);
      setIsCustomUnit(false);
      setModalForm({
        material_id: '',
        custom_material_name: '',
        category_id: '',
        vendor_id: '',
        vendor_name: '',
        price: '',
        unit: 'pcs',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        job_order: ''
      });
      fetchData(false);
    } catch (err) {
      console.error('Error saving vendor price:', err);
      showError('Failed to save vendor price quote');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Vendor Price Quote
  const handleDeletePriceQuote = async (quote) => {
    const confirmed = await showConfirm(
      'Delete Price Quote?',
      `Are you sure you want to remove the quote of SAR ${quote.price} for ${quote.materialName} (${quote.vendorName})?`,
      'Yes, Delete'
    );
    if (!confirmed) return;

    try {
      await api.delete(`vendor-price-quotes/${quote.id}/`);
      showSuccess('Quote record removed');
      fetchData(false);
    } catch (err) {
      console.error('Error deleting quote:', err);
      showError('Failed to remove quote record');
    }
  };

  return (
    <div 
      className="cred-page-container cred-vendor-price-chart-page" 
      style={{ 
        padding: isMobile ? '12px 14px 80px' : '20px 32px 60px', 
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        color: 'var(--text)' 
      }}
    >
      {/* 1. HEADER SECTION */}
      {isMobile ? (
        <div style={{ marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate('more') : onBack()}
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
              vendor price chart
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                id="btn-record-price-mobile"
                onClick={() => setIsModalOpen(true)}
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
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px' }}>
          <h1 
            style={{ 
              fontSize: '1.75rem', 
              fontWeight: 600, 
              margin: 0, 
              color: 'var(--text, #0A0A0A)', 
              letterSpacing: '-0.025em' 
            }}
          >
            Vendor Price Chart
          </h1>

          {/* Desktop Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              id="btn-record-price"
              onClick={() => setIsModalOpen(true)}
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
              <span>Record Price Quote</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. TOP KPI SUMMARY CARDS */}
      <CredCardCarousel 
        isMobile={isMobile}
        desktopGridColumns="repeat(4, 1fr)"
        style={{ marginBottom: '22px' }}
      >
        <MoneyCard
          label="MATERIALS TRACKED"
          value={kpis.totalMaterials}
          isCount={true}
          caption={`Across ${categories.length} categories`}
          icon={Layers}
          iconBg={isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}
          iconColor={isDarkMode ? '#ffffff' : '#0f172a'}
        />

        <MoneyCard
          label="HISTORICAL QUOTES"
          value={kpis.totalQuotes}
          isCount={true}
          caption={`From ${kpis.activeVendors} suppliers`}
          icon={Building2}
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
          caption="Best supplier benchmark"
          icon={TrendingDown}
          iconBg={isDarkMode ? 'rgba(22, 163, 74, 0.12)' : '#dcfce7'}
          iconColor="#16a34a"
        />

        <MoneyCard
          label="AVERAGE QUOTED RATE"
          value={
            <span style={{ fontWeight: 800 }}>
              {isMobile && formatCompactKpi(kpis.avgPrice) ? (
                <span className="cred-tnum">{formatCompactKpi(kpis.avgPrice)}</span>
              ) : (
                <Money value={kpis.avgPrice} currency="SAR" />
              )}
            </span>
          }
          caption="Mean material cost"
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
          {/* Material Filter: Non-gooey Dropdown */}
          <GooeyMenu
            id="vendor-chart-material-filter"
            value={selectedMaterialFilter}
            onSelect={(opt) => setSelectedMaterialFilter(opt.value || opt.id || opt)}
            onChange={(val) => setSelectedMaterialFilter(val)}
            options={materialGooeyOptions}
            width={isMobile ? '100%' : 170}
            pillHeight={36}
            gooey={false}
            className="case-preserve"
            ariaLabel="Filter materials"
          />

          {/* Vendor Filter: Non-gooey Dropdown */}
          <GooeyMenu
            id="vendor-chart-vendor-filter"
            value={selectedVendorFilter}
            onSelect={(opt) => setSelectedVendorFilter(opt.value || opt.id || opt)}
            onChange={(val) => setSelectedVendorFilter(val)}
            options={vendorGooeyOptions}
            width={isMobile ? '100%' : 160}
            pillHeight={36}
            gooey={false}
            className="case-preserve"
            ariaLabel="Filter vendors"
          />

          {/* Duration Date Filter: GooeyMenu Liquid Dropdown */}
          <GooeyMenu
            id="vendor-chart-date-filter"
            value={duration}
            onSelect={(opt) => setDuration(opt.value || opt.id || opt)}
            onChange={(val) => setDuration(val)}
            options={DURATION_OPTIONS}
            width={isMobile ? '100%' : 190}
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
            placeholder="Search price records..."
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

      {/* 4. HISTORICAL QUOTES TABLE / LIST */}
      {isLoading ? (
        <div 
          style={{
            background: 'var(--bg-panel, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '16px',
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--text-muted, #8C8C8C)'
          }}
        >
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading price records...</div>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div 
          style={{
            background: 'var(--bg-panel, #FFFFFF)',
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
              background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'var(--bg, #f1f5f9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              color: 'var(--text-muted, #8C8C8C)'
            }}
          >
            <Layers size={22} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text, #0A0A0A)', margin: '0 0 6px' }}>
            No price records found
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)', margin: '0 0 16px' }}>
            {searchQuery || selectedMaterialFilter !== 'all' || selectedVendorFilter !== 'all' || duration !== 'all'
              ? 'No quotes matching current filter selection'
              : 'Click "+ Record Price Quote" to log historical supplier rates'}
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              background: isDarkMode ? '#FFFFFF' : '#0A0A0A',
              color: isDarkMode ? '#0A0A0A' : '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              padding: '8px 16px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            + Record Price Quote
          </button>
        </div>
      ) : isMobile ? (
        /* MOBILE VIEW: CRED two-tier row layout matching CredVendorsView */
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
          {pagedQuotes.map((q, idx) => {
            const initialLetter = (q.vendorName || q.materialName || 'V').charAt(0).toUpperCase();

            return (
              <div key={q.id || idx} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Tier 1: Avatar | Material Name + Category/Specs | Quoted Rate */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 0 4px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <div 
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        border: isDarkMode ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--border, #E4E4E4)',
                        background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#fafafa',
                        color: isDarkMode ? '#FFFFFF' : '#0A0A0A',
                        fontWeight: 600,
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {initialLetter}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        color: 'var(--text, #0A0A0A)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.3
                      }}>
                        {q.materialName}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-muted, #8C8C8C)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ 
                          background: isDarkMode ? '#222' : '#F0F0F0', 
                          padding: '1px 6px', 
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 500
                        }}>
                          {q.categoryName}
                        </span>
                        {q.measurements && <span>{q.measurements}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Quoted Rate + Lowest Badge */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                    <div style={{ 
                      fontWeight: 700, 
                      fontSize: '14px', 
                      color: q.isLowest ? '#16a34a' : 'var(--text, #0A0A0A)',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      <Money value={q.price} currency="SAR" />
                    </div>
                    {q.isLowest ? (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#16a34a',
                        background: 'rgba(22, 163, 74, 0.12)',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        marginTop: '2px'
                      }}>
                        ★ Lowest Rate
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                        per {q.unit}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tier 2: 3 figures as quiet inline trio (inset 54px to align with text) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '8px',
                  padding: '6px 0 4px 54px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted, #8C8C8C)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: '2px'
                    }}>
                      Vendor
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: 500,
                      color: 'var(--text, #0A0A0A)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {q.vendorName}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted, #8C8C8C)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: '2px'
                    }}>
                      Unit
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: 500,
                      color: 'var(--text, #0A0A0A)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {q.unit}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted, #8C8C8C)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: '2px'
                    }}>
                      Date
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      fontWeight: 500,
                      color: 'var(--text-muted, #8C8C8C)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {q.date}
                    </div>
                  </div>
                </div>

                {/* Notes or Job Order & Delete Action */}
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
                    {q.jobOrder && (
                      <span style={{ fontWeight: 600, color: 'var(--text, #0A0A0A)', marginRight: '8px' }}>
                        Job: {q.jobOrder}
                      </span>
                    )}
                    {q.notes && <span>{q.notes}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePriceQuote(q)}
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
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
                </div>

                {/* Inset dashed separator */}
                <div style={{
                  marginLeft: '54px',
                  borderBottom: isDarkMode ? '1px dashed rgba(255,255,255,0.1)' : '1px dashed var(--border, #E4E4E4)',
                  marginTop: '6px'
                }} />
              </div>
            );
          })}

          {/* Mobile Pagination */}
          <CredPagination
            page={quotePage}
            totalPages={totalQuotePages}
            rangeStart={quoteRangeStart}
            rangeEnd={quoteRangeEnd}
            total={totalQuoteCount}
            onPageChange={setQuotePage}
            isMobile={true}
          />
        </div>
      ) : (
        /* DESKTOP VIEW: Table sized to match CredVendorsView */
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
                    <th style={{ ...headerCellStyle, width: '28%' }}>MATERIAL / SPECS</th>
                    <th style={{ ...headerCellStyle, width: '20%' }}>VENDOR / SUPPLIER</th>
                    <th style={{ ...headerCellStyle, width: '13%', textAlign: 'right' }}>QUOTED RATE</th>
                    <th style={{ ...headerCellStyle, width: '9%' }}>UNIT</th>
                    <th style={{ ...headerCellStyle, width: '11%' }}>QUOTE DATE</th>
                    <th style={{ ...headerCellStyle, width: '14%' }}>PROJECT / NOTES</th>
                    <th style={{ ...headerCellStyle, width: '5%', textAlign: 'center' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedQuotes.map((q) => (
                    <tr 
                      key={q.id} 
                      className="cred-table-row"
                      style={{
                        borderBottom: '1px solid var(--border, #E4E4E4)'
                      }}
                    >
                      {/* Material Name & Category */}
                      <td style={bodyCellStyle}>
                        <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text, #0A0A0A)' }}>{q.materialName}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted, #8C8C8C)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' }}>
                          <span style={{ 
                            background: isDarkMode ? '#1e2024' : '#f1f5f9', 
                            padding: '1px 6px', 
                            borderRadius: '4px',
                            fontWeight: 500
                          }}>
                            {q.categoryName}
                          </span>
                          {q.measurements && <span>{q.measurements}</span>}
                        </div>
                      </td>

                      {/* Vendor Name */}
                      <td style={bodyCellStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ 
                            width: '26px', 
                            height: '26px', 
                            borderRadius: '50%', 
                            background: isDarkMode ? '#1e2024' : '#e2e8f0', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            color: isDarkMode ? '#ffffff' : '#0f172a',
                            flexShrink: 0
                          }}>
                            {q.vendorName.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text, #0A0A0A)' }}>{q.vendorName}</span>
                        </div>
                      </td>

                      {/* Quoted Price */}
                      <td style={{ ...bodyCellStyle, textAlign: 'right' }}>
                        <div style={{ 
                          fontWeight: 700, 
                          fontSize: '13px', 
                          fontVariantNumeric: 'tabular-nums',
                          color: q.isLowest ? '#16a34a' : 'var(--text, #0A0A0A)' 
                        }}>
                          <Money value={q.price} currency="SAR" />
                        </div>
                        {q.isLowest && (
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

                      {/* Unit */}
                      <td style={{ ...bodyCellStyle, color: 'var(--text-muted, #8C8C8C)', fontSize: '12px' }}>
                        {q.unit}
                      </td>

                      {/* Date */}
                      <td style={{ ...bodyCellStyle, color: 'var(--text, #0A0A0A)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={11} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
                          <span>{q.date}</span>
                        </div>
                      </td>

                      {/* Job Order & Notes */}
                      <td style={{ ...bodyCellStyle, maxWidth: '200px' }}>
                        {q.jobOrder && (
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
                            Job: {q.jobOrder}
                          </div>
                        )}
                        {q.notes && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {q.notes}
                          </div>
                        )}
                        {!q.jobOrder && !q.notes && (
                          <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '12px' }}>—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ ...bodyCellStyle, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeletePriceQuote(q)}
                          title="Delete Quote Record"
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
            page={quotePage}
            totalPages={totalQuotePages}
            rangeStart={quoteRangeStart}
            rangeEnd={quoteRangeEnd}
            total={totalQuoteCount}
            onPageChange={setQuotePage}
            isMobile={false}
          />
        </>
      )}

      {/* 6. MODAL: RECORD VENDOR PRICE QUOTE */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '12px' : '16px'
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--bg-panel, #FFFFFF)',
              border: '1px solid var(--border, #E4E4E4)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '480px',
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: isMobile ? '20px 16px 24px' : '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              color: 'var(--text)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>Record Vendor Price Quote</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', margin: '2px 0 0' }}>Log material rates to compare supplier prices</p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePriceQuote} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Material Selection */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Select Material</label>
                <select
                  value={modalForm.material_id}
                  onChange={(e) => {
                    const mId = e.target.value;
                    const mat = materials.find(m => String(m.id) === String(mId));
                    const matUnit = mat ? (mat.unit || 'pcs') : modalForm.unit;
                    setIsCustomUnit(!COMMON_UNITS.includes((matUnit || '').toLowerCase()) && !!matUnit && matUnit !== 'pcs');
                    setModalForm(prev => ({
                      ...prev,
                      material_id: mId,
                      category_id: mat ? (mat.category || '') : prev.category_id,
                      unit: matUnit
                    }));
                  }}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--bg, #F9F9F9)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  <option value="">-- Choose existing material or enter new below --</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name} {m.measurements ? `(${m.measurements})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Fields for Newly Creating Materials */}
              {!modalForm.material_id && (
                <>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Or New Material Name</label>
                    <input
                      type="text"
                      value={modalForm.custom_material_name}
                      onChange={(e) => setModalForm(prev => ({ ...prev, custom_material_name: e.target.value }))}
                      placeholder="e.g. Acrylic Sheet 3mm White"
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border, #E4E4E4)',
                        background: 'var(--bg, #F9F9F9)',
                        color: 'var(--text)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Material Category Dropdown */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Material Category</label>
                    <select
                      value={modalForm.category_id}
                      onChange={(e) => setModalForm(prev => ({ ...prev, category_id: e.target.value }))}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border, #E4E4E4)',
                        background: 'var(--bg, #F9F9F9)',
                        color: 'var(--text)',
                        fontSize: '13px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">-- Select Material Category --</option>
                      {materialCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Vendor Selection */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Vendor / Supplier Name *</label>
                <select
                  value={modalForm.vendor_id}
                  onChange={(e) => {
                    const vId = e.target.value;
                    const ven = vendors.find(v => String(v.id) === String(vId));
                    setModalForm(prev => ({
                      ...prev,
                      vendor_id: vId,
                      vendor_name: ven ? ven.name : ''
                    }));
                  }}
                  required
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--bg, #F9F9F9)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">-- Select Vendor / Supplier --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              {/* Price & Unit & Date */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Rate (SAR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={modalForm.price}
                    onChange={(e) => setModalForm(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="0.00"
                    required
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border, #E4E4E4)',
                      background: 'var(--bg, #F9F9F9)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Unit</label>
                  <select
                    value={
                      isCustomUnit
                        ? '__custom__'
                        : (COMMON_UNITS.includes((modalForm.unit || '').toLowerCase())
                            ? (modalForm.unit || '').toLowerCase()
                            : (modalForm.unit ? modalForm.unit : 'pcs'))
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__custom__') {
                        setIsCustomUnit(true);
                      } else {
                        setIsCustomUnit(false);
                        setModalForm(prev => ({ ...prev, unit: val }));
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border, #E4E4E4)',
                      background: 'var(--bg, #F9F9F9)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {modalForm.unit &&
                      !COMMON_UNITS.includes((modalForm.unit || '').toLowerCase()) &&
                      modalForm.unit !== '__custom__' &&
                      !isCustomUnit && (
                        <option value={modalForm.unit}>{modalForm.unit}</option>
                    )}
                    {COMMON_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    <option value="__custom__">Other...</option>
                  </select>

                  {isCustomUnit && (
                    <input
                      type="text"
                      value={modalForm.unit === '__custom__' ? '' : modalForm.unit}
                      onChange={(e) => setModalForm(prev => ({ ...prev, unit: e.target.value }))}
                      placeholder="Type custom unit (e.g. cylinder, spool)"
                      autoFocus
                      style={{
                        marginTop: '6px',
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border, #E4E4E4)',
                        background: 'var(--bg, #F9F9F9)',
                        color: 'var(--text)',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                    />
                  )}
                </div>

                <div style={{ gridColumn: isMobile ? 'span 2' : 'auto' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Quote Date</label>
                  <input
                    type="date"
                    value={modalForm.date}
                    onChange={(e) => setModalForm(prev => ({ ...prev, date: e.target.value }))}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border, #E4E4E4)',
                      background: 'var(--bg, #F9F9F9)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>


              {/* Notes */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Notes / Quotation Terms</label>
                <input
                  type="text"
                  value={modalForm.notes}
                  onChange={(e) => setModalForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Includes delivery, 10-day validity, MOQ 10 units"
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--bg, #F9F9F9)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    height: '38px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'transparent',
                    color: 'var(--text)',
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
                    height: '38px',
                    padding: '0 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--text, #0A0A0A)',
                    color: 'var(--bg, #FFFFFF)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                >
                  {isSubmitting ? 'Saving...' : 'Save Quote Record'}
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

export default CredVendorPriceChartView;
