import { testGoal } from '../../../../../domain/testing.ts';
import { CHART_H, dayChart, weekTitle, weeklyChart, weightView } from './weight.logic';

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
    expect(v.selectedWeek).toBeNull();
    expect(v.chart.points.map((p) => p.label)).toEqual(['13.9', '20.9', 'השבוע']);
    expect(v.chart.points.map((p) => p.key)).toEqual(['2026-09-13', '2026-09-20', '2026-09-27']);
    expect(v.chart.lines).toHaveLength(1);
  });

  it('zooms into a chosen week: its days on the chart and in the list', () => {
    const zoomed = weightView({ ...input, week: '2026-09-20' });
    expect(zoomed.selectedWeek).toBe('2026-09-20');
    expect(zoomed.chart.points.map((p) => p.label)).toEqual(['ש׳']);
    expect(zoomed.chart.mean?.kg).toBeCloseTo(87.2, 10);
    expect(zoomed.days).toHaveLength(7);
    expect(zoomed.days[0]).toEqual({ date: '2026-09-20', kg: null });
    expect(zoomed.days[6]).toEqual({ date: '2026-09-26', kg: 87.2 });
    expect(zoomed.thisWeek.start).toBe('2026-09-27');
  });

  it('marks the 2 kg milestones on the bar and names the next one', () => {
    expect(v.ticks).toEqual([
      { pct: 20, reached: true },
      { pct: 40, reached: false },
      { pct: 60, reached: false },
      { pct: 80, reached: false },
    ]);
    expect(v.milestones.next).toMatchObject({ kg: 4, target: false });
    expect(v.milestones.next!.leftKg).toBeCloseTo(0.6, 10);
  });
});

describe('weekTitle', () => {
  it('names this week and earlier weeks', () => {
    expect(weekTitle('2026-09-27', '2026-09-27')).toBe('השבוע');
    expect(weekTitle('2026-09-20', '2026-09-27')).toBe('שבוע 20.9');
  });
});

describe('dayChart', () => {
  const week = [
    { date: '2026-09-27', kg: 92.4 },
    { date: '2026-09-28', kg: 92.2 },
    { date: '2026-09-30', kg: 91.5 },
  ];
  const c = dayChart(week, '2026-09-27', '2026-09-30');

  it('places each weigh-in on its day from Sunday to Saturday', () => {
    expect(c.points.map((p) => p.label)).toEqual(['א׳', 'ב׳', 'ד׳']);
    expect(c.points[1].x - c.points[0].x).toBeCloseTo(c.slot, 10);
    expect(c.points[2].x - c.points[0].x).toBeCloseTo(3 * c.slot, 10);
  });

  it('labels every day of the week, weighed or not, and marks today', () => {
    expect(c.labels.map((l) => l.text)).toEqual(['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']);
    expect(c.labels.map((l) => l.current)).toEqual([false, false, false, true, false, false, false]);
    expect(c.labels[3].x).toBeCloseTo(c.points[2].x, 10);
  });

  it('writes the weight above each point and marks today', () => {
    expect(c.points.map((p) => p.note)).toEqual(['92.4', '92.2', '91.5']);
    expect(c.points.map((p) => p.current)).toEqual([false, false, true]);
  });

  it('breaks the line over a day without a weigh-in', () => {
    expect(c.lines).toHaveLength(1);
  });

  it('draws the week mean between the lightest and the heaviest day', () => {
    expect(c.mean?.kg).toBeCloseTo(92.0333, 3);
    expect(c.mean!.y).toBeGreaterThan(c.points[0].y);
    expect(c.mean!.y).toBeLessThan(c.points[2].y);
  });

  it('covers a whole past week and ignores other weeks', () => {
    const past = dayChart([...week, { date: '2026-09-26', kg: 93 }], '2026-09-20', '2026-09-30');
    expect(past.points.map((p) => p.label)).toEqual(['ש׳']);
    expect(past.points[0].current).toBe(false);
    expect(past.mean?.kg).toBe(93);
  });
});

describe('weeklyChart', () => {
  const week = (start: string, meanKg: number | null, changeKg: number | null = null) => ({ start, meanKg, count: meanKg === null ? 0 : 1, changeKg });

  it('puts heavier weeks higher and marks the current week', () => {
    const c = weeklyChart([week('2026-09-20', 87), week('2026-09-27', 86, -1)], '2026-09-27');
    expect(c.points[0].y).toBeLessThan(c.points[1].y);
    expect(c.points[0].x).toBeLessThan(c.points[1].x);
    expect(c.points[1]).toMatchObject({ current: true, label: 'השבוע', note: '−1' });
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
    expect(c.labels.map((l) => l.text)).toEqual(['13.9', 'השבוע']);
  });

  it('draws a single week as one point', () => {
    const c = weeklyChart([week('2026-09-27', 86)], '2026-09-27');
    expect(c.points).toHaveLength(1);
    expect(c.lines).toHaveLength(0);
    expect(c.mean).toBeNull();
  });

  it('gives each week a tap area as wide as the gap between weeks', () => {
    const c = weeklyChart([week('2026-09-13', 88), week('2026-09-20', 87), week('2026-09-27', 86)], '2026-09-27');
    expect(c.slot).toBeCloseTo(c.points[1].x - c.points[0].x, 10);
  });

  it('has no points without weigh-ins', () => {
    expect(weeklyChart([week('2026-09-27', null)], '2026-09-27').points).toEqual([]);
  });
});
