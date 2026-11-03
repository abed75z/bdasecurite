/* =========================================================
   ESPACE ADMIN BDA — Bourse & échanges (version 13, module « planif »)
   #/planif              échanges de postes entre agents (à valider)
   #/planif/bourse       postes libres proposés aux agents
   #/planif/besoins      besoins récurrents par site + génération des postes du mois
   ========================================================= */
import { api, h, icone, toast, erreur, confirmer, champ, saisie, dateLisible, ilYa, MOIS, cap } from '../outils.js';

const ONGLETS = [['', 'Échanges'], ['bourse', 'Bourse aux postes'], ['besoins', 'Besoins récurrents']];
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const fmtJour = (s) => { const d = new Date(`${s}T00:00:00`); return `${['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; };

export async function pagePlanif(ctx) {
  const onglet = ONGLETS.some(([k]) => k === (ctx.params[0] || '')) ? (ctx.params[0] || '') : '';
  ctx.titre('Bourse & échanges');
  const d = await api('mod.planif.tableau');
  if (!ctx.actuel()) return;
  const recharger = () => pagePlanif(ctx);
  const aValider = d.echanges.filter((e) => e.statut === 'acceptee').length;
  ctx.actions(h('a', { class: 'btn btn--ghost', href: '#/exploitation' }, icone('planning'), h('span', null, 'Planning des sites')));
  const barre = h('nav', { class: 'mx-onglets' }, ONGLETS.map(([k, lib]) => h('a', { class: `mx-onglet ${k === onglet ? 'is-actif' : ''}`, href: `#/planif${k ? `/${k}` : ''}` },
    lib, k === '' && aValider ? h('span', { class: 'mx-onglet__n is-alerte' }, String(aValider)) : null,
    k === 'bourse' && d.bourse.filter((b) => b.statut === 'ouverte').length ? h('span', { class: 'mx-onglet__n' }, String(d.bourse.filter((b) => b.statut === 'ouverte').length)) : null)));
  const vue = { '': vueEchanges, bourse: vueBourse, besoins: vueBesoins }[onglet](d, recharger);
  ctx.afficher(h('div', { class: 'pf' }, barre, vue));
}

/* ----- Échanges ----- */
function vueEchanges(d, recharger) {
  const decider = async (e, decision, forcer = false) => {
    try {
      await api('mod.planif.echange.decider', { id: Number(e.id), decision, forcer });
      toast(decision === 'valider' ? 'Échange validé : le planning est à jour.' : 'Échange refusé.');
      recharger();
    } catch (err) {
      if (err.statut === 409 && (await confirmer(`${err.message}\n\nValider quand même ?`, { titre: 'À vérifier', ok: 'Valider quand même' }))) return decider(e, decision, true);
      if (err.statut !== 409) erreur(err);
    }
  };
  const STATUTS = { proposee: ['En attente d’un collègue', 'attente'], acceptee: ['À valider', 'retard'], validee: ['Validé', 'payee'], refusee: ['Refusé', 'annulee'], annulee: ['Retiré par l’agent', 'brouillon'] };
  const ligne = (e) => {
    const [lib, ton] = STATUTS[e.statut] || [e.statut, 'brouillon'];
    return h('article', { class: `pf-carte ${e.statut === 'acceptee' ? 'is-a-faire' : ''}` },
      h('div', { class: 'pf-carte__haut' }, h('b', null, `${fmtJour(e.jour)} · ${e.debut}-${e.fin}`), h('span', { class: `pastille pastille--${ton}` }, lib)),
      h('p', { class: 'pf-carte__site' }, e.site_nom || 'Site'),
      h('p', null, h('span', { class: 'muet' }, 'Cédé par '), h('b', null, e.de_nom || 'Agent'), e.vers_agent > 0 ? h('span', { class: 'muet' }, ` à ${e.vers_nom}`) : h('span', { class: 'muet' }, ' à toute l’équipe')),
      e.message ? h('p', { class: 'pf-carte__msg' }, `« ${e.message} »`) : null,
      e.accepte_nom ? h('p', null, h('span', { class: 'muet' }, 'Repris par '), h('b', null, e.accepte_nom), h('span', { class: 'muet' }, ` · ${ilYa(e.accepte_le)}`)) : null,
      e.verif && !e.verif.possible ? h('p', { class: 'pf-carte__alerte' }, icone('alerte'), e.verif.raisons.join(' ')) : null,
      ['proposee', 'acceptee'].includes(e.statut) ? h('div', { class: 'pf-carte__actions' },
        h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => decider(e, 'refuser') }, 'Refuser'),
        e.statut === 'acceptee' ? h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: () => decider(e, 'valider') }, icone('coche'), 'Valider l’échange') : null) : null);
  };
  return h('section', { class: 'pf-section' },
    h('p', { class: 'pf-aide' }, 'Un agent propose de céder un poste dans son espace, un collègue l’accepte, vous validez : le planning change tout seul, avec toutes les règles vérifiées (repos, 48 h, carte pro…).'),
    d.echanges.length ? h('div', { class: 'pf-grille' }, d.echanges.map(ligne))
      : h('div', { class: 'mx-vide' }, h('b', null, 'Aucun échange en cours'), h('p', null, 'Les propositions des agents apparaîtront ici.')));
}

/* ----- Bourse aux postes ----- */
function vueBourse(d, recharger) {
  const ouverts = d.bourse.filter((b) => b.statut === 'ouverte');
  const pris = d.bourse.filter((b) => b.statut === 'prise');
  const proposer = h('button', { class: 'btn btn--gold', type: 'button', disabled: d.libres7 ? null : true, onclick: async () => {
    if (!(await confirmer(`Proposer aux agents les ${d.libres7} poste${d.libres7 > 1 ? 's' : ''} libre${d.libres7 > 1 ? 's' : ''} des 7 prochains jours ? Seuls les agents qui peuvent les tenir les verront.`, { ok: 'Proposer' }))) return;
    try { const r = await api('mod.planif.bourse.proposer', { jours: 7 }); toast(`${r.proposes} poste${r.proposes > 1 ? 's' : ''} proposé${r.proposes > 1 ? 's' : ''} aux agents.`); recharger(); } catch (e) { erreur(e); }
  } }, icone('envoyer'), d.libres7 ? `Proposer les ${d.libres7} postes libres des 7 prochains jours` : 'Aucun poste libre à proposer');
  const table = (liste, avecAction) => h('div', { class: 'tableau' }, h('table', null,
    h('thead', null, h('tr', null, h('th', null, 'Poste'), h('th', null, 'Site'), h('th', null, avecAction ? 'Proposé' : 'Pris par'), h('th', null, ''))),
    h('tbody', null, liste.map((b) => h('tr', null,
      h('td', { class: 'mx-num' }, `${fmtJour(b.jour)} · ${b.debut}-${b.fin}`),
      h('td', null, b.site_nom || 'Site'),
      h('td', null, avecAction ? ilYa(b.propose_le) : h('span', null, h('b', null, b.agent_nom || 'Agent'), h('small', { class: 'muet mx-bloc' }, ilYa(b.pris_le)))),
      h('td', { class: 'mx-droite' }, avecAction ? h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => {
        try { await api('mod.planif.bourse.retirer', { id: Number(b.id) }); toast('Poste retiré de la bourse.'); recharger(); } catch (e) { erreur(e); }
      } }, 'Retirer') : null))))));
  return h('section', { class: 'pf-section' },
    h('div', { class: 'pf-tete' }, h('p', { class: 'pf-aide' }, 'Les postes proposés apparaissent dans l’Espace équipe des agents qui peuvent les tenir. Le premier qui appuie sur « Je prends » est placé, et vous êtes prévenu. Vous pouvez aussi proposer un poste précis depuis sa fiche dans le planning.'), proposer),
    h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Proposés en ce moment'), h('small', null, String(ouverts.length))),
      ouverts.length ? table(ouverts, true) : h('p', { class: 'muet pf-vide' }, 'Aucun poste proposé.')),
    pris.length ? h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Pris ces 14 derniers jours')), table(pris, false)) : null);
}

/* ----- Besoins récurrents ----- */
function vueBesoins(d, recharger) {
  const parSite = new Map();
  d.besoins.forEach((b) => { if (!parSite.has(b.site_nom)) parSite.set(b.site_nom, []); parSite.get(b.site_nom).push(b); });
  const auj = new Date();
  const moisCle = (dd) => `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}`;
  const moisChoix = h('select', { class: 'input input--auto' }, [0, 1, 2].map((n) => { const dd = new Date(auj.getFullYear(), auj.getMonth() + n, 1); return h('option', { value: moisCle(dd) }, cap(`${MOIS[dd.getMonth()]} ${dd.getFullYear()}`)); }));
  const generer = h('button', { class: 'btn btn--gold', type: 'button', disabled: d.besoins.length ? null : true, onclick: async () => {
    try { const r = await api('mod.planif.besoins.generer', { mois: moisChoix.value }); toast(r.crees ? `${r.crees} poste${r.crees > 1 ? 's' : ''} créé${r.crees > 1 ? 's' : ''} dans le planning.` : 'Rien à créer : tous les postes existent déjà.'); } catch (e) { erreur(e); }
  } }, icone('eclair'), 'Générer les postes du mois');

  // Formulaire d'ajout
  const site = h('select', { class: 'input' }, d.sites.map((s) => h('option', { value: s.id }, s.nom)));
  const choisis = new Set([1, 2, 3, 4, 5]);
  const jours = h('div', { class: 'pf-jours' });
  const dessinerJours = () => jours.replaceChildren(...JOURS.map((j, i) => h('button', { type: 'button', class: `chip ${choisis.has(i + 1) ? 'is-actif' : ''}`, onclick: () => { if (choisis.has(i + 1)) choisis.delete(i + 1); else choisis.add(i + 1); dessinerJours(); } }, j)));
  dessinerJours();
  const debut = saisie({ value: '08:00', inputmode: 'numeric' });
  const fin = saisie({ value: '20:00', inputmode: 'numeric' });
  const nombre = saisie({ value: '1', inputmode: 'numeric' });
  const qualif = h('select', { class: 'input' }, Object.entries(d.qualifs).map(([k, l]) => h('option', { value: k }, l)));
  const ajouter = h('form', { class: 'carte pf-form', onsubmit: async (e) => {
    e.preventDefault();
    try {
      await api('mod.planif.besoin.enregistrer', { site_id: Number(site.value), jours: [...choisis], debut: debut.value, fin: fin.value, nombre: Number(nombre.value) || 1, qualif: qualif.value });
      toast('Besoin enregistré.'); recharger();
    } catch (err) { erreur(err); }
  } },
  h('header', { class: 'carte__tete' }, h('h2', null, 'Ajouter un besoin')),
  d.sites.length ? h('div', { class: 'form-grille' },
    champ('Site', site), champ('Jours', jours),
    h('div', { class: 'form-grille form-grille--3' }, champ('Début', debut), champ('Fin', fin), champ('Agents en même temps', nombre)),
    champ('Qualification', qualif),
    h('div', null, h('button', { class: 'btn btn--gold', type: 'submit' }, icone('plus'), 'Ajouter le besoin')))
    : h('p', { class: 'muet' }, 'Créez d’abord un site dans le Planning des sites.'));

  const liste = d.besoins.length ? [...parSite.entries()].map(([nom, bs]) => h('section', { class: 'carte pf-site' },
    h('header', { class: 'carte__tete' }, h('h2', null, nom)),
    h('ul', { class: 'pf-besoins' }, bs.map((b) => h('li', null,
      h('span', { class: 'pf-besoins__jours' }, JOURS.map((j, i) => h('i', { class: String(b.jours).split(',').includes(String(i + 1)) ? 'is-on' : '' }, j[0]))),
      h('b', { class: 'mx-num' }, `${b.debut} – ${b.fin}`),
      h('span', null, `${b.nombre} agent${b.nombre > 1 ? 's' : ''} · ${d.qualifs[b.qualif] || b.qualif}`),
      h('button', { class: 'icon-btn', type: 'button', title: 'Retirer ce besoin', 'aria-label': 'Retirer', onclick: async () => {
        if (!(await confirmer('Retirer ce besoin récurrent ? Les postes déjà créés restent dans le planning.', { ok: 'Retirer' }))) return;
        try { await api('mod.planif.besoin.retirer', { id: Number(b.id) }); recharger(); } catch (e) { erreur(e); }
      } }, icone('croix'))))))) : [h('div', { class: 'mx-vide' }, h('b', null, 'Aucun besoin récurrent'), h('p', null, 'Exemple : Consulat, du lundi au vendredi, 08:30 – 13:30, 1 agent.'))];

  return h('section', { class: 'pf-section' },
    h('div', { class: 'pf-tete' }, h('p', { class: 'pf-aide' }, 'Décrivez une fois les besoins habituels de chaque site, puis créez tous les postes du mois en un clic (non pourvus, sans doublon avec ce qui existe déjà). Ensuite : « Remplir » dans le planning, ou la bourse aux postes.'),
      h('div', { class: 'pf-generer' }, moisChoix, generer)),
    h('div', { class: 'pf-besoins-grille' }, h('div', { class: 'pf-pile' }, liste), ajouter));
}
