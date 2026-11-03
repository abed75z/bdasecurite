/* =========================================================
   ESPACE ADMIN BDA — Vue générale (écran de départ)
   Le tableau de bord de la direction : les chiffres du jour en une ligne,
   le terrain d'aujourd'hui (qui est où, qui manque), ce qui attend une
   action, et l'accès direct aux grands domaines. Données : accueil,
   centre de contrôle et pilotage (chiffre d'affaires, pour les administrateurs).
   ========================================================= */
import { api, h, cap, icone, pad, ErreurApi, modale, erreur, toast } from './outils.js';

// Accueil à la carte : blocs affichés et ordre, par compte (module « accueil »)
const BLOCS = { kpis: 'Chiffres du jour', priorites: 'Priorités du jour', terrain: 'Le terrain aujourd’hui', traiter: 'À traiter', domaines: 'Accès aux domaines' };
const PREFS_DEFAUT = { ordre: ['kpis', 'priorites', 'terrain', 'traiter', 'domaines'], masques: [] };
async function personnaliser(prefs, recharger) {
  const ordre = [...prefs.ordre];
  const visibles = new Set(ordre.filter((b) => !prefs.masques.includes(b)));
  const liste = h('ul', { class: 'vg-perso' });
  const dessiner = () => liste.replaceChildren(...ordre.map((b, i) => h('li', null,
    h('label', { class: 'case' }, h('input', { type: 'checkbox', checked: visibles.has(b), onchange: (e) => { if (e.target.checked) visibles.add(b); else visibles.delete(b); } }), h('span', null, BLOCS[b])),
    h('span', { class: 'vg-perso__ordre' },
      h('button', { class: 'icon-btn', type: 'button', disabled: i === 0, 'aria-label': 'Monter', onclick: () => { [ordre[i - 1], ordre[i]] = [ordre[i], ordre[i - 1]]; dessiner(); } }, icone('chevronBas', 'vg-perso__haut')),
      h('button', { class: 'icon-btn', type: 'button', disabled: i === ordre.length - 1, 'aria-label': 'Descendre', onclick: () => { [ordre[i + 1], ordre[i]] = [ordre[i], ordre[i + 1]]; dessiner(); } }, icone('chevronBas'))))));
  dessiner();
  const ok = await modale({ titre: 'Personnaliser l’accueil', contenu: h('div', null, h('p', { class: 'modale__texte' }, 'Cochez les blocs à afficher et rangez-les dans l’ordre qui vous convient. Le même accueil vous suit sur l’ordinateur et le téléphone.'), liste),
    actions: [
      { libelle: 'Par défaut', classe: 'btn--ghost', action: async () => { try { await api('mod.accueil.prefs.enregistrer', PREFS_DEFAUT); return true; } catch (e) { erreur(e); return false; } } },
      { libelle: 'Annuler', classe: 'btn--ghost', valeur: false },
      { libelle: 'Enregistrer', classe: 'btn--gold', submit: true, action: async () => {
        try { await api('mod.accueil.prefs.enregistrer', { ordre, masques: ordre.filter((b) => !visibles.has(b)) }); return true; } catch (e) { erreur(e); return false; }
      } }] });
  if (ok) { toast('Accueil enregistré.'); recharger(); }
}

async function tableauAppli() {
  const res = await fetch('appli-api.php?a=tableau', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new ErreurApi(json.erreur || `Erreur ${res.status}`, res.status);
  return json;
}

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nb = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const espace = (s) => String(s).replace(/ /g, ' ');
const ETATS = {
  en_poste: ['En poste', 'ok'], arrivee: ['Prise de poste', 'attente'], a_venir: ['À venir', 'neutre'], retard: ['Pas arrivé', 'alerte'],
  partie: ['Parti', 'neutre'], terminee: ['Terminé', 'neutre'], en_cours: ['En cours', 'neutre'], sans_pointage: ['Sans pointage', 'attente'], non_pourvue: ['Non pourvu', 'alerte'],
};
const ORDRE = { retard: 0, non_pourvue: 1, arrivee: 2, en_poste: 3, en_cours: 4, a_venir: 5, sans_pointage: 6, partie: 7, terminee: 8 };
const hm = (ts) => { const d = new Date(ts * 1000); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const compte = (v) => (Array.isArray(v) ? v.length : Number(v) || 0);

export async function pageVueGenerale(ctx) {
  ctx.titre('Vue générale');
  const [accueil, session, appli, controle, perso, prio] = await Promise.all([
    api('accueil'), api('session'), tableauAppli().catch(() => null), api('controle').catch(() => null),
    api('mod.accueil.prefs').catch(() => null), api('mod.cerveau.cartes').catch(() => null)]);
  const prefs = perso?.prefs || PREFS_DEFAUT;
  const admin = session.role === 'admin';
  const pilotage = admin ? await api('pilotage').catch(() => null) : null;
  if (!ctx.actuel()) return;
  const a = accueil.accueil;
  const c = { demandes: 0, messages: 0, assistance: 0, candidatures: 0, equipe: 0, avis: 0, retards: 0, reservations: 0, nonpourvus: 0, rappels: 0, opportunites: 0, sos: 0, ...a.compteurs };
  const auj = new Date();
  const pluriel = (n, un, plusieurs) => `${nb.format(n)} ${n > 1 ? plusieurs : un}`;
  const aAttribuer = appli ? appli.aVenir.filter((x) => x.statut === 'reservee').length : 0;
  const alertesAppli = appli ? appli.enDirect.filter((x) => x.alertes && x.alertes.length).length : 0;
  const cartes = a.agentsAlerte.length;

  /* ----- Ce qui attend une action (même logique que la cloche, la plus grave en premier) ----- */
  const aFaire = [
    [c.sos, 'Alerte d’un agent à prendre en charge', '#/controle', true],
    [c.nonpourvus, 'Postes non pourvus dans les 48 h', '#/exploitation', true],
    [c.retards, 'Factures en retard de paiement', '#/factures', true],
    [c.assistance, 'Visiteurs qui demandent un conseiller', '#/assistance', true],
    [alertesAppli, 'Courses VTC avec une alerte', '#/appli', true],
    [c.demandes, 'Demandes de devis à traiter', '#/demandes'],
    [c.messages, 'Messages de clients non lus', '#/messages'],
    [c.rappels, 'Clients à rappeler aujourd’hui', '#/opportunites/rappels'],
    [aAttribuer, 'Courses VTC à attribuer', '#/appli'],
    [c.reservations, 'Réservations VTC du site', '#/vtc'],
    [c.candidatures, 'Nouvelles candidatures', '#/candidatures'],
    [c.equipe, 'Espace équipe : comptes, absences, main courante', '#/equipe'],
    [cartes, 'Cartes professionnelles à renouveler', '#/agents'],
    [c.avis, 'Avis clients à valider', '#/avis'],
    [a.alertes, 'Connexions refusées à l’admin', '#/securite', true],
    [c.horsLigne ? 1 : 0, 'Le site est hors ligne', '#/site', true],
  ].filter(([n]) => Number(n) > 0);
  const points = aFaire.reduce((s, [n]) => s + Number(n), 0);

  /* ----- En-tête : date, heure, salutation, résumé ----- */
  const heure = h('span', { class: 'vg-heure' });
  const majHeure = () => { heure.textContent = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date()); };
  majHeure();
  const minuteur = setInterval(() => { if (!document.body.contains(heure)) { clearInterval(minuteur); return; } majHeure(); }, 10000);
  const tete = h('header', { class: 'vg-tete' },
    h('div', { class: 'vg-tete__txt' },
      h('p', { class: 'vg-date' }, cap(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(auj)), h('span', { 'aria-hidden': 'true' }, '/'), heure),
      h('h1', { class: 'vg-titre' }, `${auj.getHours() >= 5 && auj.getHours() < 18 ? 'Bonjour' : 'Bonsoir'}${session.utilisateur ? `, ${cap(session.utilisateur)}` : ''}`),
      h('p', { class: 'vg-resume' }, points ? h('span', null, h('b', null, pluriel(points, 'point demande', 'points demandent')), ' votre attention aujourd’hui.') : 'Tout est en ordre : rien n’attend d’action.')),
    h('div', { class: 'vg-tete__actions' },
      perso ? h('button', { class: 'btn btn--ghost', type: 'button', title: 'Choisir et ranger les blocs de l’accueil', onclick: () => personnaliser(prefs, () => pageVueGenerale(ctx)) }, icone('curseurs'), 'Personnaliser') : null,
      h('a', { class: 'btn btn--ghost', href: '#/controle' }, icone('direct'), 'Centre de contrôle'),
      h('a', { class: 'btn btn--gold', href: '#/factures/nouvelle' }, icone('plus'), 'Nouvelle facture')));

  /* ----- Chiffres du jour ----- */
  const journee = controle ? [...controle.journee] : [];
  const enPoste = controle ? compte(controle.enPoste) : 0;
  const retards = journee.filter((v) => v.etat === 'retard').length;
  const iMois = pilotage ? pilotage.mois.length - 3 : -1;
  const caMois = pilotage ? pilotage.ca[iMois] || 0 : 0;
  const caPrec = pilotage ? pilotage.ca[iMois - 1] || 0 : 0;
  const evol = caPrec ? Math.round(((caMois - caPrec) / caPrec) * 100) : null;
  const kpi = (libelle, valeur, sous, href, ton) => h('a', { class: `vg-kpi ${ton ? `is-${ton}` : ''}`.trim(), href },
    h('span', { class: 'vg-kpi__lib' }, libelle), h('b', { class: 'vg-kpi__val' }, valeur), h('span', { class: 'vg-kpi__sous' }, sous));
  const kpis = h('section', { class: 'vg-kpis', 'aria-label': 'Chiffres du jour' },
    kpi('En poste', nb.format(enPoste), retards ? pluriel(retards, 'agent pas arrivé', 'agents pas arrivés') : 'aucun retard', '#/controle', retards ? 'alerte' : ''),
    kpi('Postes du jour', nb.format(journee.length), journee.length ? `${journee.filter((v) => v.etat === 'terminee').length} terminés` : 'aucun poste prévu', '#/exploitation'),
    kpi('Non pourvus 48 h', nb.format(c.nonpourvus), c.nonpourvus ? 'à placer dans le planning' : 'planning complet', '#/exploitation', c.nonpourvus ? 'alerte' : ''),
    pilotage
      ? kpi('Facturé ce mois', espace(euro.format(caMois)), evol === null ? 'factures envoyées ou payées' : `${evol >= 0 ? '+' : '−'}${Math.abs(evol)} % vs mois dernier`, '#/pilotage')
      : kpi('Demandes à traiter', nb.format(c.demandes), 'reçues par le site', '#/demandes'),
    pilotage
      ? kpi('À encaisser', espace(euro.format(pilotage.factures.attente || 0)), pilotage.factures.retard ? `dont ${espace(euro.format(pilotage.factures.retard))} en retard` : 'aucun retard', '#/factures', pilotage.factures.retard ? 'alerte' : '')
      : kpi('Factures en retard', nb.format(c.retards), 'à relancer', '#/factures', c.retards ? 'alerte' : ''),
    kpi('Heures 7 jours', `${nb.format(controle?.semaine?.heures || 0)} h`, controle?.semaine ? `${nb.format(controle.semaine.vacations)} postes · ${nb.format(controle.semaine.agents)} agents` : 'planning des sites', '#/exploitation'));

  /* ----- Le terrain aujourd'hui ----- */
  journee.sort((x, y) => (ORDRE[x.etat] ?? 9) - (ORDRE[y.etat] ?? 9) || x.debut_ts - y.debut_ts);
  const ligne = (v) => {
    const [lib, ton] = ETATS[v.etat] || [v.etat, 'neutre'];
    return h('tr', null,
      h('td', { class: 'vg-num' }, `${hm(v.debut_ts)} – ${hm(v.fin_ts)}`),
      h('td', null, h('span', { class: 'vg-site' }, v.site_nom || 'Site')),
      h('td', null, v.agent_id ? (v.agent_nom || 'Agent') : h('span', { class: 'vg-vide' }, 'Personne')),
      h('td', { class: 'vg-etat-cell' }, h('span', { class: `vg-etat vg-etat--${ton}` }, lib)));
  };
  const terrain = h('section', { class: 'vg-bloc vg-terrain' },
    h('header', { class: 'vg-bloc__tete' }, h('h2', null, 'Le terrain aujourd’hui'), h('a', { class: 'vg-lien', href: '#/exploitation' }, 'Planning des sites')),
    journee.length
      ? h('div', { class: 'vg-table' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Horaire'), h('th', null, 'Site'), h('th', null, 'Agent'), h('th', { class: 'vg-etat-cell' }, 'État'))),
        h('tbody', null, journee.slice(0, 9).map(ligne))))
      : h('p', { class: 'vg-calme' }, 'Aucun poste prévu aujourd’hui dans le planning des sites.'),
    journee.length > 9 ? h('a', { class: 'vg-plus', href: '#/controle' }, `Voir les ${journee.length} postes du jour`) : null);

  /* ----- À traiter ----- */
  const traiter = h('section', { class: 'vg-bloc vg-traiter' },
    h('header', { class: 'vg-bloc__tete' }, h('h2', null, 'À traiter'), h('span', { class: 'vg-compte' }, points ? nb.format(points) : '')),
    aFaire.length
      ? h('ul', { class: 'vg-liste' }, aFaire.map(([n, libelle, href, alerte]) => h('li', null,
        h('a', { href, class: alerte ? 'is-alerte' : '' }, h('b', { class: 'vg-liste__n' }, nb.format(n)), h('span', null, libelle), icone('fleche', 'vg-liste__fleche')))))
      : h('p', { class: 'vg-calme' }, 'Rien n’attend d’action. Bonne journée.'));

  /* ----- Accès direct aux domaines ----- */
  const domaines = [
    admin ? ['Trouver des clients', '#/opportunites', c.opportunites ? pluriel(c.opportunites, 'nouvelle piste', 'nouvelles pistes') : 'Robot de prospection'] : null,
    ['Clients', '#/clients', c.demandes ? pluriel(c.demandes, 'demande', 'demandes') : 'Fiches, demandes, messages'],
    ['Facturation', '#/factures', c.retards ? pluriel(c.retards, 'facture en retard', 'factures en retard') : 'Devis, factures, PDF'],
    ['Planning des sites', '#/exploitation', c.nonpourvus ? pluriel(c.nonpourvus, 'poste à pourvoir', 'postes à pourvoir') : 'Postes, sites, rondes'],
    ['Agents', '#/agents', cartes ? pluriel(cartes, 'carte pro à renouveler', 'cartes pro à renouveler') : 'Équipe, renforts, secours'],
    admin ? ['Paie', '#/paie', 'Fiches de paie du mois'] : null,
    ['Site web', '#/site', c.horsLigne ? 'Hors ligne' : 'En ligne · bdasecurite.com'],
    ['Application VTC', '#/appli', appli ? (appli.ouvert ? 'Ouverte · BDASH' : 'Fermée · BDASH') : 'BDASH et BDASH Pro'],
    ['Statistiques', '#/tableau', 'Activité du site, journal'],
  ].filter(Boolean);
  const acces = h('nav', { class: 'vg-domaines', 'aria-label': 'Domaines' },
    domaines.map(([titre, href, info], i) => h('a', { href }, h('kbd', null, String(i + 1)), h('span', null, h('b', null, titre), h('small', null, info)), icone('fleche', 'vg-domaines__fleche'))));

  /* ----- Priorités du jour (directeur des opérations) : les plus importantes ----- */
  const urgentes = prio ? prio.cartes.filter((x) => x.niveau !== 'conseil') : [];
  const priorites = prio ? h('section', { class: 'vg-bloc vg-prio' },
    h('header', { class: 'vg-bloc__tete' }, h('h2', null, 'Priorités du jour'), h('a', { class: 'vg-lien', href: '#/cerveau' }, prio.cartes.length ? `Tout voir (${prio.cartes.length})` : 'Ouvrir')),
    urgentes.length
      ? h('ul', { class: 'vg-liste vg-liste--prio' }, urgentes.slice(0, 5).map((x) => h('li', null,
        h('a', { href: x.lien, class: x.niveau === 'urgent' ? 'is-alerte' : '' }, h('span', { class: `pj-point-niveau is-${x.niveau}` }), h('span', null, h('b', null, x.titre), h('small', null, x.detail)), icone('fleche', 'vg-liste__fleche')))))
      : h('p', { class: 'vg-calme' }, prio.cartes.length ? 'Rien d’urgent : seulement des conseils pour aujourd’hui.' : 'Rien ne vous attend. Profitez-en pour démarcher.')) : null;

  // Blocs dans l'ordre choisi ; « terrain » et « à traiter » côte à côte quand ils se suivent
  const blocs = { kpis, priorites, terrain, traiter, domaines: acces };
  const montres = prefs.ordre.filter((b) => !prefs.masques.includes(b) && blocs[b]);
  const corps = [];
  for (let i = 0; i < montres.length; i++) {
    const b = montres[i], suivant = montres[i + 1];
    if ((b === 'terrain' && suivant === 'traiter') || (b === 'traiter' && suivant === 'terrain')) { corps.push(h('div', { class: 'vg-grille' }, blocs[b], blocs[suivant])); i++; }
    else corps.push(blocs[b]);
  }
  ctx.afficher(h('div', { class: 'vg' }, tete, ...corps));

  // Raccourcis clavier : 1 à 9 ouvrent les domaines
  const touches = (e) => {
    if (!document.body.contains(acces)) { document.removeEventListener('keydown', touches); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('.modale-fond, .palette-fond, .deroulant')) return;
    const i = Number(e.key) - 1;
    if (i >= 0 && i < domaines.length) location.hash = domaines[i][1];
  };
  document.addEventListener('keydown', touches);
}
