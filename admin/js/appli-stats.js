/* =========================================================
   ESPACE ADMIN BDA — Application VTC : Paiements et Statistiques
   Lecture seule : ces deux pages lisent les courses avec l'action
   « courses » de appli-api.php (fichier de l'appli) et ne modifient rien.
   L'action renvoie 500 courses au plus par appel : la période est
   donc lue par tranches de 31 jours.
   ========================================================= */
import { h, euro, euroRond, nombre, pad, iso, toast, ErreurApi } from './outils.js';
import { metriques, segments, barres, courbe, repartition } from './graphiques.js';

async function lire(action, params = {}) {
  const qs = new URLSearchParams({ a: action, ...params }).toString();
  let res;
  try { res = await fetch(`appli-api.php?${qs}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } }); }
  catch (e) { throw new ErreurApi('Connexion impossible. Vérifiez votre accès à internet.', 0); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new ErreurApi(json.erreur || `Erreur ${res.status}`, res.status);
  return json;
}
const date = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
const heureDe = (s) => Number(String(s).slice(11, 13));
const LIMITE = 500;

// Toutes les courses de la période, tranche par tranche
async function coursesPeriode(du, au) {
  const tranches = [];
  for (let d = date(du), fin = date(au); d <= fin;) {
    const f = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 30);
    const bout = f > fin ? fin : f;
    tranches.push([iso(d), iso(bout)]);
    d = new Date(bout.getFullYear(), bout.getMonth(), bout.getDate() + 1);
  }
  const res = await Promise.all(tranches.map(([a, b]) => lire('courses', { du: a, au: b })));
  const courses = res.flatMap((r) => r.courses).sort((a, b) => String(b.quand).localeCompare(String(a.quand)));
  return { courses, incomplet: res.some((r) => r.courses.length >= LIMITE) };
}

const PERIODES = [['7', '7 jours'], ['30', '30 jours'], ['90', '90 jours'], ['365', '12 mois']];
function periodeMemo(v) {
  try { if (v) sessionStorage.setItem('bda-periode-appli', v); return sessionStorage.getItem('bda-periode-appli') || '30'; } catch (e) { return v || '30'; }
}
const fourchette = (jours) => { const au = new Date(); const du = new Date(au.getFullYear(), au.getMonth(), au.getDate() - (Number(jours) - 1)); return [iso(du), iso(au)]; };
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const jj = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

// Découpe la période en jours, semaines ou mois selon sa longueur
function decoupage(du, au) {
  const d0 = date(du), d1 = date(au);
  const jours = Math.round((d1 - d0) / 86400000) + 1;
  const seaux = [];
  if (jours <= 31) {
    for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) seaux.push({ cle: iso(d), libelle: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }), court: jours <= 7 ? d.toLocaleDateString('fr-FR', { weekday: 'short' }) : String(d.getDate()) });
    return { seaux, cle: (s) => String(s).slice(0, 10), unite: 'jour' };
  }
  if (jours <= 120) {
    const lundi = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
    for (let d = lundi(d0); d <= d1; d.setDate(d.getDate() + 7)) seaux.push({ cle: iso(d), libelle: `Semaine du ${jj(d)}`, court: jj(d) });
    return { seaux, cle: (s) => iso(lundi(date(s))), unite: 'semaine' };
  }
  for (let d = new Date(d0.getFullYear(), d0.getMonth(), 1); d <= d1; d.setMonth(d.getMonth() + 1)) seaux.push({ cle: iso(d).slice(0, 7), libelle: `${MOIS_COURT[d.getMonth()]} ${d.getFullYear()}`, court: MOIS_COURT[d.getMonth()] });
  return { seaux, cle: (s) => String(s).slice(0, 7), unite: 'mois' };
}
function serie(courses, dec, valeur) {
  const t = Object.fromEntries(dec.seaux.map((s) => [s.cle, 0]));
  for (const c of courses) { const k = dec.cle(c.quand); if (k in t) t[k] += valeur(c); }
  return dec.seaux.map((s) => ({ libelle: s.libelle, court: s.court, valeur: Math.round(t[s.cle] * 100) / 100 }));
}

const carte = (titre, sous, ...contenu) => h('section', { class: 'carte' }, h('header', { class: 'carte__tete' }, h('h2', null, titre), sous ? h('small', null, sous) : null), contenu);
const termine = (c) => c.statut === 'terminee';
const annulee = (c) => c.statut === 'annulee' || c.statut === 'absent';
const somme = (l, f) => l.reduce((s, c) => s + f(c), 0);
const nomClient = (c) => (c.client ? `${c.client.prenom} ${c.client.nom || ''}`.trim() : '—');
const jourHeure = (s) => { const d = new Date(String(s).replace(' ', 'T')); return `${jj(d)}/${d.getFullYear()} ${pad(d.getHours())}h${pad(d.getMinutes())}`; };

// Page avec le choix de période en tête ; « dessiner » remplit la zone
function pagePeriode(ctx, titre, dessiner) {
  ctx.titre(titre);
  let periode = periodeMemo();
  const zone = h('div', { class: 'pile' });
  const resume = h('span', { class: 'barre-outils__info' });
  const charger = async () => {
    zone.replaceChildren(h('div', { class: 'chargement' }, h('span'), h('span'), h('span')));
    const [du, au] = fourchette(periode);
    resume.textContent = `Du ${jj(date(du))}/${date(du).getFullYear()} au ${jj(date(au))}/${date(au).getFullYear()}`;
    try {
      const { courses, incomplet } = await coursesPeriode(du, au);
      if (!ctx.actuel()) return;
      zone.replaceChildren(...[incomplet ? h('p', { class: 'encart encart--alerte' }, 'Plus de 500 courses sur une tranche de 31 jours : les chiffres ci-dessous sont incomplets.') : null, ...dessiner(courses, du, au)].filter(Boolean));
    } catch (e) {
      if (e.statut === 401) return;
      zone.replaceChildren(h('p', { class: 'encart encart--alerte' }, e.message));
    }
  };
  ctx.afficher(h('div', { class: 'barre-outils' }, segments(PERIODES, periode, (v) => { periode = periodeMemo(v); charger(); }, 'Période'), resume), zone);
  charger();
}

/* =========================================================
   PAIEMENTS : montants des courses terminées, à encaisser à bord
   ========================================================= */
export function pagePaiements(ctx) {
  pagePeriode(ctx, 'Paiements', (courses) => {
    const faites = courses.filter(termine);
    const total = somme(faites, (c) => c.total);
    const absents = courses.filter((c) => c.statut === 'absent').length;

    const parChauffeur = new Map();
    for (const c of faites) {
      const k = c.chauffeur ? c.chauffeur.id : 0;
      const e = parChauffeur.get(k) || { nom: c.chauffeur ? c.chauffeur.nom : 'Sans chauffeur', n: 0, total: 0, protection: 0, remise: 0 };
      e.n += 1; e.total += c.total; e.protection += c.protection; e.remise += c.remise;
      parChauffeur.set(k, e);
    }
    const lignesChauffeurs = [...parChauffeur.values()].sort((a, b) => b.total - a.total);
    const montrees = faites.slice(0, 200);

    const exporter = () => {
      if (!faites.length) { toast('Aucune course terminée sur la période.', 'erreur'); return; }
      const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const num = (v) => String(Math.round(v * 100) / 100).replace('.', ',');
      const lignes = [['Date', 'Course', 'Client', 'Chauffeur', 'Gamme', 'Transport', 'Remise', 'Garde du corps', 'Total TTC', 'Paiement'].map(cel).join(';')]
        .concat(faites.slice().reverse().map((c) => [jourHeure(c.quand), c.numero, nomClient(c), c.chauffeur ? c.chauffeur.nom : '', c.gammeNom, num(c.transport), num(c.remise), num(c.protection), num(c.total), 'À bord'].map(cel).join(';')));
      const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + lignes.join('\r\n')], { type: 'text/csv;charset=utf-8' })), download: 'Paiements appli BDASH.csv' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    };

    return [
      h('div', { class: 'encart' }, h('b', null, 'Paiement à bord, pas encore de paiement dans l’appli. '),
        'Le client règle le chauffeur à la fin de la course. Les montants ci-dessous sont ceux des courses terminées, à encaisser à bord : aucun paiement n’est enregistré par l’appli.'),
      metriques([
        { libelle: 'Montant des courses terminées', valeur: euro.format(total), sous: 'TTC, à encaisser à bord' },
        { libelle: 'Courses terminées', valeur: String(faites.length), sous: absents ? `${absents} client${absents > 1 ? 's' : ''} absent${absents > 1 ? 's' : ''}` : 'Aucun client absent' },
        { libelle: 'Montant moyen', valeur: faites.length ? euro.format(total / faites.length) : '—', sous: 'par course terminée' },
        { libelle: 'Remises (codes promo)', valeur: euro.format(somme(faites, (c) => c.remise)), sous: `${faites.filter((c) => c.remise > 0).length} course(s)` },
        { libelle: 'Garde du corps VIP', valeur: euro.format(somme(faites, (c) => c.protection)), sous: 'inclus dans le montant' },
      ]),
      carte('Par chauffeur', `${lignesChauffeurs.length} chauffeur${lignesChauffeurs.length > 1 ? 's' : ''}`,
        lignesChauffeurs.length ? h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
          h('thead', null, h('tr', null, h('th', null, 'Chauffeur'), h('th', { class: 'num' }, 'Courses'), h('th', { class: 'num' }, 'Montant TTC'), h('th', { class: 'num' }, 'Dont garde du corps'), h('th', { class: 'num' }, 'Remises'), h('th', { class: 'num' }, 'Part'))),
          h('tbody', null, lignesChauffeurs.map((e) => h('tr', null,
            h('td', null, h('b', null, e.nom)), h('td', { class: 'num' }, String(e.n)), h('td', { class: 'num' }, h('b', null, euro.format(e.total))),
            h('td', { class: 'num' }, euro.format(e.protection)), h('td', { class: 'num' }, euro.format(e.remise)),
            h('td', { class: 'num' }, total ? `${nombre.format(Math.round((e.total / total) * 1000) / 10)} %` : '—'))))))
          : h('p', { class: 'gr-vide' }, 'Aucune course terminée sur la période.')),
      carte('Courses terminées', faites.length > montrees.length ? `${montrees.length} dernières sur ${faites.length}` : `${faites.length} sur la période`,
        h('div', { class: 'carte__barre' }, h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: exporter }, 'Exporter (Excel)')),
        montrees.length ? h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
          h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Course'), h('th', null, 'Client'), h('th', null, 'Chauffeur'), h('th', null, 'Gamme'), h('th', { class: 'num' }, 'Transport'), h('th', { class: 'num' }, 'Remise'), h('th', { class: 'num' }, 'Garde du corps'), h('th', { class: 'num' }, 'Total TTC'), h('th', null, 'Paiement'))),
          h('tbody', null, montrees.map((c) => h('tr', null,
            h('td', { class: 'nowrap' }, jourHeure(c.quand)), h('td', null, h('span', { class: 'mono' }, c.numero)), h('td', null, nomClient(c)), h('td', null, c.chauffeur ? c.chauffeur.nom : '—'), h('td', null, c.gammeNom),
            h('td', { class: 'num' }, euro.format(c.transport)), h('td', { class: 'num' }, c.remise ? `−${euro.format(c.remise)}` : '—'), h('td', { class: 'num' }, c.protection ? euro.format(c.protection) : '—'),
            h('td', { class: 'num' }, h('b', null, euro.format(c.total))), h('td', null, h('span', { class: 'pastille pastille--brouillon' }, 'À bord')))))))
          : h('p', { class: 'gr-vide' }, 'Aucune course terminée sur la période.')),
    ];
  });
}

/* =========================================================
   STATISTIQUES : activité de l'appli sur la période
   ========================================================= */
export function pageStatistiques(ctx) {
  pagePeriode(ctx, 'Statistiques', (courses, du, au) => {
    const faites = courses.filter(termine);
    const annulees = courses.filter(annulee);
    const ca = somme(faites, (c) => c.total);
    const notees = faites.filter((c) => c.note);
    const immediates = faites.filter((c) => c.immediate && c.accepte && c.cree);
    const delai = immediates.length ? somme(immediates, (c) => (new Date(c.accepte.replace(' ', 'T')) - new Date(c.cree.replace(' ', 'T'))) / 1000) / immediates.length : null;
    const dec = decoupage(du, au);
    const parUnite = { jour: 'par jour', semaine: 'par semaine', mois: 'par mois' }[dec.unite];

    const gammes = new Map();
    for (const c of faites) { const g = gammes.get(c.gammeNom) || { n: 0, ca: 0 }; g.n += 1; g.ca += c.total; gammes.set(c.gammeNom, g); }
    const heures = Array.from({ length: 24 }, (_, i) => ({ libelle: `${pad(i)}h – ${pad((i + 1) % 24)}h`, court: i % 3 === 0 ? `${i}h` : '', valeur: 0 }));
    for (const c of faites) heures[heureDe(c.quand)].valeur += 1;

    const chauffeurs = new Map();
    for (const c of faites) {
      if (!c.chauffeur) continue;
      const e = chauffeurs.get(c.chauffeur.id) || { nom: c.chauffeur.nom, n: 0, ca: 0, km: 0, notes: 0, nbNotes: 0 };
      e.n += 1; e.ca += c.total; e.km += c.km; if (c.note) { e.notes += c.note; e.nbNotes += 1; }
      chauffeurs.set(c.chauffeur.id, e);
    }
    const virgule = (n, d = 1) => nombre.format(Math.round(n * 10 ** d) / 10 ** d);

    return [
      metriques([
        { libelle: 'Courses terminées', valeur: String(faites.length), sous: `${courses.length} commandée${courses.length > 1 ? 's' : ''} sur la période` },
        { libelle: 'Chiffre d’affaires', valeur: euroRond.format(ca), sous: 'TTC, courses terminées' },
        { libelle: 'Taux d’annulation', valeur: faites.length + annulees.length ? `${virgule((annulees.length / (faites.length + annulees.length)) * 100)} %` : '—', sous: `${annulees.length} annulée${annulees.length > 1 ? 's' : ''} ou client absent`, ton: annulees.length && annulees.length / (faites.length + annulees.length) > 0.15 ? 'alerte' : null },
        { libelle: 'Note moyenne', valeur: notees.length ? `${virgule(somme(notees, (c) => c.note) / notees.length, 2)} / 5` : '—', sous: `${notees.length} avis` },
        { libelle: 'Délai d’acceptation', valeur: delai === null ? '—' : delai < 90 ? `${Math.round(delai)} s` : `${virgule(delai / 60)} min`, sous: 'moyenne, courses immédiates' },
      ]),
      h('div', { class: 'grille-2' },
        carte('Courses terminées', parUnite, barres(serie(faites, dec, () => 1), { titre: `Courses terminées ${parUnite}` })),
        carte('Chiffre d’affaires', `TTC ${parUnite}`, courbe(serie(faites, dec, (c) => c.total), { format: (v) => euroRond.format(v), titre: `Chiffre d’affaires ${parUnite}` }))),
      h('div', { class: 'grille-2' },
        carte('Par gamme', 'Chiffre d’affaires et nombre de courses',
          repartition([...gammes.entries()].sort((a, b) => b[1].ca - a[1].ca).map(([nom, g]) => ({ libelle: nom, sous: `${g.n} course${g.n > 1 ? 's' : ''}`, valeur: g.ca })), { format: (v) => euroRond.format(v) })),
        carte('Heures de prise en charge', 'Courses terminées selon l’heure', barres(heures, { titre: 'Courses terminées selon l’heure de prise en charge', hauteur: 170 }))),
      carte('Chauffeurs', `${chauffeurs.size} actif${chauffeurs.size > 1 ? 's' : ''} sur la période`,
        chauffeurs.size ? h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
          h('thead', null, h('tr', null, h('th', null, 'Chauffeur'), h('th', { class: 'num' }, 'Courses'), h('th', { class: 'num' }, 'Chiffre d’affaires'), h('th', { class: 'num' }, 'Distance'), h('th', { class: 'num' }, 'Note moyenne'))),
          h('tbody', null, [...chauffeurs.values()].sort((a, b) => b.n - a.n).map((e) => h('tr', null,
            h('td', null, h('b', null, e.nom)), h('td', { class: 'num' }, String(e.n)), h('td', { class: 'num' }, euro.format(e.ca)),
            h('td', { class: 'num' }, `${virgule(e.km)} km`), h('td', { class: 'num' }, e.nbNotes ? `${virgule(e.notes / e.nbNotes, 2)} (${e.nbNotes})` : '—'))))))
          : h('p', { class: 'gr-vide' }, 'Aucune course terminée sur la période.')),
    ];
  });
}
