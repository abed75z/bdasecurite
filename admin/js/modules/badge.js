/* =========================================================
   ESPACE ADMIN BDA — Cartes d'agent (module « badge »)
   Chaque agent a dans son Espace équipe une carte avec un QR code ; le client le scanne
   et la page bdasecurite.com/verifier confirme en direct qu'il travaille pour BDA.
   Ici : l'état de chaque carte, l'aperçu, et « Nouveau QR » (l'ancien ne marche plus).
   ========================================================= */
import { api, h, icone, toast, erreur, modale, confirmer, ilYa } from '../outils.js';
import { qrSvg } from '../qr.js';

const ETATS = { valide: ['Valide', 'payee'], expiree: ['Expirée', 'refusee'], a_verifier: ['À renseigner', 'attente'], inactif: ['Désactivée', 'archivee'] };

function apercu(c) {
  const [lib, ton] = ETATS[c.etat] || ETATS.a_verifier;
  return h('div', { class: 'bg-apercu' },
    h('div', { class: 'bg-carte' },
      h('div', { class: 'bg-carte__haut' }, h('img', { src: '/assets/img/marque-bda-blanc.png', alt: 'BDA Security Group' }), h('span', { class: `pastille pastille--${ton}` }, lib)),
      h('b', { class: 'bg-carte__nom' }, `${c.prenom} ${c.nom}`), h('span', { class: 'bg-carte__quali' }, c.qualification),
      h('div', { class: 'bg-carte__qr' }, qrSvg(c.url)),
      h('div', { class: 'bg-carte__infos' }, h('span', null, 'Carte pro', h('b', null, c.carte || '—')), h('span', null, 'Valable jusqu’au', h('b', null, c.validite || '—')))),
    h('p', { class: 'muet' }, 'Le client voit seulement le prénom, l’initiale du nom, la qualification, les 4 derniers caractères de la carte pro et sa validité.'),
    h('a', { class: 'lien-btn', href: c.url, target: '_blank', rel: 'noopener' }, icone('externe'), 'Ouvrir la page de vérification'));
}

export async function pageBadges(ctx) {
  ctx.titre('Cartes d’agent');
  const d = await api('mod.badge.liste');
  if (!ctx.actuel()) return;
  const recharger = () => pageBadges(ctx);
  const voir = async (a) => {
    try { const { carte } = await api('mod.badge.carte', undefined, { id: a.id }); modale({ titre: `Carte de ${a.nom}`, contenu: apercu(carte), actions: [{ libelle: 'Fermer', classe: 'btn--ghost', valeur: false }] }); recharger(); } catch (e) { erreur(e); }
  };
  const renouveler = async (a) => {
    if (!(await confirmer(`Créer un nouveau QR code pour ${a.nom} ? L’ancien ne marchera plus (téléphone perdu, agent parti…).`, { ok: 'Nouveau QR' }))) return;
    try { await api('mod.badge.renouveler', { agent_id: a.id }); toast('Nouveau QR code créé : l’agent le voit dans son Espace équipe.'); recharger(); } catch (e) { erreur(e); }
  };
  const n = (k) => d.agents.filter((a) => a.etat === k).length;
  ctx.afficher(h('div', { class: 'tr bg' },
    h('p', { class: 'pf-aide' }, 'Chaque agent montre sa carte depuis son Espace équipe (page « Ma carte d’agent »). Le client scanne le QR code : la page de vérification confirme en direct qu’il travaille pour BDA Security Group, avec l’état de sa carte professionnelle.'),
    h('section', { class: 'vg-kpis bg-kpis' },
      h('div', { class: 'vg-kpi' }, h('span', { class: 'vg-kpi__lib' }, 'Cartes valides'), h('b', { class: 'vg-kpi__val' }, `${n('valide')}/${d.agents.length}`), h('span', { class: 'vg-kpi__sous' }, 'agents actifs')),
      h('div', { class: `vg-kpi ${n('expiree') ? 'is-alerte' : ''}` }, h('span', { class: 'vg-kpi__lib' }, 'Expirées'), h('b', { class: 'vg-kpi__val' }, String(n('expiree'))), h('span', { class: 'vg-kpi__sous' }, 'la page de vérification le dit')),
      h('div', { class: 'vg-kpi' }, h('span', { class: 'vg-kpi__lib' }, 'À renseigner'), h('b', { class: 'vg-kpi__val' }, String(n('a_verifier'))), h('span', { class: 'vg-kpi__sous' }, 'date de carte pro manquante')),
      h('div', { class: 'vg-kpi' }, h('span', { class: 'vg-kpi__lib' }, 'Vérifications'), h('b', { class: 'vg-kpi__val' }, String(d.agents.reduce((s, a) => s + a.verifications, 0))), h('span', { class: 'vg-kpi__sous' }, 'QR codes scannés'))),
    h('section', { class: 'carte' },
      h('div', { class: 'tableau' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Agent'), h('th', null, 'Carte pro'), h('th', null, 'État'), h('th', null, 'Vérifications'), h('th', null, ''))),
        h('tbody', null, d.agents.map((a) => {
          const [lib, ton] = ETATS[a.etat] || ETATS.a_verifier;
          return h('tr', null,
            h('td', null, h('b', null, a.nom), h('small', { class: 'muet mx-bloc' }, a.qualification)),
            h('td', { class: 'mx-num' }, a.carte || h('span', { class: 'muet' }, 'non renseignée'), a.validite ? h('small', { class: 'muet mx-bloc' }, `jusqu’au ${a.validite}`) : null),
            h('td', null, h('span', { class: `pastille pastille--${ton}` }, lib)),
            h('td', null, a.verifications ? [String(a.verifications), h('small', { class: 'muet mx-bloc' }, `dernière ${ilYa(a.derniere)}`)] : h('span', { class: 'muet' }, '—')),
            h('td', { class: 'mx-droite tr-actions' },
              h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => voir(a) }, 'Voir la carte'),
              a.qr ? h('button', { class: 'icon-btn', type: 'button', title: 'Nouveau QR code', 'aria-label': 'Nouveau QR code', onclick: () => renouveler(a) }, icone('activite')) : null));
        })))))));
}
