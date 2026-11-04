/* =========================================================
   ESPACE ADMIN BDA — Main courante des sites (module « journal »)
   Le cahier de poste de chaque site, tenu par les agents depuis l'appli BDA Équipe :
   ouvertures et fermetures, rondes, visiteurs et livraisons, notes, personnes reçues,
   prises et fins de service, incidents. En direct, jour par jour, imprimable en PDF.
   ========================================================= */
import { api, h, icone, toast, erreur, champ, iso, confirmer, modale } from '../outils.js';

const heure = (s) => (s && s.length >= 16 ? s.slice(11, 16).replace(':', 'h') : '');
const jourLisible = (j) => { const d = new Date(`${j}T12:00:00`); return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };
const decaler = (j, n) => { const d = new Date(`${j}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const TYPES = { prise: 'Service', fin: 'Service', bouton: 'Poste', visiteur: 'Visiteur', note: 'Note', incident: 'Incident' };

// Ce qu'on lit sur une ligne (libellé + détail), pour l'écran comme pour le PDF
function lire(l) {
  if (l.type === 'note') return l.libelle && l.libelle !== 'Note' ? { titre: l.libelle, detail: l.detail } : { titre: l.detail || 'Note', detail: '' };
  if (l.type === 'visiteur') return { titre: l.libelle, detail: [l.detail, l.depart ? `reparti à ${heure(l.depart)}` : 'départ non noté'].filter(Boolean).join(' · ') };
  return { titre: l.libelle, detail: l.detail };
}

// « 8h30 – 13h45 · 19 absents · 7 sans rendez-vous · 1 visite »
export function resumeJour(r) {
  if (!r) return [];
  const hm = (x) => x.replace(':', 'h').replace(/^0(\d)/, '$1');
  return [
    r.debut ? ['Présence', (r.enCours ? `depuis ${hm(r.debut)}` : `${hm(r.debut)} – ${hm(r.fin)}`) + (r.pauses || []).map(([a, b]) => ` · pause ${hm(a)}–${hm(b)}`).join('')] : null,
    r.absents !== null && r.absents !== undefined ? ['Absents sur la liste', String(r.absents)] : null,
    r.sansRdv ? ['Sans rendez-vous', String(r.sansRdv)] : null,
    r.passages ? ['Visites et livraisons', String(r.passages)] : null,
    r.incidents ? ['Incidents', String(r.incidents)] : null,
  ].filter(Boolean);
}

// Ajouter ou corriger une ligne : heure, ce qui s'est passé, détail, agent, compte rendu de la liste
async function editerLigne(d, l, recharger) {
  const hhmm = (q) => (q ? q.slice(11, 16) : '');
  const heureC = h('input', { class: 'input', type: 'time', value: l ? hhmm(l.quand) : '', required: true });
  const type = h('select', { class: 'input' }, [['bouton', 'Événement du poste'], ['visiteur', 'Visiteur ou livraison'], ['note', 'Note']].map(([v, t]) => h('option', { value: v, selected: (l?.type || 'bouton') === v }, t)));
  const suggestions = h('datalist', { id: 'jn-libelles' }, [...new Set([...d.reglages.boutons, 'Arrivée sur site', 'Ronde générale', 'Pause', 'Reprise de service'])].map((b) => h('option', { value: b })));
  const libelle = h('input', { class: 'input', list: 'jn-libelles', maxlength: 80, value: l ? (l.type === 'note' ? (l.libelle === 'Note' ? '' : l.libelle) : l.libelle) : '', placeholder: 'Ex. Ouverture des portes, ELIS, Ronde générale' });
  const detail = h('textarea', { class: 'input', rows: 3, maxlength: 1000, placeholder: 'Détail (facultatif). Ex. 4 bonbonnes et 12 rouleaux d’essuie-mains' }, l ? (l.detailBrut ?? '') : '');
  const depart = h('input', { class: 'input', type: 'time', value: l ? hhmm(l.depart) : '' });
  const agent = h('select', { class: 'input' }, h('option', { value: '0' }, 'Direction'),
    d.agents.map((a) => h('option', { value: a.id, selected: l ? +l.agentId === a.id : false }, a.nom)));
  if (!l) { const pointe = d.lignes.find((x) => x.type === 'prise'); if (pointe) agent.value = String(pointe.agentId); }
  const avecListe = h('input', { type: 'checkbox', checked: l ? l.absents !== null && l.absents !== undefined : false });
  const absents = h('input', { class: 'input', type: 'number', min: 0, max: 9999, value: l?.absents ?? 0 });
  const sansRdv = h('input', { class: 'input', type: 'number', min: 0, max: 9999, value: l?.sansRdv ?? 0 });
  const blocListe = h('div', { class: 'form-grille form-grille--2', hidden: !avecListe.checked }, champ('Absents sur la liste', absents), champ('Venus sans rendez-vous', sansRdv));
  avecListe.onchange = () => { blocListe.hidden = !avecListe.checked; };
  const blocDepart = champ('Heure de départ (facultatif)', depart, 'Pour un visiteur ou une livraison');
  const majType = () => { blocDepart.hidden = type.value !== 'visiteur'; };
  type.onchange = majType;
  majType();
  const msg = h('p', { class: 'mx-rouge' });
  const r = await modale({
    titre: l ? 'Corriger la ligne' : `Ajouter une ligne · ${jourLisible(d.jour)}`,
    contenu: h('div', { class: 'jn-form' },
      h('div', { class: 'form-grille form-grille--2' }, champ('Heure', heureC), champ('Type', type)),
      champ('Ce qui s’est passé', libelle), suggestions,
      champ('Détail', detail),
      blocDepart,
      champ('Agent', agent),
      h('label', { class: 'case' }, avecListe, h('span', null, h('b', null, 'Compte rendu de la liste'), h('small', { class: 'muet mx-bloc' }, 'Absents sur la liste et personnes venues sans rendez-vous (souvent à la fermeture au public).'))),
      blocListe,
      l?.par === 'direction' || !l ? h('p', { class: 'muet jn-form__note' }, 'Le client voit la ligne comme les autres, avec le prénom de l’agent choisi.') : null,
      msg),
    actions: [{ libelle: 'Annuler', classe: 'btn--ghost', valeur: false }, { libelle: l ? 'Enregistrer' : 'Ajouter', classe: 'btn--gold', submit: true, action: async () => {
      msg.textContent = '';
      try {
        await api('mod.journal.ligne', { id: l?.id || 0, site_id: d.site.id, jour: d.jour, heure: heureC.value, type: type.value, libelle: libelle.value.trim(), detail: detail.value.trim(),
          depart: type.value === 'visiteur' ? depart.value : '', agent_id: +agent.value,
          absents: avecListe.checked ? absents.value : '', sans_rdv: avecListe.checked ? sansRdv.value : '' });
        return true;
      } catch (e) { msg.textContent = e.message; return false; }
    } }],
  });
  if (r) { toast(l ? 'Ligne corrigée.' : 'Ligne ajoutée : le client la voit dans son espace.'); recharger(); }
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
      h('span', { class: 'jn-ligne__qui' }, h('small', { class: `jn-type jn-type--${l.type}` }, l.par === 'direction' ? `${TYPES[l.type] || ''} · saisie direction` : (TYPES[l.type] || '')), l.agent,
        l.id && l.type !== 'incident' ? h('span', { class: 'jn-gestes' },
          h('button', { class: 'jn-retirer', type: 'button', title: 'Corriger cette ligne', onclick: () => editerLigne(d, l, recharger) }, 'Modifier'),
          h('button', { class: 'jn-retirer', type: 'button', title: 'Retirer cette ligne', onclick: async () => {
            if (!(await confirmer('Retirer cette ligne de la main courante ? Elle disparaît aussi pour l’agent et le client.', { titre: 'Retirer la ligne', ok: 'Retirer', danger: true }))) return;
            try { await api('mod.journal.retirer', { id: l.id }); toast('Ligne retirée.'); recharger(); } catch (e) { erreur(e); }
          } }, 'Retirer'))
          : ['prise', 'fin'].includes(l.type) ? h('a', { class: 'jn-retirer', href: '#/pointage', title: 'Les prises et fins de service viennent du pointage' }, 'Pointage') : null));
  });
  const imprimer = () => imprimerCahier(d);
  const cahier = h('section', { class: 'carte jn-cahier' },
    h('header', { class: 'carte__tete' },
      h('div', null, h('h2', null, d.site.nom), h('p', { class: 'muet' }, [d.site.client, jourLisible(jour)].filter(Boolean).join(' · '))),
      h('div', { class: 'jn-tete-droite' },
        h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: () => editerLigne(d, null, recharger) }, icone('plus'), h('span', null, 'Ajouter une ligne')),
        h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: recharger, title: 'Actualiser' }, icone('activite'), h('span', null, 'Actualiser')),
        h('button', { class: 'btn btn--ghost btn--petit', type: 'button', onclick: imprimer, disabled: !d.lignes.length }, icone('imprimer'), h('span', null, 'PDF')))),
    resumeJour(d.resume).length ? h('dl', { class: 'jn-resume' }, resumeJour(d.resume).map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v)))) : null,
    d.lignes.length ? h('ol', { class: 'jn-lignes' }, lignes)
      : h('div', { class: 'jn-rien' }, h('p', null, jour === auj ? 'Rien n’est encore noté aujourd’hui.' : 'Rien n’a été noté ce jour-là.'),
        h('p', { class: 'muet' }, 'Les agents notent depuis l’appli BDA Équipe (bouton « Noter » pendant le service). La prise et la fin de service et les incidents s’ajoutent tout seuls. Vous pouvez aussi recopier un cahier papier avec « Ajouter une ligne ».')));

  /* Réglages du site */
  const boutons = h('textarea', { class: 'input', rows: 6, placeholder: 'Un bouton par ligne' }, d.reglages.boutons.join('\n'));
  const listeC = h('input', { type: 'checkbox', checked: d.reglages.liste });
  const client = h('input', { type: 'checkbox', checked: d.reglages.client });
  const enregistrer = h('button', { class: 'btn btn--gold btn--petit', type: 'button', onclick: async () => {
    enregistrer.disabled = true;
    try {
      await api('mod.journal.reglages', { site_id: siteId, boutons: boutons.value.split('\n').map((x) => x.trim()).filter(Boolean), liste: listeC.checked, client: client.checked });
      toast('Réglages du site enregistrés : l’appli des agents est à jour.');
      recharger();
    } catch (e) { erreur(e); enregistrer.disabled = false; }
  } }, 'Enregistrer');
  const reglages = h('section', { class: 'carte jn-reglages' },
    h('header', { class: 'carte__tete' }, h('h2', null, 'Réglages de ce site')),
    champ('Boutons rapides de l’agent', boutons, 'Un par ligne, 12 au plus. L’agent les touche : l’heure se note toute seule.'),
    h('label', { class: 'case' }, listeC, h('span', null, h('b', null, 'Liste de rendez-vous à l’accueil'), h('small', { class: 'muet mx-bloc' }, 'À la « Fermeture au public », l’agent indique le nombre d’absents sur la liste et de personnes venues sans rendez-vous.'))),
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
    .res { display: flex; gap: 0; border: .75pt solid #d9d6cf; margin: 0 0 12pt; } .res div { flex: 1; padding: 6pt 8pt; border-left: .75pt solid #d9d6cf; } .res div:first-child { border-left: 0; }
    .res small { display: block; font-size: 7.5pt; letter-spacing: .1em; text-transform: uppercase; color: #5c5a56; } .res b { font-size: 13pt; font-weight: 500; }
    footer { margin-top: 16pt; font-size: 8pt; color: #8a877f; display: flex; justify-content: space-between; }
  </style></head><body>
    <header><div><div class="marque">BDA<i></i></div><h1>Main courante · ${echapper(d.site.nom)}</h1><p class="sous">${echapper(date)}${d.site.client ? ` · ${echapper(d.site.client)}` : ''}</p></div>
    </header>
    ${resumeJour(d.resume).length ? `<div class="res">${resumeJour(d.resume).map(([k, v]) => `<div><small>${echapper(k)}</small><b>${echapper(v)}</b></div>`).join('')}</div>` : ''}
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

