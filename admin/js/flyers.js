/* =========================================================
   ESPACE ADMIN BDA — flyers
   Flyer A4 aux couleurs BDA : chaque texte se modifie au clic,
   sections masquables, QR code généré, impression A4 ou A5.
   ========================================================= */
import { api, h, icone, ecusson, toast, erreur, confirmer, champ, saisie, dateLisible } from './outils.js';
import { enregistreurAuto, editable, ajusterEchelle, imprimerPages } from './creations.js';
import { qrSvg } from './qr.js';

const ICONES = ['bouclier', 'voiture', 'etoile', 'couronne', 'cle', 'camera', 'oeilv', 'horloge'];

export const FLYER_DEFAUT = {
  nom: 'Flyer BDA',
  format: 'A4',
  titre1: 'Votre sécurité,',
  titre2: 'en première classe.',
  intro: 'Gardiennage, surveillance et chauffeurs privés à Paris et en Île-de-France. Un seul interlocuteur, discret, ponctuel et élégant.',
  secteurs: ['Commerces', 'Hôtels', 'Entreprises', 'Événements'],
  kicker: 'Ce que nous faisons pour vous',
  section: 'Trois offres, une seule exigence : l\'excellence',
  offres: [
    { icone: 'bouclier', titre: 'Sécurité privée', sous: 'Commerces · bureaux · sites', points: ['Gardiennage & surveillance', 'Contrôle d\'accès & filtrage', 'Sécurité d\'événements'] },
    { icone: 'voiture', titre: 'VTC Premium', sous: 'Hôtels · clients · collaborateurs', points: ['Transferts aéroports & gares', 'Mise à disposition à l\'heure', 'Déplacements professionnels'] },
    { icone: 'etoile', titre: 'Offre VIP combinée', sous: 'Personnalités · délégations', points: ['Chauffeur + agent de sécurité', 'Accompagnement VIP', 'Soirées privées & galas'] },
  ],
  chiffres: [
    { v: '24/7', l: 'Disponibles week-ends et jours fériés' },
    { v: '100 %', l: 'Agents titulaires de la carte pro CNAPS' },
    { v: '0 €', l: 'Devis gratuit et sans engagement' },
  ],
  reference: 'Partenaire de confiance du Consulat général de Colombie à Paris.',
  contactKicker: 'Devis gratuit · Réponse rapide',
  contactTitre: 'Parlons de votre établissement.',
  tel1Label: 'Appel', tel1: '06 11 67 86 25',
  tel2Label: 'WhatsApp', tel2: '07 84 73 90 70',
  infos: 'bdasecurite.com     bdasecurite@gmail.com     Paris & Île-de-France',
  qr: 'https://bdasecurite.com/devis', qrTitre: 'Scannez-moi', qrSous: 'Devis en 2 minutes',
  pied: 'BDA Sécurité & VTC Premium — EURL · SIRET 109 076 463 00016 · Autorisation CNAPS n° AUT-075-2124-07-01-20250906336\n« L\'autorisation d\'exercice ne confère aucune prérogative de puissance publique à l\'entreprise ou aux personnes qui en bénéficient. » (art. L612-14 CSI)',
  afficher: { secteurs: true, chiffres: true, reference: true, qr: true },
};
const copie = (o) => JSON.parse(JSON.stringify(o));
function completer(data) {
  const d = { ...copie(FLYER_DEFAUT), ...data };
  d.afficher = { ...FLYER_DEFAUT.afficher, ...(data.afficher || {}) };
  return d;
}

/* ---------- Dessin du flyer ----------
   modifiable = false : rendu fixe (vignettes, impression) */
export function flyer(d, surChange = null) {
  const mod = !!surChange;
  const t = (tag, cls, obj, cle, ph) => (mod ? editable(tag, cls, obj, cle, ph, surChange) : h(tag, { class: `${cls} ${String(obj[cle] || '').trim() ? '' : 'est-vide'}` }, obj[cle]));
  const qr = (() => { try { return qrSvg(d.qr || 'https://bdasecurite.com'); } catch (e) { return h('span', { class: 'fl__qr-erreur' }, e.message); } })();

  const icone3 = (o) => h('button', {
    type: 'button', class: 'fl__ic', tabindex: mod ? 0 : -1, title: mod ? 'Cliquer pour changer l\'icône' : null,
    onclick: mod ? (e) => { o.icone = ICONES[(ICONES.indexOf(o.icone) + 1) % ICONES.length]; e.currentTarget.replaceChildren(icone(o.icone)); surChange(); } : null,
  }, icone(o.icone));

  return h('article', { class: `fl ${mod ? 'fl--modifiable' : ''}` },
    h('header', { class: 'fl__hero' },
      h('div', { class: 'fl__marque' }, ecusson('fl__logo'), h('div', null, h('b', null, 'BDA SÉCURITÉ'), h('small', null, 'Sécurité privée · VTC Premium'))),
      h('h1', { class: 'fl__titre' }, t('span', 'fl__t1', d, 'titre1', 'Titre'), t('span', 'fl__t2', d, 'titre2', 'Suite du titre')),
      t('p', 'fl__intro', d, 'intro', 'Texte de présentation'),
      d.afficher.secteurs ? h('div', { class: 'fl__secteurs' }, d.secteurs.map((_, i) => t('span', 'fl__secteur', d.secteurs, i, 'Secteur'))) : null),
    h('div', { class: 'fl__filet' }),
    h('section', { class: 'fl__offres' },
      t('p', 'fl__kicker', d, 'kicker', 'Petit titre'),
      t('h2', 'fl__section', d, 'section', 'Titre de la section'),
      h('div', { class: 'fl__cartes' }, d.offres.map((o) => h('div', { class: 'fl__carte' },
        icone3(o),
        t('h3', 'fl__carte-titre', o, 'titre', 'Offre'),
        t('p', 'fl__carte-sous', o, 'sous', 'Pour qui'),
        h('ul', null, o.points.map((_, i) => t('li', 'fl__point', o.points, i, 'Point fort'))))))),
    d.afficher.chiffres ? h('div', { class: 'fl__chiffres' }, d.chiffres.map((c) => h('div', null, t('b', 'fl__chiffre', c, 'v', '00'), t('span', 'fl__chiffre-txt', c, 'l', 'Légende')))) : null,
    d.afficher.reference ? t('p', 'fl__reference', d, 'reference', 'Référence client') : null,
    h('section', { class: 'fl__contact' },
      h('div', { class: 'fl__contact-txt' },
        t('p', 'fl__kicker fl__kicker--clair', d, 'contactKicker', 'Petit titre'),
        t('h2', 'fl__contact-titre', d, 'contactTitre', 'Titre'),
        h('div', { class: 'fl__tels' },
          h('div', null, t('small', 'fl__tel-label', d, 'tel1Label', 'Libellé'), t('b', 'fl__tel', d, 'tel1', 'Téléphone')),
          h('div', null, t('small', 'fl__tel-label', d, 'tel2Label', 'Libellé'), t('b', 'fl__tel', d, 'tel2', 'Téléphone'))),
        t('p', 'fl__infos', d, 'infos', 'Site · email · zone')),
      d.afficher.qr ? h('div', { class: 'fl__qr' }, qr, t('b', 'fl__qr-titre', d, 'qrTitre', 'Titre'), t('small', 'fl__qr-sous', d, 'qrSous', 'Sous-titre')) : null),
    t('footer', 'fl__pied', d, 'pied', 'Mentions légales'));
}

function imprimerFlyer(d) {
  const f = flyer(d);
  if (d.format === 'A5') f.classList.add('fl--a5');
  return imprimerPages([f], `${d.format === 'A5' ? 'A5' : 'A4'} portrait`, `Flyer - ${d.nom || 'BDA'}`);
}

/* =========================================================
   PAGE : liste ou éditeur
   ========================================================= */
export function pageFlyers(ctx) {
  const [p0] = ctx.params;
  if (p0 === 'nouveau') return editeurFlyer(ctx, 0);
  if (/^\d+$/.test(p0 || '')) return editeurFlyer(ctx, +p0);
  return listeFlyers(ctx);
}

async function listeFlyers(ctx) {
  ctx.titre('Flyers');
  ctx.actions(h('a', { class: 'btn btn--gold', href: '#/flyers/nouveau' }, icone('plus'), h('span', null, 'Nouveau flyer')));
  const { creations } = await api('creations', undefined, { type: 'flyer' });
  if (!creations.length) {
    return ctx.afficher(h('section', { class: 'carte vide-grand' },
      h('div', { class: 'vide-grand__visuel vide-grand__visuel--flyer' }, flyer(completer({}))),
      h('div', null, h('h2', null, 'Votre flyer, prêt à imprimer'), h('p', null, 'Partez du modèle BDA : cliquez sur n\'importe quel texte pour le changer, masquez ce qui ne sert pas, puis imprimez en A4 ou A5 ou enregistrez-le en PDF.'),
        h('a', { class: 'btn btn--gold', href: '#/flyers/nouveau' }, icone('plus'), 'Créer un flyer'))));
  }
  ctx.afficher(h('div', { class: 'galerie galerie--flyers' }, creations.map((c) => h('a', { class: 'galerie__item', href: `#/flyers/${c.id}` },
    h('div', { class: 'galerie__visuel galerie__visuel--flyer' }, flyer(completer(c.data))),
    h('div', { class: 'galerie__txt' }, h('b', null, c.titre || 'Flyer'), h('small', null, `${completer(c.data).format} · modifié le ${dateLisible(c.maj)}`))))));
}

async function editeurFlyer(ctx, id) {
  const existant = id ? await api('creation', undefined, { id }) : null;
  const d = completer(existant ? existant.creation.data : {});
  ctx.titre(d.nom || 'Flyer');

  const indicateur = h('span', { class: 'etat-save' });
  const save = enregistreurAuto({ type: 'flyer', route: 'flyers', id, data: d, titre: () => d.nom, ctx, indicateur });

  const echelle = h('div', { class: 'echelle' });
  const zone = h('div', { class: 'apercu-flyer' }, echelle);
  const change = () => save.change();
  // Redessin complet seulement quand la structure change (sections, QR) : la saisie en cours n'est pas perturbée
  const redessiner = () => echelle.replaceChildren(flyer(d, change));

  const nom = saisie({ value: d.nom, oninput: (e) => { d.nom = e.target.value; ctx.titre(d.nom || 'Flyer'); change(); } });
  const format = h('select', { class: 'input', onchange: (e) => { d.format = e.target.value; change(); } },
    h('option', { value: 'A4', selected: d.format !== 'A5' }, 'A4 (21 × 29,7 cm)'), h('option', { value: 'A5', selected: d.format === 'A5' }, 'A5 (14,8 × 21 cm)'));
  const bascule = (cle, libelle) => h('label', { class: 'case' }, h('input', { type: 'checkbox', checked: d.afficher[cle], onchange: (e) => { d.afficher[cle] = e.target.checked; redessiner(); change(); } }), h('span', null, libelle));
  const lienQr = saisie({ value: d.qr, placeholder: 'https://bdasecurite.com/devis', onchange: (e) => { d.qr = e.target.value.trim(); redessiner(); change(); } });

  const panneau = h('aside', { class: 'panneau' },
    h('div', { class: 'panneau__bloc panneau__bloc--astuce' }, icone('crayon'), h('p', null, 'Cliquez sur n\'importe quel texte du flyer pour le modifier. Cliquez sur une icône pour la changer.')),
    h('div', { class: 'panneau__bloc' }, h('h3', null, 'Imprimer'),
      champ('Format', format),
      h('button', { class: 'btn btn--gold btn--bloc', type: 'button', onclick: async () => { await save.maintenant(); imprimerFlyer(d); } }, icone('imprimer'), 'Imprimer / PDF')),
    h('div', { class: 'panneau__bloc' }, h('h3', null, 'Afficher'),
      bascule('secteurs', 'Secteurs (Commerces, Hôtels…)'), bascule('chiffres', 'Chiffres clés'), bascule('reference', 'Référence client'), bascule('qr', 'QR code')),
    h('details', { class: 'panneau__bloc panneau__plus' }, h('summary', null, 'Plus d\'options'),
      champ('Nom du flyer (pour vous)', nom),
      champ('Lien du QR code', lienQr, 'Ex. la page devis du site.'),
      h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: async () => {
        if (!(await confirmer('Remettre tous les textes du modèle BDA ? Vos modifications de ce flyer seront perdues.', { ok: 'Remettre le modèle' }))) return;
        const garde = { nom: d.nom, format: d.format };
        Object.keys(d).forEach((k) => delete d[k]);
        Object.assign(d, copie(FLYER_DEFAUT), garde);
        lienQr.value = d.qr;
        redessiner(); change();
      } }, 'Revenir au modèle')),
    h('div', { class: 'panneau__liens' },
      h('button', { class: 'lien-btn', type: 'button', onclick: async () => {
        await save.maintenant();
        try { const r = await api('creation.enregistrer', { type: 'flyer', titre: `${d.nom} (copie)`, data: { ...copie(d), nom: `${d.nom} (copie)` } }); toast('Flyer dupliqué.'); ctx.aller(`#/flyers/${r.id}`); } catch (e) { erreur(e); }
      } }, icone('copier'), 'Dupliquer'),
      h('button', { class: 'lien-btn lien-btn--danger', type: 'button', onclick: async () => {
        if (!save.etat.id) return ctx.aller('#/flyers');
        if (!(await confirmer(`Supprimer le flyer « ${d.nom} » ?`, { ok: 'Supprimer', danger: true }))) return;
        try { await api('creation.supprimer', { id: save.etat.id }); toast('Flyer supprimé.'); ctx.aller('#/flyers'); } catch (e) { erreur(e); }
      } }, icone('poubelle'), 'Supprimer')));

  ctx.actions(h('a', { class: 'btn btn--ghost', href: '#/flyers' }, icone('retour'), h('span', null, 'Flyers')), indicateur);
  ctx.afficher(h('div', { class: 'editeur editeur--flyer' }, zone, panneau));
  redessiner();
  ajusterEchelle(zone, echelle, 1);
}
