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
};
const METIERS = {
  securite: ['Agent de sécurité', 'Surveillance, filtrage, rondes', 'bouclier'],
  ssiap: ['Agent SSIAP', 'Sécurité incendie, ERP, IGH', 'feu'],
  chauffeur: ['Chauffeur VTC', 'Transferts, mise à disposition', 'voiture'],
};
const CODES = { R: 'Repos', CP: 'Congés payés', M: 'Maladie', AT: 'Accident du travail', F: 'Formation', ABS: 'Absence' };
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
function tiroir(titre, contenu) {
  const fermer = () => { voile.remove(); document.removeEventListener('keydown', echap); document.body.style.overflow = ''; };
  const echap = (e) => { if (e.key === 'Escape') fermer(); };
  const voile = h('div', { class: 'eq-voile', onclick: (e) => { if (e.target === voile) fermer(); } },
    h('div', { class: 'eq-tiroir', role: 'dialog', 'aria-modal': 'true', 'aria-label': titre },
      h('div', { class: 'eq-tiroir__tete' }, h('h2', null, titre), h('button', { class: 'eq-icone-btn', type: 'button', 'aria-label': 'Fermer', onclick: () => fermer() }, ic('croix'))),
      contenu));
  document.body.append(voile);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', echap);
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
  if (location.hash === '#inscription') return ecranInscription();
  if (!s.connecte) return ecranConnexion();
  moi = { prenom: s.prenom, nom: s.nom, metier: s.metier };
  ouvrirApplication();
}

/* ---------- Connexion, création de compte ---------- */
function carteAuth(titre, texte, ...contenu) {
  document.body.classList.remove('eq--app');
  clearInterval(minuteur);
  const page = h('main', { class: 'eq-auth' },
    h('section', { class: 'eq-auth__visuel', 'aria-hidden': 'true' },
      h('div', { class: 'eq-auth__halo' }),
      h('div', { class: 'eq-auth__haut' }, h('span', { class: 'eq-surtitre' }, 'Espace réservé · Équipe BDA')),
      h('img', { class: 'eq-auth__embleme', src: '/assets/img/embleme-hd.png?v=3', alt: '' }),
      h('div', { class: 'eq-auth__bas' },
        h('h2', null, 'Votre quotidien d’agent, ', h('span', { class: 'eq-or-texte' }, 'au même endroit.')),
        h('p', null, 'Planning, fiches de paie, documents, congés et main courante. Simple, rapide, sécurisé.'),
        h('div', { class: 'eq-auth__puces' }, [['planning', 'Planning en direct'], ['cadenas', 'Fiches de paie protégées'], ['mc', 'Main courante'], ['absences', 'Congés en 2 clics']].map(([i, t]) => h('span', null, ic(i), t))))),
    anim(h('section', { class: 'eq-auth__carte' },
      h('a', { class: 'eq-marque', href: '/' }, h('img', { src: '/assets/img/embleme.png?v=3', alt: '', width: 44, height: 45 }), h('span', null, h('b', null, 'BDA SECURITY GROUP'), h('small', null, 'Espace équipe'))),
      titre ? h('h1', null, titre) : null,
      texte ? h('p', { class: 'eq-auth__texte' }, texte) : null,
      ...contenu,
      h('p', { class: 'eq-auth__aide' }, 'Un souci ? Appelez la direction au ', h('a', { href: 'tel:+33611678625' }, '06 11 67 86 25'), ' · ', h('a', { href: '/' }, 'Retour au site')))));
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
  carteAuth('Connexion', 'Connectez-vous avec l’identifiant que vous avez choisi.', form,
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
const PAGES = {
  '': { titre: 'Accueil', icone: 'accueil', rendu: pageAccueil },
  planning: { titre: 'Planning', icone: 'planning', rendu: pagePlanning },
  'main-courante': { titre: 'Main courante', icone: 'mc', rendu: pageMainCourante },
  courses: { titre: 'Mes courses', icone: 'voiture', rendu: pageCourses, chauffeur: true },
  paie: { titre: 'Fiches de paie', icone: 'paie', rendu: pagePaie, badge: 'fichesNonVues' },
  absences: { titre: 'Congés & absences', icone: 'absences', rendu: pageAbsences, badge: 'absencesAttente' },
  documents: { titre: 'Mes documents', icone: 'documents', rendu: pageDocuments },
  profil: { titre: 'Mon profil', icone: 'profil', rendu: pageProfil },
};
const pagesVisibles = () => Object.entries(PAGES).filter(([, p]) => !p.chauffeur || moi.metier === 'chauffeur');
let principal = null;
function ouvrirApplication() {
  document.body.classList.add('eq--app');
  const badge = (k) => (compteurs[k] ? h('i', { class: 'eq-badge' }, compteurs[k]) : null);
  const nav = h('nav', { class: 'eq-nav', 'aria-label': 'Menu' });
  const onglets = h('nav', { class: 'eq-onglets', 'aria-label': 'Menu' });
  const avatar = h('a', { class: 'eq-avatar', href: '#/profil', 'aria-label': 'Mon profil' });
  const moiCote = h('a', { class: 'eq-moi', href: '#/profil' });
  principal = h('main', { class: 'eq-principal', id: 'contenu' });
  const dessinerMenus = () => {
    const route = (location.hash.replace(/^#\/?/, '').split('?')[0]);
    nav.replaceChildren(...pagesVisibles().map(([r, p]) => h('a', { href: `#/${r}`, class: r === route ? 'is-actif' : '' }, ic(p.icone), p.titre, p.badge ? badge(p.badge) : null)));
    const plusBadge = (compteurs.fichesNonVues || 0) + (compteurs.absencesAttente || 0);
    onglets.replaceChildren(
      h('a', { href: '#/', class: route === '' ? 'is-actif' : '' }, ic('accueil'), 'Accueil'),
      h('a', { href: '#/planning', class: route === 'planning' ? 'is-actif' : '' }, ic('planning'), 'Planning'),
      h('button', { class: 'eq-onglet-plus', type: 'button', onclick: () => formulaireIncident(), 'aria-label': 'Signaler un événement' }, h('span', { class: 'eq-rond' }, ic('plus')), 'Signaler'),
      moi.metier === 'chauffeur'
        ? h('a', { href: '#/courses', class: route === 'courses' ? 'is-actif' : '' }, ic('voiture'), 'Courses')
        : h('a', { href: '#/paie', class: route === 'paie' ? 'is-actif' : '' }, ic('paie'), 'Paie', badge('fichesNonVues')),
      h('button', { type: 'button', class: ['absences', 'documents', 'profil', 'main-courante', moi.metier === 'chauffeur' ? 'paie' : ''].includes(route) ? 'is-actif' : '', onclick: menuPlus }, ic('menu'), 'Plus', plusBadge ? h('i', { class: 'eq-badge' }, plusBadge) : null));
    const ini = initiales(moi.prenom, moi.nom);
    avatar.textContent = ini;
    moiCote.replaceChildren(h('span', { class: 'eq-avatar' }, ini), h('span', null, h('b', null, `${moi.prenom} ${moi.nom || ''}`.trim()), h('small', null, METIERS[moi.metier]?.[0] || 'Mon profil')));
  };
  racine.replaceChildren(h('div', { class: 'eq-app' },
    h('aside', { class: 'eq-cote' },
      h('a', { class: 'eq-marque', href: '#/' }, h('img', { src: '/assets/img/embleme.png?v=3', alt: '', width: 44, height: 45 }), h('span', null, h('b', null, 'BDA SECURITY GROUP'), h('small', null, 'Espace équipe'))),
      nav,
      h('div', { class: 'eq-cote__bas' }, moiCote, h('button', { class: 'eq-btn eq-btn--ghost eq-btn--petit', type: 'button', onclick: deconnexion }, ic('sortie'), 'Se déconnecter'))),
    h('div', null,
      h('header', { class: 'eq-entete' },
        h('a', { class: 'eq-marque', href: '#/' }, h('img', { src: '/assets/img/embleme.png?v=3', alt: '', width: 34, height: 35 }), h('span', null, h('b', null, 'BDA'), h('small', null, 'Équipe'))),
        avatar),
      principal),
    onglets));
  ouvrirApplication.menus = dessinerMenus;
  window.onhashchange = naviguer;
  naviguer();
}
function menuPlus() {
  const lien = (r) => { const p = PAGES[r]; return h('a', { href: `#/${r}`, onclick: () => fermer() }, ic(p.icone), p.titre, p.badge && compteurs[p.badge] ? h('i', { class: 'eq-badge' }, compteurs[p.badge]) : null); };
  const routes = ['main-courante', 'absences', 'documents', moi.metier === 'chauffeur' ? 'paie' : null, 'profil'].filter(Boolean);
  const fermer = tiroir('Plus', h('div', { class: 'eq-menu-plus' }, routes.map(lien),
    h('button', { type: 'button', class: 'is-rouge', onclick: () => { fermer(); deconnexion(); } }, ic('sortie'), 'Se déconnecter')));
}
async function deconnexion() {
  try { await api('deconnexion', {}); } catch (e) { /* déjà déconnecté */ }
  moi = { prenom: '', metier: '' };
  history.replaceState(null, '', location.pathname);
  ecranConnexion();
}
async function naviguer() {
  if (!document.body.classList.contains('eq--app')) return;
  clearInterval(minuteur);
  const route = location.hash.replace(/^#\/?/, '').split('?')[0];
  const page = PAGES[route] && (!PAGES[route].chauffeur || moi.metier === 'chauffeur') ? PAGES[route] : PAGES[''];
  document.title = `${page.titre} | Espace équipe BDA`;
  ouvrirApplication.menus?.();
  principal.replaceChildren(h('div', { class: 'eq-squelette' }), h('div', { class: 'eq-squelette' }));
  window.scrollTo(0, 0);
  try {
    const contenu = await page.rendu();
    if (location.hash.replace(/^#\/?/, '').split('?')[0] !== route) return;
    principal.replaceChildren(anim(contenu));
  } catch (e) {
    if (e.message !== 'Connexion requise.') principal.replaceChildren(vide('alerte', 'Impossible de charger cette page', e.message));
  }
}
const recharger = () => naviguer();
const enTete = (surtitre, titre, texte, ...actions) => h('div', { class: 'eq-titre' }, h('div', null, surtitre ? h('div', { class: 'eq-surtitre' }, surtitre) : null, h('h1', null, titre), texte ? h('p', null, texte) : null), actions.length ? h('div', { style: 'display:flex;gap:.5rem;flex-wrap:wrap' }, actions) : null);

/* ----- Accueil ----- */
async function pageAccueil() {
  const d = await api('accueil');
  Object.assign(moi, { prenom: d.moi.prenom, nom: d.moi.nom, metier: d.moi.metier });
  compteurs = { fichesNonVues: d.fichesNonVues, absencesAttente: d.absencesAttente };
  ouvrirApplication.menus?.();
  decalage = versDate(d.serveur) - Date.now();
  const auj = d.prochains[0];
  const c = lireCreneau(auj.creneau);
  const heure = new Date().getHours();
  const salut = heure < 5 || heure >= 18 ? 'Bonsoir' : 'Bonjour';

  // Service du jour + pointage
  const chrono = h('span', { class: 'eq-chrono' }, h('i'), h('span'));
  const majChrono = () => { if (d.enCours) chrono.lastChild.textContent = (() => { const s = Math.max(0, Math.floor((Date.now() + decalage - versDate(d.enCours.debut)) / 1000)); return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; })(); };
  const btnPointer = h('button', { class: `eq-btn ${d.enCours ? 'eq-btn--rouge' : ''}`, type: 'button', onclick: async () => {
    if (d.enCours && !confirm('Terminer votre service maintenant ?')) return;
    btnPointer.disabled = true;
    btnPointer.lastChild.textContent = 'Localisation…';
    try {
      const pos = await position();
      const r = await api(d.enCours ? 'pointer.fin' : 'pointer.debut', pos);
      toast(d.enCours ? `Fin de service enregistrée (${fmtMin(r.minutes)}). Bon repos !` : 'Prise de service enregistrée. Bon courage !');
      recharger();
    } catch (e) { toast(e.message, true); btnPointer.disabled = false; btnPointer.lastChild.textContent = d.enCours ? 'Terminer mon service' : 'Prendre mon service'; }
  } }, ic(d.enCours ? 'stop' : 'jouer'), h('span', null, d.enCours ? 'Terminer mon service' : 'Prendre mon service'));
  if (d.enCours) { majChrono(); minuteur = setInterval(majChrono, 1000); }
  const service = h('section', { class: 'eq-carte eq-service' },
    h('div', { class: 'eq-service__jour' }, `Aujourd’hui · ${dateLongue(auj.jour)}`),
    h('div', { class: 'eq-service__creneau' }, d.enCours ? 'En service' : !c ? 'Pas de service prévu' : c.code ? (CODES[c.code] || c.code) : h('span', { class: 'eq-or-texte' }, String(auj.creneau).replace(/\s+/g, ''))),
    d.enCours ? h('div', { class: 'eq-service__site' }, chrono, h('span', null, `depuis ${frHeure(d.enCours.debut)}${d.enCours.site ? ` · ${d.enCours.site}` : ''}`))
      : (auj.site && c && !c.code) ? h('div', { class: 'eq-service__site' }, ic('pin'), auj.site, c.min ? ` · ${fmtMin(c.min)}` : '') : h('div', { class: 'eq-service__site' }, c?.code ? 'Profitez-en.' : 'Consultez votre planning pour les prochains jours.'),
    h('div', { class: 'eq-service__actions' }, btnPointer, h('button', { class: 'eq-btn eq-btn--ghost', type: 'button', onclick: () => formulaireIncident() }, ic('mc'), 'Signaler')));

  // Prochain service
  const prochain = d.prochains.slice(1).find((j) => { const x = lireCreneau(j.creneau); return x && !x.code; });
  const stats = h('div', { class: 'eq-stats' },
    h('div', { class: 'eq-stat' }, h('span', null, 'Cette semaine'), h('b', null, fmtMin(d.semaine))),
    h('div', { class: 'eq-stat' }, h('span', null, 'Ce mois'), h('b', null, fmtMin(d.mois))),
    h('div', { class: 'eq-stat' }, h('span', null, 'Prochain service'), h('b', { style: 'font-size:1rem' }, prochain ? `${JOURS_COURTS[versDate(prochain.jour).getDay()]} ${versDate(prochain.jour).getDate()}` : '—', prochain ? h('small', null, ` ${libelleCreneau(prochain.creneau)}`) : null)));

  const semaine = h('section', { class: 'eq-carte' },
    h('div', { class: 'eq-carte__tete' }, h('h2', null, ic('planning'), '7 prochains jours'), h('a', { href: '#/planning' }, 'Tout voir →')),
    h('div', { class: 'eq-semaine' }, d.prochains.map((j, i) => {
      const x = lireCreneau(j.creneau);
      const dt = versDate(j.jour);
      return h('div', { class: `eq-jour ${i === 0 ? 'is-auj' : ''} ${x?.code ? 'is-code' : ''}`, title: j.creneau ? `${dateLongue(j.jour)} : ${libelleCreneau(j.creneau)}` : '' },
        h('small', null, i === 0 ? 'auj.' : JOURS_COURTS[dt.getDay()]), h('b', null, dt.getDate()),
        h('em', { class: j.creneau ? '' : 'is-libre' }, j.creneau ? (x?.code || String(j.creneau).replace(/\s+/g, '').replace(/h(?=-|$)/g, '')) : 'libre'));
    })));

  const raccourcis = h('div', { class: 'eq-raccourcis' },
    h('a', { class: 'eq-raccourci', href: '#/paie' }, ic('paie'), h('span', null, 'Fiches de paie', h('small', null, 'PDF sécurisés')), d.fichesNonVues ? h('i', { class: 'eq-badge' }, d.fichesNonVues) : null),
    h('a', { class: 'eq-raccourci', href: '#/absences' }, ic('absences'), h('span', null, 'Congés', h('small', null, 'Demander un jour')), d.absencesAttente ? h('i', { class: 'eq-badge' }, d.absencesAttente) : null),
    h('a', { class: 'eq-raccourci', href: '#/documents' }, ic('documents'), h('span', null, 'Documents', h('small', null, 'Contrat, carte pro…'))),
    moi.metier === 'chauffeur'
      ? h('a', { class: 'eq-raccourci', href: '#/courses' }, ic('voiture'), h('span', null, 'Mes courses', h('small', null, 'Trajets confiés')))
      : h('a', { class: 'eq-raccourci eq-raccourci--rouge', href: '#/main-courante' }, ic('mc'), h('span', null, 'Main courante', h('small', null, d.incidentsOuverts ? `${d.incidentsOuverts} en cours` : 'Mes signalements'))));

  const consignes = d.consignes.length ? h('section', { class: 'eq-carte' },
    h('div', { class: 'eq-carte__tete' }, h('h2', null, ic('info'), 'Consignes de la direction')),
    d.consignes.map((x) => h('div', { class: 'eq-consigne' }, h('p', null, x.texte), h('small', null, `${frDate(x.cree)}${+x.agent_id ? ' · pour vous' : ' · toute l’équipe'}`)))) : null;
  const courses = d.courses.length ? h('section', { class: 'eq-carte' },
    h('div', { class: 'eq-carte__tete' }, h('h2', null, ic('voiture'), 'Prochaines courses'), h('a', { href: '#/courses' }, 'Toutes →')),
    h('div', { class: 'eq-liste' }, d.courses.map(carteCourse))) : null;

  return h('div', null,
    enTete(dateLongue(iso(new Date())), h('span', null, `${salut}, `, h('span', { class: 'eq-or-texte' }, d.moi.prenom)), d.moi.metierLibelle),
    d.alertes.length ? h('div', { class: 'eq-liste', style: 'margin-bottom:1rem' }, d.alertes.map((a) => h('div', { class: `eq-alerte eq-alerte--${a.niveau}` }, ic('alerte'), a.texte))) : null,
    h('div', { class: 'eq-grille' },
      h('div', { class: 'eq-g-7' }, service, h('div', { class: 'eq-mt' }, stats)),
      h('div', { class: 'eq-g-5' }, semaine),
      h('div', null, raccourcis),
      consignes ? h('div', { class: courses ? 'eq-g-6' : '' }, consignes) : null,
      courses ? h('div', { class: consignes ? 'eq-g-6' : '' }, courses) : null));
}

/* ----- Planning ----- */
let moisPlanning = iso(new Date()).slice(0, 7);
async function pagePlanning() {
  const d = await api('planning', undefined, { mois: moisPlanning });
  const [an, mo] = moisPlanning.split('-').map(Number);
  const jours = d.jours || {};
  const fer = feries(an);
  const auj = iso(new Date());
  const nbJours = new Date(an, mo, 0).getDate();
  const absenceDu = (j) => d.absences.find((a) => a.du <= j && a.au >= j);
  const pointeLe = (j) => d.pointages.filter((p) => p.debut.slice(0, 10) === j).reduce((s, p) => s + Math.max(0, ((p.fin ? versDate(p.fin) : new Date(Date.now() + decalage)) - versDate(p.debut)) / 60000), 0);
  let prevu = 0, travailles = 0, nuits = 0;
  for (const [, v] of Object.entries(jours)) { const c = lireCreneau(v); if (c && !c.code && c.min) { prevu += c.min; travailles++; if (c.nuit) nuits++; } }
  const pointe = d.pointages.reduce((s, p) => s + Math.max(0, ((p.fin ? versDate(p.fin) : new Date(Date.now() + decalage)) - versDate(p.debut)) / 60000), 0);
  const changer = (n) => { const x = new Date(an, mo - 1 + n, 1); moisPlanning = `${x.getFullYear()}-${pad(x.getMonth() + 1)}`; recharger(); };
  let vue = memoire.lire('eq-vue-planning') || (window.innerWidth < 700 ? 'liste' : 'calendrier');
  const zone = h('div');
  const dessiner = () => {
    if (vue === 'calendrier') {
      const premier = (new Date(an, mo - 1, 1).getDay() + 6) % 7;
      const cases = [];
      ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].forEach((j) => cases.push(h('div', { class: 'eq-cal-tete' }, j)));
      for (let i = 0; i < premier; i++) cases.push(h('div', { class: 'eq-case-j is-vide' }));
      for (let n = 1; n <= nbJours; n++) {
        const j = `${moisPlanning}-${pad(n)}`;
        const v = jours[j] || '';
        const c = lireCreneau(v);
        const ab = !v ? absenceDu(j) : null;
        const pt = pointeLe(j);
        cases.push(h('div', { class: ['eq-case-j', j === auj ? 'is-auj' : '', c && !c.code ? 'is-travail' : '', c?.code || ab ? 'is-code' : '', fer.has(j) ? 'is-ferie' : '', j < auj ? 'is-passe' : ''].join(' '), title: v ? libelleCreneau(v) : '' },
          h('small', null, n), v ? h('b', null, c?.code || String(v).replace(/\s+/g, '').replace('-', '‑')) : ab ? h('b', null, ab.statut === 'attente' ? 'demandé' : ({ conges: 'CP', maladie: 'M', absence: 'ABS', indispo: 'indispo' })[ab.type]) : null,
          pt ? h('span', { class: 'eq-pointe' }, `✓ ${fmtMin(pt)}`) : null));
      }
      zone.replaceChildren(h('div', { class: 'eq-calendrier' }, cases));
    } else {
      const lignes = [];
      for (let n = 1; n <= nbJours; n++) {
        const j = `${moisPlanning}-${pad(n)}`;
        const v = jours[j] || '';
        if (!v) continue;
        const c = lireCreneau(v);
        const dt = versDate(j);
        const pt = pointeLe(j);
        lignes.push(h('div', { class: `eq-item ${j === auj ? 'is-auj' : ''}`, style: j < auj ? 'opacity:.6' : '' },
          h('div', { class: 'eq-date-bloc' }, h('small', null, JOURS_COURTS[dt.getDay()]), h('b', null, n)),
          h('div', { class: 'eq-item__corps' }, h('b', null, c?.code ? (CODES[c.code] || c.code) : String(v).replace(/\s+/g, '')),
            h('small', null, [c && !c.code && c.min ? fmtMin(c.min) : '', c?.nuit ? 'nuit' : '', fer.has(j) ? 'jour férié' : ''].filter(Boolean).join(' · '))),
          pt ? pastille('ok', `pointé ${fmtMin(pt)}`) : j === auj ? pastille('nouveau', 'aujourd’hui') : null));
      }
      zone.replaceChildren(lignes.length ? h('div', { class: 'eq-liste eq-jours-liste' }, lignes) : vide('planning', 'Aucun service ce mois-ci', 'Votre planning apparaîtra ici dès que la direction l’aura préparé.'));
    }
  };
  const btnVue = (v, icone, lib) => h('button', { class: `eq-icone-btn ${vue === v ? '' : ''}`, type: 'button', 'aria-label': lib, title: lib, style: vue === v ? 'color:var(--or-clair);border-color:var(--or)' : '', onclick: () => { vue = v; memoire.ecrire('eq-vue-planning', v); dessiner(); entete.querySelectorAll('.eq-vues button').forEach((b, i) => { b.style.cssText = (i === 0) === (v === 'calendrier') ? 'color:var(--or-clair);border-color:var(--or)' : ''; }); } }, ic(icone));
  const entete = h('div', { class: 'eq-carte__tete' },
    h('div', { class: 'eq-mois-nav' }, h('button', { class: 'eq-icone-btn', type: 'button', 'aria-label': 'Mois précédent', onclick: () => changer(-1) }, ic('retour')), h('b', null, `${MOIS[mo - 1]} ${an}`), h('button', { class: 'eq-icone-btn', type: 'button', 'aria-label': 'Mois suivant', onclick: () => changer(1) }, ic('fleche'))),
    h('div', { class: 'eq-vues', style: 'display:flex;gap:.4rem' }, btnVue('calendrier', 'grille', 'Vue calendrier'), btnVue('liste', 'liste', 'Vue liste')));
  dessiner();
  return h('div', null,
    enTete('Mon planning', 'Planning', d.client ? `Mission : ${[d.client, d.site, d.mission].filter(Boolean).join(' · ')}` : 'Vos services, mis à jour en direct par la direction.'),
    h('div', { class: 'eq-stats', style: 'margin-bottom:1rem' },
      h('div', { class: 'eq-stat' }, h('span', null, 'Jours travaillés'), h('b', null, travailles, nuits ? h('small', null, ` dont ${nuits} nuit${nuits > 1 ? 's' : ''}`) : null)),
      h('div', { class: 'eq-stat' }, h('span', null, 'Heures prévues'), h('b', null, fmtMin(prevu))),
      h('div', { class: 'eq-stat' }, h('span', null, 'Heures pointées'), h('b', null, fmtMin(pointe)))),
    h('section', { class: 'eq-carte' }, entete, zone,
      h('div', { class: 'eq-legende' }, Object.entries(CODES).map(([k, l]) => h('span', null, h('b', null, k), ` ${l}`)), h('span', null, h('b', { style: 'color:var(--vert)' }, '✓'), ' heures pointées'))),
    h('p', { class: 'eq-note' }, ic('info'), 'Une erreur dans votre planning ? Prévenez la direction au 06 11 67 86 25.'));
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
  const cats = h('div', { class: 'eq-choix', role: 'radiogroup' }, Object.entries(INCIDENTS).map(([k, [t, i]]) =>
    h('label', null, h('input', { type: 'radio', name: 'cat', value: k }), h('span', { class: 'eq-tuile' }, ic(i), h('span', null, t)))));
  const gravites = h('div', { class: 'eq-seg' }, [['info', 'Info'], ['normale', 'Normal'], ['urgente', 'Urgent']].map(([v, l]) =>
    h('label', null, h('input', { type: 'radio', name: 'grav', value: v, checked: v === 'normale' }), h('span', { 'data-g': v }, h('i', { class: 'eq-point' }), l))));
  const quand = saisie({ type: 'datetime-local', value: `${iso(maintenant)}T${pad(maintenant.getHours())}:${pad(maintenant.getMinutes())}`, max: `${iso(maintenant)}T23:59` });
  const site = saisie({ value: siteConnu || '', placeholder: 'Nom du site ou adresse', maxlength: 120 });
  const compteur = h('div', { class: 'eq-compteur' }, '0 / 5000');
  const texte = h('textarea', { class: 'eq-input', rows: 5, maxlength: 5000, placeholder: 'Ce qui s’est passé, les personnes concernées, ce que vous avez fait, qui a été prévenu…', oninput: () => { compteur.textContent = `${texte.value.length} / 5000`; } });
  const photos = [];
  const grille = h('div', { class: 'eq-photos' });
  const entree = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, class: 'sr', onchange: async () => {
    for (const f of [...entree.files].slice(0, 4 - photos.length)) photos.push(await compresser(f));
    entree.value = '';
    dessinerPhotos();
  } });
  const dessinerPhotos = () => {
    grille.replaceChildren(...photos.map((f, i) => {
      const url = URL.createObjectURL(f);
      return h('div', { class: 'eq-photo' }, h('img', { src: url, alt: '', onload: () => URL.revokeObjectURL(url) }), h('button', { type: 'button', 'aria-label': 'Retirer la photo', onclick: () => { photos.splice(i, 1); dessinerPhotos(); } }, ic('croix')));
    }), photos.length < 4 ? h('label', { class: 'eq-ajout' }, h('span', null, ic('photo'), 'Ajouter'), entree) : null);
  };
  dessinerPhotos();
  const msg = h('p', { class: 'eq-erreur', role: 'alert' });
  const btn = h('button', { class: 'eq-btn eq-btn--plein', type: 'submit' }, ic('envoyer'), 'Envoyer à la direction');
  const fermer = tiroir('Signaler un événement', h('form', { class: 'eq-form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = '';
    const cat = valeurChoix(cats, 'cat');
    const g = valeurChoix(gravites, 'grav');
    if (!cat) { msg.textContent = 'Choisissez le type d’événement.'; return; }
    if (texte.value.trim().length < 10) { msg.textContent = 'Décrivez ce qui s’est passé (10 caractères minimum).'; texte.focus(); return; }
    if (g === 'urgente' && !confirm('Événement URGENT : la direction est alertée immédiatement. En cas de danger, appelez d’abord le 17, le 18 ou le 112. Envoyer ?')) return;
    btn.disabled = true; btn.lastChild.textContent = 'Envoi…';
    const fd = new FormData();
    fd.append('categorie', cat); fd.append('gravite', g); fd.append('quand', quand.value); fd.append('site', site.value.trim()); fd.append('texte', texte.value.trim());
    photos.forEach((p) => fd.append('photos[]', p));
    try {
      await apiForm('incident.signaler', fd);
      fermer();
      toast('Événement transmis à la direction.');
      if (location.hash !== '#/main-courante') location.hash = '#/main-courante'; else recharger();
    } catch (err) { msg.textContent = err.message; btn.disabled = false; btn.lastChild.textContent = 'Envoyer à la direction'; }
  } },
    h('div', { class: 'eq-alerte eq-alerte--rouge' }, ic('alerte'), h('span', null, 'Danger immédiat ? Appelez d’abord le ', h('a', { href: 'tel:17' }, '17'), ', le ', h('a', { href: 'tel:18' }, '18'), ' ou le ', h('a', { href: 'tel:112' }, '112'), '.')),
    h('div', { class: 'eq-champ' }, h('span', null, 'Type d’événement'), cats),
    h('div', { class: 'eq-champ' }, h('span', null, 'Gravité'), gravites),
    h('div', { class: 'eq-grille-2' }, champ('Date et heure', quand), champ('Site', site)),
    h('label', { class: 'eq-champ' }, h('span', null, 'Description'), texte, compteur),
    h('div', { class: 'eq-champ' }, h('span', null, 'Photos (4 maximum)'), grille),
    msg, btn,
    h('p', { class: 'eq-note', style: 'margin:0' }, ic('cadenas'), 'Horodaté et non modifiable après envoi.')));
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
