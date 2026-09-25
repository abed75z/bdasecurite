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

  // Aéroports et gares : proposés en un geste
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

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, ...enfants) => { const e = document.createElement(tag); if (cls) e.className = cls; enfants.flat().forEach((c) => c != null && e.append(c)); return e; };
  const icone = (nom) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ic'); const u = document.createElementNS(s.namespaceURI, 'use'); u.setAttribute('href', `#i-${nom}`); s.append(u); return s; };
  const normaliser = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const pad = (n) => String(n).padStart(2, '0');
  const remplir = (noeud, ...enfants) => noeud.replaceChildren(...enfants.filter((c) => c != null && c !== false));
  const euros = (n) => `${Math.round(n)} €`;
  const lireCourses = () => { try { return JSON.parse(localStorage.getItem(CLE_COURSES) || '[]'); } catch (e) { return []; } };
  const toast = (txt) => { const t = $('toast'); t.textContent = txt; t.classList.add('is-in'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('is-in'), 2600); };

  const etat = { mode: 'trajet', depart: null, arrivee: null, passagers: 1, bagages: 1, heures: 3, sieges: 0, vehicule: 'berline', route: null };
  let tarifs = null;

  /* ---------- Carte ---------- */
  let carte = null, calque = null;
  function initCarte() {
    if (!window.L) return;
    carte = L.map('carte', { zoomControl: false, attributionControl: true }).setView([48.8566, 2.3522], 11);
    L.tileLayer(TUILES, { maxZoom: 18, attribution: '© <a href="https://www.ign.fr" target="_blank" rel="noopener">IGN</a> Géoplateforme' }).addTo(carte);
    calque = L.layerGroup().addTo(carte);
  }
  function dessinerCarte() {
    if (!carte) return;
    carte.invalidateSize();
    calque.clearLayers();
    const points = [];
    const repere = (p, cls) => { L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html: `<div class="repere ${cls}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] }), keyboard: false }).addTo(calque); points.push([p.lat, p.lon]); };
    if (etat.depart) repere(etat.depart, '');
    if (etat.mode === 'trajet' && etat.arrivee) repere(etat.arrivee, 'repere--arrivee');
    if (etat.mode === 'trajet' && etat.route?.geo?.length) {
      const ligne = etat.route.geo.map(([lon, lat]) => [lat, lon]);
      L.polyline(ligne, { color: '#000', weight: 8, opacity: 0.35 }).addTo(calque);
      L.polyline(ligne, { color: '#e3c27e', weight: 4, opacity: 1 }).addTo(calque);
      ligne.forEach((p) => points.push(p));
    }
    const bas = window.matchMedia('(min-width: 980px)').matches ? 60 : 70;
    carte.stop();
    if (points.length > 1) carte.fitBounds(points, { paddingTopLeft: [40, 80], paddingBottomRight: [40, bas], maxZoom: 15, animate: false });
    else if (points.length === 1) carte.setView(points[0], 14, { animate: false });
    const info = $('trajet-info');
    if (etat.mode === 'trajet' && etat.route) {
      info.replaceChildren(icone('voiture'), `${etat.route.km.toFixed(1).replace('.', ',')} km · ${dureeTexte(etat.route.min)}`);
      info.hidden = false;
    } else info.hidden = true;
  }
  const dureeTexte = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${pad(Math.round(min % 60))}` : `${Math.max(1, Math.round(min))} min`);

  /* ---------- Adresses (recherche au fil de la frappe) ---------- */
  function codeAeroport(label) {
    const n = normaliser(label);
    if (!/aeroport|airport/.test(n)) return '';
    if (/charles de gaulle|roissy|\bcdg\b/.test(n)) return 'CDG';
    if (/\borly\b/.test(n)) return 'ORY';
    if (/beauvais/.test(n)) return 'BVA';
    return '';
  }
  async function chercherAdresses(q, signal) {
    const r = await fetch(`${GEO}/search?q=${encodeURIComponent(q)}&limit=5&autocomplete=1&index=address&lat=48.8566&lon=2.3522`, { signal });
    const j = await r.json();
    return (j.features || []).map((f) => ({ label: f.properties.label, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], cp: String(f.properties.postcode || ''), code: codeAeroport(f.properties.label), type: 'adresse', detail: f.properties.context || '' }));
  }
  function lieuxConnus(q) {
    const n = normaliser(q);
    if (n.length < 2) return [];
    const mots = n.split(' ');
    return LIEUX.filter((l) => mots.every((m) => l.mots.includes(m)));
  }
  function champLieu(cle) {
    const input = $(cle), liste = $(`sugg-${cle}`), bloc = input.closest('.lieu');
    let delai, ctrl, resultats = [], actif = -1;
    const fermer = () => { liste.hidden = true; input.setAttribute('aria-expanded', 'false'); actif = -1; };
    const afficher = () => {
      liste.replaceChildren(...(resultats.length ? resultats.map((r, i) => {
        const li = el('li', '', icone(r.type === 'avion' ? 'avion' : r.type === 'train' ? 'train' : 'pin'), el('span', '', el('b', '', r.label), r.detail ? el('small', '', r.detail) : null));
        li.setAttribute('role', 'option'); li.id = `${cle}-opt-${i}`;
        if (i === actif) li.setAttribute('aria-selected', 'true');
        li.addEventListener('pointerdown', (e) => { e.preventDefault(); choisir(r); });
        return li;
      }) : [el('li', 'vide', 'Aucune adresse trouvée')]));
      liste.hidden = false; input.setAttribute('aria-expanded', 'true');
      input.setAttribute('aria-activedescendant', actif >= 0 ? `${cle}-opt-${actif}` : '');
    };
    const choisir = (r) => { input.value = r.label; fermer(); definirLieu(cle, r); };
    input.addEventListener('input', () => {
      if (etat[cle]) definirLieu(cle, null, true);
      clearTimeout(delai);
      const q = input.value.trim();
      if (q.length < 2) { fermer(); return; }
      delai = setTimeout(async () => {
        const connus = lieuxConnus(q);
        let adresses = [];
        if (q.length >= 3) {
          ctrl?.abort(); ctrl = new AbortController();
          try { adresses = await chercherAdresses(q, ctrl.signal); } catch (e) { if (e.name === 'AbortError') return; }
        }
        resultats = [...connus.slice(0, 3), ...adresses]; actif = -1;
        afficher();
      }, 220);
    });
    input.addEventListener('keydown', (e) => {
      if (liste.hidden || !resultats.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); actif = (actif + (e.key === 'ArrowDown' ? 1 : -1) + resultats.length) % resultats.length; afficher(); }
      else if (e.key === 'Enter') { e.preventDefault(); choisir(resultats[Math.max(0, actif)]); }
      else if (e.key === 'Escape') fermer();
    });
    input.addEventListener('blur', () => setTimeout(fermer, 150));
    return { input, bloc };
  }
  const champs = {};
  async function definirLieu(cle, lieu, silencieux) {
    etat[cle] = lieu ? { label: lieu.label, lat: lieu.lat, lon: lieu.lon, cp: lieu.cp || '', code: lieu.code || '' } : null;
    champs[cle].bloc.classList.toggle('is-ok', !!lieu);
    if (lieu) champs[cle].input.value = lieu.label;
    if (!silencieux) { await calculerTrajet(); if (cle === 'depart' && lieu && etat.mode === 'trajet' && !etat.arrivee) champs.arrivee.input.focus(); }
    else { etat.route = null; dessinerCarte(); }
  }

  /* ---------- Itinéraire ---------- */
  const distanceVol = (a, b) => { const R = 6371, r = Math.PI / 180, x = (b.lat - a.lat) * r, y = (b.lon - a.lon) * r; const h = Math.sin(x / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))); };
  async function calculerTrajet() {
    etat.route = null;
    if (etat.mode === 'trajet' && etat.depart && etat.arrivee) {
      const d = etat.depart, a = etat.arrivee;
      try {
        const url = `${ITINERAIRE}?resource=bdtopo-osrm&start=${d.lon},${d.lat}&end=${a.lon},${a.lat}&profile=car&optimization=fastest&distanceUnit=kilometer&timeUnit=minute&geometryFormat=geojson&getSteps=false`;
        const j = await (await fetch(url)).json();
        if (!(j.distance > 0)) throw new Error('itinéraire');
        etat.route = { km: j.distance, min: j.duration, geo: j.geometry?.coordinates || [] };
      } catch (e) {
        const km = distanceVol(d, a) * 1.3;
        etat.route = { km, min: km * 2, geo: [[d.lon, d.lat], [a.lon, a.lat]] };
      }
    }
    dessinerCarte();
    majBouton1();
  }

  /* ---------- Prix (même calcul que le serveur) ---------- */
  const estParis = (p) => !!p && String(p.cp).startsWith('75');
  function prix(veh) {
    if (!tarifs) return null;
    const v = tarifs[veh];
    let base;
    if (etat.mode === 'dispo') base = Math.max(+tarifs.minHeures, etat.heures) * v.heure;
    else {
      if (!etat.route) return null;
      const f = (tarifs.forfaits || []).find((x) => (etat.depart?.code === x.code && estParis(etat.arrivee)) || (etat.arrivee?.code === x.code && estParis(etat.depart)));
      base = f ? +f[veh] : Math.max(+v.minimum, +v.prise + etat.route.km * v.km + etat.route.min * v.min);
    }
    if (estNuit()) base *= 1 + tarifs.nuit / 100;
    base += etat.sieges * tarifs.siege + ($('pancarte').checked ? +tarifs.pancarte : 0);
    return Math.round(base);
  }
  const estNuit = () => { const h = +($('heure').value || '12').slice(0, 2); return h >= 22 || h < 6; };

  /* ---------- Étapes ---------- */
  let etapeCourante = '1';
  function allerA(n) {
    etapeCourante = String(n);
    document.querySelectorAll('.etape').forEach((s) => s.classList.toggle('is-active', s.dataset.etape === etapeCourante));
    const num = +n;
    const barre = document.querySelector('.etapes');
    barre.classList.toggle('is-cache', !(num >= 1 && num <= 3));
    [...barre.children].forEach((li, i) => { li.classList.toggle('is-actif', i + 1 === num); li.classList.toggle('is-fait', i + 1 < num); });
    if (window.matchMedia('(min-width: 980px)').matches) $('panneau').scrollTo({ top: 0, behavior: 'smooth' });
    else $('panneau').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.querySelectorAll('[data-retour]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.retour === '1' && location.hash) history.replaceState(null, '', location.pathname); allerA(b.dataset.retour); }));

  function erreurEtape1() {
    if (!etat.depart) return 'Choisissez l\'adresse de départ dans la liste.';
    if (etat.mode === 'trajet' && !etat.arrivee) return 'Choisissez la destination dans la liste.';
    if (etat.mode === 'trajet' && !etat.route) return 'Calcul du trajet en cours…';
    const d = $('date').value, h = $('heure').value;
    if (!d || !h) return 'Indiquez la date et l\'heure de prise en charge.';
    const quand = new Date(`${d}T${h}`);
    const delai = tarifs ? +tarifs.delai : 2;
    if (quand.getTime() < Date.now() + delai * 3600e3) return `Réservez au moins ${delai} h à l'avance. Pour une course immédiate, appelez le 06 11 67 86 25.`;
    return '';
  }
  function majBouton1() { $('erreur-1').textContent = ''; }
  $('vers-2').addEventListener('click', () => {
    const e = erreurEtape1();
    $('erreur-1').textContent = e;
    if (e) return;
    dessinerVehicules();
    allerA(2);
  });

  function dessinerVehicules() {
    const r = $('resume-trajet');
    const quand = new Date(`${$('date').value}T${$('heure').value}`);
    const jour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(quand);
    r.replaceChildren(
      el('span', '', el('i'), el('em', '', etat.depart.label)),
      etat.mode === 'trajet' ? el('span', '', el('i', 'fin'), el('em', '', etat.arrivee.label)) : el('span', '', icone('horloge'), el('em', '', `Mise à disposition · ${etat.heures} h`)),
      el('small', '', `${jour} à ${$('heure').value}${etat.route ? ` · ${etat.route.km.toFixed(1).replace('.', ',')} km · ${dureeTexte(etat.route.min)}` : ''}`));
    const zone = $('vehicules');
    const cartes = ['berline', 'van'].map((veh) => {
      const v = tarifs ? tarifs[veh] : { nom: veh === 'van' ? 'Van' : 'Berline', places: veh === 'van' ? 7 : 3, bagages: veh === 'van' ? 7 : 3 };
      const trop = etat.passagers > v.places;
      const p = prix(veh);
      const b = el('button', `vehicule ${etat.vehicule === veh ? 'is-actif' : ''}`,
        el('span', 'vehicule__ic', icone(veh === 'van' ? 'van' : 'voiture')),
        el('span', 'vehicule__txt', el('b', '', `${v.nom} premium`), el('small', '', veh === 'van' ? 'Groupes, familles, bagages volumineux' : 'Confort et discrétion, idéale pour 1 à 3 personnes'),
          el('span', '', el('span', '', `👤 ${v.places}`), el('span', '', `🧳 ${v.bagages}`))),
        el('span', 'vehicule__prix', tarifs?.afficherPrix && p != null ? [el('b', '', euros(p)), el('small', '', 'estimé')] : el('small', '', 'Prix confirmé par téléphone')));
      b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(etat.vehicule === veh));
      b.disabled = trop;
      if (trop) b.title = `${v.places} passagers maximum`;
      b.addEventListener('click', () => { etat.vehicule = veh; dessinerVehicules(); });
      return b;
    });
    if (etat.passagers > (tarifs?.berline.places || 3) && etat.vehicule === 'berline') { etat.vehicule = 'van'; return dessinerVehicules(); }
    zone.replaceChildren(...cartes);
    $('note-nuit').hidden = !(estNuit() && tarifs?.nuit > 0);
    $('note-nuit').textContent = tarifs ? `Course de nuit (22 h – 6 h) : majoration de ${tarifs.nuit} % incluse.` : '';
    $('prix-pancarte').textContent = tarifs && +tarifs.pancarte ? `+ ${euros(tarifs.pancarte)}` : 'Offert';
  }
  $('pancarte').addEventListener('change', dessinerVehicules);
  $('vers-3').addEventListener('click', () => { dessinerRecap(); allerA(3); setTimeout(() => $('nom').focus({ preventScroll: true }), 400); });

  function dessinerRecap() {
    const p = prix(etat.vehicule);
    const ligne = (a, b, cls) => { const d = el('div', cls || '', el('span', '', a), el('span', '', b)); return d; };
    const quand = new Date(`${$('date').value}T${$('heure').value}`);
    remplir($('recap'),
      ligne('Date', `${new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(quand)} à ${$('heure').value}`),
      ligne('Véhicule', `${tarifs ? tarifs[etat.vehicule].nom : ''} premium · ${etat.passagers} pers.`),
      etat.mode === 'dispo' ? ligne('Durée', `${Math.max(etat.heures, tarifs ? +tarifs.minHeures : 1)} h`) : ligne('Trajet', `${etat.route.km.toFixed(1).replace('.', ',')} km · ${dureeTexte(etat.route.min)}`),
      etat.sieges ? ligne('Siège(s) enfant', String(etat.sieges)) : null,
      $('pancarte').checked ? ligne('Accueil pancarte', 'Oui') : null,
      ligne('Prix estimé', tarifs?.afficherPrix && p != null ? euros(p) : 'confirmé par téléphone', 'total'));
    $('prix-cta').textContent = tarifs?.afficherPrix && p != null ? euros(p) : '';
    $('prix-cta').hidden = !(tarifs?.afficherPrix && p != null);
  }

  /* ---------- Envoi ---------- */
  $('form-resa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('erreur-3');
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
      date: $('date').value, heure: $('heure').value, passagers: etat.passagers, bagages: etat.bagages, heures: etat.heures,
      km: etat.route?.km || 0, min: etat.route?.min || 0, sieges: etat.sieges, pancarte: $('pancarte').checked,
      vol: $('vol').value.trim(), message: $('message').value.trim(), nom, tel, email, site_web: $('site_web').value,
    };
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(donnees) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.erreur || 'L\'envoi a échoué. Réessayez ou appelez-nous au 06 11 67 86 25.');
      const course = { ref: j.ref, jeton: j.jeton, date: donnees.date, heure: donnees.heure, depart: etat.depart.label, arrivee: etat.arrivee?.label || '', mode: etat.mode, prix: j.prix };
      if (j.jeton) { const liste = [course, ...lireCourses().filter((c) => c.ref !== j.ref)].slice(0, 20); try { localStorage.setItem(CLE_COURSES, JSON.stringify(liste)); } catch (x) { /* stockage indisponible */ } }
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
    $('wa-confirmer').href = `https://wa.me/33784739070?text=${encodeURIComponent(`Bonjour BDA, je viens de réserver une course (réf. ${c.ref}) pour le ${quand}. Pouvez-vous me la confirmer ?`)}`;
    $('lien-suivi').href = `#suivi=${c.jeton}`;
    $('calendrier').onclick = () => telechargerIcs(c);
    allerA(4);
  }

  // Événement pour le calendrier du téléphone (.ics)
  function telechargerIcs(c) {
    const debut = `${c.date.replace(/-/g, '')}T${c.heure.replace(':', '')}00`;
    const fin = new Date(`${c.date}T${c.heure}`); fin.setMinutes(fin.getMinutes() + Math.max(30, Math.round(etat.route?.min || 60)));
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

  /* ---------- Suivi d'une réservation (#suivi=jeton) ---------- */
  async function afficherSuivi(jeton) {
    const zone = $('suivi');
    zone.replaceChildren(el('p', '', 'Chargement…'));
    allerA('suivi');
    try {
      const j = await (await fetch(`${API}?suivi=${encodeURIComponent(jeton)}`)).json();
      if (!j.ok) throw new Error(j.erreur || 'Réservation introuvable.');
      dessinerSuivi(j.reservation, jeton);
    } catch (e) { zone.replaceChildren(el('p', 'erreur', e.message)); }
  }
  function dessinerSuivi(r, jeton) {
    const zone = $('suivi');
    const ordre = ['attente', 'confirmee', 'terminee'];
    const rang = ordre.indexOf(r.statut);
    const etapeS = (txt, i) => el('div', i <= rang ? 'is-fait' : '', el('i', '', i <= rang ? icone('coche') : String(i + 1)), txt);
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
    remplir(zone,
      r.statut === 'annulee' ? el('p', 'statut--annulee', 'Cette réservation est annulée.') : el('div', 'statut', etapeS('Reçue', 0), etapeS('Confirmée', 1), etapeS('Terminée', 2)),
      el('div', 'resume-trajet',
        el('b', '', `Réservation ${r.ref}`),
        el('span', '', el('i'), el('em', '', r.depart)),
        r.mode === 'trajet' ? el('span', '', el('i', 'fin'), el('em', '', r.arrivee)) : el('span', '', icone('horloge'), el('em', '', `Mise à disposition · ${r.heures} h`)),
        el('small', '', `${new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(quand)} à ${r.heure} · ${r.vehicule === 'van' ? 'Van' : 'Berline'} · ${r.passagers} pers.`),
        r.chauffeur ? el('small', '', `Votre chauffeur : ${r.chauffeur}`) : null,
        r.prix ? el('small', '', `Prix : ${euros(r.prix)}${r.statut === 'attente' ? ' (estimé)' : ''}`) : null),
      el('div', 'suivi-actions',
        Object.assign(el('a', 'bouton', icone('tel'), 'Appeler'), { href: 'tel:+33611678625' }),
        Object.assign(el('a', 'bouton', icone('wa'), 'WhatsApp'), { href: `https://wa.me/33784739070?text=${encodeURIComponent(`Bonjour BDA, au sujet de ma réservation ${r.ref}.`)}`, target: '_blank', rel: 'noopener' })),
      annulable ? annuler : null);
  }

  /* ---------- Mes courses (sur ce téléphone) ---------- */
  function majBadge() { const n = lireCourses().length; $('nb-courses').textContent = n; $('nb-courses').hidden = !n; }
  $('btn-courses').addEventListener('click', () => {
    const liste = lireCourses();
    $('liste-courses').replaceChildren(...(liste.length ? liste.map((c) => {
      const a = el('a', '', el('b', '', `${c.date.split('-').reverse().join('/')} à ${c.heure} · ${c.ref}`), el('small', '', c.mode === 'dispo' ? `${c.depart} · mise à disposition` : `${c.depart} → ${c.arrivee}`));
      a.href = `#suivi=${c.jeton}`;
      a.addEventListener('click', () => { $('feuille-courses').hidden = true; });
      return el('li', '', a);
    }) : [el('li', 'vide', 'Vos réservations faites sur ce téléphone apparaîtront ici.')]));
    $('feuille-courses').hidden = false;
  });
  document.querySelectorAll('[data-fermer]').forEach((b) => b.addEventListener('click', () => { $('feuille-courses').hidden = true; }));

  /* ---------- Réglages de l'étape 1 ---------- */
  document.querySelectorAll('.bascule button').forEach((b) => b.addEventListener('click', () => {
    etat.mode = b.dataset.mode;
    document.querySelectorAll('.bascule button').forEach((x) => { x.classList.toggle('is-actif', x === b); x.setAttribute('aria-checked', String(x === b)); });
    $('bloc-arrivee').hidden = etat.mode === 'dispo';
    document.querySelector('[data-compteur="heures"]').hidden = etat.mode !== 'dispo';
    $('t1').textContent = etat.mode === 'dispo' ? 'Où venons-nous vous chercher ?' : 'Où allez-vous ?';
    calculerTrajet();
  }));
  const BORNES = { passagers: [1, 7], bagages: [0, 10], heures: [1, 12], sieges: [0, 3] };
  document.querySelectorAll('.compteur').forEach((c) => {
    const cle = c.dataset.compteur, [mini, maxi] = BORNES[cle], val = c.querySelector('b');
    const maj = () => { val.textContent = etat[cle]; c.querySelector('[data-pas="-1"]').disabled = etat[cle] <= mini; c.querySelector('[data-pas="1"]').disabled = etat[cle] >= maxi; };
    c.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { etat[cle] = Math.min(maxi, Math.max(mini, etat[cle] + +b.dataset.pas)); maj(); if (cle === 'sieges') dessinerVehicules(); }));
    maj();
  });
  $('inverser').addEventListener('click', () => {
    const d = etat.depart, a = etat.arrivee;
    etat.depart = a; etat.arrivee = d;
    champs.depart.input.value = a?.label || ''; champs.arrivee.input.value = d?.label || '';
    champs.depart.bloc.classList.toggle('is-ok', !!a); champs.arrivee.bloc.classList.toggle('is-ok', !!d);
    calculerTrajet();
  });
  $('ma-position').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Position indisponible sur cet appareil.');
    toast('Recherche de votre position…');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const j = await (await fetch(`${GEO}/reverse?lon=${coords.longitude}&lat=${coords.latitude}&limit=1`)).json();
        const f = j.features?.[0];
        definirLieu('depart', { label: f ? f.properties.label : 'Ma position', lat: coords.latitude, lon: coords.longitude, cp: String(f?.properties.postcode || ''), code: '' });
      } catch (e) { definirLieu('depart', { label: 'Ma position', lat: coords.latitude, lon: coords.longitude, cp: '', code: '' }); }
    }, () => toast('Autorisez la localisation, ou tapez votre adresse.'), { enableHighAccuracy: true, timeout: 10000 });
  });
  function dessinerRaccourcis() {
    $('raccourcis').replaceChildren(...LIEUX.map((l) => {
      const b = el('button', 'raccourci', icone(l.type), l.court);
      b.type = 'button';
      b.addEventListener('click', () => {
        const cible = etat.mode === 'trajet' && etat.depart && !etat.arrivee ? 'arrivee' : etat.mode === 'dispo' || !etat.depart ? 'depart' : 'arrivee';
        definirLieu(cible, l);
      });
      return b;
    }));
  }

  /* ---------- Démarrage ---------- */
  let dateChoisie = false;
  function heureParDefaut() {
    if (dateChoisie) return;
    const d = new Date(Date.now() + ((tarifs ? +tarifs.delai : 2) + 1) * 3600e3);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    $('date').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    $('heure').value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const auj = new Date();
    $('date').min = `${auj.getFullYear()}-${pad(auj.getMonth() + 1)}-${pad(auj.getDate())}`;
  }
  // Pré-remplissage depuis l'accueil du site : /reserver?depart=…&arrivee=…
  async function preRemplir() {
    const p = new URLSearchParams(location.search);
    for (const cle of ['depart', 'arrivee']) {
      const q = (p.get(cle) || '').trim();
      if (!q) continue;
      const connu = lieuxConnus(q)[0];
      if (connu) { await definirLieu(cle, connu, cle === 'depart' && p.get('arrivee')); continue; }
      try { const [r] = await chercherAdresses(q); if (r) await definirLieu(cle, r, cle === 'depart' && p.get('arrivee')); else champs[cle].input.value = q; } catch (e) { champs[cle].input.value = q; }
    }
    if (p.get('mode') === 'dispo') document.querySelector('[data-mode="dispo"]').click();
  }
  function routeHash() {
    const m = location.hash.match(/suivi=([a-f0-9]{32})/);
    if (m) afficherSuivi(m[1]);
    else if (etapeCourante === 'suivi') allerA(1);
  }

  champs.depart = champLieu('depart');
  champs.arrivee = champLieu('arrivee');
  dessinerRaccourcis();
  majBadge();
  heureParDefaut();
  initCarte();
  $('heure').addEventListener('change', () => { dateChoisie = true; if (etapeCourante === '2') dessinerVehicules(); });
  $('date').addEventListener('change', () => { dateChoisie = true; });
  fetch(`${API}?tarifs=1`).then((r) => r.json()).then((j) => { if (j.ok) { tarifs = j.tarifs; heureParDefaut(); } }).catch(() => {});
  preRemplir();
  window.addEventListener('hashchange', routeHash);
  routeHash();
})();
