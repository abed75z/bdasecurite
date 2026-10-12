/* Page Entreprises : demande de proposition (arrive dans l'admin, « Demandes reçues ») */
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
    const montrer = (msg) => { erreur.textContent = msg; erreur.hidden = false; };
    if (!val('societe')) return montrer('Indiquez le nom de votre société.');
    if (!val('nom')) return montrer('Indiquez votre nom.');
    if (val('tel').replace(/\D/g, '').length < 9) return montrer('Indiquez un numéro de téléphone valide.');
    if (val('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('email'))) return montrer('L’adresse e-mail semble incomplète.');
    erreur.hidden = true;
    bouton.disabled = true;
    try {
      const r = await fetch('/api/demande.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'Prestation': 'Proposition entreprise',
          'Nom / Société': `${val('societe')} (${val('nom')})`,
          'Téléphone': val('tel'),
          'Email': val('email'),
          'Secteur': val('site'),
          'Fréquence': val('besoin'),
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
})();
