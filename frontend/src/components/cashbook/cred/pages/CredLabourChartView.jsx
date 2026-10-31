import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  ArrowLeft, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  User, 
  Layers, 
  Tag, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Filter, 
  RefreshCw, 
  DollarSign,
  ChevronDown,
  X,
  FileText,
  BarChart2,
  Phone,
  Briefcase,
  Trash2,
  HardHat,
  Award
} from 'lucide-react';
import api from '../../../../api';
import Money from '../Money';
import MoneyCard from '../MoneyCard';
import CredCardCarousel from '../CredCardCarousel';
import GooeyMenu from '../GooeyMenu';
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

const STANDARD_SECTORS = [
  'Carpentry',
  'Helper',
  'Painter',
  'Applicator',
  'Masonry / Tile',
  'Electrician',
  'Plumbing',
  'Welder / Steel',
  'Gypsum / Ceiling',
  'General Labour'
];

const RATE_UNITS = [
  'per day',
  'per hour',
  'per shift',
  'per month',
  'per job / contract',
  'per sq.m'
];


// Helper to extract unit from notes if saved in format "[Unit: per day] note"
const parseUnitFromNotes = (notes) => {
  if (!notes) return 'per day';
  const match = notes.match(/\[Unit:\s*([^\]]+)\]/i);
  if (match && match[1]) return match[1].trim();
  if (notes.includes('per hour') || notes.includes('/hr')) return 'per hour';
  if (notes.includes('per job') || notes.includes('/job')) return 'per job / contract';
  if (notes.includes('per sq.m') || notes.includes('/m2')) return 'per sq.m';
  if (notes.includes('per month') || notes.includes('/mo')) return 'per month';
  return 'per day';
};

const cleanNotesText = (notes) => {
  if (!notes) return '';
  return notes.replace(/\[Unit:\s*[^\]]+\]/gi, '').trim();
};

const CredLabourChartView = ({
  isMobile = false,
  isDarkMode = false,
  onBack = () => {},
  onNavigate = () => {}
}) => {
  const [quoteRecords, setQuoteRecords] = useState([]);
  const [systemWorkers, setSystemWorkers] = useState([]);
  const [jobOrders, setJobOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState('all');
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState('all');
  const [duration, setDuration] = useState('all');

  // Modal State for Recording Labour Price Quote
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalForm, setModalForm] = useState({
    labourer_mode: 'existing', // 'existing' | 'new'
    labourer_name: '',
    phone: '',
    sector: 'Carpentry',
    custom_sector: '',
    charge: '',
    unit: 'per day',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    job_order: '',
    notes: ''
  });

  // Fetch initial data
  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [quotesRes, jobsRes, workersRes] = await Promise.all([
        api.get('labour-price-quotes/').catch(() => ({ data: [] })),
        api.get('job-orders/').catch(() => ({ data: [] })),
        api.get('labours/').catch(() => ({ data: [] }))
      ]);

      const quotesData = quotesRes.data?.results || quotesRes.data || [];
      const jobsData = jobsRes.data?.results || jobsRes.data || [];
      const workersData = workersRes.data?.results || workersRes.data || [];

      setQuoteRecords(Array.isArray(quotesData) ? quotesData : []);
      setJobOrders(Array.isArray(jobsData) ? jobsData : []);
      setSystemWorkers(Array.isArray(workersData) ? workersData : []);
    } catch (err) {
      console.error('Error fetching labour price chart data:', err);
      showError('Failed to load labour price data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Normalise flat list of quotes from dedicated labour-price-quotes
  const allQuotes = useMemo(() => {
    const list = [];
    quoteRecords.forEach(r => {
      const charge = parseFloat(r.charge || 0);
      const sector = (r.sector || 'General Labour').trim();
      const quoteDate = r.date || (r.created_at ? r.created_at.substring(0, 10) : '2026-01-01');
      const unit = r.unit || parseUnitFromNotes(r.notes);
      const displayNotes = cleanNotesText(r.notes);

      list.push({
        id: r.id,
        name: (r.labourer_name || 'Worker').trim(),
        phone: r.phone || '',
        sector: sector,
        charge: charge,
        unit: unit,
        date: quoteDate.substring(0, 10),
        dueDate: r.due_date || null,
        notes: displayNotes,
        jobOrder: r.job_order_title || (r.job_order ? `#${r.job_order}` : ''),
        jobOrderId: r.job_order || null,
        created_at: r.created_at
      });
    });

    // Calculate minimum benchmark per sector
    const lowestBySector = {};
    list.forEach(q => {
      if (q.charge > 0) {
        if (!lowestBySector[q.sector] || q.charge < lowestBySector[q.sector]) {
          lowestBySector[q.sector] = q.charge;
        }
      }
    });

    return list.map(q => ({
      ...q,
      isLowest: q.charge > 0 && Math.abs(q.charge - lowestBySector[q.sector]) < 0.01
    })).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [quoteRecords]);

  // Extract distinct sectors and distinct labourers
  const uniqueSectors = useMemo(() => {
    const set = new Set();
    allQuotes.forEach(q => {
      if (q.sector) set.add(q.sector);
    });
    return Array.from(set).sort();
  }, [allQuotes]);

  const uniqueWorkers = useMemo(() => {
    const map = new Map();
    // 1. Registered system workers (for dropdown selection)
    systemWorkers.forEach(w => {
      if (w.name && !map.has(w.name)) {
        map.set(w.name, { name: w.name, phone: w.phone || '' });
      }
    });
    // 2. Workers who have recorded quotes
    quoteRecords.forEach(q => {
      const name = q.labourer_name || q.name;
      if (name && !map.has(name)) {
        map.set(name, { name: name, phone: q.phone || '' });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [systemWorkers, quoteRecords]);

  // Gooey menu options for Sector and Labourer filters (clean titles without counts)
  const sectorGooeyOptions = useMemo(() => [
    { value: 'all', label: 'All Sectors', icon: Layers },
    ...uniqueSectors.map(s => ({ value: s, label: s, icon: Layers }))
  ], [uniqueSectors]);

  const workerGooeyOptions = useMemo(() => [
    { value: 'all', label: 'All Labourers', icon: User },
    ...uniqueWorkers.map(w => ({ value: w.name, label: w.name, icon: User, sub: w.phone || null }))
  ], [uniqueWorkers]);

  // Filtered Quotes
  const filteredQuotes = useMemo(() => {
    const now = new Date();
    return allQuotes.filter(q => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = (q.name || '').toLowerCase().includes(query);
        const matchSector = (q.sector || '').toLowerCase().includes(query);
        const matchJob = (q.jobOrder || '').toLowerCase().includes(query);
        const matchNotes = (q.notes || '').toLowerCase().includes(query);
        const matchPhone = (q.phone || '').includes(query);
        if (!matchName && !matchSector && !matchJob && !matchNotes && !matchPhone) return false;
      }

      // 2. Sector Filter
      if (selectedSectorFilter !== 'all' && q.sector !== selectedSectorFilter) {
        return false;
      }

      // 3. Worker Filter
      if (selectedWorkerFilter !== 'all' && q.name !== selectedWorkerFilter) {
        return false;
      }

      // 4. Duration Filter
      if (duration !== 'all') {
        const qDate = new Date(q.date);
        if (isNaN(qDate.getTime())) return true;
        const diffDays = (now - qDate) / (1000 * 60 * 60 * 24);

        if (duration === '30d' && diffDays > 30) return false;
        if (duration === '90d' && diffDays > 90) return false;
        if (duration === '180d' && diffDays > 180) return false;
        if (duration === 'year') {
          if (qDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      return true;
    });
  }, [allQuotes, searchQuery, selectedSectorFilter, selectedWorkerFilter, duration]);

  // Top KPIs
  const kpis = useMemo(() => {
    const sectorSet = new Set();
    const workerSet = new Set();
    let totalCharge = 0;
    let validQuoteCount = 0;
    let minCharge = Infinity;
    let lowestWorker = '';
    let lowestSector = '';

    filteredQuotes.forEach(q => {
      if (q.sector) sectorSet.add(q.sector);
      if (q.name) workerSet.add(q.name);

      if (q.charge > 0) {
        totalCharge += q.charge;
        validQuoteCount += 1;
        if (q.charge < minCharge) {
          minCharge = q.charge;
          lowestWorker = q.name;
          lowestSector = q.sector;
        }
      }
    });

    return {
      sectorCount: sectorSet.size,
      quotesCount: filteredQuotes.length,
      workerCount: workerSet.size,
      lowestPrice: minCharge === Infinity ? 0 : minCharge,
      lowestWorker,
      lowestSector,
      avgPrice: validQuoteCount > 0 ? Math.round((totalCharge / validQuoteCount) * 100) / 100 : 0
    };
  }, [filteredQuotes]);

  // Client-side pagination matching CredVendorsView
  const quoteResetKey = `${duration}_${selectedSectorFilter}_${selectedWorkerFilter}_${searchQuery}`;
  const {
    pageItems: pagedQuotes,
    page: quotePage,
    setPage: setQuotePage,
    totalPages: totalQuotePages,
    rangeStart: quoteRangeStart,
    rangeEnd: quoteRangeEnd,
    total: totalQuoteCount
  } = usePagination(filteredQuotes, isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP, quoteResetKey);


  // Open Modal with fresh state
  const handleOpenModal = () => {
    setModalForm({
      labourer_name: uniqueWorkers[0]?.name || '',
      phone: uniqueWorkers[0]?.phone || '',
      sector: 'Carpentry',
      custom_sector: '',
      charge: '',
      unit: 'per day',
      date: new Date().toISOString().split('T')[0],
      due_date: '',
      job_order: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  // Handle Save New Labour Price Quote
  const handleSaveQuote = async (e) => {
    e.preventDefault();

    const workerName = (modalForm.labourer_name || '').trim();

    if (!workerName) {
      showError('Please select a labourer from the dropdown');
      return;
    }

    const sectorName = modalForm.sector === 'Other / Custom'
      ? modalForm.custom_sector.trim()
      : modalForm.sector.trim();

    if (!sectorName) {
      showError('Please choose or enter a sector / trade');
      return;
    }

    const chargeNum = parseFloat(modalForm.charge);
    if (isNaN(chargeNum) || chargeNum <= 0) {
      showError('Please enter a valid quoted charge amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        labourer_name: workerName,
        phone: modalForm.phone.trim(),
        sector: sectorName,
        charge: chargeNum,
        unit: modalForm.unit || 'per day',
        date: modalForm.date || new Date().toISOString().split('T')[0],
        due_date: modalForm.due_date || null,
        job_order: modalForm.job_order ? parseInt(modalForm.job_order) : null,
        notes: modalForm.notes.trim()
      };

      await api.post('labour-price-quotes/', payload);

      showSuccess('Labour price quote recorded successfully');
      setIsModalOpen(false);
      fetchData(false);
    } catch (err) {
      console.error('Failed to record labour price quote:', err);
      showError('Failed to record quote. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Quote Entry
  const handleDeleteQuote = async (quote) => {
    const confirmed = await showConfirm(
      'Delete Labour Quote?',
      `Are you sure you want to remove the quote of SAR ${quote.charge} for ${quote.name} (${quote.sector})?`,
      'Yes, Delete'
    );
    if (!confirmed) return;

    try {
      await api.delete(`labour-price-quotes/${quote.id}/`);
      showSuccess('Quote record removed');
      fetchData(false);
    } catch (err) {
      console.error('Error deleting quote:', err);
      showError('Failed to remove quote record');
    }
  };

  // Helper for Duration badge in table
  const formatTaskDuration = (startDate, dueDate) => {
    if (!startDate) return '—';
    if (!dueDate) return startDate;
    const s = new Date(startDate);
    const e = new Date(dueDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return startDate;
    const diff = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
    return `${startDate} → ${dueDate} (${diff}d)`;
  };

  return (
    <div 
      className="cred-page-container cred-labour-chart-page" 
      style={{ 
        padding: isMobile ? '12px 14px 80px' : '20px 32px 60px', 
        maxWidth: '1440px', 
        margin: '0 auto', 
        boxSizing: 'border-box' 
      }}
    >
      {/* 1. TOP HEADER & BREADCRUMBS */}
      {isMobile ? (
        <div style={{ marginBottom: '16px', width: '100%' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--border, #E4E4E4)',
              background: 'transparent',
              color: 'var(--text, #0A0A0A)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginBottom: '10px',
              padding: 0
            }}
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0, letterSpacing: '-0.02em', color: 'var(--text, #0A0A0A)' }}>
              labour chart
            </h1>
            <button
              type="button"
              onClick={handleOpenModal}
              style={{
                borderRadius: '999px',
                background: 'var(--text, #0A0A0A)',
                color: 'var(--bg, #FFFFFF)',
                border: 'none',
                fontWeight: 600,
                fontSize: '12px',
                padding: '6px 14px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: isDarkMode ? '0 2px 10px rgba(255,255,255,0.08)' : '0 2px 8px rgba(0,0,0,0.12)'
              }}
            >
              <Plus size={14} />
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
            gap: '14px',
            marginBottom: '20px'
          }}
        >
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600, margin: 0, color: 'var(--text, #0A0A0A)', letterSpacing: '-0.025em' }}>
            Labour Chart
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleOpenModal}
              style={{
                background: isDarkMode ? '#ffffff' : '#0f172a',
                color: isDarkMode ? '#0f172a' : '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isDarkMode ? '0 2px 12px rgba(255,255,255,0.1)' : '0 2px 10px rgba(15,23,42,0.14)'
              }}
            >
              <Plus size={16} />
              <span>Record Labour Quote</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. TOP METRIC CARDS (CredCardCarousel & MoneyCard) */}
      <CredCardCarousel 
        isMobile={isMobile}
        desktopGridColumns="repeat(4, 1fr)"
        style={{ marginBottom: '22px' }}
      >
        <MoneyCard
          label="SECTORS TRACKED"
          value={kpis.sectorCount}
          isCount={true}
          caption={`Across ${kpis.quotesCount} quotes logged`}
          icon={Layers}
          iconBg={isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}
          iconColor={isDarkMode ? '#ffffff' : '#0f172a'}
        />

        <MoneyCard
          label="HISTORICAL QUOTES"
          value={kpis.quotesCount}
          isCount={true}
          caption={`From ${kpis.workerCount} labourers`}
          icon={HardHat}
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
          caption={kpis.lowestWorker ? `${kpis.lowestWorker} (${kpis.lowestSector})` : 'Best labour benchmark'}
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
          caption="Mean labour charge"
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
          {/* Sector Filter: Non-gooey Dropdown */}
          <GooeyMenu
            id="labour-chart-sector-filter"
            value={selectedSectorFilter}
            onSelect={(opt) => setSelectedSectorFilter(opt.value || opt.id || opt)}
            onChange={(val) => setSelectedSectorFilter(val)}
            options={sectorGooeyOptions}
            width={isMobile ? '100%' : 155}
            pillHeight={36}
            gooey={false}
            className="case-preserve"
            ariaLabel="Filter sectors"
          />

          {/* Labourer Filter: Non-gooey Dropdown */}
          <GooeyMenu
            id="labour-chart-worker-filter"
            value={selectedWorkerFilter}
            onSelect={(opt) => setSelectedWorkerFilter(opt.value || opt.id || opt)}
            onChange={(val) => setSelectedWorkerFilter(val)}
            options={workerGooeyOptions}
            width={isMobile ? '100%' : 165}
            pillHeight={36}
            gooey={false}
            className="case-preserve"
            ariaLabel="Filter labourers"
          />

          {/* Duration Date Filter: GooeyMenu Liquid Dropdown */}
          <GooeyMenu
            id="labour-chart-date-filter"
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
            placeholder="Search labourer, sector, job order..."
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
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading labour quotes...</div>
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
            <HardHat size={22} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text, #0A0A0A)', margin: '0 0 6px' }}>
            No labour quotes found
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)', margin: '0 0 16px' }}>
            {searchQuery || selectedSectorFilter !== 'all' || selectedWorkerFilter !== 'all' || duration !== 'all'
              ? 'No quotes matching current filter selection'
              : 'Click "+ Record Labour Quote" to track worker rates and sector benchmarks'}
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
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            + Record Labour Quote
          </button>
        </div>
      ) : isMobile ? (
        /* MOBILE TWO-TIER QUOTE CARDS */
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
          {pagedQuotes.map((q) => (
            <div
              key={q.id}
              style={{
                padding: '12px 0 10px',
                background: 'transparent',
                position: 'relative'
              }}
            >
              {/* Tier 1: Avatar + Name / Sector + Quoted Rate / Badge */}
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
                    {(q.name || 'W').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text, #0A0A0A)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.name}
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
                        {q.sector}
                      </span>
                    </div>
                    {q.phone && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={10} />
                        <span>{q.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: q.isLowest ? '#16a34a' : 'var(--text, #0A0A0A)' }}>
                    SAR {q.charge.toFixed(2)}
                  </div>
                  {q.isLowest && (
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
                    Sector
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text, #0A0A0A)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q.sector}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted, #8C8C8C)', marginBottom: '2px' }}>
                    Unit
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q.unit}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted, #8C8C8C)', marginBottom: '2px' }}>
                    Date
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q.date}
                  </div>
                </div>
              </div>

              {/* Extra metadata: Notes & Actions */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '2px 0 4px 54px',
                fontSize: '11px',
                color: 'var(--text-muted, #8C8C8C)'
              }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {q.notes && <span>{q.notes}</span>}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteQuote(q)}
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
                  title="Delete quote"
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
        /* DESKTOP TABLE */
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
                    <th style={{ ...headerCellStyle, width: '25%' }}>LABOURER</th>
                    <th style={{ ...headerCellStyle, width: '18%' }}>SECTOR / TRADE</th>
                    <th style={{ ...headerCellStyle, width: '15%', textAlign: 'right' }}>QUOTED CHARGE</th>
                    <th style={{ ...headerCellStyle, width: '12%' }}>RATE UNIT</th>
                    <th style={{ ...headerCellStyle, width: '14%' }}>QUOTE DATE</th>
                    <th style={{ ...headerCellStyle, width: '12%' }}>NOTES & TERMS</th>
                    <th style={{ ...headerCellStyle, width: '4%', textAlign: 'center' }}>ACTION</th>
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
                      {/* Labourer Name & Contact */}
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
                            {(q.name || 'W').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text, #0A0A0A)' }}>
                              {q.name}
                            </div>
                            {q.phone && (
                              <div style={{ fontSize: '10.5px', color: 'var(--text-muted, #8C8C8C)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                                <Phone size={10} />
                                <span>{q.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Sector / Trade */}
                      <td style={bodyCellStyle}>
                        <span style={{
                          background: isDarkMode ? '#1e2024' : '#f1f5f9',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 500,
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <HardHat size={11} style={{ color: 'var(--text-muted, #71717A)' }} />
                          {q.sector}
                        </span>
                      </td>

                      {/* Quoted Charge */}
                      <td style={{ ...bodyCellStyle, textAlign: 'right' }}>
                        <div style={{ 
                          fontWeight: 700, 
                          fontSize: '13px', 
                          fontVariantNumeric: 'tabular-nums',
                          color: q.isLowest ? '#16a34a' : 'var(--text, #0A0A0A)' 
                        }}>
                          <Money value={q.charge} currency="SAR" />
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

                      {/* Rate Unit */}
                      <td style={{ ...bodyCellStyle, color: 'var(--text-muted, #8C8C8C)', fontSize: '12px' }}>
                        {q.unit}
                      </td>

                      {/* Date */}
                      <td style={{ ...bodyCellStyle, color: 'var(--text, #0A0A0A)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={11} style={{ color: 'var(--text-muted, #8C8C8C)' }} />
                          <span>{q.date}</span>
                        </div>
                        {q.dueDate && (
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={10} />
                            <span>Due: {q.dueDate}</span>
                          </div>
                        )}
                      </td>

                      {/* Notes & Terms */}
                      <td style={{ ...bodyCellStyle, maxWidth: '200px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {q.notes || '—'}
                        </div>
                      </td>

                      {/* Action */}
                      <td style={{ ...bodyCellStyle, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuote(q)}
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

      {/* 5. MODAL: RECORD LABOUR PRICE QUOTE */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: isMobile ? '12px' : '16px'
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
              width: '100%',
              maxWidth: '520px',
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: isMobile ? '20px 16px 24px' : '24px',
              boxSizing: 'border-box',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              color: 'var(--text)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text, #0A0A0A)' }}>
                  Record Labour Price Quote
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', marginTop: '2px' }}>
                  Track labourer charges and trade sector benchmarks
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleSaveQuote} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 1. Labourer Selection */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #0A0A0A)', display: 'block', marginBottom: '6px' }}>
                  Labourer / Worker Name *
                </label>
                <select
                  value={modalForm.labourer_name}
                  onChange={(e) => {
                    const sel = uniqueWorkers.find(w => w.name === e.target.value);
                    setModalForm(prev => ({
                      ...prev,
                      labourer_name: e.target.value,
                      phone: sel?.phone || prev.phone
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
                  <option value="">-- Select Labourer --</option>
                  {uniqueWorkers.map(w => (
                    <option key={w.name} value={w.name}>
                      {w.name}{w.phone ? ` (${w.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Sector / Trade Selection */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #0A0A0A)', display: 'block', marginBottom: '6px' }}>
                  Sector / Trade *
                </label>
                <select
                  value={modalForm.sector}
                  onChange={(e) => setModalForm(prev => ({ ...prev, sector: e.target.value }))}
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
                  <option value="">-- Select Sector / Trade --</option>
                  {STANDARD_SECTORS.map(sec => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                  <option value="Other / Custom">+ Custom / Other Sector...</option>
                </select>

                {modalForm.sector === 'Other / Custom' && (
                  <input
                    type="text"
                    placeholder="Enter custom trade/sector (e.g. Scaffolding, HVAC)"
                    value={modalForm.custom_sector}
                    onChange={(e) => setModalForm(prev => ({ ...prev, custom_sector: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border, #E4E4E4)',
                      background: 'var(--bg, #F9F9F9)',
                      color: 'var(--text, #0A0A0A)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      marginTop: '8px'
                    }}
                  />
                )}
              </div>

              {/* 3. Rate / Charge & Rate Unit */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1.5fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #0A0A0A)', display: 'block', marginBottom: '6px' }}>
                    Quoted Charge (SAR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 150.00"
                    value={modalForm.charge}
                    onChange={(e) => setModalForm(prev => ({ ...prev, charge: e.target.value }))}
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
                    Rate Unit *
                  </label>
                  <select
                    value={modalForm.unit}
                    onChange={(e) => setModalForm(prev => ({ ...prev, unit: e.target.value }))}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 10px',
                      borderRadius: '10px',
                      border: '1px solid var(--border, #E4E4E4)',
                      background: 'var(--bg, #F9F9F9)',
                      color: 'var(--text, #0A0A0A)',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    {!RATE_UNITS.includes(modalForm.unit) && modalForm.unit && (
                      <option value={modalForm.unit}>{modalForm.unit} (Current)</option>
                    )}
                    {RATE_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Quote Date & Duration Timeline */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #0A0A0A)', display: 'block', marginBottom: '6px' }}>
                    Quote Date *
                  </label>
                  <input
                    type="date"
                    value={modalForm.date}
                    onChange={(e) => setModalForm(prev => ({ ...prev, date: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 10px',
                      borderRadius: '10px',
                      border: '1px solid var(--border, #E4E4E4)',
                      background: 'var(--bg, #F9F9F9)',
                      color: 'var(--text, #0A0A0A)',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #0A0A0A)', display: 'block', marginBottom: '6px' }}>
                    Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={modalForm.due_date}
                    onChange={(e) => setModalForm(prev => ({ ...prev, due_date: e.target.value }))}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 10px',
                      borderRadius: '10px',
                      border: '1px solid var(--border, #E4E4E4)',
                      background: 'var(--bg, #F9F9F9)',
                      color: 'var(--text, #0A0A0A)',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* 5. Notes & Terms */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text, #0A0A0A)', display: 'block', marginBottom: '6px' }}>
                  Notes & Quotation Terms
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Includes own tools, overtime rate 1.5x, site location requirements..."
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
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  style={{
                    height: '38px',
                    padding: '0 18px',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #E4E4E4)',
                    background: 'var(--bg, #F9F9F9)',
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
                    height: '38px',
                    padding: '0 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--text, #0A0A0A)',
                    color: 'var(--bg, #FFFFFF)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                >
                  {isSubmitting ? 'Saving Quote...' : 'Save Quote Record'}
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

export default CredLabourChartView;
