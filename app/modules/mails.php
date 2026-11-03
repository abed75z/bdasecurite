<?php
/* =========================================================
   MODULE « MAILS » (version 12) — la messagerie de l'admin
   - Envoi des factures et devis par mail (PDF joint + lien « Voir en ligne »
     qui signale l'ouverture), relances préparées des factures en retard
     (jamais envoyées toutes seules), modèles de mails modifiables.
   - « Contacter » : écrire à un agent, un client, ou un groupe (tous les
     agents, les agents d'un site, tous les clients) — un mail par personne.
   - Boîte de réception de contact@bdasecurite.com (Gmail relié) : lire,
     répondre dans le fil, classer.
   Tout part du compte Google relié (app/google.php) ; en test, rien ne part.
   ========================================================= */
declare(strict_types=1);

const MOD_MAILS_SIGNATURE = "L'équipe BDA Security Group\n07 84 73 90 70 · contact@bdasecurite.com\nbdasecurite.com";
const MOD_MAILS_MODELES = [
  'facture' => ['Facture', 'Facture {numero} — BDA Security Group', "Bonjour,\n\nVeuillez trouver ci-joint la facture {numero} d'un montant de {montant}, à régler avant le {echeance}.\n\nVous pouvez aussi la consulter en ligne :\n{lien}\n\nNous restons à votre disposition pour toute question.\n\nBien cordialement,\n{signature}"],
  'devis' => ['Devis', 'Devis {numero} — BDA Security Group', "Bonjour,\n\nComme convenu, veuillez trouver ci-joint notre devis {numero} d'un montant de {montant}.\n\nVous pouvez aussi le consulter en ligne :\n{lien}\n\nNous restons à votre disposition pour toute précision.\n\nBien cordialement,\n{signature}"],
  'relance1' => ['Relance 1 · courtoise', 'Rappel — facture {numero}', "Bonjour,\n\nSauf erreur de notre part, la facture {numero} de {montant}, arrivée à échéance le {echeance}, n'a pas encore été réglée.\n\nVous la trouverez ci-jointe et en ligne :\n{lien}\n\nSi le règlement est déjà parti, merci de ne pas tenir compte de ce message.\n\nBien cordialement,\n{signature}"],
  'relance2' => ['Relance 2 · ferme', 'Deuxième rappel — facture {numero}', "Bonjour,\n\nMalgré notre premier rappel, la facture {numero} de {montant}, échue depuis le {echeance}, reste impayée à ce jour.\n\nNous vous remercions de procéder à son règlement dans les meilleurs délais, ou de nous indiquer la date prévue.\n\nLa facture en ligne :\n{lien}\n\nBien cordialement,\n{signature}"],
  'relance3' => ['Relance 3 · dernier rappel', 'Dernier rappel avant mise en demeure — facture {numero}', "Bonjour,\n\nLa facture {numero} de {montant}, échue depuis le {echeance}, demeure impayée malgré nos précédents rappels.\n\nSans règlement sous huit jours, nous serons contraints d'engager une procédure de recouvrement. Conformément à nos conditions, tout retard de paiement entraîne des pénalités ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement.\n\nLa facture en ligne :\n{lien}\n\nBien cordialement,\n{signature}"],
  'libre' => ['Message libre', '', "Bonjour {prenom},\n\n\n\nBien cordialement,\n{signature}"],
];

function module_mails(): array
{
  $equipe = ['admin', 'manager'];
  return [
    'titre' => 'Messagerie',
    'schema' => [1 => <<<'SQL'
      CREATE TABLE IF NOT EXISTS m_mails_envois (id INTEGER PRIMARY KEY, quand TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'libre',
        document_id INTEGER NOT NULL DEFAULT 0, client_id INTEGER NOT NULL DEFAULT 0, agent_id INTEGER NOT NULL DEFAULT 0,
        a TEXT NOT NULL DEFAULT '', nom TEXT NOT NULL DEFAULT '', cc TEXT NOT NULL DEFAULT '', sujet TEXT NOT NULL DEFAULT '', texte TEXT NOT NULL DEFAULT '',
        pieces TEXT NOT NULL DEFAULT '', par TEXT NOT NULL DEFAULT '', gmail_id TEXT NOT NULL DEFAULT '', fil TEXT NOT NULL DEFAULT '',
        statut TEXT NOT NULL DEFAULT 'envoye', erreur TEXT NOT NULL DEFAULT '', niveau INTEGER NOT NULL DEFAULT 0,
        fichier TEXT NOT NULL DEFAULT '', fichier_nom TEXT NOT NULL DEFAULT '', jeton TEXT NOT NULL DEFAULT '', expire TEXT NOT NULL DEFAULT '',
        ouvert_le TEXT NOT NULL DEFAULT '', ouvertures INTEGER NOT NULL DEFAULT 0, qui TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS i_m_mails_doc ON m_mails_envois (document_id, quand);
      CREATE INDEX IF NOT EXISTS i_m_mails_client ON m_mails_envois (client_id, quand);
      CREATE INDEX IF NOT EXISTS i_m_mails_agent ON m_mails_envois (agent_id, quand);
      CREATE INDEX IF NOT EXISTS i_m_mails_jeton ON m_mails_envois (jeton);
      CREATE TABLE IF NOT EXISTS m_mails_modeles (cle TEXT PRIMARY KEY, sujet TEXT NOT NULL DEFAULT '', texte TEXT NOT NULL DEFAULT '', maj TEXT NOT NULL DEFAULT '');
      SQL],
    'admin' => [
      'etat' => ['methode' => 'GET', 'roles' => $equipe, 'fn' => 'mod_mails_etat'],
      'contacts' => ['methode' => 'GET', 'roles' => $equipe, 'fn' => 'mod_mails_contacts'],
      'envoyer' => ['methode' => 'POST', 'roles' => $equipe, 'fn' => 'mod_mails_envoyer'],
      'envois' => ['methode' => 'GET', 'roles' => $equipe, 'fn' => 'mod_mails_envois'],
      'relances' => ['methode' => 'GET', 'roles' => $equipe, 'fn' => 'mod_mails_relances'],
      'modeles' => ['methode' => 'GET', 'roles' => $equipe, 'fn' => 'mod_mails_modeles'],
      'modele.enregistrer' => ['methode' => 'POST', 'roles' => ['admin'], 'fn' => 'mod_mails_modele_enregistrer'],
      'boite' => ['methode' => 'GET', 'roles' => $equipe, 'fn' => 'mod_mails_boite'],
      'fil' => ['methode' => 'GET', 'roles' => $equipe, 'fn' => 'mod_mails_fil'],
      'piece' => ['methode' => 'GET', 'roles' => $equipe, 'fn' => 'mod_mails_piece'],
      'repondre' => ['methode' => 'POST', 'roles' => $equipe, 'fn' => 'mod_mails_repondre'],
      'classer' => ['methode' => 'POST', 'roles' => $equipe, 'fn' => 'mod_mails_classer'],
    ],
    'public' => [
      'voir' => ['methode' => 'GET', 'fn' => 'mod_mails_voir'],
      'pdf' => ['methode' => 'GET', 'fn' => 'mod_mails_pdf'],
    ],
    'cron' => 'mod_mails_cron',
    'compteurs' => 'mod_mails_compteurs',
  ];
}

/* ---------- Outils ---------- */
function mod_mails_google(): bool
{
  require_once __DIR__ . '/../google.php';
  return google_relie();
}
// Mode démonstration : base de test sans Google (aucun envoi réel, boîte de réception d'exemple)
function mod_mails_demo(): bool
{
  return (bool)getenv('BDA_NO_MAIL') && !mod_mails_google();
}
function mod_mails_dossier(): string
{
  $dir = dossier_donnees() . '/mails';
  if (!is_dir($dir) && !@mkdir($dir, 0700, true)) throw new RuntimeException('Espace de stockage indisponible.');
  return $dir;
}
function mod_mails_euro(float $v): string
{
  return number_format($v, 2, ',', "\u{00a0}") . "\u{00a0}€";
}
function mod_mails_date_fr(string $iso): string
{
  return preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $iso, $m) ? "$m[3]/$m[2]/$m[1]" : $iso;
}
function mod_mails_modele(string $cle): array
{
  $st = db()->prepare('SELECT sujet, texte FROM m_mails_modeles WHERE cle = ?');
  $st->execute([$cle]);
  $m = $st->fetch();
  $defaut = MOD_MAILS_MODELES[$cle] ?? MOD_MAILS_MODELES['libre'];
  return ['cle' => $cle, 'libelle' => $defaut[0], 'sujet' => $m ? (string)$m['sujet'] : $defaut[1], 'texte' => $m ? (string)$m['texte'] : $defaut[2], 'modifie' => (bool)$m];
}
function mod_mails_signature(): string
{
  $st = db()->prepare('SELECT texte FROM m_mails_modeles WHERE cle = ?');
  $st->execute(['signature']);
  $s = $st->fetchColumn();
  return $s !== false && trim((string)$s) !== '' ? (string)$s : MOD_MAILS_SIGNATURE;
}
// E-mail d'un agent : fiche (infos.mail), sinon compte de l'Espace équipe
function mod_mails_email_agent(array $a): string
{
  $infos = json_decode((string)($a['infos'] ?? ''), true);
  $m = is_array($infos) ? trim((string)($infos['mail'] ?? '')) : '';
  if (filter_var($m, FILTER_VALIDATE_EMAIL)) return $m;
  $st = db()->prepare("SELECT email FROM comptes_equipe WHERE agent_id = ? AND email <> '' ORDER BY id DESC LIMIT 1");
  $st->execute([(int)$a['id']]);
  $m = trim((string)$st->fetchColumn());
  return filter_var($m, FILTER_VALIDATE_EMAIL) ? $m : '';
}
// E-mail d'un client : fiche, sinon compte de l'espace client
function mod_mails_email_client(int $id, string $email = ''): string
{
  if (filter_var(trim($email), FILTER_VALIDATE_EMAIL)) return trim($email);
  $st = db()->prepare('SELECT email FROM comptes_clients WHERE client_id = ? ORDER BY id DESC LIMIT 1');
  $st->execute([$id]);
  $m = trim((string)$st->fetchColumn());
  return filter_var($m, FILTER_VALIDATE_EMAIL) ? $m : '';
}
// Client d'un document (lié par le nom) : id, nom, e-mail
function mod_mails_client_document(array $doc): array
{
  $nom = trim((string)$doc['client']);
  $st = db()->prepare('SELECT id, nom, email FROM clients WHERE lower(trim(nom)) = lower(?) LIMIT 1');
  $st->execute([$nom]);
  $c = $st->fetch();
  $email = $c ? mod_mails_email_client((int)$c['id'], (string)$c['email']) : '';
  if ($email === '') {
    $data = json_decode((string)$doc['data'], true);
    if (is_array($data) && preg_match('/[\w.+-]+@[\w-]+(\.[\w-]+)+/', (string)($data['client']['adresse'] ?? ''), $m)) $email = $m[0];
  }
  return ['id' => $c ? (int)$c['id'] : 0, 'nom' => $c ? (string)$c['nom'] : $nom, 'email' => $email];
}
function mod_mails_variables(?array $doc = null, array $dest = []): array
{
  $v = ['{signature}' => mod_mails_signature(), '{date}' => date('d/m/Y'), '{prenom}' => '', '{client}' => (string)($dest['nom'] ?? '')];
  if (!empty($dest['nom']) && ($dest['type'] ?? '') === 'agent') {
    // « DURAND Marc » → « Marc »
    $mots = preg_split('/\s+/', trim((string)$dest['nom'])) ?: [];
    $prenoms = array_filter($mots, fn ($m) => $m !== mb_strtoupper($m));
    $v['{prenom}'] = $prenoms ? implode(' ', $prenoms) : '';
  }
  if ($doc) {
    $v['{numero}'] = (string)$doc['numero'];
    $v['{montant}'] = mod_mails_euro((float)$doc['total']);
    $v['{echeance}'] = mod_mails_date_fr((string)$doc['echeance']);
    $v['{client}'] = (string)$doc['client'];
  }
  return $v;
}
function mod_mails_remplir(string $s, array $v): string
{
  $s = strtr($s, $v);
  $s = str_replace('Bonjour ,', 'Bonjour,', $s);
  return trim((string)preg_replace("/\n{3,}/", "\n\n", $s));
}

/* ---------- État (Google relié ?) ---------- */
function mod_mails_etat(): void
{
  $relie = mod_mails_google();
  repondre(['ok' => true, 'relie' => $relie, 'demo' => mod_mails_demo(), 'compte' => $relie ? google_compte() : '', 'signature' => mod_mails_signature()]);
}

/* ---------- Carnet d'adresses : agents, clients, groupes ---------- */
function mod_mails_contacts(): void
{
  $agents = [];
  foreach (db()->query("SELECT id, nom, poste, tel, categorie, infos FROM agents WHERE actif = 1 ORDER BY nom COLLATE NOCASE") as $a) {
    $agents[] = ['id' => (int)$a['id'], 'nom' => (string)$a['nom'], 'poste' => (string)$a['poste'], 'tel' => (string)$a['tel'], 'categorie' => (string)$a['categorie'], 'email' => mod_mails_email_agent($a)];
  }
  $clients = [];
  foreach (db()->query('SELECT id, nom, tel, email FROM clients ORDER BY nom COLLATE NOCASE') as $c) {
    $clients[] = ['id' => (int)$c['id'], 'nom' => (string)$c['nom'], 'tel' => (string)$c['tel'], 'email' => mod_mails_email_client((int)$c['id'], (string)$c['email'])];
  }
  // Agents d'un site : ceux qui y ont travaillé ces 60 derniers jours ou qui y sont prévus dans les 30 prochains
  $sites = [];
  try {
    $st = db()->prepare("SELECT s.id, s.nom, GROUP_CONCAT(DISTINCT v.agent_id) AS agents FROM sites s LEFT JOIN vacations v ON v.site_id = s.id AND v.agent_id > 0 AND v.statut <> 'annulee' AND v.jour BETWEEN ? AND ?
      WHERE s.actif = 1 GROUP BY s.id ORDER BY s.nom COLLATE NOCASE");
    $st->execute([date('Y-m-d', time() - 60 * 86400), date('Y-m-d', time() + 30 * 86400)]);
    foreach ($st as $s) $sites[] = ['id' => (int)$s['id'], 'nom' => (string)$s['nom'], 'agents' => array_values(array_filter(array_map('intval', explode(',', (string)$s['agents']))))];
  } catch (Throwable $e) { /* planning des sites absent */ }
  repondre(['ok' => true, 'agents' => $agents, 'clients' => $clients, 'sites' => $sites]);
}

/* ---------- Envoi (un mail par destinataire) ---------- */
function mod_mails_envoyer(): void
{
  mod_mails_google(); // charge app/google.php (compte relié, envoi)
  if (!limiter('mails-envoi', 300, 3600)) throw new RuntimeException('Trop d’envois en une heure. Réessayez plus tard.');
  $b = json_decode((string)($_POST['donnees'] ?? ''), true);
  if (!is_array($b)) throw new RuntimeException('Demande illisible.');
  $sujet = texte($b['sujet'] ?? '', 200);
  $texte = texte($b['texte'] ?? '', 20000);
  if (trim($sujet) === '') throw new RuntimeException('Écrivez un objet.');
  if (trim($texte) === '') throw new RuntimeException('Écrivez un message.');
  $type = in_array($b['type'] ?? '', ['facture', 'devis', 'relance', 'libre'], true) ? (string)$b['type'] : 'libre';
  $cc = array_values(array_filter(preg_split('/[,;\s]+/', texte($b['cc'] ?? '', 500)) ?: [], fn ($m) => filter_var($m, FILTER_VALIDATE_EMAIL)));

  // Destinataires (agents, clients ou adresses libres), sans doublon
  $dests = [];
  foreach (array_slice((array)($b['destinataires'] ?? []), 0, 400) as $d) {
    if (!is_array($d)) continue;
    $email = trim(texte($d['email'] ?? '', 160));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) continue;
    $cle = mb_strtolower($email);
    if (isset($dests[$cle])) continue;
    $dests[$cle] = ['email' => $email, 'type' => in_array($d['type'] ?? '', ['agent', 'client'], true) ? (string)$d['type'] : 'email', 'id' => (int)($d['id'] ?? 0), 'nom' => texte($d['nom'] ?? '', 160)];
  }
  if (!$dests) throw new RuntimeException('Ajoutez au moins un destinataire avec une adresse e-mail valide.');

  // Document (facture ou devis) : PDF produit par le navigateur, gardé dans le dossier privé
  $doc = null;
  $pj = [];
  $fichier = '';
  $fichierNom = '';
  if (!empty($b['document_id'])) {
    $st = db()->prepare('SELECT * FROM documents WHERE id = ?');
    $st->execute([(int)$b['document_id']]);
    $doc = $st->fetch() ?: null;
    if (!$doc) throw new RuntimeException('Document introuvable.');
    if (empty($_FILES['pdf']['tmp_name']) || ($_FILES['pdf']['error'] ?? 1) !== UPLOAD_ERR_OK) throw new RuntimeException('Le PDF du document n’a pas été reçu. Réessayez.');
    if ((int)$_FILES['pdf']['size'] > 15 * 1024 * 1024 || type_fichier((string)$_FILES['pdf']['tmp_name']) !== 'application/pdf') throw new RuntimeException('Le PDF du document est invalide.');
    $fichierNom = (string)preg_replace('/[^\p{L}\p{N} ._()-]+/u', ' ', texte($_FILES['pdf']['name'] ?? '', 120));
    if (!str_ends_with(mb_strtolower($fichierNom), '.pdf')) $fichierNom .= '.pdf';
    $fichier = bin2hex(random_bytes(16)) . '.pdf';
    if (!move_uploaded_file((string)$_FILES['pdf']['tmp_name'], mod_mails_dossier() . '/' . $fichier)) throw new RuntimeException('Le PDF n’a pas pu être enregistré.');
    $pj[] = ['nom' => $fichierNom, 'type' => 'application/pdf', 'donnees' => (string)file_get_contents(mod_mails_dossier() . '/' . $fichier)];
  }
  // Pièces jointes choisies sur l'ordinateur (PDF, images), 15 Mo au total
  $total = array_sum(array_map(fn ($f) => strlen($f['donnees']), $pj));
  $pieces = $_FILES['pieces'] ?? null;
  if (is_array($pieces) && is_array($pieces['tmp_name'] ?? null)) {
    foreach ($pieces['tmp_name'] as $i => $tmp) {
      if (($pieces['error'][$i] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file((string)$tmp)) continue;
      $mime = type_fichier((string)$tmp);
      if (!in_array($mime, ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'], true)) throw new RuntimeException('Pièce jointe refusée : seulement des PDF ou des images.');
      $donnees = (string)file_get_contents((string)$tmp);
      $total += strlen($donnees);
      if ($total > 15 * 1024 * 1024) throw new RuntimeException('Pièces jointes trop lourdes (15 Mo au maximum).');
      $pj[] = ['nom' => (string)preg_replace('/[^\p{L}\p{N} ._()-]+/u', ' ', texte($pieces['name'][$i] ?? 'piece', 120)), 'type' => $mime, 'donnees' => $donnees];
    }
  }

  $qui = (string)($_SESSION['login'] ?? '');
  $niveau = max(0, min(3, (int)($b['niveau'] ?? 0)));
  $ins = db()->prepare('INSERT INTO m_mails_envois (quand, type, document_id, client_id, agent_id, a, nom, cc, sujet, texte, pieces, par, gmail_id, fil, statut, erreur, niveau, fichier, fichier_nom, jeton, expire, qui)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $envoyes = 0;
  $erreurs = [];
  foreach ($dests as $d) {
    $jeton = $doc ? mod_jeton() : '';
    $v = mod_mails_variables($doc, $d) + ['{lien}' => $jeton !== '' ? mod_url('/api/module.php?m=mails&a=voir&t=' . $jeton) : ''];
    $s = mod_mails_remplir($sujet, $v);
    $t = mod_mails_remplir($texte, $v);
    $clientId = $d['type'] === 'client' ? $d['id'] : ($doc ? mod_mails_client_document($doc)['id'] : 0);
    try {
      $r = mod_envoyer_mail($d['email'], $s, $t, $pj, ['cc' => $cc, 'repondreA' => google_compte() ?: BDA_EMAIL]);
      $ins->execute([maintenant(), $type, $doc ? (int)$doc['id'] : 0, $clientId, $d['type'] === 'agent' ? $d['id'] : 0, $d['email'], $d['nom'], implode(', ', $cc), $s, $t,
        implode(', ', array_column($pj, 'nom')), $r['par'], $r['id'], $r['fil'], 'envoye', '', $niveau, $fichier, $fichierNom, $jeton !== '' ? mod_empreinte($jeton) : '', $jeton !== '' ? date('Y-m-d', time() + 365 * 86400) : '', $qui]);
      $envoyes++;
    } catch (RuntimeException $e) {
      $erreurs[] = $d['email'] . ' : ' . $e->getMessage();
      if (count($dests) === 1) throw $e;
    }
  }
  // Document en brouillon : il passe à « envoyé » si demandé (comme le dépôt dans l'espace client)
  if ($doc && $envoyes && !empty($b['marquer']) && $doc['statut'] === 'brouillon') {
    db()->prepare('UPDATE documents SET statut = ?, maj = ? WHERE id = ?')->execute([$doc['type'] === 'facture' ? 'envoyee' : 'envoye', maintenant(), (int)$doc['id']]);
  }
  $quoi = $doc ? (($doc['type'] === 'facture' ? 'Facture ' : 'Devis ') . $doc['numero']) : 'Message';
  journal('document', $envoyes === 1 ? "$quoi envoyé par mail" : "$quoi envoyé par mail à $envoyes destinataires" . ($type === 'relance' ? " (relance $niveau)" : ''));
  repondre(['ok' => true, 'envoyes' => $envoyes, 'erreurs' => $erreurs, 'statut' => $doc ? (string)db()->query('SELECT statut FROM documents WHERE id = ' . (int)$doc['id'])->fetchColumn() : '']);
}

/* ---------- Historique ---------- */
function mod_mails_envois(): void
{
  $where = [];
  $params = [];
  foreach (['document' => 'document_id', 'client' => 'client_id', 'agent' => 'agent_id'] as $p => $col) {
    if (!empty($_GET[$p])) { $where[] = "e.$col = ?"; $params[] = (int)$_GET[$p]; }
  }
  $q = trim(texte($_GET['q'] ?? '', 80));
  if ($q !== '') { $where[] = '(e.a LIKE ? OR e.nom LIKE ? OR e.sujet LIKE ?)'; array_push($params, "%$q%", "%$q%", "%$q%"); }
  $sql = 'SELECT e.id, e.quand, e.type, e.document_id, e.client_id, e.agent_id, e.a, e.nom, e.cc, e.sujet, e.pieces, e.par, e.statut, e.niveau, e.ouvert_le, e.ouvertures, e.qui, d.numero, d.type AS doc_type
    FROM m_mails_envois e LEFT JOIN documents d ON d.id = e.document_id' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY e.quand DESC, e.id DESC LIMIT 300';
  $st = db()->prepare($sql);
  $st->execute($params);
  repondre(['ok' => true, 'envois' => $st->fetchAll()]);
}
function mod_mails_envoi_detail(int $id): array
{
  $st = db()->prepare('SELECT * FROM m_mails_envois WHERE id = ?');
  $st->execute([$id]);
  return $st->fetch() ?: [];
}

/* ---------- Relances des factures en retard (préparées, jamais envoyées seules) ---------- */
function mod_mails_relances_liste(): array
{
  $st = db()->prepare("SELECT id, numero, client, total, echeance, date, data FROM documents WHERE type = 'facture' AND statut = 'envoyee' AND echeance <> '' AND echeance < ? ORDER BY echeance");
  $st->execute([date('Y-m-d')]);
  $dern = db()->prepare("SELECT quand, niveau FROM m_mails_envois WHERE document_id = ? AND type = 'relance' AND statut = 'envoye' ORDER BY quand DESC LIMIT 1");
  $nbRel = db()->prepare("SELECT COUNT(*) FROM m_mails_envois WHERE document_id = ? AND type = 'relance' AND statut = 'envoye'");
  $out = [];
  foreach ($st as $d) {
    $retard = (int)floor((strtotime(date('Y-m-d')) - strtotime((string)$d['echeance'])) / 86400);
    $dern->execute([(int)$d['id']]);
    $derniere = $dern->fetch() ?: null;
    $nbRel->execute([(int)$d['id']]);
    $n = (int)$nbRel->fetchColumn();
    $parRetard = $retard <= 7 ? 1 : ($retard <= 20 ? 2 : 3);
    $niveau = min(3, max($parRetard, $n + 1));
    $client = mod_mails_client_document($d);
    $out[] = ['id' => (int)$d['id'], 'numero' => (string)$d['numero'], 'client' => (string)$d['client'], 'client_id' => $client['id'], 'email' => $client['email'],
      'total' => (float)$d['total'], 'echeance' => (string)$d['echeance'], 'retard' => $retard, 'relances' => $n, 'derniere' => $derniere ? (string)$derniere['quand'] : '',
      'niveau' => $niveau, 'a_faire' => !$derniere || strtotime((string)$derniere['quand']) < time() - 7 * 86400];
  }
  return $out;
}
function mod_mails_relances(): void
{
  repondre(['ok' => true, 'relances' => mod_mails_relances_liste()]);
}

/* ---------- Modèles ---------- */
function mod_mails_modeles(): void
{
  $liste = [];
  foreach (array_keys(MOD_MAILS_MODELES) as $cle) $liste[] = mod_mails_modele($cle);
  repondre(['ok' => true, 'modeles' => $liste, 'signature' => mod_mails_signature(), 'signatureDefaut' => MOD_MAILS_SIGNATURE]);
}
function mod_mails_modele_enregistrer(): void
{
  $b = corps();
  $cle = (string)($b['cle'] ?? '');
  if ($cle !== 'signature' && !isset(MOD_MAILS_MODELES[$cle])) throw new RuntimeException('Modèle inconnu.');
  if (!empty($b['reinitialiser'])) {
    db()->prepare('DELETE FROM m_mails_modeles WHERE cle = ?')->execute([$cle]);
  } else {
    db()->prepare('INSERT INTO m_mails_modeles (cle, sujet, texte, maj) VALUES (?, ?, ?, ?) ON CONFLICT(cle) DO UPDATE SET sujet = excluded.sujet, texte = excluded.texte, maj = excluded.maj')
      ->execute([$cle, texte($b['sujet'] ?? '', 200), texte($b['texte'] ?? '', 8000), maintenant()]);
  }
  journal('document', 'Modèle de mail « ' . ($cle === 'signature' ? 'signature' : MOD_MAILS_MODELES[$cle][0]) . ' » modifié');
  mod_mails_modeles();
}

/* ---------- Boîte de réception (Gmail de contact@) ---------- */
function mod_mails_entete(array $headers, string $nom): string
{
  foreach ($headers as $h) if (strcasecmp((string)($h['name'] ?? ''), $nom) === 0) return (string)($h['value'] ?? '');
  return '';
}
function mod_mails_adresse(string $de): array
{
  if (preg_match('/^\s*"?([^"<]*?)"?\s*<([^>]+)>/', $de, $m)) return ['nom' => trim($m[1]), 'email' => trim($m[2])];
  return ['nom' => '', 'email' => trim($de)];
}
// Qui est cet expéditeur pour l'admin ? (client ou agent connu)
function mod_mails_connus(): array
{
  static $carte = null;
  if ($carte !== null) return $carte;
  $carte = [];
  foreach (db()->query("SELECT id, nom, email FROM clients WHERE email <> ''") as $c) $carte[mb_strtolower(trim((string)$c['email']))] = ['type' => 'client', 'id' => (int)$c['id'], 'nom' => (string)$c['nom']];
  foreach (db()->query('SELECT cc.email, c.id, c.nom FROM comptes_clients cc JOIN clients c ON c.id = cc.client_id') as $c) $carte[mb_strtolower(trim((string)$c['email']))] ??= ['type' => 'client', 'id' => (int)$c['id'], 'nom' => (string)$c['nom']];
  foreach (db()->query('SELECT id, nom, infos FROM agents') as $a) {
    $m = mb_strtolower(mod_mails_email_agent($a));
    if ($m !== '') $carte[$m] ??= ['type' => 'agent', 'id' => (int)$a['id'], 'nom' => (string)$a['nom']];
  }
  return $carte;
}
function mod_mails_demo_fils(): array
{
  return [
    ['id' => 'demo1', 'de' => 'Consulat (exemple)', 'email' => 'contact@exemple.invalid', 'sujet' => 'Exemple : planning de décembre', 'extrait' => 'Bonjour, pourriez-vous nous envoyer le planning prévisionnel de décembre…', 'date' => date('Y-m-d H:i:s', time() - 3600), 'nonlu' => true, 'n' => 2, 'connu' => null],
    ['id' => 'demo2', 'de' => 'Prospect (exemple)', 'email' => 'bar@exemple.invalid', 'sujet' => 'Exemple : demande de devis pour un bar', 'extrait' => 'Nous cherchons deux agents le vendredi et le samedi soir de 22 h à 5 h…', 'date' => date('Y-m-d H:i:s', time() - 86400), 'nonlu' => false, 'n' => 1, 'connu' => null],
  ];
}
function mod_mails_boite(): void
{
  if (mod_mails_demo()) repondre(['ok' => true, 'relie' => false, 'demo' => true, 'fils' => mod_mails_demo_fils(), 'nonlus' => 1]);
  if (!mod_mails_google()) repondre(['ok' => true, 'relie' => false, 'fils' => []]);
  $q = trim(texte($_GET['q'] ?? '', 120));
  $dossier = ($_GET['dossier'] ?? '') === 'envoyes' ? 'SENT' : 'INBOX';
  $url = 'https://gmail.googleapis.com/gmail/v1/users/me/threads?' . http_build_query(['labelIds' => $dossier, 'maxResults' => 25, 'q' => $q]);
  $liste = google_api('GET', $url);
  $connus = mod_mails_connus();
  $fils = [];
  foreach ((array)($liste['threads'] ?? []) as $t) {
    $id = (string)($t['id'] ?? '');
    if (!preg_match('/^[0-9a-f]{6,40}$/i', $id)) continue;
    $f = google_api('GET', "https://gmail.googleapis.com/gmail/v1/users/me/threads/$id?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=To");
    $msgs = (array)($f['messages'] ?? []);
    if (!$msgs) continue;
    $dernier = end($msgs);
    $premier = reset($msgs);
    $hd = (array)($dernier['payload']['headers'] ?? []);
    $qui = mod_mails_adresse(mod_mails_entete($dossier === 'SENT' ? $hd : (array)($premier['payload']['headers'] ?? []), $dossier === 'SENT' ? 'To' : 'From'));
    $nonlu = false;
    foreach ($msgs as $m) if (in_array('UNREAD', (array)($m['labelIds'] ?? []), true)) $nonlu = true;
    $fils[] = ['id' => $id, 'de' => $qui['nom'] ?: $qui['email'], 'email' => $qui['email'], 'sujet' => mod_mails_entete((array)($premier['payload']['headers'] ?? []), 'Subject') ?: '(sans objet)',
      'extrait' => html_entity_decode((string)($dernier['snippet'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8'), 'date' => date('Y-m-d H:i:s', (int)((int)($dernier['internalDate'] ?? 0) / 1000)),
      'nonlu' => $nonlu, 'n' => count($msgs), 'connu' => $connus[mb_strtolower($qui['email'])] ?? null];
  }
  repondre(['ok' => true, 'relie' => true, 'fils' => $fils]);
}
// Texte lisible d'un message Gmail : text/plain de préférence, sinon le HTML réduit en texte (jamais injecté en HTML)
function mod_mails_corps(array $partie, array &$pieces, string $msgId): array
{
  $mime = (string)($partie['mimeType'] ?? '');
  $donnees = (string)($partie['body']['data'] ?? '');
  $nomFichier = (string)($partie['filename'] ?? '');
  if ($nomFichier !== '' && !empty($partie['body']['attachmentId'])) {
    $pieces[] = ['nom' => $nomFichier, 'taille' => (int)($partie['body']['size'] ?? 0), 'message' => $msgId, 'piece' => (string)$partie['body']['attachmentId'], 'type' => $mime];
    return ['', ''];
  }
  $texte = ['', ''];
  if ($donnees !== '') {
    $brut = (string)base64_decode(strtr($donnees, '-_', '+/'));
    if ($mime === 'text/plain') $texte[0] = $brut;
    elseif ($mime === 'text/html') $texte[1] = $brut;
  }
  foreach ((array)($partie['parts'] ?? []) as $p) {
    [$t, $h] = mod_mails_corps($p, $pieces, $msgId);
    if ($texte[0] === '' && $t !== '') $texte[0] = $t;
    if ($texte[1] === '' && $h !== '') $texte[1] = $h;
  }
  return $texte;
}
function mod_mails_html_texte(string $html): string
{
  $html = (string)preg_replace('~<(script|style|head)[^>]*>.*?</\1>~is', '', $html);
  $html = (string)preg_replace('~<\s*(br|/p|/div|/tr|/li|/h[1-6])\s*/?>~i', "\n", $html);
  $t = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
  return trim((string)preg_replace(["/[ \t]+/", "/\n\s*\n\s*\n+/"], [' ', "\n\n"], $t));
}
function mod_mails_fil(): void
{
  $id = (string)($_GET['id'] ?? '');
  if (mod_mails_demo()) {
    $f = array_values(array_filter(mod_mails_demo_fils(), fn ($x) => $x['id'] === $id))[0] ?? null;
    if (!$f) throw new RuntimeException('Conversation introuvable.');
    repondre(['ok' => true, 'fil' => ['id' => $id, 'sujet' => $f['sujet'], 'connu' => null, 'messages' => [
      ['id' => 'm1', 'de' => $f['de'], 'email' => $f['email'], 'a' => 'contact@bdasecurite.com', 'date' => $f['date'], 'texte' => $f['extrait'] . "\n\nCeci est un message d'exemple (base de test).", 'pieces' => [], 'moi' => false]]]]);
  }
  if (!mod_mails_google()) throw new RuntimeException('La messagerie Google n’est pas reliée.');
  if (!preg_match('/^[0-9a-f]{6,40}$/i', $id)) throw new RuntimeException('Conversation introuvable.');
  $f = google_api('GET', "https://gmail.googleapis.com/gmail/v1/users/me/threads/$id?format=full");
  $compte = mb_strtolower(google_compte());
  $messages = [];
  $sujet = '';
  $nonlu = false;
  foreach ((array)($f['messages'] ?? []) as $m) {
    $hd = (array)($m['payload']['headers'] ?? []);
    $pieces = [];
    [$t, $html] = mod_mails_corps((array)($m['payload'] ?? []), $pieces, (string)($m['id'] ?? ''));
    $texte = trim($t !== '' ? $t : mod_mails_html_texte($html));
    $de = mod_mails_adresse(mod_mails_entete($hd, 'From'));
    $sujet = $sujet ?: mod_mails_entete($hd, 'Subject');
    if (in_array('UNREAD', (array)($m['labelIds'] ?? []), true)) $nonlu = true;
    $messages[] = ['id' => (string)($m['id'] ?? ''), 'de' => $de['nom'] ?: $de['email'], 'email' => $de['email'], 'a' => mod_mails_entete($hd, 'To'), 'cc' => mod_mails_entete($hd, 'Cc'),
      'date' => date('Y-m-d H:i:s', (int)((int)($m['internalDate'] ?? 0) / 1000)), 'texte' => mb_substr($texte, 0, 60000), 'pieces' => $pieces, 'moi' => mb_strtolower($de['email']) === $compte];
  }
  // Ouvrir la conversation la marque comme lue
  if ($nonlu) {
    try { google_api('POST', "https://gmail.googleapis.com/gmail/v1/users/me/threads/$id/modify", ['removeLabelIds' => ['UNREAD']]); } catch (Throwable $e) { /* pas grave */ }
  }
  $premier = $messages[0] ?? null;
  $autre = null;
  foreach ($messages as $m) if (!$m['moi']) { $autre = $m; break; }
  repondre(['ok' => true, 'fil' => ['id' => $id, 'sujet' => $sujet ?: '(sans objet)', 'messages' => $messages,
    'connu' => $autre ? (mod_mails_connus()[mb_strtolower($autre['email'])] ?? null) : null, 'premier' => $premier ? $premier['email'] : '']]);
}
function mod_mails_piece(): void
{
  if (!mod_mails_google()) throw new RuntimeException('La messagerie Google n’est pas reliée.');
  $msg = (string)($_GET['message'] ?? '');
  $piece = (string)($_GET['piece'] ?? '');
  if (!preg_match('/^[0-9a-f]{6,40}$/i', $msg) || !preg_match('/^[\w-]{10,2000}$/', $piece)) throw new RuntimeException('Pièce jointe introuvable.');
  $r = google_api('GET', "https://gmail.googleapis.com/gmail/v1/users/me/messages/$msg/attachments/$piece");
  $donnees = (string)base64_decode(strtr((string)($r['data'] ?? ''), '-_', '+/'));
  $nom = (string)preg_replace('/[^\p{L}\p{N} ._()-]+/u', ' ', texte($_GET['nom'] ?? 'piece-jointe', 120));
  header('Content-Type: application/octet-stream');
  header('Content-Disposition: attachment; filename="' . rawurlencode($nom) . '"; filename*=UTF-8\'\'' . rawurlencode($nom));
  header('Content-Length: ' . strlen($donnees));
  header('X-Content-Type-Options: nosniff');
  echo $donnees;
  exit;
}
function mod_mails_repondre(): void
{
  $b = corps();
  $id = (string)($b['fil'] ?? '');
  $texte = texte($b['texte'] ?? '', 20000);
  if (trim($texte) === '') throw new RuntimeException('Écrivez votre réponse.');
  if (mod_mails_demo()) {
    mod_envoyer_mail('contact@exemple.invalid', 'Re: exemple', $texte);
    repondre(['ok' => true]);
  }
  if (!mod_mails_google()) throw new RuntimeException('La messagerie Google n’est pas reliée.');
  if (!preg_match('/^[0-9a-f]{6,40}$/i', $id)) throw new RuntimeException('Conversation introuvable.');
  $f = google_api('GET', "https://gmail.googleapis.com/gmail/v1/users/me/threads/$id?format=metadata&metadataHeaders=From&metadataHeaders=Reply-To&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References");
  $compte = mb_strtolower(google_compte());
  $cible = null;
  foreach (array_reverse((array)($f['messages'] ?? [])) as $m) {
    $hd = (array)($m['payload']['headers'] ?? []);
    $de = mod_mails_adresse(mod_mails_entete($hd, 'Reply-To') ?: mod_mails_entete($hd, 'From'));
    if (mb_strtolower($de['email']) !== $compte) { $cible = ['hd' => $hd, 'email' => $de['email'], 'nom' => $de['nom']]; break; }
  }
  if (!$cible) throw new RuntimeException('Personne à qui répondre dans cette conversation.');
  $sujet = mod_mails_entete($cible['hd'], 'Subject');
  if (!preg_match('/^\s*re\s*:/i', $sujet)) $sujet = 'Re: ' . $sujet;
  $msgId = mod_mails_entete($cible['hd'], 'Message-ID');
  $refs = trim(mod_mails_entete($cible['hd'], 'References') . ' ' . $msgId);
  $r = mod_envoyer_mail($cible['email'], $sujet, $texte, [], ['inReplyTo' => $msgId, 'references' => $refs, 'threadId' => $id]);
  $connu = mod_mails_connus()[mb_strtolower($cible['email'])] ?? null;
  db()->prepare('INSERT INTO m_mails_envois (quand, type, client_id, agent_id, a, nom, sujet, texte, par, gmail_id, fil, statut, qui) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([maintenant(), 'libre', $connu && $connu['type'] === 'client' ? $connu['id'] : 0, $connu && $connu['type'] === 'agent' ? $connu['id'] : 0, $cible['email'], $cible['nom'], $sujet, $texte, $r['par'], $r['id'], $r['fil'], 'envoye', (string)($_SESSION['login'] ?? '')]);
  repondre(['ok' => true]);
}
function mod_mails_classer(): void
{
  $b = corps();
  $id = (string)($b['fil'] ?? '');
  $action = (string)($b['action'] ?? '');
  if (mod_mails_demo()) repondre(['ok' => true]);
  if (!mod_mails_google()) throw new RuntimeException('La messagerie Google n’est pas reliée.');
  if (!preg_match('/^[0-9a-f]{6,40}$/i', $id)) throw new RuntimeException('Conversation introuvable.');
  $modif = ['archiver' => ['removeLabelIds' => ['INBOX']], 'lu' => ['removeLabelIds' => ['UNREAD']], 'nonlu' => ['addLabelIds' => ['UNREAD']], 'boite' => ['addLabelIds' => ['INBOX']]][$action] ?? null;
  if (!$modif) throw new RuntimeException('Action inconnue.');
  google_api('POST', "https://gmail.googleapis.com/gmail/v1/users/me/threads/$id/modify", $modif);
  repondre(['ok' => true]);
}

/* ---------- Lien public « Voir le document en ligne » ---------- */
function mod_mails_par_jeton(): array
{
  $jeton = (string)($_GET['t'] ?? '');
  if (!preg_match('/^[0-9a-f]{48}$/', $jeton)) return [];
  $st = db()->prepare("SELECT e.*, d.numero, d.type AS doc_type, d.total FROM m_mails_envois e LEFT JOIN documents d ON d.id = e.document_id WHERE e.jeton = ? AND e.fichier <> ''");
  $st->execute([mod_empreinte($jeton)]);
  return $st->fetch() ?: [];
}
function mod_mails_voir(): void
{
  $e = mod_mails_par_jeton();
  $valide = $e && (string)$e['expire'] >= date('Y-m-d') && is_file(mod_mails_dossier() . '/' . basename((string)$e['fichier']));
  if ($valide) {
    if ((string)$e['ouvert_le'] === '') {
      notifier('mails', ($e['doc_type'] === 'devis' ? 'Un devis' : 'Une facture') . ' vient d’être ouvert' . ($e['doc_type'] === 'devis' ? '' : 'e'), 'Votre client a consulté le document envoyé par mail.', '/admin/#/messagerie/envoyes', 'mails-ouvert');
      journal('document', ($e['doc_type'] === 'devis' ? 'Devis ' : 'Facture ') . $e['numero'] . ' ouvert en ligne par le client');
    }
    db()->prepare("UPDATE m_mails_envois SET ouvert_le = CASE WHEN ouvert_le = '' THEN ? ELSE ouvert_le END, ouvertures = ouvertures + 1 WHERE id = ?")->execute([maintenant(), (int)$e['id']]);
  }
  $h = fn ($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
  $t = $h($_GET['t'] ?? '');
  $titre = $valide ? (($e['doc_type'] === 'devis' ? 'Devis ' : 'Facture ') . $e['numero']) : 'Document indisponible';
  header('Content-Type: text/html; charset=utf-8');
  header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-src 'self'; object-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  header('X-Frame-Options: DENY');
  header('Referrer-Policy: no-referrer');
  $lien = 'module.php?m=mails&a=pdf&t=' . $t;
  echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">'
    . '<title>' . $h($titre) . ' — BDA Security Group</title>'
    . '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..700&display=swap">'
    . '<style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;flex-direction:column;background:#f6f5f2;color:#121110;font:14px/1.5 Geist,Inter,system-ui,sans-serif}'
    . 'header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;background:#0f0e0d;color:#f3f1ec}'
    . '.marque b{display:block;font-size:15px;letter-spacing:-.01em}.marque small{color:#b8975a;font-size:10px;letter-spacing:.16em;text-transform:uppercase}'
    . 'main{flex:1;display:flex;flex-direction:column;gap:16px;width:min(980px,100%);margin:0 auto;padding:24px 16px}'
    . 'h1{margin:0;font-size:24px;font-weight:600;letter-spacing:-.03em}.sous{margin:4px 0 0;color:#6f6b64}'
    . '.barre{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px}'
    . 'a.btn{display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:6px;background:#121110;color:#fff;text-decoration:none;font-weight:500}'
    . 'object,iframe{width:100%;height:78vh;border:1px solid rgba(20,19,17,.1);border-radius:8px;background:#fff}'
    . '.vide{padding:48px 24px;border:1px solid rgba(20,19,17,.1);border-radius:8px;background:#fff;text-align:center;color:#6f6b64}'
    . 'footer{padding:16px;text-align:center;color:#9a958c;font-size:12px}</style></head><body>'
    . '<header><div class="marque"><b>BDA Security Group</b><small>Sécurité privée · Paris</small></div></header><main>';
  if ($valide) {
    echo '<div class="barre"><div><h1>' . $h($titre) . '</h1><p class="sous">Montant : ' . $h(mod_mails_euro((float)$e['total'])) . '</p></div>'
      . '<a class="btn" href="' . $lien . '&amp;dl=1">Télécharger le PDF</a></div>'
      . '<object data="' . $lien . '" type="application/pdf"><p class="vide">Votre navigateur n’affiche pas le PDF ici. <a href="' . $lien . '&amp;dl=1">Téléchargez-le</a>.</p></object>';
  } else {
    echo '<div class="vide"><h1>Document indisponible</h1><p>Ce lien a expiré ou n’est plus valable. Contactez BDA Security Group au 07 84 73 90 70 ou à contact@bdasecurite.com.</p></div>';
  }
  echo '</main><footer>BDA Security Group · bdasecurite.com</footer></body></html>';
  exit;
}
function mod_mails_pdf(): void
{
  $e = mod_mails_par_jeton();
  $chemin = $e ? mod_mails_dossier() . '/' . basename((string)$e['fichier']) : '';
  if (!$e || (string)$e['expire'] < date('Y-m-d') || !is_file($chemin)) { http_response_code(404); header('Content-Type: text/plain; charset=utf-8'); echo 'Document indisponible.'; exit; }
  $nom = (string)($e['fichier_nom'] ?: 'document.pdf');
  header('Content-Type: application/pdf');
  header('Content-Disposition: ' . (!empty($_GET['dl']) ? 'attachment' : 'inline') . '; filename="' . rawurlencode($nom) . '"; filename*=UTF-8\'\'' . rawurlencode($nom));
  header('Content-Length: ' . filesize($chemin));
  header('X-Frame-Options: SAMEORIGIN');
  header("Content-Security-Policy: default-src 'none'; frame-ancestors 'self'");
  readfile($chemin);
  exit;
}

/* ---------- Tâche planifiée : nouveaux messages dans la boîte de réception ---------- */
function mod_mails_cron(string $origine): array
{
  if (!mod_mails_google()) return ['relie' => false];
  $l = google_api('GET', 'https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX');
  $nonlus = (int)($l['threadsUnread'] ?? 0);
  $avant = (int)mod_reglage('mails', 'nonlus', 0);
  mod_reglage_ecrire('mails', 'nonlus', $nonlus);
  if ($nonlus > $avant) notifier('mails', $nonlus - $avant > 1 ? 'Nouveaux messages reçus' : 'Nouveau message reçu', 'Ouvrez la messagerie de l’admin.', '/admin/#/messagerie', 'mails-nouveau');
  return ['nonlus' => $nonlus];
}
function mod_mails_compteurs(): array
{
  $relances = 0;
  foreach (mod_mails_relances_liste() as $r) if ($r['a_faire']) $relances++;
  return ['mails' => mod_mails_demo() ? 1 : (int)mod_reglage('mails', 'nonlus', 0), 'relances' => $relances];
}
