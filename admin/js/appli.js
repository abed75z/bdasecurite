/* =========================================================
   ESPACE ADMIN BDA — Appli BDA (chauffeur privé)
   En direct : courses en cours, réservations à attribuer, chauffeurs en ligne.
   Courses (historique), Chauffeurs (accès à l’appli, gammes, véhicule),
   Clients, Prix & réglages (gammes, aéroports, codes promo, phase privée, mentions).
   ========================================================= */
import { h, icone, toast, erreur, modale, confirmer, champ, saisie, euro, euroRond, pad, iso, jetonCsrf, ErreurApi } from './outils.js';

async function apiAppli(action, donnees, params = {}) {
  const qs = new URLSearchParams({ a: action, ...params }).toString();
  const options = { credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (donnees !== undefined) {
    options.method = 'POST';
    options.headers['Content-Type'] = 'application/json';
    options.headers['X-CSRF'] = jetonCsrf();
    options.body = JSON.stringify(donnees);
  }
  let res;
  try { res = await fetch(`appli-api.php?${qs}`, options); } catch (e) { throw new ErreurApi('Connexion impossible. Vérifiez votre accès à internet.', 0); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new ErreurApi(json.erreur || `Erreur ${res.status}`, res.status);
  return json;
}

const STYLE = `
.ap-etat { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; }
.ap-etat p { margin: 0; flex: 1 1 320px; color: var(--text-2); font-size: 13.5px; line-height: 1.5; }
.ap-code { font: 600 15px/1 var(--mono); letter-spacing: 0.08em; padding: 7px 10px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--line); }
.ap-trajet { display: grid; gap: 2px; font-size: 13px; min-width: 180px; }
.ap-trajet small { color: var(--muted); }
.ap-chf { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.ap-chf .carte { margin: 0; }
.ap-gammes { display: flex; flex-wrap: wrap; gap: 6px; }
.ap-gammes button { padding: 6px 11px; border-radius: 99px; border: 1px solid var(--line-2); font-size: 12.5px; color: var(--text-2); background: none; cursor: pointer; }
.ap-gammes button[aria-pressed="true"] { background: var(--text); border-color: var(--text); color: var(--bg, #fff); }
.ap-prix input { width: 78px; }
.ap-prix td, .ap-prix th { white-space: nowrap; }
.ap-promo { display: grid; grid-template-columns: minmax(0, 1fr) 110px auto auto; gap: 8px; align-items: center; margin-bottom: 8px; }
.ap-ligne-inter { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
.ap-ligne-inter b { display: block; font-size: 14px; }
.ap-ligne-inter small { color: var(--muted); font-size: 12px; }
.ap-alerte { color: var(--red, #d33); font-weight: 700; }
.ap-vide { color: var(--muted); padding: 14px 4px; font-size: 13.5px; }
`;
function installerStyle() {
  if (document.getElementById('style-appli')) return;
  document.head.append(h('style', { id: 'style-appli' }, STYLE));
}

const lire = (s) => (s ? new Date(String(s).replace(' ', 'T')) : null);
const hm = (d) => `${pad(d.getHours())}h${pad(d.getMinutes())}`;
const jourCourt = (d) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const quand = (c) => { const d = lire(c.quand); return d ? `${iso(d) === iso(new Date()) ? 'Aujourd’hui' : jourCourt(d)} ${hm(d)}` : ''; };
const STATUTS = {
  recherche: ['Recherche', 'attente'], reservee: ['À attribuer', 'attente'], confirmee: ['Confirmée', 'accepte'], acceptee: ['Chauffeur en route', 'en_cours'],
  arrivee: ['Chauffeur arrivé', 'en_cours'], en_course: ['En course', 'en_cours'], terminee: ['Terminée', 'payee'], annulee: ['Annulée', 'annulee'], aucun: ['Sans chauffeur', 'refusee'],
};
const pastille = (s) => h('span', { class: `pastille pastille--${(STATUTS[s] || [])[1] || 'brouillon'}` }, (STATUTS[s] || [s])[0]);
const telLien = (t) => (t ? h('a', { href: `tel:${String(t).replace(/[^\d+]/g, '')}` }, t) : null);
const ilYaSec = (s, decalage) => { const d = lire(s); if (!d) return 'jamais'; const sec = Math.max(0, Math.round((Date.now() + decalage - d) / 1000)); return sec < 90 ? `il y a ${sec} s` : sec < 5400 ? `il y a ${Math.round(sec / 60)} min` : `le ${jourCourt(d)}`; };
const carte = (titre, sous, ...contenu) => h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, titre), sous ? h('small', null, sous) : null), contenu);
const tuile = (ic, libelle, valeur, sous, cls = '') => h('div', { class: `tuile ${cls}` }, h('span', { class: 'tuile__ic' }, icone(ic)), h('div', null, h('small', null, libelle), h('b', null, valeur), sous ? h('span', null, sous) : null));
const trajet = (c) => h('div', { class: 'ap-trajet' },
  h('span', null, c.depart ? c.depart.titre : '—'),
  h('small', null, c.mode === 'dispo' ? `À disposition ${c.heures} h` : `→ ${c.arrivee ? c.arrivee.titre : ''}${c.arret ? ` (arrêt : ${c.arret.titre})` : ''}`),
  c.vol ? h('small', null, `Vol ${c.vol}`) : null);
const clientDe = (c) => h('div', { class: 'ap-trajet' }, h('b', null, c.client ? `${c.client.prenom} ${c.client.nom || ''}`.trim() : '—'), c.client && c.client.tel ? h('small', null, telLien(c.client.tel)) : null, c.passager ? h('small', null, `Pour ${c.passager.prenom} · `, telLien(c.passager.tel)) : null);

let minuteur = null;
const ONGLETS = [['', 'En direct'], ['courses', 'Courses'], ['chauffeurs', 'Chauffeurs'], ['clients', 'Clients'], ['reglages', 'Prix & réglages']];

export async function pageAppli(ctx) {
  installerStyle();
  ctx.titre('Appli BDA');
  clearInterval(minuteur);
  const onglet = ctx.params[0] || '';
  const barre = h('div', { class: 'onglets' }, ONGLETS.map(([k, l]) => h('a', { class: `onglet ${k === onglet ? 'is-actif' : ''}`, href: `#/appli${k ? '/' + k : ''}` }, l)));
  ctx.actions(
    h('a', { class: 'btn btn--ghost', href: '/appli/', target: '_blank', rel: 'noopener' }, icone('mobile'), 'Appli client'),
    h('a', { class: 'btn btn--ghost', href: '/appli/chauffeur/', target: '_blank', rel: 'noopener' }, icone('voiture'), 'Appli chauffeur'));
  const pages = { '': enDirect, courses: historique, chauffeurs: pageChauffeurs, clients: pageClients, reglages: pageReglages };
  await (pages[onglet] || enDirect)(ctx, barre);
}

/* ================= En direct ================= */
async function enDirect(ctx, barre) {
  const t = await apiAppli('tableau');
  if (!ctx.actuel()) return;
  const decalage = lire(t.serveur) - Date.now();
  const recharger = () => pageAppli(ctx);
  const enLigne = t.chauffeurs.filter((c) => c.enLigne);
  const aAttribuer = t.aVenir.filter((c) => c.statut === 'reservee').length;
  const lienClient = `${location.origin}/appli/`;
  const message = `Bonjour, voici l’appli BDA pour réserver votre chauffeur privé : ${lienClient}${t.prive ? `\nCode d’accès à saisir à l’inscription : ${t.codeAcces}` : ''}\nSur iPhone : ouvrez le lien dans Safari, touchez Partager puis « Sur l’écran d’accueil ».`;
  const etat = carte('L’appli', t.ouvert ? 'Ouverte' : 'Fermée',
    h('div', { class: 'ap-etat' },
      h('p', null, t.ouvert ? 'Les clients peuvent commander et réserver. ' : 'Aucune nouvelle course ne peut être commandée (réglage « Appli ouverte »). ',
        t.prive ? 'Phase privée : un client ne peut créer son compte qu’avec le code d’accès.' : 'Inscription ouverte à tous.'),
      t.prive ? h('span', { class: 'ap-code', title: 'Code d’accès à donner aux clients' }, t.codeAcces) : null,
      h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(message); toast('Invitation copiée : collez-la dans un SMS ou WhatsApp.'); } catch (e) { toast(message); } } }, icone('copier'), 'Copier l’invitation'),
      h('a', { class: 'btn btn--ghost btn--petit', href: `https://wa.me/?text=${encodeURIComponent(message)}`, target: '_blank', rel: 'noopener' }, icone('envoyer'), 'WhatsApp')));

  const tuiles = h('div', { class: 'tuiles' },
    tuile('voiture', 'Chauffeurs en ligne', String(enLigne.length), `${t.chauffeurs.length} autorisé${t.chauffeurs.length > 1 ? 's' : ''}`, enLigne.length ? 'tuile--ok' : ''),
    tuile('activite', 'Courses en cours', String(t.enDirect.length), t.enDirect.some((c) => c.alertes.length) ? 'ALERTE en cours' : null, t.enDirect.some((c) => c.alertes.length) ? 'tuile--alerte' : ''),
    tuile('horloge', 'Réservations à attribuer', String(aAttribuer), `${t.aVenir.length} à venir`, aAttribuer ? 'tuile--or' : ''),
    tuile('euro', 'Aujourd’hui', euroRond.format(+t.jour.t), `${t.jour.n} course${+t.jour.n > 1 ? 's' : ''} · semaine ${euroRond.format(+t.semaine.t)}`));

  const tableCourses = (liste, vide) => (liste.length ? h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
    h('thead', null, h('tr', null, h('th', null, 'Course'), h('th', null, 'État'), h('th', null, 'Quand'), h('th', null, 'Client'), h('th', null, 'Trajet'), h('th', null, 'Chauffeur'), h('th', null, 'Prix'), h('th'))),
    h('tbody', null, liste.map((c) => h('tr', null,
      h('td', null, h('b', null, c.numero), h('small', { class: 'muet paie-poste' }, c.gammeNom), c.code ? h('small', { class: 'muet paie-poste' }, 'Code de sécurité') : null),
      h('td', null, pastille(c.statut), c.alertes.length ? h('div', { class: 'ap-alerte' }, icone('alerte'), ` Alerte ${hm(lire(c.alertes[c.alertes.length - 1].quand))}`) : null),
      h('td', null, quand(c)),
      h('td', null, clientDe(c)),
      h('td', null, trajet(c)),
      h('td', null, c.chauffeur ? h('div', { class: 'ap-trajet' }, h('span', null, c.chauffeur.nom), c.vehicule && c.vehicule.plaque ? h('small', null, `${c.vehicule.voiture || ''} · ${c.vehicule.plaque}`) : null, telLien(c.chauffeur.tel)) : h('span', { class: 'muet' }, '—')),
      h('td', null, h('b', null, euro.format(c.total)), c.remise ? h('small', { class: 'muet paie-poste' }, `dont code −${euro.format(c.remise)}`) : null),
      h('td', { class: 'paie-action' },
        ['recherche', 'reservee', 'confirmee'].includes(c.statut) ? h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => attribuer(c, t.chauffeurs, recharger) }, c.statut === 'confirmee' ? 'Changer' : 'Attribuer') : null,
        h('button', { class: 'icon-btn', type: 'button', title: 'Annuler la course', 'aria-label': `Annuler la course ${c.numero}`, onclick: async () => {
          if (!(await confirmer(`Annuler la course ${c.numero} ? Le client et le chauffeur sont prévenus.`, { ok: 'Annuler la course', danger: true }))) return;
          try { await apiAppli('course.annuler', { numero: c.numero }); toast('Course annulée.'); recharger(); } catch (e) { erreur(e); }
        } }, icone('croix'))))))))
    : h('p', { class: 'ap-vide' }, vide));

  const enCours = carte('Courses en cours', t.enDirect.length ? `${t.enDirect.length} en ce moment` : 'Aucune', tableCourses(t.enDirect, 'Aucune course en ce moment. Les nouvelles demandes apparaissent ici en direct.'));
  const aVenir = carte('Réservations à venir', aAttribuer ? `${aAttribuer} à attribuer` : 'Tout est attribué', tableCourses(t.aVenir, 'Aucune réservation à venir.'));
  const chauffeurs = carte('Chauffeurs', `${enLigne.length} en ligne`,
    t.chauffeurs.length ? h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
      h('thead', null, h('tr', null, h('th', null, 'Chauffeur'), h('th', null, 'État'), h('th', null, 'Véhicule'), h('th', null, 'Dernière position'), h('th'))),
      h('tbody', null, t.chauffeurs.map((c) => h('tr', null,
        h('td', null, h('b', null, c.nom), h('small', { class: 'muet paie-poste' }, telLien(c.tel))),
        h('td', null, c.enLigne ? h('span', { class: 'pastille pastille--payee' }, 'En ligne') : h('span', { class: 'pastille pastille--brouillon' }, 'Hors ligne')),
        h('td', null, c.vehicule && c.vehicule.plaque ? `${c.vehicule.modele || ''} · ${c.vehicule.plaque}` : h('span', { class: 'muet' }, 'À renseigner')),
        h('td', null, c.lat != null && c.enLigne ? h('a', { href: `https://www.google.com/maps?q=${c.lat},${c.lng}`, target: '_blank', rel: 'noopener' }, icone('epingle'), ` ${ilYaSec(c.position_le, decalage)}`) : h('span', { class: 'muet' }, c.enLigne ? 'Sans GPS' : '—')),
        h('td', { class: 'paie-action' }, c.enLigne ? h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => { try { await apiAppli('chauffeur.horsligne', { id: c.id }); toast(`${c.nom} est mis hors ligne.`); recharger(); } catch (e) { erreur(e); } } }, 'Mettre hors ligne') : null))))))
      : h('p', { class: 'ap-vide' }, 'Aucun chauffeur autorisé. Voir l’onglet Chauffeurs.'));

  ctx.afficher(barre, etat, tuiles, enCours, aVenir, chauffeurs);
  minuteur = setInterval(() => { if (!document.body.contains(barre)) { clearInterval(minuteur); return; } if (!document.querySelector('.modale')) pageAppli(ctx); }, 15000);
}

async function attribuer(c, chauffeurs, recharger) {
  const possibles = chauffeurs.filter((x) => x.gammes.includes(c.gamme) && x.vehicule && x.vehicule.plaque);
  const sel = h('select', { class: 'input' }, h('option', { value: '' }, 'Choisir le chauffeur…'),
    possibles.map((x) => h('option', { value: x.id, selected: c.chauffeur && c.chauffeur.id === x.id }, `${x.nom} · ${x.vehicule.modele || ''} ${x.vehicule.plaque}${x.enLigne ? ' · en ligne' : ''}`)));
  await modale({
    titre: `Attribuer la course ${c.numero}`,
    contenu: h('div', { class: 'form-grille' },
      h('p', { class: 'modale__texte' }, `${c.gammeNom} · ${quand(c)} · ${c.depart ? c.depart.titre : ''}${c.arrivee ? ` → ${c.arrivee.titre}` : ''} · ${euro.format(c.total)}`),
      possibles.length ? champ('Chauffeur', sel, 'Seuls les chauffeurs autorisés pour cette gamme, avec un véhicule renseigné.') : h('p', { class: 'modale__texte' }, 'Aucun chauffeur autorisé pour cette gamme avec un véhicule renseigné.')),
    actions: [
      { libelle: 'Fermer', classe: 'btn--ghost', valeur: null },
      possibles.length ? { libelle: 'Confier la course', classe: 'btn--gold', submit: true, action: async () => {
        if (!sel.value) { toast('Choisissez le chauffeur.', 'erreur'); return false; }
        try { await apiAppli('course.attribuer', { numero: c.numero, chauffeur: +sel.value }); toast('Course confiée : le chauffeur et le client sont prévenus.'); recharger(); }
        catch (e) { erreur(e); return false; }
      } } : null,
    ].filter(Boolean),
  });
}

/* ================= Historique des courses ================= */
async function historique(ctx, barre) {
  const auj = new Date();
  const du = h('input', { class: 'input', type: 'date', value: iso(new Date(auj.getTime() - 30 * 86400000)) });
  const au = h('input', { class: 'input', type: 'date', value: iso(auj) });
  const zone = h('div');
  const charger = async () => {
    zone.replaceChildren(h('div', { class: 'chargement' }, h('span'), h('span'), h('span')));
    try {
      const { courses } = await apiAppli('courses', undefined, { du: du.value, au: au.value });
      const faites = courses.filter((c) => c.statut === 'terminee');
      const ca = faites.reduce((s, c) => s + c.total, 0);
      zone.replaceChildren(
        h('div', { class: 'tuiles' },
          tuile('voiture', 'Courses terminées', String(faites.length)),
          tuile('euro', 'Total encaissé à bord', euroRond.format(ca)),
          tuile('croix', 'Annulées', String(courses.filter((c) => c.statut === 'annulee').length)),
          tuile('etoile', 'Note moyenne', faites.some((c) => c.note) ? (faites.filter((c) => c.note).reduce((s, c) => s + c.note, 0) / faites.filter((c) => c.note).length).toFixed(2).replace('.', ',') : '—')),
        carte('Courses', `${courses.length} sur la période`,
          h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => exporter(courses, du.value, au.value) }, icone('telecharger'), 'Exporter (Excel)'),
          courses.length ? h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
            h('thead', null, h('tr', null, h('th', null, 'Course'), h('th', null, 'État'), h('th', null, 'Date'), h('th', null, 'Client'), h('th', null, 'Trajet'), h('th', null, 'Chauffeur'), h('th', null, 'Prix'), h('th', null, 'Avis'))),
            h('tbody', null, courses.map((c) => h('tr', null,
              h('td', null, h('b', null, c.numero), h('small', { class: 'muet paie-poste' }, c.gammeNom)),
              h('td', null, pastille(c.statut), c.annulePar ? h('small', { class: 'muet paie-poste' }, { client: 'par le client', absent: 'client absent', bda: 'par BDA' }[c.annulePar] || '') : null, c.frais ? h('small', { class: 'muet paie-poste' }, 'hors délai') : null),
              h('td', null, quand(c)),
              h('td', null, clientDe(c)),
              h('td', null, trajet(c), h('small', { class: 'muet' }, c.km ? `${String(c.km).replace('.', ',')} km · ${c.minutes} min` : '')),
              h('td', null, c.chauffeur ? c.chauffeur.nom : '—'),
              h('td', null, h('b', null, euro.format(c.total))),
              h('td', null, c.note ? `${'★'.repeat(c.note)}${c.avis ? ` « ${c.avis} »` : ''}` : ''))))))
            : h('p', { class: 'ap-vide' }, 'Aucune course sur cette période.')));
    } catch (e) { zone.replaceChildren(h('p', { class: 'ap-vide' }, e.message)); }
  };
  du.addEventListener('change', charger);
  au.addEventListener('change', charger);
  ctx.afficher(barre, h('div', { class: 'form-grille form-grille--2' }, champ('Du', du), champ('Au', au)), zone);
  charger();
}
function exporter(courses, du, au) {
  if (!courses.length) { toast('Aucune course à exporter.', 'erreur'); return; }
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lignes = [['Course', 'État', 'Date', 'Gamme', 'Client', 'Téléphone', 'Départ', 'Arrivée', 'Km', 'Minutes', 'Transport', 'Remise', 'Protection', 'Total TTC', 'Chauffeur', 'Note'].map(cel).join(';')]
    .concat(courses.slice().reverse().map((c) => [c.numero, (STATUTS[c.statut] || [c.statut])[0], quand(c), c.gammeNom, c.client ? `${c.client.prenom} ${c.client.nom || ''}`.trim() : '', c.client ? c.client.tel : '',
      c.depart ? c.depart.titre : '', c.mode === 'dispo' ? `À disposition ${c.heures} h` : (c.arrivee ? c.arrivee.titre : ''), String(c.km).replace('.', ','), c.minutes,
      String(c.transport).replace('.', ','), String(c.remise).replace('.', ','), String(c.protection).replace('.', ','), String(c.total).replace('.', ','), c.chauffeur ? c.chauffeur.nom : '', c.note || ''].map(cel).join(';')));
  const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + lignes.join('\r\n')], { type: 'text/csv;charset=utf-8' })), download: `Courses appli ${du} au ${au}.csv` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

/* ================= Chauffeurs : accès à l’appli ================= */
async function pageChauffeurs(ctx, barre) {
  const r = await apiAppli('chauffeurs');
  if (!ctx.actuel()) return;
  const recharger = () => pageAppli(ctx);
  const fiche = (c) => {
    const gammes = new Set(c.gammes);
    const v = c.vehicule || {};
    const modele = saisie({ value: v.modele || '', placeholder: 'Mercedes Classe E' });
    const couleur = saisie({ value: v.couleur || '', placeholder: 'Noire' });
    const plaque = saisie({ value: v.plaque || '', placeholder: 'AB-123-CD', style: 'text-transform:uppercase' });
    const autorise = h('input', { type: 'checkbox', role: 'switch', checked: c.autorise, 'aria-label': 'Autorisé à conduire avec l’appli' });
    const boutons = h('div', { class: 'ap-gammes' }, r.gammes.map((g) => h('button', { type: 'button', 'aria-pressed': String(gammes.has(g.cle)), onclick: (e) => { if (gammes.has(g.cle)) gammes.delete(g.cle); else gammes.add(g.cle); e.currentTarget.setAttribute('aria-pressed', String(gammes.has(g.cle))); } }, g.cle === 'vip' ? 'VIP (garde du corps)' : g.nom)));
    return h('section', { class: 'carte' },
      h('header', { class: 'carte__tete' }, h('h2', null, c.nom), h('small', null, c.enLigne ? 'En ligne' : `Vu ${c.vu ? lire(c.vu).toLocaleDateString('fr-FR') : 'jamais'}`)),
      h('p', { class: 'modale__texte' }, `Identifiant : ${c.identifiant} · `, telLien(c.tel), ` · ${c.courses} course${c.courses > 1 ? 's' : ''}${c.note ? ` · note ${String(c.note).replace('.', ',')} (${c.nbNotes} avis)` : ''}`, c.agentActif ? null : h('b', { class: 'ap-alerte' }, ' · fiche agent inactive')),
      h('label', { class: 'ap-ligne-inter' }, h('span', { class: 'interrupteur' }, autorise, h('span', { 'aria-hidden': 'true' })), h('span', null, h('b', null, 'Autorisé à conduire avec l’appli'), h('small', null, 'Retirer l’accès le déconnecte tout de suite.'))),
      champ('Gammes', boutons, 'Le VIP n’est proposé qu’aux chauffeurs qui travaillent avec un garde du corps BDA.'),
      h('div', { class: 'form-grille form-grille--2' }, champ('Véhicule', modele), champ('Couleur', couleur)),
      champ('Plaque', plaque),
      h('button', { class: 'btn btn--gold', type: 'button', onclick: async () => {
        try { await apiAppli('chauffeur.enregistrer', { id: c.id, autorise: autorise.checked, gammes: [...gammes], vehicule: { modele: modele.value, couleur: couleur.value, plaque: plaque.value } }); toast(`${c.nom} : enregistré.`); recharger(); }
        catch (e) { erreur(e); }
      } }, icone('coche'), 'Enregistrer'));
  };
  const aide = carte('Comment ajouter un chauffeur', null,
    h('p', { class: 'modale__texte' }, '1. Le chauffeur crée son compte dans l’Espace équipe (bdasecurite.com/espace-equipe) en choisissant le métier « Chauffeur VTC ». 2. Vous le validez dans Espace équipe. 3. Il apparaît ici : vérifiez ses gammes et son véhicule. 4. Il se connecte à l’appli chauffeur (bdasecurite.com/appli/chauffeur) avec le même identifiant et le même mot de passe.'));
  const autres = r.autres.length ? carte('Autres comptes de l’Espace équipe', 'Agents de sécurité, SSIAP…',
    h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' }, h('tbody', null, r.autres.map((a) => h('tr', null, h('td', null, h('b', null, `${a.prenom} ${a.nom}`)), h('td', null, a.metier),
      h('td', { class: 'paie-action' }, h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => {
        if (!(await confirmer(`Autoriser ${a.prenom} ${a.nom} à conduire avec l’appli chauffeur ?`, { ok: 'Autoriser' }))) return;
        try { await apiAppli('chauffeur.enregistrer', { id: a.id, autorise: true, gammes: ['berline'], vehicule: {} }); toast('Accès chauffeur ajouté : renseignez son véhicule.'); recharger(); } catch (e) { erreur(e); }
      } }, 'Autoriser comme chauffeur')))))))) : null;
  ctx.afficher(barre, r.chauffeurs.length ? h('div', { class: 'ap-chf' }, r.chauffeurs.map(fiche)) : carte('Chauffeurs', null, h('p', { class: 'ap-vide' }, 'Aucun chauffeur pour l’instant.')), aide, autres);
}

/* ================= Clients ================= */
async function pageClients(ctx, barre) {
  const { clients } = await apiAppli('clients');
  if (!ctx.actuel()) return;
  const recherche = saisie({ type: 'search', placeholder: 'Rechercher un nom, un e-mail, un téléphone…' });
  const corps = h('tbody');
  const dessiner = () => {
    const q = recherche.value.trim().toLowerCase();
    const liste = clients.filter((c) => !q || `${c.prenom} ${c.nom} ${c.email} ${c.tel}`.toLowerCase().includes(q));
    corps.replaceChildren(...(liste.length ? liste.map((c) => h('tr', null,
      h('td', null, h('b', null, `${c.prenom} ${c.nom}`.trim()), h('small', { class: 'muet paie-poste' }, `Inscrit le ${lire(c.cree).toLocaleDateString('fr-FR')}`)),
      h('td', null, h('a', { href: `mailto:${c.email}` }, c.email), h('small', { class: 'muet paie-poste' }, telLien(c.tel))),
      h('td', null, String(c.courses)),
      h('td', null, `${c.points} pts`),
      h('td', null, +c.offres ? 'Oui' : 'Non'),
      h('td', { class: 'paie-action' }, h('button', { class: 'icon-btn', type: 'button', title: 'Supprimer le compte', 'aria-label': `Supprimer le compte de ${c.prenom}`, onclick: async () => {
        if (!(await confirmer(`Supprimer définitivement le compte de ${c.prenom} ${c.nom} ? Ses reçus restent, sans son nom.`, { ok: 'Supprimer', danger: true }))) return;
        try { await apiAppli('client.supprimer', { id: c.id }); toast('Compte supprimé.'); pageAppli(ctx); } catch (e) { erreur(e); }
      } }, icone('poubelle'))))) : [h('tr', null, h('td', { colspan: 6, class: 'vide-ligne' }, 'Aucun client.'))]));
  };
  recherche.addEventListener('input', dessiner);
  dessiner();
  ctx.afficher(barre, carte('Clients de l’appli', `${clients.length} compte${clients.length > 1 ? 's' : ''}`, recherche,
    h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' }, h('thead', null, h('tr', null, h('th', null, 'Client'), h('th', null, 'Contact'), h('th', null, 'Courses'), h('th', null, 'Club'), h('th', null, 'Offres'), h('th'))), corps))));
}

/* ================= Prix & réglages ================= */
async function pageReglages(ctx, barre) {
  const { reglages: r, aeroports } = await apiAppli('reglages');
  if (!ctx.actuel()) return;
  const inter = (actif, label) => h('input', { type: 'checkbox', role: 'switch', checked: !!actif, 'aria-label': label });
  const ouvert = inter(r.ouvert, 'Appli ouverte'), prive = inter(r.prive, 'Phase privée');
  const code = saisie({ value: r.codeAcces, style: 'text-transform:uppercase;font-family:var(--mono)' });
  const nombre = (v, pas = '0.01') => h('input', { class: 'input', type: 'number', min: '0', step: pas, value: v });
  const ORDRE = ['berline', 'electrique', 'suv', 'luxe', 'van', 'vip'];
  const champs = {};
  const lignes = ORDRE.map((k) => {
    const g = r.gammes[k], c = (champs[k] = { actif: inter(g.actif, g.nom), nom: saisie({ value: g.nom }), modele: saisie({ value: g.modele }) });
    if (k !== 'vip') {
      for (const t of ['prise', 'km', 'min', 'minimum', 'heure']) c[t] = nombre(g[t]);
      c.forfaits = {};
      for (const a of Object.keys(aeroports)) c.forfaits[a] = nombre(g.forfaits[a], '1');
    }
    return h('tr', null,
      h('td', null, h('label', { class: 'interrupteur' }, c.actif, h('span', { 'aria-hidden': 'true' }))),
      h('td', null, c.nom), h('td', null, c.modele),
      k === 'vip' ? h('td', { colspan: 8, class: 'muet' }, 'Prix de la berline + garde du corps (ci-dessous)') : [h('td', null, c.prise), h('td', null, c.km), h('td', null, c.min), h('td', null, c.minimum), ...Object.keys(aeroports).map((a) => h('td', null, c.forfaits[a])), h('td', null, c.heure)]);
  });
  const agentVip = nombre(r.agentVip), attente = nombre(r.attente, '1'), attenteAero = nombre(r.attenteAeroport, '1'), hMin = nombre(r.heuresMin, '1'), hMax = nombre(r.heuresMax, '1');
  const promos = h('div');
  const ajouterPromo = (p = { code: '', montant: 10, actif: true }) => {
    const ligne = h('div', { class: 'ap-promo' });
    const c = saisie({ value: p.code, placeholder: 'BIENVENUE10', style: 'text-transform:uppercase' }), m = nombre(p.montant, '1'), a = inter(p.actif, 'Code actif');
    ligne.append(c, h('label', { class: 'champ' }, m), h('label', { class: 'interrupteur', title: 'Actif' }, a, h('span', { 'aria-hidden': 'true' })), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retirer ce code', onclick: () => ligne.remove() }, icone('poubelle')));
    ligne.lire = () => ({ code: c.value, montant: m.value, actif: a.checked });
    promos.append(ligne);
  };
  r.promos.forEach(ajouterPromo);
  const legal = {};
  for (const [k, l, aide] of [['evtc', 'N° d’inscription au registre VTC (EVTC)', 'Obligatoire avant d’ouvrir au public. Affiché sur les bons de réservation et les reçus.'], ['tva', 'Mention TVA des reçus', 'Ex. « TVA 10 % incluse » ou « TVA non applicable, art. 293 B du CGI » (voir avec le comptable).'], ['mediateur', 'Médiateur de la consommation', 'Nom et site du médiateur choisi (obligatoire avec des particuliers).'], ['cnaps', 'N° d’autorisation CNAPS (option VIP)', 'Celui de la société qui fournit le garde du corps.'], ['hebergeur', 'Hébergeur', '']]) legal[k] = [champ(l, saisie({ value: r.legal[k] || '' }), aide), k];
  const enregistrer = h('button', { class: 'btn btn--gold', type: 'button', onclick: async () => {
    const gammes = {};
    for (const k of ORDRE) {
      const c = champs[k];
      gammes[k] = { actif: c.actif.checked, nom: c.nom.value, modele: c.modele.value };
      if (k !== 'vip') { for (const t of ['prise', 'km', 'min', 'minimum', 'heure']) gammes[k][t] = c[t].value; gammes[k].forfaits = Object.fromEntries(Object.entries(c.forfaits).map(([a, el]) => [a, el.value])); }
    }
    enregistrer.disabled = true;
    try {
      await apiAppli('reglages.enregistrer', {
        ouvert: ouvert.checked, prive: prive.checked, codeAcces: code.value, gammes, agentVip: agentVip.value, attente: attente.value, attenteAeroport: attenteAero.value, heuresMin: hMin.value, heuresMax: hMax.value,
        promos: [...promos.children].map((l) => l.lire()), legal: Object.fromEntries(Object.values(legal).map(([el, k]) => [k, el.querySelector('input').value])),
      });
      toast('Réglages de l’appli enregistrés : ils s’appliquent tout de suite.');
      pageAppli(ctx);
    } catch (e) { erreur(e); enregistrer.disabled = false; }
  } }, icone('coche'), 'Enregistrer les réglages');
  ctx.afficher(barre,
    carte('Accès', null,
      h('label', { class: 'ap-ligne-inter' }, h('span', { class: 'interrupteur' }, ouvert, h('span', { 'aria-hidden': 'true' })), h('span', null, h('b', null, 'Appli ouverte'), h('small', null, 'Fermée : les clients ne peuvent plus commander, les chauffeurs ne peuvent plus passer en ligne.'))),
      h('label', { class: 'ap-ligne-inter' }, h('span', { class: 'interrupteur' }, prive, h('span', { 'aria-hidden': 'true' })), h('span', null, h('b', null, 'Phase privée'), h('small', null, 'Un code d’accès est demandé pour créer un compte client.'))),
      h('div', { class: 'form-grille form-grille--2' }, champ('Code d’accès', code, 'À donner à vos clients. Le changer n’affecte pas les comptes déjà créés.'),
        h('div', null, h('button', { class: 'btn btn--ghost', type: 'button', style: 'margin-top:24px', onclick: () => { code.value = `BDA-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; } }, icone('cle'), 'Nouveau code')))),
    carte('Prix TTC par gamme', 'Les prix s’appliquent à toute nouvelle commande',
      h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau ap-prix' },
        h('thead', null, h('tr', null, h('th', null, 'Active'), h('th', null, 'Nom'), h('th', null, 'Modèle affiché'), h('th', null, 'Prise en charge €'), h('th', null, '€ / km'), h('th', null, '€ / min'), h('th', null, 'Minimum €'), ...Object.values(aeroports).map((n) => h('th', null, `${n} €`)), h('th', null, '€ / heure'))),
        h('tbody', null, lignes))),
      h('p', { class: 'modale__texte' }, 'Prix d’un trajet = prise en charge + km × prix du km + minutes × prix de la minute, jamais moins que le minimum. Prix fixe entre Paris et un aéroport (sans arrêt). « € / heure » = chauffeur à disposition (0 = non proposé). Berline et van : tarifs du site ; Électrique, SUV et Berline Luxe : prix provisoires à valider.'),
      h('div', { class: 'form-grille form-grille--2' }, champ('Garde du corps VIP (€ TTC par course)', agentVip, '2 h d’agent par défaut, facturées à part par la société titulaire de l’autorisation CNAPS.'), champ('Attente offerte (min)', attente)),
      h('div', { class: 'form-grille form-grille--2' }, champ('Attente offerte à l’aéroport (min)', attenteAero), champ('À disposition : heures minimum / maximum', h('div', { class: 'form-grille form-grille--2' }, hMin, hMax)))),
    carte('Codes promo', 'Une seule utilisation par client', promos, h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => ajouterPromo() }, icone('plus'), 'Ajouter un code')),
    carte('Mentions légales de l’appli', 'Affichées dans l’appli, les bons de réservation et les reçus', Object.values(legal).map(([el]) => el)),
    enregistrer);
}
