import type { AddOp, Payload, RecipeOp, VideoOp } from './link.ts';
import { computeRecipe, portion } from './recipe.ts';
import { round1 } from './round.ts';
import type { Day, Entry, Per100, Recipe, WeighIn, Workout } from './types.ts';

export interface StoredRecipe extends Recipe {
  totals: Per100;
  perUnit: Per100 | null;
  per100g: Per100 | null;
}

export interface ActivityWrite {
  date: string;
  linkId: string;
  steps?: number;
  workouts?: Workout[];
}

export const CHECKIN_LINK_ID = 'checkin';

export type Video = Omit<VideoOp, 'op'>;

export interface PlannedWrites {
  entries: Entry[];
  recipes: StoredRecipe[];
  weights: WeighIn[];
  activities: ActivityWrite[];
  checkIns: string[];
  videos: Video[];
}

export function toEntry(op: AddOp, source: 'link' | 'form'): Entry {
  const entry: Entry = {
    id: op.id,
    date: op.date,
    time: op.time,
    name: op.name,
    kcal: op.kcal,
    protein: op.protein ?? null,
    carbs: op.carbs ?? null,
    fat: op.fat ?? null,
    source,
  };
  if (op.recipeId !== undefined) entry.recipeId = op.recipeId;
  if (op.qty !== undefined) entry.qty = op.qty;
  return entry;
}

function toStoredRecipe(op: RecipeOp): StoredRecipe {
  const numbers = computeRecipe(op.ingredients, op.yield);
  return { id: op.id, name: op.name, aliases: op.aliases, ingredients: op.ingredients, yield: op.yield, ...numbers };
}

export function planWrites(payload: Payload, opts: { source: 'link' | 'form'; time: string }): PlannedWrites {
  const out: PlannedWrites = { entries: [], recipes: [], weights: [], activities: [], checkIns: [], videos: [] };
  for (const op of payload.ops) {
    switch (op.op) {
      case 'add':
        out.entries.push(toEntry(op, opts.source));
        break;
      case 'recipe':
        out.recipes.push(toStoredRecipe(op));
        break;
      case 'weight':
        out.weights.push({ date: op.date, kg: op.kg, time: opts.time });
        break;
      case 'activity':
        out.activities.push({
          date: op.date,
          linkId: op.id,
          ...(op.steps !== undefined ? { steps: op.steps } : {}),
          ...(op.workouts !== undefined ? { workouts: op.workouts.map((w) => ({ ...w, linkId: op.id })) } : {}),
        });
        // Only a day summary with steps closes the day; a workout logged mid-day keeps the evening prompt.
        if (op.id === CHECKIN_LINK_ID && op.steps !== undefined) out.checkIns.push(op.date);
        break;
      case 'video': {
        const { op: _, ...video } = op;
        out.videos.push(video);
        break;
      }
    }
  }
  return out;
}

export function mergeManual(existing: Day['manual'], a: ActivityWrite): { steps?: number; workouts: Workout[] } {
  const steps = a.steps ?? existing?.steps;
  // An op without workouts keeps the day's workouts; `workouts: []` removes this link's.
  const workouts =
    a.workouts === undefined
      ? (existing?.workouts ?? [])
      : [...(existing?.workouts ?? []).filter((w) => w.linkId !== a.linkId), ...a.workouts];
  return { ...(steps !== undefined ? { steps } : {}), workouts };
}

export function rescaleAdd(op: AddOp, recipe: Recipe | undefined, qty: number): AddOp {
  if (recipe) {
    const p = portion(computeRecipe(recipe.ingredients, recipe.yield), qty);
    return { ...op, qty, kcal: Math.round(p.kcal), protein: round1(p.protein), carbs: round1(p.carbs), fat: round1(p.fat) };
  }
  const factor = qty / (op.qty ?? 1);
  const scaled: AddOp = { ...op, qty, kcal: Math.round(op.kcal * factor) };
  if (op.protein !== undefined) scaled.protein = round1(op.protein * factor);
  if (op.carbs !== undefined) scaled.carbs = round1(op.carbs * factor);
  if (op.fat !== undefined) scaled.fat = round1(op.fat * factor);
  return scaled;
}
