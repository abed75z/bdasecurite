/* =========================================================
   ESPACE ADMIN BDA — « Tout va bien ? » (module « presence »)
   Contrôle de présence des agents de nuit : réglages (désactivé par défaut),
   agents en poste et leur dernière réponse, historique nuit par nuit,
   téléphones de l'équipe qui reçoivent les alertes.
   ========================================================= */
import { api, h, icone, toast, erreur, confirmer, champ, ilYa } from '../outils.js';

const STATUTS = { attente: ['En attente', 'attente'], ok: ['Répondu', 'payee'], retard: ['En retard', 'retard'], sans_reponse: ['Sans réponse', 'refusee'] };
const pastille = (q) => {
  if (!q) return h('span', { class: 'muet' }, '—');
  const [lib, ton] = q.origine === 'spontane' ? ['Confirmé de lui-même', 'payee'] : (STATUTS[q.statut] || [q.statut, 'archivee']);
  return h('span', { class: `pastille pastille--${ton}` }, lib);
};
const hm = (s) => (s && s.length >= 16 ? s.slice(11, 16).replace(':', 'h') : '');
const fmtNuit = (s) => { const d = new Date(`${s}T12:00:00`); const l = new Date(d.getTime() + 86400000); return `nuit du ${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} au ${l.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}`; };

export async function pagePresence(ctx) {
  const nuit = /^\d{4}-\d{2}-\d{2}$/.test(ctx.params[0] || '') ? ctx.params[0] : '';
  ctx.titre('Tout va bien ?');
  const d = await api('mod.presence.tableau', undefined, nuit ? { nuit } : {});
  if (!ctx.actuel()) return;
  const recharger = () => pagePresence(ctx);
  const r = d.reglages;

  /* Réglages */
  const actif = h('input', { type: 'checkbox', checked: r.actif });
  const portee = h('select', { class: 'input' }, h('option', { value: 'tous', selected: r.portee === 'tous' }, 'Tous les postes dans la plage horaire'), h('option', { value: 'sites', selected: r.portee === 'sites' }, 'Seulement les sites choisis'));
  const sites = h('div', { class: 'tv-sites', hidden: r.portee !== 'sites' }, d.sites.map((s) => h('label', { class: 'case' }, h('input', { type: 'checkbox', value: s.id, checked: r.sites.includes(s.id) }), h('span', null, s.nom))));
  portee.onchange = () => { sites.hidden = portee.value !== 'sites'; };
  const debut = h('input', { class: 'input', type: 'time', value: r.debut });
  const fin = h('input', { class: 'input', type: 'time', value: r.fin });
  const intervalle = h('select', { class: 'input' }, [30, 60].map((n) => h('option', { value: n, selected: n === r.intervalle }, `Toutes les ${n} min`)));
  const delai = h('select', { class: 'input' }, [10, 15, 20].map((n) => h('option', { value: n, selected: n === r.delai }, `${n} minutes`)));
  const enregistrer = async () => {
    const corps = { actif: actif.checked, portee: portee.value, sites: [...sites.querySelectorAll('input:checked')].map((x) => Number(x.value)), debut: debut.value, fin: fin.value, intervalle: Number(intervalle.value), delai: Number(delai.value) };
    if (corps.actif && !r.actif && !(await confirmer(`Activer le contrôle ? Les agents en poste entre ${corps.debut.replace(':', 'h')} et ${corps.fin.replace(':', 'h')} qui ont activé les alertes recevront « Tout va bien ? » toutes les ${corps.intervalle} minutes.`, { titre: 'Activer « Tout va bien ? »', ok: 'Activer' }))) return;
    try { await api('mod.presence.reglages', corps); toast(corps.actif ? 'Contrôle de présence activé.' : 'Réglages enregistrés.'); recharger(); } catch (e) { erreur(e); }
  };
  const avecTel = d.equipe.filter((a) => a.appareils).length;
  const reglages = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Réglages'), h('span', { class: `pastille pastille--${r.actif ? 'payee' : 'archivee'}` }, r.actif ? 'Activé' : 'Désactivé')),
    h('label', { class: 'case tv-interrupteur' }, actif, h('span', null, h('b', null, 'Envoyer « Tout va bien ? » aux agents en poste'), h('small', { class: 'muet mx-bloc' }, 'Rien ne part tant que cette case n’est pas cochée.'))),
    h('div', { class: 'form-grille form-grille--2' }, champ('De', debut), champ('À', fin)),
    h('div', { class: 'form-grille form-grille--2' }, champ('Fréquence', intervalle), champ('Délai pour répondre', delai)),
    champ('Postes concernés', portee), sites,
    h('div', { class: 'tr-pied' }, h('small', { class: 'muet' }, 'La première question part 20 minutes après la prise de poste.'), h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: enregistrer }, 'Enregistrer')));

  const limites = h('section', { class: 'carte tv-limites' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'À savoir')),
    h('ul', null,
      h('li', null, `Les agents activent les alertes dans leur Espace équipe (page « Tout va bien ? ») : ${avecTel} agent${avecTel > 1 ? 's' : ''} sur ${d.equipe.length} l’${avecTel > 1 ? 'ont' : 'a'} fait.`),
      h('li', null, 'Sans réponse dans le délai : alerte rouge dans le Centre de contrôle et notification sur votre téléphone. Appelez l’agent.'),
      h('li', null, 'Il faut un téléphone allumé, avec internet et les notifications autorisées. Ce contrôle ne remplace pas un boîtier PTI / DATI certifié pour un travailleur isolé.'),
      d.cron?.quand ? h('li', null, `Dernier passage de la tâche automatique : ${ilYa(d.cron.quand)}.`) : h('li', { class: 'mx-rouge' }, 'La tâche automatique n’est jamais passée : vérifiez cron-job.org.')));

  /* En poste maintenant */
  const demander = async (x) => {
    if (!(await confirmer(`Envoyer « Tout va bien ? » maintenant à ${x.nom} ? Il aura ${r.delai} minutes pour répondre.`, { ok: 'Envoyer' }))) return;
    try { const res = await api('mod.presence.demander', { agent_id: x.agent_id }); toast(`Question envoyée sur ${res.appareils} téléphone${res.appareils > 1 ? 's' : ''} : réponse attendue avant ${res.limite}.`); recharger(); } catch (e) { erreur(e); }
  };
  const enPoste = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'En poste maintenant'), h('small', null, d.dansPlage ? 'Dans la plage du contrôle' : 'Hors de la plage du contrôle')),
    d.enPoste.length ? h('div', { class: 'tableau' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Agent'), h('th', null, 'Poste'), h('th', null, 'Téléphone'), h('th', null, 'Dernière question'), h('th', null, ''))),
      h('tbody', null, d.enPoste.map((x) => h('tr', null,
        h('td', null, h('b', null, x.nom), h('small', { class: 'muet mx-bloc' }, x.suivi ? 'Suivi' : x.raison || 'Non suivi')),
        h('td', null, x.site || '—', h('small', { class: 'muet mx-bloc' }, `${x.debut} - ${x.fin}`)),
        h('td', null, x.appareils ? h('span', null, `${x.appareils} relié${x.appareils > 1 ? 's' : ''}`) : h('span', { class: 'mx-rouge' }, x.compte ? 'Alertes non activées' : 'Pas de compte Espace équipe')),
        h('td', null, x.dernier ? [pastille(x.dernier), h('small', { class: 'muet mx-bloc' }, `${hm(x.dernier.envoye)}${x.dernier.repondu ? ` · réponse ${hm(x.dernier.repondu)}` : ''}`)] : h('span', { class: 'muet' }, '—')),
        h('td', { class: 'mx-droite' }, x.appareils ? h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => demander(x) }, 'Demander maintenant') : null)))))) : h('div', { class: 'mx-vide' }, h('b', null, 'Personne en poste'), h('p', null, 'Les agents du planning et ceux qui ont pris leur service apparaissent ici.')));

  /* Historique de la nuit */
  const choixNuit = h('select', { class: 'input input--auto', onchange: (e) => { location.hash = `#/presence/${e.target.value}`; } },
    [...new Set([d.nuit, ...d.nuits.map((n) => n.nuit)])].sort().reverse().map((n) => {
      const x = d.nuits.find((y) => y.nuit === n);
      return h('option', { value: n, selected: n === d.nuit }, `${fmtNuit(n)}${x ? ` · ${x.questions} question${x.questions > 1 ? 's' : ''}${x.sans ? `, ${x.sans} sans réponse` : ''}` : ''}`);
    }));
  const histo = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Historique'), choixNuit),
    d.historique.length ? h('div', { class: 'tableau' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Heure'), h('th', null, 'Agent'), h('th', null, 'Site'), h('th', null, 'Réponse'), h('th', null, 'Résultat'))),
      h('tbody', null, d.historique.map((q) => h('tr', null,
        h('td', { class: 'mx-num' }, hm(q.envoye), q.origine === 'manuel' ? h('small', { class: 'muet mx-bloc' }, `à la demande${q.par ? ` de ${q.par}` : ''}`) : null),
        h('td', null, q.agent_nom || 'Agent'),
        h('td', null, q.site || '—'),
        h('td', { class: 'mx-num' }, q.repondu ? `${hm(q.repondu)}${q.canal === 'notification' ? ' · notification' : q.canal === 'page' ? ' · page' : ''}` : h('span', { class: 'muet' }, q.statut === 'attente' ? `avant ${hm(q.limite)}` : '—'), !q.appareils && q.origine !== 'spontane' ? h('small', { class: 'mx-rouge mx-bloc' }, 'Aucun téléphone joint') : null),
        h('td', null, pastille(q))))))) : h('p', { class: 'muet' }, 'Aucune question cette nuit-là.'));

  /* Téléphones de l'équipe */
  const equipe = h('section', { class: 'carte' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Téléphones de l’équipe'), h('small', null, `${avecTel}/${d.equipe.length} activés`)),
    d.equipe.length ? h('ul', { class: 'tv-equipe' }, d.equipe.map((a) => h('li', null,
      h('span', null, h('b', null, a.nom), h('small', { class: 'muet' }, a.poste || '')),
      a.appareils ? h('span', { class: 'tv-ok' }, icone('coche'), `${a.appareils} téléphone${a.appareils > 1 ? 's' : ''}${a.vu ? ` · reçu ${ilYa(a.vu)}` : ''}`) : h('span', { class: 'muet' }, 'Non activé'))))
      : h('p', { class: 'muet' }, 'Aucun agent n’a encore de compte Espace équipe.'));

  ctx.afficher(h('div', { class: 'tr tv' },
    d.alertesOuvertes ? h('a', { class: 'tr-alerte tv-alerte', href: '#/controle' }, icone('alerte'), h('div', null, h('b', null, `${d.alertesOuvertes} agent${d.alertesOuvertes > 1 ? 's' : ''} sans réponse`), h('p', null, 'Ouvrez le Centre de contrôle pour voir l’alerte et appeler l’agent.'))) : null,
    h('div', { class: 'tr-colonnes' }, h('div', { class: 'tr-col' }, enPoste, histo), h('div', { class: 'tr-col' }, reglages, limites, equipe))));
}
