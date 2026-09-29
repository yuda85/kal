import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { realityCheck } from './reality.ts';
import { testGoal } from './testing.ts';

const today = '2026-09-27';
const series = (days: number, start: number, perDay: number) =>
  Array.from({ length: days }, (_, i) => ({ date: addDays(today, i - days + 1), kg: start + perDay * i }));

describe('realityCheck', () => {
  it('says no_data with fewer than 4 weigh-ins in 14 days', () => {
    const r = realityCheck({ today, goal: testGoal, weighIns: [{ date: '2026-09-20', kg: 86 }, { date: today, kg: 85 }], energy: [] });
    expect(r.status).toBe('no_data');
    expect(r.weighInCount).toBe(2);
  });

  it('does not count carried days as weigh-ins', () => {
    // A month of steady loss that ended three weeks ago: the carried days keep the trend going but prove nothing.
    const old = series(30, 90, -0.07).map((w) => ({ ...w, date: addDays(w.date, -21) }));
    const r = realityCheck({ today, goal: testGoal, weighIns: old, energy: [] });
    expect(r.weighInCount).toBe(0);
    expect(r.status).toBe('no_data');
  });

  it('says gaining when the trend rose', () => {
    expect(realityCheck({ today, goal: testGoal, weighIns: series(30, 88, 0.05), energy: [] }).status).toBe('gaining');
  });

  it('says stalled when the trend fell less than half the plan', () => {
    const r = realityCheck({ today, goal: testGoal, weighIns: series(30, 88, 0), energy: [] });
    expect(r.status).toBe('stalled');
    expect(r.plannedChangeKg).toBeCloseTo(-0.9, 6);
  });

  it('says on_track when the trend follows the plan', () => {
    expect(realityCheck({ today, goal: testGoal, weighIns: series(40, 90, -0.07), energy: [] }).status).toBe('on_track');
  });

  it('puts the logged deficit next to the weight deficit', () => {
    const energy = Array.from({ length: 13 }, (_, i) => ({ date: addDays(today, i - 13), inKcal: 1800, outKcal: 2350 }));
    const r = realityCheck({ today, goal: testGoal, weighIns: series(30, 88, 0), energy });
    expect(r.loggedDeficitKcal).toBeCloseTo(550, 6);
    expect(r.weightDeficitKcal).toBeCloseTo(0, 6);
  });

  it('ignores days before the goal start in the logged deficit', () => {
    const goal = { ...testGoal, startDate: addDays(today, -5) };
    const energy = Array.from({ length: 13 }, (_, i) => {
      const date = addDays(today, i - 13);
      return { date, inKcal: date < goal.startDate ? 0 : 1800, outKcal: 2350 };
    });
    expect(realityCheck({ today, goal, weighIns: series(30, 88, 0), energy }).loggedDeficitKcal).toBeCloseTo(550, 6);
  });

  it('expects the goal pace from the first day and while above target', () => {
    const fresh = realityCheck({ today, goal: { ...testGoal, startDate: today }, weighIns: series(30, 88, 0), energy: [] });
    expect(fresh.plannedChangeKg).toBeCloseTo(-0.9, 6);
    expect(fresh.status).toBe('stalled');
    const atTarget = realityCheck({ today, goal: { ...testGoal, targetWeightKg: 90 }, weighIns: series(30, 88, 0), energy: [] });
    expect(atTarget.plannedChangeKg).toBe(0);
    expect(atTarget.status).toBe('on_track');
  });

  it('waits for a trend point before the window, even with enough weigh-ins', () => {
    const r = realityCheck({ today, goal: testGoal, weighIns: series(5, 88, 0.2), energy: [] });
    expect(r.weighInCount).toBe(5);
    expect(r.status).toBe('no_data');
  });

  it('turns a falling trend into a positive weight deficit', () => {
    const r = realityCheck({ today, goal: testGoal, weighIns: series(30, 90, -0.05), energy: [] });
    expect(r.trendChangeKg!).toBeLessThan(0);
    expect(r.weightDeficitKcal!).toBeCloseTo((-r.trendChangeKg! * 7700) / 14, 6);
    expect(r.weightDeficitKcal!).toBeGreaterThan(0);
  });
});
