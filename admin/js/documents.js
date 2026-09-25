/* =========================================================
   ESPACE ADMIN BDA — devis et factures
   Liste, éditeur (feuille A4 modifiable au clic), impression PDF,
   transformation devis -> facture, report des heures du planning.
   ========================================================= */
import {
  api, h, $, $$, icone, toast, erreur, modale, confirmer, champ, saisie, zoneTexte, statutPastille, attendre,
  euro, nombre, arrondi, fmtHeures, lireHeures, lireNombre, fr, frVersDate, isoVersFr, cap, MOIS, pad, iso,
} from './outils.js';
import { totauxDuMois } from './planning.js';
import { telechargerPdf } from './pdf.js';

const CONFIG = {
  devis: { route: 'devis', titre: 'Devis', nouveau: 'Nouveau devis', un: 'le devis', statuts: ['brouillon', 'envoye', 'accepte', 'refuse'] },
  facture: { route: 'factures', titre: 'Factures', nouveau: 'Nouvelle facture', un: 'la facture', statuts: ['brouillon', 'envoyee', 'payee', 'annulee'] },
};
const LIBELLE_STATUT = { brouillon: 'Brouillon', envoye: 'Envoyé', envoyee: 'Envoyée', accepte: 'Accepté', refuse: 'Refusé', payee: 'Payée', annulee: 'Annulée' };
export const ROLES = { base: 'Prestations Agent A.D.S', nuit: 'Majoration des heures de nuit', dimanche: 'Majoration des heures du dimanche', ferie: 'Majoration des heures fériées' };

export const totalLignes = (lignes) => arrondi((lignes || []).reduce((s, l) => s + arrondi((+l.qte || 0) * (+l.pu || 0)), 0));
// Totaux d'un devis ou d'une facture : taux « tva » du document en % (absent ou 0 = TVA non applicable)
export function totauxDocument(data) {
  const ht = totalLignes(data.lignes);
  const taux = Math.min(100, Math.max(0, +data.tva || 0));
  const tva = arrondi((ht * taux) / 100);
  return { ht, taux, tva, ttc: arrondi(ht + tva) };
}
// Mention légale « TVA non applicable » : retirée quand une TVA est appliquée, remise sinon
const MENTION_293B = 'TVA non applicable, art. 293 B du CGI.';
export function ajusterMentionTva(conditions, taux) {
  const texte = String(conditions || '');
  const mention = /TVA non applicable,? art\.? ?293 ?B du CGI\.?/i;
  if (!(taux > 0)) return mention.test(texte) ? texte : `${texte.trim()}${texte.trim() ? '\n' : ''}${MENTION_293B}`;
  return texte
    .replace(/^[ \t]*TVA non applicable,? art\.? ?293 ?B du CGI\.?[ \t]*(\r?\n|$)/gim, '') // ligne à part entière
    .replace(/[ \t]*TVA non applicable,? art\.? ?293 ?B du CGI\.?/gi, '') // au milieu d'une phrase
    .trim();
}
// N° de TVA intracommunautaire ajouté aux coordonnées de l'émetteur quand une TVA est appliquée
function ajouterNumeroTva(emetteur, r, taux) {
  if (!(taux > 0) || !r.numeroTva || /TVA/i.test(emetteur || '')) return emetteur;
  return `${emetteur}\nN° TVA : ${r.numeroTva}`;
}
const enRetard = (d) => d.statut === 'envoyee' && d.echeance && d.echeance < iso(new Date());

/* =========================================================
   LISTE
   ========================================================= */
export async function listeDocuments(ctx, type) {
  const C = CONFIG[type];
  ctx.titre(C.titre);
  ctx.actions(h('a', { class: 'btn btn--gold', href: `#/${C.route}/nouveau` }, icone('plus'), h('span', null, C.nouveau)));
  const { documents } = await api('documents', undefined, { type });

  let filtre = 'tous', recherche = '';
  const corps = h('tbody');
  const chips = h('div', { class: 'chips' });

  function dessiner() {
    const q = recherche.toLowerCase();
    const visibles = documents.filter((d) => (filtre === 'tous' || (filtre === 'retard' ? enRetard(d) : d.statut === filtre))
      && (!q || `${d.numero} ${d.client}`.toLowerCase().includes(q)));
    corps.replaceChildren(...visibles.map((d) => h('tr', { class: 'ligne-clic', tabindex: 0, onclick: () => ctx.aller(`#/${C.route}/${d.id}`), onkeydown: (e) => { if (e.key === 'Enter') ctx.aller(`#/${C.route}/${d.id}`); } },
      h('td', null, h('b', { class: 'mono' }, d.numero)),
      h('td', null, d.client || h('span', { class: 'muet' }, 'Sans client')),
      h('td', null, isoVersFr(d.date) || '—'),
      type === 'facture' ? h('td', { class: enRetard(d) ? 'txt-alerte' : '' }, isoVersFr(d.echeance) || '—') : null,
      h('td', { class: 'num' }, euro.format(d.total)),
      h('td', null, statutPastille(enRetard(d) ? 'retard' : d.statut)))));
    if (!visibles.length) corps.replaceChildren(h('tr', null, h('td', { colspan: 6, class: 'vide-ligne' }, documents.length ? 'Aucun document pour ce filtre.' : `Aucun ${type === 'devis' ? 'devis' : 'facture'} pour le moment. Cliquez sur « ${C.nouveau} ».`)));
  }
  const comptes = { tous: documents.length };
  C.statuts.forEach((s) => { comptes[s] = documents.filter((d) => d.statut === s).length; });
  if (type === 'facture') comptes.retard = documents.filter(enRetard).length;
  const filtres = ['tous', ...C.statuts, ...(type === 'facture' ? ['retard'] : [])];
  chips.replaceChildren(...filtres.map((f) => h('button', { type: 'button', class: `chip ${f === filtre ? 'is-actif' : ''}`, onclick: (e) => { filtre = f; $$('.chip', chips).forEach((c) => c.classList.remove('is-actif')); e.currentTarget.classList.add('is-actif'); dessiner(); } },
    f === 'tous' ? 'Tous' : f === 'retard' ? 'En retard' : LIBELLE_STATUT[f], h('span', null, comptes[f] || 0))));

  const rech = saisie({ type: 'search', placeholder: 'Numéro ou client…', class: 'input input--recherche', oninput: (e) => { recherche = e.target.value; dessiner(); } });
  ctx.afficher(h('section', { class: 'carte' },
    h('div', { class: 'carte__outils' }, chips, h('div', { class: 'recherche' }, icone('recherche'), rech)),
    h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
      h('thead', null, h('tr', null, h('th', null, 'N°'), h('th', null, 'Client'), h('th', null, 'Date'), type === 'facture' ? h('th', null, 'Échéance') : null, h('th', { class: 'num' }, 'Montant'), h('th', null, 'Statut'))),
      corps))));
  dessiner();
}

/* =========================================================
   NOUVEAU DOCUMENT
   ========================================================= */
function paiementTexte(r) {
  return `Bénéficiaire : ${r.beneficiaire || ''}\nIBAN : ${r.iban || '(à compléter dans Paramètres)'}`;
}
// taux : TVA du document en % (par défaut celle des Paramètres)
export function nouveauDocument(type, r, numero, taux = +r.tauxTva || 0) {
  const auj = new Date();
  const avecTva = (conditions) => (taux > 0 ? ajusterMentionTva(conditions, taux) : conditions);
  const commun = { numero, date: fr(auj), emetteurNom: r.nom, emetteur: ajouterNumeroTva(r.emetteur, r, taux), client: { nom: '', adresse: '' }, pied: r.pied, tva: taux };
  if (type === 'facture') {
    const ech = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() + (+r.echeanceJours || 0));
    return {
      ...commun, echeance: fr(ech), periode: `${cap(MOIS[auj.getMonth()])} ${auj.getFullYear()}`,
      lignes: Object.entries(ROLES).map(([role, designation]) => ({ designation, qte: 0, unite: 'h', pu: role === 'base' ? +r.tauxHoraire || 0 : 0, role })),
      paiement: paiementTexte(r), conditions: avecTva(r.conditionsFacture),
    };
  }
  return {
    ...commun, validite: r.validiteDevis, emetteur: commun.emetteur.replace(/(TÉL : [^\n]+)/, `$1 · ${r.email}`),
    objet: "Mission de sécurisation — surveillance et contrôle d'accès",
    description: "Suite à votre demande, nous avons le plaisir de vous proposer un dispositif de sécurité adapté à votre site. Nos agents, titulaires de la carte professionnelle délivrée par le CNAPS, interviennent en tenue, sous la supervision d'un responsable joignable à tout moment.",
    lieu: '', periode: '', horaires: '', effectif: '',
    lignes: [{ designation: 'Agents de sécurité (ADS)', detail: '', qte: 0, unite: 'h', pu: +r.tauxHoraire || 0 }],
    acompte: +r.acompte || 0,
    conditions: avecTva(`${r.conditionsDevis}\nRèglement par virement — Bénéficiaire : ${r.beneficiaire} — IBAN : ${r.iban || '(à compléter)'}.`),
  };
}

/* =========================================================
   ÉDITEUR
   ========================================================= */
export async function editeurDocument(ctx, type, param) {
  const C = CONFIG[type];
  const [{ reglages: r }, { clients }] = await Promise.all([api('reglages'), api('clients')]);
  let id = /^\d+$/.test(param) ? +param : 0;
  let statut = 'brouillon';
  let data, prerempli = false;
  if (id) {
    const { document: d } = await api('document', undefined, { id });
    data = d.data || {};
    statut = d.statut;
  } else {
    const { numero } = await api('numero', undefined, { type });
    data = nouveauDocument(type, r, numero);
    const pre = sessionStorage.getItem(`bda-prefill-${type}`);
    if (pre) { try { Object.assign(data, JSON.parse(pre)); prerempli = true; } catch (e) { /* ignoré */ } sessionStorage.removeItem(`bda-prefill-${type}`); }
  }
  data.lignes = Array.isArray(data.lignes) ? data.lignes : [];
  data.client = data.client || { nom: '', adresse: '' };

  /* ----- Enregistrement automatique ----- */
  const indicateur = h('span', { class: 'etat-save' });
  const marquer = (txt, cls) => { indicateur.textContent = txt; indicateur.className = `etat-save ${cls || ''}`; };
  let enCours = null, encore = false;
  async function enregistrer() {
    if (enCours) { encore = true; return enCours; }
    marquer('Enregistrement…', 'is-encours');
    enCours = (async () => {
      try {
        const res = await api('document.enregistrer', { id, type, statut, data });
        const nouveau = !id;
        id = res.id;
        data.numero = res.numero;
        if (nouveau) history.replaceState(null, '', `#/${C.route}/${id}`);
        marquer('✓ Enregistré', 'is-ok');
        ctx.compteurs();
      } catch (e) { marquer('Non enregistré', 'is-erreur'); erreur(e); }
    })();
    await enCours;
    enCours = null;
    if (encore) { encore = false; return enregistrer(); }
  }
  const plusTard = attendre(enregistrer, 900);
  const change = () => { marquer('Modifications…'); plusTard(); majTotaux(); };

  /* ----- Feuille ----- */
  const feuille = construireFeuille(type, data, change, r);
  const { majTotaux } = feuille;

  /* ----- Panneau latéral ----- */
  const choixStatut = h('div', { class: 'statuts' }, C.statuts.map((s) => h('button', {
    type: 'button', class: `statut-btn statut-btn--${s} ${s === statut ? 'is-actif' : ''}`,
    onclick: async (e) => { statut = s; $$('.statut-btn', choixStatut).forEach((b) => b.classList.toggle('is-actif', b === e.currentTarget)); await enregistrer(); },
  }, LIBELLE_STATUT[s])));

  const selClient = h('select', { class: 'input', onchange: () => {
    const c = clients.find((x) => String(x.id) === selClient.value);
    if (!c) return;
    data.client = { nom: c.nom, adresse: [c.adresse, c.tel ? `TÉL : ${c.tel}` : '', c.email].filter(Boolean).join('\n') };
    feuille.rafraichir();
    change();
    selClient.value = '';
  } }, h('option', { value: '' }, clients.length ? 'Choisir dans mes clients…' : 'Aucun client enregistré'), clients.map((c) => h('option', { value: c.id }, c.nom)));

  const nomFichier = () => `${type === 'facture' ? 'Facture' : 'Devis'} ${data.numero} - ${data.client.nom || 'client'}`;
  const imprimer = () => { plusTard.annuler(); enregistrer().then(() => imprimerFeuille(nomFichier())); };
  const pdf = async () => { plusTard.annuler(); await enregistrer(); await telechargerPdf(feuille.el, nomFichier()); };
  const actions = [
    h('button', { class: 'btn btn--gold btn--bloc', type: 'button', onclick: pdf }, icone('telecharger'), 'Télécharger en PDF'),
    h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: imprimer }, icone('imprimer'), 'Imprimer'),
    type === 'devis' ? h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: () => versFacture() }, icone('facture'), 'Transformer en facture') : null,
    type === 'facture' ? h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: () => importerPlanning() }, icone('planning'), 'Importer les heures du planning') : null,
    h('button', { class: 'btn btn--ghost btn--bloc', type: 'button', onclick: () => dupliquer() }, icone('copier'), 'Dupliquer'),
    h('button', { class: 'btn btn--danger-ghost btn--bloc', type: 'button', onclick: () => supprimer() }, icone('poubelle'), 'Supprimer'),
  ];

  const panneau = h('aside', { class: 'panneau' },
    h('section', { class: 'panneau__bloc' }, h('h3', null, 'Statut'), choixStatut),
    h('section', { class: 'panneau__bloc' }, h('h3', null, 'Client'), selClient,
      h('button', { type: 'button', class: 'lien-btn', onclick: () => enregistrerClient() }, icone('plus'), 'Ajouter ce client à mes clients')),
    h('section', { class: 'panneau__bloc' }, h('h3', null, 'Actions'), actions),
    h('p', { class: 'panneau__astuce' }, 'Cliquez sur n\'importe quel texte de la feuille pour le modifier. Tout est enregistré automatiquement.'));

  ctx.titre(`${type === 'devis' ? 'Devis' : 'Facture'} ${data.numero}`);
  ctx.actions(h('a', { class: 'btn btn--ghost', href: `#/${C.route}` }, icone('retour'), h('span', null, C.titre)), indicateur,
    h('button', { class: 'btn btn--gold', type: 'button', onclick: pdf }, icone('telecharger'), h('span', null, 'Télécharger PDF')));
  const zone = h('div', { class: 'feuille-zone' }, feuille.el);
  ctx.afficher(h('div', { class: 'editeur' }, zone, panneau));
  ajusterZoom(zone, feuille.el);
  if (!id) { if (prerempli) enregistrer(); else marquer('Nouveau'); }
  else marquer('✓ À jour', 'is-ok');

  /* ----- Actions ----- */
  async function enregistrerClient() {
    if (!data.client.nom.trim()) return toast('Indiquez d\'abord le nom du client sur la feuille.', 'erreur');
    try {
      await api('client.enregistrer', { nom: data.client.nom, adresse: data.client.adresse });
      toast(`${data.client.nom} ajouté à vos clients.`);
    } catch (e) { erreur(e); }
  }
  async function dupliquer() {
    await enregistrer();
    const copie = JSON.parse(JSON.stringify(data));
    const { numero } = await api('numero', undefined, { type });
    copie.numero = numero;
    copie.date = fr(new Date());
    const res = await api('document.enregistrer', { type, statut: 'brouillon', data: copie });
    toast(`Copie créée : ${res.numero}`);
    ctx.aller(`#/${C.route}/${res.id}`);
  }
  async function supprimer() {
    if (type === 'facture' && statut !== 'brouillon') {
      return modale({ titre: 'Suppression impossible', contenu: h('p', { class: 'modale__texte' }, 'Une facture envoyée ne peut pas être supprimée : la loi impose une numérotation continue. Passez-la plutôt au statut « Annulée ».'), actions: [{ libelle: 'Compris', classe: 'btn--gold', valeur: true, submit: true }] });
    }
    if (!(await confirmer(`Supprimer définitivement ${C.un} ${data.numero} ?`, { ok: 'Supprimer', danger: true }))) return;
    try {
      plusTard.annuler();
      await api('document.supprimer', { id });
      toast('Document supprimé.');
      ctx.aller(`#/${C.route}`);
    } catch (e) { erreur(e); }
  }
  async function versFacture() {
    await enregistrer();
    const { numero } = await api('numero', undefined, { type: 'facture' });
    const f = nouveauDocument('facture', r, numero, +data.tva || 0);
    f.client = { ...data.client };
    f.periode = data.periode || f.periode;
    f.lignes = data.lignes.map((l) => ({ designation: l.detail ? `${l.designation} — ${l.detail}` : l.designation, qte: l.qte, unite: l.unite, pu: l.pu }));
    const res = await api('document.enregistrer', { type: 'facture', statut: 'brouillon', data: f });
    if (statut !== 'accepte') { statut = 'accepte'; await enregistrer(); }
    toast(`Facture ${res.numero} créée à partir du devis.`);
    ctx.aller(`#/factures/${res.id}`);
  }
  async function importerPlanning() {
    const auj = new Date();
    const mois = Array.from({ length: 12 }, (_, i) => { const d = new Date(auj.getFullYear(), auj.getMonth() - i, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; });
    const sel = h('select', { class: 'input' }, mois.map((m) => h('option', { value: m }, `${cap(MOIS[+m.slice(5) - 1])} ${m.slice(0, 4)}`)));
    const choix = await modale({
      titre: 'Importer les heures du planning',
      contenu: [h('p', { class: 'modale__texte' }, 'Les heures du mois choisi (total, nuit, dimanche, jours fériés) remplacent les quantités des lignes correspondantes. Les prix ne changent pas.'), champ('Mois', sel)],
      actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: null }, { libelle: 'Importer', classe: 'btn--gold', submit: true, action: () => sel.value }],
    });
    if (!choix) return;
    const { planning } = await api('planning', undefined, { mois: choix });
    const T = planning ? totauxDuMois(planning, choix) : null;
    if (!T || !T.total) return toast('Aucune heure saisie dans le planning de ce mois.', 'erreur');
    const heures = { base: T.total, nuit: T.nuit, dimanche: T.dim, ferie: T.fer };
    Object.entries(heures).forEach(([role, min]) => {
      let l = data.lignes.find((x) => x.role === role);
      if (!l) { l = { designation: ROLES[role], qte: 0, unite: 'h', pu: role === 'base' ? +r.tauxHoraire || 0 : 0, role }; if (role === 'base') data.lignes.unshift(l); else data.lignes.push(l); }
      l.qte = min / 60;
      l.unite = 'h';
    });
    data.periode = `${cap(MOIS[+choix.slice(5) - 1])} ${choix.slice(0, 4)}`;
    if (!data.client.nom && planning.client) data.client.nom = planning.client;
    feuille.rafraichir();
    change();
    toast(`Heures importées : ${fmtHeures(T.total / 60)} au total.`);
  }
}

/* ---------- Zoom automatique sur petit écran ---------- */
function ajusterZoom(zone, el) {
  const maj = () => {
    const dispo = zone.clientWidth - 8;
    const largeur = (el.offsetWidth || 794) + 76; // + la place des petits boutons de ligne (h / ×)
    const zoom = dispo < largeur ? Math.max(0.4, dispo / largeur) : 0;
    el.style.zoom = zoom ? String(zoom) : '';
    el.style.marginLeft = zoom ? '0' : '';
  };
  maj();
  const ro = new ResizeObserver(maj);
  ro.observe(zone);
}

/* ---------- Impression ---------- */
export function imprimerFeuille(titre, paysage) {
  const style = document.getElementById('format-page');
  style.textContent = `@page { size: A4 ${paysage ? 'landscape' : 'portrait'}; margin: 0; }`;
  const avant = document.title;
  document.title = titre.replace(/[\\/:*?"<>|]/g, '-');
  $$('.feuille').forEach((f) => { f.dataset.zoom = f.style.zoom; f.style.zoom = ''; });
  setTimeout(() => {
    window.print();
    document.title = avant;
    $$('.feuille').forEach((f) => { f.style.zoom = f.dataset.zoom || ''; });
  }, 50);
}

/* =========================================================
   FEUILLE A4 (devis / facture)
   ========================================================= */
function lire(obj, chemin) { return chemin.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
function ecrire(obj, chemin, v) { const ks = chemin.split('.'); const fin = ks.pop(); ks.reduce((o, k) => (o[k] ??= {}), obj)[fin] = v; }
const texteDe = (el) => el.innerText.replace(/ /g, ' ').replace(/\n+$/, '');

function construireFeuille(type, data, change, r = {}) {
  const champs = [];
  const T = (chemin, cls, ph, uneLigne) => {
    const el = h('div', { class: cls, contenteditable: 'plaintext-only', spellcheck: 'false', 'data-ph': ph || '' });
    el.textContent = lire(data, chemin) ?? '';
    el.addEventListener('input', () => { ecrire(data, chemin, texteDe(el)); change(); });
    if (uneLigne) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    champs.push({ el, chemin });
    return el;
  };
  const logo = h('img', { class: type === 'facture' ? 'f-logo' : 'f-logo f-logo--petit', src: 'logo-document.jpg', alt: 'BDA Sécurité & VTC Premium' });
  const corps = h('tbody');
  const totaux = h('div', { class: 'f-totaux' });

  const emetteur = h('div', { class: 'f-partie' },
    type === 'devis' ? h('span', { class: 'f-label' }, 'Émetteur') : null,
    T('emetteurNom', 'f-nom', 'Votre entreprise', true), T('emetteur', 'f-lignes', 'Adresse, SIRET, téléphone'));
  const client = h('div', { class: 'f-partie f-partie--client' },
    h('span', { class: 'f-label' }, type === 'facture' ? 'Facturé à' : 'À l\'attention de'),
    T('client.nom', 'f-nom', 'NOM DU CLIENT', true), T('client.adresse', 'f-lignes', 'Adresse, code postal, ville, téléphone'));

  let el;
  if (type === 'facture') {
    el = h('div', { class: 'feuille' }, logo, h('div', { class: 'f-regle' }), h('div', { class: 'f-parties' }, emetteur, client),
      h('div', { class: 'f-titre' }, h('h2', null, 'Facture'), h('div', { class: 'f-num' }, h('span', { class: 'f-label' }, 'Facture n°'), T('numero', 'f-num__val', 'Numéro', true))),
      h('div', { class: 'f-meta' },
        h('div', null, h('span', { class: 'f-label' }, 'Date de facture'), T('date', 'f-meta__val', 'JJ/MM/AAAA', true)),
        h('div', null, h('span', { class: 'f-label' }, 'Échéance du paiement'), T('echeance', 'f-meta__val', 'JJ/MM/AAAA', true)),
        h('div', null, h('span', { class: 'f-label' }, 'Période de la prestation'), T('periode', 'f-meta__val', 'Mois concerné', true))),
      tableau(),
      h('button', { class: 'f-ajout', type: 'button', onclick: ajouterLigne }, '+ Ajouter une ligne'),
      totaux,
      h('div', { class: 'f-paiement' }, h('h3', null, 'Règlement par virement bancaire'), T('paiement', 'f-paiement__main'), T('conditions', 'f-petit')),
      h('div', { class: 'f-espace' }),
      T('pied', 'f-pied'));
  } else {
    const acompte = h('input', { class: 'f-pct', inputmode: 'decimal', value: nombre.format(data.acompte || 0), 'aria-label': 'Pourcentage d\'acompte', oninput: (e) => { const n = lireNombre(e.target.value); if (Number.isFinite(n) && n >= 0 && n <= 100) { data.acompte = n; change(); } } });
    el = h('div', { class: 'feuille' },
      h('div', { class: 'f-entete' }, logo, h('div', { class: 'f-titre f-titre--droite' }, h('h2', null, 'Devis'),
        h('div', { class: 'f-num' }, h('span', { class: 'f-label' }, 'Devis n°'), T('numero', 'f-num__val', 'Numéro', true)),
        h('div', { class: 'f-dates' }, h('span', null, 'Date : ', T('date', 'f-inline', 'JJ/MM/AAAA', true)), h('span', null, 'Validité : ', T('validite', 'f-inline', '30 jours', true))))),
      h('div', { class: 'f-regle' }),
      h('div', { class: 'f-parties' }, emetteur, client),
      h('div', { class: 'f-objet' }, h('span', { class: 'f-label' }, 'Objet'), T('objet', 'f-objet__titre', 'Objet de la mission'), T('description', 'f-objet__texte', 'Description de la prestation')),
      h('div', { class: 'f-mission' },
        h('div', null, h('span', { class: 'f-label' }, 'Lieu'), T('lieu', 'f-mission__val', 'Adresse du site')),
        h('div', null, h('span', { class: 'f-label' }, 'Période'), T('periode', 'f-mission__val', 'Dates')),
        h('div', null, h('span', { class: 'f-label' }, 'Horaires'), T('horaires', 'f-mission__val', 'Horaires')),
        h('div', null, h('span', { class: 'f-label' }, 'Effectif'), T('effectif', 'f-mission__val', 'Nombre d\'agents'))),
      tableau(),
      h('button', { class: 'f-ajout', type: 'button', onclick: ajouterLigne }, '+ Ajouter une ligne'),
      h('div', { class: 'f-bas' }, h('div', { class: 'f-conditions' }, h('span', { class: 'f-label' }, 'Conditions'), T('conditions', 'f-petit')), totaux),
      h('div', { class: 'f-signatures' },
        h('div', { class: 'f-signe' }, h('span', { class: 'f-label' }, `Pour ${data.emetteurNom || 'BDA SECURITE'}`), h('p', null, 'Abdelouahab BOUIDIA')),
        h('div', { class: 'f-signe' }, h('span', { class: 'f-label' }, 'Bon pour accord — le client'), h('p', null, 'Date, signature et cachet, précédés de la mention « Bon pour accord »'))),
      h('div', { class: 'f-espace' }),
      T('pied', 'f-pied'));
    el.acompte = acompte;
  }

  function tableau() {
    return h('table', { class: 'f-table' },
      h('colgroup', null, h('col'), h('col', { class: 'c-q' }), h('col', { class: 'c-pu' }), h('col', { class: 'c-t' })),
      h('thead', null, h('tr', null, h('th', null, type === 'facture' ? 'Description' : 'Désignation'), h('th', { class: 'r' }, 'Quantité'), h('th', { class: 'r' }, 'Prix unitaire'), h('th', { class: 'r' }, type === 'facture' ? 'Prix total' : 'Total'))),
      corps);
  }
  function champNombre(valeur, surSaisie, affichage) {
    const inp = h('input', { class: 'f-in', inputmode: 'decimal', value: valeur });
    inp.addEventListener('focus', () => inp.select());
    inp.addEventListener('input', () => { const ok = surSaisie(inp.value); inp.classList.toggle('is-bad', !ok); if (ok) change(); });
    inp.addEventListener('blur', () => { if (!inp.classList.contains('is-bad')) inp.value = affichage(); });
    return inp;
  }
  const fmtQte = (l) => (l.unite === 'h' ? fmtHeures(+l.qte || 0) : nombre.format(+l.qte || 0));
  function lignes() {
    corps.replaceChildren(...data.lignes.map((l, i) => {
      const desc = h('div', { class: 'f-desc', contenteditable: 'plaintext-only', spellcheck: 'false', 'data-ph': 'Description' });
      desc.textContent = l.designation || '';
      desc.addEventListener('input', () => { l.designation = texteDe(desc); change(); });
      const detail = type === 'devis' ? h('div', { class: 'f-detail', contenteditable: 'plaintext-only', spellcheck: 'false', 'data-ph': 'Détail (ex. 2 agents × 7 h × 5 jours)' }) : null;
      if (detail) { detail.textContent = l.detail || ''; detail.addEventListener('input', () => { l.detail = texteDe(detail); change(); }); }
      const q = champNombre(fmtQte(l), (v) => { const n = l.unite === 'h' ? lireHeures(v) : lireNombre(v); if (!Number.isFinite(n)) return false; l.qte = n; return true; }, () => fmtQte(l));
      const pu = champNombre(euro.format(+l.pu || 0), (v) => { const n = lireNombre(v); if (!Number.isFinite(n)) return false; l.pu = n; return true; }, () => euro.format(+l.pu || 0));
      const outils = h('div', { class: 'f-outils' },
        h('button', { type: 'button', title: l.unite === 'h' ? 'Quantité en heures (cliquer : unités)' : 'Quantité en unités (cliquer : heures)', onclick: () => { l.unite = l.unite === 'h' ? 'u' : 'h'; lignes(); change(); } }, l.unite === 'h' ? 'h' : 'u'),
        h('button', { type: 'button', class: 'del', title: 'Supprimer la ligne', onclick: () => { data.lignes.splice(i, 1); lignes(); change(); } }, '×'));
      return h('tr', null, h('td', null, desc, detail), h('td', { class: 'r' }, q), h('td', { class: 'r' }, pu), h('td', { class: 'r f-total' }, h('span', { class: 'f-total__val', dataset: { i } }), outils));
    }));
    majTotaux();
  }
  function ajouterLigne() {
    data.lignes.push({ designation: '', detail: '', qte: 0, unite: 'h', pu: 0 });
    lignes();
    change();
    $$('.f-desc', corps).pop()?.focus();
  }
  // Totaux construits une seule fois, puis mis à jour (les champs % gardent le focus pendant la saisie)
  const v = {};
  const ligneTotal = (k, label, cls = '') => h('div', { class: cls }, (v[`${k}Lib`] = h('span', null, label)), (v[k] = h('b')));
  // Taux de TVA modifiable sur la feuille (0 = TVA non applicable)
  const champTva = h('input', { class: 'f-pct', inputmode: 'decimal', value: nombre.format(+data.tva || 0), 'aria-label': 'Taux de TVA en %', oninput: (e) => {
    const n = lireNombre(e.target.value);
    if (!Number.isFinite(n) || n < 0 || n > 100) return;
    data.tva = n;
    data.conditions = ajusterMentionTva(data.conditions, n);
    data.emetteur = ajouterNumeroTva(data.emetteur, r, n);
    champs.forEach(({ el: c, chemin }) => { if (['conditions', 'emetteur'].includes(chemin)) c.textContent = lire(data, chemin) ?? ''; });
    change();
  } });
  champTva.addEventListener('focus', () => champTva.select());
  v.tauxPrint = h('span', { class: 'f-print' });
  const ligneTva = h('div', { class: 'f-ligne-tva' }, h('span', null, 'TVA', h('span', { class: 'f-taux' }, ' (', champTva, v.tauxPrint, ' %)')), (v.tva = h('b')));
  if (type === 'facture') {
    totaux.replaceChildren(ligneTotal('ht', 'Total HT'), ligneTva, ligneTotal('net', 'Net à payer', 'grand'));
  } else {
    v.pct = h('span', { class: 'f-print' });
    totaux.replaceChildren(ligneTotal('ht', 'Total HT'), ligneTva, ligneTotal('net', 'Total à payer', 'grand'),
      h('div', { class: 'sub' }, h('span', null, 'Acompte à la commande (', el.acompte, v.pct, ' %)'), (v.ac = h('b'))),
      ligneTotal('solde', 'Solde en fin de mission', 'sub'));
  }
  function majTotaux() {
    data.lignes.forEach((l, i) => { const c = $(`.f-total__val[data-i="${i}"]`, corps); if (c) c.textContent = euro.format(arrondi((+l.qte || 0) * (+l.pu || 0))); });
    const t = totauxDocument(data);
    v.ht.textContent = euro.format(t.ht);
    v.tauxPrint.textContent = nombre.format(t.taux);
    v.tva.textContent = t.taux > 0 ? euro.format(t.tva) : 'Non applicable';
    ligneTva.classList.toggle('f-ligne-tva--zero', !(t.taux > 0));
    v.netLib.textContent = type === 'facture' ? (t.taux > 0 ? 'Net à payer TTC' : 'Net à payer') : (t.taux > 0 ? 'Total TTC' : 'Total à payer');
    v.net.textContent = euro.format(t.ttc);
    if (type === 'devis') {
      const ac = arrondi((t.ttc * (+data.acompte || 0)) / 100);
      v.pct.textContent = nombre.format(+data.acompte || 0);
      v.ac.textContent = euro.format(ac);
      v.solde.textContent = euro.format(arrondi(t.ttc - ac));
    }
  }

  lignes();
  return {
    el,
    majTotaux,
    rafraichir() { champs.forEach(({ el: c, chemin }) => { if (document.activeElement !== c) c.textContent = lire(data, chemin) ?? ''; }); lignes(); },
  };
}
