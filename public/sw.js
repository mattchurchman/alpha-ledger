const CACHE_NAME = 'alpha-ledger-v1'
const CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// Install: cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS).catch(() => {
        // Ignore errors during addAll (some URLs might not exist yet during dev).
        // The important thing is that the cache is open for use.
      })
    })
  )
  self.skipWaiting()
})

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch: cache-first for app shell, network-first for API
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never cache API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).then((response) => {
        // If session expired (401), redirect to root to show auth gate
        if (response.status === 401) {
          return caches.match('/').catch(() => {
            return new Response('Please sign in again.', {
              status: 401,
              statusText: 'Unauthorized',
            })
          })
        }
        return response
      }).catch(() => {
        // Network error on API call - show offline message
        return new Response(
          'Unable to reach the server. Please check your connection.',
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          }
        )
      })
    )
    return
  }

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return
  }

  // Cache-first for HTML, CSS, JS (the app shell)
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request).then((response) => {
        // Only cache successful responses
        if (response && response.status === 200 && request.method === 'GET') {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache)
          })
        }
        return response
      }).catch(() => {
        // Network error - try to serve from cache
        return caches.match(request).catch(() => {
          // Fallback for HTML pages: serve the app shell so the user can navigate
          if (request.mode === 'navigate') {
            return caches.match('/')
          }
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          })
        })
      })
    })
  )
})
