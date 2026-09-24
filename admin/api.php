<?php
/* =========================================================
   ESPACE ADMIN BDA — API (réservée à l'administrateur connecté)
   Appel : /admin/api.php?a=action  (GET = lecture, POST JSON = écriture)
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
require __DIR__ . '/../app/auth.php';

entetes_securite();
demarrer_session();

$action = (string)($_GET['a'] ?? '');
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Toute écriture exige le jeton anti-falsification de la session
if ($methode === 'POST') {
  if (!origine_ok()) echec('Origine refusée.', 403);
  if (!hash_equals((string)$_SESSION['csrf'], (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) echec('Session expirée : rechargez la page.', 419);
} elseif ($methode !== 'GET') {
  echec('Méthode non autorisée.', 405);
}
$libres = ['session', 'connexion', 'activation', 'secours'];
if (!in_array($action, $libres, true) && !connecte()) echec('Connexion requise.', 401);

$lecture = ['session', 'tableau', 'compteurs', 'reglages', 'documents', 'document', 'numero', 'planning', 'clients', 'agents', 'demandes', 'candidatures', 'avis', 'export'];
if (in_array($action, $lecture, true) !== ($methode === 'GET')) echec('Méthode non autorisée pour cette action.', 405);

try {
  switch ($action) {
    /* ================= Connexion ================= */
    case 'session':
      repondre(['ok' => true] + etat_session());

    case 'connexion':
      $b = corps();
      $cle = 'connexion:' . empreinte_client();
      if (tentatives($cle, 900) >= 5 || tentatives('connexion:*', 900) >= 40) echec('Trop de tentatives. Réessayez dans 15 minutes.', 429);
      $st = db()->prepare('SELECT * FROM utilisateurs WHERE login = ?');
      $st->execute([texte($b['login'] ?? '', 60)]);
      $u = $st->fetch();
      $hash = $u ? (string)$u['hash'] : password_hash(random_bytes(8), PASSWORD_DEFAULT);
      if (!password_verify(chaine($b['motdepasse'] ?? ''), $hash) || !$u) {
        noter_tentative($cle);
        noter_tentative('connexion:*');
        usleep(700000);
        echec('Identifiant ou mot de passe incorrect.', 401);
      }
      if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
        db()->prepare('UPDATE utilisateurs SET hash = ? WHERE id = ?')->execute([password_hash(chaine($b['motdepasse']), PASSWORD_DEFAULT), $u['id']]);
      }
      db()->prepare('DELETE FROM tentatives WHERE k = ?')->execute([$cle]);
      ouvrir_session_utilisateur($u);
      repondre(['ok' => true] + etat_session());

    case 'activation':
      if (nb_utilisateurs() > 0) echec('Le compte administrateur existe déjà : connectez-vous.', 409);
      $cle = 'code:' . empreinte_client();
      if (tentatives($cle, 3600) >= 10) echec('Trop de tentatives. Réessayez dans une heure.', 429);
      $b = corps();
      if (!code_valide(chaine($b['code'] ?? ''))) {
        noter_tentative($cle);
        echec("Code d'activation incorrect.", 403);
      }
      $login = texte($b['login'] ?? '', 40);
      if (!preg_match('/^[\p{L}\p{N}._@-]{3,40}$/u', $login)) echec('Identifiant : 3 à 40 caractères (lettres, chiffres, point, tiret, @).');
      $mdp = chaine($b['motdepasse'] ?? '');
      verifier_nouveau_mdp($mdp);
      db()->prepare('INSERT INTO utilisateurs (login, hash, cree) VALUES (?, ?, ?)')->execute([$login, password_hash($mdp, PASSWORD_DEFAULT), maintenant()]);
      $st = db()->prepare('SELECT * FROM utilisateurs WHERE login = ?');
      $st->execute([$login]);
      ouvrir_session_utilisateur($st->fetch());
      importer_avis_google(); // reprend les avis déjà publiés (si Google répond)
      repondre(['ok' => true] + etat_session());

    case 'secours':
      $cle = 'code:' . empreinte_client();
      if (tentatives($cle, 3600) >= 10) echec('Trop de tentatives. Réessayez dans une heure.', 429);
      $b = corps();
      if (!code_valide(chaine($b['code'] ?? ''))) {
        noter_tentative($cle);
        echec('Code de secours incorrect.', 403);
      }
      $mdp = chaine($b['motdepasse'] ?? '');
      verifier_nouveau_mdp($mdp);
      $u = db()->query('SELECT * FROM utilisateurs ORDER BY id LIMIT 1')->fetch();
      if (!$u) echec("Aucun compte : utilisez l'activation.", 409);
      db()->prepare('UPDATE utilisateurs SET hash = ? WHERE id = ?')->execute([password_hash($mdp, PASSWORD_DEFAULT), $u['id']]);
      ouvrir_session_utilisateur($u);
      repondre(['ok' => true] + etat_session());

    case 'deconnexion':
      $_SESSION = [];
      session_regenerate_id(true);
      $_SESSION['csrf'] = bin2hex(random_bytes(32));
      repondre(['ok' => true] + etat_session());

    case 'motdepasse':
      $b = corps();
      $st = db()->prepare('SELECT * FROM utilisateurs WHERE id = ?');
      $st->execute([$_SESSION['uid']]);
      $u = $st->fetch();
      if (!$u || !password_verify(chaine($b['actuel'] ?? ''), (string)$u['hash'])) echec('Mot de passe actuel incorrect.', 403);
      $mdp = chaine($b['nouveau'] ?? '');
      verifier_nouveau_mdp($mdp);
      db()->prepare('UPDATE utilisateurs SET hash = ? WHERE id = ?')->execute([password_hash($mdp, PASSWORD_DEFAULT), $u['id']]);
      repondre(['ok' => true]);

    /* ================= Tableau de bord ================= */
    case 'compteurs':
      repondre(['ok' => true, 'compteurs' => compteurs()]);

    case 'tableau':
      repondre(['ok' => true, 'tableau' => tableau_de_bord()]);

    /* ================= Réglages ================= */
    case 'reglages':
      repondre(['ok' => true, 'reglages' => reglages()]);

    case 'reglages.enregistrer':
      $b = corps();
      $actuels = reglages();
      foreach (reglages_defaut() as $k => $defaut) {
        if (!array_key_exists($k, $b)) continue;
        $actuels[$k] = is_int($defaut) ? max(0, min(1000, (int)$b[$k])) : texte($b[$k], 2000);
      }
      db()->prepare('INSERT INTO reglages (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute(['entreprise', json_encode($actuels, JSON_UNESCAPED_UNICODE)]);
      repondre(['ok' => true, 'reglages' => $actuels]);

    /* ================= Devis et factures ================= */
    case 'documents':
      $type = type_document((string)($_GET['type'] ?? ''));
      $st = db()->prepare('SELECT id, type, numero, statut, client, total, date, echeance, maj FROM documents WHERE type = ? ORDER BY date DESC, id DESC');
      $st->execute([$type]);
      repondre(['ok' => true, 'documents' => $st->fetchAll()]);

    case 'document':
      $st = db()->prepare('SELECT * FROM documents WHERE id = ?');
      $st->execute([(int)($_GET['id'] ?? 0)]);
      $d = $st->fetch();
      if (!$d) echec('Document introuvable.', 404);
      $d['data'] = json_decode((string)$d['data'], true);
      repondre(['ok' => true, 'document' => $d]);

    case 'numero':
      repondre(['ok' => true, 'numero' => numero_suivant(type_document((string)($_GET['type'] ?? '')))]);

    case 'document.enregistrer':
      $b = corps();
      $type = type_document(chaine($b['type'] ?? ''));
      $data = $b['data'] ?? null;
      if (!is_array($data)) echec('Document vide.');
      $id = (int)($b['id'] ?? 0);
      $numero = texte($data['numero'] ?? '', 40);
      if ($numero === '') $numero = numero_suivant($type);
      $data['numero'] = $numero;
      $statut = in_array($b['statut'] ?? '', STATUTS[$type], true) ? (string)$b['statut'] : 'brouillon';
      $json = json_encode($data, JSON_UNESCAPED_UNICODE);
      if ($json === false || strlen($json) > 400000) echec('Document trop volumineux.');
      $valeurs = [$numero, $statut, texte($data['client']['nom'] ?? '', 160), total_document($data), fr_vers_iso((string)($data['date'] ?? '')), fr_vers_iso((string)($data['echeance'] ?? '')), $json, maintenant()];
      try {
        if ($id > 0) {
          $st = db()->prepare('UPDATE documents SET numero = ?, statut = ?, client = ?, total = ?, date = ?, echeance = ?, data = ?, maj = ? WHERE id = ? AND type = ?');
          $st->execute(array_merge($valeurs, [$id, $type]));
          if ($st->rowCount() === 0) echec('Document introuvable.', 404);
        } else {
          db()->prepare('INSERT INTO documents (numero, statut, client, total, date, echeance, data, maj, type, cree) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute(array_merge($valeurs, [$type, maintenant()]));
          $id = (int)db()->lastInsertId();
        }
      } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'UNIQUE') !== false) echec("Le numéro $numero existe déjà.", 409);
        throw $e;
      }
      repondre(['ok' => true, 'id' => $id, 'numero' => $numero, 'total' => total_document($data), 'statut' => $statut]);

    case 'document.statut':
      $b = corps();
      $st = db()->prepare('SELECT type FROM documents WHERE id = ?');
      $st->execute([(int)($b['id'] ?? 0)]);
      $type = (string)$st->fetchColumn();
      if ($type === '') echec('Document introuvable.', 404);
      if (!in_array($b['statut'] ?? '', STATUTS[$type], true)) echec('Statut inconnu.');
      db()->prepare('UPDATE documents SET statut = ?, maj = ? WHERE id = ?')->execute([$b['statut'], maintenant(), (int)$b['id']]);
      repondre(['ok' => true]);

    case 'document.supprimer':
      $b = corps();
      $st = db()->prepare('SELECT type, statut FROM documents WHERE id = ?');
      $st->execute([(int)($b['id'] ?? 0)]);
      $d = $st->fetch();
      if (!$d) echec('Document introuvable.', 404);
      if ($d['type'] === 'facture' && $d['statut'] !== 'brouillon') echec('Une facture envoyée ne se supprime pas (obligation légale) : passez-la plutôt en « Annulée ».', 409);
      db()->prepare('DELETE FROM documents WHERE id = ?')->execute([(int)$b['id']]);
      repondre(['ok' => true]);

    /* ================= Planning ================= */
    case 'planning':
      $mois = mois_valide((string)($_GET['mois'] ?? ''));
      $st = db()->prepare('SELECT data FROM plannings WHERE mois = ?');
      $st->execute([$mois]);
      $data = json_decode((string)$st->fetchColumn(), true);
      repondre(['ok' => true, 'mois' => $mois, 'planning' => is_array($data) ? $data : null]);

    case 'planning.enregistrer':
      $b = corps();
      $mois = mois_valide(chaine($b['mois'] ?? ''));
      $json = json_encode($b['planning'] ?? [], JSON_UNESCAPED_UNICODE);
      if ($json === false || strlen($json) > 400000) echec('Planning trop volumineux.');
      db()->prepare('INSERT INTO plannings (mois, data, maj) VALUES (?, ?, ?) ON CONFLICT(mois) DO UPDATE SET data = excluded.data, maj = excluded.maj')->execute([$mois, $json, maintenant()]);
      repondre(['ok' => true]);

    /* ================= Clients et agents ================= */
    case 'clients':
      repondre(['ok' => true, 'clients' => db()->query('SELECT * FROM clients ORDER BY nom COLLATE NOCASE')->fetchAll()]);

    case 'client.enregistrer':
      $b = corps();
      $v = [texte($b['nom'] ?? '', 160), texte($b['adresse'] ?? '', 600), texte($b['tel'] ?? '', 60), texte($b['email'] ?? '', 160), texte($b['notes'] ?? '', 2000)];
      if ($v[0] === '') echec('Le nom du client est obligatoire.');
      repondre(['ok' => true, 'id' => enregistrer_ligne('clients', ['nom', 'adresse', 'tel', 'email', 'notes'], $v, (int)($b['id'] ?? 0))]);

    case 'client.supprimer':
      supprimer_ligne('clients', (int)(corps()['id'] ?? 0));

    case 'agents':
      repondre(['ok' => true, 'agents' => db()->query('SELECT * FROM agents ORDER BY actif DESC, nom COLLATE NOCASE')->fetchAll()]);

    case 'agent.enregistrer':
      $b = corps();
      $v = [texte($b['nom'] ?? '', 120), texte($b['poste'] ?? 'ADS', 60), texte($b['tel'] ?? '', 60), texte($b['carte'] ?? '', 80), texte($b['validite'] ?? '', 10), texte($b['notes'] ?? '', 2000), empty($b['actif']) ? 0 : 1];
      if ($v[0] === '') echec("Le nom de l'agent est obligatoire.");
      if ($v[4] !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $v[4])) echec('Date de validité invalide.');
      repondre(['ok' => true, 'id' => enregistrer_ligne('agents', ['nom', 'poste', 'tel', 'carte', 'validite', 'notes', 'actif'], $v, (int)($b['id'] ?? 0))]);

    case 'agent.supprimer':
      supprimer_ligne('agents', (int)(corps()['id'] ?? 0));

    /* ================= Demandes, candidatures, avis ================= */
    case 'demandes':
    case 'candidatures':
      $table = $action;
      $lignes = db()->query("SELECT * FROM $table ORDER BY id DESC LIMIT 1000")->fetchAll();
      foreach ($lignes as &$l) $l['data'] = json_decode((string)$l['data'], true) ?: [];
      repondre(['ok' => true, $table => $lignes]);

    case 'demande.statut':
    case 'candidature.statut':
    case 'avis.statut':
      $b = corps();
      [$type] = explode('.', $action);
      $table = ['demande' => 'demandes', 'candidature' => 'candidatures', 'avis' => 'avis'][$type];
      if (!in_array($b['statut'] ?? '', STATUTS[$type], true)) echec('Statut inconnu.');
      db()->prepare("UPDATE $table SET statut = ? WHERE id = ?")->execute([$b['statut'], (int)($b['id'] ?? 0)]);
      repondre(['ok' => true]);

    case 'demande.supprimer':
      supprimer_ligne('demandes', (int)(corps()['id'] ?? 0));

    case 'candidature.supprimer':
      supprimer_ligne('candidatures', (int)(corps()['id'] ?? 0));

    case 'avis':
      repondre(['ok' => true, 'avis' => db()->query('SELECT * FROM avis ORDER BY id DESC')->fetchAll()]);

    case 'avis.supprimer':
      supprimer_ligne('avis', (int)(corps()['id'] ?? 0));

    case 'avis.importer':
      $n = importer_avis_google();
      if ($n < 0) echec('Google Sheets ne répond pas pour le moment. Réessayez dans un instant.', 502);
      repondre(['ok' => true, 'importes' => $n]);

    /* ================= Import / sauvegarde ================= */
    case 'import':
      repondre(['ok' => true, 'resultat' => importer_fichier(corps())]);

    case 'export':
      $export = ['format' => 'bda-admin-sauvegarde', 'version' => 1, 'date' => maintenant(), 'reglages' => reglages()];
      foreach (['documents', 'plannings', 'clients', 'agents', 'demandes', 'candidatures', 'avis', 'visites'] as $t) {
        $export[$t] = db()->query("SELECT * FROM $t")->fetchAll();
      }
      header('Content-Disposition: attachment; filename="bda-sauvegarde-' . date('Y-m-d') . '.json"');
      repondre($export);

    default:
      echec('Action inconnue.', 404);
  }
} catch (Throwable $e) {
  error_log('[BDA admin] ' . $e->getMessage());
  echec('Erreur du serveur. Réessayez dans un instant.', 500);
}

/* =========================================================
   Fonctions de l'API
   ========================================================= */
function type_document(string $t): string
{
  if (!isset(STATUTS[$t]) || !in_array($t, ['devis', 'facture'], true)) echec('Type de document inconnu.');
  return $t;
}
function mois_valide(string $m): string
{
  if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $m)) echec('Mois invalide.');
  return $m;
}
function total_document(array $data): float
{
  $total = 0.0;
  foreach (($data['lignes'] ?? []) as $l) {
    if (!is_array($l)) continue;
    $total += round((float)($l['qte'] ?? 0) * (float)($l['pu'] ?? 0), 2);
  }
  return round($total, 2);
}
function numero_suivant(string $type): string
{
  $r = reglages();
  $prefixe = str_replace('{AAAA}', date('Y'), (string)($type === 'facture' ? $r['prefixeFacture'] : $r['prefixeDevis']));
  $st = db()->prepare('SELECT numero FROM documents WHERE type = ? AND substr(numero, 1, ?) = ?');
  $st->execute([$type, strlen($prefixe), $prefixe]);
  $max = 0;
  foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $n) {
    $suite = substr((string)$n, strlen($prefixe));
    if ($suite !== '' && ctype_digit($suite)) $max = max($max, (int)$suite);
  }
  return $prefixe . str_pad((string)($max + 1), 3, '0', STR_PAD_LEFT);
}
function enregistrer_ligne(string $table, array $colonnes, array $valeurs, int $id): int
{
  if ($id > 0) {
    $set = implode(', ', array_map(fn($c) => "$c = ?", $colonnes));
    db()->prepare("UPDATE $table SET $set WHERE id = ?")->execute(array_merge($valeurs, [$id]));
    return $id;
  }
  $cols = implode(', ', $colonnes) . ', cree';
  $marques = implode(', ', array_fill(0, count($colonnes) + 1, '?'));
  db()->prepare("INSERT INTO $table ($cols) VALUES ($marques)")->execute(array_merge($valeurs, [maintenant()]));
  return (int)db()->lastInsertId();
}
function supprimer_ligne(string $table, int $id): void
{
  db()->prepare("DELETE FROM $table WHERE id = ?")->execute([$id]);
  repondre(['ok' => true]);
}
function compteurs(): array
{
  $q = fn(string $sql) => (int)db()->query($sql)->fetchColumn();
  $retards = db()->prepare("SELECT COUNT(*) FROM documents WHERE type = 'facture' AND statut = 'envoyee' AND echeance <> '' AND echeance < ?");
  $retards->execute([date('Y-m-d')]);
  return [
    'demandes' => $q("SELECT COUNT(*) FROM demandes WHERE statut = 'nouvelle'"),
    'candidatures' => $q("SELECT COUNT(*) FROM candidatures WHERE statut = 'nouvelle'"),
    'avis' => $q("SELECT COUNT(*) FROM avis WHERE statut = 'attente'"),
    'retards' => (int)$retards->fetchColumn(),
  ];
}
function tableau_de_bord(): array
{
  $db = db();
  $un = function (string $sql, array $p = []) use ($db) {
    $st = $db->prepare($sql);
    $st->execute($p);
    return $st->fetch() ?: [];
  };
  $tous = function (string $sql, array $p = []) use ($db) {
    $st = $db->prepare($sql);
    $st->execute($p);
    return $st->fetchAll();
  };
  $auj = date('Y-m-d');
  $factures = "type = 'facture' AND statut IN ('envoyee', 'payee')";
  $debut12 = date('Y-m-01', strtotime('first day of -11 months'));
  $debut30 = date('Y-m-d', strtotime('-29 days'));

  $agentsAlerte = $tous("SELECT id, nom, validite FROM agents WHERE actif = 1 AND validite <> '' AND validite <= ? ORDER BY validite", [date('Y-m-d', strtotime('+90 days'))]);
  $demandes = $tous('SELECT id, recu, statut, data FROM demandes ORDER BY id DESC LIMIT 5');
  foreach ($demandes as &$d) $d['data'] = json_decode((string)$d['data'], true) ?: [];

  return [
    'compteurs' => compteurs(),
    'caMois' => (float)($un("SELECT COALESCE(SUM(total), 0) s FROM documents WHERE $factures AND substr(date, 1, 7) = ?", [date('Y-m')])['s'] ?? 0),
    'caAnnee' => (float)($un("SELECT COALESCE(SUM(total), 0) s FROM documents WHERE $factures AND substr(date, 1, 4) = ?", [date('Y')])['s'] ?? 0),
    'aEncaisser' => $un("SELECT COUNT(*) n, COALESCE(SUM(total), 0) s FROM documents WHERE type = 'facture' AND statut = 'envoyee'"),
    'enRetard' => $un("SELECT COUNT(*) n, COALESCE(SUM(total), 0) s FROM documents WHERE type = 'facture' AND statut = 'envoyee' AND echeance <> '' AND echeance < ?", [$auj]),
    'devisAttente' => $un("SELECT COUNT(*) n, COALESCE(SUM(total), 0) s FROM documents WHERE type = 'devis' AND statut = 'envoye'"),
    'noteMoyenne' => $un("SELECT COUNT(*) n, COALESCE(AVG(note), 0) m FROM avis WHERE statut = 'publie'"),
    'ca12' => $tous("SELECT substr(date, 1, 7) mois, SUM(total) total FROM documents WHERE $factures AND date >= ? GROUP BY mois ORDER BY mois", [$debut12]),
    'visites' => $tous('SELECT jour, SUM(n) n FROM visites WHERE jour >= ? GROUP BY jour ORDER BY jour', [$debut30]),
    'pages' => $tous('SELECT page, SUM(n) n FROM visites WHERE jour >= ? GROUP BY page ORDER BY n DESC LIMIT 6', [$debut30]),
    'demandes' => $demandes,
    'aRelancer' => $tous("SELECT id, numero, client, total, echeance FROM documents WHERE type = 'facture' AND statut = 'envoyee' ORDER BY echeance LIMIT 5"),
    'agentsAlerte' => $agentsAlerte,
    'aujourdhui' => $auj,
  ];
}
// Fichier de démarrage préparé sur l'ordinateur (réglages privés, clients, documents)
function importer_fichier(array $f): array
{
  if (($f['format'] ?? '') !== 'bda-admin-import') echec("Ce fichier n'est pas un fichier d'import BDA.");
  $res = ['reglages' => 0, 'clients' => 0, 'documents' => 0, 'agents' => 0];
  if (is_array($f['reglages'] ?? null)) {
    $r = reglages();
    foreach (reglages_defaut() as $k => $defaut) {
      if (array_key_exists($k, $f['reglages'])) {
        $r[$k] = is_int($defaut) ? (int)$f['reglages'][$k] : texte($f['reglages'][$k], 2000);
        $res['reglages']++;
      }
    }
    db()->prepare('INSERT INTO reglages (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute(['entreprise', json_encode($r, JSON_UNESCAPED_UNICODE)]);
  }
  foreach (($f['clients'] ?? []) as $c) {
    $nom = texte($c['nom'] ?? '', 160);
    if ($nom === '') continue;
    $st = db()->prepare('SELECT COUNT(*) FROM clients WHERE nom = ?');
    $st->execute([$nom]);
    if ((int)$st->fetchColumn() > 0) continue;
    enregistrer_ligne('clients', ['nom', 'adresse', 'tel', 'email', 'notes'], [$nom, texte($c['adresse'] ?? '', 600), texte($c['tel'] ?? '', 60), texte($c['email'] ?? '', 160), texte($c['notes'] ?? '', 2000)], 0);
    $res['clients']++;
  }
  foreach (($f['agents'] ?? []) as $a) {
    $nom = texte($a['nom'] ?? '', 120);
    if ($nom === '') continue;
    enregistrer_ligne('agents', ['nom', 'poste', 'tel', 'carte', 'validite', 'notes', 'actif'], [$nom, texte($a['poste'] ?? 'ADS', 60), texte($a['tel'] ?? '', 60), texte($a['carte'] ?? '', 80), texte($a['validite'] ?? '', 10), texte($a['notes'] ?? '', 2000), 1], 0);
    $res['agents']++;
  }
  foreach (($f['documents'] ?? []) as $d) {
    $type = (string)($d['type'] ?? '');
    if (!in_array($type, ['devis', 'facture'], true) || !is_array($d['data'] ?? null)) continue;
    $data = $d['data'];
    $numero = texte($data['numero'] ?? '', 40) ?: numero_suivant($type);
    $data['numero'] = $numero;
    $statut = in_array($d['statut'] ?? '', STATUTS[$type], true) ? $d['statut'] : 'brouillon';
    try {
      db()->prepare('INSERT INTO documents (type, numero, statut, client, total, date, echeance, data, cree, maj) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([$type, $numero, $statut, texte($data['client']['nom'] ?? '', 160), total_document($data), fr_vers_iso((string)($data['date'] ?? '')), fr_vers_iso((string)($data['echeance'] ?? '')), json_encode($data, JSON_UNESCAPED_UNICODE), maintenant(), maintenant()]);
      $res['documents']++;
    } catch (PDOException $e) {
      // numéro déjà présent : on garde l'existant
    }
  }
  return $res;
}
