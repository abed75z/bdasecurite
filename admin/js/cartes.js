/* =========================================================
   ESPACE ADMIN BDA — cartes agents
   Carte au format carte bancaire (85,6 × 54 mm), recto et verso,
   photo recadrable, impression sur A4 (à découper) ou en format carte.
   ========================================================= */
import { api, h, icone, ecusson, toast, erreur, confirmer, champ, saisie, zoneTexte } from './outils.js';
import { enregistreurAuto, ajusterEchelle, imprimerPages } from './creations.js';
import { telechargerPages } from './pdf.js';

const FONCTIONS = ['Agent de sécurité privée', 'Agent de sécurité (ADS)', "Chef d'équipe sécurité", 'Agent de protection rapprochée', 'Agent événementiel', 'Agent SSIAP', 'Chauffeur VTC'];
const estVtc = (f) => /vtc|chauffeur/i.test(f || '');

export const CARTE_DEFAUT = {
  prenom: '', nom: '', fonction: FONCTIONS[0], numero: '', site: 'bdasecurite.com',
  photo: '', zoom: 1, px: 50, py: 35,
  type: 'AGENT', labelNumero: 'N° carte pro CNAPS', zone: 'Paris & Île-de-France', dispo: '24/7',
  verso: true,
  texteVerso: 'Cette carte est strictement personnelle et reste la propriété de BDA Sécurité. En cas de perte, merci de nous la retourner.',
  autorisation: 'Autorisation d\'exercice CNAPS n° AUT-075-2124-07-01-20250906336',
  legal: '« L\'autorisation d\'exercice ne confère aucune prérogative de puissance publique à l\'entreprise ou aux personnes qui en bénéficient. » Art. L.612-14 du Code de la sécurité intérieure.',
  contact: '06 11 67 86 25 · bdasecurite.com',
};
const nomComplet = (d) => [d.prenom, (d.nom || '').toUpperCase()].filter(Boolean).join(' ').trim();

/* ---------- Dessin de la carte ---------- */
export function recto(d) {
  const photo = d.photo
    ? h('img', { src: d.photo, alt: '', style: { objectPosition: `${d.px}% ${d.py}%`, transform: `scale(${d.zoom})`, transformOrigin: `${d.px}% ${d.py}%` } })
    : h('span', { class: 'cp__sans-photo' }, icone('personne'), 'PHOTO');
  const ligne = (label, valeur) => h('div', { class: 'cp__champ' }, h('dt', null, label), h('dd', null, valeur || ' '));
  return h('div', { class: 'cp cp--recto' },
    h('div', { class: 'cp__haut' },
      ecusson('cp__logo'),
      h('div', { class: 'cp__marque' }, h('b', null, 'BDA SÉCURITÉ'), h('small', null, 'Sécurité privée · VTC Premium')),
      h('div', { class: 'cp__type' }, h('small', null, 'Carte'), h('b', null, d.type || 'AGENT'))),
    h('div', { class: 'cp__filet' }),
    h('div', { class: 'cp__corps' },
      h('div', { class: 'cp__photo' }, photo),
      h('dl', { class: 'cp__champs' },
        ligne('Nom', (d.nom || '').toUpperCase()), ligne('Prénom', d.prenom), ligne('Fonction', d.fonction), ligne(d.labelNumero || 'N° carte pro', d.numero))),
    h('div', { class: 'cp__pied' },
      h('span', null, d.zone, d.zone && d.dispo ? ' · ' : '', h('b', null, d.dispo)),
      h('b', null, d.site)));
}
export function verso(d) {
  return h('div', { class: 'cp cp--verso' },
    h('div', { class: 'cp__cadre' },
      h('div', { class: 'cp__verso-marque' }, ecusson('cp__logo'), h('div', null, h('b', null, 'BDA SÉCURITÉ'), h('small', null, 'Sécurité privée · VTC Premium'))),
      h('p', { class: 'cp__verso-texte' }, d.texteVerso),
      h('p', { class: 'cp__verso-aut' }, d.autorisation),
      h('p', { class: 'cp__verso-legal' }, d.legal),
      h('div', { class: 'cp__verso-pied' }, h('span', null, d.contact), h('span', { class: 'cp__signature' }, 'Signature du titulaire'))));
}

/* ---------- Impression ---------- */
// Planche A4 : chaque ligne = recto | verso côte à côte (pliez au milieu ou découpez)
function planchesA4(cartes) {
  const lignes = [];
  cartes.forEach((d) => {
    if (d.verso) lignes.push([recto(d), verso(d)]);
    else lignes.push([recto(d)]);
  });
  // Cartes sans verso : deux par ligne
  const regroupees = [];
  lignes.forEach((l) => {
    const der = regroupees[regroupees.length - 1];
    if (l.length === 1 && der && der.length === 1 && der.seul) { der.push(l[0]); der.seul = false; } else { if (l.length === 1) l.seul = true; regroupees.push(l); }
  });
  const pages = [];
  for (let i = 0; i < regroupees.length; i += 4) {
    pages.push(h('div', { class: 'planche' }, regroupees.slice(i, i + 4).map((l) => h('div', { class: 'planche__ligne' }, l))));
  }
  return pages;
}
// enPdf : fichier PDF téléchargé directement au lieu de la fenêtre d'impression
export function imprimerCartes(cartes, mode, titre, enPdf = false) {
  if (mode === 'carte') {
    const pages = cartes.flatMap((d) => [h('div', { class: 'page-carte' }, recto(d)), d.verso ? h('div', { class: 'page-carte' }, verso(d)) : null]).filter(Boolean);
    return enPdf ? telechargerPages(pages, titre, { l: 85.6, h: 54 }, 6) : imprimerPages(pages, '85.6mm 54mm', titre);
  }
  return enPdf ? telechargerPages(planchesA4(cartes), titre, { l: 210, h: 297 }) : imprimerPages(planchesA4(cartes), 'A4 portrait', titre);
}

/* =========================================================
   PAGE : liste ou éditeur
   ========================================================= */
export function pageCartes(ctx) {
  const [p0, p1] = ctx.params;
  if (p0 === 'nouvelle') return editeurCarte(ctx, 0);
  if (p0 === 'agent') return editeurCarte(ctx, 0, +p1);
  if (/^\d+$/.test(p0 || '')) return editeurCarte(ctx, +p0);
  return listeCartes(ctx);
}

async function listeCartes(ctx) {
  ctx.titre('Cartes agents');
  const { creations } = await api('creations', undefined, { type: 'carte' });
  const cartes = creations.map((c) => ({ ...c, data: { ...CARTE_DEFAUT, ...c.data } }));
  ctx.actions(
    cartes.length ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => imprimerCartes(cartes.map((c) => c.data), 'a4', 'Cartes agents BDA', true) }, icone('telecharger'), h('span', null, 'Tout en PDF')) : null,
    cartes.length ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => imprimerCartes(cartes.map((c) => c.data), 'a4', 'Cartes agents BDA') }, icone('imprimer'), h('span', null, 'Tout imprimer')) : null,
    h('a', { class: 'btn btn--gold', href: '#/cartes/nouvelle' }, icone('plus'), h('span', null, 'Nouvelle carte')));

  if (!cartes.length) {
    return ctx.afficher(h('section', { class: 'carte vide-grand' },
      h('div', { class: 'vide-grand__visuel' }, recto({ ...CARTE_DEFAUT, prenom: 'Prénom', nom: 'Nom', numero: 'CAR-075-2030-…' })),
      h('div', null, h('h2', null, 'Créez la carte de vos agents'), h('p', null, 'Saisissez le nom, la fonction et le numéro de carte pro, ajoutez une photo : la carte est prête à imprimer ou à enregistrer en PDF.'),
        h('a', { class: 'btn btn--gold', href: '#/cartes/nouvelle' }, icone('plus'), 'Créer une carte'))));
  }
  ctx.afficher(h('div', { class: 'galerie' }, cartes.map((c) => h('a', { class: 'galerie__item', href: `#/cartes/${c.id}` },
    h('div', { class: 'galerie__visuel galerie__visuel--carte' }, recto(c.data)),
    h('div', { class: 'galerie__txt' }, h('b', null, nomComplet(c.data) || 'Sans nom'),
      h('small', null, c.data.fonction))))));
}

async function editeurCarte(ctx, id, agentId) {
  const [{ agents }, existant] = await Promise.all([api('agents'), id ? api('creation', undefined, { id }) : null]);
  const d = { ...CARTE_DEFAUT, ...(existant ? existant.creation.data : {}) };
  ctx.titre(id ? `Carte — ${nomComplet(d) || 'sans nom'}` : 'Nouvelle carte agent');

  const indicateur = h('span', { class: 'etat-save' });
  const save = enregistreurAuto({ type: 'carte', route: 'cartes', id, data: d, titre: () => nomComplet(d), ctx, indicateur });

  /* ----- Aperçu ----- */
  const echRecto = h('div', { class: 'echelle' }), echVerso = h('div', { class: 'echelle' });
  const zoneRecto = h('div', { class: 'apercu-carte' }, echRecto);
  const zoneVerso = h('div', { class: 'apercu-carte' }, echVerso);
  const blocVerso = h('div', { class: 'apercu__face' }, h('span', { class: 'apercu__label' }, 'Verso'), zoneVerso);
  function dessiner() {
    echRecto.replaceChildren(recto(d));
    echVerso.replaceChildren(verso(d));
    blocVerso.hidden = !d.verso;
  }
  const change = () => { dessiner(); save.change(); ctx.titre(`Carte — ${nomComplet(d) || 'sans nom'}`); };

  /* ----- Formulaire ----- */
  const lier = (el, cle, transformer = (v) => v) => { el.value = d[cle] ?? ''; el.addEventListener('input', () => { d[cle] = transformer(el.value); change(); }); return el; };
  const prenom = lier(saisie({ placeholder: 'ex. Karim' }), 'prenom');
  const nom = lier(saisie({ placeholder: 'ex. Benali' }), 'nom');
  const numero = lier(saisie({ placeholder: 'ex. CAR-075-2030-01-01-…' }), 'numero');
  const autre = saisie({ placeholder: 'Précisez la fonction' });
  const fonction = h('select', { class: 'input' }, FONCTIONS.map((f) => h('option', { value: f }, f)), h('option', { value: '__autre' }, 'Autre…'));
  const majFonction = () => {
    const connue = FONCTIONS.includes(d.fonction);
    fonction.value = connue ? d.fonction : '__autre';
    autre.hidden = connue;
    autre.value = connue ? '' : d.fonction;
  };
  fonction.addEventListener('change', () => {
    if (fonction.value === '__autre') { autre.hidden = false; autre.focus(); return; }
    autre.hidden = true;
    d.fonction = fonction.value;
    d.type = estVtc(d.fonction) ? 'CHAUFFEUR' : 'AGENT';
    d.labelNumero = estVtc(d.fonction) ? 'N° carte pro VTC' : 'N° carte pro CNAPS';
    options.type.value = d.type; options.labelNumero.value = d.labelNumero;
    change();
  });
  autre.addEventListener('input', () => { d.fonction = autre.value; change(); });

  // Remplir depuis la liste des agents
  function depuisAgent(a) {
    const mots = String(a.nom || '').trim().split(/\s+/);
    const majus = mots.filter((m) => m.length > 1 && m === m.toUpperCase());
    if (majus.length && majus.length < mots.length) { d.nom = majus.join(' '); d.prenom = mots.filter((m) => !majus.includes(m)).join(' '); } else { d.prenom = mots[0] || ''; d.nom = mots.slice(1).join(' '); }
    d.fonction = a.poste === 'ADS' ? FONCTIONS[0] : a.poste || FONCTIONS[0];
    d.type = estVtc(d.fonction) ? 'CHAUFFEUR' : 'AGENT';
    d.labelNumero = estVtc(d.fonction) ? 'N° carte pro VTC' : 'N° carte pro CNAPS';
    d.numero = a.carte || '';
    d.agentId = a.id;
    [[prenom, 'prenom'], [nom, 'nom'], [numero, 'numero']].forEach(([el, k]) => { el.value = d[k]; });
    options.type.value = d.type; options.labelNumero.value = d.labelNumero;
    majFonction();
    change();
  }
  const choixAgent = agents.length ? h('select', { class: 'input', onchange: (e) => { const a = agents.find((x) => String(x.id) === e.target.value); if (a) depuisAgent(a); } },
    h('option', { value: '' }, 'Remplir depuis un agent…'), agents.map((a) => h('option', { value: a.id, selected: +a.id === +d.agentId }, a.nom))) : null;

  /* ----- Photo ----- */
  const fichier = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async () => {
    const f = fichier.files[0];
    fichier.value = '';
    if (!f) return;
    try { d.photo = await reduirePhoto(f); d.zoom = 1; d.px = 50; d.py = 35; majCurseurs(); change(); } catch (e) { erreur(e); }
  } });
  const curseur = (label, cle, min, max, pas) => {
    const input = h('input', { type: 'range', min, max, step: pas, value: d[cle], oninput: () => { d[cle] = +input.value; change(); } });
    return { input, el: h('label', { class: 'curseur' }, h('span', null, label), input) };
  };
  const cZoom = curseur('Zoom', 'zoom', 1, 3, 0.01), cX = curseur('Gauche / droite', 'px', 0, 100, 1), cY = curseur('Haut / bas', 'py', 0, 100, 1);
  const reglagesPhoto = h('div', { class: 'curseurs' }, cZoom.el, cX.el, cY.el);
  const txtPhoto = h('span');
  const btnPhoto = h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: () => fichier.click() }, icone('photo'), txtPhoto);
  const retirer = h('button', { class: 'lien-btn', type: 'button', onclick: () => { d.photo = ''; majCurseurs(); change(); } }, 'Retirer la photo');
  function majCurseurs() {
    cZoom.input.value = d.zoom; cX.input.value = d.px; cY.input.value = d.py;
    reglagesPhoto.hidden = !d.photo; retirer.hidden = !d.photo;
    txtPhoto.textContent = d.photo ? 'Changer la photo' : 'Ajouter une photo';
  }

  /* ----- Options ----- */
  const options = {
    type: lier(saisie(), 'type', (v) => v.toUpperCase()),
    labelNumero: lier(saisie(), 'labelNumero'),
    zone: lier(saisie(), 'zone'),
    site: lier(saisie(), 'site'),
    dispo: lier(saisie(), 'dispo'),
    texteVerso: lier(zoneTexte({ rows: 3 }), 'texteVerso'),
    autorisation: lier(saisie(), 'autorisation'),
    contact: lier(saisie(), 'contact'),
  };
  const caseVerso = h('input', { type: 'checkbox', checked: d.verso, onchange: () => { d.verso = caseVerso.checked; change(); } });

  /* ----- Actions ----- */
  const titreImpression = () => `Carte agent - ${nomComplet(d) || 'BDA'}`;
  const panneau = h('aside', { class: 'panneau' },
    h('div', { class: 'panneau__bloc' }, h('h3', null, 'Agent'),
      choixAgent,
      h('div', { class: 'form-grille form-grille--2' }, champ('Prénom', prenom), champ('Nom', nom)),
      champ('Fonction', fonction), autre,
      champ('N° de carte professionnelle', numero)),
    h('div', { class: 'panneau__bloc' }, h('h3', null, 'Photo'), fichier, btnPhoto, reglagesPhoto, retirer),
    h('div', { class: 'panneau__bloc' }, h('h3', null, 'Imprimer'),
      h('button', { class: 'btn btn--gold btn--bloc', type: 'button', onclick: async () => { await save.maintenant(); imprimerCartes([d], 'a4', titreImpression(), true); } }, icone('telecharger'), 'Télécharger en PDF (feuille A4)'),
      h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: async () => { await save.maintenant(); imprimerCartes([d], 'a4', titreImpression()); } }, icone('imprimer'), 'Imprimer (feuille A4)'),
      h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: async () => { await save.maintenant(); imprimerCartes([d], 'carte', titreImpression(), true); } }, icone('badge'), 'PDF format carte (imprimante à badges)'),
      h('p', { class: 'panneau__astuce' }, 'Sur A4 : recto et verso côte à côte, à découper puis plier au milieu (ou à plastifier).')),
    h('details', { class: 'panneau__bloc panneau__plus' }, h('summary', null, 'Plus d\'options'),
      champ('Titre de la carte', options.type), champ('Libellé du numéro', options.labelNumero), champ('Site (en bas à droite)', options.site),
      h('div', { class: 'form-grille form-grille--2' }, champ('Zone', options.zone), champ('Disponibilité', options.dispo)),
      h('label', { class: 'case' }, caseVerso, h('span', null, 'Imprimer aussi le verso')),
      champ('Texte du verso', options.texteVerso), champ('Autorisation CNAPS', options.autorisation), champ('Contact (verso)', options.contact)),
    h('div', { class: 'panneau__liens' },
      h('button', { class: 'lien-btn', type: 'button', onclick: async () => {
        await save.maintenant();
        try { const r = await api('creation.enregistrer', { type: 'carte', titre: `${nomComplet(d)} (copie)`, data: { ...d } }); toast('Carte dupliquée.'); ctx.aller(`#/cartes/${r.id}`); } catch (e) { erreur(e); }
      } }, icone('copier'), 'Dupliquer'),
      h('button', { class: 'lien-btn lien-btn--danger', type: 'button', onclick: async () => {
        if (!save.etat.id) return ctx.aller('#/cartes');
        if (!(await confirmer(`Supprimer la carte de ${nomComplet(d) || 'cet agent'} ?`, { ok: 'Supprimer', danger: true }))) return;
        try { await api('creation.supprimer', { id: save.etat.id }); toast('Carte supprimée.'); ctx.aller('#/cartes'); } catch (e) { erreur(e); }
      } }, icone('poubelle'), 'Supprimer')));

  ctx.actions(h('a', { class: 'btn btn--ghost', href: '#/cartes' }, icone('retour'), h('span', null, 'Cartes')), indicateur);
  ctx.afficher(h('div', { class: 'editeur editeur--carte' },
    h('div', { class: 'apercu' },
      h('div', { class: 'apercu__face' }, h('span', { class: 'apercu__label' }, 'Recto'), zoneRecto),
      blocVerso),
    panneau));
  majFonction();
  majCurseurs();
  dessiner();
  ajusterEchelle(zoneRecto, echRecto, 2.2);
  ajusterEchelle(zoneVerso, echVerso, 2.2);
  if (agentId) { const a = agents.find((x) => +x.id === agentId); if (a) { depuisAgent(a); if (choixAgent) choixAgent.value = a.id; } }
}

// Photo réduite (900 px max) et compressée en JPEG : légère à enregistrer
async function reduirePhoto(fichier) {
  if (!/^image\//.test(fichier.type)) throw new Error('Choisissez une image (JPG ou PNG).');
  const url = URL.createObjectURL(fichier);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => { throw new Error('Format de photo non pris en charge : utilisez une photo JPG ou PNG.'); });
    const r = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * r);
    c.height = Math.round(img.naturalHeight * r);
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.86);
  } finally { URL.revokeObjectURL(url); }
}
