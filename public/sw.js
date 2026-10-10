/**
 * Alpha Ledger service worker.
 *
 * The one rule that matters here: the app shell is network-first, hashed assets are
 * cache-first. `index.html` names the hashed bundle for its build, so a cached shell pins the
 * browser to that build forever - which is how a deployed import fix failed to reach the app
 * at all (see PROGRESS, "Import fix: placeholder symbols"). Files under `/assets/` carry a
 * content hash in the filename, so serving those from cache can never be stale.
 *
 * Offline still works: the shell falls back to the cached copy whenever the network fails.
 */

const CACHE_NAME = 'alpha-ledger-v2'
const SHELL_URLS = ['/', '/index.html', '/manifest.json']

/** The shell paths plus any navigation, which the SPA answers with `index.html`. */
function isShellRequest(request, url) {
  return request.mode === 'navigate' || SHELL_URLS.includes(url.pathname)
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Ignore failures: a missing URL here only costs the offline fallback, not the install.
      return cache.addAll(SHELL_URLS).catch(() => {})
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      // Bumping CACHE_NAME is what drops a shell cached by an older worker.
      return Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
    }),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API calls are never cached, and the response is passed through untouched: `src/api/client.ts`
  // reads the status itself, and a 401 rewritten into cached HTML would reach it as a parse
  // failure instead of "no session".
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response('Unable to reach the server. Please check your connection.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          }),
      ),
    )
    return
  }

  if (url.origin !== self.location.origin || request.method !== 'GET') return

  if (isShellRequest(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => {
          const cached = (await caches.match(request)) ?? (await caches.match('/'))
          return (
            cached ?? new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
          )
        }),
    )
    return
  }

  // Hashed assets, icons, fonts: cache-first, since a change to any of them changes its URL.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => new Response('Offline', { status: 503, statusText: 'Service Unavailable' }))
    }),
  )
})
