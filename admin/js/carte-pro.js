/* =========================================================
   ESPACE ADMIN BDA — carte professionnelle (CNAPS)
   Vérification d'une carte avec le NUB et le nom de l'agent :
   réponse immédiate d'après les documents reçus, puis
   confirmation officielle sur DRACAR (espace CNAPS du gérant,
   que l'admin ne peut pas interroger lui-même) notée sur la fiche.
   ========================================================= */
import { api, h, icone, toast, erreur, modale, champ, saisie, iso, isoVersFr } from './outils.js';

// Code d'activité des nouveaux numéros (2026-0061049-CAR-SH-1001740)
const ACTIVITES = { SH: 'Surveillance humaine ou gardiennage' };
// Libellés proposés quand on note le résultat de DRACAR
const LIBELLES_ACTIVITE = ['Surveillance humaine ou gardiennage', 'Protection physique des personnes', 'Agent cynophile', 'Sûreté aéroportuaire', 'Transport de fonds', 'Vidéoprotection'];
const RESULTATS = { actif: 'Actif', inactif: 'Inactif', retire: 'Retiré', introuvable: 'Introuvable' };
const LIEN_CNAPS = 'https://www.cnaps.interieur.gouv.fr/';
const EQUIPE = { primaire: 'Équipe principale', secondaire: 'Renfort', secours: 'Agent de secours' };

const sansAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const infosDe = (a) => { try { return typeof a.infos === 'string' ? JSON.parse(a.infos || '{}') : (a.infos || {}); } catch { return {}; } };
const mien = (a) => (a.categorie || 'primaire') !== 'secours';

/* ---------- Lecture du numéro de carte ---------- */
// Nouveau format : 2026-0061049-CAR-SH-1001740 (NUB = 7 derniers chiffres, SH = activité)
// Ancien format  : CAR-093-2028-05-10-20230491092 (date de fin dans le numéro, NUB déduit)
export function lireCarte(numero) {
  const n = String(numero || '').toUpperCase().replace(/\s+/g, '');
  if (!n) return { format: 'aucun', nub: '', activite: '', fin: '' };
  if (/FALSIFI/.test(n)) return { format: 'falsifiee', nub: '', activite: '', fin: '' };
  let m = /(\d{4})-(\d{7})-CAR-([A-Z]{2,3})-(\d{7})/.exec(n);
  if (m) return { format: 'nouveau', nub: m[4], code: m[3], activite: ACTIVITES[m[3]] || '', fin: '' };
  m = /CAR-(\d{3})-(\d{4})-(\d{2})-(\d{2})(?:-(\d{7,}))?/.exec(n);
  if (m) return { format: 'ancien', nub: m[5] ? m[5].slice(-7) : '', activite: '', fin: `${m[2]}-${m[3]}-${m[4]}` };
  if (/CAR-/.test(n)) return { format: 'inconnu', nub: (/(\d{7})$/.exec(n) || [])[1] || '', activite: '', fin: '' };
  return { format: 'autre', nub: '', activite: '', fin: '' };
}
const estCnaps = (c, a) => ['nouveau', 'ancien', 'inconnu', 'falsifiee'].includes(c.format) || (c.format === 'aucun' && !!a.validite && !/vtc|chauffeur/i.test(a.poste || ''));

/* ---------- État du titre : dates, refus et dernier résultat DRACAR ---------- */
export function etatTitre(a, i = infosDe(a), c = lireCarte(a.carte)) {
  const fin = a.validite || c.fin || '';
  if (c.format === 'falsifiee') return { code: 'falsifiee', libelle: 'Falsifiée', grave: true, fin: '' };
  if (i.dracar === 'retire') return { code: 'retiree', libelle: 'Retirée', grave: true, fin };
  if (i.dracar === 'inactif') return { code: 'inactive', libelle: 'Inactive', grave: true, fin };
  if (i.dracar === 'introuvable') return { code: 'introuvable', libelle: 'Introuvable', grave: true, fin };
  if (!fin) return { code: 'a-verifier', libelle: 'À vérifier', fin: '' };
  const jours = Math.round((Date.parse(fin) - Date.parse(iso(new Date()))) / 864e5);
  if (jours < 0) return { code: 'expiree', libelle: 'Expirée', grave: true, fin, jours };
  if (jours <= 90) return { code: 'expire-bientot', libelle: 'Expire bientôt', fin, jours };
  return { code: 'valide', libelle: i.dracar === 'actif' ? 'Active' : 'Valide', fin, jours };
}
const couleur = (e) => (e.grave ? 'rouge' : e.code);

// « 4 ans et 7 mois », « 45 jours »
function duree(jours) {
  const j = Math.abs(jours);
  if (j < 62) return `${j} jour${j > 1 ? 's' : ''}`;
  const mois = Math.floor(j / 30.44), ans = Math.floor(mois / 12), m = mois % 12;
  return [ans ? `${ans} an${ans > 1 ? 's' : ''}` : '', m ? `${m} mois` : ''].filter(Boolean).join(' et ');
}
// « TALL Amadou » → nom TALL, prénom Amadou (les mots en majuscules sont le nom de famille)
function separerNom(complet) {
  const mots = String(complet || '').trim().split(/\s+/).filter(Boolean);
  const maj = mots.filter((m) => m.length > 1 && m === m.toUpperCase() && m !== m.toLowerCase());
  if (maj.length && maj.length < mots.length) return { nom: maj.join(' '), prenom: mots.filter((m) => !maj.includes(m)).join(' ') };
  return { nom: mots[0] || '', prenom: mots.slice(1).join(' ') };
}
function ficheCarte(a) {
  const i = infosDe(a), c = lireCarte(a.carte), etat = etatTitre(a, i, c);
  const nubOfficiel = /^\d{7}$/.test(i.nub || '') ? i.nub : '';
  return {
    a, i, c, etat, ...separerNom(a.nom),
    nub: nubOfficiel || c.nub || '', nubDeduit: !nubOfficiel && c.format === 'ancien' && !!c.nub,
    activite: i.activite || c.activite || '', cnaps: estCnaps(c, a),
    mots: sansAccents(a.nom).split(/[^a-z0-9]+/).filter(Boolean),
  };
}
// Ce qui est tapé dans le champ NUB : 7 chiffres, ou le numéro de carte complet
function lireSaisieNub(t) {
  const s = String(t || '').trim();
  if (/CAR/i.test(s)) { const c = lireCarte(s); return { nub: c.nub, partiel: '', carte: c }; }
  const d = s.replace(/\D/g, '');
  return { nub: d.length >= 7 ? d.slice(-7) : '', partiel: d.length < 7 ? d : '', carte: null };
}

const pastille = (f) => h('span', { class: `cp-pill cp-pill--${couleur(f.etat)}` }, f.etat.libelle.toUpperCase());

/* =========================================================
   FENÊTRE « CARTE PRO »
   ========================================================= */
export async function ouvrirCartePro({ agents, dracar = '', agent = null }) {
  let lien = dracar, modifie = false, nubSaisi = '';
  const nub = saisie({ inputmode: 'numeric', autocomplete: 'off', spellcheck: 'false', placeholder: 'ex. 1001740', oninput: () => dessiner() });
  const nom = saisie({ autocomplete: 'off', spellcheck: 'false', placeholder: 'ex. TALL Amadou', list: 'cp-noms', oninput: () => dessiner() });
  const aideNub = h('span');
  const zone = h('div', { class: 'cp-zone', 'aria-live': 'polite' });
  const piedLien = h('div', { class: 'cp-lien' });

  const choisir = (f) => { nom.value = f.a.nom; nub.value = f.nub; dessiner(); nub.focus(); };

  function dessiner() {
    const lu = lireSaisieNub(nub.value);
    nubSaisi = lu.nub;
    const q = sansAccents(nom.value).split(/[^a-z0-9]+/).filter(Boolean);
    aideNub.replaceChildren(lu.carte && lu.carte.nub
      ? h('span', { class: 'cp-ok' }, `Numéro reconnu · NUB ${lu.carte.nub}${lu.carte.activite ? ` · ${lu.carte.activite}` : ''}${lu.carte.fin ? ` · fin ${isoVersFr(lu.carte.fin)}` : ''}`)
      : lu.partiel && lu.partiel.length ? `${lu.partiel.length} chiffre${lu.partiel.length > 1 ? 's' : ''} sur 7` : '7 chiffres, à la fin du n° de carte (ou collez le n° complet).');

    if (!lu.nub && lu.partiel.length < 3 && !q.length) return zone.replaceChildren(apercu());
    const F = agents.map(ficheCarte);
    const parNub = lu.nub ? F.filter((f) => f.nub === lu.nub) : lu.partiel.length >= 3 ? F.filter((f) => f.nub.includes(lu.partiel)) : [];
    const parNom = q.length ? F.filter((f) => q.every((m) => f.mots.some((w) => w.startsWith(m)))) : [];
    let res = [], note = null;
    if (lu.nub && q.length) {
      const deux = parNub.filter((f) => parNom.includes(f));
      if (deux.length) { res = deux; note = ['ok', 'Le NUB et le nom correspondent à vos dossiers.']; }
      else if (parNub.length) { res = parNub; note = ['alerte', `Ce NUB est celui de ${parNub.map((f) => f.a.nom).join(', ')} dans vos dossiers, pas de « ${nom.value.trim()} ».`]; }
      else if (parNom.length) {
        res = parNom;
        const seul = parNom.length === 1 ? parNom[0] : null;
        note = ['alerte', `Le NUB ${lu.nub} n’est dans aucun de vos dossiers.${seul ? (seul.nub ? ` Pour ${seul.a.nom}, le NUB enregistré est ${seul.nub}.` : ` Aucun NUB enregistré pour ${seul.a.nom}.`) : ''}`];
      }
    } else if (lu.nub || lu.partiel.length >= 3) res = q.length ? parNub.filter((f) => parNom.includes(f)) : parNub;
    else res = parNom;

    if (!res.length) return zone.replaceChildren(vide(lu.nub, nom.value.trim()));
    zone.replaceChildren(...[
      note ? h('p', { class: `cp-note cp-note--${note[0]}` }, icone(note[0] === 'ok' ? 'coche' : 'alerte'), h('span', null, note[1])) : null,
      res.length === 1 ? resultat(res[0]) : tableauDracar(res.slice(0, 12), true),
      res.length > 12 ? h('p', { class: 'muet' }, `… et ${res.length - 12} autres : précisez le nom.`) : null].filter(Boolean));
  }

  /* ----- Rien de tapé : état des cartes de mes agents ----- */
  function apercu() {
    const F = agents.filter(mien).map(ficheCarte).filter((f) => f.cnaps);
    const n = (fn) => F.filter(fn).length;
    const stats = [
      ['valide', 'Valides', n((f) => f.etat.code === 'valide')],
      ['expire-bientot', 'Expirent sous 90 j', n((f) => f.etat.code === 'expire-bientot')],
      ['rouge', 'Expirées ou refusées', n((f) => f.etat.grave)],
      ['a-verifier', 'Sans date', n((f) => f.etat.code === 'a-verifier')],
      ['dracar', 'Vérifiées sur DRACAR', n((f) => !!f.i.dracar)],
    ];
    const aSurveiller = F.filter((f) => f.etat.code !== 'valide')
      .sort((x, y) => (!!y.etat.grave - !!x.etat.grave) || ((x.etat.jours ?? 1e9) - (y.etat.jours ?? 1e9)));
    const nonVerifiees = F.filter((f) => f.etat.code === 'valide' && !f.i.dracar);
    return h('div', { class: 'cp-apercu' },
      h('div', { class: 'cp-stats' }, stats.map(([c, l, v], k) => h('div', { class: `cp-stat cp-stat--${c}`, style: { animationDelay: `${k * 50}ms` } }, h('b', null, v), h('span', null, l)))),
      aSurveiller.length ? h('div', null, h('h3', { class: 'cp-titre' }, 'À surveiller'),
        h('div', { class: 'cp-liste' }, aSurveiller.map((f) => h('button', { type: 'button', class: 'cp-ligne', onclick: () => choisir(f) },
          h('b', null, f.a.nom), pastille(f),
          h('span', { class: 'cp-ligne__date' }, f.etat.fin ? (f.etat.jours < 0 ? `depuis le ${isoVersFr(f.etat.fin)}` : `${isoVersFr(f.etat.fin)} · ${duree(f.etat.jours)}`) : f.etat.code === 'a-verifier' ? 'date inconnue' : ''),
          icone('suivant'))))) : h('p', { class: 'cp-note cp-note--ok' }, icone('coche'), h('span', null, 'Toutes les cartes de vos agents sont valides.')),
      nonVerifiees.length ? h('div', null, h('h3', { class: 'cp-titre' }, `Valides d’après les documents, pas encore vues sur DRACAR · ${nonVerifiees.length}`),
        h('div', { class: 'cp-chips' }, nonVerifiees.map((f) => h('button', { type: 'button', class: 'cp-chip', onclick: () => choisir(f) }, f.a.nom)))) : null);
  }

  /* ----- Tableau comme sur DRACAR ----- */
  function tableauDracar(liste, cliquable) {
    return h('div', { class: 'cp-tableau' }, h('table', { class: 'cp-dracar' },
      h('thead', null, h('tr', null, ['Nom', 'Prénom', 'NUB', 'Activité', 'Date de validité du titre', 'Validité du titre'].map((t) => h('th', null, t)))),
      h('tbody', null, liste.map((f) => h('tr', cliquable ? { class: 'is-cliquable', tabindex: 0, title: 'Voir le détail', onclick: () => choisir(f), onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); choisir(f); } } } : null,
        h('td', { 'data-l': 'Nom' }, h('b', null, f.nom)), h('td', { 'data-l': 'Prénom' }, f.prenom || '—'),
        h('td', { class: 'cp-mono', 'data-l': 'NUB' }, f.nub ? `${f.nub}${f.nubDeduit ? '*' : ''}` : '—'),
        h('td', { 'data-l': 'Activité' }, f.activite || (f.c.format === 'autre' ? 'Carte VTC (hors CNAPS)' : '—')),
        h('td', { 'data-l': 'Validité' }, isoVersFr(f.etat.fin) || '—'),
        h('td', { 'data-l': 'Titre' }, pastille(f)))))));
  }

  /* ----- Un seul agent : verdict, détail, DRACAR ----- */
  function resultat(f) {
    const e = f.etat, quand = isoVersFr(e.fin), le = isoVersFr(f.i.dracar_le);
    const V = {
      valide: [f.i.dracar === 'actif' ? 'Carte valide · active sur DRACAR' : 'Carte valide', `Jusqu’au ${quand} · encore ${duree(e.jours ?? 0)}`],
      'expire-bientot': ['Valide, mais expire bientôt', `Jusqu’au ${quand} · plus que ${duree(e.jours ?? 0)} : prévoir le renouvellement`],
      expiree: ['Carte expirée', `Depuis le ${quand} (${duree(e.jours ?? 0)}) · l’agent ne peut pas travailler`],
      falsifiee: ['Carte falsifiée', 'Document refusé : ne pas faire travailler cet agent.'],
      retiree: ['Carte retirée', `Constaté sur DRACAR le ${le} · l’agent ne peut pas travailler`],
      inactive: ['Carte inactive', `Constaté sur DRACAR le ${le} · l’agent ne peut pas travailler`],
      introuvable: ['Introuvable sur DRACAR', `Le ${le} · vérifiez le NUB et l’orthographe du nom`],
      'a-verifier': ['Date de validité inconnue', 'Vérifiez sur DRACAR, puis notez le résultat ci-dessous.'],
    }[e.code];
    const ancienneVerif = f.i.dracar_le && (Date.now() - Date.parse(f.i.dracar_le)) / 864e5 > 180;
    const source = f.i.dracar
      ? h('span', { class: `cp-source cp-source--dracar ${ancienneVerif ? 'is-ancienne' : ''}` }, icone('coche'), `Vérifiée sur DRACAR le ${le} : ${RESULTATS[f.i.dracar]?.toUpperCase() || f.i.dracar}${ancienneVerif ? ' · à refaire' : ''}`)
      : h('span', { class: 'cp-source' }, icone('devis'), 'D’après les documents reçus · pas encore vérifiée sur DRACAR');

    const officiel = formOfficiel(f);
    // Le formulaire s'ouvre seul quand la date manque, ou après « Vérifier sur DRACAR » (pour noter ce qu'on y lit)
    officiel.hidden = e.code !== 'a-verifier';
    const montrer = (oui) => { officiel.hidden = !oui; bascule.setAttribute('aria-expanded', String(oui)); };
    const bascule = h('button', { type: 'button', class: 'btn btn--ghost', 'aria-expanded': String(!officiel.hidden), onclick: () => {
      montrer(officiel.hidden);
      if (!officiel.hidden) officiel.querySelector('button')?.focus();
    } }, icone('crayon'), h('span', null, 'Noter le résultat DRACAR'));

    return h('div', { class: `cp-resultat cp-resultat--${couleur(e)}` },
      h('div', { class: 'cp-verdict' },
        h('span', { class: 'cp-sceau' }, icone(e.grave ? 'croix' : e.code === 'valide' ? 'coche' : e.code === 'a-verifier' ? 'recherche' : 'horloge')),
        h('div', { class: 'cp-verdict__txt' }, h('b', null, V[0]), h('span', null, V[1]), source)),
      tableauDracar([f], false),
      h('dl', { class: 'cp-details' },
        h('div', null, h('dt', null, 'N° de carte'), h('dd', { class: 'cp-mono' }, f.c.format === 'falsifiee' ? 'refusée (falsifiée)' : f.a.carte || '—')),
        h('div', null, h('dt', null, 'Format'), h('dd', null, { nouveau: 'Nouveau numéro (sans date)', ancien: 'Ancien numéro (date incluse)', inconnu: 'Numéro CNAPS', autre: 'Pas une carte CNAPS', aucun: 'Aucun numéro', falsifiee: '—' }[f.c.format])),
        h('div', null, h('dt', null, 'Équipe'), h('dd', null, [EQUIPE[f.a.categorie || 'primaire'], f.a.poste].filter(Boolean).join(' · ')))),
      f.nubDeduit ? h('p', { class: 'cp-petit' }, '* NUB déduit de l’ancien numéro : confirmez-le sur DRACAR.') : null,
      h('div', { class: 'cp-actions' },
        h('button', { type: 'button', class: 'btn btn--gold', onclick: () => { ouvrirDracar(nubSaisi || f.nub, f.nom); montrer(true); } }, icone('site'), h('span', null, 'Vérifier sur DRACAR')),
        bascule,
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { fermer(); location.hash = `#/agents/${f.a.id}`; } }, icone('agents'), h('span', null, 'Ouvrir la fiche'))),
      officiel);
  }

  /* ----- Résultat officiel lu sur DRACAR, enregistré sur la fiche ----- */
  function formOfficiel(f) {
    let statut = f.i.dracar || 'actif';
    const choix = Object.entries(RESULTATS).map(([k, l]) => h('button', { type: 'button', class: `cp-choix cp-choix--${k}`, dataset: { k }, 'aria-pressed': String(k === statut), onclick: () => {
      statut = k;
      choix.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === statut)));
    } }, l.toUpperCase()));
    const date = saisie({ type: 'date', value: f.etat.fin || '' });
    const activite = saisie({ value: f.activite || ACTIVITES.SH, list: 'cp-activites' });
    const enregistrer = h('button', { type: 'button', class: 'btn btn--gold', onclick: async () => {
      if (statut === 'actif' && !date.value) { toast('Indiquez la date de validité affichée par DRACAR.', 'erreur'); date.focus(); return; }
      enregistrer.disabled = true;
      try {
        const r = await api('agent.carte.verifiee', { id: f.a.id, statut, validite: date.value, activite: statut === 'introuvable' ? '' : activite.value.trim(), nub: nubSaisi || f.nub });
        f.a.validite = r.validite;
        f.a.infos = r.infos;
        modifie = true;
        toast(`Résultat DRACAR enregistré sur la fiche de ${f.a.nom}.`);
        nom.value = f.a.nom; nub.value = r.infos.nub || nub.value;
        dessiner();
      } catch (e) { erreur(e); enregistrer.disabled = false; }
    } }, icone('coche'), h('span', null, 'Enregistrer sur la fiche'));
    return h('div', { class: 'cp-officiel' },
      h('p', { class: 'cp-officiel__titre' }, `Ce que DRACAR affiche pour ${f.a.nom}`),
      h('div', { class: 'cp-choix-groupe', role: 'group', 'aria-label': 'Validité du titre' }, choix),
      h('div', { class: 'form-grille form-grille--2' }, champ('Date de validité du titre', date), champ('Activité', activite)),
      h('datalist', { id: 'cp-activites' }, LIBELLES_ACTIVITE.map((l) => h('option', { value: l }))),
      h('div', { class: 'cp-officiel__pied' }, enregistrer));
  }

  function vide(nubTape, nomTape) {
    return h('div', { class: 'cp-vide' },
      h('span', { class: 'cp-sceau' }, icone('recherche')),
      h('b', null, 'Aucun agent correspondant dans vos dossiers'),
      h('span', null, 'Seul DRACAR peut dire si cette carte existe et si elle est valide.'),
      h('button', { type: 'button', class: 'btn btn--gold', onclick: () => ouvrirDracar(nubTape, separerNom(nomTape).nom) }, icone('site'), h('span', null, 'Vérifier sur DRACAR')));
  }

  // Copie le NUB (ou le nom) puis ouvre la page DRACAR du gérant : la recherche se fait dans son espace CNAPS
  async function ouvrirDracar(n, nomFamille) {
    const texte = n || nomFamille || '';
    let copie = false;
    if (texte) { try { await navigator.clipboard.writeText(texte); copie = true; } catch { /* copie refusée par le navigateur */ } }
    window.open(lien || LIEN_CNAPS, '_blank', 'noopener');
    toast(copie ? (n ? `NUB ${n} copié : collez-le dans DRACAR${nomFamille ? `, avec le nom « ${nomFamille} »` : ''}.` : `« ${texte} » copié.`) : 'DRACAR ouvert dans un nouvel onglet.');
  }

  /* ----- Lien de la page DRACAR (une fois pour toutes) ----- */
  function dessinerLien() {
    let hote = '';
    try { hote = lien ? new URL(lien).host : ''; } catch { /* lien invalide */ }
    piedLien.replaceChildren(icone('site'),
      h('span', null, 'DRACAR s’ouvre sur ', h('b', null, hote || 'le site du CNAPS'), hote ? '' : ' · ajoutez le lien de votre page « Rechercher un agent »'),
      h('button', { type: 'button', class: 'lien-btn', onclick: modifierLien }, hote ? 'Modifier' : 'Ajouter le lien'));
  }
  function modifierLien() {
    const champLien = saisie({ type: 'url', value: lien, placeholder: 'https://… (copiez l’adresse de la page DRACAR)', onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); ok.click(); } } });
    const ok = h('button', { type: 'button', class: 'btn btn--ghost btn--petit', onclick: async () => {
      try { lien = (await api('dracar.lien', { lien: champLien.value.trim() })).lien; toast('Lien DRACAR enregistré.'); dessinerLien(); } catch (e) { erreur(e); }
    } }, 'Enregistrer');
    piedLien.replaceChildren(champLien, ok, h('button', { type: 'button', class: 'lien-btn', onclick: dessinerLien }, 'Annuler'));
    champLien.focus();
  }
  // Ferme la fenêtre (même effet que la touche Échap)
  const fermer = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

  if (agent) { const f = ficheCarte(agent); nom.value = agent.nom; nub.value = f.nub; }
  dessiner();
  dessinerLien();
  await modale({
    titre: 'Carte professionnelle',
    large: true,
    contenu: [
      h('div', { class: 'cp-champs' },
        champ('Numéro Bénéficiaire Unique (NUB)', nub, aideNub),
        champ('Nom de l’agent', nom, 'Nom, prénom ou les deux.')),
      h('datalist', { id: 'cp-noms' }, agents.map((a) => h('option', { value: a.nom }))),
      zone, piedLien,
    ],
    actions: [{ libelle: 'Fermer', classe: 'btn--ghost', valeur: null }],
  });
  if (modifie) window.dispatchEvent(new HashChangeEvent('hashchange'));
}
