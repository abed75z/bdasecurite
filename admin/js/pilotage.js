/* =========================================================
   ESPACE ADMIN BDA — Pilotage (administrateurs)
   Les chiffres du gérant sur une page : chiffre d'affaires facturé mois par mois,
   argent encaissé, en attente et en retard, devis en cours, heures vendues
   (planning des sites), remplissage des 30 prochains jours, meilleurs clients,
   prospection et équipe. Montants des factures tels qu'enregistrés (TTC si TVA).
   ========================================================= */
import { api, h, icone, MOIS, cap } from './outils.js';
import { metriques, barres, repartition } from './graphiques.js';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nb = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
// étiquette courte sous les barres (« janv. 26 »), le mois complet dans la bulle
const courtMois = (m) => { const [y, mo] = m.split('-').map(Number); return `${MOIS[mo - 1].slice(0, mo === 6 || mo === 7 ? 4 : 3)}. ${String(y).slice(2)}`; };
const libMois = (m) => { const [y, mo] = m.split('-').map(Number); return `${cap(MOIS[mo - 1])} ${y}`; };

export async function pagePilotage(ctx) {
  ctx.titre('Pilotage');
  const d = await api('pilotage');
  if (!ctx.actuel()) return;
  ctx.actions(
    h('a', { class: 'btn btn--ghost', href: '#/factures' }, icone('facture'), h('span', null, 'Factures')),
    h('a', { class: 'btn btn--ghost', href: '#/controle' }, icone('direct'), h('span', null, 'Centre de contrôle')));

  const iMois = d.mois.length - 3; // mois en cours (les 2 derniers sont à venir)
  const caMois = d.ca[iMois] || 0;
  const caPrec = d.ca[iMois - 1] || 0;
  const ca12 = d.ca.slice(0, iMois + 1).reduce((s, v) => s + v, 0);
  const evol = caPrec ? Math.round(((caMois - caPrec) / caPrec) * 100) : null;
  const hMois = d.heures[iMois] || 0;
  const remp = d.remplissage.postes ? Math.round((d.remplissage.pourvus / d.remplissage.postes) * 100) : null;
  const p = d.pistes;
  const enDiscussion = (p.contacte || 0) + (p.interesse || 0) + (p.devis || 0);

  const chiffres = metriques([
    { libelle: 'Facturé ce mois', valeur: euro.format(caMois), sous: evol === null ? 'factures envoyées ou payées' : `${evol >= 0 ? '+' : ''}${evol} % par rapport au mois dernier`, ton: evol !== null && evol < 0 ? 'attention' : '' },
    { libelle: 'Facturé sur 12 mois', valeur: euro.format(ca12), sous: `moyenne ${euro.format(ca12 / 12)} par mois` },
    { libelle: 'Encaissé (12 mois)', valeur: euro.format(d.factures.payee || 0), ton: 'ok', href: '#/factures' },
    { libelle: 'En attente de paiement', valeur: euro.format(d.factures.attente || 0), sous: d.factures.retard ? `dont ${euro.format(d.factures.retard)} en retard` : 'aucun retard', ton: d.factures.retard ? 'alerte' : '', href: '#/factures' },
    { libelle: 'Devis envoyés en attente', valeur: euro.format(d.devis.t), sous: `${d.devis.n} devis`, href: '#/devis' },
    { libelle: 'Heures planifiées ce mois', valeur: `${nb.format(hMois)} h`, sous: 'planning des sites', href: '#/exploitation' },
  ]);

  const graphCa = h('section', { class: 'carte pi-graph' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Chiffre d’affaires facturé'), h('small', null, '12 derniers mois')),
    barres(d.mois.slice(0, iMois + 1).map((m, i) => ({ libelle: libMois(m), court: courtMois(m), valeur: d.ca[i] })), { format: (v) => euro.format(v), entier: false, titre: 'Chiffre d’affaires par mois', hauteur: 210 }));
  const graphH = h('section', { class: 'carte pi-graph' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Heures planifiées'), h('small', null, 'postes pourvus, avec les 2 prochains mois')),
    barres(d.mois.map((m, i) => ({ libelle: libMois(m), court: courtMois(m), valeur: d.heures[i] })), { format: (v) => `${nb.format(v)} h`, entier: true, titre: 'Heures planifiées par mois', hauteur: 210 }));

  const jauge = (titre, valeur, total, texte, lien) => {
    const pc = total ? Math.round((valeur / total) * 100) : 0;
    return h('a', { class: 'carte pi-jauge', href: lien },
      h('span', { class: 'pi-jauge__titre' }, titre),
      h('span', { class: 'pi-jauge__anneau', style: `--pc: ${pc}` }, h('b', null, total ? `${pc} %` : '—')),
      h('small', null, texte));
  };
  const jauges = h('div', { class: 'pi-jauges' },
    jauge('Remplissage du planning', d.remplissage.pourvus, d.remplissage.postes, d.remplissage.postes ? `${d.remplissage.pourvus} postes pourvus sur ${d.remplissage.postes} (30 jours)` : 'Aucun poste prévu sur 30 jours', '#/exploitation'),
    jauge('Factures encaissées', d.factures.payee || 0, (d.factures.payee || 0) + (d.factures.attente || 0), `${euro.format(d.factures.attente || 0)} restent à encaisser`, '#/factures'),
    jauge('Prospection convertie', p.client || 0, (p.client || 0) + enDiscussion + (p.refus || 0), `${p.client || 0} client${(p.client || 0) > 1 ? 's' : ''} signé${(p.client || 0) > 1 ? 's' : ''} grâce au robot`, '#/opportunites'));

  const clients = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Meilleurs clients'), h('small', null, '12 derniers mois')),
    repartition(d.top.map((c) => ({ libelle: c.client, sous: `${c.n} facture${c.n > 1 ? 's' : ''}`, valeur: +c.t })), { format: (v) => euro.format(v), vide: 'Aucune facture envoyée sur 12 mois.' }));
  const prospection = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Prospection'), h('a', { class: 'lien-btn', href: '#/opportunites' }, 'Trouver des clients')),
    repartition([
      { libelle: 'Contactés', valeur: p.contacte || 0 }, { libelle: 'Intéressés', valeur: p.interesse || 0 }, { libelle: 'Devis envoyés', valeur: p.devis || 0 },
      { libelle: 'Clients signés', valeur: p.client || 0 }, { libelle: 'Appels d’offres ouverts', valeur: d.ao },
    ], { format: (v) => nb.format(v), vide: 'Aucun contact noté pour l’instant : marquez vos appels dans « Trouver des clients ».' }));
  const equipe = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Équipe'), h('a', { class: 'lien-btn', href: '#/agents' }, 'Agents')),
    h('div', { class: 'pi-equipe' },
      h('div', null, h('b', null, nb.format(d.equipe.actifs)), h('span', null, 'agents actifs')),
      h('div', null, h('b', null, nb.format(d.equipe.enPoste)), h('span', null, 'en poste maintenant')),
      h('div', null, h('b', null, nb.format(d.equipe.secours)), h('span', null, 'agents de secours')),
      h('div', { class: d.equipe.cartes ? 'is-attention' : '' }, h('b', null, nb.format(d.equipe.cartes)), h('span', null, 'cartes pro à renouveler'))));

  ctx.afficher(chiffres, jauges, h('div', { class: 'pi-grille' }, graphCa, graphH), h('div', { class: 'pi-grille pi-grille--3' }, clients, prospection, equipe),
    h('p', { class: 'muet pi-note' }, 'Montants des factures envoyées ou payées, tels qu’enregistrés dans l’admin. Les brouillons ne comptent pas.' + (d.factures.brouillons ? ` ${d.factures.brouillons} facture${d.factures.brouillons > 1 ? 's' : ''} en brouillon.` : '')));
}
