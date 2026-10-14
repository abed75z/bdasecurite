/* Page Entreprises : étude du besoin (arrive dans l'admin, « Demandes reçues ») */
(() => {
  const form = document.querySelector('[data-proposition]');
  if (!form) return;
  const erreur = form.querySelector('.rappel__erreur');
  const bouton = form.querySelector('button[type="submit"]');
  const merci = document.querySelector('.ent-merci');

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
    if (!val('societe')) return montrer('Indiquez le nom de votre société.', 'societe');
    if (!val('nom')) return montrer('Indiquez votre nom et prénom.', 'nom');
    if (val('tel').replace(/\D/g, '').length < 9) return montrer('Indiquez un numéro de téléphone valide.', 'tel');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) return montrer('Indiquez une adresse e-mail valide.', 'email');
    if (!val('site')) return montrer('Choisissez le type d’établissement.', 'site');
    if (!val('lieu')) return montrer('Indiquez la ville ou le code postal du site.', 'lieu');
    if (!val('besoin')) return montrer('Choisissez le type de mission.', 'besoin');
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
          site_web: val('site_web'),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.erreur || 'Envoi impossible pour le moment.');
      form.hidden = true;
      merci.hidden = false;
      merci.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      montrer(`${err.message} Vous pouvez aussi nous appeler au 06 11 67 86 25.`);
    }
    bouton.disabled = false;
  });
  form.addEventListener('input', (e) => e.target.closest('.ent-champ')?.classList.remove('is-invalid'));
})();
