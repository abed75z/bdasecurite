/* =========================================================
   ESPACE ADMIN BDA — service worker (application installable + notifications)
   Aucune mise en cache des pages : l'admin reste toujours à jour et privé.
   ========================================================= */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Notification reçue (demandes, messages, équipe, veille…) : aucun nom ni contenu, le détail est dans l'admin
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'BDA Admin', body: e.data ? e.data.text() : '' }; }
  const taches = [self.registration.showNotification(d.title || 'BDA Security Group', {
    body: d.body || '',
    icon: '/admin/icone-admin-192.png?v=1',
    badge: '/admin/favicon-admin-96.png?v=1',
    tag: d.tag || 'bda-admin',
    renotify: true,
    data: { url: d.url || '/admin/' },
  })];
  // Pastille sur l'icône de l'application : nombre d'éléments qui attendent une action
  if (typeof d.badge === 'number' && 'setAppBadge' in self.navigator) taches.push((d.badge ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge()).catch(() => {}));
  e.waitUntil(Promise.all(taches));
});

// Clic : ouvre (ou ramène au premier plan) l'admin sur la bonne page
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/admin/', self.location.origin).href;
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
