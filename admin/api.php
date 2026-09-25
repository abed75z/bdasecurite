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
// L'administrateur connecté garde l'accès au site pendant la maintenance
if (connecte() && !apercu_valide()) poser_apercu();

$lecture = ['session', 'accueil', 'compteurs', 'site', 'creations', 'creation', 'agent.docs', 'agent.doc', 'reservations', 'vtc.tarifs', 'reglages', 'documents', 'document', 'numero', 'planning', 'clients', 'agents', 'demandes', 'candidatures', 'avis', 'export'];
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
      poser_apercu(false);
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

    case 'accueil':
      repondre(['ok' => true, 'accueil' => accueil()]);

    /* ================= Réglages ================= */
    case 'reglages':
      repondre(['ok' => true, 'reglages' => reglages()]);

    case 'reglages.enregistrer':
      $b = corps();
      $actuels = reglages();
      foreach (reglages_defaut() as $k => $defaut) {
        if (!array_key_exists($k, $b)) continue;
        $actuels[$k] = is_float($defaut) ? max(0.0, min(100.0, round((float)str_replace(',', '.', (string)$b[$k]), 2))) : (is_int($defaut) ? max(0, min(1000, (int)$b[$k])) : texte($b[$k], 2000));
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

    /* ================= Cartes agents et flyers ================= */
    case 'creations':
      $st = db()->prepare('SELECT id, type, titre, data, maj FROM creations WHERE type = ? ORDER BY maj DESC');
      $st->execute([type_creation((string)($_GET['type'] ?? ''))]);
      $lignes = $st->fetchAll();
      foreach ($lignes as &$l) $l['data'] = json_decode((string)$l['data'], true) ?: [];
      repondre(['ok' => true, 'creations' => $lignes]);

    case 'creation':
      $st = db()->prepare('SELECT * FROM creations WHERE id = ?');
      $st->execute([(int)($_GET['id'] ?? 0)]);
      $c = $st->fetch();
      if (!$c) echec('Élément introuvable.', 404);
      $c['data'] = json_decode((string)$c['data'], true) ?: [];
      repondre(['ok' => true, 'creation' => $c]);

    case 'creation.enregistrer':
      $b = corps();
      $type = type_creation(chaine($b['type'] ?? ''));
      if (!is_array($b['data'] ?? null)) echec('Contenu vide.');
      $json = json_encode($b['data'], JSON_UNESCAPED_UNICODE);
      if ($json === false || strlen($json) > 1200000) echec('Trop volumineux : choisissez une photo plus légère.');
      $titre = texte($b['titre'] ?? '', 120);
      $id = (int)($b['id'] ?? 0);
      if ($id > 0) {
        $st = db()->prepare('UPDATE creations SET titre = ?, data = ?, maj = ? WHERE id = ? AND type = ?');
        $st->execute([$titre, $json, maintenant(), $id, $type]);
        if ($st->rowCount() === 0) echec('Élément introuvable.', 404);
      } else {
        db()->prepare('INSERT INTO creations (type, titre, data, cree, maj) VALUES (?, ?, ?, ?, ?)')->execute([$type, $titre, $json, maintenant(), maintenant()]);
        $id = (int)db()->lastInsertId();
      }
      repondre(['ok' => true, 'id' => $id]);

    case 'creation.supprimer':
      supprimer_ligne('creations', (int)(corps()['id'] ?? 0));

    /* ================= VTC : réservations et tarifs ================= */
    case 'reservations':
      $lignes = db()->query('SELECT id, ref, recu, statut, date_course, prix, data FROM reservations ORDER BY date_course DESC LIMIT 1000')->fetchAll();
      foreach ($lignes as &$l) $l['data'] = json_decode((string)$l['data'], true) ?: [];
      repondre(['ok' => true, 'reservations' => $lignes]);

    case 'reservation.modifier':
      $b = corps();
      $st = db()->prepare('SELECT * FROM reservations WHERE id = ?');
      $st->execute([(int)($b['id'] ?? 0)]);
      $r = $st->fetch();
      if (!$r) echec('Réservation introuvable.', 404);
      $d = json_decode((string)$r['data'], true) ?: [];
      $statut = (string)$r['statut'];
      if (isset($b['statut'])) {
        if (!in_array($b['statut'], STATUTS['reservation'], true)) echec('Statut inconnu.');
        $statut = (string)$b['statut'];
      }
      $prix = isset($b['prix']) ? max(0, min(100000, round((float)$b['prix'], 2))) : (float)$r['prix'];
      if (array_key_exists('chauffeur', $b)) $d['chauffeur'] = texte($b['chauffeur'], 80);
      if (array_key_exists('note', $b)) $d['note'] = texte($b['note'], 1000);
      db()->prepare('UPDATE reservations SET statut = ?, prix = ?, data = ? WHERE id = ?')->execute([$statut, $prix, json_encode($d, JSON_UNESCAPED_UNICODE), (int)$r['id']]);
      // Le client est prévenu par email quand la course est confirmée ou annulée
      if ($statut !== $r['statut'] && in_array($statut, ['confirmee', 'annulee'], true) && !empty($d['email'])) {
        $quand = date('d/m/Y', strtotime($d['date'])) . ' à ' . $d['heure'];
        $txt = $statut === 'confirmee'
          ? "Bonjour {$d['nom']},\n\nVotre course du $quand est confirmée" . (!empty($d['chauffeur']) ? " : votre chauffeur sera {$d['chauffeur']}" : '') . ".\nPrix : " . number_format($prix, 2, ',', ' ') . " €\n\nSuivre votre réservation : https://bdasecurite.com/reserver#suivi={$r['jeton']}\n\nBDA Sécurité & VTC Premium — 06 11 67 86 25"
          : "Bonjour {$d['nom']},\n\nVotre réservation du $quand a été annulée. Pour toute question : 06 11 67 86 25.\n\nBDA Sécurité & VTC Premium";
        envoyer_mail(($statut === 'confirmee' ? 'Course confirmée' : 'Réservation annulée') . " — {$r['ref']}", $txt, BDA_EMAIL, $d['email']);
      }
      repondre(['ok' => true]);

    case 'reservation.supprimer':
      supprimer_ligne('reservations', (int)(corps()['id'] ?? 0));

    case 'vtc.tarifs':
      repondre(['ok' => true, 'tarifs' => tarifs_vtc()]);

    case 'vtc.tarifs.enregistrer':
      $b = corps();
      $n = fn($v, float $max = 10000) => max(0, min($max, round((float)$v, 2)));
      $t = tarifs_vtc();
      foreach (['berline', 'van'] as $k) {
        foreach (['prise', 'km', 'min', 'minimum', 'heure'] as $c) if (isset($b[$k][$c])) $t[$k][$c] = $n($b[$k][$c]);
        foreach (['places', 'bagages'] as $c) if (isset($b[$k][$c])) $t[$k][$c] = max(1, min(8, (int)$b[$k][$c]));
      }
      foreach (['nuit' => 200, 'minHeures' => 24, 'delai' => 72, 'siege' => 500, 'pancarte' => 500] as $k => $max) if (isset($b[$k])) $t[$k] = $n($b[$k], $max);
      if (isset($b['afficherPrix'])) $t['afficherPrix'] = !empty($b['afficherPrix']);
      if (isset($b['ouvert'])) $t['ouvert'] = !empty($b['ouvert']);
      if (is_array($b['forfaits'] ?? null)) {
        $t['forfaits'] = [];
        foreach (array_slice($b['forfaits'], 0, 10) as $f) {
          if (!is_array($f) || !in_array($f['code'] ?? '', ['CDG', 'ORY', 'BVA'], true)) continue;
          $t['forfaits'][] = ['code' => $f['code'], 'nom' => texte($f['nom'] ?? '', 80), 'berline' => $n($f['berline'] ?? 0), 'van' => $n($f['van'] ?? 0)];
        }
      }
      db()->prepare('INSERT INTO reglages (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute(['vtc', json_encode($t, JSON_UNESCAPED_UNICODE)]);
      repondre(['ok' => true, 'tarifs' => $t]);

    /* ================= Contrôle du site ================= */
    case 'site':
      repondre(['ok' => true, 'site' => etat_site_admin()]);

    case 'site.enregistrer':
      $b = corps();
      $s = site_reglages();
      foreach (['devis', 'recrutement', 'avis'] as $k) if (isset($b[$k])) $s[$k] = !empty($b[$k]);
      if (is_array($b['bandeau'] ?? null)) {
        $lien = texte($b['bandeau']['lien'] ?? '', 300);
        if ($lien !== '' && !preg_match('#^(https://|/|tel:|mailto:)#', $lien)) $lien = 'https://' . ltrim($lien, '/');
        $s['bandeau'] = [
          'actif' => !empty($b['bandeau']['actif']), 'texte' => texte($b['bandeau']['texte'] ?? '', 160),
          'lien' => $lien, 'libelleLien' => texte($b['bandeau']['libelleLien'] ?? '', 40),
        ];
      }
      db()->prepare('INSERT INTO reglages (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute(['site', json_encode($s, JSON_UNESCAPED_UNICODE)]);
      if (isset($b['vtc'])) {
        $t = tarifs_vtc();
        $t['ouvert'] = !empty($b['vtc']);
        db()->prepare('INSERT INTO reglages (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute(['vtc', json_encode($t, JSON_UNESCAPED_UNICODE)]);
      }
      repondre(['ok' => true, 'site' => etat_site_admin()]);

    case 'site.horsligne':
      $b = corps();
      if (!empty($b['actif'])) {
        $etat = ['depuis' => maintenant(), 'message' => texte($b['message'] ?? '', 500), 'retour' => texte($b['retour'] ?? '', 80)];
        if (@file_put_contents(fichier_hors_ligne(), json_encode($etat, JSON_UNESCAPED_UNICODE), LOCK_EX) === false) echec("Impossible de mettre le site hors ligne (écriture refusée).", 500);
        poser_apercu();
      } elseif (is_file(fichier_hors_ligne()) && !@unlink(fichier_hors_ligne())) {
        echec('Impossible de remettre le site en ligne : réessayez.', 500);
      }
      repondre(['ok' => true, 'site' => etat_site_admin()]);

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
      $agents = db()->query('SELECT * FROM agents ORDER BY actif DESC, nom COLLATE NOCASE')->fetchAll();
      $docs = [];
      foreach (db()->query('SELECT agent_id, type, COUNT(*) n FROM agent_docs GROUP BY agent_id, type') as $l) $docs[(int)$l['agent_id']][$l['type']] = (int)$l['n'];
      foreach ($agents as &$a) $a['docs'] = (object)($docs[(int)$a['id']] ?? []);
      repondre(['ok' => true, 'agents' => $agents]);

    case 'agent.enregistrer':
      $b = corps();
      $v = [texte($b['nom'] ?? '', 120), texte($b['poste'] ?? 'ADS', 60), texte($b['tel'] ?? '', 60), texte($b['carte'] ?? '', 80), texte($b['validite'] ?? '', 10), texte($b['notes'] ?? '', 2000), empty($b['actif']) ? 0 : 1, ($b['categorie'] ?? '') === 'secondaire' ? 'secondaire' : 'primaire'];
      if ($v[0] === '') echec("Le nom de l'agent est obligatoire.");
      if ($v[4] !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $v[4])) echec('Date de validité invalide.');
      repondre(['ok' => true, 'id' => enregistrer_ligne('agents', ['nom', 'poste', 'tel', 'carte', 'validite', 'notes', 'actif', 'categorie'], $v, (int)($b['id'] ?? 0))]);

    case 'agent.supprimer':
      $id = (int)(corps()['id'] ?? 0);
      $st = db()->prepare('SELECT fichier FROM agent_docs WHERE agent_id = ?');
      $st->execute([$id]);
      foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $f) @unlink(dossier_docs() . '/' . basename((string)$f));
      db()->prepare('DELETE FROM agent_docs WHERE agent_id = ?')->execute([$id]);
      supprimer_ligne('agents', $id);

    /* ----- Documents des agents (pièces d'identité, cartes pro…) : fichiers privés, hors du site ----- */
    case 'agent.docs':
      $st = db()->prepare('SELECT id, type, nom, mime, taille, ajoute FROM agent_docs WHERE agent_id = ? ORDER BY type, nom');
      $st->execute([(int)($_GET['agent'] ?? 0)]);
      repondre(['ok' => true, 'docs' => $st->fetchAll(), 'limite' => limite_envoi()]);

    case 'agent.doc':
      $st = db()->prepare('SELECT * FROM agent_docs WHERE id = ?');
      $st->execute([(int)($_GET['id'] ?? 0)]);
      $doc = $st->fetch();
      $chemin = $doc ? dossier_docs() . '/' . basename((string)$doc['fichier']) : '';
      if (!$doc || !is_file($chemin)) echec('Document introuvable.', 404);
      header('Content-Type: ' . $doc['mime']);
      header('Content-Length: ' . filesize($chemin));
      header('Content-Disposition: inline; filename="' . preg_replace('/[^\w .()-]+/u', '_', (string)$doc['nom']) . '"');
      header('Cache-Control: private, no-store');
      header("Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
      readfile($chemin);
      exit;

    case 'agent.doc.ajouter':
      $agent = (int)($_POST['agent'] ?? 0);
      $st = db()->prepare('SELECT COUNT(*) FROM agents WHERE id = ?');
      $st->execute([$agent]);
      if (!(int)$st->fetchColumn()) echec('Agent introuvable.', 404);
      $f = $_FILES['fichier'] ?? null;
      if (!is_array($f) || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file((string)$f['tmp_name'])) {
        $code = is_array($f) ? (int)$f['error'] : 0;
        echec(in_array($code, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? "Fichier trop lourd pour l'hébergement." : "Le fichier n'a pas été reçu.", 400);
      }
      if ((int)$f['size'] > 15 * 1024 * 1024) echec('Fichier trop lourd (15 Mo maximum).');
      $mime = type_fichier((string)$f['tmp_name']);
      if ($mime === '') echec('Format non accepté : PDF, JPG, PNG ou WEBP uniquement.');
      $type = in_array($_POST['type'] ?? '', DOC_TYPES, true) ? (string)$_POST['type'] : 'autre';
      $nom = texte($_POST['nom'] ?? $f['name'] ?? 'document', 160);
      $existe = db()->prepare('SELECT COUNT(*) FROM agent_docs WHERE agent_id = ? AND nom = ?');
      $existe->execute([$agent, $nom]);
      if ((int)$existe->fetchColumn()) repondre(['ok' => true, 'doublon' => true]);
      $fichier = bin2hex(random_bytes(16)) . '.bin';
      if (!move_uploaded_file((string)$f['tmp_name'], dossier_docs() . '/' . $fichier)) echec("Enregistrement du fichier impossible.", 500);
      db()->prepare('INSERT INTO agent_docs (agent_id, type, nom, fichier, mime, taille, ajoute) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute([$agent, $type, $nom, $fichier, $mime, (int)$f['size'], maintenant()]);
      repondre(['ok' => true, 'id' => (int)db()->lastInsertId()]);

    case 'agent.doc.modifier':
      $b = corps();
      if (!in_array($b['type'] ?? '', DOC_TYPES, true)) echec('Type de document inconnu.');
      db()->prepare('UPDATE agent_docs SET type = ? WHERE id = ?')->execute([$b['type'], (int)($b['id'] ?? 0)]);
      repondre(['ok' => true]);

    case 'agent.doc.supprimer':
      $id = (int)(corps()['id'] ?? 0);
      $st = db()->prepare('SELECT fichier FROM agent_docs WHERE id = ?');
      $st->execute([$id]);
      $f = (string)$st->fetchColumn();
      if ($f !== '') @unlink(dossier_docs() . '/' . basename($f));
      supprimer_ligne('agent_docs', $id);

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
      foreach (['documents', 'plannings', 'clients', 'agents', 'agent_docs', 'reservations', 'creations', 'demandes', 'candidatures', 'avis'] as $t) {
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
function type_creation(string $t): string
{
  if (!in_array($t, ['carte', 'flyer', 'visite'], true)) echec('Type inconnu.');
  return $t;
}
function mois_valide(string $m): string
{
  if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $m)) echec('Mois invalide.');
  return $m;
}
// Montant du document, TVA comprise (taux « tva » du document, en % ; absent ou 0 = TVA non applicable)
function total_document(array $data): float
{
  $ht = 0.0;
  foreach (($data['lignes'] ?? []) as $l) {
    if (!is_array($l)) continue;
    $ht += round((float)($l['qte'] ?? 0) * (float)($l['pu'] ?? 0), 2);
  }
  $ht = round($ht, 2);
  $taux = max(0.0, min(100.0, (float)($data['tva'] ?? 0)));
  return round($ht + round($ht * $taux / 100, 2), 2);
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
// État complet du site pour la page « Contrôle du site »
function etat_site_admin(): array
{
  return site_reglages() + ['vtc' => !empty(tarifs_vtc()['ouvert']), 'horsLigne' => site_hors_ligne()];
}
function compteurs(): array
{
  $q = fn(string $sql) => (int)db()->query($sql)->fetchColumn();
  $retards = db()->prepare("SELECT COUNT(*) FROM documents WHERE type = 'facture' AND statut = 'envoyee' AND echeance <> '' AND echeance < ?");
  $retards->execute([date('Y-m-d')]);
  return [
    'demandes' => $q("SELECT COUNT(*) FROM demandes WHERE statut = 'nouvelle'"),
    'reservations' => $q("SELECT COUNT(*) FROM reservations WHERE statut = 'attente'"),
    'candidatures' => $q("SELECT COUNT(*) FROM candidatures WHERE statut = 'nouvelle'"),
    'avis' => $q("SELECT COUNT(*) FROM avis WHERE statut = 'attente'"),
    'retards' => (int)$retards->fetchColumn(),
    'horsLigne' => site_hors_ligne() ? 1 : 0,
  ];
}
// Page d'accueil : ce qui attend une action, et les derniers éléments modifiés (aucun montant)
function accueil(): array
{
  $db = db();
  $tous = function (string $sql, array $p = []) use ($db) {
    $st = $db->prepare($sql);
    $st->execute($p);
    return $st->fetchAll();
  };
  $recents = array_merge(
    $tous("SELECT id, type, numero AS titre, client AS sous, statut, maj FROM documents ORDER BY maj DESC LIMIT 6"),
    $tous("SELECT id, type, titre, '' AS sous, '' AS statut, maj FROM creations ORDER BY maj DESC LIMIT 6")
  );
  usort($recents, fn($a, $b) => strcmp((string)$b['maj'], (string)$a['maj']));
  return [
    'compteurs' => compteurs(),
    'agentsAlerte' => $tous("SELECT id, nom, validite FROM agents WHERE actif = 1 AND validite <> '' AND validite <= ? ORDER BY validite", [date('Y-m-d', strtotime('+90 days'))]),
    'recents' => array_slice($recents, 0, 7),
    'installation' => reglages()['iban'] === '',
    'aujourdhui' => date('Y-m-d'),
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
        $r[$k] = is_float($defaut) ? max(0.0, min(100.0, (float)$f['reglages'][$k])) : (is_int($defaut) ? (int)$f['reglages'][$k] : texte($f['reglages'][$k], 2000));
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
// Dossier privé des documents des agents (dans le stockage hors du site)
function dossier_docs(): string
{
  $dir = dossier_donnees() . '/agents';
  if (!is_dir($dir) && !@mkdir($dir, 0700, true)) echec('Espace de stockage indisponible.', 500);
  return $dir;
}
// Vrai format du fichier, lu dans son contenu (pas dans son nom)
function type_fichier(string $chemin): string
{
  $debut = (string)file_get_contents($chemin, false, null, 0, 16);
  if (strncmp($debut, '%PDF', 4) === 0) return 'application/pdf';
  if (strncmp($debut, "\x89PNG", 4) === 0) return 'image/png';
  if (strncmp($debut, "\xFF\xD8\xFF", 3) === 0) return 'image/jpeg';
  if (strncmp($debut, 'RIFF', 4) === 0 && substr($debut, 8, 4) === 'WEBP') return 'image/webp';
  return '';
}
// Taille maximale d'un envoi acceptée par l'hébergement (en octets)
function limite_envoi(): int
{
  $octets = function (string $v): int {
    $n = (int)$v;
    $u = strtolower(substr(trim($v), -1));
    return $u === 'g' ? $n * 1073741824 : ($u === 'm' ? $n * 1048576 : ($u === 'k' ? $n * 1024 : $n));
  };
  return min($octets((string)ini_get('upload_max_filesize')), $octets((string)ini_get('post_max_size'))) ?: 2097152;
}
