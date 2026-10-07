<?php
/* =========================================================
   VEILLE — outils communs : fichier .env privé, requêtes HTTP, textes
   Le .env est rangé dans le dossier privé des données (hors du site, jamais sur GitHub).
   ========================================================= */
declare(strict_types=1);

const VEILLE_ENV_CLES = ['DISCORD_WEBHOOK_URL', 'FT_CLIENT_ID', 'FT_CLIENT_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'VEILLE_CRON_KEY'];

function veille_env_chemin(): string
{
  return dossier_donnees() . '/.env';
}
function veille_env(?string $cle = null)
{
  $env = &$GLOBALS['__veille_env'];
  if ($env === null) {
    $env = [];
    $f = veille_env_chemin();
    if (is_file($f)) {
      foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $l) {
        if ($l === '' || $l[0] === '#' || !str_contains($l, '=')) continue;
        [$k, $v] = explode('=', $l, 2);
        $v = trim($v);
        if (strlen($v) >= 2 && $v[0] === '"' && substr($v, -1) === '"') $v = stripcslashes(substr($v, 1, -1));
        $env[trim($k)] = $v;
      }
    }
  }
  if ($cle === null) return $env;
  $v = $env[$cle] ?? '';
  if ($v === '') $v = (string)(getenv($cle) ?: '');
  return $v;
}
// Met à jour des valeurs du .env (une valeur vide efface la clé)
function veille_env_ecrire(array $maj): void
{
  $env = veille_env();
  foreach ($maj as $k => $v) {
    if (!in_array($k, VEILLE_ENV_CLES, true)) continue;
    if ($v === '') unset($env[$k]); else $env[$k] = $v;
  }
  $txt = "# Secrets de la veille commerciale BDA (fichier privé, hors du site, jamais sur GitHub)\n";
  foreach ($env as $k => $v) $txt .= $k . '="' . addcslashes((string)$v, "\"\\\n\r") . "\"\n";
  $f = veille_env_chemin();
  if (file_put_contents($f, $txt, LOCK_EX) === false) throw new RuntimeException('Écriture du fichier .env impossible.');
  @chmod($f, 0600);
  $GLOBALS['__veille_env'] = null; // relu au prochain appel
}
// Clés générées automatiquement au premier usage (clés de notification VAPID, code secret du lancement automatique)
function veille_cles_auto(): void
{
  $maj = [];
  if (veille_env('VEILLE_CRON_KEY') === '') $maj['VEILLE_CRON_KEY'] = bin2hex(random_bytes(24));
  if (veille_env('VAPID_PUBLIC_KEY') === '' || veille_env('VAPID_PRIVATE_KEY') === '') {
    [$pub, $privPem] = webpush_generer_cles();
    $maj['VAPID_PUBLIC_KEY'] = $pub;
    $maj['VAPID_PRIVATE_KEY'] = base64_encode($privPem);
  }
  if (veille_env('VAPID_SUBJECT') === '') $maj['VAPID_SUBJECT'] = 'mailto:' . BDA_EMAIL;
  if ($maj) veille_env_ecrire($maj);
}

/* ---------- Requêtes HTTP (cURL) ---------- */
function veille_http(string $methode, string $url, array $entetes = [], ?string $corps = null, int $delai = 25): array
{
  $ch = curl_init($url);
  $recus = [];
  curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $methode,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => $delai,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_HTTPHEADER => $entetes,
    CURLOPT_USERAGENT => 'BDA-Veille/1.0 (+https://bdasecurite.com)',
    CURLOPT_ENCODING => '',
    CURLOPT_HEADERFUNCTION => function ($c, $l) use (&$recus) {
      $p = strpos($l, ':');
      if ($p !== false) $recus[strtolower(trim(substr($l, 0, $p)))] = trim(substr($l, $p + 1));
      return strlen($l);
    },
  ]);
  if ($corps !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $corps);
  // Tests sur un PC Windows : certificats du système (sur OVH, ceux du serveur sont utilisés)
  if (PHP_OS_FAMILY === 'Windows' && defined('CURLSSLOPT_NATIVE_CA')) curl_setopt($ch, CURLOPT_SSL_OPTIONS, CURLSSLOPT_NATIVE_CA);
  $rep = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $err = curl_error($ch);
  curl_close($ch);
  if ($rep === false) throw new RuntimeException('Connexion impossible (' . ($err ?: 'réseau') . ').');
  return ['code' => $code, 'entetes' => $recus, 'corps' => (string)$rep];
}
function veille_json(string $url, array $entetes = [], int $delai = 30): array
{
  $r = veille_http('GET', $url, array_merge(['Accept: application/json'], $entetes), null, $delai);
  if ($r['code'] < 200 || $r['code'] >= 300) throw new RuntimeException("Réponse HTTP {$r['code']} : " . mb_substr(strip_tags($r['corps']), 0, 200));
  $j = json_decode($r['corps'], true);
  if (!is_array($j)) throw new RuntimeException('Réponse illisible.');
  return $j;
}

/* ---------- Textes ---------- */
// minuscules sans accents, espaces simples (pour chercher les mots-clés)
function veille_normaliser(string $s): string
{
  $s = mb_strtolower($s, 'UTF-8');
  $s = strtr($s, ['à' => 'a', 'â' => 'a', 'ä' => 'a', 'á' => 'a', 'ç' => 'c', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'î' => 'i', 'ï' => 'i', 'í' => 'i',
    'ô' => 'o', 'ö' => 'o', 'ó' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ú' => 'u', 'ÿ' => 'y', 'ñ' => 'n', 'œ' => 'oe', 'æ' => 'ae', '’' => "'", '‘' => "'", '«' => ' ', '»' => ' ']);
  return ' ' . trim((string)preg_replace('/\s+/u', ' ', $s)) . ' ';
}
// le mot-clé est-il présent comme mot entier ?
function veille_contient(string $texteNormalise, string $motNormalise): bool
{
  $m = trim($motNormalise);
  if ($m === '') return false;
  return (bool)preg_match('/(?<![a-z0-9])' . preg_quote($m, '/') . '(?![a-z0-9])/u', $texteNormalise);
}
// date ISO (avec fuseau) -> date et heure de Paris 'Y-m-d H:i:s'
function veille_date_paris(?string $iso): string
{
  if (!$iso) return '';
  try {
    $d = new DateTimeImmutable($iso);
    return $d->setTimezone(new DateTimeZone('Europe/Paris'))->format('Y-m-d H:i:s');
  } catch (Throwable $e) {
    return '';
  }
}
function veille_maintenant(): string
{
  return (new DateTimeImmutable('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d H:i:s');
}
