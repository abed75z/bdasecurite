/* =========================================================
   ESPACE ADMIN BDA — fiches de paie
   Bulletins du mois (préparés depuis le planning), dossiers des
   salariés, paramètres de paie. Réservé à l'administrateur.
   ========================================================= */
import {
  api, h, $$, icone, toast, erreur, modale, confirmer, champ, saisie, zoneTexte, statutPastille, attendre,
  euro, nombre, fmtHeures, lireHeures, lireNombre, MOIS, cap, pad, iso, fr, isoVersFr,
} from './outils.js';
import { totauxDuMois, lireCreneau } from './planning.js';
import { telechargerPdf } from './pdf.js';
import { imprimerFeuille } from './documents.js';
import {
  calculerBulletin, completerParams, PARAMS_DEFAUT, PROFIL_DEFAUT, VARIABLES_DEFAUT, LIBELLES_TAUX, HEURES_MENSUELLES,
} from './paie-calcul.js';

const nombre4 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });
const fmtE = (x) => euro.format(+x || 0);
const fmtT = (t) => (t === '' || t == null || !Number.isFinite(+t) ? '' : `${nombre4.format(t)} %`);
const fmtB = (b) => (b === '' || b == null ? '' : nombre.format(b));
const normNom = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const libelleMois = (mois) => `${cap(MOIS[+mois.slice(5) - 1])} ${mois.slice(0, 4)}`;
const moisCourant = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const decaler = (mois, k) => { const d = new Date(+mois.slice(0, 4), +mois.slice(5) - 1 + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const pastilleBulletin = (s) => statutPastille(s === 'valide' ? 'payee' : 'brouillon', s === 'valide' ? 'Validé' : 'Brouillon');

export async function pagePaie(ctx) {
  const [a, b] = ctx.params;
  if (a === 'bulletin' && /^\d+$/.test(b || '')) return editeurBulletin(ctx, +b);
  if (a === 'salaries') return pageSalaries(ctx);
  if (a === 'parametres') return pageParametres(ctx);
  return pageMois(ctx, /^\d{4}-\d{2}$/.test(a || '') ? a : moisCourant());
}

function onglets(actif) {
  const o = (href, cle, libelle) => h('a', { class: `chip ${cle === actif ? 'is-actif' : ''}`, href }, libelle);
  return h('nav', { class: 'chips paie-onglets', 'aria-label': 'Fiches de paie' },
    o('#/paie', 'bulletins', 'Bulletins du mois'), o('#/paie/salaries', 'salaries', 'Dossiers des salariés'), o('#/paie/parametres', 'parametres', 'Paramètres de paie'));
}
const avertissement = () => h('div', { class: 'paie-info' }, icone('alerte'),
  h('p', null, h('b', null, 'À savoir : '), 'ce module calcule et édite vos bulletins. La déclaration mensuelle (DSN) et le paiement des cotisations à l’URSSAF restent à faire de votre côté : c’est ce que TESE faisait pour vous. Faites vérifier les taux par votre comptable avant le premier bulletin.'));

/* ---------- Employeur repris des Paramètres (factures) tant que la paie n'a pas le sien ---------- */
function employeurDepuis(r) {
  const lignes = String(r?.emetteur || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const val = (re) => (lignes.find((l) => re.test(l)) || '').replace(new RegExp(`.*${re.source}\\s*:?\\s*`, 'i'), '');
  return {
    nom: r?.nom || '', siret: val(/SIRET/i), ape: val(/APE/i) || '8010Z',
    adresse: lignes.filter((l) => !/SIRET|APE|NAF|T[ÉE]L|@|TVA/i.test(l)).join('\n'),
  };
}
function parametresComplets(params, entreprise) {
  const P = completerParams(params);
  if (!P.employeur.nom && !P.employeur.siret) Object.assign(P.employeur, employeurDepuis(entreprise));
  return P;
}

/* ---------- Heures et absences d'un agent, lues dans le planning du mois ---------- */
export function variablesDepuisPlanning(planning, mois, nomAgent, profil) {
  const ligne = (planning?.agents || []).find((a) => normNom(a.nom) === normNom(nomAgent));
  if (!ligne) return null;
  const T = totauxDuMois({ ...planning, agents: [ligne] }, mois);
  const codes = {};
  let paniers = 0;
  Object.entries(ligne.jours || {}).filter(([cle]) => cle.startsWith(mois)).forEach(([cle, val]) => {
    const c = lireCreneau(val);
    if (c?.code) codes[c.code] = (codes[c.code] || 0) + 1;
    else if (c && !c.err) {
      const min = c.duree != null ? c.duree : c.fin - c.debut;
      if (min >= 360) paniers++;
    }
  });
  const heures = T.total / 60;
  const contrat = +profil?.heuresContrat || HEURES_MENSUELLES;
  const hs = Math.max(0, Math.round((heures - contrat) * 100) / 100);
  const hs25 = Math.min(hs, 34.67);
  return {
    heuresTravaillees: Math.round(heures * 100) / 100, heuresNuit: Math.round((T.nuit / 60) * 100) / 100,
    heuresDimanche: Math.round((T.dim / 60) * 100) / 100, heuresFerie: Math.round((T.fer / 60) * 100) / 100,
    hs25, hs50: Math.round((hs - hs25) * 100) / 100,
    joursCP: codes.CP || 0, joursMaladie: (codes.M || 0) + (codes.AT || 0), joursAbsence: codes.ABS || 0, paniers,
  };
}

/* =========================================================
   BULLETINS DU MOIS
   ========================================================= */
async function pageMois(ctx, mois) {
  ctx.titre('Fiches de paie');
  const [{ bulletins }, { agents }, { planning }, prm] = await Promise.all([
    api('paie.bulletins', undefined, { mois }), api('paie.salaries'), api('planning', undefined, { mois }), api('paie.parametres'),
  ]);
  const P = parametresComplets(prm.parametres, prm.entreprise);
  const avecBulletin = new Set(bulletins.map((x) => +x.agent_id));
  const lignesPlanning = planning?.agents || [];
  const dansPlanning = agents.filter((a) => lignesPlanning.some((l) => normNom(l.nom) === normNom(a.nom)));
  const aPreparer = dansPlanning.filter((a) => !avecBulletin.has(+a.id));
  const inconnus = lignesPlanning.map((l) => l.nom).filter((nom) => nom && !agents.some((a) => normNom(a.nom) === normNom(nom)));

  async function creer(liste) {
    try {
      let dernier = 0;
      for (const a of liste) dernier = await creerBulletin(a, mois, planning, P);
      toast(liste.length > 1 ? `${liste.length} bulletins préparés.` : 'Bulletin préparé.');
      if (liste.length === 1) ctx.aller(`#/paie/bulletin/${dernier}`);
      else await pageMois(ctx, mois);
    } catch (e) { erreur(e); }
  }

  ctx.actions(aPreparer.length ? h('button', { class: 'btn btn--gold', type: 'button', onclick: () => creer(aPreparer) }, icone('plus'), h('span', null, `Préparer les bulletins (${aPreparer.length})`)) : null);

  const nav = h('div', { class: 'mois-nav' },
    h('a', { class: 'icon-btn', href: `#/paie/${decaler(mois, -1)}`, 'aria-label': 'Mois précédent' }, icone('retour')),
    h('b', null, libelleMois(mois)),
    h('a', { class: 'icon-btn', href: `#/paie/${decaler(mois, 1)}`, 'aria-label': 'Mois suivant' }, icone('suivant')),
    mois !== moisCourant() ? h('a', { class: 'lien-btn', href: '#/paie' }, 'Revenir au mois en cours') : null);

  const ouvrir = (id) => ctx.aller(`#/paie/bulletin/${id}`);
  const lignes = [
    ...bulletins.map((x) => h('tr', { class: 'ligne-clic', tabindex: 0, onclick: () => ouvrir(x.id), onkeydown: (e) => { if (e.key === 'Enter') ouvrir(x.id); } },
      h('td', null, h('b', null, x.nom || 'Agent supprimé'), h('small', { class: 'muet paie-poste' }, x.poste || '')),
      h('td', { class: 'num' }, fmtE(x.brut)), h('td', { class: 'num' }, h('b', null, fmtE(x.net))), h('td', null, pastilleBulletin(x.statut)))),
    ...aPreparer.map((a) => h('tr', null,
      h('td', null, h('b', null, a.nom), h('small', { class: 'muet paie-poste' }, 'Dans le planning — pas encore de bulletin')),
      h('td', { class: 'num muet' }, '—'), h('td', { class: 'num muet' }, '—'),
      h('td', null, h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => creer([a]) }, 'Préparer')))),
  ];
  const autres = agents.filter((a) => +a.actif && !avecBulletin.has(+a.id) && !aPreparer.includes(a));
  const choix = h('select', { class: 'input input--auto', onchange: () => { const a = agents.find((x) => String(x.id) === choix.value); choix.value = ''; if (a) creer([a]); } },
    h('option', { value: '' }, '+ Bulletin pour un autre agent…'), autres.map((a) => h('option', { value: a.id }, `${a.nom} (${a.poste})`)));

  ctx.afficher(onglets('bulletins'), nav,
    h('section', { class: 'carte' },
      h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
        h('thead', null, h('tr', null, h('th', null, 'Salarié'), h('th', { class: 'num' }, 'Brut'), h('th', { class: 'num' }, 'Net payé'), h('th', null, 'Statut'))),
        h('tbody', null, lignes.length ? lignes : h('tr', null, h('td', { colspan: 4, class: 'vide-ligne' },
          planning ? 'Aucun agent du planning ne correspond à vos agents enregistrés.' : `Pas de planning pour ${libelleMois(mois)}. Remplissez d’abord le planning, ou choisissez un agent ci-dessous.`)))))),
    h('div', { class: 'plan-outils' }, choix),
    inconnus.length ? h('p', { class: 'astuce' }, `Dans le planning mais pas dans vos agents : ${inconnus.join(', ')}. Ajoutez-les dans « Agents » (même nom) pour préparer leur bulletin.`) : null,
    avertissement());
}

async function creerBulletin(agent, mois, planning, P) {
  const profil = { ...PROFIL_DEFAUT, ...(agent.profil || {}) };
  const variables = { ...VARIABLES_DEFAUT, primes: [], ...(variablesDepuisPlanning(planning, mois, agent.nom, profil) || {}) };
  const R = calculerBulletin(variables, profil, P, {});
  const data = { variables, datePaiement: iso(new Date(+mois.slice(0, 4), +mois.slice(5), 0)), params: P, profil: { ...profil, nom: agent.nom }, resultat: R };
  const res = await api('paie.bulletin.enregistrer', { agent_id: agent.id, mois, statut: 'brouillon', data, brut: R.brut, net: R.netPaye });
  return res.id;
}

/* =========================================================
   ÉDITEUR DE BULLETIN
   ========================================================= */
async function editeurBulletin(ctx, id) {
  const res = await api('paie.bulletin', undefined, { id });
  const b = res.bulletin;
  const mois = b.mois;
  const data = b.data || {};
  data.variables = { ...VARIABLES_DEFAUT, ...(data.variables || {}) };
  if (!Array.isArray(data.variables.primes)) data.variables.primes = [];
  data.datePaiement = data.datePaiement || iso(new Date(+mois.slice(0, 4), +mois.slice(5), 0));
  const agent = res.agent || { nom: data.profil?.nom || 'Agent supprimé', poste: '' };
  let statut = b.statut;
  const fige = () => statut === 'valide';
  const params = () => (fige() && data.params ? completerParams(data.params) : parametresComplets(res.parametres, res.entreprise));
  const profil = () => (fige() && data.profil ? { ...PROFIL_DEFAUT, ...data.profil } : { ...PROFIL_DEFAUT, ...(res.profil || {}) });

  const feuille = h('div', { class: 'feuille bp' });
  const alertes = h('ul', { class: 'bp-alertes' });
  const blocAlertes = h('section', { class: 'panneau__bloc panneau__bloc--alerte' }, h('h3', null, 'À vérifier'), alertes);
  let R;
  function recalculer() {
    R = calculerBulletin(data.variables, profil(), params(), res.cumuls || {});
    dessinerBulletin(feuille, { R, pr: profil(), P: params(), agent, mois, datePaiement: data.datePaiement });
    alertes.replaceChildren(...R.alertes.map((a) => h('li', null, a)));
    blocAlertes.hidden = !R.alertes.length || fige();
  }

  /* ----- Enregistrement automatique ----- */
  const indicateur = h('span', { class: 'etat-save is-ok' }, '✓ À jour');
  const marquer = (txt, cls) => { indicateur.textContent = txt; indicateur.className = `etat-save ${cls || ''}`; };
  async function enregistrer() {
    marquer('Enregistrement…', 'is-encours');
    try {
      const P = params(), pr = profil();
      data.params = P;
      data.profil = { ...pr, nom: agent.nom };
      data.resultat = R;
      await api('paie.bulletin.enregistrer', { id, agent_id: b.agent_id, mois, statut, data, brut: R.brut, net: R.netPaye });
      marquer('✓ Enregistré', 'is-ok');
    } catch (e) { marquer('Non enregistré', 'is-erreur'); erreur(e); }
  }
  const plusTard = attendre(enregistrer, 900);
  const change = () => { recalculer(); marquer('Modifications…'); plusTard(); };

  /* ----- Panneau de saisie ----- */
  const panneau = h('aside', { class: 'panneau' });
  const V = data.variables;
  function champNum(label, cle, { heuresFmt, aide } = {}) {
    const val = +V[cle] || 0;
    const inp = saisie({ inputmode: 'decimal', value: heuresFmt ? fmtHeures(val, true) : nombre.format(val), disabled: fige() });
    inp.addEventListener('focus', () => inp.select());
    inp.addEventListener('input', () => {
      const n = heuresFmt ? lireHeures(inp.value) : lireNombre(inp.value);
      const ok = Number.isFinite(n) && n >= 0;
      inp.classList.toggle('is-bad', !ok);
      if (ok) { V[cle] = n; change(); }
    });
    return champ(label, inp, aide);
  }
  function blocPrimes() {
    const liste = h('div', { class: 'paie-primes' });
    const dessiner = () => liste.replaceChildren(...V.primes.map((p, i) => {
      const lib = saisie({ value: p.libelle || '', placeholder: 'Libellé (ex. Prime exceptionnelle)', disabled: fige(), oninput: (e) => { p.libelle = e.target.value; change(); } });
      const mt = saisie({ value: nombre.format(+p.montant || 0), inputmode: 'decimal', disabled: fige(), oninput: (e) => { const n = lireNombre(e.target.value); if (Number.isFinite(n)) { p.montant = n; change(); } } });
      mt.addEventListener('focus', () => mt.select());
      const soumis = h('select', { class: 'input', disabled: fige(), onchange: (e) => { p.soumis = e.target.value === 'oui'; change(); } },
        h('option', { value: 'oui', selected: p.soumis !== false }, 'Soumise à cotisations'), h('option', { value: 'non', selected: p.soumis === false }, 'Non soumise (frais, remboursement)'));
      return h('div', { class: 'paie-prime' }, lib, h('div', { class: 'paie-prime__ligne' }, mt, fige() ? null : h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer', onclick: () => { V.primes.splice(i, 1); dessiner(); change(); } }, icone('croix'))), soumis);
    }));
    dessiner();
    return h('div', { class: 'form-grille' }, liste,
      fige() ? null : h('button', { class: 'lien-btn', type: 'button', onclick: () => { V.primes.push({ libelle: '', montant: 0, soumis: true }); dessiner(); $$('.paie-prime input', liste).at(-2)?.focus(); } }, icone('plus'), 'Ajouter une prime ou une indemnité'));
  }
  function construirePanneau() {
    const choixStatut = h('div', { class: 'statuts' },
      h('button', { type: 'button', class: `statut-btn statut-btn--brouillon ${fige() ? '' : 'is-actif'}`, onclick: () => changerStatut('brouillon') }, 'Brouillon'),
      h('button', { type: 'button', class: `statut-btn statut-btn--payee ${fige() ? 'is-actif' : ''}`, onclick: () => changerStatut('valide') }, 'Validé'));
    const date = h('input', { class: 'input', type: 'date', value: data.datePaiement, disabled: fige(), onchange: (e) => { data.datePaiement = e.target.value; change(); } });
    panneau.replaceChildren(
      h('section', { class: 'panneau__bloc' }, h('h3', null, 'Statut'), choixStatut,
        h('p', { class: 'panneau__astuce' }, fige() ? 'Bulletin validé : il est figé et compte dans les cumuls de l’année. Repassez-le en brouillon pour le modifier.' : 'Vérifiez les heures, puis validez le bulletin pour le figer.')),
      blocAlertes,
      h('section', { class: 'panneau__bloc' }, h('h3', null, 'Heures du mois'),
        champNum('Heures travaillées', 'heuresTravaillees', { heuresFmt: true }),
        h('div', { class: 'form-grille form-grille--2' },
          champNum('Dont de nuit', 'heuresNuit', { heuresFmt: true }), champNum('Dont dimanche', 'heuresDimanche', { heuresFmt: true }),
          champNum('Dont jours fériés', 'heuresFerie', { heuresFmt: true }), champNum('Heures sup. à 25 %', 'hs25', { heuresFmt: true }),
          champNum('Heures sup. à 50 %', 'hs50', { heuresFmt: true })),
        fige() ? null : h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: reprendrePlanning }, icone('planning'), 'Reprendre les heures du planning')),
      h('section', { class: 'panneau__bloc' }, h('h3', null, 'Absences et congés'),
        h('div', { class: 'form-grille form-grille--2' },
          champNum('Jours de congés payés', 'joursCP'), champNum('Jours maladie / AT', 'joursMaladie'),
          champNum('Absences non payées (jours)', 'joursAbsence'), champNum('Congés acquis ce mois', 'cpAcquis'))),
      h('section', { class: 'panneau__bloc' }, h('h3', null, 'Primes et indemnités'),
        champNum('Indemnités de panier (nombre)', 'paniers'),
        blocPrimes(),
        champNum('Acompte déjà versé (€)', 'acompte')),
      h('section', { class: 'panneau__bloc' }, h('h3', null, 'Paiement'), champ('Date du virement', date)),
      h('section', { class: 'panneau__bloc' }, h('h3', null, 'Actions'),
        h('button', { class: 'btn btn--gold btn--bloc', type: 'button', onclick: pdf }, icone('telecharger'), 'Télécharger en PDF'),
        h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: imprimer }, icone('imprimer'), 'Imprimer'),
        h('a', { class: 'btn btn--ghost btn--bloc', href: '#/paie/salaries' }, icone('personne'), 'Dossier du salarié'),
        fige() ? null : h('button', { class: 'btn btn--danger-ghost btn--bloc', type: 'button', onclick: supprimer }, icone('poubelle'), 'Supprimer le bulletin')));
  }

  const nomFichier = () => `Bulletin de paie ${libelleMois(mois)} - ${agent.nom}`;
  async function pdf() { plusTard.annuler(); await enregistrer(); await telechargerPdf(feuille, nomFichier()); }
  function imprimer() { plusTard.annuler(); enregistrer().then(() => imprimerFeuille(nomFichier())); }
  async function reprendrePlanning() {
    try {
      const { planning } = await api('planning', undefined, { mois });
      const v = variablesDepuisPlanning(planning, mois, agent.nom, profil());
      if (!v) return toast(`${agent.nom} n’apparaît pas dans le planning de ${libelleMois(mois)}.`, 'erreur');
      Object.assign(V, v);
      construirePanneau(); change();
      toast(`Heures reprises : ${fmtHeures(v.heuresTravaillees)}.`);
    } catch (e) { erreur(e); }
  }
  async function changerStatut(s) {
    if (s === statut) return;
    const ok = s === 'valide'
      ? await confirmer('Valider ce bulletin ? Il sera figé : un changement de taux ou du dossier du salarié ne le modifiera plus, et il comptera dans les cumuls de l’année.', { titre: 'Valider le bulletin', ok: 'Valider' })
      : await confirmer('Repasser ce bulletin en brouillon pour le modifier ? Il reprendra les paramètres et le dossier du salarié actuels.', { titre: 'Modifier le bulletin', ok: 'Repasser en brouillon' });
    if (!ok) return;
    plusTard.annuler();
    // À la validation, le bulletin garde une copie des paramètres et du dossier du salarié du moment
    if (s === 'valide') {
      data.params = parametresComplets(res.parametres, res.entreprise);
      data.profil = { ...PROFIL_DEFAUT, ...(res.profil || {}), nom: agent.nom };
    }
    statut = s;
    recalculer(); construirePanneau();
    await enregistrer();
  }
  async function supprimer() {
    if (!(await confirmer(`Supprimer le bulletin de ${agent.nom} (${libelleMois(mois)}) ?`, { ok: 'Supprimer', danger: true }))) return;
    try { plusTard.annuler(); await api('paie.bulletin.supprimer', { id }); toast('Bulletin supprimé.'); ctx.aller(`#/paie/${mois}`); } catch (e) { erreur(e); }
  }

  ctx.titre(`Bulletin — ${agent.nom}`);
  ctx.actions(h('a', { class: 'btn btn--ghost', href: `#/paie/${mois}` }, icone('retour'), h('span', null, libelleMois(mois))), indicateur,
    h('button', { class: 'btn btn--gold', type: 'button', onclick: pdf }, icone('telecharger'), h('span', null, 'Télécharger PDF')));
  recalculer();
  construirePanneau();
  // Brouillon dont le dossier du salarié ou les paramètres ont changé : la liste du mois est remise à jour
  if (!fige() && (R.brut !== +b.brut || R.netPaye !== +b.net)) enregistrer();
  const zone = h('div', { class: 'feuille-zone' }, feuille);
  ctx.afficher(h('div', { class: 'editeur' }, zone, panneau));
  ajusterZoom(zone, feuille);
}

function ajusterZoom(zone, el) {
  const maj = () => {
    const dispo = zone.clientWidth - 8, largeur = el.offsetWidth || 794;
    const zoom = dispo < largeur ? Math.max(0.4, dispo / largeur) : 0;
    el.style.zoom = zoom ? String(zoom) : '';
  };
  maj();
  requestAnimationFrame(maj);
  setTimeout(maj, 400);
  new ResizeObserver(() => requestAnimationFrame(maj)).observe(zone);
}

/* ---------- La feuille A4 du bulletin ---------- */
function dessinerBulletin(el, { R, pr, P, agent, mois, datePaiement }) {
  const [y, m] = mois.split('-').map(Number);
  const E = P.employeur || {};
  const info = (l, v) => h('div', null, h('span', null, l), h('b', null, v || '—'));
  const lignesTexte = (t) => String(t || '').split('\n').filter(Boolean).map((l) => h('div', null, l));

  // Rémunération
  const gains = h('table', { class: 'bp-table' },
    h('colgroup', null, h('col'), h('col', { class: 'bp-c1' }), h('col', { class: 'bp-c1' }), h('col', { class: 'bp-c2' })),
    h('thead', null, h('tr', null, h('th', null, 'Éléments de rémunération'), h('th', { class: 'r' }, 'Base / nombre'), h('th', { class: 'r' }, 'Taux'), h('th', { class: 'r' }, 'Montant'))),
    h('tbody', null, R.gains.map((g) => h('tr', null, h('td', null, g.libelle), h('td', { class: 'r' }, fmtB(g.base)), h('td', { class: 'r' }, g.taux === '' ? '' : nombre4.format(g.taux)), h('td', { class: 'r' }, fmtE(g.montant))))),
    h('tfoot', null, h('tr', null, h('td', { colspan: 3 }, 'Salaire brut'), h('td', { class: 'r' }, fmtE(R.brut)))));

  // Cotisations (présentation du bulletin clarifié)
  const corps = h('tbody');
  const sect = (t) => corps.append(h('tr', { class: 'bp-sect' }, h('td', { colspan: 6 }, t)));
  const ligne = (l) => corps.append(h('tr', null, h('td', null, l.libelle), h('td', { class: 'r' }, fmtB(l.base)),
    h('td', { class: 'r' }, l.sal ? fmtT(l.tauxSal) : ''), h('td', { class: 'r' }, l.sal ? fmtE(l.sal) : ''),
    h('td', { class: 'r' }, l.pat ? fmtT(l.tauxPat) : ''), h('td', { class: 'r' }, l.pat ? fmtE(l.pat) : '')));
  const G = (rub) => R.lignes.filter((l) => l.rubrique === rub);
  const somme = (ls, k) => Math.round(ls.reduce((s, l) => s + (+l[k] || 0), 0) * 100) / 100;
  if (G('sante').length) { sect('Santé'); G('sante').forEach(ligne); }
  G('at').forEach(ligne);
  sect('Retraite'); G('retraite').forEach(ligne);
  G('famille').forEach(ligne);
  G('chomage').forEach(ligne);
  const autres = G('autres');
  if (autres.length) ligne({ libelle: 'Autres contributions dues par l’employeur', base: '', sal: 0, pat: somme(autres, 'pat'), tauxPat: '' });
  G('csg').forEach(ligne);
  const nd = G('csgnd');
  if (nd.length) ligne({ libelle: 'CSG/CRDS non déductible de l’impôt sur le revenu', base: nd[0].base, tauxSal: somme(nd, 'tauxSal'), sal: somme(nd, 'sal'), pat: 0 });
  if (G('exo').length) { sect('Exonérations et allègements de cotisations'); G('exo').forEach(ligne); }
  const cotisations = h('table', { class: 'bp-table bp-table--cot' },
    h('colgroup', null, h('col'), h('col', { class: 'bp-c1' }), h('col', { class: 'bp-c3' }), h('col', { class: 'bp-c2' }), h('col', { class: 'bp-c3' }), h('col', { class: 'bp-c2' })),
    h('thead', null,
      h('tr', null, h('th', { rowspan: 2 }, 'Cotisations et contributions sociales'), h('th', { rowspan: 2, class: 'r' }, 'Base'), h('th', { colspan: 2, class: 'c' }, 'Part salarié'), h('th', { colspan: 2, class: 'c' }, 'Part employeur')),
      h('tr', null, h('th', { class: 'r' }, 'Taux'), h('th', { class: 'r' }, 'Montant'), h('th', { class: 'r' }, 'Taux'), h('th', { class: 'r' }, 'Montant'))),
    corps,
    h('tfoot', null, h('tr', null, h('td', { colspan: 3 }, 'Total des cotisations et contributions'), h('td', { class: 'r' }, fmtE(R.totalSal)), h('td'), h('td', { class: 'r' }, fmtE(R.totalPat)))));

  const ligneNet = (libelle, montant, cls = '') => h('div', { class: `bp-ligne ${cls}` }, h('span', null, libelle), h('b', null, fmtE(montant)));

  el.replaceChildren(
    h('div', { class: 'bp-tete' },
      h('div', { class: 'bp-employeur' },
        h('img', { class: 'bp-logo', src: 'logo-document.jpg', alt: '' }),
        h('div', null, h('b', { class: 'bp-nom' }, E.nom || 'Employeur'), lignesTexte(E.adresse),
          h('div', null, [E.siret ? `SIRET ${E.siret}` : '', E.ape ? `APE ${E.ape}` : ''].filter(Boolean).join(' · ')),
          E.urssaf ? h('div', null, `URSSAF n° ${E.urssaf}`) : null)),
      h('div', { class: 'bp-titre' },
        h('h2', null, 'Bulletin de paie'),
        h('div', { class: 'bp-periode' }, `Période du 01/${pad(m)}/${y} au ${new Date(y, m, 0).getDate()}/${pad(m)}/${y}`),
        h('div', { class: 'bp-salarie' }, h('span', { class: 'f-label' }, 'Salarié'), h('b', { class: 'bp-nom' }, agent.nom), lignesTexte(pr.adresse)))),
    h('div', { class: 'bp-infos' },
      info('Emploi', pr.emploi), info('Qualification', pr.qualification), info('Statut', pr.statut), info('Contrat', pr.contrat),
      info('Entrée le', isoVersFr(pr.dateEntree)), info('N° de sécurité sociale', pr.nir), info('Matricule', pr.matricule),
      info('Taux horaire', pr.tauxHoraire ? `${nombre4.format(pr.tauxHoraire)} €` : ''),
      info('Heures payées', fmtHeures(R.heuresMois)), info(pr.mode === 'horaire' ? 'Rémunération' : 'Horaire mensuel', pr.mode === 'horaire' ? 'À l’heure' : fmtHeures(+pr.heuresContrat || HEURES_MENSUELLES)),
      h('div', { class: 'bp-infos__large' }, h('span', null, 'Convention collective'), h('b', null, E.convention || '—'))),
    gains,
    cotisations,
    h('div', { class: 'bp-nets' },
      h('div', { class: 'bp-nets__col' },
        ligneNet('Net à payer avant impôt sur le revenu', R.netAvantImpot, 'bp-ligne--fort'),
        R.nonSoumis.map((x) => ligneNet(x.base ? `${x.libelle} (${nombre.format(x.base)} × ${fmtE(x.taux)})` : x.libelle, x.montant)),
        h('div', { class: 'bp-impot' },
          h('span', { class: 'f-label' }, 'Impôt sur le revenu prélevé à la source'),
          h('div', null, h('span', null, 'Base'), h('b', null, fmtE(R.netImposable))),
          h('div', null, h('span', null, R.pasPerso ? 'Taux personnalisé' : 'Taux non personnalisé'), h('b', null, fmtT(R.tauxPas))),
          h('div', null, h('span', null, 'Montant'), h('b', null, fmtE(-R.pas)))),
        R.acompte ? ligneNet('Acompte déjà versé', -R.acompte) : null),
      h('div', { class: 'bp-paye' },
        h('span', { class: 'f-label' }, 'Net payé'),
        h('b', null, fmtE(R.netPaye)),
        h('small', null, `Virement le ${isoVersFr(datePaiement) || '—'}`))),
    h('div', { class: 'bp-annexes' },
      info('Montant net social', fmtE(R.netSocial)),
      info('Allègement de cotisations employeur', fmtE(R.allegements)),
      info('Total versé par l’employeur', fmtE(R.coutEmployeur)),
      h('div', { class: 'bp-cp' }, h('span', null, 'Congés payés (jours)'),
        h('b', null, `Acquis ${nombre.format(R.cp.acquis)} · Pris ${nombre.format(R.cp.pris)} · Solde ${nombre.format(R.cp.solde)}`)),
      h('div', { class: 'bp-cumuls' }, h('span', null, `Cumuls ${y}`),
        h('b', null, `Brut ${fmtE(R.annee.brut)} · Net imposable ${fmtE(R.annee.netImposable)} · Impôt ${fmtE(R.annee.pas)} · ${fmtHeures(R.annee.heures)}`))),
    h('div', { class: 'f-espace' }),
    h('p', { class: 'bp-mention' }, 'Dans votre intérêt et pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée. Informations sur le bulletin de paie : rubrique dédiée sur www.service-public.fr.'));
}

/* =========================================================
   DOSSIERS DES SALARIÉS
   ========================================================= */
async function pageSalaries(ctx) {
  ctx.titre('Fiches de paie');
  let { agents } = await api('paie.salaries');
  const corps = h('tbody');
  const complet = (p) => p.nir && +p.tauxHoraire > 0 && p.dateEntree;
  function dessiner() {
    corps.replaceChildren(...(agents.length ? agents.map((a) => {
      const p = { ...PROFIL_DEFAUT, ...(a.profil || {}) };
      return h('tr', { class: 'ligne-clic', tabindex: 0, onclick: () => editer(a), onkeydown: (e) => { if (e.key === 'Enter') editer(a); } },
        h('td', null, h('b', null, a.nom), h('small', { class: 'muet paie-poste' }, `${a.poste}${+a.actif ? '' : ' · inactif'}`)),
        h('td', null, p.mode === 'horaire' ? 'À l’heure' : `Mensualisé ${fmtHeures(+p.heuresContrat || HEURES_MENSUELLES)}`),
        h('td', { class: 'num' }, +p.tauxHoraire ? `${nombre4.format(p.tauxHoraire)} €/h` : '—'),
        h('td', null, complet(p) ? statutPastille('payee', 'Complet') : statutPastille('attente', 'À compléter')));
    }) : [h('tr', null, h('td', { colspan: 4, class: 'vide-ligne' }, 'Ajoutez d’abord vos agents dans la rubrique « Agents ».'))]));
  }
  async function editer(a) {
    const p = { ...PROFIL_DEFAUT, ...(a.profil || {}) };
    const f = {
      adresse: zoneTexte({ value: p.adresse, rows: 3, placeholder: 'N°, rue\nCode postal, ville' }),
      nir: saisie({ value: p.nir, placeholder: '1 85 05 75 120 005 42', autocomplete: 'off', spellcheck: 'false' }),
      matricule: saisie({ value: p.matricule }),
      emploi: saisie({ value: p.emploi }),
      qualification: saisie({ value: p.qualification, placeholder: 'ex. Niveau 3 · Échelon 2 · Coef. 140' }),
      statut: h('select', { class: 'input' }, ['Non cadre', 'Agent de maîtrise'].map((s) => h('option', { selected: s === p.statut }, s))),
      contrat: h('select', { class: 'input' }, ['CDI', 'CDD', 'CDI temps partiel', 'CDD temps partiel', 'Contrat d’extra'].map((s) => h('option', { selected: s === p.contrat }, s))),
      dateEntree: h('input', { class: 'input', type: 'date', value: p.dateEntree }),
      mode: h('select', { class: 'input' }, h('option', { value: 'mensuel', selected: p.mode !== 'horaire' }, 'Mensualisé (salaire fixe)'), h('option', { value: 'horaire', selected: p.mode === 'horaire' }, 'À l’heure (heures du planning)')),
      heuresContrat: saisie({ value: nombre.format(+p.heuresContrat || HEURES_MENSUELLES), inputmode: 'decimal' }),
      tauxHoraire: saisie({ value: +p.tauxHoraire ? nombre4.format(p.tauxHoraire) : '', inputmode: 'decimal', placeholder: 'ex. 12,50' }),
      heuresJour: saisie({ value: nombre.format(+p.heuresJour || 7), inputmode: 'decimal' }),
      tauxPas: saisie({ value: p.tauxPas, inputmode: 'decimal', placeholder: 'Vide = taux neutre' }),
      navigo: saisie({ value: +p.navigo ? nombre.format(p.navigo) : '', inputmode: 'decimal', placeholder: '0' }),
      soldeCP: saisie({ value: nombre.format(+p.soldeCP || 0), inputmode: 'decimal' }),
      mutuelle: h('input', { type: 'checkbox', checked: p.mutuelle !== false }),
    };
    const choix = await modale({
      titre: `Dossier de paie — ${a.nom}`, large: true,
      contenu: [
        h('p', { class: 'astuce' }, 'Ces informations restent privées : elles ne sont visibles que dans votre espace administrateur.'),
        h('div', { class: 'form-grille form-grille--2' },
          champ('N° de sécurité sociale', f.nir), champ('Matricule', f.matricule),
          champ('Emploi', f.emploi), champ('Qualification (convention)', f.qualification),
          champ('Statut', f.statut), champ('Contrat', f.contrat),
          champ('Date d’entrée', f.dateEntree), champ('Adresse', f.adresse),
          champ('Rémunération', f.mode), champ('Taux horaire brut (€)', f.tauxHoraire, 'Au moins le minimum de la grille de la convention collective.'),
          champ('Heures mensuelles du contrat', f.heuresContrat, '151,67 h = temps plein (35 h/semaine).'), champ('Heures par jour (congés, absences)', f.heuresJour),
          champ('Taux de prélèvement à la source (%)', f.tauxPas, 'Le taux transmis par les impôts pour ce salarié (retour de la DSN).'), champ('Remboursement transport par mois (€)', f.navigo, '50 % de l’abonnement Navigo, s’il en a un.'),
          champ('Solde de congés au départ (jours)', f.soldeCP, 'Les jours qu’il lui restait avant son premier bulletin ici.'),
          h('label', { class: 'champ champ--case' }, f.mutuelle, h('span', null, 'Adhère à la mutuelle de l’entreprise'))),
      ],
      actions: [
        { libelle: 'Annuler', classe: 'btn--ghost', valeur: null },
        { libelle: 'Enregistrer', classe: 'btn--gold', submit: true, action: async () => {
          const num = (el, def = 0) => { const n = lireNombre(el.value); return Number.isFinite(n) ? n : def; };
          const profil = {
            adresse: f.adresse.value.trim(), nir: f.nir.value.trim(), matricule: f.matricule.value.trim(), emploi: f.emploi.value.trim(),
            qualification: f.qualification.value.trim(), statut: f.statut.value, contrat: f.contrat.value, dateEntree: f.dateEntree.value,
            mode: f.mode.value, heuresContrat: num(f.heuresContrat, HEURES_MENSUELLES) || HEURES_MENSUELLES, tauxHoraire: num(f.tauxHoraire),
            heuresJour: num(f.heuresJour, 7) || 7, tauxPas: f.tauxPas.value.trim().replace(',', '.'), navigo: num(f.navigo),
            soldeCP: num(f.soldeCP), mutuelle: f.mutuelle.checked,
          };
          try { await api('paie.salarie.enregistrer', { agent_id: a.id, profil }); a.profil = profil; return 'ok'; } catch (e) { erreur(e); return false; }
        } },
      ],
    });
    if (choix === 'ok') { toast('Dossier enregistré.'); dessiner(); }
  }
  ctx.afficher(onglets('salaries'),
    h('section', { class: 'carte' },
      h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
        h('thead', null, h('tr', null, h('th', null, 'Salarié'), h('th', null, 'Rémunération'), h('th', { class: 'num' }, 'Taux horaire'), h('th', null, 'Dossier'))),
        corps))),
    h('p', { class: 'astuce' }, 'Cliquez sur un salarié pour compléter son dossier : n° de sécurité sociale, date d’entrée, taux horaire, taux d’impôt…'));
  dessiner();
}

/* =========================================================
   PARAMÈTRES DE PAIE
   ========================================================= */
async function pageParametres(ctx) {
  ctx.titre('Fiches de paie');
  const prm = await api('paie.parametres');
  const P = parametresComplets(prm.parametres, prm.entreprise);
  const num = (v, attrs = {}) => saisie({ value: v === '' || v == null ? '' : nombre4.format(v), inputmode: 'decimal', ...attrs });
  const E = {
    nom: saisie({ value: P.employeur.nom }), adresse: zoneTexte({ value: P.employeur.adresse, rows: 3 }), siret: saisie({ value: P.employeur.siret }),
    ape: saisie({ value: P.employeur.ape }), urssaf: saisie({ value: P.employeur.urssaf, placeholder: 'N° de compte URSSAF' }), convention: zoneTexte({ value: P.employeur.convention, rows: 2 }),
  };
  const B = {
    annee: saisie({ value: String(P.annee), inputmode: 'numeric' }), smicHoraire: num(P.smicHoraire), pmss: num(P.pmss),
    effectif: h('select', { class: 'input' }, [['moins11', 'Moins de 11 salariés'], ['11a19', 'De 11 à 19 salariés'], ['20a49', 'De 20 à 49 salariés'], ['50plus', '50 salariés et plus']].map(([k, l]) => h('option', { value: k, selected: k === P.effectif }, l))),
    tauxAT: num(P.tauxAT), tauxMobilite: num(P.tauxMobilite), panier: num(P.panier), deductionHS: num(P.deductionHS),
    mutSal: num(P.mutuelle.sal), mutPat: num(P.mutuelle.pat), prevSal: num(P.prevoyance.sal), prevPat: num(P.prevoyance.pat),
    majNuit: num(P.majorations.nuit), majDim: num(P.majorations.dimanche), majFerie: num(P.majorations.ferie),
    seuilMaladie: num(P.seuilMaladie), seuilFamille: num(P.seuilFamille), reductionHSMax: num(P.reductionHSMax),
    rgActive: h('input', { type: 'checkbox', checked: !!P.reduction.active }), rgTmin: num(P.reduction.tmin), rgTdelta: num(P.reduction.tdelta), rgTdelta50: num(P.reduction.tdelta50), rgP: num(P.reduction.p),
  };
  const tauxChamps = {};
  const tableTaux = h('table', { class: 'tableau tableau--form' },
    h('thead', null, h('tr', null, h('th', null, 'Cotisation'), h('th', null, 'Salarié (%)'), h('th', null, 'Employeur (%)'))),
    h('tbody', null, LIBELLES_TAUX.map(([code, libelle, s, p]) => {
      tauxChamps[code] = { sal: s ? num(P.taux[code].sal) : null, pat: p ? num(P.taux[code].pat) : null };
      return h('tr', null, h('td', null, libelle), h('td', null, tauxChamps[code].sal || h('span', { class: 'muet' }, '—')), h('td', null, tauxChamps[code].pat || h('span', { class: 'muet' }, '—')));
    })));

  const lire = (el) => { const n = lireNombre(el.value); return Number.isFinite(n) ? n : 0; };
  async function enregistrer(e) {
    e.preventDefault();
    const taux = {};
    Object.entries(tauxChamps).forEach(([code, c]) => { taux[code] = { sal: c.sal ? lire(c.sal) : 0, pat: c.pat ? lire(c.pat) : 0 }; });
    const parametres = {
      annee: lire(B.annee), smicHoraire: lire(B.smicHoraire), pmss: lire(B.pmss), effectif: B.effectif.value,
      employeur: Object.fromEntries(Object.entries(E).map(([k, el]) => [k, el.value.trim()])),
      tauxAT: lire(B.tauxAT), tauxMobilite: lire(B.tauxMobilite), panier: lire(B.panier), deductionHS: lire(B.deductionHS),
      mutuelle: { sal: lire(B.mutSal), pat: lire(B.mutPat) }, prevoyance: { sal: lire(B.prevSal), pat: lire(B.prevPat) },
      majorations: { nuit: lire(B.majNuit), dimanche: lire(B.majDim), ferie: lire(B.majFerie) },
      seuilMaladie: lire(B.seuilMaladie), seuilFamille: lire(B.seuilFamille), reductionHSMax: lire(B.reductionHSMax),
      reduction: { active: B.rgActive.checked, tmin: lire(B.rgTmin), tdelta: lire(B.rgTdelta), tdelta50: lire(B.rgTdelta50), p: lire(B.rgP) },
      taux,
    };
    try { await api('paie.parametres.enregistrer', { parametres }); toast('Paramètres de paie enregistrés. Ils s’appliquent aux bulletins en brouillon.'); } catch (err) { erreur(err); }
  }
  async function reinitialiser() {
    if (!(await confirmer('Remettre tous les taux de cotisation aux valeurs par défaut ? L’employeur et vos montants (AT, mutuelle, panier…) sont conservés.', { ok: 'Remettre par défaut' }))) return;
    Object.entries(tauxChamps).forEach(([code, c]) => {
      if (c.sal) c.sal.value = nombre4.format(PARAMS_DEFAUT.taux[code].sal);
      if (c.pat) c.pat.value = nombre4.format(PARAMS_DEFAUT.taux[code].pat);
    });
    toast('Taux remis par défaut : cliquez sur « Enregistrer » pour confirmer.');
  }
  const carte = (titre, sous, ...contenu) => h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, titre), sous ? h('small', null, sous) : null), contenu);

  ctx.afficher(onglets('parametres'), avertissement(),
    h('form', { class: 'parametres', onsubmit: enregistrer },
      carte('Employeur', 'En haut de chaque bulletin',
        h('div', { class: 'form-grille form-grille--2' }, champ('Raison sociale', E.nom), champ('Adresse', E.adresse), champ('SIRET', E.siret), champ('Code APE', E.ape), champ('N° URSSAF', E.urssaf), champ('Convention collective', E.convention))),
      carte('Barèmes de l’année', 'À mettre à jour chaque 1er janvier',
        h('div', { class: 'form-grille form-grille--2' },
          champ('Année', B.annee), champ('SMIC horaire brut (€)', B.smicHoraire),
          champ('Plafond mensuel de la sécurité sociale (€)', B.pmss), champ('Effectif de l’entreprise', B.effectif, 'Change certains taux (FNAL, formation, versement mobilité…).'))),
      carte('Propre à votre entreprise', 'Ces montants dépendent de vos contrats',
        h('div', { class: 'form-grille form-grille--2' },
          champ('Taux accidents du travail (%)', B.tauxAT, 'Votre taux AT/MP : compte AT/MP sur net-entreprises.fr.'),
          champ('Versement mobilité (%)', B.tauxMobilite, 'Dû à partir de 11 salariés. Paris : taux IDFM.'),
          champ('Mutuelle — part salarié (€/mois)', B.mutSal), champ('Mutuelle — part employeur (€/mois)', B.mutPat, 'L’employeur paie au moins 50 %.'),
          champ('Prévoyance — part salarié (% tranche 1)', B.prevSal), champ('Prévoyance — part employeur (% tranche 1)', B.prevPat, 'Selon votre contrat de prévoyance (obligatoire dans la convention).'),
          champ('Indemnité de panier (€ par panier)', B.panier, 'Montant fixé par la convention collective. Compté pour chaque vacation de 6 h et plus.'),
          champ('Déduction patronale par heure sup. (€)', B.deductionHS, 'Entreprises de moins de 20 salariés.'))),
      carte('Majorations (convention collective)', 'En % du taux horaire',
        h('div', { class: 'form-grille form-grille--2' }, champ('Heures de nuit (%)', B.majNuit), champ('Heures du dimanche (%)', B.majDim), champ('Heures des jours fériés (%)', B.majFerie))),
      h('details', { class: 'avance' }, h('summary', null, icone('reglages'), 'Taux de cotisation', h('small', null, 'valeurs par défaut à faire confirmer par votre comptable')),
        carte('Taux de cotisation', null,
          h('div', { class: 'tableau-defil' }, tableTaux),
          h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: reinitialiser }, 'Remettre les taux par défaut')),
        carte('Seuils et réduction générale', null,
          h('div', { class: 'form-grille form-grille--2' },
            champ('Seuil maladie taux réduit (× SMIC)', B.seuilMaladie), champ('Seuil allocations familiales taux réduit (× SMIC)', B.seuilFamille),
            champ('Réduction salariale heures sup. (max %)', B.reductionHSMax),
            h('label', { class: 'champ champ--case' }, B.rgActive, h('span', null, 'Appliquer la réduction générale des cotisations patronales')),
            champ('Réduction générale — Tmin', B.rgTmin), champ('Réduction générale — Tdelta (moins de 50)', B.rgTdelta),
            champ('Réduction générale — Tdelta (50 et plus)', B.rgTdelta50), champ('Réduction générale — exposant P', B.rgP)))),
      h('div', { class: 'barre-enregistrer' }, h('button', { class: 'btn btn--gold', type: 'submit' }, icone('coche'), 'Enregistrer les paramètres de paie'))));
}
