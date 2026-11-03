/* =========================================================
   ESPACE ÉQUIPE — « Tout va bien ? » (module « presence »)
   - Activer les alertes de service sur ce téléphone (Web Push, service worker /sw-equipe.js)
   - Pendant un poste de nuit suivi, la direction envoie « Tout va bien ? » à intervalle
     régulier : l'agent répond depuis la notification ou avec le gros bouton de cette page.
   ========================================================= */
export const ICONES = {
  presence: '<path d="M12 21s-7-4.4-7-10V5l7-3 7 3v6c0 5.6-7 10-7 10z"/><path d="M8.5 11.5l2.5 2.5 4.5-5"/>',
};

const STATUTS = { attente: ['En attente', 'attente'], ok: ['Répondu', 'ok'], retard: ['Répondu en retard', 'info'], sans_reponse: ['Sans réponse', 'non'] };
const heure = (s) => (s && s.length >= 16 ? s.slice(11, 16).replace(':', 'h') : '');
const versOctets = (b64) => { const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
const iphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const installee = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const pris = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function empreinte(endpoint) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
async function inscription() {
  const reg = await navigator.serviceWorker.getRegistration('/espace-equipe');
  return reg ? reg.pushManager.getSubscription() : null;
}

async function rendu(o) {
  const { h, api, toast, enTete, ic, recharger } = o;
  const d = await api('mod.presence.etat');
  const sub = pris() ? await inscription().catch(() => null) : null;
  const moiIci = sub ? await empreinte(sub.endpoint) : '';
  const ici = Boolean(moiIci) && d.appareils.some((a) => a.empreinte === moiIci);

  // Gros bouton : répondre à la question en attente (ou confirmer de soi-même pendant un poste suivi)
  const enAttente = d.attente.length > 0;
  const peutRepondre = enAttente || d.concerne;
  const statut = enAttente
    ? h('p', { class: 'eqp-etat is-alerte' }, ic('alerte'), `Question en attente : répondez avant ${heure(d.attente[0].limite)}.`)
    : d.concerne ? h('p', { class: 'eqp-etat' }, ic('horloge'), d.prochaine ? `Prochaine question vers ${d.prochaine}.` : 'Contrôle en cours pendant votre poste.')
      : h('p', { class: 'eqp-etat' }, ic('lune'), d.reglages.actif ? (d.poste ? 'Votre poste en cours n’est pas suivi.' : 'Aucun poste suivi en ce moment.') : 'Le contrôle de présence n’est pas encore activé par la direction.');
  const bouton = h('button', { class: `eqp-bouton ${enAttente ? 'is-attente' : ''}`, type: 'button', disabled: peutRepondre ? null : true, onclick: async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      const r = await api('mod.presence.repondre', {});
      toast(r.statut === 'retard' ? `Réponse enregistrée à ${r.heure}, en retard : la direction est prévenue.` : `Merci, c’est noté (${r.heure}).`);
      recharger();
    } catch (err) { toast(err.message, true); b.disabled = false; }
  } }, ic('coche'), h('span', null, 'Tout va bien'));

  // Alertes sur ce téléphone
  const activer = async (e) => {
    const b = e.currentTarget;
    if (!pris()) return toast('Ce navigateur ne reçoit pas les alertes. Utilisez Chrome sur Android, ou Safari sur iPhone (appli installée).', true);
    if (!d.vapid) return toast('Les alertes ne sont pas encore prêtes côté serveur : prévenez la direction.', true);
    b.disabled = true;
    try {
      const reg = await navigator.serviceWorker.register('/sw-equipe.js', { scope: '/espace-equipe' });
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notifications refusées : autorisez-les dans les réglages du téléphone, puis réessayez.');
      const s = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(d.vapid) }));
      await api('mod.presence.abonner', s.toJSON());
      toast('Alertes activées sur ce téléphone.');
      recharger();
    } catch (err) { toast(err.message || 'Activation impossible.', true); b.disabled = false; }
  };
  const desactiver = async () => {
    try { const s = await inscription(); if (s) { await api('mod.presence.desabonner', { endpoint: s.endpoint }); await s.unsubscribe(); } toast('Alertes désactivées sur ce téléphone.'); recharger(); } catch (err) { toast(err.message, true); }
  };
  const tester = async (e) => {
    e.currentTarget.disabled = true;
    try { await api('mod.presence.tester', {}); toast('Alerte d’essai envoyée : elle arrive dans quelques secondes.'); } catch (err) { toast(err.message, true); }
  };
  const telephone = h('section', { class: 'eq-carte' },
    h('div', { class: 'eq-carte__tete' }, h('h2', null, 'Alertes sur ce téléphone'), h('span', { class: `eq-pastille eq-pastille--${ici ? 'ok' : 'neutre'}` }, ici ? 'Activées' : 'Non activées')),
    iphone() && !installee() ? h('p', { class: 'eqp-aide' }, 'Sur iPhone : ajoutez d’abord l’Espace équipe à l’écran d’accueil (bouton Partager › « Sur l’écran d’accueil »), ouvrez-le depuis l’icône, puis activez les alertes.') : null,
    h('p', { class: 'eqp-aide' }, ici ? 'Ce téléphone recevra « Tout va bien ? » pendant vos postes de nuit. Gardez-le allumé, avec internet et le son.' : 'Activez les alertes pour recevoir « Tout va bien ? » pendant vos postes de nuit et y répondre d’un appui.'),
    h('div', { class: 'eqp-actions' },
      ici ? [h('button', { class: 'eq-btn', type: 'button', onclick: tester }, 'Envoyer une alerte d’essai'), h('button', { class: 'eq-btn eq-btn--ghost', type: 'button', onclick: desactiver }, 'Désactiver')]
        : h('button', { class: 'eq-btn eq-btn--plein', type: 'button', onclick: activer }, ic('telephone'), 'Activer les alertes')),
    d.appareils.length ? h('p', { class: 'eqp-petit' }, `${d.appareils.length} téléphone${d.appareils.length > 1 ? 's' : ''} relié${d.appareils.length > 1 ? 's' : ''} à votre compte.`) : null);

  const regles = h('section', { class: 'eq-carte' }, h('div', { class: 'eq-carte__tete' }, h('h2', null, 'Comment ça marche')),
    h('ul', { class: 'eqp-regles' },
      h('li', null, `Entre ${d.reglages.debut.replace(':', 'h')} et ${d.reglages.fin.replace(':', 'h')}, pendant vos postes suivis, une question toutes les ${d.reglages.intervalle} minutes.`),
      h('li', null, `Vous avez ${d.reglages.delai} minutes pour appuyer sur « Tout va bien ».`),
      h('li', null, 'Sans réponse, la direction est prévenue et vous appelle. C’est pour votre sécurité.'),
      h('li', null, 'En cas de danger, utilisez le bouton SOS.')));

  const historique = d.historique.length ? h('section', { class: 'eq-carte' }, h('div', { class: 'eq-carte__tete' }, h('h2', null, 'Dernières questions')),
    h('ul', { class: 'eqp-histo' }, d.historique.map((q) => {
      const [lib, ton] = q.origine === 'spontane' ? ['Confirmé de vous-même', 'ok'] : (STATUTS[q.statut] || [q.statut, 'neutre']);
      return h('li', null, h('span', null, h('b', null, heure(q.envoye)), h('small', null, `${q.envoye.slice(8, 10)}/${q.envoye.slice(5, 7)}${q.repondu ? ` · réponse à ${heure(q.repondu)}` : ''}`)),
        h('span', { class: `eq-pastille eq-pastille--${ton}` }, lib));
    }))) : null;

  return h('div', { class: 'eqp' },
    enTete('Sécurité', 'Tout va bien ?', d.poste ? `Poste en cours : ${d.poste.site || 'site'}, ${d.poste.debut} - ${d.poste.fin}` : 'Contrôle de présence des postes de nuit.'),
    h('section', { class: 'eq-carte eqp-hero' }, statut, bouton),
    telephone, regles, historique);
}

export const PAGES = {
  presence: { titre: 'Tout va bien ?', icone: 'presence', rendu },
};

// Carte d'accueil : question en attente (prioritaire), ou poste suivi sans alertes activées
export const CARTES = [async (o) => {
  const { h, api, ic } = o;
  const d = await api('mod.presence.etat');
  if (d.attente.length) {
    return h('a', { class: 'eq-carte eqp-alerte is-attente', href: '#/presence' },
      h('span', { class: 'eqp-alerte__ic' }, ic('presence')),
      h('span', null, h('b', null, 'Tout va bien ?'), h('small', null, `Répondez avant ${heure(d.attente[0].limite)}`)),
      ic('fleche'));
  }
  if (d.reglages.actif && !d.appareils.length) {
    return h('a', { class: 'eq-carte eqp-alerte', href: '#/presence' },
      h('span', { class: 'eqp-alerte__ic' }, ic('presence')),
      h('span', null, h('b', null, 'Activez les alertes de service'), h('small', null, 'Pour le contrôle « Tout va bien ? » des postes de nuit')),
      ic('fleche'));
  }
  return null;
}];
