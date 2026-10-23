/* =========================================================
   ESPACE ADMIN BDA — contrats : textes des articles
   Chaque document = une liste de blocs (en-tête, parties,
   articles, signatures) que contrats.js range en pages A4.
   Les valeurs vides deviennent des blancs à remplir à la main.
   ========================================================= */
import { h, isoVersFr, marqueLogo } from './outils.js';

/* ---------- Règles de la convention collective et de la loi utilisées par les modèles ---------- */
export const CCN = {
  secu: 'convention collective nationale des entreprises de prévention et de sécurité du 15 février 1985 (IDCC 1351)',
  vtc: '',
  smic: 12.02,
  minimumPartiel: 24,
  zone: 'Paris et les départements d’Île-de-France (75, 77, 78, 91, 92, 93, 94 et 95)',
  casModification: 'Absence d’un salarié à remplacer, surcroît d’activité, demande d’un client (nouvel horaire, nouvelle mission, événement), modification du planning du site. La modification peut porter sur les jours travaillés et sur les horaires de chaque journée.',
  prevenancePartiel: 7,
  delaiPlanning: 7,
  aideTaux: 'Au moins le minimum de la grille pour ce coefficient.',
  tarifsDefaut: 'Agent de sécurité (ADS) : 25,00 € HT de l’heure\nAgent SSIAP 1 : 26,00 € HT de l’heure\nAgent SSIAP 2 : 28,00 € HT de l’heure\nAgent SSIAP 3 : 34,00 € HT de l’heure\nAgent de sécurité événementielle : 30,00 € HT de l’heure',
  qualifs: {
    ads: 'Niveau III, échelon 2, coefficient 140', adsConfirme: 'Niveau III, échelon 3, coefficient 150', cynophile: 'Niveau III, échelon 2, coefficient 140',
    video: 'Niveau III, échelon 2, coefficient 140', chefPoste: 'Niveau IV, échelon 1, coefficient 160', chefEquipe: 'Niveau IV, échelon 2, coefficient 170',
    ssiap1: 'Niveau III, échelon 2, coefficient 140', ssiap2: 'Niveau IV, échelon 2, coefficient 160', ssiap3: 'Agent de maîtrise, niveau … , coefficient …',
    apr: 'Coefficient …', aprChef: 'Coefficient …', assistant: 'Niveau III, échelon 1, coefficient 130', secretaire: 'Niveau III, échelon 1, coefficient 130', planning: 'Niveau IV, échelon 1, coefficient 160',
  },
  // Période d'essai d'un CDI selon le statut
  essai: { Employé: '…', 'Agent de maîtrise': '…', Cadre: '…' },
  essaiRenouvellement: '',
  preavis: '',
};

/* ---------- Petits outils de texte ---------- */
const V = (v, ph = '') => ({ v: v == null ? '' : String(v).trim(), ph });
const B = (v) => ({ b: String(v ?? '') });
const D = (iso, ph = 'date') => V(isoVersFr(iso), ph);
// Paragraphe : P`texte ${valeur} texte` → liste de morceaux (texte, valeur saisie ou blanc)
function P(ch, ...vals) {
  const out = [];
  ch.forEach((c, i) => {
    if (c) out.push(c);
    if (i >= vals.length) return;
    const x = vals[i];
    if (x == null || x === false || x === '') return;
    if (Array.isArray(x)) out.push(...x); else out.push(x);
  });
  return out;
}
const L = (texte) => [`– ${texte}`];
const nombreFr = (n, dec = 2) => (Number.isFinite(+n) ? (+n).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '');
const heuresFr = (n) => (Number.isFinite(+n) && +n > 0 ? String(Math.round(+n * 100) / 100).replace('.', ',') : '');
const lignes = (t) => String(t || '').split('\n').map((s) => s.trim()).filter(Boolean);
const uneLigne = (t) => lignes(t).join(', ');
export function heuresMois(d) {
  const hebdo = d.temps === 'partiel' ? +d.tps.hebdo : 35;
  if (!(hebdo > 0)) return 0;
  return d.temps === 'partiel' ? Math.round(hebdo * 52 / 12 * 100) / 100 : 151.67;
}
const g = (d) => {
  const c = d.sal?.civ;
  return { e: c === 'Mme' ? 'e' : c === 'M.' ? '' : '(e)', civ: c === 'Mme' ? 'Madame' : c === 'M.' ? 'Monsieur' : 'Monsieur / Madame' };
};
const nomComplet = (s) => [s.prenom, (s.nom || '').toUpperCase()].filter(Boolean).join(' ');

/* ---------- Blocs ---------- */
function rendrePart(x) {
  if (typeof x === 'string') return x;
  if (x.b != null) return h('b', null, x.b);
  return x.v ? h('span', { class: 'ct-blanc' }, x.v) : h('span', { class: 'ct-blanc ct-blanc--vide', title: x.ph || 'à remplir' }, '…');
}
function rendrePara(parts) {
  const premier = typeof parts[0] === 'string' ? parts[0] : '';
  const cls = premier.startsWith('– ') ? 'ct-p ct-p--puce' : parts.note ? 'ct-p ct-p--note' : 'ct-p';
  return h('p', { class: cls }, parts.map(rendrePart));
}
// Texte modifié à la main : une ligne = un paragraphe, « ……… » = blanc
function depuisTexte(t) {
  return lignes(t).map((l) => l.split(/(…{2,}|\.{5,}|_{4,})/).filter((s) => s !== '').map((s) => (/^(…{2,}|\.{5,}|_{4,})$/.test(s) ? V('') : s)));
}
export function texteDe(a) {
  return a.paras.map((p) => p.map((x) => (typeof x === 'string' ? x : x.b != null ? x.b : x.v || '………')).join('')).join('\n');
}
const art = (cle, titre, paras, o = {}) => ({ type: 'article', cle, titre, paras: paras.filter((p) => p && p.length), ...o });

function enTete(d, titre, sous) {
  const E = d.emp || {};
  const id = [E.siret ? `SIRET ${E.siret}` : '', E.ape ? `APE ${E.ape}` : '', E.cnaps ? `Autorisation CNAPS n° ${E.cnaps}` : '', E.evtc && d.metier === 'vtc' ? `EVTC ${E.evtc}` : ''].filter(Boolean).join(' · ');
  // Titre et sous-titre modifiables (section « Titre, lieu et date »)
  const t = String(d.titreDoc || '').trim() || titre;
  const s = String(d.sousDoc || '').trim() || sous;
  return [
    { type: 'tete', el: () => h('header', { class: 'ct-tete', dataset: { section: 'modele' } }, marqueLogo('ct-marque'),
      h('div', { class: 'ct-tete__emp' }, h('b', null, E.nom || ''), h('div', null, lignes(E.adresse).join(' · ')), id ? h('div', null, id) : null)) },
    { type: 'titre', el: () => h('div', { class: 'ct-entete-titre', dataset: { section: 'fait' } }, h('h1', { class: 'ct-titre' }, t), s ? h('p', { class: 'ct-sous' }, s) : null, h('i', { class: 'ct-filet' })) },
  ];
}
// L'employeur décrit en une phrase (EI ou société)
function phraseEmployeur(E, role = 'l’Employeur') {
  const adr = uneLigne(E.adresse);
  const cnaps = E.cnaps ? `, titulaire de l’autorisation d’exercer n° ${E.cnaps} délivrée par le Conseil national des activités privées de sécurité (CNAPS)` : '';
  if (E.type === 'ei') {
    return P`${B(`M. ${E.representant || ''}`)}, entrepreneur individuel exerçant sous le nom commercial ${B(`« ${E.nom || ''} »`)}, dont l’établissement est situé ${V(adr, 'adresse')}, immatriculé sous le n° SIRET ${V(E.siret, 'SIRET')}${E.ape ? ` (code APE ${E.ape})` : ''}${cnaps}, ci-après « ${role} »,`;
  }
  return P`La société ${B(E.nom || '')}, ${V(E.forme, 'forme et capital')}, dont le siège social est situé ${V(adr, 'adresse')}, immatriculée ${E.rcs ? `au ${E.rcs}` : 'au registre du commerce'} (SIRET ${V(E.siret, 'SIRET')})${cnaps}, représentée par ${V(E.representant, 'nom')}, en qualité de ${V(E.qualite, 'qualité')}, ci-après « ${role} »,`;
}
function phraseSalarie(d, role = 'le Salarié') {
  const S = d.sal, G = g(d);
  const etranger = S.ue === false ? P`, titulaire du titre de séjour ${V(S.titreSejour, 'type et n°')} valable jusqu’au ${D(S.titreFin)} et l’autorisant à travailler en France` : '';
  return P`${B(`${G.civ} ${nomComplet(S)}`)}, né${G.e} le ${D(S.naissance)} à ${V(S.lieuNaissance, 'lieu')}, de nationalité ${V(S.nationalite, 'nationalité')}, demeurant ${V(uneLigne(S.adresse), 'adresse')}, immatriculé${G.e} à la Sécurité sociale sous le n° ${V(S.nir, 'n° de sécurité sociale')}${etranger}, ci-après « ${role} »,`;
}
function parties(premier, second, intro = 'Il a été convenu ce qui suit :') {
  return { type: 'parties', el: () => h('div', { class: 'ct-parties', dataset: { section: 'salarie' } },
    h('p', { class: 'ct-entre' }, 'Entre les soussignés :'),
    h('div', { class: 'ct-partie' }, rendrePara(premier), h('p', { class: 'ct-p' }, 'd’une part,')),
    h('p', { class: 'ct-entre' }, 'Et :'),
    h('div', { class: 'ct-partie' }, rendrePara(second), h('p', { class: 'ct-p' }, 'd’autre part.')),
    h('p', { class: 'ct-p' }, intro)) };
}
function signatures(d, gauche, droite, mentionDroite = 'Faire précéder la signature de la mention manuscrite « Lu et approuvé, bon pour accord ».') {
  const F = d.fait || {};
  const n = +F.exemplaires || 2;
  return { type: 'signatures', el: () => h('div', { dataset: { section: 'fait' } },
    rendrePara(P`Fait à ${V(F.ville, 'ville')}, le ${D(F.date)}, en ${n === 2 ? 'deux' : String(n)} exemplaires originaux, dont un remis à chaque partie.`),
    h('div', { class: 'ct-signatures' },
      h('div', { class: 'ct-signe' }, h('b', null, gauche[0]), h('span', null, gauche[1]), gauche[2] ? h('small', null, gauche[2]) : null, h('div', { class: 'ct-signe__zone' })),
      h('div', { class: 'ct-signe' }, h('b', null, droite[0]), h('span', null, droite[1]), h('small', null, mentionDroite), h('div', { class: 'ct-signe__zone' })))) };
}
const mentionCnaps = (E) => (E.cnaps ? { type: 'mention', el: () => h('p', { class: 'ct-mention' }, `${E.nom} · Autorisation d’exercer CNAPS n° ${E.cnaps}. « L’autorisation d’exercice ne confère aucune prérogative de puissance publique à l’entreprise ou aux personnes qui en bénéficient. » (article L612-14 du Code de la sécurité intérieure)`) } : null);

// Assemble les articles : retire ceux décochés, applique les textes modifiés, numérote
// Les articles décochés restent dans la liste (type « article-masque ») pour pouvoir être remis
function finaliser(d, avant, articles, apres) {
  const tous = articles.filter(Boolean);
  d.ajouts.forEach((x, i) => tous.push(art(`ajout-${i}`, x.titre || 'Clause particulière', depuisTexte(x.texte), { ajout: true })));
  let n = 0;
  const blocs = tous.map((a) => {
    if (d.masques.includes(a.cle) && !a.obligatoire && !a.ajout) return { ...a, type: 'article-masque', el: () => h('span') };
    const paras = !a.ajout && d.textes[a.cle] != null ? depuisTexte(d.textes[a.cle]) : a.paras;
    const num = a.sansTitre ? 0 : ++n;
    const titre = (!a.ajout && d.titres?.[a.cle]) || a.titre;
    return { ...a, paras, el: () => h('section', { class: 'ct-art', dataset: { cle: a.cle } }, a.sansTitre ? null : h('h3', null, h('span', null, `Article ${num}`), titre), paras.map(rendrePara)) };
  });
  return [...avant, ...blocs, ...apres.filter(Boolean)];
}

export function construire(d) {
  if (d.genre === 'avenant') return avenant(d);
  if (d.genre === 'offre') return offre(d);
  if (d.genre === 'prestation') return prestation(d);
  if (d.genre === 'soustraitance') return sousTraitance(d);
  return contratTravail(d);
}

/* =========================================================
   CONTRAT DE TRAVAIL (CDI / CDD, temps plein / partiel)
   ========================================================= */
const MISSIONS = {
  securite: [
    'surveillance générale du site et des biens qui lui sont confiés, par la présence au poste et par des rondes de jour comme de nuit ;',
    'contrôle des accès, accueil et filtrage des personnes et des véhicules, selon les consignes du client ;',
    'prévention des actes de malveillance, des vols et des dégradations, et alerte immédiate des services de police ou de secours si nécessaire ;',
    'levée de doute, première intervention et mise en sécurité des personnes en cas d’incident ;',
    'tenue de la main courante et rédaction des rapports d’incident ;',
    'application des consignes générales et particulières de chaque site.',
  ],
  cynophile: [
    'surveillance du site et rondes accompagné de son chien, de jour comme de nuit ;',
    'dissuasion et détection des intrusions, levée de doute ;',
    'contrôle des accès selon les consignes du client ;',
    'garde, conduite et maîtrise permanente du chien pendant le service, dans le respect de la réglementation sur les chiens ;',
    'tenue de la main courante et rédaction des rapports d’incident.',
  ],
  evenementiel: [
    'accueil, filtrage et contrôle des accès du public, inspection visuelle des bagages et, avec le consentement de la personne, palpation de sécurité dans les cas prévus par la loi ;',
    'surveillance des espaces et des flux de public, prévention des incidents ;',
    'alerte des secours et des forces de l’ordre, aide à l’évacuation ;',
    'application des consignes de l’organisateur et du chef de poste.',
  ],
  video: [
    'exploitation des systèmes de vidéoprotection et de contrôle d’accès du site ;',
    'détection des situations anormales et alerte des intervenants ;',
    'tenue du registre et respect strict des règles sur la protection des images et des données personnelles.',
  ],
  chef: [
    'encadrement, organisation et contrôle des agents du ou des sites qui lui sont confiés ;',
    'transmission et application des consignes, accueil des nouveaux agents ;',
    'tenue de la main courante, rapports d’activité au client et à l’Employeur ;',
    'participation aux missions de surveillance, de contrôle des accès et d’intervention.',
  ],
  ssiap: [
    'prévention des incendies : rondes, contrôle des installations de sécurité incendie et des issues de secours ;',
    'sensibilisation des occupants à la sécurité incendie et à l’assistance à personnes ;',
    'alerte et accueil des secours, intervention précoce face aux incendies, évacuation du public ;',
    'assistance à personnes et secourisme au sein du site ;',
    'exploitation du PC de sécurité incendie et tenue du registre de sécurité.',
  ],
  protection: [
    'protection physique de la ou des personnes qui lui sont désignées, lors de leurs déplacements et de leurs séjours ;',
    'analyse préalable des lieux et des trajets, préparation des missions avec le chef de mission ;',
    'accompagnement, mise à l’abri de la personne protégée en cas de menace et alerte des forces de l’ordre ;',
    'discrétion absolue sur l’identité, l’emploi du temps et la vie privée des personnes protégées.',
  ],
  vtc: [
    'conduite des clients de l’Employeur à bord du véhicule mis à sa disposition, uniquement sur réservation préalable ;',
    'accueil des clients (gares, aéroports, hôtels, événements), prise en charge des bagages, ponctualité ;',
    'respect du Code de la route et du Code des transports, conduite souple et sûre ;',
    'soin, propreté et contrôle quotidien du véhicule (niveaux, pneus, voyants), signalement de toute anomalie ;',
    'suivi des courses dans l’application de l’Employeur et transmission des informations de service.',
  ],
  bureau: [
    'gestion administrative de l’entreprise : courriers, classement, suivi des dossiers du personnel ;',
    'préparation et suivi des plannings des agents, en lien avec la direction ;',
    'accueil téléphonique, réponse aux clients et aux candidats, suivi des devis et des factures ;',
    'mise à jour des outils de l’entreprise (espace administrateur, réseaux sociaux, site internet).',
  ],
};
function missions(d) {
  if (d.metier === 'securite') return MISSIONS[{ cynophile: 'cynophile', evenementiel: 'evenementiel', video: 'video', 'chef-poste': 'chef', 'chef-equipe': 'chef' }[d.posteCle] || 'securite'];
  return MISSIONS[d.metier] || MISSIONS.securite;
}
const convention = (d) => (d.metier === 'vtc' ? CCN.vtc : CCN.secu);

function contratTravail(d) {
  const S = d.sal, E = d.emp, Du = d.duree, T = d.tps, R = d.rem;
  const cdd = d.nature === 'CDD', partiel = d.temps === 'partiel';
  const secu = d.metier === 'securite' || d.metier === 'protection';
  const carteCnaps = secu || (d.metier === 'ssiap' && d.ssiapSurveillance);
  const mensuel = heuresMois(d);
  const titre = `Contrat de travail à durée ${cdd ? 'déterminée' : 'indéterminée'}${partiel ? ' à temps partiel' : ''}`;
  const sous = [d.poste.intitule, cdd ? `Code du travail, articles L1242-1 et suivants` : ''].filter(Boolean).join(' · ');
  const conv = convention(d);

  /* ----- Engagement ----- */
  const engagement = art('engagement', 'Engagement', [
    P`L’Employeur engage le Salarié, qui l’accepte, par contrat de travail à durée ${cdd ? 'déterminée' : 'indéterminée'}${partiel ? ' à temps partiel' : ''}${cdd ? '' : P`, à compter du ${D(Du.debut)}`}, en qualité de ${B(d.poste.intitule || '')}${d.poste.statut ? `, statut ${d.poste.statut.toLowerCase()}` : ''}${d.poste.qualif ? P`, ${V(d.poste.qualif)}` : ''}${conv ? ' de la classification de la convention collective applicable' : ''}.`,
    P`La déclaration préalable à l’embauche a été effectuée auprès de l’URSSAF d’Île-de-France, auprès de laquelle le Salarié peut exercer son droit d’accès et de rectification.`,
    carteCnaps ? P`Conformément aux articles L612-20 et suivants du Code de la sécurité intérieure, l’embauche est subordonnée à la détention par le Salarié d’une carte professionnelle en cours de validité délivrée par le CNAPS, pour l’activité « ${d.metier === 'protection' ? 'protection physique des personnes' : 'surveillance humaine ou surveillance par des systèmes électroniques de sécurité ou gardiennage'} » : carte n° ${V(S.carte, 'n° de carte')}, valable jusqu’au ${D(S.carteFin)}.` : null,
    d.metier === 'ssiap' ? P`L’embauche est subordonnée à la détention du diplôme ${B(d.posteCle.replace('ssiap', 'SSIAP '))} (${V(S.ssiapDiplome, 'n° et date du diplôme')}), à jour de son recyclage ou de sa remise à niveau, et d’une attestation de secourisme en cours de validité (SST ou PSC1)${S.secourisme ? P` jusqu’au ${D(S.secourisme)}` : ''}, conformément à l’arrêté du 2 mai 2005 relatif aux missions, à l’emploi et à la qualification du personnel permanent des services de sécurité incendie.` : null,
    d.metier === 'vtc' ? P`L’embauche est subordonnée à la détention par le Salarié d’une carte professionnelle de conducteur de VTC en cours de validité (n° ${V(S.carteVtc, 'n° de carte VTC')}, valable jusqu’au ${D(S.carteVtcFin)}) et d’un permis de conduire de catégorie B en cours de validité (n° ${V(S.permis, 'n° de permis')}, délivré le ${D(S.permisDate)}).` : null,
    S.ue === false ? P`Le Salarié déclare être titulaire d’un titre de séjour l’autorisant à travailler en France, dont l’Employeur a vérifié l’existence auprès de la préfecture avant l’embauche (article L5221-8 du Code du travail). Il s’engage à en demander le renouvellement en temps utile et à en remettre une copie à l’Employeur.` : null,
    P`Le Salarié certifie l’exactitude des informations et des documents qu’il a remis lors de son embauche (identité, diplômes, titres et cartes professionnelles). Toute déclaration inexacte pourra entraîner une sanction pouvant aller jusqu’au licenciement.`,
    P`Le Salarié bénéficiera d’une visite d’information et de prévention auprès du service de prévention et de santé au travail${d.org.sante ? P` (${V(uneLigne(d.org.sante))})` : ''}${T.nuit && d.metier !== 'bureau' ? ', avec le suivi individuel renforcé prévu pour les travailleurs de nuit lorsqu’il en a la qualité' : ''}.`,
  ], { obligatoire: true });

  /* ----- Convention collective ----- */
  const statut = art('convention', 'Convention collective', [
    conv ? P`Le présent contrat est régi par les dispositions du Code du travail et par la ${conv}, ainsi que par ses avenants et accords. Un exemplaire de la convention collective est tenu à la disposition du Salarié ; elle peut aussi être consultée sur le site Légifrance.`
      : P`Le présent contrat est régi par les dispositions du Code du travail. ${V('', 'convention collective applicable, ou « Aucune convention collective n’est applicable »')}`,
  ], { obligatoire: true });

  /* ----- Durée (CDD) ----- */
  let duree = null;
  if (cdd) {
    const motifs = {
      accroissement: P`Le présent contrat est conclu en raison d’un accroissement temporaire de l’activité de l’entreprise (article L1242-2, 2° du Code du travail), lié à : ${V(Du.motifDetail, 'précisez le surcroît d’activité')}.`,
      saisonnier: P`Le présent contrat est conclu pour un emploi à caractère saisonnier (article L1242-2, 3° du Code du travail) : ${V(Du.motifDetail, 'précisez')}.`,
      remplacement: P`Le présent contrat est conclu pour assurer le remplacement de ${V(Du.remplace, 'nom du salarié remplacé')}, ${V(Du.remplaceQualif, 'qualification')}, absent${Du.remplaceRaison ? P` pour ${V(Du.remplaceRaison)}` : ''} (article L1242-2, 1° du Code du travail).`,
      attente: P`Le présent contrat est conclu dans l’attente de l’entrée en service effective du salarié recruté par contrat à durée indéterminée pour remplacer ${V(Du.remplace, 'nom du salarié')}, ${V(Du.remplaceQualif, 'qualification')} (article L1242-2, 1° du Code du travail).`,
    };
    const precis = Du.terme === 'precis' || Du.motif === 'accroissement';
    duree = art('duree', 'Motif et durée du contrat', [
      motifs[Du.motif] || motifs.accroissement,
      precis ? P`Il est conclu pour une durée déterminée du ${D(Du.debut)} au ${D(Du.fin)} inclus. Il prendra fin de plein droit à cette date.`
        : P`Il prend effet le ${D(Du.debut)} pour une durée minimale de ${V(Du.dureeMin, 'durée minimale')}. Il prendra fin au retour de ${V(Du.remplace, 'nom du salarié remplacé')}${Du.motif === 'attente' ? ' ou à l’entrée en service du salarié recruté' : ''}, ou à la fin de l’absence si elle intervient après cette durée minimale.`,
      precis && Du.renouvelable ? P`Il pourra être renouvelé deux fois au plus, par avenant signé avant son terme, sans que sa durée totale, renouvellements compris, puisse dépasser dix-huit mois (articles L1242-8-1 et L1243-13-1 du Code du travail).` : null,
      P`À l’échéance du contrat, le Salarié percevra, sauf dans les cas prévus par la loi (notamment refus d’un contrat à durée indéterminée pour un emploi similaire, rupture anticipée à son initiative, faute grave ou force majeure${Du.motif === 'saisonnier' ? ', emploi saisonnier' : ''}), une indemnité de fin de contrat égale à 10 % de la rémunération brute totale perçue (article L1243-8 du Code du travail), ainsi qu’une indemnité compensatrice pour les congés payés non pris.`,
    ], { obligatoire: true });
  }

  /* ----- Période d'essai ----- */
  const essaiTexte = String(Du.essai || '').trim();
  let essai;
  if (/^aucune?$/i.test(essaiTexte)) essai = art('essai', 'Période d’essai', [P`Le présent contrat n’est pas soumis à une période d’essai.`]);
  else if (cdd) {
    const jours = dureeEssaiCdd(d);
    essai = art('essai', 'Période d’essai', [
      P`Le contrat comporte une période d’essai de ${V(essaiTexte || jours, 'durée')}${essaiTexte ? '' : ' (un jour par semaine de contrat, dans la limite de deux semaines pour un contrat de six mois au plus et d’un mois au-delà, article L1242-10 du Code du travail)'}. Pendant cette période, chaque partie peut rompre le contrat sans indemnité, en respectant le délai de prévenance prévu par la loi.`,
    ]);
  } else {
    const duree = essaiTexte || CCN.essai[d.poste.statut] || '';
    essai = art('essai', 'Période d’essai', [
      P`Le présent contrat ne deviendra définitif qu’à l’issue d’une période d’essai de ${V(duree, 'durée de l’essai')} de travail effectif${CCN.essaiRenouvellement ? `, ${CCN.essaiRenouvellement}` : ''}.`,
      P`Pendant la période d’essai, chaque partie peut rompre le contrat en respectant un délai de prévenance : pour l’Employeur, 24 heures en deçà de 8 jours de présence, 48 heures entre 8 jours et 1 mois, 2 semaines après 1 mois et 1 mois après 3 mois de présence ; pour le Salarié, 48 heures, ramenées à 24 heures si sa présence est inférieure à 8 jours (articles L1221-25 et L1221-26 du Code du travail).`,
    ]);
  }

  /* ----- Fonctions ----- */
  const fonctions = art('fonctions', 'Fonctions', [
    P`Le Salarié exerce les fonctions de ${B(d.poste.intitule || '')}. À ce titre, il est notamment chargé de :`,
    ...missions(d).map(L),
    P`Cette liste n’est pas limitative : le Salarié accomplira toute tâche se rattachant à sa qualification et à ses fonctions.`,
    secu || d.metier === 'ssiap' ? P`Il exerce ses missions dans le respect des consignes de l’Employeur et du client, ainsi que du code de déontologie des personnes exerçant des activités privées de sécurité (articles R631-1 et suivants du Code de la sécurité intérieure). Il ne dispose d’aucune prérogative de puissance publique (article L612-14 du Code de la sécurité intérieure) : il ne peut ni contrôler l’identité, ni fouiller, ni retenir une personne, sauf dans les cas où la loi le permet à tout citoyen (article 73 du Code de procédure pénale) ; l’inspection visuelle des bagages et la palpation de sécurité ne se font qu’avec le consentement de la personne et dans les conditions de l’article L613-2 du Code de la sécurité intérieure.` : null,
  ]);

  /* ----- Lieu de travail ----- */
  let lieu;
  if (d.metier === 'vtc') {
    lieu = art('lieu', 'Lieu de travail', [
      P`Le Salarié prend son service à ${V(d.poste.base, 'lieu de prise de service')}. Les courses ont lieu principalement dans la zone suivante : ${V(d.poste.zone, 'zone')}. Des déplacements plus lointains peuvent être demandés pour une course réservée ; les frais de repas et d’hébergement qu’ils occasionnent sont alors pris en charge par l’Employeur sur justificatifs.`,
    ]);
  } else if (d.metier === 'bureau') {
    lieu = art('lieu', 'Lieu de travail', [P`Le Salarié exerce ses fonctions à ${V(d.poste.lieu, 'adresse')}.`,
      d.clauses.mobilite ? P`Il pourra être amené à se déplacer ponctuellement sur les sites des clients situés dans la zone suivante : ${V(d.poste.zone, 'zone')}.` : null]);
  } else {
    lieu = art('lieu', 'Lieu de travail et mobilité', [
      P`L’activité de l’Employeur s’exerce par nature sur les sites de ses clients. Le Salarié est affecté ${d.poste.lieu ? P`en premier lieu sur le site suivant : ${V(d.poste.lieu)}, cette affectation étant donnée à titre indicatif` : 'sur les sites qui lui sont désignés par son planning'}.`,
      d.clauses.mobilite ? P`Le Salarié accepte d’être affecté sur tout site situé dans la zone suivante : ${V(d.poste.zone, 'zone géographique')}. Ces changements d’affectation, qui découlent de la nature même des missions de prévention et de sécurité, constituent un simple changement de ses conditions de travail. Ils lui sont notifiés en respectant un délai de prévenance raisonnable, sauf urgence.` : null,
      d.clauses.reprise && d.metier !== 'bureau' ? P`En cas de perte du marché du site sur lequel il est affecté, le contrat du Salarié pourra être transféré à l’entreprise entrante, dans les conditions prévues par l’accord relatif à la reprise du personnel annexé à la convention collective.` : null,
    ]);
  }

  /* ----- Durée du travail ----- */
  const horaires = d.metier === 'bureau' ? null
    : P`Compte tenu de la continuité de service exigée par les clients, le Salarié pourra être amené à travailler selon un planning variable${T.nuit ? ', de jour comme de nuit, les samedis, dimanches et jours fériés' : ''}, par vacations dont la durée respecte les limites prévues par la loi et par la convention collective. Le planning est communiqué au Salarié par écrit (remise en main propre, message ou Espace équipe) au moins ${V(heuresFr(T.planning), 'nombre')} jours à l’avance, sauf circonstances exceptionnelles.`;
  let temps;
  if (partiel) {
    const t24 = +T.hebdo > 0 && +T.hebdo < CCN.minimumPartiel;
    const motif24 = { personnel: 'pour faire face à des contraintes personnelles', cumul: 'pour lui permettre de cumuler plusieurs activités', etudiant: 'en raison de la poursuite de ses études' }[T.motif24] || 'pour des raisons personnelles';
    temps = art('temps', 'Durée et répartition du travail à temps partiel', [
      P`La durée de travail du Salarié est fixée à ${V(heuresFr(T.hebdo), 'nombre')} heures par semaine, soit ${V(heuresFr(mensuel), 'nombre')} heures par mois.`,
      P`Ces heures sont réparties de la manière suivante : ${V(uneLigne(T.repartition), 'jours et horaires de travail')}.`,
      P`Cette répartition peut être modifiée dans les cas suivants : ${V(uneLigne(T.cas), 'cas de modification')} Toute modification est notifiée au Salarié par écrit au moins ${V(heuresFr(T.prevenance), 'nombre')} jours ouvrés avant la date à laquelle elle doit avoir lieu (article L3123-31 du Code du travail).`,
      P`Les horaires de chaque journée travaillée sont communiqués par écrit au Salarié, chaque mois, au moyen du planning remis au moins ${V(heuresFr(T.planning), 'nombre')} jours à l’avance${d.clauses.pointage ? ' et consultable dans son Espace équipe' : ''}.`,
      P`Le Salarié pourra effectuer des heures complémentaires à la demande de l’Employeur, dans la limite ${T.complementaires === '33' ? 'du tiers' : 'du dixième'} de la durée prévue au contrat, sans que sa durée de travail puisse atteindre la durée légale de 35 heures par semaine. Chaque heure complémentaire est majorée de 10 % dans la limite du dixième de la durée contractuelle, et de 25 % au-delà (articles L3123-8, L3123-28 et L3123-29 du Code du travail). Le refus d’effectuer des heures complémentaires au-delà de ces limites, ou notifiées moins de 3 jours à l’avance, ne constitue pas une faute.`,
      t24 ? P`La durée de travail est inférieure à ${CCN.minimumPartiel} heures par semaine à la demande écrite et motivée du Salarié en date du ${D(T.demande24)}, ${motif24} (article L3123-7 du Code du travail). Ses horaires sont regroupés sur des journées ou des demi-journées régulières ou complètes.` : null,
      P`Le Salarié à temps partiel bénéficie des mêmes droits que les salariés à temps complet (article L3123-5 du Code du travail) et d’une priorité pour l’attribution d’un emploi à temps complet ressortissant à sa catégorie professionnelle (article L3123-3).`,
      T.nuit && d.metier !== 'bureau' ? P`Le Salarié pourra être amené à travailler de nuit, les samedis, dimanches et jours fériés, dans le respect de la répartition ci-dessus.` : null,
    ], { obligatoire: true });
  } else {
    temps = art('temps', 'Durée du travail', [
      P`La durée du travail du Salarié est fixée à 35 heures par semaine, soit 151,67 heures par mois.`,
      horaires,
      d.metier === 'bureau' ? P`Ses horaires de travail sont ceux affichés dans l’entreprise : ${V('', 'ex. du lundi au vendredi, de 9 h à 17 h, avec une heure de pause')}.` : null,
      P`Le Salarié pourra être amené à effectuer des heures supplémentaires à la demande de l’Employeur. Elles sont rémunérées avec une majoration de 25 % pour les huit premières heures au-delà de 35 heures et de 50 % au-delà (article L3121-36 du Code du travail), dans les limites légales et conventionnelles.`,
      P`Le Salarié bénéficie d’un repos quotidien d’au moins 11 heures consécutives et d’un repos hebdomadaire d’au moins 35 heures consécutives, sauf dérogations prévues par la loi et la convention collective.`,
    ], { obligatoire: true });
  }

  /* ----- Rémunération ----- */
  const brut = +R.taux > 0 && mensuel ? Math.round(+R.taux * mensuel * 100) / 100 : 0;
  const primes = lignes(R.primes);
  const remuneration = art('remuneration', 'Rémunération', [
    P`En contrepartie de son travail, le Salarié percevra une rémunération mensuelle brute de ${V(brut ? `${nombreFr(brut)} €` : '', 'montant')} pour ${V(heuresFr(mensuel), 'nombre')} heures de travail, soit un taux horaire brut de ${V(+R.taux > 0 ? `${nombreFr(R.taux)} €` : '', 'taux horaire')}.`,
    d.metier !== 'bureau' && d.metier !== 'vtc' ? P`S’y ajoutent, dans les conditions et aux taux prévus par la convention collective, les majorations pour heures de nuit, de dimanche et de jours fériés, la prime de panier, la prime d’habillage et de déshabillage lorsque le port de la tenue est imposé, et la prime d’ancienneté.` : null,
    d.metier === 'vtc' ? P`S’y ajoutent, le cas échéant, les majorations pour heures de nuit, de dimanche et de jours fériés et les indemnités de repas prévues par la loi et par la convention collective applicable.` : null,
    ...primes.map((p) => P`${p}`),
    P`La rémunération est versée chaque mois par virement bancaire${R.jour ? P`, au plus tard le ${V(R.jour)}` : ''}, et accompagnée d’un bulletin de paie.`,
    R.navigo ? P`L’Employeur prend en charge 50 % du prix de l’abonnement de transports publics du Salarié pour ses trajets entre son domicile et son lieu de travail, sur présentation des justificatifs (article L3261-2 du Code du travail).` : null,
  ], { obligatoire: true });

  /* ----- Congés ----- */
  const conges = art('conges', 'Congés payés', [
    P`Le Salarié a droit à des congés payés de deux jours et demi ouvrables par mois de travail effectif, soit trente jours ouvrables pour une année complète (article L3141-3 du Code du travail). Les dates de congés sont fixées par l’Employeur, après demande du Salarié, en tenant compte des nécessités du service${d.clauses.pointage ? ' ; les demandes se font depuis l’Espace équipe' : ''}.`,
  ]);

  /* ----- Tenue, carte, obligations du métier ----- */
  let tenue = null, metier = null, vehicule = null, chien = null;
  if (secu || d.metier === 'ssiap') {
    tenue = art('tenue', 'Tenue et équipements', [
      P`L’Employeur fournit gratuitement au Salarié la tenue de travail et les équipements nécessaires à ses missions. Leur port est obligatoire pendant le service. Ils restent la propriété de l’Employeur et devront être restitués en bon état à la fin du contrat.`,
      d.metier !== 'ssiap' || d.ssiapSurveillance ? P`Pendant son service, le Salarié porte une tenue qui ne prête à aucune confusion avec celle des forces de l’ordre, avec les insignes et mentions prévus par la réglementation, et a sur lui sa carte professionnelle, qu’il présente à toute demande des autorités.` : null,
      P`Le Salarié n’est pas armé. Il ne peut détenir ni porter aucune arme pendant son service, sauf autorisation prévue par la loi et équipement remis par l’Employeur.`,
    ]);
    metier = art('obligations', 'Obligations professionnelles', [
      P`Le Salarié s’engage notamment à :`,
      carteCnaps ? L('conserver une carte professionnelle valide pendant toute la durée du contrat, en demander le renouvellement au plus tard trois mois avant son expiration et suivre à cette fin le stage de maintien et d’actualisation des compétences (MAC) ;') : null,
      d.metier === 'ssiap' ? L('maintenir la validité de son diplôme SSIAP (recyclage tous les trois ans) et de son attestation de secourisme ;') : null,
      carteCnaps ? L('informer sans délai l’Employeur de toute suspension, de tout retrait de sa carte professionnelle, et de toute procédure ou condamnation susceptible de l’entraîner ;') : null,
      L('respecter les consignes de chaque site, ne jamais quitter son poste sans avoir été relevé, et rendre compte de tout incident ;'),
      L('ne consommer ni alcool ni stupéfiant avant ou pendant le service, et limiter l’usage de son téléphone personnel aux nécessités du service ;'),
      L('se présenter à l’heure, en tenue, et prévenir l’Employeur au plus tôt de toute absence ou de tout retard.'),
      carteCnaps ? P`Le Salarié est informé que l’exercice de ses fonctions est impossible sans carte professionnelle valide. Conformément à l’article L612-20 du Code de la sécurité intérieure, le contrat du salarié qui cesse de remplir les conditions exigées pour exercer, notamment en cas de retrait de sa carte professionnelle, est rompu de plein droit.` : null,
    ].filter(Boolean));
  } else if (d.metier === 'vtc') {
    metier = art('obligations', 'Obligations professionnelles', [
      P`Le Salarié s’engage notamment à :`,
      L('conserver une carte professionnelle VTC et un permis de conduire valides pendant toute la durée du contrat, suivre la formation continue obligatoire et passer la visite médicale demandée par la préfecture en temps utile ;'),
      L('informer sans délai l’Employeur de toute suspension ou annulation de son permis, de toute perte de points importante, et de tout retrait de sa carte professionnelle ;'),
      L('ne prendre en charge que des clients ayant réservé à l’avance, ne pas stationner sur la voie publique en attente de clients et, après chaque course, revenir au lieu de prise de service ou dans un parc de stationnement hors de la voie publique, sauf nouvelle réservation (articles L3120-2 et L3122-9 du Code des transports) ;'),
      L('ne consommer ni alcool ni stupéfiant avant ou pendant le service, ne pas fumer ni téléphoner en conduisant ;'),
      L('adopter une tenue correcte et un comportement courtois et discret avec les clients.'),
      P`Les contraventions au Code de la route commises par le Salarié pendant la conduite restent à sa charge : l’Employeur est tenu de communiquer son identité aux autorités (article L121-6 du Code de la route). Aucune amende ni sanction pécuniaire ne sera retenue sur son salaire (article L1331-2 du Code du travail).`,
      P`L’exercice des fonctions est impossible sans carte professionnelle et permis valides ; leur perte pourra entraîner la rupture du contrat dans les conditions prévues par la loi.`,
    ]);
    if (d.clauses.vehicule) {
      const Vh = d.vehicule;
      vehicule = art('vehicule', 'Véhicule', [
        P`L’Employeur met à la disposition du Salarié, pour l’exercice de ses fonctions, le véhicule ${V(Vh.modele, 'marque et modèle')} immatriculé ${V(Vh.immat, 'immatriculation')}, ou tout autre véhicule de même catégorie. L’Employeur en assure l’assurance, l’entretien, le carburant et les frais de péage liés aux courses.`,
        Vh.personnel ? P`Le Salarié est autorisé à utiliser le véhicule pour ses trajets personnels en dehors du service ; cet usage constitue un avantage en nature qui figure sur son bulletin de paie.`
          : P`Le véhicule est réservé à un usage professionnel : il ne peut être utilisé à des fins personnelles ni transporter d’autres personnes que les clients. Il est restitué à la fin de chaque service au lieu indiqué par l’Employeur.`,
        P`Le Salarié en prend soin, le maintient propre, signale toute anomalie et déclare tout accident ou incident à l’Employeur dans les 24 heures, avec un constat amiable lorsqu’un tiers est en cause. Il est interdit de fumer dans le véhicule.`,
      ]);
    }
  } else if (d.metier === 'bureau') {
    metier = art('obligations', 'Obligations professionnelles', [
      P`Le Salarié s’engage à exécuter ses fonctions avec soin, à respecter les consignes de l’Employeur et à prévenir au plus tôt de toute absence. Il a accès, pour ses fonctions, à des données personnelles des salariés, des candidats et des clients : il ne les utilise que pour les besoins du service et ne les communique à personne.`,
    ]);
  }
  if (d.metier === 'securite' && d.clauses.chien) {
    const C = d.chien;
    chien = art('chien', 'Chien', [
      P`Le Salarié exerce ses missions avec le chien ${V(C.nom, 'nom du chien')}, de race ${V(C.race, 'race')}, identifié sous le n° ${V(C.puce, 'n° d’identification')}, ${C.proprietaire === 'employeur' ? 'appartenant à l’Employeur et confié au Salarié pour la durée du contrat' : 'dont le Salarié est propriétaire'}.`,
      P`Le chien doit être identifié, vacciné (notamment contre la rage), en bonne santé, dressé à la garde et assuré en responsabilité civile${C.proprietaire === 'employeur' ? ' par l’Employeur' : ' par son propriétaire'}. Le Salarié en garde la maîtrise permanente pendant le service, dans le respect de la réglementation sur les chiens.`,
      C.proprietaire === 'employeur' ? P`Les frais de nourriture et de soins vétérinaires sont pris en charge par l’Employeur.` : P`L’entretien du chien utilisé pour le service donne lieu au versement de l’indemnité prévue par la convention collective.`,
    ]);
  }

  /* ----- Protection sociale ----- */
  const O = d.org;
  const sociale = art('sociale', 'Retraite, prévoyance et frais de santé', [
    P`Le Salarié est affilié au régime général de la Sécurité sociale. Il bénéficie du régime de retraite complémentaire auprès de ${V(uneLigne(O.retraite), 'nom et adresse de la caisse de retraite complémentaire')} et du régime de prévoyance auprès de ${V(uneLigne(O.prevoyance), 'nom et adresse de l’organisme de prévoyance')}.`,
    P`Il adhère au régime collectif obligatoire de remboursement des frais de santé${O.mutuelle ? P` (${V(uneLigne(O.mutuelle))})` : ''}, sauf s’il remplit l’un des cas de dispense prévus par la loi et en fait la demande écrite.`,
  ], { obligatoire: cdd });

  /* ----- Formation ----- */
  const formation = d.clauses.formation ? art('formation', 'Formation', [
    P`L’Employeur assure l’adaptation du Salarié à son poste. Les formations obligatoires au maintien des titres nécessaires à l’emploi (${{ securite: 'maintien et actualisation des compétences, secourisme', protection: 'maintien et actualisation des compétences, secourisme', ssiap: 'recyclage SSIAP, secourisme', vtc: 'formation continue des conducteurs VTC', bureau: 'formations utiles au poste' }[d.metier] || 'formations utiles au poste'}) suivies à la demande de l’Employeur sont prises en charge par lui et constituent du temps de travail effectif.`,
  ]) : null;

  /* ----- Confidentialité, loyauté ----- */
  const confid = d.clauses.confidentialite ? art('confidentialite', 'Confidentialité et loyauté', [
    P`Le Salarié est tenu à une obligation de discrétion absolue sur tout ce dont il a connaissance dans ses fonctions : identité et habitudes des clients${d.metier === 'protection' ? ' et des personnes protégées' : ''}, consignes, plans, codes d’accès, clés, dispositifs de sécurité, trajets et informations sur l’entreprise. Cette obligation demeure après la fin du contrat.`,
    P`Pendant toute la durée du contrat, il s’interdit de travailler directement ou indirectement pour un client de l’Employeur. S’il exerce une autre activité salariée, il en informe l’Employeur afin de garantir le respect des durées maximales de travail et des temps de repos.`,
  ]) : null;

  /* ----- Pointage, Espace équipe, données personnelles ----- */
  const donnees = art('donnees', 'Pointage et données personnelles', [
    d.clauses.pointage ? P`Le Salarié dispose d’un Espace équipe (planning, bulletins de paie, documents, demandes de congés). Il enregistre le début et la fin de chacun de ses services à l’aide du lien de pointage personnel qui lui est remis : sa position n’est relevée qu’au moment où il pointe, dans le seul but de justifier sa présence sur le site ; elle n’est jamais suivie en continu.` : null,
    P`Les informations personnelles du Salarié sont traitées par l’Employeur pour la gestion du personnel (embauche, paie, planning, obligations légales et déclarations au CNAPS et aux organismes sociaux), et conservées pendant les durées prévues par la loi. Le Salarié peut y accéder, les faire rectifier ou demander des informations en écrivant à ${V(E.email, 'adresse email')}.`,
  ]);

  /* ----- Non-concurrence (en option) ----- */
  const nc = d.clauses.nonConcurrence ? art('nonConcurrence', 'Non-concurrence', [
    P`Après la rupture du contrat, quelle qu’en soit la cause, le Salarié s’interdit pendant ${V(d.clauses.ncDuree, 'durée')} d’exercer une activité concurrente de celle de l’Employeur, pour son compte ou pour le compte d’un tiers, auprès des clients qu’il a connus dans ses fonctions, dans la zone suivante : ${V(d.clauses.ncZone, 'zone')}.`,
    P`En contrepartie, l’Employeur lui versera chaque mois, pendant toute la durée de l’interdiction, une indemnité égale à ${V(heuresFr(d.clauses.ncContrepartie), '%')} % de sa rémunération mensuelle brute moyenne des douze derniers mois. L’Employeur peut renoncer à cette clause par écrit au plus tard dans les 15 jours suivant la notification de la rupture, ou au plus tard le jour du départ effectif en cas de dispense de préavis.`,
  ]) : null;

  /* ----- Fin du contrat ----- */
  const fin = art('fin', 'Fin du contrat', [
    cdd ? P`Le contrat ne peut être rompu avant son terme qu’en cas d’accord des parties, de faute grave, de force majeure, d’inaptitude constatée par le médecin du travail, ou à l’initiative du Salarié qui justifie d’une embauche en contrat à durée indéterminée ; il respecte alors un préavis d’un jour par semaine de contrat, dans la limite de deux semaines (articles L1243-1 et L1243-2 du Code du travail).`
      : P`Après la période d’essai, le contrat peut être rompu par chacune des parties dans les conditions prévues par la loi et par la convention collective${CCN.preavis ? `, notamment en respectant ${CCN.preavis}` : ', notamment en respectant le préavis qu’elle prévoit (sauf faute grave ou dispense)'}.`,
    P`À la fin du contrat, le Salarié restitue sans délai tout ce qui lui a été confié : tenue, badges, clés, cartes d’accès, téléphone, documents${d.metier === 'vtc' ? ', véhicule et carte carburant' : ''}.`,
  ], { obligatoire: cdd });

  const avant = [...enTete(d, titre, sous), parties(phraseEmployeur(E), phraseSalarie(d))];
  const articles = [engagement, statut, duree, essai, fonctions, lieu, temps, remuneration, conges, tenue, metier, vehicule, chien, sociale, formation, confid, donnees, nc, fin];
  const apres = [signatures(d, ['L’Employeur', `${E.representant || ''}${E.qualite ? `, ${E.qualite.toLowerCase()}` : ''}`, 'Signature et cachet'], ['Le Salarié', nomComplet(S) || ' ']), d.metier === 'vtc' ? null : mentionCnaps(E)];
  return finaliser(d, avant, articles, apres);
}
function dureeEssaiCdd(d) {
  const a = d.duree.debut && /^\d{4}-\d{2}-\d{2}$/.test(d.duree.debut) ? new Date(`${d.duree.debut}T12:00:00`) : null;
  const b = d.duree.fin && /^\d{4}-\d{2}-\d{2}$/.test(d.duree.fin) ? new Date(`${d.duree.fin}T12:00:00`) : null;
  if (!a || !b || b < a) return '';
  const jours = Math.round((b - a) / 86400000) + 1;
  if (jours > 183) return '1 mois';
  const n = Math.min(14, Math.floor(jours / 7));
  return n >= 1 ? `${n} jour${n > 1 ? 's' : ''}` : '';
}

/* =========================================================
   AVENANT AU CONTRAT DE TRAVAIL
   ========================================================= */
function avenant(d) {
  const S = d.sal, E = d.emp, A = d.av;
  const objets = A.objets || [];
  const intitules = { duree: 'la durée et la répartition du travail', remuneration: 'la rémunération', poste: 'le poste et la classification', lieu: 'le lieu de travail', complement: 'une augmentation temporaire de la durée du travail', renouvellement: 'le renouvellement du contrat à durée déterminée', autre: 'les conditions précisées ci-dessous' };
  const articles = [
    art('objet', 'Objet de l’avenant', [
      P`Le Salarié est employé par l’Employeur en vertu d’un contrat de travail ${V(A.contratNature)} conclu le ${D(A.contratDate)}${d.poste.intitule ? P`, en qualité de ${V(d.poste.intitule)}` : ''}.`,
      P`Les parties conviennent de modifier ce contrat en ce qui concerne ${objets.length ? objets.map((o) => intitules[o]).join(', ') : V('', 'objet de la modification')}, dans les conditions suivantes.`,
    ], { obligatoire: true }),
    objets.includes('duree') ? art('av-duree', 'Durée et répartition du travail', [
      P`À compter du ${D(A.effet)}, la durée de travail du Salarié est fixée à ${V(heuresFr(A.hebdo), 'nombre')} heures par semaine${+A.hebdo > 0 && +A.hebdo < 35 ? `, soit ${heuresFr(Math.round(+A.hebdo * 52 / 12 * 100) / 100)} heures par mois` : ''}.`,
      A.repartition ? P`Ces heures sont réparties de la manière suivante : ${V(uneLigne(A.repartition))}.` : null,
      +A.hebdo > 0 && +A.hebdo < 35 ? P`Les autres règles du temps partiel prévues au contrat (modification de la répartition, heures complémentaires, communication des horaires) restent applicables.` : null,
    ]) : null,
    objets.includes('remuneration') ? art('av-remuneration', 'Rémunération', [
      P`À compter du ${D(A.effet)}, le taux horaire brut du Salarié est porté à ${V(+A.taux > 0 ? `${nombreFr(A.taux)} €` : '', 'taux horaire')}.`,
    ]) : null,
    objets.includes('poste') ? art('av-poste', 'Poste et classification', [
      P`À compter du ${D(A.effet)}, le Salarié exerce les fonctions de ${V(A.intitule, 'nouveau poste')}, ${V(A.qualif, 'classification')} de la convention collective applicable.`,
    ]) : null,
    objets.includes('lieu') ? art('av-lieu', 'Lieu de travail', [
      P`À compter du ${D(A.effet)}, le Salarié est affecté à ${V(A.lieu, 'nouveau lieu')}${A.zone ? P` ; la zone de mobilité prévue au contrat devient : ${V(A.zone)}` : ''}.`,
    ]) : null,
    objets.includes('complement') ? art('av-complement', 'Augmentation temporaire de la durée du travail', [
      P`Du ${D(A.complDebut)} au ${D(A.complFin)}, la durée de travail du Salarié est augmentée de ${V(heuresFr(A.complHeures), 'nombre')} heures par semaine, pour le motif suivant : ${V(A.complMotif, 'motif')}.`,
      P`Ces heures sont rémunérées dans les conditions prévues par l’accord de branche applicable (article L3123-22 du Code du travail). À l’issue de cette période, la durée de travail prévue au contrat s’applique de nouveau.`,
    ]) : null,
    objets.includes('renouvellement') ? art('av-renouvellement', 'Renouvellement du contrat', [
      P`Le contrat à durée déterminée, dont le terme était fixé initialement, est renouvelé jusqu’au ${D(A.nouvelleFin)} inclus, pour le même motif. Il prendra fin de plein droit à cette date.`,
      P`Les parties rappellent que le contrat ne peut être renouvelé que deux fois et que sa durée totale, renouvellements compris, ne peut dépasser dix-huit mois.`,
    ]) : null,
    objets.includes('autre') ? art('av-autre', 'Autre modification', depuisTexte(A.autre).length ? depuisTexte(A.autre) : [P`${V('', 'modification')}`]) : null,
    art('av-effet', 'Date d’effet et autres clauses', [
      P`Le présent avenant prend effet le ${D(A.effet)}. Toutes les autres clauses du contrat de travail demeurent inchangées.`,
    ], { obligatoire: true }),
  ];
  const avant = [...enTete(d, `Avenant n° ${A.numero || '…'} au contrat de travail`, A.contratDate ? `Contrat ${A.contratNature} du ${isoVersFr(A.contratDate)}` : ''), parties(phraseEmployeur(E), P`${B(`${g(d).civ} ${nomComplet(S)}`)}, demeurant ${V(uneLigne(S.adresse), 'adresse')}, ci-après « le Salarié »,`)];
  const apres = [signatures(d, ['L’Employeur', `${E.representant || ''}${E.qualite ? `, ${E.qualite.toLowerCase()}` : ''}`, 'Signature et cachet'], ['Le Salarié', nomComplet(S) || ' ']), mentionCnaps(E)];
  return finaliser(d, avant, articles, apres);
}

/* =========================================================
   PROMESSE D'EMBAUCHE (offre de contrat de travail)
   ========================================================= */
function offre(d) {
  const S = d.sal, E = d.emp, Du = d.duree, T = d.tps, R = d.rem, O = d.of;
  const G = g(d);
  const cdd = d.nature === 'CDD';
  const mensuel = heuresMois(d);
  const brut = +R.taux > 0 && mensuel ? Math.round(+R.taux * mensuel * 100) / 100 : 0;
  const essai = String(Du.essai || '').trim() || (cdd ? dureeEssaiCdd(d) : CCN.essai[d.poste.statut] || '');
  const motif = { accroissement: 'accroissement temporaire d’activité', saisonnier: 'emploi saisonnier', remplacement: 'remplacement d’un salarié absent', attente: 'attente de l’arrivée d’un salarié en CDI' }[Du.motif];
  const blocs = [
    ...enTete(d, 'Promesse d’embauche', 'Offre de contrat de travail'),
    { type: 'dest', el: () => h('div', { class: 'ct-lettre-dest' }, rendrePara(P`${B(`${G.civ} ${nomComplet(S)}`)}`), lignes(S.adresse).map((l) => h('p', { class: 'ct-p' }, l)),
      rendrePara(P`${V(d.fait.ville, 'ville')}, le ${D(d.fait.date)}`)) },
    { type: 'objet', el: () => h('p', { class: 'ct-objet' }, 'Objet : proposition d’embauche') },
  ];
  const corps = art('offre', 'Notre proposition', [
    P`${G.civ},`,
    P`Suite à notre entretien${O.entretien ? P` du ${D(O.entretien)}` : ''}, nous avons le plaisir de vous proposer de rejoindre ${B(E.nom || '')} aux conditions suivantes :`,
    P`– poste : ${V(d.poste.intitule, 'poste')}${d.poste.qualif ? P`, ${V(d.poste.qualif)}` : ''} ;`,
    P`– contrat : ${cdd ? `à durée déterminée (${motif})` : 'à durée indéterminée'}${d.temps === 'partiel' ? ' à temps partiel' : ''} ;`,
    P`– date d’entrée : ${D(Du.debut)}${cdd ? P` ; fin prévue le ${D(Du.fin)}` : ''} ;`,
    P`– lieu de travail : ${V(d.metier === 'vtc' ? d.poste.base : d.poste.lieu || 'sites des clients en Île-de-France', 'lieu')} ;`,
    P`– durée du travail : ${V(d.temps === 'partiel' ? (+T.hebdo > 0 ? `${heuresFr(T.hebdo)} heures par semaine${T.repartition ? ` (${uneLigne(T.repartition)})` : ''}` : '') : '35 heures par semaine', 'durée')}${T.nuit && d.metier !== 'bureau' ? ', selon planning, de jour comme de nuit, week-ends et jours fériés compris' : ''} ;`,
    P`– rémunération : ${V(brut ? `${nombreFr(brut)} € brut par mois (${nombreFr(R.taux)} € brut de l’heure)` : '', 'salaire')}${d.metier === 'securite' || d.metier === 'ssiap' || d.metier === 'protection' ? ', plus les primes et majorations prévues par la convention collective' : ''} ;`,
    P`– période d’essai : ${V(essai, 'durée')} ;`,
    convention(d) ? P`– convention collective : ${convention(d)}.` : null,
    O.conditions ? P`Cette proposition est faite sous réserve des conditions suivantes : ${V(uneLigne(O.conditions))}.` : null,
    P`Cette offre est valable jusqu’au ${D(O.validite)}. Si vous l’acceptez, merci de nous retourner un exemplaire de ce courrier daté et signé, précédé de la mention « Bon pour accord ». Passé ce délai, elle sera considérée comme caduque. Votre acceptation vaudra conclusion du contrat de travail, qui sera formalisé par écrit au plus tard à votre arrivée.`,
    P`Nous vous prions d’agréer, ${G.civ}, l’expression de nos salutations distinguées.`,
  ].filter(Boolean), { sansTitre: true, obligatoire: true });
  const signer = { type: 'signatures', el: () => h('div', { class: 'ct-signatures' },
    h('div', { class: 'ct-signe' }, h('b', null, E.nom || 'L’Employeur'), h('span', null, `${E.representant || ''}${E.qualite ? `, ${E.qualite.toLowerCase()}` : ''}`), h('div', { class: 'ct-signe__zone' })),
    h('div', { class: 'ct-signe' }, h('b', null, 'Le candidat'), h('span', null, nomComplet(S) || ' '), h('small', null, 'Date et mention « Bon pour accord »'), h('div', { class: 'ct-signe__zone' }))) };
  return finaliser(d, blocs, [corps], [signer, mentionCnaps(E)]);
}

/* =========================================================
   CONTRAT CLIENT (prestation de sécurité)
   ========================================================= */
const ACTIVITES = {
  surveillance: 'surveillance humaine et gardiennage',
  ssiap: 'service de sécurité incendie et d’assistance à personnes (SSIAP)',
  evenementiel: 'sécurité et accueil d’un événement (filtrage, contrôle des accès, surveillance)',
  cynophile: 'surveillance cynophile (agent accompagné d’un chien)',
};
function prestation(d) {
  const E = d.emp, C = d.cli, Pr = d.pr;
  const client = P`${B(C.nom || '')}${C.forme ? P`, ${V(C.forme)}` : ''}${C.siret ? P`, SIRET ${V(C.siret)}` : ''}, dont le siège est situé ${V(uneLigne(C.adresse), 'adresse')}, représenté par ${V(C.representant, 'nom')}${C.qualite ? P`, en qualité de ${V(C.qualite)}` : ''}, ci-après « le Client »,`;
  const tarifs = lignes(Pr.tarifs);
  const articles = [
    art('p-objet', 'Objet', [
      P`Le Client confie au Prestataire, qui l’accepte, une mission de ${B(ACTIVITES[Pr.activite] || ACTIVITES.surveillance)} sur le site suivant : ${V(uneLigne(Pr.site), 'adresse du site')}.`,
      P`Le Prestataire exerce cette mission en vertu de l’autorisation d’exercer n° ${V(E.cnaps, 'n° d’autorisation CNAPS')} délivrée par le CNAPS. L’autorisation d’exercice ne confère aucune prérogative de puissance publique à l’entreprise ou aux personnes qui en bénéficient (article L612-14 du Code de la sécurité intérieure).`,
    ], { obligatoire: true }),
    art('p-duree', 'Durée', [
      Pr.type === 'determinee' ? P`Le contrat prend effet le ${D(Pr.debut)} et prend fin le ${D(Pr.fin)}.`
        : P`Le contrat prend effet le ${D(Pr.debut)} pour une durée indéterminée. Chaque partie peut y mettre fin à tout moment par lettre recommandée avec accusé de réception, en respectant un préavis de ${V(Pr.preavis, 'durée')}.`,
    ], { obligatoire: true }),
    art('p-moyens', 'Moyens mis en place', [
      P`Le Prestataire affecte au site ${V(Pr.agents, 'nombre')} agent(s) aux horaires suivants : ${V(uneLigne(Pr.horaires), 'jours et horaires')}. Toute modification durable de ces horaires fait l’objet d’un accord écrit, par simple email.`,
      P`Les agents sont salariés du Prestataire, qui reste seul juge de leur affectation, les encadre et exerce seul l’autorité hiérarchique et le pouvoir disciplinaire à leur égard. Ils sont titulaires d’une carte professionnelle en cours de validité${Pr.activite === 'ssiap' ? ' ou du diplôme SSIAP requis' : ''}, portent une tenue distinctive et sont remplacés en cas d’absence.`,
    ]),
    art('p-consignes', 'Consignes', [
      Pr.consignes ? P`Les consignes particulières du site (missions, rondes, accès, numéros d’urgence, conduite à tenir) sont définies avec le Client et annexées au présent contrat. Elles ne peuvent conduire les agents à exercer des missions sortant du cadre légal des activités privées de sécurité.` : P`Les consignes du site sont définies d’un commun accord avant le début de la mission.`,
      P`Les agents tiennent une main courante et le Prestataire informe le Client de tout incident significatif.`,
    ]),
    art('p-client', 'Obligations du Client', [
      P`Le Client donne aux agents l’accès aux lieux, un local ou un poste adapté, les moyens de communication nécessaires et toutes les informations utiles sur les risques du site. Lorsque la réglementation l’exige, un plan de prévention est établi avec le Prestataire avant le début de la mission. Le Client ne donne pas directement d’ordres aux agents en dehors des consignes convenues.`,
    ]),
    art('p-prix', 'Prix', [
      P`Les prestations sont facturées aux tarifs suivants :`,
      ...(tarifs.length ? tarifs.map((t) => L(t)) : [P`– ${V('', 'tarif')}`]),
      Pr.majorations ? P`${V(uneLigne(Pr.majorations))}` : null,
      P`${V(uneLigne(Pr.tva), 'TVA')}`,
      Pr.revision ? P`Les tarifs peuvent être révisés au 1er janvier de chaque année et lors de toute revalorisation des salaires minima de la convention collective, après information écrite du Client un mois à l’avance.` : null,
    ], { obligatoire: true }),
    art('p-paiement', 'Facturation et paiement', [
      P`Les heures réalisées sont facturées à la fin de chaque mois, sur la base du planning et de la main courante. Les factures sont payables à ${V(heuresFr(Pr.paiement), 'nombre')} jours à compter de leur date d’émission, par virement.`,
      P`Tout retard de paiement entraîne de plein droit des pénalités égales à trois fois le taux d’intérêt légal et une indemnité forfaitaire de 40 € pour frais de recouvrement (article L441-10 du Code de commerce). En cas de retard de plus de 30 jours, le Prestataire peut suspendre ses prestations après mise en demeure restée sans effet pendant 8 jours.`,
    ]),
    art('p-vigilance', 'Documents à fournir', [
      P`Le Prestataire remet au Client, à la signature puis tous les six mois jusqu’à la fin du contrat, une attestation de vigilance de l’URSSAF et un extrait d’immatriculation (articles L8222-1 et D8222-5 du Code du travail), ainsi que la liste nominative de ses salariés étrangers soumis à autorisation de travail affectés au site lorsque la loi l’exige. Il justifie de son autorisation d’exercer et de son assurance sur simple demande.`,
    ]),
    art('p-assurance', 'Assurance et responsabilité', [
      P`Le Prestataire est assuré en responsabilité civile professionnelle${Pr.assurance ? P` auprès de ${V(Pr.assurance)}` : P` (${V('', 'assureur et n° de contrat')})`}. Il est tenu d’une obligation de moyens : il s’engage à mettre en œuvre tous les moyens prévus au contrat pour prévenir les risques, sans pouvoir garantir l’absence de tout vol, dégradation ou sinistre.`,
    ]),
    art('p-confidentialite', 'Confidentialité', [
      P`Chaque partie garde confidentielles les informations dont elle a connaissance pour l’exécution du contrat, notamment les consignes, codes d’accès, plans et dispositifs de sécurité du site.`,
    ]),
    Pr.nonSollicitation ? art('p-sollicitation', 'Non-sollicitation du personnel', [
      P`Pendant la durée du contrat et douze mois après sa fin, le Client s’interdit d’employer directement ou de faire travailler par une autre entreprise un agent du Prestataire affecté à son site, sauf accord écrit du Prestataire ou application de l’accord de branche relatif à la reprise du personnel. En cas de manquement, il versera une indemnité égale à six mois du salaire brut de l’agent concerné.`,
    ]) : null,
    art('p-soustraitance', 'Sous-traitance', [
      P`Le Prestataire ne peut sous-traiter tout ou partie de la mission qu’après accord écrit du Client, à une entreprise elle-même autorisée par le CNAPS, et dans les limites prévues par le Code de la sécurité intérieure.`,
    ]),
    art('p-resiliation', 'Résiliation', [
      P`En cas de manquement grave de l’une des parties à ses obligations, l’autre partie peut résilier le contrat de plein droit, par lettre recommandée avec accusé de réception, 15 jours après une mise en demeure restée sans effet.`,
    ]),
    art('p-litiges', 'Litiges', [
      P`Le contrat est soumis au droit français. Les parties chercheront une solution amiable à tout différend ; à défaut, il sera porté devant les juridictions compétentes de Paris.`,
    ]),
  ];
  const avant = [...enTete(d, 'Contrat de prestation de services de sécurité', ACTIVITES[Pr.activite] || ''), parties(phraseEmployeur(E, 'le Prestataire'), client)];
  const apres = [signatures(d, ['Le Prestataire', `${E.nom || ''} · ${E.representant || ''}`, 'Signature et cachet'], ['Le Client', `${C.nom || ''}${C.representant ? ` · ${C.representant}` : ''}`], 'Signature, cachet et mention « Bon pour accord ».'), mentionCnaps(E)];
  return finaliser(d, avant, articles, apres);
}

/* =========================================================
   SOUS-TRAITANCE entre sociétés de sécurité
   ========================================================= */
function sousTraitance(d) {
  const E = d.emp, St = d.st;
  const bdaSousTraitant = St.role !== 'donneur';
  const autre = P`La société ${B(St.nom || '')}${St.forme ? P`, ${V(St.forme)}` : ''}, SIRET ${V(St.siret, 'SIRET')}, dont le siège est situé ${V(uneLigne(St.adresse), 'adresse')}, titulaire de l’autorisation d’exercer n° ${V(St.cnaps, 'n° d’autorisation CNAPS')} délivrée par le CNAPS, représentée par ${V(St.representant, 'nom')}${St.qualite ? P`, en qualité de ${V(St.qualite)}` : ''}, ci-après « ${bdaSousTraitant ? 'le Donneur d’ordre' : 'le Sous-traitant'} »,`;
  const nous = phraseEmployeur(E, bdaSousTraitant ? 'le Sous-traitant' : 'le Donneur d’ordre');
  const articles = [
    art('s-objet', 'Objet', [
      P`Le Donneur d’ordre, titulaire d’un contrat avec ${V(St.client, 'client final')}, confie au Sous-traitant, qui l’accepte, une mission de ${B(ACTIVITES[St.activite] || ACTIVITES.surveillance)} sur le site suivant : ${V(uneLigne(St.site), 'adresse du site')}.`,
      P`Moyens : ${V(St.agents, 'nombre et qualification des agents')}, aux horaires suivants : ${V(uneLigne(St.horaires), 'jours et horaires')}.`,
    ], { obligatoire: true }),
    art('s-duree', 'Durée', [St.fin ? P`La mission commence le ${D(St.debut)} et prend fin le ${D(St.fin)}.` : P`La mission commence le ${D(St.debut)} pour une durée indéterminée ; chaque partie peut y mettre fin par écrit avec un préavis d’un mois.`]),
    art('s-reglementation', 'Autorisations et conformité', [
      P`Chaque partie déclare être titulaire d’une autorisation d’exercer en cours de validité délivrée par le CNAPS, dont le numéro figure au présent contrat. Le Sous-traitant affecte à la mission uniquement des salariés titulaires d’une carte professionnelle valide pour l’activité concernée${St.activite === 'ssiap' ? ' ou du diplôme SSIAP requis' : ''} ; il communique avant le début de la mission la liste des agents et leur n° de carte, et signale tout changement.`,
      P`Le Sous-traitant ne peut lui-même sous-traiter tout ou partie de la mission sans l’accord écrit préalable du Donneur d’ordre, et dans les limites prévues par le Code de la sécurité intérieure.`,
      P`Le Sous-traitant remet au Donneur d’ordre, à la signature puis tous les six mois, une attestation de vigilance de l’URSSAF et un extrait d’immatriculation (articles L8222-1 et D8222-5 du Code du travail), ainsi que la liste nominative de ses salariés étrangers soumis à autorisation de travail lorsque la loi l’exige.`,
    ], { obligatoire: true }),
    art('s-autorite', 'Personnel', [
      P`Les agents restent salariés du Sous-traitant, qui seul les recrute, les rémunère, fixe leurs plannings, les encadre et exerce sur eux le pouvoir disciplinaire. Le présent contrat ne constitue en aucun cas un prêt de main-d’œuvre : le Sous-traitant s’engage sur un résultat de prestation, selon les consignes du site qui lui sont transmises.`,
    ]),
    art('s-prix', 'Prix et paiement', [
      P`La prestation est facturée ${V(St.tarif, 'prix')} hors taxes de l’heure réalisée. ${V(uneLigne(St.tva), 'TVA')}`,
      P`Les factures sont établies en fin de mois et payables à ${V(heuresFr(St.paiement), 'nombre')} jours à compter de leur date d’émission. Tout retard entraîne des pénalités égales à trois fois le taux d’intérêt légal et une indemnité forfaitaire de 40 € pour frais de recouvrement (article L441-10 du Code de commerce).`,
    ], { obligatoire: true }),
    art('s-assurance', 'Assurance et responsabilité', [
      P`Chaque partie est assurée en responsabilité civile professionnelle pour son activité et en justifie sur demande. Le Sous-traitant est responsable des fautes commises par ses agents dans l’exécution de la mission.`,
    ]),
    art('s-confidentialite', 'Confidentialité et non-sollicitation', [
      P`Les parties gardent confidentielles les informations échangées, notamment celles relatives au client final et au site. Pendant la durée du contrat et douze mois après, le Sous-traitant s’interdit de proposer directement ses services au client final pour ce site, et chaque partie s’interdit d’embaucher un salarié de l’autre affecté à la mission, sauf accord écrit.`,
    ]),
    art('s-resiliation', 'Résiliation et litiges', [
      P`En cas de manquement grave, le contrat peut être résilié de plein droit par lettre recommandée avec accusé de réception, 15 jours après une mise en demeure restée sans effet. Le contrat est soumis au droit français ; à défaut d’accord amiable, tout litige sera porté devant le tribunal de commerce de Paris.`,
    ]),
  ];
  const [donneur, sousTraitant] = bdaSousTraitant ? [autre, nous] : [nous, autre];
  const avant = [...enTete(d, 'Contrat de sous-traitance', ACTIVITES[St.activite] || ''), parties(donneur, sousTraitant)];
  const nomAutre = `${St.nom || ''}${St.representant ? ` · ${St.representant}` : ''}`;
  const nomBda = `${E.nom || ''} · ${E.representant || ''}`;
  const apres = [signatures(d, ['Le Donneur d’ordre', bdaSousTraitant ? nomAutre : nomBda, 'Signature et cachet'], ['Le Sous-traitant', bdaSousTraitant ? nomBda : nomAutre], 'Signature et cachet.'), mentionCnaps(E)];
  return finaliser(d, avant, articles, apres);
}
