<?php
// Diagnostic temporaire (à supprimer) : capacités de l'hébergement pour l'espace admin
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');
$root = isset($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] : __DIR__;
$parent = dirname($root);
echo 'php=' . PHP_VERSION . "\n";
echo 'pdo_sqlite=' . (extension_loaded('pdo_sqlite') ? 'oui' : 'non') . "\n";
echo 'pdo_mysql=' . (extension_loaded('pdo_mysql') ? 'oui' : 'non') . "\n";
echo 'parent_ecriture=' . (is_writable($parent) ? 'oui' : 'non') . "\n";
echo 'www_ecriture=' . (is_writable($root) ? 'oui' : 'non') . "\n";
echo 'open_basedir=' . (ini_get('open_basedir') ? 'actif' : 'aucun') . "\n";
echo 'mail=' . (function_exists('mail') ? 'oui' : 'non') . "\n";
echo 'password_hash=' . (function_exists('password_hash') ? 'oui' : 'non') . "\n";
echo 'sodium=' . (extension_loaded('sodium') ? 'oui' : 'non') . "\n";
echo 'mbstring=' . (extension_loaded('mbstring') ? 'oui' : 'non') . "\n";
