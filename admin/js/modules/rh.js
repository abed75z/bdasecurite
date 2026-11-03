/* =========================================================
   ESPACE ADMIN BDA — Formations & embauches (module « rh »)
   #/rh             formations et habilitations de chaque agent (échéances)
   #/rh/embauches   liste de contrôle de chaque nouvelle embauche
   ========================================================= */
import { api, h, icone, toast, erreur, modale, confirmer, champ, saisie, isoVersFr } from '../outils.js';

const ONGLETS = [['', 'Formations'], ['embauches', 'Embauches']];
const COLONNES = ['mac_aps', 'sst', 'ssiap', 'h0b0'];
const COURTS = { mac_aps: 'MAC APS', sst: 'SST', ssiap: 'SSIAP', h0b0: 'H0B0' };
const etat = (expire) => { if (!expire) return 'permanent'; const a = new Date().toISOString().slice(0, 10); if (expire < a) return 'expiree'; return expire <= new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10) ? 'bientot' : 'valide'; };

export async function pageRh(ctx) {
  const onglet = ctx.params[0] === 'embauches' ? 'embauches' : '';
  ctx.titre('Formations & embauches');
  const d = await api('mod.rh.tableau');
  if (!ctx.actuel()) return;
  const recharger = () => pageRh(ctx);
  const enCours = d.embauches.filter((e) => e.statut !== 'termine').length;
  const barre = h('nav', { class: 'mx-onglets' }, ONGLETS.map(([k, lib]) => h('a', { class: `mx-onglet ${k === onglet ? 'is-actif' : ''}`, href: `#/rh${k ? `/${k}` : ''}` }, lib,
    k === '' && d.aRenouveler ? h('span', { class: 'mx-onglet__n is-alerte' }, String(d.aRenouveler)) : null,
    k === 'embauches' && enCours ? h('span', { class: 'mx-onglet__n' }, String(enCours)) : null)));
  ctx.afficher(h('div', { class: 'tr rh' }, barre, onglet ? vueEmbauches(d, recharger) : vueFormations(d, recharger)));
}

/* ----- Formations ----- */
async function ficheFormation(d, f, recharger) {
  const agent = h('select', { class: 'input' }, h('option', { value: '' }, 'Choisir l’agent…'), d.agents.map((a) => h('option', { value: a.id, selected: a.id === f.agent_id }, a.nom)));
  const type = h('select', { class: 'input' }, Object.entries(d.types).map(([k, t]) => h('option', { value: k, selected: k === (f.type || 'mac_aps') }, t.libelle)));
  const libelle = saisie({ value: f.libelle && f.type === 'autre' ? f.libelle : '', placeholder: 'Intitulé (pour « Autre formation »)' });
  const obtenu = saisie({ type: 'date', value: f.obtenu || '' });
  const expire = saisie({ type: 'date', value: f.id ? f.expire : '' });
  const aide = h('small', { class: 'champ__aide' });
  const majAide = () => { const m = d.types[type.value]?.mois; aide.textContent = m ? `Laissez vide : calculée tout seule (${m / 12 >= 1 ? `${m / 12} ans` : `${m} mois`} après l’obtention).` : 'Pas d’échéance pour ce type, sauf si vous en indiquez une.'; libelle.parentElement && (libelle.parentElement.hidden = type.value !== 'autre'); };
  type.onchange = majAide;
  const organisme = saisie({ value: f.organisme || '', placeholder: 'Centre de formation' });
  const contenu = h('div', { class: 'form-grille' }, champ('Agent', agent), champ('Formation', type), champ('Intitulé', libelle),
    h('div', { class: 'form-grille form-grille--2' }, champ('Obtenue le', obtenu), h('label', { class: 'champ' }, h('span', { class: 'champ__label' }, 'Échéance'), expire, aide)), champ('Organisme', organisme));
  majAide();
  const ok = await modale({ titre: f.id ? 'Modifier la formation' : 'Ajouter une formation', contenu,
    actions: [
      f.id ? { libelle: 'Retirer', classe: 'btn--ghost', valeur: 'retirer' } : null,
      { libelle: 'Annuler', classe: 'btn--ghost', valeur: false },
      { libelle: 'Enregistrer', classe: 'btn--gold', submit: true, action: async () => {
        try { await api('mod.rh.formation.enregistrer', { id: f.id || 0, agent_id: Number(agent.value), type: type.value, libelle: libelle.value, obtenu: obtenu.value, expire: expire.value, organisme: organisme.value }); return true; } catch (e) { erreur(e); return false; }
      } }].filter(Boolean) });
  if (ok === 'retirer') { if (await confirmer('Retirer cette formation ? (elle reste dans les archives)', { ok: 'Retirer' })) { await api('mod.rh.formation.retirer', { id: f.id }).catch(erreur); recharger(); } return; }
  if (ok) { toast('Formation enregistrée.'); recharger(); }
}
function vueFormations(d, recharger) {
  const parAgent = {};
  d.formations.forEach((f) => { ((parAgent[f.agent_id] ??= {})[f.type] ??= f); }); // la plus récente de chaque type
  const cellule = (a, type) => {
    const f = parAgent[a.id]?.[type];
    if (!f) return h('td', null, h('button', { class: 'rh-vide', type: 'button', title: 'Ajouter', onclick: () => ficheFormation(d, { agent_id: a.id, type }, recharger) }, '+'));
    const e = f.etat;
    return h('td', null, h('button', { class: `rh-case is-${e}`, type: 'button', onclick: () => ficheFormation(d, f, recharger) }, f.expire ? isoVersFr(f.expire) : 'Sans échéance'));
  };
  const aRenouveler = d.formations.filter((f) => ['expiree', 'bientot'].includes(f.etat) && d.agents.some((a) => a.id === f.agent_id));
  return h('div', { class: 'tr-zone' },
    aRenouveler.length ? h('section', { class: 'tr-alerte' }, icone('alerte'), h('div', null, h('b', null, `${aRenouveler.length} formation${aRenouveler.length > 1 ? 's' : ''} à renouveler`),
      h('ul', null, aRenouveler.map((f) => h('li', null, `${d.agents.find((a) => a.id === f.agent_id)?.nom} — ${f.libelle} : ${f.etat === 'expiree' ? 'expirée le' : 'expire le'} ${isoVersFr(f.expire)}`))))) : null,
    h('section', { class: 'carte' },
      h('header', { class: 'carte__tete' }, h('h2', null, 'Échéances par agent'), h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: () => ficheFormation(d, {}, recharger) }, icone('plus'), 'Ajouter une formation')),
      h('p', { class: 'muet rh-legende' }, h('span', { class: 'rh-point is-valide' }), 'à jour', h('span', { class: 'rh-point is-bientot' }), 'dans les 60 jours', h('span', { class: 'rh-point is-expiree' }), 'expirée · cliquez une case pour l’ajouter ou la modifier'),
      d.agents.length ? h('div', { class: 'tableau' }, h('table', { class: 'rh-matrice' },
        h('thead', null, h('tr', null, h('th', null, 'Agent'), h('th', null, 'Carte pro'), COLONNES.map((c) => h('th', null, COURTS[c])), h('th', null, 'Autres'))),
        h('tbody', null, d.agents.map((a) => h('tr', null,
          h('td', null, h('b', null, a.nom), h('small', { class: 'muet mx-bloc' }, a.poste)),
          h('td', null, a.carte ? h('span', { class: `rh-case is-${etat(a.carte)} is-fixe` }, isoVersFr(a.carte)) : h('span', { class: 'muet' }, '—')),
          COLONNES.map((c) => cellule(a, c)),
          h('td', null, d.formations.filter((f) => f.agent_id === a.id && ['cqp_aps', 'autre'].includes(f.type)).map((f) => h('button', { class: 'chip', type: 'button', onclick: () => ficheFormation(d, f, recharger) }, f.libelle)))))))) : h('div', { class: 'mx-vide' }, h('b', null, 'Aucun agent actif'))));
}

/* ----- Embauches ----- */
async function ficheEmbauche(d, e, recharger) {
  const agent = h('select', { class: 'input' }, h('option', { value: '0' }, 'Pas encore dans l’admin'), d.agents.map((a) => h('option', { value: a.id, selected: a.id === e.agent_id }, a.nom)));
  const nom = saisie({ value: e.agent_id ? '' : e.nom || '', placeholder: 'Nom et prénom' });
  const poste = saisie({ value: e.poste || '', placeholder: 'Ex. Agent de sécurité, SSIAP 1' });
  const debut = saisie({ type: 'date', value: e.debut || '' });
  const ok = await modale({ titre: e.id ? `Embauche de ${e.nom}` : 'Nouvelle embauche',
    contenu: h('div', { class: 'form-grille' }, champ('Agent', agent, 'Si la fiche agent existe déjà, choisissez-la.'), champ('Nom (sinon)', nom), h('div', { class: 'form-grille form-grille--2' }, champ('Poste', poste), champ('Première prise de poste', debut))),
    actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: 'Enregistrer', classe: 'btn--gold', submit: true, action: async () => {
      try { await api('mod.rh.embauche.enregistrer', { id: e.id || 0, agent_id: Number(agent.value), nom: nom.value, poste: poste.value, debut: debut.value }); return true; } catch (err) { erreur(err); return false; }
    } }] });
  if (ok) recharger();
}
function vueEmbauches(d, recharger) {
  const total = Object.keys(d.etapes).length;
  const carte = (e) => {
    const faites = () => Object.keys(e.etapes).filter((k) => d.etapes[k]).length;
    const jauge = h('i');
    const compte = h('small', { class: 'muet' });
    const maj = () => { const n = faites(); jauge.style.width = `${Math.round((100 * n) / total)}%`; compte.textContent = `${n}/${total} étapes`; };
    maj();
    return h('section', { class: `carte rh-embauche ${e.statut === 'termine' ? 'is-termine' : ''}` },
      h('header', { class: 'carte__tete' },
        h('div', null, h('h2', null, e.nom), h('small', { class: 'muet' }, [e.poste, e.debut ? `début le ${isoVersFr(e.debut)}` : ''].filter(Boolean).join(' · '))),
        h('div', { class: 'rh-actions' }, compte,
          h('button', { class: 'icon-btn', type: 'button', title: 'Modifier', 'aria-label': 'Modifier', onclick: () => ficheEmbauche(d, e, recharger) }, icone('crayon')),
          h('button', { class: 'icon-btn', type: 'button', title: 'Retirer', 'aria-label': 'Retirer', onclick: async () => { if (await confirmer(`Retirer l’embauche de ${e.nom} de la liste ?`, { ok: 'Retirer' })) { await api('mod.rh.embauche.retirer', { id: e.id }).catch(erreur); recharger(); } } }, icone('croix')))),
      h('div', { class: 'rh-jauge' }, jauge),
      h('ul', { class: 'rh-etapes' }, Object.entries(d.etapes).map(([k, et]) => {
        const fait = e.etapes[k];
        const date = h('small', { class: 'muet' }, fait ? `fait le ${isoVersFr(fait.le)}${fait.par ? ` par ${fait.par}` : ''}` : et.aide);
        const caseFait = h('input', { type: 'checkbox', checked: Boolean(fait), onchange: async (ev) => {
          try {
            const r = await api('mod.rh.embauche.etape', { id: e.id, etape: k, fait: ev.target.checked });
            e.etapes = r.etapes; e.statut = r.statut;
            const f = e.etapes[k];
            date.textContent = f ? `fait le ${isoVersFr(f.le)}${f.par ? ` par ${f.par}` : ''}` : et.aide;
            maj();
            if (r.statut === 'termine') toast(`Embauche de ${e.nom} complète.`);
          } catch (err) { erreur(err); ev.target.checked = !ev.target.checked; }
        } });
        return h('li', null, h('label', { class: 'case' }, caseFait, h('span', null, h('b', null, et.libelle), date)));
      })));
  };
  return h('div', { class: 'tr-zone' },
    h('div', { class: 'rh-tete' }, h('p', { class: 'pf-aide' }, 'Une liste de contrôle par nouvel agent, de la vérification de la carte pro à l’accueil sur le site. Cochez au fur et à mesure : la date et votre nom sont notés.'),
      h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: () => ficheEmbauche(d, {}, recharger) }, icone('plus'), 'Nouvelle embauche')),
    d.embauches.length ? h('div', { class: 'rh-grille' }, d.embauches.map(carte)) : h('div', { class: 'carte mx-vide' }, h('b', null, 'Aucune embauche en cours'), h('p', null, 'Ajoutez la prochaine personne recrutée pour ne rien oublier.')));
}
