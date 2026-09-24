/* =========================================================
   ESPACE ADMIN BDA — cartes de visite
   Format standard 85 × 55 mm : recto noir (logo), verso clair
   (coordonnées + QR code). Planche A4 de 10 cartes ou format carte.
   ========================================================= */
import { api, h, icone, ecusson, toast, erreur, confirmer, champ, saisie } from './outils.js';
import { enregistreurAuto, ajusterEchelle, imprimerPages } from './creations.js';
import { qrSvg } from './qr.js';

export const VISITE_DEFAUT = {
  nom: 'Abdelouahab BOUIDIA', fonction: 'Gérant',
  tel1Label: 'Tél.', tel1: '06 11 67 86 25',
  tel2Label: 'WhatsApp', tel2: '07 84 73 90 70',
  email: 'bdasecurite@gmail.com', site: 'bdasecurite.com',
  zone: 'Paris & Île-de-France · 24/7',
  qr: true, lienQr: 'https://bdasecurite.com/devis', texteQr: 'Devis en ligne',
};

/* ---------- Dessin ---------- */
export function rectoVisite(d) {
  return h('div', { class: 'cv cv--recto' },
    ecusson('cv__logo'),
    h('b', { class: 'cv__marque' }, 'BDA SÉCURITÉ'),
    h('span', { class: 'cv__filet' }),
    h('small', { class: 'cv__slogan' }, 'Sécurité privée · VTC Premium'),
    d.zone ? h('span', { class: 'cv__zone' }, d.zone) : null);
}
export function versoVisite(d) {
  const ligne = (ic, label, valeur) => (valeur ? h('li', null, h('span', { class: 'cv__ic' }, icone(ic)), label ? h('em', null, label) : null, h('span', null, valeur)) : null);
  let qr = null;
  if (d.qr && d.lienQr) { try { qr = h('div', { class: 'cv__qr' }, qrSvg(d.lienQr), d.texteQr ? h('small', null, d.texteQr) : null); } catch (e) { qr = null; } }
  return h('div', { class: 'cv cv--verso' },
    h('div', { class: 'cv__infos' },
      h('b', { class: 'cv__nom' }, d.nom || ' '),
      h('small', { class: 'cv__fonction' }, d.fonction),
      h('span', { class: 'cv__trait' }),
      h('ul', { class: 'cv__contacts' },
        ligne('telephone', d.tel1Label, d.tel1), ligne('telephone', d.tel2Label, d.tel2),
        ligne('mail', '', d.email), ligne('site', '', d.site))),
    qr,
    h('div', { class: 'cv__bande' }, ecusson('cv__mini'), h('span', null, 'BDA Sécurité')));
}

function imprimerVisites(d, mode) {
  const titre = `Carte de visite - ${d.nom || 'BDA'}`;
  if (mode === 'carte') return imprimerPages([h('div', { class: 'page-visite' }, rectoVisite(d)), h('div', { class: 'page-visite' }, versoVisite(d))], '85mm 55mm', titre);
  // Planche A4 : 10 rectos, puis 10 versos au même emplacement (impression recto-verso)
  const planche = (fn) => h('div', { class: 'planche-visites' }, Array.from({ length: 10 }, () => fn(d)));
  return imprimerPages([planche(rectoVisite), planche(versoVisite)], 'A4 portrait', titre);
}

/* =========================================================
   PAGE : liste ou éditeur
   ========================================================= */
export function pageVisites(ctx) {
  const [p0] = ctx.params;
  if (p0 === 'nouvelle') return editeurVisite(ctx, 0);
  if (/^\d+$/.test(p0 || '')) return editeurVisite(ctx, +p0);
  return listeVisites(ctx);
}

async function listeVisites(ctx) {
  ctx.titre('Cartes de visite');
  ctx.actions(h('a', { class: 'btn btn--gold', href: '#/visites/nouvelle' }, icone('plus'), h('span', null, 'Nouvelle carte')));
  const { creations } = await api('creations', undefined, { type: 'visite' });
  if (!creations.length) {
    return ctx.afficher(h('section', { class: 'carte vide-grand' },
      h('div', { class: 'vide-grand__visuel vide-grand__visuel--visite' }, rectoVisite(VISITE_DEFAUT), versoVisite(VISITE_DEFAUT)),
      h('div', null, h('h2', null, 'Vos cartes de visite'), h('p', null, 'Votre nom, vos numéros, votre email : la carte est prête. Imprimez une planche de 10 cartes sur une feuille A4, ou enregistrez-la en PDF pour un imprimeur.'),
        h('a', { class: 'btn btn--gold', href: '#/visites/nouvelle' }, icone('plus'), 'Créer ma carte'))));
  }
  ctx.afficher(h('div', { class: 'galerie' }, creations.map((c) => {
    const d = { ...VISITE_DEFAUT, ...c.data };
    return h('a', { class: 'galerie__item', href: `#/visites/${c.id}` },
      h('div', { class: 'galerie__visuel galerie__visuel--visite' }, rectoVisite(d), versoVisite(d)),
      h('div', { class: 'galerie__txt' }, h('b', null, d.nom || 'Sans nom'), h('small', null, d.fonction)));
  })));
}

async function editeurVisite(ctx, id) {
  const existant = id ? await api('creation', undefined, { id }) : null;
  const d = { ...VISITE_DEFAUT, ...(existant ? existant.creation.data : {}) };
  ctx.titre(id ? `Carte de visite — ${d.nom}` : 'Nouvelle carte de visite');

  const indicateur = h('span', { class: 'etat-save' });
  const save = enregistreurAuto({ type: 'visite', route: 'visites', id, data: d, titre: () => d.nom, ctx, indicateur });

  const echRecto = h('div', { class: 'echelle' }), echVerso = h('div', { class: 'echelle' });
  const zoneRecto = h('div', { class: 'apercu-carte' }, echRecto), zoneVerso = h('div', { class: 'apercu-carte' }, echVerso);
  const dessiner = () => { echRecto.replaceChildren(rectoVisite(d)); echVerso.replaceChildren(versoVisite(d)); };
  const change = () => { dessiner(); save.change(); };

  const lier = (cle, attrs = {}) => { const el = saisie({ value: d[cle] ?? '', ...attrs }); el.addEventListener('input', () => { d[cle] = el.value; change(); }); return el; };
  const caseQr = h('input', { type: 'checkbox', checked: d.qr, onchange: () => { d.qr = caseQr.checked; lienQr.closest('.champ').hidden = !d.qr; change(); } });
  const lienQr = lier('lienQr', { placeholder: 'https://bdasecurite.com/devis' });

  const panneau = h('aside', { class: 'panneau' },
    h('div', { class: 'panneau__bloc' }, h('h3', null, 'Vos informations'),
      champ('Nom', lier('nom')), champ('Fonction', lier('fonction', { placeholder: 'ex. Gérant' })),
      h('div', { class: 'form-grille form-grille--2 grille-tel' }, champ('Libellé', lier('tel1Label')), champ('Téléphone', lier('tel1', { type: 'tel' }))),
      h('div', { class: 'form-grille form-grille--2 grille-tel' }, champ('Libellé', lier('tel2Label')), champ('Téléphone 2', lier('tel2', { type: 'tel' }))),
      champ('Email', lier('email', { type: 'email' })), champ('Site', lier('site'))),
    h('div', { class: 'panneau__bloc' }, h('h3', null, 'Imprimer'),
      h('button', { class: 'btn btn--gold btn--bloc', type: 'button', onclick: async () => { await save.maintenant(); imprimerVisites(d, 'a4'); } }, icone('imprimer'), 'Planche A4 (10 cartes) / PDF'),
      h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: async () => { await save.maintenant(); imprimerVisites(d, 'carte'); } }, icone('badge'), 'Format carte (pour un imprimeur)'),
      h('p', { class: 'panneau__astuce' }, 'Planche A4 : imprimez en recto-verso (bord long), puis découpez le long des pointillés.')),
    h('details', { class: 'panneau__bloc panneau__plus' }, h('summary', null, 'Plus d\'options'),
      champ('Texte sous le logo (recto)', lier('zone')),
      h('label', { class: 'case' }, caseQr, h('span', null, 'QR code au verso')),
      champ('Lien du QR code', lienQr), champ('Texte sous le QR code', lier('texteQr'))),
    h('div', { class: 'panneau__liens' },
      h('button', { class: 'lien-btn', type: 'button', onclick: async () => {
        await save.maintenant();
        try { const r = await api('creation.enregistrer', { type: 'visite', titre: `${d.nom} (copie)`, data: { ...d } }); toast('Carte dupliquée.'); ctx.aller(`#/visites/${r.id}`); } catch (e) { erreur(e); }
      } }, icone('copier'), 'Dupliquer'),
      h('button', { class: 'lien-btn lien-btn--danger', type: 'button', onclick: async () => {
        if (!save.etat.id) return ctx.aller('#/visites');
        if (!(await confirmer('Supprimer cette carte de visite ?', { ok: 'Supprimer', danger: true }))) return;
        try { await api('creation.supprimer', { id: save.etat.id }); toast('Carte supprimée.'); ctx.aller('#/visites'); } catch (e) { erreur(e); }
      } }, icone('poubelle'), 'Supprimer')));
  lienQr.closest('.champ').hidden = !d.qr;

  ctx.actions(h('a', { class: 'btn btn--ghost', href: '#/visites' }, icone('retour'), h('span', null, 'Cartes de visite')), indicateur);
  ctx.afficher(h('div', { class: 'editeur editeur--carte' },
    h('div', { class: 'apercu' },
      h('div', { class: 'apercu__face' }, h('span', { class: 'apercu__label' }, 'Recto'), zoneRecto),
      h('div', { class: 'apercu__face' }, h('span', { class: 'apercu__label' }, 'Verso'), zoneVerso)),
    panneau));
  dessiner();
  ajusterEchelle(zoneRecto, echRecto, 2.2);
  ajusterEchelle(zoneVerso, echVerso, 2.2);
}
