import { computeRecipe, type Recipe } from '../../domain';
import { fmt } from '../../shared/format';

export interface RecipeRow {
  id: string;
  name: string;
  aliases: string;
  perLabel: string;
  macros: string;
}

export function recipeRow(r: Recipe): RecipeRow {
  const n = computeRecipe(r.ingredients, r.yield);
  const per = n.perUnit ?? n.per100g!;
  const perLabel = n.perUnit ? `${fmt(per.kcal)} קל׳ ל${r.yield.unitName ?? 'יחידה'}` : `${fmt(per.kcal)} קל׳ ל-100 ג׳`;
  return {
    id: r.id,
    name: r.name,
    aliases: r.aliases.join(', '),
    perLabel,
    macros: `P ${fmt(per.protein, 1)} · C ${fmt(per.carbs, 1)} · F ${fmt(per.fat, 1)}`,
  };
}
