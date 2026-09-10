// sw.js — offline support for Quiz Arena.
//
// Two caching strategies on purpose, because the two kinds of file fail differently:
//
//   app shell (html/css/js)  → cache-first, keyed on SHELL_VERSION.
//       Fast, works offline, and only changes when someone edits the app. Bumping the constant
//       below is what retires an old shell; without a bump, browsers keep serving the cached one.
//
//   packs/*.json             → network-first, falling back to cache.
//       The pack is regenerated whenever an instructor edits a weekly quiz (build_quiz_packs.py).
//       A cache-first pack would silently serve students last term's questions forever, which is
//       the worst failure this app could have. Network-first means an online student always gets
//       the current pack; an offline student gets the last one they successfully loaded.
//
// BUMP SHELL_VERSION whenever index.html / styles.css / app.js / game-core.js change.
// The pack does NOT need a bump — its own freshness is handled by the network-first rule above.

const SHELL_VERSION = "quiz-arena-shell-v1";
const PACK_CACHE = "quiz-arena-packs-v1";

const SHELL_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./game-core.js",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_VERSION)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== SHELL_VERSION && name !== PACK_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never cache cross-origin

  if (url.pathname.includes("/packs/")) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PACK_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("pack unavailable offline and not cached");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && new URL(request.url).origin === self.location.origin) {
    const cache = await caches.open(SHELL_VERSION);
    cache.put(request, response.clone());
  }
  return response;
}
