/* Annoter après coup la photo d'un repas d'avant les annotations :
   l'IA (simulée) resitue les aliments connus, la fiche devient annotée
   et la géométrie est enregistrée pour de bon. */
'use strict';
const { serve, launch, check, finish, JPEG_1PX } = require('./helper');

const ANNOTATE_RESULT = {
  foods: [
    { name: 'Riz et orge', x: 45, y: 60, w: 40, h: 30, pieces: null, confidence: 'bonne' },
    { name: 'Poulet grillé', x: 40, y: 30, w: 35, h: 22, pieces: null, confidence: 'moyenne' },
    { name: 'Biscuit sec', x: null, y: null, w: null, h: null, pieces: null, confidence: null }
  ]
};

(async () => {
  const { srv, base } = await serve();
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.route('**/v1/messages', r => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(ANNOTATE_RESULT) }] })
  }));
  await page.addInitScript(([jpeg]) => {
    if (localStorage.getItem('gn_no_reseed')) return; // fin de test : ne pas réécraser
    localStorage.setItem('gn_onboarded', '1');
    localStorage.setItem('gn_api_key', 'sk-ant-test');
    // Repas d'avant v2.35 : photo SANS géométrie d'annotations
    localStorage.setItem('gn_history', JSON.stringify([{
      id: 'old1', updatedAt: Date.now(), ts: Date.now() - 86400e3,
      items: [
        { name: 'Riz et orge', carbs: 44, fiber: 4, polyols: 0, polyolType: 'half', ratio: 1, grams: 180 },
        { name: 'Poulet grillé', carbs: 1, fiber: 0, polyols: 0, polyolType: 'half', ratio: 1, grams: 120 },
        { name: 'Biscuit sec', carbs: 9, fiber: 0.3, polyols: 0, polyolType: 'half', ratio: 1, grams: 12 }
      ],
      net: 49.7, carbs: 54, fiber: 4.3, polyols: 0, photo: jpeg
    }]));
  }, [JPEG_1PX]);

  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('.tab-btn[data-tab="journal"]');
  await page.waitForTimeout(200);
  await page.locator('.journal-meal .open-entry').first().click();
  await page.waitForTimeout(400);

  check('photo nue (pas annotée)', await page.locator('#entry-photo-wrap.annotated').count() === 0);
  check('bouton « Annoter » visible', await page.locator('#entry-annotate').isVisible());

  await page.click('#entry-annotate');
  await page.waitForTimeout(700);
  check('photo maintenant annotée', await page.locator('#entry-photo-wrap.annotated').count() === 1);
  check('2 pastilles (le biscuit est hors photo)', await page.locator('#entry-marks .mp-onum').count() === 2);
  check('bouton « Annoter » disparu', !(await page.locator('#entry-annotate').isVisible()));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gn_history'))[0]);
  check('géométrie enregistrée (2 aliments situés)', Array.isArray(saved.overlay) && saved.overlay.length === 2);
  check('glucides absolus repris du repas', saved.overlay[0].carbs === 44 && saved.overlay[0].grams === 180,
    JSON.stringify(saved.overlay[0]));

  // Info-bulle sur une pastille fraîchement posée : bandeau sous la
  // photo, seul le contour sélectionné reste plein
  await page.locator('#entry-marks .mp-onum').first().click();
  await page.waitForTimeout(300);
  check('info-bulle : nom et nets', (await page.locator('#entry-info .t').textContent()).includes('Riz') &&
    (await page.locator('#entry-info .v').textContent()).includes('40 g nets'));
  check('bandeau hors de la photo',
    await page.evaluate(() => !document.getElementById('entry-info').closest('#entry-photo-wrap')));
  check('autre contour estompé',
    await page.evaluate(() => {
      const autres = document.querySelectorAll('#entry-shapes [data-fi="1"], #entry-marks [data-fi="1"]');
      return autres.length > 0 && Array.prototype.every.call(autres, el => el.style.opacity === '0.15');
    }));

  // Sans accès IA, le bouton n'apparaît pas
  await page.evaluate(() => localStorage.removeItem('gn_api_key'));
  await page.evaluate(() => {
    const h = JSON.parse(localStorage.getItem('gn_history'));
    delete h[0].overlay;
    localStorage.setItem('gn_history', JSON.stringify(h));
    localStorage.setItem('gn_no_reseed', '1');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('.tab-btn[data-tab="journal"]');
  await page.locator('.journal-meal .open-entry').first().click();
  await page.waitForTimeout(300);
  check('sans IA : bouton caché', !(await page.locator('#entry-annotate').isVisible()));

  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await finish(browser, srv);
})();
