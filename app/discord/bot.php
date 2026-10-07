<?php
/* =========================================================
   DISCORD — bot « BDA Bot » du serveur de la direction (BSG)
   Autorisé par le gérant le 07/10/2026 : alertes détaillées, dossiers clients et agents,
   coffre-fort, panel de commande. Les papiers des agents restent sur le serveur :
   Discord ne reçoit qu'un lien privé valable 10 minutes.
   - Jeton du bot dans le .env privé (DISCORD_BOT_TOKEN), jamais dans le code.
   - Salons, rôle et messages fixes retrouvés par leur nom : réinstallation sans doublon.
   Ce fichier : appels à l'API Discord, réglages enregistrés, mise en forme des messages.
   ========================================================= */
declare(strict_types=1);

require_once __DIR__ . '/../veille/outils.php';

const DC_APP_ID = '1557209913946537984';
const DC_CLE_PUBLIQUE = 'c4dc147408c94cb96389862debbc721f535ba09c612b8df77cf6d9be3af38bd5';
const DC_SITE = 'https://bdasecurite.com';
const DC_ADMIN = 'https://bdasecurite.com/admin/#/';
// Couleurs (charte noir & or)
const DC_OR = 0xC9A66B;
const DC_VERT = 0x5CC895;
const DC_ROUGE = 0xE5675E;
const DC_ORANGE = 0xE0A458;
const DC_GRIS = 0x8F887D;
const DC_BLEU = 0x7FA7D9;
// Permissions (bits Discord)
const DC_P_REACTIONS = 1 << 6;
const DC_P_VOIR = 1 << 10;
const DC_P_ECRIRE = 1 << 11;
const DC_P_GERER_MESSAGES = 1 << 13;
const DC_P_LIENS = 1 << 14;
const DC_P_FICHIERS = 1 << 15;
const DC_P_HISTORIQUE = 1 << 16;
const DC_P_COMMANDES = 1 << 31;
const DC_P_GERER_FILS = 1 << 34;
const DC_P_CREER_FILS = 1 << 35;
const DC_P_ECRIRE_FILS = 1 << 38;
// Permissions du bot sur le serveur : salons, rôles, serveur, messages, fils, épingles (sans « Administrateur »)
const DC_PERMISSIONS_BOT = '2252197903985776';

const DC_STATUTS = [
  'nouvelle' => 'Nouvelle', 'traitee' => 'Traitée', 'archivee' => 'Archivée',
  'brouillon' => 'Brouillon', 'envoye' => 'Envoyé', 'accepte' => 'Accepté', 'refuse' => 'Refusé',
  'envoyee' => 'Envoyée', 'payee' => 'Payée', 'annulee' => 'Annulée',
  'en_cours' => 'En cours', 'retenue' => 'Retenue', 'refusee' => 'Refusée',
  'attente' => 'En attente', 'publie' => 'Publié', 'confirmee' => 'Confirmée', 'terminee' => 'Terminée',
  'actif' => 'Actif', 'bloque' => 'Suspendu', 'acceptee' => 'Acceptée',
  'nouveau' => 'Nouveau', 'lu' => 'Lu', 'traite' => 'Traité',
  'a_traiter' => 'À traiter', 'contacte' => 'Contacté', 'ignore' => 'Ignoré',
  'robot' => 'Robot', 'equipe' => 'Équipe', 'close' => 'Close',
];
function dc_statut(string $s): string
{
  return DC_STATUTS[$s] ?? $s;
}

/* ---------- Jeton, administrateurs, lien d'autorisation ---------- */
function dc_jeton(): string
{
  return veille_env('DISCORD_BOT_TOKEN');
}
function dc_admins(): array
{
  return array_values(array_filter(array_map('trim', explode(',', veille_env('DISCORD_ADMIN_IDS')))));
}
function dc_cle_publique(): string
{
  return veille_env('DISCORD_CLE_PUBLIQUE') ?: DC_CLE_PUBLIQUE; // remplaçable pour les tests sur ordinateur
}
function dc_lien_autorisation(string $guild = ''): string
{
  return 'https://discord.com/oauth2/authorize?client_id=' . DC_APP_ID . '&scope=bot%20applications.commands&permissions=' . DC_PERMISSIONS_BOT
    . ($guild !== '' ? '&guild_id=' . $guild . '&disable_guild_select=true' : '');
}

/* ---------- Appels à l'API Discord ---------- */
// $corps : tableau (JSON), chaîne (corps brut, ex. '' pour un PUT vide) ou null
function dc_api(string $methode, string $chemin, $corps = null, array $opts = []): array
{
  $avecJeton = empty($opts['sans_jeton']);
  $jeton = $opts['jeton'] ?? dc_jeton();
  if ($avecJeton && $jeton === '') return ['ok' => false, 'code' => 0, 'json' => null, 'erreur' => 'Jeton du bot non configuré (admin > Notifications > Discord).'];
  $entetes = ['User-Agent: DiscordBot (https://bdasecurite.com, 1.0)', 'Accept: application/json'];
  if ($avecJeton) $entetes[] = 'Authorization: Bot ' . $jeton;
  if (!empty($opts['raison'])) $entetes[] = 'X-Audit-Log-Reason: ' . rawurlencode((string)$opts['raison']);
  $brut = null;
  if (is_array($corps)) {
    $entetes[] = 'Content-Type: application/json';
    $brut = json_encode($corps, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
  } elseif (is_string($corps)) {
    $brut = $corps;
  }
  $base = rtrim(veille_env('DISCORD_API_BASE') ?: 'https://discord.com/api/v10', '/');
  for ($essai = 0; $essai < 3; $essai++) {
    try {
      $r = veille_http($methode, $base . $chemin, $entetes, $brut, (int)($opts['delai'] ?? 15));
    } catch (Throwable $e) {
      return ['ok' => false, 'code' => 0, 'json' => null, 'erreur' => 'Discord injoignable : ' . $e->getMessage()];
    }
    $j = json_decode($r['corps'], true);
    if ($r['code'] === 429) {
      $attente = (float)($j['retry_after'] ?? ($r['entetes']['retry-after'] ?? 1));
      if ($attente > 10) return ['ok' => false, 'code' => 429, 'json' => $j, 'erreur' => 'Discord limite les envois : nouvel essai plus tard.'];
      usleep((int)(max($attente, 0.25) * 1e6) + 150000);
      continue;
    }
    $ok = $r['code'] >= 200 && $r['code'] < 300;
    return ['ok' => $ok, 'code' => $r['code'], 'json' => $j, 'erreur' => $ok ? '' : dc_erreur($r['code'], $j)];
  }
  return ['ok' => false, 'code' => 429, 'json' => null, 'erreur' => 'Discord limite les envois : nouvel essai plus tard.'];
}
function dc_erreur(int $code, $j): string
{
  $msg = is_array($j) ? (string)($j['message'] ?? '') : '';
  $detail = is_array($j) && isset($j['errors']) ? ' ' . mb_substr((string)json_encode($j['errors'], JSON_UNESCAPED_UNICODE), 0, 300) : '';
  return match ($code) {
    401 => 'Jeton du bot refusé par Discord (régénéré ? recollez-le dans l’admin > Notifications).',
    403 => "Permission manquante pour le bot ($msg).",
    404 => "Introuvable sur Discord ($msg).",
    default => "Discord a répondu HTTP $code : $msg$detail",
  };
}

/* ---------- Réglages du serveur (identifiants des salons, rôle, messages fixes) ---------- */
function dc_config(): array
{
  if (isset($GLOBALS['__dc_config'])) return $GLOBALS['__dc_config'];
  $st = db()->prepare("SELECT v FROM reglages WHERE k = 'discord'");
  $st->execute();
  $c = json_decode((string)$st->fetchColumn(), true);
  return $GLOBALS['__dc_config'] = is_array($c) ? $c : [];
}
function dc_config_maj(array $maj): array
{
  $c = array_replace(dc_config(), $maj);
  db()->prepare("INSERT INTO reglages (k, v) VALUES ('discord', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")->execute([json_encode($c, JSON_UNESCAPED_UNICODE)]);
  return $GLOBALS['__dc_config'] = $c;
}
function dc_pret(): bool
{
  return dc_jeton() !== '' && !empty(dc_config()['salons']);
}
function dc_salon(string $cle): string
{
  return (string)(dc_config()['salons'][$cle] ?? '');
}

/* ---------- Envoi et modification de messages ---------- */
function dc_envoyer(string $salon, array $message): array
{
  $canal = dc_salon($salon);
  if ($canal === '') return ['ok' => false, 'id' => '', 'code' => 0, 'erreur' => "Salon « $salon » absent : lancez l’installation du serveur."];
  return dc_envoyer_canal($canal, $message);
}
function dc_envoyer_canal(string $canal, array $message): array
{
  $r = dc_api('POST', "/channels/$canal/messages", dc_message($message));
  return ['ok' => $r['ok'], 'id' => (string)($r['json']['id'] ?? ''), 'code' => $r['code'], 'erreur' => $r['erreur']];
}
function dc_modifier(string $canal, string $id, array $message): array
{
  $r = dc_api('PATCH', "/channels/$canal/messages/$id", dc_message($message));
  return ['ok' => $r['ok'], 'id' => $id, 'code' => $r['code'], 'erreur' => $r['erreur']];
}
function dc_epingler(string $canal, string $id): void
{
  $r = dc_api('PUT', "/channels/$canal/messages/pins/$id", '');
  if (!$r['ok'] && $r['code'] === 404) dc_api('PUT', "/channels/$canal/pins/$id", '');
}
// Normalise un message : aucune mention involontaire, limites de Discord respectées
function dc_message(array $m): array
{
  if (!isset($m['allowed_mentions'])) $m['allowed_mentions'] = ['parse' => []];
  if (isset($m['content'])) $m['content'] = dc_couper((string)$m['content'], 2000);
  if (!empty($m['embeds'])) $m['embeds'] = dc_embeds_limites($m['embeds']);
  if (array_key_exists('components', $m) && $m['components'] === []) $m['components'] = [];
  return $m;
}
function dc_embeds_limites(array $embeds): array
{
  $embeds = array_slice(array_values($embeds), 0, 10);
  $total = 0;
  foreach ($embeds as $i => &$e) {
    foreach (['title' => 256, 'description' => 4096] as $k => $max) if (isset($e[$k])) $e[$k] = dc_couper((string)$e[$k], $max);
    if (isset($e['author']['name'])) $e['author']['name'] = dc_couper((string)$e['author']['name'], 256);
    if (isset($e['footer']['text'])) $e['footer']['text'] = dc_couper((string)$e['footer']['text'], 2048);
    if (!empty($e['fields'])) {
      $e['fields'] = array_slice(array_values($e['fields']), 0, 25);
      foreach ($e['fields'] as &$f) {
        $f['name'] = dc_couper((string)$f['name'], 256) ?: '—';
        $f['value'] = dc_couper((string)$f['value'], 1024) ?: '—';
      }
      unset($f);
    }
    $taille = mb_strlen($e['title'] ?? '') + mb_strlen($e['description'] ?? '') + mb_strlen($e['author']['name'] ?? '') + mb_strlen($e['footer']['text'] ?? '');
    foreach ($e['fields'] ?? [] as $f) $taille += mb_strlen($f['name']) + mb_strlen($f['value']);
    // au-delà de 6 000 caractères pour l'ensemble du message, on raccourcit la description puis on s'arrête
    if ($total + $taille > 5900) {
      $reste = 5900 - $total - ($taille - mb_strlen($e['description'] ?? ''));
      if ($reste > 200 && isset($e['description'])) {
        $e['description'] = dc_couper((string)$e['description'], $reste);
        $total = 5900;
        $embeds = array_slice($embeds, 0, $i + 1);
        break;
      }
      $embeds = array_slice($embeds, 0, max(1, $i));
      break;
    }
    $total += $taille;
  }
  unset($e);
  return array_values($embeds);
}

/* ---------- Textes ---------- */
function dc_couper(string $s, int $max): string
{
  $s = trim($s);
  return mb_strlen($s) > $max ? rtrim(mb_substr($s, 0, $max - 1)) . '…' : $s;
}
// Neutralise la mise en forme Discord d'un texte saisi par un visiteur ou un client
function dc_echap(string $s): string
{
  $s = (string)preg_replace('/([\\\\*_~`|>\[\]])/u', '\\\\$1', $s);
  return (string)preg_replace('/^([#\-])/mu', '\\\\$1', $s);
}
function dc_txt($s, int $max = 1000): string
{
  return dc_echap(dc_couper((string)$s, $max));
}
function dc_eur(float $n): string
{
  return number_format($n, abs($n - round($n)) < 0.005 ? 0 : 2, ',', ' ') . ' €';
}
// Horodatage affiché par Discord à l'heure du téléphone (f = date et heure, d = date, R = « il y a 5 min »)
function dc_quand(string $date, string $style = 'f'): string
{
  if (trim($date) === '') return '—';
  $t = strtotime($date);
  return $t ? '<t:' . $t . ':' . $style . '>' : $date;
}
function dc_jour(string $date): string
{
  $t = strtotime($date);
  return $t ? date('d/m/Y', $t) : '—';
}
// J-3, J+2, aujourd'hui
function dc_jx(string $date): string
{
  if (trim($date) === '') return '';
  $j = (int)floor((strtotime(substr($date, 0, 10)) - strtotime(date('Y-m-d'))) / 86400);
  return $j === 0 ? "aujourd'hui" : ($j > 0 ? "J-$j" : 'J+' . (-$j));
}
function dc_duree(int $minutes): string
{
  return sprintf('%dh%02d', intdiv($minutes, 60), $minutes % 60);
}

/* ---------- Mise en forme : cartes, boutons, menus ---------- */
function dc_champ(string $nom, $valeur, bool $ligne = true): array
{
  $v = trim((string)$valeur);
  return ['name' => dc_couper($nom, 256), 'value' => $v === '' ? '—' : dc_couper($v, 1024), 'inline' => $ligne];
}
// $o : entete, titre, url, texte, champs, couleur, pied, quand (false = sans heure), image
function dc_carte(array $o): array
{
  $e = [];
  if (!empty($o['entete'])) $e['author'] = ['name' => dc_couper(mb_strtoupper((string)$o['entete']), 256)];
  if (!empty($o['titre'])) $e['title'] = dc_couper((string)$o['titre'], 256);
  if (!empty($o['url'])) $e['url'] = (string)$o['url'];
  if (isset($o['texte']) && trim((string)$o['texte']) !== '') $e['description'] = dc_couper((string)$o['texte'], 4096);
  if (!empty($o['champs'])) $e['fields'] = array_values(array_filter($o['champs']));
  $e['color'] = $o['couleur'] ?? DC_OR;
  $e['footer'] = ['text' => dc_couper((string)($o['pied'] ?? 'BDA Security Group'), 2048)];
  if (($o['quand'] ?? true) !== false) $e['timestamp'] = gmdate('c', is_int($o['quand'] ?? null) ? $o['quand'] : time());
  return $e;
}
// styles : 1 doré-bleu (principal), 2 gris, 3 vert, 4 rouge
function dc_bouton(string $libelle, string $id, int $style = 2, bool $inactif = false): array
{
  return ['type' => 2, 'style' => $style, 'label' => dc_couper($libelle, 80), 'custom_id' => substr($id, 0, 100), 'disabled' => $inactif];
}
function dc_lien(string $libelle, string $url): array
{
  return ['type' => 2, 'style' => 5, 'label' => dc_couper($libelle, 80), 'url' => $url];
}
// Rangées de boutons (5 par rangée, 5 rangées au plus)
function dc_lignes(array $boutons): array
{
  $l = [];
  foreach (array_chunk(array_values(array_filter($boutons)), 5) as $g) $l[] = ['type' => 1, 'components' => $g];
  return $l;
}
// Menu déroulant (25 choix au plus)
function dc_liste(string $id, string $texte, array $options): array
{
  return ['type' => 1, 'components' => [['type' => 3, 'custom_id' => substr($id, 0, 100), 'placeholder' => dc_couper($texte, 150), 'options' => array_slice(array_values($options), 0, 25)]]];
}
function dc_option(string $libelle, string $valeur, string $detail = ''): array
{
  $o = ['label' => dc_couper($libelle !== '' ? $libelle : '—', 100), 'value' => substr($valeur, 0, 100)];
  if (trim($detail) !== '') $o['description'] = dc_couper($detail, 100);
  return $o;
}
function dc_composants(array ...$groupes): array
{
  return array_slice(array_merge(...$groupes), 0, 5);
}

/* ---------- Messages fixes (panel, tableau de bord, annuaires…) : modifiés sur place ---------- */
function dc_marquer(array $m, string $cle): array
{
  if (!empty($m['embeds'])) {
    $n = count($m['embeds']) - 1;
    $m['embeds'][$n]['footer'] = ['text' => 'BDA Security Group · réf. ' . $cle];
  }
  return $m;
}
function dc_retrouver(string $canal, string $cle): string
{
  $bot = (string)(dc_config()['bot'] ?? '');
  $r = dc_api('GET', "/channels/$canal/messages?limit=50");
  foreach ((array)($r['json'] ?? []) as $m) {
    if (!is_array($m) || ($bot !== '' && ($m['author']['id'] ?? '') !== $bot)) continue;
    foreach ((array)($m['embeds'] ?? []) as $e) {
      if (str_ends_with((string)($e['footer']['text'] ?? ''), 'réf. ' . $cle)) return (string)$m['id'];
    }
  }
  return '';
}
// Publie ou met à jour le message fixe $cle dans le salon $salon ; renvoie son identifiant
function dc_fixe(string $cle, string $salon, array $message, bool $epingler = false): string
{
  $canal = dc_salon($salon);
  if ($canal === '') return '';
  $message = dc_marquer($message, $cle);
  $fixes = dc_config()['fixes'] ?? [];
  $f = $fixes[$cle] ?? null;
  if (is_array($f) && ($f['canal'] ?? '') === $canal && !empty($f['id'])) {
    $r = dc_modifier($canal, (string)$f['id'], $message);
    if ($r['ok'] || $r['code'] !== 404) return (string)$f['id'];
  }
  $id = dc_retrouver($canal, $cle);
  if ($id !== '') {
    dc_modifier($canal, $id, $message);
  } else {
    $r = dc_envoyer_canal($canal, $message);
    $id = $r['id'];
    if ($id !== '' && $epingler) dc_epingler($canal, $id);
  }
  if ($id !== '') {
    $fixes = dc_config()['fixes'] ?? [];
    $fixes[$cle] = ['canal' => $canal, 'id' => $id];
    dc_config_maj(['fixes' => $fixes]);
  }
  return $id;
}
// Supprime les messages fixes d'une série devenus inutiles (ex. annuaire plus court qu'avant)
function dc_fixes_nettoyer(string $prefixe, int $garder): void
{
  $fixes = dc_config()['fixes'] ?? [];
  $change = false;
  foreach ($fixes as $cle => $f) {
    if (!str_starts_with($cle, $prefixe . '-')) continue;
    $n = (int)substr($cle, strlen($prefixe) + 1);
    if ($n <= $garder) continue;
    dc_api('DELETE', "/channels/{$f['canal']}/messages/{$f['id']}");
    unset($fixes[$cle]);
    $change = true;
  }
  if ($change) dc_config_maj(['fixes' => $fixes]);
}
// Découpe des lignes en blocs de description (≤ $max caractères)
function dc_paquets(array $lignes, int $max = 3900): array
{
  $blocs = [];
  $b = '';
  foreach ($lignes as $l) {
    $l = (string)$l;
    if ($b !== '' && mb_strlen($b) + mb_strlen($l) + 1 > $max) { $blocs[] = $b; $b = ''; }
    $b .= ($b === '' ? '' : "\n") . dc_couper($l, $max);
  }
  if ($b !== '') $blocs[] = $b;
  return $blocs;
}

/* ---------- Liens privés vers un document (le fichier reste sur le serveur) ---------- */
function dc_lien_prive(string $type, string $ref, string $libelle, int $duree = 600): string
{
  $jeton = bin2hex(random_bytes(24));
  db()->prepare('INSERT INTO liens_prives (jeton, type, ref, libelle, expire, cree) VALUES (?, ?, ?, ?, ?, ?)')
    ->execute([hash('sha256', $jeton), $type, $ref, mb_substr($libelle, 0, 200), time() + $duree, maintenant()]);
  if (random_int(1, 20) === 1) db()->prepare('DELETE FROM liens_prives WHERE expire < ?')->execute([time() - 86400]);
  return DC_SITE . '/api/lien.php?k=' . $jeton;
}

/* ---------- Requêtes ---------- */
function dc_q(string $sql, array $p = []): array
{
  $st = db()->prepare($sql);
  $st->execute($p);
  return $st->fetchAll();
}
function dc_un(string $sql, array $p = []): ?array
{
  $st = db()->prepare($sql);
  $st->execute($p);
  $r = $st->fetch();
  return $r ?: null;
}
function dc_n(string $sql, array $p = []): float
{
  $st = db()->prepare($sql);
  $st->execute($p);
  return (float)$st->fetchColumn();
}
