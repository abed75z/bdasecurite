/* =========================================================
   « ÊTRE RAPPELÉ » — fenêtre : coordonnées, besoin, et moment du rappel
   (dès que possible, ou un jour choisi dans un calendrier + un créneau).
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
  const recap = fenetre.querySelector('.rp__recap');
  const resume = fenetre.querySelector('.rp__resume');
  const titreMois = fenetre.querySelector('.rp__cal-mois');
  const grille = fenetre.querySelector('.rp__cal-grille');
  const champJour = form.querySelector('input[name="jour"]');
  const navs = fenetre.querySelectorAll('.rp__cal-nav');

  // Langue de la page (assets/js/i18n.js sur /en/ et /ar/) ; la demande envoyée au gérant reste en français
  const T = window.T || ((s, v) => (v ? s.replace(/\{(\w+)\}/g, (_, k) => (v[k] === undefined ? '' : v[k])) : s));
  const LOC = window.LOCALE || 'fr-FR';
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const CRENEAUX = { matin: 'le matin (9h – 12h)', midi: 'le midi (12h – 14h)', 'apres-midi': 'l’après-midi (14h – 18h)', soir: 'en soirée (18h – 21h)' };
  const CRENEAUX_COURT = { matin: 'matin, 9h – 12h', midi: 'midi, 12h – 14h', 'apres-midi': 'après-midi, 14h – 18h', soir: 'soirée, 18h – 21h' };
  const JOURS_MAX = 60; // on peut choisir un jour dans les deux prochains mois
  const jourTexte = (d) => `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
  // Même date, dans la langue de la page (affichage)
  const jourAffiche = (d) => (LOC === 'fr-FR' ? jourTexte(d) : d.toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long' }));
  const cle = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const depuisCle = (c) => { const [a, m, j] = c.split('-').map(Number); return new Date(a, m - 1, j); };

  let premier, dernier, moisAffiche, choisi;

  /* ---------- Calendrier ---------- */
  function bornes() {
    const maintenant = new Date();
    premier = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    if (maintenant.getHours() >= 20) premier.setDate(premier.getDate() + 1); // journée finie : à partir de demain
    dernier = new Date(premier); dernier.setDate(premier.getDate() + JOURS_MAX);
  }

  function dessinerMois() {
    const an = moisAffiche.getFullYear(), m = moisAffiche.getMonth();
    titreMois.textContent = LOC === 'fr-FR' ? `${MOIS[m]} ${an}` : new Date(an, m, 1).toLocaleDateString(LOC, { month: 'long', year: 'numeric' });
    const decalage = (new Date(an, m, 1).getDay() + 6) % 7; // semaine commençant le lundi
    const nbJours = new Date(an, m + 1, 0).getDate();
    const auj = cle(new Date());
    grille.replaceChildren();
    for (let i = 0; i < decalage; i++) grille.append(Object.assign(document.createElement('span'), { className: 'rp__cal-vide' }));
    for (let j = 1; j <= nbJours; j++) {
      const d = new Date(an, m, j);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rp__cal-j';
      b.textContent = String(j);
      b.dataset.jour = cle(d);
      b.setAttribute('aria-label', jourAffiche(d));
      if (d < premier || d > dernier) b.disabled = true;
      if (cle(d) === auj) b.classList.add('is-auj');
      if (cle(d) === choisi) { b.classList.add('is-choisi'); b.setAttribute('aria-pressed', 'true'); }
      grille.append(b);
    }
    navs[0].disabled = an === premier.getFullYear() && m === premier.getMonth();
    navs[1].disabled = an === dernier.getFullYear() && m === dernier.getMonth();
  }

  function choisirJour(c) {
    choisi = c;
    champJour.value = c;
    champJour.dataset.texte = jourTexte(depuisCle(c));
    grille.querySelectorAll('.rp__cal-j').forEach((b) => {
      const oui = b.dataset.jour === c;
      b.classList.toggle('is-choisi', oui);
      b.setAttribute('aria-pressed', String(oui));
    });
    majCreneaux();
  }

  grille.addEventListener('click', (e) => {
    const b = e.target.closest('.rp__cal-j');
    if (b && !b.disabled) choisirJour(b.dataset.jour);
  });
  navs.forEach((n) => n.addEventListener('click', () => {
    moisAffiche = new Date(moisAffiche.getFullYear(), moisAffiche.getMonth() + Number(n.dataset.mois), 1);
    dessinerMois();
  }));

  /* ---------- Créneaux : ceux déjà passés aujourd'hui sont grisés ---------- */
  function majCreneaux() {
    const aujourdhui = choisi === cle(new Date());
    const heure = new Date().getHours();
    let libre = null;
    form.querySelectorAll('input[name="creneau"]').forEach((c) => {
      c.disabled = Boolean(aujourdhui && heure >= Number(c.dataset.fin) - 1);
      if (!c.disabled && !libre) libre = c;
    });
    const actuel = form.querySelector('input[name="creneau"]:checked');
    if ((!actuel || actuel.disabled) && libre) libre.checked = true;
    majResume();
  }

  function majResume() {
    const c = form.querySelector('input[name="creneau"]:checked');
    if (!choisi || !c) { resume.textContent = ''; return; }
    const t = jourAffiche(depuisCle(choisi));
    resume.textContent = `${t.charAt(0).toUpperCase()}${t.slice(1)} · ${T(CRENEAUX_COURT[c.value])}`;
  }

  function majAgenda() {
    const date = form.querySelector('input[name="quand"]:checked')?.value === 'date';
    agenda.classList.toggle('is-ouvert', date);
    agenda.setAttribute('aria-hidden', String(!date));
    agenda.querySelectorAll('input, button').forEach((i) => { i.tabIndex = date ? 0 : -1; });
  }

  form.addEventListener('change', (e) => {
    if (e.target.name === 'quand') majAgenda();
    if (e.target.name === 'creneau') majResume();
  });

  const ouvrir = () => {
    form.hidden = false; merci.hidden = true; erreur.hidden = true;
    bornes();
    moisAffiche = new Date(premier.getFullYear(), premier.getMonth(), 1);
    dessinerMois();
    choisirJour(cle(premier));
    majAgenda();
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
    if (!nom) return montrer(T('Indiquez votre nom.'), 'nom');
    if (tel.replace(/\D/g, '').length < 9) return montrer(T('Indiquez un numéro de téléphone valide.'), 'tel');

    let quand = 'Dès que possible';
    let phrase = T('dès que possible');
    if (d.get('quand') === 'date') {
      const c = form.querySelector('input[name="creneau"]:checked');
      if (!choisi || !c) return montrer(T('Choisissez un jour et un moment.'));
      const t = champJour.dataset.texte;
      quand = `${t.charAt(0).toUpperCase()}${t.slice(1)}, ${CRENEAUX[c.value]}`;
      phrase = `${jourAffiche(depuisCle(choisi))} ${T(CRENEAUX[c.value])}`;
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
          ...(window.LANGUE && window.LANGUE !== 'fr' ? { 'Langue du visiteur': window.LANGUE === 'ar' ? 'Arabe' : 'Anglais' } : {}),
          site_web: String(d.get('site_web') || ''),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.erreur || T('Envoi impossible pour le moment.'));
      recap.textContent = T('Un responsable vous rappelle {quand} au {tel}.', { quand: phrase, tel });
      form.reset();
      form.hidden = true; merci.hidden = false;
    } catch (err) {
      montrer(`${err.message} ${T('Vous pouvez aussi nous appeler au 06 11 67 86 25.')}`);
    }
    bouton.disabled = false;
  });
})();
