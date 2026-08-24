/* Restes depuis la fiche du journal : un repas récent avec photo offre la
   soustraction du non-mangé même une fois le repas terminé. L'écart
   servi / mangé s'affiche en faits, et totaux, aliments et pastilles
   passent au « mangé ». */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { serve, launch, check, finish, JPEG_1PX } = require('./helper');

// L'IA (simulée) voit la moitié du riz restant, le poulet fini
const LEFTOVERS = { foods: [
  { name: 'Riz', gramsRemaining: 100 },
  { name: 'Poulet', gramsRemaining: 0 }
] };

(async () => {
  const jpgPath = path.join(os.tmpdir(), 'gn-e2e-restes.jpg');
  fs.writeFileSync(jpgPath, Buffer.from(JPEG_1PX, 'base64'));

  const { srv, base } = await serve();
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.route('**/v1/messages', r => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(LEFTOVERS) }] })
  }));
  await page.addInitScript(([jpeg, old]) => {
    if (localStorage.getItem('gn_no_reseed')) return;
    localStorage.setItem('gn_onboarded', '1');
    localStorage.setItem('gn_api_key', 'sk-ant-test');
    // Repas TERMINÉ (pas le repas en cours) d'il y a 1 h — ou 10 h pour
    // le second passage, où le bouton doit avoir disparu
    const ts = Date.now() - (old ? 10 : 1) * 3600e3;
    localStorage.setItem('gn_history', JSON.stringify([{
      id: 'r1', updatedAt: Date.now(), ts,
      items: [
        { name: 'Riz (photo)', carbs: 56, fiber: 2, polyols: 0, polyolType: 'half', ratio: 1, grams: 200 },
        { name: 'Poulet (photo)', carbs: 2, fiber: 0, polyols: 0, polyolType: 'half', ratio: 1, grams: 120 }
      ],
      net: 56, carbs: 58, fiber: 2, polyols: 0, photo: jpeg,
      overlay: [
        { name: 'Riz', grams: 200, carbs: 56, fiber: 2, x: 50, y: 60, w: 40, h: 30, pieces: null, confidence: 'bonne' },
        { name: 'Poulet', grams: 120, carbs: 2, fiber: 0, x: 40, y: 25, w: 30, h: 20, pieces: null, confidence: 'moyenne' }
      ]
    }]));
  }, [JPEG_1PX, false]);

  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('.tab-btn[data-tab="journal"]');
  await page.waitForTimeout(200);
  await page.locator('.journal-meal .open-entry').first().click();
  await page.waitForTimeout(400);

  check('bouton « restes » offert sur un repas récent', await page.locator('#entry-leftover').isVisible());
  await page.setInputFiles('#entry-leftover-input', jpgPath);
  await page.waitForTimeout(900);

  check('comparaison par-dessus la fiche',
    await page.locator('#consumed-modal.open').count() === 1 &&
    await page.locator('#entry-modal.open').count() === 1);
  check('2 lignes servi → mangé', await page.locator('#cons-list .cons-row').count() === 2);
  // Riz : 100 g sur 200 g → 28 g de glucides (fibres 1) · Poulet : tout mangé
  const consTotal = await page.locator('#cons-total').textContent();
  check('total consommé 29 g nets', consTotal.includes('29'), consTotal);
  const delta = await page.locator('#cons-delta').textContent();
  check('écart : servi 56 g nets', delta.includes('Servi : ≈ 56 g nets'), delta);
  check('écart : non mangé 27 g nets', delta.includes('non mangé : ≈ 27 g nets'), delta);

  await page.click('#cons-apply');
  await page.waitForTimeout(500);
  check('comparaison refermée, fiche rouverte',
    await page.locator('#consumed-modal.open').count() === 0 &&
    await page.locator('#entry-modal.open').count() === 1);
  check('fiche au « mangé » : 29 g nets', (await page.locator('#entry-net').textContent()).includes('29'));

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gn_history'))[0]);
  check('entrée du journal mise à jour', saved.net === 29 && saved.carbs === 30 && saved.fiber === 1,
    JSON.stringify({ net: saved.net, carbs: saved.carbs, fiber: saved.fiber }));
  check('aliment réduit au prorata', saved.items[0].grams === 100 && saved.items[0].carbs === 28,
    JSON.stringify(saved.items[0]));
  check('pastilles au « mangé »', saved.overlay[0].grams === 100 && saved.overlay[0].carbs === 28,
    JSON.stringify(saved.overlay[0]));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const journalTxt = await page.locator('#journal-list').textContent();
  check('journal au « mangé »', journalTxt.includes('29'), journalTxt.slice(0, 120));

  // Repas d'il y a 10 h : trop tard pour comparer des restes — bouton caché
  await page.evaluate(([jpeg]) => {
    localStorage.setItem('gn_no_reseed', '1');
    const h = JSON.parse(localStorage.getItem('gn_history'));
    h[0].ts = Date.now() - 10 * 3600e3;
    localStorage.setItem('gn_history', JSON.stringify(h));
  }, [JPEG_1PX]);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('.tab-btn[data-tab="journal"]');
  await page.waitForTimeout(200);
  await page.locator('.journal-meal .open-entry').first().click();
  await page.waitForTimeout(300);
  check('repas trop vieux : bouton caché', !(await page.locator('#entry-leftover').isVisible()));

  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await finish(browser, srv);
})();
