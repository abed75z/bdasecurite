/* =========================================================
   ESPACE ADMIN BDA — démarrage, connexion, menu et navigation
   ========================================================= */
import { api, quandDeconnecte, h, $, $$, icone, ecusson, toast, erreur, champ, saisie } from './outils.js';
import { PAGES } from './pages.js';
import { installerPalette } from './commandes.js';

const racine = document.getElementById('app');
const etat = { session: null, compteurs: {} };

const MENU = [
  { route: '', libelle: 'Centre de contrôle', icone: 'accueil' },
  { groupe: 'Administration' },
  { route: 'site', libelle: 'Contrôle du site', icone: 'site' },
  { route: 'securite', libelle: 'Accès & sécurité', icone: 'bouclier' },
  { route: 'notes', libelle: 'Notes', icone: 'crayon' },
  { groupe: 'Gestion' },
  { route: 'devis', libelle: 'Devis', icone: 'devis' },
  { route: 'factures', libelle: 'Factures', icone: 'facture', badge: 'retards', alerte: true },
  { route: 'planning', libelle: 'Planning', icone: 'planning' },
  { route: 'clients', libelle: 'Clients', icone: 'clients' },
  { groupe: 'VTC' },
  { route: 'vtc', libelle: 'Réservations', icone: 'voiture', badge: 'reservations' },
  { groupe: 'Équipe' },
  { route: 'agents', libelle: 'Agents', icone: 'agents' },
  { route: 'cartes', libelle: 'Cartes agents', icone: 'badge' },
  { route: 'candidatures', libelle: 'Candidatures', icone: 'candidature', badge: 'candidatures' },
  { groupe: 'Site & communication' },
  { route: 'demandes', libelle: 'Demandes', icone: 'demande', badge: 'demandes' },
  { route: 'avis', libelle: 'Avis clients', icone: 'avis', badge: 'avis' },
  { route: 'flyers', libelle: 'Flyers', icone: 'flyer' },
  { route: 'visites', libelle: 'Cartes de visite', icone: 'visite' },
];
// Rubrique affichée au-dessus du titre de chaque page
const GROUPE = {};
MENU.reduce((g, m) => { if (m.groupe) return m.groupe; GROUPE[m.route] = g; return g; }, 'Console admin');
GROUPE.parametres = 'Compte';

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
      h('span', { class: 'auth__zone' }, icone('cadenas'), 'Zone sécurisée · accès administrateur'),
      h('div', { class: 'auth__marque' }, ecusson(), h('div', null, h('b', null, 'BDA Sécurité'), h('small', null, 'Console d’administration'))),
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
let zonePage, titrePage, kickerPage, actionsPage, menuEl;
let palette = null;
export const ouvrirPalette = (texte) => palette?.ouvrir(texte);

function lancerApplication() {
  const fermerMenu = () => document.body.classList.remove('menu-ouvert');
  const lien = (m) => h('a', { href: `#/${m.route}`, class: 'nav__item', dataset: { route: m.route }, onclick: fermerMenu },
    icone(m.icone), h('span', null, m.libelle), m.badge ? h('b', { class: `nav__badge ${m.alerte ? 'nav__badge--alerte' : ''}`, dataset: { badge: m.badge }, hidden: true }) : null);
  menuEl = h('nav', { class: 'nav', 'aria-label': 'Menu principal' }, MENU.map((m) => (m.groupe ? h('p', { class: 'nav__groupe' }, m.groupe) : lien(m))));

  const utilisateur = String(etat.session.utilisateur || '');
  const duree = h('span', { class: 'acces__duree' });
  const majDuree = () => {
    const min = Math.max(0, Math.round((Date.now() - new Date(String(etat.session.depuis || '').replace(' ', 'T')).getTime()) / 60000));
    duree.textContent = Number.isFinite(min) ? `Session ouverte depuis ${min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`}` : '';
  };
  majDuree();
  clearInterval(lancerApplication.minuteurSession);
  lancerApplication.minuteurSession = setInterval(majDuree, 30000);
  const cote = h('aside', { class: 'cote' },
    h('a', { href: '#/', class: 'cote__marque', onclick: fermerMenu }, ecusson(), h('div', null, h('b', null, 'BDA Sécurité'), h('small', null, 'Console', h('span', { class: 'tag-admin' }, 'Admin')))),
    h('a', { class: 'acces', href: '#/securite', onclick: fermerMenu, title: 'Accès & sécurité' }, h('span', { class: 'acces__ligne' }, h('i', { 'aria-hidden': 'true' }), 'Accès total · session sécurisée'), duree),
    menuEl,
    h('div', { class: 'cote__bas' },
      lien({ route: 'parametres', libelle: 'Paramètres', icone: 'reglages' }),
      h('a', { class: 'nav__item nav__item--chef', href: '/admin/moi' }, icone('couronne'), h('span', null, 'Mon accès chef')),
      h('a', { class: 'nav__item', href: '/', target: '_blank', rel: 'noopener' }, icone('site'), h('span', null, 'Voir le site')),
      h('div', { class: 'profil' }, h('span', { class: 'profil__avatar', 'aria-hidden': 'true' }, utilisateur.charAt(0) || 'A'),
        h('div', null, h('b', null, utilisateur), h('small', null, 'Administrateur · accès total')),
        h('button', { class: 'icon-btn', type: 'button', title: 'Se déconnecter', 'aria-label': 'Se déconnecter', onclick: deconnexion }, icone('sortie')))));

  kickerPage = h('span', { class: 'haut__kicker' });
  titrePage = h('h1', { class: 'haut__titre' });
  actionsPage = h('div', { class: 'haut__actions' });
  zonePage = h('div', { class: 'page', id: 'page' });
  const haut = h('header', { class: 'haut' },
    h('button', { class: 'icon-btn haut__menu', type: 'button', 'aria-label': 'Ouvrir le menu', onclick: () => document.body.classList.toggle('menu-ouvert') }, icone('menu')),
    h('div', { class: 'haut__textes' }, kickerPage, titrePage),
    h('button', { class: 'cmd-btn', type: 'button', 'aria-label': 'Rechercher ou lancer une commande (Ctrl + K)', onclick: () => palette.ouvrir() },
      icone('recherche'), h('span', null, 'Rechercher, lancer une commande…'), h('kbd', null, 'Ctrl K')),
    h('a', { class: 'hors-ligne', href: '#/site', id: 'hors-ligne', hidden: true, title: 'Les visiteurs voient la page Maintenance' }, h('i', { 'aria-hidden': 'true' }), 'Site hors ligne'),
    actionsPage);

  racine.replaceChildren(h('div', { class: 'appli' },
    cote,
    h('div', { class: 'voile', onclick: () => document.body.classList.remove('menu-ouvert') }),
    h('div', { class: 'principal' }, haut, zonePage)));

  palette ??= installerPalette({ menu: MENU, aller: (hash) => { location.hash = hash; }, deconnexion, compteurs: majCompteurs });
  window.addEventListener('hashchange', router);
  router();
  majCompteurs();
  clearInterval(lancerApplication.minuteur);
  lancerApplication.minuteur = setInterval(majCompteurs, 60000);
}

async function deconnexion() {
  try { etat.session = await api('deconnexion', {}); } catch (e) { /* déjà déconnecté */ }
  window.removeEventListener('hashchange', router);
  location.hash = '';
  ecranConnexion('Vous êtes déconnecté. À bientôt !');
}

export async function majCompteurs() {
  try {
    const { compteurs } = await api('compteurs');
    etat.compteurs = compteurs;
    const pastille = document.getElementById('hors-ligne');
    if (pastille) pastille.hidden = !compteurs.horsLigne;
    $$('[data-badge]').forEach((b) => {
      const n = compteurs[b.dataset.badge] || 0;
      b.textContent = n > 99 ? '99+' : n;
      b.hidden = n === 0;
    });
  } catch (e) { /* silencieux */ }
}

let jetonNavigation = 0;
async function router() {
  const [route = '', ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const page = PAGES[route] || PAGES[''];
  $$('.cote .nav__item[data-route]').forEach((a) => a.classList.toggle('is-actif', a.dataset.route === (PAGES[route] ? route : '')));
  const jeton = ++jetonNavigation;
  zonePage.replaceChildren(h('div', { class: 'chargement' }, h('span'), h('span'), h('span')));
  actionsPage.replaceChildren();
  titrePage.textContent = '';
  kickerPage.textContent = GROUPE[PAGES[route] ? route : ''] || '';
  zonePage.scrollTop = 0;
  window.scrollTo(0, 0);
  const ctx = {
    params,
    titre: (t) => { titrePage.textContent = t; document.title = `${t} — Admin BDA`; },
    actions: (...n) => actionsPage.replaceChildren(...n.flat().filter(Boolean)),
    afficher: (...n) => { if (jeton === jetonNavigation) zonePage.replaceChildren(...n.flat().filter(Boolean)); },
    actuel: () => jeton === jetonNavigation,
    compteurs: majCompteurs,
    aller: (hash) => { location.hash = hash; },
  };
  try { await page(ctx); } catch (e) {
    if (e.statut === 401) return;
    if (jeton !== jetonNavigation) return;
    zonePage.replaceChildren(h('div', { class: 'vide' }, icone('alerte'), h('p', null, e.message), h('button', { class: 'btn btn--ghost', onclick: router }, 'Réessayer')));
    erreur(e);
  }
}

demarrer();
