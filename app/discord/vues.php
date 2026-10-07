<?php
/* =========================================================
   DISCORD — vues : panel, tableau de bord, listes et fiches détaillées
   (demandes, clients, devis, factures, agents, planning, pointage, absences,
   main courante, comptes équipe, candidatures, avis, VTC, veille, site, journal).
   Chaque vue renvoie un message Discord : ['embeds' => […], 'components' => […]].
   ========================================================= */
declare(strict_types=1);

require_once __DIR__ . '/bot.php';

const DC_DOCS = [
  'identite' => 'Pièce d’identité', 'carte_pro' => 'Carte professionnelle', 'diplome_aps' => 'Diplôme / titre APS', 'secu' => 'Sécurité sociale', 'rib' => 'RIB',
  'certif' => 'Certificat (SST…)', 'attestation' => 'Attestation', 'cv' => 'CV', 'dossier' => 'Dossier complet', 'autre' => 'Autre document', 'contrat' => 'Contrat de travail',
  'carte_vtc' => 'Carte VTC', 'permis' => 'Permis de conduire', 'assurance' => 'Assurance', 'justificatif' => 'Justificatif',
];
const DC_DOCS_OBLIGATOIRES = ['identite', 'carte_pro', 'diplome_aps', 'secu', 'rib'];
const DC_INCIDENTS = ['intrusion' => 'Intrusion / tentative', 'vol' => 'Vol / dégradation', 'agression' => 'Agression / altercation', 'incendie' => 'Incendie / alarme', 'secours' => 'Secours à personne', 'technique' => 'Problème technique', 'ronde' => 'Ronde / contrôle', 'autre' => 'Autre'];
const DC_ABSENCES = ['conges' => 'Congés payés', 'maladie' => 'Arrêt maladie', 'absence' => 'Absence', 'indispo' => 'Indisponibilité'];
const DC_METIERS = ['securite' => 'Agent de sécurité', 'ssiap' => 'Agent SSIAP', 'chauffeur' => 'Chauffeur VTC'];
const DC_CODES_ABSENCE = ['CP', 'M', 'ABS', 'R'];

/* ---------- Outils ---------- */
// Valeur d'un champ de formulaire du site (demandes, candidatures), quel que soit son libellé exact
function dc_form(array $data, array $cles): string
{
  foreach ($cles as $c) {
    foreach ($data as $k => $v) {
      if (mb_strtolower(trim((string)$k)) === mb_strtolower($c) && trim((string)$v) !== '') return trim((string)$v);
    }
  }
  return '';
}
function dcv_introuvable(string $quoi): array
{
  return ['embeds' => [dc_carte(['entete' => $quoi, 'titre' => 'Introuvable', 'texte' => 'Cet élément a été supprimé ou n’existe plus.', 'couleur' => DC_GRIS])], 'components' => []];
}
function dc_retour(string $vue, string $libelle = 'Retour'): array
{
  return dc_bouton($libelle, 'v:' . $vue);
}
// Planning d'un mois (un planning par mois : client, site, mission, agents et jours)
function dc_planning_mois(string $mois): ?array
{
  $r = dc_un('SELECT data FROM plannings WHERE mois = ?', [$mois]);
  $p = $r ? json_decode((string)$r['data'], true) : null;
  return is_array($p) ? $p : null;
}
// Ce que fait chaque agent un jour donné : [['nom', 'id', 'prevu']], + client/site/mission
function dc_planning_jour(string $jour): array
{
  $p = dc_planning_mois(substr($jour, 0, 7));
  $agents = [];
  foreach ((array)($p['agents'] ?? []) as $a) {
    $v = trim((string)($a['jours'][$jour] ?? ''));
    if ($v !== '') $agents[] = ['nom' => (string)($a['nom'] ?? ''), 'id' => (int)($a['id'] ?? 0), 'prevu' => $v];
  }
  return ['agents' => $agents, 'client' => trim((string)($p['client'] ?? '')), 'site' => trim((string)($p['site'] ?? '')), 'mission' => trim((string)($p['mission'] ?? ''))];
}
function dc_agent_prevu(array $agent, string $jour): string
{
  $p = dc_planning_mois(substr($jour, 0, 7));
  if (!$p) return '';
  $l = ligne_planning($p, $agent);
  return trim((string)($l['jours'][$jour] ?? ''));
}
function dc_minutes_pointees(int $agent, string $du, string $au): int
{
  $total = 0;
  foreach (dc_q("SELECT debut, fin FROM pointages WHERE agent_id = ? AND debut >= ? AND debut <= ?", [$agent, $du . ' 00:00:00', $au . ' 23:59:59']) as $p) {
    $fin = $p['fin'] !== '' ? strtotime($p['fin']) : time();
    $total += max(0, (int)round(($fin - strtotime($p['debut'])) / 60));
  }
  return $total;
}
// Photo de l'agent : celle de sa carte professionnelle (Cartes & flyers), reconnue par n° de carte ou par nom
function dc_photo_agent(array $agent): ?array
{
  $cle = fn(string $s) => implode(' ', (function ($m) { sort($m); return $m; })(array_filter(explode(' ', nom_simple($s)))));
  $nomAgent = $cle((string)$agent['nom']);
  $carte = preg_replace('/\s+/', '', mb_strtoupper((string)($agent['carte'] ?? '')));
  foreach (dc_q("SELECT data FROM creations WHERE type = 'carte' ORDER BY maj DESC") as $c) {
    $d = json_decode((string)$c['data'], true);
    if (!is_array($d) || empty($d['photo']) || !str_starts_with((string)$d['photo'], 'data:image/')) continue;
    $num = preg_replace('/\s+/', '', mb_strtoupper((string)($d['numero'] ?? '')));
    $memeCarte = $carte !== '' && $num !== '' && $num === $carte;
    $memeNom = $nomAgent !== '' && $cle(trim(($d['prenom'] ?? '') . ' ' . ($d['nom'] ?? ''))) === $nomAgent;
    if (!$memeCarte && !$memeNom) continue;
    if (!preg_match('#^data:(image/(jpeg|png|webp));base64,(.+)$#s', (string)$d['photo'], $m)) continue;
    $octets = base64_decode($m[3], true);
    if ($octets === false || strlen($octets) > 7 * 1048576) continue;
    return ['mime' => $m[1], 'ext' => $m[2] === 'jpeg' ? 'jpg' : $m[2], 'octets' => $octets];
  }
  return null;
}

/* ---------- Compteurs (panel, tableau de bord) ---------- */
function dcv_compteurs(): array
{
  $n = fn(string $sql, array $p = []) => (int)dc_n($sql, $p);
  return [
    'demandes' => $n("SELECT COUNT(*) FROM demandes WHERE statut = 'nouvelle'"),
    'messages' => $n("SELECT COUNT(*) FROM messages_clients WHERE auteur = 'client' AND lu = 0"),
    'assistance' => $n("SELECT COUNT(*) FROM assist_conv WHERE statut = 'attente' OR (statut = 'equipe' AND non_lu > 0)"),
    'avis' => $n("SELECT COUNT(*) FROM avis WHERE statut = 'attente'"),
    'vtc' => $n("SELECT COUNT(*) FROM reservations WHERE statut = 'attente'"),
    'candidatures' => $n("SELECT COUNT(*) FROM candidatures WHERE statut = 'nouvelle'"),
    'comptes' => $n("SELECT COUNT(*) FROM comptes_equipe WHERE statut = 'attente'"),
    'absences' => $n("SELECT COUNT(*) FROM absences WHERE statut = 'attente'"),
    'incidents' => $n("SELECT COUNT(*) FROM main_courante WHERE statut = 'nouveau'"),
    'retards' => $n("SELECT COUNT(*) FROM documents WHERE type = 'facture' AND statut = 'envoyee' AND echeance <> '' AND echeance < ?", [date('Y-m-d')]),
    'devis' => $n("SELECT COUNT(*) FROM documents WHERE type = 'devis' AND statut = 'envoye'"),
    'opportunites' => $n("SELECT COUNT(*) FROM opportunites WHERE statut = 'a_traiter'"),
    'service' => $n("SELECT COUNT(*) FROM pointages WHERE fin = ''"),
  ];
}

/* ---------- Panel (message fixe du salon #panel) ---------- */
function dcv_panel(): array
{
  $c = dcv_compteurs();
  $b = fn(string $lib, string $id, int $n = -1) => dc_bouton($n > 0 ? "$lib · $n" : $lib, $id, $n > 0 ? 1 : 2);
  $champ = fn(string $lib, int $n) => dc_champ($lib, $n > 0 ? "**$n**" : '0');
  $carte = dc_carte([
    'entete' => 'Panneau de commande', 'titre' => 'BDA Security Group · Direction', 'quand' => false,
    'texte' => "Tout l’admin depuis Discord. Les réponses aux boutons ne sont visibles que par vous.\nCommandes : tapez **/** dans n’importe quel salon (ex. `/client`, `/agent`, `/planning`, `/recherche`).\nMis à jour " . dc_quand(maintenant(), 'R') . '.',
    'champs' => [
      $champ('Demandes à traiter', $c['demandes']), $champ('Messages clients', $c['messages']), $champ('Assistant du site', $c['assistance']),
      $champ('Devis en attente', $c['devis']), $champ('Factures en retard', $c['retards']), $champ('Réservations VTC', $c['vtc']),
      $champ('Comptes à valider', $c['comptes']), $champ('Absences à traiter', $c['absences']), $champ('Main courante', $c['incidents']),
      $champ('Candidatures', $c['candidatures']), $champ('Avis à valider', $c['avis']), $champ('Agents en service', $c['service']),
    ],
  ]);
  return ['embeds' => [$carte], 'components' => dc_lignes([
    $b('Tableau de bord', 'v:tableau'), $b('Demandes', 'v:demandes:nouvelle', $c['demandes']), $b('Messages', 'v:messages', $c['messages']), $b('Devis', 'v:devis:envoye', $c['devis']), $b('Factures', 'v:factures:impayees', $c['retards']),
    $b('Clients', 'v:clients'), $b('Agents', 'v:agents'), $b('Planning', 'v:planning:' . date('Y-m-d')), $b('Pointage', 'v:pointage', $c['service']), $b('Absences', 'v:absences', $c['absences']),
    $b('Main courante', 'v:incidents', $c['incidents']), $b('Comptes équipe', 'v:comptes', $c['comptes']), $b('Candidatures', 'v:candidatures', $c['candidatures']), $b('Avis', 'v:avis', $c['avis']), $b('VTC', 'v:vtc', $c['vtc']),
    $b('Opportunités', 'v:opportunites:tout', $c['opportunites']), $b('Urgent J-7', 'v:urgent'), $b('Lancer la veille', 'a:veille:0'), $b('Chiffre d’affaires', 'v:ca:' . date('Y')), $b('Assistant site', 'v:assistance', $c['assistance']),
    $b('Rechercher', 'm:recherche:0'), $b('Coffre-fort', 'v:coffre'), $b('Journal', 'v:journal:30'), $b('État du site', 'v:site'), $b('Synchroniser', 'a:sync:0'),
  ])];
}

/* ---------- Tableau de bord ---------- */
function dcv_tableau(): array
{
  $auj = date('Y-m-d');
  $mois = date('Y-m');
  $annee = date('Y');
  $c = dcv_compteurs();
  $somme = fn(string $sql, array $p = []) => dc_un($sql, $p) ?? ['n' => 0, 't' => 0];
  $f = fn(array $r) => (int)$r['n'] . ' · ' . dc_eur((float)$r['t']);

  $activite = dc_carte(['entete' => 'Activité', 'titre' => 'Tableau de bord · ' . date('d/m/Y H:i'), 'url' => DC_ADMIN, 'champs' => [
    dc_champ('Demandes à traiter', (string)$c['demandes']),
    dc_champ('Demandes sur 7 jours', (string)(int)dc_n('SELECT COUNT(*) FROM demandes WHERE recu >= ?', [date('Y-m-d', strtotime('-7 days'))])),
    dc_champ('Messages non lus', (string)$c['messages']),
    dc_champ('Assistant : conseiller demandé', (string)$c['assistance']),
    dc_champ('Avis à valider', (string)$c['avis']),
    dc_champ('Candidatures nouvelles', (string)$c['candidatures']),
    dc_champ('VTC à confirmer', (string)$c['vtc']),
    dc_champ('Courses VTC à venir', (string)(int)dc_n("SELECT COUNT(*) FROM reservations WHERE statut IN ('attente', 'confirmee') AND date_course >= ?", [maintenant()])),
    dc_champ('Espaces clients actifs', (string)(int)dc_n('SELECT COUNT(*) FROM comptes_clients WHERE actif = 1 AND hash <> \'\'')),
  ]]);

  $facMois = $somme("SELECT COUNT(*) n, COALESCE(SUM(total), 0) t FROM documents WHERE type = 'facture' AND statut IN ('envoyee', 'payee') AND substr(date, 1, 7) = ?", [$mois]);
  $payeMois = $somme("SELECT COUNT(*) n, COALESCE(SUM(total), 0) t FROM documents WHERE type = 'facture' AND statut = 'payee' AND substr(date, 1, 7) = ?", [$mois]);
  $facAn = $somme("SELECT COUNT(*) n, COALESCE(SUM(total), 0) t FROM documents WHERE type = 'facture' AND statut IN ('envoyee', 'payee') AND substr(date, 1, 4) = ?", [$annee]);
  $payeAn = $somme("SELECT COUNT(*) n, COALESCE(SUM(total), 0) t FROM documents WHERE type = 'facture' AND statut = 'payee' AND substr(date, 1, 4) = ?", [$annee]);
  $impayes = $somme("SELECT COUNT(*) n, COALESCE(SUM(total), 0) t FROM documents WHERE type = 'facture' AND statut = 'envoyee'");
  $retard = $somme("SELECT COUNT(*) n, COALESCE(SUM(total), 0) t FROM documents WHERE type = 'facture' AND statut = 'envoyee' AND echeance <> '' AND echeance < ?", [$auj]);
  $devis = $somme("SELECT COUNT(*) n, COALESCE(SUM(total), 0) t FROM documents WHERE type = 'devis' AND statut = 'envoye'");
  $devisOk = $somme("SELECT COUNT(*) n, COALESCE(SUM(total), 0) t FROM documents WHERE type = 'devis' AND statut = 'accepte' AND substr(maj, 1, 7) = ?", [$mois]);
  $finances = dc_carte(['entete' => 'Finances', 'couleur' => $retard['n'] > 0 ? DC_ROUGE : DC_OR, 'champs' => [
    dc_champ('Facturé ce mois', $f($facMois)), dc_champ('Encaissé ce mois', $f($payeMois)), dc_champ('Facturé en ' . $annee, $f($facAn)),
    dc_champ('Encaissé en ' . $annee, $f($payeAn)), dc_champ('À encaisser', $f($impayes)), dc_champ('En retard', $f($retard)),
    dc_champ('Devis en attente de réponse', $f($devis)), dc_champ('Devis acceptés ce mois', $f($devisOk)),
  ]]);

  $enService = dc_q("SELECT a.nom, p.debut, p.site FROM pointages p JOIN agents a ON a.id = p.agent_id WHERE p.fin = '' ORDER BY p.debut");
  $jour = dc_planning_jour($auj);
  $prevus = array_filter($jour['agents'], fn($a) => !in_array(strtoupper($a['prevu']), DC_CODES_ABSENCE, true));
  $cartes = dc_q("SELECT nom, validite FROM agents WHERE actif = 1 AND validite <> '' AND validite <= ? ORDER BY validite", [date('Y-m-d', strtotime('+60 days'))]);
  $minutesMois = 0;
  foreach (dc_q("SELECT debut, fin FROM pointages WHERE debut >= ?", [$mois . '-01 00:00:00']) as $p) $minutesMois += max(0, (int)round((($p['fin'] !== '' ? strtotime($p['fin']) : time()) - strtotime($p['debut'])) / 60));
  $equipe = dc_carte(['entete' => 'Équipe', 'champs' => [
    dc_champ('Agents actifs', (string)(int)dc_n('SELECT COUNT(*) FROM agents WHERE actif = 1')),
    dc_champ('En service maintenant', $enService ? implode("\n", array_map(fn($p) => dc_txt($p['nom'], 60) . ' · depuis ' . dc_quand($p['debut'], 't') . ($p['site'] !== '' ? ' · ' . dc_txt($p['site'], 40) : ''), $enService)) : 'Personne', false),
    dc_champ('Prévus aujourd’hui', $prevus ? implode("\n", array_map(fn($a) => dc_txt($a['nom'], 60) . ' · ' . dc_txt($a['prevu'], 30), array_slice($prevus, 0, 15))) : 'Aucun planning', false),
    dc_champ('Heures pointées ce mois', dc_duree($minutesMois)),
    dc_champ('Absences à traiter', (string)$c['absences']), dc_champ('Main courante non lue', (string)$c['incidents']), dc_champ('Comptes à valider', (string)$c['comptes']),
    dc_champ('Cartes pro à renouveler (60 j)', $cartes ? implode("\n", array_map(fn($a) => dc_txt($a['nom'], 60) . ' · ' . dc_jour($a['validite']) . ' (' . dc_jx($a['validite']) . ')', $cartes)) : 'Aucune', false),
  ]]);

  $etat = json_decode((string)(dc_un("SELECT v FROM reglages WHERE k = 'veille_etat'")['v'] ?? ''), true) ?: [];
  $sources = [];
  foreach (['boamp' => 'BOAMP', 'francetravail' => 'France Travail'] as $k => $lib) {
    $s = $etat['sources'][$k] ?? null;
    $sources[] = $lib . ' : ' . (!$s ? 'jamais lancée' : ($s['ok'] ? 'OK · ' . (int)$s['nouveaux'] . ' nouveau(x)' : 'ERREUR'));
  }
  $veille = dc_carte(['entete' => 'Veille commerciale', 'champs' => [
    dc_champ('Opportunités à traiter', (string)$c['opportunites']),
    dc_champ('Très pertinentes', (string)(int)dc_n("SELECT COUNT(*) FROM opportunites WHERE statut = 'a_traiter' AND niveau = 'fort'")),
    dc_champ('Appels d’offres sous 7 jours', (string)(int)dc_n("SELECT COUNT(*) FROM opportunites WHERE source = 'boamp' AND statut <> 'ignore' AND date_limite <> '' AND date_limite >= ? AND date_limite <= ?", [maintenant(), date('Y-m-d 23:59:59', strtotime('+7 days'))])),
    dc_champ('Prospects (entreprises qui recrutent)', (string)(int)dc_n("SELECT COUNT(*) FROM opportunites WHERE source = 'francetravail' AND statut = 'a_traiter'")),
    dc_champ('Contactés', (string)(int)dc_n("SELECT COUNT(*) FROM opportunites WHERE statut = 'contacte'")),
    dc_champ('Dernière collecte', !empty($etat['derniere']['quand']) ? dc_quand((string)$etat['derniere']['quand'], 'R') : 'jamais'),
    dc_champ('Sources', implode("\n", $sources), false),
  ]]);

  $s = site_reglages();
  $hl = site_hors_ligne();
  $site = dc_carte(['entete' => 'Site internet', 'couleur' => $hl ? DC_ROUGE : DC_VERT, 'champs' => [
    dc_champ('État', $hl ? '**EN MAINTENANCE** depuis ' . dc_quand((string)($hl['depuis'] ?? ''), 'R') : 'En ligne'),
    dc_champ('Bandeau d’annonce', !empty($s['bandeau']['actif']) ? dc_txt($s['bandeau']['texte'], 200) : 'Masqué'),
    dc_champ('Formulaires', 'Devis ' . ($s['devis'] ? 'ouvert' : 'fermé') . ' · Recrutement ' . ($s['recrutement'] ? 'ouvert' : 'fermé') . ' · Avis ' . ($s['avis'] ? 'ouvert' : 'fermé') . ' · VTC ' . (!empty(tarifs_vtc()['ouvert']) ? 'ouvert' : 'fermé'), false),
    dc_champ('Appareils notifiés', (string)(int)dc_n('SELECT COUNT(*) FROM push_abonnements')),
    dc_champ('Connexions admin (24 h)', (string)(int)dc_n('SELECT COUNT(*) FROM connexions WHERE debut >= ?', [date('Y-m-d H:i:s', time() - 86400)])),
    dc_champ('Alertes de sécurité (7 j)', (string)(int)dc_n("SELECT COUNT(*) FROM journal WHERE type = 'alerte' AND quand >= ?", [date('Y-m-d H:i:s', time() - 7 * 86400)])),
  ]]);
  return ['embeds' => [$activite, $finances, $equipe, $veille, $site], 'components' => dc_lignes([dc_bouton('Actualiser', 'v:tableau'), dc_lien('Ouvrir l’admin', DC_ADMIN)])];
}

/* ---------- Demandes de devis / rappel ---------- */
function dcv_demandes(string $statut = 'nouvelle'): array
{
  $tous = $statut === 'toutes';
  $rows = $tous ? dc_q('SELECT * FROM demandes ORDER BY id DESC LIMIT 25') : dc_q('SELECT * FROM demandes WHERE statut = ? ORDER BY id DESC LIMIT 25', [$statut]);
  $total = (int)($tous ? dc_n('SELECT COUNT(*) FROM demandes') : dc_n('SELECT COUNT(*) FROM demandes WHERE statut = ?', [$statut]));
  $lignes = [];
  $options = [];
  foreach ($rows as $d) {
    $data = json_decode((string)$d['data'], true) ?: [];
    $nom = dc_form($data, ['Nom / Société', 'Nom', 'Société', 'Entreprise', 'Nom et prénom']);
    $prest = dc_form($data, ['Prestation', 'Service', 'Besoin']);
    $tel = dc_form($data, ['Téléphone', 'Tel', 'Portable']);
    $lignes[] = "**#{$d['id']}** · " . dc_quand((string)$d['recu'], 'd') . ' · ' . dc_txt($nom ?: 'Sans nom', 60) . ($prest ? ' · ' . dc_txt($prest, 50) : '') . ($tel ? ' · ' . dc_txt($tel, 20) : '') . ' · ' . dc_statut((string)$d['statut']);
    $options[] = dc_option("#{$d['id']} · " . ($nom ?: 'Sans nom'), (string)$d['id'], trim(($prest ?: 'Demande') . ' · ' . date('d/m H:i', strtotime((string)$d['recu']))));
  }
  $titre = ['nouvelle' => 'Nouvelles demandes', 'traitee' => 'Demandes traitées', 'archivee' => 'Demandes archivées'][$statut] ?? 'Toutes les demandes';
  return ['embeds' => [dc_carte(['entete' => 'Demandes reçues', 'titre' => "$titre · $total", 'url' => DC_ADMIN . 'demandes', 'texte' => $lignes ? implode("\n", $lignes) : 'Aucune demande.'])],
    'components' => dc_composants($options ? [dc_liste('s:demande', 'Ouvrir une demande…', $options)] : [], dc_lignes([
      dc_bouton('Nouvelles', 'v:demandes:nouvelle', $statut === 'nouvelle' ? 1 : 2), dc_bouton('Traitées', 'v:demandes:traitee', $statut === 'traitee' ? 1 : 2), dc_bouton('Toutes', 'v:demandes:toutes', $tous ? 1 : 2), dc_lien('Admin', DC_ADMIN . 'demandes')]))];
}
function dcv_demande(int $id, string $entete = 'Demande'): array
{
  $d = dc_un('SELECT * FROM demandes WHERE id = ?', [$id]);
  if (!$d) return dcv_introuvable('Demande');
  $data = json_decode((string)$d['data'], true) ?: [];
  $nom = dc_form($data, ['Nom / Société', 'Nom', 'Société', 'Entreprise', 'Nom et prénom']);
  $rappel = dc_form($data, ['Prestation']) === 'Demande de rappel';
  $champs = [];
  $longs = [];
  foreach ($data as $k => $v) {
    $v = trim((string)$v);
    if ($v === '') continue;
    if (mb_strlen($v) > 60 || str_contains($v, "\n")) $longs[] = '**' . dc_txt((string)$k, 60) . "**\n" . dc_txt($v, 1500);
    else $champs[] = dc_champ((string)$k, dc_txt($v, 200));
  }
  $couleur = ['nouvelle' => DC_OR, 'traitee' => DC_VERT, 'archivee' => DC_GRIS][$d['statut']] ?? DC_OR;
  $boutons = [];
  if ($d['statut'] !== 'traitee') $boutons[] = dc_bouton('Marquer traitée', "a:dem:t:$id", 3);
  if ($d['statut'] !== 'archivee') $boutons[] = dc_bouton('Archiver', "a:dem:a:$id");
  if ($d['statut'] !== 'nouvelle') $boutons[] = dc_bouton('Remettre à traiter', "a:dem:n:$id");
  $boutons[] = dc_lien('Ouvrir dans l’admin', DC_ADMIN . 'demandes/' . $id);
  return ['embeds' => [dc_carte([
    'entete' => ($rappel ? 'Demande de rappel' : $entete) . " · #$id", 'titre' => $nom ?: 'Demande sans nom', 'url' => DC_ADMIN . 'demandes/' . $id, 'couleur' => $couleur,
    'texte' => 'Reçue ' . dc_quand((string)$d['recu']) . ' (' . dc_quand((string)$d['recu'], 'R') . ') · statut **' . dc_statut((string)$d['statut']) . '**' . ($longs ? "\n\n" . implode("\n\n", $longs) : ''),
    'champs' => $champs, 'quand' => strtotime((string)$d['recu']) ?: time(),
  ])], 'components' => dc_lignes($boutons)];
}

/* ---------- Messages des clients ---------- */
function dcv_messages(): array
{
  $convs = dc_q("SELECT c.id, c.nom, m.texte, m.auteur, m.cree, (SELECT COUNT(*) FROM messages_clients x WHERE x.client_id = c.id AND x.auteur = 'client' AND x.lu = 0) AS non_lus
    FROM clients c JOIN messages_clients m ON m.id = (SELECT MAX(id) FROM messages_clients WHERE client_id = c.id) ORDER BY non_lus DESC, m.id DESC LIMIT 25");
  $lignes = [];
  $options = [];
  foreach ($convs as $c) {
    $lignes[] = ((int)$c['non_lus'] > 0 ? '**' . (int)$c['non_lus'] . ' non lu(s)** · ' : '') . '**' . dc_txt($c['nom'], 60) . '** · ' . dc_quand((string)$c['cree'], 'R') . "\n> " . ($c['auteur'] === 'admin' ? 'Vous : ' : '') . dc_txt(str_replace("\n", ' ', (string)$c['texte']), 140);
    $options[] = dc_option($c['nom'], (string)$c['id'], ((int)$c['non_lus'] > 0 ? $c['non_lus'] . ' non lu(s) · ' : '') . mb_substr(str_replace("\n", ' ', (string)$c['texte']), 0, 80));
  }
  return ['embeds' => [dc_carte(['entete' => 'Messagerie clients', 'titre' => 'Conversations', 'url' => DC_ADMIN . 'messages', 'texte' => $lignes ? implode("\n\n", $lignes) : 'Aucun message.'])],
    'components' => dc_composants($options ? [dc_liste('s:conversation', 'Ouvrir une conversation…', $options)] : [], dc_lignes([dc_lien('Admin', DC_ADMIN . 'messages')]))];
}
function dcv_conversation(int $client, string $entete = 'Messagerie client'): array
{
  $c = dc_un('SELECT c.*, cc.email AS compte_email, cc.actif, cc.derniere FROM clients c LEFT JOIN comptes_clients cc ON cc.client_id = c.id WHERE c.id = ?', [$client]);
  if (!$c) return dcv_introuvable('Client');
  $msgs = array_reverse(dc_q('SELECT auteur, texte, cree, lu FROM messages_clients WHERE client_id = ? ORDER BY id DESC LIMIT 10', [$client]));
  $nonLus = (int)dc_n("SELECT COUNT(*) FROM messages_clients WHERE client_id = ? AND auteur = 'client' AND lu = 0", [$client]);
  $fil = array_map(fn($m) => '**' . ($m['auteur'] === 'admin' ? 'BDA Security Group' : dc_txt($c['nom'], 50)) . '** · ' . dc_quand((string)$m['cree']) . "\n" . dc_txt((string)$m['texte'], 700), $msgs);
  return ['embeds' => [dc_carte([
    'entete' => $entete, 'titre' => $c['nom'], 'url' => DC_ADMIN . 'messages',
    'texte' => $fil ? implode("\n\n", $fil) : 'Aucun message.',
    'champs' => [dc_champ('Téléphone', dc_txt($c['tel'], 40)), dc_champ('Email', dc_txt($c['compte_email'] ?: $c['email'], 120)), dc_champ('Dernière connexion', $c['derniere'] ? dc_quand((string)$c['derniere'], 'R') : 'jamais'), dc_champ('Non lus', (string)$nonLus)],
  ])], 'components' => dc_lignes([
    dc_bouton('Répondre', "m:msg:$client", 1), $nonLus ? dc_bouton('Marquer comme lus', "a:msg:l:$client") : null, dc_bouton('Dossier client', "v:client:$client"), dc_lien('Admin', DC_ADMIN . 'messages')])];
}

/* ---------- Clients ---------- */
function dcv_clients(string $q = ''): array
{
  $q = trim($q);
  $rows = $q === '' ? dc_q('SELECT * FROM clients ORDER BY nom COLLATE NOCASE LIMIT 25')
    : dc_q('SELECT * FROM clients WHERE nom LIKE ? OR tel LIKE ? OR email LIKE ? ORDER BY nom COLLATE NOCASE LIMIT 25', array_fill(0, 3, '%' . $q . '%'));
  $total = (int)dc_n('SELECT COUNT(*) FROM clients');
  $lignes = array_map(fn($c) => '**' . dc_txt($c['nom'], 60) . '**' . ($c['tel'] ? ' · ' . dc_txt($c['tel'], 20) : '') . ($c['email'] ? ' · ' . dc_txt($c['email'], 60) : ''), $rows);
  $options = array_map(fn($c) => dc_option($c['nom'], (string)$c['id'], trim($c['tel'] . ' ' . $c['email'])), $rows);
  return ['embeds' => [dc_carte(['entete' => 'Clients', 'titre' => ($q !== '' ? "Recherche « $q » · " : '') . "$total client(s)", 'url' => DC_ADMIN . 'clients', 'texte' => $lignes ? implode("\n", $lignes) : 'Aucun client.'])],
    'components' => dc_composants($options ? [dc_liste('s:client', 'Ouvrir un dossier client…', $options)] : [], dc_lignes([dc_lien('Admin', DC_ADMIN . 'clients')]))];
}
function dcv_client(int $id, bool $dossier = false): array
{
  $c = dc_un('SELECT * FROM clients WHERE id = ?', [$id]);
  if (!$c) return dcv_introuvable('Client');
  $cle = mb_strtolower(trim((string)$c['nom']));
  $docs = dc_q('SELECT id, type, numero, statut, total, date, echeance, partage, vu_client FROM documents WHERE lower(trim(client)) = ? ORDER BY date DESC, id DESC', [$cle]);
  $compte = dc_un('SELECT email, actif, derniere, cree, hash, invitation FROM comptes_clients WHERE client_id = ?', [$id]);
  $nbMsg = (int)dc_n('SELECT COUNT(*) FROM messages_clients WHERE client_id = ?', [$id]);
  $nonLus = (int)dc_n("SELECT COUNT(*) FROM messages_clients WHERE client_id = ? AND auteur = 'client' AND lu = 0", [$id]);
  $dernier = dc_un('SELECT auteur, texte, cree FROM messages_clients WHERE client_id = ? ORDER BY id DESC LIMIT 1', [$id]);
  $envois = dc_q('SELECT titre, periode, cree, vu FROM envois_clients WHERE client_id = ? ORDER BY id DESC LIMIT 6', [$id]);
  $plannings = [];
  foreach (dc_q('SELECT mois, data FROM plannings ORDER BY mois DESC LIMIT 36') as $p) {
    $d = json_decode((string)$p['data'], true);
    if (is_array($d) && mb_strtolower(trim((string)($d['client'] ?? ''))) === $cle) $plannings[] = date('m/Y', strtotime($p['mois'] . '-01'));
  }
  $st = ['devis' => [], 'facture' => []];
  foreach ($docs as $d) $st[$d['type']][] = $d;
  $somme = fn(array $l, array $statuts) => array_sum(array_map(fn($d) => in_array($d['statut'], $statuts, true) ? (float)$d['total'] : 0.0, $l));
  $compte1 = fn(array $l, string $s) => count(array_filter($l, fn($d) => $d['statut'] === $s));
  $retard = array_filter($st['facture'], fn($d) => $d['statut'] === 'envoyee' && $d['echeance'] !== '' && $d['echeance'] < date('Y-m-d'));
  $lignesDocs = array_map(fn($d) => '`' . dc_txt($d['numero'], 30) . '` · ' . dc_jour((string)$d['date']) . ' · ' . dc_eur((float)$d['total']) . ' · ' . dc_statut((string)$d['statut'])
    . ($d['type'] === 'facture' && $d['statut'] === 'envoyee' && $d['echeance'] !== '' ? ' · échéance ' . dc_jour((string)$d['echeance']) . ' (' . dc_jx((string)$d['echeance']) . ')' : '') . ($d['vu_client'] !== '' ? ' · vu par le client' : ''), array_slice($docs, 0, 12));

  $fiche = dc_carte(['entete' => 'Dossier client', 'titre' => $c['nom'], 'url' => DC_ADMIN . 'clients', 'quand' => false, 'champs' => [
    dc_champ('Téléphone', dc_txt($c['tel'], 40)), dc_champ('Email', dc_txt($c['email'], 120)), dc_champ('Client depuis', dc_jour((string)$c['cree'])),
    dc_champ('Adresse', dc_txt($c['adresse'], 400), false),
    $c['notes'] !== '' ? dc_champ('Notes', dc_txt($c['notes'], 1000), false) : null,
  ]]);
  $commerce = dc_carte(['entete' => 'Activité commerciale', 'couleur' => $retard ? DC_ROUGE : DC_OR, 'quand' => false,
    'texte' => $lignesDocs ? implode("\n", $lignesDocs) : 'Aucun devis ni facture.',
    'champs' => [
      dc_champ('Devis', count($st['devis']) . ' · ' . $compte1($st['devis'], 'envoye') . ' en attente · ' . $compte1($st['devis'], 'accepte') . ' acceptés · ' . $compte1($st['devis'], 'refuse') . ' refusés'),
      dc_champ('Devis acceptés', dc_eur($somme($st['devis'], ['accepte']))),
      dc_champ('Factures', (string)count($st['facture'])),
      dc_champ('Facturé', dc_eur($somme($st['facture'], ['envoyee', 'payee']))),
      dc_champ('Encaissé', dc_eur($somme($st['facture'], ['payee']))),
      dc_champ('Reste à payer', dc_eur($somme($st['facture'], ['envoyee'])) . ($retard ? ' · **' . count($retard) . ' en retard**' : '')),
    ]]);
  $echanges = dc_carte(['entete' => 'Espace client et échanges', 'quand' => false, 'champs' => [
    dc_champ('Espace client', !$compte ? 'Non créé' : (!(int)$compte['actif'] ? 'Désactivé' : ($compte['hash'] === '' ? 'Invitation envoyée, pas encore activé' : 'Actif'))),
    dc_champ('Email de connexion', $compte ? dc_txt($compte['email'], 120) : '—'),
    dc_champ('Dernière connexion', $compte && $compte['derniere'] !== '' ? dc_quand((string)$compte['derniere'], 'R') : 'jamais'),
    dc_champ('Messages', "$nbMsg échangés · $nonLus non lu(s)"),
    dc_champ('Dernier message', $dernier ? ($dernier['auteur'] === 'admin' ? 'Vous' : 'Client') . ' · ' . dc_quand((string)$dernier['cree'], 'R') . "\n" . dc_txt((string)$dernier['texte'], 300) : '—', false),
    dc_champ('PDF déposés dans son espace', $envois ? implode("\n", array_map(fn($e) => dc_txt($e['titre'], 80) . ' · ' . dc_jour((string)$e['cree']) . ($e['vu'] !== '' ? ' · téléchargé' : ''), $envois)) : 'Aucun', false),
    dc_champ('Plannings à son nom', $plannings ? implode(', ', array_slice($plannings, 0, 18)) : 'Aucun', false),
  ]]);
  $echanges['footer'] = ['text' => 'BDA Security Group · mis à jour ' . date('d/m/Y H:i')];
  return ['embeds' => [$fiche, $commerce, $echanges], 'components' => dc_lignes([
    dc_bouton('Actualiser', "a:dossier:client:$id"), $nbMsg || $compte ? dc_bouton('Messages', "v:conversation:$id") : null, dc_lien('Ouvrir dans l’admin', DC_ADMIN . 'clients')])];
}

/* ---------- Devis et factures ---------- */
function dcv_documents(string $type, string $filtre): array
{
  $auj = date('Y-m-d');
  [$where, $p, $titre] = match ($type . ':' . $filtre) {
    'facture:impayees' => ["type = 'facture' AND statut = 'envoyee'", [], 'Factures à encaisser'],
    'facture:retard' => ["type = 'facture' AND statut = 'envoyee' AND echeance <> '' AND echeance < ?", [$auj], 'Factures en retard'],
    'facture:payees' => ["type = 'facture' AND statut = 'payee'", [], 'Factures payées'],
    'facture:brouillon' => ["type = 'facture' AND statut = 'brouillon'", [], 'Factures en brouillon'],
    'devis:envoye' => ["type = 'devis' AND statut = 'envoye'", [], 'Devis en attente de réponse'],
    'devis:accepte' => ["type = 'devis' AND statut = 'accepte'", [], 'Devis acceptés'],
    'devis:refuse' => ["type = 'devis' AND statut = 'refuse'", [], 'Devis refusés'],
    'devis:brouillon' => ["type = 'devis' AND statut = 'brouillon'", [], 'Devis en brouillon'],
    default => ['type = ?', [$type], $type === 'facture' ? 'Toutes les factures' : 'Tous les devis'],
  };
  $rows = dc_q("SELECT id, type, numero, statut, client, total, date, echeance FROM documents WHERE $where ORDER BY date DESC, id DESC LIMIT 25", $p);
  $tot = dc_un("SELECT COUNT(*) n, COALESCE(SUM(total), 0) t FROM documents WHERE $where", $p) ?? ['n' => 0, 't' => 0];
  $lignes = array_map(fn($d) => '`' . dc_txt($d['numero'], 30) . '` · ' . dc_txt($d['client'] ?: '—', 50) . ' · ' . dc_jour((string)$d['date']) . ' · **' . dc_eur((float)$d['total']) . '** · ' . dc_statut((string)$d['statut'])
    . ($d['type'] === 'facture' && $d['statut'] === 'envoyee' && $d['echeance'] !== '' ? ' · échéance ' . dc_jx((string)$d['echeance']) : ''), $rows);
  $options = array_map(fn($d) => dc_option($d['numero'] . ' · ' . ($d['client'] ?: '—'), (string)$d['id'], dc_eur((float)$d['total']) . ' · ' . dc_statut((string)$d['statut'])), $rows);
  $filtres = $type === 'facture'
    ? [['impayees', 'À encaisser'], ['retard', 'En retard'], ['payees', 'Payées'], ['toutes', 'Toutes']]
    : [['envoye', 'En attente'], ['accepte', 'Acceptés'], ['refuse', 'Refusés'], ['tous', 'Tous']];
  $route = $type === 'facture' ? 'factures' : 'devis';
  return ['embeds' => [dc_carte(['entete' => $type === 'facture' ? 'Factures' : 'Devis', 'titre' => $titre . ' · ' . (int)$tot['n'] . ' · ' . dc_eur((float)$tot['t']), 'url' => DC_ADMIN . $route, 'texte' => $lignes ? implode("\n", $lignes) : 'Aucun document.'])],
    'components' => dc_composants($options ? [dc_liste('s:document', 'Ouvrir un document…', $options)] : [], dc_lignes(array_merge(array_map(fn($f) => dc_bouton($f[1], "v:$route:{$f[0]}", $f[0] === $filtre ? 1 : 2), $filtres), [dc_lien('Admin', DC_ADMIN . $route)])))];
}
function dcv_document(int $id, string $entete = ''): array
{
  $d = dc_un('SELECT * FROM documents WHERE id = ?', [$id]);
  if (!$d) return dcv_introuvable('Document');
  $data = json_decode((string)$d['data'], true) ?: [];
  $facture = $d['type'] === 'facture';
  $lignes = [];
  foreach (array_slice((array)($data['lignes'] ?? []), 0, 20) as $l) {
    if (!is_array($l)) continue;
    $q = (float)($l['qte'] ?? 0);
    $pu = (float)($l['pu'] ?? 0);
    $qte = ($l['unite'] ?? '') === 'h' ? dc_duree((int)round($q * 60)) : rtrim(rtrim(number_format($q, 2, ',', ' '), '0'), ',');
    $lignes[] = '• ' . dc_txt(trim(($l['designation'] ?? '') . (!empty($l['detail']) ? ' — ' . $l['detail'] : '')), 140) . " · $qte × " . dc_eur($pu) . ' = **' . dc_eur(round($q * $pu, 2)) . '**';
  }
  $retard = $facture && $d['statut'] === 'envoyee' && $d['echeance'] !== '' && $d['echeance'] < date('Y-m-d');
  $couleur = $retard ? DC_ROUGE : (['accepte' => DC_VERT, 'payee' => DC_VERT, 'refuse' => DC_GRIS, 'annulee' => DC_GRIS][$d['statut']] ?? DC_OR);
  $boutons = [];
  if (!$facture && $d['statut'] === 'envoye') { $boutons[] = dc_bouton('Accepté', "a:dev:a:$id", 3); $boutons[] = dc_bouton('Refusé', "a:dev:r:$id", 4); }
  if ($facture && $d['statut'] === 'envoyee') $boutons[] = dc_bouton('Marquer payée', "a:fac:p:$id", 3);
  if ($d['piece'] !== '') $boutons[] = dc_bouton('PDF joint', "a:piece:$id");
  $boutons[] = dc_lien('Ouvrir dans l’admin', DC_ADMIN . ($facture ? 'factures/' : 'devis/') . $id);
  return ['embeds' => [dc_carte([
    'entete' => ($entete !== '' ? $entete . ' · ' : '') . ($facture ? 'Facture' : 'Devis'), 'titre' => $d['numero'] . ' · ' . ($d['client'] ?: 'sans client'), 'url' => DC_ADMIN . ($facture ? 'factures/' : 'devis/') . $id, 'couleur' => $couleur,
    'texte' => (!empty($data['objet']) ? '**' . dc_txt((string)$data['objet'], 200) . "**\n" : '') . ($lignes ? implode("\n", $lignes) : 'Aucune ligne.'),
    'champs' => [
      dc_champ('Montant', '**' . dc_eur((float)$d['total']) . '**'), dc_champ('Statut', dc_statut((string)$d['statut']) . ($retard ? ' · **EN RETARD**' : '')), dc_champ('Date', dc_jour((string)$d['date'])),
      $facture ? dc_champ('Échéance', $d['echeance'] !== '' ? dc_jour((string)$d['echeance']) . ' (' . dc_jx((string)$d['echeance']) . ')' : '—') : dc_champ('Validité', dc_txt((string)($data['validite'] ?? ''), 40)),
      dc_champ('Espace client', $d['partage'] !== '' ? 'Déposé ' . dc_quand((string)$d['partage'], 'R') . ($d['vu_client'] !== '' ? ' · ouvert ' . dc_quand((string)$d['vu_client'], 'R') : ' · pas encore ouvert') : 'Non déposé'),
      dc_champ('Dernière modification', dc_quand((string)$d['maj'], 'R')),
    ],
  ])], 'components' => dc_lignes($boutons)];
}
function dcv_ca(int $annee): array
{
  $mois = [];
  foreach (dc_q("SELECT substr(date, 1, 7) m, statut, COUNT(*) n, SUM(total) t FROM documents WHERE type = 'facture' AND statut IN ('envoyee', 'payee') AND substr(date, 1, 4) = ? GROUP BY m, statut", [(string)$annee]) as $r) {
    $mois[$r['m']]['facture'] = ($mois[$r['m']]['facture'] ?? 0) + (float)$r['t'];
    $mois[$r['m']]['n'] = ($mois[$r['m']]['n'] ?? 0) + (int)$r['n'];
    if ($r['statut'] === 'payee') $mois[$r['m']]['paye'] = ($mois[$r['m']]['paye'] ?? 0) + (float)$r['t'];
  }
  $noms = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  $lignes = [];
  $tf = 0.0;
  $tp = 0.0;
  for ($i = 1; $i <= 12; $i++) {
    $k = sprintf('%04d-%02d', $annee, $i);
    $f = (float)($mois[$k]['facture'] ?? 0);
    $p = (float)($mois[$k]['paye'] ?? 0);
    $tf += $f;
    $tp += $p;
    if ($f > 0 || $k <= date('Y-m')) $lignes[] = str_pad($noms[$i - 1], 6) . str_pad(number_format($f, 0, ',', ' ') . ' €', 14, ' ', STR_PAD_LEFT) . str_pad(number_format($p, 0, ',', ' ') . ' €', 14, ' ', STR_PAD_LEFT) . str_pad((string)($mois[$k]['n'] ?? 0), 5, ' ', STR_PAD_LEFT);
  }
  $top = dc_q("SELECT client, COUNT(*) n, SUM(total) t FROM documents WHERE type = 'facture' AND statut IN ('envoyee', 'payee') AND substr(date, 1, 4) = ? GROUP BY lower(trim(client)) ORDER BY t DESC LIMIT 8", [(string)$annee]);
  $tableau = "```\nMois        Facturé      Encaissé  Nb\n" . implode("\n", $lignes) . "\n" . str_repeat('-', 39) . "\nTotal " . str_pad(number_format($tf, 0, ',', ' ') . ' €', 14, ' ', STR_PAD_LEFT) . str_pad(number_format($tp, 0, ',', ' ') . ' €', 14, ' ', STR_PAD_LEFT) . "\n```";
  return ['embeds' => [dc_carte(['entete' => 'Chiffre d’affaires', 'titre' => "Année $annee", 'url' => DC_ADMIN . 'factures', 'texte' => $tableau, 'champs' => [
    dc_champ('Facturé', dc_eur($tf)), dc_champ('Encaissé', dc_eur($tp)), dc_champ('Reste à encaisser', dc_eur($tf - $tp)),
    dc_champ('Meilleurs clients', $top ? implode("\n", array_map(fn($c) => dc_txt($c['client'] ?: '—', 60) . ' · ' . dc_eur((float)$c['t']) . ' (' . (int)$c['n'] . ' fact.)', $top)) : '—', false),
  ]])], 'components' => dc_lignes([dc_bouton('Année ' . ($annee - 1), 'v:ca:' . ($annee - 1)), $annee < (int)date('Y') ? dc_bouton('Année ' . ($annee + 1), 'v:ca:' . ($annee + 1)) : null, dc_lien('Factures', DC_ADMIN . 'factures')])];
}

/* ---------- Agents ---------- */
function dcv_agents(): array
{
  $rows = dc_q('SELECT * FROM agents ORDER BY actif DESC, nom COLLATE NOCASE LIMIT 60');
  $docs = [];
  foreach (dc_q('SELECT agent_id, type FROM agent_docs') as $d) $docs[(int)$d['agent_id']][$d['type']] = true;
  $comptes = [];
  foreach (dc_q('SELECT agent_id, statut FROM comptes_equipe') as $c) $comptes[(int)$c['agent_id']] = $c['statut'];
  $lignes = [];
  foreach ($rows as $a) {
    $manque = array_values(array_filter(DC_DOCS_OBLIGATOIRES, fn($t) => empty($docs[(int)$a['id']][$t])));
    $val = (string)$a['validite'];
    $alerte = $val !== '' && $val <= date('Y-m-d', strtotime('+60 days'));
    $lignes[] = ((int)$a['actif'] ? '' : '~~') . '**' . dc_txt($a['nom'], 60) . '**' . ((int)$a['actif'] ? '' : '~~') . ' · ' . dc_txt($a['poste'], 30)
      . ($a['tel'] ? ' · ' . dc_txt($a['tel'], 20) : '')
      . ($val !== '' ? ' · carte ' . dc_jour($val) . ($alerte ? ' **(' . dc_jx($val) . ')**' : '') : ' · carte ?')
      . ($manque ? ' · ' . count($manque) . ' doc. manquant(s)' : '')
      . (isset($comptes[(int)$a['id']]) ? ' · espace ' . mb_strtolower(dc_statut($comptes[(int)$a['id']])) : '');
  }
  $options = array_map(fn($a) => dc_option($a['nom'], (string)$a['id'], $a['poste'] . ((int)$a['actif'] ? '' : ' · inactif')), array_slice($rows, 0, 25));
  return ['embeds' => [dc_carte(['entete' => 'Agents', 'titre' => count($rows) . ' agent(s) · ' . (int)dc_n('SELECT COUNT(*) FROM agents WHERE actif = 1') . ' actif(s)', 'url' => DC_ADMIN . 'agents', 'texte' => $lignes ? implode("\n", $lignes) : 'Aucun agent.'])],
    'components' => dc_composants($options ? [dc_liste('s:agent', 'Ouvrir un dossier agent…', $options)] : [], dc_lignes([dc_bouton('Pointage', 'v:pointage'), dc_bouton('Planning du jour', 'v:planning:' . date('Y-m-d')), dc_lien('Admin', DC_ADMIN . 'agents')]))];
}
function dcv_agent(int $id): array
{
  $a = dc_un('SELECT * FROM agents WHERE id = ?', [$id]);
  if (!$a) return dcv_introuvable('Agent');
  $profil = json_decode((string)($a['profil'] ?? '{}'), true) ?: [];
  $docs = dc_q('SELECT id, type, nom, ajoute, visible, source, taille FROM agent_docs WHERE agent_id = ? ORDER BY type, ajoute DESC', [$id]);
  $compte = dc_un('SELECT * FROM comptes_equipe WHERE agent_id = ? ORDER BY id DESC LIMIT 1', [$id]);
  $appareils = $compte ? (int)dc_n('SELECT COUNT(*) FROM equipe_appareils WHERE compte_id = ?', [(int)$compte['id']]) : 0;
  $auj = date('Y-m-d');
  $val = (string)$a['validite'];
  $carteAlerte = $val !== '' && $val <= date('Y-m-d', strtotime('+60 days'));
  // Disponibilités déclarées dans l'Espace équipe
  $dispos = [];
  foreach ((array)($profil['dispos'] ?? []) as $j => $v) if ($v) $dispos[] = $j . ' ' . implode('/', array_map(fn($x) => $x === 'jour' ? 'J' : 'N', (array)$v));

  $fiche = dc_carte(['entete' => 'Dossier agent', 'titre' => $a['nom'], 'url' => DC_ADMIN . 'agents', 'quand' => false, 'couleur' => (int)$a['actif'] ? ($carteAlerte ? DC_ORANGE : DC_OR) : DC_GRIS, 'champs' => [
    dc_champ('Poste', dc_txt($a['poste'], 60)), dc_champ('Équipe', ($a['categorie'] ?? 'primaire') === 'secondaire' ? 'Renfort' : 'Équipe principale'), dc_champ('Statut', (int)$a['actif'] ? 'Actif' : 'Inactif'),
    dc_champ('Téléphone', dc_txt($a['tel'] ?: ($compte['tel'] ?? ''), 40)), dc_champ('Email', dc_txt($compte['email'] ?? '', 120)), dc_champ('Lien de pointage', $a['pointage'] !== '' ? 'Oui' : 'Non'),
    dc_champ('Carte professionnelle', dc_txt($a['carte'] ?: 'non renseignée', 60)), dc_champ('Validité', $val !== '' ? dc_jour($val) . ' (' . dc_jx($val) . ')' . ($carteAlerte ? ' **À RENOUVELER**' : '') : '—'), dc_champ('Fiche créée', dc_jour((string)$a['cree'])),
    dc_champ('Zone', dc_txt($profil['zone'] ?? '', 120)), dc_champ('Ville', dc_txt($profil['ville'] ?? '', 80)), dc_champ('Permis / véhicule', (!empty($profil['permis']) ? 'Permis' : 'Sans permis') . ' · ' . (!empty($profil['vehicule']) ? 'véhiculé' : 'sans véhicule')),
    dc_champ('Disponibilités', $dispos ? implode(' · ', $dispos) : '—', false),
    dc_champ('Compétences', !empty($profil['competences']) ? dc_txt(implode(', ', (array)$profil['competences']), 500) : '—', false),
    dc_champ('Contact d’urgence', !empty($profil['urgenceNom']) ? dc_txt($profil['urgenceNom'], 80) . ' · ' . dc_txt($profil['urgenceTel'] ?? '', 30) : 'Non renseigné'),
    $a['notes'] !== '' ? dc_champ('Notes', dc_txt($a['notes'], 1000), false) : null,
  ]]);

  $parType = [];
  foreach ($docs as $d) $parType[$d['type']][] = $d;
  $lignesDocs = [];
  foreach (DC_DOCS as $t => $lib) {
    if (!empty($parType[$t])) {
      foreach ($parType[$t] as $d) $lignesDocs[] = '✓ **' . $lib . '** · ' . dc_txt($d['nom'], 60) . ' · ' . dc_jour((string)$d['ajoute']) . ($d['source'] === 'agent' ? ' · déposé par l’agent' : '') . ((int)$d['visible'] ? ' · visible par l’agent' : '');
    } elseif (in_array($t, DC_DOCS_OBLIGATOIRES, true)) {
      $lignesDocs[] = '✗ **' . $lib . '** · MANQUANT';
    }
  }
  $documents = dc_carte(['entete' => 'Documents', 'quand' => false, 'couleur' => count(array_filter(DC_DOCS_OBLIGATOIRES, fn($t) => empty($parType[$t]))) ? DC_ORANGE : DC_VERT,
    'texte' => implode("\n", $lignesDocs) . "\n\n*Ouvrir un document : menu ci-dessous (lien privé valable 10 minutes, le fichier reste sur le serveur).*"]);

  $minutesMois = dc_minutes_pointees($id, date('Y-m-01'), $auj);
  $minutesMoisPrec = dc_minutes_pointees($id, date('Y-m-01', strtotime('first day of last month')), date('Y-m-t', strtotime('last day of last month')));
  $enCours = dc_un("SELECT debut, site FROM pointages WHERE agent_id = ? AND fin = '' ORDER BY debut DESC LIMIT 1", [$id]);
  $dernier = dc_un("SELECT debut, fin, site FROM pointages WHERE agent_id = ? ORDER BY debut DESC LIMIT 1", [$id]);
  $planning = [];
  for ($i = 0; $i < 7; $i++) {
    $j = date('Y-m-d', strtotime("+$i days"));
    $v = dc_agent_prevu($a, $j);
    if ($v !== '') $planning[] = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][(int)date('w', strtotime($j))] . ' ' . date('d/m', strtotime($j)) . ' · ' . dc_txt($v, 30);
  }
  $absences = dc_q("SELECT type, du, au, statut FROM absences WHERE agent_id = ? AND (statut = 'attente' OR au >= ?) ORDER BY du LIMIT 6", [$id, $auj]);
  $incidents = dc_q('SELECT quand, categorie, gravite, site, statut FROM main_courante WHERE agent_id = ? ORDER BY quand DESC LIMIT 5', [$id]);
  $paies = dc_q('SELECT id, mois, titre, vu FROM equipe_paies WHERE agent_id = ? ORDER BY mois DESC LIMIT 12', [$id]);
  $activite = dc_carte(['entete' => 'Activité', 'quand' => false, 'champs' => [
    dc_champ('En service', $enCours ? 'Oui, depuis ' . dc_quand((string)$enCours['debut'], 't') . ($enCours['site'] !== '' ? ' · ' . dc_txt($enCours['site'], 40) : '') : 'Non'),
    dc_champ('Heures ce mois', dc_duree($minutesMois)), dc_champ('Heures mois dernier', dc_duree($minutesMoisPrec)),
    dc_champ('Dernier pointage', $dernier ? dc_quand((string)$dernier['debut']) . ($dernier['fin'] !== '' ? ' → ' . dc_quand((string)$dernier['fin'], 't') : ' (en cours)') : 'Jamais'),
    dc_champ('Planning des 7 prochains jours', $planning ? implode("\n", $planning) : 'Rien de prévu', false),
    dc_champ('Absences', $absences ? implode("\n", array_map(fn($x) => (DC_ABSENCES[$x['type']] ?? $x['type']) . ' · ' . dc_jour((string)$x['du']) . ($x['au'] !== $x['du'] ? ' → ' . dc_jour((string)$x['au']) : '') . ' · ' . dc_statut((string)$x['statut']), $absences)) : 'Aucune', false),
    dc_champ('Main courante', $incidents ? implode("\n", array_map(fn($m) => dc_jour((string)$m['quand']) . ' · ' . (DC_INCIDENTS[$m['categorie']] ?? $m['categorie']) . ' · ' . $m['gravite'] . ($m['site'] !== '' ? ' · ' . dc_txt($m['site'], 30) : '') . ' · ' . dc_statut((string)$m['statut']), $incidents)) : 'Aucun signalement', false),
    dc_champ('Fiches de paie déposées', $paies ? implode(', ', array_map(fn($p) => date('m/Y', strtotime($p['mois'] . '-01')) . ($p['vu'] !== '' ? ' ✓' : ''), $paies)) : 'Aucune', false),
  ]]);
  $espace = dc_carte(['entete' => 'Espace équipe', 'quand' => false, 'champs' => $compte ? [
    dc_champ('Identifiant', dc_txt($compte['identifiant'], 40)), dc_champ('Statut du compte', dc_statut((string)$compte['statut'])), dc_champ('Métier', DC_METIERS[$compte['metier']] ?? $compte['metier']),
    dc_champ('Dernière connexion', $compte['derniere'] !== '' ? dc_quand((string)$compte['derniere'], 'R') : 'jamais'), dc_champ('Appareils mémorisés', (string)$appareils), dc_champ('Compte créé', dc_jour((string)$compte['cree'])),
  ] : [dc_champ('Compte', 'Pas de compte dans l’Espace équipe', false)]]);
  $espace['footer'] = ['text' => 'BDA Security Group · mis à jour ' . date('d/m/Y H:i')];

  $optDocs = array_map(fn($d) => dc_option((DC_DOCS[$d['type']] ?? $d['type']) . ' · ' . $d['nom'], (string)$d['id'], 'Ajouté le ' . dc_jour((string)$d['ajoute'])), array_slice($docs, 0, 25));
  $optPaies = array_map(fn($p) => dc_option($p['titre'], (string)$p['id'], date('m/Y', strtotime($p['mois'] . '-01'))), array_slice($paies, 0, 25));
  return ['embeds' => [$fiche, $documents, $activite, $espace], 'components' => dc_composants(
    $optDocs ? [dc_liste('s:doc', 'Ouvrir un document (lien privé 10 min)…', $optDocs)] : [],
    $optPaies ? [dc_liste('s:paie', 'Ouvrir une fiche de paie (lien privé 10 min)…', $optPaies)] : [],
    dc_lignes([dc_bouton('Actualiser', "a:dossier:agent:$id"), dc_lien('Ouvrir dans l’admin', DC_ADMIN . 'agents')]))];
}
function dcv_doc_agent(int $id): array
{
  $d = dc_un('SELECT d.*, a.nom AS agent FROM agent_docs d JOIN agents a ON a.id = d.agent_id WHERE d.id = ?', [$id]);
  if (!$d) return dcv_introuvable('Document');
  return ['embeds' => [dc_carte(['entete' => 'Document déposé', 'titre' => (DC_DOCS[$d['type']] ?? $d['type']) . ' · ' . $d['agent'], 'url' => DC_ADMIN . 'agents', 'champs' => [
    dc_champ('Fichier', dc_txt($d['nom'], 120)), dc_champ('Taille', number_format((int)$d['taille'] / 1048576, 1, ',', ' ') . ' Mo'), dc_champ('Déposé', dc_quand((string)$d['ajoute'])),
    dc_champ('Par', $d['source'] === 'agent' ? 'L’agent (Espace équipe)' : 'La direction'),
  ]])], 'components' => dc_lignes([dc_bouton('Ouvrir (lien privé 10 min)', "a:doc:$id", 1), dc_bouton('Dossier de l’agent', 'v:agent:' . (int)$d['agent_id']), dc_lien('Admin', DC_ADMIN . 'agents')])];
}

/* ---------- Planning et pointage ---------- */
function dcv_planning(string $jour): array
{
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $jour)) $jour = date('Y-m-d');
  $p = dc_planning_jour($jour);
  $absents = dc_q("SELECT a.nom, ab.type FROM absences ab JOIN agents a ON a.id = ab.agent_id WHERE ab.statut = 'acceptee' AND ab.du <= ? AND ab.au >= ?", [$jour, $jour]);
  $travail = [];
  $repos = [];
  foreach ($p['agents'] as $a) {
    if (in_array(strtoupper($a['prevu']), DC_CODES_ABSENCE, true)) $repos[] = dc_txt($a['nom'], 60) . ' · ' . $a['prevu'];
    else $travail[] = '**' . dc_txt($a['nom'], 60) . '** · ' . dc_txt($a['prevu'], 40);
  }
  $pointes = dc_q('SELECT a.nom, p.debut, p.fin FROM pointages p JOIN agents a ON a.id = p.agent_id WHERE p.debut >= ? AND p.debut <= ? ORDER BY p.debut', [$jour . ' 00:00:00', $jour . ' 23:59:59']);
  $nomJour = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][(int)date('w', strtotime($jour))];
  return ['embeds' => [dc_carte(['entete' => 'Planning', 'titre' => ucfirst($nomJour) . ' ' . date('d/m/Y', strtotime($jour)) . ' · ' . count($travail) . ' agent(s) en poste', 'url' => DC_ADMIN . 'planning', 'quand' => false,
    'texte' => ($p['client'] !== '' ? '**Client :** ' . dc_txt($p['client'], 80) . ($p['site'] !== '' ? "\n**Site :** " . dc_txt($p['site'], 120) : '') . ($p['mission'] !== '' ? "\n**Mission :** " . dc_txt($p['mission'], 120) : '') . "\n\n" : '')
      . ($travail ? implode("\n", $travail) : 'Personne au planning ce jour-là.'),
    'champs' => [
      dc_champ('Repos / absences', $repos || $absents ? implode("\n", array_merge($repos, array_map(fn($x) => dc_txt($x['nom'], 60) . ' · ' . (DC_ABSENCES[$x['type']] ?? $x['type']), $absents))) : 'Aucune', false),
      dc_champ('Pointages', $pointes ? implode("\n", array_map(fn($x) => dc_txt($x['nom'], 60) . ' · ' . date('H\hi', strtotime($x['debut'])) . ($x['fin'] !== '' ? ' → ' . date('H\hi', strtotime($x['fin'])) : ' → en cours'), $pointes)) : 'Aucun', false),
    ]])], 'components' => dc_lignes([
      dc_bouton('Veille', 'v:planning:' . date('Y-m-d', strtotime($jour . ' -1 day'))), dc_bouton('Aujourd’hui', 'v:planning:' . date('Y-m-d')), dc_bouton('Lendemain', 'v:planning:' . date('Y-m-d', strtotime($jour . ' +1 day'))), dc_lien('Admin', DC_ADMIN . 'planning')])];
}
function dcv_pointage(): array
{
  $enService = dc_q("SELECT a.nom, p.debut, p.site, p.lat_debut, p.lng_debut FROM pointages p JOIN agents a ON a.id = p.agent_id WHERE p.fin = '' ORDER BY p.debut");
  $auj = dc_q("SELECT a.nom, p.debut, p.fin, p.site, p.manuel FROM pointages p JOIN agents a ON a.id = p.agent_id WHERE p.debut >= ? AND p.fin <> '' ORDER BY p.debut", [date('Y-m-d 00:00:00')]);
  $mois = [];
  foreach (dc_q("SELECT a.nom, p.debut, p.fin FROM pointages p JOIN agents a ON a.id = p.agent_id WHERE p.debut >= ?", [date('Y-m-01 00:00:00')]) as $p) {
    $mois[$p['nom']] = ($mois[$p['nom']] ?? 0) + max(0, (int)round((($p['fin'] !== '' ? strtotime($p['fin']) : time()) - strtotime($p['debut'])) / 60));
  }
  arsort($mois);
  return ['embeds' => [dc_carte(['entete' => 'Pointage', 'titre' => count($enService) . ' agent(s) en service', 'url' => DC_ADMIN . 'pointage', 'champs' => [
    dc_champ('En service maintenant', $enService ? implode("\n", array_map(fn($p) => '**' . dc_txt($p['nom'], 60) . '** · depuis ' . dc_quand((string)$p['debut'], 't') . ' (' . dc_duree((int)round((time() - strtotime($p['debut'])) / 60)) . ')' . ($p['site'] !== '' ? ' · ' . dc_txt($p['site'], 40) : '') . ($p['lat_debut'] !== null ? ' · [position](https://www.google.com/maps?q=' . $p['lat_debut'] . ',' . $p['lng_debut'] . ')' : ''), $enService)) : 'Personne', false),
    dc_champ('Services terminés aujourd’hui', $auj ? implode("\n", array_map(fn($p) => dc_txt($p['nom'], 60) . ' · ' . date('H\hi', strtotime($p['debut'])) . ' → ' . date('H\hi', strtotime($p['fin'])) . ' (' . dc_duree((int)round((strtotime($p['fin']) - strtotime($p['debut'])) / 60)) . ')' . ((int)$p['manuel'] ? ' · saisi à la main' : ''), $auj)) : 'Aucun', false),
    dc_champ('Heures du mois par agent', $mois ? implode("\n", array_map(fn($n, $m) => dc_txt($n, 60) . ' · ' . dc_duree($m), array_keys(array_slice($mois, 0, 20, true)), array_slice($mois, 0, 20, true))) : 'Aucune', false),
  ]])], 'components' => dc_lignes([dc_bouton('Actualiser', 'v:pointage'), dc_bouton('Planning du jour', 'v:planning:' . date('Y-m-d')), dc_lien('Admin', DC_ADMIN . 'pointage')])];
}
function dcv_pointage_un(int $id, string $titre): array
{
  $p = dc_un('SELECT p.*, a.nom, a.id AS aid FROM pointages p JOIN agents a ON a.id = p.agent_id WHERE p.id = ?', [$id]);
  if (!$p) return dcv_introuvable('Pointage');
  $fin = $p['fin'] !== '';
  $minutes = (int)round((($fin ? strtotime($p['fin']) : time()) - strtotime($p['debut'])) / 60);
  $lat = $fin ? $p['lat_fin'] : $p['lat_debut'];
  $lng = $fin ? $p['lng_fin'] : $p['lng_debut'];
  $prevu = dc_agent_prevu(['id' => (int)$p['aid'], 'nom' => $p['nom']], substr((string)$p['debut'], 0, 10));
  return ['embeds' => [dc_carte(['entete' => $titre, 'titre' => $p['nom'], 'url' => DC_ADMIN . 'pointage', 'couleur' => $fin ? DC_GRIS : DC_VERT, 'champs' => [
    dc_champ('Début', dc_quand((string)$p['debut'])), dc_champ('Fin', $fin ? dc_quand((string)$p['fin'], 't') : 'en cours'), dc_champ('Durée', dc_duree($minutes)),
    dc_champ('Site', dc_txt($p['site'] ?: '—', 80)), dc_champ('Prévu au planning', $prevu !== '' ? dc_txt($prevu, 40) : 'rien'),
    dc_champ('Position', $lat !== null ? '[Voir sur la carte](https://www.google.com/maps?q=' . $lat . ',' . $lng . ')' . (($fin ? $p['prec_fin'] : $p['prec_debut']) !== null ? ' (±' . (int)($fin ? $p['prec_fin'] : $p['prec_debut']) . ' m)' : '') : 'non transmise'),
  ]])], 'components' => dc_lignes([dc_bouton('Qui est en service', 'v:pointage'), dc_bouton('Dossier de l’agent', 'v:agent:' . (int)$p['aid'])])];
}

/* ---------- Absences ---------- */
function dcv_absences(): array
{
  $rows = dc_q("SELECT ab.*, a.nom FROM absences ab JOIN agents a ON a.id = ab.agent_id WHERE ab.statut = 'attente' OR (ab.statut = 'acceptee' AND ab.au >= ?) ORDER BY (ab.statut = 'attente') DESC, ab.du LIMIT 25", [date('Y-m-d')]);
  $lignes = array_map(fn($x) => ($x['statut'] === 'attente' ? '**À TRAITER** · ' : '') . '**' . dc_txt($x['nom'], 60) . '** · ' . (DC_ABSENCES[$x['type']] ?? $x['type']) . ' · ' . dc_jour((string)$x['du']) . ($x['au'] !== $x['du'] ? ' → ' . dc_jour((string)$x['au']) : '') . ' · ' . dc_statut((string)$x['statut']), $rows);
  $options = array_map(fn($x) => dc_option($x['nom'] . ' · ' . (DC_ABSENCES[$x['type']] ?? $x['type']), (string)$x['id'], dc_jour((string)$x['du']) . ' → ' . dc_jour((string)$x['au']) . ' · ' . dc_statut((string)$x['statut'])), $rows);
  return ['embeds' => [dc_carte(['entete' => 'Congés et absences', 'titre' => 'En attente et à venir', 'url' => DC_ADMIN . 'equipe/absences', 'texte' => $lignes ? implode("\n", $lignes) : 'Aucune demande en attente ni absence à venir.'])],
    'components' => dc_composants($options ? [dc_liste('s:absence', 'Ouvrir une demande…', $options)] : [], dc_lignes([dc_lien('Admin', DC_ADMIN . 'equipe/absences')]))];
}
function dcv_absence(int $id, string $entete = 'Demande d’absence'): array
{
  $x = dc_un('SELECT ab.*, a.nom, a.id AS aid FROM absences ab JOIN agents a ON a.id = ab.agent_id WHERE ab.id = ?', [$id]);
  if (!$x) return dcv_introuvable('Absence');
  $jours = (int)floor((strtotime((string)$x['au']) - strtotime((string)$x['du'])) / 86400) + 1;
  $couleur = ['attente' => DC_OR, 'acceptee' => DC_VERT, 'refusee' => DC_ROUGE, 'annulee' => DC_GRIS][$x['statut']] ?? DC_OR;
  $boutons = [];
  if ($x['statut'] === 'attente') { $boutons[] = dc_bouton('Accepter (+ planning)', "a:abs:a:$id", 3); $boutons[] = dc_bouton('Refuser', "a:abs:r:$id", 4); }
  if ((int)$x['justificatif']) $boutons[] = dc_bouton('Justificatif', 'a:doc:' . (int)$x['justificatif']);
  $boutons[] = dc_bouton('Dossier de l’agent', 'v:agent:' . (int)$x['aid']);
  $boutons[] = dc_lien('Admin', DC_ADMIN . 'equipe/absences');
  return ['embeds' => [dc_carte(['entete' => $entete, 'titre' => $x['nom'] . ' · ' . (DC_ABSENCES[$x['type']] ?? $x['type']), 'url' => DC_ADMIN . 'equipe/absences', 'couleur' => $couleur, 'champs' => [
    dc_champ('Du', dc_jour((string)$x['du'])), dc_champ('Au', dc_jour((string)$x['au'])), dc_champ('Durée', $jours . ' jour(s)'),
    dc_champ('Statut', dc_statut((string)$x['statut'])), dc_champ('Justificatif', (int)$x['justificatif'] ? 'Joint' : 'Aucun'), dc_champ('Demandée', dc_quand((string)$x['cree'], 'R')),
    $x['motif'] !== '' ? dc_champ('Motif', dc_txt($x['motif'], 600), false) : null,
    $x['reponse'] !== '' ? dc_champ('Réponse', dc_txt($x['reponse'], 600), false) : null,
  ]])], 'components' => dc_lignes($boutons)];
}

/* ---------- Main courante ---------- */
function dcv_incidents(): array
{
  $rows = dc_q('SELECT m.*, a.nom FROM main_courante m LEFT JOIN agents a ON a.id = m.agent_id ORDER BY (m.statut = \'nouveau\') DESC, m.quand DESC LIMIT 25');
  $lignes = array_map(fn($m) => ($m['statut'] === 'nouveau' ? '**NON LU** · ' : '') . ($m['gravite'] === 'urgente' ? '**URGENT** · ' : '') . dc_quand((string)$m['quand'], 'f') . ' · ' . (DC_INCIDENTS[$m['categorie']] ?? $m['categorie']) . ' · ' . dc_txt($m['nom'] ?? '?', 50) . ($m['site'] !== '' ? ' · ' . dc_txt($m['site'], 40) : ''), $rows);
  $options = array_map(fn($m) => dc_option((DC_INCIDENTS[$m['categorie']] ?? $m['categorie']) . ' · ' . ($m['nom'] ?? '?'), (string)$m['id'], date('d/m H:i', strtotime((string)$m['quand'])) . ' · ' . $m['gravite'] . ' · ' . dc_statut((string)$m['statut'])), $rows);
  return ['embeds' => [dc_carte(['entete' => 'Main courante', 'titre' => (int)dc_n("SELECT COUNT(*) FROM main_courante WHERE statut = 'nouveau'") . ' non lu(s)', 'url' => DC_ADMIN . 'equipe/main-courante', 'texte' => $lignes ? implode("\n", $lignes) : 'Aucun signalement.'])],
    'components' => dc_composants($options ? [dc_liste('s:incident', 'Ouvrir un signalement…', $options)] : [], dc_lignes([dc_lien('Admin', DC_ADMIN . 'equipe/main-courante')]))];
}
function dcv_incident(int $id): array
{
  $m = dc_un('SELECT m.*, a.nom, a.tel, a.id AS aid FROM main_courante m LEFT JOIN agents a ON a.id = m.agent_id WHERE m.id = ?', [$id]);
  if (!$m) return dcv_introuvable('Main courante');
  $photos = json_decode((string)$m['photos'], true) ?: [];
  $urgent = $m['gravite'] === 'urgente';
  $boutons = [];
  if ($m['statut'] === 'nouveau') $boutons[] = dc_bouton('Marquer lu', "a:mc:l:$id");
  if ($m['statut'] !== 'traite') $boutons[] = dc_bouton('Traité', "a:mc:t:$id", 3);
  foreach (array_keys(array_slice($photos, 0, 4)) as $k) $boutons[] = dc_bouton('Photo ' . ($k + 1), "a:photo:$id:" . ($k + 1));
  $boutons[] = dc_bouton('Dossier de l’agent', 'v:agent:' . (int)$m['aid']);
  $boutons[] = dc_lien('Admin', DC_ADMIN . 'equipe/main-courante');
  return ['embeds' => [dc_carte(['entete' => ($urgent ? 'URGENT · ' : '') . 'Main courante · ' . $m['gravite'], 'titre' => (DC_INCIDENTS[$m['categorie']] ?? $m['categorie']) . ($m['site'] !== '' ? ' · ' . $m['site'] : ''), 'url' => DC_ADMIN . 'equipe/main-courante',
    'couleur' => $urgent ? DC_ROUGE : ($m['gravite'] === 'info' ? DC_GRIS : DC_ORANGE), 'texte' => dc_txt((string)$m['texte'], 3500),
    'champs' => [
      dc_champ('Agent', dc_txt($m['nom'] ?? '?', 60)), dc_champ('Téléphone', dc_txt($m['tel'] ?? '', 30)), dc_champ('Quand', dc_quand((string)$m['quand'])),
      dc_champ('Statut', dc_statut((string)$m['statut'])), dc_champ('Photos', count($photos) ? count($photos) . ' (jointes ci-dessous)' : 'Aucune'), dc_champ('Signalé', dc_quand((string)$m['cree'], 'R')),
      $m['commentaire'] !== '' ? dc_champ('Commentaire de la direction', dc_txt($m['commentaire'], 800), false) : null,
    ]])], 'components' => dc_lignes($boutons)];
}

/* ---------- Comptes de l'Espace équipe ---------- */
function dcv_comptes(): array
{
  $rows = dc_q("SELECT ce.*, a.nom AS agent_nom FROM comptes_equipe ce LEFT JOIN agents a ON a.id = ce.agent_id ORDER BY (ce.statut = 'attente') DESC, ce.cree DESC LIMIT 25");
  $lignes = array_map(fn($c) => ($c['statut'] === 'attente' ? '**À VALIDER** · ' : '') . '**' . dc_txt($c['prenom'] . ' ' . $c['nom'], 60) . '** · ' . (DC_METIERS[$c['metier']] ?? $c['metier']) . ' · `' . dc_txt($c['identifiant'], 30) . '` · ' . dc_statut((string)$c['statut']) . ($c['derniere'] !== '' ? ' · vu ' . dc_quand((string)$c['derniere'], 'R') : ''), $rows);
  $options = array_map(fn($c) => dc_option($c['prenom'] . ' ' . $c['nom'], (string)$c['id'], (DC_METIERS[$c['metier']] ?? '') . ' · ' . dc_statut((string)$c['statut'])), $rows);
  return ['embeds' => [dc_carte(['entete' => 'Espace équipe', 'titre' => (int)dc_n("SELECT COUNT(*) FROM comptes_equipe WHERE statut = 'attente'") . ' compte(s) à valider', 'url' => DC_ADMIN . 'equipe/comptes', 'texte' => $lignes ? implode("\n", $lignes) : 'Aucun compte.'])],
    'components' => dc_composants($options ? [dc_liste('s:compte', 'Ouvrir un compte…', $options)] : [], dc_lignes([dc_lien('Admin', DC_ADMIN . 'equipe/comptes')]))];
}
function dcv_compte(int $id, string $entete = 'Espace équipe'): array
{
  $c = dc_un('SELECT ce.*, a.nom AS agent_nom FROM comptes_equipe ce LEFT JOIN agents a ON a.id = ce.agent_id WHERE ce.id = ?', [$id]);
  if (!$c) return dcv_introuvable('Compte');
  $boutons = [];
  if ($c['statut'] === 'attente') { $boutons[] = dc_bouton('Valider', "a:cpt:v:$id", 3); $boutons[] = dc_bouton('Refuser', "a:cpt:r:$id", 4); }
  if ($c['statut'] === 'actif') $boutons[] = dc_bouton('Suspendre', "a:cpt:b:$id", 4);
  if ($c['statut'] === 'bloque') $boutons[] = dc_bouton('Réactiver', "a:cpt:a:$id", 3);
  if ((int)$c['agent_id']) $boutons[] = dc_bouton('Dossier de l’agent', 'v:agent:' . (int)$c['agent_id']);
  $boutons[] = dc_lien('Admin', DC_ADMIN . 'equipe/comptes');
  return ['embeds' => [dc_carte(['entete' => $entete, 'titre' => $c['prenom'] . ' ' . $c['nom'], 'url' => DC_ADMIN . 'equipe/comptes', 'couleur' => ['attente' => DC_OR, 'actif' => DC_VERT][$c['statut']] ?? DC_GRIS, 'champs' => [
    dc_champ('Métier', DC_METIERS[$c['metier']] ?? $c['metier']), dc_champ('Identifiant', '`' . dc_txt($c['identifiant'], 40) . '`'), dc_champ('Statut', dc_statut((string)$c['statut'])),
    dc_champ('Téléphone', dc_txt($c['tel'], 30)), dc_champ('Email', dc_txt($c['email'], 120)), dc_champ('Fiche agent', $c['agent_nom'] ? dc_txt($c['agent_nom'], 60) : 'pas encore reliée'),
    dc_champ('Demande', dc_quand((string)$c['cree'])), dc_champ('Validé', $c['valide'] !== '' ? dc_quand((string)$c['valide'], 'R') : '—'), dc_champ('Dernière connexion', $c['derniere'] !== '' ? dc_quand((string)$c['derniere'], 'R') : 'jamais'),
  ]])], 'components' => dc_lignes($boutons)];
}

/* ---------- Candidatures ---------- */
function dcv_candidatures(): array
{
  $rows = dc_q("SELECT * FROM candidatures ORDER BY (statut = 'nouvelle') DESC, id DESC LIMIT 25");
  $lignes = [];
  $options = [];
  foreach ($rows as $c) {
    $d = json_decode((string)$c['data'], true) ?: [];
    $nom = dc_form($d, ['Nom', 'Nom et prénom', 'Prénom et nom', 'Nom complet']) ?: trim(dc_form($d, ['Prénom']) . ' ' . dc_form($d, ['Nom de famille']));
    $poste = dc_form($d, ['Poste', 'Poste recherché', 'Métier']);
    $lignes[] = "**#{$c['id']}** · " . dc_quand((string)$c['recu'], 'd') . ' · ' . dc_txt($nom ?: 'Sans nom', 60) . ($poste ? ' · ' . dc_txt($poste, 50) : '') . ' · ' . dc_statut((string)$c['statut']);
    $options[] = dc_option("#{$c['id']} · " . ($nom ?: 'Sans nom'), (string)$c['id'], ($poste ?: 'Candidature') . ' · ' . dc_statut((string)$c['statut']));
  }
  return ['embeds' => [dc_carte(['entete' => 'Candidatures', 'titre' => (int)dc_n("SELECT COUNT(*) FROM candidatures WHERE statut = 'nouvelle'") . ' nouvelle(s)', 'url' => DC_ADMIN . 'candidatures', 'texte' => $lignes ? implode("\n", $lignes) : 'Aucune candidature.'])],
    'components' => dc_composants($options ? [dc_liste('s:candidature', 'Ouvrir une candidature…', $options)] : [], dc_lignes([dc_lien('Admin', DC_ADMIN . 'candidatures')]))];
}
function dcv_candidature(int $id): array
{
  $c = dc_un('SELECT * FROM candidatures WHERE id = ?', [$id]);
  if (!$c) return dcv_introuvable('Candidature');
  $d = json_decode((string)$c['data'], true) ?: [];
  $champs = [];
  $longs = [];
  foreach ($d as $k => $v) {
    $v = trim((string)$v);
    if ($v === '') continue;
    if (mb_strlen($v) > 60 || str_contains($v, "\n")) $longs[] = '**' . dc_txt((string)$k, 60) . "**\n" . dc_txt($v, 1500);
    else $champs[] = dc_champ((string)$k, dc_txt($v, 200));
  }
  $nom = dc_form($d, ['Nom', 'Nom et prénom', 'Prénom et nom', 'Nom complet']);
  $boutons = [];
  foreach (['en_cours' => 'En cours', 'retenue' => 'Retenue', 'refusee' => 'Refusée'] as $s => $lib) if ($c['statut'] !== $s) $boutons[] = dc_bouton($lib, "a:cand:$s:$id", $s === 'retenue' ? 3 : ($s === 'refusee' ? 4 : 2));
  $boutons[] = dc_lien('Admin', DC_ADMIN . 'candidatures');
  return ['embeds' => [dc_carte(['entete' => "Candidature · #$id", 'titre' => $nom ?: 'Candidature', 'url' => DC_ADMIN . 'candidatures', 'couleur' => ['retenue' => DC_VERT, 'refusee' => DC_GRIS][$c['statut']] ?? DC_OR,
    'texte' => 'Reçue ' . dc_quand((string)$c['recu']) . ' · statut **' . dc_statut((string)$c['statut']) . '**' . ($longs ? "\n\n" . implode("\n\n", $longs) : ''), 'champs' => $champs])], 'components' => dc_lignes($boutons)];
}

/* ---------- Avis ---------- */
function dcv_avis(): array
{
  $rows = dc_q("SELECT * FROM avis ORDER BY (statut = 'attente') DESC, id DESC LIMIT 15");
  $moy = dc_un("SELECT COUNT(*) n, AVG(note) m FROM avis WHERE statut = 'publie'") ?? ['n' => 0, 'm' => 0];
  $lignes = array_map(fn($a) => ($a['statut'] === 'attente' ? '**À VALIDER** · ' : '') . str_repeat('★', (int)$a['note']) . str_repeat('☆', 5 - (int)$a['note']) . ' · **' . dc_txt($a['nom'], 40) . '** · ' . dc_quand((string)$a['recu'], 'd') . "\n> " . dc_txt(str_replace("\n", ' ', (string)$a['texte']), 200), $rows);
  $options = array_map(fn($a) => dc_option($a['nom'] . ' · ' . $a['note'] . '/5', (string)$a['id'], dc_statut((string)$a['statut']) . ' · ' . mb_substr((string)$a['texte'], 0, 70)), $rows);
  return ['embeds' => [dc_carte(['entete' => 'Avis clients', 'titre' => (int)$moy['n'] . ' avis publiés · moyenne ' . number_format((float)$moy['m'], 1, ',', '') . '/5', 'url' => DC_ADMIN . 'avis', 'texte' => $lignes ? implode("\n\n", $lignes) : 'Aucun avis.'])],
    'components' => dc_composants($options ? [dc_liste('s:avis', 'Ouvrir un avis…', $options)] : [], dc_lignes([dc_lien('Admin', DC_ADMIN . 'avis')]))];
}
function dcv_avis_un(int $id): array
{
  $a = dc_un('SELECT * FROM avis WHERE id = ?', [$id]);
  if (!$a) return dcv_introuvable('Avis');
  $boutons = [];
  if ($a['statut'] !== 'publie') $boutons[] = dc_bouton('Publier sur le site', "a:avis:p:$id", 3);
  if ($a['statut'] !== 'refuse') $boutons[] = dc_bouton('Refuser', "a:avis:r:$id", 4);
  $boutons[] = dc_lien('Admin', DC_ADMIN . 'avis');
  return ['embeds' => [dc_carte(['entete' => 'Avis client · ' . dc_statut((string)$a['statut']), 'titre' => str_repeat('★', (int)$a['note']) . str_repeat('☆', 5 - (int)$a['note']) . ' · ' . $a['nom'], 'url' => DC_ADMIN . 'avis',
    'couleur' => ['publie' => DC_VERT, 'refuse' => DC_GRIS][$a['statut']] ?? DC_OR, 'texte' => dc_txt((string)$a['texte'], 1500), 'champs' => [
      dc_champ('Note', $a['note'] . '/5'), dc_champ('Prestation', dc_txt($a['prestation'] ?: '—', 80)), dc_champ('Email', dc_txt($a['email'] ?: '—', 120)), dc_champ('Reçu', dc_quand((string)$a['recu'], 'R')),
    ]])], 'components' => dc_lignes($boutons)];
}

/* ---------- Réservations VTC ---------- */
function dcv_vtc(): array
{
  $rows = dc_q("SELECT * FROM reservations WHERE statut IN ('attente', 'confirmee') AND date_course >= ? ORDER BY date_course LIMIT 25", [date('Y-m-d 00:00:00')]);
  $lignes = [];
  $options = [];
  foreach ($rows as $r) {
    $d = json_decode((string)$r['data'], true) ?: [];
    $lignes[] = ($r['statut'] === 'attente' ? '**À CONFIRMER** · ' : '') . dc_quand((string)$r['date_course']) . ' · `' . $r['ref'] . '` · ' . dc_txt($d['nom'] ?? '', 40) . ' · ' . dc_txt(($d['depart']['label'] ?? ''), 50) . (($d['mode'] ?? '') === 'dispo' ? ' · dispo ' . (int)($d['heures'] ?? 0) . ' h' : ' → ' . dc_txt($d['arrivee']['label'] ?? '', 50)) . ' · ' . dc_eur((float)$r['prix']);
    $options[] = dc_option($r['ref'] . ' · ' . ($d['nom'] ?? ''), (string)$r['id'], date('d/m H:i', strtotime((string)$r['date_course'])) . ' · ' . dc_statut((string)$r['statut']));
  }
  return ['embeds' => [dc_carte(['entete' => 'Réservations VTC', 'titre' => 'Courses à venir · ' . count($rows), 'url' => DC_ADMIN . 'vtc', 'texte' => $lignes ? implode("\n", $lignes) : 'Aucune course à venir.'])],
    'components' => dc_composants($options ? [dc_liste('s:reservation', 'Ouvrir une réservation…', $options)] : [], dc_lignes([dc_lien('Admin', DC_ADMIN . 'vtc')]))];
}
function dcv_reservation(int $id, string $entete = 'Réservation VTC'): array
{
  $r = dc_un('SELECT * FROM reservations WHERE id = ?', [$id]);
  if (!$r) return dcv_introuvable('Réservation');
  $d = json_decode((string)$r['data'], true) ?: [];
  $boutons = [];
  if ($r['statut'] === 'attente') $boutons[] = dc_bouton('Confirmer la course', "a:vtc:c:$id", 3);
  if ($r['statut'] === 'confirmee') $boutons[] = dc_bouton('Course terminée', "a:vtc:t:$id", 3);
  if (in_array($r['statut'], ['attente', 'confirmee'], true)) $boutons[] = dc_bouton('Annuler', "a:vtc:x:$id", 4);
  $boutons[] = dc_lien('Admin', DC_ADMIN . 'vtc');
  $trajet = ($d['mode'] ?? '') === 'dispo' ? 'Mise à disposition ' . (int)($d['heures'] ?? 0) . ' h' : dc_txt($d['arrivee']['label'] ?? '', 200) . ' (' . ($d['km'] ?? '?') . ' km, ~' . ($d['min'] ?? '?') . ' min)';
  return ['embeds' => [dc_carte(['entete' => $entete . ' · ' . dc_statut((string)$r['statut']), 'titre' => $r['ref'] . ' · ' . dc_jour((string)$r['date_course']) . ' à ' . ($d['heure'] ?? ''), 'url' => DC_ADMIN . 'vtc',
    'couleur' => ['attente' => DC_OR, 'confirmee' => DC_VERT, 'terminee' => DC_GRIS, 'annulee' => DC_ROUGE][$r['statut']] ?? DC_OR, 'champs' => [
      dc_champ('Client', dc_txt($d['nom'] ?? '', 80)), dc_champ('Téléphone', dc_txt($d['tel'] ?? '', 30)), dc_champ('Email', dc_txt($d['email'] ?? '', 120)),
      dc_champ('Départ', dc_txt($d['depart']['label'] ?? '', 200), false), dc_champ(($d['mode'] ?? '') === 'dispo' ? 'Formule' : 'Arrivée', $trajet, false),
      dc_champ('Véhicule', ($d['vehicule'] ?? '') === 'van' ? 'Van' : 'Berline'), dc_champ('Passagers / bagages', (int)($d['passagers'] ?? 1) . ' / ' . (int)($d['bagages'] ?? 0)), dc_champ('Prix', '**' . dc_eur((float)$r['prix']) . '**'),
      dc_champ('Vol / train', dc_txt($d['vol'] ?? '', 30)), dc_champ('Options', trim((!empty($d['sieges']) ? $d['sieges'] . ' siège(s) enfant · ' : '') . (!empty($d['pancarte']) ? 'pancarte' : '')) ?: '—'), dc_champ('Chauffeur', dc_txt($d['chauffeur'] ?? '', 60)),
      !empty($d['message']) ? dc_champ('Message', dc_txt($d['message'], 500), false) : null,
      dc_champ('Réservée', dc_quand((string)$r['recu'], 'R')),
    ]])], 'components' => dc_lignes($boutons)];
}

/* ---------- Assistant du site ---------- */
function dcv_assistance_liste(): array
{
  $rows = dc_q("SELECT c.*, (SELECT texte FROM assist_msg m WHERE m.conv_id = c.id ORDER BY m.id DESC LIMIT 1) AS dernier FROM assist_conv c WHERE c.statut IN ('attente', 'equipe') OR c.maj >= ? ORDER BY CASE c.statut WHEN 'attente' THEN 0 ELSE 1 END, c.maj DESC LIMIT 20", [date('Y-m-d H:i:s', time() - 7 * 86400)]);
  $lignes = array_map(fn($c) => ($c['statut'] === 'attente' ? '**CONSEILLER DEMANDÉ** · ' : '') . '**' . dc_txt($c['nom'] ?: 'Visiteur', 50) . '**' . ($c['contact'] ? ' · ' . dc_txt($c['contact'], 60) : '') . ' · ' . dc_quand((string)$c['maj'], 'R') . "\n> " . dc_txt(str_replace("\n", ' ', (string)$c['dernier']), 150), $rows);
  $options = array_map(fn($c) => dc_option(($c['nom'] ?: 'Visiteur') . ' · ' . dc_statut((string)$c['statut']), (string)$c['id'], mb_substr((string)$c['dernier'], 0, 90)), $rows);
  return ['embeds' => [dc_carte(['entete' => 'Assistant du site', 'titre' => 'Conversations des 7 derniers jours', 'url' => DC_ADMIN . 'assistance', 'texte' => $lignes ? implode("\n\n", $lignes) : 'Aucune conversation.'])],
    'components' => dc_composants($options ? [dc_liste('s:assistance', 'Ouvrir une conversation…', $options)] : [], dc_lignes([dc_lien('Admin', DC_ADMIN . 'assistance')]))];
}
function dcv_assistance(int $id, string $entete = 'Assistant du site'): array
{
  $c = dc_un('SELECT * FROM assist_conv WHERE id = ?', [$id]);
  if (!$c) return dcv_introuvable('Conversation');
  $msgs = array_reverse(dc_q('SELECT auteur, texte, cree FROM assist_msg WHERE conv_id = ? ORDER BY id DESC LIMIT 14', [$id]));
  $qui = ['visiteur' => 'Visiteur', 'robot' => 'Assistant', 'equipe' => 'BDA'];
  $fil = array_map(fn($m) => '**' . ($qui[$m['auteur']] ?? $m['auteur']) . '** · ' . date('H:i', strtotime((string)$m['cree'])) . "\n" . dc_txt((string)$m['texte'], 400), $msgs);
  return ['embeds' => [dc_carte(['entete' => $entete . ' · ' . dc_statut((string)$c['statut']), 'titre' => ($c['nom'] ?: 'Visiteur') . ($c['contact'] ? ' · ' . $c['contact'] : ''), 'url' => DC_ADMIN . 'assistance/' . $id,
    'couleur' => $c['statut'] === 'attente' ? DC_ORANGE : DC_OR, 'texte' => $fil ? implode("\n\n", $fil) : 'Aucun message.', 'champs' => [
      dc_champ('Page', dc_txt($c['page'] ?: '—', 120)), dc_champ('Début', dc_quand((string)$c['cree'], 'R')), dc_champ('Non lus', (string)(int)$c['non_lu']),
    ]])], 'components' => dc_lignes([dc_bouton('Répondre', "m:assist:$id", 1), $c['statut'] !== 'close' ? dc_bouton('Clore', "a:assist:c:$id") : null, dc_lien('Admin', DC_ADMIN . 'assistance/' . $id)])];
}

/* ---------- Veille commerciale ---------- */
function dcv_opportunite_carte(array $o, string $prefixe = ''): array
{
  $alertes = json_decode((string)$o['alertes'], true) ?: [];
  $boamp = $o['source'] === 'boamp';
  $niveau = ['fort' => 'Très pertinent', 'moyen' => 'À regarder', 'faible' => 'Faible'][$o['niveau']] ?? $o['niveau'];
  $jx = $o['date_limite'] !== '' ? dc_jx((string)$o['date_limite']) : '';
  return dc_carte([
    'entete' => $prefixe . ($boamp ? 'Appel d’offres' : 'Entreprise qui recrute') . ' · ' . $niveau, 'titre' => ($boamp ? $o['titre'] : $o['acheteur']), 'url' => $o['url'] ?: DC_ADMIN . 'opportunites/' . $o['id'],
    'couleur' => $prefixe !== '' ? DC_ROUGE : ($o['niveau'] === 'fort' ? DC_VERT : ($o['niveau'] === 'moyen' ? DC_OR : DC_GRIS)),
    'texte' => $boamp ? dc_txt((string)$o['nature'], 200) : dc_txt((string)$o['titre'], 200) . ($o['extrait'] !== '' ? "\n" . dc_txt((string)$o['extrait'], 600) : ''),
    'champs' => array_values(array_filter([
      $boamp ? dc_champ('Acheteur', dc_txt($o['acheteur'] ?: '—', 200)) : dc_champ('Secteur', dc_txt($o['nature'] ?: '—', 200)),
      dc_champ('Lieu', dc_txt($o['lieu'] ?: '—', 120)),
      $boamp ? dc_champ('Date limite', $o['date_limite'] !== '' ? dc_quand((string)$o['date_limite']) . " · **$jx**" : '—') : null,
      (float)$o['montant'] > 0 ? dc_champ('Montant estimé', dc_eur((float)$o['montant']) . ' HT') : null,
      dc_champ($boamp ? 'Score' : 'Potentiel d’embauche', (string)(int)$o['score'] . ($boamp ? '' : '/100')),
      dc_champ('Statut', dc_statut((string)$o['statut'])),
      $alertes ? dc_champ('À savoir', dc_txt(implode(' · ', $alertes), 600), false) : null,
      $o['note'] !== '' ? dc_champ('Note', dc_txt($o['note'], 800), false) : null,
    ])),
  ]);
}
function dcv_opportunite_boutons(array $o): array
{
  $id = (int)$o['id'];
  return dc_lignes(array_filter([
    $o['statut'] !== 'contacte' ? dc_bouton('Contacté', "a:opp:c:$id", 3) : null,
    $o['statut'] !== 'ignore' ? dc_bouton('Ignorer', "a:opp:i:$id", 4) : null,
    $o['statut'] !== 'a_traiter' ? dc_bouton('Remettre à traiter', "a:opp:r:$id") : null,
    dc_bouton('Note', "m:opp:$id"),
    $o['url'] ? dc_lien($o['source'] === 'boamp' ? 'Voir l’avis' : 'Fiche entreprise', (string)$o['url']) : null,
    $o['url_dossier'] ? dc_lien('Dossier de consultation', (string)$o['url_dossier']) : null,
  ]));
}
function dcv_opportunite(int $id, string $prefixe = ''): array
{
  $o = dc_un('SELECT * FROM opportunites WHERE id = ?', [$id]);
  if (!$o) return dcv_introuvable('Opportunité');
  return ['embeds' => [dcv_opportunite_carte($o, $prefixe)], 'components' => dcv_opportunite_boutons($o)];
}
function dcv_opportunites(string $type = 'tout'): array
{
  [$where, $titre] = match ($type) {
    'ao' => ["source = 'boamp' AND statut = 'a_traiter'", 'Appels d’offres à traiter'],
    'prospects' => ["source = 'francetravail' AND statut = 'a_traiter'", 'Entreprises qui recrutent (prospects)'],
    'contactes' => ["statut = 'contacte'", 'Contactés'],
    default => ["statut = 'a_traiter'", 'Opportunités à traiter'],
  };
  $rows = dc_q("SELECT * FROM opportunites WHERE $where ORDER BY CASE niveau WHEN 'fort' THEN 0 WHEN 'moyen' THEN 1 ELSE 2 END, CASE WHEN date_limite = '' THEN 1 ELSE 0 END, date_limite, score DESC LIMIT 25");
  $total = (int)dc_n("SELECT COUNT(*) FROM opportunites WHERE $where");
  $lignes = array_map(fn($o) => '**' . dc_txt($o['source'] === 'boamp' ? $o['titre'] : $o['acheteur'], 90) . '** · ' . dc_txt($o['source'] === 'boamp' ? $o['acheteur'] : $o['nature'], 50) . ($o['date_limite'] !== '' ? ' · **' . dc_jx((string)$o['date_limite']) . '**' : '') . ' · ' . ['fort' => 'très pertinent', 'moyen' => 'à regarder', 'faible' => 'faible'][$o['niveau']], $rows);
  $options = array_map(fn($o) => dc_option($o['source'] === 'boamp' ? $o['titre'] : $o['acheteur'], (string)$o['id'], ($o['date_limite'] !== '' ? dc_jx((string)$o['date_limite']) . ' · ' : '') . ($o['source'] === 'boamp' ? $o['acheteur'] : $o['lieu'])), $rows);
  return ['embeds' => [dc_carte(['entete' => 'Veille commerciale', 'titre' => "$titre · $total", 'url' => DC_ADMIN . 'opportunites', 'texte' => $lignes ? implode("\n", $lignes) : 'Rien à traiter.'])],
    'components' => dc_composants($options ? [dc_liste('s:opportunite', 'Ouvrir une opportunité…', $options)] : [], dc_lignes([
      dc_bouton('Tout', 'v:opportunites:tout', $type === 'tout' ? 1 : 2), dc_bouton('Appels d’offres', 'v:opportunites:ao', $type === 'ao' ? 1 : 2), dc_bouton('Prospects', 'v:opportunites:prospects', $type === 'prospects' ? 1 : 2), dc_bouton('Contactés', 'v:opportunites:contactes', $type === 'contactes' ? 1 : 2), dc_lien('Admin', DC_ADMIN . 'opportunites')]))];
}
function dcv_urgent(): array
{
  $rows = dc_q("SELECT * FROM opportunites WHERE source = 'boamp' AND statut <> 'ignore' AND date_limite <> '' AND date_limite >= ? AND date_limite <= ? ORDER BY date_limite LIMIT 25", [maintenant(), date('Y-m-d 23:59:59', strtotime('+7 days'))]);
  $lignes = array_map(fn($o) => '**' . dc_jx((string)$o['date_limite']) . '** · ' . dc_quand((string)$o['date_limite']) . ' · ' . dc_txt($o['titre'], 100) . ' · ' . dc_txt($o['acheteur'], 50) . ' · ' . dc_statut((string)$o['statut']), $rows);
  $options = array_map(fn($o) => dc_option($o['titre'], (string)$o['id'], dc_jx((string)$o['date_limite']) . ' · ' . $o['acheteur']), $rows);
  return ['embeds' => [dc_carte(['entete' => 'Urgent', 'titre' => 'Appels d’offres qui se terminent sous 7 jours · ' . count($rows), 'couleur' => $rows ? DC_ROUGE : DC_VERT, 'url' => DC_ADMIN . 'opportunites', 'texte' => $lignes ? implode("\n", $lignes) : 'Aucune date limite dans les 7 jours.'])],
    'components' => dc_composants($options ? [dc_liste('s:opportunite', 'Ouvrir…', $options)] : [], dc_lignes([dc_lien('Admin', DC_ADMIN . 'opportunites')]))];
}

/* ---------- Site, journal, recherche, aide ---------- */
function dcv_site(): array
{
  $s = site_reglages();
  $hl = site_hors_ligne();
  $etat = json_decode((string)(dc_un("SELECT v FROM reglages WHERE k = 'veille_etat'")['v'] ?? ''), true) ?: [];
  $file = dc_un("SELECT SUM(etat = 'attente') a, SUM(etat = 'erreur') e FROM dc_file") ?? ['a' => 0, 'e' => 0];
  $dc = dc_config();
  $taille = @filesize(dossier_donnees() . '/gestion.sqlite') ?: 0;
  return ['embeds' => [dc_carte(['entete' => 'État du site', 'titre' => $hl ? 'EN MAINTENANCE' : 'En ligne · bdasecurite.com', 'url' => DC_SITE, 'couleur' => $hl ? DC_ROUGE : DC_VERT, 'champs' => [
    dc_champ('Visiteurs', $hl ? 'Page de maintenance depuis ' . dc_quand((string)($hl['depuis'] ?? ''), 'R') : 'Site normal'),
    dc_champ('Bandeau', !empty($s['bandeau']['actif']) ? dc_txt($s['bandeau']['texte'], 200) : 'Masqué'),
    dc_champ('Formulaires', 'Devis ' . ($s['devis'] ? 'ouvert' : 'fermé') . "\nRecrutement " . ($s['recrutement'] ? 'ouvert' : 'fermé') . "\nAvis " . ($s['avis'] ? 'ouvert' : 'fermé') . "\nVTC " . (!empty(tarifs_vtc()['ouvert']) ? 'ouvert' : 'fermé')),
    dc_champ('Dernière veille', !empty($etat['derniere']['quand']) ? dc_quand((string)$etat['derniere']['quand'], 'R') . ' (' . ($etat['derniere']['origine'] ?? '') . ')' : 'jamais'),
    dc_champ('Discord', 'File : ' . (int)$file['a'] . ' en attente · ' . (int)$file['e'] . ' en erreur' . (!empty($dc['synchro']) ? "\nSynchro " . dc_quand((string)$dc['synchro'], 'R') : '')),
    dc_champ('Données', number_format($taille / 1048576, 1, ',', ' ') . ' Mo · PHP ' . PHP_VERSION),
  ]])], 'components' => dc_lignes([
    $hl ? dc_bouton('Remettre en ligne', 'a:site:on:0', 3) : dc_bouton('Mettre en maintenance', 'x:site:off:0', 4),
    dc_bouton('Bandeau d’annonce', 'm:bandeau:0'), dc_bouton('Actualiser', 'v:site'), dc_lien('Voir le site', DC_SITE), dc_lien('Contrôle du site', DC_ADMIN . 'site')])];
}
function dcv_journal(int $n = 30): array
{
  $n = max(5, min(60, $n));
  $rows = array_reverse(dc_q("SELECT quand, type, message, appareil FROM journal ORDER BY id DESC LIMIT $n"));
  $lignes = array_map(fn($j) => date('d/m H:i', strtotime((string)$j['quand'])) . '  ' . str_pad(mb_strtoupper((string)$j['type']), 9) . str_replace('`', "'", (string)$j['message']), $rows);
  $blocs = dc_paquets($lignes, 1800);
  $embeds = [];
  foreach (array_slice($blocs, -3) as $i => $b) $embeds[] = dc_carte(['entete' => $i === 0 ? 'Journal · ' . count($rows) . ' dernières actions' : '', 'texte' => "```\n$b\n```", 'quand' => false, 'url' => $i === 0 ? DC_ADMIN . 'securite' : '']);
  return ['embeds' => $embeds ?: [dc_carte(['entete' => 'Journal', 'texte' => 'Vide.'])], 'components' => dc_lignes([dc_bouton('Actualiser', "v:journal:$n"), dc_lien('Accès & sécurité', DC_ADMIN . 'securite')])];
}
function dcv_recherche(string $q): array
{
  $q = trim($q);
  if (mb_strlen($q) < 2) return ['embeds' => [dc_carte(['entete' => 'Recherche', 'texte' => 'Tapez au moins 2 caractères.'])], 'components' => []];
  $l = '%' . $q . '%';
  $res = [];
  $opts = [];
  foreach (dc_q('SELECT id, nom, tel FROM clients WHERE nom LIKE ? OR tel LIKE ? OR email LIKE ? OR adresse LIKE ? LIMIT 6', [$l, $l, $l, $l]) as $c) { $res[] = 'Client · **' . dc_txt($c['nom'], 60) . '** ' . dc_txt($c['tel'], 20); $opts[] = dc_option('Client · ' . $c['nom'], 'client:' . $c['id']); }
  foreach (dc_q('SELECT id, nom, poste FROM agents WHERE nom LIKE ? OR tel LIKE ? OR carte LIKE ? LIMIT 6', [$l, $l, $l]) as $a) { $res[] = 'Agent · **' . dc_txt($a['nom'], 60) . '** ' . dc_txt($a['poste'], 30); $opts[] = dc_option('Agent · ' . $a['nom'], 'agent:' . $a['id']); }
  foreach (dc_q('SELECT id, type, numero, client, total FROM documents WHERE numero LIKE ? OR client LIKE ? ORDER BY date DESC LIMIT 6', [$l, $l]) as $d) { $res[] = ($d['type'] === 'facture' ? 'Facture' : 'Devis') . ' · `' . $d['numero'] . '` ' . dc_txt($d['client'], 50) . ' · ' . dc_eur((float)$d['total']); $opts[] = dc_option(($d['type'] === 'facture' ? 'Facture ' : 'Devis ') . $d['numero'], 'document:' . $d['id'], $d['client']); }
  foreach (dc_q('SELECT id, data, recu FROM demandes WHERE data LIKE ? ORDER BY id DESC LIMIT 5', [$l]) as $d) { $nom = dc_form(json_decode((string)$d['data'], true) ?: [], ['Nom / Société', 'Nom']); $res[] = "Demande · #{$d['id']} " . dc_txt($nom, 60) . ' · ' . dc_jour((string)$d['recu']); $opts[] = dc_option("Demande #{$d['id']} · $nom", 'demande:' . $d['id']); }
  foreach (dc_q('SELECT id, data FROM candidatures WHERE data LIKE ? ORDER BY id DESC LIMIT 4', [$l]) as $c) { $res[] = "Candidature · #{$c['id']}"; $opts[] = dc_option("Candidature #{$c['id']}", 'candidature:' . $c['id']); }
  foreach (dc_q('SELECT id, ref, data FROM reservations WHERE ref LIKE ? OR data LIKE ? ORDER BY id DESC LIMIT 4', [$l, $l]) as $r) { $res[] = 'VTC · `' . $r['ref'] . '`'; $opts[] = dc_option('VTC ' . $r['ref'], 'reservation:' . $r['id']); }
  foreach (dc_q('SELECT id, titre, acheteur FROM opportunites WHERE titre LIKE ? OR acheteur LIKE ? LIMIT 5', [$l, $l]) as $o) { $res[] = 'Veille · ' . dc_txt($o['titre'], 80) . ' · ' . dc_txt($o['acheteur'], 40); $opts[] = dc_option('Veille · ' . $o['acheteur'], 'opportunite:' . $o['id'], $o['titre']); }
  foreach (dc_q('SELECT id, prenom, nom FROM comptes_equipe WHERE nom LIKE ? OR prenom LIKE ? OR email LIKE ? OR identifiant LIKE ? LIMIT 4', [$l, $l, $l, $l]) as $c) { $res[] = 'Compte équipe · ' . dc_txt($c['prenom'] . ' ' . $c['nom'], 60); $opts[] = dc_option('Compte · ' . $c['prenom'] . ' ' . $c['nom'], 'compte:' . $c['id']); }
  return ['embeds' => [dc_carte(['entete' => 'Recherche', 'titre' => "« $q » · " . count($res) . ' résultat(s)', 'texte' => $res ? implode("\n", $res) : 'Aucun résultat.'])],
    'components' => $opts ? [dc_liste('s:ouvrir', 'Ouvrir un résultat…', $opts)] : []];
}
function dcv_aide(): array
{
  $cmd = [
    '/panel' => 'tous les boutons', '/tableau' => 'activité, finances, équipe, veille, site', '/demandes' => 'demandes de devis et de rappel', '/messages' => 'messagerie clients (répondre)',
    '/clients · /client' => 'liste et dossier complet', '/devis · /factures' => 'documents, accepter, marquer payée', '/ca' => 'chiffre d’affaires mois par mois',
    '/agents · /agent' => 'liste et dossier complet (documents en lien privé)', '/planning' => 'planning d’un jour', '/pointage' => 'qui est en service, heures',
    '/absences' => 'accepter ou refuser', '/incidents' => 'main courante', '/comptes' => 'valider les comptes de l’Espace équipe', '/candidatures · /avis · /vtc' => 'traiter en un clic',
    '/opportunites · /urgent · /veille' => 'veille commerciale', '/site' => 'maintenance, bandeau', '/recherche' => 'chercher partout', '/journal' => 'dernières actions',
    '/coffre' => 'identifiants et mots de passe', '/note' => 'note dans l’admin', '/sync' => 'tout mettre à jour', '/installer' => 'réparer le serveur',
  ];
  $l = [];
  foreach ($cmd as $c => $d) $l[] = "`$c` · $d";
  return ['embeds' => [dc_carte(['entete' => 'Mode d’emploi', 'titre' => 'Commandes du bot BDA', 'quand' => false, 'texte' => implode("\n", $l) . "\n\n"
    . "**Salons** · chaque nouveauté arrive dans son salon : demandes, messages, devis, factures, VTC, avis, candidatures, comptes, absences, main courante, pointages, appels d’offres, prospects.\n"
    . "**#journal** · tout ce qui se passe, ligne par ligne. **#securite** · connexions, refus, coffre-fort.\n"
    . "**Dossiers** · un fil par client et par agent, mis à jour automatiquement.\n"
    . 'Les réponses aux commandes et aux boutons ne sont visibles que par vous.'])], 'components' => []];
}
