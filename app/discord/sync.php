<?php
/* =========================================================
   DISCORD — remplissage automatique du serveur
   - file d'envoi : alertes (demandes, messages, équipe…) et lignes du journal ;
   - toutes les 30 min (tâche automatique) : panel, tableau de bord, annuaires,
     dossiers clients et agents (avec photo), planning du jour, rappels, rapports,
     état du site, mises en ligne (GitHub), coffre-fort.
   ========================================================= */
declare(strict_types=1);

require_once __DIR__ . '/vues.php';

// Catégorie de notification → salon
const DC_SALONS_NOTIF = [
  'demandes' => 'demandes', 'messages' => 'messages-clients', 'assistance' => 'assistant-site', 'espace_client' => 'activite-clients',
  'avis' => 'avis-clients', 'vtc' => 'reservations-vtc', 'candidatures' => 'candidatures', 'equipe' => 'comptes-equipe',
  'absences' => 'absences', 'incidents' => 'main-courante', 'pointages' => 'pointages', 'securite' => 'securite',
];

/* ---------- Envoi avec fichiers joints (photos) ---------- */
function dc_envoyer_fichiers(string $canal, array $message, array $fichiers): array
{
  $limite = '----bda' . bin2hex(random_bytes(8));
  $message = dc_message($message);
  $message['attachments'] = [];
  foreach (array_values($fichiers) as $n => $f) $message['attachments'][] = ['id' => $n, 'filename' => $f['nom']];
  $corps = "--$limite\r\nContent-Disposition: form-data; name=\"payload_json\"\r\nContent-Type: application/json\r\n\r\n" . json_encode($message, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\r\n";
  foreach (array_values($fichiers) as $n => $f) {
    $corps .= "--$limite\r\nContent-Disposition: form-data; name=\"files[$n]\"; filename=\"{$f['nom']}\"\r\nContent-Type: {$f['mime']}\r\n\r\n" . $f['octets'] . "\r\n";
  }
  $corps .= "--$limite--\r\n";
  $jeton = dc_jeton();
  try {
    $r = veille_http('POST', rtrim(veille_env('DISCORD_API_BASE') ?: 'https://discord.com/api/v10', '/') . "/channels/$canal/messages",
      ['Authorization: Bot ' . $jeton, 'User-Agent: DiscordBot (https://bdasecurite.com, 1.0)', 'Content-Type: multipart/form-data; boundary=' . $limite], $corps, 40);
  } catch (Throwable $e) {
    return ['ok' => false, 'id' => '', 'erreur' => $e->getMessage()];
  }
  $j = json_decode($r['corps'], true);
  $ok = $r['code'] >= 200 && $r['code'] < 300;
  return ['ok' => $ok, 'id' => (string)($j['id'] ?? ''), 'erreur' => $ok ? '' : dc_erreur($r['code'], $j)];
}

/* ---------- File d'envoi ---------- */
function dc_vider_file(int $max = 40): array
{
  $res = ['envoyes' => 0, 'erreurs' => 0];
  if (!dc_pret()) return $res;
  $verrou = @fopen(dossier_donnees() . '/discord.lock', 'c');
  if (!$verrou || !flock($verrou, LOCK_EX | LOCK_NB)) return $res + ['occupe' => true];
  try {
    $items = dc_q("SELECT * FROM dc_file WHERE etat = 'attente' ORDER BY id LIMIT " . max(1, $max));
    $lignes = [];
    $idsJournal = [];
    foreach ($items as $it) {
      $d = json_decode((string)$it['message'], true) ?: [];
      if (isset($d['journal'])) {
        $j = $d['journal'];
        $ligne = date('d/m H:i', strtotime((string)$j['q'])) . '  ' . str_pad(mb_strtoupper((string)$j['t']), 9) . str_replace('`', "'", (string)$j['m']) . (!empty($j['a']) ? '  [' . $j['a'] . ']' : '');
        foreach (dc_routes_journal((string)$j['t'], (string)$j['m']) as $salon) $lignes[$salon][] = $ligne;
        $idsJournal[] = (int)$it['id'];
        continue;
      }
      $salon = (string)$it['salon'];
      $fichiers = [];
      if (isset($d['notif'])) [$salon, $msg, $fichiers] = dc_message_notif($d['notif']);
      else $msg = $d;
      if ($salon === '' || !$msg) {
        db()->prepare("UPDATE dc_file SET etat = 'ignore', maj = ? WHERE id = ?")->execute([maintenant(), $it['id']]);
        continue;
      }
      $r = $fichiers ? dc_envoyer_fichiers(dc_salon($salon), $msg, $fichiers) : dc_envoyer($salon, $msg);
      if ($r['ok']) {
        db()->prepare("UPDATE dc_file SET etat = 'envoye', message_id = ?, maj = ? WHERE id = ?")->execute([$r['id'], maintenant(), $it['id']]);
        $res['envoyes']++;
      } else {
        db()->prepare("UPDATE dc_file SET essais = essais + 1, erreur = ?, etat = CASE WHEN essais + 1 >= 5 THEN 'erreur' ELSE 'attente' END, maj = ? WHERE id = ?")->execute([mb_substr($r['erreur'], 0, 500), maintenant(), $it['id']]);
        $res['erreurs']++;
      }
      usleep(250000);
    }
    // Lignes du journal : regroupées par salon, en blocs « console »
    foreach ($lignes as $salon => $ls) {
      foreach (dc_paquets($ls, 1880) as $bloc) {
        dc_envoyer($salon, ['content' => "```\n" . $bloc . "\n```"]);
        usleep(250000);
      }
    }
    if ($idsJournal) db()->exec("UPDATE dc_file SET etat = 'envoye' WHERE id IN (" . implode(',', $idsJournal) . ')');
    if (random_int(1, 30) === 1) db()->prepare("DELETE FROM dc_file WHERE cree < ? AND etat <> 'attente'")->execute([date('Y-m-d H:i:s', time() - 30 * 86400)]);
  } finally {
    flock($verrou, LOCK_UN);
    fclose($verrou);
  }
  return $res;
}
// Salons où recopier une ligne du journal (en plus de #journal)
function dc_routes_journal(string $type, string $m): array
{
  $s = ['journal'];
  if (in_array($type, ['acces', 'alerte', 'securite'], true)) $s[] = 'securite';
  if ($type === 'document' && preg_match('/^Devis .*(créé|supprimé|: |PDF joint|envoyé dans|retiré de)/u', $m) && !str_contains($m, 'ACCEPTÉ EN LIGNE')) $s[] = 'devis';
  if ($type === 'document' && preg_match('/^Facture .*(créée|supprimée|: |PDF joint|envoyée? dans|retirée? de)/u', $m)) $s[] = 'factures';
  if ($type === 'document' && str_starts_with($m, 'Fiche de paie')) $s[] = 'documents-agents';
  if ($type === 'vtc' && str_starts_with($m, 'Réservation')) $s[] = 'reservations-vtc';
  if ($type === 'site' && str_starts_with($m, 'Avis de')) $s[] = 'avis-clients';
  if ($type === 'equipe' && str_starts_with($m, 'Absence de')) $s[] = 'absences';
  if ($type === 'equipe' && preg_match('/^Espace équipe : compte de .* (validé|refusé|suspendu|réactivé|supprimé|relié)/u', $m)) $s[] = 'comptes-equipe';
  if ($type === 'equipe' && preg_match('/^(Agent ajouté|Agent supprimé|Lien de pointage|Bulletin de paie|Dossier de paie)/u', $m)) $s[] = 'documents-agents';
  if ($type === 'site' && preg_match('/(SITE MIS HORS LIGNE|remis en ligne|Bandeau|sur le site|Rubriques visibles|Tarifs du site|Accueil du site|intelligence artificielle)/u', $m)) $s[] = 'etat-du-site';
  return array_values(array_unique($s));
}
// Construit le message riche d'une notification (salon, message, fichiers joints)
function dc_message_notif(array $n): array
{
  $cat = (string)($n['categorie'] ?? '');
  $tag = (string)($n['tag'] ?? '');
  $titre = (string)($n['titre'] ?? '');
  $ref = fn(string $prefixe) => str_starts_with($tag, $prefixe) ? substr($tag, strlen($prefixe)) : '';
  $simple = fn(int $couleur = DC_OR) => ['embeds' => [dc_carte(['entete' => NOTIF_CATEGORIES[$cat][0] ?? 'Notification', 'titre' => $titre, 'couleur' => $couleur,
    'texte' => dc_txt((string)(($n['detail'] ?? '') !== '' ? $n['detail'] : ($n['texte'] ?? '')), 1500), 'url' => 'https://bdasecurite.com' . ($n['url'] ?? '/admin/')])],
    'components' => dc_lignes([dc_lien('Ouvrir dans l’admin', 'https://bdasecurite.com' . ($n['url'] ?? '/admin/'))])];
  $salon = DC_SALONS_NOTIF[$cat] ?? 'journal';
  $msg = null;
  $fichiers = [];
  switch ($cat) {
    case 'demandes':
      $msg = ($id = (int)$ref('demande-')) ? dcv_demande($id, 'Nouvelle demande de devis') : $simple();
      break;
    case 'candidatures':
      $msg = ($id = (int)$ref('candidature-')) ? dcv_candidature($id) : $simple();
      break;
    case 'avis':
      $msg = ($id = (int)$ref('avis-')) ? dcv_avis_un($id) : $simple();
      break;
    case 'vtc':
      $r = dc_un('SELECT id FROM reservations WHERE ref = ?', [$ref('vtc-')]);
      $msg = $r ? dcv_reservation((int)$r['id'], str_contains($titre, 'annulée') ? 'Annulée par le client' : 'Nouvelle réservation VTC') : $simple();
      break;
    case 'assistance':
      $msg = ($id = (int)$ref('assist-')) ? dcv_assistance($id, $titre) : $simple();
      break;
    case 'messages':
      $m = dc_un("SELECT client_id FROM messages_clients WHERE auteur = 'client' ORDER BY id DESC LIMIT 1");
      $msg = $m ? dcv_conversation((int)$m['client_id'], 'Nouveau message client') : $simple();
      break;
    case 'espace_client':
      if ($id = (int)$ref('devis-')) { $salon = 'devis'; $msg = dcv_document($id, 'Accepté en ligne par le client'); }
      elseif ($id = (int)$ref('doc-vu-')) $msg = dcv_document($id, 'Ouvert par le client');
      else $msg = $simple();
      break;
    case 'equipe':
      if ($tag === 'eq-inscription') {
        $c = dc_un("SELECT id FROM comptes_equipe WHERE statut = 'attente' ORDER BY id DESC LIMIT 1");
        $msg = $c ? dcv_compte((int)$c['id'], 'Demande d’accès à l’Espace équipe') : $simple();
      } elseif ($tag === 'eq-doc') {
        $salon = 'documents-agents';
        $d = dc_un("SELECT id FROM agent_docs WHERE source = 'agent' ORDER BY id DESC LIMIT 1");
        $msg = $d ? dcv_doc_agent((int)$d['id']) : $simple();
      } else $msg = $simple(DC_GRIS);
      break;
    case 'absences':
      $a = str_contains($titre, 'annulée') ? dc_un("SELECT id FROM absences WHERE statut = 'annulee' ORDER BY traite DESC LIMIT 1") : dc_un('SELECT id FROM absences ORDER BY id DESC LIMIT 1');
      $msg = $a ? dcv_absence((int)$a['id'], $titre) : $simple();
      break;
    case 'incidents':
      $m = dc_un('SELECT id, gravite, photos FROM main_courante ORDER BY id DESC LIMIT 1');
      if ($m) {
        $msg = dcv_incident((int)$m['id']);
        if ($m['gravite'] === 'urgente' && !empty(dc_config()['roles']['direction'])) {
          $role = dc_config()['roles']['direction'];
          $msg['content'] = "<@&$role> **INCIDENT URGENT**";
          $msg['allowed_mentions'] = ['parse' => [], 'roles' => [$role]];
        }
        // Photos de la main courante jointes au message
        foreach (array_slice(json_decode((string)$m['photos'], true) ?: [], 0, 4) as $k => $ph) {
          $chemin = dossier_donnees() . '/equipe/main-courante/' . basename((string)($ph['f'] ?? ''));
          if (is_file($chemin) && filesize($chemin) < 8 * 1048576) $fichiers[] = ['nom' => 'photo-' . ($k + 1) . '.' . (str_contains((string)$ph['m'], 'png') ? 'png' : (str_contains((string)$ph['m'], 'webp') ? 'webp' : 'jpg')), 'mime' => (string)$ph['m'], 'octets' => (string)file_get_contents($chemin)];
        }
      } else $msg = $simple(DC_ROUGE);
      break;
    case 'pointages':
      $p = str_starts_with($titre, 'Fin') ? dc_un("SELECT id FROM pointages WHERE fin <> '' ORDER BY fin DESC LIMIT 1") : dc_un('SELECT id FROM pointages ORDER BY debut DESC, id DESC LIMIT 1');
      $msg = $p ? dcv_pointage_un((int)$p['id'], $titre) : $simple();
      break;
    case 'securite':
      $msg = $simple(str_contains($titre, 'refusée') ? DC_ROUGE : DC_GRIS);
      break;
    default:
      $msg = $simple();
  }
  return [$salon, $msg, $fichiers];
}

/* ---------- Tâche automatique (toutes les 30 minutes) ---------- */
function dc_cron(bool $force = false): array
{
  $journal = [];
  if (!dc_pret()) return ['Discord non configuré.'];
  @set_time_limit(280);
  $etapes = [
    'File d’envoi' => fn() => (($r = dc_vider_file(60)) ? $r['envoyes'] . ' message(s) envoyé(s)' . ($r['erreurs'] ? ', ' . $r['erreurs'] . ' en erreur' : '') : ''),
    'Panel' => fn() => dc_fixe('panel', 'panel', dcv_panel(), true) ? 'à jour' : 'non publié',
    'Tableau de bord' => fn() => dc_fixe('tableau', 'tableau-de-bord', dcv_tableau(), true) ? 'à jour' : 'non publié',
    'Annuaires' => fn() => dc_annuaires(),
    'Dossiers clients' => fn() => dc_sync_dossiers('client', $force ? 80 : 15),
    'Dossiers agents' => fn() => dc_sync_dossiers('agent', $force ? 80 : 15),
    'Planning du jour' => fn() => dc_planning_quotidien($force),
    'Rappels' => fn() => dc_rappels_quotidiens($force),
    'Rapports' => fn() => dc_rapports(),
    'État du site' => fn() => dc_etat_site(),
    'Mises en ligne' => fn() => dc_deploiements(),
    'Coffre-fort' => fn() => $force ? coffre_publier() : '',
  ];
  foreach ($etapes as $nom => $f) {
    try {
      $r = $f();
      if ($r !== '' && $r !== null) $journal[] = "$nom : $r";
    } catch (Throwable $e) {
      error_log("[BDA discord $nom] " . $e->getMessage());
      $journal[] = "$nom : erreur (" . $e->getMessage() . ')';
    }
  }
  dc_config_maj(['synchro' => maintenant()]);
  return $journal;
}

/* ---------- Annuaires (messages fixes, découpés si besoin) ---------- */
function dc_annuaires(): string
{
  $clients = [];
  foreach (dc_q('SELECT c.*, (SELECT COUNT(*) FROM documents d WHERE d.type = \'facture\' AND lower(trim(d.client)) = lower(trim(c.nom)) AND d.statut IN (\'envoyee\', \'payee\')) AS nf,
      (SELECT COALESCE(SUM(total), 0) FROM documents d WHERE d.type = \'facture\' AND lower(trim(d.client)) = lower(trim(c.nom)) AND d.statut IN (\'envoyee\', \'payee\')) AS ca,
      (SELECT COALESCE(SUM(total), 0) FROM documents d WHERE d.type = \'facture\' AND lower(trim(d.client)) = lower(trim(c.nom)) AND d.statut = \'envoyee\') AS du,
      (SELECT actif FROM comptes_clients cc WHERE cc.client_id = c.id) AS espace FROM clients c ORDER BY c.nom COLLATE NOCASE') as $c) {
    $clients[] = '**' . dc_txt($c['nom'], 60) . '**' . ($c['tel'] ? ' · ' . dc_txt($c['tel'], 20) : '') . ($c['email'] ? ' · ' . dc_txt($c['email'], 60) : '')
      . ' · CA ' . dc_eur((float)$c['ca']) . ((float)$c['du'] > 0 ? ' · **à payer ' . dc_eur((float)$c['du']) . '**' : '') . ($c['espace'] !== null ? ' · espace ' . ((int)$c['espace'] ? 'actif' : 'désactivé') : '');
  }
  $n1 = dc_publier_liste('annuaire-clients', 'annuaire-clients', 'Annuaire clients · ' . count($clients), $clients, DC_ADMIN . 'clients');

  $docs = [];
  foreach (dc_q('SELECT agent_id, type FROM agent_docs') as $d) $docs[(int)$d['agent_id']][$d['type']] = true;
  $agents = [];
  foreach (dc_q('SELECT a.*, (SELECT statut FROM comptes_equipe ce WHERE ce.agent_id = a.id ORDER BY id DESC LIMIT 1) AS espace FROM agents a ORDER BY a.actif DESC, a.nom COLLATE NOCASE') as $a) {
    $manque = array_values(array_filter(DC_DOCS_OBLIGATOIRES, fn($t) => empty($docs[(int)$a['id']][$t])));
    $v = (string)$a['validite'];
    $agents[] = ((int)$a['actif'] ? '' : '~~') . '**' . dc_txt($a['nom'], 60) . '**' . ((int)$a['actif'] ? '' : '~~') . ' · ' . dc_txt($a['poste'], 30) . ($a['tel'] ? ' · ' . dc_txt($a['tel'], 20) : '')
      . ' · carte ' . ($a['carte'] !== '' ? '`' . dc_txt($a['carte'], 30) . '`' : '?') . ($v !== '' ? ' → ' . dc_jour($v) . ($v <= date('Y-m-d', strtotime('+60 days')) ? ' **(' . dc_jx($v) . ')**' : '') : '')
      . ($manque ? ' · manque : ' . implode(', ', array_map(fn($t) => DC_DOCS[$t], $manque)) : ' · dossier complet')
      . ($a['espace'] ? ' · espace ' . mb_strtolower(dc_statut((string)$a['espace'])) : '');
  }
  $n2 = dc_publier_liste('annuaire-agents', 'annuaire-agents', 'Annuaire agents · ' . count($agents), $agents, DC_ADMIN . 'agents');
  return "$n1 message(s) clients, $n2 message(s) agents";
}
// Publie une longue liste en messages fixes successifs (10 cartes de 3 900 caractères au plus par message)
function dc_publier_liste(string $prefixe, string $salon, string $titre, array $lignes, string $url): int
{
  $blocs = dc_paquets($lignes ?: ['Vide.'], 3900);
  $messages = array_chunk($blocs, 1);
  $n = 0;
  foreach ($messages as $k => $groupe) {
    $embeds = [];
    foreach ($groupe as $j => $b) $embeds[] = dc_carte(['entete' => $k === 0 && $j === 0 ? $titre : '', 'texte' => $b, 'url' => $k === 0 ? $url : '', 'quand' => false]);
    $embeds[count($embeds) - 1]['footer'] = ['text' => 'mis à jour ' . date('d/m/Y H:i')];
    $hash = sha1((string)json_encode($embeds));
    $cle = $prefixe . '-' . ($k + 1);
    if ((dc_config()['empreintes'][$cle] ?? '') !== $hash) {
      dc_fixe($cle, $salon, ['embeds' => $embeds, 'components' => []]);
      $e = dc_config()['empreintes'] ?? [];
      $e[$cle] = $hash;
      dc_config_maj(['empreintes' => $e]);
    }
    $n++;
  }
  dc_fixes_nettoyer($prefixe, $n);
  return $n;
}

/* ---------- Dossiers : un fil (forum) par client et par agent ---------- */
function dc_sync_dossiers(string $type, int $max = 15): string
{
  $salonCle = $type === 'client' ? 'dossiers-clients' : 'dossiers-agents';
  $salon = dc_salon($salonCle);
  if ($salon === '') return 'salon absent';
  $forum = (int)(dc_config()['types'][$salonCle] ?? 0) === 15;
  $liste = $type === 'client' ? dc_q('SELECT id, nom FROM clients ORDER BY nom COLLATE NOCASE') : dc_q('SELECT id, nom, poste, actif FROM agents ORDER BY actif DESC, nom COLLATE NOCASE');
  $connus = [];
  foreach (dc_q('SELECT * FROM dc_fils WHERE type = ?', [$type]) as $f) $connus[$f['ref']] = $f;
  $faits = 0;
  $crees = 0;
  foreach ($liste as $x) {
    $ref = (string)$x['id'];
    $f = $connus[$ref] ?? null;
    unset($connus[$ref]);
    if ($faits >= $max) continue;
    $msg = $type === 'client' ? dcv_client((int)$x['id']) : dcv_agent((int)$x['id']);
    $nomFil = dc_couper($type === 'client' ? (string)$x['nom'] : $x['nom'] . ' · ' . $x['poste'] . ((int)$x['actif'] ? '' : ' (inactif)'), 100);
    // l'empreinte ignore l'heure de mise à jour affichée ; sa fin permet de savoir si le nom du fil a changé
    $empNom = sha1($nomFil);
    $emp = sha1((string)json_encode([$msg['embeds'][0] ?? [], array_slice($msg['embeds'], 1, -1), array_diff_key($msg['embeds'][count($msg['embeds']) - 1] ?? [], ['footer' => 1, 'timestamp' => 1]), $msg['components'] ?? []])) . '|' . $empNom;
    if ($f && $f['empreinte'] === $emp && $f['canal'] === $salon) continue;
    $faits++;
    if ($f && $f['canal'] === $salon && $f['message'] !== '') {
      $cible = $forum ? $f['fil'] : $salon;
      $r = dc_modifier($cible, $f['message'], $msg);
      if (!$r['ok'] && $forum && $r['code'] !== 404) {
        dc_api('PATCH', "/channels/{$f['fil']}", ['archived' => false]);
        $r = dc_modifier($cible, $f['message'], $msg);
      }
      if ($r['ok']) {
        if ($forum && $f['empreinte'] !== '' && !str_ends_with((string)$f['empreinte'], '|' . $empNom)) dc_api('PATCH', "/channels/{$f['fil']}", ['name' => $nomFil]);
        db()->prepare('UPDATE dc_fils SET empreinte = ?, maj = ? WHERE type = ? AND ref = ?')->execute([$emp, maintenant(), $type, $ref]);
        if ($type === 'agent') dc_photo_dossier((int)$x['id'], (string)$f['fil']);
        continue;
      }
      if ($r['code'] !== 404) continue; // erreur passagère : nouvel essai au prochain passage
    }
    // Création du dossier
    if ($forum) {
      $r = dc_api('POST', "/channels/$salon/threads", ['name' => $nomFil, 'auto_archive_duration' => 10080, 'message' => dc_message($msg)]);
      $fil = (string)($r['json']['id'] ?? '');
      $message = $fil;
    } else {
      $r = dc_api('POST', "/channels/$salon/messages", dc_message($msg));
      $fil = '';
      $message = (string)($r['json']['id'] ?? '');
    }
    if (!$r['ok']) { error_log('[BDA discord dossier] ' . $r['erreur']); continue; }
    db()->prepare('INSERT OR REPLACE INTO dc_fils (type, ref, canal, fil, message, empreinte, maj) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute([$type, $ref, $salon, $fil, $message, $emp, maintenant()]);
    $crees++;
    if ($type === 'agent' && $fil !== '') dc_photo_dossier((int)$x['id'], $fil);
    usleep(400000);
  }
  // Fiches supprimées dans l'admin : leur dossier disparaît aussi
  foreach ($connus as $ref => $f) {
    dc_api('DELETE', '/channels/' . ($f['fil'] !== '' ? $f['fil'] : $f['canal'] . '/messages/' . $f['message']));
    db()->prepare('DELETE FROM dc_fils WHERE type = ? AND ref = ?')->execute([$type, $ref]);
  }
  return count($liste) . ' dossier(s)' . ($crees ? ", $crees créé(s)" : '') . ($faits - $crees > 0 ? ', ' . ($faits - $crees) . ' mis à jour' : '');
}
function dc_sync_un(string $type, int $id): void
{
  $f = dc_un('SELECT * FROM dc_fils WHERE type = ? AND ref = ?', [$type, (string)$id]);
  if ($f) db()->prepare("UPDATE dc_fils SET empreinte = '' WHERE type = ? AND ref = ?")->execute([$type, (string)$id]);
  dc_sync_dossiers($type, 200);
}
// Photo de la carte professionnelle publiée dans le fil de l'agent (remplacée si elle change)
function dc_photo_dossier(int $agentId, string $fil): void
{
  if ($fil === '') return;
  $a = dc_un('SELECT * FROM agents WHERE id = ?', [$agentId]);
  $photo = $a ? dc_photo_agent($a) : null;
  $connu = dc_un("SELECT * FROM dc_fils WHERE type = 'photo' AND ref = ?", [(string)$agentId]);
  $emp = $photo ? sha1($photo['octets']) : '';
  if (($connu['empreinte'] ?? '') === $emp) return;
  if ($connu && $connu['message'] !== '') dc_api('DELETE', "/channels/$fil/messages/{$connu['message']}");
  if (!$photo) {
    db()->prepare("DELETE FROM dc_fils WHERE type = 'photo' AND ref = ?")->execute([(string)$agentId]);
    return;
  }
  $nom = 'photo-agent.' . $photo['ext'];
  $r = dc_envoyer_fichiers($fil, ['embeds' => [['title' => 'Photo · ' . $a['nom'], 'color' => DC_OR, 'image' => ['url' => 'attachment://' . $nom], 'footer' => ['text' => 'Photo de la carte professionnelle (Cartes & flyers)']]]], [['nom' => $nom, 'mime' => $photo['mime'], 'octets' => $photo['octets']]]);
  if ($r['ok']) db()->prepare('INSERT OR REPLACE INTO dc_fils (type, ref, canal, fil, message, empreinte, maj) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute(['photo', (string)$agentId, $fil, $fil, $r['id'], $emp, maintenant()]);
}

/* ---------- Planning du jour (chaque matin à partir de 6 h, mis à jour s'il change) ---------- */
function dc_planning_quotidien(bool $force = false): string
{
  if ((int)date('G') < 6 && !$force) return '';
  $jour = date('Y-m-d');
  $m = dcv_planning($jour);
  $m['components'] = dc_lignes([dc_bouton('Qui est en service', 'v:pointage'), dc_lien('Planning dans l’admin', DC_ADMIN . 'planning')]);
  $emp = sha1((string)json_encode($m));
  $c = dc_config()['planning'] ?? [];
  if (($c['jour'] ?? '') === $jour && ($c['empreinte'] ?? '') === $emp) return '';
  if (($c['jour'] ?? '') === $jour && !empty($c['id'])) {
    dc_modifier(dc_salon('planning'), (string)$c['id'], $m);
    $id = (string)$c['id'];
  } else {
    $id = dc_envoyer('planning', $m)['id'];
  }
  dc_config_maj(['planning' => ['jour' => $jour, 'id' => $id, 'empreinte' => $emp]]);
  return 'publié';
}

/* ---------- Rappels (chaque jour à partir de 8 h) ---------- */
function dc_rappels_quotidiens(bool $force = false): string
{
  $jour = date('Y-m-d');
  if (((int)date('G') < 8 || (dc_config()['rappels'] ?? '') === $jour) && !$force) return '';
  $champs = [];
  $retards = dc_q("SELECT numero, client, total, echeance FROM documents WHERE type = 'facture' AND statut = 'envoyee' AND echeance <> '' AND echeance < ? ORDER BY echeance", [$jour]);
  if ($retards) $champs[] = dc_champ('Factures en retard · ' . dc_eur(array_sum(array_map(fn($d) => (float)$d['total'], $retards))), implode("\n", array_map(fn($d) => '`' . $d['numero'] . '` · ' . dc_txt($d['client'], 40) . ' · ' . dc_eur((float)$d['total']) . ' · ' . dc_jx((string)$d['echeance']), array_slice($retards, 0, 12))), false);
  $echeance = dc_q("SELECT numero, client, total, echeance FROM documents WHERE type = 'facture' AND statut = 'envoyee' AND echeance >= ? AND echeance <= ? ORDER BY echeance", [$jour, date('Y-m-d', strtotime('+7 days'))]);
  if ($echeance) $champs[] = dc_champ('Factures à échéance cette semaine', implode("\n", array_map(fn($d) => '`' . $d['numero'] . '` · ' . dc_txt($d['client'], 40) . ' · ' . dc_eur((float)$d['total']) . ' · ' . dc_jx((string)$d['echeance']), $echeance)), false);
  $devis = dc_q("SELECT numero, client, total, maj FROM documents WHERE type = 'devis' AND statut = 'envoye' AND maj <= ? ORDER BY maj", [date('Y-m-d H:i:s', strtotime('-10 days'))]);
  if ($devis) $champs[] = dc_champ('Devis sans réponse depuis 10 jours · relancer', implode("\n", array_map(fn($d) => '`' . $d['numero'] . '` · ' . dc_txt($d['client'], 40) . ' · ' . dc_eur((float)$d['total']) . ' · envoyé ' . dc_quand((string)$d['maj'], 'R'), array_slice($devis, 0, 10))), false);
  $cartes = dc_q("SELECT nom, validite FROM agents WHERE actif = 1 AND validite <> '' AND validite <= ? ORDER BY validite", [date('Y-m-d', strtotime('+60 days'))]);
  if ($cartes) $champs[] = dc_champ('Cartes professionnelles à renouveler', implode("\n", array_map(fn($a) => dc_txt($a['nom'], 60) . ' · ' . dc_jour((string)$a['validite']) . ' (' . dc_jx((string)$a['validite']) . ')', $cartes)), false);
  $docs = [];
  foreach (dc_q('SELECT agent_id, type FROM agent_docs') as $d) $docs[(int)$d['agent_id']][$d['type']] = true;
  $manques = [];
  foreach (dc_q('SELECT id, nom FROM agents WHERE actif = 1 ORDER BY nom') as $a) {
    $m = array_values(array_filter(DC_DOCS_OBLIGATOIRES, fn($t) => empty($docs[(int)$a['id']][$t])));
    if ($m) $manques[] = dc_txt($a['nom'], 50) . ' · ' . implode(', ', array_map(fn($t) => DC_DOCS[$t], $m));
  }
  if ($manques) $champs[] = dc_champ('Documents obligatoires manquants', implode("\n", array_slice($manques, 0, 15)), false);
  $attente = [
    [(int)dc_n("SELECT COUNT(*) FROM demandes WHERE statut = 'nouvelle'"), 'demande(s) de devis'], [(int)dc_n("SELECT COUNT(*) FROM absences WHERE statut = 'attente'"), 'absence(s) à traiter'],
    [(int)dc_n("SELECT COUNT(*) FROM comptes_equipe WHERE statut = 'attente'"), 'compte(s) à valider'], [(int)dc_n("SELECT COUNT(*) FROM main_courante WHERE statut = 'nouveau'"), 'main(s) courante(s) non lue(s)'],
    [(int)dc_n("SELECT COUNT(*) FROM reservations WHERE statut = 'attente'"), 'réservation(s) VTC à confirmer'], [(int)dc_n("SELECT COUNT(*) FROM messages_clients WHERE auteur = 'client' AND lu = 0"), 'message(s) client non lu(s)'],
  ];
  $l = array_map(fn($x) => "{$x[0]} {$x[1]}", array_filter($attente, fn($x) => $x[0] > 0));
  if ($l) $champs[] = dc_champ('En attente', implode("\n", $l), false);
  $ao = dc_q("SELECT titre, acheteur, date_limite FROM opportunites WHERE source = 'boamp' AND statut <> 'ignore' AND date_limite >= ? AND date_limite <= ? ORDER BY date_limite", [maintenant(), date('Y-m-d 23:59:59', strtotime('+7 days'))]);
  if ($ao) $champs[] = dc_champ('Appels d’offres qui se terminent sous 7 jours', implode("\n", array_map(fn($o) => dc_jx((string)$o['date_limite']) . ' · ' . dc_txt($o['titre'], 80) . ' · ' . dc_txt($o['acheteur'], 40), array_slice($ao, 0, 8))), false);
  dc_config_maj(['rappels' => $jour]);
  dc_envoyer('rappels', ['embeds' => [dc_carte(['entete' => 'Rappels du jour', 'titre' => ucfirst(dc_jour_long($jour)), 'couleur' => $retards || $cartes ? DC_ORANGE : DC_VERT,
    'texte' => $champs ? 'Ce qui demande votre attention aujourd’hui :' : 'Rien d’urgent aujourd’hui.', 'champs' => $champs])], 'components' => dc_lignes([dc_bouton('Tableau de bord', 'v:tableau'), dc_lien('Ouvrir l’admin', DC_ADMIN)])]);
  return 'publiés';
}
function dc_jour_long(string $jour): string
{
  $j = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][(int)date('w', strtotime($jour))];
  $m = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][(int)date('n', strtotime($jour)) - 1];
  return "$j " . (int)date('j', strtotime($jour)) . " $m " . date('Y', strtotime($jour));
}

/* ---------- Rapports : la journée (chaque soir à partir de 21 h), la semaine (le lundi) ---------- */
function dc_rapports(): string
{
  $fait = [];
  $c = dc_config();
  $jour = date('Y-m-d');
  if ((int)date('G') >= 21 && ($c['rapport_jour'] ?? '') !== $jour) {
    dc_envoyer('rapports', dc_rapport($jour . ' 00:00:00', $jour . ' 23:59:59', 'Rapport du ' . dc_jour_long($jour)));
    dc_config_maj(['rapport_jour' => $jour]);
    $fait[] = 'journée';
  }
  $semaine = date('o-W');
  if (date('N') === '1' && (int)date('G') >= 8 && ($c['rapport_semaine'] ?? '') !== $semaine) {
    $du = date('Y-m-d', strtotime('monday last week'));
    $au = date('Y-m-d', strtotime('sunday last week'));
    dc_envoyer('rapports', dc_rapport($du . ' 00:00:00', $au . ' 23:59:59', 'Rapport de la semaine du ' . dc_jour($du) . ' au ' . dc_jour($au)));
    dc_config_maj(['rapport_semaine' => $semaine]);
    $fait[] = 'semaine';
  }
  return implode(', ', $fait);
}
function dc_rapport(string $du, string $au, string $titre): array
{
  $n = fn(string $sql) => (int)dc_n($sql, [$du, $au]);
  $s = fn(string $sql) => (float)dc_n($sql, [$du, $au]);
  $minutes = 0;
  $parAgent = [];
  foreach (dc_q("SELECT a.nom, p.debut, p.fin FROM pointages p JOIN agents a ON a.id = p.agent_id WHERE p.debut >= ? AND p.debut <= ?", [$du, $au]) as $p) {
    $m = max(0, (int)round((($p['fin'] !== '' ? strtotime($p['fin']) : time()) - strtotime($p['debut'])) / 60));
    $minutes += $m;
    $parAgent[$p['nom']] = ($parAgent[$p['nom']] ?? 0) + $m;
  }
  arsort($parAgent);
  return ['embeds' => [dc_carte(['entete' => 'Rapport', 'titre' => $titre, 'champs' => [
    dc_champ('Demandes reçues', (string)$n('SELECT COUNT(*) FROM demandes WHERE recu >= ? AND recu <= ?')),
    dc_champ('Messages clients', (string)$n("SELECT COUNT(*) FROM messages_clients WHERE auteur = 'client' AND cree >= ? AND cree <= ?")),
    dc_champ('Conversations assistant', (string)$n('SELECT COUNT(*) FROM assist_conv WHERE cree >= ? AND cree <= ?')),
    dc_champ('Devis créés', (string)$n("SELECT COUNT(*) FROM documents WHERE type = 'devis' AND cree >= ? AND cree <= ?")),
    dc_champ('Devis acceptés', (string)$n("SELECT COUNT(*) FROM documents WHERE type = 'devis' AND statut = 'accepte' AND maj >= ? AND maj <= ?")),
    dc_champ('Factures émises', dc_eur($s("SELECT COALESCE(SUM(total), 0) FROM documents WHERE type = 'facture' AND statut IN ('envoyee', 'payee') AND cree >= ? AND cree <= ?"))),
    dc_champ('Factures payées', dc_eur($s("SELECT COALESCE(SUM(total), 0) FROM documents WHERE type = 'facture' AND statut = 'payee' AND maj >= ? AND maj <= ?"))),
    dc_champ('Réservations VTC', (string)$n('SELECT COUNT(*) FROM reservations WHERE recu >= ? AND recu <= ?')),
    dc_champ('Candidatures', (string)$n('SELECT COUNT(*) FROM candidatures WHERE recu >= ? AND recu <= ?')),
    dc_champ('Heures pointées', dc_duree($minutes)),
    dc_champ('Main courante', (string)$n('SELECT COUNT(*) FROM main_courante WHERE cree >= ? AND cree <= ?')),
    dc_champ('Absences demandées', (string)$n('SELECT COUNT(*) FROM absences WHERE cree >= ? AND cree <= ?')),
    dc_champ('Nouvelles opportunités', (string)$n('SELECT COUNT(*) FROM opportunites WHERE cree >= ? AND cree <= ?')),
    dc_champ('Connexions à l’admin', (string)$n('SELECT COUNT(*) FROM connexions WHERE debut >= ? AND debut <= ?')),
    dc_champ('Alertes de sécurité', (string)$n("SELECT COUNT(*) FROM journal WHERE type = 'alerte' AND quand >= ? AND quand <= ?")),
    dc_champ('Heures par agent', $parAgent ? implode("\n", array_map(fn($k, $v) => dc_txt($k, 50) . ' · ' . dc_duree($v), array_keys(array_slice($parAgent, 0, 15, true)), array_slice($parAgent, 0, 15, true))) : 'Aucune', false),
  ]])]];
}

/* ---------- État du site (vérifié à chaque passage, alerte quand il change) ---------- */
function dc_etat_site(): string
{
  $verifs = [];
  $t0 = microtime(true);
  try {
    $r = veille_http('GET', DC_SITE . '/', ['User-Agent: BDA-Surveillance/1.0'], null, 20);
    $verifs['accueil'] = ['ok' => $r['code'] === 200, 'txt' => 'HTTP ' . $r['code'] . ' en ' . round((microtime(true) - $t0) * 1000) . ' ms'];
  } catch (Throwable $e) {
    $verifs['accueil'] = ['ok' => false, 'txt' => $e->getMessage()];
  }
  try {
    $r = veille_http('GET', DC_SITE . '/api/site.php', ['User-Agent: BDA-Surveillance/1.0'], null, 20);
    $verifs['api'] = ['ok' => $r['code'] === 200 && str_contains($r['corps'], '"ok":true'), 'txt' => 'HTTP ' . $r['code']];
  } catch (Throwable $e) {
    $verifs['api'] = ['ok' => false, 'txt' => $e->getMessage()];
  }
  $jours = null;
  $ctx = stream_context_create(['ssl' => ['capture_peer_cert' => true, 'verify_peer' => true, 'SNI_enabled' => true, 'peer_name' => 'bdasecurite.com']]);
  $sock = @stream_socket_client('ssl://bdasecurite.com:443', $errno, $errstr, 10, STREAM_CLIENT_CONNECT, $ctx);
  if ($sock) {
    $cert = stream_context_get_params($sock)['options']['ssl']['peer_certificate'] ?? null;
    $info = $cert ? openssl_x509_parse($cert) : null;
    if ($info) $jours = (int)floor(((int)$info['validTo_time_t'] - time()) / 86400);
    fclose($sock);
  }
  $verifs['ssl'] = ['ok' => $jours === null || $jours > 14, 'txt' => $jours === null ? 'non vérifié' : "expire dans $jours jour(s)"];
  $hl = site_hors_ligne();
  $verifs['maintenance'] = ['ok' => !$hl, 'txt' => $hl ? 'EN MAINTENANCE depuis ' . dc_jour((string)($hl['depuis'] ?? '')) : 'non'];
  $etat = json_decode((string)(dc_un("SELECT v FROM reglages WHERE k = 'veille_etat'")['v'] ?? ''), true) ?: [];
  foreach (['boamp' => 'Veille BOAMP', 'francetravail' => 'Veille France Travail'] as $k => $lib) {
    $s = $etat['sources'][$k] ?? null;
    if ($s) $verifs[$k] = ['ok' => (bool)$s['ok'], 'txt' => ($s['ok'] ? 'OK' : 'ERREUR : ' . mb_substr((string)$s['message'], 0, 120)) . ' · ' . dc_quand((string)$s['quand'], 'R')];
  }
  $file = dc_un("SELECT SUM(etat = 'attente') a, SUM(etat = 'erreur') e FROM dc_file") ?? ['a' => 0, 'e' => 0];
  $verifs['discord'] = ['ok' => (int)$file['e'] === 0, 'txt' => (int)$file['a'] . ' en attente · ' . (int)$file['e'] . ' en erreur'];
  $libs = ['accueil' => 'Page d’accueil', 'api' => 'API du site', 'ssl' => 'Certificat HTTPS', 'maintenance' => 'Maintenance', 'boamp' => 'Veille BOAMP', 'francetravail' => 'Veille France Travail', 'discord' => 'Envois Discord'];
  $champs = [];
  foreach ($verifs as $k => $v) $champs[] = dc_champ(($v['ok'] ? '✓ ' : '✗ ') . ($libs[$k] ?? $k), $v['txt']);
  $champs[] = dc_champ('Données', number_format((@filesize(dossier_donnees() . '/gestion.sqlite') ?: 0) / 1048576, 1, ',', ' ') . ' Mo · PHP ' . PHP_VERSION . (function_exists('sodium_crypto_sign_verify_detached') ? '' : ' · sodium absent'));
  $champs[] = dc_champ('Dernière vérification', dc_quand(maintenant(), 'R'));
  $ko = array_keys(array_filter($verifs, fn($v) => !$v['ok']));
  dc_fixe('etat', 'etat-du-site', ['embeds' => [dc_carte(['entete' => 'État du site', 'titre' => $ko ? count($ko) . ' point(s) à vérifier' : 'Tout fonctionne', 'couleur' => $ko ? DC_ROUGE : DC_VERT, 'url' => DC_SITE, 'champs' => $champs, 'quand' => false])], 'components' => dc_lignes([dc_bouton('État détaillé', 'v:site'), dc_lien('Voir le site', DC_SITE)])], true);
  // Alerte quand un point passe en erreur ou revient à la normale
  $avant = (array)(dc_config()['etat_ko'] ?? []);
  $nouveaux = array_diff($ko, $avant);
  $retablis = array_diff($avant, $ko);
  if ($nouveaux || $retablis) {
    $l = array_merge(array_map(fn($k) => '✗ **' . ($libs[$k] ?? $k) . '** · ' . $verifs[$k]['txt'], $nouveaux), array_map(fn($k) => '✓ **' . ($libs[$k] ?? $k) . '** · rétabli', $retablis));
    dc_envoyer('etat-du-site', ['embeds' => [dc_carte(['entete' => 'Changement d’état', 'titre' => $nouveaux ? 'Problème détecté' : 'Retour à la normale', 'couleur' => $nouveaux ? DC_ROUGE : DC_VERT, 'texte' => implode("\n", $l)])]]);
    dc_config_maj(['etat_ko' => array_values($ko)]);
  }
  return $ko ? count($ko) . ' point(s) en erreur' : 'tout fonctionne';
}

/* ---------- Mises en ligne : nouveaux commits du dépôt GitHub (public) ---------- */
function dc_deploiements(): string
{
  $c = dc_config();
  $entetes = ['Accept: application/vnd.github+json', 'User-Agent: BDA-Security-Group'];
  if (!empty($c['github_etag'])) $entetes[] = 'If-None-Match: ' . $c['github_etag'];
  try {
    $r = veille_http('GET', 'https://api.github.com/repos/abed75z/bdasecurite/commits?per_page=30', $entetes, null, 20);
  } catch (Throwable $e) {
    return '';
  }
  if ($r['code'] === 304 || $r['code'] !== 200) return '';
  $commits = json_decode($r['corps'], true) ?: [];
  $dernier = (string)($c['github_dernier'] ?? '');
  $nouveaux = [];
  foreach ($commits as $k) {
    if (($k['sha'] ?? '') === $dernier) break;
    $nouveaux[] = $k;
  }
  // Premier passage : on part des 5 dernières mises en ligne
  if ($dernier === '') $nouveaux = array_slice($nouveaux, 0, 5);
  foreach (array_reverse($nouveaux) as $k) {
    $msg = (string)($k['commit']['message'] ?? '');
    $lignes = explode("\n", $msg);
    $titre = array_shift($lignes);
    $corps = trim(implode("\n", array_filter($lignes, fn($l) => !str_starts_with(trim($l), 'Co-Authored-By'))));
    dc_envoyer('deploiements', ['embeds' => [dc_carte(['entete' => 'Mise en ligne · ' . substr((string)$k['sha'], 0, 7), 'titre' => $titre, 'url' => (string)($k['html_url'] ?? ''), 'texte' => dc_couper($corps, 3000),
      'champs' => [dc_champ('Date', dc_quand((string)($k['commit']['author']['date'] ?? ''), 'f'))], 'quand' => strtotime((string)($k['commit']['author']['date'] ?? '')) ?: time()])]]);
    usleep(300000);
  }
  dc_config_maj(['github_etag' => (string)($r['entetes']['etag'] ?? ''), 'github_dernier' => (string)($commits[0]['sha'] ?? $dernier)]);
  return $nouveaux ? count($nouveaux) . ' publiée(s)' : '';
}

/* ---------- Coffre-fort : un message par accès dans #coffre-fort ---------- */
function coffre_publier(): string
{
  require_once __DIR__ . '/actions.php';
  $canal = dc_salon('coffre-fort');
  if ($canal === '') return 'salon absent';
  dc_fixe('coffre', 'coffre-fort', ['embeds' => [dc_carte(['entete' => 'Coffre-fort', 'titre' => 'Identifiants et mots de passe', 'quand' => false,
    'texte' => "Chaque accès ci-dessous : **Afficher** montre l’identifiant et le mot de passe à vous seul (message éphémère), chaque affichage est noté dans #securite.\n"
      . "Les mots de passe sont chiffrés sur le serveur (AES-256), jamais écrits dans ce salon.\n" . (coffre_code_defini() ? 'Un code est demandé avant chaque affichage.' : 'Conseil : définissez un code du coffre.')])],
    'components' => dc_lignes([dc_bouton('Ajouter un accès', 'm:cof:a:0', 3), dc_bouton(coffre_code_defini() ? 'Changer le code' : 'Définir un code', 'm:cof:code:0')])], true);
  $n = 0;
  foreach (dc_q('SELECT * FROM coffre ORDER BY service COLLATE NOCASE') as $e) {
    $m = coffre_message($e);
    if ($e['message_id'] !== '') {
      $r = dc_modifier($canal, (string)$e['message_id'], $m);
      if ($r['ok'] || $r['code'] !== 404) { $n++; continue; }
    }
    $r = dc_envoyer_canal($canal, $m);
    if ($r['ok']) db()->prepare('UPDATE coffre SET message_id = ? WHERE id = ?')->execute([$r['id'], $e['id']]);
    $n++;
    usleep(300000);
  }
  return "$n accès";
}
