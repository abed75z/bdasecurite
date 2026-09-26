/* =========================================================
   ESPACE CLIENT — bdasecurite.com/espace-client
   Connexion, activation (lien d'invitation), puis :
   accueil, devis (acceptation en ligne), factures, messagerie avec BDA.
   Seuls les documents envoyés par BDA depuis l'admin apparaissent.
   Données : /api/client.php (session client séparée de l'admin).
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
  messages: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  compte: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  sortie: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  telephone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  envoyer: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  fleche: '<path d="m9 18 6-6-6-6"/>',
  bouclier: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  imprimer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  coche: '<path d="M20 6 9 17l-5-5"/>',
};
let csrf = '';
let donnees = null;

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
async function api(a, corps, params = {}) {
  const opts = { credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (corps !== undefined) { opts.method = 'POST'; opts.headers['Content-Type'] = 'application/json'; opts.headers['X-CSRF'] = csrf; opts.body = JSON.stringify(corps); }
  let r;
  try { r = await fetch(`/api/client.php?${new URLSearchParams({ a, ...params })}`, opts); } catch (e) { throw new Error('Connexion impossible. Vérifiez votre accès à internet.'); }
  const j = await r.json().catch(() => ({}));
  if (j.csrf) csrf = j.csrf;
  if (r.status === 401 && a !== 'connexion') { ecranConnexion('Votre session a expiré : reconnectez-vous.'); throw new Error('Connexion requise.'); }
  if (!r.ok || j.ok === false) throw new Error(j.erreur || `Erreur ${r.status}`);
  return j;
}
function toast(msg, erreur) {
  const t = h('div', { class: `ec-toast ${erreur ? 'is-erreur' : ''}`, role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add('is-in'), 10);
  setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 300); }, 3800);
}
const frDate = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
const frDateHeure = (s) => (s ? `${frDate(s)} à ${String(s).slice(11, 16)}` : '');
const pastille = (type, statut) => { const [lib, cls] = STATUTS[type]?.[statut] || [statut, 'attente']; return h('span', { class: `ec-pastille ec-pastille--${cls}` }, lib); };
const champ = (label, input) => h('label', { class: 'ec-champ' }, h('span', null, label), input);
const saisie = (attrs) => h('input', { class: 'ec-input', ...attrs });
const initiales = (nom) => String(nom || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase();

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
  return h('main', { class: 'ec-auth' },
    h('section', { class: 'ec-auth__visuel', 'aria-hidden': 'true' },
      h('div', { class: 'ec-auth__slogan' }, h('span', null, 'BDA Sécurité'), h('p', null, 'Vos devis, vos factures et un contact direct avec votre responsable de mission, ', h('em', null, 'au même endroit.')))),
    h('section', { class: 'ec-auth__carte' },
      h('a', { class: 'ec-auth__marque', href: '/' }, h('img', { src: 'assets/img/favicon.svg', alt: '', width: 40, height: 46 }), h('span', null, h('b', null, 'BDA Sécurité'), h('small', null, 'Espace client'))),
      h('h1', null, titre),
      texte ? h('p', { class: 'ec-auth__texte' }, texte) : null,
      contenu,
      h('p', { class: 'ec-auth__aide' }, 'Besoin d’aide ? ', h('a', { href: 'tel:+33611678625' }, '06 11 67 86 25'), ' · ', h('a', { href: 'https://wa.me/33784739070', target: '_blank', rel: 'noopener' }, 'WhatsApp'), ' · ', h('a', { href: '/' }, 'Retour au site'))));
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
  racine.replaceChildren(carteAuth('Connexion', 'Accédez à votre espace client sécurisé.', form,
    h('p', { class: 'ec-auth__petit' }, 'Première connexion : utilisez le lien d’activation reçu de BDA Sécurité. Mot de passe oublié : contactez-nous, nous vous envoyons un nouveau lien.')));
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
const ONGLETS = [['accueil', 'Accueil'], ['devis', 'Devis'], ['factures', 'Factures'], ['messages', 'Messages'], ['compte', 'Mon compte']];
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
  const onglet = ONGLETS.some(([k]) => k === brut) ? brut : 'accueil';
  const lien = ([k, lib]) => h('a', { href: `#/${k}`, class: `ec-nav__item ${k === onglet ? 'is-actif' : ''}` }, ic(k), h('span', null, lib), badge(k));
  const deconnexion = async () => { try { await api('deconnexion', {}); } catch (e) { /* déjà sorti */ } donnees = null; ecranConnexion('Vous êtes déconnecté. À bientôt !'); };
  const cote = h('aside', { class: 'ec-cote' },
    h('a', { class: 'ec-cote__marque', href: '#/accueil' }, h('img', { src: 'assets/img/favicon.svg', alt: '', width: 32, height: 37 }), h('span', null, h('b', null, 'BDA Sécurité'), h('small', null, 'Espace client'))),
    h('div', { class: 'ec-cote__client' }, h('span', { class: 'ec-avatar' }, initiales(donnees.client.nom)), h('span', null, h('b', null, donnees.client.nom), h('small', null, donnees.client.email))),
    h('nav', { class: 'ec-nav', 'aria-label': 'Espace client' }, ONGLETS.map(lien)),
    h('div', { class: 'ec-cote__bas' },
      h('a', { class: 'ec-cote__contact', href: 'tel:+33611678625' }, ic('telephone'), h('span', null, h('small', null, 'Votre contact 24h/24'), h('b', null, '06 11 67 86 25'))),
      h('button', { class: 'ec-nav__item', type: 'button', onclick: deconnexion }, ic('sortie'), h('span', null, 'Déconnexion'))));
  const barre = h('nav', { class: 'ec-barre', 'aria-label': 'Navigation' }, ONGLETS.map(([k, lib]) => h('a', { href: `#/${k}`, class: k === onglet ? 'is-actif' : '' }, ic(k), h('span', null, lib === 'Mon compte' ? 'Compte' : lib), badge(k))));
  const zone = h('div', { class: 'ec-vue' });
  racine.replaceChildren(h('div', { class: 'ec-app' }, cote, h('main', { class: 'ec-principal' }, zone)), barre);
  const vue = { accueil: vueAccueil, devis: () => (param ? vueDocument(param) : vueListe('devis')), factures: () => (param ? vueDocument(param) : vueListe('facture')), messages: vueMessages, compte: vueCompte }[onglet];
  Promise.resolve(vue()).then((contenu) => zone.replaceChildren(...[contenu].flat().filter(Boolean))).catch((e) => zone.replaceChildren(h('p', { class: 'ec-message' }, e.message)));
  window.scrollTo(0, 0);
}
const entete = (surtitre, titre, sous) => h('header', { class: 'ec-entete' }, h('p', null, surtitre), h('h1', null, titre), sous ? h('span', null, sous) : null);

function vueAccueil() {
  const { devis, factures, client, messagesNonLus } = donnees;
  const aValider = devis.filter((d) => d.statut === 'envoye');
  const aRegler = factures.filter((f) => f.statut === 'envoyee');
  const nouveaux = [...devis, ...factures].filter((d) => !d.vu_client);
  const heure = new Date().getHours();
  const tuile = (href, icone, titre, valeur, sous, alerte) => h('a', { class: `ec-tuile ${alerte ? 'is-alerte' : ''}`, href }, h('span', { class: 'ec-tuile__ic' }, ic(icone)), h('small', null, titre), h('b', null, valeur), h('span', null, sous));
  const recents = [...devis, ...factures].sort((a, b) => String(b.partage).localeCompare(String(a.partage))).slice(0, 5);
  return [
    h('section', { class: 'ec-hero' },
      h('div', null, h('p', null, heure < 18 ? 'Bonjour' : 'Bonsoir'), h('h1', null, client.nom),
        h('span', null, nouveaux.length ? `${nouveaux.length} nouveau${nouveaux.length > 1 ? 'x' : ''} document${nouveaux.length > 1 ? 's' : ''} vous attend${nouveaux.length > 1 ? 'ent' : ''}.` : 'Tout est à jour dans votre espace.')),
      h('div', { class: 'ec-hero__badge' }, ic('bouclier'), h('span', null, 'Espace sécurisé'))),
    h('div', { class: 'ec-tuiles' },
      tuile('#/devis', 'devis', 'Devis', aValider.length ? `${aValider.length} à valider` : String(devis.length), aValider.length ? 'En attente de votre accord' : 'Devis reçus', aValider.length > 0),
      tuile('#/factures', 'factures', 'Factures', aRegler.length ? `${aRegler.length} à régler` : String(factures.length), aRegler.length ? 'En attente de règlement' : 'Factures reçues', aRegler.length > 0),
      tuile('#/messages', 'messages', 'Messages', messagesNonLus ? `${messagesNonLus} non lu${messagesNonLus > 1 ? 's' : ''}` : 'Écrire', messagesNonLus ? 'Réponse de BDA Sécurité' : 'Une question ? Écrivez-nous', messagesNonLus > 0)),
    h('section', { class: 'ec-carte' }, h('div', { class: 'ec-carte__tete' }, h('h2', null, 'Derniers documents reçus')),
      recents.length ? h('ul', { class: 'ec-liste' }, recents.map(ligneDoc)) : h('div', { class: 'ec-vide' }, ic('devis'), h('p', null, 'Vos devis et factures apparaîtront ici dès que BDA Sécurité vous les enverra.'))),
    h('section', { class: 'ec-carte ec-contact' },
      h('div', null, h('h2', null, 'Une question, une nouvelle mission ?'), h('p', null, 'Votre responsable de mission vous répond rapidement.')),
      h('div', { class: 'ec-boutons' },
        h('a', { class: 'btn btn--gold', href: '#/messages' }, 'Écrire un message'),
        h('a', { class: 'btn btn--outline', href: 'tel:+33611678625' }, 'Appeler'),
        h('a', { class: 'btn btn--outline', href: 'https://wa.me/33784739070', target: '_blank', rel: 'noopener' }, 'WhatsApp'))),
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
      liste.length ? h('ul', { class: 'ec-liste' }, liste.map(ligneDoc)) : h('div', { class: 'ec-vide' }, ic(type === 'facture' ? 'factures' : 'devis'), h('p', null, type === 'facture' ? 'Aucune facture pour le moment.' : 'Aucun devis pour le moment.'))),
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
  const accepter = !estFacture && doc.statut === 'envoye' ? h('button', { class: 'btn btn--gold', type: 'button', onclick: async (e) => {
    if (!confirm(`Accepter le devis ${doc.numero} ? BDA Sécurité sera prévenu immédiatement.`)) return;
    e.currentTarget.disabled = true;
    try { await api('devis.accepter', { id: doc.id }); toast('Merci ! Votre accord a bien été transmis à BDA Sécurité.'); await recharger(); naviguer(); }
    catch (err) { toast(err.message, true); e.currentTarget.disabled = false; }
  } }, ic('coche'), 'Accepter ce devis') : null;
  const actions = h('div', { class: 'ec-doc__actions' },
    h('a', { class: 'ec-retour', href: estFacture ? '#/factures' : '#/devis' }, '← ', estFacture ? 'Factures' : 'Devis'),
    h('button', { class: 'btn btn--outline', type: 'button', onclick: () => window.print() }, ic('imprimer'), 'Imprimer / PDF'),
    h('a', { class: 'btn btn--outline', href: '#/messages' }, ic('messages'), 'Une question'),
    accepter);
  const feuille = h('article', { class: 'ec-feuille' },
    h('header', { class: 'ec-feuille__tete' },
      h('img', { src: '/admin/logo-document.jpg', alt: 'BDA Sécurité', class: 'ec-feuille__logo' }),
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
    d.pied ? h('footer', { class: 'ec-feuille__pied' }, texte(d.pied)) : null);
  return [actions, feuille];
}

/* ---------- Messages ---------- */
async function vueMessages() {
  const { messages } = await api('messages');
  if (donnees.messagesNonLus) { donnees.messagesNonLus = 0; document.querySelectorAll('.ec-nav__item.is-actif .ec-nav__badge, .ec-barre .is-actif .ec-nav__badge').forEach((b) => b.remove()); }
  const fil = h('div', { class: 'ec-fil' }, messages.length
    ? messages.map((m) => h('div', { class: `ec-bulle ec-bulle--${m.auteur}` }, h('p', null, m.texte), h('small', null, `${m.auteur === 'admin' ? 'BDA Sécurité' : 'Vous'} · ${frDateHeure(m.cree)}`)))
    : h('div', { class: 'ec-vide' }, ic('messages'), h('p', null, 'Posez votre question, demandez une modification de devis ou une nouvelle mission : votre responsable vous répond rapidement.')));
  const zone = h('textarea', { class: 'ec-input ec-fil__saisie', rows: 3, placeholder: 'Écrivez votre message…', maxlength: 4000 });
  const btn = h('button', { class: 'btn btn--gold', type: 'button', onclick: async () => {
    const texte = zone.value.trim();
    if (texte.length < 2) return zone.focus();
    btn.disabled = true;
    try { await api('message.envoyer', { texte }); toast('Message envoyé à BDA Sécurité.'); naviguer(); }
    catch (err) { toast(err.message, true); btn.disabled = false; }
  } }, ic('envoyer'), 'Envoyer');
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); btn.click(); } });
  requestAnimationFrame(() => { fil.scrollTop = fil.scrollHeight; });
  return [
    entete('Messagerie', 'Écrire à BDA Sécurité', 'Votre message arrive directement chez votre responsable de mission. Réponse par ici et par email.'),
    h('section', { class: 'ec-carte ec-messagerie' }, fil, h('div', { class: 'ec-fil__envoi' }, zone, btn)),
    h('p', { class: 'ec-petit ec-centre' }, 'Pour une urgence, appelez le ', h('a', { href: 'tel:+33611678625' }, '06 11 67 86 25'), ', 24h/24.'),
  ];
}

/* ---------- Mon compte ---------- */
function vueCompte() {
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
  ];
}

demarrer();
