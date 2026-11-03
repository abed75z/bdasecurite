/* =========================================================
   ESPACE ÉQUIPE — Ma carte d'agent (module « badge »)
   Carte BDA Security Group avec QR code : le client le scanne et voit en direct,
   sur bdasecurite.com/verifier, que l'agent travaille bien pour BDA.
   ========================================================= */
export const ICONES = {
  badge: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17c.8-1.8 2.2-2.6 4-2.6s3.2.8 4 2.6"/>',
};

const ETATS = {
  valide: ['Carte pro valide', 'ok'],
  expiree: ['Carte pro expirée', 'non'],
  a_verifier: ['Carte pro à renseigner', 'attente'],
  inactif: ['Carte désactivée', 'non'],
};

async function rendu(o) {
  const { h, api, enTete, ic } = o;
  const { carte: c } = await api('mod.badge.carte');
  const [lib, ton] = ETATS[c.etat] || ETATS.a_verifier;
  const qr = h('div', { class: 'eqbg-qr' });
  try {
    const { qrSvg } = await import('/admin/js/qr.js');
    qr.append(qrSvg(c.url));
  } catch (e) { qr.append(h('small', null, 'QR code indisponible : rechargez la page.')); }
  return h('div', { class: 'eqbg' },
    enTete('Mon équipement', 'Ma carte d’agent', 'Montrez-la au client ou au responsable du site : il scanne le QR code et vérifie en direct.'),
    h('section', { class: 'eqbg-carte' },
      h('div', { class: 'eqbg-carte__haut' }, h('img', { src: '/assets/img/marque-bda-blanc.png', alt: 'BDA Security Group' }), h('span', { class: `eq-pastille eq-pastille--${ton}` }, lib)),
      h('div', { class: 'eqbg-carte__id' },
        h('b', { class: 'eqbg-nom' }, c.prenom, h('span', null, c.nom)),
        h('span', { class: 'eqbg-quali' }, c.qualification)),
      qr,
      h('dl', { class: 'eqbg-infos' },
        h('div', null, h('dt', null, 'Carte professionnelle'), h('dd', null, c.carte || 'non renseignée')),
        h('div', null, h('dt', null, 'Valable jusqu’au'), h('dd', null, c.validite || '—')))),
    c.etat !== 'valide' ? h('p', { class: 'eqbg-alerte' }, ic('alerte'), c.etat === 'expiree' ? 'Votre carte professionnelle est expirée : envoyez la nouvelle à la direction dès que possible.' : 'Votre carte professionnelle n’est pas encore enregistrée : envoyez-la à la direction (Mes documents).') : null,
    h('p', { class: 'eqbg-aide' }, c.verifications ? `Votre carte a été vérifiée ${c.verifications} fois.` : 'Astuce : montez la luminosité de l’écran pour que le QR code se scanne du premier coup.'));
}

export const PAGES = {
  carte: { titre: 'Ma carte d’agent', icone: 'badge', rendu },
};
