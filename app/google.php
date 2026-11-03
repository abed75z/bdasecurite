<?php
/* =========================================================
   GOOGLE — messagerie (Gmail) et agenda reliés à l'admin
   - Le gérant relie une fois son compte Google (Paramètres > Messagerie Google) :
     connexion OAuth 2.0, il clique lui-même sur « Autoriser » chez Google.
   - Identifiant client, code secret et jeton de renouvellement restent dans le
     .env privé (hors du site, jamais sur GitHub).
   - Les mails partent du vrai compte (ex. contact@bdasecurite.com) : signés par
     Google et rangés dans « Messages envoyés » de Gmail.
   ========================================================= */
declare(strict_types=1);
require_once __DIR__ . '/veille/outils.php';

// Lire, envoyer et classer les mails (pas de suppression définitive) + créer les rendez-vous de l'agenda
const GOOGLE_PORTEES = ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/calendar.events'];
const GOOGLE_NOM_EXPEDITEUR = 'BDA Security Group';

// Adresse de retour à déclarer chez Google (doit être identique au caractère près)
function google_retour(): string
{
  $hote = preg_replace('/[^a-z0-9.:-]/i', '', (string)($_SERVER['HTTP_HOST'] ?? 'bdasecurite.com'));
  $local = (bool)preg_match('/^(localhost|127\.0\.0\.1)(:\d+)?$/', $hote); // tests sur ordinateur
  return ($local && !est_https() ? 'http://' : 'https://') . $hote . '/admin/google.php';
}
function google_pret(): bool
{
  return veille_env('GOOGLE_CLIENT_ID') !== '' && veille_env('GOOGLE_CLIENT_SECRET') !== '';
}
function google_relie(): bool
{
  return google_pret() && veille_env('GOOGLE_REFRESH_TOKEN') !== '';
}
function google_compte(): string
{
  return veille_env('GOOGLE_COMPTE');
}
function google_etat(): array
{
  $st = db()->prepare('SELECT v FROM reglages WHERE k = ?');
  $st->execute(['google_info']);
  $info = json_decode((string)$st->fetchColumn(), true);
  return [
    'pret' => google_pret(),
    'relie' => google_relie(),
    'compte' => google_compte(),
    'idClient' => veille_env('GOOGLE_CLIENT_ID') === '' ? '' : mb_substr(veille_env('GOOGLE_CLIENT_ID'), 0, 14) . '…',
    'retour' => google_retour(),
    'depuis' => is_array($info) ? (string)($info['depuis'] ?? '') : '',
    'agenda' => is_array($info) && !empty($info['agenda']),
  ];
}
function google_info(array $info): void
{
  db()->prepare('INSERT INTO reglages (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute(['google_info', json_encode($info, JSON_UNESCAPED_UNICODE)]);
}

/* ---------- Connexion (OAuth 2.0) ---------- */
// Lien vers l'écran « Autoriser » de Google. Le code d'état, à usage unique et valable 10 min,
// est gardé dans la base : le retour de Google n'a pas besoin du cookie de session.
function google_url_connexion(string $qui): string
{
  if (!google_pret()) throw new RuntimeException('Enregistrez d’abord l’identifiant client et le code secret.');
  $etat = bin2hex(random_bytes(24));
  db()->prepare('INSERT INTO reglages (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
    ->execute(['google_etat', json_encode(['h' => hash('sha256', $etat), 'expire' => time() + 600, 'qui' => $qui])]);
  return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
    'client_id' => veille_env('GOOGLE_CLIENT_ID'),
    'redirect_uri' => google_retour(),
    'response_type' => 'code',
    'scope' => implode(' ', GOOGLE_PORTEES),
    'access_type' => 'offline',
    'prompt' => 'consent select_account',
    'include_granted_scopes' => 'true',
    'state' => $etat,
  ], '', '&', PHP_QUERY_RFC3986);
}
// Retour de Google : vérifie le code d'état, récupère le jeton de renouvellement, note le compte relié
function google_finir(string $code, string $etat): string
{
  $st = db()->prepare('SELECT v FROM reglages WHERE k = ?');
  $st->execute(['google_etat']);
  $e = json_decode((string)$st->fetchColumn(), true);
  if (!is_array($e) || $etat === '' || !hash_equals((string)($e['h'] ?? ''), hash('sha256', $etat))) throw new RuntimeException('Lien de connexion inconnu : recommencez depuis l’admin.');
  db()->prepare('DELETE FROM reglages WHERE k = ?')->execute(['google_etat']); // usage unique
  if ((int)($e['expire'] ?? 0) < time()) throw new RuntimeException('Lien de connexion expiré (10 minutes) : recommencez depuis l’admin.');
  if ($code === '' || strlen($code) > 1000) throw new RuntimeException('Réponse de Google incomplète.');

  $j = google_jeton_requete(['code' => $code, 'redirect_uri' => google_retour(), 'grant_type' => 'authorization_code']);
  $portees = explode(' ', (string)($j['scope'] ?? ''));
  if (!in_array(GOOGLE_PORTEES[0], $portees, true)) throw new RuntimeException('La case « Gmail » n’a pas été cochée chez Google : recommencez et cochez-la.');
  if (empty($j['refresh_token'])) throw new RuntimeException('Google n’a pas donné d’accès permanent : recommencez la connexion.');

  $GLOBALS['__google_acces'] = ['jeton' => (string)$j['access_token'], 'expire' => time() + (int)($j['expires_in'] ?? 3000) - 60];
  $profil = google_api('GET', 'https://gmail.googleapis.com/gmail/v1/users/me/profile');
  $compte = (string)($profil['emailAddress'] ?? '');
  if (!filter_var($compte, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Adresse du compte Google illisible.');
  veille_env_ecrire(['GOOGLE_REFRESH_TOKEN' => (string)$j['refresh_token'], 'GOOGLE_COMPTE' => $compte]);
  google_info(['depuis' => maintenant(), 'qui' => (string)($e['qui'] ?? ''), 'agenda' => in_array(GOOGLE_PORTEES[1], $portees, true)]);
  return $compte;
}
function google_jeton_requete(array $params): array
{
  $r = veille_http('POST', 'https://oauth2.googleapis.com/token', ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
    http_build_query($params + ['client_id' => veille_env('GOOGLE_CLIENT_ID'), 'client_secret' => veille_env('GOOGLE_CLIENT_SECRET')]), 20);
  $j = json_decode($r['corps'], true) ?: [];
  if ($r['code'] !== 200 || empty($j['access_token'])) {
    $err = (string)($j['error'] ?? '');
    if ($err === 'invalid_client') throw new RuntimeException('Google ne reconnaît pas l’identifiant client ou le code secret : vérifiez-les dans Paramètres.');
    if ($err === 'invalid_grant') throw new RuntimeException('La connexion Google n’est plus valable : reliez de nouveau le compte dans Paramètres.');
    if ($err === 'redirect_uri_mismatch') throw new RuntimeException('L’adresse de retour déclarée chez Google ne correspond pas : copiez celle affichée dans Paramètres.');
    throw new RuntimeException('Google a refusé la connexion' . ($err !== '' ? " ($err)" : '') . '.');
  }
  return $j;
}
// Jeton d'accès (1 h), renouvelé automatiquement avec le jeton de renouvellement
function google_jeton(): string
{
  $a = $GLOBALS['__google_acces'] ?? null;
  if (is_array($a) && $a['expire'] > time()) return $a['jeton'];
  if (!google_relie()) throw new RuntimeException('Aucun compte Google relié : allez dans Paramètres > Messagerie Google.');
  $j = google_jeton_requete(['refresh_token' => veille_env('GOOGLE_REFRESH_TOKEN'), 'grant_type' => 'refresh_token']);
  $GLOBALS['__google_acces'] = ['jeton' => (string)$j['access_token'], 'expire' => time() + (int)($j['expires_in'] ?? 3000) - 60];
  return (string)$j['access_token'];
}
function google_api(string $methode, string $url, ?array $json = null): array
{
  $r = veille_http($methode, $url, ['Authorization: Bearer ' . google_jeton(), 'Accept: application/json', 'Content-Type: application/json'],
    $json === null ? null : json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 40);
  $j = json_decode($r['corps'], true);
  if ($r['code'] < 200 || $r['code'] >= 300) {
    $msg = is_array($j) ? (string)($j['error']['message'] ?? '') : '';
    if ($r['code'] === 403 && str_contains($msg, 'has not been used')) throw new RuntimeException('L’API Gmail n’est pas activée dans le projet Google.');
    throw new RuntimeException("Google a répondu une erreur ({$r['code']})" . ($msg !== '' ? ' : ' . mb_substr($msg, 0, 160) : '.'));
  }
  return is_array($j) ? $j : [];
}
// Déconnexion : Google oublie l'autorisation et le jeton est effacé du .env
function google_deconnecter(): void
{
  $jeton = veille_env('GOOGLE_REFRESH_TOKEN');
  if ($jeton !== '') {
    try { veille_http('POST', 'https://oauth2.googleapis.com/revoke', ['Content-Type: application/x-www-form-urlencoded'], http_build_query(['token' => $jeton]), 15); } catch (Throwable $e) { /* déjà révoqué ou réseau : on efface quand même */ }
  }
  veille_env_ecrire(['GOOGLE_REFRESH_TOKEN' => '', 'GOOGLE_COMPTE' => '']);
  db()->prepare('DELETE FROM reglages WHERE k IN (?, ?)')->execute(['google_info', 'google_etat']);
}

/* ---------- Envoi d'un mail depuis le compte relié ----------
   $pj : [['nom' => 'Facture FA-2026-014.pdf', 'type' => 'application/pdf', 'donnees' => <octets>], …]
   $options : cc, cci (listes d'adresses), repondreA */
function google_envoyer(string $a, string $sujet, string $texte, array $pj = [], array $options = []): array
{
  $propre = fn (string $s) => trim(str_replace(["\r", "\n"], ' ', $s));
  $adresses = function ($liste) use ($propre): array {
    $ok = [];
    foreach ((array)$liste as $x) {
      foreach (preg_split('/[,;\s]+/', $propre((string)$x)) ?: [] as $m) if ($m !== '' && filter_var($m, FILTER_VALIDATE_EMAIL)) $ok[] = $m;
    }
    return array_values(array_unique($ok));
  };
  $dest = $adresses([$a]);
  if (!$dest) throw new RuntimeException('Adresse du destinataire invalide.');
  $cc = $adresses($options['cc'] ?? []);
  $cci = $adresses($options['cci'] ?? []);
  $compte = google_compte();
  if ($compte === '') throw new RuntimeException('Aucun compte Google relié.');

  $entetes = [
    'From: ' . mb_encode_mimeheader(GOOGLE_NOM_EXPEDITEUR, 'UTF-8') . " <$compte>",
    'To: ' . implode(', ', $dest),
  ];
  if ($cc) $entetes[] = 'Cc: ' . implode(', ', $cc);
  if ($cci) $entetes[] = 'Bcc: ' . implode(', ', $cci);
  $rep = $adresses([$options['repondreA'] ?? '']);
  if ($rep) $entetes[] = 'Reply-To: ' . $rep[0];
  // réponse dans un fil existant (messagerie de l'admin) : en-têtes de suivi + identifiant du fil Gmail
  $suivi = fn (string $s) => (string)preg_replace('/[^!-~ ]/', '', $propre($s));
  if (!empty($options['inReplyTo'])) $entetes[] = 'In-Reply-To: ' . $suivi((string)$options['inReplyTo']);
  if (!empty($options['references'])) $entetes[] = 'References: ' . $suivi((string)$options['references']);
  $entetes[] = 'Subject: ' . mb_encode_mimeheader($propre($sujet), 'UTF-8', 'B');
  $entetes[] = 'MIME-Version: 1.0';

  $corpsTexte = "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode(str_replace("\r\n", "\n", $texte)));
  if (!$pj) {
    $mime = implode("\r\n", $entetes) . "\r\n" . $corpsTexte;
  } else {
    $limite = 'bda-' . bin2hex(random_bytes(12));
    $mime = implode("\r\n", $entetes) . "\r\nContent-Type: multipart/mixed; boundary=\"$limite\"\r\n\r\n--$limite\r\n" . $corpsTexte;
    foreach ($pj as $f) {
      $nom = preg_replace('/[\r\n"\\\\\/]+/', ' ', (string)($f['nom'] ?? 'document.pdf'));
      $type = preg_match('~^[a-z]+/[a-z0-9.+-]+$~i', (string)($f['type'] ?? '')) ? (string)$f['type'] : 'application/octet-stream';
      $nomEnc = mb_encode_mimeheader($nom, 'UTF-8', 'B');
      $mime .= "--$limite\r\nContent-Type: $type; name=\"$nomEnc\"\r\nContent-Disposition: attachment; filename=\"$nomEnc\"\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode((string)$f['donnees']));
    }
    $mime .= "--$limite--\r\n";
  }
  if (strlen($mime) > 24 * 1024 * 1024) throw new RuntimeException('Pièces jointes trop lourdes (25 Mo au maximum chez Gmail).');
  $envoi = ['raw' => rtrim(strtr(base64_encode($mime), '+/', '-_'), '=')];
  if (!empty($options['threadId']) && preg_match('/^[0-9a-f]{6,40}$/i', (string)$options['threadId'])) $envoi['threadId'] = (string)$options['threadId'];
  $r = google_api('POST', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', $envoi);
  return ['id' => (string)($r['id'] ?? ''), 'fil' => (string)($r['threadId'] ?? ''), 'de' => $compte];
}
