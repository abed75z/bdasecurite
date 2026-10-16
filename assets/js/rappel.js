/* =========================================================
   « ÊTRE RAPPELÉ » — fenêtre : coordonnées, besoin, et moment du rappel
   (dès que possible, ou un jour des deux prochaines semaines + un créneau).
   La demande arrive dans l'admin (Demandes reçues) et par email.
   ========================================================= */
(() => {
  const fenetre = document.querySelector('dialog.rappel');
  if (!fenetre) return;
  const form = fenetre.querySelector('.rp__form');
  const merci = fenetre.querySelector('.rp__merci');
  const erreur = fenetre.querySelector('.rp__erreur');
  const bouton = fenetre.querySelector('.rp__envoyer');
  const agenda = fenetre.querySelector('.rp__agenda');
  const jours = fenetre.querySelector('.rp__jours');
  const recap = fenetre.querySelector('.rp__recap');

  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const CRENEAUX = { matin: 'le matin (9h – 12h)', midi: 'le midi (12h – 14h)', 'apres-midi': 'l’après-midi (14h – 18h)', soir: 'en soirée (18h – 21h)' };
  const jourTexte = (d) => `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
  const jourCle = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  /* ---------- Jours proposés : 14 jours à partir d'aujourd'hui (demain si la journée est finie) ---------- */
  function construireJours() {
    const maintenant = new Date();
    const demain = new Date(maintenant); demain.setDate(maintenant.getDate() + 1);
    const debut = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    if (maintenant.getHours() >= 20) debut.setDate(debut.getDate() + 1);
    jours.replaceChildren();
    for (let i = 0; i < 14; i++) {
      const d = new Date(debut); d.setDate(debut.getDate() + i);
      const nom = jourCle(d) === jourCle(maintenant) ? 'Auj.' : (jourCle(d) === jourCle(demain) ? 'Demain' : JOURS[d.getDay()].slice(0, 3) + '.');
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="jour" value="${jourCle(d)}"${i === 0 ? ' checked' : ''}><span><small>${nom}</small><b>${d.getDate()}</b><small>${MOIS_COURT[d.getMonth()]}</small></span>`;
      label.querySelector('input').dataset.texte = jourTexte(d);
      jours.append(label);
    }
    majCreneaux();
  }

  /* ---------- Aujourd'hui : les créneaux déjà passés sont grisés ---------- */
  function majCreneaux() {
    const choisi = form.querySelector('input[name="jour"]:checked');
    const auj = choisi && choisi.value === jourCle(new Date());
    const heure = new Date().getHours();
    let premier = null;
    form.querySelectorAll('input[name="creneau"]').forEach((c) => {
      c.disabled = Boolean(auj && heure >= Number(c.dataset.fin) - 1);
      if (!c.disabled && !premier) premier = c;
    });
    const actuel = form.querySelector('input[name="creneau"]:checked');
    if ((!actuel || actuel.disabled) && premier) premier.checked = true;
  }

  function majAgenda() {
    const date = form.querySelector('input[name="quand"]:checked')?.value === 'date';
    agenda.classList.toggle('is-ouvert', date);
    agenda.setAttribute('aria-hidden', String(!date));
    agenda.querySelectorAll('input').forEach((i) => { i.tabIndex = date ? 0 : -1; });
  }

  form.addEventListener('change', (e) => {
    if (e.target.name === 'quand') majAgenda();
    if (e.target.name === 'jour') majCreneaux();
  });

  const ouvrir = () => {
    form.hidden = false; merci.hidden = true; erreur.hidden = true;
    construireJours(); majAgenda();
    if (typeof fenetre.showModal === 'function') fenetre.showModal(); else fenetre.setAttribute('open', '');
    document.documentElement.classList.add('rappel-ouvert');
    setTimeout(() => form.querySelector('input[name="nom"]').focus({ preventScroll: true }), 160);
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
    const societe = String(d.get('societe') || '').trim();
    const tel = String(d.get('tel') || '').trim();
    const besoin = String(d.get('besoin') || '');
    const message = String(d.get('message') || '').trim();
    const montrer = (msg, champ) => {
      erreur.textContent = msg; erreur.hidden = false;
      if (champ) form.querySelector(`[name="${champ}"]`).focus();
    };
    if (!nom) return montrer('Indiquez votre nom.', 'nom');
    if (tel.replace(/\D/g, '').length < 9) return montrer('Indiquez un numéro de téléphone valide.', 'tel');

    let quand = 'Dès que possible';
    let phrase = 'dès que possible';
    if (d.get('quand') === 'date') {
      const j = form.querySelector('input[name="jour"]:checked');
      const c = form.querySelector('input[name="creneau"]:checked');
      if (!j || !c) return montrer('Choisissez un jour et un moment.');
      quand = `${j.dataset.texte.replace(/^./, (x) => x.toUpperCase())}, ${CRENEAUX[c.value]}`;
      phrase = `${j.dataset.texte} ${CRENEAUX[c.value]}`;
    }
    erreur.hidden = true;
    bouton.disabled = true;
    try {
      const r = await fetch('/api/demande.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'Prestation': 'Demande de rappel',
          'Nom / Société': societe ? `${nom} — ${societe}` : nom,
          'Téléphone': tel,
          'Besoin': besoin,
          'Date souhaitée': quand,
          'Message': message,
          'Détails': `Rappel demandé depuis l'accueil — besoin : ${besoin} — quand : ${quand}${message ? ` — message : ${message}` : ''}`,
          site_web: String(d.get('site_web') || ''),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.erreur || 'Envoi impossible pour le moment.');
      recap.textContent = `Un responsable vous rappelle ${phrase} au ${tel}.`;
      form.reset();
      form.hidden = true; merci.hidden = false;
    } catch (err) {
      montrer(`${err.message} Vous pouvez aussi nous appeler au 06 11 67 86 25.`);
    }
    bouton.disabled = false;
  });
})();
