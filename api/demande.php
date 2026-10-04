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
  // « Être rappelé » (accueil) : nom + téléphone suffisent, et un email prévient l'équipe tout de suite
  $rappel = ($data['Prestation'] ?? '') === 'Demande de rappel';
  if ($rappel) {
    if (trim($data['Nom / Société'] ?? '') === '') echec('Indiquez votre nom ou votre société.');
    if (strlen(preg_replace('/\D/', '', $data['Téléphone'] ?? '')) < 9) echec('Indiquez un numéro de téléphone valide.');
  }
  db()->prepare("INSERT INTO demandes (recu, statut, data) VALUES (?, 'nouvelle', ?)")->execute([maintenant(), json_encode($data, JSON_UNESCAPED_UNICODE)]);
  if ($rappel) {
    envoyer_mail('Demande de rappel : ' . ($data['Nom / Société'] ?? ''), "Un visiteur demande à être rappelé depuis l'accueil du site.\n\nNom / Société : " . ($data['Nom / Société'] ?? '') . "\nTéléphone : " . ($data['Téléphone'] ?? '') . "\nCréneau : " . ($data['Date souhaitée'] ?? '') . "\nSecteur : " . ($data['Secteur'] ?? '') . "\n\nVoir dans l'admin : https://bdasecurite.com/admin/#/demandes");
  }
  repondre(['ok' => true]);
} catch (Throwable $e) {
  error_log('[BDA demande] ' . $e->getMessage());
  echec('Erreur du serveur.', 500);
}
