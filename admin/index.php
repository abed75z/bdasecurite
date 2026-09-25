<?php
/* Espace admin BDA — page d'entrée (l'application se charge ensuite en JavaScript) */
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
<meta name="theme-color" content="#09090b">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="BDA Admin">
<title>Espace admin — BDA Sécurité &amp; VTC Premium</title>
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;1,500&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="admin.css?v=<?= $v ?>">
<link rel="stylesheet" href="documents.css?v=<?= $v ?>">
<link rel="stylesheet" href="creations.css?v=<?= $v ?>">
<style id="format-page">@page { size: A4 portrait; margin: 0; }</style>
</head>
<body>
<div id="app"><div class="chargement chargement--plein"><span></span><span></span><span></span></div></div>
<noscript><p style="color:#fff;padding:2rem">Activez JavaScript pour utiliser l'espace admin.</p></noscript>
<script type="module" src="js/app.js?v=<?= $v ?>"></script>
</body>
</html>
