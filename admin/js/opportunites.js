/* =========================================================
   ESPACE ADMIN BDA — Trouver des clients (robot de prospection et veille)
   Le robot (app/veille/prospects.php) range les pistes par catégorie : chantiers, bars,
   boîtes de nuit, magasins, hôtels, restaurants. La veille (app/veille/veille.php) ajoute
   les appels d'offres publics et les entreprises qui recrutent des agents.
   Chaque piste a son suivi : à contacter, contacté, intéressé, devis envoyé, client,
   pas intéressé, avec une date de rappel et une note.
   Routes : #/opportunites, #/opportunites/<catégorie>, #/opportunites/rappels,
   #/opportunites/<id> (lien d'une notification d'appel d'offres).
   ========================================================= */
import { api, h, icone, toast, erreur, modale, champ, saisie, zoneTexte, dateLisible, ilYa, attendre, iso } from './outils.js';

const CATEGORIES = [
  { k: 'tout', lib: 'Toutes les pistes', ic: 'cible' },
  { k: 'chantier', lib: 'Chantiers', ic: 'chantier' },
  { k: 'bar', lib: 'Bars', ic: 'verre' },
  { k: 'club', lib: 'Boîtes de nuit', ic: 'musique' },
  { k: 'magasin', lib: 'Magasins', ic: 'sac' },
  { k: 'hotel', lib: 'Hôtels', ic: 'lit' },
  { k: 'restaurant', lib: 'Restaurants', ic: 'couverts' },
  { k: 'ao', lib: 'Appels d’offres', ic: 'devis', veille: true },
  { k: 'recrutement', lib: 'Ils recrutent', ic: 'agents', veille: true },
];
const LIB_CAT = Object.fromEntries(CATEGORIES.map((c) => [c.k, c.lib]));
const STATUTS = [['a_contacter', 'À contacter'], ['contacte', 'Contacté'], ['interesse', 'Intéressé'], ['devis', 'Devis envoyé'], ['client', 'Client'], ['refus', 'Pas intéressé']];
const LIB_STATUT = Object.fromEntries(STATUTS);
const DEPS = [['', 'Toute l’Île-de-France'], ['75', 'Paris'], ['92', 'Hauts-de-Seine'], ['93', 'Seine-Saint-Denis'], ['94', 'Val-de-Marne'], ['77', 'Seine-et-Marne'], ['78', 'Yvelines'], ['91', 'Essonne'], ['95', 'Val-d’Oise']];
const SUIVI = [['', 'Toutes'], ['a_contacter', 'À contacter'], ['rappels', 'À rappeler'], ['suivis', 'En discussion'], ['client', 'Clients'], ['refus', 'Pas intéressés']];
// Comment aborder chaque type de lieu : qui demander, quand appeler, quoi proposer
const CONSEILS = {
  chantier: ['le responsable travaux ou le conducteur de travaux (chez le promoteur, ou l’entreprise de construction qui tient le chantier)', 'avant le démarrage, ou au début du gros œuvre : c’est là que les vols de matériel et les squats arrivent', 'gardiennage de nuit et du week-end, rondes, contrôle d’accès à la base vie'],
  bar: ['le gérant ou le patron', 'en fin d’après-midi (15 h à 18 h), avant le service du soir, jamais pendant le rush', 'un agent à l’entrée les jeudis, vendredis et samedis soir, des renforts pour les soirées et les matchs'],
  club: ['le directeur ou le responsable de la sécurité', 'l’après-midi en semaine (le matin, tout le monde dort)', 'une équipe à l’entrée les soirs d’ouverture, un agent SSIAP si la salle est grande, des renforts pour les soirées spéciales'],
  magasin: ['le directeur du magasin ; pour une grande enseigne, demander qui s’occupe de la sûreté (souvent au siège)', 'le matin, avant l’affluence', 'un agent de prévention contre les vols, des renforts pour les fêtes de fin d’année et les soldes'],
  hotel: ['le directeur ou le responsable de l’hébergement', 'en milieu de matinée (10 h à 12 h)', 'un agent de nuit, un agent SSIAP 1 (obligatoire dans beaucoup d’hôtels), des renforts pour les événements'],
  restaurant: ['le gérant', 'entre 15 h et 17 h, entre les deux services', 'un agent les soirs de forte affluence et pour les événements privés'],
};
const QUANDS = { osm: 'Annuaire OpenStreetMap', bodacc: 'BODACC (journal officiel)', sitadel: 'Permis de construire', paris: 'Ville de Paris' };

const f = { cat: 'tout', statut: 'a_contacter', dep: '', q: '', tel: false, nouveaux: false, tri: 'score' };
// relu à chaque ouverture : la recherche globale (Ctrl K) peut y déposer le nom d'une piste
const relire = () => { try { Object.assign(f, JSON.parse(localStorage.getItem('bda-pistes') || '{}')); } catch (e) { /* navigation privée */ } };
const memoriser = () => { try { localStorage.setItem('bda-pistes', JSON.stringify(f)); } catch (e) { /* rien */ } };
const sansAccents = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const nbFr = new Intl.NumberFormat('fr-FR');
// espace insécable normale entre les milliers (l'espace fine ne se voit pas avec la police de l'admin)
const nb = { format: (n) => nbFr.format(n).replace(/ /g, ' ') };
// date de la visite précédente : ce qui est arrivé depuis porte la mention « Nouveau »
let vuAvant = null;
const pluriel = (n, un, plusieurs) => `${nb.format(n)} ${n > 1 ? plusieurs : un}`;

export async function pageOpportunites(ctx) {
  ctx.titre('Trouver des clients');
  relire();
  const p0 = String(ctx.params[0] || '');
  let cible = 0;
  if (/^\d+$/.test(p0)) { cible = Number(p0); f.cat = 'ao'; }
  else if (LIB_CAT[p0]) f.cat = p0;
  else if (p0 === 'rappels') { f.statut = 'rappels'; if (LIB_CAT[f.cat] && CATEGORIES.find((c) => c.k === f.cat).veille) f.cat = 'tout'; }

  const d = await api('prospects', undefined, { ...requete(), page: 1, ouverture: 1 });
  if (!ctx.actuel()) return;
  vuAvant = d.vuAvant ?? '';
  ctx.compteurs?.();
  const recharger = () => pageOpportunites(ctx);

  const btnChercher = h('button', { class: 'btn btn--gold', type: 'button', onclick: (e) => chercher(e.currentTarget, recharger) }, icone('eclair'), h('span', null, 'Chercher maintenant'));
  ctx.actions(
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => commentCaMarche(d) }, icone('bouee'), h('span', null, 'Comment ça marche')),
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => reglages(recharger) }, icone('reglages'), h('span', null, 'Réglages')),
    btnChercher);

  /* ----- En-tête : ce que fait le robot, en une phrase ----- */
  const ch = d.chiffres || { categories: {}, suivi: {} };
  const totalPistes = Object.values(ch.categories).reduce((s, c) => s + c.total, 0);
  const semaine = Object.values(ch.categories).reduce((s, c) => s + c.semaine, 0);
  const derniere = [d.robot?.quand, d.veille?.quand].filter(Boolean).sort().pop();
  const entete = h('section', { class: 'tc-entete' },
    h('div', { class: 'tc-entete__txt' },
      h('p', { class: 'tc-surtitre' }, 'Robot de prospection · Île-de-France'),
      h('h2', null, totalPistes ? `${pluriel(totalPistes, 'piste', 'pistes')} pour trouver du travail` : 'Le robot n’a pas encore cherché'),
      h('p', null, totalPistes
        ? 'Le robot cherche tout seul, plusieurs fois par jour, les endroits qui ont besoin d’agents : chantiers qui démarrent, bars et clubs qui ouvrent ou changent de patron, hôtels, magasins, appels d’offres. Les meilleures pistes sont en haut de la liste.'
        : 'Cliquez sur « Chercher maintenant » : le robot remplit la liste en quelques minutes, puis continue tout seul.')),
    h('div', { class: 'tc-entete__chiffres' },
      h('div', null, h('b', null, nb.format(semaine)), h('span', null, 'nouveautés cette semaine')),
      h('div', null, h('b', null, nb.format(ch.total?.rappels || 0)), h('span', null, 'à rappeler aujourd’hui')),
      h('div', null, h('b', null, nb.format((ch.total?.interesse || 0) + (ch.total?.devis || 0))), h('span', null, 'en discussion')),
      h('small', { class: 'tc-maj' }, derniere ? `Dernière recherche ${ilYa(derniere)}` : 'Aucune recherche pour le moment')));

  /* ----- Tuiles des catégories ----- */
  const tuiles = h('nav', { class: 'tc-cats', 'aria-label': 'Catégories' });
  const compteCat = (k) => {
    if (k === 'ao') return { n: d.opportunites.ao, plus: d.opportunites.aoNouveaux, info: 'marchés publics ouverts' };
    if (k === 'recrutement') return { n: d.opportunites.recrutements, plus: 0, info: 'entreprises qui embauchent' };
    if (k === 'tout') return { n: totalPistes, plus: semaine, info: 'toutes catégories' };
    const c = ch.categories[k] || { total: 0, semaine: 0, joignables: 0 };
    return { n: c.total, plus: c.semaine, info: k === 'chantier' ? 'chantiers en cours ou à venir' : `${nb.format(c.joignables)} avec téléphone` };
  };
  const dessinerTuiles = () => tuiles.replaceChildren(...CATEGORIES.map((c) => {
    const x = compteCat(c.k);
    return h('button', { type: 'button', class: `tc-cat ${f.cat === c.k ? 'is-actif' : ''} ${c.veille ? 'tc-cat--veille' : ''}`, 'aria-pressed': f.cat === c.k ? 'true' : 'false',
      onclick: () => { if (f.cat === c.k) return; f.cat = c.k; memoriser(); history.replaceState(null, '', `#/opportunites/${c.k === 'tout' ? '' : c.k}`); dessinerTuiles(); contenu(); } },
      h('span', { class: 'tc-cat__ic' }, icone(c.ic)),
      h('span', { class: 'tc-cat__txt' }, h('b', null, c.lib), h('small', null, x.info)),
      h('span', { class: 'tc-cat__n' }, nb.format(x.n || 0)),
      x.plus ? h('em', { class: 'tc-cat__plus', title: 'Nouveautés des 7 derniers jours' }, `+${nb.format(x.plus)}`) : null);
  }));
  dessinerTuiles();

  const zone = h('div', { class: 'tc-zone' });
  // premier affichage : les pistes déjà reçues ; ensuite (changement de catégorie) on les redemande
  let premier = true;
  const contenu = () => {
    const cat = CATEGORIES.find((c) => c.k === f.cat) || CATEGORIES[0];
    if (cat.veille) vueVeille(zone, cat.k, cible, recharger);
    else vuePistes(zone, premier ? d : null, ch);
    premier = false;
    cible = 0;
  };
  ctx.afficher(entete, tuiles, zone);
  contenu();
}

// Paramètres envoyés à l'API (la page est ajoutée à part)
function requete() {
  const cat = CATEGORIES.find((c) => c.k === f.cat);
  return { cat: cat && !cat.veille && f.cat !== 'tout' ? f.cat : '', statut: f.statut, dep: f.dep, q: f.q, tel: f.tel ? 1 : '', nouveaux: f.nouveaux ? 1 : '', tri: f.tri };
}

/* =========================================================
   Pistes du robot
   ========================================================= */
function vuePistes(zone, d0, ch) {
  let page = 1;
  let charge = d0;
  const liste = h('div', { class: 'tc-liste' });
  const pied = h('div', { class: 'tc-pied' });
  const resume = h('p', { class: 'tc-resume' });

  const suivi = h('div', { class: 'chips tc-suivi', role: 'group', 'aria-label': 'Suivi' });
  const dessinerSuivi = () => suivi.replaceChildren(...SUIVI.map(([k, l]) => {
    const s = ch.suivi || {};
    const n = k === '' ? null : k === 'suivis' ? (s.contacte || 0) + (s.interesse || 0) + (s.devis || 0) : s[k] || 0;
    return h('button', { type: 'button', class: `chip ${f.statut === k ? 'is-actif' : ''} ${k === 'rappels' && n ? 'is-alerte' : ''}`, onclick: () => { f.statut = k; memoriser(); dessinerSuivi(); recharger(); } },
      l, n === null ? null : h('span', null, nb.format(n)));
  }));
  dessinerSuivi();

  const recherche = saisie({ type: 'search', class: 'input input--recherche', placeholder: 'Nom, rue, ville, code postal…', value: f.q, oninput: attendre((e) => { f.q = e.target.value; memoriser(); recharger(); }, 350) });
  const dep = h('select', { class: 'input tc-select', 'aria-label': 'Département', onchange: (e) => { f.dep = e.target.value; memoriser(); recharger(); } },
    DEPS.map(([v, l]) => h('option', { value: v, selected: f.dep === v ? true : null }, l)));
  const tri = h('select', { class: 'input tc-select', 'aria-label': 'Ordre', onchange: (e) => { f.tri = e.target.value; memoriser(); recharger(); } },
    [['score', 'Les meilleures d’abord'], ['recents', 'Les plus récentes d’abord'], ['nom', 'Par nom']].map(([v, l]) => h('option', { value: v, selected: f.tri === v ? true : null }, l)));
  const bascule = (cle, lib) => h('label', { class: 'op-bascule' }, h('input', { type: 'checkbox', checked: f[cle] ? true : null, onchange: (e) => { f[cle] = e.target.checked; memoriser(); recharger(); } }), h('span', null, lib));

  const conseil = CONSEILS[f.cat] ? h('details', { class: 'tc-conseil' },
    h('summary', null, icone('telephone'), `Comment aborder ${f.cat === 'club' ? 'une boîte de nuit' : f.cat === 'hotel' ? 'un hôtel' : f.cat === 'chantier' ? 'un chantier' : `un ${LIB_CAT[f.cat].toLowerCase().replace(/s$/, '')}`}`),
    h('dl', null,
      h('dt', null, 'Qui demander'), h('dd', null, CONSEILS[f.cat][0]),
      h('dt', null, 'Quand appeler'), h('dd', null, CONSEILS[f.cat][1]),
      h('dt', null, 'Quoi proposer'), h('dd', null, CONSEILS[f.cat][2]),
      h('dt', null, 'Si on vous demande un prix'), h('dd', null, 'à partir de 25 € HT de l’heure, 30 € HT en événementiel ; le devis exact se fait après la visite.'))) : null;

  async function recharger() {
    page = 1;
    liste.classList.add('is-charge');
    try {
      charge = await api('prospects', undefined, { ...requete(), page: 1 });
      if (charge.chiffres) { ch.suivi = charge.chiffres.suivi; ch.categories = charge.chiffres.categories; dessinerSuivi(); }
      dessiner(false);
    } catch (e) { erreur(e); }
    liste.classList.remove('is-charge');
  }
  function dessiner(ajout) {
    const cartes = charge.items.map((p) => cartePiste(p, () => recharger()));
    if (ajout) liste.append(...cartes);
    else liste.replaceChildren(...(cartes.length ? cartes : [videPistes()]));
    resume.textContent = charge.total ? `${pluriel(charge.total, 'piste', 'pistes')}${f.statut === 'a_contacter' ? ' à contacter' : f.statut === 'rappels' ? ' à rappeler' : ''}${f.dep ? ` · ${DEPS.find(([v]) => v === f.dep)[1]}` : ''}` : '';
    // replaceChildren écrirait « null » : on passe une liste vide quand il n'y a plus rien à voir
    pied.replaceChildren(...(page < charge.pages ? [h('button', { class: 'btn btn--ghost', type: 'button', onclick: async (e) => {
      e.currentTarget.disabled = true;
      try { page++; charge = await api('prospects', undefined, { ...requete(), page }); dessiner(true); } catch (err) { erreur(err); }
    } }, `Voir ${Math.min(40, charge.total - page * 40)} pistes de plus`)] : []));
  }
  function videPistes() {
    const vide = !Object.values(ch.categories || {}).some((c) => c.total);
    return h('div', { class: 'vide' }, icone('recherche'),
      h('p', null, vide ? 'Pas encore de pistes : lancez la première recherche avec « Chercher maintenant ».'
        : f.statut === 'rappels' ? 'Personne à rappeler aujourd’hui.' : 'Aucune piste avec ces filtres.'));
  }

  zone.replaceChildren(
    h('div', { class: 'tc-filtres' },
      h('div', { class: 'tc-filtres__ligne' }, h('span', { class: 'tc-etiquette' }, 'Suivi'), suivi),
      h('div', { class: 'tc-filtres__ligne' },
        h('div', { class: 'recherche' }, icone('recherche'), recherche), dep, tri,
        bascule('tel', 'Avec téléphone'), bascule('nouveaux', 'Ouvertures et chantiers récents'))),
    ...[conseil, resume, liste, pied].filter(Boolean));
  if (d0) dessiner(false);
  else { liste.replaceChildren(h('div', { class: 'chargement' })); recharger(); }
}

function cartePiste(p, apres) {
  const score = Number(p.score) || 0;
  const niveau = score >= 70 ? ['fort', 'Priorité'] : score >= 45 ? ['moyen', 'Bonne piste'] : ['faible', 'À voir'];
  const lieu = [p.adresse, [p.cp, p.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const carte = p.lat && p.lon ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}` : lieu ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.nom} ${lieu}`)}` : '';
  const chercherNum = `https://www.google.com/search?q=${encodeURIComponent(`${p.nom} ${p.ville || p.cp || ''} téléphone`)}`;
  const societe = p.siren ? `https://annuaire-entreprises.data.gouv.fr/entreprise/${p.siren}` : '';

  /* ----- Suivi : statut, rappel, note ----- */
  const enreg = h('small', { class: 'muet tc-enreg' });
  const sauver = async (champs, message) => {
    try { await api('prospect.maj', { id: p.id, ...champs }); Object.assign(p, champs); if (message) toast(message); enreg.textContent = 'Enregistré'; return true; } catch (e) { erreur(e); return false; }
  };
  const statut = h('select', { class: 'input tc-statut', 'aria-label': 'Où en êtes-vous ?', dataset: { statut: p.statut },
    onchange: async (e) => {
      const v = e.target.value;
      if (await sauver({ statut: v }, v === 'client' ? 'Bravo, nouveau client.' : `Marqué « ${LIB_STATUT[v]} ».`)) { statut.dataset.statut = v; art.dataset.statut = v; }
      else e.target.value = p.statut;
    } }, STATUTS.map(([v, l]) => h('option', { value: v, selected: p.statut === v ? true : null }, l)));
  const relance = h('input', { class: 'input tc-relance', type: 'date', value: p.relance || '', 'aria-label': 'Rappeler le', min: iso(new Date()),
    onchange: (e) => sauver({ relance: e.target.value }, e.target.value ? `Rappel noté pour le ${dateLisible(e.target.value)}.` : 'Rappel retiré.') });
  const raccourcis = h('span', { class: 'tc-raccourcis' }, [['Demain', 1], ['Dans 1 semaine', 7], ['Dans 1 mois', 30]].map(([l, j]) => h('button', { type: 'button', class: 'lien', onclick: () => {
    const x = new Date(); x.setDate(x.getDate() + j); relance.value = iso(x); relance.dispatchEvent(new Event('change'));
  } }, l)));
  const note = zoneTexte({ rows: 2, value: p.note || '', placeholder: 'Note : qui vous avez eu, ce qui a été dit, ce qu’il faut envoyer…' });
  const sauverNote = attendre(() => sauver({ note: note.value }), 800);
  note.addEventListener('input', () => { enreg.textContent = '…'; sauverNote(); });

  const rappelDu = p.relance && p.relance <= iso(new Date()) && !['client', 'refus'].includes(p.statut);
  const art = h('article', { class: `tc-piste tc-piste--${niveau[0]}`, dataset: { statut: p.statut } },
    h('div', { class: 'tc-piste__tete' },
      h('span', { class: `tc-niveau tc-niveau--${niveau[0]}`, title: `Note de priorité : ${score} sur 100` }, niveau[1]),
      h('span', { class: 'tc-type' }, icone((CATEGORIES.find((c) => c.k === p.categorie) || CATEGORIES[0]).ic), LIB_CAT[p.categorie] || ''),
      vuAvant !== null && p.nouveau_le && p.nouveau_le > vuAvant ? h('span', { class: 'op-nouveau' }, 'Nouveau') : null,
      rappelDu ? h('span', { class: 'tc-rappel-du' }, icone('horloge'), 'À rappeler aujourd’hui') : null),
    h('div', { class: 'tc-piste__corps' },
      h('div', { class: 'tc-piste__infos' },
        h('h3', { class: 'tc-nom' }, p.nom),
        p.activite ? h('p', { class: 'tc-activite' }, p.activite) : null,
        p.signal ? h('p', { class: 'tc-signal' }, icone('eclair'), p.signal) : null,
        p.atouts.length ? h('div', { class: 'tc-atouts' }, p.atouts.map((a) => h('span', null, a))) : null,
        lieu ? h('p', { class: 'tc-lieu' }, icone('lieu'), carte ? h('a', { href: carte, target: '_blank', rel: 'noopener' }, lieu) : lieu) : null,
        p.infos?.societe ? h('p', { class: 'tc-lieu muet' }, `Société : ${p.infos.societe}`) : null,
        p.horaires ? h('p', { class: 'tc-lieu muet' }, icone('horloge'), p.horaires) : null),
      h('div', { class: 'tc-piste__contact' },
        p.tel ? h('a', { class: 'btn btn--gold tc-appel', href: `tel:${p.tel.replace(/\s/g, '')}` }, icone('telephone'), p.tel)
          : h('a', { class: 'btn btn--ghost tc-appel', href: chercherNum, target: '_blank', rel: 'noopener' }, icone('recherche'), 'Trouver le numéro'),
        p.site ? h('a', { class: 'btn btn--ghost btn--petit', href: p.site, target: '_blank', rel: 'noopener' }, icone('site'), 'Site internet') : null,
        h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => preparerMail(p, () => { if (p.statut === 'a_contacter') { statut.value = 'contacte'; statut.dispatchEvent(new Event('change')); } }) }, icone('mail'), p.mail ? 'Écrire un mail' : 'Préparer un mail'),
        societe ? h('a', { class: 'btn btn--ghost btn--petit', href: societe, target: '_blank', rel: 'noopener', title: 'Dirigeants, adresse du siège, effectif' }, icone('dossier'), 'Fiche société') : null)),
    h('div', { class: 'tc-piste__suivi' },
      h('label', { class: 'tc-champ' }, h('span', null, 'Où en êtes-vous ?'), statut),
      h('label', { class: 'tc-champ' }, h('span', null, 'Rappeler le'), relance),
      raccourcis,
      h('button', { type: 'button', class: 'lien tc-ignorer', title: 'Ne plus afficher cette piste', onclick: async () => {
        if (await sauver({ statut: 'ignore' }, 'Piste retirée de la liste.')) { art.classList.add('is-retire'); setTimeout(() => art.remove(), 250); }
      } }, 'Ne plus afficher')),
    h('details', { class: 'tc-note', open: p.note ? true : null }, h('summary', null, p.note ? 'Note' : 'Ajouter une note'), note, enreg));
  return art;
}

/* ----- Mail de présentation prêt à envoyer, adapté au type de lieu et à ce qui vient de se passer ----- */
const PHRASES_MAIL = {
  bar: 'Nous accompagnons les bars et les établissements de nuit : agent à l’entrée, gestion de la clientèle et des incidents, renforts les soirs d’affluence et de match.',
  club: 'Nous accompagnons les établissements de nuit : contrôle à l’entrée, sécurité en salle, renforts pour vos soirées.',
  hotel: 'Nous intervenons auprès des hôtels : agent de sécurité de nuit, agents SSIAP, renforts pour vos événements.',
  magasin: 'Nous intervenons en magasin : agents de prévention contre les vols, renforts pour les périodes d’affluence (fêtes de fin d’année, soldes).',
  restaurant: 'Nous intervenons auprès des restaurants : un agent les soirs de forte affluence et lors de vos événements privés.',
  chantier: 'Nous assurons le gardiennage de chantiers : surveillance de nuit et du week-end, rondes, contrôle d’accès à la base vie.',
};
const SIGNATURE = 'Mr BOUIDIA - Gérant\nBDA Security Group\nTél : 07 84 73 90 70\nE-mail : bdasecurite@gmail.com\nWeb : bdasecurite.com';
function preparerMail(p, apresEnvoi) {
  const s = String(p.signal || '');
  const accroche = /Nouveau propriétaire/.test(s) ? 'Félicitations pour la reprise de votre établissement.\n\n'
    : /Nouvel établissement/.test(s) ? 'Félicitations pour l’ouverture de votre établissement.\n\n'
      : p.categorie === 'chantier' && /Chantier|Permis/.test(s) ? `J’ai appris le lancement de votre projet${p.adresse ? ` ${p.adresse}` : ''}${p.ville ? ` à ${p.ville}` : ''}.\n\n` : '';
  const sujets = { chantier: 'Gardiennage de votre chantier', bar: 'Sécurité de votre établissement', club: 'Sécurité de votre établissement', hotel: 'Sécurité de votre hôtel', magasin: 'Sécurité de votre magasin', restaurant: 'Sécurité de votre restaurant' };
  const objet = saisie({ value: `${sujets[p.categorie] || 'Sécurité de votre établissement'} — BDA Security Group` });
  const corps = zoneTexte({ rows: 13, value: `Bonjour,\n\n${accroche}Je me permets de vous présenter BDA Security Group, société de sécurité privée basée à Paris.\n\n${PHRASES_MAIL[p.categorie] || ''}\n\nNos agents sont disponibles pour des missions ponctuelles comme régulières, de jour comme de nuit. Je serais ravi d’échanger avec vous pour étudier vos besoins.\n\nBien cordialement,\n\n${SIGNATURE}` });
  const dest = saisie({ type: 'email', value: p.mail || '', placeholder: 'Adresse de contact (contact@…, info@…)' });
  modale({
    titre: `Mail pour ${p.nom}`,
    large: true,
    contenu: h('div', { class: 'form-grille' },
      champ('À', dest, p.mail ? 'Adresse publique trouvée par le robot.' : 'Cherchez l’adresse de contact sur leur site ou leur fiche Google.'),
      champ('Objet', objet), champ('Message', corps, 'Relisez et ajustez avant d’envoyer. Si votre messagerie ajoute déjà votre signature, retirez celle du texte.')),
    actions: [
      { libelle: 'Copier le texte', classe: 'btn--ghost', action: async () => {
        try { await navigator.clipboard.writeText(`${objet.value}\n\n${corps.value}`); toast('Texte copié.'); } catch (e) { toast('Copie impossible : sélectionnez le texte.', 'erreur'); }
        return false;
      } },
      { libelle: 'Ouvrir dans ma messagerie', classe: 'btn--gold', submit: true, action: () => {
        location.href = `mailto:${encodeURIComponent(dest.value.trim())}?subject=${encodeURIComponent(objet.value)}&body=${encodeURIComponent(corps.value)}`;
        apresEnvoi?.();
        return true;
      } },
    ],
  });
}

/* ----- « Chercher maintenant » : la recherche tourne sur le serveur, la page suit son avancement ----- */
async function chercher(bouton, recharger) {
  bouton.disabled = true;
  const lib = bouton.querySelector('span');
  lib.textContent = 'Recherche lancée…';
  try {
    await Promise.all([api('robot.lancer', {}), api('veille.lancer', {}).catch(() => null)]);
    toast('Le robot cherche. Les nouvelles pistes arrivent dans la liste au fil des minutes.');
    // la page se met à jour toute seule pendant la recherche (tant qu'on reste dessus)
    for (const s of [20, 60, 120, 240]) setTimeout(() => { if (location.hash.startsWith('#/opportunites') && !document.querySelector('.modale-fond, .tc-piste textarea:focus, .tc-piste select:focus')) recharger(); }, s * 1000);
  } catch (e) {
    erreur(e);
    bouton.disabled = false;
    lib.textContent = 'Chercher maintenant';
  }
}
/* ----- Explications simples : d'où viennent les pistes, comment elles sont notées ----- */
function commentCaMarche(d) {
  const lignes = Object.entries(d.taches || {}).map(([k, t]) => {
    const e = t.etat;
    return h('tr', null,
      h('td', null, h('b', null, t.libelle), h('small', null, t.source)),
      h('td', null, !e ? 'Pas encore lancé' : e.en_cours && !e.ok_le ? 'En cours…' : e.ok === false ? h('span', { class: 'tc-ko' }, 'Erreur, nouvel essai bientôt') : `${nb.format(e.trouves || 0)} trouvés`),
      h('td', null, e?.quand ? ilYa(e.quand) : '—'));
  });
  modale({
    titre: 'Comment marche le robot',
    large: true,
    contenu: h('div', { class: 'tc-aide' },
      h('p', null, 'Le robot fouille des listes publiques et gratuites, puis range ce qu’il trouve par catégorie. Il tourne tout seul plusieurs fois par jour. Vous n’avez rien à régler.'),
      h('ul', null,
        h('li', null, h('b', null, 'Ouvertures et reprises : '), 'chaque jour, le journal officiel des entreprises (BODACC) annonce les bars, clubs, hôtels et restaurants qui ouvrent ou changent de propriétaire. Un nouveau patron, c’est le meilleur moment pour proposer vos agents.'),
        h('li', null, h('b', null, 'Chantiers : '), 'les permis de construire des gros projets (plus de 30 logements, grands bureaux, commerces, hôtels) et les grands chantiers privés de Paris. Le nom affiché est le maître d’ouvrage, celui qui paie le chantier.'),
        h('li', null, h('b', null, 'Annuaire des lieux : '), 'tous les bars, boîtes de nuit, hôtels, magasins et restaurants d’Île-de-France connus de la carte OpenStreetMap, avec leur téléphone et leurs horaires quand ils existent.'),
        h('li', null, h('b', null, 'Appels d’offres et recrutements : '), 'les marchés publics de gardiennage (BOAMP) et les entreprises qui vont embaucher des agents de sécurité (France Travail).')),
      h('p', null, h('b', null, 'La note de priorité. '), '« Priorité » = à appeler en premier : boîte de nuit, bar ouvert tard, hôtel 4 ou 5 étoiles, grand magasin, gros chantier, ou lieu qui vient d’ouvrir. « Bonne piste » = intéressant. « À voir » = plus petit ou moins sûr.'),
      h('p', null, h('b', null, 'Le suivi. '), 'Après un appel, choisissez « Contacté », « Intéressé », « Devis envoyé »… et mettez une date de rappel : la piste reviendra dans « À rappeler » et dans la cloche le jour venu.'),
      h('table', { class: 'tc-sources' }, h('thead', null, h('tr', null, h('th', null, 'Recherche'), h('th', null, 'Résultat'), h('th', null, 'Dernière fois'))), h('tbody', null, lignes))),
    actions: [{ libelle: 'Fermer', classe: 'btn--gold', valeur: true }],
  });
}

/* =========================================================
   Appels d'offres (BOAMP) et entreprises qui recrutent (France Travail)
   ========================================================= */
const NIVEAUX = { fort: 'Très pertinent', moyen: 'À regarder', faible: 'Faible' };
const euros = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const fv = { statut: 'a_traiter', faibles: false, q: '' };
try { Object.assign(fv, JSON.parse(localStorage.getItem('bda-opp-filtres') || '{}')); } catch (e) { /* navigation privée */ }
const memoriserVeille = () => { try { localStorage.setItem('bda-opp-filtres', JSON.stringify(fv)); } catch (e) { /* rien */ } };
function joursRestants(limite) {
  if (!limite) return null;
  const j = new Date(limite.slice(0, 10) + 'T00:00:00');
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  return Math.round((j - auj) / 864e5);
}

async function vueVeille(zone, type, cible, recharger) {
  zone.replaceChildren(h('div', { class: 'chargement' }));
  let d;
  try { d = await api('opportunites'); } catch (e) { zone.replaceChildren(h('div', { class: 'vide' }, icone('alerte'), h('p', null, e.message))); return; }
  if (!document.body.contains(zone)) return;
  const liste = d.opportunites.filter((o) => (type === 'recrutement' ? o.type === 'recrutement' : o.type !== 'recrutement'));
  const vuAvant = d.vuAvant || '';
  if (cible) { const o = liste.find((x) => x.id === cible); if (o && fv.statut !== 'tous' && fv.statut !== o.statut) fv.statut = o.statut; }

  const etat = d.etat || {};
  const src = etat.sources?.[type === 'recrutement' ? 'francetravail' : 'boamp'];
  const config = type === 'recrutement' && !d.franceTravail;
  const bandeau = h('p', { class: `tc-veille-etat ${src?.ok === false || config ? 'is-ko' : ''}` },
    h('i', { class: 'op-point' }),
    type === 'recrutement'
      ? 'Entreprises d’Île-de-France qui vont recruter des agents de sécurité dans les 6 mois (France Travail) : proposez-leur vos agents plutôt qu’une embauche. '
      : 'Marchés publics de gardiennage et de sécurité en Île-de-France (BOAMP). On répond sur la plateforme de l’acheteur, pas par mail. ',
    config ? 'Identifiants France Travail à configurer dans Réglages.' : !src ? 'Pas encore lancé.' : src.ok ? `Vérifié ${ilYa(src.quand)}.` : `Erreur : ${src.message}`);

  const zoneStatuts = h('div', { class: 'chips' });
  const zoneListe = h('div', { class: 'op-liste' });
  const compter = (fn) => liste.filter(fn).length;
  const recherche = saisie({ type: 'search', class: 'input input--recherche', placeholder: 'Rechercher (acheteur, ville, mot…)', value: fv.q, oninput: attendre((e) => { fv.q = e.target.value; dessiner(); }, 200) });
  const faibles = type === 'ao' ? h('label', { class: 'op-bascule' }, h('input', { type: 'checkbox', checked: fv.faibles ? true : null, onchange: (e) => { fv.faibles = e.target.checked; memoriserVeille(); dessiner(); } }), h('span', null, 'Afficher aussi les moins pertinents')) : null;
  function dessiner() {
    zoneStatuts.replaceChildren(...[['a_traiter', 'À traiter'], ['contacte', 'Contactés'], ['ignore', 'Ignorés'], ['tous', 'Tous']].map(([k, l]) => h('button', { type: 'button', class: `chip ${fv.statut === k ? 'is-actif' : ''}`, onclick: () => { fv.statut = k; memoriserVeille(); dessiner(); } },
      l, h('span', null, k === 'tous' ? liste.length : compter((o) => o.statut === k)))));
    const q = sansAccents(fv.q.trim());
    const vis = liste.filter((o) => (fv.statut === 'tous' || o.statut === fv.statut)
      && (fv.faibles || o.niveau !== 'faible' || o.type === 'recrutement' || o.id === cible)
      && (!q || sansAccents(`${o.titre} ${o.acheteur} ${o.lieu} ${o.extrait}`).includes(q)));
    zoneListe.replaceChildren(...(vis.length ? vis.map((o) => carteVeille(o, vuAvant, o.id === cible, dessiner)) : [h('div', { class: 'vide' }, icone('recherche'), h('p', null, liste.length ? 'Rien avec ces filtres.' : 'Rien pour le moment : la veille vérifie toutes les 30 minutes.'))]));
  }
  zone.replaceChildren(bandeau, h('div', { class: 'op-filtres' }, zoneStatuts, h('div', { class: 'op-filtres__ligne' }, ...[h('div', { class: 'recherche' }, icone('recherche'), recherche), faibles].filter(Boolean))), zoneListe);
  dessiner();
  if (cible) setTimeout(() => { const el = document.getElementById(`opp-${cible}`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('is-cible'); } }, 150);
}

function carteVeille(o, vuAvant, cible, redessiner) {
  const j = joursRestants(o.date_limite);
  const urgence = j === null ? 'aucune' : j < 0 ? 'clos' : j <= 3 ? 'rouge' : j <= 7 ? 'orange' : 'or';
  const statutZone = h('div', { class: 'op-statuts' });
  const majStatut = () => statutZone.replaceChildren(...[['a_traiter', 'À traiter'], ['contacte', 'Contacté'], ['ignore', 'Ignoré']].map(([k, l]) => h('button', {
    type: 'button', class: `op-statut ${o.statut === k ? `is-actif is-${k}` : ''}`, 'aria-pressed': o.statut === k ? 'true' : 'false',
    onclick: async () => {
      const avant = o.statut;
      o.statut = k; majStatut();
      try { await api('opportunite.statut', { id: o.id, statut: k }); toast(k === 'ignore' ? 'Ignorée.' : k === 'contacte' ? 'Marquée comme contactée.' : 'Remise à traiter.'); redessiner(); } catch (e) { o.statut = avant; majStatut(); erreur(e); }
    },
  }, l)));
  majStatut();
  const note = zoneTexte({ rows: 2, value: o.note || '', placeholder: 'Note (qui appeler, ce qui a été envoyé, relance…)' });
  const sauver = attendre(async () => { try { await api('opportunite.note', { id: o.id, note: note.value }); o.note = note.value; enreg.textContent = 'Enregistré'; } catch (e) { erreur(e); } }, 800);
  const enreg = h('small', { class: 'muet' });
  note.addEventListener('input', () => { enreg.textContent = '…'; sauver(); });
  const infos = [o.acheteur, o.lieu].filter(Boolean).join(' · ');
  return h('article', { class: `op-carte op-carte--${o.type} ${o.statut === 'ignore' ? 'is-ignore' : ''} ${cible ? 'is-cible' : ''}`, id: `opp-${o.id}` },
    h('div', { class: `op-jx op-jx--${urgence}` },
      j === null ? [h('b', null, o.type === 'recrutement' ? icone('agents') : '—'), h('span', null, o.type === 'recrutement' ? dateLisible(o.date_parution) : 'sans date')]
        : j < 0 ? [h('b', null, 'Clos'), h('span', null, dateLisible(o.date_limite))]
          : [h('b', null, j === 0 ? 'J' : `J-${j}`), h('span', null, dateLisible(o.date_limite, true))]),
    h('div', { class: 'op-corps' },
      h('div', { class: 'op-meta' },
        o.type !== 'recrutement' ? h('span', { class: `op-niveau op-niveau--${o.niveau}`, title: `Score ${o.score}` }, NIVEAUX[o.niveau] || '') : null,
        o.nature ? h('span', { class: 'muet' }, o.nature) : null,
        o.cree > vuAvant && vuAvant ? h('span', { class: 'op-nouveau' }, 'Nouveau') : null),
      h('h3', { class: 'op-titre' }, o.url ? h('a', { href: o.url, target: '_blank', rel: 'noopener' }, o.titre) : o.titre),
      infos ? h('p', { class: 'op-infos' }, infos) : null,
      o.montant > 0 || o.alertes.length ? h('div', { class: 'op-badges' },
        o.montant > 0 ? h('span', { class: 'op-badge op-badge--montant' }, `≈ ${euros.format(o.montant)} € HT`) : null,
        o.alertes.map((a) => h('span', { class: `op-badge ${/Reprise|IGH|Gros|NF|APSAD/.test(a) ? 'op-badge--alerte' : /adaptée/.test(a) ? 'op-badge--ok' : ''}` }, a))) : null,
      h('div', { class: 'op-actions' },
        o.url ? h('a', { class: 'btn btn--gold btn--petit', href: o.url, target: '_blank', rel: 'noopener' }, o.source === 'boamp' ? 'Voir l’avis' : 'Voir l’entreprise', icone('fleche')) : null,
        o.url_dossier ? h('a', { class: 'btn btn--ghost btn--petit', href: o.url_dossier, target: '_blank', rel: 'noopener' }, 'Dossier de consultation') : null,
        statutZone),
      h('details', { class: 'op-details', open: o.note ? true : null },
        h('summary', null, o.note ? 'Note et détail' : 'Ajouter une note · détail'),
        o.extrait ? h('p', { class: 'op-extrait' }, o.extrait) : null,
        note, enreg)));
}

/* ---------- Réglages de la veille (secrets rangés dans le .env privé du serveur) ---------- */
async function reglages(recharger) {
  let r;
  try { r = await api('veille.reglages'); } catch (e) { return erreur(e); }
  const ftId = saisie({ placeholder: r.ftId || 'PAR_bdasecuritygroup_…', autocomplete: 'off' });
  const ftSecret = saisie({ type: 'password', placeholder: r.ftSecret ? '•••••••• (enregistrée)' : 'Clé secrète', autocomplete: 'new-password' });
  const cron = h('code', { class: 'op-code' }, r.cron);
  const ok = await modale({
    titre: 'Réglages de la recherche',
    large: true,
    contenu: h('div', { class: 'form-grille' },
      h('p', { class: 'modale__texte' }, `Les secrets sont rangés dans ${r.envFichier}, jamais dans le code ni sur GitHub. Laissez un champ vide pour garder la valeur actuelle.`),
      h('div', { class: 'form-grille form-grille--2' },
        champ('France Travail : identifiant client', ftId, r.ftId ? `Actuel : ${r.ftId}` : 'francetravail.io > Mes applications'),
        champ('France Travail : clé secrète', ftSecret, r.ftSecret ? 'Une clé est enregistrée.' : '')),
      h('div', { class: 'op-cron' },
        h('b', null, 'Lancement automatique (cron-job.org, toutes les 30 minutes)'),
        h('p', { class: 'muet' }, 'Cette adresse lance la veille ET le robot de prospection. Collez-la dans votre tâche cron-job.org (Exécution : toutes les 30 minutes). Elle contient un code secret : ne la partagez pas.'),
        cron,
        h('div', { class: 'op-actions' },
          h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(r.cron); toast('Adresse copiée.'); } catch (e) { erreur('Copie impossible : sélectionnez le texte.'); } } }, icone('copier'), 'Copier'),
          h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => { try { await api('veille.reglages.enregistrer', { nouveauCodeCron: true }); const n = await api('veille.reglages'); r.cron = n.cron; cron.textContent = n.cron; toast('Nouveau code créé : mettez à jour cron-job.org.'); } catch (e) { erreur(e); } } }, 'Nouveau code secret'))),
      h('div', { class: 'op-actions' },
        h('a', { class: 'btn btn--ghost btn--petit', href: '#/notifications' }, icone('mobile'), 'Notifications sur le téléphone'),
        h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async (e) => {
          e.currentTarget.disabled = true;
          try { const t = await api('veille.tester', {}); toast(`Test : ${t.push.envoyes} notification(s) envoyée(s) sur les téléphones.`, t.push.envoyes ? 'ok' : 'erreur'); } catch (err) { erreur(err); }
          e.currentTarget.disabled = false;
        } }, icone('envoyer'), 'Envoyer un message de test'))),
    actions: [{ libelle: 'Fermer', classe: 'btn--ghost', valeur: false }, { libelle: 'Enregistrer', classe: 'btn--gold', submit: true, action: async () => {
      try {
        await api('veille.reglages.enregistrer', { ftId: ftId.value.trim(), ftSecret: ftSecret.value.trim() });
        toast('Réglages enregistrés.');
        return true;
      } catch (e) { erreur(e); return false; }
    } }],
  });
  if (ok) recharger();
}
