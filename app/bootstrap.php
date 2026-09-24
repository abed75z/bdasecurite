<?php
/* =========================================================
   ESPACE ADMIN BDA — socle commun (API admin + API publique)
   Les données sont rangées dans une base SQLite placée HORS du
   dossier public « www » : elles ne sont jamais servies par le site
   et ne partent pas sur GitHub.
   ========================================================= */
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
date_default_timezone_set('Europe/Paris');
mb_internal_encoding('UTF-8');

// Empreinte SHA-256 du code d'activation / de secours (le code lui-même n'est enregistré nulle part)
const BDA_CODE_HASH = '0c4b9975757c5132b2b8c88b4dc36e0171fa8f8f14f4faef5889755b61b0dce1';
const BDA_EMAIL = 'bdasecurite@gmail.com';
const BDA_AVIS_GOOGLE = 'https://script.google.com/macros/s/AKfycby8EgzFHBFd_1HG8vhYJjtOCbHOyBJHvhL3UrpFTPKV2sXHQfq9J2VaA1SCRCXkdy5cjA/exec';

const STATUTS = [
  'devis' => ['brouillon', 'envoye', 'accepte', 'refuse'],
  'facture' => ['brouillon', 'envoyee', 'payee', 'annulee'],
  'demande' => ['nouvelle', 'traitee', 'archivee'],
  'candidature' => ['nouvelle', 'en_cours', 'retenue', 'refusee'],
  'avis' => ['attente', 'publie', 'refuse'],
];

/* ---------- Réponses JSON ---------- */
function repondre(array $data, int $code = 200): void
{
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
  exit;
}
function echec(string $message, int $code = 400): void
{
  repondre(['ok' => false, 'erreur' => $message], $code);
}
function corps(): array
{
  $brut = file_get_contents('php://input');
  if ($brut === false || strlen($brut) > 1500000) echec('Requête trop volumineuse.', 413);
  $d = json_decode($brut, true);
  return is_array($d) ? $d : [];
}
function entetes_securite(): void
{
  header('X-Content-Type-Options: nosniff');
  header('Referrer-Policy: same-origin');
  header('X-Robots-Tag: noindex, nofollow');
  header('X-Frame-Options: DENY');
}
function est_https(): bool
{
  return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (string)($_SERVER['SERVER_PORT'] ?? '') === '443'
    || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}
// Refuse les envois venant d'un autre site (les navigateurs envoient toujours l'origine en POST)
function origine_ok(): bool
{
  $o = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
  if ($o === '') return true;
  $hote = (string)parse_url($o, PHP_URL_HOST);
  return in_array($hote, ['bdasecurite.com', 'www.bdasecurite.com', 'localhost', '127.0.0.1'], true);
}

/* ---------- Dossier de données et base SQLite ---------- */
function dossier_donnees(): string
{
  static $dir = null;
  if ($dir !== null) return $dir;
  $env = getenv('BDA_DATA_DIR');
  $racine = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
  $dir = $env ?: (($racine !== '' ? dirname($racine) : dirname(__DIR__, 2)) . '/bda-admin-data');
  if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
    echec('Espace de stockage indisponible.', 500);
  }
  if (!is_file($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', "Require all denied\n");
  return $dir;
}
function db(): PDO
{
  static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;
  $pdo = new PDO('sqlite:' . dossier_donnees() . '/gestion.sqlite', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  $pdo->exec('PRAGMA busy_timeout = 5000');
  schema($pdo);
  return $pdo;
}
function schema(PDO $db): void
{
  if ((int)$db->query('PRAGMA user_version')->fetchColumn() >= 1) return;
  $db->exec(<<<'SQL'
    CREATE TABLE IF NOT EXISTS utilisateurs (id INTEGER PRIMARY KEY, login TEXT NOT NULL UNIQUE COLLATE NOCASE, hash TEXT NOT NULL, cree TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tentatives (k TEXT NOT NULL, t INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS i_tentatives ON tentatives (k, t);
    CREATE TABLE IF NOT EXISTS reglages (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY, type TEXT NOT NULL, numero TEXT NOT NULL, statut TEXT NOT NULL, client TEXT NOT NULL DEFAULT '', total REAL NOT NULL DEFAULT 0, date TEXT NOT NULL DEFAULT '', echeance TEXT NOT NULL DEFAULT '', data TEXT NOT NULL, cree TEXT NOT NULL, maj TEXT NOT NULL, UNIQUE (type, numero));
    CREATE TABLE IF NOT EXISTS plannings (mois TEXT PRIMARY KEY, data TEXT NOT NULL, maj TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, nom TEXT NOT NULL, adresse TEXT NOT NULL DEFAULT '', tel TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agents (id INTEGER PRIMARY KEY, nom TEXT NOT NULL, poste TEXT NOT NULL DEFAULT 'ADS', tel TEXT NOT NULL DEFAULT '', carte TEXT NOT NULL DEFAULT '', validite TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', actif INTEGER NOT NULL DEFAULT 1, cree TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS demandes (id INTEGER PRIMARY KEY, recu TEXT NOT NULL, statut TEXT NOT NULL DEFAULT 'nouvelle', data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS candidatures (id INTEGER PRIMARY KEY, recu TEXT NOT NULL, statut TEXT NOT NULL DEFAULT 'nouvelle', data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS avis (id INTEGER PRIMARY KEY, recu TEXT NOT NULL, nom TEXT NOT NULL, note INTEGER NOT NULL, prestation TEXT NOT NULL DEFAULT '', texte TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', statut TEXT NOT NULL DEFAULT 'attente');
    CREATE TABLE IF NOT EXISTS visites (jour TEXT NOT NULL, page TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (jour, page));
    PRAGMA user_version = 1;
  SQL);
}

/* ---------- Outils ---------- */
function maintenant(): string
{
  return date('Y-m-d H:i:s');
}
// Valeur texte brute (mot de passe, code) : tout ce qui n'est pas un texte devient vide
function chaine($v): string
{
  return is_string($v) ? $v : (is_int($v) || is_float($v) ? (string)$v : '');
}
function texte($v, int $max): string
{
  $s = is_scalar($v) ? (string)$v : '';
  $s = str_replace("\0", '', $s);
  $s = trim((string)preg_replace('/\r\n?/', "\n", $s));
  return mb_substr($s, 0, $max);
}
function secret(): string
{
  $f = dossier_donnees() . '/secret.key';
  if (!is_file($f)) {
    @file_put_contents($f, bin2hex(random_bytes(32)));
    @chmod($f, 0600);
  }
  return (string)file_get_contents($f);
}
// Empreinte de l'adresse IP (on ne garde jamais l'adresse elle-même)
function empreinte_client(): string
{
  return hash_hmac('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? ''), secret());
}
function tentatives(string $k, int $fenetre): int
{
  $st = db()->prepare('SELECT COUNT(*) FROM tentatives WHERE k = ? AND t > ?');
  $st->execute([$k, time() - $fenetre]);
  return (int)$st->fetchColumn();
}
function noter_tentative(string $k): void
{
  $db = db();
  $db->prepare('DELETE FROM tentatives WHERE t < ?')->execute([time() - 86400]);
  $db->prepare('INSERT INTO tentatives (k, t) VALUES (?, ?)')->execute([$k, time()]);
}
// true = autorisé ; enregistre la tentative
function limiter(string $seau, int $max, int $fenetre): bool
{
  $k = $seau . ':' . empreinte_client();
  if (tentatives($k, $fenetre) >= $max) return false;
  noter_tentative($k);
  return true;
}
// Champs d'un formulaire du site : libellés lisibles, sans les champs techniques (_subject, _template…)
function champs_formulaire(array $b): array
{
  $data = [];
  foreach ($b as $k => $v) {
    $k = texte($k, 60);
    if ($k === '' || $k[0] === '_' || $k === 'site_web' || count($data) >= 30) continue;
    $data[$k] = texte($v, 4000);
  }
  return $data;
}
function fr_vers_iso(string $s): string
{
  return preg_match('~^(\d{1,2})/(\d{1,2})/(\d{4})$~', trim($s), $m) ? sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]) : '';
}
function envoyer_mail(string $sujet, string $message, string $repondreA = ''): bool
{
  if (getenv('BDA_NO_MAIL')) return true; // tests sur ordinateur
  $sujet = str_replace(["\r", "\n"], ' ', $sujet);
  $entetes = ['From: BDA Securite <noreply@bdasecurite.com>', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit'];
  if ($repondreA !== '' && filter_var($repondreA, FILTER_VALIDATE_EMAIL)) $entetes[] = 'Reply-To: ' . $repondreA;
  return @mail(BDA_EMAIL, mb_encode_mimeheader($sujet, 'UTF-8'), $message, implode("\r\n", $entetes));
}

/* ---------- Réglages de l'entreprise (valeurs publiques par défaut) ---------- */
function reglages_defaut(): array
{
  return [
    'nom' => 'BDA SECURITE',
    'emetteur' => "Abdelouahab BOUIDIA EI\n61 rue de la Croix Saint-Simon\n75020 PARIS\nSIRET : 977 933 316 00019\nAPE : 8010Z\nTÉL : 07.84.73.90.70",
    'email' => BDA_EMAIL,
    'beneficiaire' => 'ABDELOUAHAB BOUIDIA',
    'iban' => '',
    'conditionsFacture' => "Conditions générales de vente : Aucun escompte accordé en cas de paiement comptant.\nTVA non applicable, art. 293 B du CGI.\nEn cas de retard de paiement : pénalités égales à trois fois le taux d'intérêt légal et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).",
    'conditionsDevis' => "Devis valable 30 jours à compter de sa date d'émission.\nAcompte à la signature du devis, solde à réception de la facture de fin de mission.\nAucun escompte accordé en cas de paiement comptant. TVA non applicable, art. 293 B du CGI.",
    'pied' => "BDA SECURITE — Abdelouahab Bouidia EI — SIRET 977 933 316 00019 — APE 8010Z — Autorisation d'exercice CNAPS n° AUT-075-2124-07-01-20250906336\n« L'autorisation d'exercice ne confère aucune prérogative de puissance publique à l'entreprise ou aux personnes qui en bénéficient. » (art. L.612-14 du Code de la sécurité intérieure)",
    'prefixeFacture' => 'FA-{AAAA}-',
    'prefixeDevis' => 'DV-{AAAA}-',
    'echeanceJours' => 7,
    'validiteDevis' => '30 jours',
    'acompte' => 30,
    'tauxHoraire' => 22,
  ];
}
function reglages(): array
{
  $st = db()->prepare('SELECT v FROM reglages WHERE k = ?');
  $st->execute(['entreprise']);
  $v = json_decode((string)$st->fetchColumn(), true);
  return array_merge(reglages_defaut(), is_array($v) ? $v : []);
}
// Reprend les avis publiés dans Google Sheets (ancien système) ; renvoie le nombre ajouté, -1 si indisponible
function importer_avis_google(): int
{
  $ctx = stream_context_create(['http' => ['timeout' => 12, 'follow_location' => 1, 'user_agent' => 'BDA-admin'], 'ssl' => ['verify_peer' => true]]);
  $brut = @file_get_contents(BDA_AVIS_GOOGLE, false, $ctx);
  $json = $brut ? json_decode($brut, true) : null;
  if (!is_array($json) || !isset($json['avis']) || !is_array($json['avis'])) return -1;
  $n = 0;
  $existe = db()->prepare('SELECT COUNT(*) FROM avis WHERE nom = ? AND texte = ?');
  $ajout = db()->prepare("INSERT INTO avis (recu, nom, note, prestation, texte, email, statut) VALUES (?, ?, ?, ?, ?, '', 'publie')");
  foreach ($json['avis'] as $a) {
    $nom = texte($a['nom'] ?? '', 60);
    $txt = texte($a['texte'] ?? '', 1500);
    $note = (int)($a['note'] ?? 0);
    if ($nom === '' || $txt === '' || $note < 1 || $note > 5) continue;
    $existe->execute([$nom, $txt]);
    if ((int)$existe->fetchColumn() > 0) continue;
    $t = strtotime((string)($a['date'] ?? '')) ?: time();
    $ajout->execute([date('Y-m-d H:i:s', $t), $nom, $note, texte($a['prestation'] ?? '', 80), $txt]);
    $n++;
  }
  return $n;
}
// Au tout premier affichage des avis, on reprend une fois ceux de Google Sheets
// (réessai au plus toutes les heures si Google ne répond pas)
function avis_google_une_fois(): void
{
  $marque = dossier_donnees() . '/avis-google.txt';
  $etat = is_file($marque) ? trim((string)file_get_contents($marque)) : '';
  if ($etat === 'ok' || ($etat !== '' && time() - (int)$etat < 3600)) return;
  $n = importer_avis_google();
  file_put_contents($marque, $n >= 0 ? 'ok' : (string)time());
}
