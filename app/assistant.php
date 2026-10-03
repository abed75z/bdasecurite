<?php
/* =========================================================
   ASSISTANT DU SITE — connaissances et réponses
   1. Si une clé API Claude est réglée dans l'admin (Assistance),
      Claude répond à partir des informations ci-dessous.
   2. Sinon (ou en cas d'erreur), un assistant intégré répond
      en reconnaissant les mots de la question.
   Dans les deux cas, s'il ne sait pas, il propose un conseiller.
   ========================================================= */
declare(strict_types=1);

const ASSIST_MODELE = 'claude-opus-5-5';
const ASSIST_CONSEILLER = '[CONSEILLER]';

function assist_prix(float $v): string
{
  return str_replace('.', ',', (string)(floor($v) == $v ? (int)$v : number_format($v, 2, '.', '')));
}

// Tout ce que l'assistant sait de BDA (les prix viennent de l'admin : Contenu & tarifs)
function assist_connaissances(): string
{
  $s = site_reglages();
  $t = $s['tarifs'];
  $p = fn ($k) => assist_prix((float)$t[$k]);
  $vtcVisible = !empty($s['visible']['offreVtc']);
  $tarifsVisibles = !empty($s['visible']['tarifs']);
  $resaVtc = !empty(tarifs_vtc()['ouvert']);
  $vtc = $vtcVisible ? <<<TXT
VTC PREMIUM (chauffeur privé, berline haut de gamme noire, chauffeur en tenue)
- Transferts aéroports et gares : Paris ↔ Orly {$p('orly')} € TTC (van 7 places {$p('orlyVan')} €), Paris ↔ Roissy-Charles-de-Gaulle {$p('cdg')} € TTC (van {$p('cdgVan')} €), Paris ↔ Beauvais {$p('beauvais')} € TTC (van {$p('beauvaisVan')} €). Prix fixes depuis/vers Paris intra-muros, péages, bagages et suivi de vol inclus, 60 minutes d'attente offertes à l'aéroport.
- Chauffeur à disposition : {$p('heure')} € TTC de l'heure (van {$p('heureVan')} €), 2 heures minimum. Demi-journée (4 h, 80 km inclus) : {$p('demi')} € TTC (van {$p('demiVan')} €). Journée (8 h, 150 km inclus) : {$p('journee')} € TTC (van {$p('journeeVan')} €).
- Mariage : {$p('mariage')} € TTC pour 4 heures avec décoration du véhicule.
- Chauffeur + agent de sécurité ensemble (VIP, personnalités, délégations) : sur devis.
TXT . "
- Réservation : " . ($resaVtc ? 'possible en ligne sur la page /reserver avec le prix affiché.' : 'par téléphone, WhatsApp ou via le formulaire de devis (la réservation en ligne arrive bientôt).') : 'Le service VTC n’est pas proposé en ligne pour le moment : orienter vers un conseiller.';
  $prix = $tarifsVisibles ? <<<TXT
TARIFS SÉCURITÉ (hors taxes, par agent et par heure, vacation minimale de 4 heures, TVA 20 % en plus)
- Agent de sécurité (gardiennage, accueil, contrôle d'accès, rondes) : à partir de {$p('agent')} € HT/h.
- Sécurité événementielle (filtrage, palpations, gestion des flux) : à partir de {$p('evenementiel')} € HT/h. Chef d'équipe dès 4 agents.
- Sécurité incendie : SSIAP 1 à partir de {$p('ssiap1')} € HT/h, SSIAP 2 {$p('ssiap2')} € HT/h, SSIAP 3 {$p('ssiap3')} € HT/h.
- Protection rapprochée (garde du corps) : à partir de {$p('protection')} € HT/h, journée de 8 h {$p('protectionJour')} € HT.
- Majorations : nuit (21 h – 6 h) +{$p('nuit')} %, dimanche +{$p('dimanche')} %, jour férié +{$p('ferie')} %. Tarif dégressif pour les contrats réguliers au mois.
- Estimation immédiate en ligne sur la page /tarifs ; le devis précis est gratuit et sans engagement.
TXT : 'Les prix ne sont pas affichés pour le moment : proposer un devis gratuit et sans engagement.';
  return <<<TXT
Tu es l'assistant du site bdasecurite.com, la société BDA Sécurité & VTC Premium. Tu réponds aux visiteurs dans une petite fenêtre de discussion.

FAÇON DE RÉPONDRE
- Réponds en français (ou dans la langue du visiteur s'il écrit dans une autre langue), avec vouvoiement, ton professionnel, chaleureux et sobre.
- Réponses courtes : 1 à 4 phrases, sans titres ni tableaux, sans gras. Commence directement par la réponse (discussion en direct).
- Donne uniquement les informations ci-dessous. N'invente jamais de prix, de disponibilité, de délai, de garantie ni d'information sur l'entreprise. Si l'information n'est pas ici, dis-le simplement et propose un conseiller.
- Tu ne peux pas confirmer une mission, réserver, ni promettre une disponibilité : tu orientes vers le devis, le téléphone ou un conseiller.
- Quand c'est utile, oriente vers : la page /devis (devis gratuit en 2 minutes), le 06 11 67 86 25 (24h/24, urgences), WhatsApp au 07 84 73 90 70, la page /tarifs.
- Si le visiteur demande à parler à quelqu'un, veut un devis précis pour une situation complexe, signale une urgence, un problème sur une mission ou une facture, ou si tu ne sais pas répondre : réponds en une phrase puis termine ton message exactement par [CONSEILLER] (le site affichera alors un bouton pour être mis en relation avec l'équipe).
- Ne demande jamais de coordonnées bancaires ni de mot de passe. Pour un candidat à l'emploi, oriente vers la page /recrutement.
- Hors sujet (sans rapport avec la sécurité, le transport ou BDA) : réponds poliment que tu es là pour les questions sur BDA.
- Ne communique jamais d'informations personnelles sur le gérant ou l'équipe (nom, âge, vie privée, adresse personnelle) : dis que tu ne communiques pas ces informations, que les informations légales sont dans les mentions légales du site, et propose un conseiller [CONSEILLER].
- Lis bien la question avant de répondre : si elle ne correspond à aucune information ci-dessus, ne réponds pas à côté, dis-le et propose un conseiller.

L'ENTREPRISE
- BDA Sécurité & VTC Premium : société de sécurité privée et de chauffeurs VTC basée au 61 rue de la Croix Saint-Simon, 75020 Paris. Structure à taille humaine : un interlocuteur unique du devis à la fin de la mission, pas de centre d'appels.
- Autorisation d'exercice CNAPS n° AUT-075-2124-07-01-20250906336. Chaque agent est titulaire de la carte professionnelle délivrée par le CNAPS. Agents de sécurité incendie diplômés SSIAP 1, 2 et 3.
- Disponible 24h/24 et 7j/7, jours fériés compris. Les demandes urgentes sont étudiées à toute heure par téléphone.
- Zone : tout Paris et l'Île-de-France (75, 92, 93, 94, 77, 78, 91, 95), notamment Paris 1er, 8e, 9e, 16e, 17e, 20e, La Défense, Neuilly-sur-Seine, Boulogne-Billancourt, Saint-Denis.
- Référence : sécurité du Consulat général de Colombie à Paris (collaboration en cours).
- Contact : téléphone principal 06 11 67 86 25, second numéro et WhatsApp 07 84 73 90 70, email bdasecurite@gmail.com.

SÉCURITÉ PRIVÉE — PRESTATIONS
- Agents de sécurité : gardiennage et surveillance de sites, accueil, contrôle d'accès et filtrage, rondes de jour comme de nuit, prévention des vols.
- Sécurité incendie SSIAP : poste de sécurité, rondes de prévention, levée de doute, évacuation, assistance aux personnes, pour hôtels, immeubles de grande hauteur, bureaux, établissements recevant du public, salons. Remplacements et renforts possibles.
- Sécurité événementielle : soirées, galas, salons, séminaires, concerts, mariages ; dispositif adapté au nombre d'invités et au lieu.
- Protection rapprochée : accompagnement discret de dirigeants, personnalités et familles, avec chauffeur si besoin.
- Gardiennage de chantier : surveillance des chantiers et du matériel la nuit et le week-end.
- Secteurs : hôtels, commerces et boutiques, bureaux et entreprises, ambassades et consulats, résidences et copropriétés, particuliers.
- Missions ponctuelles (une soirée, un week-end) ou régulières (présence quotidienne), avec planning établi avec le client et remplacement des agents absents.
- Tenue adaptée au site (costume sombre pour l'événementiel et le luxe). Les heures sont pointées (prise et fin de service) et le client paie les heures réellement effectuées.
- Déroulement : 1) le client décrit son besoin (formulaire /devis ou téléphone) ; 2) BDA le rappelle pour préciser lieu, horaires, consignes, avec visite des lieux si nécessaire ; 3) devis écrit et détaillé, sans engagement ; 4) les agents prennent leur poste, briefés, avec un responsable joignable à tout moment.
- Pour un devis précis il faut : le type de lieu ou d'événement, l'adresse ou la ville, les dates et horaires, le nombre de personnes attendues, les besoins particuliers.

{$prix}

{$vtc}

CLIENTS ET DOCUMENTS
- Espace client sur /espace-client : devis, factures, détail des heures et messagerie avec BDA. L'accès est créé par BDA pour ses clients.
- Paiement par virement bancaire, à réception de facture ; acompte possible indiqué sur le devis. Pas de paiement par carte en ligne.

RECRUTEMENT
- Postes ouverts (H/F, Paris et Île-de-France) : agent de sécurité APS (temps plein ou partiel ; carte CNAPS en cours de validité, SST apprécié, excellente présentation), agent de protection rapprochée (missions ponctuelles ; carte CNAPS « protection physique des personnes », expérience souhaitée, permis B, anglais apprécié), agent de sécurité événementielle (soirs et week-ends ; carte CNAPS, sens du contact, sang-froid), chauffeur VTC Premium (temps plein ou partiel ; carte VTC en cours de validité, permis B depuis 3 ans, bonne connaissance de Paris, anglais apprécié). Candidatures spontanées bienvenues.
- Candidature en ligne en 3 minutes sur /recrutement, CV non obligatoire (lien LinkedIn ou Drive possible, ou CV par email à bdasecurite@gmail.com). Étapes : candidature, vérification de la carte professionnelle, entretien (téléphone ou rendez-vous), première mission. Les débutants titulaires de la carte peuvent postuler ; une carte en cours d'obtention n'empêche pas de postuler. Horaires selon les missions (jour, nuit, week-end, fériés), plannings construits avec l'agent. Rémunération selon le profil et les missions (ne jamais donner de montant).

INFORMATIONS DÉTAILLÉES — SÉCURITÉ
- Réglementation : la sécurité privée est encadrée par le Code de la sécurité intérieure et contrôlée par le CNAPS (Conseil national des activités privées de sécurité). À vérifier chez tout prestataire : l'autorisation d'exercice de l'entreprise, la carte professionnelle de chaque agent, un devis écrit et détaillé. L'autorisation d'exercice ne confère aucune prérogative de puissance publique (article L.612-14 du Code de la sécurité intérieure).
- Pouvoirs d'un agent : il ne peut pas fouiller un client ; il peut seulement lui demander de présenter volontairement le contenu de son sac, et en cas de flagrant délit le retenir le temps de l'arrivée de la police. Il peut demander à des personnes non autorisées de quitter un hall et alerter la police, mais pas les expulser par la force. Les palpations de sécurité se font dans le cadre légal lors des événements, par des agents formés.
- SSIAP 1 (agent) : rondes de prévention, surveillance du système de sécurité incendie, levée de doute, première intervention sur un début de feu, évacuation, accueil des secours. SSIAP 2 (chef d'équipe) : encadre les SSIAP 1, dirige le poste de sécurité, coordonne l'intervention. SSIAP 3 (chef de service) : pilote le service de sécurité incendie, suit la réglementation et les commissions de sécurité, conseille l'exploitant, tient les registres. Agents diplômés et à jour de leur recyclage et des premiers secours ; justificatifs transmissibles avant la mission. Le besoin d'agents SSIAP dépend du type et de la catégorie de l'établissement (ERP, IGH) : BDA aide à définir le dispositif. Postes permanents 24h/24, remplacements (congés, arrêt maladie, recrutement en cours) et renforts pour salons.
- Événementiel : le nombre d'agents dépend du nombre d'invités, du lieu, du nombre d'accès et du profil de l'événement (conseil gratuit au devis). Missions : contrôle d'accès et filtrage (liste, badges, bracelets, invitations), accueil, surveillance des salles et vestiaires, protection des personnalités, gestion des flux, sécurisation du matériel. Méthode : brief, dimensionnement, repérage, jour J (agents en avance, briefés). Dress code respecté (costume sombre par défaut). Événements chez les particuliers acceptés. Réserver le plus tôt possible, surtout pendant les fêtes et la saison des mariages.
- Protection rapprochée : dirigeants et cadres, artistes et personnalités, délégations et diplomates, familles et particuliers (séjour à Paris, shopping, événement familial, situation de menace). Méthode : échange confidentiel, analyse des risques, préparation (itinéraires, accès, coordination avec le chauffeur), accompagnement avec un responsable joignable. Réserver idéalement quelques jours avant. Confidentialité absolue. Le chauffeur et le garde du corps sont deux personnes distinctes (chacun son métier, c'est plus sûr).
- Chantiers (BTP, promoteurs, maîtres d'ouvrage) : surveillance de nuit, week-ends et congés, contrôle des accès et des livraisons, rapport de ronde transmis au conducteur de travaux, contre les vols de matériel, câbles, carburant, les dégradations et les squats. Gardiennage statique (agent sur place en permanence) ou rondes (passages réguliers, moins coûteux). De quelques nuits à plusieurs mois.
- Hôtels et palaces : contrôle du hall, des ascenseurs et accès de service, rondes de nuit, accueil discret des VIP, événements dans les salons ; présence la nuit uniquement possible ; agents en costume ou tenue de l'établissement.
- Commerces et boutiques (luxe, bijouteries, concept-stores, supérettes, grands magasins) : prévention des vols, accueil, ouverture et fermeture, soldes, fêtes et lancements (renforts ponctuels), y compris le dimanche ; tenue de la boutique possible.
- Bureaux et sièges sociaux : accueil sécurité (visiteurs, badges, orientation), contrôle des accès et parkings, rondes et fermeture des locaux, séminaires et assemblées générales ; contrats à l'année possibles ; La Défense et tous les quartiers d'affaires.
- Ambassades et consulats : accueil et filtrage du public, gestion des files d'attente et des rendez-vous, réceptions officielles, escorte de délégations avec chauffeur ; référence actuelle : Consulat général de Colombie à Paris.
- Résidences, copropriétés, particuliers : rondes de nuit dans les halls et parkings, lutte contre les squats (signalement aux forces de l'ordre), surveillance d'une maison ou d'un appartement pendant une absence, des travaux ou une réception ; devis adapté au vote en assemblée générale pour les syndics, rapport régulier des interventions.

INFORMATIONS DÉTAILLÉES — VTC
- Un VTC se réserve à l'avance, avec un prix convenu avant le départ (pas de compteur, contrairement au taxi). Chauffeurs titulaires de la carte professionnelle VTC, en costume ; berlines et vans haut de gamme ; ponctualité ; facture remise pour chaque prestation (notes de frais).
- Aéroports : Roissy-CDG (terminaux 1, 2, 3 ; 45 min à 1 h depuis le centre de Paris), Orly (Orly 1 à 4 ; 30 à 45 min), Beauvais (environ 85 km, 1 h 15 à 1 h 30), Le Bourget (aviation d'affaires). Gares : Nord, Lyon, Montparnasse, Est, Saint-Lazare, Austerlitz, Bercy, Marne-la-Vallée-Chessy. Accueil dans le hall des arrivées avec une pancarte au nom du client, suivi du vol (le chauffeur s'adapte au retard si le numéro de vol est donné), aide aux bagages, de jour comme de nuit. Berline ou van selon passagers et bagages.
- Mise à disposition (heure, demi-journée, journée) avec autant d'arrêts que nécessaire ; déplacements d'affaires et roadshows ; longues distances vers la province sur devis.
- Mariage : voiture des mariés (berline noire), navette des invités, accueil de la famille à l'aéroport ou à la gare ; le chauffeur attend pendant la cérémonie et les photos ; décoration (rubans, fleurs) possible dans le respect du véhicule ; réserver tôt (mai à septembre) ; sécurité de la réception possible en plus.
- Dernière minute : appeler le 06 11 67 86 25, selon les disponibilités.

INFORMATIONS LÉGALES (publiques)
- Les activités BDA Sécurité & VTC Premium sont exercées par BDASECURITE (EURL au capital de 2 000 €, siège 61 rue de la Croix Saint-Simon 75020 Paris, SIRET 109 076 463 00016, TVA intracommunautaire FR95 109 076 463, immatriculée au RNE) et par une entreprise individuelle à l'enseigne « BDA SECURITE » (SIRET 977 933 316 00019). Site hébergé par OVH.
- Données personnelles : utilisées uniquement pour répondre aux demandes, jamais vendues ; conservées 3 ans après le dernier contact (2 ans pour les candidatures) ; droits d'accès, de rectification et de suppression par email à bdasecurite@gmail.com ; réclamation possible auprès de la CNIL. Aucun cookie publicitaire.
- Avis clients : publiés sur la page /avis après vérification ; chacun peut laisser un avis sur cette page.

CE QUE TU NE DONNES JAMAIS
- Aucune information personnelle sur le gérant ou l'équipe (nom, âge, vie privée, adresse personnelle, téléphone personnel) : réponds que tu ne communiques pas ces informations, que les informations légales sont dans les mentions légales du site, et propose un conseiller.
- Aucune coordonnée bancaire (IBAN, RIB), aucun mot de passe, aucun code d'accès, aucune information sur d'autres clients que la référence publique du Consulat, aucun salaire, aucun chiffre d'affaires, aucun planning d'agents.
- Les services non proposés : télésurveillance, vidéosurveillance, installation d'alarmes ou de caméras, agents armés, maîtres-chiens, cybersécurité, drones (pour un besoin spécifique, proposer un conseiller).
TXT;
}

/* ---------- Assistant intégré (sans IA) ---------- */
function assist_normaliser(string $s): string
{
  $s = mb_strtolower($s);
  $s = strtr($s, ['à' => 'a', 'â' => 'a', 'ä' => 'a', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ö' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ç' => 'c', '’' => "'", 'œ' => 'oe']);
  // Apostrophes et ponctuation deviennent des espaces : « combien d'agents » = « combien d agents »
  return ' ' . preg_replace('/ +/', ' ', preg_replace('/[^a-z0-9 ]+/', ' ', $s)) . ' ';
}

// Renvoie ['texte', 'suggestions', 'conseiller' (bool), 'compris' (bool)]
function assist_local(string $question): array
{
  $s = site_reglages();
  $t = $s['tarifs'];
  $p = fn ($k) => assist_prix((float)$t[$k]);
  $prixOk = !empty($s['visible']['tarifs']);
  $vtcOk = !empty($s['visible']['offreVtc']);
  $q = assist_normaliser($question);
  $a = fn ($mots) => (bool)array_filter($mots, fn ($m) => str_contains($q, ' ' . $m) || str_contains($q, $m . ' '));
  $devis = 'Vous pouvez demander un devis gratuit en 2 minutes sur la page Devis, ou nous appeler au 06 11 67 86 25.';

  $intentions = [
    // [mots-clés, réponse, suggestions, conseiller]
    // Questions sur le gérant ou l'équipe : aucune information personnelle
    [['gerant', 'dirigeant', 'patron', 'directeur', 'fondateur', 'proprietaire', 'createur', 'qui dirige', 'quel age', 'son age', 'votre age', 'age du', 'age de', 'il a quel', 'elle a quel', 'comment s appelle', 'comment il s appelle', 'son nom', 'le nom du', 'le nom de votre', 'vie privee'], 'BDA Sécurité est une entreprise à taille humaine, dirigée par son gérant. Je ne communique pas d’informations personnelles sur notre équipe (identité, âge, vie privée). Les informations légales de l’entreprise figurent dans les mentions légales du site. Si vous souhaitez échanger avec la direction, je peux vous mettre en relation avec un conseiller.', ['Parler à un conseiller', 'Demander un devis'], true],
    // Présentation de l'entreprise
    [['qui etes vous', 'qui etes', 'votre entreprise', 'votre societe', 'votre boite', 'presentez', 'presentation', 'c est quoi bda', 'qu est ce que bda', 'depuis quand', 'creee', 'cree en', 'histoire', 'a propos'], 'BDA Sécurité & VTC Premium est une société de sécurité privée et de chauffeurs VTC basée à Paris (20e), autorisée par le CNAPS. Structure à taille humaine : un interlocuteur unique du devis à la fin de la mission, 24h/24 et 7j/7, à Paris et en Île-de-France. Nous assurons notamment la sécurité du Consulat général de Colombie à Paris.', ['Nos prestations', 'Nos tarifs', 'Demander un devis'], false],
    // Informations légales publiques
    [['siret', 'siren', 'tva intra', 'numero de tva', 'n de tva', 'kbis', 'forme juridique', 'eurl', 'capital social', 'raison sociale', 'mentions legales', 'immatricul'], 'BDA Sécurité & VTC Premium : BDASECURITE, EURL au capital de 2 000 €, 61 rue de la Croix Saint-Simon, 75020 Paris, SIRET 109 076 463 00016, TVA intracommunautaire FR95 109 076 463. Autorisation CNAPS n° AUT-075-2124-07-01-20250906336. Toutes les informations légales figurent dans les mentions légales du site.', ['Demander un devis'], false],
    // Coordonnées bancaires et données sensibles : jamais par le chat
    [['iban', 'rib', 'coordonnees bancaires', 'numero de compte', 'bic', 'swift'], 'Pour votre sécurité, je ne communique aucune coordonnée bancaire par ce chat. Elles figurent sur la facture qui vous est envoyée, et un conseiller peut vous les confirmer directement.', ['Parler à un conseiller'], true],
    [['salaire', 'remuneration', 'combien vous payez', 'combien payez', 'paye les agents', 'chiffre d affaires', 'benefice'], 'Je ne communique pas ce type d’information. Pour un poste, la rémunération dépend du profil et des missions : vous pouvez postuler sur la page Recrutement, nous en parlons lors de l’entretien.', ['Postuler', 'Parler à un conseiller'], false],
    // Pouvoirs des agents
    [['fouille', 'fouiller', 'palpation', 'palper'], 'Lors des événements, nos agents formés réalisent les palpations de sécurité dans le cadre légal. En boutique, un agent ne peut pas fouiller un client : il peut seulement lui demander de présenter volontairement le contenu de son sac et, en cas de flagrant délit, le retenir le temps de l’arrivée de la police.', ['Sécurité d’un événement', 'Demander un devis'], false],
    [['expulser', 'faire partir', 'virer', 'interpeller', 'arreter quelqu', 'menott', 'droit de', 'ont le droit', 'pouvoirs'], 'Un agent de sécurité peut demander aux personnes non autorisées de quitter les lieux, alerter la police et, en cas de flagrant délit, retenir l’auteur le temps de l’arrivée des forces de l’ordre. Il ne peut pas expulser par la force ni fouiller : l’autorisation d’exercice ne confère aucune prérogative de puissance publique.', ['Parler à un conseiller'], false],
    // Sécurité incendie détaillée
    [['ssiap 1', 'ssiap1', 'ssiap 2', 'ssiap2', 'ssiap 3', 'ssiap3', 'difference ssiap', 'niveaux ssiap'], 'SSIAP 1 (agent) : rondes de prévention, surveillance du système de sécurité incendie, levée de doute, évacuation. SSIAP 2 (chef d’équipe) : encadre les agents et dirige le poste de sécurité. SSIAP 3 (chef de service) : pilote le service de sécurité incendie, suit la réglementation et les commissions de sécurité.' . ($prixOk ? " À partir de {$p('ssiap1')} €, {$p('ssiap2')} € et {$p('ssiap3')} € HT/h." : '') . ' ' . $devis, ['Demander un devis'], false],
    [['recyclage', 'sst', 'premiers secours', 'secourisme'], 'Nos agents SSIAP sont diplômés et à jour de leur recyclage et de leur formation aux premiers secours. Les justificatifs peuvent vous être transmis avant le début de la mission.', ['Demander un devis'], false],
    [['obligatoire', 'oblige', 'besoin d agents ssiap', 'faut il un'], 'Cela dépend du type et de la catégorie de votre établissement (ERP, IGH), fixés par la réglementation incendie. Indiquez-nous le type d’établissement et sa capacité : nous vous aidons gratuitement à définir le bon dispositif.', ['Parler à un conseiller', 'Demander un devis'], false],
    // Dimensionnement et organisation
    [['combien d agents', 'nombre d agents', 'combien de gardes', 'combien de vigiles', 'combien de personnes faut'], 'Le nombre d’agents dépend du nombre d’invités ou de visiteurs, de la configuration du lieu, du nombre d’accès et du profil de la mission. Nous vous conseillons gratuitement au moment du devis (par exemple, pour un gala de 150 invités, souvent deux agents : un au contrôle des invitations, un en salle).', ['Demander un devis', 'Parler à un conseiller'], false],
    [['remplac', 'absent', 'absence d un agent', 'arret maladie', 'malade'], 'En cas d’absence, un agent qualifié prend le relais : les remplacements sont assurés. Nous intervenons aussi pour remplacer vos propres agents (congés, arrêt maladie, recrutement en cours).', ['Demander un devis'], false],
    [['contrat', 'a l annee', 'long terme', 'regulier', 'mensuel', 'permanent', 'tous les jours', 'quotidien'], 'Oui, nous assurons des prestations régulières (présence quotidienne, contrats au mois ou à l’année) avec des agents habitués à vos locaux, un planning établi avec vous et un tarif dégressif.', ['Demander un devis', 'Parler à un conseiller'], false],
    [['visite', 'reperage', 'se deplacer sur place', 'venir voir'], 'Si nécessaire, nous visitons les lieux avant de proposer le dispositif : accès, issues, points sensibles. Cela fait partie de la préparation du devis, sans engagement.', ['Demander un devis'], false],
    [['ronde', 'rondes', 'statique', 'patrouille', 'passages'], 'Deux formules : le gardiennage statique (un agent reste sur place en permanence) ou les rondes (passages réguliers, moins coûteux, adaptés aux sites moins exposés). Un rapport des passages et incidents peut vous être transmis.', ['Demander un devis'], false],
    [['confidentiel', 'discretion', 'discret', 'secret'], 'La discrétion fait partie de notre métier : vos informations, votre identité et votre programme servent uniquement à préparer la mission et ne sont jamais communiqués.', ['Demander un devis'], false],
    [['a l avance', 'combien de temps avant', 'reserver tot', 'derniere minute', 'dernier moment'], 'Le plus tôt possible, surtout pendant les fêtes et la saison des mariages (mai à septembre). Pour une demande de dernière minute, appelez le 06 11 67 86 25 : selon nos disponibilités, nous faisons le maximum.', ['Demander un devis'], false],
    // Particuliers, résidences, squats
    [['maison', 'villa', 'appartement', 'vacances', 'mon domicile', 'chez moi', 'particuliers', 'je suis un particulier', 'pour un particulier'], 'Oui, nous intervenons pour les particuliers : surveillance d’une maison ou d’un appartement pendant une absence, des travaux ou une réception, en présence continue ou en rondes, ainsi que la sécurité des fêtes de famille.', ['Demander un devis'], false],
    [['squat', 'squatteur', 'hall d immeuble', 'parking', 'syndic', 'bailleur'], 'Pour les résidences et copropriétés : rondes de nuit dans les halls et parkings, présence dissuasive contre les squats avec signalement aux forces de l’ordre, contrôle des accès. Pour les syndics, devis adapté au vote en assemblée générale et rapport régulier des interventions.', ['Demander un devis'], false],
    [['vacation', 'heures minimum', 'minimum d heures'], 'La vacation minimale est de 4 heures par agent pour la sécurité, et de 2 heures pour un chauffeur à disposition.', ['Nos tarifs'], false],
    // VTC détaillé
    [['taxi', 'difference vtc', 'compteur'], 'Un VTC se réserve à l’avance et son prix est convenu avant le départ : pas de compteur, pas de surprise, même dans les embouteillages. Nos chauffeurs sont titulaires de la carte professionnelle VTC et en tenue.', ['Nos tarifs VTC', 'Demander un devis'], false],
    [['retard de vol', 'retard du vol', 'vol en retard', 'numero de vol', 'vol a du retard', 'avion en retard', 'avion a du retard'], 'Donnez-nous votre numéro de vol à la réservation : nous suivons l’heure d’arrivée réelle et votre chauffeur s’adapte. À l’aéroport, 60 minutes d’attente sont offertes.', ['Transfert aéroport'], false],
    [['pancarte', 'ou m attend', 'ou le chauffeur', 'hall des arrivees', 'accueil a l aeroport'], 'Votre chauffeur vous attend dans le hall des arrivées, à la sortie de votre vol, avec une pancarte à votre nom, et vous aide avec vos bagages. Ses coordonnées vous sont transmises.', ['Transfert aéroport'], false],
    [['bagages', 'valises', 'plusieurs passagers', '7 places', 'famille nombreuse'], 'Selon le nombre de passagers et de bagages, nous proposons une berline ou un van 7 places.' . ($prixOk && $vtcOk ? " Exemple : Paris ↔ Orly {$p('orly')} € en berline, {$p('orlyVan')} € en van." : '') . ' Précisez-le dans votre demande.', ['Demander un devis'], false],
    [['temps de trajet', 'combien de temps pour aller', 'duree du trajet'], 'Depuis le centre de Paris : Roissy-CDG en 45 minutes à 1 heure, Orly en 30 à 45 minutes, Beauvais en 1 h 15 à 1 h 30 environ, davantage aux heures de pointe. Nous calculons l’heure de départ avec vous.', ['Transfert aéroport'], false],
    [['bourget', 'jet prive', 'aviation d affaires'], 'Oui, nous assurons les transferts depuis et vers Paris-Le Bourget (aviation d’affaires), avec une prise en charge discrète calée sur l’heure d’atterrissage. Tarif sur devis.', ['Demander un devis'], false],
    [['province', 'longue distance', 'autre ville', 'lyon', 'lille', 'bordeaux', 'marseille', 'toute la france'], 'Pour les longues distances, nous vous conduisons partout en France, de porte à porte : demandez un devis gratuit avec votre trajet et vos horaires.', ['Demander un devis'], false],
    [['decoration', 'rubans', 'fleurs sur la voiture', 'decorer'], 'Oui, la voiture des mariés peut être décorée (rubans, fleurs, nœuds) dans le respect du véhicule.' . ($prixOk && $vtcOk ? " La formule mariage est à {$p('mariage')} € TTC pour 4 heures avec décoration." : '') . ' Parlez-nous de vos envies dans votre demande de devis.', ['Demander un devis'], false],
    [['garde du corps et chauffeur', 'chauffeur garde du corps', 'chauffeur peut proteger', 'chauffeur et securite', 'escorte'], 'Notre formule « chauffeur + sécurité » associe un chauffeur VTC professionnel et un agent de protection rapprochée titulaire de la carte CNAPS : deux professionnels distincts, coordonnés par un seul interlocuteur. Tarif sur devis, après un échange confidentiel.', ['Demander un devis', 'Parler à un conseiller'], false],
    [['carte bancaire', 'cb', 'especes', 'cash', 'payer en ligne', 'paypal'], 'Le paiement se fait par virement bancaire à réception de facture (acompte possible indiqué sur le devis). Il n’y a pas de paiement par carte en ligne.', ['Parler à un conseiller'], false],
    [['facture', 'note de frais'], 'Une facture vous est remise pour chaque prestation, utile pour vos notes de frais ou votre comptabilité. Le règlement se fait par virement bancaire à réception de facture, et vos factures sont disponibles dans votre espace client.', ['Espace client'], false],
    // Données personnelles, avis, langues, divers
    [['donnees personnelles', 'rgpd', 'cookies', 'supprimer mes donnees', 'mes donnees'], 'Vos données servent uniquement à répondre à votre demande et ne sont jamais vendues. Elles sont conservées 3 ans après le dernier contact. Vous pouvez demander leur accès ou leur suppression à bdasecurite@gmail.com. Le site ne dépose aucun cookie publicitaire.', [], false],
    [['laisser un avis', 'donner mon avis', 'noter', 'mettre un avis'], 'Avec plaisir : vous pouvez laisser votre avis sur la page Avis clients. Il est publié après une vérification rapide.', ['Avis clients'], false],
    [['anglais', 'english', 'speak', 'langue', 'arabe', 'espagnol'], 'Vous pouvez nous écrire dans votre langue. Certains de nos agents et chauffeurs parlent anglais : précisez-le dans votre demande, nous en tenons compte selon les disponibilités.', ['Demander un devis'], false],
    [['assurance', 'assure', 'responsabilite civile'], 'Pour les attestations et documents administratifs liés à votre mission, un conseiller vous répondra directement et pourra vous les transmettre.', ['Parler à un conseiller'], true],
    [['drone', 'cyber', 'informatique', 'detective', 'enquete', 'filature'], 'Nous ne proposons pas ce type de service : notre métier est la sécurité humaine (agents, sécurité incendie, protection rapprochée, événementiel) et le transport avec chauffeur. Un conseiller peut vous orienter si besoin.', ['Parler à un conseiller'], true],
    [['pourquoi vous', 'pourquoi bda', 'pourquoi choisir', 'choisir bda', 'choisir votre', 'avantage', 'difference avec', 'meilleur'], 'Avec BDA, vous échangez directement avec le responsable de votre mission (pas de centre d’appels), nos agents sont titulaires de la carte CNAPS, présentables et discrets, les heures sont pointées et vous payez les heures réellement faites, avec des remplacements assurés et un devis clair.', ['Demander un devis', 'Nos tarifs'], false],
    [['conseiller', 'humain', 'quelqu un', 'une personne', 'parler a', 'responsable', 'rappeler', 'rappel', 'joindre quelqu'], 'Bien sûr, je vous mets en relation avec un membre de l’équipe BDA : laissez votre nom et un moyen de vous recontacter ci-dessous.', [], true],
    [['urgence', 'urgent', 'ce soir', 'maintenant', 'tout de suite', 'immediatement', 'des que possible', 'cette nuit'], 'Pour une demande urgente, le plus rapide est de nous appeler au 06 11 67 86 25 (24h/24) : nous étudions votre besoin tout de suite. Je peux aussi transmettre votre demande à un conseiller.', ['Être rappelé', 'Nos tarifs'], true],
    [['ssiap', 'incendie', 'pompier', 'igh', 'erp'], 'Nos agents de sécurité incendie sont diplômés SSIAP 1, 2 et 3 : poste de sécurité, rondes de prévention, levée de doute, évacuation et assistance aux personnes.' . ($prixOk ? " Tarifs à partir de {$p('ssiap1')} € HT/h (SSIAP 1), {$p('ssiap2')} € (SSIAP 2) et {$p('ssiap3')} € (SSIAP 3)." : '') . ' Postes permanents, remplacements ou renforts.', ['Demander un devis', 'Zones d’intervention'], false],
    [['garde du corps', 'protection rapprochee', 'bodyguard', 'vip', 'personnalite', 'escorte'], 'Nous assurons la protection rapprochée de dirigeants, personnalités et familles, en toute discrétion, avec chauffeur si besoin.' . ($prixOk ? " À partir de {$p('protection')} € HT de l’heure, ou {$p('protectionJour')} € HT la journée de 8 h." : '') . ' Chaque mission est préparée sur devis.', ['Parler à un conseiller', 'Demander un devis'], false],
    [['evenement', 'soiree', 'gala', 'salon', 'concert', 'seminaire', 'festival', 'anniversaire', 'fete', 'invites'], 'Pour vos événements (soirées, galas, salons, concerts, mariages), nous adaptons le dispositif au nombre d’invités et au lieu : filtrage, palpations, gestion des flux, chef d’équipe dès 4 agents.' . ($prixOk ? " À partir de {$p('evenementiel')} € HT par agent et par heure, 4 heures minimum." : '') . ' Indiquez-nous la date, le lieu et le nombre d’invités pour un devis précis.', ['Demander un devis', 'Nos tarifs'], false],
    [['chantier', 'btp', 'materiel', 'engins'], 'Nous assurons le gardiennage de chantiers et du matériel, la nuit et le week-end, avec rondes et présence dissuasive.' . ($prixOk ? " À partir de {$p('agent')} € HT par agent et par heure (majoration de nuit +{$p('nuit')} %)." : '') . ' ' . $devis, ['Demander un devis'], false],
    [['aeroport', 'orly', 'cdg', 'roissy', 'beauvais', 'gare', 'transfert', 'avion'], $vtcOk ? "Nos transferts en berline : Paris ↔ Orly {$p('orly')} €, Paris ↔ Roissy-CDG {$p('cdg')} €, Paris ↔ Beauvais {$p('beauvais')} € TTC, prix fixes avec péages, bagages, suivi de vol et 60 minutes d’attente inclus. En van 7 places : {$p('orlyVan')} €, {$p('cdgVan')} € et {$p('beauvaisVan')} €." : 'Le service VTC n’est pas disponible en ligne pour le moment : un conseiller peut vous répondre.', ['Réserver un chauffeur', 'Parler à un conseiller'], !$vtcOk],
    [['mariage', 'mariee', 'maries'], 'Pour un mariage, nous assurons la sécurité de la réception : agents en costume, contrôle des invités et surveillance de la salle' . ($prixOk ? ", à partir de {$p('evenementiel')} € HT par agent et par heure (4 heures minimum)" : '') . '.' . ($vtcOk ? " Nous proposons aussi une berline noire avec chauffeur : {$p('mariage')} € TTC pour 4 heures, décoration comprise." : '') . ' Indiquez-nous la date, le lieu et le nombre d’invités pour un devis précis.', ['Demander un devis', 'Parler à un conseiller'], false],
    [['vtc', 'chauffeur', 'berline', 'voiture', 'mise a disposition', 'trajet', 'van', 'taxi'], $vtcOk ? "Nos chauffeurs en tenue conduisent des berlines haut de gamme : {$p('heure')} € TTC de l’heure (2 h minimum), {$p('demi')} € la demi-journée, {$p('journee')} € la journée. Transferts aéroport dès {$p('orly')} €. " . (!empty(tarifs_vtc()['ouvert']) ? 'Vous pouvez réserver en ligne sur la page Réserver.' : 'Réservation par téléphone au 06 11 67 86 25 ou via le formulaire de devis.') : 'Le service VTC n’est pas disponible en ligne pour le moment : un conseiller peut vous répondre.', ['Transfert aéroport', 'Demander un devis'], !$vtcOk],
    [['delai', 'combien de temps', 'rapidement', 'quand'], 'Nous répondons rapidement aux demandes de devis. Pour une mission urgente, appelez directement le 06 11 67 86 25 : nous étudions la faisabilité tout de suite.', ['Demander un devis'], false],
    [['prix', 'tarif', 'cout', 'combien', 'cher', 'budget', 'taux horaire', 'euros', ' € '], $prixOk ? "Nos tarifs de départ : agent de sécurité {$p('agent')} € HT/h, sécurité événementielle {$p('evenementiel')} € HT/h, SSIAP 1 {$p('ssiap1')} € HT/h, protection rapprochée {$p('protection')} € HT/h (4 heures minimum). Majorations : nuit +{$p('nuit')} %, dimanche +{$p('dimanche')} %, férié +{$p('ferie')} %. Vous pouvez estimer votre mission sur la page Tarifs." : 'Chaque mission est chiffrée sur mesure : le devis est gratuit et sans engagement. ' . $devis, ['Estimer ma mission', 'Demander un devis'], false],
    [['minimum', 'combien d heures', 'duree minimale', 'vacation'], 'La vacation minimale est de 4 heures par agent pour la sécurité, et de 2 heures pour un chauffeur à disposition.', ['Nos tarifs'], false],
    [['nuit', 'dimanche', 'ferie', 'majoration', 'week end', 'weekend'], 'Nous intervenons jour et nuit, week-ends et jours fériés compris.' . ($prixOk ? " Majorations : nuit (21 h – 6 h) +{$p('nuit')} %, dimanche +{$p('dimanche')} %, jour férié +{$p('ferie')} %." : ''), ['Nos tarifs'], false],
    [['devis', 'estimation', 'proposition', 'cotation'], 'Le devis est gratuit, détaillé et sans engagement. Décrivez votre besoin en 2 minutes sur la page Devis (lieu, dates, horaires, nombre de personnes) : nous revenons vers vous rapidement.', ['Demander un devis', 'Parler à un conseiller'], false],
    [['cnaps', 'agrement', 'autorisation', 'carte pro', 'carte professionnelle', 'legal', 'declare', 'habilite', 'diplome', 'qualifie'], 'BDA Sécurité est autorisée par le CNAPS (autorisation n° AUT-075-2124-07-01-20250906336). Chaque agent est titulaire de sa carte professionnelle, et nos agents incendie sont diplômés SSIAP.', ['Nos références'], false],
    [['telesurveillance', 'videosurveillance', 'video surveillance', 'camera', 'cameras', 'alarme', 'alarmes', 'installation'], 'Nous ne proposons pas de télésurveillance ni d’installation de caméras ou d’alarmes : nous assurons une surveillance humaine, avec des agents de sécurité sur place, de jour comme de nuit. Un conseiller peut vous orienter selon votre besoin.', ['Nos tarifs', 'Parler à un conseiller'], false],
    [['arme', 'armes', 'arme a feu', 'chien', 'maitre chien', 'cynophile'], 'Pour ce type de besoin spécifique, un conseiller vous répondra précisément selon votre situation.', [], true],
    [['zone', 'ou intervenez', 'banlieue', 'ile de france', 'province', 'region', 'deplacez', ' 92', ' 93', ' 94', ' 95', ' 77', ' 78', ' 91', 'hauts de seine', 'seine saint denis', 'val de marne', 'defense', 'neuilly', 'boulogne', 'saint denis'], 'Nous intervenons dans tout Paris et l’Île-de-France (75, 92, 93, 94, 77, 78, 91, 95). Pour une mission hors Île-de-France, un conseiller étudie votre demande.', ['Demander un devis'], false],
    [['horaire', 'ouvert', 'heures d ouverture', 'disponible', 'dispo', '24h', '24 h'], 'Nous sommes joignables et intervenons 24h/24 et 7j/7, jours fériés compris, au 06 11 67 86 25.', ['Demander un devis'], false],
    [['hotel', 'hotellerie', 'palace'], 'Nous accompagnons les hôtels : agents de sécurité de jour comme de nuit, agents SSIAP pour la sécurité incendie, renforts pour vos événements et arrivées de personnalités, avec une présentation adaptée à l’hôtellerie haut de gamme.', ['Sécurité incendie SSIAP', 'Demander un devis'], false],
    [['commerce', 'boutique', 'magasin', 'vol ', 'vols', 'pharmacie', 'bijouterie'], 'Pour les commerces et boutiques, nos agents assurent la prévention des vols, l’accueil et la dissuasion, aux heures qui vous conviennent (par exemple aux heures de pointe).' . ($prixOk ? " À partir de {$p('agent')} € HT de l’heure." : ''), ['Demander un devis'], false],
    [['bureau', 'bureaux', 'siege social', 'locaux', 'immeuble', 'residence', 'copropriete', 'ambassade', 'consulat'], 'Nous sécurisons bureaux, sièges sociaux, résidences, ambassades et consulats : accueil, contrôle d’accès, rondes et sécurité incendie. Nous assurons notamment la sécurité du Consulat général de Colombie à Paris.', ['Demander un devis', 'Nos références'], false],
    [['reference', 'clients', 'confiance', 'experience', 'avis'], 'Nous assurons notamment la sécurité du Consulat général de Colombie à Paris, une collaboration toujours en cours. Vous pouvez aussi lire les avis de nos clients sur la page Avis.', ['Nos références'], false],
    [['tenue', 'costume', 'uniforme', 'habille'], 'Nos agents portent une tenue adaptée à votre site : costume sombre pour l’événementiel, l’hôtellerie et le luxe, tenue d’agent de sécurité pour les sites et chantiers.', [], false],
    [['recrut', 'emploi', 'travailler', 'job', 'postuler', 'candidature', 'embauche', 'cv '], 'Nous recrutons des agents de sécurité (carte CNAPS), des agents SSIAP, des agents de protection rapprochée et des chauffeurs VTC. Vous pouvez postuler en ligne sur la page Recrutement.', ['Voir le recrutement'], false],
    [['facture', 'paiement', 'payer', 'virement', 'acompte', 'tva', 'reglement'], 'Le paiement se fait par virement bancaire à réception de facture ; un acompte peut être indiqué sur le devis. Vos devis et factures sont disponibles dans votre espace client. Pour une question sur une facture, un conseiller vous répond.', ['Parler à un conseiller'], false],
    [['espace client', 'mon compte', 'connexion', 'identifiant', 'mot de passe', 'connecter'], 'Votre espace client (page Espace client) regroupe vos devis, factures, le détail des heures et la messagerie avec BDA. L’accès est créé par notre équipe : si vous ne l’avez pas reçu, un conseiller peut vous l’envoyer.', ['Parler à un conseiller'], false],
    [['telephone', 'numero', 'appeler', 'contact', 'mail', 'email', 'adresse', 'whatsapp', 'joindre'], 'Vous pouvez nous joindre 24h/24 au 06 11 67 86 25, sur WhatsApp au 07 84 73 90 70, ou par email à bdasecurite@gmail.com. Nos bureaux sont au 61 rue de la Croix Saint-Simon, 75020 Paris.', ['Parler à un conseiller'], false],
    [['agent', 'gardiennage', 'surveillance', 'securite', 'vigile', 'gardien', 'ronde', 'controle d acces', 'accueil'], 'Nos agents de sécurité, titulaires de la carte professionnelle CNAPS, assurent gardiennage, accueil, contrôle d’accès et rondes, de jour comme de nuit.' . ($prixOk ? " À partir de {$p('agent')} € HT par agent et par heure (4 heures minimum)." : '') . ' ' . $devis, ['Nos tarifs', 'Demander un devis'], false],
    [['merci', 'parfait', 'super', 'top', 'genial', 'd accord', 'ok '], 'Avec plaisir ! N’hésitez pas si vous avez une autre question.', ['Demander un devis'], false],
    [['au revoir', 'bonne journee', 'bonne soiree', 'a bientot', 'bye'], 'Merci de votre visite et à bientôt chez BDA Sécurité.', [], false],
    [['bonjour', 'bonsoir', 'salut', 'hello', 'coucou', 'hey'], 'Bonjour et bienvenue chez BDA Sécurité ! Je peux vous renseigner sur nos agents de sécurité, la sécurité incendie, l’événementiel, la protection rapprochée' . ($vtcOk ? ', nos chauffeurs VTC' : '') . ' et nos tarifs. Que recherchez-vous ?', ['Nos tarifs', 'Demander un devis', 'Parler à un conseiller'], false],
  ];
  // Prix de nuit, dimanche ou férié calculé directement
  if ($prixOk && $a(['prix', 'tarif', 'cout', 'combien', 'cher']) && $a(['nuit', 'dimanche', 'ferie']) && !$a(['vtc', 'chauffeur', 'transfert', 'aeroport'])) {
    $cle = $a(['ssiap', 'incendie']) ? 'ssiap1' : ($a(['evenement', 'soiree', 'gala', 'concert']) ? 'evenementiel' : 'agent');
    $nom = ['ssiap1' => 'un agent SSIAP 1', 'evenementiel' => 'un agent en événementiel', 'agent' => 'un agent de sécurité'][$cle];
    $base = (float)$t[$cle];
    $maj = fn ($k) => assist_prix(round($base * (1 + (float)$t[$k] / 100), 2));
    return ['texte' => "Pour {$nom} : à partir de " . assist_prix($base) . " € HT de l’heure en journée, {$maj('nuit')} € HT la nuit (21 h – 6 h), {$maj('dimanche')} € HT le dimanche et {$maj('ferie')} € HT un jour férié, 4 heures minimum. Vous pouvez estimer votre mission sur la page Tarifs.", 'suggestions' => ['Estimer ma mission', 'Demander un devis'], 'conseiller' => false, 'compris' => true];
  }
  foreach ($intentions as [$mots, $texte, $sugg, $cons]) {
    if ($a($mots)) return ['texte' => $texte, 'suggestions' => $sugg, 'conseiller' => $cons, 'compris' => true];
  }
  return ['texte' => 'Je ne suis pas certain de bien comprendre votre question. Je peux vous renseigner sur nos prestations, nos tarifs ou nos zones d’intervention, ou vous mettre en relation avec un conseiller.', 'suggestions' => ['Nos tarifs', 'Demander un devis'], 'conseiller' => true, 'compris' => false];
}

/* ---------- Claude (si une clé API est réglée dans l'admin) ---------- */
function assist_ia_reglages(): array
{
  $st = db()->prepare('SELECT v FROM reglages WHERE k = ?');
  $st->execute(['ia']);
  $v = json_decode((string)$st->fetchColumn(), true);
  return ['cle' => (string)($v['cle'] ?? ''), 'actif' => !empty($v['actif'])];
}

// $historique : [['role' => 'user'|'assistant', 'texte' => …], …] (ordre chronologique). null si l'IA n'a pas répondu.
function assist_ia(array $historique): ?string
{
  $ia = assist_ia_reglages();
  if (!$ia['actif'] || $ia['cle'] === '' || !function_exists('curl_init')) return null;
  // Rôles alternés, en commençant par le visiteur
  $messages = [];
  foreach (array_slice($historique, -16) as $m) {
    $texte = trim($m['texte']);
    if ($texte === '') continue;
    if (!$messages && $m['role'] !== 'user') continue;
    $n = count($messages);
    if ($n && $messages[$n - 1]['role'] === $m['role']) $messages[$n - 1]['content'] .= "\n\n" . $texte;
    else $messages[] = ['role' => $m['role'], 'content' => $texte];
  }
  if (!$messages || end($messages)['role'] !== 'user') return null;
  $corps = [
    'model' => ASSIST_MODELE,
    'max_tokens' => 4000,
    'fallbacks' => 'default',
    'output_config' => ['effort' => 'low'],
    // Long texte fixe mis en cache : seules les questions changent d'une requête à l'autre
    'system' => [['type' => 'text', 'text' => assist_connaissances() . "\n\nDiscussion en direct : commence ta réponse visible immédiatement.", 'cache_control' => ['type' => 'ephemeral']]],
    'messages' => $messages,
  ];
  $ch = curl_init('https://api.anthropic.com/v1/messages');
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 40,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_HTTPHEADER => [
      'content-type: application/json',
      'x-api-key: ' . $ia['cle'],
      'anthropic-version: 2023-06-01',
      'anthropic-beta: server-side-fallback-2026-07-01',
    ],
    CURLOPT_POSTFIELDS => json_encode($corps, JSON_UNESCAPED_UNICODE),
  ]);
  $brut = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $erreur = curl_error($ch);
  curl_close($ch);
  if ($brut === false || $code !== 200) {
    error_log('[BDA assistant] API Claude : HTTP ' . $code . ' ' . $erreur . ' ' . substr((string)$brut, 0, 300));
    return null;
  }
  $r = json_decode((string)$brut, true);
  if (!is_array($r) || ($r['stop_reason'] ?? '') === 'refusal') return null;
  $texte = '';
  foreach ((array)($r['content'] ?? []) as $bloc) if (($bloc['type'] ?? '') === 'text') $texte .= $bloc['text'];
  $texte = trim($texte);
  return $texte === '' ? null : $texte;
}
