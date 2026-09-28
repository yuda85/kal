import type { Day, Workout } from './types.ts';

export const WORKOUT_TYPES = ['Upper', 'Lower', 'Push', 'Pull', 'Legs', 'Full body', 'Cardio', 'אחר'] as const;

export interface ExpenditureOptions {
  weightKg: number;
  heightCm: number;
  bmrKcal: number;
  defaultSteps: number;
  baseFactor: number;
}

export interface WorkoutBurn {
  type: string;
  kcal: number;
  source: 'manual' | 'garmin';
}

export interface Expenditure {
  bmr: number;
  /** Digestion and daily movement: BMR × (baseFactor − 1). The base day already includes the default steps. */
  dailyLifeKcal: number;
  steps: number;
  stepsSource: 'manual' | 'garmin' | 'default';
  /** Steps above the default (negative when fewer). */
  stepsKcal: number;
  workouts: WorkoutBurn[];
  workoutsKcal: number;
  out: number;
}

export function kcalPerStep(weightKg: number, heightCm: number): number {
  const strideKm = (0.415 * heightCm) / 100 / 1000;
  return 0.5 * weightKg * strideKm;
}

export function expenditure(day: Day | undefined, opts: ExpenditureOptions): Expenditure {
  const manualSteps = day?.manual?.steps;
  const garminSteps = day?.garmin?.steps;
  const steps = manualSteps ?? garminSteps ?? opts.defaultSteps;
  const stepsSource = manualSteps !== undefined ? 'manual' : garminSteps !== undefined ? 'garmin' : 'default';
  const garmin = day?.garmin?.workouts ?? [];
  const manual = day?.manual?.workouts ?? [];
  const workoutSteps = [...garmin, ...manual].reduce((sum, w) => sum + (w.steps ?? 0), 0);
  const stepsKcal = (Math.max(0, steps - workoutSteps) - opts.defaultSteps) * kcalPerStep(opts.weightKg, opts.heightCm);
  const dailyLifeKcal = opts.bmrKcal * (opts.baseFactor - 1);
  const bmrPerMin = opts.bmrKcal / 1440;
  // A workout's total calories include its resting share, which BMR already counts; without a duration the kcal are taken as active.
  const burn = (w: Workout, source: WorkoutBurn['source']): WorkoutBurn => ({
    type: w.type,
    kcal: Math.max(0, w.kcal - bmrPerMin * (w.durationMin ?? 0)),
    source,
  });
  const workouts = [...garmin.map((w) => burn(w, 'garmin')), ...manual.map((w) => burn(w, 'manual'))];
  const workoutsKcal = workouts.reduce((sum, w) => sum + w.kcal, 0);
  return {
    bmr: opts.bmrKcal,
    dailyLifeKcal,
    steps,
    stepsSource,
    stepsKcal,
    workouts,
    workoutsKcal,
    out: opts.bmrKcal + dailyLifeKcal + stepsKcal + workoutsKcal,
  };
}
