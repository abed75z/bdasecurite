/* =========================================================
   ANIMATIONS (thème blanc 2.0)
   - grand titre de l'accueil qui monte mot par mot
   - apparitions douces au scroll (.rv)
   - manifeste : les mots s'éclairent au fil du scroll
   - étapes : ligne rouge qui se remplit
   - photo de référence : léger zoom arrière au scroll
   - sélecteur Sécurité / VTC des services
   Tout est désactivé si le visiteur préfère moins d'animations.
   ========================================================= */
(() => {
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Scroll : une seule boucle par image ---------- */
  const fns = [];
  let attente = false;
  const tourner = () => { attente = false; fns.forEach((f) => f()); };
  const auScroll = (f) => { fns.push(f); f(); };
  window.addEventListener('scroll', () => { if (!attente) { attente = true; requestAnimationFrame(tourner); } }, { passive: true });
  window.addEventListener('resize', () => { if (!attente) { attente = true; requestAnimationFrame(tourner); } });
  // Progression d'un élément dans l'écran : 0 quand il entre en bas, 1 quand il atteint la hauteur voulue
  const progression = (el, debut = 0.9, fin = 0.35) => {
    const r = el.getBoundingClientRect(), vh = window.innerHeight || 800;
    return clamp((vh * debut - r.top) / (vh * debut - vh * fin + r.height * 0.5), 0, 1);
  };

  /* ---------- Grand titre mot par mot ---------- */
  function decouperTitre(anime) {
    const h = document.querySelector('.ac-hero .h1');
    if (!h) return;
    let i = 0;
    const parcourir = (noeud) => {
      [...noeud.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((morceau) => {
            if (!morceau) return;
            if (/^\s+$/.test(morceau)) { frag.append(' '); return; }
            const m = document.createElement('span');
            m.className = anime ? 'mot' : 'mot sans-anim';
            const s = document.createElement('span');
            s.style.setProperty('--m', i++);
            s.textContent = morceau;
            m.append(s);
            frag.append(m);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains('mot')) parcourir(n);
      });
    };
    parcourir(h);
    h.classList.add('decoupe');
  }
  if (!reduit) {
    decouperTitre(true);
    // Titre modifié depuis l'admin : redécoupé sans rejouer l'animation
    document.addEventListener('bda:contenu', () => {
      const h = document.querySelector('.ac-hero .h1');
      if (h && !h.querySelector('.mot')) decouperTitre(false);
    });
  }

  /* ---------- Apparitions au scroll ---------- */
  const cibles = [
    '.section .ac-centre > *', '.section .ac-tete > div > *', '.ac-manifeste .kicker', '.ac-ref__texte > *', '.ac-ref__photo',
    '.faq-intro > *', '.ac-contact__carte', '.lp-article > h2', '.lp-article > p', '.lp-article > .lp-photo',
    '.section__head > *', '.tf-estim', '.tf-tableau', '.tf-majorations', '.chiffres li', '.ac-garanties__liste li'
  ].join(',');
  const elts = [...document.querySelectorAll(cibles)].filter((el) => !el.closest('.ac-hero, .lp-hero, .tf-hero') && !el.classList.contains('cascade'));
  if (!reduit && 'IntersectionObserver' in window) {
    // Délai en cascade pour les éléments d'un même parent
    const vus = new Map();
    elts.forEach((el) => {
      const p = el.parentElement;
      const n = vus.get(p) || 0;
      vus.set(p, n + 1);
      el.style.setProperty('--rd', `${Math.min(n, 6) * 0.08}s`);
      el.classList.add('rv');
    });
    const io = new IntersectionObserver((entrees) => entrees.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('vu');
      io.unobserve(e.target);
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    elts.forEach((el) => io.observe(el));
    // Filet de sécurité : rien ne doit rester caché (onglet en arrière-plan, impression…)
    window.addEventListener('beforeprint', () => elts.forEach((el) => el.classList.add('vu')));
  }

  /* ---------- Manifeste ---------- */
  document.querySelectorAll('[data-surligne]').forEach((t) => {
    if (reduit) return;
    const mots = [];
    t.childNodes.forEach((n) => {
      if (n.nodeType !== 3) return;
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach((m) => {
        if (!m) return;
        if (/^\s+$/.test(m)) { frag.append(' '); return; }
        const s = document.createElement('span');
        s.className = 'mm-mot';
        s.textContent = m;
        mots.push(s);
        frag.append(s);
      });
      n.replaceWith(frag);
    });
    auScroll(() => {
      const p = progression(t, 0.85, 0.3);
      const n = Math.round(p * mots.length);
      mots.forEach((m, i) => m.classList.toggle('on', i < n));
    });
  });

  /* ---------- Étapes : ligne qui se remplit ---------- */
  document.querySelectorAll('[data-ligne]').forEach((ol) => {
    const items = [...ol.children];
    if (reduit) { ol.style.setProperty('--p', 1); items.forEach((li) => li.classList.add('on')); return; }
    auScroll(() => {
      const p = progression(ol, 0.85, 0.45);
      ol.style.setProperty('--p', p.toFixed(3));
      items.forEach((li, i) => li.classList.toggle('on', p >= i / items.length + 0.02 || p === 1));
    });
  });

  /* ---------- Photo : zoom arrière au scroll ---------- */
  document.querySelectorAll('[data-zoom]').forEach((f) => {
    if (reduit) { f.style.setProperty('--z', 1); return; }
    auScroll(() => f.style.setProperty('--z', (1.18 - 0.18 * progression(f, 1, 0.4)).toFixed(4)));
  });

  /* ---------- Sélecteur Sécurité / VTC ---------- */
  document.querySelectorAll('.segment').forEach((seg) => {
    const fond = seg.querySelector('.segment__fond');
    const boutons = [...seg.querySelectorAll('button[data-onglet]')];
    const placer = () => {
      const b = boutons.find((x) => x.getAttribute('aria-selected') === 'true') || boutons[0];
      if (!b || !fond) return;
      seg.style.setProperty('--sw', `${b.offsetWidth}px`);
      seg.style.setProperty('--sx', `${b.offsetLeft - 4}px`);
    };
    const choisir = (b, focus) => {
      boutons.forEach((x) => {
        const actif = x === b;
        x.setAttribute('aria-selected', String(actif));
        x.tabIndex = actif ? 0 : -1;
        const p = document.getElementById(x.getAttribute('aria-controls'));
        if (!p) return;
        p.hidden = !actif;
        p.classList.toggle('is-actif', actif);
        if (actif && !reduit) {
          [...p.children].forEach((c, i) => c.style.setProperty('--t', i));
          p.classList.remove('entre'); void p.offsetWidth; p.classList.add('entre');
        }
      });
      if (focus) b.focus();
      placer();
    };
    boutons.forEach((b, i) => {
      b.addEventListener('click', () => choisir(b));
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const visibles = boutons.filter((x) => !x.classList.contains('est-masque'));
        const j = visibles.indexOf(b) + (e.key === 'ArrowRight' ? 1 : -1);
        if (visibles[j]) choisir(visibles[j], true);
      });
      b.tabIndex = i === 0 ? 0 : -1;
    });
    // Lien direct vers #vtc : ouvre le bon onglet
    if (location.hash === '#vtc') { const v = boutons.find((x) => x.dataset.onglet === 'vtc'); if (v) choisir(v); }
    // Offre VTC masquée depuis l'admin : retour sur Sécurité
    document.addEventListener('bda:contenu', () => {
      const actif = boutons.find((x) => x.getAttribute('aria-selected') === 'true');
      if (actif && actif.classList.contains('est-masque')) choisir(boutons[0]); else placer();
    });
    window.addEventListener('resize', placer);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placer);
    placer();
  });
})();
