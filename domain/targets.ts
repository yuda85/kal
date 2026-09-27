import type { Constraints, Goal, PacePreset } from './types.ts';

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

export interface MacroTargets {
  protein: number;
  carbs: number | null;
  fat: number | null;
}

export function macroTargets(weightKg: number, c: Constraints): MacroTargets {
  const byWeight = PROTEIN_G_PER_KG * weightKg;
  return {
    protein: Math.min(byWeight, c.protein?.max ?? Number.POSITIVE_INFINITY),
    carbs: null,
    fat: null,
  };
}
