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
  // « Être rappelé » (accueil) et « Proposition entreprise » (page Entreprises) : nom + téléphone suffisent,
  // et un email prévient l'équipe tout de suite
  $rappel = ($data['Prestation'] ?? '') === 'Demande de rappel';
  $entreprise = ($data['Prestation'] ?? '') === 'Proposition entreprise';
  if ($rappel || $entreprise) {
    if (trim($data['Nom / Société'] ?? '') === '') echec('Indiquez votre nom ou votre société.');
    if (strlen(preg_replace('/\D/', '', $data['Téléphone'] ?? '')) < 9) echec('Indiquez un numéro de téléphone valide.');
  }
  db()->prepare("INSERT INTO demandes (recu, statut, data) VALUES (?, 'nouvelle', ?)")->execute([maintenant(), json_encode($data, JSON_UNESCAPED_UNICODE)]);
  $id = (int)db()->lastInsertId();
  [$titre, $texte] = $entreprise ? ['Demande d’une entreprise', 'Une entreprise demande une proposition.']
    : ($rappel ? ['Demande de rappel', 'Un visiteur veut être rappelé.'] : ['Nouvelle demande de devis', 'Envoyée depuis le site, à traiter.']);
  notifier('demandes', $titre, $texte, '/admin/#/demandes/' . $id, 'demande-' . $id);
  if ($rappel) {
    envoyer_mail('Demande de rappel : ' . ($data['Nom / Société'] ?? ''), "Un visiteur demande à être rappelé depuis l'accueil du site.\n\nNom / Société : " . ($data['Nom / Société'] ?? '') . "\nTéléphone : " . ($data['Téléphone'] ?? '') . "\nCréneau : " . ($data['Date souhaitée'] ?? '') . "\nSecteur : " . ($data['Secteur'] ?? '') . "\n\nVoir dans l'admin : https://bdasecurite.com/admin/#/demandes");
  }
  if ($entreprise) {
    envoyer_mail('Demande d’une entreprise : ' . ($data['Nom / Société'] ?? ''), "Une entreprise demande une proposition depuis la page Entreprises du site.\n\nSociété (contact) : " . ($data['Nom / Société'] ?? '') . "\nTéléphone : " . ($data['Téléphone'] ?? '') . "\nE-mail : " . ($data['Email'] ?? '') . "\nType de site : " . ($data['Secteur'] ?? '') . "\nBesoin : " . ($data['Fréquence'] ?? '') . "\nDétails : " . ($data['Détails'] ?? '') . "\n\nVoir dans l'admin : https://bdasecurite.com/admin/#/demandes", (string)($data['Email'] ?? ''));
  }
  repondre(['ok' => true]);
} catch (Throwable $e) {
  error_log('[BDA demande] ' . $e->getMessage());
  echec('Erreur du serveur.', 500);
}
