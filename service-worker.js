// Space Defender service worker.
// IMPORTANT: when you change any game file, change the version number below (v3 -> v4 ...)
// so players' phones throw away the old copy and download the new one.
const CACHE_NAME = "space-defender-v3";

// Only what the game needs to run offline. (Screenshots / store art are NOT cached.)
const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/logo-mark.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fetchWithTimeout(request, ms) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
  ]);
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  // The game page: network first (so updates reach players), cached copy when offline or slow.
  if (request.mode === "navigate") {
    event.respondWith(
      fetchWithTimeout(request, 3500)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Everything else: cached copy first, otherwise network (and keep good responses).
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
