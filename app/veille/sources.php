<?php
/* =========================================================
   VEILLE — sources : BOAMP (appels d'offres) et France Travail (recrutements)
   Chaque source renvoie une liste d'opportunités au même format.
   ========================================================= */
declare(strict_types=1);

const BOAMP_API = 'https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records';
const BOAMP_NATURES_GARDEES = ['APPEL_OFFRE', 'PRE-INFORMATION'];

function veille_config(): array
{
  static $c = null;
  return $c ??= require __DIR__ . '/mots-cles.php';
}

/* ---------- Score de pertinence ---------- */
function veille_score(string $texte, array $cpv, array $descripteurs, array $typesMarche): array
{
  $c = veille_config();
  $t = veille_normaliser($texte);
  $score = 0;
  $pts = ['securite' => 0, 'chauffeur' => 0];
  $motifs = [];
  $positif = false;
  foreach (['securite', 'chauffeur'] as $cat) {
    foreach ($c[$cat] as $mot => $p) {
      if (veille_contient($t, veille_normaliser($mot))) { $score += $p; $pts[$cat] += $p; $motifs[] = "+$p $mot"; $positif = true; }
    }
  }
  $cpvVus = [];
  foreach ($cpv as $code) {
    foreach ($c['cpv'] as $debut => $r) {
      if (str_starts_with($code, (string)$debut) && !isset($cpvVus[$debut])) {
        $cpvVus[$debut] = true;
        $score += $r['points']; $pts[$r['type']] += $r['points']; $motifs[] = "+{$r['points']} CPV $code"; $positif = true;
      }
    }
  }
  foreach ($descripteurs as $d) {
    $dn = veille_normaliser($d);
    foreach ($c['descripteurs'] as $mot => $r) {
      if (veille_contient($dn, veille_normaliser($mot))) { $score += $r['points']; $pts[$r['type']] += $r['points']; $motifs[] = "+{$r['points']} descripteur $d"; $positif = true; }
    }
  }
  // Exception : gardiennage de chantier pendant des travaux
  $exception = false;
  foreach ($c['exceptions_travaux'] as $e) if (veille_contient($t, veille_normaliser($e))) { $exception = true; break; }
  if ($exception) { $score += $c['bonus_exception']; $pts['securite'] += $c['bonus_exception']; $motifs[] = "+{$c['bonus_exception']} gardiennage de chantier"; $positif = true; }
  foreach ($c['negatifs'] as $mot => $p) {
    if ($exception && in_array($mot, ['travaux', 'installation', 'materiel'], true)) continue;
    if (veille_contient($t, veille_normaliser($mot))) { $score += $p; $motifs[] = "$p $mot"; }
  }
  if (!$exception) {
    foreach ($typesMarche as $tm) if (isset($c['type_marche'][$tm])) { $score += $c['type_marche'][$tm]; $motifs[] = "{$c['type_marche'][$tm]} marché de " . strtolower($tm); }
  }
  $niveau = $score >= $c['niveau_fort'] ? 'fort' : ($score >= $c['niveau_moyen'] ? 'moyen' : 'faible');
  return [
    'garder' => $positif && $score >= $c['garder_a_partir_de'],
    'score' => $score,
    'niveau' => $niveau,
    'type' => $pts['chauffeur'] > $pts['securite'] ? 'chauffeur' : 'securite',
    'motifs' => $motifs,
  ];
}
// Badges « à savoir » : reprise de personnel, IGH, gros marché, petit marché…
function veille_alertes(string $texte, float $montant, string $famille): array
{
  $c = veille_config();
  $t = veille_normaliser($texte);
  $a = [];
  foreach ($c['alertes'] as $mot => $libelle) if (veille_contient($t, veille_normaliser($mot))) $a[$libelle] = true;
  if ($montant >= $c['gros_marche_euros']) $a['Gros marché (' . number_format($montant / 1000, 0, ',', ' ') . ' k€)'] = true;
  if ($famille === 'MAPA') $a['Procédure adaptée (souvent plus accessible)'] = true;
  return array_keys($a);
}

/* ---------- BOAMP ---------- */
function boamp_url(array $params): string
{
  return BOAMP_API . '?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986);
}
// Liste légère des avis récents (sans le détail), avec repli si le filtre département est refusé
function boamp_liste(int $jours, array &$journal): array
{
  $c = veille_config();
  $depuis = (new DateTimeImmutable("-$jours days", new DateTimeZone('Europe/Paris')))->format('Y-m-d');
  $depts = "'" . implode("','", $c['departements']) . "'";
  $champs = 'idweb,objet,nature,nature_libelle,etat,famille,dateparution,datelimitereponse,nomacheteur,code_departement,descripteur_libelle,type_marche,procedure_libelle';
  $wheres = ["dateparution >= date'$depuis' and code_departement in ($depts)", "dateparution >= date'$depuis'"];
  foreach ($wheres as $i => $where) {
    $avis = [];
    try {
      for ($offset = 0; $offset <= 9900; $offset += 100) {
        $j = veille_json(boamp_url(['select' => $champs, 'where' => $where, 'order_by' => 'dateparution desc', 'limit' => 100, 'offset' => $offset]));
        foreach ($j['results'] ?? [] as $r) $avis[] = $r;
        if (count($j['results'] ?? []) < 100 || $offset + 100 >= (int)($j['total_count'] ?? 0)) break;
      }
      if ($i === 1) {
        // filtre par département fait ici
        $avis = array_values(array_filter($avis, fn($r) => array_intersect((array)($r['code_departement'] ?? []), $c['departements'])));
        $journal[] = 'Filtre département refusé par l’API : filtrage local.';
      }
      return $avis;
    } catch (Throwable $e) {
      if ($i === 1) throw $e;
      $journal[] = 'Filtre département indisponible (' . $e->getMessage() . '), nouvel essai sans filtre.';
    }
  }
  return [];
}
// Détail (données complètes) d'avis précis, par paquets
function boamp_details(array $ids): array
{
  $res = [];
  foreach (array_chunk($ids, 40) as $paquet) {
    $liste = "'" . implode("','", array_map(fn($i) => str_replace("'", '', $i), $paquet)) . "'";
    $j = veille_json(boamp_url(['select' => 'idweb,donnees', 'where' => "idweb in ($liste)", 'limit' => 100]));
    foreach ($j['results'] ?? [] as $r) $res[$r['idweb']] = (string)($r['donnees'] ?? '');
  }
  return $res;
}
// Extrait CPV, montants, intitulés des lots et lien vers le dossier depuis le détail
function boamp_analyser_donnees(string $donnees): array
{
  $cpv = [];
  if (preg_match_all('/"@listName":\s*"cpv",\s*"#text":\s*"(\d{8})"/', $donnees, $m)) $cpv = array_merge($cpv, $m[1]);
  if (preg_match_all('/"class(?:Principale|Supplementaire\d*)":\s*"(\d{8})"/', $donnees, $m)) $cpv = array_merge($cpv, $m[1]);
  $montants = [];
  if (preg_match_all('/"(?:cbc:EstimatedOverallContractAmount|efbc:FrameworkMaximumAmount)":\s*\{[^}]*"#text":\s*"([\d.]+)"/', $donnees, $m)) $montants = array_map('floatval', $m[1]);
  $lots = [];
  if (preg_match_all('/"estimationValeur":\s*\{[^}]*"valeur":\s*"([\d.]+)"/', $donnees, $m)) $lots = array_map('floatval', $m[1]);
  $montant = max($montants ? max($montants) : 0, array_sum($lots));
  $textes = [];
  if (preg_match_all('/"(?:description|cbc:Description|cbc:Name|objetLot|intitule)":\s*(?:\{[^{}]*"#text":\s*)?"((?:[^"\\\\]|\\\\.){4,400})"/u', $donnees, $m)) {
    foreach ($m[1] as $x) $textes[] = json_decode('"' . $x . '"') ?? $x;
  }
  // Lien vers le dossier : on préfère l'adresse précise de la consultation à la page d'accueil de la plateforme
  $liens = [];
  if (preg_match_all('/"(?:cbc:URI|urlProfilAch|cbc:BuyerProfileURI|urlDocConsul|urlParticipation)":\s*"(https?:[^"]+)"/', $donnees, $m)) $liens = array_map('stripslashes', $m[1]);
  $liens = array_values(array_filter(array_unique($liens), fn($u) => !preg_match('#tribunal|juradm|conseil-etat#i', $u)));
  usort($liens, function ($a, $b) {
    $p = fn($u) => (preg_match('#consultation|PCSLID|annonce|id=|refConsult|/avis/#i', $u) ? 100 : 0) + min(strlen((string)parse_url($u, PHP_URL_PATH)) + strlen((string)parse_url($u, PHP_URL_QUERY)), 99);
    return $p($b) <=> $p($a);
  });
  $dossier = $liens[0] ?? '';
  return ['cpv' => array_values(array_unique($cpv)), 'montant' => $montant, 'textes' => array_values(array_unique($textes)), 'dossier' => $dossier];
}
function boamp_collecter(int $jours, array &$journal): array
{
  $avis = boamp_liste($jours, $journal);
  $journal[] = count($avis) . ' avis BOAMP publiés en Île-de-France sur ' . $jours . ' jours.';
  $maintenant = veille_maintenant();
  // 1) on écarte résultats, attributions, annulations, dates passées et avis déjà examinés
  $vus = [];
  foreach (db()->query("SELECT ref FROM veille_vus WHERE source = 'boamp'")->fetchAll(PDO::FETCH_COLUMN) as $r) $vus[$r] = true;
  foreach (db()->query("SELECT ref FROM opportunites WHERE source = 'boamp'")->fetchAll(PDO::FETCH_COLUMN) as $r) $vus[$r] = true;
  $candidats = [];
  foreach ($avis as $a) {
    if (!in_array($a['nature'] ?? '', BOAMP_NATURES_GARDEES, true)) continue;
    if (in_array($a['etat'] ?? '', ['ANNULATION'], true)) continue;
    $limite = veille_date_paris($a['datelimitereponse'] ?? null);
    if ($limite !== '' && $limite < $maintenant) continue;
    if (isset($vus[$a['idweb']])) continue;
    $candidats[$a['idweb']] = $a + ['_limite' => $limite];
  }
  // 2) détail complet (CPV, montants, lots) pour les nouveaux avis seulement
  $details = $candidats ? boamp_details(array_keys($candidats)) : [];
  $res = [];
  $memoVu = db()->prepare("INSERT OR IGNORE INTO veille_vus (source, ref, vu) VALUES ('boamp', ?, ?)");
  foreach ($candidats as $id => $a) {
    $d = boamp_analyser_donnees($details[$id] ?? '');
    $descripteurs = (array)($a['descripteur_libelle'] ?? []);
    $texte = trim(($a['objet'] ?? '') . ' ' . implode(' ', $descripteurs) . ' ' . implode(' ', array_slice($d['textes'], 0, 30)));
    $s = veille_score($texte, $d['cpv'], $descripteurs, (array)($a['type_marche'] ?? []));
    if (!$s['garder']) { $memoVu->execute([$id, $maintenant]); continue; }
    $depts = array_values(array_intersect((array)($a['code_departement'] ?? []), veille_config()['departements']));
    $res[] = [
      'source' => 'boamp', 'ref' => $id, 'type' => $s['type'],
      'nature' => ($a['nature'] ?? '') === 'PRE-INFORMATION' ? 'Pré-information' : trim(($a['procedure_libelle'] ?? '') ?: ($a['nature_libelle'] ?? 'Avis de marché')),
      'titre' => trim((string)($a['objet'] ?? 'Sans titre')),
      'acheteur' => trim((string)($a['nomacheteur'] ?? '')),
      'lieu' => $depts ? 'Dép. ' . implode(', ', $depts) : '',
      'departements' => implode(',', (array)($a['code_departement'] ?? [])),
      'date_parution' => (string)($a['dateparution'] ?? ''),
      'date_limite' => $a['_limite'],
      'url' => 'https://www.boamp.fr/pages/avis/?q=idweb:' . rawurlencode($id),
      'url_dossier' => $d['dossier'],
      'montant' => $d['montant'],
      'score' => $s['score'], 'niveau' => $s['niveau'],
      'alertes' => veille_alertes($texte . ' ' . ($details[$id] ?? ''), $d['montant'], (string)($a['famille'] ?? '')),
      'motifs' => $s['motifs'],
      'extrait' => mb_substr(implode(' · ', array_slice($d['textes'], 0, 6)), 0, 600),
    ];
  }
  $journal[] = count($candidats) . ' nouveaux avis examinés, ' . count($res) . ' retenus.';
  return $res;
}

/* ---------- France Travail ---------- */
function ft_jeton(): string
{
  $id = veille_env('FT_CLIENT_ID');
  $secret = veille_env('FT_CLIENT_SECRET');
  if ($id === '' || $secret === '') throw new RuntimeException('Identifiants France Travail à configurer (Réglages de la veille).');
  $r = veille_http('POST', 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire', ['Content-Type: application/x-www-form-urlencoded'],
    http_build_query(['grant_type' => 'client_credentials', 'client_id' => $id, 'client_secret' => $secret, 'scope' => 'api_offresdemploiv2 o2dsoffre']), 20);
  $j = json_decode($r['corps'], true);
  if ($r['code'] !== 200 || empty($j['access_token'])) {
    $err = $j['error'] ?? '';
    throw new RuntimeException($err === 'invalid_client' ? 'France Travail refuse les identifiants (vérifiez la clé secrète et que l’API « Offres d’emploi » est bien ajoutée à votre application).' : "Connexion France Travail impossible (HTTP {$r['code']}).");
  }
  return (string)$j['access_token'];
}
function ft_exclue(array $o): bool
{
  $c = veille_config()['france_travail'];
  $secteur = (string)($o['secteurActivite'] ?? '');
  foreach ($c['secteurs_exclus'] as $s) if ($secteur !== '' && str_starts_with($secteur, $s)) return true;
  $nom = veille_normaliser((string)($o['entreprise']['nom'] ?? ''));
  foreach ($c['noms_exclus'] as $m) { $m2 = trim(veille_normaliser($m)); if ($m2 !== '' && str_contains($nom, $m2)) return true; }
  $txt = veille_normaliser(($o['description'] ?? '') . ' ' . ($o['entreprise']['description'] ?? ''));
  foreach ($c['textes_exclus'] as $m) if (str_contains($txt, trim(veille_normaliser($m)))) return true;
  return false;
}
function ft_collecter(int $jours, array &$journal): array
{
  $c = veille_config();
  $jeton = ft_jeton();
  $publiee = $jours <= 1 ? 1 : ($jours <= 3 ? 3 : ($jours <= 7 ? 7 : ($jours <= 14 ? 14 : 31)));
  $res = [];
  $total = 0;
  $exclues = 0;
  foreach ($c['departements'] as $dep) {
    for ($debut = 0; $debut <= 3000; $debut += 150) {
      $url = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?' . http_build_query([
        'codeROME' => $c['france_travail']['rome'], 'departement' => $dep, 'publieeDepuis' => $publiee, 'range' => $debut . '-' . ($debut + 149),
      ]);
      $r = veille_http('GET', $url, ['Authorization: Bearer ' . $jeton, 'Accept: application/json'], null, 25);
      if ($r['code'] === 204) break; // aucune offre
      if ($r['code'] === 429) { sleep(1); $r = veille_http('GET', $url, ['Authorization: Bearer ' . $jeton, 'Accept: application/json'], null, 25); }
      if ($r['code'] !== 200 && $r['code'] !== 206) throw new RuntimeException("France Travail a répondu HTTP {$r['code']} (département $dep).");
      $j = json_decode($r['corps'], true) ?: [];
      $offres = $j['resultats'] ?? [];
      foreach ($offres as $o) {
        $total++;
        if (ft_exclue($o)) { $exclues++; continue; }
        $res[] = [
          'source' => 'francetravail', 'ref' => (string)$o['id'], 'type' => 'recrutement',
          'nature' => trim(($o['typeContratLibelle'] ?? '') . (isset($o['dureeTravailLibelle']) ? ' · ' . $o['dureeTravailLibelle'] : '')),
          'titre' => trim((string)($o['intitule'] ?? 'Offre d’emploi')),
          'acheteur' => trim((string)($o['entreprise']['nom'] ?? 'Employeur non communiqué')),
          'lieu' => trim((string)($o['lieuTravail']['libelle'] ?? '')),
          'departements' => $dep,
          'date_parution' => substr((string)($o['dateCreation'] ?? ''), 0, 10),
          'date_limite' => '',
          'url' => (string)($o['origineOffre']['urlOrigine'] ?? ('https://candidat.francetravail.fr/offres/recherche/detail/' . $o['id'])),
          'url_dossier' => '',
          'montant' => 0, 'score' => 0, 'niveau' => 'moyen',
          'alertes' => array_values(array_filter([$o['secteurActiviteLibelle'] ?? '', $o['salaire']['libelle'] ?? ''])),
          'motifs' => [],
          'extrait' => mb_substr(trim((string)($o['description'] ?? '')), 0, 600),
        ];
      }
      $plage = $r['entetes']['content-range'] ?? '';
      $totalDep = preg_match('#/(\d+)#', $plage, $m) ? (int)$m[1] : 0;
      if (count($offres) < 150 || $debut + 150 >= $totalDep) break;
    }
    usleep(150000); // l'API limite le nombre d'appels par seconde
  }
  $journal[] = "$total offres d'agent de sécurité (K2503), $exclues écartées (sociétés de sécurité, intérim, « pour notre client »), " . count($res) . ' employeurs directs.';
  return $res;
}
