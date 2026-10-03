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
- Postes d'agents de sécurité (carte professionnelle CNAPS exigée), SSIAP, protection rapprochée et chauffeurs VTC (carte VTC exigée). Candidature en ligne sur la page /recrutement.
TXT;
}

/* ---------- Assistant intégré (sans IA) ---------- */
function assist_normaliser(string $s): string
{
  $s = mb_strtolower($s);
  $s = strtr($s, ['à' => 'a', 'â' => 'a', 'ä' => 'a', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ö' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ç' => 'c', '’' => "'", 'œ' => 'oe']);
  return ' ' . preg_replace('/[^a-z0-9\' ]+/', ' ', $s) . ' ';
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
    [['bureau', 'entreprise', 'siege', 'societe', 'immeuble', 'residence', 'copropriete', 'ambassade', 'consulat'], 'Nous sécurisons bureaux, sièges sociaux, résidences, ambassades et consulats : accueil, contrôle d’accès, rondes et sécurité incendie. Nous assurons notamment la sécurité du Consulat général de Colombie à Paris.', ['Demander un devis', 'Nos références'], false],
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
