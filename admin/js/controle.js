/* =========================================================
   ESPACE ADMIN BDA — Centre de contrôle (la journée en direct)
   Alertes des agents (SOS), carte des opérations (sites et agents en poste),
   qui est en poste, qui est en retard, les postes non pourvus des 48 h, les rondes,
   les incidents, absences et cartes pro. Se met à jour toutes les 30 s.
   Données : app/exploitation.php (exp_controle). Carte : Leaflet du site + fonds IGN.
   ========================================================= */
import { api, h, icone, toast, erreur, dateLisible, ilYa, pad, cap } from './outils.js';

const ETATS = {
  en_poste: ['En poste', 'ok'], arrivee: ['Prise de poste', 'attente'], a_venir: ['À venir', 'neutre'], retard: ['Pas arrivé', 'alerte'],
  partie: ['Parti', 'neutre'], terminee: ['Terminé', 'neutre'], en_cours: ['En cours (pointage non activé)', 'neutre'], sans_pointage: ['Terminé, sans pointage', 'attention'], non_pourvue: ['Non pourvu', 'alerte'],
};
const TUILES = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
const heure = (ts) => { const d = new Date(ts * 1000); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const initiales = (nom) => String(nom || '?').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase();
const telLien = (t) => `tel:${String(t || '').replace(/\s/g, '')}`;

// Leaflet est livré avec le site (page de réservation) : chargé à la demande
let leaflet = null;
function chargerLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return (leaflet ||= new Promise((ok, ko) => {
    document.head.append(h('link', { rel: 'stylesheet', href: '/assets/vendor/leaflet/leaflet.css' }));
    const s = h('script', { src: '/assets/vendor/leaflet/leaflet.js' });
    s.onload = () => ok(window.L);
    s.onerror = () => ko(new Error('Carte indisponible.'));
    document.head.append(s);
  }));
}
// petit signal sonore quand une nouvelle alerte arrive (si le navigateur l'autorise)
function bip() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.26);
    });
  } catch (e) { /* pas de son */ }
}

export async function pageControle(ctx) {
  ctx.titre('Centre de contrôle');
  const horloge = h('b', { class: 'cc-horloge' });
  const maj = h('small', { class: 'muet' });
  const zoneAlertes = h('div', { class: 'cc-alertes' });
  const zoneChiffres = h('div');
  const zoneGrille = h('div');
  const carteEl = h('div', { class: 'cc-carte__fond' });
  const carteInfo = h('p', { class: 'cc-carte__info' });
  const carteBloc = h('section', { class: 'carte cc-carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Carte des opérations'), h('small', { class: 'cc-legende' }, h('i', { class: 'cc-l-site' }), 'Site', h('i', { class: 'cc-l-agent' }), 'Agent en poste', h('i', { class: 'cc-l-sos' }), 'Alerte')),
    carteEl, carteInfo);
  ctx.actions(
    h('a', { class: 'btn btn--ghost', href: '#/exploitation' }, icone('planning'), h('span', null, 'Planning des sites')),
    h('a', { class: 'btn btn--ghost', href: '#/pointage' }, icone('horloge'), h('span', null, 'Pointages')));
  let premier = true;
  let carte = null, calque = null, cadre = false, dernier = null;
  const vues = new Set();

  async function dessinerCarte(d) {
    try {
      const L = await chargerLeaflet();
      if (!document.body.contains(carteEl)) return;
      if (!carte) {
        carte = L.map(carteEl, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([48.8566, 2.3522], 11);
        L.tileLayer(TUILES, { maxZoom: 19, attribution: '© IGN Géoplateforme' }).addTo(carte);
        calque = L.layerGroup().addTo(carte);
      }
      calque.clearLayers();
      const points = [];
      const echapper = (t) => String(t || '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      const marque = (lat, lon, classe, html, titre) => {
        calque.addLayer(L.marker([lat, lon], { icon: L.divIcon({ className: `cc-m ${classe}`, html, iconSize: null }), title: titre }).bindTooltip(echapper(titre), { direction: 'top', offset: [0, -10] }));
        points.push([lat, lon]);
      };
      d.carte.sites.forEach((s) => marque(s.lat, s.lon, 'cc-m--site', `<span>${echapper(s.nom)}</span>`, s.nom));
      d.carte.agents.forEach((a) => marque(a.lat, a.lon, 'cc-m--agent', echapper(initiales(a.nom)), `${a.nom} · en poste depuis ${a.depuis}${a.site ? ` · ${a.site}` : ''}`));
      d.alertes.filter((a) => a.statut !== 'close' && a.lat !== null).forEach((a) => marque(+a.lat, +a.lon, 'cc-m--sos', '!', `ALERTE · ${a.agent_nom}`));
      if (points.length && !cadre) { carte.fitBounds(points, { padding: [40, 40], maxZoom: 14 }); cadre = true; }
      carteInfo.textContent = d.carte.sites.length ? '' : 'Ajoutez l’adresse de vos sites (planning des sites › nom du site) pour les voir sur la carte.';
      setTimeout(() => carte.invalidateSize(), 50);
    } catch (e) { carteInfo.textContent = e.message; }
  }

  async function charger() {
    let d;
    try { d = await api('controle'); } catch (e) { if (premier) throw e; return; }
    if (!premier && !document.body.contains(zoneGrille)) return;
    const mtn = Date.now() / 1000;
    const j = d.journee;
    const compte = (e) => j.filter((v) => v.etat === e).length;
    const retards = j.filter((v) => v.etat === 'retard');
    const s = d.semaine;

    /* ----- Alertes des agents (SOS) ----- */
    const ouvertes = d.alertes.filter((a) => a.statut !== 'close');
    if (!premier && ouvertes.some((a) => a.statut === 'ouverte' && !vues.has(a.id))) bip();
    ouvertes.forEach((a) => vues.add(a.id));
    const traiter = async (a, statut) => { try { await api('alerte.traiter', { id: a.id, statut }); toast(statut === 'close' ? 'Alerte réglée.' : 'Vous vous en occupez : c’est noté.'); charger(); ctx.compteurs?.(); } catch (e) { erreur(e); } };
    zoneAlertes.replaceChildren(...ouvertes.map((a) => h('section', { class: `cc-sos ${a.statut === 'prise' ? 'is-prise' : ''}` },
      h('span', { class: 'cc-sos__ic' }, icone('alerte')),
      h('div', { class: 'cc-sos__txt' },
        h('b', null, a.statut === 'prise' ? `Alerte prise en charge par ${a.pris_par || 'la direction'}` : 'ALERTE · un agent demande de l’aide'),
        h('span', null, `${a.agent_nom} · ${ilYa(a.quand)}${a.message ? ` · « ${a.message} »` : ''}`)),
      h('div', { class: 'cc-sos__actions' },
        a.agent_tel ? h('a', { class: 'btn btn--blanc', href: telLien(a.agent_tel) }, icone('telephone'), 'Appeler') : null,
        a.lat !== null ? h('a', { class: 'btn btn--blanc', href: `https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lon}`, target: '_blank', rel: 'noopener' }, icone('lieu'), 'Sa position') : null,
        a.statut === 'ouverte' ? h('button', { class: 'btn btn--blanc', type: 'button', onclick: () => traiter(a, 'prise') }, 'Je m’en occupe') : null,
        h('button', { class: 'btn btn--blanc-ghost', type: 'button', onclick: () => traiter(a, 'close') }, 'Réglée')))));
    document.title = ouvertes.some((a) => a.statut === 'ouverte') ? '⚠ ALERTE — Centre de contrôle' : 'Centre de contrôle — BDA Admin';

    /* ----- Chiffres du moment ----- */
    const tuile = (n, lib, ton, sous) => h('div', { class: `cc-tuile ${ton ? `is-${ton}` : ''}` }, h('b', null, String(n)), h('span', null, lib), sous ? h('small', null, sous) : null);
    zoneChiffres.replaceChildren(h('section', { class: 'cc-chiffres' },
      tuile(d.enPoste.length, 'en poste maintenant', d.enPoste.length ? 'ok' : '', 'd’après les pointages'),
      tuile(j.filter((v) => v.agent_id).length, 'postes aujourd’hui', '', `${compte('terminee') + compte('partie')} terminés`),
      tuile(retards.length, 'pas arrivés', retards.length ? 'alerte' : '', '15 min après la prise de poste'),
      tuile(d.nonPourvues.length, 'non pourvus sous 48 h', d.nonPourvues.length ? 'attention' : '', 'à placer dans le planning'),
      tuile(`${s.heures} h`, 'prévues sur 7 jours', '', `${s.vacations} postes · ${s.agents} agents`)));

    /* ----- La journée, poste par poste ----- */
    const ligne = (v) => {
      const [lib, ton] = ETATS[v.etat] || [v.etat, 'neutre'];
      const enCours = v.debut_ts <= mtn && v.fin_ts > mtn;
      const avance = enCours ? Math.min(100, ((mtn - v.debut_ts) / (v.fin_ts - v.debut_ts)) * 100) : v.fin_ts <= mtn ? 100 : 0;
      return h('div', { class: `cc-poste is-${ton}` },
        h('div', { class: 'cc-poste__h' }, h('b', null, `${heure(v.debut_ts)} – ${heure(v.fin_ts)}`), h('i', { class: 'cc-barre' }, h('i', { style: { width: `${avance}%` } }))),
        h('div', { class: 'cc-poste__qui' },
          v.agent_id ? h('span', { class: 'pl-avatar pl-avatar--petit' }, initiales(v.agent_nom)) : h('span', { class: 'pl-avatar pl-avatar--petit pl-avatar--vide' }, '?'),
          h('span', null, h('b', null, v.agent_id ? v.agent_nom : 'Personne'), h('small', null, v.site_nom || 'Site'))),
        h('span', { class: `cc-etat is-${ton}` }, lib, v.pointe_a ? h('small', null, ` · pointé ${v.pointe_a}${v.pointe_fin ? `, parti ${v.pointe_fin}` : ''}`) : null, v.confirme ? h('small', null, ' · confirmé') : null),
        h('div', { class: 'cc-poste__actions' },
          v.etat === 'retard' && v.agent_tel ? h('a', { class: 'btn btn--gold btn--petit', href: telLien(v.agent_tel) }, icone('telephone'), 'Appeler') : null,
          v.etat === 'non_pourvue' ? h('a', { class: 'btn btn--gold btn--petit', href: `#/exploitation/${v.jour}` }, 'Placer un agent') : null,
          v.agent_tel && v.etat !== 'retard' ? h('a', { class: 'icon-btn', href: telLien(v.agent_tel), title: 'Appeler' }, icone('telephone')) : null));
    };
    const journee = h('section', { class: 'carte cc-journee' },
      h('header', { class: 'carte__tete' }, h('h2', null, 'La journée'), h('small', null, j.length ? `${j.length} poste${j.length > 1 ? 's' : ''}` : '')),
      j.length ? h('div', { class: 'cc-postes' }, j.map(ligne))
        : h('div', { class: 'vide' }, icone('planning'), h('p', null, 'Aucun poste prévu aujourd’hui dans le planning des sites.'), h('a', { class: 'btn btn--gold', href: '#/exploitation' }, 'Ouvrir le planning')));

    /* ----- À surveiller ----- */
    const bloc = (titre, lignes, vide, lien) => h('section', { class: 'carte cc-bloc' },
      h('header', { class: 'carte__tete' }, h('h2', null, titre), lien ? h('a', { class: 'lien-btn', href: lien[0] }, lien[1]) : null),
      lignes.length ? h('ul', { class: 'cc-liste' }, lignes) : h('p', { class: 'muet cc-vide' }, vide));
    const auj = new Date().toISOString().slice(0, 10);
    const np = bloc('Non pourvus sous 48 h', d.nonPourvues.map((v) => h('li', null,
      h('a', { href: `#/exploitation/${v.jour}` }, h('b', null, v.site_nom || 'Site'), h('small', null, `${cap(dateLisible(v.jour))} · ${v.debut} – ${v.fin} · dans ${v.dans} h`)))), 'Tous les postes sont pourvus.', ['#/exploitation', 'Planning']);
    const rondes = bloc('Rondes du jour', d.rondes.map((r) => h('li', null,
      h('a', { href: '#/exploitation' }, h('b', null, r.site), h('small', null, `${r.passages} passage${r.passages > 1 ? 's' : ''}${r.points ? ` · ${r.points} point${r.points > 1 ? 's' : ''} de ronde` : ''} · dernier ${ilYa(r.dernier)}`)))), 'Aucun passage de ronde aujourd’hui.', null);
    const graves = { urgente: 'Urgent', info: 'Info' };
    const incidents = bloc('Main courante', d.incidents.map((m) => h('li', { class: m.gravite === 'urgente' ? 'is-alerte' : '' },
      h('a', { href: '#/equipe' }, h('b', null, `${m.categorie}${graves[m.gravite] ? ` · ${graves[m.gravite]}` : ''}`), h('small', null, `${dateLisible(m.quand, true)} · ${m.agent_nom || 'Agent'}${m.site ? ` · ${m.site}` : ''}`), h('span', null, m.texte)))), 'Rien de signalé ces 3 derniers jours.', ['#/equipe', 'Tout voir']);
    const absences = bloc('Absences', d.absences.map((a) => h('li', null,
      h('a', { href: '#/equipe' }, h('b', null, `${a.agent_nom || 'Agent'} · ${a.type}`), h('small', null, `${a.statut === 'attente' ? 'À valider · ' : ''}du ${dateLisible(a.du)} au ${dateLisible(a.au)}`)))), 'Aucune absence en cours ou à valider.', null);
    const cartes = bloc('Cartes pro', d.cartes.map((a) => h('li', { class: a.validite < auj ? 'is-alerte' : '' },
      h('a', { href: `#/agents/${a.id}` }, h('b', null, a.nom), h('small', null, `${a.validite < auj ? 'Expirée le' : 'Expire le'} ${dateLisible(a.validite)}`)))), 'Aucune carte à renouveler dans les 45 jours.', ['#/agents', 'Agents']);

    zoneGrille.replaceChildren(h('div', { class: 'cc-grille' }, journee, h('div', { class: 'cc-cote' }, np, rondes, incidents, absences, cartes)));
    maj.textContent = `Mis à jour à ${heure(Date.now() / 1000)}`;
    premier = false;
    dernier = d;
    if (document.body.contains(carteEl)) dessinerCarte(d);
  }

  const tic = () => { const d = new Date(); horloge.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  tic();
  await charger();
  if (!ctx.actuel()) return;
  ctx.afficher(h('section', { class: 'cc-entete' },
    h('div', null, h('p', { class: 'cc-surtitre' }, cap(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()))), horloge),
    h('div', { class: 'cc-direct' }, h('i', { class: 'cc-point' }), 'En direct', maj)), zoneAlertes, zoneChiffres, carteBloc, zoneGrille);
  // la carte se dessine une fois la page posée (Leaflet a besoin de la taille du cadre)
  if (dernier) dessinerCarte(dernier);
  // mise à jour toutes les 30 s tant que la page est ouverte (toutes les 10 s si une alerte attend)
  let attente = 0;
  const minuteur = setInterval(() => {
    if (!document.body.contains(zoneGrille)) { clearInterval(minuteur); carte?.remove(); return; }
    tic();
    attente += 10;
    const urgence = zoneAlertes.querySelector('.cc-sos:not(.is-prise)');
    if (!document.hidden && (urgence || attente >= 30)) { attente = 0; charger(); }
  }, 10000);
}
