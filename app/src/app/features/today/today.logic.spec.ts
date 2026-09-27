import { breakdownText, staleSyncHours } from './today.logic';

describe('today logic', () => {
  it('reports a stale Garmin sync after 6 hours', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    expect(staleSyncHours('2026-09-27T05:30:00Z', now)).toBe(6);
    expect(staleSyncHours('2026-09-27T07:00:00Z', now)).toBeNull();
    expect(staleSyncHours(undefined, now)).toBeNull();
  });

  it('describes the expenditure breakdown', () => {
    const text = breakdownText({
      expenditure: { bmr: 1792.5, steps: 15200, stepsKcal: 288.8, workouts: [], workoutsKcal: 464, out: 2545.3, source: 'measured' },
    } as never);
    expect(text).toBe('BMR 1,793 · צעדים 15,200 → 289 · אימונים → 464');
  });

  it('marks the activity-level fallback', () => {
    const text = breakdownText({
      expenditure: { bmr: 1792.5, steps: 0, stepsKcal: 0, workouts: [], workoutsKcal: 0, out: 2778.4, source: 'fallback' },
    } as never);
    expect(text).toBe('BMR 1,793 × רמת פעילות = 2,778 (אין נתוני פעילות)');
  });
});
