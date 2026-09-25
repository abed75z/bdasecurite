/* =========================================================
   ESPACE ADMIN BDA — pages : accueil, demandes, candidatures,
   avis, clients, agents, paramètres
   ========================================================= */
import {
  api, h, $, $$, icone, toast, erreur, modale, confirmer, champ, saisie, zoneTexte, statutPastille,
  nombre, dateLisible, ilYa, isoVersFr, MOIS, cap, pad, iso,
} from './outils.js';
import { listeDocuments, editeurDocument } from './documents.js';
import { pagePlanning } from './planning.js';
import { pageCartes } from './cartes.js';
import { pageFlyers } from './flyers.js';
import { pageVisites } from './visites.js';
import { pageAgents } from './agents.js';
import { pageVtc } from './vtc.js';
import { pageSite } from './site.js';
import { pageNotes } from './notes.js';
import { pageSecurite, ligneJournal } from './securite.js';

export const PAGES = {
  '': pageAccueil,
  demandes: pageDemandes,
  devis: (ctx) => (ctx.params[0] ? editeurDocument(ctx, 'devis', ctx.params[0]) : listeDocuments(ctx, 'devis')),
  factures: (ctx) => (ctx.params[0] ? editeurDocument(ctx, 'facture', ctx.params[0]) : listeDocuments(ctx, 'facture')),
  planning: pagePlanning,
  clients: pageClients,
  agents: pageAgents,
  vtc: pageVtc,
  site: pageSite,
  notes: pageNotes,
  securite: pageSecurite,
  cartes: pageCartes,
  flyers: pageFlyers,
  visites: pageVisites,
  avis: pageAvis,
  candidatures: pageCandidatures,
  parametres: pageParametres,
};

const carte = (titre, ...contenu) => h('section', { class: 'carte' }, titre ? h('header', { class: 'carte__tete' }, titre) : null, contenu);
const vide = (texte, ic = 'coche') => h('div', { class: 'vide' }, icone(ic), h('p', null, texte));
function telecharger(nom, texte, type = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([texte], { type })), download: nom });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function filtres(options, actif, surChoix) {
  const zone = h('div', { class: 'chips' });
  const dessiner = (courant) => zone.replaceChildren(...options.map(([cle, libelle, n]) => h('button', {
    type: 'button', class: `chip ${cle === courant ? 'is-actif' : ''}`, onclick: () => { dessiner(cle); surChoix(cle); },
  }, libelle, n !== undefined ? h('span', null, n) : null)));
  dessiner(actif);
  return zone;
}

/* =========================================================
   ACCUEIL : créer en un clic, ce qui attend une action, derniers éléments
   ========================================================= */
async function pageAccueil(ctx) {
  ctx.titre('Centre de contrôle');
  const auj = new Date();
  const moisCourant = `${auj.getFullYear()}-${pad(auj.getMonth() + 1)}`;
  const [{ accueil: a }, session] = await Promise.all([api('accueil'), api('session')]);
  const c = a.compteurs;
  const s = a.site || {};
  const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
  const hm = (d) => { const x = new Date(String(d || '').replace(' ', 'T')); return Number.isNaN(x.getTime()) ? '' : `${pad(x.getHours())}:${pad(x.getMinutes())}`; };

  /* ----- Bandeau « poste de commande » ----- */
  const salut = auj.getHours() < 18 ? 'Bonjour' : 'Bonsoir';
  const utilisateur = cap(String(session.utilisateur || ''));
  const horloge = h('b', { class: 'poste__heure' });
  const dateJour = h('span', { class: 'poste__date' });
  let minuteur = 0;
  const tic = () => {
    if (horloge.dataset.pret && !horloge.isConnected) { clearInterval(minuteur); return; }
    const d = new Date();
    horloge.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    dateJour.textContent = cap(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d));
  };
  tic();
  minuteur = setInterval(tic, 1000);
  const sessionTxt = a.session ? `Session ouverte à ${hm(a.session.debut)} · ${a.session.appareil}` : 'Session sécurisée';
  const precedente = a.precedente ? `Connexion précédente : ${dateLisible(a.precedente.debut, true)} · ${a.precedente.appareil}` : '';
  const poste = h('section', { class: 'poste' },
    h('div', { class: 'poste__grille', 'aria-hidden': 'true' }),
    h('div', { class: 'poste__gauche' },
      h('span', { class: 'poste__badge' }, h('i'), 'Accès administrateur · contrôle total'),
      h('h2', null, `${salut}${utilisateur ? `, ${utilisateur}` : ''}.`, h('em', null, ' Tout est sous contrôle.')),
      h('p', { class: 'poste__session' }, icone('cle'), h('span', null, sessionTxt, precedente ? ` · ${precedente}` : '')),
      h('button', { class: 'poste__cmd', type: 'button', onclick: () => document.dispatchEvent(new CustomEvent('bda:palette')) },
        h('span', { class: 'poste__invite', 'aria-hidden': 'true' }, '›'), h('span', null, 'Tapez une commande : note…, devis…, site off, bandeau…'), h('kbd', null, 'Ctrl K'))),
    h('div', { class: 'poste__droite' }, horloge, dateJour));
  horloge.dataset.pret = '1';

  /* ----- Voyants ----- */
  const servicesOuverts = ['devis', 'vtc', 'recrutement', 'avis'].filter((k) => s[k]).length;
  const aTraiter = (c.reservations || 0) + (c.demandes || 0) + (c.avis || 0) + (c.candidatures || 0) + (c.retards || 0);
  const voyant = (href, etatCls, ic, titre, valeur, sous) => h('a', { class: `voyant voyant--${etatCls}`, href },
    h('span', { class: 'voyant__tete' }, h('span', { class: 'voyant__ic' }, icone(ic)), h('span', { class: 'voyant__led', 'aria-hidden': 'true' })),
    h('small', null, titre), h('b', null, valeur), h('span', { class: 'voyant__sous' }, sous));
  const voyants = h('div', { class: 'voyants' },
    s.horsLigne
      ? voyant('#/site', 'rouge', 'site', 'Site public', 'Hors ligne', 'Maintenance affichée aux visiteurs')
      : voyant('#/site', 'vert', 'site', 'Site public', 'En ligne', 'bdasecurite.com accessible'),
    voyant('#/site', servicesOuverts === 4 ? 'vert' : 'or', 'eclair', 'Services', `${servicesOuverts} / 4 ouverts`,
      [['devis', 'Devis'], ['vtc', 'VTC'], ['recrutement', 'Recrutement'], ['avis', 'Avis']].map(([k, l]) => `${s[k] ? '●' : '○'} ${l}`).join('   ')),
    voyant(aTraiter ? '#/demandes' : '#/', aTraiter ? 'or' : 'vert', 'demande', 'À traiter', aTraiter ? pluriel(aTraiter, 'élément', 'éléments') : 'Rien', aTraiter ? 'Voir la liste ci-dessous' : 'Tout est à jour'),
    voyant('#/securite', a.alertes ? 'rouge' : 'vert', 'bouclier', 'Sécurité', pluriel(a.appareils || 1, 'appareil connecté', 'appareils connectés'),
      a.alertes ? `${pluriel(a.alertes, 'tentative refusée', 'tentatives refusées')} (7 j)` : 'Aucune tentative suspecte'));

  /* ----- Créer ----- */
  const action = (href, ic, titre, sous) => h('a', { class: 'action', href }, h('span', { class: 'action__ic' }, icone(ic)), icone('plus', 'action__plus'), h('span', null, h('b', null, titre), h('small', null, sous)));
  const creer = h('div', { class: 'creer' },
    action('#/devis/nouveau', 'devis', 'Devis', 'Nouveau devis client'),
    action('#/factures/nouveau', 'facture', 'Facture', 'Nouvelle facture'),
    action(`#/planning/${moisCourant}`, 'planning', 'Planning', `${cap(MOIS[auj.getMonth()])} ${auj.getFullYear()}`),
    action('#/cartes/nouvelle', 'badge', 'Carte agent', 'Carte pro à imprimer'),
    action('#/flyers/nouveau', 'flyer', 'Flyer', 'Flyer A4 ou A5'),
    action('#/visites/nouvelle', 'visite', 'Carte de visite', 'À laisser aux clients'));

  const installation = a.installation ? h('section', { class: 'carte installation' },
    h('div', null, h('span', { class: 'kicker' }, 'Dernière étape'), h('h3', null, 'Terminez l\'installation de votre espace'),
      h('p', null, 'Importez le fichier « BDA-import-admin.json » (dossier « BDA Gestion » sur votre Bureau) : vos informations de paiement et la facture du Consulat seront ajoutées automatiquement.')),
    h('div', { class: 'installation__actions' }, boutonImport(() => ctx.aller('#/factures')), h('a', { class: 'btn btn--ghost', href: '#/parametres' }, 'Saisir mon IBAN'))) : null;

  /* ----- À traiter ----- */
  const taches = [
    c.horsLigne && { n: '!', href: '#/site', titre: 'Votre site est hors ligne', sous: 'Les visiteurs voient la page Maintenance · remettez-le en ligne en un clic', alerte: true },
    c.reservations && { n: c.reservations, href: '#/vtc', titre: pluriel(c.reservations, 'réservation VTC à confirmer', 'réservations VTC à confirmer'), sous: 'Page de réservation du site' },
    c.demandes && { n: c.demandes, href: '#/demandes', titre: pluriel(c.demandes, 'nouvelle demande de devis', 'nouvelles demandes de devis'), sous: 'Reçues depuis le site' },
    c.avis && { n: c.avis, href: '#/avis', titre: pluriel(c.avis, 'avis à valider', 'avis à valider'), sous: 'Publiez-les ou refusez-les' },
    c.candidatures && { n: c.candidatures, href: '#/candidatures', titre: pluriel(c.candidatures, 'nouvelle candidature', 'nouvelles candidatures'), sous: 'Page Recrutement' },
    c.retards && { n: c.retards, href: '#/factures', titre: pluriel(c.retards, 'facture à relancer', 'factures à relancer'), sous: 'Échéance dépassée', alerte: true },
    a.alertes && { n: a.alertes, href: '#/securite', titre: pluriel(a.alertes, 'tentative de connexion refusée', 'tentatives de connexion refusées'), sous: 'Ces 7 derniers jours · vérifiez le journal', alerte: true },
    ...a.agentsAlerte.map((ag) => ({ n: '!', href: `#/agents/${ag.id}`, titre: `Carte pro de ${ag.nom}`, sous: `${ag.validite < a.aujourdhui ? 'Expirée le' : 'Expire le'} ${isoVersFr(ag.validite)}`, alerte: ag.validite < a.aujourdhui })),
  ].filter(Boolean);
  const aFaire = taches.length ? h('ul', { class: 'todo' }, taches.map((t) => h('li', null, h('a', { href: t.href },
    h('span', { class: `todo__n ${t.alerte ? 'todo__n--alerte' : ''}` }, t.n), h('span', { class: 'todo__txt' }, h('b', null, t.titre), h('small', null, t.sous)), icone('suivant')))))
    : h('div', { class: 'a-jour' }, icone('coche'), h('span', null, 'Tout est à jour. Rien ne vous attend.'));

  /* ----- Activité (journal) ----- */
  const activite = a.journal.length
    ? h('div', { class: 'console-cadre console-cadre--compact' }, h('ol', { class: 'console' }, a.journal.map((j) => ligneJournal(j))))
    : vide('L’activité de l’espace admin s’affichera ici (connexions, documents, site…).', 'activite');

  /* ----- Notes épinglées + prise de note rapide ----- */
  const rapide = h('textarea', { class: 'input note-rapide', rows: 2, placeholder: 'Note rapide… (Ctrl + Entrée pour l’épingler ici)' });
  const notesListe = h('div', { class: 'notes-mini' });
  const dessinerNotes = (notes) => notesListe.replaceChildren(...notes.map((n) => h('a', { class: `note-mini note--${n.couleur || 'aucune'}`, href: `#/notes/${n.id}` }, h('p', null, n.texte.slice(0, 220)), h('small', null, ilYa(n.maj)))));
  dessinerNotes(a.notes);
  const enregistrerRapide = async () => {
    const texte = rapide.value.trim();
    if (!texte) return rapide.focus();
    try { await api('note.enregistrer', { texte, epingle: true }); rapide.value = ''; toast('Note épinglée sur l’accueil.'); const { accueil: b } = await api('accueil'); dessinerNotes(b.notes); } catch (e) { erreur(e); }
  };
  rapide.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enregistrerRapide(); } });
  const blocNotes = carte([h('h2', null, 'Notes épinglées'), h('a', { class: 'lien-carte', href: '#/notes' }, `Toutes les notes (${a.nbNotes})`)],
    h('div', { class: 'note-rapide__zone' }, rapide, h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: enregistrerRapide }, icone('epingle'), 'Épingler')), notesListe);

  /* ----- Derniers éléments ----- */
  const TYPES = {
    devis: { ic: 'devis', lien: 'devis', nom: 'Devis' }, facture: { ic: 'facture', lien: 'factures', nom: 'Facture' },
    carte: { ic: 'badge', lien: 'cartes', nom: 'Carte agent' }, flyer: { ic: 'flyer', lien: 'flyers', nom: 'Flyer' }, visite: { ic: 'visite', lien: 'visites', nom: 'Carte de visite' },
  };
  const recents = a.recents.length ? h('ul', { class: 'recents' }, a.recents.map((r) => {
    const T = TYPES[r.type] || TYPES.devis;
    return h('li', null, h('a', { href: `#/${T.lien}/${r.id}` }, h('span', { class: 'recents__ic' }, icone(T.ic)),
      h('span', { class: 'recents__txt' }, h('b', null, [r.titre || 'Sans titre', r.sous].filter(Boolean).join(' — ')), h('small', null, `${T.nom} · modifié ${ilYa(r.maj)}`)),
      r.statut ? statutPastille(r.statut) : null));
  })) : vide('Vos devis, factures, cartes et flyers apparaîtront ici.', 'horloge');

  ctx.afficher(poste, voyants, installation, creer,
    h('div', { class: 'grille-2' },
      carte([h('h2', null, 'À traiter'), h('small', null, taches.length ? pluriel(taches.length, 'élément', 'éléments') : '')], aFaire),
      carte([h('h2', null, 'Activité en direct'), h('a', { class: 'lien-carte', href: '#/securite' }, 'Journal complet')], activite)),
    h('div', { class: 'grille-2' },
      blocNotes,
      carte([h('h2', null, 'Derniers éléments modifiés')], recents)));
}

/* ---------- Import du fichier de démarrage ---------- */
function boutonImport(apres) {
  const input = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => {
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    try {
      const donnees = JSON.parse(await f.text());
      const { resultat: r } = await api('import', donnees);
      toast(`Import réussi : ${r.documents} document(s), ${r.clients} client(s), ${r.reglages ? 'paramètres mis à jour' : 'aucun paramètre'}.`);
      apres?.();
    } catch (e) { erreur(e instanceof SyntaxError ? new Error('Ce fichier est illisible.') : e); }
  } });
  return h('span', null, input, h('button', { class: 'btn btn--gold', type: 'button', onclick: () => input.click() }, icone('telecharger'), 'Importer le fichier de démarrage'));
}

/* =========================================================
   DEMANDES DE DEVIS (reçues depuis le site)
   ========================================================= */
async function pageDemandes(ctx) {
  ctx.titre('Demandes reçues');
  const { demandes } = await api('demandes');
  let filtre = demandes.some((d) => d.statut === 'nouvelle') ? 'nouvelle' : 'tous';
  const liste = h('div', { class: 'cartes-liste' });
  const compte = (s) => demandes.filter((d) => d.statut === s).length;
  const dessiner = () => {
    const vis = demandes.filter((d) => filtre === 'tous' || d.statut === filtre);
    liste.replaceChildren(...(vis.length ? vis.map((d) => carteDemande(d)) : [vide(demandes.length ? 'Aucune demande dans cette catégorie.' : 'Les demandes envoyées depuis la page « Demander un devis » du site arriveront ici.', 'demande')]));
  };
  function carteDemande(d) {
    const v = d.data;
    return h('button', { type: 'button', class: `fiche ${d.statut === 'nouvelle' ? 'fiche--nouvelle' : ''}`, onclick: () => ouvrir(d) },
      h('div', { class: 'fiche__tete' }, h('b', null, v['Nom / Société'] || 'Sans nom'), statutPastille(d.statut)),
      h('p', { class: 'fiche__sujet' }, v.Prestation || 'Prestation non précisée'),
      h('p', { class: 'fiche__texte' }, v['Détails'] || ''),
      h('div', { class: 'fiche__pied' }, h('span', null, icone('planning'), v['Date souhaitée'] || '—'), h('span', null, icone('horloge'), ilYa(d.recu))));
  }
  async function changer(d, statut) {
    await api('demande.statut', { id: d.id, statut });
    d.statut = statut;
    dessiner(); ctx.compteurs();
  }
  async function ouvrir(d) {
    const v = d.data;
    const tel = v['Téléphone'] || '', mail = v.Email || '';
    const choix = await modale({
      titre: v['Nom / Société'] || 'Demande',
      large: true,
      contenu: [
        h('dl', { class: 'details' }, Object.entries(v).filter(([k]) => k !== 'Consentement').map(([k, val]) => [h('dt', null, k), h('dd', null, val)])),
        h('p', { class: 'modale__meta' }, `Reçue le ${dateLisible(d.recu, true)}`),
        h('div', { class: 'modale__raccourcis' },
          tel ? h('a', { class: 'btn btn--ghost', href: `tel:${tel.replace(/[^\d+]/g, '')}` }, icone('telephone'), 'Appeler') : null,
          mail ? h('a', { class: 'btn btn--ghost', href: `mailto:${mail}?subject=${encodeURIComponent(`Votre demande de devis ${v['Référence'] || ''} — BDA Sécurité`)}` }, icone('mail'), 'Répondre par email') : null),
      ],
      actions: [
        { libelle: 'Supprimer', classe: 'btn--danger-ghost', valeur: 'supprimer' },
        { libelle: d.statut === 'archivee' ? 'Remettre en nouvelle' : 'Archiver', classe: 'btn--ghost', valeur: d.statut === 'archivee' ? 'nouvelle' : 'archivee' },
        { libelle: 'Marquer traitée', classe: 'btn--ghost', valeur: 'traitee' },
        { libelle: 'Créer un devis', classe: 'btn--gold', valeur: 'devis', submit: true },
      ],
    });
    try {
      if (choix === 'devis') {
        sessionStorage.setItem('bda-prefill-devis', JSON.stringify({
          client: { nom: v['Nom / Société'] || '', adresse: [tel ? `TÉL : ${tel}` : '', mail].filter(Boolean).join('\n') },
          objet: v.Prestation || '', description: v['Détails'] || '',
          periode: [v['Date souhaitée'], v.Heure && v.Heure !== 'Non précisée' ? `à ${v.Heure}` : ''].filter(Boolean).join(' '),
        }));
        if (d.statut === 'nouvelle') await changer(d, 'traitee');
        ctx.aller('#/devis/nouveau');
      } else if (choix === 'supprimer') {
        if (!(await confirmer('Supprimer définitivement cette demande ?', { ok: 'Supprimer', danger: true }))) return;
        await api('demande.supprimer', { id: d.id });
        demandes.splice(demandes.indexOf(d), 1);
        dessiner(); ctx.compteurs(); toast('Demande supprimée.');
      } else if (choix) {
        await changer(d, choix);
      }
    } catch (e) { erreur(e); }
  }
  ctx.afficher(carte(null, h('div', { class: 'carte__outils' }, filtres([['nouvelle', 'Nouvelles', compte('nouvelle')], ['traitee', 'Traitées', compte('traitee')], ['archivee', 'Archivées', compte('archivee')], ['tous', 'Toutes', demandes.length]], filtre, (f) => { filtre = f; dessiner(); })), liste));
  dessiner();
  const cible = demandes.find((d) => String(d.id) === ctx.params[0]);
  if (cible) ouvrir(cible);
}

/* =========================================================
   CANDIDATURES
   ========================================================= */
async function pageCandidatures(ctx) {
  ctx.titre('Candidatures');
  const { candidatures } = await api('candidatures');
  const L = { nouvelle: 'Nouvelles', en_cours: 'En cours', retenue: 'Retenues', refusee: 'Refusées' };
  let filtre = 'tous';
  const liste = h('div', { class: 'cartes-liste' });
  const dessiner = () => {
    const vis = candidatures.filter((c) => filtre === 'tous' || c.statut === filtre);
    liste.replaceChildren(...(vis.length ? vis.map((c) => h('button', { type: 'button', class: `fiche ${c.statut === 'nouvelle' ? 'fiche--nouvelle' : ''}`, onclick: () => ouvrir(c) },
      h('div', { class: 'fiche__tete' }, h('b', null, c.data['Nom et prénom'] || 'Candidat'), statutPastille(c.statut)),
      h('p', { class: 'fiche__sujet' }, c.data.Poste || ''),
      h('p', { class: 'fiche__texte' }, [c.data['Carte professionnelle'], c.data['Expérience']].filter(Boolean).join(' · ')),
      h('div', { class: 'fiche__pied' }, h('span', null, icone('telephone'), c.data['Téléphone'] || '—'), h('span', null, icone('horloge'), ilYa(c.recu))))) : [vide(candidatures.length ? 'Aucune candidature dans cette catégorie.' : 'Les candidatures envoyées depuis la page Recrutement arriveront ici.', 'candidature')]));
  };
  async function ouvrir(c) {
    const v = c.data, tel = v['Téléphone'] || '', mail = v.Email || '';
    const sel = h('select', { class: 'input' }, Object.entries(L).map(([k, l]) => h('option', { value: k, selected: k === c.statut }, l.replace(/s$/, ''))));
    const choix = await modale({
      titre: v['Nom et prénom'] || 'Candidature', large: true,
      contenu: [
        h('dl', { class: 'details' }, Object.entries(v).filter(([k]) => k !== 'Consentement').map(([k, val]) => [h('dt', null, k), h('dd', null, /^https?:\/\//.test(val) ? h('a', { href: val, target: '_blank', rel: 'noopener noreferrer' }, val) : val)])),
        h('p', { class: 'modale__meta' }, `Reçue le ${dateLisible(c.recu, true)}`),
        h('div', { class: 'modale__raccourcis' },
          tel ? h('a', { class: 'btn btn--ghost', href: `tel:${tel.replace(/[^\d+]/g, '')}` }, icone('telephone'), 'Appeler') : null,
          mail ? h('a', { class: 'btn btn--ghost', href: `mailto:${mail}` }, icone('mail'), 'Écrire') : null),
        champ('Statut', sel),
      ],
      actions: [
        { libelle: 'Supprimer', classe: 'btn--danger-ghost', valeur: 'supprimer' },
        { libelle: 'Ajouter à mes agents', classe: 'btn--ghost', valeur: 'agent' },
        { libelle: 'Enregistrer', classe: 'btn--gold', submit: true, action: () => 'statut' },
      ],
    });
    try {
      if (choix === 'statut' || choix === 'agent') {
        if (sel.value !== c.statut) { await api('candidature.statut', { id: c.id, statut: sel.value }); c.statut = sel.value; }
        if (choix === 'agent') {
          await api('agent.enregistrer', { categorie: 'secondaire', nom: v['Nom et prénom'] || '', poste: /vtc|chauffeur/i.test(v.Poste || '') ? 'Chauffeur VTC' : 'ADS', tel, carte: v['N° de carte'] && v['N° de carte'] !== 'Non précisé' ? v['N° de carte'] : '', actif: 1 });
          toast('Ajouté à vos agents.');
        }
      } else if (choix === 'supprimer') {
        if (!(await confirmer('Supprimer définitivement cette candidature ?', { ok: 'Supprimer', danger: true }))) return;
        await api('candidature.supprimer', { id: c.id });
        candidatures.splice(candidatures.indexOf(c), 1);
        toast('Candidature supprimée.');
      }
      dessiner(); ctx.compteurs();
    } catch (e) { erreur(e); }
  }
  const n = (s) => candidatures.filter((c) => c.statut === s).length;
  ctx.afficher(carte(null, h('div', { class: 'carte__outils' }, filtres([['tous', 'Toutes', candidatures.length], ...Object.entries(L).map(([k, l]) => [k, l, n(k)])], filtre, (f) => { filtre = f; dessiner(); })), liste));
  dessiner();
}

/* =========================================================
   AVIS CLIENTS
   ========================================================= */
async function pageAvis(ctx) {
  ctx.titre('Avis clients');
  let { avis } = await api('avis');
  ctx.actions(h('a', { class: 'btn btn--ghost', href: '/avis', target: '_blank', rel: 'noopener' }, icone('site'), h('span', null, 'Voir la page Avis')));
  let filtre = avis.some((a) => a.statut === 'attente') ? 'attente' : 'tous';
  const liste = h('div', { class: 'cartes-liste' });
  const etoiles = (n) => h('span', { class: 'etoiles', 'aria-label': `${n} sur 5` }, Array.from({ length: 5 }, (_, i) => h('span', { class: i < n ? 'on' : '' }, '★')));
  function dessiner() {
    const vis = avis.filter((a) => filtre === 'tous' || a.statut === filtre);
    liste.replaceChildren(...(vis.length ? vis.map((a) => h('article', { class: `fiche fiche--avis ${a.statut === 'attente' ? 'fiche--nouvelle' : ''}` },
      h('div', { class: 'fiche__tete' }, h('b', null, a.nom), statutPastille(a.statut)),
      h('div', { class: 'fiche__sujet' }, etoiles(+a.note), a.prestation ? h('span', { class: 'muet' }, ` · ${a.prestation}`) : null),
      h('p', { class: 'fiche__texte fiche__texte--long' }, a.texte),
      h('div', { class: 'fiche__pied' }, h('span', null, icone('horloge'), dateLisible(a.recu)), a.email ? h('a', { href: `mailto:${a.email}` }, icone('mail'), 'Répondre') : null),
      h('div', { class: 'fiche__actions' },
        a.statut !== 'publie' ? h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: () => statut(a, 'publie') }, icone('coche'), 'Publier') : h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => statut(a, 'attente') }, 'Retirer du site'),
        a.statut !== 'refuse' ? h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => statut(a, 'refuse') }, 'Refuser') : null,
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Supprimer', onclick: () => supprimer(a) }, icone('poubelle'))))) : [vide(avis.length ? 'Aucun avis dans cette catégorie.' : 'Les avis déposés sur la page Avis du site arriveront ici pour validation.', 'avis')]));
  }
  async function statut(a, s) {
    try { await api('avis.statut', { id: a.id, statut: s }); a.statut = s; dessiner(); ctx.compteurs(); toast(s === 'publie' ? 'Avis publié sur le site.' : s === 'refuse' ? 'Avis refusé.' : 'Avis retiré du site.'); } catch (e) { erreur(e); }
  }
  async function supprimer(a) {
    if (!(await confirmer(`Supprimer définitivement l'avis de ${a.nom} ?`, { ok: 'Supprimer', danger: true }))) return;
    try { await api('avis.supprimer', { id: a.id }); avis = avis.filter((x) => x !== a); dessiner(); ctx.compteurs(); } catch (e) { erreur(e); }
  }
  const n = (s) => avis.filter((a) => a.statut === s).length;
  ctx.afficher(carte(null, h('div', { class: 'carte__outils' }, filtres([['attente', 'À valider', n('attente')], ['publie', 'Publiés', n('publie')], ['refuse', 'Refusés', n('refuse')], ['tous', 'Tous', avis.length]], filtre, (f) => { filtre = f; dessiner(); })), liste),
    h('p', { class: 'astuce' }, 'Seuls les avis publiés apparaissent sur le site. Ne publiez jamais un faux avis : c\'est interdit et sanctionné.'));
  dessiner();
}

/* =========================================================
   CLIENTS
   ========================================================= */
async function pageClients(ctx) {
  ctx.titre('Clients');
  let { clients } = await api('clients');
  ctx.actions(h('button', { class: 'btn btn--gold', type: 'button', onclick: () => editer() }, icone('plus'), h('span', null, 'Nouveau client')));
  const corps = h('tbody');
  let recherche = '';
  const dessiner = () => {
    const q = recherche.toLowerCase();
    const vis = clients.filter((c) => !q || `${c.nom} ${c.adresse} ${c.email} ${c.tel}`.toLowerCase().includes(q));
    corps.replaceChildren(...(vis.length ? vis.map((c) => h('tr', { class: 'ligne-clic', tabindex: 0, onclick: () => editer(c), onkeydown: (e) => { if (e.key === 'Enter') editer(c); } },
      h('td', null, h('b', null, c.nom)), h('td', { class: 'muet' }, c.adresse.split('\n').join(', ')), h('td', null, c.tel), h('td', null, c.email))) : [h('tr', null, h('td', { colspan: 4, class: 'vide-ligne' }, clients.length ? 'Aucun client ne correspond.' : 'Aucun client. Ajoutez-les ici, ou depuis un devis/une facture (« Ajouter ce client à mes clients »).'))]));
  };
  async function editer(c = { nom: '', adresse: '', tel: '', email: '', notes: '' }) {
    const f = { nom: saisie({ value: c.nom, required: true }), adresse: zoneTexte({ value: c.adresse, rows: 3 }), tel: saisie({ value: c.tel, type: 'tel' }), email: saisie({ value: c.email, type: 'email' }), notes: zoneTexte({ value: c.notes, rows: 3 }) };
    const choix = await modale({
      titre: c.id ? c.nom : 'Nouveau client',
      contenu: h('div', { class: 'form-grille' }, champ('Nom ou société', f.nom), champ('Adresse', f.adresse), champ('Téléphone', f.tel), champ('Email', f.email), champ('Notes (privées)', f.notes)),
      actions: [
        c.id ? { libelle: 'Supprimer', classe: 'btn--danger-ghost', valeur: 'supprimer' } : null,
        c.id ? { libelle: 'Créer un devis', classe: 'btn--ghost', valeur: 'devis' } : null,
        { libelle: 'Enregistrer', classe: 'btn--gold', submit: true, action: async () => {
          if (!f.nom.value.trim()) { f.nom.focus(); return false; }
          try { await api('client.enregistrer', { id: c.id, nom: f.nom.value, adresse: f.adresse.value, tel: f.tel.value, email: f.email.value, notes: f.notes.value }); return 'ok'; } catch (e) { erreur(e); return false; }
        } },
      ].filter(Boolean),
    });
    try {
      if (choix === 'supprimer') {
        if (!(await confirmer(`Supprimer ${c.nom} de vos clients ? Ses devis et factures sont conservés.`, { ok: 'Supprimer', danger: true }))) return;
        await api('client.supprimer', { id: c.id });
      } else if (choix === 'devis') {
        sessionStorage.setItem('bda-prefill-devis', JSON.stringify({ client: { nom: c.nom, adresse: [c.adresse, c.tel ? `TÉL : ${c.tel}` : '', c.email].filter(Boolean).join('\n') } }));
        return ctx.aller('#/devis/nouveau');
      }
      if (choix) { ({ clients } = await api('clients')); dessiner(); toast(choix === 'supprimer' ? 'Client supprimé.' : 'Client enregistré.'); }
    } catch (e) { erreur(e); }
  }
  const rech = saisie({ type: 'search', class: 'input input--recherche', placeholder: 'Rechercher un client…', oninput: (e) => { recherche = e.target.value; dessiner(); } });
  ctx.afficher(carte(null, h('div', { class: 'carte__outils' }, h('span', { class: 'muet' }, `${clients.length} client${clients.length > 1 ? 's' : ''}`), h('div', { class: 'recherche' }, icone('recherche'), rech)),
    h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' }, h('thead', null, h('tr', null, h('th', null, 'Nom'), h('th', null, 'Adresse'), h('th', null, 'Téléphone'), h('th', null, 'Email'))), corps))));
  dessiner();
}

/* =========================================================
   PARAMÈTRES
   ========================================================= */
async function pageParametres(ctx) {
  ctx.titre('Paramètres');
  const { reglages: r } = await api('reglages');
  const c = {
    nom: saisie({ value: r.nom }), emetteur: zoneTexte({ value: r.emetteur, rows: 6 }), email: saisie({ value: r.email, type: 'email' }),
    beneficiaire: saisie({ value: r.beneficiaire }), iban: saisie({ value: r.iban, placeholder: 'FR76 …', autocomplete: 'off', spellcheck: 'false' }),
    conditionsFacture: zoneTexte({ value: r.conditionsFacture, rows: 4 }), conditionsDevis: zoneTexte({ value: r.conditionsDevis, rows: 4 }), pied: zoneTexte({ value: r.pied, rows: 3 }),
    prefixeFacture: saisie({ value: r.prefixeFacture }), prefixeDevis: saisie({ value: r.prefixeDevis }),
    tauxHoraire: saisie({ value: r.tauxHoraire, inputmode: 'decimal' }), echeanceJours: saisie({ value: r.echeanceJours, inputmode: 'numeric' }),
    acompte: saisie({ value: r.acompte, inputmode: 'numeric' }), validiteDevis: saisie({ value: r.validiteDevis }),
    tauxTva: saisie({ value: String(r.tauxTva ?? 20).replace('.', ','), inputmode: 'decimal' }), numeroTva: saisie({ value: r.numeroTva || '', placeholder: 'FR 00 123456789', autocomplete: 'off', spellcheck: 'false' }),
  };
  const enregistrer = h('button', { class: 'btn btn--gold', type: 'submit' }, icone('coche'), 'Enregistrer les paramètres');
  const form = h('form', { class: 'parametres', onsubmit: async (e) => {
    e.preventDefault();
    const donnees = Object.fromEntries(Object.entries(c).map(([k, el]) => [k, el.value]));
    ['tauxHoraire', 'echeanceJours', 'acompte'].forEach((k) => { donnees[k] = Math.round(parseFloat(String(donnees[k]).replace(',', '.')) || 0); });
    donnees.tauxTva = Math.min(100, Math.max(0, parseFloat(String(donnees.tauxTva).replace(',', '.')) || 0));
    try { await api('reglages.enregistrer', donnees); toast('Paramètres enregistrés. Ils s\'appliquent aux nouveaux documents.'); } catch (err) { erreur(err); }
  } },
  carte([h('h2', null, 'Votre entreprise'), h('small', null, 'Apparaît en haut de vos devis et factures')], h('div', { class: 'form-grille' }, champ('Nom affiché', c.nom), champ('Coordonnées (une info par ligne)', c.emetteur, 'Gardez la mention « EI » après votre nom : elle est obligatoire.'), champ('Email (sur les devis)', c.email))),
  carte([h('h2', null, 'TVA'), h('small', null, 'Appliquée aux nouveaux devis et factures')], h('div', { class: 'form-grille form-grille--2' },
    champ('Taux de TVA par défaut (%)', c.tauxTva, 'Ex. 20 (sécurité) ou 10 (transport VTC). 0 = « TVA non applicable ». Modifiable ensuite sur chaque devis ou facture.'),
    champ('N° de TVA intracommunautaire', c.numeroTva, 'Obligatoire sur les factures avec TVA. Ajouté automatiquement sous vos coordonnées.'))),
  carte([h('h2', null, 'Paiement'), h('small', null, 'Imprimé sur vos factures — reste privé, jamais publié sur le site')], h('div', { class: 'form-grille' }, champ('Bénéficiaire', c.beneficiaire), champ('IBAN', c.iban))),
  h('details', { class: 'avance' }, h('summary', null, icone('reglages'), 'Réglages avancés', h('small', null, 'mentions légales, numérotation, valeurs par défaut')),
  carte([h('h2', null, 'Mentions et conditions')], h('div', { class: 'form-grille' }, champ('Conditions des factures', c.conditionsFacture), champ('Conditions des devis', c.conditionsDevis), champ('Pied de page (CNAPS, SIRET…)', c.pied, 'La mention de l\'autorisation CNAPS est obligatoire sur tous vos documents.'))),
  carte([h('h2', null, 'Numérotation et valeurs par défaut')], h('div', { class: 'form-grille form-grille--2' },
    champ('Numéros de facture', c.prefixeFacture, '{AAAA} = année en cours. Ex. FA-2026-001'), champ('Numéros de devis', c.prefixeDevis),
    champ('Taux horaire agent (€/h)', c.tauxHoraire), champ('Échéance des factures (jours)', c.echeanceJours),
    champ('Acompte des devis (%)', c.acompte), champ('Validité des devis', c.validiteDevis)))),
  h('div', { class: 'barre-enregistrer' }, enregistrer));

  // Mot de passe
  const mdp = { actuel: saisie({ type: 'password', autocomplete: 'current-password' }), nouveau: saisie({ type: 'password', autocomplete: 'new-password', minlength: 10 }), confirme: saisie({ type: 'password', autocomplete: 'new-password' }) };
  const formMdp = h('form', { class: 'form-grille', onsubmit: async (e) => {
    e.preventDefault();
    if (mdp.nouveau.value !== mdp.confirme.value) return toast('Les deux nouveaux mots de passe sont différents.', 'erreur');
    try { await api('motdepasse', { actuel: mdp.actuel.value, nouveau: mdp.nouveau.value }); Object.values(mdp).forEach((i) => { i.value = ''; }); toast('Mot de passe changé.'); } catch (err) { erreur(err); }
  } }, champ('Mot de passe actuel', mdp.actuel), champ('Nouveau mot de passe', mdp.nouveau, '10 caractères minimum'), champ('Confirmez', mdp.confirme), h('div', null, h('button', { class: 'btn btn--ghost', type: 'submit' }, icone('cadenas'), 'Changer le mot de passe')));

  const sauvegarde = h('div', { class: 'sauvegarde' },
    h('p', null, "Téléchargez une copie de vos données (devis, factures, plannings, clients, agents, avis…). Les documents des agents (pièces d'identité, cartes pro…) restent uniquement sur le serveur privé. Conseil : faites-le une fois par mois et gardez le fichier en lieu sûr."),
    h('div', { class: 'sauvegarde__actions' },
      h('button', { class: 'btn btn--gold', type: 'button', onclick: async () => { try { const d = await api('export'); telecharger(`bda-sauvegarde-${iso(new Date())}.json`, JSON.stringify(d, null, 2)); } catch (e) { erreur(e); } } }, icone('telecharger'), 'Télécharger une sauvegarde'),
      boutonImport(() => ctx.aller('#/'))));

  ctx.afficher(form,
    carte([h('h2', null, 'Sécurité'), h('small', null, 'Mot de passe oublié ? Utilisez votre code de secours sur l\'écran de connexion.')], formMdp),
    carte([h('h2', null, 'Sauvegarde et import')], sauvegarde));
}
