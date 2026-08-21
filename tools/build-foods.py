#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fabrique foods.json, la base d'aliments de l'app.

Deux sources, dans cet ordre de préférence :

  1. Le Fichier canadien sur les éléments nutritifs (FCÉN, Santé Canada) —
     noms français, source officielle. C'est la vraie base.
  2. À défaut, la liste curatée de tools/aliments-curated.tsv, qui sert de
     socle de dépannage tant que le FCÉN n'a pas été importé.

Le FCÉN se télécharge en CSV sur open.canada.ca (« Fichier canadien sur
les éléments nutritifs »). Décompresse l'archive, puis :

    python3 tools/build-foods.py --cnf chemin/vers/le/dossier/csv

Sans --cnf, seule la liste curatée est utilisée :

    python3 tools/build-foods.py

Dans les deux cas, chaque valeur passe les mêmes contrôles avant d'entrer
dans le fichier : une valeur aberrante ici devient un mauvais calcul de
bolus chez quelqu'un.
"""
import argparse, csv, json, os, sys, unicodedata

# Numéros de nutriments, identiques au FCÉN et à l'USDA
ID_GLUCIDES = 205   # Glucides totaux (par différence)
ID_FIBRES = 291     # Fibres alimentaires totales


def normalise(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.replace('’', "'").strip()


def controler(nom, glucides, fibres, journal):
    """Rejette ce qui ne peut pas être vrai. Mieux vaut un aliment absent
    qu'un aliment faux : l'absence se voit, l'erreur non."""
    if not nom or len(nom) < 2:
        return None
    if not (0 <= glucides <= 100):
        journal.append('glucides hors bornes : %s (%s)' % (nom, glucides))
        return None
    if not (0 <= fibres <= 100):
        journal.append('fibres hors bornes : %s (%s)' % (nom, fibres))
        return None
    if fibres > glucides + 0.05:
        # Les fibres font partie des glucides totaux sur les étiquettes
        # nord-américaines : au-delà, la soustraction donnerait un négatif.
        journal.append('fibres > glucides : %s (%s > %s)' % (nom, fibres, glucides))
        return None
    return {'n': nom[:80], 'c': round(glucides, 1), 'f': round(fibres, 1)}


def lire_curated(chemin, journal):
    out = []
    with open(chemin, encoding='utf-8') as fh:
        for ligne in fh:
            ligne = ligne.rstrip('\n')
            if not ligne or ligne.lstrip().startswith('#'):
                continue
            parts = ligne.split('\t')
            if len(parts) != 3:
                journal.append('ligne mal formée : %r' % ligne[:60])
                continue
            try:
                rec = controler(parts[0].strip(), float(parts[1]), float(parts[2]), journal)
            except ValueError:
                journal.append('nombre illisible : %r' % ligne[:60])
                continue
            if rec:
                out.append(rec)
    return out


def _ouvrir(dossier, *noms):
    """Le FCÉN livre des noms de fichiers qui ont varié selon les éditions."""
    for nom in noms:
        for essai in (nom, nom.upper(), nom.lower()):
            p = os.path.join(dossier, essai)
            if os.path.exists(p):
                return p
    return None


def lire_cnf(dossier, journal):
    f_noms = _ouvrir(dossier, 'FOOD NAME.csv', 'food_name.csv')
    f_val = _ouvrir(dossier, 'NUTRIENT AMOUNT.csv', 'nutrient_amount.csv')
    if not f_noms or not f_val:
        print('FCÉN introuvable dans %s — il faut FOOD NAME.csv et '
              'NUTRIENT AMOUNT.csv' % dossier, file=sys.stderr)
        return []

    noms = {}
    with open(f_noms, encoding='utf-8-sig', errors='replace') as fh:
        for r in csv.DictReader(fh):
            fid = (r.get('FoodID') or '').strip()
            # Nom français d'abord : l'app est en français
            nom = (r.get('FoodDescriptionF') or r.get('FoodDescription') or '').strip()
            if fid and nom:
                noms[fid] = nom

    valeurs = {}
    with open(f_val, encoding='utf-8-sig', errors='replace') as fh:
        for r in csv.DictReader(fh):
            fid = (r.get('FoodID') or '').strip()
            try:
                nid = int((r.get('NutrientID') or '0').strip())
                val = float((r.get('NutrientValue') or '0').strip() or 0)
            except ValueError:
                continue
            if nid in (ID_GLUCIDES, ID_FIBRES) and fid in noms:
                valeurs.setdefault(fid, {})[nid] = val

    out = []
    for fid, v in valeurs.items():
        if ID_GLUCIDES not in v:
            continue  # sans glucides, l'entrée n'a aucun intérêt ici
        rec = controler(noms[fid], v[ID_GLUCIDES], v.get(ID_FIBRES, 0.0), journal)
        if rec:
            out.append(rec)
    return out


def dedoublonner(liste, journal):
    vu, out = {}, []
    for rec in liste:
        cle = normalise(rec['n'])
        if cle in vu:
            journal.append('doublon écarté : %s' % rec['n'])
            continue
        vu[cle] = True
        out.append(rec)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cnf', help='dossier des CSV du Fichier canadien sur les éléments nutritifs')
    ap.add_argument('--out', default='foods.json')
    ap.add_argument('--curated', default=os.path.join(os.path.dirname(__file__), 'aliments-curated.tsv'))
    args = ap.parse_args()

    journal = []
    aliments = lire_curated(args.curated, journal)
    source = 'liste curatée'
    if args.cnf:
        officiels = lire_cnf(args.cnf, journal)
        if officiels:
            # Le FCÉN passe devant; la liste curatée complète les manques
            aliments = officiels + aliments
            source = 'FCÉN (Santé Canada) + liste curatée'

    aliments = dedoublonner(aliments, journal)
    aliments.sort(key=lambda r: normalise(r['n']))

    with open(args.out, 'w', encoding='utf-8') as fh:
        json.dump({'source': source, 'foods': aliments}, fh,
                  ensure_ascii=False, separators=(',', ':'))

    taille = os.path.getsize(args.out)
    print('%d aliments → %s (%d ko) — source : %s'
          % (len(aliments), args.out, round(taille / 1024), source))
    if journal:
        print('\n%d entrées écartées :' % len(journal))
        for l in journal[:20]:
            print('  -', l)
        if len(journal) > 20:
            print('  … et %d autres' % (len(journal) - 20))


if __name__ == '__main__':
    main()
