import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { eta, planStatus, plannedWeight } from './plan.ts';
import { testGoal } from './testing.ts';

describe('plannedWeight', () => {
  it('starts at the start weight and drops by pace per week', () => {
    expect(plannedWeight(testGoal, '2026-09-01')).toBe(90);
    expect(plannedWeight(testGoal, '2026-09-15')).toBeCloseTo(89.1, 10);
  });

  it('stays at the target after the planned end and at the start before the goal began', () => {
    expect(plannedWeight(testGoal, '2028-01-01')).toBe(80);
    expect(plannedWeight(testGoal, '2026-08-01')).toBe(90);
  });
});

describe('planStatus', () => {
  it('is on track within 0.5 kg', () => {
    expect(planStatus(89.3, 89.1)).toBe('on_track');
    expect(planStatus(88.7, 89.1)).toBe('on_track');
  });

  it('is ahead below the plan and behind above it', () => {
    expect(planStatus(88.5, 89.1)).toBe('ahead');
    expect(planStatus(89.7, 89.1)).toBe('behind');
  });
});

describe('eta', () => {
  const series = Array.from({ length: 20 }, (_, i) => ({ date: addDays('2026-09-08', i), kg: 85 - 0.05 * i }));

  it('projects the date the trend reaches the target', () => {
    expect(eta(series, testGoal, '2026-09-27')).toBe('2026-12-17');
  });

  it('returns null with fewer than 14 points in the window', () => {
    expect(eta(series.slice(0, 10), testGoal, '2026-09-27')).toBeNull();
    expect(eta([], testGoal, '2026-09-27')).toBeNull();
  });

  it('returns null when the trend is not going down', () => {
    const flat = series.map((p) => ({ ...p, kg: 85 }));
    expect(eta(flat, testGoal, '2026-09-27')).toBeNull();
  });

  it('returns the last date when the target is already reached', () => {
    expect(eta(series, { ...testGoal, targetWeightKg: 86 }, '2026-09-27')).toBe('2026-09-27');
  });
});
