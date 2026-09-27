import { makeEntry, testGoal, testProfile } from '../../../../../domain/testing.ts';
import { canGoBack, weekView } from './week.logic';

describe('canGoBack', () => {
  it('stops at the start of the loaded 90-day window', () => {
    expect(canGoBack('2026-09-27', '2026-09-30')).toBe(true);
    expect(canGoBack('2026-07-12', '2026-09-30')).toBe(true);
    expect(canGoBack('2026-07-05', '2026-09-30')).toBe(false);
  });
});

describe('weekView', () => {
  const entries = [
    makeEntry({ date: '2026-09-27', kcal: 1800 }),
    makeEntry({ date: '2026-09-29', kcal: 300 }),
  ];
  const v = weekView({
    date: '2026-09-30',
    today: '2026-09-30',
    entries,
    days: [],
    profile: testProfile,
    goal: testGoal,
    weighIns: [{ date: '2026-09-27', kg: 85 }],
  });

  it('labels the 7 days Sunday to Saturday', () => {
    expect(v.labels).toEqual(['א׳ 27.9', 'ב׳ 28.9', 'ג׳ 29.9', 'ד׳ 30.9', 'ה׳ 1.10', 'ו׳ 2.10', 'ש׳ 3.10']);
  });

  it('fills values up to today and leaves the future empty', () => {
    expect(v.inKcal.slice(0, 4)).toEqual([1800, 0, 300, 0]);
    expect(v.inKcal.slice(4)).toEqual([null, null, null]);
    expect(v.outKcal[0]).toBeGreaterThan(0);
  });

  it('lists missing past days and their positions', () => {
    expect(v.missing).toEqual(['2026-09-28', '2026-09-29']);
    expect(v.missingIdx).toEqual([1, 2]);
  });
});
