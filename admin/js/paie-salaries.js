/* =========================================================
   ESPACE ADMIN BDA — fiches de paie : les salariés
   Liste (avec l'état de chaque dossier) et dossier complet d'un
   salarié, rempli par questions : identité, contrat, rémunération,
   impôt et mutuelle, congés, départ. Enregistrement automatique.
   ========================================================= */
import { api, h, icone, erreur, champ, saisie, zoneTexte, attendre, statutPastille, nombre, fmtHeures, lireNombre, isoVersFr, iso, pad } from './outils.js';
import { PROFIL_DEFAUT, HEURES_MENSUELLES } from './paie-calcul.js';
import { fmtE, nombre4, libelleMois, onglets, completude, barreCompletude, pastilleBulletin, question, choixCartes, parametresComplets } from './paie-commun.js';

const estSorti = (p) => !!(p?.dateSortie && p.dateSortie <= iso(new Date()));

/* =========================================================
   LISTE DES SALARIÉS
   ========================================================= */
export async function pageSalaries(ctx) {
  ctx.titre('Fiches de paie');
  const { agents } = await api('paie.salaries');
  let filtre = 'actifs', recherche = '';
  const corps = h('tbody');
  const compte = { actifs: agents.filter((a) => +a.actif && !estSorti(a.profil)).length, incomplets: agents.filter((a) => +a.actif && completude(a.profil).pct < 100).length, sortis: agents.filter((a) => estSorti(a.profil) || !+a.actif).length };
  function dessiner() {
    const q = recherche.toLowerCase();
    const vis = agents.filter((a) => {
      const sorti = estSorti(a.profil) || !+a.actif;
      if (filtre === 'actifs' && sorti) return false;
      if (filtre === 'sortis' && !sorti) return false;
      if (filtre === 'incomplets' && (sorti || completude(a.profil).pct === 100)) return false;
      return !q || a.nom.toLowerCase().includes(q);
    });
    corps.replaceChildren(...(vis.length ? vis.map((a) => {
      const p = { ...PROFIL_DEFAUT, ...(a.profil || {}) };
      const ouvrir = () => ctx.aller(`#/paie/salarie/${a.id}`);
      return h('tr', { class: 'ligne-clic', tabindex: 0, onclick: ouvrir, onkeydown: (e) => { if (e.key === 'Enter') ouvrir(); } },
        h('td', null, h('b', null, a.nom), h('small', { class: 'muet paie-poste' }, p.emploi || a.poste)),
        h('td', null, p.contrat, p.dateEntree ? h('small', { class: 'muet paie-poste' }, `depuis le ${isoVersFr(p.dateEntree)}`) : null),
        h('td', null, p.mode === 'horaire' ? 'À l’heure' : `Mensualisé ${fmtHeures(+p.heuresContrat || HEURES_MENSUELLES)}`),
        h('td', { class: 'num' }, +p.tauxHoraire ? `${nombre4.format(p.tauxHoraire)} €/h` : '—'),
        h('td', null, barreCompletude(p)),
        h('td', null, estSorti(p) ? statutPastille('brouillon', `Sorti le ${isoVersFr(p.dateSortie)}`) : +a.actif ? statutPastille('payee', 'En poste') : statutPastille('brouillon', 'Inactif')));
    }) : [h('tr', null, h('td', { colspan: 6, class: 'vide-ligne' }, agents.length ? 'Aucun salarié dans cette catégorie.' : 'Ajoutez d’abord vos agents dans la rubrique « Agents ».'))]));
  }
  const chips = h('div', { class: 'chips' });
  const dessinerChips = () => chips.replaceChildren(...[['actifs', 'En poste'], ['incomplets', 'Dossier à compléter'], ['sortis', 'Sortis'], ['tous', 'Tous']].map(([k, l]) => h('button', {
    type: 'button', class: `chip ${k === filtre ? 'is-actif' : ''}`, onclick: () => { filtre = k; dessinerChips(); dessiner(); },
  }, l, h('span', null, k === 'tous' ? agents.length : compte[k]))));
  dessinerChips();
  const rech = saisie({ type: 'search', class: 'input input--recherche', placeholder: 'Rechercher un salarié…', oninput: (e) => { recherche = e.target.value; dessiner(); } });
  ctx.afficher(onglets('salaries'),
    h('section', { class: 'carte' },
      h('div', { class: 'carte__outils' }, chips, h('div', { class: 'recherche' }, icone('recherche'), rech)),
      h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
        h('thead', null, h('tr', null, h('th', null, 'Salarié'), h('th', null, 'Contrat'), h('th', null, 'Rémunération'), h('th', { class: 'num' }, 'Taux horaire'), h('th', null, 'Dossier'), h('th', null, 'Situation'))),
        corps))),
    h('p', { class: 'astuce' }, 'Les salariés viennent de la rubrique « Agents ». Cliquez sur un nom pour compléter son dossier de paie.'));
  dessiner();
}

/* =========================================================
   DOSSIER D'UN SALARIÉ
   ========================================================= */
const TITRES_SEJOUR = ['Carte de séjour temporaire', 'Carte de séjour pluriannuelle', 'Carte de résident', 'Récépissé de demande', 'Autorisation provisoire de travail', 'Autre titre'];
const MOTIFS_SORTIE = ['Fin de CDD', 'Démission', 'Licenciement', 'Rupture conventionnelle', 'Fin de période d’essai', 'Départ à la retraite', 'Autre'];
const DISPENSES = ['CDD de moins de 3 mois', 'Déjà couvert (mutuelle du conjoint…)', 'Complémentaire santé solidaire', 'Temps partiel (cotisation ≥ 10 % du salaire)', 'Présent avant la mise en place de la mutuelle', 'Autre'];
const QUALIFS = ['Niveau 2 · Échelon 3 · Coef. 130', 'Niveau 3 · Échelon 1 · Coef. 130', 'Niveau 3 · Échelon 2 · Coef. 140', 'Niveau 3 · Échelon 3 · Coef. 150', 'Niveau 4 · Échelon 1 · Coef. 160', 'Niveau 4 · Échelon 2 · Coef. 170'];

export async function dossierSalarie(ctx, agentId) {
  const [{ agents }, prm, { bulletins }] = await Promise.all([api('paie.salaries'), api('paie.parametres'), api('paie.bulletins', undefined, { agent: agentId })]);
  const agent = agents.find((a) => +a.id === agentId);
  if (!agent) throw new Error('Salarié introuvable.');
  const P = parametresComplets(prm.parametres, prm.entreprise);
  const p = { ...PROFIL_DEFAUT, ...(agent.profil || {}) };
  if (!p.matricule) p.matricule = pad(agent.id).padStart(4, '0');

  const indicateur = h('span', { class: 'etat-save is-ok' }, '✓ À jour');
  const marquer = (txt, cls) => { indicateur.textContent = txt; indicateur.className = `etat-save ${cls || ''}`; };
  const enregistrer = attendre(async () => {
    marquer('Enregistrement…', 'is-encours');
    try { await api('paie.salarie.enregistrer', { agent_id: agentId, profil: p }); marquer('✓ Enregistré', 'is-ok'); majEtat(); } catch (e) { marquer('Non enregistré', 'is-erreur'); erreur(e); }
  }, 700);
  const change = () => { marquer('Modifications…'); enregistrer(); };

  /* ----- Champs reliés au dossier ----- */
  const texte = (label, cle, attrs = {}, aide) => champ(label, saisie({ value: p[cle] ?? '', class: 'input input--grand', ...attrs, oninput: (e) => { p[cle] = e.target.value.trim(); change(); } }), aide);
  const date = (label, cle, aide) => champ(label, h('input', { class: 'input input--grand', type: 'date', value: p[cle] || '', onchange: (e) => { p[cle] = e.target.value; change(); section(); } }), aide);
  const nombreChamp = (label, cle, aide, suffixe) => {
    const inp = saisie({ value: +p[cle] ? nombre4.format(p[cle]) : '', inputmode: 'decimal', class: 'input input--grand', oninput: (e) => { const n = lireNombre(e.target.value); if (Number.isFinite(n)) { p[cle] = n; change(); } } });
    return champ(label, suffixe ? h('div', { class: 'assist-saisie' }, inp, h('span', null, suffixe)) : inp, aide);
  };
  const liste = (label, cle, options, aide) => champ(label, h('select', { class: 'input input--grand', onchange: (e) => { p[cle] = e.target.value; change(); } },
    h('option', { value: '' }, 'Choisir…'), options.map((o) => h('option', { selected: o === p[cle] }, o))), aide);
  const q = (texteQ, contenu) => h('div', { class: 'q' }, h('p', { class: 'q__texte' }, texteQ), contenu);

  /* ----- Sections ----- */
  const SECTIONS = [
    { cle: 'identite', titre: 'Identité', ic: 'personne', manque: () => ['sexe', 'dateNaissance', 'nationalite', 'nir', 'adresse'].some((k) => !String(p[k] || '').trim()) || (!p.ue && !p.titreSejourNumero), rendu: () => [
      q('Homme ou femme ?', choixCartes([['H', 'Homme'], ['F', 'Femme']], p.sexe, (v) => { p.sexe = v; change(); majEtat(); })),
      h('div', { class: 'form-grille form-grille--2' }, date('Date de naissance', 'dateNaissance'), texte('Lieu de naissance', 'lieuNaissance', { placeholder: 'Ville (pays)' })),
      h('div', { class: 'form-grille form-grille--2' }, texte('Nationalité', 'nationalite'), texte('N° de sécurité sociale', 'nir', { placeholder: '15 chiffres', autocomplete: 'off' }, 'Sur sa carte Vitale ou son attestation de droits.')),
      question({
        texte: 'Est-il ressortissant de l’Union européenne, de l’EEE ou de la Suisse ?', aide: 'Sinon, il faut un titre de séjour qui autorise à travailler (à noter au registre du personnel).',
        oui: p.ue !== false, surChoix: (v) => { p.ue = v; change(); section(); },
      }),
      p.ue === false ? h('div', { class: 'q q--alerte' },
        h('div', { class: 'form-grille form-grille--2' }, liste('Type de titre', 'titreSejour', TITRES_SEJOUR), texte('N° du titre', 'titreSejourNumero')),
        date('Valable jusqu’au', 'titreSejourFin', expiration(p.titreSejourFin))) : null,
      champ('Adresse', zoneTexte({ value: p.adresse, rows: 2, class: 'input input--grand', placeholder: 'N°, rue\nCode postal, ville', oninput: (e) => { p.adresse = e.target.value.trim(); change(); } })),
    ] },
    { cle: 'contrat', titre: 'Contrat', ic: 'devis', manque: () => !p.dateEntree || !p.contrat || !p.emploi, rendu: () => [
      q('Quel type de contrat ?', choixCartes([['CDI', 'CDI'], ['CDD', 'CDD'], ['CDI temps partiel', 'CDI temps partiel'], ['CDD temps partiel', 'CDD temps partiel'], ['Contrat d’extra', 'Extra']], p.contrat, (v) => { p.contrat = v; change(); section(); })),
      h('div', { class: 'form-grille form-grille--2' }, date('Date d’entrée', 'dateEntree'), /CDD|extra/i.test(p.contrat) ? date('Date de fin prévue', 'dateFin') : null),
      h('div', { class: 'form-grille form-grille--2' }, texte('Emploi', 'emploi', {}, 'ex. Agent de sécurité (ADS), SSIAP 1, Agent cynophile…'),
        champ('Qualification (convention collective)', h('div', null, saisie({ value: p.qualification, class: 'input input--grand', list: 'paie-qualifs', oninput: (e) => { p.qualification = e.target.value.trim(); change(); } }),
          h('datalist', { id: 'paie-qualifs' }, QUALIFS.map((x) => h('option', { value: x })))), 'Niveau, échelon et coefficient indiqués sur son contrat.')),
      h('div', { class: 'form-grille form-grille--2' }, liste('Statut', 'statut', ['Non cadre', 'Agent de maîtrise']), texte('Matricule', 'matricule')),
    ] },
    { cle: 'remuneration', titre: 'Rémunération', ic: 'euro', manque: () => !(+p.tauxHoraire > 0), rendu: () => [
      q('Comment est-il payé ?', choixCartes([['mensuel', 'Mensualisé', 'Salaire fixe chaque mois'], ['horaire', 'À l’heure', 'Heures faites + congés pris']], p.mode, (v) => { p.mode = v; change(); })),
      h('div', { class: 'form-grille form-grille--2' },
        nombreChamp('Taux horaire brut', 'tauxHoraire', `SMIC ${P.annee} : ${nombre4.format(P.smicHoraire)} €/h. Mettez le minimum de sa catégorie (grille de la convention) ou plus.`, '€/h'),
        nombreChamp('Heures par mois (contrat)', 'heuresContrat', '151,67 h = temps plein (35 h par semaine).', 'h')),
      nombreChamp('Heures d’une journée de travail', 'heuresJour', 'Sert à compter les jours de congés et d’absence. 7 h pour un temps plein sur 5 jours.', 'h'),
      +p.tauxHoraire > 0 ? h('p', { class: 'q__aide' }, 'Salaire de base d’un mois complet : ', h('b', null, fmtE((+p.heuresContrat || HEURES_MENSUELLES) * p.tauxHoraire)), ' brut.') : null,
    ] },
    { cle: 'impot', titre: 'Impôt, mutuelle, frais', ic: 'facture', manque: () => false, rendu: () => [
      question({
        texte: 'Connaissez-vous son taux de prélèvement à la source ?', aide: 'Il arrive dans le compte-rendu de la DSN (« CRM ») sur net-entreprises. Sans taux, le taux neutre s’applique.',
        oui: String(p.tauxPas ?? '').trim() !== '', surChoix: (v) => { if (!v) { p.tauxPas = ''; change(); } },
        contenu: champ('Taux personnalisé (%)', saisie({ value: p.tauxPas, inputmode: 'decimal', class: 'input input--grand', oninput: (e) => { p.tauxPas = e.target.value.trim().replace(',', '.'); change(); } })),
      }),
      question({
        texte: 'Adhère-t-il à la mutuelle de l’entreprise ?', aide: 'La mutuelle est obligatoire, sauf cas de dispense : gardez son justificatif signé.',
        oui: p.mutuelle !== false, surChoix: (v) => { p.mutuelle = v; change(); section(); },
      }),
      p.mutuelle === false ? h('div', { class: 'q' }, liste('Motif de la dispense', 'dispenseMutuelle', DISPENSES)) : null,
      h('div', { class: 'form-grille form-grille--2' },
        nombreChamp('Remboursement transport par mois', 'navigo', '50 % de son abonnement Navigo, s’il en a un.', '€'),
        liste('Mode de paiement habituel', 'modePaiement', ['Virement', 'Chèque', 'Espèces'])),
    ] },
    { cle: 'conges', titre: 'Congés payés', ic: 'planning', manque: () => false, rendu: () => [
      nombreChamp('Solde de congés au départ', 'soldeCP', 'Les jours qui lui restaient avant son premier bulletin fait ici. Ensuite, le compteur avance tout seul (2,5 jours par mois).', 'j'),
    ] },
    { cle: 'depart', titre: 'Départ', ic: 'sortie', manque: () => false, rendu: () => [
      question({
        texte: 'A-t-il quitté l’entreprise (ou va-t-il la quitter) ?', aide: 'Indiquez la date de sortie : elle apparaît au registre du personnel et sur le certificat de travail.',
        oui: !!p.dateSortie, surChoix: (v) => { if (!v) { p.dateSortie = ''; p.motifSortie = ''; change(); } else if (!p.dateSortie) { p.dateSortie = iso(new Date()); change(); } section(); },
      }),
      p.dateSortie ? h('div', { class: 'q' },
        h('div', { class: 'form-grille form-grille--2' }, date('Date de sortie', 'dateSortie'), liste('Motif', 'motifSortie', MOTIFS_SORTIE)),
        h('div', { class: 'q__boutons' }, h('a', { class: 'btn btn--gold', href: `#/paie/documents/certificat/${agentId}` }, icone('devis'), 'Certificat de travail')),
        h('small', { class: 'q__aide' }, 'L’attestation France Travail se fait en ligne, avec la DSN de fin de contrat (net-entreprises).')) : null,
    ] },
  ];

  let actif = SECTIONS[0].cle;
  const nav = h('nav', { class: 'dossier-nav', 'aria-label': 'Sections du dossier' });
  const contenu = h('section', { class: 'carte dossier-corps' });
  const tete = h('div', { class: 'dossier-tete' });
  function majEtat() {
    const c = completude(p);
    tete.replaceChildren(
      h('span', { class: 'assist-avatar' }, agent.nom.split(/\s+/).map((m) => m[0]).join('').slice(0, 2).toUpperCase()),
      h('div', { class: 'dossier-tete__id' }, h('b', null, agent.nom),
        h('small', null, [p.emploi, p.contrat, p.dateEntree ? `entré le ${isoVersFr(p.dateEntree)}` : '', estSorti(p) ? `sorti le ${isoVersFr(p.dateSortie)}` : ''].filter(Boolean).join(' · '))),
      h('div', { class: 'dossier-tete__etat' }, barreCompletude(p), h('small', null, c.manquants.length ? `Manque : ${c.manquants.join(', ')}` : 'Dossier complet')),
      indicateur);
    nav.replaceChildren(...SECTIONS.map((s) => h('button', { type: 'button', class: `dossier-nav__item ${s.cle === actif ? 'is-actif' : ''}`, onclick: () => { actif = s.cle; section(); } },
      icone(s.ic), h('span', null, s.titre), s.manque() ? h('i', { class: 'dossier-nav__point', title: 'À compléter' }) : icone('coche', 'dossier-nav__ok'))));
  }
  function section() {
    const s = SECTIONS.find((x) => x.cle === actif);
    const i = SECTIONS.indexOf(s);
    contenu.replaceChildren(
      h('header', { class: 'carte__tete' }, h('h2', null, s.titre), h('small', null, `${i + 1} / ${SECTIONS.length}`)),
      h('div', { class: 'assist-contenu' }, s.rendu()),
      h('div', { class: 'assist-nav' },
        i > 0 ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { actif = SECTIONS[i - 1].cle; section(); } }, icone('retour'), SECTIONS[i - 1].titre) : h('span'),
        i < SECTIONS.length - 1 ? h('button', { class: 'btn btn--gold', type: 'button', onclick: () => { actif = SECTIONS[i + 1].cle; section(); } }, SECTIONS[i + 1].titre, icone('fleche')) : null));
    majEtat();
  }

  const historique = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Bulletins'), h('small', null, bulletins.length ? `${bulletins.length} bulletin${bulletins.length > 1 ? 's' : ''}` : 'Aucun pour le moment')),
    bulletins.length ? h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
      h('thead', null, h('tr', null, h('th', null, 'Mois'), h('th', { class: 'num' }, 'Brut'), h('th', { class: 'num' }, 'Net payé'), h('th', null, 'Statut'))),
      h('tbody', null, bulletins.map((x) => h('tr', { class: 'ligne-clic', onclick: () => ctx.aller(x.statut === 'valide' ? `#/paie/bulletin/${x.id}` : `#/paie/declarer/${x.id}`) },
        h('td', null, h('b', null, libelleMois(x.mois))), h('td', { class: 'num' }, fmtE(x.brut)), h('td', { class: 'num' }, fmtE(x.net)), h('td', null, pastilleBulletin(x.statut))))))) : null);

  ctx.titre(`Dossier — ${agent.nom}`);
  ctx.actions(h('a', { class: 'btn btn--ghost', href: '#/paie/salaries' }, icone('retour'), h('span', null, 'Salariés')));
  ctx.afficher(onglets('salaries'), h('div', { class: 'carte dossier-entete' }, tete),
    h('div', { class: 'dossier' }, nav, contenu), historique,
    h('p', { class: 'astuce' }, 'Ces informations sont privées : elles ne sont visibles que par l’administrateur. Tout est enregistré automatiquement.'));
  section();
}

function expiration(fin) {
  if (!fin) return 'Pensez à vérifier ce titre auprès de la préfecture avant l’embauche.';
  const jours = Math.round((new Date(fin) - new Date()) / 86400000);
  if (jours < 0) return `⚠ Titre expiré depuis le ${isoVersFr(fin)} : il ne peut plus travailler sans nouveau titre.`;
  if (jours < 60) return `⚠ Expire dans ${jours} jour${jours > 1 ? 's' : ''} : demandez-lui le renouvellement.`;
  return `Valable encore ${Math.round(jours / 30)} mois.`;
}
