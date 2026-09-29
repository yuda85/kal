import type { Constraints, Goal, PacePreset, Range } from './types.ts';

export const KCAL_PER_KG = 7700;
export const PROTEIN_G_PER_KG = 1.8;

const PRESET_WEEKLY_FRACTION = { relaxed: 0.005, aggressive: 0.01 } as const;

export function dailyDeficit(paceKgPerWeek: number): number {
  return (paceKgPerWeek * KCAL_PER_KG) / 7;
}

export interface GoalInput {
  id: string;
  startDate: string;
  startWeightKg: number;
  targetWeightKg: number;
  preset: PacePreset;
  customPaceKgPerWeek?: number;
}

export function makeGoal(input: GoalInput): Goal {
  if (input.targetWeightKg >= input.startWeightKg) {
    throw new Error('target weight must be below start weight');
  }
  const pace =
    input.preset === 'custom'
      ? input.customPaceKgPerWeek
      : input.startWeightKg * PRESET_WEEKLY_FRACTION[input.preset];
  if (pace === undefined || !(pace > 0)) {
    throw new Error('custom pace must be a positive number');
  }
  return {
    id: input.id,
    startDate: input.startDate,
    startWeightKg: input.startWeightKg,
    targetWeightKg: input.targetWeightKg,
    preset: input.preset,
    paceKgPerWeek: pace,
    dailyDeficitKcal: dailyDeficit(pace),
    active: true,
  };
}

/** Share of the day's calories planned as fat; carbs get what protein and fat leave. */
export const FAT_KCAL_SHARE = 0.3;
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

function within(value: number, r: Range | undefined): number {
  return Math.min(Math.max(value, r?.min ?? Number.NEGATIVE_INFINITY), r?.max ?? Number.POSITIVE_INFINITY);
}

/** The day's calorie target: what the day burns minus the goal deficit, kept inside the kcal constraint. */
export function dailyTarget(outKcal: number, deficitKcal: number, c: Constraints): number {
  return within(outKcal - deficitKcal, c.kcal);
}

/** The target of a typical day: default steps and no workout, so the day burns BMR × baseFactor. */
export function typicalTarget(bmrKcal: number, baseFactor: number, deficitKcal: number, c: Constraints): number {
  return dailyTarget(bmrKcal * baseFactor, deficitKcal, c);
}

export interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
}

/** Grams for a day's calorie target: protein by body weight, fat as a share of the calories, carbs the rest. Constraints win. */
export function macroTargets(weightKg: number, targetKcal: number, c: Constraints): MacroTargets {
  const protein = within(PROTEIN_G_PER_KG * weightKg, c.protein);
  const fat = within((FAT_KCAL_SHARE * targetKcal) / KCAL_PER_GRAM.fat, c.fat);
  const rest = targetKcal - protein * KCAL_PER_GRAM.protein - fat * KCAL_PER_GRAM.fat;
  return { protein, carbs: within(Math.max(0, rest / KCAL_PER_GRAM.carbs), c.carbs), fat };
}
