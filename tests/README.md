# Tests

Aucune dépendance à installer.

```sh
node --test tests/calc.test.mjs                       # glucides nets
node --experimental-strip-types supabase/functions/analyze/guard.test.mjs   # garde du proxy IA
python3 tools/build-foods.py --out /tmp/foods.json    # validation de la base d'aliments
```

`calc.js` contient le calcul des glucides nets, sorti de `index.html`
pour cette raison précise : c'est le chiffre qui entre dans une pompe à
insuline, il doit être vérifiable sans navigateur.
