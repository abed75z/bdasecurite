<?php
/* Avis clients : GET = avis publiés (page Avis et accueil) ; POST = nouvel avis,
   enregistré « en attente » jusqu'à sa validation dans l'espace admin. */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

entetes_securite();
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
try {
  if ($methode === 'GET') {
    avis_google_une_fois();
    $lignes = db()->query("SELECT recu, nom, note, prestation, texte FROM avis WHERE statut = 'publie' ORDER BY recu DESC LIMIT 500")->fetchAll();
    $avis = array_map(fn($a) => [
      'date' => date('c', strtotime((string)$a['recu']) ?: time()),
      'nom' => $a['nom'],
      'note' => (int)$a['note'],
      'prestation' => $a['prestation'],
      'texte' => $a['texte'],
    ], $lignes);
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=60');
    echo json_encode(['ok' => true, 'avis' => $avis], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
  }
  if ($methode !== 'POST') echec('Méthode non autorisée.', 405);
  if (!origine_ok()) echec('Origine refusée.', 403);

  $b = corps();
  if (!empty($b['site_web']) || !empty($b['_honey'])) repondre(['ok' => true]); // robot : ignoré sans le lui dire
  if (!service_ouvert('avis')) echec('Le dépôt d’avis est momentanément fermé. Merci !', 403);
  $nom = texte($b['nom'] ?? '', 60);
  $note = (int)($b['note'] ?? 0);
  $texte = texte($b['texte'] ?? '', 1500);
  $prestation = texte($b['prestation'] ?? '', 80);
  $email = texte($b['email'] ?? '', 160);
  if (mb_strlen($nom) < 2 || $note < 1 || $note > 5 || mb_strlen($texte) < 10) echec('Avis incomplet.');
  if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $email = '';
  if (!limiter('avis', 5, 86400)) echec('Vous avez déjà envoyé plusieurs avis aujourd\'hui. Merci !', 429);

  db()->prepare("INSERT INTO avis (recu, nom, note, prestation, texte, email, statut) VALUES (?, ?, ?, ?, ?, ?, 'attente')")->execute([maintenant(), $nom, $note, $prestation, $texte, $email]);
  envoyer_mail(
    'Nouvel avis ' . str_repeat('★', $note) . ' — ' . $nom,
    "Un nouvel avis attend votre validation.\n\nNom : $nom\nNote : $note/5\nPrestation : " . ($prestation ?: '—') . "\n\n$texte\n\nPour le publier : https://bdasecurite.com/admin/#/avis",
    $email
  );
  repondre(['ok' => true]);
} catch (Throwable $e) {
  error_log('[BDA avis] ' . $e->getMessage());
  echec('Erreur du serveur.', 500);
}
