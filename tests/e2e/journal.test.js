/* Journal : rangées interactives, fiche détaillée, retrait par aliment,
   photo attachée au repas, glycémie et note. */
'use strict';
const { serve, launch, check, finish, JPEG_1PX } = require('./helper');

(async () => {
  const { srv, base } = await serve();
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.addInitScript(([jpeg]) => {
    localStorage.setItem('gn_onboarded', '1');
    const now = Date.now();
    localStorage.setItem('gn_history', JSON.stringify([
      {
        id: 'e1', updatedAt: now, ts: now - 3600e3,
        items: [
          { name: 'Mini pita', carbs: 15, fiber: 1, polyols: 0, polyolType: 'half', ratio: 1, grams: 30 },
          { name: 'Houmous', carbs: 8, fiber: 3, polyols: 0, polyolType: 'half', ratio: 2 }
        ],
        net: 24, carbs: 31, fiber: 7, polyols: 0, photo: jpeg
      },
      {
        id: 'e2', updatedAt: now, ts: now - 4 * 86400e3,
        items: [{ name: 'Biscuits soda', carbs: 17, fiber: 0.5, polyols: 0, polyolType: 'half', ratio: 1, grams: 25 }],
        net: 16.5, carbs: 17, fiber: 0.5, polyols: 0
      }
    ]));
  }, [JPEG_1PX]);

  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('.tab-btn[data-tab="journal"]');
  await page.waitForTimeout(300);

  check('deux rangées au journal', await page.locator('.journal-meal').count() === 2);
  check('une miniature photo', await page.locator('.journal-meal .thumb').count() === 1);

  // Fiche détaillée
  await page.locator('.journal-meal .open-entry').first().click();
  await page.waitForTimeout(300);
  check('fiche ouverte', await page.locator('#entry-modal.open').count() === 1);
  check('photo visible dans la fiche', await page.locator('#entry-photo').isVisible());
  check('2 aliments listés', await page.locator('#entry-items .food-item').count() === 2);
  check('retrait par aliment offert', await page.locator('#entry-items .food-item .remove').count() === 2);

  // Retrait d'un aliment → totaux recalculés
  await page.locator('#entry-items .food-item .remove').last().click();
  await page.waitForTimeout(300);
  check('un aliment restant', await page.locator('#entry-items .food-item').count() === 1);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('gn_history'))[0]);
  check('totaux recalculés (net 14)', after.net === 14, after.net);
  check('photo conservée après retrait', typeof after.photo === 'string' && after.photo.length > 10);

  // Recharger → onglet Calculer
  await page.click('#entry-reload');
  await page.waitForTimeout(400);
  check('repas rechargé dans Calculer', await page.locator('#meal-list .food-item').count() === 1);
  check('onglet Calculer actif', (await page.locator('.tab-btn.active').getAttribute('data-tab')) === 'meal');

  // Photo attachée à la confirmation d'un repas (photoMeal frais)
  await page.evaluate(([jpeg]) => {
    localStorage.setItem('gn_photo_meal', JSON.stringify({
      ts: Date.now(), img: jpeg, foods: [{ name: 'Pomme', grams: 100 }]
    }));
  }, [JPEG_1PX]);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('.tab-btn[data-tab="meal"]');
  await page.waitForTimeout(200);
  await page.click('#finish-btn');
  await page.waitForTimeout(400);
  const top = await page.evaluate(() => JSON.parse(localStorage.getItem('gn_history'))[0]);
  check('photo attachée au repas confirmé', typeof top.photo === 'string' && top.photo.length > 10);

  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await finish(browser, srv);
})();
