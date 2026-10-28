import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register Service Worker for Progressive Web App (PWA) in production only; clear in dev
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('PWA Service Worker registered successfully:', registration.scope)
        })
        .catch((error) => {
          console.warn('PWA Service Worker registration error:', error)
        })
    })
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister()
      }
    })
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) caches.delete(key)
      })
    }
  }
}

// Universally prevent mouse wheel from changing values on any number inputs across all pages
document.addEventListener(
  'wheel',
  function () {
    if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'number') {
      document.activeElement.blur()
    }
  },
  { passive: true }
)

document.addEventListener(
  'focusin',
  function (e) {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
      if (!e.target.__wheelBlocked) {
        e.target.__wheelBlocked = true
        e.target.addEventListener(
          'wheel',
          function (event) {
            event.preventDefault()
            this.blur()
          },
          { passive: false }
        )
      }
    }
  },
  true
)


