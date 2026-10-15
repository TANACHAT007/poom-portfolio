// Portfolio à¸ à¸¹à¸¡à¸´ service worker â€” minimal: makes the app installable and serves cached static
// assets when offline. App data stays live (Firebase). Bump CACHE when PRECACHE changes.
const CACHE = "poom-portfolio-v1";
const PRECACHE = ["./", "./index.html", "./gallery.html", "./css/tailwind.css", "./js/app.js", "./js/firebase.js", "./assets/icon.svg", "./assets/icon-192.png", "./assets/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // never touch Firebase/CDN calls
  // network-first (always fresh), cache fallback offline
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(async () => {
        // a bare caches.match() miss resolves to undefined and respondWith(undefined) is a hard
        // network error â€” fall back to the cached shell for page navigations instead
        const hit = await caches.match(e.request);
        if (hit) return hit;
        if (e.request.mode === "navigate") {
          const shell = (await caches.match("./index.html")) || (await caches.match("./"));
          if (shell) return shell;
        }
        return new Response("à¸­à¸­à¸Ÿà¹„à¸¥à¸™à¹Œ â€” à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¹‚à¸«à¸¥à¸”à¸«à¸™à¹‰à¸²à¸™à¸µà¹‰à¹„à¸”à¹‰", {
          status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      })
  );
});

