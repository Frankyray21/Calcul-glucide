/* Calcul des glucides nets — Glucides Nets
 *
 * Sorti du reste de l'app pour une seule raison : c'est le chiffre qui
 * entre dans une pompe à insuline, et il doit être testable sans
 * navigateur. Aucune dépendance, aucune étape de compilation :
 * `node --test tests/calc.test.mjs` suffit.
 *
 * Règle : glucides nets = glucides totaux − fibres − polyols.
 * Les polyols comptent pour moitié (absorption ~50 %), sauf l'érythritol
 * qui n'est pas absorbé du tout et se soustrait en entier.
 */
(function (racine) {
  'use strict';

  function round1(n) { return Math.round(n * 10) / 10; }
  function round2(n) { return Math.round(n * 100) / 100; }

  /* Part de polyols réellement soustraite */
  function deduction(polyols, polyolType) {
    return polyolType === 'full' ? polyols : polyols / 2;
  }

  /* Glucides nets pour 100 g d'une recette. Jamais négatif : une étiquette
     mal saisie ne doit pas produire un bolus négatif. */
  function net100(r) {
    return Math.max(0, r.carbs - r.fiber - deduction(r.polyols, r.polyolType));
  }

  /* Glucides nets d'un aliment du repas, portion comprise (ratio). */
  function netCarbs(item) {
    return Math.max(0, item.carbs - item.fiber - deduction(item.polyols, item.polyolType)) * item.ratio;
  }

  /* Totaux d'un repas. Le net est la somme des nets par aliment, pas le
     net de la somme : borner à zéro aliment par aliment évite qu'une
     saisie aberrante en compense une autre à l'insu de la personne. */
  function mealTotals(meal) {
    var t = { net: 0, carbs: 0, fiber: 0, polyols: 0 };
    (meal || []).forEach(function (item) {
      t.net += netCarbs(item);
      t.carbs += item.carbs * item.ratio;
      t.fiber += item.fiber * item.ratio;
      t.polyols += item.polyols * item.ratio;
    });
    return t;
  }

  racine.GN_CALC = {
    round1: round1, round2: round2, deduction: deduction,
    net100: net100, netCarbs: netCarbs, mealTotals: mealTotals
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
