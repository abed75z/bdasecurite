/* =========================================================
   RECRUTEMENT — formulaire de candidature
   Les candidatures arrivent par email via FormSubmit.co,
   à la même adresse que les demandes de devis.
   ========================================================= */
const RECRUT_CONFIG = {
  endpoint: 'https://formsubmit.co/ajax/bdasecurite@gmail.com',
  extraFields: { _template: 'table', _captcha: 'false' },
  cvEmail: 'bdasecurite@gmail.com',
  admin: '/api/candidature.php', // copie de chaque candidature dans l'espace admin
};

const envoyerJson = (url, payload, estOk) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify(payload),
}).then(async (res) => {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !estOk(json)) throw new Error(json.message || json.erreur || `HTTP ${res.status}`);
});

(() => {
  const card = document.querySelector('.apply-card');
  const form = document.getElementById('candidature-form');
  if (!form || !card) return;
  const f = (id) => form.querySelector(`#${id}`);
  const poste = f('c-poste');
  const errorBox = form.querySelector('.step-error');
  const submit = form.querySelector('[type="submit"]');

  /* ---------- Boutons « Postuler » des offres : pré-remplit le poste ---------- */
  document.querySelectorAll('[data-job]').forEach((btn) => btn.addEventListener('click', () => {
    poste.value = btn.dataset.job;
    poste.closest('.field').classList.remove('is-invalid');
  }));
  const fromUrl = new URLSearchParams(location.search).get('poste');
  if (fromUrl && [...poste.options].some((o) => o.value === fromUrl)) poste.value = fromUrl;

  /* ---------- Validation ---------- */
  const setError = (el, on) => { el.closest('.field, .check').classList.toggle('is-invalid', on); if (on) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); };
  const showError = (msg) => { errorBox.querySelector('span').textContent = msg || ''; errorBox.classList.toggle('is-visible', !!msg); };

  function validate() {
    const checks = [
      [poste, !!poste.value],
      [f('c-nom'), f('c-nom').value.trim().length >= 2],
      [f('c-tel'), /^(\+|00)?\d{9,15}$/.test(f('c-tel').value.replace(/[\s.\-()]/g, ''))],
      [f('c-email'), /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f('c-email').value.trim())],
      [f('c-carte'), !!f('c-carte').value],
      [f('c-exp'), !!f('c-exp').value],
      [f('c-consent'), f('c-consent').checked],
    ];
    let first = null;
    checks.forEach(([el, ok]) => { setError(el, !ok); if (!ok && !first) first = el; });
    if (first) {
      showError('Merci de compléter les champs indiqués en rouge.');
      first.focus({ preventScroll: true });
      first.closest('.field, .check').scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
    showError('');
    return true;
  }
  form.addEventListener('input', (e) => { if (e.target.closest('.field.is-invalid')) setError(e.target, false); });
  form.addEventListener('change', (e) => { if (e.target.closest('.field.is-invalid, .check.is-invalid')) setError(e.target, false); });

  /* ---------- Envoi ---------- */
  const setLoading = (on) => { submit.classList.toggle('is-loading', on); submit.disabled = on; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (form.querySelector('.hp input').value) return; // robot

    const dispo = [...form.querySelectorAll('input[name="dispo"]:checked')].map((i) => i.value).join(', ') || 'Non précisé';
    const nom = f('c-nom').value.trim();
    const payload = {
      'Poste': poste.value,
      'Nom et prénom': nom,
      'Téléphone': f('c-tel').value.trim(),
      'Email': f('c-email').value.trim(),
      'Ville': f('c-ville').value.trim() || 'Non précisée',
      'Carte professionnelle': f('c-carte').value,
      'N° de carte': f('c-num').value.trim() || 'Non précisé',
      'Expérience': f('c-exp').value,
      'Disponibilités': dispo,
      'Permis B': f('c-permis').checked ? 'Oui' : 'Non',
      'Lien CV / LinkedIn': f('c-cv').value.trim() || 'Non fourni',
      'Message': f('c-message').value.trim() || '—',
      'Consentement': 'Oui',
      _subject: `Nouvelle candidature — ${poste.value} — ${nom}`,
      _replyto: f('c-email').value.trim(),
      ...RECRUT_CONFIG.extraFields,
    };

    setLoading(true);
    showError('');
    try {
      // Envoi en parallèle : email (FormSubmit) + espace admin. Un seul des deux suffit.
      const [rEmail, rAdmin] = await Promise.allSettled([
        envoyerJson(RECRUT_CONFIG.endpoint, payload, (j) => j.success !== false && j.success !== 'false'),
        RECRUT_CONFIG.admin ? envoyerJson(RECRUT_CONFIG.admin, payload, (j) => j.ok) : Promise.reject(new Error('admin désactivé')),
      ]);
      if (rEmail.status === 'rejected' && rAdmin.status === 'rejected') throw rEmail.reason;

      // Écran de confirmation
      card.querySelector('[data-done-name]').textContent = nom.split(' ')[0];
      card.querySelector('[data-done-job]').textContent = poste.value;
      const subject = encodeURIComponent(`CV — ${poste.value} — ${nom}`);
      card.querySelector('[data-cv-link]').href = `mailto:${RECRUT_CONFIG.cvEmail}?subject=${subject}`;
      card.classList.add('is-done');
      card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (err) {
      console.error('[Recrutement] Échec de l\'envoi :', err);
      showError(/activat/i.test(err.message)
        ? 'Le formulaire doit d\'abord être activé : cliquez sur « Activate Form » dans l\'email reçu de FormSubmit, puis renvoyez la candidature.'
        : 'L\'envoi a échoué. Vérifiez votre connexion et réessayez, ou appelez-nous directement.');
    } finally {
      setLoading(false);
    }
  });
})();
