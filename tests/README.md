# Tests

## Unitaires — sans dépendance

```sh
node --test tests/calc.test.mjs                       # glucides nets
node --experimental-strip-types supabase/functions/analyze/guard.test.mjs   # garde du proxy IA
python3 tools/build-foods.py --out /tmp/foods.json    # validation de la base d'aliments
```

`calc.js` contient le calcul des glucides nets, sorti de `index.html`
pour cette raison précise : c'est le chiffre qui entre dans une pompe à
insuline, il doit être vérifiable sans navigateur.

## Bout-en-bout — Playwright (`tests/e2e/`)

Les parcours critiques dans le vrai navigateur : journal interactif
(fiche, retrait par aliment, photo attachée, glycémie et note), rapport
pour la clinique (statistiques attendues calculées à la main, périodes,
partage, PDF) et analyse photo par IA (API simulée par interception —
aucune clé ni réseau requis).

```sh
cd tests/e2e
npm install
npx playwright install --with-deps chromium
node run-all.mjs
```

Si les navigateurs Playwright vivent ailleurs (`PLAYWRIGHT_BROWSERS_PATH`),
pointer `CHROMIUM_PATH` directement sur l'exécutable.

La CI (`.github/workflows/tests.yml`) lance unitaires et bout-en-bout à
chaque poussée sur `main` et sur chaque pull request — une régression
doit se voir avant que `gh-pages` ne la serve.
