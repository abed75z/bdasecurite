# -*- coding: utf-8 -*-
"""Fabrique les versions anglaise (/en/) et arabe (/ar/) du site à partir des pages françaises,
et met à jour le sélecteur de langue et les balises hreflang des pages françaises.

    python -I outils/i18n/generer.py

À relancer après chaque modification d'une page française traduite (sinon /en/ et /ar/ gardent
l'ancien texte). Les textes sans traduction restent en français et sont listés à la fin :
les ajouter dans traductions/en/*.json et traductions/ar/*.json (voir README.md).
"""
import glob
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from i18n_lib import (ATTR_TEXTE, CLES_JSONLD, DOSSIER, EQUIVALENTS, FRANCAIS_SEULEMENT, JETONS, LANGUES,  # noqa: E402
                      META_TEXTE, PAGES, RACINE, SITE, a_traduire, attributs, cle, lire, preparer, traductions, valeur)

ETIQUETTE = {'fr': 'Langue', 'en': 'Language', 'ar': 'اللغة'}
NOMS = {'fr': ('FR', 'Français'), 'en': ('EN', 'English'), 'ar': ('AR', 'العربية')}
VERSION_JS = '1'
VERSION_CSS = '1'


def url_page(langue, page):
    chemin = '' if page == 'index' else page
    return f'{SITE}/{chemin}' if langue == 'fr' else f'{SITE}/{langue}/{chemin}'


def chemin_page(langue, page):
    return url_page(langue, page)[len(SITE):]


def page_traduite(slug):
    """Page traduite correspondant à un nom de page français (ou None)."""
    if slug in ('', 'index'):
        return 'index'
    if slug in PAGES:
        return slug
    return EQUIVALENTS.get(slug)


def lien(url, langue):
    """Adapte un lien interne d'une page française à la version traduite."""
    if not url or url.startswith(('#', 'tel:', 'mailto:', 'data:', 'javascript:', '//', 'sms:')):
        return url
    if url.startswith(SITE):
        reste = url[len(SITE):] or '/'
        if reste.startswith(('/assets/', '/api/', '/admin/', '/#')):
            return url
        return SITE + lien(reste, langue)
    if re.match(r'^[a-z]+:', url):
        return url
    m = re.match(r'^([^?#]*)(.*)$', url)
    chemin, suite = m.group(1), m.group(2)
    nu = chemin.lstrip('/')
    if nu.startswith(('assets/', 'api/', 'admin/', 'appli/')) or re.search(r'\.(png|jpe?g|webp|svg|ico|webmanifest|js|css|vcf|pdf|mp4|php|txt|xml)$', nu):
        return '/' + nu + suite
    slug = re.sub(r'\.html$', '', nu).rstrip('/')
    cible = page_traduite(slug)
    if cible:
        return chemin_page(langue, cible) + suite
    return '/' + slug + suite


def balises_tete(langue, page, indexable):
    lignes = [f'<link rel="canonical" href="{url_page(langue, page)}">']
    if indexable:
        for l in ('fr', 'en', 'ar'):
            lignes.append(f'<link rel="alternate" hreflang="{l}" href="{url_page(l, page)}">')
        lignes.append(f'<link rel="alternate" hreflang="x-default" href="{url_page("fr", page)}">')
    return '\n  '.join(lignes)


def selecteur(classe, langue, page):
    """Choix de la langue : bouton « FR ⌄ » (langue de la page) qui ouvre la liste des autres langues
    (ouverture gérée par assets/js/core.js, styles dans maison.css)."""
    court, nom = NOMS[langue]
    etiquette = ETIQUETTE[langue] + (' : ' if langue == 'fr' else ': ') + nom
    autres = ''.join(f'<a href="{chemin_page(l, page)}" hreflang="{l}" lang="{l}"><b>{NOMS[l][0]}</b>{NOMS[l][1]}</a>'
                     for l in ('fr', 'en', 'ar') if l != langue)
    return (f'<div class="{classe}" data-langue>'
            f'<button class="langue__btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="{etiquette}">'
            f'<span lang="{langue}">{court}</span><svg class="langue__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>'
            f'<span class="langue__liste">{autres}</span></div>')


def liens_pied(langue, page):
    return ''.join(f'<li><a href="{chemin_page(l, page)}" hreflang="{l}" lang="{l}">{NOMS[l][1]}</a></li>'
                   for l in ('fr', 'en', 'ar') if l != langue)


class Traducteur:
    def __init__(self, langue):
        self.langue = langue
        self.dico = traductions(langue)
        self.manquants = {}

    def t(self, texte, page):
        k = cle(texte)
        if k in self.dico:
            return self.dico[k]
        self.manquants.setdefault(k, set()).add(page)
        return k

    def jsonld(self, obj, page, cle_parent=None):
        if isinstance(obj, dict):
            out = {}
            for k, v in obj.items():
                if k == 'inLanguage':
                    out[k] = self.langue
                elif k in ('url', 'item') and isinstance(v, str):
                    out[k] = lien(v, self.langue)
                else:
                    out[k] = self.jsonld(v, page, k)
            return out
        if isinstance(obj, list):
            return [self.jsonld(v, page, cle_parent) for v in obj]
        if isinstance(obj, str) and cle_parent in CLES_JSONLD and a_traduire(obj):
            return self.t(obj, page)
        return obj


def traduire_balise(balise, tr, page):
    nom, attrs = attributs(balise)
    if nom is None:
        return balise
    d = {k: valeur(v) for k, v, _, _ in attrs}
    remplacements = []
    for k, brute, debut, fin in attrs:
        v = valeur(brute)
        if v is None:
            continue
        nouveau = None
        if k in ATTR_TEXTE and a_traduire(v):
            nouveau = tr.t(v, page)
        elif nom == 'meta' and k == 'content' and (d.get('name') in META_TEXTE or d.get('property') in META_TEXTE) and a_traduire(v):
            nouveau = tr.t(v, page)
        elif nom == 'meta' and k == 'content' and d.get('property') == 'og:locale':
            nouveau = LANGUES[tr.langue]['locale']
        elif nom == 'meta' and k == 'content' and d.get('property') == 'og:url':
            nouveau = lien(v, tr.langue)
        elif nom == 'input' and k == 'value' and d.get('type') in ('submit', 'button') and a_traduire(v):
            nouveau = tr.t(v, page)
        elif k in ('href', 'src', 'action', 'poster') and not (nom == 'link' and d.get('rel') in ('canonical', 'alternate')):
            nouveau = lien(html.unescape(v), tr.langue)
            if nouveau == html.unescape(v):
                nouveau = None
        elif nom == 'html' and k == 'lang':
            nouveau = tr.langue
        if nouveau is not None:
            remplacements.append((debut, fin, '"' + html.escape(nouveau, quote=True) + '"'))
    for debut, fin, texte in sorted(remplacements, reverse=True):
        balise = balise[:debut] + texte + balise[fin:]
    if nom == 'html' and LANGUES[tr.langue]['dir'] and 'dir=' not in balise:
        balise = balise.replace('<html', f'<html dir="{LANGUES[tr.langue]["dir"]}"', 1)
    return balise


def traduire_page(page, tr):
    source = preparer(lire(os.path.join(RACINE, page + '.html')))
    indexable = not re.search(r'<meta name="robots" content="[^"]*noindex', source)
    morceaux = []
    for m in JETONS.finditer(source):
        t = m.group(0)
        bas = t[:12].lower()
        if t.startswith('<!--LANGUE:'):
            quoi = t[11:-3]
            if quoi == 'tete':
                t = balises_tete(tr.langue, page, indexable)
            elif quoi in ('nav', 'mm'):
                t = selecteur('nav__langue' if quoi == 'nav' else 'mm__langue', tr.langue, page)
            elif quoi == 'pied':
                t = liens_pied(tr.langue, page)
        elif t.startswith('<!--') or bas.startswith('<!doctype') or bas.startswith('<svg') or bas.startswith('<style'):
            pass
        elif bas.startswith('<script'):
            ouverture = re.match(r'<script\b[^>]*>', t).group(0)
            if 'application/ld+json' in ouverture:
                corps = t[len(ouverture):-len('</script>')]
                multi = '\n' in corps.strip()
                donnees = tr.jsonld(json.loads(corps), page)
                texte = json.dumps(donnees, ensure_ascii=False, indent=2 if multi else None, separators=None if multi else (',', ':'))
                t = ouverture + ('\n  ' + texte.replace('\n', '\n  ') + '\n  ' if multi else texte) + '</script>'
            else:
                t = traduire_balise(ouverture, tr, page) + t[len(ouverture):]
        elif t.startswith('<'):
            t = traduire_balise(t, tr, page)
        elif a_traduire(t):
            debut = re.match(r'^\s*', t).group(0)
            fin = re.search(r'\s*$', t).group(0)
            t = debut + html.escape(tr.t(t, page), quote=False) + fin
        morceaux.append(t)
    sortie = ''.join(morceaux)
    # Ajouts propres aux versions traduites : textes des scripts, police et sens de lecture pour l'arabe
    sortie = sortie.replace('<head>', f'<head>\n  <!-- Page générée par outils/i18n/generer.py depuis /{page}.html : ne pas modifier ici -->', 1)
    ajout_tete = ''
    if tr.langue == 'ar':
        ajout_tete = ('  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&amp;display=swap" rel="stylesheet">\n'
                      f'  <link rel="stylesheet" href="/assets/css/rtl.css?v={VERSION_CSS}">\n')
    sortie = sortie.replace('</head>', ajout_tete + '</head>', 1)
    premier = re.search(r'<script src="/assets/js/', sortie)
    if premier:
        sortie = sortie[:premier.start()] + f'<script src="/assets/js/i18n.js?v={VERSION_JS}"></script>\n' + sortie[premier.start():]
    return sortie


def mettre_a_jour_fr():
    """Pages françaises : sélecteur FR | EN | عربي, liens du pied de page et hreflang."""
    modifiees = 0
    for chemin in sorted(glob.glob(os.path.join(RACINE, '*.html'))):
        slug = os.path.basename(chemin)[:-5]
        if slug in ('en',):
            continue
        source = lire(chemin)
        if '<html lang="fr"' not in source:
            continue
        page = page_traduite(slug) or 'index'
        traduite = slug in PAGES or slug == 'index'
        indexable = not re.search(r'<meta name="robots" content="[^"]*noindex', source)
        s = re.sub(r'<div class="nav__langue"[^>]*>.*?</div>', selecteur('nav__langue', 'fr', page), source, flags=re.S)
        s = re.sub(r'<div class="mm__langue"[^>]*>.*?</div>', selecteur('mm__langue', 'fr', page), s, flags=re.S)
        s = re.sub(r'<li><a href="[^"]*" hreflang="\w+"[^>]*>[^<]*</a></li>(\s*<li><a href="[^"]*" hreflang="\w+"[^>]*>[^<]*</a></li>)*', liens_pied('fr', page), s)
        # hreflang : seulement entre pages qui existent dans les 3 langues ; fr + x-default pour les autres
        s = re.sub(r'[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n', '', s)
        if indexable:
            alt = ([f'<link rel="alternate" hreflang="{l}" href="{url_page(l, page) if l != "fr" else url_page("fr", slug)}">' for l in ('fr', 'en', 'ar')]
                   if traduite else [f'<link rel="alternate" hreflang="fr" href="{url_page("fr", slug)}">'])
            alt.append(f'<link rel="alternate" hreflang="x-default" href="{url_page("fr", slug)}">')
            s = re.sub(r'(<link rel="canonical" href="[^"]*">\n)', lambda m: m.group(1) + ''.join(f'  {a}\n' for a in alt), s, count=1)
        if s != source:
            with open(chemin, 'w', encoding='utf-8', newline='') as f:
                f.write(s)
            modifiees += 1
    return modifiees


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    print(f'pages françaises mises à jour : {mettre_a_jour_fr()}')
    for langue in LANGUES:
        tr = Traducteur(langue)
        os.makedirs(os.path.join(RACINE, langue), exist_ok=True)
        for page in PAGES:
            with open(os.path.join(RACINE, langue, page + '.html'), 'w', encoding='utf-8', newline='\n') as f:
                f.write(traduire_page(page, tr))
        print(f'{langue} : {len(PAGES)} pages, {len(tr.dico)} traductions, {len(tr.manquants)} textes sans traduction')
        with open(os.path.join(DOSSIER, f'manquants-{langue}.txt'), 'w', encoding='utf-8') as f:
            for k, pages in tr.manquants.items():
                f.write(f'{k}\t{", ".join(sorted(pages))}\n')


if __name__ == '__main__':
    main()
