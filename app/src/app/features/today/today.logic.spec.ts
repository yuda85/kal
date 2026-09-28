import { staleSyncHours, waterfallRows } from './today.logic';

const summary = (over: Record<string, unknown> = {}) =>
  ({
    expenditure: { bmr: 1915, steps: 3500, stepsSource: 'default', stepsKcal: 115, workouts: [{ type: 'Push', kcal: 350, source: 'manual' }], workoutsKcal: 350, out: 2380 },
    deficitKcal: 1009,
    targetKcal: 1371,
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
      { label: 'צעדים', value: 115, kind: 'plus', note: '3,500 · לא הוזנו' },
      { label: 'Push', value: 350, kind: 'plus' },
      { label: 'גירעון', value: -1009, kind: 'minus' },
      { label: 'יעד', value: 1371, kind: 'total' },
    ]);
  });

  it('adds a constraint row when the target was clamped', () => {
    const rows = waterfallRows(summary({ targetKcal: 1500 }), 3500);
    expect(rows.at(-2)).toEqual({ label: 'מגבלת קלוריות', value: 129, kind: 'plus' });
  });
});
