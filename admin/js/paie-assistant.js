/* =========================================================
   ESPACE ADMIN BDA — fiches de paie : assistant de déclaration
   Comme sur TESE : on répond aux questions une par une
   (salarié, heures, absences, primes, paiement), l'aperçu du net
   se met à jour en direct, puis on valide le bulletin.
   ========================================================= */
import { api, h, icone, toast, erreur, confirmer, champ, saisie, attendre, nombre, fmtHeures, lireHeures, lireNombre, isoVersFr } from './outils.js';
import { calculerBulletin, PROFIL_DEFAUT, VARIABLES_DEFAUT, HEURES_MENSUELLES } from './paie-calcul.js';
import {
  fmtE, fmtT, nombre4, libelleMois, finDeMois, parametresComplets, completude, barreCompletude, variablesDepuisPlanning,
  dessinerBulletin, ajusterZoom, question, choixCartes,
} from './paie-commun.js';

const PRIMES_RAPIDES = [
  ['Prime exceptionnelle', true], ['Prime d’ancienneté', true], ['Prime d’habillage', true], ['Prime de maître-chien', true],
  ['Prime de fin d’année', true], ['Remboursement de frais', false], ['Autre prime', true],
];

export async function assistantDeclaration(ctx, id) {
  const res = await api('paie.bulletin', undefined, { id });
  const b = res.bulletin;
  if (b.statut === 'valide') { ctx.aller(`#/paie/bulletin/${id}`); return; }
  const mois = b.mois;
  const data = b.data || {};
  const V = (data.variables = { ...VARIABLES_DEFAUT, ...(data.variables || {}) });
  if (!Array.isArray(V.primes)) V.primes = [];
  data.datePaiement ||= finDeMois(mois);
  data.reponses ||= {};
  const agent = res.agent || { nom: data.profil?.nom || 'Agent supprimé', poste: '' };
  const profil = { ...PROFIL_DEFAUT, ...(res.profil || {}) };
  const P = parametresComplets(res.parametres, res.entreprise);
  const { planning } = await api('planning', undefined, { mois });
  const PL = variablesDepuisPlanning(planning, mois, agent.nom, profil);
  let etape = Math.min(Math.max(+data.etape || 0, 0), 5);
  let R;
  const calc = () => { R = calculerBulletin(V, profil, P, res.cumuls || {}); return R; };
  calc();

  /* ----- Enregistrement automatique ----- */
  const indicateur = h('span', { class: 'etat-save is-ok' }, '✓ À jour');
  const marquer = (txt, cls) => { indicateur.textContent = txt; indicateur.className = `etat-save ${cls || ''}`; };
  async function enregistrer(statut = 'brouillon') {
    marquer('Enregistrement…', 'is-encours');
    data.params = P;
    data.profil = { ...profil, nom: agent.nom };
    data.resultat = R;
    data.etape = etape;
    try {
      await api('paie.bulletin.enregistrer', { id, agent_id: b.agent_id, mois, statut, data, brut: R.brut, net: R.netPaye });
      marquer('✓ Enregistré', 'is-ok');
      return true;
    } catch (e) { marquer('Non enregistré', 'is-erreur'); erreur(e); return false; }
  }
  const plusTard = attendre(() => enregistrer(), 800);
  const enregistrerProfil = attendre(async () => {
    try { await api('paie.salarie.enregistrer', { agent_id: b.agent_id, profil }); } catch (e) { erreur(e); }
  }, 700);
  // Répondre aux questions remet le calcul automatique (les lignes tapées sur la feuille sont recalculées)
  const change = () => { V.gains = null; calc(); majApercu(); marquer('Modifications…'); plusTard(); };
  const changeProfil = () => { enregistrerProfil(); change(); };

  /* ----- Champs ----- */
  function champNum(label, obj, cle, { heures, aide, euros, surChange, unite } = {}) {
    const val = +obj[cle] || 0;
    const inp = saisie({ inputmode: 'decimal', value: heures ? fmtHeures(val, true) : nombre4.format(val), class: 'input input--grand' });
    inp.addEventListener('focus', () => inp.select());
    inp.addEventListener('input', () => {
      const n = heures ? lireHeures(inp.value) : lireNombre(inp.value);
      const ok = Number.isFinite(n) && n >= 0;
      inp.classList.toggle('is-bad', !ok);
      if (ok) { obj[cle] = n; (surChange || change)(); }
    });
    return champ(label, h('div', { class: 'assist-saisie' }, inp, h('span', null, unite ?? (heures ? 'h' : euros ? '€' : 'j'))), aide);
  }
  const info = (ic, ...contenu) => h('div', { class: 'assist-info' }, icone(ic), h('div', null, contenu));

  /* ----- Mise en page ----- */
  const listeEtapes = h('ol', { class: 'assist-etapes' });
  const corps = h('section', { class: 'assist-corps' });
  const apercu = h('aside', { class: 'assist-apercu' });
  const ETAPES = [
    { titre: 'Le salarié', sous: 'Dossier et rémunération', rendu: etapeSalarie },
    { titre: 'Temps de travail', sous: 'Heures du mois', rendu: etapeTemps },
    { titre: 'Absences', sous: 'Congés, maladie…', rendu: etapeAbsences },
    { titre: 'Primes et frais', sous: 'Paniers, primes, transport', rendu: etapePrimes },
    { titre: 'Paiement', sous: 'Date et mode', rendu: etapePaiement },
    { titre: 'Récapitulatif', sous: 'Vérifier et valider', rendu: etapeRecap },
  ];
  function aller(i) { etape = i; dessiner(); plusTard(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function dessiner() {
    listeEtapes.replaceChildren(...ETAPES.map((e, i) => h('li', null, h('button', {
      type: 'button', class: `assist-etape ${i === etape ? 'is-actif' : ''} ${i < etape ? 'is-fait' : ''}`, onclick: () => aller(i),
    }, h('span', { class: 'assist-etape__n' }, i < etape ? icone('coche') : String(i + 1)), h('span', null, h('b', null, e.titre), h('small', null, e.sous))))));
    const E = ETAPES[etape];
    corps.replaceChildren(
      h('div', { class: 'assist-tete' },
        h('span', { class: 'assist-kicker' }, `Étape ${etape + 1} sur ${ETAPES.length} · ${libelleMois(mois)}`),
        h('h2', null, E.titre),
        h('div', { class: 'assist-progres' }, h('i', { style: { width: `${((etape + 1) / ETAPES.length) * 100}%` } }))),
      h('div', { class: 'assist-contenu' }, E.rendu()),
      h('div', { class: 'assist-nav' },
        etape > 0 ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => aller(etape - 1) }, icone('retour'), 'Retour') : h('span'),
        etape < ETAPES.length - 1 ? h('button', { class: 'btn btn--gold', type: 'button', onclick: () => aller(etape + 1) }, 'Continuer', icone('fleche')) : null));
    majApercu();
  }
  function majApercu() {
    document.querySelectorAll('.js-solde').forEach((e) => { e.textContent = `${nombre.format(R.cp.solde)} jours`; });
    const l = (lib, v, cls = '') => h('div', { class: `assist-apercu__ligne ${cls}` }, h('span', null, lib), h('b', null, fmtE(v)));
    apercu.replaceChildren(...[
      h('h3', null, 'Aperçu en direct'),
      h('p', { class: 'assist-apercu__qui' }, agent.nom, h('small', null, libelleMois(mois))),
      l('Salaire brut', R.brut),
      l('Cotisations salariales', -R.totalSal, 'is-moins'),
      l('Net avant impôt', R.netAvantImpot, 'is-sous'),
      l(`Impôt à la source (${fmtT(R.tauxPas) || '0 %'})`, -R.pas, 'is-moins'),
      R.totalNonSoumis ? l('Frais et indemnités', R.totalNonSoumis) : null,
      R.acompte ? l('Acompte déjà versé', -R.acompte, 'is-moins') : null,
      h('div', { class: 'assist-apercu__net' }, h('span', null, 'Net payé'), h('b', null, fmtE(R.netPaye))),
      h('div', { class: 'assist-apercu__pied' }, h('span', null, 'Coût total employeur'), h('b', null, fmtE(R.coutEmployeur))),
      R.alertes.length ? h('button', { type: 'button', class: 'assist-apercu__alerte', onclick: () => aller(5) }, icone('alerte'), `${R.alertes.length} point${R.alertes.length > 1 ? 's' : ''} à vérifier`) : null,
      indicateur].filter(Boolean));
  }

  /* ===== Étape 1 : le salarié ===== */
  function etapeSalarie() {
    const c = completude(profil);
    const initiales = agent.nom.split(/\s+/).map((m) => m[0]).join('').slice(0, 2).toUpperCase();
    const taux = champNum('Son taux horaire brut', profil, 'tauxHoraire', { euros: true, surChange: changeProfil,
      aide: `Au moins le minimum de sa catégorie dans la convention collective (et jamais sous le SMIC : ${nombre4.format(P.smicHoraire)} €).` });
    return [
      h('div', { class: 'assist-fiche' },
        h('span', { class: 'assist-avatar' }, initiales),
        h('div', { class: 'assist-fiche__id' }, h('b', null, agent.nom),
          h('small', null, [profil.emploi, profil.contrat, profil.dateEntree ? `depuis le ${isoVersFr(profil.dateEntree)}` : ''].filter(Boolean).join(' · '))),
        barreCompletude(profil)),
      c.manquants.length ? info('alerte', h('b', null, 'Dossier incomplet : '), `${c.manquants.join(', ')}. `,
        h('a', { class: 'lien-btn', href: `#/paie/salarie/${b.agent_id}` }, 'Compléter le dossier')) : null,
      h('div', { class: 'q' }, h('p', { class: 'q__texte' }, 'Comment est-il payé ?'),
        choixCartes([['mensuel', 'Mensualisé', 'Même salaire chaque mois (151,67 h), congés payés maintenus'], ['horaire', 'À l’heure', 'Seulement les heures faites, plus les congés pris']],
          profil.mode, (v) => { profil.mode = v; changeProfil(); })),
      h('div', { class: 'q' }, taux),
      question({
        texte: 'Connaissez-vous son taux de prélèvement à la source ?',
        aide: 'Les impôts le transmettent après la première DSN. Sinon, le taux neutre s’applique automatiquement.',
        oui: String(profil.tauxPas ?? '').trim() !== '',
        surChoix: (v) => { if (!v) { profil.tauxPas = ''; changeProfil(); } },
        contenu: champ('Taux personnalisé (%)', saisie({ value: profil.tauxPas, inputmode: 'decimal', class: 'input input--grand', placeholder: 'ex. 2,5', oninput: (e) => { profil.tauxPas = e.target.value.trim().replace(',', '.'); changeProfil(); } })),
      }),
      !profil.nir ? h('div', { class: 'q' }, champ('Son n° de sécurité sociale', saisie({ value: profil.nir, class: 'input input--grand', placeholder: '15 chiffres, sur sa carte Vitale', autocomplete: 'off', oninput: (e) => { profil.nir = e.target.value.trim(); changeProfil(); } }))) : null,
    ];
  }

  /* ===== Étape 2 : temps de travail ===== */
  function etapeTemps() {
    const champsHeures = () => h('div', { class: 'form-grille form-grille--2' },
      champNum('Heures travaillées', V, 'heuresTravaillees', { heures: true }), champNum('Dont heures de nuit', V, 'heuresNuit', { heures: true }),
      champNum('Dont heures du dimanche', V, 'heuresDimanche', { heures: true }), champNum('Dont heures de jours fériés', V, 'heuresFerie', { heures: true }));
    const blocs = [];
    if (PL) {
      blocs.push(info('planning', h('b', null, `Planning — ${libelleMois(mois)} : ${fmtHeures(PL.heuresTravaillees)}`), ` sur ${PL.joursTravailles} jour${PL.joursTravailles > 1 ? 's' : ''}`,
        h('br'), h('small', null, `Dont ${fmtHeures(PL.heuresNuit)} de nuit · ${fmtHeures(PL.heuresDimanche)} le dimanche · ${fmtHeures(PL.heuresFerie)} de jours fériés`)));
      const corrige = data.reponses.corrigerHeures === true;
      blocs.push(question({
        texte: 'Faut-il corriger ces heures ?', aide: 'Répondez « Non » si le planning est juste : les heures sont reprises telles quelles.', oui: corrige,
        surChoix: (v) => {
          data.reponses.corrigerHeures = v;
          if (!v) ['heuresTravaillees', 'heuresNuit', 'heuresDimanche', 'heuresFerie', 'hs25', 'hs50'].forEach((k) => { V[k] = PL[k]; });
          change(); dessiner();
        },
        contenu: corrige ? champsHeures() : null,
      }));
    } else {
      blocs.push(info('alerte', h('b', null, 'Aucune heure au planning'), ` pour ${agent.nom} en ${libelleMois(mois)}. Saisissez-les ici ou remplissez d’abord le planning.`), champsHeures());
    }
    if (profil.mode !== 'horaire') blocs.push(info('personne', h('b', null, 'Salarié mensualisé : '), `son salaire de base est fixe (${fmtHeures(+profil.heuresContrat || HEURES_MENSUELLES)} par mois). Les heures servent aux majorations (nuit, dimanche, fériés) et aux heures supplémentaires.`));
    blocs.push(question({
      texte: 'A-t-il fait des heures supplémentaires ?',
      aide: `Au-delà de 35 h par semaine. Payées +25 % (les 8 premières par semaine), puis +50 %.${PL && (PL.hs25 || PL.hs50) ? ` D’après le planning : ${fmtHeures(PL.hs25 + PL.hs50)}.` : ''}`,
      oui: V.hs25 + V.hs50 > 0,
      surChoix: (v) => { if (!v) { V.hs25 = 0; V.hs50 = 0; } else if (PL && !(V.hs25 + V.hs50)) { V.hs25 = PL.hs25; V.hs50 = PL.hs50; } change(); dessiner(); },
      contenu: h('div', { class: 'form-grille form-grille--2' }, champNum('Heures à +25 %', V, 'hs25', { heures: true }), champNum('Heures à +50 %', V, 'hs50', { heures: true })),
    }));
    return blocs;
  }

  /* ===== Étape 3 : absences ===== */
  function etapeAbsences() {
    const q = (texte, aide, cle, defaut) => question({
      texte, aide, oui: +V[cle] > 0,
      surChoix: (v) => { V[cle] = v ? (+V[cle] || defaut || 1) : 0; change(); dessiner(); },
      contenu: champNum('Nombre de jours', V, cle),
    });
    return [
      q(`A-t-il pris des congés payés en ${libelleMois(mois).toLowerCase()} ?`,
        `En jours ouvrables (du lundi au samedi, sans les dimanches ni les fériés).${PL?.joursCP ? ` Le planning indique ${PL.joursCP} jour${PL.joursCP > 1 ? 's' : ''} « CP ».` : ''}${profil.mode === 'horaire' ? ' Payé à l’heure : chaque jour de congé est payé comme une journée de travail.' : ' Mensualisé : son salaire est maintenu.'}`,
        'joursCP', PL?.joursCP),
      q('A-t-il été en arrêt maladie ou en accident du travail ?',
        `Les jours d’arrêt sont retirés du salaire ; la Sécurité sociale lui verse des indemnités journalières. Pensez à l’attestation de salaire sur net-entreprises.${PL?.joursMaladie ? ` Le planning indique ${PL.joursMaladie} jour${PL.joursMaladie > 1 ? 's' : ''} « M » ou « AT ».` : ''}`,
        'joursMaladie', PL?.joursMaladie),
      q('A-t-il eu des absences non payées ?', `Absence injustifiée, congé sans solde…${PL?.joursAbsence ? ` Le planning indique ${PL.joursAbsence} jour${PL.joursAbsence > 1 ? 's' : ''} « ABS ».` : ''}`, 'joursAbsence', PL?.joursAbsence),
      h('div', { class: 'q' }, champNum('Congés acquis ce mois', V, 'cpAcquis', { aide: '2,5 jours par mois travaillé (30 jours par an).' }),
        h('p', { class: 'q__aide' }, 'Solde de congés après ce mois : ', h('b', { class: 'js-solde' }, `${nombre.format(R.cp.solde)} jours`))),
    ];
  }

  /* ===== Étape 4 : primes et frais ===== */
  function etapePrimes() {
    const liste = h('div', { class: 'paie-primes' });
    const dessinerPrimes = () => liste.replaceChildren(...V.primes.map((p, i) => {
      const lib = saisie({ value: p.libelle || '', placeholder: 'Libellé', oninput: (e) => { p.libelle = e.target.value; change(); } });
      const mt = saisie({ value: nombre.format(+p.montant || 0), inputmode: 'decimal', class: 'input paie-prime__montant', oninput: (e) => { const n = lireNombre(e.target.value); if (Number.isFinite(n)) { p.montant = n; change(); } } });
      mt.addEventListener('focus', () => mt.select());
      return h('div', { class: 'paie-prime paie-prime--ligne' }, lib, mt,
        h('select', { class: 'input', onchange: (e) => { p.soumis = e.target.value === 'oui'; change(); } },
          h('option', { value: 'oui', selected: p.soumis !== false }, 'Soumise à cotisations'), h('option', { value: 'non', selected: p.soumis === false }, 'Non soumise (frais)')),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer', onclick: () => { V.primes.splice(i, 1); dessinerPrimes(); change(); } }, icone('croix')));
    }));
    dessinerPrimes();
    const rapides = h('div', { class: 'chips' }, PRIMES_RAPIDES.map(([lib, soumis]) => h('button', { type: 'button', class: 'chip', onclick: () => {
      V.primes.push({ libelle: lib, montant: 0, soumis });
      dessinerPrimes(); change();
      liste.querySelectorAll('.paie-prime__montant')[V.primes.length - 1]?.focus();
    } }, icone('plus'), lib)));
    return [
      +P.panier > 0 ? question({
        texte: 'Lui verse-t-on des indemnités de panier ?',
        aide: `${fmtE(P.panier)} par panier, non soumis à cotisations.${PL ? ` Le planning compte ${PL.paniers} vacation${PL.paniers > 1 ? 's' : ''} de 6 h ou plus.` : ''}`,
        oui: +V.paniers > 0,
        surChoix: (v) => { V.paniers = v ? (+V.paniers || PL?.paniers || 1) : 0; change(); dessiner(); },
        contenu: champNum('Nombre de paniers', V, 'paniers', { unite: '' }),
      }) : info('alerte', 'Indemnité de panier non réglée : indiquez son montant dans ', h('a', { class: 'lien-btn', href: '#/paie/parametres' }, 'Paramètres de paie'), '.'),
      h('div', { class: 'q' }, h('p', { class: 'q__texte' }, 'Une prime ou un remboursement ce mois-ci ?'), h('small', { class: 'q__aide' }, 'Cliquez pour ajouter, puis indiquez le montant.'), rapides, liste),
      question({
        texte: 'Lui rembourse-t-on son abonnement de transport (Navigo) ?',
        aide: 'Obligatoire : l’employeur rembourse 50 % de l’abonnement, sans cotisations. Le montant est gardé pour les mois suivants.',
        oui: +profil.navigo > 0,
        surChoix: (v) => { if (!v) { profil.navigo = 0; changeProfil(); } },
        contenu: champNum('Montant remboursé par mois', profil, 'navigo', { euros: true, surChange: changeProfil }),
      }),
      question({
        texte: 'Lui avez-vous déjà versé un acompte ce mois-ci ?', aide: 'Il sera déduit du net à payer.', oui: +V.acompte > 0,
        surChoix: (v) => { if (!v) { V.acompte = 0; change(); } },
        contenu: champNum('Montant de l’acompte', V, 'acompte', { euros: true }),
      }),
    ];
  }

  /* ===== Étape 5 : paiement ===== */
  function etapePaiement() {
    const mode = V.modePaiement || profil.modePaiement || 'Virement';
    const alerte = h('div');
    const majAlerte = () => alerte.replaceChildren((V.modePaiement || mode) === 'Espèces' && R.netPaye > 1500
      ? info('alerte', h('b', null, 'Interdit : '), 'un salaire de plus de 1 500 € nets ne peut pas être payé en espèces. Choisissez le virement ou le chèque.') : '');
    majAlerte();
    return [
      h('div', { class: 'q' }, h('p', { class: 'q__texte' }, 'Comment le payez-vous ?'),
        choixCartes([['Virement', 'Virement', 'Le plus simple, avec une trace'], ['Chèque', 'Chèque', ''], ['Espèces', 'Espèces', 'Jusqu’à 1 500 € seulement']], mode,
          (v) => { V.modePaiement = v; profil.modePaiement = v; changeProfil(); majAlerte(); }),
        alerte),
      h('div', { class: 'q' }, champ('À quelle date ?', h('input', { class: 'input input--grand', type: 'date', value: data.datePaiement, onchange: (e) => { data.datePaiement = e.target.value; change(); } }),
        'En général le dernier jour du mois, ou au plus tard dans les premiers jours du mois suivant.')),
    ];
  }

  /* ===== Étape 6 : récapitulatif ===== */
  function etapeRecap() {
    const l = (lib, v, cls = '') => h('div', { class: `assist-recap__ligne ${cls}` }, h('span', null, lib), h('b', null, fmtE(v)));
    const feuille = h('div', { class: 'feuille bp' });
    const zone = h('div', { class: 'feuille-zone', hidden: true }, feuille);
    const voir = h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => {
      zone.hidden = !zone.hidden;
      voir.lastChild.textContent = zone.hidden ? 'Voir le bulletin complet' : 'Masquer le bulletin';
      if (!zone.hidden) { dessinerBulletin(feuille, { R, pr: profil, P, agent, mois, datePaiement: data.datePaiement }); ajusterZoom(zone, feuille); }
    } }, icone('oeilv'), h('span', null, 'Voir le bulletin complet'));
    const puce = (t) => h('span', { class: 'assist-puce' }, t);
    return [
      R.alertes.length ? h('div', { class: 'assist-alertes' }, h('b', null, icone('alerte'), 'À vérifier avant de valider'), h('ul', null, R.alertes.map((a) => h('li', null, a)))) : info('coche', h('b', null, 'Tout est prêt.'), ' Vérifiez les montants puis validez.'),
      h('div', { class: 'assist-puces' },
        puce(`${fmtHeures(R.heuresMois)} payées`), V.hs25 + V.hs50 ? puce(`${fmtHeures(V.hs25 + V.hs50)} sup.`) : null,
        V.joursCP ? puce(`${nombre.format(V.joursCP)} j de congés`) : null, V.joursMaladie ? puce(`${nombre.format(V.joursMaladie)} j d’arrêt`) : null,
        V.paniers ? puce(`${V.paniers} paniers`) : null, puce(`${V.modePaiement || profil.modePaiement || 'Virement'} le ${isoVersFr(data.datePaiement)}`)),
      h('div', { class: 'assist-recap' },
        l('Salaire brut', R.brut, 'is-fort'),
        l('Cotisations salariales', -R.totalSal, 'is-moins'),
        l('Net à payer avant impôt', R.netAvantImpot),
        l(`Impôt prélevé à la source (${fmtT(R.tauxPas) || '0 %'})`, -R.pas, 'is-moins'),
        R.totalNonSoumis ? l('Frais et indemnités (non soumis)', R.totalNonSoumis) : null,
        R.acompte ? l('Acompte déjà versé', -R.acompte, 'is-moins') : null,
        h('div', { class: 'assist-recap__net' }, h('span', null, 'Net payé au salarié'), h('b', null, fmtE(R.netPaye))),
        l('Cotisations patronales (après allègements)', R.totalPat),
        l('Coût total pour l’entreprise', R.coutEmployeur, 'is-fort')),
      h('div', { class: 'assist-fin' },
        h('button', { class: 'btn btn--gold btn--grand', type: 'button', onclick: valider }, icone('coche'), 'Valider le bulletin'),
        voir,
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: async () => { plusTard.annuler(); if (await enregistrer()) { toast('Déclaration enregistrée : vous pourrez la reprendre plus tard.'); ctx.aller(`#/paie/${mois}`); } } }, 'Finir plus tard'),
        h('a', { class: 'lien-btn', href: `#/paie/bulletin/${id}` }, 'Modifier en détail')),
      zone,
    ];
  }
  async function valider() {
    const msg = R.alertes.length
      ? `Il reste ${R.alertes.length} point${R.alertes.length > 1 ? 's' : ''} à vérifier. Valider quand même le bulletin de ${agent.nom} ? Il sera figé et comptera dans les cumuls de l’année.`
      : `Valider le bulletin de ${agent.nom} pour ${libelleMois(mois).toLowerCase()} ? Il sera figé et comptera dans les cumuls de l’année.`;
    if (!(await confirmer(msg, { titre: 'Valider le bulletin', ok: 'Valider' }))) return;
    plusTard.annuler();
    calc();
    if (await enregistrer('valide')) {
      toast('Bulletin validé. Vous pouvez le télécharger en PDF.');
      ctx.aller(`#/paie/bulletin/${id}`);
    }
  }

  ctx.titre(`Déclarer — ${agent.nom}`);
  ctx.actions(h('a', { class: 'btn btn--ghost', href: `#/paie/${mois}` }, icone('retour'), h('span', null, libelleMois(mois))));
  ctx.afficher(h('div', { class: 'assistant' }, h('nav', { class: 'assist-cote', 'aria-label': 'Étapes' }, listeEtapes), corps, apercu));
  dessiner();
}
