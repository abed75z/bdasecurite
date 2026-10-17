# -*- coding: utf-8 -*-
"""Site BDA Security Group : outils communs pour les versions anglaise (/en/) et arabe (/ar/).

Principe : les pages françaises sont la source. Chaque texte (nœud de texte, attribut lisible,
champ JSON-LD) est cherché dans un dictionnaire de traduction (dictionnaire-en.json,
dictionnaire-ar.json : « texte français » -> « traduction »), puis la page traduite est écrite
dans en/ et ar/ avec les liens, les balises de langue et le sélecteur de langue adaptés.
"""
import html
import json
import os
import re

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DOSSIER = os.path.dirname(os.path.abspath(__file__))
SITE = 'https://bdasecurite.com'

# Pages traduites (nom du fichier sans .html). L'accueil s'appelle « index ».
PAGES = [
    'index', 'entreprises', 'recrutement', 'devis', 'avis', 'tarifs', 'mentions-legales', 'merci',
    'securite-privee-paris', 'securite-incendie-ssiap-paris', 'protection-rapprochee-paris',
    'securite-evenementielle-paris', 'gardiennage-chantier-paris', 'securite-hotels-paris', 'securite-bars-restaurants-paris',
    'securite-commerces-paris', 'securite-bureaux-entreprises-paris', 'securite-ambassades-consulats-paris',
    'securite-residences-coproprietes-paris', 'chauffeur-prive-vtc-paris', 'chauffeur-securite-vip-paris',
]
# Pages françaises non traduites : depuis /en/ et /ar/, leurs liens mènent à la page traduite la plus proche
EQUIVALENTS = {
    'bda-securite': 'index', 'en': 'index', 'transfert-aeroport-paris': 'chauffeur-prive-vtc-paris',
    **{p: 'securite-privee-paris' for p in [
        'agent-securite-boulogne-billancourt', 'agent-securite-la-defense', 'agent-securite-neuilly-sur-seine',
        'agent-securite-paris-1', 'agent-securite-paris-16', 'agent-securite-paris-17', 'agent-securite-paris-20',
        'agent-securite-paris-8', 'agent-securite-paris-9', 'agent-securite-saint-denis']},
}
# Pages qui restent en français (espaces privés, réservation fermée, carte digitale) : lien absolu vers le français
FRANCAIS_SEULEMENT = {'espace-client', 'espace-equipe', 'pointage', 'reserver', 'carte', 'appli'}

LANGUES = {
    'en': {'lang': 'en', 'dir': None, 'locale': 'en_GB', 'nom': 'English', 'court': 'EN'},
    'ar': {'lang': 'ar', 'dir': 'rtl', 'locale': 'ar_AR', 'nom': 'العربية', 'court': 'عربي'},
}

JETONS = re.compile(
    r'<!--.*?-->|<script\b[^>]*>.*?</script\s*>|<style\b[^>]*>.*?</style\s*>|<svg\b.*?</svg\s*>'
    r'|<!doctype[^>]*>|<[^>]+>|[^<]+', re.S | re.I)
ATTR = re.compile(r'''([:\w-]+)(\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?''')
# Attributs dont la valeur est un texte lu par le visiteur
ATTR_TEXTE = {'alt', 'title', 'aria-label', 'placeholder', 'data-exemples', 'data-question', 'data-texte',
              'data-label', 'data-titre', 'data-libelle', 'data-message', 'data-erreur', 'data-vide', 'data-ok'}
META_TEXTE = {'description', 'og:title', 'og:description', 'twitter:title', 'twitter:description'}
CLES_JSONLD = {'name', 'description', 'text', 'slogan', 'headline', 'serviceType', 'knowsAbout', 'alternateName', 'caption', 'jobTitle'}
LETTRE = re.compile(r'[A-Za-zÀ-ÿ]')


def lire(chemin):
    with open(chemin, encoding='utf-8') as f:
        return f.read()


def charger_segments():
    chemin = os.path.join(DOSSIER, 'segments.json')
    return json.loads(lire(chemin)) if os.path.exists(chemin) else []


def traductions(langue):
    """Dictionnaire « texte français -> traduction » d'une langue.
    Sources : traductions/<langue>/*.txt (lignes « n|traduction », n = numéro dans segments.json)
    et traductions/<langue>/*.json (dictionnaire direct, pour les cas particuliers)."""
    import glob
    segs = charger_segments()
    d = {}
    base = os.path.join(DOSSIER, 'traductions', langue)
    for f in sorted(glob.glob(os.path.join(base, '*.txt'))):
        for n, ligne in enumerate(lire(f).splitlines(), 1):
            ligne = ligne.strip()
            if not ligne or ligne.startswith('#'):
                continue
            num, _, texte = ligne.partition('|')
            if not num.strip().isdigit() or not texte.strip():
                raise ValueError(f'{os.path.basename(f)}, ligne {n} : format attendu « n|traduction »')
            i = int(num) - 1
            if not 0 <= i < len(segs):
                raise ValueError(f'{os.path.basename(f)}, ligne {n} : numéro {num} inconnu')
            d[segs[i]] = texte.strip()
    for f in sorted(glob.glob(os.path.join(base, '*.json'))):
        d.update(json.loads(lire(f)))
    return d


def cle(texte):
    """Texte comparable : entités décodées, espaces (y compris insécables) normalisés."""
    t = html.unescape(texte).replace(' ', ' ').replace(' ', ' ')
    return re.sub(r'\s+', ' ', t).strip()


def a_traduire(texte):
    t = cle(texte)
    return bool(t) and bool(LETTRE.search(t))


def attributs(balise):
    """Liste (nom, valeur brute avec guillemets, position début, position fin) des attributs d'une balise."""
    m = re.match(r'<\s*([\w:-]+)', balise)
    if not m:
        return None, []
    out = []
    for a in ATTR.finditer(balise, m.end()):
        if a.group(1) in ('/',):
            continue
        out.append((a.group(1).lower(), a.group(3), a.start(3) if a.group(3) else -1, a.end(3) if a.group(3) else -1))
    return m.group(1).lower(), out


def valeur(brute):
    if brute is None:
        return None
    return brute[1:-1] if brute[:1] in '"\'' else brute


def preparer(source):
    """Retouches communes aux versions traduites, faites AVANT la traduction :
    - l'assistant en ligne (réponses en français seulement) est retiré ;
    - la mention « (BDA Sécurité) » du pied de page (référencement du nom en français) est retirée ;
    - le sélecteur de langue et le lien de langue du pied de page sont remplacés par des repères."""
    s = re.sub(r'\s*<section\b[^>]*\bid="assistant-ia"[^>]*>.*?</section>', '', source, flags=re.S)
    s = re.sub(r'\s*<script src="[^"]*assistant\.js[^"]*"></script>', '', s)
    s = s.replace(' (<a href="bda-securite">BDA Sécurité</a>)', '')
    s = re.sub(r'<div class="nav__langue"[^>]*>.*?</div>', '<!--LANGUE:nav-->', s, flags=re.S)
    s = re.sub(r'<div class="mm__langue"[^>]*>.*?</div>', '<!--LANGUE:mm-->', s, flags=re.S)
    s = re.sub(r'<li><a href="[^"]*" hreflang="\w+"[^>]*>[^<]*</a></li>(\s*<li><a href="[^"]*" hreflang="\w+"[^>]*>[^<]*</a></li>)*', '<!--LANGUE:pied-->', s)
    s = re.sub(r'[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?', '', s)
    s = re.sub(r'[ \t]*<link rel="canonical" href="[^"]*">\n?', '  <!--LANGUE:tete-->\n', s, count=1)
    return s


def segments_page(source):
    """Tous les textes à traduire d'une page, dans l'ordre : (type, texte)."""
    source = preparer(source)
    out = []
    pile = []
    for m in JETONS.finditer(source):
        t = m.group(0)
        if t.startswith('<!--') or t.lower().startswith('<!doctype') or t.lower().startswith('<svg') or t.lower().startswith('<style'):
            continue
        if t.lower().startswith('<script'):
            if 'application/ld+json' in t[:120].lower():
                corps = re.sub(r'^<script\b[^>]*>|</script\s*>$', '', t, flags=re.I | re.S)
                try:
                    for s in textes_jsonld(json.loads(corps)):
                        out.append(('jsonld', s))
                except ValueError:
                    pass
            continue
        if t.startswith('<'):
            nom, attrs = attributs(t)
            if nom is None:
                continue
            d = {k: valeur(v) for k, v, _, _ in attrs}
            for k, v, _, _ in attrs:
                v = valeur(v)
                if v is None or not a_traduire(v):
                    continue
                if k in ATTR_TEXTE:
                    out.append(('attr:' + k, cle(v)))
                elif nom == 'meta' and k == 'content' and (d.get('name') in META_TEXTE or d.get('property') in META_TEXTE):
                    out.append(('meta', cle(v)))
                elif nom == 'input' and k == 'value' and d.get('type') in ('submit', 'button'):
                    out.append(('attr:value', cle(v)))
            continue
        if a_traduire(t):
            out.append(('texte', cle(t)))
    return out


def textes_jsonld(obj, cle_parent=None):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from textes_jsonld(v, k)
    elif isinstance(obj, list):
        for v in obj:
            yield from textes_jsonld(v, cle_parent)
    elif isinstance(obj, str) and cle_parent in CLES_JSONLD and a_traduire(obj):
        yield cle(obj)
