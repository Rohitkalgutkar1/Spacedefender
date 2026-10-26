// Space Defender service worker.
// IMPORTANT: when you change any game file, change the version number below (v4 -> v5 ...)
// so players' phones throw away the old copy and download the new one.
const CACHE_PREFIX = "space-defender-";
const CACHE_NAME = CACHE_PREFIX + "v4";

// Only what the game needs to run offline. (Screenshots / store art are NOT cached.)
const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/logo-mark.png"
];

// All of a person's GitHub Pages sites share ONE web address (rohitkalgutkar1.github.io), so
// this worker must only ever touch the game's own files and leave every other page alone.
// BASE is the folder this file lives in, for example "/Spacedefender/".
const BASE = new URL("./", self.location).pathname;
const GAME_PAGES = [BASE, BASE + "index.html"];
const GAME_FILES = [BASE + "manifest.json"];
const GAME_FOLDERS = [BASE + "icons/"];

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
      // Only throw away OLD copies of this game's cache. Never touch other sites' caches.
      .then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map(k => caches.delete(k))))
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
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // The game page: network first (so updates reach players), cached copy when offline or slow.
  if (request.mode === "navigate") {
    if (!GAME_PAGES.includes(url.pathname)) return; // any other page: not ours, leave it alone
    event.respondWith(
      fetchWithTimeout(request, 3500)
        .then(response => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.open(CACHE_NAME).then(cache => cache.match("./index.html")))
    );
    return;
  }

  // The game's own files (manifest, icons): cached copy first, otherwise network (and keep good responses).
  const isGameFile = GAME_FILES.includes(url.pathname) || GAME_FOLDERS.some(folder => url.pathname.startsWith(folder));
  if (!isGameFile) return; // anything else: not ours, leave it alone
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok && response.status === 200 && response.type === "basic") {
            cache.put(request, response.clone());
          }
          return response;
        });
      })
    )
  );
});
