<?php
/* =========================================================
   APPLI BDA (chauffeur privé) — réglages, prix, comptes et courses
   Utilisé par l'API de l'appli (api/appli.php) et par l'admin (admin/appli-api.php).
   - Les prix sont TOUJOURS recalculés ici : l'appli ne fait qu'afficher.
   - Un chauffeur est un compte de l'Espace équipe (validé par la direction dans l'admin).
   - Seule la dernière position d'un chauffeur est gardée (aucun historique de trajets).
   ========================================================= */
declare(strict_types=1);

const APPLI_GAMMES = ['berline', 'electrique', 'suv', 'luxe', 'van', 'vip'];
const APPLI_RECHERCHE = 240;  // secondes pendant lesquelles une course immédiate est proposée aux chauffeurs
const APPLI_FAVORI = 30;      // secondes pendant lesquelles seul le chauffeur favori la voit
const APPLI_EN_LIGNE = 120;   // sans nouvelle de l'appli chauffeur pendant 2 min, il n'est plus « en ligne »
const APPLI_ACTIVES = ['acceptee', 'arrivee', 'en_course'];
const APPLI_AEROPORTS = [
  'orly' => ['nom' => 'Orly', 'lat' => 48.7262, 'lng' => 2.3652, 'rayon' => 3200],
  'cdg' => ['nom' => 'Roissy-CDG', 'lat' => 49.0097, 'lng' => 2.5479, 'rayon' => 4800],
  'beauvais' => ['nom' => 'Beauvais', 'lat' => 49.4547, 'lng' => 2.1128, 'rayon' => 3000],
];

/* ---------- Réglages de l'appli (Admin > Appli BDA > Réglages) ---------- */
function appli_reglages_defaut(): array
{
  $g = fn(string $nom, string $modele, int $places, int $bagages, float $prise, float $km, float $min, float $minimum, array $forfaits, float $heure) =>
    compact('nom', 'modele', 'places', 'bagages', 'prise', 'km', 'min', 'minimum', 'forfaits', 'heure') + ['actif' => true];
  return [
    'ouvert' => true,      // l'appli accepte de nouvelles courses
    'prive' => true,       // phase privée : un code d'accès est demandé à l'inscription
    'codeAcces' => '',     // créé au premier usage, visible dans l'admin
    // Berline et van : tarifs du site. Électrique, SUV et Berline Luxe : prix provisoires, à valider par le gérant.
    'gammes' => [
      'berline' => $g('Berline', 'Mercedes Classe E ou similaire', 4, 3, 10, 1.9, 0.55, 40, ['orly' => 38, 'cdg' => 52, 'beauvais' => 119], 55),
      'electrique' => $g('Électrique', 'Tesla Model 3 ou similaire', 4, 3, 10, 1.9, 0.55, 40, ['orly' => 38, 'cdg' => 52, 'beauvais' => 119], 0),
      'suv' => $g('SUV', 'Mercedes GLE ou similaire', 4, 4, 14, 2.2, 0.65, 55, ['orly' => 48, 'cdg' => 65, 'beauvais' => 135], 0),
      'luxe' => $g('Berline Luxe', 'Mercedes Classe S ou similaire', 3, 3, 20, 3.1, 0.9, 90, ['orly' => 85, 'cdg' => 110, 'beauvais' => 210], 95),
      'van' => $g('Van', 'Mercedes Classe V ou similaire', 7, 7, 15, 2.4, 0.7, 60, ['orly' => 58, 'cdg' => 78, 'beauvais' => 149], 85),
      'vip' => ['nom' => 'VIP', 'modele' => 'Chauffeur + garde du corps', 'places' => 3, 'bagages' => 2, 'actif' => true],
    ],
    'agentVip' => 132,     // 2 h de garde du corps à 55 € HT/h, TVA 20 %
    'heuresMin' => 2,
    'heuresMax' => 12,
    'attente' => 5,        // minutes d'attente offertes
    'attenteAeroport' => 15,
    'promos' => [['code' => 'BIENVENUE10', 'montant' => 10, 'actif' => true]],
    'legal' => ['evtc' => '', 'tva' => '', 'mediateur' => '', 'cnaps' => '', 'hebergeur' => 'OVH SAS, 2 rue Kellermann, 59100 Roubaix, France'],
    // connexion avec Google / Apple : identifiants PUBLICS (pas des mots de passe), vides = boutons cachés
    'connexion' => ['googleWeb' => '', 'googleIos' => '', 'appleActif' => false, 'appleServices' => '', 'appleBundle' => 'com.bdasecurite.bdrive'],
  ];
}
function appli_cfg(): array
{
  static $cfg = null;
  if ($cfg !== null) return $cfg;
  $st = db()->prepare("SELECT v FROM reglages WHERE k = 'appli'");
  $st->execute();
  $v = json_decode((string)$st->fetchColumn(), true);
  $cfg = appli_reglages_defaut();
  if (is_array($v)) {
    foreach (['ouvert', 'prive'] as $k) if (array_key_exists($k, $v)) $cfg[$k] = (bool)$v[$k];
    foreach (['codeAcces'] as $k) if (is_string($v[$k] ?? null)) $cfg[$k] = $v[$k];
    foreach (['agentVip', 'heuresMin', 'heuresMax', 'attente', 'attenteAeroport'] as $k) if (is_numeric($v[$k] ?? null)) $cfg[$k] = (float)$v[$k];
    foreach (APPLI_GAMMES as $k) if (is_array($v['gammes'][$k] ?? null)) {
      $cfg['gammes'][$k] = array_merge($cfg['gammes'][$k], array_intersect_key($v['gammes'][$k], $cfg['gammes'][$k]));
      if (isset($cfg['gammes'][$k]['forfaits'])) $cfg['gammes'][$k]['forfaits'] = array_merge(appli_reglages_defaut()['gammes'][$k]['forfaits'], (array)$cfg['gammes'][$k]['forfaits']);
    }
    if (is_array($v['promos'] ?? null)) $cfg['promos'] = $v['promos'];
    if (is_array($v['legal'] ?? null)) $cfg['legal'] = array_merge($cfg['legal'], array_intersect_key($v['legal'], $cfg['legal']));
    if (is_array($v['connexion'] ?? null)) foreach ($cfg['connexion'] as $k => $d) if (array_key_exists($k, $v['connexion'])) $cfg['connexion'][$k] = is_bool($d) ? (bool)$v['connexion'][$k] : (string)$v['connexion'][$k];
  }
  if ($cfg['codeAcces'] === '') {
    // code d'accès de la phase privée, créé une seule fois (le gérant le donne à ses clients)
    $cfg['codeAcces'] = 'BDA-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));
    appli_cfg_ecrire($cfg);
  }
  return $cfg;
}
function appli_cfg_ecrire(array $cfg): void
{
  db()->prepare("INSERT INTO reglages (k, v) VALUES ('appli', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")->execute([json_encode($cfg, JSON_UNESCAPED_UNICODE)]);
}
// Réglages envoyés par l'admin : chaque valeur est contrôlée, rien d'autre n'est gardé
function appli_cfg_enregistrer(array $b): array
{
  $cfg = appli_cfg();
  $nb = fn($v, float $min, float $max, float $d) => is_numeric(str_replace(',', '.', (string)$v)) ? max($min, min($max, round((float)str_replace(',', '.', (string)$v), 2))) : $d;
  foreach (['ouvert', 'prive'] as $k) if (array_key_exists($k, $b)) $cfg[$k] = (bool)$b[$k];
  if (array_key_exists('codeAcces', $b)) {
    $code = strtoupper(preg_replace('/[^A-Za-z0-9-]/', '', (string)$b['codeAcces']));
    if (strlen($code) < 4) echec('Le code d’accès doit faire au moins 4 caractères (lettres, chiffres, tiret).');
    $cfg['codeAcces'] = substr($code, 0, 20);
  }
  foreach (['agentVip' => [0, 2000], 'heuresMin' => [1, 12], 'heuresMax' => [1, 24], 'attente' => [0, 60], 'attenteAeroport' => [0, 120]] as $k => [$mi, $ma]) {
    if (array_key_exists($k, $b)) $cfg[$k] = $nb($b[$k], $mi, $ma, (float)$cfg[$k]);
  }
  foreach (APPLI_GAMMES as $k) {
    $s = $b['gammes'][$k] ?? null;
    if (!is_array($s)) continue;
    $g = &$cfg['gammes'][$k];
    if (array_key_exists('actif', $s)) $g['actif'] = (bool)$s['actif'];
    foreach (['nom' => 30, 'modele' => 60] as $t => $max) if (array_key_exists($t, $s)) { $txt = texte($s[$t], $max); if ($txt !== '') $g[$t] = $txt; }
    foreach (['places' => 9, 'bagages' => 9] as $t => $max) if (array_key_exists($t, $s)) $g[$t] = (int)$nb($s[$t], 1, $max, (float)$g[$t]);
    if ($k !== 'vip') {
      foreach (['prise' => 500, 'km' => 50, 'min' => 20, 'minimum' => 2000, 'heure' => 1000] as $t => $max) if (array_key_exists($t, $s)) $g[$t] = $nb($s[$t], 0, $max, (float)$g[$t]);
      foreach (array_keys(APPLI_AEROPORTS) as $a) if (array_key_exists($a, (array)($s['forfaits'] ?? []))) $g['forfaits'][$a] = $nb($s['forfaits'][$a], 0, 5000, (float)$g['forfaits'][$a]);
    }
    unset($g);
  }
  if (is_array($b['promos'] ?? null)) {
    $promos = [];
    foreach (array_slice($b['promos'], 0, 50) as $p) {
      $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($p['code'] ?? '')));
      if (strlen($code) < 3) continue;
      $promos[$code] = ['code' => substr($code, 0, 20), 'montant' => $nb($p['montant'] ?? 0, 0, 500, 0), 'actif' => !empty($p['actif'])];
    }
    $cfg['promos'] = array_values($promos);
  }
  if (is_array($b['legal'] ?? null)) foreach (array_keys($cfg['legal']) as $k) if (array_key_exists($k, $b['legal'])) $cfg['legal'][$k] = texte($b['legal'][$k], 300);
  if (is_array($b['connexion'] ?? null)) {
    $x = $b['connexion'];
    foreach (['googleWeb' => 'Web', 'googleIos' => 'iPhone'] as $k => $libelle) if (array_key_exists($k, $x)) {
      $id = trim((string)$x[$k]);
      if ($id !== '' && !preg_match('/^[0-9]{6,20}-[a-z0-9]{10,64}\.apps\.googleusercontent\.com$/', $id)) echec("Identifiant Google ($libelle) invalide : il finit par « .apps.googleusercontent.com ».");
      $cfg['connexion'][$k] = $id;
    }
    foreach (['appleServices', 'appleBundle'] as $k) if (array_key_exists($k, $x)) {
      $id = trim((string)$x[$k]);
      if ($id !== '' && !preg_match('/^[A-Za-z0-9][A-Za-z0-9.\-]{2,120}$/', $id)) echec('Identifiant Apple invalide (exemple : com.bdasecurite.bdrive.web).');
      $cfg['connexion'][$k] = $id;
    }
    if (array_key_exists('appleActif', $x)) $cfg['connexion']['appleActif'] = (bool)$x['appleActif'];
  }
  appli_cfg_ecrire($cfg);
  return $cfg;
}
// Ce que l'appli a besoin de savoir (aucun secret : pas de code d'accès, pas de codes promo)
function appli_cfg_publique(): array
{
  $cfg = appli_cfg();
  $gammes = [];
  foreach (APPLI_GAMMES as $k) $gammes[$k] = array_diff_key($cfg['gammes'][$k], ['actif' => 1]) + ['actif' => (bool)$cfg['gammes'][$k]['actif']];
  $vapid = '';
  try { require_once __DIR__ . '/veille/outils.php'; $vapid = veille_env('VAPID_PUBLIC_KEY'); } catch (Throwable $e) { $vapid = ''; }
  return [
    'ouvert' => $cfg['ouvert'], 'prive' => $cfg['prive'], 'gammes' => $gammes, 'agentVip' => $cfg['agentVip'],
    'heuresMin' => $cfg['heuresMin'], 'heuresMax' => $cfg['heuresMax'], 'attente' => $cfg['attente'], 'attenteAeroport' => $cfg['attenteAeroport'],
    'legal' => $cfg['legal'], 'vapid' => $vapid, 'serveur' => date('c'),
    // connexion par numéro de téléphone (code par SMS) : active dès que les clés SMS sont réglées
    'sms' => function_exists('appli_sms_actif') && appli_sms_actif(),
    // identifiants publics pour afficher « Continuer avec Google / Apple » (vides = boutons cachés)
    'connexion' => [
      'google' => $cfg['connexion']['googleWeb'], 'googleIos' => $cfg['connexion']['googleIos'],
      'apple' => $cfg['connexion']['appleActif'] ? $cfg['connexion']['appleServices'] : '', 'appleNatif' => $cfg['connexion']['appleActif'] && $cfg['connexion']['appleBundle'] !== '',
    ],
  ];
}

/* ---------- Lieux, distances et prix (mêmes règles que l'appli) ---------- */
// Mètres entre deux points (approximation locale, comme l'appli : 1° de longitude ≈ 73,3 km, 1° de latitude ≈ 110,6 km)
function appli_distance(array $a, array $b): float
{
  return hypot(((float)$a['lng'] - (float)$b['lng']) * 73270, ((float)$a['lat'] - (float)$b['lat']) * 110570);
}
function appli_aeroport(?array $p): ?string
{
  if (!$p) return null;
  foreach (APPLI_AEROPORTS as $k => $a) if (appli_distance($p, $a) < $a['rayon']) return $k;
  return null;
}
function appli_dans_paris(?array $p): bool
{
  return $p && ((((float)$p['lng'] - 2.347) / 0.125) ** 2 + (((float)$p['lat'] - 48.858) / 0.046) ** 2) < 1;
}
// Prix fixe : entre Paris et un aéroport, sans arrêt
function appli_forfait(?array $a, ?array $b): ?string
{
  if (!$a || !$b) return null;
  $ab = appli_aeroport($b);
  if ($ab && appli_dans_paris($a)) return $ab;
  $aa = appli_aeroport($a);
  if ($aa && appli_dans_paris($b)) return $aa;
  return null;
}
// Lieu envoyé par l'appli : { titre, sous, lat, lng } en France métropolitaine
function appli_lieu($v): ?array
{
  if (!is_array($v)) return null;
  $lat = is_numeric($v['lat'] ?? null) ? (float)$v['lat'] : null;
  $lng = is_numeric($v['lng'] ?? null) ? (float)$v['lng'] : null;
  if ($lat === null || $lng === null || $lat < 41 || $lat > 51.5 || $lng < -5.5 || $lng > 10) return null;
  $titre = texte($v['titre'] ?? '', 120);
  if ($titre === '') return null;
  return ['titre' => $titre, 'sous' => texte($v['sous'] ?? '', 160), 'lat' => round($lat, 6), 'lng' => round($lng, 6)];
}
/* Prix d'une course. $r : mode (trajet|dispo), km, min, heures, depart, arrivee, arret
   Renvoie [transport, protection, km, minutes] avec la distance et la durée contrôlées. */
function appli_prix(array $cfg, string $gamme, array $r): array
{
  $type = $gamme === 'vip' ? 'berline' : $gamme;
  $t = $cfg['gammes'][$type];
  $protection = $gamme === 'vip' ? (float)$cfg['agentVip'] : 0.0;
  if (($r['mode'] ?? 'trajet') === 'dispo') {
    $h = max((float)$cfg['heuresMin'], min((float)$cfg['heuresMax'], (float)($r['heures'] ?? 0)));
    if ((float)$t['heure'] <= 0) echec('Cette gamme n’est pas proposée à l’heure.');
    return [round($h * (float)$t['heure']), $protection, 0.0, (int)round($h * 60)];
  }
  $a = $r['depart'];
  $b = $r['arrivee'];
  // distance et durée calculées par l'appli, ramenées dans des limites crédibles (vol d'oiseau)
  $oiseau = appli_distance($a, $b) / 1000 + (!empty($r['arret']) ? (appli_distance($a, $r['arret']) + appli_distance($r['arret'], $b) - appli_distance($a, $b)) / 1000 : 0);
  $km = (float)($r['km'] ?? 0);
  $km = max($oiseau * 1.1, min($oiseau * 3 + 5, $km > 0 ? $km : $oiseau * 1.35));
  $min = (int)($r['min'] ?? 0);
  $min = (int)max(ceil($km * 0.6), min($km * 6 + 40, $min > 0 ? $min : $km * 2.2 + 6));
  $f = !empty($r['arret']) ? null : appli_forfait($a, $b);
  $base = $f ? (float)($t['forfaits'][$f] ?? 0) : max((float)$t['minimum'], (float)$t['prise'] + $km * (float)$t['km'] + $min * (float)$t['min']);
  return [round($base), $protection, round($km, 1), $min];
}
// Code promo valable pour ce client (une fois par client)
function appli_promo(array $cfg, string $code, int $client): ?array
{
  $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $code));
  if ($code === '') return null;
  foreach ($cfg['promos'] as $p) {
    if (empty($p['actif']) || strtoupper((string)$p['code']) !== $code) continue;
    $st = db()->prepare("SELECT COUNT(*) FROM courses WHERE client_id = ? AND statut NOT IN ('annulee', 'aucun') AND data LIKE ?");
    $st->execute([$client, '%"promo":"' . $code . '"%']);
    if ((int)$st->fetchColumn() > 0) return null;
    return ['code' => $code, 'montant' => (float)$p['montant']];
  }
  return null;
}

/* ---------- Connexion de l'appli : jeton dans l'en-tête X-BDA-Jeton ---------- */
function appli_jeton_creer(string $role, int $id): string
{
  $jeton = bin2hex(random_bytes(32));
  db()->prepare('INSERT INTO appli_jetons (jeton, role, compte_id, appareil, cree, vu) VALUES (?, ?, ?, ?, ?, ?)')->execute([hash('sha256', $jeton), $role, $id, appareil(), maintenant(), maintenant()]);
  return $jeton;
}
// ['role' => 'client'|'chauffeur', 'id' => n, 'empreinte' => …] ou null
function appli_session(): ?array
{
  static $s = false;
  if ($s !== false) return $s;
  $jeton = (string)($_SERVER['HTTP_X_BDA_JETON'] ?? '');
  if (!preg_match('/^[a-f0-9]{64}$/', $jeton)) return $s = null;
  $empreinte = hash('sha256', $jeton);
  $st = db()->prepare('SELECT * FROM appli_jetons WHERE jeton = ?');
  $st->execute([$empreinte]);
  $j = $st->fetch();
  if (!$j || $j['vu'] < date('Y-m-d H:i:s', time() - 180 * 86400)) return $s = null;
  if ($j['vu'] < date('Y-m-d H:i:s', time() - 600)) db()->prepare('UPDATE appli_jetons SET vu = ? WHERE jeton = ?')->execute([maintenant(), $empreinte]);
  return $s = ['role' => (string)$j['role'], 'id' => (int)$j['compte_id'], 'empreinte' => $empreinte];
}
function appli_mdp_valide(string $mdp): void
{
  if (mb_strlen($mdp) < 8) echec('Le mot de passe doit contenir au moins 8 caractères.');
  if (mb_strlen($mdp) > 200) echec('Mot de passe trop long.');
  if (!preg_match('/\pL/u', $mdp) || !preg_match('/\d/', $mdp)) echec('Le mot de passe doit contenir au moins une lettre et un chiffre.');
}

/* ---------- Comptes ---------- */
function appli_client(int $id): ?array
{
  $st = db()->prepare('SELECT * FROM appli_clients WHERE id = ?');
  $st->execute([$id]);
  return $st->fetch() ?: null;
}
function appli_client_public(array $c): array
{
  return ['id' => (int)$c['id'], 'prenom' => $c['prenom'], 'nom' => $c['nom'], 'email' => $c['email'], 'tel' => $c['tel'], 'offres' => (bool)$c['offres'], 'points' => (int)$c['points'], 'depuis' => substr((string)$c['cree'], 0, 10),
    'relie' => ['google' => ($c['google'] ?? '') !== '', 'apple' => ($c['apple'] ?? '') !== '', 'motdepasse' => (string)$c['hash'] !== '']];
}
// Chauffeur = compte actif de l'Espace équipe, autorisé dans l'appli (métier « chauffeur » ou autorisé par l'admin)
function appli_chauffeur(int $compte): ?array
{
  $st = db()->prepare("SELECT ce.id, ce.prenom, ce.nom, ce.tel, ce.email, ce.metier, ce.identifiant, ac.autorise, ac.en_ligne, ac.lat, ac.lng, ac.cap, ac.prec, ac.position_le, ac.vehicule, ac.gammes, ac.note, ac.nb_notes, ac.vu
    FROM comptes_equipe ce JOIN agents a ON a.id = ce.agent_id LEFT JOIN appli_chauffeurs ac ON ac.compte_id = ce.id
    WHERE ce.id = ? AND ce.statut = 'actif' AND a.actif = 1");
  $st->execute([$compte]);
  $c = $st->fetch();
  if (!$c) return null;
  $autorise = $c['autorise'] === null ? $c['metier'] === 'chauffeur' : (bool)$c['autorise'];
  if (!$autorise) return null;
  if ($c['autorise'] === null) {
    db()->prepare("INSERT OR IGNORE INTO appli_chauffeurs (compte_id, maj) VALUES (?, ?)")->execute([$compte, maintenant()]);
    $c['vehicule'] = '{}'; $c['gammes'] = '["berline"]'; $c['note'] = 0; $c['nb_notes'] = 0; $c['en_ligne'] = 0;
  }
  $c['vehicule'] = json_decode((string)$c['vehicule'], true) ?: [];
  $c['gammes'] = array_values(array_intersect(APPLI_GAMMES, json_decode((string)$c['gammes'], true) ?: []));
  return $c;
}
function appli_note(array $c): string
{
  return (int)$c['nb_notes'] > 0 ? number_format((float)$c['note'], 2, ',', '') : 'Nouveau';
}
// Ce que voit le client de son chauffeur : prénom, voiture, plaque, note (et sa position pendant la course)
function appli_chauffeur_public(array $c, bool $position): array
{
  $v = $c['vehicule'];
  $p = ['id' => (int)$c['id'], 'prenom' => $c['prenom'], 'voiture' => (string)($v['modele'] ?? ''), 'couleur' => (string)($v['couleur'] ?? ''), 'plaque' => (string)($v['plaque'] ?? ''), 'note' => appli_note($c), 'tel' => (string)$c['tel']];
  if ($position && $c['lat'] !== null && $c['position_le'] !== '') {
    $p['position'] = ['lat' => (float)$c['lat'], 'lng' => (float)$c['lng'], 'cap' => $c['cap'] === null ? null : (float)$c['cap'], 'age' => max(0, time() - (int)strtotime((string)$c['position_le']))];
  }
  return $p;
}
function appli_en_ligne(array $c): bool
{
  return (int)$c['en_ligne'] === 1 && (string)$c['vu'] > date('Y-m-d H:i:s', time() - APPLI_EN_LIGNE);
}

/* ---------- Courses ---------- */
function appli_numero(): string
{
  for ($i = 0; $i < 20; $i++) {
    $n = 'BDA-' . date('ymd') . '-' . random_int(1000, 9999);
    $st = db()->prepare('SELECT COUNT(*) FROM courses WHERE numero = ?');
    $st->execute([$n]);
    if (!(int)$st->fetchColumn()) return $n;
  }
  return 'BDA-' . date('ymd') . '-' . bin2hex(random_bytes(3));
}
function appli_course(string $numero): ?array
{
  $st = db()->prepare('SELECT * FROM courses WHERE numero = ?');
  $st->execute([$numero]);
  $c = $st->fetch();
  if (!$c) return null;
  $c['data'] = json_decode((string)$c['data'], true) ?: [];
  return $c;
}
function appli_course_maj(int $id, array $champs, ?array $data = null): void
{
  if ($data !== null) $champs['data'] = json_encode($data, JSON_UNESCAPED_UNICODE);
  $champs['maj'] = maintenant();
  $sets = implode(', ', array_map(fn($k) => "$k = ?", array_keys($champs)));
  db()->prepare("UPDATE courses SET $sets WHERE id = ?")->execute([...array_values($champs), $id]);
}
// Courses immédiates restées sans chauffeur : la recherche s'arrête (le client et la direction sont prévenus)
function appli_expirer(): void
{
  $limite = date('Y-m-d H:i:s', time() - APPLI_RECHERCHE);
  $st = db()->prepare("SELECT id, numero, gamme FROM courses WHERE statut = 'recherche' AND recherche < ?");
  $st->execute([$limite]);
  foreach ($st->fetchAll() as $c) {
    db()->prepare("UPDATE courses SET statut = 'aucun', maj = ? WHERE id = ? AND statut = 'recherche'")->execute([maintenant(), $c['id']]);
    journal('vtc', "Appli : aucun chauffeur pour la course {$c['numero']}");
    notifier('appli', 'Course sans chauffeur', 'Aucun chauffeur n’a accepté la course · ' . appli_cfg()['gammes'][$c['gamme']]['nom'], '/admin/#/appli', 'appli-aucun');
  }
}
function appli_total(array $c): float
{
  return (float)$c['transport'] - (float)$c['remise'] + (float)$c['protection'];
}
// Vue « client » d'une course (jamais les coordonnées du chauffeur hors course)
function appli_vue_client(array $c): array
{
  $d = $c['data'];
  $actif = in_array($c['statut'], APPLI_ACTIVES, true);
  $chf = null;
  if ((int)$c['chauffeur_id']) {
    $ch = appli_chauffeur((int)$c['chauffeur_id']);
    $snap = (array)($d['chauffeur'] ?? []);
    $chf = $ch ? appli_chauffeur_public($ch, $actif) : ['id' => (int)$c['chauffeur_id'], 'prenom' => (string)($snap['prenom'] ?? 'Chauffeur'), 'note' => '', 'tel' => ''];
    // la voiture de la course reste celle du moment de la réservation
    foreach (['voiture', 'couleur', 'plaque'] as $k) if (!empty($snap[$k])) $chf[$k] = $snap[$k];
    if (!$actif && !in_array($c['statut'], ['confirmee'], true)) unset($chf['tel']);
  }
  return [
    'numero' => $c['numero'], 'statut' => $c['statut'], 'gamme' => $c['gamme'], 'mode' => $c['mode'], 'immediate' => (bool)$c['immediate'],
    'quand' => $c['quand'], 'cree' => $c['cree'], 'accepte' => $c['accepte'], 'arrive' => $c['arrive'], 'debut' => $c['debut'], 'fin' => $c['fin'], 'annule' => $c['annule'], 'annulePar' => $c['annule_par'],
    'depart' => $d['depart'] ?? null, 'arrivee' => $d['arrivee'] ?? null, 'arret' => $d['arret'] ?? null, 'heures' => $d['heures'] ?? 0,
    'km' => (float)$c['km'], 'minutes' => (int)$c['minutes'], 'transport' => (float)$c['transport'], 'remise' => (float)$c['remise'], 'protection' => (float)$c['protection'], 'total' => appli_total($c),
    'promo' => $d['promo'] ?? '', 'paiement' => 'abord', 'code' => $c['code'], 'passager' => $d['passager'] ?? null, 'vol' => $d['vol'] ?? '', 'pancarte' => !empty($d['pancarte']),
    'client' => $d['client'] ?? null, 'chauffeur' => $chf, 'note' => (int)$c['note_client'], 'avis' => $c['avis'], 'frais' => !empty($d['frais']), 'suivi' => $c['suivi'],
  ];
}
// Vue « chauffeur » : ce qu'il faut pour faire la course (le prénom et le téléphone du client seulement après acceptation)
function appli_vue_chauffeur(array $c, bool $offre = false, ?array $chauffeur = null): array
{
  $d = $c['data'];
  $cfg = appli_cfg();
  $prefs = (array)($d['prefs'] ?? []);
  $options = [];
  if (!empty($d['vol'])) $options[] = 'Vol ' . $d['vol'] . (!empty($d['pancarte']) ? ' · pancarte' : '');
  if (!empty($d['arret'])) $options[] = 'Arrêt : ' . $d['arret']['titre'];
  if (!empty($prefs['silence'])) $options[] = 'Course silencieuse';
  if (!empty($prefs['temperature']) && $prefs['temperature'] !== 'Standard') $options[] = 'Température : ' . $prefs['temperature'];
  if (!empty($prefs['musique']) && $prefs['musique'] !== 'Au choix du chauffeur') $options[] = 'Musique : ' . $prefs['musique'];
  if (!empty($prefs['eau'])) $options[] = 'Eau offerte';
  if (!empty($prefs['bagages'])) $options[] = 'Aide aux bagages';
  if (!empty($prefs['chien'])) $options[] = 'Chien d’assistance';
  if (!empty($prefs['fauteuil'])) $options[] = 'Fauteuil roulant pliable';
  if ($c['gamme'] === 'vip') $options[] = 'VIP : garde du corps BDA';
  $client = (array)($d['client'] ?? []);
  $voyageur = !empty($d['passager']['prenom']) ? $d['passager'] : $client;
  $v = [
    'numero' => $c['numero'], 'statut' => $c['statut'], 'gamme' => $c['gamme'], 'gammeNom' => $cfg['gammes'][$c['gamme']]['nom'] ?? $c['gamme'], 'mode' => $c['mode'], 'immediate' => (bool)$c['immediate'],
    'quand' => $c['quand'], 'cree' => $c['cree'], 'arrive' => $c['arrive'], 'debut' => $c['debut'], 'fin' => $c['fin'],
    'depart' => $d['depart'] ?? null, 'arrivee' => $d['arrivee'] ?? null, 'arret' => $d['arret'] ?? null, 'heures' => $d['heures'] ?? 0,
    'km' => (float)$c['km'], 'minutes' => (int)$c['minutes'], 'prix' => (float)$c['transport'] - (float)$c['remise'], 'protection' => (float)$c['protection'], 'paiement' => 'abord',
    'options' => $options, 'codeRequis' => $c['code'] !== '', 'vol' => $d['vol'] ?? '', 'pancarte' => !empty($d['pancarte']),
    'attente' => (int)(!empty($d['vol']) ? $cfg['attenteAeroport'] : $cfg['attente']),
  ];
  if ($chauffeur && !empty($d['depart']) && $chauffeur['lat'] !== null) $v['distance'] = round(appli_distance(['lat' => $chauffeur['lat'], 'lng' => $chauffeur['lng']], $d['depart']));
  if ($offre) {
    $v['client'] = ['prenom' => (string)($voyageur['prenom'] ?? 'Client'), 'note' => appli_note_client((int)$c['client_id'])];
  } else {
    $v['client'] = ['prenom' => (string)($voyageur['prenom'] ?? 'Client'), 'tel' => (string)($voyageur['tel'] ?? ''), 'note' => appli_note_client((int)$c['client_id'])];
    // bon de réservation à présenter en cas de contrôle (réservation préalable obligatoire)
    $v['bon'] = ['client' => trim(($client['prenom'] ?? '') . ' ' . ($client['nom'] ?? '')), 'tel' => (string)($client['tel'] ?? ''), 'passager' => $d['passager'] ?? null, 'reserveLe' => $c['cree']];
  }
  return $v;
}
function appli_note_client(int $client): string
{
  $st = db()->prepare('SELECT AVG(note_chauffeur) m, COUNT(*) n FROM courses WHERE client_id = ? AND note_chauffeur > 0');
  $st->execute([$client]);
  $r = $st->fetch();
  return (int)$r['n'] > 0 ? number_format((float)$r['m'], 1, ',', '') : 'Nouveau';
}
function appli_messages(int $course, int $apres): array
{
  $st = db()->prepare('SELECT id, auteur, texte, cree FROM courses_messages WHERE course_id = ? AND id > ? ORDER BY id LIMIT 200');
  $st->execute([$course, $apres]);
  return array_map(fn($m) => ['id' => (int)$m['id'], 'de' => $m['auteur'], 'texte' => $m['texte'], 't' => $m['cree']], $st->fetchAll());
}

/* ---------- Notifications sur les téléphones (appli client et appli chauffeur) ----------
   Comme pour l'admin : rien de personnel dans le texte, l'envoi part après la réponse. */
function appli_push(string $role, int $compte, string $titre, string $texte, string $url, string $tag): void
{
  $GLOBALS['__appli_push'][] = compact('role', 'compte', 'titre', 'texte', 'url', 'tag');
  static $inscrit = false;
  if (!$inscrit) { $inscrit = true; register_shutdown_function('appli_push_fin'); }
}
function appli_push_fin(): void
{
  $liste = $GLOBALS['__appli_push'] ?? [];
  $GLOBALS['__appli_push'] = [];
  if (!$liste) return;
  ignore_user_abort(true);
  if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
  try {
    require_once __DIR__ . '/veille/outils.php';
    require_once __DIR__ . '/veille/webpush.php';
    if (veille_env('VAPID_PUBLIC_KEY') === '') return;
    foreach ($liste as $n) {
      $st = db()->prepare('SELECT * FROM appli_push WHERE role = ? AND compte_id = ?');
      $st->execute([$n['role'], $n['compte']]);
      foreach ($st->fetchAll() as $abo) {
        try {
          $code = webpush_envoyer($abo, ['title' => $n['titre'], 'body' => $n['texte'], 'url' => $n['url'], 'tag' => $n['tag']]);
          if ($code === 404 || $code === 410) db()->prepare('DELETE FROM appli_push WHERE id = ?')->execute([$abo['id']]);
        } catch (Throwable $e) {
          error_log('[BDA appli push] ' . $e->getMessage());
        }
      }
    }
  } catch (Throwable $e) {
    error_log('[BDA appli push] ' . $e->getMessage());
  }
}

/* ---------- Reçu envoyé par e-mail à la fin de la course ---------- */
function appli_recu(array $c): string
{
  $d = $c['data'];
  $cfg = appli_cfg();
  $l = $cfg['legal'];
  $g = $cfg['gammes'][$c['gamme']]['nom'] ?? $c['gamme'];
  $eur = fn(float $n) => number_format($n, $n == floor($n) ? 0 : 2, ',', ' ') . ' €';
  $lignes = [
    'Bonjour ' . ($d['client']['prenom'] ?? '') . ',', '',
    'Merci d’avoir voyagé avec BDASH. Voici le reçu de votre course.', '',
    'Course n° ' . $c['numero'],
    'Date : ' . date('d/m/Y', strtotime((string)($c['debut'] ?: $c['quand']))) . ', de ' . date('H\hi', strtotime((string)($c['debut'] ?: $c['quand']))) . ' à ' . date('H\hi', strtotime((string)($c['fin'] ?: maintenant()))),
    'Départ : ' . trim(($d['depart']['titre'] ?? '') . ', ' . ($d['depart']['sous'] ?? ''), ', '),
  ];
  if (!empty($d['arret'])) $lignes[] = 'Arrêt : ' . $d['arret']['titre'];
  $lignes[] = $c['mode'] === 'dispo' ? 'Prestation : chauffeur à disposition ' . ($d['heures'] ?? '') . ' h' : 'Arrivée : ' . trim(($d['arrivee']['titre'] ?? '') . ', ' . ($d['arrivee']['sous'] ?? ''), ', ');
  $lignes[] = 'Véhicule : ' . $g . (!empty($d['chauffeur']['voiture']) ? ' (' . $d['chauffeur']['voiture'] . ')' : '') . ' · chauffeur ' . ($d['chauffeur']['prenom'] ?? '');
  $lignes[] = '';
  $lignes[] = 'Transport : ' . $eur((float)$c['transport']);
  if ((float)$c['remise'] > 0) $lignes[] = 'Code ' . ($d['promo'] ?? '') . ' : −' . $eur((float)$c['remise']);
  if ((float)$c['protection'] > 0) $lignes[] = 'Protection rapprochée (facturée à part par ' . 'BDASECURITE' . ') : ' . $eur((float)$c['protection']);
  $lignes[] = 'Total TTC : ' . $eur(appli_total($c));
  $lignes[] = 'Paiement : à bord, auprès du chauffeur';
  if ($l['tva'] !== '') $lignes[] = 'TVA : ' . $l['tva'];
  $lignes[] = '';
  $lignes[] = 'BDA SECURITE · Abdelouahab Bouidia, entrepreneur individuel · SIRET 977 933 316 00019';
  $lignes[] = '61 rue de la Croix Saint-Simon, 75020 Paris';
  $lignes[] = 'N° registre VTC : ' . ($l['evtc'] !== '' ? $l['evtc'] : 'à compléter');
  $lignes[] = '';
  $lignes[] = 'Une question ? Répondez à ce message ou appelez le 06 11 67 86 25.';
  return implode("\n", $lignes);
}
