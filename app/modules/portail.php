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
// Centre documentaire : les rubriques, dans l'ordre d'affichage
const MOD_PORTAIL_CATEGORIES = ['factures' => 'Factures', 'devis' => 'Devis et accords', 'contrats' => 'Contrats et avenants', 'conformite' => 'Attestations et conformité',
  'rapports' => 'Rapports et relevés', 'courriers' => 'Courriers', 'equipe' => 'Équipe sur site', 'echanges' => 'Pièces échangées'];
// Ce que la direction dépose elle-même, par rubrique : [code => libellé]
const MOD_PORTAIL_TYPES_BIBLIO = [
  'factures' => ['facture' => 'Facture', 'avoir' => 'Avoir'],
  'contrats' => ['contrat' => 'Contrat de prestation', 'avenant' => 'Avenant', 'cgv' => 'Conditions générales', 'autre' => 'Document contractuel'],
  'conformite' => ['kbis' => 'Extrait Kbis', 'cnaps' => 'Autorisation d’exercice CNAPS', 'rcpro' => 'Attestation d’assurance RC professionnelle', 'urssaf' => 'Attestation de vigilance URSSAF',
    'etrangers' => 'Liste des salariés étrangers', 'fiscal' => 'Attestation de régularité fiscale', 'rib' => 'Relevé d’identité bancaire', 'statuts' => 'Statuts de la société', 'autre' => 'Attestation'],
  'rapports' => ['rapport' => 'Rapport de prestation', 'releve' => 'Relevé d’heures', 'autre' => 'Rapport'],
  'courriers' => ['courrier' => 'Courrier', 'autre' => 'Courrier'],
];
// Dossier administratif qu'un donneur d'ordre peut demander (vigilance, sécurité privée) : [libellé, rappel, jours de validité depuis la date du document (0 = date d'expiration du document)]
const MOD_PORTAIL_CONFORMITE = [
  'kbis' => ['Extrait Kbis', 'De moins de 3 mois', 90],
  'cnaps' => ['Autorisation d’exercice CNAPS', 'Délivrée par le CNAPS, sans limite de durée', 0],
  'rcpro' => ['Attestation d’assurance RC professionnelle', 'En cours de validité', 0],
  'urssaf' => ['Attestation de vigilance URSSAF', 'À renouveler tous les 6 mois', 180],
  'etrangers' => ['Liste des salariés étrangers', 'Obligation de vigilance (art. D8254-2 du Code du travail)', 180],
  'fiscal' => ['Attestation de régularité fiscale', 'Délivrée par l’administration fiscale', 0],
  'rib' => ['Relevé d’identité bancaire', 'Coordonnées de règlement', 0],
  'statuts' => ['Statuts de la société', 'Version à jour', 0],
];

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
      // Centre documentaire : documents déposés par la direction (client_id = 0 : tous les clients), lectures, rattachements, annonces
      2 => <<<'SQL'
        CREATE TABLE IF NOT EXISTS m_portail_biblio (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL DEFAULT 0, categorie TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'autre',
          titre TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', reference TEXT NOT NULL DEFAULT '', date_doc TEXT NOT NULL DEFAULT '', expire TEXT NOT NULL DEFAULT '',
          fichier TEXT NOT NULL, nom TEXT NOT NULL, mime TEXT NOT NULL, taille INTEGER NOT NULL, publie INTEGER NOT NULL DEFAULT 1, par TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL, maj TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS i_m_portail_biblio ON m_portail_biblio (client_id, publie);
        CREATE TABLE IF NOT EXISTS m_portail_lus (client_id INTEGER NOT NULL, cle TEXT NOT NULL, quand TEXT NOT NULL, PRIMARY KEY (client_id, cle));
        CREATE TABLE IF NOT EXISTS m_portail_liens (document_id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL, par TEXT NOT NULL DEFAULT '', quand TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS m_portail_annonces (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL DEFAULT 0, titre TEXT NOT NULL, texte TEXT NOT NULL DEFAULT '',
          niveau TEXT NOT NULL DEFAULT 'info', debut TEXT NOT NULL, fin TEXT NOT NULL DEFAULT '', par TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL);
        SQL,
      // Factures envoyées avant l'admin (copies des PDF retrouvés dans les e-mails) : montant et statut
      3 => <<<'SQL'
        ALTER TABLE m_portail_biblio ADD COLUMN montant REAL NOT NULL DEFAULT 0;
        ALTER TABLE m_portail_biblio ADD COLUMN statut TEXT NOT NULL DEFAULT '';
        SQL,
      // Dossiers partagés : « équipe sur site » ou « en attente d'embauche » (candidat présenté au client), avec une note (ex. date d'entretien)
      4 => <<<'SQL'
        ALTER TABLE m_portail_partages ADD COLUMN role TEXT NOT NULL DEFAULT 'equipe';
        ALTER TABLE m_portail_partages ADD COLUMN note TEXT NOT NULL DEFAULT '';
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
      'biblio' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_biblio'],
      'biblio.ajouter' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_biblio_ajouter'],
      'biblio.modifier' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_biblio_modifier'],
      'biblio.fichier' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_biblio_fichier'],
      'vue' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_vue'],
      'rattacher' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_rattacher'],
      'annonce.enregistrer' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_annonce'],
      'annonce.retirer' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_portail_adm_annonce_retirer'],
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
      'tableau' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_tableau'],
      'centre' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_centre'],
      'doc' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_doc'],
      'doc.pdf' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_doc_pdf'],
      'biblio.fichier' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_biblio_fichier'],
      'envoi.fichier' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_envoi_fichier'],
      'rapport' => ['methode' => 'GET', 'fn' => 'mod_portail_cl_rapport'],
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
  // aperçu dans l'espace lui-même (même site uniquement) : remplace le « DENY » général
  if (!$telecharger) { header('X-Frame-Options: SAMEORIGIN'); header("Content-Security-Policy: frame-ancestors 'self'"); }
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
// Partages d'un client : [agent_id => ['visible' => bool, 'docs' => [ids], 'role' => 'equipe'|'candidat', 'note' => texte]]
function mod_portail_partages(int $clientId): array
{
  $st = db()->prepare('SELECT agent_id, visible, docs, role, note FROM m_portail_partages WHERE client_id = ? ORDER BY maj, agent_id');
  $st->execute([$clientId]);
  $out = [];
  foreach ($st->fetchAll() as $p) $out[(int)$p['agent_id']] = ['visible' => (int)$p['visible'] === 1, 'docs' => array_values(array_map('intval', json_decode((string)$p['docs'], true) ?: [])),
    'role' => $p['role'] === 'candidat' ? 'candidat' : 'equipe', 'note' => (string)$p['note']];
  return $out;
}
// Un candidat présenté au client n'est pas encore actif : son dossier reste visible tant que la direction le partage
function mod_portail_filtre_actif(array $p): string
{
  return $p['role'] === 'candidat' ? '' : ' AND a.actif = 1';
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
  $prochain = mod_portail_prochain($ids);
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
  $adr = db()->prepare('SELECT nom, adresse FROM sites WHERE id IN (' . mod_portail_in($ids) . ')');
  $adr->execute();
  repondre(['ok' => true, 'sites' => $adr->fetchAll(), 'enPoste' => mod_portail_en_poste($ids), 'semaine' => mod_portail_semaine($sites),
    'heuresMois' => mod_portail_heures($ids, date('Y-m') . '-01', date('Y-m-d'))]);
}
// Les 7 prochains jours sur les sites du client : un créneau = horaires + agents prévus (ou à pourvoir)
function mod_portail_semaine(array $sites, int $jours = 7): array
{
  $ids = array_keys($sites);
  if (!$ids) return [];
  $semaine = [];
  $st = db()->prepare("SELECT v.site_id, v.jour, v.debut, v.fin, v.agent_id, a.nom FROM vacations v LEFT JOIN agents a ON a.id = v.agent_id
      WHERE v.site_id IN (" . mod_portail_in($ids) . ") AND v.statut <> 'annulee' AND v.jour BETWEEN ? AND ? ORDER BY v.jour, v.debut LIMIT 160");
  $st->execute([date('Y-m-d'), date('Y-m-d', strtotime('+' . ($jours - 1) . ' days'))]);
  foreach ($st->fetchAll() as $v) {
    $cle = $v['jour'] . '|' . $v['debut'] . '|' . $v['fin'] . '|' . $v['site_id'];
    $semaine[$cle] ??= ['jour' => $v['jour'], 'debut' => $v['debut'], 'fin' => $v['fin'], 'site' => $sites[(int)$v['site_id']] ?? '', 'agents' => [], 'aPourvoir' => 0];
    if ((int)$v['agent_id'] > 0) $semaine[$cle]['agents'][] = mod_portail_nom_court((string)$v['nom']);
    else $semaine[$cle]['aPourvoir']++;
  }
  return array_values($semaine);
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
  $candidats = [];
  foreach ($partages as $aid => $p) {
    $candidat = $p['role'] === 'candidat';
    $st = $db->prepare('SELECT id, nom, poste, carte, validite, actif FROM agents WHERE id = ?');
    $st->execute([$aid]);
    $a = $st->fetch();
    if (!$a || (!$candidat && !(int)$a['actif'])) continue;
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
    $validite = substr((string)$a['validite'], 0, 10);
    $etat = $candidat ? ($validite === '' ? 'a_verifier' : ($validite >= date('Y-m-d') ? 'valide' : 'expiree'))
      : (function_exists('mod_badge_etat') ? mod_badge_etat($a) : ($validite >= date('Y-m-d') ? 'valide' : 'a_verifier'));
    $depuis = '';
    if ($sites && !$candidat) {
      $s = $db->prepare('SELECT MIN(jour) FROM vacations WHERE agent_id = ? AND site_id IN (' . mod_portail_in($sites) . ") AND statut <> 'annulee'");
      $s->execute([$aid]);
      $depuis = (string)$s->fetchColumn();
    }
    $fiche = [
      'id' => (int)$a['id'],
      'role' => $p['role'],
      'nom' => mod_portail_nom_court((string)$a['nom']),
      'qualification' => mod_portail_qualif((string)$a['poste']),
      'gerant' => (bool)preg_match('/g[ée]rant|direct/i', (string)$a['poste']),
      'carte' => $carte !== '' ? '···· ' . mb_substr($carte, -4) : '',
      'validite' => preg_match('/^(\d{4})-(\d{2})-(\d{2})/', (string)$a['validite'], $m) ? "$m[3]/$m[2]/$m[1]" : '',
      'etat' => $etat,
      'verifier' => !$candidat && function_exists('mod_badge_jeton') && $etat !== 'inactif' ? mod_url('verifier') . '#' . mod_badge_jeton((int)$a['id']) : '',
      'enPoste' => $candidat ? '' : ($enPoste[(int)$a['id']] ?? ''),
      'depuis' => $depuis,
      'heuresMois' => $sites && !$candidat ? mod_portail_heures_agent((int)$a['id'], $sites) : 0,
      'note' => $p['note'],
      'formations' => $formations,
      'docs' => $docs,
    ];
    if ($candidat) $candidats[] = $fiche;
    else $agents[] = $fiche;
  }
  repondre(['ok' => true, 'agents' => $agents, 'candidats' => $candidats]);
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
    $d = db()->prepare('SELECT d.id, d.type, d.nom, d.ajoute, a.nom AS agent FROM agent_docs d JOIN agents a ON a.id = d.agent_id WHERE d.agent_id = ?' . mod_portail_filtre_actif($p) . ' AND d.id IN (' . mod_portail_in($p['docs']) . ')');
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
  $d = mod_portail_docs($c, " AND type = 'devis' AND id = :id", [':id' => $id])[0] ?? null;
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
  foreach ($db->query('SELECT id, nom, poste, carte, validite, actif FROM agents ORDER BY nom COLLATE NOCASE')->fetchAll() as $a) {
    $aid = (int)$a['id'];
    $d = $db->prepare("SELECT id, type, nom, ajoute FROM agent_docs WHERE agent_id = ? AND type IN ($types) ORDER BY type, ajoute DESC");
    $d->execute([$aid]);
    $agents[] = ['id' => $aid, 'nom' => (string)$a['nom'], 'court' => mod_portail_nom_court((string)$a['nom']), 'poste' => (string)$a['poste'],
      'validite' => (string)$a['validite'], 'affecte' => in_array($aid, $affectes, true), 'actif' => (int)$a['actif'] === 1,
      'visible' => $partages[$aid]['visible'] ?? false, 'partages' => $partages[$aid]['docs'] ?? [],
      'role' => $partages[$aid]['role'] ?? ((int)$a['actif'] === 1 ? 'equipe' : 'candidat'), 'note' => $partages[$aid]['note'] ?? '',
      'docs' => array_map(fn ($x) => ['id' => (int)$x['id'], 'type' => MOD_PORTAIL_TYPES_PARTAGE[$x['type']] ?? $x['type'], 'nom' => (string)$x['nom'], 'ajoute' => substr((string)$x['ajoute'], 0, 10)], $d->fetchAll())];
  }
  // les agents du site d'abord, puis ceux déjà visibles, puis les autres
  usort($agents, fn ($x, $y) => [!$x['affecte'], !$x['visible'], !$x['actif'], $x['nom']] <=> [!$y['affecte'], !$y['visible'], !$y['actif'], $y['nom']]);
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
  // le rôle et la note ne changent que s'ils sont envoyés (cocher un document ne les efface pas)
  $avant = mod_portail_partages($cid)[$aid] ?? ['role' => 'equipe', 'note' => ''];
  $role = array_key_exists('role', $b) ? (($b['role'] ?? '') === 'candidat' ? 'candidat' : 'equipe') : $avant['role'];
  $note = array_key_exists('note', $b) ? texte($b['note'], 200) : $avant['note'];
  $db->prepare('INSERT INTO m_portail_partages (client_id, agent_id, visible, docs, role, note, par, maj) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id, agent_id) DO UPDATE SET visible = excluded.visible, docs = excluded.docs, role = excluded.role, note = excluded.note, par = excluded.par, maj = excluded.maj')
    ->execute([$cid, $aid, $visible, json_encode($ok), $role, $note, (string)($_SESSION['login'] ?? ''), maintenant()]);
  journal('equipe', "Espace client de {$n['client']} : dossier de {$n['agent']} " . ($visible ? 'partagé (' . count($ok) . ' document' . (count($ok) > 1 ? 's' : '') . ($role === 'candidat' ? ', en attente d’embauche' : '') . ')' : 'retiré'));
  repondre(['ok' => true, 'visible' => (bool)$visible, 'docs' => $ok, 'role' => $role, 'note' => $note]);
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

/* =========================================================
   CENTRE DOCUMENTAIRE — tout ce qui concerne le client, au même endroit
   Sources : devis et factures (cœur), documents déposés par la direction (bibliothèque),
   relevés envoyés, rapports d'activité calculés sur le planning, dossiers d'agents partagés,
   pièces échangées. Aucun document n'est créé ni modifié : on lit ce qui existe.
   ========================================================= */
const MOD_PORTAIL_STATUTS_DOC = [
  'facture' => ['envoyee' => ['À régler', 'attente'], 'payee' => ['Réglée', 'ok'], 'annulee' => ['Annulée', 'neutre'], 'brouillon' => ['En préparation', 'neutre']],
  'devis' => ['envoye' => ['À signer', 'attente'], 'accepte' => ['Accepté', 'ok'], 'refuse' => ['Décliné', 'neutre'], 'brouillon' => ['En préparation', 'neutre']],
];

// Devis et factures visibles : au nom du client (ou rattachés par la direction), sauf les brouillons jamais envoyés
function mod_portail_docs(array $c, string $et = '', array $params = []): array
{
  $st = db()->prepare("SELECT id, type, numero, statut, client, total, date, echeance, partage, vu_client, piece, piece_nom, data FROM documents
      WHERE (lower(trim(client)) = :cle OR id IN (SELECT document_id FROM m_portail_liens WHERE client_id = :cid)) AND (partage <> '' OR statut <> 'brouillon')$et
      ORDER BY date DESC, id DESC");
  $st->execute([':cle' => mb_strtolower(trim((string)$c['nom'])), ':cid' => (int)$c['client_id']] + $params);
  return $st->fetchAll();
}
function mod_portail_statut_doc(array $d): array
{
  $type = $d['type'] === 'facture' ? 'facture' : 'devis';
  [$lib, $ton] = MOD_PORTAIL_STATUTS_DOC[$type][$d['statut']] ?? [ucfirst((string)$d['statut']), 'neutre'];
  if ($type === 'facture' && $d['statut'] === 'envoyee' && (string)$d['echeance'] !== '' && $d['echeance'] < date('Y-m-d')) { $lib = 'En retard'; $ton = 'alerte'; }
  return ['code' => (string)$d['statut'], 'libelle' => $lib, 'ton' => $ton];
}
function mod_portail_url(string $action, int $id): string
{
  return '/api/client.php?a=mod.portail.' . $action . '&id=' . $id;
}
function mod_portail_format(string $mime): string
{
  return str_starts_with($mime, 'image/') ? 'image' : 'pdf';
}
// « Octobre 2026 » à partir de « 2026-10 »
function mod_portail_mois(string $ym): string
{
  $noms = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return preg_match('/^(\d{4})-(\d{2})$/', $ym, $m) ? mb_convert_case($noms[(int)$m[2] - 1], MB_CASE_TITLE) . ' ' . $m[1] : $ym;
}
function mod_portail_item_doc(array $d): array
{
  $data = json_decode((string)$d['data'], true) ?: [];
  $fac = $d['type'] === 'facture';
  $objet = trim((string)($data['objet'] ?? ''));
  $periode = trim((string)($data['periode'] ?? ''));
  $validite = '';
  if (!$fac && preg_match('/(\d+)\s*jour/i', (string)($data['validite'] ?? ''), $m) && $d['date']) $validite = date('Y-m-d', strtotime($d['date'] . ' +' . (int)$m[1] . ' days'));
  $id = (int)$d['id'];
  return ['cle' => ($fac ? 'f:' : 'd:') . $id, 'id' => $id, 'categorie' => $fac ? 'factures' : 'devis', 'genre' => $fac ? 'Facture' : 'Devis',
    'titre' => ($fac ? 'Facture ' : 'Devis ') . $d['numero'], 'reference' => (string)$d['numero'],
    'sous' => mb_substr($fac ? ($periode !== '' ? "Période : $periode" : $objet) : ($objet !== '' ? $objet : $periode), 0, 160),
    'periode' => $periode, 'date' => (string)$d['date'], 'echeance' => $fac ? (string)$d['echeance'] : $validite, 'montant' => round((float)$d['total'], 2),
    'statut' => mod_portail_statut_doc($d), 'nouveau' => (string)$d['vu_client'] === '', 'vue' => '#/document/' . $id,
    'url' => (string)$d['piece'] !== '' ? mod_portail_url('doc.pdf', $id) : '', 'format' => 'feuille'];
}
// Date d'expiration utile : celle du document, sinon sa date + la durée de validité usuelle (Kbis 3 mois, URSSAF 6 mois…)
function mod_portail_expiration(array $b): string
{
  if ((string)$b['expire'] !== '') return (string)$b['expire'];
  $jours = $b['categorie'] === 'conformite' ? (MOD_PORTAIL_CONFORMITE[$b['type']][2] ?? 0) : 0;
  return $jours && (string)$b['date_doc'] !== '' ? date('Y-m-d', strtotime($b['date_doc'] . " +$jours days")) : '';
}
function mod_portail_item_biblio(array $b, bool $admin = false): array
{
  $id = (int)$b['id'];
  return ['cle' => 'b:' . $id, 'id' => $id, 'categorie' => (string)$b['categorie'], 'type' => (string)$b['type'],
    'genre' => MOD_PORTAIL_TYPES_BIBLIO[$b['categorie']][$b['type']] ?? 'Document', 'titre' => (string)$b['titre'], 'sous' => (string)$b['description'],
    'reference' => (string)$b['reference'], 'date' => (string)$b['date_doc'] !== '' ? (string)$b['date_doc'] : substr((string)$b['cree'], 0, 10),
    'expire' => mod_portail_expiration($b), 'nouveau' => !$admin && empty($b['lu']) && !($b['categorie'] === 'factures' && (string)$b['date_doc'] !== '' && $b['date_doc'] < date('Y-m-d', strtotime('-45 days'))),
    'commun' => (int)$b['client_id'] === 0,
    'url' => $admin ? 'api.php?a=mod.portail.biblio.fichier&id=' . $id : mod_portail_url('biblio.fichier', $id), 'format' => mod_portail_format((string)$b['mime']),
    'taille' => (int)$b['taille'], 'nom' => (string)$b['nom']]
    + ($b['categorie'] === 'factures' ? ['montant' => round((float)($b['montant'] ?? 0), 2), 'periode' => (string)$b['description'], 'echeance' => '',
      'statut' => ($b['statut'] ?? '') === 'payee' ? ['code' => 'payee', 'libelle' => 'Réglée', 'ton' => 'ok'] : ['code' => 'archive', 'libelle' => 'Archive', 'ton' => 'neutre']] : []);
}
function mod_portail_biblio_client(int $cid): array
{
  $st = db()->prepare("SELECT b.*, (SELECT quand FROM m_portail_lus l WHERE l.client_id = ? AND l.cle = 'b:' || b.id) AS lu
      FROM m_portail_biblio b WHERE b.publie = 1 AND b.client_id IN (0, ?) ORDER BY b.date_doc DESC, b.id DESC");
  $st->execute([$cid, $cid]);
  return array_map(fn ($b) => mod_portail_item_biblio($b), $st->fetchAll());
}
// Dossier administratif : pour chaque pièce attendue, le document le plus récent (ou « manquant »)
function mod_portail_conformite(array $biblio): array
{
  $out = [];
  $auj = date('Y-m-d');
  foreach (MOD_PORTAIL_CONFORMITE as $type => [$libelle, $rappel]) {
    $doc = null;
    foreach ($biblio as $b) if ($b['categorie'] === 'conformite' && $b['type'] === $type && ($doc === null || $b['date'] > $doc['date'])) $doc = $b;
    $exp = $doc['expire'] ?? '';
    $etat = !$doc ? 'manquant' : ($exp !== '' && $exp < $auj ? 'expire' : ($exp !== '' && $exp <= date('Y-m-d', strtotime('+30 days')) ? 'bientot' : 'valide'));
    $out[] = ['type' => $type, 'libelle' => $libelle, 'rappel' => $rappel, 'etat' => $etat, 'expire' => $exp, 'doc' => $doc];
  }
  return $out;
}
// Rapports d'activité : un par mois travaillé (12 derniers mois), calculés sur le planning des agents
function mod_portail_activite(array $siteIds, string $du, string $au): array
{
  if (!$siteIds) return [];
  $st = db()->prepare("SELECT v.jour, v.debut, v.fin, v.pause, v.site_id, v.agent_id, a.nom, a.poste FROM vacations v JOIN agents a ON a.id = v.agent_id
      WHERE v.site_id IN (" . mod_portail_in($siteIds) . ") AND v.agent_id > 0 AND v.statut <> 'annulee' AND v.jour BETWEEN ? AND ? ORDER BY v.jour, v.debut");
  $st->execute([$du, $au]);
  return $st->fetchAll();
}
// Plages « 08:30 - 13:45 » (plusieurs possibles) → minutes, comme le relevé de la facture
function mod_portail_minutes_plages(string $txt): int
{
  preg_match_all('/(\d{1,2})\s*[:hH]\s*(\d{2})\s*(?:-|–|à)\s*(\d{1,2})\s*[:hH]\s*(\d{2})/u', $txt, $m, PREG_SET_ORDER);
  $t = 0;
  foreach ($m as $x) { $d = ((int)$x[3] * 60 + (int)$x[4]) - ((int)$x[1] * 60 + (int)$x[2]); $t += $d > 0 ? $d : $d + 1440; }
  return $t;
}
// Relevés d'heures joints aux factures visibles par le client (page 2 de la facture) : [mois => relevé]. La facture fait foi.
function mod_portail_releves(array $docs): array
{
  $out = [];
  foreach ($docs as $d) {
    if (($d['type'] ?? '') !== 'facture' || ($d['statut'] ?? '') === 'annulee') continue;
    $L = (json_decode((string)($d['data'] ?? ''), true) ?: [])['releve']['lignes'] ?? null;
    if (!is_array($L)) continue;
    $lignes = [];
    $parMois = [];
    foreach ($L as $l) {
      if (!is_array($l) || !preg_match('#^(\d{2})/(\d{2})/(\d{4})$#', trim((string)($l['date'] ?? '')), $m)) continue;
      $min = mod_portail_minutes_plages((string)($l['matin'] ?? '')) + mod_portail_minutes_plages((string)($l['apm'] ?? ''));
      $lignes[] = ['jour' => "$m[3]-$m[2]-$m[1]", 'matin' => trim((string)($l['matin'] ?? '')), 'apm' => trim((string)($l['apm'] ?? '')), 'minutes' => $min, 'heures' => round($min / 60, 2)];
      $parMois["$m[3]-$m[2]"] = ($parMois["$m[3]-$m[2]"] ?? 0) + 1;
    }
    if (!$lignes) continue;
    arsort($parMois);
    $mois = (string)array_key_first($parMois);
    if (isset($out[$mois])) continue; // une facture par mois : la plus récente (les documents arrivent du plus récent au plus ancien)
    usort($lignes, fn ($a, $b) => strcmp($a['jour'], $b['jour']));
    $min = array_sum(array_column($lignes, 'minutes'));
    $out[$mois] = ['mois' => $mois, 'facture' => (string)$d['numero'], 'factureId' => (int)$d['id'], 'lignes' => $lignes, 'heures' => round($min / 60, 2),
      'jours' => count(array_filter($lignes, fn ($l) => $l['minutes'] > 0))];
  }
  krsort($out);
  return $out;
}
// Mois en cours : heures déjà effectuées (vacations terminées) et heures prévues sur tout le mois
function mod_portail_mois_courant(array $siteIds): array
{
  $mois = date('Y-m');
  $out = ['mois' => $mois, 'libelle' => mod_portail_mois($mois), 'fait' => 0.0, 'joursFaits' => 0, 'prevu' => 0.0, 'joursPrevus' => 0];
  $faits = [];
  $prevus = [];
  foreach (mod_portail_activite($siteIds, "$mois-01", date('Y-m-t')) as $v) {
    $h = mod_portail_duree((string)$v['debut'], (string)$v['fin'], (int)$v['pause']);
    $out['prevu'] += $h;
    $prevus[(string)$v['jour']] = true;
    // une vacation compte comme faite une fois terminée (celle de nuit finit le lendemain)
    $nuit = substr((string)$v['fin'], 0, 5) <= substr((string)$v['debut'], 0, 5);
    $finVacation = (int)strtotime($v['jour'] . ' ' . substr((string)$v['fin'], 0, 5)) + ($nuit ? 86400 : 0);
    if ($finVacation <= time()) { $out['fait'] += $h; $faits[(string)$v['jour']] = true; }
  }
  $out['fait'] = round($out['fait'], 2);
  $out['prevu'] = round($out['prevu'], 2);
  $out['joursFaits'] = count($faits);
  $out['joursPrevus'] = count($prevus);
  return $out;
}
// Heures par mois : le relevé de la facture quand il existe, sinon le planning (12 derniers mois)
function mod_portail_heures_mois(array $siteIds, array $releves): array
{
  $mois = [];
  foreach (mod_portail_activite($siteIds, date('Y-m-01', strtotime('first day of -11 months')), date('Y-m-d')) as $v) {
    $m = substr((string)$v['jour'], 0, 7);
    $mois[$m] ??= ['h' => 0.0, 'jours' => []];
    $mois[$m]['h'] += mod_portail_duree((string)$v['debut'], (string)$v['fin'], (int)$v['pause']);
    $mois[$m]['jours'][(string)$v['jour']] = true;
  }
  $out = [];
  foreach ($mois as $m => $x) $out[$m] = ['mois' => $m, 'libelle' => mod_portail_mois($m), 'heures' => round($x['h'], 2), 'jours' => count($x['jours']), 'source' => 'planning',
    'facture' => '', 'factureId' => 0, 'encours' => $m === date('Y-m')];
  foreach ($releves as $m => $r) $out[$m] = ['mois' => $m, 'libelle' => mod_portail_mois($m), 'heures' => $r['heures'], 'jours' => $r['jours'], 'source' => 'releve',
    'facture' => $r['facture'], 'factureId' => $r['factureId'], 'encours' => false];
  // le mois en cours compte seulement ce qui est fait, avec ce qui reste prévu
  $c = mod_portail_mois_courant($siteIds);
  if (!isset($releves[$c['mois']]) && ($c['prevu'] > 0 || isset($out[$c['mois']]))) $out[$c['mois']] = ['mois' => $c['mois'], 'libelle' => $c['libelle'], 'heures' => $c['fait'],
    'jours' => $c['joursFaits'], 'prevu' => $c['prevu'], 'source' => 'planning', 'facture' => '', 'factureId' => 0, 'encours' => true];
  krsort($out);
  return array_values($out);
}
function mod_portail_rapports_items(array $sites, array $releves = []): array
{
  $mois = [];
  foreach (mod_portail_activite(array_keys($sites), date('Y-m-01', strtotime('first day of -11 months')), date('Y-m-d')) as $v) {
    $m = substr((string)$v['jour'], 0, 7);
    $mois[$m] ??= ['n' => 0, 'h' => 0.0, 'agents' => []];
    $mois[$m]['n']++;
    $mois[$m]['h'] += mod_portail_duree((string)$v['debut'], (string)$v['fin'], (int)$v['pause']);
    $mois[$m]['agents'][(int)$v['agent_id']] = true;
  }
  $out = [];
  foreach ($mois as $m => $x) {
    $courant = $m === date('Y-m');
    $h = round($x['h'], 1);
    $out[] = ['cle' => 'r:' . $m, 'id' => 0, 'categorie' => 'rapports', 'genre' => 'Rapport d’activité', 'titre' => 'Rapport d’activité — ' . mod_portail_mois($m),
      'sous' => $x['n'] . ' vacation' . ($x['n'] > 1 ? 's' : '') . ' · ' . str_replace('.', ',', (string)$h) . ' h · ' . count($x['agents']) . ' agent' . (count($x['agents']) > 1 ? 's' : '') . ($courant ? ' · mois en cours' : ''),
      'reference' => $m, 'date' => $courant ? date('Y-m-d') : date('Y-m-t', strtotime("$m-01")), 'nouveau' => false, 'vue' => '#/rapport/' . $m, 'url' => '', 'format' => 'rapport', 'encours' => $courant];
  }
  // le relevé joint à la facture remplace le rapport tiré du planning pour son mois
  foreach ($releves as $m => $r) {
    $out = array_values(array_filter($out, fn ($i) => $i['reference'] !== $m));
    $out[] = ['cle' => 'r:' . $m, 'id' => 0, 'categorie' => 'rapports', 'genre' => 'Relevé d’heures', 'titre' => 'Relevé d’heures — ' . mod_portail_mois($m),
      'sous' => str_replace('.', ',', (string)round($r['heures'], 2)) . ' h · ' . $r['jours'] . ' jour' . ($r['jours'] > 1 ? 's' : '') . ' · annexe à la facture ' . $r['facture'],
      'reference' => $m, 'date' => date('Y-m-t', strtotime("$m-01")), 'nouveau' => false, 'vue' => '#/rapport/' . $m, 'url' => '', 'format' => 'rapport', 'encours' => false];
  }
  return $out;
}
function mod_portail_envois_items(int $cid): array
{
  $st = db()->prepare('SELECT id, type, titre, periode, taille, cree, vu FROM envois_clients WHERE client_id = ? ORDER BY cree DESC, id DESC');
  $st->execute([$cid]);
  return array_map(fn ($e) => ['cle' => 'e:' . $e['id'], 'id' => (int)$e['id'], 'categorie' => 'rapports', 'genre' => $e['type'] === 'planning' ? 'Relevé d’heures' : 'Document',
    'titre' => (string)$e['titre'], 'sous' => $e['periode'] ? 'Période : ' . mod_portail_mois((string)$e['periode']) : '', 'reference' => '', 'date' => substr((string)$e['cree'], 0, 10),
    'nouveau' => (string)$e['vu'] === '', 'url' => mod_portail_url('envoi.fichier', (int)$e['id']), 'format' => 'pdf', 'taille' => (int)$e['taille']], $st->fetchAll());
}
function mod_portail_equipe_items(int $cid): array
{
  $out = [];
  foreach (array_filter(mod_portail_partages($cid), fn ($p) => $p['visible'] && $p['docs']) as $aid => $p) {
    $d = db()->prepare('SELECT d.id, d.type, d.nom, d.mime, d.taille, d.ajoute, a.nom AS agent FROM agent_docs d JOIN agents a ON a.id = d.agent_id WHERE d.agent_id = ?' . mod_portail_filtre_actif($p) . ' AND d.id IN (' . mod_portail_in($p['docs']) . ')');
    $d->execute([$aid]);
    foreach ($d->fetchAll() as $x) if (isset(MOD_PORTAIL_TYPES_PARTAGE[$x['type']])) $out[] = ['cle' => 'a:' . $x['id'], 'id' => (int)$x['id'], 'categorie' => 'equipe',
      'genre' => MOD_PORTAIL_TYPES_PARTAGE[$x['type']], 'titre' => MOD_PORTAIL_TYPES_PARTAGE[$x['type']] . ' · ' . mod_portail_nom_court((string)$x['agent']),
      'sous' => ($p['role'] === 'candidat' ? 'Candidat en attente d’embauche · ' : 'Dossier de ') . mod_portail_nom_court((string)$x['agent']),
      'reference' => '', 'date' => substr((string)$x['ajoute'], 0, 10), 'nouveau' => false, 'url' => mod_portail_url('agent.doc', (int)$x['id']), 'format' => mod_portail_format((string)$x['mime']), 'taille' => (int)$x['taille']];
  }
  return $out;
}
function mod_portail_echanges_items(int $cid): array
{
  $db = db();
  $out = [];
  $st = $db->prepare('SELECT id, titre, nom, mime, taille, cree, vu FROM m_portail_depots WHERE client_id = ? ORDER BY id DESC LIMIT 200');
  $st->execute([$cid]);
  foreach ($st->fetchAll() as $x) $out[] = ['cle' => 'p:' . $x['id'], 'id' => (int)$x['id'], 'categorie' => 'echanges', 'genre' => 'Transmis par vous', 'titre' => (string)$x['titre'],
    'sous' => (string)$x['nom'], 'reference' => '', 'date' => substr((string)$x['cree'], 0, 10), 'nouveau' => false,
    'statut' => $x['vu'] ? ['code' => 'recu', 'libelle' => 'Consulté par BDA', 'ton' => 'ok'] : ['code' => 'transmis', 'libelle' => 'Transmis', 'ton' => 'neutre'],
    'url' => mod_portail_url('depot.fichier', (int)$x['id']), 'format' => mod_portail_format((string)$x['mime']), 'taille' => (int)$x['taille']];
  $st = $db->prepare('SELECT p.id, p.nom, p.mime, p.taille, p.cree, m.auteur FROM m_portail_pieces p JOIN messages_clients m ON m.id = p.message_id WHERE p.client_id = ? ORDER BY p.id DESC LIMIT 200');
  $st->execute([$cid]);
  foreach ($st->fetchAll() as $x) $out[] = ['cle' => 'm:' . $x['id'], 'id' => (int)$x['id'], 'categorie' => 'echanges', 'genre' => $x['auteur'] === 'admin' ? 'Reçu dans la messagerie' : 'Envoyé dans la messagerie',
    'titre' => (string)$x['nom'], 'sous' => $x['auteur'] === 'admin' ? 'Joint par BDA Security Group' : 'Joint par vous', 'reference' => '', 'date' => substr((string)$x['cree'], 0, 10), 'nouveau' => false,
    'url' => mod_portail_url('piece', (int)$x['id']), 'format' => mod_portail_format((string)$x['mime']), 'taille' => (int)$x['taille']];
  return $out;
}
function mod_portail_centre(array $c): array
{
  $cid = (int)$c['client_id'];
  $brut = mod_portail_docs($c);
  $docs = array_map('mod_portail_item_doc', $brut);
  // un devis signé en ligne garde la trace du « bon pour accord »
  $st = db()->prepare('SELECT document_id, nom, fonction, quand FROM m_portail_accords WHERE client_id = ? ORDER BY id');
  $st->execute([$cid]);
  $accords = [];
  foreach ($st->fetchAll() as $a) $accords[(int)$a['document_id']] = ['nom' => (string)$a['nom'], 'fonction' => (string)$a['fonction'], 'quand' => (string)$a['quand']];
  foreach ($docs as &$d) if ($d['categorie'] === 'devis' && isset($accords[$d['id']])) $d['accord'] = $accords[$d['id']];
  unset($d);
  $biblio = mod_portail_biblio_client($cid);
  $items = array_merge($docs, $biblio, mod_portail_envois_items($cid), mod_portail_rapports_items(mod_portail_sites($cid), mod_portail_releves($brut)), mod_portail_equipe_items($cid), mod_portail_echanges_items($cid));
  usort($items, fn ($a, $b) => [$b['date'], $b['cle']] <=> [$a['date'], $a['cle']]);
  return ['items' => $items, 'conformite' => mod_portail_conformite($biblio), 'categories' => MOD_PORTAIL_CATEGORIES];
}
function mod_portail_cl_centre(): void
{
  repondre(['ok' => true] + mod_portail_centre(mod_portail_compte()));
}
function mod_portail_prochain(array $siteIds): ?array
{
  if (!$siteIds) return null;
  $st = db()->prepare("SELECT v.jour, v.debut, v.fin, v.agent_id, a.nom, a.poste FROM vacations v LEFT JOIN agents a ON a.id = v.agent_id
      WHERE v.site_id IN (" . mod_portail_in($siteIds) . ") AND v.statut <> 'annulee' AND (v.jour > ? OR (v.jour = ? AND v.debut > ?)) ORDER BY v.jour, v.debut LIMIT 1");
  $st->execute([date('Y-m-d'), date('Y-m-d'), date('H:i')]);
  $v = $st->fetch();
  return $v ? ['jour' => $v['jour'], 'debut' => $v['debut'], 'fin' => $v['fin'], 'agent' => (int)$v['agent_id'] > 0 ? mod_portail_nom_court((string)$v['nom']) : '',
    'qualification' => (int)$v['agent_id'] > 0 ? mod_portail_qualif((string)$v['poste']) : ''] : null;
}
function mod_portail_annonces(int $cid): array
{
  $st = db()->prepare("SELECT id, client_id, titre, texte, niveau, debut, fin FROM m_portail_annonces WHERE client_id IN (0, ?) AND debut <= ? AND (fin = '' OR fin >= ?) ORDER BY niveau = 'important' DESC, debut DESC");
  $st->execute([$cid, date('Y-m-d'), date('Y-m-d')]);
  return array_map(fn ($a) => ['id' => (int)$a['id'], 'titre' => (string)$a['titre'], 'texte' => (string)$a['texte'], 'niveau' => (string)$a['niveau'], 'debut' => (string)$a['debut'], 'fin' => (string)$a['fin']], $st->fetchAll());
}
// Tableau de bord : prestations, factures, échéances, demandes, informations et documents récents
function mod_portail_cl_tableau(): void
{
  $c = mod_portail_compte();
  $cid = (int)$c['client_id'];
  $db = db();
  $centre = mod_portail_centre($c);
  $items = $centre['items'];
  $auj = date('Y-m-d');
  $factures = array_values(array_filter($items, fn ($i) => $i['categorie'] === 'factures'));
  $aRegler = array_values(array_filter($factures, fn ($i) => $i['statut']['code'] === 'envoyee'));
  $annee = date('Y');
  $echeances = [];
  foreach ($aRegler as $f) $echeances[] = ['date' => $f['echeance'] ?: $f['date'], 'titre' => $f['titre'], 'detail' => 'Règlement attendu', 'montant' => $f['montant'], 'ton' => $f['statut']['ton'], 'vue' => $f['vue']];
  foreach ($items as $i) if ($i['categorie'] === 'devis' && $i['statut']['code'] === 'envoye') $echeances[] = ['date' => $i['echeance'] ?: $i['date'], 'titre' => $i['titre'], 'detail' => 'En attente de votre signature', 'montant' => $i['montant'], 'ton' => 'attente', 'vue' => $i['vue']];
  foreach ($centre['conformite'] as $k) if ($k['doc'] && $k['expire'] !== '' && $k['expire'] <= date('Y-m-d', strtotime('+60 days'))) $echeances[] = ['date' => $k['expire'], 'titre' => $k['libelle'],
    'detail' => $k['expire'] < $auj ? 'Expiré : une version à jour est en cours' : 'Renouvellement prévu', 'montant' => null, 'ton' => $k['expire'] < $auj ? 'alerte' : 'neutre', 'vue' => '#/documents/conformite'];
  usort($echeances, fn ($a, $b) => strcmp($a['date'], $b['date']));
  $sites = mod_portail_sites($cid);
  $ids = array_keys($sites);
  $precedent = date('Y-m', strtotime('first day of last month'));
  $releves = mod_portail_releves(mod_portail_docs($c));
  $parMois = mod_portail_heures_mois($ids, $releves);
  $heuresDe = function (string $m) use ($parMois): ?array { foreach ($parMois as $x) if ($x['mois'] === $m) return $x; return null; };
  $st = $db->prepare("SELECT d.message_id, d.type, d.statut, d.maj, m.cree FROM m_portail_demandes d JOIN messages_clients m ON m.id = d.message_id WHERE d.client_id = ? AND d.statut <> 'faite' ORDER BY d.message_id DESC LIMIT 20");
  $st->execute([$cid]);
  $demandes = array_map(fn ($d) => ['libelle' => MOD_PORTAIL_DEMANDES[$d['type']] ?? 'Demande', 'statut' => (string)$d['statut'], 'etat' => MOD_PORTAIL_STATUTS[$d['statut']] ?? '', 'cree' => (string)$d['cree'], 'maj' => (string)$d['maj']], $st->fetchAll());
  $nl = $db->prepare("SELECT COUNT(*) FROM messages_clients WHERE client_id = ? AND auteur = 'admin' AND lu = 0");
  $nl->execute([$cid]);
  $conf = $centre['conformite'];
  repondre(['ok' => true,
    'prestations' => ['sites' => array_values($sites), 'enPoste' => mod_portail_en_poste($ids), 'prochain' => mod_portail_prochain($ids), 'semaine' => mod_portail_semaine($sites),
      'heuresMois' => $heuresDe(date('Y-m'))['heures'] ?? 0, 'heuresPrecedent' => $heuresDe($precedent)['heures'] ?? 0, 'moisPrecedent' => $precedent,
      'mois' => $parMois, 'courant' => mod_portail_mois_courant($ids),
      // le dernier mois terminé (le plus parlant pour le client), sinon le mois en cours
      'dernier' => array_values(array_filter($parMois, fn ($m) => !$m['encours']))[0] ?? ($parMois[0] ?? null)],
    'factures' => ['nombre' => count($factures), 'aRegler' => count($aRegler), 'montantDu' => round(array_sum(array_column($aRegler, 'montant')), 2),
      'enRetard' => count(array_filter($aRegler, fn ($i) => $i['statut']['ton'] === 'alerte')),
      'totalAnnee' => round(array_sum(array_map(fn ($i) => str_starts_with($i['date'], $annee) && $i['statut']['code'] !== 'annulee' ? $i['montant'] : 0, $factures)), 2), 'annee' => $annee],
    'recents' => array_slice(array_values(array_filter($items, fn ($i) => $i['categorie'] !== 'echanges' && !str_starts_with($i['cle'], 'r:'))), 0, 6),
    'nouveaux' => count(array_filter($items, fn ($i) => $i['nouveau'])),
    'echeances' => array_slice($echeances, 0, 8), 'demandes' => $demandes, 'annonces' => mod_portail_annonces($cid), 'messagesNonLus' => (int)$nl->fetchColumn(),
    'conformite' => ['disponibles' => count(array_filter($conf, fn ($k) => in_array($k['etat'], ['valide', 'bientot'], true))), 'total' => count($conf),
      'pieces' => array_map(fn ($k) => ['libelle' => $k['libelle'], 'etat' => $k['etat'], 'expire' => $k['expire']], $conf)],
    'documents' => count($items)]);
}
// Devis ou facture en lecture (même règle de visibilité que le centre) ; la première ouverture est notée
function mod_portail_cl_doc(): void
{
  $c = mod_portail_compte();
  $d = mod_portail_docs($c, ' AND id = :id', [':id' => (int)($_GET['id'] ?? 0)])[0] ?? null;
  if (!$d) echec('Document introuvable.', 404);
  $fac = $d['type'] === 'facture';
  if ((string)$d['vu_client'] === '') {
    db()->prepare('UPDATE documents SET vu_client = ? WHERE id = ?')->execute([maintenant(), $d['id']]);
    journal('document', ($fac ? 'Facture ' : 'Devis ') . "{$d['numero']} ouvert par {$c['nom']} dans son espace client");
    notifier('espace_client', ($fac ? 'Facture ' : 'Devis ') . $d['numero'] . ' consulté' . ($fac ? 'e' : ''), 'Ouvert par le client dans son espace.', '/admin/#/' . ($fac ? 'factures' : 'devis') . '/' . (int)$d['id'], 'doc-vu-' . (int)$d['id']);
  }
  $st = db()->prepare('SELECT nom, fonction, quand FROM m_portail_accords WHERE document_id = ? AND client_id = ? ORDER BY id DESC LIMIT 1');
  $st->execute([(int)$d['id'], (int)$c['client_id']]);
  repondre(['ok' => true, 'item' => mod_portail_item_doc($d), 'accord' => $st->fetch() ?: null, 'document' => ['id' => (int)$d['id'], 'type' => (string)$d['type'], 'numero' => (string)$d['numero'],
    'statut' => (string)$d['statut'], 'total' => (float)$d['total'], 'date' => (string)$d['date'], 'echeance' => (string)$d['echeance'], 'piece_nom' => (string)$d['piece_nom'],
    'data' => json_decode((string)$d['data'], true) ?: []]]);
}
function mod_portail_cl_doc_pdf(): void
{
  $c = mod_portail_compte();
  $d = mod_portail_docs($c, " AND id = :id AND piece <> ''", [':id' => (int)($_GET['id'] ?? 0)])[0] ?? null;
  if (!$d) echec('PDF introuvable.', 404);
  if (!empty($_GET['telecharger'])) journal('document', "PDF de {$d['numero']} téléchargé par {$c['nom']} dans son espace client");
  mod_portail_servir(dossier_pieces() . '/' . basename((string)$d['piece']), 'application/pdf', (string)$d['piece_nom'] ?: $d['numero'] . '.pdf', !empty($_GET['telecharger']));
}
function mod_portail_cl_biblio_fichier(): void
{
  $c = mod_portail_compte();
  $cid = (int)$c['client_id'];
  $st = db()->prepare('SELECT * FROM m_portail_biblio WHERE id = ? AND publie = 1 AND client_id IN (0, ?)');
  $st->execute([(int)($_GET['id'] ?? 0), $cid]);
  $b = $st->fetch();
  if (!$b) echec('Document introuvable.', 404);
  $ins = db()->prepare('INSERT OR IGNORE INTO m_portail_lus (client_id, cle, quand) VALUES (?, ?, ?)');
  $ins->execute([$cid, 'b:' . $b['id'], maintenant()]);
  if ($ins->rowCount()) journal('document', "Espace client : {$c['nom']} a consulté « {$b['titre']} » (centre documentaire)");
  mod_portail_servir(mod_portail_dossier('biblio') . '/' . basename((string)$b['fichier']), (string)$b['mime'], (string)$b['nom'], !empty($_GET['telecharger']));
}
function mod_portail_cl_envoi_fichier(): void
{
  $c = mod_portail_compte();
  $st = db()->prepare('SELECT id, titre, fichier, nom, vu FROM envois_clients WHERE id = ? AND client_id = ?');
  $st->execute([(int)($_GET['id'] ?? 0), (int)$c['client_id']]);
  $e = $st->fetch();
  if (!$e) echec('Document introuvable.', 404);
  if ((string)$e['vu'] === '') {
    db()->prepare('UPDATE envois_clients SET vu = ? WHERE id = ?')->execute([maintenant(), $e['id']]);
    journal('document', "« {$e['titre']} » consulté par {$c['nom']} dans son espace client");
    notifier('espace_client', 'PDF consulté', 'Un client a ouvert un document de son espace.', '/admin/#/pdf');
  }
  mod_portail_servir(dossier_pieces() . '/' . basename((string)$e['fichier']), 'application/pdf', (string)$e['nom'], !empty($_GET['telecharger']));
}
// Rapport d'activité d'un mois, d'après le planning (le client voit le prénom et l'initiale des agents)
function mod_portail_cl_rapport(): void
{
  $c = mod_portail_compte();
  $mois = (string)($_GET['mois'] ?? '');
  if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $mois) || $mois > date('Y-m')) throw new RuntimeException('Mois invalide.');
  $sites = mod_portail_sites((int)$c['client_id']);
  $fin = min(date('Y-m-t', strtotime("$mois-01")), date('Y-m-d'));
  $r = mod_portail_releves(mod_portail_docs($c))[$mois] ?? null;
  if ($r) {
    repondre(['ok' => true, 'source' => 'releve', 'mois' => $mois, 'libelle' => mod_portail_mois($mois), 'du' => $r['lignes'][0]['jour'], 'au' => end($r['lignes'])['jour'], 'encours' => false,
      'sites' => array_values($sites), 'facture' => $r['facture'], 'factureId' => $r['factureId'],
      'lignes' => array_map(fn ($l) => ['jour' => $l['jour'], 'matin' => $l['matin'], 'apm' => $l['apm'], 'heures' => $l['heures']], $r['lignes']),
      'total' => ['heures' => $r['heures'], 'jours' => $r['jours']]]);
  }
  $lignes = [];
  $agents = [];
  foreach (mod_portail_activite(array_keys($sites), "$mois-01", $fin) as $v) {
    $h = round(mod_portail_duree((string)$v['debut'], (string)$v['fin'], (int)$v['pause']), 2);
    $nom = mod_portail_nom_court((string)$v['nom']);
    $lignes[] = ['jour' => (string)$v['jour'], 'debut' => substr((string)$v['debut'], 0, 5), 'fin' => substr((string)$v['fin'], 0, 5), 'heures' => $h, 'agent' => $nom,
      'qualification' => mod_portail_qualif((string)$v['poste']), 'site' => $sites[(int)$v['site_id']] ?? ''];
    $agents[(int)$v['agent_id']] ??= ['agent' => $nom, 'qualification' => mod_portail_qualif((string)$v['poste']), 'vacations' => 0, 'heures' => 0.0];
    $agents[(int)$v['agent_id']]['vacations']++;
    $agents[(int)$v['agent_id']]['heures'] += $h;
  }
  repondre(['ok' => true, 'source' => 'planning', 'mois' => $mois, 'libelle' => mod_portail_mois($mois), 'du' => "$mois-01", 'au' => $fin, 'encours' => $mois === date('Y-m'), 'sites' => array_values($sites),
    'lignes' => $lignes, 'agents' => array_values($agents), 'total' => ['vacations' => count($lignes), 'heures' => round(array_sum(array_column($lignes, 'heures')), 2),
      'jours' => count(array_unique(array_column($lignes, 'jour'))), 'agents' => count($agents)]]);
}

/* ----- Centre documentaire : côté direction ----- */
function mod_portail_norm(string $s): string
{
  $s = strtr(mb_strtolower(trim($s)), ['é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'à' => 'a', 'â' => 'a', 'ä' => 'a', 'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ö' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ç' => 'c', '’' => ' ', "'" => ' ']);
  $mots = preg_split('/\s+/', (string)preg_replace('/[^a-z0-9 ]+/', ' ', $s)) ?: [];
  $vides = ['le', 'la', 'les', 'de', 'du', 'des', 'd', 'l', 'et', 'en', 'general', 'generale', 'sa', 'sas', 'sarl', 'eurl', 'the', 'of'];
  return implode(' ', array_filter($mots, fn ($m) => $m !== '' && !in_array($m, $vides, true)));
}
function mod_portail_nom_client(int $cid): string
{
  $st = db()->prepare('SELECT nom FROM clients WHERE id = ?');
  $st->execute([$cid]);
  $nom = $st->fetchColumn();
  if ($nom === false) throw new RuntimeException('Client introuvable.');
  return (string)$nom;
}
function mod_portail_date(mixed $v): string
{
  $v = trim((string)$v);
  return preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) ? $v : '';
}
function mod_portail_adm_biblio(): void
{
  $cid = (int)($_GET['client_id'] ?? 0);
  if ($cid) mod_portail_nom_client($cid);
  $st = db()->prepare("SELECT b.*, (SELECT COUNT(*) FROM m_portail_lus l WHERE l.cle = 'b:' || b.id) AS lectures FROM m_portail_biblio b WHERE b.client_id = ? ORDER BY b.publie DESC, b.date_doc DESC, b.id DESC");
  $st->execute([$cid]);
  $docs = array_map(fn ($b) => mod_portail_item_biblio($b, true) + ['publie' => (int)$b['publie'] === 1, 'lectures' => (int)$b['lectures'], 'description' => (string)$b['description'],
    'date_doc' => (string)$b['date_doc'], 'expire_saisie' => (string)$b['expire'], 'cree' => (string)$b['cree']], $st->fetchAll());
  $annonces = db()->prepare('SELECT * FROM m_portail_annonces WHERE client_id = ? ORDER BY id DESC LIMIT 50');
  $annonces->execute([$cid]);
  repondre(['ok' => true, 'docs' => $docs, 'conformite' => mod_portail_conformite(array_values(array_filter($docs, fn ($d) => $d['publie']))),
    'types' => MOD_PORTAIL_TYPES_BIBLIO, 'categories' => MOD_PORTAIL_CATEGORIES, 'annonces' => $annonces->fetchAll()]);
}
function mod_portail_adm_biblio_ajouter(): void
{
  $cid = (int)($_POST['client_id'] ?? 0);
  $client = $cid ? mod_portail_nom_client($cid) : 'tous les clients';
  $cat = (string)($_POST['categorie'] ?? '');
  if (!isset(MOD_PORTAIL_TYPES_BIBLIO[$cat])) throw new RuntimeException('Choisissez une rubrique.');
  $type = (string)($_POST['type'] ?? 'autre');
  if (!isset(MOD_PORTAIL_TYPES_BIBLIO[$cat][$type])) $type = 'autre';
  $f = mod_portail_fichier_recu('fichier');
  if (!$f) throw new RuntimeException('Choisissez le fichier à déposer (PDF ou image).');
  $titre = texte($_POST['titre'] ?? '', 160) ?: MOD_PORTAIL_TYPES_BIBLIO[$cat][$type];
  $nom = mod_portail_ranger($f, 'biblio');
  $quand = maintenant();
  $db = db();
  $montant = $cat === 'factures' ? round((float)str_replace([' ', "\u{a0}", "\u{202f}", '€', ','], ['', '', '', '', '.'], (string)($_POST['montant'] ?? '0')), 2) : 0;
  $statut = $cat === 'factures' && ($_POST['statut'] ?? '') === 'payee' ? 'payee' : '';
  $db->prepare('INSERT INTO m_portail_biblio (client_id, categorie, type, titre, description, reference, date_doc, expire, fichier, nom, mime, taille, publie, par, cree, maj, montant, statut) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)')
    ->execute([$cid, $cat, $type, $titre, texte($_POST['description'] ?? '', 400), texte($_POST['reference'] ?? '', 80), mod_portail_date($_POST['date_doc'] ?? '') ?: substr($quand, 0, 10),
      mod_portail_date($_POST['expire'] ?? ''), $nom, $f['nom'], $f['mime'], $f['taille'], (string)($_SESSION['login'] ?? ''), $quand, $quand, $montant, $statut]);
  $id = (int)$db->lastInsertId();
  journal('document', "Centre documentaire : « $titre » mis à disposition de $client");
  if ($cid) mod_portail_alerter($cid, 'Nouveau document disponible', 'Un nouveau document est disponible', 'documents');
  repondre(['ok' => true, 'id' => $id]);
}
function mod_portail_adm_biblio_modifier(): void
{
  $b = corps();
  $st = db()->prepare('SELECT * FROM m_portail_biblio WHERE id = ?');
  $st->execute([(int)($b['id'] ?? 0)]);
  $x = $st->fetch();
  if (!$x) throw new RuntimeException('Document introuvable.');
  $cat = isset(MOD_PORTAIL_TYPES_BIBLIO[$b['categorie'] ?? '']) ? (string)$b['categorie'] : (string)$x['categorie'];
  $type = isset(MOD_PORTAIL_TYPES_BIBLIO[$cat][$b['type'] ?? '']) ? (string)$b['type'] : (isset(MOD_PORTAIL_TYPES_BIBLIO[$cat][$x['type']]) ? (string)$x['type'] : 'autre');
  $publie = array_key_exists('publie', $b) ? (!empty($b['publie']) ? 1 : 0) : (int)$x['publie'];
  $montant = array_key_exists('montant', $b) ? round((float)str_replace([' ', "\u{a0}", "\u{202f}", '€', ','], ['', '', '', '', '.'], (string)$b['montant']), 2) : (float)$x['montant'];
  $statut = array_key_exists('statut', $b) ? (($b['statut'] ?? '') === 'payee' ? 'payee' : '') : (string)$x['statut'];
  db()->prepare('UPDATE m_portail_biblio SET categorie = ?, type = ?, titre = ?, description = ?, reference = ?, date_doc = ?, expire = ?, publie = ?, montant = ?, statut = ?, maj = ? WHERE id = ?')
    ->execute([$cat, $type, texte($b['titre'] ?? $x['titre'], 160) ?: (string)$x['titre'], texte($b['description'] ?? $x['description'], 400), texte($b['reference'] ?? $x['reference'], 80),
      array_key_exists('date_doc', $b) ? mod_portail_date($b['date_doc']) : (string)$x['date_doc'], array_key_exists('expire', $b) ? mod_portail_date($b['expire']) : (string)$x['expire'], $publie,
      $cat === 'factures' ? $montant : 0, $cat === 'factures' ? $statut : '', maintenant(), $x['id']]);
  if ($publie !== (int)$x['publie']) journal('document', "Centre documentaire : « {$x['titre']} » " . ($publie ? 'remis en ligne' : 'retiré de l’espace client'));
  repondre(['ok' => true]);
}
function mod_portail_adm_biblio_fichier(): void
{
  $st = db()->prepare('SELECT * FROM m_portail_biblio WHERE id = ?');
  $st->execute([(int)($_GET['id'] ?? 0)]);
  $b = $st->fetch();
  if (!$b) echec('Document introuvable.', 404);
  mod_portail_servir(mod_portail_dossier('biblio') . '/' . basename((string)$b['fichier']), (string)$b['mime'], (string)$b['nom'], !empty($_GET['telecharger']));
}
// Ce que voit un client : ses devis et factures (avec ceux rattachés à la main) et les pièces au nom proche, à rattacher
function mod_portail_adm_vue(): void
{
  $cid = (int)($_GET['client_id'] ?? 0);
  $nom = mod_portail_nom_client($cid);
  $db = db();
  $liens = [];
  foreach ($db->query('SELECT document_id, client_id FROM m_portail_liens')->fetchAll() as $l) $liens[(int)$l['document_id']] = (int)$l['client_id'];
  $visibles = array_map(fn ($d) => mod_portail_item_doc($d) + ['rattache' => ($liens[(int)$d['id']] ?? 0) === $cid, 'partage' => (string)$d['partage'] !== '', 'client' => (string)$d['client']],
    mod_portail_docs(['nom' => $nom, 'client_id' => $cid]));
  $cle = mb_strtolower(trim($nom));
  $norm = mod_portail_norm($nom);
  $mots = array_filter(explode(' ', $norm));
  $suggestions = [];
  foreach ($db->query("SELECT id, type, numero, statut, client, total, date FROM documents WHERE partage <> '' OR statut <> 'brouillon' ORDER BY date DESC, id DESC")->fetchAll() as $d) {
    if (mb_strtolower(trim((string)$d['client'])) === $cle || isset($liens[(int)$d['id']]) || trim((string)$d['client']) === '') continue;
    $autre = array_filter(explode(' ', mod_portail_norm((string)$d['client'])));
    $proche = mod_portail_norm((string)$d['client']) === $norm
      || (count($mots) >= 2 && !array_diff($mots, $autre)) || (count($autre) >= 2 && !array_diff($autre, $mots));
    if ($proche) $suggestions[] = ['id' => (int)$d['id'], 'type' => (string)$d['type'], 'numero' => (string)$d['numero'], 'statut' => (string)$d['statut'], 'client' => (string)$d['client'],
      'total' => round((float)$d['total'], 2), 'date' => (string)$d['date']];
  }
  $an = $db->prepare('SELECT * FROM m_portail_annonces WHERE client_id = ? ORDER BY id DESC LIMIT 50');
  $an->execute([$cid]);
  $centre = mod_portail_centre(['nom' => $nom, 'client_id' => $cid]);
  $parCategorie = [];
  foreach ($centre['items'] as $i) $parCategorie[$i['categorie']] = ($parCategorie[$i['categorie']] ?? 0) + 1;
  repondre(['ok' => true, 'client' => ['id' => $cid, 'nom' => $nom], 'documents' => $visibles, 'suggestions' => $suggestions, 'annonces' => $an->fetchAll(),
    'parCategorie' => $parCategorie, 'categories' => MOD_PORTAIL_CATEGORIES, 'conformite' => array_map(fn ($k) => ['libelle' => $k['libelle'], 'etat' => $k['etat'], 'expire' => $k['expire']], $centre['conformite'])]);
}
function mod_portail_adm_rattacher(): void
{
  $b = corps();
  $doc = (int)($b['document_id'] ?? 0);
  $cid = (int)($b['client_id'] ?? 0);
  $nom = mod_portail_nom_client($cid);
  $st = db()->prepare('SELECT type, numero FROM documents WHERE id = ?');
  $st->execute([$doc]);
  $d = $st->fetch();
  if (!$d) throw new RuntimeException('Document introuvable.');
  if (!empty($b['lier'])) db()->prepare('INSERT INTO m_portail_liens (document_id, client_id, par, quand) VALUES (?, ?, ?, ?) ON CONFLICT(document_id) DO UPDATE SET client_id = excluded.client_id, par = excluded.par, quand = excluded.quand')
    ->execute([$doc, $cid, (string)($_SESSION['login'] ?? ''), maintenant()]);
  else db()->prepare('DELETE FROM m_portail_liens WHERE document_id = ? AND client_id = ?')->execute([$doc, $cid]);
  journal('document', ($d['type'] === 'facture' ? 'Facture ' : 'Devis ') . "{$d['numero']} " . (!empty($b['lier']) ? 'rattaché(e) à' : 'détaché(e) de') . " l’espace client de $nom");
  repondre(['ok' => true]);
}
function mod_portail_adm_annonce(): void
{
  $b = corps();
  $cid = (int)($b['client_id'] ?? 0);
  if ($cid) mod_portail_nom_client($cid);
  $titre = texte($b['titre'] ?? '', 140);
  if (mb_strlen($titre) < 3) throw new RuntimeException('Donnez un titre à l’information.');
  $niveau = ($b['niveau'] ?? '') === 'important' ? 'important' : 'info';
  $debut = mod_portail_date($b['debut'] ?? '') ?: date('Y-m-d');
  $fin = mod_portail_date($b['fin'] ?? '');
  $id = (int)($b['id'] ?? 0);
  if ($id) db()->prepare('UPDATE m_portail_annonces SET titre = ?, texte = ?, niveau = ?, debut = ?, fin = ? WHERE id = ?')->execute([$titre, texte($b['texte'] ?? '', 1200), $niveau, $debut, $fin, $id]);
  else db()->prepare('INSERT INTO m_portail_annonces (client_id, titre, texte, niveau, debut, fin, par, cree) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([$cid, $titre, texte($b['texte'] ?? '', 1200), $niveau, $debut, $fin, (string)($_SESSION['login'] ?? ''), maintenant()]);
  journal('site', "Espace client : information « $titre » " . ($id ? 'modifiée' : 'publiée'));
  repondre(['ok' => true]);
}
function mod_portail_adm_annonce_retirer(): void
{
  $id = (int)(corps()['id'] ?? 0);
  db()->prepare('UPDATE m_portail_annonces SET fin = ? WHERE id = ?')->execute([date('Y-m-d', strtotime('-1 day')), $id]);
  repondre(['ok' => true]);
}
