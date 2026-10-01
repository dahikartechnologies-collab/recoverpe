const CACHE_NAME = "recoverpe-shell-v3";
const SHELL_ASSETS = ["/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(asset)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isHashedStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isDocumentOrRscRequest(request) {
  if (request.mode === "navigate") {
    return true;
  }

  const accept = request.headers.get("accept") || "";
  if (accept.includes("text/html")) {
    return true;
  }

  if (request.headers.get("RSC") === "1") {
    return true;
  }

  if (request.headers.get("Next-Router-State-Tree")) {
    return true;
  }

  if (request.headers.get("Next-Router-Prefetch")) {
    return true;
  }

  return false;
}

function shouldBypassCache(url, request) {
  if (url.pathname === "/sw.js" || url.pathname === "/manifest.json") {
    return true;
  }

  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
    return true;
  }

  return isDocumentOrRscRequest(request);
}

function networkFirst(request) {
  return fetch(request)
    .then((networkResponse) => {
      if (
        networkResponse &&
        networkResponse.status === 200 &&
        networkResponse.type === "basic"
      ) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
      }

      return networkResponse;
    })
    .catch(() =>
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        throw new Error("Network unavailable and no cached response.");
      })
    );
}

function cacheFirst(request) {
  return caches.match(request).then((cachedResponse) => {
    if (cachedResponse) {
      return cachedResponse;
    }

    return fetch(request).then((networkResponse) => {
      if (
        !networkResponse ||
        networkResponse.status !== 200 ||
        networkResponse.type !== "basic"
      ) {
        return networkResponse;
      }

      const responseClone = networkResponse.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseClone);
      });

      return networkResponse;
    });
  });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  if (shouldBypassCache(requestUrl, event.request)) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    isHashedStaticAsset(requestUrl)
      ? cacheFirst(event.request)
      : networkFirst(event.request)
  );
});
