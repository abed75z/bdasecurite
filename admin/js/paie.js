/* =========================================================
   ESPACE ADMIN BDA — fiches de paie
   Paie du mois (tableau de bord), bulletin en détail, paramètres.
   Assistant de déclaration : paie-assistant.js · Salariés :
   paie-salaries.js · Documents : paie-docs.js. Réservé à l'admin.
   ========================================================= */
import {
  api, h, $$, icone, toast, erreur, confirmer, champ, saisie, zoneTexte, attendre,
  fmtHeures, lireNombre, iso, isoVersFr, frVersDate,
} from './outils.js';
import { telechargerPdf } from './pdf.js';
import { imprimerFeuille } from './documents.js';
import { calculerBulletin, completerParams, PARAMS_DEFAUT, PROFIL_DEFAUT, VARIABLES_DEFAUT, LIBELLES_TAUX } from './paie-calcul.js';
import {
  fmtE, nombre4, normNom, libelleMois, moisCourant, decaler, finDeMois, pastilleBulletin, onglets, avertissement,
  parametresComplets, completude, barreCompletude, variablesDepuisPlanning, creerBulletin, ajusterZoom, dessinerBulletin,
} from './paie-commun.js';
import { assistantDeclaration } from './paie-assistant.js';
import { pageSalaries, dossierSalarie } from './paie-salaries.js';
import { pageDocuments } from './paie-docs.js';

export async function pagePaie(ctx) {
  const [a, b] = ctx.params;
  if (a === 'declarer' && /^\d+$/.test(b || '')) return assistantDeclaration(ctx, +b);
  if (a === 'bulletin' && /^\d+$/.test(b || '')) return editeurBulletin(ctx, +b);
  if (a === 'salaries') return pageSalaries(ctx);
  if (a === 'salarie' && /^\d+$/.test(b || '')) return dossierSalarie(ctx, +b);
  if (a === 'documents') return pageDocuments(ctx, ctx.params.slice(1));
  if (a === 'parametres') return pageParametres(ctx);
  return tableauDeBord(ctx, /^\d{4}-\d{2}$/.test(a || '') ? a : moisCourant());
}

/* =========================================================
   PAIE DU MOIS : les étapes, puis un salarié par ligne
   ========================================================= */
async function tableauDeBord(ctx, mois) {
  ctx.titre('Fiches de paie');
  const [{ bulletins }, { agents }, { planning }, prm] = await Promise.all([
    api('paie.bulletins', undefined, { mois, complet: 1 }), api('paie.salaries'), api('planning', undefined, { mois }), api('paie.parametres'),
  ]);
  const P = parametresComplets(prm.parametres, prm.entreprise);
  const lignesPlanning = planning?.agents || [];
  const auPlanning = (a) => lignesPlanning.some((l) => normNom(l.nom) === normNom(a.nom));
  const bulletinDe = (a) => bulletins.find((x) => +x.agent_id === +a.id);
  const salaries = agents.filter((a) => auPlanning(a) || bulletinDe(a));
  const orphelins = bulletins.filter((x) => !agents.some((a) => +a.id === +x.agent_id));
  const inconnus = lignesPlanning.map((l) => l.nom).filter((nom) => nom && !agents.some((a) => normNom(a.nom) === normNom(nom)));
  const aDeclarer = salaries.filter((a) => !bulletinDe(a));
  const valides = bulletins.filter((x) => x.statut === 'valide');
  const incomplets = salaries.filter((a) => completude(a.profil).pct < 100);
  const somme = (liste, f) => Math.round(liste.reduce((s, x) => s + (+f(x) || 0), 0) * 100) / 100;
  const netAVerser = somme(valides, (x) => x.net);
  const aReverser = somme(valides, (x) => { const r = x.data?.resultat || {}; return (+r.totalSal || 0) + (+r.totalPat || 0) + (+r.pas || 0); });
  const [y, m] = mois.split('-').map(Number);
  const echeance = new Date(y, m, P.effectif === '50plus' ? 5 : 15);

  async function declarer(a) {
    try {
      const id = bulletinDe(a)?.id || await creerBulletin(a, mois, planning, P);
      ctx.aller(`#/paie/bulletin/${id}`);
    } catch (e) { erreur(e); }
  }
  async function toutPreparer() {
    try {
      for (const a of aDeclarer) await creerBulletin(a, mois, planning, P);
      toast(`${aDeclarer.length} déclaration${aDeclarer.length > 1 ? 's' : ''} préparée${aDeclarer.length > 1 ? 's' : ''} depuis le planning.`);
      await tableauDeBord(ctx, mois);
    } catch (e) { erreur(e); }
  }
  ctx.actions(aDeclarer.length > 1 ? h('button', { class: 'btn btn--gold', type: 'button', onclick: toutPreparer }, icone('eclair'), h('span', null, `Tout préparer (${aDeclarer.length})`)) : null);

  const nav = h('div', { class: 'mois-nav' },
    h('a', { class: 'icon-btn', href: `#/paie/${decaler(mois, -1)}`, 'aria-label': 'Mois précédent' }, icone('retour')),
    h('b', null, libelleMois(mois)),
    h('a', { class: 'icon-btn', href: `#/paie/${decaler(mois, 1)}`, 'aria-label': 'Mois suivant' }, icone('suivant')),
    mois !== moisCourant() ? h('a', { class: 'lien-btn', href: '#/paie' }, 'Revenir au mois en cours') : null);

  const etape = (n, etat, titre, texte, lien, libelle) => h(typeof lien === 'function' ? 'button' : 'a', { class: `paie-etape is-${etat}`, ...(typeof lien === 'function' ? { type: 'button', onclick: lien } : { href: lien }) },
    h('span', { class: 'paie-etape__n' }, etat === 'ok' ? icone('coche') : String(n)),
    h('b', null, titre), h('small', null, texte), h('span', { class: 'paie-etape__lien' }, libelle, icone('suivant')));
  const etapes = h('div', { class: 'paie-etapes' },
    etape(1, lignesPlanning.length ? 'ok' : 'todo', 'Planning du mois', lignesPlanning.length ? `${lignesPlanning.length} agent${lignesPlanning.length > 1 ? 's' : ''} au planning` : 'Pas encore rempli', `#/planning/${mois}`, 'Ouvrir le planning'),
    etape(2, salaries.length && !incomplets.length ? 'ok' : 'todo', 'Dossiers des salariés', incomplets.length ? `${incomplets.length} dossier${incomplets.length > 1 ? 's' : ''} à compléter` : salaries.length ? 'Tous complets' : '—', '#/paie/salaries', 'Voir les salariés'),
    etape(3, salaries.length && valides.length === salaries.length ? 'ok' : 'todo', 'Déclarations', salaries.length ? `${valides.length} validée${valides.length > 1 ? 's' : ''} sur ${salaries.length}` : 'Aucun salarié ce mois-ci', () => document.getElementById('paie-liste')?.scrollIntoView({ behavior: 'smooth' }), 'Déclarer'),
    etape(4, 'info', 'Payer les salaires', valides.length ? `${fmtE(netAVerser)} à verser` : 'Après validation', `#/paie/documents/virements/${mois}`, 'Liste des virements'),
    etape(5, 'info', 'DSN et cotisations', valides.length ? `${fmtE(aReverser)} · avant le ${isoVersFr(iso(echeance))}` : `Avant le ${isoVersFr(iso(echeance))}`, `#/paie/documents/cotisations/${mois}`, 'Récapitulatif'));

  const ligne = (a) => {
    const bul = bulletinDe(a);
    const action = !bul ? h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: () => declarer(a) }, 'Faire la fiche')
      : bul.statut === 'brouillon' ? h('a', { class: 'btn btn--ghost btn--petit', href: `#/paie/bulletin/${bul.id}` }, 'Continuer')
        : h('a', { class: 'btn btn--ghost btn--petit', href: `#/paie/bulletin/${bul.id}` }, icone('oeilv'), 'Bulletin');
    return h('tr', null,
      h('td', null, h('a', { class: 'paie-nom', href: `#/paie/salarie/${a.id}` }, h('b', null, a.nom)), h('small', { class: 'muet paie-poste' }, auPlanning(a) ? a.poste : `${a.poste} · hors planning`)),
      h('td', null, barreCompletude(a.profil)),
      h('td', null, pastilleBulletin(bul?.statut)),
      h('td', { class: 'num' }, bul ? h('b', null, fmtE(bul.net)) : h('span', { class: 'muet' }, '—')),
      h('td', { class: 'paie-action' }, action));
  };
  const autres = agents.filter((a) => +a.actif && !salaries.includes(a));
  const choix = h('select', { class: 'input input--auto', onchange: () => { const a = agents.find((x) => String(x.id) === choix.value); choix.value = ''; if (a) declarer(a); } },
    h('option', { value: '' }, '+ Déclarer un autre agent…'), autres.map((a) => h('option', { value: a.id }, `${a.nom} (${a.poste})`)));

  ctx.afficher(onglets('mois'), nav, etapes,
    h('section', { class: 'carte', id: 'paie-liste' },
      h('header', { class: 'carte__tete' }, h('h2', null, 'Salariés du mois'), h('small', null, 'Un clic sur « Faire la fiche » : la fiche s’ouvre, remplie avec le planning, et tout se modifie dessus')),
      h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
        h('thead', null, h('tr', null, h('th', null, 'Salarié'), h('th', null, 'Dossier'), h('th', null, 'Déclaration'), h('th', { class: 'num' }, 'Net payé'), h('th'))),
        h('tbody', null, salaries.length || orphelins.length
          ? [...salaries.map(ligne), ...orphelins.map((x) => h('tr', null, h('td', null, h('b', null, 'Agent supprimé')), h('td'), h('td', null, pastilleBulletin(x.statut)), h('td', { class: 'num' }, fmtE(x.net)), h('td', { class: 'paie-action' }, h('a', { class: 'btn btn--ghost btn--petit', href: `#/paie/bulletin/${x.id}` }, 'Bulletin'))))]
          : h('tr', null, h('td', { colspan: 5, class: 'vide-ligne' }, planning ? 'Aucun agent du planning ne correspond à vos agents enregistrés.' : `Pas de planning pour ${libelleMois(mois)} : remplissez-le d’abord, ou déclarez un agent ci-dessous.`))))),
      h('div', { class: 'carte__outils' }, choix)),
    inconnus.length ? h('p', { class: 'astuce' }, `Dans le planning mais pas dans vos agents : ${inconnus.join(', ')}. Ajoutez-les dans « Agents » (même nom) pour les déclarer.`) : null,
    avertissement());
}

/* =========================================================
   LA FICHE DE PAIE : tout se modifie directement sur la feuille
   (heures, taux, primes, adresse, taux de cotisation…)
   ========================================================= */
async function editeurBulletin(ctx, id) {
  const res = await api('paie.bulletin', undefined, { id });
  if (!res.parametres || Array.isArray(res.parametres)) res.parametres = {};
  const b = res.bulletin;
  const mois = b.mois;
  const data = b.data || {};
  const V = (data.variables = { ...VARIABLES_DEFAUT, ...(data.variables || {}) });
  if (!Array.isArray(V.primes)) V.primes = [];
  data.datePaiement ||= finDeMois(mois);
  if (!data.surcharges || Array.isArray(data.surcharges)) data.surcharges = {};
  const agent = res.agent || { nom: data.profil?.nom || 'Agent supprimé', poste: '' };
  let statut = b.statut;
  const fige = () => statut === 'valide';
  const profilCourant = { ...PROFIL_DEFAUT, ...(res.profil || {}) };
  const params = () => ({ ...(fige() && data.params ? completerParams(data.params) : parametresComplets(res.parametres, res.entreprise)), surcharges: data.surcharges });
  const profil = () => (fige() && data.profil ? { ...PROFIL_DEFAUT, ...data.profil } : profilCourant);

  const feuille = h('div', { class: 'feuille bp' });
  const panneau = h('aside', { class: 'panneau' });
  let R;
  const calc = () => { R = calculerBulletin(V, profil(), params(), res.cumuls || {}); };
  const figerLignes = () => { calc(); V.gains = R.gains.map(({ libelle, base, taux, montant, cle, coef, signe }) => ({ libelle, base, taux, montant, cle, coef: coef ?? null, signe: signe || 1 })); };
  const edit = { maj, ajouterLigne, retirerLigne, ajouterIndemnite };
  function dessiner() {
    calc();
    dessinerBulletin(feuille, { R, pr: profil(), P: params(), agent, mois, datePaiement: data.datePaiement, V, edit: fige() ? null : edit });
    construirePanneau();
  }
  // Après un changement : on redessine la feuille et on garde le curseur sur la case suivante
  function rafraichir() {
    setTimeout(() => {
      const suivant = document.activeElement?.dataset?.k;
      dessiner();
      if (suivant) feuille.querySelector(`[data-k="${CSS.escape(suivant)}"]`)?.focus();
    }, 0);
  }

  /* ----- Enregistrement automatique ----- */
  const indicateur = h('span', { class: 'etat-save is-ok' }, '✓ À jour');
  const marquer = (txt, cls) => { indicateur.textContent = txt; indicateur.className = `etat-save ${cls || ''}`; };
  async function enregistrer() {
    marquer('Enregistrement…', 'is-encours');
    try {
      const { surcharges, ...P } = params();
      data.params = P;
      data.profil = { ...profil(), nom: agent.nom };
      data.resultat = R;
      await api('paie.bulletin.enregistrer', { id, agent_id: b.agent_id, mois, statut, data, brut: R.brut, net: R.netPaye });
      marquer('✓ Enregistré', 'is-ok');
    } catch (e) { marquer('Non enregistré', 'is-erreur'); erreur(e); }
  }
  const plusTard = attendre(enregistrer, 700);
  const sauverProfil = attendre(async () => { try { await api('paie.salarie.enregistrer', { agent_id: b.agent_id, profil: profilCourant }); } catch (e) { erreur(e); } }, 600);
  const sauverParams = attendre(async () => { try { await api('paie.parametres.enregistrer', { parametres: res.parametres }); } catch (e) { erreur(e); } }, 600);
  const modifie = () => { marquer('Modifications…'); plusTard(); };

  /* ----- Une case de la feuille a changé ----- */
  function maj(cle, t) {
    const num = () => { const v = lireNombre(String(t).replace(/[€%]/g, '')); return Number.isFinite(v) ? v : null; };
    const dateIso = () => { const d = frVersDate(t); return d ? iso(d) : null; };
    const refus = (msg) => { toast(msg, 'erreur'); rafraichir(); };
    const p = cle.split('.');
    if (p[0] === 'emp') {
      res.parametres.employeur = { ...params().employeur, [p[1]]: t };
      sauverParams();
    } else if (p[0] === 'sal') {
      if (p[1] === 'tauxHoraire') {
        const v = num();
        if (v == null) return refus('Taux horaire : écrivez un nombre, par exemple 12,31.');
        profilCourant.tauxHoraire = v;
        // Les lignes liées au taux horaire suivent (salaire de base, congés, heures sup, majorations)
        (V.gains || []).forEach((g) => { if (g.coef != null && g.taux !== '' && g.taux != null) g.taux = Math.round(v * g.coef * 10000) / 10000; });
      } else if (p[1] === 'dateEntree') {
        const d = t ? dateIso() : '';
        if (d == null) return refus('Date d’entrée : écrivez-la sous la forme JJ/MM/AAAA.');
        profilCourant.dateEntree = d;
      } else profilCourant[p[1]] = t;
      sauverProfil();
    } else if (cle === 'datePaiement') {
      const d = dateIso();
      if (!d) return refus('Date de paiement : écrivez-la sous la forme JJ/MM/AAAA.');
      data.datePaiement = d;
    } else if (cle === 'mode') {
      V.modePaiement = t;
    } else if (p[0] === 'cp') {
      const v = num();
      if (v == null) return refus('Congés : écrivez un nombre de jours.');
      if (p[1] === 'acquis') V.cpAcquis = v; else V.joursCP = v;
    } else if (p[0] === 'g') {
      const g = V.gains[+p[1]];
      if (!g) return;
      if (p[2] === 'libelle') g.libelle = t;
      else {
        const v = t === '' ? '' : num();
        if (v == null) return refus('Écrivez un nombre, par exemple 40 ou 12,31.');
        if (p[2] === 'base') g.base = v;
        if (p[2] === 'taux') { g.taux = v; g.coef = null; }
        if (p[2] === 'montant') g.montant = v === '' ? 0 : v;
      }
    } else if (p[0] === 'c') {
      const v = t === '' ? null : num();
      if (t !== '' && v == null) return refus('Écrivez un taux, par exemple 6,90.');
      if (p[1] === 'reducGen') data.surcharges.reducGen = v == null ? undefined : { montant: v };
      else data.surcharges[p[1]] = { ...(data.surcharges[p[1]] || {}), [p[2]]: v == null ? undefined : v };
    } else if (p[0] === 'ns') {
      if (p[1] === 'p') {
        const pr = V.primes[+p[2]];
        if (!pr) return;
        if (p[3] === 'libelle') pr.libelle = t;
        else { const v = num(); if (v == null) return refus('Écrivez un montant.'); pr.montant = v; }
      } else {
        const v = num();
        if (v == null) return refus('Écrivez un nombre.');
        if (p[1] === 'paniers') V.paniers = v;
        if (p[1] === 'transport') { profilCourant.navigo = v; sauverProfil(); }
      }
    } else if (cle === 'acompte') {
      const v = num();
      if (v == null) return refus('Écrivez un montant.');
      V.acompte = v;
    } else if (cle === 'pas.taux') {
      profilCourant.tauxPas = String(t).replace('%', '').replace(',', '.').trim();
      sauverProfil();
    }
    rafraichir();
    modifie();
  }
  function focusCase(cle) { setTimeout(() => feuille.querySelector(`[data-k="${CSS.escape(cle)}"]`)?.focus(), 30); }
  function ajouterLigne() {
    V.gains.push({ libelle: 'Prime exceptionnelle', base: '', taux: '', montant: 0, cle: 'prime', coef: null, signe: 1 });
    dessiner(); modifie(); focusCase(`g.${V.gains.length - 1}.libelle`);
  }
  function retirerLigne(i) { V.gains.splice(i, 1); dessiner(); modifie(); }
  function ajouterIndemnite() {
    V.primes.push({ libelle: 'Remboursement de frais', montant: 0, soumis: false });
    dessiner(); modifie(); focusCase(`ns.p.${V.primes.length - 1}.libelle`);
  }

  /* ----- Panneau : juste l'essentiel ----- */
  function construirePanneau() {
    const choixStatut = h('div', { class: 'statuts' },
      h('button', { type: 'button', class: `statut-btn statut-btn--brouillon ${fige() ? '' : 'is-actif'}`, onclick: () => changerStatut('brouillon') }, 'En cours'),
      h('button', { type: 'button', class: `statut-btn statut-btn--payee ${fige() ? 'is-actif' : ''}`, onclick: () => changerStatut('valide') }, 'Validé'));
    const modifsTaux = Object.values(data.surcharges).some((s) => s && Object.values(s).some((x) => x != null));
    panneau.replaceChildren(...[
      h('section', { class: 'panneau__bloc panneau__bloc--espace' }, h('h3', null, 'Net payé'),
        h('b', { class: 'paie-net' }, fmtE(R.netPaye)),
        h('p', { class: 'panneau__astuce' }, fige() ? 'Bulletin validé : il est figé. Repassez-le « En cours » pour le modifier.' : 'Cliquez sur n’importe quel chiffre ou texte de la feuille pour le changer : heures, taux, primes, adresse… Tout se recalcule et s’enregistre tout seul.')),
      h('section', { class: 'panneau__bloc' }, h('h3', null, 'Statut'), choixStatut),
      !fige() && R.alertes.length ? h('section', { class: 'panneau__bloc panneau__bloc--alerte' }, h('h3', null, 'À vérifier'), h('ul', { class: 'bp-alertes' }, R.alertes.map((a) => h('li', null, a)))) : null,
      h('section', { class: 'panneau__bloc' }, h('h3', null, 'Actions'),
        h('button', { class: 'btn btn--gold btn--bloc', type: 'button', onclick: pdf }, icone('telecharger'), 'Télécharger en PDF'),
        h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: imprimer }, icone('imprimer'), 'Imprimer'),
        fige() ? null : h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: reprendrePlanning }, icone('planning'), 'Reprendre les heures du planning'),
        !fige() && modifsTaux ? h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: () => { data.surcharges = {}; dessiner(); modifie(); toast('Taux de cotisation remis comme dans les paramètres.'); } }, 'Annuler mes taux modifiés') : null,
        fige() ? null : h('a', { class: 'lien-btn', href: `#/paie/declarer/${id}` }, icone('eclair'), 'Plutôt répondre aux questions pas à pas'),
        b.agent_id ? h('a', { class: 'lien-btn', href: `#/paie/salarie/${b.agent_id}` }, icone('personne'), 'Dossier du salarié') : null,
        fige() ? null : h('button', { class: 'lien-btn lien-btn--danger', type: 'button', onclick: supprimer }, icone('poubelle'), 'Supprimer cette fiche')),
    ].filter(Boolean));
  }

  const nomFichier = () => `Bulletin de paie ${libelleMois(mois)} - ${agent.nom}`;
  async function pdf() { plusTard.annuler(); await enregistrer(); await telechargerPdf(feuille, nomFichier()); }
  function imprimer() { plusTard.annuler(); enregistrer().then(() => imprimerFeuille(nomFichier())); }
  async function reprendrePlanning() {
    try {
      const { planning } = await api('planning', undefined, { mois });
      const v = variablesDepuisPlanning(planning, mois, agent.nom, profilCourant);
      if (!v) return toast(`${agent.nom} n’apparaît pas dans le planning de ${libelleMois(mois)}.`, 'erreur');
      if (!(await confirmer(`Remplacer les lignes de rémunération par les heures du planning (${fmtHeures(v.heuresTravaillees)}) ? Les primes ajoutées à la main seront retirées.`, { ok: 'Reprendre le planning' }))) return;
      Object.assign(V, v);
      V.gains = null;
      figerLignes();
      dessiner(); modifie();
      toast(`Heures reprises : ${fmtHeures(v.heuresTravaillees)}.`);
    } catch (e) { erreur(e); }
  }
  async function changerStatut(s) {
    if (s === statut) return;
    const ok = s === 'valide'
      ? await confirmer('Valider cette fiche de paie ? Elle sera figée et comptera dans les cumuls de l’année.', { titre: 'Valider la fiche', ok: 'Valider' })
      : await confirmer('Repasser cette fiche « En cours » pour la modifier ?', { titre: 'Modifier la fiche', ok: 'Modifier' });
    if (!ok) return;
    plusTard.annuler();
    if (s === 'valide') {
      const { surcharges, ...P } = params();
      data.params = P;
      data.profil = { ...profilCourant, nom: agent.nom };
    }
    statut = s;
    dessiner();
    await enregistrer();
    if (s === 'valide') toast('Fiche validée. Vous pouvez la télécharger en PDF.');
  }
  async function supprimer() {
    if (!(await confirmer(`Supprimer la fiche de paie de ${agent.nom} (${libelleMois(mois)}) ?`, { ok: 'Supprimer', danger: true }))) return;
    try { plusTard.annuler(); await api('paie.bulletin.supprimer', { id }); toast('Fiche supprimée.'); ctx.aller(`#/paie/${mois}`); } catch (e) { erreur(e); }
  }

  ctx.titre(`Fiche de paie — ${agent.nom}`);
  ctx.actions(h('a', { class: 'btn btn--ghost', href: `#/paie/${mois}` }, icone('retour'), h('span', null, libelleMois(mois))), indicateur,
    h('button', { class: 'btn btn--gold', type: 'button', onclick: pdf }, icone('telecharger'), h('span', null, 'PDF')));
  const nouvelleFiche = !fige() && !Array.isArray(V.gains);
  if (nouvelleFiche) figerLignes();
  dessiner();
  if (!fige() && (nouvelleFiche || R.brut !== +b.brut || R.netPaye !== +b.net)) enregistrer();
  const zone = h('div', { class: 'feuille-zone' }, feuille);
  ctx.afficher(h('div', { class: 'editeur editeur--paie' }, zone, panneau));
  ajusterZoom(zone, feuille);
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
    signataire: saisie({ value: P.employeur.signataire }), qualite: saisie({ value: P.employeur.qualite }), ville: saisie({ value: P.employeur.ville }),
  };
  const B = {
    annee: saisie({ value: String(P.annee), inputmode: 'numeric' }), smicHoraire: num(P.smicHoraire), pmss: num(P.pmss),
    effectif: h('select', { class: 'input' }, [['moins11', 'Moins de 11 salariés'], ['11a19', 'De 11 à 19 salariés'], ['20a49', 'De 20 à 49 salariés'], ['50plus', '50 salariés et plus']].map(([k, l]) => h('option', { value: k, selected: k === P.effectif }, l))),
    tauxAT: num(P.tauxAT), tauxMobilite: num(P.tauxMobilite), panier: num(P.panier), deductionHS: num(P.deductionHS),
    mutSal: num(P.mutuelle.sal), mutPat: num(P.mutuelle.pat), prevSal: num(P.prevoyance.sal), prevPat: num(P.prevoyance.pat),
    majNuit: num(P.majorations.nuit), majDim: num(P.majorations.dimanche), majFerie: num(P.majorations.ferie),
    seuilMaladie: num(P.seuilMaladie), seuilFamille: num(P.seuilFamille), reductionHSMax: num(P.reductionHSMax),
    rgFormule: h('select', { class: 'input' }, h('option', { value: 'fillon', selected: P.reduction.formule !== 'degressive' }, 'Formule TESE 2026 (jusqu’à 1,6 SMIC)'), h('option', { value: 'degressive', selected: P.reduction.formule === 'degressive' }, 'Formule dégressive (jusqu’à 3 SMIC)')),
    rgT: num(P.reduction.t), rgT50: num(P.reduction.t50),
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
      reduction: { active: B.rgActive.checked, formule: B.rgFormule.value, t: lire(B.rgT), t50: lire(B.rgT50), tmin: lire(B.rgTmin), tdelta: lire(B.rgTdelta), tdelta50: lire(B.rgTdelta50), p: lire(B.rgP) },
      taux,
    };
    try { await api('paie.parametres.enregistrer', { parametres }); toast('Paramètres de paie enregistrés. Ils s’appliquent aux déclarations en cours.'); } catch (err) { erreur(err); }
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
  const aRemplir = [!P.tauxAT && 'taux accidents du travail', !P.panier && 'indemnité de panier', !P.employeur.urssaf && 'n° URSSAF'].filter(Boolean);

  ctx.afficher(onglets('parametres'),
    aRemplir.length ? h('div', { class: 'paie-info paie-info--alerte' }, icone('alerte'), h('p', null, h('b', null, 'À renseigner : '), `${aRemplir.join(', ')}.`)) : null,
    h('form', { class: 'parametres', onsubmit: enregistrer },
      carte('Employeur', 'En haut de chaque bulletin et sur vos documents',
        h('div', { class: 'form-grille form-grille--2' }, champ('Raison sociale', E.nom), champ('Adresse', E.adresse), champ('SIRET', E.siret), champ('Code APE', E.ape),
          champ('N° URSSAF', E.urssaf), champ('Convention collective', E.convention),
          champ('Signataire des documents', E.signataire), champ('Qualité du signataire', E.qualite, 'ex. Gérant'), champ('Ville (« Fait à … »)', E.ville))),
      carte('Barèmes de l’année', 'À mettre à jour chaque 1er janvier',
        h('div', { class: 'form-grille form-grille--2' },
          champ('Année', B.annee), champ('SMIC horaire brut (€)', B.smicHoraire),
          champ('Plafond mensuel de la sécurité sociale (€)', B.pmss), champ('Effectif de l’entreprise', B.effectif, 'Change certains taux (FNAL, formation, versement mobilité…) et la date limite de la DSN.'))),
      carte('Propre à votre entreprise', 'Ces montants dépendent de vos contrats',
        h('div', { class: 'form-grille form-grille--2' },
          champ('Taux accidents du travail (%)', B.tauxAT, 'Votre taux AT/MP : compte AT/MP sur net-entreprises.fr.'),
          champ('Versement mobilité (%)', B.tauxMobilite, 'Dû à partir de 11 salariés. Paris : taux IDFM.'),
          champ('Mutuelle — part salarié (€/mois)', B.mutSal), champ('Mutuelle — part employeur (€/mois)', B.mutPat, 'L’employeur paie au moins 50 %.'),
          champ('Prévoyance — part salarié (% tranche 1)', B.prevSal), champ('Prévoyance — part employeur (% tranche 1)', B.prevPat, 'Selon votre contrat de prévoyance (obligatoire dans la convention).'),
          champ('Indemnité de panier (€ par panier)', B.panier, 'Montant fixé par la convention collective. Proposé pour chaque vacation de 6 h et plus.'),
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
            champ('Formule de la réduction générale', B.rgFormule), champ('Coefficient T (moins de 50)', B.rgT, 'Calé sur un bulletin TESE 2026.'), champ('Coefficient T (50 et plus)', B.rgT50),
            champ('Réduction générale — Tmin', B.rgTmin), champ('Réduction générale — Tdelta (moins de 50)', B.rgTdelta),
            champ('Réduction générale — Tdelta (50 et plus)', B.rgTdelta50), champ('Réduction générale — exposant P', B.rgP)))),
      h('div', { class: 'barre-enregistrer' }, h('button', { class: 'btn btn--gold', type: 'submit' }, icone('coche'), 'Enregistrer les paramètres de paie'))),
    avertissement());
}
