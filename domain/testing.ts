import type { Entry, Goal, Ingredient, Profile } from './types.ts';

export const testProfile: Profile = {
  sex: 'male',
  birthDate: '1991-05-10',
  heightCm: 178,
  activityLevel: 'moderate',
  constraints: { protein: { max: 120 } },
  settings: { lowDayThresholdKcal: 800 },
  activeGoalId: 'g1',
};

export const testGoal: Goal = {
  id: 'g1',
  startDate: '2026-09-01',
  startWeightKg: 90,
  targetWeightKg: 80,
  preset: 'relaxed',
  paceKgPerWeek: 0.45,
  dailyDeficitKcal: 495,
  active: true,
};

let seq = 0;

export function makeEntry(p: Partial<Entry> & Pick<Entry, 'date' | 'kcal'>): Entry {
  seq += 1;
  return {
    id: `e${seq}`,
    time: '12:00',
    name: `entry ${seq}`,
    protein: null,
    carbs: null,
    fat: null,
    source: 'link',
    ...p,
  };
}

// Totals: kcal 1253.2, protein 120.6, carbs 72.7, fat 52
export const FISH_BALLS: Ingredient[] = [
  { name: 'fish fillet', grams: 500, per100: { kcal: 90, protein: 19, carbs: 0, fat: 1.5 } },
  { name: 'breadcrumbs', grams: 100, per100: { kcal: 395, protein: 13, carbs: 72, fat: 5 } },
  { name: 'eggs', grams: 100, per100: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 } },
  { name: 'oil', grams: 30, per100: { kcal: 884, protein: 0, carbs: 0, fat: 100 } },
];
