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
  BarChart2
} from 'lucide-react';
import api from '../../../../api';
import Money from '../Money';
import CredAnimatedTabs from '../CredAnimatedTabs';
import MoneyCard from '../MoneyCard';
import CredCardCarousel from '../CredCardCarousel';
import CredPagination from '../CredPagination';
import { usePagination, PAGE_SIZE_DESKTOP, PAGE_SIZE_MOBILE, formatCompactKpi } from '../usePagination';
import { showToast, showError, showSuccess } from '../../../../utils/swal';

const DURATION_TABS = [
  { id: 'all', label: 'all time' },
  { id: '30d', label: 'last 30 days' },
  { id: '90d', label: 'last 90 days' },
  { id: '180d', label: 'last 6 months' },
  { id: 'year', label: 'this year' }
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
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
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
      const [matRes, venRes, catRes, jobsRes] = await Promise.all([
        api.get('materials/').catch(() => ({ data: [] })),
        api.get('vendors/').catch(() => ({ data: [] })),
        api.get('material-categories/').catch(() => ({ data: [] })),
        api.get('job-orders/').catch(() => ({ data: [] }))
      ]);

      const matData = matRes.data?.results || matRes.data || [];
      const venData = venRes.data?.results || venRes.data || [];
      const catData = catRes.data?.results || catRes.data || [];
      const jobsData = jobsRes.data?.results || jobsRes.data || [];

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

  // Extract all categories from both MaterialCategory table and materials
  const categories = useMemo(() => {
    const set = new Set();
    materialCategories.forEach(c => {
      if (c.name) set.add(c.name);
    });
    materials.forEach(m => {
      const cat = m.category_name || (typeof m.category === 'string' ? m.category : null);
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [materials, materialCategories]);

  // Normalize quotes into a flat chronological log
  const allQuotes = useMemo(() => {
    const list = [];

    materials.forEach(mat => {
      const shopPrices = Array.isArray(mat.shop_prices) ? mat.shop_prices : [];
      const catName = mat.category_name || (typeof mat.category === 'string' ? mat.category : 'General');
      const lowest = mat.lowest_shop_price;

      shopPrices.forEach((sp, idx) => {
        const pNum = parseFloat(sp.price || 0);
        if (pNum > 0) {
          const quoteDate = sp.date || mat.created_at || '2026-01-01';
          list.push({
            id: `${mat.id}_${idx}_${sp.shop_name || 'shop'}`,
            materialId: String(mat.id),
            materialName: mat.name,
            measurements: mat.measurements || '',
            categoryName: catName,
            customerPrice: parseFloat(mat.customer_price || 0),
            unit: sp.unit || mat.unit || 'pcs',
            vendorName: sp.shop_name || sp.vendor_name || 'Vendor',
            vendorId: sp.vendor_id ? String(sp.vendor_id) : '',
            price: pNum,
            isLowest: lowest && Math.abs(pNum - lowest) < 0.01,
            date: quoteDate.substring(0, 10),
            notes: sp.notes || '',
            jobOrder: sp.job_order || ''
          });
        }
      });
    });

    // Sort newest date first
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [materials]);

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
        if (q.materialId !== selectedMaterialFilter && q.materialName !== selectedMaterialFilter) {
          return false;
        }
      }

      // 4. Category Filter
      if (selectedCategoryFilter !== 'all') {
        if (q.categoryName !== selectedCategoryFilter) return false;
      }

      // 5. Duration Filter
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
  }, [allQuotes, searchQuery, selectedVendorFilter, selectedMaterialFilter, selectedCategoryFilter, duration]);

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
  const quoteResetKey = `${duration}_${selectedMaterialFilter}_${selectedVendorFilter}_${selectedCategoryFilter}_${searchQuery}`;
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
      showError('Please specify the vendor or shop name');
      return;
    }

    setIsSubmitting(true);
    try {
      let targetMat = materials.find(m => String(m.id) === String(modalForm.material_id));
      const finalUnit = (modalForm.unit === '__custom__' || !modalForm.unit?.trim())
        ? (targetMat?.unit || 'pcs')
        : modalForm.unit.trim();

      // If adding quote for an existing material
      if (targetMat) {
        const existingPrices = Array.isArray(targetMat.shop_prices) ? [...targetMat.shop_prices] : [];
        const newEntry = {
          shop_name: modalForm.vendor_name.trim(),
          vendor_id: modalForm.vendor_id || null,
          price: parseFloat(modalForm.price),
          unit: finalUnit,
          date: modalForm.date || new Date().toISOString().split('T')[0],
          notes: modalForm.notes.trim(),
          job_order: modalForm.job_order.trim()
        };

        const updatedShopPrices = [newEntry, ...existingPrices];
        const updatePayload = {
          ...targetMat,
          shop_prices: updatedShopPrices
        };
        if (modalForm.category_id) {
          updatePayload.category = modalForm.category_id;
        }
        await api.put(`materials/${targetMat.id}/`, updatePayload);
      } else {
        // Create new Material if entered custom name
        const matName = modalForm.custom_material_name.trim() || 'New Material';
        const newEntry = {
          shop_name: modalForm.vendor_name.trim(),
          vendor_id: modalForm.vendor_id || null,
          price: parseFloat(modalForm.price),
          unit: finalUnit,
          date: modalForm.date || new Date().toISOString().split('T')[0],
          notes: modalForm.notes.trim()
        };

        const newMatPayload = {
          name: matName,
          unit: finalUnit,
          customer_price: parseFloat(modalForm.price) * 1.25, // Default markup
          shop_prices: [newEntry]
        };
        if (modalForm.category_id) {
          newMatPayload.category = modalForm.category_id;
        }

        await api.post('materials/', newMatPayload);
      }

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
                onClick={() => fetchData(false)}
                title="Refresh prices"
                style={{
                  height: '32px',
                  width: '32px',
                  borderRadius: '50%',
                  border: '1px solid var(--border, #E4E4E4)',
                  background: 'var(--bg-panel, #FFFFFF)',
                  color: 'var(--text, #0A0A0A)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={onBack}
              title="Back to Vendors"
              aria-label="Back to Vendors"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                border: '1px solid var(--border, #E4E4E4)',
                background: 'var(--bg-panel, #FFFFFF)',
                color: 'var(--text, #0A0A0A)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                transition: 'border-color 0.15s, transform 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text, #0A0A0A)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border, #E4E4E4)'; }}
            >
              <ArrowLeft size={17} strokeWidth={2} />
            </button>

            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted, #8C8C8C)' }}>
                Vendors &nbsp;/&nbsp; Materials &nbsp;/&nbsp; Price Charts
              </div>
              <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '2px 0 0', color: 'var(--text, #0A0A0A)', letterSpacing: '-0.02em' }}>
                vendor price chart
              </h1>
            </div>
          </div>

          {/* Desktop Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => fetchData(false)}
              title="Refresh prices"
              style={{
                height: '38px',
                width: '38px',
                borderRadius: '50%',
                border: '1px solid var(--border, #E4E4E4)',
                background: 'var(--bg-panel, #FFFFFF)',
                color: 'var(--text, #0A0A0A)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            </button>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              style={{
                height: '38px',
                padding: '0 16px',
                borderRadius: '999px',
                border: 'none',
                background: 'var(--text, #0A0A0A)',
                color: 'var(--bg, #FFFFFF)',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>record price quote</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. TOP KPI SUMMARY CARDS */}
      <CredCardCarousel 
        isMobile={isMobile}
        desktopGridColumns="repeat(4, 1fr)"
        style={{ marginBottom: isMobile ? '16px' : '22px' }}
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

      {/* 3. FILTER AND SEARCH CONTROL STRIP */}
      <div 
        style={{
          background: 'var(--bg-panel, #FFFFFF)',
          border: '1px solid var(--border, #E4E4E4)',
          borderRadius: '18px',
          padding: isMobile ? '12px' : '16px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: '10px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '1 1 280px', minWidth: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #8C8C8C)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search material, specs, or vendor name..."
              style={{
                width: '100%',
                height: '38px',
                padding: '0 30px 0 34px',
                borderRadius: '10px',
                border: '1px solid var(--border, #E4E4E4)',
                background: 'var(--bg, #F9F9F9)',
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
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Duration Tabs */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%', paddingBottom: isMobile ? '2px' : 0 }}>
            <CredAnimatedTabs
              tabs={DURATION_TABS}
              value={duration}
              onChange={(d) => setDuration(d)}
              layoutId="vendor-chart-duration-tabs"
            />
          </div>
        </div>

        {/* Secondary Filter Dropdowns */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, auto) 1fr', 
          gap: '8px', 
          alignItems: 'center',
          paddingTop: '4px',
          borderTop: '1px solid var(--border, #E4E4E4)'
        }}>
          {/* Material Filter */}
          <div style={{ minWidth: 0 }}>
            <select
              value={selectedMaterialFilter}
              onChange={(e) => setSelectedMaterialFilter(e.target.value)}
              style={{
                width: '100%',
                height: '34px',
                padding: '0 8px',
                borderRadius: '8px',
                border: '1px solid var(--border, #E4E4E4)',
                background: 'var(--bg, #F9F9F9)',
                color: 'var(--text, #0A0A0A)',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Materials ({materials.length})</option>
              {materials.map(m => (
                <option key={m.id} value={String(m.id)}>{m.name} {m.measurements ? `(${m.measurements})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Vendor Filter */}
          <div style={{ minWidth: 0 }}>
            <select
              value={selectedVendorFilter}
              onChange={(e) => setSelectedVendorFilter(e.target.value)}
              style={{
                width: '100%',
                height: '34px',
                padding: '0 8px',
                borderRadius: '8px',
                border: '1px solid var(--border, #E4E4E4)',
                background: 'var(--bg, #F9F9F9)',
                color: 'var(--text, #0A0A0A)',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Vendors ({vendors.length})</option>
              {vendors.map(v => (
                <option key={v.id} value={String(v.id)}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div style={{ minWidth: 0, gridColumn: isMobile ? 'span 2' : 'auto' }}>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              style={{
                width: '100%',
                height: '34px',
                padding: '0 8px',
                borderRadius: '8px',
                border: '1px solid var(--border, #E4E4E4)',
                background: 'var(--bg, #F9F9F9)',
                color: 'var(--text, #0A0A0A)',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Reset button if active filter */}
          {(selectedMaterialFilter !== 'all' || selectedVendorFilter !== 'all' || selectedCategoryFilter !== 'all' || duration !== 'all' || searchQuery) && (
            <div style={{ gridColumn: isMobile ? 'span 2' : 'auto', textAlign: isMobile ? 'center' : 'right' }}>
              <button
                type="button"
                onClick={() => {
                  setDuration('all');
                  setSelectedMaterialFilter('all');
                  setSelectedVendorFilter('all');
                  setSelectedCategoryFilter('all');
                  setSearchQuery('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 8px'
                }}
              >
                Reset Filters
              </button>
            </div>
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
            {searchQuery || selectedMaterialFilter !== 'all' || selectedVendorFilter !== 'all' || selectedCategoryFilter !== 'all' || duration !== 'all'
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

                {/* Notes or Job Order */}
                {(q.notes || q.jobOrder) && (
                  <div style={{
                    padding: '2px 0 6px 54px',
                    fontSize: '11px',
                    color: 'var(--text-muted, #8C8C8C)'
                  }}>
                    {q.jobOrder && (
                      <span style={{ fontWeight: 600, color: 'var(--text, #0A0A0A)', marginRight: '8px' }}>
                        Job: {q.jobOrder}
                      </span>
                    )}
                    {q.notes && <span>{q.notes}</span>}
                  </div>
                )}

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
        /* DESKTOP VIEW: Table with pagination */
        <div 
          style={{
            background: 'var(--bg-panel, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '18px',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #E4E4E4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text, #0A0A0A)' }}>
                Historical Price Quotes Log
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)' }}>
                Showing {quoteRangeStart}-{quoteRangeEnd} of {totalQuoteCount} quotes across suppliers
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: isDarkMode ? '#171717' : '#FAFAFA', borderBottom: '1px solid var(--border, #E4E4E4)', color: 'var(--text-muted, #8C8C8C)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Material / Specs</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Vendor / Supplier</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700, textAlign: 'right' }}>Quoted Rate</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Unit</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Quote Date</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Project / Notes</th>
                </tr>
              </thead>
              <tbody>
                {pagedQuotes.map((q) => (
                  <tr 
                    key={q.id} 
                    style={{ borderBottom: '1px solid var(--border, #E4E4E4)', transition: 'background 0.1s' }}
                    className="table-row-hover"
                  >
                    {/* Material Name & Category */}
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>{q.materialName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{ background: isDarkMode ? '#222' : '#F0F0F0', padding: '1px 6px', borderRadius: '4px' }}>
                          {q.categoryName}
                        </span>
                        {q.measurements && <span>{q.measurements}</span>}
                      </div>
                    </td>

                    {/* Vendor Name */}
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: isDarkMode ? '#262626' : '#EFEFEF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text)' }}>
                          {q.vendorName.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500, color: 'var(--text)' }}>{q.vendorName}</span>
                      </div>
                    </td>

                    {/* Quoted Price */}
                    <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: q.isLowest ? '#16a34a' : 'var(--text, #0A0A0A)' }}>
                        <Money value={q.price} currency="SAR" />
                      </div>
                      {q.isLowest && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', background: 'rgba(22, 163, 74, 0.1)', padding: '1px 6px', borderRadius: '999px', display: 'inline-block', marginTop: '2px' }}>
                          ★ Lowest Rate
                        </span>
                      )}
                    </td>

                    {/* Unit */}
                    <td style={{ padding: '12px 18px', color: 'var(--text-muted, #8C8C8C)' }}>
                      {q.unit}
                    </td>

                    {/* Date */}
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text)' }}>
                        <Calendar size={13} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
                        <span>{q.date}</span>
                      </div>
                    </td>

                    {/* Job Order & Notes */}
                    <td style={{ padding: '12px 18px' }}>
                      {q.jobOrder && (
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text, #0A0A0A)' }}>
                          Job: {q.jobOrder}
                        </div>
                      )}
                      {q.notes && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>
                          {q.notes}
                        </div>
                      )}
                      {!q.jobOrder && !q.notes && (
                        <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        </div>
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
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '8px' }}>
                  <select
                    value={modalForm.vendor_id}
                    onChange={(e) => {
                      const vId = e.target.value;
                      const ven = vendors.find(v => String(v.id) === String(vId));
                      setModalForm(prev => ({
                        ...prev,
                        vendor_id: vId,
                        vendor_name: ven ? ven.name : prev.vendor_name
                      }));
                    }}
                    style={{
                      width: isMobile ? '100%' : '45%',
                      height: '38px',
                      padding: '0 8px',
                      borderRadius: '8px',
                      border: '1px solid var(--border, #E4E4E4)',
                      background: 'var(--bg, #F9F9F9)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={modalForm.vendor_name}
                    onChange={(e) => setModalForm(prev => ({ ...prev, vendor_name: e.target.value }))}
                    placeholder="or type Supplier / Shop..."
                    required
                    style={{
                      flex: 1,
                      width: isMobile ? '100%' : 'auto',
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

export default CredVendorPriceChartView;
