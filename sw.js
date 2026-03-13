/* ══════════════════════════════════════════════════
   Cordilleran Dictionary — Service Worker
   Caches core assets on install.
   Premium unlock triggers full dictionary cache.
   ══════════════════════════════════════════════════ */

const CACHE_CORE    = 'cord-core-v1'
const CACHE_DICT    = 'cord-dict-v1'

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/sw.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@300;400;600&display=swap'
]

const DICT_ASSETS = [
  '/kankanaey_dictionary.json',
  '/ibaloi_dictionary.json'
]

/* ── Install: cache core assets ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_CORE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  )
})

/* ── Activate: clean old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_CORE && k !== CACHE_DICT)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

/* ── Message: cache dictionary files when premium unlocked ── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_PREMIUM') {
    caches.open(CACHE_DICT).then(cache => {
      cache.addAll(DICT_ASSETS).then(() => {
        // Notify all clients that offline cache is ready
        self.clients.matchAll().then(clients =>
          clients.forEach(c => c.postMessage({ type: 'OFFLINE_READY' }))
        )
      }).catch(err => console.warn('Dict cache failed:', err))
    })
  }
})

/* ── Fetch: serve from cache, fall back to network ── */
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached

      // Not in cache — try network, then cache the response
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response
        }
        const clone = response.clone()
        caches.open(CACHE_CORE).then(cache => cache.put(event.request, clone))
        return response
      }).catch(() => {
        // Offline and not cached — return offline fallback for HTML pages
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html')
        }
      })
    })
  )
})
