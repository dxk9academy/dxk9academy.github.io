/* =============================================================
   Worship Book — offline.

   Church wifi drops mid-service and the band loses its charts. This
   keeps the whole app on the device so it opens with no network at all.

   Network first, cache as the safety net: the page is always the
   freshest one available when there IS a connection, and the last good
   copy when there is not. Cache-first would be simpler and would mean
   nobody ever sees an update, which is worse.

   Bump VERSION whenever index.html changes meaningfully. That is what
   makes the "New version" banner appear.
   ============================================================= */

const VERSION = "2026-09-05j";
const CACHE = "worshipbook-" + VERSION;
const SHELL = ["./", "./index.html"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .catch(() => {})           /* a failed precache must not block install */
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  /* Leave the sync Worker alone. If it is unreachable the app has its own
     fallback and says so honestly; a cached API answer would quietly show
     stale songs as if they were current. */
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || caches.match("./index.html"))
      )
  );
});

self.addEventListener("message", e => {
  if (e.data === "skip-waiting") self.skipWaiting();
});
