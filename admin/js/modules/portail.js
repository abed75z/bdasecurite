/* =========================================================
   ESPACE ADMIN BDA — Espace client (module « portail »)
   #/portail        les clients qui ont un espace : agents partagés, dépôts, demandes
   #/portail/<id>   un client : quels agents et quels documents il voit, ce qu'il a déposé
   Seuls les documents « professionnels » d'un agent peuvent être partagés
   (carte pro, diplômes, certifications, attestations, CV) ; le reste ne sort jamais.
   ========================================================= */
import { api, h, icone, toast, erreur, ilYa, dateLisible } from '../outils.js';

export async function pagePortail(ctx) {
  const id = +ctx.params[0] || 0;
  if (id) return pageClient(ctx, id);
  ctx.titre('Espace client');
  const { clients } = await api('mod.portail.clients');
  if (!ctx.actuel()) return;
  ctx.afficher(h('div', { class: 'tr pt' },
    h('p', { class: 'muet pt-intro' }, 'Pour chaque client, choisissez les agents et les documents qu’il peut consulter dans son espace. Les messages se lisent dans ', h('a', { href: '#/messages' }, 'Messages clients'), '.'),
    clients.length ? h('section', { class: 'carte' }, h('div', { class: 'tableau' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Client'), h('th', null, 'Espace'), h('th', null, 'Agents partagés'), h('th', null, 'À voir'), h('th', null, ''))),
      h('tbody', null, clients.map((c) => h('tr', null,
        h('td', null, h('b', null, c.nom), h('small', { class: 'muet mx-bloc' }, c.email)),
        h('td', null, !c.actif ? h('span', { class: 'pastille pastille--archivee' }, 'Désactivé') : c.active ? h('span', { class: 'pastille pastille--payee' }, c.derniere ? `Vu ${ilYa(c.derniere)}` : 'Activé') : h('span', { class: 'pastille pastille--attente' }, 'Invitation envoyée')),
        h('td', null, c.agents ? `${c.agents} agent${c.agents > 1 ? 's' : ''}` : h('span', { class: 'muet' }, 'aucun'), c.sites ? null : h('small', { class: 'muet mx-bloc' }, 'aucun site relié')),
        h('td', null, [c.depots ? h('span', { class: 'pastille pastille--attente' }, `${c.depots} dépôt${c.depots > 1 ? 's' : ''}`) : null, c.demandes ? h('span', { class: 'pastille pastille--attente' }, `${c.demandes} demande${c.demandes > 1 ? 's' : ''}`) : null].filter(Boolean)),
        h('td', { class: 'mx-droite' }, h('a', { class: 'btn btn--ghost btn--petit', href: `#/portail/${c.id}` }, 'Ouvrir'))))))))
      : h('section', { class: 'carte' }, h('div', { class: 'mx-vide' }, h('b', null, 'Aucun client n’a encore d’espace'), h('p', null, 'Invitez un client depuis sa fiche (Fiches clients › Espace client).')))));
}

async function pageClient(ctx, id) {
  const [p, d] = await Promise.all([api('mod.portail.partages', undefined, { client_id: id }), api('mod.portail.depots', undefined, { client_id: id })]);
  if (!ctx.actuel()) return;
  ctx.titre(`Espace client · ${p.client.nom}`);
  ctx.actions(h('a', { class: 'btn btn--ghost', href: `#/messages/${id}` }, icone('message'), h('span', null, 'Messages')));
  const visibles = p.agents.filter((a) => a.visible).length;

  const enregistrer = async (a, ligne) => {
    const docs = [...ligne.querySelectorAll('input[data-doc]:checked')].map((x) => +x.dataset.doc);
    const visible = ligne.querySelector('input[data-visible]').checked;
    try {
      const r = await api('mod.portail.partage.enregistrer', { client_id: id, agent_id: a.id, visible, docs });
      a.visible = r.visible; a.partages = r.docs;
      ligne.classList.toggle('is-visible', r.visible);
      toast(r.visible ? `${a.court} : dossier visible (${r.docs.length} document${r.docs.length > 1 ? 's' : ''}).` : `${a.court} : dossier caché pour ce client.`);
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

  ctx.afficher(h('div', { class: 'tr pt' },
    h('div', { class: 'tr-colonnes' },
      h('div', { class: 'tr-col' },
        h('section', { class: 'carte' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Dossiers des agents'), h('small', null, `${visibles} visible${visibles > 1 ? 's' : ''}`)),
          h('p', { class: 'muet pt-intro' }, p.sites ? 'Les agents qui travaillent sur ses sites sont en premier. Cochez ce que le client peut voir : chaque changement est enregistré tout de suite.' : 'Ce client n’a pas encore de site relié dans le Planning des sites : tous les agents sont listés.'),
          surSite.length ? surSite.map(ligneAgent) : h('p', { class: 'muet' }, 'Aucun agent sur ses sites pour l’instant.'),
          autres.length ? plus : null)),
      h('div', { class: 'tr-col' },
        h('section', { class: 'carte' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Déposés par le client')),
          d.depots.length ? h('ul', { class: 'pt-depots' }, d.depots.map((x) => h('li', null,
            h('a', { href: `api.php?a=mod.portail.depot&id=${x.id}`, target: '_blank', rel: 'noopener' }, icone('dossier'), h('span', null, h('b', null, x.titre), h('small', { class: 'muet' }, `${dateLisible(x.cree, true)}${x.vu ? '' : ' · nouveau'}`))))))
            : h('p', { class: 'muet' }, 'Rien pour l’instant. Le client peut vous envoyer bons de commande, plans, listes ou photos depuis son espace.')),
        h('section', { class: 'carte pt-regles' },
          h('header', { class: 'carte__tete' }, h('h2', null, 'Jamais visible par le client')),
          h('p', { class: 'muet' }, 'Pièce d’identité, sécurité sociale, RIB, contrat et salaire, justificatifs d’absence, sanctions, notes internes. Le client voit le prénom et l’initiale du nom, jamais le nom complet ni le numéro de carte pro en entier.'),
          h('p', { class: 'muet' }, 'Pensez à prévenir les agents par écrit que leur carte pro et leurs diplômes peuvent être montrés aux clients de leur site.'))))));
}
