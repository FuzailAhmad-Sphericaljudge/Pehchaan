const CACHE = "pehchaan-shell-v2";
const SHELL = ["/", "/index.html", "/manifest.json", "/icon-192.svg", "/icon-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const pathname = new URL(event.request.url).pathname;
  if (pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/index.html")));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (event.request.url.startsWith(self.location.origin)) {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match("/index.html"))),
  );
});

// Phase 32: Notifications Center. Routine notifications arrive here on a
// best-effort basis; Phase 11 safety escalation never depends on this handler.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Pehchaan", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "Pehchaan";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.svg",
    badge: "/icon-192.svg",
    tag: payload.id || payload.type || "pehchaan-notification",
    data: { caseId: payload.caseId || null, type: payload.type || null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const caseId = event.notification.data && event.notification.data.caseId;
  const target = caseId ? `${self.registration.scope}worker/cases` : `${self.registration.scope}worker`;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if (caseId && "navigate" in client) client.navigate(target).catch(() => undefined);
          return;
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
