<?php
/* =========================================================
   POINTAGE DES AGENTS — API de la page bdasecurite.com/pointage
   L'agent est reconnu par son lien personnel (en-tête X-Pointage),
   créé par l'admin dans « Pointage ». Pas de mot de passe à retenir.
   GET  ?a=etat   : agent, service en cours, planning du jour, derniers services
   POST ?a=debut  : prise de service  (JSON facultatif : lat, lng, prec)
   POST ?a=fin    : fin de service    (idem)
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

entetes_securite();
header('Cache-Control: no-store');

$action = (string)($_GET['a'] ?? '');
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (($action === 'etat') !== ($methode === 'GET') || !in_array($action, ['etat', 'debut', 'fin'], true)) echec('Action inconnue.', 405);
if ($methode === 'POST' && !origine_ok()) echec('Origine refusée.', 403);

try {
  // Lien inconnu : on freine les essais au hasard
  $cle = 'pointage:' . empreinte_client();
  if (tentatives($cle, 900) >= 20) echec('Trop de tentatives. Réessayez dans 15 minutes.', 429);
  $agent = agent_par_lien((string)($_SERVER['HTTP_X_POINTAGE'] ?? ''));
  if (!$agent) {
    noter_tentative($cle);
    echec("Ce lien de pointage n'est plus valable. Demandez un nouveau lien à votre responsable.", 403);
  }
  $id = (int)$agent['id'];
  $enCours = function () use ($id): ?array {
    $st = db()->prepare("SELECT id, debut, site FROM pointages WHERE agent_id = ? AND fin = '' ORDER BY debut DESC LIMIT 1");
    $st->execute([$id]);
    return $st->fetch() ?: null;
  };
  $dernierPointage = function () use ($id): string {
    $st = db()->prepare("SELECT MAX(CASE WHEN fin > debut THEN fin ELSE debut END) FROM pointages WHERE agent_id = ?");
    $st->execute([$id]);
    return (string)$st->fetchColumn();
  };

  switch ($action) {
    case 'etat':
      $jour = date('Y-m-d');
      $pl = planning_du_jour((string)$agent['nom'], $jour);
      $st = db()->prepare('SELECT debut, fin, site FROM pointages WHERE agent_id = ? ORDER BY debut DESC LIMIT 8');
      $st->execute([$id]);
      // Heures de la semaine (lundi -> maintenant), services en cours compris
      $lundi = date('Y-m-d 00:00:00', strtotime('monday this week'));
      $sem = db()->prepare("SELECT debut, fin FROM pointages WHERE agent_id = ? AND debut >= ?");
      $sem->execute([$id, $lundi]);
      $minutes = 0;
      foreach ($sem as $p) $minutes += max(0, (int)round(((($p['fin'] !== '' ? strtotime($p['fin']) : time())) - strtotime($p['debut'])) / 60));
      repondre(['ok' => true, 'agent' => ['nom' => $agent['nom'], 'poste' => $agent['poste']], 'enCours' => $enCours(),
        'prevu' => $pl['prevu'], 'site' => $pl['site'], 'historique' => $st->fetchAll(), 'semaine' => $minutes, 'serveur' => maintenant()]);

    case 'debut':
      if ($enCours()) echec('Votre service est déjà commencé.', 409);
      if ($dernierPointage() > date('Y-m-d H:i:s', time() - 60)) echec('Pointage déjà enregistré il y a moins d’une minute.', 409);
      [$lat, $lng, $prec] = position_gps(corps());
      $pl = planning_du_jour((string)$agent['nom'], date('Y-m-d'));
      db()->prepare('INSERT INTO pointages (agent_id, debut, site, lat_debut, lng_debut, prec_debut, cree) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$id, maintenant(), $pl['site'], $lat, $lng, $prec, maintenant()]);
      journal('equipe', "Prise de service : {$agent['nom']}" . ($pl['site'] !== '' ? " ({$pl['site']})" : ''));
      notifier('pointages', 'Prise de service', 'Un agent a commencé son service à ' . date('H\hi') . '.', '/admin/#/pointage');
      repondre(['ok' => true, 'enCours' => $enCours()]);

    case 'fin':
      $p = $enCours();
      if (!$p) echec("Aucun service en cours : appuyez d'abord sur « Prendre mon service ».", 409);
      if ($p['debut'] > date('Y-m-d H:i:s', time() - 60)) echec('Service commencé il y a moins d’une minute.', 409);
      [$lat, $lng, $prec] = position_gps(corps());
      $fin = maintenant();
      db()->prepare('UPDATE pointages SET fin = ?, lat_fin = ?, lng_fin = ?, prec_fin = ? WHERE id = ?')->execute([$fin, $lat, $lng, $prec, $p['id']]);
      $min = (int)round((strtotime($fin) - strtotime($p['debut'])) / 60);
      journal('equipe', sprintf('Fin de service : %s (%dh%02d)', $agent['nom'], intdiv($min, 60), $min % 60));
      notifier('pointages', 'Fin de service', sprintf('Un agent a terminé son service (%dh%02d).', intdiv($min, 60), $min % 60), '/admin/#/pointage');
      repondre(['ok' => true, 'debut' => $p['debut'], 'fin' => $fin, 'minutes' => $min]);
  }
} catch (Throwable $e) {
  error_log('[BDA pointage] ' . $e->getMessage());
  echec('Erreur du serveur. Réessayez dans un instant.', 500);
}
