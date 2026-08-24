/* Pastilles sur photo chargée : deux contours voisins partagent un coin —
   chaque badge doit rester tappable (jamais l'un par-dessus l'autre), à
   l'évaluation comme dans la fiche du journal. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { serve, launch, check, finish, JPEG_1PX } = require('./helper');

// Rôties et demi-banane : leurs coins haut-gauche se touchent presque
const RESULT = {
  found: false, productName: null, basis: null, portionGrams: null, portionLabel: null,
  carbs: null, fiber: null, polyols: null, erythritol: null, barcode: null,
  scaleRef: null, confidence: 'moyenne', question: null, crumbs: null,
  foods: [
    { name: 'Rôties', grams: 56, measure: null, carbs: 25, carbsMin: 22, carbsMax: 28,
      fiber: 2, confidence: 'bonne', x: 44, y: 50, w: 26, h: 34, pieces: null },
    { name: 'Banane (moitié)', grams: 50, measure: null, carbs: 12, carbsMin: 10, carbsMax: 14,
      fiber: 1.3, confidence: 'moyenne', x: 33, y: 36, w: 14, h: 12, pieces: null }
  ]
};

(async () => {
  const jpgPath = path.join(os.tmpdir(), 'gn-e2e-pastilles.jpg');
  fs.writeFileSync(jpgPath, Buffer.from(JPEG_1PX, 'base64'));

  const { srv, base } = await serve();
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 900 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.route('**/vendor/tesseract/**', r => r.abort());
  await page.route('**/v1/messages', r => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(RESULT) }] })
  }));
  await page.addInitScript(([jpeg]) => {
    localStorage.setItem('gn_onboarded', '1');
    localStorage.setItem('gn_api_key', 'sk-ant-test');
    // Fiche du journal : même géométrie serrée, enregistrée avec la photo
    localStorage.setItem('gn_history', JSON.stringify([{
      id: 'p1', updatedAt: Date.now(), ts: Date.now() - 3600e3,
      items: [
        { name: 'Rôties', carbs: 25, fiber: 2, polyols: 0, polyolType: 'half', ratio: 1, grams: 56 },
        { name: 'Banane (moitié)', carbs: 12, fiber: 1.3, polyols: 0, polyolType: 'half', ratio: 1, grams: 50 }
      ],
      net: 33.7, carbs: 37, fiber: 3.3, polyols: 0, photo: jpeg,
      overlay: [
        { name: 'Rôties', grams: 56, carbs: 25, fiber: 2, x: 44, y: 50, w: 26, h: 34, pieces: null, confidence: 'bonne' },
        { name: 'Banane (moitié)', grams: 50, carbs: 12, fiber: 1.3, x: 33, y: 36, w: 14, h: 12, pieces: null, confidence: 'moyenne' }
      ]
    }]));
  }, [JPEG_1PX]);

  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(500);

  // Écran d'évaluation
  await page.setInputFiles('#label-photo-input', jpgPath);
  await page.waitForSelector('#meal-photo-modal.open', { timeout: 10000 });
  await page.waitForTimeout(600);
  check('2 pastilles à l’évaluation', await page.locator('.mp-onum').count() === 2);
  check('badges séparés à l’évaluation', await page.evaluate(() => {
    const [a, b] = Array.from(document.querySelectorAll('#mp-cards .mp-onum'))
      .map(el => el.getBoundingClientRect());
    return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
  }));
  // Un vrai tap sur chacune (avant le correctif, la 2e interceptait la 1re)
  await page.locator('.mp-onum[data-fi="0"]').tap();
  await page.waitForTimeout(300);
  check('pastille des rôties tappable', (await page.locator('#mp-info .t').textContent()).includes('Rôties'));
  await page.locator('.mp-onum[data-fi="0"]').tap();
  await page.waitForTimeout(200);
  await page.locator('.mp-onum[data-fi="1"]').tap();
  await page.waitForTimeout(300);
  check('pastille de la banane tappable', (await page.locator('#mp-info .t').textContent()).includes('Banane'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Fiche du journal
  await page.click('.tab-btn[data-tab="journal"]');
  await page.waitForTimeout(300);
  await page.locator('.journal-meal .open-entry').first().click();
  await page.waitForTimeout(400);
  check('fiche annotée', await page.locator('#entry-photo-wrap.annotated').count() === 1);
  check('badges séparés dans la fiche', await page.evaluate(() => {
    const rs = Array.from(document.querySelectorAll('#entry-marks .mp-onum'))
      .map(el => el.getBoundingClientRect());
    return rs.length === 2 && (rs[0].right <= rs[1].left || rs[0].left >= rs[1].right ||
      rs[0].bottom <= rs[1].top || rs[0].top >= rs[1].bottom);
  }));
  await page.locator('#entry-marks .mp-onum[data-fi="0"]').tap();
  await page.waitForTimeout(300);
  check('pastille de la fiche tappable', (await page.locator('#entry-info .t').textContent()).includes('Rôties'));

  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await finish(browser, srv);
})();
