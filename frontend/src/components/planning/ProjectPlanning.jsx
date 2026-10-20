import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import api from '../../api'
import { 
  Plus, Search, Filter, Edit2, Trash2, Calendar, 
  Wrench, Users, Briefcase, FileText, Check, X, 
  AlertCircle, CheckCircle2, RefreshCw, Clock, ChevronDown,
  Layers, HardHat
} from '../icons'
import SearchBar from '../common/SearchBar'
import { showConfirm, showError, showToast } from '../../utils/swal'

const STATUS_COLORS = {
  'Planned': { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
  'In Progress': { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  'Completed': { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
  'On Hold': { bg: 'rgba(148, 163, 184, 0.15)', color: '#64748b', border: 'rgba(148, 163, 184, 0.3)' }
}

const ProjectPlanning = ({ jobOrders = [], onRefreshJobs }) => {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Catalogs for future entry suggestions
  const [savedTools, setSavedTools] = useState([])
  const [savedWorkers, setSavedWorkers] = useState([])

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [jobFilter, setJobFilter] = useState('All')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState(null)
  
  // Form State
  const [formData, setFormData] = useState({
    title: '',
    job_order: '',
    status: 'Planned',
    start_date: '',
    end_date: '',
    description: '',
    tools: [],
    workers: []
  })

  // Tag input buffers
  const [toolInput, setToolInput] = useState('')
  const [showToolSuggestions, setShowToolSuggestions] = useState(false)
  const [workerInput, setWorkerInput] = useState('')
  const [showWorkerSuggestions, setShowWorkerSuggestions] = useState(false)

  const toolDropdownRef = useRef(null)
  const workerDropdownRef = useRef(null)

  useEffect(() => {
    fetchPlans()
    fetchCatalogs()
  }, [])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolDropdownRef.current && !toolDropdownRef.current.contains(e.target)) {
        setShowToolSuggestions(false)
      }
      if (workerDropdownRef.current && !workerDropdownRef.current.contains(e.target)) {
        setShowWorkerSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const res = await api.get('/project-plans/')
      const data = res.data?.results ? res.data.results : res.data
      setPlans(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err) {
      console.error('Error fetching plans:', err)
      setError('Failed to load project plans.')
    } finally {
      setLoading(false)
    }
  }

  const fetchCatalogs = async () => {
    try {
      const [toolsRes, workersRes] = await Promise.all([
        api.get('/planning-tools/'),
        api.get('/planning-workers/')
      ])
      const toolsData = toolsRes.data?.results ? toolsRes.data.results : toolsRes.data
      const workersData = workersRes.data?.results ? workersRes.data.results : workersRes.data
      setSavedTools(Array.isArray(toolsData) ? toolsData : [])
      setSavedWorkers(Array.isArray(workersData) ? workersData : [])
    } catch (err) {
      console.error('Error fetching catalogs:', err)
    }
  }

  const handleOpenCreateModal = () => {
    setEditingPlanId(null)
    setFormData({
      title: '',
      job_order: '',
      status: 'Planned',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      description: '',
      tools: [],
      workers: []
    })
    setToolInput('')
    setWorkerInput('')
    setIsModalOpen(true)
    setError(null)
  }

  const handleOpenEditModal = (plan) => {
    setEditingPlanId(plan.id)
    setFormData({
      title: plan.title || '',
      job_order: plan.job_order || '',
      status: plan.status || 'Planned',
      start_date: plan.start_date || '',
      end_date: plan.end_date || '',
      description: plan.description || '',
      tools: Array.isArray(plan.tools) ? [...plan.tools] : [],
      workers: Array.isArray(plan.workers) ? [...plan.workers] : []
    })
    setToolInput('')
    setWorkerInput('')
    setIsModalOpen(true)
    setError(null)
  }

  const handleAddTool = (toolName) => {
    const trimmed = (toolName || toolInput).trim()
    if (!trimmed) return
    if (!formData.tools.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        tools: [...prev.tools, trimmed]
      }))
    }
    setToolInput('')
    setShowToolSuggestions(false)
  }

  const handleRemoveTool = (toolToRemove) => {
    setFormData(prev => ({
      ...prev,
      tools: prev.tools.filter(t => t !== toolToRemove)
    }))
  }

  const handleAddWorker = (workerName) => {
    const trimmed = (workerName || workerInput).trim()
    if (!trimmed) return
    if (!formData.workers.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        workers: [...prev.workers, trimmed]
      }))
    }
    setWorkerInput('')
    setShowWorkerSuggestions(false)
  }

  const handleRemoveWorker = (workerToRemove) => {
    setFormData(prev => ({
      ...prev,
      workers: prev.workers.filter(w => w !== workerToRemove)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      setError('Please provide a title for the Project Plan.')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const payload = {
        title: formData.title.trim(),
        job_order: formData.job_order || null,
        status: formData.status,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        description: formData.description,
        tools: formData.tools,
        workers: formData.workers
      }

      if (editingPlanId) {
        await api.put(`/project-plans/${editingPlanId}/`, payload)
        setSuccessMsg('Project plan updated successfully!')
      } else {
        await api.post('/project-plans/', payload)
        setSuccessMsg('New project plan created successfully!')
      }

      setIsModalOpen(false)
      fetchPlans()
      fetchCatalogs()
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err) {
      console.error('Error saving project plan:', err)
      setError(err.response?.data?.detail || 'Failed to save project plan.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (planId) => {
    const confirmed = await showConfirm({
      title: 'Delete Project Plan?',
      text: 'Are you sure you want to delete this project plan? This cannot be undone.',
      confirmButtonText: 'Yes, delete',
      isDangerous: true
    })
    if (!confirmed) return
    try {
      await api.delete(`/project-plans/${planId}/`)
      setPlans(prev => prev.filter(p => p.id !== planId))
      showToast('Project plan deleted successfully')
    } catch (err) {
      console.error('Error deleting plan:', err)
      showError('Delete Failed', 'Failed to delete project plan.')
    }
  }

  // Filtered plans
  const filteredPlans = plans.filter(p => {
    const matchesSearch = 
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.job_order_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.job_order_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (Array.isArray(p.tools) && p.tools.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))) ||
      (Array.isArray(p.workers) && p.workers.some(w => w.toLowerCase().includes(searchQuery.toLowerCase())))

    const matchesStatus = statusFilter === 'All' || p.status === statusFilter
    const matchesJob = jobFilter === 'All' || String(p.job_order) === String(jobFilter)

    return matchesSearch && matchesStatus && matchesJob
  })

  // Metrics
  const totalPlans = plans.length
  const inProgressPlans = plans.filter(p => p.status === 'In Progress').length
  const completedPlans = plans.filter(p => p.status === 'Completed').length
  const uniqueTools = new Set(plans.flatMap(p => p.tools || [])).size
  const uniqueWorkers = new Set(plans.flatMap(p => p.workers || [])).size

  return (
    <div className="project-planning-container" style={{ width: '100%', maxWidth: '100%' }}>
      {/* Notifications */}
      {successMsg && (
        <div className="success-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}
      {error && (
        <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="summary-cards-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Layers size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>TOTAL PLANS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>{totalPlans}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>IN PROGRESS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#f59e0b' }}>{inProgressPlans}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>COMPLETED</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>{completedPlans}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HardHat size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>ACTIVE TEAMS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>
              {uniqueWorkers} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>workers / {uniqueTools} tools</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action and Filter Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: '240px' }}>
          <SearchBar
            value={searchQuery}
            onChange={(val) => setSearchQuery(val)}
            style={{ flex: '1 1 240px', minWidth: '220px', maxWidth: '420px' }}
          />
          <div style={{ flex: '1 1 130px', minWidth: '120px' }}>
            <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Planned">Planned</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>
          {jobOrders.length > 0 && (
            <div style={{ flex: '1 1 180px', minWidth: '150px' }}>
              <select className="input-field" value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
                <option value="All">All Job Orders</option>
                {jobOrders.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.order_id || `#AS${j.id}`} - {j.title?.substring(0, 20)}...
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={fetchPlans} title="Refresh Plans" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-primary" onClick={handleOpenCreateModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
            <Plus size={18} /> Create Project Plan
          </button>
        </div>
      </div>

      {/* Plans List / Grid */}
      {loading && plans.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="spin" style={{ margin: '0 auto 1rem', display: 'block' }} />
          Loading project plans...
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <Layers size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
          <h4 style={{ fontWeight: '700', marginBottom: '0.5rem' }}>No Project Plans Found</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            {searchQuery || statusFilter !== 'All' || jobFilter !== 'All' 
              ? 'No plans match your current search and filter parameters.' 
              : 'Create multiple project plans for your job orders with customized tools and worker rosters.'}
          </p>
          <button className="btn btn-primary" onClick={handleOpenCreateModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Create First Project Plan
          </button>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflowX: 'auto', borderRadius: '12px' }}>
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--border-light)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '220px' }}>Plan Title & Scope</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '180px' }}>Contract / Client</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '150px' }}>Timeline</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '200px' }}>Tools Required</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '200px' }}>Assigned Workers</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '120px' }}>Status</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', minWidth: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map((plan) => {
                  const statusConfig = STATUS_COLORS[plan.status] || STATUS_COLORS['Planned']
                  return (
                    <tr 
                      key={plan.id}
                      style={{ 
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.015)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Plan Title & Scope */}
                      <td style={{ padding: '1rem 1.25rem', verticalAlign: 'top', maxWidth: '280px' }}>
                        <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                          {plan.title}
                        </div>
                        {plan.description && (
                          <div style={{ 
                            fontSize: '0.8rem', 
                            color: 'var(--text-muted)', 
                            lineHeight: 1.4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {plan.description}
                          </div>
                        )}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '0.35rem' }}>
                          Created {new Date(plan.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Contract / Client */}
                      <td style={{ padding: '1rem 1.25rem', verticalAlign: 'top', maxWidth: '200px' }}>
                        {plan.job_order_title ? (
                          <div>
                            <span style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.75rem', 
                              fontWeight: '800', 
                              color: 'var(--primary)',
                              background: 'var(--border-light)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              marginBottom: '0.25rem'
                            }}>
                              <Briefcase size={12} />
                              {plan.job_order_code || `#AS${plan.job_order}`}
                            </span>
                            <div style={{ fontSize: '0.825rem', fontWeight: '600', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {plan.job_order_title}
                            </div>
                            {plan.customer_name && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {plan.customer_name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Standalone Plan
                          </span>
                        )}
                      </td>

                      {/* Timeline */}
                      <td style={{ padding: '1rem 1.25rem', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        {(plan.start_date || plan.end_date) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                              <span>{plan.start_date || 'TBD'}</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '1rem' }}>
                              to {plan.end_date || 'Open'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unscheduled</span>
                        )}
                      </td>

                      {/* Tools Required */}
                      <td style={{ padding: '1rem 1.25rem', verticalAlign: 'top', maxWidth: '240px' }}>
                        {Array.isArray(plan.tools) && plan.tools.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {plan.tools.map((tool, tIdx) => (
                              <span 
                                key={tIdx}
                                style={{
                                  fontSize: '0.725rem',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '6px',
                                  background: 'rgba(59, 130, 246, 0.08)',
                                  color: '#2563eb',
                                  border: '1px solid rgba(59, 130, 246, 0.2)',
                                  fontWeight: '600',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>None specified</span>
                        )}
                      </td>

                      {/* Assigned Workers */}
                      <td style={{ padding: '1rem 1.25rem', verticalAlign: 'top', maxWidth: '240px' }}>
                        {Array.isArray(plan.workers) && plan.workers.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {plan.workers.map((worker, wIdx) => (
                              <span 
                                key={wIdx}
                                style={{
                                  fontSize: '0.725rem',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '6px',
                                  background: 'rgba(16, 185, 129, 0.08)',
                                  color: '#059669',
                                  border: '1px solid rgba(16, 185, 129, 0.2)',
                                  fontWeight: '600',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {worker}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>None assigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '1rem 1.25rem', verticalAlign: 'top' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          padding: '0.3rem 0.75rem',
                          borderRadius: '999px',
                          background: statusConfig.bg,
                          color: statusConfig.color,
                          border: `1px solid ${statusConfig.border}`,
                          display: 'inline-block',
                          whiteSpace: 'nowrap'
                        }}>
                          {plan.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem 1.25rem', verticalAlign: 'top', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            className="btn-icon"
                            onClick={() => handleOpenEditModal(plan)}
                            title="Edit Plan"
                            style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--border-light)' }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => handleDelete(plan.id)}
                            title="Delete Plan"
                            style={{ width: '32px', height: '32px', borderRadius: '6px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.08)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Plan Modal */}
      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => !saving && setIsModalOpen(false)}>
          <div 
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '680px', 
              width: '100%', 
              maxHeight: '90vh', 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden',
              background: 'var(--card-bg, #ffffff)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px'
            }}
          >
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--border-color)', flexShrink: 0, background: 'var(--card-bg, #ffffff)' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: '800', fontSize: '1.25rem', color: 'var(--text-main)' }}>
                  {editingPlanId ? 'Edit Project Plan' : 'Create Project Plan'}
                </h3>
                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                  Allocate equipment, tools, and workforces with auto-persisted catalogs
                </p>
              </div>
              <button className="btn-icon" onClick={() => !saving && setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: '1.75rem', flex: 1, background: 'var(--card-bg, #ffffff)' }}>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                {/* Plan Title */}
                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.35rem', display: 'block' }}>
                    Plan Title <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                {/* Job Order & Status */}
                <div className="form-grid">
                  <div className="form-group">
                    <label style={{ fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.35rem', display: 'block' }}>
                      Associated Job Order
                    </label>
                    <select
                      className="input-field"
                      value={formData.job_order}
                      onChange={(e) => setFormData({ ...formData, job_order: e.target.value })}
                    >
                      <option value="">-- Standalone / General Plan --</option>
                      {jobOrders.map(j => (
                        <option key={j.id} value={j.id}>
                          {j.order_id || `#AS${j.id}`} - {j.title} ({j.customer_name || 'Customer'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.35rem', display: 'block' }}>
                      Plan Status
                    </label>
                    <select
                      className="input-field"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Planned">Planned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="On Hold">On Hold</option>
                    </select>
                  </div>
                </div>

                {/* Timeline Dates */}
                <div className="form-grid">
                  <div className="form-group">
                    <label style={{ fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.35rem', display: 'block' }}>
                      Target Start Date
                    </label>
                    <input
                      type="date"
                      className="input-field"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.35rem', display: 'block' }}>
                      Target End Date
                    </label>
                    <input
                      type="date"
                      className="input-field"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>

                {/* Tools Roster with Auto-Save */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontWeight: '700', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Wrench size={15} style={{ color: 'var(--accent)' }} />
                      Tools Required
                    </label>
                    <span style={{ fontSize: '0.725rem', color: 'var(--accent)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Check size={12} /> Auto-saved for future entries
                    </span>
                  </div>

                  {/* Selected Tools Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem', minHeight: '32px' }}>
                    {formData.tools.map((tool, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: 'rgba(59, 130, 246, 0.1)',
                          color: '#2563eb',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600'
                        }}
                      >
                        {tool}
                        <button
                          type="button"
                          onClick={() => handleRemoveTool(tool)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#2563eb', display: 'flex' }}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Tool Input with Suggestions */}
                  <div style={{ position: 'relative' }} ref={toolDropdownRef}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="input-field"
                        value={toolInput}
                        onChange={(e) => {
                          setToolInput(e.target.value)
                          setShowToolSuggestions(true)
                        }}
                        onFocus={() => setShowToolSuggestions(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddTool()
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleAddTool()}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        + Add Tool
                      </button>
                    </div>

                    {/* Suggestions Dropdown */}
                    {showToolSuggestions && savedTools.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-md)',
                        maxHeight: '160px',
                        overflowY: 'auto',
                        zIndex: 100,
                        marginTop: '0.25rem'
                      }}>
                        <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', fontWeight: '700' }}>
                          PREVIOUSLY SAVED TOOLS (CLICK TO ADD):
                        </div>
                        {savedTools
                          .filter(st => !formData.tools.includes(st.name) && st.name.toLowerCase().includes(toolInput.toLowerCase()))
                          .map((st, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleAddTool(st.name)}
                              style={{
                                padding: '0.5rem 0.85rem',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                borderBottom: '1px solid var(--border-light)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-light)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <span>{st.name}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>+ Add</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Workers Roster with Auto-Save */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontWeight: '700', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Users size={15} style={{ color: '#10b981' }} />
                      Workers / Personnel
                    </label>
                    <span style={{ fontSize: '0.725rem', color: '#10b981', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Check size={12} /> Auto-saved for future entries
                    </span>
                  </div>

                  {/* Selected Workers Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem', minHeight: '32px' }}>
                    {formData.workers.map((worker, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          color: '#059669',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600'
                        }}
                      >
                        {worker}
                        <button
                          type="button"
                          onClick={() => handleRemoveWorker(worker)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#059669', display: 'flex' }}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Worker Input with Suggestions */}
                  <div style={{ position: 'relative' }} ref={workerDropdownRef}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="input-field"
                        value={workerInput}
                        onChange={(e) => {
                          setWorkerInput(e.target.value)
                          setShowWorkerSuggestions(true)
                        }}
                        onFocus={() => setShowWorkerSuggestions(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddWorker()
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleAddWorker()}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        + Add Worker
                      </button>
                    </div>

                    {/* Suggestions Dropdown */}
                    {showWorkerSuggestions && savedWorkers.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-md)',
                        maxHeight: '160px',
                        overflowY: 'auto',
                        zIndex: 100,
                        marginTop: '0.25rem'
                      }}>
                        <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', fontWeight: '700' }}>
                          PREVIOUSLY SAVED WORKERS (CLICK TO ADD):
                        </div>
                        {savedWorkers
                          .filter(sw => !formData.workers.includes(sw.name) && sw.name.toLowerCase().includes(workerInput.toLowerCase()))
                          .map((sw, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleAddWorker(sw.name)}
                              style={{
                                padding: '0.5rem 0.85rem',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                borderBottom: '1px solid var(--border-light)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-light)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <span>{sw.name}</span>
                              <span style={{ fontSize: '0.7rem', color: '#10b981' }}>+ Add</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="form-group">
                  <label style={{ fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <FileText size={15} style={{ color: 'var(--primary)' }} />
                    Plan Scope & Description
                  </label>
                  <textarea
                    rows={4}
                    className="input-field"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={16} className="spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> {editingPlanId ? 'Save Changes' : 'Create Project Plan'}
                    </>
                  )}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default ProjectPlanning
