/* =========================================================
   ESPACE ADMIN BDA — Terrain & qualité (version 13, module « terrain »)
   #/terrain                     vue d'ensemble des sites (consignes, lectures, matériel, contrôles)
   #/terrain/site/<id>           classeur du site : consignes versionnées, lectures, documents,
                                 numéros d'urgence, clés et badges
   #/terrain/materiel            matériel et tenues (inventaire, remise, retour, à récupérer)
   #/terrain/controles           contrôles qualité ; …/controle/nouveau (sur le terrain) ; …/controle/<id>
   ========================================================= */
import { api, apiFichier, h, icone, toast, erreur, modale, confirmer, champ, saisie, zoneTexte, dateLisible, ilYa } from '../outils.js';

const ONGLETS = [['', 'Vue d’ensemble'], ['materiel', 'Matériel & tenues'], ['controles', 'Contrôles qualité']];
const ETATS_CONSIGNES = { ok: ['À jour', 'payee'], aucune: ['Aucune consigne', 'archivee'], planning: ['À publier', 'attente'], modifiee: ['Fiche modifiée', 'attente'], ancienne: ['À relire (6 mois)', 'attente'] };
const note = (n) => (n == null ? '—' : String(Math.round(n * 10) / 10).replace('.', ','));
const tonNote = (n) => (n == null ? '' : n < 3 ? 'is-alerte' : n < 4 ? 'is-attente' : 'is-ok');
const fr = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
const auj = () => new Date().toISOString().slice(0, 10);

export async function pageTerrain(ctx) {
  const [vue, id] = ctx.params;
  if (vue === 'site' && id) return pageSite(ctx, Number(id));
  if (vue === 'controle' && id === 'nouveau') return pageNouveauControle(ctx);
  if (vue === 'controle' && id) return pageControle(ctx, Number(id));
  const onglet = ['materiel', 'controles'].includes(vue) ? vue : '';
  ctx.titre('Terrain & qualité');
  ctx.actions(h('a', { class: 'btn btn--gold', href: '#/terrain/controle/nouveau' }, icone('bouclier'), h('span', null, 'Nouveau contrôle')));
  const barre = h('nav', { class: 'mx-onglets' }, ONGLETS.map(([k, lib]) => h('a', { class: `mx-onglet ${k === onglet ? 'is-actif' : ''}`, href: `#/terrain${k ? `/${k}` : ''}` }, lib)));
  const zone = h('div', { class: 'tr-zone' });
  ctx.afficher(h('div', { class: 'tr' }, barre, zone));
  const recharger = () => pageTerrain(ctx);
  try {
    if (onglet === 'materiel') await vueMateriel(zone, recharger);
    else if (onglet === 'controles') await vueControles(zone);
    else await vueEnsemble(zone);
  } catch (e) { zone.replaceChildren(h('p', { class: 'mx-vide' }, e.message)); }
}

/* ----- Vue d'ensemble ----- */
async function vueEnsemble(zone) {
  const d = await api('mod.terrain.ensemble');
  const t = d.totaux;
  const kpi = (lib, val, sous, ton) => h('div', { class: `vg-kpi ${ton || ''}` }, h('span', { class: 'vg-kpi__lib' }, lib), h('b', { class: 'vg-kpi__val' }, val), h('span', { class: 'vg-kpi__sous' }, sous));
  const kpis = h('section', { class: 'vg-kpis tr-kpis' },
    kpi('Consignes à jour', `${t.aJour}/${t.sites}`, t.aReprendre ? `${t.aReprendre} à publier ou mettre à jour` : 'sites du planning'),
    kpi('Consignes lues', t.prevus ? `${t.lus}/${t.prevus}` : '—', 'agents attendus sur les sites', t.prevus && t.lus < t.prevus ? 'is-alerte' : ''),
    kpi('Matériel confié', `${t.confies}/${t.inventaire}`, d.aRecuperer.length ? `${d.aRecuperer.length} à récupérer` : 'rien à récupérer', d.aRecuperer.length ? 'is-alerte' : ''),
    kpi('Contrôles (3 mois)', String(t.controles3m), t.moyenne3m ? `moyenne ${note(t.moyenne3m)}/5` : 'aucun contrôle'),
    kpi('Contrôles faibles', String(t.faibles30j), 'note < 3 sur 30 jours', t.faibles30j ? 'is-alerte' : ''));
  const recup = d.aRecuperer.length ? h('section', { class: 'tr-alerte' }, icone('alerte'),
    h('div', null, h('b', null, `${d.aRecuperer.length} objet${d.aRecuperer.length > 1 ? 's' : ''} à récupérer chez des agents sortis ou inactifs`),
      h('ul', null, d.aRecuperer.slice(0, 6).map((x) => h('li', null, `${x.libelle}${x.numero ? ` (${x.numero})` : ''} — ${x.agent}, depuis le ${fr(x.depuis)}`)))),
    h('a', { class: 'btn btn--ghost btn--petit', href: '#/terrain/materiel' }, 'Voir le matériel')) : null;
  const lignes = d.sites.map((s) => {
    const [lib, ton] = ETATS_CONSIGNES[s.consignes.etat] || [s.consignes.etat, 'archivee'];
    return h('tr', { class: 'ligne-clic', onclick: () => { location.hash = `#/terrain/site/${s.id}`; } },
      h('td', null, h('b', null, s.nom), s.client ? h('small', { class: 'muet mx-bloc' }, s.client) : null),
      h('td', null, h('span', { class: `pastille pastille--${ton}` }, lib), s.consignes.version ? h('small', { class: 'muet mx-bloc' }, `version ${s.consignes.version}`) : null),
      !s.consignes.version ? h('td', null, h('span', { class: 'muet' }, 'Rien à lire')) : h('td', null, s.lecture.prevus ? h('span', { class: s.lecture.lus < s.lecture.prevus ? 'mx-rouge' : '' }, `${s.lecture.lus}/${s.lecture.prevus} lu${s.lecture.lus > 1 ? 's' : ''}`) : h('span', { class: 'muet' }, '—'),
        s.lecture.manquants?.length ? h('small', { class: 'muet mx-bloc', title: s.lecture.manquants.map((m) => m.nom).join(', ') }, `à lire : ${s.lecture.manquants.slice(0, 2).map((m) => m.nom).join(', ')}${s.lecture.manquants.length > 2 ? '…' : ''}`) : null),
      h('td', null, s.dehors.materiel || s.dehors.cles ? `${s.dehors.materiel} objet${s.dehors.materiel > 1 ? 's' : ''} · ${s.dehors.cles} clé${s.dehors.cles > 1 ? 's' : ''}` : h('span', { class: 'muet' }, '—')),
      h('td', null, s.controle.dernier ? h('span', { class: `tr-note ${tonNote(s.controle.dernier.moyenne)}` }, `${note(s.controle.dernier.moyenne)}/5`) : h('span', { class: 'muet' }, 'jamais'),
        s.controle.dernier ? h('small', { class: 'muet mx-bloc' }, ilYa(s.controle.dernier.quand)) : null));
  });
  zone.replaceChildren(kpis, recup || '', h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Sites'), h('small', null, 'Cliquez sur un site pour ouvrir son classeur')),
    d.sites.length ? h('div', { class: 'tableau' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Site'), h('th', null, 'Consignes'), h('th', null, 'Lecture'), h('th', null, 'Matériel et clés'), h('th', null, 'Dernier contrôle'))),
      h('tbody', null, lignes))) : h('div', { class: 'mx-vide' }, h('b', null, 'Aucun site'), h('p', null, 'Créez vos sites dans le Planning des sites.'))));
}

/* ----- Rendu simple des consignes : « # Titre », « - point », « 1. étape », **gras** ----- */
const enGras = (s) => s.split(/\*\*(.+?)\*\*/g).map((x, i) => (i % 2 ? h('b', null, x) : x));
function texteConsignes(t) {
  const blocs = [];
  let liste = null;
  const point = (tag, txt) => { if (liste?.tagName !== tag.toUpperCase()) { liste = h(tag); blocs.push(liste); } liste.append(h('li', null, enGras(txt))); };
  String(t || '').split('\n').forEach((l) => {
    const s = l.trim();
    if (/^#+\s/.test(s)) { liste = null; blocs.push(h('h4', null, s.replace(/^#+\s*/, ''))); }
    else if (/^[-*•]\s/.test(s)) point('ul', s.replace(/^[-*•]\s*/, ''));
    else if (/^\d+[.)]\s/.test(s)) point('ol', s.replace(/^\d+[.)]\s*/, ''));
    else if (s) { liste = null; blocs.push(h('p', null, enGras(s))); }
    else liste = null;
  });
  return h('div', { class: 'tr-consignes' }, blocs);
}

/* =========================================================
   Classeur d'un site
   ========================================================= */
async function pageSite(ctx, id) {
  const d = await api('mod.terrain.site', undefined, { id });
  if (!ctx.actuel()) return;
  const s = d.site;
  ctx.titre(`Classeur · ${s.nom}`);
  const recharger = () => pageSite(ctx, id);
  ctx.actions(h('a', { class: 'btn btn--ghost', href: '#/terrain' }, icone('retour'), h('span', null, 'Terrain & qualité')),
    h('a', { class: 'btn btn--gold', href: '#/terrain/controle/nouveau', onclick: () => { try { sessionStorage.setItem('bda-controle-site', String(id)); } catch (e) { /* rien */ } } }, icone('bouclier'), h('span', null, 'Contrôler ce site')));

  /* Consignes */
  const [libEtat, tonEtat] = ETATS_CONSIGNES[d.etat] || [d.etat, 'archivee'];
  const editeur = zoneTexte({ rows: 14, value: d.courante?.texte || s.consignesPlanning || '', placeholder: '# Prise de poste\n- Arrivée 15 minutes avant\n- …\n\n# Rondes\n- …' });
  const resume = saisie({ placeholder: 'Ce qui change (facultatif), ex. « nouvel horaire de fermeture »' });
  const publier = h('button', { class: 'btn btn--gold', type: 'button', onclick: async () => {
    try { const r = await api('mod.terrain.consigne.publier', { site_id: id, texte: editeur.value, resume: resume.value }); toast(`Version ${r.version} publiée : les agents devront la relire.`); recharger(); } catch (e) { erreur(e); }
  } }, icone('envoyer'), 'Publier cette version');
  const edition = h('div', { class: 'tr-edition', hidden: Boolean(d.courante) }, editeur, h('div', { class: 'tr-edition__pied' }, resume, publier));
  const consignes = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Consignes'), h('span', { class: `pastille pastille--${tonEtat}` }, libEtat)),
    ['planning', 'modifiee'].includes(d.etat) ? h('div', { class: 'tr-info' }, icone('alerte'), h('span', null, d.etat === 'planning' ? 'Des consignes sont écrites dans la fiche du planning mais pas encore publiées aux agents.' : 'Les consignes de la fiche du planning ont été modifiées depuis la dernière version.'),
      h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => { try { await api('mod.terrain.consigne.publier', { site_id: id, depuis_planning: true }); toast('Nouvelle version publiée.'); recharger(); } catch (e) { erreur(e); } } }, 'Les publier')) : null,
    d.courante ? h('div', { class: 'tr-courante' },
      h('p', { class: 'muet tr-courante__meta' }, `Version ${d.courante.version} · ${dateLisible(d.courante.cree)} · ${d.courante.auteur || ''}${d.courante.resume ? ` · « ${d.courante.resume} »` : ''}`),
      texteConsignes(d.courante.texte),
      h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: (e) => { edition.hidden = false; e.currentTarget.remove(); editeur.focus(); } }, icone('crayon'), 'Écrire une nouvelle version')) : h('p', { class: 'muet' }, 'Aucune consigne publiée. Écrivez-les ci-dessous : les agents de ce site les liront dans leur espace et confirmeront les avoir lues.'),
    edition,
    d.versions.length > 1 ? h('details', { class: 'tr-versions' }, h('summary', null, `${d.versions.length} versions`),
      h('ul', null, d.versions.map((v) => h('li', null, h('b', null, `Version ${v.version}`), h('small', { class: 'muet' }, ` · ${dateLisible(v.cree)} · ${v.lectures} lecture${v.lectures > 1 ? 's' : ''}${v.resume ? ` · ${v.resume}` : ''}`))))) : null);

  /* Lectures */
  const lectures = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Qui a lu les consignes'), h('small', null, 'Agents prévus sur ce site')),
    d.lectures.concernes.length ? h('ul', { class: 'tr-lecteurs' }, d.lectures.concernes.map((a) => h('li', null,
      h('b', null, a.nom), a.prochain ? h('small', { class: 'muet' }, `prochain poste ${fr(a.prochain.jour)} ${a.prochain.debut}`) : null,
      a.lu && a.versionLue === d.courante?.version ? h('span', { class: 'mx-ouvert is-ok' }, `Lu ${ilYa(a.lu)}`) : h('span', { class: 'mx-ouvert mx-rouge' }, a.versionLue ? `A lu la version ${a.versionLue}` : 'Pas encore lu'))))
      : h('p', { class: 'muet' }, 'Aucun agent prévu sur ce site dans les 3 prochaines semaines.'));

  /* Documents */
  const fichier = h('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png,image/webp', hidden: true });
  const typeDoc = h('select', { class: 'input input--auto' }, [['plan', 'Plan'], ['photo', 'Photo'], ['procedure', 'Procédure'], ['autre', 'Autre']].map(([k, l]) => h('option', { value: k }, l)));
  const titreDoc = saisie({ placeholder: 'Titre (facultatif)' });
  const pourAgents = h('input', { type: 'checkbox', checked: true });
  fichier.onchange = async () => {
    const f = fichier.files[0]; fichier.value = '';
    if (!f) return;
    const fd = new FormData();
    fd.append('site_id', id); fd.append('type', typeDoc.value); fd.append('titre', titreDoc.value); fd.append('agents', pourAgents.checked ? '1' : ''); fd.append('fichier', f);
    try { await apiFichier('mod.terrain.document.ajouter', fd); toast('Document ajouté au classeur.'); recharger(); } catch (e) { erreur(e); }
  };
  const documents = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Documents du site'), h('small', null, 'Plans, photos, procédures')),
    d.documents.length ? h('ul', { class: 'tr-docs' }, d.documents.map((doc) => h('li', null,
      h('a', { href: `api.php?a=mod.terrain.document&id=${doc.id}`, target: '_blank', rel: 'noopener' }, icone(doc.mime === 'application/pdf' ? 'dossier' : 'photo'), h('span', null, h('b', null, doc.titre), h('small', null, `${{ plan: 'Plan', photo: 'Photo', procedure: 'Procédure' }[doc.type] || 'Document'} · ${Math.max(1, Math.round(doc.taille / 1024))} Ko${doc.agents ? ' · visible par les agents' : ' · direction seulement'}`))),
      h('button', { class: 'icon-btn', type: 'button', title: 'Retirer', 'aria-label': 'Retirer', onclick: async () => {
        if (!(await confirmer(`Retirer « ${doc.titre} » du classeur ? (le fichier est gardé dans les archives)`, { ok: 'Retirer' }))) return;
        try { await api('mod.terrain.document.retirer', { id: doc.id }); recharger(); } catch (e) { erreur(e); }
      } }, icone('croix'))))) : h('p', { class: 'muet' }, 'Aucun document.'),
    h('div', { class: 'tr-ajout' }, typeDoc, titreDoc, h('label', { class: 'case' }, pourAgents, h('span', null, 'Visible par les agents')), fichier,
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => fichier.click() }, icone('plus'), 'Ajouter un fichier')));

  /* Numéros d'urgence */
  const urg = (d.urgences.length ? d.urgences : [{ libelle: '', numero: '', note: '' }]).map((u) => ({ ...u }));
  const listeUrg = h('div', { class: 'tr-urgences' });
  const dessinerUrg = () => listeUrg.replaceChildren(...urg.map((u, i) => h('div', { class: 'tr-urgence' },
    saisie({ value: u.libelle, placeholder: 'Qui (ex. Responsable du site)', oninput: (e) => { u.libelle = e.target.value; } }),
    saisie({ value: u.numero, placeholder: '06 …', type: 'tel', oninput: (e) => { u.numero = e.target.value; } }),
    saisie({ value: u.note, placeholder: 'Précision (facultatif)', oninput: (e) => { u.note = e.target.value; } }),
    u.numero ? h('a', { class: 'icon-btn', href: `tel:${u.numero.replace(/[^\d+]/g, '')}`, title: 'Appeler', 'aria-label': 'Appeler' }, icone('telephone')) : h('span'),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer', onclick: () => { urg.splice(i, 1); dessinerUrg(); } }, icone('croix')))));
  dessinerUrg();
  const urgences = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Numéros d’urgence du site'), h('small', null, 'Les agents les voient avec les consignes')),
    listeUrg,
    h('div', { class: 'tr-pied' }, h('button', { class: 'lien-btn', type: 'button', onclick: () => { urg.push({ libelle: '', numero: '', note: '' }); dessinerUrg(); } }, icone('plus'), 'Ajouter un numéro'),
      h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: async () => { try { await api('mod.terrain.urgences.enregistrer', { site_id: id, urgences: urg }); toast('Numéros enregistrés.'); } catch (e) { erreur(e); } } }, 'Enregistrer')));

  /* Clés et badges */
  const ficheCle = async (c = {}) => {
    const f = { objet: saisie({ value: c.objet || '', placeholder: 'Ex. Badge parking' }), nombre: saisie({ value: c.nombre || 1, inputmode: 'numeric' }), emplacement: saisie({ value: c.emplacement || '', placeholder: 'Ex. Boîte à clés du PC' }), detenteur: saisie({ value: c.detenteur || '', placeholder: 'Qui l’a (vide = sur place)' }), depuis: saisie({ type: 'date', value: c.depuis || '' }), note: saisie({ value: c.note || '' }) };
    const ok = await modale({ titre: c.id ? c.objet : 'Ajouter une clé ou un badge', contenu: h('div', { class: 'form-grille' }, champ('Objet', f.objet), h('div', { class: 'form-grille form-grille--2' }, champ('Nombre', f.nombre), champ('Emplacement', f.emplacement)), h('div', { class: 'form-grille form-grille--2' }, champ('Détenteur', f.detenteur), champ('Depuis le', f.depuis)), champ('Note', f.note)),
      actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: 'Enregistrer', classe: 'btn--gold', submit: true, action: async () => {
        try { await api('mod.terrain.cle.enregistrer', { id: c.id || 0, site_id: id, objet: f.objet.value, nombre: Number(f.nombre.value) || 1, emplacement: f.emplacement.value, detenteur: f.detenteur.value, depuis: f.depuis.value, note: f.note.value }); return true; } catch (e) { erreur(e); return false; }
      } }] });
    if (ok) recharger();
  };
  const cles = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Clés et badges'), h('button', { class: 'lien-btn', type: 'button', onclick: () => ficheCle() }, icone('plus'), 'Ajouter')),
    d.cles.length ? h('div', { class: 'tableau' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Objet'), h('th', null, 'Nombre'), h('th', null, 'Emplacement'), h('th', null, 'Qui l’a'), h('th', null, ''))),
      h('tbody', null, d.cles.map((c) => h('tr', { class: 'ligne-clic', onclick: () => ficheCle(c) },
        h('td', null, h('b', null, c.objet)), h('td', null, String(c.nombre)), h('td', null, c.emplacement || '—'),
        h('td', null, c.detenteur ? h('span', { class: c.parti ? 'mx-rouge' : '' }, c.detenteur, c.depuis ? h('small', { class: 'muet mx-bloc' }, `depuis le ${fr(c.depuis)}`) : null) : h('span', { class: 'muet' }, 'Sur place')),
        h('td', { class: 'mx-droite' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer', onclick: async (e) => {
          e.stopPropagation();
          if (!(await confirmer(`Retirer « ${c.objet} » du registre ?`, { ok: 'Retirer' }))) return;
          try { await api('mod.terrain.cle.retirer', { id: c.id }); recharger(); } catch (err) { erreur(err); }
        } }, icone('croix')))))))) : h('p', { class: 'muet' }, 'Aucune clé ni badge enregistré.'));

  ctx.afficher(h('div', { class: 'tr tr-classeur' },
    [s.client, s.adresse].some(Boolean) ? h('p', { class: 'muet tr-site' }, [s.client, s.adresse].filter(Boolean).join(' · ')) : null,
    h('div', { class: 'tr-colonnes' }, h('div', { class: 'tr-col' }, consignes, documents, cles), h('div', { class: 'tr-col' }, lectures, urgences))));
}

/* =========================================================
   Matériel et tenues
   ========================================================= */
async function vueMateriel(zone, recharger) {
  const d = await api('mod.terrain.materiel');
  const agentsOpt = () => h('select', { class: 'input' }, h('option', { value: '' }, 'Choisir l’agent…'), d.agents.map((a) => h('option', { value: a.id }, a.nom)));
  const fiche = async (m = {}) => {
    const f = { type: h('select', { class: 'input' }, Object.entries(d.types).map(([k, l]) => h('option', { value: k, selected: k === (m.type || 'talkie') }, l))), libelle: saisie({ value: m.libelle || '', placeholder: 'Ex. Talkie Motorola T82' }), numero: saisie({ value: m.numero || '', placeholder: 'N° de série (facultatif)' }), taille: saisie({ value: m.taille || '', placeholder: 'Taille (tenues)' }),
      etat: h('select', { class: 'input' }, Object.entries(d.etats).map(([k, l]) => h('option', { value: k, selected: k === (m.etat || 'bon') }, l))), site: h('select', { class: 'input' }, h('option', { value: '0' }, 'Aucun site'), d.sites.map((s) => h('option', { value: s.id, selected: s.id === m.site_id }, s.nom))), nombre: saisie({ value: '1', inputmode: 'numeric' }), note: saisie({ value: m.note || '' }) };
    const ok = await modale({ titre: m.id ? m.libelle : 'Ajouter du matériel', contenu: h('div', { class: 'form-grille' },
      h('div', { class: 'form-grille form-grille--2' }, champ('Type', f.type), champ('État', f.etat)), champ('Désignation', f.libelle),
      h('div', { class: 'form-grille form-grille--2' }, champ('Numéro', f.numero), champ('Taille', f.taille)), champ('Rattaché au site', f.site),
      m.id ? null : champ('Combien ?', f.nombre, 'Plusieurs objets identiques : autant de lignes, numérotez-les ensuite.'), champ('Note', f.note)),
    actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: 'Enregistrer', classe: 'btn--gold', submit: true, action: async () => {
      try { await api('mod.terrain.materiel.enregistrer', { id: m.id || 0, type: f.type.value, libelle: f.libelle.value, numero: f.numero.value, taille: f.taille.value, etat: f.etat.value, site_id: Number(f.site.value), nombre: Number(f.nombre.value) || 1, note: f.note.value }); return true; } catch (e) { erreur(e); return false; }
    } }] });
    if (ok) recharger();
  };
  const remettre = async (m) => {
    const agent = agentsOpt();
    const date = saisie({ type: 'date', value: auj() });
    const ok = await modale({ titre: `Remettre : ${m.libelle}`, contenu: h('div', { class: 'form-grille' }, champ('À l’agent', agent), champ('Le', date)),
      actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: 'Remettre', classe: 'btn--gold', submit: true, action: async () => {
        if (!agent.value) { agent.focus(); return false; }
        try { await api('mod.terrain.materiel.remettre', { id: m.id, agent_id: Number(agent.value), date: date.value }); return true; } catch (e) { erreur(e); return false; }
      } }] });
    if (ok) { toast('Remise enregistrée.'); recharger(); }
  };
  const retour = async (m) => {
    const etat = h('select', { class: 'input' }, Object.entries(d.etats).map(([k, l]) => h('option', { value: k, selected: k === m.etat }, l)));
    const date = saisie({ type: 'date', value: auj() });
    const ok = await modale({ titre: `Retour de ${m.agent}`, contenu: h('div', { class: 'form-grille' }, champ('Objet', h('b', null, m.libelle)), h('div', { class: 'form-grille form-grille--2' }, champ('Rendu le', date), champ('État au retour', etat))),
      actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: 'Enregistrer le retour', classe: 'btn--gold', submit: true, action: async () => {
        try { await api('mod.terrain.materiel.retour', { id: m.id, date: date.value, etat: etat.value }); return true; } catch (e) { erreur(e); return false; }
      } }] });
    if (ok) { toast('Retour enregistré.'); recharger(); }
  };
  const filtre = h('div', { class: 'chips' });
  let choix = 'tous';
  const corps = h('tbody');
  const dessiner = () => {
    filtre.replaceChildren(...[['tous', 'Tout'], ['dehors', 'Chez un agent'], ['stock', 'En stock'], ...Object.entries(d.types)].map(([k, l]) => h('button', { type: 'button', class: `chip ${choix === k ? 'is-actif' : ''}`, onclick: () => { choix = k; dessiner(); } }, l)));
    const vis = d.materiel.filter((m) => choix === 'tous' || (choix === 'dehors' ? m.agent_id : choix === 'stock' ? !m.agent_id : m.type === choix));
    corps.replaceChildren(...(vis.length ? vis.map((m) => h('tr', null,
      h('td', null, h('b', null, m.libelle), h('small', { class: 'muet mx-bloc' }, [d.types[m.type], m.numero, m.taille].filter(Boolean).join(' · '))),
      h('td', null, d.etats[m.etat] || m.etat),
      h('td', null, m.site || h('span', { class: 'muet' }, '—')),
      h('td', null, m.agent_id ? h('span', { class: m.parti ? 'mx-rouge' : '' }, h('b', null, m.agent), h('small', { class: 'muet mx-bloc' }, `depuis le ${fr(m.remis_le)}${m.parti ? ' · à récupérer' : ''}`)) : h('span', { class: 'muet' }, 'En stock')),
      h('td', { class: 'mx-droite tr-actions' },
        m.agent_id ? h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => retour(m) }, 'Retour') : h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => remettre(m) }, 'Remettre'),
        h('button', { class: 'icon-btn', type: 'button', title: 'Modifier', 'aria-label': 'Modifier', onclick: () => fiche(m) }, icone('crayon')),
        h('button', { class: 'icon-btn', type: 'button', title: 'Retirer de l’inventaire', 'aria-label': 'Retirer', onclick: async () => {
          if (!(await confirmer(`Retirer « ${m.libelle} » de l’inventaire ? (l’historique est gardé)`, { ok: 'Retirer' }))) return;
          try { await api('mod.terrain.materiel.retirer', { id: m.id }); recharger(); } catch (e) { erreur(e); }
        } }, icone('croix')))))
      : [h('tr', null, h('td', { colspan: 5, class: 'mx-vide-cellule' }, d.materiel.length ? 'Rien dans ce filtre.' : 'Inventaire vide : ajoutez vos talkies, badges, tenues, clés…'))]));
  };
  dessiner();
  zone.replaceChildren(
    d.aRecuperer.length ? h('section', { class: 'tr-alerte' }, icone('alerte'), h('div', null, h('b', null, `${d.aRecuperer.length} objet${d.aRecuperer.length > 1 ? 's' : ''} à récupérer`),
      h('ul', null, d.aRecuperer.map((x) => h('li', null, `${x.libelle}${x.numero ? ` (${x.numero})` : ''} — ${x.agent}${x.raison === 'inactif' ? ' (inactif)' : x.sortie ? ` (sorti le ${fr(x.sortie)})` : ''}`))))) : '',
    h('section', { class: 'carte' },
      h('header', { class: 'carte__tete' }, h('h2', null, 'Inventaire'), h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: () => fiche() }, icone('plus'), 'Ajouter')),
      filtre,
      h('div', { class: 'tableau' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Objet'), h('th', null, 'État'), h('th', null, 'Site'), h('th', null, 'Chez'), h('th', null, ''))), corps))));
}

/* =========================================================
   Contrôles qualité
   ========================================================= */
async function vueControles(zone) {
  const d = await api('mod.terrain.controles');
  const moy = (liste, titre) => h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, titre), h('small', null, '3 derniers mois')),
    liste.length ? h('ul', { class: 'tr-moyennes' }, liste.map((x) => h('li', null, h('span', null, x.nom), h('small', { class: 'muet' }, `${x.nb} contrôle${x.nb > 1 ? 's' : ''}`), h('b', { class: `tr-note ${tonNote(x.moyenne)}` }, `${note(x.moyenne)}/5`)))) : h('p', { class: 'muet' }, 'Aucun contrôle.'));
  zone.replaceChildren(h('div', { class: 'tr-colonnes' },
    h('div', { class: 'tr-col' }, h('section', { class: 'carte' },
      h('header', { class: 'carte__tete' }, h('h2', null, 'Contrôles récents'), h('a', { class: 'btn btn--gold btn--petit', href: '#/terrain/controle/nouveau' }, icone('plus'), 'Nouveau')),
      d.controles.length ? h('div', { class: 'tableau' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Site'), h('th', null, 'Agent'), h('th', null, 'Note'), h('th', null, 'Par'))),
        h('tbody', null, d.controles.map((c) => h('tr', { class: 'ligne-clic', onclick: () => { location.hash = `#/terrain/controle/${c.id}`; } },
          h('td', { class: 'mx-num' }, dateLisible(c.quand, true)), h('td', null, c.site), h('td', null, c.agent || '—'),
          h('td', null, h('b', { class: `tr-note ${tonNote(c.moyenne)}` }, `${note(c.moyenne)}/5`), c.photo ? h('small', { class: 'muet' }, ' · photo') : null, c.commente ? h('small', { class: 'muet' }, ' · commenté') : null),
          h('td', { class: 'muet' }, c.controleur)))))) : h('div', { class: 'mx-vide' }, h('b', null, 'Aucun contrôle'), h('p', null, 'Passez voir un agent sur site et notez-le en 1 minute depuis votre téléphone.')))),
    h('div', { class: 'tr-col' }, moy(d.parSite, 'Moyenne par site'), moy(d.parAgent, 'Moyenne par agent'))));
}
async function pageControle(ctx, id) {
  const { controle: c } = await api('mod.terrain.controle', undefined, { id });
  if (!ctx.actuel()) return;
  const o = await api('mod.terrain.controle.options');
  ctx.titre(`Contrôle · ${c.site}`);
  ctx.actions(h('a', { class: 'btn btn--ghost', href: '#/terrain/controles' }, icone('retour'), h('span', null, 'Contrôles')));
  ctx.afficher(h('div', { class: 'tr tr-fiche' }, h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, `${c.agent || 'Sans agent'} · ${dateLisible(c.quand, true)}`), h('b', { class: `tr-note tr-note--grand ${tonNote(c.moyenne)}` }, `${note(c.moyenne)}/5`)),
    h('ul', { class: 'tr-criteres-lus' }, Object.entries(o.criteres).map(([k, lib]) => h('li', null, h('span', null, lib), c.notes[k] ? h('span', { class: 'tr-etoiles' }, [1, 2, 3, 4, 5].map((n) => h('i', { class: n <= c.notes[k] ? 'is-on' : '' }))) : h('small', { class: 'muet' }, 'non noté')))),
    c.commentaire ? h('blockquote', { class: 'tr-commentaire' }, c.commentaire) : null,
    c.photo ? h('img', { class: 'tr-photo', src: `api.php?a=mod.terrain.controle.photo&id=${c.id}`, alt: 'Photo du contrôle' }) : null,
    h('p', { class: 'muet' }, `Contrôle fait par ${c.controleur}.`))));
}
// Formulaire de contrôle, pensé pour le téléphone (sur place)
async function pageNouveauControle(ctx) {
  const o = await api('mod.terrain.controle.options');
  if (!ctx.actuel()) return;
  ctx.titre('Nouveau contrôle qualité');
  ctx.actions(h('a', { class: 'btn btn--ghost', href: '#/terrain/controles' }, icone('retour'), h('span', null, 'Contrôles')));
  let preSite = '';
  try { preSite = sessionStorage.getItem('bda-controle-site') || ''; sessionStorage.removeItem('bda-controle-site'); } catch (e) { /* rien */ }
  // site où quelqu'un est en poste maintenant, en premier
  const enPosteMaintenant = Object.entries(o.enPoste || {}).filter(([, l]) => l.some((x) => x.maintenant)).map(([s]) => s);
  const site = h('select', { class: 'input' }, o.sites.map((s) => h('option', { value: s.id, selected: String(s.id) === (preSite || enPosteMaintenant[0] || '') }, `${s.nom}${enPosteMaintenant.includes(String(s.id)) ? ' · agent en poste' : ''}`)));
  const agent = h('select', { class: 'input' });
  const majAgents = () => {
    const ici = (o.enPoste?.[site.value] || []);
    const ids = new Set(ici.map((x) => x.agent_id));
    agent.replaceChildren(h('option', { value: '0' }, 'Sans agent précis'),
      ...ici.map((x) => { const a = o.agents.find((y) => y.id === x.agent_id); return a ? h('option', { value: a.id, selected: x.maintenant }, `${a.nom} · ${x.debut}-${x.fin}${x.maintenant ? ' (en poste)' : ''}`) : null; }).filter(Boolean),
      ...o.agents.filter((a) => !ids.has(a.id)).map((a) => h('option', { value: a.id }, a.nom)));
  };
  site.onchange = majAgents;
  majAgents();
  const notes = {};
  const criteres = h('div', { class: 'tr-criteres' }, Object.entries(o.criteres).map(([k, lib]) => {
    const boutons = [1, 2, 3, 4, 5].map((n) => h('button', { type: 'button', class: 'tr-n', 'aria-label': `${lib} : ${n} sur 5`, onclick: () => { notes[k] = notes[k] === n ? 0 : n; boutons.forEach((b, i) => b.classList.toggle('is-on', i < notes[k])); } }, String(n)));
    return h('div', { class: 'tr-critere' }, h('span', null, lib), h('div', { class: 'tr-n-groupe' }, boutons));
  }));
  const commentaire = zoneTexte({ rows: 3, placeholder: 'Ce que vous avez constaté (facultatif)' });
  const photo = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const apercu = h('div', { class: 'tr-photo-apercu' });
  let blob = null;
  photo.onchange = async () => {
    const f = photo.files[0];
    if (!f) return;
    try { blob = await compresser(f, 1600, o.limite || 2097152); apercu.replaceChildren(h('img', { src: URL.createObjectURL(blob), alt: '' }), h('button', { class: 'lien-btn', type: 'button', onclick: () => { blob = null; apercu.replaceChildren(); } }, 'Retirer la photo')); } catch (e) { erreur(e); }
  };
  const enregistrer = h('button', { class: 'btn btn--gold btn--bloc', type: 'button' }, icone('coche'), 'Enregistrer le contrôle');
  enregistrer.onclick = async () => {
    if (!Object.values(notes).some(Boolean)) return toast('Notez au moins un critère (de 1 à 5).', 'erreur');
    enregistrer.disabled = true;
    const fd = new FormData();
    fd.append('site_id', site.value); fd.append('agent_id', agent.value); fd.append('notes', JSON.stringify(notes)); fd.append('commentaire', commentaire.value);
    if (blob) fd.append('photo', blob, 'controle.jpg');
    try { const r = await apiFichier('mod.terrain.controle.enregistrer', fd); toast(`Contrôle enregistré : ${note(r.moyenne)}/5.`); location.hash = `#/terrain/controle/${r.id}`; } catch (e) { erreur(e); enregistrer.disabled = false; }
  };
  ctx.afficher(h('div', { class: 'tr tr-nouveau' }, h('section', { class: 'carte' },
    h('div', { class: 'form-grille' }, champ('Site', site), champ('Agent contrôlé', agent)),
    h('h3', { class: 'tr-sous-titre' }, 'Notes de 1 (mauvais) à 5 (parfait)'), criteres,
    champ('Commentaire', commentaire), photo, apercu,
    h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: () => photo.click() }, icone('photo'), 'Prendre une photo'),
    enregistrer)));
}
// Photo réduite dans le navigateur (JPEG) avant l'envoi
function compresser(fichier, cote, maxOctets) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, cote / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const essai = (q) => c.toBlob((b) => { if (!b) return reject(new Error('Photo illisible.')); if (b.size > maxOctets && q > 0.4) essai(q - 0.15); else resolve(b); }, 'image/jpeg', q);
      essai(0.82);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Photo illisible.'));
    img.src = URL.createObjectURL(fichier);
  });
}
