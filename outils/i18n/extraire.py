# -*- coding: utf-8 -*-
"""Numérote les textes français des pages traduites et liste ceux qui n'ont pas encore de traduction.

    python -I outils/i18n/extraire.py

- segments.json : liste de tous les textes français (le n° d'un texte = sa position + 1).
  Les numéros ne changent jamais : un nouveau texte reçoit le numéro suivant.
- a-traduire.txt : textes sans traduction, page par page, sous la forme « n|texte français ».
Les traductions s'écrivent dans traductions/en/*.txt et traductions/ar/*.txt, une par ligne : « n|traduction ».
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from i18n_lib import DOSSIER, LANGUES, PAGES, RACINE, charger_segments, lire, segments_page, traductions  # noqa: E402


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    segs = charger_segments()
    numero = {s: i + 1 for i, s in enumerate(segs)}
    dicos = {l: traductions(l) for l in LANGUES}
    vus, lignes, manquants = set(), [], 0
    for p in PAGES:
        nouveaux = []
        for typ, s in segments_page(lire(os.path.join(RACINE, p + '.html'))):
            if s not in numero:
                segs.append(s)
                numero[s] = len(segs)
            if s in vus:
                continue
            vus.add(s)
            if all(s in d for d in dicos.values()):
                continue
            nouveaux.append((typ, s))
        if nouveaux:
            lignes.append(f'===== {p} ({len(nouveaux)})')
            for typ, s in nouveaux:
                manquants += 1
                lignes.append(f'{numero[s]}|{s}' + ('' if typ == 'texte' else f'   [{typ}]'))
    with open(os.path.join(DOSSIER, 'segments.json'), 'w', encoding='utf-8') as f:
        json.dump(segs, f, ensure_ascii=False, indent=0)
    with open(os.path.join(DOSSIER, 'a-traduire.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lignes) + '\n')
    print(f'{len(vus)} textes différents, {manquants} sans traduction complète (a-traduire.txt)')


if __name__ == '__main__':
    main()
