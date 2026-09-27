import { describe, expect, it } from 'vitest';
import { trendOn, trendSeries } from './trend.ts';

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

  it('sorts by date and ignores calendar gaps', () => {
    const series = trendSeries([
      { date: '2026-09-10', kg: 89 },
      { date: '2026-09-01', kg: 90 },
    ]);
    expect(series.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-10']);
    expect(series[1].kg).toBeCloseTo(89.9, 10);
  });

  it('returns an empty series for no weigh-ins', () => {
    expect(trendSeries([])).toEqual([]);
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
