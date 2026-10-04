/* =========================================================
   CORE — effets partagés par toutes les pages :
   poussière dorée, route lumineuse, navigation, apparitions
   au scroll, parallaxe, inclinaison 3D, boutons magnétiques
   ========================================================= */
(() => {
  const root = document.documentElement;
  root.classList.add('js');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ---------- Répartiteur de scroll (1 seul rAF par frame) ---------- */
  const scrollFns = [];
  let ticking = false;
  const runScroll = () => { ticking = false; const y = window.scrollY; scrollFns.forEach((fn) => fn(y)); };
  const onScroll = (fn) => { scrollFns.push(fn); fn(window.scrollY); };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(runScroll); } }, { passive: true });
  window.addEventListener('resize', () => requestAnimationFrame(runScroll));

  window.Site = { reduced, finePointer, lerp, clamp, onScroll };

  /* ---------- Ciel de nuit : étoiles, poussière dorée, étoiles filantes ---------- */
  function sky() {
    const canvas = document.getElementById('sky');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const starColors = ['255,255,255', '214,222,255', '190,205,255', '255,92,102'];
    let w = 0, h = 0, stars = [], shooting = [], nextShoot = 2500, last = performance.now(), raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(220, Math.round((w * h) / 6500));
      stars = Array.from({ length: count }, () => {
        const gold = Math.random() < 0.18; // quelques grains dorés qui remontent doucement
        return {
          x: Math.random() * w, y: Math.random() * h,
          r: gold ? Math.random() * 1.2 + 0.5 : Math.random() * 1.1 + 0.25,
          z: Math.random() * 0.8 + 0.2,
          vy: gold ? -(Math.random() * 0.01 + 0.004) : 0,
          tw: Math.random() * Math.PI * 2,
          ts: Math.random() * 0.002 + 0.0006,
          c: gold ? starColors[3] : starColors[(Math.random() * 3) | 0],
        };
      });
    }

    function spawnShoot() {
      const angle = ((16 + Math.random() * 20) * Math.PI) / 180;
      const speed = 0.8 + Math.random() * 0.6;
      shooting.push({ x: Math.random() * w * 0.7, y: Math.random() * h * 0.4, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0, dur: 700 + Math.random() * 500 });
    }

    function draw(now) {
      const dt = Math.min(now - last, 50); last = now;
      const scroll = window.scrollY;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.tw += s.ts * dt;
        if (s.vy) { s.y += s.vy * dt; if (s.y < -10) { s.y = h + 10; s.x = Math.random() * w; } }
        const y = (((s.y - scroll * s.z * 0.08) % h) + h) % h;
        const a = clamp(0.25 + Math.sin(s.tw) * 0.3 + s.z * 0.35, 0.05, 0.95);
        ctx.fillStyle = `rgba(${s.c},${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      nextShoot -= dt;
      if (nextShoot <= 0) { spawnShoot(); nextShoot = 4000 + Math.random() * 6000; }
      ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        s.life += dt;
        const p = s.life / s.dur;
        if (p >= 1) { shooting.splice(i, 1); continue; }
        const x = s.x + s.vx * s.life, y = s.y + s.vy * s.life;
        const ex = x - s.vx * 160, ey = y - s.vy * 160;
        const grad = ctx.createLinearGradient(x, y, ex, ey);
        grad.addColorStop(0, `rgba(248,245,241,${((1 - p) * 0.9).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(206, 181, 140,0)');
        ctx.strokeStyle = grad;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    }

    resize();
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); if (reduced) draw(performance.now()); }, 150); });
    document.addEventListener('visibilitychange', () => {
      if (reduced) return;
      if (document.hidden) cancelAnimationFrame(raf);
      else { last = performance.now(); raf = requestAnimationFrame(draw); }
    });
    if (reduced) draw(performance.now()); else raf = requestAnimationFrame(draw);
  }

  /* ---------- Pause des animations hors écran : [data-anim] ---------- */
  function animScopes() {
    const scopes = document.querySelectorAll('[data-anim]');
    if (!scopes.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        e.target.classList.toggle('anim-off', !e.isIntersecting);
        e.target.querySelectorAll('svg').forEach((s) => {
          try { if (e.isIntersecting) s.unpauseAnimations(); else s.pauseAnimations(); } catch (_) { /* SVG sans animation */ }
        });
      });
    }, { rootMargin: '150px 0px' });
    scopes.forEach((s) => io.observe(s));
  }

  /* ---------- Route de nuit : traînées de phares [data-road] ---------- */
  function roads() {
    const lanes = [
      { x: 20, type: 'in' }, { x: 470, type: 'in' },
      { x: 970, type: 'out' }, { x: 1420, type: 'out' },
    ];
    document.querySelectorAll('svg[data-road]').forEach((svg, n) => {
      let seed = 7 + n * 13;
      const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      let html = '';
      [-260, 1700].forEach((x) => { html += `<path class="edge" d="M720 0 L${x} 420"/>`; });
      [245, 720, 1195].forEach((x) => { html += `<path class="lane" d="M720 0 L${x} 420"/>`; });
      lanes.forEach((lane) => {
        const count = 3;
        for (let i = 0; i < count; i++) {
          const x = lane.x + (rand() - 0.5) * 120;
          const t = (2.6 + rand() * 1.8).toFixed(2);
          const dl = (-rand() * 4).toFixed(2);
          const r = rand();
          const color = lane.type === 'in' ? (r > 0.55 ? 'head' : r > 0.25 ? 'gold' : 'blue') : 'tail';
          const cls = `trail${lane.type === 'out' ? ' trail--out' : ''} ${color}`;
          const d = `M720 0 L${x.toFixed(0)} 420`;
          const style = `style="--t:${t}s;--dl:${dl}s"`;
          html += `<path class="${cls} trail--glow" d="${d}" pathLength="1000" ${style}/>`;
          html += `<path class="${cls} trail--core" d="${d}" pathLength="1000" ${style}/>`;
        }
      });
      svg.innerHTML = html;
    });
  }

  /* ---------- Navigation ---------- */
  function navigation() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    let lastY = window.scrollY;
    onScroll((y) => {
      nav.classList.toggle('is-scrolled', y > 20);
      const down = y > lastY + 2, up = y < lastY - 2;
      // Barre du haut toujours visible : téléphone et devis à portée de main
      if (up || y < 500) nav.classList.remove('is-hidden');
      lastY = y;
    });
    nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));

    const burger = document.querySelector('.burger');
    const menu = document.querySelector('.mobile-menu');
    const setMenu = (open) => {
      document.body.classList.toggle('menu-open', open);
      root.classList.toggle('is-locked', open);
      burger?.setAttribute('aria-expanded', String(open));
      menu?.toggleAttribute('inert', !open);
    };
    menu?.setAttribute('inert', '');
    burger?.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
    menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) setMenu(false); });
    window.Site.closeMenu = () => setMenu(false);

    // Lien actif selon la section visible
    const links = [...document.querySelectorAll('.nav__links a[href^="#"]')];
    const targets = new Map();
    links.forEach((l) => { const s = document.querySelector(l.getAttribute('href')); if (s) targets.set(s, l); });
    if (!targets.size) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const link = targets.get(e.target);
        if (e.isIntersecting) { links.forEach((l) => l.classList.remove('is-active')); link?.classList.add('is-active'); }
        else link?.classList.remove('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach((_, s) => io.observe(s));
  }

  /* ---------- Barre de progression ---------- */
  function progress() {
    const bar = document.querySelector('.scroll-progress');
    if (!bar) return;
    onScroll((y) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
    });
  }

  /* ---------- Découpage des titres mot par mot ---------- */
  function splitWords(el) {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/([ \t\n\r]+)/).forEach((part) => {
            if (!part) return;
            if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const outer = document.createElement('span');
            const inner = document.createElement('span');
            outer.className = 'sw'; inner.className = 'sw__in';
            inner.style.setProperty('--w', i++);
            inner.textContent = part;
            outer.appendChild(inner); frag.appendChild(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
      });
    };
    walk(el);
  }

  /* ---------- Apparitions au scroll ---------- */
  function reveal() {
    document.querySelectorAll('[data-stagger]').forEach((parent) => {
      [...parent.children].forEach((c, i) => c.style.setProperty('--i', i));
    });
    // Titres affichés directement (plus de découpage mot par mot : rendu plus sobre)
    document.querySelectorAll('[data-split]').forEach((e) => e.classList.add('is-in'));
    const els = document.querySelectorAll('[data-reveal]');
    if (reduced || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        e.target.dispatchEvent(new CustomEvent('reveal'));
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((e) => io.observe(e));
  }

  /* ---------- Parallaxe au scroll : [data-speed] ---------- */
  function scrollParallax() {
    if (reduced) return;
    const els = [...document.querySelectorAll('[data-speed]')];
    if (!els.length) return;
    onScroll(() => {
      const vh = window.innerHeight;
      els.forEach((el) => {
        const r = (el.parentElement || el).getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const center = r.top + r.height / 2 - vh / 2;
        el.style.setProperty('--sy', (center * -parseFloat(el.dataset.speed)).toFixed(1));
      });
    });
  }

  /* ---------- Scènes à la souris : [data-scene] > [data-depth] ---------- */
  function scenes() {
    if (reduced || !finePointer) return;
    document.querySelectorAll('[data-scene]').forEach((scene) => {
      const layers = [...scene.querySelectorAll('[data-depth]')];
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
      const loop = () => {
        cx = lerp(cx, tx, 0.07); cy = lerp(cy, ty, 0.07);
        layers.forEach((l) => {
          const d = parseFloat(l.dataset.depth);
          l.style.setProperty('--mx', (cx * d * 50).toFixed(2));
          l.style.setProperty('--my', (cy * d * 50).toFixed(2));
        });
        raf = Math.abs(cx - tx) + Math.abs(cy - ty) > 0.001 ? requestAnimationFrame(loop) : 0;
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
      const area = scene.closest('section') || scene;
      area.addEventListener('pointermove', (e) => {
        const r = area.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - 0.5;
        ty = (e.clientY - r.top) / r.height - 0.5;
        kick();
      });
      area.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
    });
  }

  /* ---------- Inclinaison 3D + halo : [data-tilt] ---------- */
  function tilt() {
    if (reduced || !finePointer) return;
    document.querySelectorAll('[data-tilt]').forEach((el) => {
      const max = parseFloat(el.dataset.tilt || 4);
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
        el.style.setProperty('--tx', ((x - 0.5) * max * 2).toFixed(2));
        el.style.setProperty('--ty', ((0.5 - y) * max * 2).toFixed(2));
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--tx', 0); el.style.setProperty('--ty', 0); });
    });
  }

  /* ---------- Boutons magnétiques : [data-magnetic] ---------- */
  function magnetic() {
    if (reduced || !finePointer) return;
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const k = parseFloat(el.dataset.magnetic) || 0.25;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.translate = `${((e.clientX - r.left - r.width / 2) * k).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * k * 1.3).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    });
  }

  /* ---------- Menus déroulants du haut (Sécurité, VTC) ---------- */
  function menusDeroulants() {
    const menus = [...document.querySelectorAll('.nav__drop')];
    if (!menus.length) return;
    const fermerTout = (sauf) => menus.forEach((m) => {
      if (m === sauf) return;
      m.classList.remove('is-open');
      m.querySelector('.nav__drop-btn')?.setAttribute('aria-expanded', 'false');
    });
    menus.forEach((m) => {
      const btn = m.querySelector('.nav__drop-btn');
      btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const ouvert = !m.classList.contains('is-open');
        fermerTout(m);
        m.classList.toggle('is-open', ouvert);
        btn.setAttribute('aria-expanded', String(ouvert));
      });
      m.addEventListener('mouseleave', () => { m.classList.remove('is-open'); btn?.setAttribute('aria-expanded', 'false'); });
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.nav__drop')) fermerTout(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermerTout(); });
  }

  /* ---------- Effets « premium » (sobres) ----------
     - onde au clic sur les boutons et les cartes cliquables
     - apparition en cascade des listes au scroll
     - fine barre rouge de progression en haut
     - prix qui défilent jusqu'à leur valeur à l'apparition
     - léger déplacement de la photo de l'accueil au scroll */
  function effets() {
    // Onde au clic
    document.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.btn, .ac-item, .presta__item, .nav__tel, .ac-moyen, .tf-carte, .faq__q');
      if (!el || reduced) return;
      const r = el.getBoundingClientRect();
      const onde = document.createElement('span');
      const taille = Math.max(r.width, r.height) * 2.2;
      onde.className = 'onde';
      onde.style.cssText = `width:${taille}px;height:${taille}px;left:${e.clientX - r.left - taille / 2}px;top:${e.clientY - r.top - taille / 2}px`;
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.classList.add('a-onde');
      el.append(onde);
      onde.addEventListener('animationend', () => onde.remove());
    });

    // Cascade : chaque enfant des listes apparaît un peu après le précédent
    const listes = '.ac-liste, .ac-points, .ac-etapes, .ac-garanties__liste, .tf-cartes, .lp-cards, .lp-list, .faq, .ac-tarifs ul, .ac-contact__moyens';
    const enfants = [];
    document.querySelectorAll(listes).forEach((l) => [...l.children].forEach((c, i) => { c.classList.add('cascade'); c.style.setProperty('--c', i); enfants.push(c); }));
    if (reduced || !('IntersectionObserver' in window)) enfants.forEach((c) => c.classList.add('is-in'));
    else {
      const io = new IntersectionObserver((entrees) => entrees.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
      enfants.forEach((c) => io.observe(c));
    }

    // Barre de progression
    const barre = document.createElement('div');
    barre.className = 'progression';
    barre.setAttribute('aria-hidden', 'true');
    document.body.append(barre);
    onScroll((y) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      barre.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
    });

    // Prix qui défilent (bandeau tarifs de l'accueil et cartes de la page Tarifs)
    if (!reduced && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entrees) => entrees.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const el = en.target;
        const fin = el.textContent;
        const n = parseFloat(fin.replace(/\s/g, '').replace(',', '.'));
        if (!Number.isFinite(n) || n <= 0) return;
        const dec = (fin.split(',')[1] || '').length;
        const t0 = performance.now();
        const pas = (t) => {
          const p = Math.min(1, (t - t0) / 900);
          const v = n * (1 - Math.pow(1 - p, 3));
          el.textContent = p < 1 ? v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : el.dataset.final || fin;
          if (p < 1) requestAnimationFrame(pas);
        };
        requestAnimationFrame(pas);
      }), { threshold: 0.6 });
      const surveiller = () => document.querySelectorAll('.ac-tarifs [data-prix], .tf-prix [data-prix]').forEach((el) => { el.dataset.final = el.textContent; io.observe(el); });
      if (window.Site.reglages) window.Site.reglages.then(surveiller); else surveiller();
    }

    // Photo de l'accueil : léger déplacement vertical au scroll
    const photo = document.querySelector('.ac-hero__photo img');
    if (photo && !reduced) onScroll((y) => { if (y < 900) photo.style.transform = `translate3d(0, ${y * 0.08}px, 0) scale(1.08)`; });
  }

  /* ---------- Divers ---------- */
  function misc() {
    document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  /* ---------- Réglages du site (admin > Contrôle du site) ----------
     - réservation VTC : [data-vtc] visible seulement si ouverte, [data-vtc-off] seulement si fermée,
       et un clic sur un lien « reserver » affiche « pas encore disponible » tant qu'elle est fermée
     - [data-service="devis|recrutement|avis"] : remplacé par un message quand le service est fermé
     - bandeau d'annonce en haut des pages */
  function reglagesSite() {
    let s = { vtc: false, devis: true, recrutement: true, avis: true, bandeau: null };
    let fenetre = null;
    const tel = '<a class="btn btn--gold" href="tel:+33611678625"><svg class="icon" aria-hidden="true"><use href="#i-phone"/></svg> 06 11 67 86 25</a>';
    const wa = '<a class="btn btn--outline" href="https://wa.me/33784739070" target="_blank" rel="noopener">WhatsApp</a>';

    const basculerVtc = () => {
      document.querySelectorAll('[data-vtc]').forEach((el) => { el.hidden = !s.vtc; });
      document.querySelectorAll('[data-vtc-off]').forEach((el) => { el.hidden = s.vtc; });
    };
    const fermer = () => { if (fenetre) { fenetre.remove(); fenetre = null; } };
    const indisponible = () => {
      fermer();
      fenetre = document.createElement('div');
      fenetre.className = 'vtc-indispo';
      fenetre.innerHTML = `<div class="vtc-indispo__boite" role="alertdialog" aria-modal="true" aria-labelledby="vtc-indispo-titre" aria-describedby="vtc-indispo-texte">
        <button class="vtc-indispo__x" type="button" aria-label="Fermer">&times;</button>
        <span class="vtc-indispo__badge">Bientôt</span>
        <h2 id="vtc-indispo-titre">Cette option n’est pas encore disponible</h2>
        <p id="vtc-indispo-texte">La réservation de VTC en ligne arrive très bientôt. En attendant, notre équipe vous répond directement.</p>
        <div class="vtc-indispo__actions">${tel}${s.devis ? '<a class="btn btn--outline" href="devis?service=transfert">Demander un devis</a>' : wa}</div>
      </div>`;
      fenetre.addEventListener('click', (e) => { if (e.target === fenetre || e.target.closest('.vtc-indispo__x')) fermer(); });
      document.body.append(fenetre);
      fenetre.querySelector('.vtc-indispo__x').focus();
    };
    const bloquer = (e) => { if (!s.vtc) { e.preventDefault(); indisponible(); } };
    document.addEventListener('click', (e) => { if (e.target.closest('a[href^="reserver"]')) bloquer(e); });
    document.addEventListener('submit', (e) => { if (e.target.matches('form[action="reserver"]')) bloquer(e); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(); });

    const FERMES = {
      devis: ['Demandes en ligne momentanément fermées', 'Pour un devis, appelez-nous ou écrivez-nous sur WhatsApp : nous vous répondons rapidement.', tel + wa],
      recrutement: ['Les candidatures sont fermées pour le moment', 'Merci de votre intérêt pour BDA Sécurité. Revenez bientôt : nos prochains postes seront publiés ici.', ''],
      avis: ['Le dépôt d’avis est momentanément fermé', 'Merci de votre confiance ! Vous pouvez toujours lire les avis de nos clients sur cette page.', ''],
    };
    const services = () => {
      document.querySelectorAll('[data-service]').forEach((el) => {
        const k = el.dataset.service;
        const ferme = FERMES[k] && s[k] === false;
        el.hidden = ferme;
        let msg = el.nextElementSibling && el.nextElementSibling.classList.contains('service-ferme') ? el.nextElementSibling : null;
        if (ferme && !msg) {
          msg = document.createElement('div');
          msg.className = 'service-ferme';
          msg.innerHTML = `<span class="service-ferme__badge">Fermé</span><h3>${FERMES[k][0]}</h3><p>${FERMES[k][1]}</p>${FERMES[k][2] ? `<div class="service-ferme__actions">${FERMES[k][2]}</div>` : ''}`;
          el.after(msg);
        }
        if (msg) msg.hidden = !ferme;
      });
    };
    const bandeau = () => {
      const b = s.bandeau;
      const cle = b ? 'bda-annonce:' + b.texte : '';
      let masque = false;
      try { masque = !!cle && sessionStorage.getItem('bda-annonce-fermee') === cle; } catch (e) { /* stockage indisponible */ }
      if (!b || masque) return;
      const el = document.createElement('div');
      el.className = 'annonce';
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', 'Annonce');
      const txt = document.createElement('span');
      txt.textContent = b.texte;
      el.append(txt);
      if (b.lien && /^(https:\/\/|\/|tel:|mailto:)/.test(b.lien)) {
        const a = document.createElement('a');
        a.href = b.lien;
        a.textContent = b.libelleLien || 'En savoir plus';
        if (b.lien.startsWith('https://')) { a.target = '_blank'; a.rel = 'noopener'; }
        el.append(a);
      }
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'annonce__x';
      x.setAttribute('aria-label', 'Fermer l’annonce');
      x.innerHTML = '&times;';
      x.addEventListener('click', () => {
        el.remove();
        root.classList.remove('a-annonce');
        try { sessionStorage.setItem('bda-annonce-fermee', cle); } catch (e) { /* stockage indisponible */ }
      });
      el.append(x);
      document.body.prepend(el);
      const hauteur = () => root.style.setProperty('--annonce-h', `${el.offsetHeight}px`);
      hauteur();
      window.addEventListener('resize', hauteur);
      root.classList.add('a-annonce');
    };

    basculerVtc();
    // Dernier contenu connu appliqué tout de suite (évite d'apercevoir une rubrique masquée), puis contenu à jour
    try { const memo = JSON.parse(localStorage.getItem('bda-site') || 'null'); if (memo) contenu(memo); } catch (e) { /* stockage indisponible */ }
    window.Site.reglages = fetch('/api/site.php', { cache: 'no-cache' }).then((r) => r.json()).then((j) => {
      if (!j || !j.ok) return null;
      s = j;
      basculerVtc();
      services();
      bandeau();
      contenu(j);
      try { localStorage.setItem('bda-site', JSON.stringify({ visible: j.visible, tarifs: j.tarifs, accueil: j.accueil })); } catch (e) { /* stockage indisponible */ }
      return j;
    }).catch(() => null);
  }

  /* ---------- Contenu réglé dans l'admin (Contenu du site) ----------
     - rubriques masquées : [data-visible="cle"] et liens vers la page concernée
     - prix : [data-prix="cle"] (data-dec="2" = toujours 2 décimales)
     - accueil : [data-accueil="titre|texte|note"] et image (photo ou logo) */
  const PAGES_RUBRIQUE = {
    tarifs: ['tarifs'], references: ['references'], avisClients: ['avis'], recrutement: ['recrutement'],
    ssiap: ['securite-incendie-ssiap-paris'],
    offreVtc: ['chauffeur-prive-vtc-paris', 'transfert-aeroport-paris', 'chauffeur-mariage-paris', 'chauffeur-securite-vip-paris', 'reserver'],
  };
  const pageCourante = location.pathname.replace(/^\/|\.html$/g, '');
  let contenuOriginal = [];
  function contenu(c) {
    const vis = c.visible || {};
    const off = (k) => vis[k] === false;
    document.querySelectorAll('[data-visible]').forEach((el) => {
      el.classList.toggle('est-masque', el.dataset.visible.split(' ').some(off));
    });
    Object.entries(PAGES_RUBRIQUE).forEach(([k, pages]) => {
      pages.forEach((p) => document.querySelectorAll(`a[href="${p}"], a[href^="${p}?"], a[href^="${p}#"]`).forEach((a) => {
        if (a.closest('main') && !a.closest('.ac-liste, .ac-secteurs, .lp-aside, .ac-ref, .tf-carte, .tuiles')) return;
        const cible = a.parentElement && a.parentElement.tagName === 'LI' ? a.parentElement : a;
        cible.classList.toggle('est-masque', off(k));
      }));
    });
    document.querySelectorAll('.wa').forEach((el) => el.classList.toggle('est-masque', off('whatsapp')));
    // Page masquée ouverte directement : message à la place du contenu
    const rubrique = Object.keys(PAGES_RUBRIQUE).find((k) => PAGES_RUBRIQUE[k].includes(pageCourante));
    const main = document.querySelector('main');
    if (main && main.dataset.ferme && !(rubrique && off(rubrique))) {
      // Page réaffichée entre-temps : on remet son contenu
      main.replaceChildren(...contenuOriginal);
      delete main.dataset.ferme;
    }
    if (rubrique && off(rubrique) && main && !main.dataset.ferme) {
      main.dataset.ferme = '1';
      contenuOriginal = [...main.childNodes];
      main.innerHTML ='<section class="page-fermee"><div class="container"><p class="kicker">Page indisponible</p><h1 class="h2">Cette page n’est pas disponible pour le moment.</h1><p class="lead">Notre équipe reste joignable 24h/24 pour répondre à votre demande.</p><div class="ac-hero__actions"><a class="btn btn--gold" href="devis">Demander un devis</a><a class="btn btn--outline" href="tel:+33611678625">06 11 67 86 25</a><a class="btn btn--outline" href="/">Retour à l’accueil</a></div></div></section>';
    }
    // Prix
    const t = c.tarifs || {};
    const fmt2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
    document.querySelectorAll('[data-prix]').forEach((el) => {
      const v = t[el.dataset.prix];
      if (typeof v !== 'number') return;
      el.textContent = el.dataset.dec === '2' ? fmt2.format(v) : (Number.isInteger(v) ? fmt.format(v) : fmt2.format(v));
    });
    // Accueil : textes (les [crochets] du titre sont mis en valeur) et image
    const a = c.accueil || {};
    document.querySelectorAll('[data-accueil]').forEach((el) => {
      const v = a[el.dataset.accueil];
      if (typeof v !== 'string' || !v.trim()) return;
      if (el.dataset.applique === v) return; // déjà affiché : on ne touche pas (animation du titre en cours)
      el.dataset.applique = v;
      if (el.dataset.accueil !== 'titre') { el.textContent = v; return; }
      el.replaceChildren(...v.split(/(\[[^\]]*\])/).filter(Boolean).map((p) => {
        if (!/^\[.*\]$/.test(p)) return document.createTextNode(p);
        const em = document.createElement('em'); em.textContent = p.slice(1, -1); return em;
      }));
    });
    document.querySelectorAll('.ac-hero').forEach((el) => el.classList.toggle('ac-hero--logo', a.visuel === 'logo'));
    document.dispatchEvent(new CustomEvent('bda:contenu', { detail: c }));
  }

  reglagesSite();
  navigation();
  menusDeroulants();
  reveal();
  effets();
  misc();
})();
