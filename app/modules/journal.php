<?php
/* =========================================================
   MODULE « Main courante » — le cahier de poste de chaque site, sans papier
   L'agent touche un bouton (ouverture, fermeture, ronde…), note un visiteur ou une livraison,
   ou écrit une note : l'heure est prise toute seule. La prise et la fin de service (pointage)
   et les incidents signalés s'ajoutent d'eux-mêmes. Un compteur « Personnes reçues » sert aux
   postes d'accueil. La direction voit tout en direct (admin), le client aussi (espace client).
   ========================================================= */

const MOD_JOURNAL_BOUTONS = ['Ouverture des portes', 'Ouverture au public', 'Fermeture au public', 'Fermeture des portes', 'Ronde faite'];
const MOD_JOURNAL_INCIDENTS = ['intrusion' => 'Intrusion', 'vol' => 'Vol, dégradation', 'agression' => 'Agression', 'incendie' => 'Incendie, alarme',
  'secours' => 'Secours à personne', 'technique' => 'Problème technique', 'ronde' => 'Ronde, contrôle', 'autre' => 'Événement'];

function module_journal(): array
{
  $lire = fn (string $fn): array => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => $fn];
  $ecrire = fn (string $fn): array => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => $fn];
  return [
    'titre' => 'Main courante',
    'schema' => [1 => <<<'SQL'
      CREATE TABLE IF NOT EXISTS m_journal_lignes (id INTEGER PRIMARY KEY, site_id INTEGER NOT NULL DEFAULT 0, site_nom TEXT NOT NULL DEFAULT '',
        agent_id INTEGER NOT NULL, quand TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'bouton', libelle TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
        depart TEXT NOT NULL DEFAULT '', nombre INTEGER NOT NULL DEFAULT 0, photo TEXT NOT NULL DEFAULT '', annule TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL, maj TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS i_m_journal_site ON m_journal_lignes (site_id, quand);
      CREATE INDEX IF NOT EXISTS i_m_journal_agent ON m_journal_lignes (agent_id, quand);
      CREATE TABLE IF NOT EXISTS m_journal_sites (site_id INTEGER PRIMARY KEY, boutons TEXT NOT NULL DEFAULT '', compteur INTEGER NOT NULL DEFAULT 1,
        client INTEGER NOT NULL DEFAULT 1, maj TEXT NOT NULL DEFAULT '');
      CREATE TABLE IF NOT EXISTS m_journal_compteurs (site_id INTEGER NOT NULL, jour TEXT NOT NULL, nombre INTEGER NOT NULL DEFAULT 0, maj TEXT NOT NULL, PRIMARY KEY (site_id, jour));
      SQL],
    'admin' => [
      'sites' => $lire('mod_journal_adm_sites'),
      'jour' => $lire('mod_journal_adm_jour'),
      'reglages' => $ecrire('mod_journal_adm_reglages'),
      'photo' => $lire('mod_journal_adm_photo'),
    ],
    'equipe' => [
      'jour' => ['methode' => 'GET', 'fn' => 'mod_journal_eq_jour'],
      'ajouter' => ['methode' => 'POST', 'fn' => 'mod_journal_eq_ajouter'],
      'depart' => ['methode' => 'POST', 'fn' => 'mod_journal_eq_depart'],
      'annuler' => ['methode' => 'POST', 'fn' => 'mod_journal_eq_annuler'],
      'compteur' => ['methode' => 'POST', 'fn' => 'mod_journal_eq_compteur'],
      'photo' => ['methode' => 'GET', 'fn' => 'mod_journal_eq_photo'],
    ],
    'client' => [
      'jour' => ['methode' => 'GET', 'fn' => 'mod_journal_cl_jour'],
    ],
  ];
}

/* ---------- Outils ---------- */
function mod_journal_jour(mixed $v): string
{
  $j = (string)($v ?? '');
  return preg_match('/^\d{4}-\d{2}-\d{2}$/', $j) && $j <= date('Y-m-d') ? $j : date('Y-m-d');
}
// « PETIT Yanis » / « Yanis PETIT » → « Yanis P. » (le client ne voit jamais le nom complet)
function mod_journal_nom_court(string $nom): string
{
  $mots = preg_split('/\s+/', trim($nom)) ?: [];
  $prenoms = array_filter($mots, fn ($m) => mb_strtoupper($m) !== $m);
  $noms = array_filter($mots, fn ($m) => mb_strtoupper($m) === $m);
  $prenom = $prenoms ? implode(' ', $prenoms) : ($mots[0] ?? '');
  $nomFamille = $noms ? reset($noms) : (count($mots) > 1 ? end($mots) : '');
  return trim($prenom . ($nomFamille !== '' && $nomFamille !== $prenom ? ' ' . mb_substr($nomFamille, 0, 1) . '.' : ''));
}
function mod_journal_reglages(int $siteId): array
{
  $st = db()->prepare('SELECT boutons, compteur, client FROM m_journal_sites WHERE site_id = ?');
  $st->execute([$siteId]);
  $r = $st->fetch();
  $boutons = $r ? (json_decode((string)$r['boutons'], true) ?: []) : [];
  return ['boutons' => $boutons ?: MOD_JOURNAL_BOUTONS, 'compteur' => $r ? (int)$r['compteur'] === 1 : true, 'client' => $r ? (int)$r['client'] === 1 : true];
}
function mod_journal_compteur(int $siteId, string $jour): int
{
  $st = db()->prepare('SELECT nombre FROM m_journal_compteurs WHERE site_id = ? AND jour = ?');
  $st->execute([$siteId, $jour]);
  return (int)$st->fetchColumn();
}
// Le site où l'agent travaille maintenant : poste du planning des sites en cours (ou proche), sinon le site du pointage en cours
function mod_journal_site_agent(int $agentId): array
{
  require_once __DIR__ . '/../exploitation.php';
  $maintenant = time();
  $meilleur = null;
  foreach (exp_vacations(date('Y-m-d', $maintenant - 86400), date('Y-m-d'), $agentId) as $v) {
    [$debut, $fin] = exp_bornes($v);
    if ($maintenant >= $debut - 5400 && $maintenant <= $fin + 3600) { $meilleur = $v; break; }
  }
  if ($meilleur) return ['id' => (int)$meilleur['site_id'], 'nom' => (string)$meilleur['site_nom']];
  $st = db()->prepare("SELECT site FROM pointages WHERE agent_id = ? ORDER BY (fin = '') DESC, id DESC LIMIT 1");
  $st->execute([$agentId]);
  $nom = (string)$st->fetchColumn();
  if ($nom !== '') {
    $s = db()->prepare('SELECT id FROM sites WHERE nom = ? COLLATE NOCASE LIMIT 1');
    $s->execute([$nom]);
    $id = (int)$s->fetchColumn();
    if ($id) return ['id' => $id, 'nom' => $nom];
  }
  // site inconnu : le cahier reste propre à l'agent (clé négative), jamais montré à un client
  return ['id' => -$agentId, 'nom' => $nom];
}
// Les lignes d'un site entre deux instants : notes du cahier + prises et fins de service + incidents signalés
function mod_journal_lignes(int $siteId, string $siteNom, string $du, string $au, bool $pourClient = false): array
{
  $db = db();
  $lignes = [];
  $noms = [];
  $nomAgent = function (int $id) use ($db, &$noms): string {
    if (!isset($noms[$id])) {
      $st = $db->prepare('SELECT nom FROM agents WHERE id = ?');
      $st->execute([$id]);
      $noms[$id] = mod_journal_nom_court((string)$st->fetchColumn());
    }
    return $noms[$id];
  };
  $st = $db->prepare("SELECT * FROM m_journal_lignes WHERE site_id = ? AND annule = '' AND quand >= ? AND quand <= ? ORDER BY quand, id");
  $st->execute([$siteId, $du, $au]);
  foreach ($st->fetchAll() as $l) {
    $lignes[] = ['id' => (int)$l['id'], 'quand' => (string)$l['quand'], 'type' => (string)$l['type'], 'libelle' => (string)$l['libelle'], 'detail' => (string)$l['detail'],
      'depart' => (string)$l['depart'], 'nombre' => (int)$l['nombre'], 'photo' => !$pourClient && (string)$l['photo'] !== '', 'agent' => $nomAgent((int)$l['agent_id']), 'agentId' => (int)$l['agent_id'],
      'cree' => (string)$l['cree']];
  }
  if ($siteNom !== '') {
    // prise et fin de service : le pointage porte le nom du site
    $st = $db->prepare("SELECT agent_id, debut, fin FROM pointages WHERE site = ? COLLATE NOCASE AND ((debut >= ? AND debut <= ?) OR (fin >= ? AND fin <= ?))");
    $st->execute([$siteNom, $du, $au, $du, $au]);
    foreach ($st->fetchAll() as $p) {
      if ($p['debut'] >= $du && $p['debut'] <= $au) $lignes[] = ['id' => 0, 'quand' => (string)$p['debut'], 'type' => 'prise', 'libelle' => 'Prise de service', 'detail' => '', 'depart' => '', 'nombre' => 0, 'photo' => false, 'agent' => $nomAgent((int)$p['agent_id']), 'agentId' => (int)$p['agent_id'], 'cree' => ''];
      if ((string)$p['fin'] !== '' && $p['fin'] >= $du && $p['fin'] <= $au) $lignes[] = ['id' => 0, 'quand' => (string)$p['fin'], 'type' => 'fin', 'libelle' => 'Fin de service', 'detail' => '', 'depart' => '', 'nombre' => 0, 'photo' => false, 'agent' => $nomAgent((int)$p['agent_id']), 'agentId' => (int)$p['agent_id'], 'cree' => ''];
    }
    // incidents signalés depuis l'appli (le client voit le type et le texte, comme dans un cahier)
    $st = $db->prepare("SELECT agent_id, quand, categorie, gravite, texte FROM main_courante WHERE site = ? COLLATE NOCASE AND quand >= ? AND quand <= ?");
    $st->execute([$siteNom, substr($du, 0, 16), substr($au, 0, 16) . ':59']);
    foreach ($st->fetchAll() as $m) {
      $quand = strlen((string)$m['quand']) === 16 ? $m['quand'] . ':00' : (string)$m['quand'];
      $lignes[] = ['id' => 0, 'quand' => str_replace('T', ' ', $quand), 'type' => 'incident', 'libelle' => (MOD_JOURNAL_INCIDENTS[$m['categorie']] ?? 'Événement') . ($m['gravite'] === 'urgente' ? ' · urgent' : ''),
        'detail' => mb_substr((string)$m['texte'], 0, 400), 'depart' => '', 'nombre' => 0, 'photo' => false, 'agent' => $nomAgent((int)$m['agent_id']), 'agentId' => (int)$m['agent_id'], 'cree' => ''];
    }
  }
  usort($lignes, fn ($a, $b) => strcmp($a['quand'], $b['quand']));
  if ($pourClient) foreach ($lignes as &$l) unset($l['agentId'], $l['cree'], $l['id']);
  return $lignes;
}
function mod_journal_dossier(): string
{
  $dir = dossier_donnees() . '/journal';
  if (!is_dir($dir) && !@mkdir($dir, 0700, true)) throw new RuntimeException('Espace de stockage indisponible.');
  return $dir;
}
function mod_journal_servir_photo(string $fichier): void
{
  $chemin = mod_journal_dossier() . '/' . basename($fichier);
  if ($fichier === '' || !is_file($chemin)) echec('Photo introuvable.', 404);
  header('Content-Type: ' . (type_fichier($chemin) ?: 'image/jpeg'));
  header('Content-Length: ' . filesize($chemin));
  header('Cache-Control: private, max-age=3600');
  header('X-Content-Type-Options: nosniff');
  readfile($chemin);
  exit;
}

/* =========================================================
   APPLI DES AGENTS
   ========================================================= */
function mod_journal_eq_jour(): void
{
  $c = eq_exiger();
  $aid = (int)$c['agent_id'];
  $site = mod_journal_site_agent($aid);
  // le cahier du poste : depuis la prise de service en cours (poste de nuit compris), sinon depuis minuit
  $st = db()->prepare("SELECT debut FROM pointages WHERE agent_id = ? AND fin = '' ORDER BY id DESC LIMIT 1");
  $st->execute([$aid]);
  $debutPoste = (string)$st->fetchColumn();
  $du = $debutPoste !== '' ? min($debutPoste, date('Y-m-d 00:00:00')) : date('Y-m-d 00:00:00');
  $au = date('Y-m-d H:i:s', time() + 3600);
  $reg = mod_journal_reglages($site['id']);
  // noms déjà vus sur ce site (visiteurs, sociétés) pour les proposer en un geste
  $s = db()->prepare("SELECT libelle, COUNT(*) AS n FROM m_journal_lignes WHERE site_id = ? AND type = 'visiteur' AND annule = '' GROUP BY libelle COLLATE NOCASE ORDER BY n DESC LIMIT 12");
  $s->execute([$site['id']]);
  $lignes = array_map(fn ($l) => $l + ['moi' => $l['agentId'] === $aid], mod_journal_lignes($site['id'], $site['nom'], $du, $au));
  repondre(['ok' => true, 'site' => $site, 'boutons' => $reg['boutons'], 'compteur' => ['actif' => $reg['compteur'], 'nombre' => mod_journal_compteur($site['id'], date('Y-m-d'))],
    'enService' => $debutPoste !== '', 'lignes' => $lignes, 'suggestions' => array_column($s->fetchAll(), 'libelle'), 'serveur' => maintenant()]);
}
function mod_journal_eq_ajouter(): void
{
  $c = eq_exiger();
  $aid = (int)$c['agent_id'];
  $b = $_POST ?: corps();
  $type = in_array($b['type'] ?? '', ['bouton', 'visiteur', 'note'], true) ? (string)$b['type'] : 'note';
  $libelle = texte($b['libelle'] ?? '', 80);
  $detail = texte($b['detail'] ?? '', 1000);
  if ($type === 'note' && $libelle === '') $libelle = 'Note';
  if ($libelle === '') throw new RuntimeException($type === 'visiteur' ? 'Indiquez le nom de la personne ou de la société.' : 'Rien à noter.');
  if ($type === 'note' && $detail === '' && empty($_FILES['photo']['tmp_name'])) throw new RuntimeException('Écrivez la note.');
  $recul = max(0, min(240, (int)($b['minutes'] ?? 0)));
  $quand = date('Y-m-d H:i:s', time() - $recul * 60);
  // ligne notée sans réseau : l'appli l'envoie plus tard avec son heure réelle (24 h au plus)
  $hors = (string)($b['quand'] ?? '');
  if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $hors) && $hors >= date('Y-m-d H:i:s', time() - 86400) && $hors <= date('Y-m-d H:i:s', time() + 300)) $quand = $hors;
  $site = mod_journal_site_agent($aid);
  $reg = mod_journal_reglages($site['id']);
  $nombre = 0;
  // la fermeture au public garde le nombre de personnes reçues dans la journée
  if ($type === 'bouton' && $reg['compteur'] && preg_match('/fermeture au public/i', $libelle)) {
    $nombre = mod_journal_compteur($site['id'], date('Y-m-d'));
    if ($nombre > 0) $detail = trim($nombre . ' personne' . ($nombre > 1 ? 's' : '') . ' reçue' . ($nombre > 1 ? 's' : '') . ($detail !== '' ? " · $detail" : ''));
  }
  $photo = '';
  if (!empty($_FILES['photo']['tmp_name']) && is_uploaded_file((string)$_FILES['photo']['tmp_name'])) {
    if ((int)$_FILES['photo']['size'] > 8 * 1024 * 1024) throw new RuntimeException('Photo trop lourde (8 Mo maximum).');
    $mime = type_fichier((string)$_FILES['photo']['tmp_name']);
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) throw new RuntimeException('Photo en JPG, PNG ou WEBP uniquement.');
    $photo = bin2hex(random_bytes(16)) . '.bin';
    if (!move_uploaded_file((string)$_FILES['photo']['tmp_name'], mod_journal_dossier() . '/' . $photo)) throw new RuntimeException('Enregistrement de la photo impossible.');
  }
  db()->prepare('INSERT INTO m_journal_lignes (site_id, site_nom, agent_id, quand, type, libelle, detail, nombre, photo, cree, maj) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([$site['id'], $site['nom'], $aid, $quand, $type, $libelle, $detail, $nombre, $photo, maintenant(), maintenant()]);
  repondre(['ok' => true, 'id' => (int)db()->lastInsertId(), 'quand' => $quand]);
}
// Une ligne de l'agent lui-même, encore modifiable
function mod_journal_ligne_agent(int $id, int $aid, int $heures): array
{
  $st = db()->prepare("SELECT * FROM m_journal_lignes WHERE id = ? AND agent_id = ? AND annule = '' AND cree >= ?");
  $st->execute([$id, $aid, date('Y-m-d H:i:s', time() - $heures * 3600)]);
  $l = $st->fetch();
  if (!$l) throw new RuntimeException('Cette ligne ne peut plus être modifiée.');
  return $l;
}
function mod_journal_eq_depart(): void
{
  $c = eq_exiger();
  $l = mod_journal_ligne_agent((int)(corps()['id'] ?? 0), (int)$c['agent_id'], 24);
  if ($l['type'] !== 'visiteur') throw new RuntimeException('Seuls les visiteurs ont une heure de départ.');
  db()->prepare('UPDATE m_journal_lignes SET depart = ?, maj = ? WHERE id = ?')->execute([maintenant(), maintenant(), $l['id']]);
  repondre(['ok' => true, 'depart' => maintenant()]);
}
// « Annuler » juste après un geste de travers (5 minutes) : la ligne est écartée, pas effacée
function mod_journal_eq_annuler(): void
{
  $c = eq_exiger();
  $l = mod_journal_ligne_agent((int)(corps()['id'] ?? 0), (int)$c['agent_id'], 1);
  if ($l['cree'] < date('Y-m-d H:i:s', time() - 300)) throw new RuntimeException('Trop tard pour annuler : ajoutez plutôt une note de correction.');
  db()->prepare('UPDATE m_journal_lignes SET annule = ?, maj = ? WHERE id = ?')->execute([maintenant(), maintenant(), $l['id']]);
  repondre(['ok' => true]);
}
function mod_journal_eq_compteur(): void
{
  $c = eq_exiger();
  $b = corps();
  $site = mod_journal_site_agent((int)$c['agent_id']);
  $jour = date('Y-m-d');
  $actuel = mod_journal_compteur($site['id'], $jour);
  $nouveau = array_key_exists('valeur', $b) ? (int)$b['valeur'] : $actuel + (int)($b['delta'] ?? 1);
  $nouveau = max(0, min(100000, $nouveau));
  db()->prepare('INSERT INTO m_journal_compteurs (site_id, jour, nombre, maj) VALUES (?, ?, ?, ?) ON CONFLICT(site_id, jour) DO UPDATE SET nombre = excluded.nombre, maj = excluded.maj')
    ->execute([$site['id'], $jour, $nouveau, maintenant()]);
  repondre(['ok' => true, 'nombre' => $nouveau]);
}
function mod_journal_eq_photo(): void
{
  $c = eq_exiger();
  $site = mod_journal_site_agent((int)$c['agent_id']);
  $st = db()->prepare("SELECT photo FROM m_journal_lignes WHERE id = ? AND site_id = ? AND annule = ''");
  $st->execute([(int)($_GET['id'] ?? 0), $site['id']]);
  mod_journal_servir_photo((string)$st->fetchColumn());
}

/* =========================================================
   DIRECTION (admin)
   ========================================================= */
function mod_journal_adm_sites(): void
{
  $jour = mod_journal_jour($_GET['jour'] ?? '');
  $st = db()->prepare("SELECT s.id, s.nom, c.nom AS client, (SELECT COUNT(*) FROM m_journal_lignes l WHERE l.site_id = s.id AND l.annule = '' AND l.quand LIKE ?) AS lignes
      FROM sites s LEFT JOIN clients c ON c.id = s.client_id WHERE s.actif = 1 ORDER BY lignes DESC, s.nom COLLATE NOCASE");
  $st->execute(["$jour%"]);
  repondre(['ok' => true, 'jour' => $jour, 'sites' => array_map(fn ($s) => ['id' => (int)$s['id'], 'nom' => (string)$s['nom'], 'client' => (string)$s['client'], 'lignes' => (int)$s['lignes']], $st->fetchAll())]);
}
function mod_journal_adm_jour(): void
{
  $id = (int)($_GET['site_id'] ?? 0);
  $jour = mod_journal_jour($_GET['jour'] ?? '');
  $st = db()->prepare('SELECT s.nom, c.nom AS client FROM sites s LEFT JOIN clients c ON c.id = s.client_id WHERE s.id = ?');
  $st->execute([$id]);
  $s = $st->fetch();
  if (!$s) throw new RuntimeException('Site introuvable.');
  repondre(['ok' => true, 'site' => ['id' => $id, 'nom' => (string)$s['nom'], 'client' => (string)$s['client']], 'jour' => $jour, 'reglages' => mod_journal_reglages($id),
    'compteur' => mod_journal_compteur($id, $jour), 'lignes' => mod_journal_lignes($id, (string)$s['nom'], "$jour 00:00:00", "$jour 23:59:59")]);
}
function mod_journal_adm_reglages(): void
{
  $b = corps();
  $id = (int)($b['site_id'] ?? 0);
  $st = db()->prepare('SELECT nom FROM sites WHERE id = ?');
  $st->execute([$id]);
  $nom = (string)$st->fetchColumn();
  if ($nom === '') throw new RuntimeException('Site introuvable.');
  $boutons = array_values(array_unique(array_filter(array_map(fn ($x) => texte($x, 60), (array)($b['boutons'] ?? [])))));
  $boutons = array_slice($boutons, 0, 12);
  db()->prepare('INSERT INTO m_journal_sites (site_id, boutons, compteur, client, maj) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(site_id) DO UPDATE SET boutons = excluded.boutons, compteur = excluded.compteur, client = excluded.client, maj = excluded.maj')
    ->execute([$id, json_encode($boutons, JSON_UNESCAPED_UNICODE), !empty($b['compteur']) ? 1 : 0, !empty($b['client']) ? 1 : 0, maintenant()]);
  journal('exploitation', "Main courante de $nom : réglages modifiés");
  repondre(['ok' => true, 'reglages' => mod_journal_reglages($id)]);
}
function mod_journal_adm_photo(): void
{
  $st = db()->prepare("SELECT photo FROM m_journal_lignes WHERE id = ?");
  $st->execute([(int)($_GET['id'] ?? 0)]);
  mod_journal_servir_photo((string)$st->fetchColumn());
}

/* =========================================================
   ESPACE CLIENT : le cahier de ses sites, en direct (sans photos ni noms complets)
   ========================================================= */
function mod_journal_cl_jour(): void
{
  if (!function_exists('exiger_compte')) echec('Connexion requise.', 401);
  $c = exiger_compte();
  $jour = mod_journal_jour($_GET['jour'] ?? '');
  $st = db()->prepare('SELECT id, nom FROM sites WHERE client_id = ? AND actif = 1 ORDER BY ordre, nom');
  $st->execute([(int)$c['client_id']]);
  $sites = [];
  foreach ($st->fetchAll() as $s) {
    $reg = mod_journal_reglages((int)$s['id']);
    if (!$reg['client']) continue;
    $sites[] = ['nom' => (string)$s['nom'], 'compteur' => $reg['compteur'] ? mod_journal_compteur((int)$s['id'], $jour) : null,
      'lignes' => mod_journal_lignes((int)$s['id'], (string)$s['nom'], "$jour 00:00:00", "$jour 23:59:59", true)];
  }
  repondre(['ok' => true, 'jour' => $jour, 'aujourdhui' => $jour === date('Y-m-d'), 'sites' => $sites]);
}
