<?php
/* =========================================================
   MON ACCÈS — page personnelle du gérant (bdasecurite.com/admin/moi)
   La page ne contient aucune donnée : la carte pro est chargée depuis
   l'espace admin, uniquement après connexion avec le mot de passe.
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
entetes_securite();
header('Cache-Control: no-store');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
$v = '2';
?><!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#08080a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="BDA · Chef">
<title>Mon accès — BDA Sécurité</title>
<base href="/admin/">
<link rel="icon" href="/admin/icone-moi-180.png" type="image/png">
<link rel="apple-touch-icon" href="/admin/icone-moi-180.png">
<link rel="manifest" href="/admin/manifest-moi.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;1,500&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="admin.css?v=<?= $v ?>">
<link rel="stylesheet" href="creations.css?v=<?= $v ?>">
<link rel="stylesheet" href="chef.css?v=<?= $v ?>">
</head>
<body class="moi">
<div id="moi"><div class="chargement chargement--plein"><span></span><span></span><span></span></div></div>
<noscript><p style="color:#fff;padding:2rem">Activez JavaScript pour ouvrir votre accès.</p></noscript>
<script type="module" src="js/chef.js?v=<?= $v ?>"></script>
</body>
</html>
