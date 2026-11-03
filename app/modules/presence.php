<?php
/* =========================================================
   MODULE « PRÉSENCE » — « Tout va bien ? » pour les agents de nuit
   - L'agent active les « alertes de service » sur son téléphone depuis l'Espace équipe
     (Web Push avec les clés VAPID du .env privé ; abonnements rangés ici, liés à l'agent).
     Service worker : /sw-equipe.js (portée /espace-equipe).
   - Pendant la plage horaire choisie (22h00 – 06h00 par défaut), la tâche automatique
     (toutes les 30 min) envoie « Tout va bien ? » aux agents en poste concernés
     (tous les postes de nuit, ou seulement les sites choisis), toutes les 30 ou 60 minutes.
   - L'agent répond d'un appui : bouton « Tout va bien » de la notification, ou très gros
     bouton de la page « Tout va bien ? » de l'Espace équipe.
   - Sans réponse dans le délai (15 min par défaut) : alerte dans le centre de contrôle
     (table alertes_agents, type 'presence' : le bandeau rouge l'affiche) et notification
     « presence » à la direction. Une réponse tardive est notée sur l'alerte, que la direction clôt.
   - DÉSACTIVÉ PAR DÉFAUT : rien ne part chez un agent tant que la direction ne l'a pas activé.
   - Limites (affichées dans l'admin) : téléphone allumé, internet, notifications autorisées ;
     ne remplace pas un boîtier PTI / DATI certifié.
   ========================================================= */
declare(strict_types=1);

const MOD_PRESENCE_DEFAUT = ['actif' => false, 'portee' => 'tous', 'sites' => [], 'intervalle' => 30, 'debut' => '22:00', 'fin' => '06:00', 'delai' => 15];
const MOD_PRESENCE_INTERVALLES = [30, 60];
const MOD_PRESENCE_DELAIS = [10, 15, 20];
const MOD_PRESENCE_GRACE = 20;        // minutes après la prise de poste avant la première question
const MOD_PRESENCE_TOLERANCE = 5;     // minutes de marge : la tâche automatique ne passe jamais pile à l'heure
const MOD_PRESENCE_RATTRAPAGE = 3;    // heures pendant lesquelles un « Tout va bien » tardif est encore accepté
const MOD_PRESENCE_MESSAGE = 'Ne répond pas au contrôle de présence';
// Services d'envoi des navigateurs (Chrome, Edge, Android, Firefox, Safari / iPhone, Windows) : aucune autre adresse acceptée
const MOD_PRESENCE_SERVICES = '/^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/';

function module_presence(): array
{
  return [
    'titre' => 'Contrôle de présence',
    'schema' => [
      1 => <<<'SQL'
        CREATE TABLE IF NOT EXISTS m_presence_abonnements (id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL, compte_id INTEGER NOT NULL DEFAULT 0,
          endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, appareil TEXT NOT NULL DEFAULT '',
          cree TEXT NOT NULL, vu TEXT NOT NULL DEFAULT '', echecs INTEGER NOT NULL DEFAULT 0);
        CREATE INDEX IF NOT EXISTS i_m_presence_abo_agent ON m_presence_abonnements (agent_id);
        CREATE TABLE IF NOT EXISTS m_presence_controles (id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL, vacation_id INTEGER NOT NULL DEFAULT 0,
          site_id INTEGER NOT NULL DEFAULT 0, site TEXT NOT NULL DEFAULT '', origine TEXT NOT NULL DEFAULT 'auto',
          envoye TEXT NOT NULL, limite TEXT NOT NULL, jeton TEXT NOT NULL DEFAULT '', appareils INTEGER NOT NULL DEFAULT 0,
          statut TEXT NOT NULL DEFAULT 'attente', repondu TEXT NOT NULL DEFAULT '', canal TEXT NOT NULL DEFAULT '',
          alerte_id INTEGER NOT NULL DEFAULT 0, par TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS i_m_presence_ctrl_agent ON m_presence_controles (agent_id, envoye);
        CREATE INDEX IF NOT EXISTS i_m_presence_ctrl_statut ON m_presence_controles (statut, limite);
        CREATE INDEX IF NOT EXISTS i_m_presence_ctrl_envoye ON m_presence_controles (envoye);
        CREATE INDEX IF NOT EXISTS i_m_presence_ctrl_jeton ON m_presence_controles (jeton);
        SQL,
    ],
    'admin' => [
      'tableau' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_presence_adm_tableau'],
      'reglages' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_presence_adm_reglages'],
      'demander' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_presence_adm_demander'],
    ],
    'equipe' => [
      'etat' => ['methode' => 'GET', 'fn' => 'mod_presence_eq_etat'],
      'abonner' => ['methode' => 'POST', 'fn' => 'mod_presence_eq_abonner'],
      'desabonner' => ['methode' => 'POST', 'fn' => 'mod_presence_eq_desabonner'],
      'tester' => ['methode' => 'POST', 'fn' => 'mod_presence_eq_tester'],
      'repondre' => ['methode' => 'POST', 'fn' => 'mod_presence_eq_repondre'],
    ],
    // bouton « Tout va bien » de la notification (le service worker n'a pas de session : jeton de la question)
    'public' => [
      'repondre' => ['methode' => 'POST', 'fn' => 'mod_presence_pub_repondre'],
    ],
    'cron' => 'mod_presence_cron',
    'compteurs' => 'mod_presence_compteurs',
  ];
}

/* =========================================================
   Réglages
   ========================================================= */
function mod_presence_nettoyer(array $b): array
{
  $d = MOD_PRESENCE_DEFAUT;
  $heure = fn($v, string $def): string => is_string($v) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v) ? $v : $def;
  $sites = array_values(array_unique(array_filter(array_map('intval', (array)($b['sites'] ?? [])), fn($x) => $x > 0)));
  $intervalle = (int)($b['intervalle'] ?? 0);
  $delai = (int)($b['delai'] ?? 0);
  return [
    'actif' => (bool)($b['actif'] ?? $d['actif']),
    'portee' => ($b['portee'] ?? '') === 'sites' ? 'sites' : 'tous',
    'sites' => array_slice($sites, 0, 300),
    'intervalle' => in_array($intervalle, MOD_PRESENCE_INTERVALLES, true) ? $intervalle : $d['intervalle'],
    'debut' => $heure($b['debut'] ?? null, $d['debut']),
    'fin' => $heure($b['fin'] ?? null, $d['fin']),
    'delai' => in_array($delai, MOD_PRESENCE_DELAIS, true) ? $delai : $d['delai'],
  ];
}
function mod_presence_reglages(): array
{
  $r = mod_reglage('presence', 'reglages', []);
  return mod_presence_nettoyer(is_array($r) ? $r : []);
}
// L'heure $ts est-elle dans la plage horaire du contrôle ? (plage de nuit : 22h00 → 06h00 passe minuit)
function mod_presence_dans_plage(array $r, int $ts): bool
{
  $m = (int)date('G', $ts) * 60 + (int)date('i', $ts);
  [$dh, $dm] = array_map('intval', explode(':', $r['debut']));
  [$fh, $fm] = array_map('intval', explode(':', $r['fin']));
  $d = $dh * 60 + $dm;
  $f = $fh * 60 + $fm;
  if ($d === $f) return true; // même heure de début et de fin : toute la journée
  return $d < $f ? ($m >= $d && $m < $f) : ($m >= $d || $m < $f);
}
const MOD_PRESENCE_FMT = 'H\hi';
function mod_presence_h(string $quand): string
{
  return $quand === '' ? '' : date(MOD_PRESENCE_FMT, strtotime($quand));
}

/* =========================================================
   Qui est en poste en ce moment ?
   - d'abord le planning des sites (vacations en cours, y compris la nuit commencée la veille) ;
   - sinon le pointage (service commencé il y a moins de 16 h) pour les agents sans poste au planning des sites ;
   - jamais les chauffeurs (on ne les dérange pas au volant).
   ========================================================= */
function mod_presence_en_poste(array $r, int $mtn): array
{
  require_once __DIR__ . '/../exploitation.php';
  $db = db();
  $liste = [];
  $prevus = [];
  foreach (exp_vacations(date('Y-m-d', $mtn - 86400), date('Y-m-d', $mtn)) as $v) {
    if ($v['agent_id'] <= 0) continue;
    $prevus[$v['agent_id']] = true;
    [$d, $f] = exp_bornes($v);
    if ($mtn < $d || $mtn >= $f || isset($liste[$v['agent_id']])) continue;
    $liste[$v['agent_id']] = ['agent_id' => $v['agent_id'], 'vacation_id' => $v['id'], 'site_id' => $v['site_id'], 'site' => (string)($v['site_nom'] ?? ''),
      'debut_ts' => $d, 'fin_ts' => $f, 'source' => 'planning'];
  }
  $sites = [];
  foreach ($db->query('SELECT id, nom FROM sites') as $s) $sites[mb_strtolower(trim((string)$s['nom']))] = (int)$s['id'];
  $st = $db->prepare("SELECT agent_id, debut, site FROM pointages WHERE fin = '' AND debut >= ? ORDER BY debut");
  $st->execute([date('Y-m-d H:i:s', $mtn - 16 * 3600)]);
  foreach ($st->fetchAll() as $p) {
    $aid = (int)$p['agent_id'];
    // un agent qui a des postes au planning mais aucun en ce moment a oublié de pointer sa fin : on ne le dérange pas
    if ($aid <= 0 || isset($liste[$aid]) || isset($prevus[$aid])) continue;
    $d = strtotime((string)$p['debut']);
    $liste[$aid] = ['agent_id' => $aid, 'vacation_id' => 0, 'site_id' => $sites[mb_strtolower(trim((string)$p['site']))] ?? 0, 'site' => (string)$p['site'],
      'debut_ts' => $d, 'fin_ts' => $d + 12 * 3600, 'source' => 'pointage'];
  }
  if (!$liste) return [];
  $ids = implode(',', array_map('intval', array_keys($liste)));
  $infos = [];
  foreach ($db->query("SELECT a.id, a.nom, a.actif, a.poste, ce.id AS compte, ce.metier FROM agents a
      LEFT JOIN comptes_equipe ce ON ce.id = (SELECT x.id FROM comptes_equipe x WHERE x.agent_id = a.id AND x.statut = 'actif' ORDER BY x.id LIMIT 1)
      WHERE a.id IN ($ids)") as $a) $infos[(int)$a['id']] = $a;
  $abos = [];
  foreach ($db->query("SELECT agent_id, COUNT(*) AS n FROM m_presence_abonnements WHERE agent_id IN ($ids) GROUP BY agent_id") as $x) $abos[(int)$x['agent_id']] = (int)$x['n'];
  $plage = mod_presence_dans_plage($r, $mtn);
  $res = [];
  foreach ($liste as $aid => $x) {
    $a = $infos[$aid] ?? null;
    if (!$a || !(int)$a['actif']) continue;
    if ((string)($a['metier'] ?? '') === 'chauffeur' || stripos((string)$a['poste'], 'chauffeur') !== false) continue;
    $x['nom'] = (string)$a['nom'];
    $x['compte'] = (int)($a['compte'] ?? 0);
    $x['appareils'] = $abos[$aid] ?? 0;
    $x['dans_portee'] = $r['portee'] === 'tous' || in_array((int)$x['site_id'], $r['sites'], true);
    $x['concerne'] = $r['actif'] && $plage && $x['dans_portee'];
    $x['raison'] = !$r['actif'] ? 'Contrôle désactivé' : (!$x['dans_portee'] ? 'Site non suivi' : (!$plage ? 'Hors plage horaire'
      : (!$x['compte'] ? 'Pas de compte Espace équipe' : (!$x['appareils'] ? 'Alertes non activées' : ''))));
    $x['suivi'] = $x['concerne'] && $x['appareils'] > 0;
    $res[] = $x;
  }
  usort($res, fn($p, $q) => [mb_strtolower($p['site']), mb_strtolower($p['nom'])] <=> [mb_strtolower($q['site']), mb_strtolower($q['nom'])]);
  return $res;
}
function mod_presence_moi(int $agentId, array $r, int $mtn): ?array
{
  foreach (mod_presence_en_poste($r, $mtn) as $x) if ((int)$x['agent_id'] === $agentId) return $x;
  return null;
}

/* =========================================================
   Envoi sur les téléphones des agents (Web Push chiffré, clés VAPID du .env privé)
   ========================================================= */
function mod_presence_pousser(int $agentId, array $donnees, int $ttl): int
{
  $db = db();
  $st = $db->prepare('SELECT * FROM m_presence_abonnements WHERE agent_id = ? ORDER BY id');
  $st->execute([$agentId]);
  $abos = $st->fetchAll();
  if (!$abos) return 0;
  if (getenv('BDA_NO_MAIL')) { // tests sur ordinateur : aucune notification ne part vraiment (copie dans le journal des mails)
    if ($j = getenv('BDA_MAIL_LOG')) @file_put_contents($j, '=== ' . date('c') . " → NOTIFICATION agent n° $agentId (" . count($abos) . " téléphone(s), simulée)\n" . ($donnees['title'] ?? '') . "\n" . ($donnees['body'] ?? '') . "\n\n", FILE_APPEND);
    $db->prepare('UPDATE m_presence_abonnements SET vu = ?, echecs = 0 WHERE agent_id = ?')->execute([maintenant(), $agentId]);
    return count($abos);
  }
  require_once __DIR__ . '/../veille/outils.php';
  require_once __DIR__ . '/../veille/webpush.php';
  if (veille_env('VAPID_PUBLIC_KEY') === '' || veille_env('VAPID_PRIVATE_KEY') === '') return 0;
  $corps = (string)json_encode($donnees, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  $ok = 0;
  foreach ($abos as $abo) {
    try {
      // même chiffrement que les notifications de l'admin, mais durée de vie courte : une question périmée ne sert à rien
      $r = veille_http('POST', (string)$abo['endpoint'], [
        'Authorization: ' . webpush_vapid((string)$abo['endpoint']),
        'Content-Encoding: aes128gcm',
        'Content-Type: application/octet-stream',
        'TTL: ' . max(60, $ttl),
        'Urgency: high',
      ], webpush_chiffrer($corps, (string)$abo['p256dh'], (string)$abo['auth']), 15);
      $code = (int)$r['code'];
      if ($code === 404 || $code === 410) $db->prepare('DELETE FROM m_presence_abonnements WHERE id = ?')->execute([$abo['id']]); // abonnement expiré
      elseif ($code >= 200 && $code < 300) {
        $ok++;
        $db->prepare('UPDATE m_presence_abonnements SET vu = ?, echecs = 0 WHERE id = ?')->execute([maintenant(), $abo['id']]);
      } else $db->prepare('UPDATE m_presence_abonnements SET echecs = echecs + 1 WHERE id = ?')->execute([$abo['id']]);
    } catch (Throwable $e) {
      error_log('[BDA module presence] envoi : ' . $e->getMessage());
      $db->prepare('UPDATE m_presence_abonnements SET echecs = echecs + 1 WHERE id = ?')->execute([$abo['id']]);
    }
  }
  return $ok;
}

/* =========================================================
   Questions « Tout va bien ? »
   ========================================================= */
// Une question est-elle due pour cet agent ? (à appeler sous verrou d'écriture)
function mod_presence_a_faire(array $x, array $r, int $mtn): bool
{
  if (empty($x['suivi'])) return false;
  if ($mtn < (int)$x['debut_ts'] + MOD_PRESENCE_GRACE * 60) return false; // on laisse l'agent s'installer
  if ($mtn + $r['delai'] * 60 > (int)$x['fin_ts']) return false;          // le poste se termine avant la fin du délai
  $st = db()->prepare("SELECT MAX(envoye) AS dernier, SUM(statut = 'attente') AS attente FROM m_presence_controles WHERE agent_id = ? AND envoye >= ?");
  $st->execute([$x['agent_id'], date('Y-m-d H:i:s', $mtn - 6 * 3600)]);
  $l = $st->fetch() ?: [];
  if ((int)($l['attente'] ?? 0) > 0) return false;
  return empty($l['dernier']) || strtotime((string)$l['dernier']) <= $mtn - ($r['intervalle'] - MOD_PRESENCE_TOLERANCE) * 60;
}
// Enregistre la question (le jeton sert au bouton « Tout va bien » de la notification ; on n'en garde que l'empreinte)
function mod_presence_creer(array $x, int $delai, string $origine, string $par = ''): array
{
  $mtn = time();
  $jeton = mod_jeton();
  db()->prepare('INSERT INTO m_presence_controles (agent_id, vacation_id, site_id, site, origine, envoye, limite, jeton, statut, par, cree) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([(int)$x['agent_id'], (int)($x['vacation_id'] ?? 0), (int)($x['site_id'] ?? 0), (string)($x['site'] ?? ''), $origine,
      date('Y-m-d H:i:s', $mtn), date('Y-m-d H:i:s', $mtn + $delai * 60), mod_empreinte($jeton), 'attente', $par, maintenant()]);
  return ['id' => (int)db()->lastInsertId(), 'jeton' => $jeton, 'limite' => date(MOD_PRESENCE_FMT, $mtn + $delai * 60), 'delai' => $delai];
}
function mod_presence_envoyer(array $q, int $agentId): int
{
  $n = mod_presence_pousser($agentId, [
    'type' => 'presence',
    'title' => 'Tout va bien ?',
    'body' => "Contrôle de présence : appuyez sur « Tout va bien » avant {$q['limite']}.",
    'url' => '/espace-equipe#/presence',
    'tag' => 'presence',
    'jeton' => $q['jeton'],
    'limite' => $q['limite'],
  ], $q['delai'] * 60);
  db()->prepare('UPDATE m_presence_controles SET appareils = ? WHERE id = ?')->execute([$n, $q['id']]);
  return $n;
}
// Exécute $fn sous verrou d'écriture SQLite (deux passages simultanés ne font pas deux fois le même travail)
function mod_presence_verrou(callable $fn)
{
  $db = db();
  $db->exec('BEGIN IMMEDIATE');
  try {
    $r = $fn();
    $db->exec('COMMIT');
    return $r;
  } catch (Throwable $e) {
    try { $db->exec('ROLLBACK'); } catch (Throwable $e2) { /* rien à annuler */ }
    throw $e;
  }
}

/* =========================================================
   Délai dépassé : alerte dans le centre de contrôle + notification à la direction
   ========================================================= */
function mod_presence_echeances(): int
{
  $db = db();
  $st = $db->prepare("SELECT * FROM m_presence_controles WHERE statut = 'attente' AND limite <= ? ORDER BY limite LIMIT 50");
  $st->execute([maintenant()]);
  $n = 0;
  foreach ($st->fetchAll() as $c) {
    $fait = mod_presence_verrou(function () use ($db, $c) {
      $maj = $db->prepare("UPDATE m_presence_controles SET statut = 'sans_reponse' WHERE id = ? AND statut = 'attente'");
      $maj->execute([$c['id']]);
      if ($maj->rowCount() !== 1) return false; // déjà traité par un autre passage (ou l'agent vient de répondre)
      mod_presence_alerter($c);
      return true;
    });
    if ($fait) $n++;
  }
  return $n;
}
// Position de l'alerte : celle du site (là où l'agent doit être), sinon celle de sa prise de service
function mod_presence_position(array $c): array
{
  $db = db();
  if ((int)$c['site_id'] > 0) {
    $st = $db->prepare('SELECT lat, lon FROM sites WHERE id = ?');
    $st->execute([(int)$c['site_id']]);
    $s = $st->fetch();
    if ($s && $s['lat'] !== null && $s['lon'] !== null) return [(float)$s['lat'], (float)$s['lon']];
  }
  $st = $db->prepare("SELECT lat_debut, lng_debut FROM pointages WHERE agent_id = ? AND fin = '' AND lat_debut IS NOT NULL ORDER BY debut DESC LIMIT 1");
  $st->execute([(int)$c['agent_id']]);
  $p = $st->fetch();
  return $p ? [(float)$p['lat_debut'], (float)$p['lng_debut']] : [null, null];
}
function mod_presence_alerter(array $c): void
{
  $db = db();
  $aid = (int)$c['agent_id'];
  // une seule alerte ouverte par agent : les questions suivantes sans réponse la complètent
  $st = $db->prepare("SELECT id, statut FROM alertes_agents WHERE agent_id = ? AND type = 'presence' AND statut <> 'close' ORDER BY id DESC LIMIT 1");
  $st->execute([$aid]);
  $ex = $st->fetch();
  if ($ex) {
    $db->prepare('UPDATE m_presence_controles SET alerte_id = ? WHERE id = ?')->execute([$ex['id'], $c['id']]);
    $n = (int)$db->query('SELECT COUNT(*) FROM m_presence_controles WHERE alerte_id = ' . (int)$ex['id'] . " AND statut = 'sans_reponse'")->fetchColumn();
    $db->prepare('UPDATE alertes_agents SET message = ? WHERE id = ?')->execute([MOD_PRESENCE_MESSAGE . ($n > 1 ? " ($n questions sans réponse)" : ''), $ex['id']]);
    if ($ex['statut'] === 'ouverte') notifier('presence', 'Un agent ne répond toujours pas', 'Ouvrez le centre de contrôle.', '/admin/#/controle', 'presence-' . $ex['id']);
    return;
  }
  [$lat, $lon] = mod_presence_position($c);
  $db->prepare("INSERT INTO alertes_agents (agent_id, type, quand, lat, lon, prec, message, statut) VALUES (?, 'presence', ?, ?, ?, NULL, ?, 'ouverte')")
    ->execute([$aid, maintenant(), $lat, $lon, MOD_PRESENCE_MESSAGE]);
  $id = (int)$db->lastInsertId();
  $db->prepare('UPDATE m_presence_controles SET alerte_id = ? WHERE id = ?')->execute([$id, $c['id']]);
  journal('alerte', "Contrôle de présence : un agent ne répond pas (alerte n° $id)");
  notifier('presence', 'Un agent ne répond pas', 'Ouvrez le centre de contrôle.', '/admin/#/controle', 'presence-' . $id);
}

/* =========================================================
   Réponse « Tout va bien » (à temps, en retard, ou après l'alerte)
   ========================================================= */
function mod_presence_valider(array $c, string $canal): string
{
  $db = db();
  return mod_presence_verrou(function () use ($db, $c, $canal) {
    $mtn = maintenant();
    $st = $db->prepare("UPDATE m_presence_controles SET statut = CASE WHEN ? <= limite THEN 'ok' ELSE 'retard' END, repondu = ?, canal = ? WHERE id = ? AND statut IN ('attente', 'sans_reponse')");
    $st->execute([$mtn, $mtn, $canal, $c['id']]);
    if ($st->rowCount() !== 1) return 'deja';
    $l = $db->prepare('SELECT statut, alerte_id FROM m_presence_controles WHERE id = ?');
    $l->execute([$c['id']]);
    $apres = $l->fetch();
    $alerte = (int)($apres['alerte_id'] ?? 0);
    if ($alerte > 0) {
      // l'alerte reste ouverte (la direction vérifie et la clôt), mais la réponse y est notée tout de suite
      $db->prepare("UPDATE alertes_agents SET message = ? WHERE id = ? AND statut <> 'close'")
        ->execute([MOD_PRESENCE_MESSAGE . ' · a répondu « Tout va bien » à ' . date(MOD_PRESENCE_FMT), $alerte]);
      journal('alerte', "Contrôle de présence : réponse « Tout va bien » reçue après l'alerte n° $alerte");
      notifier('presence', 'Un agent a répondu « Tout va bien »', 'Réponse reçue après l’alerte. Vérifiez, puis clôturez l’alerte.', '/admin/#/controle', 'presence-' . $alerte);
    }
    return (string)$apres['statut'];
  });
}
// Questions auxquelles l'agent peut encore répondre (en attente, ou restées sans réponse depuis peu)
function mod_presence_ouvertes(int $agentId): array
{
  $st = db()->prepare("SELECT * FROM m_presence_controles WHERE agent_id = ? AND repondu = '' AND (statut = 'attente' OR (statut = 'sans_reponse' AND envoye >= ?)) ORDER BY envoye");
  $st->execute([$agentId, date('Y-m-d H:i:s', time() - MOD_PRESENCE_RATTRAPAGE * 3600)]);
  return $st->fetchAll();
}

/* =========================================================
   Tâche automatique (toutes les 30 min) et compteurs (toutes les 60 s quand l'admin est ouvert)
   ========================================================= */
function mod_presence_cron(string $origine = 'auto'): array
{
  $bilan = ['sansReponse' => mod_presence_echeances(), 'questions' => 0];
  $r = mod_presence_reglages();
  if (!$r['actif']) return $bilan + ['etat' => 'désactivé'];
  $mtn = time();
  if (!mod_presence_dans_plage($r, $mtn)) return $bilan + ['etat' => 'hors plage horaire'];
  foreach (mod_presence_en_poste($r, $mtn) as $x) {
    if (!$x['suivi']) continue;
    try {
      $q = mod_presence_verrou(fn() => mod_presence_a_faire($x, $r, $mtn) ? mod_presence_creer($x, $r['delai'], 'auto') : null);
      if ($q) {
        mod_presence_envoyer($q, (int)$x['agent_id']);
        $bilan['questions']++;
      }
    } catch (Throwable $e) {
      error_log('[BDA module presence] question : ' . $e->getMessage());
    }
  }
  return $bilan + ['etat' => 'actif'];
}
// Appelée à chaque mise à jour des compteurs de l'admin : l'alerte part dans la minute si l'admin est ouvert
function mod_presence_compteurs(): array
{
  try { mod_presence_echeances(); } catch (Throwable $e) { error_log('[BDA module presence] échéances : ' . $e->getMessage()); }
  return ['presence' => (int)db()->query("SELECT COUNT(*) FROM alertes_agents WHERE type = 'presence' AND statut = 'ouverte'")->fetchColumn()];
}

/* =========================================================
   ESPACE ÉQUIPE (l'agent connecté seulement)
   ========================================================= */
function mod_presence_empreinte_appareil(string $endpoint): string
{
  return substr(hash('sha256', $endpoint), 0, 16);
}
function mod_presence_appareils(int $agentId): array
{
  $st = db()->prepare('SELECT endpoint, appareil, cree, vu FROM m_presence_abonnements WHERE agent_id = ? ORDER BY id');
  $st->execute([$agentId]);
  return array_map(fn($a) => ['empreinte' => mod_presence_empreinte_appareil((string)$a['endpoint']), 'appareil' => (string)$a['appareil'], 'cree' => (string)$a['cree'], 'vu' => (string)$a['vu']], $st->fetchAll());
}
function mod_presence_cle_publique(): string
{
  require_once __DIR__ . '/../veille/outils.php';
  return (string)veille_env('VAPID_PUBLIC_KEY');
}
function mod_presence_eq_etat(): void
{
  $c = eq_exiger();
  $aid = (int)$c['agent_id'];
  $r = mod_presence_reglages();
  $mtn = time();
  mod_presence_echeances();
  $moi = mod_presence_moi($aid, $r, $mtn);
  $st = db()->prepare('SELECT envoye, limite, statut, repondu, canal, origine FROM m_presence_controles WHERE agent_id = ? ORDER BY envoye DESC, id DESC LIMIT 12');
  $st->execute([$aid]);
  $historique = $st->fetchAll();
  $ouvertes = array_map(fn($q) => ['id' => (int)$q['id'], 'envoye' => (string)$q['envoye'], 'limite' => (string)$q['limite'], 'enRetard' => (string)$q['limite'] < maintenant()], mod_presence_ouvertes($aid));
  // prochaine question (estimation : la tâche automatique passe toutes les 30 min)
  $prochaine = '';
  if ($moi && $moi['concerne'] && !$ouvertes) {
    $dernier = $historique ? strtotime((string)$historique[0]['envoye']) : 0;
    $t = max($mtn, (int)$moi['debut_ts'] + MOD_PRESENCE_GRACE * 60, $dernier ? $dernier + $r['intervalle'] * 60 : 0);
    $t = (int)(ceil($t / 300) * 300);
    if ($t + $r['delai'] * 60 <= (int)$moi['fin_ts'] && mod_presence_dans_plage($r, $t)) $prochaine = date(MOD_PRESENCE_FMT, $t);
  }
  repondre([
    'ok' => true,
    'vapid' => mod_presence_cle_publique(),
    'appareils' => mod_presence_appareils($aid),
    'reglages' => ['actif' => $r['actif'], 'intervalle' => $r['intervalle'], 'debut' => $r['debut'], 'fin' => $r['fin'], 'delai' => $r['delai']],
    'poste' => $moi ? ['site' => $moi['site'], 'debut' => date(MOD_PRESENCE_FMT, (int)$moi['debut_ts']), 'fin' => date(MOD_PRESENCE_FMT, (int)$moi['fin_ts'])] : null,
    'dansPortee' => (bool)($moi['dans_portee'] ?? false),
    'concerne' => (bool)($moi['concerne'] ?? false),
    'attente' => $ouvertes,
    'prochaine' => $prochaine,
    'historique' => array_map(fn($q) => ['envoye' => (string)$q['envoye'], 'statut' => (string)$q['statut'], 'repondu' => (string)$q['repondu'], 'canal' => (string)$q['canal'], 'origine' => (string)$q['origine']], $historique),
    'serveur' => maintenant(),
  ]);
}
function mod_presence_eq_abonner(): void
{
  $c = eq_exiger();
  $aid = (int)$c['agent_id'];
  $b = corps();
  $endpoint = chaine($b['endpoint'] ?? '');
  $p256dh = chaine($b['keys']['p256dh'] ?? '');
  $auth = chaine($b['keys']['auth'] ?? '');
  $hote = strtolower((string)parse_url($endpoint, PHP_URL_HOST));
  if (!str_starts_with($endpoint, 'https://') || strlen($endpoint) > 1000 || !preg_match(MOD_PRESENCE_SERVICES, $hote)) {
    throw new RuntimeException('Ce navigateur ne permet pas de recevoir les alertes. Utilisez Chrome sur Android, ou Safari sur iPhone.');
  }
  if (!preg_match('/^[A-Za-z0-9_=-]{80,100}$/', $p256dh) || !preg_match('/^[A-Za-z0-9_=-]{16,32}$/', $auth)) throw new RuntimeException('Activation incomplète : réessayez.');
  if (!limiter('presence-abo:' . $aid, 30, 3600)) throw new RuntimeException('Trop d’essais : patientez quelques minutes.');
  $db = db();
  $db->prepare('INSERT INTO m_presence_abonnements (agent_id, compte_id, endpoint, p256dh, auth, appareil, cree, vu) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET agent_id = excluded.agent_id, compte_id = excluded.compte_id, p256dh = excluded.p256dh, auth = excluded.auth, appareil = excluded.appareil, echecs = 0')
    ->execute([$aid, (int)$c['id'], $endpoint, $p256dh, $auth, appareil(), maintenant(), '']);
  // 5 téléphones au plus par agent : les plus anciens sont retirés
  $db->prepare('DELETE FROM m_presence_abonnements WHERE agent_id = ? AND id NOT IN (SELECT id FROM m_presence_abonnements WHERE agent_id = ? ORDER BY id DESC LIMIT 5)')->execute([$aid, $aid]);
  repondre(['ok' => true, 'appareils' => mod_presence_appareils($aid)]);
}
function mod_presence_eq_desabonner(): void
{
  $c = eq_exiger();
  $aid = (int)$c['agent_id'];
  db()->prepare('DELETE FROM m_presence_abonnements WHERE agent_id = ? AND endpoint = ?')->execute([$aid, chaine(corps()['endpoint'] ?? '')]);
  repondre(['ok' => true, 'appareils' => mod_presence_appareils($aid)]);
}
function mod_presence_eq_tester(): void
{
  $c = eq_exiger();
  $aid = (int)$c['agent_id'];
  if (!mod_presence_appareils($aid)) throw new RuntimeException('Activez d’abord les alertes sur ce téléphone.');
  if (!limiter('presence-essai:' . $aid, 5, 600)) throw new RuntimeException('Alertes d’essai déjà envoyées : patientez quelques minutes.');
  $n = mod_presence_pousser($aid, ['type' => 'essai', 'title' => 'Alertes de service activées',
    'body' => 'Ce téléphone recevra le contrôle de présence « Tout va bien ? » pendant vos postes de nuit.', 'url' => '/espace-equipe#/presence', 'tag' => 'bda-essai'], 600);
  if (!$n) throw new RuntimeException('L’alerte d’essai n’a pu être remise à aucun téléphone. Désactivez puis réactivez les alertes.');
  repondre(['ok' => true, 'envoyes' => $n]);
}
function mod_presence_eq_repondre(): void
{
  $c = eq_exiger();
  $aid = (int)$c['agent_id'];
  if (!limiter('presence-reponse:' . $aid, 30, 600)) throw new RuntimeException('Trop d’essais : patientez quelques minutes.');
  mod_presence_echeances();
  $statuts = [];
  foreach (mod_presence_ouvertes($aid) as $q) $statuts[] = mod_presence_valider($q, 'page');
  if (!$statuts) {
    // aucune question en attente : confirmation spontanée, qui repart le compteur (seulement pendant un poste suivi)
    $r = mod_presence_reglages();
    $moi = mod_presence_moi($aid, $r, time());
    if (!$moi || !$moi['concerne']) throw new RuntimeException('Aucune question en attente pour le moment.');
    db()->prepare("INSERT INTO m_presence_controles (agent_id, vacation_id, site_id, site, origine, envoye, limite, statut, repondu, canal, cree) VALUES (?, ?, ?, ?, 'spontane', ?, ?, 'ok', ?, 'page', ?)")
      ->execute([$aid, (int)$moi['vacation_id'], (int)$moi['site_id'], (string)$moi['site'], maintenant(), maintenant(), maintenant(), maintenant()]);
    $statuts[] = 'ok';
  }
  repondre(['ok' => true, 'statut' => in_array('retard', $statuts, true) ? 'retard' : 'ok', 'heure' => date(MOD_PRESENCE_FMT)]);
}

/* =========================================================
   LIEN PUBLIC : bouton « Tout va bien » de la notification (service worker, sans session)
   ========================================================= */
function mod_presence_pub_repondre(): void
{
  if (!limiter('presence-reponse', 60, 600)) echec('Trop d’essais. Réessayez dans quelques minutes.', 429);
  $jeton = chaine(corps()['jeton'] ?? '');
  if (!preg_match('/^[a-f0-9]{48}$/', $jeton)) echec('Question introuvable.', 404);
  mod_presence_echeances();
  $st = db()->prepare('SELECT * FROM m_presence_controles WHERE jeton = ?');
  $st->execute([mod_empreinte($jeton)]);
  $c = $st->fetch();
  if (!$c) echec('Question introuvable.', 404);
  if (in_array($c['statut'], ['ok', 'retard'], true)) repondre(['ok' => true, 'statut' => $c['statut'], 'deja' => true, 'heure' => mod_presence_h((string)$c['repondu'])]);
  if ((string)$c['envoye'] < date('Y-m-d H:i:s', time() - MOD_PRESENCE_RATTRAPAGE * 3600)) echec('Cette question est trop ancienne.', 410);
  $statut = mod_presence_valider($c, 'notification');
  repondre(['ok' => true, 'statut' => $statut, 'heure' => date(MOD_PRESENCE_FMT)]);
}

/* =========================================================
   ADMIN (administrateurs et managers)
   ========================================================= */
function mod_presence_adm_tableau(): void
{
  mod_presence_echeances();
  $r = mod_presence_reglages();
  $mtn = time();
  $db = db();
  require_once __DIR__ . '/../exploitation.php';
  require_once __DIR__ . '/../veille/outils.php';
  // clés de notification créées au besoin (comme la page Notifications de l'admin)
  if (veille_env('VAPID_PUBLIC_KEY') === '' || veille_env('VAPID_PRIVATE_KEY') === '') {
    try { require_once __DIR__ . '/../veille/webpush.php'; veille_cles_auto(); } catch (Throwable $e) { error_log('[BDA module presence] clés : ' . $e->getMessage()); }
  }
  // nuit affichée : du soir (12h00) au lendemain midi ; par défaut la nuit en cours (ou la dernière)
  $nuit = (string)($_GET['nuit'] ?? '');
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $nuit) || !strtotime($nuit)) $nuit = date('Y-m-d', $mtn - 12 * 3600);
  $du = $nuit . ' 12:00:00';
  $au = date('Y-m-d', (int)strtotime($nuit . ' +1 day')) . ' 12:00:00';
  $st = $db->prepare('SELECT c.id, c.agent_id, c.site, c.origine, c.envoye, c.limite, c.appareils, c.statut, c.repondu, c.canal, c.alerte_id, c.par, a.nom AS agent_nom
      FROM m_presence_controles c LEFT JOIN agents a ON a.id = c.agent_id WHERE c.envoye >= ? AND c.envoye < ? ORDER BY c.envoye DESC, c.id DESC LIMIT 600');
  $st->execute([$du, $au]);
  $historique = $st->fetchAll();
  // 14 dernières nuits (pour naviguer)
  $st = $db->prepare("SELECT substr(datetime(envoye, '-12 hours'), 1, 10) AS nuit, SUM(origine <> 'spontane') AS questions, SUM(statut = 'sans_reponse') AS sans
      FROM m_presence_controles WHERE envoye >= ? GROUP BY nuit ORDER BY nuit DESC");
  $st->execute([date('Y-m-d', $mtn - 15 * 86400) . ' 12:00:00']);
  $nuits = array_map(fn($n) => ['nuit' => (string)$n['nuit'], 'questions' => (int)$n['questions'], 'sans' => (int)$n['sans']], $st->fetchAll());
  // agents en poste en ce moment + dernière question de chacun
  $enPoste = mod_presence_en_poste($r, $mtn);
  $derniers = [];
  if ($enPoste) {
    $ids = implode(',', array_map(fn($x) => (int)$x['agent_id'], $enPoste));
    foreach ($db->query("SELECT c.agent_id, c.envoye, c.limite, c.statut, c.repondu FROM m_presence_controles c
        JOIN (SELECT agent_id, MAX(id) AS id FROM m_presence_controles WHERE agent_id IN ($ids) AND envoye >= '" . date('Y-m-d H:i:s', $mtn - 14 * 3600) . "' GROUP BY agent_id) d ON d.id = c.id") as $q) {
      $derniers[(int)$q['agent_id']] = $q;
    }
  }
  $enPoste = array_map(fn($x) => [
    'agent_id' => (int)$x['agent_id'], 'nom' => $x['nom'], 'site' => $x['site'], 'source' => $x['source'],
    'debut' => date(MOD_PRESENCE_FMT, (int)$x['debut_ts']), 'fin' => date(MOD_PRESENCE_FMT, (int)$x['fin_ts']),
    'compte' => $x['compte'] > 0, 'appareils' => (int)$x['appareils'], 'suivi' => $x['suivi'], 'concerne' => $x['concerne'], 'raison' => $x['raison'],
    'dernier' => $derniers[(int)$x['agent_id']] ?? null,
  ], $enPoste);
  // téléphones des agents (comptes Espace équipe validés, hors chauffeurs)
  $equipe = $db->query("SELECT a.id AS agent_id, a.nom, a.poste, ce.derniere,
      (SELECT COUNT(*) FROM m_presence_abonnements p WHERE p.agent_id = a.id) AS appareils,
      (SELECT MAX(p.vu) FROM m_presence_abonnements p WHERE p.agent_id = a.id) AS vu
      FROM agents a JOIN comptes_equipe ce ON ce.id = (SELECT x.id FROM comptes_equipe x WHERE x.agent_id = a.id AND x.statut = 'actif' ORDER BY x.id LIMIT 1)
      WHERE a.actif = 1 AND ce.metier <> 'chauffeur' ORDER BY a.nom COLLATE NOCASE")->fetchAll();
  // dernier passage de la tâche automatique (pour voir tout de suite si elle ne tourne plus)
  $cron = json_decode((string)($db->query("SELECT v FROM reglages WHERE k = 'modules_cron'")->fetchColumn() ?: ''), true);
  repondre([
    'ok' => true,
    'reglages' => $r,
    'sites' => array_map(fn($s) => ['id' => $s['id'], 'nom' => $s['nom']], exp_sites()),
    'maintenant' => date('Y-m-d H:i:s', $mtn),
    'dansPlage' => mod_presence_dans_plage($r, $mtn),
    'notifications' => veille_env('VAPID_PUBLIC_KEY') !== '',
    'cron' => is_array($cron) ? ['quand' => (string)($cron['quand'] ?? ''), 'presence' => $cron['bilan']['presence'] ?? null] : null,
    'nuit' => $nuit,
    'nuits' => $nuits,
    'historique' => $historique,
    'enPoste' => $enPoste,
    'equipe' => array_map(fn($a) => ['agent_id' => (int)$a['agent_id'], 'nom' => (string)$a['nom'], 'poste' => (string)$a['poste'], 'appareils' => (int)$a['appareils'], 'vu' => (string)($a['vu'] ?? ''), 'derniere' => (string)($a['derniere'] ?? '')], $equipe),
    'alertesOuvertes' => (int)$db->query("SELECT COUNT(*) FROM alertes_agents WHERE type = 'presence' AND statut <> 'close'")->fetchColumn(),
  ]);
}
function mod_presence_adm_reglages(): void
{
  $b = corps();
  $r = mod_presence_nettoyer($b);
  // seulement des sites qui existent
  $existants = array_map('intval', db()->query('SELECT id FROM sites')->fetchAll(PDO::FETCH_COLUMN));
  $r['sites'] = array_values(array_filter($r['sites'], fn($id) => in_array($id, $existants, true)));
  if ($r['actif'] && $r['portee'] === 'sites' && !$r['sites']) throw new RuntimeException('Cochez au moins un site, ou choisissez « Tous les postes de nuit ».');
  $avant = mod_presence_reglages();
  mod_reglage_ecrire('presence', 'reglages', $r);
  if ($avant['actif'] !== $r['actif']) {
    journal('equipe', 'Contrôle de présence « Tout va bien ? » ' . ($r['actif'] ? "activé (toutes les {$r['intervalle']} min, de {$r['debut']} à {$r['fin']})" : 'désactivé'));
  } else {
    journal('equipe', 'Réglages du contrôle de présence mis à jour');
  }
  repondre(['ok' => true, 'reglages' => $r]);
}
function mod_presence_adm_demander(): void
{
  $aid = (int)(corps()['agent_id'] ?? 0);
  $db = db();
  $st = $db->prepare('SELECT id, actif FROM agents WHERE id = ?');
  $st->execute([$aid]);
  $a = $st->fetch();
  if (!$a || !(int)$a['actif']) throw new RuntimeException('Agent introuvable.');
  $n = (int)$db->query('SELECT COUNT(*) FROM m_presence_abonnements WHERE agent_id = ' . $aid)->fetchColumn();
  if (!$n) throw new RuntimeException('Cet agent n’a pas activé les alertes sur son téléphone (Espace équipe › Tout va bien ? › Activer les alertes).');
  $r = mod_presence_reglages();
  $x = mod_presence_moi($aid, $r, time()) ?? ['agent_id' => $aid, 'vacation_id' => 0, 'site_id' => 0, 'site' => ''];
  $q = mod_presence_verrou(function () use ($db, $aid, $x, $r) {
    $st = $db->prepare("SELECT MAX(envoye) AS dernier, MAX(CASE WHEN statut = 'attente' THEN limite END) AS attente FROM m_presence_controles WHERE agent_id = ? AND envoye >= ?");
    $st->execute([$aid, date('Y-m-d H:i:s', time() - 6 * 3600)]);
    $l = $st->fetch() ?: [];
    if (!empty($l['attente'])) throw new RuntimeException('Une question attend déjà sa réponse (jusqu’à ' . mod_presence_h((string)$l['attente']) . ').');
    if (!empty($l['dernier']) && strtotime((string)$l['dernier']) > time() - 120) throw new RuntimeException('Une question vient de partir à cet agent : attendez sa réponse.');
    return mod_presence_creer($x, $r['delai'], 'manuel', (string)($_SESSION['login'] ?? ''));
  });
  $envoyes = mod_presence_envoyer($q, $aid);
  journal('equipe', 'Contrôle de présence : question « Tout va bien ? » envoyée à la demande');
  repondre(['ok' => true, 'appareils' => $envoyes, 'limite' => $q['limite']]);
}
