import { isCurrentUserAdmin } from '../../constants/permissions'
const getTodayStr = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import api from '../../api'
import { Plus, Edit, Trash2, X, AlertCircle, CheckCircle2, Layers } from 'lucide-react'
import PlainFilterDropdown from '../common/PlainFilterDropdown'
import CredSearchInput from '../cashbook/cred/CredSearchInput'
import {
  ModalShell,
  Field,
  TextInput,
  Select as CredSelect,
  DateInput,
  Textarea
} from '../common/FormPrimitives'
import { showConfirm, showError, showToast } from '../../utils/swal'

const ProjectPlanning = forwardRef(({ jobOrders = [], onRefreshJobs }, ref) => {
  const isAdmin = isCurrentUserAdmin()
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

  useEffect(() => {
    fetchPlans()
    fetchCatalogs()
  }, [])

  // Universal top strip refresh handler
  useEffect(() => {
    const handleAppRefresh = () => {
      fetchPlans()
      fetchCatalogs()
      if (typeof onRefreshJobs === 'function') {
        onRefreshJobs()
      }
    }
    window.addEventListener('app:refresh', handleAppRefresh)
    return () => window.removeEventListener('app:refresh', handleAppRefresh)
  }, [onRefreshJobs])

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

  // Expose methods to parent ref (for the Create Project Plan button in JobOrders page header)
  useImperativeHandle(ref, () => ({
    openCreateModal: handleOpenCreateModal,
    fetchPlans: fetchPlans
  }))

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
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q ||
      p.title?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.job_order_title?.toLowerCase().includes(q) ||
      p.job_order_code?.toLowerCase().includes(q) ||
      p.customer_name?.toLowerCase().includes(q) ||
      (Array.isArray(p.tools) && p.tools.some(t => t.toLowerCase().includes(q))) ||
      (Array.isArray(p.workers) && p.workers.some(w => w.toLowerCase().includes(q)))

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

  // Status dot & label renderer
  const renderPlanStatus = (status) => {
    const s = String(status || '').trim().toLowerCase()
    let dotColor = '#8C8C8C'
    let label = status || 'Planned'

    if (s === 'in progress') {
      dotColor = '#3b82f6'
      label = 'In Progress'
    } else if (s === 'completed') {
      dotColor = '#10b981'
      label = 'Completed'
    } else if (s === 'planned') {
      dotColor = '#8C8C8C'
      label = 'Planned'
    } else if (s === 'on hold') {
      dotColor = '#8C8C8C'
      label = 'On Hold'
    }

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 400, color: 'var(--text, #111111)' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
        {label}
      </span>
    )
  }

  // Comma-separated summary helper for tools & workers (shows first 2 and +N if > 2)
  const renderItemsSummary = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      return <span style={{ color: 'var(--text-muted, #8C8C8C)', fontSize: '12.5px' }}>—</span>
    }
    const fullStr = items.join(', ')
    if (items.length <= 2) {
      return (
        <span 
          title={fullStr} 
          style={{ 
            color: 'var(--text-muted, #8C8C8C)', 
            fontSize: '12.5px', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap', 
            display: 'block' 
          }}
        >
          {fullStr}
        </span>
      )
    }
    const firstTwo = items.slice(0, 2).join(', ')
    const extra = items.length - 2
    return (
      <span 
        title={fullStr} 
        style={{ 
          color: 'var(--text-muted, #8C8C8C)', 
          fontSize: '12.5px', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap', 
          display: 'block' 
        }}
      >
        {firstTwo}, +{extra}
      </span>
    )
  }

  return (
    <div className="project-planning-container" style={{ width: '100%', maxWidth: '100%' }}>
      {/* Alerts */}
      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '13px', marginBottom: '16px' }}>
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '13px', marginBottom: '16px' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* 2. KPI Cards (Cashbook CRED style: 1px outline, muted label, 26px ink number, no colored tiles) */}
      <div 
        className="summary-cards-grid" 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: '16px', 
          marginBottom: '20px' 
        }}
      >
        <div style={{ background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--border, #E4E4E4)', borderRadius: '20px', padding: '18px 20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
            Total plans
          </div>
          <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text, #0A0A0A)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {isAdmin ? totalPlans : '****'}
          </div>
        </div>

        <div style={{ background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--border, #E4E4E4)', borderRadius: '20px', padding: '18px 20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
            In progress
          </div>
          <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text, #0A0A0A)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {isAdmin ? inProgressPlans : '****'}
          </div>
        </div>

        <div style={{ background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--border, #E4E4E4)', borderRadius: '20px', padding: '18px 20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
            Completed
          </div>
          <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text, #0A0A0A)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {isAdmin ? completedPlans : '****'}
          </div>
        </div>

        <div style={{ background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--border, #E4E4E4)', borderRadius: '20px', padding: '18px 20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)', marginBottom: '8px' }}>
            Active teams
          </div>
          <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text, #0A0A0A)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {isAdmin ? uniqueWorkers : '****'}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {isAdmin ? `${uniqueWorkers} workers / ${uniqueTools} tools` : '****'}
          </div>
        </div>
      </div>

      {/* 3. Search and Filter Row (Directly on page, no outer card border) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '20px'
      }}>
        <div style={{ flex: '1 1 280px', minWidth: '220px' }}>
          <CredSearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            placeholder="Search project plans..."
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <PlainFilterDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'All', label: 'All statuses' },
              { value: 'Planned', label: 'Planned' },
              { value: 'In Progress', label: 'In Progress' },
              { value: 'Completed', label: 'Completed' },
              { value: 'On Hold', label: 'On Hold' }
            ]}
            ariaLabel="Filter by status"
            minWidth={130}
          />
          {jobOrders.length > 0 && (
            <PlainFilterDropdown
              value={jobFilter}
              onChange={setJobFilter}
              options={[
                { value: 'All', label: 'All job orders' },
                ...jobOrders.map(j => ({
                  value: String(j.id),
                  label: `${j.order_id || `#AS${j.id}`} - ${j.title || 'Job'}`
                }))
              ]}
              ariaLabel="Filter by job order"
              minWidth={150}
            />
          )}
        </div>
      </div>

      {/* 4. Plans Table / Empty State */}
      {loading && plans.length === 0 ? (
        <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted, #8C8C8C)', fontSize: '13px' }}>
          Loading project plans...
        </div>
      ) : filteredPlans.length === 0 ? (
        <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
          <Layers size={22} strokeWidth={1.6} style={{ color: 'var(--text-muted, #8C8C8C)', opacity: 0.6, marginBottom: '8px' }} />
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 400, color: 'var(--text-muted, #8C8C8C)' }}>
            No project plans yet.
          </p>
        </div>
      ) : (
        <div className="desktop-only-table" style={{ width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '26%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '80px' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border, #E4E4E4)' }}>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>
                  Plan Title & Scope
                </th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>
                  Contract / Client
                </th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>
                  Timeline
                </th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>
                  Tools Required
                </th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>
                  Assigned Workers
                </th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'left', textTransform: 'none', whiteSpace: 'nowrap' }}>
                  Status
                </th>
                <th style={{ width: '100px', minWidth: '100px', padding: '10px 8px 10px 16px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #8C8C8C)', textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.map((plan) => (
                <tr 
                  key={plan.id}
                  className="cred-table-row"
                  style={{ 
                    borderBottom: '1px solid var(--border, #E4E4E4)',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #FAFAFA)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* Plan Title & Scope */}
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                    <div style={{ fontWeight: 500, color: 'var(--text, #111111)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {plan.title}
                    </div>
                    {plan.description && (
                      <div style={{ 
                        fontSize: '12px', 
                        color: 'var(--text-muted, #8C8C8C)', 
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {plan.description}
                      </div>
                    )}
                  </td>

                  {/* Contract / Client */}
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                    {plan.job_order_title ? (
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text, #111111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {plan.job_order_code || `#AS${plan.job_order}`} - {plan.job_order_title}
                        </div>
                        {plan.customer_name && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted, #8C8C8C)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                            {plan.customer_name}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted, #8C8C8C)' }}>
                        Standalone plan
                      </span>
                    )}
                  </td>

                  {/* Timeline */}
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '12.5px', color: (plan.start_date || plan.end_date) ? 'var(--text, #111111)' : 'var(--text-muted, #8C8C8C)' }}>
                      {(plan.start_date || plan.end_date)
                        ? `${plan.start_date || 'TBD'} to ${plan.end_date || 'Open'}`
                        : '—'}
                    </span>
                  </td>

                  {/* Tools Required */}
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                    {renderItemsSummary(plan.tools)}
                  </td>

                  {/* Assigned Workers */}
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                    {renderItemsSummary(plan.workers)}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    {renderPlanStatus(plan.status)}
                  </td>

                  {/* Actions */}
                  <td style={{ width: '100px', minWidth: '100px', textAlign: 'right', padding: '10px 8px 10px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: '12px', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                      <button
                        type="button"
                        className="cred-icon-action-btn"
                        onClick={() => handleOpenEditModal(plan)}
                        title="Edit"
                        aria-label="Edit"
                        style={{
                          background: 'none',
                          border: 'none',
                          width: '32px',
                          height: '32px',
                          flexShrink: 0,
                          padding: 0,
                          color: 'var(--text-muted, #8C8C8C)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px',
                          transition: 'color 0.15s ease, background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--text, #0A0A0A)'
                          e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <Edit size={16} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        className="cred-icon-action-btn"
                        onClick={() => handleDelete(plan.id)}
                        title="Delete"
                        aria-label="Delete"
                        style={{
                          background: 'none',
                          border: 'none',
                          width: '32px',
                          height: '32px',
                          flexShrink: 0,
                          padding: 0,
                          color: 'var(--text-muted, #8C8C8C)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px',
                          transition: 'color 0.15s ease, background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--danger, #DC2626)'
                          e.currentTarget.style.backgroundColor = 'var(--fill-ghost-hover, #F4F4F4)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted, #8C8C8C)'
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <Trash2 size={16} strokeWidth={1.8} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Create / Edit Plan Modal */}
      <ModalShell
        isOpen={isModalOpen}
        onClose={() => !saving && setIsModalOpen(false)}
        title={editingPlanId ? 'Edit Project Plan' : 'Create Project Plan'}
        maxWidth="640px"
        formId="project-plan-form"
        submitLabel={editingPlanId ? 'Save Changes' : 'Create Project Plan'}
        submittingLabel="Saving..."
        submitting={saving}
      >
        <form id="project-plan-form" onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
            {/* Plan Title */}
            <Field label="Plan Title" required>
              <TextInput
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                autoFocus
                placeholder="e.g. Stage Setup & Audio Rigging"
              />
            </Field>

            {/* Associated Job Order & Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field label="Associated Job Order">
                <CredSelect
                  value={formData.job_order}
                  onChange={(e) => setFormData({ ...formData, job_order: e.target.value })}
                >
                  <option value="">Standalone plan</option>
                  {jobOrders.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.order_id || `#AS${j.id}`} - {j.title} ({j.customer_name || 'Customer'})
                    </option>
                  ))}
                </CredSelect>
              </Field>

              <Field label="Plan Status">
                <CredSelect
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Planned">Planned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="On Hold">On Hold</option>
                </CredSelect>
              </Field>
            </div>

            {/* Target Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field label="Target Start Date">
                <DateInput
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </Field>

              <Field label="Target End Date">
                <DateInput
                  min={getTodayStr()}
                  value={formData.end_date}
                  onChange={(e) => {
                    const val = e.target.value
                    const todayStr = getTodayStr()
                    if (val && val < todayStr) return
                    setFormData({ ...formData, end_date: val })
                  }}
                />
              </Field>
            </div>

            {/* Tools Required */}
            <div>
              <Field label="Tools Required">
                {formData.tools.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {formData.tools.map((tool, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'var(--fill-ghost, #F4F4F4)',
                          color: 'var(--text, #111111)',
                          border: '1px solid var(--border, #E4E4E4)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 400
                        }}
                      >
                        {tool}
                        <button
                          type="button"
                          onClick={() => handleRemoveTool(tool)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--text-muted, #8C8C8C)', display: 'inline-flex' }}
                          title="Remove tool"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ position: 'relative' }} ref={toolDropdownRef}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <TextInput
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
                      placeholder="Add tool name..."
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTool()}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text, #0A0A0A)',
                        fontSize: '12.5px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: '0 8px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      + Add Tool
                    </button>
                  </div>
                  {/* Tool Suggestions */}
                  {showToolSuggestions && savedTools.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--card-bg, #FFFFFF)',
                      border: '1px solid var(--border, #E4E4E4)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      zIndex: 100,
                      marginTop: '4px'
                    }}>
                      <div style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', borderBottom: '1px solid var(--border, #E4E4E4)', fontWeight: 500 }}>
                        PREVIOUSLY SAVED TOOLS (CLICK TO ADD)
                      </div>
                      {savedTools
                        .filter(st => !formData.tools.includes(st.name) && st.name.toLowerCase().includes(toolInput.toLowerCase()))
                        .map((st, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleAddTool(st.name)}
                            style={{
                              padding: '6px 10px',
                              cursor: 'pointer',
                              fontSize: '12.5px',
                              borderBottom: '1px solid var(--border, #E4E4E4)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              color: 'var(--text, #111111)'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--fill-ghost-hover, #F4F4F4)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span>{st.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>+ Add</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </Field>
            </div>

            {/* Workers / Personnel */}
            <div>
              <Field label="Workers / Personnel">
                {formData.workers.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {formData.workers.map((worker, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'var(--fill-ghost, #F4F4F4)',
                          color: 'var(--text, #111111)',
                          border: '1px solid var(--border, #E4E4E4)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 400
                        }}
                      >
                        {worker}
                        <button
                          type="button"
                          onClick={() => handleRemoveWorker(worker)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--text-muted, #8C8C8C)', display: 'inline-flex' }}
                          title="Remove worker"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ position: 'relative' }} ref={workerDropdownRef}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <TextInput
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
                      placeholder="Add worker name..."
                    />
                    <button
                      type="button"
                      onClick={() => handleAddWorker()}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text, #0A0A0A)',
                        fontSize: '12.5px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: '0 8px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      + Add Worker
                    </button>
                  </div>
                  {/* Worker Suggestions */}
                  {showWorkerSuggestions && savedWorkers.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--card-bg, #FFFFFF)',
                      border: '1px solid var(--border, #E4E4E4)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      zIndex: 100,
                      marginTop: '4px'
                    }}>
                      <div style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-muted, #8C8C8C)', borderBottom: '1px solid var(--border, #E4E4E4)', fontWeight: 500 }}>
                        PREVIOUSLY SAVED WORKERS (CLICK TO ADD)
                      </div>
                      {savedWorkers
                        .filter(sw => !formData.workers.includes(sw.name) && sw.name.toLowerCase().includes(workerInput.toLowerCase()))
                        .map((sw, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleAddWorker(sw.name)}
                            style={{
                              padding: '6px 10px',
                              cursor: 'pointer',
                              fontSize: '12.5px',
                              borderBottom: '1px solid var(--border, #E4E4E4)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              color: 'var(--text, #111111)'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--fill-ghost-hover, #F4F4F4)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span>{sw.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted, #8C8C8C)' }}>+ Add</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </Field>
            </div>

            {/* Plan Scope & Description */}
            <Field label="Plan Scope & Description">
              <Textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed breakdown of work stages, requirements, or safety notes..."
              />
            </Field>
          </div>
        </form>
      </ModalShell>
    </div>
  )
})

export default ProjectPlanning
