<?php
/* =========================================================
   ROBOT DE PROSPECTION — trouve des lieux qui ont besoin d'agents de sécurité
   Catégories : chantiers, bars, boîtes de nuit, magasins, hôtels, restaurants (Île-de-France).
   Sources publiques, gratuites et sans compte :
   - OpenStreetMap (Overpass) : l'annuaire des lieux (nom, adresse, téléphone, site, horaires) ;
   - BODACC : ouvertures et reprises de fonds de commerce (sociétés seulement, jamais de particuliers) ;
   - Sitadel (permis de construire) : gros chantiers de logements, bureaux, commerces, hôtels ;
   - Ville de Paris : chantiers privés importants en cours.
   Chaque tâche a son rythme (annuaire chaque semaine, BODACC deux fois par jour…). Le lancement
   automatique de la veille (toutes les 30 min) fait les tâches en retard, le bouton de l'admin aussi.
   Les adresses manquantes sont retrouvées depuis les coordonnées (Géoplateforme de l'IGN).
   ========================================================= */
declare(strict_types=1);

require_once __DIR__ . '/outils.php';

const ROBOT_CATEGORIES = ['chantier' => 'Chantiers', 'bar' => 'Bars', 'club' => 'Boîtes de nuit', 'magasin' => 'Magasins', 'hotel' => 'Hôtels', 'restaurant' => 'Restaurants'];
const ROBOT_STATUTS = ['a_contacter', 'contacte', 'interesse', 'devis', 'client', 'refus', 'ignore'];
const ROBOT_DEPS = ['75', '77', '78', '91', '92', '93', '94', '95'];
const ROBOT_CADRE_IDF = '48.12,1.44,49.24,3.56'; // sud, ouest, nord, est
const ROBOT_OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const ROBOT_DIDO = 'https://data.statistiques.developpement-durable.gouv.fr/dido/api/v1/datafiles/';
const ROBOT_SITADEL_LOGEMENTS = '8b35affb-55fc-4c1f-915b-7750f974446a';
const ROBOT_SITADEL_LOCAUX = 'f8f0700f-806c-40a7-83b1-f21cf507e7c4';
const ROBOT_BODACC = 'https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records';
const ROBOT_PARIS = 'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/chantiers-perturbants/records';
// Une ouverture, une reprise ou un chantier récent compte pendant 90 jours (bonus de priorité)
const ROBOT_BONUS_SIGNAL = 30;
const ROBOT_JOURS_SIGNAL = 90;

// Ce que le robot cherche dans l'annuaire OpenStreetMap, catégorie par catégorie
const ROBOT_OSM = [
  'club' => 'nwr["amenity"="nightclub"]["name"];',
  'bar' => 'nwr["amenity"~"^(bar|pub|biergarten)$"]["name"];',
  'hotel' => 'nwr["tourism"~"^(hotel|hostel)$"]["name"];',
  'magasin' => 'nwr["shop"~"^(department_store|mall|supermarket|electronics|computer|hifi|video_games|mobile_phone|jewelry|watches|perfumery|cosmetics|luxury|bag)$"]["name"];'
    . 'nwr["shop"~"^(clothes|shoes|sports)$"]["name"]["brand"];',
  // Les restaurants sont trop nombreux : seulement ceux qu'on peut joindre (téléphone ou site)
  'restaurant' => 'nwr["amenity"="restaurant"]["name"][~"^(phone|contact:phone|website|contact:website)$"~"."];',
];
const ROBOT_MAGASINS = [
  'department_store' => [70, 'Grand magasin'], 'mall' => [70, 'Centre commercial'], 'supermarket' => [45, 'Supermarché'],
  'electronics' => [45, 'Électronique'], 'computer' => [40, 'Informatique'], 'hifi' => [40, 'Hi-fi'], 'video_games' => [40, 'Jeux vidéo'],
  'mobile_phone' => [45, 'Téléphonie'], 'jewelry' => [55, 'Bijouterie'], 'watches' => [55, 'Horlogerie'], 'perfumery' => [40, 'Parfumerie'],
  'cosmetics' => [40, 'Cosmétiques'], 'luxury' => [50, 'Boutique de luxe'], 'bag' => [40, 'Maroquinerie'],
  'clothes' => [35, 'Prêt-à-porter'], 'shoes' => [35, 'Chaussures'], 'sports' => [35, 'Articles de sport'],
];

/* ---------- Tâches et rythme ---------- */
function robot_taches(): array
{
  return [
    // les recherches rapides d'abord ; l'annuaire (plus lent) complète ensuite les ouvertures déjà trouvées
    'paris' => ['libelle' => 'Chantiers de Paris', 'source' => 'Ville de Paris', 'heures' => 24],
    'bodacc' => ['libelle' => 'Ouvertures et reprises', 'source' => 'BODACC (journal officiel)', 'heures' => 12],
    'sitadel' => ['libelle' => 'Gros chantiers', 'source' => 'Permis de construire (Sitadel)', 'heures' => 24],
    'osm:club' => ['libelle' => 'Boîtes de nuit', 'source' => 'Annuaire OpenStreetMap', 'heures' => 168],
    'osm:bar' => ['libelle' => 'Bars', 'source' => 'Annuaire OpenStreetMap', 'heures' => 168],
    'osm:hotel' => ['libelle' => 'Hôtels', 'source' => 'Annuaire OpenStreetMap', 'heures' => 168],
    'osm:magasin' => ['libelle' => 'Magasins', 'source' => 'Annuaire OpenStreetMap', 'heures' => 168],
    'osm:restaurant' => ['libelle' => 'Restaurants', 'source' => 'Annuaire OpenStreetMap', 'heures' => 168],
  ];
}
function robot_etat(): array
{
  $e = json_decode((string)(db()->query("SELECT v FROM reglages WHERE k = 'robot_etat'")->fetchColumn() ?: ''), true);
  return is_array($e) ? $e : [];
}
function robot_etat_enregistrer(array $e): void
{
  db()->prepare("INSERT INTO reglages (k, v) VALUES ('robot_etat', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")->execute([json_encode($e, JSON_UNESCAPED_UNICODE)]);
}

// Lance les tâches en retard (ou celles demandées) dans la limite de temps donnée
function robot_lancer(string $origine = 'auto', array $forcer = [], int $budget = 200): array
{
  @set_time_limit($budget + 80);
  // Verrou dans la base (le verrou de fichier ne tient pas sur le disque partagé d'OVH) : un seul passage à la fois ;
  // un passage coupé par le serveur libère la place au bout de 10 minutes
  $db = db();
  $db->exec("INSERT OR IGNORE INTO reglages (k, v) VALUES ('robot_verrou', '')");
  $st = $db->prepare("UPDATE reglages SET v = ? WHERE k = 'robot_verrou' AND (v = '' OR v < ?)");
  $st->execute([veille_maintenant(), date('Y-m-d H:i:s', time() - 600)]);
  if ($st->rowCount() !== 1) return ['ok' => false, 'message' => 'Le robot est déjà en train de chercher.'];
  $debut = microtime(true);
  $faites = [];
  $nouveaux = [];
  try {
    $etat = robot_etat();
    foreach (robot_taches() as $cle => $t) {
      // tâche commencée il y a plus de 15 min sans résultat : le serveur l'a coupée (trop longue) → comptée en erreur
      $commence = (string)($etat['taches'][$cle]['en_cours'] ?? '');
      if ($commence !== '' && strtotime($commence) < time() - 900) {
        $etat['taches'][$cle] = array_merge($etat['taches'][$cle], ['ok' => false, 'quand' => $commence, 'echec_le' => $commence, 'en_cours' => '', 'message' => 'Recherche coupée par le serveur (trop longue). Nouvel essai plus tard.']);
        robot_etat_enregistrer($etat);
      }
      if ($forcer && !in_array($cle, $forcer, true)) continue;
      $derniere = (string)($etat['taches'][$cle]['ok_le'] ?? '');
      $enRetard = $derniere === '' || strtotime($derniere) < time() - $t['heures'] * 3600;
      // après une erreur (serveur saturé), on attend 45 min avant de réessayer (sauf demande manuelle)
      $echec = (string)($etat['taches'][$cle]['echec_le'] ?? '');
      if (!$forcer && $echec !== '' && strtotime($echec) > time() - 2700) $enRetard = false;
      if (!$enRetard && !$forcer) continue;
      if (microtime(true) - $debut > $budget) break;
      $journal = [];
      $t0 = microtime(true);
      $etat['taches'][$cle] = array_merge($etat['taches'][$cle] ?? [], ['en_cours' => veille_maintenant()]);
      robot_etat_enregistrer($etat);
      try {
        $r = robot_tache($cle, empty($etat['taches'][$cle]['ok_le']), $journal);
        $etat['taches'][$cle] = ['ok' => true, 'ok_le' => veille_maintenant(), 'quand' => veille_maintenant(), 'message' => implode(' ', $journal),
          'trouves' => $r['trouves'], 'nouveaux' => $r['nouveaux'], 'signaux' => $r['signaux'], 'duree' => round(microtime(true) - $t0, 1)];
        // copie de départ utilisée : on redemandera la carte dans 2 h au lieu d'une semaine
        if (!empty($r['amorce'])) $etat['taches'][$cle]['ok_le'] = date('Y-m-d H:i:s', time() - ($t['heures'] - 2) * 3600);
        // gardées dans l'état : si le serveur coupe la suite, la notification partira au passage suivant
        $etat['a_notifier'] = array_values(array_unique(array_merge($etat['a_notifier'] ?? [], $r['ids'])));
      } catch (Throwable $e) {
        error_log("[BDA robot $cle] " . $e->getMessage());
        $etat['taches'][$cle] = array_merge($etat['taches'][$cle] ?? [], ['ok' => false, 'quand' => veille_maintenant(), 'echec_le' => veille_maintenant(), 'en_cours' => '', 'message' => $e->getMessage()]);
      }
      $faites[] = $cle;
      robot_etat_enregistrer($etat);
    }
    $nouveaux = array_values(array_unique(array_map('intval', $etat['a_notifier'] ?? [])));
    $etat['a_notifier'] = [];
    $etat['derniere'] = ['quand' => veille_maintenant(), 'origine' => $origine, 'taches' => $faites, 'duree' => round(microtime(true) - $debut, 1)];
    robot_etat_enregistrer($etat);
    if ($nouveaux) {
      journal('site', 'Robot de prospection : ' . count($nouveaux) . ' nouvelle(s) piste(s)');
      robot_notifier($nouveaux);
    }
    return ['ok' => true, 'taches' => $faites, 'nouvelles' => count(array_unique($nouveaux)), 'etat' => $etat];
  } finally {
    $db->exec("UPDATE reglages SET v = '' WHERE k = 'robot_verrou'");
  }
}
function robot_tache(string $cle, bool $premiere, array &$journal): array
{
  if (str_starts_with($cle, 'osm:')) return robot_osm(substr($cle, 4), $journal);
  if ($cle === 'bodacc') return robot_bodacc($premiere ? 60 : 4, $journal);
  if ($cle === 'sitadel') return robot_sitadel($journal);
  if ($cle === 'paris') return robot_paris($journal);
  throw new RuntimeException('Tâche inconnue.');
}

/* ---------- Petits outils ---------- */
// Clé de comparaison d'un nom d'établissement (sans forme juridique ni ponctuation)
function robot_cle_nom(string $nom): string
{
  $n = trim(veille_normaliser($nom));
  $n = (string)preg_replace('/\b(sas|sasu|sarl|eurl|sa|snc|sci|sccv|ste|societe|ets|etablissements|le|la|les|l|the|chez)\b/', ' ', $n);
  return (string)preg_replace('/[^a-z0-9]/', '', $n);
}
function robot_tel(string $t): string
{
  $t = trim(explode(';', $t)[0]);
  $c = (string)preg_replace('/[^\d+]/', '', $t);
  if (str_starts_with($c, '+33')) $c = '0' . substr($c, 3);
  elseif (str_starts_with($c, '0033')) $c = '0' . substr($c, 4);
  if (preg_match('/^0\d{9}$/', $c)) return trim(chunk_split($c, 2, ' '));
  return mb_substr($t, 0, 30);
}
function robot_site(string $u): string
{
  $u = trim(explode(';', $u)[0]);
  if ($u !== '' && !preg_match('#^https?://#i', $u)) $u = 'https://' . $u;
  return filter_var($u, FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $u) ? mb_substr($u, 0, 300) : '';
}
function robot_dep(string $cp): string
{
  $d = substr($cp, 0, 2);
  return in_array($d, ROBOT_DEPS, true) ? $d : '';
}
// Heure de fermeture après minuit d'après les horaires OpenStreetMap (0 = ferme avant minuit ou inconnu)
function robot_fermeture(string $h): int
{
  if ($h === '') return 0;
  if (stripos($h, '24/7') !== false) return 24;
  $max = 0;
  if (preg_match_all('/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/', $h, $m, PREG_SET_ORDER)) {
    foreach ($m as $x) {
      $deb = (int)$x[1] * 60 + (int)$x[2];
      $fin = (int)$x[3] * 60 + (int)$x[4];
      if ($fin > 1440) $f = $fin - 1440;
      elseif ($fin <= $deb && $fin > 0 && $fin <= 720) $f = $fin;
      else continue;
      $max = max($max, (int)ceil($f / 60));
    }
  }
  return $max;
}
function robot_nb(float $n): string
{
  return number_format($n, 0, ',', ' ');
}

/* ---------- Note de priorité (0 à 100) et raisons, sans le bonus d'ouverture récente ---------- */
function robot_base(string $cat, array $t, string $tel, string $site): array
{
  $s = 0;
  $atouts = [];
  $tard = robot_fermeture((string)($t['opening_hours'] ?? ''));
  switch ($cat) {
    case 'club':
      $s = 70; $atouts[] = 'Établissement de nuit';
      if ($tard >= 5) { $s += 10; $atouts[] = $tard >= 24 ? 'Ouvert jour et nuit' : "Ouvert jusqu’à {$tard} h"; }
      break;
    case 'bar':
      $s = 30;
      if ($tard >= 2) { $s += $tard >= 4 ? 30 : 25; $atouts[] = $tard >= 24 ? 'Ouvert jour et nuit' : "Ouvert jusqu’à {$tard} h"; }
      if (($t['nightclub'] ?? '') === 'yes' || ($t['dance'] ?? '') === 'yes' || preg_match('/club|dancing|lounge/i', (string)($t['name'] ?? ''))) { $s += 15; $atouts[] = 'Ambiance de nuit'; }
      if (($t['amenity'] ?? '') === 'pub') $atouts[] = 'Pub';
      break;
    case 'hotel':
      $s = 30;
      $etoiles = (int)preg_replace('/\D/', '', (string)($t['stars'] ?? ''));
      if ($etoiles >= 5) { $s += 35; $atouts[] = '5 étoiles'; }
      elseif ($etoiles === 4) { $s += 25; $atouts[] = '4 étoiles'; }
      elseif ($etoiles === 3) { $s += 10; $atouts[] = '3 étoiles'; }
      $ch = (int)preg_replace('/\D/', '', (string)($t['rooms'] ?? ''));
      if ($ch >= 150) { $s += 15; $atouts[] = "$ch chambres"; } elseif ($ch >= 80) { $s += 10; $atouts[] = "$ch chambres"; }
      if (($t['tourism'] ?? '') === 'hostel') { $s += 10; $atouts[] = 'Auberge de jeunesse (passage, nuit)'; }
      break;
    case 'magasin':
      [$s, $lib] = ROBOT_MAGASINS[$t['shop'] ?? ''] ?? [30, 'Commerce'];
      $atouts[] = $lib;
      if (($t['shop'] ?? '') === 'supermarket' && preg_match('/hyper|carrefour|auchan|leclerc|intermarch|monoprix|franprix|lidl|casino|super u|g20|naturalia|picard|aldi/i', (string)($t['name'] ?? '') . ' ' . ($t['brand'] ?? ''))) { $s += 10; $atouts[] = 'Enseigne de supermarché'; }
      elseif (!empty($t['brand'])) { $s += 5; $atouts[] = 'Enseigne connue'; }
      break;
    case 'restaurant':
      $s = 15;
      if ($tard >= 1) { $s += $tard >= 3 ? 25 : 20; $atouts[] = "Ouvert tard (jusqu’à {$tard} h)"; }
      $cap = (int)preg_replace('/\D/', '', (string)($t['capacity'] ?? ''));
      if ($cap >= 150) { $s += 15; $atouts[] = "$cap couverts"; }
      if (preg_match('/club|lounge|cabaret|dinner|dîner spectacle/i', (string)($t['name'] ?? ''))) { $s += 10; $atouts[] = 'Soirées'; }
      break;
  }
  if ($tel !== '') $s += 5;
  if ($site !== '') $s += 3;
  return [min(100, $s), $atouts];
}

/* ---------- Écriture en base ---------- */
// Ajoute ou met à jour une piste ; garde toujours le statut, la note et la relance saisis dans l'admin
// $signaler = false : premier remplissage d'une catégorie, ce n'est pas une nouveauté à annoncer
function robot_enregistrer(array $p, bool $remplacerAdresse = true, bool $signaler = true): array
{
  $db = db();
  $st = $db->prepare('SELECT id, adresse, cp, ville, signal_date FROM prospects WHERE cle = ?');
  $st->execute([$p['cle']]);
  $ex = $st->fetch();
  $mtn = veille_maintenant();
  $champs = ['categorie', 'source', 'nom', 'activite', 'adresse', 'cp', 'ville', 'dep', 'lat', 'lon', 'tel', 'mail', 'site', 'horaires', 'siren', 'base', 'atouts', 'infos'];
  $v = [];
  foreach ($champs as $c) $v[$c] = $p[$c] ?? (in_array($c, ['lat', 'lon'], true) ? null : ($c === 'base' ? 0 : ($c === 'atouts' ? '[]' : ($c === 'infos' ? '{}' : ''))));
  if (is_array($v['atouts'])) $v['atouts'] = json_encode(array_values(array_unique($v['atouts'])), JSON_UNESCAPED_UNICODE);
  if (is_array($v['infos'])) $v['infos'] = json_encode($v['infos'], JSON_UNESCAPED_UNICODE);
  $v['nom'] = mb_substr((string)$v['nom'], 0, 160);
  $v['activite'] = mb_substr((string)$v['activite'], 0, 200);
  if ($ex) {
    // une adresse trouvée avant (ou corrigée) n'est pas effacée par une source qui n'en a pas
    if (!$remplacerAdresse || $v['adresse'] === '') { $v['adresse'] = $ex['adresse']; if ($v['cp'] === '') $v['cp'] = $ex['cp']; if ($v['ville'] === '') $v['ville'] = $ex['ville']; }
    $sets = implode(', ', array_map(fn($c) => "$c = :$c", $champs));
    $db->prepare("UPDATE prospects SET $sets, actif = 1, vu_source = :vs, maj = :maj WHERE id = :id")->execute($v + ['vs' => $mtn, 'maj' => $mtn, 'id' => $ex['id']]);
    $id = (int)$ex['id'];
    $nouveau = false;
  } else {
    $cols = implode(', ', $champs);
    $vals = implode(', ', array_map(fn($c) => ":$c", $champs));
    $db->prepare("INSERT INTO prospects (cle, $cols, vu_source, nouveau_le, cree, maj) VALUES (:cle, $vals, :vs, :nl, :cree, :maj)")->execute($v + ['cle' => $p['cle'], 'vs' => $mtn, 'nl' => $signaler ? $mtn : '', 'cree' => $mtn, 'maj' => $mtn]);
    $id = (int)$db->lastInsertId();
    $nouveau = true;
  }
  if (!empty($p['signal'])) robot_signal($id, (string)$p['signal'], (string)$p['signal_date']);
  return ['id' => $id, 'nouveau' => $nouveau];
}
// Fait marquant (ouverture, reprise, chantier) : la piste remonte en tête et compte comme nouvelle
function robot_signal(int $id, string $texte, string $date): bool
{
  $st = db()->prepare('SELECT signal, signal_date FROM prospects WHERE id = ?');
  $st->execute([$id]);
  $ex = $st->fetch();
  if (!$ex || ($ex['signal'] === $texte && $ex['signal_date'] === $date)) return false;
  if ($ex['signal_date'] !== '' && $ex['signal_date'] > $date) return false;
  db()->prepare('UPDATE prospects SET signal = ?, signal_date = ?, nouveau_le = ?, maj = ? WHERE id = ?')->execute([mb_substr($texte, 0, 300), $date, veille_maintenant(), veille_maintenant(), $id]);
  return true;
}

/* ---------- Adresses retrouvées depuis les coordonnées (Géoplateforme IGN, envoi en lot) ---------- */
function robot_adresses(array $points): array
{
  $res = [];
  foreach (array_chunk($points, 3000, true) as $paquet) {
    $ids = [];
    $csv = "id,lat,lon\n";
    $i = 0;
    foreach ($paquet as $cle => [$lat, $lon]) { $ids[$i] = $cle; $csv .= $i . ',' . round((float)$lat, 7) . ',' . round((float)$lon, 7) . "\n"; $i++; }
    $limite = '----bda' . bin2hex(random_bytes(8));
    $corps = "--$limite\r\nContent-Disposition: form-data; name=\"data\"; filename=\"points.csv\"\r\nContent-Type: text/csv\r\n\r\n$csv\r\n--$limite--\r\n";
    try {
      $r = veille_http('POST', 'https://data.geopf.fr/geocodage/reverse/csv', ["Content-Type: multipart/form-data; boundary=$limite"], $corps, 120);
    } catch (Throwable $e) {
      continue; // sans adresse, la piste garde ses coordonnées (lien vers la carte)
    }
    if ($r['code'] !== 200) continue;
    $lignes = preg_split('/\r\n|\n/', trim($r['corps']));
    $tete = str_getcsv((string)array_shift($lignes));
    foreach ($lignes as $l) {
      $x = @array_combine($tete, str_getcsv($l));
      if (!$x || !isset($ids[(int)$x['id']]) || ($x['result_status'] ?? '') !== 'ok') continue;
      $proche = (float)($x['result_distance'] ?? 999) <= 60;
      $res[$ids[(int)$x['id']]] = [
        'adresse' => $proche ? trim(($x['result_housenumber'] ?? '') . ' ' . ($x['result_street'] ?? $x['result_name'] ?? '')) : '',
        'cp' => (string)($x['result_postcode'] ?? ''),
        'ville' => (string)($x['result_city'] ?? ''),
      ];
    }
  }
  return $res;
}

/* ---------- Annuaire OpenStreetMap ---------- */
// Recherche dans un cadre autour de l'Île-de-France (bien plus rapide qu'une zone) : les lieux hors région
// sont écartés ensuite grâce au code postal. Plusieurs serveurs, car ils sont souvent saturés.
function robot_overpass(string $requete): array
{
  // déjà en panne pendant ce passage : on n'attend pas encore 3 minutes pour la catégorie suivante
  static $enPanne = '';
  if ($enPanne !== '') throw new RuntimeException($enPanne);
  $q = '[out:json][timeout:150][bbox:' . ROBOT_CADRE_IDF . "];($requete);out center tags;";
  $err = '';
  $debut = microtime(true);
  foreach (ROBOT_OVERPASS as $url) {
    $reste = 170 - (int)(microtime(true) - $debut);
    if ($reste < 30) break;
    try {
      $r = veille_http('POST', $url, ['Content-Type: application/x-www-form-urlencoded'], http_build_query(['data' => $q]), min(110, $reste));
      if ($r['code'] === 200) {
        $j = json_decode($r['corps'], true);
        if (is_array($j) && isset($j['elements'])) return $j['elements'];
        $err = 'réponse illisible';
      } else {
        $err = "HTTP {$r['code']}";
      }
    } catch (Throwable $e) {
      $err = $e->getMessage();
    }
  }
  $enPanne = "L'annuaire OpenStreetMap ne répond pas ($err). Nouvel essai plus tard.";
  throw new RuntimeException($enPanne);
}
function robot_activite(string $cat, array $t): string
{
  switch ($cat) {
    case 'club': return 'Boîte de nuit';
    case 'bar': return ['pub' => 'Pub', 'biergarten' => 'Bar en plein air'][$t['amenity'] ?? ''] ?? 'Bar';
    case 'hotel':
      $e = (int)preg_replace('/\D/', '', (string)($t['stars'] ?? ''));
      return (($t['tourism'] ?? '') === 'hostel' ? 'Auberge de jeunesse' : 'Hôtel') . ($e > 0 && $e <= 5 ? " $e étoile" . ($e > 1 ? 's' : '') : '');
    case 'magasin': return (ROBOT_MAGASINS[$t['shop'] ?? ''][1] ?? 'Commerce') . (!empty($t['brand']) && mb_strtolower((string)$t['brand']) !== mb_strtolower((string)($t['name'] ?? '')) ? ' · ' . $t['brand'] : '');
    case 'restaurant':
      $c = (string)($t['cuisine'] ?? '');
      $cuisines = ['french' => 'française', 'italian' => 'italienne', 'pizza' => 'pizzas', 'japanese' => 'japonaise', 'chinese' => 'chinoise', 'indian' => 'indienne', 'lebanese' => 'libanaise', 'moroccan' => 'marocaine', 'thai' => 'thaïe', 'asian' => 'asiatique', 'burger' => 'burgers', 'sushi' => 'sushis', 'regional' => 'régionale', 'vietnamese' => 'vietnamienne', 'korean' => 'coréenne', 'turkish' => 'turque', 'african' => 'africaine', 'seafood' => 'fruits de mer', 'steak_house' => 'grillades', 'mexican' => 'mexicaine', 'greek' => 'grecque', 'spanish' => 'espagnole', 'portuguese' => 'portugaise', 'american' => 'américaine', 'brasserie' => 'brasserie'];
      $premiere = explode(';', $c)[0];
      return 'Restaurant' . (isset($cuisines[$premiere]) ? ' · cuisine ' . $cuisines[$premiere] : '');
  }
  return '';
}
function robot_osm(string $cat, array &$journal): array
{
  if (!isset(ROBOT_OSM[$cat])) throw new RuntimeException('Catégorie inconnue.');
  $db = db();
  $mtn = veille_maintenant();
  // adresses déjà connues (pour ne pas les redemander)
  $connues = [];
  $st = $db->prepare("SELECT cle, adresse, cp, ville FROM prospects WHERE source = 'osm' AND categorie = ?");
  $st->execute([$cat]);
  foreach ($st->fetchAll() as $r) $connues[$r['cle']] = $r;
  // pistes ouvertes depuis le BODACC qui peuvent correspondre à un lieu de l'annuaire
  $bodacc = [];
  $st = $db->prepare("SELECT id, nom, cp FROM prospects WHERE source = 'bodacc' AND categorie = ?");
  $st->execute([$cat]);
  foreach ($st->fetchAll() as $r) $bodacc[robot_cle_nom($r['nom']) . '|' . $r['cp']] = (int)$r['id'];

  $pistes = [];
  $manque = [];
  $amorce = [];
  try {
    $elements = robot_overpass(ROBOT_OSM[$cat]);
  } catch (Throwable $e) {
    // Carte saturée (ou qui refuse le serveur OVH) et catégorie encore vide : on part de la copie
    // de l'annuaire livrée avec le site (app/veille/amorce), remplacée dès que la carte répond
    $amorce = $connues ? [] : robot_amorce($cat);
    if (!$amorce) throw $e;
    $elements = [];
    foreach ($amorce as $p) $pistes[$p['cle']] = $p;
  }
  foreach ($elements as $e) {
    $t = $e['tags'] ?? [];
    $nom = trim((string)($t['name'] ?? ''));
    $lat = $e['lat'] ?? $e['center']['lat'] ?? null;
    $lon = $e['lon'] ?? $e['center']['lon'] ?? null;
    if ($nom === '' || $lat === null) continue;
    if (($t['disused'] ?? '') === 'yes' || isset($t['disused:amenity'])) continue;
    $cle = 'osm:' . $e['type'] . '/' . $e['id'];
    $cp = (string)preg_replace('/\D/', '', (string)($t['addr:postcode'] ?? ''));
    $rue = trim(($t['addr:housenumber'] ?? '') . ' ' . ($t['addr:street'] ?? ($t['addr:place'] ?? '')));
    $tel = robot_tel((string)($t['phone'] ?? $t['contact:phone'] ?? $t['contact:mobile'] ?? ''));
    $site = robot_site((string)($t['website'] ?? $t['contact:website'] ?? $t['contact:facebook'] ?? $t['contact:instagram'] ?? ''));
    $mail = filter_var(trim((string)($t['email'] ?? $t['contact:email'] ?? '')), FILTER_VALIDATE_EMAIL) ?: '';
    [$base, $atouts] = robot_base($cat, $t, $tel, $site);
    $p = [
      'cle' => $cle, 'categorie' => $cat, 'source' => 'osm', 'nom' => $nom, 'activite' => robot_activite($cat, $t),
      'adresse' => $rue, 'cp' => strlen($cp) === 5 ? $cp : '', 'ville' => trim((string)($t['addr:city'] ?? '')),
      'lat' => (float)$lat, 'lon' => (float)$lon, 'tel' => $tel, 'mail' => $mail, 'site' => $site,
      'horaires' => mb_substr((string)($t['opening_hours'] ?? ''), 0, 200), 'base' => $base, 'atouts' => $atouts,
      'infos' => array_filter(['marque' => (string)($t['brand'] ?? ''), 'exploitant' => (string)($t['operator'] ?? ''), 'osm' => $e['type'] . '/' . $e['id']]),
    ];
    // adresse incomplète : celle déjà trouvée, sinon on la demandera à l'IGN
    if ($p['adresse'] === '' || $p['cp'] === '') {
      $k = $connues[$cle] ?? null;
      if ($k && $k['cp'] !== '') { $p['adresse'] = $p['adresse'] ?: $k['adresse']; $p['cp'] = $k['cp']; $p['ville'] = $p['ville'] ?: $k['ville']; }
      else $manque[$cle] = [$lat, $lon];
    }
    $pistes[$cle] = $p;
  }
  if ($manque) {
    foreach (robot_adresses($manque) as $cle => $a) {
      if ($pistes[$cle]['adresse'] === '') $pistes[$cle]['adresse'] = $a['adresse'];
      if ($pistes[$cle]['cp'] === '') $pistes[$cle]['cp'] = $a['cp'];
      if ($pistes[$cle]['ville'] === '') $pistes[$cle]['ville'] = $a['ville'];
    }
  }
  $nouveaux = 0;
  $fusions = 0;
  $gardes = 0;
  $db->beginTransaction();
  try {
    foreach ($pistes as $cle => $p) {
      $p['dep'] = robot_dep($p['cp']);
      if ($p['dep'] === '') continue; // hors Île-de-France (ou adresse introuvable : nouvel essai au prochain passage)
      $gardes++;
      if ($p['ville'] === '' && $p['dep'] === '75') $p['ville'] = 'Paris';
      // même lieu déjà ouvert depuis le BODACC : on le complète au lieu de le doubler
      $k = robot_cle_nom($p['nom']) . '|' . $p['cp'];
      if (!isset($connues[$cle]) && isset($bodacc[$k])) {
        $db->prepare('UPDATE prospects SET cle = ?, source = ? WHERE id = ?')->execute([$cle, 'osm', $bodacc[$k]]);
        unset($bodacc[$k]);
        $fusions++;
      }
      $r = robot_enregistrer($p, true, (bool)$connues);
      if ($r['nouveau']) $nouveaux++;
    }
    // lieux disparus de l'annuaire (fermés) : retirés, sauf ceux déjà suivis dans l'admin
    if ($gardes >= 0.6 * count($connues)) {
      $db->prepare("UPDATE prospects SET actif = 0 WHERE source = 'osm' AND categorie = ? AND vu_source < ? AND statut = 'a_contacter' AND note = ''")->execute([$cat, $mtn]);
    }
    $db->commit();
  } catch (Throwable $e) {
    $db->rollBack();
    throw $e;
  }
  $journal[] = $amorce ? "La carte ne répond pas : $gardes lieux repris de la copie de l’annuaire du " . robot_amorce_date() . ', mise à jour dès qu’elle répond.'
    : "$gardes lieux en Île-de-France dans l’annuaire, $nouveaux nouveaux" . ($fusions ? ", $fusions complétés" : '') . ($manque ? ', ' . count($manque) . ' adresses retrouvées par la carte.' : '.');
  // le premier remplissage de l'annuaire n'est pas une « nouveauté » à signaler
  return ['trouves' => $gardes, 'nouveaux' => $nouveaux, 'signaux' => 0, 'ids' => [], 'amorce' => (bool)$amorce];
}
// Copie de départ de l'annuaire, une par catégorie (fichiers JSON compressés, lieux publics d'OpenStreetMap)
function robot_amorce(string $cat): array
{
  $f = __DIR__ . "/amorce/$cat.json.gz";
  if (!is_file($f)) return [];
  $lignes = json_decode((string)gzdecode((string)file_get_contents($f)), true);
  if (!is_array($lignes)) return [];
  return array_map(fn($p) => $p + ['categorie' => $cat, 'source' => 'osm'], $lignes);
}
function robot_amorce_date(): string
{
  $f = __DIR__ . '/amorce/date.txt';
  return is_file($f) ? trim((string)file_get_contents($f)) : 'départ';
}

/* ---------- BODACC : ouvertures et reprises de fonds de commerce ---------- */
const ROBOT_BODACC_MOTS = ['discothèque', 'boîte de nuit', 'night club', 'cabaret', 'dancing', 'débit de boissons', 'bar', 'pub', 'brasserie',
  'hôtel', 'hôtellerie', 'hébergement touristique', 'restaurant', 'supermarché', 'supérette', 'hypermarché', 'bijouterie', 'joaillerie', 'parfumerie', 'téléphonie'];
// Catégorie d'après l'activité déclarée (la plus « sécurité » d'abord)
function robot_bodacc_categorie(string $activite): string
{
  $a = trim(veille_normaliser($activite));
  // objets sociaux « fourre-tout », immobilier, vente en ligne, conseil : ce n'est pas un lieu ouvert au public
  if (preg_match('/^(l.)?(acquisition|detention|fabrication|creation, production)|biens (et droits )?immobiliers|marchand de biens|location nue|logements? meubles?|location meublee|courte duree|contenu multimedia|prises? de participations?|holding|en ligne|e-?commerce|conseil|consulting|negoce|import|export|disc[- ]?jockey|\bdj\b|production musicale|organisation d.(evenements|soirees|manifestations)|formation|food ?truck|traiteur|livraison a domicile/', $a)) return '';
  // seul le début compte : l'activité principale est écrite en premier
  $debut = mb_substr((string)preg_replace('/^(la )?societe a pour objet[^:a-z]*(en france et a l.etranger)?\s*[:,-]?\s*/', '', $a), 0, 160);
  $motifs = [
    'club' => '/discotheque|boite de nuit|night ?club|club de nuit|cabaret|dancing|bar de nuit|bar dansant|bar (a|d.) ?ambiance/',
    'hotel' => '/\bhotel(s|lerie|iere)?\b|hebergement touristique|residence de tourisme|appart ?hotel|auberge de jeunesse/',
    'bar' => '/debit de boissons|\bbars?\b|\bpubs?\b|brasserie|licence (iv|4|iii|3)|lounge|cafe[- ]bar|bar[- ]tabac/',
    'restaurant' => '/restaurant|\brestauration\b/',
    'magasin' => '/supermarche|superette|hypermarche|grand magasin|bijouterie|joaillerie|horlogerie/',
  ];
  $cat = '';
  $pos = PHP_INT_MAX;
  foreach ($motifs as $c => $re) if (preg_match($re, $debut, $m, PREG_OFFSET_CAPTURE) && $m[0][1] < $pos) { $pos = $m[0][1]; $cat = $c; }
  // un bar ou un restaurant qui annonce aussi une discothèque : piste de nuit
  if (in_array($cat, ['bar', 'restaurant'], true) && preg_match($motifs['club'], $debut)) return 'club';
  // restauration rapide sans alcool : pas de besoin d'agent
  if ($cat === 'restaurant' && preg_match('/fast ?food|restauration rapide|restaurant rapide|sans (vente (de|d.) ?)?(boissons? alcoolisees?|alcool)|snack|kebab|tacos|burger/', $a)) return '';
  if ($cat === 'hotel' && preg_match('/hotel de ville|hotel particulier/', $debut)) return '';
  return $cat;
}
function robot_bodacc(int $jours, array &$journal): array
{
  $depuis = (new DateTimeImmutable("-$jours days", new DateTimeZone('Europe/Paris')))->format('Y-m-d');
  $deps = "'" . implode("','", ROBOT_DEPS) . "'";
  $mots = implode(' or ', array_map(fn($m) => "search(listeetablissements, '" . str_replace("'", "\\'", $m) . "')", ROBOT_BODACC_MOTS));
  $where = "familleavis in ('creation','vente') and numerodepartement in ($deps) and dateparution >= date'$depuis' and ($mots)";
  $avis = [];
  for ($offset = 0; $offset <= 9900; $offset += 100) {
    $url = ROBOT_BODACC . '?' . http_build_query(['select' => 'id,dateparution,familleavis,commercant,ville,cp,registre,listepersonnes,listeetablissements,acte',
      'where' => $where, 'order_by' => 'dateparution desc', 'limit' => 100, 'offset' => $offset], '', '&', PHP_QUERY_RFC3986);
    $j = veille_json($url);
    foreach ($j['results'] ?? [] as $r) $avis[] = $r;
    if (count($j['results'] ?? []) < 100 || $offset + 100 >= (int)($j['total_count'] ?? 0)) break;
  }
  $db = db();
  $index = [];
  foreach ($db->query("SELECT id, categorie, nom, cp FROM prospects WHERE source = 'osm' AND actif = 1")->fetchAll() as $r) $index[$r['categorie'] . '|' . robot_cle_nom($r['nom']) . '|' . $r['cp']] = (int)$r['id'];
  $ids = [];
  $signaux = 0;
  $nouveaux = 0;
  $retenus = 0;
  foreach ($avis as $a) {
    $pers = json_decode((string)($a['listepersonnes'] ?? ''), true)['personne'] ?? null;
    if (isset($pers[0])) $pers = $pers[0];
    if (!is_array($pers) || ($pers['typePersonne'] ?? '') !== 'pm') continue; // sociétés seulement
    $etabs = json_decode((string)($a['listeetablissements'] ?? ''), true)['etablissement'] ?? null;
    if (!is_array($etabs)) continue;
    if (!isset($etabs[0])) $etabs = [$etabs];
    $etab = null;
    foreach ($etabs as $e) if (!empty($e['activite'])) { $etab = $e; break; }
    if (!$etab) continue;
    $cat = robot_bodacc_categorie((string)$etab['activite']);
    if ($cat === '') continue;
    $ad = $etab['adresse'] ?? [];
    $cp = (string)preg_replace('/\D/', '', (string)($ad['codePostal'] ?? $a['cp'] ?? ''));
    $dep = robot_dep($cp);
    if ($dep === '') continue;
    $retenus++;
    $denom = trim((string)($pers['denomination'] ?? $a['commercant'] ?? ''));
    $enseigne = trim((string)($etab['enseigne'] ?? $etab['nomCommercial'] ?? $pers['nomCommercial'] ?? ''));
    $nom = $enseigne !== '' ? $enseigne : $denom;
    if ($nom === '') continue;
    $acte = json_decode((string)($a['acte'] ?? ''), true) ?: [];
    $date = (string)($a['dateparution'] ?? '');
    $dateFr = $date !== '' ? date('d/m/Y', strtotime($date)) : '';
    $reprise = ($a['familleavis'] ?? '') === 'vente' || preg_match('/achat|acquisition|cession|location[- ]gerance/i', (string)($etab['origineFonds'] ?? ''));
    $signal = $reprise ? "Nouveau propriétaire : reprise publiée au BODACC le $dateFr" : "Nouvel établissement : ouverture publiée au BODACC le $dateFr";
    $debutAct = (string)($acte['dateCommencementActivite'] ?? '');
    if ($debutAct !== '' && !$reprise) $signal .= ' (activité depuis le ' . date('d/m/Y', strtotime($debutAct)) . ')';
    $siren = (string)preg_replace('/\D/', '', (string)(((array)($a['registre'] ?? []))[0] ?? ''));
    $k = $cat . '|' . robot_cle_nom($nom) . '|' . $cp;
    $kDenom = $cat . '|' . robot_cle_nom($denom) . '|' . $cp;
    $existant = $index[$k] ?? $index[$kDenom] ?? null;
    if ($existant) {
      if (robot_signal($existant, $signal, $date)) { $signaux++; $ids[] = $existant; }
      if ($siren !== '') $db->prepare("UPDATE prospects SET siren = ? WHERE id = ? AND siren = ''")->execute([$siren, $existant]);
      continue;
    }
    $rue = trim(implode(' ', array_filter([(string)($ad['numeroVoie'] ?? ''), (string)($ad['typeVoie'] ?? ''), (string)($ad['nomVoie'] ?? '')])));
    $activite = mb_strtoupper(mb_substr((string)$etab['activite'], 0, 1)) . mb_substr(trim((string)$etab['activite']), 1, 180);
    [$base] = robot_base($cat, [], '', '');
    $r = robot_enregistrer([
      'cle' => 'bodacc:' . ($siren !== '' ? $siren : md5($denom)) . ':' . $cp, 'categorie' => $cat, 'source' => 'bodacc', 'nom' => $nom,
      'activite' => $activite, 'adresse' => $rue, 'cp' => $cp, 'ville' => trim((string)($ad['ville'] ?? $a['ville'] ?? '')), 'dep' => $dep,
      'siren' => $siren, 'base' => $base, 'atouts' => [$reprise ? 'Vient de changer de propriétaire' : 'Vient d’ouvrir'],
      'infos' => array_filter(['societe' => $denom !== $nom ? $denom : '', 'bodacc' => (string)($a['id'] ?? '')]),
      'signal' => $signal, 'signal_date' => $date,
    ], false);
    if ($r['nouveau']) { $nouveaux++; $ids[] = $r['id']; }
  }
  $journal[] = count($avis) . " annonces lues sur $jours jours, $retenus ouvertures ou reprises de sociétés retenues : $nouveaux nouvelles pistes, $signaux lieux connus qui changent.";
  return ['trouves' => $retenus, 'nouveaux' => $nouveaux, 'signaux' => $signaux, 'ids' => $ids];
}

/* ---------- Permis de construire (Sitadel) : gros chantiers d'Île-de-France ---------- */
function robot_mois(int $n): array
{
  $m = [];
  for ($i = 0; $i < $n; $i++) $m[] = (new DateTimeImmutable("first day of -$i month", new DateTimeZone('Europe/Paris')))->format('Y-m');
  return $m;
}
function robot_dido(string $fichier, array $filtres, array $colonnes): array
{
  // millésime : le plus récent publié (les fichiers sont remis à jour chaque mois)
  static $millesimes = [];
  if (!isset($millesimes[$fichier])) {
    // le fichier du mois n'est pas toujours publié : on essaie ce mois-ci, puis les deux précédents
    foreach (robot_mois(3) as $m) {
      try {
        veille_json(ROBOT_DIDO . $fichier . '/rows?' . http_build_query(['millesime' => $m, 'page' => 1, 'pageSize' => 10, 'columns' => 'NUM_DAU'], '', '&', PHP_QUERY_RFC3986), [], 40);
        $millesimes[$fichier] = $m;
        break;
      } catch (Throwable $e) {
        if (!str_contains($e->getMessage(), '404')) throw $e;
      }
    }
    if (!isset($millesimes[$fichier])) throw new RuntimeException('Fichier des permis de construire introuvable pour les 3 derniers mois.');
  }
  $res = [];
  for ($page = 1; $page <= 20; $page++) {
    $q = array_merge(['millesime' => $millesimes[$fichier], 'page' => $page, 'pageSize' => 100, 'columns' => implode(',', $colonnes)], $filtres);
    $j = veille_json(ROBOT_DIDO . $fichier . '/rows?' . http_build_query($q, '', '&', PHP_QUERY_RFC3986), [], 60);
    foreach ($j['data'] ?? [] as $r) $res[] = $r;
    if (count($j['data'] ?? []) < 100) break;
  }
  return $res;
}
function robot_sitadel(array &$journal): array
{
  $deps = 'in:' . implode(',', ROBOT_DEPS);
  $ouverts = 'in:' . implode(',', robot_mois(6));   // chantiers ouverts ces 6 derniers mois
  $accordes = 'in:' . implode(',', robot_mois(4));  // permis accordés ces 4 derniers mois
  $base = ['NUM_DAU', 'DEP_CODE', 'DPC_AUT', 'DPC_DOC', 'DENOM_DEM', 'SIREN_DEM', 'ADR_NUM_TER', 'ADR_LIBVOIE_TER', 'ADR_LOCALITE_TER', 'ADR_CODPOST_TER', 'DATE_REELLE_DOC', 'DATE_REELLE_AUTORISATION'];
  $lignes = [];
  // une recherche par type de projet : si le site des permis tarde sur l'une, les autres sont gardées
  $recherches = [];
  foreach (['DPC_DOC' => $ouverts, 'DPC_AUT' => $accordes] as $champDate => $mois) {
    $recherches[] = [ROBOT_SITADEL_LOGEMENTS, ['DEP_CODE' => $deps, 'NB_LGT_TOT_CREES' => 'gte:30', $champDate => $mois], array_merge($base, ['NB_LGT_TOT_CREES'])];
    // locaux : un seuil par type de surface créée
    foreach (['SURF_BUR_CREEE' => 2000, 'SURF_COM_CREEE' => 1000, 'SURF_HEB_CREEE' => 800, 'SURF_ENT_CREEE' => 5000, 'SURF_PUB_CREEE' => 2000, 'SURF_IND_CREEE' => 5000] as $surf => $min) {
      $recherches[] = [ROBOT_SITADEL_LOCAUX, ['DEP_CODE' => $deps, $surf => "gte:$min", $champDate => $mois], array_merge($base, ['SURF_BUR_CREEE', 'SURF_COM_CREEE', 'SURF_HEB_CREEE', 'SURF_ENT_CREEE', 'SURF_PUB_CREEE', 'SURF_IND_CREEE', 'NB_CHAMBRES'])];
    }
  }
  $ratees = 0;
  $erreur = '';
  foreach ($recherches as [$fichier, $filtres, $colonnes]) {
    try {
      foreach (robot_dido($fichier, $filtres, $colonnes) as $r) $lignes[$r['NUM_DAU']] = ($lignes[$r['NUM_DAU']] ?? []) + $r;
    } catch (Throwable $e) {
      $ratees++;
      $erreur = $e->getMessage();
    }
  }
  if ($ratees === count($recherches)) throw new RuntimeException("Le site des permis de construire ne répond pas ($erreur).");
  if ($ratees) $journal[] = "$ratees recherche(s) sur " . count($recherches) . ' sans réponse (refaites au prochain passage).';
  $ids = [];
  $nouveaux = 0;
  $signaux = 0;
  $gardes = 0;
  foreach ($lignes as $num => $r) {
    $denom = trim((string)($r['DENOM_DEM'] ?? ''));
    if ($denom === '') continue; // particulier : jamais gardé
    $cp = (string)($r['ADR_CODPOST_TER'] ?? '');
    $parts = [];
    $s = 45;
    $atouts = [];
    $lgt = (int)($r['NB_LGT_TOT_CREES'] ?? 0);
    if ($lgt > 0) { $parts[] = "$lgt logements"; $s += min(30, intdiv($lgt, 5)); }
    $surfaces = ['SURF_BUR_CREEE' => 'm² de bureaux', 'SURF_COM_CREEE' => 'm² de commerces', 'SURF_HEB_CREEE' => 'm² d’hôtel ou d’hébergement', 'SURF_ENT_CREEE' => 'm² d’entrepôts', 'SURF_PUB_CREEE' => 'm² d’équipement public', 'SURF_IND_CREEE' => 'm² industriels'];
    $total = 0;
    foreach ($surfaces as $c => $lib) if ((float)($r[$c] ?? 0) >= 300) { $parts[] = robot_nb((float)$r[$c]) . " $lib"; $total += (float)$r[$c]; }
    if ($total > 0) $s += min(30, (int)($total / 400));
    $hotel = (float)($r['SURF_HEB_CREEE'] ?? 0) >= 800 || (int)($r['NB_CHAMBRES'] ?? 0) >= 50;
    if ($hotel) { $atouts[] = 'Futur hôtel : à rappeler aussi pour l’ouverture'; $s += 5; }
    $doc = (string)($r['DATE_REELLE_DOC'] ?? '');
    $aut = (string)($r['DATE_REELLE_AUTORISATION'] ?? '');
    // permis enregistré en retard : chantier ouvert il y a plus d'un an, ou permis ancien jamais commencé
    if ($doc !== '' ? strtotime($doc) < time() - 365 * 86400 : ($aut !== '' && strtotime($aut) < time() - 365 * 86400)) continue;
    $gardes++;
    if ($doc !== '') {
      $signal = 'Chantier ouvert le ' . date('d/m/Y', strtotime($doc)) . ' : ' . implode(', ', $parts);
      $dateSignal = $doc;
      $atouts[] = 'Chantier en cours';
      if (strtotime($doc) > time() - 92 * 86400) $s += 10;
    } else {
      $signal = 'Permis accordé' . ($aut !== '' ? ' le ' . date('d/m/Y', strtotime($aut)) : '') . ', chantier pas encore commencé : ' . implode(', ', $parts);
      $dateSignal = $aut !== '' ? $aut : date('Y-m-d');
      $atouts[] = 'Le bon moment : proposer le gardiennage avant le démarrage';
      $s += 15;
    }
    $rue = trim(((string)($r['ADR_NUM_TER'] ?? '')) . ' ' . ((string)($r['ADR_LIBVOIE_TER'] ?? '')));
    $ville = trim((string)preg_replace('/\s+\d+$/', '', (string)($r['ADR_LOCALITE_TER'] ?? '')));
    $res = robot_enregistrer([
      'cle' => 'sitadel:' . $num, 'categorie' => 'chantier', 'source' => 'sitadel', 'nom' => $denom,
      'activite' => 'Maître d’ouvrage · ' . implode(', ', $parts), 'adresse' => $rue, 'cp' => $cp,
      'ville' => $ville !== '' ? mb_convert_case(mb_strtolower($ville), MB_CASE_TITLE) : '', 'dep' => (string)($r['DEP_CODE'] ?? robot_dep($cp)),
      'siren' => (string)($r['SIREN_DEM'] ?? ''), 'base' => min(100, $s), 'atouts' => $atouts,
      'infos' => ['permis' => $num],
      'signal' => $signal, 'signal_date' => $dateSignal,
    ]);
    if ($res['nouveau']) { $nouveaux++; $ids[] = $res['id']; }
  }
  $journal[] = count($lignes) . " permis de construire lus, $gardes portés par une société : $nouveaux nouveaux chantiers.";
  return ['trouves' => $gardes, 'nouveaux' => $nouveaux, 'signaux' => $signaux, 'ids' => $ids];
}

/* ---------- Ville de Paris : chantiers privés importants (construction, réhabilitation) ---------- */
function robot_paris(array &$journal): array
{
  $auj = date('Y-m-d');
  $where = "typologie = 'Privé' and objet in ('CONSTRUCTION_IMMEUBLE','REHABILITATION_IMMEUBLE','REAMENAGEMENT_SECTEUR','TRAVAUX_OUVRAGE') and date_fin >= date'$auj'";
  $j = veille_json(ROBOT_PARIS . '?' . http_build_query(['select' => 'identifiant,cp_arrondissement,maitre_ouvrage,objet,description,voie,precision_localisation,date_debut,date_fin,statut,geo_point_2d', 'where' => $where, 'limit' => 100], '', '&', PHP_QUERY_RFC3986));
  $objets = ['CONSTRUCTION_IMMEUBLE' => 'Construction d’immeuble', 'REHABILITATION_IMMEUBLE' => 'Réhabilitation d’immeuble', 'REAMENAGEMENT_SECTEUR' => 'Réaménagement d’un secteur', 'TRAVAUX_OUVRAGE' => 'Travaux sur un ouvrage'];
  $ids = [];
  $nouveaux = 0;
  foreach ($j['results'] ?? [] as $r) {
    $moa = trim((string)($r['maitre_ouvrage'] ?? ''));
    if ($moa === '') continue;
    $deb = (string)($r['date_debut'] ?? '');
    $fin = (string)($r['date_fin'] ?? '');
    $mois = $deb !== '' && $fin !== '' ? max(1, (int)round((strtotime($fin) - strtotime($deb)) / (30 * 86400))) : 0;
    $s = 45 + min(25, $mois);
    $avenir = $deb !== '' && $deb > $auj;
    if ($avenir) $s += 10;
    $quoi = $objets[$r['objet'] ?? ''] ?? 'Chantier';
    $signal = ($avenir ? 'Chantier qui démarre le ' . date('d/m/Y', strtotime($deb)) : 'Chantier en cours') . ($fin !== '' ? ' jusqu’au ' . date('d/m/Y', strtotime($fin)) : '') . " : $quoi";
    $res = robot_enregistrer([
      'cle' => 'paris:' . $r['identifiant'], 'categorie' => 'chantier', 'source' => 'paris', 'nom' => $moa,
      'activite' => 'Maître d’ouvrage · ' . $quoi . (!empty($r['description']) ? ' · ' . trim((string)$r['description'], " -_") : ''),
      'adresse' => trim((string)preg_replace('/[\s,]*\d{5}_?\s*$/', '', (string)($r['voie'] ?? ''))), // la Ville ajoute parfois « 75004_ » à la fin 'cp' => (string)($r['cp_arrondissement'] ?? ''), 'ville' => 'Paris', 'dep' => '75',
      'lat' => $r['geo_point_2d']['lat'] ?? null, 'lon' => $r['geo_point_2d']['lon'] ?? null,
      'base' => min(100, $s), 'atouts' => array_values(array_filter([$mois >= 12 ? "Chantier long ($mois mois)" : '', $avenir ? 'Pas encore commencé' : ''])),
      'infos' => array_filter(['precision' => (string)($r['precision_localisation'] ?? '')]),
      'signal' => $signal, 'signal_date' => $avenir ? $auj : ($deb ?: $auj),
    ]);
    if ($res['nouveau']) { $nouveaux++; $ids[] = $res['id']; }
  }
  $journal[] = count($j['results'] ?? []) . " grands chantiers privés en cours à Paris : $nouveaux nouveaux.";
  return ['trouves' => count($j['results'] ?? []), 'nouveaux' => $nouveaux, 'signaux' => 0, 'ids' => $ids];
}

/* ---------- Notification (sans aucune donnée personnelle : seulement des nombres) ---------- */
function robot_notifier(array $ids): void
{
  if (!$ids) return;
  try {
    $st = db()->query('SELECT categorie, COUNT(*) n FROM prospects WHERE id IN (' . implode(',', array_map('intval', $ids)) . ') GROUP BY categorie ORDER BY n DESC');
    $parts = [];
    foreach ($st->fetchAll() as $r) $parts[] = $r['n'] . ' ' . mb_strtolower(ROBOT_CATEGORIES[$r['categorie']] ?? $r['categorie']);
    if (!$parts) return;
    $total = count($ids);
    $texte = implode(', ', $parts);
    notifier('veille', "Robot : $total nouvelle" . ($total > 1 ? 's' : '') . ' piste' . ($total > 1 ? 's' : ''), $texte, '/admin/#/opportunites', 'robot-pistes');
  } catch (Throwable $e) {
    error_log('[BDA robot notif] ' . $e->getMessage());
  }
}

/* ---------- Lecture pour l'admin ---------- */
// Score affiché : note de base + bonus si ouverture, reprise ou chantier récent
function robot_sql_score(): string
{
  return "MIN(100, base + CASE WHEN signal_date >= '" . date('Y-m-d', time() - ROBOT_JOURS_SIGNAL * 86400) . "' THEN " . ROBOT_BONUS_SIGNAL . ' ELSE 0 END)';
}
function robot_liste(array $f): array
{
  $where = ['actif = 1'];
  $p = [];
  $cat = (string)($f['cat'] ?? '');
  if (isset(ROBOT_CATEGORIES[$cat])) { $where[] = 'categorie = ?'; $p[] = $cat; }
  $statut = (string)($f['statut'] ?? '');
  if ($statut === 'suivis') $where[] = "statut IN ('contacte','interesse','devis')";
  elseif ($statut === 'rappels') { $where[] = "relance <> '' AND relance <= ? AND statut NOT IN ('client','refus','ignore')"; $p[] = date('Y-m-d'); }
  elseif (in_array($statut, ROBOT_STATUTS, true)) { $where[] = 'statut = ?'; $p[] = $statut; }
  else $where[] = "statut <> 'ignore'";
  if (preg_match('/^\d{2}$/', (string)($f['dep'] ?? ''))) { $where[] = 'dep = ?'; $p[] = $f['dep']; }
  if (!empty($f['tel'])) $where[] = "tel <> ''";
  if (!empty($f['nouveaux'])) { $where[] = 'signal_date >= ?'; $p[] = date('Y-m-d', time() - ROBOT_JOURS_SIGNAL * 86400); }
  $q = trim((string)($f['q'] ?? ''));
  if ($q !== '') {
    foreach (preg_split('/\s+/', mb_substr($q, 0, 80)) as $mot) {
      $where[] = "(nom LIKE ? OR activite LIKE ? OR adresse LIKE ? OR ville LIKE ? OR cp LIKE ? OR note LIKE ?)";
      for ($i = 0; $i < 6; $i++) $p[] = '%' . $mot . '%';
    }
  }
  $score = robot_sql_score();
  $ordre = match ((string)($f['tri'] ?? '')) {
    'recents' => "CASE WHEN signal_date = '' THEN 1 ELSE 0 END, signal_date DESC, $score DESC",
    'nom' => 'nom COLLATE NOCASE',
    default => "$score DESC, signal_date DESC, CASE WHEN tel = '' THEN 1 ELSE 0 END, nom COLLATE NOCASE",
  };
  $parPage = 40;
  $page = max(1, min(500, (int)($f['page'] ?? 1)));
  $w = implode(' AND ', $where);
  $st = db()->prepare("SELECT COUNT(*) FROM prospects WHERE $w");
  $st->execute($p);
  $total = (int)$st->fetchColumn();
  $st = db()->prepare("SELECT id, categorie, source, nom, activite, adresse, cp, ville, dep, lat, lon, tel, mail, site, horaires, siren, signal, signal_date, atouts, infos, $score AS score, statut, note, relance, nouveau_le, contact_le, cree
    FROM prospects WHERE $w ORDER BY $ordre LIMIT $parPage OFFSET " . (($page - 1) * $parPage));
  $st->execute($p);
  $items = array_map(function ($r) {
    $r['atouts'] = json_decode((string)$r['atouts'], true) ?: [];
    $r['infos'] = json_decode((string)$r['infos'], true) ?: [];
    return $r;
  }, $st->fetchAll());
  return ['items' => $items, 'total' => $total, 'page' => $page, 'pages' => (int)ceil($total / $parPage)];
}
// Chiffres pour les tuiles : pistes par catégorie, nouveautés, suivi (le suivi de la catégorie affichée,
// et toujours le total des rappels du jour pour l'en-tête)
function robot_chiffres(string $cat = ''): array
{
  $db = db();
  $recent = date('Y-m-d', time() - ROBOT_JOURS_SIGNAL * 86400);
  $semaine = date('Y-m-d', time() - 7 * 86400);
  $cats = [];
  $st = $db->prepare("SELECT categorie, COUNT(*) total, SUM(signal_date >= ?) recents, SUM(nouveau_le >= ?) semaine, SUM(tel <> '') joignables
    FROM prospects WHERE actif = 1 AND statut <> 'ignore' GROUP BY categorie");
  $st->execute([$recent, $semaine]);
  foreach ($st->fetchAll() as $r) $cats[$r['categorie']] = array_map('intval', array_diff_key($r, ['categorie' => 1]));
  $filtre = isset(ROBOT_CATEGORIES[$cat]) ? ' AND categorie = ' . $db->quote($cat) : '';
  $suivi = [];
  foreach ($db->query("SELECT statut, COUNT(*) n FROM prospects WHERE actif = 1$filtre GROUP BY statut")->fetchAll() as $r) $suivi[$r['statut']] = (int)$r['n'];
  $rappel = "SELECT COUNT(*) FROM prospects WHERE relance <> '' AND relance <= " . $db->quote(date('Y-m-d')) . " AND statut NOT IN ('client','refus','ignore')";
  $suivi['rappels'] = (int)$db->query($rappel . $filtre)->fetchColumn();
  $total = ['rappels' => (int)$db->query($rappel)->fetchColumn()];
  foreach ($db->query("SELECT statut, COUNT(*) n FROM prospects WHERE actif = 1 AND statut IN ('interesse','devis') GROUP BY statut")->fetchAll() as $r) $total[$r['statut']] = (int)$r['n'];
  return ['categories' => $cats, 'suivi' => $suivi, 'total' => $total];
}
