// Minimal service worker: installability + faster repeat loads only.
// It deliberately never caches API/Supabase calls or anything cross-origin — the app
// already has its own offline queue + data cache in AppProvider.tsx (localStorage-based),
// and a second caching layer here for data would only risk serving stale results that
// fight with that mechanism. This SW's job is limited to the static app shell.

const CACHE_VERSION = "cureforever-shell-v1";
const SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch mutations
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase/cross-origin calls
  if (url.pathname.startsWith("/api/")) return; // never touch this app's own API routes

  // Next's build output under /_next/static/ is content-hashed and immutable — safe to
  // cache-first for instant repeat loads.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Everything else (page navigations, other static files): network-first, so the app
  // never shows stale HTML while online — only fall back to the cached shell if the
  // network request genuinely fails (offline).
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.mode === "navigate") {
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
  );
});
