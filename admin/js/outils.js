/* =========================================================
   ESPACE ADMIN BDA — outils communs
   (appels au serveur, création d'éléments, formats français,
   notifications, fenêtres de dialogue)
   ========================================================= */

/* ---------- Appels au serveur ---------- */
let jeton = '';
export const definirJeton = (t) => { if (t) jeton = t; };
export class ErreurApi extends Error {
  constructor(message, statut) { super(message); this.statut = statut; }
}
let surDeconnexion = () => {};
export const quandDeconnecte = (fn) => { surDeconnexion = fn; };

export async function api(action, donnees, params = {}) {
  const qs = new URLSearchParams({ a: action, ...params }).toString();
  const options = { credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (donnees !== undefined) {
    options.method = 'POST';
    options.headers['Content-Type'] = 'application/json';
    options.headers['X-CSRF'] = jeton;
    options.body = JSON.stringify(donnees);
  }
  let res;
  try { res = await fetch(`api.php?${qs}`, options); }
  catch (e) { throw new ErreurApi('Connexion impossible. Vérifiez votre accès à internet.', 0); }
  const json = await res.json().catch(() => ({}));
  if (json.csrf) definirJeton(json.csrf);
  if (res.status === 401 && !['connexion', 'session'].includes(action)) { surDeconnexion(); }
  if (!res.ok || json.ok === false) throw new ErreurApi(json.erreur || `Erreur ${res.status}`, res.status);
  return json;
}

/* ---------- Création d'éléments (sans risque d'injection) ---------- */
export function h(tag, attrs, ...enfants) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  ajouter(el, enfants);
  return el;
}
function ajouter(el, enfants) {
  for (const c of enfants) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) ajouter(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Icônes ---------- */
const TRACES = {
  personne: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  visite: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h7M6 13.5h4"/><path d="M16.5 9.5l1.5 1 1.5-1v3.5h-3z"/>',
  accueil: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  badge: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><circle cx="8" cy="11" r="2.2"/><path d="M4.8 16.2c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14 10h5M14 13.5h3.5"/>',
  flyer: '<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v6h6"/><rect x="7.5" y="12" width="9" height="6" rx="1"/>',
  photo: '<rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 5l1.5-2h5L16 5"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>',
  bouclier: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  voiture: '<path d="M5 17h14M5 17a2 2 0 1 1-4 0v-4l2.5-5.5A2 2 0 0 1 5.3 6h13.4a2 2 0 0 1 1.8 1.5L23 13v4a2 2 0 1 1-4 0"/><path d="M3.5 12h17"/><circle cx="7" cy="15" r=".6"/><circle cx="17" cy="15" r=".6"/>',
  etoile: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  couronne: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/><path d="M5 22h14"/>',
  camera: '<path d="M3 7h13v10H3zM16 10l5-3v10l-5-3"/>',
  cle: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M15 8l2 2"/>',
  oeilv: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  vide: '',
  tableau: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  demande: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  devis: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  facture: '<path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z"/><path d="M8 9h8M8 13h8M8 17h4"/>',
  planning: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h2M14 14h2M8 18h2"/>',
  clients: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  agents: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  avis: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  candidature: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  reglages: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  retour: '<path d="m15 18-6-6 6-6"/>',
  suivant: '<path d="m9 18 6-6-6-6"/>',
  imprimer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  poubelle: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  copier: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  telephone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  oeil: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  sortie: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  site: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  croix: '<path d="M18 6 6 18M6 6l12 12"/>',
  coche: '<path d="M20 6 9 17l-5-5"/>',
  alerte: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  euro: '<path d="M18 7a7 7 0 1 0 0 10M4 10h10M4 14h10"/>',
  horloge: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  telecharger: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  envoyer: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  cadenas: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  recherche: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  crayon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  graphique: '<path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-6"/>',
};
export function icone(nom, cls = '') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `ic ${cls}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = TRACES[nom] || '';
  return svg;
}
// Écusson « BDA » (même dessin que sur les cartes agents et les flyers)
let nEcusson = 0;
export function ecusson(cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const id = `ec${++nEcusson}`;
  s.setAttribute('viewBox', '0 0 100 110');
  s.setAttribute('class', `ecusson ${cls}`.trim());
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<defs><linearGradient id="${id}o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#efd9a0"/><stop offset=".5" stop-color="#c9a55c"/><stop offset="1" stop-color="#a2803d"/></linearGradient>`
    + `<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a251b"/><stop offset="1" stop-color="#0f0e0c"/></linearGradient></defs>`
    + `<path d="M50 5C62 11 76 13 91 13v39c0 28-19 46-41 54C28 98 9 80 9 52V13c15 0 29-2 41-8Z" fill="url(#${id}f)" stroke="url(#${id}o)" stroke-width="5" stroke-linejoin="round"/>`
    + `<text x="50" y="65" text-anchor="middle" font-family="Playfair Display, Georgia, serif" font-size="25" font-weight="500" fill="#e8cf95">BDA</text>`;
  return s;
}

/* ---------- Formats français ---------- */
export const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const euroRond = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
export const arrondi = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const pad = (n) => String(n).padStart(2, '0');
export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fr = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
export const isoVersFr = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
export function frVersDate(s) {
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}
export function dateLisible(s, avecHeure) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  const o = { day: 'numeric', month: 'short', year: 'numeric' };
  if (avecHeure) Object.assign(o, { hour: '2-digit', minute: '2-digit' });
  return new Intl.DateTimeFormat('fr-FR', o).format(d);
}
export function ilYa(s) {
  const d = new Date(String(s).replace(' ', 'T'));
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  const j = Math.round(hrs / 24);
  return j === 1 ? 'hier' : j < 30 ? `il y a ${j} jours` : dateLisible(s);
}
// 116.75 -> « 116 h 45 »
export function fmtHeures(h, compact) {
  let H = Math.floor(h + 1e-9), M = Math.round((h - H) * 60);
  if (M === 60) { H += 1; M = 0; }
  if (compact) return M ? `${H}h${pad(M)}` : `${H}h`;
  return M ? `${H} h ${pad(M)}` : `${H} h`;
}
export function lireHeures(txt) {
  const t = String(txt).toLowerCase().replace(/\s+/g, '');
  if (!t) return 0;
  let m = t.match(/^(\d+)(?:h|:)(\d{1,2})$/);
  if (m && +m[2] < 60) return +m[1] + +m[2] / 60;
  m = t.match(/^(\d+(?:[.,]\d+)?)h?$/);
  return m ? parseFloat(m[1].replace(',', '.')) : NaN;
}
export function lireNombre(txt) {
  const t = String(txt).replace(/[\s  €%]/g, '').replace(',', '.');
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
export function numeroSuivant(n) {
  const m = String(n).match(/^(.*?)(\d+)(\D*)$/);
  return m ? m[1] + String(+m[2] + 1).padStart(m[2].length, '0') + m[3] : `${n}-2`;
}

/* ---------- Notifications ---------- */
export function toast(message, type = 'ok') {
  let zone = $('.toasts');
  if (!zone) { zone = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(zone); }
  const t = h('div', { class: `toast toast--${type}` }, icone(type === 'erreur' ? 'alerte' : 'coche'), h('span', null, message));
  zone.append(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 400); }, type === 'erreur' ? 5000 : 2600);
}
export const erreur = (e) => toast(e?.message || String(e), 'erreur');

/* ---------- Fenêtres de dialogue ---------- */
export function modale({ titre, contenu, actions = [], large }) {
  return new Promise((resolve) => {
    const fermer = (v) => { fond.classList.remove('is-in'); setTimeout(() => fond.remove(), 250); document.removeEventListener('keydown', clavier); resolve(v); };
    const clavier = (e) => { if (e.key === 'Escape') fermer(null); };
    // Une action qui renvoie false garde la fenêtre ouverte (ex. champ manquant)
    const executer = async (a) => {
      if (!a.action) return fermer(a.valeur);
      const v = await a.action();
      if (v !== false) fermer(v === undefined ? (a.valeur ?? true) : v);
    };
    const boutons = actions.map((a) => h('button', {
      type: a.submit ? 'submit' : 'button', class: `btn ${a.classe || ''}`,
      onclick: a.submit ? null : () => executer(a),
    }, a.libelle));
    const form = h('form', { class: `modale ${large ? 'modale--large' : ''}`, onsubmit: (e) => {
      e.preventDefault();
      const a = actions.find((x) => x.submit);
      if (a) executer(a);
    } },
    h('header', null, h('h2', null, titre), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Fermer', onclick: () => fermer(null) }, icone('croix'))),
    h('div', { class: 'modale__corps' }, contenu),
    boutons.length ? h('footer', null, boutons) : null);
    const fond = h('div', { class: 'modale-fond', onmousedown: (e) => { if (e.target === fond) fermer(null); } }, form);
    document.body.append(fond);
    document.addEventListener('keydown', clavier);
    requestAnimationFrame(() => { fond.classList.add('is-in'); form.querySelector('input, textarea, select')?.focus(); });
  });
}
export function confirmer(message, { titre = 'Confirmation', ok = 'Confirmer', danger } = {}) {
  return modale({
    titre,
    contenu: h('p', { class: 'modale__texte' }, message),
    actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: ok, classe: danger ? 'btn--danger' : 'btn--gold', valeur: true, submit: true }],
  }).then((v) => v === true);
}

/* ---------- Champs de formulaire ---------- */
export function champ(label, input, aide) {
  return h('label', { class: 'champ' }, h('span', { class: 'champ__label' }, label), input, aide ? h('small', { class: 'champ__aide' }, aide) : null);
}
export const saisie = (attrs = {}) => h('input', { class: 'input', type: 'text', ...attrs });
export const zoneTexte = (attrs = {}) => h('textarea', { class: 'input', rows: 3, ...attrs });

export function statutPastille(statut, libelle) {
  const L = {
    brouillon: 'Brouillon', envoye: 'Envoyé', envoyee: 'Envoyée', accepte: 'Accepté', refuse: 'Refusé', payee: 'Payée', annulee: 'Annulée',
    nouvelle: 'Nouvelle', traitee: 'Traitée', archivee: 'Archivée', en_cours: 'En cours', retenue: 'Retenue', refusee: 'Refusée',
    attente: 'En attente', publie: 'Publié', retard: 'En retard',
  };
  return h('span', { class: `pastille pastille--${statut}` }, libelle || L[statut] || statut);
}

export function attendre(fn, delai = 700) {
  let t;
  const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delai); };
  f.maintenant = (...a) => { clearTimeout(t); return fn(...a); };
  f.annuler = () => clearTimeout(t);
  return f;
}
