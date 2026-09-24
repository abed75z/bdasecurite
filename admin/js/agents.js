/* =========================================================
   ESPACE ADMIN BDA — agents
   Équipe principale (primaires) / renfort (secondaires),
   fiche de chaque agent avec ses documents : présents,
   manquants ou à vérifier. Import d'un dossier entier.
   ========================================================= */
import { api, apiFichier, h, icone, toast, erreur, modale, confirmer, champ, saisie, zoneTexte, statutPastille, iso, dateLisible } from './outils.js';

export const DOCS = [
  { type: 'identite', libelle: 'Pièce d\'identité', obligatoire: true },
  { type: 'carte_pro', libelle: 'Carte professionnelle', obligatoire: true },
  { type: 'diplome_aps', libelle: 'Diplôme / titre APS', obligatoire: true },
  { type: 'secu', libelle: 'Sécurité sociale (Vitale ou attestation)', obligatoire: true },
  { type: 'rib', libelle: 'RIB', obligatoire: true },
  { type: 'certif', libelle: 'Certifications (SST, Vigipirate…)' },
  { type: 'attestation', libelle: 'Attestations' },
  { type: 'cv', libelle: 'CV' },
  { type: 'dossier', libelle: 'Dossier complet (PDF)' },
  { type: 'autre', libelle: 'Autres documents' },
];
const OBLIGATOIRES = DOCS.filter((d) => d.obligatoire);
const CATEGORIES = { primaire: 'Équipe principale', secondaire: 'Renfort' };
const POSTES = ['ADS', 'Agent de protection rapprochée', 'Agent événementiel', 'Chef d\'équipe', 'Chauffeur VTC', 'SSIAP'];
const EXTENSIONS = /\.(pdf|png|jpe?g|webp)$/i;

const sansAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Même personne, quel que soit l'ordre (« Ozgur AYAZ » = « AYAZ Ozgur »)
const cleNom = (s) => sansAccents(s).split(/[^a-z0-9]+/).filter(Boolean).sort().join(' ');

// Type du document deviné d'après le nom du fichier (modifiable ensuite)
export function classer(nom) {
  const n = sansAccents(nom).replace(/\.[a-z0-9]+$/, '');
  if (/ancien/.test(n)) return 'autre';
  if (/\bcni\b|identite|passeport|titre de sejour|\bid\b/.test(n)) return 'identite';
  if (/carte ?pro/.test(n)) return 'carte_pro';
  if (/titre ?(aps|pro)|\bcqp\b|\btfp\b|\baps\b|diplome/.test(n)) return 'diplome_aps';
  if (/vital|assurance maladie|securite sociale|ameli/.test(n)) return 'secu';
  if (/\brib\b|bancaire|iban/.test(n)) return 'rib';
  if (/certif|\bsst\b|vigipirate|ssiap|secourisme/.test(n)) return 'certif';
  if (/attestation/.test(n)) return 'attestation';
  if (/\bcv\b|curriculum/.test(n)) return 'cv';
  if (/\.pdf$/i.test(nom)) return 'dossier';
  return 'autre';
}
// Pour chaque document obligatoire : 'ok', 'verifier' (dans le dossier PDF ?) ou 'manque'
export function etatDocs(docs) {
  const n = (t) => +(docs?.[t] || 0);
  return OBLIGATOIRES.map((d) => ({ ...d, etat: n(d.type) ? 'ok' : n('dossier') ? 'verifier' : 'manque' }));
}

/* =========================================================
   PAGE
   ========================================================= */
export function pageAgents(ctx) {
  const [p0] = ctx.params;
  if (/^\d+$/.test(p0 || '')) return ficheAgent(ctx, +p0);
  return listeAgents(ctx);
}

async function listeAgents(ctx) {
  ctx.titre('Agents');
  let { agents } = await api('agents');
  ctx.actions(
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => importerDossier(ctx) }, icone('telecharger'), h('span', null, 'Importer un dossier')),
    h('button', { class: 'btn btn--gold', type: 'button', onclick: () => nouvelAgent(ctx) }, icone('plus'), h('span', null, 'Nouvel agent')));

  let filtre = 'primaire', recherche = '';
  const grille = h('div', { class: 'agents-grille' });
  const compte = (c) => agents.filter((a) => (a.categorie || 'primaire') === c).length;
  const onglets = h('div', { class: 'onglets' });
  const dessinerOnglets = () => onglets.replaceChildren(...[['primaire', 'Équipe principale'], ['secondaire', 'Renfort'], ['tous', 'Tous']].map(([k, l]) => h('button', {
    type: 'button', class: `onglet ${filtre === k ? 'is-actif' : ''}`, onclick: () => { filtre = k; dessinerOnglets(); dessiner(); },
  }, l, h('span', null, k === 'tous' ? agents.length : compte(k)))));

  const auj = iso(new Date()), dans90 = iso(new Date(Date.now() + 90 * 864e5));
  function tuile(a) {
    const etats = etatDocs(a.docs);
    const ok = etats.filter((e) => e.etat === 'ok').length;
    const initiales = String(a.nom).split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase();
    const carte = !a.validite ? null : a.validite < auj ? statutPastille('retard', 'Carte pro expirée') : a.validite <= dans90 ? statutPastille('nouvelle', 'Carte pro bientôt expirée') : null;
    return h('a', { class: `agent-tuile ${+a.actif ? '' : 'agent-tuile--inactif'}`, href: `#/agents/${a.id}` },
      h('div', { class: 'agent-tuile__tete' },
        h('span', { class: `agent-avatar agent-avatar--${a.categorie || 'primaire'}` }, initiales || '?'),
        h('div', { class: 'agent-tuile__nom' }, h('b', null, a.nom), h('small', null, [a.poste, +a.actif ? '' : 'inactif'].filter(Boolean).join(' · '))),
        filtre === 'tous' ? h('span', { class: `cat cat--${a.categorie || 'primaire'}` }, a.categorie === 'secondaire' ? 'Renfort' : 'Équipe') : null),
      h('div', { class: 'agent-docs' },
        h('div', { class: 'agent-docs__points' }, etats.map((e) => h('span', { class: `point point--${e.etat}`, title: `${e.libelle} : ${e.etat === 'ok' ? 'présent' : e.etat === 'verifier' ? 'à vérifier dans le dossier PDF' : 'manquant'}` }))),
        h('small', null, ok === OBLIGATOIRES.length ? 'Dossier complet' : `${ok}/${OBLIGATOIRES.length} documents obligatoires`)),
      carte);
  }
  function dessiner() {
    const q = cleNom(recherche);
    const vis = agents.filter((a) => (filtre === 'tous' || (a.categorie || 'primaire') === filtre) && (!q || cleNom(a.nom).includes(q) || sansAccents(a.nom).includes(sansAccents(recherche))));
    grille.replaceChildren(...(vis.length ? vis.map(tuile) : [h('div', { class: 'vide' }, icone('agents'), h('p', null, agents.length ? 'Aucun agent ici.' : 'Aucun agent pour le moment. Utilisez « Importer un dossier » pour ajouter d\'un coup un dossier d\'agents (un sous-dossier par agent), ou « Nouvel agent ».'))]));
  }
  const rech = saisie({ type: 'search', class: 'input input--recherche', placeholder: 'Rechercher un agent…', oninput: (e) => { recherche = e.target.value; dessiner(); } });
  const legende = h('p', { class: 'legende-docs' },
    h('span', null, h('i', { class: 'point point--ok' }), 'présent'), h('span', null, h('i', { class: 'point point--verifier' }), 'à vérifier dans le dossier PDF'), h('span', null, h('i', { class: 'point point--manque' }), 'manquant'),
    h('span', { class: 'muet' }, '· Pièce d\'identité, carte pro, diplôme APS, sécurité sociale, RIB'));
  ctx.afficher(h('div', { class: 'carte__outils' }, onglets, h('div', { class: 'recherche' }, icone('recherche'), rech)), grille, legende);
  dessinerOnglets();
  dessiner();
}

async function nouvelAgent(ctx) {
  const nom = saisie({ required: true, placeholder: 'Prénom NOM' });
  const cat = h('select', { class: 'input' }, Object.entries(CATEGORIES).map(([k, l]) => h('option', { value: k }, l)));
  const id = await modale({
    titre: 'Nouvel agent',
    contenu: h('div', { class: 'form-grille' }, champ('Nom et prénom', nom), champ('Catégorie', cat, 'Équipe principale : travaille avec nous. Renfort : appelé en cas de besoin.')),
    actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: null }, { libelle: 'Créer', classe: 'btn--gold', submit: true, action: async () => {
      if (!nom.value.trim()) { nom.focus(); return false; }
      try { return (await api('agent.enregistrer', { nom: nom.value, categorie: cat.value, poste: 'ADS', actif: 1 })).id; } catch (e) { erreur(e); return false; }
    } }],
  });
  if (id) ctx.aller(`#/agents/${id}`);
}

/* =========================================================
   FICHE AGENT
   ========================================================= */
async function ficheAgent(ctx, id) {
  const [{ agents }, res] = await Promise.all([api('agents'), api('agent.docs', undefined, { agent: id })]);
  const a = agents.find((x) => +x.id === id);
  if (!a) throw new Error('Agent introuvable.');
  let docs = res.docs;
  const limite = res.limite;
  ctx.titre(a.nom);
  ctx.actions(h('a', { class: 'btn btn--ghost', href: '#/agents' }, icone('retour'), h('span', null, 'Agents')),
    h('a', { class: 'btn btn--ghost', href: `#/cartes/agent/${a.id}` }, icone('badge'), h('span', null, 'Carte agent')));

  /* ----- Documents ----- */
  const zoneDocs = h('div', { class: 'docs' });
  const recharger = async () => { docs = (await api('agent.docs', undefined, { agent: id })).docs; dessinerDocs(); };
  const lien = (d) => `api.php?a=agent.doc&id=${d.id}`;
  function ligneFichier(d) {
    const choix = h('select', { class: 'input input--mini', 'aria-label': 'Type du document', onchange: async (e) => { try { await api('agent.doc.modifier', { id: d.id, type: e.target.value }); d.type = e.target.value; dessinerDocs(); } catch (err) { erreur(err); } } },
      DOCS.map((t) => h('option', { value: t.type, selected: t.type === d.type }, t.libelle)));
    return h('div', { class: 'fichier' },
      h('a', { class: 'fichier__apercu', href: lien(d), target: '_blank', rel: 'noopener', title: 'Ouvrir' },
        d.mime.startsWith('image/') ? h('img', { src: lien(d), alt: '', loading: 'lazy' }) : h('span', { class: 'fichier__pdf' }, 'PDF')),
      h('div', { class: 'fichier__txt' }, h('a', { href: lien(d), target: '_blank', rel: 'noopener' }, d.nom), h('small', null, `${Math.max(1, Math.round(d.taille / 1024))} Ko · ajouté le ${dateLisible(d.ajoute)}`), choix),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Supprimer ce document', onclick: async () => {
        if (!(await confirmer(`Supprimer « ${d.nom} » ?`, { ok: 'Supprimer', danger: true }))) return;
        try { await api('agent.doc.supprimer', { id: d.id }); await recharger(); } catch (e) { erreur(e); }
      } }, icone('poubelle')));
  }
  function boutonAjout(type, libelle = 'Ajouter') {
    const input = h('input', { type: 'file', accept: '.pdf,.png,.jpg,.jpeg,.webp', multiple: true, hidden: true, onchange: async () => { const f = [...input.files]; input.value = ''; await envoyer(f, type); } });
    return h('span', null, input, h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => input.click() }, icone('plus'), libelle));
  }
  function dessinerDocs() {
    const par = (t) => docs.filter((d) => d.type === t);
    const aDossier = par('dossier').length > 0;
    const blocs = DOCS.map((t) => {
      const fichiers = par(t.type);
      if (!t.obligatoire && !fichiers.length) return null;
      const etat = fichiers.length ? 'ok' : aDossier ? 'verifier' : 'manque';
      return h('div', { class: `doc-type doc-type--${t.obligatoire ? etat : 'libre'}` },
        h('div', { class: 'doc-type__tete' },
          t.obligatoire ? h('span', { class: `etat etat--${etat}` }, icone(etat === 'ok' ? 'coche' : etat === 'verifier' ? 'oeil' : 'croix')) : h('span', { class: 'etat etat--libre' }, icone('devis')),
          h('div', null, h('b', null, t.libelle), h('small', null, !t.obligatoire ? `${fichiers.length} fichier${fichiers.length > 1 ? 's' : ''}` : etat === 'ok' ? 'Présent' : etat === 'verifier' ? 'À vérifier dans le dossier PDF' : 'Manquant')),
          boutonAjout(t.type)),
        fichiers.length ? h('div', { class: 'doc-type__fichiers' }, fichiers.map(ligneFichier)) : null);
    });
    const complets = etatDocs(Object.fromEntries(DOCS.map((t) => [t.type, par(t.type).length]))).filter((e) => e.etat === 'ok').length;
    zoneDocs.replaceChildren(
      h('div', { class: 'docs__resume' },
        h('div', null, h('b', null, complets === OBLIGATOIRES.length ? 'Dossier complet' : `${complets} / ${OBLIGATOIRES.length} documents obligatoires`),
          h('small', null, docs.length ? `${docs.length} fichier${docs.length > 1 ? 's' : ''} au total` : 'Aucun document pour le moment')),
        h('div', { class: 'docs__jauge' }, h('i', { style: { width: `${(complets / OBLIGATOIRES.length) * 100}%` } }))),
      depot, ...blocs.filter(Boolean));
  }

  // Envoi : le type est deviné d'après le nom du fichier si besoin
  const progression = h('p', { class: 'depot__progression', hidden: true });
  async function envoyer(fichiers, typeForce) {
    const valides = fichiers.filter((f) => EXTENSIONS.test(f.name));
    if (valides.length < fichiers.length) toast('Formats acceptés : PDF, JPG, PNG, WEBP.', 'erreur');
    let n = 0, erreurs = 0;
    for (const f of valides) {
      progression.hidden = false;
      progression.textContent = `Envoi ${++n}/${valides.length} : ${f.name}…`;
      try { await envoyerDoc(id, f, typeForce || classer(f.name), limite); } catch (e) { erreurs++; erreur(new Error(`${f.name} : ${e.message}`)); }
    }
    progression.hidden = true;
    if (valides.length) { await recharger(); if (!erreurs) toast(valides.length > 1 ? `${valides.length} documents ajoutés.` : 'Document ajouté.'); }
  }
  const choixDepot = h('input', { type: 'file', accept: '.pdf,.png,.jpg,.jpeg,.webp', multiple: true, hidden: true, onchange: async () => { const f = [...choixDepot.files]; choixDepot.value = ''; await envoyer(f); } });
  const depot = h('div', { class: 'depot', tabindex: 0, role: 'button', onclick: () => choixDepot.click(), onkeydown: (e) => { if (e.key === 'Enter') choixDepot.click(); },
    ondragover: (e) => { e.preventDefault(); depot.classList.add('is-survol'); }, ondragleave: () => depot.classList.remove('is-survol'),
    ondrop: (e) => { e.preventDefault(); depot.classList.remove('is-survol'); envoyer([...e.dataTransfer.files]); } },
  choixDepot, icone('telecharger'), h('div', null, h('b', null, 'Déposez des documents ici'), h('small', null, 'ou cliquez pour les choisir · PDF, photos · le type est reconnu d\'après le nom du fichier')), progression);

  /* ----- Informations ----- */
  const f = {
    nom: saisie({ value: a.nom, required: true }),
    categorie: h('select', { class: 'input' }, Object.entries(CATEGORIES).map(([k, l]) => h('option', { value: k, selected: (a.categorie || 'primaire') === k }, l))),
    poste: h('select', { class: 'input' }, POSTES.map((p) => h('option', { value: p, selected: p === a.poste }, p)), !POSTES.includes(a.poste) ? h('option', { value: a.poste, selected: true }, a.poste) : null),
    tel: saisie({ value: a.tel, type: 'tel' }),
    carte: saisie({ value: a.carte, placeholder: 'ex. CAR-075-2030-…' }),
    validite: saisie({ value: a.validite, type: 'date' }),
    notes: zoneTexte({ value: a.notes, rows: 3 }),
    actif: h('input', { type: 'checkbox', checked: !!+a.actif }),
  };
  const form = h('form', { class: 'panneau__bloc', onsubmit: async (e) => {
    e.preventDefault();
    if (!f.nom.value.trim()) return f.nom.focus();
    try {
      await api('agent.enregistrer', { id, nom: f.nom.value, categorie: f.categorie.value, poste: f.poste.value, tel: f.tel.value, carte: f.carte.value, validite: f.validite.value, notes: f.notes.value, actif: f.actif.checked ? 1 : 0 });
      ctx.titre(f.nom.value.trim()); toast('Agent enregistré.');
    } catch (err) { erreur(err); }
  } },
  h('h3', null, 'Informations'),
  champ('Nom et prénom', f.nom), champ('Catégorie', f.categorie), champ('Poste', f.poste), champ('Téléphone', f.tel),
  champ('N° de carte professionnelle', f.carte), champ('Carte pro valable jusqu\'au', f.validite), champ('Notes (privées)', f.notes),
  h('label', { class: 'case' }, f.actif, h('span', null, 'Agent actif (proposé dans le planning)')),
  h('button', { class: 'btn btn--gold btn--bloc', type: 'submit' }, icone('coche'), 'Enregistrer'));

  const panneau = h('aside', { class: 'panneau' }, form,
    h('div', { class: 'panneau__liens' }, h('span'),
      h('button', { class: 'lien-btn lien-btn--danger', type: 'button', onclick: async () => {
        if (!(await confirmer(`Supprimer ${a.nom} et tous ses documents ? Les plannings déjà faits ne changent pas.`, { ok: 'Supprimer', danger: true }))) return;
        try { await api('agent.supprimer', { id }); toast('Agent supprimé.'); ctx.aller('#/agents'); } catch (e) { erreur(e); }
      } }, icone('poubelle'), 'Supprimer l\'agent')));

  ctx.afficher(h('div', { class: 'editeur editeur--agent' }, h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Documents'), h('small', null, 'Privés : visibles uniquement ici, une fois connecté')), zoneDocs), panneau));
  dessinerDocs();
}

/* ---------- Envoi d'un fichier (photo allégée si elle dépasse la limite de l'hébergement) ---------- */
async function envoyerDoc(agentId, fichier, type, limite) {
  let f = fichier;
  if (limite && f.size > limite * 0.95) {
    if (!f.type.startsWith('image/')) throw new Error(`fichier trop lourd (${Math.round(f.size / 1048576)} Mo, maximum ${Math.floor(limite / 1048576)} Mo)`);
    f = await alleger(f, limite);
  }
  const fd = new FormData();
  fd.append('agent', agentId);
  fd.append('type', type);
  fd.append('nom', fichier.name);
  fd.append('fichier', f, fichier.name);
  return apiFichier('agent.doc.ajouter', fd);
}
async function alleger(fichier, limite) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    for (const [cote, qualite] of [[2600, 0.88], [2000, 0.82], [1600, 0.78]]) {
      const r = Math.min(1, cote / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * r); c.height = Math.round(img.naturalHeight * r);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', qualite));
      if (blob && blob.size < limite * 0.95) return new File([blob], fichier.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
    }
  } finally { URL.revokeObjectURL(url); }
  throw new Error('photo trop lourde, même allégée');
}

/* =========================================================
   IMPORT D'UN DOSSIER (un sous-dossier par agent)
   ========================================================= */
async function importerDossier(ctx) {
  const cat = h('select', { class: 'input' }, Object.entries(CATEGORIES).map(([k, l]) => h('option', { value: k }, l)));
  const resume = h('div', { class: 'import__resume' }, h('p', { class: 'muet' }, 'Aucun dossier choisi.'));
  const progression = h('div', { class: 'import__progression', hidden: true }, h('div', { class: 'docs__jauge' }, h('i')), h('small'));
  let lots = [];
  const choix = h('input', { type: 'file', webkitdirectory: true, multiple: true, hidden: true, onchange: () => {
    const groupes = new Map();
    [...choix.files].forEach((f) => {
      if (!EXTENSIONS.test(f.name)) return;
      const parts = (f.webkitRelativePath || f.name).split('/');
      const agent = parts.length >= 3 ? parts[1] : parts[0];
      if (!groupes.has(agent)) groupes.set(agent, []);
      groupes.get(agent).push(f);
    });
    lots = [...groupes.entries()].map(([nom, fichiers]) => ({ nom: nom.trim(), fichiers }));
    const total = lots.reduce((s, l) => s + l.fichiers.length, 0);
    resume.replaceChildren(lots.length
      ? h('div', null, h('p', null, h('b', null, `${lots.length} agent${lots.length > 1 ? 's' : ''}`), ` · ${total} document${total > 1 ? 's' : ''}`),
        h('ul', { class: 'import__liste' }, lots.map((l) => h('li', null, h('b', null, l.nom), h('span', { class: 'muet' }, ` — ${l.fichiers.length} fichier${l.fichiers.length > 1 ? 's' : ''}`)))))
      : h('p', { class: 'txt-alerte' }, 'Aucun document (PDF ou photo) trouvé dans ce dossier.'));
  } });

  const ok = await modale({
    titre: 'Importer un dossier d\'agents',
    large: true,
    contenu: [
      h('p', { class: 'modale__texte' }, 'Choisissez un dossier de votre ordinateur qui contient un sous-dossier par agent (par exemple « Agents primaire »). Chaque agent est créé s\'il n\'existe pas encore, et ses documents sont classés automatiquement. Les documents déjà importés ne sont pas envoyés deux fois.'),
      champ('Ces agents sont', cat),
      h('div', null, choix, h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => choix.click() }, icone('telecharger'), 'Choisir le dossier…')),
      resume, progression,
    ],
    actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: 'Importer', classe: 'btn--gold', submit: true, action: async () => {
      if (!lots.length) { toast('Choisissez d\'abord un dossier.', 'erreur'); return false; }
      await lancerImport(lots, cat.value, progression);
      return true;
    } }],
  });
  if (ok) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

async function lancerImport(lots, categorie, progression) {
  const { agents } = await api('agents');
  const { limite } = await api('agent.docs', undefined, { agent: 0 });
  const parNom = new Map(agents.map((a) => [cleNom(a.nom), a]));
  const total = lots.reduce((s, l) => s + l.fichiers.length, 0);
  let fait = 0, erreurs = 0, crees = 0;
  const jauge = progression.querySelector('i'), texte = progression.querySelector('small');
  progression.hidden = false;
  $$bloquer(true);
  for (const lot of lots) {
    let agent = parNom.get(cleNom(lot.nom));
    if (!agent) {
      const { id } = await api('agent.enregistrer', { nom: lot.nom, categorie, poste: 'ADS', actif: 1 });
      agent = { id, nom: lot.nom };
      parNom.set(cleNom(lot.nom), agent);
      crees++;
    }
    for (const f of lot.fichiers) {
      texte.textContent = `${lot.nom} — ${f.name} (${fait + 1}/${total})`;
      try { await envoyerDoc(agent.id, f, classer(f.name), limite); } catch (e) { erreurs++; console.warn(f.name, e); }
      fait++;
      jauge.style.width = `${(fait / total) * 100}%`;
    }
  }
  $$bloquer(false);
  toast(`Import terminé : ${crees} agent${crees > 1 ? 's' : ''} créé${crees > 1 ? 's' : ''}, ${total - erreurs} document${total - erreurs > 1 ? 's' : ''} envoyé${total - erreurs > 1 ? 's' : ''}${erreurs ? `, ${erreurs} en erreur` : ''}.`, erreurs ? 'erreur' : 'ok');
}
// Pendant l'import, on évite de fermer la fenêtre par erreur
function $$bloquer(oui) {
  document.querySelectorAll('.modale footer .btn, .modale header .icon-btn').forEach((b) => { b.disabled = oui; });
  window.onbeforeunload = oui ? () => true : null;
}
