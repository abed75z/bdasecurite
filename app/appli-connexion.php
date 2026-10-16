<?php
/* =========================================================
   APPLI BDASH — connexion avec Google ou Apple
   Le téléphone reçoit de Google / Apple un « jeton d'identité » (JWT signé). Le serveur vérifie la signature avec les
   clés publiques de Google / Apple, puis que le jeton est bien destiné à BDASH (identifiants publics réglés dans
   Admin > Appli BDASH > Prix & réglages). Aucun secret n'est nécessaire pour cette vérification.
   ========================================================= */

const APPLI_SOCIAL = [
  'google' => ['cles' => 'https://www.googleapis.com/oauth2/v3/certs', 'emetteurs' => ['accounts.google.com', 'https://accounts.google.com'], 'colonne' => 'google'],
  'apple' => ['cles' => 'https://appleid.apple.com/auth/keys', 'emetteurs' => ['https://appleid.apple.com'], 'colonne' => 'apple'],
];

function b64url_dec(string $s): string
{
  $b = base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true);
  return $b === false ? '' : $b;
}

// Clé RSA publique (n, e d'un JWK) au format PEM, pour openssl
function der_longueur(int $n): string
{
  if ($n < 128) return chr($n);
  $s = ltrim(pack('N', $n), "\0");
  return chr(0x80 | strlen($s)) . $s;
}
function der_entier(string $b): string
{
  $b = ltrim($b, "\0");
  if ($b === '' || ord($b[0]) > 127) $b = "\0" . $b;
  return "\x02" . der_longueur(strlen($b)) . $b;
}
function jwk_pem(array $k): string
{
  $rsa = der_entier(b64url_dec((string)$k['n'])) . der_entier(b64url_dec((string)$k['e']));
  $rsa = "\x30" . der_longueur(strlen($rsa)) . $rsa;
  $bits = "\x03" . der_longueur(strlen($rsa) + 1) . "\0" . $rsa;
  $algo = "\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00";
  $spki = "\x30" . der_longueur(strlen($algo . $bits)) . $algo . $bits;
  return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
}

// Signature RS256 : openssl si présent (serveur OVH), sinon calcul en bcmath (PC de test sans openssl)
function rs256_valide(string $donnees, string $signature, array $k): bool
{
  if (function_exists('openssl_verify')) {
    $cle = openssl_pkey_get_public(jwk_pem($k));
    return $cle !== false && openssl_verify($donnees, $signature, $cle, OPENSSL_ALGO_SHA256) === 1;
  }
  if (!function_exists('bcpowmod')) return false;
  $dec = function (string $bin): string { $r = '0'; foreach (str_split($bin) as $o) $r = bcadd(bcmul($r, '256'), (string)ord($o)); return $r; };
  $nb = ltrim(b64url_dec((string)$k['n']), "\0");
  $taille = strlen($nb);
  if ($taille < 256 || strlen($signature) !== $taille) return false;
  $m = bcpowmod($dec($signature), $dec(b64url_dec((string)$k['e'])), $dec($nb));
  $em = '';
  while (bccomp($m, '0') > 0) { $em = chr((int)bcmod($m, '256')) . $em; $m = bcdiv($m, '256', 0); }
  $em = str_pad($em, $taille, "\0", STR_PAD_LEFT);
  $info = hex2bin('3031300d060960864801650304020105000420') . hash('sha256', $donnees, true);
  return hash_equals("\x00\x01" . str_repeat("\xff", $taille - strlen($info) - 3) . "\x00" . $info, $em);
}

// Clés publiques de Google / Apple, gardées 6 h (rechargées tout de suite si une clé inconnue apparaît)
function appli_cles_publiques(string $fournisseur, bool $forcer = false): array
{
  $f = dossier_donnees() . '/cache-cles-' . $fournisseur . '.json';
  $lire = function () use ($f): array { $j = is_file($f) ? json_decode((string)file_get_contents($f), true) : null; return is_array($j['keys'] ?? null) ? $j['keys'] : []; };
  if (!$forcer && is_file($f) && filemtime($f) > time() - 21600 && $lire()) return $lire();
  $ctx = stream_context_create(['http' => ['timeout' => 8, 'user_agent' => 'BDASH'], 'ssl' => ['verify_peer' => true]]);
  $brut = @file_get_contents(APPLI_SOCIAL[$fournisseur]['cles'], false, $ctx);
  $j = $brut ? json_decode($brut, true) : null;
  if (!is_array($j['keys'] ?? null)) return $lire();
  @file_put_contents($f, $brut, LOCK_EX);
  return $j['keys'];
}

// Identifiants publics à qui le jeton doit être destiné
function appli_social_audiences(string $fournisseur): array
{
  $c = appli_cfg()['connexion'];
  if ($fournisseur === 'google') return array_values(array_filter([$c['googleWeb'], $c['googleIos']]));
  return $c['appleActif'] ? array_values(array_filter([$c['appleServices'], $c['appleBundle']])) : [];
}

// Vérifie un jeton d'identité Google / Apple ; renvoie l'identifiant stable du compte, l'e-mail et le nom
function appli_jeton_social(string $fournisseur, string $jwt): array
{
  if (!isset(APPLI_SOCIAL[$fournisseur])) echec('Mode de connexion inconnu.');
  $aud = appli_social_audiences($fournisseur);
  if (!$aud) echec('Cette connexion n’est pas encore activée.', 503);
  $p = explode('.', $jwt);
  if (count($p) !== 3) echec('Connexion refusée. Réessayez.', 401);
  $h = json_decode(b64url_dec($p[0]), true);
  $c = json_decode(b64url_dec($p[1]), true);
  if (!is_array($h) || !is_array($c) || ($h['alg'] ?? '') !== 'RS256') echec('Connexion refusée. Réessayez.', 401);
  $kid = (string)($h['kid'] ?? '');
  $trouver = fn(array $cles) => current(array_filter($cles, fn($k) => ($k['kid'] ?? '') === $kid && ($k['kty'] ?? '') === 'RSA')) ?: null;
  $cle = $trouver(appli_cles_publiques($fournisseur)) ?: $trouver(appli_cles_publiques($fournisseur, true));
  if (!$cle) echec('Connexion impossible pour le moment. Réessayez dans un instant.', 503);
  if (!rs256_valide($p[0] . '.' . $p[1], b64url_dec($p[2]), $cle)) echec('Connexion refusée. Réessayez.', 401);
  $destinataires = is_array($c['aud'] ?? null) ? $c['aud'] : [(string)($c['aud'] ?? '')];
  if (!in_array((string)($c['iss'] ?? ''), APPLI_SOCIAL[$fournisseur]['emetteurs'], true) || !array_intersect($destinataires, $aud)
    || (int)($c['exp'] ?? 0) < time() - 60 || (int)($c['iat'] ?? 0) > time() + 300 || (string)($c['sub'] ?? '') === '') {
    echec('Connexion expirée. Réessayez.', 401);
  }
  $verifie = ($c['email_verified'] ?? false) === true || ($c['email_verified'] ?? '') === 'true';
  return [
    'sub' => substr((string)$c['sub'], 0, 200),
    'email' => $verifie ? mb_strtolower(texte($c['email'] ?? '', 160)) : '',
    'prenom' => texte($c['given_name'] ?? '', 60),
    'nom' => texte($c['family_name'] ?? '', 60),
  ];
}
