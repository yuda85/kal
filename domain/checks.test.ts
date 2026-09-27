import { describe, expect, it } from 'vitest';
import { missingDays, reportGap } from './checks.ts';
import { dateRange } from './dates.ts';
import { makeEntry, testGoal } from './testing.ts';

describe('missingDays', () => {
  const entries = [
    makeEntry({ date: '2026-09-20', kcal: 1800 }),
    makeEntry({ date: '2026-09-22', kcal: 400 }),
    makeEntry({ date: '2026-09-23', kcal: 900 }),
    makeEntry({ date: '2026-09-24', kcal: 1800 }),
    makeEntry({ date: '2026-09-25', kcal: 1800 }),
    makeEntry({ date: '2026-09-26', kcal: 1800 }),
  ];

  it('flags past days with no entries or under the threshold', () => {
    expect(missingDays('2026-09-20', '2026-09-26', '2026-09-27', entries, 800)).toEqual(['2026-09-21', '2026-09-22']);
  });

  it('never flags today or future days', () => {
    expect(missingDays('2026-09-27', '2026-10-03', '2026-09-27', [], 800)).toEqual([]);
  });
});

describe('reportGap', () => {
  const goal = { ...testGoal, startDate: '2026-08-01' };
  const energy = dateRange('2026-09-13', '2026-09-26').map((date) => ({ date, inKcal: 1800, outKcal: 2350 }));

  it('reports no gap when weight follows the logs', () => {
    const series = [{ date: '2026-09-12', kg: 85 }, { date: '2026-09-26', kg: 84 }];
    const r = reportGap({ today: '2026-09-27', goal, energy, series, lowDayThresholdKcal: 800 });
    expect(r).toMatchObject({ from: '2026-09-13', to: '2026-09-26', alert: false });
    expect(r!.expectedChangeKg).toBeCloseTo(-1, 10);
    expect(r!.actualChangeKg).toBeCloseTo(-1, 10);
    expect(r!.gapKcalPerDay).toBeCloseTo(0, 6);
  });

  it('alerts when weight drops much less than the logs predict', () => {
    const series = [{ date: '2026-09-12', kg: 85 }, { date: '2026-09-26', kg: 84.6 }];
    const r = reportGap({ today: '2026-09-27', goal, energy, series, lowDayThresholdKcal: 800 });
    expect(r!.gapKcalPerDay).toBeCloseTo(330, 6);
    expect(r!.incompleteDays).toBe(0);
    expect(r!.alert).toBe(true);
  });

  it('does not alert when days in the window were not logged', () => {
    const series = [{ date: '2026-09-12', kg: 85 }, { date: '2026-09-26', kg: 84.6 }];
    const gappy = energy.map((e, i) => (i < 2 ? { ...e, inKcal: 0 } : e));
    const r = reportGap({ today: '2026-09-27', goal, energy: gappy, series, lowDayThresholdKcal: 800 });
    expect(r!.incompleteDays).toBe(2);
    expect(r!.alert).toBe(false);
  });

  it('skips the first two weeks of the goal', () => {
    const early = { ...testGoal, startDate: '2026-09-10' };
    expect(reportGap({ today: '2026-09-27', goal: early, energy, series: [{ date: '2026-09-01', kg: 85 }], lowDayThresholdKcal: 800 })).toBeNull();
  });

  it('returns null without a trend before the window', () => {
    expect(reportGap({ today: '2026-09-27', goal, energy, series: [], lowDayThresholdKcal: 800 })).toBeNull();
    expect(reportGap({ today: '2026-09-27', goal, energy, series: [{ date: '2026-09-20', kg: 85 }], lowDayThresholdKcal: 800 })).toBeNull();
  });

  it('returns null when a day in the window has no energy data', () => {
    const series = [{ date: '2026-09-12', kg: 85 }, { date: '2026-09-26', kg: 84 }];
    expect(reportGap({ today: '2026-09-27', goal, energy: energy.slice(1), series, lowDayThresholdKcal: 800 })).toBeNull();
  });
});
