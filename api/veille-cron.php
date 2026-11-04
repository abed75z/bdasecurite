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
require __DIR__ . '/../app/veille/prospects.php';

// Tâches planifiées des modules (rapports, relances, sauvegarde…), chacune isolée, avant la veille qui peut être longue
function veille_cron_modules(string $origine): void
{
  try { require_once __DIR__ . '/../app/modules.php'; modules_cron($origine); } catch (Throwable $e) { error_log('[BDA modules cron] ' . $e->getMessage()); }
}

if (PHP_SAPI === 'cli') {
  veille_cron_modules('cron');
  $r = veille_lancer('cron');
  require_once __DIR__ . '/../app/exploitation.php';
  exp_alertes();
  robot_lancer('cron', [], 600);
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
  veille_cron_modules('auto');
  veille_lancer('auto');
  // planning des sites : postes non pourvus à 48 h, agents pas arrivés
  try { require_once __DIR__ . '/../app/exploitation.php'; exp_alertes(); } catch (Throwable $e) { error_log('[BDA planning] ' . $e->getMessage()); }
  // robot de prospection : les tâches en retard (annuaire, ouvertures, chantiers), dans le temps qui reste
  try { robot_lancer('auto', [], 180); } catch (Throwable $e) { error_log('[BDA robot] ' . $e->getMessage()); }
} catch (Throwable $e) {
  error_log('[BDA veille-cron] ' . $e->getMessage());
  if (!headers_sent()) echec('Erreur du serveur.', 500);
}
