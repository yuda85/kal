import type { Profile } from './types.ts';

export interface Settings {
  lowDayThresholdKcal: number;
  defaultSteps: number;
  missingDayKcal: number;
}

export function settingsOf(profile: Pick<Profile, 'settings'>): Settings {
  const s: Partial<Settings> = profile.settings ?? {};
  return {
    lowDayThresholdKcal: s.lowDayThresholdKcal ?? 800,
    defaultSteps: s.defaultSteps ?? 3500,
    missingDayKcal: s.missingDayKcal ?? 3200,
  };
}
