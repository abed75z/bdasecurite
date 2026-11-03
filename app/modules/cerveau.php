<?php
/* =========================================================
   MODULE « CERVEAU » — le directeur des opérations (version 16)
   - Priorités du jour : des règles simples sur les données de l'admin (postes non pourvus,
     cartes professionnelles, 48 h par semaine, factures en retard, devis sans réponse,
     consignes non lues, contrôles qualité…), triées par urgence, chacune avec son lien.
     Rien n'est modifié ni envoyé automatiquement : chaque carte mène à la bonne page.
   - Point du jour rédigé par Claude, sur demande et si une clé API est réglée
     (page Assistance) : il ne reçoit que les titres des cartes, sans aucun nom.
   - Demander : une question libre (Ctrl K) ; Claude répond à partir d'un résumé de l'activité
     (planning des 7 prochains jours, sites, agents, cartes, chiffres). Jamais de téléphone,
     d'adresse, de mail, de paie ni de santé. Il propose des liens vers l'admin, il ne modifie rien.
   - Résumé du matin : une notification à la direction vers 7 h (catégorie « Résumé du matin »),
     seulement les titres des priorités.
   ========================================================= */
declare(strict_types=1);

const MOD_CERVEAU_NIVEAUX = ['urgent' => 0, 'important' => 1, 'conseil' => 2];
const MOD_CERVEAU_JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOD_CERVEAU_MOIS = ['', 'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function module_cerveau(): array
{
  return [
    'titre' => 'Directeur des opérations',
    'schema' => [
      1 => <<<'SQL'
        CREATE TABLE IF NOT EXISTS m_cerveau_questions (id INTEGER PRIMARY KEY, question TEXT NOT NULL, reponse TEXT NOT NULL DEFAULT '',
          par TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL);
        SQL,
    ],
    'admin' => [
      'cartes' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_cerveau_adm_cartes'],
      'point' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_cerveau_adm_point'],
      'demander' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_cerveau_adm_demander'],
      'questions' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_cerveau_adm_questions'],
      'reglages' => ['methode' => 'POST', 'roles' => ['admin'], 'fn' => 'mod_cerveau_adm_reglages'],
    ],
    'cron' => 'mod_cerveau_cron',
  ];
}

/* ---------- Petits outils ---------- */
function mod_cerveau_jour(string $iso): string
{
  $t = strtotime($iso);
  return MOD_CERVEAU_JOURS[(int)date('w', $t)] . ' ' . (int)date('j', $t) . ' ' . MOD_CERVEAU_MOIS[(int)date('n', $t)];
}
function mod_cerveau_fr(string $iso): string
{
  return preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $iso, $m) ? "$m[3]/$m[2]/$m[1]" : $iso;
}
function mod_cerveau_euros(float $v): string
{
  return number_format($v, 0, ',', ' ') . ' €';
}
function mod_cerveau_table(string $nom): bool
{
  $st = db()->prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?");
  $st->execute([$nom]);
  return (bool)$st->fetchColumn();
}
function mod_cerveau_reglages(): array
{
  $r = mod_reglage('cerveau', 'reglages', []);
  return ['matin' => !is_array($r) || !array_key_exists('matin', $r) ? true : (bool)$r['matin']];
}

/* =========================================================
   Les règles : chaque carte = niveau, domaine, titre (sans nom), détail, lien
   $argent : montants visibles (administrateurs seulement)
   ========================================================= */
function mod_cerveau_cartes(bool $argent): array
{
  require_once __DIR__ . '/../exploitation.php';
  $db = db();
  $auj = date('Y-m-d');
  $mtn = time();
  $cartes = [];
  $ajouter = function (string $niveau, string $domaine, string $titre, string $detail, string $lien, string $action, array $liste = []) use (&$cartes) {
    $cartes[] = ['niveau' => $niveau, 'domaine' => $domaine, 'titre' => $titre, 'detail' => $detail, 'lien' => $lien, 'action' => $action, 'liste' => array_slice($liste, 0, 6), 'plus' => max(0, count($liste) - 6)];
  };
  $n = fn (int $x, string $un, string $plusieurs) => $x . ' ' . ($x > 1 ? $plusieurs : $un);

  // 1. Alertes des agents (SOS, « Tout va bien ? » sans réponse)
  foreach ($db->query("SELECT type, COUNT(*) AS n FROM alertes_agents WHERE statut = 'ouverte' GROUP BY type") as $a) {
    $x = (int)$a['n'];
    if ($a['type'] === 'presence') $ajouter('urgent', 'terrain', $n($x, 'agent de nuit ne répond pas', 'agents de nuit ne répondent pas') . ' au « Tout va bien ? »', 'Appelez-le tout de suite depuis le Centre de contrôle.', '#/controle', 'Ouvrir le Centre de contrôle');
    else $ajouter('urgent', 'terrain', $n($x, 'alerte SOS en cours', 'alertes SOS en cours'), 'Un agent a déclenché une alerte : prenez-la en charge.', '#/controle', 'Ouvrir le Centre de contrôle');
  }

  // Planning des 14 prochains jours
  $vacs = exp_vacations($auj, date('Y-m-d', $mtn + 14 * 86400));
  $libVac = fn (array $v) => mod_cerveau_jour($v['jour']) . ', ' . $v['debut'] . '-' . $v['fin'] . ' · ' . ($v['site_nom'] ?: 'Site');

  // 2. Postes non pourvus
  $bientot = $plusTard = [];
  foreach ($vacs as $v) {
    if ($v['agent_id'] > 0) continue;
    [, $f] = exp_bornes($v);
    if ($f <= $mtn) continue;
    if ($v['jour'] <= date('Y-m-d', $mtn + 2 * 86400)) $bientot[] = $libVac($v);
    else $plusTard[] = $libVac($v);
  }
  if ($bientot) $ajouter('urgent', 'exploitation', $n(count($bientot), 'poste sans agent', 'postes sans agent') . ' dans les 48 h', 'Le client attend quelqu’un : affectez un agent ou utilisez « Remplir ».', '#/exploitation', 'Ouvrir le planning', $bientot);
  if ($plusTard) {
    $enBourse = mod_cerveau_table('m_planif_bourse') ? (int)$db->query("SELECT COUNT(*) FROM m_planif_bourse WHERE statut = 'ouverte'")->fetchColumn() : 0;
    $ajouter('important', 'exploitation', $n(count($plusTard), 'poste à pourvoir', 'postes à pourvoir') . ' dans les 2 semaines',
      $enBourse ? "$enBourse déjà proposés aux agents dans la bourse aux postes." : 'Proposez-les aux agents : le premier disponible les prend.', '#/planif/bourse', 'Bourse aux postes', $plusTard);
  }

  // 3. Cartes professionnelles (CNAPS)
  $prochains = [];
  foreach ($vacs as $v) if ($v['agent_id'] > 0 && !isset($prochains[$v['agent_id']])) $prochains[$v['agent_id']] = $v['jour'];
  $expirees = $bientotExp = $sansCarte = [];
  foreach ($db->query("SELECT id, nom, poste, carte, validite FROM agents WHERE actif = 1 AND poste <> 'Gérant' ORDER BY nom COLLATE NOCASE") as $a) {
    $val = (string)$a['validite'];
    $prevu = isset($prochains[(int)$a['id']]);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $val)) {
      if ($prevu) $sansCarte[] = $a['nom'] . ' · prévu le ' . mod_cerveau_jour($prochains[(int)$a['id']]);
      continue;
    }
    if ($val < $auj) $expirees[] = ['prevu' => $prevu, 'txt' => $a['nom'] . ' · expirée le ' . mod_cerveau_fr($val) . ($prevu ? ' · prévu le ' . mod_cerveau_jour($prochains[(int)$a['id']]) : '')];
    elseif ($val <= date('Y-m-d', $mtn + 60 * 86400)) $bientotExp[] = $a['nom'] . ' · expire le ' . mod_cerveau_fr($val);
  }
  $expPrevus = array_filter($expirees, fn ($x) => $x['prevu']);
  if ($expPrevus) $ajouter('urgent', 'equipe', $n(count($expPrevus), 'agent planifié avec une carte pro expirée', 'agents planifiés avec une carte pro expirée'), 'Un agent sans carte valide ne peut pas travailler : remplacez-le ou mettez la carte à jour.', '#/agents', 'Voir les agents', array_column($expPrevus, 'txt'));
  if (count($expirees) > count($expPrevus)) $ajouter('important', 'equipe', $n(count($expirees) - count($expPrevus), 'carte pro expirée', 'cartes pro expirées') . ' (agents actifs)', 'Mettez la date à jour dans la fiche de l’agent, ou passez-le en inactif.', '#/agents', 'Voir les agents', array_column(array_filter($expirees, fn ($x) => !$x['prevu']), 'txt'));
  if ($bientotExp) $ajouter('important', 'equipe', $n(count($bientotExp), 'carte pro expire', 'cartes pro expirent') . ' dans les 60 jours', 'Le renouvellement auprès du CNAPS prend du temps : prévenez les agents.', '#/agents', 'Voir les agents', $bientotExp);
  if ($sansCarte) $ajouter('important', 'equipe', $n(count($sansCarte), 'agent planifié', 'agents planifiés') . ' sans date de carte pro', 'Renseignez le numéro et la date de validité dans leur fiche.', '#/agents', 'Voir les agents', $sansCarte);

  // 4. 48 heures par semaine civile (semaine en cours)
  $lundi = date('Y-m-d', strtotime('monday this week', $mtn));
  $minutes = [];
  $noms = [];
  foreach (exp_vacations($lundi, date('Y-m-d', strtotime($lundi . ' +6 days'))) as $v) {
    if ($v['agent_id'] <= 0) continue;
    $minutes[$v['agent_id']] = ($minutes[$v['agent_id']] ?? 0) + exp_minutes($v);
  }
  if ($minutes) {
    $ids = implode(',', array_map('intval', array_keys($minutes)));
    foreach ($db->query("SELECT id, nom FROM agents WHERE id IN ($ids)") as $a) $noms[(int)$a['id']] = $a['nom'];
  }
  $max = defined('MOD_PLANIF_SEMAINE_MAX') ? MOD_PLANIF_SEMAINE_MAX : 48 * 60;
  $trop = $proche = [];
  foreach ($minutes as $id => $m) {
    $txt = ($noms[$id] ?? 'Agent') . ' · ' . round($m / 60, 1) . ' h cette semaine';
    if ($m > $max) $trop[] = str_replace('.', ',', $txt);
    elseif ($m >= $max - 4 * 60) $proche[] = str_replace('.', ',', $txt);
  }
  if ($trop) $ajouter('urgent', 'exploitation', $n(count($trop), 'agent dépasse', 'agents dépassent') . ' 48 h cette semaine', 'C’est le maximum légal : retirez des postes ou confiez-les à des collègues.', '#/exploitation', 'Ouvrir le planning', $trop);
  if ($proche) $ajouter('conseil', 'exploitation', $n(count($proche), 'agent proche', 'agents proches') . ' des 48 h cette semaine', 'Évitez de leur ajouter des heures d’ici dimanche.', '#/exploitation', 'Ouvrir le planning', $proche);

  // 5. Échanges de postes à valider
  if (mod_cerveau_table('m_planif_echanges')) {
    $x = (int)$db->query("SELECT COUNT(*) FROM m_planif_echanges WHERE statut = 'acceptee'")->fetchColumn();
    if ($x) $ajouter('important', 'exploitation', $n($x, 'échange de poste à valider', 'échanges de postes à valider'), 'Un collègue a accepté de reprendre le poste : il ne manque que votre accord.', '#/planif', 'Voir les échanges');
  }

  // 6. Consignes non lues par des agents qui travaillent dans les 24 h
  if (mod_cerveau_table('m_terrain_consignes') && mod_cerveau_table('m_terrain_lectures')) {
    $cour = [];
    foreach ($db->query('SELECT site_id, MAX(version) AS v FROM m_terrain_consignes GROUP BY site_id') as $c) $cour[(int)$c['site_id']] = (int)$c['v'];
    $lues = [];
    foreach ($db->query('SELECT site_id, agent_id, MAX(version) AS v FROM m_terrain_lectures GROUP BY site_id, agent_id') as $l) $lues[(int)$l['site_id'] . '-' . (int)$l['agent_id']] = (int)$l['v'];
    $nonLues = [];
    $vu = [];
    foreach ($vacs as $v) {
      if ($v['agent_id'] <= 0 || empty($cour[$v['site_id']])) continue;
      [$d, $f] = exp_bornes($v);
      if ($d > $mtn + 24 * 3600) break;
      if ($f <= $mtn) continue;
      $cle = $v['site_id'] . '-' . $v['agent_id'];
      if (isset($vu[$cle]) || ($lues[$cle] ?? 0) >= $cour[$v['site_id']]) continue;
      $vu[$cle] = true;
      $nonLues[] = ($noms[$v['agent_id']] ?? (string)$db->query('SELECT nom FROM agents WHERE id = ' . (int)$v['agent_id'])->fetchColumn()) . ' · ' . ($v['site_nom'] ?: 'Site') . ', ' . mod_cerveau_jour($v['jour']) . ' ' . $v['debut'];
    }
    if ($nonLues) $ajouter('important', 'terrain', $n(count($nonLues), 'agent n’a pas lu', 'agents n’ont pas lu') . ' les consignes avant son poste', 'Ils les trouvent dans leur Espace équipe, page Consignes. Un appel suffit à le leur rappeler.', '#/terrain', 'Terrain & qualité', $nonLues);
  }

  // 7. Matériel à récupérer, contrôles qualité
  if (function_exists('mod_terrain_a_recuperer')) {
    $rec = mod_terrain_a_recuperer();
    if ($rec) $ajouter('conseil', 'terrain', $n(count($rec), 'objet à récupérer', 'objets à récupérer') . ' chez des agents partis', 'Badges, clés ou tenues encore chez des agents sortis ou inactifs.', '#/terrain/materiel', 'Matériel & tenues',
      array_map(fn ($x) => $x['libelle'] . ' · ' . $x['agent'], $rec));
  }
  if (mod_cerveau_table('m_terrain_controles')) {
    $st = $db->prepare("SELECT c.moyenne, c.quand, s.nom FROM m_terrain_controles c LEFT JOIN sites s ON s.id = c.site_id WHERE c.archive = '' AND c.quand >= ? AND c.moyenne < 3 ORDER BY c.quand DESC");
    $st->execute([date('Y-m-d H:i:s', $mtn - 30 * 86400)]);
    $faibles = array_map(fn ($c) => ($c['nom'] ?: 'Site') . ' · ' . str_replace('.', ',', (string)round((float)$c['moyenne'], 1)) . '/5 le ' . mod_cerveau_fr((string)$c['quand']), $st->fetchAll());
    if ($faibles) $ajouter('important', 'terrain', $n(count($faibles), 'contrôle qualité faible', 'contrôles qualité faibles') . ' ce mois-ci', 'Note sous 3 sur 5 : revoyez les consignes avec l’agent et repassez sur le site.', '#/terrain/controles', 'Voir les contrôles', $faibles);
    // sites qui travaillent ce mois-ci sans contrôle depuis 60 jours
    $actifs = [];
    foreach ($vacs as $v) if ($v['agent_id'] > 0) $actifs[$v['site_id']] = $v['site_nom'] ?: 'Site';
    if ($actifs) {
      $st = $db->prepare("SELECT site_id, MAX(quand) AS dernier FROM m_terrain_controles WHERE archive = '' GROUP BY site_id");
      $st->execute();
      $derniers = [];
      foreach ($st as $c) $derniers[(int)$c['site_id']] = (string)$c['dernier'];
      $oublies = [];
      foreach ($actifs as $id => $nom) {
        $d = $derniers[$id] ?? '';
        if ($d === '' || $d < date('Y-m-d H:i:s', $mtn - 60 * 86400)) $oublies[] = $nom . ' · ' . ($d ? 'dernier contrôle le ' . mod_cerveau_fr($d) : 'jamais contrôlé');
      }
      if ($oublies) $ajouter('conseil', 'terrain', $n(count($oublies), 'site actif', 'sites actifs') . ' sans contrôle qualité depuis 2 mois', 'Une visite de 10 minutes, notée depuis votre téléphone, rassure le client et tient les agents.', '#/terrain/controle/nouveau', 'Nouveau contrôle', $oublies);
    }
  }

  // 8. Factures en retard, devis sans réponse
  $st = $db->prepare("SELECT numero, client, total, echeance FROM documents WHERE type = 'facture' AND statut = 'envoyee' AND echeance <> '' AND echeance < ? ORDER BY echeance");
  $st->execute([$auj]);
  $retards = $st->fetchAll();
  if ($retards) {
    $total = array_sum(array_map(fn ($f) => (float)$f['total'], $retards));
    $ajouter('important', 'facturation', $n(count($retards), 'facture en retard de paiement', 'factures en retard de paiement'), ($argent ? mod_cerveau_euros($total) . ' à encaisser. ' : '') . 'Les relances sont prêtes dans la Messagerie : vous relisez, vous envoyez.', '#/messagerie/relances', 'Préparer les relances',
      array_map(fn ($f) => $f['numero'] . ' · ' . $f['client'] . ' · échue le ' . mod_cerveau_fr((string)$f['echeance']) . ($argent ? ' · ' . mod_cerveau_euros((float)$f['total']) : ''), $retards));
  }
  $st = $db->prepare("SELECT numero, client, total, date FROM documents WHERE type = 'devis' AND statut = 'envoye' AND date <> '' AND date <= ? ORDER BY date");
  $st->execute([date('Y-m-d', $mtn - 7 * 86400)]);
  $devis = $st->fetchAll();
  if ($devis) $ajouter('important', 'facturation', $n(count($devis), 'devis sans réponse', 'devis sans réponse') . ' depuis plus d’une semaine', 'Un appel au client fait souvent signer : demandez s’il a des questions.', '#/devis', 'Voir les devis',
    array_map(fn ($d) => $d['numero'] . ' · ' . $d['client'] . ' · envoyé le ' . mod_cerveau_fr((string)$d['date']) . ($argent ? ' · ' . mod_cerveau_euros((float)$d['total']) : ''), $devis));

  // 9. Clients et équipe qui attendent une réponse
  $st = $db->query("SELECT COUNT(*) AS n, MIN(recu) AS plus_ancien FROM demandes WHERE statut = 'nouvelle'")->fetch();
  if ((int)$st['n']) {
    $vieux = (string)$st['plus_ancien'] < date('Y-m-d H:i:s', $mtn - 24 * 3600);
    $ajouter($vieux ? 'urgent' : 'important', 'clients', $n((int)$st['n'], 'demande de client', 'demandes de clients') . ' sans réponse', $vieux ? 'La plus ancienne attend depuis plus de 24 h : un client qui attend va voir ailleurs.' : 'Répondez dans la journée.', '#/demandes', 'Voir les demandes');
  }
  $x = (int)$db->query("SELECT COUNT(*) FROM messages_clients WHERE auteur = 'client' AND lu = 0")->fetchColumn();
  if ($x) $ajouter('important', 'clients', $n($x, 'message de client non lu', 'messages de clients non lus'), 'Messages reçus dans l’espace client.', '#/messages', 'Lire les messages');
  $x = (int)$db->query("SELECT (SELECT COUNT(*) FROM absences WHERE statut = 'attente') + (SELECT COUNT(*) FROM comptes_equipe WHERE statut = 'attente')")->fetchColumn();
  if ($x) $ajouter('important', 'equipe', $n($x, 'demande de l’équipe', 'demandes de l’équipe') . ' à valider', 'Congés, absences ou nouveaux comptes de l’Espace équipe.', '#/equipe', 'Espace équipe');

  // 10. Développement
  $x = (int)$db->query("SELECT COUNT(*) FROM candidatures WHERE statut = 'nouvelle'")->fetchColumn();
  if ($x) $ajouter('conseil', 'equipe', $n($x, 'nouvelle candidature', 'nouvelles candidatures'), 'Des renforts possibles pour les postes non pourvus.', '#/candidatures', 'Voir les candidatures');
  $x = (int)$db->query("SELECT COUNT(*) FROM opportunites WHERE statut = 'a_traiter'")->fetchColumn();
  if ($x) $ajouter('conseil', 'clients', $n($x, 'appel d’offres à regarder', 'appels d’offres à regarder'), 'Gardiennage et surveillance seulement (autorisation CNAPS).', '#/opportunites', 'Trouver des clients');
  $x = (int)$db->query("SELECT COUNT(*) FROM prospects WHERE relance <> '' AND relance <= '$auj' AND statut NOT IN ('client', 'refus', 'ignore')")->fetchColumn();
  if ($x) $ajouter('conseil', 'clients', $n($x, 'prospect à rappeler', 'prospects à rappeler') . ' aujourd’hui', 'Rappels notés dans Trouver des clients.', '#/opportunites', 'Trouver des clients');
  $x = (int)$db->query("SELECT COUNT(*) FROM avis WHERE statut = 'attente'")->fetchColumn();
  if ($x) $ajouter('conseil', 'clients', $n($x, 'avis client à publier', 'avis clients à publier'), 'Relisez-les avant qu’ils apparaissent sur le site.', '#/avis', 'Voir les avis');

  // 11. Conseil : « Tout va bien ? » éteint alors que des agents travaillent la nuit cette semaine
  if (function_exists('mod_presence_reglages') && !mod_presence_reglages()['actif']) {
    $nuits = 0;
    foreach ($vacs as $v) if ($v['agent_id'] > 0 && $v['jour'] <= date('Y-m-d', $mtn + 7 * 86400) && ($v['debut'] >= '20:00' || $v['fin'] <= '07:00' && $v['fin'] < $v['debut'])) $nuits++;
    if ($nuits) $ajouter('conseil', 'terrain', $n($nuits, 'poste de nuit', 'postes de nuit') . ' cette semaine sans « Tout va bien ? »', 'Le contrôle de présence protège vos agents seuls la nuit. Il est désactivé.', '#/presence', 'Régler « Tout va bien ? »');
  }

  usort($cartes, fn ($a, $b) => MOD_CERVEAU_NIVEAUX[$a['niveau']] <=> MOD_CERVEAU_NIVEAUX[$b['niveau']]);
  return $cartes;
}

/* =========================================================
   Claude (même clé que l'assistant du site, page Assistance)
   ========================================================= */
function mod_cerveau_claude(string $systeme, string $question, int $max = 1200): ?string
{
  require_once __DIR__ . '/../assistant.php';
  $ia = assist_ia_reglages();
  if ($ia['cle'] === '' || !function_exists('curl_init')) return null;
  if (getenv('BDA_NO_MAIL')) return "Réponse d'essai (tests sur ordinateur, Claude n'est pas appelé).\n\n" . mb_substr($question, 0, 120);
  $ch = curl_init('https://api.anthropic.com/v1/messages');
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 45,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_HTTPHEADER => ['content-type: application/json', 'x-api-key: ' . $ia['cle'], 'anthropic-version: 2023-06-01'],
    CURLOPT_POSTFIELDS => json_encode([
      'model' => ASSIST_MODELE,
      'max_tokens' => $max,
      'output_config' => ['effort' => 'low'],
      'system' => $systeme,
      'messages' => [['role' => 'user', 'content' => $question]],
    ], JSON_UNESCAPED_UNICODE),
  ]);
  $brut = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($brut === false || $code !== 200) {
    error_log('[BDA module cerveau] API Claude : HTTP ' . $code . ' ' . substr((string)$brut, 0, 300));
    return null;
  }
  $r = json_decode((string)$brut, true);
  if (!is_array($r) || ($r['stop_reason'] ?? '') === 'refusal') return null;
  $texte = '';
  foreach ((array)($r['content'] ?? []) as $bloc) if (($bloc['type'] ?? '') === 'text') $texte .= $bloc['text'];
  return trim($texte) === '' ? null : trim($texte);
}
function mod_cerveau_ia_dispo(): bool
{
  require_once __DIR__ . '/../assistant.php';
  return assist_ia_reglages()['cle'] !== '';
}

// Résumé de l'activité pour une question libre : planning, sites, agents, priorités (jamais de coordonnées, de paie ni de santé)
function mod_cerveau_contexte(bool $argent): string
{
  require_once __DIR__ . '/../exploitation.php';
  $db = db();
  $auj = date('Y-m-d');
  $l = ['Aujourd’hui : ' . mod_cerveau_jour($auj) . ' ' . date('Y') . ', ' . date('H\hi') . '.'];
  $agents = [];
  foreach ($db->query("SELECT id, nom, poste, validite, actif FROM agents ORDER BY nom COLLATE NOCASE") as $a) $agents[(int)$a['id']] = $a;
  $l[] = "\n## Agents actifs (nom · qualification · carte pro valable jusqu’au)";
  foreach ($agents as $a) if ((int)$a['actif']) $l[] = '- ' . $a['nom'] . ' · ' . $a['poste'] . ' · ' . ($a['validite'] ? mod_cerveau_fr((string)$a['validite']) : 'non renseignée');
  $l[] = "\n## Sites (nom · client)";
  foreach (exp_sites() as $s) $l[] = '- ' . $s['nom'] . ' · ' . ($s['client_nom'] ?: 'sans client');
  $l[] = "\n## Planning du jour et des 7 prochains jours (jour · horaires · site · agent)";
  foreach (exp_vacations($auj, date('Y-m-d', time() + 7 * 86400)) as $v) {
    $l[] = '- ' . mod_cerveau_jour($v['jour']) . ' · ' . $v['debut'] . '-' . $v['fin'] . ' · ' . ($v['site_nom'] ?: 'Site') . ' · ' . ($v['agent_id'] > 0 ? ($agents[$v['agent_id']]['nom'] ?? 'Agent') : 'NON POURVU');
  }
  $l[] = "\n## Priorités calculées par l’admin";
  foreach (mod_cerveau_cartes($argent) as $c) {
    $l[] = '- [' . $c['niveau'] . '] ' . $c['titre'] . ' — ' . $c['detail'] . ' (page ' . $c['lien'] . ')';
    foreach ($c['liste'] as $x) $l[] = '  · ' . $x;
  }
  if ($argent) {
    $st = $db->prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS t FROM documents WHERE type = 'facture' AND statut <> 'annulee' AND date >= ?");
    $st->execute([date('Y-m-01')]);
    $f = $st->fetch();
    $l[] = "\n## Facturation du mois : " . (int)$f['n'] . ' factures, ' . mod_cerveau_euros((float)$f['t']) . ' HT ou TTC selon la facture.';
  }
  return implode("\n", $l);
}

const MOD_CERVEAU_PAGES = '#/cerveau (priorités), #/exploitation (planning des sites), #/planif (échanges), #/planif/bourse, #/agents, #/terrain, #/terrain/materiel, #/terrain/controles, #/terrain/controle/nouveau, #/presence, #/controle (centre de contrôle), #/messagerie, #/messagerie/nouveau, #/messagerie/relances, #/devis, #/factures, #/clients, #/demandes, #/equipe, #/candidatures, #/opportunites, #/pilotage, #/paie';

/* =========================================================
   ADMIN
   ========================================================= */
function mod_cerveau_adm_cartes(): void
{
  $argent = role_courant() === 'admin';
  $cartes = mod_cerveau_cartes($argent);
  $point = mod_reglage('cerveau', 'point', null);
  repondre([
    'ok' => true,
    'cartes' => $cartes,
    'totaux' => ['urgent' => count(array_filter($cartes, fn ($c) => $c['niveau'] === 'urgent')), 'important' => count(array_filter($cartes, fn ($c) => $c['niveau'] === 'important')), 'conseil' => count(array_filter($cartes, fn ($c) => $c['niveau'] === 'conseil'))],
    'point' => is_array($point) && ($point['jour'] ?? '') === date('Y-m-d') ? $point : null,
    'ia' => mod_cerveau_ia_dispo(),
    'reglages' => mod_cerveau_reglages(),
    'maintenant' => maintenant(),
  ]);
}
function mod_cerveau_adm_point(): void
{
  if (!mod_cerveau_ia_dispo()) throw new RuntimeException('Aucune clé Claude réglée : ajoutez-la dans la page Assistance (réglages de l’assistant).');
  if (!limiter('cerveau-point', 12, 3600)) throw new RuntimeException('Point du jour déjà demandé plusieurs fois : réessayez dans un moment.');
  $cartes = mod_cerveau_cartes(false);
  // seulement les titres (des nombres, aucun nom)
  $liste = $cartes ? implode("\n", array_map(fn ($c) => '- [' . $c['niveau'] . '] ' . $c['titre'], $cartes)) : '- Rien à signaler.';
  $texte = mod_cerveau_claude(
    'Tu es le directeur des opérations de BDA Security Group, une entreprise de sécurité privée (gardiennage, surveillance) en Île-de-France. '
    . 'Tu écris au gérant le point du jour : 4 à 6 phrases en français, ton direct et professionnel, sans liste à puces ni titre, sans formule de politesse. '
    . 'Commence par le plus urgent, dis quoi faire en premier, puis ensuite. N’invente aucun chiffre ni aucun fait absent de la liste. '
    . 'S’il n’y a rien d’urgent, dis-le simplement et propose une action utile pour développer l’activité.',
    "Priorités calculées ce matin (" . mod_cerveau_jour(date('Y-m-d')) . ") :\n" . $liste, 700);
  if ($texte === null) throw new RuntimeException('Claude n’a pas répondu. Réessayez dans un instant.');
  $point = ['jour' => date('Y-m-d'), 'texte' => $texte, 'cree' => maintenant(), 'par' => (string)($_SESSION['login'] ?? '')];
  mod_reglage_ecrire('cerveau', 'point', $point);
  repondre(['ok' => true, 'point' => $point]);
}
function mod_cerveau_adm_demander(): void
{
  $q = trim(chaine(corps()['question'] ?? ''));
  if (mb_strlen($q) < 3) throw new RuntimeException('Posez une question un peu plus longue.');
  if (mb_strlen($q) > 600) throw new RuntimeException('Question trop longue (600 caractères au plus).');
  if (!mod_cerveau_ia_dispo()) throw new RuntimeException('Aucune clé Claude réglée : ajoutez-la dans la page Assistance (réglages de l’assistant).');
  if (!limiter('cerveau-demander', 40, 3600)) throw new RuntimeException('Beaucoup de questions d’affilée : réessayez dans un moment.');
  $argent = role_courant() === 'admin';
  $reponse = mod_cerveau_claude(
    'Tu es l’assistant de direction de BDA Security Group (sécurité privée : gardiennage et surveillance seulement, autorisation CNAPS ; jamais de protection rapprochée). '
    . 'Tu réponds au gérant en français, court et concret (quelques phrases ou une petite liste), uniquement à partir des données ci-dessous ; si l’information n’y est pas, dis-le. '
    . 'Tu ne modifies rien toi-même : quand une action est utile, donne un lien Markdown vers la page de l’admin, au format [texte](#/page), en choisissant parmi : ' . MOD_CERVEAU_PAGES . '. '
    . 'Règles du métier à respecter dans tes conseils : 48 h de travail au plus par semaine, 11 h de repos entre deux postes, 12 h au plus par jour, carte professionnelle valide obligatoire.'
    . "\n\n# Données de l’admin\n" . mod_cerveau_contexte($argent),
    $q, 1500);
  if ($reponse === null) throw new RuntimeException('Claude n’a pas répondu. Réessayez dans un instant.');
  db()->prepare('INSERT INTO m_cerveau_questions (question, reponse, par, cree) VALUES (?, ?, ?, ?)')->execute([$q, $reponse, (string)($_SESSION['login'] ?? ''), maintenant()]);
  db()->exec('DELETE FROM m_cerveau_questions WHERE id NOT IN (SELECT id FROM m_cerveau_questions ORDER BY id DESC LIMIT 200)');
  repondre(['ok' => true, 'reponse' => $reponse]);
}
function mod_cerveau_adm_questions(): void
{
  $st = db()->query('SELECT id, question, reponse, par, cree FROM m_cerveau_questions ORDER BY id DESC LIMIT 20');
  repondre(['ok' => true, 'questions' => $st->fetchAll(), 'ia' => mod_cerveau_ia_dispo()]);
}
function mod_cerveau_adm_reglages(): void
{
  $r = ['matin' => !empty(corps()['matin'])];
  mod_reglage_ecrire('cerveau', 'reglages', $r);
  repondre(['ok' => true, 'reglages' => $r]);
}

/* =========================================================
   Tâche automatique : résumé du matin (vers 7 h, une fois par jour)
   ========================================================= */
function mod_cerveau_cron(string $origine = 'auto'): array
{
  if (!mod_cerveau_reglages()['matin'] || !mod_une_fois_par_jour('cerveau', 'matin', 7)) return ['matin' => false];
  $cartes = mod_cerveau_cartes(false);
  $urg = array_values(array_filter($cartes, fn ($c) => $c['niveau'] === 'urgent'));
  $imp = array_values(array_filter($cartes, fn ($c) => $c['niveau'] === 'important'));
  if (!$urg && !$imp) {
    notifier('matin', 'Bonjour : rien d’urgent ce matin', 'Le planning et les dossiers sont à jour. Bonne journée.', '/admin/#/cerveau', 'matin-' . date('Ymd'));
    return ['matin' => true, 'cartes' => 0];
  }
  $titre = 'Bonjour : ' . ($urg ? count($urg) . ' urgence' . (count($urg) > 1 ? 's' : '') : '') . ($urg && $imp ? ', ' : '') . ($imp ? count($imp) . ' à traiter' : '');
  $texte = implode(' · ', array_map(fn ($c) => $c['titre'], array_slice(array_merge($urg, $imp), 0, 3)));
  notifier('matin', $titre, $texte, '/admin/#/cerveau', 'matin-' . date('Ymd'));
  return ['matin' => true, 'cartes' => count($cartes)];
}
