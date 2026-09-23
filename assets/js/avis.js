/* =========================================================
   AVIS CLIENTS — affichage et dépôt d'avis
   (la configuration se trouve dans assets/js/avis-data.js)
   ========================================================= */

(() => {
  const $ = (s) => document.querySelector(s);
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>';
  const starsHtml = (n) => Array.from({ length: 5 }, (_, i) => STAR.replace('<svg', `<svg class="${i < Math.round(n) ? '' : 'off'}"`)).join('');
  const colors = ['79, 107, 255', '139, 92, 246', '212, 169, 79', '34, 199, 240', '224, 71, 158', '62, 207, 142'];

  /* ---------- Affichage des avis publiés ---------- */
  const list = $('[data-avis-list]');
  const empty = $('[data-avis-empty]');
  const moreBtn = $('[data-avis-more]');
  let tous = [], affiches = 0;

  function resume(avis) {
    const n = avis.length;
    const moyenne = n ? avis.reduce((s, a) => s + a.note, 0) / n : 0;
    $('[data-avg]').textContent = n ? moyenne.toFixed(1).replace('.', ',') : '—';
    $('[data-avg-stars]').innerHTML = starsHtml(moyenne);
    $('[data-avg-count]').textContent = n ? `${n} avis publié${n > 1 ? 's' : ''}` : 'Aucun avis publié pour le moment';
    document.querySelectorAll('[data-bar]').forEach((bar) => {
      const note = +bar.dataset.bar;
      const c = avis.filter((a) => a.note === note).length;
      bar.querySelector('i').style.setProperty('--v', n ? (c / n).toFixed(3) : 0);
      bar.querySelector('b').textContent = c;
    });
  }

  function carte(a, i) {
    const el = document.createElement('article');
    el.className = 'rv-card';
    el.style.setProperty('--i', i % AVIS_CONFIG.parPage);
    el.style.setProperty('--c', colors[(a.nom.charCodeAt(0) || 0) % colors.length]);
    const date = a.date ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(a.date)) : '';
    el.innerHTML = `<div class="rv-card__head"><span class="rv-card__av"></span><div class="rv-card__who"><b></b><small></small></div></div><div class="stars" aria-label="${a.note} sur 5">${starsHtml(a.note)}</div><p></p>`;
    el.querySelector('.rv-card__av').textContent = (a.nom.trim()[0] || '?').toUpperCase();
    el.querySelector('b').textContent = a.nom;
    el.querySelector('small').textContent = date;
    el.querySelector('p').textContent = a.texte;
    if (a.prestation) {
      const tag = document.createElement('span');
      tag.className = 'rv-card__tag';
      tag.textContent = a.prestation;
      el.appendChild(tag);
    }
    return el;
  }

  function afficherPlus() {
    const suite = tous.slice(affiches, affiches + AVIS_CONFIG.parPage);
    suite.forEach((a, i) => list.appendChild(carte(a, affiches + i)));
    affiches += suite.length;
    moreBtn.hidden = affiches >= tous.length;
  }

  function afficher(avis) {
    list.innerHTML = '';
    tous = avis; affiches = 0;
    resume(avis);
    empty.hidden = avis.length > 0;
    afficherPlus();
  }

  async function charger() {
    if (!list) return;
    if (!AVIS_CONFIG.endpoint) return afficher([]);
    // 1) Affichage immédiat des derniers avis connus, 2) mise à jour dès que Google répond
    const connus = AvisData.memoire();
    if (connus) afficher(connus);
    else list.innerHTML = '<div class="rv-skeleton"></div><div class="rv-skeleton"></div><div class="rv-skeleton"></div>';
    try {
      const avis = await AvisData.frais();
      if (!connus || JSON.stringify(avis) !== JSON.stringify(connus)) afficher(avis);
    } catch (err) {
      console.error('[Avis] Chargement impossible :', err);
      if (!connus) {
        list.innerHTML = '';
        $('[data-avg-count]').textContent = 'Avis momentanément indisponibles, réessayez dans un instant.';
      }
    }
  }
  moreBtn?.addEventListener('click', afficherPlus);
  charger();

  /* ---------- Dépôt d'un avis ---------- */
  const form = document.getElementById('avis-form');
  if (!form) return;
  const card = form.closest('.apply-card');
  const f = (id) => form.querySelector(`#${id}`);
  const libelles = ['', 'Décevant', 'Moyen', 'Bien', 'Très bien', 'Excellent !'];
  const labelNote = form.querySelector('.star-label');
  const errorBox = form.querySelector('.step-error');
  const submit = form.querySelector('[type="submit"]');
  const compteur = form.querySelector('.counter');

  form.addEventListener('change', (e) => {
    if (e.target.name === 'note') { labelNote.textContent = libelles[+e.target.value]; e.target.closest('.field').classList.remove('is-invalid'); }
    if (e.target.id === 'a-consent') e.target.closest('.check').classList.remove('is-invalid');
  });
  form.addEventListener('input', (e) => {
    e.target.closest('.field')?.classList.remove('is-invalid');
    if (e.target.id === 'a-texte') compteur.textContent = `${e.target.value.length} / 1200`;
  });

  function valider() {
    const note = form.querySelector('input[name="note"]:checked');
    const checks = [
      [form.querySelector('.star-pick'), !!note],
      [f('a-nom'), f('a-nom').value.trim().length >= 2],
      [f('a-texte'), f('a-texte').value.trim().length >= 10],
      [f('a-email'), !f('a-email').value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f('a-email').value.trim())],
      [f('a-consent'), f('a-consent').checked],
    ];
    let premier = null;
    checks.forEach(([el, ok]) => { el.closest('.field, .check').classList.toggle('is-invalid', !ok); if (!ok && !premier) premier = el; });
    if (premier) {
      errorBox.querySelector('span').textContent = 'Merci de compléter les champs indiqués en rouge.';
      errorBox.classList.add('is-visible');
      premier.closest('.field, .check').scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
    errorBox.classList.remove('is-visible');
    return true;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!valider()) return;
    const payload = {
      nom: f('a-nom').value.trim(),
      note: +form.querySelector('input[name="note"]:checked').value,
      prestation: f('a-prestation').value,
      texte: f('a-texte').value.trim(),
      email: f('a-email').value.trim(),
      site_web: form.querySelector('.hp input').value,
    };
    if (payload.site_web) return; // robot

    submit.classList.add('is-loading'); submit.disabled = true;
    const patience = form.querySelector('.rv-wait');
    const minuteur = setTimeout(() => { if (patience) patience.hidden = false; }, 3000);
    try {
      let ok = false;
      if (AVIS_CONFIG.endpoint) {
        // Envoi « simple » (text/plain) : accepté directement par Google Apps Script
        const res = await fetch(AVIS_CONFIG.endpoint, { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json().catch(() => ({}));
        ok = res.ok && json.ok !== false;
      } else {
        const res = await fetch(AVIS_CONFIG.emailFallback, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            'Nom': payload.nom, 'Note': `${payload.note}/5`, 'Prestation': payload.prestation || '—',
            'Avis': payload.texte, 'Email': payload.email || 'Non communiqué',
            _subject: `Nouvel avis ${'★'.repeat(payload.note)} — ${payload.nom}`, _template: 'table', _captcha: 'false',
          }),
        });
        const json = await res.json().catch(() => ({}));
        ok = res.ok && json.success !== false && json.success !== 'false';
      }
      if (!ok) throw new Error('refus');
      card.querySelector('[data-done-name]').textContent = payload.nom.split(' ')[0];
      card.classList.add('is-done');
      card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (err) {
      console.error('[Avis] Échec de l\'envoi :', err);
      errorBox.querySelector('span').textContent = 'L\'envoi a échoué. Vérifiez votre connexion et réessayez.';
      errorBox.classList.add('is-visible');
    } finally {
      clearTimeout(minuteur);
      if (patience) patience.hidden = true;
      submit.classList.remove('is-loading'); submit.disabled = false;
    }
  });
})();
