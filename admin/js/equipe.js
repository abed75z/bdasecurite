/* =========================================================
   ESPACE ADMIN BDA — Espace équipe (agents de sécurité, SSIAP, chauffeurs)
   Comptes créés par les agents sur le site, à valider ici ;
   fiches de paie déposées (PDF privés), congés et absences,
   main courante (signalements sur site) et consignes.
   ========================================================= */
import { api, apiFichier, h, icone, toast, erreur, modale, confirmer, champ, saisie, zoneTexte, statutPastille, dateLisible, ilYa, isoVersFr, MOIS, cap, pad } from './outils.js';

const METIERS = { securite: 'Agent de sécurité', ssiap: 'Agent SSIAP', chauffeur: 'Chauffeur VTC' };
const ABSENCES = { conges: 'Congés payés', maladie: 'Arrêt maladie', absence: 'Absence', indispo: 'Indisponibilité' };
const CODES = { conges: 'CP', maladie: 'M', absence: 'ABS', indispo: 'R' };
const INCIDENTS = { intrusion: 'Intrusion / tentative', vol: 'Vol / dégradation', agression: 'Agression / altercation', incendie: 'Incendie / alarme', secours: 'Secours à personne', technique: 'Problème technique', ronde: 'Ronde / contrôle', autre: 'Autre' };
const ONGLETS = [['comptes', 'Comptes'], ['paie', 'Fiches de paie'], ['absences', 'Congés'], ['main-courante', 'Main courante'], ['consignes', 'Consignes']];
const LIEN_INSCRIPTION = 'https://bdasecurite.com/espace-equipe#inscription';
const simple = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).sort().join(' ');
const periode = (a) => (a.du === a.au ? `le ${isoVersFr(a.du)}` : `du ${isoVersFr(a.du)} au ${isoVersFr(a.au)}`);
const nbJours = (a) => Math.round((new Date(a.au) - new Date(a.du)) / 864e5) + 1;
const nomMois = (m) => `${cap(MOIS[+m.slice(5) - 1])} ${m.slice(0, 4)}`;

export async function pageEquipe(ctx) {
  ctx.titre('Espace équipe');
  const onglet = ONGLETS.some(([k]) => k === ctx.params[0]) ? ctx.params[0] : 'comptes';
  const d = await api('equipe');
  if (!ctx.actuel()) return;
  const recharger = () => { ctx.compteurs?.(); pageEquipe(ctx); };
  const attente = {
    comptes: d.comptes.filter((c) => c.statut === 'attente').length,
    absences: d.absences.filter((a) => a.statut === 'attente').length,
    'main-courante': d.mainCourante.filter((m) => m.statut === 'nouveau').length,
  };
  ctx.actions(
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: partagerLien }, icone('envoyer'), h('span', null, 'Lien d’inscription')),
    h('a', { class: 'btn btn--ghost', href: '/espace-equipe', target: '_blank', rel: 'noopener' }, icone('oeil'), h('span', null, 'Voir l’espace')));
  const barre = h('div', { class: 'onglets eqa-onglets' }, ONGLETS.map(([k, l]) => h('a', { class: `onglet ${k === onglet ? 'is-actif' : ''}`, href: `#/equipe/${k}` }, l, attente[k] ? h('span', null, attente[k]) : null)));
  const rendus = { comptes: ongletComptes, paie: ongletPaie, absences: ongletAbsences, 'main-courante': ongletMainCourante, consignes: ongletConsignes };
  ctx.afficher(barre, rendus[onglet](d, recharger));
}

async function partagerLien() {
  const texte = `Bonjour, voici le lien pour créer ton accès à l’Espace équipe BDA Security Group (planning, fiches de paie, congés, main courante) : ${LIEN_INSCRIPTION}\nUne fois ton compte créé, je le valide et tu reçois un email.`;
  await modale({
    titre: 'Inviter un agent',
    contenu: h('div', { class: 'form-grille' },
      h('p', { class: 'modale__texte' }, 'Envoyez ce lien à vos agents : ils créent leur compte eux-mêmes (nom, prénom, email, téléphone, identifiant et mot de passe), puis vous le validez ici en un clic.'),
      h('div', { class: 'eqa-lien' }, h('code', null, LIEN_INSCRIPTION))),
    actions: [
      { libelle: 'Copier le lien', classe: 'btn--ghost', action: async () => { try { await navigator.clipboard.writeText(LIEN_INSCRIPTION); toast('Lien copié.'); } catch (e) { erreur('Copie impossible : sélectionnez le lien.'); } return false; } },
      { libelle: 'Envoyer par WhatsApp', classe: 'btn--gold', action: () => { window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, '_blank', 'noopener'); } },
    ],
  });
}

/* ----- Comptes ----- */
function ongletComptes(d, recharger) {
  const enAttente = d.comptes.filter((c) => c.statut === 'attente');
  const autres = d.comptes.filter((c) => c.statut !== 'attente');
  const libres = d.agents.filter((a) => !d.comptes.some((c) => +c.agent_id === +a.id && ['actif', 'bloque'].includes(c.statut)));
  const choixFiche = (c) => {
    const proche = libres.find((a) => simple(a.nom) === simple(`${c.prenom} ${c.nom}`));
    return h('select', { class: 'input', 'aria-label': 'Fiche agent' },
      h('option', { value: '0' }, `Nouvelle fiche agent : « ${c.prenom} ${c.nom} »`),
      libres.map((a) => h('option', { value: a.id, selected: proche && +proche.id === +a.id }, `Relier à « ${a.nom} » (${a.poste})${+a.actif ? '' : ' — inactif'}`)));
  };
  const demande = (c) => {
    const fiche = choixFiche(c);
    return h('article', { class: 'eqa-demande' },
      h('div', { class: 'eqa-demande__tete' },
        h('span', { class: 'eqa-avatar' }, `${c.prenom[0] || ''}${c.nom[0] || ''}`.toUpperCase()),
        h('div', null, h('b', null, `${c.prenom} ${c.nom}`), h('small', null, `${METIERS[c.metier] || c.metier} · demande ${ilYa(c.cree)}`))),
      h('div', { class: 'eqa-infos' },
        h('span', null, icone('telephone'), h('a', { href: `tel:${c.tel.replace(/[^\d+]/g, '')}` }, c.tel)),
        h('span', null, icone('mail'), h('a', { href: `mailto:${c.email}` }, c.email)),
        h('span', null, icone('cle'), 'Identifiant : ', h('b', null, c.identifiant))),
      champ('Fiche agent', fiche, 'Si l’agent est déjà dans vos fiches, reliez-le : son planning et ses documents apparaîtront dans son espace.'),
      h('div', { class: 'eqa-actions' },
        h('button', { class: 'btn btn--gold', type: 'button', onclick: async (e) => {
          e.currentTarget.disabled = true;
          try { const r = await api('equipe.compte.valider', { id: c.id, agent_id: +fiche.value }); toast(`Compte de ${c.prenom} validé${r.email ? ' : il a reçu un email' : ''}.`); recharger(); } catch (err) { erreur(err); e.currentTarget.disabled = false; }
        } }, icone('coche'), 'Valider l’accès'),
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: async () => {
          if (!(await confirmer(`Refuser la demande de ${c.prenom} ${c.nom} ? Il ne pourra pas se connecter.`, { ok: 'Refuser', danger: true }))) return;
          try { await api('equipe.compte.statut', { id: c.id, statut: 'refuse' }); toast('Demande refusée.'); recharger(); } catch (err) { erreur(err); }
        } }, 'Refuser')));
  };
  const etat = { actif: ['accepte', 'Actif'], bloque: ['refuse', 'Suspendu'], refuse: ['annulee', 'Refusé'] };
  const compte = (c) => h('tr', null,
    h('td', null, h('b', null, `${c.prenom} ${c.nom}`), h('div', { class: 'muet' }, c.identifiant)),
    h('td', null, METIERS[c.metier] || c.metier, c.agent_nom ? h('div', { class: 'muet' }, `Fiche : ${c.agent_nom}`) : null),
    h('td', null, h('a', { href: `tel:${c.tel.replace(/[^\d+]/g, '')}` }, c.tel), h('div', { class: 'muet' }, c.email)),
    h('td', null, c.derniere ? ilYa(c.derniere) : h('span', { class: 'muet' }, 'jamais'), +c.appareils ? h('div', { class: 'muet' }, `${c.appareils} appareil${c.appareils > 1 ? 's' : ''} mémorisé${c.appareils > 1 ? 's' : ''}`) : null),
    h('td', null, statutPastille(...(etat[c.statut] || ['brouillon', c.statut]))),
    h('td', { class: 'eqa-td-actions' },
      c.statut === 'actif' ? h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => {
        if (!(await confirmer(`Suspendre l’accès de ${c.prenom} ${c.nom} ? Il est déconnecté immédiatement de tous ses appareils.`, { ok: 'Suspendre', danger: true }))) return;
        try { await api('equipe.compte.statut', { id: c.id, statut: 'bloque' }); toast('Accès suspendu.'); recharger(); } catch (e) { erreur(e); }
      } }, 'Suspendre') : null,
      c.statut !== 'actif' && +c.agent_id ? h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => {
        try { await api('equipe.compte.statut', { id: c.id, statut: 'actif' }); toast('Accès réactivé.'); recharger(); } catch (e) { erreur(e); }
      } }, 'Réactiver') : null,
      c.statut === 'refuse' && !+c.agent_id ? h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => {
        try { await api('equipe.compte.valider', { id: c.id, agent_id: 0 }); toast('Compte validé.'); recharger(); } catch (e) { erreur(e); }
      } }, 'Valider quand même') : null,
      +c.appareils ? h('button', { class: 'icon-btn', type: 'button', title: 'Déconnecter ses appareils', 'aria-label': 'Déconnecter ses appareils', onclick: async () => {
        if (!(await confirmer(`Déconnecter tous les appareils mémorisés de ${c.prenom} ? Il devra retaper son mot de passe.`, { ok: 'Déconnecter' }))) return;
        try { await api('equipe.compte.deconnecter', { id: c.id }); toast('Appareils déconnectés.'); recharger(); } catch (e) { erreur(e); }
      } }, icone('sortie')) : null,
      +c.agent_id ? h('a', { class: 'icon-btn', href: `#/agents/${c.agent_id}`, title: 'Fiche agent', 'aria-label': 'Fiche agent' }, icone('agents')) : null,
      h('button', { class: 'icon-btn icon-btn--danger', type: 'button', title: 'Supprimer le compte', 'aria-label': 'Supprimer le compte', onclick: async () => {
        if (!(await confirmer(`Supprimer le compte de ${c.prenom} ${c.nom} ? Sa fiche agent, ses documents et ses fiches de paie sont conservés.`, { ok: 'Supprimer', danger: true }))) return;
        try { await api('equipe.compte.supprimer', { id: c.id }); toast('Compte supprimé.'); recharger(); } catch (e) { erreur(e); }
      } }, icone('poubelle'))));
  return h('div', { class: 'eqa-pile' },
    h('section', { class: 'carte' },
      h('header', { class: 'carte__tete' }, h('h2', null, 'Demandes à valider'), h('small', null, enAttente.length ? `${enAttente.length} en attente` : 'Aucune demande en attente')),
      enAttente.length ? h('div', { class: 'eqa-demandes' }, enAttente.map(demande))
        : h('div', { class: 'vide vide--petit' }, icone('agents'), h('p', null, 'Quand un agent crée son compte sur le site, sa demande apparaît ici. Cliquez sur « Lien d’inscription » pour l’envoyer à votre équipe.'))),
    h('section', { class: 'carte' },
      h('header', { class: 'carte__tete' }, h('h2', null, 'Comptes de l’équipe'), h('small', null, `${autres.filter((c) => c.statut === 'actif').length} actif(s)`)),
      autres.length ? h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
        h('thead', null, h('tr', null, ['Agent', 'Métier', 'Contact', 'Dernière connexion', 'Statut', ''].map((t) => h('th', null, t)))),
        h('tbody', null, autres.map(compte)))) : h('div', { class: 'vide vide--petit' }, h('p', null, 'Aucun compte validé pour le moment.'))));
}

/* ----- Fiches de paie ----- */
function ongletPaie(d, recharger) {
  if (d.paies === null) return h('section', { class: 'carte' }, h('div', { class: 'vide' }, icone('cadenas'), h('p', null, 'Les fiches de paie sont réservées à l’administrateur.')));
  const actifs = d.agents.filter((a) => +a.actif);
  const avecCompte = new Set(d.comptes.filter((c) => c.statut === 'actif').map((c) => +c.agent_id));
  const agent = h('select', { class: 'input', required: true }, h('option', { value: '' }, 'Choisir l’agent…'),
    actifs.map((a) => h('option', { value: a.id }, `${a.nom}${avecCompte.has(+a.id) ? '' : ' (pas encore de compte)'}`)));
  const prec = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const mois = saisie({ type: 'month', value: `${prec.getFullYear()}-${pad(prec.getMonth() + 1)}`, required: true });
  const fichiers = h('input', { type: 'file', accept: 'application/pdf,.pdf', class: 'input' });
  const prevenir = h('input', { type: 'checkbox', checked: true });
  const btn = h('button', { class: 'btn btn--gold', type: 'submit' }, icone('envoyer'), 'Déposer dans son espace');
  const form = h('form', { class: 'form-grille form-grille--2', onsubmit: async (e) => {
    e.preventDefault();
    if (!agent.value) return erreur('Choisissez l’agent.');
    if (!fichiers.files[0]) return erreur('Choisissez la fiche de paie (PDF).');
    btn.disabled = true;
    const fd = new FormData();
    fd.append('agent_id', agent.value); fd.append('mois', mois.value); fd.append('fichier', fichiers.files[0]);
    if (prevenir.checked) fd.append('prevenir', '1');
    try { const r = await apiFichier('equipe.paie.ajouter', fd); toast(`Fiche déposée${r.email ? ' et agent prévenu par email' : ''}.`); recharger(); } catch (err) { erreur(err); btn.disabled = false; }
  } },
    champ('Agent', agent), champ('Mois', mois), champ('Fiche de paie (PDF)', fichiers),
    h('label', { class: 'eqa-case' }, prevenir, 'Prévenir l’agent par email'), h('div', null, btn));
  const parMois = {};
  d.paies.forEach((p) => (parMois[p.mois] ||= []).push(p));
  return h('div', { class: 'eqa-pile' },
    h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Déposer une fiche de paie'), h('small', null, 'Stockée hors du site, visible uniquement par l’agent connecté')), form),
    h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Fiches déposées'), h('small', null, `${d.paies.length} fiche(s)`)),
      d.paies.length ? h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
        h('thead', null, h('tr', null, ['Mois', 'Agent', 'Déposée', 'Ouverte par l’agent', ''].map((t) => h('th', null, t)))),
        h('tbody', null, Object.keys(parMois).sort().reverse().flatMap((m) => parMois[m].map((p) => h('tr', null,
          h('td', null, h('b', null, nomMois(p.mois))), h('td', null, p.agent_nom || '—'), h('td', null, dateLisible(p.ajoute)),
          h('td', null, p.vu ? statutPastille('accepte', `Oui, ${ilYa(p.vu)}`) : statutPastille('attente', 'Pas encore')),
          h('td', { class: 'eqa-td-actions' },
            h('a', { class: 'icon-btn', href: `api.php?a=equipe.paie.fichier&id=${p.id}`, target: '_blank', rel: 'noopener', title: 'Voir', 'aria-label': 'Voir' }, icone('oeil')),
            h('button', { class: 'icon-btn icon-btn--danger', type: 'button', title: 'Retirer', 'aria-label': 'Retirer', onclick: async () => {
              if (!(await confirmer(`Retirer la fiche de ${nomMois(p.mois)} de ${p.agent_nom} ? Elle disparaît de son espace.`, { ok: 'Retirer', danger: true }))) return;
              try { await api('equipe.paie.supprimer', { id: p.id }); toast('Fiche retirée.'); recharger(); } catch (e) { erreur(e); }
            } }, icone('poubelle'))))))))) : h('div', { class: 'vide vide--petit' }, h('p', null, 'Aucune fiche déposée pour le moment.'))),
    h('p', { class: 'muet eqa-note' }, icone('cadenas'), 'Les fiches contiennent des données personnelles (n° de sécurité sociale) : elles ne sont jamais accessibles par une adresse publique, seulement par l’agent connecté et par vous.'));
}

/* ----- Congés et absences ----- */
function ongletAbsences(d, recharger) {
  let filtre = d.absences.some((a) => a.statut === 'attente') ? 'attente' : 'tout';
  const zone = h('div', { class: 'eqa-cartes' });
  const etat = { attente: ['attente', 'À traiter'], acceptee: ['accepte', 'Acceptée'], refusee: ['refuse', 'Refusée'], annulee: ['annulee', 'Annulée par l’agent'] };
  const repondre = async (a, statut) => {
    const message = zoneTexte({ placeholder: statut === 'acceptee' ? 'Facultatif — ex. Bonnes vacances !' : 'Ex. Désolé, effectif insuffisant cette semaine.' });
    const planning = h('input', { type: 'checkbox', checked: true });
    const ok = await modale({
      titre: statut === 'acceptee' ? 'Accepter la demande' : 'Refuser la demande',
      contenu: h('div', { class: 'form-grille' },
        h('p', { class: 'modale__texte' }, `${a.agent_nom} — ${ABSENCES[a.type]} ${periode(a)} (${nbJours(a)} jour${nbJours(a) > 1 ? 's' : ''}).`),
        champ('Message à l’agent', message),
        statut === 'acceptee' ? h('label', { class: 'eqa-case' }, planning, `Noter « ${CODES[a.type]} » dans le planning sur ces dates`) : null),
      actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: statut === 'acceptee' ? 'Accepter' : 'Refuser', classe: statut === 'acceptee' ? 'btn--gold' : 'btn--danger', valeur: true, submit: true }],
    });
    if (ok !== true) return;
    try {
      const r = await api('equipe.absence.repondre', { id: a.id, statut, reponse: message.value.trim(), planning: planning.checked });
      toast(statut === 'acceptee' ? (r.jours ? `Acceptée et notée au planning (${r.jours} jour${r.jours > 1 ? 's' : ''}).` : 'Acceptée. (L’agent n’est pas dans le planning de ces mois-là.)') : 'Demande refusée.');
      recharger();
    } catch (e) { erreur(e); }
  };
  const carte = (a) => h('article', { class: `eqa-carte ${a.statut === 'attente' ? 'is-attente' : ''}` },
    h('div', { class: 'eqa-carte__tete' }, h('div', null, h('b', null, a.agent_nom || 'Agent supprimé'), h('small', { class: 'muet' }, `demandé ${ilYa(a.cree)}`)), statutPastille(...etat[a.statut])),
    h('div', { class: 'eqa-carte__titre' }, `${ABSENCES[a.type] || a.type} · ${periode(a)}`, h('span', { class: 'muet' }, ` · ${nbJours(a)} j`)),
    a.motif ? h('p', { class: 'eqa-texte' }, a.motif) : null,
    +a.justificatif ? h('a', { class: 'eqa-piece', href: `api.php?a=agent.doc&id=${a.justificatif}`, target: '_blank', rel: 'noopener' }, icone('devis'), 'Voir le justificatif') : null,
    a.reponse ? h('p', { class: 'eqa-reponse' }, h('b', null, 'Votre réponse : '), a.reponse) : null,
    a.statut === 'attente' ? h('div', { class: 'eqa-actions' },
      h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: () => repondre(a, 'acceptee') }, icone('coche'), 'Accepter'),
      h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => repondre(a, 'refusee') }, 'Refuser')) : null);
  const filtres = h('div', { class: 'chips' });
  const dessiner = () => {
    filtres.replaceChildren(...[['attente', 'À traiter'], ['tout', 'Toutes']].map(([k, l]) => h('button', { type: 'button', class: `chip ${filtre === k ? 'is-actif' : ''}`, onclick: () => { filtre = k; dessiner(); } }, l, h('span', null, k === 'attente' ? d.absences.filter((a) => a.statut === 'attente').length : d.absences.length))));
    const vis = d.absences.filter((a) => filtre === 'tout' || a.statut === 'attente');
    zone.replaceChildren(...(vis.length ? vis.map(carte) : [h('div', { class: 'vide vide--petit' }, icone('planning'), h('p', null, filtre === 'attente' ? 'Aucune demande à traiter.' : 'Aucune demande pour le moment.'))]));
  };
  dessiner();
  return h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Congés et absences'), filtres), zone);
}

/* ----- Main courante ----- */
function ongletMainCourante(d, recharger) {
  let filtre = d.mainCourante.some((m) => m.statut === 'nouveau') ? 'nouveau' : 'tout';
  const zone = h('div', { class: 'eqa-cartes' });
  const etat = { nouveau: ['nouvelle', 'Nouveau'], lu: ['attente', 'Lu'], traite: ['accepte', 'Traité'] };
  const gravite = { urgente: ['refuse', 'Urgent'], normale: ['brouillon', 'Normal'], info: ['envoye', 'Info'] };
  const carte = (m) => {
    const commentaire = zoneTexte({ rows: 2, value: m.commentaire, placeholder: 'Réponse visible par l’agent (facultatif)' });
    const maj = async (statut) => {
      try { await api('equipe.mc.traiter', { id: m.id, statut, commentaire: commentaire.value.trim() }); toast(statut === 'traite' ? 'Marqué comme traité.' : 'Enregistré.'); recharger(); } catch (e) { erreur(e); }
    };
    return h('article', { class: `eqa-carte ${m.statut === 'nouveau' ? 'is-attente' : ''} ${m.gravite === 'urgente' ? 'is-urgent' : ''}` },
      h('div', { class: 'eqa-carte__tete' }, h('div', null, h('b', null, INCIDENTS[m.categorie] || m.categorie), h('small', { class: 'muet' }, `${m.agent_nom || 'Agent supprimé'} · ${dateLisible(m.quand, true)}${m.site ? ` · ${m.site}` : ''}`)),
        h('div', { class: 'eqa-pastilles' }, statutPastille(...gravite[m.gravite]), statutPastille(...etat[m.statut]))),
      h('p', { class: 'eqa-texte' }, m.texte),
      +m.photos ? h('div', { class: 'eqa-photos' }, Array.from({ length: +m.photos }, (_, n) => h('a', { href: `api.php?a=equipe.mc.photo&id=${m.id}&n=${n}`, target: '_blank', rel: 'noopener' }, h('img', { src: `api.php?a=equipe.mc.photo&id=${m.id}&n=${n}`, alt: `Photo ${n + 1}`, loading: 'lazy' })))) : null,
      champ('Commentaire', commentaire),
      h('div', { class: 'eqa-actions' },
        m.statut !== 'traite' ? h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: () => maj('traite') }, icone('coche'), 'Traité') : null,
        m.statut === 'nouveau' ? h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => maj('lu') }, 'Marquer comme lu') : h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => maj(m.statut) }, 'Enregistrer le commentaire')));
  };
  const filtres = h('div', { class: 'chips' });
  const dessiner = () => {
    filtres.replaceChildren(...[['nouveau', 'Nouveaux'], ['ouverts', 'Non traités'], ['tout', 'Tous']].map(([k, l]) => h('button', { type: 'button', class: `chip ${filtre === k ? 'is-actif' : ''}`, onclick: () => { filtre = k; dessiner(); } }, l)));
    const vis = d.mainCourante.filter((m) => filtre === 'tout' || (filtre === 'nouveau' ? m.statut === 'nouveau' : m.statut !== 'traite'));
    zone.replaceChildren(...(vis.length ? vis.map(carte) : [h('div', { class: 'vide vide--petit' }, icone('devis'), h('p', null, 'Rien à signaler ici.'))]));
  };
  dessiner();
  return h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Main courante'), filtres), zone);
}

/* ----- Consignes ----- */
function ongletConsignes(d, recharger) {
  const pour = h('select', { class: 'input' }, h('option', { value: '0' }, 'Toute l’équipe'), d.agents.filter((a) => +a.actif).map((a) => h('option', { value: a.id }, a.nom)));
  const texte = zoneTexte({ rows: 3, maxlength: 1000, placeholder: 'Ex. Tenue complète obligatoire au Consulat à partir de lundi.' });
  const form = h('form', { class: 'form-grille', onsubmit: async (e) => {
    e.preventDefault();
    if (texte.value.trim().length < 3) return erreur('Écrivez la consigne.');
    try { await api('equipe.consigne.ajouter', { agent_id: +pour.value, texte: texte.value.trim() }); toast('Consigne publiée sur l’accueil des agents.'); recharger(); } catch (err) { erreur(err); }
  } }, champ('Pour', pour), champ('Consigne', texte, 'Affichée en haut de l’accueil de l’Espace équipe pendant 45 jours.'), h('div', null, h('button', { class: 'btn btn--gold', type: 'submit' }, icone('envoyer'), 'Publier')));
  return h('div', { class: 'eqa-pile' },
    h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Nouvelle consigne')), form),
    h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Consignes publiées')),
      d.consignes.length ? h('div', { class: 'eqa-cartes' }, d.consignes.map((c) => h('article', { class: 'eqa-carte' },
        h('div', { class: 'eqa-carte__tete' }, h('div', null, h('b', null, +c.agent_id ? c.agent_nom || 'Agent' : 'Toute l’équipe'), h('small', { class: 'muet' }, dateLisible(c.cree))),
          h('button', { class: 'icon-btn icon-btn--danger', type: 'button', 'aria-label': 'Supprimer', onclick: async () => {
            try { await api('equipe.consigne.supprimer', { id: c.id }); toast('Consigne supprimée.'); recharger(); } catch (e) { erreur(e); }
          } }, icone('poubelle'))),
        h('p', { class: 'eqa-texte' }, c.texte)))) : h('div', { class: 'vide vide--petit' }, h('p', null, 'Aucune consigne publiée.'))));
}

