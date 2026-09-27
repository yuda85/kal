import { testGoal } from '../../../../../domain/testing.ts';
import { weightView, WEIGHT_WINDOW_DAYS } from './weight.logic';

describe('weightView', () => {
  const v = weightView({
    today: '2026-09-27',
    goal: testGoal,
    weighIns: [{ date: '2026-09-20', kg: 86 }, { date: '2026-09-27', kg: 85 }],
    energy: [],
    lowDayThresholdKcal: 800,
  });

  it('covers the last 12 weeks', () => {
    expect(v.labels).toHaveLength(WEIGHT_WINDOW_DAYS);
    expect(v.labels.at(-1)).toBe('27.9');
  });

  it('puts weigh-ins and trend points on their dates only', () => {
    expect(v.points.at(-1)).toBe(85);
    expect(v.points.at(-2)).toBeNull();
    expect(v.trend.at(-1)).toBeCloseTo(85.9, 6);
  });

  it('computes status against the plan and a flat target line', () => {
    expect(v.plannedKg).toBeCloseTo(90 - (0.45 * 26) / 7, 6);
    expect(v.status).toBe('ahead');
    expect(new Set(v.target)).toEqual(new Set([80]));
    expect(v.eta).toBeNull();
    expect(v.gap).toBeNull();
  });
});
