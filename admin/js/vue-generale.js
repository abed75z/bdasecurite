/* =========================================================
   ESPACE ADMIN BDA — Vue générale (écran de départ)
   Écran calme : la salutation, l'état du site et de l'appli,
   puis une tuile par grand domaine (Clients, Facturation, Équipe…).
   Le détail de ce qui attend une action est dans la cloche du haut.
   ========================================================= */
import { api, h, cap, icone, ErreurApi } from './outils.js';

async function tableauAppli() {
  const res = await fetch('appli-api.php?a=tableau', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new ErreurApi(json.erreur || `Erreur ${res.status}`, res.status);
  return json;
}

export async function pageVueGenerale(ctx) {
  ctx.titre('Vue générale');
  const [{ accueil: a }, session, appli] = await Promise.all([api('accueil'), api('session'), tableauAppli().catch(() => null)]);
  if (!ctx.actuel()) return;
  const c = { demandes: 0, messages: 0, assistance: 0, candidatures: 0, equipe: 0, avis: 0, retards: 0, reservations: 0, ...a.compteurs };
  const auj = new Date();
  const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
  const enCours = appli ? appli.enDirect.length : 0;
  const aAttribuer = appli ? appli.aVenir.filter((x) => x.statut === 'reservee').length : 0;
  const alertes = appli ? appli.enDirect.filter((x) => x.alertes && x.alertes.length).length : 0;
  const cartes = a.agentsAlerte.length;

  // Nombre de points qui attendent une action (même liste que la cloche, plus la sécurité et les cartes pro)
  const points = [c.demandes, c.messages, c.assistance, c.candidatures, c.equipe, c.avis, c.retards, c.reservations, alertes, aAttribuer, a.alertes, cartes, c.horsLigne ? 1 : 0]
    .reduce((s, n) => s + (Number(n) || 0), 0);

  /* ----- En-tête : salutation, heure, état du site et de l'appli ----- */
  const heure = h('span', { class: 'acc-heure' });
  const majHeure = () => { heure.textContent = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date()); };
  majHeure();
  const minuteur = setInterval(() => { if (!document.body.contains(heure)) { clearInterval(minuteur); return; } majHeure(); }, 10000);

  const entete = h('section', { class: 'acc-entete' },
    h('div', { class: 'acc-entete__txt' },
      h('p', { class: 'acc-date' }, cap(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(auj)), h('span', { 'aria-hidden': 'true' }, '·'), heure),
      h('h1', { class: 'acc-titre' }, `${auj.getHours() >= 5 && auj.getHours() < 18 ? 'Bonjour' : 'Bonsoir'}${session.utilisateur ? `, ${cap(session.utilisateur)}` : ''}`),
      h('p', { class: 'acc-sous' }, points ? `${pluriel(points, 'point demande', 'points demandent')} votre attention.` : 'Tout est en ordre. Rien n’attend d’action.')),
    // L'état du site est déjà en haut de l'écran : ici, seulement ce qui attend une action
    points ? h('div', { class: 'acc-entete__droite' },
      h('button', { class: 'btn btn--gold acc-voir', type: 'button', onclick: () => document.querySelector('.haut-btn')?.click() }, icone('cloche'), 'Voir ce qui attend')) : null);

  /* ----- Une tuile par domaine ----- */
  // Tuiles de tailles différentes (les grandes montent leurs chiffres), une couleur par domaine
  const module = ({ href, dom, ic, titre, info, n = 0, alerte = false, grand = false, details = [] }) => h('a', { class: `acc-module ${grand ? 'acc-module--grand' : ''} ${n ? 'a-traiter' : ''}`.trim(), href, dataset: { dom } },
    h('span', { class: 'acc-module__ic' }, icone(ic)),
    h('span', { class: 'acc-module__txt' }, h('b', null, titre), h('small', null, info)),
    grand && details.length ? h('span', { class: 'acc-module__details' }, details.map(([libelle, v]) => h('span', { class: Number(v) ? 'is-plein' : '' }, h('b', null, String(v)), libelle))) : null,
    n ? h('em', { class: `acc-module__n ${alerte ? 'is-alerte' : ''}` }, String(n)) : null,
    icone('fleche', 'acc-module__fleche'));
  const modules = [
    // Le robot de prospection (administrateurs seulement) : nouvelles pistes et clients à rappeler
    session.role === 'admin' ? { href: c.rappels ? '#/opportunites/rappels' : '#/opportunites', dom: 'prospection', ic: 'cible', titre: 'Trouver des clients', grand: true, n: c.rappels,
      info: c.rappels ? pluriel(c.rappels, 'client à rappeler aujourd’hui', 'clients à rappeler aujourd’hui') : c.opportunites ? pluriel(c.opportunites, 'nouvelle piste trouvée par le robot', 'nouvelles pistes trouvées par le robot') : 'Chantiers, bars, clubs, hôtels, magasins, appels d’offres',
      details: [['nouvelles pistes', c.opportunites || 0], ['à rappeler', c.rappels || 0]] } : null,
    { href: '#/demandes', dom: 'clients', ic: 'clients', titre: 'Clients', grand: true, n: c.demandes + c.messages + c.assistance, alerte: Boolean(c.assistance),
      info: c.demandes ? pluriel(c.demandes, 'nouvelle demande de devis', 'nouvelles demandes de devis') : c.messages ? pluriel(c.messages, 'message client', 'messages clients') : 'Demandes, messages, fiches clients',
      details: [['demandes', c.demandes], ['messages', c.messages], ['assistance', c.assistance]] },
    { href: '#/devis', dom: 'facturation', ic: 'facture', titre: 'Facturation', n: c.retards, alerte: true,
      info: c.retards ? pluriel(c.retards, 'facture à relancer', 'factures à relancer') : 'Devis, factures, PDF clients' },
    { href: '#/site', dom: 'site', ic: 'site', titre: 'Site web', n: c.avis + (c.horsLigne ? 1 : 0), alerte: Boolean(c.horsLigne),
      info: c.horsLigne ? 'Hors ligne · maintenance' : c.avis ? pluriel(c.avis, 'avis à valider', 'avis à valider') : 'En ligne · bdasecurite.com' },
    { href: '#/agents', dom: 'equipe', ic: 'agents', titre: 'Équipe', grand: true, n: c.candidatures + c.equipe + cartes, alerte: cartes > 0,
      info: c.candidatures ? pluriel(c.candidatures, 'nouvelle candidature', 'nouvelles candidatures') : cartes ? pluriel(cartes, 'carte pro à surveiller', 'cartes pro à surveiller') : 'Agents, planning, paie, contrats',
      details: [['candidatures', c.candidatures], ['espace équipe', c.equipe], ['cartes pro', cartes]] },
    { href: '#/appli', dom: 'appli', ic: 'voiture', titre: 'Application VTC', grand: true, n: alertes + aAttribuer + c.reservations, alerte: alertes > 0,
      info: appli ? (appli.ouvert ? 'Ouverte · BDASH et BDASH Pro' : 'Fermée · BDASH et BDASH Pro') : 'BDASH et BDASH Pro',
      details: [['en cours', enCours], ['à attribuer', aAttribuer], ['réservations', c.reservations]] },
    { href: '#/tableau', dom: 'stats', ic: 'graphique', titre: 'Statistiques', grand: true, info: 'Activité du site sur 30 jours, documents récents, journal' },
    { href: '#/creations', dom: 'outils', ic: 'calques', titre: 'Outils', info: 'Cartes agents, flyers, notes' },
    { href: '#/securite', dom: 'securite', ic: 'bouclier', titre: 'Sécurité', n: a.alertes, alerte: true,
      info: a.alertes ? pluriel(a.alertes, 'connexion refusée', 'connexions refusées') : 'Accès, appareils, journal' },
  ].filter(Boolean).map(module);

  ctx.afficher(h('div', { class: 'accueil' }, entete, h('nav', { class: 'acc-modules', 'aria-label': 'Domaines' }, modules)));

  // Raccourcis clavier : 1 à 8 ouvrent les tuiles
  const touches = (e) => {
    if (!document.body.contains(modules[0])) { document.removeEventListener('keydown', touches); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('.modale-fond, .palette-fond, .deroulant')) return;
    const i = Number(e.key) - 1;
    if (i >= 0 && i < modules.length) location.hash = modules[i].getAttribute('href');
  };
  document.addEventListener('keydown', touches);
}
