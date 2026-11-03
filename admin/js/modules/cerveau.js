/* =========================================================
   ESPACE ADMIN BDA — Priorités du jour (version 16, module « cerveau »)
   #/cerveau                  ce qui demande votre attention, trié par urgence, avec le lien pour agir
   #/cerveau/demander/<q>     question libre (Ctrl K) : Claude répond à partir des données de l'admin
   Rien n'est modifié ni envoyé automatiquement : chaque carte mène à la page où agir.
   ========================================================= */
import { api, h, icone, toast, erreur, ilYa } from '../outils.js';

const NIVEAUX = [['urgent', 'Urgent', 'À faire maintenant'], ['important', 'À traiter', 'Aujourd’hui'], ['conseil', 'Conseils', 'Quand vous avez un moment']];
const ICONES = { terrain: 'bouclier', exploitation: 'planning', equipe: 'agents', facturation: 'facture', clients: 'clients' };

// Réponse de Claude : paragraphes, listes « - », **gras**, liens [texte](#/page) vers l'admin seulement
function texteRiche(t) {
  const enLigne = (s) => {
    const morceaux = [];
    const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((#\/[a-z0-9/_-]*)\)/gi;
    let i = 0;
    let m;
    while ((m = re.exec(s))) {
      if (m.index > i) morceaux.push(s.slice(i, m.index));
      morceaux.push(m[1] ? h('b', null, m[1]) : h('a', { href: m[3] }, m[2]));
      i = re.lastIndex;
    }
    if (i < s.length) morceaux.push(s.slice(i));
    return morceaux;
  };
  const blocs = [];
  let liste = null;
  String(t || '').split('\n').forEach((l) => {
    const s = l.trim();
    if (/^#+\s/.test(s)) { liste = null; blocs.push(h('h4', null, enLigne(s.replace(/^#+\s*/, '')))); }
    else if (/^([-*•]|\d+[.)])\s/.test(s)) { if (!liste) { liste = h('ul'); blocs.push(liste); } liste.append(h('li', null, enLigne(s.replace(/^([-*•]|\d+[.)])\s*/, '')))); }
    else if (s) { liste = null; blocs.push(h('p', null, enLigne(s))); }
    else liste = null;
  });
  return h('div', { class: 'pj-texte' }, blocs);
}

export async function pageCerveau(ctx) {
  const [vue, ...reste] = ctx.params;
  const question = vue === 'demander' ? reste.join('/') : '';
  ctx.titre('Priorités du jour');
  const d = await api('mod.cerveau.cartes');
  if (!ctx.actuel()) return;
  const recharger = () => pageCerveau(ctx);

  /* En-tête : les trois niveaux */
  const resume = h('section', { class: 'vg-kpis pj-kpis' }, NIVEAUX.map(([k, lib, sous]) => h('a', { class: `vg-kpi ${k === 'urgent' && d.totaux.urgent ? 'is-alerte' : ''}`, href: `#/cerveau`, onclick: (e) => { e.preventDefault(); document.getElementById(`pj-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
    h('span', { class: 'vg-kpi__lib' }, lib), h('b', { class: 'vg-kpi__val' }, String(d.totaux[k])), h('span', { class: 'vg-kpi__sous' }, sous))));

  /* Point du jour (Claude) */
  const zonePoint = h('div', { class: 'pj-point__corps' });
  const dessinerPoint = (p) => zonePoint.replaceChildren(p ? h('div', null, texteRiche(p.texte), h('p', { class: 'pj-meta' }, `Rédigé ${ilYa(p.cree)} à partir des priorités ci-dessous.`))
    : h('p', { class: 'muet' }, d.ia ? 'Un résumé en quelques phrases de ce qui compte aujourd’hui, dans l’ordre où le faire.' : 'Ajoutez une clé Claude dans la page Assistance pour obtenir un point du jour rédigé.'));
  dessinerPoint(d.point);
  const boutonPoint = h('button', { class: 'btn btn--ghost btn--petit', type: 'button', disabled: !d.ia, onclick: async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    b.classList.add('is-chargement');
    zonePoint.replaceChildren(h('div', { class: 'pj-attente' }, h('i'), h('i'), h('i')));
    try { const r = await api('mod.cerveau.point', {}); dessinerPoint(r.point); b.lastChild.textContent = 'Refaire'; } catch (err) { erreur(err); dessinerPoint(d.point); }
    b.disabled = false;
    b.classList.remove('is-chargement');
  } }, icone('eclair'), h('span', null, d.point ? 'Refaire' : 'Rédiger le point du jour'));
  const point = h('section', { class: 'carte pj-point' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Point du jour'), boutonPoint), zonePoint);

  /* Demander */
  const champ = h('input', { class: 'input', type: 'text', maxlength: 600, value: question, placeholder: d.ia ? 'Posez une question : qui travaille ce soir ? quels postes restent vides cette semaine ?' : 'Clé Claude à ajouter dans la page Assistance', disabled: !d.ia });
  const reponse = h('div', { class: 'pj-reponse', hidden: true });
  const demander = async () => {
    const q = champ.value.trim();
    if (q.length < 3) return champ.focus();
    reponse.hidden = false;
    reponse.replaceChildren(h('p', { class: 'pj-q' }, q), h('div', { class: 'pj-attente' }, h('i'), h('i'), h('i')));
    envoyer.disabled = true;
    try {
      const r = await api('mod.cerveau.demander', { question: q });
      reponse.replaceChildren(h('p', { class: 'pj-q' }, q), texteRiche(r.reponse), h('p', { class: 'pj-meta' }, 'Réponse de Claude à partir des données de l’admin. Vérifiez avant d’agir : il ne modifie rien lui-même.'));
      champ.value = '';
    } catch (err) { reponse.replaceChildren(h('p', { class: 'pj-q' }, q), h('p', { class: 'mx-rouge' }, err.message)); }
    envoyer.disabled = false;
  };
  const envoyer = h('button', { class: 'btn btn--gold', type: 'submit', disabled: !d.ia }, icone('envoyer'), h('span', null, 'Demander'));
  const historique = h('details', { class: 'pj-histo', ontoggle: async (e) => {
    if (!e.currentTarget.open || e.currentTarget.dataset.charge) return;
    e.currentTarget.dataset.charge = '1';
    try {
      const r = await api('mod.cerveau.questions');
      e.currentTarget.append(r.questions.length ? h('ul', null, r.questions.map((x) => h('li', null, h('details', null, h('summary', null, h('span', null, x.question), h('small', { class: 'muet' }, ilYa(x.cree))), texteRiche(x.reponse))))) : h('p', { class: 'muet' }, 'Aucune question pour le moment.'));
    } catch (err) { erreur(err); }
  } }, h('summary', null, 'Questions précédentes'));
  const demande = h('section', { class: 'carte pj-demande' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Demander'), h('small', null, 'Planning, sites, agents et priorités ; jamais de téléphone, d’adresse ni de paie')),
    h('form', { class: 'pj-form', onsubmit: (e) => { e.preventDefault(); demander(); } }, champ, envoyer),
    reponse, historique);

  /* Cartes par niveau */
  const carte = (c) => h('article', { class: `pj-carte is-${c.niveau}` },
    h('span', { class: 'pj-carte__ic' }, icone(ICONES[c.domaine] || 'cible')),
    h('div', { class: 'pj-carte__txt' },
      h('h3', null, c.titre), h('p', null, c.detail),
      c.liste.length ? h('ul', null, c.liste.map((x) => h('li', null, x)), c.plus ? h('li', { class: 'muet' }, `et ${c.plus} de plus`) : null) : null),
    h('a', { class: 'btn btn--ghost btn--petit pj-carte__action', href: c.lien }, c.action, icone('suivant')));
  const groupes = NIVEAUX.map(([k, lib]) => {
    const liste = d.cartes.filter((c) => c.niveau === k);
    if (!liste.length) return null;
    return h('section', { class: 'pj-groupe', id: `pj-${k}` }, h('h2', { class: 'pj-groupe__titre' }, h('span', { class: `pj-point-niveau is-${k}` }), lib, h('small', null, String(liste.length))), liste.map(carte));
  });

  /* Réglage : résumé du matin */
  const matin = h('input', { type: 'checkbox', checked: d.reglages.matin, onchange: async (e) => {
    try { await api('mod.cerveau.reglages', { matin: e.target.checked }); toast(e.target.checked ? 'Résumé du matin activé (vers 7 h).' : 'Résumé du matin désactivé.'); } catch (err) { erreur(err); e.target.checked = !e.target.checked; }
  } });

  ctx.actions(h('button', { class: 'btn btn--ghost', type: 'button', onclick: recharger }, icone('activite'), h('span', null, 'Actualiser')));
  ctx.afficher(h('div', { class: 'pj' },
    resume,
    h('div', { class: 'pj-colonnes' },
      h('div', { class: 'pj-col' }, d.cartes.length ? groupes : h('div', { class: 'carte mx-vide' }, h('b', null, 'Rien ne vous attend'), h('p', null, 'Planning complet, factures à jour, équipe en règle. Profitez-en pour démarcher.'))),
      h('div', { class: 'pj-col' }, point, demande,
        h('label', { class: 'case pj-matin' }, matin, h('span', null, h('b', null, 'Résumé du matin'), h('small', { class: 'muet mx-bloc' }, 'Une notification vers 7 h avec les priorités (sans aucun nom).')))))));
  if (question && d.ia) demander();
}
