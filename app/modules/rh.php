<?php
/* =========================================================
   MODULE « RH » — formations et embauches
   - Formations et habilitations de chaque agent : MAC APS (tous les 5 ans, avant le
     renouvellement de la carte pro), SST (24 mois), recyclage SSIAP (3 ans), H0B0 (3 ans),
     diplôme initial, autre. Date d'obtention, échéance calculée (modifiable), organisme.
     Alerte dans la cloche : échéance dépassée ou dans les 60 jours (agents actifs).
   - Embauches de A à Z : une liste de contrôle par nouvel agent (carte pro vérifiée,
     identité, DPAE, contrat, registre du personnel, visite d'information et de prévention,
     mutuelle, RIB, tenue, Espace équipe, consignes, accueil sur site), avec date et auteur.
   Rien n'est envoyé ni déclaré automatiquement : c'est un aide-mémoire. Rien n'est supprimé (archive).
   ========================================================= */
declare(strict_types=1);

// type => [libellé, durée de validité en mois (0 = pas d'échéance)]
const MOD_RH_FORMATIONS = [
  'mac_aps' => ['MAC APS (maintien des compétences)', 60],
  'sst' => ['SST (sauveteur secouriste du travail)', 24],
  'ssiap' => ['Recyclage SSIAP', 36],
  'h0b0' => ['Habilitation électrique H0B0', 36],
  'cqp_aps' => ['Diplôme initial (CQP / TFP APS)', 0],
  'autre' => ['Autre formation', 0],
];
const MOD_RH_ETAPES = [
  'carte_pro' => ['Carte professionnelle vérifiée', 'Numéro et validité contrôlés sur DRACAR (espace CNAPS) avant toute prise de poste.'],
  'identite' => ['Pièce d’identité vérifiée', 'Et titre de séjour autorisant à travailler, pour un salarié étranger.'],
  'dpae' => ['DPAE faite', 'Déclaration préalable à l’embauche (URSSAF), au plus tard avant la prise de poste.'],
  'contrat' => ['Contrat de travail signé', 'Les deux exemplaires signés ; copie dans les documents de l’agent.'],
  'registre' => ['Inscrit au registre du personnel', 'Registre unique du personnel tenu à jour (obligatoire).'],
  'vip' => ['Visite d’information et de prévention demandée', 'Auprès du service de santé au travail, dans les 3 mois après l’embauche.'],
  'mutuelle' => ['Mutuelle d’entreprise proposée', 'Adhésion ou dispense signée.'],
  'rib' => ['RIB et coordonnées reçus', 'Pour la paie (TESE) et les contacts d’urgence.'],
  'tenue' => ['Tenue et matériel remis', 'À enregistrer dans Terrain & qualité › Matériel & tenues.'],
  'espace' => ['Compte Espace équipe ouvert', 'Planning, fiches de paie, consignes et carte d’agent sur son téléphone.'],
  'consignes' => ['Consignes du site lues', 'Confirmées « lu et compris » dans l’Espace équipe.'],
  'accueil' => ['Accueil sur le site fait', 'Présentation au client, visite des lieux, numéros d’urgence.'],
];

function module_rh(): array
{
  return [
    'titre' => 'Formations & embauches',
    'schema' => [
      1 => <<<'SQL'
        CREATE TABLE IF NOT EXISTS m_rh_formations (id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL, type TEXT NOT NULL, libelle TEXT NOT NULL DEFAULT '',
          obtenu TEXT NOT NULL DEFAULT '', expire TEXT NOT NULL DEFAULT '', organisme TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
          cree TEXT NOT NULL, maj TEXT NOT NULL, archive TEXT NOT NULL DEFAULT '');
        CREATE INDEX IF NOT EXISTS i_m_rh_form_agent ON m_rh_formations (agent_id, archive);
        CREATE TABLE IF NOT EXISTS m_rh_embauches (id INTEGER PRIMARY KEY, agent_id INTEGER NOT NULL DEFAULT 0, nom TEXT NOT NULL, poste TEXT NOT NULL DEFAULT '',
          debut TEXT NOT NULL DEFAULT '', etapes TEXT NOT NULL DEFAULT '{}', note TEXT NOT NULL DEFAULT '', statut TEXT NOT NULL DEFAULT 'en_cours',
          cree TEXT NOT NULL, maj TEXT NOT NULL, archive TEXT NOT NULL DEFAULT '');
        SQL,
    ],
    'admin' => [
      'tableau' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_rh_adm_tableau'],
      'formation.enregistrer' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_rh_adm_formation_enregistrer'],
      'formation.retirer' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_rh_adm_formation_retirer'],
      'embauche.enregistrer' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_rh_adm_embauche_enregistrer'],
      'embauche.etape' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_rh_adm_embauche_etape'],
      'embauche.retirer' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_rh_adm_embauche_retirer'],
    ],
    'compteurs' => 'mod_rh_compteurs',
  ];
}

function mod_rh_date(?string $v): string
{
  return is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) && strtotime($v) ? $v : '';
}
function mod_rh_etat(string $expire): string
{
  if ($expire === '') return 'permanent';
  if ($expire < date('Y-m-d')) return 'expiree';
  return $expire <= date('Y-m-d', time() + 60 * 86400) ? 'bientot' : 'valide';
}
function mod_rh_a_renouveler(): array
{
  $st = db()->query("SELECT f.id, f.agent_id, f.type, f.libelle, f.expire, a.nom FROM m_rh_formations f JOIN agents a ON a.id = f.agent_id
    WHERE f.archive = '' AND a.actif = 1 AND f.expire <> '' AND f.expire <= '" . date('Y-m-d', time() + 60 * 86400) . "' ORDER BY f.expire");
  return $st->fetchAll();
}
function mod_rh_compteurs(): array
{
  return ['formations' => count(mod_rh_a_renouveler())];
}

function mod_rh_adm_tableau(): void
{
  $db = db();
  $agents = $db->query("SELECT id, nom, poste, validite FROM agents WHERE actif = 1 ORDER BY nom COLLATE NOCASE")->fetchAll();
  $form = [];
  foreach ($db->query("SELECT * FROM m_rh_formations WHERE archive = '' ORDER BY obtenu DESC, id DESC") as $f) {
    $form[] = ['id' => (int)$f['id'], 'agent_id' => (int)$f['agent_id'], 'type' => (string)$f['type'], 'libelle' => (string)$f['libelle'] ?: (MOD_RH_FORMATIONS[$f['type']][0] ?? 'Formation'),
      'obtenu' => (string)$f['obtenu'], 'expire' => (string)$f['expire'], 'organisme' => (string)$f['organisme'], 'note' => (string)$f['note'], 'etat' => mod_rh_etat((string)$f['expire'])];
  }
  $emb = [];
  foreach ($db->query("SELECT * FROM m_rh_embauches WHERE archive = '' ORDER BY statut = 'termine', debut DESC, id DESC LIMIT 100") as $e) {
    $emb[] = ['id' => (int)$e['id'], 'agent_id' => (int)$e['agent_id'], 'nom' => (string)$e['nom'], 'poste' => (string)$e['poste'], 'debut' => (string)$e['debut'],
      'etapes' => json_decode((string)$e['etapes'], true) ?: new stdClass(), 'note' => (string)$e['note'], 'statut' => (string)$e['statut'], 'maj' => (string)$e['maj']];
  }
  repondre([
    'ok' => true,
    'agents' => array_map(fn ($a) => ['id' => (int)$a['id'], 'nom' => (string)$a['nom'], 'poste' => (string)$a['poste'], 'carte' => (string)$a['validite']], $agents),
    'formations' => $form,
    'types' => array_map(fn ($t) => ['libelle' => $t[0], 'mois' => $t[1]], MOD_RH_FORMATIONS),
    'embauches' => $emb,
    'etapes' => array_map(fn ($e) => ['libelle' => $e[0], 'aide' => $e[1]], MOD_RH_ETAPES),
    'aRenouveler' => count(mod_rh_a_renouveler()),
  ]);
}
function mod_rh_adm_formation_enregistrer(): void
{
  $b = corps();
  $id = (int)($b['id'] ?? 0);
  $type = isset(MOD_RH_FORMATIONS[$b['type'] ?? '']) ? (string)$b['type'] : 'autre';
  $agent = (int)($b['agent_id'] ?? 0);
  $st = db()->prepare('SELECT id FROM agents WHERE id = ?');
  $st->execute([$agent]);
  if (!$st->fetchColumn()) throw new RuntimeException('Choisissez l’agent.');
  $obtenu = mod_rh_date($b['obtenu'] ?? '');
  if ($obtenu === '') throw new RuntimeException('Indiquez la date d’obtention.');
  $expire = mod_rh_date($b['expire'] ?? '');
  if ($expire === '' && ($mois = MOD_RH_FORMATIONS[$type][1]) > 0) $expire = date('Y-m-d', strtotime("$obtenu +$mois months"));
  $val = [$agent, $type, mb_substr(trim(chaine($b['libelle'] ?? '')), 0, 120), $obtenu, $expire, mb_substr(trim(chaine($b['organisme'] ?? '')), 0, 120), mb_substr(trim(chaine($b['note'] ?? '')), 0, 500), maintenant()];
  if ($id) {
    $st = db()->prepare("UPDATE m_rh_formations SET agent_id = ?, type = ?, libelle = ?, obtenu = ?, expire = ?, organisme = ?, note = ?, maj = ? WHERE id = ? AND archive = ''");
    $st->execute([...$val, $id]);
  } else {
    db()->prepare('INSERT INTO m_rh_formations (agent_id, type, libelle, obtenu, expire, organisme, note, maj, cree) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([...$val, maintenant()]);
  }
  repondre(['ok' => true, 'expire' => $expire]);
}
function mod_rh_adm_formation_retirer(): void
{
  db()->prepare("UPDATE m_rh_formations SET archive = ? WHERE id = ? AND archive = ''")->execute([maintenant(), (int)(corps()['id'] ?? 0)]);
  repondre(['ok' => true]);
}
function mod_rh_adm_embauche_enregistrer(): void
{
  $b = corps();
  $id = (int)($b['id'] ?? 0);
  $agent = (int)($b['agent_id'] ?? 0);
  $nom = trim(chaine($b['nom'] ?? ''));
  if ($agent) {
    $st = db()->prepare('SELECT nom, poste FROM agents WHERE id = ?');
    $st->execute([$agent]);
    $a = $st->fetch();
    if (!$a) throw new RuntimeException('Agent introuvable.');
    $nom = $nom !== '' ? $nom : (string)$a['nom'];
  }
  if ($nom === '') throw new RuntimeException('Indiquez le nom de la personne embauchée.');
  $val = [$agent, mb_substr($nom, 0, 120), mb_substr(trim(chaine($b['poste'] ?? '')), 0, 80), mod_rh_date($b['debut'] ?? ''), mb_substr(trim(chaine($b['note'] ?? '')), 0, 1000), maintenant()];
  if ($id) {
    db()->prepare("UPDATE m_rh_embauches SET agent_id = ?, nom = ?, poste = ?, debut = ?, note = ?, maj = ? WHERE id = ? AND archive = ''")->execute([...$val, $id]);
  } else {
    db()->prepare('INSERT INTO m_rh_embauches (agent_id, nom, poste, debut, note, maj, cree) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute([...$val, maintenant()]);
    $id = (int)db()->lastInsertId();
    journal('equipe', 'Embauche commencée : ' . $nom);
  }
  repondre(['ok' => true, 'id' => $id]);
}
function mod_rh_adm_embauche_etape(): void
{
  $b = corps();
  $cle = (string)($b['etape'] ?? '');
  if (!isset(MOD_RH_ETAPES[$cle])) throw new RuntimeException('Étape inconnue.');
  $db = db();
  $st = $db->prepare("SELECT etapes FROM m_rh_embauches WHERE id = ? AND archive = ''");
  $st->execute([(int)($b['id'] ?? 0)]);
  $brut = $st->fetchColumn();
  if ($brut === false) throw new RuntimeException('Embauche introuvable.');
  $etapes = json_decode((string)$brut, true) ?: [];
  if (!empty($b['fait'])) $etapes[$cle] = ['le' => maintenant(), 'par' => (string)($_SESSION['login'] ?? '')];
  else unset($etapes[$cle]);
  $statut = count(array_intersect_key($etapes, MOD_RH_ETAPES)) === count(MOD_RH_ETAPES) ? 'termine' : 'en_cours';
  $db->prepare('UPDATE m_rh_embauches SET etapes = ?, statut = ?, maj = ? WHERE id = ?')->execute([json_encode($etapes, JSON_UNESCAPED_UNICODE), $statut, maintenant(), (int)$b['id']]);
  repondre(['ok' => true, 'etapes' => $etapes ?: new stdClass(), 'statut' => $statut]);
}
function mod_rh_adm_embauche_retirer(): void
{
  db()->prepare("UPDATE m_rh_embauches SET archive = ? WHERE id = ? AND archive = ''")->execute([maintenant(), (int)(corps()['id'] ?? 0)]);
  repondre(['ok' => true]);
}
