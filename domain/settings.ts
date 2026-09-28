import type { Profile } from './types.ts';

/** BMR × 1.2: the usual estimate for a desk day (digestion and daily movement). */
export const DEFAULT_BASE_FACTOR = 1.2;

export interface Settings {
  lowDayThresholdKcal: number;
  defaultSteps: number;
  missingDayKcal: number;
  /** A day's burn without walking or training, as a multiple of BMR (digestion and daily movement). */
  baseFactor: number;
}

export function settingsOf(profile: Pick<Profile, 'settings'>): Settings {
  const s: Partial<Settings> = profile.settings ?? {};
  return {
    lowDayThresholdKcal: s.lowDayThresholdKcal ?? 800,
    defaultSteps: s.defaultSteps ?? 3500,
    missingDayKcal: s.missingDayKcal ?? 3200,
    baseFactor: s.baseFactor ?? DEFAULT_BASE_FACTOR,
  };
}
