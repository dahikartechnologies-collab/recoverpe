const CACHE_NAME = "recoverpe-shell-v2";
const SHELL_ASSETS = ["/manifest.json"];

function isDashboardNavigation(url) {
  return url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/");
}

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
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

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

  event.respondWith(
    isDashboardNavigation(requestUrl)
      ? networkFirst(event.request)
      : cacheFirst(event.request)
  );
});
