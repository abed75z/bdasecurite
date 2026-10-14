/* =========================================================
   RECRUTEMENT — questionnaire de candidature
   Les candidatures arrivent par email via FormSubmit.co
   et dans l'espace admin (Candidatures).
   ========================================================= */
const RECRUT_CONFIG = {
  endpoint: 'https://formsubmit.co/ajax/bdasecurite@gmail.com',
  extraFields: { _template: 'table', _captcha: 'false' },
  cvEmail: 'contact@bdasecurite.com',
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
  const errorBox = form.querySelector('.step-error');
  const submit = form.querySelector('[type="submit"]');
  const postes = form.querySelector('[data-champ="poste"]');
  const blocSecu = form.querySelector('[data-pour="securite"]');
  const blocVtc = form.querySelector('[data-pour="vtc"]');

  const poste = () => form.querySelector('input[name="poste"]:checked')?.value || '';
  const estVtc = () => /chauffeur/i.test(poste());

  /* ---------- Le bloc « carte professionnelle » suit le poste choisi ---------- */
  const majBlocs = () => {
    blocSecu.hidden = !poste() || estVtc();
    blocVtc.hidden = !estVtc();
  };
  form.querySelectorAll('input[name="poste"]').forEach((r) => r.addEventListener('change', () => { postes.classList.remove('is-invalid'); majBlocs(); }));
  const fromUrl = (new URLSearchParams(location.search).get('poste') || '').toLowerCase();
  if (fromUrl) {
    const r = [...form.querySelectorAll('input[name="poste"]')].find((x) => (/vtc|chauffeur/.test(fromUrl) && /Chauffeur/.test(x.value)) || (/rapproch|garde/.test(fromUrl) && /Garde/.test(x.value)) || (/agent|aps|ssiap|s[ée]cu/.test(fromUrl) && /Agent/.test(x.value)));
    if (r) r.checked = true;
  }
  majBlocs();

  /* ---------- Validation ---------- */
  const setError = (el, on) => { el.closest('.rc-champ, .rc-accord, .rc-postes')?.classList.toggle('is-invalid', on); if (on) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); };
  const showError = (msg) => { errorBox.querySelector('span').textContent = msg || ''; errorBox.classList.toggle('is-visible', !!msg); };
  const rempli = (id) => !!f(id).value.trim();

  function validate() {
    const checks = [
      [form.querySelector('input[name="poste"]'), !!poste()],
      [f('c-nom'), f('c-nom').value.trim().length >= 2],
      [f('c-prenom'), f('c-prenom').value.trim().length >= 2],
      [f('c-naissance'), rempli('c-naissance')],
      [f('c-ville'), rempli('c-ville')],
      [f('c-tel'), /^(\+|00)?\d{9,15}$/.test(f('c-tel').value.replace(/[\s.\-()]/g, ''))],
      [f('c-email'), /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f('c-email').value.trim())],
      ...(estVtc()
        ? [[f('c-carte-vtc'), rempli('c-carte-vtc')], [f('c-anc-permis'), rempli('c-anc-permis')], [f('c-vehicule-vtc'), rempli('c-vehicule-vtc')]]
        : [[f('c-carte-cnaps'), rempli('c-carte-cnaps')]]),
      [f('c-exp'), rempli('c-exp')],
      [f('c-permis'), rempli('c-permis')],
      [f('c-consent'), f('c-consent').checked],
    ];
    let first = null;
    checks.forEach(([el, ok]) => { setError(el, !ok); if (!ok && !first) first = el; });
    if (first) {
      showError('Merci de compléter les champs indiqués en rouge.');
      first.focus({ preventScroll: true });
      first.closest('.rc-champ, .rc-accord, .rc-postes').scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
    showError('');
    return true;
  }
  form.addEventListener('input', (e) => { if (e.target.closest('.is-invalid')) setError(e.target, false); });
  form.addEventListener('change', (e) => { if (e.target.closest('.is-invalid')) setError(e.target, false); });

  /* ---------- Envoi ---------- */
  const setLoading = (on) => { submit.classList.toggle('is-loading', on); submit.disabled = on; };
  const cases = (nom, defaut = 'Non précisé') => [...form.querySelectorAll(`input[name="${nom}"]:checked`)].map((i) => i.value).join(', ') || defaut;
  const dateFr = (id) => { const v = f(id).value; return v ? v.split('-').reverse().join('/') : ''; };
  const txt = (id, defaut = 'Non précisé') => f(id).value.trim() || defaut;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (form.querySelector('.hp input').value) return; // robot

    const prenom = f('c-prenom').value.trim();
    const nom = `${prenom} ${f('c-nom').value.trim()}`;
    const vtc = estVtc();
    const carte = vtc
      ? { 'Carte professionnelle': `Carte VTC : ${f('c-carte-vtc').value}`, 'N° de carte': txt('c-num-vtc'), 'Fin de validité de la carte': dateFr('c-fin-vtc') || 'Non précisée', 'Permis B depuis': f('c-anc-permis').value, 'Véhicule VTC personnel': f('c-vehicule-vtc').value, 'Modèle du véhicule': txt('c-modele') }
      : { 'Carte professionnelle': `Carte CNAPS : ${f('c-carte-cnaps').value}`, 'N° de carte': txt('c-num-cnaps'), 'Fin de validité de la carte': dateFr('c-fin-cnaps') || 'Non précisée', 'Mentions de la carte': cases('mention'), 'Diplômes et formations': cases('diplome', 'Aucun indiqué') };
    const payload = {
      'Poste': poste(),
      'Nom et prénom': nom,
      'Date de naissance': dateFr('c-naissance'),
      'Téléphone': f('c-tel').value.trim(),
      'Email': f('c-email').value.trim(),
      'Ville': f('c-ville').value.trim(),
      ...carte,
      'Expérience': f('c-exp').value,
      'Langues': txt('c-langues'),
      'Derniers postes': txt('c-parcours'),
      'Contrat recherché': cases('contrat'),
      'Disponibilités': cases('dispo'),
      'Disponible à partir du': dateFr('c-debut') || 'Non précisé',
      'Permis B': f('c-permis').value,
      'Lien CV / LinkedIn': txt('c-cv', 'Non fourni'),
      'Message': txt('c-message', '—'),
      'Consentement': 'Oui',
      _subject: `Nouvelle candidature — ${poste()} — ${nom}`,
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
      card.querySelector('[data-done-name]').textContent = prenom;
      card.querySelector('[data-done-job]').textContent = poste();
      const subject = encodeURIComponent(`CV — ${poste()} — ${nom}`);
      card.querySelector('[data-cv-link]').href = `mailto:${RECRUT_CONFIG.cvEmail}?subject=${subject}`;
      card.classList.add('is-done');
      card.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (err) {
      console.error('[Recrutement] Échec de l\'envoi :', err);
      showError(/activat/i.test(err.message)
        ? 'Le formulaire doit d\'abord être activé : cliquez sur « Activate Form » dans l\'email reçu de FormSubmit, puis renvoyez la candidature.'
        : 'L\'envoi a échoué. Vérifiez votre connexion et réessayez, ou appelez-nous au 06 11 67 86 25.');
    } finally {
      setLoading(false);
    }
  });
})();
