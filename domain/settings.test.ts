import { describe, expect, it } from 'vitest';
import { settingsOf } from './settings.ts';

describe('settingsOf', () => {
  it('fills defaults for a legacy profile', () => {
    expect(settingsOf({ settings: { lowDayThresholdKcal: 800 } })).toEqual({ lowDayThresholdKcal: 800, defaultSteps: 3500, missingDayKcal: 3200, baseFactor: 1.2 });
  });

  it('keeps stored values', () => {
    expect(settingsOf({ settings: { lowDayThresholdKcal: 900, defaultSteps: 4000, missingDayKcal: 3000, baseFactor: 1.3 } })).toEqual({ lowDayThresholdKcal: 900, defaultSteps: 4000, missingDayKcal: 3000, baseFactor: 1.3 });
  });

  it('survives a profile without settings', () => {
    expect(settingsOf({} as never).missingDayKcal).toBe(3200);
  });
});
