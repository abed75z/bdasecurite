/* =========================================================
   ESPACE ADMIN BDA — Assistance (discussions du site)
   Les visiteurs parlent d'abord au robot ; quand ils demandent
   un conseiller (ou que le robot ne sait pas), la discussion
   arrive ici : vous répondez, la réponse s'affiche chez eux.
   Réglage de l'intelligence artificielle (clé API Claude).
   ========================================================= */
import { api, h, icone, toast, erreur, confirmer, champ, ilYa, dateLisible } from './outils.js';

const STATUTS = {
  attente: ['En attente', 'retard'], equipe: ['Conseiller', 'en_cours'], robot: ['Robot', 'brouillon'], close: ['Close', 'annulee'],
};
const AUTEURS = { visiteur: 'Visiteur', robot: 'Assistant', equipe: 'BDA' };
let minuteur = null;

export async function pageAssistance(ctx) {
  ctx.titre('Assistance');
  clearInterval(minuteur);
  const idOuvert = +(ctx.params[0] || 0);
  let filtre = 'tout';
  const liste = h('div', { class: 'as-liste' });
  const vue = h('div', { class: 'as-vue' });

  async function chargerListe() {
    const { conversations } = await api('assist.liste', undefined, { filtre });
    if (!ctx.actuel()) return;
    const filtres = h('div', { class: 'chips' }, [['tout', 'Toutes'], ['equipe', 'À traiter'], ['attente', 'En attente']].map(([k, l]) => h('button', { type: 'button', class: `chip ${k === filtre ? 'is-actif' : ''}`, onclick: () => { filtre = k; chargerListe(); } }, l)));
    liste.replaceChildren(filtres, conversations.length ? h('ul', null, conversations.map((c) => {
      const [lib, cls] = STATUTS[c.statut] || STATUTS.robot;
      return h('li', null, h('a', { href: `#/assistance/${c.id}`, class: `as-item ${+c.id === idOuvert ? 'is-actif' : ''} ${+c.non_lu ? 'is-non-lu' : ''}` },
        h('div', { class: 'as-item__haut' }, h('b', null, c.nom || `Visiteur n° ${c.id}`), h('small', null, ilYa(c.maj))),
        h('p', null, c.dernier || ''),
        h('div', { class: 'as-item__bas' }, h('span', { class: `pastille pastille--${cls}` }, lib), +c.non_lu ? h('span', { class: 'as-badge' }, c.non_lu) : null, h('small', { class: 'muet' }, `${c.nb} message${c.nb > 1 ? 's' : ''}`))));
    })) : h('div', { class: 'vide vide--petit' }, icone('mail'), h('p', null, 'Aucune discussion pour le moment. Elles apparaîtront ici dès qu’un visiteur écrira à l’assistant.')));
  }

  async function chargerVue() {
    if (!idOuvert) {
      vue.replaceChildren(h('div', { class: 'vide' }, icone('mail'), h('p', null, 'Choisissez une discussion à gauche. Celles « En attente » attendent la réponse d’un conseiller.')));
      return;
    }
    let d;
    try { d = await api('assist.conv', undefined, { id: idOuvert }); } catch (e) { vue.replaceChildren(h('div', { class: 'vide' }, h('p', null, e.message))); return; }
    if (!ctx.actuel()) return;
    const c = d.conversation;
    const [lib, cls] = STATUTS[c.statut] || STATUTS.robot;
    const fil = h('div', { class: 'as-fil' }, d.messages.map((m) => h('div', { class: `as-msg as-msg--${m.auteur}` },
      h('small', null, `${AUTEURS[m.auteur]}${+m.ia ? ' (IA)' : ''} · ${dateLisible(m.cree, true)}`), h('p', null, m.texte))));
    const zone = h('textarea', { class: 'input', rows: 3, placeholder: 'Votre réponse au visiteur…', maxlength: 2000 });
    const envoyer = async () => {
      const texte = zone.value.trim();
      if (!texte) return zone.focus();
      try { await api('assist.repondre', { id: c.id, texte }); zone.value = ''; toast('Réponse envoyée : elle s’affiche chez le visiteur.'); await rafraichir(); } catch (e) { erreur(e); }
    };
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) envoyer(); });
    const statut = (s, msg) => async () => { try { await api('assist.statut', { id: c.id, statut: s }); toast(msg); await rafraichir(); } catch (e) { erreur(e); } };
    const contactLien = /@/.test(c.contact) ? `mailto:${c.contact}` : `tel:${c.contact.replace(/[^\d+]/g, '')}`;
    vue.replaceChildren(
      h('header', { class: 'as-vue__tete' },
        h('div', null, h('b', null, c.nom || `Visiteur n° ${c.id}`), h('small', null, [c.contact ? h('a', { href: contactLien }, c.contact) : 'Pas encore de coordonnées', ` · arrivé sur ${c.page || '/'} · ${dateLisible(c.cree, true)}`])),
        h('span', { class: `pastille pastille--${cls}` }, lib)),
      fil,
      h('div', { class: 'as-repondre' }, zone,
        h('div', { class: 'as-repondre__actions' },
          h('button', { class: 'btn btn--gold', type: 'button', onclick: envoyer }, icone('envoyer'), 'Envoyer'),
          c.statut !== 'robot' ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: statut('robot', 'Le robot reprend la discussion.') }, 'Rendre au robot') : h('button', { class: 'btn btn--ghost', type: 'button', onclick: statut('equipe', 'Vous avez pris la main : le robot ne répond plus.') }, 'Prendre la main'),
          c.statut !== 'close' ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: statut('close', 'Discussion close.') }, 'Clore') : null,
          h('button', { class: 'icon-btn', type: 'button', title: 'Supprimer', 'aria-label': 'Supprimer la discussion', onclick: async () => {
            if (!(await confirmer('Supprimer définitivement cette discussion ?', { ok: 'Supprimer', danger: true }))) return;
            try { await api('assist.supprimer', { id: c.id }); toast('Discussion supprimée.'); ctx.aller('#/assistance'); } catch (e) { erreur(e); }
          } }, icone('poubelle'))),
        h('small', { class: 'muet' }, 'Ctrl + Entrée pour envoyer. Dès que vous répondez, le robot s’arrête dans cette discussion.')));
    fil.scrollTop = fil.scrollHeight;
  }

  async function rafraichir() { await Promise.all([chargerListe(), chargerVue()]); ctx.compteurs(); }

  /* ---------- Intelligence artificielle ---------- */
  const zoneIa = h('section', { class: 'carte' });
  async function dessinerIa() {
    let ia;
    try { ia = await api('ia'); } catch (e) {
      zoneIa.replaceChildren(h('header', { class: 'carte__tete' }, h('h2', null, 'Intelligence artificielle')), h('p', { class: 'astuce' }, e.statut === 403 ? 'Réservé à l’administrateur.' : e.message));
      return;
    }
    const cle = h('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: ia.cle ? `Clé enregistrée : ${ia.cle}` : 'sk-ant-…' });
    const actif = h('input', { type: 'checkbox', role: 'switch', checked: ia.actif, 'aria-label': 'Activer l’intelligence artificielle' });
    const resultat = h('p', { class: 'astuce' });
    zoneIa.replaceChildren(
      h('header', { class: 'carte__tete' }, h('h2', null, 'Intelligence artificielle'), h('small', null, ia.actif ? 'Activée : Claude répond aux visiteurs' : 'Désactivée : l’assistant intégré répond')),
      h('p', { class: 'astuce' }, 'Sans IA, l’assistant répond aux questions courantes (prestations, tarifs, zones, contact…) et propose un conseiller pour le reste. Avec une clé API Claude, il comprend et répond à presque toutes les questions, toujours à partir de vos informations et de vos prix. Le coût est facturé par Anthropic sur votre compte, quelques centimes par discussion.'),
      h('form', { class: 'form-grille', onsubmit: async (e) => {
        e.preventDefault();
        const donnees = { actif: actif.checked };
        if (cle.value.trim()) donnees.cle = cle.value.trim();
        try { await api('ia.enregistrer', donnees); toast('Réglage enregistré.'); dessinerIa(); } catch (err) { erreur(err); }
      } },
      champ('Clé API Claude', cle, 'Créez-la sur console.anthropic.com (rubrique API Keys) puis collez-la ici. Elle reste enregistrée sur votre serveur, jamais sur le site public.'),
      h('label', { class: 'ligne-inter' }, h('span', { class: 'interrupteur' }, actif, h('span', { 'aria-hidden': 'true' })), h('span', null, 'Utiliser l’IA pour répondre aux visiteurs')),
      h('div', { class: 'as-repondre__actions' },
        h('button', { class: 'btn btn--gold', type: 'submit' }, icone('coche'), 'Enregistrer'),
        ia.cle ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: async () => {
          resultat.textContent = 'Test en cours…';
          try { const r = await api('ia.tester', {}); resultat.textContent = `Réponse de test : « ${r.reponse} »`; } catch (err) { resultat.textContent = err.message; }
        } }, 'Tester') : null),
      resultat));
  }

  ctx.actions(h('a', { class: 'btn btn--ghost', href: '/', target: '_blank', rel: 'noopener' }, icone('site'), h('span', null, 'Voir l’assistant sur le site')));
  await Promise.all([chargerListe(), chargerVue()]);
  ctx.afficher(h('section', { class: 'carte as' }, liste, vue), zoneIa);
  dessinerIa();
  minuteur = setInterval(() => { if (!document.body.contains(liste)) return clearInterval(minuteur); if (!document.hidden) rafraichir().catch(() => {}); }, 15000);
}
