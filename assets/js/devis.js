/* =========================================================
   DEVIS — page « Demander un devis » (questionnaire en 4 étapes)
   ========================================================= */

/* ====== CONFIGURATION DE L'ENVOI ============================
   Les demandes sont envoyées par email via FormSubmit.co
   (gratuit, sans inscription) à l'adresse ci-dessous.

   ACTIVATION (une seule fois) : à la toute première demande envoyée
   depuis le site en ligne, FormSubmit envoie un email « Activate Form »
   à cette adresse. Cliquez sur le bouton : toutes les demandes
   suivantes arriveront directement dans la boîte mail.

   Astuce anti-spam : après l'activation, FormSubmit fournit un alias
   (ex. 'a1b2c3d4…') à mettre à la place de l'adresse dans l'endpoint.

   Laisser endpoint vide = MODE DÉMO (aucun envoi).
   ============================================================ */
const DEVIS_CONFIG = {
  endpoint: 'https://formsubmit.co/ajax/bdasecurite@gmail.com',
  extraFields: { _template: 'table', _captcha: 'false' },
  redirectTo: 'merci',
};

(() => {
  const form = document.getElementById('devis-form');
  if (!form) return;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const card = form.closest('.form-card');
  const body = form.querySelector('.form-card__body');
  const steps = [...form.querySelectorAll('.step-panel')];
  const stepper = [...form.querySelectorAll('.stepper button')];
  const bar = form.querySelector('.form-card__progress span');
  const btnPrev = form.querySelector('[data-prev]');
  const btnNext = form.querySelector('[data-next]');
  const btnSubmit = form.querySelector('[data-submit]');
  const counter = form.querySelector('.form-card__count');
  const f = (id) => form.querySelector(`#${id}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let current = 0, maxReached = 0;

  /* ---------- Dates ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDay = (v) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDay = (v) => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(parseDay(v));
  f('f-date').min = isoDay(new Date());

  /* ---------- Exemples adaptés à la prestation choisie ---------- */
  const examples = {
    securite: 'Ex. : lieu de la mission, dates et horaires, nombre d\'agents souhaité, type d\'événement, nombre d\'invités…',
    vtc: 'Ex. : adresse de départ et d\'arrivée, heure de prise en charge, nombre de passagers et de bagages, numéro de vol ou de train…',
    surmesure: 'Ex. : programme de la journée ou de la soirée, lieux, nombre de personnes à accompagner, niveau de discrétion souhaité…',
  };
  const selected = () => form.querySelector('input[name="prestation"]:checked');
  const updateExample = () => { f('f-details').placeholder = examples[selected()?.dataset.group] || examples.surmesure; };

  /* ---------- Erreurs ---------- */
  const fieldOf = (el) => el.closest('.field, .check');
  const setError = (el) => { fieldOf(el).classList.add('is-invalid'); el.setAttribute('aria-invalid', 'true'); };
  const clearError = (el) => { fieldOf(el)?.classList.remove('is-invalid'); el.removeAttribute('aria-invalid'); };
  const stepError = (i, msg) => {
    const box = steps[i].querySelector('.step-error');
    if (!box) return;
    box.querySelector('span').textContent = msg || '';
    box.classList.toggle('is-visible', !!msg);
  };

  /* ---------- Validation d'une étape ---------- */
  function validate(i) {
    let firstBad = null;
    const fail = (el) => { setError(el); if (!firstBad) firstBad = el; };
    stepError(i, '');
    if (i === 0 && !selected()) {
      stepError(0, 'Choisissez une prestation pour continuer.');
      firstBad = form.querySelector('input[name="prestation"]');
    }
    if (i === 1) {
      const d = f('f-date');
      if (!d.value || d.value < d.min) fail(d);
    }
    if (i === 2) {
      const nom = f('f-nom'), tel = f('f-tel'), mail = f('f-email');
      if (nom.value.trim().length < 2) fail(nom);
      if (!/^(\+|00)?\d{9,15}$/.test(tel.value.replace(/[\s.\-()]/g, ''))) fail(tel);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail.value.trim())) fail(mail);
    }
    if (i === 3) {
      const det = f('f-details'), ok = f('f-consent');
      if (det.value.trim().length < 10) fail(det);
      if (!ok.checked) { fail(ok); stepError(3, 'Merci de cocher la case d\'accord pour envoyer votre demande.'); }
    }
    if (firstBad) { firstBad.focus({ preventScroll: true }); firstBad.closest('.field, .check, .step-panel')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return false; }
    return true;
  }

  /* ---------- Navigation entre les étapes ---------- */
  function goTo(i, dir) {
    if (i !== current) {
      body.dataset.dir = dir || (i > current ? 'next' : 'prev');
      steps[current].classList.remove('is-active');
      steps[i].classList.add('is-active');
      current = i;
      maxReached = Math.max(maxReached, i);
      // Remet le haut du formulaire en vue (utile sur téléphone)
      const top = card.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.5) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
      // Sur ordinateur uniquement : focus sur le premier champ (évite d'ouvrir le clavier sur mobile)
      if (finePointer) {
        const target = steps[i].querySelector('.field input, textarea');
        if (target) setTimeout(() => target.focus({ preventScroll: true }), 50);
      }
    }
    updateUI();
  }
  const next = () => { if (validate(current) && current < steps.length - 1) goTo(current + 1, 'next'); };

  function updateUI() {
    const last = current === steps.length - 1;
    btnPrev.hidden = current === 0;
    btnNext.hidden = last;
    btnSubmit.hidden = !last;
    counter.textContent = `Étape ${current + 1} sur ${steps.length}`;
    bar.style.transform = `scaleX(${(current + 1) / steps.length})`;
    stepper.forEach((b, i) => {
      b.classList.toggle('is-current', i === current);
      b.classList.toggle('is-done', i !== current && i <= maxReached);
      b.disabled = i > maxReached;
      if (i === current) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    if (last) fillRecap();
  }

  function fillRecap() {
    const s = selected(), d = f('f-date').value, h = f('f-heure').value, nom = f('f-nom').value.trim();
    const recap = form.querySelector('.recap');
    recap.textContent = '';
    const chip = (icon, txt) => {
      if (!txt) return;
      const span = document.createElement('span');
      span.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-${icon}"/></svg>`;
      span.append(txt);
      recap.appendChild(span);
    };
    chip('star', s?.value);
    chip('calendar', d ? fmtDay(d) + (h ? ` · ${h}` : '') : '');
    chip('user', nom);
  }

  /* ---------- Interactions ---------- */
  btnNext.addEventListener('click', next);
  btnPrev.addEventListener('click', () => { if (current > 0) goTo(current - 1, 'prev'); });
  stepper.forEach((b, i) => b.addEventListener('click', () => {
    if (i < current) return goTo(i, 'prev');
    for (let s = current; s < i; s++) if (!validate(s)) return goTo(s);
    goTo(i, 'next');
  }));
  form.addEventListener('input', (e) => { if (e.target.matches('.input')) clearError(e.target); });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'prestation') { stepError(0, ''); updateExample(); }
    if (e.target.type === 'checkbox') { clearError(e.target); if (e.target.id === 'f-consent') stepError(3, ''); }
  });
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    if (current < steps.length - 1) next(); else form.requestSubmit();
  });

  /* ---------- Prestation pré-sélectionnée : devis?service=transfert ---------- */
  const service = new URLSearchParams(location.search).get('service');
  const pre = service && form.querySelector(`input[name="prestation"][data-id="${CSS.escape(service)}"]`);
  if (pre) pre.checked = true;

  /* ---------- Envoi ---------- */
  const makeRef = () => {
    const d = new Date();
    return `DV-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`;
  };
  const setLoading = (on) => { btnSubmit.classList.toggle('is-loading', on); btnSubmit.disabled = on; btnPrev.disabled = on; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    for (let i = 0; i < steps.length; i++) if (!validate(i)) { goTo(i); return; }

    const ref = makeRef();
    const summary = {
      ref,
      prestation: selected().value,
      date: f('f-date').value,
      heure: f('f-heure').value,
      nom: f('f-nom').value.trim(),
      email: f('f-email').value.trim(),
    };
    const done = () => {
      try { sessionStorage.setItem('devis', JSON.stringify(summary)); } catch (_) { /* stockage indisponible */ }
      window.location.href = DEVIS_CONFIG.redirectTo;
    };

    // Champ piège anti-robots rempli : on ne transmet rien
    if (form.querySelector('.hp input').value) return done();

    // Contenu de l'email reçu (libellés lisibles)
    const payload = {
      'Référence': ref,
      'Prestation': summary.prestation,
      'Date souhaitée': new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseDay(summary.date)),
      'Heure': summary.heure || 'Non précisée',
      'Dates flexibles': f('f-flex').checked ? 'Oui' : 'Non',
      'Nom / Société': summary.nom,
      'Téléphone': f('f-tel').value.trim(),
      'Email': summary.email,
      'Détails': f('f-details').value.trim(),
      'Consentement': 'Oui',
      _subject: `Nouvelle demande de devis ${ref} — ${summary.prestation}`,
      _replyto: summary.email,
      ...DEVIS_CONFIG.extraFields,
    };

    setLoading(true);
    stepError(3, '');
    try {
      if (DEVIS_CONFIG.endpoint) {
        const res = await fetch(DEVIS_CONFIG.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false || json.success === 'false') throw new Error(json.message || `HTTP ${res.status}`);
      } else {
        console.info('[Devis] MODE DÉMO — aucune demande envoyée. Renseignez DEVIS_CONFIG.endpoint dans assets/js/devis.js.', payload);
        await wait(700);
      }
      done();
    } catch (err) {
      console.error('[Devis] Échec de l\'envoi :', err);
      setLoading(false);
      stepError(3, /activat/i.test(err.message)
        ? 'Le formulaire doit d\'abord être activé : cliquez sur « Activate Form » dans l\'email reçu de FormSubmit, puis renvoyez la demande.'
        : 'L\'envoi a échoué. Vérifiez votre connexion et réessayez, ou appelez-nous directement.');
    }
  });

  // Retour arrière depuis la page merci (cache du navigateur) : on réactive le bouton
  window.addEventListener('pageshow', () => setLoading(false));

  updateExample();
  updateUI();
})();
