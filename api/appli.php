<?php
/* =========================================================
   APPLI BDA — API de l'appli client et de l'appli chauffeur
   Appel : /api/appli.php?a=action  (GET = lecture, POST JSON = écriture)
   - Connexion par jeton (en-tête X-BDA-Jeton) : marche aussi depuis l'appli des stores.
   - Client : compte créé dans l'appli (e-mail + mot de passe, code d'accès pendant la phase privée).
   - Chauffeur : compte de l'Espace équipe, validé par la direction.
   - Chaque requête ne voit que les données de la personne connectée.
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
require __DIR__ . '/../app/appli.php';

entetes_securite();
header('Cache-Control: no-store');
// Appli des stores (Capacitor) : elle appelle le site depuis « capacitor://localhost » ou « https://localhost »
$origine = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if (in_array($origine, ['capacitor://localhost', 'https://localhost', 'http://localhost'], true) || preg_match('~^http://localhost:\d+$~', $origine)) {
  header('Access-Control-Allow-Origin: ' . $origine);
  header('Vary: Origin');
  header('Access-Control-Allow-Headers: Content-Type, X-BDA-Jeton');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  header('Access-Control-Max-Age: 86400');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

$action = (string)($_GET['a'] ?? '');
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$lectures = ['config', 'voisins', 'client.moi', 'client.donnees', 'courses', 'course', 'suivi', 'chauffeur.moi', 'chauffeur.historique'];
$ecritures = [
  'client.existe', 'client.inscription', 'client.connexion', 'client.oubli', 'client.reset', 'client.profil', 'client.motdepasse', 'client.deconnexion', 'client.supprimer',
  'push.abonner', 'push.retirer', 'promo.verifier', 'support',
  'course.creer', 'course.annuler', 'course.message', 'course.noter', 'course.alerte',
  'chauffeur.connexion', 'chauffeur.deconnexion', 'chauffeur.vehicule', 'chauffeur.etat',
  'course.accepter', 'course.refuser', 'course.partir', 'course.arrivee', 'course.demarrer', 'course.terminer', 'course.absent', 'course.abandonner', 'course.noterClient',
];
if (!in_array($action, array_merge($lectures, $ecritures), true)) echec('Action inconnue.', 404);
if (in_array($action, $lectures, true) !== ($methode === 'GET')) echec('Méthode non autorisée.', 405);
if ($methode === 'POST' && !origine_ok()) echec('Origine refusée.', 403);

/* ---------- Personne connectée ---------- */
function client_connecte(): array
{
  $s = appli_session();
  if (!$s || $s['role'] !== 'client') echec('Connexion requise.', 401);
  $c = appli_client($s['id']);
  if (!$c) echec('Connexion requise.', 401);
  return $c;
}
function chauffeur_connecte(): array
{
  $s = appli_session();
  if (!$s || $s['role'] !== 'chauffeur') echec('Connexion requise.', 401);
  $c = appli_chauffeur($s['id']);
  if (!$c) echec('Votre accès chauffeur est suspendu. Contactez la direction au 06 11 67 86 25.', 401);
  return $c;
}
// Course du client connecté, ou du chauffeur à qui elle est confiée
function course_de(string $numero, string $role, int $id): array
{
  $c = appli_course(texte($numero, 30));
  if (!$c) echec('Course introuvable.', 404);
  if ($role === 'client' && (int)$c['client_id'] !== $id) echec('Course introuvable.', 404);
  if ($role === 'chauffeur' && (int)$c['chauffeur_id'] !== $id) echec('Cette course ne vous est pas confiée.', 403);
  return $c;
}
function exiger_statut(array $c, array $statuts, string $message): void
{
  if (!in_array($c['statut'], $statuts, true)) echec($message, 409);
}
function chauffeur_occupe(int $id): ?array
{
  $st = db()->prepare("SELECT * FROM courses WHERE chauffeur_id = ? AND statut IN ('acceptee', 'arrivee', 'en_course') ORDER BY id DESC LIMIT 1");
  $st->execute([$id]);
  $c = $st->fetch();
  if (!$c) return null;
  $c['data'] = json_decode((string)$c['data'], true) ?: [];
  return $c;
}
function email_valide(string $e): string
{
  $e = mb_strtolower(texte($e, 160));
  if (!filter_var($e, FILTER_VALIDATE_EMAIL)) echec('Adresse e-mail invalide.');
  return $e;
}
function tel_valide(string $t, bool $obligatoire): string
{
  $t = texte($t, 30);
  if ($t === '' && !$obligatoire) return '';
  if (strlen(preg_replace('/\D/', '', $t)) < 9) echec('Numéro de téléphone invalide.');
  return $t;
}
function hote(): string
{
  return preg_replace('/[^a-z0-9.:-]/i', '', (string)($_SERVER['HTTP_HOST'] ?? 'bdasecurite.com')) ?: 'bdasecurite.com';
}
function lien_appli(string $chemin): string
{
  $h = hote();
  return (str_starts_with($h, 'localhost') || str_starts_with($h, '127.') ? 'http://' : 'https://') . $h . $chemin;
}
function nom_gamme(string $g): string
{
  return appli_cfg()['gammes'][$g]['nom'] ?? $g;
}
function euros_txt(float $n): string
{
  return number_format($n, $n == floor($n) ? 0 : 2, ',', ' ') . ' €';
}

try {
  appli_expirer();
  $s = appli_session();
  switch ($action) {
    /* ================= Commun ================= */
    case 'config':
      repondre(['ok' => true] + appli_cfg_publique());

    case 'push.abonner':
      if (!$s) echec('Connexion requise.', 401);
      $b = corps();
      $endpoint = texte($b['endpoint'] ?? '', 1000);
      $p256dh = texte($b['keys']['p256dh'] ?? '', 200);
      $auth = texte($b['keys']['auth'] ?? '', 100);
      if (!preg_match('~^https://~', $endpoint) || $p256dh === '' || $auth === '') echec('Abonnement invalide.');
      db()->prepare('INSERT INTO appli_push (role, compte_id, endpoint, p256dh, auth, cree) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET role = excluded.role, compte_id = excluded.compte_id, p256dh = excluded.p256dh, auth = excluded.auth')
        ->execute([$s['role'], $s['id'], $endpoint, $p256dh, $auth, maintenant()]);
      repondre(['ok' => true]);

    case 'push.retirer':
      $b = corps();
      db()->prepare('DELETE FROM appli_push WHERE endpoint = ?')->execute([texte($b['endpoint'] ?? '', 1000)]);
      repondre(['ok' => true]);

    /* Page de suivi envoyée aux proches : prénom du voyageur, voiture et position, seulement pendant la course */
    case 'suivi':
      if (!limiter('appli-suivi', 240, 600)) echec('Trop de demandes. Patientez un instant.', 429);
      $j = (string)($_GET['j'] ?? '');
      if (!preg_match('/^[a-f0-9]{24}$/', $j)) echec('Lien de suivi invalide.', 404);
      $st = db()->prepare('SELECT * FROM courses WHERE suivi = ?');
      $st->execute([$j]);
      $c = $st->fetch();
      if (!$c) echec('Lien de suivi invalide.', 404);
      $c['data'] = json_decode((string)$c['data'], true) ?: [];
      $d = $c['data'];
      $termine = in_array($c['statut'], ['terminee', 'annulee', 'aucun'], true);
      if ($termine && (string)($c['fin'] ?: $c['annule'] ?: $c['maj']) < date('Y-m-d H:i:s', time() - 1800)) echec('Ce suivi est terminé.', 410);
      $ch = (int)$c['chauffeur_id'] ? appli_chauffeur((int)$c['chauffeur_id']) : null;
      $chf = null;
      if ($ch) {
        $chf = appli_chauffeur_public($ch, in_array($c['statut'], APPLI_ACTIVES, true));
        unset($chf['tel'], $chf['id']);
        foreach (['voiture', 'couleur', 'plaque'] as $k) if (!empty($d['chauffeur'][$k])) $chf[$k] = $d['chauffeur'][$k];
      }
      $voyageur = (string)($d['passager']['prenom'] ?? $d['client']['prenom'] ?? '');
      $lieu = fn($l) => $l ? ['titre' => $l['titre'], 'lat' => $l['lat'], 'lng' => $l['lng']] : null;
      repondre(['ok' => true, 'statut' => $c['statut'], 'voyageur' => $voyageur, 'gamme' => nom_gamme($c['gamme']), 'chauffeur' => $chf, 'depart' => $lieu($d['depart'] ?? null), 'arrivee' => $lieu($d['arrivee'] ?? null), 'arret' => $lieu($d['arret'] ?? null), 'debut' => $c['debut'], 'fin' => $c['fin']]);

    /* ================= Clients : compte ================= */
    case 'client.existe':
      if (!limiter('appli-existe', 30, 600)) echec('Trop de vérifications. Patientez un instant.', 429);
      $b = corps();
      $st = db()->prepare('SELECT COUNT(*) FROM appli_clients WHERE email = ?');
      $st->execute([email_valide((string)($b['email'] ?? ''))]);
      repondre(['ok' => true, 'existe' => (bool)$st->fetchColumn(), 'prive' => appli_cfg()['prive']]);

    case 'client.inscription':
      $b = corps();
      if (!limiter('appli-inscription', 6, 3600)) echec('Trop de comptes créés depuis cet appareil. Réessayez dans une heure.', 429);
      $cfg = appli_cfg();
      $email = email_valide((string)($b['email'] ?? ''));
      $prenom = texte($b['prenom'] ?? '', 60);
      $nom = texte($b['nom'] ?? '', 60);
      $tel = tel_valide((string)($b['tel'] ?? ''), true);
      $mdp = chaine($b['motdepasse'] ?? '');
      if (mb_strlen($prenom) < 2) echec('Indiquez votre prénom.');
      appli_mdp_valide($mdp);
      if (empty($b['cgu'])) echec('Il faut avoir 18 ans ou plus et accepter les conditions pour créer un compte.');
      if ($cfg['prive'] && !hash_equals(strtoupper($cfg['codeAcces']), strtoupper(trim(chaine($b['code'] ?? ''))))) {
        noter_tentative('appli-code:' . empreinte_client());
        if (tentatives('appli-code:' . empreinte_client(), 3600) > 10) echec('Trop d’essais. Réessayez dans une heure.', 429);
        echec('Code d’accès incorrect. L’appli BDA est en phase privée : demandez votre code à BDA.', 403);
      }
      $st = db()->prepare('SELECT COUNT(*) FROM appli_clients WHERE email = ?');
      $st->execute([$email]);
      if ((int)$st->fetchColumn()) echec('Un compte existe déjà avec cet e-mail : connectez-vous.', 409);
      db()->prepare('INSERT INTO appli_clients (email, hash, prenom, nom, tel, offres, cree, derniere) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([$email, password_hash($mdp, PASSWORD_DEFAULT), $prenom, $nom, $tel, empty($b['offres']) ? 0 : 1, maintenant(), maintenant()]);
      $id = (int)db()->lastInsertId();
      journal('vtc', 'Appli : nouveau compte client');
      notifier('appli', 'Nouveau client dans l’appli', 'Un client vient de créer son compte.', '/admin/#/appli/clients', 'appli-client');
      repondre(['ok' => true, 'jeton' => appli_jeton_creer('client', $id), 'compte' => appli_client_public(appli_client($id))]);

    case 'client.connexion':
      $b = corps();
      $cle = 'appli-cx:' . empreinte_client();
      if (tentatives($cle, 900) >= 10) echec('Trop de tentatives. Réessayez dans 15 minutes.', 429);
      $st = db()->prepare('SELECT * FROM appli_clients WHERE email = ?');
      $st->execute([mb_strtolower(texte($b['email'] ?? '', 160))]);
      $c = $st->fetch();
      if ($c && $c['bloque_jusqu'] > maintenant()) echec('Trop d’essais sur ce compte. Réessayez dans 15 minutes ou choisissez « Mot de passe oublié ».', 429);
      $hash = $c ? (string)$c['hash'] : password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT);
      if (!password_verify(chaine($b['motdepasse'] ?? ''), $hash) || !$c) {
        noter_tentative($cle);
        if ($c) {
          $n = (int)$c['echecs'] + 1;
          db()->prepare('UPDATE appli_clients SET echecs = ?, bloque_jusqu = ? WHERE id = ?')->execute([$n >= 6 ? 0 : $n, $n >= 6 ? date('Y-m-d H:i:s', time() + 900) : '', $c['id']]);
        }
        usleep(500000);
        echec('E-mail ou mot de passe incorrect.', 401);
      }
      if (password_needs_rehash($c['hash'], PASSWORD_DEFAULT)) db()->prepare('UPDATE appli_clients SET hash = ? WHERE id = ?')->execute([password_hash(chaine($b['motdepasse']), PASSWORD_DEFAULT), $c['id']]);
      db()->prepare("UPDATE appli_clients SET echecs = 0, bloque_jusqu = '', derniere = ? WHERE id = ?")->execute([maintenant(), $c['id']]);
      repondre(['ok' => true, 'jeton' => appli_jeton_creer('client', (int)$c['id']), 'compte' => appli_client_public(appli_client((int)$c['id']))]);

    case 'client.oubli':
      $b = corps();
      if (!limiter('appli-oubli', 5, 3600)) echec('Trop de demandes. Réessayez dans une heure.', 429);
      $st = db()->prepare('SELECT * FROM appli_clients WHERE email = ?');
      $st->execute([mb_strtolower(texte($b['email'] ?? '', 160))]);
      $c = $st->fetch();
      if ($c) {
        $jeton = bin2hex(random_bytes(24));
        db()->prepare('UPDATE appli_clients SET reset = ?, reset_expire = ? WHERE id = ?')->execute([hash('sha256', $jeton), date('Y-m-d H:i:s', time() + 3600), $c['id']]);
        envoyer_mail('Nouveau mot de passe — B-Drive', "Bonjour {$c['prenom']},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien sur votre téléphone (valable 1 heure) :\n" . lien_appli('/appli/#reset=' . $jeton) . "\n\nSi vous n'avez rien demandé, ignorez ce message : votre mot de passe ne change pas.\n\nB-Drive · votre chauffeur privé BDA", '', (string)$c['email']);
      }
      repondre(['ok' => true]);

    case 'client.reset':
      $b = corps();
      $cle = 'appli-reset:' . empreinte_client();
      if (tentatives($cle, 3600) >= 10) echec('Trop de tentatives. Réessayez plus tard.', 429);
      $jeton = chaine($b['jeton'] ?? '');
      $c = null;
      if (preg_match('/^[a-f0-9]{48}$/', $jeton)) {
        $st = db()->prepare('SELECT * FROM appli_clients WHERE reset = ?');
        $st->execute([hash('sha256', $jeton)]);
        $c = $st->fetch() ?: null;
        if ($c && $c['reset_expire'] < maintenant()) $c = null;
      }
      if (!$c) { noter_tentative($cle); echec('Ce lien n’est plus valable. Refaites « Mot de passe oublié ».', 404); }
      $mdp = chaine($b['motdepasse'] ?? '');
      appli_mdp_valide($mdp);
      db()->prepare("UPDATE appli_clients SET hash = ?, reset = '', reset_expire = '', echecs = 0, bloque_jusqu = '' WHERE id = ?")->execute([password_hash($mdp, PASSWORD_DEFAULT), $c['id']]);
      db()->prepare("DELETE FROM appli_jetons WHERE role = 'client' AND compte_id = ?")->execute([$c['id']]); // les autres téléphones sont déconnectés
      repondre(['ok' => true, 'jeton' => appli_jeton_creer('client', (int)$c['id']), 'compte' => appli_client_public(appli_client((int)$c['id']))]);

    case 'client.moi':
      $c = client_connecte();
      $st = db()->prepare("SELECT COUNT(*) FROM courses WHERE client_id = ? AND statut = 'terminee'");
      $st->execute([$c['id']]);
      repondre(['ok' => true, 'compte' => appli_client_public($c) + ['courses' => (int)$st->fetchColumn()]]);

    case 'client.profil':
      $c = client_connecte();
      $b = corps();
      $prenom = texte($b['prenom'] ?? $c['prenom'], 60);
      if (mb_strlen($prenom) < 2) echec('Indiquez votre prénom.');
      $email = array_key_exists('email', $b) ? email_valide((string)$b['email']) : $c['email'];
      if ($email !== mb_strtolower($c['email'])) {
        $st = db()->prepare('SELECT COUNT(*) FROM appli_clients WHERE email = ? AND id <> ?');
        $st->execute([$email, $c['id']]);
        if ((int)$st->fetchColumn()) echec('Cet e-mail est déjà utilisé par un autre compte.', 409);
      }
      db()->prepare('UPDATE appli_clients SET prenom = ?, nom = ?, tel = ?, email = ?, offres = ? WHERE id = ?')->execute([
        $prenom, texte($b['nom'] ?? $c['nom'], 60), tel_valide((string)($b['tel'] ?? $c['tel']), true), $email,
        array_key_exists('offres', $b) ? (empty($b['offres']) ? 0 : 1) : (int)$c['offres'], $c['id'],
      ]);
      repondre(['ok' => true, 'compte' => appli_client_public(appli_client((int)$c['id']))]);

    case 'client.motdepasse':
      $c = client_connecte();
      $b = corps();
      if (!password_verify(chaine($b['actuel'] ?? ''), (string)$c['hash'])) { usleep(400000); echec('Mot de passe actuel incorrect.', 403); }
      $mdp = chaine($b['nouveau'] ?? '');
      appli_mdp_valide($mdp);
      db()->prepare('UPDATE appli_clients SET hash = ? WHERE id = ?')->execute([password_hash($mdp, PASSWORD_DEFAULT), $c['id']]);
      db()->prepare("DELETE FROM appli_jetons WHERE role = 'client' AND compte_id = ? AND jeton <> ?")->execute([$c['id'], $s['empreinte']]);
      repondre(['ok' => true]);

    case 'client.deconnexion':
    case 'chauffeur.deconnexion':
      if ($s) {
        db()->prepare('DELETE FROM appli_jetons WHERE jeton = ?')->execute([$s['empreinte']]);
        if ($s['role'] === 'chauffeur') db()->prepare('UPDATE appli_chauffeurs SET en_ligne = 0, maj = ? WHERE compte_id = ?')->execute([maintenant(), $s['id']]);
      }
      $b = corps();
      if (!empty($b['endpoint'])) db()->prepare('DELETE FROM appli_push WHERE endpoint = ?')->execute([texte($b['endpoint'], 1000)]);
      repondre(['ok' => true]);

    // Suppression du compte (obligatoire sur l'App Store et Google Play)
    case 'client.supprimer':
      $c = client_connecte();
      $b = corps();
      if (!password_verify(chaine($b['motdepasse'] ?? ''), (string)$c['hash'])) { usleep(400000); echec('Mot de passe incorrect.', 403); }
      $st = db()->prepare("SELECT COUNT(*) FROM courses WHERE client_id = ? AND statut IN ('acceptee', 'arrivee', 'en_course')");
      $st->execute([$c['id']]);
      if ((int)$st->fetchColumn()) echec('Une course est en cours : supprimez votre compte une fois arrivé.', 409);
      $st = db()->prepare('SELECT * FROM courses WHERE client_id = ?');
      $st->execute([$c['id']]);
      foreach ($st->fetchAll() as $r) {
        $d = json_decode((string)$r['data'], true) ?: [];
        // les reçus restent (obligation comptable) mais sans nom, téléphone ni e-mail
        $d['client'] = ['prenom' => 'Compte supprimé', 'nom' => '', 'tel' => '', 'email' => ''];
        $d['passager'] = null;
        $statut = in_array($r['statut'], ['recherche', 'reservee', 'confirmee'], true) ? 'annulee' : $r['statut'];
        // client_id remis à 0 : un futur compte qui reprendrait ce numéro ne verra jamais ces courses
        db()->prepare('UPDATE courses SET client_id = 0, data = ?, statut = ?, avis = ?, annule = CASE WHEN ? = \'annulee\' AND annule = \'\' THEN ? ELSE annule END, annule_par = CASE WHEN ? <> statut THEN \'client\' ELSE annule_par END, maj = ? WHERE id = ?')
          ->execute([json_encode($d, JSON_UNESCAPED_UNICODE), $statut, '', $statut, maintenant(), $statut, maintenant(), $r['id']]);
        db()->prepare('DELETE FROM courses_messages WHERE course_id = ?')->execute([$r['id']]);
      }
      db()->prepare("DELETE FROM appli_jetons WHERE role = 'client' AND compte_id = ?")->execute([$c['id']]);
      db()->prepare("DELETE FROM appli_push WHERE role = 'client' AND compte_id = ?")->execute([$c['id']]);
      db()->prepare('DELETE FROM appli_clients WHERE id = ?')->execute([$c['id']]);
      journal('vtc', 'Appli : un client a supprimé son compte');
      repondre(['ok' => true]);

    // Copie de toutes les données du client (droit d'accès RGPD)
    case 'client.donnees':
      $c = client_connecte();
      $st = db()->prepare('SELECT * FROM courses WHERE client_id = ? ORDER BY id');
      $st->execute([$c['id']]);
      $courses = array_map(function ($r) { $r['data'] = json_decode((string)$r['data'], true) ?: []; $v = appli_vue_client($r); unset($v['suivi']); return $v; }, $st->fetchAll());
      repondre(['ok' => true, 'export' => ['compte' => appli_client_public($c) + ['cree' => $c['cree'], 'derniereConnexion' => $c['derniere']], 'courses' => $courses, 'exportLe' => date('c')]]);

    case 'promo.verifier':
      $c = client_connecte();
      $b = corps();
      if (!limiter('appli-promo', 20, 600)) echec('Trop d’essais. Patientez un instant.', 429);
      $p = appli_promo(appli_cfg(), chaine($b['code'] ?? ''), (int)$c['id']);
      if (!$p) echec('Ce code n’existe pas, a expiré ou a déjà servi.', 404);
      repondre(['ok' => true, 'promo' => $p]);

    // Signaler un problème, objet oublié, demande de compte entreprise : arrive à la direction par e-mail
    case 'support':
      $c = client_connecte();
      $b = corps();
      if (!limiter('appli-support', 10, 3600)) echec('Trop de messages. Réessayez dans une heure.', 429);
      $types = ['probleme' => 'Problème signalé', 'objet' => 'Objet oublié', 'entreprise' => 'Demande de compte entreprise', 'cadeau' => 'Carte cadeau'];
      $type = array_key_exists((string)($b['type'] ?? ''), $types) ? (string)$b['type'] : 'probleme';
      $texte = texte($b['texte'] ?? '', 2000);
      if ($texte === '') echec('Écrivez votre message.');
      $numero = texte($b['numero'] ?? '', 30);
      $corps = "{$types[$type]} depuis l'appli BDA\n\nClient : {$c['prenom']} {$c['nom']}\nTéléphone : {$c['tel']}\nE-mail : {$c['email']}\n" . ($numero !== '' ? "Course : $numero\n" : '') . (!empty($b['motif']) ? 'Motif : ' . texte($b['motif'], 80) . "\n" : '') . "\n$texte\n";
      envoyer_mail("Appli BDA — {$types[$type]}", $corps, (string)$c['email']);
      journal('vtc', "Appli : {$types[$type]}" . ($numero !== '' ? " (course $numero)" : ''));
      notifier('appli', $types[$type], 'Un client de l’appli a écrit à BDA : le détail est dans vos e-mails.', '/admin/#/appli', 'appli-support');
      repondre(['ok' => true]);

    /* ================= Clients : courses ================= */
    // Chauffeurs libres autour du client (positions arrondies) et délai d'approche du plus proche
    case 'voisins':
      client_connecte();
      $p = appli_lieu(['titre' => 'x', 'lat' => $_GET['lat'] ?? null, 'lng' => $_GET['lng'] ?? null]);
      $liste = [];
      $proche = null;
      if ($p) {
        $st = db()->prepare("SELECT ac.* FROM appli_chauffeurs ac JOIN comptes_equipe ce ON ce.id = ac.compte_id AND ce.statut = 'actif' WHERE ac.autorise = 1 AND ac.en_ligne = 1 AND ac.vu > ? AND ac.lat IS NOT NULL
          AND ac.compte_id NOT IN (SELECT chauffeur_id FROM courses WHERE statut IN ('acceptee', 'arrivee', 'en_course'))");
        $st->execute([date('Y-m-d H:i:s', time() - APPLI_EN_LIGNE)]);
        foreach ($st->fetchAll() as $v) {
          $dist = appli_distance($p, ['lat' => $v['lat'], 'lng' => $v['lng']]);
          if ($dist > 12000) continue;
          $gammes = json_decode((string)$v['gammes'], true) ?: [];
          // position arrondie à environ 50 m : le client voit les voitures autour de lui, pas l'adresse exacte du chauffeur
          $liste[] = ['lat' => round((float)$v['lat'] * 2000) / 2000, 'lng' => round((float)$v['lng'] * 2000) / 2000, 'cap' => $v['cap'] === null ? null : round((float)$v['cap'] / 15) * 15, 'gammes' => $gammes];
          foreach ($gammes as $g) $proche[$g] = min($proche[$g] ?? INF, $dist);
        }
      }
      // délai d'approche : environ 1,4 × la distance à vol d'oiseau, à 22 km/h en ville, plus 1 minute
      $delais = [];
      foreach ((array)$proche as $g => $d) $delais[$g] = max(2, (int)round($d * 1.4 / 1000 / 22 * 60) + 1);
      repondre(['ok' => true, 'chauffeurs' => array_slice($liste, 0, 25), 'delais' => (object)$delais]);

    case 'course.creer':
      $client = client_connecte();
      $b = corps();
      $cfg = appli_cfg();
      if (!$cfg['ouvert']) echec('Les courses dans l’appli sont fermées pour le moment. Appelez BDA au 06 11 67 86 25.', 503);
      if (!limiter('appli-course', 15, 3600)) echec('Trop de demandes depuis cet appareil. Réessayez plus tard.', 429);
      $gamme = in_array($b['gamme'] ?? '', APPLI_GAMMES, true) ? (string)$b['gamme'] : '';
      if ($gamme === '' || empty($cfg['gammes'][$gamme]['actif']) || ($gamme === 'vip' && empty($cfg['gammes']['berline']['actif']))) echec('Cette gamme n’est pas disponible pour le moment.');
      $mode = ($b['mode'] ?? '') === 'dispo' ? 'dispo' : 'trajet';
      $depart = appli_lieu($b['depart'] ?? null);
      if (!$depart) echec('Indiquez l’adresse de départ.');
      $arrivee = $mode === 'trajet' ? appli_lieu($b['arrivee'] ?? null) : null;
      if ($mode === 'trajet' && !$arrivee) echec('Indiquez la destination.');
      $arret = $mode === 'trajet' ? appli_lieu($b['arret'] ?? null) : null;
      if ($arrivee && appli_distance($depart, $arrivee) < 150 && !$arret) echec('Le départ et la destination sont au même endroit.');
      foreach (array_filter([$depart, $arrivee, $arret]) as $l) if (appli_distance($l, ['lat' => 48.8566, 'lng' => 2.3522]) > 160000) echec('BDA roule en Île-de-France et vers les aéroports de Paris (Beauvais compris).');
      // maintenant, ou réservation de 30 minutes à 30 jours à l'avance
      $quand = trim(chaine($b['quand'] ?? ''));
      $immediate = $quand === '' && $mode === 'trajet';
      if (!$immediate) {
        $t = strtotime(str_replace('T', ' ', $quand));
        if (!$t) echec('Choisissez la date et l’heure de la réservation.');
        if ($t < time() + 25 * 60) echec('Réservez au moins 30 minutes à l’avance, ou commandez maintenant.');
        if ($t > time() + 31 * 86400) echec('On peut réserver jusqu’à 30 jours à l’avance.');
        $quand = date('Y-m-d H:i:s', $t);
      } else {
        $quand = maintenant();
        $st = db()->prepare("SELECT COUNT(*) FROM courses WHERE client_id = ? AND statut IN ('recherche', 'acceptee', 'arrivee', 'en_course')");
        $st->execute([$client['id']]);
        if ((int)$st->fetchColumn()) echec('Vous avez déjà une course en cours.', 409);
      }
      [$transport, $protection, $km, $min] = appli_prix($cfg, $gamme, ['mode' => $mode, 'km' => (float)($b['km'] ?? 0), 'min' => (int)($b['min'] ?? 0), 'heures' => (float)($b['heures'] ?? 0), 'depart' => $depart, 'arrivee' => $arrivee, 'arret' => $arret]);
      $promo = !empty($b['promo']) ? appli_promo($cfg, chaine($b['promo']), (int)$client['id']) : null;
      if (!empty($b['promo']) && !$promo) echec('Le code promo n’est plus valable : retirez-le pour commander.', 409);
      $remise = $promo ? min($promo['montant'], $transport) : 0;
      // le client a vu un prix : s'il a changé entre-temps (réglages modifiés), on le lui dit avant de commander
      $vu = (float)($b['prixVu'] ?? 0);
      $total = $transport - $remise + $protection;
      if ($vu > 0 && abs($vu - $total) >= 1) repondre(['ok' => false, 'erreur' => 'Le prix a été mis à jour : ' . euros_txt($total) . '. Vérifiez puis commandez à nouveau.', 'prix' => $total], 409);
      $passager = null;
      if (!empty($b['passager']['prenom'])) $passager = ['prenom' => texte($b['passager']['prenom'], 40), 'tel' => tel_valide((string)($b['passager']['tel'] ?? ''), true)];
      $vol = strtoupper(texte($b['vol'] ?? '', 12));
      if ($vol !== '' && !preg_match('/^[A-Z0-9]{2,3} ?\d{1,4}[A-Z]?$/', $vol)) echec('Numéro de vol invalide (exemple : AF 1234).');
      $prefs = [];
      foreach (['silence', 'eau', 'bagages', 'chien', 'fauteuil'] as $k) $prefs[$k] = !empty($b['prefs'][$k]);
      foreach (['temperature' => ['Standard', 'Frais', 'Chaud'], 'musique' => ['Au choix du chauffeur', 'Sans musique', 'Radio', 'Classique', 'Jazz']] as $k => $ok) $prefs[$k] = in_array($b['prefs'][$k] ?? '', $ok, true) ? $b['prefs'][$k] : $ok[0];
      $data = [
        'depart' => $depart, 'arrivee' => $arrivee, 'arret' => $arret, 'heures' => $mode === 'dispo' ? max((float)$cfg['heuresMin'], min((float)$cfg['heuresMax'], (float)($b['heures'] ?? 0))) : 0,
        'passager' => $passager, 'vol' => $vol, 'pancarte' => $vol !== '' && !empty($b['pancarte']), 'prefs' => $prefs,
        'promo' => $promo['code'] ?? '', 'favori' => $immediate ? max(0, (int)($b['favori'] ?? 0)) : 0,
        'client' => ['prenom' => $client['prenom'], 'nom' => $client['nom'], 'tel' => $client['tel'], 'email' => $client['email']],
      ];
      $numero = appli_numero();
      $code = !empty($b['code']) ? sprintf('%04d', random_int(0, 9999)) : '';
      db()->prepare('INSERT INTO courses (numero, suivi, client_id, statut, gamme, mode, quand, immediate, km, minutes, transport, remise, protection, code, data, recherche, cree, maj) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([$numero, bin2hex(random_bytes(12)), $client['id'], $immediate ? 'recherche' : 'reservee', $gamme, $mode, $quand, $immediate ? 1 : 0, $km, $min, $transport, $remise, $protection, $code, json_encode($data, JSON_UNESCAPED_UNICODE), $immediate ? maintenant() : '', maintenant(), maintenant()]);
      // les chauffeurs concernés sont prévenus sur leur téléphone (sans nom ni adresse)
      $st = db()->query("SELECT compte_id, gammes, en_ligne, vu, lat, lng FROM appli_chauffeurs WHERE autorise = 1");
      foreach ($st->fetchAll() as $v) {
        if (!in_array($gamme, json_decode((string)$v['gammes'], true) ?: [], true)) continue;
        if ($immediate) {
          if (!(int)$v['en_ligne'] || $v['vu'] < date('Y-m-d H:i:s', time() - APPLI_EN_LIGNE)) continue;
          $dist = $v['lat'] !== null ? appli_distance($depart, ['lat' => $v['lat'], 'lng' => $v['lng']]) : null;
          if ($dist !== null && $dist > 30000) continue;
          appli_push('chauffeur', (int)$v['compte_id'], 'Nouvelle course B-Drive', nom_gamme($gamme) . ($dist !== null ? ' · à ' . number_format($dist / 1000, 1, ',', '') . ' km' : '') . ' · ' . euros_txt($transport - $remise), '/appli/chauffeur/', 'offre');
        } else {
          appli_push('chauffeur', (int)$v['compte_id'], 'Nouvelle réservation B-Drive', nom_gamme($gamme) . ' · ' . date('d/m à H\hi', strtotime($quand)) . ' · à accepter', '/appli/chauffeur/', 'reservation');
        }
      }
      journal('vtc', "Appli : " . ($immediate ? 'course demandée' : 'réservation') . " $numero (" . nom_gamme($gamme) . ', ' . euros_txt($total) . ')');
      notifier('appli', $immediate ? 'Course demandée dans l’appli' : 'Réservation dans l’appli', nom_gamme($gamme) . ' · ' . euros_txt($total) . ($immediate ? '' : ' · ' . date('d/m à H\hi', strtotime($quand))), '/admin/#/appli', 'appli-course');
      repondre(['ok' => true, 'course' => appli_vue_client(appli_course($numero))]);

    // Courses du client : en cours, à venir, passées
    case 'courses':
      $client = client_connecte();
      $st = db()->prepare('SELECT * FROM courses WHERE client_id = ? ORDER BY id DESC LIMIT 120');
      $st->execute([$client['id']]);
      $out = ['encours' => null, 'avenir' => [], 'passees' => []];
      foreach ($st->fetchAll() as $r) {
        $r['data'] = json_decode((string)$r['data'], true) ?: [];
        $v = appli_vue_client($r);
        if (in_array($r['statut'], ['recherche', 'acceptee', 'arrivee', 'en_course'], true)) { if (!$out['encours']) $out['encours'] = $v; }
        elseif (in_array($r['statut'], ['reservee', 'confirmee'], true)) $out['avenir'][] = $v;
        elseif (count($out['passees']) < 60 && $r['statut'] !== 'aucun') $out['passees'][] = $v;
      }
      usort($out['avenir'], fn($a, $b) => strcmp($a['quand'], $b['quand']));
      repondre(['ok' => true] + $out);

    // Une course (client ou chauffeur) et les nouveaux messages
    case 'course':
      if (!$s) echec('Connexion requise.', 401);
      $role = $s['role'];
      if ($role === 'client') client_connecte(); else chauffeur_connecte();
      $c = course_de((string)($_GET['n'] ?? ''), $role, $s['id']);
      $apres = max(0, (int)($_GET['apres'] ?? 0));
      repondre(['ok' => true, 'course' => $role === 'client' ? appli_vue_client($c) : appli_vue_chauffeur($c), 'messages' => appli_messages((int)$c['id'], $apres)]);

    case 'course.annuler':
      $client = client_connecte();
      $b = corps();
      $c = course_de((string)($b['numero'] ?? ''), 'client', (int)$client['id']);
      exiger_statut($c, ['recherche', 'reservee', 'confirmee', 'acceptee', 'arrivee'], 'Cette course ne peut plus être annulée.');
      $cfg = appli_cfg();
      // gratuit jusqu'à l'arrivée du chauffeur (course immédiate) ou jusqu'à 1 h avant (réservation)
      $frais = $c['statut'] === 'arrivee' || (!$c['immediate'] && in_array($c['statut'], ['confirmee', 'acceptee', 'arrivee'], true) && strtotime((string)$c['quand']) - time() < 3600);
      $d = $c['data'];
      $d['frais'] = $frais;
      appli_course_maj((int)$c['id'], ['statut' => 'annulee', 'annule' => maintenant(), 'annule_par' => 'client'], $d);
      if ((int)$c['chauffeur_id']) appli_push('chauffeur', (int)$c['chauffeur_id'], 'Course annulée', 'Le client a annulé la course ' . $c['numero'] . '.', '/appli/chauffeur/', 'annulee');
      journal('vtc', "Appli : course {$c['numero']} annulée par le client" . ($frais ? ' (hors délai)' : ''));
      if (!$c['immediate']) notifier('appli', 'Réservation annulée', 'Un client a annulé sa réservation' . ($frais ? ' hors délai' : '') . '.', '/admin/#/appli', 'appli-annulee');
      repondre(['ok' => true, 'frais' => $frais, 'minimum' => $frais ? (float)($cfg['gammes'][$c['gamme'] === 'vip' ? 'berline' : $c['gamme']]['minimum'] ?? 0) : 0]);

    case 'course.message':
      if (!$s) echec('Connexion requise.', 401);
      $b = corps();
      $role = $s['role'];
      if ($role === 'client') client_connecte(); else chauffeur_connecte();
      $c = course_de((string)($b['numero'] ?? ''), $role, $s['id']);
      exiger_statut($c, ['confirmee', 'acceptee', 'arrivee', 'en_course'], 'La messagerie est fermée pour cette course.');
      if (!limiter('appli-msg', 80, 600)) echec('Trop de messages. Patientez un instant.', 429);
      $texte = texte($b['texte'] ?? '', 400);
      if ($texte === '') echec('Message vide.');
      db()->prepare('INSERT INTO courses_messages (course_id, auteur, texte, cree) VALUES (?, ?, ?, ?)')->execute([$c['id'], $role, $texte, maintenant()]);
      $id = (int)db()->lastInsertId();
      if ($role === 'client' && (int)$c['chauffeur_id']) appli_push('chauffeur', (int)$c['chauffeur_id'], 'Message du client', 'Nouveau message pour la course en cours.', '/appli/chauffeur/', 'message');
      if ($role === 'chauffeur') appli_push('client', (int)$c['client_id'], 'Message de votre chauffeur', 'Ouvrez l’appli pour le lire.', '/appli/', 'message');
      repondre(['ok' => true, 'messages' => appli_messages((int)$c['id'], max(0, (int)($b['apres'] ?? $id - 1)))]);

    case 'course.noter':
      $client = client_connecte();
      $b = corps();
      $c = course_de((string)($b['numero'] ?? ''), 'client', (int)$client['id']);
      exiger_statut($c, ['terminee'], 'Vous pourrez noter la course une fois arrivé.');
      $note = max(1, min(5, (int)($b['note'] ?? 5)));
      $premiere = (int)$c['note_client'] === 0;
      appli_course_maj((int)$c['id'], ['note_client' => $note, 'avis' => texte($b['avis'] ?? '', 300)]);
      if ($premiere && (int)$c['chauffeur_id']) {
        db()->prepare('UPDATE appli_chauffeurs SET note = (note * nb_notes + ?) / (nb_notes + 1), nb_notes = nb_notes + 1 WHERE compte_id = ?')->execute([$note, $c['chauffeur_id']]);
      }
      repondre(['ok' => true]);

    // Bouton Urgence : la direction est prévenue tout de suite (notification + e-mail avec la position)
    case 'course.alerte':
      if (!$s) echec('Connexion requise.', 401);
      $b = corps();
      $role = $s['role'];
      $qui = $role === 'client' ? client_connecte() : chauffeur_connecte();
      $c = course_de((string)($b['numero'] ?? ''), $role, $s['id']);
      [$lat, $lng, $prec] = position_gps($b);
      $d = $c['data'];
      $d['alertes'][] = ['quand' => maintenant(), 'par' => $role, 'lat' => $lat, 'lng' => $lng];
      appli_course_maj((int)$c['id'], [], $d);
      $ch = (int)$c['chauffeur_id'] ? appli_chauffeur((int)$c['chauffeur_id']) : null;
      $corps = "ALERTE envoyée depuis l'appli BDA par " . ($role === 'client' ? 'le client' : 'le chauffeur') . "\n\nCourse : {$c['numero']} (" . nom_gamme($c['gamme']) . ")\nStatut : {$c['statut']}\n"
        . 'Client : ' . trim(($d['client']['prenom'] ?? '') . ' ' . ($d['client']['nom'] ?? '')) . ' · ' . ($d['client']['tel'] ?? '') . "\n"
        . ($ch ? "Chauffeur : {$ch['prenom']} {$ch['nom']} · {$ch['tel']} · " . ($ch['vehicule']['plaque'] ?? '') . "\n" : '')
        . ($lat !== null ? "Position : https://www.google.com/maps?q=$lat,$lng" . ($prec ? " (± {$prec} m)" : '') . "\n" : "Position : non transmise\n")
        . "\nRappelez immédiatement. En cas de danger : 17.\n";
      envoyer_mail('ALERTE appli BDA — course ' . $c['numero'], $corps, $role === 'client' ? (string)$qui['email'] : '');
      journal('alerte', "Appli : ALERTE sur la course {$c['numero']} (" . ($role === 'client' ? 'client' : 'chauffeur') . ')');
      notifier('appli', 'ALERTE dans l’appli BDA', 'Une personne demande l’aide de l’assistance : regardez vos e-mails et rappelez.', '/admin/#/appli', 'appli-alerte-' . $c['id']);
      repondre(['ok' => true]);

    /* ================= Chauffeurs ================= */
    case 'chauffeur.connexion':
      $b = corps();
      $cle = 'appli-chf:' . empreinte_client();
      if (tentatives($cle, 900) >= 10) echec('Trop de tentatives. Réessayez dans 15 minutes.', 429);
      $saisi = mb_strtolower(texte($b['identifiant'] ?? '', 160));
      $st = db()->prepare("SELECT * FROM comptes_equipe WHERE identifiant = ? OR (email = ? AND ? LIKE '%@%') ORDER BY (statut = 'actif') DESC LIMIT 1");
      $st->execute([$saisi, $saisi, $saisi]);
      $c = $st->fetch();
      if ($c && $c['bloque_jusqu'] > maintenant()) echec('Trop d’essais sur ce compte. Réessayez dans 15 minutes.', 429);
      $hash = $c ? (string)$c['hash'] : password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT);
      if (!password_verify(chaine($b['motdepasse'] ?? ''), $hash) || !$c) {
        noter_tentative($cle);
        if ($c) {
          $n = (int)$c['echecs'] + 1;
          db()->prepare('UPDATE comptes_equipe SET echecs = ?, bloque_jusqu = ? WHERE id = ?')->execute([$n >= 6 ? 0 : $n, $n >= 6 ? date('Y-m-d H:i:s', time() + 900) : '', $c['id']]);
        }
        usleep(500000);
        echec('Identifiant ou mot de passe incorrect.', 401);
      }
      if ($c['statut'] === 'attente' || !(int)$c['agent_id']) echec('Votre compte Espace équipe attend la validation de la direction.', 403);
      $ch = $c['statut'] === 'actif' ? appli_chauffeur((int)$c['id']) : null;
      if (!$ch) echec('Votre compte n’est pas autorisé à conduire avec l’appli BDA. Contactez la direction au 06 11 67 86 25.', 403);
      db()->prepare("UPDATE comptes_equipe SET echecs = 0, bloque_jusqu = '', derniere = ? WHERE id = ?")->execute([maintenant(), $c['id']]);
      journal('acces', "Appli chauffeur : connexion de {$c['prenom']} {$c['nom']}");
      repondre(['ok' => true, 'jeton' => appli_jeton_creer('chauffeur', (int)$c['id'])]);

    case 'chauffeur.moi':
      $ch = chauffeur_connecte();
      repondre(['ok' => true, 'chauffeur' => ['id' => (int)$ch['id'], 'prenom' => $ch['prenom'], 'nom' => $ch['nom'], 'tel' => $ch['tel'], 'identifiant' => $ch['identifiant'], 'vehicule' => (object)$ch['vehicule'], 'gammes' => $ch['gammes'], 'note' => appli_note($ch), 'nbNotes' => (int)$ch['nb_notes'], 'enLigne' => appli_en_ligne($ch)], 'gammes' => array_map(fn($g) => ['cle' => $g, 'nom' => nom_gamme($g)], APPLI_GAMMES)]);

    case 'chauffeur.vehicule':
      $ch = chauffeur_connecte();
      $b = corps();
      $modele = texte($b['modele'] ?? '', 60);
      $couleur = texte($b['couleur'] ?? '', 30);
      $plaque = strtoupper(preg_replace('/\s+/', '-', texte($b['plaque'] ?? '', 14)));
      if (mb_strlen($modele) < 3) echec('Indiquez la marque et le modèle (ex. Mercedes Classe E).');
      if (!preg_match('/^[A-Z0-9-]{4,12}$/', $plaque)) echec('Plaque d’immatriculation invalide (ex. GH-482-TZ).');
      // le chauffeur choisit ses gammes ; le VIP (avec garde du corps) n'est donné que par la direction
      $gammes = array_values(array_intersect(['berline', 'electrique', 'suv', 'luxe', 'van'], (array)($b['gammes'] ?? [])));
      if (!$gammes) echec('Choisissez au moins une gamme.');
      if (in_array('vip', $ch['gammes'], true)) $gammes[] = 'vip';
      db()->prepare('UPDATE appli_chauffeurs SET vehicule = ?, gammes = ?, maj = ? WHERE compte_id = ?')->execute([json_encode(['modele' => $modele, 'couleur' => $couleur, 'plaque' => $plaque], JSON_UNESCAPED_UNICODE), json_encode($gammes), maintenant(), $ch['id']]);
      journal('equipe', "Appli chauffeur : véhicule de {$ch['prenom']} {$ch['nom']} mis à jour ($plaque)");
      repondre(['ok' => true]);

    /* Toutes les 3 à 4 secondes : position du chauffeur, courses proposées, course en cours */
    case 'chauffeur.etat':
      $ch = chauffeur_connecte();
      $b = corps();
      $champs = ['vu' => maintenant(), 'maj' => maintenant()];
      if (array_key_exists('enLigne', $b)) {
        $veut = !empty($b['enLigne']);
        if ($veut && (empty($ch['vehicule']['plaque']) || empty($ch['vehicule']['modele']))) echec('Renseignez d’abord votre véhicule dans Profil.', 409);
        if ($veut && !appli_cfg()['ouvert']) echec('L’appli est fermée par la direction pour le moment.', 409);
        $champs['en_ligne'] = $veut ? 1 : 0;
      }
      [$lat, $lng, $prec] = position_gps($b);
      if ($lat !== null) {
        $champs += ['lat' => $lat, 'lng' => $lng, 'prec' => $prec, 'position_le' => maintenant()];
        if (is_numeric($b['cap'] ?? null)) $champs['cap'] = fmod((float)$b['cap'] + 360, 360); // sinon on garde le dernier cap connu
      }
      $sets = implode(', ', array_map(fn($k) => "$k = ?", array_keys($champs)));
      db()->prepare("UPDATE appli_chauffeurs SET $sets WHERE compte_id = ?")->execute([...array_values($champs), $ch['id']]);
      $ch = appli_chauffeur((int)$ch['id']);
      $enLigne = (int)$ch['en_ligne'] === 1;
      $encours = chauffeur_occupe((int)$ch['id']);
      $offres = [];
      if ($enLigne && !$encours) {
        $st = db()->prepare("SELECT * FROM courses WHERE statut = 'recherche' ORDER BY id DESC LIMIT 50");
        $st->execute();
        foreach ($st->fetchAll() as $r) {
          if (!in_array($r['gamme'], $ch['gammes'], true)) continue;
          if (in_array((int)$ch['id'], json_decode((string)$r['refus'], true) ?: [], true)) continue;
          $r['data'] = json_decode((string)$r['data'], true) ?: [];
          $fav = (int)($r['data']['favori'] ?? 0);
          if ($fav && $fav !== (int)$ch['id'] && strtotime((string)$r['recherche']) > time() - APPLI_FAVORI) continue;
          $v = appli_vue_chauffeur($r, true, $ch);
          if (isset($v['distance']) && $v['distance'] > 30000) continue;
          $v['expire'] = max(0, strtotime((string)$r['recherche']) + APPLI_RECHERCHE - time());
          $v['favori'] = $fav === (int)$ch['id'];
          $offres[] = $v;
        }
        usort($offres, fn($a, $b) => ($b['favori'] <=> $a['favori']) ?: (($a['distance'] ?? 1e9) <=> ($b['distance'] ?? 1e9)));
      }
      // réservations à prendre, et celles qui sont déjà confiées à ce chauffeur
      $resa = [];
      $miennes = [];
      $st = db()->prepare("SELECT * FROM courses WHERE ((statut = 'reservee' AND quand > ?) OR (statut = 'confirmee' AND chauffeur_id = ?)) ORDER BY quand LIMIT 60");
      $st->execute([maintenant(), $ch['id']]);
      foreach ($st->fetchAll() as $r) {
        $r['data'] = json_decode((string)$r['data'], true) ?: [];
        if ($r['statut'] === 'confirmee') { $miennes[] = appli_vue_chauffeur($r, false, $ch); continue; }
        if (!in_array($r['gamme'], $ch['gammes'], true) || in_array((int)$ch['id'], json_decode((string)$r['refus'], true) ?: [], true)) continue;
        $resa[] = appli_vue_chauffeur($r, true, $ch);
      }
      $st = db()->prepare("SELECT COALESCE(SUM(transport - remise), 0) t, COUNT(*) n FROM courses WHERE chauffeur_id = ? AND statut = 'terminee' AND fin >= ?");
      $st->execute([$ch['id'], date('Y-m-d 00:00:00')]);
      $jour = $st->fetch();
      $apres = max(0, (int)($b['apres'] ?? 0));
      repondre(['ok' => true, 'enLigne' => $enLigne, 'course' => $encours ? appli_vue_chauffeur($encours, false, $ch) : null, 'messages' => $encours ? appli_messages((int)$encours['id'], $apres) : [],
        'offres' => array_slice($offres, 0, 3), 'reservations' => array_slice($resa, 0, 20), 'mesReservations' => $miennes, 'jour' => ['total' => (float)$jour['t'], 'courses' => (int)$jour['n']], 'ouvert' => appli_cfg()['ouvert']]);

    case 'course.accepter':
      $ch = chauffeur_connecte();
      $b = corps();
      $c = appli_course(texte($b['numero'] ?? '', 30));
      if (!$c || !in_array($c['statut'], ['recherche', 'reservee'], true)) echec('Trop tard : la course a été prise par un autre chauffeur ou annulée.', 409);
      if (!in_array($c['gamme'], $ch['gammes'], true)) echec('Cette gamme ne correspond pas à votre véhicule.', 403);
      if ($c['statut'] === 'recherche' && chauffeur_occupe((int)$ch['id'])) echec('Terminez d’abord votre course en cours.', 409);
      $d = $c['data'];
      $d['chauffeur'] = ['prenom' => $ch['prenom'], 'voiture' => (string)($ch['vehicule']['modele'] ?? ''), 'couleur' => (string)($ch['vehicule']['couleur'] ?? ''), 'plaque' => (string)($ch['vehicule']['plaque'] ?? '')];
      $nouveau = $c['statut'] === 'recherche' ? 'acceptee' : 'confirmee';
      // une seule acceptation possible : la première arrivée gagne
      $st = db()->prepare('UPDATE courses SET chauffeur_id = ?, statut = ?, accepte = ?, data = ?, maj = ? WHERE id = ? AND statut = ? AND chauffeur_id = 0');
      $st->execute([$ch['id'], $nouveau, maintenant(), json_encode($d, JSON_UNESCAPED_UNICODE), maintenant(), $c['id'], $c['statut']]);
      if ($st->rowCount() !== 1) echec('Trop tard : la course a été prise par un autre chauffeur.', 409);
      if ($nouveau === 'acceptee') appli_push('client', (int)$c['client_id'], 'Votre chauffeur arrive', $ch['prenom'] . ' a accepté votre course.', '/appli/', 'course');
      else appli_push('client', (int)$c['client_id'], 'Réservation confirmée', 'Votre chauffeur est attribué pour le ' . date('d/m à H\hi', strtotime((string)$c['quand'])) . '.', '/appli/', 'reservation');
      journal('vtc', "Appli : course {$c['numero']} acceptée par {$ch['prenom']} {$ch['nom']}");
      repondre(['ok' => true, 'course' => appli_vue_chauffeur(appli_course($c['numero']), false, $ch)]);

    case 'course.refuser':
      $ch = chauffeur_connecte();
      $b = corps();
      $c = appli_course(texte($b['numero'] ?? '', 30));
      if ($c && in_array($c['statut'], ['recherche', 'reservee'], true)) {
        $refus = json_decode((string)$c['refus'], true) ?: [];
        if (!in_array((int)$ch['id'], $refus, true)) $refus[] = (int)$ch['id'];
        db()->prepare('UPDATE courses SET refus = ? WHERE id = ?')->execute([json_encode($refus), $c['id']]);
      }
      repondre(['ok' => true]);

    // Réservation confiée : le chauffeur part chercher le client (au plus tôt 2 h avant)
    case 'course.partir':
      $ch = chauffeur_connecte();
      $b = corps();
      $c = course_de((string)($b['numero'] ?? ''), 'chauffeur', (int)$ch['id']);
      exiger_statut($c, ['confirmee'], 'Cette réservation n’est plus à faire.');
      if (strtotime((string)$c['quand']) - time() > 7200) echec('Vous pourrez partir au plus tôt 2 h avant l’heure prévue.', 409);
      if (chauffeur_occupe((int)$ch['id'])) echec('Terminez d’abord votre course en cours.', 409);
      appli_course_maj((int)$c['id'], ['statut' => 'acceptee', 'accepte' => maintenant()]);
      appli_push('client', (int)$c['client_id'], 'Votre chauffeur est en route', $ch['prenom'] . ' part vous chercher.', '/appli/', 'course');
      repondre(['ok' => true, 'course' => appli_vue_chauffeur(appli_course($c['numero']), false, $ch)]);

    case 'course.arrivee':
      $ch = chauffeur_connecte();
      $b = corps();
      $c = course_de((string)($b['numero'] ?? ''), 'chauffeur', (int)$ch['id']);
      exiger_statut($c, ['acceptee'], 'Statut de course inattendu : rechargez l’appli.');
      appli_course_maj((int)$c['id'], ['statut' => 'arrivee', 'arrive' => maintenant()]);
      appli_push('client', (int)$c['client_id'], 'Votre chauffeur est arrivé', trim(($c['data']['chauffeur']['voiture'] ?? '') . ' · ' . ($c['data']['chauffeur']['plaque'] ?? ''), ' ·'), '/appli/', 'course');
      repondre(['ok' => true, 'course' => appli_vue_chauffeur(appli_course($c['numero']), false, $ch)]);

    case 'course.demarrer':
      $ch = chauffeur_connecte();
      $b = corps();
      $c = course_de((string)($b['numero'] ?? ''), 'chauffeur', (int)$ch['id']);
      exiger_statut($c, ['acceptee', 'arrivee'], 'Statut de course inattendu : rechargez l’appli.');
      if ($c['code'] !== '') {
        $cle = 'appli-code-course:' . $c['id'];
        if (tentatives($cle, 3600) >= 6) echec('Trop d’essais : appelez la direction au 06 11 67 86 25.', 429);
        if (!hash_equals($c['code'], preg_replace('/\D/', '', chaine($b['code'] ?? '')))) { noter_tentative($cle); echec('Code incorrect : vérifiez avec le client.', 403); }
      }
      appli_course_maj((int)$c['id'], ['statut' => 'en_course', 'debut' => maintenant()] + ($c['arrive'] === '' ? ['arrive' => maintenant()] : []));
      repondre(['ok' => true, 'course' => appli_vue_chauffeur(appli_course($c['numero']), false, $ch)]);

    case 'course.terminer':
      $ch = chauffeur_connecte();
      $b = corps();
      $c = course_de((string)($b['numero'] ?? ''), 'chauffeur', (int)$ch['id']);
      exiger_statut($c, ['en_course'], 'La course n’a pas démarré.');
      appli_course_maj((int)$c['id'], ['statut' => 'terminee', 'fin' => maintenant()]);
      $c = appli_course($c['numero']);
      // BDA Club : 1 point par euro payé
      db()->prepare('UPDATE appli_clients SET points = points + ? WHERE id = ?')->execute([(int)round(appli_total($c)), $c['client_id']]);
      $cl = appli_client((int)$c['client_id']);
      if ($cl && $cl['email'] !== '') envoyer_mail('Votre reçu B-Drive — course ' . $c['numero'], appli_recu($c), BDA_EMAIL, (string)$cl['email']);
      appli_push('client', (int)$c['client_id'], 'Vous êtes arrivé', 'Votre reçu est prêt dans l’appli.', '/appli/', 'course');
      journal('vtc', "Appli : course {$c['numero']} terminée (" . euros_txt(appli_total($c)) . ')');
      repondre(['ok' => true, 'course' => appli_vue_chauffeur($c, false, $ch)]);

    // Client absent après l'attente offerte
    case 'course.absent':
      $ch = chauffeur_connecte();
      $b = corps();
      $c = course_de((string)($b['numero'] ?? ''), 'chauffeur', (int)$ch['id']);
      exiger_statut($c, ['arrivee'], 'Indiquez d’abord que vous êtes arrivé.');
      $cfg = appli_cfg();
      $attente = (int)(!empty($c['data']['vol']) ? $cfg['attenteAeroport'] : $cfg['attente']);
      $reste = strtotime((string)$c['arrive']) + $attente * 60 - time();
      if ($reste > 0) echec('Attendez encore ' . max(1, (int)ceil($reste / 60)) . ' min (attente offerte au client).', 409);
      $d = $c['data'];
      $d['frais'] = true;
      appli_course_maj((int)$c['id'], ['statut' => 'annulee', 'annule' => maintenant(), 'annule_par' => 'absent'], $d);
      appli_push('client', (int)$c['client_id'], 'Course annulée', 'Votre chauffeur ne vous a pas trouvé après l’attente offerte.', '/appli/', 'course');
      journal('vtc', "Appli : course {$c['numero']} annulée, client absent");
      notifier('appli', 'Client absent', 'Un chauffeur a annulé une course pour absence du client.', '/admin/#/appli', 'appli-absent');
      repondre(['ok' => true]);

    // Le chauffeur ne peut plus faire la course : elle repart vers les autres chauffeurs
    case 'course.abandonner':
      $ch = chauffeur_connecte();
      $b = corps();
      $c = course_de((string)($b['numero'] ?? ''), 'chauffeur', (int)$ch['id']);
      exiger_statut($c, ['acceptee', 'confirmee'], 'Cette course ne peut plus être rendue : appelez la direction.');
      $refus = json_decode((string)$c['refus'], true) ?: [];
      $refus[] = (int)$ch['id'];
      $d = $c['data'];
      unset($d['chauffeur']);
      $d['abandons'][] = ['chauffeur' => (int)$ch['id'], 'quand' => maintenant(), 'motif' => texte($b['motif'] ?? '', 120)];
      $immediat = $c['statut'] === 'acceptee' && (int)$c['immediate'];
      $nouveau = $immediat ? 'recherche' : ($c['statut'] === 'acceptee' ? 'reservee' : 'reservee');
      appli_course_maj((int)$c['id'], ['statut' => $nouveau, 'chauffeur_id' => 0, 'accepte' => '', 'refus' => json_encode($refus), 'recherche' => $immediat ? maintenant() : ''], $d);
      appli_push('client', (int)$c['client_id'], 'Changement de chauffeur', $immediat ? 'Votre chauffeur a dû annuler : nous en cherchons un autre.' : 'Nous attribuons un autre chauffeur à votre réservation.', '/appli/', 'course');
      journal('vtc', "Appli : {$ch['prenom']} {$ch['nom']} a rendu la course {$c['numero']}");
      notifier('appli', 'Course rendue par un chauffeur', $immediat ? 'Elle est proposée aux autres chauffeurs.' : 'La réservation est à attribuer.', '/admin/#/appli', 'appli-rendue');
      repondre(['ok' => true]);

    case 'course.noterClient':
      $ch = chauffeur_connecte();
      $b = corps();
      $c = course_de((string)($b['numero'] ?? ''), 'chauffeur', (int)$ch['id']);
      exiger_statut($c, ['terminee', 'annulee'], 'La course n’est pas terminée.');
      appli_course_maj((int)$c['id'], ['note_chauffeur' => max(1, min(5, (int)($b['note'] ?? 5)))]);
      repondre(['ok' => true]);

    case 'chauffeur.historique':
      $ch = chauffeur_connecte();
      $st = db()->prepare("SELECT * FROM courses WHERE chauffeur_id = ? AND statut IN ('terminee', 'annulee') AND maj >= ? ORDER BY id DESC LIMIT 200");
      $st->execute([$ch['id'], date('Y-m-d 00:00:00', strtotime('-34 days'))]);
      $liste = [];
      foreach ($st->fetchAll() as $r) {
        $r['data'] = json_decode((string)$r['data'], true) ?: [];
        $v = appli_vue_chauffeur($r, false, $ch);
        unset($v['bon']);
        $v['client'] = ['prenom' => $v['client']['prenom']];
        $liste[] = $v;
      }
      repondre(['ok' => true, 'courses' => $liste]);
  }
} catch (PDOException $e) {
  error_log('[BDA appli] ' . $e->getMessage());
  echec('Erreur du serveur. Réessayez dans un instant.', 500);
}
