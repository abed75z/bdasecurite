<?php
/* Réception d'une candidature envoyée depuis la page Recrutement
   (en plus de l'email FormSubmit) : elle apparaît dans l'espace admin. */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

entetes_securite();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') echec('Méthode non autorisée.', 405);
if (!origine_ok()) echec('Origine refusée.', 403);
try {
  $b = corps();
  if (!empty($b['_honey']) || !empty($b['site_web'])) repondre(['ok' => true]); // robot : ignoré sans le lui dire
  if (!limiter('candidature', 5, 3600)) echec('Trop de candidatures envoyées. Réessayez plus tard.', 429);
  $data = champs_formulaire($b);
  if (count($data) < 3) echec('Candidature incomplète.');
  db()->prepare("INSERT INTO candidatures (recu, statut, data) VALUES (?, 'nouvelle', ?)")->execute([maintenant(), json_encode($data, JSON_UNESCAPED_UNICODE)]);
  repondre(['ok' => true]);
} catch (Throwable $e) {
  error_log('[BDA candidature] ' . $e->getMessage());
  echec('Erreur du serveur.', 500);
}
