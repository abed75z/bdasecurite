/* =========================================================
   ESPACE ADMIN BDA — Contenu du site
   Afficher / masquer des rubriques (tarifs, références…),
   modifier les prix affichés et l'accueil (titre, texte, image).
   Tout s'applique sur le site dès l'enregistrement.
   ========================================================= */
import { api, h, icone, toast, erreur, champ, saisie, zoneTexte } from './outils.js';

const RUBRIQUES = [
  ['tarifs', 'Page Tarifs', 'Page /tarifs, lien « Tarifs » du menu et du pied de page'],
  ['prixAccueil', 'Prix sur l’accueil', 'Bandeau « Tarifs transparents » de la page d’accueil'],
  ['offreVtc', 'Offre VTC Premium', 'Menu VTC, pages chauffeur et transferts, prix VTC'],
  ['ssiap', 'Sécurité incendie SSIAP', 'Page SSIAP et ses liens'],
  ['references', 'Page Références', 'Page /references et ses liens'],
  ['avisClients', 'Avis clients', 'Page /avis, liens et note moyenne sur l’accueil'],
  ['recrutement', 'Page Recrutement', 'Page /recrutement et ses liens'],
  ['whatsapp', 'Bouton WhatsApp', 'Bouton vert flottant en bas des pages'],
];
const PRIX = [
  ['Sécurité privée · HT par heure et par agent', [
    ['agent', 'Agent de sécurité'], ['evenementiel', 'Sécurité événementielle'], ['ssiap1', 'SSIAP 1'], ['ssiap2', 'SSIAP 2'], ['ssiap3', 'SSIAP 3'],
    ['protection', 'Protection rapprochée (heure)'], ['protectionJour', 'Protection rapprochée (journée 8 h)'],
  ], '€'],
  ['Majorations', [['nuit', 'Nuit (21 h – 6 h)'], ['dimanche', 'Dimanche'], ['ferie', 'Jour férié']], '%'],
  ['VTC · TTC berline', [['orly', 'Paris ↔ Orly'], ['cdg', 'Paris ↔ Roissy-CDG'], ['beauvais', 'Paris ↔ Beauvais'], ['heure', 'À disposition (heure)'], ['demi', 'Demi-journée (4 h)'], ['journee', 'Journée (8 h)'], ['mariage', 'Mariage']], '€'],
  ['VTC · TTC van 7 places', [['orlyVan', 'Paris ↔ Orly'], ['cdgVan', 'Paris ↔ Roissy-CDG'], ['beauvaisVan', 'Paris ↔ Beauvais'], ['heureVan', 'À disposition (heure)'], ['demiVan', 'Demi-journée (4 h)'], ['journeeVan', 'Journée (8 h)']], '€'],
];

export async function pageContenu(ctx) {
  ctx.titre('Contenu du site');
  ctx.actions(
    h('a', { class: 'btn btn--ghost', href: '/tarifs', target: '_blank', rel: 'noopener' }, icone('euro'), h('span', null, 'Voir les tarifs')),
    h('a', { class: 'btn btn--ghost', href: '/', target: '_blank', rel: 'noopener' }, icone('site'), h('span', null, 'Voir le site')));
  let { site: s } = await api('site');
  const enregistrer = async (donnees, message) => {
    try { ({ site: s } = await api('site.enregistrer', donnees)); toast(message); return true; } catch (e) { erreur(e); return false; }
  };

  /* ---------- 1. Rubriques visibles ---------- */
  const rubriques = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Ce que voient les visiteurs'), h('small', null, 'Masquez une rubrique en un clic, réaffichez-la quand vous voulez')),
    h('ul', { class: 'services' }, RUBRIQUES.map(([k, titre, aide]) => {
      const etat = h('span', { class: 'service__etat' });
      const ligne = h('li', { class: 'service' });
      const inter = h('input', { type: 'checkbox', role: 'switch', 'aria-label': titre, checked: s.visible?.[k] !== false });
      const peindre = () => {
        ligne.classList.toggle('service--ferme', !inter.checked);
        etat.classList.toggle('is-on', inter.checked);
        etat.textContent = inter.checked ? 'Visible' : 'Masqué';
      };
      inter.addEventListener('change', async () => {
        inter.disabled = true;
        const ok = await enregistrer({ visible: { [k]: inter.checked } }, `${titre} : ${inter.checked ? 'visible' : 'masqué'} sur le site.`);
        if (!ok) inter.checked = !inter.checked;
        inter.disabled = false;
        peindre();
      });
      peindre();
      ligne.append(h('span', { class: 'service__ic' }, icone(inter.checked ? 'oeil' : 'oeil')), h('div', { class: 'service__txt' }, h('b', null, titre), h('small', null, aide)), etat,
        h('label', { class: 'interrupteur' }, inter, h('span', { 'aria-hidden': 'true' })));
      return ligne;
    })),
    h('p', { class: 'astuce' }, 'Une page masquée affiche « Page indisponible » avec vos numéros si quelqu’un l’ouvre directement.'));

  /* ---------- 2. Accueil ---------- */
  const a = s.accueil || {};
  const titre = saisie({ value: a.titre || '', maxlength: 160 });
  const texte = zoneTexte({ rows: 4, value: a.texte || '', maxlength: 400 });
  const note = saisie({ value: a.note || '', maxlength: 160 });
  let visuel = a.visuel === 'logo' ? 'logo' : 'photo';
  const choixVisuel = h('div', { class: 'choix-visuel' }, [['photo', 'Téléphone', ''], ['logo', 'Logo BDA', '/assets/img/embleme-hd.png']].map(([v, lib]) => {
    const b = h('button', { type: 'button', class: `choix-visuel__btn ${visuel === v ? 'is-actif' : ''}`, onclick: () => {
      visuel = v;
      choixVisuel.querySelectorAll('button').forEach((x) => x.classList.toggle('is-actif', x === b));
    } }, icone(v === 'photo' ? 'mobile' : 'bouclier'), h('b', null, lib), h('small', null, v === 'photo' ? 'Conversation client animée' : 'Logo en grand'));
    return b;
  }));
  const accueil = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Page d’accueil'), h('small', null, 'Le haut de la page d’accueil')),
    h('form', { class: 'form-grille', onsubmit: async (e) => {
      e.preventDefault();
      if (!titre.value.trim()) return toast('Le titre ne peut pas être vide.', 'erreur');
      await enregistrer({ accueil: { titre: titre.value.trim(), texte: texte.value.trim(), note: note.value.trim(), visuel } }, 'Accueil mis à jour sur le site.');
    } },
    champ('Grand titre', titre, 'Mettez entre [crochets] la partie à colorer, par exemple : Agents de sécurité à Paris, [24h/24.]'),
    champ('Texte de présentation', texte),
    champ('Petite phrase sous les boutons', note),
    h('div', { class: 'champ' }, h('span', { class: 'champ__label' }, 'Image à droite'), choixVisuel),
    h('div', null, h('button', { class: 'btn btn--gold', type: 'submit' }, icone('coche'), 'Enregistrer l’accueil'))));

  /* ---------- 3. Tarifs ---------- */
  const champsPrix = {};
  const t = s.tarifs || {};
  const tarifs = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Tarifs affichés'), h('small', null, 'Page Tarifs, bandeau de l’accueil et estimation en ligne')),
    h('form', { class: 'form-grille', onsubmit: async (e) => {
      e.preventDefault();
      const prix = {};
      for (const [k, el] of Object.entries(champsPrix)) {
        const n = parseFloat(String(el.value).replace(',', '.'));
        if (!Number.isFinite(n) || n < 0) { el.focus(); return toast('Un prix est invalide.', 'erreur'); }
        prix[k] = n;
      }
      await enregistrer({ tarifs: prix }, 'Tarifs mis à jour sur le site.');
    } },
    PRIX.map(([groupe, lignes, unite]) => h('fieldset', { class: 'prix-groupe' },
      h('legend', null, groupe),
      h('div', { class: 'prix-grille' }, lignes.map(([k, lib]) => {
        champsPrix[k] = h('input', { class: 'input', type: 'text', inputmode: 'decimal', value: String(t[k] ?? '').replace('.', ','), 'aria-label': lib });
        return h('label', { class: 'prix-champ' }, h('span', null, lib), h('div', { class: 'prix-champ__saisie' }, champsPrix[k], h('em', null, unite)));
      })))),
    h('div', null, h('button', { class: 'btn btn--gold', type: 'submit' }, icone('coche'), 'Enregistrer les tarifs'))));

  ctx.afficher(h('div', { class: 'grille-2' }, rubriques, accueil), tarifs);
}
