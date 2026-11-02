import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react'
import { getUserInitialRoute } from '../../constants/permissions'

const AccessDenied = ({ currentUser, requiredPermission = null, customMessage = null }) => {
  const navigate = useNavigate()
  const homeRoute = getUserInitialRoute(currentUser)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '40px 20px',
      textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        backgroundColor: 'var(--fill-subtle, #F4F4F5)',
        border: '1px solid var(--border, #E4E4E7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
        color: 'var(--text-muted, #71717A)'
      }}>
        <ShieldAlert size={32} strokeWidth={1.75} />
      </div>

      <h2 style={{
        fontSize: '20px',
        fontWeight: 600,
        color: 'var(--text, #09090B)',
        marginBottom: '8px',
        letterSpacing: '-0.02em'
      }}>
        Access Restricted
      </h2>

      <p style={{
        fontSize: '14px',
        color: 'var(--text-muted, #71717A)',
        maxWidth: '420px',
        lineHeight: 1.5,
        marginBottom: '28px'
      }}>
        {customMessage || (
          requiredPermission 
            ? `Your user account does not have permission to view this page (${requiredPermission}). Contact an administrator to update your access.`
            : 'You do not have administrative permission to view this section.'
        )}
      </p>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border, #E4E4E7)',
            backgroundColor: 'var(--card-bg, #FFFFFF)',
            color: 'var(--text, #09090B)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fill-subtle, #F4F4F5)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--card-bg, #FFFFFF)'}
        >
          <ArrowLeft size={15} />
          Go Back
        </button>

        <button
          onClick={() => navigate(homeRoute)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '8px',
            border: '1px solid var(--black, #0A0A0A)',
            backgroundColor: 'var(--black, #0A0A0A)',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'opacity 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          <Home size={15} />
          Return to Workspace
        </button>
      </div>
    </div>
  )
}

export default AccessDenied

