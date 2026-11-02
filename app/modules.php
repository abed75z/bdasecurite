<?php
/* =========================================================
   MODULES — fonctions isolées, chacune dans app/modules/<nom>.php
   Un module ne touche pas aux fichiers du cœur : il déclare ce qu'il apporte
   et ce fichier le branche partout (admin, espace équipe, espace client,
   liens publics, cron, compteurs, recherche Ctrl K).

   Un module <nom> définit function module_<nom>(): array et préfixe toutes
   ses fonctions par mod_<nom>_ (deux fonctions du même nom = erreur fatale) :
   [
     'titre'   => 'Messagerie',
     'schema'  => [1 => "CREATE TABLE IF NOT EXISTS m_<nom>_… (…); …", 2 => "…"],  // étapes SQL, jamais modifiées une fois en ligne
     'admin'   => ['verbe' => ['methode' => 'GET'|'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_<nom>_verbe']],
     'equipe'  => ['verbe' => ['methode' => …, 'fn' => …]],   // l'action appelle elle-même eq_exiger()
     'client'  => ['verbe' => ['methode' => …, 'fn' => …]],   // l'action appelle elle-même exiger_compte()
     'public'  => ['verbe' => ['methode' => …, 'fn' => …]],   // liens publics à jeton : /api/module.php?m=<nom>&a=<verbe>
     'cron'      => 'mod_<nom>_cron',        // appelée toutes les 30 min (cron-job.org), courte, avec sa propre fenêtre horaire
     'compteurs' => 'mod_<nom>_compteurs',   // ['cle' => n] : badges du menu et de la cloche
     'recherche' => 'mod_<nom>_recherche',   // [['titre', 'sous', 'href', 'ic']] : palette Ctrl K
   ]
   Actions appelées : « mod.<nom>.<verbe> » (ex. api('mod.mails.envoyer', {…})).
   Une action répond avec repondre() ou echec() (qui font exit). Une RuntimeException
   est montrée telle quelle à l'utilisateur ; toute autre erreur devient « Erreur du serveur ».
   Tables d'un module : préfixe m_<nom>_ ; jamais d'ALTER sur les tables du cœur.
   ========================================================= */
declare(strict_types=1);

const MODULES_DOSSIER = __DIR__ . '/modules';
const MODULES_ESPACES = ['admin', 'equipe', 'client', 'public'];

// Tous les modules installés (chargés une seule fois par requête), schéma à jour
function modules(): array
{
  static $liste = null;
  if ($liste !== null) return $liste;
  $liste = [];
  foreach (glob(MODULES_DOSSIER . '/*.php') ?: [] as $fichier) {
    $nom = basename($fichier, '.php');
    if (!preg_match('/^[a-z][a-z0-9_]{1,30}$/', $nom)) continue;
    try {
      require_once $fichier;
      $fn = 'module_' . $nom;
      if (!function_exists($fn)) continue;
      $def = $fn();
      if (is_array($def)) $liste[$nom] = $def + ['nom' => $nom, 'titre' => $nom];
    } catch (Throwable $e) {
      error_log("[BDA module $nom] chargement : " . $e->getMessage());
    }
  }
  modules_migrer($liste);
  return $liste;
}
function module_existe(string $nom): bool
{
  return isset(modules()[$nom]);
}

/* ---------- Schéma : étapes SQL de chaque module, appliquées une fois, sous verrou ---------- */
function modules_migrer(array &$liste): void
{
  if (!$liste) return;
  $db = db();
  $versions = [];
  foreach ($db->query('SELECT module, version FROM modules_schema') as $r) $versions[$r['module']] = (int)$r['version'];
  foreach ($liste as $nom => $def) {
    $etapes = is_array($def['schema'] ?? null) ? $def['schema'] : [];
    if (!$etapes) continue;
    ksort($etapes);
    $cible = (int)max(array_keys($etapes));
    if (($versions[$nom] ?? 0) >= $cible) continue;
    try {
      $db->exec('BEGIN IMMEDIATE');
      $st = $db->prepare('SELECT version FROM modules_schema WHERE module = ?');
      $st->execute([$nom]);
      $v = (int)$st->fetchColumn(); // relu sous verrou : une autre requête a pu migrer entre-temps
      foreach ($etapes as $n => $sql) {
        if ((int)$n <= $v) continue;
        $db->exec((string)$sql);
        $v = (int)$n;
      }
      $db->prepare('INSERT INTO modules_schema (module, version, maj) VALUES (?, ?, ?) ON CONFLICT(module) DO UPDATE SET version = excluded.version, maj = excluded.maj')
        ->execute([$nom, $v, maintenant()]);
      $db->exec('COMMIT');
    } catch (Throwable $e) {
      try { $db->exec('ROLLBACK'); } catch (Throwable $e2) { /* rien à annuler */ }
      error_log("[BDA module $nom] migration : " . $e->getMessage());
      unset($liste[$nom]); // module mis de côté plutôt que de faire tomber l'admin
    }
  }
}

/* ---------- Actions ---------- */
function modules_actions(string $espace): array
{
  $actions = [];
  foreach (modules() as $nom => $def) {
    foreach ((array)($def[$espace] ?? []) as $verbe => $a) {
      if (!is_array($a) || !preg_match('/^[a-z0-9_.]{1,40}$/', (string)$verbe)) continue;
      $actions["mod.$nom.$verbe"] = $a + ['module' => $nom];
    }
  }
  return $actions;
}
// Exécute l'action « mod.<nom>.<verbe> » d'un espace (contrôles faits ici), puis exit
function modules_api(string $espace, string $action, string $methode): never
{
  $a = modules_actions($espace)[$action] ?? null;
  if (!$a || !is_callable($a['fn'] ?? null)) echec('Action inconnue.', 404);
  $attendue = strtoupper((string)($a['methode'] ?? 'POST')) === 'GET' ? 'GET' : 'POST';
  if ($methode !== $attendue) echec('Méthode non autorisée pour cette action.', 405);
  if ($espace === 'admin') {
    $roles = (array)($a['roles'] ?? ['admin']);
    if (!function_exists('role_courant') || !in_array(role_courant(), $roles, true)) echec('Action réservée à un administrateur.', 403);
  }
  try {
    ($a['fn'])();
    echec('Réponse manquante.', 500); // une action doit répondre
  } catch (PDOException $e) { // erreur de base : jamais montrée telle quelle
    error_log("[BDA module {$a['module']}] $action : " . $e->getMessage());
    echec('Erreur du serveur. Réessayez dans un instant.', 500);
  } catch (RuntimeException $e) {
    echec($e->getMessage(), 400);
  } catch (Throwable $e) {
    error_log("[BDA module {$a['module']}] $action : " . $e->getMessage() . ' @' . basename($e->getFile()) . ':' . $e->getLine());
    echec('Erreur du serveur. Réessayez dans un instant.', 500);
  }
}

/* ---------- Cron (toutes les 30 min) : chaque module, isolé et chronométré ---------- */
function modules_cron(string $origine = 'auto'): array
{
  $bilan = [];
  foreach (modules() as $nom => $def) {
    $fn = $def['cron'] ?? null;
    if (!is_callable($fn)) continue;
    $t = microtime(true);
    try {
      $r = $fn($origine);
      $bilan[$nom] = ['ok' => true, 'ms' => (int)((microtime(true) - $t) * 1000)] + (is_array($r) ? $r : []);
    } catch (Throwable $e) {
      error_log("[BDA module $nom] cron : " . $e->getMessage());
      $bilan[$nom] = ['ok' => false, 'erreur' => mb_substr($e->getMessage(), 0, 200)];
    }
  }
  db()->prepare('INSERT INTO reglages (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
    ->execute(['modules_cron', json_encode(['quand' => maintenant(), 'origine' => $origine, 'bilan' => $bilan], JSON_UNESCAPED_UNICODE)]);
  return $bilan;
}

/* ---------- Compteurs (badges) et recherche Ctrl K ---------- */
function modules_compteurs(): array
{
  $c = [];
  foreach (modules() as $nom => $def) {
    $fn = $def['compteurs'] ?? null;
    if (!is_callable($fn)) continue;
    try { foreach ((array)$fn() as $k => $n) $c[(string)$k] = (int)$n; } catch (Throwable $e) { error_log("[BDA module $nom] compteurs : " . $e->getMessage()); }
  }
  return $c;
}
function modules_recherche(): array
{
  $r = [];
  foreach (modules() as $nom => $def) {
    $fn = $def['recherche'] ?? null;
    if (!is_callable($fn)) continue;
    try {
      foreach ((array)$fn() as $x) {
        if (!is_array($x) || empty($x['titre']) || empty($x['href'])) continue;
        $r[] = ['titre' => (string)$x['titre'], 'sous' => (string)($x['sous'] ?? ''), 'href' => (string)$x['href'], 'ic' => (string)($x['ic'] ?? 'suivant'),
          'groupe' => (string)($x['groupe'] ?? $def['titre'] ?? $nom), 'mots' => (string)($x['mots'] ?? ''), 'module' => $nom];
      }
    } catch (Throwable $e) { error_log("[BDA module $nom] recherche : " . $e->getMessage()); }
  }
  return array_slice($r, 0, 400);
}

/* ---------- Petits outils communs aux modules ---------- */
// Réglage JSON d'un module (clé reglages « mod:<nom>:<cle> »)
function mod_reglage(string $nom, string $cle, $defaut = null)
{
  $st = db()->prepare('SELECT v FROM reglages WHERE k = ?');
  $st->execute(["mod:$nom:$cle"]);
  $v = $st->fetchColumn();
  if ($v === false) return $defaut;
  $j = json_decode((string)$v, true);
  return json_last_error() === JSON_ERROR_NONE ? $j : $defaut;
}
function mod_reglage_ecrire(string $nom, string $cle, $valeur): void
{
  db()->prepare('INSERT INTO reglages (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
    ->execute(["mod:$nom:$cle", json_encode($valeur, JSON_UNESCAPED_UNICODE)]);
}
// Une tâche planifiée ne tourne qu'une fois par jour, après une heure donnée (heure de Paris)
function mod_une_fois_par_jour(string $nom, string $tache, int $apresHeure = 0): bool
{
  if ((int)date('G') < $apresHeure) return false;
  $cle = "mod:$nom:fait:$tache";
  $st = db()->prepare('SELECT v FROM reglages WHERE k = ?');
  $st->execute([$cle]);
  if ($st->fetchColumn() === date('Y-m-d')) return false;
  db()->prepare('INSERT INTO reglages (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute([$cle, date('Y-m-d')]);
  return true;
}
// Jeton aléatoire pour les liens publics (on ne garde que son empreinte en base)
function mod_jeton(): string
{
  return bin2hex(random_bytes(24));
}
function mod_empreinte(string $jeton): string
{
  return hash('sha256', $jeton);
}
// Adresse publique du site (liens envoyés par mail)
function mod_url(string $chemin): string
{
  $hote = preg_replace('/[^a-z0-9.:-]/i', '', (string)($_SERVER['HTTP_HOST'] ?? 'bdasecurite.com'));
  if ($hote === '' || PHP_SAPI === 'cli') $hote = 'bdasecurite.com';
  $local = (bool)preg_match('/^(localhost|127\.0\.0\.1)(:\d+)?$/', $hote);
  return ($local ? 'http://' : 'https://') . $hote . '/' . ltrim($chemin, '/');
}
// Envoi d'un mail : par le compte Google relié (contact@…) si possible, sinon par le serveur
function mod_envoyer_mail(string $a, string $sujet, string $texte, array $pj = [], array $options = []): array
{
  if (getenv('BDA_NO_MAIL')) { // tests sur ordinateur : rien ne part
    if ($journal = getenv('BDA_MAIL_LOG')) @file_put_contents($journal, '=== ' . date('c') . " → $a (Gmail simulé, " . count($pj) . " pièce(s))\n$sujet\n$texte\n\n", FILE_APPEND);
    return ['ok' => true, 'par' => 'test', 'id' => 'test-' . bin2hex(random_bytes(4)), 'fil' => ''];
  }
  require_once __DIR__ . '/google.php';
  if (google_relie()) {
    $r = google_envoyer($a, $sujet, $texte, $pj, $options);
    return ['ok' => true, 'par' => 'gmail', 'id' => $r['id'], 'fil' => $r['fil']];
  }
  if ($pj) throw new RuntimeException('Pour joindre un PDF, reliez d’abord la messagerie Google (Paramètres > Messagerie Google).');
  $ok = envoyer_mail($sujet, $texte, (string)($options['repondreA'] ?? BDA_EMAIL), $a);
  if (!$ok) throw new RuntimeException('Le mail n’a pas pu partir. Réessayez dans un instant.');
  return ['ok' => true, 'par' => 'serveur', 'id' => '', 'fil' => ''];
}
