/* =========================================================
   ESPACE ADMIN BDA — contrats : les modèles, le formulaire,
   les contrôles (ce qui manque, ce qui est interdit).
   Les textes des articles sont dans contrats-textes.js.
   ========================================================= */
import { construire, texteDe, heuresMois, CCN } from './contrats-textes.js';

export { construire, texteDe };

/* ---------- Les cases de la page Contrats ---------- */
export const FAMILLES = [
  { cle: 'securite', titre: 'Sécurité privée', texte: 'Agents de sécurité, SSIAP, cynophiles, événementiel.' },
  { cle: 'protection', titre: 'Protection rapprochée', texte: 'Garde du corps (agent de protection physique des personnes).' },
  { cle: 'vtc', titre: 'Chauffeur VTC', texte: 'Chauffeur salarié, avec véhicule de l’entreprise.' },
  { cle: 'bureau', titre: 'Bureau', texte: 'Administratif, planning, accueil.' },
  { cle: 'autres', titre: 'Autres documents', texte: 'Modifier un contrat, proposer un poste, travailler avec un client ou une autre société.' },
];
const ATT_PROTECTION = 'Autorisation CNAPS « protection physique des personnes » nécessaire (BDA n’a que la surveillance).';
const ATT_VTC = 'Pas dans une société de sécurité : uniquement l’EI une fois son activité sécurité arrêtée.';
export const MODELES = [
  { id: 'cdi-securite', famille: 'securite', titre: 'Agent de sécurité', texte: 'CDI à temps plein, agent de prévention et de sécurité.', tags: ['CDI', 'Temps plein'], base: { genre: 'travail', metier: 'securite', nature: 'CDI', temps: 'plein', posteCle: 'ads' } },
  { id: 'cdi-securite-partiel', famille: 'securite', titre: 'Agent de sécurité', texte: 'CDI à temps partiel : heures par semaine et jours de travail précisés.', tags: ['CDI', 'Temps partiel'], base: { genre: 'travail', metier: 'securite', nature: 'CDI', temps: 'partiel', posteCle: 'ads' } },
  { id: 'cdd-securite', famille: 'securite', titre: 'Agent de sécurité', texte: 'CDD : remplacement ou surcroît d’activité (nouveau site, renfort).', tags: ['CDD'], base: { genre: 'travail', metier: 'securite', nature: 'CDD', temps: 'plein', posteCle: 'ads' } },
  { id: 'cdi-ssiap', famille: 'securite', titre: 'Agent SSIAP', texte: 'CDI sécurité incendie (SSIAP 1, 2 ou 3).', tags: ['CDI', 'SSIAP'], base: { genre: 'travail', metier: 'ssiap', nature: 'CDI', temps: 'plein', posteCle: 'ssiap1' } },
  { id: 'cdd-ssiap', famille: 'securite', titre: 'Agent SSIAP', texte: 'CDD sécurité incendie.', tags: ['CDD', 'SSIAP'], base: { genre: 'travail', metier: 'ssiap', nature: 'CDD', temps: 'plein', posteCle: 'ssiap1' } },
  { id: 'cdi-cynophile', famille: 'securite', titre: 'Agent cynophile', texte: 'CDI maître-chien : clause sur le chien et son entretien.', tags: ['CDI', 'Chien'], base: { genre: 'travail', metier: 'securite', nature: 'CDI', temps: 'plein', posteCle: 'cynophile', clauses: { chien: true } } },
  { id: 'cdd-evenementiel', famille: 'securite', titre: 'Agent événementiel', texte: 'CDD pour un événement (salon, concert, soirée).', tags: ['CDD', 'Événement'], base: { genre: 'travail', metier: 'securite', nature: 'CDD', temps: 'partiel', posteCle: 'evenementiel', duree: { motif: 'accroissement' } } },
  { id: 'cdi-chef-poste', famille: 'securite', titre: 'Chef de poste', texte: 'CDI chef de poste ou chef d’équipe sécurité.', tags: ['CDI'], base: { genre: 'travail', metier: 'securite', nature: 'CDI', temps: 'plein', posteCle: 'chef-poste' } },
  { id: 'cdi-protection', famille: 'protection', titre: 'Garde du corps', texte: 'CDI agent de protection rapprochée.', tags: ['CDI'], attention: ATT_PROTECTION, base: { genre: 'travail', metier: 'protection', nature: 'CDI', temps: 'plein', posteCle: 'apr' } },
  { id: 'cdd-protection', famille: 'protection', titre: 'Garde du corps', texte: 'CDD pour une mission de protection (séjour, événement).', tags: ['CDD'], attention: ATT_PROTECTION, base: { genre: 'travail', metier: 'protection', nature: 'CDD', temps: 'plein', posteCle: 'apr' } },
  { id: 'cdi-vtc', famille: 'vtc', titre: 'Chauffeur VTC', texte: 'CDI à temps plein.', tags: ['CDI', 'Temps plein'], attention: ATT_VTC, base: { genre: 'travail', metier: 'vtc', nature: 'CDI', temps: 'plein', posteCle: 'vtc' } },
  { id: 'cdi-vtc-partiel', famille: 'vtc', titre: 'Chauffeur VTC', texte: 'CDI à temps partiel.', tags: ['CDI', 'Temps partiel'], attention: ATT_VTC, base: { genre: 'travail', metier: 'vtc', nature: 'CDI', temps: 'partiel', posteCle: 'vtc' } },
  { id: 'cdd-vtc', famille: 'vtc', titre: 'Chauffeur VTC', texte: 'CDD (remplacement, période chargée).', tags: ['CDD'], attention: ATT_VTC, base: { genre: 'travail', metier: 'vtc', nature: 'CDD', temps: 'plein', posteCle: 'vtc' } },
  { id: 'cdi-bureau', famille: 'bureau', titre: 'Employé(e) administratif(ve)', texte: 'CDI assistant(e) d’exploitation : planning, clients, recrutement.', tags: ['CDI'], base: { genre: 'travail', metier: 'bureau', nature: 'CDI', temps: 'plein', posteCle: 'assistant' } },
  { id: 'cdd-bureau', famille: 'bureau', titre: 'Employé(e) administratif(ve)', texte: 'CDD administratif.', tags: ['CDD'], base: { genre: 'travail', metier: 'bureau', nature: 'CDD', temps: 'plein', posteCle: 'assistant' } },
  { id: 'avenant', famille: 'autres', titre: 'Avenant au contrat', texte: 'Changer les heures, le salaire, le poste, le lieu, renouveler un CDD, ajouter des heures.', tags: ['Avenant'], base: { genre: 'avenant' } },
  { id: 'offre', famille: 'autres', titre: 'Promesse d’embauche', texte: 'Lettre d’offre d’emploi à faire signer « bon pour accord ».', tags: ['Offre'], base: { genre: 'offre', nature: 'CDI', temps: 'plein', metier: 'securite', posteCle: 'ads' } },
  { id: 'prestation', famille: 'autres', titre: 'Contrat client', texte: 'Prestation de surveillance ou de sécurité incendie pour un client.', tags: ['Client'], base: { genre: 'prestation' } },
  { id: 'sous-traitance', famille: 'autres', titre: 'Sous-traitance', texte: 'Travailler pour une autre société de sécurité (renfort), ou lui confier une mission.', tags: ['Société'], base: { genre: 'soustraitance' } },
];
export const modele = (id) => MODELES.find((m) => m.id === id);

/* ---------- Postes : intitulé et classification proposés ---------- */
export const POSTES = {
  securite: [
    ['ads', 'Agent de prévention et de sécurité (ADS)', CCN.qualifs.ads],
    ['ads-confirme', 'Agent de sécurité confirmé', CCN.qualifs.adsConfirme],
    ['evenementiel', 'Agent de sécurité événementielle', CCN.qualifs.ads],
    ['cynophile', 'Agent de sécurité cynophile', CCN.qualifs.cynophile],
    ['video', 'Opérateur de vidéoprotection', CCN.qualifs.video],
    ['chef-poste', 'Chef de poste', CCN.qualifs.chefPoste],
    ['chef-equipe', 'Chef d’équipe', CCN.qualifs.chefEquipe],
  ],
  ssiap: [
    ['ssiap1', 'Agent de service de sécurité incendie et d’assistance à personnes (SSIAP 1)', CCN.qualifs.ssiap1],
    ['ssiap2', 'Chef d’équipe de service de sécurité incendie (SSIAP 2)', CCN.qualifs.ssiap2],
    ['ssiap3', 'Chef de service de sécurité incendie (SSIAP 3)', CCN.qualifs.ssiap3],
  ],
  protection: [
    ['apr', 'Agent de protection rapprochée (protection physique des personnes)', CCN.qualifs.apr],
    ['apr-chef', 'Chef de mission de protection rapprochée', CCN.qualifs.aprChef],
  ],
  vtc: [['vtc', 'Conducteur de voiture de transport avec chauffeur (VTC)', '']],
  bureau: [
    ['assistant', 'Assistant(e) d’exploitation', CCN.qualifs.assistant],
    ['secretaire', 'Secrétaire administratif(ve)', CCN.qualifs.secretaire],
    ['planning', 'Planificateur(trice)', CCN.qualifs.planning],
  ],
};
const postesDe = (metier) => POSTES[metier] || POSTES.securite;

/* ---------- Réglages : employeurs et organismes (Contrats > Employeurs & organismes) ---------- */
export const REGLAGES_DEFAUT = {
  employeurs: {
    ei: {
      type: 'ei', nom: 'BDA SECURITE', forme: 'Entreprise individuelle de M. Abdelouahab BOUIDIA',
      adresse: '61 rue de la Croix Saint-Simon\n75020 Paris', siret: '977 933 316 00019', ape: '8010Z', rcs: '',
      cnaps: 'AUT-075-2124-07-01-20250906336', evtc: '', representant: 'Abdelouahab BOUIDIA', qualite: 'Entrepreneur individuel', email: 'contact@bdasecurite.com',
    },
    eurl: {
      type: 'societe', nom: 'BDASECURITE', forme: 'EURL au capital de ……… €',
      adresse: '61 rue de la Croix Saint-Simon\n75020 Paris', siret: '109 076 463 00016', ape: '8010Z', rcs: 'RCS Paris 109 076 463',
      cnaps: '', evtc: '', representant: 'Abdelouahab BOUIDIA', qualite: 'Gérant', email: 'contact@bdasecurite.com',
    },
  },
  organismes: { retraite: '', prevoyance: '', mutuelle: '', sante: '' },
  ville: 'Paris',
  siege: '61 rue de la Croix Saint-Simon, 75020 Paris',
};
export function reglagesComplets(r) {
  const R = JSON.parse(JSON.stringify(REGLAGES_DEFAUT));
  if (!r || typeof r !== 'object') return R;
  for (const k of ['ei', 'eurl']) Object.assign(R.employeurs[k], r.employeurs?.[k] || {});
  Object.assign(R.organismes, r.organismes || {});
  if (r.ville) R.ville = r.ville;
  if (r.siege) R.siege = r.siege;
  return R;
}

/* ---------- Données d'un contrat ---------- */
const VIDE = () => ({
  modele: '', genre: 'travail', metier: 'securite', nature: 'CDI', temps: 'plein', posteCle: 'ads', statut: 'brouillon',
  emp: {}, empCle: 'ei',
  sal: { civ: '', nom: '', prenom: '', naissance: '', lieuNaissance: '', nationalite: 'française', ue: true, titreSejour: '', titreFin: '', adresse: '', nir: '', tel: '', email: '',
    carte: '', carteFin: '', ssiapDiplome: '', ssiapDate: '', secourisme: '', carteVtc: '', carteVtcFin: '', prefecture: '', permis: '', permisDate: '', agentId: 0 },
  poste: { intitule: '', qualif: '', statut: 'Employé', lieu: '', zone: CCN.zone, base: '' },
  duree: { debut: '', fin: '', motif: 'accroissement', motifDetail: '', remplace: '', remplaceQualif: '', remplaceRaison: '', terme: 'precis', dureeMin: '', renouvelable: true, essai: '' },
  tps: { hebdo: 35, repartition: '', cas: CCN.casModification, prevenance: CCN.prevenancePartiel, complementaires: '10', demande24: '', motif24: '', nuit: true, planning: CCN.delaiPlanning },
  rem: { taux: '', primes: '', jour: '', navigo: true },
  org: { retraite: '', prevoyance: '', mutuelle: '', sante: '' },
  clauses: { mobilite: true, confidentialite: true, pointage: true, formation: true, reprise: true, chien: false, vehicule: true, nonConcurrence: false, ncDuree: '12 mois', ncZone: 'Paris et Île-de-France', ncContrepartie: 30 },
  chien: { nom: '', race: '', puce: '', proprietaire: 'salarie' },
  vehicule: { modele: '', immat: '', personnel: false },
  av: { numero: '1', contratDate: '', contratNature: 'CDI', objets: ['remuneration'], effet: '', hebdo: '', repartition: '', taux: '', intitule: '', qualif: '', lieu: '', zone: '', complHeures: '', complDebut: '', complFin: '', complMotif: '', nouvelleFin: '', autre: '' },
  of: { validite: '', entretien: '', conditions: '' },
  cli: { nom: '', forme: '', siret: '', adresse: '', representant: '', qualite: '', email: '' },
  pr: { activite: 'surveillance', site: '', debut: '', type: 'indeterminee', fin: '', preavis: '1 mois', agents: '1', horaires: '', tarifs: CCN.tarifsDefaut, majorations: 'Nuit (21 h – 6 h), dimanches : + 10 %. Jours fériés : + 100 %.', tva: '', paiement: 30, assurance: '', consignes: true, nonSollicitation: true, revision: true },
  st: { role: 'sous-traitant', nom: '', forme: '', siret: '', adresse: '', cnaps: '', representant: '', qualite: '', client: '', site: '', activite: 'surveillance', debut: '', fin: '', agents: '', horaires: '', tarif: '', paiement: 30 },
  masques: [], textes: {}, titres: {}, ajouts: [], titreDoc: '', sousDoc: '',
  fait: { ville: 'Paris', date: '', exemplaires: 2 },
});
function fusion(base, x) {
  for (const [k, v] of Object.entries(x || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) fusion(base[k], v);
    else base[k] = v;
  }
  return base;
}
export const completer = (data) => fusion(VIDE(), data);

export function nouveauContrat(modeleId, R) {
  const M = modele(modeleId);
  const d = fusion(VIDE(), JSON.parse(JSON.stringify(M.base)));
  d.modele = M.id;
  d.empCle = 'ei';
  d.emp = { ...R.employeurs.ei };
  d.org = { ...R.organismes };
  d.fait.ville = R.ville || 'Paris';
  d.poste.lieu = d.metier === 'bureau' ? R.siege : '';
  d.poste.base = R.siege;
  appliquerPoste(d);
  if (d.temps === 'partiel') d.tps.hebdo = d.posteCle === 'evenementiel' ? '' : 24;
  if (d.metier === 'bureau' || d.metier === 'vtc') d.tps.nuit = false;
  if (d.metier === 'vtc') { d.clauses.reprise = false; d.poste.zone = 'Paris et Île-de-France, ainsi que tout trajet demandé par un client au départ de cette zone'; }
  if (d.metier === 'bureau') { d.clauses.reprise = false; d.clauses.mobilite = false; }
  if (d.genre === 'prestation' || d.genre === 'soustraitance') d.pr.tva = d.st.tva = tvaDefaut(d.emp);
  return d;
}
const tvaDefaut = (emp) => (emp.type === 'ei' ? 'TVA non applicable, article 293 B du Code général des impôts.' : 'Les prix s’entendent hors taxes ; la TVA au taux en vigueur (20 %) s’y ajoute.');
function appliquerPoste(d) {
  const p = postesDe(d.metier).find(([k]) => k === d.posteCle) || postesDe(d.metier)[0];
  d.posteCle = p[0];
  d.poste.intitule = p[1];
  d.poste.qualif = p[2];
  d.poste.statut = /maîtrise/i.test(p[2]) ? 'Agent de maîtrise' : 'Employé';
}

// Fiche agent + dossier de paie → salarié du contrat
export function depuisAgent(d, a, profil) {
  const mots = String(a.nom || '').trim().split(/\s+/);
  const estNom = (m) => m === m.toUpperCase() && /\p{L}/u.test(m);
  const nom = mots.filter(estNom), prenom = mots.filter((m) => !estNom(m));
  let infos = {};
  try { infos = typeof a.infos === 'string' ? JSON.parse(a.infos || '{}') : (a.infos || {}); } catch (e) { infos = {}; }
  const S = d.sal;
  S.agentId = +a.id || 0;
  S.nom = nom.join(' ') || mots[0] || '';
  S.prenom = prenom.join(' ') || (nom.length ? '' : mots.slice(1).join(' '));
  if (profil.sexe) S.civ = profil.sexe === 'F' ? 'Mme' : 'M.';
  const copie = { naissance: 'dateNaissance', lieuNaissance: 'lieuNaissance', nationalite: 'nationalite', nir: 'nir', adresse: 'adresse', titreFin: 'titreSejourFin' };
  for (const [k, p] of Object.entries(copie)) if (profil[p]) S[k] = profil[p];
  if (profil.ue === false) { S.ue = false; S.titreSejour = [profil.titreSejour, profil.titreSejourNumero].filter(Boolean).join(' n° '); }
  if (a.tel) S.tel = a.tel;
  if (infos.mail || infos.email) S.email = infos.mail || infos.email;
  if (a.carte) { if (d.metier === 'vtc') S.carteVtc = a.carte; else S.carte = a.carte; }
  if (a.validite) { if (d.metier === 'vtc') S.carteVtcFin = a.validite; else S.carteFin = a.validite; }
}

/* ---------- Titres ---------- */
const NOM_GENRE = { avenant: 'Avenant', offre: 'Promesse d’embauche', prestation: 'Contrat client', soustraitance: 'Sous-traitance' };
export function titreContrat(d, court) {
  const qui = [d.sal?.nom, d.sal?.prenom].filter(Boolean).join(' ');
  if (d.genre === 'prestation') return court ? 'Contrat de prestation de services' : `Contrat client · ${d.cli?.nom || 'nouveau client'}`;
  if (d.genre === 'soustraitance') return court ? 'Contrat de sous-traitance' : `Sous-traitance · ${d.st?.nom || 'société'}`;
  if (d.genre === 'avenant') return court ? `Avenant n° ${d.av?.numero || '…'} · ${qui}` : `Avenant n° ${d.av?.numero || '…'} · ${qui || 'salarié'}`;
  if (d.genre === 'offre') return court ? `Offre d’emploi · ${qui}` : `Promesse d’embauche · ${qui || 'candidat'}`;
  const poste = (d.poste?.intitule || '').replace(/\s*\(.*\)$/, '');
  return court ? `Contrat de travail ${d.nature} · ${qui}` : [`${d.nature}${d.temps === 'partiel' ? ' temps partiel' : ''}`, poste, qui || 'nouveau salarié'].join(' · ');
}
export function nomFichier(d) {
  const qui = [d.sal?.nom, d.sal?.prenom].filter(Boolean).join(' ');
  if (d.genre === 'prestation') return `Contrat client - ${d.cli?.nom || 'BDA'}`;
  if (d.genre === 'soustraitance') return `Contrat de sous-traitance - ${d.st?.nom || 'BDA'}`;
  if (d.genre === 'avenant') return `Avenant ${d.av?.numero || ''} - ${qui}`;
  if (d.genre === 'offre') return `Promesse d'embauche - ${qui}`;
  return `Contrat ${d.nature}${d.temps === 'partiel' ? ' temps partiel' : ''} - ${qui || 'BDA'}`;
}

/* =========================================================
   FORMULAIRE : sections et champs
   k = chemin dans les données, t = type, si = affiché si…,
   refait = redessine le formulaire, apres = action en plus
   ========================================================= */
const OUI_NON = [['true', 'Oui'], ['false', 'Non']];
const CIV = [['M.', 'Monsieur'], ['Mme', 'Madame']];
const travail = (d) => d.genre === 'travail' || d.genre === 'offre';
const secu = (d) => d.metier === 'securite' || d.metier === 'protection';
const cdd = (d) => d.nature === 'CDD';

function champsEmployeur(R) {
  return [
    { k: 'empCle', l: 'Employeur', t: 'liste', o: [['ei', `${R.employeurs.ei.nom} (EI)`], ['eurl', `${R.employeurs.eurl.nom} (EURL)`], ['autre', 'Autre (à saisir)']], refait: true,
      apres: (d) => { if (d.empCle !== 'autre') d.emp = { ...R.employeurs[d.empCle] }; else d.emp = { type: 'societe', nom: '', forme: '', adresse: '', siret: '', ape: '', rcs: '', cnaps: '', evtc: '', representant: '', qualite: 'Gérant', email: '' }; d.pr.tva = d.st.tva = tvaDefaut(d.emp); } },
    { k: 'emp.nom', l: 'Nom de l’employeur', si: (d) => d.empCle === 'autre' },
    { k: 'emp.forme', l: 'Forme', si: (d) => d.empCle === 'autre', demi: true },
    { k: 'emp.siret', l: 'SIRET', si: (d) => d.empCle === 'autre', demi: true },
    { k: 'emp.adresse', l: 'Adresse', t: 'zone', lignes: 2, si: (d) => d.empCle === 'autre' },
    { k: 'emp.cnaps', l: 'Autorisation CNAPS', si: (d) => d.empCle === 'autre', demi: true },
    { k: 'emp.representant', l: 'Signataire', demi: true },
    { k: 'emp.qualite', l: 'Qualité', demi: true },
  ];
}
function champsSalarie(d, mot = 'salarié') {
  return [
    { k: 'sal.civ', l: 'Civilité', t: 'choix', o: CIV, refait: true },
    { k: 'sal.nom', l: 'Nom', ph: 'NOM', demi: true },
    { k: 'sal.prenom', l: 'Prénom', demi: true },
    { k: 'sal.adresse', l: 'Adresse', t: 'zone', lignes: 2, ph: 'N°, rue\nCode postal, ville' },
    ...(d.genre === 'offre' ? [{ k: 'sal.email', l: 'Email', demi: true }, { k: 'sal.tel', l: 'Téléphone', demi: true }] : [
      { k: 'sal.naissance', l: 'Date de naissance', t: 'date', demi: true },
      { k: 'sal.lieuNaissance', l: 'Lieu de naissance', ph: 'Ville (pays)', demi: true },
      { k: 'sal.nationalite', l: 'Nationalité', demi: true },
      { k: 'sal.nir', l: 'N° de sécurité sociale', ph: '15 chiffres', demi: true },
      { k: 'sal.ue', l: `Le ${mot} est français, européen (UE, EEE) ou suisse`, t: 'case', refait: true, aide: 'Sinon : titre de séjour autorisant à travailler, à vérifier auprès de la préfecture avant l’embauche.' },
      { k: 'sal.titreSejour', l: 'Titre de séjour (type et n°)', si: (x) => x.sal.ue === false, demi: true },
      { k: 'sal.titreFin', l: 'Valable jusqu’au', t: 'date', si: (x) => x.sal.ue === false, demi: true },
    ]),
    { k: 'sal.carte', l: 'N° de carte professionnelle CNAPS', si: (x) => secu(x) || (x.metier === 'ssiap' && x.ssiapSurveillance), demi: true, ph: 'CAR-…' },
    { k: 'sal.carteFin', l: 'Carte valable jusqu’au', t: 'date', si: (x) => secu(x) || (x.metier === 'ssiap' && x.ssiapSurveillance), demi: true },
    { k: 'ssiapSurveillance', l: 'Fait aussi de la surveillance (carte pro CNAPS)', t: 'case', si: (x) => x.metier === 'ssiap', refait: true, aide: 'Un agent SSIAP qui ne fait que de la sécurité incendie n’a pas besoin de carte pro.' },
    { k: 'sal.ssiapDiplome', l: 'Diplôme SSIAP (n° et date)', si: (x) => x.metier === 'ssiap', demi: true },
    { k: 'sal.secourisme', l: 'Secourisme (SST ou PSC1) valable jusqu’au', t: 'date', si: (x) => x.metier === 'ssiap', demi: true },
    { k: 'sal.carteVtc', l: 'N° de carte VTC', si: (x) => x.metier === 'vtc', demi: true },
    { k: 'sal.carteVtcFin', l: 'Carte VTC valable jusqu’au', t: 'date', si: (x) => x.metier === 'vtc', demi: true },
    { k: 'sal.permis', l: 'N° du permis B', si: (x) => x.metier === 'vtc', demi: true },
    { k: 'sal.permisDate', l: 'Permis obtenu le', t: 'date', si: (x) => x.metier === 'vtc', demi: true },
  ];
}
function champsPoste(d) {
  return [
    { k: 'posteCle', l: 'Poste', t: 'liste', o: postesDe(d.metier).map(([k, l]) => [k, l]), refait: true, apres: appliquerPoste },
    { k: 'poste.intitule', l: 'Intitulé sur le contrat' },
    { k: 'poste.qualif', l: 'Classification (niveau, échelon, coefficient)', aide: d.metier === 'vtc' ? 'Selon la convention collective appliquée par l’entreprise de VTC.' : 'Grille de la convention collective de la prévention et de la sécurité.' },
    { k: 'poste.statut', l: 'Statut', t: 'liste', o: [['Employé', 'Employé'], ['Agent de maîtrise', 'Agent de maîtrise'], ['Cadre', 'Cadre']], demi: true },
    { k: d.metier === 'vtc' ? 'poste.base' : 'poste.lieu', l: d.metier === 'vtc' ? 'Lieu de prise de service' : d.metier === 'bureau' ? 'Lieu de travail' : 'Premier site d’affectation', demi: true, ph: d.metier === 'bureau' ? '' : 'ex. Consulat, 75008 Paris' },
    { k: 'poste.zone', l: 'Zone de mobilité', t: 'zone', lignes: 2, si: (x) => x.clauses.mobilite || x.metier === 'vtc', aide: 'Elle doit être précise : on ne peut pas muter le salarié en dehors.' },
  ];
}
function champsDuree(d) {
  return [
    { k: 'nature', l: 'Contrat', t: 'choix', o: [['CDI', 'CDI'], ['CDD', 'CDD']], refait: true },
    { k: 'duree.debut', l: 'Début du contrat', t: 'date', demi: true },
    { k: 'duree.motif', l: 'Motif du CDD', t: 'liste', si: cdd, refait: true, o: [['accroissement', 'Surcroît temporaire d’activité'], ['remplacement', 'Remplacement d’un salarié absent'], ['attente', 'Attente de l’arrivée d’un salarié en CDI'], ['saisonnier', 'Emploi saisonnier']] },
    { k: 'duree.motifDetail', l: 'Précisez le surcroît d’activité', si: (x) => cdd(x) && (x.duree.motif === 'accroissement' || x.duree.motif === 'saisonnier'), t: 'zone', lignes: 2, ph: 'ex. renfort de la surveillance du site … pendant l’événement du … au …' },
    { k: 'duree.remplace', l: 'Nom du salarié remplacé', si: (x) => cdd(x) && x.duree.motif !== 'accroissement' && x.duree.motif !== 'saisonnier', demi: true },
    { k: 'duree.remplaceQualif', l: 'Son poste (qualification)', si: (x) => cdd(x) && x.duree.motif !== 'accroissement' && x.duree.motif !== 'saisonnier', demi: true },
    { k: 'duree.remplaceRaison', l: 'Motif de son absence', si: (x) => cdd(x) && x.duree.motif === 'remplacement', ph: 'ex. congé maladie, congés payés, congé parental' },
    { k: 'duree.terme', l: 'Fin du CDD', t: 'choix', si: (x) => cdd(x) && x.duree.motif !== 'accroissement', refait: true, o: [['precis', 'Date précise'], ['minimal', 'Au retour du salarié (durée minimale)']] },
    { k: 'duree.fin', l: 'Fin du contrat le', t: 'date', si: (x) => cdd(x) && (x.duree.terme === 'precis' || x.duree.motif === 'accroissement'), demi: true },
    { k: 'duree.dureeMin', l: 'Durée minimale', si: (x) => cdd(x) && x.duree.terme === 'minimal' && x.duree.motif !== 'accroissement', demi: true, ph: 'ex. 1 mois' },
    { k: 'duree.renouvelable', l: 'Renouvelable (2 fois au plus, 18 mois en tout)', t: 'case', si: (x) => cdd(x) && (x.duree.terme === 'precis' || x.duree.motif === 'accroissement') },
    { k: 'duree.essai', l: 'Période d’essai', ph: 'Calculée toute seule (laissez vide)', aide: 'Écrivez « aucune » pour ne pas en mettre.' },
  ];
}
function champsTemps(d) {
  const mensuel = heuresMois(d);
  return [
    { k: 'temps', l: 'Temps de travail', t: 'choix', o: [['plein', 'Temps plein (35 h)'], ['partiel', 'Temps partiel']], refait: true },
    { k: 'tps.hebdo', l: 'Heures par semaine', t: 'nombre', si: (x) => x.temps === 'partiel', demi: true, refait: true, aide: mensuel ? `Soit ${String(mensuel).replace('.', ',')} h par mois.` : '' },
    { k: 'tps.prevenance', l: 'Prévenir d’un changement (jours)', t: 'nombre', si: (x) => x.temps === 'partiel', demi: true, aide: 'Au moins 7 jours ouvrés, sauf accord de branche.' },
    { k: 'tps.repartition', l: 'Répartition des heures', t: 'zone', lignes: 3, si: (x) => x.temps === 'partiel', ph: 'ex. du lundi au vendredi, de 8 h 30 à 13 h 30', aide: 'Obligatoire : quels jours de la semaine (ou quelles semaines du mois). Sinon le temps partiel peut être requalifié en temps plein.' },
    { k: 'tps.cas', l: 'Cas où la répartition peut changer', t: 'zone', lignes: 3, si: (x) => x.temps === 'partiel' },
    { k: 'tps.complementaires', l: 'Heures complémentaires possibles', t: 'liste', si: (x) => x.temps === 'partiel', o: [['10', 'Jusqu’à 1/10 des heures du contrat'], ['33', 'Jusqu’à 1/3 (si la convention le permet)']] },
    { k: 'tps.demande24', l: 'Demande écrite du salarié pour moins de 24 h (date)', t: 'date', si: (x) => x.temps === 'partiel' && +x.tps.hebdo > 0 && +x.tps.hebdo < 24, demi: true, refait: true },
    { k: 'tps.motif24', l: 'Motif de sa demande', si: (x) => x.temps === 'partiel' && +x.tps.hebdo > 0 && +x.tps.hebdo < 24, t: 'liste', demi: true, o: [['personnel', 'Contraintes personnelles'], ['cumul', 'Cumul avec un autre emploi'], ['etudiant', 'Étudiant de moins de 26 ans']] },
    { k: 'tps.nuit', l: 'Travail de nuit, le dimanche et les jours fériés possible', t: 'case', si: (x) => x.metier !== 'bureau' },
    { k: 'tps.planning', l: 'Planning remis à l’avance (jours)', t: 'nombre', demi: true, si: (x) => x.metier !== 'bureau' },
  ];
}
function champsRemuneration(d) {
  const mensuel = heuresMois(d);
  const brut = +d.rem.taux > 0 && mensuel ? (Math.round(+d.rem.taux * mensuel * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) : '';
  return [
    { k: 'rem.taux', l: 'Taux horaire brut (€)', t: 'nombre', demi: true, refait: true, aide: brut ? `Salaire de base : ${brut} € brut par mois.` : CCN.aideTaux },
    { k: 'rem.jour', l: 'Payé au plus tard le', ph: 'ex. 5 du mois suivant', demi: true },
    { k: 'rem.primes', l: 'Primes ou avantages en plus', t: 'zone', lignes: 2, ph: 'ex. prime de chef de poste de 100 € brut par mois' },
    { k: 'rem.navigo', l: 'Remboursement de 50 % du Navigo', t: 'case' },
  ];
}
function champsOrganismes() {
  return [
    { k: 'org.retraite', l: 'Caisse de retraite complémentaire (nom et adresse)', t: 'zone', lignes: 2 },
    { k: 'org.prevoyance', l: 'Organisme de prévoyance (nom et adresse)', t: 'zone', lignes: 2 },
    { k: 'org.mutuelle', l: 'Mutuelle santé', t: 'zone', lignes: 2 },
    { k: 'org.sante', l: 'Service de santé au travail', t: 'zone', lignes: 2 },
  ];
}
function champsClauses(d) {
  return [
    { k: 'clauses.mobilite', l: 'Mobilité sur les sites des clients', t: 'case', si: (x) => x.metier !== 'vtc', refait: true },
    { k: 'clauses.reprise', l: 'Reprise du personnel (changement de prestataire)', t: 'case', si: (x) => secu(x) || x.metier === 'ssiap' },
    { k: 'clauses.formation', l: 'Formations obligatoires payées par l’employeur', t: 'case', aide: 'MAC, recyclage SSIAP, secourisme, formation continue VTC…' },
    { k: 'clauses.confidentialite', l: 'Confidentialité', t: 'case' },
    { k: 'clauses.pointage', l: 'Pointage par le téléphone et Espace équipe', t: 'case' },
    { k: 'clauses.chien', l: 'Chien (agent cynophile)', t: 'case', si: (x) => x.metier === 'securite', refait: true },
    { k: 'chien.nom', l: 'Nom du chien', si: (x) => x.clauses.chien && x.metier === 'securite', demi: true },
    { k: 'chien.puce', l: 'N° d’identification (puce)', si: (x) => x.clauses.chien && x.metier === 'securite', demi: true },
    { k: 'chien.race', l: 'Race', si: (x) => x.clauses.chien && x.metier === 'securite', demi: true },
    { k: 'chien.proprietaire', l: 'Le chien appartient', t: 'liste', o: [['salarie', 'au salarié'], ['employeur', 'à l’entreprise']], si: (x) => x.clauses.chien && x.metier === 'securite', demi: true },
    { k: 'clauses.vehicule', l: 'Véhicule de l’entreprise', t: 'case', si: (x) => x.metier === 'vtc', refait: true },
    { k: 'vehicule.modele', l: 'Véhicule (marque, modèle)', si: (x) => x.metier === 'vtc' && x.clauses.vehicule, demi: true },
    { k: 'vehicule.immat', l: 'Immatriculation', si: (x) => x.metier === 'vtc' && x.clauses.vehicule, demi: true },
    { k: 'vehicule.personnel', l: 'Usage personnel autorisé en dehors du service', t: 'case', si: (x) => x.metier === 'vtc' && x.clauses.vehicule },
    { k: 'clauses.nonConcurrence', l: 'Non-concurrence après le départ', t: 'case', refait: true, aide: 'Rarement utile : elle oblige à verser une indemnité chaque mois après le départ.' },
    { k: 'clauses.ncDuree', l: 'Durée', si: (x) => x.clauses.nonConcurrence, demi: true },
    { k: 'clauses.ncContrepartie', l: 'Indemnité (% du salaire)', t: 'nombre', si: (x) => x.clauses.nonConcurrence, demi: true },
    { k: 'clauses.ncZone', l: 'Zone', si: (x) => x.clauses.nonConcurrence },
  ];
}
const champsFait = () => [
  { k: 'titreDoc', l: 'Titre en haut du document', ph: 'Laissez vide pour le titre automatique' },
  { k: 'sousDoc', l: 'Sous-titre', ph: 'Laissez vide pour le sous-titre automatique' },
  { k: 'fait.ville', l: 'Fait à', demi: true },
  { k: 'fait.date', l: 'Le', t: 'date', demi: true, aide: 'Vide = à écrire à la main.' },
];

export function sections(d, R) {
  if (d.genre === 'avenant') return sectionsAvenant(d, R);
  if (d.genre === 'prestation') return sectionsPrestation(d, R);
  if (d.genre === 'soustraitance') return sectionsSousTraitance(d, R);
  if (d.genre === 'offre') {
    return [
      { cle: 'modele', titre: 'Employeur', champs: [...champsEmployeur(R), { k: 'metier', l: 'Métier', t: 'liste', refait: true, o: [['securite', 'Sécurité'], ['ssiap', 'SSIAP'], ['protection', 'Protection rapprochée'], ['vtc', 'Chauffeur VTC'], ['bureau', 'Bureau']], apres: (x) => { x.posteCle = postesDe(x.metier)[0][0]; appliquerPoste(x); } }] },
      { cle: 'salarie', titre: 'Le candidat', manque: (x) => !x.sal.nom, champs: champsSalarie(d, 'candidat').filter((c) => !/sal\.(carte|ssiap|secourisme|permis)/.test(c.k) && c.k !== 'ssiapSurveillance') },
      { cle: 'poste', titre: 'Le poste proposé', champs: champsPoste(d) },
      { cle: 'duree', titre: 'Contrat et dates', manque: (x) => !x.duree.debut, champs: champsDuree(d).filter((c) => !['duree.renouvelable'].includes(c.k)) },
      { cle: 'temps', titre: 'Heures et salaire', champs: [...champsTemps(d).filter((c) => ['temps', 'tps.hebdo', 'tps.repartition', 'tps.nuit'].includes(c.k)), ...champsRemuneration(d).filter((c) => c.k !== 'rem.jour')] },
      { cle: 'fait', titre: 'L’offre, titre, lieu et date', champs: [
        { k: 'of.entretien', l: 'Date de l’entretien', t: 'date', demi: true },
        { k: 'of.validite', l: 'Réponse attendue avant le', t: 'date', demi: true, aide: 'Après cette date, l’offre tombe.' },
        { k: 'of.conditions', l: 'Conditions à remplir', t: 'zone', lignes: 3, ph: 'ex. présenter sa carte professionnelle en cours de validité et ses diplômes' },
        ...champsFait()] },
    ];
  }
  return [
    { cle: 'modele', titre: 'Le contrat', champs: [...champsEmployeur(R)] },
    { cle: 'salarie', titre: 'Le salarié', manque: (x) => !x.sal.nom || !x.sal.naissance || !x.sal.adresse || !x.sal.nir, champs: champsSalarie(d) },
    { cle: 'poste', titre: 'Le poste', champs: champsPoste(d) },
    { cle: 'duree', titre: 'Durée et dates', manque: (x) => !x.duree.debut || (cdd(x) && !x.duree.fin && !x.duree.dureeMin), champs: champsDuree(d) },
    { cle: 'temps', titre: 'Temps de travail', manque: (x) => x.temps === 'partiel' && (!+x.tps.hebdo || !x.tps.repartition.trim()), champs: champsTemps(d) },
    { cle: 'remuneration', titre: 'Salaire', manque: (x) => !(+x.rem.taux > 0), champs: champsRemuneration(d) },
    { cle: 'organismes', titre: 'Retraite, prévoyance, mutuelle', manque: (x) => cdd(x) && (!x.org.retraite.trim() || !x.org.prevoyance.trim()), intro: 'Repris des réglages (Contrats > Employeurs & organismes). Obligatoires dans un CDD.', champs: champsOrganismes() },
    { cle: 'clauses', titre: 'Clauses', champs: champsClauses(d) },
    { cle: 'fait', titre: 'Titre, lieu et date', champs: champsFait() },
  ];
}

function sectionsAvenant(d, R) {
  const a = (k) => d.av.objets.includes(k);
  const objet = (k, l) => ({ k: 'av.objets', liste: k, l, t: 'case', refait: true });
  return [
    { cle: 'modele', titre: 'L’employeur', champs: champsEmployeur(R) },
    { cle: 'salarie', titre: 'Le salarié', manque: (x) => !x.sal.nom, champs: champsSalarie(d).filter((c) => ['sal.civ', 'sal.nom', 'sal.prenom', 'sal.adresse'].includes(c.k)) },
    { cle: 'contrat', titre: 'Le contrat modifié', champs: [
      { k: 'av.numero', l: 'Avenant n°', demi: true },
      { k: 'av.contratNature', l: 'Contrat d’origine', t: 'liste', o: [['CDI', 'CDI'], ['CDI à temps partiel', 'CDI à temps partiel'], ['CDD', 'CDD'], ['CDD à temps partiel', 'CDD à temps partiel']], demi: true },
      { k: 'av.contratDate', l: 'Signé le', t: 'date', demi: true },
      { k: 'av.effet', l: 'Changement à partir du', t: 'date', demi: true },
      { k: 'poste.intitule', l: 'Poste actuel du salarié' },
    ] },
    { cle: 'objets', titre: 'Ce qui change', intro: 'Cochez un ou plusieurs changements.', champs: [
      objet('duree', 'Durée ou horaires de travail'), objet('remuneration', 'Salaire'), objet('poste', 'Poste ou classification'), objet('lieu', 'Lieu ou zone de travail'),
      objet('complement', 'Heures en plus pour une période (temps partiel)'), objet('renouvellement', 'Renouvellement du CDD'), objet('autre', 'Autre changement'),
      { k: 'av.hebdo', l: 'Nouvelle durée (heures par semaine)', t: 'nombre', si: () => a('duree'), demi: true },
      { k: 'av.repartition', l: 'Nouvelle répartition / horaires', t: 'zone', lignes: 3, si: () => a('duree') },
      { k: 'av.taux', l: 'Nouveau taux horaire brut (€)', t: 'nombre', si: () => a('remuneration'), demi: true },
      { k: 'av.intitule', l: 'Nouveau poste', si: () => a('poste') },
      { k: 'av.qualif', l: 'Nouvelle classification', si: () => a('poste') },
      { k: 'av.lieu', l: 'Nouveau lieu de travail', si: () => a('lieu') },
      { k: 'av.zone', l: 'Nouvelle zone de mobilité', t: 'zone', lignes: 2, si: () => a('lieu') },
      { k: 'av.complHeures', l: 'Heures en plus par semaine', t: 'nombre', si: () => a('complement'), demi: true },
      { k: 'av.complMotif', l: 'Motif', si: () => a('complement'), demi: true, ph: 'ex. remplacement d’un collègue' },
      { k: 'av.complDebut', l: 'Du', t: 'date', si: () => a('complement'), demi: true },
      { k: 'av.complFin', l: 'Au', t: 'date', si: () => a('complement'), demi: true },
      { k: 'av.nouvelleFin', l: 'Nouvelle date de fin du CDD', t: 'date', si: () => a('renouvellement'), demi: true, aide: 'À signer AVANT la fin du CDD en cours.' },
      { k: 'av.autre', l: 'Autre changement', t: 'zone', lignes: 4, si: () => a('autre') },
    ] },
    { cle: 'fait', titre: 'Titre, lieu et date', champs: champsFait() },
  ];
}

function sectionsPrestation(d, R) {
  return [
    { cle: 'modele', titre: 'Le prestataire (BDA)', champs: champsEmployeur(R) },
    { cle: 'client', titre: 'Le client', manque: (x) => !x.cli.nom, champs: [
      { k: 'cli.nom', l: 'Nom du client (société, organisme)' }, { k: 'cli.forme', l: 'Forme', demi: true, ph: 'ex. SAS, association, consulat' }, { k: 'cli.siret', l: 'SIRET', demi: true },
      { k: 'cli.adresse', l: 'Adresse', t: 'zone', lignes: 2 }, { k: 'cli.representant', l: 'Représenté par', demi: true }, { k: 'cli.qualite', l: 'Qualité', demi: true }] },
    { cle: 'mission', titre: 'La mission', champs: [
      { k: 'pr.activite', l: 'Prestation', t: 'liste', o: [['surveillance', 'Surveillance humaine / gardiennage'], ['ssiap', 'Sécurité incendie (SSIAP)'], ['evenementiel', 'Sécurité d’un événement'], ['cynophile', 'Surveillance cynophile']] },
      { k: 'pr.site', l: 'Site (adresse)', t: 'zone', lignes: 2 },
      { k: 'pr.agents', l: 'Nombre d’agents', demi: true }, { k: 'pr.horaires', l: 'Jours et horaires', t: 'zone', lignes: 2, ph: 'ex. du lundi au vendredi, 8 h – 20 h' },
      { k: 'pr.debut', l: 'Début', t: 'date', demi: true },
      { k: 'pr.type', l: 'Durée', t: 'liste', o: [['indeterminee', 'Sans date de fin'], ['determinee', 'Jusqu’à une date']], refait: true, demi: true },
      { k: 'pr.fin', l: 'Fin', t: 'date', si: (x) => x.pr.type === 'determinee', demi: true },
      { k: 'pr.preavis', l: 'Préavis pour arrêter', si: (x) => x.pr.type === 'indeterminee', demi: true }] },
    { cle: 'prix', titre: 'Prix et paiement', champs: [
      { k: 'pr.tarifs', l: 'Tarifs (un par ligne)', t: 'zone', lignes: 4 },
      { k: 'pr.majorations', l: 'Majorations', t: 'zone', lignes: 2 },
      { k: 'pr.tva', l: 'TVA', t: 'zone', lignes: 2 },
      { k: 'pr.paiement', l: 'Paiement à (jours)', t: 'nombre', demi: true },
      { k: 'pr.assurance', l: 'Assurance RC Pro (assureur, n°)', demi: true, ph: 'ex. Hiscox (Orus) n° …' },
      { k: 'pr.revision', l: 'Révision des prix chaque année', t: 'case' },
      { k: 'pr.consignes', l: 'Consignes du site en annexe', t: 'case' },
      { k: 'pr.nonSollicitation', l: 'Le client n’embauche pas nos agents', t: 'case' }] },
    { cle: 'fait', titre: 'Titre, lieu et date', champs: champsFait() },
  ];
}

function sectionsSousTraitance(d, R) {
  return [
    { cle: 'modele', titre: 'BDA', champs: [...champsEmployeur(R), { k: 'st.role', l: 'Dans ce contrat, BDA est', t: 'choix', refait: true, o: [['sous-traitant', 'Le sous-traitant (renfort pour une autre société)'], ['donneur', 'Le donneur d’ordre (BDA confie une mission)']] }] },
    { cle: 'societe', titre: 'L’autre société', manque: (x) => !x.st.nom || !x.st.cnaps, champs: [
      { k: 'st.nom', l: 'Nom' }, { k: 'st.forme', l: 'Forme', demi: true }, { k: 'st.siret', l: 'SIRET', demi: true },
      { k: 'st.adresse', l: 'Adresse', t: 'zone', lignes: 2 },
      { k: 'st.cnaps', l: 'Son autorisation CNAPS', aide: 'À vérifier sur le site du CNAPS avant de signer.' },
      { k: 'st.representant', l: 'Représentée par', demi: true }, { k: 'st.qualite', l: 'Qualité', demi: true }] },
    { cle: 'mission', titre: 'La mission', champs: [
      { k: 'st.activite', l: 'Prestation', t: 'liste', o: [['surveillance', 'Surveillance humaine / gardiennage'], ['ssiap', 'Sécurité incendie (SSIAP)'], ['evenementiel', 'Sécurité d’un événement'], ['cynophile', 'Surveillance cynophile']] },
      { k: 'st.client', l: 'Client final' }, { k: 'st.site', l: 'Site (adresse)', t: 'zone', lignes: 2 },
      { k: 'st.agents', l: 'Nombre et qualification des agents', ph: 'ex. 2 ADS' }, { k: 'st.horaires', l: 'Jours et horaires', t: 'zone', lignes: 2 },
      { k: 'st.debut', l: 'Début', t: 'date', demi: true }, { k: 'st.fin', l: 'Fin (vide = sans date)', t: 'date', demi: true },
      { k: 'st.tarif', l: 'Prix (HT de l’heure)', demi: true, ph: 'ex. 22,00 €' }, { k: 'st.paiement', l: 'Paiement à (jours)', t: 'nombre', demi: true }, { k: 'st.tva', l: 'TVA', t: 'zone', lignes: 2 }] },
    { cle: 'fait', titre: 'Titre, lieu et date', champs: champsFait() },
  ];
}

/* =========================================================
   CONTRÔLES : affichés au-dessus du contrat
   [niveau, texte] — danger (interdit), alerte (à compléter), info
   ========================================================= */
const jour = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? new Date(`${s.slice(0, 10)}T12:00:00`) : null);
export function alertes(d) {
  const A = [];
  const E = d.emp || {};
  if (d.genre === 'prestation' || d.genre === 'soustraitance') {
    if (!E.cnaps) A.push(['danger', 'Le prestataire doit avoir une autorisation d’exercer du CNAPS, à indiquer sur le contrat (art. L612-9 et L612-15 du Code de la sécurité intérieure).']);
    if (d.genre === 'soustraitance' && !d.st.cnaps) A.push(['alerte', 'Indiquez l’autorisation CNAPS de l’autre société et vérifiez-la avant de signer.']);
    return A;
  }
  if (d.genre === 'avenant') {
    if (d.av.objets.includes('renouvellement')) A.push(['info', 'Le renouvellement d’un CDD doit être signé avant la date de fin du CDD en cours. Deux renouvellements au plus, 18 mois au total.']);
    if (d.av.objets.includes('complement')) A.push(['info', 'Les « compléments d’heures » par avenant ne sont possibles que si un accord de branche les prévoit ; sinon ce sont des heures complémentaires majorées.']);
    return A;
  }
  const metierSecu = d.metier === 'securite' || d.metier === 'protection' || (d.metier === 'ssiap' && d.ssiapSurveillance);
  if (metierSecu && !E.cnaps) A.push(['danger', `${E.nom || 'Cet employeur'} n’a pas d’autorisation d’exercer du CNAPS : il ne peut pas employer d’agent de sécurité (art. L612-9 du Code de la sécurité intérieure).`]);
  if (d.metier === 'protection') A.push(['danger', 'L’autorisation de BDA SECURITE couvre seulement la surveillance et le gardiennage. Ce contrat n’est utilisable qu’après une autorisation CNAPS « protection physique des personnes », avec un agent titulaire de la carte correspondante.']);
  if (d.metier === 'vtc' && E.cnaps) A.push(['danger', 'Une entreprise de sécurité privée ne peut exercer aucune autre activité (art. L612-2 du Code de la sécurité intérieure). Le chauffeur VTC doit être employé par une structure sans activité de sécurité : l’EI, une fois son autorisation CNAPS rendue.']);
  if (d.metier === 'vtc' && !E.evtc) A.push(['alerte', 'L’employeur doit être inscrit au registre des VTC : ajoutez son n° EVTC dans Employeurs & organismes.']);
  if (d.genre === 'offre') {
    if (+d.rem.taux > 0 && +d.rem.taux < CCN.smic) A.push(['danger', `Le taux horaire est sous le SMIC (${String(CCN.smic).replace('.', ',')} € brut de l’heure).`]);
    A.push(['info', 'Une fois signée « bon pour accord » par le candidat, cette promesse vaut contrat de travail : l’employeur ne peut plus revenir dessus sans le licencier.']);
    return A;
  }
  const debut = jour(d.duree.debut);
  const finCarte = jour(d.metier === 'vtc' ? d.sal.carteVtcFin : d.sal.carteFin);
  if (finCarte && debut && finCarte < debut) A.push(['danger', 'La carte professionnelle expire avant le début du contrat.']);
  else if (finCarte && finCarte < new Date()) A.push(['danger', 'La carte professionnelle est expirée.']);
  if (metierSecu && !d.sal.carte) A.push(['alerte', 'N° de carte professionnelle à indiquer : pas d’embauche sans carte valide.']);
  if (d.metier === 'vtc' && !d.sal.carteVtc) A.push(['alerte', 'N° de carte VTC à indiquer.']);
  if (d.sal.ue === false && !d.sal.titreSejour) A.push(['alerte', 'Salarié étranger : indiquez son titre de séjour et demandez sa vérification à la préfecture au moins 2 jours ouvrables avant l’embauche.']);
  const sejour = jour(d.sal.titreFin);
  if (d.sal.ue === false && sejour && sejour < (debut || new Date())) A.push(['danger', 'Le titre de séjour est expiré à la date d’embauche.']);
  if (d.temps === 'partiel' && +d.tps.hebdo > 0 && +d.tps.hebdo < CCN.minimumPartiel && !d.tps.demande24 && d.posteCle !== 'evenementiel') A.push(['alerte', `Moins de ${CCN.minimumPartiel} h par semaine : il faut une demande écrite et motivée du salarié (art. L3123-7 du Code du travail), à garder avec le contrat.`]);
  if (d.temps === 'partiel' && !String(d.tps.repartition || '').trim()) A.push(['alerte', 'Temps partiel : la répartition des heures (jours de la semaine) est obligatoire.']);
  if (d.nature === 'CDD') {
    if (d.duree.motif !== 'accroissement' && d.duree.motif !== 'saisonnier' && !d.duree.remplace) A.push(['alerte', 'CDD de remplacement : le nom et le poste du salarié remplacé sont obligatoires.']);
    if ((d.duree.motif === 'accroissement' || d.duree.motif === 'saisonnier') && !String(d.duree.motifDetail || '').trim()) A.push(['alerte', 'Précisez le surcroît d’activité : un motif vague peut faire requalifier le CDD en CDI.']);
    const fin = jour(d.duree.fin);
    if (debut && fin && (fin - debut) / 86400000 > 548) A.push(['danger', 'Un CDD ne peut pas dépasser 18 mois, renouvellements compris.']);
    if (!String(d.org.retraite || '').trim() || !String(d.org.prevoyance || '').trim()) A.push(['alerte', 'CDD : le nom et l’adresse de la caisse de retraite complémentaire et de l’organisme de prévoyance sont obligatoires.']);
    A.push(['info', 'Le CDD signé doit être remis au salarié dans les 2 jours ouvrables qui suivent l’embauche (art. L1242-13 du Code du travail).']);
  }
  if (!(+d.rem.taux > 0)) A.push(['alerte', 'Taux horaire à indiquer.']);
  else if (+d.rem.taux < CCN.smic) A.push(['danger', `Le taux horaire est sous le SMIC (${String(CCN.smic).replace('.', ',')} € brut de l’heure).`]);
  return A;
}
