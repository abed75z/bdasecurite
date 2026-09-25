<?php
/* Réception d'une demande de devis envoyée depuis la page « Demander un devis »
   (en plus de l'email FormSubmit) : elle apparaît dans l'espace admin. */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

entetes_securite();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') echec('Méthode non autorisée.', 405);
if (!origine_ok()) echec('Origine refusée.', 403);
try {
  $b = corps();
  if (!empty($b['_honey']) || !empty($b['site_web'])) repondre(['ok' => true]); // robot : ignoré sans le lui dire
  if (!service_ouvert('devis')) echec('Les demandes de devis en ligne sont momentanément fermées. Appelez-nous au 06 11 67 86 25.', 403);
  if (!limiter('demande', 8, 3600)) echec('Trop de demandes envoyées. Réessayez plus tard ou appelez-nous.', 429);
  $data = champs_formulaire($b);
  if (count($data) < 3) echec('Demande incomplète.');
  db()->prepare("INSERT INTO demandes (recu, statut, data) VALUES (?, 'nouvelle', ?)")->execute([maintenant(), json_encode($data, JSON_UNESCAPED_UNICODE)]);
  repondre(['ok' => true]);
} catch (Throwable $e) {
  error_log('[BDA demande] ' . $e->getMessage());
  echec('Erreur du serveur.', 500);
}
