import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { 
  ArrowLeft, Activity, Users, FileText, CheckCircle, 
  Clock, CreditCard, Box, Plus, Edit, Trash2, ListOrdered, Tag
} from '../components/icons'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'
import Modal from '../components/common/Modal'
import SkeletonLoader from '../components/common/SkeletonLoader'
import { showConfirm, showError, showToast } from '../utils/swal'

const VendorDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const basePath = '/accounting'
  const { formatCurrency, settings } = useSettings()

  const [vendor, setVendor] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Related data
  const [expenses, setExpenses] = useState([])
  const [payments, setPayments] = useState([])
  const [labours, setLabours] = useState([])
  const [paymentRequests, setPaymentRequests] = useState([])
  const [jobOrders, setJobOrders] = useState([])

  // Modal for Payment against Job Order
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    job_order: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  })

  // Modals for Labour
  const [isLabourModalOpen, setIsLabourModalOpen] = useState(false)
  const [editingLabour, setEditingLabour] = useState(null)
  const [labourForm, setLabourForm] = useState({
    name: '', work_done: '', payment_amount: 0, date: new Date().toISOString().split('T')[0], notes: '', vendor: id
  })
  
  // Statement filters
  const [statementFilter, setStatementFilter] = useState('month')
  const [customDates, setCustomDates] = useState({ start: '', end: '' })

  useEffect(() => {
    fetchVendorData()
  }, [id])

  const fetchVendorData = async () => {
    try {
      setLoading(true)
      const vRes = await api.get(`vendors/${id}/`)
      setVendor(vRes.data)

      const [expsRes, paysRes, labsRes, reqsRes, jobsRes] = await Promise.all([
        api.get(`expenses/?vendor=${id}&nopage=true`),
        api.get(`vendor-payments/?vendor=${id}&nopage=true`),
        api.get(`labours/?vendor=${id}&nopage=true`),
        api.get(`payment-requests/?vendor=${id}&status=Approved&nopage=true`).catch(() => ({ data: [] })),
        api.get(`job-orders/?vendor=${id}&nopage=true`).catch(() => ({ data: [] }))
      ])

      const rawExps = expsRes.data?.results || expsRes.data || []
      const rawPays = paysRes.data?.results || paysRes.data || []
      const rawLabs = labsRes.data?.results || labsRes.data || []
      const rawReqs = reqsRes.data?.results || reqsRes.data || []
      const rawJobs = jobsRes.data?.results || jobsRes.data || []

      // Explicitly ensure records belong strictly to this vendor
      setExpenses(rawExps.filter(e => String(e.vendor) === String(id)))
      setPayments(rawPays.filter(p => String(p.vendor) === String(id)))
      setLabours(rawLabs.filter(l => String(l.vendor) === String(id)))
      setPaymentRequests(rawReqs.filter(r => String(r.vendor) === String(id)))
      const uniqueJobs = Array.from(new Map(rawJobs.map(j => [j.id, j])).values())
      setJobOrders(uniqueJobs.filter(j => String(j.vendor) === String(id)))

      setError('')
    } catch (err) {
      console.error(err)
      setError('Failed to fetch vendor details.')
    } finally {
      setLoading(false)
    }
  }

  // Process Payment against Job Order
  const handleOpenPaymentModal = (preselectedJobId = '') => {
    const defaultJob = jobOrders.find(j => String(j.id) === String(preselectedJobId))
    setPaymentForm({
      job_order: preselectedJobId ? String(preselectedJobId) : '',
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      notes: defaultJob ? `Payment to ${vendor?.name || 'vendor'} for Job ${defaultJob.order_id || ''}: ${defaultJob.title}`.trim() : ''
    })
    setIsPaymentModalOpen(true)
  }

  const handlePaymentSubmit = async (e) => {
    e.preventDefault()
    const amt = parseFloat(paymentForm.amount)
    if (!amt || amt <= 0 || isNaN(amt)) {
      showError('Please enter a valid payment amount greater than 0.')
      return
    }
    try {
      setPaymentSubmitting(true)
      const payload = {
        vendor: parseInt(id, 10),
        job_order: paymentForm.job_order ? parseInt(paymentForm.job_order, 10) : null,
        amount: amt,
        payment_date: paymentForm.payment_date,
        notes: paymentForm.notes?.trim() || ''
      }
      await api.post('vendor-payments/', payload)
      showToast('Payment to vendor recorded successfully!', 'success')
      setIsPaymentModalOpen(false)
      fetchVendorData()
    } catch (err) {
      console.error('Failed to record vendor payment:', err)
      showError(err.response?.data?.detail || 'Failed to record payment. Please check values and try again.')
    } finally {
      setPaymentSubmitting(false)
    }
  }

  // Labour CRUD
  const handleOpenLabourModal = (lab = null) => {
    if (lab) {
      setEditingLabour(lab)
      setLabourForm({
        name: lab.name, work_done: lab.work_done, payment_amount: lab.payment_amount, 
        date: lab.date, notes: lab.notes || '', vendor: id
      })
    } else {
      setEditingLabour(null)
      setLabourForm({
        name: '', work_done: '', payment_amount: 0, 
        date: new Date().toISOString().split('T')[0], notes: '', vendor: id
      })
    }
    setIsLabourModalOpen(true)
  }

  const handleLabourSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingLabour) {
        const res = await api.put(`labours/${editingLabour.id}/`, labourForm)
        setLabours(labours.map(l => l.id === editingLabour.id ? res.data : l))
      } else {
        const res = await api.post('labours/', labourForm)
        setLabours([res.data, ...labours])
      }
      setIsLabourModalOpen(false)
      showToast('Labour record saved successfully')
    } catch (err) {
      showError('Save Failed', 'Failed to save labour record.')
    }
  }

  const handleDeleteLabour = async (labId) => {
    const confirmed = await showConfirm({
      title: 'Delete Labour Record?',
      text: 'Are you sure you want to delete this labour record? This cannot be undone.',
      confirmButtonText: 'Yes, delete',
      isDangerous: true
    })
    if (!confirmed) return
    try {
      await api.delete(`labours/${labId}/`)
      setLabours(labours.filter(l => l.id !== labId))
      showToast('Labour record deleted successfully')
    } catch (err) {
      showError('Delete Failed', 'Failed to delete labour record.')
    }
  }

  // Generating Timeline (Overview)
  const timelineData = [
    ...jobOrders.map(j => ({ type: 'job', date: new Date(j.created_at), data: j })),
    ...expenses.map(e => ({ type: 'expense', date: new Date(e.date || e.created_at), data: e })),
    ...payments.map(p => ({ type: 'payment', date: new Date(p.payment_date || p.created_at), data: p })),
    ...paymentRequests.map(r => ({ type: 'payment_req', date: new Date(r.created_at), data: r })),
    ...labours.map(l => ({ type: 'labour', date: new Date(l.date || l.created_at), data: l }))
  ].sort((a, b) => b.date - a.date)

  // Calculating Statement Data
  const getFilteredData = (dataList, dateField) => {
    const now = new Date()
    return dataList.filter(item => {
      const rawDate = item[dateField] || item.date || item.payment_date || item.created_at
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

  const statementExpenses = getFilteredData(expenses, 'date')
  const statementPayments = getFilteredData(payments, 'payment_date')
  const statementPaymentRequests = getFilteredData(paymentRequests, 'created_at')
  const statementLabours = getFilteredData(labours, 'date')

  const totalExpenseAmount = statementExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
  const totalLabourAmount = statementLabours.reduce((sum, l) => sum + parseFloat(l.payment_amount || 0), 0)
  const totalBilled = totalExpenseAmount + totalLabourAmount
  const totalOwed = totalBilled + parseFloat(vendor?.opening_balance || 0)
  
  const paidAmount = statementPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) +
                     statementPaymentRequests.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)
  const pendingAmount = totalOwed - paidAmount

  if (loading && !vendor) {
    return (
      <div className="vendor-detail-page" style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        <SkeletonLoader type="form" />
      </div>
    )
  }

  if (!vendor) return <div>Vendor not found</div>

  return (
    <div className="vendor-detail-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-icon" onClick={() => navigate(`${basePath}/vendors`)} style={{ background: 'var(--glass-bg)', padding: '0.5rem', borderRadius: '8px' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 style={{ fontWeight: '800', margin: 0 }}>{vendor.name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>{vendor.company} | Opening Balance: {formatCurrency(vendor.opening_balance)}</p>
          </div>
        </div>
      </div>

      {/* Credit / Balance Summary Banner (Structured like Customer) */}
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
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Total Procurement / Billed</div>
          <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0f172a' }}>{formatCurrency(totalOwed)}</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>{jobOrders.length} job order{jobOrders.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{
          background: '#ffffff', borderRadius: '10px', padding: '0.85rem 1.1rem',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Total Paid Out</div>
          <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#16a34a' }}>{formatCurrency(paidAmount)}</div>
          <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: '2px' }}>settled payments</div>
        </div>
        <div style={{
          background: pendingAmount > 0 ? '#fff7ed' : '#f0fdf4',
          borderRadius: '10px', padding: '0.85rem 1.1rem',
          border: `1px solid ${pendingAmount > 0 ? '#fed7aa' : '#bbf7d0'}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: pendingAmount > 0 ? '#c2410c' : '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
            {pendingAmount > 0 ? '⚠ Outstanding Payable' : '✓ Fully Settled'}
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '900', color: pendingAmount > 0 ? '#ea580c' : '#16a34a' }}>
            {formatCurrency(pendingAmount)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>across all jobs & purchases</div>
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
          <button className={`tab-btn ${activeTab === 'labours' ? 'active' : ''}`} onClick={() => setActiveTab('labours')} style={tabStyle(activeTab === 'labours')}>
            <Users size={16} /> Labours
          </button>
        </div>

        <div className="tab-content detail-tab-content">
          {loading && vendor ? (
             <div style={{ marginTop: '1rem' }}>
               <SkeletonLoader type={activeTab === 'overview' ? 'tree' : activeTab === 'statement' ? 'table' : activeTab === 'transactions' ? 'table' : 'cards'} />
             </div>
          ) : (
             <>
          {activeTab === 'overview' && (
             <div className="timeline-container">
               <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <Clock size={20} /> Vendor Activity History
               </h3>
               {timelineData.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No activities logged.</p> : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', borderLeft: '2px solid var(--border-color)', paddingLeft: '1.5rem', marginLeft: '1rem' }}>
                   {timelineData.map((item, idx) => (
                     <div key={idx} style={{ position: 'relative' }}>
                       <div style={{ 
                         position: 'absolute', left: '-2.15rem', top: '0', 
                         width: '24px', height: '24px', borderRadius: '50%', 
                         background: (item.type === 'payment' || item.type === 'payment_req') ? 'var(--success)' : item.type === 'expense' ? 'var(--primary)' : 'var(--warning)',
                         display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                       }}>
                         {(item.type === 'payment' || item.type === 'payment_req') ? <CreditCard size={12} /> : item.type === 'expense' ? <FileText size={12} /> : <Users size={12} />}
                       </div>
                        <div className="glass-panel" style={{ padding: '1rem', marginTop: '-0.5rem', border: '1px solid var(--border-color)' }}>
                          <strong>{(item.type === 'payment' || item.type === 'payment_req') ? 'Payment Outward' : item.type === 'expense' ? 'Purchase / Expense Logged' : 'Labour Logged'}</strong>
                          <span style={{ float: 'right', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.date.toLocaleDateString()}</span>
                          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {item.type === 'payment' && `Amount Paid: ${formatCurrency(item.data.amount)}`}
                            {item.type === 'payment_req' && `Approved Request: ${formatCurrency(item.data.amount)}`}
                            {item.type === 'expense' && `${item.data.description || item.data.category} (${formatCurrency(item.data.amount)})`}
                            {item.type === 'labour' && `${item.data.name}: ${item.data.work_done} (${formatCurrency(item.data.payment_amount)})`}
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
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" style={{ fontWeight: '700', fontSize: '0.82rem' }} onClick={() => handleOpenPaymentModal()}><Plus size={15}/> Process Payment</button>
                <button className="btn glass-panel" style={{ fontWeight: '700', fontSize: '0.82rem' }} onClick={() => navigate('/jobs')}><Plus size={15}/> New Job Order</button>
                <button className="btn glass-panel" style={{ fontWeight: '700', fontSize: '0.82rem' }} onClick={() => handleOpenLabourModal()}><Plus size={15}/> Add Labour</button>
              </div>

              {/* Job Orders Section */}
              <div className="transaction-section" style={{ marginBottom: '3rem' }}>
                <h4 style={{ marginBottom: '1.25rem', fontWeight: '700', color: 'var(--text-main)', fontSize: '1rem' }}>Job Orders</h4>
                <div className="glass-panel table-container" style={{ padding: '0 1rem', overflowX: 'auto' }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '1rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Contract ID</th>
                        <th style={{ padding: '1rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Title</th>
                        <th style={{ padding: '1rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Customer</th>
                        <th style={{ padding: '1rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Status</th>
                        <th style={{ padding: '1rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap' }}>Job Total</th>
                        <th style={{ padding: '1rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobOrders.length === 0 ? (
                        <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No job orders linked to this vendor yet.</td></tr>
                      ) : jobOrders.map(j => (
                        <tr key={j.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '1rem', color: 'var(--accent)', fontWeight: '700', whiteSpace: 'nowrap' }}>{j.order_id && j.order_id.startsWith('#') ? j.order_id : (j.order_id ? `#${j.order_id}` : `#${j.id.toString().padStart(4, '0')}`)}</td>
                          <td style={{ padding: '1rem', fontWeight: '600' }}>{j.title}</td>
                          <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{j.customer_name || '---'}</td>
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
                          <td style={{ padding: '1rem', textAlign: 'right' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', fontWeight: '700' }}
                              onClick={() => handleOpenPaymentModal(j.id)}
                            >
                              Pay Against Job
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Purchases & Expenses Section */}
              <div className="transaction-section" style={{ marginBottom: '3rem' }}>
                <h4 style={{ marginBottom: '1.25rem', fontWeight: '700', color: 'var(--text-main)', fontSize: '1rem' }}>Purchases & Expenses</h4>
                <div className="glass-panel table-container" style={{ padding: '0 1rem' }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                        <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
                        <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Job Order</th>
                        <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                        <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.length === 0 ? (
                        <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No purchases or expenses recorded for this vendor.</td></tr>
                      ) : expenses.map(e => (
                        <tr key={e.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{e.date}</td>
                          <td style={{ padding: '1.25rem 1rem', fontWeight: '500' }}>{e.description}</td>
                          <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)' }}>
                            {e.job_order_title ? `${e.job_order_number ? `[${e.job_order_number}] ` : ''}${e.job_order_title}` : '---'}
                          </td>
                          <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)' }}>{e.category || '---'}</td>
                          <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontWeight: '800', color: 'var(--danger)' }}>{formatCurrency(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Outward Payments Section */}
              <div className="transaction-section" style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1.25rem', fontWeight: '700', color: 'var(--text-main)', fontSize: '1rem' }}>Outward Payments</h4>
                <div className="glass-panel table-container" style={{ padding: '0 1rem' }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                        <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Job Order</th>
                        <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes / Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 && paymentRequests.length === 0 ? (
                        <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No payments recorded.</td></tr>
                      ) : (
                        <>
                          {payments.map(p => (
                            <tr key={`p-${p.id}`} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)' }}>{p.payment_date}</td>
                              <td style={{ padding: '1.25rem 1rem', textAlign: 'right' }}><span style={{ fontWeight: '800', color: 'var(--success)' }}>{formatCurrency(p.amount)}</span></td>
                              <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)' }}>
                                {p.job_order_title ? `${p.job_order_number ? `[${p.job_order_number}] ` : ''}${p.job_order_title}` : 'General Vendor Payment'}
                              </td>
                              <td style={{ padding: '1.25rem 1rem' }}>{p.notes || 'Vendor Payment'}</td>
                            </tr>
                          ))}
                          {paymentRequests.map(r => (
                            <tr key={`r-${r.id}`} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '---'}</td>
                              <td style={{ padding: '1.25rem 1rem', textAlign: 'right' }}><span style={{ fontWeight: '800', color: 'var(--success)' }}>{formatCurrency(r.amount)}</span></td>
                              <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)' }}>---</td>
                              <td style={{ padding: '1.25rem 1rem' }}>{`Approved Request: ${r.description || ''}`}</td>
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'statement' && (
             <div className="statement-container">
               <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
                 <select className="input-field" value={statementFilter} onChange={(e) => setStatementFilter(e.target.value)} style={{ width: '200px' }}>
                   <option value="today">Today</option>
                   <option value="week">This Week</option>
                   <option value="month">This Month</option>
                   <option value="year">This Year</option>
                   <option value="custom">Custom Range</option>
                 </select>
                 {statementFilter === 'custom' && (
                   <div style={{ display: 'flex', gap: '0.5rem' }}>
                     <input type="date" className="input-field" value={customDates.start} onChange={e => setCustomDates({...customDates, start: e.target.value})} />
                     <input type="date" className="input-field" value={customDates.end} onChange={e => setCustomDates({...customDates, end: e.target.value})} />
                   </div>
                 )}
               </div>

                <div className="summary-cards-grid">
                 <div className="glass-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
                   <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Owed (Inc. Opening)</p>
                   <h2 style={{ color: 'var(--primary)' }}>{formatCurrency(totalOwed)}</h2>
                 </div>
                 <div className="glass-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
                   <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Paid Amount</p>
                   <h2 style={{ color: 'var(--success)' }}>{formatCurrency(paidAmount)}</h2>
                 </div>
                 <div className="glass-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
                   <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Pending Balance</p>
                   <h2 style={{ color: pendingAmount > 0 ? 'var(--danger)' : 'var(--text-main)' }}>{formatCurrency(pendingAmount)}</h2>
                 </div>
               </div>

                 <div className="transaction-section">
                   <h4 style={{ marginBottom: '1.5rem', fontWeight: '700', color: 'var(--text-main)', fontSize: '1rem' }}>Comprehensive Vendor Statement</h4>
                   <div className="glass-panel table-container" style={{ padding: '0 1rem' }}>
                    <table style={tableStyle}>
                     <thead>
                       <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>DATE</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>TYPE</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>DETAILS</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textAlign: 'right' }}>DEBIT (+)</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textAlign: 'right' }}>CREDIT (-)</th>
                         <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textAlign: 'right' }}>BALANCE</th>
                       </tr>
                     </thead>
                     <tbody>
                       {(() => {
                         let runningBalance = parseFloat(vendor?.opening_balance || 0)
                         const hasOpening = runningBalance > 0
                         
                         const allTransactions = [
                           ...statementExpenses.map(e => ({ date: e.date, type: 'Expense', details: e.description || e.category || 'Vendor Purchase', debit: parseFloat(e.amount || 0), credit: 0 })),
                           ...statementLabours.map(l => ({ date: l.date, type: 'Labour', details: `${l.name}: ${l.work_done}`, debit: parseFloat(l.payment_amount || 0), credit: 0 })),
                           ...statementPayments.map(p => ({ date: p.payment_date, type: 'Payment', details: p.notes || 'Payment Outward', debit: 0, credit: parseFloat(p.amount || 0) })),
                           ...statementPaymentRequests.map(r => ({ date: r.created_at, type: 'Payment Request', details: `Approved Request: ${r.description || ''}`, debit: 0, credit: parseFloat(r.amount || 0) }))
                         ].sort((a, b) => new Date(a.date) - new Date(b.date))

                         const noTrx = allTransactions.length === 0 && !hasOpening

                         return (
                           <>
                             {hasOpening && (
                               <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                                 <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>---</td>
                                 <td style={{ padding: '1.25rem 1rem' }}>
                                   <span style={{ 
                                     display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                     padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800',
                                     background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)',
                                     border: '1px solid rgba(245, 158, 11, 0.2)'
                                   }}>
                                     <Activity size={10}/> OPENING BALANCE
                                   </span>
                                 </td>
                                 <td style={{ padding: '1.25rem 1rem', fontWeight: '500' }}>Initial System Balance</td>
                                 <td style={{ padding: '1.25rem 1rem', textAlign: 'right', color: 'var(--danger)', fontWeight: '600' }}>{formatCurrency(vendor.opening_balance)}</td>
                                 <td style={{ padding: '1.25rem 1rem', textAlign: 'right', color: 'var(--success)', fontWeight: '600' }}>---</td>
                                 <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontWeight: '900', color: 'var(--danger)' }}>{formatCurrency(vendor.opening_balance)}</td>
                               </tr>
                             )}
                             {noTrx && <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found for the selected period.</td></tr>}
                             {allTransactions.map((t, i) => {
                               runningBalance += (t.debit - t.credit)
                               return (
                                 <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                   <td style={{ padding: '1.25rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(t.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</td>
                                   <td style={{ padding: '1.25rem 1rem' }}>
                                     <span style={{ 
                                       display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                       padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800',
                                       background: t.debit > 0 ? 'rgba(15, 23, 42, 0.05)' : 'rgba(16, 185, 129, 0.1)',
                                       color: t.debit > 0 ? 'var(--text-main)' : 'var(--success)',
                                       border: `1px solid ${t.debit > 0 ? 'rgba(15, 23, 42, 0.1)' : 'rgba(16, 185, 129, 0.2)'}`
                                     }}>
                                       {t.debit > 0 ? (t.type === 'Expense' ? <FileText size={10}/> : <Users size={10}/>) : <CreditCard size={10}/>}
                                       {t.type.toUpperCase()}
                                     </span>
                                   </td>
                                   <td style={{ padding: '1.25rem 1rem', fontWeight: '500' }}>{t.details}</td>
                                   <td style={{ padding: '1.25rem 1rem', textAlign: 'right', color: 'var(--danger)', fontWeight: '600' }}>{t.debit > 0 ? formatCurrency(t.debit) : '---'}</td>
                                   <td style={{ padding: '1.25rem 1rem', textAlign: 'right', color: 'var(--success)', fontWeight: '600' }}>{t.credit > 0 ? formatCurrency(t.credit) : '---'}</td>
                                   <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontWeight: '900', color: runningBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(runningBalance)}</td>
                                 </tr>
                               )
                             })}
                           </>
                         )
                       })()}
                     </tbody>
                   </table>
                  </div>
                </div>
               
               <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Showing statements for selected period. Includes {statementExpenses.length} purchases/expenses, {statementLabours.length} labours, and {statementPayments.length + statementPaymentRequests.length} payments.</p>
             </div>
          )}

          {activeTab === 'labours' && (
             <div className="labours-container">
               <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                  <button className="btn btn-primary" onClick={() => handleOpenLabourModal()}><Plus size={16}/> Record Labour</button>
               </div>
               
               <div className="table-container">
                 <table style={tableStyle} className="mb-4">
                 <thead><tr><th>Date</th><th>Attendant Name</th><th>Work Specifics</th><th>Cost</th><th>Actions</th></tr></thead>
                 <tbody>
                   {labours.map(l => (
                     <tr key={l.id}>
                       <td>{l.date}</td><td>{l.name}</td><td>{l.work_done}</td><td className="text-danger">{formatCurrency(l.payment_amount)}</td>
                       <td>
                         <button className="btn-icon" onClick={() => handleOpenLabourModal(l)}><Edit size={16}/></button>
                         <button className="btn-icon text-danger" onClick={() => handleDeleteLabour(l.id)}><Trash2 size={16}/></button>
                       </td>
                     </tr>
                   ))}
                   {labours.length === 0 && <tr><td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>No labour records found</td></tr>}
                 </tbody>
                 </table>
               </div>
             </div>
          )}
             </>
          )}
        </div>
      </div>

      <Modal isOpen={isLabourModalOpen} onClose={() => setIsLabourModalOpen(false)} title={editingLabour ? 'Edit Labour Record' : 'Log New Labour Activity'}>
        <form onSubmit={handleLabourSubmit}>
          <div className="form-group mb-3">
            <label>Name</label>
            <input type="text" className="input-field" required value={labourForm.name} onChange={e => setLabourForm({...labourForm, name: e.target.value})} />
          </div>
          <div className="form-group mb-3">
            <label>Work Done</label>
            <textarea className="input-field" value={labourForm.work_done} onChange={e => setLabourForm({...labourForm, work_done: e.target.value})}></textarea>
          </div>
          <div className="form-group mb-3">
            <label>Payment Amount</label>
            <input type="number" step="0.01" className="input-field" required value={labourForm.payment_amount} onChange={e => setLabourForm({...labourForm, payment_amount: e.target.value})} />
          </div>
          <div className="form-group mb-3">
            <label>Date</label>
            <input type="date" className="input-field" required value={labourForm.date} onChange={e => setLabourForm({...labourForm, date: e.target.value})} />
          </div>
          <div className="form-group mb-3">
            <label>Notes</label>
            <textarea className="input-field" value={labourForm.notes} onChange={e => setLabourForm({...labourForm, notes: e.target.value})}></textarea>
          </div>
          <div className="flex-end gap-2 mt-4 pt-4 border-t">
            <button type="button" className="btn btn-secondary" onClick={() => setIsLabourModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Record</button>
          </div>
        </form>
      </Modal>

      {/* Process Payment against Job Order Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={`Process Payment to ${vendor?.name || 'Vendor'}`}>
        <form onSubmit={handlePaymentSubmit}>
          <div className="form-group mb-3">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '700' }}>
              <span>Apply Against Job Order</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '500' }}>Optional — partial payments supported</span>
            </label>
            <select
              className="input-field"
              value={paymentForm.job_order}
              onChange={(e) => {
                const jId = e.target.value
                const selectedJob = jobOrders.find(j => String(j.id) === String(jId))
                setPaymentForm(prev => ({
                  ...prev,
                  job_order: jId,
                  notes: selectedJob ? `Payment to ${vendor?.name || 'vendor'} for Job ${selectedJob.order_id || ''}: ${selectedJob.title}`.trim() : prev.notes
                }))
              }}
              style={{ width: '100%', cursor: 'pointer' }}
            >
              <option value="">-- None (General Vendor Account Settlement) --</option>
              {jobOrders.map(j => (
                <option key={j.id} value={j.id}>
                  {j.order_id ? `[${j.order_id}] ` : ''}{j.title} (Job Total: {formatCurrency(j.total_amount)})
                </option>
              ))}
            </select>
          </div>

          {/* Job Order summary chip if selected */}
          {(() => {
            const selectedJob = jobOrders.find(j => String(j.id) === String(paymentForm.job_order))
            if (!selectedJob) return null
            const total = parseFloat(selectedJob.total_amount) || 0
            const vendorCosts = (parseFloat(selectedJob.vendor_labor_costs) || 0) + (parseFloat(selectedJob.purchase_expenses) || 0)
            return (
              <div style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                marginBottom: '1rem',
                fontSize: '0.8rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <strong>{selectedJob.order_id ? `${selectedJob.order_id} — ` : ''}{selectedJob.title}</strong>
                  <div style={{ fontSize: '0.74rem', color: '#0284c7', marginTop: '2px' }}>
                    Job Total: <strong>{formatCurrency(total)}</strong> • Direct Costs: <strong>{formatCurrency(vendorCosts)}</strong>
                  </div>
                </div>
              </div>
            )
          })()}

          <div className="form-group mb-3">
            <label style={{ fontWeight: '700' }}>Amount to Pay ({settings?.currency || 'SAR'}) *</label>
            <input
              type="number"
              step="0.01"
              className="input-field"
              required
              value={paymentForm.amount}
              onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
              autoFocus
            />
          </div>

          <div className="form-group mb-3">
            <label style={{ fontWeight: '700' }}>Payment Date *</label>
            <input
              type="date"
              className="input-field"
              required
              value={paymentForm.payment_date}
              onChange={e => setPaymentForm({...paymentForm, payment_date: e.target.value})}
            />
          </div>

          <div className="form-group mb-3">
            <label style={{ fontWeight: '700' }}>Notes / Payment Method / Reference #</label>
            <textarea
              className="input-field"
              rows={2}
              value={paymentForm.notes}
              onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})}
            />
          </div>

          <div className="flex-end gap-2 mt-4 pt-4 border-t">
            <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={paymentSubmitting}>
              {paymentSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

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

export default VendorDetail
