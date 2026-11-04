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
  telephone: '<path d="M20.5 16.6v2.6a1.7 1.7 0 0 1-1.9 1.7A17 17 0 0 1 3.1 5.4 1.7 1.7 0 0 1 4.8 3.5h2.6a1.7 1.7 0 0 1 1.7 1.5c.1.9.3 1.7.6 2.5a1.7 1.7 0 0 1-.4 1.8l-1.1 1.1a13.7 13.7 0 0 0 5.4 5.4l1.1-1.1a1.7 1.7 0 0 1 1.8-.4c.8.3 1.6.5 2.5.6a1.7 1.7 0 0 1 1.5 1.7z"/>',
};
const DEMANDES = [['renfort', 'Demande de renfort'], ['planning', 'Modification du planning'], ['probleme', 'Signaler un problème'], ['facture', 'Question sur une facture'], ['document', 'Demande de document']];
const MENU = [
  [null, [['accueil', 'Tableau de bord', 'grille'], ['documents', 'Centre documentaire', 'dossier'], ['factures', 'Factures', 'facture']]],
  ['Prestation', [['prestations', 'Prestations', 'bouclier'], ['equipe', 'Équipe sur site', 'equipe']]],
  ['Relation', [['messages', 'Messages et demandes', 'messages'], ['compte', 'Mon compte', 'compte']]],
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
const frLong = (s) => { if (!/^\d{4}-\d{2}-\d{2}/.test(s || '')) return '—'; const d = dt(s); return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
const frJour = (s) => { const d = dt(s); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; };
const frDateHeure = (s) => (s ? `${frDate(s)} à ${String(s).slice(11, 16)}` : '');
const hm = (s) => String(s || '').slice(0, 5).replace(/^0(\d)/, '$1').replace(':', 'h');
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const heures = (n) => (n >= 10 ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n)} h` : fmtHeures(+n || 0));
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
  const route = ['document', 'rapport'].includes(brut) ? brut : (LIBELLES[brut] ? brut : 'accueil');
  const actif = route === 'document' ? 'documents' : route === 'rapport' ? 'prestations' : route;
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
    h('p', { class: 'haut__fil' }, 'Portail', h('i'), h('b', null, route === 'document' ? 'Document' : route === 'rapport' ? 'Rapport d’activité' : LIBELLES[route])),
    h('button', { class: 'haut__recherche', type: 'button', onclick: palette, 'aria-label': 'Rechercher un document' }, ic('recherche'), h('span', null, 'Rechercher un document, une facture…'), h('kbd', null, 'Ctrl K')));
  const page = h('main', { class: 'page', id: 'contenu' }, squelette(6));
  racine.replaceChildren(h('div', { class: 'app' }, menu, h('div', { class: 'corps' }, haut, page)));
  majBadges();
  const vues = {
    accueil: vueAccueil, documents: () => vueCentre(param), factures: vueFactures, document: () => vueDocument(param), rapport: () => vueRapport(param),
    prestations: vuePrestations, equipe: () => (param ? vueAgent(+param) : vueEquipe()), messages: vueMessages, compte: vueCompte,
  };
  Promise.resolve(vues[route]()).then((contenu) => { page.replaceChildren(...[contenu].flat(Infinity).filter(Boolean)); page.style.animation = 'none'; void page.offsetWidth; page.style.animation = ''; })
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

/* ---------- Tableau de bord ---------- */
async function vueAccueil() {
  const t = await api('mod.portail.tableau');
  etat.nouveaux = t.nouveaux;
  etat.nonLus = t.messagesNonLus;
  majBadges();
  const p = t.prestations;
  const f = t.factures;
  const maintenant = new Date();
  const mois = MOIS[maintenant.getMonth()];
  const heure = maintenant.getHours();
  const kpi = (href, titre, valeur, sous, ton) => h(href ? 'a' : 'div', { class: `kpi ${ton ? `is-${ton}` : ''}`, href }, h('small', null, titre), h('b', null, valeur), h('span', null, sous));
  const prochain = p.prochain ? `Prochaine vacation ${frJour(p.prochain.jour)} à ${hm(p.prochain.debut)}${p.prochain.agent ? ` · ${p.prochain.agent}` : ''}` : 'Aucune vacation programmée';

  const presence = h('div', { class: 'presence' },
    p.enPoste.length ? p.enPoste.map((a) => h('div', { class: 'presence__ligne' }, h('i', { class: 'pouls' }), h('span', null, h('b', null, a.nom), h('small', null, a.qualification)),
      statut('ok', `En poste depuis ${hm(a.depuis)}`)))
      : h('div', { class: 'presence__ligne' }, h('i', { class: 'pouls pouls--off' }), h('span', null, h('b', null, 'Aucun agent en poste à cet instant'), h('small', null, prochain)), null));
  const semaine = p.semaine.slice(0, 6);
  const planning = semaine.length ? tableau([['Jour'], ['Horaires'], ['Agent', 'm-cache']], semaine.map((s) => ligne(null, [
    td(cap(frJour(s.jour)), 'fort'), td(`${hm(s.debut)} – ${hm(s.fin)}`, 'chiffre'),
    td(s.agents.length ? s.agents.join(', ') : h('span', { class: 'manquant' }, 'Affectation en cours'), 'm-cache')]))) : null;

  const echeances = t.echeances.length ? h('ul', { class: 'echeances' }, t.echeances.map((e) => {
    const d = dt(e.date);
    return h('li', null, h('a', { href: e.vue },
      h('span', { class: `date-bloc ${e.ton === 'alerte' ? 'is-alerte' : ''}` }, h('b', null, d.getDate()), h('small', null, MOIS_COURTS[d.getMonth()])),
      h('span', null, h('b', null, e.titre), h('small', null, [e.detail, typeof e.montant === 'number' ? euro.format(e.montant) : null].filter(Boolean).join(' · ')))));
  })) : corpsP(h('p', { class: 'note' }, 'Aucune échéance à venir. Tout est à jour.'));

  const conf = t.conformite;
  const tonConf = { valide: 'ok', bientot: 'attente', expire: 'alerte', manquant: '' };
  const dossier = corpsP(h('div', { class: 'jauge' },
    h('div', { class: 'jauge__texte' }, h('b', null, `${conf.disponibles} / ${conf.total}`), h('span', null, 'pièces disponibles en ligne')),
    h('div', { class: 'jauge__barre' }, conf.pieces.map((x) => h('i', { class: tonConf[x.etat] ? `is-${tonConf[x.etat]}` : '', title: x.libelle }))),
    h('ul', { class: 'liste-etats' }, conf.pieces.slice(0, 5).map((x) => h('li', null, h('span', null, x.libelle),
      x.etat === 'manquant' ? h('span', { class: 'manquant' }, 'Sur demande') : statut(tonConf[x.etat], x.etat === 'expire' ? 'Expirée' : x.etat === 'bientot' ? 'À renouveler' : 'Disponible'))))));

  return [
    h('header', { class: 'accueil-tete' },
      h('div', null, h('span', { class: 'sur' }, heure < 18 ? 'Bonjour' : 'Bonsoir'), h('h1', null, etat.client.nom),
        h('p', null, 'Votre espace réunit l’ensemble de notre relation : prestations, documents, factures et échanges avec la direction.')),
      h('div', { class: 'accueil-tete__date' }, h('b', null, `${maintenant.getDate()} ${MOIS[maintenant.getMonth()]}`), cap(JOURS[maintenant.getDay()]))),
    t.annonces.map((a) => h('section', { class: `annonce ${a.niveau === 'important' ? 'annonce--important' : ''}` }, h('small', null, a.niveau === 'important' ? 'Important' : 'Information'), h('b', null, a.titre), a.texte ? h('p', null, a.texte) : null)),
    h('div', { class: 'chiffres' },
      kpi('#/prestations', `Heures · ${mois}`, heures(p.heuresMois), p.heuresPrecedent ? `${heures(p.heuresPrecedent)} le mois dernier` : 'Depuis le 1er du mois'),
      kpi('#/prestations', 'Agents en poste', String(p.enPoste.length), p.enPoste.length ? 'À cet instant' : 'Aucun en ce moment'),
      kpi('#/factures', 'Montant à régler', euro.format(f.montantDu), f.enRetard ? `${pluriel(f.enRetard, 'facture')} en retard` : f.aRegler ? `${pluriel(f.aRegler, 'facture')} en attente` : 'Aucune facture en attente', f.enRetard ? 'alerte' : f.montantDu > 0 ? 'attente' : ''),
      kpi('#/documents', 'Centre documentaire', String(t.documents), t.nouveaux ? `${pluriel(t.nouveaux, 'nouveau document', 'nouveaux documents')}` : 'Tout est consulté')),
    h('div', { class: 'grille' },
      h('div', { class: 'colonne' },
        panneau(p.sites.length === 1 ? `Prestation · ${p.sites[0]}` : 'Prestations', h('a', { class: 'lien', href: '#/prestations' }, 'Détail', ic('fleche')),
          p.sites.length ? [presence, planning] : corpsP(h('p', { class: 'note' }, 'Aucun site n’est encore rattaché à votre espace.'))),
        panneau('Documents récents', h('a', { class: 'lien', href: '#/documents' }, 'Centre documentaire', ic('fleche')),
          t.recents.length ? tableau([['Document'], ['Date', 'm-cache'], ['Montant', 'd m-cache'], ['', 'm-cache']], t.recents.map((i) => ligne(() => ouvrirItem(i), [
            td(celluleDoc(i)), td(frDate(i.date), 'chiffre m-cache'), td(typeof i.montant === 'number' ? euro.format(i.montant) : '', 'd chiffre m-cache'), tdFleche()])))
            : vide('Aucun document pour l’instant', 'Vos factures, devis, attestations et rapports apparaîtront ici dès leur émission.'))),
      h('div', { class: 'colonne' },
        panneau('Échéances', null, echeances),
        panneau('Dossier administratif', h('a', { class: 'lien', href: '#/documents/conformite' }, 'Voir', ic('fleche')), dossier),
        panneau('Demandes en cours', h('a', { class: 'lien', href: '#/messages' }, 'Messages', ic('fleche')),
          t.demandes.length ? h('ul', { class: 'suivi' }, t.demandes.map((d) => h('li', null, h('div', null, h('b', null, d.libelle), statut(d.statut === 'recue' ? 'attente' : 'info', d.etat)), h('small', null, `Envoyée le ${frDateHeure(d.cree)}`))))
            : corpsP(h('p', { class: 'note' }, 'Aucune demande en cours.'))),
        panneau('Votre interlocuteur', null, corpsP(h('div', { class: 'contact' },
          h('div', null, h('small', { class: 'sur' }, 'Direction · 24h/24'), h('p', { class: 'contact__tel' }, '06 11 67 86 25')),
          h('div', { class: 'contact__boutons' }, h('a', { class: 'btn btn--nuit', href: '#/messages' }, ic('messages'), 'Écrire à la direction'), h('a', { class: 'btn', href: 'tel:+33611678625' }, ic('telephone'), 'Appeler'))))))),
  ];
}

/* ---------- Centre documentaire ---------- */
const TON_CONF = { valide: ['ok', 'Disponible'], bientot: ['attente', 'À renouveler bientôt'], expire: ['alerte', 'Expirée — mise à jour en cours'], manquant: ['neutre', 'Sur demande'] };
async function vueCentre(categorie) {
  const data = await chargerCentre(true);
  const cats = data.categories;
  const items = data.items;
  const f = { cat: cats[categorie] || categorie === 'nouveaux' ? categorie : 'tous', q: '', annee: '', statut: '', tri: 'recents' };
  const compte = (c) => (c === 'tous' ? items.length : c === 'nouveaux' ? items.filter((i) => i.nouveau).length : items.filter((i) => i.categorie === c).length);
  const annees = [...new Set(items.map((i) => String(i.date).slice(0, 4)).filter((a) => /^\d{4}$/.test(a)))].sort().reverse();
  const recherche = saisie({ type: 'search', placeholder: 'Rechercher par titre, numéro, montant…', 'aria-label': 'Rechercher dans les documents' });
  const selAnnee = h('select', { class: 'input', 'aria-label': 'Année' }, h('option', { value: '' }, 'Toutes les années'), annees.map((a) => h('option', { value: a }, a)));
  const selStatut = h('select', { class: 'input', 'aria-label': 'Statut' });
  const selTri = h('select', { class: 'input', 'aria-label': 'Ordre' }, h('option', { value: 'recents' }, 'Plus récents d’abord'), h('option', { value: 'anciens' }, 'Plus anciens d’abord'), h('option', { value: 'montant' }, 'Montant décroissant'), h('option', { value: 'titre' }, 'Ordre alphabétique'));
  const rail = h('nav', { class: 'rubriques', 'aria-label': 'Rubriques' });
  const zone = h('div', { class: 'colonne' });

  const rendreRail = () => remplir(rail,
    h('p', { class: 'rubriques__titre' }, 'Rubriques'),
    [['tous', 'Tous les documents'], ['nouveaux', 'Nouveaux']].map(([k, lib]) => h('button', { type: 'button', class: `rubrique ${f.cat === k ? 'is-actif' : ''}`, onclick: () => choisir(k) }, lib, h('em', null, compte(k)))),
    h('hr'),
    Object.entries(cats).map(([k, lib]) => h('button', { type: 'button', class: `rubrique ${f.cat === k ? 'is-actif' : ''}`, onclick: () => choisir(k) }, lib, h('em', null, compte(k)))));
  const choisir = (k) => { f.cat = k; f.statut = ''; history.replaceState(null, '', `#/documents/${k}`); rendreRail(); rendre(); };

  const rendre = () => {
    const statuts = f.cat === 'factures' ? [['', 'Tous les statuts'], ['envoyee', 'À régler'], ['retard', 'En retard'], ['payee', 'Réglées'], ['archive', 'Archives'], ['annulee', 'Annulées']]
      : f.cat === 'devis' ? [['', 'Tous les statuts'], ['envoye', 'À signer'], ['accepte', 'Acceptés'], ['refuse', 'Déclinés']] : null;
    selStatut.replaceChildren(...(statuts || []).map(([v, l]) => h('option', { value: v, selected: v === f.statut }, l)));
    selStatut.hidden = !statuts;
    const q = sansAccent(f.q.trim());
    let liste = items.filter((i) => (f.cat === 'tous' || (f.cat === 'nouveaux' ? i.nouveau : i.categorie === f.cat))
      && (!f.annee || String(i.date).startsWith(f.annee))
      && (!f.statut || (f.statut === 'retard' ? i.statut?.ton === 'alerte' : i.statut?.code === f.statut))
      && (!q || q.split(/\s+/).every((m) => sansAccent(`${i.titre} ${i.sous} ${i.genre} ${i.reference} ${frDate(i.date)} ${i.montant ?? ''}`).includes(m))));
    if (f.tri === 'anciens') liste = [...liste].reverse();
    else if (f.tri === 'montant') liste = [...liste].sort((a, b) => (b.montant ?? -1) - (a.montant ?? -1));
    else if (f.tri === 'titre') liste = [...liste].sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
    const avecMontant = liste.some((i) => typeof i.montant === 'number');
    const avecStatut = liste.some((i) => i.statut);
    const titre = f.cat === 'tous' ? 'Tous les documents' : f.cat === 'nouveaux' ? 'Nouveaux documents' : cats[f.cat];
    const colonnes = [['Document'], ['Date', 'm-cache'], avecMontant ? ['Montant', 'd m-cache'] : null, avecStatut ? ['Statut', 'm-cache'] : null, ['', 'd']].filter(Boolean);
    const lignes = liste.map((i) => ligne(() => ouvrirItem(i), [
      td([celluleDoc(i), h('small', { class: 'm-seul' }, [frDate(i.date), typeof i.montant === 'number' ? euro.format(i.montant) : '', i.statut?.libelle || ''].filter(Boolean).join(' · '))]),
      td(frDate(i.date), 'chiffre m-cache'),
      avecMontant ? td(typeof i.montant === 'number' ? euro.format(i.montant) : '', 'd chiffre m-cache') : null,
      avecStatut ? td(i.statut ? statut(i.statut.ton, i.statut.libelle) : '', 'm-cache') : null,
      td(h('div', { class: 'actions' }, boutonTelecharger(i), h('span', { class: 'fleche' }, ic('fleche'))), 'd')].filter(Boolean)));
    const videTexte = {
      contrats: ['Aucun contrat déposé pour l’instant', 'Votre contrat de prestation et ses avenants seront consultables ici. Vous pouvez en demander une copie dès maintenant.', 'Contrat de prestation'],
      courriers: ['Aucun courrier pour l’instant', 'Les courriers officiels de BDA Security Group vous concernant seront archivés ici.', ''],
      rapports: ['Aucun rapport pour l’instant', 'Les relevés d’heures et les rapports d’activité mensuels apparaîtront ici.', ''],
      equipe: ['Aucun document d’agent partagé', 'Les cartes professionnelles et qualifications des agents affectés à votre site apparaîtront ici lorsque la direction les partagera.', ''],
      echanges: ['Aucune pièce échangée', 'Les documents que vous nous transmettez et les pièces jointes de la messagerie sont conservés ici.', ''],
    }[f.cat];
    const conformite = f.cat === 'conformite' ? panneau('Dossier administratif', h('small', null, 'Pièces qu’un donneur d’ordre peut exiger'), h('div', { class: 'conformite' },
      tableau([['Pièce'], ['Validité', 'm-cache'], ['État'], ['', 'd']], data.conformite.map((k) => {
        const [ton, lib] = TON_CONF[k.etat];
        const doc = k.doc ? items.find((i) => i.cle === k.doc.cle) || k.doc : null;
        return ligne(doc ? () => ouvrirItem(doc) : null, [
          td(h('div', { class: 'doc' }, doc ? pictos(doc) : h('span', { class: 'pictos', 'aria-hidden': 'true' }, h('em', null, '—')), h('span', null, h('b', null, k.libelle), h('small', null, k.rappel)))),
          td(k.expire ? `Jusqu’au ${frDate(k.expire)}` : doc ? 'Sans limite' : '—', 'chiffre m-cache'),
          td(k.etat === 'manquant' ? h('span', { class: 'manquant' }, lib) : statut(ton, lib)),
          td(doc ? h('div', { class: 'actions' }, boutonTelecharger(doc), h('span', { class: 'fleche' }, ic('fleche')))
            : h('button', { class: 'btn btn--petit', type: 'button', onclick: (e) => demanderDocument(k.libelle, e.currentTarget) }, 'Demander'), 'd')]);
      })))) : null;
    remplir(zone,
      conformite,
      h('section', { class: 'panneau' },
        h('div', { class: 'outils' }, h('div', { class: 'recherche' }, ic('recherche'), recherche), selAnnee, selStatut, selTri),
        h('p', { class: 'compte-resultats' }, `${titre} · ${pluriel(liste.length, 'document')}${q || f.annee || f.statut ? ' (filtrés)' : ''}`),
        liste.length ? tableau(colonnes, lignes)
          : q || f.annee || f.statut ? vide('Aucun résultat', 'Modifiez la recherche ou les filtres.')
            : videTexte ? vide(videTexte[0], videTexte[1], videTexte[2] ? h('button', { class: 'btn', type: 'button', onclick: (e) => demanderDocument(videTexte[2], e.currentTarget) }, 'Demander une copie') : null)
              : vide('Aucun document dans cette rubrique', 'Les documents apparaîtront ici dès qu’ils seront disponibles.')));
  };
  let attente;
  recherche.addEventListener('input', () => { clearTimeout(attente); attente = setTimeout(() => { f.q = recherche.value; rendre(); recherche.focus(); }, 120); });
  selAnnee.addEventListener('change', () => { f.annee = selAnnee.value; rendre(); });
  selStatut.addEventListener('change', () => { f.statut = selStatut.value; rendre(); });
  selTri.addEventListener('change', () => { f.tri = selTri.value; rendre(); });
  rendreRail();
  rendre();
  return [
    tete('Centre documentaire', 'Tous vos documents', `${pluriel(items.length, 'document')} réunis au même endroit : factures, devis, contrats, attestations, rapports et échanges. Recherche rapide : Ctrl + K.`,
      h('button', { class: 'btn', type: 'button', onclick: transmettre }, ic('televerser'), 'Transmettre un document')),
    h('div', { class: 'centre' }, rail, zone),
  ];
}

/* ---------- Factures ---------- */
async function vueFactures() {
  const data = await chargerCentre(true);
  const toutes = data.items.filter((i) => i.categorie === 'factures').sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  const annee = String(new Date().getFullYear());
  const actives = toutes.filter((i) => i.statut.code !== 'annulee');
  const somme = (l) => l.reduce((s, i) => s + (i.montant || 0), 0);
  const aRegler = toutes.filter((i) => i.statut.code === 'envoyee');
  const retard = aRegler.filter((i) => i.statut.ton === 'alerte');
  const annees = [...new Set(toutes.map((i) => String(i.date).slice(0, 4)).filter((a) => /^\d{4}$/.test(a)))];
  const f = { annee: '', statut: '', q: '' };
  const recherche = saisie({ type: 'search', placeholder: 'Numéro, période, montant…', 'aria-label': 'Rechercher une facture' });
  const selAnnee = h('select', { class: 'input', 'aria-label': 'Année' }, h('option', { value: '' }, 'Toutes les années'), annees.map((a) => h('option', { value: a }, a)));
  const selStatut = h('select', { class: 'input', 'aria-label': 'Statut' }, [['', 'Tous les statuts'], ['envoyee', 'À régler'], ['retard', 'En retard'], ['payee', 'Réglées'], ['archive', 'Archives'], ['annulee', 'Annulées']].map(([v, l]) => h('option', { value: v }, l)));
  const zone = h('div');
  const rendre = () => {
    const q = sansAccent(f.q.trim());
    const liste = toutes.filter((i) => (!f.annee || String(i.date).startsWith(f.annee)) && (!f.statut || (f.statut === 'retard' ? i.statut.ton === 'alerte' : i.statut.code === f.statut))
      && (!q || q.split(/\s+/).every((m) => sansAccent(`${i.reference} ${i.sous} ${frDate(i.date)} ${i.montant}`).includes(m))));
    const total = somme(liste.filter((i) => i.statut.code !== 'annulee'));
    remplir(zone, liste.length ? tableau([['Facture'], ['Émise le', 'm-cache'], ['Échéance', 'm-cache'], ['Montant TTC', 'd'], ['Statut', 'm-cache'], ['', 'd m-cache']], liste.map((i) => ligne(() => ouvrirItem(i), [
      td([h('div', { class: 'doc' }, pictos(i), h('span', null, h('b', null, i.reference, i.nouveau ? h('i', { class: 'nouveau' }, 'Nouveau') : null), h('small', null, i.periode ? `Période : ${i.periode}` : (i.sous || 'Facture')))),
        h('small', { class: 'm-seul' }, `${i.statut.libelle} · émise le ${frDate(i.date)}${i.echeance ? ` · échéance ${frDate(i.echeance)}` : ''}`)]),
      td(frDate(i.date), 'chiffre m-cache'), td(i.echeance ? frDate(i.echeance) : '—', 'chiffre m-cache'),
      td(euro.format(i.montant), 'd chiffre fort'), td(statut(i.statut.ton, i.statut.libelle), 'm-cache'),
      td(h('div', { class: 'actions' }, boutonTelecharger(i), h('span', { class: 'fleche' }, ic('fleche'))), 'd m-cache')])))
      : vide(toutes.length ? 'Aucune facture ne correspond' : 'Aucune facture pour le moment', toutes.length ? 'Modifiez la recherche ou les filtres.' : 'Dès qu’une facture vous est adressée, elle apparaît ici automatiquement.'),
    liste.length ? h('div', { class: 'panneau__pied' }, h('span', { class: 'note' }, `${pluriel(liste.length, 'facture')} · classées de la plus récente à la plus ancienne${liste.some((i) => i.statut.code === 'archive') ? ' · « Archive » : copie de la facture envoyée par e-mail' : ''}`), h('b', { class: 'chiffre' }, `Total : ${euro.format(total)}`)) : null);
  };
  let attente;
  recherche.addEventListener('input', () => { clearTimeout(attente); attente = setTimeout(() => { f.q = recherche.value; rendre(); }, 120); });
  selAnnee.addEventListener('change', () => { f.annee = selAnnee.value; rendre(); });
  selStatut.addEventListener('change', () => { f.statut = selStatut.value; rendre(); });
  rendre();
  return [
    tete('Facturation', 'Factures', 'Toutes les factures adressées à votre institution, avec leur date, leur numéro, leur montant et leur statut.',
      h('a', { class: 'btn', href: '#/messages', onclick: () => { etat.demande = 'facture'; } }, ic('messages'), 'Une question sur une facture')),
    h('div', { class: 'chiffres' },
      h('div', { class: 'kpi' }, h('small', null, `Facturé en ${annee}`), h('b', null, euro.format(somme(actives.filter((i) => String(i.date).startsWith(annee))))), h('span', null, pluriel(actives.filter((i) => String(i.date).startsWith(annee)).length, 'facture'))),
      h('div', { class: 'kpi' }, h('small', null, 'Réglé'), h('b', null, euro.format(somme(toutes.filter((i) => i.statut.code === 'payee')))), h('span', null, 'Toutes années confondues')),
      h('div', { class: `kpi ${aRegler.length ? 'is-attente' : ''}` }, h('small', null, 'À régler'), h('b', null, euro.format(somme(aRegler))), h('span', null, aRegler.length ? pluriel(aRegler.length, 'facture') + ' en attente' : 'Aucune facture en attente')),
      h('div', { class: `kpi ${retard.length ? 'is-alerte' : ''}` }, h('small', null, 'En retard'), h('b', null, String(retard.length)), h('span', null, retard.length ? 'Échéance dépassée' : 'Aucun retard'))),
    h('section', { class: 'panneau' }, h('div', { class: 'outils' }, h('div', { class: 'recherche' }, ic('recherche'), recherche), selAnnee, selStatut), zone),
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

/* ---------- Rapport d'activité (d'après le planning) ---------- */
async function vueRapport(mois) {
  const r = await api('mod.portail.rapport', undefined, { mois });
  const t = r.total;
  return [
    h('div', { class: 'barre-doc' }, h('a', { class: 'retour', href: '#/prestations' }, ic('retour'), 'Prestations'),
      h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, ic('imprimer'), 'Imprimer'),
      h('a', { class: 'btn', href: '#/documents/rapports' }, ic('dossier'), 'Rapports et relevés')),
    h('div', { class: 'rapport' },
      tete('Rapport d’activité', r.libelle, `${r.sites.join(', ') || 'Vos sites'} · du ${frLong(r.du)} au ${frLong(r.au)}${r.encours ? ' (mois en cours)' : ''}`),
      h('div', { class: 'chiffres' },
        h('div', { class: 'kpi' }, h('small', null, 'Vacations'), h('b', null, String(t.vacations)), h('span', null, 'Créneaux assurés')),
        h('div', { class: 'kpi' }, h('small', null, 'Heures'), h('b', null, heures(t.heures)), h('span', null, 'Temps de présence prévu')),
        h('div', { class: 'kpi' }, h('small', null, 'Jours couverts'), h('b', null, String(t.jours)), h('span', null, 'Jours avec au moins une vacation')),
        h('div', { class: 'kpi' }, h('small', null, 'Agents'), h('b', null, String(t.agents)), h('span', null, 'Intervenus sur le site'))),
      panneau('Détail des vacations', h('small', null, pluriel(t.vacations, 'vacation')),
        r.lignes.length ? tableau([['Date'], ['Horaires'], ['Agent'], ['Durée', 'd']], r.lignes.map((l) => ligne(null, [
          td(cap(frJour(l.jour)), 'fort'), td(`${hm(l.debut)} – ${hm(l.fin)}`, 'chiffre'), td([l.agent, h('small', null, l.qualification)]), td(heures(l.heures), 'd chiffre')])))
          : vide('Aucune vacation ce mois-ci', '')),
      r.agents.length ? panneau('Par agent', null, tableau([['Agent'], ['Vacations', 'd'], ['Heures', 'd']], r.agents.map((a) => ligne(null, [
        td(h('div', { class: 'personne' }, h('i', { class: 'initiales' }, initiales(a.agent)), h('span', null, h('b', { class: 'fort' }, a.agent), h('small', null, a.qualification)))),
        td(String(a.vacations), 'd chiffre'), td(heures(a.heures), 'd chiffre')])))) : null,
      h('p', { class: 'rapport__note' }, 'Rapport établi à partir du planning des agents de BDA Security Group. En cas d’écart, la facture du mois fait foi.')),
  ];
}

/* ---------- Prestations ---------- */
async function vuePrestations() {
  const [t, data] = await Promise.all([api('mod.portail.tableau'), chargerCentre()]);
  const p = t.prestations;
  const mois = MOIS[new Date().getMonth()];
  const rapports = data.items.filter((i) => i.format === 'rapport' || (i.categorie === 'rapports' && i.url));
  return [
    tete('Prestation', p.sites.length === 1 ? p.sites[0] : 'Vos prestations', 'La présence de nos agents en temps réel, le programme des prochains jours et l’historique de l’activité.'),
    h('div', { class: 'chiffres chiffres--3' },
      h('div', { class: 'kpi' }, h('small', null, `Heures · ${mois}`), h('b', null, heures(p.heuresMois)), h('span', null, 'Depuis le 1er du mois')),
      h('div', { class: 'kpi' }, h('small', null, `Heures · ${MOIS[(new Date().getMonth() + 11) % 12]}`), h('b', null, heures(p.heuresPrecedent)), h('span', null, 'Mois précédent')),
      h('div', { class: 'kpi' }, h('small', null, 'Agents en poste'), h('b', null, String(p.enPoste.length)), h('span', null, 'À cet instant'))),
    h('div', { class: 'grille' },
      h('div', { class: 'colonne' },
        panneau('Les 7 prochains jours', null, p.semaine.length ? tableau([['Jour'], ['Horaires'], ['Agent']], p.semaine.map((s) => ligne(null, [
          td(cap(frJour(s.jour)), 'fort'), td(`${hm(s.debut)} – ${hm(s.fin)}`, 'chiffre'), td(s.agents.length ? s.agents.join(', ') : h('span', { class: 'manquant' }, 'Affectation en cours'))])))
          : vide('Aucune vacation programmée', 'Le programme des prochains jours apparaîtra ici.')),
        panneau('Rapports et relevés', h('a', { class: 'lien', href: '#/documents/rapports' }, 'Tout voir', ic('fleche')),
          rapports.length ? tableau([['Document'], ['Date', 'm-cache'], ['', 'd']], rapports.slice(0, 12).map((i) => ligne(() => ouvrirItem(i), [td(celluleDoc(i)), td(frDate(i.date), 'chiffre m-cache'), td(h('div', { class: 'actions' }, boutonTelecharger(i), h('span', { class: 'fleche' }, ic('fleche'))), 'd')])))
            : vide('Aucun rapport pour l’instant', 'Les rapports d’activité mensuels apparaîtront ici dès les premières vacations.'))),
      h('div', { class: 'colonne' },
        panneau('En ce moment', null, h('div', { class: 'presence' }, p.enPoste.length ? p.enPoste.map((a) => h('div', { class: 'presence__ligne' }, h('i', { class: 'pouls' }), h('span', null, h('b', null, a.nom), h('small', null, a.qualification)), h('small', { class: 'chiffre' }, `depuis ${hm(a.depuis)}`)))
          : h('div', { class: 'presence__ligne' }, h('i', { class: 'pouls pouls--off' }), h('span', null, h('b', null, 'Aucun agent en poste'), h('small', null, p.prochain ? `Prochaine vacation ${frJour(p.prochain.jour)} à ${hm(p.prochain.debut)}` : 'Aucune vacation programmée')), null))),
        panneau('Équipe sur site', h('a', { class: 'lien', href: '#/equipe' }, 'Dossiers', ic('fleche')), corpsP(h('p', { class: 'note' }, 'Consultez les cartes professionnelles et qualifications des agents affectés à votre site.'))))),
  ];
}

/* ---------- Équipe sur site ---------- */
const ETATS_CARTE = { valide: ['ok', 'Valide'], expiree: ['alerte', 'Expirée'], a_verifier: ['attente', 'À vérifier'], inactif: ['neutre', 'Inactif'] };
async function vueEquipe() {
  const { agents } = await api('mod.portail.equipe');
  return [
    tete('Prestation', 'Équipe sur site', 'Les agents affectés à votre site et les documents que la direction partage avec vous.'),
    panneau('Agents', h('small', null, pluriel(agents.length, 'agent')),
      agents.length ? tableau([['Agent'], ['Qualification', 'm-cache'], ['Carte professionnelle'], ['Présence', 'm-cache'], ['', 'm-cache']], agents.map((a) => {
        const [ton, lib] = ETATS_CARTE[a.etat] || ETATS_CARTE.a_verifier;
        return ligne(() => { location.hash = `#/equipe/${a.id}`; }, [
          td(h('div', { class: 'personne' }, h('i', { class: 'initiales' }, initiales(a.nom)), h('span', null, h('b', { class: 'fort' }, a.nom), h('small', { class: 'm-seul' }, a.qualification)))),
          td(a.qualification, 'm-cache'), td(statut(ton, lib)), td(a.enPoste ? statut('ok', `En poste depuis ${hm(a.enPoste)}`) : statut('neutre', 'Hors poste'), 'm-cache'), tdFleche()]);
      })) : vide('Aucun dossier partagé', 'Les dossiers de vos agents apparaîtront ici lorsque la direction les partagera avec vous.')),
  ];
}
async function vueAgent(id) {
  const { agents } = await api('mod.portail.equipe');
  const a = agents.find((x) => x.id === id);
  const retour = h('div', { class: 'barre-doc' }, h('a', { class: 'retour', href: '#/equipe' }, ic('retour'), 'Équipe sur site'));
  if (!a) return [retour, panneau(null, null, vide('Dossier indisponible', 'Ce dossier n’est plus partagé avec vous.'))];
  const [ton, lib] = ETATS_CARTE[a.etat] || ETATS_CARTE.a_verifier;
  return [
    retour,
    h('section', { class: 'panneau' }, h('div', { class: 'agent-tete' },
      h('i', { class: 'initiales initiales--grand' }, initiales(a.nom)),
      h('div', { class: 'agent-tete__nom' }, h('span', { class: 'sur' }, 'Dossier de l’agent'), h('h1', null, a.nom), h('span', null, a.qualification)),
      a.verifier ? h('a', { class: 'btn', href: a.verifier, target: '_blank', rel: 'noopener' }, ic('bouclier'), 'Vérifier la carte en ligne') : null)),
    h('div', { class: 'grille' },
      h('div', { class: 'colonne' },
        panneau('Habilitations', null, tableau([['Habilitation'], ['Validité', 'm-cache'], ['Statut', 'd']], [
          ligne(null, [td(['Carte professionnelle CNAPS', a.carte ? h('small', null, a.carte) : null], 'fort'), td(a.validite ? `Jusqu’au ${a.validite}` : 'Non renseignée', 'm-cache'), td(statut(ton, lib), 'd')]),
          ...a.formations.map((x) => ligne(null, [td(x.libelle, 'fort'), td(x.expire ? `${x.valide ? 'Jusqu’au' : 'Expirée le'} ${frDate(x.expire)}` : 'À jour', 'm-cache'), td(statut(x.valide ? 'ok' : 'attente', x.valide ? 'Valide' : 'À renouveler'), 'd')])),
        ])),
        panneau('Documents partagés', h('small', null, pluriel(a.docs.length, 'document')),
          a.docs.length ? tableau([['Document'], ['Partagé le', 'm-cache'], ['', 'd']], a.docs.map((d) => {
            const i = { titre: d.type, genre: 'Dossier de l’agent', sous: d.nom, date: d.ajoute, url: lien('mod.portail.agent.doc', { id: d.id }), format: d.image ? 'image' : 'pdf', categorie: 'equipe' };
            return ligne(() => apercu(i), [td(celluleDoc(i)), td(frDate(d.ajoute), 'chiffre m-cache'), td(h('div', { class: 'actions' }, boutonTelecharger(i), h('span', { class: 'fleche' }, ic('fleche'))), 'd')]);
          })) : vide('Aucun document partagé', ''))),
      h('div', { class: 'colonne' },
        panneau('Sur votre site', null, corpsP(h('dl', { class: 'infos' },
          h('dt', null, 'Statut'), h('dd', null, a.enPoste ? statut('ok', `En poste depuis ${hm(a.enPoste)}`) : statut('neutre', 'Hors poste')),
          a.depuis ? [h('dt', null, 'Présent depuis'), h('dd', null, frLong(a.depuis))] : null,
          h('dt', null, `Heures · ${MOIS[new Date().getMonth()]}`), h('dd', null, heures(a.heuresMois))))),
        h('p', { class: 'note' }, 'Copies remises par BDA Security Group pour le contrôle de la prestation. Merci de ne pas les diffuser.'))),
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
    tete('Relation', 'Messages et demandes', 'Votre ligne directe avec la direction de BDA Security Group. Joignez un PDF ou une photo si besoin.'),
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
