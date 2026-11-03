/* =========================================================
   ESPACE ADMIN BDA — registre des modules
   Chaque module apporte ses fichiers (app/modules/<nom>.php côté serveur,
   admin/js/modules/<nom>.js ici) et se déclare dans la liste ci-dessous :
   sa page (chargée à la demande), son entrée de menu, son badge dans la cloche,
   ses commandes de la palette Ctrl K. Les pages et le menu du cœur ne bougent pas.

   { route: 'messagerie',                         → #/messagerie (sous-chemins : ctx.params)
     charger: () => import('./messagerie.js'),     → le fichier du module
     page: 'pageMessagerie',                       → la fonction exportée qui affiche la page (ctx)
     menu: { groupe: 'Clients', apres: 'messages', libelle: 'Messagerie', ic: 'mail', badge: 'mails', admin: true },
       (groupe = rubrique du menu ; apres = chemin après lequel s'insérer, sinon en fin de rubrique ;
        sans groupe = en haut, avec les entrées principales)
     cloche: { cle: 'mails', libelle: 'Mails à traiter', ic: 'mail', alerte: false },
     commandes: [{ ic: 'mail', titre: 'Écrire un mail', mots: 'mail email envoyer', href: '#/messagerie/nouveau' }] }
   ========================================================= */
export const MODULES = [
  // Version 12 — la messagerie : factures et devis par mail, relances, contacter agents et clients, boîte de réception de contact@
  { route: 'messagerie', charger: () => import('./mails.js'), page: 'pageMessagerie',
    menu: { groupe: 'Clients', apres: 'messages', libelle: 'Messagerie', ic: 'mail', badge: 'mails' },
    cloche: [{ cle: 'mails', libelle: 'Mails reçus non lus', ic: 'mail' }, { cle: 'relances', libelle: 'Factures en retard à relancer', ic: 'facture', href: '#/messagerie/relances' }],
    commandes: [{ ic: 'mail', titre: 'Écrire un mail (agent, client, groupe)', mots: 'mail email ecrire envoyer message contacter', href: '#/messagerie/nouveau' },
      { ic: 'agents', titre: 'Écrire à tous les agents', mots: 'mail agents equipe groupe tous', href: '#/messagerie/nouveau/groupe/agents' },
      { ic: 'facture', titre: 'Relances de factures', mots: 'relance impaye retard paiement', href: '#/messagerie/relances' }] },
  // Version 13 — le planning nouvelle génération : bourse aux postes, échanges entre agents, besoins récurrents
  { route: 'planif', charger: () => import('./planif.js'), page: 'pagePlanif',
    menu: { groupe: 'Exploitation', apres: 'exploitation', libelle: 'Bourse & échanges', ic: 'agents', badge: 'bourse' },
    cloche: { cle: 'bourse', libelle: 'Échanges de postes à valider', ic: 'agents', alerte: true },
    commandes: [{ ic: 'planning', titre: 'Besoins récurrents des sites', mots: 'besoins recurrents generer postes mois', href: '#/planif/besoins' },
      { ic: 'agents', titre: 'Bourse aux postes', mots: 'bourse postes libres proposer agents', href: '#/planif/bourse' }] },
  // Version 13 — le terrain : classeur de chaque site (consignes lues et signées, documents, urgences, clés), matériel et tenues, contrôles qualité
  { route: 'terrain', charger: () => import('./terrain.js'), page: 'pageTerrain',
    menu: { groupe: 'Exploitation', apres: 'planif', libelle: 'Terrain & qualité', ic: 'bouclier', badge: 'materiel' },
    cloche: { cle: 'materiel', libelle: 'Matériel à récupérer', ic: 'cle', href: '#/terrain/materiel' },
    commandes: [{ ic: 'bouclier', titre: 'Nouveau contrôle qualité sur site', mots: 'controle qualite inspection noter agent visite', href: '#/terrain/controle/nouveau' },
      { ic: 'cle', titre: 'Matériel & tenues', mots: 'materiel tenue talkie badge remettre retour', href: '#/terrain/materiel' }] },
];

// Pages des modules, au format de PAGES (pages.js)
export const PAGES_MODULES = Object.fromEntries(MODULES.filter((m) => m.route && m.charger).map((m) => [m.route, async (ctx) => {
  const mod = await m.charger();
  const page = mod[m.page || 'page'];
  if (typeof page !== 'function') throw new Error(`Page introuvable dans le module ${m.route}.`);
  return page(ctx);
}]));

// Insère les entrées de menu des modules dans un menu d'espace (ESPACES.site.menu)
export function insererMenus(menu) {
  for (const m of MODULES) {
    if (!m.menu || !m.route) continue;
    const { groupe, apres, ...entree } = m.menu;
    const item = { chemin: m.route, ...entree };
    if (menu.some((x) => x.chemin === item.chemin)) continue;
    let i = apres ? menu.findIndex((x) => x.chemin === apres) : -1;
    if (i >= 0) { menu.splice(i + 1, 0, item); continue; }
    if (!groupe) { // en haut, après la dernière entrée principale
      const premierGroupe = menu.findIndex((x) => x.groupe);
      menu.splice(premierGroupe < 0 ? menu.length : premierGroupe, 0, item);
      continue;
    }
    i = menu.findIndex((x) => x.groupe === groupe);
    if (i < 0) { menu.push({ groupe }, item); continue; }
    let fin = i + 1;
    while (fin < menu.length && !menu[fin].groupe) fin++;
    menu.splice(fin, 0, item);
  }
  return menu;
}

// Ce qui attend une action (cloche), au format de A_TRAITER (app.js)
export const CLOCHE_MODULES = MODULES.filter((m) => m.cloche).map((m) => ({ href: `#/${m.route}`, ic: m.menu?.ic || 'suivant', ...m.cloche }));

// Commandes fixes de la palette Ctrl K, au format de FIXES (commandes.js)
export const COMMANDES_MODULES = (aller) => MODULES.flatMap((m) => (m.commandes || []).map((c) => ({
  ic: c.ic || m.menu?.ic || 'suivant', titre: c.titre, mots: c.mots || '', danger: c.danger,
  run: c.run || (() => aller(c.href || `#/${m.route}`)),
})));

// Phrase libre tapée dans Ctrl K : { libre: { titre: 'Demander à l’assistant : « {q} »', ic: 'eclair' } } ouvre #/<route>/demander/<texte>
export const commandesLibres = (q, aller) => MODULES.filter((m) => m.libre && m.route).map((m) => ({
  ic: m.libre.ic || 'eclair', titre: (m.libre.titre || '{q}').replace('{q}', q), mots: q, groupe: m.libre.groupe,
  run: () => aller(`#/${m.route}/demander/${encodeURIComponent(q)}`),
}));

// Au démarrage de l'application (après connexion) : { demarrage: 'nomDeFonction' } dans le fichier du module.
// Sert aux modules qui écoutent des événements (ex. « bda:annulable » → bouton Annuler).
export function demarrerModules(ctx) {
  for (const m of MODULES.filter((x) => x.demarrage && x.charger)) {
    m.charger().then((mod) => mod[m.demarrage]?.(ctx)).catch((e) => console.error(`Module ${m.route || ''}`, e));
  }
}

// Écran de connexion : { connexion: 'nomDeFonction' } ajoute une autre façon de se connecter
// (reçoit { zone, login, connecte(session) }).
export function extensionsConnexion(ctx) {
  for (const m of MODULES.filter((x) => x.connexion && x.charger)) {
    m.charger().then((mod) => mod[m.connexion]?.(ctx)).catch((e) => console.error(`Module ${m.route || ''}`, e));
  }
}
