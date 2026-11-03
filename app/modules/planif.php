<?php
/* =========================================================
   MODULE « PLANIF » (version 13) — le planning nouvelle génération
   - Besoins récurrents par site (« 2 agents 20:00-08:00 du lundi au vendredi »)
     puis « Générer les postes du mois » (postes non pourvus, sans doublon).
   - Bourse aux postes : la direction propose un poste libre, les agents qui
     peuvent le tenir (toutes les règles vérifiées ici, côté serveur) le voient
     dans l'Espace équipe ; le premier qui le prend l'a.
   - Échanges : un agent propose de céder un de ses postes (à un collègue ou à
     toute l'équipe), un collègue accepte, la direction valide.
   Règles de travail contrôlées : chevauchement, absences, carte pro, 11 h de repos,
   12 h par journée, 48 h par semaine, qualification demandée.
   ========================================================= */
declare(strict_types=1);
require_once __DIR__ . '/../exploitation.php';

const MOD_PLANIF_REPOS = 11 * 3600;        // repos quotidien (secondes)
const MOD_PLANIF_JOUR_MAX = 12 * 60;       // travail effectif par journée (minutes)
const MOD_PLANIF_SEMAINE_MAX = 48 * 60;    // travail par semaine civile (minutes)

const MOD_PLANIF_ABSENCES = ['conges' => 'congés', 'maladie' => 'arrêt', 'absence' => 'absence', 'indispo' => 'indisponible'];
const MOD_PLANIF_JOURS_COURTS = ['', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const MOD_PLANIF_MOIS = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// « jeu. 5 novembre »
function mod_planif_date_courte(string $jour): string
{
  $t = strtotime($jour);
  return MOD_PLANIF_JOURS_COURTS[(int)date('N', $t)] . ' ' . (int)date('j', $t) . ' ' . MOD_PLANIF_MOIS[(int)date('n', $t)];
}
// 750 → « 12 h 30 »
function mod_planif_duree(int $min): string
{
  $min = max(0, $min);
  $h = intdiv($min, 60);
  $m = $min % 60;
  return $m ? $h . ' h ' . str_pad((string)$m, 2, '0', STR_PAD_LEFT) : "$h h";
}
// Un poste tel que le contrôle le manipule (bornes calculées une fois)
function mod_planif_poste_ctx(array $v): array
{
  [$d, $f] = exp_bornes($v);
  return ['id' => (int)($v['id'] ?? 0), 'site_id' => (int)($v['site_id'] ?? 0), 'site_nom' => (string)($v['site_nom'] ?? ''), 'jour' => (string)$v['jour'],
    'debut' => (string)$v['debut'], 'fin' => (string)$v['fin'], 'd' => $d, 'f' => $f, 'min' => exp_minutes($v)];
}
function mod_planif_libelle_poste(array $x): string
{
  return trim(($x['site_nom'] !== '' ? $x['site_nom'] . ', ' : '') . mod_planif_date_courte($x['jour']) . ' ' . $x['debut'] . '-' . $x['fin']);
}
// Compétences d'un agent en majuscules (poste + qualifications de sa fiche)
function mod_planif_competences(array $a): string
{
  return mb_strtoupper(trim(($a['poste'] ?? '') . ' ' . ($a['qualifs'] ?? '')));
}
// Niveau SSIAP le plus haut indiqué dans la fiche (0 = aucun)
function mod_planif_niveau_ssiap(string $competences): int
{
  if (!str_contains($competences, 'SSIAP')) return 0;
  preg_match_all('/SSIAP\s*([123])/', $competences, $m);
  return $m[1] ? max(array_map('intval', $m[1])) : 1;
}
// Chauffeur VTC sans aucune qualification de sécurité dans sa fiche
function mod_planif_est_chauffeur(array $a): bool
{
  return (bool)preg_match('/CHAUFFEUR|VTC/u', mb_strtoupper((string)($a['poste'] ?? '')))
    && !preg_match('/\bADS\b|\bAPS\b|SSIAP|CQP|SÉCURITÉ|SECURITE|CYNO/u', mod_planif_competences($a));
}
// Minutes d'un poste entre 21 h et 6 h (nuit, comme la paie) et le dimanche (pas de 15 min)
function mod_planif_minutes_nuit(array $x): int
{
  $n = 0;
  for ($t = (int)$x['d']; $t < (int)$x['f']; $t += 900) { $h = (int)date('G', $t); if ($h >= 21 || $h < 6) $n += 15; }
  return $n;
}
function mod_planif_minutes_dimanche(array $x): int
{
  $n = 0;
  for ($t = (int)$x['d']; $t < (int)$x['f']; $t += 900) if ((int)date('N', $t) === 7) $n += 15;
  return $n;
}

// Agents, postes (tous sites) et absences autour d'une période
function mod_planif_contexte(string $du, string $au): array
{
  $db = db();
  $de = date('Y-m-d', strtotime($du . ' -9 days'));
  $a = date('Y-m-d', strtotime($au . ' +9 days'));
  $agents = [];
  foreach ($db->query('SELECT id, nom, poste, categorie, validite, actif, infos FROM agents') as $r) {
    $i = json_decode((string)$r['infos'], true) ?: [];
    $agents[(int)$r['id']] = ['id' => (int)$r['id'], 'nom' => (string)$r['nom'], 'poste' => (string)$r['poste'], 'categorie' => (string)$r['categorie'],
      'validite' => (string)$r['validite'], 'actif' => (int)$r['actif'], 'qualifs' => (string)($i['qualifs'] ?? '')];
  }
  // les règles de travail portent sur l'agent : tous ses postes comptent, quel que soit le site (pas de filtre « chef de site » ici)
  $st = $db->prepare("SELECT v.id, v.site_id, v.jour, v.debut, v.fin, v.pause, v.agent_id, s.nom AS site_nom FROM vacations v LEFT JOIN sites s ON s.id = v.site_id
    WHERE v.agent_id > 0 AND v.statut <> 'annulee' AND v.jour >= ? AND v.jour <= ?");
  $st->execute([$de, $a]);
  $postes = [];
  foreach ($st as $v) $postes[(int)$v['agent_id']][(int)$v['id']] = mod_planif_poste_ctx($v);
  $st = $db->prepare("SELECT agent_id, type, du, au, statut FROM absences WHERE statut IN ('acceptee', 'attente') AND du <= ? AND au >= ?");
  $st->execute([$a, $de]);
  $absences = [];
  foreach ($st as $b) $absences[(int)$b['agent_id']][] = $b;
  return ['agents' => $agents, 'postes' => $postes, 'absences' => $absences, 'du' => $de, 'au' => $a];
}
// Note dans le contexte un placement proposé (remplissage automatique) ; agent 0 = poste libéré
function mod_planif_contexte_placer(array &$ctx, array $v, int $agentId): void
{
  foreach (array_keys($ctx['postes']) as $aid) unset($ctx['postes'][$aid][(int)$v['id']]);
  if ($agentId > 0) $ctx['postes'][$agentId][(int)$v['id']] = mod_planif_poste_ctx($v);
}

/* Contrôle d'un placement : $v = le poste (id 0 pour un poste pas encore créé : site_id, jour, debut, fin, pause, qualif),
   $ignorer = postes de l'agent à ne pas compter (ex. le poste qu'il quitte quand on le déplace). */
function mod_planif_controler(array $ctx, array $v, int $agentId, array $ignorer = []): array
{
  $r = ['bloquants' => [], 'regles' => [], 'infos' => []];
  $note = function (string $niveau, string $code, string $texte) use (&$r): void { $r[$niveau][] = ['code' => $code, 'texte' => $texte]; };
  $a = $ctx['agents'][$agentId] ?? null;
  if (!$a) { $note('bloquants', 'agent', 'Agent introuvable.'); return $r; }
  if (!$a['actif'] && $a['categorie'] !== 'secours') $note('bloquants', 'agent', 'Agent retiré de l’équipe.');
  $vid = (int)($v['id'] ?? 0);
  if (($v['statut'] ?? 'prevue') === 'annulee') $note('bloquants', 'poste', 'Ce poste est annulé.');
  if ($vid && (int)($v['agent_id'] ?? 0) === $agentId) $note('bloquants', 'deja', 'Il est déjà sur ce poste.');
  $p = mod_planif_poste_ctx($v);
  $exclus = array_fill_keys(array_map('intval', $ignorer), true);
  if ($vid) $exclus[$vid] = true;
  $autres = array_values(array_filter($ctx['postes'][$agentId] ?? [], fn($x) => !isset($exclus[$x['id']])));

  // 1. au même moment sur un autre poste
  foreach ($autres as $x) if ($x['d'] < $p['f'] && $p['d'] < $x['f']) { $note('bloquants', 'occupe', 'Déjà placé à ce moment-là (' . mod_planif_libelle_poste($x) . ').'); break; }
  // 2. absences (acceptée : impossible ; en attente : à vérifier)
  foreach ($ctx['absences'][$agentId] ?? [] as $b) {
    if ($b['du'] > $p['jour'] || $b['au'] < $p['jour']) continue;
    if ($b['statut'] === 'acceptee') $note('bloquants', 'absent', 'Absent ce jour (' . (MOD_PLANIF_ABSENCES[$b['type']] ?? 'absence') . ').');
    else $note('regles', 'attente', 'A demandé une absence ce jour (réponse en attente).');
  }
  // 3. carte professionnelle
  if ($a['validite'] !== '' && $a['validite'] < $p['jour']) $note('bloquants', 'carte', 'Carte pro expirée le ' . date('d/m/Y', strtotime($a['validite'])) . '.');

  // 4. journée de travail : des postes séparés de moins de 11 h forment la même journée (coupure comprise).
  //    Une journée dure au plus 13 h du premier début à la dernière fin (= 11 h de repos) et compte au plus 12 h de travail.
  $liste = array_values(array_filter($autres, fn($x) => $x['f'] > $p['d'] - 2 * 86400 && $x['d'] < $p['f'] + 2 * 86400));
  $liste[] = $p + ['candidat' => true];
  usort($liste, fn($x, $y) => $x['d'] <=> $y['d']);
  $groupes = [];
  $finG = null;
  foreach ($liste as $x) {
    if ($finG === null || $x['d'] - $finG >= MOD_PLANIF_REPOS) { $groupes[] = []; $finG = $x['f']; }
    $groupes[count($groupes) - 1][] = $x;
    $finG = max($finG, $x['f']);
  }
  $journee = [$p];
  foreach ($groupes as $g) foreach ($g as $x) if (!empty($x['candidat'])) { $journee = $g; break 2; }
  if (count($journee) > 1) {
    $amplitude = max(array_column($journee, 'f')) - min(array_column($journee, 'd'));
    if ($amplitude > 86400 - MOD_PLANIF_REPOS) {
      // le poste voisin le plus proche, pour que la raison soit parlante
      $voisin = null;
      $ecart = PHP_INT_MAX;
      foreach ($journee as $x) {
        if (!empty($x['candidat'])) continue;
        $e = $x['f'] <= $p['d'] ? $p['d'] - $x['f'] : max(0, $x['d'] - $p['f']);
        if ($e < $ecart) { $ecart = $e; $voisin = $x; }
      }
      $note('regles', 'repos', 'Moins de 11 h de repos (' . mod_planif_libelle_poste($voisin) . ').');
    }
  }
  $travail = array_sum(array_column($journee, 'min'));
  if ($p['min'] > MOD_PLANIF_JOUR_MAX) $note('regles', 'journee', 'Poste de plus de 12 h (' . mod_planif_duree($p['min']) . ').');
  elseif ($travail > MOD_PLANIF_JOUR_MAX) $note('regles', 'journee', mod_planif_duree($travail) . ' de travail dans la journée (12 h au plus).');

  // 5. semaine civile (lundi → dimanche du jour du poste)
  $n = (int)date('N', strtotime($p['jour']));
  $lundi = date('Y-m-d', strtotime($p['jour'] . ' -' . ($n - 1) . ' days'));
  $dimanche = date('Y-m-d', strtotime($lundi . ' +6 days'));
  $semaine = $p['min'];
  foreach ($autres as $x) if ($x['jour'] >= $lundi && $x['jour'] <= $dimanche) $semaine += $x['min'];
  if ($semaine > MOD_PLANIF_SEMAINE_MAX) $note('regles', 'semaine', mod_planif_duree($semaine) . ' dans la semaine (48 h au plus).');

  // 6. qualification demandée
  $comp = mod_planif_competences($a);
  $q = (string)($v['qualif'] ?? 'ADS');
  if (str_starts_with($q, 'SSIAP')) {
    $requis = (int)substr($q, 5);
    $niveau = mod_planif_niveau_ssiap($comp);
    if (!$niveau) $note('regles', 'qualif', 'SSIAP demandé, pas indiqué dans sa fiche.');
    elseif ($niveau < $requis) $note('regles', 'qualif', "SSIAP $requis demandé, sa fiche indique SSIAP $niveau.");
  } elseif ($q === 'CYNO' && !preg_match('/CYNO|CHIEN/', $comp)) $note('regles', 'qualif', 'Cynophile demandé, pas indiqué dans sa fiche.');
  if (mod_planif_est_chauffeur($a)) $note('regles', 'metier', 'Chauffeur VTC : pas agent de sécurité dans sa fiche.');

  // 7. à savoir
  if ($a['categorie'] === 'secours') $note('infos', 'secours', 'Agent de secours : pas encore dans l’équipe.');
  return $r;
}
// Résumé pour l'interface : possible = aucune règle enfreinte
function mod_planif_controle_resume(array $r): array
{
  $t = fn(array $l) => array_values(array_map(fn($x) => $x['texte'], $l));
  return ['possible' => !$r['bloquants'] && !$r['regles'], 'bloquant' => (bool)$r['bloquants'], 'raisons' => array_merge($t($r['bloquants']), $t($r['regles'])), 'infos' => $t($r['infos'])];
}

function module_planif(): array
{
  $equipe = ['admin', 'manager'];
  return [
    'titre' => 'Planning',
    'schema' => [1 => <<<'SQL'
      CREATE TABLE IF NOT EXISTS m_planif_besoins (id INTEGER PRIMARY KEY, site_id INTEGER NOT NULL, jours TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',
        debut TEXT NOT NULL, fin TEXT NOT NULL, nombre INTEGER NOT NULL DEFAULT 1, qualif TEXT NOT NULL DEFAULT 'ADS', note TEXT NOT NULL DEFAULT '',
        actif INTEGER NOT NULL DEFAULT 1, cree TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS i_m_planif_besoins_site ON m_planif_besoins (site_id, actif);
      CREATE TABLE IF NOT EXISTS m_planif_bourse (id INTEGER PRIMARY KEY, vacation_id INTEGER NOT NULL UNIQUE, propose_le TEXT NOT NULL, propose_par TEXT NOT NULL DEFAULT '',
        statut TEXT NOT NULL DEFAULT 'ouverte', pris_par INTEGER NOT NULL DEFAULT 0, pris_le TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS i_m_planif_bourse_statut ON m_planif_bourse (statut);
      CREATE TABLE IF NOT EXISTS m_planif_echanges (id INTEGER PRIMARY KEY, vacation_id INTEGER NOT NULL, de_agent INTEGER NOT NULL, vers_agent INTEGER NOT NULL DEFAULT 0,
        message TEXT NOT NULL DEFAULT '', statut TEXT NOT NULL DEFAULT 'proposee', accepte_par INTEGER NOT NULL DEFAULT 0, accepte_le TEXT NOT NULL DEFAULT '',
        decide_le TEXT NOT NULL DEFAULT '', decide_par TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS i_m_planif_echanges_statut ON m_planif_echanges (statut, vacation_id);
      SQL],
    'admin' => [
      'tableau' => ['methode' => 'GET', 'roles' => $equipe, 'fn' => 'mod_planif_tableau'],
      'verifier' => ['methode' => 'GET', 'roles' => $equipe, 'fn' => 'mod_planif_verifier'],
      'besoin.enregistrer' => ['methode' => 'POST', 'roles' => $equipe, 'fn' => 'mod_planif_besoin_enregistrer'],
      'besoin.retirer' => ['methode' => 'POST', 'roles' => $equipe, 'fn' => 'mod_planif_besoin_retirer'],
      'besoins.generer' => ['methode' => 'POST', 'roles' => $equipe, 'fn' => 'mod_planif_besoins_generer'],
      'bourse.proposer' => ['methode' => 'POST', 'roles' => $equipe, 'fn' => 'mod_planif_bourse_proposer'],
      'bourse.retirer' => ['methode' => 'POST', 'roles' => $equipe, 'fn' => 'mod_planif_bourse_retirer'],
      'echange.decider' => ['methode' => 'POST', 'roles' => $equipe, 'fn' => 'mod_planif_echange_decider'],
    ],
    'equipe' => [
      'postes' => ['methode' => 'GET', 'fn' => 'mod_planif_eq_postes'],
      'prendre' => ['methode' => 'POST', 'fn' => 'mod_planif_eq_prendre'],
      'ceder' => ['methode' => 'POST', 'fn' => 'mod_planif_eq_ceder'],
      'accepter' => ['methode' => 'POST', 'fn' => 'mod_planif_eq_accepter'],
      'annuler' => ['methode' => 'POST', 'fn' => 'mod_planif_eq_annuler'],
    ],
    'compteurs' => 'mod_planif_compteurs',
  ];
}

/* ---------- Outils ---------- */
function mod_planif_vacation(int $id): array
{
  $st = db()->prepare('SELECT v.*, s.nom AS site_nom, s.adresse AS site_adresse FROM vacations v LEFT JOIN sites s ON s.id = v.site_id WHERE v.id = ?');
  $st->execute([$id]);
  $v = $st->fetch();
  if (!$v) throw new RuntimeException('Poste introuvable.');
  return $v;
}
function mod_planif_verif(array $v, int $agentId): array
{
  $ctx = mod_planif_contexte((string)$v['jour'], (string)$v['jour']);
  return mod_planif_controle_resume(mod_planif_controler($ctx, $v, $agentId));
}
function mod_planif_a_venir(array $v): bool
{
  return exp_bornes($v)[0] > time();
}
function mod_planif_ligne(array $v): array
{
  return ['id' => (int)$v['id'], 'site' => (string)($v['site_nom'] ?? ''), 'adresse' => (string)($v['site_adresse'] ?? ''), 'jour' => (string)$v['jour'], 'debut' => (string)$v['debut'],
    'fin' => (string)$v['fin'], 'qualif' => (string)$v['qualif'], 'qualifLib' => EXP_QUALIFS[$v['qualif']] ?? (string)$v['qualif'], 'duree' => mod_planif_duree(exp_minutes($v)),
    'libelle' => mod_planif_date_courte((string)$v['jour']) . ' · ' . $v['debut'] . '-' . $v['fin']];
}
// Prénom + initiale du nom (« DURAND Marc » → « Marc D. ») : ce que voient les collègues
function mod_planif_nom_court(string $nom): string
{
  $mots = preg_split('/\s+/', trim($nom)) ?: [];
  $prenom = implode(' ', array_filter($mots, fn ($m) => $m !== mb_strtoupper($m)));
  $famille = implode(' ', array_filter($mots, fn ($m) => $m === mb_strtoupper($m)));
  return trim(($prenom ?: $famille) . ($prenom && $famille ? ' ' . mb_substr($famille, 0, 1) . '.' : ''));
}

/* ---------- Admin : page « Bourse & échanges » ---------- */
function mod_planif_tableau(): void
{
  $db = db();
  $depuis = date('Y-m-d', time() - 14 * 86400);
  $besoins = $db->query('SELECT b.*, s.nom AS site_nom FROM m_planif_besoins b JOIN sites s ON s.id = b.site_id WHERE b.actif = 1 ORDER BY s.nom COLLATE NOCASE, b.debut')->fetchAll();
  $st = $db->prepare("SELECT b.*, v.jour, v.debut, v.fin, v.qualif, v.agent_id, s.nom AS site_nom, a.nom AS agent_nom FROM m_planif_bourse b JOIN vacations v ON v.id = b.vacation_id
    LEFT JOIN sites s ON s.id = v.site_id LEFT JOIN agents a ON a.id = b.pris_par WHERE b.statut = 'ouverte' OR b.pris_le >= ? ORDER BY v.jour, v.debut");
  $st->execute([$depuis]);
  $bourse = $st->fetchAll();
  $st = $db->prepare("SELECT e.*, v.jour, v.debut, v.fin, v.agent_id AS titulaire, s.nom AS site_nom, a1.nom AS de_nom, a2.nom AS vers_nom, a3.nom AS accepte_nom
    FROM m_planif_echanges e JOIN vacations v ON v.id = e.vacation_id LEFT JOIN sites s ON s.id = v.site_id
    LEFT JOIN agents a1 ON a1.id = e.de_agent LEFT JOIN agents a2 ON a2.id = e.vers_agent LEFT JOIN agents a3 ON a3.id = e.accepte_par
    WHERE e.statut IN ('proposee', 'acceptee') OR e.decide_le >= ? ORDER BY CASE e.statut WHEN 'acceptee' THEN 0 WHEN 'proposee' THEN 1 ELSE 2 END, v.jour");
  $st->execute([$depuis]);
  $echanges = $st->fetchAll();
  // pour chaque échange accepté : le collègue peut-il vraiment le prendre ?
  foreach ($echanges as &$e) {
    $e['verif'] = null;
    if ($e['statut'] === 'acceptee') { try { $e['verif'] = mod_planif_verif(mod_planif_vacation((int)$e['vacation_id']), (int)$e['accepte_par']); } catch (Throwable $x) { /* poste supprimé */ } }
  }
  unset($e);
  $sites = $db->query('SELECT id, nom FROM sites WHERE actif = 1 ORDER BY nom COLLATE NOCASE')->fetchAll();
  $libres = $db->prepare("SELECT COUNT(*) FROM vacations WHERE agent_id = 0 AND statut <> 'annulee' AND jour >= ? AND jour <= ? AND id NOT IN (SELECT vacation_id FROM m_planif_bourse WHERE statut = 'ouverte')");
  $libres->execute([date('Y-m-d'), date('Y-m-d', time() + 7 * 86400)]);
  repondre(['ok' => true, 'besoins' => $besoins, 'bourse' => $bourse, 'echanges' => $echanges, 'sites' => $sites, 'qualifs' => EXP_QUALIFS, 'libres7' => (int)$libres->fetchColumn()]);
}
// Vérification serveur d'un placement (mêmes règles que la bourse et les échanges)
function mod_planif_verifier(): void
{
  $v = mod_planif_vacation((int)($_GET['id'] ?? 0));
  repondre(['ok' => true] + mod_planif_verif($v, (int)($_GET['agent'] ?? 0)));
}

/* ---------- Besoins récurrents ---------- */
function mod_planif_besoin_enregistrer(): void
{
  $b = corps();
  $site = (int)($b['site_id'] ?? 0);
  $st = db()->prepare('SELECT COUNT(*) FROM sites WHERE id = ? AND actif = 1');
  $st->execute([$site]);
  if (!(int)$st->fetchColumn()) throw new RuntimeException('Choisissez un site.');
  $debut = exp_heure((string)($b['debut'] ?? ''));
  $fin = exp_heure((string)($b['fin'] ?? ''));
  if ($debut === '' || $fin === '') throw new RuntimeException('Heures au format 08:00.');
  $jours = array_values(array_unique(array_filter(array_map('intval', (array)($b['jours'] ?? [])), fn ($j) => $j >= 1 && $j <= 7)));
  sort($jours);
  if (!$jours) throw new RuntimeException('Choisissez au moins un jour de la semaine.');
  $qualif = isset(EXP_QUALIFS[$b['qualif'] ?? '']) ? (string)$b['qualif'] : 'ADS';
  $nombre = max(1, min(10, (int)($b['nombre'] ?? 1)));
  $id = (int)($b['id'] ?? 0);
  if ($id) {
    db()->prepare('UPDATE m_planif_besoins SET site_id = ?, jours = ?, debut = ?, fin = ?, nombre = ?, qualif = ?, note = ? WHERE id = ?')
      ->execute([$site, implode(',', $jours), $debut, $fin, $nombre, $qualif, texte($b['note'] ?? '', 300), $id]);
  } else {
    db()->prepare('INSERT INTO m_planif_besoins (site_id, jours, debut, fin, nombre, qualif, note, cree) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      ->execute([$site, implode(',', $jours), $debut, $fin, $nombre, $qualif, texte($b['note'] ?? '', 300), maintenant()]);
  }
  repondre(['ok' => true]);
}
function mod_planif_besoin_retirer(): void
{
  db()->prepare('UPDATE m_planif_besoins SET actif = 0 WHERE id = ?')->execute([(int)(corps()['id'] ?? 0)]);
  repondre(['ok' => true]);
}
// Crée les postes non pourvus d'un mois d'après les besoins (sans doublon avec l'existant, jamais dans le passé)
function mod_planif_besoins_generer(): void
{
  $b = corps();
  $mois = preg_match('/^\d{4}-\d{2}$/', (string)($b['mois'] ?? '')) ? (string)$b['mois'] : date('Y-m');
  $site = (int)($b['site_id'] ?? 0);
  $st = db()->prepare('SELECT * FROM m_planif_besoins WHERE actif = 1' . ($site ? ' AND site_id = ?' : ''));
  $st->execute($site ? [$site] : []);
  $besoins = $st->fetchAll();
  if (!$besoins) throw new RuntimeException('Aucun besoin récurrent à générer.');
  $existe = db()->prepare("SELECT COUNT(*) FROM vacations WHERE site_id = ? AND jour = ? AND debut = ? AND fin = ? AND statut <> 'annulee'");
  $ins = db()->prepare('INSERT INTO vacations (site_id, jour, debut, fin, agent_id, qualif, pause, note, serie, cree, maj) VALUES (?, ?, ?, ?, 0, ?, 0, ?, ?, ?, ?)');
  $nbJours = (int)date('t', strtotime($mois . '-01'));
  $aujourdhui = date('Y-m-d');
  $crees = 0;
  db()->beginTransaction();
  try {
    foreach ($besoins as $be) {
      $jours = array_map('intval', explode(',', (string)$be['jours']));
      $serie = 'b' . $be['id'] . '-' . str_replace('-', '', $mois);
      for ($j = 1; $j <= $nbJours; $j++) {
        $t = strtotime(sprintf('%s-%02d', $mois, $j));
        $jour = date('Y-m-d', $t);
        if ($jour < $aujourdhui || !in_array((int)date('N', $t), $jours, true)) continue;
        $existe->execute([(int)$be['site_id'], $jour, $be['debut'], $be['fin']]);
        for ($n = (int)$existe->fetchColumn(); $n < (int)$be['nombre']; $n++) {
          $ins->execute([(int)$be['site_id'], $jour, $be['debut'], $be['fin'], $be['qualif'], (string)$be['note'], $serie, maintenant(), maintenant()]);
          $crees++;
        }
      }
    }
    db()->commit();
  } catch (Throwable $e) {
    db()->rollBack();
    throw $e;
  }
  journal('equipe', "Planning des sites : $crees poste(s) créé(s) d'après les besoins récurrents ($mois)");
  repondre(['ok' => true, 'crees' => $crees]);
}

/* ---------- Bourse aux postes ---------- */
function mod_planif_bourse_proposer(): void
{
  $b = corps();
  $ids = array_values(array_filter(array_map('intval', (array)($b['ids'] ?? []))));
  if (!empty($b['jours'])) {
    $st = db()->prepare("SELECT id FROM vacations WHERE agent_id = 0 AND statut <> 'annulee' AND jour >= ? AND jour <= ?");
    $st->execute([date('Y-m-d'), date('Y-m-d', time() + max(1, min(31, (int)$b['jours'])) * 86400)]);
    $ids = array_merge($ids, array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN)));
  }
  $n = 0;
  $ins = db()->prepare("INSERT INTO m_planif_bourse (vacation_id, propose_le, propose_par, statut) VALUES (?, ?, ?, 'ouverte')
    ON CONFLICT(vacation_id) DO UPDATE SET statut = 'ouverte', propose_le = excluded.propose_le, pris_par = 0, pris_le = ''");
  foreach (array_unique($ids) as $id) {
    $v = mod_planif_vacation($id);
    if ((int)$v['agent_id'] || $v['statut'] === 'annulee' || !mod_planif_a_venir($v)) continue;
    $ins->execute([$id, maintenant(), (string)($_SESSION['login'] ?? '')]);
    $n++;
  }
  if (!$n) throw new RuntimeException('Aucun poste libre et à venir à proposer.');
  journal('equipe', "Bourse aux postes : $n poste(s) proposé(s) aux agents");
  // agents qui ont l'appli BDA Équipe : « postes à prendre » (réglable dans l'admin)
  if (function_exists('mobile_auto')) mobile_auto('bourse', db()->query('SELECT DISTINCT agent_id FROM m_mobile_jetons')->fetchAll(PDO::FETCH_COLUMN), 'Postes à prendre', $n > 1 ? "$n postes libres sont proposés : le premier qui les prend les a." : 'Un poste libre est proposé : le premier qui le prend l’a.', '/espace-equipe#/postes');
  repondre(['ok' => true, 'proposes' => $n]);
}
function mod_planif_bourse_retirer(): void
{
  db()->prepare("UPDATE m_planif_bourse SET statut = 'retiree' WHERE id = ? AND statut = 'ouverte'")->execute([(int)(corps()['id'] ?? 0)]);
  repondre(['ok' => true]);
}

/* ---------- Échanges : décision de la direction ---------- */
function mod_planif_echange_decider(): void
{
  $b = corps();
  $st = db()->prepare("SELECT * FROM m_planif_echanges WHERE id = ? AND statut IN ('proposee', 'acceptee')");
  $st->execute([(int)($b['id'] ?? 0)]);
  $e = $st->fetch();
  if (!$e) throw new RuntimeException('Échange introuvable ou déjà traité.');
  $qui = (string)($_SESSION['login'] ?? '');
  if (($b['decision'] ?? '') !== 'valider') {
    db()->prepare("UPDATE m_planif_echanges SET statut = 'refusee', decide_le = ?, decide_par = ? WHERE id = ?")->execute([maintenant(), $qui, (int)$e['id']]);
    repondre(['ok' => true]);
  }
  if ($e['statut'] !== 'acceptee' || !(int)$e['accepte_par']) throw new RuntimeException('Aucun collègue n’a encore accepté ce poste.');
  $v = mod_planif_vacation((int)$e['vacation_id']);
  if ((int)$v['agent_id'] !== (int)$e['de_agent']) throw new RuntimeException('Le poste a changé entre-temps : il n’est plus à cet agent.');
  $r = mod_planif_verif($v, (int)$e['accepte_par']);
  if ($r['bloquant']) throw new RuntimeException(implode(' ', $r['raisons']));
  if (!$r['possible'] && empty($b['forcer'])) repondre(['ok' => false, 'erreur' => 'À vérifier : ' . implode(' ', $r['raisons']), 'raisons' => $r['raisons'], 'forcable' => true], 409);
  db()->prepare("UPDATE vacations SET agent_id = ?, confirme = '', alerte = 0, maj = ? WHERE id = ? AND agent_id = ?")->execute([(int)$e['accepte_par'], maintenant(), (int)$v['id'], (int)$e['de_agent']]);
  db()->prepare("UPDATE m_planif_echanges SET statut = 'validee', decide_le = ?, decide_par = ? WHERE id = ?")->execute([maintenant(), $qui, (int)$e['id']]);
  journal('equipe', 'Échange de poste validé (' . ($v['site_nom'] ?? 'site') . ', ' . $v['jour'] . ')');
  repondre(['ok' => true]);
}

/* ---------- Espace équipe ---------- */
function mod_planif_eq_postes(): void
{
  $c = eq_exiger();
  $moi = (int)$c['agent_id'];
  // bourse : postes ouverts que je peux tenir
  $bourse = [];
  foreach (db()->query("SELECT b.id AS bourse_id, v.*, s.nom AS site_nom, s.adresse AS site_adresse FROM m_planif_bourse b JOIN vacations v ON v.id = b.vacation_id LEFT JOIN sites s ON s.id = v.site_id
    WHERE b.statut = 'ouverte' AND v.agent_id = 0 AND v.statut <> 'annulee' ORDER BY v.jour, v.debut") as $v) {
    if (!mod_planif_a_venir($v)) continue;
    $r = mod_planif_verif($v, $moi);
    if ($r['bloquant']) continue;
    $bourse[] = mod_planif_ligne($v) + ['bourse' => (int)$v['bourse_id'], 'possible' => $r['possible'], 'raisons' => $r['raisons']];
  }
  // échanges proposés par des collègues (à moi ou à toute l'équipe)
  $st = db()->prepare("SELECT e.id AS echange_id, e.message, e.de_agent, v.*, s.nom AS site_nom, s.adresse AS site_adresse, a.nom AS de_nom FROM m_planif_echanges e JOIN vacations v ON v.id = e.vacation_id
    LEFT JOIN sites s ON s.id = v.site_id LEFT JOIN agents a ON a.id = e.de_agent WHERE e.statut = 'proposee' AND e.de_agent <> ? AND (e.vers_agent = 0 OR e.vers_agent = ?) ORDER BY v.jour, v.debut");
  $st->execute([$moi, $moi]);
  $pourMoi = [];
  foreach ($st as $v) {
    if (!mod_planif_a_venir($v)) continue;
    $r = mod_planif_verif($v, $moi);
    if ($r['bloquant']) continue;
    $pourMoi[] = mod_planif_ligne($v) + ['echange' => (int)$v['echange_id'], 'de' => mod_planif_nom_court((string)$v['de_nom']), 'message' => (string)$v['message'], 'possible' => $r['possible'], 'raisons' => $r['raisons']];
  }
  // mes postes à venir (pour proposer un échange) et mes propositions
  $st = db()->prepare("SELECT v.*, s.nom AS site_nom, s.adresse AS site_adresse FROM vacations v LEFT JOIN sites s ON s.id = v.site_id WHERE v.agent_id = ? AND v.statut <> 'annulee' AND v.jour >= ? AND v.jour <= ? ORDER BY v.jour, v.debut");
  $st->execute([$moi, date('Y-m-d'), date('Y-m-d', time() + 45 * 86400)]);
  $mesPostes = [];
  foreach ($st as $v) if (exp_bornes($v)[0] > time() + 12 * 3600) $mesPostes[] = mod_planif_ligne($v);
  $st = db()->prepare("SELECT e.id, e.statut, e.vacation_id, e.cree, v.jour, v.debut, v.fin, s.nom AS site_nom, a.nom AS accepte_nom FROM m_planif_echanges e JOIN vacations v ON v.id = e.vacation_id
    LEFT JOIN sites s ON s.id = v.site_id LEFT JOIN agents a ON a.id = e.accepte_par WHERE e.de_agent = ? AND (e.statut IN ('proposee', 'acceptee') OR e.decide_le >= ?) ORDER BY e.cree DESC");
  $st->execute([$moi, date('Y-m-d', time() - 14 * 86400)]);
  $mesEchanges = array_map(fn ($e) => ['id' => (int)$e['id'], 'vacation' => (int)$e['vacation_id'], 'statut' => (string)$e['statut'], 'site' => (string)$e['site_nom'],
    'libelle' => mod_planif_date_courte((string)$e['jour']) . ' · ' . $e['debut'] . '-' . $e['fin'], 'accepte' => $e['accepte_nom'] ? mod_planif_nom_court((string)$e['accepte_nom']) : ''], $st->fetchAll());
  $collegues = [];
  foreach (db()->query("SELECT id, nom FROM agents WHERE actif = 1 AND categorie <> 'secours' ORDER BY nom COLLATE NOCASE") as $a) {
    if ((int)$a['id'] !== $moi) $collegues[] = ['id' => (int)$a['id'], 'nom' => mod_planif_nom_court((string)$a['nom'])];
  }
  repondre(['ok' => true, 'bourse' => $bourse, 'pourMoi' => $pourMoi, 'mesPostes' => $mesPostes, 'mesEchanges' => $mesEchanges, 'collegues' => $collegues]);
}
function mod_planif_eq_prendre(): void
{
  $c = eq_exiger();
  $moi = (int)$c['agent_id'];
  if (!limiter('planif-prendre', 30, 3600)) throw new RuntimeException('Trop d’essais. Réessayez plus tard.');
  $st = db()->prepare("SELECT * FROM m_planif_bourse WHERE id = ? AND statut = 'ouverte'");
  $st->execute([(int)(corps()['id'] ?? 0)]);
  $b = $st->fetch();
  if (!$b) throw new RuntimeException('Ce poste n’est plus disponible.');
  $v = mod_planif_vacation((int)$b['vacation_id']);
  if ((int)$v['agent_id'] || !mod_planif_a_venir($v)) throw new RuntimeException('Ce poste vient d’être pris par un collègue.');
  $r = mod_planif_verif($v, $moi);
  if (!$r['possible']) throw new RuntimeException('Vous ne pouvez pas prendre ce poste : ' . implode(' ', $r['raisons']));
  // premier arrivé, premier servi : la mise à jour n'a lieu que si le poste est encore libre
  $maj = db()->prepare('UPDATE vacations SET agent_id = ?, confirme = ?, alerte = 0, maj = ? WHERE id = ? AND agent_id = 0');
  $maj->execute([$moi, maintenant(), maintenant(), (int)$v['id']]);
  if ($maj->rowCount() !== 1) throw new RuntimeException('Ce poste vient d’être pris par un collègue.');
  db()->prepare("UPDATE m_planif_bourse SET statut = 'prise', pris_par = ?, pris_le = ? WHERE id = ?")->execute([$moi, maintenant(), (int)$b['id']]);
  journal('equipe', 'Bourse aux postes : un agent a pris le poste du ' . $v['jour'] . ' (' . ($v['site_nom'] ?? 'site') . ')');
  notifier('bourse', 'Un poste vient d’être pris', 'Un agent a pris un poste de la bourse. Ouvrez le planning des sites.', '/admin/#/exploitation', 'bourse-prise');
  repondre(['ok' => true]);
}
function mod_planif_eq_ceder(): void
{
  $c = eq_exiger();
  $moi = (int)$c['agent_id'];
  if (!limiter('planif-ceder', 20, 3600)) throw new RuntimeException('Trop de propositions. Réessayez plus tard.');
  $b = corps();
  $v = mod_planif_vacation((int)($b['vacation_id'] ?? 0));
  if ((int)$v['agent_id'] !== $moi) throw new RuntimeException('Ce poste n’est pas le vôtre.');
  if (exp_bornes($v)[0] <= time() + 12 * 3600) throw new RuntimeException('Trop tard pour proposer ce poste : appelez la direction.');
  $st = db()->prepare("SELECT COUNT(*) FROM m_planif_echanges WHERE vacation_id = ? AND statut IN ('proposee', 'acceptee')");
  $st->execute([(int)$v['id']]);
  if ((int)$st->fetchColumn()) throw new RuntimeException('Vous avez déjà proposé ce poste.');
  $vers = max(0, (int)($b['vers'] ?? 0));
  if ($vers) {
    $st = db()->prepare('SELECT COUNT(*) FROM agents WHERE id = ? AND actif = 1');
    $st->execute([$vers]);
    if (!(int)$st->fetchColumn() || $vers === $moi) throw new RuntimeException('Collègue introuvable.');
  }
  db()->prepare('INSERT INTO m_planif_echanges (vacation_id, de_agent, vers_agent, message, cree) VALUES (?, ?, ?, ?, ?)')->execute([(int)$v['id'], $moi, $vers, texte($b['message'] ?? '', 300), maintenant()]);
  notifier('bourse', 'Un agent propose de céder un poste', 'Proposition d’échange dans l’Espace équipe.', '/admin/#/planif', 'bourse-echange');
  repondre(['ok' => true]);
}
function mod_planif_eq_accepter(): void
{
  $c = eq_exiger();
  $moi = (int)$c['agent_id'];
  $st = db()->prepare("SELECT * FROM m_planif_echanges WHERE id = ? AND statut = 'proposee' AND de_agent <> ? AND (vers_agent = 0 OR vers_agent = ?)");
  $st->execute([(int)(corps()['id'] ?? 0), $moi, $moi]);
  $e = $st->fetch();
  if (!$e) throw new RuntimeException('Cette proposition n’est plus disponible.');
  $v = mod_planif_vacation((int)$e['vacation_id']);
  $r = mod_planif_verif($v, $moi);
  if (!$r['possible']) throw new RuntimeException('Vous ne pouvez pas prendre ce poste : ' . implode(' ', $r['raisons']));
  $maj = db()->prepare("UPDATE m_planif_echanges SET statut = 'acceptee', accepte_par = ?, accepte_le = ? WHERE id = ? AND statut = 'proposee'");
  $maj->execute([$moi, maintenant(), (int)$e['id']]);
  if ($maj->rowCount() !== 1) throw new RuntimeException('Un collègue a déjà accepté.');
  notifier('bourse', 'Échange de poste à valider', 'Un agent a accepté de reprendre un poste. Validez-le dans Bourse & échanges.', '/admin/#/planif', 'bourse-valider');
  repondre(['ok' => true]);
}
function mod_planif_eq_annuler(): void
{
  $c = eq_exiger();
  db()->prepare("UPDATE m_planif_echanges SET statut = 'annulee', decide_le = ? WHERE id = ? AND de_agent = ? AND statut IN ('proposee', 'acceptee')")
    ->execute([maintenant(), (int)(corps()['id'] ?? 0), (int)$c['agent_id']]);
  repondre(['ok' => true]);
}

function mod_planif_compteurs(): array
{
  return ['bourse' => (int)db()->query("SELECT COUNT(*) FROM m_planif_echanges WHERE statut = 'acceptee'")->fetchColumn()];
}
