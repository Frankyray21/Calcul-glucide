/* Rapport pour la clinique : statistiques attendues calculées à la main,
   périodes, graphique, empilement des modals, partage et PDF. */
'use strict';
const { serve, launch, check, finish, JPEG_1PX } = require('./helper');

(async () => {
  const { srv, base } = await serve();
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // 5 repas sur 3 jours consignés :
  //   aujourd'hui 8 h net 30 + 18 h net 60 → jour 90
  //   hier 12 h 30 net 45 (photo)          → jour 45
  //   il y a 10 jours 17 h net 80 + 22 h net 15 → jour 95
  // Fenêtre 14 j : moy 230/3 = 76,7 · médiane 90 · par repas 46
  // Fenêtre 7 j : moy 135/2 = 67,5
  await page.addInitScript(([jpeg]) => {
    localStorage.setItem('gn_onboarded', '1');
    const now = new Date();
    const at = (d, h, m) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, h, m).getTime();
    const mk = (id, ts, net, carbs, fiber, names, photo) => ({
      id, updatedAt: Date.now(), ts,
      items: names.map(n => ({ name: n, carbs: 10, fiber: 1, polyols: 0, polyolType: 'half', ratio: 1, grams: 50 })),
      net, carbs, fiber, polyols: 0, ...(photo ? { photo: jpeg } : {})
    });
    localStorage.setItem('gn_history', JSON.stringify([
      mk('r1', at(0, 8, 0), 30, 33, 3, ['Gruau']),
      mk('r2', at(0, 18, 0), 60, 66, 6, ['Pâtes']),
      mk('r3', at(1, 12, 30), 45, 50, 5, ['Sandwich'], true),
      mk('r4', at(10, 17, 0), 80, 88, 8, ['Pizza']),
      mk('r5', at(10, 22, 0), 15, 16, 1, ['Biscuits'])
    ]));
  }, [JPEG_1PX]);

  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('.tab-btn[data-tab="journal"]');
  await page.waitForTimeout(200);
  await page.click('#report-open');
  await page.waitForTimeout(400);

  check('rapport ouvert', await page.locator('#report-modal.open').count() === 1);
  check('défaut 14 j', (await page.locator('#report-periods button.sel').textContent()) === '14 j');
  check('moyenne/jour consigné 76.7', (await page.locator('#report-avg').textContent()).includes('76.7'));
  check('sous-titre 5 repas · 3 jours sur 14',
    (await page.locator('#report-sub').textContent()).includes('5 repas · 3 jours consignés sur 14'));
  const keys = (await page.locator('#report-keys .ref-item, #report-keys2 .ref-item').allTextContents()).join(' ');
  check('médiane 90', keys.includes('90 g'));
  check('moyenne par repas 46', keys.includes('46 g'));
  check('jour le plus élevé 95', keys.includes('95 g'));
  check('4 moments listés', await page.locator('#report-moments .ref-item').count() === 4);
  check('3 barres (jours non vides)', await page.locator('#report-chart .bar').count() === 3);
  check('top 3 repas', await page.locator('#report-top .journal-meal').count() === 3);

  // Détail du calcul : la soustraction affichée retombe sur la vedette
  const calc = (await page.locator('#report-calc .ref-item .ref-val').allTextContents()).map(s => s.trim());
  check('détail du calcul en 3 lignes', calc.length === 3, calc.join(' / '));

  // Périodes : 7 j exact et mémorisé; 90 j hebdomadaire non tappable
  await page.locator('#report-periods button', { hasText: '7 j' }).click();
  await page.waitForTimeout(300);
  check('7 j : moyenne 67.5', (await page.locator('#report-avg').textContent()).includes('67.5'));
  check('choix mémorisé', (await page.evaluate(() => localStorage.getItem('gn_report_period'))) === '7');
  await page.locator('#report-periods button', { hasText: '90 j' }).click();
  await page.waitForTimeout(300);
  check('90 j : note hebdomadaire', (await page.locator('#report-chart-note').textContent()).includes('semaine'));
  check('90 j : pas de zone tappable', await page.locator('#report-chart .bar-hit').count() === 0);

  // Fiche par-dessus le rapport, Échap ne ferme que la fiche
  await page.locator('#report-periods button', { hasText: '14 j' }).click();
  await page.waitForTimeout(300);
  await page.locator('#report-top .open-entry').first().click();
  await page.waitForTimeout(400);
  check('fiche par-dessus le rapport',
    await page.locator('#entry-modal.open').count() === 1 && await page.locator('#report-modal.open').count() === 1);
  check('fiche du plus gros repas (80 g)', (await page.locator('#entry-net').textContent()).includes('80'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Échap ferme la fiche seulement',
    await page.locator('#entry-modal.open').count() === 0 && await page.locator('#report-modal.open').count() === 1);

  // Tap sur une barre quotidienne → ferme le rapport, jour en évidence
  await page.locator('#report-chart .bar-hit').last().click();
  await page.waitForTimeout(400);
  check('tap barre : rapport fermé', await page.locator('#report-modal.open').count() === 0);
  check('journée mise en évidence', await page.locator('.day-header.flash').count() === 1);

  // Partage texte
  await page.evaluate(() => { navigator.share = d => { window.__shared = d; return Promise.resolve(); }; });
  await page.click('#report-open');
  await page.waitForTimeout(300);
  await page.click('#report-share');
  await page.waitForTimeout(200);
  const shared = await page.evaluate(() => window.__shared);
  check('texte partagé : moyenne', !!shared && shared.text.includes('76.7 glucides nets par jour consigné'));
  check('texte partagé : formule des nets', !!shared && shared.text.includes('Nets = glucides − fibres − polyols'));
  check('texte partagé : aucun jugement', !!shared && !/trop|cible|devrait/i.test(shared.text));

  // PDF : calque rempli, gardé par body.printing-report, photo incluse
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.click('#report-pdf');
  await page.waitForTimeout(200);
  check('window.print appelé', (await page.evaluate(() => window.__printed)) === 1);
  const printHtml = await page.evaluate(() => document.getElementById('print-report').innerHTML);
  check('PDF : titre', printHtml.includes('Rapport glucides'));
  check('PDF : moments', printHtml.includes('Souper et soirée'));
  check('PDF : photo du top', printHtml.includes('data:image/jpeg'));
  check('PDF : classe d’impression posée',
    await page.evaluate(() => document.body.classList.contains('printing-report')));

  check('aucune erreur JS', errors.length === 0, errors.join(' | '));
  await finish(browser, srv);
})();
