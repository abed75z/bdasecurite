<?php
/* Réglages publics du site (lus par assets/js/core.js sur chaque page) :
   services ouverts ou fermés et bandeau d'annonce. */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

entetes_securite();
try {
  $s = site_reglages();
  $b = $s['bandeau'];
  repondre([
    'ok' => true,
    'vtc' => !empty(tarifs_vtc()['ouvert']),
    'devis' => $s['devis'], 'recrutement' => $s['recrutement'], 'avis' => $s['avis'],
    'bandeau' => !empty($b['actif']) && trim((string)$b['texte']) !== '' ? ['texte' => (string)$b['texte'], 'lien' => (string)$b['lien'], 'libelleLien' => (string)$b['libelleLien']] : null,
  ]);
} catch (Throwable $e) {
  error_log('[BDA site] ' . $e->getMessage());
  repondre(['ok' => false], 500);
}
