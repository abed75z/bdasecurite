<?php
/* =========================================================
   Réservations VTC (page /reserver)
   GET  ?tarifs=1        → tarifs publics (calcul du prix estimé)
   GET  ?suivi=JETON      → état d'une réservation (lien personnel du client)
   POST {…}               → nouvelle réservation (prix recalculé ici)
   POST {suivi, action: "annuler"} → annulation par le client
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

entetes_securite();
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
  if ($methode === 'GET') {
    if (isset($_GET['tarifs'])) {
      $t = tarifs_vtc();
      header('Cache-Control: public, max-age=300');
      repondre(['ok' => true, 'tarifs' => $t]);
    }
    $r = reservation_par_jeton((string)($_GET['suivi'] ?? ''));
    repondre(['ok' => true, 'reservation' => vue_client($r)]);
  }
  if ($methode !== 'POST') echec('Méthode non autorisée.', 405);
  if (!origine_ok()) echec('Origine refusée.', 403);
  $b = corps();

  // Annulation par le client, avec son lien personnel
  if (($b['action'] ?? '') === 'annuler') {
    $r = reservation_par_jeton(chaine($b['suivi'] ?? ''));
    if (!in_array($r['statut'], ['attente', 'confirmee'], true)) echec('Cette réservation ne peut plus être annulée.');
    if (strtotime($r['date_course']) - time() < 2 * 3600) echec('Moins de 2 heures avant la course : appelez-nous pour annuler.');
    db()->prepare("UPDATE reservations SET statut = 'annulee' WHERE id = ?")->execute([$r['id']]);
    $d = $r['data'];
    envoyer_mail("Réservation {$r['ref']} annulée par le client", "Le client a annulé sa réservation.\n\n" . resume_reservation($r['ref'], $d) . "\n\nhttps://bdasecurite.com/admin/#/vtc");
    $r['statut'] = 'annulee';
    repondre(['ok' => true, 'reservation' => vue_client($r)]);
  }

  // Nouvelle réservation
  if (!empty($b['site_web']) || !empty($b['_honey'])) repondre(['ok' => true, 'ref' => 'VTC-0', 'jeton' => '']);
  if (!limiter('reservation', 6, 3600)) echec('Trop de réservations envoyées. Appelez-nous au 06 11 67 86 25.', 429);
  $t = tarifs_vtc();
  $mode = ($b['mode'] ?? '') === 'dispo' ? 'dispo' : 'trajet';
  $vehicule = ($b['vehicule'] ?? '') === 'van' ? 'van' : 'berline';
  $lieu = function ($p, bool $obligatoire): ?array {
    if (!is_array($p) || texte($p['label'] ?? '', 200) === '') {
      if ($obligatoire) echec('Adresse manquante.');
      return null;
    }
    $lat = (float)($p['lat'] ?? 0);
    $lon = (float)($p['lon'] ?? 0);
    if ($lat < 41 || $lat > 51.5 || $lon < -5.5 || $lon > 10) echec('Adresse hors de France métropolitaine : appelez-nous.');
    return ['label' => texte($p['label'], 200), 'lat' => $lat, 'lon' => $lon, 'cp' => texte($p['cp'] ?? '', 10), 'code' => texte($p['code'] ?? '', 5)];
  };
  $depart = $lieu($b['depart'] ?? null, true);
  $arrivee = $lieu($b['arrivee'] ?? null, $mode === 'trajet');

  $date = chaine($b['date'] ?? '');
  $heure = chaine($b['heure'] ?? '');
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $heure)) echec('Date ou heure invalide.');
  $quand = strtotime("$date $heure");
  if ($quand === false || $quand < time() + (float)$t['delai'] * 3600) echec('Réservez au moins ' . (int)$t['delai'] . ' h à l\'avance, ou appelez-nous pour une course immédiate.');
  if ($quand > time() + 365 * 86400) echec('Date trop lointaine.');

  $passagers = max(1, min(8, (int)($b['passagers'] ?? 1)));
  if ($passagers > (int)$t[$vehicule]['places']) echec('Trop de passagers pour ce véhicule : choisissez le van.');
  $heures = max(1, min(12, (int)($b['heures'] ?? 0)));

  // Distance : celle du calcul d'itinéraire, contrôlée par la distance à vol d'oiseau
  $km = max(0.0, min(1500.0, (float)($b['km'] ?? 0)));
  $min = max(0.0, min(1500.0, (float)($b['min'] ?? 0)));
  if ($mode === 'trajet') {
    $vol = distance_km($depart['lat'], $depart['lon'], $arrivee['lat'], $arrivee['lon']);
    if ($km < $vol * 0.95) { $km = round($vol * 1.3, 1); $min = max($min, round($km * 2)); }
  }
  $estParis = fn(?array $p) => $p && str_starts_with($p['cp'], '75');
  $calcul = [
    'vehicule' => $vehicule, 'mode' => $mode, 'km' => $km, 'min' => $min, 'heures' => $heures, 'heure' => $heure,
    'departCode' => $depart['code'], 'arriveeCode' => $arrivee['code'] ?? '', 'departParis' => $estParis($depart), 'arriveeParis' => $estParis($arrivee),
    'sieges' => max(0, min(3, (int)($b['sieges'] ?? 0))), 'pancarte' => !empty($b['pancarte']),
  ];
  $prix = prix_vtc($t, $calcul);

  $nom = texte($b['nom'] ?? '', 80);
  $tel = texte($b['tel'] ?? '', 30);
  $email = texte($b['email'] ?? '', 160);
  if (mb_strlen($nom) < 2) echec('Indiquez votre nom.');
  if (strlen(preg_replace('/\D/', '', $tel)) < 9) echec('Indiquez un numéro de téléphone valide.');
  if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) echec('Adresse email invalide.');

  $data = [
    'mode' => $mode, 'vehicule' => $vehicule, 'depart' => $depart, 'arrivee' => $arrivee, 'date' => $date, 'heure' => $heure,
    'passagers' => $passagers, 'bagages' => max(0, min(10, (int)($b['bagages'] ?? 0))), 'heures' => $mode === 'dispo' ? $heures : 0,
    'km' => round($km, 1), 'min' => round($min), 'sieges' => $calcul['sieges'], 'pancarte' => $calcul['pancarte'],
    'vol' => texte($b['vol'] ?? '', 20), 'message' => texte($b['message'] ?? '', 500),
    'nom' => $nom, 'tel' => $tel, 'email' => $email, 'prixEstime' => $prix,
  ];
  $ref = 'VTC-' . date('ymd') . '-' . random_int(1000, 9999);
  $jeton = bin2hex(random_bytes(16));
  db()->prepare('INSERT INTO reservations (ref, jeton, recu, statut, date_course, prix, data) VALUES (?, ?, ?, ?, ?, ?, ?)')
    ->execute([$ref, $jeton, maintenant(), 'attente', date('Y-m-d H:i:s', $quand), $prix, json_encode($data, JSON_UNESCAPED_UNICODE)]);

  envoyer_mail("Nouvelle réservation VTC $ref — " . date('d/m', $quand) . " à $heure", "Nouvelle réservation à confirmer.\n\n" . resume_reservation($ref, $data) . "\n\nConfirmer dans l'espace admin : https://bdasecurite.com/admin/#/vtc", $email);
  if ($email !== '') envoyer_mail("Votre réservation $ref — BDA Sécurité & VTC Premium", "Bonjour $nom,\n\nNous avons bien reçu votre réservation. Nous vous confirmons la course très vite par téléphone ou WhatsApp.\n\n" . resume_reservation($ref, $data) . "\n\nSuivre ou annuler votre réservation : https://bdasecurite.com/reserver#suivi=$jeton\n\nBDA Sécurité & VTC Premium — 06 11 67 86 25", '', $email);
  repondre(['ok' => true, 'ref' => $ref, 'jeton' => $jeton, 'prix' => $prix]);
} catch (Throwable $e) {
  error_log('[BDA reservation] ' . $e->getMessage());
  echec('Erreur du serveur. Appelez-nous au 06 11 67 86 25.', 500);
}

function reservation_par_jeton(string $jeton): array
{
  if (!preg_match('/^[a-f0-9]{32}$/', $jeton)) echec('Lien de suivi invalide.', 404);
  $st = db()->prepare('SELECT * FROM reservations WHERE jeton = ?');
  $st->execute([$jeton]);
  $r = $st->fetch();
  if (!$r) echec('Réservation introuvable.', 404);
  $r['data'] = json_decode((string)$r['data'], true) ?: [];
  return $r;
}
// Ce que le client voit sur son lien de suivi (pas d'informations internes)
function vue_client(array $r): array
{
  $d = $r['data'];
  return [
    'ref' => $r['ref'], 'statut' => $r['statut'], 'prix' => (float)$r['prix'], 'date' => $d['date'] ?? '', 'heure' => $d['heure'] ?? '',
    'mode' => $d['mode'] ?? 'trajet', 'vehicule' => $d['vehicule'] ?? 'berline', 'heures' => $d['heures'] ?? 0,
    'depart' => $d['depart']['label'] ?? '', 'arrivee' => $d['arrivee']['label'] ?? '', 'passagers' => $d['passagers'] ?? 1, 'chauffeur' => $d['chauffeur'] ?? '',
  ];
}
function resume_reservation(string $ref, array $d): string
{
  $l = ["Réf. : $ref", 'Date : ' . date('d/m/Y', strtotime($d['date'])) . ' à ' . $d['heure'], 'Départ : ' . ($d['depart']['label'] ?? '')];
  $l[] = $d['mode'] === 'dispo' ? "Mise à disposition : {$d['heures']} h" : 'Arrivée : ' . ($d['arrivee']['label'] ?? '') . " ({$d['km']} km, ~{$d['min']} min)";
  $l[] = 'Véhicule : ' . ($d['vehicule'] === 'van' ? 'Van' : 'Berline') . " · {$d['passagers']} passager(s) · {$d['bagages']} bagage(s)";
  if (!empty($d['vol'])) $l[] = "Vol / train : {$d['vol']}";
  if (!empty($d['sieges'])) $l[] = "Siège(s) enfant : {$d['sieges']}";
  if (!empty($d['pancarte'])) $l[] = 'Accueil avec pancarte';
  $l[] = "Prix estimé : {$d['prixEstime']} €";
  $l[] = "Client : {$d['nom']} · {$d['tel']}" . ($d['email'] ? " · {$d['email']}" : '');
  if (!empty($d['message'])) $l[] = "Message : {$d['message']}";
  return implode("\n", $l);
}
function distance_km(float $a, float $b, float $c, float $d): float
{
  $r = 6371;
  $x = deg2rad($c - $a);
  $y = deg2rad($d - $b);
  $h = sin($x / 2) ** 2 + cos(deg2rad($a)) * cos(deg2rad($c)) * sin($y / 2) ** 2;
  return 2 * $r * asin(min(1, sqrt($h)));
}
