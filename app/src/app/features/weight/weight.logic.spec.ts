import { testGoal } from '../../../../../domain/testing.ts';
import { CHART_H, weeklyChart, weightView } from './weight.logic';

// testGoal: starts 2026-09-01 at 90 kg, target 80.
const weighIns = [
  { date: '2026-09-15', kg: 88 },
  { date: '2026-09-17', kg: 87 },
  { date: '2026-09-26', kg: 87.2 },
  { date: '2026-09-27', kg: 86.8 },
  { date: '2026-09-29', kg: 86.4 },
];
const input = { today: '2026-09-30', goal: testGoal, weighIns, energy: [], lowDayThresholdKcal: 800 };

describe('weightView', () => {
  const v = weightView(input);

  it('leads with this week against last week', () => {
    expect(v.thisWeek.start).toBe('2026-09-27');
    expect(v.thisWeek.meanKg).toBeCloseTo(86.6, 10);
    expect(v.thisWeek.changeKg).toBeCloseTo(-0.6, 10);
    expect(v.lastWeek?.meanKg).toBeCloseTo(87.2, 10);
  });

  it('measures progress from the start weight with the latest week mean', () => {
    expect(v.currentKg).toBeCloseTo(86.6, 10);
    expect(v.lostKg).toBeCloseTo(3.4, 10);
    expect(v.leftKg).toBeCloseTo(6.6, 10);
    expect(v.progress).toBeCloseTo(0.34, 10);
  });

  it('lists this week from Sunday to today', () => {
    expect(v.days).toEqual([
      { date: '2026-09-27', kg: 86.8 },
      { date: '2026-09-28', kg: null },
      { date: '2026-09-29', kg: 86.4 },
      { date: '2026-09-30', kg: null },
    ]);
  });

  it('falls back to the last weighed week when this week has none', () => {
    const early = weightView({ ...input, weighIns: weighIns.slice(0, 3) });
    expect(early.thisWeek.meanKg).toBeNull();
    expect(early.currentKg).toBeCloseTo(87.2, 10);
  });

  it('shows a gain as an empty bar', () => {
    const up = weightView({ ...input, weighIns: [{ date: '2026-09-29', kg: 91 }] });
    expect(up.lostKg).toBeCloseTo(-1, 10);
    expect(up.progress).toBe(0);
    expect(up.leftKg).toBeCloseTo(11, 10);
  });

  it('charts the weeks since the goal started', () => {
    // 09-01 is a Tuesday: weeks of 08-30 and 09-06 have no weigh-ins
    expect(v.chart.points.map((p) => p.label)).toEqual(['13.9', '20.9', 'השבוע']);
    expect(v.chart.lines).toHaveLength(1);
  });
});

describe('weeklyChart', () => {
  const week = (start: string, meanKg: number | null, changeKg: number | null = null) => ({ start, meanKg, count: meanKg === null ? 0 : 1, changeKg });

  it('puts heavier weeks higher and marks the current week', () => {
    const c = weeklyChart([week('2026-09-20', 87), week('2026-09-27', 86, -1)], '2026-09-27');
    expect(c.points[0].y).toBeLessThan(c.points[1].y);
    expect(c.points[0].x).toBeLessThan(c.points[1].x);
    expect(c.points[1]).toMatchObject({ current: true, label: 'השבוע', changeKg: -1 });
    expect(c.ticks).toHaveLength(3);
    for (const p of c.points) {
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(CHART_H);
    }
  });

  it('breaks the line over a week without weigh-ins', () => {
    const c = weeklyChart([week('2026-09-13', 88), week('2026-09-20', null), week('2026-09-27', 86)], '2026-09-27');
    expect(c.points).toHaveLength(2);
    expect(c.lines).toHaveLength(0);
  });

  it('draws a single week as one point', () => {
    const c = weeklyChart([week('2026-09-27', 86)], '2026-09-27');
    expect(c.points).toHaveLength(1);
    expect(c.lines).toHaveLength(0);
  });

  it('has no points without weigh-ins', () => {
    expect(weeklyChart([week('2026-09-27', null)], '2026-09-27').points).toEqual([]);
  });
});
