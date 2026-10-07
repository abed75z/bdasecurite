<?php
/* =========================================================
   DISCORD — commandes /, boutons, menus et formulaires (interactions)
   Appelé par api/discord.php après vérification de la signature Discord.
   Seuls le gérant (propriétaire du serveur), les identifiants DISCORD_ADMIN_IDS
   et le rôle « Direction » peuvent s'en servir ; le coffre-fort, les documents
   et les fiches de paie sont réservés au gérant. Chaque action est notée au journal.
   ========================================================= */
declare(strict_types=1);

require_once __DIR__ . '/vues.php';

/* ---------- Signature Discord (Ed25519) ---------- */
function dc_signature_ok(string $corps, string $sig, string $ts): bool
{
  if (!preg_match('/^[a-f0-9]{128}$/', $sig) || !ctype_digit($ts) || abs(time() - (int)$ts) > 600) return false;
  if (!function_exists('sodium_crypto_sign_verify_detached')) {
    error_log('[BDA discord] extension sodium absente : signatures impossibles à vérifier');
    return false;
  }
  try {
    return sodium_crypto_sign_verify_detached((string)hex2bin($sig), $ts . $corps, (string)hex2bin(dc_cle_publique()));
  } catch (Throwable $e) {
    return false;
  }
}

/* ---------- Réponses ---------- */
function dc_rep(array $message, bool $prive = true): array
{
  $m = dc_message($message);
  if ($prive) $m['flags'] = 64;
  return ['type' => 4, 'data' => $m];
}
function dc_rep_maj(array $message): array
{
  return ['type' => 7, 'data' => dc_message($message)];
}
function dc_rep_texte(string $texte): array
{
  return dc_rep(['content' => $texte]);
}
function dc_modale(string $id, string $titre, array $champs): array
{
  $lignes = [];
  foreach (array_slice($champs, 0, 5) as $c) {
    $t = ['type' => 4, 'custom_id' => $c['id'], 'label' => dc_couper($c['label'], 45), 'style' => !empty($c['long']) ? 2 : 1, 'required' => !empty($c['requis']), 'max_length' => (int)($c['max'] ?? 1000)];
    if (isset($c['valeur']) && $c['valeur'] !== '') $t['value'] = mb_substr((string)$c['valeur'], 0, (int)($c['max'] ?? 1000));
    if (!empty($c['aide'])) $t['placeholder'] = dc_couper($c['aide'], 100);
    $lignes[] = ['type' => 1, 'components' => [$t]];
  }
  return ['type' => 9, 'data' => ['custom_id' => substr($id, 0, 100), 'title' => dc_couper($titre, 45), 'components' => $lignes]];
}
// Travail long (veille, synchronisation, installation) : réponse « en cours », puis message mis à jour
function dc_differer(array $i, callable $travail): array
{
  $jeton = (string)($i['token'] ?? '');
  $GLOBALS['dc_apres'][] = function () use ($jeton, $travail) {
    @set_time_limit(280);
    try {
      $m = $travail();
    } catch (Throwable $e) {
      error_log('[BDA discord] ' . $e->getMessage());
      $m = ['content' => 'Erreur : ' . $e->getMessage()];
    }
    dc_api('PATCH', '/webhooks/' . DC_APP_ID . "/$jeton/messages/@original", dc_message($m), ['sans_jeton' => true]);
  };
  return ['type' => 5, 'data' => ['flags' => 64]];
}
function dc_proprio(): bool
{
  return !empty($GLOBALS['dc_proprio']);
}

/* ---------- Point d'entrée ---------- */
function dc_interaction(array $i): array
{
  $type = (int)($i['type'] ?? 0);
  if ($type === 1) return ['type' => 1]; // PING de Discord
  $c = dc_config();
  $user = $i['member']['user'] ?? $i['user'] ?? [];
  $uid = (string)($user['id'] ?? '');
  $roles = (array)($i['member']['roles'] ?? []);
  $guild = (string)($i['guild_id'] ?? '');
  $proprio = $uid !== '' && ($uid === (string)($c['owner'] ?? '') || in_array($uid, dc_admins(), true));
  $direction = !empty($c['roles']['direction']) && in_array($c['roles']['direction'], $roles, true);
  if (!$uid || (!$proprio && !$direction) || ($guild !== '' && !empty($c['guild']) && $guild !== $c['guild'])) {
    journal('alerte', 'Discord : action refusée pour « ' . texte($user['username'] ?? '?', 40) . ' » (non autorisé)');
    return $type === 4 ? ['type' => 8, 'data' => ['choices' => []]] : dc_rep_texte('Accès réservé à la direction de BDA Security Group.');
  }
  $GLOBALS['dc_proprio'] = $proprio;
  $GLOBALS['dc_qui'] = texte($user['global_name'] ?? $user['username'] ?? 'Discord', 40);
  try {
    return match ($type) {
      2 => dc_commande($i),
      3 => dc_composant($i),
      4 => dc_autocompletion($i),
      5 => dc_formulaire($i),
      default => dc_rep_texte('Interaction inconnue.'),
    };
  } catch (Throwable $e) {
    error_log('[BDA discord] ' . $e->getMessage() . ' ' . $e->getFile() . ':' . $e->getLine());
    return dc_rep_texte('Erreur : ' . $e->getMessage());
  }
}
function dc_options(array $opts): array
{
  $o = [];
  foreach ($opts as $x) {
    if (isset($x['options'])) $o += dc_options((array)$x['options']);
    elseif (isset($x['name'])) $o[$x['name']] = $x['value'] ?? null;
  }
  return $o;
}

/* ---------- Commandes / ---------- */
function dc_commande(array $i): array
{
  $nom = (string)($i['data']['name'] ?? '');
  $o = dc_options((array)($i['data']['options'] ?? []));
  switch ($nom) {
    case 'veille': return dc_differer($i, 'dc_travail_veille');
    case 'sync': return dc_differer($i, 'dc_travail_sync');
    case 'installer':
      if (!dc_proprio()) return dc_rep_texte('Réservé au gérant.');
      return dc_differer($i, 'dc_travail_installer');
    case 'coffre':
      if (!dc_proprio()) return dc_rep_texte('Le coffre-fort est réservé au gérant.');
      if (!empty($o['service']) && ctype_digit((string)$o['service'])) return coffre_afficher((int)$o['service'], false);
      return dc_rep(dcv_coffre());
    case 'note':
      $t = texte($o['texte'] ?? '', 2000);
      if ($t === '') return dc_rep_texte('Note vide.');
      db()->prepare("INSERT INTO notes (texte, couleur, epingle, cree, maj) VALUES (?, '', 1, ?, ?)")->execute([$t, maintenant(), maintenant()]);
      journal('systeme', 'Note ajoutée depuis Discord');
      return dc_rep_texte('Note ajoutée et épinglée dans l’admin (Notes).');
  }
  $m = match ($nom) {
    'panel' => dcv_panel(),
    'tableau' => dcv_tableau(),
    'demandes' => dcv_demandes((string)($o['statut'] ?? 'nouvelle')),
    'messages' => dcv_messages(),
    'clients' => dcv_clients((string)($o['recherche'] ?? '')),
    'client' => dc_trouver_vue('client', (string)($o['nom'] ?? '')),
    'devis' => dcv_documents('devis', (string)($o['statut'] ?? 'envoye')),
    'factures' => dcv_documents('facture', (string)($o['filtre'] ?? 'impayees')),
    'ca' => dcv_ca((int)($o['annee'] ?? date('Y'))),
    'agents' => dcv_agents(),
    'agent' => dc_trouver_vue('agent', (string)($o['nom'] ?? '')),
    'planning' => dcv_planning(dc_lire_jour((string)($o['jour'] ?? ''))),
    'pointage' => dcv_pointage(),
    'absences' => dcv_absences(),
    'incidents' => dcv_incidents(),
    'comptes' => dcv_comptes(),
    'candidatures' => dcv_candidatures(),
    'avis' => dcv_avis(),
    'vtc' => dcv_vtc(),
    'assistant' => dcv_assistance_liste(),
    'opportunites' => dcv_opportunites((string)($o['type'] ?? 'tout')),
    'urgent' => dcv_urgent(),
    'site' => dcv_site(),
    'recherche' => dcv_recherche((string)($o['texte'] ?? '')),
    'journal' => dcv_journal((int)($o['nombre'] ?? 30)),
    'aide' => dcv_aide(),
    default => ['content' => 'Commande inconnue : relancez /installer.'],
  };
  return dc_rep($m);
}
// « aujourd'hui », « demain », « hier », « 12/10 », « 12/10/2026 » → date ISO
function dc_lire_jour(string $s): string
{
  $s = mb_strtolower(trim($s));
  if ($s === '' || str_starts_with($s, 'auj')) return date('Y-m-d');
  if ($s === 'demain') return date('Y-m-d', strtotime('+1 day'));
  if ($s === 'hier') return date('Y-m-d', strtotime('-1 day'));
  if (preg_match('~^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$~', $s, $m)) {
    $a = isset($m[3]) ? (strlen($m[3]) === 2 ? 2000 + (int)$m[3] : (int)$m[3]) : (int)date('Y');
    if (checkdate((int)$m[2], (int)$m[1], $a)) return sprintf('%04d-%02d-%02d', $a, $m[2], $m[1]);
  }
  return date('Y-m-d');
}
// Valeur choisie dans l'autocomplétion (identifiant) ou texte libre (recherche du premier nom qui correspond)
function dc_trouver_vue(string $type, string $valeur): array
{
  $table = $type === 'client' ? 'clients' : 'agents';
  if (ctype_digit($valeur)) return $type === 'client' ? dcv_client((int)$valeur) : dcv_agent((int)$valeur);
  $r = dc_un("SELECT id FROM $table WHERE nom LIKE ? ORDER BY nom COLLATE NOCASE LIMIT 1", ['%' . $valeur . '%']);
  if (!$r) return dcv_introuvable($type === 'client' ? 'Client' : 'Agent');
  return $type === 'client' ? dcv_client((int)$r['id']) : dcv_agent((int)$r['id']);
}

/* ---------- Autocomplétion (noms de clients, d'agents, services du coffre) ---------- */
function dc_autocompletion(array $i): array
{
  $nom = (string)($i['data']['name'] ?? '');
  $focus = null;
  foreach ((array)($i['data']['options'] ?? []) as $o) if (!empty($o['focused'])) $focus = $o;
  $q = '%' . trim((string)($focus['value'] ?? '')) . '%';
  $choix = [];
  if ($nom === 'client') foreach (dc_q('SELECT id, nom FROM clients WHERE nom LIKE ? ORDER BY nom COLLATE NOCASE LIMIT 25', [$q]) as $c) $choix[] = ['name' => dc_couper($c['nom'], 100), 'value' => (string)$c['id']];
  if ($nom === 'agent') foreach (dc_q('SELECT id, nom, poste FROM agents WHERE nom LIKE ? ORDER BY actif DESC, nom COLLATE NOCASE LIMIT 25', [$q]) as $a) $choix[] = ['name' => dc_couper($a['nom'] . ' · ' . $a['poste'], 100), 'value' => (string)$a['id']];
  if ($nom === 'coffre' && dc_proprio()) foreach (dc_q('SELECT id, service FROM coffre WHERE service LIKE ? ORDER BY service COLLATE NOCASE LIMIT 25', [$q]) as $c) $choix[] = ['name' => dc_couper($c['service'], 100), 'value' => (string)$c['id']];
  return ['type' => 8, 'data' => ['choices' => $choix]];
}

/* ---------- Vues ouvertes par un bouton ou un menu (v:vue:argument) ---------- */
function dc_vue(string $vue, string $arg): array
{
  return match ($vue) {
    'panel' => dcv_panel(),
    'tableau' => dcv_tableau(),
    'demandes' => dcv_demandes($arg ?: 'nouvelle'),
    'demande' => dcv_demande((int)$arg),
    'messages' => dcv_messages(),
    'conversation' => dcv_conversation((int)$arg),
    'clients' => dcv_clients($arg),
    'client' => dcv_client((int)$arg),
    'devis' => dcv_documents('devis', $arg ?: 'envoye'),
    'factures' => dcv_documents('facture', $arg ?: 'impayees'),
    'document' => dcv_document((int)$arg),
    'ca' => dcv_ca((int)($arg ?: date('Y'))),
    'agents' => dcv_agents(),
    'agent' => dcv_agent((int)$arg),
    'planning' => dcv_planning($arg ?: date('Y-m-d')),
    'pointage' => dcv_pointage(),
    'absences' => dcv_absences(),
    'absence' => dcv_absence((int)$arg),
    'incidents' => dcv_incidents(),
    'incident' => dcv_incident((int)$arg),
    'comptes' => dcv_comptes(),
    'compte' => dcv_compte((int)$arg),
    'candidatures' => dcv_candidatures(),
    'candidature' => dcv_candidature((int)$arg),
    'avis' => $arg !== '' ? dcv_avis_un((int)$arg) : dcv_avis(),
    'vtc' => dcv_vtc(),
    'reservation' => dcv_reservation((int)$arg),
    'assistance' => $arg !== '' ? dcv_assistance((int)$arg) : dcv_assistance_liste(),
    'opportunites' => dcv_opportunites($arg ?: 'tout'),
    'opportunite' => dcv_opportunite((int)$arg),
    'urgent' => dcv_urgent(),
    'site' => dcv_site(),
    'journal' => dcv_journal((int)($arg ?: 30)),
    'coffre' => dc_proprio() ? dcv_coffre() : ['content' => 'Le coffre-fort est réservé au gérant.'],
    'aide' => dcv_aide(),
    default => ['content' => 'Vue inconnue.'],
  };
}

/* ---------- Boutons et menus ---------- */
function dc_composant(array $i): array
{
  $id = (string)($i['data']['custom_id'] ?? '');
  $prive = ((int)($i['message']['flags'] ?? 0) & 64) === 64;
  $p = explode(':', $id);
  $valeur = (string)(($i['data']['values'] ?? [])[0] ?? '');
  // Menus déroulants : ouvrir l'élément choisi
  if ($p[0] === 's') {
    if ($p[1] === 'doc' || $p[1] === 'paie') return dc_lien_document($p[1] === 'doc' ? 'agent_doc' : 'paie', (int)$valeur);
    if ($p[1] === 'cof') return coffre_afficher((int)$valeur, $prive);
    if ($p[1] === 'ouvrir') { [$vue, $arg] = array_pad(explode(':', $valeur, 2), 2, ''); $m = dc_vue($vue, $arg); }
    else $m = dc_vue($p[1], $valeur);
    return $prive ? dc_rep_maj($m) : dc_rep($m);
  }
  if ($p[0] === 'v') {
    $m = dc_vue($p[1] ?? '', (string)($p[2] ?? ''));
    return $prive ? dc_rep_maj($m) : dc_rep($m);
  }
  if ($p[0] === 'm') return dc_ouvrir_modale($p[1] ?? '', (string)($p[2] ?? ''), (string)($p[3] ?? ''));
  if ($p[0] === 'x' && ($p[1] ?? '') === 'site') {
    if (!dc_proprio()) return dc_rep_texte('Réservé au gérant.');
    return dc_rep(['embeds' => [dc_carte(['entete' => 'Confirmation', 'titre' => 'Mettre le site en maintenance ?', 'couleur' => DC_ROUGE, 'texte' => 'Les visiteurs verront la page de maintenance. Vous gardez l’accès au site depuis l’admin.'])],
      'components' => dc_lignes([dc_bouton('Oui, mettre en maintenance', 'a:site:off:0', 4), dc_bouton('Annuler', 'v:site')])]);
  }
  if ($p[0] === 'a') return dc_action($i, $p, $prive);
  return dc_rep_texte('Bouton inconnu.');
}

/* ---------- Actions ---------- */
function dc_action(array $i, array $p, bool $prive): array
{
  $quoi = $p[1] ?? '';
  $op = $p[2] ?? '';
  $id = (int)($p[3] ?? $p[2] ?? 0);
  $qui = ' (Discord · ' . ($GLOBALS['dc_qui'] ?? '') . ')';
  $maj = fn(array $m) => dc_rep_maj($m);
  switch ($quoi) {
    case 'veille': return dc_differer($i, 'dc_travail_veille');
    case 'sync': return dc_differer($i, 'dc_travail_sync');

    case 'dem':
      $statut = ['t' => 'traitee', 'a' => 'archivee', 'n' => 'nouvelle'][$op] ?? '';
      if ($statut === '') break;
      db()->prepare('UPDATE demandes SET statut = ? WHERE id = ?')->execute([$statut, $id]);
      journal('site', "Demande #$id : " . mb_strtolower(dc_statut($statut)) . $qui);
      return $maj(dcv_demande($id));

    case 'dev':
    case 'fac':
      $d = dc_un('SELECT type, numero, client, statut FROM documents WHERE id = ?', [$id]);
      if (!$d) return dc_rep_texte('Document introuvable.');
      $statut = ['dev:a' => 'accepte', 'dev:r' => 'refuse', 'fac:p' => 'payee'][$quoi . ':' . $op] ?? '';
      if ($statut === '' || !in_array($statut, STATUTS[$d['type']], true)) return dc_rep_texte('Action impossible pour ce document.');
      db()->prepare('UPDATE documents SET statut = ?, maj = ? WHERE id = ?')->execute([$statut, maintenant(), $id]);
      journal('document', ($d['type'] === 'facture' ? 'Facture ' : 'Devis ') . "{$d['numero']}" . ($d['client'] !== '' ? " ({$d['client']})" : '') . ' : ' . mb_strtolower(dc_statut($statut)) . $qui);
      return $maj(dcv_document($id));

    case 'piece':
      if (!dc_proprio()) return dc_rep_texte('Réservé au gérant.');
      $d = dc_un("SELECT numero, piece_nom FROM documents WHERE id = ? AND piece <> ''", [$id]);
      if (!$d) return dc_rep_texte('Aucun PDF joint.');
      return dc_rep(['content' => 'PDF joint à ' . $d['numero'] . ' · lien privé valable 10 minutes :', 'components' => dc_lignes([dc_lien('Ouvrir le PDF', dc_lien_prive('piece', (string)$id, 'PDF de ' . $d['numero']))])]);

    case 'msg':
      db()->prepare("UPDATE messages_clients SET lu = 1 WHERE client_id = ? AND auteur = 'client' AND lu = 0")->execute([$id]);
      return $maj(dcv_conversation($id));

    case 'avis':
      $statut = ['p' => 'publie', 'r' => 'refuse'][$op] ?? '';
      if ($statut === '') break;
      db()->prepare('UPDATE avis SET statut = ? WHERE id = ?')->execute([$statut, $id]);
      $nom = (string)(dc_un('SELECT nom FROM avis WHERE id = ?', [$id])['nom'] ?? '');
      journal('site', "Avis de $nom : " . ($statut === 'publie' ? 'publié' : 'refusé') . $qui);
      return $maj(dcv_avis_un($id));

    case 'vtc':
      $statut = ['c' => 'confirmee', 't' => 'terminee', 'x' => 'annulee'][$op] ?? '';
      $r = dc_un('SELECT * FROM reservations WHERE id = ?', [$id]);
      if ($statut === '' || !$r) return dc_rep_texte('Réservation introuvable.');
      $d = json_decode((string)$r['data'], true) ?: [];
      db()->prepare('UPDATE reservations SET statut = ? WHERE id = ?')->execute([$statut, $id]);
      journal('vtc', "Réservation {$r['ref']} (" . ($d['nom'] ?? '') . ') : ' . libelle_dc($statut) . $qui);
      if ($statut !== $r['statut'] && in_array($statut, ['confirmee', 'annulee'], true) && !empty($d['email'])) {
        $quand = date('d/m/Y', strtotime((string)$d['date'])) . ' à ' . $d['heure'];
        $txt = $statut === 'confirmee'
          ? "Bonjour {$d['nom']},\n\nVotre course du $quand est confirmée" . (!empty($d['chauffeur']) ? " : votre chauffeur sera {$d['chauffeur']}" : '') . ".\nPrix : " . number_format((float)$r['prix'], 2, ',', ' ') . " €\n\nSuivre votre réservation : https://bdasecurite.com/reserver#suivi={$r['jeton']}\n\nBDA Security Group — 06 11 67 86 25"
          : "Bonjour {$d['nom']},\n\nVotre réservation du $quand a été annulée. Pour toute question : 06 11 67 86 25.\n\nBDA Security Group";
        envoyer_mail(($statut === 'confirmee' ? 'Course confirmée' : 'Réservation annulée') . " — {$r['ref']}", $txt, BDA_EMAIL, (string)$d['email']);
      }
      return $maj(dcv_reservation($id));

    case 'cpt':
      $c = dc_un('SELECT * FROM comptes_equipe WHERE id = ?', [$id]);
      if (!$c) return dc_rep_texte('Compte introuvable.');
      if ($op === 'v') {
        dc_valider_compte($c);
        journal('equipe', "Espace équipe : compte de {$c['prenom']} {$c['nom']} validé$qui");
      } else {
        $statut = ['r' => 'refuse', 'b' => 'bloque', 'a' => 'actif'][$op] ?? '';
        if ($statut === '' || ($statut === 'actif' && !(int)$c['agent_id'])) return dc_rep_texte('Action impossible pour ce compte.');
        db()->prepare("UPDATE comptes_equipe SET statut = ?, echecs = 0, bloque_jusqu = '' WHERE id = ?")->execute([$statut, $id]);
        if ($statut !== 'actif') db()->prepare('DELETE FROM equipe_appareils WHERE compte_id = ?')->execute([$id]);
        journal('equipe', "Espace équipe : compte de {$c['prenom']} {$c['nom']} " . ['refuse' => 'refusé', 'bloque' => 'suspendu', 'actif' => 'réactivé'][$statut] . $qui);
      }
      return $maj(dcv_compte($id));

    case 'abs':
      $ab = dc_un('SELECT ab.*, a.nom AS agent_nom FROM absences ab JOIN agents a ON a.id = ab.agent_id WHERE ab.id = ?', [$id]);
      $statut = ['a' => 'acceptee', 'r' => 'refusee'][$op] ?? '';
      if (!$ab || $statut === '') return dc_rep_texte('Demande introuvable.');
      if ($ab['statut'] !== 'attente') return $maj(dcv_absence($id));
      db()->prepare("UPDATE absences SET statut = ?, reponse = '', traite = ? WHERE id = ?")->execute([$statut, maintenant(), $id]);
      $jours = $statut === 'acceptee' ? eq_absence_planning(['id' => $ab['agent_id'], 'nom' => $ab['agent_nom']], (string)$ab['du'], (string)$ab['au'], EQ_CODE_ABSENCE[$ab['type']] ?? 'ABS') : 0;
      $periode = $ab['du'] === $ab['au'] ? 'du ' . date('d/m/Y', strtotime((string)$ab['du'])) : 'du ' . date('d/m/Y', strtotime((string)$ab['du'])) . ' au ' . date('d/m/Y', strtotime((string)$ab['au']));
      $cpt = dc_un("SELECT email, prenom FROM comptes_equipe WHERE agent_id = ? AND statut = 'actif' LIMIT 1", [(int)$ab['agent_id']]);
      if ($cpt) envoyer_mail('Votre demande ' . $periode . ' est ' . ($statut === 'acceptee' ? 'acceptée' : 'refusée'), "Bonjour {$cpt['prenom']},\n\nVotre demande $periode a été " . ($statut === 'acceptee' ? 'acceptée' : 'refusée') . " par la direction.\n\nhttps://bdasecurite.com/espace-equipe#/absences\n\nBDA Security Group", BDA_EMAIL, (string)$cpt['email']);
      journal('equipe', "Absence de {$ab['agent_nom']} $periode " . ($statut === 'acceptee' ? 'acceptée' : 'refusée') . ($jours ? " ($jours jour(s) notés au planning)" : '') . $qui);
      return $maj(dcv_absence($id));

    case 'mc':
      $statut = ['l' => 'lu', 't' => 'traite'][$op] ?? '';
      if ($statut === '') break;
      db()->prepare('UPDATE main_courante SET statut = ? WHERE id = ?')->execute([$statut, $id]);
      journal('equipe', "Main courante n° $id : " . ($statut === 'lu' ? 'lue' : 'traitée') . $qui);
      return $maj(dcv_incident($id));

    case 'photo':
      $mc = (int)($p[2] ?? 0);
      $n = (int)($p[3] ?? 0);
      return dc_rep(['content' => "Photo $n de la main courante n° $mc · lien privé valable 10 minutes :", 'components' => dc_lignes([dc_lien('Voir la photo', dc_lien_prive('mc_photo', "$mc:$n", "Photo main courante n° $mc"))])]);

    case 'cand':
      $statut = in_array($op, ['nouvelle', 'en_cours', 'retenue', 'refusee'], true) ? $op : '';
      $id = (int)($p[3] ?? 0);
      if ($statut === '') break;
      db()->prepare('UPDATE candidatures SET statut = ? WHERE id = ?')->execute([$statut, $id]);
      journal('equipe', "Candidature n° $id : " . mb_strtolower(dc_statut($statut)) . $qui);
      return $maj(dcv_candidature($id));

    case 'opp':
      $statut = ['c' => 'contacte', 'i' => 'ignore', 'r' => 'a_traiter'][$op] ?? '';
      if ($statut === '') break;
      db()->prepare('UPDATE opportunites SET statut = ?, maj = ? WHERE id = ?')->execute([$statut, maintenant(), $id]);
      $o = dc_un('SELECT titre, acheteur FROM opportunites WHERE id = ?', [$id]);
      journal('site', 'Veille : « ' . mb_substr((string)($o['acheteur'] ?? ''), 0, 60) . ' » ' . mb_strtolower(dc_statut($statut)) . $qui);
      return $maj(dcv_opportunite($id));

    case 'assist':
      db()->prepare("UPDATE assist_conv SET statut = 'close', non_lu = 0 WHERE id = ?")->execute([$id]);
      return $maj(dcv_assistance($id));

    case 'dossier':
      $type = $op === 'client' ? 'client' : 'agent';
      $id = (int)($p[3] ?? 0);
      require_once __DIR__ . '/sync.php';
      $GLOBALS['dc_apres'][] = fn() => dc_sync_un($type, $id);
      return $maj($type === 'client' ? dcv_client($id) : dcv_agent($id));

    case 'doc':
      return dc_lien_document('agent_doc', (int)($p[2] ?? 0));

    case 'site':
      if (!dc_proprio()) return dc_rep_texte('Réservé au gérant.');
      if ($op === 'off') {
        $etat = ['depuis' => maintenant(), 'message' => '', 'retour' => ''];
        if (@file_put_contents(fichier_hors_ligne(), json_encode($etat, JSON_UNESCAPED_UNICODE), LOCK_EX) === false) return dc_rep_texte('Impossible de mettre le site hors ligne.');
        journal('site', 'SITE MIS HORS LIGNE (page de maintenance pour les visiteurs)' . $qui);
      } elseif (is_file(fichier_hors_ligne())) {
        @unlink(fichier_hors_ligne());
        journal('site', 'Site remis en ligne' . $qui);
      }
      return $prive ? $maj(dcv_site()) : dc_rep(dcv_site());

    case 'cof':
      return coffre_action($op, (int)($p[3] ?? 0), $prive);
  }
  return dc_rep_texte('Action inconnue.');
}
function libelle_dc(string $s): string
{
  return mb_strtolower(dc_statut($s));
}
// Lien privé (10 min) vers un document d'agent, une fiche de paie… : réservé au gérant
function dc_lien_document(string $type, int $id): array
{
  if (!dc_proprio()) return dc_rep_texte('Les documents et fiches de paie sont réservés au gérant.');
  if ($type === 'paie') {
    $f = dc_un('SELECT p.titre, a.nom FROM equipe_paies p JOIN agents a ON a.id = p.agent_id WHERE p.id = ?', [$id]);
    $lib = $f ? $f['titre'] . ' · ' . $f['nom'] : '';
  } else {
    $f = dc_un('SELECT d.nom, d.type, a.nom AS agent FROM agent_docs d JOIN agents a ON a.id = d.agent_id WHERE d.id = ?', [$id]);
    $lib = $f ? (DC_DOCS[$f['type']] ?? $f['type']) . ' · ' . $f['agent'] . ' (' . $f['nom'] . ')' : '';
  }
  if (!$f) return dc_rep_texte('Document introuvable.');
  $url = dc_lien_prive($type, (string)$id, $lib);
  return dc_rep(['content' => '**' . dc_txt($lib, 150) . "**\nLien privé valable 10 minutes (le fichier reste sur le serveur, l’ouverture est notée au journal).", 'components' => dc_lignes([dc_lien('Ouvrir le document', $url)])]);
}
// Validation d'un compte de l'Espace équipe : fiche agent reliée (même nom) ou créée, puis email à l'agent
function dc_valider_compte(array $c): void
{
  $agentId = (int)$c['agent_id'];
  if (!$agentId) {
    $cle = nom_simple($c['prenom'] . ' ' . $c['nom']);
    foreach (dc_q('SELECT id, nom FROM agents') as $a) {
      $deja = (int)dc_n("SELECT COUNT(*) FROM comptes_equipe WHERE agent_id = ? AND id <> ? AND statut IN ('actif', 'bloque')", [(int)$a['id'], (int)$c['id']]);
      if (!$deja && (nom_simple($a['nom']) === $cle || nom_simple($a['nom']) === nom_simple($c['nom'] . ' ' . $c['prenom']))) { $agentId = (int)$a['id']; break; }
    }
  }
  if ($agentId) {
    db()->prepare("UPDATE agents SET actif = 1, tel = CASE WHEN tel = '' THEN ? ELSE tel END WHERE id = ?")->execute([$c['tel'], $agentId]);
  } else {
    db()->prepare('INSERT INTO agents (nom, poste, tel, actif, cree) VALUES (?, ?, ?, 1, ?)')->execute([$c['prenom'] . ' ' . $c['nom'], EQ_POSTE_METIER[$c['metier']] ?? 'ADS', $c['tel'], maintenant()]);
    $agentId = (int)db()->lastInsertId();
  }
  db()->prepare("UPDATE comptes_equipe SET statut = 'actif', agent_id = ?, valide = ?, echecs = 0, bloque_jusqu = '' WHERE id = ?")->execute([$agentId, maintenant(), (int)$c['id']]);
  envoyer_mail('Votre accès à l’Espace équipe est activé', "Bonjour {$c['prenom']},\n\nBonne nouvelle : la direction a validé votre compte.\nVous pouvez maintenant vous connecter avec votre identifiant « {$c['identifiant']} » et votre mot de passe :\n\nhttps://bdasecurite.com/espace-equipe\n\nVous y trouverez votre planning, vos fiches de paie, vos documents, vos demandes de congés et la main courante.\n\nBienvenue dans l'équipe,\nBDA Security Group", BDA_EMAIL, (string)$c['email']);
}

/* ---------- Formulaires (fenêtres de saisie) ---------- */
function dc_ouvrir_modale(string $quoi, string $arg, string $arg2): array
{
  switch ($quoi) {
    case 'msg':
      $c = dc_un('SELECT nom FROM clients WHERE id = ?', [(int)$arg]);
      return dc_modale("f:msg:$arg", 'Répondre à ' . ($c['nom'] ?? 'ce client'), [['id' => 'texte', 'label' => 'Votre message (envoyé dans son espace client)', 'long' => true, 'requis' => true, 'max' => 4000]]);
    case 'assist':
      return dc_modale("f:assist:$arg", 'Répondre au visiteur', [['id' => 'texte', 'label' => 'Votre réponse (affichée dans l’assistant)', 'long' => true, 'requis' => true, 'max' => 2000]]);
    case 'opp':
      $o = dc_un('SELECT note FROM opportunites WHERE id = ?', [(int)$arg]);
      return dc_modale("f:opp:$arg", 'Note sur cette opportunité', [['id' => 'texte', 'label' => 'Note (vide pour effacer)', 'long' => true, 'max' => 2000, 'valeur' => (string)($o['note'] ?? '')]]);
    case 'bandeau':
      if (!dc_proprio()) return dc_rep_texte('Réservé au gérant.');
      $b = site_reglages()['bandeau'];
      return dc_modale('f:bandeau:0', 'Bandeau d’annonce du site', [
        ['id' => 'texte', 'label' => 'Texte (vide pour masquer le bandeau)', 'max' => 160, 'valeur' => !empty($b['actif']) ? (string)$b['texte'] : ''],
        ['id' => 'lien', 'label' => 'Lien (facultatif)', 'max' => 300, 'valeur' => (string)$b['lien']],
        ['id' => 'libelle', 'label' => 'Texte du lien (facultatif)', 'max' => 40, 'valeur' => (string)$b['libelleLien']],
      ]);
    case 'recherche':
      return dc_modale('f:recherche:0', 'Rechercher partout', [['id' => 'texte', 'label' => 'Nom, téléphone, n° de devis, ville…', 'requis' => true, 'max' => 100]]);
    case 'cof':
      return coffre_modale($arg, (int)$arg2);
  }
  return dc_rep_texte('Formulaire inconnu.');
}
function dc_formulaire(array $i): array
{
  $p = explode(':', (string)($i['data']['custom_id'] ?? ''));
  $v = [];
  foreach ((array)($i['data']['components'] ?? []) as $ligne) foreach ((array)($ligne['components'] ?? []) as $c) $v[$c['custom_id']] = (string)($c['value'] ?? '');
  $prive = ((int)($i['message']['flags'] ?? 0) & 64) === 64;
  $deMessage = isset($i['message']);
  $qui = ' (Discord · ' . ($GLOBALS['dc_qui'] ?? '') . ')';
  $id = (int)($p[2] ?? 0);
  switch ($p[1] ?? '') {
    case 'msg':
      $texte = texte($v['texte'] ?? '', 4000);
      $c = dc_un('SELECT c.nom, cc.email, cc.actif FROM clients c JOIN comptes_clients cc ON cc.client_id = c.id WHERE c.id = ?', [$id]);
      if (!$c) return dc_rep_texte('Ce client n’a pas d’espace client : répondez-lui par email ou téléphone.');
      if ($texte === '') return dc_rep_texte('Message vide.');
      db()->prepare("INSERT INTO messages_clients (client_id, auteur, texte, cree, lu) VALUES (?, 'admin', ?, ?, 0)")->execute([$id, $texte, maintenant()]);
      db()->prepare("UPDATE messages_clients SET lu = 1 WHERE client_id = ? AND auteur = 'client' AND lu = 0")->execute([$id]);
      if ((int)$c['actif'] === 1) envoyer_mail('Nouveau message de BDA Security Group', "Bonjour,\n\nBDA Security Group vous a répondu dans votre espace client :\n\n« $texte »\n\nRépondre : https://bdasecurite.com/espace-client#/messages\n\nBDA Security Group — 06 11 67 86 25", BDA_EMAIL, (string)$c['email']);
      journal('site', "Réponse envoyée à {$c['nom']} (espace client)$qui");
      return $deMessage ? dc_rep_maj(dcv_conversation($id)) : dc_rep(dcv_conversation($id));
    case 'assist':
      $texte = texte($v['texte'] ?? '', 2000);
      if ($texte === '' || !dc_un('SELECT id FROM assist_conv WHERE id = ?', [$id])) return dc_rep_texte('Conversation introuvable.');
      db()->prepare('INSERT INTO assist_msg (conv_id, auteur, texte, cree) VALUES (?, ?, ?, ?)')->execute([$id, 'equipe', $texte, maintenant()]);
      db()->prepare("UPDATE assist_conv SET statut = 'equipe', non_lu = 0, maj = ? WHERE id = ?")->execute([maintenant(), $id]);
      journal('site', "Assistant : réponse envoyée au visiteur n° $id$qui");
      return $deMessage ? dc_rep_maj(dcv_assistance($id)) : dc_rep(dcv_assistance($id));
    case 'opp':
      db()->prepare('UPDATE opportunites SET note = ?, maj = ? WHERE id = ?')->execute([texte($v['texte'] ?? '', 2000), maintenant(), $id]);
      return $deMessage ? dc_rep_maj(dcv_opportunite($id)) : dc_rep(dcv_opportunite($id));
    case 'bandeau':
      if (!dc_proprio()) return dc_rep_texte('Réservé au gérant.');
      $s = site_reglages();
      $t = texte($v['texte'] ?? '', 160);
      $lien = texte($v['lien'] ?? '', 300);
      if ($lien !== '' && !preg_match('#^(https://|/|tel:|mailto:)#', $lien)) $lien = 'https://' . ltrim($lien, '/');
      $s['bandeau'] = ['actif' => $t !== '', 'texte' => $t, 'lien' => $lien, 'libelleLien' => texte($v['libelle'] ?? '', 40)];
      db()->prepare("INSERT INTO reglages (k, v) VALUES ('site', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")->execute([json_encode($s, JSON_UNESCAPED_UNICODE)]);
      journal('site', ($t !== '' ? "Bandeau d’annonce publié : « $t »" : 'Bandeau d’annonce masqué') . $qui);
      return $prive ? dc_rep_maj(dcv_site()) : dc_rep(dcv_site());
    case 'recherche':
      return dc_rep(dcv_recherche($v['texte'] ?? ''));
    case 'cof':
      return coffre_formulaire((string)($p[2] ?? ''), (int)($p[3] ?? 0), $v, $prive);
  }
  return dc_rep_texte('Formulaire inconnu.');
}

/* ---------- Travaux longs (réponse différée) ---------- */
function dc_travail_veille(): array
{
  require_once __DIR__ . '/../veille/veille.php';
  $r = veille_lancer('discord');
  if (!$r['ok']) return ['content' => $r['message']];
  $e = $r['etat']['sources'] ?? [];
  $l = [];
  foreach (['boamp' => 'Appels d’offres (BOAMP)', 'francetravail' => 'Entreprises qui recrutent (France Travail)'] as $k => $lib) {
    $s = $e[$k] ?? null;
    $l[] = "**$lib** · " . (!$s ? 'non lancée' : ($s['ok'] ? (int)$s['nouveaux'] . ' nouveau(x) · ' . dc_txt((string)$s['message'], 300) : 'ERREUR · ' . dc_txt((string)$s['message'], 300)));
  }
  return ['embeds' => [dc_carte(['entete' => 'Veille commerciale', 'titre' => 'Collecte terminée en ' . ($r['etat']['derniere']['duree'] ?? '?') . ' s', 'texte' => implode("\n", $l)])], 'components' => dc_lignes([dc_bouton('Voir les opportunités', 'v:opportunites:tout')])];
}
function dc_travail_sync(): array
{
  require_once __DIR__ . '/sync.php';
  $r = dc_cron(true);
  return ['embeds' => [dc_carte(['entete' => 'Synchronisation', 'titre' => 'Serveur mis à jour', 'texte' => implode("\n", array_map(fn($l) => '· ' . $l, $r))])]];
}
function dc_travail_installer(): array
{
  require_once __DIR__ . '/structure.php';
  $r = dc_installer();
  return ['embeds' => [dc_carte(['entete' => 'Installation', 'titre' => 'Serveur vérifié et réparé', 'texte' => implode("\n", array_map(fn($l) => '· ' . $l, $r))])]];
}

/* =========================================================
   COFFRE-FORT : identifiants et mots de passe saisis par le gérant,
   chiffrés (AES-256-GCM, clé dans le .env privé), affichés seulement
   à la demande et à lui seul (message éphémère), chaque affichage noté au journal.
   Code du coffre facultatif : demandé avant chaque affichage s'il est défini.
   ========================================================= */
function coffre_cle(): string
{
  $k = veille_env('COFFRE_CLE');
  if ($k === '') {
    $k = base64_encode(random_bytes(32));
    veille_env_ecrire(['COFFRE_CLE' => $k]);
  }
  $b = base64_decode($k, true);
  if ($b === false || strlen($b) !== 32) throw new RuntimeException('Clé du coffre-fort invalide.');
  return $b;
}
function coffre_chiffrer(string $clair): string
{
  if ($clair === '') return '';
  $iv = random_bytes(12);
  $tag = '';
  $c = openssl_encrypt($clair, 'aes-256-gcm', coffre_cle(), OPENSSL_RAW_DATA, $iv, $tag, 'bda-coffre', 16);
  if ($c === false) throw new RuntimeException('Chiffrement impossible.');
  return base64_encode($iv . $tag . $c);
}
function coffre_dechiffrer(string $b64): string
{
  if ($b64 === '') return '';
  $b = base64_decode($b64, true);
  if ($b === false || strlen($b) < 29) return '';
  $c = openssl_decrypt(substr($b, 28), 'aes-256-gcm', coffre_cle(), OPENSSL_RAW_DATA, substr($b, 0, 12), substr($b, 12, 16), 'bda-coffre');
  return $c === false ? '' : $c;
}
function coffre_code_defini(): bool
{
  return (string)(dc_un("SELECT v FROM reglages WHERE k = 'coffre_code'")['v'] ?? '') !== '';
}
// Message du salon #coffre-fort pour un accès (jamais le mot de passe)
function coffre_message(array $e): array
{
  $note = coffre_dechiffrer((string)$e['note']);
  return ['embeds' => [dc_carte(['entete' => 'Accès', 'titre' => $e['service'], 'url' => $e['lien'] ?: '', 'quand' => false, 'champs' => [
    dc_champ('Identifiant', $e['identifiant'] !== '' ? '`' . str_replace('`', "'", $e['identifiant']) . '`' : '—'),
    dc_champ('Mot de passe', $e['secret'] !== '' ? 'Enregistré (chiffré)' : 'Non renseigné'),
    dc_champ('Dernier affichage', $e['vu'] !== '' ? dc_quand((string)$e['vu'], 'R') : 'jamais'),
    dc_champ('Note', $note !== '' ? 'Oui (affichée avec le mot de passe)' : '—'),
  ], 'pied' => 'BDA Security Group · coffre-fort · réf. cof-' . $e['id']])],
    'components' => dc_lignes([dc_bouton('Afficher', 'a:cof:v:' . $e['id'], 1), dc_bouton('Modifier', 'm:cof:e:' . $e['id']), dc_bouton('Supprimer', 'a:cof:s:' . $e['id'], 4)])];
}
function dcv_coffre(): array
{
  $rows = dc_q('SELECT id, service, identifiant, secret FROM coffre ORDER BY service COLLATE NOCASE');
  $lignes = array_map(fn($e) => '**' . dc_txt($e['service'], 60) . '** · ' . ($e['identifiant'] !== '' ? '`' . str_replace('`', "'", $e['identifiant']) . '`' : '—') . ($e['secret'] !== '' ? '' : ' · mot de passe non renseigné'), $rows);
  $options = array_map(fn($e) => dc_option($e['service'], (string)$e['id'], $e['identifiant']), array_slice($rows, 0, 25));
  return ['embeds' => [dc_carte(['entete' => 'Coffre-fort', 'titre' => count($rows) . ' accès enregistrés', 'texte' => ($lignes ? implode("\n", $lignes) : 'Coffre vide.') . "\n\n" . (coffre_code_defini() ? 'Un code est demandé avant chaque affichage.' : 'Conseil : définissez un code du coffre (bouton ci-dessous).')])],
    'components' => dc_composants($options ? [dc_liste('s:cof', 'Afficher un mot de passe…', $options)] : [], dc_lignes([dc_bouton('Ajouter un accès', 'm:cof:a:0', 3), dc_bouton(coffre_code_defini() ? 'Changer le code' : 'Définir un code', 'm:cof:code:0')]))];
}
function coffre_afficher(int $id, bool $maj, bool $codeVerifie = false): array
{
  if (!dc_proprio()) return dc_rep_texte('Le coffre-fort est réservé au gérant.');
  $e = dc_un('SELECT * FROM coffre WHERE id = ?', [$id]);
  if (!$e) return dc_rep_texte('Accès introuvable.');
  if (coffre_code_defini() && !$codeVerifie) return dc_modale("f:cof:v:$id", 'Code du coffre-fort', [['id' => 'code', 'label' => 'Code du coffre', 'requis' => true, 'max' => 40]]);
  $mdp = coffre_dechiffrer((string)$e['secret']);
  $note = coffre_dechiffrer((string)$e['note']);
  db()->prepare('UPDATE coffre SET vu = ? WHERE id = ?')->execute([maintenant(), $id]);
  journal('securite', "Coffre-fort : accès « {$e['service']} » affiché (Discord · " . ($GLOBALS['dc_qui'] ?? '') . ')');
  $m = ['embeds' => [dc_carte(['entete' => 'Coffre-fort · visible par vous seul', 'titre' => $e['service'], 'url' => $e['lien'] ?: '', 'couleur' => DC_OR, 'champs' => [
    dc_champ('Identifiant', $e['identifiant'] !== '' ? '`' . str_replace('`', "'", $e['identifiant']) . '`' : '—', false),
    dc_champ('Mot de passe', $mdp !== '' ? '||`' . str_replace('`', "'", $mdp) . '`||' : 'Non renseigné', false),
    $note !== '' ? dc_champ('Note', '||' . dc_txt($note, 900) . '||', false) : null,
  ], 'pied' => 'Masquez ce message après usage (Ignorer le message).'])], 'components' => $e['lien'] !== '' ? dc_lignes([dc_lien('Ouvrir le site', (string)$e['lien'])]) : []];
  return $maj ? dc_rep_maj($m) : dc_rep($m);
}
function coffre_modale(string $quoi, int $id): array
{
  if (!dc_proprio()) return dc_rep_texte('Le coffre-fort est réservé au gérant.');
  if ($quoi === 'code') {
    $champs = [['id' => 'nouveau', 'label' => 'Nouveau code (4 caractères minimum)', 'requis' => true, 'max' => 40]];
    if (coffre_code_defini()) array_unshift($champs, ['id' => 'ancien', 'label' => 'Code actuel', 'requis' => true, 'max' => 40]);
    return dc_modale('f:cof:code:0', 'Code du coffre-fort', $champs);
  }
  $e = $quoi === 'e' ? dc_un('SELECT * FROM coffre WHERE id = ?', [$id]) : null;
  if ($quoi === 'e' && !$e) return dc_rep_texte('Accès introuvable.');
  return dc_modale($quoi === 'e' ? "f:cof:e:$id" : 'f:cof:a:0', $quoi === 'e' ? 'Modifier ' . $e['service'] : 'Nouvel accès', [
    ['id' => 'service', 'label' => 'Service (ex. OVH, Gmail, Banque)', 'requis' => true, 'max' => 80, 'valeur' => (string)($e['service'] ?? '')],
    ['id' => 'lien', 'label' => 'Adresse du site (facultatif)', 'max' => 300, 'valeur' => (string)($e['lien'] ?? '')],
    ['id' => 'identifiant', 'label' => 'Identifiant / email', 'max' => 200, 'valeur' => (string)($e['identifiant'] ?? '')],
    ['id' => 'secret', 'label' => $e ? 'Mot de passe (vide = inchangé)' : 'Mot de passe', 'max' => 300],
    ['id' => 'note', 'label' => 'Note (code PIN, question secrète…)', 'long' => true, 'max' => 1000, 'valeur' => $e ? coffre_dechiffrer((string)$e['note']) : ''],
  ]);
}
function coffre_formulaire(string $quoi, int $id, array $v, bool $prive): array
{
  if (!dc_proprio()) return dc_rep_texte('Le coffre-fort est réservé au gérant.');
  $qui = ' (Discord · ' . ($GLOBALS['dc_qui'] ?? '') . ')';
  if ($quoi === 'v') {
    $cle = 'coffre-code';
    if (tentatives($cle, 900) >= 5) return dc_rep_texte('Trop de codes faux : coffre bloqué 15 minutes.');
    $hash = (string)(dc_un("SELECT v FROM reglages WHERE k = 'coffre_code'")['v'] ?? '');
    if ($hash === '' || !password_verify(chaine($v['code'] ?? ''), $hash)) {
      noter_tentative($cle);
      journal('alerte', 'Coffre-fort : code faux saisi' . $qui);
      return dc_rep_texte('Code faux.');
    }
    return coffre_afficher($id, false, true);
  }
  if ($quoi === 'code') {
    $hash = (string)(dc_un("SELECT v FROM reglages WHERE k = 'coffre_code'")['v'] ?? '');
    if ($hash !== '' && !password_verify(chaine($v['ancien'] ?? ''), $hash)) { journal('alerte', 'Coffre-fort : changement de code refusé (code actuel faux)' . $qui); return dc_rep_texte('Code actuel faux.'); }
    $n = chaine($v['nouveau'] ?? '');
    if (mb_strlen($n) < 4) return dc_rep_texte('Le code doit faire au moins 4 caractères.');
    db()->prepare("INSERT INTO reglages (k, v) VALUES ('coffre_code', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")->execute([password_hash($n, PASSWORD_DEFAULT)]);
    journal('securite', 'Coffre-fort : code défini' . $qui);
    return dc_rep_texte('Code du coffre enregistré : il sera demandé avant chaque affichage.');
  }
  $service = texte($v['service'] ?? '', 80);
  if ($service === '') return dc_rep_texte('Indiquez le nom du service.');
  $lien = texte($v['lien'] ?? '', 300);
  if ($lien !== '' && !preg_match('#^https?://#', $lien)) $lien = 'https://' . ltrim($lien, '/');
  $ident = texte($v['identifiant'] ?? '', 200);
  $secret = chaine($v['secret'] ?? '');
  $note = texte($v['note'] ?? '', 1000);
  if ($quoi === 'e') {
    $e = dc_un('SELECT * FROM coffre WHERE id = ?', [$id]);
    if (!$e) return dc_rep_texte('Accès introuvable.');
    db()->prepare('UPDATE coffre SET service = ?, lien = ?, identifiant = ?, secret = ?, note = ?, maj = ? WHERE id = ?')
      ->execute([$service, $lien, $ident, $secret !== '' ? coffre_chiffrer($secret) : $e['secret'], coffre_chiffrer($note), maintenant(), $id]);
    journal('securite', "Coffre-fort : accès « $service » modifié" . ($secret !== '' ? ' (nouveau mot de passe)' : '') . $qui);
  } else {
    db()->prepare('INSERT INTO coffre (service, lien, identifiant, secret, note, cree, maj) VALUES (?, ?, ?, ?, ?, ?, ?)')
      ->execute([$service, $lien, $ident, coffre_chiffrer($secret), coffre_chiffrer($note), maintenant(), maintenant()]);
    $id = (int)db()->lastInsertId();
    journal('securite', "Coffre-fort : accès « $service » ajouté$qui");
  }
  require_once __DIR__ . '/sync.php';
  $GLOBALS['dc_apres'][] = fn() => coffre_publier();
  return dc_rep_texte("Accès « $service » enregistré" . ($secret !== '' ? ' (mot de passe chiffré)' : '') . '. Le salon #coffre-fort est mis à jour.');
}
function coffre_action(string $op, int $id, bool $prive): array
{
  if (!dc_proprio()) return dc_rep_texte('Le coffre-fort est réservé au gérant.');
  $qui = ' (Discord · ' . ($GLOBALS['dc_qui'] ?? '') . ')';
  if ($op === 'v') return coffre_afficher($id, false);
  if ($op === 's') {
    $e = dc_un('SELECT service FROM coffre WHERE id = ?', [$id]);
    if (!$e) return dc_rep_texte('Accès introuvable.');
    return dc_rep(['content' => "Supprimer définitivement l’accès « {$e['service']} » du coffre ?", 'components' => dc_lignes([dc_bouton('Oui, supprimer', "a:cof:S:$id", 4)])]);
  }
  if ($op === 'S') {
    $e = dc_un('SELECT service, message_id FROM coffre WHERE id = ?', [$id]);
    if (!$e) return dc_rep_texte('Déjà supprimé.');
    db()->prepare('DELETE FROM coffre WHERE id = ?')->execute([$id]);
    if ($e['message_id'] !== '' && dc_salon('coffre-fort') !== '') dc_api('DELETE', '/channels/' . dc_salon('coffre-fort') . '/messages/' . $e['message_id']);
    journal('securite', "Coffre-fort : accès « {$e['service']} » supprimé$qui");
    return $prive ? dc_rep_maj(['content' => "Accès « {$e['service']} » supprimé.", 'components' => []]) : dc_rep_texte("Accès « {$e['service']} » supprimé.");
  }
  return dc_rep_texte('Action inconnue.');
}
