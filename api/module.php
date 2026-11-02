<?php
/* =========================================================
   LIENS PUBLICS DES MODULES — /api/module.php?m=<nom>&a=<verbe>
   Pour les pages ouvertes depuis un lien à jeton (facture consultée en ligne,
   devis à signer, vérification d'une carte d'agent…). Aucune session :
   chaque action vérifie elle-même son jeton et limite les essais.
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
require __DIR__ . '/../app/modules.php';

entetes_securite();
header('Cache-Control: no-store');
$nom = (string)($_GET['m'] ?? '');
$verbe = (string)($_GET['a'] ?? '');
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!preg_match('/^[a-z][a-z0-9_]{1,30}$/', $nom) || !preg_match('/^[a-z0-9_.]{1,40}$/', $verbe)) echec('Lien invalide.', 404);
if ($methode === 'POST' && !origine_ok()) echec('Origine refusée.', 403);
if (!limiter('module-public', 240, 600)) echec('Trop de demandes. Réessayez dans quelques minutes.', 429);
modules_api('public', "mod.$nom.$verbe", $methode);
