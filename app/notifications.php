<?php
/* =========================================================
   NOTIFICATIONS DE L'ADMIN — tout ce qui arrive sur le site, dans l'espace client,
   dans l'espace équipe et dans la veille part en notification sur les appareils
   abonnés (bouton « Activer les notifications » de l'admin).
   - Aucune donnée personnelle dans une notification (ni nom, ni téléphone, ni contenu de message) :
     juste ce qui est arrivé ; le détail s'ouvre dans l'admin, protégé par la connexion.
   - L'envoi se fait APRÈS la réponse au visiteur : le site ne ralentit pas.
   - Chaque catégorie peut être coupée dans l'admin (Notifications).
   - Envoi chiffré de bout en bout jusqu'au téléphone (Web Push, clés VAPID du .env privé).
   ========================================================= */
declare(strict_types=1);

// Catégories proposées dans l'admin (toutes activées par défaut)
const NOTIF_CATEGORIES = [
  'demandes' => ['Demandes de devis et de rappel', 'Chaque formulaire envoyé depuis le site'],
  'messages' => ['Messages des clients', 'Espace client : nouveau message'],
  'assistance' => ['Assistant du site', 'Un visiteur demande un conseiller ou vous répond'],
  'espace_client' => ['Activité des clients', 'Devis accepté, document ouvert, connexion à l’espace client'],
  'avis' => ['Avis clients', 'Nouvel avis à valider'],
  'vtc' => ['Réservations VTC', 'Nouvelle réservation, annulation par le client'],
  'candidatures' => ['Candidatures', 'Page Recrutement du site'],
  'equipe' => ['Espace équipe', 'Demandes d’accès, connexions, documents déposés par les agents'],
  'absences' => ['Congés et absences', 'Demandes des agents'],
  'incidents' => ['Main courante', 'Incidents signalés (les urgents en priorité)'],
  'pointages' => ['Prises et fins de service', 'Pointage des agents'],
  'veille' => ['Veille commerciale', 'Appels d’offres, recrutements, rappels J-3'],
  'rappels' => ['Rappels du matin', 'Factures en retard, cartes pro qui expirent, demandes en attente'],
  'securite' => ['Sécurité', 'Connexions à l’admin, tentatives refusées'],
];

function notif_prefs(): array
{
  static $p = null;
  if ($p !== null) return $p;
  $p = array_fill_keys(array_keys(NOTIF_CATEGORIES), true);
  try {
    $st = db()->prepare("SELECT v FROM reglages WHERE k = 'notif_prefs'");
    $st->execute();
    $v = json_decode((string)$st->fetchColumn(), true);
    if (is_array($v)) foreach ($v as $k => $actif) if (isset($p[$k])) $p[$k] = (bool)$actif;
  } catch (Throwable $e) { /* base indisponible : tout reste activé */ }
  return $p;
}
function notif_prefs_enregistrer(array $prefs): array
{
  $p = array_fill_keys(array_keys(NOTIF_CATEGORIES), true);
  foreach ($prefs as $k => $actif) if (isset($p[$k])) $p[$k] = (bool)$actif;
  db()->prepare("INSERT INTO reglages (k, v) VALUES ('notif_prefs', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")->execute([json_encode($p)]);
  return $p;
}

/* Prépare une notification ; elle partira à la fin de la requête.
   $url : page de l'admin à ouvrir au toucher (ex. '/admin/#/demandes/12').
   $sauf : n° du compte admin à ne pas prévenir (celui qui a fait l'action). */
function notifier(string $categorie, string $titre, string $texte, string $url = '/admin/', string $tag = '', int $sauf = 0): void
{
  if (!isset(NOTIF_CATEGORIES[$categorie])) return;
  $tag = $tag !== '' ? $tag : $categorie . '-' . bin2hex(random_bytes(3));
  $url = str_starts_with($url, '/admin/') ? $url : '/admin/';
  $GLOBALS['__notifs'][] = [
    'categorie' => $categorie,
    'title' => mb_substr(trim($titre), 0, 90),
    'body' => mb_substr(trim((string)preg_replace('/\s+/', ' ', $texte)), 0, 220),
    'url' => $url,
    'tag' => $tag,
    'sauf' => $sauf,
  ];
  // Serveur Discord de la direction : message détaillé dans le bon salon (construit après la réponse)
  if (dc_actif() && !in_array($categorie, ['veille', 'rappels'], true)) {
    dc_file_notif(['notif' => ['categorie' => $categorie, 'titre' => $titre, 'texte' => $texte, 'url' => $url, 'tag' => $tag, 'detail' => (string)($GLOBALS['__dernier_journal'] ?? '')]]);
  }
  notif_programmer();
}
function notif_programmer(): void
{
  static $inscrit = false;
  if (!$inscrit) {
    $inscrit = true;
    register_shutdown_function('notif_envoyer_fin');
  }
}
// Après la réponse : le visiteur n'attend pas l'envoi des notifications
function notif_envoyer_fin(): void
{
  $liste = $GLOBALS['__notifs'] ?? [];
  $GLOBALS['__notifs'] = [];
  $discord = !empty($GLOBALS['__dc_file']);
  if (!$liste && !$discord) return;
  if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
  ignore_user_abort(true);
  if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
  @set_time_limit(120);
  try {
    require_once __DIR__ . '/veille/outils.php';
    require_once __DIR__ . '/veille/webpush.php';
    if ($liste && veille_env('VAPID_PUBLIC_KEY') !== '') {
      $prefs = notif_prefs();
      $badge = notif_total_attente();
      foreach ($liste as $n) {
        if (empty($prefs[$n['categorie']])) continue;
        notif_push(['title' => $n['title'], 'body' => $n['body'], 'url' => $n['url'], 'tag' => $n['tag'], 'badge' => $badge, 'categorie' => $n['categorie']], (int)$n['sauf']);
      }
    }
  } catch (Throwable $e) {
    error_log('[BDA notifications] ' . $e->getMessage());
  }
  if ($discord) {
    try {
      require_once __DIR__ . '/discord/sync.php';
      dc_vider_file(30);
    } catch (Throwable $e) {
      error_log('[BDA discord] ' . $e->getMessage());
    }
  }
}

/* ---------- Serveur Discord de la direction (autorisé par le gérant le 07/10/2026) ---------- */
// Discord prêt : jeton du bot dans le .env privé et serveur installé
function dc_actif(): bool
{
  static $a = null;
  if ($a !== null) return $a;
  try {
    require_once __DIR__ . '/veille/outils.php';
    $st = db()->prepare("SELECT v FROM reglages WHERE k = 'discord'");
    $st->execute();
    $c = json_decode((string)$st->fetchColumn(), true);
    return $a = is_array($c) && !empty($c['salons']) && veille_env('DISCORD_BOT_TOKEN') !== '';
  } catch (Throwable $e) {
    return $a = false;
  }
}
function dc_file_notif(array $donnees, string $salon = ''): void
{
  try {
    db()->prepare('INSERT INTO dc_file (salon, message, cree) VALUES (?, ?, ?)')->execute([$salon, json_encode($donnees, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE), maintenant()]);
    $GLOBALS['__dc_file'] = true;
    notif_programmer();
  } catch (Throwable $e) {
    error_log('[BDA discord file] ' . $e->getMessage());
  }
}
// Chaque ligne du journal part aussi dans #journal (et #securite, #devis… selon le cas)
function notif_journal(string $type, string $message): void
{
  if (!dc_actif()) return;
  dc_file_notif(['journal' => ['t' => $type, 'm' => $message, 'q' => maintenant(), 'a' => appareil()]], 'journal');
}
// Envoie à chaque appareil abonné (sauf ceux du compte $sauf) ; supprime les abonnements expirés
function notif_push(array $donnees, int $sauf = 0): void
{
  foreach (db()->query('SELECT * FROM push_abonnements')->fetchAll() as $abo) {
    if ($sauf && (int)$abo['uid'] === $sauf) continue;
    try {
      $code = webpush_envoyer($abo, $donnees);
      if ($code === 404 || $code === 410) db()->prepare('DELETE FROM push_abonnements WHERE id = ?')->execute([$abo['id']]);
      elseif ($code >= 200 && $code < 300) db()->prepare('UPDATE push_abonnements SET vu = ? WHERE id = ?')->execute([maintenant(), $abo['id']]);
    } catch (Throwable $e) {
      error_log('[BDA push] ' . $e->getMessage());
    }
  }
}
// Nombre d'éléments qui attendent une action (pastille sur l'icône de l'application)
function notif_total_attente(): int
{
  $q = fn(string $sql) => (int)db()->query($sql)->fetchColumn();
  try {
    return $q("SELECT COUNT(*) FROM demandes WHERE statut = 'nouvelle'")
      + $q("SELECT COUNT(*) FROM messages_clients WHERE auteur = 'client' AND lu = 0")
      + $q("SELECT COUNT(*) FROM assist_conv WHERE statut = 'attente' OR (statut = 'equipe' AND non_lu > 0)")
      + $q("SELECT COUNT(*) FROM avis WHERE statut = 'attente'")
      + $q("SELECT COUNT(*) FROM reservations WHERE statut = 'attente'")
      + $q("SELECT COUNT(*) FROM candidatures WHERE statut = 'nouvelle'")
      + $q("SELECT COUNT(*) FROM comptes_equipe WHERE statut = 'attente'")
      + $q("SELECT COUNT(*) FROM absences WHERE statut = 'attente'")
      + $q("SELECT COUNT(*) FROM main_courante WHERE statut = 'nouveau'");
  } catch (Throwable $e) {
    return 0;
  }
}

/* ---------- Rappels du matin (lancés par la tâche automatique, une fois par jour après 8 h) ---------- */
function notif_rappels_du_jour(): void
{
  $jour = date('Y-m-d');
  if ((int)date('G') < 8) return;
  $st = db()->prepare("SELECT v FROM reglages WHERE k = 'notif_rappels_le'");
  $st->execute();
  if ((string)$st->fetchColumn() === $jour) return;
  db()->prepare("INSERT INTO reglages (k, v) VALUES ('notif_rappels_le', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")->execute([$jour]);

  $lignes = [];
  $st = db()->prepare("SELECT COUNT(*) n, COALESCE(SUM(total), 0) t FROM documents WHERE type = 'facture' AND statut = 'envoyee' AND echeance <> '' AND echeance < ?");
  $st->execute([$jour]);
  $f = $st->fetch();
  if ((int)$f['n'] > 0) $lignes[] = (int)$f['n'] . ' facture(s) en retard (' . number_format((float)$f['t'], 0, ',', ' ') . ' €)';
  $st = db()->prepare("SELECT COUNT(*) FROM agents WHERE actif = 1 AND validite <> '' AND validite <= ?");
  $st->execute([date('Y-m-d', strtotime('+30 days'))]);
  $cartes = (int)$st->fetchColumn();
  if ($cartes > 0) $lignes[] = "$cartes carte(s) pro expirée(s) ou à renouveler sous 30 jours";
  $q = fn(string $sql) => (int)db()->query($sql)->fetchColumn();
  $attente = [
    [$q("SELECT COUNT(*) FROM demandes WHERE statut = 'nouvelle'"), 'demande(s) de devis à traiter'],
    [$q("SELECT COUNT(*) FROM absences WHERE statut = 'attente'"), 'demande(s) d’absence en attente'],
    [$q("SELECT COUNT(*) FROM comptes_equipe WHERE statut = 'attente'"), 'compte(s) agent à valider'],
    [$q("SELECT COUNT(*) FROM main_courante WHERE statut = 'nouveau'"), 'incident(s) non lu(s)'],
    [$q("SELECT COUNT(*) FROM reservations WHERE statut = 'attente'"), 'réservation(s) VTC à confirmer'],
  ];
  foreach ($attente as [$n, $lib]) if ($n > 0) $lignes[] = "$n $lib";
  if (!$lignes) return;
  notifier('rappels', 'Ce matin : ' . count($lignes) . ' point(s) à regarder', implode(' · ', $lignes), '/admin/#/', 'rappels-' . $jour);
}
