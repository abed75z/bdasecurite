<?php
/* =========================================================
   VEILLE COMMERCIALE — lancement d'une collecte et notifications
   Appelé par api/veille-cron.php (toutes les 30 min) ou par le bouton de l'admin.
   Règles :
   - premier lancement d'une source : un seul message récapitulatif ;
   - ensuite : une notification par nouvel appel d'offres s'il y en a 3 ou moins, sinon un résumé ;
   - rappel unique quand un appel d'offres non ignoré arrive à J-3 ;
   - si une source plante, l'autre continue et l'erreur est affichée dans l'admin.
   ========================================================= */
declare(strict_types=1);

require_once __DIR__ . '/outils.php';
require_once __DIR__ . '/webpush.php';
require_once __DIR__ . '/discord.php';
require_once __DIR__ . '/sources.php';

const VEILLE_SOURCES = ['boamp' => 'Appels d’offres (BOAMP)', 'francetravail' => 'Recrutements (France Travail)'];

function veille_etat(): array
{
  $st = db()->prepare("SELECT v FROM reglages WHERE k = 'veille_etat'");
  $st->execute();
  $e = json_decode((string)$st->fetchColumn(), true);
  return is_array($e) ? $e : [];
}
function veille_etat_enregistrer(array $e): void
{
  db()->prepare("INSERT INTO reglages (k, v) VALUES ('veille_etat', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")->execute([json_encode($e, JSON_UNESCAPED_UNICODE)]);
}
function veille_notifiable(string $niveau): bool
{
  $ordre = ['faible' => 0, 'moyen' => 1, 'fort' => 2];
  return ($ordre[$niveau] ?? 0) >= ($ordre[veille_config()['notifier_a_partir_du_niveau']] ?? 1);
}
function veille_lire(int $id): ?array
{
  $st = db()->prepare('SELECT * FROM opportunites WHERE id = ?');
  $st->execute([$id]);
  return $st->fetch() ?: null;
}
function veille_jours_restants(string $limite): ?int
{
  if ($limite === '') return null;
  return (int)floor((strtotime(substr($limite, 0, 10)) - strtotime(date('Y-m-d'))) / 86400);
}

/* ---------- Lancement ---------- */
function veille_lancer(string $origine = 'auto'): array
{
  @set_time_limit(280);
  $verrou = fopen(dossier_donnees() . '/veille.lock', 'c');
  if (!$verrou || !flock($verrou, LOCK_EX | LOCK_NB)) return ['ok' => false, 'message' => 'Une collecte est déjà en cours.'];
  $debut = microtime(true);
  try {
    veille_cles_auto();
    $etat = veille_etat();
    $c = veille_config();
    $nouveaux = ['boamp' => [], 'francetravail' => []];
    $premiers = [];
    foreach (VEILLE_SOURCES as $source => $libelle) {
      $premier = empty($etat['init'][$source]);
      $jours = $premier ? (int)$c['jours_premier_lancement'] : (int)$c['jours_ensuite'];
      $journal = [];
      try {
        $items = $source === 'boamp' ? boamp_collecter($jours, $journal) : ft_collecter($jours, $journal);
        $ids = veille_enregistrer($items);
        $nouveaux[$source] = $ids;
        if ($premier) $premiers[$source] = true;
        $etat['init'][$source] = true;
        $etat['sources'][$source] = ['ok' => true, 'message' => implode(' ', $journal), 'nouveaux' => count($ids), 'quand' => veille_maintenant()];
      } catch (Throwable $e) {
        error_log("[BDA veille $source] " . $e->getMessage());
        $etat['sources'][$source] = ['ok' => false, 'message' => $e->getMessage(), 'nouveaux' => 0, 'quand' => veille_maintenant(), 'dernier_ok' => $etat['sources'][$source]['ok'] ?? false ? ($etat['sources'][$source]['quand'] ?? '') : ($etat['sources'][$source]['dernier_ok'] ?? '')];
      }
    }
    $notifs = veille_notifier($nouveaux, $premiers);
    veille_nettoyer();
    $etat['derniere'] = ['quand' => veille_maintenant(), 'origine' => $origine, 'duree' => round(microtime(true) - $debut, 1)];
    $etat['notifications'] = $notifs + ['quand' => veille_maintenant()];
    veille_etat_enregistrer($etat);
    $total = count($nouveaux['boamp']) + count($nouveaux['francetravail']);
    journal('site', "Veille commerciale ($origine) : $total nouvelle(s) opportunité(s)");
    // Une fois par jour après 8 h : rappels du matin (factures en retard, cartes pro, demandes en attente)
    if ($origine === 'auto') notif_rappels_du_jour();
    return ['ok' => true, 'nouveaux' => ['boamp' => count($nouveaux['boamp']), 'francetravail' => count($nouveaux['francetravail'])], 'etat' => $etat];
  } finally {
    flock($verrou, LOCK_UN);
    fclose($verrou);
  }
}
// Enregistre les opportunités sans doublons ; renvoie les id des nouvelles
function veille_enregistrer(array $items): array
{
  $ids = [];
  $ins = db()->prepare('INSERT OR IGNORE INTO opportunites (source, ref, type, nature, titre, acheteur, lieu, departements, date_parution, date_limite, url, url_dossier, montant, score, niveau, alertes, motifs, extrait, cree, maj)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  foreach ($items as $o) {
    $ins->execute([$o['source'], $o['ref'], $o['type'], mb_substr($o['nature'], 0, 120), mb_substr($o['titre'], 0, 500), mb_substr($o['acheteur'], 0, 250), mb_substr($o['lieu'], 0, 120),
      $o['departements'], $o['date_parution'], $o['date_limite'], $o['url'], $o['url_dossier'], (float)$o['montant'], (int)$o['score'], $o['niveau'],
      json_encode($o['alertes'], JSON_UNESCAPED_UNICODE), json_encode($o['motifs'], JSON_UNESCAPED_UNICODE), $o['extrait'], veille_maintenant(), veille_maintenant()]);
    if (db()->lastInsertId() && $ins->rowCount()) $ids[] = (int)db()->lastInsertId();
  }
  return $ids;
}
function veille_nettoyer(): void
{
  $db = db();
  $db->prepare('DELETE FROM veille_vus WHERE vu < ?')->execute([date('Y-m-d H:i:s', time() - 45 * 86400)]);
  // appels d'offres clos depuis plus de 60 jours (sauf ceux marqués « contacté ») et recrutements de plus de 60 jours
  $db->prepare("DELETE FROM opportunites WHERE statut <> 'contacte' AND ((date_limite <> '' AND date_limite < ?) OR (source = 'francetravail' AND cree < ?))")
    ->execute([date('Y-m-d H:i:s', time() - 60 * 86400), date('Y-m-d H:i:s', time() - 60 * 86400)]);
}

/* ---------- Notifications ---------- */
function veille_notifier(array $nouveaux, array $premiers): array
{
  $res = ['discord' => null, 'push' => ['envoyes' => 0, 'supprimes' => 0, 'erreurs' => 0], 'messages' => 0];
  $discordOk = true;
  $erreurs = [];
  $bot = dc_actif();
  if ($bot) require_once __DIR__ . '/../discord/vues.php';
  $envoyer = function (array $embeds, string $contenu, array $push, string $salon = 'appels-offres', array $ids = [], string $prefixe = '') use (&$res, &$discordOk, &$erreurs, $bot) {
    $d = ['ok' => false, 'erreur' => ''];
    if ($bot) {
      // Serveur de la direction : cartes sobres, boutons Contacté / Ignorer / Note, menu pour les résumés
      $os = $ids ? dc_q('SELECT * FROM opportunites WHERE id IN (' . implode(',', array_map('intval', $ids)) . ')') : [];
      $msg = ['content' => trim((string)preg_replace('/[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{FE0F}]/u', '', $contenu)), 'embeds' => $os ? array_map(fn($o) => dcv_opportunite_carte($o, $prefixe), array_slice($os, 0, 10)) : $embeds];
      if (count($os) === 1) $msg['components'] = dcv_opportunite_boutons($os[0]);
      elseif ($os) $msg['components'] = [dc_liste('s:opportunite', 'Traiter une de ces opportunités…', array_map(fn($o) => dc_option($o['source'] === 'boamp' ? $o['titre'] : $o['acheteur'], (string)$o['id'], $o['source'] === 'boamp' ? $o['acheteur'] : $o['lieu']), array_slice($os, 0, 25)))];
      $e = dc_envoyer($salon, $msg);
      if ($e['ok']) $d = ['ok' => true, 'envoyes' => 1];
    }
    if (!$d['ok']) $d = discord_envoyer($embeds, $contenu);
    if (!$d['ok']) { $discordOk = false; $erreurs[] = $d['erreur']; } else $res['messages'] += $d['envoyes'];
    if (!$push || empty(notif_prefs()['veille'])) return; // catégorie coupée dans l'admin (Notifications)
    $p = webpush_tous($push + ['categorie' => 'veille']);
    foreach ($p as $k => $v) $res['push'][$k] += $v;
  };
  $lire = function (array $ids): array {
    if (!$ids) return [];
    $st = db()->query('SELECT * FROM opportunites WHERE id IN (' . implode(',', array_map('intval', $ids)) . ')');
    return $st->fetchAll();
  };
  $ao = $lire($nouveaux['boamp']);
  $rec = $lire($nouveaux['francetravail']);
  $aoNotif = array_values(array_filter($ao, fn($o) => veille_notifiable($o['niveau'])));
  usort($aoNotif, fn($a, $b) => [$b['niveau'] === 'fort', $a['date_limite'] ?: '9999'] <=> [$a['niveau'] === 'fort', $b['date_limite'] ?: '9999']);

  // 1) Premier lancement : un seul message récapitulatif
  if ($premiers && ($ao || $rec)) {
    $fort = count(array_filter($ao, fn($o) => $o['niveau'] === 'fort'));
    $moyen = count(array_filter($ao, fn($o) => $o['niveau'] === 'moyen'));
    $lignes = ["## 🛡️ Veille BDA Security Group activée", "Première collecte sur les " . veille_config()['jours_premier_lancement'] . " derniers jours en Île-de-France :"];
    if (isset($premiers['boamp'])) $lignes[] = "• **" . count($ao) . " appels d'offres** retenus — 🟢 $fort très pertinents · 🟡 $moyen à regarder · ⚪ " . (count($ao) - $fort - $moyen) . ' faibles';
    if (isset($premiers['francetravail'])) $lignes[] = "• **" . count($rec) . " employeurs directs** qui recrutent des agents de sécurité";
    $lignes[] = "Les plus intéressants ci-dessous · tout est dans l'admin : https://bdasecurite.com/admin/#/opportunites";
    $embeds = array_map(fn($o) => discord_embed($o), array_slice($aoNotif, 0, 10));
    $envoyer($embeds, implode("\n", $lignes), ['title' => 'Veille BDA activée', 'body' => count($ao) . " appels d'offres et " . count($rec) . ' entreprises qui recrutent trouvés.', 'url' => '/admin/#/opportunites', 'tag' => 'veille-recap'], 'appels-offres', array_map(fn($o) => (int)$o['id'], array_slice($aoNotif, 0, 10)));
    if (isset($premiers['francetravail']) && $rec) $envoyer([], count($rec) . ' entreprises d’Île-de-France vont recruter des agents de sécurité : proposez-leur vos agents.', [], 'entreprises-qui-recrutent', array_map(fn($o) => (int)$o['id'], array_slice($rec, 0, 10)));
    // les rappels J-3 déjà proches sont inclus dans ce récapitulatif
    db()->exec("UPDATE opportunites SET notifie = 1");
    db()->prepare("UPDATE opportunites SET rappel_j3 = 1 WHERE date_limite <> '' AND date_limite <= ?")->execute([date('Y-m-d H:i:s', time() + veille_config()['rappel_jours'] * 86400)]);
    // s'il ne s'agissait que du premier lancement d'une source, on n'envoie rien de plus pour l'autre
    $ao = isset($premiers['boamp']) ? [] : $ao;
    $rec = isset($premiers['francetravail']) ? [] : $rec;
    $aoNotif = isset($premiers['boamp']) ? [] : $aoNotif;
  }

  // 2) Nouveaux appels d'offres : un par un si 3 ou moins, sinon un résumé
  if ($aoNotif) {
    if (count($aoNotif) <= 3) {
      foreach ($aoNotif as $o) {
        $j = veille_jours_restants((string)$o['date_limite']);
        $envoyer([discord_embed($o)], '🔔 **Nouvel appel d’offres**', ['title' => ($o['type'] === 'chauffeur' ? '🚘 ' : '🛡️ ') . 'Nouvel appel d’offres', 'body' => mb_substr($o['titre'], 0, 120) . ' — ' . $o['acheteur'] . ($j !== null ? " (J-$j)" : ''), 'url' => '/admin/#/opportunites/' . $o['id'], 'tag' => 'opp-' . $o['id']], 'appels-offres', [(int)$o['id']]);
      }
    } else {
      $embeds = array_map(fn($o) => discord_embed($o), array_slice($aoNotif, 0, 10));
      $reste = count($aoNotif) - count($embeds);
      $envoyer($embeds, '🔔 **' . count($aoNotif) . ' nouveaux appels d’offres**' . ($reste > 0 ? " (les 10 plus intéressants ci-dessous, $reste autres dans l'admin)" : ''),
        ['title' => count($aoNotif) . ' nouveaux appels d’offres', 'body' => 'Dont : ' . mb_substr($aoNotif[0]['titre'], 0, 90) . '…', 'url' => '/admin/#/opportunites', 'tag' => 'veille-resume'], 'appels-offres', array_map(fn($o) => (int)$o['id'], array_slice($aoNotif, 0, 25)));
    }
  }
  // 3) Nouveaux recrutements (employeurs directs) : un résumé
  if ($rec) {
    $embeds = array_map(fn($o) => discord_embed($o), array_slice($rec, 0, 5));
    $envoyer($embeds, '👥 **' . count($rec) . ' entreprise(s) vont recruter des agents de sécurité**' . (count($rec) > 5 ? ' (5 premières ci-dessous)' : '') . ' : proposez-leur vos agents.',
      ['title' => count($rec) . ' entreprise(s) qui recrutent', 'body' => $rec[0]['acheteur'] . ' — ' . mb_substr($rec[0]['titre'], 0, 80), 'url' => '/admin/#/opportunites', 'tag' => 'veille-recrutements'], 'entreprises-qui-recrutent', array_map(fn($o) => (int)$o['id'], array_slice($rec, 0, 25)));
  }
  if ($ao || $rec) db()->exec('UPDATE opportunites SET notifie = 1 WHERE notifie = 0');

  // 4) Rappel unique à J-3
  $c = veille_config();
  $st = db()->prepare("SELECT * FROM opportunites WHERE source = 'boamp' AND statut <> 'ignore' AND rappel_j3 = 0 AND date_limite <> '' AND date_limite > ? AND date_limite <= ? ORDER BY date_limite");
  $st->execute([veille_maintenant(), date('Y-m-d 23:59:59', time() + $c['rappel_jours'] * 86400)]);
  $rappels = array_values(array_filter($st->fetchAll(), fn($o) => veille_notifiable($o['niveau']) || $o['statut'] === 'contacte'));
  if ($rappels) {
    if (count($rappels) <= 3) {
      foreach ($rappels as $o) {
        $j = veille_jours_restants((string)$o['date_limite']);
        $envoyer([discord_embed($o, "⏰ J-$j · ")], "⏰ **Rappel : date limite dans $j jour(s)**", ['title' => "⏰ J-$j : date limite proche", 'body' => mb_substr($o['titre'], 0, 120), 'url' => '/admin/#/opportunites/' . $o['id'], 'tag' => 'rappel-' . $o['id']], 'appels-offres', [(int)$o['id']], "J-$j · ");
      }
    } else {
      $envoyer(array_map(fn($o) => discord_embed($o, '⏰ J-' . veille_jours_restants((string)$o['date_limite']) . ' · '), array_slice($rappels, 0, 10)), '⏰ **' . count($rappels) . ' appels d’offres arrivent à leur date limite**',
        ['title' => '⏰ ' . count($rappels) . ' dates limites proches', 'body' => 'Ouvrez la veille pour ne rien rater.', 'url' => '/admin/#/opportunites', 'tag' => 'rappels'], 'appels-offres', array_map(fn($o) => (int)$o['id'], array_slice($rappels, 0, 25)), 'Date limite proche · ');
    }
    $ids = implode(',', array_map(fn($o) => (int)$o['id'], $rappels));
    db()->exec("UPDATE opportunites SET rappel_j3 = 1 WHERE id IN ($ids)");
  }
  $res['discord'] = ['ok' => $discordOk, 'message' => $discordOk ? '' : implode(' ', array_unique($erreurs))];
  return $res;
}
