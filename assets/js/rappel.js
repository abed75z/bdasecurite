/* =========================================================
   « ÊTRE RAPPELÉ » — petite fenêtre : nom, téléphone, secteur, créneau.
   La demande arrive dans l'admin (Demandes reçues) et par email.
   ========================================================= */
(() => {
  const fenetre = document.querySelector('dialog.rappel');
  if (!fenetre) return;
  const form = fenetre.querySelector('.rappel__form');
  const merci = fenetre.querySelector('.rappel__merci');
  const erreur = fenetre.querySelector('.rappel__erreur');
  const bouton = fenetre.querySelector('.rappel__envoyer');

  const ouvrir = () => {
    form.hidden = false; merci.hidden = true; erreur.hidden = true;
    if (typeof fenetre.showModal === 'function') fenetre.showModal(); else fenetre.setAttribute('open', '');
    document.documentElement.classList.add('rappel-ouvert');
    setTimeout(() => form.querySelector('input[name="nom"]').focus(), 120);
  };
  const fermer = () => {
    fenetre.classList.add('se-ferme');
    setTimeout(() => {
      fenetre.classList.remove('se-ferme');
      if (typeof fenetre.close === 'function') fenetre.close(); else fenetre.removeAttribute('open');
      document.documentElement.classList.remove('rappel-ouvert');
    }, 220);
  };

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-rappel]')) { e.preventDefault(); ouvrir(); }
    if (e.target.closest('[data-fermer]')) { e.preventDefault(); fermer(); }
  });
  // Clic sur le fond assombri : fermeture
  fenetre.addEventListener('click', (e) => { if (e.target === fenetre) fermer(); });
  fenetre.addEventListener('cancel', (e) => { e.preventDefault(); fermer(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const nom = String(d.get('nom') || '').trim();
    const tel = String(d.get('tel') || '').trim();
    const montrer = (msg) => { erreur.textContent = msg; erreur.hidden = false; };
    if (!nom) return montrer('Indiquez votre nom ou votre société.');
    if (tel.replace(/\D/g, '').length < 9) return montrer('Indiquez un numéro de téléphone valide.');
    erreur.hidden = true;
    bouton.disabled = true;
    try {
      const r = await fetch('/api/demande.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'Prestation': 'Demande de rappel',
          'Nom / Société': nom,
          'Téléphone': tel,
          'Secteur': String(d.get('secteur') || ''),
          'Date souhaitée': String(d.get('creneau') || ''),
          'Détails': `Rappel demandé depuis l'accueil — secteur : ${d.get('secteur')} — créneau : ${d.get('creneau')}`,
          site_web: String(d.get('site_web') || ''),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.erreur || 'Envoi impossible pour le moment.');
      form.reset();
      form.hidden = true; merci.hidden = false;
    } catch (err) {
      montrer(`${err.message} Vous pouvez aussi nous appeler au 06 11 67 86 25.`);
    }
    bouton.disabled = false;
  });
})();
