/* =========================================================
   ESPACE ADMIN BDA — agents
   Équipe principale (primaires) / renfort (secondaires),
   fiche de chaque agent avec ses documents : présents,
   manquants ou à vérifier. Import d'un dossier entier.
   ========================================================= */
import { api, apiFichier, h, icone, toast, erreur, modale, confirmer, champ, saisie, zoneTexte, isoVersFr, dateLisible } from './outils.js';
import { etatTitre, lireCarte, ouvrirCartePro } from './carte-pro.js';

export const DOCS = [
  { type: 'identite', libelle: 'Pièce d\'identité', obligatoire: true },
  { type: 'carte_pro', libelle: 'Carte professionnelle', obligatoire: true },
  { type: 'diplome_aps', libelle: 'Diplôme / titre APS', obligatoire: true },
  { type: 'secu', libelle: 'Sécurité sociale (Vitale ou attestation)', obligatoire: true },
  { type: 'rib', libelle: 'RIB', obligatoire: true },
  { type: 'certif', libelle: 'Certifications (SST, Vigipirate…)' },
  { type: 'attestation', libelle: 'Attestations' },
  { type: 'contrat', libelle: 'Contrat de travail' },
  { type: 'carte_vtc', libelle: 'Carte VTC' },
  { type: 'permis', libelle: 'Permis de conduire' },
  { type: 'assurance', libelle: 'Assurance' },
  { type: 'justificatif', libelle: 'Justificatifs (absences)' },
  { type: 'cv', libelle: 'CV' },
  { type: 'dossier', libelle: 'Dossier complet (PDF)' },
  { type: 'autre', libelle: 'Autres documents' },
];
const OBLIGATOIRES = DOCS.filter((d) => d.obligatoire);
const CATEGORIES = { primaire: 'Équipe principale', secondaire: 'Renfort', secours: 'Agent de secours' };
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

/* =========================================================
   TABLEAU (même présentation que le registre Excel) :
   « Mes agents » puis « Agents de secours », une ligne par personne
   ========================================================= */
const infosDe = (a) => { try { return typeof a.infos === 'string' ? JSON.parse(a.infos || '{}') : (a.infos || {}); } catch { return {}; } };
const EQUIPE = { primaire: 'Principale', secondaire: 'Renfort', secours: 'Secours' };
const falsifiee = (a) => /falsifi/i.test(a.carte || '');

async function listeAgents(ctx) {
  ctx.titre('Agents');
  const { agents, dracar } = await api('agents');
  ctx.actions(
    h('button', { class: 'btn btn--carte-pro', type: 'button', onclick: () => ouvrirCartePro({ agents, dracar }) }, icone('badge'), h('span', null, 'Carte pro')),
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => importerRegistre() }, icone('telecharger'), h('span', null, 'Mettre à jour depuis le registre')),
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => importerDossier(ctx) }, icone('telecharger'), h('span', null, 'Importer un dossier')),
    h('button', { class: 'btn btn--gold', type: 'button', onclick: () => nouvelAgent(ctx) }, icone('plus'), h('span', null, 'Nouvel agent')));

  // Carte pro : dates, carte refusée et dernier résultat DRACAR (pas d'état pour une carte VTC sans date)
  const etatCarte = (a) => { const e = etatTitre(a); return e.code === 'a-verifier' && !/CAR-/i.test(a.carte || '') ? null : e; };
  const enAlerte = (a) => mien(a) && !!etatCarte(a)?.grave;
  const mien = (a) => (a.categorie || 'primaire') !== 'secours';
  const ORDRE = ['primaire', 'secondaire', 'secours'];
  const lignesTexte = (...v) => v.filter((x) => x && String(x).trim()).map((x) => h('span', { class: 'cell-ligne' }, x));

  // Colonnes : [titre, clé de tri, contenu de la cellule]
  const COLS = [
    ['Nom', (a) => a.nom, (a, i) => [h('b', null, a.nom), ...lignesTexte(i.ville), +a.actif || !mien(a) ? null : h('span', { class: 'cell-ligne muet' }, 'inactif')]],
    ['Équipe', (a) => ORDRE.indexOf(a.categorie || 'primaire') + a.poste, (a) => [h('span', { class: `cat-pastille cat-pastille--${a.categorie || 'primaire'}` }, EQUIPE[a.categorie || 'primaire']), ...lignesTexte(a.poste)]],
    ['Contact', (a) => a.tel, (a, i) => [
      a.tel ? h('a', { class: 'cell-ligne', href: `tel:${a.tel.replace(/[^\d+]/g, '')}`, onclick: (e) => e.stopPropagation() }, a.tel) : null,
      i.mail ? h('a', { class: 'cell-ligne cell-mail', href: `mailto:${i.mail}`, onclick: (e) => e.stopPropagation() }, i.mail) : null]],
    ['Carte pro', (a) => a.validite || 'zzzz', (a) => {
      const e = etatCarte(a), i = infosDe(a);
      return [e ? h('span', { class: `etat-carte etat-carte--${e.code}` }, e.libelle + (e.fin ? ` · ${isoVersFr(e.fin)}` : '')) : null,
        ...lignesTexte(falsifiee(a) ? '' : a.carte).map((n) => { n.classList.add('cell-num'); return n; }),
        i.dracar ? h('span', { class: `cell-ligne cell-dracar cell-dracar--${i.dracar}`, title: 'Résultat noté depuis DRACAR' }, `${i.dracar === 'actif' ? '✔' : '✖'} DRACAR ${isoVersFr(i.dracar_le)}`) : null];
    }],
    ['Qualifications', (a, i) => i.qualifs, (a, i) => lignesTexte(i.qualifs, i.langues, i.vehicule)],
    ['Documents', (a, i) => i.docs, (a, i) => {
      const n = Object.values(a.docs || {}).reduce((s, x) => s + +x, 0);
      return lignesTexte(n ? `${n} fichier${n > 1 ? 's' : ''} dans l'admin` : '', i.docs);
    }],
    ['Notes', (a) => a.notes, (a) => lignesTexte(a.notes)],
  ];

  let recherche = '', tri = null, sens = 1;
  const tete = h('thead');
  const corpsT = h('tbody');
  const table = h('table', { class: 'tableau tableau--agents' }, tete, corpsT);

  function ligne(a) {
    const i = infosDe(a);
    const alerte = enAlerte(a);
    return h('tr', { class: alerte ? 'ligne--alerte' : '', tabindex: 0, title: 'Ouvrir la fiche', onclick: () => ctx.aller(`#/agents/${a.id}`), onkeydown: (e) => { if (e.key === 'Enter') ctx.aller(`#/agents/${a.id}`); } },
      COLS.map(([, , rendu]) => h('td', null, rendu(a, i))));
  }
  const section = (titre, n) => h('tr', { class: 'ligne--section' }, h('td', { colspan: COLS.length }, titre, h('span', null, ` · ${n}`)));

  function dessinerTete() {
    tete.replaceChildren(h('tr', null, COLS.map(([t], n) => h('th', {
      class: tri === n ? 'is-trie' : '', title: 'Trier', onclick: () => { sens = tri === n ? -sens : 1; tri = n; dessinerTete(); dessiner(); },
    }, t, h('span', { class: 'tri' }, tri === n ? (sens > 0 ? '▲' : '▼') : '')))));
  }
  function dessiner() {
    const q = sansAccents(recherche).trim();
    const texteDe = (a) => sansAccents([a.nom, a.poste, a.tel, a.carte, a.notes, EQUIPE[a.categorie || 'primaire'], ...Object.values(infosDe(a))].join(' '));
    const vis = agents.filter((a) => !q || q.split(/\s+/).every((m) => texteDe(a).includes(m)));
    const cle = (a) => sansAccents(String((tri === null ? a.nom : COLS[tri][1](a, infosDe(a))) ?? ''));
    vis.sort((x, y) => { const a = cle(x), b = cle(y); return (!a) - (!b) || a.localeCompare(b, 'fr', { numeric: true }) * sens; });
    const mes = vis.filter(mien), sec = vis.filter((a) => !mien(a));
    if (tri === null) mes.sort((x, y) => ORDRE.indexOf(x.categorie || 'primaire') - ORDRE.indexOf(y.categorie || 'primaire'));
    const lignes = [];
    if (mes.length) lignes.push(section('Mes agents', mes.length), ...mes.map(ligne));
    if (sec.length) lignes.push(section('Agents de secours', sec.length), ...sec.map(ligne));
    corpsT.replaceChildren(...(lignes.length ? lignes : [h('tr', null, h('td', { colspan: COLS.length, class: 'muet' }, agents.length ? 'Aucun agent ne correspond à la recherche.' : 'Aucun agent pour le moment. Utilisez « Mettre à jour depuis le registre » ou « Nouvel agent ».'))]));
  }
  const rech = saisie({ type: 'search', class: 'input input--recherche', placeholder: 'Rechercher (nom, ville, SSIAP, espagnol…)', oninput: (e) => { recherche = e.target.value; dessiner(); } });
  const nbAlertes = agents.filter(enAlerte).length;
  ctx.afficher(
    h('div', { class: 'carte__outils agents-outils' },
      h('p', { class: 'agents-resume' }, h('b', null, agents.length), ` personnes · ${agents.filter(mien).length} agents · ${agents.filter((a) => !mien(a)).length} agents de secours`,
        nbAlertes ? h('span', { class: 'agents-resume__alerte' }, ` · ${nbAlertes} carte${nbAlertes > 1 ? 's' : ''} pro expirée${nbAlertes > 1 ? 's' : ''} ou refusée${nbAlertes > 1 ? 's' : ''}`) : null),
      h('div', { class: 'recherche' }, icone('recherche'), rech)),
    h('div', { class: 'tableau-agents' }, table),
    h('p', { class: 'legende-docs' }, h('span', null, 'Cliquez sur une ligne pour ouvrir la fiche.'), h('span', null, 'Cliquez sur un titre de colonne pour trier.'), h('span', null, 'En rouge : carte pro expirée, falsifiée ou refusée sur DRACAR.')));
  dessinerTete();
  dessiner();
}

/* ---------- Import du registre (fichier « donnees.json » du dossier bda-recrutement) ---------- */
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const frIso = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
const finDepuisNumero = (c) => { const m = /^CAR-\d{3}-(\d{4})-(\d{2})-(\d{2})/i.exec(c || ''); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };

async function importerRegistre() {
  const choix = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  document.body.append(choix);
  const fichier = await new Promise((ok) => { choix.onchange = () => ok(choix.files[0]); choix.click(); });
  choix.remove();
  if (!fichier) return;
  let reg;
  try { reg = JSON.parse((await fichier.text()).replace(/^﻿/, '')); } catch { return toast('Ce fichier n\'est pas le registre (donnees.json).', 'erreur'); }
  const personnes = [...(reg.agents || []).map((p) => ({ ...p, _mien: true })), ...(reg.candidats || []).map((p) => ({ ...p, _mien: false }))];
  if (!personnes.length) return toast('Registre vide ou format inconnu.', 'erreur');

  const { agents } = await api('agents');
  const parCle = new Map(agents.map((a) => [cleNom(a.nom), a]));
  const chiffres = (t) => String(t || '').replace(/\D/g, '').slice(-9);
  const parTel = new Map(agents.filter((a) => chiffres(a.tel).length === 9).map((a) => [chiffres(a.tel), a]));
  const trouver = (p) => {
    const nom = `${p.nom} ${p.prenom}`.trim();
    let a = parCle.get(cleNom(nom)) || (chiffres(p.tel).length === 9 && parTel.get(chiffres(p.tel)));
    if (!a) {
      // Même nom de famille et prénom presque identique (« Sliou » / « Saliou »)
      const fam = sansAccents(p.nom).trim(), pre = sansAccents(p.prenom).trim();
      a = agents.find((x) => {
        const mots = sansAccents(x.nom).split(/\s+/).filter(Boolean);
        const iFam = mots.findIndex((m) => fam.split(/\s+/).some((f) => lev(m, f) <= 1 || (m.length >= 4 && f.length >= 4 && (f.includes(m) || m.includes(f)))));
        return iFam >= 0 && pre && mots.some((m, i) => i !== iFam && lev(m, pre.split(/\s+/)[0]) <= 2);
      });
    }
    return a || null;
  };
  const lignes = personnes.map((p) => {
    const a = trouver(p);
    const vtc = /vtc|chauffeur/i.test(`${p.equipe} ${p.poste}`);
    const carteBrute = String(p.carte || '');
    const carte = /CAR-/i.test(carteBrute) || /falsifi/i.test(carteBrute) ? carteBrute : '';
    return {
      id: a ? a.id : 0,
      nom: a ? a.nom : `${p.nom} ${p.prenom}`.trim(),
      categorie: p._mien ? (/renfort|secondaire/i.test(p.equipe) ? 'secondaire' : 'primaire') : 'secours',
      poste: vtc ? 'Chauffeur VTC' : /apr|protection rapproch/i.test(p.poste || '') ? 'Agent de protection rapprochée' : 'ADS',
      tel: p.tel || '', carte, validite: frIso(p.fin) || finDepuisNumero(carte),
      notes: [String(p.reponse || '').replace(/^[✔☎✖]\s*/, ''), p.notes].filter(Boolean).join(' · '),
      infos: { sexe: p.sexe, mail: p.mail, ville: p.ville, vehicule: p.vehicule, taille: p.taille, qualifs: [p.ssiap, carte ? '' : carteBrute].filter(Boolean).join(' · '), langues: p.langues, fin_identite: p.cni, docs: p.docs, source: p.source, contact: p.contact, reponse: p.reponse },
    };
  });
  const connus = lignes.filter((l) => l.id).length;
  const ok = await confirmer(`${personnes.length} personnes dans le registre : ${connus} déjà dans l'admin (complétées sans effacer ce que vous avez saisi), ${personnes.length - connus} à ajouter${lignes.some((l) => !l.id && l.categorie === 'secours') ? ' (les agents de secours ne sont pas proposés dans le planning)' : ''}. Continuer ?`, { titre: 'Mettre à jour depuis le registre', ok: 'Mettre à jour' });
  if (!ok) return;
  try {
    const r = await api('agents.importer', { lignes });
    toast(`Registre importé : ${r.maj} agent${r.maj > 1 ? 's' : ''} mis à jour, ${r.crees} ajouté${r.crees > 1 ? 's' : ''}.`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } catch (e) { erreur(e); }
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

// Pastille d'état de la carte pro sur la fiche (dates + dernier résultat DRACAR)
function etatFiche(a) {
  const e = etatTitre(a);
  if (e.code === 'a-verifier' && lireCarte(a.carte).format === 'aucun') return null;
  const i = infosDe(a);
  return h('span', { class: `etat-carte etat-carte--${e.code} etat-carte--fiche` }, e.libelle + (e.fin ? ` · ${isoVersFr(e.fin)}` : '') + (i.dracar ? ` · DRACAR ${isoVersFr(i.dracar_le)}` : ''));
}

/* =========================================================
   FICHE AGENT
   ========================================================= */
async function ficheAgent(ctx, id) {
  const [{ agents, dracar }, res] = await Promise.all([api('agents'), api('agent.docs', undefined, { agent: id })]);
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
      h('div', { class: 'fichier__txt' }, h('a', { href: lien(d), target: '_blank', rel: 'noopener' }, d.nom), h('small', null, `${Math.max(1, Math.round(d.taille / 1024))} Ko · ajouté le ${dateLisible(d.ajoute)}${d.source === 'agent' ? ' · envoyé par l’agent' : ''}`), choix),
      // Visible dans l'Espace équipe de l'agent (contrat, carte pro, attestations… ; jamais par défaut pour le reste)
      d.source === 'agent' ? null : h('button', { class: `icon-btn ${+d.visible ? 'is-actif' : ''}`, type: 'button', title: +d.visible ? 'Visible dans l’Espace équipe de l’agent (cliquer pour masquer)' : 'Masqué pour l’agent (cliquer pour le lui montrer)', 'aria-pressed': +d.visible ? 'true' : 'false', style: +d.visible ? { color: 'var(--gold)' } : { opacity: 0.45 }, onclick: async () => {
        try { await api('equipe.doc.visible', { id: d.id, visible: !+d.visible }); d.visible = +d.visible ? 0 : 1; toast(+d.visible ? 'Document visible dans l’Espace équipe de l’agent.' : 'Document masqué pour l’agent.'); dessinerDocs(); } catch (e) { erreur(e); }
      } }, icone('oeil')),
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
    carte: saisie({ value: a.carte, placeholder: 'ex. 2026-0061049-CAR-SH-1001740' }),
    validite: saisie({ value: a.validite, type: 'date' }),
    notes: zoneTexte({ value: a.notes, rows: 3 }),
    actif: h('input', { type: 'checkbox', checked: !!+a.actif }),
  };
  // Infos du tableau (registre) : email, ville, qualifications…
  const infos = infosDe(a);
  const fi = {
    mail: saisie({ value: infos.mail || '', type: 'email' }),
    ville: saisie({ value: infos.ville || '' }),
    qualifs: saisie({ value: infos.qualifs || '', placeholder: 'ex. SSIAP 1 · SST' }),
    langues: saisie({ value: infos.langues || '' }),
    vehicule: saisie({ value: infos.vehicule || '', placeholder: 'ex. Permis B · véhiculé' }),
    docs: zoneTexte({ value: infos.docs || '', rows: 2, placeholder: 'Documents reçus par mail ou Indeed' }),
  };
  const form = h('form', { class: 'agent-fiche', onsubmit: async (e) => {
    e.preventDefault();
    if (!f.nom.value.trim()) return f.nom.focus();
    try {
      const nouvellesInfos = { ...infos, ...Object.fromEntries(Object.entries(fi).map(([k, el]) => [k, el.value])) };
      await api('agent.enregistrer', { id, nom: f.nom.value, categorie: f.categorie.value, poste: f.poste.value, tel: f.tel.value, carte: f.carte.value, validite: f.validite.value, notes: f.notes.value, actif: f.actif.checked ? 1 : 0, infos: nouvellesInfos });
      ctx.titre(f.nom.value.trim()); toast('Agent enregistré.');
    } catch (err) { erreur(err); }
  } },
  h('div', { class: 'agent-fiche__groupe' }, h('h3', null, 'Identité et contact'),
    h('div', { class: 'form-grille form-grille--2' }, champ('Nom et prénom', f.nom), champ('Catégorie', f.categorie), champ('Poste', f.poste), champ('Téléphone', f.tel), champ('Email', fi.mail), champ('Ville', fi.ville))),
  h('div', { class: 'agent-fiche__groupe' }, h('h3', { class: 'agent-fiche__titre-carte' }, 'Carte professionnelle', etatFiche(a),
      h('button', { class: 'lien-btn', type: 'button', onclick: () => ouvrirCartePro({ agents, dracar, agent: a }) }, icone('badge'), 'Vérifier la carte')),
    h('div', { class: 'form-grille form-grille--2' }, champ('N° de carte professionnelle', f.carte), champ('Valable jusqu\'au', f.validite))),
  h('div', { class: 'agent-fiche__groupe' }, h('h3', null, 'Qualifications'),
    h('div', { class: 'form-grille form-grille--2' }, champ('SSIAP / SST', fi.qualifs), champ('Langues', fi.langues), champ('Permis / véhicule', fi.vehicule))),
  h('div', { class: 'agent-fiche__groupe' }, h('h3', null, 'Suivi'),
    h('div', { class: 'form-grille form-grille--2' }, champ('Documents reçus (mail, Indeed)', fi.docs), champ('Notes (privées)', f.notes))),
  h('div', { class: 'agent-fiche__pied' },
    h('label', { class: 'case' }, f.actif, h('span', null, 'Agent actif (proposé dans le planning)')),
    h('button', { class: 'lien-btn lien-btn--danger', type: 'button', onclick: async () => {
      if (!(await confirmer(`Supprimer ${a.nom} et tous ses documents ? Les plannings déjà faits ne changent pas.`, { ok: 'Supprimer', danger: true }))) return;
      try { await api('agent.supprimer', { id }); toast('Agent supprimé.'); ctx.aller('#/agents'); } catch (e) { erreur(e); }
    } }, icone('poubelle'), 'Supprimer l\'agent'),
    h('button', { class: 'btn btn--gold', type: 'submit' }, icone('coche'), 'Enregistrer')));

  // Les documents restent cachés : il faut cliquer sur « Voir ses documents » pour les afficher
  const blocDocs = h('section', { class: 'carte', hidden: true }, h('header', { class: 'carte__tete' }, h('h2', null, 'Documents'), h('small', null, 'Privés : visibles uniquement ici, une fois connecté')), zoneDocs);
  const boutonDocs = h('button', { class: 'btn btn--ghost btn--docs', type: 'button', onclick: () => {
    blocDocs.hidden = !blocDocs.hidden;
    boutonDocs.replaceChildren(icone('oeil'), h('span', null, blocDocs.hidden ? 'Voir ses documents' : 'Masquer ses documents'));
    if (!blocDocs.hidden) { dessinerDocs(); blocDocs.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  } }, icone('oeil'), h('span', null, 'Voir ses documents'));

  ctx.afficher(h('div', { class: 'agent-page' }, h('section', { class: 'carte' }, form), h('div', { class: 'agent-page__docs' }, boutonDocs), blocDocs));
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
