/* BDA Security Group — service worker du site public : rend le site installable.
   Aucune mise en cache : les pages restent toujours à jour. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
