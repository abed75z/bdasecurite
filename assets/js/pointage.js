/* =========================================================
   POINTAGE AGENT — prise et fin de service depuis le téléphone
   L'agent ouvre son lien personnel (…/pointage#k=…), maintient le
   gros bouton appuyé : l'heure (et la position, s'il l'accepte)
   est envoyée à l'admin BDA.
   ========================================================= */
(function () {
  'use strict';
  const CLE = 'bda-pointage';
  const app = document.getElementById('app');
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const pad = (n) => String(n).padStart(2, '0');
  let decalage = 0; // écart entre l'heure du téléphone et celle du serveur
  let etat = null;
  let minuteur = null;

  /* ----- Lien personnel : lu dans l'adresse, gardé sur le téléphone ----- */
  function lireJeton() {
    const m = location.hash.match(/k=([a-f0-9]{48})/);
    let j = m ? m[1] : '';
    try {
      if (j) localStorage.setItem(CLE, j);
      else j = localStorage.getItem(CLE) || '';
    } catch (e) { /* navigation privée : le lien de l'adresse suffit */ }
    // L'adresse garde le lien : « Ajouter à l'écran d'accueil » ouvrira directement le bon agent
    if (j && !m) history.replaceState(null, '', `${location.pathname}#k=${j}`);
    return j;
  }
  const jeton = lireJeton();

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
  const svg = (chemin, cls = 'pt-ic') => h('span', { class: cls, 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24">${chemin}</svg>` });
  const IC = {
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    horloge: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    alerte: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    tel: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  };
  const maintenant = () => new Date(Date.now() + decalage);
  const lireDate = (s) => new Date(s.replace(' ', 'T'));
  const hm = (d) => `${pad(d.getHours())}h${pad(d.getMinutes())}`;
  const duree = (min) => `${Math.floor(min / 60)}h${pad(Math.round(min % 60))}`;
  const jourLong = (d) => `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
  function prevuLisible(code) {
    const c = String(code || '').trim();
    if (!c) return '';
    const libelles = { R: 'Repos', CP: 'Congés payés', M: 'Arrêt maladie', AT: 'Accident du travail', F: 'Formation', ABS: 'Absence' };
    return libelles[c.toUpperCase()] || `Service prévu ${c.replace(/-/g, ' – ')}`;
  }

  async function appel(action, donnees) {
    const r = await fetch(`/api/pointage.php?a=${action}`, {
      method: donnees ? 'POST' : 'GET',
      headers: { 'X-Pointage': jeton, ...(donnees ? { 'Content-Type': 'application/json' } : {}) },
      body: donnees ? JSON.stringify(donnees) : undefined,
      cache: 'no-store',
    });
    let res = {};
    try { res = await r.json(); } catch (e) { /* réponse vide */ }
    if (!r.ok || !res.ok) { const err = new Error(res.erreur || 'Connexion impossible. Vérifiez votre réseau.'); err.statut = r.status; throw err; }
    return res;
  }

  /* ----- Horloge en haut à droite ----- */
  const horloge = document.getElementById('horloge');
  setInterval(() => { const d = maintenant(); horloge.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`; }, 1000);

  function toast(message, type = 'ok') {
    document.querySelector('.pt-toast')?.remove();
    const t = h('div', { class: `pt-toast pt-toast--${type}`, role: 'status' }, svg(type === 'ok' ? IC.check : IC.alerte), h('span', null, message));
    document.body.append(t);
    requestAnimationFrame(() => t.classList.add('is-on'));
    setTimeout(() => { t.classList.remove('is-on'); setTimeout(() => t.remove(), 400); }, 4200);
  }

  /* ----- Position GPS (facultative) ----- */
  function position() {
    return new Promise((ok) => {
      if (!navigator.geolocation) return ok(null);
      navigator.geolocation.getCurrentPosition(
        (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, prec: p.coords.accuracy }),
        () => ok(null),
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 });
    });
  }

  /* ----- Écrans ----- */
  function ecran(...contenu) {
    clearInterval(minuteur);
    [...app.children].forEach((c) => { if (!c.classList.contains('pt-tete')) c.remove(); });
    app.append(...contenu.flat().filter(Boolean));
  }

  function ecranSansLien(message) {
    ecran(h('section', { class: 'pt-carte pt-vide' },
      svg(IC.alerte, 'pt-ic pt-ic--grand'),
      h('h1', null, 'Lien de pointage manquant'),
      h('p', null, message || 'Ouvrez le lien personnel que votre responsable vous a envoyé (SMS ou WhatsApp). Il ne sert qu’à vous.'),
      h('a', { class: 'pt-lien', href: 'tel:+33611678625' }, svg(IC.tel), 'Appeler BDA : 06 11 67 86 25')));
  }

  function anneau() {
    // Anneau de progression qui se remplit pendant l'appui long
    return h('span', { class: 'pt-anneau', 'aria-hidden': 'true', html: '<svg viewBox="0 0 120 120"><circle class="pt-anneau__fond" cx="60" cy="60" r="54"/><circle class="pt-anneau__plein" cx="60" cy="60" r="54" pathLength="100"/></svg>' });
  }

  function dessiner() {
    const e = etat;
    const enCours = e.enCours;
    const auj = maintenant();
    const prenom = String(e.agent.nom || '').trim().split(/\s+/)[0] || '';
    const prevu = prevuLisible(e.prevu);

    const chrono = h('b', { class: 'pt-chrono' }, '00:00:00');
    const depuis = h('small', { class: 'pt-depuis' });
    const etiquette = h('span', { class: 'pt-bouton__txt' }, enCours ? 'Terminer mon service' : 'Prendre mon service');
    const bouton = h('button', { class: `pt-bouton ${enCours ? 'pt-bouton--fin' : 'pt-bouton--debut'}`, type: 'button', 'aria-label': `${enCours ? 'Terminer' : 'Prendre'} mon service : maintenir appuyé` },
      anneau(), h('span', { class: 'pt-bouton__coeur' }, svg(enCours ? IC.stop : IC.play, 'pt-ic pt-ic--bouton'), etiquette));
    appuiLong(bouton, () => (enCours ? pointer('fin') : pointer('debut')));

    if (enCours) {
      const deb = lireDate(enCours.debut);
      depuis.textContent = `En service depuis ${hm(deb)}${enCours.site ? ` · ${enCours.site}` : ''}`;
      const tic = () => {
        const s = Math.max(0, Math.floor((maintenant() - deb) / 1000));
        chrono.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
      };
      tic();
      setTimeout(() => { minuteur = setInterval(tic, 1000); }, 0);
    }

    const historique = (e.historique || []).filter((p) => p.fin).slice(0, 5);
    ecran(
      h('section', { class: 'pt-bonjour' },
        h('p', { class: 'pt-kicker' }, jourLong(auj)),
        h('h1', null, `Bonjour ${prenom}`),
        h('p', { class: 'pt-poste' }, e.agent.poste === 'ADS' ? 'Agent de sécurité' : e.agent.poste)),
      prevu ? h('div', { class: 'pt-prevu' }, svg(IC.cal), h('span', null, prevu, e.site && !/^(Repos|Congés|Arrêt|Accident|Formation|Absence)/.test(prevu) ? h('small', null, e.site) : null)) : null,
      h('section', { class: `pt-zone ${enCours ? 'is-en-service' : ''}` },
        h('p', { class: 'pt-statut' }, h('i', { 'aria-hidden': 'true' }), enCours ? 'En service' : 'Hors service'),
        enCours ? chrono : null,
        enCours ? depuis : null,
        bouton,
        h('p', { class: 'pt-aide' }, 'Maintenez le bouton appuyé une seconde')),
      h('section', { class: 'pt-carte' },
        h('div', { class: 'pt-semaine' }, svg(IC.horloge), h('span', null, 'Cette semaine'), h('b', null, duree(e.semaine || 0))),
        historique.length ? h('ul', { class: 'pt-histo' }, historique.map((p) => {
          const d = lireDate(p.debut);
          const f = lireDate(p.fin);
          return h('li', null,
            h('span', { class: 'pt-histo__jour' }, `${JOURS[d.getDay()].slice(0, 3)}. ${d.getDate()}`),
            h('span', { class: 'pt-histo__h' }, `${hm(d)} → ${hm(f)}`),
            h('b', null, duree((f - d) / 60000)));
        })) : h('p', { class: 'pt-muet' }, 'Vos derniers services apparaîtront ici.')),
      h('p', { class: 'pt-note' }, svg(IC.pin), 'Votre position est enregistrée uniquement au moment où vous pointez, pour confirmer votre présence sur le site.'));
  }

  function appuiLong(bouton, action) {
    let t0 = 0;
    let raf = 0;
    let fait = false;
    const plein = bouton.querySelector('.pt-anneau__plein');
    const DUREE = 900;
    const stop = () => {
      cancelAnimationFrame(raf);
      bouton.classList.remove('is-appui');
      if (!fait) plein.style.strokeDashoffset = '100';
    };
    const boucle = (t) => {
      const p = Math.min(1, (t - t0) / DUREE);
      plein.style.strokeDashoffset = String(100 - p * 100);
      if (p >= 1) { fait = true; stop(); navigator.vibrate?.(60); action(); return; }
      raf = requestAnimationFrame(boucle);
    };
    const debut = (ev) => {
      if (bouton.disabled) return;
      ev.preventDefault();
      fait = false;
      bouton.classList.add('is-appui');
      t0 = performance.now();
      raf = requestAnimationFrame(boucle);
    };
    bouton.addEventListener('pointerdown', debut);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => bouton.addEventListener(n, stop));
    bouton.addEventListener('contextmenu', (e) => e.preventDefault());
    // Clavier : Entrée ou Espace maintenu
    bouton.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) debut(e); });
    bouton.addEventListener('keyup', stop);
    bouton.addEventListener('click', (e) => { if (!fait && e.detail === 0) return; if (!fait) toast('Maintenez le bouton appuyé une seconde.', 'info'); });
  }

  async function pointer(sens) {
    const bouton = document.querySelector('.pt-bouton');
    bouton.disabled = true;
    bouton.classList.add('is-envoi');
    bouton.querySelector('.pt-bouton__txt').textContent = 'Envoi…';
    try {
      const pos = await position();
      const r = await appel(sens, pos || {});
      navigator.vibrate?.([40, 60, 40]);
      await chargerEtat();
      if (sens === 'debut') toast(`Service commencé à ${hm(maintenant())}. Bon courage !`);
      else toast(`Service terminé : ${duree(r.minutes || 0)} enregistrées. Merci !`);
      if (!pos) setTimeout(() => toast('Position non partagée : le pointage est quand même enregistré.', 'info'), 4500);
    } catch (err) {
      toast(err.message, 'erreur');
      if (err.statut === 403) return ecranSansLien(err.message);
      await chargerEtat().catch(() => dessiner());
    }
  }

  async function chargerEtat() {
    const e = await appel('etat');
    decalage = lireDate(e.serveur) - Date.now();
    etat = e;
    dessiner();
  }

  if (!jeton) { document.getElementById('chargement')?.remove(); ecranSansLien(); return; }
  chargerEtat().catch((err) => {
    if (err.statut === 403) { try { localStorage.removeItem(CLE); } catch (e) { /* rien */ } return ecranSansLien(err.message); }
    ecran(h('section', { class: 'pt-carte pt-vide' }, svg(IC.alerte, 'pt-ic pt-ic--grand'), h('h1', null, 'Pas de connexion'), h('p', null, err.message),
      h('button', { class: 'pt-lien', type: 'button', onclick: () => location.reload() }, 'Réessayer')));
  });
  // Retour sur l'application après un moment : on remet l'état à jour
  document.addEventListener('visibilitychange', () => { if (!document.hidden && etat) chargerEtat().catch(() => {}); });
})();
