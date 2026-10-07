<?php
/* =========================================================
   VEILLE COMMERCIALE — MOTS-CLÉS ET RÉGLAGES DU SCORE
   Le seul fichier à modifier pour ajuster la recherche.
   - Les mots sont cherchés sans tenir compte des accents ni des majuscules.
   - Chaque mot trouvé ajoute (ou retire) ses points au score de l'avis.
   - Un avis est gardé s'il a au moins un mot « positif » et un score >= garder_a_partir_de.
   ========================================================= */
return [
  // Départements surveillés (Île-de-France)
  'departements' => ['75', '77', '78', '91', '92', '93', '94', '95'],

  // Nombre de jours d'avis récupérés : premier lancement, puis lancements suivants
  'jours_premier_lancement' => 14,
  'jours_ensuite' => 3,

  // Mots qui font monter le score — sécurité privée
  'securite' => [
    'gardiennage' => 45,
    'surveillance humaine' => 45,
    'agent de securite' => 40,
    'agents de securite' => 40,
    'agent de surete' => 35,
    'agents de surete' => 35,
    'prestations de securite' => 35,
    'prestation de securite' => 35,
    'services de securite' => 30,
    'service de securite' => 30,
    'securite evenementielle' => 45,
    'securite des evenements' => 40,
    'securite lors des manifestations' => 40,
    'protection rapprochee' => 45,
    'garde du corps' => 40,
    'cynophile' => 40,
    'maitre-chien' => 35,
    'ssiap' => 40,
    'agents de prevention' => 25,
    'prevention et securite' => 25,
    'surveillance des sites' => 30,
    'surveillance de sites' => 30,
    'surveillance des locaux' => 30,
    'surveillance des batiments' => 30,
    'accueil et securite' => 30,
    'accueil securite' => 25,
    'surete' => 20,
    'vigile' => 35,
    'rondes' => 15,
    'ronde' => 10,
    'controle d\'acces' => 15,
    'filtrage' => 15,
    'levee de doute' => 15,
    'intervention sur alarme' => 15,
    'securite incendie et surete' => 30,
    'service de securite incendie' => 35,
  ],

  // Mots qui font monter le score — chauffeur / transport de personnes
  'chauffeur' => [
    'vehicule avec chauffeur' => 50,
    'vehicules avec chauffeur' => 50,
    'voiture avec chauffeur' => 50,
    'location de vehicules avec chauffeur' => 50,
    'mise a disposition de vehicules avec chauffeur' => 50,
    'transport de personnalites' => 50,
    'transport de personnes' => 15,
    'transfert aeroport' => 40,
    'transferts aeroport' => 40,
    'navette aeroport' => 30,
    'chauffeur' => 15,
    'vtc' => 30,
    'transport protocolaire' => 45,
    'transport de delegations' => 40,
  ],

  // Codes CPV (début du code) : points ajoutés et catégorie
  'cpv' => [
    '7971' => ['points' => 50, 'type' => 'securite'],   // services de sécurité (7971xxxx)
    '60171' => ['points' => 50, 'type' => 'chauffeur'], // location de voitures particulières avec chauffeur
    '60172' => ['points' => 10, 'type' => 'chauffeur'], // location de bus et d'autocars avec chauffeur
  ],

  // Descripteurs BOAMP (catégories officielles) qui ajoutent des points
  'descripteurs' => [
    'gardiennage' => ['points' => 30, 'type' => 'securite'],
    'surveillance' => ['points' => 20, 'type' => 'securite'],
    'transport de personnes' => ['points' => 10, 'type' => 'chauffeur'],
  ],

  // Mots qui font baisser le score
  'negatifs' => [
    'fourniture' => -25,
    'fournitures' => -25,
    'installation' => -20,
    'maintenance' => -30,
    'entretien' => -15,
    'formation' => -30,
    'extincteur' => -40,
    'extincteurs' => -40,
    'alarme' => -15,
    'alarmes' => -15,
    'transport scolaire' => -50,
    'transports scolaires' => -50,
    'videoprotection' => -20,
    'videosurveillance' => -20,
    'systeme de securite incendie' => -30,
    'systemes de securite incendie' => -30,
    'ssi' => -15,
    'detection incendie' => -30,
    'desenfumage' => -30,
    'controle technique' => -30,
    'verification periodique' => -30,
    'verifications periodiques' => -30,
    'ascenseur' => -30,
    'logiciel' => -30,
    'assurance' => -30,
    'audit' => -20,
    'etude' => -20,
    'assistance a maitrise d\'ouvrage' => -40,
    'materiel' => -15,
    'travaux' => -20,
    'mise en securite' => -25,
    'securite routiere' => -30,
    'securite sociale' => -40,
    'cybersecurite' => -40,
    'securite informatique' => -40,
    'surveillance medicale' => -40,
    'surveillance des eaux' => -40,
    'surveillance et entretien' => -30,
    'nettoyage' => -10,
    'restauration' => -10,
  ],

  // Malus selon le type de marché indiqué par l'acheteur
  'type_marche' => ['TRAVAUX' => -25, 'FOURNITURES' => -25],

  // Exceptions : ces expressions gardent l'avis même dans un marché de travaux (annulent les malus « travaux »)
  'exceptions_travaux' => [
    'gardiennage de chantier', 'gardiennage du chantier', 'gardiennage des chantiers', 'surveillance de chantier',
    'surveillance du chantier', 'gardiennage pendant les travaux', 'surveillance pendant les travaux', 'gardiennage de la base vie',
  ],
  'bonus_exception' => 25,

  // Score minimum pour garder un avis (avec au moins un mot positif) et niveaux affichés
  'garder_a_partir_de' => 10,
  'niveau_fort' => 60,    // 🟢 très pertinent
  'niveau_moyen' => 35,   // 🟡 à regarder (en dessous : ⚪ faible)

  // Notifications : niveau minimum pour prévenir (Discord / téléphone) et pour le rappel J-3
  'notifier_a_partir_du_niveau' => 'moyen', // 'fort', 'moyen' ou 'faible'
  'rappel_jours' => 3,

  // Signaux « marché trop gros ou exigeant » (badges d'alerte)
  'alertes' => [
    'reprise du personnel' => 'Reprise de personnel',
    'reprise de personnel' => 'Reprise de personnel',
    'immeuble de grande hauteur' => 'IGH',
    ' igh' => 'IGH',
    'nf service 241' => 'Certification NF 241 demandée',
    'apsad' => 'Certification APSAD',
    'visite obligatoire' => 'Visite obligatoire',
    'visite du site est obligatoire' => 'Visite obligatoire',
  ],
  'gros_marche_euros' => 500000,

  // France Travail : métier ROME et exclusions (employeurs directs uniquement)
  'france_travail' => [
    'rome' => 'K2503',
    'secteurs_exclus' => ['80', '78'],
    'noms_exclus' => ['securite', 'security', 'gardiennage', 'protection', 'interim', 'surete', 'guard', 'vigile', 'prevention'],
    'textes_exclus' => [
      'pour notre client', 'pour le compte de notre client', 'pour l\'un de nos clients', 'pour un de nos clients',
      'notre client', 'societe de securite', 'entreprise de securite', 'agence de securite', 'societe de gardiennage',
      'entreprise de surete', 'societe de surete', 'cabinet de recrutement',
    ],
  ],
];
