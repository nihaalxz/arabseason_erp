import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { 
  ArrowLeft, Activity, ListOrdered, FileText, CheckCircle, 
  Clock, CreditCard, Box, Tag, Plus, Minus, Edit, Trash2 
} from '../components/icons'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'
import Modal from '../components/common/Modal'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { showConfirm, showError, showToast } from '../utils/swal'

const CustomerDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const basePath = '/accounting'
  const { formatCurrency } = useSettings()

  const [customer, setCustomer] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Related data
  const [jobOrders, setJobOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [expenses, setExpenses] = useState([])
  const [invoices, setInvoices] = useState([])
  const [creditNotes, setCreditNotes] = useState([])

  // Modal State for Transactions
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState('') // 'payment', 'job', 'expense', 'invoice'
  const [editingItem, setEditingItem] = useState(null)
  
  // Statement filters
  const [statementFilter, setStatementFilter] = useState('all')
  const [customDates, setCustomDates] = useState({ start: '', end: '' })

  useEffect(() => {
    fetchCustomerData()
  }, [id])

  const fetchCustomerData = async () => {
    try {
      setLoading(true)
      const custRes = await api.get(`customers/${id}/`)
      setCustomer(custRes.data)

      const [jobsRes, paysRes, expsRes, invsRes, cnsRes] = await Promise.all([
        api.get(`job-orders/?customer=${id}&nopage=true`),
        api.get(`customer-payments/?customer=${id}&nopage=true`),
        api.get(`expenses/?nopage=true`),
        api.get(`invoices/?customer=${id}&nopage=true`).catch(() => ({ data: [] })),
        api.get(`credit-notes/?customer=${id}&nopage=true`).catch(() => ({ data: [] }))
      ])

      const rawJobs = jobsRes.data?.results || jobsRes.data || []
      const uniqueJobs = Array.from(new Map(rawJobs.map(j => [j.id, j])).values())
      setJobOrders(uniqueJobs)

      const rawPays = paysRes.data?.results || paysRes.data || []
      const uniquePays = Array.from(new Map(rawPays.map(p => [p.id, p])).values())
      setPayments(uniquePays)

      const rawInvs = invsRes.data?.results || invsRes.data || []
      const uniqueInvs = Array.from(new Map(rawInvs.map(i => [i.id, i])).values())
      setInvoices(uniqueInvs)

      const rawCns = cnsRes.data?.results || cnsRes.data || []
      const activeCns = rawCns.filter(c => c.status !== 'Draft' && c.status !== 'Cancelled')
      setCreditNotes(activeCns)

      const jobsIds = uniqueJobs.map(j => j.id)
      const allExps = expsRes.data?.results || expsRes.data || []
      const uniqueExps = Array.from(new Map(allExps.filter(e => jobsIds.includes(e.job_order)).map(e => [e.id, e])).values())
      setExpenses(uniqueExps)

      setError('')
    } catch (err) {
      console.error(err)
      setError('Failed to fetch customer details.')
    } finally {
      setLoading(false)
    }
  }

  // Handle deletions in transactions tab
  const handleDelete = async (type, itemId) => {
    const confirmed = await showConfirm({
      title: `Delete ${type}?`,
      text: `Are you sure you want to delete this ${type}? This action cannot be undone.`,
      confirmButtonText: 'Yes, delete',
      isDangerous: true
    })
    if (!confirmed) return
    try {
      if (type === 'payment') {
        await api.delete(`customer-payments/${itemId}/`)
        setPayments(payments.filter(p => p.id !== itemId))
      } else if (type === 'job') {
        await api.delete(`job-orders/${itemId}/`)
        setJobOrders(jobOrders.filter(j => j.id !== itemId))
      } else if (type === 'expense') {
        await api.delete(`expenses/${itemId}/`)
        setExpenses(expenses.filter(e => e.id !== itemId))
      } else if (type === 'invoice') {
        await api.delete(`invoices/${itemId}/`)
        setInvoices(invoices.filter(i => i.id !== itemId))
      } else if (type === 'credit_note') {
        await api.delete(`credit-notes/${itemId}/`)
        setCreditNotes(creditNotes.filter(c => c.id !== itemId))
      }
      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`)
    } catch (err) {
      showError('Delete Failed', `Failed to delete ${type}.`)
    }
  }

  // Generating Timeline (Overview)
  const timelineData = [
    ...jobOrders.map(j => ({ id: `job-${j.id}`, type: 'job', date: new Date(j.created_at), data: j })),
    ...invoices.filter(i => !i.job_order).map(i => ({ id: `inv-${i.id}`, type: 'invoice', date: new Date(i.invoice_date || i.issue_date || i.created_at), data: i })),
    ...payments.map(p => ({ id: `pay-${p.id}`, type: 'payment', date: new Date(p.payment_date), data: p })),
    ...creditNotes.map(c => ({ id: `cn-${c.id}`, type: 'credit_note', date: new Date(c.credit_note_date || c.created_at), data: c })),
    ...expenses.map(e => ({ id: `exp-${e.id}`, type: 'expense', date: new Date(e.date), data: e }))
  ].sort((a, b) => b.date - a.date)

  // Calculating Statement Data
  const getFilteredData = (dataList, dateField) => {
    const now = new Date()
    return dataList.filter(item => {
      const rawDate = item[dateField] || item.invoice_date || item.created_at || item.payment_date || item.credit_note_date || item.date
      if (!rawDate) return false
      const d = new Date(rawDate)
      if (isNaN(d.getTime())) return false
      if (statementFilter === 'today') return d.toDateString() === now.toDateString()
      if (statementFilter === 'week') {
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return d >= lastWeek
      }
      if (statementFilter === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }
      if (statementFilter === 'year') {
        return d.getFullYear() === now.getFullYear()
      }
      if (statementFilter === 'custom' && customDates.start && customDates.end) {
        return d >= new Date(customDates.start) && d <= new Date(customDates.end)
      }
      return true
    })
  }

  // Separate data into 'in period' and 'before period' to calculate brought forward balance
  const now = new Date()
  let startOfPeriod = new Date(0) // Default all time

  if (statementFilter === 'today') {
    startOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  } else if (statementFilter === 'week') {
    startOfPeriod = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  } else if (statementFilter === 'month') {
    startOfPeriod = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (statementFilter === 'year') {
    startOfPeriod = new Date(now.getFullYear(), 0, 1)
  } else if (statementFilter === 'custom' && customDates.start) {
    startOfPeriod = new Date(customDates.start)
  }

  const isBeforePeriod = (dateField) => {
    if (statementFilter === 'all') return false
    return new Date(dateField) < startOfPeriod
  }

  const pastJobs = jobOrders.filter(j => isBeforePeriod(j.created_at))
  const pastInvoices = invoices.filter(i => !i.job_order && isBeforePeriod(i.invoice_date || i.issue_date || i.created_at))
  const pastPayments = payments.filter(p => isBeforePeriod(p.payment_date))
  const pastCreditNotes = creditNotes.filter(c => isBeforePeriod(c.credit_note_date || c.created_at))

  const bbfDebit = pastJobs.reduce((sum, j) => sum + parseFloat(j.total_amount || 0), 0) +
                   pastInvoices.reduce((sum, i) => sum + parseFloat(i.total_amount || 0), 0)
  const bbfCredit = pastPayments.reduce((sum, p) => p.payment_type === 'refund' ? sum - parseFloat(p.amount || 0) : sum + parseFloat(p.amount || 0), 0) +
                    pastCreditNotes.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0)
  const balanceBroughtForward = bbfDebit - bbfCredit

  const statementJobs = getFilteredData(jobOrders, 'created_at')
  const statementInvoices = getFilteredData(invoices.filter(i => !i.job_order), 'invoice_date')
  const statementPayments = getFilteredData(payments, 'payment_date')
  const statementCreditNotes = getFilteredData(creditNotes, 'credit_note_date')

  const totalAmount = (statementJobs.reduce((sum, j) => sum + parseFloat(j.total_amount || 0), 0) +
                      statementInvoices.reduce((sum, i) => sum + parseFloat(i.total_amount || 0), 0))
  const totalCredits = statementPayments.reduce((sum, p) => p.payment_type === 'refund' ? sum - parseFloat(p.amount || 0) : sum + parseFloat(p.amount || 0), 0) +
                       statementCreditNotes.reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0)
  const paidAmount = statementPayments.reduce((sum, p) => p.payment_type === 'refund' ? sum - parseFloat(p.amount || 0) : sum + parseFloat(p.amount || 0), 0)
  const pendingAmount = balanceBroughtForward + (totalAmount - totalCredits)

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <SkeletonLoader type="cards" />
        <div style={{ marginTop: '2rem' }}>
          <SkeletonLoader type="table" />
        </div>
      </div>
    )
  }

  if (!customer) return <div>Customer not found</div>

  // 4.3 — Cumulative credit summary (from serializer)
  const totalBilled = parseFloat(customer.total_billed || 0)
  const totalPaid   = parseFloat(customer.paid_amount || 0)
  const outstandingBalance = parseFloat(customer.outstanding_balance ?? Math.max(0, totalBilled - totalPaid))
  const advancePaid = parseFloat(customer.advance_paid || 0)
  const totalPayable = parseFloat(customer.remaining_payable ?? customer.payable_amount) || 0

  return (
    <div className="customer-detail-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div className="page-header" style={{ marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-icon" onClick={() => navigate(`${basePath}/customers`)} style={{ background: 'var(--glass-bg)', padding: '0.5rem', borderRadius: '8px' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ fontWeight: '800', margin: 0 }}>{customer.name}</h2>
              {(customer.company_name || customer.company) && (
                <span style={{ 
                  background: 'rgba(37, 99, 235, 0.08)', 
                  color: '#2563eb', 
                  padding: '2px 8px', 
                  borderRadius: '6px', 
                  fontSize: '0.85rem', 
                  fontWeight: '600' 
                }}>
                  {customer.company_name || customer.company}
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>{customer.email} | {customer.phone}</p>
          </div>
        </div>
      </div>

      {/* 4.3 — Credit Summary Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1rem'
      }}>
        <div style={{
          background: '#ffffff', borderRadius: '10px', padding: '0.85rem 1.1rem',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Total Billed</div>
          <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0f172a' }}>{formatCurrency(totalBilled)}</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>{jobOrders.length} job order{jobOrders.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{
          background: '#ffffff', borderRadius: '10px', padding: '0.85rem 1.1rem',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Total Received</div>
          <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#16a34a' }}>{formatCurrency(totalPaid)}</div>
          {advancePaid > 0 && <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: '2px' }}>incl. {formatCurrency(advancePaid)} advance</div>}
        </div>
        <div style={{
          background: outstandingBalance > 0 ? '#fff7ed' : '#f0fdf4',
          borderRadius: '10px', padding: '0.85rem 1.1rem',
          border: `1px solid ${outstandingBalance > 0 ? '#fed7aa' : '#bbf7d0'}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: outstandingBalance > 0 ? '#c2410c' : '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
            {outstandingBalance > 0 ? '⚠ Outstanding Balance' : '✓ Fully Settled'}
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '900', color: outstandingBalance > 0 ? '#ea580c' : '#16a34a' }}>
            {formatCurrency(outstandingBalance)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>across all jobs</div>
        </div>
        <div style={{
          background: totalPayable > 0 ? '#eff6ff' : '#ffffff',
          borderRadius: '10px', padding: '0.85rem 1.1rem',
          border: `1px solid ${totalPayable > 0 ? '#bfdbfe' : '#e2e8f0'}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: totalPayable > 0 ? '#1d4ed8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
            {totalPayable > 0 ? 'Payables Owed' : 'No Payables'}
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '900', color: totalPayable > 0 ? '#2563eb' : '#64748b' }}>
            {formatCurrency(totalPayable)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
            {totalPayable > 0 ? `Total set: ${formatCurrency(customer.payable_amount || 0)}` : 'Amount owed to client'}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="tabs tabs-scrollable" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.02)' }}>
          <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')} style={tabStyle(activeTab === 'overview')}>
            <Activity size={16} /> Overview
          </button>
          <button className={`tab-btn ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')} style={tabStyle(activeTab === 'transactions')}>
            <ListOrdered size={16} /> Transactions
          </button>
          <button className={`tab-btn ${activeTab === 'statement' ? 'active' : ''}`} onClick={() => setActiveTab('statement')} style={tabStyle(activeTab === 'statement')}>
            <FileText size={16} /> Statement
          </button>
        </div>

        <div className="tab-content detail-tab-content">
          {activeTab === 'overview' && (
             <div className="timeline-container">
               <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <Clock size={20} /> Activity History
               </h3>
               {timelineData.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No activities logged.</p> : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', borderLeft: '2px solid var(--border-color)', paddingLeft: '1.5rem', marginLeft: '1rem' }}>
                    {timelineData.map((item, idx) => (
                      <div key={item.id || idx} style={{ position: 'relative' }}>
                        <div style={{ 
                          position: 'absolute', left: '-2.15rem', top: '0', 
                          width: '24px', height: '24px', borderRadius: '50%', 
                          background: item.type === 'payment' ? 'var(--success)' : item.type === 'job' ? 'var(--primary)' : item.type === 'invoice' ? '#8b5cf6' : 'var(--danger)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                        }}>
                          {item.type === 'payment' ? <CreditCard size={12} /> : item.type === 'job' ? <Box size={12} /> : item.type === 'invoice' ? <FileText size={12} /> : <Tag size={12} />}
                        </div>
                        <div className="glass-panel" style={{ padding: '1rem', marginTop: '-0.5rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderLeft: item.type === 'payment' ? '4px solid #16a34a' : (item.type === 'expense' ? '4px solid #dc2626' : '1px solid var(--border-color)') }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong>{item.type === 'payment' ? 'Payment Received' : item.type === 'job' ? 'Job Order Created' : item.type === 'invoice' ? 'Invoice Issued' : 'Expense Logged'}</strong>
                              {item.type === 'payment' && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '1px 7px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: '800' }}>
                                  <Plus size={10} strokeWidth={3} /> Cash In
                                </span>
                              )}
                              {item.type === 'expense' && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '1px 7px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: '800' }}>
                                  <Minus size={10} strokeWidth={3} /> Cash Out
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.date.toLocaleDateString()}</span>
                          </div>
                          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {item.type === 'payment' && <span style={{ color: '#16a34a', fontWeight: '800' }}>Amount: + {formatCurrency(item.data.amount)}</span>}
                            {item.type === 'job' && `${item.data.title} (${formatCurrency(item.data.total_amount)})`}
                            {item.type === 'invoice' && `Invoice #${item.data.invoice_number} (${formatCurrency(item.data.total_amount)})`}
                            {item.type === 'expense' && <span style={{ color: '#dc2626', fontWeight: '800' }}>{item.data.description} (− {formatCurrency(item.data.amount)})</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                 </div>
               )}
             </div>
          )}

          {activeTab === 'transactions' && (
             <div className="transactions-container" style={{ padding: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem' }}>
                   <button className="btn glass-panel" style={{ fontWeight: '800', fontSize: '0.8rem' }} onClick={() => navigate('/jobs')}><Plus size={16}/> New Job</button>
                   <button className="btn glass-panel" style={{ fontWeight: '800', fontSize: '0.8rem' }} onClick={() => navigate('/payments')}><Plus size={16}/> New Payment</button>
                   <button className="btn glass-panel" style={{ fontWeight: '800', fontSize: '0.8rem' }} onClick={() => navigate('/expenses')}><Plus size={16}/> Add Linked Expense</button>
                </div>
               
               <div className="transaction-section" style={{ marginBottom: '3rem' }}>
                 <h4 style={{ marginBottom: '1.25rem', fontWeight: '700', color: 'var(--text-main)', fontSize: '1rem' }}>Job Orders</h4>
                 <div className="glass-panel table-container" style={{ padding: '0 1rem', overflowX: 'auto' }}>
                   <table style={tableStyle}>
                     <thead>
                       <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                         <th style={{ padding: '1rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>ID</th>
                         <th style={{ padding: '1rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Title</th>
                         <th style={{ padding: '1rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Status</th>
                         <th style={{ padding: '1rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap' }}>Job Total</th>
                         <th style={{ padding: '1rem', fontSize: '0.72rem', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap' }}>Advance Paid</th>
                         <th style={{ padding: '1rem', fontSize: '0.72rem', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap' }}>Prior Balance</th>
                         <th style={{ padding: '1rem', fontSize: '0.72rem', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap' }}>Outstanding</th>
                         <th style={{ padding: '1rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                       </tr>
                     </thead>
                     <tbody>
                       {jobOrders.length === 0 ? (
                         <tr><td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No job orders found.</td></tr>
                       ) : jobOrders.map(j => {
                         const jobAdvance = parseFloat(j.advance_amount || 0)
                         const jobPrior   = parseFloat(j.prior_balance  || 0)
                         const jobOutstanding = parseFloat(j.outstanding_balance ?? j.balance ?? 0)
                         return (
                           <tr key={j.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                             <td style={{ padding: '1rem', color: 'var(--accent)', fontWeight: '700', whiteSpace: 'nowrap' }}>{j.order_id && j.order_id.startsWith('#') ? j.order_id : (j.order_id ? `#${j.order_id}` : `#${j.id.toString().padStart(4, '0')}`)}</td>
                             <td style={{ padding: '1rem', fontWeight: '500' }}>{j.title}</td>
                             <td style={{ padding: '1rem' }}>
                               <span style={{
                                 display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                 padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800',
                                 background: `${j.status === 'Completed' ? 'var(--success)' : 'var(--primary)'}10`,
                                 color: j.status === 'Completed' ? 'var(--success)' : 'var(--primary)',
                                 border: `1px solid ${j.status === 'Completed' ? 'var(--success)' : 'var(--primary)'}20`
                               }}>{j.status}</span>
                             </td>
                             <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800' }}>{formatCurrency(j.total_amount)}</td>
                             <td style={{ padding: '1rem', textAlign: 'right', color: '#16a34a', fontWeight: '700' }}>
                               {jobAdvance > 0 ? formatCurrency(jobAdvance) : <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>—</span>}
                             </td>
                             <td style={{ padding: '1rem', textAlign: 'right', color: '#b45309', fontWeight: '700' }}>
                               {jobPrior > 0 ? formatCurrency(jobPrior) : <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>—</span>}
                             </td>
                             <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800', color: jobOutstanding > 0 ? '#dc2626' : '#16a34a' }}>
                               {jobOutstanding > 0 ? formatCurrency(jobOutstanding) : '✓ Settled'}
                             </td>
                             <td style={{ padding: '1rem', textAlign: 'right' }}>
                               <button className="btn-icon" style={{ color: 'var(--danger)', height: '32px', width: '32px' }} onClick={() => handleDelete('job', j.id)}><Trash2 size={14}/></button>
                             </td>
                           </tr>
                         )
                       })}
                     </tbody>
                   </table>
                 </div>
               </div>

               <div className="transaction-section" style={{ marginBottom: '3rem' }}>
                 <h4 style={{ marginBottom: '1.25rem', fontWeight: '700', color: 'var(--text-main)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <span>Payments</span>
                   <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '1px 7px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: '800' }}>
                     <Plus size={10} strokeWidth={3} /> Cash In
                   </span>
                 </h4>
                 <div className="glass-panel table-container" style={{ padding: '0 1rem' }}>
                   <table style={tableStyle}>
                     <thead>
                       <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Designation</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Amount Received</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Notes</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                       </tr>
                     </thead>
                     <tbody>
                       {payments.length === 0 ? (
                         <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No payments recorded.</td></tr>
                       ) : payments.map(p => {
                         const isRefund = p.payment_type === 'refund'
                         return (
                           <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)', borderLeft: isRefund ? '4px solid #ea580c' : '4px solid #16a34a' }}>
                             <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)' }}>{p.payment_date}</td>
                             <td style={{ padding: '1.25rem 1rem' }}>
                               <span style={{
                                 display: 'inline-flex', alignItems: 'center', gap: '3px',
                                 background: isRefund ? '#ffedd5' : '#dcfce7',
                                 color: isRefund ? '#c2410c' : '#15803d',
                                 border: isRefund ? '1px solid #fed7aa' : '1px solid #bbf7d0',
                                 padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '800'
                               }}>
                                 {isRefund ? <><Minus size={10} strokeWidth={3} /> Refund / Payout</> : <><Plus size={10} strokeWidth={3} /> Cash In</>}
                               </span>
                             </td>
                             <td style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>
                               <span style={{ fontWeight: '800', color: isRefund ? '#ea580c' : '#16a34a' }}>
                                 {isRefund ? '− ' : '+ '}{formatCurrency(p.amount)}
                               </span>
                             </td>
                             <td style={{ padding: '1.25rem 1rem' }}>
                               {p.payment_type && (
                                 <span style={{
                                   display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.68rem', fontWeight: '700',
                                   background: isRefund ? '#ffedd5' : p.payment_type === 'advance' ? '#fef9c3' : p.payment_type === 'final' ? '#dcfce7' : '#f1f5f9',
                                   color: isRefund ? '#c2410c' : p.payment_type === 'advance' ? '#92400e' : p.payment_type === 'final' ? '#166534' : '#475569',
                                   marginRight: '0.4rem'
                                 }}>{p.payment_type_display || (isRefund ? 'Refund' : p.payment_type)}</span>
                               )}
                               {p.notes || ''}
                             </td>
                             <td style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>
                               <button className="btn-icon" style={{ color: 'var(--danger)', height: '32px', width: '32px' }} onClick={() => handleDelete('payment', p.id)}><Trash2 size={14}/></button>
                             </td>
                           </tr>
                         )
                       })}
                     </tbody>
                   </table>
                 </div>
               </div>

               <div className="transaction-section" style={{ marginBottom: '1.5rem' }}>
                 <h4 style={{ marginBottom: '1.25rem', fontWeight: '700', color: 'var(--text-main)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Linked Expenses</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '1px 7px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: '800' }}>
                      <Minus size={10} strokeWidth={3} /> Cash Out
                    </span>
                  </h4>
                  <div className="glass-panel table-container" style={{ padding: '0 1rem' }}>
                    <table style={tableStyle}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                          <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Designation</th>
                          <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
                          <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Amount Paid</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                       </tr>
                     </thead>
                     <tbody>
                       {expenses.length === 0 ? (
                         <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No linked expenses.</td></tr>
                       ) : expenses.map(e => (
                         <tr key={e.id} style={{ borderBottom: '1px solid var(--border-light)', borderLeft: '4px solid #dc2626' }}>
                           <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)' }}>{e.date}</td>
                           <td style={{ padding: '1.25rem 1rem' }}>
                             <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '800' }}>
                               <Minus size={10} strokeWidth={3} /> Cash Out
                             </span>
                           </td>
                           <td style={{ padding: '1.25rem 1rem' }}>{e.description}</td>
                           <td style={{ padding: '1.25rem 1rem', textAlign: 'right' }}><span style={{ fontWeight: '800', color: '#dc2626' }}>− {formatCurrency(e.amount)}</span></td>
                           <td style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>
                             <button className="btn-icon" style={{ color: 'var(--danger)', height: '32px', width: '32px' }} onClick={() => handleDelete('expense', e.id)}><Trash2 size={14}/></button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>
          )}

          {activeTab === 'statement' && (
             <div className="statement-container" style={{ padding: '0.5rem' }}>
               <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem', alignItems: 'center' }}>
                 <select className="input-field" value={statementFilter} onChange={(e) => setStatementFilter(e.target.value)} style={{ width: '220px', fontWeight: '600' }}>
                   <option value="all">All Time</option>
                   <option value="today">Today</option>
                   <option value="week">This Week</option>
                   <option value="month">This Month</option>
                   <option value="year">This Year</option>
                   <option value="custom">Custom Range</option>
                 </select>
                 {statementFilter === 'custom' && (
                   <div style={{ display: 'flex', gap: '0.5rem', animation: 'fadeIn 0.3s ease' }}>
                     <input type="date" className="input-field" value={customDates.start} onChange={e => setCustomDates({...customDates, start: e.target.value})} />
                     <input type="date" className="input-field" value={customDates.end} onChange={e => setCustomDates({...customDates, end: e.target.value})} />
                   </div>
                 )}
               </div>

                <div className="transaction-section">
                  <h4 style={{ marginBottom: '1.5rem', fontWeight: '700', color: 'var(--text-main)', fontSize: '1.1rem' }}>Detailed Transaction Statement</h4>
                  <div className="glass-panel table-container" style={{ padding: '0 1rem' }}>
                   <table style={tableStyle}>
                     <thead>
                       <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Details</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Cash Out (Debit)</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Cash In (Credit)</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Running Balance</th>
                       </tr>
                     </thead>
                     <tbody>
                       {(() => {
                         let runningBalance = balanceBroughtForward
                          const allTransactions = [
                            ...statementJobs.map(j => ({ date: j.created_at, type: 'Job Order', details: j.title, debit: parseFloat(j.total_amount || 0), credit: 0 })),
                            ...statementInvoices.map(i => ({ date: i.invoice_date || i.issue_date || i.created_at, type: 'Invoice', details: `Invoice #${i.invoice_number}`, debit: parseFloat(i.total_amount || 0), credit: 0 })),
                            ...statementPayments.map(p => {
                              const isRefund = p.payment_type === 'refund'
                              return {
                                date: p.payment_date,
                                type: isRefund ? 'Refund / Debit Payout' : 'Payment',
                                details: p.notes || (isRefund ? 'Customer Refund' : 'Payment Received'),
                                debit: isRefund ? parseFloat(p.amount || 0) : 0,
                                credit: isRefund ? 0 : parseFloat(p.amount || 0)
                              }
                            }),
                            ...statementCreditNotes.map(c => ({ date: c.credit_note_date || c.created_at, type: 'Credit Note', details: `Credit Note #${c.credit_note_number} (${c.credit_reason || 'Credit Adjustment'})`, debit: 0, credit: parseFloat(c.total_amount || 0) }))
                          ].sort((a, b) => new Date(a.date) - new Date(b.date))
                         
                         // Prepend Balance Brought Forward row if not viewing all time and if it's not zero
                         if (statementFilter !== 'all' && (bbfDebit > 0 || bbfCredit > 0)) {
                           allTransactions.unshift({
                             date: startOfPeriod.toISOString(),
                             type: 'Brought Forward',
                             details: 'Balance Brought Forward',
                             debit: bbfDebit > bbfCredit ? balanceBroughtForward : 0,
                             credit: bbfCredit > bbfDebit ? Math.abs(balanceBroughtForward) : 0,
                             isBbf: true
                           })
                         }

                         if (allTransactions.length === 0) {
                            return <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found for the selected period.</td></tr>
                         }

                         return allTransactions.map((t, i) => {
                           if (!t.isBbf) runningBalance += (t.debit - t.credit)
                           return (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border-light)', borderLeft: t.credit > 0 ? '4px solid #16a34a' : (t.debit > 0 ? '4px solid #dc2626' : '1px solid var(--border-light)') }}>
                                <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(t.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</td>
                                <td style={{ padding: '1.25rem 1rem' }}>
                                  <span style={{ 
                                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800',
                                    background: t.credit > 0 ? '#dcfce7' : '#fee2e2',
                                    color: t.credit > 0 ? '#15803d' : '#b91c1c',
                                    border: `1px solid ${t.credit > 0 ? '#bbf7d0' : '#fecaca'}`
                                  }}>
                                    {t.credit > 0 ? <Plus size={10} strokeWidth={3} /> : <Minus size={10} strokeWidth={3} />}
                                    {t.credit > 0 ? `CASH IN (${t.type.toUpperCase()})` : `CASH OUT (${t.type.toUpperCase()})`}
                                  </span>
                                </td>
                                <td style={{ padding: '1.25rem 1rem', fontWeight: '500' }}>{t.details}</td>
                                <td style={{ padding: '1.25rem 1rem', textAlign: 'right', color: '#dc2626', fontWeight: '800' }}>{t.debit > 0 ? `− ${formatCurrency(t.debit)}` : '---'}</td>
                                <td style={{ padding: '1.25rem 1rem', textAlign: 'right', color: '#16a34a', fontWeight: '800' }}>{t.credit > 0 ? `+ ${formatCurrency(t.credit)}` : '---'}</td>
                               <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontWeight: '900', color: runningBalance > 0 ? 'var(--text-main)' : 'var(--success)' }}>{formatCurrency(runningBalance)}</td>
                             </tr>
                           )
                         })
                       })()}
                     </tbody>
                   </table>
                 </div>
               </div>
               
               <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
                 Showing statements for selected period. Includes <strong>{statementJobs.length} jobs</strong>{statementInvoices.length > 0 && <>, <strong>{statementInvoices.length} invoices</strong></>} <strong>{statementPayments.length} payments</strong>{statementCreditNotes.length > 0 && <>, <strong>{statementCreditNotes.length} credit notes</strong></>}.
               </p>
             </div>
          )}
        </div>
      </div>
    </div>
  )
}

const tabStyle = (isActive) => ({
  flex: 1, minWidth: '110px', padding: '0.85rem 1rem', border: 'none', background: 'transparent',
  borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
  fontWeight: isActive ? '600' : '500', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s',
  whiteSpace: 'nowrap'
})

const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' }

export default CustomerDetail
