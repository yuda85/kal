import { describe, expect, it } from 'vitest';
import { currentWeight, meanWeight, weeklyWeights, weightChange } from './weekly.ts';

const weighIns = [
  { date: '2026-09-15', kg: 86 }, // week of 09-13
  { date: '2026-09-17', kg: 85 },
  { date: '2026-09-26', kg: 85.2 }, // week of 09-20 (Saturday)
  { date: '2026-09-27', kg: 85 }, // week of 09-27
  { date: '2026-09-29', kg: 84.5 },
];

describe('meanWeight', () => {
  it('averages the real weigh-ins in the range', () => {
    expect(meanWeight(weighIns, '2026-09-27', '2026-10-03')).toBeCloseTo(84.75, 10);
  });

  it('is null without a weigh-in', () => {
    expect(meanWeight(weighIns, '2026-09-18', '2026-09-25')).toBeNull();
  });
});

describe('weightChange', () => {
  it('compares the range mean up to today with the previous range of the same length', () => {
    expect(weightChange(weighIns, '2026-09-27', '2026-10-03', '2026-09-30')).toBeCloseTo(-0.45, 10);
  });

  it('ignores weigh-ins after today', () => {
    expect(weightChange(weighIns, '2026-09-27', '2026-10-03', '2026-09-27')).toBeCloseTo(-0.2, 10);
  });

  it('is null when either range has no weigh-in', () => {
    expect(weightChange(weighIns, '2026-09-13', '2026-09-19', '2026-09-30')).toBeNull();
    expect(weightChange(weighIns, '2026-10-04', '2026-10-10', '2026-10-05')).toBeNull();
  });
});

describe('weeklyWeights', () => {
  const weeks = weeklyWeights(weighIns, '2026-09-15', '2026-09-30');

  it('lists every week from the start week to this week', () => {
    expect(weeks.map((w) => w.start)).toEqual(['2026-09-13', '2026-09-20', '2026-09-27']);
  });

  it('gives each week its mean, weigh-in count and change from the week before', () => {
    expect(weeks[0]).toEqual({ start: '2026-09-13', meanKg: 85.5, count: 2, changeKg: null });
    expect(weeks[1].meanKg).toBeCloseTo(85.2, 10);
    expect(weeks[1].changeKg).toBeCloseTo(-0.3, 10);
    expect(weeks[2].count).toBe(2);
    expect(weeks[2].changeKg).toBeCloseTo(-0.45, 10);
  });

  it('leaves a week without weigh-ins empty', () => {
    const gap = weeklyWeights([{ date: '2026-09-15', kg: 86 }, { date: '2026-09-29', kg: 85 }], '2026-09-13', '2026-09-30');
    expect(gap[1]).toEqual({ start: '2026-09-20', meanKg: null, count: 0, changeKg: null });
    expect(gap[2].changeKg).toBeNull();
  });
});

describe('currentWeight', () => {
  it('is the mean of the latest week with a real weigh-in', () => {
    const w = [
      { date: '2026-09-15', kg: 88 },
      { date: '2026-09-17', kg: 87 },
      { date: '2026-09-22', kg: 86.5 },
    ];
    // the week of 09-27 (today 09-30) has none, so the week of 09-20 counts
    expect(currentWeight(w, '2026-09-01', '2026-09-30')).toBe(86.5);
    expect(currentWeight([], '2026-09-01', '2026-09-30')).toBeNull();
  });
});
