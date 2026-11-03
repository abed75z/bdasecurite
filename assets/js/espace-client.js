/* =========================================================
   ESPACE CLIENT — bdasecurite.com/espace-client
   Connexion, activation (lien d'invitation), puis un menu clair :
   accueil (votre site en direct), devis (signature en ligne), factures, documents,
   votre équipe (dossiers d'agents partagés par la direction), messagerie, compte.
   Seuls les documents envoyés par BDA depuis l'admin apparaissent.
   Données : /api/client.php (cœur) et ses actions « mod.portail.* » (app/modules/portail.php).
   ========================================================= */
import { fmtHeures } from '/admin/js/outils.js';

const racine = document.getElementById('ec');
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const STATUTS = {
  devis: { envoye: ['À valider', 'attente'], accepte: ['Accepté', 'ok'], refuse: ['Refusé', 'non'] },
  facture: { envoyee: ['À régler', 'attente'], payee: ['Payée', 'ok'], annulee: ['Annulée', 'non'] },
};
const ICONES = {
  accueil: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  devis: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  factures: '<path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z"/><path d="M8 9h8M8 13h8M8 17h4"/>',
  documents: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  equipe: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.8-3 3.2-4.6 6-4.6s5.2 1.6 6 4.6M16 4.9a3.2 3.2 0 0 1 0 6.2M18 15.6c1.5.7 2.5 2.2 3 4.4"/>',
  messages: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  compte: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  plus: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  sortie: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  telephone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  envoyer: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  fleche: '<path d="m9 18 6-6-6-6"/>',
  bouclier: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  imprimer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  coche: '<path d="M20 6 9 17l-5-5"/>',
  planning: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h2M14 14h2M8 18h2"/>',
  telecharger: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  trombone: '<path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10 16.9a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4"/>',
  site: '<path d="M5 21V5h9v16M14 9h5v12M8 8.5h3M8 12.5h3M8 16.5h3M3 21h18"/>',
  oeil: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
const DEMANDES = [['renfort', 'Demande de renfort'], ['planning', 'Modifier le planning'], ['probleme', 'Signaler un problème'], ['facture', 'Question sur une facture']];
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
  setTimeout(() => t.classList.add('is-in'), 10);
  setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 300); }, 3800);
}
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const frDate = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
const frDateHeure = (s) => (s ? `${frDate(s)} à ${String(s).slice(11, 16)}` : '');
const hm = (s) => String(s || '').replace(/^0(\d)/, '$1').replace(':', 'h');
const jourLib = (s) => {
  const j = String(s).slice(0, 10);
  if (j === iso(new Date())) return 'aujourd’hui';
  if (j === iso(new Date(Date.now() + 86400000))) return 'demain';
  const d = new Date(`${j}T12:00:00`);
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
};
const heures = (n) => (n >= 10 ? `${Math.round(n)} h` : fmtHeures(+n || 0));
const pastille = (type, statut) => { const [lib, cls] = STATUTS[type]?.[statut] || [statut, 'attente']; return h('span', { class: `ec-pastille ec-pastille--${cls}` }, lib); };
const champ = (label, input) => h('label', { class: 'ec-champ' }, h('span', null, label), input);
const saisie = (attrs) => h('input', { class: 'ec-input', ...attrs });
const initiales = (nom) => String(nom || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase();
const entete = (surtitre, titre, sous) => h('header', { class: 'ec-entete' }, h('p', null, surtitre), h('h1', null, titre), sous ? h('span', null, sous) : null);
const vide = (icone, texte) => h('div', { class: 'ec-vide' }, ic(icone), h('p', null, texte));

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
  document.body.classList.remove('ec--app');
  return h('main', { class: 'ec-auth ec-auth--centre' },
    h('section', { class: 'ec-auth__carte' },
      h('a', { class: 'ec-auth__marque', href: '/' }, h('img', { src: '/assets/img/blason.svg?v=1', alt: '', width: 34, height: 43 }), h('span', null, h('b', null, 'BDA Security Group'), h('small', null, 'Espace client'))),
      h('h1', null, titre),
      texte ? h('p', { class: 'ec-auth__texte' }, texte) : null,
      contenu,
      h('p', { class: 'ec-auth__aide' }, h('a', { href: 'tel:+33611678625' }, '06 11 67 86 25'), ' · ', h('a', { href: '/' }, 'Retour au site'))));
}
function ecranConnexion(message) {
  const email = saisie({ type: 'email', autocomplete: 'username', required: true, placeholder: 'vous@entreprise.fr' });
  const mdp = saisie({ type: 'password', autocomplete: 'current-password', required: true, placeholder: '••••••••' });
  const msg = h('p', { class: 'ec-erreur', role: 'alert' }, message || '');
  const btn = h('button', { class: 'btn btn--gold', type: 'submit' }, 'Se connecter');
  const form = h('form', { class: 'ec-form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = ''; btn.disabled = true;
    try { await api('connexion', { email: email.value.trim(), motdepasse: mdp.value }); ouvrir(); }
    catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } }, champ('Email', email), champ('Mot de passe', mdp), msg, btn);
  racine.replaceChildren(carteAuth('Connexion', '', form,
    h('p', { class: 'ec-auth__petit' }, 'Première connexion ou mot de passe oublié : contactez-nous.')));
  email.focus();
}
async function ecranInvitation(jeton) {
  let info;
  try { info = await api('invitation.verifier', undefined, { jeton }); } catch (e) { history.replaceState(null, '', location.pathname); return ecranConnexion(e.message); }
  const mdp = saisie({ type: 'password', autocomplete: 'new-password', minlength: 8, required: true });
  const mdp2 = saisie({ type: 'password', autocomplete: 'new-password', required: true });
  const msg = h('p', { class: 'ec-erreur', role: 'alert' });
  const btn = h('button', { class: 'btn btn--gold', type: 'submit' }, 'Activer mon espace');
  const form = h('form', { class: 'ec-form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = '';
    if (mdp.value !== mdp2.value) { msg.textContent = 'Les deux mots de passe ne sont pas identiques.'; return; }
    btn.disabled = true;
    try { await api('invitation', { jeton, motdepasse: mdp.value }); history.replaceState(null, '', location.pathname); toast('Votre espace client est activé. Bienvenue !'); ouvrir(); }
    catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } }, h('p', { class: 'ec-auth__id' }, 'Identifiant : ', h('b', null, info.email)), champ('Choisissez un mot de passe (8 caractères minimum)', mdp), champ('Confirmez le mot de passe', mdp2), msg, btn);
  racine.replaceChildren(carteAuth(`Bienvenue, ${info.client}`, 'Choisissez votre mot de passe pour activer votre espace client.', form));
  mdp.focus();
}

/* ---------- Application ---------- */
const ONGLETS = [['accueil', 'Accueil'], ['devis', 'Devis'], ['factures', 'Factures'], ['documents', 'Documents'], ['equipe', 'Mon équipe'], ['messages', 'Messages'], ['compte', 'Mon compte']];
const BARRE = [['accueil', 'Accueil'], ['devis', 'Devis'], ['factures', 'Factures'], ['messages', 'Messages'], ['plus', 'Plus']];
async function ouvrir() {
  try { donnees = await api('tableau'); } catch (e) { return; }
  document.body.classList.add('ec--app');
  window.onhashchange = naviguer;
  naviguer();
}
async function recharger() { try { donnees = await api('tableau'); } catch (e) { /* session expirée gérée par api() */ } }
function badge(k) {
  const n = k === 'devis' ? donnees.devis.filter((d) => d.statut === 'envoye').length
    : k === 'factures' ? donnees.factures.filter((d) => d.statut === 'envoyee').length
    : k === 'messages' ? donnees.messagesNonLus : 0;
  return n ? h('i', { class: 'ec-nav__badge' }, n) : null;
}
function naviguer() {
  if (!donnees) return;
  const [brut, param] = location.hash.replace(/^#\/?/, '').split('/');
  const onglet = ONGLETS.some(([k]) => k === brut) || brut === 'plus' ? brut : 'accueil';
  const lienNav = ([k, lib]) => h('a', { href: `#/${k}`, class: `ec-nav__item ${k === onglet ? 'is-actif' : ''}`, 'aria-current': k === onglet ? 'page' : null }, ic(k), h('span', null, lib), badge(k));
  const deconnexion = async () => { try { await api('deconnexion', {}); } catch (e) { /* déjà sorti */ } donnees = null; ecranConnexion('Vous êtes déconnecté. À bientôt !'); };
  const cote = h('aside', { class: 'ec-cote' },
    h('a', { class: 'ec-cote__marque', href: '#/accueil' }, h('img', { src: '/assets/img/blason.svg?v=1', alt: '', width: 40, height: 41 }), h('span', null, h('b', null, 'BDA Security Group'), h('small', null, 'Espace client'))),
    h('div', { class: 'ec-cote__client' }, h('span', { class: 'ec-avatar' }, initiales(donnees.client.nom)), h('span', null, h('b', null, donnees.client.nom), h('small', null, donnees.client.email))),
    h('nav', { class: 'ec-nav', 'aria-label': 'Espace client' }, ONGLETS.map(lienNav)),
    h('div', { class: 'ec-cote__bas' },
      h('a', { class: 'ec-cote__contact', href: 'tel:+33611678625' }, ic('telephone'), h('span', null, h('small', null, 'Votre contact 24h/24'), h('b', null, '06 11 67 86 25'))),
      h('button', { class: 'ec-nav__item', type: 'button', onclick: deconnexion }, ic('sortie'), h('span', null, 'Déconnexion'))));
  const plusActif = ['plus', 'documents', 'equipe', 'compte'].includes(onglet);
  const barre = h('nav', { class: 'ec-barre', 'aria-label': 'Navigation' }, BARRE.map(([k, lib]) => h('a', { href: `#/${k}`, class: k === onglet || (k === 'plus' && plusActif) ? 'is-actif' : '' }, ic(k), h('span', null, lib), badge(k))));
  const zone = h('div', { class: 'ec-vue' }, h('div', { class: 'ec-chargement' }, h('span'), h('span'), h('span')));
  racine.replaceChildren(h('div', { class: 'ec-app' }, cote, h('main', { class: 'ec-principal' }, zone)), barre);
  const vues = {
    accueil: vueAccueil,
    devis: () => (param ? vueDocument(param) : vueListe('devis')),
    factures: () => (param ? vueDocument(param) : vueListe('facture')),
    documents: vueDocuments,
    equipe: () => (param ? vueAgent(+param) : vueEquipe()),
    messages: vueMessages,
    compte: () => vueCompte(deconnexion),
    plus: () => vuePlus(deconnexion),
  };
  Promise.resolve(vues[onglet]()).then((contenu) => zone.replaceChildren(...[contenu].flat().filter(Boolean))).catch((e) => zone.replaceChildren(h('p', { class: 'ec-message' }, e.message)));
  window.scrollTo(0, 0);
}

/* ---------- Accueil ---------- */
async function vueAccueil() {
  const { devis, factures, client, messagesNonLus } = donnees;
  const [site, eq] = await Promise.all([api('mod.portail.accueil').catch(() => null), api('mod.portail.equipe').catch(() => ({ agents: [] }))]);
  const aValider = devis.filter((d) => d.statut === 'envoye');
  const aRegler = factures.filter((f) => f.statut === 'envoyee');
  const nouveaux = [...devis, ...factures].filter((d) => !d.vu_client);
  const heure = new Date().getHours();
  const tuile = (href, icone, titre, valeur, sous, alerte) => h('a', { class: `ec-tuile ${alerte ? 'is-alerte' : ''}`, href }, h('span', { class: 'ec-tuile__ic' }, ic(icone)), h('small', null, titre), h('b', null, valeur), h('span', null, sous));
  const recents = [...devis, ...factures].sort((a, b) => String(b.partage).localeCompare(String(a.partage))).slice(0, 5);

  // Votre site : agents en poste maintenant, sinon le prochain passage
  let blocSite = null;
  if (site && (site.sites.length || site.enPoste.length)) {
    const lignes = site.enPoste.length
      ? site.enPoste.map((a) => h('li', { class: 'ec-poste' }, h('i', { class: 'ec-point-vert' }), h('span', null, h('b', null, a.nom), h('small', null, a.qualification)), h('small', null, `en poste depuis ${hm(a.depuis)}`)))
      : [h('li', { class: 'ec-poste' }, h('i', { class: 'ec-point-gris' }), h('span', null, h('b', null, 'Aucun agent en poste en ce moment'), h('small', null, site.prochain ? `Prochain passage ${jourLib(site.prochain.jour)} à ${hm(site.prochain.debut)}${site.prochain.agent ? ` · ${site.prochain.agent}` : ''}` : 'Aucun poste prévu prochainement')))];
    blocSite = h('section', { class: 'ec-carte' },
      h('div', { class: 'ec-carte__tete' }, h('h2', null, site.sites.length === 1 ? site.sites[0] : 'Vos sites'), h('small', { class: 'ec-carte__sous' }, `${heures(site.heuresMois)} de sécurité assurées en ${MOIS[new Date().getMonth()]}`)),
      h('ul', { class: 'ec-postes' }, lignes),
      eq.agents.length ? h('a', { class: 'ec-lien-simple', href: '#/equipe' }, `Voir les dossiers de vos agents (${eq.agents.length})`, ic('fleche')) : null);
  }

  return [
    h('section', { class: 'ec-hero' },
      h('div', null, h('p', null, heure < 18 ? 'Bonjour' : 'Bonsoir'), h('h1', null, client.nom),
        h('span', null, nouveaux.length ? `${nouveaux.length} nouveau${nouveaux.length > 1 ? 'x' : ''} document${nouveaux.length > 1 ? 's' : ''} vous attend${nouveaux.length > 1 ? 'ent' : ''}.` : 'Tout est à jour dans votre espace.')),
      h('div', { class: 'ec-hero__badge' }, ic('bouclier'), h('span', null, 'Espace sécurisé'))),
    h('div', { class: 'ec-tuiles' },
      tuile('#/devis', 'devis', 'Devis', aValider.length ? `${aValider.length} à valider` : String(devis.length), aValider.length ? 'En attente de votre accord' : 'Devis reçus', aValider.length > 0),
      tuile('#/factures', 'factures', 'Factures', aRegler.length ? `${aRegler.length} à régler` : String(factures.length), aRegler.length ? 'En attente de règlement' : 'Factures reçues', aRegler.length > 0),
      tuile('#/messages', 'messages', 'Messages', messagesNonLus ? `${messagesNonLus} non lu${messagesNonLus > 1 ? 's' : ''}` : 'Écrire', messagesNonLus ? 'Réponse de BDA Security Group' : 'Une question ? Écrivez-nous', messagesNonLus > 0)),
    blocSite,
    h('section', { class: 'ec-carte' }, h('div', { class: 'ec-carte__tete' }, h('h2', null, 'Derniers documents reçus'), h('a', { class: 'ec-lien-simple', href: '#/documents' }, 'Tous vos documents', ic('fleche'))),
      recents.length ? h('ul', { class: 'ec-liste' }, recents.map(ligneDoc)) : vide('devis', 'Vos devis et factures apparaîtront ici dès que BDA Security Group vous les enverra.')),
    h('section', { class: 'ec-carte ec-contact' },
      h('div', null, h('h2', null, 'Une question, un renfort ?'), h('p', null, 'Votre responsable de mission vous répond rapidement.')),
      h('div', { class: 'ec-boutons' },
        h('a', { class: 'btn btn--gold', href: '#/messages' }, 'Écrire un message'),
        h('a', { class: 'btn btn--outline', href: 'tel:+33611678625' }, 'Appeler'))),
  ];
}
function ligneDoc(d) {
  const type = d.type === 'facture' ? 'factures' : 'devis';
  return h('li', null, h('a', { href: `#/${type}/${d.id}`, class: d.vu_client ? '' : 'is-nouveau' },
    h('span', { class: `ec-doc-ic ec-doc-ic--${type}` }, ic(type)),
    h('span', { class: 'ec-liste__txt' }, h('b', null, `${d.type === 'facture' ? 'Facture' : 'Devis'} ${d.numero}`, d.vu_client ? null : h('i', { class: 'ec-nouveau' }, 'Nouveau')),
      h('small', null, `Reçu le ${frDate(d.partage)}${d.type === 'facture' && d.echeance ? ` · échéance ${frDate(d.echeance)}` : ''}`)),
    h('span', { class: 'ec-liste__montant' }, euro.format(+d.total || 0)), pastille(d.type, d.statut), ic('fleche')));
}
function vueListe(type) {
  const liste = type === 'facture' ? donnees.factures : donnees.devis;
  const total = liste.filter((d) => d.statut === (type === 'facture' ? 'envoyee' : 'envoye')).reduce((s, d) => s + (+d.total || 0), 0);
  return [
    entete(type === 'facture' ? 'Facturation' : 'Propositions', type === 'facture' ? 'Vos factures' : 'Vos devis',
      total ? `${euro.format(total)} ${type === 'facture' ? 'à régler' : 'en attente de validation'}` : null),
    h('section', { class: 'ec-carte' },
      liste.length ? h('ul', { class: 'ec-liste' }, liste.map(ligneDoc)) : vide(type === 'facture' ? 'factures' : 'devis', type === 'facture' ? 'Aucune facture pour le moment.' : 'Aucun devis pour le moment.')),
    type === 'facture' ? sectionPlannings() : null,
  ];
}
// Détail des heures et PDF envoyés par BDA (onglet « PDF clients » de l'admin)
const libelleMois = (p) => (/^\d{4}-\d{2}$/.test(p || '') ? `${MOIS[+p.slice(5) - 1].replace(/^./, (c) => c.toUpperCase())} ${p.slice(0, 4)}` : '');
function sectionPlannings() {
  const liste = donnees.plannings || [];
  return h('section', { class: 'ec-carte' },
    h('div', { class: 'ec-carte__tete' }, h('h2', null, 'Détail des heures et PDF'), h('small', { class: 'ec-carte__sous' }, 'Détail des heures de nos agents et documents envoyés par BDA')),
    liste.length ? h('ul', { class: 'ec-liste' }, liste.map((p) => h('li', null, h('a', {
      href: lien('envoi', { id: p.id }), download: '', class: p.vu ? '' : 'is-nouveau', onclick: () => setTimeout(recharger, 1500),
    },
    h('span', { class: 'ec-doc-ic ec-doc-ic--factures' }, ic('planning')),
    h('span', { class: 'ec-liste__txt' }, h('b', null, p.titre, p.vu ? null : h('i', { class: 'ec-nouveau' }, 'Nouveau')),
      h('small', null, [libelleMois(p.periode), `reçu le ${frDate(p.cree)}`].filter(Boolean).join(' · '))),
    h('span', { class: 'ec-telecharger' }, ic('telecharger'), 'PDF')))))
      : vide('planning', 'Le détail des heures de vos prestations et les documents que nous vous envoyons apparaîtront ici.'));
}

/* ---------- Documents : tout ce que BDA vous a envoyé, et ce que vous nous envoyez ---------- */
async function vueDocuments() {
  const extra = await api('mod.portail.documents');
  const fichier = h('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png,image/webp', class: 'ec-cache', id: 'ec-depot' });
  fichier.onchange = async () => {
    const f = fichier.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('fichier', f);
    fd.append('titre', f.name.replace(/\.[a-z0-9]+$/i, ''));
    try { await apiForm('mod.portail.depot', fd); toast('Document envoyé à BDA Security Group.'); naviguer(); } catch (e) { toast(e.message, true); }
  };
  const ligneFichier = (url, icone, titre, sous, nouveau) => h('li', null, h('a', { href: url, target: '_blank', rel: 'noopener', class: nouveau ? 'is-nouveau' : '' },
    h('span', { class: 'ec-doc-ic' }, ic(icone)), h('span', { class: 'ec-liste__txt' }, h('b', null, titre), h('small', null, sous)), h('span', { class: 'ec-telecharger' }, ic('oeil'), 'Ouvrir')));
  const accords = extra.accords || [];
  const pieces = [...donnees.devis, ...donnees.factures].sort((x, y) => String(y.date || y.partage).localeCompare(String(x.date || x.partage)));
  return [
    entete('Documents', 'Tous vos documents', 'Tout ce que nous avons échangé, au même endroit : devis, factures, détail des heures, dossiers de vos agents.'),
    h('section', { class: 'ec-carte' },
      h('div', { class: 'ec-carte__tete' }, h('h2', null, 'Devis et factures'), h('small', { class: 'ec-carte__sous' }, `${donnees.devis.length} devis · ${donnees.factures.length} facture${donnees.factures.length > 1 ? 's' : ''}`)),
      pieces.length ? h('ul', { class: 'ec-liste' }, pieces.map(ligneDoc)) : vide('devis', 'Vos devis et factures apparaîtront ici dès que BDA Security Group vous les enverra.')),
    sectionPlannings(),
    h('section', { class: 'ec-carte' },
      h('div', { class: 'ec-carte__tete' }, h('h2', null, 'Documents de vos agents'), h('a', { class: 'ec-lien-simple', href: '#/equipe' }, 'Mon équipe', ic('fleche'))),
      extra.agents.length ? h('ul', { class: 'ec-liste' }, extra.agents.map((d) => ligneFichier(lien('mod.portail.agent.doc', { id: d.id }), 'bouclier', d.titre, `${d.nom} · partagé le ${frDate(d.date)}`)))
        : vide('equipe', 'Les cartes professionnelles et diplômes de vos agents apparaîtront ici quand la direction les partagera.')),
    accords.length ? h('section', { class: 'ec-carte' }, h('h2', null, 'Devis signés en ligne'),
      h('ul', { class: 'ec-liste' }, accords.map((a) => h('li', null, h('a', { href: `#/devis/${a.document_id}` },
        h('span', { class: 'ec-doc-ic' }, ic('coche')), h('span', { class: 'ec-liste__txt' }, h('b', null, `Devis ${a.numero}`), h('small', null, `Bon pour accord du ${frDateHeure(a.quand)} · ${a.nom}${a.fonction ? `, ${a.fonction}` : ''}`)), ic('fleche')))))) : null,
    h('section', { class: 'ec-carte' },
      h('div', { class: 'ec-carte__tete' }, h('h2', null, 'Documents envoyés à BDA'), h('label', { class: 'btn btn--outline ec-depot', for: 'ec-depot' }, 'Envoyer un document'), fichier),
      extra.depots.length ? h('ul', { class: 'ec-liste' }, extra.depots.map((d) => ligneFichier(lien('mod.portail.depot.fichier', { id: d.id }), 'documents', d.titre, `Envoyé le ${frDate(d.cree)} · ${d.vu ? 'reçu par BDA' : 'en attente de lecture'}`)))
        : vide('documents', 'Bon de commande, plan, liste de badges, photo… envoyez-nous vos documents ici (PDF, JPG ou PNG, 15 Mo au plus).')),
  ];
}

/* ---------- Mon équipe : dossiers d'agents partagés par la direction ---------- */
const ETATS_CARTE = { valide: ['Carte pro valide', 'ok'], expiree: ['Carte pro expirée', 'non'], a_verifier: ['Carte pro à vérifier', 'attente'], inactif: ['Inactif', 'non'] };
async function vueEquipe() {
  const { agents } = await api('mod.portail.equipe');
  return [
    entete('Mon équipe', 'Vos agents', 'Les agents affectés à votre site et les documents que BDA Security Group partage avec vous.'),
    agents.length ? h('div', { class: 'ec-agents' }, agents.map((a) => {
      const [lib, ton] = ETATS_CARTE[a.etat] || ETATS_CARTE.a_verifier;
      return h('a', { class: 'ec-agent', href: `#/equipe/${a.id}` },
        h('span', { class: 'ec-agent__avatar' }, initiales(a.nom)),
        h('span', { class: 'ec-agent__txt' }, h('b', null, a.nom), h('small', null, a.qualification),
          a.enPoste ? h('span', { class: 'ec-pastille ec-pastille--ok' }, `En poste depuis ${hm(a.enPoste)}`) : h('span', { class: `ec-pastille ec-pastille--${ton}` }, lib)),
        ic('fleche'));
    })) : h('section', { class: 'ec-carte' }, vide('equipe', 'Les dossiers de vos agents apparaîtront ici quand la direction les partagera avec vous.')),
  ];
}
async function vueAgent(id) {
  const { agents } = await api('mod.portail.equipe');
  const a = agents.find((x) => x.id === id);
  if (!a) return [entete('Mon équipe', 'Dossier indisponible'), h('section', { class: 'ec-carte' }, vide('equipe', 'Ce dossier n’est plus partagé.'), h('a', { class: 'btn btn--outline', href: '#/equipe' }, 'Retour à l’équipe'))];
  const [lib, ton] = ETATS_CARTE[a.etat] || ETATS_CARTE.a_verifier;
  const ligne = (titre, sous, droite) => h('li', { class: 'ec-ligne' }, h('span', { class: 'ec-liste__txt' }, h('b', null, titre), h('small', null, sous)), droite);
  return [
    h('div', { class: 'ec-doc__actions' }, h('a', { class: 'ec-retour', href: '#/equipe' }, '← Mon équipe')),
    h('section', { class: 'ec-hero ec-hero--agent' },
      h('div', null, h('p', null, 'Dossier de l’agent'), h('h1', null, a.nom), h('span', null, a.qualification)),
      a.verifier ? h('a', { class: 'btn btn--gold', href: a.verifier, target: '_blank', rel: 'noopener' }, ic('bouclier'), 'Vérifier en direct') : null),
    h('section', { class: 'ec-carte' }, h('h2', null, 'Habilitations'),
      h('ul', { class: 'ec-lignes' },
        ligne('Carte professionnelle CNAPS', [a.carte, a.validite ? `valide jusqu’au ${a.validite}` : ''].filter(Boolean).join(' · ') || 'non renseignée', h('span', { class: `ec-pastille ec-pastille--${ton}` }, lib)),
        a.formations.map((f) => ligne(f.libelle, f.expire ? `${f.valide ? 'valide jusqu’au' : 'expirée le'} ${frDate(f.expire)}` : 'à jour', h('span', { class: `ec-pastille ec-pastille--${f.valide ? 'ok' : 'attente'}` }, f.valide ? 'Valide' : 'À renouveler'))))),
    h('section', { class: 'ec-carte' }, h('h2', null, 'Documents partagés'),
      a.docs.length ? h('ul', { class: 'ec-liste' }, a.docs.map((d) => h('li', null, h('a', { href: lien('mod.portail.agent.doc', { id: d.id }), target: '_blank', rel: 'noopener' },
        h('span', { class: 'ec-doc-ic' }, ic('bouclier')), h('span', { class: 'ec-liste__txt' }, h('b', null, d.type), h('small', null, `${d.nom} · partagé le ${frDate(d.ajoute)}`)), h('span', { class: 'ec-telecharger' }, ic('oeil'), 'Ouvrir')))))
        : vide('documents', 'Aucun document partagé pour cet agent.')),
    h('section', { class: 'ec-carte' }, h('h2', null, 'Sur votre site'),
      h('ul', { class: 'ec-lignes' },
        a.depuis ? ligne('Chez vous depuis', `le ${frDate(a.depuis)}`) : null,
        ligne(`Heures en ${MOIS[new Date().getMonth()]}`, heures(a.heuresMois)))),
    h('p', { class: 'ec-petit ec-centre' }, 'Copies remises par BDA Security Group pour le contrôle de la prestation. Merci de ne pas les diffuser.'),
  ];
}

/* ---------- Document (devis / facture) en lecture ---------- */
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
  const panneau = !estFacture && doc.statut === 'envoye' ? panneauSignature(doc) : null;
  const signer = panneau ? h('button', { class: 'btn btn--gold', type: 'button', onclick: () => panneau.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, ic('coche'), 'Signer ce devis') : null;
  const actions = h('div', { class: 'ec-doc__actions' },
    h('a', { class: 'ec-retour', href: estFacture ? '#/factures' : '#/devis' }, '← ', estFacture ? 'Factures' : 'Devis'),
    doc.piece_nom ? h('a', { class: 'btn btn--gold', href: lien('piece', { id: doc.id }), download: '' }, ic(estFacture ? 'factures' : 'devis'), 'Télécharger le PDF') : null,
    h('button', { class: 'btn btn--outline', type: 'button', onclick: () => window.print() }, ic('imprimer'), 'Imprimer'),
    h('a', { class: 'btn btn--outline', href: '#/messages', onclick: () => { demandeChoisie = estFacture ? 'facture' : ''; } }, ic('messages'), 'Une question'),
    signer);
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
    accord ? h('div', { class: 'ec-feuille__bloc ec-accord-fait' }, h('small', null, 'Bon pour accord'), h('p', null, `Signé en ligne le ${frDateHeure(accord.quand)} par ${accord.nom}${accord.fonction ? `, ${accord.fonction}` : ''}.`)) : null,
    d.pied ? h('footer', { class: 'ec-feuille__pied' }, texte(d.pied)) : null);
  return [actions, feuille, panneau];
}
// « Bon pour accord » : nom, fonction et conditions acceptées ; la direction est prévenue aussitôt
function panneauSignature(doc) {
  const nom = saisie({ autocomplete: 'name', placeholder: 'Prénom et nom', required: true });
  const fonction = saisie({ autocomplete: 'organization-title', placeholder: 'Ex. directeur, gérant…' });
  const cgv = h('input', { type: 'checkbox', class: 'ec-case' });
  const msg = h('p', { class: 'ec-erreur', role: 'alert' });
  const btn = h('button', { class: 'btn btn--gold', type: 'submit' }, ic('coche'), 'Signer le devis');
  const zone = h('section', { class: 'ec-carte ec-signature' });
  const form = h('form', { class: 'ec-form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = '';
    if (!cgv.checked) { msg.textContent = 'Cochez l’acceptation du devis et des conditions générales de vente.'; return; }
    btn.disabled = true;
    try {
      const r = await api('mod.portail.devis.signer', { id: doc.id, nom: nom.value.trim(), fonction: fonction.value.trim(), cgv: true });
      await recharger();
      zone.replaceChildren(h('div', { class: 'ec-signe-ok' }, ic('coche'), h('div', null, h('b', null, 'Merci, votre devis est signé.'), h('p', null, `Bon pour accord enregistré le ${frDateHeure(r.quand)}. BDA Security Group est prévenu et vous recontacte pour la mise en place.`))));
    } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } },
  h('div', { class: 'ec-deux-champs' }, champ('Nom du signataire', nom), champ('Fonction', fonction)),
  h('label', { class: 'ec-coche' }, cgv, h('span', null, `J’accepte le devis ${doc.numero} et les conditions générales de vente de BDA Security Group.`)),
  msg, btn);
  zone.append(h('div', { class: 'ec-carte__tete' }, h('h2', null, 'Bon pour accord'), h('small', { class: 'ec-carte__sous' }, 'Signature en ligne, valable comme un accord écrit')), form);
  return zone;
}

/* ---------- Messages ---------- */
async function vueMessages() {
  const { messages } = await api('mod.portail.messages');
  if (donnees.messagesNonLus) { donnees.messagesNonLus = 0; document.querySelectorAll('.ec-nav__item.is-actif .ec-nav__badge, .ec-barre .is-actif .ec-nav__badge').forEach((b) => b.remove()); }
  const piece = (p) => h('a', { class: 'ec-piece', href: lien('mod.portail.piece', { id: p.id }), target: '_blank', rel: 'noopener' },
    p.image ? h('img', { src: lien('mod.portail.piece', { id: p.id }), alt: p.nom, loading: 'lazy' }) : [ic('documents'), h('span', null, p.nom)]);
  const fil = h('div', { class: 'ec-fil' }, messages.length
    ? messages.map((m) => h('div', { class: `ec-bulle ec-bulle--${m.auteur}` },
      m.demande ? h('span', { class: `ec-demande ec-demande--${m.demande.statut}` }, `${m.demande.libelle} · ${m.demande.etat}`) : null,
      h('p', null, m.texte), m.pieces.map(piece),
      h('small', null, `${m.auteur === 'admin' ? 'BDA Security Group' : 'Vous'} · ${frDateHeure(m.cree)}${m.auteur === 'client' && m.lu ? ' · lu' : ''}`)))
    : vide('messages', 'Posez votre question, demandez un renfort ou une modification : votre responsable vous répond rapidement.'));
  const enCours = messages.filter((m) => m.demande && m.demande.statut !== 'faite').reverse();
  const suivi = enCours.length ? h('section', { class: 'ec-carte' }, h('h2', null, 'Vos demandes en cours'),
    h('ul', { class: 'ec-lignes' }, enCours.map((m) => h('li', { class: 'ec-ligne' }, h('span', { class: 'ec-liste__txt' }, h('b', null, m.demande.libelle), h('small', null, `envoyée le ${frDate(m.cree)}`)),
      h('span', { class: `ec-pastille ec-pastille--${m.demande.statut === 'recue' ? 'attente' : 'ok'}` }, m.demande.etat))))) : null;

  const zone = h('textarea', { class: 'ec-input ec-fil__saisie', rows: 3, placeholder: 'Écrivez votre message…', maxlength: 4000 });
  const choix = h('select', { class: 'ec-input ec-choix', 'aria-label': 'Type de message' }, h('option', { value: '' }, 'Message'), DEMANDES.map(([k, lib]) => h('option', { value: k, selected: k === demandeChoisie }, lib)));
  const fichier = h('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png,image/webp', class: 'ec-cache', id: 'ec-piece' });
  const joint = h('small', { class: 'ec-joint' });
  fichier.onchange = () => { joint.textContent = fichier.files[0] ? `Pièce jointe : ${fichier.files[0].name}` : ''; };
  const btn = h('button', { class: 'btn btn--gold', type: 'button', onclick: async () => {
    const texte = zone.value.trim();
    if (texte.length < 2 && !fichier.files[0]) return zone.focus();
    const fd = new FormData();
    fd.append('texte', texte);
    if (choix.value) fd.append('demande', choix.value);
    if (fichier.files[0]) fd.append('piece', fichier.files[0]);
    btn.disabled = true;
    try { await apiForm('mod.portail.message.envoyer', fd); demandeChoisie = ''; toast('Message envoyé à BDA Security Group.'); naviguer(); }
    catch (err) { toast(err.message, true); btn.disabled = false; }
  } }, ic('envoyer'), 'Envoyer');
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); btn.click(); } });
  requestAnimationFrame(() => { fil.scrollTop = fil.scrollHeight; });
  return [
    entete('Messagerie', 'Écrire à BDA Security Group', 'Votre message arrive directement chez votre responsable de mission. Vous pouvez joindre une photo ou un PDF.'),
    suivi,
    h('section', { class: 'ec-carte ec-messagerie' }, fil,
      h('div', { class: 'ec-fil__envoi' },
        h('div', { class: 'ec-fil__options' }, choix, fichier, h('label', { class: 'btn btn--outline ec-joindre', for: 'ec-piece' }, ic('trombone'), 'Joindre'), joint),
        h('div', { class: 'ec-fil__ligne' }, zone, btn))),
    h('p', { class: 'ec-petit ec-centre' }, 'Pour une urgence, appelez le ', h('a', { href: 'tel:+33611678625' }, '06 11 67 86 25'), ', 24h/24.'),
  ];
}

/* ---------- Plus (téléphone) ---------- */
function vuePlus(deconnexion) {
  const ligne = (href, icone, titre, sous) => h('li', null, h('a', { href }, h('span', { class: 'ec-doc-ic' }, ic(icone)), h('span', { class: 'ec-liste__txt' }, h('b', null, titre), h('small', null, sous)), ic('fleche')));
  return [
    entete('Espace client', 'Plus'),
    h('section', { class: 'ec-carte' }, h('ul', { class: 'ec-liste' },
      ligne('#/documents', 'documents', 'Documents', 'Détail des heures, PDF, documents envoyés'),
      ligne('#/equipe', 'equipe', 'Mon équipe', 'Dossiers de vos agents'),
      ligne('#/compte', 'compte', 'Mon compte', 'Informations et mot de passe'))),
    h('button', { class: 'btn btn--outline', type: 'button', onclick: deconnexion }, ic('sortie'), 'Déconnexion'),
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
  } }, champ('Mot de passe actuel', actuel), champ('Nouveau mot de passe (8 caractères minimum)', nouveau), h('button', { class: 'btn btn--gold', type: 'submit' }, 'Changer le mot de passe'));
  return [
    entete('Mon compte', c.nom),
    h('section', { class: 'ec-carte' }, h('h2', null, 'Vos informations'),
      h('dl', { class: 'ec-infos' }, h('dt', null, 'Société'), h('dd', null, c.nom), h('dt', null, 'Identifiant'), h('dd', null, c.email),
        c.adresse ? [h('dt', null, 'Adresse'), h('dd', null, c.adresse)] : null, c.tel ? [h('dt', null, 'Téléphone'), h('dd', null, c.tel)] : null),
      h('p', { class: 'ec-petit' }, 'Une information à corriger ? ', h('a', { href: '#/messages' }, 'Écrivez-nous'), ', nous la mettons à jour.')),
    h('section', { class: 'ec-carte' }, h('h2', null, 'Sécurité'), form),
    h('button', { class: 'btn btn--outline', type: 'button', onclick: deconnexion }, ic('sortie'), 'Déconnexion'),
  ];
}

demarrer();
