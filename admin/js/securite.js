/* =========================================================
   ESPACE ADMIN BDA — Accès & sécurité
   Appareils connectés (déconnexion à distance), historique des
   connexions et journal de tout ce qui se passe dans l'espace admin.
   ========================================================= */
import { api, h, icone, toast, erreur, confirmer, ilYa } from './outils.js';

export const TYPES_JOURNAL = {
  acces: { lib: 'Accès', ic: 'cle' }, alerte: { lib: 'Alerte', ic: 'alerte' }, securite: { lib: 'Sécurité', ic: 'bouclier' },
  site: { lib: 'Site', ic: 'site' }, document: { lib: 'Documents', ic: 'devis' }, equipe: { lib: 'Équipe', ic: 'agents' },
  vtc: { lib: 'VTC', ic: 'voiture' }, systeme: { lib: 'Système', ic: 'reglages' },
};
const heure = (s) => String(s || '').slice(11, 19);
const jourCourt = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
const dateHeure = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} à ${s.slice(11, 16)}` : '—');
const mobile = (a) => /iPhone|Android|iPad/.test(a || '');
const FIN = { '': 'En cours', deconnexion: 'Déconnexion', expiree: 'Expirée (inactivité)', 'déconnecté à distance': 'Déconnecté à distance', 'mot de passe changé': 'Mot de passe changé', 'mot de passe réinitialisé': 'Mot de passe réinitialisé' };

// Ligne du journal façon console : [25/09 14:03:12] ACCÈS  Connexion de abdel
export function ligneJournal(j, complet) {
  const T = TYPES_JOURNAL[j.type] || { lib: j.type, ic: 'suivant' };
  return h('li', { class: `console__ligne console__ligne--${j.type}` },
    h('time', { datetime: j.quand }, `${jourCourt(j.quand)} ${heure(j.quand)}`),
    h('span', { class: 'console__type' }, T.lib),
    h('span', { class: 'console__msg' }, j.message, complet && (j.appareil || j.ip) ? h('small', null, [j.appareil, j.ip].filter(Boolean).join(' · ')) : null));
}

export async function pageSecurite(ctx) {
  ctx.titre('Accès & sécurité');
  const [{ actifs, historique, alertes30j }, { journal }, { appareils: telephonesChef }] = await Promise.all([api('connexions'), api('journal'), api('chef.appareils').catch(() => ({ appareils: [] }))]);
  const moi = actifs.find((c) => c.actuel);

  /* ----- Indicateurs ----- */
  const tuile = (ic, titre, valeur, sous, cls = '') => h('div', { class: `tuile ${cls}` }, h('span', { class: 'tuile__ic' }, icone(ic)), h('div', null, h('small', null, titre), h('b', null, valeur), sous ? h('span', null, sous) : null));
  const tuiles = h('div', { class: 'tuiles' },
    tuile('bouclier', 'Niveau d’accès', 'Administrateur', 'Accès total au site et aux données', 'tuile--or'),
    tuile('appareil', 'Appareils connectés', String(actifs.length), actifs.length > 1 ? 'Vérifiez qu’ils sont bien à vous' : 'Seulement cet appareil'),
    tuile('alerte', 'Tentatives refusées (30 j)', String(alertes30j), alertes30j ? 'Mauvais mot de passe saisi' : 'Aucune tentative suspecte', alertes30j ? 'tuile--alerte' : 'tuile--ok'),
    tuile('horloge', 'Session ouverte', moi ? dateHeure(moi.debut) : '—', moi ? moi.appareil : ''));

  /* ----- Appareils connectés ----- */
  const deconnecter = async (id, lib) => {
    if (!(await confirmer(id === 'autres' ? 'Déconnecter tous les autres appareils ? Ils devront se reconnecter avec le mot de passe.' : `Déconnecter « ${lib} » ?`, { ok: 'Déconnecter', danger: true }))) return;
    try { await api('connexion.revoquer', { id }); toast(id === 'autres' ? 'Les autres appareils sont déconnectés.' : 'Appareil déconnecté.'); pageSecurite(ctx); } catch (e) { erreur(e); }
  };
  const appareils = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Appareils connectés'), h('small', null, 'Actifs ces 6 dernières heures')),
    h('ul', { class: 'appareils' }, actifs.map((c) => h('li', { class: `appareil ${c.actuel ? 'is-actuel' : ''}` },
      h('span', { class: 'appareil__ic' }, icone(mobile(c.appareil) ? 'mobile' : 'appareil')),
      h('div', { class: 'appareil__txt' }, h('b', null, c.appareil), h('small', null, `IP ${c.ip || 'inconnue'} · connecté le ${dateHeure(c.debut)} · actif ${ilYa(c.vu)}`)),
      c.actuel ? h('span', { class: 'pastille pastille--publie' }, 'Cet appareil') : h('button', { class: 'btn btn--danger-ghost btn--petit', type: 'button', onclick: () => deconnecter(c.id, c.appareil) }, icone('sortie'), 'Déconnecter')))),
    actifs.length > 1 ? h('div', null, h('button', { class: 'btn btn--danger-ghost', type: 'button', onclick: () => deconnecter('autres') }, icone('cadenas'), 'Déconnecter tous les autres appareils')) : null,
    h('p', { class: 'astuce' }, 'Un appareil que vous ne reconnaissez pas ? Déconnectez-le, puis changez votre mot de passe dans Paramètres : tous les autres appareils seront aussi déconnectés.'));

  /* ----- Historique des connexions ----- */
  const histo = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Historique des connexions'), h('small', null, '30 dernières')),
    h('div', { class: 'tableau-defil' }, h('table', { class: 'tableau' },
      h('thead', null, h('tr', null, h('th', null, 'Connexion'), h('th', null, 'Appareil'), h('th', null, 'Adresse IP'), h('th', null, 'Dernière activité'), h('th', null, 'Fin'))),
      h('tbody', null, historique.map((c) => h('tr', null,
        h('td', { class: 'mono' }, dateHeure(c.debut)), h('td', null, c.appareil), h('td', { class: 'mono' }, c.ip || '—'), h('td', { class: 'mono' }, dateHeure(c.vu)),
        h('td', null, c.fin === '' ? h('span', { class: 'pastille pastille--publie' }, 'En cours') : h('span', { class: 'muet' }, FIN[c.fin] || c.fin))))))));

  /* ----- Journal ----- */
  let filtre = '', lignes = journal;
  const console_ = h('ol', { class: 'console', 'aria-live': 'polite' });
  const plus = h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => {
    try { const { journal: suite } = await api('journal', undefined, { type: filtre, avant: lignes[lignes.length - 1]?.id || 0 }); lignes = lignes.concat(suite); dessinerJournal(suite.length < 60); } catch (e) { erreur(e); }
  } }, 'Afficher plus');
  const chips = h('div', { class: 'chips' });
  function dessinerChips() {
    chips.replaceChildren(...[['', 'Tout'], ...Object.entries(TYPES_JOURNAL).map(([k, v]) => [k, v.lib])].map(([k, lib]) => h('button', { type: 'button', class: `chip ${filtre === k ? 'is-actif' : ''}`, onclick: async () => {
      filtre = k; dessinerChips();
      try { ({ journal: lignes } = await api('journal', undefined, { type: k })); dessinerJournal(lignes.length < 60); } catch (e) { erreur(e); }
    } }, lib)));
  }
  function dessinerJournal(fin) {
    console_.replaceChildren(...(lignes.length ? lignes.map((j) => ligneJournal(j, true)) : [h('li', { class: 'console__vide' }, '— aucune activité enregistrée —')]));
    plus.hidden = !!fin;
  }
  const journalCarte = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Journal d’activité'), h('small', null, 'Tout ce qui se passe dans l’espace admin')),
    chips, h('div', { class: 'console-cadre' }, h('div', { class: 'console-cadre__barre', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('span', null, 'bda-admin — journal')), console_), h('div', null, plus),
    h('p', { class: 'astuce' }, 'Les adresses IP sont enregistrées sans leur dernier bloc. Le journal garde un an d’historique.'));

  /* ----- Téléphones qui ouvrent « Mon accès chef » sans mot de passe ----- */
  const chef = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Ouverture directe de ma carte'), h('small', null, 'Mon accès chef, sans mot de passe')),
    telephonesChef.length ? h('ul', { class: 'appareils' }, telephonesChef.map((c) => h('li', { class: 'appareil' },
      h('span', { class: 'appareil__ic' }, icone(mobile(c.appareil) ? 'mobile' : 'appareil')),
      h('div', { class: 'appareil__txt' }, h('b', null, c.appareil || 'Appareil'), h('small', null, `activé le ${dateHeure(c.cree)} · dernière ouverture ${ilYa(c.vu)}`)),
      h('button', { class: 'btn btn--danger-ghost btn--petit', type: 'button', onclick: async () => {
        if (!(await confirmer(`Retirer l’ouverture directe sur « ${c.appareil} » ? Ce téléphone demandera de nouveau le mot de passe.`, { ok: 'Retirer', danger: true }))) return;
        try { await api('chef.revoquer', { id: c.id }); toast('Ouverture directe retirée.'); pageSecurite(ctx); } catch (e) { erreur(e); }
      } }, icone('croix'), 'Retirer'))))
      : h('p', { class: 'astuce' }, 'Aucun téléphone. Ouvrez « Mon accès chef » sur votre téléphone : il sera mémorisé pour ouvrir votre carte directement.'),
    h('p', { class: 'astuce' }, 'Ces téléphones voient uniquement votre carte pro, jamais le reste de l’espace admin. Changer de mot de passe les retire tous.'));

  ctx.afficher(tuiles, h('div', { class: 'grille-2' }, appareils, journalCarte), h('div', { class: 'grille-2' }, histo, chef));
  dessinerChips();
  dessinerJournal(journal.length < 60);
}
