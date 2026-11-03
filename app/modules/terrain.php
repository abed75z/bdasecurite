<?php
/* =========================================================
   MODULE « TERRAIN & QUALITÉ » (version 13)
   - Classeur de chaque site (table sites du cœur) : consignes versionnées (version en vigueur
     + historique), documents du site (plans, photos, procédures), numéros d'urgence,
     registre des clés et badges (objet, nombre, emplacement, qui l'a, depuis quand).
   - Accusés de lecture : dans son Espace équipe, l'agent lit les consignes des sites où il a
     des postes à venir et confirme « J'ai lu et compris » (agent, version, date) ;
     l'admin voit qui a lu quelle version et qui ne l'a pas lue.
   - Matériel & tenues : inventaire, remise à un agent, retour (date, état), liste « à récupérer »
     chez les agents sortis ou inactifs ; l'agent voit « Mon matériel » (lecture seule).
   - Contrôles qualité sur site (formulaire pensé pour le téléphone) : 6 critères notés de 1 à 5,
     commentaire, photo ; historique par site et par agent ; note moyenne par site sur 3 mois
     (pour les rapports clients : mod_terrain_note_site()).
   Rien n'est supprimé : documents, clés, matériel et contrôles sont « retirés » (colonne archive).
   Les consignes publiées ici sont aussi recopiées dans le champ « Consignes » de la fiche du
   planning (sites.consignes), que l'Espace équipe montre avec chaque poste ; une modification
   faite dans la fiche est repérée et peut être publiée comme nouvelle version.
   ========================================================= */
declare(strict_types=1);

const MOD_TERRAIN_TYPES_DOC = ['plan' => 'Plan', 'photo' => 'Photo', 'procedure' => 'Procédure', 'autre' => 'Autre document'];
const MOD_TERRAIN_TYPES_MAT = ['talkie' => 'Talkie-walkie', 'badge' => 'Badge', 'tenue' => 'Tenue', 'cle' => 'Clé', 'lampe' => 'Lampe', 'autre' => 'Autre'];
const MOD_TERRAIN_ETATS = ['neuf' => 'Neuf', 'bon' => 'Bon état', 'use' => 'Usé', 'abime' => 'Abîmé', 'hs' => 'Hors service', 'perdu' => 'Perdu'];
const MOD_TERRAIN_CRITERES = ['tenue' => 'Tenue', 'presence' => 'Présence au poste', 'consignes' => 'Connaissance des consignes', 'main_courante' => 'Main courante à jour', 'attitude' => 'Attitude', 'proprete' => 'Propreté du poste'];
const MOD_TERRAIN_FENETRE = 21;          // jours : postes « à venir » (comme « Mes prochains postes » de l'Espace équipe)
const MOD_TERRAIN_REVISION = 183;        // jours : au-delà, des consignes sont « à relire »
const MOD_TERRAIN_MAX_TEXTE = 12000;     // caractères d'une version de consignes
const MOD_TERRAIN_MAX_COEUR = 4000;      // taille du champ « Consignes » de la fiche du planning
const MOD_TERRAIN_MAX_DOC = 15728640;    // 15 Mo par document
const MOD_TERRAIN_MAX_PHOTO = 8388608;   // 8 Mo par photo de contrôle
const MOD_TERRAIN_FORMATS = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

function module_terrain(): array
{
  $lire = fn (string $fn): array => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => $fn];
  $ecrire = fn (string $fn): array => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => $fn];
  return [
    'titre' => 'Terrain & qualité',
    'schema' => [1 => <<<'SQL'
      CREATE TABLE IF NOT EXISTS m_terrain_consignes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, site_id INTEGER NOT NULL, version INTEGER NOT NULL,
        texte TEXT NOT NULL DEFAULT '', resume TEXT NOT NULL DEFAULT '', origine TEXT NOT NULL DEFAULT 'classeur',
        auteur TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL, UNIQUE(site_id, version));
      CREATE TABLE IF NOT EXISTS m_terrain_lectures (
        id INTEGER PRIMARY KEY AUTOINCREMENT, consigne_id INTEGER NOT NULL, site_id INTEGER NOT NULL, version INTEGER NOT NULL,
        agent_id INTEGER NOT NULL, lu TEXT NOT NULL, appareil TEXT NOT NULL DEFAULT '', UNIQUE(consigne_id, agent_id));
      CREATE INDEX IF NOT EXISTS m_terrain_lectures_site ON m_terrain_lectures (site_id, version);
      CREATE INDEX IF NOT EXISTS m_terrain_lectures_agent ON m_terrain_lectures (agent_id);
      CREATE TABLE IF NOT EXISTS m_terrain_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT, site_id INTEGER NOT NULL, type TEXT NOT NULL DEFAULT 'autre', titre TEXT NOT NULL DEFAULT '',
        fichier TEXT NOT NULL, nom TEXT NOT NULL DEFAULT '', mime TEXT NOT NULL DEFAULT '', taille INTEGER NOT NULL DEFAULT 0,
        agents INTEGER NOT NULL DEFAULT 0, ajoute TEXT NOT NULL, par TEXT NOT NULL DEFAULT '', archive TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS m_terrain_documents_site ON m_terrain_documents (site_id);
      CREATE TABLE IF NOT EXISTS m_terrain_sites (
        site_id INTEGER PRIMARY KEY, urgences TEXT NOT NULL DEFAULT '[]', maj TEXT NOT NULL DEFAULT '');
      CREATE TABLE IF NOT EXISTS m_terrain_cles (
        id INTEGER PRIMARY KEY AUTOINCREMENT, site_id INTEGER NOT NULL, objet TEXT NOT NULL, nombre INTEGER NOT NULL DEFAULT 1,
        emplacement TEXT NOT NULL DEFAULT '', detenteur TEXT NOT NULL DEFAULT '', agent_id INTEGER NOT NULL DEFAULT 0,
        depuis TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL, maj TEXT NOT NULL, archive TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS m_terrain_cles_site ON m_terrain_cles (site_id);
      CREATE TABLE IF NOT EXISTS m_terrain_cles_hist (
        id INTEGER PRIMARY KEY AUTOINCREMENT, cle_id INTEGER NOT NULL, quand TEXT NOT NULL, detenteur TEXT NOT NULL DEFAULT '',
        emplacement TEXT NOT NULL DEFAULT '', nombre INTEGER NOT NULL DEFAULT 1, depuis TEXT NOT NULL DEFAULT '', par TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS m_terrain_cles_hist_cle ON m_terrain_cles_hist (cle_id);
      CREATE TABLE IF NOT EXISTS m_terrain_materiel (
        id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL DEFAULT 'autre', libelle TEXT NOT NULL, numero TEXT NOT NULL DEFAULT '',
        taille TEXT NOT NULL DEFAULT '', etat TEXT NOT NULL DEFAULT 'bon', site_id INTEGER NOT NULL DEFAULT 0, agent_id INTEGER NOT NULL DEFAULT 0,
        remis_le TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL, maj TEXT NOT NULL, archive TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS m_terrain_materiel_agent ON m_terrain_materiel (agent_id);
      CREATE TABLE IF NOT EXISTS m_terrain_mouvements (
        id INTEGER PRIMARY KEY AUTOINCREMENT, materiel_id INTEGER NOT NULL, agent_id INTEGER NOT NULL, agent_nom TEXT NOT NULL DEFAULT '',
        remis_le TEXT NOT NULL, etat_remise TEXT NOT NULL DEFAULT '', rendu_le TEXT NOT NULL DEFAULT '', etat_retour TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '', par TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS m_terrain_mouvements_materiel ON m_terrain_mouvements (materiel_id);
      CREATE INDEX IF NOT EXISTS m_terrain_mouvements_agent ON m_terrain_mouvements (agent_id);
      CREATE TABLE IF NOT EXISTS m_terrain_controles (
        id INTEGER PRIMARY KEY AUTOINCREMENT, site_id INTEGER NOT NULL, agent_id INTEGER NOT NULL DEFAULT 0, agent_nom TEXT NOT NULL DEFAULT '',
        quand TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '{}', moyenne REAL NOT NULL DEFAULT 0, commentaire TEXT NOT NULL DEFAULT '',
        photo TEXT NOT NULL DEFAULT '', photo_mime TEXT NOT NULL DEFAULT '', controleur TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL,
        archive TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS m_terrain_controles_site ON m_terrain_controles (site_id, quand);
      CREATE INDEX IF NOT EXISTS m_terrain_controles_agent ON m_terrain_controles (agent_id, quand);
      SQL],
    'admin' => [
      'ensemble' => $lire('mod_terrain_ensemble'),
      'site' => $lire('mod_terrain_site_detail'),
      'consigne.version' => $lire('mod_terrain_consigne_version'),
      'consigne.publier' => $ecrire('mod_terrain_consigne_publier'),
      'consigne.planning' => $ecrire('mod_terrain_consigne_planning'),
      'consignes.reprendre' => $ecrire('mod_terrain_consignes_reprendre'),
      'document' => $lire('mod_terrain_document'),
      'document.ajouter' => $ecrire('mod_terrain_document_ajouter'),
      'document.modifier' => $ecrire('mod_terrain_document_modifier'),
      'document.retirer' => $ecrire('mod_terrain_document_retirer'),
      'urgences.enregistrer' => $ecrire('mod_terrain_urgences_enregistrer'),
      'cle.enregistrer' => $ecrire('mod_terrain_cle_enregistrer'),
      'cle.retirer' => $ecrire('mod_terrain_cle_retirer'),
      'cle.historique' => $lire('mod_terrain_cle_historique'),
      'materiel' => $lire('mod_terrain_materiel'),
      'materiel.enregistrer' => $ecrire('mod_terrain_materiel_enregistrer'),
      'materiel.remettre' => $ecrire('mod_terrain_materiel_remettre'),
      'materiel.retour' => $ecrire('mod_terrain_materiel_retour'),
      'materiel.retirer' => $ecrire('mod_terrain_materiel_retirer'),
      'materiel.historique' => $lire('mod_terrain_materiel_historique'),
      'controle.options' => $lire('mod_terrain_controle_options'),
      'controle.enregistrer' => $ecrire('mod_terrain_controle_enregistrer'),
      'controle' => $lire('mod_terrain_controle'),
      'controle.photo' => $lire('mod_terrain_controle_photo'),
      'controle.retirer' => $ecrire('mod_terrain_controle_retirer'),
      'controles' => $lire('mod_terrain_controles'),
    ],
    'equipe' => [
      'consignes' => ['methode' => 'GET', 'fn' => 'mod_terrain_eq_consignes'],
      'lu' => ['methode' => 'POST', 'fn' => 'mod_terrain_eq_lu'],
      'document' => ['methode' => 'GET', 'fn' => 'mod_terrain_eq_document'],
      'materiel' => ['methode' => 'GET', 'fn' => 'mod_terrain_eq_materiel'],
    ],
    'compteurs' => 'mod_terrain_compteurs',
    'recherche' => 'mod_terrain_recherche',
  ];
}

/* =========================================================
   OUTILS
   ========================================================= */
// Nom de la personne connectée à l'admin (auteur d'une version, contrôleur…)
function mod_terrain_qui(): string
{
  $u = function_exists('utilisateur_courant') ? utilisateur_courant() : null;
  return $u ? (trim((string)$u['nom']) !== '' ? trim((string)$u['nom']) : (string)$u['login']) : '';
}
function mod_terrain_est_admin(): bool
{
  return function_exists('role_courant') && role_courant() === 'admin';
}
function mod_terrain_dossier(string $sous): string
{
  $dir = dossier_donnees() . '/terrain/' . $sous;
  if (!is_dir($dir) && !@mkdir($dir, 0700, true)) throw new RuntimeException('Espace de stockage indisponible. Réessayez dans un instant.');
  return $dir;
}
function mod_terrain_jour($v): string
{
  $j = is_string($v) ? trim($v) : '';
  return preg_match('/^\d{4}-\d{2}-\d{2}$/', $j) && strtotime($j) !== false ? $j : '';
}
function mod_terrain_mo(int $octets): string
{
  return str_replace('.', ',', (string)round($octets / 1048576, 1)) . ' Mo';
}
function mod_terrain_note_fr(float $n): string
{
  return number_format($n, 1, ',', '');
}
// Petite transaction (verrou d'écriture SQLite) : tout ou rien
function mod_terrain_transaction(callable $fn)
{
  $db = db();
  $db->exec('BEGIN IMMEDIATE');
  try {
    $r = $fn($db);
    $db->exec('COMMIT');
    return $r;
  } catch (Throwable $e) {
    try { $db->exec('ROLLBACK'); } catch (Throwable $e2) { /* rien à annuler */ }
    throw $e;
  }
}
function mod_terrain_site(int $id): array
{
  $st = db()->prepare('SELECT s.*, c.nom AS client_nom FROM sites s LEFT JOIN clients c ON c.id = s.client_id WHERE s.id = ?');
  $st->execute([$id]);
  $s = $st->fetch();
  if (!$s) throw new RuntimeException('Site introuvable : il a peut-être été retiré du planning.');
  return $s;
}
// Agents connus : id => [id, nom, actif, sortie (date de sortie notée dans la paie, '' sinon)]
function mod_terrain_agents(): array
{
  $out = [];
  foreach (db()->query('SELECT a.id, a.nom, a.actif, s.data FROM agents a LEFT JOIN salaries s ON s.agent_id = a.id ORDER BY a.nom COLLATE NOCASE') as $a) {
    $d = json_decode((string)($a['data'] ?? ''), true);
    $sortie = is_array($d) ? mod_terrain_jour($d['dateSortie'] ?? '') : '';
    $out[(int)$a['id']] = ['id' => (int)$a['id'], 'nom' => (string)$a['nom'], 'actif' => (int)$a['actif'] === 1, 'sortie' => $sortie];
  }
  return $out;
}
// Agent parti ? '' si toujours là, sinon la raison : sorti (paie), inactif, supprime (retiré de la liste)
function mod_terrain_parti(?array $a): string
{
  if (!$a) return 'supprime';
  if ($a['sortie'] !== '' && $a['sortie'] <= date('Y-m-d')) return 'sorti';
  return $a['actif'] ? '' : 'inactif';
}
function mod_terrain_agents_actifs(array $agents): array
{
  return array_values(array_map(fn ($a) => ['id' => $a['id'], 'nom' => $a['nom']], array_filter($agents, fn ($a) => mod_terrain_parti($a) === '')));
}
// Prochain poste de chaque agent sur chaque site, d'hier à J+21, postes terminés exclus :
// [site_id => [agent_id => ['jour', 'debut', 'fin']]]
function mod_terrain_prevus(int $agent = 0, int $site = 0): array
{
  require_once __DIR__ . '/../exploitation.php';
  $sql = "SELECT site_id, agent_id, jour, debut, fin FROM vacations WHERE statut <> 'annulee' AND agent_id > 0 AND jour >= ? AND jour <= ?";
  $p = [date('Y-m-d', time() - 86400), date('Y-m-d', time() + MOD_TERRAIN_FENETRE * 86400)];
  if ($agent) { $sql .= ' AND agent_id = ?'; $p[] = $agent; }
  if ($site) { $sql .= ' AND site_id = ?'; $p[] = $site; }
  $st = db()->prepare($sql . ' ORDER BY jour, debut');
  $st->execute($p);
  $out = [];
  $maintenant = time();
  foreach ($st as $v) {
    if (exp_bornes($v)[1] <= $maintenant) continue;
    $s = (int)$v['site_id'];
    $a = (int)$v['agent_id'];
    if (!isset($out[$s][$a])) $out[$s][$a] = ['jour' => (string)$v['jour'], 'debut' => (string)$v['debut'], 'fin' => (string)$v['fin']];
  }
  return $out;
}
// Version en vigueur des consignes de chaque site : [site_id => ligne]
function mod_terrain_courantes(bool $avecTexte = false, ?array $sites = null): array
{
  $cols = $avecTexte ? 'c.*' : 'c.id, c.site_id, c.version, c.resume, c.origine, c.auteur, c.cree';
  $filtre = '';
  $p = [];
  if ($sites !== null) {
    if (!$sites) return [];
    $filtre = ' WHERE site_id IN (' . implode(',', array_fill(0, count($sites), '?')) . ')';
    $p = array_values(array_map('intval', $sites));
  }
  $st = db()->prepare("SELECT $cols FROM m_terrain_consignes c JOIN (SELECT site_id, MAX(version) AS v FROM m_terrain_consignes$filtre GROUP BY site_id) m ON m.site_id = c.site_id AND m.v = c.version");
  $st->execute($p);
  $out = [];
  foreach ($st as $r) $out[(int)$r['site_id']] = $r;
  return $out;
}
// Ce qui est recopié dans la fiche du planning (champ limité à 4000 caractères)
function mod_terrain_texte_coeur(string $t): string
{
  if (mb_strlen($t) <= MOD_TERRAIN_MAX_COEUR) return $t;
  $suite = "\n… Suite dans « Consignes » de l’Espace équipe.";
  return rtrim(mb_substr($t, 0, MOD_TERRAIN_MAX_COEUR - mb_strlen($suite))) . $suite;
}
// État des consignes d'un site : aucune | planning (seulement dans la fiche du planning, pas suivies)
// | modifiee (fiche du planning changée depuis la version en vigueur) | ancienne (plus de 6 mois) | ok
function mod_terrain_etat_consignes(array $site, ?array $cour): string
{
  $coeur = trim((string)$site['consignes']);
  if (!$cour) return $coeur === '' ? 'aucune' : 'planning';
  if ($coeur !== mod_terrain_texte_coeur((string)$cour['texte'])) return 'modifiee';
  if ((int)strtotime((string)$cour['cree']) < time() - MOD_TERRAIN_REVISION * 86400) return 'ancienne';
  return 'ok';
}
// Note moyenne des contrôles d'un site sur N mois — pour les rapports clients
function mod_terrain_note_site(int $site, int $mois = 3): array
{
  $st = db()->prepare("SELECT COUNT(*) AS nb, AVG(moyenne) AS m, MAX(quand) AS dernier FROM m_terrain_controles WHERE site_id = ? AND archive = '' AND quand >= ?");
  $st->execute([$site, date('Y-m-d H:i:s', (int)strtotime("-$mois months"))]);
  $r = $st->fetch() ?: [];
  $nb = (int)($r['nb'] ?? 0);
  return ['moyenne' => $nb ? round((float)$r['m'], 2) : null, 'nb' => $nb, 'dernier' => (string)($r['dernier'] ?? '')];
}
// Fichier envoyé (multipart) : trop lourd, mal reçu, vrai format (lu dans le contenu)
function mod_terrain_envoi_trop_lourd(): void
{
  $long = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
  if ($long > limite_envoi()) throw new RuntimeException('Fichier trop lourd pour l’hébergement (' . mod_terrain_mo(limite_envoi()) . ' maximum).');
}
function mod_terrain_fichier_recu(string $champ, int $max, array $types): array
{
  $f = $_FILES[$champ] ?? null;
  if (!is_array($f)) throw new RuntimeException('Le fichier n’a pas été reçu. Réessayez.');
  $err = (int)($f['error'] ?? UPLOAD_ERR_NO_FILE);
  if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) throw new RuntimeException('Fichier trop lourd pour l’hébergement.');
  if ($err !== UPLOAD_ERR_OK || !is_uploaded_file((string)$f['tmp_name'])) throw new RuntimeException('Le fichier n’a pas été reçu. Réessayez.');
  if ((int)$f['size'] > $max) throw new RuntimeException('Fichier trop lourd (' . mod_terrain_mo($max) . ' maximum).');
  $mime = type_fichier((string)$f['tmp_name']);
  if (!in_array($mime, $types, true)) {
    throw new RuntimeException(in_array('application/pdf', $types, true) ? 'Format non accepté : PDF, JPG, PNG ou WEBP uniquement.' : 'Seules les photos (JPG, PNG ou WEBP) sont acceptées.');
  }
  return ['tmp' => (string)$f['tmp_name'], 'mime' => $mime, 'nom' => (string)($f['name'] ?? ''), 'taille' => (int)$f['size']];
}
// Envoi d'un fichier privé (jamais d'adresse publique), puis fin de la requête
function mod_terrain_servir(string $chemin, string $mime, string $nom, bool $telecharger): never
{
  if (!is_file($chemin)) echec('Fichier introuvable.', 404);
  $nom = trim((string)preg_replace('/[^\w .()-]+/u', '_', $nom)) ?: 'document';
  header('Content-Type: ' . $mime);
  header('Content-Length: ' . filesize($chemin));
  header('Content-Disposition: ' . ($telecharger ? 'attachment' : 'inline') . '; filename="' . $nom . '"');
  header('Cache-Control: private, no-store');
  header('X-Robots-Tag: noindex');
  header("Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  readfile($chemin);
  exit;
}
// Nom de fichier lisible : titre + extension du vrai format
function mod_terrain_nom_fichier(string $titre, string $mime): string
{
  $ext = MOD_TERRAIN_FORMATS[$mime] ?? 'bin';
  $base = preg_replace('/\.(pdf|jpe?g|png|webp)$/i', '', trim($titre)) ?: 'document';
  return mb_substr($base, 0, 80) . '.' . $ext;
}
function mod_terrain_urgences(int $site): array
{
  $st = db()->prepare('SELECT urgences FROM m_terrain_sites WHERE site_id = ?');
  $st->execute([$site]);
  $u = json_decode((string)$st->fetchColumn(), true);
  return is_array($u) ? array_values(array_filter($u, 'is_array')) : [];
}
// Matériel et clés encore chez des agents partis (sortis, inactifs ou retirés de la liste)
function mod_terrain_a_recuperer(?array $agents = null): array
{
  $db = db();
  $n = (int)$db->query("SELECT (SELECT COUNT(*) FROM m_terrain_materiel WHERE archive = '' AND agent_id > 0) + (SELECT COUNT(*) FROM m_terrain_cles WHERE archive = '' AND agent_id > 0)")->fetchColumn();
  if (!$n) return [];
  $agents ??= mod_terrain_agents();
  $admin = mod_terrain_est_admin();
  $out = [];
  $raison = function (int $id, string $nomSecours) use ($agents, $admin): ?array {
    $a = $agents[$id] ?? null;
    $r = mod_terrain_parti($a);
    if ($r === '') return null;
    return ['agent_id' => $id, 'agent' => $a['nom'] ?? $nomSecours, 'raison' => $r, 'sortie' => $admin && $a ? $a['sortie'] : ''];
  };
  $st = $db->query("SELECT m.id, m.type, m.libelle, m.numero, m.taille, m.etat, m.agent_id, m.remis_le, m.site_id,
      (SELECT agent_nom FROM m_terrain_mouvements v WHERE v.materiel_id = m.id AND v.rendu_le = '' ORDER BY v.id DESC LIMIT 1) AS agent_nom
    FROM m_terrain_materiel m WHERE m.archive = '' AND m.agent_id > 0 ORDER BY m.remis_le");
  foreach ($st as $m) {
    $r = $raison((int)$m['agent_id'], (string)($m['agent_nom'] ?? ''));
    if ($r) $out[] = ['genre' => 'materiel', 'id' => (int)$m['id'], 'libelle' => (string)$m['libelle'], 'type' => (string)$m['type'], 'numero' => (string)$m['numero'], 'depuis' => (string)$m['remis_le']] + $r;
  }
  $st = $db->query("SELECT k.id, k.objet, k.nombre, k.agent_id, k.detenteur, k.depuis, k.site_id, s.nom AS site FROM m_terrain_cles k LEFT JOIN sites s ON s.id = k.site_id WHERE k.archive = '' AND k.agent_id > 0 ORDER BY k.depuis");
  foreach ($st as $k) {
    $r = $raison((int)$k['agent_id'], (string)$k['detenteur']);
    if ($r) $out[] = ['genre' => 'cle', 'id' => (int)$k['id'], 'libelle' => (string)$k['objet'] . ((int)$k['nombre'] > 1 ? ' × ' . (int)$k['nombre'] : ''), 'type' => 'cle',
      'numero' => '', 'depuis' => (string)$k['depuis'], 'site_id' => (int)$k['site_id'], 'site' => (string)($k['site'] ?? '')] + $r;
  }
  return $out;
}

/* =========================================================
   BADGES ET RECHERCHE (Ctrl K)
   ========================================================= */
function mod_terrain_compteurs(): array
{
  return ['materiel' => count(mod_terrain_a_recuperer())];
}
function mod_terrain_recherche(): array
{
  $r = [];
  foreach (db()->query('SELECT s.id, s.nom, c.nom AS client FROM sites s LEFT JOIN clients c ON c.id = s.client_id WHERE s.actif = 1 ORDER BY s.ordre, s.nom COLLATE NOCASE') as $s) {
    $r[] = ['titre' => 'Classeur · ' . $s['nom'], 'sous' => 'Consignes, documents, clés, contrôles' . ($s['client'] ? ' · ' . $s['client'] : ''),
      'href' => '#/terrain/site/' . (int)$s['id'], 'ic' => 'dossier', 'groupe' => 'Terrain & qualité', 'mots' => 'classeur consignes site cles badges ' . (string)$s['client']];
  }
  $r[] = ['titre' => 'Matériel & tenues', 'sous' => 'Inventaire, remises aux agents, retours', 'href' => '#/terrain/materiel', 'ic' => 'cle', 'groupe' => 'Terrain & qualité', 'mots' => 'materiel tenue talkie badge lampe inventaire recuperer'];
  $r[] = ['titre' => 'Contrôles qualité', 'sous' => 'Historique et note moyenne par site', 'href' => '#/terrain/controles', 'ic' => 'bouclier', 'groupe' => 'Terrain & qualité', 'mots' => 'controle qualite note inspection historique'];
  return $r;
}

/* =========================================================
   VUE D'ENSEMBLE : par site, consignes à jour ?, % de lecture, matériel dehors, dernier contrôle
   ========================================================= */
function mod_terrain_ensemble(): void
{
  $db = db();
  $sites = $db->query('SELECT s.id, s.nom, s.client_id, s.consignes, s.couleur, c.nom AS client_nom FROM sites s LEFT JOIN clients c ON c.id = s.client_id WHERE s.actif = 1 ORDER BY s.ordre, s.nom COLLATE NOCASE')->fetchAll();
  $courantes = mod_terrain_courantes(true);
  $lus = [];
  foreach ($db->query('SELECT l.site_id, l.agent_id, l.lu FROM m_terrain_lectures l JOIN (SELECT site_id, MAX(version) AS v FROM m_terrain_consignes GROUP BY site_id) m ON m.site_id = l.site_id AND m.v = l.version') as $r) $lus[(int)$r['site_id']][(int)$r['agent_id']] = (string)$r['lu'];
  $prevus = mod_terrain_prevus();
  $agents = mod_terrain_agents();
  $dehors = [];
  foreach ($db->query("SELECT site_id, COUNT(*) AS n FROM m_terrain_materiel WHERE archive = '' AND agent_id > 0 AND site_id > 0 GROUP BY site_id") as $r) $dehors[(int)$r['site_id']]['materiel'] = (int)$r['n'];
  foreach ($db->query("SELECT site_id, COUNT(*) AS n FROM m_terrain_cles WHERE archive = '' AND detenteur <> '' GROUP BY site_id") as $r) $dehors[(int)$r['site_id']]['cles'] = (int)$r['n'];
  $notes = [];
  $st = $db->prepare("SELECT site_id, COUNT(*) AS nb, AVG(moyenne) AS m FROM m_terrain_controles WHERE archive = '' AND quand >= ? GROUP BY site_id");
  $st->execute([date('Y-m-d H:i:s', (int)strtotime('-3 months'))]);
  foreach ($st as $r) $notes[(int)$r['site_id']] = ['nb' => (int)$r['nb'], 'moyenne' => round((float)$r['m'], 2)];
  $derniers = [];
  foreach ($db->query("SELECT c.id, c.site_id, c.quand, c.moyenne FROM m_terrain_controles c WHERE c.archive = '' AND c.id = (SELECT c2.id FROM m_terrain_controles c2 WHERE c2.site_id = c.site_id AND c2.archive = '' ORDER BY c2.quand DESC, c2.id DESC LIMIT 1)") as $r) {
    $derniers[(int)$r['site_id']] = ['id' => (int)$r['id'], 'quand' => (string)$r['quand'], 'moyenne' => round((float)$r['moyenne'], 2)];
  }

  $liste = [];
  $tot = ['prevus' => 0, 'lus' => 0, 'aJour' => 0, 'aReprendre' => 0];
  foreach ($sites as $s) {
    $id = (int)$s['id'];
    $cour = $courantes[$id] ?? null;
    $etat = mod_terrain_etat_consignes($s, $cour);
    $manquants = [];
    $nbLus = 0;
    foreach ($prevus[$id] ?? [] as $a => $poste) {
      if ($cour && isset($lus[$id][$a])) { $nbLus++; continue; }
      $manquants[] = ['id' => $a, 'nom' => $agents[$a]['nom'] ?? 'Agent', 'jour' => $poste['jour'], 'debut' => $poste['debut']];
    }
    $nbPrevus = count($prevus[$id] ?? []);
    $tot['prevus'] += $cour ? $nbPrevus : 0;
    $tot['lus'] += $nbLus;
    if ($etat === 'ok') $tot['aJour']++;
    if ($etat === 'planning') $tot['aReprendre']++;
    $liste[] = [
      'id' => $id, 'nom' => (string)$s['nom'], 'client' => (string)($s['client_nom'] ?? ''), 'couleur' => (string)$s['couleur'],
      'consignes' => ['etat' => $etat, 'version' => $cour ? (int)$cour['version'] : 0, 'cree' => $cour ? (string)$cour['cree'] : ''],
      'lecture' => ['prevus' => $nbPrevus, 'lus' => $nbLus, 'manquants' => $manquants, 'suivi' => (bool)$cour],
      'dehors' => ['materiel' => $dehors[$id]['materiel'] ?? 0, 'cles' => $dehors[$id]['cles'] ?? 0],
      'controle' => ['dernier' => $derniers[$id] ?? null, 'moyenne3m' => $notes[$id]['moyenne'] ?? null, 'nb3m' => $notes[$id]['nb'] ?? 0],
    ];
  }
  $st = $db->prepare("SELECT COUNT(*) AS nb, AVG(moyenne) AS m FROM m_terrain_controles WHERE archive = '' AND quand >= ?");
  $st->execute([date('Y-m-d H:i:s', (int)strtotime('-3 months'))]);
  $g = $st->fetch() ?: [];
  $st = $db->prepare("SELECT COUNT(*) FROM m_terrain_controles WHERE archive = '' AND moyenne < 3 AND quand >= ?");
  $st->execute([date('Y-m-d H:i:s', time() - 30 * 86400)]);
  $faibles = (int)$st->fetchColumn();
  $confies = (int)$db->query("SELECT COUNT(*) FROM m_terrain_materiel WHERE archive = '' AND agent_id > 0")->fetchColumn();
  $inventaire = (int)$db->query("SELECT COUNT(*) FROM m_terrain_materiel WHERE archive = ''")->fetchColumn();
  repondre(['ok' => true, 'sites' => $liste, 'aRecuperer' => mod_terrain_a_recuperer($agents),
    'totaux' => $tot + ['sites' => count($liste), 'confies' => $confies, 'inventaire' => $inventaire, 'controles3m' => (int)($g['nb'] ?? 0),
      'moyenne3m' => (int)($g['nb'] ?? 0) ? round((float)$g['m'], 2) : null, 'faibles30j' => $faibles]]);
}

/* =========================================================
   CLASSEUR D'UN SITE
   ========================================================= */
function mod_terrain_site_detail(): void
{
  $id = (int)($_GET['id'] ?? 0);
  $s = mod_terrain_site($id);
  $db = db();
  $st = $db->prepare('SELECT * FROM m_terrain_consignes WHERE site_id = ? ORDER BY version DESC LIMIT 1');
  $st->execute([$id]);
  $cour = $st->fetch() ?: null;
  $nbLectures = [];
  $st = $db->prepare('SELECT version, COUNT(*) AS n FROM m_terrain_lectures WHERE site_id = ? GROUP BY version');
  $st->execute([$id]);
  foreach ($st as $r) $nbLectures[(int)$r['version']] = (int)$r['n'];
  $st = $db->prepare('SELECT id, version, resume, origine, auteur, cree, LENGTH(texte) AS longueur FROM m_terrain_consignes WHERE site_id = ? ORDER BY version DESC');
  $st->execute([$id]);
  $versions = array_map(fn ($v) => ['id' => (int)$v['id'], 'version' => (int)$v['version'], 'resume' => (string)$v['resume'], 'origine' => (string)$v['origine'],
    'auteur' => (string)$v['auteur'], 'cree' => (string)$v['cree'], 'lectures' => $nbLectures[(int)$v['version']] ?? 0], $st->fetchAll());

  // Lectures : agents prévus sur le site (postes à venir) et ce qu'ils ont lu
  $agents = mod_terrain_agents();
  $prevus = mod_terrain_prevus(0, $id)[$id] ?? [];
  $lues = [];
  $st = $db->prepare('SELECT agent_id, version, lu FROM m_terrain_lectures WHERE site_id = ? ORDER BY version');
  $st->execute([$id]);
  foreach ($st as $r) $lues[(int)$r['agent_id']] = ['version' => (int)$r['version'], 'lu' => (string)$r['lu']];
  $vCour = $cour ? (int)$cour['version'] : 0;
  $concernes = [];
  foreach ($prevus as $a => $poste) {
    $l = $lues[$a] ?? null;
    $concernes[] = ['id' => $a, 'nom' => $agents[$a]['nom'] ?? 'Agent', 'prochain' => $poste,
      'lu' => $l && $l['version'] === $vCour ? $l['lu'] : '', 'versionLue' => $l ? $l['version'] : 0];
  }
  usort($concernes, fn ($x, $y) => [$x['lu'] !== '', $x['prochain']['jour'] . $x['prochain']['debut']] <=> [$y['lu'] !== '', $y['prochain']['jour'] . $y['prochain']['debut']]);
  $autres = [];
  foreach ($lues as $a => $l) {
    if (isset($prevus[$a]) || $l['version'] !== $vCour || !$vCour) continue;
    $autres[] = ['id' => $a, 'nom' => $agents[$a]['nom'] ?? 'Agent retiré de la liste', 'lu' => $l['lu']];
  }

  $st = $db->prepare("SELECT id, type, titre, nom, mime, taille, agents, ajoute, par, archive FROM m_terrain_documents WHERE site_id = ? ORDER BY archive <> '', CASE type WHEN 'plan' THEN 0 WHEN 'procedure' THEN 1 WHEN 'photo' THEN 2 ELSE 3 END, titre COLLATE NOCASE");
  $st->execute([$id]);
  $documents = array_map(fn ($d) => ['id' => (int)$d['id'], 'type' => (string)$d['type'], 'titre' => (string)$d['titre'], 'nom' => (string)$d['nom'], 'mime' => (string)$d['mime'],
    'taille' => (int)$d['taille'], 'agents' => (int)$d['agents'] === 1, 'ajoute' => (string)$d['ajoute'], 'par' => (string)$d['par'], 'archive' => (string)$d['archive']], $st->fetchAll());

  $st = $db->prepare("SELECT * FROM m_terrain_cles WHERE site_id = ? AND archive = '' ORDER BY objet COLLATE NOCASE, id");
  $st->execute([$id]);
  $cles = array_map(function ($k) use ($agents) {
    $a = (int)$k['agent_id'] ? ($agents[(int)$k['agent_id']] ?? null) : null;
    return ['id' => (int)$k['id'], 'objet' => (string)$k['objet'], 'nombre' => (int)$k['nombre'], 'emplacement' => (string)$k['emplacement'],
      'detenteur' => $a ? $a['nom'] : (string)$k['detenteur'], 'agent_id' => (int)$k['agent_id'], 'parti' => (int)$k['agent_id'] ? mod_terrain_parti($a) : '',
      'depuis' => (string)$k['depuis'], 'note' => (string)$k['note'], 'maj' => (string)$k['maj']];
  }, $st->fetchAll());

  $st = $db->prepare("SELECT id, quand, moyenne, agent_id, agent_nom, controleur, photo <> '' AS photo FROM m_terrain_controles WHERE site_id = ? AND archive = '' ORDER BY quand DESC, id DESC LIMIT 60");
  $st->execute([$id]);
  $controles = array_map(fn ($c) => ['id' => (int)$c['id'], 'quand' => (string)$c['quand'], 'moyenne' => round((float)$c['moyenne'], 2),
    'agent' => (int)$c['agent_id'] ? ($agents[(int)$c['agent_id']]['nom'] ?? (string)$c['agent_nom']) : '', 'controleur' => (string)$c['controleur'], 'photo' => (bool)$c['photo']], $st->fetchAll());

  repondre(['ok' => true,
    'site' => ['id' => $id, 'nom' => (string)$s['nom'], 'client' => (string)($s['client_nom'] ?? ''), 'adresse' => (string)$s['adresse'], 'contact' => (string)$s['contact'],
      'actif' => (int)$s['actif'] === 1, 'consignesPlanning' => trim((string)$s['consignes']), 'majPlanning' => (string)$s['maj']],
    'etat' => mod_terrain_etat_consignes($s, $cour),
    'courante' => $cour ? ['id' => (int)$cour['id'], 'version' => (int)$cour['version'], 'texte' => (string)$cour['texte'], 'resume' => (string)$cour['resume'],
      'origine' => (string)$cour['origine'], 'auteur' => (string)$cour['auteur'], 'cree' => (string)$cour['cree']] : null,
    'versions' => $versions,
    'lectures' => ['concernes' => $concernes, 'autres' => $autres],
    'documents' => $documents,
    'urgences' => mod_terrain_urgences($id),
    'cles' => $cles,
    'controles' => ['liste' => $controles] + mod_terrain_note_site($id, 3),
    'agents' => mod_terrain_agents_actifs($agents),
    'types' => MOD_TERRAIN_TYPES_DOC,
    'limite' => min(MOD_TERRAIN_MAX_DOC, limite_envoi()),
  ]);
}

function mod_terrain_consigne_version(): void
{
  $st = db()->prepare('SELECT * FROM m_terrain_consignes WHERE id = ?');
  $st->execute([(int)($_GET['id'] ?? 0)]);
  $v = $st->fetch();
  if (!$v) throw new RuntimeException('Version introuvable.');
  $st = db()->prepare('SELECT version, texte FROM m_terrain_consignes WHERE site_id = ? AND version < ? ORDER BY version DESC LIMIT 1');
  $st->execute([(int)$v['site_id'], (int)$v['version']]);
  $prec = $st->fetch() ?: null;
  repondre(['ok' => true, 'version' => ['id' => (int)$v['id'], 'version' => (int)$v['version'], 'texte' => (string)$v['texte'], 'resume' => (string)$v['resume'],
    'origine' => (string)$v['origine'], 'auteur' => (string)$v['auteur'], 'cree' => (string)$v['cree']],
    'precedente' => $prec ? ['version' => (int)$prec['version'], 'texte' => (string)$prec['texte']] : null]);
}

// Nouvelle version des consignes (le texte de la fiche du planning, s'il a changé entre-temps, est d'abord gardé dans l'historique)
function mod_terrain_publier(array $s, string $texte, string $resume, string $origine): array
{
  $qui = mod_terrain_qui();
  $id = (int)$s['id'];
  return mod_terrain_transaction(function (PDO $db) use ($s, $id, $texte, $resume, $origine, $qui): array {
    $st = $db->prepare('SELECT * FROM m_terrain_consignes WHERE site_id = ? ORDER BY version DESC LIMIT 1');
    $st->execute([$id]);
    $cour = $st->fetch() ?: null;
    if ($cour && (string)$cour['texte'] === $texte) throw new RuntimeException('Ce texte est déjà la version en vigueur : rien à publier.');
    $n = $cour ? (int)$cour['version'] : 0;
    $ins = $db->prepare('INSERT INTO m_terrain_consignes (site_id, version, texte, resume, origine, auteur, cree) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $coeur = trim((string)$s['consignes']);
    if ($origine !== 'planning' && $coeur !== '' && $coeur !== $texte && $coeur !== ($cour ? mod_terrain_texte_coeur((string)$cour['texte']) : '')) {
      $ins->execute([$id, ++$n, $coeur, 'Texte de la fiche du planning, gardé avant la nouvelle version', 'planning', '', maintenant()]);
    }
    $ins->execute([$id, ++$n, $texte, $resume, $origine, $qui, maintenant()]);
    $nouvel = (int)$db->lastInsertId();
    $db->prepare('UPDATE sites SET consignes = ?, maj = ? WHERE id = ?')->execute([mod_terrain_texte_coeur($texte), maintenant(), $id]);
    return ['id' => $nouvel, 'version' => $n];
  });
}
function mod_terrain_consigne_publier(): void
{
  $b = corps();
  $s = mod_terrain_site((int)($b['site_id'] ?? 0));
  if (!empty($b['depuis_planning'])) {
    $texte = texte($s['consignes'] ?? '', MOD_TERRAIN_MAX_TEXTE);
    if ($texte === '') throw new RuntimeException('La fiche du planning n’a pas de consignes à reprendre.');
    $r = mod_terrain_publier($s, $texte, texte($b['resume'] ?? '', 300) ?: 'Reprise des consignes de la fiche du planning', 'planning');
  } else {
    $texte = texte($b['texte'] ?? '', MOD_TERRAIN_MAX_TEXTE + 1);
    if (mb_strlen($texte) > MOD_TERRAIN_MAX_TEXTE) throw new RuntimeException('Consignes trop longues (12 000 caractères au maximum) : mettez les détails dans un document du site.');
    if (mb_strlen($texte) < 10) throw new RuntimeException('Écrivez les consignes avant de publier (quelques lignes au moins).');
    $r = mod_terrain_publier($s, $texte, texte($b['resume'] ?? '', 300), 'classeur');
  }
  journal('equipe', 'Consignes du site « ' . $s['nom'] . ' » : version ' . $r['version'] . ' publiée');
  repondre(['ok' => true] + $r);
}
// Fiche du planning vidée : on y remet la version en vigueur (rien n'est perdu, le champ était vide)
function mod_terrain_consigne_planning(): void
{
  $s = mod_terrain_site((int)(corps()['site_id'] ?? 0));
  $st = db()->prepare('SELECT texte FROM m_terrain_consignes WHERE site_id = ? ORDER BY version DESC LIMIT 1');
  $st->execute([(int)$s['id']]);
  $t = $st->fetchColumn();
  if ($t === false) throw new RuntimeException('Ce site n’a pas encore de consignes publiées.');
  if (trim((string)$s['consignes']) !== '') throw new RuntimeException('La fiche du planning contient d’autres consignes : publiez-les ou modifiez-les d’abord.');
  db()->prepare('UPDATE sites SET consignes = ?, maj = ? WHERE id = ?')->execute([mod_terrain_texte_coeur((string)$t), maintenant(), (int)$s['id']]);
  repondre(['ok' => true]);
}
// Tous les sites dont les consignes ne sont que dans la fiche du planning : version 1 en un clic
function mod_terrain_consignes_reprendre(): void
{
  $n = 0;
  foreach (db()->query("SELECT s.* FROM sites s WHERE s.actif = 1 AND TRIM(s.consignes) <> '' AND NOT EXISTS (SELECT 1 FROM m_terrain_consignes c WHERE c.site_id = s.id)")->fetchAll() as $s) {
    $texte = texte($s['consignes'], MOD_TERRAIN_MAX_TEXTE);
    if ($texte === '') continue;
    try { mod_terrain_publier($s, $texte, 'Reprise des consignes de la fiche du planning', 'planning'); $n++; } catch (RuntimeException $e) { /* déjà repris entre-temps */ }
  }
  if ($n) journal('equipe', "Consignes reprises de la fiche du planning pour $n site(s)");
  repondre(['ok' => true, 'sites' => $n]);
}

/* ----- Documents du site (dossier privé, servis par l'admin) ----- */
function mod_terrain_document(): void
{
  $st = db()->prepare('SELECT * FROM m_terrain_documents WHERE id = ?');
  $st->execute([(int)($_GET['id'] ?? 0)]);
  $d = $st->fetch();
  if (!$d) echec('Document introuvable.', 404);
  mod_terrain_servir(mod_terrain_dossier('documents') . '/' . basename((string)$d['fichier']), (string)$d['mime'], mod_terrain_nom_fichier((string)$d['titre'], (string)$d['mime']), !empty($_GET['telecharger']));
}
function mod_terrain_document_ajouter(): void
{
  mod_terrain_envoi_trop_lourd();
  $s = mod_terrain_site((int)($_POST['site_id'] ?? 0));
  $f = mod_terrain_fichier_recu('fichier', MOD_TERRAIN_MAX_DOC, array_keys(MOD_TERRAIN_FORMATS));
  $type = (string)($_POST['type'] ?? '');
  if (!isset(MOD_TERRAIN_TYPES_DOC[$type])) $type = str_starts_with($f['mime'], 'image/') ? 'photo' : 'autre';
  $nom = texte(basename(str_replace('\\', '/', $f['nom'])), 160);
  $titre = texte($_POST['titre'] ?? '', 120) ?: (texte(preg_replace('/\.[a-z0-9]{2,5}$/i', '', $nom), 120) ?: MOD_TERRAIN_TYPES_DOC[$type]);
  $fichier = bin2hex(random_bytes(16)) . '.' . MOD_TERRAIN_FORMATS[$f['mime']];
  if (!move_uploaded_file($f['tmp'], mod_terrain_dossier('documents') . '/' . $fichier)) throw new RuntimeException('Enregistrement du fichier impossible. Réessayez.');
  db()->prepare('INSERT INTO m_terrain_documents (site_id, type, titre, fichier, nom, mime, taille, agents, ajoute, par) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([(int)$s['id'], $type, $titre, $fichier, $nom, $f['mime'], $f['taille'], !empty($_POST['agents']) ? 1 : 0, maintenant(), mod_terrain_qui()]);
  $id = (int)db()->lastInsertId();
  journal('document', 'Classeur du site « ' . $s['nom'] . ' » : document ajouté');
  repondre(['ok' => true, 'id' => $id]);
}
function mod_terrain_document_modifier(): void
{
  $b = corps();
  $type = (string)($b['type'] ?? '');
  if (!isset(MOD_TERRAIN_TYPES_DOC[$type])) throw new RuntimeException('Type de document inconnu.');
  $titre = texte($b['titre'] ?? '', 120);
  if ($titre === '') throw new RuntimeException('Donnez un titre au document.');
  $st = db()->prepare('UPDATE m_terrain_documents SET type = ?, titre = ?, agents = ? WHERE id = ?');
  $st->execute([$type, $titre, !empty($b['agents']) ? 1 : 0, (int)($b['id'] ?? 0)]);
  if (!$st->rowCount()) throw new RuntimeException('Document introuvable.');
  repondre(['ok' => true]);
}
// Retiré du classeur (le fichier est gardé) ; « remettre » le rend à nouveau visible
function mod_terrain_document_retirer(): void
{
  $b = corps();
  $st = db()->prepare('SELECT d.id, s.nom FROM m_terrain_documents d LEFT JOIN sites s ON s.id = d.site_id WHERE d.id = ?');
  $st->execute([(int)($b['id'] ?? 0)]);
  $d = $st->fetch();
  if (!$d) throw new RuntimeException('Document introuvable.');
  $remettre = !empty($b['remettre']);
  db()->prepare('UPDATE m_terrain_documents SET archive = ? WHERE id = ?')->execute([$remettre ? '' : maintenant(), (int)$d['id']]);
  journal('document', 'Classeur du site « ' . (string)$d['nom'] . ' » : document ' . ($remettre ? 'remis' : 'retiré'));
  repondre(['ok' => true]);
}

/* ----- Numéros d'urgence du site ----- */
function mod_terrain_urgences_enregistrer(): void
{
  $b = corps();
  $s = mod_terrain_site((int)($b['site_id'] ?? 0));
  $liste = [];
  foreach (array_slice(is_array($b['urgences'] ?? null) ? $b['urgences'] : [], 0, 30) as $u) {
    if (!is_array($u)) continue;
    $libelle = texte($u['libelle'] ?? '', 80);
    $numero = texte($u['numero'] ?? '', 30);
    $note = texte($u['note'] ?? '', 140);
    if ($libelle === '' && $numero === '') continue;
    if ($libelle === '') throw new RuntimeException("Donnez un nom au numéro $numero (ex. Responsable du site).");
    if (!preg_match('/^\+?[0-9][0-9 .()\-]{1,28}$/', $numero) || strlen((string)preg_replace('/\D/', '', $numero)) < 2) {
      throw new RuntimeException("Le numéro de « $libelle » n’est pas valide : chiffres, espaces et + seulement.");
    }
    $liste[] = ['libelle' => $libelle, 'numero' => $numero, 'note' => $note];
  }
  if (count($liste) > 20) throw new RuntimeException('20 numéros au maximum par site.');
  db()->prepare('INSERT INTO m_terrain_sites (site_id, urgences, maj) VALUES (?, ?, ?) ON CONFLICT(site_id) DO UPDATE SET urgences = excluded.urgences, maj = excluded.maj')
    ->execute([(int)$s['id'], json_encode($liste, JSON_UNESCAPED_UNICODE), maintenant()]);
  repondre(['ok' => true, 'urgences' => $liste]);
}

/* ----- Registre des clés et badges ----- */
function mod_terrain_cle_enregistrer(): void
{
  $b = corps();
  $db = db();
  $id = (int)($b['id'] ?? 0);
  $avant = null;
  if ($id) {
    $st = $db->prepare("SELECT * FROM m_terrain_cles WHERE id = ? AND archive = ''");
    $st->execute([$id]);
    $avant = $st->fetch();
    if (!$avant) throw new RuntimeException('Cette ligne du registre n’existe plus.');
  }
  $s = mod_terrain_site($avant ? (int)$avant['site_id'] : (int)($b['site_id'] ?? 0));
  $objet = texte($b['objet'] ?? '', 120);
  if ($objet === '') throw new RuntimeException('Indiquez l’objet (ex. Clé du portail, Badge parking).');
  $nombre = (int)($b['nombre'] ?? 1);
  if ($nombre < 1 || $nombre > 999) throw new RuntimeException('Le nombre doit être compris entre 1 et 999.');
  $emplacement = texte($b['emplacement'] ?? '', 120);
  $agent = (int)($b['agent_id'] ?? 0);
  $detenteur = texte($b['detenteur'] ?? '', 120);
  if ($agent) {
    $agents = mod_terrain_agents();
    if (!isset($agents[$agent])) throw new RuntimeException('Agent introuvable.');
    if (mod_terrain_parti($agents[$agent]) !== '' && (!$avant || (int)$avant['agent_id'] !== $agent)) throw new RuntimeException('Cet agent n’est plus actif : choisissez quelqu’un d’autre.');
    $detenteur = $agents[$agent]['nom'];
  }
  // « depuis quand » : la date saisie (le formulaire propose aujourd'hui quand le détenteur change)
  $depuis = mod_terrain_jour($b['depuis'] ?? '') ?: date('Y-m-d');
  if ($depuis > date('Y-m-d', time() + 86400)) throw new RuntimeException('La date « depuis » est dans le futur.');
  $note = texte($b['note'] ?? '', 300);
  $qui = mod_terrain_qui();
  $nouvelId = mod_terrain_transaction(function (PDO $db) use ($avant, $id, $s, $objet, $nombre, $emplacement, $detenteur, $agent, $depuis, $note, $qui): int {
    if ($avant) {
      $db->prepare('UPDATE m_terrain_cles SET objet = ?, nombre = ?, emplacement = ?, detenteur = ?, agent_id = ?, depuis = ?, note = ?, maj = ? WHERE id = ?')
        ->execute([$objet, $nombre, $emplacement, $detenteur, $agent, $depuis, $note, maintenant(), $id]);
    } else {
      $db->prepare('INSERT INTO m_terrain_cles (site_id, objet, nombre, emplacement, detenteur, agent_id, depuis, note, cree, maj) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([(int)$s['id'], $objet, $nombre, $emplacement, $detenteur, $agent, $depuis, $note, maintenant(), maintenant()]);
      $id = (int)$db->lastInsertId();
    }
    // historique : chaque changement de détenteur, d'emplacement ou de nombre
    if (!$avant || (string)$avant['detenteur'] !== $detenteur || (int)$avant['agent_id'] !== $agent || (string)$avant['emplacement'] !== $emplacement || (int)$avant['nombre'] !== $nombre || (string)$avant['depuis'] !== $depuis) {
      $db->prepare('INSERT INTO m_terrain_cles_hist (cle_id, quand, detenteur, emplacement, nombre, depuis, par) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$id, maintenant(), $detenteur, $emplacement, $nombre, $depuis, $qui]);
    }
    return $id;
  });
  repondre(['ok' => true, 'id' => $nouvelId]);
}
function mod_terrain_cle_retirer(): void
{
  $st = db()->prepare("UPDATE m_terrain_cles SET archive = ?, maj = ? WHERE id = ? AND archive = ''");
  $st->execute([maintenant(), maintenant(), (int)(corps()['id'] ?? 0)]);
  if (!$st->rowCount()) throw new RuntimeException('Cette ligne du registre n’existe plus.');
  repondre(['ok' => true]);
}
function mod_terrain_cle_historique(): void
{
  $st = db()->prepare('SELECT quand, detenteur, emplacement, nombre, depuis, par FROM m_terrain_cles_hist WHERE cle_id = ? ORDER BY id DESC LIMIT 100');
  $st->execute([(int)($_GET['id'] ?? 0)]);
  repondre(['ok' => true, 'historique' => $st->fetchAll()]);
}

/* =========================================================
   MATÉRIEL & TENUES
   ========================================================= */
function mod_terrain_materiel(): void
{
  $db = db();
  $agents = mod_terrain_agents();
  $admin = mod_terrain_est_admin();
  $sites = [];
  foreach ($db->query('SELECT id, nom, actif FROM sites ORDER BY actif DESC, ordre, nom COLLATE NOCASE') as $s) $sites[(int)$s['id']] = ['id' => (int)$s['id'], 'nom' => (string)$s['nom'], 'actif' => (int)$s['actif'] === 1];
  $st = $db->query("SELECT m.*, (SELECT agent_nom FROM m_terrain_mouvements v WHERE v.materiel_id = m.id AND v.rendu_le = '' ORDER BY v.id DESC LIMIT 1) AS agent_nom
    FROM m_terrain_materiel m WHERE m.archive = '' ORDER BY m.type, m.libelle COLLATE NOCASE, m.numero, m.id");
  $liste = [];
  foreach ($st as $m) {
    $a = (int)$m['agent_id'] ? ($agents[(int)$m['agent_id']] ?? null) : null;
    $liste[] = ['id' => (int)$m['id'], 'type' => (string)$m['type'], 'libelle' => (string)$m['libelle'], 'numero' => (string)$m['numero'], 'taille' => (string)$m['taille'],
      'etat' => (string)$m['etat'], 'site_id' => (int)$m['site_id'], 'site' => $sites[(int)$m['site_id']]['nom'] ?? '', 'note' => (string)$m['note'],
      'agent_id' => (int)$m['agent_id'], 'agent' => (int)$m['agent_id'] ? ($a['nom'] ?? (string)($m['agent_nom'] ?? 'Agent retiré de la liste')) : '',
      'parti' => (int)$m['agent_id'] ? mod_terrain_parti($a) : '', 'sortie' => $admin && $a ? $a['sortie'] : '', 'remis_le' => (string)$m['remis_le'], 'maj' => (string)$m['maj']];
  }
  repondre(['ok' => true, 'materiel' => $liste, 'aRecuperer' => mod_terrain_a_recuperer($agents), 'agents' => mod_terrain_agents_actifs($agents),
    'sites' => array_values(array_filter($sites, fn ($s) => $s['actif'])), 'types' => MOD_TERRAIN_TYPES_MAT, 'etats' => MOD_TERRAIN_ETATS,
    'archives' => (int)$db->query("SELECT COUNT(*) FROM m_terrain_materiel WHERE archive <> ''")->fetchColumn()]);
}
function mod_terrain_materiel_enregistrer(): void
{
  $b = corps();
  $db = db();
  $id = (int)($b['id'] ?? 0);
  $type = (string)($b['type'] ?? '');
  if (!isset(MOD_TERRAIN_TYPES_MAT[$type])) throw new RuntimeException('Choisissez le type de matériel.');
  $libelle = texte($b['libelle'] ?? '', 120);
  if ($libelle === '') throw new RuntimeException('Donnez une désignation (ex. Talkie Motorola T82, Veste noire).');
  $numero = texte($b['numero'] ?? '', 60);
  $taille = texte($b['taille'] ?? '', 20);
  $note = texte($b['note'] ?? '', 300);
  $site = (int)($b['site_id'] ?? 0);
  if ($site) mod_terrain_site($site);
  $avant = null;
  if ($id) {
    $st = $db->prepare("SELECT * FROM m_terrain_materiel WHERE id = ? AND archive = ''");
    $st->execute([$id]);
    $avant = $st->fetch();
    if (!$avant) throw new RuntimeException('Cet objet n’est plus dans l’inventaire.');
  }
  // l'état d'un objet confié change à son retour ; sinon il se règle ici
  $etat = (string)($b['etat'] ?? ($avant['etat'] ?? 'bon'));
  if (!isset(MOD_TERRAIN_ETATS[$etat])) throw new RuntimeException('État inconnu.');
  if ($numero !== '') {
    $st = $db->prepare("SELECT COUNT(*) FROM m_terrain_materiel WHERE archive = '' AND type = ? AND LOWER(numero) = LOWER(?) AND id <> ?");
    $st->execute([$type, $numero, $id]);
    if ((int)$st->fetchColumn()) throw new RuntimeException("Le numéro « $numero » existe déjà pour ce type de matériel.");
  }
  if ($avant) {
    $db->prepare('UPDATE m_terrain_materiel SET type = ?, libelle = ?, numero = ?, taille = ?, etat = ?, site_id = ?, note = ?, maj = ? WHERE id = ?')
      ->execute([$type, $libelle, $numero, $taille, $etat, $site, $note, maintenant(), $id]);
    repondre(['ok' => true, 'id' => $id]);
  }
  $nombre = max(1, min(50, (int)($b['nombre'] ?? 1)));
  if ($nombre > 1 && $numero !== '') throw new RuntimeException('Pour plusieurs exemplaires, laissez le numéro de série vide : vous le compléterez sur chaque objet.');
  $ids = mod_terrain_transaction(function (PDO $db) use ($nombre, $type, $libelle, $numero, $taille, $etat, $site, $note): array {
    $ins = $db->prepare('INSERT INTO m_terrain_materiel (type, libelle, numero, taille, etat, site_id, note, cree, maj) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $ids = [];
    for ($i = 0; $i < $nombre; $i++) { $ins->execute([$type, $libelle, $numero, $taille, $etat, $site, $note, maintenant(), maintenant()]); $ids[] = (int)$db->lastInsertId(); }
    return $ids;
  });
  repondre(['ok' => true, 'id' => $ids[0], 'ids' => $ids]);
}
function mod_terrain_materiel_remettre(): void
{
  $b = corps();
  $db = db();
  $st = $db->prepare("SELECT * FROM m_terrain_materiel WHERE id = ? AND archive = ''");
  $st->execute([(int)($b['id'] ?? 0)]);
  $m = $st->fetch();
  if (!$m) throw new RuntimeException('Cet objet n’est plus dans l’inventaire.');
  if ((int)$m['agent_id']) throw new RuntimeException('Cet objet est déjà confié à un agent : enregistrez d’abord son retour.');
  if (in_array($m['etat'], ['hs', 'perdu'], true)) throw new RuntimeException('Cet objet est ' . mb_strtolower(MOD_TERRAIN_ETATS[$m['etat']]) . ' : changez son état avant de le confier.');
  $agents = mod_terrain_agents();
  $agent = (int)($b['agent_id'] ?? 0);
  if (!isset($agents[$agent])) throw new RuntimeException('Choisissez l’agent qui reçoit le matériel.');
  if (mod_terrain_parti($agents[$agent]) !== '') throw new RuntimeException('Cet agent n’est plus actif.');
  $date = mod_terrain_jour($b['date'] ?? '') ?: date('Y-m-d');
  if ($date > date('Y-m-d', time() + 86400)) throw new RuntimeException('La date de remise est dans le futur.');
  $note = texte($b['note'] ?? '', 300);
  $qui = mod_terrain_qui();
  mod_terrain_transaction(function (PDO $db) use ($m, $agent, $agents, $date, $note, $qui): void {
    $db->prepare('UPDATE m_terrain_materiel SET agent_id = ?, remis_le = ?, maj = ? WHERE id = ?')->execute([$agent, $date, maintenant(), (int)$m['id']]);
    $db->prepare('INSERT INTO m_terrain_mouvements (materiel_id, agent_id, agent_nom, remis_le, etat_remise, note, par, cree) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      ->execute([(int)$m['id'], $agent, $agents[$agent]['nom'], $date, (string)$m['etat'], $note, $qui, maintenant()]);
  });
  repondre(['ok' => true]);
}
function mod_terrain_materiel_retour(): void
{
  $b = corps();
  $db = db();
  $st = $db->prepare("SELECT * FROM m_terrain_materiel WHERE id = ? AND archive = ''");
  $st->execute([(int)($b['id'] ?? 0)]);
  $m = $st->fetch();
  if (!$m) throw new RuntimeException('Cet objet n’est plus dans l’inventaire.');
  if (!(int)$m['agent_id']) throw new RuntimeException('Cet objet est déjà en stock.');
  $date = mod_terrain_jour($b['date'] ?? '') ?: date('Y-m-d');
  if ($date > date('Y-m-d', time() + 86400)) throw new RuntimeException('La date de retour est dans le futur.');
  if ((string)$m['remis_le'] !== '' && $date < (string)$m['remis_le']) throw new RuntimeException('La date de retour est avant la date de remise (' . date('d/m/Y', (int)strtotime((string)$m['remis_le'])) . ').');
  $etat = (string)($b['etat'] ?? '');
  if (!isset(MOD_TERRAIN_ETATS[$etat])) throw new RuntimeException('Indiquez l’état du matériel rendu.');
  $note = texte($b['note'] ?? '', 300);
  mod_terrain_transaction(function (PDO $db) use ($m, $date, $etat, $note): void {
    $st = $db->prepare("SELECT id FROM m_terrain_mouvements WHERE materiel_id = ? AND rendu_le = '' ORDER BY id DESC LIMIT 1");
    $st->execute([(int)$m['id']]);
    $mv = (int)$st->fetchColumn();
    if ($mv) {
      $db->prepare('UPDATE m_terrain_mouvements SET rendu_le = ?, etat_retour = ?, note = CASE WHEN ? <> \'\' THEN ? ELSE note END WHERE id = ?')->execute([$date, $etat, $note, $note, $mv]);
    } else { // remise d'avant le registre : on garde quand même la trace du retour
      $db->prepare('INSERT INTO m_terrain_mouvements (materiel_id, agent_id, agent_nom, remis_le, etat_remise, rendu_le, etat_retour, note, par, cree) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([(int)$m['id'], (int)$m['agent_id'], '', (string)$m['remis_le'], '', $date, $etat, $note, mod_terrain_qui(), maintenant()]);
    }
    $db->prepare("UPDATE m_terrain_materiel SET agent_id = 0, remis_le = '', etat = ?, maj = ? WHERE id = ?")->execute([$etat, maintenant(), (int)$m['id']]);
  });
  repondre(['ok' => true]);
}
// Retiré de l'inventaire (réformé, vendu…) : la ligne et son historique sont gardés
function mod_terrain_materiel_retirer(): void
{
  $b = corps();
  $st = db()->prepare("SELECT agent_id FROM m_terrain_materiel WHERE id = ? AND archive = ''");
  $st->execute([(int)($b['id'] ?? 0)]);
  $a = $st->fetchColumn();
  if ($a === false) throw new RuntimeException('Cet objet n’est plus dans l’inventaire.');
  if ((int)$a) throw new RuntimeException('Cet objet est confié à un agent : enregistrez d’abord son retour.');
  db()->prepare('UPDATE m_terrain_materiel SET archive = ?, maj = ? WHERE id = ?')->execute([maintenant(), maintenant(), (int)$b['id']]);
  repondre(['ok' => true]);
}
function mod_terrain_materiel_historique(): void
{
  $st = db()->prepare('SELECT agent_id, agent_nom, remis_le, etat_remise, rendu_le, etat_retour, note, par FROM m_terrain_mouvements WHERE materiel_id = ? ORDER BY remis_le DESC, id DESC LIMIT 100');
  $st->execute([(int)($_GET['id'] ?? 0)]);
  repondre(['ok' => true, 'historique' => $st->fetchAll(), 'etats' => MOD_TERRAIN_ETATS]);
}

/* =========================================================
   CONTRÔLES QUALITÉ
   ========================================================= */
function mod_terrain_controle_options(): void
{
  require_once __DIR__ . '/../exploitation.php';
  $db = db();
  $sites = array_map(fn ($s) => ['id' => (int)$s['id'], 'nom' => (string)$s['nom'], 'client' => (string)($s['client'] ?? '')],
    $db->query('SELECT s.id, s.nom, c.nom AS client FROM sites s LEFT JOIN clients c ON c.id = s.client_id WHERE s.actif = 1 ORDER BY s.ordre, s.nom COLLATE NOCASE')->fetchAll());
  // agents en poste ou prévus aujourd'hui sur chaque site (proposés en premier)
  $st = $db->prepare("SELECT site_id, agent_id, jour, debut, fin FROM vacations WHERE statut <> 'annulee' AND agent_id > 0 AND jour >= ? AND jour <= ? ORDER BY jour, debut");
  $st->execute([date('Y-m-d', time() - 86400), date('Y-m-d')]);
  $enPoste = [];
  $maintenant = time();
  foreach ($st as $v) {
    [$d, $f] = exp_bornes($v);
    if ($f < $maintenant - 2 * 3600 || ($v['jour'] !== date('Y-m-d') && $f < $maintenant)) continue;
    $s = (int)$v['site_id'];
    $a = (int)$v['agent_id'];
    if (!isset($enPoste[$s][$a])) $enPoste[$s][$a] = ['agent_id' => $a, 'debut' => (string)$v['debut'], 'fin' => (string)$v['fin'], 'maintenant' => $d <= $maintenant && $f >= $maintenant];
  }
  repondre(['ok' => true, 'sites' => $sites, 'agents' => mod_terrain_agents_actifs(mod_terrain_agents()),
    'enPoste' => array_map('array_values', $enPoste) ?: (object)[], 'criteres' => MOD_TERRAIN_CRITERES, 'limite' => min(MOD_TERRAIN_MAX_PHOTO, limite_envoi())]);
}
function mod_terrain_controle_enregistrer(): void
{
  mod_terrain_envoi_trop_lourd();
  $s = mod_terrain_site((int)($_POST['site_id'] ?? 0));
  $agent = (int)($_POST['agent_id'] ?? 0);
  $agentNom = '';
  if ($agent) {
    $agents = mod_terrain_agents();
    if (!isset($agents[$agent])) throw new RuntimeException('Agent introuvable.');
    $agentNom = $agents[$agent]['nom'];
  }
  $quand = maintenant();
  if (preg_match('/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/', (string)($_POST['quand'] ?? ''), $m) && strtotime("$m[1] $m[2]") !== false) {
    $t = (int)strtotime("$m[1] $m[2]");
    if ($t > time() + 600) throw new RuntimeException('L’heure du contrôle est dans le futur.');
    if ($t < time() - 366 * 86400) throw new RuntimeException('Date du contrôle trop ancienne.');
    $quand = date('Y-m-d H:i:00', $t);
  }
  $brut = json_decode((string)($_POST['notes'] ?? ''), true);
  $notes = [];
  foreach (MOD_TERRAIN_CRITERES as $k => $libelle) {
    $n = is_array($brut) ? (int)($brut[$k] ?? 0) : 0;
    if ($n < 0 || $n > 5) throw new RuntimeException("Note invalide pour « $libelle ».");
    if ($n) $notes[$k] = $n;
  }
  if (!$notes) throw new RuntimeException('Notez au moins un critère (de 1 à 5).');
  $moyenne = round(array_sum($notes) / count($notes), 2);
  $commentaire = texte($_POST['commentaire'] ?? '', 2000);
  if ($moyenne < 3 && mb_strlen($commentaire) < 5) throw new RuntimeException('Une note moyenne sous 3 demande un commentaire : expliquez en quelques mots ce qui ne va pas.');
  $photo = '';
  $mime = '';
  if (isset($_FILES['photo']) && (int)($_FILES['photo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $f = mod_terrain_fichier_recu('photo', MOD_TERRAIN_MAX_PHOTO, ['image/jpeg', 'image/png', 'image/webp']);
    $photo = bin2hex(random_bytes(16)) . '.' . MOD_TERRAIN_FORMATS[$f['mime']];
    if (!move_uploaded_file($f['tmp'], mod_terrain_dossier('controles') . '/' . $photo)) throw new RuntimeException('Enregistrement de la photo impossible. Réessayez.');
    $mime = $f['mime'];
  }
  db()->prepare('INSERT INTO m_terrain_controles (site_id, agent_id, agent_nom, quand, notes, moyenne, commentaire, photo, photo_mime, controleur, cree) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([(int)$s['id'], $agent, $agentNom, $quand, json_encode($notes), $moyenne, $commentaire, $photo, $mime, mod_terrain_qui(), maintenant()]);
  $id = (int)db()->lastInsertId();
  journal('equipe', 'Contrôle qualité enregistré : site « ' . $s['nom'] . ' », note ' . mod_terrain_note_fr($moyenne) . '/5');
  // Alerte seulement pour un contrôle qui signale un problème (jamais de nom dans la notification)
  if ($moyenne < 3) notifier('qualite', 'Un contrôle qualité signale un problème', 'Note moyenne de ' . mod_terrain_note_fr($moyenne) . ' sur 5. Ouvrez le contrôle pour voir le détail.', '/admin/#/terrain/controle/' . $id, 'qualite-' . $id);
  repondre(['ok' => true, 'id' => $id, 'moyenne' => $moyenne]);
}
function mod_terrain_controle(): void
{
  $db = db();
  $st = $db->prepare('SELECT c.*, s.nom AS site_nom, s.actif AS site_actif FROM m_terrain_controles c LEFT JOIN sites s ON s.id = c.site_id WHERE c.id = ?');
  $st->execute([(int)($_GET['id'] ?? 0)]);
  $c = $st->fetch();
  if (!$c) throw new RuntimeException('Contrôle introuvable.');
  $agents = mod_terrain_agents();
  $nom = fn (array $x): string => (int)$x['agent_id'] ? ($agents[(int)$x['agent_id']]['nom'] ?? (string)$x['agent_nom']) : '';
  $autres = [];
  if ((int)$c['agent_id']) {
    $st = $db->prepare("SELECT c.id, c.quand, c.moyenne, s.nom AS site FROM m_terrain_controles c LEFT JOIN sites s ON s.id = c.site_id WHERE c.agent_id = ? AND c.id <> ? AND c.archive = '' ORDER BY c.quand DESC LIMIT 6");
    $st->execute([(int)$c['agent_id'], (int)$c['id']]);
    $autres = array_map(fn ($x) => ['id' => (int)$x['id'], 'quand' => (string)$x['quand'], 'moyenne' => round((float)$x['moyenne'], 2), 'site' => (string)($x['site'] ?? '')], $st->fetchAll());
  }
  repondre(['ok' => true, 'controle' => ['id' => (int)$c['id'], 'site_id' => (int)$c['site_id'], 'site' => (string)($c['site_nom'] ?? 'Site retiré'), 'agent_id' => (int)$c['agent_id'],
    'agent' => $nom($c), 'quand' => (string)$c['quand'], 'notes' => json_decode((string)$c['notes'], true) ?: (object)[], 'moyenne' => round((float)$c['moyenne'], 2),
    'commentaire' => (string)$c['commentaire'], 'photo' => (string)$c['photo'] !== '', 'controleur' => (string)$c['controleur'], 'cree' => (string)$c['cree'], 'archive' => (string)$c['archive']],
    'criteres' => MOD_TERRAIN_CRITERES, 'autres' => $autres, 'site' => mod_terrain_note_site((int)$c['site_id'], 3)]);
}
function mod_terrain_controle_photo(): void
{
  $st = db()->prepare('SELECT photo, photo_mime, quand FROM m_terrain_controles WHERE id = ?');
  $st->execute([(int)($_GET['id'] ?? 0)]);
  $c = $st->fetch();
  if (!$c || (string)$c['photo'] === '') echec('Photo introuvable.', 404);
  mod_terrain_servir(mod_terrain_dossier('controles') . '/' . basename((string)$c['photo']), (string)$c['photo_mime'], 'controle-' . substr((string)$c['quand'], 0, 10) . '.' . (MOD_TERRAIN_FORMATS[(string)$c['photo_mime']] ?? 'jpg'), false);
}
function mod_terrain_controle_retirer(): void
{
  $b = corps();
  $st = db()->prepare('UPDATE m_terrain_controles SET archive = ? WHERE id = ?');
  $st->execute([!empty($b['remettre']) ? '' : maintenant(), (int)($b['id'] ?? 0)]);
  if (!$st->rowCount()) throw new RuntimeException('Contrôle introuvable.');
  journal('equipe', 'Contrôle qualité n° ' . (int)$b['id'] . (!empty($b['remettre']) ? ' remis' : ' retiré'));
  repondre(['ok' => true]);
}
function mod_terrain_controles(): void
{
  $db = db();
  $agents = mod_terrain_agents();
  $site = (int)($_GET['site'] ?? 0);
  $agent = (int)($_GET['agent'] ?? 0);
  $periode = (string)($_GET['periode'] ?? '3m');
  $depuis = match ($periode) { '1m' => date('Y-m-d H:i:s', (int)strtotime('-1 month')), '12m' => date('Y-m-d H:i:s', (int)strtotime('-12 months')), 'tout' => '0000', default => date('Y-m-d H:i:s', (int)strtotime('-3 months')) };
  $sql = "SELECT c.id, c.site_id, c.agent_id, c.agent_nom, c.quand, c.moyenne, c.controleur, c.photo <> '' AS photo, c.commentaire <> '' AS commente, s.nom AS site
    FROM m_terrain_controles c LEFT JOIN sites s ON s.id = c.site_id WHERE c.archive = '' AND c.quand >= ?";
  $p = [$depuis];
  if ($site) { $sql .= ' AND c.site_id = ?'; $p[] = $site; }
  if ($agent) { $sql .= ' AND c.agent_id = ?'; $p[] = $agent; }
  $st = $db->prepare($sql . ' ORDER BY c.quand DESC, c.id DESC LIMIT 400');
  $st->execute($p);
  $liste = array_map(fn ($c) => ['id' => (int)$c['id'], 'site_id' => (int)$c['site_id'], 'site' => (string)($c['site'] ?? 'Site retiré'), 'agent_id' => (int)$c['agent_id'],
    'agent' => (int)$c['agent_id'] ? ($agents[(int)$c['agent_id']]['nom'] ?? (string)$c['agent_nom']) : '', 'quand' => (string)$c['quand'], 'moyenne' => round((float)$c['moyenne'], 2),
    'controleur' => (string)$c['controleur'], 'photo' => (bool)$c['photo'], 'commente' => (bool)$c['commente']], $st->fetchAll());
  // moyennes sur 3 mois (servent aux rapports clients) : par site et par agent
  $st = $db->prepare("SELECT c.site_id, s.nom, COUNT(*) AS nb, AVG(c.moyenne) AS m FROM m_terrain_controles c LEFT JOIN sites s ON s.id = c.site_id WHERE c.archive = '' AND c.quand >= ? GROUP BY c.site_id ORDER BY m");
  $st->execute([date('Y-m-d H:i:s', (int)strtotime('-3 months'))]);
  $parSite = array_map(fn ($r) => ['id' => (int)$r['site_id'], 'nom' => (string)($r['nom'] ?? 'Site retiré'), 'nb' => (int)$r['nb'], 'moyenne' => round((float)$r['m'], 2)], $st->fetchAll());
  $st = $db->prepare("SELECT agent_id, MAX(agent_nom) AS agent_nom, COUNT(*) AS nb, AVG(moyenne) AS m FROM m_terrain_controles WHERE archive = '' AND agent_id > 0 AND quand >= ? GROUP BY agent_id ORDER BY m");
  $st->execute([date('Y-m-d H:i:s', (int)strtotime('-3 months'))]);
  $parAgent = array_map(fn ($r) => ['id' => (int)$r['agent_id'], 'nom' => $agents[(int)$r['agent_id']]['nom'] ?? (string)$r['agent_nom'], 'nb' => (int)$r['nb'], 'moyenne' => round((float)$r['m'], 2)], $st->fetchAll());
  $sites = array_map(fn ($s) => ['id' => (int)$s['id'], 'nom' => (string)$s['nom']], $db->query('SELECT id, nom FROM sites WHERE actif = 1 OR id IN (SELECT site_id FROM m_terrain_controles) ORDER BY actif DESC, nom COLLATE NOCASE')->fetchAll());
  $ag = [];
  foreach ($db->query('SELECT DISTINCT agent_id, agent_nom FROM m_terrain_controles WHERE agent_id > 0') as $r) $ag[(int)$r['agent_id']] = $agents[(int)$r['agent_id']]['nom'] ?? (string)$r['agent_nom'];
  asort($ag, SORT_NATURAL | SORT_FLAG_CASE);
  repondre(['ok' => true, 'controles' => $liste, 'parSite' => $parSite, 'parAgent' => $parAgent, 'sites' => $sites,
    'agents' => array_map(fn ($id, $nom) => ['id' => $id, 'nom' => $nom], array_keys($ag), array_values($ag))]);
}

/* =========================================================
   ESPACE ÉQUIPE (l'agent connecté seulement)
   ========================================================= */
// Consignes des sites où l'agent a des postes à venir (avec ?resume=1 : seulement ce qui reste à lire)
function mod_terrain_eq_consignes(): void
{
  $c = eq_exiger();
  $agent = (int)$c['agent_id'];
  $resume = !empty($_GET['resume']);
  $postes = [];
  foreach (mod_terrain_prevus($agent) as $s => $parAgent) if (isset($parAgent[$agent])) $postes[$s] = $parAgent[$agent];
  if (!$postes) repondre(['ok' => true, 'sites' => [], 'nonLus' => 0]);
  $ids = array_keys($postes);
  $in = implode(',', array_fill(0, count($ids), '?'));
  $db = db();
  $st = $db->prepare("SELECT id, nom, adresse, consignes, contact FROM sites WHERE id IN ($in)");
  $st->execute($ids);
  $sites = [];
  foreach ($st as $s) $sites[(int)$s['id']] = $s;
  $courantes = mod_terrain_courantes(true, $ids);
  $lues = [];
  $st = $db->prepare("SELECT site_id, version, lu FROM m_terrain_lectures WHERE agent_id = ? AND site_id IN ($in) ORDER BY version");
  $st->execute(array_merge([$agent], $ids));
  foreach ($st as $r) $lues[(int)$r['site_id']] = ['version' => (int)$r['version'], 'lu' => (string)$r['lu']];
  $urgences = [];
  $documents = [];
  if (!$resume) {
    $st = $db->prepare("SELECT site_id, urgences FROM m_terrain_sites WHERE site_id IN ($in)");
    $st->execute($ids);
    foreach ($st as $r) $urgences[(int)$r['site_id']] = array_values(array_filter(json_decode((string)$r['urgences'], true) ?: [], 'is_array'));
    $st = $db->prepare("SELECT id, site_id, type, titre, mime, taille FROM m_terrain_documents WHERE agents = 1 AND archive = '' AND site_id IN ($in) ORDER BY titre COLLATE NOCASE");
    $st->execute($ids);
    foreach ($st as $d) $documents[(int)$d['site_id']][] = ['id' => (int)$d['id'], 'type' => (string)$d['type'], 'titre' => (string)$d['titre'], 'mime' => (string)$d['mime'], 'taille' => (int)$d['taille']];
  }
  $liste = [];
  $nonLus = 0;
  foreach ($postes as $id => $poste) {
    $s = $sites[$id] ?? null;
    if (!$s) continue;
    $cour = $courantes[$id] ?? null;
    $l = $lues[$id] ?? null;
    $aLire = $cour && (!$l || $l['version'] !== (int)$cour['version']);
    if ($aLire) $nonLus++;
    if ($resume) {
      if ($aLire) $liste[] = ['id' => $id, 'nom' => (string)$s['nom'], 'prochain' => $poste, 'nouvelle' => $l !== null];
      continue;
    }
    $liste[] = [
      'id' => $id, 'nom' => (string)$s['nom'], 'adresse' => (string)$s['adresse'], 'contact' => (string)$s['contact'], 'prochain' => $poste,
      'consigne' => $cour ? ['id' => (int)$cour['id'], 'version' => (int)$cour['version'], 'texte' => (string)$cour['texte'], 'resume' => (string)$cour['resume'], 'cree' => (string)$cour['cree']] : null,
      // consignes encore seulement dans la fiche du planning : lisibles, sans accusé de lecture
      'texteFiche' => $cour ? '' : trim((string)$s['consignes']),
      'lu' => $cour && $l && $l['version'] === (int)$cour['version'] ? $l['lu'] : '',
      'versionLue' => $l ? $l['version'] : 0,
      'urgences' => $urgences[$id] ?? [],
      'documents' => $documents[$id] ?? [],
    ];
  }
  // à lire d'abord, puis par date du prochain poste
  usort($liste, fn ($x, $y) => [($x['lu'] ?? '') !== '' || empty($x['consigne']), $x['prochain']['jour'] . $x['prochain']['debut']] <=> [($y['lu'] ?? '') !== '' || empty($y['consigne']), $y['prochain']['jour'] . $y['prochain']['debut']]);
  repondre(['ok' => true, 'sites' => $liste, 'nonLus' => $nonLus]);
}
// « J'ai lu et compris » : agent, version, date (seulement la version en vigueur, et pour un site où il est prévu)
function mod_terrain_eq_lu(): void
{
  $c = eq_exiger();
  $agent = (int)$c['agent_id'];
  if (!limiter('terrain-lu', 60, 600)) throw new RuntimeException('Trop de confirmations d’affilée : réessayez dans quelques minutes.');
  $st = db()->prepare('SELECT id, site_id, version FROM m_terrain_consignes WHERE id = ?');
  $st->execute([(int)(corps()['id'] ?? 0)]);
  $v = $st->fetch();
  if (!$v) throw new RuntimeException('Ces consignes n’existent plus : rechargez la page.');
  $site = (int)$v['site_id'];
  $st = db()->prepare('SELECT MAX(version) FROM m_terrain_consignes WHERE site_id = ?');
  $st->execute([$site]);
  if ((int)$st->fetchColumn() > (int)$v['version']) echec('Une nouvelle version vient d’être publiée : rechargez la page pour la lire.', 409);
  if (!isset(mod_terrain_prevus($agent, $site)[$site][$agent])) echec('Ces consignes concernent un site où vous n’avez pas de poste prévu.', 403);
  db()->prepare('INSERT OR IGNORE INTO m_terrain_lectures (consigne_id, site_id, version, agent_id, lu, appareil) VALUES (?, ?, ?, ?, ?, ?)')
    ->execute([(int)$v['id'], $site, (int)$v['version'], $agent, maintenant(), mb_substr(appareil(), 0, 60)]);
  $st = db()->prepare('SELECT lu FROM m_terrain_lectures WHERE consigne_id = ? AND agent_id = ?');
  $st->execute([(int)$v['id'], $agent]);
  repondre(['ok' => true, 'lu' => (string)$st->fetchColumn(), 'version' => (int)$v['version']]);
}
// Document d'un site, visible des agents : seulement pour un agent prévu sur ce site
function mod_terrain_eq_document(): void
{
  $c = eq_exiger();
  $agent = (int)$c['agent_id'];
  $st = db()->prepare("SELECT * FROM m_terrain_documents WHERE id = ? AND agents = 1 AND archive = ''");
  $st->execute([(int)($_GET['id'] ?? 0)]);
  $d = $st->fetch();
  if (!$d) echec('Document introuvable.', 404);
  if (!isset(mod_terrain_prevus($agent, (int)$d['site_id'])[(int)$d['site_id']][$agent])) echec('Ce document est réservé aux agents prévus sur ce site.', 403);
  mod_terrain_servir(mod_terrain_dossier('documents') . '/' . basename((string)$d['fichier']), (string)$d['mime'], mod_terrain_nom_fichier((string)$d['titre'], (string)$d['mime']), false);
}
// « Mon matériel » : ce qui est confié à l'agent (lecture seule)
function mod_terrain_eq_materiel(): void
{
  $c = eq_exiger();
  $agent = (int)$c['agent_id'];
  $st = db()->prepare("SELECT id, type, libelle, numero, taille, etat, remis_le FROM m_terrain_materiel WHERE agent_id = ? AND archive = '' ORDER BY remis_le DESC, id DESC");
  $st->execute([$agent]);
  $materiel = $st->fetchAll();
  $st = db()->prepare("SELECT k.id, k.objet, k.nombre, k.depuis, s.nom AS site FROM m_terrain_cles k LEFT JOIN sites s ON s.id = k.site_id WHERE k.agent_id = ? AND k.archive = '' ORDER BY k.depuis DESC");
  $st->execute([$agent]);
  repondre(['ok' => true, 'materiel' => array_map(fn ($m) => ['id' => (int)$m['id'], 'type' => (string)$m['type'], 'libelle' => (string)$m['libelle'], 'numero' => (string)$m['numero'],
    'taille' => (string)$m['taille'], 'etat' => (string)$m['etat'], 'remis_le' => (string)$m['remis_le']], $materiel),
    'cles' => array_map(fn ($k) => ['id' => (int)$k['id'], 'objet' => (string)$k['objet'], 'nombre' => (int)$k['nombre'], 'depuis' => (string)$k['depuis'], 'site' => (string)($k['site'] ?? '')], $st->fetchAll()),
    'types' => MOD_TERRAIN_TYPES_MAT, 'etats' => MOD_TERRAIN_ETATS]);
}
