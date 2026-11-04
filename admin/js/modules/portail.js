/* =========================================================
   ESPACE ADMIN BDA — Espace client (module « portail »)
   #/portail        les clients qui ont un espace, et le centre documentaire commun :
                    dossier administratif de l'entreprise (Kbis, CNAPS, RC Pro, URSSAF…)
                    et informations publiées pour tous les clients
   #/portail/<id>   un client : ce qu'il voit (rubriques, factures, devis), les pièces à
                    rattacher, ses documents à lui (contrats, courriers, rapports),
                    ses informations, les dossiers d'agents partagés et ses dépôts
   Seuls les documents « professionnels » d'un agent peuvent être partagés
   (carte pro, diplômes, certifications, attestations, CV) ; le reste ne sort jamais.
   Les documents déposés ici sont des copies : l'original reste où il est.
   ========================================================= */
import { api, apiFichier, h, icone, toast, erreur, ilYa, dateLisible, modale, confirmer, champ, saisie, zoneTexte, euro, isoVersFr, fmtHeures } from '../outils.js';

const ETATS = { valide: ['payee', 'En ligne'], bientot: ['attente', 'À renouveler'], expire: ['retard', 'Expirée'], manquant: ['archivee', 'Manquant'] };
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? (plusieurs || `${un}s`) : un}`;
const tableau = (entetes, lignes) => h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
  h('thead', null, h('tr', null, entetes.map((x) => h('th', { class: x === '' ? 'mx-droite' : null }, x)))), h('tbody', null, lignes)));

// Fenêtre de dépôt d'un document (copie) dans le centre documentaire d'un client, ou de tous (client_id = 0)
async function deposer(clientId, types, preset = {}) {
  const rubriques = { conformite: 'Attestations et conformité', contrats: 'Contrats et avenants', factures: 'Factures envoyées avant l’admin (copies)', rapports: 'Rapports et relevés', courriers: 'Courriers' };
  const cat = h('select', { class: 'input' }, Object.entries(rubriques).map(([k, l]) => h('option', { value: k, selected: k === (preset.categorie || (clientId ? 'contrats' : 'conformite')) }, l)));
  const type = h('select', { class: 'input' });
  const majTypes = () => type.replaceChildren(...Object.entries(types[cat.value] || {}).map(([k, l]) => h('option', { value: k, selected: k === preset.type }, l)));
  cat.addEventListener('change', majTypes);
  majTypes();
  const titre = saisie({ placeholder: 'Laissez vide pour reprendre le type de document', maxlength: 160 });
  const desc = zoneTexte({ rows: 2, placeholder: 'Ex. : activité couverte, émetteur, période…', maxlength: 400 });
  const ref = saisie({ placeholder: 'N° de police, d’autorisation, de contrat…', maxlength: 80 });
  const date = saisie({ type: 'date' });
  const expire = saisie({ type: 'date' });
  const fichier = h('input', { type: 'file', class: 'input', accept: 'application/pdf,image/jpeg,image/png,image/webp', required: true });
  // Facture d'avant l'admin : son montant TTC et son statut (laissé « Archive » si le règlement n'est pas vérifié)
  const montant = saisie({ placeholder: 'Ex. : 2 568,50', inputmode: 'decimal' });
  const statut = h('select', { class: 'input' }, h('option', { value: '' }, 'Archive (règlement non vérifié)'), h('option', { value: 'payee' }, 'Réglée'));
  const blocFacture = h('div', { class: 'pt-deux' }, champ('Montant TTC (€)', montant), champ('Statut affiché au client', statut));
  const majBloc = () => { blocFacture.hidden = cat.value !== 'factures'; };
  cat.addEventListener('change', majBloc);
  majBloc();
  const msg = h('p', { class: 'muet pt-aide' }, clientId ? 'Visible seulement par ce client. Il est prévenu par un e-mail court, sans le contenu.' : 'Visible par tous les clients qui ont un espace.');
  return modale({
    titre: clientId ? 'Déposer un document pour ce client' : 'Déposer un document de l’entreprise',
    large: true,
    contenu: h('div', { class: 'pt-formulaire' },
      h('div', { class: 'pt-deux' }, champ('Rubrique', cat), champ('Type de document', type)),
      champ('Fichier (PDF ou image, 15 Mo au plus)', fichier, 'Une copie est enregistrée : l’original sur votre ordinateur n’est pas modifié.'),
      blocFacture,
      champ('Titre affiché', titre), champ('Description', desc),
      h('div', { class: 'pt-trois' }, champ('Référence', ref), champ('Date du document', date), champ('Valable jusqu’au', expire, 'Kbis : 3 mois, URSSAF : 6 mois, calculés tout seuls si vide.')),
      msg),
    actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: 'Déposer', classe: 'btn--gold', submit: true, action: async () => {
      if (!fichier.files[0]) { toast('Choisissez le fichier à déposer.', 'erreur'); return false; }
      const fd = new FormData();
      Object.entries({ client_id: clientId, categorie: cat.value, type: type.value, titre: titre.value.trim(), description: desc.value.trim(), reference: ref.value.trim(), date_doc: date.value, expire: expire.value, montant: montant.value, statut: statut.value })
        .forEach(([k, v]) => fd.append(k, v));
      fd.append('fichier', fichier.files[0]);
      try { await apiFichier('mod.portail.biblio.ajouter', fd); toast('Document mis en ligne dans l’espace client.'); return true; } catch (e) { erreur(e); return false; }
    } }],
  });
}
// Rapport mensuel : les chiffres se remplissent seuls, la direction écrit les faits marquants puis publie (le client est prévenu par e-mail)
async function preparerRapport(clientId, r) {
  const faits = zoneTexte({ rows: 5, maxlength: 4000, placeholder: 'Ex. : RAS, aucun incident.\nLe 12 : refus d’accès à une personne sans rendez-vous.\nLe 20 : renfort pour l’événement du Consulat.' });
  faits.value = r.faits || '';
  const qualite = zoneTexte({ rows: 3, maxlength: 2000, placeholder: 'Facultatif. Ex. : passage du responsable le 15, poste conforme, tenue correcte.' });
  qualite.value = r.qualite || '';
  const envoyer = (action, message) => async () => {
    try {
      await api('mod.portail.rapport.enregistrer', { client_id: clientId, mois: r.mois, faits: faits.value, qualite: qualite.value, action });
      toast(message);
      return true;
    } catch (e) { erreur(e); return false; }
  };
  const publie = r.statut === 'publie';
  const resume = [['Heures', fmtHeures(r.heures || 0)], ['Jours', String(r.jours)], ['Agents', String(r.equipe.length)], [r.suivant.libelle, r.suivant.jours ? `${r.suivant.jours} j prévus` : 'pas encore planifié']];
  return modale({
    titre: `Rapport mensuel · ${r.libelle}`,
    contenu: h('div', { class: 'pt-formulaire' },
      h('div', { class: 'pt-rm-resume' }, resume.map(([k, v]) => h('div', null, h('small', { class: 'muet' }, k), h('b', null, v)))),
      h('p', { class: 'muet pt-aide' }, r.source === 'releve' ? `Heures reprises du relevé de la facture ${r.facture}.` : 'Heures reprises du planning (vacations terminées).'),
      r.termine ? null : h('p', { class: 'pt-alerte' }, 'Le mois n’est pas terminé : les heures du rapport s’arrêtent à aujourd’hui. Publiez plutôt le 1er du mois suivant.'),
      champ('Faits marquants (vide = « Aucun incident à signaler »)', faits),
      champ('Contrôle qualité (facultatif)', qualite),
      h('p', { class: 'muet pt-aide' }, 'Signé : Abed BOUIDIA, chargé de compte, pour la direction. Le client le trouve dans Documents › Rapports mensuels et dans Heures de présence.')),
    actions: [
      { libelle: 'Annuler', classe: 'btn--ghost', valeur: false },
      publie ? { libelle: 'Retirer de son espace', classe: 'btn--ghost', action: envoyer('retirer', 'Rapport retiré de l’espace client.') }
        : { libelle: 'Enregistrer le brouillon', classe: 'btn--ghost', action: envoyer('enregistrer', 'Brouillon enregistré.') },
      { libelle: publie ? 'Mettre à jour' : 'Publier et prévenir le client', classe: 'btn--gold', submit: true,
        action: envoyer(publie ? 'enregistrer' : 'publier', publie ? 'Rapport mis à jour.' : 'Rapport publié : le client est prévenu par e-mail.') },
    ],
  });
}

async function publierAnnonce(clientId, a = {}) {
  const titre = saisie({ value: a.titre || '', maxlength: 140, placeholder: 'Ex. : Nouveau numéro de permanence' });
  const texte = zoneTexte({ rows: 4, maxlength: 1200 });
  texte.value = a.texte || '';
  const niveau = h('select', { class: 'input' }, h('option', { value: 'info', selected: a.niveau !== 'important' }, 'Information'), h('option', { value: 'important', selected: a.niveau === 'important' }, 'Important'));
  const debut = saisie({ type: 'date', value: a.debut || '' });
  const fin = saisie({ type: 'date', value: a.fin || '' });
  return modale({
    titre: a.id ? 'Modifier l’information' : 'Publier une information',
    contenu: h('div', { class: 'pt-formulaire' }, champ('Titre', titre), champ('Texte', texte),
      h('div', { class: 'pt-trois' }, champ('Niveau', niveau), champ('À partir du', debut), champ('Jusqu’au (facultatif)', fin)),
      h('p', { class: 'muet pt-aide' }, clientId ? 'Affichée en haut du tableau de bord de ce client.' : 'Affichée en haut du tableau de bord de tous les clients.')),
    actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: a.id ? 'Enregistrer' : 'Publier', classe: 'btn--gold', submit: true, action: async () => {
      try { await api('mod.portail.annonce.enregistrer', { id: a.id || 0, client_id: clientId, titre: titre.value, texte: texte.value, niveau: niveau.value, debut: debut.value, fin: fin.value }); toast('Information publiée.'); return true; }
      catch (e) { erreur(e); return false; }
    } }],
  });
}
// Liste des documents déposés (entreprise ou client) : voir, remettre en ligne, retirer
function listeBiblio(docs, recharger) {
  if (!docs.length) return h('p', { class: 'muet' }, 'Aucun document déposé pour l’instant.');
  return tableau(['Document', 'Rubrique', 'Date', 'Validité', 'Lu', ''], docs.map((d) => h('tr', { class: d.publie ? null : 'pt-retire' },
    h('td', null, h('b', null, d.titre), h('small', { class: 'muet mx-bloc' }, `${d.genre}${d.reference ? ` · ${d.reference}` : ''}`)),
    h('td', null, { conformite: 'Conformité', contrats: 'Contrats', factures: 'Factures', rapports: 'Rapports', courriers: 'Courriers' }[d.categorie] || d.categorie, typeof d.montant === 'number' ? h('small', { class: 'muet mx-bloc' }, euro.format(d.montant)) : null),
    h('td', null, isoVersFr(d.date) || '—'),
    h('td', null, d.expire ? isoVersFr(d.expire) : '—'),
    h('td', null, d.lectures ? pluriel(d.lectures, 'fois') : h('span', { class: 'muet' }, 'pas encore')),
    h('td', { class: 'mx-droite' }, h('div', { class: 'pt-actions' },
      h('a', { class: 'btn btn--ghost btn--petit', href: d.url, target: '_blank', rel: 'noopener' }, 'Voir'),
      h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => {
        if (d.publie && !(await confirmer(`Retirer « ${d.titre} » de l’espace client ? Le fichier reste conservé, vous pourrez le remettre en ligne.`, { titre: 'Retirer le document', ok: 'Retirer' }))) return;
        try { await api('mod.portail.biblio.modifier', { id: d.id, publie: !d.publie }); toast(d.publie ? 'Document retiré de l’espace client.' : 'Document remis en ligne.'); recharger(); } catch (e) { erreur(e); }
      } }, d.publie ? 'Retirer' : 'Remettre'))))));
}
function listeAnnonces(annonces, clientId, recharger) {
  const auj = new Date().toISOString().slice(0, 10);
  const actives = annonces.filter((a) => !a.fin || a.fin >= auj);
  if (!actives.length) return h('p', { class: 'muet' }, 'Aucune information affichée en ce moment.');
  return h('ul', { class: 'pt-annonces' }, actives.map((a) => h('li', null,
    h('span', null, h('b', null, a.titre), h('small', { class: 'muet' }, `${a.niveau === 'important' ? 'Important · ' : ''}depuis le ${isoVersFr(a.debut)}${a.fin ? ` jusqu’au ${isoVersFr(a.fin)}` : ''}`)),
    h('span', { class: 'pt-actions' },
      h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => { if (await publierAnnonce(clientId, a)) recharger(); } }, 'Modifier'),
      h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => {
        if (!(await confirmer(`Ne plus afficher « ${a.titre} » ?`, { titre: 'Retirer l’information', ok: 'Retirer' }))) return;
        try { await api('mod.portail.annonce.retirer', { id: a.id }); recharger(); } catch (e) { erreur(e); }
      } }, 'Retirer')))));
}

export async function pagePortail(ctx) {
  const id = +ctx.params[0] || 0;
  if (id) return pageClient(ctx, id);
  ctx.titre('Espace client');
  const [{ clients }, b] = await Promise.all([api('mod.portail.clients'), api('mod.portail.biblio', undefined, { client_id: 0 })]);
  if (!ctx.actuel()) return;
  const recharger = () => pagePortail(ctx);
  ctx.actions(h('button', { class: 'btn btn--gold', type: 'button', onclick: async () => { if (await deposer(0, b.types)) recharger(); } }, icone('plus'), h('span', null, 'Déposer un document')));
  const enLigne = b.conformite.filter((k) => k.etat === 'valide' || k.etat === 'bientot').length;
  ctx.afficher(h('div', { class: 'tr pt' },
    h('p', { class: 'muet pt-intro' }, 'Le portail réunit pour chaque client ses factures et devis (automatiquement, hors brouillons), les documents que vous déposez ici, les rapports d’activité calculés sur le planning, les dossiers d’agents partagés et la messagerie (', h('a', { href: '#/messages' }, 'Messages clients'), ').'),
    clients.length ? h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Clients qui ont un espace'), h('small', null, pluriel(clients.length, 'client'))),
      tableau(['Client', 'Espace', 'Agents partagés', 'À voir', ''], clients.map((c) => h('tr', null,
        h('td', null, h('b', null, c.nom), h('small', { class: 'muet mx-bloc' }, c.email)),
        h('td', null, !c.actif ? h('span', { class: 'pastille pastille--archivee' }, 'Désactivé') : c.active ? h('span', { class: 'pastille pastille--payee' }, c.derniere ? `Vu ${ilYa(c.derniere)}` : 'Activé') : h('span', { class: 'pastille pastille--attente' }, 'Invitation envoyée')),
        h('td', null, c.agents ? pluriel(c.agents, 'agent') : h('span', { class: 'muet' }, 'aucun'), c.sites ? null : h('small', { class: 'muet mx-bloc' }, 'aucun site relié')),
        h('td', null, [c.depots ? h('span', { class: 'pastille pastille--attente' }, pluriel(c.depots, 'dépôt')) : null, c.demandes ? h('span', { class: 'pastille pastille--attente' }, pluriel(c.demandes, 'demande')) : null].filter(Boolean)),
        h('td', { class: 'mx-droite' }, h('a', { class: 'btn btn--ghost btn--petit', href: `#/portail/${c.id}` }, 'Ouvrir'))))))
      : h('section', { class: 'carte' }, h('div', { class: 'mx-vide' }, h('b', null, 'Aucun client n’a encore d’espace'), h('p', null, 'Invitez un client depuis sa fiche (Fiches clients › Espace client).'))),
    h('div', { class: 'tr-colonnes' },
      h('div', { class: 'tr-col' },
        h('section', { class: 'carte' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Dossier administratif de l’entreprise'), h('small', null, `${enLigne} / ${b.conformite.length} pièces en ligne`)),
          h('p', { class: 'muet pt-intro' }, 'Ce qu’un donneur d’ordre peut exiger (obligation de vigilance, sécurité privée). Chaque pièce manquante est signalée au client comme « sur demande », avec un bouton pour la demander.'),
          tableau(['Pièce', 'Document', 'Validité', 'État', ''], b.conformite.map((k) => {
            const [ton, lib] = ETATS[k.etat];
            return h('tr', null,
              h('td', null, h('b', null, k.libelle), h('small', { class: 'muet mx-bloc' }, k.rappel)),
              h('td', null, k.doc ? [h('a', { href: k.doc.url, target: '_blank', rel: 'noopener' }, 'Voir le document'), k.doc.reference ? h('small', { class: 'muet mx-bloc' }, k.doc.reference) : null] : h('span', { class: 'muet' }, '—')),
              h('td', null, k.expire ? isoVersFr(k.expire) : k.doc ? 'Sans limite' : '—'),
              h('td', null, h('span', { class: `pastille pastille--${ton}` }, lib)),
              h('td', { class: 'mx-droite' }, h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => { if (await deposer(0, b.types, { categorie: 'conformite', type: k.type })) recharger(); } }, k.doc ? 'Remplacer' : 'Déposer')));
          }))),
        h('section', { class: 'carte' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Documents communs à tous les clients'), h('small', null, pluriel(b.docs.length, 'document'))),
          listeBiblio(b.docs, recharger))),
      h('div', { class: 'tr-col' },
        h('section', { class: 'carte' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Informations pour tous les clients'), h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => { if (await publierAnnonce(0)) recharger(); } }, 'Publier')),
          listeAnnonces(b.annonces, 0, recharger)),
        h('section', { class: 'carte pt-regles' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Ce qui n’est jamais visible')),
          h('p', { class: 'muet' }, 'Les brouillons de devis et de factures, la pièce d’identité, la sécurité sociale, le RIB, le contrat et le salaire des agents, les justificatifs d’absence, les sanctions et les notes internes.'),
          h('p', { class: 'muet' }, 'Chaque client ne voit que ce qui est à son nom, ce que vous lui rattachez, et les documents communs à tous les clients.'))))));
}

async function pageClient(ctx, id) {
  const [p, d, v, b, rm] = await Promise.all([api('mod.portail.partages', undefined, { client_id: id }), api('mod.portail.depots', undefined, { client_id: id }),
    api('mod.portail.vue', undefined, { client_id: id }), api('mod.portail.biblio', undefined, { client_id: id }), api('mod.portail.rapports', undefined, { client_id: id })]);
  if (!ctx.actuel()) return;
  const recharger = () => pageClient(ctx, id);
  ctx.titre(`Espace client · ${p.client.nom}`);
  ctx.actions(h('a', { class: 'btn btn--ghost', href: `#/messages/${id}` }, icone('message'), h('span', null, 'Messages')),
    h('button', { class: 'btn btn--gold', type: 'button', onclick: async () => { if (await deposer(id, b.types)) recharger(); } }, icone('plus'), h('span', null, 'Déposer un document')));
  const visibles = p.agents.filter((a) => a.visible).length;

  const enregistrer = async (a, ligne) => {
    const docs = [...ligne.querySelectorAll('input[data-doc]:checked')].map((x) => +x.dataset.doc);
    const visible = ligne.querySelector('input[data-visible]').checked;
    const role = ligne.querySelector('select[data-role]').value;
    const note = ligne.querySelector('input[data-note]').value.trim();
    try {
      const r = await api('mod.portail.partage.enregistrer', { client_id: id, agent_id: a.id, visible, docs, role, note });
      a.visible = r.visible; a.partages = r.docs; a.role = r.role; a.note = r.note;
      ligne.classList.toggle('is-visible', r.visible);
      ligne.querySelector('.pt-role').hidden = !r.visible;
      ligne.querySelector('.pt-role__note').hidden = r.role !== 'candidat';
      toast(r.visible ? `${a.court} : dossier visible${r.role === 'candidat' ? ' en « En attente d’embauche »' : ''} (${pluriel(r.docs.length, 'document')}).` : `${a.court} : dossier caché pour ce client.`);
    } catch (e) { erreur(e); }
  };
  const ligneAgent = (a) => {
    const ligne = h('div', { class: `pt-agent ${a.visible ? 'is-visible' : ''}` });
    const bascule = h('input', { type: 'checkbox', checked: a.visible, 'data-visible': '1', 'aria-label': `Montrer le dossier de ${a.nom}`, onchange: () => enregistrer(a, ligne) });
    ligne.append(
      h('div', { class: 'pt-agent__tete' },
        h('label', { class: 'pt-bascule' }, bascule, h('span', { 'aria-hidden': 'true' })),
        h('span', { class: 'pt-agent__nom' }, h('b', null, a.nom), h('small', { class: 'muet' }, `${a.poste}${a.validite ? ` · carte pro valide jusqu’au ${dateLisible(a.validite)}` : ' · carte pro non renseignée'}`)),
        a.affecte ? h('span', { class: 'pastille pastille--payee' }, 'Sur son site') : null,
        a.actif ? null : h('span', { class: 'pastille pastille--archivee' }, 'Pas encore embauché')),
      // Où le client le voit : « Équipe sur site » ou « En attente d'embauche » (avec la date d'entretien)
      h('div', { class: 'pt-role', hidden: !a.visible },
        h('label', null, h('span', { class: 'muet' }, 'Affiché dans'),
          h('select', { class: 'input', 'data-role': '1', onchange: () => enregistrer(a, ligne) },
            h('option', { value: 'equipe', selected: a.role !== 'candidat' }, 'Équipe sur site'),
            h('option', { value: 'candidat', selected: a.role === 'candidat' }, 'En attente d’embauche'))),
        h('label', { class: 'pt-role__note', hidden: a.role !== 'candidat' }, h('span', { class: 'muet' }, 'Note pour le client'),
          h('input', { class: 'input', 'data-note': '1', value: a.note || '', maxlength: 200, placeholder: 'Ex. : Entretien le vendredi 6 novembre à 15 h', onchange: () => enregistrer(a, ligne) }))),
      a.docs.length ? h('div', { class: 'pt-docs' }, a.docs.map((x) => h('label', { class: 'case pt-doc' },
        h('input', { type: 'checkbox', checked: a.partages.includes(x.id), 'data-doc': String(x.id), onchange: () => { if (!bascule.checked) bascule.checked = true; enregistrer(a, ligne); } }),
        h('span', null, h('b', null, x.type), h('small', { class: 'muet' }, x.nom)))))
        : h('p', { class: 'muet pt-aucun' }, 'Aucun document partageable dans son dossier (carte pro, diplôme, certification, attestation ou CV).'));
    return ligne;
  };
  const surSite = p.agents.filter((a) => a.affecte || a.visible);
  const autres = p.agents.filter((a) => !a.affecte && !a.visible && a.actif);
  const inactifs = p.agents.filter((a) => !a.affecte && !a.visible && !a.actif);
  const plus = h('details', { class: 'pt-autres' }, h('summary', null, `Autres agents (${autres.length})`), autres.map(ligneAgent));
  const plusInactifs = h('details', { class: 'pt-autres' }, h('summary', null, `Candidats et agents inactifs (${inactifs.length}) : pour « En attente d’embauche »`), inactifs.map(ligneAgent));

  // Ce que voit le client : une ligne par rubrique du portail
  const rubriques = h('div', { class: 'pt-rubriques' }, Object.entries(v.categories).map(([k, lib]) => h('span', { class: v.parCategorie[k] ? null : 'is-vide' }, h('b', null, v.parCategorie[k] || 0), h('small', null, lib))));
  const rattacher = async (doc, lier) => {
    try { await api('mod.portail.rattacher', { document_id: doc.id, client_id: id, lier }); toast(lier ? `${doc.type === 'facture' ? 'Facture' : 'Devis'} ${doc.numero} visible dans son espace.` : 'Rattachement retiré.'); recharger(); }
    catch (e) { erreur(e); }
  };
  const factures = v.documents;
  // Une facture ancienne restée « envoyée » apparaîtrait « en retard » chez le client : on le signale avant qu'il la voie
  const retards = factures.filter((x) => x.categorie === 'factures' && x.statut.ton === 'alerte');
  const ligneDoc = (x) => h('tr', null,
    h('td', null, h('a', { href: `#/${x.categorie === 'factures' ? 'factures' : 'devis'}/${x.id}` }, h('b', null, x.reference)), h('small', { class: 'muet mx-bloc' }, x.genre + (x.rattache ? ' · rattaché(e) à la main' : ''))),
    h('td', null, isoVersFr(x.date) || '—'),
    h('td', { class: 'mx-droite' }, euro.format(x.montant)),
    h('td', null, h('span', { class: `pastille pastille--${x.statut.ton === 'ok' ? 'payee' : x.statut.ton === 'alerte' ? 'retard' : x.statut.ton === 'attente' ? 'attente' : 'archivee'}` }, x.statut.libelle)),
    h('td', null, x.nouveau ? h('span', { class: 'muet' }, 'pas encore ouvert') : 'ouvert'),
    h('td', { class: 'mx-droite' }, x.rattache ? h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => rattacher({ id: x.id, numero: x.reference, type: x.categorie === 'factures' ? 'facture' : 'devis' }, false) }, 'Détacher') : null));

  ctx.afficher(h('div', { class: 'tr pt' },
    h('section', { class: 'carte' },
      h('header', { class: 'carte__tete' }, h('h2', null, 'Ce que voit le client'), h('small', null, 'Rubriques de son centre documentaire')),
      rubriques,
      h('div', { class: 'pt-conformite' }, v.conformite.map((k) => { const [ton, lib] = ETATS[k.etat]; return h('span', { class: `pastille pastille--${ton}`, title: lib }, k.libelle); }))),
    h('div', { class: 'tr-colonnes' },
      h('div', { class: 'tr-col' },
        h('section', { class: 'carte' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Factures et devis dans son espace'), h('small', null, `${pluriel(factures.length, 'document')} · automatique, hors brouillons`)),
          retards.length ? h('p', { class: 'pt-alerte' }, h('b', null, `${pluriel(retards.length, 'facture')} affichée${retards.length > 1 ? 's' : ''} « en retard » chez le client.`), ' Si elle' + (retards.length > 1 ? 's sont' : ' est') + ' déjà réglée' + (retards.length > 1 ? 's' : '') + ', passez-la' + (retards.length > 1 ? 's' : '') + ' au statut « Payée » dans Facturation : le client verra « Réglée ».') : null,
          factures.length ? tableau(['Numéro', 'Date', 'Montant', 'Statut', 'Consulté', ''], factures.map(ligneDoc))
            : h('p', { class: 'muet' }, `Aucun devis ni facture au nom « ${p.client.nom} ». Les documents apparaissent tout seuls quand le nom du client est identique sur la facture.`),
          v.suggestions.length ? h('div', { class: 'pt-suggestions' },
            h('p', null, h('b', null, `${pluriel(v.suggestions.length, 'pièce')} au nom proche`), h('span', { class: 'muet' }, ' : le nom du client sur ces documents est un peu différent. Rattachez-les pour que le client les retrouve (le document lui-même n’est pas modifié).')),
            tableau(['Numéro', 'Au nom de', 'Date', 'Montant', ''], v.suggestions.map((s) => h('tr', null,
              h('td', null, h('b', null, s.numero), h('small', { class: 'muet mx-bloc' }, s.type === 'facture' ? 'Facture' : 'Devis')),
              h('td', null, s.client), h('td', null, isoVersFr(s.date) || '—'), h('td', { class: 'mx-droite' }, euro.format(s.total)),
              h('td', { class: 'mx-droite' }, h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => rattacher(s, true) }, 'Rattacher')))))) : null),
        h('section', { class: 'carte' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Rapports mensuels'), h('small', null, 'À publier au début de chaque mois')),
          h('p', { class: 'muet pt-intro' }, 'Heures, équipe et mois suivant se remplissent seuls. Ajoutez les faits marquants, puis publiez : le client le voit dans son espace et reçoit un e-mail.'),
          rm.rapports.length ? tableau(['Mois', 'Heures', 'État', ''], rm.rapports.map((r) => h('tr', null,
            h('td', null, h('b', null, r.libelle), h('small', { class: 'muet mx-bloc' }, r.source === 'releve' ? `Relevé de la facture ${r.facture}` : r.termine ? 'D’après le planning' : 'Mois en cours')),
            h('td', null, `${fmtHeures(r.heures || 0)} · ${r.jours} j`),
            h('td', null, h('span', { class: `pastille pastille--${r.statut === 'publie' ? 'payee' : r.statut === 'brouillon' ? 'attente' : 'archivee'}` },
              r.statut === 'publie' ? `Publié le ${isoVersFr(String(r.publie).slice(0, 10))}` : r.statut === 'brouillon' ? 'Brouillon' : 'À préparer')),
            h('td', { class: 'mx-droite' }, h('button', { class: `btn ${r.statut === 'publie' ? 'btn--ghost' : 'btn--gold'} btn--petit`, type: 'button', onclick: async () => { if (await preparerRapport(id, r)) recharger(); } },
              r.statut === 'publie' ? 'Modifier' : 'Préparer')))))
            : h('p', { class: 'muet' }, 'Aucune heure enregistrée ces derniers mois.')),
        h('section', { class: 'carte' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Documents déposés pour ce client'), h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => { if (await deposer(id, b.types)) recharger(); } }, 'Déposer')),
          h('p', { class: 'muet pt-intro' }, 'Contrat de prestation, avenants, courriers, rapports : ce que vous déposez ici n’est visible que par ce client.'),
          listeBiblio(b.docs, recharger)),
        h('section', { class: 'carte' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Dossiers des agents'), h('small', null, `${visibles} visible${visibles > 1 ? 's' : ''}`)),
          h('p', { class: 'muet pt-intro' }, p.sites ? 'Les agents qui travaillent sur ses sites sont en premier. Cochez ce que le client peut voir : chaque changement est enregistré tout de suite.' : 'Ce client n’a pas encore de site relié dans le Planning des sites : tous les agents sont listés.'),
          surSite.length ? surSite.map(ligneAgent) : h('p', { class: 'muet' }, 'Aucun agent sur ses sites pour l’instant.'),
          autres.length ? plus : null,
          inactifs.length ? plusInactifs : null)),
      h('div', { class: 'tr-col' },
        h('section', { class: 'carte' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Informations pour ce client'), h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => { if (await publierAnnonce(id)) recharger(); } }, 'Publier')),
          listeAnnonces(v.annonces, id, recharger)),
        h('section', { class: 'carte' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Déposés par le client')),
          d.depots.length ? h('ul', { class: 'pt-depots' }, d.depots.map((x) => h('li', null,
            h('a', { href: `api.php?a=mod.portail.depot&id=${x.id}`, target: '_blank', rel: 'noopener' }, icone('dossier'), h('span', null, h('b', null, x.titre), h('small', { class: 'muet' }, `${dateLisible(x.cree, true)}${x.vu ? '' : ' · nouveau'}`))))))
            : h('p', { class: 'muet' }, 'Rien pour l’instant. Le client peut vous envoyer bons de commande, plans, listes ou photos depuis son espace.')),
        h('section', { class: 'carte pt-regles' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Jamais visible par le client')),
          h('p', { class: 'muet' }, 'Brouillons, pièce d’identité, sécurité sociale, RIB, contrat et salaire des agents, justificatifs d’absence, sanctions, notes internes. Le client voit le prénom et l’initiale du nom des agents, jamais le nom complet ni le numéro de carte pro en entier.'),
          h('p', { class: 'muet' }, 'Pensez à prévenir les agents par écrit que leur carte pro et leurs diplômes peuvent être montrés aux clients de leur site.'))))));
}
