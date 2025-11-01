// CACHE_NAME will now include the app version.
// Since this is a static file, APP_VERSION needs to be manually updated or injected via a build step that processes static files.
const CACHE_NAME = `dream-journal-ai-cache-v0.21.4`; // Hardcoded version for static file
const urlsToCache = [
    '/manifest.json',
    '/icon-192x192.png',
    '/icon-512x512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache:', CACHE_NAME);
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', (event) => {
    // Check if the request is for one of the URLs we explicitly want to cache (cache-first strategy)
    if (urlsToCache.includes(event.request.url) || urlsToCache.includes(new URL(event.request.url).pathname)) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                // Return cached response if found, otherwise fetch from network
                return response || fetch(event.request).then((networkResponse) => {
                    // Cache the new response
                    // Ensure the response is valid before caching
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return; // Stop further processing for this request
    }

    // For all other requests (e.g., dynamic content, API calls), use a network-first strategy
    // This ensures that the latest content is always fetched from the network if available.
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // If the network request is successful, return it.
                // We don't cache these responses to avoid stale content.
                return networkResponse;
            })
            .catch(() => {
                // If network fails, try to serve from cache (if anything was cached previously)
                // This catch block is primarily for offline fallback for non-static assets
                return caches.match(event.request);
            })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete old caches that are not in the whitelist (i.e., not the current version)
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Ensure the service worker takes control of all clients immediately
            return self.clients.claim();
        })
    );
});
