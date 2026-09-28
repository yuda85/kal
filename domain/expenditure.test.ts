import { describe, expect, it } from 'vitest';
import { expenditure, kcalPerStep } from './expenditure.ts';
import type { Day } from './types.ts';

const opts = { weightKg: 85, heightCm: 178, bmrKcal: 1792.5, defaultSteps: 3500, baseFactor: 1.2 };
const k = 0.03139475; // kcalPerStep(85, 178)
const run = { type: 'running', durationMin: 45, kcal: 520, steps: 6000 };

describe('kcalPerStep', () => {
  it('uses 0.5 kcal/kg/km with stride 0.415 x height', () => {
    expect(kcalPerStep(85, 178)).toBeCloseTo(k, 10);
  });
});

describe('expenditure', () => {
  it('burns BMR x 1.2 on a day with the default steps and no workout', () => {
    const e = expenditure(undefined, opts);
    expect(e.stepsSource).toBe('default');
    expect(e.steps).toBe(3500);
    expect(e.dailyLifeKcal).toBeCloseTo(358.5, 10);
    expect(e.stepsKcal).toBe(0);
    expect(e.out).toBeCloseTo(2151, 10);
  });

  it('adds only the steps above the default', () => {
    const e = expenditure({ date: '2026-09-27', garmin: { steps: 10000, workouts: [] } }, opts);
    expect(e.stepsSource).toBe('garmin');
    expect(e.stepsKcal).toBeCloseTo(6500 * k, 8);
  });

  it('counts fewer steps than the default as less movement', () => {
    const e = expenditure({ date: '2026-09-27', manual: { steps: 2000 } }, opts);
    expect(e.stepsSource).toBe('manual');
    expect(e.stepsKcal).toBeCloseTo(-1500 * k, 8);
  });

  it('removes workout steps and the resting share of a workout with a duration', () => {
    const e = expenditure({ date: '2026-09-27', garmin: { steps: 15200, workouts: [run] } }, opts);
    expect(e.stepsKcal).toBeCloseTo(5700 * k, 8);
    expect(e.workouts).toEqual([{ type: 'running', kcal: expect.closeTo(463.984375, 6), source: 'garmin' }]);
    expect(e.out).toBeCloseTo(2151 + 5700 * k + 463.984375, 6);
  });

  it('treats a manual workout the same way: resting share out when the duration is known, as entered otherwise', () => {
    const day: Day = { date: '2026-09-27', manual: { workouts: [{ type: 'Push', kcal: 350, durationMin: 60 }, { type: 'Legs', kcal: 300 }] } };
    const e = expenditure(day, opts);
    expect(e.workouts).toEqual([
      { type: 'Push', kcal: expect.closeTo(350 - 74.6875, 6), source: 'manual' },
      { type: 'Legs', kcal: 300, source: 'manual' },
    ]);
  });

  it('uses the stored base factor', () => {
    expect(expenditure(undefined, { ...opts, baseFactor: 1.3 }).out).toBeCloseTo(1792.5 * 1.3, 8);
  });
});
