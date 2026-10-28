/* =========================================================
   ESPACE ADMIN BDA — cartes agents (badge porté au cou)
   Format vertical 54 × 85,6 mm (tour de cou) ou horizontal 85,6 × 54 mm,
   recto et verso, photo recadrable, impression sur A4 (à découper) ou en format carte.
   ========================================================= */
import { api, h, icone, ecusson, marqueLogo, toast, erreur, confirmer, champ, saisie, zoneTexte, isoVersFr } from './outils.js';
import { enregistreurAuto, ajusterEchelle, imprimerPages } from './creations.js';
import { telechargerPages } from './pdf.js';
import { lireCarte } from './carte-pro.js';
import { segments } from './graphiques.js';
import { qrSvg } from './qr.js';

const FONCTIONS = ['Agent de sécurité privée', 'Agent de sécurité (ADS)', "Chef d'équipe sécurité", 'Agent de protection rapprochée', 'Agent événementiel', 'Agent SSIAP', 'Chauffeur VTC'];
const estVtc = (f) => /vtc|chauffeur/i.test(f || '');
const LIEN_CNAPS = 'https://espace-consultation.cnaps.interieur.gouv.fr/annuaire/app';

export const CARTE_DEFAUT = {
  prenom: '', nom: '', fonction: FONCTIONS[0], numero: '', nub: '', validite: '', site: 'bdasecurite.com',
  photo: '', zoom: 1, px: 50, py: 35,
  format: 'vertical',
  type: 'AGENT', labelNumero: 'N° carte pro CNAPS', bandeau: '', zone: 'Paris & Île-de-France', dispo: '24/7',
  verso: true,
  texteVerso: 'Cette carte est strictement personnelle et reste la propriété de BDA Security Group (BDASECURITE). En cas de perte, merci de nous la retourner.',
  employeur: 'BDA SECURITE',
  autorisation: 'Autorisation d\'exercice CNAPS n° AUT-075-2124-07-01-20250906336',
  legal: '« L\'autorisation d\'exercice ne confère aucune prérogative de puissance publique à l\'entreprise ou aux personnes qui en bénéficient. » Art. L.612-14 du Code de la sécurité intérieure.',
  contact: '06 11 67 86 25 · bdasecurite.com',
  qr: true, lienQr: LIEN_CNAPS, texteQr: 'Vérifier ce titre sur le registre public du CNAPS',
};
const nomComplet = (d) => [d.prenom, (d.nom || '').toUpperCase()].filter(Boolean).join(' ').trim();
export const estVertical = (d) => d.format !== 'horizontal';
const bandeauDe = (d) => d.bandeau || (estVtc(d.fonction) ? 'CHAUFFEUR PRIVÉ' : 'SÉCURITÉ PRIVÉE');
// Nom en majuscules : la taille baisse pour les noms longs (largeur disponible en mm)
const tailleNom = (nom, base, largeur) => `${Math.min(base, largeur / Math.max(1, nom.length * 0.68)).toFixed(2)}mm`;

/* ---------- Dessin de la carte ---------- */
function marque() {
  return h('div', { class: 'ca-marque' }, ecusson('ca-blason'), marqueLogo('', true));
}
function photoDe(d) {
  return h('div', { class: 'ca-photo' }, d.photo
    ? h('img', { src: d.photo, alt: '', style: { objectPosition: `${d.px}% ${d.py}%`, transform: `scale(${d.zoom})`, transformOrigin: `${d.px}% ${d.py}%` } })
    : h('span', { class: 'ca-photo__vide' }, icone('personne'), 'PHOTO'));
}
function identite(d, base, largeur) {
  const nom = (d.nom || '').toUpperCase();
  const vtc = estVtc(d.fonction);
  const info = (label, valeur, cls = '') => h('div', { class: `ca-info ${cls}`.trim() }, h('span', null, label), h('b', null, valeur || '—'));
  return h('div', { class: 'ca-corps' },
    h('p', { class: 'ca-prenom' }, d.prenom || ' '),
    h('p', { class: 'ca-nom', style: { fontSize: tailleNom(nom, base, largeur) } }, nom || ' '),
    h('p', { class: 'ca-fonction' }, d.fonction),
    h('div', { class: 'ca-infos' },
      vtc ? info('N° carte VTC', d.numero, 'ca-info--long') : info('N° d\'identification', d.nub, 'ca-info--nub'),
      info('Valable jusqu\'au', isoVersFr(d.validite), 'ca-info--date'),
      vtc ? null : h('div', { class: 'ca-numero' }, h('span', null, d.labelNumero || 'N° carte pro'), h('b', null, d.numero || '—'))));
}
export function recto(d) {
  if (estVertical(d)) {
    return h('div', { class: 'cp cp--v cp--recto' },
      h('div', { class: 'ca-tete' }, marque()),
      h('div', { class: 'ca-filet' }),
      photoDe(d),
      identite(d, 4.4, 46),
      h('div', { class: 'ca-bande' }, h('b', null, bandeauDe(d))));
  }
  return h('div', { class: 'cp cp--h cp--recto' },
    h('div', { class: 'ca-tete' }, marque(), h('div', { class: 'ca-titre' }, h('small', null, 'Carte professionnelle'), h('b', null, d.type || 'AGENT'))),
    h('div', { class: 'ca-filet' }),
    h('div', { class: 'ca-milieu' }, photoDe(d), identite(d, 4, 52)),
    h('div', { class: 'ca-bande' }, h('b', null, bandeauDe(d)), h('span', null, [d.zone, d.dispo].filter(Boolean).join(' · '))));
}
export function verso(d) {
  let qr = null;
  if (d.qr && d.lienQr) { try { qr = h('div', { class: 'ca-qr' }, h('div', { class: 'ca-qr__code' }, qrSvg(d.lienQr, '#0b0b0c')), d.texteQr ? h('small', null, d.texteQr) : null); } catch (e) { qr = null; } }
  return h('div', { class: `cp ${estVertical(d) ? 'cp--v' : 'cp--h'} cp--verso` },
    h('div', { class: 'ca-cadre' },
      marque(),
      h('p', { class: 'ca-v-texte' }, String(d.texteVerso || '').replace(/BDA S[ée]curit[ée](?: (?:&|et) VTC Premium)?/g, 'BDA Security Group (BDASECURITE)')),
      h('div', { class: 'ca-v-bloc' },
        h('span', null, 'Employeur'), h('b', null, d.employeur || 'BDA SECURITE'), h('small', null, d.autorisation)),
      qr,
      h('p', { class: 'ca-v-legal' }, d.legal),
      h('div', { class: 'ca-v-pied' }, h('span', null, d.contact), h('span', { class: 'ca-signature' }, 'Signature du titulaire'))));
}

/* ---------- Impression ---------- */
// Planche A4 : chaque ligne = recto | verso côte à côte (pliez au milieu ou découpez).
// Cartes verticales : 3 lignes par page ; horizontales : 4. Les cartes sans verso sont regroupées sur une même ligne.
function planchesA4(cartes) {
  const pages = [];
  [true, false].forEach((vertical) => {
    const lignes = [];
    let seules = [];
    cartes.filter((d) => estVertical(d) === vertical).forEach((d) => {
      if (d.verso) { lignes.push([recto(d), verso(d)]); return; }
      seules.push(recto(d));
      if (seules.length === (vertical ? 3 : 2)) { lignes.push(seules); seules = []; }
    });
    if (seules.length) lignes.push(seules);
    const parPage = vertical ? 3 : 4;
    for (let i = 0; i < lignes.length; i += parPage) {
      pages.push(h('div', { class: 'planche' }, lignes.slice(i, i + parPage).map((l) => h('div', { class: 'planche__ligne' }, l))));
    }
  });
  return pages;
}
// enPdf : fichier PDF téléchargé directement au lieu de la fenêtre d'impression
export function imprimerCartes(cartes, mode, titre, enPdf = false) {
  if (mode === 'carte') {
    const v = estVertical(cartes[0] || {});
    const taille = v ? { l: 54, h: 85.6 } : { l: 85.6, h: 54 };
    const pages = cartes.flatMap((d) => [h('div', { class: `page-carte ${v ? 'page-carte--v' : ''}` }, recto({ ...d, format: v ? 'vertical' : 'horizontal' })),
      d.verso ? h('div', { class: `page-carte ${v ? 'page-carte--v' : ''}` }, verso({ ...d, format: v ? 'vertical' : 'horizontal' })) : null]).filter(Boolean);
    return enPdf ? telechargerPages(pages, titre, taille, 6) : imprimerPages(pages, `${taille.l}mm ${taille.h}mm`, titre);
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
      h('div', { class: 'vide-grand__visuel' }, recto({ ...CARTE_DEFAUT, prenom: 'Prénom', nom: 'Nom', nub: '0000000', numero: '2026-0000000-CAR-SH-0000000' })),
      h('div', null, h('h2', null, 'Créez la carte de vos agents'), h('p', null, 'Choisissez un agent : nom, fonction, numéro de carte pro et date de validité se remplissent seuls. Ajoutez une photo, la carte est prête à imprimer ou à enregistrer en PDF.'),
        h('a', { class: 'btn btn--gold', href: '#/cartes/nouvelle' }, icone('plus'), 'Créer une carte'))));
  }
  ctx.afficher(h('div', { class: 'galerie' }, cartes.map((c) => h('a', { class: 'galerie__item', href: `#/cartes/${c.id}` },
    h('div', { class: `galerie__visuel galerie__visuel--carte ${estVertical(c.data) ? 'galerie__visuel--v' : ''}` }, recto(c.data)),
    h('div', { class: 'galerie__txt' }, h('b', null, nomComplet(c.data) || 'Sans nom'),
      h('small', null, c.data.fonction))))));
}

async function editeurCarte(ctx, id, agentId) {
  const [{ agents }, existant] = await Promise.all([api('agents'), id ? api('creation', undefined, { id }) : null]);
  const d = { ...CARTE_DEFAUT, ...(existant ? existant.creation.data : {}) };
  ctx.titre(id ? `Carte — ${nomComplet(d) || 'sans nom'}` : 'Nouvelle carte agent');

  const indicateur = h('span', { class: 'etat-save' });
  const save = enregistreurAuto({ type: 'carte', route: 'cartes', id, data: d, titre: () => nomComplet(d), ctx, indicateur });

  /* ----- Aperçu : recto et verso côte à côte pour le format vertical ----- */
  const echRecto = h('div', { class: 'echelle' }), echVerso = h('div', { class: 'echelle' });
  const zoneRecto = h('div', { class: 'apercu-carte' }, echRecto);
  const zoneVerso = h('div', { class: 'apercu-carte' }, echVerso);
  const blocVerso = h('div', { class: 'apercu__face' }, h('span', { class: 'apercu__label' }, 'Verso'), zoneVerso);
  const apercu = h('div', { class: 'apercu' }, h('div', { class: 'apercu__face' }, h('span', { class: 'apercu__label' }, 'Recto'), zoneRecto), blocVerso);
  let ajusterRecto = () => {}, ajusterVerso = () => {};
  function dessiner() {
    echRecto.replaceChildren(recto(d));
    echVerso.replaceChildren(verso(d));
    blocVerso.hidden = !d.verso;
    apercu.classList.toggle('apercu--duo', estVertical(d) && d.verso);
    ajusterRecto(); ajusterVerso();
  }
  const change = () => { dessiner(); save.change(); ctx.titre(`Carte — ${nomComplet(d) || 'sans nom'}`); };

  /* ----- Formulaire ----- */
  const lier = (el, cle, transformer = (v) => v) => { el.value = d[cle] ?? ''; el.addEventListener('input', () => { d[cle] = transformer(el.value); change(); }); return el; };
  const prenom = lier(saisie({ placeholder: 'ex. Karim' }), 'prenom');
  const nom = lier(saisie({ placeholder: 'ex. Benali' }), 'nom');
  const numero = lier(saisie({ placeholder: 'ex. 2026-0092602-CAR-SH-0917863' }), 'numero');
  const nub = lier(saisie({ placeholder: '7 chiffres', inputmode: 'numeric', maxlength: 7 }), 'nub', (v) => v.replace(/\D/g, '').slice(0, 7));
  const validite = lier(h('input', { class: 'input', type: 'date' }), 'validite');
  // Numéro de carte collé : le NUB (7 derniers chiffres) se remplit tout seul s'il est vide
  numero.addEventListener('change', () => {
    if (d.nub || estVtc(d.fonction)) return;
    const c = lireCarte(d.numero);
    if (c.nub) { d.nub = c.nub; nub.value = c.nub; change(); }
  });
  const autre = saisie({ placeholder: 'Précisez la fonction' });
  const fonction = h('select', { class: 'input' }, FONCTIONS.map((f) => h('option', { value: f }, f)), h('option', { value: '__autre' }, 'Autre…'));
  const majFonction = () => {
    const connue = FONCTIONS.includes(d.fonction);
    fonction.value = connue ? d.fonction : '__autre';
    autre.hidden = connue;
    autre.value = connue ? '' : d.fonction;
    nub.closest('.champ')?.toggleAttribute('hidden', estVtc(d.fonction));
  };
  fonction.addEventListener('change', () => {
    if (fonction.value === '__autre') { autre.hidden = false; autre.focus(); return; }
    autre.hidden = true;
    d.fonction = fonction.value;
    d.type = estVtc(d.fonction) ? 'CHAUFFEUR' : 'AGENT';
    d.labelNumero = estVtc(d.fonction) ? 'N° carte pro VTC' : 'N° carte pro CNAPS';
    options.type.value = d.type; options.labelNumero.value = d.labelNumero;
    majFonction();
    change();
  });
  autre.addEventListener('input', () => { d.fonction = autre.value; change(); });

  // Remplir depuis la liste des agents (nom, fonction, n° de carte, NUB, date de validité)
  function depuisAgent(a) {
    const mots = String(a.nom || '').trim().split(/\s+/);
    const majus = mots.filter((m) => m.length > 1 && m === m.toUpperCase());
    if (majus.length && majus.length < mots.length) { d.nom = majus.join(' '); d.prenom = mots.filter((m) => !majus.includes(m)).join(' '); } else { d.prenom = mots[0] || ''; d.nom = mots.slice(1).join(' '); }
    d.fonction = a.poste === 'ADS' ? FONCTIONS[0] : a.poste || FONCTIONS[0];
    d.type = estVtc(d.fonction) ? 'CHAUFFEUR' : 'AGENT';
    d.labelNumero = estVtc(d.fonction) ? 'N° carte pro VTC' : 'N° carte pro CNAPS';
    d.numero = a.carte || '';
    let infos = {};
    try { infos = JSON.parse(a.infos || '{}') || {}; } catch (e) { infos = {}; }
    d.nub = estVtc(d.fonction) ? '' : (infos.nub || lireCarte(a.carte).nub || '');
    d.validite = a.validite || lireCarte(a.carte).fin || '';
    d.agentId = a.id;
    [[prenom, 'prenom'], [nom, 'nom'], [numero, 'numero'], [nub, 'nub'], [validite, 'validite']].forEach(([el, k]) => { el.value = d[k]; });
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
    bandeau: lier(saisie({ placeholder: 'SÉCURITÉ PRIVÉE' }), 'bandeau', (v) => v.toUpperCase()),
    zone: lier(saisie(), 'zone'),
    dispo: lier(saisie(), 'dispo'),
    texteVerso: lier(zoneTexte({ rows: 3 }), 'texteVerso'),
    employeur: lier(saisie(), 'employeur'),
    autorisation: lier(saisie(), 'autorisation'),
    contact: lier(saisie(), 'contact'),
    lienQr: lier(saisie({ placeholder: 'https://…' }), 'lienQr'),
    texteQr: lier(saisie(), 'texteQr'),
  };
  const caseVerso = h('input', { type: 'checkbox', checked: d.verso, onchange: () => { d.verso = caseVerso.checked; change(); } });
  const caseQr = h('input', { type: 'checkbox', checked: d.qr, onchange: () => { d.qr = caseQr.checked; change(); } });
  const choixFormat = segments([['vertical', 'Vertical · tour de cou'], ['horizontal', 'Horizontal']], estVertical(d) ? 'vertical' : 'horizontal',
    (v) => { d.format = v; change(); }, 'Format de la carte');

  /* ----- Actions ----- */
  const titreImpression = () => `Carte agent - ${nomComplet(d) || 'BDA'}`;
  const panneau = h('aside', { class: 'panneau' },
    h('div', { class: 'panneau__bloc' }, h('h3', null, 'Agent'),
      choixAgent,
      h('div', { class: 'form-grille form-grille--2' }, champ('Prénom', prenom), champ('Nom', nom)),
      champ('Fonction', fonction), autre,
      champ('N° de carte professionnelle', numero),
      h('div', { class: 'form-grille form-grille--2' }, champ('N° d\'identification', nub, '7 derniers chiffres, comme sur la tenue'), champ('Valable jusqu\'au', validite))),
    h('div', { class: 'panneau__bloc' }, h('h3', null, 'Photo'), fichier, btnPhoto, reglagesPhoto, retirer),
    h('div', { class: 'panneau__bloc' }, h('h3', null, 'Format'), choixFormat),
    h('div', { class: 'panneau__bloc' }, h('h3', null, 'Imprimer'),
      h('button', { class: 'btn btn--gold btn--bloc', type: 'button', onclick: async () => { await save.maintenant(); imprimerCartes([d], 'a4', titreImpression(), true); } }, icone('telecharger'), 'Télécharger en PDF (feuille A4)'),
      h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: async () => { await save.maintenant(); imprimerCartes([d], 'a4', titreImpression()); } }, icone('imprimer'), 'Imprimer (feuille A4)'),
      h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: async () => { await save.maintenant(); imprimerCartes([d], 'carte', titreImpression(), true); } }, icone('badge'), 'PDF format carte (imprimante à badges)'),
      h('p', { class: 'panneau__astuce' }, 'Sur A4 : recto et verso côte à côte, à découper puis plier au milieu (ou à plastifier). Porte-badge vertical 54 × 86 mm.')),
    h('details', { class: 'panneau__bloc panneau__plus' }, h('summary', null, 'Plus d\'options'),
      champ('Bandeau du bas', options.bandeau, 'Vide : « SÉCURITÉ PRIVÉE » (ou « CHAUFFEUR PRIVÉ »)'),
      h('div', { class: 'form-grille form-grille--2' }, champ('Titre (horizontal)', options.type), champ('Libellé du numéro', options.labelNumero)),
      h('div', { class: 'form-grille form-grille--2' }, champ('Zone (horizontal)', options.zone), champ('Disponibilité', options.dispo)),
      h('label', { class: 'case' }, caseVerso, h('span', null, 'Imprimer aussi le verso')),
      champ('Texte du verso', options.texteVerso), champ('Employeur', options.employeur), champ('Autorisation CNAPS', options.autorisation), champ('Contact (verso)', options.contact),
      h('label', { class: 'case' }, caseQr, h('span', null, 'QR code au verso')),
      champ('Lien du QR code', options.lienQr), champ('Texte sous le QR code', options.texteQr)),
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
  ctx.afficher(h('div', { class: 'editeur editeur--carte' }, apercu, panneau));
  majFonction();
  majCurseurs();
  dessiner();
  ajusterRecto = ajusterEchelle(zoneRecto, echRecto, 2.2);
  ajusterVerso = ajusterEchelle(zoneVerso, echVerso, 2.2);
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
