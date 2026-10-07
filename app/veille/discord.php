<?php
/* =========================================================
   VEILLE — messages Discord (webhook rangé dans le .env privé)
   Limites respectées : 10 embeds et 6 000 caractères par message,
   attente et nouvel essai en cas de réponse 429 (trop de messages).
   ========================================================= */
declare(strict_types=1);

const DISCORD_OR = 0xC9A66B;      // doré
const DISCORD_ROUGE = 0xE5675E;   // rappel J-3
const DISCORD_VERT = 0x5CC895;    // très pertinent
const DISCORD_GRIS = 0x8F887D;

function discord_tronquer(string $s, int $max): string
{
  $s = trim($s);
  return mb_strlen($s) > $max ? rtrim(mb_substr($s, 0, $max - 1)) . '…' : $s;
}
// Taille comptée par Discord pour un embed (titre, description, champs, pied, auteur)
function discord_taille(array $e): int
{
  $n = mb_strlen($e['title'] ?? '') + mb_strlen($e['description'] ?? '') + mb_strlen($e['footer']['text'] ?? '') + mb_strlen($e['author']['name'] ?? '');
  foreach ($e['fields'] ?? [] as $f) $n += mb_strlen($f['name']) + mb_strlen($f['value']);
  return $n;
}
function discord_date(string $d): string
{
  if ($d === '') return '—';
  $ts = strtotime($d);
  $jours = (int)floor((strtotime(substr($d, 0, 10)) - strtotime(date('Y-m-d'))) / 86400);
  $jx = $jours < 0 ? 'clos' : ($jours === 0 ? "aujourd'hui" : "J-$jours");
  return date('d/m/Y', $ts) . ' à ' . date('H\hi', $ts) . " · **$jx**";
}
// Carte (embed) d'une opportunité
function discord_embed(array $o, string $prefixe = ''): array
{
  $alertes = json_decode((string)$o['alertes'], true) ?: [];
  $niveau = ['fort' => '🟢 Très pertinent', 'moyen' => '🟡 À regarder', 'faible' => '⚪ Faible'][$o['niveau']] ?? '';
  $type = ['securite' => '🛡️ Sécurité', 'chauffeur' => '🚘 Chauffeur', 'recrutement' => '👥 Recrutement'][$o['type']] ?? '';
  $champs = [
    ['name' => 'Acheteur', 'value' => discord_tronquer($o['acheteur'] ?: '—', 256), 'inline' => true],
    ['name' => 'Lieu', 'value' => discord_tronquer($o['lieu'] ?: '—', 256), 'inline' => true],
  ];
  if ($o['source'] === 'boamp') $champs[] = ['name' => 'Date limite', 'value' => discord_date((string)$o['date_limite']), 'inline' => true];
  if ((float)$o['montant'] > 0) $champs[] = ['name' => 'Montant estimé', 'value' => number_format((float)$o['montant'], 0, ',', ' ') . ' € HT', 'inline' => true];
  if ($o['source'] === 'boamp') $champs[] = ['name' => 'Pertinence', 'value' => "$niveau ({$o['score']})", 'inline' => true];
  if ($alertes) $champs[] = ['name' => '⚠️ À savoir', 'value' => discord_tronquer(implode(' · ', $alertes), 1024), 'inline' => false];
  $lien = $o['url'] ?: 'https://bdasecurite.com/admin/#/opportunites';
  return [
    'title' => discord_tronquer($prefixe . $o['titre'], 256),
    'url' => $lien,
    'description' => discord_tronquer(trim($type . ($o['nature'] ? ' · ' . $o['nature'] : '')), 300) . "\n[Ouvrir dans l'admin](https://bdasecurite.com/admin/#/opportunites/{$o['id']})" . ($o['url_dossier'] ? " · [Dossier de consultation]({$o['url_dossier']})" : ''),
    'color' => $prefixe !== '' ? DISCORD_ROUGE : ($o['niveau'] === 'fort' ? DISCORD_VERT : DISCORD_OR),
    'fields' => $champs,
    'footer' => ['text' => 'BDA Security Group · Veille ' . ($o['source'] === 'boamp' ? 'BOAMP' : 'France Travail')],
    'timestamp' => gmdate('c'),
  ];
}
// Envoie des embeds en respectant les limites (découpe en plusieurs messages si besoin)
function discord_envoyer(array $embeds, string $contenu = ''): array
{
  $url = veille_env('DISCORD_WEBHOOK_URL');
  if ($url === '') return ['ok' => false, 'erreur' => 'Webhook Discord non configuré.'];
  if (!preg_match('#^https://(discord|discordapp)\.com/api/webhooks/\d+/[\w-]+$#', $url)) return ['ok' => false, 'erreur' => 'Adresse de webhook Discord invalide.'];
  $lots = [];
  $lot = [];
  $taille = mb_strlen($contenu);
  foreach ($embeds as $e) {
    $t = discord_taille($e);
    if ($lot && (count($lot) >= 10 || $taille + $t > 5800)) { $lots[] = $lot; $lot = []; $taille = 0; }
    $lot[] = $e;
    $taille += $t;
  }
  if ($lot || $contenu !== '') $lots[] = $lot;
  $envoyes = 0;
  foreach ($lots as $i => $l) {
    $corps = json_encode(array_filter([
      'username' => 'BDA Veille',
      'avatar_url' => 'https://bdasecurite.com/assets/img/icon-192.png',
      'content' => $i === 0 ? $contenu : '',
      'embeds' => $l,
      'allowed_mentions' => ['parse' => []],
    ], fn($v) => $v !== '' && $v !== []), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    for ($essai = 0; $essai < 4; $essai++) {
      $r = veille_http('POST', $url . '?wait=true', ['Content-Type: application/json'], $corps, 20);
      if ($r['code'] === 429) {
        $j = json_decode($r['corps'], true);
        $attente = (float)($j['retry_after'] ?? ($r['entetes']['retry-after'] ?? 2));
        if ($attente > 100) $attente /= 1000; // ancienne API en millisecondes
        usleep((int)(min(max($attente, 0.5), 10) * 1e6));
        continue;
      }
      if ($r['code'] >= 200 && $r['code'] < 300) { $envoyes++; break; }
      return ['ok' => false, 'erreur' => "Discord a refusé le message (HTTP {$r['code']}) : " . mb_substr($r['corps'], 0, 200), 'envoyes' => $envoyes];
    }
    // petite pause entre deux messages (limite : environ 5 messages / 2 s par webhook)
    if ($i < count($lots) - 1) usleep(450000);
  }
  return ['ok' => true, 'envoyes' => $envoyes];
}
