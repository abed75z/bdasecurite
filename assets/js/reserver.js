/* =========================================================
   RÉSERVER UN VTC — l'application
   Adresses et itinéraires : Géoplateforme de l'IGN (gratuit).
   Le prix affiché est recalculé par le serveur à l'envoi.
   ========================================================= */
(() => {
  'use strict';
  const API = '/api/reservation.php';
  const GEO = 'https://data.geopf.fr/geocodage';
  const ITINERAIRE = 'https://data.geopf.fr/navigation/itineraire';
  const TUILES = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
  const CLE_COURSES = 'bda-vtc-courses';
  const CLE_LIEUX = 'bda-vtc-lieux';

  // Aéroports et gares, proposés en un geste
  const LIEUX = [
    { court: 'CDG T2', label: 'Aéroport Charles-de-Gaulle — Terminal 2', lat: 49.0040, lon: 2.5711, cp: '95700', code: 'CDG', type: 'avion', mots: 'aeroport cdg roissy charles de gaulle terminal 2 t2' },
    { court: 'CDG T1', label: 'Aéroport Charles-de-Gaulle — Terminal 1', lat: 49.0097, lon: 2.5479, cp: '95700', code: 'CDG', type: 'avion', mots: 'aeroport cdg roissy charles de gaulle terminal 1 t1' },
    { court: 'Orly', label: 'Aéroport de Paris-Orly', lat: 48.7262, lon: 2.3652, cp: '94390', code: 'ORY', type: 'avion', mots: 'aeroport orly' },
    { court: 'Beauvais', label: 'Aéroport de Beauvais-Tillé', lat: 49.4544, lon: 2.1128, cp: '60000', code: 'BVA', type: 'avion', mots: 'aeroport beauvais tille' },
    { court: 'Gare du Nord', label: 'Gare du Nord, Paris 10e', lat: 48.8809, lon: 2.3553, cp: '75010', type: 'train', mots: 'gare du nord eurostar' },
    { court: 'Gare de Lyon', label: 'Gare de Lyon, Paris 12e', lat: 48.8443, lon: 2.3744, cp: '75012', type: 'train', mots: 'gare de lyon' },
    { court: 'Montparnasse', label: 'Gare Montparnasse, Paris 15e', lat: 48.8412, lon: 2.3207, cp: '75015', type: 'train', mots: 'gare montparnasse' },
    { court: 'Gare de l\'Est', label: 'Gare de l\'Est, Paris 10e', lat: 48.8768, lon: 2.3592, cp: '75010', type: 'train', mots: 'gare de l est' },
    { court: 'Saint-Lazare', label: 'Gare Saint-Lazare, Paris 8e', lat: 48.8763, lon: 2.3253, cp: '75008', type: 'train', mots: 'gare saint lazare st lazare' },
  ];
  const VEHICULES = {
    berline: { img: 'v-berline', texte: 'Confort et discrétion, idéale jusqu\'à 3 personnes' },
    van: { img: 'v-van', texte: 'Familles, groupes et bagages volumineux' },
  };

  /* ---------- Outils ---------- */
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, ...enfants) => { const e = document.createElement(tag); if (cls) e.className = cls; enfants.flat().forEach((c) => c != null && c !== false && e.append(c)); return e; };
  const svgUse = (id, cls = 'ic') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', cls); const u = document.createElementNS(s.namespaceURI, 'use'); u.setAttribute('href', `#${id}`); s.append(u); return s; };
  const icone = (nom) => svgUse(`i-${nom}`);
  const normaliser = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const pad = (n) => String(n).padStart(2, '0');
  const euros = (n) => `${Math.round(n)} €`;
  const lire = (cle) => { try { return JSON.parse(localStorage.getItem(cle) || '[]'); } catch (e) { return []; } };
  const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } };
  const toast = (txt) => { const t = $('toast'); t.textContent = txt; t.classList.add('is-in'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('is-in'), 2800); };
  const ordinateur = () => window.matchMedia('(min-width: 980px)').matches;
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dureeTexte = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${pad(Math.round(min % 60))}` : `${Math.max(1, Math.round(min))} min`);
  const kmTexte = (km) => `${km.toFixed(1).replace('.', ',')} km`;

  const etat = { mode: 'trajet', depart: null, arrivee: null, route: null, passagers: 1, bagages: 1, heures: 3, sieges: 0, vehicule: 'berline', date: '', heure: '' };
  let tarifs = null;

  /* ---------- Date et heure ---------- */
  const delai = () => (tarifs ? +tarifs.delai : 2);
  const quandDate = () => new Date(`${etat.date}T${etat.heure}`);
  function heureParDefaut() {
    const d = new Date(Date.now() + (delai() + 0.5) * 3600e3);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    etat.date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    etat.heure = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function quandTexte() {
    const d = quandDate();
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const j = new Date(d); j.setHours(0, 0, 0, 0);
    const ecart = Math.round((j - auj) / 864e5);
    const jour = ecart === 0 ? 'Aujourd\'hui' : ecart === 1 ? 'Demain' : new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
    return `${jour} · ${etat.heure}`;
  }
  const estNuit = () => { const h = +etat.heure.slice(0, 2); return h >= 22 || h < 6; };
  function majQuand() {
    $('quand-accueil').querySelector('b').textContent = quandTexte();
    $('pastille-quand').querySelector('span').textContent = quandTexte();
  }

  /* ---------- Carte ---------- */
  let carte = null, calque = null, animVoiture = 0;
  function initCarte() {
    if (!window.L) return;
    carte = L.map('carte', { zoomControl: false }).setView([48.8566, 2.3522], 12);
    L.tileLayer(TUILES, { maxZoom: 18, attribution: '© <a href="https://www.ign.fr" target="_blank" rel="noopener">IGN</a> Géoplateforme' }).addTo(carte);
    calque = L.layerGroup().addTo(carte);
  }
  // Marges pour que le trajet reste visible à côté du panneau (ordinateur) ou au-dessus (téléphone)
  function marges() {
    if (ordinateur()) return { tl: [500, 110], br: [60, 60] };
    const f = $('feuille').getBoundingClientRect();
    const visible = Math.max(0, window.innerHeight - f.top);
    return { tl: [30, 90], br: [30, Math.min(window.innerHeight * 0.75, visible + 30)] };
  }
  function dessinerCarte() {
    if (!carte) return;
    cancelAnimationFrame(animVoiture);
    carte.invalidateSize();
    carte.stop();
    calque.clearLayers();
    const points = [];
    const repere = (p, cls) => { L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html: `<div class="repere ${cls}"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] }), keyboard: false, interactive: false }).addTo(calque); points.push([p.lat, p.lon]); };
    if (etat.depart) repere(etat.depart, '');
    if (etat.mode === 'trajet' && etat.arrivee) repere(etat.arrivee, 'repere--arrivee');
    let ligne = null;
    if (etat.mode === 'trajet' && etat.route?.geo?.length > 1) {
      ligne = etat.route.geo.map(([lon, lat]) => [lat, lon]);
      L.polyline(ligne, { color: '#000', weight: 9, opacity: 0.4, interactive: false }).addTo(calque);
      L.polyline(ligne, { color: '#e8cf95', weight: 4.5, opacity: 1, className: 'trace-route', interactive: false }).addTo(calque);
      ligne.forEach((p) => points.push(p));
      // Durée affichée sur la carte, près de l'arrivée
      L.marker(ligne[ligne.length - 1], { icon: L.divIcon({ className: '', html: `<div class="etiquette-carte">${dureeTexte(etat.route.min)}<small>${kmTexte(etat.route.km)}</small></div>`, iconSize: null, iconAnchor: [-14, 34] }), interactive: false, keyboard: false }).addTo(calque);
    }
    const m = marges();
    if (points.length > 1) carte.fitBounds(points, { paddingTopLeft: m.tl, paddingBottomRight: m.br, maxZoom: 15, animate: false });
    else if (points.length === 1) carte.setView(points[0], 14, { animate: false });
    if (ligne && !reduit) animerVoiture(ligne);
  }
  // Une petite voiture parcourt le trajet en boucle
  function animerVoiture(ligne) {
    const cumul = [0];
    for (let i = 1; i < ligne.length; i++) cumul.push(cumul[i - 1] + carte.distance(ligne[i - 1], ligne[i]));
    const total = cumul[cumul.length - 1];
    if (!total) return;
    const icon = L.divIcon({ className: '', html: '<div class="voiture-repere"><svg viewBox="0 0 24 24"><path d="M5 17h14M5 17a2 2 0 1 1-4 0v-4l2.5-5.5A2 2 0 0 1 5.3 6h13.4a2 2 0 0 1 1.8 1.5L23 13v4a2 2 0 1 1-4 0"/><path d="M3.5 12h17"/></svg></div>', iconSize: [30, 30], iconAnchor: [15, 15] });
    const voiture = L.marker(ligne[0], { icon, interactive: false, keyboard: false }).addTo(calque);
    const duree = Math.min(9000, Math.max(4000, total / 6));
    const debut = performance.now() + 1100;
    const pas = (t) => {
      const p = Math.max(0, ((t - debut) % (duree + 1200)) / duree);
      const d = Math.min(1, p) * total;
      let i = 1;
      while (i < cumul.length - 1 && cumul[i] < d) i++;
      const r = (d - cumul[i - 1]) / ((cumul[i] - cumul[i - 1]) || 1);
      voiture.setLatLng([ligne[i - 1][0] + (ligne[i][0] - ligne[i - 1][0]) * r, ligne[i - 1][1] + (ligne[i][1] - ligne[i - 1][1]) * r]);
      animVoiture = requestAnimationFrame(pas);
    };
    animVoiture = requestAnimationFrame(pas);
  }

  /* ---------- Adresses ---------- */
  function codeAeroport(label) {
    const n = normaliser(label);
    if (!/aeroport|airport/.test(n)) return '';
    if (/charles de gaulle|roissy|\bcdg\b/.test(n)) return 'CDG';
    if (/\borly\b/.test(n)) return 'ORY';
    if (/beauvais/.test(n)) return 'BVA';
    return '';
  }
  async function chercherAdresses(q, signal) {
    const r = await fetch(`${GEO}/search?q=${encodeURIComponent(q)}&limit=6&autocomplete=1&index=address&lat=48.8566&lon=2.3522`, { signal });
    const j = await r.json();
    return (j.features || []).map((f) => ({ label: f.properties.label, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], cp: String(f.properties.postcode || ''), code: codeAeroport(f.properties.label), type: 'adresse', detail: f.properties.context || '' }));
  }
  function lieuxConnus(q) {
    const n = normaliser(q);
    if (n.length < 2) return [];
    const mots = n.split(' ');
    return LIEUX.filter((l) => mots.every((m) => l.mots.includes(m)));
  }
  const pictoLieu = (l) => (l.type === 'avion' ? 'avion' : l.type === 'train' ? 'train' : l.recent ? 'historique' : 'pin');
  function memoriserLieu(l) {
    const liste = lire(CLE_LIEUX).filter((x) => x.label !== l.label);
    liste.unshift({ label: l.label, lat: l.lat, lon: l.lon, cp: l.cp || '', code: l.code || '', type: l.type || 'adresse', detail: l.detail || '' });
    ecrire(CLE_LIEUX, liste.slice(0, 5));
  }
  function ligneLieu(l, surChoix) {
    const b = el('button', '', el('span', `pictos ${l.type === 'avion' || l.type === 'train' ? 'pictos--or' : ''}`, icone(pictoLieu(l))), el('span', '', el('b', '', l.label), l.detail ? el('small', '', l.detail) : null));
    b.type = 'button';
    b.addEventListener('pointerdown', (e) => e.preventDefault());
    b.addEventListener('click', () => surChoix(l));
    return el('li', '', b);
  }

  /* ---------- Itinéraire ---------- */
  const distanceVol = (a, b) => { const R = 6371, r = Math.PI / 180, x = (b.lat - a.lat) * r, y = (b.lon - a.lon) * r; const h = Math.sin(x / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))); };
  let jetonRoute = 0;
  async function calculerTrajet() {
    etat.route = null;
    const j = ++jetonRoute;
    if (etat.mode === 'trajet' && etat.depart && etat.arrivee) {
      const d = etat.depart, a = etat.arrivee;
      try {
        const url = `${ITINERAIRE}?resource=bdtopo-osrm&start=${d.lon},${d.lat}&end=${a.lon},${a.lat}&profile=car&optimization=fastest&distanceUnit=kilometer&timeUnit=minute&geometryFormat=geojson&getSteps=false`;
        const r = await (await fetch(url)).json();
        if (!(r.distance > 0)) throw new Error('itinéraire');
        if (j !== jetonRoute) return;
        etat.route = { km: r.distance, min: r.duration, geo: r.geometry?.coordinates || [] };
      } catch (e) {
        if (j !== jetonRoute) return;
        const km = distanceVol(d, a) * 1.3;
        etat.route = { km, min: km * 2, geo: [[d.lon, d.lat], [a.lon, a.lat]] };
      }
    }
    dessinerCarte();
  }

  /* ---------- Prix (même calcul que le serveur) ---------- */
  const estParis = (p) => !!p && String(p.cp).startsWith('75');
  function calculPrix(veh) {
    if (!tarifs) return null;
    const v = tarifs[veh];
    const lignes = [];
    let base;
    if (etat.mode === 'dispo') {
      const h = Math.max(+tarifs.minHeures, etat.heures);
      base = h * v.heure;
      lignes.push([`Mise à disposition ${h} h × ${euros(v.heure)}`, base]);
    } else {
      if (!etat.route) return null;
      const f = (tarifs.forfaits || []).find((x) => (etat.depart?.code === x.code && estParis(etat.arrivee)) || (etat.arrivee?.code === x.code && estParis(etat.depart)));
      if (f) { base = +f[veh]; lignes.push([`Forfait ${f.nom}`, base]); }
      else {
        const calc = +v.prise + etat.route.km * v.km + etat.route.min * v.min;
        lignes.push(['Prise en charge', +v.prise], [`${kmTexte(etat.route.km)} × ${String(v.km).replace('.', ',')} €`, etat.route.km * v.km], [`${Math.round(etat.route.min)} min × ${String(v.min).replace('.', ',')} €`, etat.route.min * v.min]);
        if (calc < +v.minimum) lignes.push([`Course minimum (${euros(v.minimum)})`, +v.minimum - calc]);
        base = Math.max(+v.minimum, calc);
      }
    }
    if (estNuit() && +tarifs.nuit) { lignes.push([`Nuit 22 h – 6 h (+${tarifs.nuit} %)`, base * tarifs.nuit / 100]); base *= 1 + tarifs.nuit / 100; }
    if (etat.sieges) { lignes.push([`Siège enfant × ${etat.sieges}`, etat.sieges * tarifs.siege]); base += etat.sieges * tarifs.siege; }
    if ($('pancarte').checked && +tarifs.pancarte) { lignes.push(['Accueil pancarte', +tarifs.pancarte]); base += +tarifs.pancarte; }
    return { total: Math.round(base), lignes };
  }
  const prixVisible = () => !!tarifs?.afficherPrix;

  /* ---------- Vues ---------- */
  let vueCourante = 'accueil';
  function allerVue(nom) {
    vueCourante = nom;
    document.querySelectorAll('.vue').forEach((v) => v.classList.toggle('is-active', v.dataset.vue === nom));
    $('defile').scrollTop = 0;
    ouvrirFeuille();
    if (nom === 'accueil') majAccueil();
    if (nom === 'choix') majChoix();
    setTimeout(dessinerCarte, 60);
  }
  document.querySelectorAll('[data-aller]').forEach((b) => b.addEventListener('click', () => {
    if (b.hasAttribute('data-nouvelle')) {
      etat.arrivee = null; etat.route = null; etat.sieges = 0; $('pancarte').checked = false; $('vol').value = '';
      if (location.hash) history.replaceState(null, '', location.pathname);
    }
    allerVue(b.dataset.aller);
  }));

  /* ---------- Accueil ---------- */
  function majAccueil() {
    const h = new Date().getHours();
    $('salut').textContent = h < 6 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir';
    $('titre-accueil').textContent = etat.mode === 'dispo' ? 'Où venons-nous vous chercher ?' : 'Où allez-vous ?';
    const lieu = etat.mode === 'dispo' ? etat.depart : etat.arrivee;
    $('barre-texte').textContent = lieu ? lieu.label : etat.mode === 'dispo' ? 'Adresse de prise en charge' : 'Rechercher une destination';
    majQuand();
    const recents = lire(CLE_LIEUX);
    $('recents').replaceChildren(...recents.slice(0, 3).map((l) => ligneLieu({ ...l, recent: true }, choisirRapide)));
  }
  function choisirRapide(l) {
    memoriserLieu(l);
    if (etat.mode === 'dispo') { etat.depart = l; return versChoix(); }
    etat.arrivee = l;
    if (!etat.depart) return ouvrirRecherche('depart');
    versChoix();
  }
  $('raccourcis').replaceChildren(...LIEUX.map((l) => {
    const b = el('button', 'raccourci', icone(l.type), l.court);
    b.type = 'button';
    b.addEventListener('click', () => choisirRapide(l));
    return b;
  }));
  $('ouvrir-recherche').addEventListener('click', (e) => {
    if (e.target.closest('.barre-recherche__quand')) return ouvrirQuand();
    ouvrirRecherche(etat.mode === 'dispo' ? 'depart' : etat.depart ? 'arrivee' : 'depart');
  });
  document.querySelectorAll('.modes button').forEach((b) => b.addEventListener('click', () => {
    etat.mode = b.dataset.mode;
    document.querySelectorAll('.modes button').forEach((x) => { x.classList.toggle('is-actif', x === b); x.setAttribute('aria-checked', String(x === b)); });
    document.querySelector('[data-compteur="heures"]').hidden = etat.mode !== 'dispo';
    calculerTrajet();
    majAccueil();
  }));

  /* ---------- Recherche d'adresses ---------- */
  let champActif = 'arrivee', ctrl = null, delaiFrappe = 0;
  function ouvrirRecherche(cle) {
    champActif = cle;
    $('champ-arrivee').hidden = etat.mode === 'dispo';
    $('depart').value = etat.depart?.label || '';
    $('arrivee').value = etat.arrivee?.label || '';
    $('recherche').hidden = false;
    setTimeout(() => $(cle).focus(), 60);
    afficherResultats('');
  }
  const fermerRecherche = () => { $('recherche').hidden = true; };
  $('fermer-recherche').addEventListener('click', fermerRecherche);
  function afficherResultats(q, adresses = []) {
    const zone = $('resultats');
    const titre = (t) => el('li', 'titre-liste', t);
    if (!q) {
      const recents = lire(CLE_LIEUX);
      zone.replaceChildren(...[recents.length ? titre('Récents') : null, ...recents.map((l) => ligneLieu({ ...l, recent: true }, choisirLieu)),
        titre('Aéroports et gares'), ...LIEUX.map((l) => ligneLieu(l, choisirLieu))].filter(Boolean));
      return;
    }
    const tous = [...lieuxConnus(q).slice(0, 3), ...adresses];
    zone.replaceChildren(...(tous.length ? tous.map((l) => ligneLieu(l, choisirLieu)) : [el('li', 'vide', q.length < 3 ? 'Continuez à taper…' : 'Aucune adresse trouvée')]));
  }
  ['depart', 'arrivee'].forEach((cle) => {
    const input = $(cle);
    input.addEventListener('focus', () => { champActif = cle; afficherResultats(input.value === (etat[cle]?.label || '') ? '' : input.value.trim()); input.select(); });
    input.addEventListener('input', () => {
      champActif = cle;
      clearTimeout(delaiFrappe);
      const q = input.value.trim();
      if (q.length < 3) { afficherResultats(q); return; }
      delaiFrappe = setTimeout(async () => {
        ctrl?.abort(); ctrl = new AbortController();
        try { afficherResultats(q, await chercherAdresses(q, ctrl.signal)); } catch (e) { if (e.name !== 'AbortError') afficherResultats(q); }
      }, 220);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('resultats').querySelector('li button')?.click(); }
      if (e.key === 'Escape') fermerRecherche();
    });
  });
  function choisirLieu(l) {
    etat[champActif] = { label: l.label, lat: l.lat, lon: l.lon, cp: l.cp || '', code: l.code || '' };
    memoriserLieu(l);
    $(champActif).value = l.label;
    if (etat.mode === 'dispo' || (etat.depart && etat.arrivee)) { fermerRecherche(); return versChoix(); }
    const autre = champActif === 'depart' ? 'arrivee' : 'depart';
    champActif = autre;
    $(autre).focus();
  }
  $('inverser').addEventListener('click', () => {
    [etat.depart, etat.arrivee] = [etat.arrivee, etat.depart];
    $('depart').value = etat.depart?.label || ''; $('arrivee').value = etat.arrivee?.label || '';
  });
  $('ma-position').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Position indisponible sur cet appareil.');
    toast('Recherche de votre position…');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      let label = 'Ma position', cp = '';
      try {
        const j = await (await fetch(`${GEO}/reverse?lon=${coords.longitude}&lat=${coords.latitude}&limit=1`)).json();
        const f = j.features?.[0];
        if (f) { label = f.properties.label; cp = String(f.properties.postcode || ''); }
      } catch (e) { /* adresse approximative */ }
      champActif = 'depart';
      choisirLieu({ label, lat: coords.latitude, lon: coords.longitude, cp, code: '' });
    }, () => toast('Autorisez la localisation, ou tapez votre adresse.'), { enableHighAccuracy: true, timeout: 10000 });
  });

  /* ---------- Choix du véhicule ---------- */
  async function versChoix() {
    allerVue('choix');
    await calculerTrajet();
    majChoix();
  }
  $('modifier-trajet').addEventListener('click', () => ouvrirRecherche(etat.mode === 'dispo' ? 'depart' : 'arrivee'));
  function majChoix() {
    $('resume-depart').textContent = etat.depart?.label || '—';
    $('ligne-arrivee').hidden = etat.mode === 'dispo';
    $('resume-arrivee').textContent = etat.arrivee?.label || '—';
    majQuand();
    $('pastille-voyageurs').querySelector('span').textContent = etat.mode === 'dispo'
      ? `${etat.heures} h · ${etat.passagers} pers.` : `${etat.passagers} pers. · ${etat.bagages} bagage${etat.bagages > 1 ? 's' : ''}`;
    const places = (veh) => (tarifs ? +tarifs[veh].places : veh === 'van' ? 7 : 3);
    if (etat.passagers > places('berline') && etat.vehicule === 'berline') etat.vehicule = 'van';
    const conseille = etat.passagers > places('berline') || etat.bagages > 3 ? 'van' : 'berline';
    $('vehicules').replaceChildren(...['berline', 'van'].map((veh) => {
      const t = tarifs?.[veh] || { nom: veh === 'van' ? 'Van' : 'Berline', places: places(veh), bagages: veh === 'van' ? 7 : 3 };
      const p = calculPrix(veh);
      const arrivee = etat.mode === 'trajet' && etat.route ? new Date(quandDate().getTime() + etat.route.min * 60e3) : null;
      const b = el('button', `vehicule ${etat.vehicule === veh ? 'is-actif' : ''}`,
        veh === conseille ? el('span', 'badge-top', 'Conseillé') : null,
        svgUse(VEHICULES[veh].img, 'vehicule__img'),
        el('span', 'vehicule__txt',
          el('b', '', `${t.nom}`, el('i', '', icone('perso'), String(t.places)), el('i', '', icone('valise'), String(t.bagages))),
          el('small', 'arrivee', arrivee ? `Arrivée vers ${pad(arrivee.getHours())}:${pad(arrivee.getMinutes())}` : etat.mode === 'dispo' ? `Chauffeur à disposition ${Math.max(etat.heures, tarifs ? +tarifs.minHeures : 1)} h` : 'Calcul du trajet…'),
          el('small', '', VEHICULES[veh].texte)),
        el('span', 'vehicule__prix', prixVisible() && p ? [el('b', '', euros(p.total)), el('small', '', 'prix estimé')] : el('small', '', tarifs && !prixVisible() ? 'Prix confirmé par BDA' : '…')));
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(etat.vehicule === veh));
      b.disabled = etat.passagers > t.places;
      b.addEventListener('click', () => { etat.vehicule = veh; majChoix(); });
      return b;
    }));
    const nuit = estNuit() && tarifs && +tarifs.nuit;
    $('nuit').hidden = !nuit;
    if (nuit) $('nuit').querySelector('span').textContent = `Course de nuit : majoration de ${tarifs.nuit} % incluse.`;
    $('prix-siege').textContent = tarifs ? `+ ${euros(tarifs.siege)}` : '';
    $('prix-pancarte').textContent = tarifs && +tarifs.pancarte ? `+ ${euros(tarifs.pancarte)}` : 'offert';
    const opts = [etat.sieges ? `${etat.sieges} siège${etat.sieges > 1 ? 's' : ''} enfant` : '', $('pancarte').checked ? 'pancarte' : '', $('vol').value.trim() ? `vol ${$('vol').value.trim()}` : ''].filter(Boolean);
    $('resume-options').textContent = opts.length ? opts.join(', ') : 'siège enfant, pancarte, n° de vol';
    // Détail du prix
    const p = calculPrix(etat.vehicule);
    $('btn-detail').hidden = !(prixVisible() && p);
    if (prixVisible() && p) {
      $('detail-prix').replaceChildren(...p.lignes.map(([a, v]) => el('div', '', el('dt', '', a), el('dd', '', `${v.toFixed(2).replace('.', ',')} €`))),
        el('div', 'total', el('dt', '', 'Total estimé (arrondi)'), el('dd', '', euros(p.total))),
        el('p', '', 'Estimation d\'après l\'itinéraire le plus rapide. BDA vous confirme le prix final avant la course.'));
    }
    $('cta-choix').textContent = `Réserver · ${tarifs?.[etat.vehicule]?.nom || (etat.vehicule === 'van' ? 'Van' : 'Berline')}`;
    $('cta-prix').textContent = prixVisible() && p ? euros(p.total) : '';
    $('vers-infos').disabled = etat.mode === 'trajet' && !etat.route;
  }
  $('btn-detail').addEventListener('click', () => {
    const d = $('detail-prix');
    d.hidden = !d.hidden;
    $('btn-detail').setAttribute('aria-expanded', String(!d.hidden));
    $('btn-detail').textContent = d.hidden ? 'Détail du prix' : 'Masquer le détail';
  });
  $('pancarte').addEventListener('change', majChoix);
  let delaiVol = 0;
  $('vol').addEventListener('input', () => { clearTimeout(delaiVol); delaiVol = setTimeout(majChoix, 300); });
  $('vers-infos').addEventListener('click', () => {
    if (quandDate().getTime() < Date.now() + delai() * 3600e3) { ouvrirQuand(`Réservez au moins ${delai()} h à l'avance, ou appelez le 06 11 67 86 25.`); return; }
    dessinerRecap();
    allerVue('infos');
  });

  /* ---------- Fenêtres : quand, voyageurs, mes courses ---------- */
  const ouvrirFenetre = (id) => { $(id).hidden = false; };
  document.querySelectorAll('.fenetre [data-fermer]').forEach((b) => b.addEventListener('click', () => {
    b.closest('.fenetre').hidden = true;
    if (vueCourante === 'choix') majChoix();
    if (vueCourante === 'accueil') majAccueil();
  }));
  function ouvrirQuand(message) {
    $('date').value = etat.date; $('heure').value = etat.heure;
    const auj = new Date();
    $('date').min = `${auj.getFullYear()}-${pad(auj.getMonth() + 1)}-${pad(auj.getDate())}`;
    $('erreur-quand').textContent = message || '';
    const choix = (txt, f) => { const b = el('button', '', txt); b.type = 'button'; b.addEventListener('click', () => { const d = f(); $('date').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; $('heure').value = `${pad(d.getHours())}:${pad(d.getMinutes())}`; $('erreur-quand').textContent = ''; }); return b; };
    const aDemain = (h) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return d; };
    const auPlusTot = () => { const d = new Date(Date.now() + (delai() + 0.25) * 3600e3); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); return d; };
    const ceSoir = () => { const d = new Date(); d.setHours(20, 0, 0, 0); return d.getTime() < Date.now() + delai() * 3600e3 ? aDemain(20) : d; };
    $('choix-rapides').replaceChildren(choix('Au plus tôt', auPlusTot), choix('Ce soir 20:00', ceSoir), choix('Demain 07:00', () => aDemain(7)), choix('Demain 18:00', () => aDemain(18)));
    ouvrirFenetre('fenetre-quand');
  }
  $('valider-quand').addEventListener('click', () => {
    const d = $('date').value, h = $('heure').value;
    if (!d || !h) { $('erreur-quand').textContent = 'Choisissez une date et une heure.'; return; }
    if (new Date(`${d}T${h}`).getTime() < Date.now() + delai() * 3600e3) { $('erreur-quand').textContent = `Au moins ${delai()} h à l'avance. Pour une course immédiate : 06 11 67 86 25.`; return; }
    etat.date = d; etat.heure = h;
    $('fenetre-quand').hidden = true;
    majQuand();
    if (vueCourante === 'choix') majChoix();
  });
  $('pastille-quand').addEventListener('click', () => ouvrirQuand());
  $('pastille-voyageurs').addEventListener('click', () => ouvrirFenetre('fenetre-voyageurs'));
  const BORNES = { passagers: [1, 7], bagages: [0, 10], heures: [1, 12], sieges: [0, 3] };
  document.querySelectorAll('.compteur').forEach((c) => {
    const cle = c.dataset.compteur, [mini, maxi] = BORNES[cle], val = c.querySelector('b');
    const maj = () => { val.textContent = etat[cle]; c.querySelector('[data-pas="-1"]').disabled = etat[cle] <= mini; c.querySelector('[data-pas="1"]').disabled = etat[cle] >= maxi; };
    c.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { etat[cle] = Math.min(maxi, Math.max(mini, etat[cle] + +b.dataset.pas)); maj(); if (cle === 'sieges') majChoix(); }));
    maj();
  });
  function majBadge() { const n = lire(CLE_COURSES).length; $('nb-courses').textContent = n; $('nb-courses').hidden = !n; }
  $('btn-courses').addEventListener('click', () => {
    const liste = lire(CLE_COURSES);
    $('liste-courses').replaceChildren(...(liste.length ? liste.map((c) => {
      const a = el('a', '', el('b', '', `${c.date.split('-').reverse().join('/')} à ${c.heure} · ${c.ref}`), el('small', '', c.mode === 'dispo' ? `${c.depart} · mise à disposition` : `${c.depart} → ${c.arrivee}`));
      a.href = `#suivi=${c.jeton}`;
      a.addEventListener('click', () => { $('fenetre-courses').hidden = true; });
      return el('li', '', a);
    }) : [el('li', 'vide', 'Vos réservations faites sur ce téléphone apparaîtront ici.')]));
    ouvrirFenetre('fenetre-courses');
  });

  /* ---------- Coordonnées et envoi ---------- */
  function dessinerRecap() {
    const p = calculPrix(etat.vehicule);
    const ligne = (a, b, cls) => el('div', cls || '', el('span', '', a), el('span', '', b));
    $('recap').replaceChildren(
      ligne('Quand', quandTexte()),
      ligne('Départ', etat.depart.label),
      etat.mode === 'trajet' ? ligne('Arrivée', etat.arrivee.label) : ligne('Durée', `${Math.max(etat.heures, tarifs ? +tarifs.minHeures : 1)} h`),
      ligne('Véhicule', `${tarifs?.[etat.vehicule]?.nom || ''} · ${etat.passagers} pers.`),
      ligne('Prix', prixVisible() && p ? euros(p.total) : 'confirmé par BDA', 'total'));
    $('cta-prix-2').textContent = prixVisible() && p ? euros(p.total) : '';
  }
  $('form-resa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('erreur');
    err.textContent = '';
    const nom = $('nom').value.trim(), tel = $('tel').value.trim(), email = $('email').value.trim();
    if (nom.length < 2) { err.textContent = 'Indiquez votre nom.'; $('nom').focus(); return; }
    if (tel.replace(/\D/g, '').length < 9) { err.textContent = 'Indiquez un numéro de téléphone valide.'; $('tel').focus(); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Adresse email invalide.'; $('email').focus(); return; }
    if (!$('accord').checked) { err.textContent = 'Merci d\'accepter l\'utilisation de vos informations pour organiser la course.'; return; }
    const btn = $('reserver');
    btn.disabled = true; btn.classList.add('is-loading');
    const donnees = {
      mode: etat.mode, vehicule: etat.vehicule, depart: etat.depart, arrivee: etat.mode === 'trajet' ? etat.arrivee : null,
      date: etat.date, heure: etat.heure, passagers: etat.passagers, bagages: etat.bagages, heures: etat.heures,
      km: etat.route?.km || 0, min: etat.route?.min || 0, sieges: etat.sieges, pancarte: $('pancarte').checked,
      vol: $('vol').value.trim(), message: $('message').value.trim(), nom, tel, email, site_web: $('site_web').value,
    };
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(donnees) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.erreur || 'L\'envoi a échoué. Réessayez ou appelez-nous au 06 11 67 86 25.');
      const course = { ref: j.ref, jeton: j.jeton, date: etat.date, heure: etat.heure, depart: etat.depart.label, arrivee: etat.arrivee?.label || '', mode: etat.mode, vehicule: etat.vehicule, prix: j.prix, min: etat.route?.min || 60 };
      if (j.jeton) ecrire(CLE_COURSES, [course, ...lire(CLE_COURSES).filter((c) => c.ref !== j.ref)].slice(0, 20));
      majBadge();
      afficherConfirmation(course);
    } catch (x) {
      err.textContent = x.message;
    } finally {
      btn.disabled = false; btn.classList.remove('is-loading');
    }
  });

  function afficherConfirmation(c) {
    $('ref').textContent = c.ref;
    const quand = `${c.date.split('-').reverse().join('/')} à ${c.heure}`;
    $('course-carte').replaceChildren(svgUse(VEHICULES[c.vehicule].img, ''), el('div', '', el('b', '', `${tarifs?.[c.vehicule]?.nom || 'Berline'} · ${quand}`), el('small', '', c.depart), c.arrivee ? el('small', '', `→ ${c.arrivee}`) : el('small', '', 'Mise à disposition'), prixVisible() && c.prix ? el('small', '', `Prix estimé : ${euros(c.prix)}`) : null));
    $('wa-confirmer').href = `https://wa.me/33784739070?text=${encodeURIComponent(`Bonjour BDA, je viens de réserver une course (réf. ${c.ref}) pour le ${quand}. Pouvez-vous me la confirmer ?`)}`;
    $('lien-suivi').href = `#suivi=${c.jeton}`;
    $('calendrier').onclick = () => telechargerIcs(c);
    allerVue('fin');
  }
  function telechargerIcs(c) {
    const debut = `${c.date.replace(/-/g, '')}T${c.heure.replace(':', '')}00`;
    const fin = new Date(`${c.date}T${c.heure}`); fin.setMinutes(fin.getMinutes() + Math.max(30, Math.round(c.min || 60)));
    const f = `${fin.getFullYear()}${pad(fin.getMonth() + 1)}${pad(fin.getDate())}T${pad(fin.getHours())}${pad(fin.getMinutes())}00`;
    const esc = (s) => String(s).replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BDA VTC//FR', 'BEGIN:VEVENT', `UID:${c.ref}@bdasecurite.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART:${debut}`, `DTEND:${f}`, `SUMMARY:${esc(`Chauffeur BDA VTC — ${c.ref}`)}`, `LOCATION:${esc(c.depart)}`,
      `DESCRIPTION:${esc(`${c.depart}${c.arrivee ? ` → ${c.arrivee}` : ''}\nBDA VTC : 06 11 67 86 25\nSuivi : https://bdasecurite.com/reserver#suivi=${c.jeton}`)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = `course-${c.ref}.ics`;
    document.body.append(a); a.click(); a.remove();
  }

  /* ---------- Suivi (#suivi=jeton) ---------- */
  async function afficherSuivi(jeton) {
    $('suivi').replaceChildren(el('p', '', 'Chargement…'));
    allerVue('suivi');
    try {
      const j = await (await fetch(`${API}?suivi=${encodeURIComponent(jeton)}`)).json();
      if (!j.ok) throw new Error(j.erreur || 'Réservation introuvable.');
      dessinerSuivi(j.reservation, jeton);
    } catch (e) { $('suivi').replaceChildren(el('p', 'erreur', e.message)); }
  }
  function dessinerSuivi(r, jeton) {
    const rang = ['attente', 'confirmee', 'terminee'].indexOf(r.statut);
    const etape = (txt, i) => el('div', i <= rang ? 'is-fait' : '', el('i', '', i <= rang ? icone('coche') : String(i + 1)), txt);
    const quand = new Date(`${r.date}T${r.heure}`);
    const annulable = ['attente', 'confirmee'].includes(r.statut) && quand.getTime() - Date.now() > 2 * 3600e3;
    const annuler = el('button', 'bouton bouton--danger', 'Annuler la réservation');
    annuler.type = 'button';
    annuler.addEventListener('click', async () => {
      if (!confirm('Annuler cette réservation ?')) return;
      try {
        const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suivi: jeton, action: 'annuler' }) });
        const j = await res.json();
        if (!j.ok) throw new Error(j.erreur);
        toast('Réservation annulée.');
        dessinerSuivi(j.reservation, jeton);
      } catch (e) { toast(e.message || 'Annulation impossible : appelez-nous.'); }
    });
    $('suivi').replaceChildren(...[
      r.statut === 'annulee' ? el('p', 'statut--annulee', 'Cette réservation est annulée.') : el('div', 'statut', etape('Reçue', 0), etape('Confirmée', 1), etape('Terminée', 2)),
      el('div', 'course-carte', svgUse(VEHICULES[r.vehicule === 'van' ? 'van' : 'berline'].img, ''),
        el('div', '', el('b', '', `${r.ref} · ${new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(quand)} à ${r.heure}`),
          el('small', '', r.depart), r.mode === 'trajet' ? el('small', '', `→ ${r.arrivee}`) : el('small', '', `Mise à disposition · ${r.heures} h`),
          r.chauffeur ? el('small', '', `Votre chauffeur : ${r.chauffeur}`) : null,
          r.prix ? el('small', '', `Prix : ${euros(r.prix)}${r.statut === 'attente' ? ' (estimé)' : ''}`) : null)),
      el('div', 'suivi-actions',
        Object.assign(el('a', 'bouton', icone('tel'), 'Appeler'), { href: 'tel:+33611678625' }),
        Object.assign(el('a', 'bouton', icone('wa'), 'WhatsApp'), { href: `https://wa.me/33784739070?text=${encodeURIComponent(`Bonjour BDA, au sujet de ma réservation ${r.ref}.`)}`, target: '_blank', rel: 'noopener' })),
      annulable ? annuler : null,
    ].filter(Boolean));
  }

  /* ---------- Panneau qui glisse (téléphone) ---------- */
  const feuille = $('feuille');
  const ouvrirFeuille = () => feuille.classList.remove('is-reduite');
  let departY = null, dernierY = 0, glisse = false;
  $('poignee').addEventListener('pointerdown', (e) => { departY = e.clientY; dernierY = 0; glisse = false; feuille.classList.add('is-glisse'); $('poignee').setPointerCapture(e.pointerId); });
  $('poignee').addEventListener('pointermove', (e) => {
    if (departY == null) return;
    const dy = e.clientY - departY;
    if (Math.abs(dy) > 6) glisse = true;
    dernierY = dy;
    const base = feuille.classList.contains('is-reduite') ? feuille.offsetHeight - 118 : 0;
    feuille.style.transform = `translateY(${Math.max(0, base + dy)}px)`;
  });
  const finGlisse = () => {
    if (departY == null) return;
    feuille.classList.remove('is-glisse');
    feuille.style.transform = '';
    if (!glisse) feuille.classList.toggle('is-reduite');
    else if (dernierY > 60) feuille.classList.add('is-reduite');
    else if (dernierY < -40) feuille.classList.remove('is-reduite');
    departY = null;
    setTimeout(dessinerCarte, 460);
  };
  $('poignee').addEventListener('pointerup', finGlisse);
  $('poignee').addEventListener('pointercancel', finGlisse);

  /* ---------- Démarrage ---------- */
  async function preRemplir() {
    const p = new URLSearchParams(location.search);
    if (p.get('mode') === 'dispo') document.querySelector('[data-mode="dispo"]').click();
    const trouver = async (q) => { const connu = lieuxConnus(q)[0]; if (connu) return connu; try { return (await chercherAdresses(q))[0] || null; } catch (e) { return null; } };
    const qd = (p.get('depart') || '').trim(), qa = (p.get('arrivee') || '').trim();
    if (qd) etat.depart = await trouver(qd);
    if (qa && etat.mode === 'trajet') etat.arrivee = await trouver(qa);
    if (etat.depart && (etat.mode === 'dispo' || etat.arrivee)) versChoix();
    else if (qd || qa) { majAccueil(); ouvrirRecherche(etat.depart ? 'arrivee' : 'depart'); }
  }
  // Écran « pas encore disponible » tant que la réservation n'est pas ouverte dans l'admin (le suivi d'une course reste accessible)
  const majFerme = () => { $('ferme').hidden = !!tarifs?.ouvert || /suivi=[a-f0-9]{32}/.test(location.hash); };
  function routeHash() {
    majFerme();
    const m = location.hash.match(/suivi=([a-f0-9]{32})/);
    if (m) afficherSuivi(m[1]);
    else if (vueCourante === 'suivi') allerVue('accueil');
  }

  heureParDefaut();
  initCarte();
  majBadge();
  majAccueil();
  fetch(`${API}?tarifs=1`).then((r) => r.json()).then((j) => { if (j.ok) { tarifs = j.tarifs; majFerme(); if (vueCourante === 'choix') majChoix(); } }).catch(() => {});
  window.addEventListener('hashchange', routeHash);
  let delaiResize = 0;
  window.addEventListener('resize', () => { clearTimeout(delaiResize); delaiResize = setTimeout(dessinerCarte, 200); });
  routeHash();
  if (!location.hash) preRemplir();
})();
