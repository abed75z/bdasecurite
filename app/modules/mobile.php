<?php
/* =========================================================
   MODULE « MOBILE » — l'appli iPhone « BDA Équipe » (App Store)
   L'appli affiche l'Espace équipe (bdasecurite.com/espace-equipe) dans une coque native
   (Capacitor, identifiant com.bdasecurite.equipe), avec en plus :
   - les notifications natives d'Apple (APNs) : chaque iPhone enregistre son jeton ici ;
     l'envoi utilise la clé .p8 « Apple Push Notifications » créée par le gérant et collée
     dans l'admin (APNS_KEY_ID, APNS_KEY_P8 dans le .env privé, équipe 9U2RH4864B) ;
   - le mode hors ligne (géré dans l'appli : planning, consignes et carte gardés sur le téléphone).
   Notifications envoyées : « Tout va bien ? » (module presence), nouveau poste au planning,
   postes à prendre (bourse), nouvelles consignes, et les messages écrits par la direction.
   Les envois automatiques se règlent dans l'admin (page « Appli BDA Équipe »).
   - Suppression de compte depuis l'appli (règle de l'App Store) : l'accès à l'Espace équipe
     est supprimé ; le dossier de l'agent (contrat, paie) est conservé, comme la loi l'impose.
   ========================================================= */
declare(strict_types=1);

const MOD_MOBILE_APPLI = 'com.bdasecurite.equipe';
const MOD_MOBILE_EQUIPE_APPLE = '9U2RH4864B';
const MOD_MOBILE_AUTO = ['planning' => true, 'bourse' => true, 'consignes' => true];

function module_mobile(): array
{
  return [
    'titre' => 'Appli BDA Équipe',
    'schema' => [
      1 => <<<'SQL'
        CREATE TABLE IF NOT EXISTS m_mobile_jetons (id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL, compte_id INTEGER NOT NULL DEFAULT 0,
          plateforme TEXT NOT NULL DEFAULT 'ios', jeton TEXT NOT NULL UNIQUE, appareil TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL,
          vu TEXT NOT NULL DEFAULT '', echecs INTEGER NOT NULL DEFAULT 0);
        CREATE INDEX IF NOT EXISTS i_m_mobile_agent ON m_mobile_jetons (agent_id);
        CREATE TABLE IF NOT EXISTS m_mobile_envois (id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL, type TEXT NOT NULL, titre TEXT NOT NULL,
          texte TEXT NOT NULL DEFAULT '', appareils INTEGER NOT NULL DEFAULT 0, par TEXT NOT NULL DEFAULT '', quand TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS i_m_mobile_envois ON m_mobile_envois (quand);
        SQL,
      // messagerie agent ↔ direction (texte et photo)
      2 => <<<'SQL'
        CREATE TABLE IF NOT EXISTS m_mobile_messages (id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL, auteur TEXT NOT NULL,
          texte TEXT NOT NULL DEFAULT '', photo TEXT NOT NULL DEFAULT '', photo_mime TEXT NOT NULL DEFAULT '', lu INTEGER NOT NULL DEFAULT 0,
          par TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS i_m_mobile_msg_agent ON m_mobile_messages (agent_id, id);
        CREATE INDEX IF NOT EXISTS i_m_mobile_msg_lu ON m_mobile_messages (auteur, lu);
        SQL,
    ],
    'admin' => [
      'etat' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_mobile_adm_etat'],
      'cle.enregistrer' => ['methode' => 'POST', 'roles' => ['admin'], 'fn' => 'mod_mobile_adm_cle'],
      'reglages.enregistrer' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_mobile_adm_reglages'],
      'envoyer' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_mobile_adm_envoyer'],
      'conversations' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_mobile_adm_conversations'],
      'conversation' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_mobile_adm_conversation'],
      'repondre' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_mobile_adm_repondre'],
      'photo' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_mobile_adm_photo'],
    ],
    'equipe' => [
      'push.inscrire' => ['methode' => 'POST', 'fn' => 'mod_mobile_eq_inscrire'],
      'push.retirer' => ['methode' => 'POST', 'fn' => 'mod_mobile_eq_retirer'],
      'compte' => ['methode' => 'GET', 'fn' => 'mod_mobile_eq_compte'],
      'compte.supprimer' => ['methode' => 'POST', 'fn' => 'mod_mobile_eq_supprimer'],
      'messages' => ['methode' => 'GET', 'fn' => 'mod_mobile_eq_messages'],
      'message.envoyer' => ['methode' => 'POST', 'fn' => 'mod_mobile_eq_envoyer'],
      'message.photo' => ['methode' => 'GET', 'fn' => 'mod_mobile_eq_photo'],
      'messages.nonlus' => ['methode' => 'GET', 'fn' => 'mod_mobile_eq_nonlus'],
      'horsligne' => ['methode' => 'GET', 'fn' => 'mod_mobile_eq_horsligne'],
    ],
    'compteurs' => 'mod_mobile_compteurs',
  ];
}

/* =========================================================
   Messagerie agent ↔ direction
   ========================================================= */
const MOD_MOBILE_PHOTO_MAX = 8 * 1048576;
// l'iPhone convertit ses photos HEIC en JPEG à l'envoi
const MOD_MOBILE_PHOTO_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

function mod_mobile_compteurs(): array
{
  return ['messagesAgents' => (int)db()->query("SELECT COUNT(*) FROM m_mobile_messages WHERE auteur = 'agent' AND lu = 0")->fetchColumn()];
}
function mod_mobile_dossier(): string
{
  $d = dossier_donnees() . '/equipe/messages';
  if (!is_dir($d) && !@mkdir($d, 0700, true)) throw new RuntimeException('Espace de stockage indisponible.');
  return $d;
}
function mod_mobile_ligne(array $m): array
{
  return ['id' => (int)$m['id'], 'auteur' => (string)$m['auteur'], 'texte' => (string)$m['texte'], 'photo' => (string)$m['photo'] !== '',
    'lu' => (bool)$m['lu'], 'par' => (string)$m['par'], 'cree' => (string)$m['cree']];
}
function mod_mobile_fil(int $agentId, int $limite = 200): array
{
  $st = db()->prepare('SELECT * FROM (SELECT * FROM m_mobile_messages WHERE agent_id = ? ORDER BY id DESC LIMIT ' . max(1, $limite) . ') ORDER BY id');
  $st->execute([$agentId]);
  return array_map('mod_mobile_ligne', $st->fetchAll());
}
// Photo envoyée avec un message : vérifiée (vraie image, 8 Mo au plus), rangée hors du site
function mod_mobile_photo_recue(): array
{
  $f = $_FILES['photo'] ?? null;
  if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return ['', ''];
  if ($f['error'] !== UPLOAD_ERR_OK || $f['size'] > MOD_MOBILE_PHOTO_MAX) throw new RuntimeException('Photo trop lourde (8 Mo au plus).');
  $mime = type_fichier((string)$f['tmp_name']);
  if (!isset(MOD_MOBILE_PHOTO_TYPES[$mime])) throw new RuntimeException('Envoyez une photo (JPEG, PNG ou WebP).');
  $nom = bin2hex(random_bytes(16)) . '.' . MOD_MOBILE_PHOTO_TYPES[$mime];
  if (!move_uploaded_file($f['tmp_name'], mod_mobile_dossier() . '/' . $nom)) throw new RuntimeException('Envoi de la photo impossible.');
  return [$nom, $mime];
}
function mod_mobile_servir_photo(array $m): never
{
  $chemin = mod_mobile_dossier() . '/' . basename((string)$m['photo']);
  if ($m['photo'] === '' || !is_file($chemin)) echec('Photo introuvable.', 404);
  header('Content-Type: ' . $m['photo_mime']);
  header('Content-Length: ' . filesize($chemin));
  header('Cache-Control: private, max-age=86400');
  header('X-Content-Type-Options: nosniff');
  readfile($chemin);
  exit;
}

function mod_mobile_eq_messages(): void
{
  $c = eq_exiger();
  $aid = (int)$c['agent_id'];
  db()->prepare("UPDATE m_mobile_messages SET lu = 1 WHERE agent_id = ? AND auteur = 'direction' AND lu = 0")->execute([$aid]);
  repondre(['ok' => true, 'messages' => mod_mobile_fil($aid)]);
}
// Carte d'accueil : messages de la direction pas encore lus
function mod_mobile_eq_nonlus(): void
{
  $c = eq_exiger();
  $st = db()->prepare("SELECT COUNT(*) AS n, MAX(id) AS dernier FROM m_mobile_messages WHERE agent_id = ? AND auteur = 'direction' AND lu = 0");
  $st->execute([(int)$c['agent_id']]);
  $r = $st->fetch();
  $texte = '';
  if ((int)$r['n'] > 0) {
    $st = db()->prepare('SELECT texte, photo FROM m_mobile_messages WHERE id = ?');
    $st->execute([(int)$r['dernier']]);
    $m = $st->fetch();
    $texte = $m ? ((string)$m['texte'] !== '' ? mb_substr((string)$m['texte'], 0, 90) : 'Photo') : '';
  }
  repondre(['ok' => true, 'nonLus' => (int)$r['n'], 'dernier' => $texte]);
}
// Ce que l'appli garde sur le téléphone pour l'afficher sans réseau : postes des 14 prochains jours et consignes des sites
function mod_mobile_eq_horsligne(): void
{
  $c = eq_exiger();
  $st = db()->prepare("SELECT v.jour, v.debut, v.fin, v.site_id, s.nom, s.adresse, s.consignes, s.contact FROM vacations v LEFT JOIN sites s ON s.id = v.site_id
      WHERE v.agent_id = ? AND v.jour BETWEEN ? AND ? AND v.statut != 'annulee' ORDER BY v.jour, v.debut LIMIT 60");
  $st->execute([(int)$c['agent_id'], date('Y-m-d'), date('Y-m-d', strtotime('+14 days'))]);
  $postes = [];
  $sites = [];
  foreach ($st->fetchAll() as $v) {
    $postes[] = ['jour' => $v['jour'], 'debut' => $v['debut'], 'fin' => $v['fin'], 'site' => (string)($v['nom'] ?? '')];
    $id = (int)$v['site_id'];
    if ($id && !isset($sites[$id])) $sites[$id] = ['nom' => (string)$v['nom'], 'adresse' => (string)$v['adresse'], 'consignes' => mb_substr((string)$v['consignes'], 0, 6000), 'contact' => (string)$v['contact']];
  }
  repondre(['ok' => true, 'quand' => maintenant(), 'agent' => trim($c['prenom'] . ' ' . $c['nom']), 'postes' => $postes, 'sites' => array_values($sites)]);
}
function mod_mobile_eq_envoyer(): void
{
  $c = eq_exiger();
  $aid = (int)$c['agent_id'];
  if (!limiter('mobile-msg:' . $aid, 60, 3600)) throw new RuntimeException('Beaucoup de messages d’affilée : patientez quelques minutes.');
  $texte = mb_substr(trim((string)($_POST['texte'] ?? (corps()['texte'] ?? ''))), 0, 2000);
  [$photo, $mime] = mod_mobile_photo_recue();
  if ($texte === '' && $photo === '') throw new RuntimeException('Écrivez un message ou joignez une photo.');
  $db = db();
  $db->prepare("INSERT INTO m_mobile_messages (agent_id, auteur, texte, photo, photo_mime, cree) VALUES (?, 'agent', ?, ?, ?, ?)")
    ->execute([$aid, $texte, $photo, $mime, maintenant()]);
  $id = (int)$db->lastInsertId();
  // la direction est prévenue (notification de l'admin), sans le contenu du message
  notifier('equipe', 'Nouveau message d’un agent', 'Un agent vous a écrit' . ($photo ? ' (avec une photo)' : '') . ' dans l’appli BDA Équipe.', '/admin/#/bda-equipe/' . $aid, 'msg-agent-' . $aid);
  $st = $db->prepare('SELECT * FROM m_mobile_messages WHERE id = ?');
  $st->execute([$id]);
  repondre(['ok' => true, 'message' => mod_mobile_ligne($st->fetch())]);
}
function mod_mobile_eq_photo(): void
{
  $c = eq_exiger();
  $st = db()->prepare('SELECT * FROM m_mobile_messages WHERE id = ? AND agent_id = ?');
  $st->execute([(int)($_GET['id'] ?? 0), (int)$c['agent_id']]);
  $m = $st->fetch();
  if (!$m) echec('Photo introuvable.', 404);
  mod_mobile_servir_photo($m);
}
function mod_mobile_adm_conversations(): void
{
  $db = db();
  $liste = $db->query("SELECT m.agent_id, a.nom, a.poste, MAX(m.id) AS dernier, SUM(m.auteur = 'agent' AND m.lu = 0) AS nonlus
      FROM m_mobile_messages m LEFT JOIN agents a ON a.id = m.agent_id GROUP BY m.agent_id ORDER BY dernier DESC")->fetchAll();
  $out = [];
  foreach ($liste as $l) {
    $st = $db->prepare('SELECT * FROM m_mobile_messages WHERE id = ?');
    $st->execute([(int)$l['dernier']]);
    $d = $st->fetch();
    $out[] = ['agent_id' => (int)$l['agent_id'], 'nom' => (string)($l['nom'] ?? 'Agent'), 'poste' => (string)($l['poste'] ?? ''), 'nonLus' => (int)$l['nonlus'],
      'dernier' => $d ? ['auteur' => $d['auteur'], 'texte' => mb_substr((string)$d['texte'], 0, 120), 'photo' => $d['photo'] !== '', 'cree' => $d['cree']] : null];
  }
  // agents joignables (compte Espace équipe actif) pour écrire à quelqu'un qui n'a pas encore de conversation
  $agents = $db->query("SELECT DISTINCT a.id, a.nom, (SELECT COUNT(*) FROM m_mobile_jetons j WHERE j.agent_id = a.id) AS iphone FROM agents a
      JOIN comptes_equipe ce ON ce.agent_id = a.id AND ce.statut = 'actif' WHERE a.actif = 1 ORDER BY a.nom COLLATE NOCASE")->fetchAll();
  repondre(['ok' => true, 'conversations' => $out, 'agents' => array_map(fn ($a) => ['id' => (int)$a['id'], 'nom' => (string)$a['nom'], 'appli' => (int)$a['iphone'] > 0], $agents)]);
}
function mod_mobile_adm_conversation(): void
{
  $aid = (int)($_GET['agent_id'] ?? 0);
  $db = db();
  $st = $db->prepare('SELECT id, nom, poste, tel FROM agents WHERE id = ?');
  $st->execute([$aid]);
  $a = $st->fetch();
  if (!$a) throw new RuntimeException('Agent introuvable.');
  $db->prepare("UPDATE m_mobile_messages SET lu = 1 WHERE agent_id = ? AND auteur = 'agent' AND lu = 0")->execute([$aid]);
  repondre(['ok' => true, 'agent' => ['id' => (int)$a['id'], 'nom' => (string)$a['nom'], 'poste' => (string)$a['poste'], 'tel' => (string)$a['tel'], 'appli' => mobile_nb_appareils($aid) > 0],
    'messages' => mod_mobile_fil($aid)]);
}
function mod_mobile_adm_repondre(): void
{
  $aid = (int)($_POST['agent_id'] ?? (corps()['agent_id'] ?? 0));
  $texte = mb_substr(trim((string)($_POST['texte'] ?? (corps()['texte'] ?? ''))), 0, 2000);
  $st = db()->prepare('SELECT id FROM agents WHERE id = ?');
  $st->execute([$aid]);
  if (!$st->fetchColumn()) throw new RuntimeException('Agent introuvable.');
  [$photo, $mime] = mod_mobile_photo_recue();
  if ($texte === '' && $photo === '') throw new RuntimeException('Écrivez un message.');
  $db = db();
  $db->prepare("INSERT INTO m_mobile_messages (agent_id, auteur, texte, photo, photo_mime, par, cree) VALUES (?, 'direction', ?, ?, ?, ?, ?)")
    ->execute([$aid, $texte, $photo, $mime, (string)($_SESSION['login'] ?? ''), maintenant()]);
  $id = (int)$db->lastInsertId();
  $n = mobile_pousser($aid, 'Message de la direction', $texte !== '' ? $texte : 'Photo envoyée par la direction.', '/espace-equipe#/messages', 'message');
  $st = $db->prepare('SELECT * FROM m_mobile_messages WHERE id = ?');
  $st->execute([$id]);
  repondre(['ok' => true, 'message' => mod_mobile_ligne($st->fetch()), 'notifie' => $n]);
}
function mod_mobile_adm_photo(): void
{
  $st = db()->prepare('SELECT * FROM m_mobile_messages WHERE id = ?');
  $st->execute([(int)($_GET['id'] ?? 0)]);
  $m = $st->fetch();
  if (!$m) echec('Photo introuvable.', 404);
  mod_mobile_servir_photo($m);
}

/* ---------- Réglages ---------- */
function mod_mobile_reglages(): array
{
  $r = mod_reglage('mobile', 'reglages', []);
  $r = is_array($r) ? $r : [];
  $out = [];
  foreach (MOD_MOBILE_AUTO as $k => $def) $out[$k] = array_key_exists($k, $r) ? (bool)$r[$k] : $def;
  return $out;
}
function mod_mobile_configure(): bool
{
  require_once __DIR__ . '/../veille/outils.php';
  return veille_env('APNS_KEY_ID') !== '' && veille_env('APNS_KEY_P8') !== '';
}

/* =========================================================
   Envoi Apple (APNs, HTTP/2, jeton JWT signé ES256 avec la clé .p8)
   ========================================================= */
function mod_mobile_jwt(): string
{
  $cache = mod_reglage('mobile', 'jwt', null);
  if (is_array($cache) && ($cache['quand'] ?? 0) > time() - 45 * 60 && ($cache['kid'] ?? '') === veille_env('APNS_KEY_ID')) return (string)$cache['jeton'];
  require_once __DIR__ . '/../veille/webpush.php';
  $kid = veille_env('APNS_KEY_ID');
  $equipe = veille_env('APNS_TEAM_ID') ?: MOD_MOBILE_EQUIPE_APPLE;
  $cle = openssl_pkey_get_private(veille_env('APNS_KEY_P8'));
  if (!$cle) throw new RuntimeException('Clé Apple (.p8) illisible.');
  $entete = b64u(json_encode(['alg' => 'ES256', 'kid' => $kid]));
  $charge = b64u(json_encode(['iss' => $equipe, 'iat' => time()]));
  if (!openssl_sign("$entete.$charge", $sig, $cle, OPENSSL_ALGO_SHA256)) throw new RuntimeException('Signature Apple impossible.');
  $jeton = "$entete.$charge." . b64u(webpush_der_vers_brut($sig));
  mod_reglage_ecrire('mobile', 'jwt', ['jeton' => $jeton, 'quand' => time(), 'kid' => $kid]);
  return $jeton;
}
// Un envoi vers un iPhone ; renvoie le code HTTP d'Apple (200 = remis)
function mod_mobile_apns(string $jeton, array $charge, int $ttl): array
{
  if (!function_exists('curl_init') || !defined('CURL_HTTP_VERSION_2_0')) throw new RuntimeException('HTTP/2 indisponible sur le serveur.');
  $ch = curl_init('https://api.push.apple.com/3/device/' . $jeton);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_2_0,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_CONNECTTIMEOUT => 6,
    CURLOPT_HTTPHEADER => [
      'authorization: bearer ' . mod_mobile_jwt(),
      'apns-topic: ' . MOD_MOBILE_APPLI,
      'apns-push-type: alert',
      'apns-priority: 10',
      'apns-expiration: ' . (time() + max(60, $ttl)),
      'content-type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode($charge, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
  ]);
  $rep = (string)curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  $raison = (string)(json_decode($rep, true)['reason'] ?? '');
  return [$code, $raison];
}

/* Notification sur les iPhone d'un agent. Renvoie le nombre de téléphones atteints.
   $url : page de l'Espace équipe ouverte quand on touche la notification (ex. /espace-equipe#/presence) */
function mobile_pousser(int $agentId, string $titre, string $texte, string $url = '/espace-equipe', string $type = 'info', int $ttl = 86400): int
{
  if ($agentId <= 0) return 0;
  $db = db();
  $st = $db->prepare("SELECT id, jeton FROM m_mobile_jetons WHERE agent_id = ? AND plateforme = 'ios' ORDER BY id");
  $st->execute([$agentId]);
  $jetons = $st->fetchAll();
  if (!$jetons) return 0;
  $titre = mb_substr(trim($titre), 0, 90);
  $texte = mb_substr(trim((string)preg_replace('/\s+/', ' ', $texte)), 0, 220);
  $ok = 0;
  if (getenv('BDA_NO_MAIL')) { // tests sur ordinateur : rien ne part vraiment (copie dans le journal des mails)
    if ($j = getenv('BDA_MAIL_LOG')) @file_put_contents($j, '=== ' . date('c') . " → APPLI agent n° $agentId (" . count($jetons) . " iPhone, simulé)\n$titre\n$texte\n$url\n\n", FILE_APPEND);
    $ok = count($jetons);
  } elseif (mod_mobile_configure()) {
    $charge = ['aps' => ['alert' => ['title' => $titre, 'body' => $texte], 'sound' => 'default', 'thread-id' => $type], 'url' => $url, 'type' => $type];
    foreach ($jetons as $j) {
      try {
        [$code, $raison] = mod_mobile_apns((string)$j['jeton'], $charge, $ttl);
        if ($code === 200) { $ok++; $db->prepare('UPDATE m_mobile_jetons SET vu = ?, echecs = 0 WHERE id = ?')->execute([maintenant(), $j['id']]); }
        elseif ($code === 410 || in_array($raison, ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'], true)) $db->prepare('DELETE FROM m_mobile_jetons WHERE id = ?')->execute([$j['id']]);
        else { $db->prepare('UPDATE m_mobile_jetons SET echecs = echecs + 1 WHERE id = ?')->execute([$j['id']]); error_log("[BDA module mobile] APNs $code $raison"); }
      } catch (Throwable $e) {
        error_log('[BDA module mobile] envoi : ' . $e->getMessage());
        break;
      }
    }
  }
  $db->prepare('INSERT INTO m_mobile_envois (agent_id, type, titre, texte, appareils, par, quand) VALUES (?, ?, ?, ?, ?, ?, ?)')
    ->execute([$agentId, $type, $titre, $texte, $ok, (string)($_SESSION['login'] ?? ''), maintenant()]);
  return $ok;
}
// Nombre d'iPhone d'un agent qui reçoivent les notifications de l'appli
function mobile_nb_appareils(int $agentId): int
{
  $st = db()->prepare('SELECT COUNT(*) FROM m_mobile_jetons WHERE agent_id = ?');
  $st->execute([$agentId]);
  return (int)$st->fetchColumn();
}
// Envois automatiques (réglables dans l'admin) : planning, bourse, consignes
function mobile_auto(string $type, array $agentIds, string $titre, string $texte, string $url): int
{
  // une notification ratée ne doit jamais bloquer ce qui l'a déclenchée (planning, bourse, consignes)
  try {
    if (!(mod_mobile_reglages()[$type] ?? false)) return 0;
    $n = 0;
    foreach (array_unique(array_map('intval', $agentIds)) as $a) $n += mobile_pousser($a, $titre, $texte, $url, $type);
    return $n;
  } catch (Throwable $e) {
    error_log('[BDA module mobile] envoi automatique : ' . $e->getMessage());
    return 0;
  }
}
// Nouveau(x) poste(s) au planning d'un agent (appelé par le Planning des sites)
function mobile_planning_nouveau(int $agentId, array $jours, string $debut, string $fin, int $siteId): void
{
  $jours = array_values(array_filter($jours, fn ($j) => $j >= date('Y-m-d')));
  if ($agentId <= 0 || !$jours) return;
  // « Remplir » place souvent plusieurs postes d'affilée : une seule notification toutes les 2 minutes
  $st = db()->prepare("SELECT COUNT(*) FROM m_mobile_envois WHERE agent_id = ? AND type = 'planning' AND quand >= ?");
  $st->execute([$agentId, date('Y-m-d H:i:s', time() - 120)]);
  if ((int)$st->fetchColumn() > 0) return;
  $st = db()->prepare('SELECT nom FROM sites WHERE id = ?');
  $st->execute([$siteId]);
  $site = (string)($st->fetchColumn() ?: 'votre site');
  $h = fn (string $x) => str_replace(':', 'h', ltrim($x, '0'));
  if (count($jours) === 1) {
    $t = strtotime($jours[0]);
    $jour = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][(int)date('w', $t)] . ' ' . date('d/m', $t);
    mobile_auto('planning', [$agentId], 'Nouveau poste', "$jour, {$h($debut)} – {$h($fin)}, $site.", '/espace-equipe#/planning');
  } else {
    mobile_auto('planning', [$agentId], 'Planning mis à jour', count($jours) . " nouveaux postes à $site, de {$h($debut)} à {$h($fin)}.", '/espace-equipe#/planning');
  }
}

/* =========================================================
   ESPACE ÉQUIPE (l'agent connecté)
   ========================================================= */
function mod_mobile_eq_inscrire(): void
{
  $c = eq_exiger();
  $b = corps();
  $jeton = strtolower(trim(chaine($b['jeton'] ?? '')));
  if (!preg_match('/^[a-f0-9]{64,200}$/', $jeton)) throw new RuntimeException('Jeton de notification invalide.');
  if (!limiter('mobile-push:' . (int)$c['id'], 30, 3600)) throw new RuntimeException('Trop d’essais : patientez quelques minutes.');
  $db = db();
  $db->prepare("INSERT INTO m_mobile_jetons (agent_id, compte_id, plateforme, jeton, appareil, cree, vu) VALUES (?, ?, 'ios', ?, ?, ?, ?)
      ON CONFLICT(jeton) DO UPDATE SET agent_id = excluded.agent_id, compte_id = excluded.compte_id, appareil = excluded.appareil, vu = excluded.vu, echecs = 0")
    ->execute([(int)$c['agent_id'], (int)$c['id'], $jeton, appareil(), maintenant(), maintenant()]);
  // 5 téléphones au plus par agent : les plus anciens sont retirés
  $db->prepare('DELETE FROM m_mobile_jetons WHERE agent_id = ? AND id NOT IN (SELECT id FROM m_mobile_jetons WHERE agent_id = ? ORDER BY id DESC LIMIT 5)')
    ->execute([(int)$c['agent_id'], (int)$c['agent_id']]);
  repondre(['ok' => true, 'appareils' => mobile_nb_appareils((int)$c['agent_id'])]);
}
function mod_mobile_eq_retirer(): void
{
  $c = eq_exiger();
  db()->prepare('DELETE FROM m_mobile_jetons WHERE compte_id = ? AND jeton = ?')->execute([(int)$c['id'], strtolower(chaine(corps()['jeton'] ?? ''))]);
  repondre(['ok' => true]);
}
function mod_mobile_eq_compte(): void
{
  $c = eq_exiger();
  repondre(['ok' => true, 'compte' => ['prenom' => $c['prenom'], 'nom' => $c['nom'], 'identifiant' => $c['identifiant'], 'email' => $c['email'], 'cree' => $c['cree']],
    'appareils' => mobile_nb_appareils((int)$c['agent_id']), 'notifications' => mod_mobile_configure()]);
}
// Suppression du compte par l'agent (règle de l'App Store) : l'accès disparaît, le dossier RH reste
function mod_mobile_eq_supprimer(): void
{
  $c = eq_exiger();
  if (trim(chaine(corps()['confirmation'] ?? '')) !== 'SUPPRIMER') throw new RuntimeException('Tapez SUPPRIMER pour confirmer.');
  $db = db();
  $id = (int)$c['id'];
  $db->prepare("UPDATE comptes_equipe SET statut = 'supprime', identifiant = ?, email = '', tel = '', hash = '', reset = '', reset_expire = '' WHERE id = ?")
    ->execute(['supprime-' . $id . '-' . bin2hex(random_bytes(4)), $id]);
  $db->prepare('DELETE FROM equipe_appareils WHERE compte_id = ?')->execute([$id]);
  $db->prepare('DELETE FROM m_mobile_jetons WHERE compte_id = ?')->execute([$id]);
  try { $db->prepare('DELETE FROM m_presence_abonnements WHERE compte_id = ?')->execute([$id]); } catch (Throwable $e) { /* module absent */ }
  journal('equipe', 'Compte Espace équipe supprimé par l’agent lui-même : ' . $c['prenom'] . ' ' . $c['nom'] . ' (dossier agent conservé)');
  notifier('equipe', 'Compte Espace équipe supprimé', 'Un agent a supprimé son accès depuis l’appli. Son dossier est conservé.', '/admin/#/equipe');
  if (function_exists('eq_oublier_appareil')) eq_oublier_appareil();
  $_SESSION = [];
  if (session_status() === PHP_SESSION_ACTIVE) session_destroy();
  repondre(['ok' => true]);
}

/* =========================================================
   ADMIN
   ========================================================= */
function mod_mobile_adm_etat(): void
{
  $db = db();
  $agents = $db->query("SELECT j.agent_id, a.nom, COUNT(*) AS n, MAX(j.vu) AS vu, MAX(j.cree) AS cree FROM m_mobile_jetons j LEFT JOIN agents a ON a.id = j.agent_id GROUP BY j.agent_id ORDER BY a.nom COLLATE NOCASE")->fetchAll();
  $envois = $db->query('SELECT e.type, e.titre, e.texte, e.appareils, e.par, e.quand, a.nom FROM m_mobile_envois e LEFT JOIN agents a ON a.id = e.agent_id ORDER BY e.id DESC LIMIT 30')->fetchAll();
  $tous = $db->query("SELECT a.id, a.nom FROM agents a WHERE a.actif = 1 ORDER BY a.nom COLLATE NOCASE")->fetchAll();
  require_once __DIR__ . '/../veille/outils.php';
  repondre([
    'ok' => true,
    'configure' => mod_mobile_configure(),
    'admin' => role_courant() === 'admin',
    'cleId' => veille_env('APNS_KEY_ID'),
    'http2' => defined('CURL_HTTP_VERSION_2_0') && (curl_version()['features'] & (defined('CURL_VERSION_HTTP2') ? CURL_VERSION_HTTP2 : 0)) > 0,
    'reglages' => mod_mobile_reglages(),
    'agents' => array_map(fn ($a) => ['agent_id' => (int)$a['agent_id'], 'nom' => (string)($a['nom'] ?? 'Agent'), 'appareils' => (int)$a['n'], 'vu' => (string)$a['vu'], 'cree' => (string)$a['cree']], $agents),
    'tous' => array_map(fn ($a) => ['id' => (int)$a['id'], 'nom' => (string)$a['nom']], $tous),
    'comptes' => (int)$db->query("SELECT COUNT(DISTINCT agent_id) FROM comptes_equipe WHERE statut = 'actif'")->fetchColumn(),
    'envois' => $envois,
  ]);
}
// La clé .p8 est collée par le gérant (secret) : elle va dans le .env privé, jamais dans la base
function mod_mobile_adm_cle(): void
{
  $b = corps();
  $kid = strtoupper(trim(chaine($b['key_id'] ?? '')));
  $p8 = trim(str_replace("\r", '', (string)($b['p8'] ?? '')));
  if (!preg_match('/^[A-Z0-9]{10}$/', $kid)) throw new RuntimeException('Le Key ID fait 10 caractères (lettres et chiffres).');
  if (!str_contains($p8, 'BEGIN PRIVATE KEY') || !openssl_pkey_get_private($p8)) throw new RuntimeException('Collez tout le contenu du fichier .p8, de « -----BEGIN PRIVATE KEY----- » à « -----END PRIVATE KEY----- ».');
  require_once __DIR__ . '/../veille/outils.php';
  veille_env_ecrire(['APNS_KEY_ID' => $kid, 'APNS_KEY_P8' => $p8, 'APNS_TEAM_ID' => MOD_MOBILE_EQUIPE_APPLE]);
  mod_reglage_ecrire('mobile', 'jwt', null);
  journal('equipe', 'Appli BDA Équipe : clé des notifications Apple enregistrée');
  repondre(['ok' => true]);
}
function mod_mobile_adm_reglages(): void
{
  $b = corps();
  $r = [];
  foreach (MOD_MOBILE_AUTO as $k => $def) $r[$k] = !empty($b[$k]);
  mod_reglage_ecrire('mobile', 'reglages', $r);
  repondre(['ok' => true, 'reglages' => $r]);
}
// Message de la direction : à un agent ou à tous ceux qui ont l'appli
function mod_mobile_adm_envoyer(): void
{
  $b = corps();
  $titre = trim(chaine($b['titre'] ?? ''));
  $texte = trim(chaine($b['texte'] ?? ''));
  if ($titre === '' || $texte === '') throw new RuntimeException('Écrivez un titre et un message.');
  if (!limiter('mobile-envoi', 30, 3600)) throw new RuntimeException('Beaucoup d’envois d’affilée : patientez un peu.');
  $agent = (int)($b['agent_id'] ?? 0);
  $ids = $agent ? [$agent] : array_map('intval', db()->query('SELECT DISTINCT agent_id FROM m_mobile_jetons')->fetchAll(PDO::FETCH_COLUMN));
  if (!$ids) throw new RuntimeException('Aucun agent n’a encore installé l’appli.');
  $n = 0;
  foreach ($ids as $a) $n += mobile_pousser($a, $titre, $texte, '/espace-equipe', 'direction');
  journal('equipe', 'Appli BDA Équipe : message envoyé à ' . ($agent ? '1 agent' : count($ids) . ' agents') . ' (' . $n . ' iPhone)');
  repondre(['ok' => true, 'agents' => count($ids), 'appareils' => $n]);
}
