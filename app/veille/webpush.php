<?php
/* =========================================================
   VEILLE — notifications Web Push (sans bibliothèque externe)
   - clés VAPID (ES256) générées une fois et rangées dans le .env privé
   - message chiffré selon la norme RFC 8291 (aes128gcm)
   - les abonnements expirés (404 / 410) sont supprimés automatiquement
   ========================================================= */
declare(strict_types=1);

function b64u(string $s): string
{
  return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}
function b64u_dec(string $s): string
{
  return (string)base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4));
}
// Réglage OpenSSL (utile sous Windows pour créer des clés)
function webpush_ssl_conf(): array
{
  $conf = ['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1'];
  if (!getenv('OPENSSL_CONF')) {
    foreach ([dirname(PHP_BINARY) . '/extras/ssl/openssl.cnf', 'C:/Program Files/Common Files/SSL/openssl.cnf'] as $c) if (is_file($c)) { $conf['config'] = $c; break; }
  }
  return $conf;
}
// Nouvelle paire de clés P-256 : [clé publique brute 65 octets, clé privée PEM]
function webpush_paire(): array
{
  $k = openssl_pkey_new(webpush_ssl_conf());
  if (!$k) throw new RuntimeException('Création de clé impossible : ' . openssl_error_string());
  $d = openssl_pkey_get_details($k);
  $pub = "\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT);
  $pem = '';
  openssl_pkey_export($k, $pem, null, webpush_ssl_conf());
  return [$pub, $pem, $k];
}
function webpush_generer_cles(): array
{
  [$pub, $pem] = webpush_paire();
  return [b64u($pub), $pem];
}
// Clé publique brute (65 octets) -> objet clé OpenSSL
function webpush_cle_publique(string $brut)
{
  $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $brut;
  $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
  $k = openssl_pkey_get_public($pem);
  if (!$k) throw new RuntimeException('Clé d’abonnement invalide.');
  return $k;
}
function webpush_hkdf(string $sel, string $ikm, string $info, int $long): string
{
  return hash_hkdf('sha256', $ikm, $long, $info, $sel);
}
// Signature ES256 DER -> brute (r || s, 64 octets)
function webpush_der_vers_brut(string $der): string
{
  $pos = 2;
  if (ord($der[1]) & 0x80) $pos += ord($der[1]) & 0x7f;
  $lire = function () use ($der, &$pos) {
    $pos++; // 0x02
    $l = ord($der[$pos++]);
    $v = substr($der, $pos, $l);
    $pos += $l;
    return str_pad(ltrim($v, "\0"), 32, "\0", STR_PAD_LEFT);
  };
  return $lire() . $lire();
}
function webpush_vapid(string $endpoint): string
{
  $p = parse_url($endpoint);
  $aud = $p['scheme'] . '://' . $p['host'];
  $entete = b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
  $charge = b64u(json_encode(['aud' => $aud, 'exp' => time() + 12 * 3600, 'sub' => veille_env('VAPID_SUBJECT') ?: 'mailto:' . BDA_EMAIL]));
  $priv = openssl_pkey_get_private(base64_decode(veille_env('VAPID_PRIVATE_KEY')));
  if (!$priv) throw new RuntimeException('Clé VAPID privée illisible.');
  $sig = '';
  openssl_sign("$entete.$charge", $sig, $priv, OPENSSL_ALGO_SHA256);
  return 'vapid t=' . "$entete.$charge." . b64u(webpush_der_vers_brut($sig)) . ', k=' . veille_env('VAPID_PUBLIC_KEY');
}
// Chiffrement RFC 8291 (aes128gcm)
function webpush_chiffrer(string $message, string $p256dh, string $auth): string
{
  $uaPub = b64u_dec($p256dh);
  $authSecret = b64u_dec($auth);
  if (strlen($uaPub) !== 65 || strlen($authSecret) < 16) throw new RuntimeException('Abonnement incomplet.');
  [$asPub, , $asPriv] = webpush_paire();
  $secret = openssl_pkey_derive(webpush_cle_publique($uaPub), $asPriv, 32);
  if ($secret === false) throw new RuntimeException('Échange de clés impossible.');
  $ikm = webpush_hkdf($authSecret, $secret, "WebPush: info\0" . $uaPub . $asPub, 32);
  $sel = random_bytes(16);
  $cek = webpush_hkdf($sel, $ikm, "Content-Encoding: aes128gcm\0", 16);
  $nonce = webpush_hkdf($sel, $ikm, "Content-Encoding: nonce\0", 12);
  $tag = '';
  $chiffre = openssl_encrypt($message . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
  return $sel . pack('N', 4096) . chr(65) . $asPub . $chiffre . $tag;
}
// Envoie à un abonnement ; renvoie le code HTTP
function webpush_envoyer(array $abo, array $donnees): int
{
  $corps = webpush_chiffrer(json_encode($donnees, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), (string)$abo['p256dh'], (string)$abo['auth']);
  $r = veille_http('POST', (string)$abo['endpoint'], [
    'Authorization: ' . webpush_vapid((string)$abo['endpoint']),
    'Content-Encoding: aes128gcm',
    'Content-Type: application/octet-stream',
    'TTL: 86400',
    'Urgency: high',
  ], $corps, 15);
  return $r['code'];
}
// Envoie à tous les abonnés ; supprime les abonnements expirés
function webpush_tous(array $donnees): array
{
  $res = ['envoyes' => 0, 'supprimes' => 0, 'erreurs' => 0];
  if (veille_env('VAPID_PUBLIC_KEY') === '') return $res;
  foreach (db()->query('SELECT * FROM push_abonnements')->fetchAll() as $abo) {
    try {
      $code = webpush_envoyer($abo, $donnees);
      if ($code === 404 || $code === 410) {
        db()->prepare('DELETE FROM push_abonnements WHERE id = ?')->execute([$abo['id']]);
        $res['supprimes']++;
      } elseif ($code >= 200 && $code < 300) {
        db()->prepare('UPDATE push_abonnements SET vu = ? WHERE id = ?')->execute([veille_maintenant(), $abo['id']]);
        $res['envoyes']++;
      } else {
        $res['erreurs']++;
      }
    } catch (Throwable $e) {
      $res['erreurs']++;
      error_log('[BDA push] ' . $e->getMessage());
    }
  }
  return $res;
}
