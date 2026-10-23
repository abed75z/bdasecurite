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
    nom: 'Site internet', court: 'Site', accueil: 'tableau', externe: ['/', 'Voir le site'],
    menu: [
      { chemin: 'tableau', libelle: 'Vue d’ensemble' },
      { groupe: 'Clients' },
      { chemin: 'demandes', libelle: 'Demandes reçues', badge: 'demandes' },
      { chemin: 'messages', libelle: 'Messages', badge: 'messages' },
      { chemin: 'assistance', libelle: 'Assistance du site', badge: 'assistance', alerte: true },
      { chemin: 'clients', libelle: 'Fiches clients' },
      { chemin: 'opportunites', libelle: 'Opportunités', badge: 'opportunites', admin: true },
      { groupe: 'Facturation' },
      { chemin: 'devis', libelle: 'Devis' },
      { chemin: 'factures', libelle: 'Factures', badge: 'retards', alerte: true },
      { chemin: 'pdf', libelle: 'PDF clients' },
      { groupe: 'Équipe' },
      { chemin: 'agents', libelle: 'Agents' },
      { chemin: 'candidatures', libelle: 'Candidatures', badge: 'candidatures' },
      { chemin: 'planning', libelle: 'Planning' },
      { chemin: 'pointage', libelle: 'Pointage' },
      { chemin: 'equipe', libelle: 'Espace équipe', badge: 'equipe' },
      { chemin: 'paie', libelle: 'Fiches de paie', admin: true },
      { chemin: 'contrats', libelle: 'Contrats', admin: true },
      { groupe: 'Site web' },
      { chemin: 'site', libelle: 'Contrôle du site' },
      { chemin: 'contenu', libelle: 'Contenu & tarifs' },
      { chemin: 'avis', libelle: 'Avis clients', badge: 'avis' },
      { groupe: 'Outils' },
      { chemin: 'creations', libelle: 'Cartes & flyers' },
      { chemin: 'notes', libelle: 'Notes' },
    ],
  },
  appli: {
    nom: 'Application VTC', court: 'Application', accueil: 'appli', externe: ['/appli/', 'Ouvrir BDASH'],
    menu: [
      { chemin: 'appli', libelle: 'En direct', badge: 'appli', alerte: true },
      { groupe: 'Activité' },
      { chemin: 'appli/courses', libelle: 'Courses' },
      { chemin: 'appli/paiements', libelle: 'Paiements' },
      { chemin: 'appli/statistiques', libelle: 'Statistiques' },
      { chemin: 'vtc', libelle: 'Réservations du site', badge: 'reservations' },
      { groupe: 'Comptes' },
      { chemin: 'appli/clients', libelle: 'Utilisateurs' },
      { chemin: 'appli/chauffeurs', libelle: 'Chauffeurs' },
      { groupe: 'Configuration' },
      { chemin: 'appli/reglages', libelle: 'Paramètres de l’appli' },
    ],
  },
};
const COMPTE = [
  { chemin: 'notifications', libelle: 'Notifications', admin: true },
  { chemin: 'parametres', libelle: 'Paramètres' },
  { chemin: 'securite', libelle: 'Accès & sécurité' },
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

// Menu de l'espace ouvert (texte seul, pastille du nombre en attente)
function dessinerMenu() {
  const E = ESPACES[espaceCourant];
  const lien = (m) => h('a', { href: `#/${m.chemin}`, class: 'nav__item', dataset: { chemin: m.chemin }, onclick: fermerMenu },
    h('span', null, m.libelle), m.badge ? h('b', { class: `nav__badge ${m.alerte ? 'nav__badge--alerte' : ''}`, dataset: { badge: m.badge }, hidden: true }) : null);
  menuEl.replaceChildren(
    ...E.menu.filter(visible).map((m) => (m.groupe ? h('p', { class: 'nav__groupe' }, m.groupe) : lien(m))),
    h('p', { class: 'nav__groupe' }, 'Compte'),
    ...COMPTE.filter(visible).map(lien),
    h('a', { class: 'nav__item', href: '/admin/moi' }, h('span', null, 'Mon accès chef')),
    h('a', { class: 'nav__item nav__item--externe', href: E.externe[0], target: '_blank', rel: 'noopener' }, h('span', null, E.externe[1]), h('span', { class: 'nav__fleche', 'aria-hidden': 'true' }, '↗')));
  coteEl.querySelectorAll('.espaces__btn').forEach((b) => {
    const oui = b.dataset.espace === espaceCourant;
    b.classList.toggle('is-actif', oui);
    b.setAttribute('aria-current', oui ? 'true' : 'false');
  });
  majBadges();
}

function lancerApplication() {
  const utilisateur = String(etat.session.utilisateur || '');
  menuEl = h('nav', { class: 'nav', 'aria-label': 'Menu de l’espace' });
  coteEl = h('aside', { class: 'cote' },
    h('div', { class: 'cote__tete' },
      h('a', { href: '#/', class: 'cote__marque', title: 'Vue générale', onclick: fermerMenu }, marqueLogo('cote__logo')),
      // Choix de l'espace : site internet ou application VTC
      h('div', { class: 'espaces', role: 'group', 'aria-label': 'Espace' },
        Object.entries(ESPACES).map(([cle, E]) => h('a', { class: 'espaces__btn', href: `#/${E.accueil}`, dataset: { espace: cle }, onclick: fermerMenu }, E.court)))),
    menuEl,
    h('div', { class: 'cote__bas' },
      h('div', { class: 'profil' }, h('span', { class: 'profil__avatar', 'aria-hidden': 'true' }, (utilisateur.charAt(0) || 'A').toUpperCase()),
        h('div', null, h('b', null, cap(utilisateur)), h('small', null, etat.session.role === 'manager' ? 'Manager' : 'Administrateur')),
        h('button', { class: 'icon-btn', type: 'button', title: 'Se déconnecter', 'aria-label': 'Se déconnecter', onclick: deconnexion }, icone('sortie')))));

  filEl = h('nav', { class: 'ariane', 'aria-label': 'Vous êtes ici' });
  titrePage = h('h1', { class: 'entete-page__titre' });
  actionsPage = h('div', { class: 'entete-page__actions haut__actions' });
  zonePage = h('div', { class: 'page', id: 'page' });
  const haut = h('header', { class: 'haut' },
    h('button', { class: 'icon-btn haut__menu', type: 'button', 'aria-label': 'Ouvrir le menu', onclick: () => document.body.classList.toggle('menu-ouvert') }, icone('menu')),
    filEl,
    h('a', { class: 'hors-ligne', href: '#/site', id: 'hors-ligne', hidden: true, title: 'Les visiteurs voient la page Maintenance' }, h('i', { 'aria-hidden': 'true' }), 'Site hors ligne'),
    h('button', { class: 'cmd-btn', type: 'button', 'aria-label': 'Rechercher ou lancer une commande (Ctrl + K)', onclick: () => palette.ouvrir() },
      icone('recherche'), h('span', null, 'Rechercher…'), h('kbd', null, 'Ctrl K')));

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
}

export async function majCompteurs() {
  try {
    const { compteurs } = await api('compteurs');
    etat.compteurs = compteurs;
    const pastille = document.getElementById('hors-ligne');
    if (pastille) pastille.hidden = !compteurs.horsLigne;
    majBadges();
    // Pastille sur l'icône de l'application installée : ce qui attend une action
    const attente = ['demandes', 'messages', 'assistance', 'avis', 'reservations', 'candidatures', 'equipe', 'appli'].reduce((s, k) => s + (compteurs[k] || 0), 0);
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
  appliEl.classList.toggle('appli--lanceur', lanceur);
  fermerMenu();

  // Espace de la page : on change de menu si besoin
  if (!lanceur) {
    const esp = espaceDeRoute(route) || espaceCourant;
    if (esp !== espaceCourant) { espaceCourant = esp; espaceMemo(esp); dessinerMenu(); }
  }
  const E = ESPACES[espaceCourant];

  // Rubrique active : le chemin le plus précis présent dans le menu (ex. appli/courses), sinon la page
  const chemins = $$('.cote .nav__item[data-chemin]').map((a) => a.dataset.chemin);
  const complet = params[0] ? `${route}/${params[0]}` : route;
  const actif = chemins.includes(complet) ? complet : chemins.includes(PARENT[route] || route) ? (PARENT[route] || route) : '';
  $$('.cote .nav__item[data-chemin]').forEach((a) => { const oui = a.dataset.chemin === actif; a.classList.toggle('is-actif', oui); if (oui) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const libelleActif = [...E.menu, ...COMPTE].find((m) => m.chemin === actif)?.libelle || '';
  montrerRubrique();

  // Fil d'Ariane : Vue générale / Espace / Rubrique
  const rubrique = RUBRIQUE[actif] || RUBRIQUE[route] || '';
  filEl.replaceChildren(
    h('a', { href: '#/' }, 'Vue générale'),
    h('span', { class: 'ariane__sep', 'aria-hidden': 'true' }, '/'),
    h('a', { href: `#/${E.accueil}` }, E.nom),
    ...(rubrique ? [h('span', { class: 'ariane__sep', 'aria-hidden': 'true' }, '/'), h('span', null, rubrique)] : []));

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
