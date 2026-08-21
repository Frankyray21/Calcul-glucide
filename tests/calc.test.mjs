/* Tests du calcul des glucides nets.
 *
 *   node --test tests/calc.test.mjs
 *
 * Aucune dépendance : le lanceur de tests de Node suffit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// calc.js s'installe sur globalThis : on l'évalue tel que le navigateur le ferait
new Function(readFileSync(new URL('../calc.js', import.meta.url), 'utf8'))();
const { round1, round2, deduction, net100, netCarbs, mealTotals } = globalThis.GN_CALC;

const aliment = (o = {}) => ({
  carbs: 0, fiber: 0, polyols: 0, polyolType: 'half', ratio: 1, ...o
});

test('fibres soustraites des glucides totaux', () => {
  assert.equal(netCarbs(aliment({ carbs: 30, fiber: 5 })), 25);
});

test('polyols ordinaires soustraits à moitié', () => {
  assert.equal(netCarbs(aliment({ carbs: 20, polyols: 10 })), 15);
});

test('érythritol soustrait en entier', () => {
  assert.equal(netCarbs(aliment({ carbs: 20, polyols: 10, polyolType: 'full' })), 10);
});

test('un type de polyol inconnu est traité comme ordinaire, pas comme érythritol', () => {
  // Se tromper dans ce sens sous-estime les glucides et donc le bolus :
  // le défaut prudent est la demi-soustraction.
  assert.equal(netCarbs(aliment({ carbs: 20, polyols: 10, polyolType: 'bidon' })), 15);
  assert.equal(netCarbs(aliment({ carbs: 20, polyols: 10, polyolType: undefined })), 15);
});

test('le ratio de portion multiplie le net, pas les valeurs de base', () => {
  assert.equal(netCarbs(aliment({ carbs: 30, fiber: 5, ratio: 2 })), 50);
  assert.equal(netCarbs(aliment({ carbs: 30, fiber: 5, ratio: 0.5 })), 12.5);
});

test('jamais de net négatif', () => {
  // Une étiquette mal saisie ne doit pas produire un bolus négatif
  assert.equal(netCarbs(aliment({ carbs: 2, fiber: 10 })), 0);
  assert.equal(netCarbs(aliment({ carbs: 5, polyols: 30, polyolType: 'full' })), 0);
  assert.equal(net100({ carbs: 1, fiber: 9, polyols: 0, polyolType: 'half' }), 0);
});

test('net100 ignore le ratio (c’est une valeur pour 100 g)', () => {
  assert.equal(net100({ carbs: 40, fiber: 6, polyols: 4, polyolType: 'half', ratio: 3 }), 32);
});

test('deduction : moitié ou totalité selon le type', () => {
  assert.equal(deduction(9, 'half'), 4.5);
  assert.equal(deduction(9, 'full'), 9);
});

test('total d’un repas : somme des nets par aliment', () => {
  const t = mealTotals([
    aliment({ carbs: 30, fiber: 5 }),                              // 25
    aliment({ carbs: 20, polyols: 10 }),                           // 15
    aliment({ carbs: 12, fiber: 2, polyolType: 'full', polyols: 4 }) // 6
  ]);
  assert.equal(round1(t.net), 46);
  assert.equal(round1(t.carbs), 62);
  assert.equal(round1(t.fiber), 7);
  assert.equal(round1(t.polyols), 14);
});

test('une saisie aberrante ne compense pas les autres aliments', () => {
  // Le net est borné À ZÉRO ALIMENT PAR ALIMENT. Si on bornait la somme,
  // l'aliment ci-dessous retrancherait 8 g au total et le bolus serait
  // trop faible sans que rien ne le signale.
  const t = mealTotals([
    aliment({ carbs: 50, fiber: 0 }),
    aliment({ carbs: 2, fiber: 10 })
  ]);
  assert.equal(t.net, 50);
});

test('repas vide', () => {
  assert.deepEqual(mealTotals([]), { net: 0, carbs: 0, fiber: 0, polyols: 0 });
  assert.deepEqual(mealTotals(undefined), { net: 0, carbs: 0, fiber: 0, polyols: 0 });
});

test('arrondis', () => {
  assert.equal(round1(9.64), 9.6);
  assert.equal(round1(9.65), 9.7);
  assert.equal(round1(0.04), 0);
  assert.equal(round2(9.646), 9.65);
});

test('cas réel : 2 biscuits de 14 g à 10 g de glucides, 0,4 g de fibres', () => {
  assert.equal(round1(netCarbs(aliment({ carbs: 10, fiber: 0.4 }))), 9.6);
});

test('cas réel : demi-portion d’un plat à 40 g de glucides et 6 g de fibres', () => {
  assert.equal(round1(netCarbs(aliment({ carbs: 40, fiber: 6, ratio: 0.5 }))), 17);
});
