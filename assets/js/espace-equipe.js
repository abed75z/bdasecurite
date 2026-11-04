/* =========================================================
   ESPACE ÉQUIPE — bdasecurite.com/espace-equipe
   Agents de sécurité, SSIAP et chauffeurs VTC.
   Création de compte sur le site -> validation par la direction dans l'admin.
   Accueil (service du jour, pointage), planning, fiches de paie, documents,
   congés et absences, main courante, profil et disponibilités, courses VTC.
   Données : /api/equipe.php (session séparée, chaque agent ne voit que ses données).
   ========================================================= */
const racine = document.getElementById('eq');
const API = '/api/equipe.php';
// Modules (assets/js/equipe/<nom>.js) : pages et cartes d'accueil en plus, versionnés comme ce fichier (?v= du HTML)
const VERSION = new URL(import.meta.url).searchParams.get('v') || '1';
const MODULES = await import(`./equipe-modules.js?v=${VERSION}`).catch((e) => { console.error(e); return {}; });
const ICONES = {
  accueil: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  planning: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h2M14 14h2M8 18h2"/>',
  paie: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  documents: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  absences: '<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M9 16l2 2 4-4"/>',
  mc: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5M8 7h8M8 11h6"/>',
  profil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  voiture: '<path d="M5 17h14M5 17a2 2 0 1 1-4 0v-4l2.2-5.5A2 2 0 0 1 5.1 6h13.8a2 2 0 0 1 1.9 1.5L23 13v4a2 2 0 1 1-4 0"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  sortie: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  oeil: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  oeilBarre: '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  coche: '<path d="M20 6 9 17l-5-5"/>',
  croix: '<path d="M18 6 6 18M6 6l12 12"/>',
  fleche: '<path d="m9 18 6-6-6-6"/>',
  retour: '<path d="m15 18-6-6 6-6"/>',
  telecharger: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  envoyer: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  bouclier: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  feu: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.5 1.3 1.6 2.3 2.5 2.8z"/>',
  alerte: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  cadenas: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  porte: '<path d="M3 21h18M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><circle cx="14.5" cy="12" r="1"/>',
  coeur: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/><path d="M3.5 12h4l2-3 3 6 2-3h6"/>',
  outil: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  ronde: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bulle: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  photo: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  jouer: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/>',
  stop: '<circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lune: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  telephone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  carte: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M13 10h5M13 14h4"/>',
  avion: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  liste: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  grille: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  poubelle: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  appareil: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  auj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  msg: '<path d="M4.5 5.5h15v10h-10l-5 4z"/>',
  moi: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.3-3.6 3.9-5.5 7-5.5s5.7 1.9 7 5.5"/>',
  chrono: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 1.5M9.5 2.5h5M12 2.5V6"/>',
  versHaut: '<path d="M7 17 17 7M9 7h8v8"/>',
};
const METIERS = {
  securite: ['Agent de sécurité', 'Surveillance, filtrage, rondes', 'bouclier'],
  ssiap: ['Agent SSIAP', 'Sécurité incendie, ERP, IGH', 'feu'],
  chauffeur: ['Chauffeur VTC', 'Transferts, mise à disposition', 'voiture'],
};
const CODES = { R: 'Repos', CP: 'Congés payés', M: 'Maladie', AT: 'Accident du travail', F: 'Formation', ABS: 'Absence', MAP: 'Mise à pied conservatoire' };
const ABSENCES = {
  conges: ['Congés payés', 'Vacances, jours posés', 'soleil'],
  maladie: ['Arrêt maladie', 'Avec arrêt de travail', 'coeur'],
  absence: ['Absence', 'Rendez-vous, imprévu…', 'horloge'],
  indispo: ['Indisponibilité', 'Je ne peux pas travailler', 'croix'],
};
const INCIDENTS = {
  intrusion: ['Intrusion', 'porte'], vol: ['Vol / dégradation', 'cadenas'], agression: ['Agression', 'alerte'], incendie: ['Incendie / alarme', 'feu'],
  secours: ['Secours à personne', 'coeur'], technique: ['Problème technique', 'outil'], ronde: ['Ronde / contrôle', 'ronde'], autre: ['Autre', 'bulle'],
};
const TYPES_DOCS = {
  contrat: 'Contrat de travail', carte_pro: 'Carte professionnelle CNAPS', diplome_aps: 'Diplôme / CQP APS', certif: 'Certificat / SSIAP', attestation: 'Attestation',
  carte_vtc: 'Carte VTC', permis: 'Permis de conduire', assurance: 'Assurance', identite: 'Pièce d’identité', rib: 'RIB', secu: 'Carte Vitale', justificatif: 'Justificatif', autre: 'Autre document',
};
const DOCS_ENVOI = ['carte_pro', 'diplome_aps', 'certif', 'attestation', 'carte_vtc', 'permis', 'identite', 'rib', 'secu', 'justificatif', 'autre'];
const COMPETENCES = ['SSIAP 1', 'SSIAP 2', 'SSIAP 3', 'SST', 'H0B0', 'CQP APS', 'Palpation', 'Cynophile', 'Événementiel', 'Protection rapprochée', 'Anglais', 'Espagnol', 'Arabe', 'Permis B'];
const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

let csrf = '';
let moi = { prenom: '', metier: '' };
let compteurs = {};
let minuteur = null;
let decalage = 0; // écart d'horloge avec le serveur

/* ---------- Outils ---------- */
function h(tag, attrs, ...enfants) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const ajouter = (c) => { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) c.forEach(ajouter); else el.append(c instanceof Node ? c : document.createTextNode(String(c))); };
  enfants.forEach(ajouter);
  return el;
}
function ic(nom) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'eq-ic');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONES[nom] || '';
  return s;
}
const anim = (el) => { [...el.children].forEach((c, i) => c.style.setProperty('--i', i)); el.classList.add('eq-anim'); return el; };
async function appel(a, opts, params = {}) {
  let r;
  try { r = await fetch(`${API}?${new URLSearchParams({ a, ...params })}`, { credentials: 'same-origin', ...opts }); } catch (e) { throw new Error('Connexion impossible. Vérifiez votre accès à internet.'); }
  const j = await r.json().catch(() => ({}));
  if (j.csrf) csrf = j.csrf;
  if (r.status === 401 && !['connexion', 'session'].includes(a)) { ecranConnexion('Votre session a expiré : reconnectez-vous.'); throw new Error('Connexion requise.'); }
  if (r.status === 419) { await api('session').catch(() => {}); throw new Error('La page a expiré : réessayez.'); }
  if (!r.ok || j.ok === false) throw new Error(j.erreur || `Erreur ${r.status}`);
  return j;
}
function api(a, corps, params) {
  const opts = { headers: { Accept: 'application/json' } };
  if (corps !== undefined) Object.assign(opts, { method: 'POST', headers: { ...opts.headers, 'Content-Type': 'application/json', 'X-CSRF': csrf }, body: JSON.stringify(corps) });
  return appel(a, opts, params);
}
const apiForm = (a, fd) => appel(a, { method: 'POST', headers: { Accept: 'application/json', 'X-CSRF': csrf }, body: fd });
function toast(msg, erreur) {
  const t = h('div', { class: `eq-toast ${erreur ? 'is-erreur' : ''}`, role: 'status' }, ic(erreur ? 'alerte' : 'coche'), msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 350); }, 3800);
}
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const versDate = (s) => new Date(`${String(s).slice(0, 10)}T${String(s).slice(11, 19) || '12:00:00'}`);
const frDate = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
const frHeure = (s) => String(s || '').slice(11, 16).replace(':', 'h');
const dateLongue = (s) => { const d = versDate(s); return `${JOURS_LONGS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; };
const fmtMin = (m) => { m = Math.max(0, Math.round(m)); const hh = Math.floor(m / 60), mm = m % 60; return mm ? `${hh} h ${pad(mm)}` : `${hh} h`; };
const taille = (o) => (o > 1048576 ? `${(o / 1048576).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);
const initiales = (p, n) => `${(p || '?')[0] || ''}${(n || '')[0] || ''}`.toUpperCase();
const champ = (label, input, aide) => h('label', { class: 'eq-champ' }, h('span', null, label), input, aide ? h('small', null, aide) : null);
const saisie = (attrs) => h('input', { class: 'eq-input', ...attrs });
const memoire = { lire: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, ecrire: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* navigation privée */ } } };
const simplifier = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// Créneau du planning -> minutes travaillées (« 12h-19h », « 7h30-19h », « 19h-7h », « 8 », codes R/CP/M…)
function lireCreneau(txt) {
  const t = String(txt || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[–—à]/g, '-');
  if (!t) return null;
  // plusieurs postes le même jour (planning des sites)
  if (t.includes('+')) {
    const parts = t.split('+').filter(Boolean).map(lireCreneau);
    if (parts.some((p) => !p || p.code)) return null;
    return { min: parts.reduce((s, p) => s + (p.min || 0), 0), nuit: parts.some((p) => p.nuit), plages: parts };
  }
  if (/^[a-zéè]+$/.test(t)) return { code: t.toUpperCase() };
  const m = t.match(/^(\d{1,2})(?:[h:](\d{2})?)?-(\d{1,2})(?:[h:](\d{2})?)?h?$/);
  if (m) {
    const debut = +m[1] * 60 + +(m[2] || 0);
    let fin = +m[3] * 60 + +(m[4] || 0);
    if (fin <= debut) fin += 1440;
    return { debut, fin, min: fin - debut, nuit: fin > 1440 || debut >= 1260 };
  }
  const n = t.match(/^(\d+)(?:[h:,.](\d{1,2}))?h?$/);
  if (n && +n[1] <= 24) return { min: +n[1] * 60 + (n[2] ? (n[2].length === 1 && /[,.]/.test(t) ? +n[2] * 6 : +n[2]) : 0) };
  return null;
}
const libelleCreneau = (txt) => { const c = lireCreneau(txt); return !c ? '' : c.code ? (CODES[c.code] || c.code) : String(txt).replace(/\s+/g, ''); };
// Jours fériés français
function feries(annee) {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const hh = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451);
  const paques = new Date(annee, Math.floor((hh + l - 7 * m + 114) / 31) - 1, ((hh + l - 7 * m + 114) % 31) + 1);
  const dec = (n) => iso(new Date(paques.getFullYear(), paques.getMonth(), paques.getDate() + n));
  return new Set([`${annee}-01-01`, dec(1), `${annee}-05-01`, `${annee}-05-08`, dec(39), dec(50), `${annee}-07-14`, `${annee}-08-15`, `${annee}-11-01`, `${annee}-11-11`, `${annee}-12-25`]);
}
// Photo trop lourde -> réduite dans le téléphone avant l'envoi (plus rapide en 4G)
async function compresser(fichier) {
  if (!/^image\/(jpeg|png|webp)$/.test(fichier.type) || !window.createImageBitmap) return fichier;
  try {
    const img = await createImageBitmap(fichier);
    const r = Math.min(1, 1800 / Math.max(img.width, img.height));
    if (r === 1 && fichier.size < 1.5e6) return fichier;
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.84));
    return blob ? new File([blob], fichier.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : fichier;
  } catch (e) { return fichier; }
}
function position() {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok({});
    navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, prec: p.coords.accuracy }), () => ok({}), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  });
}
function champMdp(attrs) {
  const input = saisie({ type: 'password', ...attrs });
  const voir = h('button', { type: 'button', 'aria-label': 'Afficher le mot de passe', onclick: () => {
    const cache = input.type === 'password';
    input.type = cache ? 'text' : 'password';
    voir.replaceChildren(ic(cache ? 'oeilBarre' : 'oeil'));
  } }, ic('oeil'));
  return { input, bloc: h('div', { class: 'eq-mdp' }, input, voir) };
}
// Règles du mot de passe, cochées en direct
function reglesMdp(mdp, confirmation) {
  const regles = [['8 caractères minimum', (v) => v.length >= 8], ['Une lettre', (v) => /\p{L}/u.test(v)], ['Un chiffre', (v) => /\d/.test(v)]];
  if (confirmation) regles.push(['Identiques', (v) => v.length > 0 && v === confirmation.value]);
  const items = regles.map(([t]) => h('li', null, t));
  const maj = () => regles.forEach(([, f], i) => items[i].classList.toggle('is-ok', f(mdp.value)));
  mdp.addEventListener('input', maj);
  confirmation?.addEventListener('input', maj);
  return { liste: h('ul', { class: 'eq-regles' }, items), valide: () => regles.every(([, f]) => f(mdp.value)) };
}
function choix(nom, options, valeur, classe = '') {
  return h('div', { class: `eq-choix ${classe}`, role: 'radiogroup' }, Object.entries(options).map(([k, [titre, sous, icone]]) =>
    h('label', null, h('input', { type: 'radio', name: nom, value: k, checked: k === valeur }), h('span', { class: 'eq-tuile' }, icone ? ic(icone) : null, h('span', null, titre, sous ? h('small', null, sous) : null)))));
}
const valeurChoix = (el, nom) => el.querySelector(`input[name="${nom}"]:checked`)?.value || '';
function tiroir(titre, contenu, opts = {}) {
  const fermer = () => {
    feuille.classList.remove('is-in');
    voile.classList.remove('is-in');
    document.removeEventListener('keydown', echap);
    setTimeout(() => { voile.remove(); if (!document.querySelector('.eq-voile')) document.body.style.overflow = ''; }, 300);
  };
  const echap = (e) => { if (e.key === 'Escape') fermer(); };
  const poignee = h('span', { class: 'ap-poignee', 'aria-hidden': 'true' });
  const tete = h('div', { class: 'eq-tiroir__tete' },
    h('div', null, opts.sur ? h('p', { class: 'ap-sur' }, opts.sur) : null, h('h2', null, titre)),
    h('button', { class: 'ap-fermer', type: 'button', 'aria-label': 'Fermer', onclick: () => fermer() }, ic('croix')));
  const feuille = h('div', { class: 'eq-tiroir', role: 'dialog', 'aria-modal': 'true', 'aria-label': titre }, poignee, tete, h('div', { class: 'eq-tiroir__corps' }, contenu));
  const voile = h('div', { class: 'eq-voile', onclick: (e) => { if (e.target === voile) fermer(); } }, feuille);
  // glisser la poignée (ou l'en-tête) vers le bas pour fermer
  let y0 = null;
  let dy = 0;
  [poignee, tete].forEach((z) => {
    z.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; feuille.style.transition = 'none'; z.setPointerCapture?.(e.pointerId); });
    z.addEventListener('pointermove', (e) => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); feuille.style.transform = `translateY(${dy}px)`; });
    const lacher = () => { if (y0 === null) return; y0 = null; feuille.style.transition = ''; feuille.style.transform = ''; if (dy > 90) fermer(); };
    z.addEventListener('pointerup', lacher);
    z.addEventListener('pointercancel', lacher);
  });
  document.body.append(voile);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', echap);
  requestAnimationFrame(() => requestAnimationFrame(() => { voile.classList.add('is-in'); feuille.classList.add('is-in'); }));
  return fermer;
}
const pastille = (cls, txt) => h('span', { class: `eq-pastille eq-pastille--${cls}` }, txt);
const vide = (icone, titre, texte) => h('div', { class: 'eq-vide' }, ic(icone), h('b', null, titre), texte ? h('span', null, texte) : null);
const lienFichier = (a, id, voir) => `${API}?${new URLSearchParams({ a, id, ...(voir ? { voir: 1 } : {}) })}`;

/* ---------- Démarrage ---------- */
async function demarrer() {
  let s;
  try { s = await api('session'); } catch (e) { return racine.replaceChildren(h('p', { class: 'eq-vide' }, e.message)); }
  const reset = (location.hash.match(/reset=([a-f0-9]{48})/) || [])[1];
  if (reset) return ecranReset(reset);
  const ronde = (location.hash.match(/ronde=([a-f0-9]{24})/) || [])[1];
  if (ronde) { try { sessionStorage.setItem('eq-ronde', ronde); } catch (e) { /* navigation privée */ } history.replaceState(null, '', location.pathname); }
  if (location.hash === '#inscription') return ecranInscription();
  if (!s.connecte) return ecranConnexion();
  moi = { prenom: s.prenom, nom: s.nom, metier: s.metier };
  ouvrirApplication();
}

/* ---------- Connexion, création de compte ---------- */
function carteAuth(titre, texte, ...contenu) {
  document.body.classList.remove('eq--app');
  clearInterval(minuteur);
  const page = h('main', { class: 'eq-auth eq-auth--centre' },
    h('section', { class: 'eq-auth__carte' },
      h('a', { class: 'eq-marque', href: '/' }, h('img', { src: '/assets/img/blason.svg?v=1', alt: '', width: 34, height: 43 }), h('span', null, h('b', null, 'BDA Security Group'), h('small', null, 'Espace agent'))),
      titre ? h('h1', null, titre) : null,
      texte ? h('p', { class: 'eq-auth__texte' }, texte) : null,
      ...contenu,
      h('p', { class: 'eq-auth__aide' }, h('a', { href: 'tel:+33611678625' }, '06 11 67 86 25'), ' · ', h('a', { href: '/' }, 'Retour au site'))));
  racine.replaceChildren(page);
  window.scrollTo(0, 0);
}
function ecranConnexion(message) {
  if (location.hash && !location.hash.startsWith('#/')) history.replaceState(null, '', location.pathname);
  const id = saisie({ autocomplete: 'username', required: true, placeholder: 'prenom.nom', autocapitalize: 'none', spellcheck: 'false' });
  const mdp = champMdp({ autocomplete: 'current-password', required: true, placeholder: '••••••••' });
  const memo = h('input', { type: 'checkbox', checked: true });
  const msg = h('p', { class: 'eq-erreur', role: 'alert' }, message || '');
  const btn = h('button', { class: 'eq-btn eq-btn--plein', type: 'submit' }, 'Se connecter', ic('fleche'));
  const form = h('form', { class: 'eq-form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = ''; btn.disabled = true;
    try {
      const s = await api('connexion', { identifiant: id.value.trim(), motdepasse: mdp.input.value, memoriser: memo.checked });
      moi = { prenom: s.prenom, nom: s.nom, metier: s.metier };
      if (!location.hash.startsWith('#/')) location.hash = '#/';
      ouvrirApplication();
    } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } },
    champ('Identifiant ou email', id),
    champ('Mot de passe', mdp.bloc),
    h('div', { class: 'eq-ligne-flex' }, h('label', { class: 'eq-case' }, memo, 'Rester connecté sur cet appareil'), h('button', { class: 'eq-lien', type: 'button', onclick: ecranOubli }, 'Mot de passe oublié ?')),
    msg, btn);
  carteAuth('Connexion', '', form,
    h('div', { class: 'eq-auth__bascule' }, h('span', null, 'Nouveau dans l’équipe ?'), h('button', { class: 'eq-btn eq-btn--ghost eq-btn--petit', type: 'button', onclick: () => { history.replaceState(null, '', '#inscription'); ecranInscription(); } }, 'Créer mon compte')));
  id.focus();
}
function ecranInscription() {
  const v = { metier: '' };
  let etape = 0;
  let idModifie = false;
  let idLibre = null;
  const prenom = saisie({ autocomplete: 'given-name', placeholder: 'Ex. Karim', required: true });
  const nom = saisie({ autocomplete: 'family-name', placeholder: 'Ex. Benali', required: true });
  const metiers = choix('metier', METIERS, '', 'eq-choix--3');
  const email = saisie({ type: 'email', autocomplete: 'email', placeholder: 'vous@exemple.fr', inputmode: 'email', autocapitalize: 'none' });
  const tel = saisie({ type: 'tel', autocomplete: 'tel', placeholder: '06 12 34 56 78', inputmode: 'tel' });
  const ident = saisie({ autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', placeholder: 'prenom.nom', maxlength: 30 });
  const dispo = h('span', { class: 'eq-dispo' });
  const mdp = champMdp({ autocomplete: 'new-password', placeholder: 'Choisissez un mot de passe' });
  const mdp2 = champMdp({ autocomplete: 'new-password', placeholder: 'Retapez-le' });
  const regles = reglesMdp(mdp.input, mdp2.input);
  const accepte = h('input', { type: 'checkbox' });
  const piege = h('input', { type: 'text', name: 'site_web', tabindex: '-1', autocomplete: 'off', class: 'sr', 'aria-hidden': 'true' });
  const msg = h('p', { class: 'eq-erreur', role: 'alert' });
  const barres = [0, 1, 2].map(() => h('span'));
  const zone = h('div');
  let verif;
  const verifier = () => {
    clearTimeout(verif);
    const val = ident.value.trim().toLowerCase();
    idLibre = null;
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(val)) {
      ident.className = 'eq-input' + (val ? ' is-ko' : '');
      dispo.className = 'eq-dispo is-ko';
      dispo.textContent = val ? 'Lettres sans accent, chiffres, point ou tiret (3 caractères minimum).' : '';
      return;
    }
    dispo.className = 'eq-dispo is-attente'; dispo.textContent = 'Vérification…';
    verif = setTimeout(async () => {
      try {
        const r = await api('identifiant.libre', undefined, { id: val });
        if (ident.value.trim().toLowerCase() !== val) return;
        idLibre = r.libre;
        ident.className = 'eq-input ' + (r.libre ? 'is-ok' : 'is-ko');
        dispo.className = 'eq-dispo ' + (r.libre ? 'is-ok' : 'is-ko');
        dispo.replaceChildren(r.libre ? ic('coche') : ic('croix'), r.libre ? 'Disponible' : 'Déjà pris : essayez une variante (ex. ' + val + '2)');
      } catch (e) { dispo.textContent = ''; }
    }, 380);
  };
  ident.addEventListener('input', () => { idModifie = true; ident.value = ident.value.toLowerCase().replace(/\s/g, ''); verifier(); });
  const suggerer = () => {
    if (idModifie) return;
    const p = simplifier(prenom.value), n = simplifier(nom.value);
    ident.value = p && n ? `${p}.${n}`.slice(0, 30) : p || n;
    if (ident.value) verifier();
  };
  const etapes = [
    { titre: 'Qui êtes-vous ?', texte: 'Quelques informations pour que la direction vous reconnaisse.',
      corps: () => [h('div', { class: 'eq-grille-2' }, champ('Prénom', prenom), champ('Nom', nom)), h('div', { class: 'eq-champ' }, h('span', null, 'Votre métier'), metiers)],
      valider: () => {
        v.metier = valeurChoix(metiers, 'metier');
        if (prenom.value.trim().length < 2) return [prenom, 'Indiquez votre prénom.'];
        if (nom.value.trim().length < 2) return [nom, 'Indiquez votre nom.'];
        if (!v.metier) return [null, 'Choisissez votre métier.'];
        return null;
      } },
    { titre: 'Comment vous joindre ?', texte: 'La direction vous préviendra sur cet email dès que votre accès sera activé.',
      corps: () => [champ('Adresse email', email), champ('Numéro de téléphone', tel, 'Le numéro sur lequel on peut vous appeler pour vos missions.')],
      valider: () => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) return [email, 'Adresse email invalide.'];
        if (tel.value.replace(/\D/g, '').length < 9) return [tel, 'Numéro de téléphone invalide.'];
        return null;
      } },
    { titre: 'Vos accès', texte: 'Choisissez l’identifiant et le mot de passe avec lesquels vous vous connecterez.',
      corps: () => [
        h('div', { class: 'eq-recap' }, h('span', null, h('b', null, `${prenom.value.trim()} ${nom.value.trim().toUpperCase()}`), ' · ', METIERS[v.metier][0]), h('span', null, `${email.value.trim()} · ${tel.value.trim()}`)),
        h('label', { class: 'eq-champ' }, h('span', null, 'Identifiant de connexion'), ident, dispo, h('small', null, 'Proposé automatiquement : vous pouvez le modifier. Notez-le bien.')),
        champ('Mot de passe', mdp.bloc), champ('Confirmez le mot de passe', mdp2.bloc), regles.liste,
        h('label', { class: 'eq-case' }, accepte, 'J’accepte que BDA Security Group utilise ces informations pour gérer mon compte et mes missions.'), piege],
      valider: () => {
        if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(ident.value.trim())) return [ident, 'Choisissez un identifiant valide.'];
        if (idLibre === false) return [ident, 'Cet identifiant est déjà pris.'];
        if (!regles.valide()) return [mdp.input, mdp.input.value !== mdp2.input.value && mdp2.input.value ? 'Les deux mots de passe ne sont pas identiques.' : 'Le mot de passe ne respecte pas encore toutes les règles.'];
        if (!accepte.checked) return [null, 'Cochez la case d’accord pour continuer.'];
        return null;
      } },
  ];
  const btnSuite = h('button', { class: 'eq-btn', type: 'submit' });
  const btnRetour = h('button', { class: 'eq-btn eq-btn--ghost', type: 'button', 'aria-label': 'Étape précédente', onclick: () => afficher(etape - 1) }, ic('retour'));
  const form = h('form', { class: 'eq-form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = '';
    const err = etapes[etape].valider();
    if (err) { msg.textContent = err[1]; err[0]?.focus(); return; }
    if (etape < 2) return afficher(etape + 1);
    btnSuite.disabled = true;
    try {
      await api('inscription', { prenom: prenom.value.trim(), nom: nom.value.trim(), email: email.value.trim(), tel: tel.value.trim(), metier: v.metier,
        identifiant: ident.value.trim().toLowerCase(), motdepasse: mdp.input.value, accepte: accepte.checked, site_web: piege.value });
      ecranEnvoye(prenom.value.trim(), ident.value.trim().toLowerCase(), email.value.trim());
    } catch (err2) { msg.textContent = err2.message; btnSuite.disabled = false; }
  } }, zone, msg, h('div', { class: 'eq-actions' }, btnRetour, btnSuite));
  const titre = h('h1');
  const texte = h('p', { class: 'eq-auth__texte' });
  const sur = h('div', { class: 'eq-etape-titre' });
  function afficher(n) {
    etape = Math.max(0, n);
    if (etape === 2) suggerer();
    barres.forEach((b, i) => b.classList.toggle('is-fait', i <= etape));
    sur.textContent = `Étape ${etape + 1} sur 3`;
    titre.textContent = etapes[etape].titre;
    texte.textContent = etapes[etape].texte;
    zone.replaceChildren(anim(h('div', { class: 'eq-form' }, etapes[etape].corps())));
    btnRetour.style.display = etape ? '' : 'none';
    btnSuite.replaceChildren(etape < 2 ? 'Continuer' : 'Envoyer ma demande', ic(etape < 2 ? 'fleche' : 'coche'));
    msg.textContent = '';
    const premier = zone.querySelector('input:not([type=radio]):not([type=checkbox])');
    if (premier && !premier.value) setTimeout(() => premier.focus(), 60);
  }
  carteAuth('', null, h('div', { class: 'eq-etapes' }, barres), sur, titre, texte, form,
    h('div', { class: 'eq-auth__bascule' }, h('span', null, 'Déjà un compte ?'), h('button', { class: 'eq-btn eq-btn--ghost eq-btn--petit', type: 'button', onclick: () => ecranConnexion() }, 'Se connecter')));
  afficher(0);
}
function ecranEnvoye(prenom, identifiant, email) {
  history.replaceState(null, '', location.pathname);
  carteAuth('', null,
    h('div', { class: 'eq-succes' },
      h('div', { class: 'eq-succes__rond' }, ic('coche')),
      h('h2', { style: 'font-size:1.8rem' }, `Demande envoyée, ${prenom} !`),
      h('p', { class: 'eq-auth__texte' }, 'Votre compte est créé. Il ne reste plus qu’une étape : la validation par la direction.')),
    h('ol', { class: 'eq-frise' },
      h('li', { class: 'is-fait' }, h('b', null, 'Compte créé'), 'Vos informations sont bien enregistrées.'),
      h('li', { class: 'is-encours' }, h('b', null, 'Validation par la direction'), 'En général dans la journée.'),
      h('li', null, h('b', null, 'Accès activé'), `Vous recevez un email sur ${email}.`)),
    h('div', { class: 'eq-recap' }, h('span', null, 'Votre identifiant de connexion :'), h('b', { style: 'font-size:1.2rem;color:var(--or-clair)' }, identifiant)),
    h('button', { class: 'eq-btn eq-btn--plein eq-mt', type: 'button', onclick: () => ecranConnexion() }, 'Retour à la connexion'));
}
function ecranOubli() {
  const id = saisie({ autocomplete: 'username', autocapitalize: 'none', placeholder: 'prenom.nom ou vous@exemple.fr' });
  const msg = h('p', { class: 'eq-erreur', role: 'alert' });
  const btn = h('button', { class: 'eq-btn eq-btn--plein', type: 'submit' }, 'Recevoir le lien');
  const form = h('form', { class: 'eq-form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = '';
    if (id.value.trim().length < 3) { msg.textContent = 'Indiquez votre identifiant ou votre email.'; return; }
    btn.disabled = true;
    try {
      await api('oubli', { identifiant: id.value.trim() });
      form.replaceWith(h('div', { class: 'eq-alerte eq-alerte--vert' }, ic('coche'), h('span', null, 'Si ce compte existe, un email vient de partir avec un lien pour choisir un nouveau mot de passe (valable 1 heure). Pensez à regarder dans les spams.')));
    } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } }, champ('Identifiant ou email', id), msg, btn);
  carteAuth('Mot de passe oublié', 'Nous vous envoyons un lien par email pour en choisir un nouveau.', form,
    h('button', { class: 'eq-lien eq-mt2', type: 'button', onclick: () => ecranConnexion() }, '← Retour à la connexion'));
  id.focus();
}
async function ecranReset(jeton) {
  let info;
  try { info = await api('reset.verifier', undefined, { jeton }); } catch (e) { return ecranConnexion(e.message); }
  const mdp = champMdp({ autocomplete: 'new-password' });
  const mdp2 = champMdp({ autocomplete: 'new-password' });
  const regles = reglesMdp(mdp.input, mdp2.input);
  const msg = h('p', { class: 'eq-erreur', role: 'alert' });
  const btn = h('button', { class: 'eq-btn eq-btn--plein', type: 'submit' }, 'Enregistrer et me connecter');
  const form = h('form', { class: 'eq-form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = '';
    if (!regles.valide()) { msg.textContent = 'Le mot de passe ne respecte pas encore toutes les règles.'; return; }
    btn.disabled = true;
    try {
      const s = await api('reset', { jeton, motdepasse: mdp.input.value });
      moi = { prenom: s.prenom, nom: s.nom, metier: s.metier };
      history.replaceState(null, '', location.pathname + '#/');
      toast('Mot de passe enregistré. Bienvenue !');
      ouvrirApplication();
    } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } }, h('div', { class: 'eq-recap' }, h('span', null, 'Identifiant : ', h('b', null, info.identifiant))), champ('Nouveau mot de passe', mdp.bloc), champ('Confirmez', mdp2.bloc), regles.liste, msg, btn);
  carteAuth(`Bonjour ${info.prenom}`, 'Choisissez votre nouveau mot de passe.', form);
  mdp.input.focus();
}

/* ---------- Application ---------- */
/* ----- Moi : carte d'agent, paie, documents, congés, réglages ----- */
async function pageMoi() {
  const [d, carte] = await Promise.all([api('accueil'), PAGES.carte ? api('mod.badge.carte').then((r) => r.carte).catch(() => null) : Promise.resolve(null)]);
  compteurs.fichesNonVues = d.fichesNonVues;
  compteurs.absencesAttente = d.absencesAttente;
  enService = Boolean(d.enCours);
  ouvrirApplication.menus?.();
  const etat = carte ? ({ valide: 'Carte pro valide', expiree: 'Carte pro expirée', a_verifier: 'Carte pro à vérifier', inactif: 'Carte inactive' })[carte.etat] || 'Carte professionnelle' : '';
  const lignes = [
    ligne({ href: '#/paie' }, 'Fiches de paie', d.fichesNonVues ? h('span', { class: 'ap-compte' }, d.fichesNonVues) : null),
    ligne({ href: '#/documents' }, 'Documents', null),
    ligne({ href: '#/absences' }, 'Congés et absences', d.absencesAttente ? `${d.absencesAttente} en attente` : 'Demander'),
    moi.metier === 'chauffeur' ? ligne({ href: '#/courses' }, 'Mes courses', null) : ligne({ href: '#/main-courante' }, 'Mes signalements', d.incidentsOuverts ? `${d.incidentsOuverts} en cours` : null),
    PAGES.consignes ? ligne({ href: '#/consignes' }, 'Consignes des sites', null) : null,
    PAGES.materiel ? ligne({ href: '#/materiel' }, 'Mon matériel', null) : null,
    PAGES.presence ? ligne({ href: '#/presence' }, 'Tout va bien ?', 'Alertes') : null,
    ligne({ href: '#/profil' }, 'Profil et disponibilités', null),
    PAGES.compte ? ligne({ href: '#/compte' }, 'Réglages', null) : null,
  ].filter(Boolean);
  return h('div', { class: 'ap-v ap-moi' },
    h('header', { class: 'ap-tete ap-tete--page' }, h('p', { class: 'ap-sur' }, d.moi.metierLibelle || METIERS[d.moi.metier]?.[0] || ''), h('h1', { class: 'ap-titre' }, `${d.moi.prenom} ${d.moi.nom || ''}`.trim())),
    carte ? h('a', { class: 'ap-carte-agent', href: '#/carte', 'aria-label': 'Afficher ma carte d’agent' },
      h('span', { class: 'ap-carte-agent__haut' }, h('span', { class: 'ap-marque-carte' }, h('b', null, 'BDA'), h('small', null, 'SECURITY GROUP')), h('small', null, 'CARTE D’AGENT')),
      h('span', { class: 'ap-carte-agent__bas' }, h('b', null, `${carte.prenom} ${String(carte.nom || '').charAt(0)}.`),
        h('span', null, h('small', null, `${etat}${carte.validite ? ` · ${carte.validite}` : ''}`), h('small', { class: 'is-clair' }, 'Afficher le QR')))) : null,
    h('div', { class: 'ap-chiffres' }, h('div', null, h('small', null, 'Cette semaine'), h('b', null, fmtMin(d.semaine))), h('div', null, h('small', null, 'Ce mois'), h('b', null, fmtMin(d.mois)))),
    h('nav', { class: 'ap-lignes', 'aria-label': 'Mon compte' }, lignes),
    h('button', { class: 'ap-btn-texte ap-deconnexion', type: 'button', onclick: deconnexion }, 'Se déconnecter'));
}

const PAGES = {
  '': { titre: 'Aujourd’hui', icone: 'auj', rendu: pageAccueil },
  moi: { titre: 'Moi', icone: 'moi', rendu: pageMoi },
  planning: { titre: 'Planning', icone: 'planning', rendu: pagePlanning },
  'main-courante': { titre: 'Main courante', icone: 'mc', rendu: pageMainCourante },
  courses: { titre: 'Mes courses', icone: 'voiture', rendu: pageCourses, chauffeur: true },
  paie: { titre: 'Fiches de paie', icone: 'paie', rendu: pagePaie, badge: 'fichesNonVues' },
  absences: { titre: 'Congés & absences', icone: 'absences', rendu: pageAbsences, badge: 'absencesAttente' },
  documents: { titre: 'Mes documents', icone: 'documents', rendu: pageDocuments },
  profil: { titre: 'Mon profil', icone: 'profil', rendu: pageProfil },
};
// Pages des modules : leur rendu reçoit les outils de l'espace (h, api, tiroir, toast…)
Object.assign(ICONES, MODULES.ICONES || {});
for (const [r, p] of Object.entries(MODULES.PAGES || {})) if (!PAGES[r]) PAGES[r] = { ...p, rendu: () => p.rendu(outilsModules()) };
function outilsModules() {
  return { h, api, apiForm, toast, tiroir, enTete, ic, vide, anim, recharger, iso, dateLongue, lireCreneau, initiales, moi, compteurs, VERSION };
}
const pagesVisibles = () => Object.entries(PAGES).filter(([, p]) => !p.chauffeur || moi.metier === 'chauffeur');
let principal = null;
let ongletsNav = null;
let enService = false;
// 4 onglets ; les autres pages appartiennent à l'un d'eux (flèche retour et onglet allumé)
const ONGLETS = [['', 'Aujourd’hui', 'auj'], ['planning', 'Planning', 'cal'], ['messages', 'Messages', 'msg'], ['moi', 'Moi', 'moi']];
const PARENTS = { consignes: '', presence: '', postes: 'planning', carte: 'moi', paie: 'moi', documents: 'moi', absences: 'moi', profil: 'moi', compte: 'moi', materiel: 'moi', 'main-courante': 'moi', courses: 'moi' };
const routeActuelle = () => location.hash.replace(/^#\/?/, '').split('?')[0];
const estOnglet = (r) => ONGLETS.some(([k]) => k === r);
const ongletDe = (r) => (estOnglet(r) ? r : (PARENTS[r] ?? 'moi'));
const vibrer = (motif) => { try { navigator.vibrate?.(motif); } catch (e) { /* pas de vibreur */ } };
let ecouteSaisie = false;
function ouvrirApplication() {
  document.body.classList.add('eq--app', 'ap-v2');
  principal = h('main', { class: 'ap-ecran', id: 'contenu' });
  ongletsNav = h('nav', { class: 'ap-onglets', 'aria-label': 'Navigation principale' });
  const dessinerMenus = () => {
    const actif = ongletDe(routeActuelle());
    const liste = ONGLETS.filter(([k]) => k !== 'messages' || PAGES.messages);
    ongletsNav.style.setProperty('--n', liste.length);
    ongletsNav.replaceChildren(...liste.map(([k, lib, icone]) => {
      const service = k === '' && enService;
      const point = (k === 'messages' && compteurs.messages) || (k === 'moi' && (compteurs.fichesNonVues || compteurs.absencesAttente));
      return h('a', { href: `#/${k}`, class: `ap-onglet ${k === actif ? 'is-actif' : ''} ${service ? 'is-service' : ''}`, 'aria-current': k === actif ? 'page' : null },
        h('span', { class: 'ap-onglet__ic' }, ic(service ? 'chrono' : icone), point ? h('i', { class: 'ap-point', 'aria-label': 'Nouveau' }) : null),
        h('span', null, service ? 'En service' : lib));
    }));
  };
  racine.replaceChildren(h('div', { class: 'ap' }, principal, ongletsNav));
  ouvrirApplication.menus = dessinerMenus;
  // clavier ouvert sur téléphone : la barre d'onglets se range pour laisser la place à la saisie
  if (!ecouteSaisie) {
    ecouteSaisie = true;
    const champ = (el) => el?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select');
    document.addEventListener('focusin', (e) => { if (champ(e.target)) document.body.classList.add('ap-saisie'); });
    document.addEventListener('focusout', () => setTimeout(() => { if (!champ(document.activeElement)) document.body.classList.remove('ap-saisie'); }, 80));
  }
  window.onhashchange = naviguer;
  naviguer();
  let ronde = null;
  try { ronde = sessionStorage.getItem('eq-ronde'); sessionStorage.removeItem('eq-ronde'); } catch (e) { /* navigation privée */ }
  if (ronde) validerRonde(ronde);
}

/* ---------- Ronde : passage enregistré quand l'agent scanne le QR code collé sur le site ---------- */
async function validerRonde(jeton) {
  const corps = h('div', { class: 'eq-ronde' }, h('div', { class: 'eq-ronde__ic' }, ic('pin')), h('b', null, 'Enregistrement du passage…'));
  tiroir('Point de ronde', corps);
  try {
    const r = await api('ronde', { jeton, ...(await position()) });
    corps.replaceChildren(h('div', { class: 'eq-ronde__ic is-ok' }, ic('coche')), h('b', null, r.point), h('span', null, `${r.site} · ${r.heure.replace(':', 'h')}`),
      h('small', null, r.deja ? 'Passage déjà enregistré il y a un instant.' : 'Passage enregistré. Continuez votre ronde.'));
  } catch (e) {
    corps.replaceChildren(h('div', { class: 'eq-ronde__ic is-non' }, ic('alerte')), h('b', null, 'Passage non enregistré'), h('small', null, e.message));
  }
}

/* ---------- Maintenir pour valider (prise et fin de service, SOS) : un trait se remplit, la vibration confirme ---------- */
function maintenir(bouton, duree, action) {
  let t = null;
  bouton.classList.add('ap-maintenir');
  bouton.style.setProperty('--duree', `${duree}ms`);
  const partir = () => {
    if (bouton.disabled || t) return;
    bouton.classList.add('is-appui');
    vibrer(8);
    t = setTimeout(() => {
      t = null;
      bouton.classList.remove('is-appui');
      bouton.classList.add('is-valide');
      vibrer([25, 40, 25]);
      setTimeout(() => bouton.classList.remove('is-valide'), 700);
      action();
    }, duree);
  };
  const stop = () => { if (t) { clearTimeout(t); t = null; } bouton.classList.remove('is-appui'); };
  bouton.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); bouton.setPointerCapture?.(e.pointerId); partir(); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => bouton.addEventListener(ev, stop));
  bouton.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); partir(); } });
  bouton.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') stop(); });
  bouton.addEventListener('click', (e) => e.preventDefault());
  bouton.addEventListener('contextmenu', (e) => e.preventDefault());
  return bouton;
}

/* ---------- SOS : maintenir 2 s ; la direction est prévenue avec la position ---------- */
function sosPilule() {
  return maintenir(h('button', { class: 'ap-sos', type: 'button', 'aria-label': 'SOS : maintenez 2 secondes pour prévenir la direction' }, 'SOS'), 2000, declencherSos);
}
async function declencherSos() {
  const etat = h('p', { class: 'eq-sos-etat' }, 'Envoi de l’alerte…');
  tiroir('Alerte', h('div', { class: 'eq-sos-fenetre' }, etat,
    h('p', null, 'En cas de danger immédiat, appelez aussi les secours :'),
    h('div', { class: 'eq-sos-numeros' },
      h('a', { class: 'eq-btn eq-btn--rouge', href: 'tel:17' }, 'Police · 17'),
      h('a', { class: 'eq-btn eq-btn--rouge', href: 'tel:15' }, 'SAMU · 15'),
      h('a', { class: 'eq-btn eq-btn--rouge', href: 'tel:18' }, 'Pompiers · 18'),
      h('a', { class: 'eq-btn eq-btn--ghost', href: 'tel:112' }, 'Urgences · 112'))), { sur: 'SOS' });
  try {
    await api('sos', { ...(await position()) });
    etat.textContent = 'Alerte envoyée : la direction est prévenue avec votre position.';
    etat.classList.add('is-ok');
  } catch (e) {
    etat.textContent = `L’alerte n’est pas partie (${e.message}). Appelez la direction.`;
    etat.classList.add('is-non');
  }
}
function menuPlus() {
  const lien = (r) => { const p = PAGES[r]; return h('a', { href: `#/${r}`, onclick: () => fermer() }, ic(p.icone), p.titre, p.badge && compteurs[p.badge] ? h('i', { class: 'eq-badge' }, compteurs[p.badge]) : null); };
  const routes = ['main-courante', 'absences', 'documents', moi.metier === 'chauffeur' ? 'paie' : null,
    ...Object.entries(MODULES.PAGES || {}).filter(([, p]) => p.plus !== false && (!p.chauffeur || moi.metier === 'chauffeur')).map(([r]) => r), 'profil'].filter(Boolean);
  const fermer = tiroir('Plus', h('div', { class: 'eq-menu-plus' }, routes.map(lien),
    h('button', { type: 'button', class: 'is-rouge', onclick: () => { fermer(); deconnexion(); } }, ic('sortie'), 'Se déconnecter')));
}
async function deconnexion() {
  try { await api('deconnexion', {}); } catch (e) { /* déjà déconnecté */ }
  moi = { prenom: '', metier: '' };
  history.replaceState(null, '', location.pathname);
  ecranConnexion();
}
let routePrecedente = null;
const squelette = () => h('div', { class: 'ap-squelette', 'aria-hidden': 'true' }, h('i', { class: 'is-court' }), h('i', { class: 'is-titre' }), h('i', { class: 'is-bloc' }), h('i'), h('i'));
async function naviguer() {
  if (!document.body.classList.contains('eq--app')) return;
  clearInterval(minuteur);
  // lien direct « #/signaler » (raccourci, notification) : ouvre la feuille sur l'écran Aujourd'hui
  if (routeActuelle() === 'signaler') { history.replaceState(null, '', '#/'); setTimeout(() => formulaireIncident(), 450); }
  const route = routeActuelle();
  const page = PAGES[route] && (!PAGES[route].chauffeur || moi.metier === 'chauffeur') ? PAGES[route] : PAGES[''];
  document.title = `${page.titre} | BDA Équipe`;
  const avant = routePrecedente;
  routePrecedente = route;
  // onglet ↔ onglet : fondu ; vers une sous-page : glisse depuis la droite ; retour : depuis la gauche
  const sens = avant === null || (estOnglet(route) && estOnglet(avant)) ? 'fondu' : !estOnglet(route) ? 'avant' : 'arriere';
  ouvrirApplication.menus?.();
  principal.classList.add('is-attente');
  const lent = setTimeout(() => { principal.classList.remove('is-attente'); principal.replaceChildren(squelette()); }, 260);
  try {
    const contenu = await page.rendu();
    clearTimeout(lent);
    if (routeActuelle() !== route) return;
    const parent = ongletDe(route);
    const ecran = h('div', { class: `ap-page ap-page--${sens}` },
      estOnglet(route) ? null : h('a', { class: 'ap-retour', href: `#/${parent}` }, ic('retour'), ONGLETS.find(([k]) => k === parent)?.[1] || 'Retour'),
      anim(contenu));
    principal.classList.remove('is-attente');
    principal.replaceChildren(ecran);
    // la conversation s'ouvre sur le dernier message ; les autres écrans en haut
    if (route === 'messages') requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight));
    else window.scrollTo(0, 0);
  } catch (e) {
    clearTimeout(lent);
    principal.classList.remove('is-attente');
    if (e.message !== 'Connexion requise.') principal.replaceChildren(h('div', { class: 'ap-page ap-page--fondu' }, h('div', { class: 'ap-v ap-erreur' }, vide('alerte', 'Impossible de charger cette page', e.message))));
  }
}
const recharger = () => naviguer();
const enTete = (surtitre, titre, texte, ...actions) => h('div', { class: 'eq-titre' }, h('div', null, surtitre ? h('div', { class: 'eq-surtitre' }, surtitre) : null, h('h1', null, titre), texte ? h('p', null, texte) : null), actions.length ? h('div', { style: 'display:flex;gap:.5rem;flex-wrap:wrap' }, actions) : null);

/* ----- Aujourd'hui : le prochain poste et une seule action (prendre ou finir le service) ----- */
const JOURS_MAJ = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
const hm = (s) => String(s || '').slice(0, 5).replace(/^0(\d)/, '$1').replace(':', 'h');
const minVersHm = (m) => { const x = ((m % 1440) + 1440) % 1440; return `${Math.floor(x / 60)}h${pad(x % 60)}`; };
const marque = () => h('span', { class: 'ap-marque', role: 'img', 'aria-label': 'BDA Security Group' }, h('b', null, 'BDA'), h('i'));
const ligne = (attrs, gauche, droite) => h(attrs.href ? 'a' : 'button', { class: `ap-ligne ${attrs.class || ''}`, type: attrs.href ? null : 'button', href: attrs.href || null, onclick: attrs.onclick || null },
  h('span', { class: 'ap-ligne__g' }, gauche), h('span', { class: 'ap-ligne__d' }, droite || null, ic('fleche')));
const dans = (m) => (m < 60 ? `DANS ${Math.max(1, m)} MIN` : m % 60 ? `DANS ${Math.floor(m / 60)} H ${pad(m % 60)}` : `DANS ${m / 60} H`);
const lienCarte = (adresse) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
// Fiche d'un poste : adresse, consignes, contact, confirmation
function detailPostes(ps) {
  const p0 = ps[0];
  tiroir(ps.map((p) => p.site).filter((v, i, a) => a.indexOf(v) === i).join(' · '), h('div', { class: 'ap-fiche' }, ps.map((p) => {
    const conf = p.confirme ? h('p', { class: 'ap-ok' }, ic('coche'), 'Présence confirmée') : h('button', { class: 'ap-btn ap-btn--contour', type: 'button', onclick: async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      try { await api('poste.confirmer', { id: p.id }); b.replaceWith(h('p', { class: 'ap-ok' }, ic('coche'), 'Présence confirmée')); vibrer(15); toast('Merci, la direction voit que vous avez confirmé.'); } catch (err) { toast(err.message, true); b.disabled = false; }
    } }, 'Je confirme ma présence');
    return h('section', { class: 'ap-fiche__poste' },
      h('p', { class: 'ap-fiche__heures' }, hm(p.debut), h('span', null, ' — '), hm(p.fin)),
      p.adresse ? h('a', { class: 'ap-lien-adresse', href: lienCarte(p.adresse), target: '_blank', rel: 'noopener' }, p.adresse, ic('versHaut')) : null,
      p.note ? h('p', { class: 'ap-fiche__texte' }, p.note) : null,
      p.contact ? h('div', { class: 'ap-fiche__bloc' }, h('p', { class: 'ap-sur' }, 'CONTACT SUR PLACE'), h('p', null, p.contact)) : null,
      p.consignes ? h('div', { class: 'ap-fiche__bloc' }, h('p', { class: 'ap-sur' }, 'CONSIGNES DU SITE'), h('p', { class: 'ap-fiche__texte' }, p.consignes)) : null,
      conf);
  })), { sur: dateLongue(p0.jour).toUpperCase() });
}
async function pageAccueil() {
  const [d, mesPostes, nonLus, cartesModules] = await Promise.all([api('accueil'), api('postes').then((r) => r.postes).catch(() => []),
    PAGES.messages ? api('mod.mobile.messages.nonlus').catch(() => ({})) : Promise.resolve({}),
    Promise.all((MODULES.CARTES || []).map((f) => Promise.resolve().then(() => f(outilsModules())).catch((e) => { console.error(e); return null; })))]);
  Object.assign(moi, { prenom: d.moi.prenom, nom: d.moi.nom, metier: d.moi.metier });
  compteurs = { fichesNonVues: d.fichesNonVues, absencesAttente: d.absencesAttente, messages: nonLus.nonLus || 0 };
  decalage = versDate(d.serveur) - Date.now();
  enService = Boolean(d.enCours);
  ouvrirApplication.menus?.();
  const maintenant = new Date(Date.now() + decalage);
  const aujIso = iso(maintenant);
  const heureNow = `${pad(maintenant.getHours())}:${pad(maintenant.getMinutes())}`;
  const auj = d.prochains[0];
  const c = lireCreneau(auj?.creneau);
  // les postes du planning des sites donnent le lieu, l'adresse et les horaires exacts
  const fini = (p) => p.jour < aujIso || (p.jour === aujIso && p.fin > p.debut && p.fin.slice(0, 5) <= heureNow);
  const aVenir = mesPostes.filter((p) => !fini(p)).sort((a, b) => `${a.jour}${a.debut}`.localeCompare(`${b.jour}${b.debut}`));
  const prochain = aVenir[0] || null;
  const posteDuJour = mesPostes.find((p) => p.jour === aujIso) || null;
  const sos = moi.metier !== 'chauffeur' ? sosPilule() : null;

  const pointer = async (quoi, bouton) => {
    const texte = bouton.textContent;
    bouton.disabled = true;
    bouton.textContent = 'Localisation…';
    try {
      const pos = await position();
      const r = await api(quoi === 'fin' ? 'pointer.fin' : 'pointer.debut', pos);
      toast(quoi === 'fin' ? `Fin de service enregistrée (${fmtMin(r.minutes)}). Bon repos !` : 'Prise de service enregistrée. Bon courage !');
      recharger();
    } catch (e) { toast(e.message, true); bouton.disabled = false; bouton.textContent = texte; }
  };

  // ce qui demande l'attention : questions « Tout va bien ? », consignes à lire, messages, postes à prendre, alertes
  const lignes = [
    ...d.alertes.map((a) => h('div', { class: `ap-ligne ap-ligne--${a.niveau}` }, h('span', { class: 'ap-ligne__g' }, h('i', { class: 'ap-puce-etat' }), a.texte))),
    ...cartesModules.filter(Boolean),
    d.consignes.length ? ligne({ onclick: () => tiroir('Consignes', h('div', { class: 'ap-fiche' }, d.consignes.map((x) => h('div', { class: 'ap-fiche__bloc' },
      h('p', { class: 'ap-sur' }, `${frDate(x.cree)} · ${+x.agent_id ? 'POUR VOUS' : 'TOUTE L’ÉQUIPE'}`), h('p', { class: 'ap-fiche__texte' }, x.texte)))), { sur: 'LA DIRECTION' }) },
      [h('i', { class: 'ap-puce-etat is-clair' }), 'Consignes de la direction'], `${d.consignes.length}`) : null,
    moi.metier === 'chauffeur' && d.courses.length ? ligne({ href: '#/courses' }, 'Prochaines courses', `${d.courses.length}`) : null,
  ].filter(Boolean);
  const blocLignes = lignes.length ? h('nav', { class: 'ap-lignes', 'aria-label': 'À voir' }, lignes) : null;

  // ----- en service : le temps qui passe, signaler, finir -----
  if (d.enCours) {
    const debut = versDate(d.enCours.debut);
    const p = posteDuJour && !fini(posteDuJour) ? posteDuJour : (posteDuJour || null);
    let fin = null;
    let finLib = '';
    if (p) { fin = versDate(`${p.jour}T${p.fin.slice(0, 5)}:00`); if (p.fin <= p.debut) fin = new Date(fin.getTime() + 86400000); finLib = hm(p.fin); }
    else if (c && c.fin) { fin = new Date(versDate(`${aujIso}T00:00:00`).getTime() + c.fin * 60000); finLib = minVersHm(c.fin); }
    if (fin && fin <= debut) fin = null;
    const chrono = h('p', { class: 'ap-chrono' });
    const barre = h('i');
    const tic = () => {
      const t = Date.now() + decalage;
      const sec = Math.max(0, Math.floor((t - debut) / 1000));
      chrono.replaceChildren(String(Math.floor(sec / 3600)), h('span', { class: 'ap-or' }, ':'), pad(Math.floor(sec / 60) % 60), h('small', null, pad(sec % 60)));
      if (fin) barre.style.width = `${Math.min(100, Math.max(0, ((t - debut) / (fin - debut)) * 100))}%`;
    };
    tic();
    minuteur = setInterval(tic, 1000);
    const finir = maintenir(h('button', { class: 'ap-btn-texte', type: 'button' }, 'Finir mon service · maintenir'), 2000, () => pointer('fin', finir));
    const site = d.enCours.site || p?.site || '';
    if (p && (p.consignes || p.contact)) lignes.push(ligne({ onclick: () => detailPostes([p]) }, 'Consignes du site', ''));
    return h('div', { class: 'ap-v ap-aujourdhui is-service' },
      h('header', { class: 'ap-haut' }, marque(), sos),
      h('section', { class: 'ap-tete' },
        h('p', { class: 'ap-sur ap-sur--or' }, h('i', { class: 'ap-pouls' }), 'EN SERVICE'),
        h('h1', { class: 'ap-titre ap-titre--m' }, site || 'Service en cours'),
        chrono,
        fin ? h('div', { class: 'ap-progres', role: 'presentation' }, barre) : null,
        h('p', { class: 'ap-bornes' }, h('span', null, `Depuis ${frHeure(d.enCours.debut)}`), finLib ? h('span', null, `Fin ${finLib}`) : null)),
      lignes.length ? h('nav', { class: 'ap-lignes', 'aria-label': 'Pendant le service' }, lignes) : null,
      h('div', { class: 'ap-bas' },
        h('button', { class: 'ap-btn', type: 'button', onclick: () => formulaireIncident(site) }, 'Signaler un événement'),
        finir));
  }

  // ----- avant le poste -----
  const heure = maintenant.getHours();
  const salut = heure < 5 || heure >= 18 ? 'Bonsoir' : 'Bonjour';
  const demainIso = iso(new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + 1));
  let carte;
  if (prochain) {
    const debutPoste = versDate(`${prochain.jour}T${prochain.debut.slice(0, 5)}:00`);
    const ecart = Math.round((debutPoste - maintenant) / 60000);
    const quand = ecart <= 0 ? 'MAINTENANT' : prochain.jour === aujIso ? dans(ecart) : prochain.jour === demainIso ? `DEMAIN · ${hm(prochain.debut)}` : dateLongue(prochain.jour).toUpperCase();
    carte = h('button', { class: 'ap-poste', type: 'button', onclick: () => detailPostes(mesPostes.filter((p) => p.jour === prochain.jour)) },
      h('p', { class: 'ap-sur' }, `PROCHAIN POSTE · ${quand}`),
      h('p', { class: 'ap-poste__site' }, prochain.site),
      h('p', { class: 'ap-poste__heures' }, hm(prochain.debut), h('span', null, ' — '), hm(prochain.fin)),
      prochain.adresse ? h('span', { class: 'ap-poste__adresse' }, prochain.adresse, ic('versHaut')) : null,
      h('span', { class: `ap-poste__etat ${prochain.confirme ? 'is-ok' : ''}` }, prochain.confirme ? 'Présence confirmée' : 'Toucher pour confirmer et voir les consignes'));
  } else {
    const planif = d.prochains.find((j) => { const x = lireCreneau(j.creneau); return x && !x.code; });
    if (c?.code) {
      carte = h('section', { class: 'ap-poste is-calme' }, h('p', { class: 'ap-sur' }, 'AUJOURD’HUI'), h('p', { class: 'ap-poste__site' }, CODES[c.code] || c.code), h('p', { class: 'ap-poste__note' }, 'Profitez-en.'));
    } else if (planif) {
      const x = lireCreneau(planif.creneau);
      carte = h('section', { class: 'ap-poste' },
        h('p', { class: 'ap-sur' }, `PROCHAIN POSTE · ${planif.jour === aujIso ? 'AUJOURD’HUI' : planif.jour === demainIso ? 'DEMAIN' : dateLongue(planif.jour).toUpperCase()}`),
        planif.site ? h('p', { class: 'ap-poste__site' }, planif.site) : null,
        h('p', { class: 'ap-poste__heures' }, x.debut !== undefined ? [minVersHm(x.debut), h('span', null, ' — '), minVersHm(x.fin)] : String(planif.creneau).replace(/\s+/g, '')));
    } else {
      carte = h('section', { class: 'ap-poste is-calme' }, h('p', { class: 'ap-sur' }, 'PROCHAIN POSTE'), h('p', { class: 'ap-poste__site' }, 'Aucun poste prévu'),
        h('p', { class: 'ap-poste__note' }, 'Votre planning s’affichera ici dès que la direction l’aura préparé.'));
    }
  }
  const prendre = h('button', { class: 'ap-btn', type: 'button' }, 'Prendre mon service');
  maintenir(prendre, 1200, () => pointer('debut', prendre));
  return h('div', { class: 'ap-v ap-aujourdhui' },
    h('header', { class: 'ap-haut' }, marque(), sos),
    h('section', { class: 'ap-tete' },
      h('p', { class: 'ap-sur' }, `${JOURS_MAJ[maintenant.getDay()]} ${maintenant.getDate()} ${MOIS[maintenant.getMonth()].toUpperCase()}`),
      h('h1', { class: 'ap-titre' }, `${salut}, ${d.moi.prenom}`)),
    carte,
    blocLignes,
    h('div', { class: 'ap-bas' },
      prendre,
      h('p', { class: 'ap-aide' }, 'Maintenir pour pointer · votre position est enregistrée'),
      moi.metier !== 'chauffeur' ? h('button', { class: 'ap-btn-texte', type: 'button', onclick: () => formulaireIncident(prochain?.jour === aujIso ? prochain.site : undefined) }, 'Signaler un événement') : null));
}

/* ----- Planning : les postes, semaine par semaine ----- */
async function pagePlanning() {
  const maintenant = new Date(Date.now() + decalage);
  const aujIso = iso(maintenant);
  const m1 = aujIso.slice(0, 7);
  const m2 = iso(new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 1)).slice(0, 7);
  const videP = { jours: {}, absences: [], pointages: [] };
  const [p1, p2, postes, bourse] = await Promise.all([api('planning', undefined, { mois: m1 }), api('planning', undefined, { mois: m2 }).catch(() => videP),
    api('postes').then((r) => r.postes).catch(() => []), PAGES.postes ? api('mod.planif.postes').catch(() => null) : Promise.resolve(null)]);
  const jours = { ...(p1.jours || {}), ...(p2.jours || {}) };
  const absences = [...(p1.absences || []), ...(p2.absences || [])];
  const pointages = [...(p1.pointages || []), ...(p2.pointages || [])];
  const fer = new Set([...feries(maintenant.getFullYear()), ...feries(maintenant.getFullYear() + 1)]);
  const pointeLe = (j) => pointages.filter((p) => p.debut.slice(0, 10) === j).reduce((s, p) => s + Math.max(0, ((p.fin ? versDate(p.fin) : new Date(Date.now() + decalage)) - versDate(p.debut)) / 60000), 0);
  const lundi = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - ((maintenant.getDay() + 6) % 7), 12);
  const groupes = [['CETTE SEMAINE', []], ['SEMAINE PROCHAINE', []], ['ENSUITE', []]];
  for (let n = 0; n < 42; n++) {
    const dt = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + n, 12);
    const j = iso(dt);
    const v = jours[j] || '';
    const ps = postes.filter((p) => p.jour === j).sort((a, b) => a.debut.localeCompare(b.debut));
    const ab = absences.find((a) => a.du <= j && a.au >= j);
    if (!v && !ps.length && !ab) continue;
    const c = lireCreneau(v);
    const passe = j < aujIso;
    const pt = pointeLe(j);
    const titre = ps.length ? [...new Set(ps.map((p) => p.site))].join(' · ')
      : c?.code ? (CODES[c.code] || c.code) : ab && !v ? (ab.statut === 'attente' ? 'Absence demandée' : ABSENCES[ab.type]?.[0] || 'Absence') : 'Service';
    const horaires = ps.length ? ps.map((p) => `${hm(p.debut)} — ${hm(p.fin)}`).join(' · ')
      : c && c.debut !== undefined ? `${minVersHm(c.debut)} — ${minVersHm(c.fin)}` : c && !c.code ? String(v).replace(/\s+/g, '') : '';
    const extra = [ps.some((p) => p.fin <= p.debut) || c?.nuit ? 'nuit' : '', fer.has(j) ? 'férié' : ''].filter(Boolean).join(' · ');
    const etiquette = j === aujIso ? h('span', { class: 'ap-etiquette' }, 'Aujourd’hui')
      : pt ? h('span', { class: 'ap-etiquette is-ok' }, `✓ ${fmtMin(pt)}`)
        : ps.length && !passe && ps.some((p) => !p.confirme) ? h('span', { class: 'ap-etiquette is-attente' }, 'À confirmer') : null;
    groupes[n < 7 ? 0 : n < 14 ? 1 : 2][1].push(h(ps.length ? 'button' : 'div', {
      class: `ap-jour ${passe ? 'is-passe' : ''} ${j === aujIso ? 'is-auj' : ''} ${c?.code || (ab && !v && !ps.length) ? 'is-code' : ''}`,
      type: ps.length ? 'button' : null, onclick: ps.length ? () => detailPostes(ps) : null },
      h('span', { class: 'ap-jour__date' }, h('small', null, JOURS_COURTS[dt.getDay()].replace('.', '').toUpperCase()), h('b', null, dt.getDate())),
      h('span', { class: 'ap-jour__corps' }, h('b', null, titre), horaires || extra ? h('small', null, [horaires, extra].filter(Boolean).join(' · ')) : null),
      etiquette));
  }
  const offres = bourse ? bourse.bourse.filter((p) => p.possible).length + bourse.pourMoi.filter((p) => p.possible).length : 0;
  const rien = groupes.every(([, l]) => !l.length);
  return h('div', { class: 'ap-v ap-planning' },
    h('header', { class: 'ap-tete ap-tete--page' }, h('p', { class: 'ap-sur' }, `${MOIS[maintenant.getMonth()].toUpperCase()} ${maintenant.getFullYear()}`), h('h1', { class: 'ap-titre' }, 'Planning')),
    offres ? h('nav', { class: 'ap-lignes ap-lignes--haut' }, ligne({ href: '#/postes' }, `${offres} poste${offres > 1 ? 's' : ''} proposé${offres > 1 ? 's' : ''}`, 'Voir')) : null,
    ...groupes.filter(([, l]) => l.length).map(([t, l]) => h('section', { class: 'ap-groupe' }, h('h2', { class: 'ap-sur' }, t), l)),
    rien ? h('div', { class: 'ap-vide-v' }, vide('planning', 'Aucun poste prévu', 'Votre planning apparaîtra ici dès que la direction l’aura préparé.')) : null,
    h('p', { class: 'ap-pied' }, `Mis à jour à ${pad(maintenant.getHours())}h${pad(maintenant.getMinutes())} · une erreur ? `, h('a', { href: 'tel:+33611678625' }, 'appelez la direction')));
}

/* ----- Fiches de paie ----- */
async function pagePaie() {
  const d = await api('fiches');
  const parAn = {};
  d.fiches.forEach((f) => (parAn[f.mois.slice(0, 4)] ||= []).push(f));
  const item = (f) => {
    const [a, m] = f.mois.split('-').map(Number);
    const etat = h('span', { style: 'display:block;margin-top:.35rem' }, f.vu ? null : pastille('nouveau', 'Nouveau'));
    const vu = () => { if (!f.vu) { f.vu = 'oui'; etat.replaceChildren(); compteurs.fichesNonVues = Math.max(0, (compteurs.fichesNonVues || 1) - 1); ouvrirApplication.menus?.(); } };
    return h('div', { class: 'eq-item' },
      h('div', { class: 'eq-item__ic' }, ic('paie')),
      h('div', { class: 'eq-item__corps' }, h('b', null, `${MOIS[m - 1].replace(/^./, (x) => x.toUpperCase())} ${a}`), h('small', null, `${f.titre} · ${taille(+f.taille)}`), etat),
      h('div', { class: 'eq-item__fin' },
        h('a', { class: 'eq-icone-btn', href: lienFichier('fiche', f.id, true), target: '_blank', rel: 'noopener', title: 'Voir', 'aria-label': 'Voir la fiche', onclick: vu }, ic('oeil')),
        h('a', { class: 'eq-icone-btn', href: lienFichier('fiche', f.id), title: 'Télécharger', 'aria-label': 'Télécharger la fiche', onclick: vu, style: 'color:var(--or-clair)' }, ic('telecharger'))));
  };
  return h('div', null,
    enTete('Documents personnels', 'Fiches de paie', 'Déposées par la direction chaque mois, à télécharger en PDF.'),
    d.fiches.length ? h('section', { class: 'eq-carte' }, Object.keys(parAn).sort().reverse().map((an) => [h('div', { class: 'eq-groupe-titre' }, an), h('div', { class: 'eq-liste' }, parAn[an].map(item))]))
      : h('section', { class: 'eq-carte' }, vide('paie', 'Aucune fiche pour le moment', 'Vos fiches de paie apparaîtront ici dès qu’elles seront déposées.')),
    h('p', { class: 'eq-note' }, ic('cadenas'), 'Vos fiches sont conservées dans un espace privé et chiffré en transit. Elles ne sont jamais accessibles sans votre connexion.'));
}

/* ----- Documents ----- */
async function pageDocuments() {
  const d = await api('documents');
  const auj = iso(new Date());
  const item = (doc) => {
    const recent = doc.source === 'agent' && (Date.now() + decalage - versDate(doc.ajoute)) < 86400000;
    return h('div', { class: 'eq-item' },
      h('div', { class: 'eq-item__ic' }, ic(doc.mime === 'application/pdf' ? 'documents' : 'photo')),
      h('div', { class: 'eq-item__corps' }, h('b', null, doc.nom), h('small', null, `${TYPES_DOCS[doc.type] || 'Document'} · ${frDate(doc.ajoute)} · ${taille(+doc.taille)}`)),
      h('div', { class: 'eq-item__fin' },
        h('a', { class: 'eq-icone-btn', href: lienFichier('document', doc.id, true), target: '_blank', rel: 'noopener', title: 'Voir', 'aria-label': 'Voir' }, ic('oeil')),
        h('a', { class: 'eq-icone-btn', href: lienFichier('document', doc.id), title: 'Télécharger', 'aria-label': 'Télécharger', style: 'color:var(--or-clair)' }, ic('telecharger')),
        recent ? h('button', { class: 'eq-icone-btn', type: 'button', title: 'Retirer', 'aria-label': 'Retirer', onclick: async () => {
          if (!confirm(`Retirer « ${doc.nom} » ?`)) return;
          try { await api('document.supprimer', { id: doc.id }); toast('Document retiré.'); recharger(); } catch (e) { toast(e.message, true); }
        } }, ic('poubelle')) : null));
  };
  const admin = d.documents.filter((x) => x.source !== 'agent');
  const miens = d.documents.filter((x) => x.source === 'agent');
  let carte = null;
  if (d.carte || d.validite) {
    const reste = d.validite ? Math.floor((versDate(d.validite) - versDate(auj)) / 86400000) : null;
    carte = h('section', { class: 'eq-carte eq-service', style: 'padding:1.3rem' },
      h('div', { class: 'eq-service__jour' }, 'Carte professionnelle'),
      h('div', { style: 'font-family:var(--titre);font-weight:800;font-size:1.4rem;margin:.3rem 0' }, d.carte || 'Numéro non renseigné'),
      d.validite ? h('div', { class: 'eq-service__site' }, reste < 0 ? pastille('non', 'Expirée') : reste <= 90 ? pastille('attente', `Expire dans ${reste} j`) : pastille('ok', 'Valide'), ` jusqu’au ${frDate(d.validite)}`) : null);
  }
  return h('div', null,
    enTete('Mon dossier', 'Mes documents', 'Contrat, carte pro CNAPS, attestations : tout votre dossier, toujours sur vous.',
      h('button', { class: 'eq-btn eq-btn--petit', type: 'button', onclick: () => formulaireDocument(d.limite) }, ic('envoyer'), 'Envoyer un document')),
    carte,
    h('section', { class: 'eq-carte' }, h('div', { class: 'eq-carte__tete' }, h('h2', null, ic('bouclier'), 'Remis par la direction')),
      admin.length ? h('div', { class: 'eq-liste' }, admin.map(item)) : vide('documents', 'Rien pour l’instant', 'Votre contrat et vos attestations apparaîtront ici.')),
    h('section', { class: 'eq-carte' }, h('div', { class: 'eq-carte__tete' }, h('h2', null, ic('envoyer'), 'Envoyés par vous')),
      miens.length ? h('div', { class: 'eq-liste' }, miens.map(item)) : vide('envoyer', 'Aucun envoi', 'Carte pro renouvelée, diplôme, RIB… envoyez-les ici en photo ou en PDF.')));
}
function formulaireDocument(limite) {
  let fichier = null;
  const types = h('select', { class: 'eq-input' }, DOCS_ENVOI.map((t) => h('option', { value: t }, TYPES_DOCS[t])));
  const nom = saisie({ placeholder: 'Facultatif — ex. Carte pro 2026', maxlength: 120 });
  const entree = h('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png,image/webp', capture: undefined, class: 'sr', onchange: async () => {
    fichier = entree.files[0] ? await compresser(entree.files[0]) : null;
    depot.querySelector('b').textContent = fichier ? fichier.name : 'Choisir un fichier';
    depot.querySelector('small').textContent = fichier ? taille(fichier.size) : 'PDF ou photo · 10 Mo maximum';
  } });
  const depot = h('label', { class: 'eq-depot' }, ic('envoyer'), h('span', null, h('b', null, 'Choisir un fichier'), h('small', null, 'PDF ou photo · 10 Mo maximum')), entree);
  const msg = h('p', { class: 'eq-erreur', role: 'alert' });
  const btn = h('button', { class: 'eq-btn eq-btn--plein', type: 'submit' }, 'Envoyer à la direction');
  const fermer = tiroir('Envoyer un document', h('form', { class: 'eq-form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = '';
    if (!fichier) { msg.textContent = 'Choisissez un fichier.'; return; }
    if (fichier.size > Math.min(limite || 1e9, 10 * 1048576)) { msg.textContent = 'Fichier trop lourd (10 Mo maximum).'; return; }
    btn.disabled = true; btn.textContent = 'Envoi…';
    const fd = new FormData();
    fd.append('type', types.value); fd.append('nom', nom.value.trim()); fd.append('fichier', fichier);
    try { await apiForm('document.envoyer', fd); fermer(); toast('Document envoyé à la direction.'); recharger(); } catch (err) { msg.textContent = err.message; btn.disabled = false; btn.textContent = 'Envoyer à la direction'; }
  } }, champ('Type de document', types), champ('Nom', nom), depot, msg, btn));
}

/* ----- Congés et absences ----- */
async function pageAbsences() {
  const d = await api('absences');
  const statut = { attente: ['attente', 'En attente'], acceptee: ['ok', 'Acceptée'], refusee: ['non', 'Refusée'], annulee: ['neutre', 'Annulée'] };
  const nbJ = (a) => Math.round((versDate(a.au) - versDate(a.du)) / 86400000) + 1;
  const item = (a) => h('div', { class: 'eq-item eq-item--colonne' },
    h('div', { class: 'eq-item__ic' }, ic(ABSENCES[a.type]?.[2] || 'absences')),
    h('div', { class: 'eq-item__corps' },
      h('b', null, ABSENCES[a.type]?.[0] || a.type),
      h('small', null, a.du === a.au ? `Le ${dateLongue(a.du)}` : `Du ${frDate(a.du)} au ${frDate(a.au)} · ${nbJ(a)} jours`),
      a.motif ? h('p', null, a.motif) : null,
      a.reponse ? h('div', { class: 'eq-reponse' }, h('b', null, 'Direction : '), a.reponse) : null,
      a.statut === 'attente' ? h('button', { class: 'eq-lien', type: 'button', style: 'margin-top:.5rem;font-size:.85rem', onclick: async () => {
        if (!confirm('Annuler cette demande ?')) return;
        try { await api('absence.annuler', { id: a.id }); toast('Demande annulée.'); recharger(); } catch (e) { toast(e.message, true); }
      } }, 'Annuler la demande') : null),
    pastille(...statut[a.statut]));
  const attente = d.absences.filter((a) => a.statut === 'attente');
  const autres = d.absences.filter((a) => a.statut !== 'attente');
  const posesAn = d.absences.filter((a) => a.type === 'conges' && a.statut === 'acceptee' && a.du.startsWith(String(new Date().getFullYear()))).reduce((s, a) => s + nbJ(a), 0);
  return h('div', null,
    enTete('Mes demandes', 'Congés & absences', 'Faites votre demande ici : la direction vous répond dans l’espace et par email.',
      h('button', { class: 'eq-btn eq-btn--petit', type: 'button', onclick: formulaireAbsence }, ic('plus'), 'Nouvelle demande')),
    h('div', { class: 'eq-stats', style: 'margin-bottom:1rem' },
      h('div', { class: 'eq-stat' }, h('span', null, 'En attente'), h('b', null, attente.length)),
      h('div', { class: 'eq-stat' }, h('span', null, `Congés acceptés ${new Date().getFullYear()}`), h('b', null, posesAn, h('small', null, ' j'))),
      h('div', { class: 'eq-stat' }, h('span', null, 'Total demandes'), h('b', null, d.absences.length))),
    d.absences.length ? h('section', { class: 'eq-carte' },
      attente.length ? [h('div', { class: 'eq-groupe-titre' }, 'En attente de réponse'), h('div', { class: 'eq-liste' }, attente.map(item))] : null,
      autres.length ? [h('div', { class: 'eq-groupe-titre' }, 'Historique'), h('div', { class: 'eq-liste' }, autres.map(item))] : null)
      : h('section', { class: 'eq-carte' }, vide('absences', 'Aucune demande', 'Besoin d’un jour ? Appuyez sur « Nouvelle demande ».')),
    h('p', { class: 'eq-note' }, ic('info'), 'Pour un imprévu le jour même, appelez aussi la direction au 06 11 67 86 25.'));
}
function formulaireAbsence() {
  const demain = iso(new Date(Date.now() + 86400000));
  const types = choix('type', ABSENCES, 'conges');
  const du = saisie({ type: 'date', value: demain });
  const au = saisie({ type: 'date', value: demain });
  du.addEventListener('change', () => { if (!au.value || au.value < du.value) au.value = du.value; });
  const motif = h('textarea', { class: 'eq-input', rows: 3, maxlength: 600, placeholder: 'Facultatif — un mot pour la direction' });
  let justif = null;
  const entree = h('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png,image/webp', class: 'sr', onchange: async () => {
    justif = entree.files[0] ? await compresser(entree.files[0]) : null;
    depot.querySelector('b').textContent = justif ? justif.name : 'Ajouter un justificatif';
  } });
  const depot = h('label', { class: 'eq-depot' }, ic('envoyer'), h('span', null, h('b', null, 'Ajouter un justificatif'), h('small', null, 'Arrêt de travail, convocation… (facultatif)')), entree);
  const msg = h('p', { class: 'eq-erreur', role: 'alert' });
  const btn = h('button', { class: 'eq-btn eq-btn--plein', type: 'submit' }, 'Envoyer ma demande');
  const fermer = tiroir('Nouvelle demande', h('form', { class: 'eq-form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = '';
    const type = valeurChoix(types, 'type');
    if (!du.value) { msg.textContent = 'Indiquez la date de début.'; return; }
    if (au.value && au.value < du.value) { msg.textContent = 'La date de fin est avant la date de début.'; return; }
    btn.disabled = true; btn.textContent = 'Envoi…';
    const fd = new FormData();
    fd.append('type', type); fd.append('du', du.value); fd.append('au', au.value || du.value); fd.append('motif', motif.value.trim());
    if (justif) fd.append('justificatif', justif);
    try { await apiForm('absence.demander', fd); fermer(); toast('Demande envoyée à la direction.'); if (location.hash !== '#/absences') location.hash = '#/absences'; else recharger(); }
    catch (err) { msg.textContent = err.message; btn.disabled = false; btn.textContent = 'Envoyer ma demande'; }
  } }, h('div', { class: 'eq-champ' }, h('span', null, 'Type de demande'), types), h('div', { class: 'eq-grille-2' }, champ('Du', du), champ('Au (inclus)', au)), champ('Message', motif), depot, msg, btn));
}

/* ----- Main courante ----- */
async function pageMainCourante() {
  const d = await api('main_courante');
  const statut = { nouveau: ['attente', 'Transmis'], lu: ['info', 'Lu par la direction'], traite: ['ok', 'Traité'] };
  const grav = { info: ['info', 'Info'], normale: ['neutre', 'Normal'], urgente: ['non', 'Urgent'] };
  const item = (m) => h('div', { class: 'eq-item eq-item--colonne' },
    h('div', { class: 'eq-item__ic', style: m.gravite === 'urgente' ? 'background:rgba(236,107,97,.14);color:#ff9d94' : '' }, ic(INCIDENTS[m.categorie]?.[1] || 'mc')),
    h('div', { class: 'eq-item__corps' },
      h('b', null, INCIDENTS[m.categorie]?.[0] || m.categorie),
      h('small', null, [`${frDate(m.quand)} à ${frHeure(m.quand)}`, m.site].filter(Boolean).join(' · ')),
      h('p', null, m.texte),
      +m.photos ? h('div', { class: 'eq-photos', style: 'margin-top:.6rem;max-width:360px' }, Array.from({ length: +m.photos }, (_, n) =>
        h('a', { class: 'eq-photo', href: `${API}?a=photo&id=${m.id}&n=${n}`, target: '_blank', rel: 'noopener' }, h('img', { src: `${API}?a=photo&id=${m.id}&n=${n}`, alt: `Photo ${n + 1}`, loading: 'lazy' })))) : null,
      m.commentaire ? h('div', { class: 'eq-reponse' }, h('b', null, 'Direction : '), m.commentaire) : null,
      h('div', { style: 'display:flex;gap:.4rem;margin-top:.6rem;flex-wrap:wrap' }, pastille(...grav[m.gravite]), pastille(...statut[m.statut]))));
  return h('div', null,
    enTete('Registre', 'Main courante', 'Consignez chaque événement sur site : il est horodaté et transmis immédiatement à la direction.',
      h('button', { class: 'eq-btn eq-btn--petit', type: 'button', onclick: () => formulaireIncident(d.siteDuJour) }, ic('plus'), 'Signaler un événement')),
    d.entrees.length ? h('section', { class: 'eq-carte' }, h('div', { class: 'eq-liste' }, d.entrees.map(item)))
      : h('section', { class: 'eq-carte' }, vide('mc', 'Aucun événement signalé', 'Intrusion, alarme, ronde, problème technique… tout se note ici, même sans gravité.')),
    h('p', { class: 'eq-note' }, ic('cadenas'), 'Une fois envoyé, un signalement ne peut plus être modifié : il a valeur de main courante.'));
}
async function formulaireIncident(siteConnu) {
  if (siteConnu === undefined) { try { siteConnu = (await api('main_courante')).siteDuJour; } catch (e) { siteConnu = ''; } }
  const maintenant = new Date(Date.now() + decalage);
  const TYPES = [['intrusion', 'Intrusion'], ['agression', 'Agression'], ['vol', 'Vol, dégradation'], ['incendie', 'Incendie, alarme'], ['secours', 'Secours à personne'], ['technique', 'Problème technique'], ['ronde', 'Ronde, contrôle'], ['autre', 'Autre']];
  let cat = '';
  const puces = h('div', { class: 'ap-puces', role: 'radiogroup', 'aria-label': 'Type d’événement' }, TYPES.map(([k, l]) => h('button', {
    type: 'button', class: 'ap-puce', role: 'radio', 'aria-checked': 'false',
    onclick: (e) => { cat = k; puces.querySelectorAll('.ap-puce').forEach((b) => b.setAttribute('aria-checked', String(b === e.currentTarget))); vibrer(6); msg.textContent = ''; } }, l)));
  const texte = h('textarea', { class: 'ap-zone', rows: 4, maxlength: 5000, placeholder: 'Que s’est-il passé ?', 'aria-label': 'Que s’est-il passé ?' });
  const quand = saisie({ type: 'datetime-local', value: `${iso(maintenant)}T${pad(maintenant.getHours())}:${pad(maintenant.getMinutes())}`, max: `${iso(maintenant)}T23:59` });
  const site = saisie({ value: siteConnu || '', placeholder: 'Nom du site ou adresse', maxlength: 120 });
  const photos = [];
  const vignettes = h('div', { class: 'ap-vignettes' });
  const nbPhotos = h('span', null, '');
  const entree = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'sr', onchange: async () => {
    for (const f of [...entree.files].slice(0, 4 - photos.length)) photos.push(await compresser(f));
    entree.value = '';
    dessinerPhotos();
  } });
  const dessinerPhotos = () => {
    nbPhotos.textContent = photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : '4 au plus';
    vignettes.replaceChildren(...photos.map((f, i) => {
      const url = URL.createObjectURL(f);
      return h('div', { class: 'ap-vignette' }, h('img', { src: url, alt: '', onload: () => URL.revokeObjectURL(url) }), h('button', { type: 'button', 'aria-label': 'Retirer la photo', onclick: () => { photos.splice(i, 1); dessinerPhotos(); } }, ic('croix')));
    }));
  };
  dessinerPhotos();
  const urgent = h('button', { type: 'button', class: 'ap-interrupteur', role: 'switch', 'aria-checked': 'false', 'aria-label': 'Urgent', onclick: () => { urgent.setAttribute('aria-checked', String(urgent.getAttribute('aria-checked') !== 'true')); vibrer(10); } });
  const msg = h('p', { class: 'ap-erreur-texte', role: 'alert' });
  const btn = h('button', { class: 'ap-btn', type: 'submit' }, 'Envoyer à la direction');
  const fermer = tiroir('Signaler', h('form', { class: 'ap-signaler', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = '';
    const g = urgent.getAttribute('aria-checked') === 'true' ? 'urgente' : 'normale';
    if (!cat) { msg.textContent = 'Choisissez le type d’événement.'; puces.classList.remove('is-secoue'); void puces.offsetWidth; puces.classList.add('is-secoue'); vibrer(30); return; }
    if (texte.value.trim().length < 10) { msg.textContent = 'Décrivez ce qui s’est passé (10 caractères minimum).'; texte.focus(); return; }
    if (g === 'urgente' && !confirm('Événement URGENT : la direction est alertée immédiatement. En cas de danger, appelez d’abord le 17, le 18 ou le 112. Envoyer ?')) return;
    btn.disabled = true; btn.textContent = 'Envoi…';
    const fd = new FormData();
    fd.append('categorie', cat); fd.append('gravite', g); fd.append('quand', quand.value); fd.append('site', site.value.trim()); fd.append('texte', texte.value.trim());
    photos.forEach((p) => fd.append('photos[]', p));
    try {
      await apiForm('incident.signaler', fd);
      vibrer([20, 40, 20]);
      fermer();
      toast('Événement transmis à la direction.');
      if (location.hash === '#/main-courante') recharger();
    } catch (err) { msg.textContent = err.message; btn.disabled = false; btn.textContent = 'Envoyer à la direction'; }
  } },
    puces,
    texte,
    h('div', { class: 'ap-options' },
      h('label', { class: 'ap-option' }, h('span', null, 'Ajouter une photo'), nbPhotos, entree),
      vignettes,
      h('div', { class: 'ap-option' }, h('span', null, 'Urgent'), urgent),
      h('details', { class: 'ap-details' }, h('summary', { class: 'ap-option' }, h('span', null, 'Date, heure et lieu'), h('span', null, `${pad(maintenant.getHours())}h${pad(maintenant.getMinutes())}${site.value ? ` · ${site.value}` : ''}`)),
        h('div', { class: 'ap-details__corps' }, champ('Date et heure', quand), champ('Site', site)))),
    msg, btn,
    h('p', { class: 'ap-aide' }, 'Danger immédiat : appelez d’abord le ', h('a', { href: 'tel:17' }, '17'), ', le ', h('a', { href: 'tel:18' }, '18'), ' ou le ', h('a', { href: 'tel:112' }, '112'), '.')),
  { sur: `${(siteConnu || 'ÉVÉNEMENT').toUpperCase()} · ${pad(maintenant.getHours())}H${pad(maintenant.getMinutes())}` });
}

/* ----- Courses VTC ----- */
function carteCourse(c) {
  const dt = versDate(c.quand);
  const dest = c.mode === 'dispo' ? c.depart : c.arrivee;
  const statut = { attente: ['attente', 'À confirmer'], confirmee: ['ok', 'Confirmée'], terminee: ['neutre', 'Terminée'] }[c.statut] || ['neutre', c.statut];
  return h('div', { class: 'eq-course' },
    h('div', { class: 'eq-course__quand' }, h('b', null, `${JOURS_COURTS[dt.getDay()]} ${dt.getDate()} ${MOIS[dt.getMonth()]} · ${pad(dt.getHours())}h${pad(dt.getMinutes())}`), pastille(...statut)),
    h('div', { class: 'eq-trajet' }, h('div', null, c.depart || '—'), c.mode === 'dispo' ? h('div', null, `Mise à disposition ${c.heures} h`) : h('div', null, c.arrivee || '—')),
    h('div', { class: 'eq-course__infos' }, pastille('neutre', `${c.passagers} pers.`), +c.bagages ? pastille('neutre', `${c.bagages} bagage${c.bagages > 1 ? 's' : ''}`) : null,
      c.vol ? pastille('info', `vol ${c.vol}`) : null, c.pancarte ? pastille('info', 'pancarte') : null, +c.sieges ? pastille('attente', `${c.sieges} siège(s) enfant`) : null, c.vehicule ? pastille('neutre', c.vehicule) : null),
    c.message || c.note ? h('div', { class: 'eq-reponse' }, [c.message, c.note].filter(Boolean).join(' — ')) : null,
    h('div', { class: 'eq-course__actions' },
      c.tel ? h('a', { class: 'eq-btn eq-btn--petit eq-btn--ghost', href: `tel:${c.tel.replace(/[^\d+]/g, '')}` }, ic('telephone'), c.client || 'Client') : null,
      c.depart ? h('a', { class: 'eq-btn eq-btn--petit eq-btn--ghost', href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.depart)}`, target: '_blank', rel: 'noopener' }, ic('pin'), 'Prise en charge') : null,
      dest && c.mode !== 'dispo' ? h('a', { class: 'eq-btn eq-btn--petit eq-btn--ghost', href: `https://waze.com/ul?q=${encodeURIComponent(dest)}&navigate=yes`, target: '_blank', rel: 'noopener' }, ic('voiture'), 'Waze') : null));
}
async function pageCourses() {
  const d = await api('courses');
  return h('div', null,
    enTete('Chauffeur', 'Mes courses', 'Les courses que la direction vous a confiées.'),
    h('section', { class: 'eq-carte' }, h('div', { class: 'eq-carte__tete' }, h('h2', null, ic('voiture'), 'À venir')),
      d.aVenir.length ? h('div', { class: 'eq-liste' }, d.aVenir.map(carteCourse)) : vide('voiture', 'Aucune course prévue', 'Les nouvelles courses apparaîtront ici dès qu’elles vous seront attribuées.')),
    d.passees.length ? h('section', { class: 'eq-carte' }, h('div', { class: 'eq-carte__tete' }, h('h2', null, ic('horloge'), '45 derniers jours')), h('div', { class: 'eq-liste' }, d.passees.slice(0, 30).map(carteCourse))) : null);
}

/* ----- Profil ----- */
async function pageProfil() {
  const d = await api('profil');
  const p = d.profil || {};
  const c = d.compte;
  moi.nom = c.nom;
  const email = saisie({ type: 'email', value: c.email, autocomplete: 'email' });
  const tel = saisie({ type: 'tel', value: c.tel, autocomplete: 'tel' });
  const adresse = saisie({ value: p.adresse || '', autocomplete: 'street-address', placeholder: 'N° et rue' });
  const ville = saisie({ value: p.ville || '', autocomplete: 'address-level2', placeholder: 'Ville' });
  const uNom = saisie({ value: p.urgenceNom || '', placeholder: 'Nom et lien (ex. Sarah, épouse)' });
  const uTel = saisie({ type: 'tel', value: p.urgenceTel || '', placeholder: '06…' });
  const zone = saisie({ value: p.zone || '', placeholder: 'Ex. Paris, 92, 93 — jusqu’à 45 min' });
  const note = h('textarea', { class: 'eq-input', rows: 3, maxlength: 600, placeholder: 'Ex. disponible en extra le week-end, pas de nuits le mardi…' }, p.note || '');
  const jours = [['lun', 'Lundi'], ['mar', 'Mardi'], ['mer', 'Mercredi'], ['jeu', 'Jeudi'], ['ven', 'Vendredi'], ['sam', 'Samedi'], ['dim', 'Dimanche']];
  const dispos = p.dispos || {};
  const grille = h('div', { class: 'eq-dispos' }, h('span'), h('span', { class: 'eq-dispos-tete' }, 'Jour'), h('span', { class: 'eq-dispos-tete' }, 'Nuit'),
    jours.map(([k, l]) => [h('b', null, l), ...['jour', 'nuit'].map((m) => h('label', { class: 'eq-bascule' }, h('input', { type: 'checkbox', 'data-j': k, 'data-m': m, checked: (dispos[k] || []).includes(m) }), h('span', null, ic(m === 'jour' ? 'soleil' : 'lune'), m === 'jour' ? 'Jour' : 'Nuit')))]));
  const toutCocher = h('button', { class: 'eq-lien', type: 'button', style: 'font-size:.85rem', onclick: () => { const cases = grille.querySelectorAll('input'); const tout = [...cases].every((x) => x.checked); cases.forEach((x) => { x.checked = !tout; }); } }, 'Tout / rien');
  const comp = h('div', { class: 'eq-puces' }, COMPETENCES.map((x) => h('label', null, h('input', { type: 'checkbox', value: x, checked: (p.competences || []).includes(x) }), h('span', null, x))));
  const permis = h('input', { type: 'checkbox', checked: !!p.permis });
  const vehicule = h('input', { type: 'checkbox', checked: !!p.vehicule });
  const msg = h('p', { class: 'eq-erreur', role: 'alert' });
  const btn = h('button', { class: 'eq-btn', type: 'submit' }, ic('coche'), 'Enregistrer');
  const form = h('form', { class: 'eq-form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = ''; btn.disabled = true;
    const ds = {};
    grille.querySelectorAll('input:checked').forEach((x) => (ds[x.dataset.j] ||= []).push(x.dataset.m));
    try {
      await api('profil.enregistrer', { email: email.value.trim(), tel: tel.value.trim(), adresse: adresse.value.trim(), ville: ville.value.trim(), urgenceNom: uNom.value.trim(), urgenceTel: uTel.value.trim(),
        zone: zone.value.trim(), note: note.value.trim(), dispos: ds, permis: permis.checked, vehicule: vehicule.checked, competences: [...comp.querySelectorAll('input:checked')].map((x) => x.value) });
      toast('Profil enregistré.');
    } catch (err) { msg.textContent = err.message; }
    btn.disabled = false;
  } },
    h('section', { class: 'eq-carte' }, h('div', { class: 'eq-carte__tete' }, h('h2', null, ic('telephone'), 'Coordonnées')),
      h('div', { class: 'eq-form' }, h('div', { class: 'eq-grille-2' }, champ('Email', email), champ('Téléphone', tel)), h('div', { class: 'eq-grille-2' }, champ('Adresse', adresse), champ('Ville', ville)),
        h('div', { class: 'eq-grille-2' }, champ('Contact en cas d’urgence', uNom), champ('Son téléphone', uTel)))),
    h('section', { class: 'eq-carte' }, h('div', { class: 'eq-carte__tete' }, h('h2', null, ic('planning'), 'Mes disponibilités'), toutCocher),
      grille, h('div', { class: 'eq-form eq-mt' }, champ('Zone où je peux travailler', zone),
        h('div', { style: 'display:flex;gap:1.4rem;flex-wrap:wrap' }, h('label', { class: 'eq-case' }, permis, 'Permis B'), h('label', { class: 'eq-case' }, vehicule, 'Véhiculé')), champ('Précisions', note))),
    h('section', { class: 'eq-carte' }, h('div', { class: 'eq-carte__tete' }, h('h2', null, ic('bouclier'), 'Mes qualifications')), comp),
    msg, h('div', null, btn));

  // Sécurité : mot de passe et appareils
  const actuel = champMdp({ autocomplete: 'current-password' });
  const nouveau = champMdp({ autocomplete: 'new-password' });
  const regles = reglesMdp(nouveau.input);
  const msgMdp = h('p', { class: 'eq-erreur', role: 'alert' });
  const formMdp = h('form', { class: 'eq-form', onsubmit: async (e) => {
    e.preventDefault(); msgMdp.textContent = '';
    if (!regles.valide()) { msgMdp.textContent = 'Le nouveau mot de passe ne respecte pas encore toutes les règles.'; return; }
    try { await api('motdepasse', { actuel: actuel.input.value, nouveau: nouveau.input.value }); toast('Mot de passe changé. Vos autres appareils sont déconnectés.'); actuel.input.value = nouveau.input.value = ''; } catch (err) { msgMdp.textContent = err.message; }
  } }, h('div', { class: 'eq-grille-2' }, champ('Mot de passe actuel', actuel.bloc), champ('Nouveau mot de passe', nouveau.bloc)), regles.liste, msgMdp, h('div', null, h('button', { class: 'eq-btn eq-btn--ghost eq-btn--petit', type: 'submit' }, 'Changer le mot de passe')));
  const appareils = h('div', { class: 'eq-liste' }, d.appareils.length ? d.appareils.map((a) => h('div', { class: 'eq-item' },
    h('div', { class: 'eq-item__ic' }, ic('appareil')),
    h('div', { class: 'eq-item__corps' }, h('b', null, a.appareil || 'Appareil'), h('small', null, `Ajouté le ${frDate(a.cree)} · vu le ${frDate(a.vu)}`)),
    a.actuel ? pastille('ok', 'Cet appareil') : h('button', { class: 'eq-btn eq-btn--ghost eq-btn--petit', type: 'button', onclick: async () => { try { await api('appareil.retirer', { id: a.id }); toast('Appareil retiré.'); recharger(); } catch (e) { toast(e.message, true); } } }, 'Retirer')))
    : [h('p', { class: 'eq-note', style: 'margin:0' }, ic('info'), 'Aucun appareil mémorisé.')]);

  return h('div', null,
    h('section', { class: 'eq-carte eq-service', style: 'margin-bottom:1rem' },
      h('div', { class: 'eq-profil-tete' }, h('span', { class: 'eq-avatar eq-avatar--grand' }, initiales(c.prenom, c.nom)),
        h('div', null, h('h2', null, `${c.prenom} ${c.nom}`), h('p', null, `${METIERS[c.metier]?.[0] || ''} · identifiant `, h('b', { style: 'color:var(--or-clair)' }, c.identifiant)), h('p', { style: 'font-size:.82rem' }, `Membre depuis le ${frDate(c.cree)}`))),
      h('div', { class: 'eq-infos eq-mt' },
        h('div', { class: 'eq-info' }, h('span', null, 'Poste'), h('b', null, d.agent.poste || '—')),
        h('div', { class: 'eq-info' }, h('span', null, 'Carte professionnelle'), h('b', null, d.agent.carte || '—')),
        h('div', { class: 'eq-info' }, h('span', null, 'Valable jusqu’au'), h('b', null, d.agent.validite ? frDate(d.agent.validite) : '—')))),
    form,
    h('section', { class: 'eq-carte eq-mt2' }, h('div', { class: 'eq-carte__tete' }, h('h2', null, ic('cadenas'), 'Sécurité')), formMdp,
      h('div', { class: 'eq-groupe-titre', style: 'margin-top:1.6rem' }, 'Appareils connectés'), appareils),
    h('div', { class: 'eq-mt2' }, h('button', { class: 'eq-btn eq-btn--ghost', type: 'button', onclick: deconnexion }, ic('sortie'), 'Se déconnecter')));
}

demarrer();
