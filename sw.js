// Service worker for mat-naloge — Phase 5 of the SPA migration.
//
// Caching strategy is per-resource-class:
//
//   - Versioned static assets (app.js?v=…, styles.css?v=…, data.<hash>.json,
//     all rendered TikZ SVGs and matura/textbook PNG crops) → cache-first.
//     They never change content under a stable URL, so we serve from cache
//     on every hit and revalidate only when the URL changes.
//
//   - HTML pages → stale-while-revalidate. We return the cached copy
//     immediately for fast paint, then fetch the network copy and update
//     the cache for next time. This is the right policy for the SPA shell
//     during the migration: a deploy still ships an HTML change
//     occasionally and we want users to pick it up on the second load
//     rather than being stuck on a stale shell.
//
//   - Cross-origin requests (MathJax CDN) → cache-first with long TTL.
//     The chunked .js files MathJax fetches lazily are immutable per
//     version and dominate the slow first-paint when offline.
//
// The cache name embeds a version. Bumping CACHE_VERSION invalidates the
// entire cache atomically on the next visit. Old caches are deleted
// during the activate phase.

const CACHE_VERSION = 'mat-mode-fallback-5d62bd';
const STATIC_CACHE   = `mat-static-${CACHE_VERSION}`;
const HTML_CACHE     = `mat-html-${CACHE_VERSION}`;
const EXTERNAL_CACHE = `mat-ext-${CACHE_VERSION}`;

// Pre-cache the shell on install so the very first offline visit works.
// We don't list problem-NNN.html here (466 pages would be too much for
// install); they get cached on demand as the user navigates.
const PRECACHE = [
  '/',
  '/index.html',
  '/search.html',
  '/exam.html',
  '/home.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(HTML_CACHE).then(cache => {
      // Best-effort precache — don't fail install if any single URL
      // 404s (deployments may not have every shell page).
      return Promise.all(PRECACHE.map(url =>
        cache.add(url).catch(() => {})
      ));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Drop any cache that doesn't match the current version.
    const names = await caches.keys();
    const keep = new Set([STATIC_CACHE, HTML_CACHE, EXTERNAL_CACHE]);
    await Promise.all(names.map(n => keep.has(n) ? null : caches.delete(n)));
    await self.clients.claim();
  })());
});

function isVersionedStatic(url) {
  // Anything with a ?v= cache-buster (app.js, styles.css), the
  // content-hashed data/meta/bodies bundles, or any image under our
  // static image trees. All of these are safe to serve from cache
  // forever because their URLs change when their content changes.
  if (url.search.includes('v=')) return true;
  if (/\/(data|meta|bodies)\.[0-9a-f]+\.json$/.test(url.pathname)) return true;
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url.pathname)) return true;
  return false;
}

function isHTML(url, request) {
  if (request.destination === 'document') return true;
  return /\.html?$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Only handle GETs; POST/PUT etc go to the network untouched.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && isVersionedStatic(url)) {
    // Cache-first. If the response isn't cached yet, fetch and store.
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        const resp = await fetch(request);
        if (resp && resp.ok) cache.put(request, resp.clone());
        return resp;
      } catch (err) {
        return new Response('', { status: 504, statusText: 'offline' });
      }
    })());
    return;
  }

  if (sameOrigin && isHTML(url, request)) {
    // Stale-while-revalidate. Serve cached if we have it; in parallel
    // fetch a fresh copy and update the cache for next time.
    event.respondWith((async () => {
      const cache = await caches.open(HTML_CACHE);
      const hit = await cache.match(request);
      const fetchPromise = fetch(request).then(resp => {
        if (resp && resp.ok) cache.put(request, resp.clone());
        return resp;
      }).catch(() => hit);  // Network failed: fall back to cache.
      return hit || fetchPromise;
    })());
    return;
  }

  // Cross-origin (MathJax CDN, etc.) — cache-first with same fallback.
  if (!sameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(EXTERNAL_CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        const resp = await fetch(request);
        // Only cache successful responses; some MathJax CDN responses
        // are opaque, but we still cache them because they're fine to
        // replay.
        if (resp) cache.put(request, resp.clone());
        return resp;
      } catch (err) {
        return new Response('', { status: 504, statusText: 'offline' });
      }
    })());
    return;
  }

  // Default: pass through.
});
