/* =========================================================
   ESPACE CLIENT — bdasecurite.com/espace-client (« le salon privé »)
   Connexion, activation (lien d'invitation), puis cinq rubriques :
   - Accueil : la situation du moment (agents en poste, ce qu'il y a à signer ou à régler) ;
   - Mon site : en poste maintenant, la semaine, demandes rapides ;
   - Équipe : les agents que la direction a choisi de montrer, leur dossier (documents choisis un par un) ;
   - Documents : devis (bon pour accord en ligne), factures, PDF, documents d'agents, dépôts du client ;
   - Messages : correspondance avec la direction, pièces jointes, demandes guidées suivies.
   Données : /api/client.php (cœur) et ses actions « mod.portail.* » (app/modules/portail.php).
   ========================================================= */
import { fmtHeures } from '/admin/js/outils.js';

const racine = document.getElementById('ec');
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const STATUTS = {
  devis: { envoye: ['À signer', 'or'], accepte: ['Signé', 'ok'], refuse: ['Refusé', 'neutre'] },
  facture: { envoyee: ['À régler', 'or'], payee: ['Payée', 'ok'], annulee: ['Annulée', 'neutre'] },
};
const ICONES = {
  accueil: '<path d="M4 10.5 12 4l8 6.5V20h-5v-5H9v5H4z"/>',
  site: '<path d="M5 21V5h9v16M14 9h5v12M8 8.5h3M8 12.5h3M8 16.5h3M3 21h18"/>',
  equipe: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.8-3 3.2-4.6 6-4.6s5.2 1.6 6 4.6M16 4.9a3.2 3.2 0 0 1 0 6.2M18 15.6c1.5.7 2.5 2.2 3 4.4"/>',
  documents: '<path d="M7 3h7l5 5v13H7zM14 3v5h5"/>',
  messages: '<path d="M4.5 5.5h15v10h-10l-5 4z"/>',
  sortie: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  envoyer: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  trombone: '<path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10 16.9a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4"/>',
  retour: '<path d="M15 6l-6 6 6 6"/>',
  croix: '<path d="M6 6l12 12M18 6 6 18"/>',
  coche: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cadenas: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  imprimer: '<path d="M6 9V3h12v6M6 18H4V11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-2M6 14h12v7H6z"/>',
  telecharger: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const DEMANDES = [['renfort', 'Renfort'], ['planning', 'Modifier le planning'], ['probleme', 'Signaler un problème'], ['facture', 'Question sur une facture']];
const AIDE_DEMANDE = {
  renfort: 'Quand, combien d’agents, quels horaires ?',
  planning: 'Quel jour et quel changement souhaitez-vous ?',
  probleme: 'Que s’est-il passé ? Vous pouvez joindre une photo.',
  facture: 'Quelle facture et quelle question ?',
};
let csrf = '';
let donnees = null;
let demandeChoisie = '';

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
  if (j.csrf) csrf = j.csrf;
  if (r.status === 401 && a !== 'connexion') { ecranConnexion('Votre session a expiré : reconnectez-vous.'); throw new Error('Connexion requise.'); }
  if (r.status === 413) throw new Error('Fichier trop lourd.');
  if (!r.ok || j.ok === false) throw new Error(j.erreur || `Erreur ${r.status}`);
  return j;
}
function api(a, corps, params) {
  const opts = { headers: { Accept: 'application/json' } };
  if (corps !== undefined) Object.assign(opts, { method: 'POST', headers: { ...opts.headers, 'Content-Type': 'application/json', 'X-CSRF': csrf }, body: JSON.stringify(corps) });
  return appel(a, opts, params);
}
const apiForm = (a, fd) => appel(a, { method: 'POST', headers: { Accept: 'application/json', 'X-CSRF': csrf }, body: fd });
const lien = (a, params) => `/api/client.php?${new URLSearchParams({ a, ...params })}`;
function toast(msg, erreur) {
  const t = h('div', { class: `ec-toast ${erreur ? 'is-erreur' : ''}`, role: 'status' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 400); }, 4200);
}
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dateDe = (s) => new Date(`${String(s).slice(0, 10)}T12:00:00`);
const frDate = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
const heure = (s) => String(s || '').slice(11, 16);
const hm = (s) => String(s || '').replace(/^0(\d)/, '$1');
const moisLib = (s) => `${cap(MOIS[+String(s).slice(5, 7) - 1] || '')} ${String(s).slice(0, 4)}`;
const jourLib = (s) => {
  const j = String(s).slice(0, 10);
  if (j === iso(new Date())) return 'Aujourd’hui';
  if (j === iso(new Date(Date.now() + 86400000))) return 'Demain';
  if (j === iso(new Date(Date.now() - 86400000))) return 'Hier';
  const d = dateDe(j);
  return `${cap(JOURS[d.getDay()])} ${d.getDate()} ${MOIS[d.getMonth()]}`;
};
const heures = (n) => (n >= 10 ? `${Math.round(n)} h` : fmtHeures(+n || 0));
const initiales = (nom) => String(nom || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase();
const pastille = (type, statut) => { const [lib, ton] = STATUTS[type]?.[statut] || [statut, 'neutre']; return h('span', { class: `ec-etat ec-etat--${ton}` }, h('i'), lib); };
const feuillet = (nouveau) => h('span', { class: `ec-feuillet ${nouveau ? 'is-nouveau' : ''}`, 'aria-hidden': 'true' });
const etiquette = (t) => h('h2', { class: 'ec-etiquette' }, t);
const champ = (label, input) => h('label', { class: 'ec-champ' }, h('span', null, label), input);
const saisie = (attrs) => h('input', { class: 'ec-input', ...attrs });
const bouton = (txt, attrs = {}) => h('button', { class: `ec-btn ${attrs.secondaire ? 'ec-btn--second' : ''}`, type: 'button', onclick: attrs.onclick }, txt);
const marque = (grand) => h('span', { class: `ec-marque ${grand ? 'ec-marque--grand' : ''}` }, h('b', null, 'BDA'), h('i'), h('small', null, 'SECURITY GROUP'));
const vers = (demande) => () => { demandeChoisie = demande; location.hash = '#/messages'; };
// « Carte pro ···· 4821 · valide jusqu'au 01/02/2031 » (ce qui est connu seulement)
const carteTexte = (a) => (!a ? '' : [a.carte ? `Carte pro ${a.carte}` : 'Carte pro', a.validite ? `valide jusqu’au ${a.validite}` : ''].filter(Boolean).join(' · ').replace(/^Carte pro$/, ''));

/* ---------- Démarrage ---------- */
async function demarrer() {
  const jeton = (location.hash.match(/invitation=([a-f0-9]{48})/) || [])[1];
  let s;
  try { s = await api('session'); } catch (e) { return racine.replaceChildren(h('p', { class: 'ec-message' }, e.message)); }
  if (jeton) return ecranInvitation(jeton);
  if (!s.connecte) return ecranConnexion();
  ouvrir();
}

/* ---------- Connexion / activation : le premier contact ---------- */
function ecranAuth(titreEcran, texte, ...contenu) {
  document.body.classList.remove('ec--app');
  return h('main', { class: 'ec-auth' },
    h('div', { class: 'ec-auth__marque' }, marque(true)),
    h('div', { class: 'ec-auth__corps' },
      h('h1', null, titreEcran),
      texte ? h('p', { class: 'ec-auth__texte' }, texte) : null,
      contenu),
    h('p', { class: 'ec-auth__pied' },
      h('span', null, ic('cadenas'), 'Connexion chiffrée'),
      h('span', null, 'Ligne directe 24 h/24 · ', h('a', { href: 'tel:+33611678625' }, '06 11 67 86 25'))));
}
function ecranConnexion(message) {
  const email = saisie({ type: 'email', autocomplete: 'username', required: true, placeholder: 'vous@entreprise.fr' });
  const mdp = saisie({ type: 'password', autocomplete: 'current-password', required: true, placeholder: '••••••••' });
  const msg = h('p', { class: 'ec-erreur', role: 'alert' }, message || '');
  const btn = h('button', { class: 'ec-btn', type: 'submit' }, 'Entrer');
  const aide = h('p', { class: 'ec-auth__aide', hidden: true }, 'Écrivez-nous ou appelez le 06 11 67 86 25 : nous vous envoyons un nouveau lien pour choisir votre mot de passe.');
  const form = h('form', { class: 'ec-form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = ''; btn.disabled = true;
    try { await api('connexion', { email: email.value.trim(), motdepasse: mdp.value }); ouvrir(true); }
    catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } }, champ('E-mail', email), champ('Mot de passe', mdp), msg, btn,
  h('button', { class: 'ec-lien', type: 'button', onclick: () => { aide.hidden = !aide.hidden; } }, 'Mot de passe oublié'), aide);
  racine.replaceChildren(ecranAuth('Votre espace privé.', 'Agents, documents et échanges, en un seul lieu.', form));
  setTimeout(() => email.focus(), 900);
}
async function ecranInvitation(jeton) {
  let info;
  try { info = await api('invitation.verifier', undefined, { jeton }); } catch (e) { history.replaceState(null, '', location.pathname); return ecranConnexion(e.message); }
  const mdp = saisie({ type: 'password', autocomplete: 'new-password', minlength: 8, required: true });
  const mdp2 = saisie({ type: 'password', autocomplete: 'new-password', required: true });
  const msg = h('p', { class: 'ec-erreur', role: 'alert' });
  const btn = h('button', { class: 'ec-btn', type: 'submit' }, 'Ouvrir mon espace');
  const form = h('form', { class: 'ec-form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = '';
    if (mdp.value !== mdp2.value) { msg.textContent = 'Les deux mots de passe ne sont pas identiques.'; return; }
    btn.disabled = true;
    try { await api('invitation', { jeton, motdepasse: mdp.value }); history.replaceState(null, '', location.pathname); ouvrir(true); }
    catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } }, h('p', { class: 'ec-auth__id' }, 'Identifiant : ', h('b', null, info.email)), champ('Choisissez un mot de passe (8 caractères minimum)', mdp), champ('Confirmez le mot de passe', mdp2), msg, btn);
  racine.replaceChildren(ecranAuth(`Bienvenue, ${info.client}.`, 'Choisissez votre mot de passe pour ouvrir votre espace privé.', form));
  mdp.focus();
}
// L'ouverture du coffre : une fois par session, juste après la connexion (un toucher la passe)
function ouvertureCoffre() {
  try { if (sessionStorage.getItem('ec-coffre')) return; sessionStorage.setItem('ec-coffre', '1'); } catch (e) { return; }
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const voile = h('div', { class: 'ec-coffre', 'aria-hidden': 'true' }, h('span', { class: 'ec-coffre__haut' }), h('span', { class: 'ec-coffre__bas' }), h('span', { class: 'ec-coffre__filet' }));
  const fin = () => voile.remove();
  voile.addEventListener('click', fin);
  document.body.append(voile);
  setTimeout(fin, 1900);
}

/* ---------- Application ---------- */
const RUBRIQUES = [['accueil', 'Accueil'], ['site', 'Mon site'], ['equipe', 'Équipe'], ['documents', 'Documents'], ['messages', 'Messages']];
async function ouvrir(apresConnexion) {
  try { donnees = await api('tableau'); } catch (e) { return; }
  document.body.classList.add('ec--app');
  if (apresConnexion) ouvertureCoffre();
  window.onhashchange = naviguer;
  naviguer();
}
async function recharger() { try { donnees = await api('tableau'); } catch (e) { /* session expirée gérée par api() */ } }
const aTraiter = () => [...donnees.devis.filter((d) => d.statut === 'envoye'), ...donnees.factures.filter((f) => f.statut === 'envoyee')];
function point(k) {
  const n = k === 'documents' ? aTraiter().length : k === 'messages' ? donnees.messagesNonLus : 0;
  return n ? h('i', { class: 'ec-point', 'aria-label': `${n} à voir` }) : null;
}
function naviguer() {
  if (!donnees) return;
  let [brut, p1, p2] = location.hash.replace(/^#\/?/, '').split('/');
  // anciennes adresses (mails déjà envoyés) : #/devis/12, #/factures/12, #/factures
  if (brut === 'devis' || brut === 'factures') { p2 = p1; p1 = p1 ? (brut === 'devis' ? 'devis' : 'facture') : (brut === 'devis' ? 'devis' : 'factures'); brut = 'documents'; }
  const rubrique = RUBRIQUES.some(([k]) => k === brut) || brut === 'compte' ? brut : 'accueil';
  const deconnexion = async () => { try { await api('deconnexion', {}); } catch (e) { /* déjà sorti */ } donnees = null; try { sessionStorage.removeItem('ec-coffre'); } catch (e) { /* */ } ecranConnexion('Vous êtes déconnecté. À bientôt.'); };
  const entete = h('header', { class: 'ec-tete' },
    h('div', { class: 'ec-tete__dedans' },
      h('a', { href: '#/accueil', class: 'ec-tete__marque', 'aria-label': 'Accueil' }, marque(false)),
      h('nav', { class: 'ec-nav', 'aria-label': 'Rubriques' }, RUBRIQUES.map(([k, lib]) => h('a', { href: `#/${k}`, class: k === rubrique ? 'is-actif' : '', 'aria-current': k === rubrique ? 'page' : null }, lib, point(k)))),
      h('a', { href: '#/compte', class: `ec-moi ${rubrique === 'compte' ? 'is-actif' : ''}`, 'aria-label': 'Mon compte' }, h('span', { class: 'ec-moi__nom' }, donnees.client.nom), h('span', { class: 'ec-avatar' }, initiales(donnees.client.nom)))));
  const barre = h('nav', { class: 'ec-barre', 'aria-label': 'Rubriques' }, RUBRIQUES.map(([k, lib]) => h('a', { href: `#/${k}`, class: k === rubrique ? 'is-actif' : '', 'aria-current': k === rubrique ? 'page' : null }, ic(k), h('span', null, lib), point(k))));
  const zone = h('main', { class: 'ec-page', id: 'contenu' }, h('div', { class: 'ec-chargement' }, h('span'), h('span'), h('span')));
  racine.replaceChildren(entete, zone, barre);
  const vues = {
    accueil: vueAccueil,
    site: vueSite,
    equipe: () => (p1 ? vueAgent(+p1) : vueEquipe()),
    documents: () => (p1 && p2 ? vueDocument(p2) : vueDocuments(p1 || 'tous')),
    messages: vueMessages,
    compte: () => vueCompte(deconnexion),
  };
  Promise.resolve(vues[rubrique]()).then((contenu) => { zone.replaceChildren(...[contenu].flat().filter(Boolean)); zone.classList.add('is-in'); })
    .catch((e) => zone.replaceChildren(h('p', { class: 'ec-message' }, e.message)));
  window.scrollTo(0, 0);
}
const titre = (surtitre, texte, sous) => h('header', { class: 'ec-titre' }, surtitre ? h('p', { class: 'ec-etiquette' }, surtitre) : null, h('h1', null, texte), sous ? h('p', { class: 'ec-titre__sous' }, sous) : null);

/* ---------- La carte d'agent (façon carte de membre) ---------- */
function carteAgent(a, opts = {}) {
  return h(opts.href ? 'a' : 'div', { class: `ec-carte-agent ${opts.grande ? 'ec-carte-agent--grande' : ''}`, href: opts.href || null, 'aria-label': opts.href ? `${a.nom} : ouvrir` : null },
    h('span', { class: 'ec-carte-agent__filet', 'aria-hidden': 'true' }),
    h('span', { class: 'ec-carte-agent__haut' },
      h('span', { class: 'ec-carte-agent__bda' }, h('b', null, 'BDA'), h('i')),
      opts.etat || (a.enPoste ? h('span', { class: 'ec-etat ec-etat--ok' }, h('i', { class: 'ec-respire' }), `En poste depuis ${a.enPoste}`) : null)),
    h('span', { class: 'ec-carte-agent__nom' }, h('b', null, a.nom), h('small', null, a.qualification)),
    h('span', { class: 'ec-carte-agent__bas' }, h('span', null, opts.bas ?? carteTexte(a)), opts.lien ? h('span', null, opts.lien) : null));
}

/* ---------- Accueil ---------- */
async function vueAccueil() {
  const [acc, eq] = await Promise.all([api('mod.portail.accueil'), api('mod.portail.equipe').catch(() => ({ agents: [] }))]);
  const maintenant = new Date();
  const bonsoir = maintenant.getHours() >= 18 || maintenant.getHours() < 5;
  const nb = acc.enPoste.length;
  const etat = nb
    ? h('p', { class: 'ec-statut' }, h('i', { class: 'ec-respire' }), `${nb} agent${nb > 1 ? 's' : ''} en poste · tout est calme`)
    : h('p', { class: 'ec-statut is-calme' }, acc.prochain ? `Prochain passage : ${jourLib(acc.prochain.jour).toLowerCase()} à ${hm(acc.prochain.debut)}${acc.prochain.agent ? ` · ${acc.prochain.agent}` : ''}.` : (acc.sites.length ? 'Aucun poste prévu pour le moment.' : 'Votre espace est prêt.'));
  // à droite : l'agent en poste (avec son dossier s'il est partagé), sinon le prochain passage
  const premier = acc.enPoste[0];
  const partage = premier ? eq.agents.find((a) => a.id === premier.agent_id) : null;
  let carte = null;
  if (premier) carte = carteAgent({ ...premier, ...(partage || {}), enPoste: premier.depuis }, { grande: true, href: partage ? `#/equipe/${partage.id}` : '#/site', bas: carteTexte(partage), lien: partage ? 'Ouvrir le dossier →' : null });
  else if (acc.prochain?.agent) carte = carteAgent({ nom: acc.prochain.agent, qualification: acc.prochain.qualification }, { grande: true, href: '#/site', etat: h('span', { class: 'ec-etat ec-etat--neutre' }, h('i'), jourLib(acc.prochain.jour)), bas: `${hm(acc.prochain.debut)} – ${hm(acc.prochain.fin)}` });
  const autres = acc.enPoste.slice(1);
  const todo = aTraiter();
  const ligneTodo = (d) => h('a', { class: 'ec-ligne', href: `#/documents/${d.type}/${d.id}` }, feuillet(!d.vu_client),
    h('span', { class: 'ec-ligne__txt' }, h('b', null, d.type === 'facture' ? `Facture ${d.numero}` : `Devis ${d.numero}`), h('small', null, `${euro.format(+d.total || 0)}${d.type === 'facture' && d.echeance ? ` · échéance ${frDate(d.echeance)}` : ''}`)),
    h('span', { class: 'ec-pilule' }, d.type === 'facture' ? 'Voir' : 'Signer'));
  const recents = [...donnees.devis, ...donnees.factures].sort((a, b) => String(b.partage).localeCompare(String(a.partage))).slice(0, 3);
  const msg = acc.dernierMessage;
  return [
    h('section', { class: 'ec-une' },
      h('div', { class: 'ec-une__texte' },
        h('p', { class: 'ec-etiquette' }, `${JOURS[maintenant.getDay()]} ${maintenant.getDate()} ${MOIS[maintenant.getMonth()]}`.toUpperCase()),
        h('h1', { class: 'ec-salut' }, `${bonsoir ? 'Bonsoir' : 'Bonjour'},`, h('br'), `${donnees.client.nom}.`),
        etat,
        h('div', { class: 'ec-bloc' }, etiquette('À traiter'),
          todo.length ? h('div', { class: 'ec-lignes' }, todo.slice(0, 3).map(ligneTodo)) : h('p', { class: 'ec-rien' }, 'Rien à traiter.')),
        h('div', { class: 'ec-chiffres' },
          h('span', null, h('b', null, heures(acc.heuresMois)), h('small', null, `de sécurité assurées en ${MOIS[maintenant.getMonth()]}`)),
          acc.heuresPrecedent ? h('span', null, h('b', null, heures(acc.heuresPrecedent)), h('small', null, `en ${MOIS[+acc.moisPrecedent.slice(5, 7) - 1]}`)) : null)),
      h('div', { class: 'ec-une__carte' },
        carte ? [etiquette(premier ? 'En poste maintenant' : 'Prochain passage'), h('div', { class: 'ec-pile' }, autres.length ? h('span', { class: 'ec-pile__dos', 'aria-hidden': 'true' }) : null, carte),
          autres.map((a) => h('a', { class: 'ec-ligne ec-ligne--simple', href: '#/site' }, h('i', { class: 'ec-pastille-verte' }), h('span', { class: 'ec-ligne__txt' }, h('b', null, a.nom), h('small', null, `${a.qualification} · depuis ${a.depuis}`))))]
          : h('div', { class: 'ec-vide' }, h('p', { class: 'ec-italique' }, 'Votre site, en direct.'), h('i', { class: 'ec-filet' }), h('p', null, 'Les agents apparaîtront ici dès leur prise de service.')))),
    h('section', { class: 'ec-grille' },
      h('div', { class: 'ec-panneau' }, h('h2', null, 'Derniers documents'),
        recents.length ? h('div', { class: 'ec-lignes' }, recents.map((d) => h('a', { class: 'ec-ligne ec-ligne--simple', href: `#/documents/${d.type}/${d.id}` }, h('span', { class: 'ec-ligne__txt' }, h('b', null, `${d.type === 'facture' ? 'Facture' : 'Devis'} ${d.numero}`)), h('small', null, frDate(d.partage)))))
          : h('p', { class: 'ec-rien' }, 'Vos premiers documents arriveront ici.'),
        h('a', { class: 'ec-lien-or', href: '#/documents' }, 'Ouvrir le coffre')),
      h('div', { class: 'ec-panneau' }, h('h2', null, 'La direction'),
        msg ? [h('p', { class: 'ec-citation' }, `« ${msg.texte} »`), h('p', { class: 'ec-signe' }, `${msg.auteur === 'admin' ? 'Direction · BDA Security Group' : 'Vous'} · ${jourLib(msg.cree).toLowerCase()} à ${heure(msg.cree)}`)]
          : h('p', { class: 'ec-rien' }, 'Une question, un renfort, un souci ? La direction vous répond ici.'),
        h('a', { class: 'ec-lien-or', href: '#/messages' }, 'Écrire à la direction')),
      h('div', { class: 'ec-panneau' }, h('h2', null, 'Votre équipe'),
        eq.agents.length ? h('div', { class: 'ec-lignes' }, eq.agents.slice(0, 3).map((a) => h('a', { class: 'ec-ligne ec-ligne--simple', href: `#/equipe/${a.id}` }, h('span', { class: 'ec-ligne__txt' }, h('b', null, a.nom)), h('small', null, a.etat === 'valide' ? 'carte valide' : 'carte à vérifier'))))
          : h('p', { class: 'ec-rien' }, 'Les dossiers de vos agents apparaîtront ici quand la direction les partagera.'),
        h('a', { class: 'ec-lien-or', href: '#/equipe' }, 'Voir l’équipe'))),
  ];
}

/* ---------- Mon site ---------- */
async function vueSite() {
  const d = await api('mod.portail.site');
  const parJour = {};
  for (const v of d.semaine) (parJour[v.jour] ||= []).push(v);
  const multi = d.sites.length > 1;
  return [
    titre('Mon site', d.sites.map((s) => s.nom).join(' · ') || donnees.client.nom, d.sites.length === 1 && d.sites[0].adresse ? d.sites[0].adresse : null),
    h('div', { class: 'ec-deux' },
      h('div', null,
        h('div', { class: 'ec-bloc' }, etiquette('En poste maintenant'),
          d.enPoste.length ? h('div', { class: 'ec-lignes' }, d.enPoste.map((a) => h('div', { class: 'ec-ligne ec-ligne--simple' }, h('i', { class: 'ec-pastille-verte ec-respire' }), h('span', { class: 'ec-ligne__txt' }, h('b', null, a.nom), h('small', null, a.qualification)), h('small', null, `depuis ${a.depuis}`))))
            : h('p', { class: 'ec-rien' }, 'Personne en poste en ce moment.')),
        h('div', { class: 'ec-bloc' }, etiquette('Les 7 prochains jours'),
          Object.keys(parJour).length ? h('div', { class: 'ec-lignes' }, Object.entries(parJour).map(([jour, postes]) => {
            const dt = dateDe(jour);
            return h('div', { class: 'ec-jour' },
              h('span', { class: 'ec-jour__date' }, h('small', null, JOURS[dt.getDay()].slice(0, 3).toUpperCase()), h('b', null, dt.getDate())),
              h('span', { class: 'ec-jour__postes' }, postes.map((p) => h('span', { class: 'ec-jour__poste' },
                h('b', null, p.agents.length ? p.agents.join(' · ') : 'Agent en cours d’affectation'),
                h('small', null, `${hm(p.debut)} – ${hm(p.fin)}${multi ? ` · ${p.site}` : ''}${p.aPourvoir && p.agents.length ? ` · +${p.aPourvoir} en cours d’affectation` : ''}`)))));
          })) : h('p', { class: 'ec-rien' }, 'Aucun poste prévu dans les 7 prochains jours.'))),
      h('aside', { class: 'ec-panneau ec-panneau--actions' },
        h('span', { class: 'ec-chiffre' }, h('b', null, heures(d.heuresMois)), h('small', null, `de sécurité assurées en ${MOIS[new Date().getMonth()]}`)),
        h('div', { class: 'ec-boutons' },
          bouton('Demander un renfort', { onclick: vers('renfort') }),
          bouton('Modifier le planning', { secondaire: true, onclick: vers('planning') }),
          bouton('Signaler un problème', { secondaire: true, onclick: vers('probleme') })))),
  ];
}

/* ---------- Équipe ---------- */
async function vueEquipe() {
  const { agents } = await api('mod.portail.equipe');
  return [
    titre('Agents affectés à votre site', 'Équipe', 'Les dossiers que BDA Security Group partage avec vous. Chaque carte se vérifie en direct.'),
    agents.length ? h('div', { class: 'ec-cartes' }, agents.map((a) => carteAgent(a, { href: `#/equipe/${a.id}`, lien: 'Dossier →' })))
      : h('div', { class: 'ec-vide ec-vide--grand' }, h('p', { class: 'ec-italique' }, 'Les dossiers de vos agents arriveront ici.'), h('i', { class: 'ec-filet' }), h('p', null, 'La direction choisit les agents et les documents qu’elle partage avec vous.')),
  ];
}
async function vueAgent(id) {
  const { agents } = await api('mod.portail.equipe');
  const a = agents.find((x) => x.id === id);
  if (!a) return [titre('Équipe', 'Dossier indisponible'), h('p', { class: 'ec-rien' }, 'Ce dossier n’est plus partagé. ', h('a', { href: '#/equipe' }, 'Retour à l’équipe'))];
  const verifie = h('div', { class: 'ec-verif', role: 'status' });
  const verifier = () => {
    if (a.verifier) window.open(a.verifier, '_blank', 'noopener');
    verifie.replaceChildren(h('p', { class: 'ec-verif__ok' }, ic('coche'), 'Vérification ouverte : la réponse vient de bdasecurite.com.'));
  };
  const ligne = (titreL, sous, etat) => h('div', { class: 'ec-ligne ec-ligne--simple' }, h('span', { class: 'ec-ligne__txt' }, h('b', null, titreL), h('small', null, sous)), etat);
  return [
    h('p', { class: 'ec-fil-ariane' }, h('a', { href: '#/equipe' }, 'Équipe'), ' / ', a.nom),
    h('div', { class: 'ec-dossier' },
      h('div', { class: 'ec-dossier__carte' },
        carteAgent(a, { grande: true, bas: carteTexte(a) || 'Carte pro à vérifier' }),
        a.verifier ? h('div', { class: 'ec-panneau ec-panneau--verif' }, h('b', null, 'Vérification en direct'), h('p', null, 'Scannez la carte de l’agent ou touchez le bouton : identité professionnelle et validité de la carte, en direct.'), bouton('Vérifier maintenant', { onclick: verifier }), verifie) : null),
      h('div', { class: 'ec-dossier__infos' },
        h('h1', null, 'Dossier de l’agent'),
        h('p', { class: 'ec-titre__sous' }, 'Documents partagés par BDA Security Group pour votre site.'),
        h('div', { class: 'ec-bloc' }, etiquette('Habilitations'),
          h('div', { class: 'ec-lignes' },
            ligne('Carte professionnelle CNAPS', [a.carte, a.validite ? `valide jusqu’au ${a.validite}` : ''].filter(Boolean).join(' · ') || 'non renseignée', h('span', { class: `ec-etat ec-etat--${a.etat === 'valide' ? 'ok' : 'or'}` }, h('i'), a.etat === 'valide' ? 'Valide' : 'À vérifier')),
            a.formations.map((f) => ligne(f.libelle, f.expire ? `${f.valide ? 'valide jusqu’au' : 'expirée le'} ${frDate(f.expire)}` : 'à jour', h('span', { class: `ec-etat ec-etat--${f.valide ? 'ok' : 'or'}` }, h('i'), f.valide ? 'Valide' : 'À renouveler'))))),
        a.docs.length ? h('div', { class: 'ec-bloc' }, etiquette('Documents'),
          h('div', { class: 'ec-lignes' }, a.docs.map((d) => h('div', { class: 'ec-ligne' }, feuillet(false),
            h('span', { class: 'ec-ligne__txt' }, h('b', null, d.type), h('small', null, `${d.nom} · partagé le ${frDate(d.ajoute)}`)),
            h('button', { class: 'ec-pilule', type: 'button', onclick: () => voirPiece(lien('mod.portail.agent.doc', { id: d.id }), d.image, `${d.type} — ${a.nom}`) }, 'Voir'))))) : null,
        h('div', { class: 'ec-bloc' }, etiquette('Sur votre site'),
          h('div', { class: 'ec-lignes' },
            a.depuis ? ligne('Chez vous depuis', `le ${frDate(a.depuis)}`) : null,
            ligne(`Heures en ${MOIS[new Date().getMonth()]}`, heures(a.heuresMois)))),
        h('p', { class: 'ec-mention' }, 'Copies remises par BDA Security Group à votre société pour le contrôle de la prestation. Merci de ne pas les diffuser.'))),
  ];
}
// Une copie s'ouvre comme une feuille posée (image) ; un PDF s'ouvre dans un nouvel onglet
function voirPiece(url, image, libelle) {
  if (!image) { window.open(url, '_blank', 'noopener'); return; }
  const fermer = () => { voile.remove(); document.removeEventListener('keydown', echap); };
  const echap = (e) => { if (e.key === 'Escape') fermer(); };
  const voile = h('div', { class: 'ec-visionneuse', role: 'dialog', 'aria-modal': 'true', 'aria-label': libelle, onclick: (e) => { if (e.target === voile) fermer(); } },
    h('figure', { class: 'ec-feuille-posee' },
      h('button', { class: 'ec-fermer', type: 'button', 'aria-label': 'Fermer', onclick: fermer }, ic('croix')),
      h('p', { class: 'ec-etiquette ec-or' }, 'COPIE PARTAGÉE'),
      h('figcaption', null, libelle),
      h('img', { src: url, alt: libelle }),
      h('p', { class: 'ec-filigrane', 'aria-hidden': 'true' }, `REMIS À ${donnees.client.nom.toUpperCase()} · ${frDate(iso(new Date()))}`),
      h('a', { class: 'ec-lien-or', href: `${url}&telecharger=1` }, 'Télécharger')));
  document.addEventListener('keydown', echap);
  document.body.append(voile);
}

/* ---------- Documents (le coffre) ---------- */
const FILTRES = [['tous', 'Tous'], ['devis', 'Devis'], ['factures', 'Factures'], ['pdf', 'Rapports et PDF'], ['agents', 'Agents'], ['depots', 'Vos dépôts']];
async function vueDocuments(filtre) {
  if (!FILTRES.some(([k]) => k === filtre)) filtre = 'tous';
  const extra = await api('mod.portail.documents');
  const items = [
    ...donnees.devis.map((d) => ({ cle: 'devis', date: d.partage || d.date, titre: `Devis ${d.numero}`, detail: euro.format(+d.total || 0), etat: pastille('devis', d.statut), nouveau: !d.vu_client, href: `#/documents/devis/${d.id}` })),
    ...donnees.factures.map((d) => ({ cle: 'factures', date: d.partage || d.date, titre: `Facture ${d.numero}`, detail: `${euro.format(+d.total || 0)}${d.echeance && d.statut === 'envoyee' ? ` · avant le ${frDate(d.echeance)}` : ''}`, etat: pastille('facture', d.statut), nouveau: !d.vu_client, href: `#/documents/facture/${d.id}` })),
    ...(donnees.plannings || []).map((p) => ({ cle: 'pdf', date: p.cree, titre: p.titre, detail: 'PDF', nouveau: !p.vu, url: lien('envoi', { id: p.id }) })),
    ...extra.agents.map((d) => ({ cle: 'agents', date: d.date, titre: d.titre, detail: d.nom, url: lien('mod.portail.agent.doc', { id: d.id }) })),
    ...extra.depots.map((d) => ({ cle: 'depots', date: d.cree, titre: d.titre, detail: `Déposé par vous · ${d.vu ? 'reçu par BDA' : 'envoyé'}`, url: lien('mod.portail.depot.fichier', { id: d.id }) })),
  ].filter((x) => filtre === 'tous' || x.cle === filtre).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const groupes = {};
  for (const x of items) (groupes[String(x.date).slice(0, 7)] ||= []).push(x);
  const ligne = (x) => h('a', { class: 'ec-ligne', href: x.href || x.url, target: x.url ? '_blank' : null, rel: x.url ? 'noopener' : null },
    feuillet(x.nouveau), h('span', { class: 'ec-ligne__txt' }, h('b', null, x.titre), h('small', null, x.detail)), x.etat || null);
  const todo = aTraiter();
  // dépôt d'un document pour BDA (bon de commande, plan, liste de badges, photo…)
  const fichier = h('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png,image/webp', class: 'ec-cache', id: 'ec-depot' });
  fichier.onchange = async () => {
    const f = fichier.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('fichier', f);
    fd.append('titre', f.name.replace(/\.[a-z0-9]+$/i, ''));
    try { await apiForm('mod.portail.depot', fd); toast('Document envoyé à BDA Security Group.'); naviguer(); } catch (e) { toast(e.message, true); }
  };
  return [
    titre('Le coffre', 'Documents'),
    h('nav', { class: 'ec-filtres', 'aria-label': 'Classer' }, FILTRES.map(([k, lib]) => h('a', { href: `#/documents/${k}`, class: k === filtre ? 'is-actif' : '', 'aria-current': k === filtre ? 'true' : null }, lib))),
    filtre === 'tous' && todo.length ? h('div', { class: 'ec-bloc' }, etiquette('À traiter'), h('div', { class: 'ec-lignes' }, todo.map((d) => h('a', { class: 'ec-ligne', href: `#/documents/${d.type}/${d.id}` }, feuillet(true),
      h('span', { class: 'ec-ligne__txt' }, h('b', null, `${d.type === 'facture' ? 'Facture' : 'Devis'} ${d.numero}`), h('small', null, euro.format(+d.total || 0))), pastille(d.type, d.statut))))) : null,
    items.length ? Object.entries(groupes).map(([mois, liste]) => h('div', { class: 'ec-bloc' }, h('h2', { class: 'ec-mois' }, moisLib(mois)), h('div', { class: 'ec-lignes' }, liste.map(ligne))))
      : h('div', { class: 'ec-vide ec-vide--grand' }, h('p', { class: 'ec-italique' }, 'Votre coffre est prêt.'), h('i', { class: 'ec-filet' }), h('p', null, 'Vos documents arriveront ici.')),
    h('div', { class: 'ec-depot' }, fichier, h('label', { class: 'ec-btn ec-btn--second', for: 'ec-depot' }, ic('plus'), 'Déposer un document pour BDA'), h('small', null, 'PDF, JPG ou PNG · 15 Mo au plus')),
  ];
}

/* ---------- Un devis ou une facture, sur papier ---------- */
async function vueDocument(id) {
  const { document: doc } = await api('document', undefined, { id });
  const d = doc.data || {};
  const estFacture = doc.type === 'facture';
  if (!doc.vu_client) recharger();
  const lignes = Array.isArray(d.lignes) ? d.lignes : [];
  const ht = lignes.reduce((s, l) => s + Math.round((+l.qte || 0) * (+l.pu || 0) * 100) / 100, 0);
  const taux = +d.tva || 0;
  const tva = Math.round(ht * taux) / 100;
  const ttc = Math.round((ht + tva) * 100) / 100;
  const qte = (l) => (l.unite === 'h' ? fmtHeures(+l.qte || 0) : new Intl.NumberFormat('fr-FR').format(+l.qte || 0));
  const texte = (t) => String(t || '').split('\n').map((x, i) => [i ? h('br') : null, x]);
  const accord = !estFacture && doc.statut === 'accepte' ? await api('mod.portail.accord', undefined, { id: doc.id }).then((r) => r.accord).catch(() => null) : null;
  const feuille = h('article', { class: 'ec-feuille' },
    h('header', { class: 'ec-feuille__tete' },
      h('img', { src: '/admin/logo-document.jpg?v=4', alt: 'BDA Security Group', class: 'ec-feuille__logo' }),
      h('div', { class: 'ec-feuille__titre' }, h('h2', null, estFacture ? 'Facture' : 'Devis'), h('b', null, `N° ${doc.numero}`), pastille(doc.type, doc.statut))),
    h('div', { class: 'ec-feuille__parties' },
      h('div', null, h('small', null, 'Émetteur'), h('b', null, d.emetteurNom || 'BDA SECURITE'), h('p', null, texte(d.emetteur))),
      h('div', null, h('small', null, estFacture ? 'Facturé à' : 'À l’attention de'), h('b', null, d.client?.nom || ''), h('p', null, texte(d.client?.adresse)))),
    h('div', { class: 'ec-feuille__meta' },
      h('span', null, h('small', null, 'Date'), frDate(doc.date)),
      estFacture ? h('span', null, h('small', null, 'Échéance'), frDate(doc.echeance)) : h('span', null, h('small', null, 'Validité'), d.validite || '—'),
      d.periode ? h('span', null, h('small', null, 'Période'), d.periode) : null),
    !estFacture && (d.objet || d.description) ? h('div', { class: 'ec-feuille__objet' }, h('b', null, d.objet || ''), h('p', null, texte(d.description))) : null,
    !estFacture && (d.lieu || d.horaires || d.effectif) ? h('div', { class: 'ec-feuille__meta' },
      d.lieu ? h('span', null, h('small', null, 'Lieu'), d.lieu) : null, d.horaires ? h('span', null, h('small', null, 'Horaires'), d.horaires) : null, d.effectif ? h('span', null, h('small', null, 'Effectif'), d.effectif) : null) : null,
    h('div', { class: 'ec-feuille__table' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Désignation'), h('th', null, 'Quantité'), h('th', null, 'Prix unitaire'), h('th', null, 'Total'))),
      h('tbody', null, lignes.filter((l) => (+l.qte || 0) || l.designation).map((l) => h('tr', null,
        h('td', null, l.designation || '', l.detail ? h('small', null, l.detail) : null), h('td', null, qte(l)), h('td', null, euro.format(+l.pu || 0)), h('td', null, euro.format(Math.round((+l.qte || 0) * (+l.pu || 0) * 100) / 100))))))),
    h('div', { class: 'ec-feuille__totaux' },
      h('div', null, h('span', null, 'Total HT'), h('b', null, euro.format(ht))),
      h('div', null, h('span', null, taux ? `TVA (${taux} %)` : 'TVA'), h('b', null, taux ? euro.format(tva) : 'Non applicable')),
      h('div', { class: 'is-grand' }, h('span', null, estFacture ? (taux ? 'Net à payer TTC' : 'Net à payer') : (taux ? 'Total TTC' : 'Total')), h('b', null, euro.format(ttc))),
      !estFacture && +d.acompte ? h('div', null, h('span', null, `Acompte à la commande (${d.acompte} %)`), h('b', null, euro.format(Math.round(ttc * d.acompte) / 100))) : null),
    estFacture && d.paiement ? h('div', { class: 'ec-feuille__bloc' }, h('small', null, 'Règlement par virement'), h('p', null, texte(d.paiement))) : null,
    d.conditions ? h('div', { class: 'ec-feuille__bloc' }, h('small', null, 'Conditions'), h('p', { class: 'ec-petit' }, texte(d.conditions))) : null,
    accord ? h('div', { class: 'ec-feuille__cachet' }, h('i'), `Bon pour accord signé en ligne le ${frDate(accord.quand)} à ${heure(accord.quand)} par ${accord.nom}${accord.fonction ? `, ${accord.fonction}` : ''}`) : null,
    d.pied ? h('footer', { class: 'ec-feuille__pied' }, texte(d.pied)) : null);
  const actions = h('div', { class: 'ec-doc-actions' },
    h('a', { class: 'ec-retour', href: '#/documents' }, ic('retour'), 'Documents'),
    h('span', { class: 'ec-doc-actions__boutons' },
      doc.piece_nom ? h('a', { class: 'ec-btn ec-btn--second', href: lien('piece', { id: doc.id }), download: '' }, ic('telecharger'), 'PDF') : null,
      h('button', { class: 'ec-btn ec-btn--second', type: 'button', onclick: () => window.print() }, ic('imprimer'), 'Imprimer'),
      h('button', { class: 'ec-btn ec-btn--second', type: 'button', onclick: vers(estFacture ? 'facture' : '') }, 'Une question')));
  return [actions, h('div', { class: 'ec-papier' }, feuille), !estFacture && doc.statut === 'envoye' ? panneauSignature(doc) : null];
}
// « Bon pour accord » : nom, fonction, conditions acceptées ; puis la signature se trace et le cachet se pose
function panneauSignature(doc) {
  const nom = saisie({ autocomplete: 'name', placeholder: 'Prénom et nom', required: true });
  const fonction = saisie({ autocomplete: 'organization-title', placeholder: 'Ex. gérant' });
  const cgv = h('input', { type: 'checkbox', class: 'ec-case' });
  const msg = h('p', { class: 'ec-erreur', role: 'alert' });
  const btn = h('button', { class: 'ec-btn', type: 'submit' }, 'Signer le devis');
  const zone = h('section', { class: 'ec-accord' });
  const form = h('form', { class: 'ec-form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = '';
    if (!cgv.checked) { msg.textContent = 'Cochez l’acceptation des conditions générales de vente.'; return; }
    btn.disabled = true;
    try {
      const r = await api('mod.portail.devis.signer', { id: doc.id, nom: nom.value.trim(), fonction: fonction.value.trim(), cgv: true });
      const trace = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      trace.setAttribute('viewBox', '0 0 220 64');
      trace.setAttribute('class', 'ec-trace');
      trace.setAttribute('aria-hidden', 'true');
      trace.innerHTML = '<path d="M6 44c14-22 22-34 30-30 8 4-10 34 2 32 10-2 16-26 24-24 7 2-4 22 4 22 9 0 14-18 22-16 7 2 0 16 8 16 12 0 26-20 40-22 12-2 18 8 34 6 14-2 26-10 40-12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
      zone.replaceChildren(h('div', { class: 'ec-signe-ok' }, trace,
        h('p', { class: 'ec-cachet', role: 'status' }, h('i'), `Signé le ${frDate(r.quand)} à ${heure(r.quand)} · ${nom.value.trim()}${fonction.value.trim() ? `, ${fonction.value.trim()}` : ''}`),
        h('p', { class: 'ec-cachet ec-petit' }, 'Le certificat d’accord est rangé dans vos documents et chez BDA Security Group.')));
      await recharger();
    } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } },
  h('div', { class: 'ec-deux-champs' }, champ('Nom du signataire', nom), champ('Fonction', fonction)),
  h('label', { class: 'ec-coche' }, cgv, h('span', null, 'J’accepte le devis et les conditions générales de vente de BDA Security Group.')),
  msg, btn);
  zone.append(h('h2', null, 'Bon pour accord'), h('p', { class: 'ec-titre__sous' }, `En signant, vous acceptez le devis ${doc.numero}. La direction est prévenue aussitôt.`), form);
  return zone;
}

/* ---------- Messages : une correspondance ---------- */
async function vueMessages() {
  const { messages } = await api('mod.portail.messages');
  if (donnees.messagesNonLus) { donnees.messagesNonLus = 0; document.querySelectorAll('.ec-nav .is-actif .ec-point, .ec-barre .is-actif .ec-point').forEach((b) => b.remove()); }
  let jour = '';
  const fil = h('div', { class: 'ec-correspondance', role: 'log' });
  for (const m of messages) {
    if (m.cree.slice(0, 10) !== jour) { jour = m.cree.slice(0, 10); fil.append(h('p', { class: 'ec-jour-sep' }, jourLib(m.cree))); }
    const pieces = m.pieces.map((p) => (p.image
      ? h('button', { class: 'ec-piece ec-piece--image', type: 'button', onclick: () => voirPiece(lien('mod.portail.piece', { id: p.id }), true, p.nom) }, h('img', { src: lien('mod.portail.piece', { id: p.id }), alt: p.nom, loading: 'lazy' }))
      : h('a', { class: 'ec-piece', href: lien('mod.portail.piece', { id: p.id }), target: '_blank', rel: 'noopener' }, feuillet(false), h('span', null, p.nom))));
    const demande = m.demande ? h('span', { class: `ec-demande-tag is-${m.demande.statut}` }, `${m.demande.libelle} · ${m.demande.etat}`) : null;
    fil.append(m.auteur === 'admin'
      ? h('div', { class: 'ec-lettre' }, h('p', null, m.texte), pieces, h('small', null, `Direction · BDA Security Group · ${heure(m.cree)}`))
      : h('div', { class: 'ec-bulle-client' }, demande, h('p', null, m.texte), pieces, h('small', null, `${heure(m.cree)}${m.lu ? ' · lu par BDA' : ''}`)));
  }
  if (!messages.length) fil.append(h('div', { class: 'ec-vide' }, h('p', { class: 'ec-italique' }, 'Une question, un renfort, un souci ?'), h('i', { class: 'ec-filet' }), h('p', null, 'La direction vous répond ici, avec les documents si besoin.')));
  const enCours = messages.filter((m) => m.demande && m.demande.statut !== 'faite').reverse();
  const etapes = ['recue', 'en_cours', 'faite'];
  const suivi = enCours.length ? h('div', { class: 'ec-suivis' }, enCours.slice(0, 3).map((m) => h('div', { class: 'ec-suivi' },
    h('p', null, h('b', null, m.demande.libelle), h('span', null, m.demande.etat)),
    h('span', { class: 'ec-suivi__barre' }, etapes.map((e, i) => h('i', { class: i <= etapes.indexOf(m.demande.statut) ? 'is-fait' : '' }))),
    h('span', { class: 'ec-suivi__etapes' }, h('small', null, 'Reçue'), h('small', null, 'Prise en charge'), h('small', null, 'Faite'))))) : null;

  const zone = h('textarea', { class: 'ec-input ec-saisie', rows: 1, maxlength: 4000, placeholder: demandeChoisie ? AIDE_DEMANDE[demandeChoisie] : 'Écrire à la direction', 'aria-label': 'Message' });
  zone.addEventListener('input', () => { zone.style.height = 'auto'; zone.style.height = `${Math.min(zone.scrollHeight, 160)}px`; });
  const fichier = h('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png,image/webp', class: 'ec-cache', id: 'ec-piece' });
  const joint = h('small', { class: 'ec-joint' });
  fichier.onchange = () => { joint.textContent = fichier.files[0] ? `Pièce jointe : ${fichier.files[0].name}` : ''; };
  const puces = h('div', { class: 'ec-puces', role: 'group', 'aria-label': 'Demandes rapides' });
  const dessinerPuces = () => puces.replaceChildren(...DEMANDES.map(([k, lib]) => h('button', { type: 'button', class: k === demandeChoisie ? 'is-actif' : '', 'aria-pressed': k === demandeChoisie ? 'true' : 'false', onclick: () => { demandeChoisie = demandeChoisie === k ? '' : k; zone.placeholder = demandeChoisie ? AIDE_DEMANDE[demandeChoisie] : 'Écrire à la direction'; dessinerPuces(); zone.focus(); } }, lib)));
  dessinerPuces();
  const envoyer = h('button', { class: 'ec-envoyer', type: 'submit', 'aria-label': 'Envoyer' }, ic('envoyer'));
  const form = h('form', { class: 'ec-composer', onsubmit: async (e) => {
    e.preventDefault();
    if (zone.value.trim().length < 2 && !fichier.files[0]) { zone.focus(); return; }
    const fd = new FormData();
    fd.append('texte', zone.value.trim());
    if (demandeChoisie) fd.append('demande', demandeChoisie);
    if (fichier.files[0]) fd.append('piece', fichier.files[0]);
    envoyer.disabled = true;
    try { await apiForm('mod.portail.message.envoyer', fd); demandeChoisie = ''; toast('Message envoyé à la direction.'); naviguer(); }
    catch (err) { toast(err.message, true); envoyer.disabled = false; }
  } }, fichier, h('label', { class: 'ec-joindre', for: 'ec-piece', title: 'Joindre une photo ou un PDF' }, ic('trombone'), h('span', { class: 'ec-sr' }, 'Joindre une photo ou un PDF')), h('div', { class: 'ec-composer__champ' }, zone, joint), envoyer);
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } });
  requestAnimationFrame(() => { fil.scrollTop = fil.scrollHeight; });
  if (demandeChoisie) setTimeout(() => zone.focus(), 300);
  return [
    titre('Messages', 'La direction', h('span', null, 'Réponse rapide en journée · urgence 24 h/24 : ', h('a', { href: 'tel:+33611678625' }, '06 11 67 86 25'))),
    suivi,
    h('section', { class: 'ec-messagerie' }, fil, puces, form),
  ];
}

/* ---------- Mon compte ---------- */
function vueCompte(deconnexion) {
  const c = donnees.client;
  const actuel = saisie({ type: 'password', autocomplete: 'current-password' });
  const nouveau = saisie({ type: 'password', autocomplete: 'new-password', minlength: 8 });
  const form = h('form', { class: 'ec-form', onsubmit: async (e) => {
    e.preventDefault();
    try { await api('motdepasse', { actuel: actuel.value, nouveau: nouveau.value }); actuel.value = nouveau.value = ''; toast('Mot de passe changé.'); } catch (err) { toast(err.message, true); }
  } }, champ('Mot de passe actuel', actuel), champ('Nouveau mot de passe (8 caractères minimum)', nouveau), h('button', { class: 'ec-btn', type: 'submit' }, 'Changer le mot de passe'));
  return [
    titre('Mon compte', c.nom),
    h('div', { class: 'ec-deux' },
      h('div', { class: 'ec-panneau' }, h('h2', null, 'Vos informations'),
        h('dl', { class: 'ec-infos' }, h('dt', null, 'Société'), h('dd', null, c.nom), h('dt', null, 'Identifiant'), h('dd', null, c.email),
          c.adresse ? [h('dt', null, 'Adresse'), h('dd', null, c.adresse)] : null, c.tel ? [h('dt', null, 'Téléphone'), h('dd', null, c.tel)] : null),
        h('p', { class: 'ec-petit' }, 'Une information à corriger ? ', h('a', { href: '#/messages' }, 'Écrivez-nous'), '.')),
      h('div', { class: 'ec-panneau' }, h('h2', null, 'Sécurité'), form)),
    h('button', { class: 'ec-btn ec-btn--second ec-sortir', type: 'button', onclick: deconnexion }, ic('sortie'), 'Se déconnecter'),
  ];
}

demarrer();
