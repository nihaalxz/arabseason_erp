import React, { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--bg, #FAFAFA)',
          boxSizing: 'border-box',
          fontFamily: 'inherit'
        }}>
          <div style={{
            maxWidth: '560px',
            width: '100%',
            background: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--border, #E4E4E4)',
            borderRadius: '20px',
            padding: '36px 32px',
            boxSizing: 'border-box',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#EF4444',
              marginBottom: '16px'
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h2 style={{
              margin: '0 0 8px 0',
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text, #0A0A0A)',
              letterSpacing: '-0.01em'
            }}>
              Unable to display this view
            </h2>

            <p style={{
              margin: '0 0 20px 0',
              fontSize: '13px',
              color: 'var(--text-muted, #737373)',
              lineHeight: 1.5
            }}>
              An unexpected error occurred while rendering this page. You can reload or return to the main dashboard.
            </p>

            {this.state.error?.message && (
              <div style={{
                background: 'var(--bg-subtle, #F5F5F5)',
                border: '1px solid var(--border, #E4E4E4)',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '12px',
                fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
                color: 'var(--text, #0A0A0A)',
                marginBottom: '24px',
                wordBreak: 'break-word',
                maxHeight: '120px',
                overflowY: 'auto'
              }}>
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReload}
                className="page-header-btn"
                style={{ height: '38px', padding: '0 20px' }}
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  height: '38px',
                  padding: '0 18px',
                  borderRadius: '9999px',
                  border: '1px solid var(--border, #E4E4E4)',
                  background: 'transparent',
                  color: 'var(--text, #0A0A0A)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

