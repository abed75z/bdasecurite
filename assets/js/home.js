/* =========================================================
   HOME — effets propres à la page d'accueil
   ========================================================= */
(() => {
  const { reduced, clamp, onScroll } = window.Site;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- Bandeau défilant (vitesse liée au scroll) ---------- */
  function marquees() {
    const bands = [...document.querySelectorAll('[data-marquee]')];
    if (!bands.length || reduced) return;
    let boost = 0, dirScroll = 1, lastY = window.scrollY;
    onScroll((y) => {
      const dy = y - lastY; lastY = y;
      if (Math.abs(dy) > 0.5) dirScroll = dy > 0 ? 1 : -1;
      boost = clamp(boost + Math.abs(dy) * 0.06, 0, 6);
    });
    const state = bands.map((band) => {
      const track = band.querySelector('.marquee__track');
      const group = track.querySelector('.marquee__group');
      const s = { band, track, x: 0, gw: 0, dir: parseFloat(band.dataset.marquee) || 1, hover: false, visible: true };
      const fill = () => {
        s.gw = group.offsetWidth;
        if (!s.gw) return;
        let copies = track.children.length;
        while (s.gw * copies < window.innerWidth * 2 + s.gw) {
          const c = group.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); copies++;
        }
      };
      fill();
      document.fonts?.ready.then(fill);
      window.addEventListener('resize', fill);
      band.addEventListener('pointerenter', () => { s.hover = true; });
      band.addEventListener('pointerleave', () => { s.hover = false; });
      new IntersectionObserver(([e]) => { s.visible = e.isIntersecting; }).observe(band);
      return s;
    });
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(now - last, 50); last = now;
      boost *= 0.94;
      state.forEach((s) => {
        if (!s.visible || !s.gw) return;
        const speed = 0.05 * (1 + boost) * (s.hover ? 0.25 : 1);
        s.x -= speed * dt * s.dir * dirScroll;
        if (s.x <= -s.gw) s.x += s.gw;
        if (s.x > 0) s.x -= s.gw;
        s.track.style.transform = `translate3d(${s.x.toFixed(2)}px,0,0)`;
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- Checklist de mission (coche une à une) ---------- */
  function checklists() {
    document.querySelectorAll('[data-checklist]').forEach((list) => {
      const items = [...list.children];
      const run = async () => { for (const li of items) { await wait(reduced ? 0 : 450); li.classList.add('is-done'); } };
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); setTimeout(run, 500); } }, { threshold: 0.6 });
      io.observe(list);
    });
  }

  /* ---------- Programme « duo » qui avance avec le scroll ---------- */
  function timelines() {
    document.querySelectorAll('[data-timeline]').forEach((tl) => {
      const items = [...tl.querySelectorAll('li')];
      onScroll(() => {
        const r = tl.getBoundingClientRect(), vh = window.innerHeight;
        const p = clamp((vh * 0.8 - r.top) / (r.height + vh * 0.25), 0, 1);
        tl.style.setProperty('--p', p.toFixed(3));
        items.forEach((li, i) => li.classList.toggle('is-active', p >= i / items.length + 0.02));
      });
    });
  }

  /* ---------- Manifeste : les mots s'allument au scroll ---------- */
  function manifesto() {
    const text = document.querySelector('[data-words]');
    if (!text) return;
    const words = [];
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/([ \t\n\r]+)/).forEach((part) => {
            if (!part) return;
            if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span'); s.className = 'mw'; s.textContent = part;
            words.push(s); frag.appendChild(s);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      });
    };
    walk(text);
    if (reduced) { words.forEach((w) => w.style.setProperty('--o', 1)); return; }
    const last = new Array(words.length).fill(-1);
    onScroll(() => {
      const r = text.getBoundingClientRect(), vh = window.innerHeight;
      const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
      const n = words.length;
      words.forEach((w, i) => {
        const o = +(0.12 + 0.88 * clamp(p * (n + 4) - i, 0, 1)).toFixed(2);
        if (o !== last[i]) { last[i] = o; w.style.setProperty('--o', o); }
      });
    });
  }

  /* ---------- Processus : défilement horizontal épinglé ---------- */
  function processPin() {
    const sec = document.querySelector('.process');
    if (!sec) return;
    const track = sec.querySelector('.process__track');
    const steps = [...sec.querySelectorAll('.step')];
    const mq = window.matchMedia('(min-width: 900px) and (min-height: 620px)');
    let dist = 0;
    const setup = () => {
      const isStatic = reduced || !mq.matches;
      sec.classList.toggle('is-static', isStatic);
      if (isStatic) { sec.style.height = ''; track.style.transform = ''; steps.forEach((s) => s.classList.remove('is-active')); return; }
      dist = Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
      sec.style.height = `${window.innerHeight + dist}px`;
    };
    setup();
    document.fonts?.ready.then(setup);
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(setup, 120); });
    onScroll(() => {
      if (sec.classList.contains('is-static')) return;
      const r = sec.getBoundingClientRect();
      const range = r.height - window.innerHeight;
      const p = range > 0 ? clamp(-r.top / range, 0, 1) : 0;
      track.style.transform = `translate3d(${(-p * dist).toFixed(1)}px,0,0)`;
      sec.style.setProperty('--p', p.toFixed(4));
      const active = Math.min(steps.length - 1, Math.floor(p * steps.length));
      steps.forEach((s, i) => s.classList.toggle('is-active', i === active));
    });
  }

  /* ---------- Compteurs ---------- */
  function counters() {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const target = parseFloat(el.dataset.count);
      if (reduced) return;
      el.textContent = '0';
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now(), dur = 1800;
        const step = (now) => {
          const p = clamp((now - t0) / dur, 0, 1);
          el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, { threshold: 0.6 });
      io.observe(el);
    });
  }

  /* ---------- FAQ ---------- */
  function faq() {
    const items = [...document.querySelectorAll('.faq__item')];
    items.forEach((item) => {
      const btn = item.querySelector('.faq__q');
      const panel = item.querySelector('.faq__a');
      panel.toggleAttribute('inert', !item.classList.contains('is-open'));
      btn.addEventListener('click', () => {
        const open = !item.classList.contains('is-open');
        items.forEach((other) => {
          const state = other === item ? open : false;
          other.classList.toggle('is-open', state);
          other.querySelector('.faq__q').setAttribute('aria-expanded', String(state));
          other.querySelector('.faq__a').toggleAttribute('inert', !state);
        });
      });
    });
  }

  /* ---------- Bandeau avis : note moyenne + préchargement de la page Avis ---------- */
  function reviewsBand() {
    const el = document.querySelector('[data-rating]');
    if (!el || typeof AvisData === 'undefined') return;
    const montrer = (avis) => {
      if (!avis || !avis.length) return;
      const m = AvisData.moyenne(avis).toFixed(1).replace('.', ',');
      el.textContent = `${m}/5 · ${avis.length} avis client${avis.length > 1 ? 's' : ''}`;
      el.hidden = false;
    };
    montrer(AvisData.memoire());
    const charger = () => AvisData.frais().then(montrer).catch(() => { /* réseau indisponible */ });
    if ('requestIdleCallback' in window) requestIdleCallback(charger, { timeout: 4000 }); else setTimeout(charger, 2500);
  }

  marquees();
  reviewsBand();
  checklists();
  timelines();
  manifesto();
  processPin();
  counters();
  faq();
})();
