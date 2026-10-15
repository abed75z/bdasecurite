/* =========================================================
   APPLI BDA — service worker (appli installable sur l'écran d'accueil + notifications)
   - l'appli s'ouvre même avec un réseau faible : la page et la carte sont gardées sur le téléphone
   - les données (courses, positions, messages) ne sont JAMAIS gardées : toujours demandées au serveur
   Fichier fabriqué par construire.ps1 (modèle : site-modeles/sw.js).
   ========================================================= */
const VERSION = '20261015-1527';
const NOM = 'BDA Chauffeur';
const ICONE = 'icone-192.png?v=20261015-1527';
const PREFIXE = 'bda-page-chauffeur-'; // l'appli client et l'appli chauffeur ont chacune leur réserve
const IGNORER = '';
const PAGE = PREFIXE + VERSION;
const CARTE = 'bda-carte-v1'; // données de la carte : gardées d'une version à l'autre (elles changent rarement)

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGE).then((c) => c.addAll(['./', 'manifest.webmanifest', ICONE])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k.startsWith(PREFIXE) && k !== PAGE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;           // polices, bibliothèques : le navigateur s'en charge
  if (url.pathname.startsWith('/api/')) return;              // courses, positions, messages : jamais en cache
  // carte (gros fichiers) : prise dans le téléphone, mise à jour discrète en arrière-plan
  if (/\/appli\/carte\/[^/]+\.txt$/.test(url.pathname)) {
    e.respondWith(caches.open(CARTE).then(async (c) => {
      const deja = await c.match(r);
      const reseau = fetch(r).then((rep) => { if (rep.ok) c.put(r, rep.clone()); return rep; }).catch(() => deja);
      return deja || reseau;
    }));
    return;
  }
  // l'appli chauffeur (/appli/chauffeur/) a son propre service worker : l'appli client n'y touche pas
  if (IGNORER && url.pathname.startsWith(IGNORER)) return;
  // la page : toujours la dernière version si le réseau répond, sinon celle du téléphone
  if (r.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    const cle = self.registration.scope;
    e.respondWith(fetch(r).then((rep) => { if (rep.ok) { const copie = rep.clone(); caches.open(PAGE).then((c) => c.put(cle, copie)); } return rep; }).catch(() => caches.match(cle)));
    return;
  }
  e.respondWith(caches.match(r).then((deja) => deja || fetch(r)));
});

// Notification reçue : course acceptée, chauffeur arrivé, message… (jamais d'adresse ni de nom dans le texte)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: NOM, body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || NOM, {
    body: d.body || '', icon: ICONE, badge: ICONE, tag: d.tag || 'bda', renotify: true, vibrate: [120, 60, 120], data: { url: d.url || './' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url ? e.notification.data.url : './', self.location.href).href;
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const f of fenetres) if (f.url.startsWith(self.registration.scope)) return f.focus();
    return self.clients.openWindow(url);
  })());
});
