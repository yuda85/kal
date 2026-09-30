/** The owner's daily steps goal. Separate from `defaultSteps` (3,500), the base a day burns without entered steps. */
export const STEPS_GOAL = 10000;
export const STEPS_LOW = 4500;
export const STEPS_GREAT = 13000;

export type StepsTier = 'low' | 'mid' | 'goal' | 'great';

/** Grades a day's steps against the steps goal only; it says nothing about weight progress. */
export function stepsTier(steps: number): StepsTier {
  if (steps < STEPS_LOW) return 'low';
  if (steps < STEPS_GOAL) return 'mid';
  return steps > STEPS_GREAT ? 'great' : 'goal';
}
