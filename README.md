# Site BDA Sécurité & VTC Premium

Site vitrine statique (HTML / CSS / JavaScript, sans installation). Il fonctionne chez n'importe quel hébergeur : OVH, o2switch, Hostinger, Netlify, etc.

## Pages

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'accueil (services, engagements, FAQ…) |
| `devis.html` | Questionnaire « Demander un devis » en 4 étapes |
| `merci.html` | Page de remerciement affichée après l'envoi |
| `recrutement.html` | Offres d'emploi et formulaire de candidature |
| `avis.html` | Avis clients : note moyenne, liste des avis, formulaire avec étoiles |
| `mentions-legales.html` | Mentions légales et politique de confidentialité |

Pages services, pensées pour Google : chacune vise une recherche précise.

| Fichier | Recherches visées |
|---|---|
| `securite-privee-paris.html` | société / entreprise de sécurité privée à Paris, agent de sécurité, gardiennage |
| `protection-rapprochee-paris.html` | garde du corps, protection rapprochée à Paris |
| `securite-evenementielle-paris.html` | sécurité événementielle, agent de sécurité pour soirée, gala, mariage |
| `chauffeur-prive-vtc-paris.html` | chauffeur privé, VTC premium à Paris, mise à disposition |
| `transfert-aeroport-paris.html` | VTC aéroport CDG, Orly, Beauvais, Le Bourget, gares |
| `chauffeur-mariage-paris.html` | chauffeur mariage, voiture de mariage avec chauffeur |
| `chauffeur-securite-vip-paris.html` | chauffeur et garde du corps, transport VIP sécurisé |

Les demandes de devis **et** les candidatures arrivent sur bdasecurite@gmail.com.

Téléphone : le **06 11 67 86 25** est le numéro principal (tous les boutons « Appeler »). Le 07 84 73 90 70 est affiché en second dans les coordonnées. Le bouton WhatsApp ouvre une conversation avec le 07 84 73 90 70.

**Adresses sans « .html » :** chaque fichier `nom.html` s'affiche à l'adresse `https://bdasecurite.com/nom` (exemple : `https://bdasecurite.com/devis`). C'est le fichier `.htaccess` qui s'en charge. Les anciennes adresses en `.html` redirigent automatiquement vers les nouvelles. Dans les liens entre pages, écrivez toujours l'adresse sans `.html` (`href="devis"`, `href="/"` pour l'accueil).

Pour voir le site : ouvrez <https://bdasecurite.com>. En double-cliquant sur un fichier, les pages s'ouvrent mais les liens entre pages ne fonctionnent pas : il faut passer par un serveur, comme le site en ligne.

## Informations de l'entreprise

Déjà en place : téléphone +33 6 11 67 86 25 (principal) et +33 7 84 73 90 70, email bdasecurite@gmail.com, Paris, et les informations légales des deux structures :

- BDASECURITE, EURL, SIRET 109 076 463 00016 ;
- Abdelouahab Bouidia EI (BDA SECURITE), SIRET 977 933 316 00019.

S'y ajoutent le siège, le gérant et l'hébergeur OVH. La page `mentions-legales.html` contient aussi la politique de confidentialité (RGPD).

Le n° d'autorisation CNAPS (AUT-075-2124-07-01-20250906336) figure dans le pied de page de l'accueil, dans celui du recrutement et dans les mentions légales.

Reste à compléter :

- **N° d'inscription de l'entreprise au registre des exploitants VTC** (EVTC…) : à ajouter dans `mentions-legales.html` et dans le pied de page de `index.html`, aux emplacements signalés par un commentaire « À AJOUTER ».
- **Réseaux sociaux** : liens Instagram et LinkedIn dans le pied de page.
- **Chiffres clés** (24/7, 2 min, 100 %, 1) et textes : ajustez-les à votre réalité.

Le logo est le blason BDA redessiné en or sur fond noir. Il est intégré aux pages (symbole `bda-mark`) et existe aussi en fichier : `assets/img/logo.svg`.

## Mise en ligne (OVH + GitHub)

Le site est hébergé chez OVH (hébergement `bdasecj.cluster129`, dossier `www`) et publié sur **bdasecurite.com** et **www.bdasecurite.com**.

Le dossier est relié au dépôt GitHub **abed75z/bdasecurite** (branche `main`) :

- chaque modification envoyée sur GitHub est déployée automatiquement par OVH, grâce au webhook ;
- en secours, dans l'espace OVH : Mes sites, puis ⋮ et « Déployer Git ».

Le certificat https (Let's Encrypt) est géré par OVH, dans l'onglet « Certificats SSL ».

## Référencement Google (SEO)

Déjà en place sur le site :

- une page par service (voir le tableau plus haut), avec un titre, une description et un contenu uniques ;
- `sitemap.xml` (plan du site) et `robots.txt` ;
- l'adresse officielle de chaque page (`canonical`), l'aperçu de partage (`assets/img/og-image.jpg`) et le logo pour Google (`assets/img/logo.png`) ;
- la fiche entreprise lisible par Google (JSON-LD) : nom, adresse, téléphone, horaires, services.

À faire par le gérant (c'est ce qui compte le plus) :

1. **Google Search Console** (<https://search.google.com/search-console>) : ajouter `https://bdasecurite.com/` (« Préfixe de l'URL »), choisir la vérification « Balise HTML » et envoyer la balise au développeur, qui l'ajoute dans `index.html`. Ensuite, menu **Sitemaps** : saisir `sitemap.xml` et cliquer sur **Envoyer**. ✅ La balise de vérification est en place dans `index.html` depuis le 24/09/2026 : ne pas la supprimer, sinon Google retire l'accès.
2. **Fiche d'établissement Google** (<https://business.google.com>) : c'est elle qui fait apparaître l'entreprise sur Google Maps et dans les recherches « près de chez moi ». Nom : BDA Sécurité & VTC Premium ; téléphone : 06 11 67 86 25 ; site : https://bdasecurite.com.
3. **Avis Google** : demander à chaque client satisfait de laisser un avis sur la fiche Google. Jamais de faux avis : c'est interdit et sanctionné.
4. **Annuaires** : PagesJaunes, Bing Places, Apple Plans… avec exactement le même nom, la même adresse et le même téléphone partout.

Pour modifier le numéro de téléphone un jour : il apparaît dans toutes les pages (`tel:+33611678625`), ainsi que dans la fiche JSON-LD de chaque page.

## Espace admin (bdasecurite.com/admin)

Un espace privé, protégé par identifiant et mot de passe, pour gérer l'entreprise et le site :

- **Accueil** : créer en un clic (devis, facture, planning, carte agent, flyer) et la liste de ce qui attend une action (demandes, avis, candidatures, factures à relancer, cartes pro à renouveler). Aucun graphique ni chiffre d'affaires.
- **Devis / Factures** : feuilles A4 à nos couleurs, modifiables directement, enregistrées automatiquement, impression ou PDF en un clic. Un devis accepté se transforme en facture ; une facture peut reprendre les heures du planning.
- **Planning** : planning mensuel des agents (heures, nuit, dimanche, fériés), impression paysage, création de la facture du mois.
- **Demandes / Candidatures** : chaque formulaire du site y arrive, en plus de l'email FormSubmit. Une demande devient un devis en un clic.
- **Avis clients** : les nouveaux avis attendent votre validation avant d'être publiés sur le site.
- **Cartes agents** : carte BDA au format carte bancaire (recto + verso, photo recadrable), remplie depuis la liste des agents, imprimée sur A4 à découper ou en format carte, ou enregistrée en PDF.
- **Flyers** : flyer A4 ou A5 à nos couleurs, chaque texte se modifie au clic, sections masquables, QR code généré automatiquement.
- **Clients, Agents, Paramètres** : fiches, coordonnées de l'entreprise, IBAN, sauvegarde complète (réglages avancés repliés).

Première connexion : ouvrez `https://bdasecurite.com/admin`, saisissez le **code d'activation** remis par le développeur, puis choisissez votre identifiant et votre mot de passe. Le même code sert ensuite de code de secours en cas de mot de passe oublié : gardez-le en lieu sûr.

Technique :

- `admin/` : l'application (PHP + JavaScript, sans dépendance).
- `api/` : réception des formulaires et des avis.
- `app/` : code serveur commun, inaccessible depuis le web.
- Les données (base SQLite) sont stockées **hors du dossier public**, dans `bda-admin-data/`, à côté de `www/` sur l'hébergement OVH. Elles ne sont ni sur GitHub ni accessibles depuis le web. Pensez à télécharger régulièrement une sauvegarde (Paramètres → Sauvegarde).
- L'IBAN et les données clients ne sont jamais dans le code : ils se saisissent dans l'admin (ou via le fichier d'import gardé sur l'ordinateur).

## Réception des demandes de devis par email

Les demandes sont envoyées à **bdasecurite@gmail.com** via FormSubmit.co (gratuit, sans inscription). Le réglage se trouve en haut de `assets/js/devis.js`.

**Activation (une seule fois, obligatoire) :**

1. Mettez le site en ligne.
2. Faites vous-même une première demande de devis depuis le site.
3. Ouvrez la boîte **bdasecurite@gmail.com**. Vous y trouverez un email de FormSubmit « Action Required: Activate FormSubmit ». Pensez à regarder dans les spams.
4. Cliquez sur **Activate Form**. À partir de là, chaque demande arrive directement par email, sous forme de tableau.

Chaque email contient la référence (ex. `DV-260923-4821`), la prestation, la date, les coordonnées et les détails. Le bouton « Répondre » écrit directement au client. Le client voit la même référence sur la page Merci.

Bon à savoir :

- L'envoi ne fonctionne pas si on ouvre la page par double-clic : il faut que le site soit en ligne.
- Tant que le formulaire n'est pas activé, le site affiche un message invitant à l'activer.
- Anti-spam : après l'activation, FormSubmit fournit un alias (une suite de caractères). Remplacez l'adresse email par cet alias dans `endpoint`, pour qu'elle n'apparaisse plus dans le code du site.

## Ancien système d'avis (Google Sheets)

> Depuis la mise en place de l'espace admin, les avis sont enregistrés et validés dans **bdasecurite.com/admin** (menu Avis clients). Les avis déjà publiés dans Google Sheets y ont été repris automatiquement. Les étapes ci-dessous ne servent plus que pour mémoire.

Les avis sont enregistrés dans un tableau Google Sheets. Vous les validez avant qu'ils s'affichent sur le site.

1. Connecté à **bdasecurite@gmail.com**, ouvrez <https://sheets.new> (un tableau vide s'ouvre) et nommez-le « Avis BDA ».
2. Menu **Extensions → Apps Script**.
3. Effacez le code affiché, collez tout le contenu du fichier `outils/avis-google-sheets.gs`, puis cliquez sur l'icône **Enregistrer** (disquette).
4. En haut, choisissez la fonction **installer** et cliquez sur **▶ Exécuter**. Google demande une autorisation : « Examiner les autorisations », choisissez votre compte, puis « Paramètres avancés », « Accéder au projet (non sécurisé) » et « Autoriser ». L'avertissement est normal : c'est votre propre script. L'onglet « Avis » apparaît alors dans le tableau.
5. Cliquez sur **Déployer → Nouveau déploiement**. Cliquez sur la roue dentée, choisissez **Application Web**, puis réglez « Exécuter en tant que » sur **Moi** et « Qui a accès » sur **Tout le monde**. Cliquez sur **Déployer** et copiez l'**URL de l'application Web** (elle se termine par `/exec`).
6. Collez cette URL dans `assets/js/avis-data.js`, sur la ligne `endpoint: '…'` (ou envoyez-la au développeur), puis remettez le site en ligne.

✅ C'est déjà fait : le site est relié à votre tableau (déploiement du 23/09/2026). Si vous créez un **nouveau** déploiement, l'URL change et il faut la mettre à jour. Si vous modifiez le script, utilisez plutôt « Gérer les déploiements », puis « Modifier » et « Nouvelle version » : l'URL reste la même.

**Modération :** à chaque nouvel avis, vous recevez un email. Dans le tableau, mettez **OUI** dans la colonne « Publié » pour l'afficher sur le site, ou **NON** pour le masquer.

Tant que l'étape 6 n'est pas faite, les avis déposés arrivent par email mais ne s'affichent pas encore sur le site.

## Liens directs vers le questionnaire

- `https://bdasecurite.com/devis` : questionnaire vierge.
- `https://bdasecurite.com/devis?service=protection` : prestation pré-cochée. Valeurs possibles : `gardiennage`, `protection`, `evenementiel`, `transfert`, `disposition`, `evenement`, `duo`, `autre`.

## Structure

```
assets/css/style.css     base : couleurs, typographie, boutons, menu, pied de page
assets/css/hero.css      haut de page : route de nuit, blason, chiffres, bandeau
assets/css/sections.css  services, processus, engagements, FAQ, appel à l'action
assets/css/devis.css     page du questionnaire
assets/css/merci.css     page de remerciement
assets/css/page.css      pages services (photo en haut, article, colonne devis)
assets/js/core.js        animations communes (apparitions au scroll, parallaxe, menu…)
assets/js/home.js        animations de l'accueil (bandeau, processus, compteurs, FAQ)
assets/js/devis.js       questionnaire : étapes, vérifications, envoi
assets/js/merci.js       personnalisation de la page Merci
```

Les couleurs se changent en un seul endroit : le début de `assets/css/style.css` (variables `--gold`, `--bg`…).

Les polices viennent de Google Fonts. Pour une conformité RGPD maximale, vous pouvez les héberger vous-même.
