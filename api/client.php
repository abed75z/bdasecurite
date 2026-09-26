<?php
/* =========================================================
   ESPACE CLIENT — API réservée aux clients (bdasecurite.com/espace-client)
   Session séparée de l'espace admin (cookie BDA_CLIENT).
   Un client ne voit que les documents que BDA lui a envoyés depuis l'admin
   (reconnus au nom du client), et sa messagerie avec BDA.
   GET  ?a=session | tableau | document&id= | messages | invitation.verifier&jeton=
   POST ?a=connexion | invitation | deconnexion | motdepasse | devis.accepter | message.envoyer
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

entetes_securite();
header('Cache-Control: no-store');

// ----- Session client -----
$dirSessions = dossier_donnees() . '/sessions-clients';
if (!is_dir($dirSessions)) @mkdir($dirSessions, 0700, true);
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.gc_maxlifetime', (string)(14 * 86400));
session_save_path($dirSessions);
session_name('BDA_CLIENT');
session_set_cookie_params(['lifetime' => 14 * 86400, 'path' => '/', 'secure' => est_https(), 'httponly' => true, 'samesite' => 'Lax']);
session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));

$action = (string)($_GET['a'] ?? '');
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$lectures = ['session', 'tableau', 'document', 'messages', 'invitation.verifier'];
if (in_array($action, $lectures, true) !== ($methode === 'GET')) echec('Méthode non autorisée.', 405);
if ($methode === 'POST') {
  if (!origine_ok()) echec('Origine refusée.', 403);
  if (!hash_equals((string)$_SESSION['csrf'], (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) echec('Session expirée : rechargez la page.', 419);
}

// Compte connecté (et toujours actif), sinon null
function compte_client(): ?array
{
  $id = (int)($_SESSION['compte'] ?? 0);
  if (!$id) return null;
  $st = db()->prepare('SELECT cc.*, c.nom, c.adresse, c.tel, c.email AS email_client FROM comptes_clients cc JOIN clients c ON c.id = cc.client_id WHERE cc.id = ? AND cc.actif = 1');
  $st->execute([$id]);
  $c = $st->fetch();
  if (!$c) { unset($_SESSION['compte']); return null; }
  return $c;
}
function exiger_compte(): array
{
  $c = compte_client();
  if (!$c) echec('Connexion requise.', 401);
  return $c;
}
function cle_client(string $nom): string
{
  return mb_strtolower(trim($nom));
}
function etat_client(): array
{
  $c = compte_client();
  return ['ok' => true, 'connecte' => (bool)$c, 'client' => $c ? $c['nom'] : '', 'email' => $c ? $c['email'] : '', 'csrf' => (string)$_SESSION['csrf']];
}
function ouvrir_session_client(array $compte): void
{
  session_regenerate_id(true);
  $_SESSION['compte'] = (int)$compte['id'];
  $_SESSION['csrf'] = bin2hex(random_bytes(32));
  db()->prepare('UPDATE comptes_clients SET derniere = ? WHERE id = ?')->execute([maintenant(), $compte['id']]);
}
function invitation_valide(string $jeton): ?array
{
  if (!preg_match('/^[a-f0-9]{48}$/', $jeton)) return null;
  $st = db()->prepare('SELECT cc.*, c.nom FROM comptes_clients cc JOIN clients c ON c.id = cc.client_id WHERE cc.invitation = ? AND cc.actif = 1');
  $st->execute([hash('sha256', $jeton)]);
  $c = $st->fetch();
  if (!$c || $c['invitation_expire'] < maintenant()) return null;
  return $c;
}

try {
  switch ($action) {
    case 'session':
      repondre(etat_client());

    case 'connexion':
      $b = corps();
      $cle = 'client:' . empreinte_client();
      if (tentatives($cle, 900) >= 8) echec('Trop de tentatives. Réessayez dans 15 minutes.', 429);
      $st = db()->prepare('SELECT cc.*, c.nom FROM comptes_clients cc JOIN clients c ON c.id = cc.client_id WHERE cc.email = ? AND cc.actif = 1');
      $st->execute([texte($b['email'] ?? '', 160)]);
      $c = $st->fetch();
      $hash = $c && $c['hash'] !== '' ? (string)$c['hash'] : password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT);
      if (!$c || !password_verify(chaine($b['motdepasse'] ?? ''), $hash)) {
        noter_tentative($cle);
        usleep(600000);
        echec('Email ou mot de passe incorrect.', 401);
      }
      ouvrir_session_client($c);
      journal('acces', "Espace client : connexion de {$c['nom']}");
      repondre(etat_client());

    case 'invitation.verifier':
      $c = invitation_valide((string)($_GET['jeton'] ?? ''));
      if (!$c) echec('Ce lien n’est plus valable. Demandez-en un nouveau à BDA Sécurité (06 11 67 86 25).', 404);
      repondre(['ok' => true, 'client' => $c['nom'], 'email' => $c['email']]);

    case 'invitation':
      $b = corps();
      $cle = 'client-inv:' . empreinte_client();
      if (tentatives($cle, 3600) >= 10) echec('Trop de tentatives. Réessayez plus tard.', 429);
      $c = invitation_valide(chaine($b['jeton'] ?? ''));
      if (!$c) { noter_tentative($cle); echec('Ce lien n’est plus valable. Demandez-en un nouveau à BDA Sécurité.', 404); }
      $mdp = chaine($b['motdepasse'] ?? '');
      if (mb_strlen($mdp) < 8) echec('Le mot de passe doit contenir au moins 8 caractères.');
      if (mb_strlen($mdp) > 200) echec('Mot de passe trop long.');
      db()->prepare("UPDATE comptes_clients SET hash = ?, invitation = '', invitation_expire = '' WHERE id = ?")->execute([password_hash($mdp, PASSWORD_DEFAULT), $c['id']]);
      ouvrir_session_client($c);
      journal('securite', "Espace client activé par {$c['nom']}");
      repondre(etat_client());

    case 'deconnexion':
      $_SESSION = [];
      session_regenerate_id(true);
      $_SESSION['csrf'] = bin2hex(random_bytes(32));
      repondre(etat_client());

    case 'motdepasse':
      $c = exiger_compte();
      $b = corps();
      if (!password_verify(chaine($b['actuel'] ?? ''), (string)$c['hash'])) echec('Mot de passe actuel incorrect.', 403);
      $mdp = chaine($b['nouveau'] ?? '');
      if (mb_strlen($mdp) < 8) echec('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      db()->prepare('UPDATE comptes_clients SET hash = ? WHERE id = ?')->execute([password_hash($mdp, PASSWORD_DEFAULT), $c['id']]);
      repondre(['ok' => true]);

    case 'tableau':
      $c = exiger_compte();
      // Seuls les documents envoyés depuis l'admin (« Envoyer dans l'espace client ») sont visibles
      $st = db()->prepare("SELECT id, type, numero, statut, total, date, echeance, partage, vu_client FROM documents WHERE lower(trim(client)) = ? AND partage <> '' ORDER BY partage DESC, id DESC");
      $st->execute([cle_client($c['nom'])]);
      $docs = $st->fetchAll();
      $nl = db()->prepare("SELECT COUNT(*) FROM messages_clients WHERE client_id = ? AND auteur = 'admin' AND lu = 0");
      $nl->execute([$c['client_id']]);
      repondre(['ok' => true, 'client' => ['nom' => $c['nom'], 'adresse' => $c['adresse'], 'tel' => $c['tel'], 'email' => $c['email']],
        'devis' => array_values(array_filter($docs, fn($d) => $d['type'] === 'devis')),
        'factures' => array_values(array_filter($docs, fn($d) => $d['type'] === 'facture')),
        'messagesNonLus' => (int)$nl->fetchColumn()]);

    case 'document':
      $c = exiger_compte();
      $st = db()->prepare("SELECT id, type, numero, statut, total, date, echeance, partage, vu_client, data FROM documents WHERE id = ? AND lower(trim(client)) = ? AND partage <> ''");
      $st->execute([(int)($_GET['id'] ?? 0), cle_client($c['nom'])]);
      $d = $st->fetch();
      if (!$d) echec('Document introuvable.', 404);
      if ($d['vu_client'] === '') {
        db()->prepare('UPDATE documents SET vu_client = ? WHERE id = ?')->execute([maintenant(), $d['id']]);
        journal('document', ($d['type'] === 'facture' ? 'Facture ' : 'Devis ') . "{$d['numero']} ouvert par {$c['nom']} dans son espace client");
      }
      $d['data'] = json_decode((string)$d['data'], true) ?: [];
      repondre(['ok' => true, 'document' => $d]);

    /* ----- Messagerie avec BDA Sécurité ----- */
    case 'messages':
      $c = exiger_compte();
      $st = db()->prepare('SELECT id, auteur, texte, cree FROM messages_clients WHERE client_id = ? ORDER BY id DESC LIMIT 200');
      $st->execute([$c['client_id']]);
      $liste = array_reverse($st->fetchAll());
      db()->prepare("UPDATE messages_clients SET lu = 1 WHERE client_id = ? AND auteur = 'admin' AND lu = 0")->execute([$c['client_id']]);
      repondre(['ok' => true, 'messages' => $liste]);

    case 'message.envoyer':
      $c = exiger_compte();
      $texte = texte(corps()['texte'] ?? '', 4000);
      if (mb_strlen($texte) < 2) echec('Écrivez votre message.');
      if (!limiter('client-message:' . $c['client_id'], 20, 3600)) echec('Trop de messages envoyés. Réessayez dans un moment ou appelez-nous au 06 11 67 86 25.', 429);
      db()->prepare("INSERT INTO messages_clients (client_id, auteur, texte, cree) VALUES (?, 'client', ?, ?)")->execute([$c['client_id'], $texte, maintenant()]);
      journal('site', "Nouveau message de {$c['nom']} (espace client)");
      envoyer_mail("Message de {$c['nom']} — espace client", "{$c['nom']} vous a écrit depuis son espace client :\n\n$texte\n\n—\nRépondre depuis l'admin : https://bdasecurite.com/admin/#/messages\nOu répondez directement à cet email ({$c['email']}).", $c['email']);
      repondre(['ok' => true]);

    case 'devis.accepter':
      $c = exiger_compte();
      $id = (int)(corps()['id'] ?? 0);
      $st = db()->prepare("SELECT id, numero, statut FROM documents WHERE id = ? AND type = 'devis' AND lower(trim(client)) = ? AND partage <> ''");
      $st->execute([$id, cle_client($c['nom'])]);
      $d = $st->fetch();
      if (!$d) echec('Devis introuvable.', 404);
      if ($d['statut'] !== 'envoye') echec('Ce devis ne peut plus être accepté en ligne. Contactez-nous au 06 11 67 86 25.', 409);
      db()->prepare("UPDATE documents SET statut = 'accepte', maj = ? WHERE id = ?")->execute([maintenant(), $id]);
      journal('document', "Devis {$d['numero']} ACCEPTÉ EN LIGNE par {$c['nom']} (espace client)");
      envoyer_mail("Devis {$d['numero']} accepté par {$c['nom']}", "Bonne nouvelle : {$c['nom']} vient d'accepter le devis {$d['numero']} depuis son espace client ({$c['email']}).\n\nhttps://bdasecurite.com/admin/#/devis/$id");
      repondre(['ok' => true]);

    default:
      echec('Action inconnue.', 404);
  }
} catch (Throwable $e) {
  error_log('[BDA client] ' . $e->getMessage());
  echec('Erreur du serveur. Réessayez dans un instant.', 500);
}
