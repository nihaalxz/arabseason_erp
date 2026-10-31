import { useState, useEffect } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { useSearchParams, Link } from 'react-router-dom'
import { Search as SearchIcon, User, Briefcase, DollarSign, ArrowRight, Loader } from '../components/icons'
import api from '../api'

const SearchResults = () => {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  
  const [results, setResults] = useState({
    customers: [],
    jobs: [],
    expenses: []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { settings, formatCurrency } = useSettings()

  useEffect(() => {
    if (query) {
      performSearch()
    }
  }, [query])

  const performSearch = async () => {
    try {
      setLoading(true)
      const [cRes, jRes, eRes] = await Promise.all([
        api.get(`customers/?search=${query}`),
        api.get(`job-orders/?search=${query}`),
        api.get(`expenses/?search=${query}`)
      ])
      
      setResults({
        customers: cRes.data.results || [],
        jobs: jRes.data.results || [],
        expenses: eRes.data.results || []
      })
      setError('')
    } catch (err) {
      setError('Search failed. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const totalResults = results.customers.length + results.jobs.length + results.expenses.length

  return (
    <div className="search-page erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <SearchIcon size={24} className="text-primary" />
          <h2>Search Results for "{query}"</h2>
        </div>
        <span style={{ color: 'var(--text-muted)' }}>Found {totalResults} matches</span>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Loader className="spin" size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-muted)' }}>Searching across your business data...</p>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {!loading && totalResults === 0 && query && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>No matches found for your query.</p>
          <p style={{ marginTop: '0.5rem' }}>Try using more general terms or checking your spelling.</p>
        </div>
      )}

      {!loading && (
        <div style={{ display: 'grid', gap: '2rem' }}>
          {results.customers.length > 0 && (
            <section>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={20} /> Customers ({results.customers.length})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {results.customers.map(c => (
                  <Link key={c.id} to={`/accounting/customers/${c.id}`} className="glass-panel" style={{ padding: '1.25rem', display: 'block', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{c.name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{c.email || c.phone || 'No contact info'}</div>
                      </div>
                      <ArrowRight size={18} className="text-muted" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.jobs.length > 0 && (
            <section>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={20} /> Job Orders ({results.jobs.length})
              </h3>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {results.jobs.map(j => (
                  <Link key={j.id} to="/jobs" className="glass-panel" style={{ padding: '1.25rem', display: 'block', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600' }}>{j.title}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          Customer: {j.customer_name} • Status: {j.status}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontWeight: '600' }}>
                          {formatCurrency(j.total_amount)}
                        </span>
                        <ArrowRight size={18} className="text-muted" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.expenses.length > 0 && (
            <section>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={20} /> Expenses ({results.expenses.length})
              </h3>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {results.expenses.map(e => (
                  <Link key={e.id} to="/expenses" className="glass-panel" style={{ padding: '1.25rem', display: 'block', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600' }}>{e.title}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          {e.expense_date} • {e.notes?.substring(0, 50)}...
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontWeight: '600', color: 'var(--danger)' }}>
                          -{formatCurrency(e.amount)}
                        </span>
                        <ArrowRight size={18} className="text-muted" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default SearchResults
