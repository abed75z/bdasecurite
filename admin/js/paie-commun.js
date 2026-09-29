/* =========================================================
   ESPACE ADMIN BDA — fiches de paie : outils communs
   Formats, onglets, dossier du salarié, lecture du planning,
   feuille A4 du bulletin.
   ========================================================= */
import { api, h, icone, statutPastille, euro, nombre, fmtHeures, MOIS, cap, pad, iso, isoVersFr } from './outils.js';
import { totauxDuMois, lireCreneau } from './planning.js';
import { calculerBulletin, completerParams, PROFIL_DEFAUT, VARIABLES_DEFAUT, HEURES_MENSUELLES } from './paie-calcul.js';

export const nombre4 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });
export const fmtE = (x) => euro.format(+x || 0);
export const fmtT = (t) => (t === '' || t == null || !Number.isFinite(+t) ? '' : `${nombre4.format(t)} %`);
export const fmtB = (b) => (b === '' || b == null ? '' : nombre.format(b));
export const normNom = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const libelleMois = (mois) => `${cap(MOIS[+mois.slice(5) - 1])} ${mois.slice(0, 4)}`;
export const moisCourant = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const decaler = (mois, k) => { const d = new Date(+mois.slice(0, 4), +mois.slice(5) - 1 + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const finDeMois = (mois) => iso(new Date(+mois.slice(0, 4), +mois.slice(5), 0));
export const pastilleBulletin = (s) => (s === 'valide' ? statutPastille('payee', 'Validé') : s === 'brouillon' ? statutPastille('attente', 'En cours') : statutPastille('brouillon', 'À déclarer'));

export function onglets(actif) {
  const o = (href, cle, libelle, ic) => h('a', { class: `paie-onglet ${cle === actif ? 'is-actif' : ''}`, href }, icone(ic), h('span', null, libelle));
  return h('nav', { class: 'paie-onglets', 'aria-label': 'Fiches de paie' },
    o('#/paie', 'mois', 'Paie du mois', 'planning'), o('#/paie/salaries', 'salaries', 'Salariés', 'clients'),
    o('#/paie/documents', 'documents', 'Documents', 'devis'), o('#/paie/parametres', 'parametres', 'Paramètres', 'reglages'));
}
export const avertissement = () => h('div', { class: 'paie-info' }, icone('alerte'),
  h('p', null, h('b', null, 'À savoir : '), 'ce module calcule et édite vos bulletins et vos documents de paie. La déclaration mensuelle (DSN) et le paiement des cotisations restent à faire de votre côté, sur net-entreprises.fr : c’est ce que TESE faisait pour vous. Faites vérifier les taux par votre comptable avant le premier bulletin.'));

/* ---------- Employeur repris des Paramètres (factures) tant que la paie n'a pas le sien ---------- */
function employeurDepuis(r) {
  const lignes = String(r?.emetteur || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const val = (re) => (lignes.find((l) => re.test(l)) || '').replace(new RegExp(`.*${re.source}\\s*:?\\s*`, 'i'), '');
  return {
    nom: r?.nom || '', siret: val(/SIRET/i), ape: val(/APE/i) || '8010Z',
    adresse: lignes.filter((l) => !/SIRET|APE|NAF|T[ÉE]L|@|TVA/i.test(l)).join('\n'),
  };
}
export function parametresComplets(params, entreprise) {
  const P = completerParams(params);
  if (!P.employeur.nom && !P.employeur.siret) Object.assign(P.employeur, employeurDepuis(entreprise));
  return P;
}

/* ---------- Dossier du salarié : ce qui manque ---------- */
export const CHAMPS_DOSSIER = [
  ['sexe', 'Sexe'], ['dateNaissance', 'Date de naissance'], ['nationalite', 'Nationalité'], ['nir', 'N° de sécurité sociale'],
  ['adresse', 'Adresse'], ['dateEntree', 'Date d’entrée'], ['contrat', 'Contrat'], ['emploi', 'Emploi'], ['tauxHoraire', 'Taux horaire'],
];
export function completude(p0) {
  const p = { ...PROFIL_DEFAUT, ...(p0 || {}) };
  const manquants = CHAMPS_DOSSIER.filter(([k]) => (k === 'tauxHoraire' ? !(+p[k] > 0) : !String(p[k] ?? '').trim())).map(([, l]) => l);
  if (!p.ue && !p.titreSejourNumero) manquants.push('Titre de séjour');
  return { pct: Math.round(100 * (1 - manquants.length / (CHAMPS_DOSSIER.length + (p.ue ? 0 : 1)))), manquants, pret: +p.tauxHoraire > 0 };
}
export function barreCompletude(p) {
  const c = completude(p);
  return h('div', { class: `paie-jauge ${c.pct === 100 ? 'is-ok' : ''}`, title: c.manquants.length ? `Manque : ${c.manquants.join(', ')}` : 'Dossier complet' },
    h('span', { class: 'paie-jauge__barre' }, h('i', { style: { width: `${c.pct}%` } })), h('b', null, `${c.pct} %`));
}

/* ---------- Heures et absences d'un agent, lues dans le planning du mois ---------- */
export function variablesDepuisPlanning(planning, mois, nomAgent, profil) {
  const ligne = (planning?.agents || []).find((a) => normNom(a.nom) === normNom(nomAgent));
  if (!ligne) return null;
  const T = totauxDuMois({ ...planning, agents: [ligne] }, mois);
  const codes = {};
  let paniers = 0, jours = 0;
  Object.entries(ligne.jours || {}).filter(([cle]) => cle.startsWith(mois)).forEach(([, val]) => {
    const c = lireCreneau(val);
    if (c?.code) codes[c.code] = (codes[c.code] || 0) + 1;
    else if (c && !c.err) {
      jours++;
      if ((c.duree != null ? c.duree : c.fin - c.debut) >= 360) paniers++;
    }
  });
  const r2 = (x) => Math.round(x * 100) / 100;
  const heures = T.total / 60;
  const contrat = +profil?.heuresContrat || HEURES_MENSUELLES;
  const hs = Math.max(0, r2(heures - contrat));
  const hs25 = Math.min(hs, 34.67);
  return {
    heuresTravaillees: r2(heures), heuresNuit: r2(T.nuit / 60), heuresDimanche: r2(T.dim / 60), heuresFerie: r2(T.fer / 60),
    hs25, hs50: r2(hs - hs25), joursTravailles: jours,
    joursCP: codes.CP || 0, joursMaladie: (codes.M || 0) + (codes.AT || 0), joursAbsence: codes.ABS || 0, paniers,
  };
}

/* ---------- Nouveau bulletin (brouillon) pour un agent ---------- */
export async function creerBulletin(agent, mois, planning, P) {
  const profil = { ...PROFIL_DEFAUT, ...(agent.profil || {}) };
  const variables = { ...VARIABLES_DEFAUT, primes: [], ...(variablesDepuisPlanning(planning, mois, agent.nom, profil) || {}) };
  const R = calculerBulletin(variables, profil, P, {});
  const data = { variables, datePaiement: finDeMois(mois), params: P, profil: { ...profil, nom: agent.nom }, resultat: R, etape: 0 };
  const res = await api('paie.bulletin.enregistrer', { agent_id: agent.id, mois, statut: 'brouillon', data, brut: R.brut, net: R.netPaye });
  return res.id;
}

/* ---------- Zoom automatique d'une feuille A4 sur petit écran ---------- */
export function ajusterZoom(zone, el) {
  const maj = () => {
    const dispo = zone.clientWidth - 8, largeur = el.offsetWidth || 794;
    const zoom = dispo < largeur ? Math.max(0.35, dispo / largeur) : 0;
    el.style.zoom = zoom ? String(zoom) : '';
  };
  maj();
  requestAnimationFrame(maj);
  setTimeout(maj, 400);
  new ResizeObserver(() => requestAnimationFrame(maj)).observe(zone);
}

/* ---------- La feuille A4 du bulletin (même présentation que les bulletins TESE) ---------- */
export function dessinerBulletin(el, { R, pr, P, agent, mois, datePaiement }) {
  const nb = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tx = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const fmt2 = (v) => (v === '' || v == null ? '' : nb.format(v));
  const [y, m] = mois.split('-').map(Number);
  const E = P.employeur || {};
  const fin = `${new Date(y, m, 0).getDate()}/${pad(m)}/${y}`;
  const lignesTexte = (t) => String(t || '').split('\n').filter(Boolean).map((l) => h('div', null, l));
  const kv = (k, v) => (v ? h('div', { class: 'bt-kv' }, h('span', null, `${k} : `), h('b', null, v)) : null);
  const bloc = (titre, ...contenu) => h('section', { class: 'bt-bloc' }, h('h4', null, titre), h('div', { class: 'bt-bloc__corps' }, contenu));
  const mode = R.modePaiement || pr.modePaiement || 'Virement';
  const somme = (ls, k) => Math.round(ls.reduce((s, l) => s + (+l[k] || 0), 0) * 100) / 100;

  /* ----- Colonne de gauche : employeur, salarié, déclaration ----- */
  const gauche = h('aside', { class: 'bt-gauche' },
    bloc('L’employeur',
      kv('Raison sociale', E.nom), h('div', { class: 'bt-kv' }, h('span', null, 'Adresse : '), h('b', null, String(E.adresse || '').replace(/\n/g, ' - '))),
      kv('Code NAF', E.ape), kv('N° URSSAF', E.urssaf), kv('SIRET', E.siret)),
    bloc('Le salarié',
      kv('Nom', agent.nom), kv('N° Sécurité sociale', pr.nir), kv('Matricule', pr.matricule),
      kv('Convention collective', E.convention ? E.convention.replace(/^Convention collective nationale des entreprises de /, '').replace(/^./, (c) => c.toUpperCase()) : ''),
      kv('Emploi occupé', pr.emploi), kv('Qualification', pr.qualification), kv('Statut', pr.statut), kv('Contrat', pr.contrat), kv('Entré(e) le', isoVersFr(pr.dateEntree))),
    bloc('Période et paiement',
      kv('Période d’emploi', `du 01/${pad(m)}/${String(y).slice(2)} au ${fin.slice(0, 6)}${String(y).slice(2)}`),
      kv('Salaire versé le', isoVersFr(datePaiement)), kv('Mode de paiement', mode),
      kv('Heures rémunérées', fmtHeures(R.heuresMois)), kv('Taux horaire', pr.tauxHoraire ? `${tx.format(pr.tauxHoraire)} €` : '')),
    bloc('Congés payés (jours)',
      h('div', { class: 'bt-mini' }, h('div', null, h('span', null, 'Acquis'), h('b', null, nombre.format(R.cp.acquis))), h('div', null, h('span', null, 'Pris'), h('b', null, nombre.format(R.cp.pris))), h('div', null, h('span', null, 'Solde'), h('b', null, nombre.format(R.cp.solde))))),
    bloc(`Cumuls ${y}`,
      kv('Brut', fmtE(R.annee.brut)), kv('Net imposable', fmtE(R.annee.netImposable)), kv('Impôt prélevé', fmtE(R.annee.pas)), kv('Heures', fmtHeures(R.annee.heures))));

  /* ----- Colonne de droite : rémunération, cotisations, net ----- */
  const gains = h('table', { class: 'bt-table' },
    h('colgroup', null, h('col'), h('col', { class: 'bt-c-base' }), h('col', { class: 'bt-c-taux' }), h('col', { class: 'bt-c-mt' })),
    h('thead', null, h('tr', null, h('th', null, 'Éléments de rémunération'), h('th', null, 'Nombre'), h('th', null, 'Taux'), h('th', null, 'Montant'))),
    h('tbody', null, R.gains.map((g) => h('tr', null, h('td', null, g.libelle), h('td', { class: 'r' }, fmt2(g.base)), h('td', { class: 'r' }, g.taux === '' ? '' : tx.format(g.taux)), h('td', { class: 'r' }, nb.format(g.montant))))),
    h('tfoot', null, h('tr', null, h('td', { colspan: 3 }, 'Total rémunération brute'), h('td', { class: 'r' }, fmtE(R.brut)))));

  const corps = h('tbody');
  const sect = (t) => corps.append(h('tr', { class: 'bt-sect' }, h('td', { colspan: 6 }, t)));
  const nb2 = (v) => (v === '' || v == null ? '' : nb.format(v));
  const ligne = (l) => corps.append(h('tr', null, h('td', null, l.libelle), h('td', { class: 'r' }, l.cle === 'reducGen' || l.cle === 'mutuelle' ? '' : fmt2(l.base)),
    h('td', { class: 'r' }, l.sal && l.tauxSal !== '' ? tx.format(l.tauxSal) : ''), h('td', { class: 'r' }, l.sal ? nb2(l.sal) : ''),
    h('td', { class: 'r' }, l.pat && l.tauxPat !== '' && l.cle !== 'reducGen' ? tx.format(l.tauxPat) : ''), h('td', { class: 'r' }, l.pat ? nb2(l.pat) : '')));
  const G = (rub) => R.lignes.filter((l) => l.rubrique === rub);
  const groupe = (titre, ...rubs) => { const ls = rubs.flatMap(G); if (ls.length) { sect(titre); ls.forEach(ligne); } };
  groupe('Sécurité sociale', 'secu');
  groupe('Complémentaire santé et prévoyance', 'sante');
  groupe('Assurance chômage', 'chomage');
  groupe('Retraite complémentaire obligatoire', 'retraite');
  const csg = G('csg'), nd = G('csgnd');
  if (csg.length || nd.length) {
    sect('CSG - CRDS');
    csg.forEach(ligne);
    if (nd.length) ligne({ libelle: 'CSG CRDS non déductible de l’impôt sur le revenu', base: nd[0].base, tauxSal: somme(nd, 'tauxSal'), sal: somme(nd, 'sal'), pat: 0 });
  }
  groupe('Autres cotisations', 'autres');
  groupe('Exonérations et allègements', 'exo');
  const cotisations = h('table', { class: 'bt-table' },
    h('colgroup', null, h('col'), h('col', { class: 'bt-c-base' }), h('col', { class: 'bt-c-taux' }), h('col', { class: 'bt-c-mt' }), h('col', { class: 'bt-c-taux' }), h('col', { class: 'bt-c-mt' })),
    h('thead', null,
      h('tr', null, h('th', { rowspan: 2 }, 'Cotisations et contributions'), h('th', { rowspan: 2 }, 'Base'), h('th', { colspan: 2 }, 'Part salariale'), h('th', { colspan: 2 }, 'Part employeur')),
      h('tr', null, h('th', null, 'Taux'), h('th', null, 'Montant'), h('th', null, 'Taux'), h('th', null, 'Montant'))),
    corps,
    h('tfoot', null, h('tr', null, h('td', { colspan: 2 }, 'Montant total des cotisations'), h('td', { colspan: 2, class: 'r' }, nb.format(R.totalSal)), h('td', { colspan: 2, class: 'r' }, nb.format(R.totalPat)))));

  const boite = (libelle, montant, cls = '') => h('div', { class: `bt-boite ${cls}` }, h('span', null, libelle), h('b', null, nb.format(montant)));
  const droite = h('div', { class: 'bt-droite' },
    gains,
    cotisations,
    boite('Montant net social', R.netSocial),
    h('div', { class: 'bt-net' },
      h('div', { class: 'bt-net__ligne' }, h('span', null, 'Net à payer avant l’impôt sur le revenu'), h('b', null, nb.format(R.netAvantImpot))),
      R.evolution ? h('div', { class: 'bt-net__dont' }, h('span', null, 'dont évolution de la rémunération liée à la suppression des cotisations salariales chômage et maladie'), h('b', null, nb.format(R.evolution))) : null),
    R.nonSoumis.length || R.acompte ? h('table', { class: 'bt-table bt-table--simple' },
      h('tbody', null, R.nonSoumis.map((x) => h('tr', null, h('td', null, x.base ? `${x.libelle} (${nombre.format(x.base)} × ${nombre.format(x.taux)} €)` : x.libelle), h('td', { class: 'r' }, `+ ${nb.format(x.montant)}`))),
        R.acompte ? h('tr', null, h('td', null, 'Acompte déjà versé'), h('td', { class: 'r' }, `- ${nb.format(R.acompte)}`)) : null)) : null,
    h('table', { class: 'bt-table' },
      h('colgroup', null, h('col'), h('col', { class: 'bt-c-mt' }), h('col', { class: 'bt-c-pas' }), h('col', { class: 'bt-c-mt' })),
      h('thead', null, h('tr', null, h('th', null, 'Impôt sur le revenu'), h('th', null, 'Base'), h('th', null, 'Taux personnalisé / non personnalisé'), h('th', null, 'Montant'))),
      h('tbody', null, h('tr', null, h('td', null, 'Impôt sur le revenu prélevé à la source'), h('td', { class: 'r' }, nb.format(R.netImposable)), h('td', { class: 'r' }, tx.format(R.tauxPas)), h('td', { class: 'r' }, nb.format(R.pas))))),
    h('div', { class: 'bt-paye' }, h('span', null, 'Net payé en euros'), h('b', null, nb.format(R.netPaye))),
    h('div', { class: 'bt-cout' }, h('span', null, `Allègement de cotisations employeur : ${fmtE(R.allegements)}`), h('span', null, `Total versé par l’employeur : ${fmtE(R.coutEmployeur)}`)));

  el.replaceChildren(
    h('div', { class: 'bt-haut' },
      h('div', { class: 'bt-marque' }, h('img', { class: 'bt-logo', src: 'logo-document.jpg', alt: '' }),
        h('div', null, h('b', null, 'Bulletin de paie'), h('span', null, `${cap(MOIS[m - 1])} ${y}`))),
      h('div', { class: 'bt-adresse' }, h('div', null, `${pr.sexe === 'F' ? 'Madame' : pr.sexe === 'H' ? 'Monsieur' : ''} ${agent.nom}`.trim()), lignesTexte(pr.adresse),
        h('div', { class: 'bt-date' }, `le ${isoVersFr(datePaiement) || fin}`))),
    h('div', { class: 'bt-grille' }, gauche, droite),
    h('div', { class: 'f-espace' }),
    h('p', { class: 'bt-mention' }, 'Dans votre intérêt et pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée. Rubrique dédiée au bulletin de paie sur le portail www.service-public.fr.'));
}

/* ---------- Petits éléments de formulaire « questions » ---------- */
// Question oui / non : affiche « contenu » quand la réponse est oui
export function question({ texte, aide, oui, surChoix, contenu, desactive }) {
  const zone = h('div', { class: 'q__suite' }, contenu);
  const btn = (val, lib) => h('button', { type: 'button', class: `q__btn ${oui === val ? 'is-actif' : ''}`, disabled: desactive, onclick: (e) => {
    oui = val;
    e.currentTarget.parentElement.querySelectorAll('.q__btn').forEach((b) => b.classList.toggle('is-actif', b === e.currentTarget));
    zone.hidden = !val;
    surChoix(val);
  } }, lib);
  zone.hidden = !oui;
  return h('div', { class: 'q' },
    h('div', { class: 'q__tete' }, h('p', { class: 'q__texte' }, texte), h('div', { class: 'q__choix' }, btn(true, 'Oui'), btn(false, 'Non'))),
    aide ? h('small', { class: 'q__aide' }, aide) : null,
    contenu ? zone : null);
}
// Choix parmi quelques cartes (mode de paiement, rémunération…)
export function choixCartes(options, valeur, surChoix, desactive) {
  const zone = h('div', { class: 'q-cartes' });
  options.forEach(([val, titre, sous]) => zone.append(h('button', { type: 'button', class: `q-carte ${val === valeur ? 'is-actif' : ''}`, disabled: desactive, onclick: (e) => {
    zone.querySelectorAll('.q-carte').forEach((b) => b.classList.toggle('is-actif', b === e.currentTarget));
    surChoix(val);
  } }, h('b', null, titre), sous ? h('small', null, sous) : null)));
  return zone;
}
