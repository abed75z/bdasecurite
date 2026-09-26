<?php
/* Textes des pages « secteurs » et « quartiers » (voir generer.php) */
declare(strict_types=1);

const P_AGENT = 'photo-1618371731836-2b9bff9ac72a';
const P_OREILLETTE = 'photo-1618371690240-e0d46eead4b8';
const P_SECURITE = 'photo-1725139381713-b4d7e0113c1f';
const P_EVENEMENT = 'photo-1760228604788-db8a36d5c1a3';
const P_ESCORTE = 'photo-1553885762-df52cdc82f36';

// Briques communes
$pointsCommuns = [
  ['Des agents titulaires de la carte professionnelle CNAPS', 'et une entreprise autorisée (n° AUT-075-2124-07-01-20250906336).'],
  ['Un interlocuteur unique', ': le responsable de votre mission, joignable 24h/24.'],
  ['Des agents présentables et discrets', ', choisis pour leur sérieux et leur sens du service.'],
  ['Un devis clair et sans engagement', ', avec le détail des horaires et des consignes.'],
  ['Une équipe réactive', 'pour les renforts, les remplacements et les demandes urgentes.'],
];
$cartesZone = fn(string $lieu) => [
  ['building', 'Gardiennage & surveillance', "Bureaux, commerces, résidences ou chantiers $lieu : présence dissuasive et rondes, de jour comme de nuit."],
  ['lock', 'Accueil & contrôle d’accès', 'Filtrage des entrées, vérification des badges et des listes d’invités, accueil des visiteurs.'],
  ['ticket', 'Sécurité événementielle', 'Soirées, lancements, salons ou réceptions : un dispositif adapté au lieu et au nombre d’invités.'],
  ['user', 'Protection rapprochée', 'Accompagnement discret de dirigeants, de personnalités et de leurs familles.'],
];
$faqZone = fn(string $lieu, string $delai) => [
  ["Intervenez-vous $lieu ?", "Oui. Nous intervenons $lieu pour des missions ponctuelles comme pour des prestations régulières, de jour comme de nuit, 7j/7."],
  ["En combien de temps un agent peut-il être sur place $lieu ?", "Selon nos disponibilités, $delai. Pour une urgence, appelez directement le 06 11 67 86 25."],
  ['Combien coûte un agent de sécurité ?', 'Le tarif dépend du poste, des horaires (jour, nuit, dimanche, jour férié) et de la durée. Le devis est gratuit et sans engagement.'],
];

// Page quartier / arrondissement
function zone(string $slug, string $nom, string $fil, string $lieu, string $zoneServie, array $intro, string $delai, string $photo, callable $cartesZone, callable $faqZone, array $pointsCommuns, array $plus = []): array
{
  return $plus + [
    'slug' => $slug, 'fil' => $fil, 'zoneServie' => $zoneServie, 'photo' => $photo, 'pos' => '50% 30%',
    'title' => "Agent de sécurité $nom | Société de sécurité BDA",
    'description' => "Société de sécurité privée $lieu : agents titulaires de la carte CNAPS pour le gardiennage, le contrôle d’accès, vos événements et la protection rapprochée. Devis gratuit, 24h/24.",
    'kicker' => "Sécurité privée · $nom",
    'h1' => "Agent de sécurité <em>$lieu.</em>",
    'lead' => "Des agents de sécurité qualifiés et discrets $lieu, pour vos locaux, vos commerces, vos événements et vos proches. Un seul interlocuteur, 24h/24 et 7j/7.",
    'k1' => 'Sécurité de proximité',
    'h2a' => "Votre société de sécurité <em>$lieu.</em>",
    'intro' => $intro,
    'h2b' => "Nos missions <em>$lieu.</em>",
    'cartes' => $cartesZone($lieu),
    'h2c' => 'Ce qui fait <em>la différence.</em>',
    'points' => $pointsCommuns,
    'faq' => $faqZone($lieu, $delai),
    'boite' => "Un agent de sécurité $lieu ?",
    'cta' => "Sécurisez votre activité <em>$lieu.</em>",
  ];
}

$secteurs = [
  [
    'slug' => 'securite-hotels-paris', 'fil' => 'Hôtels & palaces', 'photo' => P_OREILLETTE, 'pos' => '50% 25%',
    'title' => 'Sécurité hôtel à Paris : agents pour hôtels et palaces | BDA Sécurité',
    'description' => 'Agents de sécurité pour hôtels, palaces et résidences de tourisme à Paris : sûreté des clients, contrôle des accès, rondes de nuit, VIP. Agents CNAPS, devis gratuit.',
    'kicker' => 'Secteur hôtellerie · Paris', 'h1' => 'Sécurité des hôtels <em>et palaces à Paris.</em>',
    'lead' => 'Des agents discrets et élégants qui protègent vos clients, votre personnel et votre établissement, sans jamais troubler l’expérience de séjour.',
    'k1' => 'L’hôtellerie haut de gamme', 'h2a' => 'La sécurité au service <em>de l’hospitalité.</em>',
    'intro' => [
      'Dans un hôtel, la sécurité doit être <strong>efficace et invisible</strong>. Nos agents s’intègrent à vos équipes d’accueil : tenue soignée, langage courtois, attention permanente aux allées et venues.',
      'Nous sécurisons les halls, les étages, les accès de service et les parkings, et nous renforçons le dispositif lors des arrivées de personnalités, des événements privés ou des périodes de forte affluence.',
    ],
    'h2b' => 'Nos missions <em>en hôtellerie.</em>',
    'cartes' => [
      ['lock', 'Contrôle des accès', 'Surveillance du hall, des ascenseurs et des accès de service ; filtrage discret des personnes non autorisées.'],
      ['clock', 'Rondes de nuit', 'Rondes régulières dans les étages, parkings et locaux techniques, main courante tenue à jour.'],
      ['user', 'Accueil des VIP', 'Arrivées discrètes, accompagnement jusqu’à la chambre, coordination avec les équipes de protection.'],
      ['ticket', 'Événements & réceptions', 'Galas, mariages, séminaires dans vos salons : un dispositif dimensionné et élégant.'],
    ],
    'h2c' => 'Un partenaire <em>à la hauteur de vos clients.</em>',
    'points' => [['Des agents présentables', 'qui respectent les codes de l’hôtellerie de luxe.'], ['Discrétion absolue', 'sur l’identité et les habitudes de vos clients.'], ['Renforts rapides', 'pour vos pics d’activité et vos événements.'], ['Agents titulaires de la carte CNAPS', 'et entreprise autorisée.'], ['Un responsable unique', 'joignable 24h/24.']],
    'faq' => [
      ['Vos agents peuvent-ils travailler en tenue de ville ?', 'Oui. Selon votre établissement, nos agents interviennent en costume sombre ou dans une tenue adaptée à votre charte, pour rester discrets.'],
      ['Proposez-vous une présence la nuit uniquement ?', 'Oui : de nombreux hôtels nous confient la sécurité de nuit (rondes, accueil tardif, surveillance des accès), avec ou sans présence en journée.'],
      ['Pouvez-vous sécuriser l’arrivée d’une personnalité ?', 'Oui. Nous organisons l’accueil, le cheminement et la surveillance des étages, et nous pouvons coordonner un chauffeur VTC et un agent de protection.'],
    ],
    'boite' => 'Sécuriser votre hôtel ?', 'cta' => 'Offrez à vos clients <em>une sécurité cinq étoiles.</em>',
  ],
  [
    'slug' => 'securite-commerces-paris', 'fil' => 'Commerces & boutiques', 'photo' => P_AGENT, 'pos' => '50% 30%',
    'title' => 'Agent de sécurité magasin à Paris : boutiques, luxe, commerces | BDA Sécurité',
    'description' => 'Agents de sécurité pour boutiques, magasins de luxe et commerces à Paris : prévention des vols, accueil, filtrage, fermeture. Agents CNAPS, devis gratuit, 7j/7.',
    'kicker' => 'Secteur commerce · Paris', 'h1' => 'Sécurité des commerces <em>et boutiques.</em>',
    'lead' => 'Un agent à l’entrée change tout : moins de vols, des clients rassurés et une équipe de vente plus sereine, en semaine comme le dimanche.',
    'k1' => 'Commerce & retail', 'h2a' => 'Prévenir les vols <em>sans effrayer vos clients.</em>',
    'intro' => [
      'Boutiques de luxe, concept-stores, bijouteries, supérettes ou grands magasins : nos agents assurent une <strong>présence dissuasive</strong> tout en accueillant vos clients avec le sourire.',
      'Nous adaptons le dispositif à vos horaires d’ouverture, aux soldes, aux fêtes de fin d’année et aux lancements de collection, avec des renforts ponctuels quand l’affluence augmente.',
    ],
    'h2b' => 'Nos missions <em>en boutique.</em>',
    'cartes' => [
      ['shield-check', 'Prévention des vols', 'Présence visible à l’entrée, surveillance des rayons et réaction adaptée en cas de suspicion.'],
      ['user', 'Accueil & orientation', 'Un agent courtois qui accueille, oriente et rassure votre clientèle.'],
      ['lock', 'Ouverture & fermeture', 'Présence lors des manipulations de caisse, des livraisons et de la fermeture du magasin.'],
      ['ticket', 'Soldes & lancements', 'Gestion des files d’attente et renforts lors des événements commerciaux.'],
    ],
    'h2c' => 'Pourquoi les commerçants <em>nous font confiance.</em>',
    'points' => [['Des agents formés à la relation client', ', jamais agressifs.'], ['Missions ponctuelles ou régulières', ', y compris le dimanche.'], ['Renforts pour les pics d’affluence', 'et les fêtes de fin d’année.'], ['Agents titulaires de la carte CNAPS', 'et entreprise autorisée.'], ['Un devis clair', ', au nombre d’heures réel.']],
    'faq' => [
      ['Un agent peut-il fouiller un client soupçonné de vol ?', 'Non : un agent ne peut pas fouiller un client, seulement lui demander de présenter volontairement le contenu de son sac et, en cas de flagrant délit, le retenir le temps de l’arrivée de la police.'],
      ['Pouvez-vous intervenir seulement pendant les soldes ?', 'Oui. Nous proposons des renforts ponctuels pour les soldes, les fêtes et les lancements de collection.'],
      ['Vos agents peuvent-ils porter la tenue de la boutique ?', 'Oui, selon votre souhait : costume sombre, tenue siglée ou tenue fournie par l’enseigne.'],
    ],
    'boite' => 'Un agent pour votre boutique ?', 'cta' => 'Protégez votre boutique <em>et vos équipes.</em>',
  ],
  [
    'slug' => 'gardiennage-chantier-paris', 'fil' => 'Chantiers', 'photo' => P_SECURITE, 'pos' => '50% 70%', 'service' => 'gardiennage',
    'title' => 'Gardiennage de chantier à Paris et en Île-de-France | BDA Sécurité',
    'description' => 'Gardiennage de chantier à Paris et en Île-de-France : surveillance de nuit et du week-end, rondes, contrôle des livraisons, prévention des vols de matériel. Devis gratuit.',
    'kicker' => 'Secteur BTP · Île-de-France', 'h1' => 'Gardiennage <em>de chantier.</em>',
    'lead' => 'Vols de matériel, de câbles ou de carburant, dégradations, squats : nos agents surveillent votre chantier la nuit, le week-end et pendant les congés.',
    'k1' => 'BTP & promotion immobilière', 'h2a' => 'Votre chantier protégé, <em>même quand il est fermé.</em>',
    'intro' => [
      'Un chantier fermé est une cible. Nos agents assurent une <strong>présence humaine continue</strong> ou des rondes régulières, contrôlent les accès et signalent immédiatement toute anomalie.',
      'Nous intervenons sur les chantiers de construction, de réhabilitation et de démolition à Paris et en Île-de-France, pour les entreprises du BTP, les promoteurs et les maîtres d’ouvrage.',
    ],
    'h2b' => 'Nos missions <em>sur chantier.</em>',
    'cartes' => [
      ['clock', 'Surveillance de nuit', 'Présence statique ou rondes régulières entre la fermeture et l’ouverture du chantier.'],
      ['building', 'Week-ends & congés', 'Gardiennage continu pendant les fermetures, y compris jours fériés et congés d’été.'],
      ['lock', 'Contrôle des accès', 'Vérification des entrées, des livraisons et des sous-traitants aux heures d’activité.'],
      ['shield-check', 'Rapport de ronde', 'Compte rendu des passages et des incidents, transmis au conducteur de travaux.'],
    ],
    'h2c' => 'Moins de pertes, <em>moins de retards.</em>',
    'points' => [['Prévention des vols de matériel', 'et d’engins.'], ['Démarrage possible rapidement', 'selon nos disponibilités.'], ['Dispositif ajusté à chaque phase', 'du chantier.'], ['Agents titulaires de la carte CNAPS', 'et entreprise autorisée.'], ['Un responsable joignable 24h/24', 'pour vos équipes.']],
    'faq' => [
      ['Quelle différence entre rondes et gardiennage statique ?', 'En statique, un agent reste sur place en permanence. Les rondes consistent en passages réguliers : moins coûteux, adapté aux chantiers moins exposés.'],
      ['Intervenez-vous hors de Paris ?', 'Oui, dans toute l’Île-de-France : Hauts-de-Seine, Seine-Saint-Denis, Val-de-Marne, et au-delà selon la mission.'],
      ['Combien de temps dure une mission de gardiennage de chantier ?', 'De quelques nuits à plusieurs mois : le contrat suit le planning de votre chantier et peut être ajusté à tout moment.'],
    ],
    'boite' => 'Protéger votre chantier ?', 'cta' => 'Votre chantier sous surveillance <em>dès cette nuit.</em>',
  ],
  [
    'slug' => 'securite-bureaux-entreprises-paris', 'fil' => 'Bureaux & sièges sociaux', 'photo' => P_OREILLETTE, 'pos' => '50% 30%',
    'title' => 'Sécurité de bureaux et d’entreprises à Paris : accueil, contrôle d’accès | BDA',
    'description' => 'Agents de sécurité pour bureaux, sièges sociaux et entreprises à Paris : accueil, contrôle d’accès, sûreté des collaborateurs, rondes. Agents CNAPS, devis gratuit.',
    'kicker' => 'Entreprises · Paris & La Défense', 'h1' => 'Sécurité des bureaux <em>et des entreprises.</em>',
    'lead' => 'Accueil des visiteurs, contrôle des accès, sûreté de vos collaborateurs : une sécurité professionnelle qui valorise l’image de votre entreprise.',
    'k1' => 'Sièges sociaux & espaces de travail', 'h2a' => 'La sécurité <em>au cœur de votre entreprise.</em>',
    'intro' => [
      'Nos agents assurent l’<strong>accueil sécurité</strong> de vos locaux : enregistrement des visiteurs, remise des badges, orientation, et surveillance des accès pendant les heures de bureau.',
      'En dehors des horaires, nous assurons des rondes et la fermeture des locaux. Pour vos séminaires, assemblées générales ou visites officielles, nous renforçons le dispositif.',
    ],
    'h2b' => 'Nos missions <em>en entreprise.</em>',
    'cartes' => [
      ['user', 'Accueil sécurité', 'Enregistrement des visiteurs, badges, orientation : un premier contact professionnel.'],
      ['lock', 'Contrôle des accès', 'Surveillance des entrées, des parkings et des zones sensibles.'],
      ['clock', 'Rondes & fermeture', 'Vérification des locaux, des issues et des alarmes en fin de journée.'],
      ['ticket', 'Événements internes', 'Séminaires, AG, visites officielles : un dispositif renforcé et discret.'],
    ],
    'h2c' => 'Une image soignée, <em>des locaux protégés.</em>',
    'points' => $pointsCommuns,
    'faq' => [
      ['Pouvez-vous assurer l’accueil et la sécurité avec le même agent ?', 'Oui : c’est la mission d’agent d’accueil sécurité, idéale pour les bureaux et sièges sociaux.'],
      ['Intervenez-vous à La Défense ?', 'Oui, ainsi que dans tous les quartiers d’affaires de Paris et d’Île-de-France.'],
      ['Proposez-vous des contrats à l’année ?', 'Oui. Nous assurons des présences régulières, avec des agents habitués à vos locaux et à vos consignes.'],
    ],
    'boite' => 'Sécuriser vos bureaux ?', 'cta' => 'Une entreprise sereine, <em>des équipes rassurées.</em>',
  ],
  [
    'slug' => 'securite-ambassades-consulats-paris', 'fil' => 'Ambassades & consulats', 'photo' => P_OREILLETTE, 'pos' => '50% 25%',
    'title' => 'Sécurité d’ambassades et de consulats à Paris | BDA Sécurité',
    'description' => 'Sécurité des représentations diplomatiques à Paris : agents pour ambassades, consulats et institutions, contrôle d’accès, accueil du public, discrétion absolue. Référence : Consulat général de Colombie.',
    'kicker' => 'Institutions & diplomatie · Paris', 'h1' => 'Sécurité des ambassades <em>et consulats.</em>',
    'lead' => 'Accueil du public, contrôle des accès, discrétion absolue : nous accompagnons les représentations diplomatiques avec la rigueur qu’elles exigent.',
    'k1' => 'Notre expérience diplomatique', 'h2a' => 'La confiance <em>d’une représentation diplomatique.</em>',
    'intro' => [
      'Nous assurons aujourd’hui la sécurité du <strong>Consulat général de Colombie à Paris</strong>, une collaboration toujours en cours. Cette expérience nous a appris les exigences propres aux institutions : ponctualité, discrétion, respect des protocoles.',
      'Nos agents gèrent l’accueil et le filtrage du public, les files d’attente des jours d’affluence, la surveillance des accès et la sécurité des événements officiels. <a href="references">Découvrir nos références</a>.',
    ],
    'h2b' => 'Nos missions <em>pour les institutions.</em>',
    'cartes' => [
      ['lock', 'Contrôle des accès', 'Filtrage des entrées, contrôle des rendez-vous et gestion des files d’attente.'],
      ['user', 'Accueil du public', 'Des agents courtois, patients et rigoureux, capables d’orienter chaque visiteur.'],
      ['ticket', 'Réceptions officielles', 'Fête nationale, visites de délégations, réceptions : dispositif sur mesure.'],
      ['shield-check', 'Protection des personnalités', 'Accompagnement discret de diplomates et de délégations, avec chauffeur si besoin.'],
    ],
    'h2c' => 'Rigueur, discrétion, <em>fiabilité.</em>',
    'points' => [['Une référence diplomatique actuelle', ': le Consulat général de Colombie à Paris.'], ['Confidentialité garantie', 'sur les personnes et les lieux.'], ['Respect strict des protocoles', 'et des consignes de la représentation.'], ['Agents titulaires de la carte CNAPS', 'et entreprise autorisée.'], ['Un interlocuteur unique', 'joignable 24h/24.']],
    'faq' => [
      ['Travaillez-vous déjà pour une représentation diplomatique ?', 'Oui : nous assurons la sécurité du Consulat général de Colombie à Paris, une collaboration toujours en cours.'],
      ['Vos agents peuvent-ils gérer l’accueil d’un public nombreux ?', 'Oui : gestion des files d’attente, vérification des rendez-vous et orientation font partie de nos missions courantes.'],
      ['Pouvez-vous organiser l’escorte d’une délégation ?', 'Oui, en associant un chauffeur VTC haut de gamme et un agent de protection rapprochée.'],
    ],
    'boite' => 'Une mission diplomatique ?', 'cta' => 'La sécurité <em>que les institutions exigent.</em>',
  ],
  [
    'slug' => 'securite-residences-coproprietes-paris', 'fil' => 'Résidences & copropriétés', 'photo' => P_AGENT, 'pos' => '50% 30%',
    'title' => 'Gardiennage de résidences et copropriétés à Paris | BDA Sécurité',
    'description' => 'Sécurité de résidences, copropriétés et immeubles à Paris : rondes, présence de nuit, lutte contre les squats et les intrusions, sécurité des parkings. Devis gratuit pour syndics et particuliers.',
    'kicker' => 'Résidentiel · Paris & Île-de-France', 'h1' => 'Sécurité des résidences <em>et copropriétés.</em>',
    'lead' => 'Intrusions, squats de halls, parkings dégradés : nos agents rétablissent la tranquillité des résidents, pour les syndics, bailleurs et propriétaires.',
    'k1' => 'Syndics, bailleurs & propriétaires', 'h2a' => 'La tranquillité <em>des résidents d’abord.</em>',
    'intro' => [
      'Nous intervenons dans les <strong>résidences, copropriétés et immeubles</strong> pour une présence dissuasive, des rondes de nuit, la sécurisation des parkings et des halls.',
      'Pour les particuliers, nous assurons aussi la surveillance d’une villa ou d’un appartement pendant une absence, des travaux ou un événement familial.',
    ],
    'h2b' => 'Nos missions <em>en résidentiel.</em>',
    'cartes' => [
      ['clock', 'Rondes de nuit', 'Passages réguliers dans les halls, parkings et espaces communs.'],
      ['building', 'Lutte contre les squats', 'Présence dissuasive et signalement immédiat aux forces de l’ordre.'],
      ['lock', 'Parkings & accès', 'Surveillance des parkings souterrains et contrôle des accès à la résidence.'],
      ['user', 'Particuliers', 'Surveillance de votre domicile pendant une absence ou un événement privé.'],
    ],
    'h2c' => 'Des résidents <em>enfin rassurés.</em>',
    'points' => $pointsCommuns,
    'faq' => [
      ['Travaillez-vous avec les syndics de copropriété ?', 'Oui. Nous établissons un devis adapté au vote en assemblée générale et un rapport régulier des interventions.'],
      ['Un agent peut-il faire partir des personnes d’un hall ?', 'Un agent peut demander aux personnes non autorisées de quitter les lieux et alerter la police si nécessaire ; il ne peut pas les expulser par la force.'],
      ['Surveillez-vous des maisons de particuliers ?', 'Oui : pendant vos vacances, des travaux ou une réception, en présence continue ou en rondes.'],
    ],
    'boite' => 'Sécuriser votre résidence ?', 'cta' => 'Rendez la tranquillité <em>à vos résidents.</em>',
  ],
];

$zones = [
  zone('agent-securite-paris-8', 'Paris 8ᵉ', 'Paris 8ᵉ', 'dans le 8ᵉ arrondissement', 'Paris 8e arrondissement', [
    'Champs-Élysées, avenue Montaigne, faubourg Saint-Honoré, triangle d’or : le <strong>8ᵉ arrondissement</strong> concentre boutiques de luxe, sièges sociaux, hôtels prestigieux et ambassades. Les attentes en matière de sécurité y sont élevées.',
    'Nos agents y assurent la sécurité de boutiques, de bureaux, d’événements de marque et de personnalités, avec la tenue et la discrétion qu’exige ce quartier.',
  ], 'nous pouvons intervenir rapidement dans le 8ᵉ : il est à une vingtaine de minutes de notre base', P_OREILLETTE, $cartesZone, $faqZone, $pointsCommuns),
  zone('agent-securite-paris-16', 'Paris 16ᵉ', 'Paris 16ᵉ', 'dans le 16ᵉ arrondissement', 'Paris 16e arrondissement', [
    'Trocadéro, Passy, Auteuil, avenue Foch : le <strong>16ᵉ arrondissement</strong> accueille de nombreuses ambassades, résidences de standing et familles qui recherchent une sécurité discrète.',
    'Nous y sécurisons des résidences privées, des réceptions, des représentations diplomatiques et accompagnons des personnalités lors de leurs déplacements.',
  ], 'nous intervenons rapidement dans le 16ᵉ, de jour comme de nuit', P_EVENEMENT, $cartesZone, $faqZone, $pointsCommuns),
  zone('agent-securite-paris-17', 'Paris 17ᵉ', 'Paris 17ᵉ', 'dans le 17ᵉ arrondissement', 'Paris 17e arrondissement', [
    'Des Batignolles à la Porte Maillot et au Palais des Congrès, le <strong>17ᵉ arrondissement</strong> mêle bureaux, commerces, hôtels et grands événements professionnels.',
    'Salons et congrès, sièges d’entreprise, résidences et commerces de quartier : nous adaptons le dispositif à chaque lieu.',
  ], 'nous pouvons être dans le 17ᵉ rapidement', P_SECURITE, $cartesZone, $faqZone, $pointsCommuns),
  zone('agent-securite-paris-9', 'Paris 9ᵉ', 'Paris 9ᵉ · Opéra', 'dans le 9ᵉ arrondissement', 'Paris 9e arrondissement', [
    'Opéra, grands magasins du boulevard Haussmann, quartier des affaires Saint-Lazare : le <strong>9ᵉ arrondissement</strong> voit passer des milliers de visiteurs chaque jour.',
    'Nos agents y protègent commerces, bureaux et salles de spectacle, et renforcent la sécurité lors des périodes d’affluence.',
  ], 'nous pouvons intervenir rapidement dans le 9ᵉ', P_AGENT, $cartesZone, $faqZone, $pointsCommuns),
  zone('agent-securite-paris-1', 'Paris 1ᵉʳ', 'Paris 1ᵉʳ · Louvre', 'dans le 1ᵉʳ arrondissement', 'Paris 1er arrondissement', [
    'Louvre, place Vendôme, rue de Rivoli, Palais-Royal, Châtelet : le <strong>1ᵉʳ arrondissement</strong> réunit joaillers, palaces, boutiques et lieux culturels très fréquentés.',
    'Nous y assurons la sécurité de boutiques haut de gamme, d’hôtels et d’événements, avec des agents à la présentation irréprochable.',
  ], 'nous pouvons être sur place rapidement dans le centre de Paris', P_OREILLETTE, $cartesZone, $faqZone, $pointsCommuns),
  zone('agent-securite-paris-20', 'Paris 20ᵉ', 'Paris 20ᵉ', 'dans le 20ᵉ arrondissement', 'Paris 20e arrondissement', [
    'Notre entreprise est <strong>basée dans le 20ᵉ arrondissement</strong>, rue de la Croix Saint-Simon. Belleville, Ménilmontant, Gambetta, Porte de Montreuil : c’est notre quartier.',
    'Commerces, résidences, chantiers, salles de réception et associations du 20ᵉ et de l’est parisien profitent de notre proximité et de notre réactivité.',
  ], 'nous sommes basés dans le 20ᵉ : c’est là que nous intervenons le plus vite', P_AGENT, $cartesZone, $faqZone, $pointsCommuns),
  zone('agent-securite-la-defense', 'La Défense', 'La Défense', 'à La Défense', 'La Défense, Courbevoie, Puteaux', [
    'Premier quartier d’affaires d’Europe, <strong>La Défense</strong> rassemble tours de bureaux, centres commerciaux et espaces événementiels, entre Courbevoie, Puteaux et Nanterre.',
    'Accueil sécurité en entreprise, contrôle d’accès, événements professionnels et protection de dirigeants : nous accompagnons les sociétés du quartier.',
  ], 'nous rejoignons La Défense rapidement depuis Paris', P_SECURITE, $cartesZone, $faqZone, $pointsCommuns),
  zone('agent-securite-neuilly-sur-seine', 'Neuilly-sur-Seine', 'Neuilly-sur-Seine', 'à Neuilly-sur-Seine', 'Neuilly-sur-Seine (92)', [
    'Villas, hôtels particuliers, cabinets et sièges sociaux : <strong>Neuilly-sur-Seine</strong> attend une sécurité discrète et haut de gamme.',
    'Nous y surveillons des résidences privées, sécurisons des réceptions et accompagnons des familles et des dirigeants.',
  ], 'nous rejoignons Neuilly-sur-Seine rapidement depuis Paris', P_AGENT, $cartesZone, $faqZone, $pointsCommuns),
  zone('agent-securite-boulogne-billancourt', 'Boulogne-Billancourt', 'Boulogne-Billancourt', 'à Boulogne-Billancourt', 'Boulogne-Billancourt (92)', [
    'Sièges de grands groupes, sociétés de médias, commerces et résidences : <strong>Boulogne-Billancourt</strong> est l’une des villes les plus dynamiques des Hauts-de-Seine.',
    'Nous y assurons l’accueil sécurité d’entreprises, la surveillance de chantiers et de commerces, et la sécurité d’événements.',
  ], 'nous rejoignons Boulogne-Billancourt rapidement', P_OREILLETTE, $cartesZone, $faqZone, $pointsCommuns),
  zone('agent-securite-saint-denis', 'Saint-Denis', 'Saint-Denis', 'à Saint-Denis', 'Saint-Denis, Plaine Commune (93)', [
    'Stade de France, Plaine Saint-Denis, nouveaux quartiers d’affaires et grands chantiers : <strong>Saint-Denis</strong> accueille chaque année de très grands événements et de nombreuses entreprises.',
    'Sécurité d’événements, gardiennage de chantiers, accueil sécurité en entreprise : nous intervenons dans toute la Plaine Commune.',
  ], 'nous rejoignons Saint-Denis rapidement', P_EVENEMENT, $cartesZone, $faqZone, $pointsCommuns),
];

return ['secteurs' => $secteurs, 'zones' => $zones];
