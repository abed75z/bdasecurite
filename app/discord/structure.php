<?php
/* =========================================================
   DISCORD — installation et réparation du serveur de la direction
   Rôle « Direction », 8 catégories et 34 salons privés (invisibles pour les autres
   membres), commandes /, adresse des interactions, messages fixes (panel, mode d'emploi),
   coffre-fort, et tout le projet de A à Z (historique, documentation, arborescence, services).
   Tout est retrouvé par son nom : relancer l'installation ne crée aucun doublon.
   ========================================================= */
declare(strict_types=1);

require_once __DIR__ . '/sync.php';

const DC_STRUCTURE = [
  'DIRECTION' => [
    ['panel', 'Panneau de commande : boutons et commandes / (réservé à la direction).'],
    ['tableau-de-bord', 'Chiffres clés, mis à jour automatiquement toutes les 30 minutes.'],
    ['journal', 'Tout ce qui se passe sur le site, l’admin, l’espace client et l’espace équipe, minute par minute.'],
    ['rappels', 'Échéances : factures en retard, cartes pro, documents manquants, dates limites.'],
    ['rapports', 'Rapport de la journée chaque soir, de la semaine chaque lundi.'],
  ],
  'COMMERCIAL' => [
    ['demandes', 'Demandes de devis et de rappel envoyées depuis le site.'],
    ['messages-clients', 'Messages des clients (espace client).'],
    ['assistant-site', 'Visiteurs qui demandent un conseiller dans l’assistant du site.'],
    ['activite-clients', 'Espace client : connexions, documents ouverts, devis acceptés.'],
    ['devis', 'Devis : créés, envoyés, acceptés, refusés.'],
    ['factures', 'Factures : émises, payées, en retard.'],
    ['reservations-vtc', 'Réservations VTC faites sur le site.'],
    ['avis-clients', 'Avis déposés sur le site : publier ou refuser.'],
  ],
  'CLIENTS' => [
    ['annuaire-clients', 'Tous les clients en un coup d’œil.'],
    ['dossiers-clients', 'Un dossier par client : coordonnées, devis, factures, messages, espace client.', 15],
  ],
  'EQUIPE' => [
    ['annuaire-agents', 'Tous les agents : poste, téléphone, carte professionnelle, documents.'],
    ['dossiers-agents', 'Un dossier par agent : fiche, photo, documents (liens privés 10 min), planning, heures, absences, incidents.', 15],
    ['planning', 'Planning du jour, chaque matin.'],
    ['pointages', 'Prises et fins de service.'],
    ['absences', 'Demandes de congés et d’absence.'],
    ['main-courante', 'Incidents signalés par les agents.'],
    ['comptes-equipe', 'Espace équipe : demandes d’accès, connexions.'],
    ['documents-agents', 'Documents déposés par les agents, fiches de paie.'],
    ['candidatures', 'Candidatures reçues sur la page Recrutement.'],
  ],
  'VEILLE' => [
    ['appels-offres', 'Appels d’offres publics (BOAMP) en Île-de-France, rappels J-3.'],
    ['entreprises-qui-recrutent', 'Entreprises d’Île-de-France qui vont recruter des agents de sécurité (France Travail · La Bonne Boîte).'],
  ],
  'SITE' => [
    ['etat-du-site', 'Disponibilité, certificat, maintenance, tâches automatiques.'],
    ['securite', 'Connexions à l’admin, tentatives refusées, coffre-fort, réglages sensibles.'],
    ['deploiements', 'Chaque mise à jour du site mise en ligne.'],
  ],
  'PROJET' => [
    ['historique', 'Tout ce qui a été fait, de A à Z.'],
    ['documentation', 'Comment fonctionne chaque partie du site et de l’admin.', 15],
    ['arborescence', 'Les dossiers et fichiers du site.'],
    ['services', 'Les comptes et services utilisés.'],
  ],
  'ACCES' => [
    ['coffre-fort', 'Coffre-fort chiffré : identifiants et mots de passe, affichés à la demande, à vous seul.'],
  ],
];
// Version du contenu fixe (projet, mode d'emploi) : l'augmenter republie ces messages
const DC_VERSION_CONTENU = 1;

/* ---------- Commandes / ---------- */
function dc_commandes(): array
{
  $c = fn(string $nom, string $desc, array $options = []) => ['name' => $nom, 'description' => $desc, 'type' => 1, 'options' => $options, 'default_member_permissions' => '0'];
  $txt = function (string $nom, string $desc, bool $requis = false, bool $auto = false, array $choix = []): array {
    $o = ['type' => 3, 'name' => $nom, 'description' => $desc, 'required' => $requis];
    if ($auto) $o['autocomplete'] = true;
    if ($choix) $o['choices'] = array_map(fn($k, $v) => ['name' => $v, 'value' => $k], array_keys($choix), $choix);
    return $o;
  };
  $int = fn(string $nom, string $desc, int $min, int $max) => ['type' => 4, 'name' => $nom, 'description' => $desc, 'required' => false, 'min_value' => $min, 'max_value' => $max];
  return [
    $c('panel', 'Panneau d’administration : tous les boutons'),
    $c('tableau', 'Tableau de bord : activité, finances, équipe, veille, site'),
    $c('demandes', 'Demandes de devis et de rappel', [$txt('statut', 'Lesquelles', false, false, ['nouvelle' => 'Nouvelles', 'traitee' => 'Traitées', 'archivee' => 'Archivées', 'toutes' => 'Toutes'])]),
    $c('messages', 'Messagerie des clients : lire et répondre'),
    $c('clients', 'Liste des clients', [$txt('recherche', 'Nom, téléphone ou email')]),
    $c('client', 'Dossier complet d’un client', [$txt('nom', 'Nom du client', true, true)]),
    $c('devis', 'Devis', [$txt('statut', 'Lesquels', false, false, ['envoye' => 'En attente de réponse', 'accepte' => 'Acceptés', 'refuse' => 'Refusés', 'brouillon' => 'Brouillons', 'tous' => 'Tous'])]),
    $c('factures', 'Factures', [$txt('filtre', 'Lesquelles', false, false, ['impayees' => 'À encaisser', 'retard' => 'En retard', 'payees' => 'Payées', 'brouillon' => 'Brouillons', 'toutes' => 'Toutes'])]),
    $c('ca', 'Chiffre d’affaires mois par mois', [$int('annee', 'Année', 2023, 2100)]),
    $c('agents', 'Liste des agents'),
    $c('agent', 'Dossier complet d’un agent', [$txt('nom', 'Nom de l’agent', true, true)]),
    $c('planning', 'Planning d’un jour', [$txt('jour', 'aujourd’hui, demain, hier ou JJ/MM')]),
    $c('pointage', 'Qui est en service, heures du jour et du mois'),
    $c('absences', 'Demandes d’absence : accepter ou refuser'),
    $c('incidents', 'Main courante : derniers signalements'),
    $c('comptes', 'Espace équipe : comptes à valider'),
    $c('candidatures', 'Candidatures reçues'),
    $c('avis', 'Avis clients à publier ou refuser'),
    $c('vtc', 'Réservations VTC à venir'),
    $c('assistant', 'Assistant du site : conversations et conseiller demandé'),
    $c('opportunites', 'Veille : appels d’offres et prospects', [$txt('type', 'Lesquelles', false, false, ['tout' => 'Tout à traiter', 'ao' => 'Appels d’offres', 'prospects' => 'Entreprises qui recrutent', 'contactes' => 'Contactés'])]),
    $c('urgent', 'Appels d’offres qui se terminent dans les 7 jours'),
    $c('veille', 'Lancer une collecte de la veille maintenant'),
    $c('site', 'État du site, maintenance et bandeau'),
    $c('recherche', 'Rechercher partout (clients, agents, devis, demandes…)', [$txt('texte', 'Ce que vous cherchez', true)]),
    $c('journal', 'Dernières actions sur le site et l’admin', [$int('nombre', 'Nombre de lignes (5 à 60)', 5, 60)]),
    $c('coffre', 'Coffre-fort : identifiants et mots de passe', [$txt('service', 'Afficher un accès', false, true)]),
    $c('note', 'Ajouter une note épinglée dans l’admin', [$txt('texte', 'La note', true)]),
    $c('sync', 'Mettre à jour tout le serveur maintenant'),
    $c('installer', 'Réparer le serveur : salons, droits, commandes'),
    $c('aide', 'Mode d’emploi du bot'),
  ];
}

/* ---------- Installation ---------- */
function dc_installer(): array
{
  @set_time_limit(280);
  $j = [];
  $moi = dc_api('GET', '/users/@me');
  if (!$moi['ok']) throw new RuntimeException($moi['erreur']);
  $bot = (string)$moi['json']['id'];
  $guild = (string)(dc_config()['guild'] ?? '');
  if ($guild === '') {
    $g = dc_api('GET', '/users/@me/guilds');
    $liste = (array)($g['json'] ?? []);
    if (count($liste) !== 1) throw new RuntimeException(count($liste) ? 'Le bot est sur plusieurs serveurs : gardez-le seulement sur BSG.' : 'Le bot n’est sur aucun serveur : ajoutez-le avec ce lien : ' . dc_lien_autorisation());
    $guild = (string)$liste[0]['id'];
  }
  $gi = dc_api('GET', "/guilds/$guild");
  if (!$gi['ok']) throw new RuntimeException('Serveur inaccessible : ' . $gi['erreur']);
  $owner = (string)$gi['json']['owner_id'];

  // Rôle « Direction » (le gérant) ; le bot doit pouvoir gérer salons et rôles
  $direction = '';
  $permsBot = 0;
  foreach ((array)(dc_api('GET', "/guilds/$guild/roles")['json'] ?? []) as $r) {
    if (mb_strtolower((string)$r['name']) === 'direction') $direction = (string)$r['id'];
    if ((string)($r['tags']['bot_id'] ?? '') === $bot || (string)$r['id'] === $guild) $permsBot |= (int)$r['permissions'];
  }
  if (!($permsBot & (1 << 4)) || !($permsBot & (1 << 28))) throw new RuntimeException('Le bot n’a pas les droits « Gérer les salons » et « Gérer les rôles ». Ouvrez ce lien et autorisez : ' . dc_lien_autorisation($guild));
  if ($direction === '') {
    $r = dc_api('POST', "/guilds/$guild/roles", ['name' => 'Direction', 'color' => DC_OR, 'hoist' => true, 'mentionable' => true, 'permissions' => '0'], ['raison' => 'Installation BDA']);
    if (!$r['ok']) throw new RuntimeException('Rôle Direction : ' . $r['erreur']);
    $direction = (string)$r['json']['id'];
    $j[] = 'Rôle Direction créé';
  }
  $r = dc_api('PUT', "/guilds/$guild/members/$owner/roles/$direction", '');
  if (!$r['ok']) $j[] = 'Rôle Direction non attribué au gérant : ' . $r['erreur'];

  // Droits : tout est privé ; la direction et le bot voient tout
  $prive = [
    ['id' => $guild, 'type' => 0, 'allow' => '0', 'deny' => (string)DC_P_VOIR],
    ['id' => $direction, 'type' => 0, 'allow' => (string)(DC_P_VOIR | DC_P_ECRIRE | DC_P_HISTORIQUE | DC_P_REACTIONS | DC_P_COMMANDES | DC_P_ECRIRE_FILS | DC_P_LIENS | DC_P_FICHIERS), 'deny' => '0'],
    ['id' => $bot, 'type' => 1, 'allow' => (string)(DC_P_VOIR | DC_P_ECRIRE | DC_P_GERER_MESSAGES | DC_P_LIENS | DC_P_FICHIERS | DC_P_HISTORIQUE | DC_P_REACTIONS | DC_P_GERER_FILS | DC_P_CREER_FILS | DC_P_ECRIRE_FILS), 'deny' => '0'],
  ];
  $normaliser = function (array $ow): array {
    $m = [];
    foreach ($ow as $o) $m[(string)$o['id']] = (string)$o['allow'] . '/' . (string)$o['deny'];
    ksort($m);
    return $m;
  };
  $existants = (array)(dc_api('GET', "/guilds/$guild/channels")['json'] ?? []);
  $trouver = function (string $nom, bool $cat, ?string $parent) use (&$existants): ?array {
    foreach ($existants as $c) {
      if (mb_strtolower((string)$c['name']) !== mb_strtolower($nom) || $cat !== ((int)$c['type'] === 4)) continue;
      if ($parent !== null && (string)($c['parent_id'] ?? '') !== $parent) continue;
      return $c;
    }
    return null;
  };
  $salons = [];
  $types = [];
  $crees = 0;
  foreach (DC_STRUCTURE as $nomCat => $liste) {
    $c = $trouver($nomCat, true, null);
    if (!$c) {
      $r = dc_api('POST', "/guilds/$guild/channels", ['name' => $nomCat, 'type' => 4, 'permission_overwrites' => $prive]);
      if (!$r['ok']) throw new RuntimeException("Catégorie $nomCat : " . $r['erreur']);
      $c = $r['json'];
      $existants[] = $c;
      $crees++;
    } elseif ($normaliser((array)($c['permission_overwrites'] ?? [])) !== $normaliser($prive)) {
      dc_api('PATCH', "/channels/{$c['id']}", ['permission_overwrites' => $prive]);
    }
    foreach ($liste as $s) {
      $type = $s[2] ?? 0;
      $x = $trouver($s[0], false, (string)$c['id']) ?? $trouver($s[0], false, null);
      if ($x) {
        $maj = [];
        if ((string)($x['parent_id'] ?? '') !== (string)$c['id']) $maj['parent_id'] = (string)$c['id'];
        if ((string)($x['topic'] ?? '') !== $s[1]) $maj['topic'] = $s[1];
        if ($normaliser((array)($x['permission_overwrites'] ?? [])) !== $normaliser($prive)) $maj['permission_overwrites'] = $prive;
        if ($maj) dc_api('PATCH', "/channels/{$x['id']}", $maj);
      } else {
        $r = dc_api('POST', "/guilds/$guild/channels", ['name' => $s[0], 'type' => $type, 'topic' => $s[1], 'parent_id' => (string)$c['id'], 'permission_overwrites' => $prive]);
        if (!$r['ok'] && $type === 15) $r = dc_api('POST', "/guilds/$guild/channels", ['name' => $s[0], 'type' => 0, 'topic' => $s[1], 'parent_id' => (string)$c['id'], 'permission_overwrites' => $prive]);
        if (!$r['ok']) { $j[] = "Salon #{$s[0]} : " . $r['erreur']; continue; }
        $x = $r['json'];
        $existants[] = $x;
        $crees++;
      }
      $salons[$s[0]] = (string)$x['id'];
      $types[$s[0]] = (int)$x['type'];
    }
  }
  $j[] = count($salons) . ' salons vérifiés' . ($crees ? ", $crees créé(s)" : '');
  dc_config_maj(['guild' => $guild, 'owner' => $owner, 'bot' => $bot, 'roles' => ['direction' => $direction], 'salons' => $salons, 'types' => $types, 'installe' => maintenant()]);

  // Icône du serveur et du bot (si absentes) : l'emblème BDA
  $embleme = dirname(__DIR__, 2) . '/assets/img/embleme-hd.png';
  if (is_file($embleme)) {
    $uri = 'data:image/png;base64,' . base64_encode((string)file_get_contents($embleme));
    if (empty($gi['json']['icon'])) { $r = dc_api('PATCH', "/guilds/$guild", ['icon' => $uri]); $j[] = 'Icône du serveur : ' . ($r['ok'] ? 'ajoutée' : $r['erreur']); }
    if (empty($moi['json']['avatar'])) { $r = dc_api('PATCH', '/users/@me', ['avatar' => $uri]); $j[] = 'Photo du bot : ' . ($r['ok'] ? 'ajoutée' : $r['erreur']); }
  }
  // Adresse des commandes et boutons (Discord vérifie la signature tout de suite)
  $r = dc_api('PATCH', '/applications/@me', ['interactions_endpoint_url' => DC_SITE . '/api/discord.php']);
  $j[] = 'Adresse des interactions : ' . ($r['ok'] ? 'enregistrée' : $r['erreur']);
  $r = dc_api('PUT', '/applications/' . DC_APP_ID . "/guilds/$guild/commands", dc_commandes());
  $j[] = 'Commandes / : ' . ($r['ok'] ? count((array)$r['json']) . ' enregistrées' : $r['erreur']);

  // Contenu fixe : panel, mode d'emploi, coffre-fort, projet de A à Z
  dc_fixe('panel', 'panel', dcv_panel(), true);
  dc_fixe('guide', 'panel', dcv_aide());
  coffre_semer();
  $j[] = 'Coffre-fort : ' . coffre_publier();
  $j[] = 'Projet : ' . dc_publier_projet(true);
  foreach (dc_cron(true) as $l) $j[] = $l;
  journal('securite', 'Discord : serveur installé ou réparé');
  return $j;
}

/* ---------- Coffre-fort : services déjà connus (sans aucun mot de passe) ---------- */
function coffre_semer(): void
{
  if ((int)dc_n('SELECT COUNT(*) FROM coffre') > 0) return;
  $services = [
    ['Hébergement OVHcloud (site, domaine)', 'https://www.ovh.com/manager/', ''],
    ['GitHub (code du site)', 'https://github.com/abed75z/bdasecurite', 'abed75z'],
    ['Gmail BDA', 'https://mail.google.com', BDA_EMAIL],
    ['Google Business Profile', 'https://business.google.com', BDA_EMAIL],
    ['Google Search Console', 'https://search.google.com/search-console', BDA_EMAIL],
    ['Espace admin du site', 'https://bdasecurite.com/admin', ''],
    ['Discord (compte et portail développeur)', 'https://discord.com/developers/applications', ''],
    ['cron-job.org (tâche toutes les 30 min)', 'https://console.cron-job.org', ''],
    ['francetravail.io (API La Bonne Boîte)', 'https://francetravail.io/compte/applications', BDA_EMAIL],
    ['France Travail Pro (espace recruteur)', 'https://entreprise.francetravail.fr', ''],
  ];
  require_once __DIR__ . '/actions.php';
  foreach ($services as [$s, $l, $id]) db()->prepare("INSERT INTO coffre (service, lien, identifiant, secret, note, cree, maj) VALUES (?, ?, ?, '', '', ?, ?)")->execute([$s, $l, $id, maintenant(), maintenant()]);
}

/* =========================================================
   PROJET DE A À Z : historique, documentation, arborescence, services
   ========================================================= */
function dc_publier_projet(bool $force = false): string
{
  $c = dc_config();
  $fait = [];
  if ($force || (int)($c['version_contenu'] ?? 0) < DC_VERSION_CONTENU) {
    $fait[] = dc_publier_documentation();
    $fait[] = dc_publier_services();
    dc_config_maj(['version_contenu' => DC_VERSION_CONTENU]);
  }
  $fait[] = dc_publier_historique();
  $fait[] = dc_publier_arborescence();
  return implode(' · ', array_filter($fait));
}
function dc_etapes_projet(): array
{
  return [
    ['23/09/2026', 'Mise en ligne du site', 'Site bdasecurite.com en ligne chez OVH, publié automatiquement depuis GitHub. Pages accueil, demande de devis (questionnaire en 4 étapes), recrutement, avis clients, mentions légales. Formulaires envoyés par email et enregistrés.'],
    ['24/09/2026', 'Espace admin et référencement', 'Espace admin sécurisé (devis, factures, planning, clients, agents, demandes, avis). Sept pages services pour Google, plan du site, données structurées, adresses sans « .html », Search Console. Cartes d’agents, flyers, cartes de visite, PDF.'],
    ['25/09/2026', 'Carte de visite digitale', 'Page carte avec QR code, contact à enregistrer (vCard), avis en direct, partage WhatsApp et SMS.'],
    ['26/09/2026', 'Pages secteurs et quartiers', '16 pages : hôtels, commerces, chantiers, bureaux, ambassades, résidences, et Paris 1er, 8e, 9e, 16e, 17e, 20e, La Défense, Neuilly, Boulogne, Saint-Denis. Page en anglais.'],
    ['28/09/2026', 'BDA Terminal', 'Application Windows noire et dorée reliée à l’admin, plus de 200 commandes. Comptes admin et manager dans l’admin.'],
    ['fin 09/2026', 'Gestion complète', 'Réservations VTC en ligne avec calcul du prix, espace client (documents, messagerie, acceptation des devis), fiches de paie, pointage des agents, centre de contrôle (journal, appareils connectés).'],
    ['03/10/2026', 'Assistant du site', 'Fenêtre de discussion : robot qui répond aux questions, conseiller à la demande, intelligence artificielle activable.'],
    ['04/10/2026', 'Nouvelle identité : BDA Security Group', 'Nouveau nom côté clients, logo, thème noir, ivoire et doré, vidéo sur l’accueil. Reel Instagram de lancement, propositions de tenues.'],
    ['06/10/2026', 'Espace équipe et visibilité', 'Espace équipe pour les agents, SSIAP et chauffeurs (planning, paie, documents, congés, main courante, pointage). Menu « Se connecter ». Titres Google, fiche Google Business validée, IndexNow.'],
    ['07/10/2026', 'Veille, notifications et Discord', 'Veille commerciale (appels d’offres BOAMP, entreprises qui recrutent via France Travail), notifications de tout sur le téléphone, site et admin installables, nouvelle icône de l’admin, serveur Discord de la direction : 34 salons, panel, commandes, dossiers clients et agents, coffre-fort.'],
  ];
}
function dc_publier_historique(): string
{
  $etapes = array_map(fn($e) => "**{$e[0]} · {$e[1]}**\n{$e[2]}", dc_etapes_projet());
  dc_fixe('histo-resume', 'historique', ['embeds' => [dc_carte(['entete' => 'Historique', 'titre' => 'BDA Security Group · le projet de A à Z', 'texte' => implode("\n\n", $etapes), 'quand' => false, 'url' => 'https://github.com/abed75z/bdasecurite/commits/main'])]]);
  // Toutes les mises en ligne, jour par jour (dépôt GitHub public)
  $commits = [];
  for ($page = 1; $page <= 5; $page++) {
    try {
      $r = veille_http('GET', "https://api.github.com/repos/abed75z/bdasecurite/commits?per_page=100&page=$page", ['Accept: application/vnd.github+json', 'User-Agent: BDA-Security-Group'], null, 20);
    } catch (Throwable $e) {
      break;
    }
    $l = $r['code'] === 200 ? (json_decode($r['corps'], true) ?: []) : [];
    $commits = array_merge($commits, $l);
    if (count($l) < 100) break;
  }
  if (!$commits) return 'résumé publié (GitHub indisponible)';
  $parJour = [];
  foreach (array_reverse($commits) as $k) {
    $d = date('Y-m-d', strtotime((string)($k['commit']['author']['date'] ?? 'now')));
    $parJour[$d][] = '`' . substr((string)$k['sha'], 0, 7) . '` ' . dc_txt(strtok((string)$k['commit']['message'], "\n") ?: '', 150);
  }
  $lignes = [];
  foreach ($parJour as $d => $l) {
    $lignes[] = '**' . ucfirst(dc_jour_long($d)) . '** · ' . count($l) . ' mise(s) en ligne';
    foreach ($l as $x) $lignes[] = $x;
    $lignes[] = '';
  }
  $n = dc_publier_liste('histo', 'historique', 'Toutes les mises en ligne · ' . count($commits), $lignes, 'https://github.com/abed75z/bdasecurite/commits/main');
  return count($commits) . " mises en ligne ($n messages)";
}
function dc_modules_projet(): array
{
  return [
    ['Site public', "Site bdasecurite.com : accueil avec vidéo, prestations (sécurité privée, SSIAP, événementiel, protection rapprochée, chauffeur VTC), tarifs, avis, recrutement, réservation VTC, pages secteurs et quartiers, version anglaise.\nThème noir, ivoire et doré. Contenu, prix et bandeau d’annonce modifiables dans l’admin (Contenu & tarifs, Contrôle du site). Site installable sur téléphone.", 'index.html, devis.html, recrutement.html, tarifs, avis.html, reserver, pages *-paris.html, assets/', 'Admin > Contrôle du site, Contenu & tarifs'],
    ['Référencement Google', "Titres et descriptions de chaque page, données structurées (entreprise, services), plan du site (sitemap.xml), robots.txt, adresses sans « .html », redirection vers https://bdasecurite.com, Search Console, IndexNow (Bing), fiche Google Business Profile validée, lien et QR code pour les avis Google.", 'sitemap.xml, robots.txt, .htaccess, app/pages/donnees.php', 'Search Console, Google Business Profile'],
    ['Espace admin', "Console privée bdasecurite.com/admin : accueil (ce qui attend), demandes, opportunités, assistance, messages, devis, factures, PDF clients, fiches clients, agents, planning, pointage, espace équipe, fiches de paie, candidatures, contrôle du site, contenu & tarifs, avis, réservations VTC, cartes & flyers, notes, notifications, accès & sécurité.\nComptes admin (tout) et manager (gestion courante). Application installable, icône noir et or « ADMIN ».", 'admin/index.php, admin/api.php, admin/js/*.js, admin/admin.css', 'bdasecurite.com/admin'],
    ['Devis et factures', "Création, numérotation automatique (DV-AAAA-, FA-AAAA-), statuts (brouillon, envoyé, accepté, refusé, payée, annulée), PDF, dépôt dans l’espace client, échéances et retards, mentions légales.\nUne facture envoyée ne se supprime pas (obligation légale).", 'admin/js/documents.js, admin/js/pdf.js', 'Admin > Devis, Factures'],
    ['Planning et pointage', "Planning mensuel par client et site (horaires par agent et par jour, codes CP, M, ABS, R). Pointage par lien personnel ou depuis l’Espace équipe, avec position GPS. Heures du mois par agent.", 'admin/js/planning.js, admin/js/pointage.js, api/pointage.php', 'Admin > Planning, Pointage'],
    ['Agents et documents', "Fiche par agent (poste, téléphone, carte professionnelle, validité, équipe principale ou renfort). Documents (identité, carte pro, diplôme, sécurité sociale, RIB, contrat…) rangés HORS du site, servis seulement à l’admin connecté. Cartes professionnelles imprimables avec photo.", 'admin/js/agents.js, admin/js/cartes.js', 'Admin > Agents, Cartes & flyers'],
    ['Fiches de paie', "Calcul et préparation des bulletins, dossier de paie de chaque agent, dépôt des PDF dans l’Espace équipe (l’agent ne voit que les siennes). Réservé au compte admin.", 'admin/js/paie*.js', 'Admin > Fiches de paie'],
    ['Espace client', "bdasecurite.com/espace-client : le client reçoit une invitation, choisit son mot de passe, retrouve ses devis et factures, accepte un devis en ligne, télécharge ses PDF et écrit à BDA.", 'api/client.php, espace-client', 'Admin > Fiches clients, Messages'],
    ['Espace équipe', "bdasecurite.com/espace-equipe : agents de sécurité, SSIAP et chauffeurs. Compte créé par l’agent puis validé par la direction. Planning, fiches de paie, documents, congés, main courante (avec photos), pointage, appareils mémorisés.", 'api/equipe.php, espace-equipe.html, assets/js/espace-equipe.js', 'Admin > Espace équipe'],
    ['Réservations VTC', "Page /reserver : trajet ou mise à disposition, berline ou van, forfaits aéroports, prix calculé et vérifié sur le serveur, lien de suivi pour le client, confirmation ou annulation par email.", 'api/reservation.php, reserver.html', 'Admin > Réservations VTC'],
    ['Assistant du site', "Fenêtre de discussion sur toutes les pages : réponses automatiques (prestations, tarifs, zones, recrutement), conseiller à la demande, intelligence artificielle activable avec une clé API. Jamais d’informations privées.", 'api/assistant.php, app/assistant.php', 'Admin > Assistance site'],
    ['Veille commerciale', "Toutes les 30 minutes : appels d’offres publics (BOAMP) en Île-de-France notés selon des mots-clés (sécurité, gardiennage, SSIAP, transport de personnes…), et entreprises qui vont recruter des agents de sécurité (France Travail · La Bonne Boîte). Statut à traiter / contacté / ignoré, note, rappel à J-3.", 'app/veille/*.php, api/veille-cron.php', 'Admin > Opportunités'],
    ['Notifications', "Chaque nouveauté (demande, message, réservation, avis, candidature, espace équipe, main courante, pointage, veille, connexion à l’admin) part en notification sur les appareils abonnés, sans donnée personnelle. Catégories activables une par une.", 'app/notifications.php, admin/sw.js, admin/js/notifications.js', 'Admin > Notifications'],
    ['Serveur Discord', "Serveur BSG : rôle Direction, 34 salons privés. Le bot « BDA Bot » publie toutes les alertes, tient à jour le panel, le tableau de bord, les annuaires, les dossiers clients et agents, le planning, les rappels et rapports, l’état du site et les mises en ligne. Commandes / et boutons pour tout gérer depuis Discord. Coffre-fort chiffré.", 'app/discord/*.php, api/discord.php, api/lien.php', 'Admin > Notifications (Discord)'],
    ['Sécurité et données', "Données dans une base SQLite placée HORS du dossier public (jamais sur GitHub). Secrets dans un fichier .env privé. Mots de passe hachés, sessions limitées, jeton anti-falsification, tentatives limitées, journal de toutes les actions, appareils déconnectables à distance. Documents servis seulement après connexion ou par lien privé de 10 minutes.", 'app/bootstrap.php, app/auth.php, .htaccess', 'Admin > Accès & sécurité'],
    ['Hébergement et mise en ligne', "Hébergement mutualisé OVH (bdasecurite.com, certificat HTTPS). Le code est sur GitHub (dépôt public, sans aucune donnée) : chaque mise à jour est en ligne en moins d’une minute. Tâche automatique toutes les 30 minutes via cron-job.org.", '.htaccess, .gitignore', 'OVH, GitHub, cron-job.org'],
    ['Outils hors site', "BDA Terminal : application Windows reliée à l’admin. BDA Gestion : ancien outil local de devis et factures. Reel Instagram de lancement, propositions de tenues, affiche QR pour les avis Google.", 'Bureau : BDA Terminal.exe, BDA Gestion', 'Sur le PC du gérant'],
  ];
}
function dc_publier_documentation(): string
{
  $salon = dc_salon('documentation');
  if ($salon === '') return '';
  $forum = (int)(dc_config()['types']['documentation'] ?? 0) === 15;
  $n = 0;
  foreach (dc_modules_projet() as $k => [$titre, $texte, $fichiers, $ou]) {
    $msg = ['embeds' => [dc_carte(['entete' => 'Documentation', 'titre' => $titre, 'texte' => $texte, 'quand' => false, 'champs' => [dc_champ('Fichiers', '`' . str_replace(', ', '`, `', $fichiers) . '`', false), dc_champ('Où', $ou, false)]])]];
    $ref = 'doc-' . $k;
    $emp = sha1((string)json_encode($msg));
    $f = dc_un("SELECT * FROM dc_fils WHERE type = 'doc' AND ref = ?", [$ref]);
    if ($f && $f['empreinte'] === $emp) { $n++; continue; }
    if ($f) {
      $r = dc_modifier($forum ? $f['fil'] : $salon, $f['message'], $msg);
      if ($r['ok']) { db()->prepare("UPDATE dc_fils SET empreinte = ?, maj = ? WHERE type = 'doc' AND ref = ?")->execute([$emp, maintenant(), $ref]); $n++; continue; }
    }
    $r = $forum ? dc_api('POST', "/channels/$salon/threads", ['name' => dc_couper($titre, 100), 'auto_archive_duration' => 10080, 'message' => dc_message($msg)]) : dc_api('POST', "/channels/$salon/messages", dc_message($msg));
    if (!$r['ok']) continue;
    $id = (string)$r['json']['id'];
    db()->prepare('INSERT OR REPLACE INTO dc_fils (type, ref, canal, fil, message, empreinte, maj) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute(['doc', $ref, $salon, $forum ? $id : '', $id, $emp, maintenant()]);
    $n++;
    usleep(400000);
  }
  return "$n fiches de documentation";
}
function dc_publier_services(): string
{
  $s = [
    ['OVHcloud', 'Hébergement du site, nom de domaine bdasecurite.com, certificat HTTPS, emails techniques.'],
    ['GitHub', 'Code du site (dépôt public sans aucune donnée) ; chaque mise à jour part en ligne automatiquement.'],
    ['Google Search Console', 'Présence du site dans Google : pages indexées, plan du site.'],
    ['Google Business Profile', 'Fiche « BDA Security Group » sur Google Maps et la recherche, avis Google.'],
    ['Gmail', 'bdasecurite@gmail.com : formulaires, emails de l’admin, prospection.'],
    ['FormSubmit', 'Copie par email des formulaires du site (en plus de l’admin).'],
    ['cron-job.org', 'Lance la tâche automatique toutes les 30 minutes (veille, Discord, rappels).'],
    ['BOAMP (open data)', 'Annonces officielles des marchés publics : appels d’offres de sécurité et de transport.'],
    ['France Travail · francetravail.io', 'API La Bonne Boîte : entreprises qui vont recruter des agents de sécurité. Espace recruteur pour publier des offres.'],
    ['Discord', 'Serveur BSG de la direction et bot « BDA Bot » (alertes, panel, dossiers, coffre-fort).'],
    ['Notifications Web Push', 'Notifications sur téléphone et ordinateur (Google, Apple, Mozilla), chiffrées de bout en bout.'],
    ['IndexNow', 'Signale les nouvelles pages à Bing et Yandex.'],
    ['Unsplash', 'Photos libres de droits utilisées sur le site (crédits dans les mentions légales).'],
  ];
  dc_fixe('services', 'services', ['embeds' => [dc_carte(['entete' => 'Services', 'titre' => 'Comptes et services utilisés', 'quand' => false, 'texte' => implode("\n", array_map(fn($x) => "**{$x[0]}** · {$x[1]}", $s)) . "\n\nIdentifiants et mots de passe : salon #coffre-fort."])]]);
  return 'services publiés';
}
function dc_publier_arborescence(): string
{
  $racine = dirname(__DIR__, 2);
  $desc = [
    'admin' => 'espace admin (page, API, modules JavaScript, styles, icônes)', 'api' => 'adresses appelées par le site, l’espace client, l’espace équipe, cron-job.org et Discord',
    'app' => 'code serveur privé, inaccessible depuis Internet (socle, connexion, notifications, veille, Discord, générateur de pages)', 'assets' => 'styles, scripts, images, vidéos et polices du site',
    'outils' => 'scripts annexes (avis Google Sheets)', 'docs' => 'documentation',
  ];
  $lignes = ['**/** · pages du site : ' . count(glob($racine . '/*.html') ?: []) . ' pages HTML, .htaccess (adresses, sécurité, cache), sitemap.xml, robots.txt, manifestes, service workers'];
  foreach (glob($racine . '/*', GLOB_ONLYDIR) ?: [] as $d) {
    $nom = basename($d);
    if ($nom[0] === '.' || $nom === 'bda-admin-data') continue;
    $sous = [];
    $fichiers = 0;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($d, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) if ($f->isFile()) $fichiers++;
    foreach (glob($d . '/*') ?: [] as $x) {
      $b = basename($x);
      $sous[] = is_dir($x) ? "$b/ (" . count(glob($x . '/*') ?: []) . ')' : $b;
    }
    $lignes[] = "**$nom/** · " . ($desc[$nom] ?? 'dossier') . " · $fichiers fichier(s)";
    $lignes[] = '`' . dc_couper(implode(' · ', $sous), 900) . '`';
  }
  $lignes[] = '';
  $lignes[] = '**Hors du site** (jamais en ligne ni sur GitHub) : base de données, fichiers .env, documents des agents, fiches de paie, photos de main courante, sessions.';
  $n = dc_publier_liste('arbo', 'arborescence', 'Arborescence du site', $lignes, 'https://github.com/abed75z/bdasecurite');
  return "arborescence ($n message(s))";
}
