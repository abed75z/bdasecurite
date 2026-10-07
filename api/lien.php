<?php
/* =========================================================
   LIEN PRIVÉ vers un document (demandé depuis Discord par le gérant)
   Le fichier reste sur le serveur : le lien expire après 10 minutes,
   s'ouvre 5 fois au plus, et chaque ouverture est notée au journal.
   ========================================================= */
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

entetes_securite();
header('Cache-Control: no-store, private');
function lien_page(int $code, string $titre, string $texte): void
{
  http_response_code($code);
  header('Content-Type: text/html; charset=utf-8');
  echo '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' . htmlspecialchars($titre) . '</title>'
    . '<body style="margin:0;font:16px system-ui,sans-serif;background:#0b0b0c;color:#f4efe6;display:grid;place-items:center;min-height:100vh;text-align:center;padding:16px;box-sizing:border-box">'
    . '<div><h1 style="color:#c9a66b;font-size:20px;letter-spacing:.08em">' . htmlspecialchars($titre) . '</h1><p style="color:#b9ad98">' . htmlspecialchars($texte) . '</p></div></body></html>';
  exit;
}
$k = (string)($_GET['k'] ?? '');
if (!preg_match('/^[a-f0-9]{48}$/', $k)) lien_page(404, 'Lien invalide', 'Ce lien n’existe pas.');
if (!limiter('lien-prive', 60, 3600)) lien_page(429, 'Trop de tentatives', 'Réessayez plus tard.');
$st = db()->prepare('SELECT * FROM liens_prives WHERE jeton = ?');
$st->execute([hash('sha256', $k)]);
$l = $st->fetch();
if (!$l || (int)$l['expire'] < time() || (int)$l['ouvertures'] >= 5) lien_page(410, 'Lien expiré', 'Ce lien privé a expiré (10 minutes). Redemandez-le dans Discord.');

$chemin = '';
$mime = '';
$nom = 'document';
switch ($l['type']) {
  case 'agent_doc':
    $st = db()->prepare('SELECT fichier, mime, nom FROM agent_docs WHERE id = ?');
    $st->execute([(int)$l['ref']]);
    if ($d = $st->fetch()) { $chemin = dossier_docs() . '/' . basename((string)$d['fichier']); $mime = (string)$d['mime']; $nom = (string)$d['nom']; }
    break;
  case 'paie':
    $st = db()->prepare('SELECT fichier, nom FROM equipe_paies WHERE id = ?');
    $st->execute([(int)$l['ref']]);
    if ($d = $st->fetch()) { $chemin = dossier_donnees() . '/equipe/paies/' . basename((string)$d['fichier']); $mime = 'application/pdf'; $nom = (string)$d['nom']; }
    break;
  case 'mc_photo':
    [$mc, $n] = array_map('intval', array_pad(explode(':', (string)$l['ref']), 2, 0));
    $st = db()->prepare('SELECT photos FROM main_courante WHERE id = ?');
    $st->execute([$mc]);
    $p = (json_decode((string)$st->fetchColumn(), true) ?: [])[$n - 1] ?? null;
    if ($p) { $chemin = dossier_donnees() . '/equipe/main-courante/' . basename((string)$p['f']); $mime = (string)$p['m']; $nom = "photo-$n"; }
    break;
  case 'piece':
    $st = db()->prepare("SELECT piece, piece_nom FROM documents WHERE id = ? AND piece <> ''");
    $st->execute([(int)$l['ref']]);
    if ($d = $st->fetch()) { $chemin = dossier_pieces() . '/' . basename((string)$d['piece']); $mime = 'application/pdf'; $nom = (string)$d['piece_nom']; }
    break;
}
if ($chemin === '' || !is_file($chemin)) lien_page(404, 'Document introuvable', 'Ce document a été supprimé.');
db()->prepare('UPDATE liens_prives SET ouvertures = ouvertures + 1 WHERE jeton = ?')->execute([hash('sha256', $k)]);
if ((int)$l['ouvertures'] === 0) journal('securite', 'Document ouvert par lien privé (Discord) : ' . $l['libelle']);
header('Content-Type: ' . ($mime ?: 'application/octet-stream'));
header('Content-Length: ' . filesize($chemin));
header('Content-Disposition: inline; filename="' . preg_replace('/[^\w .()-]+/u', '_', $nom) . '"');
readfile($chemin);
