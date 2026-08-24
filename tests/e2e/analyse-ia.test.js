/* Analyse photo par IA (API simulée) : pastilles interactives avec
   info-bulle de confiance, photo attachée au journal sans autre action,
   et photo annotée dans la fiche du journal. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { serve, launch, check, finish, JPEG_1PX } = require('./helper');

const RESULT = {
  found: false, productName: null, basis: null, portionGrams: null, portionLabel: null,
  carbs: null, fiber: null, polyols: null, erythritol: null, barcode: null,
  scaleRef: null, confidence: 'moyenne', question: null, crumbs: null,
  foods: [
    { name: 'Riz et légumineuses', grams: 180, measure: null, carbs: 48, carbsMin: 42, carbsMax: 54,
      fiber: 2, confidence: 'moyenne', x: 45, y: 65, w: 45, h: 30, pieces: null },
    { name: 'Poulet en sauce', grams: 120, measure: null, carbs: 3, carbsMin: 2, carbsMax: 5,
      fiber: 0, confidence: 'bonne', x: 40, y: 30, w: 40, h: 25, pieces: null },
    { name: 'Courge', grams: 60, measure: null, carbs: 6, carbsMin: 3, carbsMax: 10,
      fiber: 1, confidence: 'faible', x: 80, y: 45, w: 14, h: 16, pieces: null }
  ]
};

(async () => {
  const jpgPath = path.join(os.tmpdir(), 'gn-e2e-meal.jpg');
  fs.writeFileSync(jpgPath, Buffer.from(JPEG_1PX, 'base64'));

  const { srv, base } = await serve();
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // OCR local bloqué → repli IA; l'API Anthropic est simulée
  await page.route('**/vendor/tesseract/**', r => r.abort());
  await page.route('**/v1/messages', r => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(RESULT) }] })
  }));
  await page.addInitScript(() => {
    localStorage.setItem('gn_onboarded', '1');
    localStorage.setItem('gn_api_key', 'sk-ant-test');
  });

  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.setInputFiles('#label-photo-input', jpgPath);
  await page.waitForSelector('#meal-photo-modal.open', { timeout: 10000 });
  await page.waitForTimeout(500);

  // Pastilles interactives de l'écran d'évaluation
  check('3 pastilles numérotées', await page.locator('.mp-onum').count() === 3);
  await page.locator('.mp-onum').first().click();
  await page.waitForTimeout(300);
  check('info-bulle ouverte', await page.locator('#mp-info').count() === 1);
  check('info-bulle : nom', (await page.locator('#mp-info .t').textContent()).includes('Riz'));
  check('info-bulle : confiance', (await page.locator('#mp-info .conf').textContent()).includes('à vérifier'));
  // L'info se pose SUR la photo, du côté libre : jamais par-dessus
  // l'aliment sélectionné, et seule la sélection garde ses contours pleins
  check('info posée sur la photo',
    await page.evaluate(() => !!document.getElementById('mp-info').closest('.mp-photo-wrap')));
  check('info ne couvre pas l’aliment sélectionné',
    await page.evaluate(() => {
      const b = document.getElementById('mp-info').getBoundingClientRect();
      const shapes = document.querySelectorAll('#mp-shapes .mp-shape[data-fi="0"]');
      return shapes.length > 0 && Array.prototype.every.call(shapes, s => {
        const r = s.getBoundingClientRect();
        return b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom;
      });
    }));
  check('autres contours estompés',
    await page.evaluate(() => {
      const els = document.querySelectorAll('#mp-shapes [data-fi], #mp-cards [data-fi]');
      let selPlein = false, autresEstompes = true;
      els.forEach(el => {
        if (el.getAttribute('data-fi') === '0') { if (el.style.opacity === '') selPlein = true; }
        else if (el.style.opacity !== '0.15') autresEstompes = false;
      });
      return selPlein && autresEstompes;
    }));
  await page.locator('.mp-onum').first().click();
  await page.waitForTimeout(200);
  check('second tap referme', await page.locator('#mp-info').count() === 0);
  check('contours restaurés à la fermeture',
    await page.evaluate(() =>
      Array.prototype.every.call(document.querySelectorAll('#mp-shapes [data-fi]'),
        el => el.style.opacity === '')));
  await page.locator('.mp-onum').nth(2).click();
  await page.waitForTimeout(200);
  check('confiance faible affichée', (await page.locator('#mp-info .conf').textContent()).includes('incertain'));

  // Ajouter au repas → la photo suit le repas au journal sans autre geste
  await page.click('#mp-add');
  await page.waitForTimeout(900);
  const entry = await page.evaluate(() => JSON.parse(localStorage.getItem('gn_history'))[0]);
  check('photo attachée au journal', typeof entry.photo === 'string' && entry.photo.length > 10);
  check('géométrie des annotations enregistrée', Array.isArray(entry.overlay) && entry.overlay.length === 3);

  // Fiche du journal : photo annotée comme à l'évaluation
  await page.click('.tab-btn[data-tab="journal"]');
  await page.waitForTimeout(300);
  await page.locator('.journal-meal .open-entry').first().click();
  await page.waitForTimeout(400);
  check('photo annotée dans la fiche', await page.locator('#entry-photo-wrap.annotated').count() === 1);
  check('contours dessinés', await page.locator('#entry-shapes .mp-shape').count() === 3);
  check('pastilles dans la fiche', await page.locator('#entry-marks .mp-onum').count() === 3);
  await page.locator('#entry-marks .mp-onum').first().click();
  await page.waitForTimeout(300);
  check('info-bulle de la fiche', await page.locator('#entry-info').count() === 1);
  check('info-bulle fiche : g nets', (await page.locator('#entry-info .v').textContent()).includes('g nets'));

  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await finish(browser, srv);
})();
