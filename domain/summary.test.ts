import { describe, expect, it } from 'vitest';
import { summarizeDay, summarizeWeek } from './summary.ts';
import { makeEntry, testGoal, testProfile } from './testing.ts';
import type { Day } from './types.ts';

const date = '2026-09-27';
const day: Day = {
  date,
  garmin: { steps: 15200, workouts: [{ type: 'running', durationMin: 45, kcal: 520, steps: 6000 }] },
};
const weighIns = [{ date, kg: 85 }];
const entries = [
  makeEntry({ date, time: '08:10', kcal: 320, protein: 20, carbs: 40, fat: 8 }),
  makeEntry({ date, time: '13:10', kcal: 450, protein: 36, carbs: 18, fat: 24 }),
  makeEntry({ date, time: '20:00', kcal: 500 }),
  makeEntry({ date: '2026-09-26', kcal: 999 }),
];

describe('summarizeDay', () => {
  const s = summarizeDay({ date, entries, day, profile: testProfile, goal: testGoal, weighIns });

  it('keeps only the day entries, sorted by time', () => {
    expect(s.entries.map((e) => e.time)).toEqual(['08:10', '13:10', '20:00']);
  });

  it('sums intake and tracks kcal without macros', () => {
    expect(s.intake).toEqual({ kcal: 1270, protein: 56, carbs: 58, fat: 32, kcalWithoutMacros: 500 });
  });

  it('computes out, target and remaining', () => {
    expect(s.trendKg).toBe(85);
    expect(s.expenditure.out).toBeCloseTo(2545.316, 2);
    expect(s.targetKcal).toBeCloseTo(2050.316, 2);
    expect(s.remainingKcal).toBeCloseTo(780.316, 2);
  });

  it('caps the protein target at the constraint', () => {
    expect(s.macros.protein).toEqual({ value: 56, target: 120, min: null, max: 120 });
    expect(s.warnings).toEqual([]);
  });

  it('warns when protein goes over its max', () => {
    const more = [...entries, makeEntry({ date, kcal: 800, protein: 80 })];
    const w = summarizeDay({ date, entries: more, day, profile: testProfile, goal: testGoal, weighIns });
    expect(w.warnings).toContainEqual({ code: 'over_max', macro: 'protein', value: 136, limit: 120 });
  });

  it('warns when the target falls below BMR', () => {
    const goal = { ...testGoal, dailyDeficitKcal: 1500 };
    const w = summarizeDay({ date, entries: [], profile: testProfile, goal, weighIns });
    expect(w.warnings).toContainEqual({ code: 'below_bmr', value: 1792.5 * 1.55 - 1500, limit: 1792.5 });
  });

  it('falls back to the goal start weight when there are no weigh-ins', () => {
    const w = summarizeDay({ date, entries: [], day, profile: testProfile, goal: testGoal, weighIns: [] });
    expect(w.trendKg).toBe(90);
    expect(Number.isNaN(w.targetKcal)).toBe(false);
  });
});

describe('summarizeWeek', () => {
  const weekEntries = [
    makeEntry({ date: '2026-09-27', kcal: 1800, protein: 100 }),
    makeEntry({ date: '2026-09-28', kcal: 2000, protein: 110 }),
    makeEntry({ date: '2026-09-30', kcal: 500 }),
  ];
  const weekWeighIns = [
    { date: '2026-09-26', kg: 85.2 },
    { date: '2026-09-27', kg: 85 },
    { date: '2026-09-29', kg: 84.5 },
  ];
  const w = summarizeWeek({
    date: '2026-09-30',
    today: '2026-09-30',
    entries: weekEntries,
    days: [],
    profile: testProfile,
    goal: testGoal,
    weighIns: weekWeighIns,
  });

  it('covers Sunday through today', () => {
    expect(w.start).toBe('2026-09-27');
    expect(w.end).toBe('2026-10-03');
    expect(w.days.map((d) => d.date)).toEqual(['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30']);
  });

  it('averages only completed logged days', () => {
    expect(w.daysLogged).toBe(2);
    expect(w.avgInKcal).toBe(1900);
    expect(w.avgProtein).toBe(105);
    expect(w.avgDeficitKcal).toBeCloseTo(w.avgOutKcal! - w.avgInKcal!, 6);
  });

  it('compares the trend change with the plan', () => {
    expect(w.trendChangeKg).toBeCloseTo(-0.088, 6);
    expect(w.plannedChangeKg).toBe(-0.45);
    expect(w.targetDeficitKcal).toBe(495);
  });

  it('returns null averages when nothing is logged', () => {
    const empty = summarizeWeek({ date: '2026-09-27', today: '2026-09-27', entries: [], days: [], profile: testProfile, goal: testGoal, weighIns: [] });
    expect(empty.avgInKcal).toBeNull();
    expect(empty.trendChangeKg).toBeNull();
  });
});
