/* Page Entreprises : étude du besoin (arrive dans l'admin, « Demandes reçues ») */
(() => {
  const form = document.querySelector('[data-proposition]');
  if (!form) return;
  const erreur = form.querySelector('.rappel__erreur');
  const bouton = form.querySelector('button[type="submit"]');
  const merci = document.querySelector('.ent-merci');
  // Langue de la page (assets/js/i18n.js sur /en/ et /ar/) ; la demande envoyée au gérant reste en français
  const T = window.T || ((s) => s);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const val = (k) => String(d.get(k) || '').trim();
    const liste = (k) => d.getAll(k).map(String).join(', ');
    const montrer = (msg, champ) => {
      erreur.textContent = msg; erreur.hidden = false;
      form.querySelectorAll('.is-invalid').forEach((x) => x.classList.remove('is-invalid'));
      if (champ) { const el = form.elements[champ]; el.closest('.ent-champ')?.classList.add('is-invalid'); el.focus(); }
    };
    if (!val('societe')) return montrer(T('Indiquez le nom de votre société.'), 'societe');
    if (!val('nom')) return montrer(T('Indiquez votre nom et prénom.'), 'nom');
    if (val('tel').replace(/\D/g, '').length < 9) return montrer(T('Indiquez un numéro de téléphone valide.'), 'tel');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) return montrer(T('Indiquez une adresse e-mail valide.'), 'email');
    if (!val('site')) return montrer(T('Choisissez le type d’établissement.'), 'site');
    if (!val('lieu')) return montrer(T('Indiquez la ville ou le code postal du site.'), 'lieu');
    if (!val('besoin')) return montrer(T('Choisissez le type de mission.'), 'besoin');
    erreur.hidden = true;
    form.querySelectorAll('.is-invalid').forEach((x) => x.classList.remove('is-invalid'));
    bouton.disabled = true;
    try {
      const r = await fetch('/api/demande.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'Prestation': 'Proposition entreprise',
          'Nom / Société': `${val('societe')} (${val('nom')})`,
          'Fonction': val('fonction'),
          'Téléphone': val('tel'),
          'Email': val('email'),
          'Secteur': val('site'),
          'Lieu': val('lieu'),
          'Prestations souhaitées': liste('prestation') || 'Non précisé',
          'Fréquence': val('besoin'),
          'Nombre d’agents': val('agents'),
          'Horaires': liste('horaires') || 'Non précisé',
          'Démarrage': val('debut'),
          'Contact préféré': val('contact'),
          'Détails': val('message'),
          ...(window.LANGUE && window.LANGUE !== 'fr' ? { 'Langue du visiteur': window.LANGUE === 'ar' ? 'Arabe' : 'Anglais' } : {}),
          site_web: val('site_web'),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.erreur || T('Envoi impossible pour le moment.'));
      form.hidden = true;
      merci.hidden = false;
      merci.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      montrer(`${err.message} ${T('Vous pouvez aussi nous appeler au 06 11 67 86 25.')}`);
    }
    bouton.disabled = false;
  });
  form.addEventListener('input', (e) => e.target.closest('.ent-champ')?.classList.remove('is-invalid'));
})();
