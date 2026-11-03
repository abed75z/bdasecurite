/* =========================================================
   ESPACE ÉQUIPE BDA — service worker (portée /espace-equipe)
   Alertes de service : contrôle de présence « Tout va bien ? » des postes de nuit.
   Aucune mise en cache : l'espace reste toujours à jour et privé.
   ========================================================= */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'BDA Équipe', body: e.data ? e.data.text() : '' }; }
  const presence = d.type === 'presence';
  e.waitUntil(self.registration.showNotification(d.title || 'BDA Équipe', {
    body: d.body || '',
    icon: '/assets/img/icon-192.png?v=5',
    badge: '/assets/img/icon-192.png?v=5',
    tag: d.tag || 'bda-equipe',
    renotify: true,
    requireInteraction: presence, // la question reste affichée jusqu'à la réponse
    vibrate: presence ? [300, 150, 300, 150, 300] : undefined,
    actions: presence ? [{ action: 'ok', title: 'Tout va bien' }] : [],
    data: { url: d.url || '/espace-equipe', jeton: d.jeton || '' },
  }));
});

// Réponse directe depuis la notification (sans ouvrir l'espace) : le jeton de la question suffit
async function repondre(jeton) {
  const r = await fetch('/api/module.php?m=presence&a=repondre', {
    method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ jeton }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.erreur || 'Réponse non enregistrée');
  return j;
}

async function ouvrir(url) {
  const cible = new URL(url || '/espace-equipe', self.location.origin).href;
  const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const f of fenetres) {
    if (f.url.includes('/espace-equipe')) {
      await f.focus();
      if ('navigate' in f) return f.navigate(cible);
      return undefined;
    }
  }
  return self.clients.openWindow(cible);
}

self.addEventListener('notificationclick', (e) => {
  const { jeton, url } = e.notification.data || {};
  e.notification.close();
  if (e.action === 'ok' && jeton) {
    e.waitUntil(repondre(jeton)
      .then((j) => self.registration.showNotification(j.statut === 'retard' ? 'Réponse reçue en retard' : 'Merci, c’est noté', {
        body: j.statut === 'retard' ? `Réponse enregistrée à ${j.heure}. La direction a été prévenue du retard.` : `Tout va bien, enregistré à ${j.heure}.`,
        icon: '/assets/img/icon-192.png?v=5', tag: 'presence-ok',
      }))
      .catch(() => ouvrir(url))); // en cas d'échec : on ouvre la page « Tout va bien ? » pour répondre
    return;
  }
  e.waitUntil(ouvrir(url));
});
