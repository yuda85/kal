import { describe, expect, it } from 'vitest';
import { monthEnd, summarizeDay, summarizeMonth, summarizeWeek } from './summary.ts';
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
  it('counts a finished day with too little food as the missing-day penalty', () => {
    const coffee = [makeEntry({ date: '2026-09-26', kcal: 2 })];
    const past = summarizeDay({ date: '2026-09-26', today: '2026-09-27', entries: coffee, profile: testProfile, goal: testGoal, weighIns });
    expect(past.imputed).toBe(true);
    expect(past.countedKcal).toBe(3200);
    expect(past.intake.kcal).toBe(2);
  });

  it('never penalizes today or days before the goal', () => {
    expect(summarizeDay({ date, today: date, entries: [], profile: testProfile, goal: testGoal, weighIns }).imputed).toBe(false);
    expect(summarizeDay({ date: '2026-08-20', today: date, entries: [], profile: testProfile, goal: testGoal, weighIns }).imputed).toBe(false);
  });

  it('keeps real intake once enough food is logged', () => {
    const s = summarizeDay({ date: '2026-09-26', today: date, entries: [makeEntry({ date: '2026-09-26', kcal: 1900 })], profile: testProfile, goal: testGoal, weighIns });
    expect(s.imputed).toBe(false);
    expect(s.countedKcal).toBe(1900);
  });

  const s = summarizeDay({ date, entries, day, profile: testProfile, goal: testGoal, weighIns });

  it('keeps only the day entries, sorted by time', () => {
    expect(s.entries.map((e) => e.time)).toEqual(['08:10', '13:10', '20:00']);
  });

  it('sums intake and tracks kcal without macros', () => {
    expect(s.intake).toEqual({ kcal: 1270, protein: 56, carbs: 58, fat: 32, kcalWithoutMacros: 500 });
  });

  it('computes out, target and remaining', () => {
    expect(s.trendKg).toBe(85);
    // 1792.5 × 1.2 + (9200 − 3500) steps × 0.03139475 + run 463.984
    expect(s.expenditure.out).toBeCloseTo(2793.934, 2);
    expect(s.targetKcal).toBeCloseTo(2298.934, 2);
    expect(s.remainingKcal).toBeCloseTo(1028.934, 2);
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

  it('warns when a typical day target falls far below BMR', () => {
    const goal = { ...testGoal, dailyDeficitKcal: 1500 };
    const w = summarizeDay({ date, entries: [], profile: testProfile, goal, weighIns });
    const warning = w.warnings.find((x) => x.code === 'below_bmr')!;
    expect(warning.limit).toBe(1792.5);
    expect(warning.value).toBeCloseTo(1792.5 * 1.2 - 1500, 6);
  });

  it('does not warn below BMR on an active day when the goal itself is moderate', () => {
    const light: Day = { date, garmin: { steps: 5000, workouts: [] } };
    const w = summarizeDay({ date, entries: [], day: light, profile: testProfile, goal: testGoal, weighIns });
    expect(w.warnings.filter((x) => x.code === 'below_bmr')).toEqual([]);
  });

  it('keeps the calorie target inside the kcal constraint', () => {
    const withMin = { ...testProfile, constraints: { ...testProfile.constraints, kcal: { min: 2400 } } };
    expect(summarizeDay({ date, entries, day, profile: withMin, goal: testGoal, weighIns }).targetKcal).toBe(2400);
    const withMax = { ...testProfile, constraints: { ...testProfile.constraints, kcal: { max: 1800 } } };
    const capped = summarizeDay({ date, entries, day, profile: withMax, goal: testGoal, weighIns });
    expect(capped.targetKcal).toBe(1800);
    expect(capped.remainingKcal).toBe(1800 - 1270);
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

  it('averages every finished day, counting days without food as 3,200', () => {
    expect(w.daysLogged).toBe(2);
    expect(w.imputedDays).toBe(1);
    expect(w.avgInKcal).toBeCloseTo((1800 + 2000 + 3200) / 3, 6);
    expect(w.avgProtein).toBe(105);
    expect(w.avgDeficitKcal).toBeCloseTo(w.avgOutKcal! - w.avgInKcal!, 6);
  });

  it('compares the trend change with the plan prorated to the elapsed days', () => {
    expect(w.trendChangeKg).toBeCloseTo(-0.088, 6);
    // Saturday 09-26 → Wednesday 09-30 is 4 days of plan
    expect(w.plannedChangeKg).toBeCloseTo((-0.45 * 4) / 7, 10);
    expect(w.targetDeficitKcal).toBe(495);
  });

  it('uses the full weekly plan for a finished week', () => {
    const past = summarizeWeek({ date: '2026-09-20', today: '2026-09-30', entries: [], days: [], profile: testProfile, goal: testGoal, weighIns: weekWeighIns });
    expect(past.plannedChangeKg).toBeCloseTo(-0.45, 10);
  });

  it('counts an under-logged finished day as the penalty', () => {
    const partial = summarizeWeek({
      date: '2026-09-30',
      today: '2026-09-30',
      entries: [...weekEntries, makeEntry({ date: '2026-09-29', kcal: 300 })],
      days: [],
      profile: testProfile,
      goal: testGoal,
      weighIns: weekWeighIns,
    });
    expect(partial.daysLogged).toBe(2);
    expect(partial.avgInKcal).toBeCloseTo((1800 + 2000 + 3200) / 3, 6);
  });

  it('reports no trend change for a week without weigh-ins', () => {
    const noWeights = summarizeWeek({
      date: '2026-09-30',
      today: '2026-09-30',
      entries: weekEntries,
      days: [],
      profile: testProfile,
      goal: testGoal,
      weighIns: [{ date: '2026-09-20', kg: 86 }, { date: '2026-09-25', kg: 85.5 }],
    });
    expect(noWeights.trendChangeKg).toBeNull();
  });

  it('returns null averages when nothing is logged', () => {
    const empty = summarizeWeek({ date: '2026-09-27', today: '2026-09-27', entries: [], days: [], profile: testProfile, goal: testGoal, weighIns: [] });
    expect(empty.avgInKcal).toBeNull();
    expect(empty.trendChangeKg).toBeNull();
  });

  it('counts workouts and the weight-implied deficit', () => {
    const days = [
      { date: '2026-09-27', manual: { workouts: [{ type: 'Push', kcal: 350 }] } },
      { date: '2026-09-29', manual: { workouts: [{ type: 'Legs', kcal: 400 }] } },
    ];
    const ww = summarizeWeek({ date: '2026-09-30', today: '2026-09-30', entries: weekEntries, days, profile: testProfile, goal: testGoal, weighIns: weekWeighIns });
    expect(ww.workoutsCount).toBe(2);
    // trend −0.088 kg over the 4 days from 09-26 to 09-30
    expect(ww.weightDeficitKcal).toBeCloseTo((0.088 * 7700) / 4, 1);
  });

  it('measures the weight trend from the first weigh-in when none came before the week', () => {
    const inside = [{ date: '2026-09-27', kg: 85 }, { date: '2026-09-29', kg: 84.5 }];
    const ww = summarizeWeek({ date: '2026-09-30', today: '2026-09-30', entries: weekEntries, days: [], profile: testProfile, goal: testGoal, weighIns: inside });
    // EWMA 85 → 84.95: −0.05 kg from 09-27 to 09-30 (3 days)
    expect(ww.trendChangeKg).toBeCloseTo(-0.05, 6);
    expect(ww.weightDeficitKcal).toBeCloseTo((0.05 * 7700) / 3, 4);
  });

  it('reports no trend change from a single weigh-in', () => {
    const one = summarizeWeek({ date: '2026-09-30', today: '2026-09-30', entries: weekEntries, days: [], profile: testProfile, goal: testGoal, weighIns: [{ date: '2026-09-29', kg: 85 }] });
    expect(one.trendChangeKg).toBeNull();
    expect(one.weightDeficitKcal).toBeNull();
  });
});

describe('summarizeMonth', () => {
  const entries = [makeEntry({ date: '2026-09-02', kcal: 2000 }), makeEntry({ date: '2026-09-03', kcal: 2100 })];
  const days = [
    { date: '2026-09-02', manual: { workouts: [{ type: 'Push', kcal: 300 }] } },
    { date: '2026-09-09', manual: { workouts: [{ type: 'Pull', kcal: 300 }] } },
  ];
  const m = summarizeMonth({ month: '2026-09', today: '2026-09-15', entries, days, profile: testProfile, goal: testGoal, weighIns: [] });

  it('covers the month up to today', () => {
    expect(m.start).toBe('2026-09-01');
    expect(m.end).toBe('2026-09-30');
    expect(m.days).toHaveLength(15);
  });

  it('counts workouts, per-week rate and penalized days', () => {
    expect(m.workoutsCount).toBe(2);
    expect(m.workoutsPerWeek).toBeCloseTo((2 * 7) / 15, 6);
    // goal starts 09-01: 1..14 finished, 2 logged, 12 penalized
    expect(m.daysLogged).toBe(2);
    expect(m.imputedDays).toBe(12);
  });

  it('knows month lengths', () => {
    expect(monthEnd('2026-02')).toBe('2026-02-28');
    expect(monthEnd('2028-02')).toBe('2028-02-29');
  });
});
