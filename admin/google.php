<?php
/* =========================================================
   ESPACE ADMIN BDA — retour de Google après « Autoriser »
   (Paramètres > Messagerie Google > Connecter mon compte Google)
   Le cookie de session n'est pas envoyé au retour d'un autre site : la demande
   est vérifiée par le code d'état à usage unique gardé dans la base.
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
require __DIR__ . '/../app/google.php';
entetes_securite();
header('Cache-Control: no-store');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");

$ok = false;
$titre = 'Connexion impossible';
$texte = '';
$erreurGoogle = (string)($_GET['error'] ?? '');
if ($erreurGoogle !== '') {
  $texte = $erreurGoogle === 'access_denied' ? 'Vous avez annulé chez Google : rien n’a été relié.' : 'Google a refusé la connexion. Recommencez depuis l’admin.';
} else {
  try {
    $compte = google_finir((string)($_GET['code'] ?? ''), (string)($_GET['state'] ?? ''));
    $ok = true;
    $titre = 'Google est relié';
    $texte = "Le compte $compte est relié à l’admin. Les mails envoyés depuis l’admin partiront de cette adresse.";
    journal('securite', "Compte Google $compte relié à l’admin (messagerie et agenda)");
  } catch (Throwable $e) {
    $texte = $e instanceof RuntimeException ? $e->getMessage() : 'Erreur inattendue. Recommencez depuis l’admin.';
    if (!$e instanceof RuntimeException) error_log('[BDA google] ' . $e->getMessage());
  }
}
$h = fn (string $s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
?><!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<?php if ($ok): ?><meta http-equiv="refresh" content="4; url=/admin/#/parametres"><?php endif; ?>
<title><?= $h($titre) ?> — BDA Admin</title>
<style>
  :root { color-scheme: light dark; --fond: #f6f5f2; --carte: #fff; --texte: #1d1d1f; --muet: #6e6e73; --bord: #e4e2dc; --ok: #1f7a4d; --alerte: #b42318; }
  @media (prefers-color-scheme: dark) { :root { --fond: #111113; --carte: #1c1c1f; --texte: #f2f2f2; --muet: #a1a1a6; --bord: #2c2c30; --ok: #4cc38a; --alerte: #ff6b5e; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--fond); color: var(--texte); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { width: 100%; max-width: 440px; background: var(--carte); border: 1px solid var(--bord); border-radius: 16px; padding: 32px 28px; text-align: center; }
  .rond { width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 50%; display: grid; place-items: center; font-size: 28px; color: #fff; background: <?= $ok ? 'var(--ok)' : 'var(--alerte)' ?>; }
  h1 { font-size: 1.35rem; margin: 0 0 8px; }
  p { margin: 0 0 24px; color: var(--muet); }
  a { display: inline-block; padding: 11px 20px; border-radius: 10px; background: var(--texte); color: var(--fond); text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
<main>
  <div class="rond" aria-hidden="true"><?= $ok ? '✓' : '!' ?></div>
  <h1><?= $h($titre) ?></h1>
  <p><?= $h($texte) ?></p>
  <a href="/admin/#/parametres">Retour à l’admin</a>
</main>
</body>
</html>
