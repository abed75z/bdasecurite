/* =========================================================
   ESPACE ÉQUIPE — Postes à prendre (module « planif », version 13)
   - Bourse aux postes : les postes libres que l'agent peut tenir (règles
     vérifiées par le serveur) ; le premier qui appuie sur « Je prends » l'a.
   - Échanges : céder un de ses postes à un collègue ou à toute l'équipe ;
     accepter un poste proposé par un collègue ; la direction valide.
   ========================================================= */
export const ICONES = {
  bourse: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
};

let cache = null;
const charger = async (api) => { cache = await api('mod.planif.postes'); return cache; };
const confirmerNatif = (txt) => window.confirm(txt); // même fonctionnement que le reste de l'espace équipe

function cartePoste(o, p, action) {
  const { h, ic } = o;
  return h('div', { class: 'eqb-poste' },
    h('div', { class: 'eqb-poste__quand' }, h('b', null, p.libelle), h('small', null, `${p.duree}${p.qualif !== 'ADS' ? ` · ${p.qualifLib}` : ''}`)),
    h('div', { class: 'eqb-poste__ou' }, ic('pin'), h('span', null, h('b', null, p.site || 'Site'), p.adresse ? h('a', { href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.adresse)}`, target: '_blank', rel: 'noopener' }, p.adresse) : null)),
    p.de ? h('p', { class: 'eqb-poste__de' }, `Proposé par ${p.de}${p.message ? ` : « ${p.message} »` : ''}`) : null,
    !p.possible && p.raisons?.length ? h('p', { class: 'eqb-poste__raison' }, ic('alerte'), p.raisons[0]) : null,
    action);
}

async function rendu(o) {
  const { h, api, toast, enTete, vide, recharger } = o;
  const d = await charger(api);
  const prendre = (p) => h('button', { class: 'eq-btn eq-btn--plein', type: 'button', disabled: p.possible ? null : true, onclick: async (e) => {
    if (!confirmerNatif(`Prendre le poste ${p.libelle} (${p.site}) ? Il sera ajouté à votre planning.`)) return;
    e.currentTarget.disabled = true;
    try { await api('mod.planif.prendre', { id: p.bourse }); toast('Le poste est à vous : il est dans votre planning.'); recharger(); } catch (err) { toast(err.message, true); recharger(); }
  } }, 'Je prends ce poste');
  const accepter = (p) => h('button', { class: 'eq-btn eq-btn--plein', type: 'button', disabled: p.possible ? null : true, onclick: async (e) => {
    if (!confirmerNatif(`Reprendre le poste ${p.libelle} (${p.site}) ? La direction doit encore valider l’échange.`)) return;
    e.currentTarget.disabled = true;
    try { await api('mod.planif.accepter', { id: p.echange }); toast('C’est noté : la direction va valider l’échange.'); recharger(); } catch (err) { toast(err.message, true); recharger(); }
  } }, 'J’accepte ce poste');

  // Céder un de mes postes
  const choixPoste = h('select', { class: 'eq-input' }, h('option', { value: '' }, d.mesPostes.length ? 'Choisir un de mes postes…' : 'Aucun poste à venir'), d.mesPostes.map((p) => h('option', { value: p.id }, `${p.libelle} · ${p.site}`)));
  const choixQui = h('select', { class: 'eq-input' }, h('option', { value: '0' }, 'À toute l’équipe'), d.collegues.map((c) => h('option', { value: c.id }, c.nom)));
  const message = h('input', { class: 'eq-input', type: 'text', maxlength: 300, placeholder: 'Raison (facultatif)' });
  const ceder = h('form', { class: 'eqb-ceder', onsubmit: async (e) => {
    e.preventDefault();
    if (!choixPoste.value) return toast('Choisissez le poste à céder.', true);
    try { await api('mod.planif.ceder', { vacation_id: Number(choixPoste.value), vers: Number(choixQui.value), message: message.value }); toast('Proposition envoyée à vos collègues.'); recharger(); } catch (err) { toast(err.message, true); }
  } },
  h('label', { class: 'eq-champ' }, h('span', null, 'Le poste'), choixPoste),
  h('label', { class: 'eq-champ' }, h('span', null, 'Proposer'), choixQui),
  h('label', { class: 'eq-champ' }, h('span', null, 'Message'), message),
  h('button', { class: 'eq-btn', type: 'submit', disabled: d.mesPostes.length ? null : true }, 'Proposer ce poste'));
  const STATUTS = { proposee: ['En attente d’un collègue', 'attente'], acceptee: ['Accepté, à valider par la direction', 'info'], validee: ['Échange validé', 'ok'], refusee: ['Refusé par la direction', 'non'], annulee: ['Annulé', 'neutre'] };

  return h('div', { class: 'eqb' },
    enTete('Planning', 'Postes à prendre', 'Postes libres et échanges entre collègues.'),
    h('section', { class: 'eq-carte' }, h('div', { class: 'eq-carte__tete' }, h('h2', null, 'Postes disponibles')),
      d.bourse.length ? h('div', { class: 'eqb-liste' }, d.bourse.map((p) => cartePoste(o, p, prendre(p))))
        : vide('bourse', 'Aucun poste disponible', 'Quand la direction propose un poste libre, il apparaît ici.')),
    d.pourMoi.length ? h('section', { class: 'eq-carte' }, h('div', { class: 'eq-carte__tete' }, h('h2', null, 'Proposés par vos collègues')),
      h('div', { class: 'eqb-liste' }, d.pourMoi.map((p) => cartePoste(o, p, accepter(p))))) : null,
    h('section', { class: 'eq-carte' }, h('div', { class: 'eq-carte__tete' }, h('h2', null, 'Céder un de mes postes')),
      h('p', { class: 'eqb-aide' }, 'Un empêchement ? Proposez votre poste : un collègue l’accepte, puis la direction valide. Jusqu’à la validation, le poste reste à vous.'), ceder),
    d.mesEchanges.length ? h('section', { class: 'eq-carte' }, h('div', { class: 'eq-carte__tete' }, h('h2', null, 'Mes propositions')),
      h('ul', { class: 'eqb-props' }, d.mesEchanges.map((e) => h('li', null,
        h('div', null, h('b', null, e.libelle), h('small', null, e.site), e.accepte ? h('small', null, `Accepté par ${e.accepte}`) : null),
        h('span', { class: `eq-pastille eq-pastille--${(STATUTS[e.statut] || ['', 'neutre'])[1]}` }, (STATUTS[e.statut] || [e.statut])[0]),
        ['proposee', 'acceptee'].includes(e.statut) ? h('button', { class: 'eq-btn eq-btn--ghost eq-btn--petit', type: 'button', onclick: async () => {
          if (!confirmerNatif('Retirer cette proposition ? Le poste reste à vous.')) return;
          try { await api('mod.planif.annuler', { id: e.id }); toast('Proposition retirée.'); recharger(); } catch (err) { toast(err.message, true); }
        } }, 'Retirer') : null)))) : null);
}

export const PAGES = {
  postes: { titre: 'Postes à prendre', icone: 'bourse', rendu },
};

// Carte d'accueil : seulement s'il y a des postes à prendre ou des propositions
export const CARTES = [async (o) => {
  const { h, api, ic } = o;
  const d = await charger(api);
  const n = d.bourse.filter((p) => p.possible).length + d.pourMoi.filter((p) => p.possible).length;
  if (!n) return null;
  return h('a', { class: 'eq-carte eqb-alerte', href: '#/postes' },
    h('span', { class: 'eqb-alerte__ic' }, ic('bourse')),
    h('span', null, h('b', null, `${n} poste${n > 1 ? 's' : ''} à prendre`), h('small', null, 'Libres ou proposés par un collègue')),
    ic('fleche'));
}];
