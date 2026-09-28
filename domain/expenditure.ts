import type { Day } from './types.ts';

export const WORKOUT_TYPES = ['Upper', 'Lower', 'Push', 'Pull', 'Legs', 'Full body', 'Cardio', 'אחר'] as const;

export interface ExpenditureOptions {
  weightKg: number;
  heightCm: number;
  bmrKcal: number;
  defaultSteps: number;
}

export interface WorkoutBurn {
  type: string;
  kcal: number;
  source: 'manual' | 'garmin';
}

export interface Expenditure {
  bmr: number;
  steps: number;
  stepsSource: 'manual' | 'garmin' | 'default';
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
  const stepsKcal = Math.max(0, steps - workoutSteps) * kcalPerStep(opts.weightKg, opts.heightCm);
  const bmrPerMin = opts.bmrKcal / 1440;
  const workouts: WorkoutBurn[] = [
    // Garmin reports gross workout calories; its resting share is already in BMR.
    ...garmin.map((w) => ({ type: w.type, kcal: Math.max(0, w.kcal - bmrPerMin * (w.durationMin ?? 0)), source: 'garmin' as const })),
    // Manual workouts are the calories burned in the workout, as the owner enters them.
    ...manual.map((w) => ({ type: w.type, kcal: Math.max(0, w.kcal), source: 'manual' as const })),
  ];
  const workoutsKcal = workouts.reduce((sum, w) => sum + w.kcal, 0);
  return { bmr: opts.bmrKcal, steps, stepsSource, stepsKcal, workouts, workoutsKcal, out: opts.bmrKcal + stepsKcal + workoutsKcal };
}
