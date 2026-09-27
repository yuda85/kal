import type { ActivityLevel, Day, Workout } from './types.ts';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

export interface ExpenditureOptions {
  weightKg: number;
  heightCm: number;
  bmrKcal: number;
  activityLevel: ActivityLevel;
}

export interface Expenditure {
  bmr: number;
  steps: number;
  stepsKcal: number;
  workouts: Workout[];
  workoutsKcal: number;
  out: number;
  source: 'measured' | 'fallback';
}

export function kcalPerStep(weightKg: number, heightCm: number): number {
  const strideKm = (0.415 * heightCm) / 100 / 1000;
  return 0.5 * weightKg * strideKm;
}

function hasData(day: Day | undefined): day is Day {
  if (!day) return false;
  return day.garmin !== undefined || day.manual?.steps !== undefined || (day.manual?.workouts?.length ?? 0) > 0;
}

export function expenditure(day: Day | undefined, opts: ExpenditureOptions): Expenditure {
  if (!hasData(day)) {
    return {
      bmr: opts.bmrKcal,
      steps: 0,
      stepsKcal: 0,
      workouts: [],
      workoutsKcal: 0,
      out: opts.bmrKcal * ACTIVITY_FACTORS[opts.activityLevel],
      source: 'fallback',
    };
  }
  const steps = day.manual?.steps ?? day.garmin?.steps ?? 0;
  const workouts = [...(day.garmin?.workouts ?? []), ...(day.manual?.workouts ?? [])];
  const workoutSteps = workouts.reduce((sum, w) => sum + (w.steps ?? 0), 0);
  const stepsKcal = Math.max(0, steps - workoutSteps) * kcalPerStep(opts.weightKg, opts.heightCm);
  const bmrPerMin = opts.bmrKcal / 1440;
  const workoutsKcal = workouts.reduce((sum, w) => sum + Math.max(0, w.kcal - bmrPerMin * w.durationMin), 0);
  return {
    bmr: opts.bmrKcal,
    steps,
    stepsKcal,
    workouts,
    workoutsKcal,
    out: opts.bmrKcal + stepsKcal + workoutsKcal,
    source: 'measured',
  };
}
