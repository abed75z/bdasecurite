<?php
/* =========================================================
   MODULE « AUDIT » — audits de sûreté (visite chez un client ou un prospect)
   - Grille de visite en 8 thèmes (périmètre, éclairage, vidéo, contrôle d'accès, alarme,
     incendie, organisation, risques) : chaque point est conforme, à améliorer, critique ou non
     concerné, avec un commentaire. Note globale sur 100 calculée.
   - Dispositif proposé : profils (agent, SSIAP, événementiel), nombre, horaires, jours.
     Le volume d'heures par mois est calculé.
   - Rapport A4 au format des devis (téléchargé en PDF dans le navigateur) et bouton
     « Préparer le devis » qui pré-remplit un devis BROUILLON (rien n'est envoyé au client).
   - Peut partir d'une demande reçue sur le site. Rien n'est supprimé : un audit est « retiré ».
   Gardiennage et surveillance seulement (autorisation CNAPS) : pas de protection rapprochée.
   ========================================================= */
declare(strict_types=1);

const MOD_AUDIT_TYPES = [
  'bar' => 'Bar, restaurant, club', 'commerce' => 'Commerce, magasin', 'chantier' => 'Chantier', 'bureaux' => 'Bureaux, entreprise',
  'residence' => 'Résidence, immeuble', 'hotel' => 'Hôtel', 'evenement' => 'Événement', 'erp' => 'Établissement recevant du public', 'autre' => 'Autre',
];
const MOD_AUDIT_ETATS = ['ok' => 'Conforme', 'ameliorer' => 'À améliorer', 'critique' => 'Point critique', 'na' => 'Non concerné'];
const MOD_AUDIT_PROFILS = ['agent' => 'Agents de sécurité (ADS)', 'ssiap1' => 'Agents SSIAP 1', 'ssiap2' => 'Chef d’équipe SSIAP 2', 'ssiap3' => 'Chef de service SSIAP 3', 'evenementiel' => 'Agents de sécurité événementielle'];
// [thème => [libellé, [clé => [point à vérifier, recommandation si à améliorer ou critique]]]]
const MOD_AUDIT_GRILLE = [
  'perimetre' => ['Périmètre et accès', [
    'cloture' => ['Limites du site (clôture, grilles, portes) en bon état', 'Réparer ou renforcer les points faibles du périmètre (clôture, grilles, portes).'],
    'acces' => ['Nombre d’accès connu et maîtrisé', 'Réduire le nombre d’accès ouverts et tenir les autres fermés ou surveillés.'],
    'vehicules' => ['Accès des véhicules et livraisons encadrés', 'Encadrer les livraisons (horaires, contrôle à l’entrée, zone dédiée).'],
    'faiblesses' => ['Pas de point d’intrusion facile (fenêtres basses, toits, issues)', 'Sécuriser les points d’intrusion repérés et les inclure dans les rondes.'],
  ]],
  'eclairage' => ['Éclairage', [
    'abords' => ['Abords et entrées éclairés la nuit', 'Éclairer les abords et les entrées la nuit (détecteurs de présence).'],
    'parkings' => ['Parkings et zones de stockage éclairés', 'Éclairer les parkings et zones de stockage, très exposés au vol.'],
  ]],
  'video' => ['Vidéoprotection', [
    'cameras' => ['Caméras sur les accès et zones sensibles', 'Couvrir les accès et zones sensibles par la vidéoprotection.'],
    'enregistrement' => ['Images enregistrées et conservées (30 jours au plus)', 'Vérifier l’enregistrement et la durée de conservation des images.'],
    'affichage' => ['Panneaux d’information « site sous vidéoprotection »', 'Afficher les panneaux d’information obligatoires.'],
    'visionnage' => ['Quelqu’un regarde les images ou reçoit les alertes', 'Prévoir qui regarde les images (agent sur place ou télésurveillance).'],
  ]],
  'acces_ctrl' => ['Contrôle d’accès', [
    'badges' => ['Badges, digicodes ou clés gérés (qui a quoi)', 'Tenir un registre des clés et badges, et le mettre à jour à chaque départ.'],
    'visiteurs' => ['Visiteurs et prestataires enregistrés', 'Mettre en place un registre des visiteurs et un contrôle à l’accueil.'],
    'filtrage' => ['Filtrage à l’entrée aux heures d’affluence', 'Filtrer les entrées aux heures d’affluence (agent au contrôle d’accès).'],
  ]],
  'alarme' => ['Alarme et télésurveillance', [
    'intrusion' => ['Alarme anti-intrusion en service', 'Installer ou remettre en service l’alarme anti-intrusion.'],
    'levee' => ['Levée de doute et intervention prévues', 'Prévoir la levée de doute et l’intervention d’un agent en cas d’alarme.'],
  ]],
  'incendie' => ['Sécurité incendie', [
    'extincteurs' => ['Extincteurs présents et vérifiés dans l’année', 'Faire vérifier les extincteurs (contrôle annuel obligatoire).'],
    'issues' => ['Issues de secours dégagées et balisées', 'Dégager et baliser les issues de secours sans attendre (obligation légale).'],
    'ssi' => ['Alarme incendie / SSI en état de marche', 'Faire contrôler l’alarme incendie ou le SSI par un technicien.'],
    'ssiap' => ['Présence SSIAP si l’établissement l’exige', 'Prévoir des agents SSIAP selon le classement de l’établissement (ERP).'],
  ]],
  'organisation' => ['Organisation et consignes', [
    'consignes' => ['Consignes de sécurité écrites et à jour', 'Rédiger des consignes de poste claires (nous les mettons en place avec vous).'],
    'urgences' => ['Numéros d’urgence affichés', 'Afficher les numéros d’urgence et le contact du responsable.'],
    'personnel' => ['Personnel informé (évacuation, conduite à tenir)', 'Former le personnel à l’évacuation et à la conduite à tenir.'],
  ]],
  'risques' => ['Risques propres au site', [
    'incidents' => ['Peu ou pas d’incidents ces 12 derniers mois', 'Présence dissuasive aux heures et endroits où les incidents se produisent.'],
    'affluence' => ['Heures d’affluence ou sensibles maîtrisées', 'Renforcer la présence aux heures d’affluence ou sensibles.'],
    'valeurs' => ['Valeurs, stock ou matériel sensible protégés', 'Protéger les valeurs et le stock sensible (local fermé, rondes, vidéo).'],
  ]],
];

function module_audit(): array
{
  return [
    'titre' => 'Audits de sûreté',
    'schema' => [
      1 => <<<'SQL'
        CREATE TABLE IF NOT EXISTS m_audit_audits (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL DEFAULT 0, client_nom TEXT NOT NULL DEFAULT '',
          adresse TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '', type_site TEXT NOT NULL DEFAULT 'autre', visite TEXT NOT NULL DEFAULT '',
          demande_id INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL DEFAULT '{}', score INTEGER NOT NULL DEFAULT 0, statut TEXT NOT NULL DEFAULT 'brouillon',
          auteur TEXT NOT NULL DEFAULT '', cree TEXT NOT NULL, maj TEXT NOT NULL, archive TEXT NOT NULL DEFAULT '');
        CREATE INDEX IF NOT EXISTS i_m_audit_maj ON m_audit_audits (archive, maj);
        SQL,
    ],
    'admin' => [
      'liste' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_audit_adm_liste'],
      'audit' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_audit_adm_audit'],
      'options' => ['methode' => 'GET', 'roles' => ['admin', 'manager'], 'fn' => 'mod_audit_adm_options'],
      'enregistrer' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_audit_adm_enregistrer'],
      'retirer' => ['methode' => 'POST', 'roles' => ['admin', 'manager'], 'fn' => 'mod_audit_adm_retirer'],
    ],
    'recherche' => 'mod_audit_recherche',
  ];
}

/* ---------- Calculs ---------- */
function mod_audit_nettoyer(array $d): array
{
  $rep = [];
  foreach (MOD_AUDIT_GRILLE as $t => [, $points]) foreach ($points as $k => $_) {
    $x = $d['reponses'][$t][$k] ?? null;
    if (!is_array($x)) continue;
    $etat = (string)($x['etat'] ?? '');
    $com = mb_substr(trim(chaine($x['commentaire'] ?? '')), 0, 600);
    if (!isset(MOD_AUDIT_ETATS[$etat]) && $com === '') continue;
    $rep[$t][$k] = ['etat' => isset(MOD_AUDIT_ETATS[$etat]) ? $etat : '', 'commentaire' => $com];
  }
  $besoins = [];
  foreach (array_slice((array)($d['besoins'] ?? []), 0, 12) as $b) {
    if (!is_array($b) || !isset(MOD_AUDIT_PROFILS[$b['profil'] ?? ''])) continue;
    $heure = fn ($v, $def) => is_string($v) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v) ? $v : $def;
    $besoins[] = [
      'profil' => (string)$b['profil'], 'nombre' => max(1, min(50, (int)($b['nombre'] ?? 1))),
      'debut' => $heure($b['debut'] ?? '', '20:00'), 'fin' => $heure($b['fin'] ?? '', '06:00'),
      'frequence' => ($b['frequence'] ?? '') === 'ponctuel' ? 'ponctuel' : 'mois',
      'jours' => max(1, min(($b['frequence'] ?? '') === 'ponctuel' ? 365 : 7, (int)($b['jours'] ?? 7))),
    ];
  }
  return [
    'reponses' => $rep,
    'besoins' => $besoins,
    'constat' => mb_substr(trim(chaine($d['constat'] ?? '')), 0, 4000),
    'recommandations' => mb_substr(trim(chaine($d['recommandations'] ?? '')), 0, 4000),
  ];
}
// Note sur 100 : conforme = 1, à améliorer = 0,5, critique = 0 (les « non concerné » ne comptent pas)
function mod_audit_score(array $rep): int
{
  $total = $points = 0;
  foreach ($rep as $points_theme) foreach ($points_theme as $x) {
    if (!in_array($x['etat'], ['ok', 'ameliorer', 'critique'], true)) continue;
    $total++;
    $points += ['ok' => 1, 'ameliorer' => 0.5, 'critique' => 0][$x['etat']];
  }
  return $total ? (int)round(100 * $points / $total) : 0;
}
function mod_audit_ligne(array $a): array
{
  $d = json_decode((string)$a['data'], true) ?: [];
  $crit = 0;
  foreach ((array)($d['reponses'] ?? []) as $t) foreach ($t as $x) if (($x['etat'] ?? '') === 'critique') $crit++;
  return ['id' => (int)$a['id'], 'client_id' => (int)$a['client_id'], 'client' => (string)$a['client_nom'], 'adresse' => (string)$a['adresse'],
    'type' => (string)$a['type_site'], 'typeLib' => MOD_AUDIT_TYPES[$a['type_site']] ?? 'Autre', 'visite' => (string)$a['visite'], 'score' => (int)$a['score'],
    'critiques' => $crit, 'statut' => (string)$a['statut'], 'auteur' => (string)$a['auteur'], 'maj' => (string)$a['maj']];
}

/* ---------- Admin ---------- */
function mod_audit_adm_liste(): void
{
  $st = db()->query("SELECT * FROM m_audit_audits WHERE archive = '' ORDER BY maj DESC LIMIT 300");
  repondre(['ok' => true, 'audits' => array_map('mod_audit_ligne', $st->fetchAll())]);
}
function mod_audit_adm_audit(): void
{
  $st = db()->prepare("SELECT * FROM m_audit_audits WHERE id = ? AND archive = ''");
  $st->execute([(int)($_GET['id'] ?? 0)]);
  $a = $st->fetch();
  if (!$a) throw new RuntimeException('Audit introuvable.');
  repondre(['ok' => true, 'audit' => mod_audit_ligne($a) + ['contact' => (string)$a['contact'], 'demande_id' => (int)$a['demande_id'], 'data' => mod_audit_nettoyer(json_decode((string)$a['data'], true) ?: [])]]);
}
// Grille, listes et, si demandé, ce qu'on sait d'une demande du site (pour commencer l'audit)
function mod_audit_adm_options(): void
{
  $db = db();
  $grille = [];
  foreach (MOD_AUDIT_GRILLE as $t => [$lib, $points]) $grille[] = ['cle' => $t, 'libelle' => $lib, 'points' => array_map(fn ($k, $p) => ['cle' => $k, 'libelle' => $p[0], 'reco' => $p[1]], array_keys($points), $points)];
  $depart = null;
  if ($id = (int)($_GET['demande'] ?? 0)) {
    $st = $db->prepare('SELECT id, data FROM demandes WHERE id = ?');
    $st->execute([$id]);
    if ($d = $st->fetch()) {
      $v = json_decode((string)$d['data'], true) ?: [];
      $depart = ['demande_id' => (int)$d['id'], 'client' => (string)($v['Nom / Société'] ?? ''), 'contact' => trim(implode(' · ', array_filter([(string)($v['Téléphone'] ?? ''), (string)($v['Email'] ?? '')]))),
        'adresse' => (string)($v['Lieu'] ?? $v['Adresse'] ?? ''), 'constat' => trim((string)($v['Prestation'] ?? '') . ((string)($v['Détails'] ?? '') !== '' ? ' — ' . $v['Détails'] : ''))];
    }
  }
  repondre([
    'ok' => true, 'grille' => $grille, 'types' => MOD_AUDIT_TYPES, 'etats' => MOD_AUDIT_ETATS, 'profils' => MOD_AUDIT_PROFILS,
    'clients' => $db->query('SELECT id, nom, adresse, tel, email FROM clients ORDER BY nom COLLATE NOCASE')->fetchAll(),
    'depart' => $depart,
  ]);
}
function mod_audit_adm_enregistrer(): void
{
  $b = corps();
  $id = (int)($b['id'] ?? 0);
  $client = trim(chaine($b['client'] ?? ''));
  if ($client === '') throw new RuntimeException('Indiquez le client ou le prospect.');
  $type = isset(MOD_AUDIT_TYPES[$b['type'] ?? '']) ? (string)$b['type'] : 'autre';
  $visite = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($b['visite'] ?? '')) ? (string)$b['visite'] : date('Y-m-d');
  $data = mod_audit_nettoyer(is_array($b['data'] ?? null) ? $b['data'] : []);
  $score = mod_audit_score($data['reponses']);
  $statut = ($b['statut'] ?? '') === 'termine' ? 'termine' : 'brouillon';
  $val = [(int)($b['client_id'] ?? 0), mb_substr($client, 0, 160), mb_substr(trim(chaine($b['adresse'] ?? '')), 0, 300), mb_substr(trim(chaine($b['contact'] ?? '')), 0, 300),
    $type, $visite, json_encode($data, JSON_UNESCAPED_UNICODE), $score, $statut, maintenant()];
  $db = db();
  if ($id) {
    $st = $db->prepare("UPDATE m_audit_audits SET client_id = ?, client_nom = ?, adresse = ?, contact = ?, type_site = ?, visite = ?, data = ?, score = ?, statut = ?, maj = ? WHERE id = ? AND archive = ''");
    $st->execute([...$val, $id]);
    if (!$st->rowCount()) throw new RuntimeException('Audit introuvable.');
  } else {
    $db->prepare('INSERT INTO m_audit_audits (client_id, client_nom, adresse, contact, type_site, visite, data, score, statut, maj, demande_id, auteur, cree) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      ->execute([...$val, (int)($b['demande_id'] ?? 0), (string)($_SESSION['login'] ?? ''), maintenant()]);
    $id = (int)$db->lastInsertId();
    journal('clients', 'Audit de sûreté commencé : ' . $client);
  }
  repondre(['ok' => true, 'id' => $id, 'score' => $score]);
}
function mod_audit_adm_retirer(): void
{
  $st = db()->prepare("UPDATE m_audit_audits SET archive = ? WHERE id = ? AND archive = ''");
  $st->execute([maintenant(), (int)(corps()['id'] ?? 0)]);
  if (!$st->rowCount()) throw new RuntimeException('Audit introuvable.');
  repondre(['ok' => true]);
}
function mod_audit_recherche(): array
{
  $r = [['titre' => 'Nouvel audit de sûreté', 'sous' => 'Visite chez un client ou un prospect', 'href' => '#/audit/nouveau', 'ic' => 'cible', 'groupe' => 'Audits de sûreté', 'mots' => 'audit surete visite diagnostic']];
  foreach (db()->query("SELECT id, client_nom, visite FROM m_audit_audits WHERE archive = '' ORDER BY maj DESC LIMIT 100") as $a) {
    $r[] = ['titre' => 'Audit · ' . $a['client_nom'], 'sous' => 'Visite du ' . (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', (string)$a['visite'], $m) ? "$m[3]/$m[2]/$m[1]" : ''), 'href' => '#/audit/' . (int)$a['id'], 'ic' => 'cible', 'groupe' => 'Audits de sûreté', 'mots' => 'audit ' . $a['client_nom']];
  }
  return $r;
}
