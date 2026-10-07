<?php
/* =========================================================
   VEILLE COMMERCIALE — lancement automatique (toutes les 30 minutes)
   Appelé par cron-job.org : https://bdasecurite.com/api/veille-cron.php?cle=CODE_SECRET
   (le code secret est affiché dans Admin > Opportunités > Réglages).
   Aussi utilisable en ligne de commande : php api/veille-cron.php
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
require __DIR__ . '/../app/veille/veille.php';

// Serveur Discord de la direction : panel, tableau de bord, dossiers, rappels… et une fois par jour le projet de A à Z
function veille_cron_discord(): void
{
  if (!dc_actif()) return;
  try {
    require_once __DIR__ . '/../app/discord/structure.php';
    dc_cron();
    if ((dc_config()['projet_jour'] ?? '') !== date('Y-m-d')) {
      dc_publier_projet();
      dc_config_maj(['projet_jour' => date('Y-m-d')]);
    }
  } catch (Throwable $e) {
    error_log('[BDA discord cron] ' . $e->getMessage());
  }
}

if (PHP_SAPI === 'cli') {
  $r = veille_lancer('cron');
  veille_cron_discord();
  echo json_encode(['ok' => $r['ok'], 'nouveaux' => $r['nouveaux'] ?? null, 'message' => $r['message'] ?? ''], JSON_UNESCAPED_UNICODE), "\n";
  exit;
}

entetes_securite();
header('Cache-Control: no-store');
try {
  if (!limiter('veille-cron', 30, 3600)) echec('Trop de tentatives.', 429);
  $cle = (string)($_GET['cle'] ?? '');
  $attendue = veille_env('VEILLE_CRON_KEY');
  if ($attendue === '' || !hash_equals($attendue, $cle)) {
    usleep(500000);
    echec('Accès refusé.', 403);
  }
  // On répond tout de suite (cron-job.org n'attend que 30 s), puis la collecte continue en arrière-plan
  ignore_user_abort(true);
  @set_time_limit(280);
  $reponse = json_encode(['ok' => true, 'message' => 'Collecte lancée.', 'quand' => veille_maintenant()], JSON_UNESCAPED_UNICODE);
  header('Content-Type: application/json; charset=utf-8');
  header('Content-Length: ' . strlen($reponse));
  header('Connection: close');
  echo $reponse;
  if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
  else { @ob_end_flush(); flush(); }
  veille_lancer('auto');
  veille_cron_discord();
} catch (Throwable $e) {
  error_log('[BDA veille-cron] ' . $e->getMessage());
  if (!headers_sent()) echec('Erreur du serveur.', 500);
}
