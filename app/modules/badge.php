<?php
/* =========================================================
   MODULE « BADGE » — la carte d'agent numérique vérifiable
   - Dans son Espace équipe (page « Ma carte »), l'agent montre une carte aux couleurs de
     BDA Security Group avec un QR code. Le client ou le responsable du site le scanne :
     la page publique bdasecurite.com/verifier confirme en direct que la personne est bien
     un agent de BDA, avec l'état de sa carte professionnelle.
   - Page publique : prénom + initiale du nom, qualification, 4 derniers caractères de la carte
     pro, validité, heure de la vérification. Jamais le nom complet, le téléphone, ni le planning.
   - Le jeton du QR est propre à chaque agent ; l'admin peut le renouveler (l'ancien QR ne
     marche plus). Agent inactif ou carte expirée : la page le dit clairement.
   - Les vérifications sont comptées (date seulement, aucune adresse IP).
   ========================================================= */
declare(strict_types=1);

const MOD_BADGE_QUALIFS = [
  'ADS' => 'Agent de sécurité',
  'Agent de protection rapprochée' => 'Agent de sécurité', // autorisation de l'entreprise : surveillance et gardiennage
  'Agent événementiel' => 'Agent de sécurité événementielle',
  'Chef d\'équipe' => 'Chef d’équipe sécurité',
  'SSIAP' => 'Agent de sécurité incendie (SSIAP)',
  'Chauffeur VTC' => 'Chauffeur',
  'Gérant' => 'Gérant',
];

function module_badge(): array
{
  return [
    'titre' => 'Cartes d’agent',
    'schema' => [
      1 => <<<'SQL'
        CREATE TABLE IF NOT EXISTS m_badge_jetons (agent_id INTEGER PRIMARY KEY, jeton TEXT NOT NULL UNIQUE, cree TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS m_badge_verifs (id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL, quand TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS i_m_badge_verifs_agent ON m_badge_verifs (agent_id, quand);
        SQL,
    ],
    'admin' => [
      'liste' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_badge_adm_liste'],
      'carte' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_badge_adm_carte'],
      'renouveler' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_badge_adm_renouveler'],
    ],
    'equipe' => [
      'carte' => ['methode' => 'GET', 'fn' => 'mod_badge_eq_carte'],
    ],
    'public' => [
      'verifier' => ['methode' => 'POST', 'fn' => 'mod_badge_pub_verifier'],
    ],
  ];
}

/* ---------- Outils ---------- */
function mod_badge_qualif(string $poste): string
{
  if (isset(MOD_BADGE_QUALIFS[$poste])) return MOD_BADGE_QUALIFS[$poste];
  if (preg_match('/^SSIAP\s*([123])?$/i', $poste, $m)) return 'Agent de sécurité incendie (SSIAP' . (isset($m[1]) ? ' ' . $m[1] : '') . ')';
  return 'Agent de sécurité';
}
// « PETIT Yanis » → prénom « Yanis », nom « PETIT » (les mots en capitales sont le nom de famille)
function mod_badge_decouper(string $nom): array
{
  $mots = preg_split('/\s+/', trim($nom)) ?: [];
  $famille = $prenoms = [];
  foreach ($mots as $m) {
    if ($m !== '' && mb_strtoupper($m) === $m && preg_match('/\p{L}{2,}/u', $m)) $famille[] = $m;
    else $prenoms[] = $m;
  }
  if (!$prenoms) { $prenoms = array_slice($mots, -1); $famille = array_slice($mots, 0, -1); } // tout en capitales : « KARIM TEST »
  $prenom = implode(' ', array_map(fn ($p) => mb_convert_case(mb_strtolower($p), MB_CASE_TITLE), $prenoms));
  return ['prenom' => $prenom, 'nom' => implode(' ', $famille)];
}
function mod_badge_etat(array $a): string
{
  if (!(int)$a['actif']) return 'inactif';
  $v = (string)$a['validite'];
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) return 'a_verifier';
  return $v < date('Y-m-d') ? 'expiree' : 'valide';
}
function mod_badge_jeton(int $agentId, bool $nouveau = false): string
{
  $db = db();
  if (!$nouveau) {
    $st = $db->prepare('SELECT jeton FROM m_badge_jetons WHERE agent_id = ?');
    $st->execute([$agentId]);
    if ($j = $st->fetchColumn()) return (string)$j;
  }
  $j = bin2hex(random_bytes(16));
  $db->prepare('INSERT INTO m_badge_jetons (agent_id, jeton, cree) VALUES (?, ?, ?) ON CONFLICT(agent_id) DO UPDATE SET jeton = excluded.jeton, cree = excluded.cree')
    ->execute([$agentId, $j, maintenant()]);
  return $j;
}
function mod_badge_agent(int $id): array
{
  $st = db()->prepare('SELECT id, nom, poste, carte, validite, actif FROM agents WHERE id = ?');
  $st->execute([$id]);
  $a = $st->fetch();
  if (!$a) throw new RuntimeException('Agent introuvable.');
  return $a;
}
function mod_badge_fr(string $iso): string
{
  return preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $iso, $m) ? "$m[3]/$m[2]/$m[1]" : '';
}
// Carte complète (pour l'agent lui-même et la direction)
function mod_badge_fiche(array $a): array
{
  $n = mod_badge_decouper((string)$a['nom']);
  $st = db()->prepare('SELECT COUNT(*) FROM m_badge_verifs WHERE agent_id = ?');
  $st->execute([(int)$a['id']]);
  return [
    'id' => (int)$a['id'],
    'prenom' => $n['prenom'],
    'nom' => $n['nom'],
    'qualification' => mod_badge_qualif((string)$a['poste']),
    'carte' => (string)$a['carte'],
    'validite' => mod_badge_fr((string)$a['validite']),
    'etat' => mod_badge_etat($a),
    'url' => mod_url('verifier') . '#' . mod_badge_jeton((int)$a['id']),
    'verifications' => (int)$st->fetchColumn(),
  ];
}

/* ---------- Espace équipe ---------- */
function mod_badge_eq_carte(): void
{
  $c = eq_exiger();
  repondre(['ok' => true, 'carte' => mod_badge_fiche(mod_badge_agent((int)$c['agent_id']))]);
}

/* ---------- Page publique /verifier ---------- */
function mod_badge_pub_verifier(): void
{
  if (!limiter('badge-verif', 60, 600)) echec('Trop de vérifications. Réessayez dans quelques minutes.', 429);
  $j = chaine(corps()['jeton'] ?? '');
  if (!preg_match('/^[a-f0-9]{32}$/', $j)) echec('QR code non reconnu.', 404);
  $st = db()->prepare('SELECT a.id, a.nom, a.poste, a.carte, a.validite, a.actif FROM m_badge_jetons b JOIN agents a ON a.id = b.agent_id WHERE b.jeton = ?');
  $st->execute([$j]);
  $a = $st->fetch();
  if (!$a) echec('Ce QR code n’est pas (ou plus) valable. Il a pu être remplacé par un nouveau.', 404);
  db()->prepare('INSERT INTO m_badge_verifs (agent_id, quand) VALUES (?, ?)')->execute([(int)$a['id'], maintenant()]);
  $n = mod_badge_decouper((string)$a['nom']);
  $carte = preg_replace('/\s+/', '', (string)$a['carte']);
  $etat = mod_badge_etat($a);
  repondre([
    'ok' => true,
    'agent' => [
      'prenom' => $n['prenom'],
      'initiale' => $n['nom'] !== '' ? mb_substr($n['nom'], 0, 1) . '.' : '',
      'qualification' => mod_badge_qualif((string)$a['poste']),
      'carte' => $carte !== '' ? '•••• ' . mb_substr($carte, -4) : '',
      'validite' => $etat === 'inactif' ? '' : mod_badge_fr((string)$a['validite']),
      'etat' => $etat,
    ],
    'verifie' => date('d/m/Y à H:i:s'),
  ]);
}

/* ---------- Admin ---------- */
function mod_badge_adm_liste(): void
{
  $db = db();
  $verifs = [];
  foreach ($db->query('SELECT agent_id, COUNT(*) AS n, MAX(quand) AS dernier FROM m_badge_verifs GROUP BY agent_id') as $v) $verifs[(int)$v['agent_id']] = $v;
  $jetons = [];
  foreach ($db->query('SELECT agent_id, cree FROM m_badge_jetons') as $j) $jetons[(int)$j['agent_id']] = (string)$j['cree'];
  $liste = [];
  foreach ($db->query("SELECT id, nom, poste, carte, validite, actif FROM agents WHERE actif = 1 ORDER BY nom COLLATE NOCASE") as $a) {
    $liste[] = ['id' => (int)$a['id'], 'nom' => (string)$a['nom'], 'qualification' => mod_badge_qualif((string)$a['poste']),
      'carte' => (string)$a['carte'], 'validite' => mod_badge_fr((string)$a['validite']), 'etat' => mod_badge_etat($a),
      'qr' => $jetons[(int)$a['id']] ?? '', 'verifications' => (int)($verifs[(int)$a['id']]['n'] ?? 0), 'derniere' => (string)($verifs[(int)$a['id']]['dernier'] ?? '')];
  }
  repondre(['ok' => true, 'agents' => $liste]);
}
function mod_badge_adm_carte(): void
{
  repondre(['ok' => true, 'carte' => mod_badge_fiche(mod_badge_agent((int)($_GET['id'] ?? 0)))]);
}
function mod_badge_adm_renouveler(): void
{
  $a = mod_badge_agent((int)(corps()['agent_id'] ?? 0));
  mod_badge_jeton((int)$a['id'], true);
  journal('equipe', 'Carte d’agent : nouveau QR code pour ' . $a['nom'] . ' (l’ancien ne marche plus)');
  repondre(['ok' => true, 'carte' => mod_badge_fiche($a)]);
}
