const CACHE_NAME = 'arab-season-erp-v1'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/logo_black.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png'
]

// Install event: Pre-cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-caching some assets failed:', err)
      })
    })
  )
  self.skipWaiting()
})

// Activate event: Clean up previous cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch event: Network-first for APIs, Cache-first / Stale-While-Revalidate for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // 1. Never cache non-GET requests
  if (event.request.method !== 'GET') {
    return
  }

  // 2. Bypass caching for backend API requests, authentication, and PDF blob exports
  if (
    url.pathname.includes('/api/') || 
    url.pathname.includes('/accounts/') ||
    url.pathname.includes('/admin/') ||
    event.request.headers.get('accept')?.includes('application/json')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Network error or offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )
    return
  }

  // 3. Navigation requests (SPA page loads): Network-first falling back to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/')
        })
    )
    return
  }

  // 4. Static assets (JS, CSS, images, fonts): Stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return networkResponse
        })
        .catch(() => cachedResponse)

      return cachedResponse || fetchPromise
    })
  )
})
