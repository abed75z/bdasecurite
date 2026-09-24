<?php
/* =========================================================
   ESPACE ADMIN BDA — connexion et session
   Session limitée au dossier /admin/, cookie sécurisé,
   jeton anti-falsification (CSRF) et limite de tentatives.
   ========================================================= */
declare(strict_types=1);

function demarrer_session(): void
{
  $dir = dossier_donnees() . '/sessions';
  if (!is_dir($dir)) @mkdir($dir, 0700, true);
  ini_set('session.use_strict_mode', '1');
  ini_set('session.use_only_cookies', '1');
  ini_set('session.gc_maxlifetime', '86400');
  ini_set('session.gc_probability', '1');
  ini_set('session.gc_divisor', '50');
  session_save_path($dir);
  session_name('BDA_ADMIN');
  session_set_cookie_params(['lifetime' => 0, 'path' => '/admin/', 'secure' => est_https(), 'httponly' => true, 'samesite' => 'Strict']);
  session_start();

  // Déconnexion automatique : 6 h sans activité ou 24 h au total
  $t = time();
  if (!empty($_SESSION['uid'])) {
    $inactif = $t - (int)($_SESSION['vu'] ?? 0) > 6 * 3600;
    $tropLong = $t - (int)($_SESSION['depuis'] ?? 0) > 24 * 3600;
    if ($inactif || $tropLong) {
      $_SESSION = [];
      session_regenerate_id(true);
    } else {
      $_SESSION['vu'] = $t;
    }
  }
  if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
function connecte(): bool
{
  return !empty($_SESSION['uid']);
}
function nb_utilisateurs(): int
{
  return (int)db()->query('SELECT COUNT(*) FROM utilisateurs')->fetchColumn();
}
function etat_session(): array
{
  return [
    'connecte' => connecte(),
    'activation' => nb_utilisateurs() === 0,
    'utilisateur' => connecte() ? (string)$_SESSION['login'] : '',
    'csrf' => (string)$_SESSION['csrf'],
  ];
}
function ouvrir_session_utilisateur(array $u): void
{
  session_regenerate_id(true);
  $_SESSION['uid'] = (int)$u['id'];
  $_SESSION['login'] = (string)$u['login'];
  $_SESSION['depuis'] = $_SESSION['vu'] = time();
  $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
function code_valide(string $code): bool
{
  $n = strtoupper((string)preg_replace('/[^A-Za-z0-9]/', '', $code));
  return $n !== '' && hash_equals(BDA_CODE_HASH, hash('sha256', $n));
}
function verifier_nouveau_mdp(string $mdp): void
{
  if (mb_strlen($mdp) < 10) echec('Le mot de passe doit contenir au moins 10 caractères.');
  if (mb_strlen($mdp) > 200) echec('Mot de passe trop long.');
}
