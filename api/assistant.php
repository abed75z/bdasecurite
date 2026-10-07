<?php
/* =========================================================
   ASSISTANT DU SITE — API publique (fenêtre de discussion)
   POST ?a=message     { jeton?, texte, page }  -> réponse du robot (ou attente de l'équipe)
   POST ?a=conseiller  { jeton, nom, contact, besoin? } -> conversation transmise à l'équipe
   GET  ?a=suivi&jeton=…&apres=ID                       -> nouveaux messages (réponses de l'équipe)
   Le visiteur est reconnu par un jeton aléatoire gardé dans son navigateur
   (seule son empreinte est enregistrée).
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
require __DIR__ . '/../app/assistant.php';

entetes_securite();
header('Cache-Control: no-store');

$action = (string)($_GET['a'] ?? '');
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($action, ['message', 'conseiller', 'suivi'], true) || (($action === 'suivi') !== ($methode === 'GET'))) echec('Action inconnue.', 405);
if ($methode === 'POST' && !origine_ok()) echec('Origine refusée.', 403);

function conv_par_jeton(string $jeton): ?array
{
  if (!preg_match('/^[a-f0-9]{40}$/', $jeton)) return null;
  $st = db()->prepare('SELECT * FROM assist_conv WHERE jeton = ?');
  $st->execute([hash('sha256', $jeton)]);
  return $st->fetch() ?: null;
}
function ajouter_msg(int $conv, string $auteur, string $texte, bool $ia = false): array
{
  $quand = maintenant();
  db()->prepare('INSERT INTO assist_msg (conv_id, auteur, texte, ia, cree) VALUES (?, ?, ?, ?, ?)')->execute([$conv, $auteur, $texte, $ia ? 1 : 0, $quand]);
  $id = (int)db()->lastInsertId();
  db()->prepare('UPDATE assist_conv SET maj = ? WHERE id = ?')->execute([$quand, $conv]);
  return ['id' => $id, 'auteur' => $auteur, 'texte' => $texte, 'cree' => $quand];
}
function service_assistant_ouvert(): void
{
  if (empty(site_reglages()['visible']['assistant'])) echec('L’assistant est momentanément indisponible.', 403);
}

try {
  switch ($action) {
    case 'message':
      service_assistant_ouvert();
      if (!limiter('assist', 40, 600)) echec('Trop de messages en peu de temps. Réessayez dans quelques minutes, ou appelez le 06 11 67 86 25.', 429);
      $b = corps();
      $texte = texte($b['texte'] ?? '', 1000);
      if (mb_strlen($texte) < 1) echec('Message vide.');
      $jeton = (string)($b['jeton'] ?? '');
      $conv = $jeton !== '' ? conv_par_jeton($jeton) : null;
      if (!$conv) {
        $jeton = bin2hex(random_bytes(20));
        db()->prepare('INSERT INTO assist_conv (jeton, page, cree, maj) VALUES (?, ?, ?, ?)')->execute([hash('sha256', $jeton), texte($b['page'] ?? '', 200), maintenant(), maintenant()]);
        $conv = conv_par_jeton($jeton);
      }
      $id = (int)$conv['id'];
      $nouveaux = [ajouter_msg($id, 'visiteur', $texte)];
      // Conversation déjà entre les mains de l'équipe : le robot ne répond plus
      if (in_array($conv['statut'], ['attente', 'equipe'], true)) {
        db()->prepare('UPDATE assist_conv SET non_lu = non_lu + 1 WHERE id = ?')->execute([$id]);
        notifier('assistance', 'Assistant du site : nouveau message', 'Un visiteur vous a répondu dans la discussion.', '/admin/#/assistance/' . $id, 'assist-' . $id);
        repondre(['ok' => true, 'jeton' => $jeton, 'statut' => $conv['statut'], 'messages' => $nouveaux, 'conseiller' => false, 'suggestions' => []]);
      }
      // Historique pour l'IA
      $st = db()->prepare('SELECT auteur, texte FROM assist_msg WHERE conv_id = ? ORDER BY id DESC LIMIT 20');
      $st->execute([$id]);
      $historique = array_reverse(array_map(fn ($m) => ['role' => $m['auteur'] === 'visiteur' ? 'user' : 'assistant', 'texte' => ($m['auteur'] === 'equipe' ? '[Réponse d’un conseiller BDA] ' : '') . $m['texte']], $st->fetchAll()));
      $reponse = assist_ia($historique);
      if ($reponse !== null) {
        $conseiller = str_contains($reponse, ASSIST_CONSEILLER);
        $reponse = trim(str_replace(ASSIST_CONSEILLER, '', $reponse));
        $r = ['texte' => $reponse, 'suggestions' => [], 'conseiller' => $conseiller, 'compris' => true, 'ia' => true];
      } else {
        $r = assist_local($texte) + ['ia' => false];
      }
      // Deux questions non comprises d'affilée : on propose franchement un conseiller
      $ratees = $r['compris'] ? 0 : (int)$conv['ratees'] + 1;
      if ($ratees >= 2) $r['texte'] .= ' Le plus simple est sans doute qu’un membre de l’équipe vous réponde directement.';
      db()->prepare('UPDATE assist_conv SET ratees = ? WHERE id = ?')->execute([$ratees, $id]);
      $nouveaux[] = ajouter_msg($id, 'robot', $r['texte'], $r['ia']);
      repondre(['ok' => true, 'jeton' => $jeton, 'statut' => 'robot', 'messages' => $nouveaux, 'conseiller' => (bool)$r['conseiller'] || $ratees >= 2, 'suggestions' => $r['suggestions']]);

    case 'conseiller':
      service_assistant_ouvert();
      if (!limiter('assist-conseiller', 6, 3600)) echec('Trop de demandes. Appelez-nous au 06 11 67 86 25.', 429);
      $b = corps();
      $conv = conv_par_jeton((string)($b['jeton'] ?? ''));
      $jeton = (string)($b['jeton'] ?? '');
      if (!$conv) {
        $jeton = bin2hex(random_bytes(20));
        db()->prepare('INSERT INTO assist_conv (jeton, page, cree, maj) VALUES (?, ?, ?, ?)')->execute([hash('sha256', $jeton), texte($b['page'] ?? '', 200), maintenant(), maintenant()]);
        $conv = conv_par_jeton($jeton);
      }
      $nom = texte($b['nom'] ?? '', 80);
      $contact = texte($b['contact'] ?? '', 120);
      $besoin = texte($b['besoin'] ?? '', 1000);
      if ($nom === '' || $contact === '') echec('Indiquez votre nom et un téléphone ou un email pour être recontacté.');
      if (!preg_match('/[0-9]{6,}|@/', str_replace([' ', '.', '-'], '', $contact))) echec('Indiquez un numéro de téléphone ou une adresse email valide.');
      $id = (int)$conv['id'];
      db()->prepare("UPDATE assist_conv SET statut = 'attente', nom = ?, contact = ?, non_lu = non_lu + 1 WHERE id = ?")->execute([$nom, $contact, $id]);
      $nouveaux = [];
      if ($besoin !== '') $nouveaux[] = ajouter_msg($id, 'visiteur', $besoin);
      $prenom = explode(' ', $nom)[0];
      $nouveaux[] = ajouter_msg($id, 'robot', "Merci {$prenom}, votre demande est transmise à l’équipe BDA. Un conseiller va vous répondre ici même, ou vous recontacter au {$contact}. Pour une urgence, appelez directement le 06 11 67 86 25.");
      // Prévenir l'équipe par email, avec le fil de la discussion
      $st = db()->prepare('SELECT auteur, texte, cree FROM assist_msg WHERE conv_id = ? ORDER BY id');
      $st->execute([$id]);
      $fil = implode("\n", array_map(fn ($m) => substr($m['cree'], 11, 5) . ' ' . ['visiteur' => 'Visiteur', 'robot' => 'Assistant', 'equipe' => 'BDA'][$m['auteur']] . ' : ' . $m['texte'], $st->fetchAll()));
      envoyer_mail("Assistant du site : {$nom} demande un conseiller", "Un visiteur demande à parler à un conseiller.\n\nNom : {$nom}\nContact : {$contact}\nPage : {$conv['page']}\n\nDiscussion :\n{$fil}\n\nRépondez-lui depuis l'admin : https://bdasecurite.com/admin/#/assistance/{$id}");
      journal('site', "Assistant : {$nom} demande un conseiller");
      notifier('assistance', 'Un visiteur demande un conseiller', 'Assistant du site : répondez-lui depuis l’admin.', '/admin/#/assistance/' . $id, 'assist-' . $id);
      repondre(['ok' => true, 'jeton' => $jeton, 'statut' => 'attente', 'messages' => $nouveaux]);

    case 'suivi':
      $conv = conv_par_jeton((string)($_GET['jeton'] ?? ''));
      if (!$conv) repondre(['ok' => true, 'statut' => 'aucune', 'messages' => []]);
      $st = db()->prepare("SELECT id, auteur, texte, cree FROM assist_msg WHERE conv_id = ? AND id > ? ORDER BY id LIMIT 50");
      $st->execute([(int)$conv['id'], max(0, (int)($_GET['apres'] ?? 0))]);
      repondre(['ok' => true, 'statut' => $conv['statut'], 'messages' => array_map(fn ($m) => ['id' => (int)$m['id'], 'auteur' => $m['auteur'], 'texte' => $m['texte'], 'cree' => $m['cree']], $st->fetchAll())]);
  }
} catch (Throwable $e) {
  error_log('[BDA assistant] ' . $e->getMessage());
  echec('L’assistant rencontre un souci. Appelez-nous au 06 11 67 86 25.', 500);
}
