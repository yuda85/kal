import type { Ingredient, Per100, RecipeYield } from './types.ts';

const ZERO: Per100 = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

function scale(v: Per100, factor: number): Per100 {
  return { kcal: v.kcal * factor, protein: v.protein * factor, carbs: v.carbs * factor, fat: v.fat * factor };
}

function add(a: Per100, b: Per100): Per100 {
  return { kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat };
}

export interface RecipeNumbers {
  totals: Per100;
  perUnit: Per100 | null;
  per100g: Per100 | null;
}

export function computeRecipe(ingredients: Ingredient[], yld: RecipeYield): RecipeNumbers {
  const units = yld.units ?? 0;
  const cookedGrams = yld.cookedGrams ?? 0;
  if (units <= 0 && cookedGrams <= 0) {
    throw new Error('recipe yield needs units or cookedGrams');
  }
  const totals = ingredients.reduce((acc, i) => add(acc, scale(i.per100, i.grams / 100)), ZERO);
  return {
    totals,
    perUnit: units > 0 ? scale(totals, 1 / units) : null,
    per100g: cookedGrams > 0 ? scale(totals, 100 / cookedGrams) : null,
  };
}

export function portion(r: RecipeNumbers, qty: number): Per100 {
  if (r.perUnit) return scale(r.perUnit, qty);
  if (r.per100g) return scale(r.per100g, qty / 100);
  throw new Error('recipe has no per-unit or per-100g values');
}
