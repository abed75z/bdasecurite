/* =========================================================
   ASSISTANT DU SITE — fenêtre de discussion (toutes les pages)
   Le robot répond tout de suite ; le visiteur peut demander
   un conseiller : l'équipe BDA répond depuis l'admin et la
   réponse s'affiche ici (vérification régulière).
   ========================================================= */
(() => {
  'use strict';
  const CLE = 'bda-assistant';
  const API = '/api/assistant.php';
  const ACCUEIL = location.pathname === '/' || /\/index(\.html)?$/.test(location.pathname);
  let etat = { jeton: '', dernier: 0, statut: 'robot', ouvert: false };
  try { Object.assign(etat, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch (e) { /* stockage indisponible */ }
  const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify({ jeton: etat.jeton, dernier: etat.dernier, statut: etat.statut })); } catch (e) { /* rien */ } };

  /* ----- Petits outils ----- */
  function h(tag, attrs, ...enfants) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const e of enfants.flat()) if (e != null && e !== false) el.append(e.nodeType ? e : document.createTextNode(String(e)));
    return el;
  }
  const ic = (d, cls = 'as-ic') => h('span', { class: cls, 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24">${d}</svg>` });
  const I = {
    bulle: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-5A8 8 0 1 1 21 12z"/>',
    croix: '<path d="M18 6 6 18M6 6l12 12"/>',
    envoyer: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    tel: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    personne: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  };
  // Liens dans les réponses : pages du site, téléphones, emails
  function enrichir(texte) {
    const frag = document.createDocumentFragment();
    const PAGES = { devis: '/devis', tarifs: '/tarifs', recrutement: '/recrutement', références: '/references', avis: '/avis', réserver: '/reserver', 'espace client': '/espace-client' };
    const re = /(\b0[67](?:[ .]?\d{2}){4}\b|[\w.+-]+@[\w-]+\.[\w.]+|(?<![\w/])\/(?:devis|tarifs|recrutement|references|avis|reserver|espace-client|securite-incendie-ssiap-paris)\b|page (?:Devis|Tarifs|Recrutement|Références|Avis|Réserver|Espace client))/gu;
    let i = 0;
    for (const m of texte.matchAll(re)) {
      frag.append(texte.slice(i, m.index));
      const v = m[0];
      let href = v;
      if (/^0[67]/.test(v)) href = `tel:+33${v.replace(/\D/g, '').slice(1)}`;
      else if (v.includes('@')) href = `mailto:${v}`;
      else if (v.startsWith('page ')) href = PAGES[v.slice(5).toLowerCase()] || '/';
      frag.append(h('a', { href }, v));
      i = m.index + v.length;
    }
    frag.append(texte.slice(i));
    return frag;
  }
  async function appel(action, donnees, params = '') {
    const r = await fetch(`${API}?a=${action}${params}`, { method: donnees ? 'POST' : 'GET', headers: donnees ? { 'Content-Type': 'application/json' } : {}, body: donnees ? JSON.stringify(donnees) : undefined, cache: 'no-store' });
    let j = {};
    try { j = await r.json(); } catch (e) { /* vide */ }
    if (!r.ok || !j.ok) throw new Error(j.erreur || 'Connexion impossible. Vous pouvez nous appeler au 06 11 67 86 25.');
    return j;
  }

  /* ----- Construction ----- */
  function construire() {
    document.querySelectorAll('.wa').forEach((el) => el.remove()); // WhatsApp est dans la fenêtre
    const pastille = h('span', { class: 'as-lanceur__pastille', hidden: true });
    const lanceur = h('button', { class: 'as-lanceur', type: 'button', 'aria-label': 'Ouvrir l’assistant BDA', 'aria-expanded': 'false' }, ic(I.bulle, 'as-ic as-ic--lanceur'), ic(I.croix, 'as-ic as-ic--fermer'), h('span', { class: 'as-lanceur__texte' }, 'Une question ?'), pastille);
    const statutTxt = h('small', null, 'Répond en quelques secondes');
    const fil = h('div', { class: 'as-fil', role: 'log', 'aria-live': 'polite' });
    const champ = h('textarea', { class: 'as-champ', rows: 1, maxlength: 1000, placeholder: 'Écrivez votre question…', 'aria-label': 'Votre message' });
    const bouton = h('button', { class: 'as-envoyer', type: 'submit', 'aria-label': 'Envoyer' }, ic(I.envoyer));
    const form = h('form', { class: 'as-saisie' }, champ, bouton);
    const panneau = h('section', { class: 'as-panneau', role: 'dialog', 'aria-label': 'Assistant BDA Security Group', hidden: true },
      h('header', { class: 'as-tete' },
        h('img', { src: '/assets/img/ecusson-petit.png?v=3', alt: '', width: 200, height: 204 }),
        h('div', null, h('b', null, 'Assistant BDA Security Group'), statutTxt),
        h('button', { class: 'as-tete__fermer', type: 'button', 'aria-label': 'Fermer', onclick: () => ouvrir(false) }, ic(I.croix))),
      fil, form,
      h('footer', { class: 'as-pied' },
        h('a', { href: 'tel:+33611678625' }, ic(I.tel), '06 11 67 86 25'),
        h('a', { href: 'https://wa.me/33784739070', target: '_blank', rel: 'noopener' }, 'WhatsApp'),
        h('button', { type: 'button', onclick: () => formulaireConseiller() }, ic(I.personne), 'Conseiller')));
    document.body.append(panneau, lanceur);

    let attente = null;
    let accueilli = false; // la fenêtre a-t-elle déjà été ouverte (historique affiché) ?
    const defiler = () => { fil.scrollTop = fil.scrollHeight; };
    const majStatut = () => {
      statutTxt.textContent = etat.statut === 'attente' ? 'Un conseiller va vous répondre ici' : etat.statut === 'equipe' ? 'Un conseiller BDA vous répond' : 'Répond en quelques secondes';
      panneau.classList.toggle('is-equipe', etat.statut === 'attente' || etat.statut === 'equipe');
    };
    function bulle(auteur, texte) {
      const b = h('div', { class: `as-msg as-msg--${auteur}` }, auteur === 'equipe' ? h('small', null, 'Conseiller BDA') : null, h('p', null, enrichir(texte)));
      fil.append(b);
      defiler();
      return b;
    }
    function saisieEnCours(on) {
      if (on && !attente) { attente = h('div', { class: 'as-msg as-msg--robot as-msg--saisie' }, h('span'), h('span'), h('span')); fil.append(attente); defiler(); }
      if (!on && attente) { attente.remove(); attente = null; }
    }
    const LIENS = { 'Demander un devis': '/devis', 'Estimer ma mission': '/tarifs#estimation', 'Voir le recrutement': '/recrutement', 'Nos références': '/references', 'Réserver un chauffeur': '/devis?service=transfert', 'Zones d’intervention': null };
    function suggestions(liste) {
      fil.querySelectorAll('.as-sugg').forEach((s) => s.remove());
      if (!liste || !liste.length) return;
      fil.append(h('div', { class: 'as-sugg' }, liste.map((s) => {
        if (LIENS[s]) return h('a', { class: 'as-puce', href: LIENS[s] }, s);
        if (/conseiller|rappel/i.test(s)) return h('button', { class: 'as-puce as-puce--conseiller', type: 'button', onclick: () => formulaireConseiller() }, s);
        return h('button', { class: 'as-puce', type: 'button', onclick: () => envoyer(s === 'Zones d’intervention' ? 'Dans quelles zones intervenez-vous ?' : s) }, s);
      })));
      defiler();
    }
    function carteConseiller() {
      if (etat.statut !== 'robot') return;
      fil.append(h('div', { class: 'as-carte' }, h('p', null, 'Vous préférez échanger avec un membre de l’équipe ?'), h('button', { class: 'as-btn', type: 'button', onclick: () => formulaireConseiller() }, ic(I.personne), 'Parler à un conseiller')));
      defiler();
    }
    function formulaireConseiller() {
      if (!etat.ouvert) ouvrir(true);
      if (etat.statut === 'attente' || etat.statut === 'equipe') { bulle('robot', 'Votre demande est déjà transmise : un conseiller BDA vous répond ici dès que possible. Pour une urgence : 06 11 67 86 25.'); return; }
      fil.querySelectorAll('.as-form, .as-carte, .as-sugg').forEach((x) => x.remove());
      const nom = h('input', { class: 'as-input', name: 'nom', autocomplete: 'name', placeholder: 'Votre nom', required: true, maxlength: 80 });
      const contact = h('input', { class: 'as-input', name: 'contact', autocomplete: 'tel', placeholder: 'Téléphone ou email', required: true, maxlength: 120 });
      const besoin = h('textarea', { class: 'as-input', rows: 2, placeholder: 'Votre besoin en quelques mots (facultatif)', maxlength: 1000 });
      const erreurTxt = h('p', { class: 'as-erreur', hidden: true });
      const f = h('form', { class: 'as-form', onsubmit: async (e) => {
        e.preventDefault();
        f.querySelector('button').disabled = true;
        try {
          const r = await appel('conseiller', { jeton: etat.jeton, nom: nom.value.trim(), contact: contact.value.trim(), besoin: besoin.value.trim(), page: location.pathname });
          etat.jeton = r.jeton; etat.statut = r.statut;
          f.remove();
          r.messages.forEach((m) => { bulle(m.auteur, m.texte); etat.dernier = Math.max(etat.dernier, m.id); });
          sauver(); majStatut(); suivre();
        } catch (err) { erreurTxt.textContent = err.message; erreurTxt.hidden = false; f.querySelector('button').disabled = false; }
      } },
      h('b', null, 'Être mis en relation avec un conseiller'),
      h('small', null, 'L’équipe BDA vous répond ici, ou vous rappelle.'), nom, contact, besoin, erreurTxt,
      h('button', { class: 'as-btn', type: 'submit' }, 'Envoyer ma demande'));
      fil.append(f);
      defiler();
      nom.focus();
    }
    async function envoyer(texte) {
      texte = String(texte || '').trim();
      if (!texte) return;
      fil.querySelectorAll('.as-sugg, .as-carte').forEach((x) => x.remove());
      bulle('visiteur', texte);
      champ.value = ''; champ.style.height = '';
      bouton.disabled = true;
      const enEquipe = etat.statut === 'attente' || etat.statut === 'equipe';
      if (!enEquipe) saisieEnCours(true);
      const debut = Date.now();
      try {
        const r = await appel('message', { jeton: etat.jeton, texte, page: location.pathname });
        etat.jeton = r.jeton; etat.statut = r.statut;
        // Petit délai naturel avant la réponse
        await new Promise((ok) => setTimeout(ok, Math.max(0, 650 - (Date.now() - debut))));
        saisieEnCours(false);
        r.messages.forEach((m) => { if (m.auteur !== 'visiteur') bulle(m.auteur, m.texte); etat.dernier = Math.max(etat.dernier, m.id); });
        if (enEquipe) bulle('robot', 'Message transmis au conseiller.');
        suggestions(r.suggestions);
        if (r.conseiller) carteConseiller();
        sauver(); majStatut();
      } catch (err) {
        saisieEnCours(false);
        bulle('robot', err.message);
      }
      bouton.disabled = false;
      champ.focus();
    }
    form.addEventListener('submit', (e) => { e.preventDefault(); envoyer(champ.value); });
    champ.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(champ.value); } });
    champ.addEventListener('input', () => { champ.style.height = ''; champ.style.height = `${Math.min(110, champ.scrollHeight)}px`; });

    /* ----- Réponses de l'équipe ----- */
    let minuteur = null;
    async function verifier() {
      if (!etat.jeton) return;
      try {
        const r = await appel('suivi', null, `&jeton=${encodeURIComponent(etat.jeton)}&apres=${etat.dernier}`);
        if (r.statut === 'aucune') { etat = { jeton: '', dernier: 0, statut: 'robot', ouvert: etat.ouvert }; sauver(); return; }
        let nouveau = false;
        r.messages.forEach((m) => {
          etat.dernier = Math.max(etat.dernier, m.id);
          if (m.auteur === 'equipe') { if (accueilli) bulle('equipe', m.texte); nouveau = true; }
        });
        etat.statut = r.statut;
        sauver(); majStatut();
        if (nouveau && !etat.ouvert) { pastille.hidden = false; pastille.textContent = '1'; lanceur.classList.add('a-nouveau'); }
      } catch (e) { /* réseau : on réessaiera */ }
    }
    function suivre() {
      clearInterval(minuteur);
      if (etat.statut !== 'attente' && etat.statut !== 'equipe') return;
      minuteur = setInterval(() => { if (!document.hidden) verifier(); }, etat.ouvert ? 6000 : 20000);
    }

    /* ----- Ouverture ----- */
    async function ouvrir(on) {
      etat.ouvert = on;
      panneau.hidden = !on;
      requestAnimationFrame(() => panneau.classList.toggle('is-ouvert', on));
      lanceur.classList.toggle('is-ouvert', on);
      lanceur.setAttribute('aria-expanded', String(on));
      document.querySelector('.as-teaser')?.remove();
      if (on) {
        pastille.hidden = true; lanceur.classList.remove('a-nouveau');
        if (!accueilli) {
          accueilli = true;
          // Reprise d'une discussion déjà commencée
          if (etat.jeton) {
            try {
              const r = await appel('suivi', null, `&jeton=${encodeURIComponent(etat.jeton)}&apres=0`);
              if (r.statut !== 'aucune' && r.messages.length) {
                r.messages.forEach((m) => { bulle(m.auteur, m.texte); etat.dernier = Math.max(etat.dernier, m.id); });
                etat.statut = r.statut; sauver(); majStatut();
              } else { etat = { jeton: '', dernier: 0, statut: 'robot', ouvert: true }; sauver(); }
            } catch (e) { /* hors ligne */ }
          }
          if (!fil.children.length) {
            bulle('robot', 'Bonjour, je suis l’assistant de BDA Security Group. Posez-moi votre question : prestations, tarifs, disponibilités, zones d’intervention… Je peux aussi vous mettre en relation avec un conseiller.');
            suggestions(['Nos tarifs', 'Un agent pour ce soir', 'Sécurité d’un événement', 'Transfert aéroport', 'Parler à un conseiller']);
          }
        }
        if (matchMedia('(min-width: 641px)').matches) champ.focus();
      }
      suivre();
    }
    lanceur.addEventListener('click', () => ouvrir(!etat.ouvert));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && etat.ouvert) ouvrir(false); });
    // Liens « parler à l'assistant » ailleurs sur le site
    // data-question="…" : la question est posée directement ; [data-assistant-form] : champ de question ailleurs sur la page
    async function demander(question) {
      await ouvrir(true);
      if (question && String(question).trim()) envoyer(question);
    }
    document.addEventListener('click', (e) => { const a = e.target.closest('[data-assistant]'); if (a) { e.preventDefault(); demander(a.dataset.question); } });
    document.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-assistant-form]');
      if (!f) return;
      e.preventDefault();
      const q = f.querySelector('input, textarea');
      demander(q && q.value);
      if (q) { q.value = ''; q.blur(); }
    });
    window.Assistant = { ouvrir: () => ouvrir(true), demander };

    majStatut();
    suivre();
    if (etat.jeton && (etat.statut === 'attente' || etat.statut === 'equipe')) verifier();
    // Retour sur l'onglet : on regarde tout de suite si l'équipe a répondu
    document.addEventListener('visibilitychange', () => { if (!document.hidden && (etat.statut === 'attente' || etat.statut === 'equipe')) verifier(); });

    // Accueil : petite invitation après quelques secondes (une fois par visite)
    let vu = false;
    try { vu = sessionStorage.getItem('bda-assistant-teaser') === '1'; } catch (e) { /* rien */ }
    if (ACCUEIL && !vu) {
      // Après le premier écran seulement (le haut de l'accueil reste dégagé)
      const quandDefile = (fn) => {
        const verifier = () => { if (window.scrollY > window.innerHeight * 0.7) { window.removeEventListener('scroll', verifier); setTimeout(fn, 1500); } };
        window.addEventListener('scroll', verifier, { passive: true });
      };
      quandDefile(() => {
        if (etat.ouvert) return;
        const t = h('div', { class: 'as-teaser', role: 'status' },
          h('button', { class: 'as-teaser__x', type: 'button', 'aria-label': 'Fermer', onclick: (e) => { e.stopPropagation(); t.remove(); } }, '×'),
          h('img', { src: '/assets/img/ecusson-petit.png?v=3', alt: '', width: 200, height: 204 }),
          h('p', null, h('b', null, 'Une question ?'), 'Tarifs, disponibilités, devis… je vous réponds tout de suite.'));
        t.addEventListener('click', () => ouvrir(true));
        document.body.append(t);
        requestAnimationFrame(() => t.classList.add('is-on'));
        try { sessionStorage.setItem('bda-assistant-teaser', '1'); } catch (e) { /* rien */ }
      });
    }
  }

  // L'assistant n'apparaît que s'il est activé dans l'admin (Contenu & tarifs)
  const demarrer = () => {
    const p = window.Site && window.Site.reglages;
    if (!p) return construire();
    p.then((j) => { if (!j || !j.visible || j.visible.assistant !== false) construire(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
