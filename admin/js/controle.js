/* =========================================================
   ESPACE ADMIN BDA — Centre de contrôle (la journée en direct)
   Qui est en poste, qui est en retard, les postes non pourvus des 48 h,
   les incidents, absences et cartes pro à surveiller. Se met à jour toutes les 30 s.
   Données : app/exploitation.php (exp_controle).
   ========================================================= */
import { api, h, icone, dateLisible, pad, cap } from './outils.js';

const ETATS = {
  en_poste: ['En poste', 'ok'], arrivee: ['Prise de poste', 'attente'], a_venir: ['À venir', 'neutre'], retard: ['Pas arrivé', 'alerte'],
  partie: ['Parti', 'neutre'], terminee: ['Terminé', 'neutre'], en_cours: ['En cours (pointage non activé)', 'neutre'], sans_pointage: ['Terminé, sans pointage', 'attention'], non_pourvue: ['Non pourvu', 'alerte'],
};
const heure = (ts) => { const d = new Date(ts * 1000); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const initiales = (nom) => String(nom || '?').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase();

export async function pageControle(ctx) {
  ctx.titre('Centre de contrôle');
  const zone = h('div', { class: 'cc' });
  const horloge = h('b', { class: 'cc-horloge' });
  const maj = h('small', { class: 'muet' });
  ctx.actions(
    h('a', { class: 'btn btn--ghost', href: '#/exploitation' }, icone('planning'), h('span', null, 'Planning des sites')),
    h('a', { class: 'btn btn--ghost', href: '#/pointage' }, icone('horloge'), h('span', null, 'Pointages')));
  let premier = true;

  async function charger() {
    let d;
    try { d = await api('controle'); } catch (e) { if (premier) throw e; return; }
    if (!document.body.contains(zone) && !premier) return;
    const mtn = Date.now() / 1000;
    const j = d.journee;
    const compte = (e) => j.filter((v) => v.etat === e).length;
    const retards = j.filter((v) => v.etat === 'retard');
    const s = d.semaine;

    /* ----- Chiffres du moment ----- */
    const tuile = (n, lib, ton, sous) => h('div', { class: `cc-tuile ${ton ? `is-${ton}` : ''}` }, h('b', null, String(n)), h('span', null, lib), sous ? h('small', null, sous) : null);
    const chiffres = h('section', { class: 'cc-chiffres' },
      tuile(d.enPoste.length, 'en poste maintenant', d.enPoste.length ? 'ok' : '', 'd’après les pointages'),
      tuile(j.filter((v) => v.agent_id).length, 'postes aujourd’hui', '', `${compte('terminee') + compte('partie')} terminés`),
      tuile(retards.length, 'pas arrivés', retards.length ? 'alerte' : '', '15 min après la prise de poste'),
      tuile(d.nonPourvues.length, 'non pourvus sous 48 h', d.nonPourvues.length ? 'attention' : '', 'à placer dans le planning'),
      tuile(`${s.heures} h`, 'prévues sur 7 jours', '', `${s.vacations} postes · ${s.agents} agents`));

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
        h('span', { class: `cc-etat is-${ton}` }, lib, v.pointe_a ? h('small', null, ` · pointé ${v.pointe_a}${v.pointe_fin ? `, parti ${v.pointe_fin}` : ''}`) : null),
        h('div', { class: 'cc-poste__actions' },
          v.etat === 'retard' && v.agent_tel ? h('a', { class: 'btn btn--gold btn--petit', href: `tel:${v.agent_tel.replace(/\s/g, '')}` }, icone('telephone'), 'Appeler') : null,
          v.etat === 'non_pourvue' ? h('a', { class: 'btn btn--gold btn--petit', href: `#/exploitation/${v.jour}` }, 'Placer un agent') : null,
          v.agent_tel && v.etat !== 'retard' ? h('a', { class: 'icon-btn', href: `tel:${v.agent_tel.replace(/\s/g, '')}`, title: 'Appeler' }, icone('telephone')) : null));
    };
    const journee = h('section', { class: 'carte cc-journee' },
      h('header', { class: 'carte__tete' }, h('h2', null, 'La journée'), h('small', null, j.length ? `${j.length} poste${j.length > 1 ? 's' : ''}` : '')),
      j.length ? h('div', { class: 'cc-postes' }, j.map(ligne))
        : h('div', { class: 'vide' }, icone('planning'), h('p', null, 'Aucun poste prévu aujourd’hui dans le planning des sites.'), h('a', { class: 'btn btn--gold', href: '#/exploitation' }, 'Ouvrir le planning')));

    /* ----- À surveiller ----- */
    const bloc = (titre, lignes, vide, lien) => h('section', { class: 'carte cc-bloc' },
      h('header', { class: 'carte__tete' }, h('h2', null, titre), lien ? h('a', { class: 'lien-btn', href: lien[0] }, lien[1]) : null),
      lignes.length ? h('ul', { class: 'cc-liste' }, lignes) : h('p', { class: 'muet cc-vide' }, vide));
    const np = bloc('Non pourvus sous 48 h', d.nonPourvues.map((v) => h('li', null,
      h('a', { href: `#/exploitation/${v.jour}` }, h('b', null, v.site_nom || 'Site'), h('small', null, `${cap(dateLisible(v.jour))} · ${v.debut} – ${v.fin} · dans ${v.dans} h`)))), 'Tous les postes sont pourvus.', ['#/exploitation', 'Planning']);
    const graves = { urgente: 'Urgent', info: 'Info' };
    const incidents = bloc('Main courante', d.incidents.map((m) => h('li', { class: m.gravite === 'urgente' ? 'is-alerte' : '' },
      h('a', { href: '#/equipe' }, h('b', null, `${m.categorie}${graves[m.gravite] ? ` · ${graves[m.gravite]}` : ''}`), h('small', null, `${dateLisible(m.quand, true)} · ${m.agent_nom || 'Agent'}${m.site ? ` · ${m.site}` : ''}`), h('span', null, m.texte)))), 'Rien de signalé ces 3 derniers jours.', ['#/equipe', 'Tout voir']);
    const absences = bloc('Absences', d.absences.map((a) => h('li', null,
      h('a', { href: '#/equipe' }, h('b', null, `${a.agent_nom || 'Agent'} · ${a.type}`), h('small', null, `${a.statut === 'attente' ? 'À valider · ' : ''}du ${dateLisible(a.du)} au ${dateLisible(a.au)}`)))), 'Aucune absence en cours ou à valider.', null);
    const cartes = bloc('Cartes pro', d.cartes.map((a) => h('li', { class: a.validite < new Date().toISOString().slice(0, 10) ? 'is-alerte' : '' },
      h('a', { href: `#/agents/${a.id}` }, h('b', null, a.nom), h('small', null, `${a.validite < new Date().toISOString().slice(0, 10) ? 'Expirée le' : 'Expire le'} ${dateLisible(a.validite)}`)))), 'Aucune carte à renouveler dans les 45 jours.', ['#/agents', 'Agents']);

    zone.replaceChildren(chiffres, h('div', { class: 'cc-grille' }, journee, h('div', { class: 'cc-cote' }, np, incidents, absences, cartes)));
    maj.textContent = `Mis à jour à ${heure(Date.now() / 1000)}`;
    premier = false;
  }

  const tic = () => { const d = new Date(); horloge.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  tic();
  await charger();
  if (!ctx.actuel()) return;
  ctx.afficher(h('section', { class: 'cc-entete' },
    h('div', null, h('p', { class: 'cc-surtitre' }, cap(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()))), horloge),
    h('div', { class: 'cc-direct' }, h('i', { class: 'cc-point' }), 'En direct', maj)), zone);
  // mise à jour toutes les 30 s tant que la page est ouverte
  const minuteur = setInterval(() => {
    if (!document.body.contains(zone)) { clearInterval(minuteur); return; }
    tic();
    if (!document.hidden) charger();
  }, 30000);
}
