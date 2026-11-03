import { useState, useEffect } from 'react'
import { Lock, User, Eye, EyeOff, AlertCircle } from '../components/icons'
import { Sun, Moon } from 'lucide-react'
import { getIsDarkMode, toggleTheme } from '../utils/theme'

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  const [isDarkMode, setIsDarkMode] = useState(() => getIsDarkMode())

  useEffect(() => {
    const handleThemeSync = (e) => {
      const current = typeof e?.detail?.isDarkMode === 'boolean'
        ? e.detail.isDarkMode
        : getIsDarkMode()
      setIsDarkMode(current)
    }
    window.addEventListener('app:theme-change', handleThemeSync)
    window.addEventListener('storage', handleThemeSync)
    return () => {
      window.removeEventListener('app:theme-change', handleThemeSync)
      window.removeEventListener('storage', handleThemeSync)
    }
  }, [])

  const handleToggleTheme = () => {
    const next = toggleTheme()
    setIsDarkMode(next)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    
    const result = await onLogin(username, password)
    
    if (result && !result.success) {
      setError(result.message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page-root" style={{
      minHeight: '100vh',
      width: '100%',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: isDarkMode
        ? 'linear-gradient(180deg, rgba(10, 12, 16, 0.92) 0%, rgba(10, 12, 16, 0.96) 100%), url("/login-sky-bg.jpg")'
        : 'url("/login-sky-bg.jpg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center bottom',
      backgroundRepeat: 'no-repeat',
      overflow: 'hidden',
      padding: '1.5rem',
      boxSizing: 'border-box',
      transition: 'background 0.3s ease'
    }}>
      {/* Theme Toggle Button */}
      <button
        type="button"
        onClick={handleToggleTheme}
        title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 50,
          background: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(255, 255, 255, 0.95)',
          borderRadius: '999px',
          padding: '8px 14px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          cursor: 'pointer',
          color: isDarkMode ? '#f8fafc' : '#0f172a',
          fontSize: '12.5px',
          fontWeight: 600,
          boxShadow: isDarkMode ? '0 4px 14px rgba(0, 0, 0, 0.4)' : '0 4px 14px rgba(0, 0, 0, 0.08)',
          transition: 'all 0.2s ease'
        }}
      >
        {isDarkMode ? <Sun size={15} color="#fbbf24" strokeWidth={2.2} /> : <Moon size={15} color="#64748b" strokeWidth={2.2} />}
        <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
      </button>

      {/* Concentric Ambient Orbital Rings */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '560px',
        height: '560px',
        borderRadius: '50%',
        border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.45)',
        pointerEvents: 'none',
        zIndex: 1
      }} />
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '820px',
        height: '820px',
        borderRadius: '50%',
        border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(255, 255, 255, 0.3)',
        pointerEvents: 'none',
        zIndex: 1
      }} />
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '1100px',
        height: '1100px',
        borderRadius: '50%',
        border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.03)' : '1px solid rgba(255, 255, 255, 0.18)',
        pointerEvents: 'none',
        zIndex: 1
      }} />

      {/* Center Floating Glass Card */}
      <div style={{
        width: '100%',
        maxWidth: '430px',
        background: isDarkMode 
          ? 'rgba(18, 20, 24, 0.88)' 
          : 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '30px',
        border: isDarkMode 
          ? '1px solid rgba(255, 255, 255, 0.12)' 
          : '1px solid rgba(255, 255, 255, 0.85)',
        boxShadow: isDarkMode
          ? '0 24px 60px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)'
          : '0 24px 60px -12px rgba(15, 23, 42, 0.12), 0 8px 24px -4px rgba(186, 230, 253, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.7)',
        padding: '2.5rem 2.25rem 2.25rem 2.25rem',
        position: 'relative',
        zIndex: 10,
        boxSizing: 'border-box',
        transition: 'all 0.25s ease'
      }}>
        {/* Top Logo Badge (Arab Season Logo) */}
        <div style={{
          width: '72px',
          height: '52px',
          borderRadius: '16px',
          background: isDarkMode 
            ? 'linear-gradient(135deg, #1e2229 0%, #16191f 100%)' 
            : 'linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%)',
          boxShadow: isDarkMode 
            ? '0 8px 20px rgba(0, 0, 0, 0.4), 0 0 16px rgba(56, 189, 248, 0.15)' 
            : '0 8px 20px rgba(186, 230, 253, 0.75), 0 2px 6px rgba(0, 0, 0, 0.04)',
          border: isDarkMode 
            ? '1px solid rgba(255, 255, 255, 0.15)' 
            : '1px solid rgba(255, 255, 255, 0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem auto',
          padding: '6px 12px',
          boxSizing: 'border-box'
        }}>
          <img 
            src={isDarkMode ? "/logo_white.png" : "/logo_black.png"} 
            alt="Arab Season" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain' 
            }} 
          />
        </div>

        {/* Headings */}
        <h1 style={{
          fontSize: '1.45rem',
          fontWeight: '800',
          color: isDarkMode ? '#FFFFFF' : '#0f172a',
          textAlign: 'center',
          margin: 0,
          letterSpacing: '-0.02em'
        }}>
          Sign in with email
        </h1>
        <p style={{
          fontSize: '0.8rem',
          color: isDarkMode ? '#94a3b8' : '#64748b',
          textAlign: 'center',
          marginTop: '0.45rem',
          marginBottom: '1.4rem',
          lineHeight: '1.45',
          maxWidth: '300px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          Access your ERP workspace, financials, and operations.
        </p>

        {/* Error message */}
        {error && (
          <div style={{
            background: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(254, 242, 242, 0.85)',
            border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(254, 202, 202, 0.8)',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: isDarkMode ? '#fca5a5' : '#b91c1c',
            fontSize: '0.8rem',
            fontWeight: '500'
          }}>
            <AlertCircle size={15} color={isDarkMode ? "#f87171" : "#ef4444"} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Username / Email field */}
          <div>
            <label 
              htmlFor="login-username"
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: '700',
                color: isDarkMode ? '#cbd5e1' : '#334155',
                marginBottom: '0.4rem',
                letterSpacing: '0.01em'
              }}
            >
              Email or Username
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              height: '46px',
              padding: '0 14px',
              background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              borderRadius: '12px',
              border: focusedField === 'username' 
                ? (isDarkMode ? '1.5px solid #38bdf8' : '1.5px solid #0ea5e9') 
                : (isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #E2E8F0'),
              boxShadow: focusedField === 'username' 
                ? (isDarkMode ? '0 0 0 3px rgba(56, 189, 248, 0.2)' : '0 0 0 3px rgba(14, 165, 233, 0.15)') 
                : 'none',
              transition: 'all 0.15s ease'
            }}>
              <User size={16} color={focusedField === 'username' ? (isDarkMode ? '#38bdf8' : '#0284c7') : (isDarkMode ? '#64748b' : '#94a3b8')} style={{ flexShrink: 0 }} />
              <input 
                id="login-username"
                className="login-input"
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                placeholder="Enter your username or email"
                autoComplete="username"
                required 
                disabled={isSubmitting}
                style={{
                  border: 'none',
                  background: 'transparent',
                  backgroundColor: 'transparent',
                  outline: 'none',
                  width: '100%',
                  fontSize: '0.86rem',
                  color: isDarkMode ? '#FFFFFF' : '#0f172a',
                  fontWeight: '500'
                }}
              />
            </div>
          </div>

          {/* Password field */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.4rem'
            }}>
              <label 
                htmlFor="login-password"
                style={{
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  color: isDarkMode ? '#cbd5e1' : '#334155',
                  letterSpacing: '0.01em'
                }}
              >
                Password
              </label>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              height: '46px',
              padding: '0 14px',
              background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              borderRadius: '12px',
              border: focusedField === 'password' 
                ? (isDarkMode ? '1.5px solid #38bdf8' : '1.5px solid #0ea5e9') 
                : (isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #E2E8F0'),
              boxShadow: focusedField === 'password' 
                ? (isDarkMode ? '0 0 0 3px rgba(56, 189, 248, 0.2)' : '0 0 0 3px rgba(14, 165, 233, 0.15)') 
                : 'none',
              transition: 'all 0.15s ease'
            }}>
              <Lock size={16} color={focusedField === 'password' ? (isDarkMode ? '#38bdf8' : '#0284c7') : (isDarkMode ? '#64748b' : '#94a3b8')} style={{ flexShrink: 0 }} />
              <input 
                id="login-password"
                className="login-input"
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required 
                disabled={isSubmitting}
                style={{
                  border: 'none',
                  background: 'transparent',
                  backgroundColor: 'transparent',
                  outline: 'none',
                  width: '100%',
                  fontSize: '0.86rem',
                  color: isDarkMode ? '#FFFFFF' : '#0f172a',
                  fontWeight: '500'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isDarkMode ? '#94a3b8' : '#64748b',
                  transition: 'color 0.15s'
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button ("Get Started") */}
          <button 
            type="submit" 
            disabled={isSubmitting}
            style={{
              width: '100%',
              height: '46px',
              borderRadius: '12px',
              background: isDarkMode ? '#FFFFFF' : '#18181B',
              color: isDarkMode ? '#0A0A0A' : '#ffffff',
              border: 'none',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              transition: 'all 0.15s ease',
              boxShadow: isDarkMode ? '0 4px 14px rgba(255, 255, 255, 0.12)' : '0 4px 12px rgba(24, 24, 27, 0.2)'
            }}
          >
            {isSubmitting ? 'Signing in...' : 'Get Started'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
