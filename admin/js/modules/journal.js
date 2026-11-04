/* =========================================================
   ESPACE ADMIN BDA — Main courante des sites (module « journal »)
   Le cahier de poste de chaque site, tenu par les agents depuis l'appli BDA Équipe :
   ouvertures et fermetures, rondes, visiteurs et livraisons, notes, personnes reçues,
   prises et fins de service, incidents. En direct, jour par jour, imprimable en PDF.
   ========================================================= */
import { api, h, icone, toast, erreur, champ, iso } from '../outils.js';

const heure = (s) => (s && s.length >= 16 ? s.slice(11, 16).replace(':', 'h') : '');
const jourLisible = (j) => { const d = new Date(`${j}T12:00:00`); return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };
const decaler = (j, n) => { const d = new Date(`${j}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const TYPES = { prise: 'Service', fin: 'Service', bouton: 'Poste', visiteur: 'Visiteur', note: 'Note', incident: 'Incident' };

// Ce qu'on lit sur une ligne (libellé + détail), pour l'écran comme pour le PDF
function lire(l) {
  if (l.type === 'note') return { titre: l.detail || 'Note', detail: '' };
  if (l.type === 'visiteur') return { titre: l.libelle, detail: [l.detail, l.depart ? `reparti à ${heure(l.depart)}` : 'départ non noté'].filter(Boolean).join(' · ') };
  return { titre: l.libelle, detail: l.detail };
}

export async function pageJournal(ctx) {
  const auj = iso(new Date());
  const jour = /^\d{4}-\d{2}-\d{2}$/.test(ctx.params[1] || '') && ctx.params[1] <= auj ? ctx.params[1] : auj;
  const liste = await api('mod.journal.sites', undefined, { jour });
  if (!ctx.actuel()) return;
  const siteId = Number(ctx.params[0]) || liste.sites[0]?.id || 0;
  ctx.titre('Main courante des sites');
  const aller = (id, j) => { location.hash = `#/journal/${id}/${j}`; };
  const choixJour = h('input', { class: 'input', type: 'date', value: jour, max: auj, 'aria-label': 'Jour', onchange: (e) => e.target.value && aller(siteId, e.target.value) });
  ctx.actions(
    h('div', { class: 'jn-jours' },
      h('button', { class: 'btn btn--ghost btn--icone', type: 'button', title: 'Jour précédent', onclick: () => aller(siteId, decaler(jour, -1)) }, icone('retour')),
      choixJour,
      h('button', { class: 'btn btn--ghost btn--icone', type: 'button', title: 'Jour suivant', disabled: jour >= auj, onclick: () => aller(siteId, decaler(jour, 1)) }, icone('suivant')),
      jour !== auj ? h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: () => aller(siteId, auj) }, 'Aujourd’hui') : null));

  if (!liste.sites.length) {
    ctx.afficher(h('section', { class: 'carte jn-vide' }, icone('note'), h('h2', null, 'Aucun site actif'), h('p', { class: 'muet' }, 'Créez vos sites dans Exploitation : chaque site a ensuite sa main courante, tenue par les agents depuis l’appli.')));
    return;
  }
  const sites = h('nav', { class: 'jn-sites', 'aria-label': 'Sites' }, liste.sites.map((s) => h('a', { class: `jn-site ${s.id === siteId ? 'is-actif' : ''}`, href: `#/journal/${s.id}/${jour}` },
    h('span', null, h('b', null, s.nom), s.client ? h('small', null, s.client) : null), s.lignes ? h('i', { class: 'jn-nb' }, s.lignes) : null)));
  const zone = h('div', { class: 'jn-zone' }, h('div', { class: 'carte jn-charge' }, h('p', { class: 'muet' }, 'Chargement…')));
  ctx.afficher(h('div', { class: 'jn' }, sites, zone));

  let d;
  try { d = await api('mod.journal.jour', undefined, { site_id: siteId, jour }); } catch (e) { zone.replaceChildren(h('section', { class: 'carte' }, h('p', { class: 'mx-rouge' }, e.message))); return; }
  if (!ctx.actuel()) return;
  const recharger = () => pageJournal(ctx);

  /* Le cahier du jour */
  const lignes = d.lignes.map((l) => {
    const { titre, detail } = lire(l);
    return h('li', { class: `jn-ligne jn-ligne--${l.type}` },
      h('time', null, heure(l.quand)),
      h('div', { class: 'jn-ligne__corps' }, h('b', null, titre), detail ? h('p', null, detail) : null,
        l.photo ? h('a', { class: 'jn-photo', href: `api.php?a=mod.journal.photo&id=${l.id}`, target: '_blank', rel: 'noopener' }, h('img', { src: `api.php?a=mod.journal.photo&id=${l.id}`, alt: 'Photo jointe', loading: 'lazy' })) : null),
      h('span', { class: 'jn-ligne__qui' }, h('small', { class: `jn-type jn-type--${l.type}` }, TYPES[l.type] || ''), l.agent));
  });
  const imprimer = () => imprimerCahier(d);
  const cahier = h('section', { class: 'carte jn-cahier' },
    h('header', { class: 'carte__tete' },
      h('div', null, h('h2', null, d.site.nom), h('p', { class: 'muet' }, [d.site.client, jourLisible(jour)].filter(Boolean).join(' · '))),
      h('div', { class: 'jn-tete-droite' },
        d.reglages.compteur ? h('span', { class: 'pastille pastille--info' }, `${d.compteur} personne${d.compteur > 1 ? 's' : ''} reçue${d.compteur > 1 ? 's' : ''}`) : null,
        h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: recharger, title: 'Actualiser' }, icone('activite'), h('span', null, 'Actualiser')),
        h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: imprimer, disabled: !d.lignes.length }, icone('imprimer'), h('span', null, 'PDF')))),
    d.lignes.length ? h('ol', { class: 'jn-lignes' }, lignes)
      : h('div', { class: 'jn-rien' }, h('p', null, jour === auj ? 'Rien n’est encore noté aujourd’hui.' : 'Rien n’a été noté ce jour-là.'),
        h('p', { class: 'muet' }, 'Les agents notent depuis l’appli BDA Équipe (bouton « Noter » pendant le service). La prise et la fin de service et les incidents s’ajoutent tout seuls.')));

  /* Réglages du site */
  const boutons = h('textarea', { class: 'input', rows: 6, placeholder: 'Un bouton par ligne' }, d.reglages.boutons.join('\n'));
  const compteur = h('input', { type: 'checkbox', checked: d.reglages.compteur });
  const client = h('input', { type: 'checkbox', checked: d.reglages.client });
  const enregistrer = h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: async () => {
    enregistrer.disabled = true;
    try {
      await api('mod.journal.reglages', { site_id: siteId, boutons: boutons.value.split('\n').map((x) => x.trim()).filter(Boolean), compteur: compteur.checked, client: client.checked });
      toast('Réglages du site enregistrés : l’appli des agents est à jour.');
      recharger();
    } catch (e) { erreur(e); enregistrer.disabled = false; }
  } }, 'Enregistrer');
  const reglages = h('section', { class: 'carte jn-reglages' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Réglages de ce site')),
    champ('Boutons rapides de l’agent', boutons, 'Un par ligne, 12 au plus. L’agent les touche : l’heure se note toute seule.'),
    h('label', { class: 'case' }, compteur, h('span', null, h('b', null, 'Compteur « Personnes reçues »'), h('small', { class: 'muet mx-bloc' }, 'Pour les postes d’accueil : un bouton « +1 », le total s’ajoute à « Fermeture au public ».'))),
    h('label', { class: 'case' }, client, h('span', null, h('b', null, 'Visible par le client dans son espace'), h('small', { class: 'muet mx-bloc' }, 'Il voit les lignes du jour en direct, sans les photos, avec le prénom des agents.'))),
    h('div', { class: 'tr-pied' }, h('small', { class: 'muet' }, 'S’applique tout de suite à l’appli des agents.'), enregistrer));

  zone.replaceChildren(cahier, reglages);
}

// PDF : une page propre, à enregistrer depuis la fenêtre d'impression
function imprimerCahier(d) {
  const lignes = d.lignes.map((l) => {
    const { titre, detail } = lire(l);
    return `<tr class="${l.type === 'incident' ? 'incident' : ''}"><td class="h">${echapper(heure(l.quand))}</td><td><b>${echapper(titre)}</b>${detail ? `<br><span>${echapper(detail)}</span>` : ''}</td><td class="a">${echapper(l.agent)}</td></tr>`;
  }).join('');
  const date = jourLisible(d.jour);
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Main courante · ${echapper(d.site.nom)} · ${echapper(d.jour)}</title><style>
    @page { size: A4; margin: 16mm 14mm; }
    body { font: 10.5pt/1.45 'Helvetica Neue', Arial, sans-serif; color: #17171a; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1.5pt solid #17171a; padding-bottom: 8pt; margin-bottom: 12pt; }
    .marque { font-weight: 700; letter-spacing: .3em; font-size: 9pt; } .marque i { display: block; width: 22pt; height: 1pt; background: #B39467; margin-top: 4pt; }
    h1 { font: 400 20pt/1.1 Georgia, serif; margin: 10pt 0 2pt; } .sous { color: #5c5a56; margin: 0; text-transform: capitalize; }
    .cpt { text-align: right; font-size: 9.5pt; color: #5c5a56; } .cpt b { display: block; font-size: 16pt; color: #17171a; font-weight: 400; }
    table { width: 100%; border-collapse: collapse; } th { text-align: left; font-size: 8pt; letter-spacing: .12em; text-transform: uppercase; color: #5c5a56; border-bottom: .75pt solid #17171a; padding: 4pt 6pt; }
    td { padding: 6pt; border-bottom: .5pt solid #d9d6cf; vertical-align: top; } td.h { width: 44pt; font-variant-numeric: tabular-nums; font-weight: 600; } td.a { width: 90pt; color: #5c5a56; }
    td span { color: #5c5a56; } tr.incident td.h, tr.incident b { color: #b3261e; } tr { page-break-inside: avoid; }
    footer { margin-top: 16pt; font-size: 8pt; color: #8a877f; display: flex; justify-content: space-between; }
  </style></head><body>
    <header><div><div class="marque">BDA<i></i></div><h1>Main courante · ${echapper(d.site.nom)}</h1><p class="sous">${echapper(date)}${d.site.client ? ` · ${echapper(d.site.client)}` : ''}</p></div>
    ${d.reglages.compteur ? `<div class="cpt">Personnes reçues<b>${d.compteur}</b></div>` : ''}</header>
    <table><thead><tr><th>Heure</th><th>Événement</th><th>Agent</th></tr></thead><tbody>${lignes}</tbody></table>
    <footer><span>BDA Security Group · main courante tenue depuis l’appli BDA Équipe, heures enregistrées automatiquement</span><span>Édité le ${new Date().toLocaleDateString('fr-FR')}</span></footer>
  </body></html>`;
  const cadre = h('iframe', { class: 'jn-impression', title: 'Impression', 'aria-hidden': 'true' });
  document.body.append(cadre);
  cadre.contentDocument.open();
  cadre.contentDocument.write(html);
  cadre.contentDocument.close();
  setTimeout(() => { cadre.contentWindow.focus(); cadre.contentWindow.print(); setTimeout(() => cadre.remove(), 2000); }, 250);
}

