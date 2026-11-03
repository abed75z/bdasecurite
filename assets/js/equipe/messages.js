/* =========================================================
   ESPACE ÉQUIPE — Messages avec la direction (module « mobile », appli BDA Équipe)
   L'agent écrit à la direction (texte, photo) ; la direction répond depuis l'admin
   et l'agent reçoit une notification sur son iPhone.
   ========================================================= */
export const ICONES = {
  messages: '<path d="M4.5 5.5h15v10h-10l-5 4z"/>',
  photo: '<path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="3.5"/>',
  envoyer: '<path d="M12 19V5M6 11l6-6 6 6"/>',
};

const heure = (s) => (s && s.length >= 16 ? s.slice(11, 16).replace(':', 'h') : '');
const photo = (id) => `/api/equipe.php?a=mod.mobile.message.photo&id=${id}`;

async function rendu(o) {
  const { h, api, apiForm, toast, enTete, ic, iso } = o;
  const d = await api('mod.mobile.messages');
  const fil = h('div', { class: 'eqm-fil', role: 'log', 'aria-live': 'polite' });
  const jourLisible = (s) => (s.slice(0, 10) === iso(new Date()) ? 'Aujourd’hui' : new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(s.replace(' ', 'T'))));
  let nb = 0;
  const dessiner = (messages) => {
    nb = messages.length;
    let jour = '';
    const n = [];
    for (const m of messages) {
      if (m.cree.slice(0, 10) !== jour) { jour = m.cree.slice(0, 10); n.push(h('p', { class: 'eqm-jour' }, jourLisible(m.cree))); }
      n.push(h('div', { class: `eqm-bulle eqm-bulle--${m.auteur === 'agent' ? 'moi' : 'direction'}` },
        m.photo ? h('img', { src: photo(m.id), alt: 'Photo jointe', loading: 'lazy' }) : null,
        m.texte ? h('p', null, m.texte) : null,
        h('small', null, heure(m.cree), m.auteur === 'agent' && m.lu ? ' · lu' : '')));
    }
    fil.replaceChildren(...(n.length ? n : [h('div', { class: 'eqm-vide' }, ic('messages'), h('b', null, 'Écrivez à la direction'), h('p', null, 'Une question, un souci sur le site, une photo : la direction vous répond ici.'))]));
    requestAnimationFrame(() => { fil.scrollTop = fil.scrollHeight; });
  };
  dessiner(d.messages);

  const texte = h('textarea', { class: 'eqm-saisie', rows: 1, maxlength: 2000, placeholder: 'Écrire à la direction', 'aria-label': 'Message' });
  texte.addEventListener('input', () => { texte.style.height = 'auto'; texte.style.height = `${Math.min(texte.scrollHeight, 140)}px`; });
  const fichier = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const choisie = h('span', { class: 'eqm-choisie' });
  fichier.onchange = () => { choisie.textContent = fichier.files[0] ? 'Photo prête à envoyer' : ''; };
  const bouton = h('button', { class: 'eqm-envoyer', type: 'submit', 'aria-label': 'Envoyer' }, ic('envoyer'));
  const envoyer = async (e) => {
    e.preventDefault();
    if (!texte.value.trim() && !fichier.files[0]) return;
    const f = new FormData();
    f.append('texte', texte.value.trim());
    if (fichier.files[0]) f.append('photo', fichier.files[0]);
    bouton.disabled = true;
    try {
      await apiForm('mod.mobile.message.envoyer', f);
      texte.value = ''; texte.style.height = ''; fichier.value = ''; choisie.textContent = '';
      dessiner((await api('mod.mobile.messages')).messages);
    } catch (err) { toast(err.message, true); } finally { bouton.disabled = false; }
  };
  const formulaire = h('form', { class: 'eqm-compose', onsubmit: envoyer },
    h('label', { class: 'eqm-photo', 'aria-label': 'Joindre une photo' }, ic('photo'), fichier),
    h('div', { class: 'eqm-champ' }, texte, choisie), bouton);

  const page = h('div', { class: 'eqm' }, enTete('Direction', 'Messages', null), fil, formulaire);
  // la conversation se met à jour toute seule tant que la page est ouverte
  const minuteur = setInterval(async () => {
    if (!page.isConnected) { clearInterval(minuteur); return; }
    if (document.hidden) return;
    try { const n = await api('mod.mobile.messages'); if (n.messages.length !== nb) dessiner(n.messages); } catch (e) { /* hors ligne */ }
  }, 20000);
  return page;
}

export const PAGES = {
  messages: { titre: 'Messages', icone: 'messages', rendu },
};

// Carte d'accueil : message de la direction pas encore lu
export const CARTES = [async (o) => {
  const { h, api, ic } = o;
  const d = await api('mod.mobile.messages.nonlus');
  if (!d.nonLus) return null;
  return h('a', { class: 'eq-carte eqm-carte', href: '#/messages' },
    h('span', { class: 'eqm-carte__ic' }, ic('messages')),
    h('span', null, h('b', null, d.nonLus > 1 ? `${d.nonLus} messages de la direction` : 'Message de la direction'), h('small', null, d.dernier)),
    ic('fleche'));
}];
