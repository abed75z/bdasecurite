/* =========================================================
   MON ACCÈS — la carte pro du gérant, en 3D
   - protégée par la connexion de l'espace admin (rien n'est dans la page)
   - la carte suit les mouvements du téléphone (gyroscope)
   - un toucher la retourne (recto / verso)
   ========================================================= */
import { api, h, icone, toast, erreur, champ, saisie, quandDeconnecte } from './outils.js';
import { recto, verso, CARTE_DEFAUT } from './cartes.js';

const racine = document.getElementById('moi');
const CLE_CARTE = 'bda-ma-carte';
const LARGEUR_CARTE = 85.6 * 96 / 25.4; // 85,6 mm en pixels CSS
const DIRIGEANT = /g[ée]rant|dirigeant|pr[ée]sident|directeur|fondateur|patron|chef d.entreprise/i;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lire = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } };

// Petits dessins (SVG statiques)
function svg(classe, contenu, viewBox = '0 0 24 24') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', viewBox);
  s.setAttribute('class', classe);
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = contenu;
  return s;
}
const couronne = (classe) => svg(classe, '<defs><linearGradient id="orC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e2a8"/><stop offset=".5" stop-color="#c9a55c"/><stop offset="1" stop-color="#9c7a38"/></linearGradient></defs>'
  + '<path d="M8 44 5 16l14 12L32 6l13 22 14-12-3 28Z" fill="url(#orC)"/><rect x="8" y="48" width="48" height="6" rx="2" fill="url(#orC)"/>'
  + '<circle cx="5" cy="14" r="3.4" fill="#f6e2a8"/><circle cx="32" cy="5" r="3.6" fill="#f6e2a8"/><circle cx="59" cy="14" r="3.4" fill="#f6e2a8"/>', '0 0 64 58');

/* ---------- Démarrage ---------- */
async function demarrer() {
  quandDeconnecte(() => ecranConnexion('Votre session a expiré : déverrouillez à nouveau.'));
  let s;
  try { s = await api('session'); } catch (e) { return racine.replaceChildren(h('main', { class: 'moi-verrou' }, h('p', null, e.message))); }
  if (!s.connecte) return ecranConnexion();
  ouvrir(s);
}

/* ---------- Écran verrouillé ---------- */
function ecranConnexion(message) {
  const login = saisie({ autocomplete: 'username', required: true, 'aria-label': 'Identifiant' });
  const mdp = saisie({ type: 'password', autocomplete: 'current-password', required: true, 'aria-label': 'Mot de passe' });
  const msg = h('p', { class: 'auth__erreur', role: 'alert' }, message || '');
  const btn = h('button', { class: 'btn btn--gold btn--bloc', type: 'submit' }, icone('cadenas'), 'Déverrouiller');
  const form = h('form', { class: 'moi-verrou__form', onsubmit: async (e) => {
    e.preventDefault();
    msg.textContent = '';
    btn.disabled = true;
    try { const s = await api('connexion', { login: login.value.trim(), motdepasse: mdp.value }); ouvrir(s); }
    catch (err) { msg.textContent = err.message; btn.disabled = false; }
  } }, champ('Identifiant', login), champ('Mot de passe', mdp), msg, btn);
  racine.replaceChildren(h('main', { class: 'moi-verrou' },
    h('div', { class: 'moi-verrou__carte' },
      couronne('moi-verrou__couronne'),
      h('span', { class: 'moi-badge' }, h('i'), 'Accès réservé · Direction'),
      h('h1', null, 'Espace du ', h('em', null, 'chef')),
      h('p', { class: 'moi-verrou__texte' }, 'Cette page est personnelle. Déverrouillez-la avec votre identifiant et votre mot de passe de l’espace admin.'),
      form)));
  login.focus();
}

/* ---------- Page personnelle ---------- */
async function ouvrir(session) {
  racine.replaceChildren(h('div', { class: 'chargement chargement--plein' }, h('span'), h('span'), h('span')));
  let cartes = [], agents = [];
  try {
    const [c, a] = await Promise.all([api('creations', undefined, { type: 'carte' }), api('agents').catch(() => ({ agents: [] }))]);
    cartes = c.creations.map((x) => ({ id: x.id, data: { ...CARTE_DEFAUT, ...x.data } }));
    agents = a.agents || [];
  } catch (e) { return erreur(e); }

  let carte = cartes.find((x) => String(x.id) === lire(CLE_CARTE));
  if (!carte) {
    const chefs = cartes.filter((x) => DIRIGEANT.test(`${x.data.type} ${x.data.fonction}`));
    if (chefs.length === 1) carte = chefs[0];
  }
  if (!carte) return choisirCarte(session, cartes);
  afficher(session, carte, cartes, agents);
}

function choisirCarte(session, cartes) {
  if (!cartes.length) {
    return racine.replaceChildren(h('main', { class: 'moi-verrou' }, h('div', { class: 'moi-verrou__carte' },
      couronne('moi-verrou__couronne'),
      h('h1', null, 'Aucune ', h('em', null, 'carte')),
      h('p', { class: 'moi-verrou__texte' }, 'Créez votre carte dans l’espace admin (Cartes agents), avec la fonction « Gérant », puis revenez ici.'),
      h('a', { class: 'btn btn--gold btn--bloc', href: '/admin/#/cartes/nouvelle' }, icone('plus'), 'Créer ma carte'))));
  }
  racine.replaceChildren(h('main', { class: 'moi-choix' },
    h('span', { class: 'moi-badge' }, h('i'), 'Accès personnel'),
    h('h1', null, 'Quelle carte est ', h('em', null, 'la vôtre ?')),
    h('p', { class: 'moi-verrou__texte' }, 'Touchez votre carte : elle sera retenue sur cet appareil.'),
    h('div', { class: 'moi-choix__liste' }, cartes.map((c) => h('button', { type: 'button', class: 'moi-choix__item', onclick: () => { ecrire(CLE_CARTE, String(c.id)); ouvrir(session); } },
      h('div', { class: 'moi-choix__visuel' }, recto(c.data)),
      h('span', null, [c.data.prenom, (c.data.nom || '').toUpperCase()].filter(Boolean).join(' ') || 'Sans nom', h('small', null, c.data.fonction)))))));
}

function afficher(session, carte, cartes, agents) {
  const d = carte.data;
  const prenom = d.prenom || String(session.utilisateur || '');
  const heure = new Date().getHours();
  const salut = heure < 5 || heure >= 18 ? 'Bonsoir' : 'Bonjour';
  const nbAgents = agents.filter((a) => +a.actif).length;

  /* ----- La carte en 3D ----- */
  const face = (contenu, dos) => h('div', { class: `carte3d__face ${dos ? 'carte3d__face--dos' : ''}` },
    h('div', { class: 'carte3d__echelle' }, contenu), h('div', { class: 'carte3d__reflet', 'aria-hidden': 'true' }), h('div', { class: 'carte3d__eclat', 'aria-hidden': 'true' }));
  const tourne = h('div', { class: 'carte3d__tourne' }, face(recto(d)), face(verso(d), true));
  const pivot = h('div', { class: 'carte3d', role: 'button', tabindex: '0', 'aria-label': 'Retourner la carte', 'aria-pressed': 'false', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pivot.click(); } } }, tourne);
  const ombre = h('div', { class: 'carte3d__ombre', 'aria-hidden': 'true' });
  const scene = h('section', { class: 'moi-scene' }, h('div', { class: 'moi-scene__halo', 'aria-hidden': 'true' }), pivot, ombre);

  const ajusterTaille = () => {
    const l = Math.min(window.innerWidth - 36, 460);
    scene.style.setProperty('--k', (l / LARGEUR_CARTE).toFixed(4));
  };
  ajusterTaille();
  window.addEventListener('resize', ajusterTaille);

  /* ----- Mouvement : gyroscope du téléphone, sinon léger flottement ----- */
  const cible = { x: 0, y: 0 }, pos = { x: 0, y: 0 };
  let gyro = false, base = null;
  const orientation = (e) => {
    if (e.beta == null || e.gamma == null) return;
    gyro = true;
    if (!base) base = { b: e.beta, g: e.gamma };
    base.b += (e.beta - base.b) * 0.004; // se recentre doucement quand on garde la même position
    base.g += (e.gamma - base.g) * 0.004;
    cible.x = clamp((e.gamma - base.g) * 1.3, -26, 26);
    cible.y = clamp((e.beta - base.b) * 1.3, -26, 26);
  };
  const ecouterGyro = () => { window.removeEventListener('deviceorientation', orientation); window.addEventListener('deviceorientation', orientation); };
  const permissionIos = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
  const boutonGyro = h('button', { class: 'moi-gyro', type: 'button', hidden: true, onclick: () => demanderGyro(true) }, icone('mobile'), 'Activer l’effet 3D (mouvements du téléphone)');
  async function demanderGyro(depuisBouton) {
    if (!permissionIos || gyro) return;
    try {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r === 'granted') { ecouterGyro(); boutonGyro.remove(); } else if (depuisBouton) toast('Mouvement refusé : autorisez-le dans les réglages de Safari.', 'erreur');
    } catch (e) { if (depuisBouton) erreur(e); }
  }
  // Android : les mouvements arrivent directement. iPhone : il faut l'accord de l'utilisateur (bouton ou premier toucher)
  ecouterGyro();
  if (permissionIos && window.matchMedia('(pointer: coarse)').matches) setTimeout(() => { if (!gyro && boutonGyro.isConnected) boutonGyro.hidden = false; }, 900);

  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let retournee = false;
  const boucle = (t) => {
    if (!pivot.isConnected) return;
    if (!gyro && !reduit) { cible.x = Math.sin(t / 1700) * 7; cible.y = Math.cos(t / 2300) * 4; }
    pos.x += (cible.x - pos.x) * 0.1;
    pos.y += (cible.y - pos.y) * 0.1;
    pivot.style.transform = `rotateX(${(-pos.y).toFixed(2)}deg) rotateY(${pos.x.toFixed(2)}deg)`;
    const sx = 50 + pos.x * 2.2 * (retournee ? -1 : 1), sy = 50 + pos.y * 2.2;
    scene.style.setProperty('--sx', `${sx.toFixed(1)}%`);
    scene.style.setProperty('--sy', `${sy.toFixed(1)}%`);
    scene.style.setProperty('--ox', `${(-pos.x * 0.9).toFixed(1)}px`);
    requestAnimationFrame(boucle);
  };
  requestAnimationFrame(boucle);

  pivot.addEventListener('click', () => {
    retournee = !retournee;
    tourne.classList.toggle('is-retournee', retournee);
    pivot.setAttribute('aria-pressed', String(retournee));
    aide.textContent = retournee ? 'Touchez pour revenir au recto' : 'Touchez la carte pour la retourner';
    navigator.vibrate?.(12);
    if (permissionIos && !gyro) demanderGyro(false);
  });

  /* ----- Rang et infos ----- */
  const aide = h('p', { class: 'moi-aide' }, 'Touchez la carte pour la retourner');
  const niveau = h('div', { class: 'moi-niveau' },
    h('div', { class: 'moi-niveau__tete' }, h('small', null, 'Niveau d’accès'), h('b', null, '5 / 5')),
    h('div', { class: 'moi-niveau__barres', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5].map((i) => h('i', { style: `--i:${i}` }))),
    h('span', null, 'Direction générale · contrôle total'));
  const infos = h('ul', { class: 'moi-infos' },
    h('li', null, icone('agents'), h('span', null, h('b', null, String(nbAgents)), nbAgents > 1 ? ' agents sous votre direction' : ' agent sous votre direction')),
    h('li', null, icone('cadenas'), h('span', null, 'Session sécurisée · ', session.appareil || 'cet appareil')),
    h('li', null, icone('bouclier'), h('span', null, d.numero ? `Carte pro ${d.numero}` : 'BDA Sécurité · Sécurité privée & VTC')));

  const deconnexion = async () => { try { await api('deconnexion', {}); } catch (e) { /* déjà sorti */ } ecranConnexion('Vous êtes déconnecté.'); };

  racine.replaceChildren(h('main', { class: 'moi-page' },
    h('header', { class: 'moi-haut' },
      h('span', { class: 'moi-badge' }, h('i'), 'Accès personnel · Direction'),
      h('button', { class: 'moi-sortie', type: 'button', onclick: deconnexion, 'aria-label': 'Se déconnecter' }, icone('sortie'))),
    h('section', { class: 'moi-chef' },
      couronne('moi-chef__couronne'),
      h('p', { class: 'moi-chef__salut' }, `${salut}, chef.`),
      h('h1', null, prenom, ' ', h('em', null, (d.nom || '').toUpperCase())),
      h('p', { class: 'moi-chef__titre' }, h('span', null, d.fonction || 'Gérant'), ' · Fondateur de BDA Sécurité')),
    scene,
    aide,
    permissionIos ? boutonGyro : null,
    niveau,
    infos,
    h('nav', { class: 'moi-liens' },
      h('a', { class: 'btn btn--gold', href: '/admin/' }, icone('commande'), 'Console admin'),
      h('a', { class: 'btn btn--ghost', href: '/', target: '_blank', rel: 'noopener' }, icone('site'), 'Voir le site'),
      cartes.length > 1 ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { ecrire(CLE_CARTE, ''); choisirCarte(session, cartes); } }, icone('badge'), 'Changer de carte') : null),
    h('p', { class: 'moi-pied' }, 'Page personnelle · visible uniquement après connexion')));
}

demarrer();
