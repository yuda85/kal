import { describe, expect, it } from 'vitest';
import { trendOn, trendSeries, weightOn } from './trend.ts';

describe('trendSeries', () => {
  it('starts at the first weigh-in', () => {
    expect(trendSeries([{ date: '2026-09-01', kg: 90 }])).toEqual([{ date: '2026-09-01', kg: 90 }]);
  });

  it('moves 10% toward each new weigh-in', () => {
    const series = trendSeries([
      { date: '2026-09-01', kg: 90 },
      { date: '2026-09-02', kg: 91 },
    ]);
    expect(series[1].kg).toBeCloseTo(90.1, 10);
  });

  it('sorts by date and carries the previous weight over days without a weigh-in', () => {
    const series = trendSeries([
      { date: '2026-09-04', kg: 89 },
      { date: '2026-09-01', kg: 90 },
    ]);
    expect(series.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']);
    expect(series.map((p) => p.carried ?? false)).toEqual([false, true, true, false]);
    expect(series[3].kg).toBeCloseTo(89.9, 10);
  });

  it('keeps moving toward the last weigh-in until the given date', () => {
    const series = trendSeries(
      [
        { date: '2026-09-01', kg: 90 },
        { date: '2026-09-02', kg: 89 },
      ],
      '2026-09-04',
    );
    // 90 → 89.9 → 89.81 → 89.729, the last two carrying 89
    expect(series.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']);
    expect(series[3].carried).toBe(true);
    expect(series[3].kg).toBeCloseTo(89.729, 10);
  });

  it('returns an empty series for no weigh-ins', () => {
    expect(trendSeries([])).toEqual([]);
  });
});

describe('weightOn', () => {
  const weighIns = [
    { date: '2026-09-01', kg: 90 },
    { date: '2026-09-04', kg: 89 },
  ];

  it('returns the weigh-in of that day', () => {
    expect(weightOn(weighIns, '2026-09-04')).toEqual({ kg: 89, carried: false });
  });

  it('carries the latest earlier weigh-in', () => {
    expect(weightOn(weighIns, '2026-09-03')).toEqual({ kg: 90, carried: true });
    expect(weightOn(weighIns, '2026-09-30')).toEqual({ kg: 89, carried: true });
  });

  it('returns null before the first weigh-in', () => {
    expect(weightOn(weighIns, '2026-08-31')).toBeNull();
  });
});

describe('trendOn', () => {
  const series = [
    { date: '2026-09-01', kg: 90 },
    { date: '2026-09-05', kg: 89.5 },
  ];

  it('returns null before the first point', () => {
    expect(trendOn(series, '2026-08-31')).toBeNull();
  });

  it('returns the last point on or before the date', () => {
    expect(trendOn(series, '2026-09-01')).toBe(90);
    expect(trendOn(series, '2026-09-04')).toBe(90);
    expect(trendOn(series, '2026-09-30')).toBe(89.5);
  });

  it('returns null for an empty series', () => {
    expect(trendOn([], '2026-09-01')).toBeNull();
  });
});
