<?php
/* =========================================================
   ESPACE ADMIN BDA — API de la page « Appli BDA »
   (courses en direct, réservations à attribuer, chauffeurs, clients, prix et réglages de l'appli)
   Même connexion et même protection que l'admin (session BDA_ADMIN + jeton anti-falsification).
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
require __DIR__ . '/../app/auth.php';
require __DIR__ . '/../app/appli.php';

entetes_securite();
demarrer_session();

$action = (string)($_GET['a'] ?? '');
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($methode === 'POST') {
  if (!origine_ok()) echec('Origine refusée.', 403);
  if (!hash_equals((string)$_SESSION['csrf'], (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) echec('Session expirée : rechargez la page.', 419);
} elseif ($methode !== 'GET') {
  echec('Méthode non autorisée.', 405);
}
if (!connecte() || !utilisateur_courant()) echec('Connexion requise.', 401);
$lectures = ['tableau', 'courses', 'clients', 'chauffeurs', 'reglages'];
$ecritures = ['reglages.enregistrer', 'course.attribuer', 'course.annuler', 'chauffeur.enregistrer', 'chauffeur.horsligne', 'client.supprimer'];
if (!in_array($action, array_merge($lectures, $ecritures), true)) echec('Action inconnue.', 404);
if (in_array($action, $lectures, true) !== ($methode === 'GET')) echec('Méthode non autorisée pour cette action.', 405);
// réglages (prix, code d'accès) et suppression d'un client : administrateur seulement
if (in_array($action, ['reglages.enregistrer', 'client.supprimer'], true) && role_courant() !== 'admin') echec('Action réservée à un administrateur.', 403);

// Une course telle que la voit la direction (tout, y compris le client et le chauffeur)
function vue_admin(array $c, array $chauffeurs): array
{
  $d = $c['data'];
  $ch = $chauffeurs[(int)$c['chauffeur_id']] ?? null;
  return [
    'numero' => $c['numero'], 'statut' => $c['statut'], 'gamme' => $c['gamme'], 'gammeNom' => appli_cfg()['gammes'][$c['gamme']]['nom'] ?? $c['gamme'], 'mode' => $c['mode'], 'heures' => $d['heures'] ?? 0,
    'immediate' => (bool)$c['immediate'], 'quand' => $c['quand'], 'cree' => $c['cree'], 'accepte' => $c['accepte'], 'arrive' => $c['arrive'], 'debut' => $c['debut'], 'fin' => $c['fin'], 'annule' => $c['annule'], 'annulePar' => $c['annule_par'],
    'depart' => $d['depart'] ?? null, 'arrivee' => $d['arrivee'] ?? null, 'arret' => $d['arret'] ?? null, 'km' => (float)$c['km'], 'minutes' => (int)$c['minutes'],
    'transport' => (float)$c['transport'], 'remise' => (float)$c['remise'], 'protection' => (float)$c['protection'], 'total' => appli_total($c), 'promo' => $d['promo'] ?? '',
    'client' => $d['client'] ?? null, 'passager' => $d['passager'] ?? null, 'vol' => $d['vol'] ?? '', 'code' => $c['code'] !== '',
    'chauffeur' => $ch ? ['id' => (int)$ch['id'], 'nom' => trim($ch['prenom'] . ' ' . $ch['nom']), 'tel' => $ch['tel']] : ($c['chauffeur_id'] ? ['id' => (int)$c['chauffeur_id'], 'nom' => (string)($d['chauffeur']['prenom'] ?? 'Chauffeur'), 'tel' => ''] : null),
    'vehicule' => $d['chauffeur'] ?? null, 'note' => (int)$c['note_client'], 'avis' => $c['avis'], 'noteChauffeur' => (int)$c['note_chauffeur'], 'frais' => !empty($d['frais']), 'alertes' => $d['alertes'] ?? [],
  ];
}
// Tous les comptes de l'Espace équipe qui peuvent être chauffeurs (métier chauffeur, ou déjà dans l'appli)
function liste_chauffeurs(): array
{
  $st = db()->query("SELECT ce.id, ce.prenom, ce.nom, ce.tel, ce.email, ce.identifiant, ce.metier, ce.statut, a.actif AS agent_actif, ac.autorise, ac.en_ligne, ac.lat, ac.lng, ac.position_le, ac.vehicule, ac.gammes, ac.note, ac.nb_notes, ac.vu
    FROM comptes_equipe ce LEFT JOIN agents a ON a.id = ce.agent_id LEFT JOIN appli_chauffeurs ac ON ac.compte_id = ce.id
    WHERE ce.statut = 'actif' AND (ce.metier = 'chauffeur' OR ac.compte_id IS NOT NULL) ORDER BY ce.prenom COLLATE NOCASE");
  $out = [];
  foreach ($st->fetchAll() as $c) {
    $c['autorise'] = $c['autorise'] === null ? $c['metier'] === 'chauffeur' : (bool)$c['autorise'];
    $c['vehicule'] = json_decode((string)$c['vehicule'], true) ?: (object)[];
    $c['gammes'] = json_decode((string)($c['gammes'] ?? '["berline"]'), true) ?: [];
    $c['enLigne'] = (int)$c['en_ligne'] === 1 && (string)$c['vu'] > date('Y-m-d H:i:s', time() - APPLI_EN_LIGNE);
    $c['agent_actif'] = (int)$c['agent_actif'] === 1;
    $out[(int)$c['id']] = $c;
  }
  return $out;
}
function courses_ou(string $where, array $params, int $max = 200): array
{
  $st = db()->prepare("SELECT * FROM courses WHERE $where ORDER BY id DESC LIMIT $max");
  $st->execute($params);
  $chauffeurs = liste_chauffeurs();
  return array_map(function ($c) use ($chauffeurs) { $c['data'] = json_decode((string)$c['data'], true) ?: []; return vue_admin($c, $chauffeurs); }, $st->fetchAll());
}

try {
  appli_expirer();
  switch ($action) {
    case 'tableau':
      $enDirect = courses_ou("statut IN ('recherche', 'acceptee', 'arrivee', 'en_course')", []);
      $aVenir = courses_ou("statut IN ('reservee', 'confirmee') AND quand >= ?", [date('Y-m-d H:i:s', time() - 3600)]);
      usort($aVenir, fn($a, $b) => strcmp($a['quand'], $b['quand']));
      $jour = db()->prepare("SELECT COUNT(*) n, COALESCE(SUM(transport - remise + protection), 0) t FROM courses WHERE statut = 'terminee' AND fin >= ?");
      $jour->execute([date('Y-m-d 00:00:00')]);
      $semaine = db()->prepare("SELECT COUNT(*) n, COALESCE(SUM(transport - remise + protection), 0) t FROM courses WHERE statut = 'terminee' AND fin >= ?");
      $semaine->execute([date('Y-m-d 00:00:00', strtotime('monday this week'))]);
      $chauffeurs = array_values(array_filter(liste_chauffeurs(), fn($c) => $c['autorise']));
      $cfg = appli_cfg();
      repondre(['ok' => true, 'enDirect' => $enDirect, 'aVenir' => $aVenir, 'chauffeurs' => array_map(fn($c) => [
          'id' => (int)$c['id'], 'nom' => trim($c['prenom'] . ' ' . $c['nom']), 'tel' => $c['tel'], 'enLigne' => $c['enLigne'], 'lat' => $c['lat'], 'lng' => $c['lng'], 'position_le' => $c['position_le'], 'vu' => $c['vu'], 'gammes' => $c['gammes'], 'vehicule' => $c['vehicule'],
        ], $chauffeurs),
        'jour' => $jour->fetch(), 'semaine' => $semaine->fetch(), 'clients' => (int)db()->query('SELECT COUNT(*) FROM appli_clients')->fetchColumn(),
        'ouvert' => $cfg['ouvert'], 'prive' => $cfg['prive'], 'codeAcces' => $cfg['codeAcces'], 'serveur' => maintenant()]);

    case 'courses':
      $du = (string)($_GET['du'] ?? date('Y-m-d', strtotime('-30 days')));
      $au = (string)($_GET['au'] ?? date('Y-m-d'));
      if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $du) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $au)) echec('Période invalide.');
      repondre(['ok' => true, 'courses' => courses_ou('quand >= ? AND quand <= ?', [$du . ' 00:00:00', $au . ' 23:59:59'], 500)]);

    case 'clients':
      $st = db()->query("SELECT c.id, c.prenom, c.nom, c.email, c.tel, c.points, c.offres, c.cree, c.derniere, (SELECT COUNT(*) FROM courses WHERE client_id = c.id AND statut = 'terminee') AS courses FROM appli_clients c ORDER BY c.id DESC LIMIT 1000");
      repondre(['ok' => true, 'clients' => $st->fetchAll()]);

    case 'chauffeurs':
      $liste = liste_chauffeurs();
      $st = db()->query("SELECT chauffeur_id, COUNT(*) n FROM courses WHERE statut = 'terminee' GROUP BY chauffeur_id");
      $nb = [];
      foreach ($st->fetchAll() as $r) $nb[(int)$r['chauffeur_id']] = (int)$r['n'];
      // autres comptes actifs de l'Espace équipe (agents de sécurité…), qu'on peut aussi autoriser à conduire
      $autres = db()->query("SELECT ce.id, ce.prenom, ce.nom, ce.metier FROM comptes_equipe ce WHERE ce.statut = 'actif' AND ce.metier <> 'chauffeur' AND ce.id NOT IN (SELECT compte_id FROM appli_chauffeurs) ORDER BY ce.prenom COLLATE NOCASE")->fetchAll();
      repondre(['ok' => true, 'chauffeurs' => array_values(array_map(fn($c) => [
          'id' => (int)$c['id'], 'nom' => trim($c['prenom'] . ' ' . $c['nom']), 'identifiant' => $c['identifiant'], 'tel' => $c['tel'], 'email' => $c['email'], 'metier' => $c['metier'], 'autorise' => $c['autorise'], 'agentActif' => $c['agent_actif'],
          'enLigne' => $c['enLigne'], 'vehicule' => $c['vehicule'], 'gammes' => $c['gammes'], 'note' => (int)$c['nb_notes'] ? round((float)$c['note'], 2) : null, 'nbNotes' => (int)$c['nb_notes'], 'courses' => $nb[(int)$c['id']] ?? 0, 'vu' => $c['vu'],
        ], $liste)), 'autres' => $autres, 'gammes' => array_map(fn($g) => ['cle' => $g, 'nom' => appli_cfg()['gammes'][$g]['nom']], APPLI_GAMMES)]);

    case 'reglages':
      repondre(['ok' => true, 'reglages' => appli_cfg(), 'aeroports' => array_map(fn($a) => $a['nom'], APPLI_AEROPORTS)]);

    case 'reglages.enregistrer':
      $cfg = appli_cfg_enregistrer(corps());
      journal('vtc', 'Appli : réglages modifiés (prix, accès ou mentions)');
      repondre(['ok' => true, 'reglages' => $cfg]);

    // La direction confie une course ou une réservation à un chauffeur
    case 'course.attribuer':
      $b = corps();
      $c = appli_course(texte($b['numero'] ?? '', 30));
      if (!$c || !in_array($c['statut'], ['recherche', 'reservee', 'confirmee'], true)) echec('Cette course ne peut plus être attribuée.', 409);
      $ch = appli_chauffeur((int)($b['chauffeur'] ?? 0));
      if (!$ch) echec('Chauffeur introuvable ou non autorisé.', 404);
      if (empty($ch['vehicule']['plaque'])) echec('Ce chauffeur n’a pas encore renseigné son véhicule dans l’appli.', 409);
      $d = $c['data'];
      $d['chauffeur'] = ['prenom' => $ch['prenom'], 'voiture' => (string)($ch['vehicule']['modele'] ?? ''), 'couleur' => (string)($ch['vehicule']['couleur'] ?? ''), 'plaque' => (string)($ch['vehicule']['plaque'] ?? '')];
      $d['attribuePar'] = 'bda';
      $nouveau = $c['statut'] === 'recherche' ? 'acceptee' : 'confirmee';
      appli_course_maj((int)$c['id'], ['chauffeur_id' => $ch['id'], 'statut' => $nouveau, 'accepte' => maintenant()], $d);
      appli_push('chauffeur', (int)$ch['id'], $nouveau === 'acceptee' ? 'Course confiée par BDA' : 'Réservation confiée par BDA', $nouveau === 'acceptee' ? 'Ouvrez l’appli : un client vous attend.' : 'Le ' . date('d/m à H\hi', strtotime((string)$c['quand'])) . ' · détails dans l’appli.', '/appli/chauffeur/', 'attribuee');
      appli_push('client', (int)$c['client_id'], $nouveau === 'acceptee' ? 'Votre chauffeur arrive' : 'Réservation confirmée', $ch['prenom'] . ($nouveau === 'acceptee' ? ' vient vous chercher.' : ' sera votre chauffeur.'), '/appli/', 'course');
      journal('vtc', "Appli : course {$c['numero']} confiée à {$ch['prenom']} {$ch['nom']} par la direction");
      repondre(['ok' => true]);

    case 'course.annuler':
      $b = corps();
      $c = appli_course(texte($b['numero'] ?? '', 30));
      if (!$c || !in_array($c['statut'], ['recherche', 'reservee', 'confirmee', 'acceptee', 'arrivee'], true)) echec('Cette course ne peut plus être annulée.', 409);
      appli_course_maj((int)$c['id'], ['statut' => 'annulee', 'annule' => maintenant(), 'annule_par' => 'bda']);
      appli_push('client', (int)$c['client_id'], 'Course annulée par BDA', 'Nous vous appelons pour trouver une solution.', '/appli/', 'course');
      if ((int)$c['chauffeur_id']) appli_push('chauffeur', (int)$c['chauffeur_id'], 'Course annulée', 'La direction a annulé la course ' . $c['numero'] . '.', '/appli/chauffeur/', 'annulee');
      journal('vtc', "Appli : course {$c['numero']} annulée par la direction");
      repondre(['ok' => true]);

    // Autoriser un compte de l'Espace équipe à conduire, ses gammes (dont le VIP) et son véhicule
    case 'chauffeur.enregistrer':
      $b = corps();
      $id = (int)($b['id'] ?? 0);
      $st = db()->prepare("SELECT * FROM comptes_equipe WHERE id = ? AND statut = 'actif'");
      $st->execute([$id]);
      $ce = $st->fetch();
      if (!$ce) echec('Compte de l’Espace équipe introuvable.', 404);
      $gammes = array_values(array_intersect(APPLI_GAMMES, (array)($b['gammes'] ?? [])));
      $v = (array)($b['vehicule'] ?? []);
      $plaque = strtoupper(preg_replace('/\s+/', '-', texte($v['plaque'] ?? '', 14)));
      if ($plaque !== '' && !preg_match('/^[A-Z0-9-]{4,12}$/', $plaque)) echec('Plaque d’immatriculation invalide (ex. GH-482-TZ).');
      $vehicule = json_encode(['modele' => texte($v['modele'] ?? '', 60), 'couleur' => texte($v['couleur'] ?? '', 30), 'plaque' => $plaque], JSON_UNESCAPED_UNICODE);
      db()->prepare('INSERT INTO appli_chauffeurs (compte_id, autorise, vehicule, gammes, maj) VALUES (?, ?, ?, ?, ?) ON CONFLICT(compte_id) DO UPDATE SET autorise = excluded.autorise, vehicule = excluded.vehicule, gammes = excluded.gammes, maj = excluded.maj, en_ligne = CASE WHEN excluded.autorise = 0 THEN 0 ELSE en_ligne END')
        ->execute([$id, empty($b['autorise']) ? 0 : 1, $vehicule, json_encode($gammes ?: ['berline']), maintenant()]);
      if (empty($b['autorise'])) db()->prepare("DELETE FROM appli_jetons WHERE role = 'chauffeur' AND compte_id = ?")->execute([$id]);
      journal('equipe', "Appli : accès chauffeur de {$ce['prenom']} {$ce['nom']} " . (empty($b['autorise']) ? 'retiré' : 'enregistré'));
      repondre(['ok' => true]);

    case 'chauffeur.horsligne':
      $b = corps();
      db()->prepare('UPDATE appli_chauffeurs SET en_ligne = 0, maj = ? WHERE compte_id = ?')->execute([maintenant(), (int)($b['id'] ?? 0)]);
      repondre(['ok' => true]);

    // Suppression d'un compte client à sa demande (mêmes règles que dans l'appli : reçus gardés sans nom)
    case 'client.supprimer':
      $b = corps();
      $id = (int)($b['id'] ?? 0);
      $c = appli_client($id);
      if (!$c) echec('Client introuvable.', 404);
      $st = db()->prepare("SELECT COUNT(*) FROM courses WHERE client_id = ? AND statut IN ('acceptee', 'arrivee', 'en_course')");
      $st->execute([$id]);
      if ((int)$st->fetchColumn()) echec('Ce client a une course en cours.', 409);
      $st = db()->prepare('SELECT * FROM courses WHERE client_id = ?');
      $st->execute([$id]);
      foreach ($st->fetchAll() as $r) {
        $d = json_decode((string)$r['data'], true) ?: [];
        $d['client'] = ['prenom' => 'Compte supprimé', 'nom' => '', 'tel' => '', 'email' => ''];
        $d['passager'] = null;
        $statut = in_array($r['statut'], ['recherche', 'reservee', 'confirmee'], true) ? 'annulee' : $r['statut'];
        db()->prepare('UPDATE courses SET client_id = 0, data = ?, statut = ?, avis = \'\', maj = ? WHERE id = ?')->execute([json_encode($d, JSON_UNESCAPED_UNICODE), $statut, maintenant(), $r['id']]);
        db()->prepare('DELETE FROM courses_messages WHERE course_id = ?')->execute([$r['id']]);
      }
      db()->prepare("DELETE FROM appli_jetons WHERE role = 'client' AND compte_id = ?")->execute([$id]);
      db()->prepare("DELETE FROM appli_push WHERE role = 'client' AND compte_id = ?")->execute([$id]);
      db()->prepare('DELETE FROM appli_clients WHERE id = ?')->execute([$id]);
      journal('vtc', 'Appli : compte client supprimé depuis l’admin');
      repondre(['ok' => true]);
  }
} catch (PDOException $e) {
  error_log('[BDA admin appli] ' . $e->getMessage());
  echec('Erreur du serveur. Réessayez dans un instant.', 500);
}
