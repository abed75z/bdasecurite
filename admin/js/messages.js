/* =========================================================
   ESPACE ADMIN BDA — Messages des clients (espace client)
   Conversations à gauche, échange à droite, réponse en bas.
   Chaque message client arrive aussi sur bdasecurite@gmail.com ;
   chaque réponse prévient le client par email.
   ========================================================= */
import { api, h, icone, toast, erreur, ilYa, dateLisible } from './outils.js';

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
    const { client, messages } = await api('messages.client', undefined, { client: id });
    ctx.compteurs();
    const fil = h('div', { class: 'fil__messages' }, messages.length
      ? messages.map((m) => h('div', { class: `bulle bulle--${m.auteur}` }, h('p', null, m.texte), h('small', null, `${m.auteur === 'admin' ? 'Vous' : client?.nom || 'Client'} · ${dateLisible(m.cree, true)}`)))
      : h('p', { class: 'astuce' }, 'Aucun message. Écrivez le premier : le client sera prévenu par email.'));
    const zone = h('textarea', { class: 'input fil__saisie', rows: 3, placeholder: 'Votre réponse… (Ctrl + Entrée pour envoyer)' });
    const envoyer = async () => {
      const texte = zone.value.trim();
      if (!texte) return zone.focus();
      try { await api('message.repondre', { client: id, texte }); toast('Réponse envoyée : le client est prévenu par email.'); pageMessages(ctx); }
      catch (e) { erreur(e); }
    };
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); envoyer(); } });
    colonneD.replaceChildren(
      h('header', { class: 'fil__tete' }, h('div', null, h('b', null, client?.nom || 'Client'), h('small', null, [client?.email, client?.tel].filter(Boolean).join(' · '))),
        client?.tel ? h('a', { class: 'btn btn--ghost btn--petit', href: `tel:${client.tel.replace(/\s/g, '')}` }, icone('telephone'), 'Appeler') : null),
      fil,
      h('div', { class: 'fil__envoi' }, zone, h('button', { class: 'btn btn--gold', type: 'button', onclick: envoyer }, icone('envoyer'), 'Envoyer')));
    requestAnimationFrame(() => { fil.scrollTop = fil.scrollHeight; });
  }

  ctx.afficher(h('div', { class: 'messagerie' }, colonneG, colonneD));
}
