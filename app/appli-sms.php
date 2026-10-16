<?php
/* =========================================================
   APPLI BDASH — connexion par numéro de téléphone (code reçu par SMS)
   - Envoi des SMS par l'API OVH (crédits SMS achetés par le gérant sur son compte OVH).
   - Les 4 clés OVH sont dans le fichier privé .env (hors du site), collées par le gérant dans
     Admin > Appli BDASH > Paramètres de l'appli. Elles ne sont jamais réaffichées.
   - Sur le PC de test (BDA_NO_MAIL), aucun SMS ne part : il est copié dans le journal des e-mails.
   ========================================================= */
require_once __DIR__ . '/veille/outils.php';

const APPLI_SMS_CLES = ['OVH_SMS_AK', 'OVH_SMS_AS', 'OVH_SMS_CK', 'OVH_SMS_SERVICE'];

// Numéro au format international (+33612345678) ; '' si le numéro n'est pas valable
function tel_e164(string $saisie): string
{
  $s = preg_replace('/[\s.\-()]/', '', $saisie);
  if (str_starts_with($s, '00')) $s = '+' . substr($s, 2);
  if (preg_match('/^0[1-9]\d{8}$/', $s)) $s = '+33' . substr($s, 1);
  if (preg_match('/^\+33(0?)([1-9]\d{8})$/', $s, $m)) $s = '+33' . $m[2];
  return preg_match('/^\+[1-9]\d{7,14}$/', $s) ? $s : '';
}
// Numéro lisible (06 12 34 56 78 pour la France)
function tel_lisible_e164(string $e164): string
{
  if (preg_match('/^\+33([1-9])(\d{2})(\d{2})(\d{2})(\d{2})$/', $e164, $m)) return "0$m[1] $m[2] $m[3] $m[4] $m[5]";
  return $e164;
}
function appli_sms_actif(): bool
{
  if (getenv('BDA_NO_MAIL')) return true;
  foreach (APPLI_SMS_CLES as $k) if (veille_env($k) === '') return false;
  return true;
}
// Envoie un SMS ; lève une exception si OVH refuse
function appli_sms_envoyer(string $e164, string $texte): void
{
  if (getenv('BDA_NO_MAIL')) {
    if ($j = getenv('BDA_MAIL_LOG')) @file_put_contents($j, '=== ' . date('c') . " → SMS $e164\n$texte\n\n", FILE_APPEND);
    return;
  }
  [$ak, $as, $ck, $service] = array_map('veille_env', APPLI_SMS_CLES);
  if ($ak === '' || $as === '' || $ck === '' || $service === '') throw new RuntimeException('SMS non réglés.');
  // l'horloge d'OVH sert à signer la demande (écart gardé pour la durée de la requête)
  static $ecart = null;
  if ($ecart === null) {
    $r = veille_http('GET', 'https://eu.api.ovh.com/1.0/auth/time', [], null, 8);
    $ecart = $r['code'] === 200 && is_numeric(trim($r['corps'])) ? (int)trim($r['corps']) - time() : 0;
  }
  $url = 'https://eu.api.ovh.com/1.0/sms/' . rawurlencode($service) . '/jobs';
  // senderForResponse : envoi depuis un numéro court d'OVH, sans attendre la validation d'un nom d'expéditeur
  $corps = json_encode(['message' => $texte, 'receivers' => [$e164], 'senderForResponse' => true, 'noStopClause' => true, 'priority' => 'high', 'charset' => 'UTF-8', 'coding' => '7bit', 'validityPeriod' => 15], JSON_UNESCAPED_UNICODE);
  $ts = (string)(time() + $ecart);
  $sig = '$1$' . sha1($as . '+' . $ck . '+POST+' . $url . '+' . $corps . '+' . $ts);
  $r = veille_http('POST', $url, ['Content-Type: application/json', 'X-Ovh-Application: ' . $ak, 'X-Ovh-Consumer: ' . $ck, 'X-Ovh-Timestamp: ' . $ts, 'X-Ovh-Signature: ' . $sig], $corps, 15);
  $j = json_decode($r['corps'], true);
  if ($r['code'] !== 200 || !empty($j['invalidReceivers'])) {
    journal('vtc', 'Appli : SMS refusé par OVH (code ' . $r['code'] . ')');
    throw new RuntimeException('SMS refusé (' . ($j['message'] ?? $r['code']) . ').');
  }
}

// Envoie un code à 6 chiffres (valable 10 minutes, 5 essais) ; limites : 1 envoi / 45 s et 5 / heure par numéro
function appli_code_envoyer(string $e164): void
{
  $st = db()->prepare('SELECT * FROM appli_codes WHERE tel = ?');
  $st->execute([$e164]);
  $r = $st->fetch() ?: null;
  $heure = $r && $r['fenetre'] > date('Y-m-d H:i:s', time() - 3600);
  if ($r && $r['dernier'] > date('Y-m-d H:i:s', time() - 45)) echec('Un code vient de partir. Patientez quelques secondes avant d’en demander un autre.', 429);
  if ($heure && (int)$r['envois'] >= 5) echec('Trop de codes demandés pour ce numéro. Réessayez dans une heure.', 429);
  $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
  try { appli_sms_envoyer($e164, "BDASH : votre code est $code. Il expire dans 10 minutes. Ne le donnez à personne."); }
  catch (Throwable $e) { echec('Le SMS n’a pas pu partir. Vérifiez le numéro ou réessayez dans un instant.', 502); }
  db()->prepare("INSERT INTO appli_codes (tel, code, expire, essais, envois, fenetre, dernier, ticket, ticket_expire) VALUES (?, ?, ?, 0, 1, ?, ?, '', '')
    ON CONFLICT(tel) DO UPDATE SET code = excluded.code, expire = excluded.expire, essais = 0, envois = CASE WHEN appli_codes.fenetre > ? THEN appli_codes.envois + 1 ELSE 1 END,
    fenetre = CASE WHEN appli_codes.fenetre > ? THEN appli_codes.fenetre ELSE excluded.fenetre END, dernier = excluded.dernier, ticket = '', ticket_expire = ''")
    ->execute([$e164, hash('sha256', $e164 . '|' . $code), date('Y-m-d H:i:s', time() + 600), maintenant(), maintenant(), date('Y-m-d H:i:s', time() - 3600), date('Y-m-d H:i:s', time() - 3600)]);
}
// Vérifie le code ; renvoie un ticket (30 min) qui prouve que le numéro est bien à cette personne
function appli_code_verifier(string $e164, string $code): string
{
  $st = db()->prepare('SELECT * FROM appli_codes WHERE tel = ?');
  $st->execute([$e164]);
  $r = $st->fetch();
  if (!$r || $r['code'] === '' || $r['expire'] < maintenant()) echec('Ce code a expiré. Demandez-en un nouveau.', 410);
  if ((int)$r['essais'] >= 5) echec('Trop d’essais. Demandez un nouveau code.', 429);
  if (!hash_equals((string)$r['code'], hash('sha256', $e164 . '|' . preg_replace('/\D/', '', $code)))) {
    db()->prepare('UPDATE appli_codes SET essais = essais + 1 WHERE tel = ?')->execute([$e164]);
    usleep(300000);
    echec('Code incorrect. Vérifiez le SMS reçu.', 401);
  }
  $ticket = bin2hex(random_bytes(24));
  db()->prepare("UPDATE appli_codes SET code = '', ticket = ?, ticket_expire = ? WHERE tel = ?")->execute([hash('sha256', $ticket), date('Y-m-d H:i:s', time() + 1800), $e164]);
  return $ticket;
}
// Ticket donné par appli_code_verifier : valable une seule fois, pour créer le compte de ce numéro
function appli_ticket_tel(string $e164, string $ticket): void
{
  $st = db()->prepare('SELECT ticket, ticket_expire FROM appli_codes WHERE tel = ?');
  $st->execute([$e164]);
  $r = $st->fetch();
  if (!$r || $r['ticket'] === '' || $r['ticket_expire'] < maintenant() || !hash_equals((string)$r['ticket'], hash('sha256', $ticket))) {
    echec('La vérification du numéro a expiré. Recommencez avec un nouveau code.', 410);
  }
}
