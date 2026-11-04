/* =========================================================
   PORTAIL CLIENT — bdasecurite.com/espace-client
   Le point d'accès unique du client à toute sa relation avec BDA Security Group :
   tableau de bord, centre documentaire (factures, devis, contrats, attestations,
   rapports, courriers, équipe, pièces échangées), factures, prestations, équipe,
   messagerie et demandes, compte. Recherche rapide : Ctrl + K.
   Données : /api/client.php (cœur) et ses actions « mod.portail.* » (app/modules/portail.php).
   Rien n'est inventé : tout vient des documents réellement émis ou déposés par la direction.
   ========================================================= */
import { fmtHeures } from '/admin/js/outils.js';

const racine = document.getElementById('ec');
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const ICONES = {
  grille: '<rect x="3.5" y="3.5" width="7" height="7"/><rect x="13.5" y="3.5" width="7" height="7"/><rect x="3.5" y="13.5" width="7" height="7"/><rect x="13.5" y="13.5" width="7" height="7"/>',
  dossier: '<path d="M3 7.5V18a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18V9a1.5 1.5 0 0 0-1.5-1.5H11L9 5H4.5A1.5 1.5 0 0 0 3 6.5z"/><path d="M3 10.5h18"/>',
  facture: '<path d="M5.5 3h13v18l-2.2-1.5L14 21l-2-1.5L10 21l-2.3-1.5L5.5 21z"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4"/>',
  bouclier: '<path d="M12 21s7.5-3.6 7.5-9.4V5.4L12 3 4.5 5.4v6.2C4.5 17.4 12 21 12 21z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  equipe: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c.7-2.8 2.9-4.3 5.5-4.3s4.8 1.5 5.5 4.3M15.5 5.8a3 3 0 0 1 0 5.6M17.6 15.6c1.4.6 2.4 2 2.9 3.9"/>',
  messages: '<path d="M20.5 14.5a1.5 1.5 0 0 1-1.5 1.5H8l-4.5 4V5a1.5 1.5 0 0 1 1.5-1.5h14A1.5 1.5 0 0 1 20.5 5z"/>',
  compte: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.8-3.8 3.8-5.7 7.5-5.7s6.7 1.9 7.5 5.7"/>',
  recherche: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  telecharger: '<path d="M12 3.5v12M7 11l5 5 5-5M4 20.5h16"/>',
  externe: '<path d="M14 4h6v6M10 14 20 4M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5"/>',
  fleche: '<path d="m9.5 6 6 6-6 6"/>',
  retour: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  fermer: '<path d="M6 6l12 12M18 6 6 18"/>',
  imprimer: '<path d="M6.5 9V3.5h11V9M6.5 17.5h-2A1.5 1.5 0 0 1 3 16v-5.5A1.5 1.5 0 0 1 4.5 9h15a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 1-1.5 1.5h-2"/><path d="M6.5 14h11v6.5h-11z"/>',
  envoyer: '<path d="M21 3 3.5 10.5l7 3 3 7z"/><path d="m21 3-10.5 10.5"/>',
  trombone: '<path d="M19.5 11.5 12 19a4.6 4.6 0 0 1-6.5-6.5l8-8a3.1 3.1 0 0 1 4.4 4.4l-8 8a1.6 1.6 0 0 1-2.2-2.2l7-7"/>',
  televerser: '<path d="M12 16.5v-12M7 9.5l5-5 5 5M4 20.5h16"/>',
  sortie: '<path d="M9.5 20.5h-4a1.5 1.5 0 0 1-1.5-1.5V5a1.5 1.5 0 0 1 1.5-1.5h4M15.5 16.5 20 12l-4.5-4.5M20 12H9"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  coche: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  rapport: '<path d="M4 20.5h16M7 17V11M12 17V6.5M17 17v-8"/>',
  horloge: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  cahier: '<path d="M6 3.5h12.5v17H6a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4"/>',
  telephone: '<path d="M20.5 16.6v2.6a1.7 1.7 0 0 1-1.9 1.7A17 17 0 0 1 3.1 5.4 1.7 1.7 0 0 1 4.8 3.5h2.6a1.7 1.7 0 0 1 1.7 1.5c.1.9.3 1.7.6 2.5a1.7 1.7 0 0 1-.4 1.8l-1.1 1.1a13.7 13.7 0 0 0 5.4 5.4l1.1-1.1a1.7 1.7 0 0 1 1.8-.4c.8.3 1.6.5 2.5.6a1.7 1.7 0 0 1 1.5 1.7z"/>',
};
const DEMANDES = [['renfort', 'Demande de renfort'], ['planning', 'Modification du planning'], ['probleme', 'Signaler un problème'], ['facture', 'Question sur une facture'], ['document', 'Demande de document']];
const MENU = [
  [null, [['accueil', 'Accueil', 'grille'], ['factures', 'Factures', 'facture'], ['prestations', 'Heures de présence', 'horloge'], ['main-courante', 'Main courante', 'cahier'], ['equipe', 'Équipe', 'equipe'],
    ['documents', 'Documents', 'dossier'], ['messages', 'Messages', 'messages'], ['compte', 'Mon compte', 'compte']]],
];
const LIBELLES = Object.fromEntries(MENU.flatMap(([, items]) => items.map(([k, lib]) => [k, lib])));
const etat = { csrf: '', client: null, nonLus: 0, nouveaux: 0, centre: null, centreT: 0, demande: '' };

/* ---------- Outils ---------- */
function h(tag, attrs, ...enfants) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const ajouter = (c) => { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) c.forEach(ajouter); else el.append(c instanceof Node ? c : document.createTextNode(String(c))); };
  enfants.forEach(ajouter);
  return el;
}
function ic(nom) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'ec-ic');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONES[nom] || '';
  return s;
}
async function appel(a, opts, params = {}) {
  let r;
  try { r = await fetch(`/api/client.php?${new URLSearchParams({ a, ...params })}`, { credentials: 'same-origin', ...opts }); } catch (e) { throw new Error('Connexion impossible. Vérifiez votre accès à internet.'); }
  const j = await r.json().catch(() => ({}));
  if (j.csrf) etat.csrf = j.csrf;
  if (r.status === 401 && a !== 'connexion') { ecranConnexion('Votre session a expiré : reconnectez-vous.'); throw new Error('Connexion requise.'); }
  if (r.status === 413) throw new Error('Fichier trop lourd.');
  if (!r.ok || j.ok === false) throw new Error(j.erreur || `Erreur ${r.status}`);
  return j;
}
function api(a, corps, params) {
  const opts = { headers: { Accept: 'application/json' } };
  if (corps !== undefined) Object.assign(opts, { method: 'POST', headers: { ...opts.headers, 'Content-Type': 'application/json', 'X-CSRF': etat.csrf }, body: JSON.stringify(corps) });
  return appel(a, opts, params);
}
const apiForm = (a, fd) => appel(a, { method: 'POST', headers: { Accept: 'application/json', 'X-CSRF': etat.csrf }, body: fd });
const lien = (a, params) => `/api/client.php?${new URLSearchParams({ a, ...params })}`;
const telecharger = (url) => `${url}${url.includes('?') ? '&' : '?'}telecharger=1`;
function toast(msg, erreur) {
  const t = h('div', { class: `toast ${erreur ? 'is-erreur' : ''}`, role: 'status' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 300); }, 4200);
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dt = (s) => new Date(`${String(s).slice(0, 10)}T12:00:00`);
const frDate = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
const quantieme = (d) => (d.getDate() === 1 ? '1er' : String(d.getDate()));
const frLong = (s) => { if (!/^\d{4}-\d{2}-\d{2}/.test(s || '')) return '—'; const d = dt(s); return `${quantieme(d)} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
const frJour = (s) => { const d = dt(s); return `${JOURS[d.getDay()]} ${quantieme(d)} ${MOIS[d.getMonth()]}`; };
const frDateHeure = (s) => (s ? `${frDate(s)} à ${String(s).slice(11, 16)}` : '');
const hm = (s) => String(s || '').slice(0, 5).replace(/^0(\d)/, '$1').replace(':', 'h');
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const heures = (n) => fmtHeures(+n || 0);
const decimal = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(+n || 0);
// « 08:30 - 13:45 » → « 8h30 – 13h45 »
const plage = (t) => String(t || '').replace(/(\d{1,2})\s*[:hH]\s*(\d{2})/g, (_, a, b) => `${+a}h${b}`).replace(/\s*(?:-|–)\s*/g, ' – ').replace(/\s*·\s*/g, ' · ');
const kpi = (href, titre, valeur, sous, ton) => h(href ? 'a' : 'div', { class: `kpi ${ton ? `is-${ton}` : ''}`, href }, h('small', null, titre), h('b', null, valeur), sous ? h('span', null, sous) : null);
// Chiffres clés : ils montent en douceur jusqu'à leur valeur (0,9 s), sans jamais changer le résultat affiché à la fin
const FORMATS = { euro: (n) => euro.format(n), heures: (n) => heures(n), nombre: (n) => String(Math.round(n)) };
const nombre = (v, f = 'nombre') => h('span', { class: 'compteur', 'data-v': String(+v || 0), 'data-f': f }, FORMATS[f](+v || 0));
function animerNombres(racine) {
  racine.querySelectorAll('.compteur').forEach((el) => {
    const v = +el.dataset.v;
    const f = el.dataset.f;
    if (!v) return;
    const fin = FORMATS[f](v);
    const debut = performance.now();
    const pas = (t) => {
      const k = Math.min(1, (t - debut) / 900);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = k >= 1 ? fin : FORMATS[f](f === 'euro' ? Math.round(v * e * 100) / 100 : f === 'heures' ? Math.round(v * e * 60) / 60 : v * e);
      if (k < 1) requestAnimationFrame(pas);
    };
    el.textContent = FORMATS[f](0);
    requestAnimationFrame(pas);
    // filet de sécurité : la vraie valeur s'affiche toujours (onglet en arrière-plan, appareil lent…)
    setTimeout(() => { el.textContent = fin; }, 1000);
  });
}
// Barre de progression (heures faites sur heures prévues)
const barre = (fait, prevu, cls = 'progression') => {
  const p = prevu > 0 ? Math.max(0, Math.min(100, Math.round(fait / prevu * 100))) : 0;
  return h('div', { class: cls, role: 'img', 'aria-label': `${p} % des heures prévues ce mois-ci sont faites` }, h('i', { style: `--p:${p}%` }));
};
const parDate = (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.reference || '').localeCompare(String(a.reference || ''), 'fr', { numeric: true });
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? (plusieurs || `${un}s`) : un}`;
const initiales = (nom) => String(nom || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase();
const sansAccent = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const statut = (ton, lib) => h('span', { class: `statut statut--${ton}` }, lib);
const champ = (label, input) => h('label', { class: 'champ' }, h('span', null, label), input);
const saisie = (attrs) => h('input', { class: 'input', ...attrs });
const vide = (titre, texte, ...actions) => h('div', { class: 'vide' }, h('b', null, titre), texte ? h('p', null, texte) : null, actions.length ? h('div', { class: 'tete__actions' }, actions) : null);
function tete(sur, titre, texte, ...actions) {
  const a = actions.flat().filter(Boolean);
  return h('header', { class: 'tete' }, h('div', { class: 'tete__titres' }, sur ? h('span', { class: 'sur' }, sur) : null, h('h1', null, titre), texte ? h('p', null, texte) : null),
    a.length ? h('div', { class: 'tete__actions' }, a) : null);
}
const panneau = (titre, droite, ...corps) => h('section', { class: 'panneau' }, titre ? h('header', { class: 'panneau__tete' }, h('h2', null, titre), droite || null) : null, corps);
const corpsP = (...c) => h('div', { class: 'panneau__corps' }, c);
const tableau = (colonnes, lignes) => h('div', { class: 'zone-table' }, h('table', { class: 'table' },
  h('thead', null, h('tr', null, colonnes.map(([lib, cls]) => h('th', { class: cls || null }, lib)))), h('tbody', null, lignes)));
const td = (contenu, cls) => h('td', { class: cls || null }, contenu);
const tdFleche = () => td(ic('fleche'), 'fleche m-cache');
// Une ligne cliquable ouvre sa destination (sauf clic sur un lien ou un bouton de la ligne)
function ligne(action, cellules) {
  return h('tr', { class: action ? 'cliquable' : null, tabindex: action ? '0' : null,
    onclick: action ? (e) => { if (!e.target.closest('a, button')) action(); } : null,
    onkeydown: action ? (e) => { if (e.key === 'Enter') action(); } : null }, cellules);
}
// replaceChildren ne déplie pas les tableaux : on aplatit et on retire les vides
const remplir = (el, ...enfants) => el.replaceChildren(...enfants.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
const squelette = (n = 5) => h('div', { class: 'squelette', 'aria-hidden': 'true' }, Array.from({ length: n }, () => h('i')));

/* ---------- Documents : affichage commun ---------- */
function pictos(i) {
  const rapport = i.format === 'rapport';
  const lib = i.categorie === 'factures' ? 'FAC' : i.categorie === 'devis' ? 'DEV' : i.format === 'image' ? 'IMG' : 'PDF';
  return h('span', { class: `pictos ${i.categorie === 'factures' ? 'pictos--facture' : ''} ${rapport ? 'pictos--rapport' : ''}`, 'aria-hidden': 'true' }, rapport ? ic('rapport') : h('em', null, lib));
}
const celluleDoc = (i) => h('div', { class: 'doc' }, pictos(i), h('span', null, h('b', null, i.titre, i.nouveau ? h('i', { class: 'nouveau' }, 'Nouveau') : null), i.sous ? h('small', null, i.sous) : h('small', null, i.genre)));
function ouvrirItem(i) {
  if (i.vue && (i.format === 'feuille' || i.format === 'rapport')) location.hash = i.vue;
  else if (i.url) apercu(i);
}
const boutonTelecharger = (i) => (i.url ? h('a', { class: 'btn btn--discret btn--petit btn--icone', href: telecharger(i.url), title: 'Télécharger', 'aria-label': `Télécharger ${i.titre}` }, ic('telecharger')) : null);
async function chargerCentre(frais) {
  if (!frais && etat.centre && Date.now() - etat.centreT < 60000) return etat.centre;
  etat.centre = await api('mod.portail.centre');
  etat.centreT = Date.now();
  etat.nouveaux = etat.centre.items.filter((i) => i.nouveau).length;
  majBadges();
  return etat.centre;
}
const oublierCentre = () => { etat.centreT = 0; };

/* ---------- Démarrage ---------- */
async function demarrer() {
  const jeton = (location.hash.match(/invitation=([a-f0-9]{48})/) || [])[1];
  let s;
  try { s = await api('session'); } catch (e) { return racine.replaceChildren(h('p', { class: 'ec-message' }, e.message)); }
  if (jeton) return ecranInvitation(jeton);
  if (!s.connecte) return ecranConnexion();
  ouvrir();
}

/* ---------- Connexion / activation ---------- */
function carteAuth(titre, texte, ...contenu) {
  document.body.classList.remove('ec--app', 'menu-ouvert');
  return h('main', { class: 'auth' },
    h('section', { class: 'auth__nuit' },
      h('a', { class: 'auth__marque', href: '/' }, h('img', { src: '/assets/img/blason.svg?v=1', alt: '', width: 30, height: 38 }), h('span', null, h('b', null, 'BDA Security Group'), h('small', null, 'Portail client'))),
      h('div', { class: 'auth__phrase' }, h('p', null, 'L’ensemble de votre relation, en un seul lieu.'),
        h('span', null, 'Prestations, factures, attestations, rapports et échanges avec la direction : votre espace réunit tout, en permanence, en toute confidentialité.')),
      h('p', { class: 'auth__pied' }, 'Assistance 24h/24 · ', h('a', { href: 'tel:+33611678625' }, '06 11 67 86 25'))),
    h('section', { class: 'auth__forme' }, h('div', { class: 'auth__boite' }, h('h1', null, titre), texte ? h('p', null, texte) : null, contenu)));
}
function ecranConnexion(message) {
  const email = saisie({ type: 'email', autocomplete: 'username', required: true, placeholder: 'vous@institution.org' });
  const mdp = saisie({ type: 'password', autocomplete: 'current-password', required: true });
  const msg = h('p', { class: 'erreur', role: 'alert' }, message || '');
  const btn = h('button', { class: 'btn btn--nuit', type: 'submit' }, 'Accéder à mon espace');
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = ''; btn.disabled = true;
    try { await api('connexion', { email: email.value.trim(), motdepasse: mdp.value }); ouvrir(); }
    catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } }, champ('Adresse e-mail', email), champ('Mot de passe', mdp), msg, btn);
  racine.replaceChildren(carteAuth('Connexion', 'Espace réservé aux clients de BDA Security Group.', form,
    h('p', { class: 'note' }, 'Première connexion ou mot de passe oublié : contactez votre responsable de mission au ', h('a', { href: 'tel:+33611678625' }, '06 11 67 86 25'), '.')));
  email.focus();
}
async function ecranInvitation(jeton) {
  let info;
  try { info = await api('invitation.verifier', undefined, { jeton }); } catch (e) { history.replaceState(null, '', location.pathname); return ecranConnexion(e.message); }
  const mdp = saisie({ type: 'password', autocomplete: 'new-password', minlength: 8, required: true });
  const mdp2 = saisie({ type: 'password', autocomplete: 'new-password', required: true });
  const msg = h('p', { class: 'erreur', role: 'alert' });
  const btn = h('button', { class: 'btn btn--nuit', type: 'submit' }, 'Activer mon espace');
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = '';
    if (mdp.value !== mdp2.value) { msg.textContent = 'Les deux mots de passe ne sont pas identiques.'; return; }
    btn.disabled = true;
    try { await api('invitation', { jeton, motdepasse: mdp.value }); history.replaceState(null, '', location.pathname); toast('Votre espace est activé. Bienvenue.'); ouvrir(); }
    catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } }, h('p', { class: 'auth__id' }, 'Identifiant : ', h('b', null, info.email)), champ('Choisissez un mot de passe (8 caractères minimum)', mdp), champ('Confirmez le mot de passe', mdp2), msg, btn);
  racine.replaceChildren(carteAuth(`Bienvenue, ${info.client}`, 'Choisissez votre mot de passe pour activer votre espace.', form));
  mdp.focus();
}

/* ---------- Application ---------- */
let voile;
async function ouvrir() {
  let t;
  try { t = await api('tableau'); } catch (e) { return; }
  etat.client = t.client;
  etat.nonLus = t.messagesNonLus;
  document.body.classList.add('ec--app');
  if (!voile) {
    voile = h('div', { class: 'voile', onclick: fermerTout });
    document.body.append(voile);
    document.addEventListener('keydown', raccourcis);
    window.addEventListener('scroll', () => document.body.classList.toggle('a-defile', window.scrollY > 8), { passive: true });
  }
  window.onhashchange = naviguer;
  naviguer();
}
function raccourcis(e) {
  if (!document.body.classList.contains('ec--app')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); }
  else if (e.key === '/' && !e.target.closest('input, textarea, select')) { e.preventDefault(); palette(); }
  else if (e.key === 'Escape') fermerTout();
}
function fermerTout() {
  document.body.classList.remove('menu-ouvert');
  fermerApercu();
  fermerPalette();
  voile?.classList.remove('is-ouvert');
}
function majBadges() {
  const fixer = (cle, n) => document.querySelectorAll(`[data-badge="${cle}"]`).forEach((el) => { el.textContent = n || ''; el.hidden = !n; });
  fixer('documents', etat.nouveaux);
  fixer('messages', etat.nonLus);
}
// Anciennes adresses (alertes déjà envoyées) → nouvelles pages
function redirection(brut, param) {
  if (brut === 'devis') return param ? `#/document/${param}` : '#/documents/devis';
  if (brut === 'factures' && param) return `#/document/${param}`;
  if (brut === 'plus') return '#/accueil';
  if (brut === 'rapport') return param ? `#/prestations/${param}` : '#/prestations';
  return '';
}
async function deconnexion() {
  try { await api('deconnexion', {}); } catch (e) { /* déjà sorti */ }
  etat.client = null; etat.centre = null;
  fermerTout();
  ecranConnexion('Vous êtes déconnecté. À bientôt.');
}
function naviguer() {
  if (!etat.client) return;
  fermerTout();
  const [brut, param] = location.hash.replace(/^#\/?/, '').split('/');
  const autre = redirection(brut, param);
  if (autre) { location.replace(autre); return; }
  const route = ['document', 'rapport-mensuel'].includes(brut) ? brut : (LIBELLES[brut] ? brut : 'accueil');
  const actif = ['document', 'rapport-mensuel'].includes(route) ? 'documents' : route;
  const c = etat.client;
  const marque = (cls) => h('a', { class: cls, href: '#/accueil' }, h('img', { src: '/assets/img/blason.svg?v=1', alt: '', width: 24, height: 30 }), h('span', null, h('b', null, 'BDA Security Group'), h('small', null, 'Portail client')));
  const menu = h('aside', { class: 'menu', 'aria-label': 'Menu principal' },
    marque('menu__marque'),
    h('div', { class: 'menu__client' }, h('small', null, 'Espace de'), h('b', null, c.nom)),
    h('nav', null, MENU.map(([titre, items]) => [
      titre ? h('p', { class: 'menu__titre' }, titre) : null,
      items.map(([k, lib, icone]) => h('a', { href: `#/${k}`, class: `menu__item ${k === actif ? 'is-actif' : ''}`, 'aria-current': k === actif ? 'page' : null }, ic(icone), h('span', null, lib),
        k === 'documents' || k === 'messages' ? h('i', { class: 'menu__nb', 'data-badge': k, hidden: true }) : null)),
    ])),
    h('div', { class: 'menu__bas' },
      h('div', { class: 'menu__contact' }, h('small', null, 'Votre interlocuteur'), h('a', { href: 'tel:+33611678625' }, '06 11 67 86 25'), h('span', null, 'Direction · assistance 24h/24')),
      h('button', { class: 'menu__sortie', type: 'button', onclick: deconnexion }, ic('sortie'), 'Se déconnecter')));
  const haut = h('header', { class: 'haut' },
    h('button', { class: 'btn btn--icone haut__menu', type: 'button', 'aria-label': 'Ouvrir le menu', onclick: () => { document.body.classList.add('menu-ouvert'); voile.classList.add('is-ouvert'); } }, ic('menu')),
    marque('haut__marque'),
    h('p', { class: 'haut__fil' }, 'Portail', h('i'), h('b', null, route === 'document' ? 'Document' : route === 'rapport-mensuel' ? 'Rapport mensuel' : LIBELLES[route])),
    h('button', { class: 'haut__recherche', type: 'button', onclick: palette, 'aria-label': 'Rechercher un document' }, ic('recherche'), h('span', null, 'Rechercher un document, une facture…'), h('kbd', null, 'Ctrl K')));
  const page = h('main', { class: 'page', id: 'contenu' }, squelette(6));
  racine.replaceChildren(h('div', { class: 'app' }, menu, h('div', { class: 'corps' }, haut, page)));
  majBadges();
  const vues = {
    accueil: vueAccueil, documents: () => vueCentre(param), factures: vueFactures, document: () => vueDocument(param), 'rapport-mensuel': () => vueRapportMensuel(param),
    prestations: () => vuePrestations(param), 'main-courante': () => vueMainCourante(param), equipe: () => (param ? vueAgent(+param) : vueEquipe()), messages: vueMessages, compte: vueCompte,
  };
  Promise.resolve(vues[route]()).then((contenu) => { page.replaceChildren(...[contenu].flat(Infinity).filter(Boolean)); animerNombres(page); })
    .catch((e) => page.replaceChildren(h('p', { class: 'ec-message' }, e.message)));
  window.scrollTo(0, 0);
}

/* ---------- Aperçu d'un document (tiroir latéral) ---------- */
let tiroir;
function fermerApercu() {
  if (!tiroir) return;
  const t = tiroir;
  tiroir = null;
  t.classList.remove('is-ouvert');
  setTimeout(() => t.remove(), 300);
  if (!document.querySelector('.palette.is-ouvert') && !document.body.classList.contains('menu-ouvert')) voile?.classList.remove('is-ouvert');
}
function apercu(i) {
  fermerApercu();
  const meta = [['Date', frLong(i.date)], i.reference ? ['Référence', i.reference] : null, i.expire ? ['Valable jusqu’au', frLong(i.expire)] : null,
    ['Rubrique', etat.centre?.categories?.[i.categorie] || i.genre], i.taille ? ['Taille', `${Math.max(1, Math.round(i.taille / 1024))} Ko`] : null].filter(Boolean);
  tiroir = h('aside', { class: 'tiroir', role: 'dialog', 'aria-modal': 'true', 'aria-label': i.titre },
    h('header', { class: 'tiroir__tete' }, h('small', null, i.genre), h('h2', null, i.titre), i.sous ? h('p', null, i.sous) : null,
      h('button', { class: 'tiroir__fermer', type: 'button', 'aria-label': 'Fermer l’aperçu', onclick: fermerTout }, ic('fermer'))),
    h('div', { class: 'tiroir__meta' }, meta.map(([k, v]) => h('div', null, h('small', null, k), h('b', null, v)))),
    h('div', { class: 'tiroir__apercu' }, i.format === 'image' ? h('img', { src: i.url, alt: i.titre }) : h('iframe', { src: `${i.url}#view=FitH&navpanes=0`, title: `Aperçu : ${i.titre}` })),
    h('footer', { class: 'tiroir__actions' },
      h('a', { class: 'btn', href: i.url, target: '_blank', rel: 'noopener' }, ic('externe'), 'Ouvrir dans un onglet'),
      h('a', { class: 'btn btn--nuit', href: telecharger(i.url) }, ic('telecharger'), 'Télécharger')));
  document.body.append(tiroir);
  voile.classList.add('is-ouvert');
  requestAnimationFrame(() => tiroir?.classList.add('is-ouvert'));
  if (i.nouveau) { i.nouveau = false; etat.nouveaux = Math.max(0, etat.nouveaux - 1); majBadges(); }
  tiroir.querySelector('.tiroir__fermer').focus();
}

/* ---------- Recherche rapide (Ctrl + K) ---------- */
let paletteEl;
function fermerPalette() {
  if (!paletteEl) return;
  const p = paletteEl;
  paletteEl = null;
  p.classList.remove('is-ouvert');
  setTimeout(() => p.remove(), 250);
  if (!tiroir && !document.body.classList.contains('menu-ouvert')) voile?.classList.remove('is-ouvert');
}
async function palette() {
  if (paletteEl) return;
  fermerApercu();
  const champ = h('input', { type: 'search', placeholder: 'Rechercher une facture, une attestation, un rapport…', 'aria-label': 'Rechercher', autocomplete: 'off' });
  const liste = h('div', { class: 'palette__liste', role: 'listbox' }, squelette(4));
  paletteEl = h('div', { class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Recherche' },
    h('div', { class: 'palette__champ' }, ic('recherche'), champ, h('kbd', null, 'Échap')), liste,
    h('div', { class: 'palette__pied' }, h('span', null, '↑ ↓ pour choisir'), h('span', null, 'Entrée pour ouvrir')));
  document.body.append(paletteEl);
  voile.classList.add('is-ouvert');
  requestAnimationFrame(() => paletteEl?.classList.add('is-ouvert'));
  champ.focus();
  const pages = MENU.flatMap(([, items]) => items).map(([k, lib, icone]) => ({ titre: lib, sous: 'Aller à la page', icone, action: () => { location.hash = `#/${k}`; } }));
  let docs = [];
  try { docs = (await chargerCentre()).items; } catch (e) { /* la recherche reste possible dans les pages */ }
  let resultats = [];
  let actif = 0;
  const rendre = () => {
    const q = sansAccent(champ.value.trim());
    const trouve = (t) => !q || q.split(/\s+/).every((m) => sansAccent(t).includes(m));
    const p = pages.filter((x) => trouve(x.titre)).slice(0, q ? 4 : 7);
    const d = docs.filter((x) => trouve(`${x.titre} ${x.sous} ${x.genre} ${x.reference} ${x.montant ?? ''} ${frDate(x.date)}`)).slice(0, q ? 12 : 6)
      .map((x) => ({ titre: x.titre, sous: `${x.genre} · ${frDate(x.date)}`, icone: x.categorie === 'factures' ? 'facture' : x.format === 'rapport' ? 'rapport' : 'dossier',
        droite: typeof x.montant === 'number' ? euro.format(x.montant) : '', action: () => ouvrirItem(x) }));
    resultats = [...p, ...d];
    actif = Math.min(actif, Math.max(0, resultats.length - 1));
    const item = (r, n) => h('button', { class: `palette__item ${n === actif ? 'is-actif' : ''}`, type: 'button', role: 'option', onmouseenter: () => { actif = n; marquer(); },
      onclick: () => { fermerTout(); r.action(); } }, ic(r.icone), h('span', null, h('b', null, r.titre), h('small', null, r.sous)), r.droite ? h('em', null, r.droite) : null);
    remplir(liste,
      p.length ? h('p', { class: 'palette__groupe' }, 'Pages') : null, p.map((r, n) => item(r, n)),
      d.length ? h('p', { class: 'palette__groupe' }, q ? 'Documents' : 'Documents récents') : null, d.map((r, n) => item(r, n + p.length)),
      resultats.length ? null : h('p', { class: 'palette__vide' }, 'Aucun résultat. Essayez un numéro de facture, un mois ou un type de document.'));
  };
  const marquer = () => liste.querySelectorAll('.palette__item').forEach((b, n) => b.classList.toggle('is-actif', n === actif));
  champ.addEventListener('input', () => { actif = 0; rendre(); });
  champ.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); actif = Math.min(actif + 1, resultats.length - 1); marquer(); liste.querySelectorAll('.palette__item')[actif]?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); actif = Math.max(actif - 1, 0); marquer(); liste.querySelectorAll('.palette__item')[actif]?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter' && resultats[actif]) { e.preventDefault(); const r = resultats[actif]; fermerTout(); r.action(); }
  });
  rendre();
}

/* ---------- Transmettre un document à BDA / demander une pièce ---------- */
function transmettre() {
  const fichier = h('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png,image/webp', class: 'ec-cache' });
  fichier.onchange = async () => {
    const f = fichier.files[0];
    fichier.remove();
    if (!f) return;
    const fd = new FormData();
    fd.append('fichier', f);
    fd.append('titre', f.name.replace(/\.[a-z0-9]+$/i, ''));
    try { await apiForm('mod.portail.depot', fd); oublierCentre(); toast('Document transmis à BDA Security Group.'); location.hash = '#/documents/echanges'; if (location.hash === '#/documents/echanges') naviguer(); }
    catch (e) { toast(e.message, true); }
  };
  document.body.append(fichier);
  fichier.click();
}
async function demanderDocument(libelle, bouton) {
  const fd = new FormData();
  fd.append('texte', `Pourriez-vous mettre à notre disposition dans l’espace client : ${libelle} ?`);
  fd.append('demande', 'document');
  if (bouton) bouton.disabled = true;
  try { await apiForm('mod.portail.message.envoyer', fd); toast('Demande transmise. Vous serez prévenu dès que le document sera disponible.'); if (bouton) bouton.textContent = 'Demandé'; }
  catch (e) { toast(e.message, true); if (bouton) bouton.disabled = false; }
}

/* ---------- Accueil ---------- */
async function vueAccueil() {
  const [t, data, eq, mc] = await Promise.all([api('mod.portail.tableau'), chargerCentre(true), api('mod.portail.equipe').catch(() => ({ agents: [], candidats: [] })),
    api('mod.journal.jour').catch(() => null)]);
  etat.nouveaux = t.nouveaux;
  etat.nonLus = t.messagesNonLus;
  majBadges();
  const p = t.prestations;
  const f = t.factures;
  const der = p.dernier;
  const maintenant = new Date();
  const factures = data.items.filter((i) => i.categorie === 'factures' && i.statut.code !== 'annulee').sort(parDate);
  const annee = String(f.annee);
  const nbAnnee = factures.filter((i) => String(i.date).startsWith(annee)).length;
  const candidats = eq.candidats || [];

  const equipe = h('div', { class: 'liste-equipe' },
    eq.agents.length ? gerantDabord(eq.agents).map((a) => h('a', { class: `personne-ligne ${a.gerant ? 'personne-ligne--or' : ''}`, href: `#/equipe/${a.id}` },
      h('i', { class: `initiales ${a.gerant ? 'initiales--or' : ''}` }, initiales(a.nom)),
      h('span', null, h('b', null, a.nom, a.gerant ? mentionGerant() : null), h('small', null, a.gerant ? 'Dirigeant de BDA Security Group' : a.qualification)),
      a.enPoste ? statut('ok', `En poste depuis ${hm(a.enPoste)}`) : null))
      : h('p', { class: 'note' }, 'Les dossiers des agents affectés à votre site apparaîtront ici.'),
    candidats.length ? [h('p', { class: 'liste-equipe__titre' }, 'En attente d’embauche'),
      candidats.map((a) => h('a', { class: 'personne-ligne', href: `#/equipe/${a.id}` }, h('i', { class: 'initiales initiales--clair' }, initiales(a.nom)),
        h('span', null, h('b', null, a.nom), h('small', null, a.note || a.qualification))))] : null);

  const aFaire = [
    ...t.echeances.map((e) => h('li', null, h('a', { href: e.vue }, h('span', null, h('b', null, e.titre), h('small', null, [e.detail, frDate(e.date), typeof e.montant === 'number' ? euro.format(e.montant) : null].filter(Boolean).join(' · ')))))),
    ...t.demandes.map((d) => h('li', null, h('a', { href: '#/messages' }, h('span', null, h('b', null, d.libelle), h('small', null, `${d.etat} · envoyée le ${frDate(d.cree)}`))))),
  ];

  return [
    h('header', { class: 'accueil-tete' },
      h('div', null, h('span', { class: 'sur' }, maintenant.getHours() < 18 ? 'Bonjour' : 'Bonsoir'), h('h1', null, etat.client.nom),
        h('p', null, p.prochain ? ['Prochaine présence de nos agents : ', h('b', null, `${frJour(p.prochain.jour)}, ${hm(p.prochain.debut)} – ${hm(p.prochain.fin)}`), p.prochain.agent ? ` · ${p.prochain.agent}` : '']
          : 'Vos factures, vos heures de présence et votre équipe, au même endroit.')),
      h('div', { class: 'accueil-tete__date' }, h('b', null, `${maintenant.getDate()} ${MOIS[maintenant.getMonth()]}`), cap(JOURS[maintenant.getDay()]))),
    t.annonces.map((a) => h('section', { class: `annonce ${a.niveau === 'important' ? 'annonce--important' : ''}` }, h('small', null, a.niveau === 'important' ? 'Important' : 'Information'), h('b', null, a.titre), a.texte ? h('p', null, a.texte) : null)),
    h('div', { class: 'chiffres chiffres--3' },
      der && der.encours && der.prevu ? [kpi(der ? `#/prestations/${der.mois}` : '#/prestations', der ? `Heures · ${der.libelle}` : 'Heures de présence', nombre(der ? der.heures : 0, 'heures'),
        !der ? 'Aucune heure enregistrée' : der.encours ? `${pluriel(der.jours, 'jour')} fait${der.jours > 1 ? 's' : ''} · ${heures(der.prevu || der.heures)} prévues ce mois-ci`
          : `${pluriel(der.jours, 'jour')}${der.source === 'releve' ? ` · facture ${der.facture}` : ''}`)].map((k) => { k.append(barre(der.heures, der.prevu, 'kpi__barre')); return k; })
        : kpi(der ? `#/prestations/${der.mois}` : '#/prestations', der ? `Heures · ${der.libelle}` : 'Heures de présence', nombre(der ? der.heures : 0, 'heures'),
          der ? `${pluriel(der.jours, 'jour')}${der.source === 'releve' ? ` · facture ${der.facture}` : ''}` : 'Aucune heure enregistrée'),
      kpi('#/factures', 'Reste à régler', nombre(f.montantDu, 'euro'), f.enRetard ? `${pluriel(f.enRetard, 'facture')} en retard` : f.aRegler ? `${pluriel(f.aRegler, 'facture')} en attente` : 'Toutes vos factures sont réglées',
        f.enRetard ? 'alerte' : f.montantDu > 0 ? 'attente' : ''),
      kpi('#/factures', `Facturé en ${annee}`, nombre(f.totalAnnee, 'euro'), pluriel(nbAnnee, 'facture'))),
    aFaire.length ? panneau('À traiter', null, h('ul', { class: 'a-faire' }, aFaire)) : null,
    h('div', { class: 'grille' },
      h('div', { class: 'colonne' },
        mc?.sites?.length ? panneauAujourdhui(mc) : null,
        panneau('Dernières factures', h('a', { class: 'lien', href: '#/factures' }, `Toutes les factures (${factures.length})`, ic('fleche')),
          factures.length ? tableau([['Facture'], ['Montant', 'd'], ['Statut', 'm-cache'], ['', 'd m-cache']], factures.slice(0, 5).map((i) => ligne(() => ouvrirItem(i), [
            td(h('div', { class: 'doc' }, pictos(i), h('span', null, h('b', null, i.reference || i.titre), h('small', null, i.periode || frLong(i.date))))),
            td(euro.format(i.montant), 'd chiffre fort'), td(statut(i.statut.ton, i.statut.libelle), 'm-cache'), tdFleche()])))
            : vide('Aucune facture pour l’instant', 'Vos factures apparaîtront ici dès leur émission.'))),
      h('div', { class: 'colonne' },
        panneau('Votre chargé de compte', null, corpsP(carteInterlocuteur(t.interlocuteur))),
        panneau('Votre équipe', h('a', { class: 'lien', href: '#/equipe' }, 'Dossiers', ic('fleche')), corpsP(equipe)))),
  ];
}

/* ---------- Chargé de compte : la personne qui suit le client au bureau ---------- */
function carteInterlocuteur(p) {
  if (!p) return null;
  return h('div', { class: 'interlocuteur' },
    h('div', { class: 'interlocuteur__tete' }, h('i', { class: 'initiales initiales--nuit' }, initiales(p.nom)),
      h('span', null, h('b', null, p.nom), h('small', null, p.role))),
    h('p', { class: 'note' }, `${p.mission} : une question, un changement de planning, un document, c’est lui qui s’en occupe.`),
    h('div', { class: 'contact__boutons' },
      h('a', { class: 'btn btn--nuit', href: '#/messages' }, ic('messages'), 'Lui écrire'),
      p.email ? h('a', { class: 'btn', href: `mailto:${p.email}` }, ic('envoyer'), p.email) : null),
    h('p', { class: 'interlocuteur__urgence' }, 'Urgence sur site, 24h/24 : ', h('a', { href: 'tel:+33611678625' }, '06 11 67 86 25')));
}

/* ---------- Documents : quelques dossiers et une recherche ---------- */
const TON_CONF = { valide: ['ok', 'Disponible'], bientot: ['attente', 'À renouveler bientôt'], expire: ['alerte', 'Expirée — mise à jour en cours'], manquant: ['neutre', 'Sur demande'] };
// L'équipe et les heures ont leur propre page : elles ne sont pas répétées ici
const DOSSIERS = {
  factures: ['Factures', 'facture', 'Toutes les factures envoyées'],
  conformite: ['Documents de l’entreprise', 'bouclier', 'Kbis, autorisation CNAPS, assurance'],
  rapports: ['Rapports mensuels', 'rapport', 'Le compte rendu de chaque mois'],
  devis: ['Devis', 'dossier', 'Devis reçus et signés'],
  contrats: ['Contrats', 'dossier', 'Contrat de prestation et avenants'],
  courriers: ['Courriers', 'dossier', 'Courriers de la direction'],
  echanges: ['Pièces échangées', 'trombone', 'Ce que vous nous avez transmis'],
};
async function vueCentre(categorie) {
  const data = await chargerCentre(true);
  const items = data.items.filter((i) => DOSSIERS[i.categorie]).sort(parDate);
  const de = (k) => items.filter((i) => i.categorie === k);
  const cat = DOSSIERS[categorie] ? categorie : '';
  const zone = h('div', { class: 'colonne' });
  const recherche = saisie({ type: 'search', placeholder: 'Rechercher : numéro de facture, mois, Kbis, assurance…', 'aria-label': 'Rechercher un document' });
  const liste = (l) => {
    const avecMontant = l.some((i) => typeof i.montant === 'number');
    return tableau([['Document'], ['Date', 'm-cache'], avecMontant ? ['Montant', 'd m-cache'] : null, ['', 'd']].filter(Boolean), l.map((i) => ligne(() => ouvrirItem(i), [
      td([celluleDoc(i), h('small', { class: 'm-seul' }, [frDate(i.date), typeof i.montant === 'number' ? euro.format(i.montant) : ''].filter(Boolean).join(' · '))]),
      td(frDate(i.date), 'chiffre m-cache'),
      avecMontant ? td(typeof i.montant === 'number' ? euro.format(i.montant) : '', 'd chiffre m-cache') : null,
      td(h('div', { class: 'actions' }, boutonTelecharger(i), h('span', { class: 'fleche' }, ic('fleche'))), 'd')].filter(Boolean))));
  };
  const entreprise = () => tableau([['Pièce'], ['Validité', 'm-cache'], ['État'], ['', 'd']], data.conformite.map((k) => {
    const [ton, lib] = TON_CONF[k.etat];
    const doc = k.doc ? items.find((i) => i.cle === k.doc.cle) || k.doc : null;
    return ligne(doc ? () => ouvrirItem(doc) : null, [
      td(h('div', { class: 'doc' }, doc ? pictos(doc) : h('span', { class: 'pictos', 'aria-hidden': 'true' }, h('em', null, '—')), h('span', null, h('b', null, k.libelle), h('small', null, k.rappel)))),
      td(k.expire ? `Jusqu’au ${frDate(k.expire)}` : doc ? 'Sans limite' : '—', 'chiffre m-cache'),
      td(k.etat === 'manquant' ? h('span', { class: 'manquant' }, lib) : statut(ton, lib)),
      td(doc ? h('div', { class: 'actions' }, boutonTelecharger(doc), h('span', { class: 'fleche' }, ic('fleche')))
        : h('button', { class: 'btn btn--petit', type: 'button', onclick: (e) => demanderDocument(k.libelle, e.currentTarget) }, 'Demander'), 'd')]);
  }));
  const rendre = () => {
    const q = sansAccent(recherche.value.trim());
    if (q) {
      const r = items.filter((i) => q.split(/\s+/).every((m) => sansAccent(`${i.titre} ${i.sous} ${i.genre} ${i.reference} ${frDate(i.date)} ${frLong(i.date)} ${i.montant ?? ''} ${DOSSIERS[i.categorie][0]}`).includes(m)));
      return remplir(zone, panneau('Résultats', h('small', null, pluriel(r.length, 'document')),
        r.length ? liste(r) : vide('Aucun document trouvé', 'Essayez un numéro de facture, un mois (par exemple « octobre ») ou un mot comme « Kbis ».')));
    }
    if (cat) {
      const [lib, , texte] = DOSSIERS[cat];
      const l = de(cat);
      return remplir(zone, panneau(lib, h('small', null, cat === 'conformite' ? texte : pluriel(l.length, 'document')),
        cat === 'conformite' ? entreprise() : l.length ? liste(l) : vide('Ce dossier est vide pour l’instant', '')));
    }
    remplir(zone,
      h('div', { class: 'dossiers' }, Object.entries(DOSSIERS).filter(([k]) => de(k).length || k === 'conformite' || k === 'factures').map(([k, [lib, icone, texte]]) => {
        const n = k === 'conformite' ? data.conformite.filter((x) => x.doc).length : de(k).length;
        return h('a', { class: 'dossier', href: `#/documents/${k}` }, h('span', { class: 'dossier__ic' }, ic(icone)),
          h('span', { class: 'dossier__texte' }, h('b', null, lib), h('small', null, texte)), h('em', null, n), ic('fleche'));
      })),
      items.length ? panneau('Les plus récents', null, liste(items.slice(0, 5))) : null);
  };
  let attente;
  recherche.addEventListener('input', () => { clearTimeout(attente); attente = setTimeout(rendre, 120); });
  rendre();
  return [
    cat ? h('div', { class: 'barre-doc' }, h('a', { class: 'retour', href: '#/documents' }, ic('retour'), 'Tous les dossiers')) : null,
    tete('Documents', cat ? DOSSIERS[cat][0] : 'Vos documents', cat ? '' : 'Choisissez un dossier, ou tapez un mot pour retrouver un document.',
      h('button', { class: 'btn', type: 'button', onclick: transmettre }, ic('televerser'), 'Nous transmettre un document')),
    h('div', { class: 'recherche recherche--grande' }, ic('recherche'), recherche),
    zone,
  ];
}

/* ---------- Factures ---------- */
async function vueFactures() {
  const data = await chargerCentre(true);
  const toutes = data.items.filter((i) => i.categorie === 'factures' && i.statut.code !== 'annulee').sort(parDate);
  const annee = String(new Date().getFullYear());
  const somme = (l) => Math.round(l.reduce((s, i) => s + (i.montant || 0), 0) * 100) / 100;
  const de = (a) => toutes.filter((i) => String(i.date).startsWith(a));
  const aRegler = toutes.filter((i) => i.statut.code === 'envoyee');
  const retard = aRegler.filter((i) => i.statut.ton === 'alerte');
  const reglees = toutes.filter((i) => i.statut.code === 'payee');
  const annees = [...new Set(toutes.map((i) => String(i.date).slice(0, 4)).filter((a) => /^\d{4}$/.test(a)))].sort().reverse();
  let choix = '';
  const onglets = h('div', { class: 'annees', role: 'tablist', 'aria-label': 'Année' });
  const zone = h('div');
  const ligneFacture = (i) => ligne(() => ouvrirItem(i), [
    td([h('div', { class: 'doc' }, pictos(i), h('span', null, h('b', null, i.reference || i.titre, i.nouveau ? h('i', { class: 'nouveau' }, 'Nouveau') : null), h('small', null, i.periode || i.sous || 'Facture'))),
      h('small', { class: 'm-seul' }, `${i.statut.libelle} · ${frDate(i.date)}`)]),
    td(frDate(i.date), 'chiffre m-cache'),
    td(euro.format(i.montant), 'd chiffre fort'),
    td(statut(i.statut.ton, i.statut.libelle), 'm-cache'),
    td(h('div', { class: 'actions' }, boutonTelecharger(i), h('span', { class: 'fleche' }, ic('fleche'))), 'd m-cache')]);
  const rendre = () => {
    remplir(onglets, [['', 'Toutes', toutes.length], ...annees.map((a) => [a, a, de(a).length])].map(([v, lib, n]) =>
      h('button', { type: 'button', role: 'tab', class: `annee ${choix === v ? 'is-actif' : ''}`, 'aria-selected': choix === v ? 'true' : 'false', onclick: () => { choix = v; rendre(); } }, lib, h('em', null, n))));
    const lignes = (choix ? [choix] : annees).flatMap((a) => {
      const l = de(a);
      return l.length ? [h('tr', { class: 'groupe' }, h('td', { colspan: 5 }, h('div', null, h('b', null, a), h('span', null, `${pluriel(l.length, 'facture')} · ${euro.format(somme(l))}`)))), ...l.map(ligneFacture)] : [];
    });
    const liste = choix ? de(choix) : toutes;
    remplir(zone, liste.length ? tableau([['Facture'], ['Date', 'm-cache'], ['Montant TTC', 'd'], ['Statut', 'm-cache'], ['', 'd m-cache']], lignes)
      : vide('Aucune facture pour le moment', 'Dès qu’une facture vous est adressée, elle apparaît ici automatiquement.'),
    liste.length ? h('div', { class: 'panneau__pied' }, h('span', { class: 'note' }, `${pluriel(liste.length, 'facture')}${choix ? ` en ${choix}` : ' depuis le début'}`), h('b', { class: 'chiffre' }, `Total : ${euro.format(somme(liste))}`)) : null);
  };
  rendre();
  return [
    tete('Facturation', 'Factures', toutes.length ? `Toutes les factures adressées à ${etat.client.nom}${annees.length ? ` depuis ${annees.at(-1)}` : ''}. Cliquez sur une facture pour l’ouvrir ou la télécharger.` : '',
      h('a', { class: 'btn', href: '#/messages', onclick: () => { etat.demande = 'facture'; } }, ic('messages'), 'Une question sur une facture')),
    h('div', { class: 'chiffres chiffres--3' },
      kpi(null, `Facturé en ${annee}`, nombre(somme(de(annee)), 'euro'), pluriel(de(annee).length, 'facture')),
      kpi(null, 'Total réglé', nombre(somme(reglees), 'euro'), `${pluriel(reglees.length, 'facture')} depuis le début`),
      kpi(null, 'Reste à régler', nombre(somme(aRegler), 'euro'), retard.length ? `${pluriel(retard.length, 'facture')} en retard` : aRegler.length ? `${pluriel(aRegler.length, 'facture')} en attente` : 'Rien à régler', retard.length ? 'alerte' : aRegler.length ? 'attente' : '')),
    h('section', { class: 'panneau' }, annees.length > 1 ? h('div', { class: 'outils' }, onglets) : null, zone),
  ];
}

/* ---------- Devis / facture en lecture ---------- */
async function vueDocument(id) {
  const { document: doc, accord, item } = await api('mod.portail.doc', undefined, { id });
  const d = doc.data || {};
  const estFacture = doc.type === 'facture';
  if (item.nouveau) { oublierCentre(); etat.nouveaux = Math.max(0, etat.nouveaux - 1); majBadges(); }
  const lignes = Array.isArray(d.lignes) ? d.lignes : [];
  const ht = lignes.reduce((s, l) => s + Math.round((+l.qte || 0) * (+l.pu || 0) * 100) / 100, 0);
  const taux = +d.tva || 0;
  const tva = Math.round(ht * taux) / 100;
  const ttc = Math.round((ht + tva) * 100) / 100;
  const qte = (l) => (l.unite === 'h' ? fmtHeures(+l.qte || 0) : new Intl.NumberFormat('fr-FR').format(+l.qte || 0));
  const texte = (t) => String(t || '').split('\n').map((x, i) => [i ? h('br') : null, x]);
  const signature = !estFacture && doc.statut === 'envoye' ? panneauSignature(doc) : null;
  const barre = h('div', { class: 'barre-doc' },
    h('a', { class: 'retour', href: estFacture ? '#/factures' : '#/documents/devis' }, ic('retour'), estFacture ? 'Toutes les factures' : 'Devis et accords'),
    h('a', { class: 'btn', href: '#/messages', onclick: () => { etat.demande = estFacture ? 'facture' : ''; } }, ic('messages'), 'Poser une question'),
    h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, ic('imprimer'), 'Imprimer'),
    item.url ? h('a', { class: 'btn', href: telecharger(item.url) }, ic('telecharger'), 'Télécharger le PDF') : null,
    signature ? h('button', { class: 'btn btn--nuit', type: 'button', onclick: () => signature.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, ic('coche'), 'Signer ce devis') : null);
  const feuille = h('article', { class: 'feuille' },
    h('header', { class: 'feuille__tete' },
      h('img', { src: '/admin/logo-document.jpg?v=4', alt: 'BDA Security Group', class: 'feuille__logo' }),
      h('div', { class: 'feuille__titre' }, h('h2', null, estFacture ? 'Facture' : 'Devis'), h('b', null, `N° ${doc.numero}`), statut(item.statut.ton, item.statut.libelle))),
    h('div', { class: 'feuille__parties' },
      h('div', null, h('small', null, 'Émetteur'), h('b', null, d.emetteurNom || 'BDA Security Group'), h('p', null, texte(d.emetteur))),
      h('div', null, h('small', null, estFacture ? 'Facturé à' : 'À l’attention de'), h('b', null, d.client?.nom || ''), h('p', null, texte(d.client?.adresse)))),
    h('div', { class: 'feuille__meta' },
      h('span', null, h('small', null, 'Date'), frDate(doc.date)),
      estFacture ? h('span', null, h('small', null, 'Échéance'), frDate(doc.echeance)) : h('span', null, h('small', null, 'Validité'), d.validite || '—'),
      d.periode ? h('span', null, h('small', null, 'Période'), d.periode) : null),
    !estFacture && (d.objet || d.description) ? h('div', { class: 'feuille__objet' }, h('b', null, d.objet || ''), h('p', null, texte(d.description))) : null,
    !estFacture && (d.lieu || d.horaires || d.effectif) ? h('div', { class: 'feuille__meta' },
      d.lieu ? h('span', null, h('small', null, 'Lieu'), d.lieu) : null, d.horaires ? h('span', null, h('small', null, 'Horaires'), d.horaires) : null, d.effectif ? h('span', null, h('small', null, 'Effectif'), d.effectif) : null) : null,
    h('div', { class: 'feuille__table' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Désignation'), h('th', null, 'Quantité'), h('th', null, 'Prix unitaire'), h('th', null, 'Total'))),
      h('tbody', null, lignes.filter((l) => (+l.qte || 0) || l.designation).map((l) => h('tr', null,
        h('td', null, l.designation || '', l.detail ? h('small', null, l.detail) : null), h('td', null, qte(l)), h('td', null, euro.format(+l.pu || 0)), h('td', null, euro.format(Math.round((+l.qte || 0) * (+l.pu || 0) * 100) / 100))))))),
    h('div', { class: 'feuille__totaux' },
      h('div', null, h('span', null, 'Total HT'), h('b', null, euro.format(ht))),
      h('div', null, h('span', null, taux ? `TVA (${taux} %)` : 'TVA'), h('b', null, taux ? euro.format(tva) : 'Non applicable')),
      h('div', { class: 'is-grand' }, h('span', null, estFacture ? (taux ? 'Net à payer TTC' : 'Net à payer') : (taux ? 'Total TTC' : 'Total')), h('b', null, euro.format(ttc))),
      !estFacture && +d.acompte ? h('div', null, h('span', null, `Acompte à la commande (${d.acompte} %)`), h('b', null, euro.format(Math.round(ttc * d.acompte) / 100))) : null),
    estFacture && d.paiement ? h('div', { class: 'feuille__bloc' }, h('small', null, 'Règlement par virement'), h('p', null, texte(d.paiement))) : null,
    d.conditions ? h('div', { class: 'feuille__bloc' }, h('small', null, 'Conditions'), h('p', { class: 'note' }, texte(d.conditions))) : null,
    accord ? h('div', { class: 'feuille__bloc feuille__accord' }, h('small', null, 'Bon pour accord'), h('p', null, `Signé en ligne le ${frDateHeure(accord.quand)} par ${accord.nom}${accord.fonction ? `, ${accord.fonction}` : ''}.`)) : null,
    d.pied ? h('footer', { class: 'feuille__pied' }, texte(d.pied)) : null);
  return [barre, feuille, signature];
}
// « Bon pour accord » : nom, fonction et conditions acceptées ; la direction est prévenue aussitôt
function panneauSignature(doc) {
  const nom = saisie({ autocomplete: 'name', placeholder: 'Prénom et nom', required: true });
  const fonction = saisie({ autocomplete: 'organization-title', placeholder: 'Consul, directeur, responsable administratif…' });
  const cgv = h('input', { type: 'checkbox' });
  const msg = h('p', { class: 'erreur', role: 'alert' });
  const btn = h('button', { class: 'btn btn--nuit', type: 'submit' }, ic('coche'), 'Signer le devis');
  const zone = h('div', { class: 'panneau__corps' });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = '';
    if (!cgv.checked) { msg.textContent = 'Cochez l’acceptation du devis et des conditions générales de vente.'; return; }
    btn.disabled = true;
    try {
      const r = await api('mod.portail.devis.signer', { id: doc.id, nom: nom.value.trim(), fonction: fonction.value.trim(), cgv: true });
      oublierCentre();
      zone.replaceChildren(h('div', { class: 'signe' }, h('b', null, 'Devis signé.'), h('p', null, `Bon pour accord enregistré le ${frDateHeure(r.quand)}. La direction de BDA Security Group est prévenue et revient vers vous pour la mise en place.`)));
    } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } },
  h('div', { class: 'deux' }, champ('Nom du signataire', nom), champ('Fonction', fonction)),
  h('label', { class: 'coche' }, cgv, h('span', null, `J’accepte le devis ${doc.numero} et les conditions générales de vente de BDA Security Group.`)),
  msg, btn);
  zone.append(form);
  const p = panneau('Bon pour accord', h('small', null, 'Signature électronique, valable comme un accord écrit'), zone);
  p.classList.add('signature');
  return p;
}

/* ---------- Heures de présence : un onglet par mois, chaque jour dessous ---------- */
async function vuePrestations(choix) {
  const t = await api('mod.portail.tableau');
  const p = t.prestations;
  const mois = p.mois || [];
  const site = p.sites.join(', ') || 'votre site';
  if (!mois.length) return [tete('Prestation', 'Heures de présence', ''), panneau(null, null, vide('Aucune heure pour l’instant', 'Les heures apparaîtront ici dès les premières vacations.'))];
  const actif = mois.find((m) => m.mois === choix) || mois[0];
  const r = await api('mod.portail.rapport', undefined, { mois: actif.mois });
  const tt = r.total;
  const onglets = h('div', { class: 'annees', role: 'tablist', 'aria-label': 'Mois' }, mois.map((m) => h('a', { href: `#/prestations/${m.mois}`, role: 'tab',
    class: `annee ${m.mois === actif.mois ? 'is-actif' : ''}`, 'aria-selected': m.mois === actif.mois ? 'true' : 'false' }, m.libelle, h('em', null, m.encours ? 'en cours' : heures(m.heures)))));
  const chiffre = (lib, val, sous) => h('div', null, h('small', null, lib), h('b', null, val), sous ? h('span', null, sous) : null);
  let resume;
  let table;
  if (r.source === 'releve') {
    resume = [chiffre('Total du mois', nombre(tt.heures, 'heures')), chiffre('Jours travaillés', nombre(tt.jours)),
      chiffre('Facture', h('a', { href: `#/document/${r.factureId}` }, r.facture), 'Réglée')];
    table = tableau([['Jour'], ['Horaires'], ['Heures', 'd']], r.lignes.map((l) => ligne(null, [
      td(cap(frJour(l.jour)), 'fort'), td([l.matin, l.apm].filter(Boolean).map(plage).join(' · ') || '—', 'chiffre'), td(l.heures ? heures(l.heures) : '—', 'd chiffre')])));
  } else {
    resume = r.encours
      ? [chiffre('Heures faites', nombre(tt.heures, 'heures'), `jusqu’à aujourd’hui · ${pluriel(tt.jours, 'jour')}`), chiffre('Prévues ce mois-ci', nombre(tt.prevu, 'heures'), pluriel(tt.joursPrevus, 'jour')),
        chiffre('Restent à faire', nombre(Math.max(0, tt.prevu - tt.heures), 'heures'), 'd’ici la fin du mois')]
      : [chiffre('Total du mois', nombre(tt.heures, 'heures')), chiffre('Jours travaillés', nombre(tt.jours))];
    table = tableau([['Jour'], ['Horaires'], ['Agent', 'm-cache'], ['Heures', 'd']], r.lignes.map((l) => h('tr', { class: l.fait ? null : 'prevu' },
      td([cap(frJour(l.jour)), h('small', null, l.fait ? 'Fait' : 'Prévu'), h('small', { class: 'm-seul' }, l.agent)], 'fort'), td(`${hm(l.debut)} – ${hm(l.fin)}`, 'chiffre'),
      td(l.agent, 'm-cache'), td(heures(l.heures), 'd chiffre'))));
  }
  return [
    tete('Prestation', 'Heures de présence', `Les heures de nos agents sur votre site (${site}), mois par mois.`, h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, ic('imprimer'), 'Imprimer')),
    h('section', { class: 'panneau' },
      mois.length > 1 ? h('div', { class: 'outils' }, onglets) : null,
      h('header', { class: 'panneau__tete' }, h('h2', null, actif.libelle), h('div', { class: 'tete__actions' },
        actif.rapport ? h('a', { class: 'btn btn--petit', href: `#/rapport-mensuel/${actif.mois}` }, ic('rapport'), 'Rapport du mois') : null,
        r.source === 'releve' ? statut('ok', 'Mois facturé') : r.encours ? statut('attente', 'Mois en cours') : statut('neutre', 'Mois terminé'))),
      h('div', { class: 'resume-mois' }, resume),
      r.source !== 'releve' && r.encours && tt.prevu ? h('div', { class: 'avancement' }, barre(tt.heures, tt.prevu),
        h('span', null, `${Math.round(tt.heures / tt.prevu * 100)} % du mois effectué`)) : null,
      r.lignes.length ? table : vide('Aucune vacation ce mois-ci', '')),
    h('p', { class: 'note' }, r.source === 'releve' ? `Heures reprises du relevé joint à la facture ${r.facture}.` : r.encours ? 'Les jours « Prévu » sont à venir : ils peuvent encore changer.' : '',
      ' Une question ? ', h('a', { href: '#/messages' }, 'Écrivez-nous'), '.'),
  ];
}

/* ---------- Main courante : le cahier de poste, tenu en direct par nos agents ---------- */
const decalerJour = (j, n) => { const d = dt(j); d.setDate(d.getDate() + n); return iso(d); };
const heureMC = (s) => String(s || '').slice(11, 16).replace(':', 'h');
// Ce qu'on lit sur une ligne du cahier
function ligneMC(l) {
  if (l.type === 'note') return l.libelle && l.libelle !== 'Note' ? { titre: l.libelle, detail: l.detail } : { titre: l.detail || 'Note', detail: '' };
  if (l.type === 'visiteur') return { titre: l.libelle, detail: [l.detail, l.depart ? `reparti à ${heureMC(l.depart)}` : 'sur place'].filter(Boolean).join(' · ') };
  return { titre: l.libelle, detail: l.detail };
}
const classeMC = (l) => (l.type === 'incident' ? 'mc-incident' : l.type === 'prise' || l.type === 'fin' ? 'mc-auto' : null);
// Le résumé de la journée : présence de l'agent, compte rendu de la liste, visites et livraisons
const hmMC = (x) => String(x || '').replace(':', 'h').replace(/^0(\d)/, '$1');
function chiffresMC(r, liste) {
  if (!r) return null;
  const cases = [
    ['Présence de l’agent', r.debut ? (r.enCours ? `Depuis ${hmMC(r.debut)}` : `${hmMC(r.debut)} – ${hmMC(r.fin)}`) : '—',
      r.enCours ? statut('ok', 'En poste') : (r.pauses || []).length ? h('span', null, r.pauses.map(([a, b]) => `Pause de ${hmMC(a)} à ${hmMC(b)}`).join(' · ')) : null],
    liste || r.absents !== null ? ['Absents sur la liste', r.absents !== null ? nombre(r.absents) : '—', r.absents === null ? h('span', null, 'Noté à la fermeture') : null] : null,
    liste || r.sansRdv ? ['Sans rendez-vous', r.sansRdv !== null ? nombre(r.sansRdv) : '—', null] : null,
    ['Visites et livraisons', nombre(r.passages || 0), null],
  ].filter(Boolean);
  return h('div', { class: 'mc-chiffres' }, cases.map(([k, v, s2]) => h('div', null, h('small', null, k), h('b', null, v), s2)));
}
function panneauAujourdhui(mc) {
  const lignes = mc.sites.flatMap((s) => s.lignes.map((l) => ({ ...l, site: s.nom }))).sort((a, b) => a.quand.localeCompare(b.quand)).slice(-4);
  const r = mc.sites[0]?.resume;
  const resume = r && (r.debut || r.absents !== null) ? h('div', { class: 'mc-resume' },
    r.debut ? h('span', null, h('b', null, r.enCours ? `Depuis ${hmMC(r.debut)}` : `${hmMC(r.debut)} – ${hmMC(r.fin)}`), r.enCours ? ' agent en poste' : ' présence de l’agent') : null,
    r.absents !== null ? h('span', null, h('b', null, nombre(r.absents)), r.absents > 1 ? ' absents sur la liste' : ' absent sur la liste') : null) : null;
  return panneau('Aujourd’hui sur votre site', h('a', { class: 'lien', href: '#/main-courante' }, 'Main courante', ic('fleche')),
    resume,
    lignes.length ? h('ol', { class: 'mc-liste' }, lignes.map((l) => { const x = ligneMC(l); return h('li', { class: classeMC(l) }, h('time', null, heureMC(l.quand)), h('span', null, h('b', null, x.titre), x.detail ? h('small', null, x.detail) : null)); }))
      : corpsP(h('p', { class: 'note' }, 'Rien n’est encore noté aujourd’hui. Les lignes apparaissent ici dès que nos agents les inscrivent.')));
}
// « Semaine du 2 au 8 novembre » (ou « du 27 octobre au 2 novembre »)
function libelleSemaine(lundi, dimanche) {
  const a = dt(lundi), b = dt(dimanche);
  return a.getMonth() === b.getMonth() ? `Semaine du ${quantieme(a)} au ${quantieme(b)} ${MOIS[b.getMonth()]}` : `Semaine du ${quantieme(a)} ${MOIS[a.getMonth()]} au ${quantieme(b)} ${MOIS[b.getMonth()]}`;
}
// « Mer. 4 nov. » sur téléphone
const jourCourtMC = (j) => { const d = dt(j); return `${cap(JOURS[d.getDay()].slice(0, 3))}. ${quantieme(d)} ${MOIS_COURTS[d.getMonth()]}`; };
const presenceMC = (r) => (r.debut ? (r.enCours ? `Depuis ${hmMC(r.debut)}` : `${hmMC(r.debut)} – ${hmMC(r.fin)}`) : '');
function tableauLignesMC(lignes) {
  return tableau([['Heure'], ['Événement'], ['Agent', 'm-cache']], lignes.map((l) => {
    const x = ligneMC(l);
    return h('tr', { class: classeMC(l) }, td(heureMC(l.quand), 'chiffre fort mc-heure'),
      td([h('b', { class: 'mc-titre' }, x.titre), x.detail ? h('small', null, x.detail) : null, h('small', { class: 'm-seul' }, l.agent)]), td(l.agent, 'm-cache'));
  }));
}
async function vueMainCourante(param) {
  const auj = iso(new Date());
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(param || '') && param <= auj ? param : auj;
  const zone = h('div', { class: 'mc' });
  const dessiner = (d) => {
    const navigation = h('div', { class: 'mc-jours' },
      h('a', { class: 'btn btn--petit btn--icone', href: `#/main-courante/${decalerJour(d.lundi, -7)}`, 'aria-label': 'Semaine précédente' }, ic('retour')),
      h('b', null, libelleSemaine(d.lundi, d.dimanche)),
      !d.actuelle ? h('a', { class: 'btn btn--petit btn--icone mc-suivant', href: `#/main-courante/${decalerJour(d.lundi, 7)}`, 'aria-label': 'Semaine suivante' }, ic('fleche')) : null,
      d.actuelle ? statut('ok', 'En direct') : h('a', { class: 'lien', href: '#/main-courante' }, 'Cette semaine'));
    const sites = d.sites.map((s) => {
      const actifs = s.jours.filter((j) => j.lignes.length);
      const ancre = (j) => `mc-${s.nom.replace(/\W+/g, '')}-${j}`;
      // la semaine en un coup d'œil : un jour par ligne
      const recap = tableau([['Jour'], ['Présence de l’agent'], ['Absents', 'd'], ['Sans rendez-vous', 'd m-cache'], ['Visites et livraisons', 'd m-cache'], ['', 'd m-cache']],
        s.jours.map((j) => {
          const r = j.resume;
          const rien = !j.lignes.length;
          const tr = ligne(rien ? null : () => document.getElementById(ancre(j.jour))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), [
            td([h('span', { class: 'm-cache' }, cap(frJour(j.jour))), h('span', { class: 'm-seul' }, jourCourtMC(j.jour)), j.jour === auj ? h('small', null, 'Aujourd’hui') : null], 'fort'),
            td(rien ? h('span', { class: 'mc-muet' }, 'Aucune activité') : [presenceMC(r) || '—', (r.pauses || []).length ? h('small', null, r.pauses.map(([a, b]) => `pause ${hmMC(a)} – ${hmMC(b)}`).join(' · ')) : null], 'chiffre'),
            td(r.absents !== null ? String(r.absents) : '—', 'd chiffre'),
            td(r.sansRdv !== null ? String(r.sansRdv) : '—', 'd chiffre m-cache'),
            td(r.passages ? String(r.passages) : '—', 'd chiffre m-cache'),
            rien ? td('', 'm-cache') : tdFleche()]);
          if (rien) tr.classList.add('mc-vide');
          return tr;
        }));
      // le détail, du jour le plus récent au plus ancien
      const details = actifs.slice().reverse().map((j) => h('section', { class: 'mc-jour', id: ancre(j.jour) },
        h('header', { class: 'mc-jour__tete' }, h('h3', null, cap(frJour(j.jour))),
          h('span', null, [presenceMC(j.resume), j.resume.absents !== null ? (j.resume.absents ? `${pluriel(j.resume.absents, 'absent')} sur la liste` : 'aucun absent sur la liste') : '', j.resume.sansRdv ? `${j.resume.sansRdv} sans rendez-vous` : ''].filter(Boolean).join(' · '))),
        tableauLignesMC(j.lignes)));
      return panneau(s.nom, h('small', null, actifs.length ? `${pluriel(actifs.length, 'jour')} d’activité` : 'Aucune activité cette semaine'),
        recap, ...(details.length ? details : [vide('Rien n’est encore noté cette semaine', 'Les lignes apparaissent ici dès que nos agents les inscrivent.')]));
    });
    zone.replaceChildren(navigation, ...(sites.length ? sites : [panneau(null, null, vide('Main courante non disponible', 'Elle s’affichera ici dès que votre site sera relié.'))]),
      h('p', { class: 'note' }, 'Tenue par nos agents au fil du service, depuis leur téléphone. Les pages du cahier papier sont recopiées par la direction.',
        d.actuelle ? ' La page se met à jour toute seule.' : ''));
  };
  dessiner(await api('mod.journal.semaine', undefined, { jour: ref }));
  if (ref === auj) {
    const t = setInterval(async () => {
      if (!zone.isConnected) { clearInterval(t); return; }
      if (document.hidden) return;
      try { dessiner(await api('mod.journal.semaine', undefined, { jour: ref })); } catch (e) { /* on réessaiera */ }
    }, 60000);
  }
  return [tete('Prestation', 'Main courante', 'Le cahier de poste de votre site, semaine par semaine : présence de l’agent, ouvertures, fermetures, liste des rendez-vous, visites et livraisons.',
    h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, ic('imprimer'), 'Imprimer la semaine')), zone];
}

/* ---------- Rapport mensuel de prestation ---------- */
async function vueRapportMensuel(mois) {
  const { rapport: r } = await api('mod.portail.rapport.mensuel', undefined, { mois });
  oublierCentre();
  const s = r.signataire || {};
  const texte = (t) => String(t || '').split('\n').map((x, i) => [i ? h('br') : null, x]);
  const section = (n, titre, ...corps) => h('section', { class: 'rm-section' }, h('h3', null, h('em', null, n), titre), corps);
  const releve = r.source === 'releve';
  const suivant = r.suivant;
  return [
    h('div', { class: 'barre-doc' },
      h('a', { class: 'retour', href: '#/documents/rapports' }, ic('retour'), 'Rapports mensuels'),
      r.factureId ? h('a', { class: 'btn', href: `#/document/${r.factureId}` }, ic('facture'), `Facture ${r.facture}`) : null,
      h('button', { class: 'btn btn--nuit', type: 'button', onclick: () => window.print() }, ic('imprimer'), 'Imprimer ou enregistrer en PDF')),
    h('article', { class: 'feuille rapport-mensuel' },
      h('header', { class: 'feuille__tete' },
        h('img', { src: '/admin/logo-document.jpg?v=4', alt: 'BDA Security Group', class: 'feuille__logo' }),
        h('div', { class: 'feuille__titre' }, h('h2', null, 'Rapport mensuel'), h('b', null, r.libelle), h('span', { class: 'note' }, 'Compte rendu de prestation'))),
      h('div', { class: 'feuille__parties' },
        h('div', null, h('small', null, 'Client'), h('b', null, r.client), h('p', null, r.sites.join(', '))),
        h('div', null, h('small', null, 'Prestataire'), h('b', null, 'BDA Security Group'), h('p', null, 'Surveillance humaine et gardiennage'))),
      h('div', { class: 'rm-chiffres' },
        h('div', null, h('small', null, 'Heures assurées'), h('b', null, nombre(r.heures, 'heures'))),
        h('div', null, h('small', null, 'Jours de présence'), h('b', null, nombre(r.jours))),
        h('div', null, h('small', null, 'Agents mobilisés'), h('b', null, nombre(r.equipe.length)))),
      section('01', 'Faits marquants', h('p', { class: r.faits ? null : 'note' }, r.faits ? texte(r.faits) : 'Aucun incident à signaler sur la période.')),
      r.qualite ? section('02', 'Contrôle qualité', h('p', null, texte(r.qualite))) : null,
      section(r.qualite ? '03' : '02', 'Équipe affectée', r.equipe.length ? h('table', { class: 'rm-table' },
        h('thead', null, h('tr', null, h('th', null, 'Agent'), h('th', null, 'Qualification'), h('th', null, 'Carte professionnelle'))),
        h('tbody', null, r.equipe.map((a) => h('tr', null, h('td', null, a.nom), h('td', null, a.qualification), h('td', null, a.carte)))))
        : h('p', { class: 'note' }, 'Équipe communiquée sur demande.')),
      section(r.qualite ? '04' : '03', 'Détail des présences', r.lignes.length ? h('table', { class: 'rm-table' },
        h('thead', null, h('tr', null, h('th', null, 'Jour'), h('th', null, 'Horaires'), releve ? null : h('th', null, 'Agent'), h('th', { class: 'd' }, 'Heures'))),
        h('tbody', null, r.lignes.map((l) => h('tr', null, h('td', null, cap(frJour(l.jour))), h('td', null, plage(l.horaires) || '—'), releve ? null : h('td', null, l.agent), h('td', { class: 'd' }, heures(l.heures))))),
        h('tfoot', null, h('tr', null, h('td', { colspan: releve ? 2 : 3 }, `Total · ${pluriel(r.jours, 'jour')}`), h('td', { class: 'd' }, heures(r.heures)))))
        : h('p', { class: 'note' }, 'Aucune présence sur la période.'),
        releve ? h('p', { class: 'note' }, `Heures reprises du relevé joint à la facture ${r.facture}.`) : null),
      section(r.qualite ? '05' : '04', `${suivant.libelle} : à venir`, h('p', null, suivant.jours
        ? `${pluriel(suivant.jours, 'jour')} de présence prévu${suivant.jours > 1 ? 's' : ''}, soit ${heures(suivant.heures)}${suivant.horaires ? `, horaires habituels ${plage(suivant.horaires)}` : ''}.`
        : 'Planning en cours de préparation : il vous sera communiqué dans votre espace.')),
      h('footer', { class: 'rm-signature' },
        h('div', null, h('small', null, 'Établi par'), h('b', null, s.nom || 'La direction'), h('span', null, s.role || ''), h('span', null, 'Pour la direction de BDA Security Group')),
        h('div', null, h('small', null, 'Date'), h('b', null, frLong(r.publie)), h('span', null, 'Document disponible dans votre espace client')))),
  ];
}

/* ---------- Équipe : sur site, puis en attente d'embauche ---------- */
const ETATS_CARTE = { valide: ['ok', 'Carte pro valide'], expiree: ['alerte', 'Carte pro expirée'], a_verifier: ['neutre', 'Carte pro non renseignée'], inactif: ['neutre', 'Inactif'] };
// Le gérant passe en tête de l'équipe et ressort en doré
const gerantDabord = (l) => [...l].sort((a, b) => (b.gerant ? 1 : 0) - (a.gerant ? 1 : 0));
const mentionGerant = () => h('span', { class: 'mention-or' }, 'Gérant');
const nbDocs = (a) => (a.docs.length ? pluriel(a.docs.length, 'document') : 'Dossier en cours');
async function vueEquipe() {
  const { agents, candidats = [], suivi = [] } = await api('mod.portail.equipe');
  const personne = (a, clair) => h('div', { class: 'personne' }, h('i', { class: `initiales ${clair ? 'initiales--clair' : a.gerant ? 'initiales--or' : ''}` }, initiales(a.nom)),
    h('span', null, h('b', { class: 'fort' }, a.nom, a.gerant ? mentionGerant() : null), h('small', null, a.gerant ? 'Dirigeant de BDA Security Group · présent sur votre site' : a.qualification)));
  const ouvrir = (a) => () => { location.hash = `#/equipe/${a.id}`; };
  return [
    tete('Prestation', 'Équipe', 'Votre chargé de compte, les personnes affectées à votre site, puis les candidats que nous vous avons présentés.'),
    suivi.length ? panneau('Suivi de votre compte', h('small', null, 'Au bureau, à votre service'),
      tableau([['Nom'], ['Rôle', 'm-cache'], ['', 'd']], suivi.map((p) => ligne(() => { location.hash = '#/messages'; }, [
        td(h('div', { class: 'personne' }, h('i', { class: 'initiales initiales--nuit' }, initiales(p.nom)), h('span', null, h('b', { class: 'fort' }, p.nom), h('small', null, p.mission)))),
        td([p.role, h('small', null, p.email)], 'm-cache'),
        td(h('span', { class: 'lien' }, 'Lui écrire', ic('fleche')), 'd')])))) : null,
    panneau('Équipe sur site', h('small', null, pluriel(agents.length, 'personne')),
      agents.length ? tableau([['Nom'], ['Carte professionnelle', 'm-cache'], ['Dossier', 'm-cache'], ['', 'd']], gerantDabord(agents).map((a) => {
        const [ton, lib] = ETATS_CARTE[a.etat] || ETATS_CARTE.a_verifier;
        const tr = ligne(ouvrir(a), [td([personne(a), h('small', { class: 'm-seul' }, `${lib} · ${nbDocs(a)}`)]), td(statut(ton, lib), 'm-cache'), td(nbDocs(a), 'm-cache'), tdFleche()]);
        if (a.gerant) tr.classList.add('ligne--or');
        return tr;
      })) : vide('Aucun dossier partagé', 'Les dossiers des agents affectés à votre site apparaîtront ici.')),
    candidats.length ? panneau('En attente d’embauche', h('small', null, pluriel(candidats.length, 'candidat')),
      tableau([['Candidat'], ['Rendez-vous', 'm-cache'], ['Dossier', 'm-cache'], ['', 'd']], candidats.map((a) => ligne(ouvrir(a), [
        td([personne(a, true), h('small', { class: 'm-seul' }, [a.note, nbDocs(a)].filter(Boolean).join(' · '))]), td(a.note || '—', 'm-cache'), td(nbDocs(a), 'm-cache'), tdFleche()])))) : null,
    h('p', { class: 'note' }, 'Copies remises par BDA Security Group pour le contrôle de la prestation. Merci de ne pas les diffuser.'),
  ];
}
async function vueAgent(id) {
  const { agents, candidats = [] } = await api('mod.portail.equipe');
  const a = [...agents, ...candidats].find((x) => x.id === id);
  const retour = h('div', { class: 'barre-doc' }, h('a', { class: 'retour', href: '#/equipe' }, ic('retour'), 'Équipe'));
  if (!a) return [retour, panneau(null, null, vide('Dossier indisponible', 'Ce dossier n’est plus partagé avec vous.'))];
  const candidat = a.role === 'candidat';
  const [ton, lib] = ETATS_CARTE[a.etat] || ETATS_CARTE.a_verifier;
  const docs = a.docs.map((d) => ({ titre: d.type, genre: candidat ? 'Dossier du candidat' : 'Dossier de l’agent', sous: d.nom, date: d.ajoute, url: lien('mod.portail.agent.doc', { id: d.id }), format: d.image ? 'image' : 'pdf', categorie: 'equipe' }));
  const surSite = !candidat && (a.enPoste || a.depuis || a.heuresMois);
  return [
    retour,
    h('section', { class: 'panneau' }, h('div', { class: 'agent-tete' },
      h('i', { class: `initiales initiales--grand ${candidat ? 'initiales--clair' : a.gerant ? 'initiales--or' : ''}` }, initiales(a.nom)),
      h('div', { class: 'agent-tete__nom' }, h('span', { class: 'sur' }, candidat ? 'En attente d’embauche' : a.gerant ? 'Gérant · équipe sur site' : 'Équipe sur site'), h('h1', null, a.nom),
        h('span', null, a.gerant ? 'Dirigeant de BDA Security Group' : a.qualification)),
      a.verifier ? h('a', { class: 'btn', href: a.verifier, target: '_blank', rel: 'noopener' }, ic('bouclier'), 'Vérifier la carte en ligne') : null)),
    candidat && a.note ? h('section', { class: 'annonce' }, h('small', null, 'Rendez-vous'), h('b', null, a.note), h('p', null, 'Candidat présenté par BDA Security Group. Son embauche sera confirmée après l’entretien.')) : null,
    panneau('Documents du dossier', h('small', null, docs.length ? `${pluriel(docs.length, 'document')} · cliquez pour ouvrir` : ''),
      docs.length ? tableau([['Document'], ['Ajouté le', 'm-cache'], ['', 'd']], docs.map((i) => ligne(() => apercu(i), [td(celluleDoc(i)), td(frDate(i.date), 'chiffre m-cache'),
        td(h('div', { class: 'actions' }, boutonTelecharger(i), h('span', { class: 'fleche' }, ic('fleche'))), 'd')])))
        : vide('Dossier en cours de constitution', 'Les pièces seront ajoutées ici par la direction.')),
    panneau('Habilitations', null, tableau([['Habilitation'], ['Validité', 'm-cache'], ['Statut', 'd']], [
      ligne(null, [td(['Carte professionnelle CNAPS', a.carte ? h('small', null, a.carte) : null], 'fort'), td(a.validite ? `Jusqu’au ${a.validite}` : 'Non renseignée', 'm-cache'), td(statut(ton, cap(lib.replace('Carte pro ', ''))), 'd')]),
      ...a.formations.map((x) => ligne(null, [td(x.libelle, 'fort'), td(x.expire ? `${x.valide ? 'Jusqu’au' : 'Expirée le'} ${frDate(x.expire)}` : 'À jour', 'm-cache'), td(statut(x.valide ? 'ok' : 'attente', x.valide ? 'Valide' : 'À renouveler'), 'd')])),
    ])),
    surSite ? panneau('Sur votre site', null, corpsP(h('dl', { class: 'infos' },
      h('dt', null, 'Statut'), h('dd', null, a.enPoste ? statut('ok', `En poste depuis ${hm(a.enPoste)}`) : statut('neutre', 'Hors poste')),
      a.depuis ? [h('dt', null, 'Présent depuis'), h('dd', null, frLong(a.depuis))] : null,
      a.heuresMois ? [h('dt', null, `Heures · ${MOIS[new Date().getMonth()]}`), h('dd', null, heures(a.heuresMois))] : null))) : null,
    h('p', { class: 'note' }, 'Copies remises par BDA Security Group pour le contrôle de la prestation. Merci de ne pas les diffuser.'),
  ];
}

/* ---------- Messagerie et demandes ---------- */
async function vueMessages() {
  const { messages } = await api('mod.portail.messages');
  if (etat.nonLus) { etat.nonLus = 0; majBadges(); }
  let fil;
  const piece = (p) => {
    const url = lien('mod.portail.piece', { id: p.id });
    return p.image ? h('a', { class: 'piece piece--image', href: url, target: '_blank', rel: 'noopener' }, h('img', { src: url, alt: p.nom, onload: () => { fil.scrollTop = fil.scrollHeight; } }))
      : h('a', { class: 'piece', href: url, target: '_blank', rel: 'noopener' }, ic('trombone'), p.nom);
  };
  fil = h('div', { class: 'fil' }, messages.length
    ? messages.map((m) => h('article', { class: `msg msg--${m.auteur}` },
      h('div', { class: 'msg__tete' }, h('b', { class: m.auteur === 'admin' ? 'est-bda' : '' }, m.auteur === 'admin' ? 'BDA Security Group — Direction' : 'Vous'), h('span', null, frDateHeure(m.cree)), m.auteur === 'client' && m.lu ? h('span', null, '· Lu') : null),
      m.demande ? h('span', { class: 'msg__demande' }, `${m.demande.libelle} — ${m.demande.etat}`) : null,
      h('p', null, m.texte),
      m.pieces.length ? h('div', { class: 'pieces' }, m.pieces.map(piece)) : null))
    : vide('Aucun message pour l’instant', 'Posez une question, demandez un renfort ou un document : la direction vous répond directement ici.'));
  const zone = h('textarea', { class: 'input', rows: 4, placeholder: 'Votre message à la direction…', maxlength: 4000, 'aria-label': 'Votre message' });
  const choix = h('select', { class: 'input', id: 'ec-objet' }, h('option', { value: '' }, 'Message'), DEMANDES.map(([k, l]) => h('option', { value: k, selected: k === etat.demande }, l)));
  const fichier = h('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png,image/webp', class: 'ec-cache', id: 'ec-piece' });
  const joint = h('span', { class: 'joint' });
  fichier.onchange = () => { joint.textContent = fichier.files[0] ? fichier.files[0].name : ''; };
  const btn = h('button', { class: 'btn btn--nuit', type: 'button', onclick: async () => {
    const texte = zone.value.trim();
    if (texte.length < 2 && !fichier.files[0]) return zone.focus();
    const fd = new FormData();
    fd.append('texte', texte);
    if (choix.value) fd.append('demande', choix.value);
    if (fichier.files[0]) fd.append('piece', fichier.files[0]);
    btn.disabled = true;
    try { await apiForm('mod.portail.message.envoyer', fd); etat.demande = ''; oublierCentre(); toast('Message transmis à la direction.'); naviguer(); }
    catch (err) { toast(err.message, true); btn.disabled = false; }
  } }, ic('envoyer'), 'Envoyer');
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); btn.click(); } });
  requestAnimationFrame(() => { fil.scrollTop = fil.scrollHeight; });
  const enCours = messages.filter((m) => m.demande && m.demande.statut !== 'faite').reverse();
  return [
    tete('Relation', 'Messages', 'Votre ligne directe avec la direction de BDA Security Group. Joignez un PDF ou une photo si besoin.'),
    h('div', { class: 'messagerie' },
      panneau('Conversation', h('small', null, pluriel(messages.length, 'message')), fil,
        h('div', { class: 'redaction' },
          h('div', { class: 'redaction__haut' }, h('label', { for: 'ec-objet' }, 'Objet'), choix),
          zone,
          h('div', { class: 'redaction__bas' }, fichier, h('label', { class: 'btn', for: 'ec-piece' }, ic('trombone'), 'Joindre un fichier'), joint, h('span', { class: 'note m-cache' }, 'Ctrl + Entrée pour envoyer'), btn))),
      h('div', { class: 'colonne' },
        panneau('Demandes en cours', null, enCours.length
          ? h('ul', { class: 'suivi' }, enCours.map((m) => h('li', null, h('div', null, h('b', null, m.demande.libelle), statut(m.demande.statut === 'recue' ? 'attente' : 'info', m.demande.etat)), h('small', null, `Envoyée le ${frDateHeure(m.cree)}`))))
          : corpsP(h('p', { class: 'note' }, 'Aucune demande en cours.'))),
        panneau('Urgence sur site', null, corpsP(h('div', { class: 'contact' }, h('p', { class: 'note' }, 'Pour toute situation urgente, appelez directement la direction, 24h/24.'), h('p', { class: 'contact__tel' }, '06 11 67 86 25')))))),
  ];
}

/* ---------- Mon compte ---------- */
function vueCompte() {
  const c = etat.client;
  const actuel = saisie({ type: 'password', autocomplete: 'current-password' });
  const nouveau = saisie({ type: 'password', autocomplete: 'new-password', minlength: 8 });
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    try { await api('motdepasse', { actuel: actuel.value, nouveau: nouveau.value }); actuel.value = nouveau.value = ''; toast('Mot de passe modifié.'); } catch (err) { toast(err.message, true); }
  } }, champ('Mot de passe actuel', actuel), champ('Nouveau mot de passe (8 caractères minimum)', nouveau), h('div', null, h('button', { class: 'btn btn--nuit', type: 'submit' }, 'Modifier le mot de passe')));
  return [
    tete('Relation', 'Mon compte', c.nom, h('button', { class: 'btn', type: 'button', onclick: deconnexion }, ic('sortie'), 'Se déconnecter')),
    h('div', { class: 'grille' },
      panneau('Informations de l’institution', null, corpsP(
        h('dl', { class: 'infos' }, h('dt', null, 'Institution'), h('dd', null, c.nom), h('dt', null, 'Identifiant'), h('dd', null, c.email),
          c.adresse ? [h('dt', null, 'Adresse'), h('dd', null, c.adresse)] : null, c.tel ? [h('dt', null, 'Téléphone'), h('dd', null, c.tel)] : null),
        h('p', { class: 'note', style: 'margin-top:18px' }, 'Une information à corriger ? ', h('a', { href: '#/messages' }, 'Écrivez-nous'), ', nous la mettons à jour.'))),
      panneau('Sécurité', null, corpsP(form))),
  ];
}

demarrer();
