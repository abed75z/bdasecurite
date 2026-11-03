<?php
/* =========================================================
   MODULE « PORTAIL » — l'espace client haut de gamme (bdasecurite.com/espace-client)
   Le client y retrouve tout, sans mail :
   - son site en direct : agents en poste, semaine à venir, heures assurées ;
   - l'équipe : les agents que la direction choisit de lui montrer, avec les documents
     choisis un par un (carte pro, diplômes, certificats, attestations, CV) ;
     jamais la pièce d'identité, la sécurité sociale, le RIB, le contrat ou les justificatifs ;
   - les documents : devis, factures et PDF (cœur), documents d'agents partagés, ses propres dépôts ;
   - la messagerie avec pièces jointes et demandes guidées (renfort, planning, problème, facture),
     dont la direction suit l'avancement (reçue → prise en charge → faite) ;
   - le « bon pour accord » en ligne : nom, fonction, conditions acceptées, heure et empreinte gardées.
   Les alertes envoyées hors de l'espace ne contiennent jamais le contenu.
   ========================================================= */
declare(strict_types=1);

// Types de documents d'agent qu'on peut partager avec un client (les autres restent privés)
const MOD_PORTAIL_TYPES_PARTAGE = ['carte_pro' => 'Carte professionnelle', 'diplome_aps' => 'Diplôme / titre APS', 'certif' => 'Certification', 'attestation' => 'Attestation', 'cv' => 'CV'];
const MOD_PORTAIL_DEMANDES = ['renfort' => 'Demande de renfort', 'planning' => 'Modification du planning', 'probleme' => 'Problème signalé', 'facture' => 'Question sur une facture', 'document' => 'Demande de document'];
const MOD_PORTAIL_STATUTS = ['recue' => 'Reçue', 'en_cours' => 'Prise en charge', 'faite' => 'Faite'];
const MOD_PORTAIL_MAX = 15 * 1048576;
const MOD_PORTAIL_MIMES = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

function module_portail(): array
{
  return [
    'titre' => 'Espace client',
    'schema' => [
      1 => <<<'SQL'
        CREATE TABLE IF NOT EXISTS m_portail_partages (client_id INTEGER NOT NULL, agent_id INTEGER NOT NULL, visible INTEGER NOT NULL DEFAULT 1,
          docs TEXT NOT NULL DEFAULT '[]', par TEXT NOT NULL DEFAULT '', maj TEXT NOT NULL, PRIMARY KEY (client_id, agent_id));
        CREATE TABLE IF NOT EXISTS m_portail_pieces (id INTEGER PRIMARY KEY, message_id INTEGER NOT NULL, client_id INTEGER NOT NULL,
          fichier TEXT NOT NULL, nom TEXT NOT NULL, mime TEXT NOT NULL, taille INTEGER NOT NULL, cree TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS i_m_portail_pieces ON m_portail_pieces (client_id, message_id);
        CREATE TABLE IF NOT EXISTS m_portail_demandes (message_id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL, type TEXT NOT NULL,
          statut TEXT NOT NULL DEFAULT 'recue', maj TEXT NOT NULL, par TEXT NOT NULL DEFAULT '');
        CREATE INDEX IF NOT EXISTS i_m_portail_demandes ON m_portail_demandes (client_id, statut);
        CREATE TABLE IF NOT EXISTS m_portail_depots (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL, titre TEXT NOT NULL, fichier TEXT NOT NULL,
          nom TEXT NOT NULL, mime TEXT NOT NULL, taille INTEGER NOT NULL, cree TEXT NOT NULL, vu TEXT NOT NULL DEFAULT '');
        CREATE INDEX IF NOT EXISTS i_m_portail_depots ON m_portail_depots (client_id, id);
        CREATE TABLE IF NOT EXISTS m_portail_accords (id INTEGER PRIMARY KEY, document_id INTEGER NOT NULL, client_id INTEGER NOT NULL, numero TEXT NOT NULL,
          nom TEXT NOT NULL, fonction TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', ip TEXT NOT NULL DEFAULT '', appareil TEXT NOT NULL DEFAULT '',
          empreinte TEXT NOT NULL, quand TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS i_m_portail_accords ON m_portail_accords (document_id);
        SQL,
    ],
    'admin' => [
      'clients' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_clients'],
      'partages' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_partages'],
      'partage.enregistrer' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_partage'],
      'depots' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_depots'],
      'depot' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_depot'],
      'fil' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_fil'],
      'piece' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_piece'],
      'repondre' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_repondre'],
      'demande.statut' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_demande'],
    ],
    'client' => [
      'accueil' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_accueil'],
      'site' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_site'],
      'equipe' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_equipe'],
      'agent.doc' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_agent_doc'],
      'documents' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_documents'],
      'depot' => ['methode' => 'POST', 'fn' => 'mod_portail_cl_depot'],
      'depot.fichier' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_depot_fichier'],
      'messages' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_messages'],
      'message.envoyer' => ['methode' => 'POST', 'fn' => 'mod_portail_cl_envoyer'],
      'piece' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_piece'],
      'devis.signer' => ['methode' => 'POST', 'fn' => 'mod_portail_cl_signer'],
      'accord' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_accord'],
    ],
    'compteurs' => 'mod_portail_compteurs',
  ];
}

function mod_portail_compteurs(): array
{
  $db = db();
  return [
    'portail' => (int)$db->query("SELECT COUNT(*) FROM m_portail_depots WHERE vu = ''")->fetchColumn()
      + (int)$db->query("SELECT COUNT(*) FROM m_portail_demandes WHERE statut = 'recue'")->fetchColumn(),
  ];
}

/* =========================================================
   Outils
   ========================================================= */
function mod_portail_dossier(string $sous): string
{
  $d = dossier_donnees() . '/clients/' . $sous;
  if (!is_dir($d) && !@mkdir($d, 0700, true)) throw new RuntimeException('Espace de stockage indisponible.');
  return $d;
}
// « PETIT Yanis » → « Yanis P. » : le client ne voit jamais le nom de famille complet
function mod_portail_nom_court(string $nom): string
{
  $mots = preg_split('/\s+/', trim($nom)) ?: [];
  $famille = $prenoms = [];
  foreach ($mots as $m) {
    if ($m !== '' && mb_strtoupper($m) === $m && preg_match('/\p{L}{2,}/u', $m)) $famille[] = $m;
    else $prenoms[] = $m;
  }
  if (!$prenoms) { $prenoms = array_slice($mots, -1); $famille = array_slice($mots, 0, -1); }
  $prenom = mb_convert_case(mb_strtolower(implode(' ', $prenoms)), MB_CASE_TITLE);
  $initiale = $famille ? mb_strtoupper(mb_substr($famille[0], 0, 1)) . '.' : '';
  return trim("$prenom $initiale") ?: 'Agent';
}
function mod_portail_qualif(string $poste): string
{
  if (function_exists('mod_badge_qualif')) return mod_badge_qualif($poste);
  return preg_match('/ssiap/i', $poste) ? 'Agent de sécurité incendie' : 'Agent de sécurité';
}
// Sites du client : [id => nom]
function mod_portail_sites(int $clientId): array
{
  $st = db()->prepare('SELECT id, nom FROM sites WHERE client_id = ? AND actif = 1 ORDER BY ordre, nom');
  $st->execute([$clientId]);
  $out = [];
  foreach ($st->fetchAll() as $s) $out[(int)$s['id']] = (string)$s['nom'];
  return $out;
}
function mod_portail_in(array $ids): string
{
  return $ids ? implode(',', array_map('intval', $ids)) : '0';
}
// Durée d'une vacation en heures (passage de minuit, pause déduite)
function mod_portail_duree(string $debut, string $fin, int $pause = 0): float
{
  $m = fn ($x) => preg_match('/^(\d{1,2}):(\d{2})/', $x, $r) ? (int)$r[1] * 60 + (int)$r[2] : 0;
  $d = $m($fin) - $m($debut);
  if ($d <= 0) $d += 1440;
  return max(0, $d - $pause) / 60;
}
function mod_portail_heures(array $siteIds, string $du, string $au): float
{
  if (!$siteIds) return 0;
  $st = db()->prepare("SELECT debut, fin, pause FROM vacations WHERE site_id IN (" . mod_portail_in($siteIds) . ") AND agent_id > 0 AND statut <> 'annulee' AND jour BETWEEN ? AND ?");
  $st->execute([$du, $au]);
  $t = 0.0;
  foreach ($st->fetchAll() as $v) $t += mod_portail_duree((string)$v['debut'], (string)$v['fin'], (int)$v['pause']);
  return round($t, 1);
}
// Agents en poste maintenant sur les sites du client (pointage ouvert + poste prévu sur un de ses sites hier ou aujourd'hui)
function mod_portail_en_poste(array $siteIds): array
{
  if (!$siteIds) return [];
  $st = db()->prepare("SELECT p.agent_id, MIN(p.debut) AS debut, a.nom, a.poste FROM pointages p JOIN agents a ON a.id = p.agent_id
      WHERE p.fin = '' AND p.debut >= ? AND p.agent_id IN (SELECT agent_id FROM vacations WHERE site_id IN (" . mod_portail_in($siteIds) . ") AND agent_id > 0 AND statut <> 'annulee' AND jour IN (?, ?))
      GROUP BY p.agent_id ORDER BY debut");
  $st->execute([date('Y-m-d H:i:s', time() - 18 * 3600), date('Y-m-d'), date('Y-m-d', strtotime('-1 day'))]);
  return array_map(fn ($r) => ['agent_id' => (int)$r['agent_id'], 'nom' => mod_portail_nom_court((string)$r['nom']), 'qualification' => mod_portail_qualif((string)$r['poste']),
    'depuis' => substr((string)$r['debut'], 11, 5)], $st->fetchAll());
}
// Le client ne peut toucher qu'à ses propres données : documents reconnus par le nom du client (comme le cœur)
function mod_portail_compte(): array
{
  if (!function_exists('exiger_compte')) throw new RuntimeException('Connexion requise.');
  return exiger_compte();
}
function mod_portail_fichier_recu(string $champ): ?array
{
  $f = $_FILES[$champ] ?? null;
  if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
  if (in_array($f['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) || (int)$f['size'] > MOD_PORTAIL_MAX) throw new RuntimeException('Fichier trop lourd (15 Mo au plus).');
  if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file((string)$f['tmp_name'])) throw new RuntimeException('Le fichier n’a pas été reçu. Réessayez.');
  $mime = type_fichier((string)$f['tmp_name']);
  if (!isset(MOD_PORTAIL_MIMES[$mime])) throw new RuntimeException('Formats acceptés : PDF, JPG, PNG ou WEBP.');
  return ['tmp' => (string)$f['tmp_name'], 'mime' => $mime, 'nom' => mb_substr(trim((string)preg_replace('/[^\w .()-]+/u', '_', (string)($f['name'] ?? 'document'))), 0, 120) ?: 'document', 'taille' => (int)$f['size']];
}
function mod_portail_ranger(array $f, string $sous): string
{
  $nom = bin2hex(random_bytes(16)) . '.' . MOD_PORTAIL_MIMES[$f['mime']];
  if (!move_uploaded_file($f['tmp'], mod_portail_dossier($sous) . '/' . $nom)) throw new RuntimeException('Enregistrement du fichier impossible.');
  return $nom;
}
function mod_portail_servir(string $chemin, string $mime, string $nom, bool $telecharger = false): never
{
  if (!is_file($chemin)) echec('Fichier introuvable.', 404);
  header('Content-Type: ' . $mime);
  header('Content-Length: ' . filesize($chemin));
  header('Content-Disposition: ' . ($telecharger ? 'attachment' : 'inline') . '; filename="' . (preg_replace('/[^\w .()-]+/u', '_', $nom) ?: 'document') . '"');
  header('Cache-Control: private, no-store');
  header('X-Content-Type-Options: nosniff');
  readfile($chemin);
  exit;
}
// Alerte courte au client (jamais le contenu) : un nouveau message, un nouveau document…
function mod_portail_alerter(int $clientId, string $sujet, string $quoi, string $ancre): void
{
  $st = db()->prepare('SELECT email FROM comptes_clients WHERE client_id = ? AND actif = 1 AND hash <> \'\'');
  $st->execute([$clientId]);
  $email = (string)$st->fetchColumn();
  if ($email === '') return;
  envoyer_mail($sujet, "Bonjour,\n\n$quoi dans votre espace client.\n\nOuvrir votre espace : https://bdasecurite.com/espace-client#/$ancre\n\nBDA Security Group — 06 11 67 86 25", BDA_EMAIL, $email);
}
// Partages d'un client : [agent_id => ['visible' => bool, 'docs' => [ids]]]
function mod_portail_partages(int $clientId): array
{
  $st = db()->prepare('SELECT agent_id, visible, docs FROM m_portail_partages WHERE client_id = ?');
  $st->execute([$clientId]);
  $out = [];
  foreach ($st->fetchAll() as $p) $out[(int)$p['agent_id']] = ['visible' => (int)$p['visible'] === 1, 'docs' => array_values(array_map('intval', json_decode((string)$p['docs'], true) ?: []))];
  return $out;
}

/* =========================================================
   CÔTÉ CLIENT
   ========================================================= */
function mod_portail_cl_accueil(): void
{
  $c = mod_portail_compte();
  $cid = (int)$c['client_id'];
  $sites = mod_portail_sites($cid);
  $ids = array_keys($sites);
  // prochain passage : le premier poste à venir sur ses sites
  $prochain = null;
  if ($ids) {
    $st = db()->prepare("SELECT v.jour, v.debut, v.fin, v.agent_id, a.nom, a.poste FROM vacations v LEFT JOIN agents a ON a.id = v.agent_id
        WHERE v.site_id IN (" . mod_portail_in($ids) . ") AND v.statut <> 'annulee' AND (v.jour > ? OR (v.jour = ? AND v.debut > ?)) ORDER BY v.jour, v.debut LIMIT 1");
    $st->execute([date('Y-m-d'), date('Y-m-d'), date('H:i')]);
    if ($v = $st->fetch()) $prochain = ['jour' => $v['jour'], 'debut' => $v['debut'], 'fin' => $v['fin'],
      'agent' => (int)$v['agent_id'] > 0 ? mod_portail_nom_court((string)$v['nom']) : '', 'qualification' => (int)$v['agent_id'] > 0 ? mod_portail_qualif((string)$v['poste']) : ''];
  }
  $mois = date('Y-m');
  $precedent = date('Y-m', strtotime('first day of last month'));
  $st = db()->prepare('SELECT auteur, texte, cree FROM messages_clients WHERE client_id = ? ORDER BY id DESC LIMIT 1');
  $st->execute([$cid]);
  $dernier = $st->fetch() ?: null;
  if ($dernier) $dernier['texte'] = mb_substr((string)$dernier['texte'], 0, 220);
  repondre(['ok' => true, 'sites' => array_values($sites), 'enPoste' => mod_portail_en_poste($ids), 'prochain' => $prochain,
    'heuresMois' => mod_portail_heures($ids, "$mois-01", date('Y-m-d')), 'heuresPrecedent' => mod_portail_heures($ids, "$precedent-01", date('Y-m-t', strtotime("$precedent-01"))),
    'moisPrecedent' => $precedent, 'dernierMessage' => $dernier, 'agentsPartages' => count(array_filter(mod_portail_partages($cid), fn ($p) => $p['visible']))]);
}

function mod_portail_cl_site(): void
{
  $c = mod_portail_compte();
  $sites = mod_portail_sites((int)$c['client_id']);
  $ids = array_keys($sites);
  $semaine = [];
  if ($ids) {
    $st = db()->prepare("SELECT v.site_id, v.jour, v.debut, v.fin, v.agent_id, a.nom FROM vacations v LEFT JOIN agents a ON a.id = v.agent_id
        WHERE v.site_id IN (" . mod_portail_in($ids) . ") AND v.statut <> 'annulee' AND v.jour BETWEEN ? AND ? ORDER BY v.jour, v.debut LIMIT 120");
    $st->execute([date('Y-m-d'), date('Y-m-d', strtotime('+6 days'))]);
    foreach ($st->fetchAll() as $v) {
      $cle = $v['jour'] . '|' . $v['debut'] . '|' . $v['fin'] . '|' . $v['site_id'];
      $semaine[$cle] ??= ['jour' => $v['jour'], 'debut' => $v['debut'], 'fin' => $v['fin'], 'site' => $sites[(int)$v['site_id']] ?? '', 'agents' => [], 'aPourvoir' => 0];
      if ((int)$v['agent_id'] > 0) $semaine[$cle]['agents'][] = mod_portail_nom_court((string)$v['nom']);
      else $semaine[$cle]['aPourvoir']++;
    }
  }
  $adr = db()->prepare('SELECT nom, adresse FROM sites WHERE id IN (' . mod_portail_in($ids) . ')');
  $adr->execute();
  repondre(['ok' => true, 'sites' => $adr->fetchAll(), 'enPoste' => mod_portail_en_poste($ids), 'semaine' => array_values($semaine),
    'heuresMois' => mod_portail_heures($ids, date('Y-m') . '-01', date('Y-m-d'))]);
}

function mod_portail_cl_equipe(): void
{
  $c = mod_portail_compte();
  $cid = (int)$c['client_id'];
  $partages = array_filter(mod_portail_partages($cid), fn ($p) => $p['visible']);
  $sites = array_keys(mod_portail_sites($cid));
  $enPoste = array_column(mod_portail_en_poste($sites), 'depuis', 'agent_id');
  $db = db();
  $agents = [];
  foreach ($partages as $aid => $p) {
    $st = $db->prepare('SELECT id, nom, poste, carte, validite, actif FROM agents WHERE id = ?');
    $st->execute([$aid]);
    $a = $st->fetch();
    if (!$a || !(int)$a['actif']) continue;
    $docs = [];
    if ($p['docs']) {
      $d = $db->prepare('SELECT id, type, nom, mime, ajoute FROM agent_docs WHERE agent_id = ? AND id IN (' . mod_portail_in($p['docs']) . ') AND type IN (\'' . implode("','", array_keys(MOD_PORTAIL_TYPES_PARTAGE)) . '\') ORDER BY ajoute DESC');
      $d->execute([$aid]);
      foreach ($d->fetchAll() as $x) $docs[] = ['id' => (int)$x['id'], 'type' => MOD_PORTAIL_TYPES_PARTAGE[$x['type']] ?? 'Document', 'nom' => (string)$x['nom'], 'image' => str_starts_with((string)$x['mime'], 'image/'), 'ajoute' => substr((string)$x['ajoute'], 0, 10)];
    }
    $formations = [];
    try {
      $f = $db->prepare("SELECT type, libelle, expire FROM m_rh_formations WHERE agent_id = ? AND archive = '' ORDER BY expire DESC");
      $f->execute([$aid]);
      foreach ($f->fetchAll() as $x) {
        $lib = (string)$x['libelle'] ?: (defined('MOD_RH_FORMATIONS') ? (string)(MOD_RH_FORMATIONS[$x['type']][0] ?? $x['type']) : (string)$x['type']);
        $formations[] = ['libelle' => $lib, 'expire' => (string)$x['expire'], 'valide' => $x['expire'] === '' || $x['expire'] >= date('Y-m-d')];
      }
    } catch (Throwable $e) { /* module Formations absent */ }
    $carte = (string)$a['carte'];
    $etat = function_exists('mod_badge_etat') ? mod_badge_etat($a) : ((string)$a['validite'] >= date('Y-m-d') ? 'valide' : 'a_verifier');
    $depuis = '';
    if ($sites) {
      $s = $db->prepare('SELECT MIN(jour) FROM vacations WHERE agent_id = ? AND site_id IN (' . mod_portail_in($sites) . ") AND statut <> 'annulee'");
      $s->execute([$aid]);
      $depuis = (string)$s->fetchColumn();
    }
    $agents[] = [
      'id' => (int)$a['id'],
      'nom' => mod_portail_nom_court((string)$a['nom']),
      'qualification' => mod_portail_qualif((string)$a['poste']),
      'carte' => $carte !== '' ? '···· ' . mb_substr($carte, -4) : '',
      'validite' => preg_match('/^(\d{4})-(\d{2})-(\d{2})/', (string)$a['validite'], $m) ? "$m[3]/$m[2]/$m[1]" : '',
      'etat' => $etat,
      'verifier' => function_exists('mod_badge_jeton') && $etat !== 'inactif' ? mod_url('verifier') . '#' . mod_badge_jeton((int)$a['id']) : '',
      'enPoste' => $enPoste[(int)$a['id']] ?? '',
      'depuis' => $depuis,
      'heuresMois' => $sites ? mod_portail_heures_agent((int)$a['id'], $sites) : 0,
      'formations' => $formations,
      'docs' => $docs,
    ];
  }
  repondre(['ok' => true, 'agents' => $agents]);
}
function mod_portail_heures_agent(int $agentId, array $siteIds): float
{
  $st = db()->prepare("SELECT debut, fin, pause FROM vacations WHERE agent_id = ? AND site_id IN (" . mod_portail_in($siteIds) . ") AND statut <> 'annulee' AND jour BETWEEN ? AND ?");
  $st->execute([$agentId, date('Y-m') . '-01', date('Y-m-d')]);
  $t = 0.0;
  foreach ($st->fetchAll() as $v) $t += mod_portail_duree((string)$v['debut'], (string)$v['fin'], (int)$v['pause']);
  return round($t, 1);
}

function mod_portail_cl_agent_doc(): void
{
  $c = mod_portail_compte();
  $id = (int)($_GET['id'] ?? 0);
  $st = db()->prepare('SELECT d.*, a.nom AS agent FROM agent_docs d JOIN agents a ON a.id = d.agent_id WHERE d.id = ?');
  $st->execute([$id]);
  $d = $st->fetch();
  $p = $d ? (mod_portail_partages((int)$c['client_id'])[(int)$d['agent_id']] ?? null) : null;
  if (!$d || !$p || !$p['visible'] || !in_array($id, $p['docs'], true) || !isset(MOD_PORTAIL_TYPES_PARTAGE[$d['type']])) echec('Document introuvable.', 404);
  journal('document', 'Espace client : ' . $c['nom'] . ' a consulté « ' . $d['nom'] . ' » (dossier de ' . mod_portail_nom_court((string)$d['agent']) . ')');
  mod_portail_servir(dossier_docs() . '/' . basename((string)$d['fichier']), (string)$d['mime'], (string)$d['nom'], !empty($_GET['telecharger']));
}

function mod_portail_cl_documents(): void
{
  $c = mod_portail_compte();
  $cid = (int)$c['client_id'];
  $st = db()->prepare('SELECT id, titre, nom, mime, taille, cree, vu FROM m_portail_depots WHERE client_id = ? ORDER BY id DESC LIMIT 200');
  $st->execute([$cid]);
  $depots = $st->fetchAll();
  $agents = [];
  foreach (array_filter(mod_portail_partages($cid), fn ($p) => $p['visible'] && $p['docs']) as $aid => $p) {
    $d = db()->prepare('SELECT d.id, d.type, d.nom, d.ajoute, a.nom AS agent FROM agent_docs d JOIN agents a ON a.id = d.agent_id WHERE d.agent_id = ? AND a.actif = 1 AND d.id IN (' . mod_portail_in($p['docs']) . ')');
    $d->execute([$aid]);
    foreach ($d->fetchAll() as $x) if (isset(MOD_PORTAIL_TYPES_PARTAGE[$x['type']])) $agents[] = ['id' => (int)$x['id'], 'titre' => MOD_PORTAIL_TYPES_PARTAGE[$x['type']] . ' · ' . mod_portail_nom_court((string)$x['agent']), 'nom' => (string)$x['nom'], 'date' => substr((string)$x['ajoute'], 0, 10)];
  }
  $acc = db()->prepare('SELECT document_id, numero, nom, fonction, quand FROM m_portail_accords WHERE client_id = ? ORDER BY id DESC');
  $acc->execute([$cid]);
  repondre(['ok' => true, 'depots' => $depots, 'agents' => $agents, 'accords' => $acc->fetchAll()]);
}

function mod_portail_cl_depot(): void
{
  $c = mod_portail_compte();
  $cid = (int)$c['client_id'];
  if (!limiter('portail-depot:' . $cid, 30, 3600)) throw new RuntimeException('Beaucoup d’envois d’affilée : réessayez dans un moment.');
  $f = mod_portail_fichier_recu('fichier');
  if (!$f) throw new RuntimeException('Choisissez un fichier.');
  $titre = mb_substr(trim((string)($_POST['titre'] ?? '')), 0, 120) ?: preg_replace('/\.[a-z0-9]+$/i', '', $f['nom']);
  $nom = mod_portail_ranger($f, 'depots');
  db()->prepare('INSERT INTO m_portail_depots (client_id, titre, fichier, nom, mime, taille, cree) VALUES (?, ?, ?, ?, ?, ?, ?)')
    ->execute([$cid, $titre, $nom, $f['nom'], $f['mime'], $f['taille'], maintenant()]);
  journal('document', "Espace client : {$c['nom']} a déposé « $titre »");
  notifier('espace_client', 'Document déposé par un client', 'Un client a déposé un document dans son espace.', '/admin/#/portail/' . $cid, 'depot-' . $cid);
  repondre(['ok' => true]);
}
function mod_portail_cl_depot_fichier(): void
{
  $c = mod_portail_compte();
  $st = db()->prepare('SELECT * FROM m_portail_depots WHERE id = ? AND client_id = ?');
  $st->execute([(int)($_GET['id'] ?? 0), (int)$c['client_id']]);
  $d = $st->fetch();
  if (!$d) echec('Document introuvable.', 404);
  mod_portail_servir(mod_portail_dossier('depots') . '/' . basename((string)$d['fichier']), (string)$d['mime'], (string)$d['nom'], !empty($_GET['telecharger']));
}

// Messagerie : les messages du cœur (messages_clients) + pièces jointes et demandes de ce module
function mod_portail_fil(int $clientId): array
{
  $db = db();
  $st = $db->prepare('SELECT id, auteur, texte, cree, lu FROM messages_clients WHERE client_id = ? ORDER BY id DESC LIMIT 200');
  $st->execute([$clientId]);
  $liste = array_reverse($st->fetchAll());
  $p = $db->prepare('SELECT id, message_id, nom, mime, taille FROM m_portail_pieces WHERE client_id = ?');
  $p->execute([$clientId]);
  $pieces = [];
  foreach ($p->fetchAll() as $x) $pieces[(int)$x['message_id']][] = ['id' => (int)$x['id'], 'nom' => (string)$x['nom'], 'image' => str_starts_with((string)$x['mime'], 'image/')];
  $d = $db->prepare('SELECT message_id, type, statut, maj FROM m_portail_demandes WHERE client_id = ?');
  $d->execute([$clientId]);
  $demandes = [];
  foreach ($d->fetchAll() as $x) $demandes[(int)$x['message_id']] = ['type' => (string)$x['type'], 'libelle' => MOD_PORTAIL_DEMANDES[$x['type']] ?? 'Demande', 'statut' => (string)$x['statut'], 'etat' => MOD_PORTAIL_STATUTS[$x['statut']] ?? '', 'maj' => (string)$x['maj']];
  foreach ($liste as &$m) {
    $m['id'] = (int)$m['id'];
    $m['lu'] = (int)$m['lu'] === 1;
    $m['pieces'] = $pieces[$m['id']] ?? [];
    $m['demande'] = $demandes[$m['id']] ?? null;
  }
  return $liste;
}
function mod_portail_cl_messages(): void
{
  $c = mod_portail_compte();
  $cid = (int)$c['client_id'];
  $fil = mod_portail_fil($cid);
  db()->prepare("UPDATE messages_clients SET lu = 1 WHERE client_id = ? AND auteur = 'admin' AND lu = 0")->execute([$cid]);
  repondre(['ok' => true, 'messages' => $fil, 'types' => MOD_PORTAIL_DEMANDES]);
}
function mod_portail_cl_envoyer(): void
{
  $c = mod_portail_compte();
  $cid = (int)$c['client_id'];
  if (!limiter('client-message:' . $cid, 20, 3600)) throw new RuntimeException('Trop de messages envoyés. Réessayez dans un moment ou appelez-nous au 06 11 67 86 25.');
  $texte = texte($_POST['texte'] ?? '', 4000);
  $type = (string)($_POST['demande'] ?? '');
  if ($type !== '' && !isset(MOD_PORTAIL_DEMANDES[$type])) $type = '';
  $f = mod_portail_fichier_recu('piece');
  if (mb_strlen($texte) < 2 && !$f) throw new RuntimeException('Écrivez votre message.');
  if ($texte === '') $texte = $f ? 'Pièce jointe : ' . $f['nom'] : '';
  $db = db();
  $db->prepare("INSERT INTO messages_clients (client_id, auteur, texte, cree) VALUES (?, 'client', ?, ?)")->execute([$cid, $texte, maintenant()]);
  $mid = (int)$db->lastInsertId();
  if ($f) $db->prepare('INSERT INTO m_portail_pieces (message_id, client_id, fichier, nom, mime, taille, cree) VALUES (?, ?, ?, ?, ?, ?, ?)')
    ->execute([$mid, $cid, mod_portail_ranger($f, 'pieces'), $f['nom'], $f['mime'], $f['taille'], maintenant()]);
  if ($type !== '') $db->prepare("INSERT INTO m_portail_demandes (message_id, client_id, type, statut, maj) VALUES (?, ?, ?, 'recue', ?)")->execute([$mid, $cid, $type, maintenant()]);
  $quoi = $type !== '' ? MOD_PORTAIL_DEMANDES[$type] : 'Nouveau message';
  journal('site', "$quoi de {$c['nom']} (espace client)");
  notifier('messages', $type !== '' ? "$quoi d’un client" : 'Nouveau message d’un client', 'Ouvrez la messagerie de l’admin pour le lire.', '/admin/#/messages/' . $cid, 'message-client');
  envoyer_mail("$quoi — {$c['nom']} (espace client)", "{$c['nom']} vous a écrit depuis son espace client" . ($f ? ' (avec une pièce jointe)' : '') . " :\n\n$texte\n\n—\nRépondre depuis l'admin : https://bdasecurite.com/admin/#/messages/$cid", $c['email']);
  repondre(['ok' => true]);
}
function mod_portail_cl_piece(): void
{
  $c = mod_portail_compte();
  $st = db()->prepare('SELECT * FROM m_portail_pieces WHERE id = ? AND client_id = ?');
  $st->execute([(int)($_GET['id'] ?? 0), (int)$c['client_id']]);
  $p = $st->fetch();
  if (!$p) echec('Pièce introuvable.', 404);
  mod_portail_servir(mod_portail_dossier('pieces') . '/' . basename((string)$p['fichier']), (string)$p['mime'], (string)$p['nom'], !empty($_GET['telecharger']));
}

// « Bon pour accord » en ligne : on garde qui, quand, d'où et l'empreinte du devis accepté
function mod_portail_cl_signer(): void
{
  $c = mod_portail_compte();
  $b = corps();
  $id = (int)($b['id'] ?? 0);
  $nom = texte($b['nom'] ?? '', 120);
  $fonction = texte($b['fonction'] ?? '', 120);
  if (mb_strlen($nom) < 3) throw new RuntimeException('Écrivez votre nom et votre prénom.');
  if (empty($b['cgv'])) throw new RuntimeException('Cochez l’acceptation des conditions générales de vente.');
  $st = db()->prepare("SELECT id, numero, statut, total, data FROM documents WHERE id = ? AND type = 'devis' AND lower(trim(client)) = ? AND partage <> ''");
  $st->execute([$id, mb_strtolower(trim((string)$c['nom']))]);
  $d = $st->fetch();
  if (!$d) echec('Devis introuvable.', 404);
  if ($d['statut'] !== 'envoye') throw new RuntimeException('Ce devis ne peut plus être signé en ligne. Contactez-nous au 06 11 67 86 25.');
  $quand = maintenant();
  $empreinte = hash('sha256', $d['numero'] . '|' . $d['total'] . '|' . $d['data']);
  $db = db();
  $db->prepare('INSERT INTO m_portail_accords (document_id, client_id, numero, nom, fonction, email, ip, appareil, empreinte, quand) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([$id, (int)$c['client_id'], $d['numero'], $nom, $fonction, (string)$c['email'], (string)($_SERVER['REMOTE_ADDR'] ?? ''), mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 250), $empreinte, $quand]);
  $db->prepare("UPDATE documents SET statut = 'accepte', maj = ? WHERE id = ?")->execute([$quand, $id]);
  journal('document', "Devis {$d['numero']} SIGNÉ EN LIGNE (bon pour accord) par $nom" . ($fonction ? ", $fonction" : '') . " — {$c['nom']}");
  notifier('espace_client', "Devis {$d['numero']} signé", "Bon pour accord donné en ligne par $nom.", '/admin/#/devis/' . $id, 'devis-' . $id);
  envoyer_mail("Devis {$d['numero']} signé par {$c['nom']}", "Bonne nouvelle : {$c['nom']} vient de signer le devis {$d['numero']} en ligne (bon pour accord).\n\nSignataire : $nom" . ($fonction ? " ($fonction)" : '') . "\nCompte : {$c['email']}\nLe : " . date('d/m/Y à H:i') . "\n\nhttps://bdasecurite.com/admin/#/devis/$id");
  repondre(['ok' => true, 'quand' => $quand]);
}
function mod_portail_cl_accord(): void
{
  $c = mod_portail_compte();
  $st = db()->prepare('SELECT numero, nom, fonction, quand, empreinte FROM m_portail_accords WHERE document_id = ? AND client_id = ? ORDER BY id DESC LIMIT 1');
  $st->execute([(int)($_GET['id'] ?? 0), (int)$c['client_id']]);
  repondre(['ok' => true, 'accord' => $st->fetch() ?: null]);
}

/* =========================================================
   CÔTÉ ADMIN
   ========================================================= */
function mod_portail_adm_clients(): void
{
  $db = db();
  $liste = $db->query("SELECT c.id, c.nom, cc.email, cc.actif, cc.derniere, cc.hash <> '' AS active,
      (SELECT COUNT(*) FROM m_portail_partages p WHERE p.client_id = c.id AND p.visible = 1) AS agents,
      (SELECT COUNT(*) FROM m_portail_depots d WHERE d.client_id = c.id AND d.vu = '') AS depots,
      (SELECT COUNT(*) FROM m_portail_demandes x WHERE x.client_id = c.id AND x.statut <> 'faite') AS demandes,
      (SELECT COUNT(*) FROM sites s WHERE s.client_id = c.id AND s.actif = 1) AS sites
    FROM clients c JOIN comptes_clients cc ON cc.client_id = c.id ORDER BY c.nom COLLATE NOCASE")->fetchAll();
  repondre(['ok' => true, 'clients' => array_map(fn ($r) => ['id' => (int)$r['id'], 'nom' => (string)$r['nom'], 'email' => (string)$r['email'], 'actif' => (int)$r['actif'] === 1,
    'active' => (bool)$r['active'], 'derniere' => (string)$r['derniere'], 'agents' => (int)$r['agents'], 'depots' => (int)$r['depots'], 'demandes' => (int)$r['demandes'], 'sites' => (int)$r['sites']], $liste)]);
}
function mod_portail_adm_partages(): void
{
  $cid = (int)($_GET['client_id'] ?? 0);
  $db = db();
  $st = $db->prepare('SELECT id, nom FROM clients WHERE id = ?');
  $st->execute([$cid]);
  $client = $st->fetch();
  if (!$client) throw new RuntimeException('Client introuvable.');
  $sites = array_keys(mod_portail_sites($cid));
  $affectes = [];
  if ($sites) {
    $a = $db->prepare('SELECT DISTINCT agent_id FROM vacations WHERE site_id IN (' . mod_portail_in($sites) . ") AND agent_id > 0 AND statut <> 'annulee' AND jour BETWEEN ? AND ?");
    $a->execute([date('Y-m-d', strtotime('-90 days')), date('Y-m-d', strtotime('+45 days'))]);
    $affectes = array_map('intval', $a->fetchAll(PDO::FETCH_COLUMN));
  }
  $partages = mod_portail_partages($cid);
  $types = "'" . implode("','", array_keys(MOD_PORTAIL_TYPES_PARTAGE)) . "'";
  $agents = [];
  foreach ($db->query('SELECT id, nom, poste, carte, validite FROM agents WHERE actif = 1 ORDER BY nom COLLATE NOCASE')->fetchAll() as $a) {
    $aid = (int)$a['id'];
    $d = $db->prepare("SELECT id, type, nom, ajoute FROM agent_docs WHERE agent_id = ? AND type IN ($types) ORDER BY type, ajoute DESC");
    $d->execute([$aid]);
    $agents[] = ['id' => $aid, 'nom' => (string)$a['nom'], 'court' => mod_portail_nom_court((string)$a['nom']), 'poste' => (string)$a['poste'],
      'validite' => (string)$a['validite'], 'affecte' => in_array($aid, $affectes, true),
      'visible' => $partages[$aid]['visible'] ?? false, 'partages' => $partages[$aid]['docs'] ?? [],
      'docs' => array_map(fn ($x) => ['id' => (int)$x['id'], 'type' => MOD_PORTAIL_TYPES_PARTAGE[$x['type']] ?? $x['type'], 'nom' => (string)$x['nom'], 'ajoute' => substr((string)$x['ajoute'], 0, 10)], $d->fetchAll())];
  }
  // les agents du site d'abord, puis ceux déjà visibles, puis les autres
  usort($agents, fn ($x, $y) => [!$x['affecte'], !$x['visible'], $x['nom']] <=> [!$y['affecte'], !$y['visible'], $y['nom']]);
  repondre(['ok' => true, 'client' => ['id' => $cid, 'nom' => (string)$client['nom']], 'sites' => count($sites), 'agents' => $agents]);
}
function mod_portail_adm_partage(): void
{
  $b = corps();
  $cid = (int)($b['client_id'] ?? 0);
  $aid = (int)($b['agent_id'] ?? 0);
  $db = db();
  $st = $db->prepare('SELECT (SELECT nom FROM clients WHERE id = ?) AS client, (SELECT nom FROM agents WHERE id = ?) AS agent');
  $st->execute([$cid, $aid]);
  $n = $st->fetch();
  if (!$n || !$n['client'] || !$n['agent']) throw new RuntimeException('Client ou agent introuvable.');
  // seuls les documents partageables de CET agent sont gardés
  $ids = array_values(array_unique(array_map('intval', (array)($b['docs'] ?? []))));
  $ok = [];
  if ($ids) {
    $d = $db->prepare('SELECT id FROM agent_docs WHERE agent_id = ? AND id IN (' . mod_portail_in($ids) . ") AND type IN ('" . implode("','", array_keys(MOD_PORTAIL_TYPES_PARTAGE)) . "')");
    $d->execute([$aid]);
    $ok = array_map('intval', $d->fetchAll(PDO::FETCH_COLUMN));
  }
  $visible = !empty($b['visible']) ? 1 : 0;
  $db->prepare('INSERT INTO m_portail_partages (client_id, agent_id, visible, docs, par, maj) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id, agent_id) DO UPDATE SET visible = excluded.visible, docs = excluded.docs, par = excluded.par, maj = excluded.maj')
    ->execute([$cid, $aid, $visible, json_encode($ok), (string)($_SESSION['login'] ?? ''), maintenant()]);
  journal('equipe', "Espace client de {$n['client']} : dossier de {$n['agent']} " . ($visible ? 'partagé (' . count($ok) . ' document' . (count($ok) > 1 ? 's' : '') . ')' : 'retiré'));
  repondre(['ok' => true, 'visible' => (bool)$visible, 'docs' => $ok]);
}
function mod_portail_adm_depots(): void
{
  $cid = (int)($_GET['client_id'] ?? 0);
  $st = $cid ? db()->prepare('SELECT d.*, c.nom AS client FROM m_portail_depots d LEFT JOIN clients c ON c.id = d.client_id WHERE d.client_id = ? ORDER BY d.id DESC LIMIT 200')
    : db()->prepare('SELECT d.*, c.nom AS client FROM m_portail_depots d LEFT JOIN clients c ON c.id = d.client_id ORDER BY d.id DESC LIMIT 200');
  $st->execute($cid ? [$cid] : []);
  repondre(['ok' => true, 'depots' => array_map(fn ($d) => ['id' => (int)$d['id'], 'client' => (string)$d['client'], 'titre' => (string)$d['titre'], 'nom' => (string)$d['nom'],
    'taille' => (int)$d['taille'], 'cree' => (string)$d['cree'], 'vu' => (string)$d['vu']], $st->fetchAll())]);
}
function mod_portail_adm_depot(): void
{
  $st = db()->prepare('SELECT * FROM m_portail_depots WHERE id = ?');
  $st->execute([(int)($_GET['id'] ?? 0)]);
  $d = $st->fetch();
  if (!$d) echec('Document introuvable.', 404);
  if ($d['vu'] === '') db()->prepare('UPDATE m_portail_depots SET vu = ? WHERE id = ?')->execute([maintenant(), $d['id']]);
  mod_portail_servir(mod_portail_dossier('depots') . '/' . basename((string)$d['fichier']), (string)$d['mime'], (string)$d['nom'], !empty($_GET['telecharger']));
}
// Fil d'un client avec pièces jointes et demandes (complète la page Messages de l'admin)
function mod_portail_adm_fil(): void
{
  $cid = (int)($_GET['client_id'] ?? 0);
  $fil = mod_portail_fil($cid);
  db()->prepare("UPDATE messages_clients SET lu = 1 WHERE client_id = ? AND auteur = 'client' AND lu = 0")->execute([$cid]);
  repondre(['ok' => true, 'messages' => $fil, 'statuts' => MOD_PORTAIL_STATUTS]);
}
function mod_portail_adm_piece(): void
{
  $st = db()->prepare('SELECT * FROM m_portail_pieces WHERE id = ?');
  $st->execute([(int)($_GET['id'] ?? 0)]);
  $p = $st->fetch();
  if (!$p) echec('Pièce introuvable.', 404);
  mod_portail_servir(mod_portail_dossier('pieces') . '/' . basename((string)$p['fichier']), (string)$p['mime'], (string)$p['nom'], !empty($_GET['telecharger']));
}
// Réponse de la direction, avec une pièce jointe si besoin ; le client est prévenu sans le contenu
function mod_portail_adm_repondre(): void
{
  $cid = (int)($_POST['client_id'] ?? 0);
  $texte = texte($_POST['texte'] ?? '', 4000);
  $st = db()->prepare('SELECT c.nom FROM clients c JOIN comptes_clients cc ON cc.client_id = c.id WHERE c.id = ?');
  $st->execute([$cid]);
  $nom = $st->fetchColumn();
  if ($nom === false) throw new RuntimeException('Ce client n’a pas d’espace client.');
  $f = mod_portail_fichier_recu('piece');
  if ($texte === '' && !$f) throw new RuntimeException('Écrivez votre réponse.');
  if ($texte === '') $texte = 'Pièce jointe : ' . $f['nom'];
  $db = db();
  $db->prepare("INSERT INTO messages_clients (client_id, auteur, texte, cree, lu) VALUES (?, 'admin', ?, ?, 0)")->execute([$cid, $texte, maintenant()]);
  $mid = (int)$db->lastInsertId();
  if ($f) $db->prepare('INSERT INTO m_portail_pieces (message_id, client_id, fichier, nom, mime, taille, cree) VALUES (?, ?, ?, ?, ?, ?, ?)')
    ->execute([$mid, $cid, mod_portail_ranger($f, 'pieces'), $f['nom'], $f['mime'], $f['taille'], maintenant()]);
  mod_portail_alerter($cid, 'Nouveau message de BDA Security Group', 'BDA Security Group vous a écrit' . ($f ? ' (avec un document)' : ''), 'messages');
  journal('site', "Réponse envoyée à $nom (espace client)" . ($f ? ' avec une pièce jointe' : ''));
  repondre(['ok' => true]);
}
function mod_portail_adm_demande(): void
{
  $b = corps();
  $mid = (int)($b['message_id'] ?? 0);
  $statut = (string)($b['statut'] ?? '');
  if (!isset(MOD_PORTAIL_STATUTS[$statut])) throw new RuntimeException('État inconnu.');
  $st = db()->prepare('SELECT client_id, type FROM m_portail_demandes WHERE message_id = ?');
  $st->execute([$mid]);
  $d = $st->fetch();
  if (!$d) throw new RuntimeException('Demande introuvable.');
  db()->prepare('UPDATE m_portail_demandes SET statut = ?, maj = ?, par = ? WHERE message_id = ?')->execute([$statut, maintenant(), (string)($_SESSION['login'] ?? ''), $mid]);
  if ($statut !== 'recue') mod_portail_alerter((int)$d['client_id'], 'Votre demande avance', 'Votre demande « ' . (MOD_PORTAIL_DEMANDES[$d['type']] ?? 'demande') . ' » est maintenant : ' . mb_strtolower(MOD_PORTAIL_STATUTS[$statut]), 'messages');
  repondre(['ok' => true]);
}
