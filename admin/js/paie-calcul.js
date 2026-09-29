/* =========================================================
   ESPACE ADMIN BDA — fiches de paie : moteur de calcul
   Bulletin « clarifié » d'un salarié non cadre du secteur privé.
   Tous les taux sont modifiables dans Fiches de paie > Paramètres :
   les valeurs par défaut sont à faire confirmer (URSSAF, comptable).
   ========================================================= */

export const HEURES_MENSUELLES = 151.67;
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Taux en % : part salarié (sal) et part employeur (pat)
export const TAUX_DEFAUT = {
  maladie: { sal: 0, pat: 13 },
  maladieReduit: { sal: 0, pat: 7 },
  vieillessePlaf: { sal: 6.9, pat: 8.55 },
  vieillesseDeplaf: { sal: 0.4, pat: 2.02 },
  retraiteT1: { sal: 3.15, pat: 4.72 },
  cegT1: { sal: 0.86, pat: 1.29 },
  retraiteT2: { sal: 8.64, pat: 12.95 },
  cegT2: { sal: 1.08, pat: 1.62 },
  cet: { sal: 0.14, pat: 0.21 },
  famille: { sal: 0, pat: 5.25 },
  familleReduit: { sal: 0, pat: 3.45 },
  chomage: { sal: 0, pat: 4 },
  ags: { sal: 0, pat: 0.25 },
  csa: { sal: 0, pat: 0.3 },
  fnal: { sal: 0, pat: 0.1 },
  fnal50: { sal: 0, pat: 0.5 },
  dialogue: { sal: 0, pat: 0.016 },
  formation: { sal: 0, pat: 0.55 },
  formation11: { sal: 0, pat: 1 },
  apprentissage: { sal: 0, pat: 0.59 },
  csgDed: { sal: 6.8, pat: 0 },
  csgNonDed: { sal: 2.4, pat: 0 },
  crds: { sal: 0.5, pat: 0 },
};
// Libellés des taux pour l'écran Paramètres (sal / pat : colonnes modifiables)
export const LIBELLES_TAUX = [
  ['maladie', 'Maladie (au-dessus du seuil)', false, true],
  ['maladieReduit', 'Maladie (taux réduit, sous le seuil)', false, true],
  ['vieillessePlaf', 'Vieillesse plafonnée', true, true],
  ['vieillesseDeplaf', 'Vieillesse déplafonnée', true, true],
  ['retraiteT1', 'Retraite complémentaire tranche 1', true, true],
  ['cegT1', 'CEG tranche 1', true, true],
  ['retraiteT2', 'Retraite complémentaire tranche 2', true, true],
  ['cegT2', 'CEG tranche 2', true, true],
  ['cet', 'CET (salaire au-dessus du plafond)', true, true],
  ['famille', 'Allocations familiales (au-dessus du seuil)', false, true],
  ['familleReduit', 'Allocations familiales (taux réduit)', false, true],
  ['chomage', 'Assurance chômage', false, true],
  ['ags', 'AGS', false, true],
  ['csa', 'Contribution solidarité autonomie', false, true],
  ['fnal', 'FNAL (moins de 50 salariés)', false, true],
  ['fnal50', 'FNAL (50 salariés et plus)', false, true],
  ['dialogue', 'Contribution au dialogue social', false, true],
  ['formation', 'Formation professionnelle (moins de 11)', false, true],
  ['formation11', 'Formation professionnelle (11 et plus)', false, true],
  ['apprentissage', "Taxe d'apprentissage (part principale)", false, true],
  ['csgDed', 'CSG déductible', true, false],
  ['csgNonDed', 'CSG non déductible', true, false],
  ['crds', 'CRDS', true, false],
];

export const PARAMS_DEFAUT = {
  annee: 2026,
  smicHoraire: 12.02,
  pmss: 4005,
  effectif: 'moins11', // moins11 | 11a19 | 20a49 | 50plus
  employeur: { nom: '', adresse: '', siret: '', ape: '8010Z', urssaf: '', signataire: 'Abdelouahab BOUIDIA', qualite: 'Gérant', ville: 'Paris', convention: 'Convention collective nationale des entreprises de prévention et de sécurité (IDCC 1351)' },
  majorations: { nuit: 10, dimanche: 10, ferie: 100 },
  panier: 0,
  tauxAT: 0,
  tauxMobilite: 3.2,
  mutuelle: { sal: 0, pat: 0 },
  prevoyance: { sal: 0, pat: 0 },
  seuilMaladie: 2.25,
  seuilFamille: 3.3,
  reductionHSMax: 11.31,
  deductionHS: 1.5,
  reduction: { active: true, formule: 'fillon', t: 0.32015, t50: 0.32415, tmin: 0.02, tdelta: 0.3781, tdelta50: 0.3821, p: 1.75 },
  taux: TAUX_DEFAUT,
};
// Fusion des paramètres enregistrés avec les valeurs par défaut (niveau par niveau)
export function completerParams(p) {
  const P = JSON.parse(JSON.stringify(PARAMS_DEFAUT));
  if (!p || typeof p !== 'object') return P;
  for (const [k, v] of Object.entries(p)) {
    if (k === 'taux' && v && typeof v === 'object') {
      for (const [c, t] of Object.entries(v)) if (P.taux[c] && t) P.taux[c] = { ...P.taux[c], ...t };
    } else if (v && typeof v === 'object' && !Array.isArray(v) && P[k] && typeof P[k] === 'object') P[k] = { ...P[k], ...v };
    else if (v !== undefined && v !== null) P[k] = v;
  }
  return P;
}

export const PROFIL_DEFAUT = {
  // Identité (registre unique du personnel)
  sexe: '', dateNaissance: '', lieuNaissance: '', nationalite: 'Française', ue: true, titreSejour: '', titreSejourNumero: '', titreSejourFin: '',
  adresse: '', nir: '', matricule: '',
  // Contrat
  emploi: 'Agent de sécurité (ADS)', qualification: '', statut: 'Non cadre', contrat: 'CDI', dateEntree: '', dateFin: '',
  mode: 'mensuel', heuresContrat: HEURES_MENSUELLES, tauxHoraire: 0, heuresJour: 7,
  // Impôt, mutuelle, frais, congés
  tauxPas: '', navigo: 0, mutuelle: true, dispenseMutuelle: '', soldeCP: 0, modePaiement: 'Virement',
  // Départ
  dateSortie: '', motifSortie: '',
};
// Organisme qui encaisse chaque cotisation (récapitulatif pour la DSN)
const ORGANISME = { retraiteT1: 'retraite', cegT1: 'retraite', retraiteT2: 'retraite', cegT2: 'retraite', cet: 'retraite', prevoyance: 'prevoyance', mutuelle: 'mutuelle' };
export const ORGANISMES = { urssaf: 'URSSAF', retraite: 'Retraite complémentaire (Agirc-Arrco)', prevoyance: 'Prévoyance', mutuelle: 'Mutuelle' };

// Grille du taux neutre du prélèvement à la source (métropole), par tranche de net imposable mensuel
export const GRILLE_NEUTRE = [
  [1620, 0], [1683, 0.5], [1791, 1.3], [1911, 2.1], [2042, 2.9], [2151, 3.5], [2294, 4.1], [2714, 5.3], [3107, 7.5], [3539, 9.9],
  [3983, 11.9], [4648, 13.8], [5574, 15.8], [6974, 17.9], [8711, 20], [12091, 24], [16376, 28], [25706, 33], [55062, 38], [Infinity, 43],
];
export const tauxNeutre = (base) => (GRILLE_NEUTRE.find(([plafond]) => base < plafond) || [0, 43])[1];

export const VARIABLES_DEFAUT = {
  heuresTravaillees: 0, heuresNuit: 0, heuresDimanche: 0, heuresFerie: 0, hs25: 0, hs50: 0,
  joursCP: 0, joursMaladie: 0, joursAbsence: 0, paniers: 0, cpAcquis: 2.5, acompte: 0, primes: [], modePaiement: '',
};

const n = (v) => (Number.isFinite(+v) ? +v : 0);

/* ---------------------------------------------------------
   Calcul complet d'un bulletin
   v : variables du mois · profil : dossier du salarié · P : paramètres
   cumuls : totaux des bulletins validés précédents (année en cours)
   --------------------------------------------------------- */
export function calculerBulletin(v0, profil0, P0, cumuls = {}) {
  const P = completerParams(P0);
  const v = { ...VARIABLES_DEFAUT, ...(v0 || {}) };
  const pr = { ...PROFIL_DEFAUT, ...(profil0 || {}) };
  const T = P.taux;
  const th = n(pr.tauxHoraire);
  const hj = n(pr.heuresJour) || 7;
  const alertes = [];

  /* ----- Rémunération brute ----- */
  const gains = [];
  const gain = (libelle, base, taux, montant, cle) => { if (montant) gains.push({ libelle, base, taux, montant: r2(montant), cle }); return r2(montant); };
  const hs25 = n(v.hs25), hs50 = n(v.hs50);
  let heuresPayees;
  if (pr.mode === 'horaire') {
    const hn = Math.max(0, n(v.heuresTravaillees) - hs25 - hs50);
    gain('Salaire de base (heures réalisées)', hn, th, hn * th, 'base');
    const hcp = n(v.joursCP) * hj;
    gain('Indemnité de congés payés', hcp, th, hcp * th, 'cp');
    heuresPayees = hn + hcp;
  } else {
    const hc = n(pr.heuresContrat) || HEURES_MENSUELLES;
    gain('Salaire de base', hc, th, hc * th, 'base');
    const hAbs = n(v.joursAbsence) * hj, hMal = n(v.joursMaladie) * hj;
    gain('Absence non rémunérée', hAbs, th, -hAbs * th, 'absence');
    gain('Absence maladie', hMal, th, -hMal * th, 'maladie');
    heuresPayees = Math.max(0, hc - hAbs - hMal);
  }
  const montantHS = gain('Heures supplémentaires à 25 %', hs25, r2(th * 1.25), hs25 * th * 1.25, 'hs25')
    + gain('Heures supplémentaires à 50 %', hs50, r2(th * 1.5), hs50 * th * 1.5, 'hs50');
  const M = P.majorations;
  gain(`Majoration heures de nuit (${n(M.nuit)} %)`, n(v.heuresNuit), r2((th * n(M.nuit)) / 100), (n(v.heuresNuit) * th * n(M.nuit)) / 100, 'nuit');
  gain(`Majoration heures du dimanche (${n(M.dimanche)} %)`, n(v.heuresDimanche), r2((th * n(M.dimanche)) / 100), (n(v.heuresDimanche) * th * n(M.dimanche)) / 100, 'dimanche');
  gain(`Majoration jours fériés (${n(M.ferie)} %)`, n(v.heuresFerie), r2((th * n(M.ferie)) / 100), (n(v.heuresFerie) * th * n(M.ferie)) / 100, 'ferie');
  (v.primes || []).filter((p) => p && p.soumis !== false && n(p.montant)).forEach((p) => gain(p.libelle || 'Prime', '', '', n(p.montant), 'prime'));
  const brut = r2(gains.reduce((s, g) => s + g.montant, 0));

  /* ----- Bases ----- */
  const pmss = n(P.pmss);
  const smicRef = n(P.smicHoraire) * (heuresPayees + hs25 + hs50);
  const T1 = Math.min(brut, pmss), T2 = Math.max(0, Math.min(brut, 8 * pmss) - pmss), b4 = Math.min(brut, 4 * pmss);
  const moins50 = P.effectif !== '50plus', moins11 = P.effectif === 'moins11', moins20 = ['moins11', '11a19'].includes(P.effectif);

  /* ----- Cotisations ----- */
  const lignes = [];
  const cot = (rubrique, libelle, base, taux, cle) => {
    // taux : { sal, pat } ou une liste de taux (chaque part arrondie à part, comme TESE pour la retraite)
    const liste = Array.isArray(taux) ? taux : [taux];
    const tS = r2(liste.reduce((s, t) => s + n(t?.sal), 0) * 1000) / 1000, tP = r2(liste.reduce((s, t) => s + n(t?.pat), 0) * 1000) / 1000;
    const sal = r2(liste.reduce((s, t) => s + r2((base * n(t?.sal)) / 100), 0)), pat = r2(liste.reduce((s, t) => s + r2((base * n(t?.pat)) / 100), 0));
    if (!sal && !pat) return { sal: 0, pat: 0 };
    const l = { rubrique, libelle, base: r2(base), tauxSal: tS, sal, tauxPat: tP, pat, cle };
    lignes.push(l);
    return l;
  };
  // Lignes regroupées comme sur les bulletins TESE (un seul arrondi par ligne)
  const somme = (...ts) => ({ sal: r2(ts.reduce((s, t) => s + n(t?.sal), 0) * 10000) / 10000, pat: r2(ts.reduce((s, t) => s + n(t?.pat), 0) * 10000) / 10000 });
  if (!n(P.tauxAT)) alertes.push('Taux accidents du travail (AT/MP) à renseigner dans les paramètres.');
  // Sécurité sociale : maladie, vieillesse déplafonnée, famille, accidents du travail, solidarité autonomie
  cot('secu', 'Cotisations sur la totalité du salaire', brut, somme(
    smicRef && brut <= n(P.seuilMaladie) * smicRef ? T.maladieReduit : T.maladie, T.vieillesseDeplaf,
    smicRef && brut <= n(P.seuilFamille) * smicRef ? T.familleReduit : T.famille, { pat: P.tauxAT }, T.csa), 'totalite');
  cot('secu', 'Cotisations plafonnées', T1, T.vieillessePlaf, 'plafonnees');
  // Complémentaire santé et prévoyance (selon le contrat de l'entreprise)
  const prev = cot('sante', 'Prévoyance (incapacité, invalidité, décès)', T1, P.prevoyance, 'prevoyance');
  let mutPat = 0;
  if (pr.mutuelle !== false && (n(P.mutuelle.sal) || n(P.mutuelle.pat))) {
    mutPat = r2(n(P.mutuelle.pat));
    lignes.push({ rubrique: 'sante', libelle: 'Complémentaire santé (mutuelle)', base: '', tauxSal: '', sal: r2(n(P.mutuelle.sal)), tauxPat: '', pat: mutPat, cle: 'mutuelle' });
  }
  // Assurance chômage
  cot('chomage', 'Chômage + AGS', b4, [T.chomage, T.ags], 'chomage');
  // Retraite complémentaire obligatoire (Agirc-Arrco)
  cot('retraite', 'Retraite complémentaire + CEG T1', T1, [T.retraiteT1, T.cegT1], 'retraiteT1');
  if (T2 > 0) {
    cot('retraite', 'Retraite complémentaire + CEG T2', T2, [T.retraiteT2, T.cegT2], 'retraiteT2');
    cot('retraite', 'Contribution d’équilibre technique', Math.min(brut, 8 * pmss), T.cet, 'cet');
  }
  // Autres cotisations (employeur)
  if (moins50) cot('autres', 'FNAL plafonné', T1, T.fnal, 'fnal'); else cot('autres', 'FNAL déplafonné', brut, T.fnal50, 'fnal');
  cot('autres', 'Contribution formation professionnelle', brut, moins11 ? T.formation : T.formation11, 'formation');
  cot('autres', 'Taxe d’apprentissage - Part principale', brut, T.apprentissage, 'apprentissage');
  if (!moins11) cot('autres', 'Versement mobilité', brut, { pat: P.tauxMobilite }, 'mobilite');
  // CSG / CRDS : 98,25 % du brut (jusqu'à 4 plafonds) + part patronale prévoyance et mutuelle
  const baseCsg = r2(0.9825 * b4 + (brut - b4) + n(prev.pat) + mutPat);
  cot('csg', 'CSG déductible de l’impôt sur le revenu', baseCsg, T.csgDed, 'csgDed');
  cot('csgnd', 'CSG non déductible de l’impôt sur le revenu', baseCsg, T.csgNonDed, 'csgNonDed');
  cot('csgnd', 'CRDS non déductible de l’impôt sur le revenu', baseCsg, T.crds, 'crds');

  // Exonérations et allègements
  const tauxSalHS = n(T.vieillessePlaf.sal) + n(T.vieillesseDeplaf.sal) + n(T.retraiteT1.sal) + n(T.cegT1.sal);
  const tauxReducHS = Math.min(n(P.reductionHSMax), tauxSalHS);
  const reducHS = r2((montantHS * tauxReducHS) / 100);
  if (reducHS) lignes.push({ rubrique: 'exo', libelle: 'Réduction de cotisations salariales (heures supplémentaires)', base: montantHS, tauxSal: -tauxReducHS, sal: -reducHS, tauxPat: '', pat: 0, cle: 'reducHS' });
  let reducGen = 0;
  const R = P.reduction;
  // Formule « fillon » (celle de TESE en 2026) : C = T / 0,6 × (1,6 × SMIC / brut − 1), jusqu'à 1,6 SMIC.
  // Formule « degressive » : C = Tmin + Tdelta × [½ × (3 × SMIC / brut − 1)]^P, jusqu'à 3 SMIC.
  const fillon = R.formule !== 'degressive';
  if (R.active && brut > 0 && smicRef > 0 && brut < (fillon ? 1.6 : 3) * smicRef) {
    let c;
    if (fillon) {
      const t = moins50 ? n(R.t) : n(R.t50);
      c = Math.min(t, (t / 0.6) * ((1.6 * smicRef) / brut - 1));
    } else {
      const tdelta = moins50 ? n(R.tdelta) : n(R.tdelta50);
      c = Math.min(n(R.tmin) + tdelta, n(R.tmin) + tdelta * Math.pow(0.5 * ((3 * smicRef) / brut - 1), n(R.p)));
    }
    const coef = Math.round(c * 1000000) / 1000000; // coefficient non arrondi à 4 décimales, comme TESE
    const patEligibles = lignes.filter((l) => !['prevoyance', 'mutuelle', 'formation', 'apprentissage', 'mobilite', 'dialogue', 'cet', 'retraiteT2', 'cegT2'].includes(l.cle) && l.pat > 0).reduce((s, l) => s + l.pat, 0);
    reducGen = r2(Math.min(coef * brut, patEligibles));
    if (reducGen) lignes.push({ rubrique: 'autres', libelle: 'Réduction générale des cotisations', base: brut, tauxSal: '', sal: 0, tauxPat: -r2(coef * 100), pat: -reducGen, cle: 'reducGen' });
  }
  cot('autres', 'Contribution au dialogue social', brut, T.dialogue, 'dialogue');
  const dedHS = moins20 ? r2(n(P.deductionHS) * (hs25 + hs50)) : 0;
  if (dedHS) lignes.push({ rubrique: 'exo', libelle: 'Déduction forfaitaire patronale (heures supplémentaires)', base: hs25 + hs50, tauxSal: '', sal: 0, tauxPat: '', pat: -dedHS, cle: 'dedHS' });

  /* ----- Totaux ----- */
  const totalSal = r2(lignes.reduce((s, l) => s + n(l.sal), 0));
  const totalPat = r2(lignes.reduce((s, l) => s + n(l.pat), 0));
  const netAvantImpot = r2(brut - totalSal);
  const csgNonDed = r2(lignes.filter((l) => l.rubrique === 'csgnd').reduce((s, l) => s + l.sal, 0));
  const csgDedHS = (montantHS * 0.9825 * n(T.csgDed.sal)) / 100;
  const hsExo = montantHS ? r2(montantHS - csgDedHS - Math.max(0, (montantHS * (tauxSalHS - tauxReducHS)) / 100)) : 0;
  const netImposable = r2(Math.max(0, netAvantImpot + csgNonDed + mutPat - hsExo));
  const persoPas = String(pr.tauxPas ?? '').trim() !== '' && Number.isFinite(+String(pr.tauxPas).replace(',', '.'));
  const tauxPas = persoPas ? +String(pr.tauxPas).replace(',', '.') : tauxNeutre(netImposable);
  const pas = r2((netImposable * tauxPas) / 100);

  const nonSoumis = [];
  if (n(v.paniers) && n(P.panier)) nonSoumis.push({ libelle: 'Indemnités de panier', base: n(v.paniers), taux: n(P.panier), montant: r2(n(v.paniers) * n(P.panier)) });
  if (n(pr.navigo)) nonSoumis.push({ libelle: 'Remboursement frais de transport (50 %)', base: '', taux: '', montant: r2(n(pr.navigo)) });
  (v.primes || []).filter((p) => p && p.soumis === false && n(p.montant)).forEach((p) => nonSoumis.push({ libelle: p.libelle || 'Indemnité', base: '', taux: '', montant: r2(n(p.montant)) }));
  const totalNonSoumis = r2(nonSoumis.reduce((s, x) => s + x.montant, 0));
  const acompte = r2(n(v.acompte));
  const netPaye = r2(netAvantImpot - pas + totalNonSoumis - acompte);
  const netSocial = r2(netAvantImpot + mutPat + n(prev.pat));
  // Mention obligatoire : gain lié à la suppression des cotisations salariales chômage (2,40 %) et maladie (0,75 %), moins la hausse de CSG (1,7 %)
  const evolution = r2((brut * 3.15) / 100 - (baseCsg * 1.7) / 100);
  const allegements = r2(reducGen + dedHS);
  const coutEmployeur = r2(brut + totalPat + totalNonSoumis);

  /* ----- Congés payés et cumuls de l'année ----- */
  const cpAcquis = n(v.cpAcquis), cpPris = n(v.joursCP);
  const cpSolde = r2(n(pr.soldeCP) + n(cumuls.cpNet) + cpAcquis - cpPris);
  const heuresMois = r2(pr.mode === 'horaire' ? n(v.heuresTravaillees) : heuresPayees + hs25 + hs50);
  const annee = {
    brut: r2(n(cumuls.brut) + brut), netImposable: r2(n(cumuls.netImposable) + netImposable),
    pas: r2(n(cumuls.pas) + pas), heures: r2(n(cumuls.heures) + heuresMois),
  };

  if (!th) alertes.push('Taux horaire du salarié à renseigner (dossier de paie).');
  else if (th < n(P.smicHoraire)) alertes.push(`Taux horaire (${th} €) inférieur au SMIC (${n(P.smicHoraire)} €).`);
  if (!pr.nir) alertes.push('N° de sécurité sociale du salarié manquant.');
  if (!P.employeur?.siret) alertes.push("SIRET de l'employeur à renseigner dans les paramètres.");
  if (!persoPas) alertes.push('Prélèvement à la source au taux neutre : indiquez le taux personnalisé transmis par les impôts (retour DSN).');
  if (netPaye < 0) alertes.push('Le net à payer est négatif : vérifiez les absences et l’acompte.');

  // Ventilation par organisme (les allègements sont imputés sur l'URSSAF)
  const organismes = {};
  lignes.forEach((l) => {
    const o = ORGANISME[l.cle] || 'urssaf';
    organismes[o] ??= { sal: 0, pat: 0 };
    organismes[o].sal = r2(organismes[o].sal + n(l.sal));
    organismes[o].pat = r2(organismes[o].pat + n(l.pat));
  });

  return {
    organismes, evolution, modePaiement: v.modePaiement || pr.modePaiement || 'Virement',
    gains, brut, lignes, totalSal, totalPat, netAvantImpot, netImposable, tauxPas, pasPerso: persoPas, pas,
    nonSoumis, totalNonSoumis, acompte, netPaye, netSocial, allegements, coutEmployeur,
    heuresMois, smicRef: r2(smicRef), cp: { acquis: cpAcquis, pris: cpPris, solde: cpSolde }, annee, alertes,
  };
}
