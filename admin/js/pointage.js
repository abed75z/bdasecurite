/* =========================================================
   ESPACE ADMIN BDA — Pointage des agents
   Qui est en service maintenant, liens personnels de pointage
   (envoyés aux agents par WhatsApp / SMS), journal du mois
   avec corrections à la main et export pour la paie.
   ========================================================= */
import { api, h, icone, toast, erreur, modale, confirmer, champ, saisie, MOIS, cap, pad, iso, fmtHeures } from './outils.js';

const lire = (s) => new Date(String(s).replace(' ', 'T'));
const hm = (d) => `${pad(d.getHours())}h${pad(d.getMinutes())}`;
const jourCourt = (d) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const minutes = (p, maintenant) => Math.max(0, ((p.fin ? lire(p.fin) : maintenant) - lire(p.debut)) / 60000);
const carteGps = (lat, lng, prec, libelle) => (lat == null ? null : h('a', {
  class: 'pt-gps', href: `https://www.google.com/maps?q=${lat},${lng}`, target: '_blank', rel: 'noopener',
  title: `Position au moment du pointage${prec ? ` (précision ± ${Math.round(prec)} m)` : ''}`,
}, icone('epingle'), libelle));
const pourInput = (s) => (s ? String(s).slice(0, 16).replace(' ', 'T') : '');

let minuteur = null;

export async function pagePointage(ctx) {
  ctx.titre('Pointage');
  clearInterval(minuteur);
  const auj = new Date();
  const mois = (ctx.params[0] && /^\d{4}-\d{2}$/.test(ctx.params[0])) ? ctx.params[0] : `${auj.getFullYear()}-${pad(auj.getMonth() + 1)}`;
  const [a, m] = mois.split('-').map(Number);
  const du = `${mois}-01`;
  const au = iso(new Date(a, m, 0));
  const { pointages, agents, serveur } = await api('pointages', undefined, { du, au });
  if (!ctx.actuel()) return;
  const decalage = lire(serveur) - Date.now();
  const maintenant = () => new Date(Date.now() + decalage);
  const recharger = () => pagePointage(ctx);

  ctx.actions(
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => exporter(pointages, mois, maintenant()) }, icone('telecharger'), 'Exporter le mois'),
    h('button', { class: 'btn btn--gold', type: 'button', onclick: () => editer(null, agents, recharger) }, icone('plus'), 'Ajouter un pointage'));

  /* ----- En service maintenant ----- */
  const enCours = pointages.filter((p) => !p.fin);
  const durees = [];
  const enService = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'En service maintenant'), h('small', null, enCours.length ? `${enCours.length} agent${enCours.length > 1 ? 's' : ''}` : 'Personne pour le moment')),
    enCours.length ? h('div', { class: 'pt-live' }, enCours.map((p) => {
      const d = h('b', { class: 'pt-live__duree' });
      durees.push([d, p]);
      const long = minutes(p, maintenant()) > 14 * 60;
      return h('article', { class: `pt-live__carte ${long ? 'is-long' : ''}` },
        h('span', { class: 'pt-live__pouls', 'aria-hidden': 'true' }),
        h('div', { class: 'pt-live__txt' }, h('b', null, p.nom), h('small', null, `Depuis ${hm(lire(p.debut))}${p.site ? ` · ${p.site}` : ''}`),
          long ? h('small', { class: 'pt-alerte' }, icone('alerte'), 'Plus de 14 h : oubli de pointage ?') : null),
        d,
        h('div', { class: 'pt-live__actions' },
          carteGps(p.lat_debut, p.lng_debut, p.prec_debut, 'Position'),
          h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => {
            if (!(await confirmer(`Terminer le service de ${p.nom} maintenant (${hm(maintenant())}) ?`, { ok: 'Terminer le service' }))) return;
            try { await api('pointage.enregistrer', { id: p.id, debut: p.debut, fin: `${iso(maintenant())} ${hm(maintenant()).replace('h', ':')}`, site: p.site, note: p.note || 'Fin saisie par le responsable' }); toast('Service terminé.'); recharger(); } catch (e) { erreur(e); }
          } }, 'Terminer')));
    })) : h('div', { class: 'vide vide--petit' }, icone('horloge'), h('p', null, 'Quand un agent prend son service depuis son téléphone, il apparaît ici en direct.')));
  const tic = () => durees.forEach(([el, p]) => { el.textContent = fmtHeures(minutes(p, maintenant()) / 60, true); });
  tic();
  minuteur = setInterval(() => { if (!document.body.contains(enService)) return clearInterval(minuteur); tic(); }, 20000);

  /* ----- Liens de pointage des agents ----- */
  const actifs = agents.filter((x) => +x.actif);
  const liens = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Liens de pointage'), h('small', null, 'Chaque agent reçoit son lien personnel et pointe depuis son téléphone')),
    actifs.length ? h('div', { class: 'pt-liens' }, actifs.map((ag) => h('div', { class: 'pt-lien' },
      h('div', null, h('b', null, ag.nom), h('small', { class: 'muet' }, +ag.lien ? 'Lien actif' : 'Pas encore de lien')),
      h('div', { class: 'pt-lien__actions' },
        h('button', { class: `btn btn--petit ${+ag.lien ? 'btn--ghost' : 'btn--gold'}`, type: 'button', onclick: () => creerLien(ag, recharger) }, icone(+ag.lien ? 'cle' : 'plus'), +ag.lien ? 'Nouveau lien' : 'Créer le lien'),
        +ag.lien ? h('button', { class: 'icon-btn', type: 'button', title: 'Désactiver le lien', 'aria-label': `Désactiver le lien de ${ag.nom}`, onclick: async () => {
          if (!(await confirmer(`Désactiver le lien de pointage de ${ag.nom} ? Il ne pourra plus pointer avec.`, { ok: 'Désactiver', danger: true }))) return;
          try { await api('pointage.lien.retirer', { agent_id: ag.id }); toast('Lien désactivé.'); recharger(); } catch (e) { erreur(e); }
        } }, icone('croix')) : null)))) : h('div', { class: 'vide vide--petit' }, icone('agents'), h('p', null, 'Ajoutez d’abord vos agents dans la page Agents.')));

  /* ----- Journal du mois ----- */
  const duMois = pointages.filter((p) => p.debut.slice(0, 7) === mois);
  const totaux = {};
  duMois.forEach((p) => { totaux[p.nom] = (totaux[p.nom] || 0) + minutes(p, maintenant()); });
  const precedent = new Date(a, m - 2, 1);
  const suivant = new Date(a, m, 1);
  const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const journal = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete pt-journal__tete' },
      h('div', { class: 'pt-mois' },
        h('a', { class: 'icon-btn', href: `#/pointage/${ym(precedent)}`, 'aria-label': 'Mois précédent' }, icone('retour')),
        h('h2', null, `${cap(MOIS[m - 1])} ${a}`),
        h('a', { class: 'icon-btn', href: `#/pointage/${ym(suivant)}`, 'aria-label': 'Mois suivant' }, icone('suivant'))),
      h('small', null, `${duMois.length} service${duMois.length > 1 ? 's' : ''}`)),
    Object.keys(totaux).length ? h('div', { class: 'pt-totaux' }, Object.entries(totaux).sort().map(([nom, min]) => h('div', { class: 'pt-total' }, h('small', null, nom), h('b', null, fmtHeures(min / 60, true))))) : null,
    h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
      h('thead', null, h('tr', null, h('th', null, 'Agent'), h('th', null, 'Jour'), h('th', null, 'Début'), h('th', null, 'Fin'), h('th', null, 'Durée'), h('th', null, 'Lieu / position'), h('th'))),
      h('tbody', null, duMois.length ? duMois.map((p) => {
        const d = lire(p.debut);
        const f = p.fin ? lire(p.fin) : null;
        return h('tr', null,
          h('td', null, h('b', null, p.nom), +p.manuel ? h('small', { class: 'muet paie-poste' }, 'Corrigé à la main') : null),
          h('td', null, cap(jourCourt(d))),
          h('td', null, hm(d)),
          h('td', null, f ? `${hm(f)}${iso(f) !== iso(d) ? ` (${f.getDate()}/${pad(f.getMonth() + 1)})` : ''}` : h('span', { class: 'pastille pastille--en_cours' }, 'En service')),
          h('td', null, h('b', null, fmtHeures(minutes(p, maintenant()) / 60, true))),
          h('td', null, h('div', { class: 'pt-lieux' }, p.site ? h('span', null, p.site) : null, carteGps(p.lat_debut, p.lng_debut, p.prec_debut, 'Arrivée'), carteGps(p.lat_fin, p.lng_fin, p.prec_fin, 'Départ'), p.note ? h('small', { class: 'muet' }, p.note) : null)),
          h('td', { class: 'paie-action' },
            h('button', { class: 'icon-btn', type: 'button', title: 'Corriger', 'aria-label': 'Corriger ce pointage', onclick: () => editer(p, agents, recharger) }, icone('crayon')),
            h('button', { class: 'icon-btn', type: 'button', title: 'Supprimer', 'aria-label': 'Supprimer ce pointage', onclick: async () => {
              if (!(await confirmer(`Supprimer le pointage de ${p.nom} du ${jourCourt(d)} ?`, { ok: 'Supprimer', danger: true }))) return;
              try { await api('pointage.supprimer', { id: p.id }); toast('Pointage supprimé.'); recharger(); } catch (e) { erreur(e); }
            } }, icone('poubelle'))));
      }) : h('tr', null, h('td', { colspan: 7, class: 'vide-ligne' }, 'Aucun pointage ce mois-ci.'))))));

  ctx.afficher(enService, journal, liens);
}

/* ----- Lien personnel : montré une seule fois, à envoyer à l'agent ----- */
async function creerLien(ag, recharger) {
  if (+ag.lien && !(await confirmer(`Créer un nouveau lien pour ${ag.nom} ? L’ancien lien ne fonctionnera plus.`, { ok: 'Nouveau lien' }))) return;
  let lien;
  try { ({ lien } = await api('pointage.lien', { agent_id: ag.id })); } catch (e) { return erreur(e); }
  const prenom = String(ag.nom).trim().split(/\s+/)[0];
  const message = `Bonjour ${prenom}, voici ton lien de pointage BDA Security Group (personnel, ne le partage pas) : ${lien}\nOuvre-le à chaque prise et fin de service, et ajoute-le à l'écran d'accueil de ton téléphone.`;
  const champLien = h('input', { class: 'input pt-lien-champ', type: 'text', value: lien, readonly: true, onfocus: (e) => e.target.select() });
  const copier = async () => { try { await navigator.clipboard.writeText(lien); toast('Lien copié.'); } catch (e) { champLien.select(); document.execCommand('copy'); toast('Lien copié.'); } };
  await modale({
    titre: `Lien de pointage — ${ag.nom}`,
    contenu: h('div', { class: 'form-grille' },
      h('p', { class: 'modale__texte' }, 'Envoyez ce lien à l’agent. Pour des raisons de sécurité, il ne sera plus affiché ensuite : en cas de perte, créez un nouveau lien.'),
      champLien,
      h('div', { class: 'pt-partage' },
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: copier }, icone('copier'), 'Copier'),
        h('a', { class: 'btn btn--ghost', href: `https://wa.me/?text=${encodeURIComponent(message)}`, target: '_blank', rel: 'noopener' }, icone('envoyer'), 'WhatsApp'),
        h('a', { class: 'btn btn--ghost', href: `sms:?&body=${encodeURIComponent(message)}` }, icone('mobile'), 'SMS'))),
    actions: [{ libelle: 'Terminé', classe: 'btn--gold', valeur: true, submit: true }],
  });
  recharger();
}

/* ----- Ajouter / corriger un pointage ----- */
async function editer(p, agents, recharger) {
  const sel = h('select', { class: 'input', disabled: !!p }, h('option', { value: '' }, 'Choisir l’agent…'), agents.filter((x) => +x.actif || (p && +x.id === +p.agent_id)).map((x) => h('option', { value: x.id, selected: p && +x.id === +p.agent_id }, x.nom)));
  const maintenant = new Date();
  const debut = h('input', { class: 'input', type: 'datetime-local', value: p ? pourInput(p.debut) : `${iso(maintenant)}T08:00` });
  const fin = h('input', { class: 'input', type: 'datetime-local', value: p ? pourInput(p.fin) : '' });
  const site = saisie({ value: p?.site || '', placeholder: 'ex. Consulat de Colombie' });
  const note = saisie({ value: p?.note || '', placeholder: 'ex. Oubli de pointage, heure confirmée par le client' });
  await modale({
    titre: p ? `Corriger le pointage — ${p.nom}` : 'Ajouter un pointage',
    contenu: h('div', { class: 'form-grille' },
      champ('Agent', sel),
      h('div', { class: 'form-grille form-grille--2' }, champ('Prise de service', debut), champ('Fin de service', fin, 'Laisser vide si le service est en cours')),
      champ('Lieu', site),
      champ('Note', note, 'Visible seulement dans l’admin')),
    actions: [
      { libelle: 'Annuler', classe: 'btn--ghost', valeur: null },
      { libelle: 'Enregistrer', classe: 'btn--gold', submit: true, action: async () => {
        if (!p && !sel.value) { toast('Choisissez l’agent.', 'erreur'); return false; }
        try {
          await api('pointage.enregistrer', { id: p?.id || 0, agent_id: +sel.value, debut: debut.value, fin: fin.value, site: site.value, note: note.value });
          toast('Pointage enregistré.');
          recharger();
        } catch (e) { erreur(e); return false; }
      } },
    ],
  });
}

/* ----- Export CSV (Excel) pour la paie et la facturation ----- */
function exporter(pointages, mois, maintenant) {
  const lignes = pointages.filter((p) => p.debut.slice(0, 7) === mois).slice().reverse();
  if (!lignes.length) return toast('Aucun pointage à exporter ce mois-ci.', 'erreur');
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [['Agent', 'Date', 'Début', 'Fin', 'Durée (h)', 'Lieu', 'Note'].map(cel).join(';')]
    .concat(lignes.map((p) => {
      const d = lire(p.debut);
      const f = p.fin ? lire(p.fin) : null;
      return [p.nom, d.toLocaleDateString('fr-FR'), hm(d), f ? hm(f) : 'en cours', (minutes(p, maintenant) / 60).toFixed(2).replace('.', ','), p.site, p.note].map(cel).join(';');
    })).join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })), download: `Pointage ${mois}.csv` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
