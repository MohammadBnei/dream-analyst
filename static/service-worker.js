const CACHE_NAME = 'dream-journal-ai-cache-v1';
const urlsToCache = [
    '/',
    '/manifest.json',
    '/icon-192x192.png',
    '/icon-512x512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
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
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
