/* =========================================================
   ESPACE ADMIN BDA — service worker (application installable + notifications)
   Aucune mise en cache des pages : l'admin reste toujours à jour et privé.
   ========================================================= */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Notification reçue (veille commerciale)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'BDA Veille', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'BDA Security Group', {
    body: d.body || '',
    icon: '/assets/img/icon-192.png?v=3',
    badge: '/assets/img/favicon-96.png?v=3',
    tag: d.tag || 'bda-veille',
    renotify: true,
    data: { url: d.url || '/admin/#/opportunites' },
  }));
});

// Clic : ouvre (ou ramène au premier plan) l'admin sur l'opportunité concernée
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/admin/#/opportunites', self.location.origin).href;
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const f of fenetres) {
      if (f.url.includes('/admin/')) {
        await f.focus();
        if ('navigate' in f) return f.navigate(url);
        f.postMessage({ type: 'ouvrir', url });
        return undefined;
      }
    }
    return self.clients.openWindow(url);
  })());
});
