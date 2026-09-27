import { describe, expect, it } from 'vitest';
import { computeRecipe, portion } from './recipe.ts';
import { FISH_BALLS } from './testing.ts';

describe('computeRecipe', () => {
  it('sums ingredients and divides by units', () => {
    const r = computeRecipe(FISH_BALLS, { units: 20, unitName: 'קציצה' });
    expect(r.totals.kcal).toBeCloseTo(1253.2, 6);
    expect(r.totals.protein).toBeCloseTo(120.6, 6);
    expect(r.totals.carbs).toBeCloseTo(72.7, 6);
    expect(r.totals.fat).toBeCloseTo(52, 6);
    expect(r.perUnit!.kcal).toBeCloseTo(62.66, 6);
    expect(r.per100g).toBeNull();
  });

  it('computes per 100 g of cooked weight', () => {
    const r = computeRecipe(FISH_BALLS, { cookedGrams: 1000 });
    expect(r.perUnit).toBeNull();
    expect(r.per100g!.kcal).toBeCloseTo(125.32, 6);
  });

  it('rejects a yield without units or cooked weight', () => {
    expect(() => computeRecipe(FISH_BALLS, {})).toThrow('units or cookedGrams');
    expect(() => computeRecipe(FISH_BALLS, { units: 0 })).toThrow('units or cookedGrams');
  });
});

describe('portion', () => {
  it('multiplies per-unit values by qty units', () => {
    const p = portion(computeRecipe(FISH_BALLS, { units: 20 }), 3);
    expect(p.kcal).toBeCloseTo(187.98, 6);
    expect(p.protein).toBeCloseTo(18.09, 6);
  });

  it('treats qty as grams for a recipe with only cooked weight', () => {
    const p = portion(computeRecipe(FISH_BALLS, { cookedGrams: 1000 }), 250);
    expect(p.kcal).toBeCloseTo(313.3, 6);
  });
});
