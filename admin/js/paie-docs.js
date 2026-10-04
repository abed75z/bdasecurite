/* =========================================================
   ESPACE ADMIN BDA — fiches de paie : documents
   Registre unique du personnel, récapitulatif des cotisations
   (pour la DSN), virements des salaires, journal de paie annuel,
   certificat de travail. Tous en PDF ou à imprimer.
   ========================================================= */
import { api, h, icone, erreur, isoVersFr, iso, fr, fmtHeures } from './outils.js';
import { telechargerPdf } from './pdf.js';
import { imprimerFeuille } from './documents.js';
import { PROFIL_DEFAUT, ORGANISMES } from './paie-calcul.js';
import { fmtE, fmtT, libelleMois, moisCourant, decaler, onglets, parametresComplets, ajusterZoom } from './paie-commun.js';

const DOCS = [
  ['cotisations', 'facture', 'Récapitulatif des cotisations', 'Ce que vous devez déclarer et payer pour le mois : URSSAF, retraite, prévoyance, impôt à la source.'],
  ['virements', 'euro', 'Virements des salaires', 'La liste des nets à payer du mois, salarié par salarié.'],
  ['journal', 'tableau', 'Journal de paie', 'Tous les bulletins validés de l’année, avec les totaux.'],
  ['registre', 'clients', 'Registre du personnel', 'Obligatoire dans toute entreprise : entrées, sorties, emplois, contrats.'],
  ['certificat', 'devis', 'Certificat de travail', 'À remettre au salarié qui quitte l’entreprise.'],
];

export async function pageDocuments(ctx, params) {
  const [type, arg] = params;
  if (!type) return hub(ctx);
  const prm = await api('paie.parametres');
  const P = parametresComplets(prm.parametres, prm.entreprise);
  if (type === 'cotisations') return docCotisations(ctx, P, /^\d{4}-\d{2}$/.test(arg || '') ? arg : moisCourant());
  if (type === 'virements') return docVirements(ctx, P, /^\d{4}-\d{2}$/.test(arg || '') ? arg : moisCourant());
  if (type === 'journal') return docJournal(ctx, P, /^\d{4}$/.test(arg || '') ? arg : String(new Date().getFullYear()));
  if (type === 'registre') return docRegistre(ctx, P);
  if (type === 'certificat') return docCertificat(ctx, P, +arg || 0);
  return hub(ctx);
}

function hub(ctx) {
  ctx.titre('Fiches de paie');
  ctx.afficher(onglets('documents'),
    h('div', { class: 'outils paie-docs' }, DOCS.map(([cle, ic, titre, texte]) => h('a', { class: 'outil outil--lien', href: `#/paie/documents/${cle}` },
      h('span', { class: 'outil__ic' }, icone(ic)), h('h2', null, titre), h('p', null, texte), h('span', { class: 'lien-btn' }, 'Ouvrir', icone('suivant'))))));
}

/* ---------- Cadre commun : sélecteur, feuille, PDF, impression ---------- */
function afficherDoc(ctx, { titre, nomFichier, paysage, outils, contenu }) {
  const feuille = h('div', { class: `feuille doc-paie ${paysage ? 'feuille--paysage doc-paie--paysage' : ''}` }, contenu);
  ctx.titre(titre);
  ctx.actions(h('a', { class: 'btn btn--ghost', href: '#/paie/documents' }, icone('retour'), h('span', null, 'Documents')),
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => imprimerFeuille(nomFichier, paysage) }, icone('imprimer'), h('span', null, 'Imprimer')),
    h('button', { class: 'btn btn--gold', type: 'button', onclick: async () => { try { await telechargerPdf(feuille, nomFichier, { paysage }); } catch (e) { erreur(e); } } }, icone('telecharger'), h('span', null, 'PDF')));
  const zone = h('div', { class: `feuille-zone ${paysage ? 'feuille-zone--paysage' : ''}` }, feuille);
  ctx.afficher(onglets('documents'), outils ? h('div', { class: 'plan-outils doc-outils' }, outils) : null, zone);
  ajusterZoom(zone, feuille);
}
const enTete = (P, titre, sous) => h('div', { class: 'doc-tete' },
  h('img', { class: 'bp-logo', src: 'logo-document.jpg?v=3', alt: '' }),
  h('div', { class: 'doc-tete__emp' }, h('b', { class: 'bp-nom' }, P.employeur.nom), String(P.employeur.adresse || '').split('\n').filter(Boolean).map((l) => h('div', null, l)),
    h('div', null, [P.employeur.siret ? `SIRET ${P.employeur.siret}` : '', P.employeur.urssaf ? `URSSAF ${P.employeur.urssaf}` : ''].filter(Boolean).join(' · '))),
  h('div', { class: 'doc-tete__titre' }, h('h2', null, titre), sous ? h('div', { class: 'bp-periode' }, sous) : null));
const navMois = (base, mois) => [
  h('a', { class: 'icon-btn', href: `#/paie/documents/${base}/${decaler(mois, -1)}`, 'aria-label': 'Mois précédent' }, icone('retour')),
  h('b', { class: 'doc-outils__mois' }, libelleMois(mois)),
  h('a', { class: 'icon-btn', href: `#/paie/documents/${base}/${decaler(mois, 1)}`, 'aria-label': 'Mois suivant' }, icone('suivant'))];
const table = (entetes, lignes, pied) => h('table', { class: 'bp-table doc-table' },
  h('thead', null, h('tr', null, entetes.map(([t, r]) => h('th', { class: r ? 'r' : '' }, t)))),
  h('tbody', null, lignes.length ? lignes : h('tr', null, h('td', { colspan: entetes.length, class: 'doc-vide' }, 'Aucun bulletin validé pour cette période.'))),
  pied ? h('tfoot', null, pied) : null);
const ligne = (cells) => h('tr', null, cells.map(([v, r]) => h('td', { class: r ? 'r' : '' }, v)));
const signature = (P, texte) => h('div', { class: 'doc-signature' }, h('p', null, texte || `Fait à ${P.employeur.ville || 'Paris'}, le ${fr(new Date())}.`),
  h('p', null, h('b', null, P.employeur.signataire || ''), h('br'), P.employeur.qualite || ''), h('div', { class: 'doc-signature__zone' }, 'Signature et cachet'));

/* ---------- Récapitulatif des cotisations du mois ---------- */
async function docCotisations(ctx, P, mois) {
  const { bulletins } = await api('paie.bulletins', undefined, { mois, complet: 1 });
  const valides = bulletins.filter((b) => b.statut === 'valide' && b.data?.resultat);
  const org = {};
  let pas = 0, brut = 0, net = 0;
  valides.forEach((b) => {
    const r = b.data.resultat;
    brut += +r.brut || 0; net += +r.netPaye || 0; pas += +r.pas || 0;
    Object.entries(r.organismes || { urssaf: { sal: r.totalSal, pat: r.totalPat } }).forEach(([k, v]) => {
      org[k] ??= { sal: 0, pat: 0 };
      org[k].sal += +v.sal || 0; org[k].pat += +v.pat || 0;
    });
  });
  const r2 = (x) => Math.round(x * 100) / 100;
  const totalOrg = Object.values(org).reduce((s, v) => s + v.sal + v.pat, 0);
  const [y, m] = mois.split('-').map(Number);
  const echeance = new Date(y, m, P.effectif === '50plus' ? 5 : 15);
  const brouillons = bulletins.length - valides.length;
  afficherDoc(ctx, {
    titre: 'Récapitulatif des cotisations', nomFichier: `Cotisations ${libelleMois(mois)}`, outils: navMois('cotisations', mois),
    contenu: [
      enTete(P, 'Récapitulatif des cotisations', `Salaires — ${libelleMois(mois)}`),
      h('div', { class: 'doc-chiffres' },
        h('div', null, h('span', null, 'Bulletins validés'), h('b', null, String(valides.length))),
        h('div', null, h('span', null, 'Masse salariale brute'), h('b', null, fmtE(brut))),
        h('div', null, h('span', null, 'Nets payés'), h('b', null, fmtE(net))),
        h('div', null, h('span', null, 'DSN à envoyer avant le'), h('b', null, isoVersFr(iso(echeance))))),
      brouillons ? h('p', { class: 'doc-note' }, `${brouillons} déclaration${brouillons > 1 ? 's' : ''} encore en cours : validez-les pour qu’elles comptent ici.`) : null,
      table([['Organisme'], ['Part salarié', 1], ['Part employeur', 1], ['Total à payer', 1]],
        [...Object.entries(ORGANISMES).filter(([k]) => org[k]).map(([k, lib]) => ligne([[lib], [fmtE(r2(org[k].sal)), 1], [fmtE(r2(org[k].pat)), 1], [h('b', null, fmtE(r2(org[k].sal + org[k].pat))), 1]])),
          ...(valides.length ? [ligne([['Impôt prélevé à la source (DGFiP)'], [fmtE(r2(pas)), 1], ['', 1], [h('b', null, fmtE(r2(pas))), 1]])] : [])],
        valides.length ? h('tr', null, h('td', null, 'Total à reverser'), h('td', { class: 'r' }, ''), h('td', { class: 'r' }, ''), h('td', { class: 'r' }, fmtE(r2(totalOrg + pas)))) : null),
      h('h3', { class: 'doc-sous' }, 'Détail par salarié'),
      table([['Salarié'], ['Brut', 1], ['Cot. salariales', 1], ['Cot. patronales', 1], ['Impôt', 1], ['Net payé', 1]],
        valides.map((b) => { const r = b.data.resultat; return ligne([[b.nom || 'Agent supprimé'], [fmtE(r.brut), 1], [fmtE(r.totalSal), 1], [fmtE(r.totalPat), 1], [fmtE(r.pas), 1], [fmtE(r.netPaye), 1]]); })),
      h('p', { class: 'doc-note' }, 'Ces montants se déclarent dans la DSN du mois (net-entreprises.fr). Les cotisations URSSAF, la retraite complémentaire et l’impôt à la source sont prélevés à partir de cette déclaration. Mutuelle et prévoyance : selon votre contrat.'),
    ],
  });
}

/* ---------- Virements des salaires du mois ---------- */
async function docVirements(ctx, P, mois) {
  const { bulletins } = await api('paie.bulletins', undefined, { mois, complet: 1 });
  const valides = bulletins.filter((b) => b.statut === 'valide');
  const total = Math.round(valides.reduce((s, b) => s + (+b.net || 0), 0) * 100) / 100;
  afficherDoc(ctx, {
    titre: 'Virements des salaires', nomFichier: `Virements salaires ${libelleMois(mois)}`, outils: navMois('virements', mois),
    contenu: [
      enTete(P, 'Paiement des salaires', libelleMois(mois)),
      table([['Salarié'], ['Mode'], ['Date'], ['Net à payer', 1]],
        valides.map((b) => ligne([[b.nom || 'Agent supprimé'], [b.data?.resultat?.modePaiement || b.data?.profil?.modePaiement || 'Virement'], [isoVersFr(b.data?.datePaiement) || '—'], [h('b', null, fmtE(b.net)), 1]])),
        valides.length ? h('tr', null, h('td', { colspan: 3 }, `Total (${valides.length} salarié${valides.length > 1 ? 's' : ''})`), h('td', { class: 'r' }, fmtE(total))) : null),
      h('p', { class: 'doc-note' }, 'Faites les virements depuis votre banque avec le libellé « Salaire ' + libelleMois(mois).toLowerCase() + ' ». Seuls les bulletins validés apparaissent ici.'),
    ],
  });
}

/* ---------- Journal de paie de l'année ---------- */
async function docJournal(ctx, P, annee) {
  const { bulletins } = await api('paie.bulletins', undefined, { annee, complet: 1 });
  const valides = bulletins.filter((b) => b.statut === 'valide' && b.data?.resultat);
  const T = { heures: 0, brut: 0, sal: 0, imposable: 0, pas: 0, net: 0, pat: 0, cout: 0 };
  const lignes = valides.map((b) => {
    const r = b.data.resultat;
    T.heures += +r.heuresMois || 0; T.brut += +r.brut || 0; T.sal += +r.totalSal || 0; T.imposable += +r.netImposable || 0;
    T.pas += +r.pas || 0; T.net += +r.netPaye || 0; T.pat += +r.totalPat || 0; T.cout += +r.coutEmployeur || 0;
    return ligne([[libelleMois(b.mois)], [b.nom || 'Agent supprimé'], [fmtHeures(+r.heuresMois || 0), 1], [fmtE(r.brut), 1], [fmtE(r.totalSal), 1], [fmtE(r.netImposable), 1], [fmtE(r.pas), 1], [fmtE(r.netPaye), 1], [fmtE(r.totalPat), 1], [fmtE(r.coutEmployeur), 1]]);
  });
  const an = +annee;
  afficherDoc(ctx, {
    titre: 'Journal de paie', nomFichier: `Journal de paie ${annee}`, paysage: true,
    outils: [h('a', { class: 'icon-btn', href: `#/paie/documents/journal/${an - 1}`, 'aria-label': 'Année précédente' }, icone('retour')), h('b', { class: 'doc-outils__mois' }, annee),
      h('a', { class: 'icon-btn', href: `#/paie/documents/journal/${an + 1}`, 'aria-label': 'Année suivante' }, icone('suivant'))],
    contenu: [
      enTete(P, 'Journal de paie', `Année ${annee}`),
      table([['Mois'], ['Salarié'], ['Heures', 1], ['Brut', 1], ['Cot. sal.', 1], ['Net imposable', 1], ['Impôt', 1], ['Net payé', 1], ['Cot. pat.', 1], ['Coût total', 1]], lignes,
        valides.length ? h('tr', null, h('td', { colspan: 2 }, `Total ${annee}`), ...[fmtHeures(T.heures), fmtE(T.brut), fmtE(T.sal), fmtE(T.imposable), fmtE(T.pas), fmtE(T.net), fmtE(T.pat), fmtE(T.cout)].map((v) => h('td', { class: 'r' }, v))) : null),
    ],
  });
}

/* ---------- Registre unique du personnel ---------- */
async function docRegistre(ctx, P) {
  const { agents } = await api('paie.salaries');
  const tri = agents.map((a) => ({ a, p: { ...PROFIL_DEFAUT, ...(a.profil || {}) } }))
    .filter(({ p }) => p.dateEntree)
    .sort((x, y) => x.p.dateEntree.localeCompare(y.p.dateEntree));
  const sansDate = agents.filter((a) => !a.profil?.dateEntree).map((a) => a.nom);
  afficherDoc(ctx, {
    titre: 'Registre du personnel', nomFichier: 'Registre unique du personnel', paysage: true,
    contenu: [
      enTete(P, 'Registre unique du personnel', `Mis à jour le ${fr(new Date())}`),
      table([['N°'], ['Nom et prénom'], ['Sexe'], ['Né(e) le'], ['Nationalité'], ['Emploi'], ['Qualification'], ['Contrat'], ['Entrée'], ['Sortie'], ['Titre de travail (étrangers)']],
        tri.map(({ a, p }, i) => ligne([[String(i + 1)], [h('b', null, a.nom)], [p.sexe === 'F' ? 'F' : p.sexe === 'H' ? 'M' : '—'], [isoVersFr(p.dateNaissance) || '—'], [p.nationalite || '—'],
          [p.emploi], [p.qualification || '—'], [p.contrat], [isoVersFr(p.dateEntree)], [isoVersFr(p.dateSortie) || '—'],
          [p.ue === false ? [p.titreSejour, p.titreSejourNumero, p.titreSejourFin ? `jusqu’au ${isoVersFr(p.titreSejourFin)}` : ''].filter(Boolean).join(' · ') || 'À renseigner' : '—']]))),
      sansDate.length ? h('p', { class: 'doc-note doc-note--ecran' }, `Pas encore au registre (date d’entrée manquante) : ${sansDate.join(', ')}.`) : null,
      h('p', { class: 'doc-note' }, 'Registre tenu par ordre d’embauche (articles L. 1221-13 et D. 1221-23 du Code du travail). Il doit être conservé 5 ans après le départ de chaque salarié.'),
    ],
  });
}

/* ---------- Certificat de travail ---------- */
async function docCertificat(ctx, P, agentId) {
  const { agents } = await api('paie.salaries');
  const choix = h('select', { class: 'input input--auto', onchange: () => ctx.aller(`#/paie/documents/certificat/${choix.value}`) },
    h('option', { value: '' }, 'Choisir un salarié…'), agents.map((a) => h('option', { value: a.id, selected: +a.id === agentId }, a.nom)));
  const agent = agents.find((a) => +a.id === agentId);
  const p = { ...PROFIL_DEFAUT, ...(agent?.profil || {}) };
  const civ = p.sexe === 'F' ? 'Madame' : p.sexe === 'H' ? 'Monsieur' : 'M./Mme';
  const e = p.sexe === 'F' ? 'e' : p.sexe === 'H' ? '' : '(e)';
  const manque = agent && (!p.dateEntree || !p.dateSortie);
  afficherDoc(ctx, {
    titre: 'Certificat de travail', nomFichier: `Certificat de travail - ${agent?.nom || ''}`, outils: [choix,
      manque ? h('span', { class: 'astuce' }, 'Indiquez les dates d’entrée et de sortie dans ', h('a', { class: 'lien-btn', href: `#/paie/salarie/${agentId}` }, 'son dossier'), '.') : null],
    contenu: agent ? [
      enTete(P, 'Certificat de travail'),
      h('div', { class: 'doc-texte' },
        h('p', null, `Je soussigné, ${P.employeur.signataire || '…'}, agissant en qualité de ${(P.employeur.qualite || 'gérant').toLowerCase()} de l’entreprise ${P.employeur.nom}${P.employeur.siret ? ` (SIRET ${P.employeur.siret})` : ''}, certifie que :`),
        h('p', { class: 'doc-texte__qui' }, h('b', null, `${civ} ${agent.nom}`),
          p.dateNaissance ? `, né${e} le ${isoVersFr(p.dateNaissance)}${p.lieuNaissance ? ` à ${p.lieuNaissance}` : ''}` : '',
          p.adresse ? `, demeurant ${p.adresse.replace(/\n/g, ', ')}` : '', ','),
        h('p', null, `a été employé${e} dans notre entreprise du `, h('b', null, isoVersFr(p.dateEntree) || '…'), ' au ', h('b', null, isoVersFr(p.dateSortie) || '…'),
          ', au poste de ', h('b', null, p.emploi || '…'), p.qualification ? ` (${p.qualification})` : '', `, dans le cadre d’un contrat ${p.contrat || ''}.`),
        h('p', null, `${civ} ${agent.nom} peut bénéficier du maintien à titre gratuit de ses garanties de complémentaire santé et de prévoyance (portabilité), dans les conditions prévues à l’article L. 911-8 du Code de la sécurité sociale, sous réserve d’être indemnisé${e} par l’assurance chômage.`),
        h('p', null, `${civ} ${agent.nom} nous quitte libre de tout engagement.`),
        h('p', null, 'Certificat délivré pour servir et valoir ce que de droit.')),
      signature(P),
    ] : [h('p', { class: 'doc-vide' }, 'Choisissez un salarié ci-dessus.')],
  });
}
