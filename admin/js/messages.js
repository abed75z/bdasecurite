/* =========================================================
   ESPACE ADMIN BDA — Messages des clients (espace client)
   Conversations à gauche, échange à droite, réponse en bas.
   Chaque message client arrive aussi sur bdasecurite@gmail.com ;
   chaque réponse prévient le client par email.
   ========================================================= */
import { api, apiFichier, h, icone, toast, erreur, ilYa, dateLisible } from './outils.js';

export async function pageMessages(ctx) {
  ctx.titre('Messages clients');
  const { conversations, clients } = await api('messages.clients');
  const choisi = +ctx.params[0] || conversations[0]?.id || 0;

  const liste = h('ul', { class: 'conv-liste' },
    conversations.map((c) => h('li', null, h('a', { href: `#/messages/${c.id}`, class: `conv ${c.id === choisi ? 'is-actif' : ''}` },
      h('span', { class: 'conv__avatar', 'aria-hidden': 'true' }, (c.nom || '?').charAt(0)),
      h('span', { class: 'conv__txt' }, h('b', null, c.nom), h('small', null, `${c.auteur === 'admin' ? 'Vous : ' : ''}${c.texte.slice(0, 70)}`)),
      h('span', { class: 'conv__meta' }, h('small', null, ilYa(c.cree)), +c.non_lus && c.id !== choisi ? h('i', { class: 'conv__badge' }, c.non_lus) : null)))));
  const sansConv = clients.filter((c) => !conversations.some((x) => x.id === c.id));
  const nouveau = sansConv.length ? h('select', { class: 'input', onchange: (e) => { if (e.target.value) ctx.aller(`#/messages/${e.target.value}`); } },
    h('option', { value: '' }, 'Écrire à un client…'), sansConv.map((c) => h('option', { value: c.id }, c.nom))) : null;

  const colonneG = h('aside', { class: 'conv-col' }, nouveau,
    conversations.length ? liste : h('p', { class: 'astuce' }, 'Aucun message pour le moment. Les messages envoyés par vos clients depuis leur espace client arriveront ici (et sur bdasecurite@gmail.com).'));

  const colonneD = h('section', { class: 'fil' });
  if (choisi) await afficherFil(choisi);
  else colonneD.append(h('div', { class: 'vide' }, icone('mail'), h('p', null, 'Choisissez une conversation.')));

  async function afficherFil(id) {
    // messages du cœur + pièces jointes et demandes guidées de l'espace client (module « portail »)
    const [{ client }, { messages, statuts }] = await Promise.all([api('messages.client', undefined, { client: id }), api('mod.portail.fil', undefined, { client_id: id })]);
    ctx.compteurs();
    const piece = (p) => h('a', { class: 'pt-piece', href: `api.php?a=mod.portail.piece&id=${p.id}`, target: '_blank', rel: 'noopener' }, p.image ? h('img', { src: `api.php?a=mod.portail.piece&id=${p.id}`, alt: p.nom, loading: 'lazy' }) : [icone('dossier'), p.nom]);
    const demande = (m) => {
      if (!m.demande) return null;
      const choix = h('select', { class: 'input input--auto', 'aria-label': 'Avancement de la demande', onchange: async (e) => {
        try { await api('mod.portail.demande.statut', { message_id: m.id, statut: e.target.value }); toast('Avancement mis à jour : le client le voit dans son espace.'); ctx.compteurs(); } catch (err) { erreur(err); }
      } }, Object.entries(statuts).map(([k, lib]) => h('option', { value: k, selected: k === m.demande.statut }, lib)));
      return h('div', { class: 'pt-demande' }, m.demande.libelle, choix);
    };
    const fil = h('div', { class: 'fil__messages' }, messages.length
      ? messages.map((m) => h('div', { class: `bulle bulle--${m.auteur}` }, demande(m), h('p', null, m.texte), m.pieces.map(piece), h('small', null, `${m.auteur === 'admin' ? 'Vous' : client?.nom || 'Client'} · ${dateLisible(m.cree, true)}`)))
      : h('p', { class: 'astuce' }, 'Aucun message. Écrivez le premier : le client sera prévenu par un court email, sans le contenu.'));
    const zone = h('textarea', { class: 'input fil__saisie', rows: 3, placeholder: 'Votre réponse… (Ctrl + Entrée pour envoyer)' });
    const fichier = h('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png,image/webp', hidden: true });
    const joint = h('span', { class: 'pt-joint' });
    fichier.onchange = () => { joint.textContent = fichier.files[0] ? fichier.files[0].name : ''; };
    const envoyer = async () => {
      const texte = zone.value.trim();
      if (!texte && !fichier.files[0]) return zone.focus();
      const f = new FormData();
      f.append('client_id', id);
      f.append('texte', texte);
      if (fichier.files[0]) f.append('piece', fichier.files[0]);
      try { await apiFichier('mod.portail.repondre', f); toast('Réponse envoyée : le client est prévenu, le message se lit dans son espace.'); pageMessages(ctx); }
      catch (e) { erreur(e); }
    };
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); envoyer(); } });
    colonneD.replaceChildren(
      h('header', { class: 'fil__tete' }, h('div', null, h('b', null, client?.nom || 'Client'), h('small', null, [client?.email, client?.tel].filter(Boolean).join(' · '))),
        h('a', { class: 'btn btn--ghost btn--petit', href: `#/portail/${id}` }, icone('clients'), 'Son espace'),
        client?.tel ? h('a', { class: 'btn btn--ghost btn--petit', href: `tel:${client.tel.replace(/\s/g, '')}` }, icone('telephone'), 'Appeler') : null),
      fil,
      h('div', { class: 'fil__envoi' }, zone,
        h('label', { class: 'btn btn--ghost pt-joindre', title: 'Joindre un PDF ou une photo' }, icone('dossier'), fichier, 'Joindre', joint),
        h('button', { class: 'btn btn--gold', type: 'button', onclick: envoyer }, icone('envoyer'), 'Envoyer')));
    requestAnimationFrame(() => { fil.scrollTop = fil.scrollHeight; });
  }

  ctx.afficher(h('div', { class: 'messagerie' }, colonneG, colonneD));
}
