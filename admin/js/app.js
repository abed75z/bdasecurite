/* =========================================================
   ESPACE ADMIN BDA — démarrage, connexion, menu et navigation
   ========================================================= */
import { api, quandDeconnecte, h, $, $$, icone, marqueLogo, toast, erreur, champ, saisie, cap } from './outils.js';
import { PAGES } from './pages.js';
import { pageVueGenerale } from './vue-generale.js';
import { pagePaiements, pageStatistiques } from './appli-stats.js';
import { installerPalette } from './commandes.js';

const racine = document.getElementById('app');
const etat = { session: null, compteurs: {} };

/* ---------- Deux espaces : le site internet et l'application VTC ----------
   Chaque espace a son menu ; « Compte » est commun aux deux.
   L'écran de départ (#/) est la Vue générale, qui propose l'un ou l'autre. */
const ESPACES = {
  site: {
    nom: 'Site internet', court: 'Site', ic: 'site', accueil: 'tableau', externe: ['/', 'Voir le site'],
    menu: [
      { chemin: 'tableau', libelle: 'Vue d’ensemble', ic: 'tableau' },
      { groupe: 'Clients' },
      { chemin: 'demandes', libelle: 'Demandes reçues', ic: 'demande', badge: 'demandes' },
      { chemin: 'messages', libelle: 'Messages', ic: 'message', badge: 'messages' },
      { chemin: 'assistance', libelle: 'Assistance du site', ic: 'bouee', badge: 'assistance', alerte: true },
      { chemin: 'clients', libelle: 'Fiches clients', ic: 'clients' },
      { chemin: 'opportunites', libelle: 'Opportunités', ic: 'cible', badge: 'opportunites', admin: true },
      { groupe: 'Facturation' },
      { chemin: 'devis', libelle: 'Devis', ic: 'devis' },
      { chemin: 'factures', libelle: 'Factures', ic: 'facture', badge: 'retards', alerte: true },
      { chemin: 'pdf', libelle: 'PDF clients', ic: 'dossier' },
      { groupe: 'Équipe' },
      { chemin: 'agents', libelle: 'Agents', ic: 'agents' },
      { chemin: 'candidatures', libelle: 'Candidatures', ic: 'candidature', badge: 'candidatures' },
      { chemin: 'planning', libelle: 'Planning', ic: 'planning' },
      { chemin: 'pointage', libelle: 'Pointage', ic: 'horloge' },
      { chemin: 'equipe', libelle: 'Espace équipe', ic: 'equipe', badge: 'equipe' },
      { chemin: 'paie', libelle: 'Fiches de paie', ic: 'paie', admin: true },
      { chemin: 'contrats', libelle: 'Contrats', ic: 'contrat', admin: true },
      { groupe: 'Site web' },
      { chemin: 'site', libelle: 'Contrôle du site', ic: 'site' },
      { chemin: 'contenu', libelle: 'Contenu & tarifs', ic: 'contenu' },
      { chemin: 'avis', libelle: 'Avis clients', ic: 'avis', badge: 'avis' },
      { groupe: 'Outils' },
      { chemin: 'creations', libelle: 'Cartes & flyers', ic: 'calques' },
      { chemin: 'notes', libelle: 'Notes', ic: 'note' },
    ],
  },
  appli: {
    nom: 'Application VTC', court: 'Application', ic: 'voiture', accueil: 'appli', externe: ['/appli/', 'Ouvrir BDASH'],
    menu: [
      { chemin: 'appli', libelle: 'En direct', ic: 'direct', badge: 'appli', alerte: true },
      { groupe: 'Activité' },
      { chemin: 'appli/courses', libelle: 'Courses', ic: 'trajet' },
      { chemin: 'appli/paiements', libelle: 'Paiements', ic: 'carteBancaire' },
      { chemin: 'appli/statistiques', libelle: 'Statistiques', ic: 'graphique' },
      { chemin: 'vtc', libelle: 'Réservations du site', ic: 'planning', badge: 'reservations' },
      { groupe: 'Comptes' },
      { chemin: 'appli/clients', libelle: 'Utilisateurs', ic: 'clients' },
      { chemin: 'appli/chauffeurs', libelle: 'Chauffeurs', ic: 'volant' },
      { groupe: 'Configuration' },
      { chemin: 'appli/reglages', libelle: 'Paramètres de l’appli', ic: 'curseurs' },
    ],
  },
};
const COMPTE = [
  { chemin: 'notifications', libelle: 'Notifications', ic: 'cloche', admin: true },
  { chemin: 'parametres', libelle: 'Paramètres', ic: 'reglages' },
  { chemin: 'securite', libelle: 'Accès & sécurité', ic: 'cadenas' },
];
// Ce qui attend une action : cloche de la barre du haut et pastille de l'application installée
const A_TRAITER = [
  { cle: 'appli', libelle: 'Courses en direct à surveiller', href: '#/appli', ic: 'direct', alerte: true },
  { cle: 'assistance', libelle: 'Assistance du site', href: '#/assistance', ic: 'bouee', alerte: true },
  { cle: 'demandes', libelle: 'Demandes de devis', href: '#/demandes', ic: 'demande' },
  { cle: 'messages', libelle: 'Messages clients', href: '#/messages', ic: 'message' },
  { cle: 'candidatures', libelle: 'Nouvelles candidatures', href: '#/candidatures', ic: 'candidature' },
  { cle: 'equipe', libelle: 'Espace équipe', href: '#/equipe', ic: 'equipe' },
  { cle: 'avis', libelle: 'Avis à valider', href: '#/avis', ic: 'avis' },
  { cle: 'reservations', libelle: 'Réservations du site', href: '#/vtc', ic: 'planning' },
  { cle: 'retards', libelle: 'Factures en retard', href: '#/factures', ic: 'facture', alerte: true },
];
// Pages communes aux deux espaces : elles restent dans l'espace ouvert
const COMMUNES = ['parametres', 'securite', 'notifications'];
// Pages rangées dans une rubrique du menu sans y figurer elles-mêmes
const PARENT = { cartes: 'creations', visites: 'creations', flyers: 'creations' };
// Pages de l'espace Application gérées ici (les autres onglets de #/appli sont dans appli.js)
const PAGES_APPLI = { paiements: pagePaiements, statistiques: pageStatistiques };
const espaceDeRoute = (route) => (route === 'appli' || route === 'vtc' ? 'appli' : COMMUNES.includes(route) ? null : 'site');
// Rubrique (groupe du menu) de chaque chemin, pour le fil d'Ariane
const RUBRIQUE = {};
for (const e of Object.values(ESPACES)) e.menu.reduce((g, m) => { if (m.groupe) return m.groupe; RUBRIQUE[m.chemin] = g; return g; }, '');
for (const m of COMPTE) RUBRIQUE[m.chemin] = 'Compte';
Object.assign(RUBRIQUE, { cartes: 'Outils', visites: 'Outils', flyers: 'Outils' });
function espaceMemo(v) {
  try { if (v) localStorage.setItem('bda-espace', v); return localStorage.getItem('bda-espace') === 'appli' ? 'appli' : 'site'; } catch (e) { return v || 'site'; }
}

/* ---------- Démarrage ---------- */
async function demarrer() {
  quandDeconnecte(() => {
    if (!etat.session?.connecte) return;
    etat.session.connecte = false;
    ecranConnexion('Votre session a expiré : reconnectez-vous.');
  });
  try { etat.session = await api('session'); } catch (e) {
    racine.replaceChildren(ecranAccueil('Espace indisponible', h('p', { class: 'auth__texte' }, e.message)));
    return;
  }
  if (etat.session.activation) ecranActivation();
  else if (!etat.session.connecte) ecranConnexion();
  else lancerApplication();
}

/* ---------- Écrans de connexion ---------- */
function ecranAccueil(titre, ...contenu) {
  return h('main', { class: 'auth' },
    h('section', { class: 'auth__carte' },
      // Logo du site (BDA / SECURITY GROUP), version sur fond clair
      h('div', { class: 'auth__marque' }, marqueLogo('auth__logo'), h('small', null, 'Console d’administration')),
      h('span', { class: 'auth__zone' }, icone('cadenas'), 'Zone sécurisée · accès administrateur'),
      h('h1', null, titre),
      contenu,
      h('ul', { class: 'auth__garanties' },
        h('li', null, icone('cadenas'), 'Connexion chiffrée'), h('li', null, icone('bouclier'), 'Tentatives limitées'), h('li', null, icone('activite'), 'Accès journalisés'))));
}
function formulaire(champs, bouton, envoyer) {
  const msg = h('p', { class: 'auth__erreur', role: 'alert' });
  const btn = h('button', { class: 'btn btn--gold btn--bloc', type: 'submit' }, bouton, icone('fleche'));
  const form = h('form', { class: 'auth__form', onsubmit: async (e) => {
    e.preventDefault();
    msg.textContent = '';
    btn.disabled = true;
    btn.classList.add('is-loading');
    try { await envoyer(); } catch (err) { msg.textContent = err.message; } finally { btn.disabled = false; btn.classList.remove('is-loading'); }
  } }, champs, msg, btn);
  return form;
}
function champMdp(attrs) {
  const input = saisie({ type: 'password', autocomplete: 'current-password', required: true, ...attrs });
  const voir = h('button', { type: 'button', class: 'icon-btn champ__oeil', 'aria-label': 'Afficher le mot de passe', onclick: () => { input.type = input.type === 'password' ? 'text' : 'password'; } }, icone('oeil'));
  return h('div', { class: 'champ__mdp' }, input, voir);
}

function ecranConnexion(message) {
  const login = saisie({ autocomplete: 'username', required: true, autofocus: true });
  const mdp = champMdp();
  const form = formulaire([
    champ('Identifiant', login),
    champ('Mot de passe', mdp),
  ], 'Se connecter', async () => {
    etat.session = await api('connexion', { login: login.value.trim(), motdepasse: mdp.querySelector('input').value });
    lancerApplication();
  });
  racine.replaceChildren(ecranAccueil('Espace administrateur',
    h('p', { class: 'auth__texte' }, message || 'Connectez-vous pour gérer vos devis, factures, plannings et votre site.'),
    form,
    h('button', { type: 'button', class: 'auth__lien', onclick: ecranSecours }, 'Mot de passe oublié ?')));
  login.focus();
}

function ecranActivation() {
  const code = saisie({ placeholder: 'XXXXX-XXXXX-XXXXX-XXXXX', autocomplete: 'off', required: true, spellcheck: 'false', style: 'text-transform:uppercase;letter-spacing:.08em' });
  const login = saisie({ autocomplete: 'username', required: true, placeholder: 'ex. abdel' });
  const mdp = champMdp({ autocomplete: 'new-password', minlength: 10 });
  const mdp2 = champMdp({ autocomplete: 'new-password', minlength: 10 });
  const form = formulaire([
    champ("Code d'activation", code, 'Le code que Claude vous a donné. Gardez-le précieusement : il sert aussi en cas de mot de passe oublié.'),
    champ('Choisissez un identifiant', login),
    champ('Choisissez un mot de passe', mdp, '10 caractères minimum. Évitez un mot de passe déjà utilisé ailleurs.'),
    champ('Confirmez le mot de passe', mdp2),
  ], 'Créer mon accès', async () => {
    const p1 = mdp.querySelector('input').value, p2 = mdp2.querySelector('input').value;
    if (p1 !== p2) throw new Error('Les deux mots de passe ne sont pas identiques.');
    etat.session = await api('activation', { code: code.value, login: login.value.trim(), motdepasse: p1 });
    toast('Bienvenue ! Votre espace est prêt.');
    lancerApplication();
  });
  racine.replaceChildren(ecranAccueil('Activation de votre espace',
    h('p', { class: 'auth__texte' }, 'Première connexion : créez votre accès administrateur. Vous seul connaîtrez ce mot de passe.'),
    form));
  code.focus();
}

function ecranSecours() {
  const code = saisie({ placeholder: 'XXXXX-XXXXX-XXXXX-XXXXX', autocomplete: 'off', required: true, style: 'text-transform:uppercase;letter-spacing:.08em' });
  const mdp = champMdp({ autocomplete: 'new-password', minlength: 10 });
  const mdp2 = champMdp({ autocomplete: 'new-password', minlength: 10 });
  const form = formulaire([
    champ('Code de secours', code, "C'est le même code que celui de l'activation."),
    champ('Nouveau mot de passe', mdp, '10 caractères minimum.'),
    champ('Confirmez le mot de passe', mdp2),
  ], 'Changer mon mot de passe', async () => {
    const p1 = mdp.querySelector('input').value;
    if (p1 !== mdp2.querySelector('input').value) throw new Error('Les deux mots de passe ne sont pas identiques.');
    etat.session = await api('secours', { code: code.value, motdepasse: p1 });
    toast('Mot de passe changé.');
    lancerApplication();
  });
  racine.replaceChildren(ecranAccueil('Mot de passe oublié',
    h('p', { class: 'auth__texte' }, "Saisissez votre code de secours et choisissez un nouveau mot de passe."),
    form,
    h('button', { type: 'button', class: 'auth__lien', onclick: () => ecranConnexion() }, '← Retour à la connexion')));
  code.focus();
}

/* ---------- Application ---------- */
let zonePage, titrePage, actionsPage, menuEl, filEl, coteEl, appliEl;
let espaceCourant = espaceMemo();
let palette = null;
export const ouvrirPalette = (texte) => palette?.ouvrir(texte);
const fermerMenu = () => document.body.classList.remove('menu-ouvert');
const visible = (m) => !m.admin || etat.session.role === 'admin';

// Menu de l'espace ouvert (icône, libellé, pastille du nombre en attente)
function dessinerMenu() {
  const E = ESPACES[espaceCourant];
  const lien = (m) => h('a', { href: `#/${m.chemin}`, class: 'nav__item', title: m.libelle, dataset: { chemin: m.chemin }, onclick: fermerMenu },
    icone(m.ic, 'nav__ic'), h('span', { class: 'nav__txt' }, m.libelle),
    m.badge ? h('b', { class: `nav__badge ${m.alerte ? 'nav__badge--alerte' : ''}`, dataset: { badge: m.badge }, hidden: true }) : null);
  menuEl.replaceChildren(
    lien({ chemin: '', libelle: 'Vue générale', ic: 'grille' }),
    ...E.menu.filter(visible).map((m) => (m.groupe ? h('p', { class: 'nav__groupe' }, m.groupe) : lien(m))),
    h('p', { class: 'nav__groupe' }, 'Compte'),
    ...COMPTE.filter(visible).map(lien),
    h('a', { class: 'nav__item', href: '/admin/moi', title: 'Mon accès chef' }, icone('couronne', 'nav__ic'), h('span', { class: 'nav__txt' }, 'Mon accès chef')),
    h('a', { class: 'nav__item nav__item--externe', href: E.externe[0], target: '_blank', rel: 'noopener', title: E.externe[1] }, icone('externe', 'nav__ic'), h('span', { class: 'nav__txt' }, E.externe[1])));
  coteEl.querySelectorAll('.espaces__btn').forEach((b) => {
    const oui = b.dataset.espace === espaceCourant;
    b.classList.toggle('is-actif', oui);
    b.setAttribute('aria-current', oui ? 'true' : 'false');
  });
  majBadges();
}

/* ---------- Menus déroulants de la barre du haut (à traiter, compte) ---------- */
let deroulant = null;
function fermerDeroulant() {
  if (!deroulant) return;
  deroulant.el.remove();
  deroulant.btn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('pointerdown', clicDehors, true);
  document.removeEventListener('keydown', toucheEchap);
  deroulant = null;
}
function clicDehors(e) {
  if (deroulant && !deroulant.el.contains(e.target) && !deroulant.btn.contains(e.target)) fermerDeroulant();
}
function toucheEchap(e) {
  if (e.key !== 'Escape') return;
  const btn = deroulant?.btn;
  fermerDeroulant();
  btn?.focus();
}
function ouvrirDeroulant(btn, contenu) {
  const memeBouton = deroulant?.btn === btn;
  fermerDeroulant();
  if (memeBouton) return;
  const el = h('div', { class: 'deroulant', role: 'menu' }, contenu());
  el.addEventListener('click', (e) => { if (e.target.closest('a')) fermerDeroulant(); });
  document.body.append(el);
  const r = btn.getBoundingClientRect();
  el.style.top = `${Math.round(r.bottom + 8)}px`;
  el.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
  btn.setAttribute('aria-expanded', 'true');
  deroulant = { el, btn };
  document.addEventListener('pointerdown', clicDehors, true);
  document.addEventListener('keydown', toucheEchap);
}
const aTraiter = () => A_TRAITER.filter((t) => (etat.compteurs || {})[t.cle]);
function panneauTaches() {
  const liste = aTraiter();
  const total = liste.reduce((s, t) => s + etat.compteurs[t.cle], 0);
  return [
    h('header', { class: 'deroulant__tete' }, h('b', null, 'À traiter'), total ? h('small', null, `${total} en attente`) : null),
    liste.length
      ? h('ul', { class: 'deroulant__liste' }, liste.map((t) => h('li', null, h('a', { href: t.href },
        icone(t.ic), h('span', null, t.libelle), h('b', { class: `deroulant__n ${t.alerte ? 'is-alerte' : ''}` }, String(etat.compteurs[t.cle]))))))
      : h('p', { class: 'deroulant__vide' }, icone('coche'), 'Rien n’attend d’action. Tout est à jour.'),
    etat.session.role === 'admin' ? h('a', { class: 'deroulant__pied', href: '#/notifications' }, 'Réglages des notifications', icone('suivant')) : null,
  ];
}
function panneauCompte() {
  const nom = cap(String(etat.session.utilisateur || '')) || 'Administrateur';
  const role = etat.session.role === 'manager' ? 'Manager' : 'Administrateur';
  const lien = (href, libelle, ic, externe) => h('li', null, h('a', { href, ...(externe ? { target: '_blank', rel: 'noopener' } : {}) }, icone(ic), h('span', null, libelle)));
  return [
    h('header', { class: 'deroulant__tete deroulant__tete--compte' },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, nom.charAt(0).toUpperCase()),
      h('div', null, h('b', null, nom), h('small', null, `${role} · BDA Security Group`))),
    h('ul', { class: 'deroulant__liste' },
      lien('#/parametres', 'Paramètres', 'reglages'),
      lien('#/securite', 'Accès & sécurité', 'cadenas'),
      lien('/admin/moi', 'Mon accès chef', 'couronne'),
      lien('/', 'Voir le site', 'externe', true)),
    h('button', { class: 'deroulant__sortie', type: 'button', onclick: () => { fermerDeroulant(); deconnexion(); } }, icone('sortie'), 'Se déconnecter'),
  ];
}

// Menu réduit (icônes seules), mémorisé sur cet appareil
function menuReduit(v) {
  try { if (v !== undefined) localStorage.setItem('bda-menu-reduit', v ? '1' : '0'); return localStorage.getItem('bda-menu-reduit') === '1'; } catch (e) { return Boolean(v); }
}
function basculerMenuReduit() {
  const oui = !document.body.classList.contains('cote-reduite');
  document.body.classList.toggle('cote-reduite', oui);
  menuReduit(oui);
}

function lancerApplication() {
  const utilisateur = String(etat.session.utilisateur || '');
  const nom = cap(utilisateur) || 'Administrateur';
  document.body.classList.toggle('cote-reduite', menuReduit());
  menuEl = h('nav', { class: 'nav', 'aria-label': 'Menu de l’espace' });
  coteEl = h('aside', { class: 'cote' },
    h('div', { class: 'cote__tete' },
      h('a', { href: '#/', class: 'cote__marque', title: 'Vue générale', onclick: fermerMenu },
        h('img', { class: 'cote__ecusson', src: '/admin/icone-admin-192.png?v=3', alt: '' }),
        h('span', { class: 'cote__nom' }, h('b', null, 'BDA Security Group'), h('small', null, 'Console d’administration'))),
      // Choix de l'espace : site internet ou application VTC
      h('div', { class: 'espaces', role: 'group', 'aria-label': 'Espace' },
        Object.entries(ESPACES).map(([cle, E]) => h('a', { class: 'espaces__btn', href: `#/${E.accueil}`, title: E.nom, dataset: { espace: cle }, onclick: fermerMenu },
          icone(E.ic, 'espaces__ic'), h('span', null, E.court))))),
    menuEl,
    h('div', { class: 'cote__bas' },
      h('button', { class: 'cote__reduire', type: 'button', title: 'Réduire ou agrandir le menu', onclick: basculerMenuReduit }, icone('panneau'), h('span', null, 'Réduire le menu')),
      h('p', { class: 'cote__version' }, h('i', { 'aria-hidden': 'true' }), h('span', null, 'Console BDA · v4.0'))));

  filEl = h('nav', { class: 'ariane', 'aria-label': 'Vous êtes ici' });
  titrePage = h('h1', { class: 'entete-page__titre' });
  actionsPage = h('div', { class: 'entete-page__actions haut__actions' });
  zonePage = h('div', { class: 'page', id: 'page' });
  const haut = h('header', { class: 'haut' },
    h('button', { class: 'icon-btn haut__menu', type: 'button', 'aria-label': 'Ouvrir le menu', onclick: () => document.body.classList.toggle('menu-ouvert') }, icone('menu')),
    filEl,
    h('a', { class: 'temoin-site', href: '#/site', id: 'temoin-site', title: 'Contrôle du site' }, h('i', { 'aria-hidden': 'true' }), h('span', null, 'Site en ligne')),
    h('button', { class: 'cmd-btn', type: 'button', 'aria-label': 'Rechercher ou lancer une commande (Ctrl + K)', onclick: () => palette.ouvrir() },
      icone('recherche'), h('span', null, 'Rechercher une page, un client…'), h('kbd', null, 'Ctrl K')),
    h('button', { class: 'haut-btn', type: 'button', title: 'À traiter', 'aria-label': 'À traiter', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: (e) => ouvrirDeroulant(e.currentTarget, panneauTaches) },
      icone('cloche'), h('b', { class: 'haut-btn__n', id: 'cloche-n', hidden: true })),
    h('span', { class: 'haut__sep', 'aria-hidden': 'true' }),
    h('button', { class: 'haut-compte', type: 'button', 'aria-label': 'Mon compte', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: (e) => ouvrirDeroulant(e.currentTarget, panneauCompte) },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, nom.charAt(0).toUpperCase()),
      h('span', { class: 'haut-compte__nom' }, h('b', null, nom), h('small', null, etat.session.role === 'manager' ? 'Manager' : 'Administrateur')),
      icone('chevronBas', 'haut-compte__chevron')));

  appliEl = h('div', { class: 'appli' },
    coteEl,
    h('div', { class: 'voile', onclick: fermerMenu }),
    h('div', { class: 'principal' }, haut,
      h('div', { class: 'cadre-page' }, h('div', { class: 'entete-page' }, titrePage, actionsPage), zonePage)));
  racine.replaceChildren(appliEl);
  dessinerMenu();

  // Barre de commande : toutes les pages des deux espaces
  const menuPalette = [{ chemin: '', libelle: 'Vue générale' }, ...ESPACES.site.menu.map((m) => (m.groupe ? m : { ...m, libelle: `${m.libelle} · Site` })), ...ESPACES.appli.menu.map((m) => (m.groupe ? m : { ...m, libelle: `${m.libelle} · Application` })), ...COMPTE]
    .filter(visible).map((m) => (m.groupe ? m : { route: m.chemin, libelle: m.libelle, icone: 'suivant' }));
  palette ??= installerPalette({ menu: menuPalette, aller: (hash) => { location.hash = hash; }, deconnexion, compteurs: majCompteurs });
  window.addEventListener('hashchange', router);
  router();
  majCompteurs();
  clearInterval(lancerApplication.minuteur);
  lancerApplication.minuteur = setInterval(majCompteurs, 60000);
}

async function deconnexion() {
  try { etat.session = await api('deconnexion', {}); } catch (e) { /* déjà déconnecté */ }
  window.removeEventListener('hashchange', router);
  history.replaceState(null, '', location.pathname);
  ecranConnexion('Vous êtes déconnecté. À bientôt !');
}

function majBadges() {
  const compteurs = etat.compteurs || {};
  $$('[data-badge]').forEach((b) => {
    const n = compteurs[b.dataset.badge] || 0;
    b.textContent = n > 99 ? '99+' : n;
    b.hidden = n === 0;
  });
  // Pastille sur le bouton de l'autre espace quand il attend une action
  const attente = { site: ['demandes', 'messages', 'assistance', 'avis', 'candidatures', 'equipe', 'retards'], appli: ['appli', 'reservations'] };
  coteEl?.querySelectorAll('.espaces__btn').forEach((b) => b.classList.toggle('a-traiter', attente[b.dataset.espace].some((k) => compteurs[k])));
  // Cloche de la barre du haut : total de ce qui attend une action
  const cloche = document.getElementById('cloche-n');
  if (cloche) {
    const total = aTraiter().reduce((s, t) => s + compteurs[t.cle], 0);
    cloche.textContent = total > 99 ? '99+' : total;
    cloche.hidden = total === 0;
    cloche.classList.toggle('is-alerte', aTraiter().some((t) => t.alerte));
  }
}

export async function majCompteurs() {
  try {
    const { compteurs } = await api('compteurs');
    etat.compteurs = compteurs;
    // Témoin du site dans la barre du haut : en ligne ou en maintenance
    const temoin = document.getElementById('temoin-site');
    if (temoin) {
      temoin.classList.toggle('is-off', Boolean(compteurs.horsLigne));
      temoin.title = compteurs.horsLigne ? 'Les visiteurs voient la page Maintenance' : 'Contrôle du site';
      temoin.querySelector('span').textContent = compteurs.horsLigne ? 'Site hors ligne' : 'Site en ligne';
    }
    majBadges();
    // Pastille sur l'icône de l'application installée : ce qui attend une action
    const attente = aTraiter().reduce((s, t) => s + compteurs[t.cle], 0);
    if ('setAppBadge' in navigator) (attente ? navigator.setAppBadge(attente) : navigator.clearAppBadge()).catch(() => {});
  } catch (e) { /* silencieux */ }
}

// Le menu défile : la rubrique ouverte reste visible
function montrerRubrique() {
  const a = menuEl?.querySelector('.nav__item.is-actif');
  if (!a) return;
  const haut = a.offsetTop, bas = haut + a.offsetHeight;
  if (haut < menuEl.scrollTop) menuEl.scrollTop = haut - 8;
  else if (bas > menuEl.scrollTop + menuEl.clientHeight) menuEl.scrollTop = bas - menuEl.clientHeight + 8;
}

let jetonNavigation = 0;
async function router() {
  const [route = '', ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const connue = route === '' || PAGES[route];
  const lanceur = !connue || route === '';
  appliEl.classList.toggle('appli--accueil', lanceur);
  fermerMenu();
  fermerDeroulant();

  // Espace de la page : on change de menu si besoin
  if (!lanceur) {
    const esp = espaceDeRoute(route) || espaceCourant;
    if (esp !== espaceCourant) { espaceCourant = esp; espaceMemo(esp); dessinerMenu(); }
  }
  const E = ESPACES[espaceCourant];

  // Rubrique active : le chemin le plus précis présent dans le menu (ex. appli/courses), sinon la page
  const chemins = $$('.cote .nav__item[data-chemin]').map((a) => a.dataset.chemin);
  const complet = params[0] ? `${route}/${params[0]}` : route;
  const actif = lanceur ? '' : chemins.includes(complet) ? complet : chemins.includes(PARENT[route] || route) ? (PARENT[route] || route) : null;
  $$('.cote .nav__item[data-chemin]').forEach((a) => { const oui = a.dataset.chemin === actif; a.classList.toggle('is-actif', oui); if (oui) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const libelleActif = actif ? [...E.menu, ...COMPTE].find((m) => m.chemin === actif)?.libelle || '' : '';
  montrerRubrique();

  // Fil d'Ariane : Vue générale / Espace / Rubrique / Page
  const rubrique = RUBRIQUE[actif] || RUBRIQUE[route] || '';
  const sep = () => h('span', { class: 'ariane__sep', 'aria-hidden': 'true' }, '/');
  filEl.replaceChildren(...(lanceur ? [h('span', null, 'Vue générale')] : [
    h('a', { href: '#/' }, 'Vue générale'), sep(),
    h('a', { href: `#/${E.accueil}` }, E.nom),
    ...(rubrique ? [sep(), h('span', null, rubrique)] : []),
    ...(libelleActif && libelleActif !== rubrique ? [sep(), h('span', null, libelleActif)] : []),
  ]));

  let page = lanceur ? pageVueGenerale : PAGES[route];
  if (route === 'appli' && PAGES_APPLI[params[0]]) page = PAGES_APPLI[params[0]];

  const jeton = ++jetonNavigation;
  zonePage.replaceChildren(h('div', { class: 'chargement' }, h('span'), h('span'), h('span')));
  zonePage.dataset.route = route;
  actionsPage.replaceChildren();
  titrePage.textContent = '';
  window.scrollTo(0, 0);
  const ctx = {
    params,
    // Dans l'espace Application, le titre suit la rubrique du menu (Courses, Chauffeurs…)
    titre: (t) => { const titre = route === 'appli' && libelleActif ? libelleActif : t; titrePage.textContent = titre; document.title = `${titre} — Admin BDA`; },
    actions: (...n) => actionsPage.replaceChildren(...n.flat().filter(Boolean)),
    afficher: (...n) => { if (jeton === jetonNavigation) zonePage.replaceChildren(...n.flat().filter(Boolean)); },
    actuel: () => jeton === jetonNavigation,
    compteurs: majCompteurs,
    aller: (hash) => { location.hash = hash; },
    deconnexion,
  };
  try { await page(ctx); } catch (e) {
    if (e.statut === 401) return;
    if (jeton !== jetonNavigation) return;
    zonePage.replaceChildren(h('div', { class: 'vide' }, icone('alerte'), h('p', null, e.message), h('button', { class: 'btn btn--ghost', onclick: router }, 'Réessayer')));
    erreur(e);
  }
}

// Application installable (écran d'accueil) et réception des notifications de la veille
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'ouvrir' && e.data.url) location.href = e.data.url;
  });
}

demarrer();
