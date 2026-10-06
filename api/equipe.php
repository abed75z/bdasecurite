<?php
/* =========================================================
   ESPACE ÉQUIPE — API des agents de sécurité et chauffeurs (bdasecurite.com/espace-equipe)
   Session séparée de l'admin et de l'espace client (cookie BDA_EQUIPE).
   - Le compte est créé par l'agent sur le site, puis validé par la direction dans l'admin.
   - Chaque requête est filtrée sur l'agent connecté : il ne voit que ses propres données.
   - Fichiers (fiches de paie, documents, photos) stockés hors du site, servis uniquement ici.
   Aucune donnée dans le code : tout est dans le stockage privé (dossier_donnees()).
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

entetes_securite();
header('Cache-Control: no-store');

const EQ_JOURS = 30;          // durée d'une session
const EQ_APPAREIL = 180;      // durée d'un appareil mémorisé
const EQ_METIERS = ['securite' => 'Agent de sécurité', 'ssiap' => 'Agent SSIAP', 'chauffeur' => 'Chauffeur VTC'];
const EQ_ABSENCES = ['conges' => 'Congés payés', 'maladie' => 'Arrêt maladie', 'absence' => 'Absence', 'indispo' => 'Indisponibilité'];
const EQ_INCIDENTS = ['intrusion' => 'Intrusion / tentative', 'vol' => 'Vol / dégradation', 'agression' => 'Agression / altercation', 'incendie' => 'Incendie / alarme', 'secours' => 'Secours à personne', 'technique' => 'Problème technique', 'ronde' => 'Ronde / contrôle', 'autre' => 'Autre'];
const EQ_DOCS_AGENT = ['carte_pro', 'diplome_aps', 'certif', 'attestation', 'carte_vtc', 'permis', 'identite', 'rib', 'secu', 'justificatif', 'autre'];

// ----- Session équipe -----
$dirSessions = dossier_donnees() . '/sessions-equipe';
if (!is_dir($dirSessions)) @mkdir($dirSessions, 0700, true);
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.gc_maxlifetime', (string)(EQ_JOURS * 86400));
session_save_path($dirSessions);
session_name('BDA_EQUIPE');
session_set_cookie_params(['lifetime' => EQ_JOURS * 86400, 'path' => '/', 'secure' => est_https(), 'httponly' => true, 'samesite' => 'Lax']);
session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));

$action = (string)($_GET['a'] ?? '');
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$lectures = ['session', 'identifiant.libre', 'reset.verifier', 'accueil', 'planning', 'fiches', 'fiche', 'documents', 'document', 'absences', 'main_courante', 'photo', 'profil', 'courses', 'appareils'];
$ecritures = ['inscription', 'connexion', 'deconnexion', 'oubli', 'reset', 'motdepasse', 'absence.demander', 'absence.annuler', 'incident.signaler', 'profil.enregistrer', 'document.envoyer', 'document.supprimer', 'pointer.debut', 'pointer.fin', 'appareil.retirer'];
if (!in_array($action, array_merge($lectures, $ecritures), true)) echec('Action inconnue.', 404);
if (in_array($action, $lectures, true) !== ($methode === 'GET')) echec('Méthode non autorisée.', 405);
if ($methode === 'POST') {
  if (!origine_ok()) echec('Origine refusée.', 403);
  if (!hash_equals((string)$_SESSION['csrf'], (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) echec('Session expirée : rechargez la page.', 419);
}

/* ---------- Compte connecté ---------- */
function eq_lire_compte(int $id): ?array
{
  $st = db()->prepare("SELECT ce.*, a.nom AS agent_nom, a.poste, a.carte, a.validite, a.profil, a.tel AS agent_tel FROM comptes_equipe ce JOIN agents a ON a.id = ce.agent_id WHERE ce.id = ? AND ce.statut = 'actif' AND a.actif = 1");
  $st->execute([$id]);
  return $st->fetch() ?: null;
}
function eq_compte(): ?array
{
  $id = (int)($_SESSION['eq'] ?? 0);
  if ($id) {
    $c = eq_lire_compte($id);
    if ($c) return $c;
    unset($_SESSION['eq']);
  }
  // Appareil mémorisé : reconnexion automatique sans mot de passe
  $jeton = (string)($_COOKIE['BDA_EQUIPE_APP'] ?? '');
  if (!preg_match('/^[a-f0-9]{64}$/', $jeton)) return null;
  $st = db()->prepare('SELECT * FROM equipe_appareils WHERE jeton = ?');
  $st->execute([hash('sha256', $jeton)]);
  $app = $st->fetch();
  if (!$app || $app['vu'] < date('Y-m-d H:i:s', time() - EQ_APPAREIL * 86400)) { eq_oublier_appareil(); return null; }
  $c = eq_lire_compte((int)$app['compte_id']);
  if (!$c) return null;
  session_regenerate_id(true);
  $_SESSION['eq'] = (int)$c['id'];
  $_SESSION['app'] = (int)$app['id'];
  db()->prepare('UPDATE equipe_appareils SET vu = ? WHERE id = ?')->execute([maintenant(), $app['id']]);
  db()->prepare('UPDATE comptes_equipe SET derniere = ? WHERE id = ?')->execute([maintenant(), $c['id']]);
  return $c;
}
function eq_exiger(): array
{
  $c = eq_compte();
  if (!$c) echec('Connexion requise.', 401);
  return $c;
}
function eq_cookie_appareil(string $valeur, int $expire): void
{
  setcookie('BDA_EQUIPE_APP', $valeur, ['expires' => $expire, 'path' => '/api/', 'secure' => est_https(), 'httponly' => true, 'samesite' => 'Strict']);
}
function eq_oublier_appareil(): void
{
  $jeton = (string)($_COOKIE['BDA_EQUIPE_APP'] ?? '');
  if (preg_match('/^[a-f0-9]{64}$/', $jeton)) db()->prepare('DELETE FROM equipe_appareils WHERE jeton = ?')->execute([hash('sha256', $jeton)]);
  eq_cookie_appareil('', time() - 3600);
}
function eq_ouvrir(array $c, bool $memoriser): void
{
  session_regenerate_id(true);
  $_SESSION['eq'] = (int)$c['id'];
  $_SESSION['csrf'] = bin2hex(random_bytes(32));
  unset($_SESSION['app']);
  db()->prepare("UPDATE comptes_equipe SET derniere = ?, echecs = 0, bloque_jusqu = '' WHERE id = ?")->execute([maintenant(), $c['id']]);
  if ($memoriser) {
    $jeton = bin2hex(random_bytes(32));
    db()->prepare('INSERT INTO equipe_appareils (compte_id, jeton, appareil, cree, vu) VALUES (?, ?, ?, ?, ?)')->execute([$c['id'], hash('sha256', $jeton), appareil(), maintenant(), maintenant()]);
    $_SESSION['app'] = (int)db()->lastInsertId();
    eq_cookie_appareil($jeton, time() + EQ_APPAREIL * 86400);
  }
}
function eq_etat(): array
{
  $c = eq_compte();
  return ['ok' => true, 'connecte' => (bool)$c, 'csrf' => (string)$_SESSION['csrf'], 'prenom' => $c ? $c['prenom'] : '', 'nom' => $c ? $c['nom'] : '', 'metier' => $c ? $c['metier'] : ''];
}
function eq_mdp_valide(string $mdp): void
{
  if (mb_strlen($mdp) < 8) echec('Le mot de passe doit contenir au moins 8 caractères.');
  if (mb_strlen($mdp) > 200) echec('Mot de passe trop long.');
  if (!preg_match('/\pL/u', $mdp) || !preg_match('/\d/', $mdp)) echec('Le mot de passe doit contenir au moins une lettre et un chiffre.');
}
function eq_dossier(string $sous): string
{
  $dir = dossier_donnees() . '/equipe/' . $sous;
  if (!is_dir($dir) && !@mkdir($dir, 0700, true)) echec('Espace de stockage indisponible.', 500);
  return $dir;
}
// Fichier reçu (multipart) : contrôle d'erreur, taille et vrai format
function eq_fichier_recu(array $f, int $max, array $types): string
{
  if (($f['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file((string)$f['tmp_name'])) {
    $code = (int)($f['error'] ?? 0);
    echec(in_array($code, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 'Fichier trop lourd.' : "Le fichier n'a pas été reçu.", 400);
  }
  if ((int)$f['size'] > $max) echec('Fichier trop lourd (' . intdiv($max, 1048576) . ' Mo maximum).');
  $mime = type_fichier((string)$f['tmp_name']);
  if (!in_array($mime, $types, true)) echec(in_array('application/pdf', $types, true) ? 'Format non accepté : PDF, JPG, PNG ou WEBP.' : 'Seules les photos (JPG, PNG, WEBP) sont acceptées.');
  return $mime;
}
// Envoi d'un fichier privé (jamais d'adresse publique)
function eq_servir(string $chemin, string $mime, string $nom, bool $telecharger): void
{
  if (!is_file($chemin)) echec('Fichier introuvable.', 404);
  header('Content-Type: ' . $mime);
  header('Content-Length: ' . filesize($chemin));
  header('Content-Disposition: ' . ($telecharger ? 'attachment' : 'inline') . '; filename="' . preg_replace('/[^\w .()-]+/u', '_', $nom) . '"');
  header('Cache-Control: private, no-store');
  header('X-Robots-Tag: noindex');
  header("Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  readfile($chemin);
  exit;
}
function eq_date(string $s): string
{
  return preg_match('/^\d{4}-\d{2}-\d{2}$/', $s) && strtotime($s) ? $s : '';
}
function eq_planning_mois(array $c, string $mois): array
{
  $st = db()->prepare('SELECT data FROM plannings WHERE mois = ?');
  $st->execute([$mois]);
  $p = json_decode((string)$st->fetchColumn(), true);
  if (!is_array($p)) return ['jours' => (object)[], 'client' => '', 'site' => '', 'mission' => ''];
  $l = ligne_planning($p, ['id' => $c['agent_id'], 'nom' => $c['agent_nom']]);
  return ['jours' => (object)($l['jours'] ?? []), 'client' => trim((string)($p['client'] ?? '')), 'site' => trim((string)($p['site'] ?? '')), 'mission' => trim((string)($p['mission'] ?? ''))];
}
function eq_en_cours(int $agent): ?array
{
  $st = db()->prepare("SELECT id, debut, site FROM pointages WHERE agent_id = ? AND fin = '' ORDER BY debut DESC LIMIT 1");
  $st->execute([$agent]);
  return $st->fetch() ?: null;
}
function eq_minutes(int $agent, string $depuis): int
{
  $st = db()->prepare('SELECT debut, fin FROM pointages WHERE agent_id = ? AND debut >= ?');
  $st->execute([$agent, $depuis]);
  $m = 0;
  foreach ($st as $p) $m += max(0, (int)round((($p['fin'] !== '' ? strtotime($p['fin']) : time()) - strtotime($p['debut'])) / 60));
  return $m;
}
// Courses VTC confiées à ce chauffeur (nom du chauffeur saisi dans l'admin)
function eq_courses(array $c, string $depuis, int $max): array
{
  $st = db()->prepare("SELECT ref, statut, date_course, data FROM reservations WHERE date_course >= ? AND statut IN ('confirmee', 'terminee', 'attente') ORDER BY date_course LIMIT 400");
  $st->execute([$depuis]);
  $cle = nom_simple((string)$c['agent_nom']);
  $out = [];
  foreach ($st as $r) {
    $d = json_decode((string)$r['data'], true) ?: [];
    if (nom_simple((string)($d['chauffeur'] ?? '')) !== $cle || $cle === '') continue;
    // Le chauffeur voit ce qu'il faut pour la course, pas le prix ni l'email du client
    $out[] = ['ref' => $r['ref'], 'statut' => $r['statut'], 'quand' => $r['date_course'], 'mode' => $d['mode'] ?? 'trajet', 'heures' => $d['heures'] ?? 0,
      'depart' => $d['depart']['label'] ?? '', 'arrivee' => $d['arrivee']['label'] ?? '', 'passagers' => $d['passagers'] ?? 1, 'bagages' => $d['bagages'] ?? 0,
      'vehicule' => $d['vehicule'] ?? '', 'vol' => $d['vol'] ?? '', 'pancarte' => !empty($d['pancarte']), 'sieges' => $d['sieges'] ?? 0,
      'client' => $d['nom'] ?? '', 'tel' => $d['tel'] ?? '', 'message' => $d['message'] ?? '', 'note' => $d['note'] ?? ''];
    if (count($out) >= $max) break;
  }
  return $out;
}

try {
  switch ($action) {
    case 'session':
      repondre(eq_etat());

    /* ================= Création de compte ================= */
    case 'identifiant.libre':
      if (!limiter('equipe-id', 60, 600)) echec('Trop de vérifications. Patientez un instant.', 429);
      $id = mb_strtolower(texte($_GET['id'] ?? '', 40));
      if (!preg_match('/^[a-z0-9][a-z0-9._-]{2,29}$/', $id)) repondre(['ok' => true, 'libre' => false, 'raison' => 'format']);
      $st = db()->prepare('SELECT COUNT(*) FROM comptes_equipe WHERE identifiant = ?');
      $st->execute([$id]);
      repondre(['ok' => true, 'libre' => !(int)$st->fetchColumn()]);

    case 'inscription':
      $b = corps();
      if (texte($b['site_web'] ?? '', 10) !== '') repondre(['ok' => true]); // robot
      if (!limiter('equipe-inscription', 5, 3600)) echec('Trop de demandes depuis cet appareil. Réessayez dans une heure.', 429);
      $prenom = texte($b['prenom'] ?? '', 60);
      $nom = texte($b['nom'] ?? '', 60);
      $email = mb_strtolower(texte($b['email'] ?? '', 160));
      $tel = texte($b['tel'] ?? '', 30);
      $metier = array_key_exists((string)($b['metier'] ?? ''), EQ_METIERS) ? (string)$b['metier'] : '';
      $identifiant = mb_strtolower(texte($b['identifiant'] ?? '', 40));
      $mdp = chaine($b['motdepasse'] ?? '');
      if (mb_strlen($prenom) < 2 || mb_strlen($nom) < 2) echec('Indiquez votre prénom et votre nom.');
      if (!filter_var($email, FILTER_VALIDATE_EMAIL)) echec('Adresse email invalide.');
      if (strlen(preg_replace('/\D/', '', $tel)) < 9) echec('Numéro de téléphone invalide.');
      if ($metier === '') echec('Choisissez votre métier.');
      if (!preg_match('/^[a-z0-9][a-z0-9._-]{2,29}$/', $identifiant)) echec('Identifiant : 3 à 30 caractères, lettres sans accent, chiffres, point ou tiret.');
      eq_mdp_valide($mdp);
      if (empty($b['accepte'])) echec('Merci de cocher la case d’accord.');
      $st = db()->prepare('SELECT COUNT(*) FROM comptes_equipe WHERE identifiant = ?');
      $st->execute([$identifiant]);
      if ((int)$st->fetchColumn()) echec('Cet identifiant est déjà pris : choisissez-en un autre.', 409);
      $st = db()->prepare("SELECT statut FROM comptes_equipe WHERE email = ? AND statut IN ('attente', 'actif', 'bloque')");
      $st->execute([$email]);
      $deja = $st->fetchColumn();
      if ($deja) echec($deja === 'attente' ? 'Une demande avec cet email est déjà en attente de validation.' : 'Un compte existe déjà avec cet email. Utilisez « Mot de passe oublié ».', 409);
      db()->prepare('INSERT INTO comptes_equipe (identifiant, email, prenom, nom, tel, metier, hash, statut, cree) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([$identifiant, $email, $prenom, mb_strtoupper($nom), $tel, $metier, password_hash($mdp, PASSWORD_DEFAULT), 'attente', maintenant()]);
      journal('equipe', "Espace équipe : demande d’accès de $prenom " . mb_strtoupper($nom) . ' (' . EQ_METIERS[$metier] . ')');
      envoyer_mail("Espace équipe : demande d'accès de $prenom $nom", "$prenom " . mb_strtoupper($nom) . ' (' . EQ_METIERS[$metier] . ") demande l'accès à l'Espace équipe.\n\nTéléphone : $tel\nEmail : $email\nIdentifiant choisi : $identifiant\n\nValider ou refuser : https://bdasecurite.com/admin/#/equipe", $email);
      repondre(['ok' => true]);

    /* ================= Connexion ================= */
    case 'connexion':
      $b = corps();
      $cle = 'equipe:' . empreinte_client();
      if (tentatives($cle, 900) >= 10) echec('Trop de tentatives. Réessayez dans 15 minutes.', 429);
      $saisi = mb_strtolower(texte($b['identifiant'] ?? '', 160));
      $st = db()->prepare('SELECT * FROM comptes_equipe WHERE identifiant = ? OR (email = ? AND ? LIKE \'%@%\') ORDER BY (statut = \'actif\') DESC LIMIT 1');
      $st->execute([$saisi, $saisi, $saisi]);
      $c = $st->fetch();
      if ($c && $c['bloque_jusqu'] > maintenant()) echec('Trop d’essais sur ce compte. Réessayez dans 15 minutes ou utilisez « Mot de passe oublié ».', 429);
      $hash = $c ? (string)$c['hash'] : password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT); // même durée si l'identifiant n'existe pas
      if (!password_verify(chaine($b['motdepasse'] ?? ''), $hash) || !$c) {
        noter_tentative($cle);
        if ($c) {
          $echecs = (int)$c['echecs'] + 1;
          db()->prepare('UPDATE comptes_equipe SET echecs = ?, bloque_jusqu = ? WHERE id = ?')->execute([$echecs >= 6 ? 0 : $echecs, $echecs >= 6 ? date('Y-m-d H:i:s', time() + 900) : '', $c['id']]);
        }
        usleep(600000);
        echec('Identifiant ou mot de passe incorrect.', 401);
      }
      if ($c['statut'] === 'attente' || ($c['statut'] === 'actif' && !(int)$c['agent_id'])) echec('Votre compte est en attente de validation par la direction. Vous recevrez un email dès qu’il sera activé.', 403);
      if ($c['statut'] === 'refuse') echec('Votre demande n’a pas été acceptée. Contactez la direction au 06 11 67 86 25.', 403);
      if ($c['statut'] !== 'actif' || !eq_lire_compte((int)$c['id'])) echec('Accès suspendu. Contactez la direction au 06 11 67 86 25.', 403);
      if (password_needs_rehash($c['hash'], PASSWORD_DEFAULT)) db()->prepare('UPDATE comptes_equipe SET hash = ? WHERE id = ?')->execute([password_hash(chaine($b['motdepasse']), PASSWORD_DEFAULT), $c['id']]);
      eq_ouvrir($c, !isset($b['memoriser']) || !empty($b['memoriser']));
      journal('acces', "Espace équipe : connexion de {$c['prenom']} {$c['nom']}");
      repondre(eq_etat());

    case 'deconnexion':
      eq_oublier_appareil();
      $_SESSION = [];
      session_regenerate_id(true);
      $_SESSION['csrf'] = bin2hex(random_bytes(32));
      repondre(eq_etat());

    case 'oubli':
      $b = corps();
      if (!limiter('equipe-oubli', 5, 3600)) echec('Trop de demandes. Réessayez dans une heure.', 429);
      $saisi = mb_strtolower(texte($b['identifiant'] ?? '', 160));
      $st = db()->prepare("SELECT * FROM comptes_equipe WHERE (identifiant = ? OR email = ?) AND statut = 'actif' LIMIT 1");
      $st->execute([$saisi, $saisi]);
      $c = $st->fetch();
      if ($c) {
        $jeton = bin2hex(random_bytes(24));
        db()->prepare('UPDATE comptes_equipe SET reset = ?, reset_expire = ? WHERE id = ?')->execute([hash('sha256', $jeton), date('Y-m-d H:i:s', time() + 3600), $c['id']]);
        $hote = preg_replace('/[^a-z0-9.:-]/i', '', (string)($_SERVER['HTTP_HOST'] ?? 'bdasecurite.com'));
        envoyer_mail('Nouveau mot de passe — Espace équipe BDA', "Bonjour {$c['prenom']},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\nhttps://$hote/espace-equipe#reset=$jeton\n\nVotre identifiant : {$c['identifiant']}\n\nSi vous n'avez rien demandé, ignorez ce message.\n\nBDA Security Group", '', (string)$c['email']);
        journal('securite', "Espace équipe : lien de nouveau mot de passe envoyé à {$c['prenom']} {$c['nom']}");
      }
      repondre(['ok' => true]); // même réponse que le compte existe ou non

    case 'reset.verifier':
    case 'reset':
      $b = $action === 'reset' ? corps() : [];
      $jeton = $action === 'reset' ? chaine($b['jeton'] ?? '') : (string)($_GET['jeton'] ?? '');
      $cle = 'equipe-reset:' . empreinte_client();
      if (tentatives($cle, 3600) >= 10) echec('Trop de tentatives. Réessayez plus tard.', 429);
      $c = null;
      if (preg_match('/^[a-f0-9]{48}$/', $jeton)) {
        $st = db()->prepare("SELECT * FROM comptes_equipe WHERE reset = ? AND statut = 'actif'");
        $st->execute([hash('sha256', $jeton)]);
        $c = $st->fetch() ?: null;
        if ($c && $c['reset_expire'] < maintenant()) $c = null;
      }
      if (!$c) { noter_tentative($cle); echec('Ce lien n’est plus valable. Refaites « Mot de passe oublié ».', 404); }
      if ($action === 'reset.verifier') repondre(['ok' => true, 'prenom' => $c['prenom'], 'identifiant' => $c['identifiant']]);
      $mdp = chaine($b['motdepasse'] ?? '');
      eq_mdp_valide($mdp);
      db()->prepare("UPDATE comptes_equipe SET hash = ?, reset = '', reset_expire = '', echecs = 0, bloque_jusqu = '' WHERE id = ?")->execute([password_hash($mdp, PASSWORD_DEFAULT), $c['id']]);
      db()->prepare('DELETE FROM equipe_appareils WHERE compte_id = ?')->execute([$c['id']]); // les autres appareils sont déconnectés
      eq_ouvrir($c, true);
      journal('securite', "Espace équipe : nouveau mot de passe pour {$c['prenom']} {$c['nom']}");
      repondre(eq_etat());

    case 'motdepasse':
      $c = eq_exiger();
      $b = corps();
      if (!password_verify(chaine($b['actuel'] ?? ''), (string)$c['hash'])) echec('Mot de passe actuel incorrect.', 403);
      $mdp = chaine($b['nouveau'] ?? '');
      eq_mdp_valide($mdp);
      db()->prepare('UPDATE comptes_equipe SET hash = ? WHERE id = ?')->execute([password_hash($mdp, PASSWORD_DEFAULT), $c['id']]);
      db()->prepare('DELETE FROM equipe_appareils WHERE compte_id = ? AND id <> ?')->execute([$c['id'], (int)($_SESSION['app'] ?? 0)]);
      journal('securite', "Espace équipe : mot de passe changé par {$c['prenom']} {$c['nom']}");
      repondre(['ok' => true]);

    /* ================= Accueil ================= */
    case 'accueil':
      $c = eq_exiger();
      $aid = (int)$c['agent_id'];
      $auj = date('Y-m-d');
      // Les 7 prochains jours du planning (peut chevaucher deux mois)
      $prochains = [];
      $cache = [];
      for ($i = 0; $i < 7; $i++) {
        $j = date('Y-m-d', strtotime("+$i day"));
        $m = substr($j, 0, 7);
        $cache[$m] ??= eq_planning_mois($c, $m);
        $prochains[] = ['jour' => $j, 'creneau' => (string)(((array)$cache[$m]['jours'])[$j] ?? ''), 'site' => $cache[$m]['client']];
      }
      $q = function (string $sql, array $p) { $st = db()->prepare($sql); $st->execute($p); return (int)$st->fetchColumn(); };
      $cons = db()->prepare("SELECT id, texte, cree, agent_id FROM consignes WHERE (agent_id = 0 OR agent_id = ?) AND cree >= ? ORDER BY id DESC LIMIT 5");
      $cons->execute([$aid, date('Y-m-d H:i:s', time() - 45 * 86400)]);
      $alertes = [];
      if ($c['validite'] !== '') {
        $reste = (int)floor((strtotime($c['validite']) - strtotime($auj)) / 86400);
        if ($reste < 0) $alertes[] = ['niveau' => 'rouge', 'texte' => 'Votre carte professionnelle est expirée depuis le ' . date('d/m/Y', strtotime($c['validite'])) . '.'];
        elseif ($reste <= 90) $alertes[] = ['niveau' => 'or', 'texte' => "Votre carte professionnelle expire dans $reste jours : pensez au renouvellement."];
      }
      repondre(['ok' => true,
        'moi' => ['prenom' => $c['prenom'], 'nom' => $c['nom'], 'metier' => $c['metier'], 'metierLibelle' => EQ_METIERS[$c['metier']] ?? '', 'poste' => $c['poste'], 'identifiant' => $c['identifiant']],
        'prochains' => $prochains,
        'enCours' => eq_en_cours($aid),
        'semaine' => eq_minutes($aid, date('Y-m-d 00:00:00', strtotime('monday this week'))),
        'mois' => eq_minutes($aid, date('Y-m-01 00:00:00')),
        'fichesNonVues' => $q("SELECT COUNT(*) FROM equipe_paies WHERE agent_id = ? AND vu = ''", [$aid]),
        'absencesAttente' => $q("SELECT COUNT(*) FROM absences WHERE agent_id = ? AND statut = 'attente'", [$aid]),
        'incidentsOuverts' => $q("SELECT COUNT(*) FROM main_courante WHERE agent_id = ? AND statut <> 'traite'", [$aid]),
        'consignes' => $cons->fetchAll(),
        'alertes' => $alertes,
        'courses' => $c['metier'] === 'chauffeur' ? eq_courses($c, date('Y-m-d 00:00:00'), 3) : [],
        'serveur' => maintenant()]);

    /* ================= Planning ================= */
    case 'planning':
      $c = eq_exiger();
      $mois = preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', (string)($_GET['mois'] ?? '')) ? (string)$_GET['mois'] : date('Y-m');
      $p = eq_planning_mois($c, $mois);
      $st = db()->prepare("SELECT debut, fin, site FROM pointages WHERE agent_id = ? AND substr(debut, 1, 7) = ? ORDER BY debut");
      $st->execute([(int)$c['agent_id'], $mois]);
      $abs = db()->prepare("SELECT type, du, au, statut FROM absences WHERE agent_id = ? AND statut IN ('attente', 'acceptee') AND du <= ? AND au >= ?");
      $abs->execute([(int)$c['agent_id'], $mois . '-31', $mois . '-01']);
      repondre(['ok' => true, 'mois' => $mois] + $p + ['pointages' => $st->fetchAll(), 'absences' => $abs->fetchAll()]);

    /* ================= Fiches de paie (PDF privés) ================= */
    case 'fiches':
      $c = eq_exiger();
      $st = db()->prepare('SELECT id, mois, titre, taille, ajoute, vu FROM equipe_paies WHERE agent_id = ? ORDER BY mois DESC, id DESC');
      $st->execute([(int)$c['agent_id']]);
      repondre(['ok' => true, 'fiches' => $st->fetchAll()]);

    case 'fiche':
      $c = eq_exiger();
      $st = db()->prepare('SELECT * FROM equipe_paies WHERE id = ? AND agent_id = ?');
      $st->execute([(int)($_GET['id'] ?? 0), (int)$c['agent_id']]);
      $f = $st->fetch();
      if (!$f) echec('Fiche introuvable.', 404);
      if ($f['vu'] === '') {
        db()->prepare('UPDATE equipe_paies SET vu = ? WHERE id = ?')->execute([maintenant(), $f['id']]);
        journal('document', "Fiche de paie « {$f['titre']} » téléchargée par {$c['prenom']} {$c['nom']}");
      }
      eq_servir(eq_dossier('paies') . '/' . basename((string)$f['fichier']), 'application/pdf', (string)$f['nom'], empty($_GET['voir']));

    /* ================= Documents ================= */
    case 'documents':
      $c = eq_exiger();
      $st = db()->prepare("SELECT id, type, nom, mime, taille, ajoute, source FROM agent_docs WHERE agent_id = ? AND (visible = 1 OR source = 'agent') ORDER BY ajoute DESC");
      $st->execute([(int)$c['agent_id']]);
      repondre(['ok' => true, 'documents' => $st->fetchAll(), 'carte' => $c['carte'], 'validite' => $c['validite'], 'limite' => min(limite_envoi(), 10 * 1048576)]);

    case 'document':
      $c = eq_exiger();
      $st = db()->prepare("SELECT * FROM agent_docs WHERE id = ? AND agent_id = ? AND (visible = 1 OR source = 'agent')");
      $st->execute([(int)($_GET['id'] ?? 0), (int)$c['agent_id']]);
      $d = $st->fetch();
      if (!$d) echec('Document introuvable.', 404);
      eq_servir(dossier_docs() . '/' . basename((string)$d['fichier']), (string)$d['mime'], (string)$d['nom'], empty($_GET['voir']));

    case 'document.envoyer':
      $c = eq_exiger();
      if (!limiter('equipe-doc', 30, 3600)) echec('Trop d’envois. Réessayez plus tard.', 429);
      $f = $_FILES['fichier'] ?? null;
      if (!is_array($f)) echec("Le fichier n'a pas été reçu.");
      $mime = eq_fichier_recu($f, 10 * 1048576, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
      $type = in_array($_POST['type'] ?? '', EQ_DOCS_AGENT, true) ? (string)$_POST['type'] : 'autre';
      $nom = texte($_POST['nom'] ?? '', 120) ?: texte($f['name'] ?? 'document', 120);
      $fichier = bin2hex(random_bytes(16)) . '.bin';
      if (!move_uploaded_file((string)$f['tmp_name'], dossier_docs() . '/' . $fichier)) echec('Enregistrement du fichier impossible.', 500);
      db()->prepare("INSERT INTO agent_docs (agent_id, type, nom, fichier, mime, taille, ajoute, visible, source) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'agent')")
        ->execute([(int)$c['agent_id'], $type, $nom, $fichier, $mime, (int)$f['size'], maintenant()]);
      journal('equipe', "Espace équipe : document « $nom » déposé par {$c['prenom']} {$c['nom']}");
      repondre(['ok' => true, 'id' => (int)db()->lastInsertId()]);

    case 'document.supprimer':
      $c = eq_exiger();
      // L'agent ne peut retirer que ce qu'il a lui-même déposé, dans les 24 h
      $st = db()->prepare("SELECT * FROM agent_docs WHERE id = ? AND agent_id = ? AND source = 'agent'");
      $st->execute([(int)(corps()['id'] ?? 0), (int)$c['agent_id']]);
      $d = $st->fetch();
      if (!$d) echec('Document introuvable.', 404);
      if ($d['ajoute'] < date('Y-m-d H:i:s', time() - 86400)) echec('Ce document a été transmis à la direction : demandez-lui de le retirer.', 403);
      $lie = db()->prepare('SELECT COUNT(*) FROM absences WHERE justificatif = ?');
      $lie->execute([$d['id']]);
      if ((int)$lie->fetchColumn()) echec('Ce justificatif est joint à une demande d’absence.', 409);
      @unlink(dossier_docs() . '/' . basename((string)$d['fichier']));
      db()->prepare('DELETE FROM agent_docs WHERE id = ?')->execute([$d['id']]);
      repondre(['ok' => true]);

    /* ================= Congés et absences ================= */
    case 'absences':
      $c = eq_exiger();
      $st = db()->prepare('SELECT id, type, du, au, motif, justificatif, statut, reponse, cree, traite FROM absences WHERE agent_id = ? ORDER BY du DESC, id DESC LIMIT 200');
      $st->execute([(int)$c['agent_id']]);
      repondre(['ok' => true, 'absences' => $st->fetchAll()]);

    case 'absence.demander':
      $c = eq_exiger();
      if (!limiter('equipe-absence', 20, 3600)) echec('Trop de demandes. Réessayez plus tard.', 429);
      $b = !empty($_POST) ? $_POST : corps();
      $type = array_key_exists((string)($b['type'] ?? ''), EQ_ABSENCES) ? (string)$b['type'] : '';
      $du = eq_date((string)($b['du'] ?? ''));
      $au = eq_date((string)($b['au'] ?? '')) ?: $du;
      if ($type === '') echec('Choisissez le type de demande.');
      if ($du === '') echec('Indiquez la date de début.');
      if ($au < $du) echec('La date de fin est avant la date de début.');
      if ((strtotime($au) - strtotime($du)) / 86400 > 92) echec('Une demande ne peut pas dépasser 3 mois.');
      if ($type !== 'maladie' && $du < date('Y-m-d', time() - 7 * 86400)) echec('Cette date est déjà passée.');
      $chev = db()->prepare("SELECT COUNT(*) FROM absences WHERE agent_id = ? AND statut IN ('attente', 'acceptee') AND du <= ? AND au >= ?");
      $chev->execute([(int)$c['agent_id'], $au, $du]);
      if ((int)$chev->fetchColumn()) echec('Vous avez déjà une demande sur ces dates.', 409);
      $justif = 0;
      if (!empty($_FILES['justificatif']) && ($_FILES['justificatif']['error'] ?? 4) !== UPLOAD_ERR_NO_FILE) {
        $f = $_FILES['justificatif'];
        $mime = eq_fichier_recu($f, 10 * 1048576, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
        $fichier = bin2hex(random_bytes(16)) . '.bin';
        if (!move_uploaded_file((string)$f['tmp_name'], dossier_docs() . '/' . $fichier)) echec('Enregistrement du justificatif impossible.', 500);
        $nomJ = 'Justificatif ' . EQ_ABSENCES[$type] . ' du ' . date('d-m-Y', strtotime($du));
        db()->prepare("INSERT INTO agent_docs (agent_id, type, nom, fichier, mime, taille, ajoute, visible, source) VALUES (?, 'justificatif', ?, ?, ?, ?, ?, 1, 'agent')")
          ->execute([(int)$c['agent_id'], $nomJ, $fichier, $mime, (int)$f['size'], maintenant()]);
        $justif = (int)db()->lastInsertId();
      }
      db()->prepare('INSERT INTO absences (agent_id, type, du, au, motif, justificatif, cree) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([(int)$c['agent_id'], $type, $du, $au, texte($b['motif'] ?? '', 600), $justif, maintenant()]);
      $periode = $du === $au ? 'le ' . date('d/m/Y', strtotime($du)) : 'du ' . date('d/m/Y', strtotime($du)) . ' au ' . date('d/m/Y', strtotime($au));
      journal('equipe', "Espace équipe : {$c['prenom']} {$c['nom']} demande « " . EQ_ABSENCES[$type] . " » $periode");
      envoyer_mail("Demande d'absence — {$c['prenom']} {$c['nom']}", "{$c['prenom']} {$c['nom']} demande : " . EQ_ABSENCES[$type] . " $periode." . (texte($b['motif'] ?? '', 600) !== '' ? "\nMotif : " . texte($b['motif'], 600) : '') . ($justif ? "\nUn justificatif est joint." : '') . "\n\nRépondre : https://bdasecurite.com/admin/#/equipe", (string)$c['email']);
      repondre(['ok' => true]);

    case 'absence.annuler':
      $c = eq_exiger();
      $st = db()->prepare("UPDATE absences SET statut = 'annulee', traite = ? WHERE id = ? AND agent_id = ? AND statut = 'attente'");
      $st->execute([maintenant(), (int)(corps()['id'] ?? 0), (int)$c['agent_id']]);
      if (!$st->rowCount()) echec('Cette demande a déjà été traitée : contactez la direction.', 409);
      repondre(['ok' => true]);

    /* ================= Main courante ================= */
    case 'main_courante':
      $c = eq_exiger();
      $st = db()->prepare('SELECT id, quand, site, categorie, gravite, texte, photos, statut, commentaire, cree FROM main_courante WHERE agent_id = ? ORDER BY quand DESC, id DESC LIMIT 200');
      $st->execute([(int)$c['agent_id']]);
      $l = $st->fetchAll();
      foreach ($l as &$m) $m['photos'] = count(json_decode((string)$m['photos'], true) ?: []);
      $pl = planning_du_jour((string)$c['agent_nom'], date('Y-m-d'));
      $ec = eq_en_cours((int)$c['agent_id']);
      repondre(['ok' => true, 'entrees' => $l, 'siteDuJour' => $ec['site'] ?? $pl['site']]);

    case 'incident.signaler':
      $c = eq_exiger();
      if (!limiter('equipe-mc', 40, 3600)) echec('Trop de signalements. Réessayez plus tard.', 429);
      $b = $_POST;
      $cat = array_key_exists((string)($b['categorie'] ?? ''), EQ_INCIDENTS) ? (string)$b['categorie'] : '';
      $grav = in_array($b['gravite'] ?? '', ['info', 'normale', 'urgente'], true) ? (string)$b['gravite'] : 'normale';
      $texteMc = texte($b['texte'] ?? '', 5000);
      $quand = preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', (string)($b['quand'] ?? '')) ? str_replace('T', ' ', (string)$b['quand']) . ':00' : maintenant();
      if ($quand > date('Y-m-d H:i:s', time() + 600)) $quand = maintenant();
      if ($cat === '') echec('Choisissez le type d’événement.');
      if (mb_strlen($texteMc) < 10) echec('Décrivez ce qui s’est passé (10 caractères minimum).');
      $photos = [];
      $liste = $_FILES['photos'] ?? null;
      if (is_array($liste) && is_array($liste['name'] ?? null)) {
        $n = count($liste['name']);
        if ($n > 4) echec('4 photos maximum.');
        for ($i = 0; $i < $n; $i++) {
          if (($liste['error'][$i] ?? 4) === UPLOAD_ERR_NO_FILE) continue;
          $f = ['name' => $liste['name'][$i], 'tmp_name' => $liste['tmp_name'][$i], 'error' => $liste['error'][$i], 'size' => $liste['size'][$i]];
          $mime = eq_fichier_recu($f, 8 * 1048576, ['image/jpeg', 'image/png', 'image/webp']);
          $fichier = bin2hex(random_bytes(16)) . '.bin';
          if (!move_uploaded_file((string)$f['tmp_name'], eq_dossier('main-courante') . '/' . $fichier)) echec('Enregistrement de la photo impossible.', 500);
          $photos[] = ['f' => $fichier, 'm' => $mime];
        }
      }
      $site = texte($b['site'] ?? '', 120);
      db()->prepare('INSERT INTO main_courante (agent_id, quand, site, categorie, gravite, texte, photos, cree) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([(int)$c['agent_id'], $quand, $site, $cat, $grav, $texteMc, json_encode($photos), maintenant()]);
      journal($grav === 'urgente' ? 'alerte' : 'equipe', "Main courante ($grav) : " . EQ_INCIDENTS[$cat] . " signalé par {$c['prenom']} {$c['nom']}" . ($site !== '' ? " à $site" : ''));
      envoyer_mail(($grav === 'urgente' ? 'URGENT — ' : '') . 'Main courante : ' . EQ_INCIDENTS[$cat] . " ({$c['prenom']} {$c['nom']})",
        "Événement signalé par {$c['prenom']} {$c['nom']} (" . ($c['agent_tel'] ?: $c['tel']) . ")\n\nQuand : " . date('d/m/Y à H:i', strtotime($quand)) . "\nSite : " . ($site ?: 'non précisé') . "\nType : " . EQ_INCIDENTS[$cat] . "\nGravité : $grav\n\n$texteMc\n\n" . (count($photos) ? count($photos) . " photo(s) jointe(s).\n\n" : '') . 'Voir : https://bdasecurite.com/admin/#/equipe/main-courante', (string)$c['email']);
      repondre(['ok' => true, 'id' => (int)db()->lastInsertId()]);

    case 'photo':
      $c = eq_exiger();
      $st = db()->prepare('SELECT photos FROM main_courante WHERE id = ? AND agent_id = ?');
      $st->execute([(int)($_GET['id'] ?? 0), (int)$c['agent_id']]);
      $ph = json_decode((string)$st->fetchColumn(), true) ?: [];
      $p = $ph[(int)($_GET['n'] ?? 0)] ?? null;
      if (!$p) echec('Photo introuvable.', 404);
      eq_servir(eq_dossier('main-courante') . '/' . basename((string)$p['f']), (string)$p['m'], 'photo.' . substr((string)$p['m'], 6), false);

    /* ================= Profil et disponibilités ================= */
    case 'profil':
      $c = eq_exiger();
      $st = db()->prepare('SELECT id, appareil, cree, vu FROM equipe_appareils WHERE compte_id = ? ORDER BY vu DESC');
      $st->execute([$c['id']]);
      $apps = $st->fetchAll();
      foreach ($apps as &$a) $a['actuel'] = (int)$a['id'] === (int)($_SESSION['app'] ?? 0);
      repondre(['ok' => true, 'compte' => ['prenom' => $c['prenom'], 'nom' => $c['nom'], 'email' => $c['email'], 'tel' => $c['tel'], 'identifiant' => $c['identifiant'], 'metier' => $c['metier'], 'cree' => $c['cree']],
        'agent' => ['poste' => $c['poste'], 'carte' => $c['carte'], 'validite' => $c['validite']],
        'profil' => json_decode((string)$c['profil'], true) ?: (object)[], 'appareils' => $apps]);

    case 'profil.enregistrer':
      $c = eq_exiger();
      $b = corps();
      $email = mb_strtolower(texte($b['email'] ?? '', 160));
      $tel = texte($b['tel'] ?? '', 30);
      if (!filter_var($email, FILTER_VALIDATE_EMAIL)) echec('Adresse email invalide.');
      if (strlen(preg_replace('/\D/', '', $tel)) < 9) echec('Numéro de téléphone invalide.');
      $jours = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
      $dispos = [];
      foreach ($jours as $j) {
        $v = (array)($b['dispos'][$j] ?? []);
        $dispos[$j] = array_values(array_intersect(['jour', 'nuit'], array_map('strval', $v)));
      }
      $profil = [
        'adresse' => texte($b['adresse'] ?? '', 200), 'ville' => texte($b['ville'] ?? '', 80),
        'urgenceNom' => texte($b['urgenceNom'] ?? '', 80), 'urgenceTel' => texte($b['urgenceTel'] ?? '', 30),
        'dispos' => $dispos, 'zone' => texte($b['zone'] ?? '', 120), 'permis' => !empty($b['permis']), 'vehicule' => !empty($b['vehicule']),
        'competences' => array_slice(array_values(array_filter(array_map(fn($x) => texte($x, 40), (array)($b['competences'] ?? [])))), 0, 12),
        'note' => texte($b['note'] ?? '', 600), 'maj' => maintenant(),
      ];
      db()->prepare('UPDATE comptes_equipe SET email = ?, tel = ? WHERE id = ?')->execute([$email, $tel, $c['id']]);
      db()->prepare('UPDATE agents SET tel = ?, profil = ? WHERE id = ?')->execute([$tel, json_encode($profil, JSON_UNESCAPED_UNICODE), $c['agent_id']]);
      journal('equipe', "Espace équipe : profil mis à jour par {$c['prenom']} {$c['nom']}");
      repondre(['ok' => true]);

    case 'appareils':
      $c = eq_exiger();
      $st = db()->prepare('SELECT id, appareil, cree, vu FROM equipe_appareils WHERE compte_id = ? ORDER BY vu DESC');
      $st->execute([$c['id']]);
      repondre(['ok' => true, 'appareils' => $st->fetchAll()]);

    case 'appareil.retirer':
      $c = eq_exiger();
      db()->prepare('DELETE FROM equipe_appareils WHERE id = ? AND compte_id = ?')->execute([(int)(corps()['id'] ?? 0), $c['id']]);
      repondre(['ok' => true]);

    /* ================= Pointage depuis l'espace ================= */
    case 'pointer.debut':
      $c = eq_exiger();
      $aid = (int)$c['agent_id'];
      if (eq_en_cours($aid)) echec('Votre service est déjà commencé.', 409);
      $der = db()->prepare("SELECT MAX(CASE WHEN fin > debut THEN fin ELSE debut END) FROM pointages WHERE agent_id = ?");
      $der->execute([$aid]);
      if ((string)$der->fetchColumn() > date('Y-m-d H:i:s', time() - 60)) echec('Pointage déjà enregistré il y a moins d’une minute.', 409);
      [$lat, $lng, $prec] = position_gps(corps());
      $p = eq_planning_mois($c, date('Y-m'));
      db()->prepare('INSERT INTO pointages (agent_id, debut, site, lat_debut, lng_debut, prec_debut, cree) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$aid, maintenant(), $p['client'], $lat, $lng, $prec, maintenant()]);
      journal('equipe', "Prise de service : {$c['agent_nom']}" . ($p['client'] !== '' ? " ({$p['client']})" : '') . ' — espace équipe');
      repondre(['ok' => true, 'enCours' => eq_en_cours($aid)]);

    case 'pointer.fin':
      $c = eq_exiger();
      $p = eq_en_cours((int)$c['agent_id']);
      if (!$p) echec('Aucun service en cours.', 409);
      if ($p['debut'] > date('Y-m-d H:i:s', time() - 60)) echec('Service commencé il y a moins d’une minute.', 409);
      [$lat, $lng, $prec] = position_gps(corps());
      $fin = maintenant();
      db()->prepare('UPDATE pointages SET fin = ?, lat_fin = ?, lng_fin = ?, prec_fin = ? WHERE id = ?')->execute([$fin, $lat, $lng, $prec, $p['id']]);
      $min = (int)round((strtotime($fin) - strtotime($p['debut'])) / 60);
      journal('equipe', sprintf('Fin de service : %s (%dh%02d) — espace équipe', $c['agent_nom'], intdiv($min, 60), $min % 60));
      repondre(['ok' => true, 'minutes' => $min]);

    /* ================= Courses VTC (chauffeurs) ================= */
    case 'courses':
      $c = eq_exiger();
      repondre(['ok' => true, 'aVenir' => eq_courses($c, date('Y-m-d 00:00:00'), 60), 'passees' => array_reverse(array_filter(eq_courses($c, date('Y-m-d 00:00:00', time() - 45 * 86400), 200), fn($r) => $r['quand'] < date('Y-m-d 00:00:00')))]);
  }
} catch (Throwable $e) {
  error_log('[BDA equipe] ' . $e->getMessage());
  echec('Erreur du serveur. Réessayez dans un instant.', 500);
}
