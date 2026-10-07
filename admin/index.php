<?php
/* Espace admin BDA — page d'entrée (l'application se charge ensuite en JavaScript) */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
entetes_securite();
header('Cache-Control: no-store');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
$v = '25';
?><!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#f7f3ec">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="BDA Admin">
<title>Espace admin — BDA Security Group</title>
<meta name="description" content="Espace d’administration BDA Security Group. Accès réservé, connexion sécurisée.">
<!-- Aperçu quand le lien est partagé (WhatsApp, iMessage, Discord…) -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="BDA Security Group">
<meta property="og:title" content="BDA Security Group — Espace administration">
<meta property="og:description" content="Accès réservé · Connexion sécurisée">
<meta property="og:url" content="https://bdasecurite.com/admin/">
<meta property="og:image" content="https://bdasecurite.com/admin/apercu-admin.jpg?v=1">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="BDA Security Group — Espace administration">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://bdasecurite.com/admin/apercu-admin.jpg?v=1">
<link rel="icon" href="/admin/favicon-admin-96.png?v=1" type="image/png" sizes="96x96">
<link rel="apple-touch-icon" href="/admin/icone-admin-180.png?v=1">
<link rel="manifest" href="manifest.webmanifest?v=2">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="admin.css?v=<?= $v ?>">
<link rel="stylesheet" href="documents.css?v=<?= $v ?>">
<link rel="stylesheet" href="creations.css?v=<?= $v ?>">
<link rel="stylesheet" href="blanc.css?v=<?= $v ?>">
<style id="format-page">@page { size: A4 portrait; margin: 0; }</style>
</head>
<body>
<div id="app"><div class="chargement chargement--plein"><span></span><span></span><span></span></div></div>
<noscript><p style="color:#fff;padding:2rem">Activez JavaScript pour utiliser l'espace admin.</p></noscript>
<script type="module" src="js/app.js?v=<?= $v ?>"></script>
</body>
</html>
