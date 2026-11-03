/* =========================================================
   ESPACE ADMIN BDA — Appli « BDA Équipe » (module « mobile »)
   #/bda-equipe                 messages avec les agents (liste + conversation)
   #/bda-equipe/<agentId>       conversation avec un agent
   #/bda-equipe/notifications   envoyer une notification, envois automatiques, historique
   #/bda-equipe/telephones      clé Apple, iPhone reliés, installation
   ========================================================= */
import { api, apiFichier, h, icone, toast, erreur, confirmer, champ, ilYa, dateLisible, iso } from '../outils.js';

const ONGLETS = [['', 'Messages'], ['notifications', 'Notifications'], ['telephones', 'Téléphones']];
const TYPES = { planning: 'Planning', bourse: 'Postes à prendre', consignes: 'Consignes', message: 'Message', direction: 'Annonce', presence: 'Tout va bien ?', info: 'Info' };
const AUTO = [['planning', 'Nouveau poste au planning', 'Dès qu’un poste lui est attribué.'],
  ['bourse', 'Postes à prendre', 'Quand des postes sont proposés à la bourse.'],
  ['consignes', 'Nouvelles consignes', 'Aux agents prévus sur le site quand ses consignes changent.']];
const hm = (s) => (s && s.length >= 16 ? s.slice(11, 16).replace(':', 'h') : '');
// aujourd'hui : l'heure ; avant : la date
const quand = (s) => (s && s.slice(0, 10) === iso(new Date()) ? hm(s) : dateLisible(s));
const jourLisible = (s) => (s.slice(0, 10) === iso(new Date()) ? 'Aujourd’hui' : new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(s.replace(' ', 'T'))));
const photo = (id) => `api.php?a=mod.mobile.photo&id=${id}`;

export async function pageBdaEquipe(ctx) {
  const vue = ctx.params[0] || '';
  ctx.titre('Appli BDA Équipe');
  const onglet = ['notifications', 'telephones'].includes(vue) ? vue : '';
  const barre = h('nav', { class: 'mx-onglets' }, ONGLETS.map(([k, lib]) => h('a', { class: `mx-onglet ${k === onglet ? 'is-actif' : ''}`, href: `#/bda-equipe${k ? `/${k}` : ''}` }, lib)));
  if (onglet === 'notifications') return vueNotifications(ctx, barre);
  if (onglet === 'telephones') return vueTelephones(ctx, barre);
  return vueMessages(ctx, barre, /^\d+$/.test(vue) ? Number(vue) : 0);
}

/* ---------- Messages ---------- */
async function vueMessages(ctx, barre, agentId) {
  const [liste, fil] = await Promise.all([api('mod.mobile.conversations'), agentId ? api('mod.mobile.conversation', undefined, { agent_id: agentId }) : null]);
  if (!ctx.actuel()) return;
  if (agentId) ctx.compteurs?.();

  const ul = h('ul', { class: 'be-convs' });
  const dessinerListe = (l) => ul.replaceChildren(...(l.conversations.length ? l.conversations.map((c) => h('li', null,
    h('a', { class: `be-conv ${c.agent_id === agentId ? 'is-actif' : ''} ${c.nonLus ? 'is-nonlu' : ''}`, href: `#/bda-equipe/${c.agent_id}` },
      h('span', { class: 'be-conv__haut' }, h('b', null, c.nom), h('small', null, c.dernier ? quand(c.dernier.cree) : '')),
      h('span', { class: 'be-conv__bas' }, h('span', null, c.dernier ? `${c.dernier.auteur === 'direction' ? 'Vous : ' : ''}${c.dernier.texte || (c.dernier.photo ? 'Photo' : '')}` : ''),
        c.nonLus ? h('i', { class: 'be-pastille', 'aria-label': `${c.nonLus} non lu${c.nonLus > 1 ? 's' : ''}` }, c.nonLus) : null))))
    : [h('li', { class: 'mx-vide' }, h('b', null, 'Aucun message'), h('p', null, 'Les messages des agents envoyés depuis l’appli arrivent ici.'))]));
  dessinerListe(liste);

  const choix = h('select', { class: 'input', 'aria-label': 'Écrire à un agent', onchange: (e) => { if (e.target.value) location.hash = `#/bda-equipe/${e.target.value}`; } },
    h('option', { value: '' }, 'Écrire à un agent…'),
    liste.agents.map((a) => h('option', { value: a.id }, `${a.nom}${a.appli ? '' : ' (sans l’appli)'}`)));
  const aside = h('aside', { class: 'be-liste' }, h('div', { class: 'be-liste__tete' }, choix), ul);

  let section;
  if (!fil) {
    section = h('section', { class: 'be-fil be-fil--vide' }, h('div', { class: 'mx-vide' }, icone('message'), h('b', null, 'Choisissez une conversation'), h('p', null, 'Ou écrivez à un agent avec la liste ci-contre. Il reçoit une notification sur son iPhone.')));
  } else {
    const a = fil.agent;
    const bulles = h('div', { class: 'be-bulles', role: 'log', 'aria-live': 'polite' });
    const dessinerFil = (messages) => {
      let jour = '';
      const n = [];
      for (const m of messages) {
        const j = m.cree.slice(0, 10);
        if (j !== jour) { jour = j; n.push(h('p', { class: 'be-jour' }, jourLisible(m.cree))); }
        n.push(h('div', { class: `be-bulle be-bulle--${m.auteur}` },
          m.photo ? h('a', { href: photo(m.id), target: '_blank', rel: 'noopener' }, h('img', { class: 'be-photo', src: photo(m.id), alt: 'Photo jointe', loading: 'lazy' })) : null,
          m.texte ? h('p', null, m.texte) : null,
          h('small', null, hm(m.cree), m.auteur === 'direction' ? ` · ${m.lu ? 'lu' : 'envoyé'}${m.par ? ` · ${m.par}` : ''}` : '')));
      }
      bulles.replaceChildren(...(n.length ? n : [h('div', { class: 'mx-vide' }, h('b', null, 'Pas encore de message'), h('p', null, `Écrivez à ${a.nom} : il recevra une notification${a.appli ? '' : ' dès qu’il aura installé l’appli'}.`))]));
      bulles.scrollTop = bulles.scrollHeight;
    };
    dessinerFil(fil.messages);

    const texte = h('textarea', { class: 'input be-saisie', rows: 2, maxlength: 2000, placeholder: `Écrire à ${a.nom}…` });
    const fichier = h('input', { type: 'file', accept: 'image/*', hidden: true });
    const apercu = h('span', { class: 'be-fichier' });
    fichier.onchange = () => { apercu.textContent = fichier.files[0] ? `Photo : ${fichier.files[0].name}` : ''; };
    const envoyer = async (e) => {
      e?.preventDefault();
      if (!texte.value.trim() && !fichier.files[0]) return;
      const f = new FormData();
      f.append('agent_id', a.id);
      f.append('texte', texte.value.trim());
      if (fichier.files[0]) f.append('photo', fichier.files[0]);
      bouton.disabled = true;
      try {
        const r = await apiFichier('mod.mobile.repondre', f);
        texte.value = ''; fichier.value = ''; apercu.textContent = '';
        toast(r.notifie ? 'Envoyé : notification reçue sur son iPhone.' : 'Envoyé : il le verra en ouvrant son Espace équipe.');
        const n = await api('mod.mobile.conversation', undefined, { agent_id: a.id });
        if (ctx.actuel()) dessinerFil(n.messages);
      } catch (err) { erreur(err); } finally { bouton.disabled = false; texte.focus(); }
    };
    texte.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) envoyer(e); });
    const bouton = h('button', { class: 'btn btn--gold', type: 'submit' }, 'Envoyer');
    section = h('section', { class: 'be-fil' },
      h('header', { class: 'be-fil__tete' },
        h('a', { class: 'be-retour', href: '#/bda-equipe', 'aria-label': 'Retour aux conversations' }, icone('retour')),
        h('div', null, h('b', null, a.nom), h('small', { class: 'muet' }, [a.poste, a.appli ? 'appli installée' : 'pas encore l’appli'].filter(Boolean).join(' · '))),
        a.tel ? h('a', { class: 'btn btn--ghost btn--petit', href: `tel:${a.tel.replace(/\s/g, '')}` }, icone('telephone'), h('span', null, 'Appeler')) : null),
      bulles,
      h('form', { class: 'be-compose', onsubmit: envoyer },
        h('label', { class: 'btn btn--ghost btn--icone', title: 'Joindre une photo' }, icone('photo'), fichier),
        h('div', { class: 'be-compose__champ' }, texte, apercu), bouton));

    // nouveaux messages : la conversation se met à jour toute seule
    const minuteur = setInterval(async () => {
      if (!ctx.actuel()) { clearInterval(minuteur); return; }
      try {
        const [n, l] = await Promise.all([api('mod.mobile.conversation', undefined, { agent_id: a.id }), api('mod.mobile.conversations')]);
        if (!ctx.actuel()) return;
        if (n.messages.length !== bulles.querySelectorAll('.be-bulle').length || n.messages.at(-1)?.lu !== fil.messages.at(-1)?.lu) { fil.messages = n.messages; dessinerFil(n.messages); }
        dessinerListe(l);
      } catch (e) { /* hors ligne : on réessaie au prochain tour */ }
    }, 20000);
  }

  ctx.afficher(h('div', { class: 'tr be' }, barre, h('div', { class: `be-messagerie ${fil ? 'avec-fil' : ''}` }, aside, section)));
}

/* ---------- Notifications ---------- */
async function vueNotifications(ctx, barre) {
  const d = await api('mod.mobile.etat');
  if (!ctx.actuel()) return;
  const recharger = () => vueNotifications(ctx, barre);
  const nb = d.agents.length;

  const dest = h('select', { class: 'input' }, h('option', { value: 0 }, `Tous les agents qui ont l’appli (${nb})`), d.agents.map((a) => h('option', { value: a.agent_id }, a.nom)));
  const titre = h('input', { class: 'input', type: 'text', maxlength: 60, placeholder: 'Ex. Réunion d’équipe' });
  const texte = h('textarea', { class: 'input', rows: 3, maxlength: 200, placeholder: 'Ex. Vendredi à 18h au bureau, présence obligatoire.' });
  const envoyer = async () => {
    if (!titre.value.trim() || !texte.value.trim()) { toast('Écrivez un titre et un message.', 'erreur'); return; }
    const qui = Number(dest.value) ? dest.selectedOptions[0].textContent : `${nb} agent${nb > 1 ? 's' : ''}`;
    if (!(await confirmer(`Envoyer « ${titre.value.trim()} » à ${qui} ? La notification arrive tout de suite sur l’iPhone.`, { ok: 'Envoyer' }))) return;
    try { const r = await api('mod.mobile.envoyer', { titre: titre.value, texte: texte.value, agent_id: Number(dest.value) }); toast(`Envoyé à ${r.agents} agent${r.agents > 1 ? 's' : ''} (${r.appareils} iPhone).`); recharger(); } catch (e) { erreur(e); }
  };
  const nouvelle = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Envoyer une notification')),
    nb ? [champ('À', dest), champ('Titre', titre), champ('Message', texte),
      h('div', { class: 'tr-pied' }, h('small', { class: 'muet' }, 'Pour une conversation, utilisez plutôt Messages.'), h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: envoyer }, 'Envoyer'))]
      : h('div', { class: 'mx-vide' }, h('b', null, 'Personne n’a encore l’appli'), h('p', null, 'Les notifications partiront dès que les agents auront installé BDA Équipe sur leur iPhone.')));

  const cases = AUTO.map(([k, lib, aide]) => {
    const c = h('input', { type: 'checkbox', checked: d.reglages[k], dataset: { cle: k } });
    return h('label', { class: 'case be-auto' }, c, h('span', null, h('b', null, lib), h('small', { class: 'muet mx-bloc' }, aide)));
  });
  const auto = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Envois automatiques')),
    cases,
    h('p', { class: 'muet be-note' }, 'Les questions « Tout va bien ? » des agents de nuit se règlent dans ', h('a', { href: '#/presence' }, 'leur page'), '.'),
    h('div', { class: 'tr-pied' }, h('span'), h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => {
      const corps = Object.fromEntries(cases.map((l) => { const c = l.querySelector('input'); return [c.dataset.cle, c.checked]; }));
      try { await api('mod.mobile.reglages.enregistrer', corps); toast('Envois automatiques enregistrés.'); } catch (e) { erreur(e); }
    } }, 'Enregistrer')));

  const histo = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Derniers envois')),
    d.envois.length ? h('div', { class: 'tableau' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Quand'), h('th', null, 'Agent'), h('th', null, 'Notification'), h('th', { class: 'mx-droite' }, 'iPhone'))),
      h('tbody', null, d.envois.map((e) => h('tr', null,
        h('td', { class: 'mx-num' }, dateLisible(e.quand, true)),
        h('td', null, e.nom || 'Agent'),
        h('td', null, h('b', null, e.titre), h('small', { class: 'muet mx-bloc' }, `${TYPES[e.type] || e.type}${e.par ? ` · ${e.par}` : ''}`)),
        h('td', { class: 'mx-droite' }, Number(e.appareils) ? String(e.appareils) : h('span', { class: 'muet' }, 'non reçu')))))))
      : h('p', { class: 'muet' }, 'Aucune notification envoyée pour l’instant.'));

  ctx.afficher(h('div', { class: 'tr be' }, barre, h('div', { class: 'tr-colonnes' }, h('div', { class: 'tr-col' }, nouvelle, histo), h('div', { class: 'tr-col' }, auto))));
}

/* ---------- Téléphones ---------- */
async function vueTelephones(ctx, barre) {
  const d = await api('mod.mobile.etat');
  if (!ctx.actuel()) return;
  const ligne = (lib, ok, txt) => h('li', null, h('span', null, lib), h('span', { class: ok ? 'tv-ok' : 'mx-rouge' }, ok ? icone('coche') : null, txt));

  const kid = h('input', { class: 'input', type: 'text', maxlength: 10, placeholder: 'Ex. AB12CD34EF', autocomplete: 'off', spellcheck: 'false' });
  const p8 = h('textarea', { class: 'input be-p8', rows: 5, placeholder: '-----BEGIN PRIVATE KEY-----', autocomplete: 'off', spellcheck: 'false' });
  const cle = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Notifications Apple'), h('span', { class: `pastille pastille--${d.configure ? 'payee' : 'attente'}` }, d.configure ? 'Prêtes' : 'À configurer')),
    h('ul', { class: 'tv-equipe' },
      ligne('Clé Apple (.p8)', d.configure, d.configure ? `enregistrée · ${d.cleId}` : 'pas encore collée'),
      ligne('Envoi depuis le serveur', d.http2, d.http2 ? 'compatible' : 'HTTP/2 indisponible')),
    d.admin ? h('details', { class: 'be-cle', open: !d.configure },
      h('summary', null, d.configure ? 'Remplacer la clé' : 'Coller la clé'),
      h('p', { class: 'muet be-note' }, 'Sur developer.apple.com → Certificates, IDs & Profiles → Keys : créez une clé avec « Apple Push Notifications service », téléchargez le fichier .p8, ouvrez-le avec le Bloc-notes et collez tout ici. Elle est rangée dans le fichier privé du serveur, jamais affichée.'),
      champ('Key ID', kid), champ('Contenu du fichier .p8', p8),
      h('div', { class: 'tr-pied' }, h('span'), h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: async () => {
        try { await api('mod.mobile.cle.enregistrer', { key_id: kid.value, p8: p8.value }); p8.value = ''; toast('Clé Apple enregistrée : les notifications sont prêtes.'); vueTelephones(ctx, barre); } catch (e) { erreur(e); }
      } }, 'Enregistrer la clé')))
      : h('p', { class: 'muet be-note' }, 'Seul l’administrateur peut coller la clé Apple.'));

  const relies = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'iPhone reliés'), h('small', null, `${d.agents.length} agent${d.agents.length > 1 ? 's' : ''} sur ${d.comptes}`)),
    d.agents.length ? h('ul', { class: 'tv-equipe' }, d.agents.map((a) => h('li', null,
      h('span', null, h('b', null, a.nom), h('small', { class: 'muet' }, `relié ${ilYa(a.cree)}`)),
      h('span', { class: 'muet' }, `${a.appareils} iPhone${a.vu ? ` · dernière notification ${ilYa(a.vu)}` : ''}`))))
      : h('p', { class: 'muet' }, 'Aucun iPhone relié pour l’instant.'));

  const installer = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Installer l’appli')),
    h('ol', { class: 'be-etapes' },
      h('li', null, 'Envoyez à l’agent le lien de BDA Équipe : l’appli n’apparaît pas dans la recherche de l’App Store.'),
      h('li', null, 'Il se connecte avec son identifiant de l’Espace équipe.'),
      h('li', null, 'Il accepte les notifications : son iPhone apparaît dans la liste ci-contre.')));

  ctx.afficher(h('div', { class: 'tr be' }, barre, h('div', { class: 'tr-colonnes' }, h('div', { class: 'tr-col' }, relies, installer), h('div', { class: 'tr-col' }, cle))));
}
