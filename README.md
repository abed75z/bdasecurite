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

Les demandes de devis **et** les candidatures arrivent sur bdasecurite@gmail.com. Le bouton WhatsApp ouvre une conversation avec le 07 84 73 90 70.

Pour voir le site : double-cliquez sur `index.html`.

## Informations de l'entreprise

Déjà en place : téléphone +33 7 84 73 90 70, email bdasecurite@gmail.com, Paris, et les informations légales de BDASECURITE (SARL, SIRET, TVA, siège, gérant, hébergeur Netlify). La page `mentions-legales.html` contient aussi la politique de confidentialité (RGPD).

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

## Activer les avis clients (Google Sheets, gratuit, environ 5 minutes)

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

- `devis.html` : questionnaire vierge.
- `devis.html?service=protection` : prestation pré-cochée. Valeurs possibles : `gardiennage`, `protection`, `evenementiel`, `transfert`, `disposition`, `evenement`, `duo`, `autre`.

## Structure

```
assets/css/style.css     base : couleurs, typographie, boutons, menu, pied de page
assets/css/hero.css      haut de page : route de nuit, blason, chiffres, bandeau
assets/css/sections.css  services, processus, engagements, FAQ, appel à l'action
assets/css/devis.css     page du questionnaire
assets/css/merci.css     page de remerciement
assets/js/core.js        animations communes (apparitions au scroll, parallaxe, menu…)
assets/js/home.js        animations de l'accueil (bandeau, processus, compteurs, FAQ)
assets/js/devis.js       questionnaire : étapes, vérifications, envoi
assets/js/merci.js       personnalisation de la page Merci
```

Les couleurs se changent en un seul endroit : le début de `assets/css/style.css` (variables `--gold`, `--bg`…).

Les polices viennent de Google Fonts. Pour une conformité RGPD maximale, vous pouvez les héberger vous-même.
