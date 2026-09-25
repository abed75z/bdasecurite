<?php
/* =========================================================
   MODE MAINTENANCE (admin > Contrôle du site > « Mettre le site hors ligne »)
   Quand le site est hors ligne, le .htaccess envoie ici toutes les pages.
   - visiteurs : page « Site en maintenance » (code 503, Google patiente)
   - administrateur connecté : la page demandée, normalement
   ?apercu=1 affiche la page de maintenance, même à l'administrateur.
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';

$etat = site_hors_ligne();
$chemin = rawurldecode((string)(parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/'));
$voirMaintenance = isset($_GET['apercu']) && ($etat !== null || apercu_valide());

if (!$voirMaintenance && ($etat === null || apercu_valide())) servir_page($chemin);
page_maintenance($etat ?? ['message' => '', 'retour' => '']);

// Sert la page demandée telle quelle (uniquement des fichiers publics du site)
function servir_page(string $chemin): void
{
  if (preg_match('#^/maintenance(\.php)?$#', $chemin)) { header('Location: /', true, 302); exit; }
  $types = [
    'html' => 'text/html; charset=utf-8', 'xml' => 'application/xml; charset=utf-8', 'txt' => 'text/plain; charset=utf-8',
    'webmanifest' => 'application/manifest+json', 'vcf' => 'text/vcard; charset=utf-8', 'ico' => 'image/x-icon',
    'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'svg' => 'image/svg+xml',
  ];
  $rel = trim($chemin, '/');
  if ($rel === '') $rel = 'index.html';
  if (pathinfo($rel, PATHINFO_EXTENSION) === '') $rel .= '.html';
  $ext = strtolower(pathinfo($rel, PATHINFO_EXTENSION));
  $racine = realpath(__DIR__);
  $fichier = realpath(__DIR__ . '/' . $rel);
  $public = $fichier && $racine && str_starts_with($fichier, $racine . DIRECTORY_SEPARATOR)
    && !preg_match('#[\\\\/]\.#', substr($fichier, strlen($racine))) && isset($types[$ext]);
  if (!$public) {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><title>Page introuvable</title><p style="font-family:sans-serif;padding:40px">Page introuvable. <a href="/">Retour à l\'accueil</a></p>';
    exit;
  }
  header('Content-Type: ' . $types[$ext]);
  header('Cache-Control: no-store');
  readfile($fichier);
  exit;
}

function page_maintenance(array $etat): void
{
  http_response_code(503);
  header('Retry-After: 3600');
  header('Cache-Control: no-store');
  header('X-Robots-Tag: noindex');
  header('Content-Type: text/html; charset=utf-8');
  $e = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
  $message = trim((string)($etat['message'] ?? '')) ?: 'Notre site fait peau neuve et revient très vite. Nos équipes restent joignables 24 h/24.';
  $retour = trim((string)($etat['retour'] ?? ''));
  ?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#09090b">
  <title>Site en maintenance — BDA Sécurité &amp; VTC Premium</title>
  <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Playfair+Display:ital,wght@0,500;1,500&display=swap" rel="stylesheet">
  <style>
    :root { --bg: #09090b; --or: #c9a55c; --or-clair: #e8cf95; --texte: #f4f2ed; --texte-2: #b9b6ae; --ligne: rgba(255, 255, 255, .12); }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { margin: 0; display: grid; place-items: center; padding: 24px 16px; background: radial-gradient(110% 70% at 50% 0%, rgba(201, 165, 92, .12), transparent 60%), var(--bg); color: var(--texte); font: 400 15px/1.6 Poppins, system-ui, sans-serif; text-align: center; }
    main { width: min(440px, 100%); animation: entree .6s cubic-bezier(.16, 1, .3, 1) both; }
    .logo { width: min(260px, 80%); height: auto; margin: 0 auto 30px; display: block; }
    .badge { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 16px; padding: 6px 13px; border-radius: 99px; background: rgba(201, 165, 92, .12); border: 1px solid rgba(201, 165, 92, .35); color: var(--or-clair); font-size: 11px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; }
    .badge i { width: 7px; height: 7px; border-radius: 50%; background: var(--or); animation: pulse 1.8s ease-in-out infinite; }
    h1 { margin: 0 0 12px; font: 500 clamp(28px, 7vw, 36px)/1.15 "Playfair Display", Georgia, serif; }
    h1 em { color: var(--or-clair); }
    p { margin: 0 0 8px; color: var(--texte-2); }
    .retour { color: var(--or-clair); font-weight: 500; }
    .actions { display: grid; gap: 10px; margin-top: 28px; }
    .btn { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 52px; padding: 0 20px; border-radius: 14px; font-weight: 600; text-decoration: none; }
    .btn--or { background: linear-gradient(135deg, #f0dca4 0%, #c9a55c 50%, #9c7a38 100%); color: #17130a; }
    .btn--ligne { border: 1px solid var(--ligne); color: var(--texte); }
    .btn--ligne:hover { border-color: var(--or); }
    .btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    footer { margin-top: 34px; color: #77746d; font-size: 12px; letter-spacing: .04em; }
    @keyframes entree { from { opacity: 0; transform: translateY(14px); } }
    @keyframes pulse { 50% { opacity: .35; } }
    @media (prefers-reduced-motion: reduce) { main, .badge i { animation: none; } }
  </style>
</head>
<body>
  <main>
    <img class="logo" src="/assets/img/logo.svg" alt="BDA Sécurité &amp; VTC Premium">
    <span class="badge"><i></i>Maintenance</span>
    <h1>Nous revenons <em>très vite.</em></h1>
    <p><?= nl2br($e($message)) ?></p>
    <?php if ($retour !== '') { ?><p class="retour">Retour prévu : <?= $e($retour) ?></p><?php } ?>
    <div class="actions">
      <a class="btn btn--or" href="tel:+33611678625"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>Appeler le 06 11 67 86 25</a>
      <a class="btn btn--ligne" href="https://wa.me/33784739070" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>WhatsApp 07 84 73 90 70</a>
      <a class="btn btn--ligne" href="mailto:bdasecurite@gmail.com"><svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>bdasecurite@gmail.com</a>
    </div>
    <footer>BDA Sécurité &amp; VTC Premium · Paris</footer>
  </main>
</body>
</html>
<?php
  exit;
}
