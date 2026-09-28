import { staleSyncHours, waterfallRows } from './today.logic';

const summary = (over: Record<string, unknown> = {}) =>
  ({
    expenditure: { bmr: 1915, dailyLifeKcal: 383, steps: 3500, stepsSource: 'default', stepsKcal: 0, workouts: [{ type: 'Push', kcal: 350, source: 'manual' }], workoutsKcal: 350, out: 2648 },
    deficitKcal: 1009,
    targetKcal: 1639,
    ...over,
  }) as never;

describe('today logic', () => {
  it('reports a stale Garmin sync after 6 hours', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    expect(staleSyncHours('2026-09-27T05:30:00Z', now)).toBe(6);
    expect(staleSyncHours(undefined, now)).toBeNull();
  });

  it('builds the target waterfall and marks defaulted steps', () => {
    expect(waterfallRows(summary(), 3500)).toEqual([
      { label: 'BMR', value: 1915, kind: 'base' },
      { label: 'יומיום ועיכול', value: 383, kind: 'plus' },
      { label: 'צעדים', value: 0, kind: 'plus', note: '3,500 · לא הוזנו' },
      { label: 'Push', value: 350, kind: 'plus' },
      { label: 'גירעון', value: -1009, kind: 'minus' },
      { label: 'יעד', value: 1639, kind: 'total' },
    ]);
  });

  it('adds a constraint row when the target was clamped', () => {
    const rows = waterfallRows(summary({ targetKcal: 1800 }), 3500);
    expect(rows.at(-2)).toEqual({ label: 'מגבלת קלוריות', value: 161, kind: 'plus' });
  });

  it('shows fewer steps than the default as a minus row with the count', () => {
    const e = { bmr: 1915, dailyLifeKcal: 383, steps: 2000, stepsSource: 'manual', stepsKcal: -49, workouts: [], workoutsKcal: 0, out: 2249 };
    const rows = waterfallRows(summary({ expenditure: e, targetKcal: 1240 }), 3500);
    expect(rows[2]).toEqual({ label: 'צעדים', value: -49, kind: 'minus', note: '2,000 · בסיס 3,500' });
  });

  it('never prints a signed zero for the steps row', () => {
    const e = { bmr: 1915, dailyLifeKcal: 383, steps: 3490, stepsSource: 'manual', stepsKcal: -0.3, workouts: [], workoutsKcal: 0, out: 2297.7 };
    expect(Object.is(waterfallRows(summary({ expenditure: e }), 3500)[2].value, 0)).toBe(true);
  });
});
