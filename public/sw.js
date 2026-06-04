// MEDD service worker — makes the offline-first field app installable and able to
// load with no signal. Strategy:
//  • App shell + same-origin build assets: stale-while-revalidate (instant load,
//    refresh in background). Hashed filenames make this safe across deploys.
//  • Navigations: network-first, falling back to the cached shell when offline.
//  • Tabler icon CDN (unpkg): cached so glyphs render offline.
//  • Supabase API: never intercepted — the app already handles offline via
//    IndexedDB and deferred sync, so requests must reach the network normally.
const CACHE = 'medd-cache-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']
const CDN_HOSTS = ['unpkg.com']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

function cacheable(res) {
  return res && (res.status === 200 || res.type === 'opaque')
}

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return

  let url
  try { url = new URL(req.url) } catch { return }

  // Let Supabase (auth + data) always hit the network.
  if (url.hostname.endsWith('supabase.co')) return

  // Navigations: network-first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req)
        const c = await caches.open(CACHE)
        c.put('/index.html', fresh.clone())
        return fresh
      } catch {
        return (await caches.match(req))
          || (await caches.match('/index.html'))
          || (await caches.match('/'))
          || Response.error()
      }
    })())
    return
  }

  const sameOrigin = url.origin === self.location.origin
  const isCDN = CDN_HOSTS.some(h => url.hostname.endsWith(h))
  if (!sameOrigin && !isCDN) return

  // Stale-while-revalidate for assets.
  event.respondWith((async () => {
    const cached = await caches.match(req)
    const network = fetch(req).then(res => {
      if (cacheable(res)) {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put(req, copy))
      }
      return res
    }).catch(() => cached)
    return cached || network
  })())
})
