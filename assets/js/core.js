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
    const starColors = ['255,255,255', '214,222,255', '190,205,255', '240,216,152'];
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
        grad.addColorStop(0, `rgba(255,248,226,${((1 - p) * 0.9).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(127,149,255,0)');
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
      if (down && y > 500 && !document.body.classList.contains('menu-open')) nav.classList.add('is-hidden');
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
    document.querySelectorAll('[data-split]').forEach(splitWords);
    const els = document.querySelectorAll('[data-reveal], [data-split]');
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

  /* ---------- Divers ---------- */
  function misc() {
    document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  sky();
  roads();
  animScopes();
  navigation();
  progress();
  reveal();
  scrollParallax();
  scenes();
  tilt();
  magnetic();
  misc();
})();
