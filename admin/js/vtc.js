/* =========================================================
   ESPACE ADMIN BDA — VTC
   Réservations faites sur bdasecurite.com/reserver (à confirmer,
   à venir, terminées) et tarifs utilisés pour le prix affiché.
   ========================================================= */
import { api, h, icone, toast, erreur, modale, confirmer, champ, saisie, zoneTexte, statutPastille, euro, cap } from './outils.js';

const STATUTS = {
  attente: ['nouvelle', 'À confirmer'], confirmee: ['publie', 'Confirmée'],
  terminee: ['archivee', 'Terminée'], annulee: ['refuse', 'Annulée'],
};
const pastille = (s) => statutPastille(...(STATUTS[s] || ['archivee', s]));
const vehiculeNom = (v) => (v === 'van' ? 'Van' : 'Berline');
const telWa = (tel) => { const d = String(tel || '').replace(/\D/g, ''); return d.startsWith('0') ? `33${d.slice(1)}` : d; };
const dateFr = (d) => (d ? d.split('-').reverse().join('/') : '');

export function pageVtc(ctx) {
  return ctx.params[0] === 'tarifs' ? pageTarifs(ctx) : pageReservations(ctx);
}
function onglets(actif) {
  return h('div', { class: 'onglets' },
    h('a', { class: `onglet ${actif === 'resa' ? 'is-actif' : ''}`, href: '#/vtc' }, 'Réservations'),
    h('a', { class: `onglet ${actif === 'tarifs' ? 'is-actif' : ''}`, href: '#/vtc/tarifs' }, 'Tarifs'));
}
function actionsCommunes(ctx) {
  const copier = async () => { try { await navigator.clipboard.writeText('https://bdasecurite.com/reserver'); toast('Lien de réservation copié.'); } catch (e) { toast('bdasecurite.com/reserver'); } };
  ctx.actions(
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: copier }, icone('copier'), h('span', null, 'Copier le lien')),
    h('a', { class: 'btn btn--gold', href: '/reserver', target: '_blank', rel: 'noopener' }, icone('site'), h('span', null, 'Page de réservation')));
}

/* =========================================================
   RÉSERVATIONS
   ========================================================= */
async function pageReservations(ctx) {
  ctx.titre('Réservations VTC');
  actionsCommunes(ctx);
  const [{ reservations }, { agents }] = await Promise.all([api('reservations'), api('agents')]);
  const maintenant = Date.now();
  const quand = (r) => new Date(r.date_course.replace(' ', 'T')).getTime();
  const aVenir = (r) => ['attente', 'confirmee'].includes(r.statut) && quand(r) > maintenant - 3 * 3600e3;
  const n = { venir: reservations.filter(aVenir).length, attente: reservations.filter((r) => r.statut === 'attente').length };
  let filtre = n.attente ? 'attente' : 'venir';

  const chips = h('div', { class: 'chips' });
  const liste = h('div', { class: 'courses-admin' });
  const FILTRES = [['venir', 'À venir', aVenir], ['attente', 'À confirmer', (r) => r.statut === 'attente'], ['terminee', 'Terminées', (r) => r.statut === 'terminee'], ['annulee', 'Annulées', (r) => r.statut === 'annulee'], ['tous', 'Toutes', () => true]];
  const dessinerChips = () => chips.replaceChildren(...FILTRES.map(([k, l, f]) => h('button', {
    type: 'button', class: `chip ${filtre === k ? 'is-actif' : ''}`, onclick: () => { filtre = k; dessinerChips(); dessiner(); },
  }, l, h('span', null, reservations.filter(f).length))));

  function libelleJour(d) {
    const j = new Date(d); j.setHours(0, 0, 0, 0);
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const ecart = Math.round((j - auj) / 864e5);
    if (ecart === 0) return 'Aujourd\'hui';
    if (ecart === 1) return 'Demain';
    if (ecart === -1) return 'Hier';
    return cap(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: j.getFullYear() !== auj.getFullYear() ? 'numeric' : undefined }).format(j));
  }
  function carteCourse(r) {
    const d = r.data;
    return h('button', { type: 'button', class: `course course--${r.statut}`, onclick: () => ouvrir(r) },
      h('div', { class: 'course__heure' }, h('b', null, d.heure), h('small', null, vehiculeNom(d.vehicule))),
      h('div', { class: 'course__trajet' },
        h('span', null, h('i', { class: 'point-depart' }), d.depart?.label || '—'),
        d.mode === 'dispo' ? h('span', null, icone('horloge'), `Mise à disposition · ${d.heures} h`) : h('span', null, h('i', { class: 'point-arrivee' }), d.arrivee?.label || '—'),
        h('small', null, [d.nom, `${d.passagers} pers.`, d.vol ? `vol ${d.vol}` : '', d.chauffeur ? `chauffeur : ${d.chauffeur}` : ''].filter(Boolean).join(' · '))),
      h('div', { class: 'course__droite' }, h('b', null, euro.format(r.prix)), pastille(r.statut)));
  }
  function dessiner() {
    const f = FILTRES.find(([k]) => k === filtre)[2];
    const vis = reservations.filter(f).sort((a, b) => (filtre === 'venir' || filtre === 'attente' ? quand(a) - quand(b) : quand(b) - quand(a)));
    if (!vis.length) {
      liste.replaceChildren(h('div', { class: 'vide' }, icone('voiture'), h('p', null, reservations.length ? 'Aucune course ici.' : 'Les réservations faites sur bdasecurite.com/reserver arriveront ici. Partagez le lien à vos clients !')));
      return;
    }
    const groupes = new Map();
    vis.forEach((r) => { const k = r.date_course.slice(0, 10); if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(r); });
    liste.replaceChildren(...[...groupes.entries()].map(([jour, rs]) => h('section', { class: 'jour' }, h('h3', null, libelleJour(`${jour}T12:00`), h('span', null, `${rs.length} course${rs.length > 1 ? 's' : ''}`)), rs.map(carteCourse))));
  }

  async function ouvrir(r) {
    const d = r.data;
    const prix = saisie({ value: String(r.prix).replace('.', ','), inputmode: 'decimal' });
    const chauffeurs = agents.filter((a) => +a.actif);
    const chauffeur = saisie({ value: d.chauffeur || '', list: 'liste-chauffeurs', placeholder: 'Nom du chauffeur' });
    const liste = h('datalist', { id: 'liste-chauffeurs' }, chauffeurs.map((a) => h('option', { value: a.nom })));
    const note = zoneTexte({ value: d.note || '', rows: 2, placeholder: 'Note interne (le client ne la voit pas)' });
    const lireForm = () => ({ prix: parseFloat(prix.value.replace(',', '.')) || 0, chauffeur: chauffeur.value.trim(), note: note.value });
    const quandTxt = `${dateFr(d.date)} à ${d.heure}`;
    const msg = (etatTxt) => `Bonjour ${d.nom}, c'est BDA VTC. Votre course du ${quandTxt} (${d.depart?.label}${d.mode === 'dispo' ? ` · mise à disposition ${d.heures} h` : ` → ${d.arrivee?.label}`}) est ${etatTxt}${chauffeur.value.trim() ? `. Votre chauffeur : ${chauffeur.value.trim()}` : ''}. Prix : ${prix.value} €. Merci de votre confiance !`;
    const itineraire = d.mode === 'trajet' && d.arrivee
      ? `https://www.google.com/maps/dir/?api=1&origin=${d.depart.lat},${d.depart.lon}&destination=${d.arrivee.lat},${d.arrivee.lon}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${d.depart?.lat},${d.depart?.lon}`;
    const ligne = (a, b) => (b ? [h('dt', null, a), h('dd', null, b)] : null);
    const choix = await modale({
      titre: `${r.ref} · ${quandTxt}`,
      large: true,
      contenu: [
        h('div', { class: 'detail-course' },
          h('div', { class: 'detail-course__trajet' },
            h('span', null, h('i', { class: 'point-depart' }), d.depart?.label),
            d.mode === 'dispo' ? h('span', null, icone('horloge'), `Mise à disposition · ${d.heures} h`) : h('span', null, h('i', { class: 'point-arrivee' }), d.arrivee?.label),
            d.mode === 'trajet' ? h('small', null, `${String(d.km).replace('.', ',')} km · environ ${d.min} min`) : null),
          pastille(r.statut)),
        h('dl', { class: 'details' },
          ligne('Client', d.nom), ligne('Téléphone', d.tel), ligne('Email', d.email),
          ligne('Véhicule', `${vehiculeNom(d.vehicule)} · ${d.passagers} passager(s) · ${d.bagages} bagage(s)`),
          ligne('Vol / train', d.vol), ligne('Siège(s) enfant', d.sieges ? String(d.sieges) : ''), ligne('Pancarte', d.pancarte ? 'Oui' : ''),
          ligne('Message', d.message), ligne('Prix estimé par le site', euro.format(d.prixEstime || 0)), ligne('Reçue le', new Date(r.recu.replace(' ', 'T')).toLocaleString('fr-FR'))),
        h('div', { class: 'modale__raccourcis' },
          h('a', { class: 'btn btn--ghost', href: `tel:${String(d.tel).replace(/[^\d+]/g, '')}` }, icone('telephone'), 'Appeler'),
          h('a', { class: 'btn btn--ghost', href: '#', onclick: (e) => { e.preventDefault(); window.open(`https://wa.me/${telWa(d.tel)}?text=${encodeURIComponent(msg(r.statut === 'confirmee' ? 'bien confirmée' : 'confirmée'))}`, '_blank', 'noopener'); } }, icone('envoyer'), 'WhatsApp de confirmation'),
          h('a', { class: 'btn btn--ghost', href: itineraire, target: '_blank', rel: 'noopener' }, icone('site'), 'Itinéraire')),
        h('div', { class: 'form-grille form-grille--2' }, champ('Prix final (€)', prix), champ('Chauffeur', chauffeur, chauffeurs.length ? 'Choisissez dans vos agents ou tapez un nom.' : '')),
        liste, champ('Note interne', note),
      ],
      actions: [
        { libelle: 'Supprimer', classe: 'btn--danger-ghost', valeur: 'supprimer' },
        { libelle: 'Créer la facture', classe: 'btn--ghost', valeur: 'facture' },
        r.statut !== 'annulee' && r.statut !== 'terminee' ? { libelle: 'Annuler la course', classe: 'btn--ghost', valeur: 'annulee' } : null,
        r.statut === 'confirmee' ? { libelle: 'Marquer terminée', classe: 'btn--ghost', valeur: 'terminee' } : null,
        { libelle: r.statut === 'attente' ? 'Confirmer la course' : 'Enregistrer', classe: 'btn--gold', submit: true, action: () => (r.statut === 'attente' ? 'confirmee' : 'enregistrer') },
      ].filter(Boolean),
    });
    if (!choix) return;
    try {
      if (choix === 'supprimer') {
        if (!(await confirmer(`Supprimer définitivement la réservation ${r.ref} ?`, { ok: 'Supprimer', danger: true }))) return;
        await api('reservation.supprimer', { id: r.id });
        reservations.splice(reservations.indexOf(r), 1);
        toast('Réservation supprimée.');
      } else if (choix === 'facture') {
        const f = lireForm();
        await api('reservation.modifier', { id: r.id, ...f });
        sessionStorage.setItem('bda-prefill-facture', JSON.stringify({
          client: { nom: d.nom, adresse: [d.tel ? `TÉL : ${d.tel}` : '', d.email].filter(Boolean).join('\n') },
          periode: dateFr(d.date),
          lignes: [{ designation: `Course VTC du ${quandTxt} — ${d.depart?.label}${d.mode === 'dispo' ? ` (mise à disposition ${d.heures} h)` : ` → ${d.arrivee?.label}`}`, qte: 1, unite: 'u', pu: f.prix }],
        }));
        return ctx.aller('#/factures/nouveau');
      } else {
        const f = lireForm();
        const statut = ['confirmee', 'terminee', 'annulee'].includes(choix) ? choix : r.statut;
        if (choix === 'annulee' && !(await confirmer(`Annuler la course ${r.ref} ?${d.email ? ' Le client sera prévenu par email.' : ''}`, { ok: 'Annuler la course', danger: true }))) return;
        await api('reservation.modifier', { id: r.id, statut, ...f });
        Object.assign(r, { statut, prix: f.prix });
        Object.assign(d, { chauffeur: f.chauffeur, note: f.note });
        toast(statut === 'confirmee' && choix === 'confirmee' ? `Course confirmée${d.email ? ' : le client est prévenu par email' : ''}. Pensez au WhatsApp !` : 'Réservation mise à jour.');
      }
      dessinerChips(); dessiner(); ctx.compteurs();
    } catch (e) { erreur(e); }
  }

  ctx.afficher(onglets('resa'), h('section', { class: 'carte' }, h('div', { class: 'carte__outils' }, chips), liste));
  dessinerChips();
  dessiner();
}

/* =========================================================
   TARIFS
   ========================================================= */
async function pageTarifs(ctx) {
  ctx.titre('Tarifs VTC');
  actionsCommunes(ctx);
  const { tarifs: t } = await api('vtc.tarifs');
  const num = (v) => saisie({ value: String(v).replace('.', ','), inputmode: 'decimal' });
  const lire = (el) => parseFloat(String(el.value).replace(',', '.')) || 0;
  const veh = (k) => ({ prise: num(t[k].prise), km: num(t[k].km), min: num(t[k].min), minimum: num(t[k].minimum), heure: num(t[k].heure), places: num(t[k].places), bagages: num(t[k].bagages) });
  const f = { berline: veh('berline'), van: veh('van'), nuit: num(t.nuit), minHeures: num(t.minHeures), delai: num(t.delai), siege: num(t.siege), pancarte: num(t.pancarte) };
  const afficher = h('input', { type: 'checkbox', checked: !!t.afficherPrix });
  const ouvert = h('input', { type: 'checkbox', checked: !!t.ouvert });
  const forfaits = t.forfaits.map((x) => ({ code: x.code, nom: saisie({ value: x.nom }), berline: num(x.berline), van: num(x.van) }));
  const bloc = (titre, sous, ...enfants) => h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, titre), sous ? h('small', null, sous) : null), enfants);
  const colonneVeh = (k, nom) => h('div', { class: 'form-grille' }, h('h3', { class: 'sous-titre' }, nom),
    h('div', { class: 'form-grille form-grille--2' }, champ('Prise en charge (€)', f[k].prise), champ('Prix au km (€)', f[k].km), champ('Prix à la minute (€)', f[k].min), champ('Course minimum (€)', f[k].minimum)),
    h('div', { class: 'form-grille form-grille--2' }, champ('Mise à disposition (€ / heure)', f[k].heure), champ('Places passagers', f[k].places)));

  const form = h('form', { class: 'parametres', onsubmit: async (e) => {
    e.preventDefault();
    const donnees = {
      ouvert: ouvert.checked,
      afficherPrix: afficher.checked,
      berline: Object.fromEntries(Object.entries(f.berline).map(([k, el]) => [k, lire(el)])),
      van: Object.fromEntries(Object.entries(f.van).map(([k, el]) => [k, lire(el)])),
      nuit: lire(f.nuit), minHeures: lire(f.minHeures), delai: lire(f.delai), siege: lire(f.siege), pancarte: lire(f.pancarte),
      forfaits: forfaits.map((x) => ({ code: x.code, nom: x.nom.value, berline: lire(x.berline), van: lire(x.van) })),
    };
    try { await api('vtc.tarifs.enregistrer', donnees); toast('Tarifs enregistrés : la page de réservation les utilise tout de suite.'); } catch (err) { erreur(err); }
  } },
  bloc('Réservation en ligne', null, h('label', { class: 'case' }, ouvert, h('span', null, 'Ouvrir la réservation VTC au public sur le site')),
    h('p', { class: 'astuce' }, "Décoché, les boutons « Réserver un VTC » sont masqués et les visiteurs voient « Cette option n'est pas encore disponible ». Rien n'est supprimé : cochez pour tout remettre en ligne.")),
  bloc('Affichage', null, h('label', { class: 'case' }, afficher, h('span', null, 'Afficher le prix estimé aux clients sur la page de réservation')),
    h('p', { class: 'astuce' }, 'Décoché, la page indique « Prix confirmé par téléphone » : vous donnez le prix vous-même en confirmant la course.')),
  bloc('Véhicules', 'Trajet = prise en charge + km + minutes (jamais moins que la course minimum)',
    h('div', { class: 'grille-2' }, colonneVeh('berline', 'Berline'), colonneVeh('van', 'Van'))),
  bloc('Forfaits aéroports', 'Prix fixe pour un trajet entre Paris (75) et l\'aéroport, dans un sens ou dans l\'autre',
    h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau tableau--form' },
      h('thead', null, h('tr', null, h('th', null, 'Trajet'), h('th', null, 'Berline (€)'), h('th', null, 'Van (€)'))),
      h('tbody', null, forfaits.map((x) => h('tr', null, h('td', null, x.nom), h('td', null, x.berline), h('td', null, x.van))))))),
  bloc('Options et règles', null, h('div', { class: 'form-grille form-grille--2' },
    champ('Majoration de nuit, 22 h – 6 h (%)', f.nuit), champ('Réservation au moins … heures à l\'avance', f.delai),
    champ('Mise à disposition : durée minimum (heures)', f.minHeures), champ('Siège enfant (€ par siège)', f.siege),
    champ('Accueil avec pancarte (€, 0 = offert)', f.pancarte))),
  h('div', { class: 'barre-enregistrer' }, h('button', { class: 'btn btn--gold', type: 'submit' }, icone('coche'), 'Enregistrer les tarifs')));

  ctx.afficher(onglets('tarifs'), h('p', { class: 'astuce' }, 'Ces tarifs calculent le prix estimé affiché sur bdasecurite.com/reserver. Vous confirmez toujours le prix final en validant la course.'), form);
}
