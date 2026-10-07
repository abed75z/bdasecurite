/* =========================================================
   ESPACE ADMIN BDA — Opportunités (veille commerciale)
   Appels d'offres BOAMP (sécurité, chauffeur) et recrutements France Travail,
   triés par date limite. Statut à traiter / contacté / ignoré et note libre.
   Notifications sur téléphone : page Notifications. Réglages des secrets (admin).
   ========================================================= */
import { api, h, icone, toast, erreur, modale, champ, saisie, zoneTexte, dateLisible, ilYa, attendre } from './outils.js';

const TYPES = [['tout', 'Tout'], ['securite', '🛡️ Sécurité'], ['chauffeur', '🚘 Chauffeur'], ['recrutement', '👥 Recrutements']];
const STATUTS = [['a_traiter', 'À traiter'], ['contacte', 'Contactés'], ['ignore', 'Ignorés'], ['tous', 'Tous']];
const NIVEAUX = { fort: ['🟢', 'Très pertinent'], moyen: ['🟡', 'À regarder'], faible: ['⚪', 'Faible'] };
const SOURCES = { boamp: "Appels d'offres (BOAMP)", francetravail: 'Recrutements (France Travail)' };
const euros = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const filtres = { type: 'tout', statut: 'a_traiter', faibles: true, q: '' };
try { Object.assign(filtres, JSON.parse(localStorage.getItem('bda-opp-filtres') || '{}')); } catch (e) { /* navigation privée */ }
const memoriser = () => { try { localStorage.setItem('bda-opp-filtres', JSON.stringify(filtres)); } catch (e) { /* rien */ } };

const sansAccents = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
function joursRestants(limite) {
  if (!limite) return null;
  const j = new Date(limite.slice(0, 10) + 'T00:00:00');
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  return Math.round((j - auj) / 864e5);
}

export async function pageOpportunites(ctx) {
  ctx.titre('Opportunités');
  const cible = Number(ctx.params[0]) || 0;
  const d = await api('opportunites');
  if (!ctx.actuel()) return;
  ctx.compteurs?.();
  const recharger = () => pageOpportunites(ctx);

  ctx.actions(
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => reglages(recharger) }, icone('reglages'), h('span', null, 'Réglages')),
    h('a', { class: 'btn btn--ghost', href: '#/notifications' }, icone('mobile'), h('span', null, 'Notifications')),
    h('button', { class: 'btn btn--gold', type: 'button', onclick: (e) => lancer(e.currentTarget, recharger) }, icone('eclair'), h('span', null, 'Lancer maintenant')));

  const liste = d.opportunites;
  const vuAvant = d.vuAvant || '';

  /* ----- Bandeau d'état des sources ----- */
  const etat = d.etat || {};
  const sources = Object.entries(SOURCES).map(([k, lib]) => {
    const s = etat.sources?.[k];
    const config = k === 'francetravail' && !d.franceTravail;
    const ok = s ? s.ok : null;
    return h('div', { class: `op-source ${ok === false || config ? 'is-ko' : ok ? 'is-ok' : ''}` },
      h('i', { class: 'op-point' }),
      h('div', null, h('b', null, lib),
        h('small', null, config ? 'Identifiants à configurer dans Réglages.' : !s ? 'Pas encore lancée.' : `${s.ok ? `${s.nouveaux} nouveau(x)` : 'Erreur'} · ${ilYa(s.quand)}`),
        s && !s.ok ? h('p', { class: 'op-erreur' }, s.message) : null));
  });
  const notif = etat.notifications?.discord;
  const derniere = etat.derniere;
  const bandeau = h('section', { class: 'op-bandeau' },
    h('div', { class: 'op-bandeau__tete' },
      h('div', null, h('p', { class: 'op-surtitre' }, 'Veille commerciale · Île-de-France'), h('h2', null, 'Vos ', h('em', null, 'opportunités'))),
      h('p', { class: 'op-derniere' }, derniere ? `Dernière collecte ${ilYa(derniere.quand)} (${derniere.origine === 'manuel' ? 'manuelle' : 'automatique'}, ${derniere.duree} s)` : 'Aucune collecte pour le moment : cliquez sur « Lancer maintenant ».')),
    h('div', { class: 'op-sources' }, sources,
      h('div', { class: `op-source ${!d.discord || notif?.ok === false ? 'is-ko' : 'is-ok'}` }, h('i', { class: 'op-point' }),
        h('div', null, h('b', null, 'Discord'), h('small', null, !d.discord ? 'Webhook à configurer dans Réglages.' : notif?.ok === false ? 'Erreur d’envoi' : 'Alertes actives'),
          notif?.ok === false ? h('p', { class: 'op-erreur' }, notif.message) : null)),
      h('div', { class: `op-source ${d.abonnements ? 'is-ok' : ''}` }, h('i', { class: 'op-point' }),
        h('div', null, h('b', null, 'Téléphone'), h('small', null, d.abonnements ? `${d.abonnements} appareil(s) abonné(s)` : 'Notifications non activées')))));

  /* ----- Filtres ----- */
  const compter = (fn) => liste.filter(fn).length;
  const ouverts = (o) => o.statut !== 'ignore' && (joursRestants(o.date_limite) ?? 0) >= 0;
  const stats = h('div', { class: 'op-stats' },
    h('div', null, h('b', null, compter((o) => o.statut === 'a_traiter')), h('span', null, 'à traiter')),
    h('div', { class: 'is-rouge' }, h('b', null, compter((o) => ouverts(o) && o.date_limite && joursRestants(o.date_limite) <= 3)), h('span', null, 'clôturent sous 3 j')),
    h('div', null, h('b', null, compter((o) => o.niveau === 'fort' && o.statut !== 'ignore')), h('span', null, 'très pertinents')),
    h('div', null, h('b', null, compter((o) => o.cree > vuAvant)), h('span', null, 'nouveaux')));
  const zoneTypes = h('div', { class: 'chips' });
  const zoneStatuts = h('div', { class: 'chips' });
  const recherche = saisie({ type: 'search', class: 'input input--recherche', placeholder: 'Rechercher (acheteur, ville, mot…)', value: filtres.q, oninput: attendre((e) => { filtres.q = e.target.value; dessiner(); }, 200) });
  const faibles = h('label', { class: 'op-bascule' }, h('input', { type: 'checkbox', checked: filtres.faibles ? true : null, onchange: (e) => { filtres.faibles = e.target.checked; memoriser(); dessiner(); } }), h('span', null, 'Afficher les ⚪ faibles'));
  const zone = h('div', { class: 'op-liste' });

  function dessiner() {
    zoneTypes.replaceChildren(...TYPES.map(([k, l]) => h('button', { type: 'button', class: `chip ${filtres.type === k ? 'is-actif' : ''}`, onclick: () => { filtres.type = k; memoriser(); dessiner(); } },
      l, h('span', null, k === 'tout' ? liste.length : compter((o) => o.type === k)))));
    zoneStatuts.replaceChildren(...STATUTS.map(([k, l]) => h('button', { type: 'button', class: `chip ${filtres.statut === k ? 'is-actif' : ''}`, onclick: () => { filtres.statut = k; memoriser(); dessiner(); } },
      l, h('span', null, k === 'tous' ? liste.length : compter((o) => o.statut === k)))));
    const q = sansAccents(filtres.q.trim());
    const vis = liste.filter((o) => (filtres.type === 'tout' || o.type === filtres.type)
      && (filtres.statut === 'tous' || o.statut === filtres.statut)
      && (filtres.faibles || o.niveau !== 'faible' || o.type === 'recrutement' || o.id === cible)
      && (!q || sansAccents(`${o.titre} ${o.acheteur} ${o.lieu} ${o.extrait}`).includes(q)));
    zone.replaceChildren(...(vis.length ? vis.map((o) => carte(o, vuAvant, o.id === cible, dessiner)) : [h('div', { class: 'vide' }, icone('recherche'), h('p', null, liste.length ? 'Aucune opportunité avec ces filtres.' : 'Aucune opportunité pour le moment. Lancez une collecte pour remplir la liste.'))]));
  }
  // Ouverture depuis une notification : on montre l'opportunité même si les filtres la cachent
  if (cible) {
    const o = liste.find((x) => x.id === cible);
    if (o) { filtres.type = 'tout'; if (filtres.statut !== 'tous' && filtres.statut !== o.statut) filtres.statut = o.statut; }
  }
  ctx.afficher(bandeau, stats, h('div', { class: 'op-filtres' }, zoneTypes, zoneStatuts, h('div', { class: 'op-filtres__ligne' }, h('div', { class: 'recherche' }, icone('recherche'), recherche), faibles)), zone);
  dessiner();
  if (cible) setTimeout(() => { const el = document.getElementById(`opp-${cible}`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('is-cible'); } }, 150);
}

function carte(o, vuAvant, cible, redessiner) {
  const j = joursRestants(o.date_limite);
  const urgence = j === null ? 'aucune' : j < 0 ? 'clos' : j <= 3 ? 'rouge' : j <= 7 ? 'orange' : 'or';
  const [pastille, libNiveau] = NIVEAUX[o.niveau] || ['', ''];
  const statutZone = h('div', { class: 'op-statuts' });
  const majStatut = () => statutZone.replaceChildren(...[['a_traiter', 'À traiter'], ['contacte', 'Contacté'], ['ignore', 'Ignoré']].map(([k, l]) => h('button', {
    type: 'button', class: `op-statut ${o.statut === k ? `is-actif is-${k}` : ''}`, 'aria-pressed': o.statut === k ? 'true' : 'false',
    onclick: async () => {
      const avant = o.statut;
      o.statut = k; majStatut();
      try { await api('opportunite.statut', { id: o.id, statut: k }); toast(k === 'ignore' ? 'Ignorée.' : k === 'contacte' ? 'Marquée comme contactée.' : 'Remise à traiter.'); redessiner(); } catch (e) { o.statut = avant; majStatut(); erreur(e); }
    },
  }, l)));
  majStatut();
  const note = zoneTexte({ rows: 2, value: o.note || '', placeholder: 'Note (qui appeler, ce qui a été envoyé, relance…)' });
  const sauver = attendre(async () => { try { await api('opportunite.note', { id: o.id, note: note.value }); o.note = note.value; enreg.textContent = 'Enregistré ✓'; } catch (e) { erreur(e); } }, 800);
  const enreg = h('small', { class: 'muet' });
  note.addEventListener('input', () => { enreg.textContent = '…'; sauver(); });
  const infos = [o.acheteur, o.lieu].filter(Boolean).join(' · ');
  return h('article', { class: `op-carte op-carte--${o.type} ${o.statut === 'ignore' ? 'is-ignore' : ''} ${cible ? 'is-cible' : ''}`, id: `opp-${o.id}` },
    h('div', { class: `op-jx op-jx--${urgence}` },
      j === null ? [h('b', null, o.type === 'recrutement' ? '👥' : '—'), h('span', null, o.type === 'recrutement' ? dateLisible(o.date_parution) : 'sans date')]
        : j < 0 ? [h('b', null, 'Clos'), h('span', null, dateLisible(o.date_limite))]
          : [h('b', null, j === 0 ? 'J' : `J-${j}`), h('span', null, dateLisible(o.date_limite, true))]),
    h('div', { class: 'op-corps' },
      h('div', { class: 'op-meta' },
        o.type !== 'recrutement' ? h('span', { class: `op-niveau op-niveau--${o.niveau}`, title: `Score ${o.score}` }, pastille, ' ', libNiveau) : null,
        h('span', { class: 'op-type' }, TYPES.find(([k]) => k === o.type)?.[1] || ''),
        o.nature ? h('span', { class: 'muet' }, o.nature) : null,
        o.cree > vuAvant && vuAvant ? h('span', { class: 'op-nouveau' }, 'Nouveau') : null),
      h('h3', { class: 'op-titre' }, o.url ? h('a', { href: o.url, target: '_blank', rel: 'noopener' }, o.titre) : o.titre),
      infos ? h('p', { class: 'op-infos' }, infos) : null,
      o.montant > 0 || o.alertes.length ? h('div', { class: 'op-badges' },
        o.montant > 0 ? h('span', { class: 'op-badge op-badge--montant' }, `≈ ${euros.format(o.montant)} € HT`) : null,
        o.alertes.map((a) => h('span', { class: `op-badge ${/Reprise|IGH|Gros|NF|APSAD/.test(a) ? 'op-badge--alerte' : /adaptée/.test(a) ? 'op-badge--ok' : ''}` }, a))) : null,
      h('div', { class: 'op-actions' },
        o.url ? h('a', { class: 'btn btn--gold btn--petit', href: o.url, target: '_blank', rel: 'noopener' }, o.source === 'boamp' ? "Voir l'avis" : "Voir l'offre", icone('fleche')) : null,
        o.url_dossier ? h('a', { class: 'btn btn--ghost btn--petit', href: o.url_dossier, target: '_blank', rel: 'noopener' }, 'Dossier de consultation') : null,
        statutZone),
      h('details', { class: 'op-details', open: o.note ? true : null },
        h('summary', null, o.note ? 'Note et détail' : 'Ajouter une note · détail'),
        o.extrait ? h('p', { class: 'op-extrait' }, o.extrait) : null,
        note, enreg)));
}

async function lancer(bouton, recharger) {
  bouton.disabled = true;
  const lib = bouton.querySelector('span');
  const avant = lib.textContent;
  lib.textContent = 'Collecte en cours…';
  try {
    const r = await api('veille.lancer', {});
    toast(`Collecte terminée : ${r.nouveaux.boamp} appel(s) d'offres et ${r.nouveaux.francetravail} recrutement(s) nouveaux.`);
    recharger();
  } catch (e) { erreur(e); }
  bouton.disabled = false;
  lib.textContent = avant;
}

/* ---------- Réglages (secrets rangés dans le .env privé du serveur) ---------- */
async function reglages(recharger) {
  let r;
  try { r = await api('veille.reglages'); } catch (e) { return erreur(e); }
  const discord = saisie({ placeholder: r.discord || 'https://discord.com/api/webhooks/…', autocomplete: 'off' });
  const ftId = saisie({ placeholder: r.ftId || 'PAR_bdasecuritygroup_…', autocomplete: 'off' });
  const ftSecret = saisie({ type: 'password', placeholder: r.ftSecret ? '•••••••• (enregistrée)' : 'Clé secrète', autocomplete: 'new-password' });
  const cron = h('code', { class: 'op-code' }, r.cron);
  const ok = await modale({
    titre: 'Réglages de la veille',
    large: true,
    contenu: h('div', { class: 'form-grille' },
      h('p', { class: 'modale__texte' }, `Les secrets sont rangés dans ${r.envFichier}, jamais dans le code ni sur GitHub. Laissez un champ vide pour garder la valeur actuelle.`),
      champ('Webhook Discord', discord, r.discord ? `Actuel : ${r.discord}` : 'Discord > salon > Modifier > Intégrations > Webhooks > Copier l’URL'),
      h('div', { class: 'form-grille form-grille--2' },
        champ('France Travail : identifiant client', ftId, r.ftId ? `Actuel : ${r.ftId}` : 'francetravail.io > Mes applications'),
        champ('France Travail : clé secrète', ftSecret, r.ftSecret ? 'Une clé est enregistrée.' : '')),
      h('div', { class: 'op-cron' },
        h('b', null, 'Lancement automatique (cron-job.org, toutes les 30 minutes)'),
        h('p', { class: 'muet' }, 'Collez cette adresse dans votre tâche cron-job.org (Exécution : toutes les 30 minutes). Elle contient un code secret : ne la partagez pas.'),
        cron,
        h('div', { class: 'op-actions' },
          h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(r.cron); toast('Adresse copiée.'); } catch (e) { erreur('Copie impossible : sélectionnez le texte.'); } } }, icone('copier'), 'Copier'),
          h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async () => { try { await api('veille.reglages.enregistrer', { nouveauCodeCron: true }); const n = await api('veille.reglages'); r.cron = n.cron; cron.textContent = n.cron; toast('Nouveau code créé : mettez à jour cron-job.org.'); } catch (e) { erreur(e); } } }, 'Nouveau code secret'))),
      h('div', { class: 'op-actions' },
        h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: async (e) => {
          e.currentTarget.disabled = true;
          try { const t = await api('veille.tester', {}); toast(`Test : Discord ${t.discord.ok ? '✓' : '✗ ' + (t.discord.erreur || '')} · téléphone : ${t.push.envoyes} envoi(s)`, t.discord.ok ? 'ok' : 'erreur'); } catch (err) { erreur(err); }
          e.currentTarget.disabled = false;
        } }, icone('envoyer'), 'Envoyer un message de test'))),
    actions: [{ libelle: 'Fermer', classe: 'btn--ghost', valeur: false }, { libelle: 'Enregistrer', classe: 'btn--gold', submit: true, action: async () => {
      try {
        await api('veille.reglages.enregistrer', { discord: discord.value.trim(), ftId: ftId.value.trim(), ftSecret: ftSecret.value.trim() });
        toast('Réglages enregistrés.');
        return true;
      } catch (e) { erreur(e); return false; }
    } }],
  });
  if (ok) recharger();
}
