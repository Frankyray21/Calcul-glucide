/* Parcours d'interface : une recherche conduit à une quantité explicite,
   les corrections gardent la portion, l'accueil distingue le repas en
   cours des repas terminés et la navigation ne déclenche pas la caméra. */
'use strict';
const { serve, launch, check, finish } = require('./helper');

(async () => {
  const { srv, base } = await serve();
  const browser = await launch();
  const page = await browser.newPage({
    viewport: { width: 400, height: 900 },
    serviceWorkers: 'block',
    reducedMotion: 'reduce'
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.addInitScript(() => {
    localStorage.setItem('gn_onboarded', '1');
    const now = Date.now();
    const item = (name, carbs, fiber) => ({
      name, carbs, fiber, polyols: 0, polyolType: 'half', ratio: 1
    });
    localStorage.setItem('gn_favorites', JSON.stringify([
      { ...item('Favori ancien par portion', 10, 2), id: 'ui-fav', updatedAt: now }
    ]));
    localStorage.setItem('gn_history', JSON.stringify([
      {
        id: 'ui-recent', updatedAt: now, ts: now - 6 * 3600e3,
        items: [item('Repas terminé récent', 22, 2)],
        net: 20, carbs: 22, fiber: 2, polyols: 0
      },
      {
        id: 'ui-older', updatedAt: now, ts: now - 30 * 3600e3,
        items: [item('Repas terminé précédent', 31, 1)],
        net: 30, carbs: 31, fiber: 1, polyols: 0
      }
    ]));
    window.__cameraRequests = 0;
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = () => {
        window.__cameraRequests++;
        return Promise.reject(new Error('La navigation ne doit pas demander la caméra'));
      };
    }
  });

  const go = tab => page.locator('.tab-btn[data-tab="' + tab + '"]').click();
  const numberAt = async selector => {
    const text = await page.locator(selector).innerText();
    return Number(text.replace(',', '.').match(/-?\d+(?:\.\d+)?/)[0]);
  };
  const savedMeal = () => page.evaluate(() => JSON.parse(localStorage.getItem('gn_meal') || '[]'));
  async function searchRice(input, results) {
    await page.locator(input).fill('riz');
    await page.locator(results + ' button').filter({ hasText: 'Riz blanc, grain long, cuit' }).click();
    await page.locator('#qty-modal.open').waitFor();
  }

  try {
    await page.goto(base + '/index.html', { waitUntil: 'load' });

    // Le bouton central garde une fonction de navigation, même au second tap.
    await go('journal');
    await go('meal');
    await go('meal');
    check('Calculer reste actif après deux taps',
      await page.locator('.tab-btn[data-tab="meal"]').getAttribute('aria-current') === 'true');
    check('la navigation centrale n’ouvre aucune feuille de scan',
      await page.locator('#scan-modal.open').count() === 0);
    check('la navigation ne demande pas la caméra',
      await page.evaluate(() => window.__cameraRequests) === 0);

    // Base connue par 100 g : aucune portion implicite ne peut entrer au repas.
    await searchRice('#db-search', '#db-results');
    check('la recherche ouvre la fiche du riz',
      (await page.locator('#qty-title').textContent()).includes('Riz blanc, grain long, cuit'));
    check('quantité initiale vide', await page.locator('#qty-grams').inputValue() === '');
    check('ajout désactivé sans quantité', await page.locator('#qty-add').isDisabled());
    await page.locator('#qty-grams').fill('0');
    check('ajout désactivé pour zéro gramme', await page.locator('#qty-add').isDisabled());
    check('ouvrir la fiche ne crée aucun aliment', (await savedMeal()).length === 0);
    await page.locator('#qty-grams').fill('150');
    check('150 g de riz donnent 41,7 g nets', await numberAt('#qty-net') === 41.7);
    check('ajout disponible avec une quantité positive', await page.locator('#qty-add').isEnabled());
    await page.locator('#qty-add').click();
    const riceMeal = await savedMeal();
    check('la portion pesée est conservée dans le repas',
      riceMeal.length === 1 && riceMeal[0].grams === 150 && riceMeal[0].ratio === 1.5);
    check('total du repas après ajout : 41,7 g', await numberAt('#total-net') === 41.7);

    // Le détail reste consultable, avec les valeurs de la portion réellement ajoutée.
    check('détail du total initialement replié', !(await page.locator('#total-breakdown').isVisible()));
    await page.locator('#total-toggle').click();
    check('détail ouvert et annoncé comme tel',
      await page.locator('#total-breakdown').isVisible() &&
      await page.locator('#total-toggle').getAttribute('aria-expanded') === 'true');
    check('détail : 42,3 g de glucides et 0,6 g de fibres',
      await numberAt('#total-carbs') === 42.3 && await numberAt('#total-fiber') === 0.6);
    await page.locator('#total-toggle').click();
    check('le détail peut être refermé',
      !(await page.locator('#total-breakdown').isVisible()) &&
      await page.locator('#total-toggle').getAttribute('aria-expanded') === 'false');

    // Le miroir du repas courant au journal ne doit pas créer un doublon à l'accueil.
    await go('home');
    check('l’accueil montre le total du repas courant',
      await page.locator('#home-meal-amount').isVisible() && await numberAt('#home-meal-net') === 41.7);
    check('l’accueil décrit le riz courant',
      (await page.locator('#home-meal-description').textContent()).includes('Riz blanc'));
    const recent = await page.locator('#home-recent-meals .recent-meal').allTextContents();
    check('deux repas terminés, sans doublon du repas courant',
      recent.length === 2 && recent.every(text => !text.includes('Riz blanc')));
    check('les repas terminés sont ordonnés du plus récent au plus ancien',
      recent[0].includes('Repas terminé récent') && recent[1].includes('Repas terminé précédent'));
    await page.locator('#home-recent-meals .recent-meal').first().click();
    check('un repas récent ouvre sa fiche correcte', await numberAt('#entry-net') === 20);
    await page.keyboard.press('Escape');

    // Même fiche depuis Accueil; passer en correction conserve les 150 g choisis.
    await searchRice('#home-db-search', '#home-db-results');
    check('la recherche d’accueil redemande une quantité',
      await page.locator('#qty-grams').inputValue() === '' && await page.locator('#qty-add').isDisabled());
    await page.locator('#qty-grams').fill('150');
    await page.locator('#qty-edit').click();
    check('corriger ferme la fiche et ouvre le formulaire manuel',
      await page.locator('#qty-modal.open').count() === 0 &&
      await page.locator('#manual-details').evaluate(el => el.open));
    check('corriger conserve référence 100 g et quantité 150 g',
      await page.locator('#portion-label').inputValue() === '100' &&
      await page.locator('#portion-eaten').inputValue() === '150');
    await page.locator('#add-btn').click();
    const correctedMeal = await savedMeal();
    check('la correction ajoute la même portion, pas 100 g par défaut',
      correctedMeal.length === 2 && correctedMeal[1].ratio === 1.5 &&
      await numberAt('#total-net') === 83.4);

    // Les favoris anciens n'ont pas de référence de poids : leur unité ne change pas.
    await go('recipes');
    await page.locator('#favorites-list .fav-add').filter({ hasText: 'Favori ancien par portion' }).click();
    const withFavorite = await savedMeal();
    const favorite = withFavorite[withFavorite.length - 1];
    check('le favori ancien reste un ajout à sa portion enregistrée',
      withFavorite.length === 3 && favorite.name === 'Favori ancien par portion' &&
      favorite.carbs === 10 && favorite.fiber === 2 && favorite.ratio === 1 && !favorite.grams);
    await go('meal');
    check('le favori ancien ajoute toujours 8 g nets', await numberAt('#total-net') === 91.4);

    // Terminer fait passer ce repas une seule fois des courants aux récents.
    await page.locator('#finish-btn').click();
    await go('home');
    check('le repas terminé disparaît du résumé courant', !(await page.locator('#home-meal-amount').isVisible()));
    const completed = await page.locator('#home-recent-meals .recent-meal').allTextContents();
    check('le repas terminé apparaît une seule fois dans les récents',
      completed.length === 3 && completed.filter(text => text.includes('Riz blanc')).length === 1);
    check('le repas qui vient de terminer conserve son total',
      await numberAt('#home-recent-meals .recent-meal:first-child .recent-net') === 91.4);
  } catch (error) {
    check('parcours interface exécuté sans interruption', false, error.stack || error.message);
  } finally {
    check('aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
    await finish(browser, srv);
  }
})();
