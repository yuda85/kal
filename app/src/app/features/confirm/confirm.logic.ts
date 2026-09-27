import { computeRecipe, type Op, type Recipe } from '../../domain';
import { fmt, shortDate } from '../../shared/format';

export function describeOp(op: Op, recipes: Recipe[]): string {
  switch (op.op) {
    case 'weight':
      return `שקילה: ${fmt(op.kg, 1)} ק״ג (${shortDate(op.date)})`;
    case 'recipe': {
      const n = computeRecipe(op.ingredients, op.yield);
      if (n.perUnit) return `מתכון: ${op.name} · ${fmt(n.perUnit.kcal)} קל׳ ל${op.yield.unitName ?? 'יחידה'}`;
      return `מתכון: ${op.name} · ${fmt(n.per100g!.kcal)} קל׳ ל-100 ג׳`;
    }
    case 'activity': {
      const parts: string[] = [];
      if (op.steps !== undefined) parts.push(`${fmt(op.steps)} צעדים`);
      for (const w of op.workouts ?? []) parts.push(`${w.type} ${fmt(w.durationMin)} דק׳ ${fmt(w.kcal)} קל׳`);
      return `פעילות (${shortDate(op.date)}): ${parts.join(' · ')}`;
    }
    case 'add': {
      const recipe = recipes.find((r) => r.id === op.recipeId);
      return recipe ? `${op.name} (${recipe.name})` : op.name;
    }
  }
}
