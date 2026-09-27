import type { Day, Entry, Goal, Ingredient, Profile, Recipe, RecipeYield, WeighIn } from '../../../../../domain/index.ts';
import type { Doc, FirestoreReader } from './firestore.ts';

export interface KalData {
  profile: Profile;
  goal: Goal;
  weighIns: WeighIn[];
  days: Day[];
  entries: Entry[];
  recipes: Recipe[];
}

export function toRecipe(doc: Doc): Recipe {
  const d = doc.data;
  return {
    id: doc.id,
    name: String(d.name ?? doc.id),
    aliases: Array.isArray(d.aliases) ? d.aliases.map(String) : [],
    ingredients: (d.ingredients ?? []) as Ingredient[],
    yield: (d.yield ?? {}) as RecipeYield,
  };
}

export async function loadRecipes(reader: FirestoreReader): Promise<Recipe[]> {
  return (await reader.list('recipes')).map(toRecipe);
}

export async function loadData(reader: FirestoreReader, from: string, to: string): Promise<KalData> {
  const [user, goals, weights, days, entries, recipes] = await Promise.all([
    reader.user(),
    reader.list('goals'),
    reader.list('weights'),
    reader.list('days'),
    reader.entriesBetween(from, to),
    loadRecipes(reader),
  ]);
  if (!user) throw new Error('no profile found — finish the setup wizard in the app first');
  const profile = user as unknown as Profile;
  const goalDoc = goals.find((g) => g.id === profile.activeGoalId) ?? goals.find((g) => g.data.active === true);
  if (!goalDoc) throw new Error('no active goal found — set a goal in the app');
  return {
    profile,
    goal: { id: goalDoc.id, ...goalDoc.data } as unknown as Goal,
    weighIns: weights.map((w) => ({ date: w.id, ...w.data }) as unknown as WeighIn),
    days: days.map((d) => ({ date: d.id, ...d.data }) as unknown as Day),
    entries: entries.map((e) => ({ id: e.id, ...e.data }) as unknown as Entry),
    recipes,
  };
}
