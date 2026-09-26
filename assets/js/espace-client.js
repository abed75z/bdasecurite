/* =========================================================
   ESPACE CLIENT — bdasecurite.com/espace-client
   Connexion, activation du compte (lien d'invitation), puis :
   accueil, devis (acceptation en ligne), factures, planning des agents.
   Les données viennent de /api/client.php (session client séparée).
   ========================================================= */
import { totauxDuMois } from '/admin/js/planning.js';
import { fmtHeures } from '/admin/js/outils.js';

const racine = document.getElementById('ec');
const zoneCompte = document.getElementById('ec-compte');
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const STATUTS = {
  devis: { envoye: ['À valider', 'attente'], accepte: ['Accepté', 'ok'], refuse: ['Refusé', 'non'] },
  facture: { envoyee: ['À régler', 'attente'], payee: ['Payée', 'ok'], annulee: ['Annulée', 'non'] },
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
const nomMois = (m) => `${MOIS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
const pastille = (type, statut) => { const [lib, cls] = STATUTS[type]?.[statut] || [statut, 'attente']; return h('span', { class: `ec-pastille ec-pastille--${cls}` }, lib); };
const champ = (label, input) => h('label', { class: 'ec-champ' }, h('span', null, label), input);
const saisie = (attrs) => h('input', { class: 'ec-input', ...attrs });

/* ---------- Démarrage ---------- */
async function demarrer() {
  const jeton = (location.hash.match(/invitation=([a-f0-9]{48})/) || [])[1];
  let s;
  try { s = await api('session'); } catch (e) { return racine.replaceChildren(h('p', { class: 'ec-message' }, e.message)); }
  if (jeton) return ecranInvitation(jeton);
  if (!s.connecte) return ecranConnexion();
  ouvrir();
}

/* ---------- Connexion ---------- */
function carteAuth(titre, texte, ...contenu) {
  zoneCompte.replaceChildren(h('a', { class: 'ec-lien', href: '/' }, '← Retour au site'));
  return h('main', { class: 'ec-auth' }, h('section', { class: 'ec-auth__carte' },
    h('span', { class: 'ec-badge' }, 'Espace client'),
    h('h1', null, titre),
    texte ? h('p', { class: 'ec-auth__texte' }, texte) : null,
    contenu,
    h('p', { class: 'ec-auth__aide' }, 'Besoin d’aide ? ', h('a', { href: 'tel:+33611678625' }, '06 11 67 86 25'), ' · ', h('a', { href: 'https://wa.me/33784739070', target: '_blank', rel: 'noopener' }, 'WhatsApp'))));
}
function ecranConnexion(message) {
  const email = saisie({ type: 'email', autocomplete: 'username', required: true });
  const mdp = saisie({ type: 'password', autocomplete: 'current-password', required: true });
  const msg = h('p', { class: 'ec-erreur', role: 'alert' }, message || '');
  const btn = h('button', { class: 'btn btn--gold', type: 'submit' }, 'Se connecter');
  const form = h('form', { class: 'ec-form', onsubmit: async (e) => {
    e.preventDefault(); msg.textContent = ''; btn.disabled = true;
    try { await api('connexion', { email: email.value.trim(), motdepasse: mdp.value }); ouvrir(); }
    catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } }, champ('Email', email), champ('Mot de passe', mdp), msg, btn);
  racine.replaceChildren(carteAuth('Bienvenue', 'Retrouvez vos devis, vos factures et le planning de vos agents.', form,
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
    try { await api('invitation', { jeton, motdepasse: mdp.value }); history.replaceState(null, '', location.pathname); toast('Votre espace client est activé.'); ouvrir(); }
    catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } }, h('p', { class: 'ec-auth__id' }, 'Identifiant : ', h('b', null, info.email)), champ('Choisissez un mot de passe (8 caractères minimum)', mdp), champ('Confirmez le mot de passe', mdp2), msg, btn);
  racine.replaceChildren(carteAuth(`Bienvenue, ${info.client}`, 'Choisissez votre mot de passe pour activer votre espace client.', form));
  mdp.focus();
}

/* ---------- Application ---------- */
const ONGLETS = [['accueil', 'Accueil'], ['devis', 'Devis'], ['factures', 'Factures'], ['planning', 'Planning'], ['compte', 'Mon compte']];
async function ouvrir() {
  try { donnees = await api('tableau'); } catch (e) { return; }
  zoneCompte.replaceChildren(h('span', { class: 'ec-client' }, donnees.client.nom),
    h('button', { class: 'ec-lien', type: 'button', onclick: async () => { try { await api('deconnexion', {}); } catch (e) { /* déjà sorti */ } ecranConnexion('Vous êtes déconnecté.'); } }, 'Déconnexion'));
  window.onhashchange = naviguer;
  naviguer();
}
function naviguer() {
  if (!donnees) return;
  const [ongletBrut, param] = location.hash.replace(/^#\/?/, '').split('/');
  const onglet = ongletBrut || 'accueil';
  const nav = h('nav', { class: 'ec-onglets', 'aria-label': 'Espace client' }, ONGLETS.map(([k, lib]) => h('a', { href: `#/${k}`, class: k === onglet ? 'is-actif' : '' }, lib)));
  const vue = { accueil: vueAccueil, devis: () => (param ? vueDocument(param) : vueListe('devis')), factures: () => (param ? vueDocument(param) : vueListe('facture')), planning: () => vuePlanning(param), compte: vueCompte }[onglet] || vueAccueil;
  const zone = h('div', { class: 'ec-vue' });
  racine.replaceChildren(h('main', { class: 'ec-app' }, nav, zone));
  Promise.resolve(vue()).then((contenu) => zone.replaceChildren(...[contenu].flat().filter(Boolean))).catch((e) => zone.replaceChildren(h('p', { class: 'ec-message' }, e.message)));
  window.scrollTo(0, 0);
}

function vueAccueil() {
  const { devis, factures, plannings, client } = donnees;
  const aValider = devis.filter((d) => d.statut === 'envoye');
  const aRegler = factures.filter((f) => f.statut === 'envoyee');
  const tuile = (href, titre, valeur, sous, alerte) => h('a', { class: `ec-tuile ${alerte ? 'is-alerte' : ''}`, href }, h('small', null, titre), h('b', null, valeur), h('span', null, sous));
  const recents = [...devis, ...factures].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5);
  return [
    h('section', { class: 'ec-bienvenue' }, h('p', null, 'Votre espace client'), h('h1', null, 'Bonjour, ', h('em', null, client.nom), '.')),
    h('div', { class: 'ec-tuiles' },
      tuile('#/devis', 'Devis', aValider.length ? `${aValider.length} à valider` : `${devis.length}`, aValider.length ? 'En attente de votre accord' : 'Tous vos devis', aValider.length > 0),
      tuile('#/factures', 'Factures', aRegler.length ? `${aRegler.length} à régler` : `${factures.length}`, aRegler.length ? 'En attente de règlement' : 'Toutes vos factures', aRegler.length > 0),
      tuile('#/planning', 'Planning', plannings.length ? nomMois(plannings[0].mois) : '—', plannings.length ? 'Dernier planning disponible' : 'Aucun planning pour le moment')),
    h('section', { class: 'ec-carte' }, h('h2', null, 'Derniers documents'),
      recents.length ? h('ul', { class: 'ec-liste' }, recents.map(ligneDoc)) : h('p', { class: 'ec-vide' }, 'Vos devis et factures apparaîtront ici dès qu’ils vous seront envoyés.')),
    h('section', { class: 'ec-carte ec-contact' }, h('h2', null, 'Une question, une nouvelle mission ?'),
      h('p', null, 'Votre interlocuteur BDA Sécurité vous répond 24h/24.'),
      h('div', { class: 'ec-boutons' },
        h('a', { class: 'btn btn--gold', href: 'tel:+33611678625' }, 'Appeler le 06 11 67 86 25'),
        h('a', { class: 'btn btn--outline', href: 'https://wa.me/33784739070', target: '_blank', rel: 'noopener' }, 'WhatsApp'),
        h('a', { class: 'btn btn--outline', href: 'devis' }, 'Nouvelle demande de devis'))),
  ];
}
function ligneDoc(d) {
  const type = d.type === 'facture' ? 'factures' : 'devis';
  return h('li', null, h('a', { href: `#/${type}/${d.id}` },
    h('span', { class: 'ec-liste__txt' }, h('b', null, `${d.type === 'facture' ? 'Facture' : 'Devis'} ${d.numero}`), h('small', null, `${frDate(d.date)}${d.type === 'facture' && d.echeance ? ` · échéance ${frDate(d.echeance)}` : ''}`)),
    h('span', { class: 'ec-liste__montant' }, euro.format(+d.total || 0)), pastille(d.type, d.statut)));
}
function vueListe(type) {
  const liste = type === 'facture' ? donnees.factures : donnees.devis;
  return h('section', { class: 'ec-carte' }, h('h2', null, type === 'facture' ? 'Vos factures' : 'Vos devis'),
    liste.length ? h('ul', { class: 'ec-liste' }, liste.map(ligneDoc)) : h('p', { class: 'ec-vide' }, type === 'facture' ? 'Aucune facture pour le moment.' : 'Aucun devis pour le moment.'));
}

/* ---------- Document (devis / facture) en lecture ---------- */
async function vueDocument(id) {
  const { document: doc } = await api('document', undefined, { id });
  const d = doc.data || {};
  const estFacture = doc.type === 'facture';
  const lignes = Array.isArray(d.lignes) ? d.lignes : [];
  const ht = lignes.reduce((s, l) => s + Math.round((+l.qte || 0) * (+l.pu || 0) * 100) / 100, 0);
  const taux = +d.tva || 0;
  const tva = Math.round(ht * taux) / 100;
  const ttc = Math.round((ht + tva) * 100) / 100;
  const qte = (l) => (l.unite === 'h' ? fmtHeures(+l.qte || 0) : new Intl.NumberFormat('fr-FR').format(+l.qte || 0));
  const texte = (t) => String(t || '').split('\n').map((x, i) => [i ? h('br') : null, x]);
  const actions = h('div', { class: 'ec-doc__actions' },
    h('a', { class: 'ec-lien', href: estFacture ? '#/factures' : '#/devis' }, '← Retour'),
    h('button', { class: 'btn btn--outline', type: 'button', onclick: () => window.print() }, 'Imprimer / PDF'),
    !estFacture && doc.statut === 'envoye' ? h('button', { class: 'btn btn--gold', type: 'button', onclick: async (e) => {
      if (!confirm(`Accepter le devis ${doc.numero} ? BDA Sécurité sera prévenu immédiatement.`)) return;
      e.target.disabled = true;
      try { await api('devis.accepter', { id: doc.id }); toast('Merci ! Votre accord a bien été transmis à BDA Sécurité.'); donnees = await api('tableau'); naviguer(); }
      catch (err) { toast(err.message, true); e.target.disabled = false; }
    } }, 'Accepter ce devis (bon pour accord)') : null);
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

/* ---------- Planning ---------- */
async function vuePlanning(mois) {
  const liste = donnees.plannings;
  if (!liste.length) return h('section', { class: 'ec-carte' }, h('h2', null, 'Planning de vos agents'), h('p', { class: 'ec-vide' }, 'Aucun planning n’est encore disponible. Il apparaîtra ici dès que votre mission sera planifiée.'));
  const choisi = liste.find((p) => p.mois === mois)?.mois || liste[0].mois;
  const { planning: p } = await api('planning', undefined, { mois: choisi });
  const [y, m] = choisi.split('-').map(Number);
  const nb = new Date(y, m, 0).getDate();
  const jours = Array.from({ length: nb }, (_, i) => { const dt = new Date(y, m - 1, i + 1); return { cle: `${choisi}-${String(i + 1).padStart(2, '0')}`, d: i + 1, j: JOURS[dt.getDay()], we: dt.getDay() === 0 || dt.getDay() === 6 }; });
  const totaux = [];
  const G = totauxDuMois(p, choisi, (i, T) => { totaux[i] = T; });
  const select = h('select', { class: 'ec-input ec-input--auto', onchange: (e) => { location.hash = `#/planning/${e.target.value}`; } },
    liste.map((x) => h('option', { value: x.mois, selected: x.mois === choisi }, nomMois(x.mois))));
  return h('section', { class: 'ec-carte' },
    h('div', { class: 'ec-carte__tete' }, h('h2', null, `Planning — ${nomMois(choisi)}`), select),
    p.site || p.mission ? h('p', { class: 'ec-petit' }, [p.site, p.mission].filter(Boolean).join(' · ')) : null,
    h('div', { class: 'ec-planning' }, h('table', null,
      h('thead', null, h('tr', null, h('th', { class: 'ec-planning__agent' }, 'Agent'), jours.map((j) => h('th', { class: j.we ? 'is-we' : '' }, h('small', null, j.j), j.d)), h('th', null, 'Total'))),
      h('tbody', null, (p.agents || []).map((a, i) => h('tr', null,
        h('td', { class: 'ec-planning__agent' }, a.nom || 'Agent', h('small', null, a.poste || '')),
        jours.map((j) => h('td', { class: j.we ? 'is-we' : '' }, (a.jours || {})[j.cle] || '')),
        h('td', { class: 'ec-planning__total' }, fmtHeures((totaux[i]?.total || 0) / 60))))),
      h('tfoot', null, h('tr', null, h('td', { class: 'ec-planning__agent' }, 'Total du mois'), h('td', { colspan: nb }, ''), h('td', { class: 'ec-planning__total' }, fmtHeures(G.total / 60)))))),
    h('p', { class: 'ec-petit' }, `Heures de nuit : ${fmtHeures(G.nuit / 60)} · dimanches : ${fmtHeures(G.dim / 60)} · jours fériés : ${fmtHeures(G.fer / 60)}`));
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
    h('section', { class: 'ec-carte' }, h('h2', null, 'Vos informations'),
      h('dl', { class: 'ec-infos' }, h('dt', null, 'Société'), h('dd', null, c.nom), h('dt', null, 'Identifiant'), h('dd', null, c.email),
        c.adresse ? [h('dt', null, 'Adresse'), h('dd', null, c.adresse)] : null, c.tel ? [h('dt', null, 'Téléphone'), h('dd', null, c.tel)] : null),
      h('p', { class: 'ec-petit' }, 'Une information à corriger ? Prévenez-nous, nous la mettons à jour.')),
    h('section', { class: 'ec-carte' }, h('h2', null, 'Sécurité'), form),
  ];
}

demarrer();
