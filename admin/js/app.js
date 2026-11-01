/* =========================================================
   ESPACE ADMIN BDA — démarrage, connexion, menu et navigation
   ========================================================= */
import { api, quandDeconnecte, h, $, $$, icone, marqueLogo, toast, erreur, champ, saisie, cap, modale } from './outils.js';
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
  { chemin: 'comptes', libelle: 'Comptes & accès', ic: 'cle', admin: true },
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
const COMMUNES = ['parametres', 'securite', 'notifications', 'comptes'];
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
let zonePage, titrePage, actionsPage, menuEl, filEl, coteEl, appliEl, iconePage, surtitrePage;
let espaceCourant = espaceMemo();
let palette = null;
export const ouvrirPalette = (texte) => palette?.ouvrir(texte);
const fermerMenu = () => document.body.classList.remove('menu-ouvert');
const visible = (m) => !m.admin || etat.session.role === 'admin';

// Icône de chaque rubrique du menu
const GROUPE_IC = { Clients: 'clients', Facturation: 'facture', 'Équipe': 'agents', 'Site web': 'site', Outils: 'calques', 'Activité': 'activite', Comptes: 'personne', Configuration: 'curseurs', Compte: 'reglages' };
let groupeOuvert = null;

// Menu de l'espace ouvert : les pages principales, puis des rubriques qui se déplient au clic
// (une seule ouverte à la fois ; celle de la page affichée s'ouvre toute seule)
function dessinerMenu() {
  const E = ESPACES[espaceCourant];
  const lien = (m) => h('a', { href: m.href || `#/${m.chemin}`, class: 'nav__item', title: m.libelle, dataset: m.href ? {} : { chemin: m.chemin }, onclick: fermerMenu },
    icone(m.ic, 'nav__ic'), h('span', { class: 'nav__txt' }, m.libelle),
    m.badge ? h('b', { class: `nav__badge ${m.alerte ? 'nav__badge--alerte' : ''}`, dataset: { badge: m.badge }, hidden: true }) : null);
  const principales = [lien({ chemin: '', libelle: 'Vue générale', ic: 'grille' })];
  const rubriques = [];
  for (const m of E.menu.filter(visible)) {
    if (m.groupe) rubriques.push({ nom: m.groupe, pages: [] });
    else if (rubriques.length) rubriques.at(-1).pages.push(m);
    else principales.push(lien(m));
  }
  rubriques.push({ nom: 'Compte', pages: [...COMPTE.filter(visible), { href: '/admin/moi', libelle: 'Mon accès chef', ic: 'couronne' }] });
  const rubrique = ({ nom, pages }) => {
    const avecBadge = pages.filter((m) => m.badge);
    return h('div', { class: 'nav__section', dataset: { groupe: nom } },
      h('button', { class: 'nav__groupe-btn', type: 'button', title: nom, 'aria-expanded': 'false', onclick: () => ouvrirRubrique(groupeOuvert === nom ? null : nom) },
        icone(GROUPE_IC[nom] || 'suivant', 'nav__ic'), h('span', { class: 'nav__txt' }, nom),
        avecBadge.length ? h('b', { class: 'nav__somme', hidden: true, dataset: { somme: avecBadge.map((m) => m.badge).join(' '), alerte: avecBadge.filter((m) => m.alerte).map((m) => m.badge).join(' ') } }) : null,
        icone('chevronBas', 'nav__chevron')),
      h('div', { class: 'nav__tiroir' }, h('div', { class: 'nav__tiroir-int' }, pages.map(lien))));
  };
  favorisEl = h('div', { class: 'nav__favoris' });
  menuEl.replaceChildren(
    h('div', { class: 'nav__principales' }, principales),
    favorisEl,
    ...rubriques.map(rubrique),
    h('a', { class: 'nav__item nav__item--externe', href: E.externe[0], target: '_blank', rel: 'noopener', title: E.externe[1] }, icone('externe', 'nav__ic'), h('span', { class: 'nav__txt' }, E.externe[1])));
  coteEl.querySelectorAll('.espaces__btn').forEach((b) => {
    const oui = b.dataset.espace === espaceCourant;
    b.classList.toggle('is-actif', oui);
    b.setAttribute('aria-current', oui ? 'true' : 'false');
  });
  ouvrirRubrique(groupeOuvert);
  dessinerFavoris();
}

/* ---------- Favoris : une étoile dans l'en-tête épingle la page en haut du menu ---------- */
let favorisEl = null, etoileEl = null, pageCourante = null;
function favoris(liste) {
  try {
    if (liste) localStorage.setItem('bda-favoris', JSON.stringify(liste));
    const l = JSON.parse(localStorage.getItem('bda-favoris') || '[]');
    return Array.isArray(l) ? l.filter((f) => f && typeof f.hash === 'string' && f.hash.startsWith('#/')).slice(0, 8) : [];
  } catch (e) { return []; }
}
function dessinerFavoris() {
  if (!favorisEl) return;
  const l = favoris();
  favorisEl.hidden = !l.length;
  favorisEl.replaceChildren(...(l.length ? [h('p', { class: 'nav__favoris-titre' }, icone('etoile'), 'Favoris'),
    ...l.map((f) => h('a', { href: f.hash, class: `nav__item nav__item--favori ${location.hash === f.hash ? 'is-actif' : ''}`, title: f.libelle, onclick: fermerMenu },
      icone(f.ic || 'etoile', 'nav__ic'), h('span', { class: 'nav__txt' }, f.libelle)))] : []));
  if (etoileEl && pageCourante) {
    const oui = l.some((f) => f.hash === pageCourante.hash);
    etoileEl.classList.toggle('is-actif', oui);
    etoileEl.title = oui ? 'Retirer des favoris' : 'Ajouter aux favoris (en haut du menu)';
    etoileEl.setAttribute('aria-pressed', String(oui));
  }
}
function basculerFavori() {
  if (!pageCourante) return;
  const l = favoris();
  const deja = l.some((f) => f.hash === pageCourante.hash);
  const libelle = titrePage.textContent || pageCourante.libelle;
  favoris(deja ? l.filter((f) => f.hash !== pageCourante.hash) : [...l, { hash: pageCourante.hash, libelle, ic: pageCourante.ic }]);
  dessinerFavoris();
  etoileEl.classList.remove('vient-de-changer');
  void etoileEl.offsetWidth;
  etoileEl.classList.add('vient-de-changer');
  toast(deja ? `« ${libelle} » retiré des favoris.` : `« ${libelle} » ajouté aux favoris, en haut du menu.`);
}

/* ---------- Écran d'ouverture : l'écusson apparaît, puis l'admin (une fois par session) ---------- */
function ecranOuverture() {
  try { if (sessionStorage.getItem('bda-intro')) return; sessionStorage.setItem('bda-intro', '1'); } catch (e) { return; }
  if (sansMouvement()) return;
  const intro = h('div', { class: 'intro', 'aria-hidden': 'true' },
    h('div', { class: 'intro__centre' },
      h('img', { class: 'intro__ecusson', src: '/admin/icone-admin-512.png?v=3', alt: '' }),
      h('p', { class: 'intro__nom' }, 'BDA Admin'),
      h('span', { class: 'intro__ligne' })));
  document.body.append(intro);
  setTimeout(() => intro.classList.add('is-fin'), 1250);
  setTimeout(() => intro.remove(), 1900);
}
function ouvrirRubrique(nom) {
  groupeOuvert = nom;
  menuEl?.querySelectorAll('.nav__section').forEach((s) => {
    const oui = s.dataset.groupe === nom;
    s.classList.toggle('is-ouvert', oui);
    s.querySelector('.nav__groupe-btn').setAttribute('aria-expanded', String(oui));
  });
  majBadges();
}

/* ---------- Thème : clair « ivoire » (par défaut) ou sombre, mémorisé sur l'appareil ---------- */
function themeMemo(v) {
  try { if (v) localStorage.setItem('bda-theme-v6', v); return localStorage.getItem('bda-theme-v6') === 'nuit' ? 'nuit' : 'jour'; } catch (e) { return v || 'jour'; }
}
function appliquerTheme(t) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'jour' ? '#f6f5f2' : '#0a0a0c');
}
appliquerTheme(themeMemo());

/* ---------- Animations : chiffres qui défilent, cloche qui sonne ---------- */
// Animations : réglage de l'admin (activées par défaut), indépendant de Windows
function mouvementMemo(v) {
  try { if (v) localStorage.setItem('bda-animations', v); return localStorage.getItem('bda-animations') === 'reduites' ? 'reduites' : 'activees'; } catch (e) { return v || 'activees'; }
}
function appliquerMouvement(m) { document.documentElement.dataset.mouvement = m === 'reduites' ? 'reduit' : 'plein'; }
appliquerMouvement(mouvementMemo());
const sansMouvement = () => document.documentElement.dataset.mouvement === 'reduit';
function animerChiffres(zone) {
  if (sansMouvement()) return;
  zone.querySelectorAll('.metrique__valeur, .tuile b, .acc-module__n, .lc-chiffre b').forEach((el) => {
    const fin = /^\d{1,5}$/.test(el.textContent.trim()) ? Number(el.textContent.trim()) : 0;
    if (fin < 2) return;
    const debut = performance.now();
    const pas = (t) => {
      const p = Math.min(1, (t - debut) / 650);
      el.textContent = String(Math.round(fin * (1 - (1 - p) ** 3)));
      if (p < 1) requestAnimationFrame(pas);
    };
    el.textContent = '0';
    requestAnimationFrame(pas);
  });
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
      etat.session.role === 'admin' ? lien('#/comptes', 'Comptes & accès', 'cle') : null,
      lien('/admin/moi', 'Mon accès chef', 'couronne'),
      lien('/', 'Voir le site', 'externe', true)),
    h('div', { class: 'deroulant__theme' },
      h('span', null, 'Apparence'),
      h('div', { class: 'segments', role: 'group', 'aria-label': 'Apparence' },
        [['jour', 'Clair', 'soleil'], ['nuit', 'Sombre', 'lune']].map(([t, libelle, ic]) => h('button', {
          type: 'button', class: `segments__btn ${themeMemo() === t ? 'is-actif' : ''}`, 'aria-pressed': String(themeMemo() === t),
          onclick: (e) => {
            themeMemo(t); appliquerTheme(t);
            e.currentTarget.parentNode.querySelectorAll('.segments__btn').forEach((b) => { const oui = b === e.currentTarget; b.classList.toggle('is-actif', oui); b.setAttribute('aria-pressed', String(oui)); });
          },
        }, icone(ic), libelle)))),
    h('div', { class: 'deroulant__theme deroulant__theme--suite' },
      h('span', null, 'Animations'),
      h('div', { class: 'segments', role: 'group', 'aria-label': 'Animations' },
        [['activees', 'Activées', 'eclair'], ['reduites', 'Réduites', 'pause']].map(([m, libelle, ic]) => h('button', {
          type: 'button', class: `segments__btn ${mouvementMemo() === m ? 'is-actif' : ''}`, 'aria-pressed': String(mouvementMemo() === m),
          onclick: (e) => {
            mouvementMemo(m); appliquerMouvement(m);
            e.currentTarget.parentNode.querySelectorAll('.segments__btn').forEach((b) => { const oui = b === e.currentTarget; b.classList.toggle('is-actif', oui); b.setAttribute('aria-pressed', String(oui)); });
          },
        }, icone(ic), libelle)))),
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
  ecranOuverture();
  menuEl = h('nav', { class: 'nav', 'aria-label': 'Menu de l’espace' });
  coteEl = h('aside', { class: 'cote' },
    h('div', { class: 'cote__tete' },
      h('a', { href: '#/', class: 'cote__marque', title: 'Vue générale', onclick: fermerMenu },
        h('img', { class: 'cote__ecusson', src: '/admin/icone-admin-192.png?v=3', alt: '' }),
        h('span', { class: 'cote__nom' }, h('b', null, 'BDA Admin'), h('small', null, 'BDA Security Group'))),
      // Choix de l'espace : site internet ou application VTC
      h('div', { class: 'espaces', role: 'group', 'aria-label': 'Espace' },
        Object.entries(ESPACES).map(([cle, E]) => h('a', { class: 'espaces__btn', href: `#/${E.accueil}`, title: E.nom, dataset: { espace: cle }, onclick: fermerMenu },
          icone(E.ic, 'espaces__ic'), h('span', null, E.court))))),
    menuEl,
    h('div', { class: 'cote__bas' },
      h('button', { class: 'cote__reduire', type: 'button', title: 'Réduire ou agrandir le menu', onclick: basculerMenuReduit }, icone('panneau'), h('span', null, 'Réduire le menu')),
      h('p', { class: 'cote__version', title: 'Les compteurs se mettent à jour toutes les minutes' }, h('i', { 'aria-hidden': 'true' }), h('span', null, 'BDA Admin · v8.0 · ', h('span', { id: 'synchro' }, 'à jour')))));

  filEl = h('nav', { class: 'ariane', 'aria-label': 'Vous êtes ici' });
  titrePage = h('h1', { class: 'entete-page__titre' });
  iconePage = h('span', { class: 'entete-page__ic', 'aria-hidden': 'true' });
  surtitrePage = h('span', { class: 'entete-page__surtitre' });
  etoileEl = h('button', { class: 'fav-btn', type: 'button', 'aria-label': 'Favori', 'aria-pressed': 'false', onclick: basculerFavori }, icone('etoile'));
  actionsPage = h('div', { class: 'entete-page__actions haut__actions' });
  zonePage = h('div', { class: 'page', id: 'page' });
  const haut = h('header', { class: 'haut' },
    h('button', { class: 'icon-btn haut__menu', type: 'button', 'aria-label': 'Ouvrir le menu', onclick: () => document.body.classList.toggle('menu-ouvert') }, icone('menu')),
    filEl,
    h('a', { class: 'temoin-site', href: '#/site', id: 'temoin-site', title: 'Contrôle du site' }, h('i', { 'aria-hidden': 'true' }), h('span', null, 'Site en ligne')),
    h('button', { class: 'creer-btn', type: 'button', title: 'Créer (touche C)', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: (e) => ouvrirDeroulant(e.currentTarget, panneauCreer) },
      icone('plus'), h('span', null, 'Créer')),
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
      h('div', { class: 'cadre-page' },
        h('div', { class: 'entete-page' }, h('div', { class: 'entete-page__gauche' }, iconePage, h('div', { class: 'entete-page__textes' }, surtitrePage, titrePage), etoileEl), actionsPage),
        zonePage)));
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
  // Témoin de synchronisation en bas du menu
  clearInterval(lancerApplication.synchro);
  lancerApplication.synchro = setInterval(() => {
    const el = document.getElementById('synchro');
    if (!el || !etat.majLe) return;
    const s = Math.round((Date.now() - etat.majLe) / 1000);
    el.textContent = s < 10 ? 'à jour' : s < 60 ? `il y a ${s} s` : `il y a ${Math.round(s / 60)} min`;
  }, 5000);
  installerRaccourcis();
  montrerNouveautes();
}

/* ---------- Bouton « Créer » de la barre du haut ---------- */
function panneauCreer() {
  const auj = new Date();
  const mois = `${auj.getFullYear()}-${String(auj.getMonth() + 1).padStart(2, '0')}`;
  const choix = [
    ['#/devis/nouveau', 'Devis', 'Pour un client ou un prospect', 'devis', 'facturation'],
    ['#/factures/nouveau', 'Facture', 'À envoyer ou à imprimer', 'facture', 'facturation'],
    ['#/agents/nouveau', 'Agent', 'Ajouter quelqu’un à l’équipe', 'agents', 'equipe'],
    [`#/planning/${mois}`, 'Planning du mois', 'Organiser les vacations', 'planning', 'equipe'],
    ['#/notes/nouvelle', 'Note', 'Une idée, un rappel', 'note', 'outils'],
    ['#/pdf', 'PDF pour un client', 'Déposer dans son espace', 'dossier', 'clients'],
    ...(etat.session.role === 'admin' ? [['#/comptes', 'Accès à l’admin', 'Pour un proche ou un manager', 'cle', 'securite']] : []),
  ];
  return [
    h('header', { class: 'deroulant__tete' }, h('b', null, 'Créer'), h('small', null, 'touche C')),
    h('ul', { class: 'deroulant__liste creer-liste' }, choix.map(([href, titre, sous, ic, dom]) => h('li', null, h('a', { href },
      h('span', { class: 'creer-liste__ic', dataset: { dom } }, icone(ic)),
      h('span', { class: 'creer-liste__txt' }, h('b', null, titre), h('small', null, sous)))))),
  ];
}

/* ---------- Raccourcis clavier façon Linear : C, ?, G puis une lettre ---------- */
const ALLER = { v: '#/', t: '#/tableau', d: '#/devis', f: '#/factures', c: '#/demandes', m: '#/messages', a: '#/agents', p: '#/planning', s: '#/site', l: '#/appli', n: '#/notes', r: '#/candidatures' };
function aideRaccourcis() {
  const ligne = (touches, texte) => h('li', null, h('span', { class: 'aide-touches' }, touches.map((t) => h('kbd', null, t))), h('span', null, texte));
  modale({
    titre: 'Raccourcis clavier',
    contenu: h('div', { class: 'aide-raccourcis' },
      h('ul', null,
        ligne(['Ctrl', 'K'], 'Rechercher une page, un client, une commande'),
        ligne(['C'], 'Créer : devis, facture, agent, note…'),
        ligne(['1', '…', '8'], 'Ouvrir une tuile de la Vue générale'),
        ligne(['?'], 'Afficher cette aide'),
        ligne(['Échap'], 'Fermer une fenêtre ou un menu')),
      h('p', { class: 'aide-raccourcis__titre' }, 'Aller directement : G puis…'),
      h('ul', { class: 'aide-raccourcis__grille' },
        [['V', 'Vue générale'], ['T', 'Vue d’ensemble'], ['C', 'Demandes clients'], ['M', 'Messages'], ['D', 'Devis'], ['F', 'Factures'], ['A', 'Agents'], ['R', 'Candidatures'], ['P', 'Planning'], ['S', 'Contrôle du site'], ['L', 'Appli en direct'], ['N', 'Notes']]
          .map(([t, texte]) => ligne(['G', t], texte)))),
    actions: [{ libelle: 'Compris', classe: 'btn--gold', submit: true }],
  });
}
function installerRaccourcis() {
  if (installerRaccourcis.fait) return;
  installerRaccourcis.fait = true;
  let attenteG = 0;
  document.addEventListener('keydown', (e) => {
    if (!document.querySelector('.appli') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (document.querySelector('.modale-fond, .palette-fond')) return;
    const k = e.key.toLowerCase();
    if (Date.now() - attenteG < 1200 && ALLER[k]) { e.preventDefault(); attenteG = 0; location.hash = ALLER[k]; return; }
    if (k === 'g') { attenteG = Date.now(); return; }
    if (e.key === '?') { e.preventDefault(); fermerDeroulant(); aideRaccourcis(); return; }
    if (k === 'c' && !deroulant) { e.preventDefault(); const b = document.querySelector('.creer-btn'); if (b) ouvrirDeroulant(b, panneauCreer); }
  });
}

/* ---------- Nouveautés : une fenêtre à la première ouverture de chaque version ---------- */
const VERSION = '8';
function montrerNouveautes() {
  try { if (localStorage.getItem('bda-nouveautes') === VERSION) return; localStorage.setItem('bda-nouveautes', VERSION); } catch (e) { return; }
  const point = (ic, dom, titre, texte) => h('li', null, h('span', { class: 'creer-liste__ic', dataset: { dom } }, icone(ic)), h('span', null, h('b', null, titre), h('small', null, texte)));
  setTimeout(() => modale({
    titre: 'Nouveautés de BDA Admin',
    contenu: h('div', { class: 'nouveautes' },
      h('p', { class: 'nouveautes__intro' }, 'Version 8 : toute l’équipe dans BDA Admin, et vos pages préférées à portée de main.'),
      h('ul', null,
        point('cle', 'securite', 'Comptes & accès', 'Créez un accès pour un proche ou un manager, choisissez son rôle, changez son mot de passe. Compte › Comptes & accès.'),
        point('etoile', 'equipe', 'Favoris', 'L’étoile à côté du titre épingle la page en haut du menu.'),
        point('plus', 'facturation', 'Bouton « Créer »', 'Devis, facture, agent, planning, note, accès. Ou la touche C. Touche ? pour tous les raccourcis.'),
        point('eclair', 'appli', 'Effets', 'Écran d’ouverture, connexion animée, pages qui glissent, chiffres qui défilent.'))),
    actions: [{ libelle: 'C’est parti', classe: 'btn--gold', submit: true }],
  }), 900);
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
  // Rubrique fermée : total de ses pages en attente
  menuEl?.querySelectorAll('[data-somme]').forEach((b) => {
    const n = b.dataset.somme.split(' ').reduce((s, k) => s + (compteurs[k] || 0), 0);
    b.textContent = n > 99 ? '99+' : n;
    b.hidden = n === 0;
    b.classList.toggle('is-alerte', b.dataset.alerte.split(' ').some((k) => k && compteurs[k]));
  });
  // Cloche de la barre du haut : total de ce qui attend une action (elle sonne quand il augmente)
  const cloche = document.getElementById('cloche-n');
  if (cloche) {
    const total = aTraiter().reduce((s, t) => s + compteurs[t.cle], 0);
    const avant = Number(cloche.dataset.total ?? total);
    cloche.dataset.total = total;
    cloche.textContent = total > 99 ? '99+' : total;
    cloche.hidden = total === 0;
    cloche.classList.toggle('is-alerte', aTraiter().some((t) => t.alerte));
    if (total > avant && !sansMouvement()) {
      const btn = cloche.parentNode;
      btn.classList.remove('sonne');
      void btn.offsetWidth;
      btn.classList.add('sonne');
    }
  }
}

export async function majCompteurs() {
  try {
    const { compteurs } = await api('compteurs');
    etat.compteurs = compteurs;
    etat.majLe = Date.now();
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
  // La rubrique de la page affichée s'ouvre dans le menu
  const sectionActive = menuEl.querySelector('.nav__item.is-actif')?.closest('.nav__section');
  if (sectionActive && sectionActive.dataset.groupe !== groupeOuvert) ouvrirRubrique(sectionActive.dataset.groupe);
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

  // En-tête de page : l'icône de la rubrique dans sa couleur, et le nom de la rubrique au-dessus du titre
  const entree = actif ? [...E.menu, ...COMPTE].find((m) => m.chemin === actif) : null;
  const DOM_RUBRIQUE = { Clients: 'clients', Facturation: 'facturation', 'Équipe': 'equipe', 'Site web': 'site', Outils: 'outils', 'Activité': 'appli', Comptes: 'appli', Configuration: 'appli', Compte: 'securite' };
  const avecIcone = Boolean(entree?.ic) && !lanceur;
  iconePage.replaceChildren(...(avecIcone ? [icone(entree.ic)] : []));
  iconePage.dataset.dom = DOM_RUBRIQUE[rubrique] || (route === 'appli' || route === 'vtc' ? 'appli' : route === 'tableau' ? 'stats' : 'securite');
  iconePage.hidden = !avecIcone;
  surtitrePage.textContent = lanceur ? '' : (rubrique || E.nom);
  pageCourante = lanceur ? null : { hash: location.hash, libelle: libelleActif || rubrique || E.nom, ic: entree?.ic };
  etoileEl.hidden = lanceur;
  dessinerFavoris();
  iconePage.classList.remove('is-in');
  void iconePage.offsetWidth;
  iconePage.classList.add('is-in');

  let page = lanceur ? pageVueGenerale : PAGES[route];
  if (route === 'appli' && PAGES_APPLI[params[0]]) page = PAGES_APPLI[params[0]];

  const jeton = ++jetonNavigation;
  zonePage.replaceChildren(h('div', { class: 'chargement' }, h('span'), h('span'), h('span')));
  zonePage.dataset.route = route;
  document.body.classList.add('page-en-charge');
  actionsPage.replaceChildren();
  titrePage.textContent = '';
  window.scrollTo(0, 0);
  const ctx = {
    params,
    // Dans l'espace Application, le titre suit la rubrique du menu (Courses, Chauffeurs…)
    titre: (t) => { const titre = route === 'appli' && libelleActif ? libelleActif : t; titrePage.textContent = titre; document.title = `${titre} — BDA Admin`; },
    actions: (...n) => actionsPage.replaceChildren(...n.flat().filter(Boolean)),
    // Première pose du contenu : transition fluide (le squelette laisse la place à la page)
    afficher: (...n) => {
      if (jeton !== jetonNavigation) return;
      const poser = () => { if (jeton !== jetonNavigation) return; zonePage.replaceChildren(...n.flat().filter(Boolean)); animerChiffres(zonePage); };
      if (document.startViewTransition && !sansMouvement() && zonePage.querySelector(':scope > .chargement')) {
        // Filet de sécurité : si la fenêtre ne se redessine pas (cachée), la page s'affiche quand même
        let pose = false;
        const uneFois = () => { if (!pose) { pose = true; poser(); } };
        try { document.startViewTransition(uneFois); } catch (e) { uneFois(); }
        setTimeout(uneFois, 700);
      }
      else poser();
    },
    actuel: () => jeton === jetonNavigation,
    compteurs: majCompteurs,
    aller: (hash) => { location.hash = hash; },
    deconnexion,
  };
  try {
    await page(ctx);

  } catch (e) {
    if (e.statut === 401) return;
    if (jeton !== jetonNavigation) return;
    zonePage.replaceChildren(h('div', { class: 'vide' }, icone('alerte'), h('p', null, e.message), h('button', { class: 'btn btn--ghost', onclick: router }, 'Réessayer')));
    erreur(e);
  } finally {
    if (jeton === jetonNavigation) document.body.classList.remove('page-en-charge');
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
