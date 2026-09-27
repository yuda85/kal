import { describe, expect, it } from 'vitest';
import { expenditure, kcalPerStep } from './expenditure.ts';
import type { Day } from './types.ts';

const opts = { weightKg: 85, heightCm: 178, bmrKcal: 1792.5, activityLevel: 'moderate' as const };
const run = { type: 'running', durationMin: 45, kcal: 520, steps: 6000 };

describe('kcalPerStep', () => {
  it('uses 0.5 kcal/kg/km with stride 0.415 x height', () => {
    expect(kcalPerStep(85, 178)).toBeCloseTo(0.03139475, 10);
  });
});

describe('expenditure', () => {
  it('falls back to BMR x activity factor when the day has no data', () => {
    const e = expenditure(undefined, opts);
    expect(e.source).toBe('fallback');
    expect(e.out).toBeCloseTo(1792.5 * 1.55, 10);
  });

  it('adds step calories to BMR', () => {
    const day: Day = { date: '2026-09-27', garmin: { steps: 10000, workouts: [] } };
    const e = expenditure(day, opts);
    expect(e.source).toBe('measured');
    expect(e.stepsKcal).toBeCloseTo(313.9475, 4);
    expect(e.out).toBeCloseTo(2106.4475, 4);
  });

  it('removes workout steps and the BMR share of workout time', () => {
    const day: Day = { date: '2026-09-27', garmin: { steps: 15200, workouts: [run] } };
    const e = expenditure(day, opts);
    expect(e.steps).toBe(15200);
    expect(e.stepsKcal).toBeCloseTo(288.8317, 4);
    expect(e.workoutsKcal).toBeCloseTo(463.984375, 6);
    expect(e.out).toBeCloseTo(2545.316075, 4);
  });

  it('lets manual steps replace Garmin steps and never goes negative', () => {
    const day: Day = { date: '2026-09-27', garmin: { steps: 15200, workouts: [run] }, manual: { steps: 5000 } };
    const e = expenditure(day, opts);
    expect(e.steps).toBe(5000);
    expect(e.stepsKcal).toBe(0);
  });

  it('adds manual workouts to Garmin workouts', () => {
    const football = { type: 'football', durationMin: 60, kcal: 550 };
    const day: Day = { date: '2026-09-27', garmin: { steps: 0, workouts: [run] }, manual: { workouts: [football] } };
    const e = expenditure(day, opts);
    expect(e.workouts).toEqual([run, football]);
    expect(e.workoutsKcal).toBeCloseTo(463.984375 + (550 - (1792.5 / 1440) * 60), 6);
  });

  it('counts a workout below its BMR share as zero', () => {
    const day: Day = { date: '2026-09-27', manual: { workouts: [{ type: 'yoga', durationMin: 30, kcal: 10 }] } };
    expect(expenditure(day, opts).workoutsKcal).toBe(0);
  });

  it('treats a day with only manual steps as measured', () => {
    const day: Day = { date: '2026-09-27', manual: { steps: 8000 } };
    expect(expenditure(day, opts).source).toBe('measured');
  });
});
