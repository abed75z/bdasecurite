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
import { api, apiFichier, h, icone, toast, erreur, ilYa, dateLisible, modale, confirmer, champ, saisie, zoneTexte, euro, isoVersFr } from '../outils.js';

const ETATS = { valide: ['payee', 'En ligne'], bientot: ['attente', 'À renouveler'], expire: ['retard', 'Expirée'], manquant: ['archivee', 'Manquant'] };
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? (plusieurs || `${un}s`) : un}`;
const tableau = (entetes, lignes) => h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
  h('thead', null, h('tr', null, entetes.map((x) => h('th', { class: x === '' ? 'mx-droite' : null }, x)))), h('tbody', null, lignes)));

// Fenêtre de dépôt d'un document (copie) dans le centre documentaire d'un client, ou de tous (client_id = 0)
async function deposer(clientId, types, preset = {}) {
  const rubriques = { conformite: 'Attestations et conformité', contrats: 'Contrats et avenants', rapports: 'Rapports et relevés', courriers: 'Courriers' };
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
  const msg = h('p', { class: 'muet pt-aide' }, clientId ? 'Visible seulement par ce client. Il est prévenu par un e-mail court, sans le contenu.' : 'Visible par tous les clients qui ont un espace.');
  return modale({
    titre: clientId ? 'Déposer un document pour ce client' : 'Déposer un document de l’entreprise',
    large: true,
    contenu: h('div', { class: 'pt-formulaire' },
      h('div', { class: 'pt-deux' }, champ('Rubrique', cat), champ('Type de document', type)),
      champ('Fichier (PDF ou image, 15 Mo au plus)', fichier, 'Une copie est enregistrée : l’original sur votre ordinateur n’est pas modifié.'),
      champ('Titre affiché', titre), champ('Description', desc),
      h('div', { class: 'pt-trois' }, champ('Référence', ref), champ('Date du document', date), champ('Valable jusqu’au', expire, 'Kbis : 3 mois, URSSAF : 6 mois, calculés tout seuls si vide.')),
      msg),
    actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: 'Déposer', classe: 'btn--gold', submit: true, action: async () => {
      if (!fichier.files[0]) { toast('Choisissez le fichier à déposer.', 'erreur'); return false; }
      const fd = new FormData();
      Object.entries({ client_id: clientId, categorie: cat.value, type: type.value, titre: titre.value.trim(), description: desc.value.trim(), reference: ref.value.trim(), date_doc: date.value, expire: expire.value })
        .forEach(([k, v]) => fd.append(k, v));
      fd.append('fichier', fichier.files[0]);
      try { await apiFichier('mod.portail.biblio.ajouter', fd); toast('Document mis en ligne dans l’espace client.'); return true; } catch (e) { erreur(e); return false; }
    } }],
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
    h('td', null, d.categorie === 'conformite' ? 'Conformité' : d.categorie === 'contrats' ? 'Contrats' : d.categorie === 'rapports' ? 'Rapports' : 'Courriers'),
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
  const [p, d, v, b] = await Promise.all([api('mod.portail.partages', undefined, { client_id: id }), api('mod.portail.depots', undefined, { client_id: id }),
    api('mod.portail.vue', undefined, { client_id: id }), api('mod.portail.biblio', undefined, { client_id: id })]);
  if (!ctx.actuel()) return;
  const recharger = () => pageClient(ctx, id);
  ctx.titre(`Espace client · ${p.client.nom}`);
  ctx.actions(h('a', { class: 'btn btn--ghost', href: `#/messages/${id}` }, icone('message'), h('span', null, 'Messages')),
    h('button', { class: 'btn btn--gold', type: 'button', onclick: async () => { if (await deposer(id, b.types)) recharger(); } }, icone('plus'), h('span', null, 'Déposer un document')));
  const visibles = p.agents.filter((a) => a.visible).length;

  const enregistrer = async (a, ligne) => {
    const docs = [...ligne.querySelectorAll('input[data-doc]:checked')].map((x) => +x.dataset.doc);
    const visible = ligne.querySelector('input[data-visible]').checked;
    try {
      const r = await api('mod.portail.partage.enregistrer', { client_id: id, agent_id: a.id, visible, docs });
      a.visible = r.visible; a.partages = r.docs;
      ligne.classList.toggle('is-visible', r.visible);
      toast(r.visible ? `${a.court} : dossier visible (${pluriel(r.docs.length, 'document')}).` : `${a.court} : dossier caché pour ce client.`);
    } catch (e) { erreur(e); }
  };
  const ligneAgent = (a) => {
    const ligne = h('div', { class: `pt-agent ${a.visible ? 'is-visible' : ''}` });
    const bascule = h('input', { type: 'checkbox', checked: a.visible, 'data-visible': '1', 'aria-label': `Montrer le dossier de ${a.nom}`, onchange: () => enregistrer(a, ligne) });
    ligne.append(
      h('div', { class: 'pt-agent__tete' },
        h('label', { class: 'pt-bascule' }, bascule, h('span', { 'aria-hidden': 'true' })),
        h('span', { class: 'pt-agent__nom' }, h('b', null, a.nom), h('small', { class: 'muet' }, `${a.poste}${a.validite ? ` · carte pro valide jusqu’au ${dateLisible(a.validite)}` : ' · carte pro non renseignée'}`)),
        a.affecte ? h('span', { class: 'pastille pastille--payee' }, 'Sur son site') : null),
      a.docs.length ? h('div', { class: 'pt-docs' }, a.docs.map((x) => h('label', { class: 'case pt-doc' },
        h('input', { type: 'checkbox', checked: a.partages.includes(x.id), 'data-doc': String(x.id), onchange: () => { if (!bascule.checked) bascule.checked = true; enregistrer(a, ligne); } }),
        h('span', null, h('b', null, x.type), h('small', { class: 'muet' }, x.nom)))))
        : h('p', { class: 'muet pt-aucun' }, 'Aucun document partageable dans son dossier (carte pro, diplôme, certification, attestation ou CV).'));
    return ligne;
  };
  const surSite = p.agents.filter((a) => a.affecte || a.visible);
  const autres = p.agents.filter((a) => !a.affecte && !a.visible);
  const plus = h('details', { class: 'pt-autres' }, h('summary', null, `Autres agents (${autres.length})`), autres.map(ligneAgent));

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
          h('header', { class: 'carte__tete' }, h('h2', null, 'Documents déposés pour ce client'), h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => { if (await deposer(id, b.types)) recharger(); } }, 'Déposer')),
          h('p', { class: 'muet pt-intro' }, 'Contrat de prestation, avenants, courriers, rapports : ce que vous déposez ici n’est visible que par ce client.'),
          listeBiblio(b.docs, recharger)),
        h('section', { class: 'carte' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Dossiers des agents'), h('small', null, `${visibles} visible${visibles > 1 ? 's' : ''}`)),
          h('p', { class: 'muet pt-intro' }, p.sites ? 'Les agents qui travaillent sur ses sites sont en premier. Cochez ce que le client peut voir : chaque changement est enregistré tout de suite.' : 'Ce client n’a pas encore de site relié dans le Planning des sites : tous les agents sont listés.'),
          surSite.length ? surSite.map(ligneAgent) : h('p', { class: 'muet' }, 'Aucun agent sur ses sites pour l’instant.'),
          autres.length ? plus : null)),
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
