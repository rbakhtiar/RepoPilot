
"use strict";

/* ======================================
   REPOPILOT SERVICE WORKER
   Version: 1.0.0
====================================== */

const CACHE_NAME = "repopilot-v1.0.0";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json"
];

/* ======================================
   INSTALL
====================================== */

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await cache.addAll(APP_SHELL);

      await self.skipWaiting();
    })()
  );
});

/* ======================================
   ACTIVATE
====================================== */

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith("repopilot-") &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

/* ======================================
   FETCH
====================================== */

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API responses or external services.
  if (
    url.origin !== self.location.origin ||
    url.pathname.includes("/api/")
  ) {
    return;
  }

  // Navigation: network first, cached app fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);

          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);

            await cache.put("./index.html", response.clone());
          }

          return response;

        } catch (error) {
          const cached = await caches.match(request);

          if (cached) return cached;

          return (
            await caches.match("./index.html")
          ) || new Response(
            "RepoPilot is currently offline.",
            {
              status: 503,
              headers: {
                "Content-Type": "text/plain"
              }
            }
          );
        }
      })()
    );

    return;
  }

  // Same-origin static assets: cache first.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);

      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (response.ok && response.type === "basic") {
          const cache = await caches.open(CACHE_NAME);

          await cache.put(request, response.clone());
        }

        return response;

      } catch (error) {
        return new Response(
          "Asset unavailable offline.",
          { status: 503 }
        );
      }
    })()
  );
});

/* ======================================
   MESSAGE HANDLING
====================================== */

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data?.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.delete(CACHE_NAME)
    );
  }
});

/* ======================================
   BACKGROUND STATUS
====================================== */

self.addEventListener("push", event => {
  const data = event.data
    ? event.data.json()
    : {};

  event.waitUntil(
    self.registration.showNotification(
      data.title || "RepoPilot",
      {
        body: data.body || "Your developer workspace has an update.",
        icon: "./icons/icon-192.png",
        badge: "./icons/icon-192.png"
      }
    )
  );
});
