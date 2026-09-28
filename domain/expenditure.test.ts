import { describe, expect, it } from 'vitest';
import { expenditure, kcalPerStep } from './expenditure.ts';
import type { Day } from './types.ts';

const opts = { weightKg: 85, heightCm: 178, bmrKcal: 1792.5, defaultSteps: 3500 };
const run = { type: 'running', durationMin: 45, kcal: 520, steps: 6000 };

describe('kcalPerStep', () => {
  it('uses 0.5 kcal/kg/km with stride 0.415 x height', () => {
    expect(kcalPerStep(85, 178)).toBeCloseTo(0.03139475, 10);
  });
});

describe('expenditure', () => {
  it('uses the default steps when none were entered', () => {
    const e = expenditure(undefined, opts);
    expect(e.stepsSource).toBe('default');
    expect(e.steps).toBe(3500);
    expect(e.out).toBeCloseTo(1792.5 + 3500 * kcalPerStep(85, 178), 8);
  });

  it('adds Garmin step calories to BMR', () => {
    const e = expenditure({ date: '2026-09-27', garmin: { steps: 10000, workouts: [] } }, opts);
    expect(e.stepsSource).toBe('garmin');
    expect(e.stepsKcal).toBeCloseTo(313.9475, 4);
  });

  it('removes workout steps and the BMR share of Garmin workouts', () => {
    const e = expenditure({ date: '2026-09-27', garmin: { steps: 15200, workouts: [run] } }, opts);
    expect(e.stepsKcal).toBeCloseTo(288.8317, 4);
    expect(e.workouts).toEqual([{ type: 'running', kcal: expect.closeTo(463.984375, 6), source: 'garmin' }]);
    expect(e.out).toBeCloseTo(2545.316075, 4);
  });

  it('lets manual steps replace Garmin steps and never goes negative', () => {
    const e = expenditure({ date: '2026-09-27', garmin: { steps: 15200, workouts: [run] }, manual: { steps: 5000 } }, opts);
    expect(e.stepsSource).toBe('manual');
    expect(e.stepsKcal).toBe(0);
  });

  it('counts manual workout calories as entered, without a duration', () => {
    const day: Day = { date: '2026-09-27', manual: { steps: 8000, workouts: [{ type: 'Push', kcal: 350 }] } };
    const e = expenditure(day, opts);
    expect(e.workouts).toEqual([{ type: 'Push', kcal: 350, source: 'manual' }]);
    expect(e.workoutsKcal).toBe(350);
  });
});
