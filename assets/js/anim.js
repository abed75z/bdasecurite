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

  /* ---------- Barre du haut plus compacte une fois la page défilée ---------- */
  const nav = document.querySelector('.nav');
  if (nav) auScroll(() => nav.classList.toggle('is-compact', window.scrollY > 80));

  /* ---------- Titres de section : mots qui montent un par un ---------- */
  const titresMots = reduit ? [] : [...document.querySelectorAll('.section .h2:not([data-split]), .ac-contact .h2')].filter((h) => !h.closest('.ac-hero, .lp-hero, .tf-hero'));
  titresMots.forEach((h) => {
    let i = 0;
    const parcourir = (noeud) => [...noeud.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((m) => {
          if (!m) return;
          if (/^\s+$/.test(m)) { frag.append(' '); return; }
          const mot = document.createElement('span'); mot.className = 'mot';
          const s = document.createElement('span'); s.style.setProperty('--m', i++); s.textContent = m;
          mot.append(s); frag.append(mot);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') parcourir(n);
    });
    parcourir(h);
    h.classList.add('mots');
  });
  if (titresMots.length && 'IntersectionObserver' in window) {
    const ioT = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('vu'); ioT.unobserve(e.target); } }), { threshold: 0.3 });
    titresMots.forEach((h) => ioT.observe(h));
  } else titresMots.forEach((h) => h.classList.add('vu'));

  /* ---------- Apparitions au scroll ---------- */
  const cibles = [
    '.section .ac-centre > *', '.section .ac-tete > div > *', '.ac-manifeste .kicker', '.ac-ref__texte > *', '.ac-ref__photo',
    '.faq-intro > *', '.ac-contact__carte', '.lp-article > h2', '.lp-article > p', '.lp-article > .lp-photo',
    '.section__head > *', '.tf-estim', '.tf-tableau', '.tf-majorations', '.chiffres li', '.ac-garanties__liste li'
  ].join(',');
  const elts = [...document.querySelectorAll(cibles + ', .tuiles .tuile, .ac-ia__texte > :not(.h2), .ac-ia__demo')].filter((el) => !el.closest('.ac-hero, .lp-hero, .tf-hero') && !el.classList.contains('cascade') && !el.classList.contains('mots'));
  document.querySelectorAll('.tuiles .tuile').forEach((t) => t.classList.add('rv--zoom'));
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

  /* ---------- En-tête de l'accueil : profondeur au scroll (ordinateur) ---------- */
  const texteHero = document.querySelector('.ac-hero__texte');
  const tel = document.querySelector('.ac-hero .tel');
  if (!reduit && texteHero && window.matchMedia('(min-width: 1021px)').matches) {
    auScroll(() => {
      const y = window.scrollY;
      if (y > 1000) return;
      texteHero.style.transform = `translate3d(0, ${(y * 0.18).toFixed(1)}px, 0)`;
      texteHero.style.opacity = String(clamp(1 - y / 750, 0, 1));
      if (tel) tel.style.transform = `translate3d(0, ${(y * -0.08).toFixed(1)}px, 0) rotate(${(y * 0.006).toFixed(2)}deg)`;
    });
  }

  /* ---------- Démonstration de l'assistant : la conversation se joue en boucle ---------- */
  document.querySelectorAll('[data-demo]').forEach((fil) => {
    const bulles = [...fil.querySelectorAll('.ia-bulle')];
    if (reduit) { bulles.forEach((b) => { if (b.dataset.texte) b.textContent = b.dataset.texte; if (b.classList.contains('ia-bulle--saisie')) b.remove(); }); return; }
    fil.classList.add('is-anime');
    const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const attendreVisible = () => new Promise((ok) => { const v = () => (document.hidden ? setTimeout(v, 800) : ok()); v(); });
    async function jouer() {
      for (;;) {
        fil.classList.remove('is-fin');
        bulles.forEach((b) => { b.classList.remove('on', 'ecrit'); if (b.dataset.texte) b.textContent = ''; });
        await pause(700);
        for (const b of bulles) {
          await attendreVisible();
          if (b.dataset.texte) {
            b.classList.add('on', 'ecrit');
            for (const c of b.dataset.texte) { b.textContent += c; await pause(c === ' ' ? 60 : 34); }
            b.classList.remove('ecrit');
            await pause(500);
          } else if (b.classList.contains('ia-bulle--saisie')) {
            b.classList.add('on'); await pause(1300); b.classList.remove('on');
          } else { b.classList.add('on'); await pause(2200); }
        }
        await pause(4500);
        fil.classList.add('is-fin');
        await pause(700);
      }
    }
    let lance = false;
    const go = () => { if (!lance) { lance = true; jouer(); } };
    if ('IntersectionObserver' in window) new IntersectionObserver((en, o) => { if (en[0].isIntersecting) { go(); o.disconnect(); } }, { threshold: 0.3 }).observe(fil);
    else go();
  });

  /* ---------- Champ de question : exemples qui s'écrivent tout seuls ---------- */
  document.querySelectorAll('input[data-exemples]').forEach((champ) => {
    if (reduit) return;
    const exemples = champ.dataset.exemples.split('|');
    const base = champ.placeholder;
    let i = 0, actif = true;
    const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
    champ.addEventListener('focus', () => { actif = false; champ.placeholder = base; });
    champ.addEventListener('blur', () => { if (!champ.value) { actif = true; } });
    (async function boucle() {
      await pause(1500);
      for (;;) {
        if (!actif || document.hidden) { await pause(800); continue; }
        const t = exemples[i++ % exemples.length];
        for (let k = 1; k <= t.length && actif; k++) { champ.placeholder = t.slice(0, k); await pause(42); }
        await pause(1800);
        for (let k = t.length; k >= 0 && actif; k--) { champ.placeholder = t.slice(0, k) || ' '; await pause(18); }
        if (!actif) champ.placeholder = base;
        await pause(350);
      }
    })();
  });

  /* ---------- Menu du haut : repère qui glisse sous le lien survolé ---------- */
  const navInner = document.querySelector('.nav__inner');
  if (navInner && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const repere = document.createElement('span');
    repere.className = 'nav__survol';
    repere.setAttribute('aria-hidden', 'true');
    navInner.prepend(repere);
    const placer = (el) => {
      const a = el.getBoundingClientRect(), b = navInner.getBoundingClientRect();
      repere.style.width = `${a.width}px`;
      repere.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top + (a.height - 38) / 2}px)`;
      repere.classList.add('on');
    };
    navInner.querySelectorAll('.nav__links > a, .nav__drop-btn').forEach((el) => el.addEventListener('mouseenter', () => placer(el)));
    navInner.querySelectorAll('.nav__links').forEach((n) => n.addEventListener('mouseleave', () => repere.classList.remove('on')));
  }

  /* ---------- Bandeau de mots : glisse avec le scroll ---------- */
  document.querySelectorAll('[data-defile]').forEach((ligne) => {
    if (reduit) return;
    const sens = parseFloat(ligne.dataset.defile) || 1;
    const bloc = ligne.parentElement;
    auScroll(() => {
      const r = bloc.getBoundingClientRect(), vh = window.innerHeight || 800;
      if (r.bottom < -100 || r.top > vh + 100) return;
      const avance = (vh - r.top) * 0.35;
      ligne.style.setProperty('--dx', `${(sens > 0 ? -ligne.scrollWidth * 0.25 + avance : -avance).toFixed(1)}px`);
    });
  });

  /* ---------- Section assistant : s'élargit jusqu'aux bords en arrivant ---------- */
  document.querySelectorAll('.ac-ia').forEach((s) => {
    if (reduit) return;
    auScroll(() => {
      const r = s.getBoundingClientRect(), vh = window.innerHeight || 800;
      if (r.top > vh || r.bottom < 0) return;
      const p = clamp((vh - r.top) / (vh * 0.75), 0, 1);
      const marge = Math.min(window.innerWidth * 0.045, 64) * (1 - p);
      s.style.setProperty('--ix', `${marge.toFixed(1)}px`);
      s.style.setProperty('--ir', `${(40 * (1 - p)).toFixed(1)}px`);
    });
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
