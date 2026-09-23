/* =========================================================
   MERCI — personnalise la page avec la demande envoyée
   (chargé AVANT core.js pour que le titre soit animé mot par mot)
   ========================================================= */
(() => {
  let data = null;
  try { data = JSON.parse(sessionStorage.getItem('devis') || 'null'); } catch (_) { data = null; }

  const $ = (s) => document.querySelector(s);
  const fmtDay = (v) => {
    const [y, m, d] = v.split('-').map(Number);
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
  };

  const title = $('[data-thanks-title]');
  const lead = $('[data-thanks-lead]');
  const summary = $('[data-summary]');

  if (data && data.nom) {
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = data.nom;
    title.textContent = '';
    title.append('Merci, ', name, ' !');

    const when = data.date ? ` pour le ${fmtDay(data.date)}${data.heure ? ` à ${data.heure.replace(':', 'h')}` : ''}` : '';
    const strong = document.createElement('strong');
    strong.textContent = `« ${data.prestation} »`;
    lead.textContent = '';
    lead.append('Votre demande de devis ', strong, `${when} a bien été transmise à notre équipe. Nous l'étudions et revenons vers vous très rapidement, par téléphone ou par email.`);

    $('[data-ref]').textContent = data.ref;
    $('[data-prestation]').textContent = data.prestation;
    $('[data-date]').textContent = data.date ? fmtDay(data.date) + (data.heure ? ` · ${data.heure}` : '') : '—';
    $('[data-email]').textContent = data.email || '—';
    summary.hidden = false;

    const copy = $('[data-copy]');
    copy?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(data.ref);
        copy.classList.add('is-copied');
        copy.setAttribute('aria-label', 'Référence copiée');
        setTimeout(() => { copy.classList.remove('is-copied'); copy.setAttribute('aria-label', 'Copier la référence'); }, 1800);
      } catch (_) { /* presse-papiers indisponible */ }
    });
  }

  /* Rayons dorés qui jaillissent autour du badge */
  const badge = $('.ok-badge');
  if (badge && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const colors = ['#f3dc9c', '#ecd28f', '#c9a14a', '#a57b28', '#f3f0ea'];
    const count = 28;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      const rot = (360 / count) * i + (Math.random() * 8 - 4);
      s.style.cssText = `--rot:${rot.toFixed(0)}deg;--dist:-${(120 + Math.random() * 110).toFixed(0)}px;--c:${colors[i % colors.length]};--w:${(2 + Math.random() * 1.5).toFixed(1)}px;--h:${(10 + Math.random() * 12).toFixed(0)}px;--delay:${(0.65 + Math.random() * 0.2).toFixed(2)}s`;
      badge.appendChild(s);
    }
  }
})();
