<?php
/* =========================================================
   GÉNÉRATEUR DES PAGES « SECTEURS » ET « QUARTIERS » (référencement Google)
   Utilisation (en local) :  php app/pages/generer.php
   Il reprend l'habillage de securite-privee-paris.html (en-tête, menu, pied de page)
   et crée un fichier .html par page décrite dans donnees.php.
   Ce dossier est interdit d'accès depuis le web (app/.htaccess).
   ========================================================= */
declare(strict_types=1);

$racine = dirname(__DIR__, 2);
$modele = file_get_contents($racine . '/securite-privee-paris.html');
['secteurs' => $secteurs, 'zones' => $zones] = require __DIR__ . '/donnees.php';

$e = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
$debutMain = strpos($modele, '<main>');
$finMain = strpos($modele, '</main>') + strlen('</main>');
$tete = substr($modele, 0, $debutMain);
$pied = substr($modele, $finMain);
$tete = str_replace('<a href="securite-privee-paris" aria-current="page">Sécurité</a>', '<a href="securite-privee-paris">Sécurité</a>', $tete);

$toutes = array_merge(array_map(fn($p) => $p + ['groupe' => 'secteur'], $secteurs), array_map(fn($p) => $p + ['groupe' => 'zone'], $zones));

foreach ($toutes as $p) {
  $url = 'https://bdasecurite.com/' . $p['slug'];
  $faq = $p['faq'];
  $ld = [
    '@context' => 'https://schema.org',
    '@graph' => [
      ['@type' => 'Service', 'name' => trim(strip_tags($p['h1']), ' .'), 'serviceType' => 'Sécurité privée', 'description' => $p['description'], 'url' => $url,
        'provider' => ['@id' => 'https://bdasecurite.com/#entreprise'], 'areaServed' => $p['zoneServie'] ?? 'Paris et Île-de-France'],
      ['@type' => 'BreadcrumbList', 'itemListElement' => [
        ['@type' => 'ListItem', 'position' => 1, 'name' => 'Accueil', 'item' => 'https://bdasecurite.com/'],
        ['@type' => 'ListItem', 'position' => 2, 'name' => 'Sécurité privée', 'item' => 'https://bdasecurite.com/securite-privee-paris'],
        ['@type' => 'ListItem', 'position' => 3, 'name' => $p['fil'], 'item' => $url]]],
      ['@type' => 'FAQPage', 'mainEntity' => array_map(fn($q) => ['@type' => 'Question', 'name' => $q[0], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $q[1]]], $faq)],
    ],
  ];
  $h = $tete;
  $h = preg_replace('#<title>.*?</title>#s', '<title>' . $e($p['title']) . '</title>', $h, 1);
  $h = preg_replace('#<meta name="description" content="[^"]*">#', '<meta name="description" content="' . $e($p['description']) . '">', $h, 1);
  $h = preg_replace('#<link rel="canonical" href="[^"]*">#', '<link rel="canonical" href="' . $url . '">', $h, 1);
  $h = preg_replace('#<meta property="og:title" content="[^"]*">#', '<meta property="og:title" content="' . $e($p['title']) . '">', $h, 1);
  $h = preg_replace('#<meta property="og:description" content="[^"]*">#', '<meta property="og:description" content="' . $e($p['description']) . '">', $h, 1);
  $h = preg_replace('#<meta property="og:url" content="[^"]*">#', '<meta property="og:url" content="' . $url . '">', $h, 1);
  $h = preg_replace('#<script type="application/ld\+json">.*?</script>#s', "<script type=\"application/ld+json\">\n  " . json_encode($ld, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n  </script>", $h, 1);

  $cartes = implode('', array_map(fn($c) => '<div class="lp-card" data-reveal><span class="ico" aria-hidden="true"><svg class="icon"><use href="#i-' . $c[0] . '"/></svg></span><h3>' . $e($c[1]) . '</h3><p>' . $e($c[2]) . '</p></div>', $p['cartes']));
  $points = implode('', array_map(fn($l) => '<li data-reveal><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg><div>' . $e($l[0]) . ($l[1] ? ' <span>' . $e($l[1]) . '</span>' : '') . '</div></li>', $p['points']));
  $faqHtml = '';
  foreach ($faq as $i => $q) {
    $n = $i + 1;
    $faqHtml .= '<div class="faq__item" data-reveal><button class="faq__q" type="button" id="faq-q' . $n . '" aria-expanded="false" aria-controls="faq-a' . $n . '">' . $e($q[0]) . '<span class="faq__plus" aria-hidden="true"></span></button><div class="faq__a" id="faq-a' . $n . '" role="region" aria-labelledby="faq-q' . $n . '"><div><p>' . $e($q[1]) . '</p></div></div></div>';
  }
  $paragraphes = implode('', array_map(fn($t) => '<p data-reveal>' . $t . '</p>', $p['intro']));
  // Liens vers les autres pages du même groupe (maillage interne)
  $voisins = array_filter($toutes, fn($x) => $x['groupe'] === $p['groupe'] && $x['slug'] !== $p['slug']);
  $liens = implode('', array_map(fn($x) => '<li><a href="' . $x['slug'] . '">' . $e($x['fil']) . ' <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></a></li>', $voisins));
  $service = $p['service'] ?? 'gardiennage';

  $main = <<<HTML
<main>
  <section class="lp-hero" aria-labelledby="page-title" data-anim>
    <div class="lp-hero__photo" style="--pos: {$p['pos']}" aria-hidden="true">
      <img src="https://images.unsplash.com/{$p['photo']}?auto=format&amp;fit=crop&amp;w=1200&amp;q=72" srcset="https://images.unsplash.com/{$p['photo']}?auto=format&amp;fit=crop&amp;w=800&amp;q=72 800w, https://images.unsplash.com/{$p['photo']}?auto=format&amp;fit=crop&amp;w=1600&amp;q=72 1600w" sizes="100vw" alt="" fetchpriority="high">
    </div>
    <div class="container">
      <div class="lp-hero__copy">
        <nav class="lp-crumbs" aria-label="Fil d'Ariane" data-reveal="fade"><a href="/">Accueil</a><span aria-hidden="true">›</span><a href="securite-privee-paris">Sécurité privée</a><span aria-hidden="true">›</span><span aria-current="page">{$e($p['fil'])}</span></nav>
        <p class="kicker" data-reveal="fade">{$e($p['kicker'])}</p>
        <h1 class="h1 shimmer" id="page-title" data-split>{$p['h1']}</h1>
        <p class="lead" data-reveal style="--d:300ms">{$e($p['lead'])}</p>
        <div class="hero__ctas" data-reveal style="--d:450ms">
          <a class="btn btn--gold" href="devis?service={$service}" data-magnetic>Demander un devis <svg class="icon icon--arrow" aria-hidden="true"><use href="#i-arrow"/></svg></a>
          <a class="btn btn--outline" href="tel:+33611678625"><svg class="icon" aria-hidden="true"><use href="#i-phone"/></svg> 06 11 67 86 25</a>
        </div>
        <ul class="hero__trust" data-reveal="fade" style="--d:650ms">
          <li><span class="tick"><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg></span> Autorisation CNAPS</li>
          <li><span class="tick"><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg></span> 24h/24 · 7j/7</li>
          <li><span class="tick"><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg></span> Devis gratuit</li>
        </ul>
      </div>
    </div>
  </section>

  <div class="lp-main">
    <div class="container lp-layout">
      <article class="lp-article">
        <section id="presentation" aria-labelledby="t-presentation">
          <p class="kicker" data-reveal="fade">{$e($p['k1'])}</p>
          <h2 class="h2" id="t-presentation" data-split>{$p['h2a']}</h2>
          {$paragraphes}
        </section>

        <section id="prestations" aria-labelledby="t-prestations">
          <p class="kicker" data-reveal="fade">Nos prestations</p>
          <h2 class="h2" id="t-prestations" data-split>{$p['h2b']}</h2>
          <div class="lp-cards" data-stagger>{$cartes}</div>
        </section>

        <section id="atouts" aria-labelledby="t-atouts">
          <p class="kicker" data-reveal="fade">Pourquoi BDA Sécurité</p>
          <h2 class="h2" id="t-atouts" data-split>{$p['h2c']}</h2>
          <ul class="lp-list" data-stagger>{$points}</ul>
        </section>

        <section id="methode" aria-labelledby="t-methode">
          <p class="kicker" data-reveal="fade">Notre méthode</p>
          <h2 class="h2" id="t-methode" data-split>Une mission <em>en quatre étapes.</em></h2>
          <ol class="lp-steps" data-stagger>
            <li data-reveal><b>Vous nous décrivez votre besoin</b>Par téléphone ou avec le formulaire de devis : le lieu, les dates, les horaires et le contexte.</li>
            <li data-reveal><b>Nous étudions le site</b>Nous évaluons les risques et, si besoin, nous visitons les lieux avant de proposer un dispositif.</li>
            <li data-reveal><b>Vous recevez un devis clair</b>Nombre d'agents, horaires, consignes : tout est détaillé, sans engagement.</li>
            <li data-reveal><b>Nos agents prennent leur poste</b>Briefés sur vos consignes, en tenue adaptée, avec un responsable joignable à tout moment.</li>
          </ol>
        </section>

        <section id="faq" aria-labelledby="t-faq">
          <p class="kicker" data-reveal="fade">Questions fréquentes</p>
          <h2 class="h2" id="t-faq" data-split>Vos questions, <em>nos réponses.</em></h2>
          <div class="faq" data-stagger>{$faqHtml}</div>
        </section>
      </article>

      <aside class="lp-aside" aria-label="Devis et pages liées">
        <div class="lp-box" data-reveal>
          <p class="kicker">Devis gratuit</p>
          <h2 class="h3">{$e($p['boite'])}</h2>
          <p>Décrivez votre besoin en deux minutes : nous revenons vers vous rapidement.</p>
          <a class="btn btn--gold" href="devis?service={$service}">Demander un devis <svg class="icon icon--arrow" aria-hidden="true"><use href="#i-arrow"/></svg></a>
          <a class="btn btn--outline" href="tel:+33611678625"><svg class="icon" aria-hidden="true"><use href="#i-phone"/></svg> 06 11 67 86 25</a>
        </div>
        <nav class="lp-box" aria-label="Pages liées" data-reveal>
          <p class="kicker">{$e($p['groupe'] === 'zone' ? 'Autres secteurs d’intervention' : 'Autres secteurs d’activité')}</p>
          <ul>{$liens}<li><a href="references">Nos références <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></a></li></ul>
        </nav>
      </aside>
    </div>

    <div class="container">
      <div class="lp-cta" data-reveal="scale">
        <h2 class="h3">{$p['cta']}</h2>
        <div>
          <a class="btn btn--gold" href="devis?service={$service}" data-magnetic>Demander un devis <svg class="icon icon--arrow" aria-hidden="true"><use href="#i-arrow"/></svg></a>
          <a class="btn btn--outline" href="tel:+33611678625"><svg class="icon" aria-hidden="true"><use href="#i-phone"/></svg> Appeler</a>
        </div>
      </div>
    </div>
  </div>
</main>
HTML;
  file_put_contents($racine . '/' . $p['slug'] . '.html', $h . $main . $pied);
  echo "✓ {$p['slug']}.html\n";
}
echo count($toutes) . " pages générées.\n";

/* ---------- Pages spéciales : Références (FR) et version anglaise ---------- */
$speciales = [
  ['slug' => 'references', 'lang' => 'fr', 'main' => 'references.main.html',
    'title' => 'Nos références : Consulat général de Colombie et clients | BDA Sécurité',
    'description' => 'Ils nous font confiance : le Consulat général de Colombie à Paris, entreprises, hôtels, commerces. Découvrez les références de BDA Sécurité, société de sécurité privée à Paris.'],
  ['slug' => 'en', 'lang' => 'en', 'main' => 'en.main.html',
    'title' => 'Private Security & Chauffeur Service in Paris | BDA Sécurité',
    'description' => 'Licensed security officers, close protection, event security and premium chauffeur service in Paris. Trusted by the Consulate General of Colombia. Free quote, 24/7.'],
];
$anglais = [
  '<html lang="fr">' => '<html lang="en">', 'content="fr_FR"' => 'content="en_GB"',
  '>Accueil</a>' => '>Home</a>', '>Sécurité</a>' => '>Security</a>', '>VTC Premium</a>' => '>Chauffeur</a>', '>Avis</a>' => '>Reviews</a>', '>Recrutement</a>' => '>Careers</a>',
  '<span>Appeler</span>' => '<span>Call</span>', ' Appeler</a>' => ' Call</a>', '>Demander un devis<' => '>Request a quote<', '>Demander un devis <' => '>Request a quote <',
  '>Sécurité privée</a>' => '>Private security</a>', '>Protection rapprochée</a>' => '>Close protection</a>', '>Sécurité événementielle</a>' => '>Event security</a>',
  '>Chauffeur privé VTC</a>' => '>Private chauffeur</a>', '>Transfert aéroport</a>' => '>Airport transfers</a>', '>Avis clients</a>' => '>Reviews</a>',
  '<h4>Sécurité privée</h4>' => '<h4>Private security</h4>', '<h4>VTC Premium</h4>' => '<h4>Chauffeur</h4>', '>Agents de sécurité</a>' => '>Security guards</a>',
  '>Chauffeur + sécurité VIP</a>' => '>Chauffeur + VIP security</a>', '>Transferts aéroports</a>' => '>Airport transfers</a>', '>Chauffeur mariage</a>' => '>Wedding chauffeur</a>',
  '>Nous rejoindre</a>' => '>Careers</a>', '<span>Espace client</span>' => '<span>Client area</span>', '</svg> Espace client</a>' => '</svg> Client area</a>', 'aria-label="Espace client"' => 'aria-label="Client area"', '>Nos références</a>' => '>References</a>', '>Espace client</a>' => '>Client area</a>', '>English version</a>' => '>Version française</a>',
  'Sécurité privée et transport haut de gamme à Paris : protection, ponctualité et sérénité, 24h/24 et 7j/7.' => 'Private security and premium transport in Paris: protection, punctuality and peace of mind, 24/7.',
  '24h/24 · 7j/7' => '24/7', '<span>Écrivez-nous</span>' => '<span>Message us</span>', 'href="en" hreflang="en"' => 'href="/" hreflang="fr"',
];
foreach ($speciales as $p) {
  $url = 'https://bdasecurite.com/' . $p['slug'];
  $ld = ['@context' => 'https://schema.org', '@type' => 'WebPage', 'name' => $p['title'], 'description' => $p['description'], 'url' => $url, 'inLanguage' => $p['lang'], 'isPartOf' => ['@id' => 'https://bdasecurite.com/#site']];
  $h = $tete;
  $h = preg_replace('#<title>.*?</title>#s', '<title>' . $e($p['title']) . '</title>', $h, 1);
  $h = preg_replace('#<meta name="description" content="[^"]*">#', '<meta name="description" content="' . $e($p['description']) . '">', $h, 1);
  $h = preg_replace('#<link rel="canonical" href="[^"]*">#', '<link rel="canonical" href="' . $url . '">' . ($p['lang'] === 'en' ? "\n  <link rel=\"alternate\" hreflang=\"en\" href=\"$url\">\n  <link rel=\"alternate\" hreflang=\"fr\" href=\"https://bdasecurite.com/\">" : ''), $h, 1);
  $h = preg_replace('#<meta property="og:title" content="[^"]*">#', '<meta property="og:title" content="' . $e($p['title']) . '">', $h, 1);
  $h = preg_replace('#<meta property="og:description" content="[^"]*">#', '<meta property="og:description" content="' . $e($p['description']) . '">', $h, 1);
  $h = preg_replace('#<meta property="og:url" content="[^"]*">#', '<meta property="og:url" content="' . $url . '">', $h, 1);
  $h = preg_replace('#<script type="application/ld\+json">.*?</script>#s', "<script type=\"application/ld+json\">\n  " . json_encode($ld, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n  </script>", $h, 1);
  $page = $h . file_get_contents(__DIR__ . '/' . $p['main']) . $pied;
  if ($p['lang'] === 'en') $page = strtr($page, $anglais);
  file_put_contents($racine . '/' . $p['slug'] . '.html', $page);
  echo "✓ {$p['slug']}.html\n";
}
