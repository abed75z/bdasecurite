/* =========================================================
   ESPACE ADMIN BDA — barre de commande (Ctrl + K ou « / »)
   On tape : une page, un client, un n° de devis / facture, un agent…
   ou une commande directe :
     note Rappeler M. Dupont demain      → enregistre une note
     devis Hôtel Lutetia                 → nouveau devis pour ce client
     facture Consulat                    → nouvelle facture pour ce client
     bandeau Fermé le 25 décembre        → publie le bandeau d'annonce (bandeau off pour l'enlever)
     fermer devis / ouvrir vtc           → ferme ou ouvre un service du site
     site off / site on                  → met le site hors ligne / le remet en ligne
   ========================================================= */
import { api, h, icone, toast, erreur, confirmer, modale } from './outils.js';

const sansAccent = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const SERVICES = { devis: 'devis', vtc: 'vtc', recrutement: 'recrutement', candidature: 'recrutement', candidatures: 'recrutement', avis: 'avis' };
const NOMS_SERVICES = { devis: 'Demandes de devis', vtc: 'Réservation VTC', recrutement: 'Candidatures', avis: 'Dépôt d’avis' };
const LIB_STATUT = { brouillon: 'brouillon', envoye: 'envoyé', envoyee: 'envoyée', accepte: 'accepté', refuse: 'refusé', payee: 'payée', annulee: 'annulée', attente: 'à confirmer', confirmee: 'confirmée', terminee: 'terminée' };

export const AIDE_COMMANDES = [
  ['note Appeler le Consulat lundi', 'Enregistre une note en une ligne'],
  ['devis Hôtel Lutetia', 'Nouveau devis déjà au nom du client'],
  ['facture Consulat', 'Nouvelle facture déjà au nom du client'],
  ['bandeau Fermé le 25 décembre', 'Publie un bandeau en haut du site'],
  ['bandeau off', 'Retire le bandeau'],
  ['fermer devis · ouvrir vtc', 'Ferme ou ouvre un service (devis, vtc, recrutement, avis)'],
  ['site off · site on', 'Met le site hors ligne / le remet en ligne'],
  ['FA-2026 · Dupont · Karim', 'Retrouve une facture, un client, un agent, une note…'],
];

export function installerPalette({ menu, aller, deconnexion, compteurs }) {
  let index = null, indexDate = 0;
  let fond = null, champ, liste, resultats = [], choix = 0;

  const chargerIndex = async () => {
    if (index && Date.now() - indexDate < 60000) return;
    try { ({ index } = await api('recherche')); indexDate = Date.now(); } catch (e) { index = index || {}; }
  };

  /* ----- Actions ----- */
  const site = async (donnees, message) => {
    try { await api('site.enregistrer', donnees); toast(message); compteurs(); } catch (e) { erreur(e); }
  };
  const horsLigne = async (actif) => {
    if (actif && !(await confirmer('Mettre le site hors ligne ? Les visiteurs verront la page « Maintenance » avec vos numéros. Vous continuerez de voir le site.', { titre: 'Site hors ligne', ok: 'Mettre hors ligne', danger: true }))) return;
    try {
      await api('site.horsligne', actif ? { actif: true, message: '' } : { actif: false });
      toast(actif ? 'Site hors ligne : les visiteurs voient la page Maintenance.' : 'Site de nouveau en ligne pour tout le monde.');
      compteurs();
      if (location.hash.startsWith('#/site')) window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (e) { erreur(e); }
  };
  const nouveauDoc = (type, client) => {
    if (client) sessionStorage.setItem(`bda-prefill-${type}`, JSON.stringify({ client: { nom: client, adresse: '' } }));
    aller(type === 'devis' ? '#/devis/nouveau' : '#/factures/nouveau');
  };
  const aide = () => modale({
    titre: 'Commandes rapides',
    large: true,
    contenu: [
      h('p', { class: 'astuce' }, 'Ouvrez la barre avec Ctrl + K (ou la touche « / »), tapez, puis Entrée.'),
      h('ul', { class: 'aide-cmd' }, AIDE_COMMANDES.map(([cmd, txt]) => h('li', null, h('code', null, cmd), h('span', null, txt)))),
    ],
    actions: [{ libelle: 'Compris', classe: 'btn--gold', valeur: true, submit: true }],
  });

  /* ----- Commandes tapées (avec un texte après le mot-clé) ----- */
  function commandesTapees(brut) {
    const q = brut.trim();
    const n = sansAccent(q);
    const out = [];
    let m;
    if ((m = q.match(/^(?:note|n)\s+(.+)$/i))) {
      const texte = m[1].trim();
      out.push({ ic: 'crayon', titre: `Enregistrer la note : « ${texte.slice(0, 70)}${texte.length > 70 ? '…' : ''} »`, sous: 'Entrée pour enregistrer · retrouvez-la dans Notes', run: async () => {
        try { await api('note.enregistrer', { texte, epingle: false }); toast('Note enregistrée.'); index = null; } catch (e) { erreur(e); }
      } });
    }
    if ((m = q.match(/^devis\s+(.+)$/i))) { const client = m[1].trim(); out.push({ ic: 'devis', titre: `Nouveau devis pour « ${client} »`, sous: 'Devis', run: () => nouveauDoc('devis', client) }); }
    if ((m = q.match(/^factures?\s+(.+)$/i))) { const client = m[1].trim(); out.push({ ic: 'facture', titre: `Nouvelle facture pour « ${client} »`, sous: 'Factures', run: () => nouveauDoc('facture', client) }); }
    if (/^bandeau\s+(off|non|stop|masquer|retirer|enlever)$/i.test(q)) out.push({ ic: 'site', titre: 'Retirer le bandeau d’annonce du site', sous: 'Contrôle du site', run: () => site({ bandeau: { actif: false } }, 'Bandeau retiré du site.') });
    else if ((m = q.match(/^bandeau\s+(.+)$/i))) {
      const texte = m[1].trim().slice(0, 160);
      out.push({ ic: 'site', titre: `Publier le bandeau : « ${texte} »`, sous: 'En haut de toutes les pages du site', run: () => site({ bandeau: { actif: true, texte, lien: '', libelleLien: '' } }, 'Bandeau publié sur le site.') });
    }
    if ((m = n.match(/^(fermer|ouvrir)\s+(devis|vtc|recrutement|candidatures?|avis)\b/))) {
      const k = SERVICES[m[2]];
      const ouvrir = m[1] === 'ouvrir';
      out.push({ ic: ouvrir ? 'coche' : 'cadenas', titre: `${ouvrir ? 'Ouvrir' : 'Fermer'} : ${NOMS_SERVICES[k]}`, sous: 'Service du site', run: () => site({ [k]: ouvrir }, `${NOMS_SERVICES[k]} : ${ouvrir ? 'ouvert' : 'fermé'} sur le site.`) });
    }
    if (/^(site\s+(off|hors\s*ligne|ferme|coupe|maintenance)|maintenance|couper le site)$/.test(n)) out.push({ ic: 'cadenas', danger: true, titre: 'Mettre le site hors ligne (maintenance)', sous: 'Demande confirmation', run: () => horsLigne(true) });
    if (/^(site\s+(on|en\s*ligne|ouvert|remettre))$/.test(n)) out.push({ ic: 'coche', titre: 'Remettre le site en ligne', sous: 'Visible par tout le monde', run: () => horsLigne(false) });
    return out.map((c) => ({ ...c, groupe: 'Commande' }));
  }

  /* ----- Commandes fixes et pages ----- */
  const FIXES = () => [
    { ic: 'devis', titre: 'Nouveau devis', mots: 'creer ajouter', run: () => nouveauDoc('devis') },
    { ic: 'facture', titre: 'Nouvelle facture', mots: 'creer ajouter', run: () => nouveauDoc('facture') },
    { ic: 'crayon', titre: 'Nouvelle note', mots: 'ecrire bloc notes idee', run: () => aller('#/notes/nouvelle') },
    { ic: 'badge', titre: 'Nouvelle carte agent', mots: 'carte pro badge', run: () => aller('#/cartes/nouvelle') },
    { ic: 'flyer', titre: 'Nouveau flyer', mots: 'affiche', run: () => aller('#/flyers/nouveau') },
    { ic: 'visite', titre: 'Nouvelle carte de visite', mots: 'visite', run: () => aller('#/visites/nouvelle') },
    { ic: 'cadenas', titre: 'Mettre le site hors ligne', mots: 'site off maintenance couper fermer', danger: true, run: () => horsLigne(true) },
    { ic: 'coche', titre: 'Remettre le site en ligne', mots: 'site on ouvrir', run: () => horsLigne(false) },
    { ic: 'couronne', titre: 'Mon accès chef (ma carte pro)', mots: 'carte pro moi chef gerant', run: () => { location.href = '/admin/moi'; } },
    { ic: 'bouclier', titre: 'Accès & sécurité', mots: 'appareils connexions journal historique securite', run: () => aller('#/securite') },
    { ic: 'site', titre: 'Voir le site public', mots: 'ouvrir bdasecurite', run: () => window.open('/', '_blank', 'noopener') },
    { ic: 'telecharger', titre: 'Télécharger une sauvegarde', mots: 'export backup', run: () => aller('#/parametres') },
    { ic: 'sortie', titre: 'Se déconnecter', mots: 'deconnexion logout quitter', run: deconnexion },
    { ic: 'commande', titre: 'Aide : toutes les commandes', mots: 'aide help ?', run: aide },
  ].map((c) => ({ ...c, groupe: 'Actions' }));
  const PAGES = () => menu.filter((m) => !m.groupe).map((m) => ({ groupe: 'Pages', ic: m.icone, titre: m.libelle, mots: m.route, run: () => aller(`#/${m.route}`) }))
    .concat([{ groupe: 'Pages', ic: 'reglages', titre: 'Paramètres', mots: 'tva iban mot de passe reglages', run: () => aller('#/parametres') }]);

  function donnees() {
    const I = index || {};
    return [
      ...(I.documents || []).map((d) => ({ groupe: d.type === 'facture' ? 'Factures' : 'Devis', ic: d.type === 'facture' ? 'facture' : 'devis', titre: `${d.type === 'facture' ? 'Facture' : 'Devis'} ${d.numero}`, sous: [d.client, LIB_STATUT[d.statut] || d.statut].filter(Boolean).join(' · '), mots: `${d.client} ${d.numero}`, run: () => aller(`#/${d.type === 'facture' ? 'factures' : 'devis'}/${d.id}`) })),
      ...(I.clients || []).map((c) => ({ groupe: 'Clients', ic: 'clients', titre: c.nom, sous: c.tel || 'Client', mots: c.tel, run: () => aller('#/clients') })),
      ...(I.agents || []).map((a) => ({ groupe: 'Agents', ic: 'agents', titre: a.nom, sous: `${a.poste || 'Agent'} · ${a.categorie === 'secondaire' ? 'Renfort' : 'Équipe principale'}`, run: () => aller(`#/agents/${a.id}`) })),
      ...(I.notes || []).map((n) => ({ groupe: 'Notes', ic: 'crayon', titre: n.texte.split('\n')[0].slice(0, 80), sous: 'Note', mots: n.texte, run: () => aller(`#/notes/${n.id}`) })),
      ...(I.reservations || []).map((r) => { const d = typeof r.data === 'string' ? JSON.parse(r.data || '{}') : (r.data || {}); return { groupe: 'Réservations VTC', ic: 'voiture', titre: `${r.ref} — ${d.nom || ''}`, sous: `${String(r.date_course).slice(8, 10)}/${String(r.date_course).slice(5, 7)} · ${LIB_STATUT[r.statut] || r.statut}`, mots: `${d.depart?.label || ''} ${d.arrivee?.label || ''}`, run: () => aller('#/vtc') }; }),
    ];
  }

  function chercher(q) {
    const n = sansAccent(q);
    const tapees = commandesTapees(q);
    if (!n) return [...FIXES().slice(0, 8), ...PAGES()];
    const mots = n.split(/\s+/).filter(Boolean);
    const score = (it) => {
      const titre = sansAccent(it.titre);
      const tout = `${titre} ${sansAccent(it.sous)} ${sansAccent(it.mots)}`;
      if (!mots.every((m) => tout.includes(m))) return -1;
      return (titre.startsWith(n) ? 30 : 0) + (titre.includes(n) ? 12 : 0) + mots.filter((m) => titre.includes(m)).length * 3;
    };
    const trouve = [...FIXES(), ...PAGES(), ...donnees()].map((it) => [score(it), it]).filter(([s]) => s >= 0).sort((a, b) => b[0] - a[0]).map(([, it]) => it);
    // Regroupe par rubrique en gardant l'ordre de pertinence des rubriques
    const groupes = new Map();
    trouve.forEach((it) => { if (!groupes.has(it.groupe)) groupes.set(it.groupe, []); if (groupes.get(it.groupe).length < 6) groupes.get(it.groupe).push(it); });
    return [...tapees, ...[...groupes.values()].flat()].slice(0, 40);
  }

  /* ----- Affichage ----- */
  function dessiner() {
    resultats = chercher(champ.value);
    choix = Math.min(choix, Math.max(0, resultats.length - 1));
    let groupe = '';
    const items = [];
    resultats.forEach((it, i) => {
      if (it.groupe !== groupe) { groupe = it.groupe; items.push(h('li', { class: 'palette__groupe', role: 'presentation' }, groupe)); }
      items.push(h('li', {
        class: `palette__item ${i === choix ? 'is-choisi' : ''} ${it.danger ? 'is-danger' : ''} ${it.groupe === 'Commande' ? 'is-commande' : ''}`, role: 'option', 'aria-selected': i === choix ? 'true' : 'false', dataset: { i },
        onmousemove: () => { if (choix !== i) { choix = i; majChoix(); } },
        onclick: () => executer(i),
      }, h('span', { class: 'palette__ic' }, icone(it.ic || 'suivant')), h('span', { class: 'palette__txt' }, h('b', null, it.titre), it.sous ? h('small', null, it.sous) : null), i === choix ? h('kbd', null, '↵') : null));
    });
    if (!resultats.length) items.push(h('li', { class: 'palette__vide' }, 'Aucun résultat. Tapez « aide » pour voir les commandes.'));
    liste.replaceChildren(...items);
  }
  function majChoix() {
    liste.querySelectorAll('.palette__item').forEach((el) => {
      const actif = +el.dataset.i === choix;
      el.classList.toggle('is-choisi', actif);
      el.setAttribute('aria-selected', actif ? 'true' : 'false');
      el.querySelector('kbd')?.remove();
      if (actif) { el.append(h('kbd', null, '↵')); el.scrollIntoView({ block: 'nearest' }); }
    });
  }
  function executer(i) {
    const it = resultats[i];
    if (!it) return;
    fermer();
    Promise.resolve().then(it.run).catch(erreur);
  }
  function fermer() {
    if (!fond) return;
    fond.classList.remove('is-in');
    const f = fond;
    fond = null;
    setTimeout(() => f.remove(), 180);
  }
  async function ouvrir(texte = '') {
    if (fond) return champ.focus();
    choix = 0;
    champ = h('input', { class: 'palette__champ', type: 'text', placeholder: 'Page, client, n° de facture… ou commande : note, devis, bandeau, site off', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Commande ou recherche', role: 'combobox', 'aria-expanded': 'true', value: texte });
    liste = h('ul', { class: 'palette__liste', role: 'listbox' });
    champ.addEventListener('input', () => { choix = 0; dessiner(); });
    champ.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); choix = (choix + 1) % Math.max(1, resultats.length); majChoix(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); choix = (choix - 1 + resultats.length) % Math.max(1, resultats.length); majChoix(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (sansAccent(champ.value) === 'aide' || champ.value.trim() === '?') { fermer(); aide(); } else executer(choix); }
      else if (e.key === 'Escape') { e.preventDefault(); fermer(); }
    });
    fond = h('div', { class: 'palette-fond', onmousedown: (e) => { if (e.target === fond) fermer(); } },
      h('div', { class: 'palette', role: 'dialog', 'aria-label': 'Barre de commande' },
        h('div', { class: 'palette__tete' }, h('span', { class: 'palette__invite', 'aria-hidden': 'true' }, '›'), champ, h('kbd', null, 'Échap')),
        liste,
        h('div', { class: 'palette__pied' }, h('span', null, h('kbd', null, '↑'), h('kbd', null, '↓'), ' naviguer'), h('span', null, h('kbd', null, '↵'), ' ouvrir'), h('span', { class: 'palette__astuce' }, 'Essayez : ', h('code', null, 'note …'), ' ', h('code', null, 'devis …'), ' ', h('code', null, 'site off')))));
    document.body.append(fond);
    requestAnimationFrame(() => fond?.classList.add('is-in'));
    champ.focus();
    dessiner();
    await chargerIndex();
    if (fond) dessiner();
  }

  // Raccourcis clavier : Ctrl/⌘ + K partout, « / » quand on n'est pas en train d'écrire
  document.addEventListener('bda:palette', (e) => ouvrir(e.detail || ''));
  document.addEventListener('keydown', (e) => {
    if (!document.querySelector('.appli')) return; // pas avant la connexion
    const ecrit = e.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (fond) fermer(); else ouvrir(); }
    else if (e.key === '/' && !ecrit && !fond && !document.querySelector('.modale-fond')) { e.preventDefault(); ouvrir(); }
  });
  return { ouvrir, aide };
}
