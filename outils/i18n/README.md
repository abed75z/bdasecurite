# Versions anglaise (/en/) et arabe (/ar/) du site

Les pages françaises (à la racine) sont la source. Les dossiers `en/` et `ar/` sont **générés** :
ne jamais les modifier à la main, ils seraient écrasés.

## Après une modification d'une page française traduite

```
python -I outils/i18n/extraire.py    # repère les textes nouveaux ou modifiés -> a-traduire.txt
python -I outils/i18n/generer.py     # refait en/*.html et ar/*.html
```

`generer.py` affiche le nombre de textes sans traduction (`manquants-en.txt`, `manquants-ar.txt`) :
tant qu'il n'est pas à 0, ces textes restent en français sur les pages anglaises/arabes.

## Ajouter des traductions

Dans `traductions/en/` et `traductions/ar/`, une ligne par texte : `numéro|traduction`
(les numéros et le texte français sont dans `a-traduire.txt`). Les fichiers sont lus dans l'ordre alphabétique.

## Ajouter une page à traduire

Ajouter son nom dans `PAGES` (`i18n_lib.py`), puis `extraire.py`, traduire, `generer.py`.
Les pages qui ne sont pas dans `PAGES` restent en français ; depuis /en/ et /ar/, leurs liens
mènent à la page française (ou à l'équivalent indiqué dans `EQUIVALENTS`).

## Textes affichés par les scripts

Les messages écrits par JavaScript (erreurs de formulaire, calendrier, estimations…) sont traduits
dans `assets/js/i18n.js` (fonction `T()`). Les demandes envoyées à l'admin restent en français,
avec un champ « Langue du visiteur ».

## Mise en page arabe

`assets/css/rtl.css` (chargé seulement sur /ar/) : police arabe, lecture de droite à gauche,
corrections des éléments placés à gauche/droite dans les styles français.
