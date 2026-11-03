/* A small service worker so the bank app can be installed and shows a friendly page when the network is gone.
   It never stores pages, Studio's answers or anything about a customer: only the offline page and the app's own static files. */
const VERSION = "v1";
const STATIC = `finx-static-${VERSION}`;
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("finx-") && k !== STATIC).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // pages: always the network; offline, the offline page
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  // the app's own built files never change under the same name, so the stored copy is safe to use
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.open(STATIC).then(async (cache) => (await cache.match(req)) ?? fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })));
  }
  // everything else (Studio's answers, the bank's colours, the session) goes straight to the network and is never stored
});
