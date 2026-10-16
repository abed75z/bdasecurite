/* =========================================================
   ESPACE ADMIN BDA — Vue générale (écran de départ)
   On choisit l'espace à ouvrir : le site internet (BDA Security Group)
   ou l'application VTC (B-Drive et B-Drive Pro), avec l'essentiel de
   chacun et la liste de ce qui attend une action.
   ========================================================= */
import { api, h, cap, euroRond, isoVersFr, marqueLogo, ErreurApi } from './outils.js';
import { ligneJournal } from './securite.js';

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
  const c = a.compteurs;
  const auj = new Date();
  const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

  /* ----- En-tête : logo, compte ----- */
  const barre = h('header', { class: 'lc-barre' },
    h('a', { href: '#/', class: 'lc-barre__marque', 'aria-label': 'Vue générale' }, marqueLogo('lc-logo')),
    h('div', { class: 'lc-barre__compte' },
      h('span', { class: 'lc-barre__nom' }, cap(String(session.utilisateur || '')), h('small', null, session.role === 'manager' ? 'Manager' : 'Administrateur')),
      h('a', { class: 'btn btn--ghost btn--petit', href: '#/parametres' }, 'Paramètres'),
      h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => ctx.deconnexion() }, 'Se déconnecter')));

  const accueil = h('div', { class: 'lc-intro' },
    h('p', { class: 'lc-intro__date' }, cap(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(auj))),
    h('h1', null, `${auj.getHours() < 18 ? 'Bonjour' : 'Bonsoir'}${session.utilisateur ? `, ${cap(session.utilisateur)}` : ''}`),
    h('p', { class: 'lc-intro__texte' }, 'Choisissez l’espace à ouvrir.'));

  /* ----- Les deux espaces ----- */
  const chiffre = (valeur, libelle, alerte) => h('div', { class: `lc-chiffre ${alerte && valeur ? 'is-alerte' : ''}` }, h('b', null, String(valeur)), h('span', null, libelle));
  const etat = (ok, texte) => h('span', { class: `lc-etat ${ok ? 'is-ok' : 'is-off'}` }, h('i', { 'aria-hidden': 'true' }), texte);
  const espace = (href, touche, type, titre, sous, chiffres, contenu, entrer) => h('a', { class: 'lc-espace', href },
    h('div', { class: 'lc-espace__tete' }, h('span', { class: 'lc-espace__type' }, type), h('kbd', { title: `Touche ${touche}` }, touche)),
    h('h2', null, titre),
    h('p', { class: 'lc-espace__sous' }, sous),
    h('div', { class: 'lc-chiffres' }, chiffres),
    h('p', { class: 'lc-espace__contenu' }, contenu),
    h('span', { class: 'lc-espace__entrer' }, entrer, h('span', { 'aria-hidden': 'true' }, '→')));

  const site = espace('#/tableau', '1', 'Site internet', 'BDA Security Group',
    ['bdasecurite.com', etat(!c.horsLigne, c.horsLigne ? 'Hors ligne' : 'En ligne')],
    [chiffre(c.demandes, c.demandes > 1 ? 'demandes' : 'demande'), chiffre(c.messages, c.messages > 1 ? 'messages' : 'message'), chiffre(c.candidatures, c.candidatures > 1 ? 'candidatures' : 'candidature'), chiffre(c.retards, 'factures en retard', true)],
    'Demandes et clients, devis et factures, agents et planning, contenu du site.',
    'Ouvrir l’espace Site');

  const enLigne = appli ? appli.chauffeurs.filter((x) => x.enLigne).length : 0;
  const aAttribuer = appli ? appli.aVenir.filter((x) => x.statut === 'reservee').length : 0;
  const alertes = appli ? appli.enDirect.filter((x) => x.alertes && x.alertes.length).length : 0;
  const app = espace('#/appli', '2', 'Application VTC', 'B-Drive',
    appli ? ['Clients et chauffeurs', etat(appli.ouvert, `${appli.ouvert ? 'Ouverte' : 'Fermée'}${appli.prive ? ' · phase privée' : ''}`)] : ['Données de l’appli indisponibles'],
    appli ? [chiffre(appli.enDirect.length, 'en cours'), chiffre(aAttribuer, 'à attribuer', true), chiffre(enLigne, enLigne > 1 ? 'chauffeurs en ligne' : 'chauffeur en ligne'), chiffre(euroRond.format(+appli.jour.t), 'aujourd’hui')] : [],
    'Courses en direct, utilisateurs, chauffeurs, paiements, statistiques et réglages.',
    'Ouvrir l’espace Application');

  /* ----- Ce qui attend une action, dans les deux espaces ----- */
  const taches = [
    alertes && { esp: 'Appli', n: alertes, href: '#/appli', titre: pluriel(alertes, 'alerte en cours de course', 'alertes en cours de course'), sous: 'Bouton d’urgence déclenché', alerte: true },
    c.horsLigne && { esp: 'Site', n: '!', href: '#/site', titre: 'Le site est hors ligne', sous: 'Les visiteurs voient la page de maintenance', alerte: true },
    aAttribuer && { esp: 'Appli', n: aAttribuer, href: '#/appli', titre: pluriel(aAttribuer, 'réservation à attribuer', 'réservations à attribuer'), sous: 'Choisir le chauffeur' },
    c.messages && { esp: 'Site', n: c.messages, href: '#/messages', titre: pluriel(c.messages, 'message client', 'messages clients'), sous: 'Espace client' },
    c.demandes && { esp: 'Site', n: c.demandes, href: '#/demandes', titre: pluriel(c.demandes, 'demande de devis', 'demandes de devis'), sous: 'Reçues depuis le site' },
    c.retards && { esp: 'Site', n: c.retards, href: '#/factures', titre: pluriel(c.retards, 'facture à relancer', 'factures à relancer'), sous: 'Échéance dépassée', alerte: true },
    c.candidatures && { esp: 'Site', n: c.candidatures, href: '#/candidatures', titre: pluriel(c.candidatures, 'nouvelle candidature', 'nouvelles candidatures'), sous: 'Page Recrutement' },
    c.avis && { esp: 'Site', n: c.avis, href: '#/avis', titre: pluriel(c.avis, 'avis à valider', 'avis à valider'), sous: 'Avant publication sur le site' },
    c.equipe && { esp: 'Site', n: c.equipe, href: '#/equipe', titre: pluriel(c.equipe, 'élément de l’Espace équipe', 'éléments de l’Espace équipe'), sous: 'Inscriptions, absences, main courante' },
    c.reservations && { esp: 'Appli', n: c.reservations, href: '#/vtc', titre: pluriel(c.reservations, 'réservation du site à confirmer', 'réservations du site à confirmer'), sous: 'Page de réservation du site' },
    a.alertes && { esp: 'Compte', n: a.alertes, href: '#/securite', titre: pluriel(a.alertes, 'connexion refusée', 'connexions refusées'), sous: '7 derniers jours', alerte: true },
    ...a.agentsAlerte.map((ag) => ({ esp: 'Site', n: '!', href: `#/agents/${ag.id}`, titre: `Carte pro de ${ag.nom}`, sous: `${ag.validite < a.aujourdhui ? 'Expirée le' : 'Expire le'} ${isoVersFr(ag.validite)}`, alerte: ag.validite < a.aujourdhui })),
  ].filter(Boolean);

  const liste = taches.length ? h('ul', { class: 'lc-taches' }, taches.map((t) => h('li', null, h('a', { href: t.href },
    h('span', { class: 'lc-taches__esp' }, t.esp),
    h('span', { class: 'lc-taches__txt' }, h('b', null, t.titre), h('small', null, t.sous)),
    h('span', { class: `lc-taches__n ${t.alerte ? 'is-alerte' : ''}` }, String(t.n))))))
    : h('p', { class: 'lc-vide' }, 'Rien n’attend d’action. Tout est à jour.');

  const journal = a.journal.length ? h('ul', { class: 'console lc-journal' }, a.journal.map((j) => ligneJournal(j))) : h('p', { class: 'lc-vide' }, 'Aucune activité enregistrée.');

  ctx.afficher(h('div', { class: 'lanceur' },
    barre,
    h('main', { class: 'lc-corps' },
      accueil,
      h('div', { class: 'lc-espaces' }, site, app),
      h('div', { class: 'lc-bas' },
        h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'À traiter'), h('small', null, taches.length ? pluriel(taches.length, 'élément', 'éléments') : '')), liste),
        h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Activité récente'), h('a', { class: 'lien-btn', href: '#/securite' }, 'Tout le journal')), journal)))));

  // Raccourcis clavier : 1 = Site, 2 = Application
  const touches = (e) => {
    if (!document.body.contains(site)) { document.removeEventListener('keydown', touches); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('.modale-fond, .palette-fond')) return;
    if (e.key === '1') location.hash = '#/tableau';
    if (e.key === '2') location.hash = '#/appli';
  };
  document.addEventListener('keydown', touches);
}
