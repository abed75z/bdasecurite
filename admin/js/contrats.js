/* =========================================================
   ESPACE ADMIN BDA — contrats (réservé à l'administrateur)
   Modèles prêts à remplir : contrats de travail (sécurité, SSIAP,
   protection rapprochée, chauffeur VTC, bureau), avenant, offre
   d'emploi, contrat client, sous-traitance.
   Formulaire à droite, contrat mis en page en A4 à gauche,
   texte de chaque article modifiable. PDF ou impression.
   ========================================================= */
import { api, h, icone, toast, erreur, modale, confirmer, champ, saisie, zoneTexte, dateLisible, attendre } from './outils.js';
import { enregistreurAuto, imprimerPages } from './creations.js';
import { telechargerPages } from './pdf.js';
import {
  FAMILLES, MODELES, modele, nouveauContrat, completer, construire, sections, titreContrat, nomFichier,
  REGLAGES_DEFAUT, reglagesComplets, alertes, texteDe, depuisAgent,
} from './contrats-modeles.js';

const STATUTS = [['brouillon', 'Brouillon'], ['signer', 'À signer'], ['signe', 'Signé']];
const lire = (o, chemin) => chemin.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
function ecrire(o, chemin, v) { const ks = chemin.split('.'); const fin = ks.pop(); ks.reduce((x, k) => (x[k] ??= {}), o)[fin] = v; }

export function pageContrats(ctx) {
  const [p0, p1] = ctx.params;
  if (p0 === 'nouveau') return editeur(ctx, 0, p1);
  if (p0 === 'reglages') return pageReglages(ctx);
  if (/^\d+$/.test(p0 || '')) return editeur(ctx, +p0);
  return liste(ctx);
}

/* =========================================================
   LISTE : les modèles (cases) et les contrats enregistrés
   ========================================================= */
async function liste(ctx) {
  ctx.titre('Contrats');
  ctx.actions(h('a', { class: 'btn btn--ghost', href: '#/contrats/reglages' }, icone('reglages'), h('span', null, 'Employeurs & organismes')));
  const { creations } = await api('creations', undefined, { type: 'contrat' });

  const recherche = saisie({ type: 'search', placeholder: 'Rechercher un contrat ou un salarié…', class: 'input ct-recherche' });
  const corps = h('div', { class: 'ct-enregistres' });
  const dessiner = () => {
    const q = recherche.value.trim().toLowerCase();
    const vis = creations.filter((c) => !q || `${c.titre} ${c.data?.sal?.nom || ''} ${c.data?.sal?.prenom || ''}`.toLowerCase().includes(q));
    corps.replaceChildren(...(vis.length ? vis.map(ligneContrat) : [h('p', { class: 'ct-vide' }, creations.length ? 'Aucun contrat ne correspond.' : 'Vos contrats apparaîtront ici. Choisissez un modèle ci-dessus pour commencer.')]));
  };
  recherche.addEventListener('input', dessiner);
  dessiner();

  ctx.afficher(
    h('p', { class: 'ct-intro' }, 'Choisissez un modèle : il se remplit avec les informations de l’entreprise, il ne reste que le salarié, le poste et les dates. Chaque article reste modifiable. Pensez à faire relire un contrat inhabituel par un juriste ou votre comptable.'),
    FAMILLES.map((f) => h('section', { class: 'ct-famille' },
      h('div', { class: 'ct-famille__tete' }, h('h2', null, f.titre), f.texte ? h('p', null, f.texte) : null),
      h('div', { class: 'ct-modeles' }, MODELES.filter((m) => m.famille === f.cle).map((m) => h('a', { class: `ct-modele ${m.attention ? 'ct-modele--attention' : ''}`, href: `#/contrats/nouveau/${m.id}` },
        h('span', { class: 'ct-modele__tags' }, (m.tags || []).map((t) => h('em', null, t))),
        h('b', null, m.titre), h('small', null, m.texte),
        m.attention ? h('span', { class: 'ct-modele__alerte' }, icone('alerte'), m.attention) : null))))),
    h('section', { class: 'carte ct-mes' },
      h('header', { class: 'carte__tete ct-mes__tete' }, h('span', null, `Contrats enregistrés (${creations.length})`), recherche),
      corps));
}

function ligneContrat(c) {
  const d = c.data || {};
  const st = STATUTS.find(([k]) => k === d.statut) || STATUTS[0];
  return h('a', { class: 'ct-ligne', href: `#/contrats/${c.id}` },
    h('span', { class: 'ct-ligne__ic' }, icone('devis')),
    h('span', { class: 'ct-ligne__txt' }, h('b', null, c.titre || 'Contrat'), h('small', null, modele(d.modele)?.titre || '')),
    h('span', { class: `ct-statut ct-statut--${st[0]}` }, st[1]),
    h('small', { class: 'ct-ligne__date' }, dateLisible(c.maj)));
}

/* =========================================================
   ÉDITEUR
   ========================================================= */
async function editeur(ctx, id, modeleId) {
  const [existant, { reglages: R0 }] = await Promise.all([id ? api('creation', undefined, { id }) : null, api('contrats.reglages')]);
  const R = reglagesComplets(R0);
  if (!id && !modele(modeleId)) { ctx.aller('#/contrats'); return; }
  const d = existant ? completer(existant.creation.data) : nouveauContrat(modeleId, R);
  const M = modele(d.modele);
  ctx.titre(id ? titreContrat(d) : `Nouveau · ${M.titre}`);

  const indicateur = h('span', { class: 'etat-save' });
  const save = enregistreurAuto({ type: 'contrat', route: 'contrats', id, data: d, titre: () => titreContrat(d), ctx, indicateur });

  // Aperçu : les pages A4 du contrat
  const pagesEl = h('div', { class: 'ct-pages' });
  const zone = h('div', { class: 'ct-apercu' }, pagesEl);
  const bandeau = h('div', { class: 'ct-alertes' });
  let pages = [];
  let numeroRendu = 0;
  async function rendre() {
    const n = ++numeroRendu;
    const nouvelles = await paginer(construire(d), d);
    if (n !== numeroRendu) return;
    pages = nouvelles;
    pagesEl.replaceChildren(...pages);
    echelle();
    bandeau.replaceChildren(...alertes(d).map(([niveau, texte]) => h('p', { class: `ct-alerte ct-alerte--${niveau}` }, icone(niveau === 'info' ? 'eclair' : 'alerte'), h('span', null, texte))));
  }
  const echelle = () => {
    pagesEl.style.zoom = '';
    const dispo = zone.clientWidth - 2;
    const largeur = pagesEl.firstElementChild?.offsetWidth || 794;
    if (dispo > 0) pagesEl.style.zoom = String(Math.min(1, dispo / largeur));
  };
  new ResizeObserver(attendre(echelle, 60)).observe(zone);
  const plusTard = attendre(rendre, 250);
  const change = () => { plusTard(); save.change(); ctx.titre(titreContrat(d)); };

  // Formulaire
  const ouverts = new Set(['modele', 'salarie']);
  const formEl = h('div', { class: 'ct-form' });
  function refaire() {
    // Le champ où se trouve le curseur garde le focus après le redessin
    const actif = document.activeElement?.dataset?.k;
    formEl.replaceChildren(...sections(d, R).map((s) => blocSection(s)), blocArticles(), blocSignature());
    if (actif) formEl.querySelector(`[data-k="${CSS.escape(actif)}"]`)?.focus();
    change();
  }
  function blocSection(s) {
    const det = h('details', { class: 'panneau__bloc ct-section', open: ouverts.has(s.cle), dataset: { sec: s.cle } },
      h('summary', null, h('span', null, s.titre), s.manque?.(d) ? h('i', { class: 'ct-point', title: 'À compléter' }) : null),
      s.intro ? h('p', { class: 'panneau__astuce' }, s.intro) : null,
      s.cle === 'salarie' ? boutonAgent() : null,
      h('div', { class: 'ct-champs' }, s.champs.filter((c) => !c.si || c.si(d)).map(champForm)));
    det.addEventListener('toggle', () => { if (det.open) ouverts.add(s.cle); else ouverts.delete(s.cle); });
    return det;
  }
  function champForm(c) {
    const val = lire(d, c.k);
    // Listes, choix, cases : le formulaire est redessiné tout de suite.
    // Saisies : l'aperçu suit la frappe, le formulaire n'est redessiné qu'en sortant du champ (on garde le curseur).
    const maj = (v, saisieEnCours) => { ecrire(d, c.k, v); c.apres?.(d, v); if (c.refait && !saisieEnCours) refaire(); else change(); };
    const fin = () => { if (c.refait) setTimeout(refaire, 0); };
    let input;
    if (c.t === 'liste') {
      input = h('select', { class: 'input', onchange: (e) => maj(e.target.value) },
        (c.o || []).map(([v, l]) => h('option', { value: v, selected: String(val ?? '') === v }, l)));
    } else if (c.t === 'choix') {
      input = h('div', { class: 'ct-choix', role: 'group' }, (c.o || []).map(([v, l]) => h('button', {
        type: 'button', class: `chip ${String(val) === v ? 'is-actif' : ''}`, onclick: () => maj(v),
      }, l)));
    } else if (c.t === 'case') {
      // Case liée à une liste (ex. les changements d'un avenant) ou à un oui/non
      const dans = c.liste != null;
      const cb = h('input', { type: 'checkbox', checked: dans ? (val || []).includes(c.liste) : !!val, onchange: () => {
        if (!dans) return maj(cb.checked);
        const l = (val || []).filter((x) => x !== c.liste);
        maj(cb.checked ? [...l, c.liste] : l);
      } });
      return h('label', { class: `case ct-case ${c.demi ? 'ct-demi' : ''}` }, cb, h('span', null, c.l, c.aide ? h('small', null, c.aide) : null));
    } else if (c.t === 'zone') {
      input = zoneTexte({ value: val ?? '', rows: c.lignes || 3, placeholder: c.ph || '', oninput: (e) => maj(e.target.value, true), onchange: fin });
    } else if (c.t === 'date') {
      input = h('input', { class: 'input', type: 'date', value: val || '', onchange: (e) => maj(e.target.value) });
    } else if (c.t === 'nombre') {
      input = saisie({ value: val === '' || val == null ? '' : String(val).replace('.', ','), inputmode: 'decimal', placeholder: c.ph || '',
        oninput: (e) => { const t = e.target.value.trim().replace(/\s/g, '').replace(',', '.'); if (t === '' || Number.isFinite(+t)) maj(t === '' ? '' : +t, true); }, onchange: fin });
    } else {
      input = saisie({ value: val ?? '', placeholder: c.ph || '', type: c.type || 'text', autocomplete: 'off', oninput: (e) => maj(e.target.value, true), onchange: fin });
    }
    if (input.tagName !== 'DIV') input.dataset.k = c.k;
    const el = champ(c.l, input, c.aide);
    if (c.demi) el.classList.add('ct-demi');
    return el;
  }

  // Remplir le salarié depuis une fiche agent (identité du dossier de paie + carte pro)
  function boutonAgent() {
    return h('button', { class: 'btn btn--ghost btn--bloc ct-agent', type: 'button', onclick: async () => {
      try {
        const [{ agents }, { agents: profils }] = await Promise.all([api('agents'), api('paie.salaries')]);
        const select = h('select', { class: 'input' }, h('option', { value: '' }, 'Choisir un agent…'),
          agents.map((a) => h('option', { value: a.id }, `${a.nom}${a.actif ? '' : ' (inactif)'}`)));
        const choisi = await modale({ titre: 'Remplir avec une fiche agent', contenu: [
          h('p', { class: 'panneau__astuce' }, 'Nom, adresse, date de naissance, n° de sécurité sociale, carte pro : tout ce qui est déjà dans sa fiche et son dossier de paie est recopié dans le contrat.'),
          champ('Agent', select)],
        actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: null }, { libelle: 'Remplir', classe: 'btn--gold', submit: true, action: () => select.value || false }] });
        const a = agents.find((x) => String(x.id) === String(choisi));
        if (!a) return;
        depuisAgent(d, a, profils.find((p) => +p.id === +a.id)?.profil || {});
        toast('Informations de l’agent recopiées.');
        refaire();
      } catch (e) { erreur(e); }
    } }, icone('agents'), 'Remplir depuis une fiche agent');
  }

  // Articles : afficher ou non, modifier le texte, ajouter une clause
  function blocArticles() {
    const arts = construire(d).filter((b) => (b.type === 'article' || b.type === 'article-masque') && b.cle && !b.ajout);
    const det = h('details', { class: 'panneau__bloc ct-section', open: ouverts.has('articles') },
      h('summary', null, h('span', null, 'Articles du contrat')),
      h('p', { class: 'panneau__astuce' }, 'Décochez un article pour le retirer. « Modifier » change son texte : il ne suivra plus le formulaire, jusqu’à « Texte d’origine ».'),
      h('ul', { class: 'ct-arts' }, arts.map((a) => {
        const masque = d.masques.includes(a.cle);
        const cb = h('input', { type: 'checkbox', checked: !masque, disabled: a.obligatoire, title: a.obligatoire ? 'Mention obligatoire' : '', onchange: () => {
          d.masques = cb.checked ? d.masques.filter((k) => k !== a.cle) : [...d.masques, a.cle];
          refaire();
        } });
        return h('li', { class: masque ? 'is-masque' : '' }, h('label', null, cb, h('span', null, d.titres[a.cle] || a.titre)),
          d.textes[a.cle] != null || d.titres[a.cle] ? h('em', { class: 'ct-modifie' }, 'modifié') : null,
          h('button', { class: 'lien-btn', type: 'button', onclick: () => modifierArticle({ ...a, paras: construireOrigine(a.cle) || a.paras }) }, icone('crayon'), 'Modifier'));
      })),
      d.ajouts.length ? h('ul', { class: 'ct-arts' }, d.ajouts.map((x, i) => h('li', null, h('span', null, x.titre || 'Article ajouté'),
        h('button', { class: 'lien-btn', type: 'button', onclick: () => editerAjout(i) }, icone('crayon'), 'Modifier')))) : null,
      h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: () => editerAjout(-1) }, icone('plus'), 'Ajouter un article'));
    det.addEventListener('toggle', () => { if (det.open) ouverts.add('articles'); else ouverts.delete('articles'); });
    return det;
  }
  async function modifierArticle(a) {
    const titre = saisie({ value: d.titres[a.cle] || a.titre || '', placeholder: a.titre });
    const zoneTxt = zoneTexte({ value: d.textes[a.cle] ?? texteDe(a), rows: 14, class: 'input ct-zone-article' });
    const choix = await modale({ titre: 'Modifier l’article', large: true, contenu: [
      a.sansTitre ? null : champ('Titre', titre),
      champ('Texte', zoneTxt, 'Un paragraphe par ligne. Commencez une ligne par « – » pour une liste. « ……… » = blanc à remplir à la main.')],
    actions: [{ libelle: 'Texte d’origine', classe: 'btn--ghost', valeur: 'origine' }, { libelle: 'Enregistrer', classe: 'btn--gold', valeur: 'ok', submit: true }] });
    if (choix === 'origine') { delete d.textes[a.cle]; delete d.titres[a.cle]; } else if (choix === 'ok') {
      const texte = zoneTxt.value.trim();
      if (texte !== texteDe(a)) d.textes[a.cle] = texte; else delete d.textes[a.cle];
      const nouveau = titre.value.trim();
      if (nouveau && nouveau !== a.titre) d.titres[a.cle] = nouveau; else delete d.titres[a.cle];
    } else return;
    refaire();
  }
  // Clic sur le contrat : l'article s'ouvre pour être modifié, le reste ouvre la bonne rubrique du formulaire
  pagesEl.addEventListener('click', (e) => {
    const bloc = e.target.closest('[data-cle], [data-section]');
    if (!bloc) return;
    const cle = bloc.dataset.cle;
    if (cle?.startsWith('ajout-')) return editerAjout(+cle.slice(6));
    if (cle) {
      const a = construire(d).find((b) => b.cle === cle);
      // L'article d'origine (sans le texte modifié) sert de base au bouton « Texte d’origine »
      if (a) modifierArticle({ ...a, paras: construireOrigine(a.cle) || a.paras });
      return;
    }
    const s = bloc.dataset.section;
    if (!s) return;
    ouverts.add(s);
    refaire();
    formEl.querySelector(`[data-sec="${s}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function construireOrigine(cle) {
    const sauve = d.textes[cle];
    delete d.textes[cle];
    const a = construire(d).find((b) => b.cle === cle);
    if (sauve != null) d.textes[cle] = sauve;
    return a?.paras;
  }
  async function editerAjout(i) {
    const x = i >= 0 ? d.ajouts[i] : { titre: '', texte: '' };
    const titre = saisie({ value: x.titre, placeholder: 'ex. Clause de non-sollicitation' });
    const texte = zoneTexte({ value: x.texte, rows: 10, class: 'input ct-zone-article' });
    const choix = await modale({ titre: i >= 0 ? 'Modifier l’article ajouté' : 'Ajouter un article', large: true, contenu: [champ('Titre', titre), champ('Texte', texte, 'Il est placé juste avant les signatures.')],
      actions: [
        ...(i >= 0 ? [{ libelle: 'Retirer', classe: 'btn--ghost', valeur: 'retirer' }] : []),
        { libelle: 'Enregistrer', classe: 'btn--gold', submit: true, action: () => (texte.value.trim() ? 'ok' : false) }] });
    if (choix === 'retirer') d.ajouts.splice(i, 1);
    else if (choix === 'ok') { const v = { titre: titre.value.trim(), texte: texte.value.trim() }; if (i >= 0) d.ajouts[i] = v; else d.ajouts.push(v); } else return;
    refaire();
  }

  function blocSignature() {
    const statut = h('div', { class: 'ct-choix' }, STATUTS.map(([k, l]) => h('button', { type: 'button', class: `chip ${d.statut === k ? 'is-actif' : ''}`, onclick: () => { d.statut = k; refaire(); } }, l)));
    return h('div', { class: 'panneau__bloc' }, h('h3', null, 'Signer'),
      h('p', { class: 'panneau__astuce' }, 'Imprimez en 2 exemplaires : chacun paraphe toutes les pages et signe la dernière. Un exemplaire est remis au salarié (dans les 2 jours ouvrables pour un CDD).'),
      champ('Statut', statut),
      h('button', { class: 'btn btn--gold btn--bloc', type: 'button', onclick: async () => {
        await save.maintenant(); await rendre();
        telechargerPages(pages.map((p) => p.cloneNode(true)), nomFichier(d), { l: 210, h: 297 }, 2.2);
      } }, icone('telecharger'), 'Télécharger en PDF'),
      h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: async () => {
        await save.maintenant(); await rendre();
        imprimerPages(pages.map((p) => p.cloneNode(true)), 'A4 portrait', nomFichier(d));
      } }, icone('imprimer'), 'Imprimer'),
      h('div', { class: 'panneau__liens' },
        h('button', { class: 'lien-btn', type: 'button', onclick: async () => {
          await save.maintenant();
          try {
            const copie = JSON.parse(JSON.stringify(d));
            copie.statut = 'brouillon';
            const r = await api('creation.enregistrer', { type: 'contrat', titre: `${titreContrat(copie)} (copie)`, data: copie });
            toast('Contrat dupliqué : changez le salarié et les dates.');
            ctx.aller(`#/contrats/${r.id}`);
          } catch (e) { erreur(e); }
        } }, icone('copier'), 'Dupliquer'),
        h('button', { class: 'lien-btn lien-btn--danger', type: 'button', onclick: async () => {
          if (!save.etat.id) return ctx.aller('#/contrats');
          if (!(await confirmer('Supprimer ce contrat ? Il ne sera plus dans la liste.', { ok: 'Supprimer', danger: true }))) return;
          try { await api('creation.supprimer', { id: save.etat.id }); toast('Contrat supprimé.'); ctx.aller('#/contrats'); } catch (e) { erreur(e); }
        } }, icone('poubelle'), 'Supprimer')));
  }

  ctx.actions(h('a', { class: 'btn btn--ghost', href: '#/contrats' }, icone('retour'), h('span', null, 'Contrats')), indicateur);
  ctx.afficher(h('div', { class: 'editeur editeur--contrat' },
    h('div', { class: 'ct-gauche' }, bandeau, h('p', { class: 'ct-astuce' }, icone('crayon'), 'Cliquez sur un article du contrat pour changer son titre ou son texte, ou sur le haut de page, les parties et les signatures pour ouvrir le bon formulaire.'), zone),
    h('aside', { class: 'panneau ct-panneau' }, formEl)));
  formEl.replaceChildren(...sections(d, R).map((s) => blocSection(s)), blocArticles(), blocSignature());
  await rendre();
  if (!id) save.change();
}

/* =========================================================
   MISE EN PAGE A4 : les blocs sont rangés page par page,
   un article trop long continue sur la page suivante.
   ========================================================= */
async function paginer(blocs, d) {
  try { await document.fonts.ready; } catch (e) { /* tant pis */ }
  const scene = h('div', { class: 'ct-scene', 'aria-hidden': 'true' });
  document.body.append(scene);
  const pages = [];
  let corps;
  const nouvelle = () => {
    corps = h('div', { class: 'ct-corps' });
    const page = h('div', { class: 'ct-page' }, corps, h('div', { class: 'ct-pied' }));
    scene.append(page);
    pages.push(page);
  };
  const deborde = () => corps.scrollHeight > corps.clientHeight + 1;
  nouvelle();
  for (const b of blocs) {
    if (b.type === 'article-masque') continue;
    if (b.type === 'saut' && corps.childElementCount) { nouvelle(); continue; }
    const el = b.el();
    corps.append(el);
    if (!deborde()) continue;
    // Bloc coupable (article) : on garde le titre et les paragraphes qui tiennent
    const morceaux = [...el.querySelectorAll(':scope > .ct-p')];
    if (b.type === 'article' && morceaux.length > 1) {
      morceaux.forEach((p) => p.remove());
      let i = 0;
      while (i < morceaux.length) { el.append(morceaux[i]); if (deborde()) { morceaux[i].remove(); break; } i++; }
      const reste = morceaux.slice(i);
      if (i === 0) { el.remove(); nouvelle(); corps.append(el); el.append(...reste); continue; }
      if (reste.length) { nouvelle(); corps.append(h('section', { class: 'ct-art ct-art--suite', dataset: { cle: el.dataset.cle || '' } }, reste)); }
      continue;
    }
    if (corps.childElementCount > 1) { el.remove(); nouvelle(); corps.append(el); }
  }
  // Pied de page : paraphes et numéro
  const pied = d.genre === 'offre' ? null : 'Paraphes :';
  pages.forEach((p, i) => p.querySelector('.ct-pied').replaceChildren(
    h('span', null, `${d.emp?.nom || ''} · ${titreContrat(d, true)}`),
    pied ? h('span', { class: 'ct-paraphes' }, pied, h('i'), h('i')) : null,
    h('span', null, `Page ${i + 1} / ${pages.length}`)));
  scene.remove();
  return pages;
}

/* =========================================================
   RÉGLAGES : les employeurs (EI, EURL) et les organismes
   ========================================================= */
async function pageReglages(ctx) {
  ctx.titre('Contrats · employeurs & organismes');
  const { reglages } = await api('contrats.reglages');
  const R = reglagesComplets(reglages);
  const indicateur = h('span', { class: 'etat-save' }, '✓ À jour');
  const enregistrer = attendre(async () => {
    indicateur.textContent = 'Enregistrement…';
    try { await api('contrats.reglages.enregistrer', { reglages: R }); indicateur.textContent = '✓ Enregistré'; } catch (e) { indicateur.textContent = 'Non enregistré'; erreur(e); }
  }, 700);
  const lier = (obj, cle, attrs = {}) => {
    const el = (attrs.zone ? zoneTexte : saisie)({ value: obj[cle] ?? '', rows: attrs.zone || undefined, placeholder: attrs.ph || '' });
    el.addEventListener('input', () => { obj[cle] = el.value; indicateur.textContent = 'Modifications…'; enregistrer(); });
    return el;
  };
  const blocEmployeur = (cle, titre, aide) => {
    const e = R.employeurs[cle];
    return h('section', { class: 'carte ct-reglage' }, h('header', { class: 'carte__tete' }, titre),
      aide ? h('p', { class: 'panneau__astuce' }, aide) : null,
      h('div', { class: 'form-grille form-grille--2' },
        champ('Nom (comme sur le Kbis / l’avis SIRENE)', lier(e, 'nom')), champ('Forme', lier(e, 'forme', { ph: 'ex. EURL au capital de 1 000 €' })),
        champ('Adresse', lier(e, 'adresse', { zone: 2 })), champ('SIRET', lier(e, 'siret')),
        champ('Code APE', lier(e, 'ape')), champ('RCS / RNE', lier(e, 'rcs', { ph: 'ex. RCS Paris 109 076 463' })),
        champ('Autorisation CNAPS', lier(e, 'cnaps', { ph: 'AUT-…' }), 'Obligatoire sur les contrats de sécurité (art. L612-14 CSI).'), champ('N° EVTC (registre VTC)', lier(e, 'evtc', { ph: 'EVTC…' })),
        champ('Représenté par', lier(e, 'representant')), champ('Qualité', lier(e, 'qualite', { ph: 'Gérant' }))));
  };
  const o = R.organismes;
  ctx.actions(h('a', { class: 'btn btn--ghost', href: '#/contrats' }, icone('retour'), h('span', null, 'Contrats')), indicateur);
  ctx.afficher(h('div', { class: 'ct-reglages' },
    blocEmployeur('ei', 'Entreprise individuelle (EI) · BDA SECURITE', 'L’employeur actuel des agents. Après le passage de la sécurité dans l’EURL, l’EI ne gardera que le VTC.'),
    blocEmployeur('eurl', 'EURL BDASECURITE', 'Pour les contrats de sécurité une fois l’autorisation CNAPS de l’EURL obtenue (demande en cours).'),
    h('section', { class: 'carte ct-reglage' }, h('header', { class: 'carte__tete' }, 'Organismes (obligatoires sur un CDD)'),
      h('p', { class: 'panneau__astuce' }, 'Le nom et l’adresse de la caisse de retraite complémentaire et de l’organisme de prévoyance doivent figurer dans tout CDD (art. L1242-12 du Code du travail). Ils sont sur vos bulletins TESE ou vos courriers d’affiliation.'),
      h('div', { class: 'form-grille form-grille--2' },
        champ('Retraite complémentaire (nom et adresse)', lier(o, 'retraite', { zone: 2, ph: 'ex. Malakoff Humanis Agirc-Arrco, …' })),
        champ('Prévoyance (nom et adresse)', lier(o, 'prevoyance', { zone: 2 })),
        champ('Mutuelle santé', lier(o, 'mutuelle', { zone: 2 })),
        champ('Service de santé au travail', lier(o, 'sante', { zone: 2 })),
        champ('Ville de signature', lier(R, 'ville')), champ('Lieu de travail habituel (siège)', lier(R, 'siege', { zone: 2 }))))));
}

export { REGLAGES_DEFAUT };
