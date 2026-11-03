/* =========================================================
   ESPACE ADMIN BDA — Messagerie (version 12, module « mails »)
   #/messagerie            boîte de réception de contact@ (Gmail relié)
   #/messagerie/nouveau    écrire : à un agent, un client, un groupe
                           (…/nouveau/agent/12, …/nouveau/client/3, …/nouveau/groupe/agents)
   #/messagerie/envoyes    tout ce qui est parti de l'admin (ouvertures des factures et devis)
   #/messagerie/relances   factures en retard : relances préparées (jamais envoyées seules)
   #/messagerie/modeles    modèles de mails et signature
   Exporte aussi fenetreEnvoi() et blocMailDocument() pour l'éditeur de devis / factures.
   ========================================================= */
import { api, apiFichier, h, icone, toast, erreur, modale, confirmer, champ, saisie, zoneTexte, dateLisible, ilYa } from '../outils.js';

const nb = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const tel = (t) => `tel:${String(t || '').replace(/[^\d+]/g, '')}`;
const whatsapp = (t) => { let n = String(t || '').replace(/\D/g, ''); if (n.startsWith('0')) n = `33${n.slice(1)}`; return `https://wa.me/${n}`; };
const TYPES = { facture: 'Facture', devis: 'Devis', relance: 'Relance', libre: 'Message' };
const ONGLETS = [['', 'Boîte de réception'], ['nouveau', 'Écrire'], ['envoyes', 'Envoyés'], ['relances', 'Relances'], ['modeles', 'Modèles']];

let carnet = null; // contacts chargés une fois par visite
const chargerCarnet = async () => { carnet ??= await api('mod.mails.contacts'); return carnet; };

/* =========================================================
   Page Messagerie
   ========================================================= */
export async function pageMessagerie(ctx) {
  const [vue, ...reste] = ctx.params;
  const onglet = ONGLETS.some(([k]) => k === (vue || '')) ? (vue || '') : '';
  ctx.titre(onglet === 'nouveau' ? 'Écrire un message' : 'Messagerie');
  carnet = null;
  const [etat, relances] = await Promise.all([api('mod.mails.etat'), api('mod.mails.relances').catch(() => ({ relances: [] }))]);
  if (!ctx.actuel()) return;
  const aFaire = relances.relances.filter((r) => r.a_faire).length;
  ctx.actions(h('a', { class: 'btn btn--gold', href: '#/messagerie/nouveau' }, icone('crayon'), h('span', null, 'Écrire')));

  const barre = h('nav', { class: 'mx-onglets', 'aria-label': 'Messagerie' }, ONGLETS.map(([k, lib]) => h('a', {
    class: `mx-onglet ${k === onglet ? 'is-actif' : ''}`, href: `#/messagerie${k ? `/${k}` : ''}`,
  }, lib, k === 'relances' && aFaire ? h('span', { class: 'mx-onglet__n is-alerte' }, String(aFaire)) : null)));
  const bandeau = !etat.relie
    ? h('div', { class: `mx-bandeau ${etat.demo ? '' : 'is-attention'}` }, icone(etat.demo ? 'eclair' : 'alerte'),
      h('span', null, etat.demo
        ? 'Base de test : aucun mail ne part vraiment, la boîte de réception montre des exemples.'
        : 'La messagerie Google n’est pas reliée : les mails partent par le serveur, sans pièce jointe, et la boîte de réception est vide.'),
      etat.demo ? null : h('a', { class: 'btn btn--ghost btn--petit', href: '#/parametres' }, 'Relier Google'))
    : null;
  const zone = h('div', { class: 'mx-zone' });
  ctx.afficher(h('div', { class: 'mx' }, barre, bandeau, zone));
  const rendus = { '': vueBoite, nouveau: vueEcrire, envoyes: vueEnvoyes, relances: vueRelances, modeles: vueModeles };
  try {
    await rendus[onglet]({ ctx, zone, etat, relances: relances.relances, params: reste });
  } catch (e) { zone.replaceChildren(h('p', { class: 'mx-vide' }, e.message)); }
}

/* ----- Boîte de réception ----- */
async function vueBoite({ ctx, zone, etat }) {
  const liste = h('div', { class: 'mx-liste' });
  const lecture = h('section', { class: 'mx-lecture' }, h('div', { class: 'mx-lecture__vide' }, icone('mail'), h('p', null, 'Choisissez une conversation.')));
  const recherche = saisie({ type: 'search', placeholder: 'Rechercher dans les mails…', class: 'input mx-recherche' });
  let dossier = 'boite';
  const dossiers = h('div', { class: 'segments mx-dossiers' }, [['boite', 'Reçus'], ['envoyes', 'Envoyés']].map(([k, lib]) => h('button', {
    type: 'button', class: `segments__btn ${k === dossier ? 'is-actif' : ''}`, onclick: (e) => { dossier = k; [...dossiers.children].forEach((b) => b.classList.toggle('is-actif', b === e.currentTarget)); charger(); },
  }, lib)));
  const actualiser = h('button', { class: 'icon-btn', type: 'button', title: 'Actualiser', 'aria-label': 'Actualiser', onclick: () => charger() }, icone('activite'));
  const cadre = h('div', { class: 'mx-boite' },
    h('div', { class: 'mx-boite__gauche' }, h('div', { class: 'mx-outils' }, recherche, dossiers, actualiser), liste),
    lecture);
  zone.replaceChildren(cadre);
  let actif = null;

  async function charger() {
    liste.replaceChildren(...[0, 1, 2, 3].map(() => h('div', { class: 'mx-fil mx-fil--squelette' }, h('span'), h('span'), h('span'))));
    try {
      const r = await api('mod.mails.boite', undefined, { q: recherche.value.trim(), dossier });
      if (!document.body.contains(liste)) return;
      if (!r.relie && !r.demo) {
        liste.replaceChildren(h('div', { class: 'mx-vide' }, h('b', null, 'Boîte de réception indisponible'), h('p', null, 'Reliez la messagerie Google de contact@bdasecurite.com dans Paramètres pour lire vos mails ici.')));
        return;
      }
      if (!r.fils.length) { liste.replaceChildren(h('div', { class: 'mx-vide' }, h('b', null, recherche.value ? 'Aucun mail trouvé' : 'Boîte de réception vide'), h('p', null, 'Les nouveaux mails de contact@ apparaîtront ici.'))); return; }
      liste.replaceChildren(...r.fils.map((f) => h('button', {
        type: 'button', class: `mx-fil ${f.nonlu ? 'is-nonlu' : ''} ${actif === f.id ? 'is-actif' : ''}`, dataset: { id: f.id },
        onclick: (e) => { actif = f.id; [...liste.children].forEach((b) => b.classList.toggle('is-actif', b === e.currentTarget)); e.currentTarget.classList.remove('is-nonlu'); ouvrir(f.id); },
      },
      h('span', { class: 'mx-fil__haut' }, h('b', null, f.de || f.email), f.connu ? h('em', { class: 'mx-tag' }, f.connu.type === 'client' ? 'Client' : 'Agent') : null, h('time', null, quandCourt(f.date))),
      h('span', { class: 'mx-fil__sujet' }, f.sujet, f.n > 1 ? h('small', null, ` · ${f.n}`) : null),
      h('span', { class: 'mx-fil__extrait' }, f.extrait))));
    } catch (e) { liste.replaceChildren(h('div', { class: 'mx-vide' }, h('b', null, 'Lecture impossible'), h('p', null, e.message))); }
  }
  async function ouvrir(id) {
    cadre.classList.add('is-lecture');
    lecture.replaceChildren(h('div', { class: 'mx-chargement' }, h('span'), h('span'), h('span')));
    try {
      const { fil } = await api('mod.mails.fil', undefined, { id });
      if (actif !== id) return;
      const reponse = zoneTexte({ rows: 5, placeholder: 'Votre réponse…' });
      const envoyerRep = h('button', { class: 'btn btn--gold', type: 'button' }, icone('envoyer'), 'Envoyer la réponse');
      envoyerRep.onclick = async () => {
        if (!reponse.value.trim()) return reponse.focus();
        envoyerRep.disabled = true;
        try { await api('mod.mails.repondre', { fil: id, texte: reponse.value }); toast('Réponse envoyée.'); ouvrir(id); } catch (e) { erreur(e); envoyerRep.disabled = false; }
      };
      const classer = (action, msg) => async () => {
        try { await api('mod.mails.classer', { fil: id, action }); toast(msg); if (action === 'archiver') { cadre.classList.remove('is-lecture'); lecture.replaceChildren(); charger(); } } catch (e) { erreur(e); }
      };
      const connu = fil.connu ? h('a', { class: 'mx-connu', href: fil.connu.type === 'client' ? '#/clients' : `#/agents/${fil.connu.id}` }, icone(fil.connu.type === 'client' ? 'clients' : 'agents'), `${fil.connu.type === 'client' ? 'Client' : 'Agent'} : ${fil.connu.nom}`) : null;
      lecture.replaceChildren(
        h('header', { class: 'mx-lecture__tete' },
          h('button', { class: 'icon-btn mx-retour', type: 'button', 'aria-label': 'Retour à la liste', onclick: () => cadre.classList.remove('is-lecture') }, icone('retour')),
          h('div', null, h('h2', null, fil.sujet), connu),
          h('div', { class: 'mx-lecture__actions' },
            h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: classer('nonlu', 'Marqué comme non lu.') }, 'Non lu'),
            h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: classer('archiver', 'Conversation archivée.') }, 'Archiver'))),
        h('div', { class: 'mx-messages' }, fil.messages.map((m) => h('article', { class: `mx-message ${m.moi ? 'is-moi' : ''}` },
          h('header', null, h('span', { class: 'mx-avatar' }, initiales(m.de)), h('div', null, h('b', null, m.de), h('small', null, m.email)), h('time', null, dateLisible(m.date, true))),
          h('div', { class: 'mx-message__texte' }, m.texte || '(message vide)'),
          m.pieces.length ? h('div', { class: 'mx-pieces' }, m.pieces.map((p) => h('a', {
            class: 'mx-piece', href: `api.php?${new URLSearchParams({ a: 'mod.mails.piece', message: p.message, piece: p.piece, nom: p.nom })}`,
          }, icone('telecharger'), p.nom, h('small', null, taille(p.taille))))) : null))),
        h('footer', { class: 'mx-repondre' }, reponse, h('div', { class: 'mx-repondre__barre' }, h('small', { class: 'muet' }, etat.compte ? `Depuis ${etat.compte}` : ''), envoyerRep)));
      lecture.querySelector('.mx-messages').lastElementChild?.scrollIntoView({ block: 'nearest' });
      ctx.compteurs?.();
    } catch (e) { lecture.replaceChildren(h('div', { class: 'mx-vide' }, h('b', null, 'Ouverture impossible'), h('p', null, e.message))); }
  }
  let minuteur = null;
  recherche.addEventListener('input', () => { clearTimeout(minuteur); minuteur = setTimeout(charger, 400); });
  charger();
}

/* ----- Écrire (agents, clients, groupes) ----- */
async function vueEcrire({ zone, etat, params }) {
  const c = await chargerCarnet();
  const [quoi, cle] = params;
  const initiaux = [];
  if (quoi === 'agent') { const a = c.agents.find((x) => x.id === +cle); if (a) initiaux.push({ type: 'agent', id: a.id, nom: a.nom, email: a.email }); }
  if (quoi === 'client') { const x = c.clients.find((y) => y.id === +cle); if (x) initiaux.push({ type: 'client', id: x.id, nom: x.nom, email: x.email }); }
  if (quoi === 'groupe' && cle === 'agents') c.agents.filter((a) => a.email).forEach((a) => initiaux.push({ type: 'agent', id: a.id, nom: a.nom, email: a.email }));
  if (quoi === 'groupe' && cle === 'clients') c.clients.filter((x) => x.email).forEach((x) => initiaux.push({ type: 'client', id: x.id, nom: x.nom, email: x.email }));
  const comp = await compositeur({ etat, destinataires: initiaux, type: 'libre' });
  const envoyer = h('button', { class: 'btn btn--gold', type: 'button' }, icone('envoyer'), 'Envoyer');
  envoyer.onclick = async () => { envoyer.disabled = true; const ok = await comp.envoyer(); envoyer.disabled = false; if (ok) location.hash = '#/messagerie/envoyes'; };
  zone.replaceChildren(h('div', { class: 'mx-ecrire' },
    h('section', { class: 'carte mx-ecrire__carte' }, comp.el, h('footer', { class: 'mx-ecrire__pied' }, h('small', { class: 'muet' }, comp.note), envoyer)),
    aideContacts(c)));
}
// Colonne d'aide : appeler ou écrire en un clic (agents et clients)
function aideContacts(c) {
  const q = saisie({ type: 'search', placeholder: 'Agent ou client…', class: 'input' });
  const liste = h('ul', { class: 'mx-annuaire' });
  const dessiner = () => {
    const n = q.value.trim().toLowerCase();
    const tous = [...c.agents.map((a) => ({ ...a, type: 'agent' })), ...c.clients.map((x) => ({ ...x, type: 'client' }))]
      .filter((x) => !n || x.nom.toLowerCase().includes(n)).slice(0, 40);
    liste.replaceChildren(...tous.map((x) => h('li', null,
      h('div', null, h('b', null, x.nom), h('small', null, x.type === 'agent' ? (x.poste || 'Agent') : 'Client', x.email ? ` · ${x.email}` : ' · pas d’e-mail')),
      h('div', { class: 'mx-annuaire__actions' },
        x.tel ? h('a', { class: 'icon-btn', href: tel(x.tel), title: `Appeler ${x.tel}`, 'aria-label': 'Appeler' }, icone('telephone')) : null,
        x.tel && x.type === 'agent' ? h('a', { class: 'icon-btn', href: whatsapp(x.tel), target: '_blank', rel: 'noopener', title: 'WhatsApp', 'aria-label': 'WhatsApp' }, icone('message')) : null,
        x.email ? h('a', { class: 'icon-btn', href: `#/messagerie/nouveau/${x.type}/${x.id}`, title: 'Écrire', 'aria-label': 'Écrire' }, icone('mail')) : null))));
  };
  q.addEventListener('input', dessiner);
  dessiner();
  return h('aside', { class: 'carte mx-annuaire__carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Annuaire'), h('small', null, 'Appeler, WhatsApp ou écrire')), q, liste);
}

/* ----- Envoyés ----- */
async function vueEnvoyes({ zone }) {
  const q = saisie({ type: 'search', placeholder: 'Destinataire ou objet…', class: 'input' });
  const corps = h('tbody');
  const table = h('div', { class: 'tableau mx-table' }, h('table', null,
    h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Destinataire'), h('th', null, 'Objet'), h('th', null, 'Type'), h('th', null, 'Suivi'))), corps));
  const charger = async () => {
    const { envois } = await api('mod.mails.envois', undefined, { q: q.value.trim() });
    corps.replaceChildren(...(envois.length ? envois.map((e) => h('tr', null,
      h('td', { class: 'mx-num' }, dateLisible(e.quand, true)),
      h('td', null, h('b', null, e.nom || e.a), e.nom ? h('small', { class: 'muet mx-bloc' }, e.a) : null),
      h('td', null, e.sujet, e.pieces ? h('small', { class: 'muet mx-bloc' }, icone('dossier'), ` ${e.pieces}`) : null),
      h('td', null, h('span', { class: 'mx-type' }, e.type === 'relance' ? `Relance ${e.niveau}` : TYPES[e.type] || 'Message')),
      h('td', null, e.document_id ? (e.ouvert_le
        ? h('span', { class: 'mx-ouvert is-ok' }, `Ouvert ${ilYa(e.ouvert_le)}`, e.ouvertures > 1 ? ` · ${e.ouvertures} fois` : '')
        : h('span', { class: 'mx-ouvert' }, 'Pas encore ouvert')) : h('span', { class: 'muet' }, e.statut === 'envoye' ? 'Envoyé' : 'Erreur'))))
      : [h('tr', null, h('td', { colspan: 5, class: 'mx-vide-cellule' }, 'Aucun mail envoyé depuis l’admin pour l’instant.'))]));
  };
  let m = null;
  q.addEventListener('input', () => { clearTimeout(m); m = setTimeout(charger, 300); });
  zone.replaceChildren(h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Mails envoyés depuis l’admin'), q), table));
  await charger();
}

/* ----- Relances ----- */
async function vueRelances({ zone, relances }) {
  const libNiveau = { 1: 'Courtoise', 2: 'Ferme', 3: 'Dernier rappel' };
  zone.replaceChildren(h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Factures en retard'), h('small', null, 'La relance est préparée, vous la relisez et l’envoyez vous-même')),
    relances.length
      ? h('div', { class: 'tableau mx-table' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Facture'), h('th', null, 'Client'), h('th', { class: 'mx-droite' }, 'Montant'), h('th', null, 'Échéance'), h('th', null, 'Relances'), h('th', null, ''))),
        h('tbody', null, relances.map((r) => h('tr', { class: r.a_faire ? 'is-a-faire' : '' },
          h('td', { class: 'mx-num' }, h('a', { href: `#/factures/${r.id}` }, r.numero)),
          h('td', null, h('b', null, r.client), h('small', { class: `mx-bloc ${r.email ? 'muet' : 'mx-rouge'}` }, r.email || 'pas d’e-mail connu')),
          h('td', { class: 'mx-droite mx-num' }, euro.format(r.total)),
          h('td', null, h('span', { class: 'mx-rouge' }, `${dateLisible(r.echeance)} · ${r.retard} j de retard`)),
          h('td', null, r.relances ? `${r.relances} · la dernière ${ilYa(r.derniere)}` : 'Aucune'),
          h('td', { class: 'mx-droite' }, h('button', { class: `btn btn--petit ${r.a_faire ? 'btn--gold' : 'btn--ghost'}`, type: 'button', onclick: () => {
            // l'éditeur de la facture produit le PDF puis ouvre la fenêtre d'envoi avec le bon modèle
            try { sessionStorage.setItem('bda-relance', JSON.stringify({ id: r.id, niveau: r.niveau })); } catch (e) { /* navigation privée */ }
            location.hash = `#/factures/${r.id}`;
          } }, `Préparer la relance ${r.niveau} · ${libNiveau[r.niveau]}`)))))))
      : h('div', { class: 'mx-vide' }, h('b', null, 'Aucune facture en retard'), h('p', null, 'Toutes vos factures envoyées sont dans les temps.'))));
}

/* ----- Modèles ----- */
async function vueModeles({ zone, ctx }) {
  const d = await api('mod.mails.modeles');
  const carteModele = (m) => {
    const sujet = saisie({ value: m.sujet });
    const texte = zoneTexte({ value: m.texte, rows: 9 });
    const enregistrer = h('button', { class: 'btn btn--gold btn--petit', type: 'button' }, 'Enregistrer');
    enregistrer.onclick = async () => { try { await api('mod.mails.modele.enregistrer', { cle: m.cle, sujet: sujet.value, texte: texte.value }); toast('Modèle enregistré.'); } catch (e) { erreur(e); } };
    const retablir = h('button', { class: 'lien-btn', type: 'button', onclick: async () => {
      if (!(await confirmer('Revenir au texte d’origine de ce modèle ?', { ok: 'Rétablir' }))) return;
      try { await api('mod.mails.modele.enregistrer', { cle: m.cle, reinitialiser: true }); toast('Modèle rétabli.'); vueModeles({ zone, ctx }); } catch (e) { erreur(e); }
    } }, 'Rétablir l’original');
    return h('section', { class: 'carte mx-modele' }, h('header', { class: 'carte__tete' }, h('h2', null, m.libelle), m.modifie ? h('small', null, 'modifié') : null),
      h('div', { class: 'form-grille' }, m.cle === 'libre' ? null : champ('Objet', sujet), champ('Message', texte)),
      h('div', { class: 'mx-modele__pied' }, retablir, enregistrer));
  };
  const signature = zoneTexte({ value: d.signature, rows: 4 });
  const enrSig = h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: async () => { try { await api('mod.mails.modele.enregistrer', { cle: 'signature', texte: signature.value }); toast('Signature enregistrée.'); } catch (e) { erreur(e); } } }, 'Enregistrer');
  zone.replaceChildren(h('div', { class: 'mx-modeles' },
    h('p', { class: 'mx-aide' }, 'Variables remplacées à l’envoi : ', ['{client}', '{prenom}', '{numero}', '{montant}', '{echeance}', '{lien}', '{date}', '{signature}'].map((v) => h('code', null, v))),
    h('section', { class: 'carte mx-modele' }, h('header', { class: 'carte__tete' }, h('h2', null, 'Signature'), h('small', null, 'ajoutée par {signature}')), signature, h('div', { class: 'mx-modele__pied' }, enrSig)),
    d.modeles.map(carteModele)));
}

/* =========================================================
   Compositeur : destinataires, objet, message, pièces jointes
   ========================================================= */
async function compositeur({ etat, destinataires = [], type = 'libre', document: doc = null, sujet = '', texte = '', modele = '', valeurs = {} }) {
  const c = await chargerCarnet();
  const { modeles } = await api('mod.mails.modeles');
  const choisis = [...destinataires];
  const puces = h('div', { class: 'mx-puces' });
  const saisieDest = h('input', { class: 'mx-dest__saisie', type: 'text', placeholder: 'Nom d’un agent, d’un client ou adresse e-mail…', autocomplete: 'off', spellcheck: 'false' });
  const suggestions = h('ul', { class: 'mx-suggestions', hidden: true });
  const dessinerPuces = () => {
    puces.replaceChildren(...choisis.slice(0, 60).map((d, i) => h('span', { class: `mx-puce mx-puce--${d.type}` }, h('b', null, d.nom || d.email), d.nom ? h('small', null, d.email) : null,
      h('button', { type: 'button', 'aria-label': 'Retirer', onclick: () => { choisis.splice(i, 1); dessinerPuces(); } }, icone('croix')))),
    ...(choisis.length > 60 ? [h('span', { class: 'mx-puce' }, `+ ${choisis.length - 60} autres`)] : []), saisieDest);
    compte.textContent = choisis.length > 1 ? `${choisis.length} destinataires · un mail séparé à chacun` : '';
  };
  const ajouter = (d) => {
    if (!d.email) return toast(`${d.nom} n’a pas d’adresse e-mail dans sa fiche.`, 'erreur');
    if (!choisis.some((x) => x.email.toLowerCase() === d.email.toLowerCase())) choisis.push(d);
    saisieDest.value = ''; suggestions.hidden = true; dessinerPuces(); saisieDest.focus();
  };
  const proposer = () => {
    const n = saisieDest.value.trim().toLowerCase();
    if (!n) { suggestions.hidden = true; return; }
    const res = [...c.agents.map((a) => ({ type: 'agent', id: a.id, nom: a.nom, email: a.email, sous: a.poste })), ...c.clients.map((x) => ({ type: 'client', id: x.id, nom: x.nom, email: x.email, sous: 'Client' }))]
      .filter((x) => x.nom.toLowerCase().includes(n) || (x.email || '').toLowerCase().includes(n)).slice(0, 8);
    const libre = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n) ? [{ type: 'email', id: 0, nom: '', email: saisieDest.value.trim(), sous: 'Adresse e-mail' }] : [];
    const tout = [...libre, ...res];
    suggestions.hidden = !tout.length;
    suggestions.replaceChildren(...tout.map((x) => h('li', null, h('button', { type: 'button', class: x.email ? '' : 'is-sans', onmousedown: (e) => { e.preventDefault(); ajouter(x); } },
      h('b', null, x.nom || x.email), h('small', null, [x.sous, x.email || 'pas d’e-mail'].filter(Boolean).join(' · '))))));
  };
  saisieDest.addEventListener('input', proposer);
  saisieDest.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); const p = suggestions.querySelector('button'); if (p && !suggestions.hidden) p.dispatchEvent(new MouseEvent('mousedown')); }
    if (e.key === 'Backspace' && !saisieDest.value && choisis.length) { choisis.pop(); dessinerPuces(); }
  });
  saisieDest.addEventListener('blur', () => setTimeout(() => { suggestions.hidden = true; }, 150));
  const compte = h('small', { class: 'mx-dest__compte' });
  // Groupes en un clic
  const groupe = (lib, liste) => h('button', { type: 'button', class: 'chip', onclick: () => { liste().forEach((d) => { if (d.email && !choisis.some((x) => x.email.toLowerCase() === d.email.toLowerCase())) choisis.push(d); }); dessinerPuces(); } }, lib);
  const agentsMail = c.agents.filter((a) => a.email);
  const selSite = h('select', { class: 'input input--auto mx-site', onchange: () => {
    const s = c.sites.find((x) => String(x.id) === selSite.value);
    selSite.value = '';
    if (!s) return;
    c.agents.filter((a) => s.agents.includes(a.id) && a.email).forEach((a) => { if (!choisis.some((x) => x.email === a.email)) choisis.push({ type: 'agent', id: a.id, nom: a.nom, email: a.email }); });
    dessinerPuces();
  } }, h('option', { value: '' }, 'Agents d’un site…'), c.sites.map((s) => h('option', { value: s.id }, `${s.nom} (${s.agents.length})`)));
  const groupes = doc ? null : h('div', { class: 'mx-groupes' },
    groupe(`Tous les agents (${agentsMail.length})`, () => agentsMail.map((a) => ({ type: 'agent', id: a.id, nom: a.nom, email: a.email }))),
    c.sites.length ? selSite : null,
    groupe(`Tous les clients (${c.clients.filter((x) => x.email).length})`, () => c.clients.map((x) => ({ type: 'client', id: x.id, nom: x.nom, email: x.email }))),
    h('button', { type: 'button', class: 'lien-btn', onclick: () => { choisis.length = 0; dessinerPuces(); } }, 'Tout retirer'));

  const cc = saisie({ placeholder: 'Copie à (facultatif)', type: 'text' });
  const champSujet = saisie({ value: sujet });
  const champTexte = zoneTexte({ rows: 12, value: texte });
  // Modèle : remplit l'objet et le message (les variables sont remplacées à l'envoi)
  const choixModele = h('select', { class: 'input input--auto', onchange: () => appliquer(choixModele.value) },
    modeles.filter((m) => doc || m.cle === 'libre').map((m) => h('option', { value: m.cle }, m.libelle)));
  // les valeurs connues (n° de facture, montant, échéance, signature) sont écrites tout de suite : on relit le vrai message ; {lien} est ajouté à l'envoi
  const remplir = (t) => Object.entries({ '{signature}': etat.signature || '', ...valeurs }).reduce((acc, [k, v]) => (v ? acc.split(k).join(v) : acc), t);
  const appliquer = (cle) => { const m = modeles.find((x) => x.cle === cle); if (!m) return; if (m.sujet) champSujet.value = remplir(m.sujet); champTexte.value = remplir(m.texte); choixModele.value = cle; };
  if (modele) appliquer(modele); else if (!texte) appliquer('libre');
  const fichiers = h('input', { type: 'file', multiple: true, accept: 'application/pdf,image/png,image/jpeg,image/webp', hidden: true, onchange: () => dessinerPieces() });
  const listePieces = h('div', { class: 'mx-pieces' });
  const dessinerPieces = () => listePieces.replaceChildren(
    ...(doc ? [h('span', { class: 'mx-piece is-auto' }, icone('facture'), `${doc.type === 'facture' ? 'Facture' : 'Devis'} ${doc.numero}.pdf`, h('small', null, 'joint automatiquement'))] : []),
    ...[...fichiers.files].map((f) => h('span', { class: 'mx-piece' }, icone('dossier'), f.name, h('small', null, taille(f.size)))),
    h('button', { type: 'button', class: 'lien-btn', onclick: () => fichiers.click() }, icone('plus'), 'Joindre un fichier'));
  dessinerPieces();
  const marquer = doc && doc.statut === 'brouillon' ? h('input', { type: 'checkbox', checked: true }) : null;
  const note = etat.relie ? `Envoyé depuis ${etat.compte}` : etat.demo ? 'Base de test : rien ne part vraiment' : 'Envoi par le serveur (reliez Google pour les pièces jointes)';
  dessinerPuces();

  const el = h('div', { class: 'mx-compo' },
    h('div', { class: 'mx-ligne' }, h('span', { class: 'mx-ligne__lib' }, 'À'), h('div', { class: 'mx-dest' }, puces, suggestions, compte)),
    groupes,
    h('div', { class: 'mx-ligne' }, h('span', { class: 'mx-ligne__lib' }, 'Cc'), cc),
    h('div', { class: 'mx-ligne' }, h('span', { class: 'mx-ligne__lib' }, 'Modèle'), choixModele),
    h('div', { class: 'mx-ligne' }, h('span', { class: 'mx-ligne__lib' }, 'Objet'), champSujet),
    champTexte,
    fichiers, listePieces,
    marquer ? h('label', { class: 'case' }, marquer, h('span', null, `Marquer ${doc.type === 'facture' ? 'la facture comme envoyée' : 'le devis comme envoyé'}`)) : null);

  async function envoyer({ pdf, nomPdf, typeEnvoi, niveau } = {}) {
    if (!choisis.length) { toast('Ajoutez au moins un destinataire.', 'erreur'); saisieDest.focus(); return false; }
    if (!champSujet.value.trim()) { toast('Écrivez un objet.', 'erreur'); champSujet.focus(); return false; }
    if (choisis.length > 1 && !(await confirmer(`Envoyer ce message à ${choisis.length} personnes ? Chacune recevra son propre mail (les autres adresses restent cachées).`, { titre: 'Envoi groupé', ok: `Envoyer à ${choisis.length}` }))) return false;
    const fd = new FormData();
    fd.append('donnees', JSON.stringify({ destinataires: choisis, cc: cc.value, sujet: champSujet.value, texte: champTexte.value, type: typeEnvoi || type, niveau: niveau || 0, document_id: doc?.id || 0, marquer: marquer ? marquer.checked : false }));
    try {
      if (doc) {
        const blob = await pdf;
        fd.append('pdf', blob, nomPdf || `${doc.numero}.pdf`);
      }
      [...fichiers.files].forEach((f) => fd.append('pieces[]', f, f.name));
      const r = await apiFichier('mod.mails.envoyer', fd);
      toast(r.envoyes > 1 ? `${r.envoyes} mails envoyés.` : 'Mail envoyé.');
      if (r.erreurs?.length) toast(`Non envoyés : ${r.erreurs.join(' ; ')}`, 'erreur');
      return r;
    } catch (e) { erreur(e); return false; }
  }
  return { el, envoyer, note };
}

/* =========================================================
   Pour l'éditeur de devis / factures
   ========================================================= */
// Fenêtre « Envoyer par mail » : pdf = Promise<Blob> du document (préparée pendant qu'on écrit)
export async function fenetreEnvoi({ document: doc, pdf, nomPdf, clients = [], type, niveau = 0 }) {
  const etat = await api('mod.mails.etat');
  // Destinataire proposé : fiche client (même nom), sinon e-mail écrit sur la feuille
  const nomClient = (doc.client?.nom || '').trim().toLowerCase();
  const fiche = clients.find((x) => (x.nom || '').trim().toLowerCase() === nomClient);
  const emailFeuille = ((doc.client?.adresse || '').match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/) || [])[0] || '';
  const email = fiche?.email || emailFeuille;
  const dest = email ? [{ type: fiche ? 'client' : 'email', id: fiche?.id || 0, nom: doc.client?.nom || '', email }] : [];
  const modele = type === 'relance' ? `relance${Math.min(3, Math.max(1, niveau || 1))}` : doc.type;
  let valeurs = { '{numero}': doc.numero, '{client}': doc.client?.nom || '' };
  try {
    const { document: d } = await api('document', undefined, { id: doc.id });
    const fr = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
    valeurs = { ...valeurs, '{montant}': euro.format(+d.total || 0), '{echeance}': fr(d.echeance) };
  } catch (e) { /* valeurs remplies à l'envoi */ }
  const comp = await compositeur({ etat, destinataires: dest, type: type || doc.type, document: doc, modele, valeurs });
  const r = await modale({
    titre: type === 'relance' ? `Relance ${niveau} · facture ${doc.numero}` : `Envoyer ${doc.type === 'facture' ? 'la facture' : 'le devis'} ${doc.numero} par mail`,
    large: true,
    contenu: h('div', { class: 'mx-fenetre' }, comp.el, h('p', { class: 'mx-fenetre__note' }, comp.note, ' · le client reçoit le PDF et un lien « Voir en ligne » qui vous prévient quand il l’ouvre.')),
    actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: null },
      { libelle: 'Envoyer', classe: 'btn--gold', submit: true, action: async () => comp.envoyer({ pdf, nomPdf, typeEnvoi: type || doc.type, niveau }) }],
  });
  return r || null;
}
// Bloc du panneau de l'éditeur : derniers envois et ouvertures
export function blocMailDocument({ id, type, onEnvoyer, onRelancer }) {
  const bloc = h('section', { class: 'panneau__bloc mx-bloc-doc' });
  const dessiner = async () => {
    let envois = [];
    if (id()) { try { envois = (await api('mod.mails.envois', undefined, { document: id() })).envois; } catch (e) { /* module absent */ } }
    const dernier = envois[0];
    bloc.replaceChildren(...[h('h3', null, 'Envoi par mail'),
      dernier
        ? h('p', { class: 'espace-etat is-on' }, icone('coche'), h('span', null, `Envoyé ${ilYa(dernier.quand)} à ${dernier.nom || dernier.a}`, h('br'),
          dernier.ouvert_le ? `Ouvert par le client ${ilYa(dernier.ouvert_le)}` : 'Pas encore ouvert par le client'))
        : h('p', { class: 'espace-etat' }, icone('mail'), h('span', null, `${type === 'facture' ? 'Cette facture' : 'Ce devis'} n’a pas encore été envoyé${type === 'facture' ? 'e' : ''} par mail.`)),
      h('button', { class: `btn ${dernier ? 'btn--ghost' : 'btn--gold'} btn--bloc`, type: 'button', onclick: onEnvoyer }, icone('envoyer'), dernier ? 'Renvoyer par mail' : 'Envoyer par mail'),
      type === 'facture' && dernier && onRelancer ? h('button', { class: 'lien-btn', type: 'button', onclick: onRelancer }, 'Préparer une relance') : null,
      envois.length > 1 ? h('ul', { class: 'mx-histo' }, envois.slice(0, 4).map((e) => h('li', null, h('span', null, e.type === 'relance' ? `Relance ${e.niveau}` : 'Envoi'), h('small', null, `${dateLisible(e.quand)} · ${e.ouvert_le ? 'ouvert' : 'non ouvert'}`)))) : null].filter(Boolean));
  };
  dessiner();
  return { el: bloc, maj: dessiner };
}

/* ---------- Petits outils ---------- */
function initiales(s) { return String(s || '?').replace(/[^\p{L}\s-]/gu, '').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase() || '?'; }
function taille(o) { o = Number(o) || 0; return o > 1048576 ? `${(o / 1048576).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`; }
function quandCourt(s) {
  const d = new Date(String(s).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  const auj = new Date();
  if (d.toDateString() === auj.toDateString()) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
}
