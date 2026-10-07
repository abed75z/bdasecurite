<?php
/* =========================================================
   DISCORD — adresse des commandes / et des boutons du bot (interactions HTTP)
   Discord signe chaque appel : la signature est vérifiée avec la clé publique
   de l'application ; sans signature valide, rien n'est exécuté (401).
   Les travaux longs (veille, synchronisation) continuent après la réponse.
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
require __DIR__ . '/../app/discord/actions.php';

header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  exit;
}
$brut = (string)file_get_contents('php://input');
$sig = strtolower((string)($_SERVER['HTTP_X_SIGNATURE_ED25519'] ?? ''));
$ts = (string)($_SERVER['HTTP_X_SIGNATURE_TIMESTAMP'] ?? '');
if (strlen($brut) > 300000 || !dc_signature_ok($brut, $sig, $ts)) {
  http_response_code(401);
  header('Content-Type: text/plain; charset=utf-8');
  exit('Signature invalide.');
}
$i = json_decode($brut, true);
if (!is_array($i)) {
  http_response_code(400);
  exit;
}
$GLOBALS['dc_apres'] = [];
$reponse = json_encode(dc_interaction($i), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
header('Content-Type: application/json; charset=utf-8');
header('Content-Length: ' . strlen((string)$reponse));
echo $reponse;
// Discord n'attend que 3 secondes : on répond d'abord, puis on termine le travail
if ($GLOBALS['dc_apres']) {
  ignore_user_abort(true);
  if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
  else { @ob_end_flush(); flush(); }
  foreach ($GLOBALS['dc_apres'] as $travail) {
    try {
      $travail();
    } catch (Throwable $e) {
      error_log('[BDA discord] ' . $e->getMessage());
    }
  }
}
