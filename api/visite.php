<?php
/* Mesure d'audience anonyme : +1 à la page vue du jour.
   Aucun cookie, aucune adresse IP ni donnée personnelle enregistrée. */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

header('X-Robots-Tag: noindex, nofollow');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !origine_ok()) {
  http_response_code(204);
  exit;
}
$ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
if ($ua === '' || preg_match('/bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|curl|wget|python/i', $ua)) {
  http_response_code(204);
  exit;
}
try {
  $brut = (string)file_get_contents('php://input', false, null, 0, 300);
  $page = strtolower((string)(parse_url(trim($brut, " \t\n\r\"'"), PHP_URL_PATH) ?: '/'));
  $page = preg_replace('/\.html$/', '', rtrim($page, '/')) ?: '/';
  // On ne compte que les vraies pages du site
  $valide = $page === '/' || (preg_match('~^/[a-z0-9-]{1,60}$~', $page) && is_file(dirname(__DIR__) . $page . '.html'));
  if ($valide && limiter('visite', 400, 3600)) {
    db()->prepare('INSERT INTO visites (jour, page, n) VALUES (?, ?, 1) ON CONFLICT(jour, page) DO UPDATE SET n = n + 1')->execute([date('Y-m-d'), $page]);
  }
} catch (Throwable $e) {
  error_log('[BDA visite] ' . $e->getMessage());
}
http_response_code(204);
