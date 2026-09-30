import { describe, expect, it } from 'vitest';
import { fullWeek, loggingStreak, type AchievementInput } from './achievements.ts';
import { makeEntry, testGoal } from './testing.ts';

// 2026-09-27 is a Sunday; today is Wednesday 2026-09-30.
const base: AchievementInput = {
  today: '2026-09-30',
  goal: { ...testGoal, startDate: '2026-08-01' },
  entries: [],
  days: [],
  weighIns: [],
  lowDayThresholdKcal: 800,
  entriesFrom: '2026-07-02',
};
const food = (...dates: string[]) => dates.map((date) => makeEntry({ date, kcal: 1500 }));

describe('loggingStreak', () => {
  it('counts logged days back from yesterday; today adds once logged and never breaks', () => {
    // 09-24 missed (grace of the week of 09-20), 09-23 missed too: the streak stops there
    const entries = [...food('2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29'), makeEntry({ date: '2026-09-30', kcal: 300 })];
    const s = loggingStreak({ ...base, entries });
    expect(s).toEqual({ days: 5, capped: false, graceUsedThisWeek: false, todayCounted: false, start: '2026-09-25' });
    const logged = loggingStreak({ ...base, entries: [...entries, makeEntry({ date: '2026-09-30', kcal: 600 })] });
    expect(logged.days).toBe(6);
    expect(logged.todayCounted).toBe(true);
  });

  it('absorbs one missed day per week and stops at the second', () => {
    const entries = food('2026-09-21', '2026-09-22', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-29');
    // 09-28 missed (week of 09-27 grace), 09-23 missed (week of 09-20 grace), 09-20 missed: second in its week
    const s = loggingStreak({ ...base, entries });
    expect(s.days).toBe(7);
    expect(s.start).toBe('2026-09-21');
    expect(s.graceUsedThisWeek).toBe(true);
  });

  it('absorbs a missed Saturday and Sunday in a row: they are different weeks', () => {
    const entries = food('2026-09-24', '2026-09-25', '2026-09-28', '2026-09-29');
    const s = loggingStreak({ ...base, entries });
    expect(s.days).toBe(4);
    expect(s.start).toBe('2026-09-24');
  });

  it('does not count a day under the threshold', () => {
    const entries = [makeEntry({ date: '2026-09-29', kcal: 799 }), makeEntry({ date: '2026-09-28', kcal: 799 })];
    expect(loggingStreak({ ...base, entries }).days).toBe(0);
  });

  it('never reaches before the goal start', () => {
    const entries = food('2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29');
    const s = loggingStreak({ ...base, entries, goal: { ...base.goal, startDate: '2026-09-28' } });
    expect(s.days).toBe(2);
    expect(s.capped).toBe(false);
  });

  it('is capped when it reaches the start of the loaded entries', () => {
    const entries = food('2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29');
    const s = loggingStreak({ ...base, entries, entriesFrom: '2026-09-25' });
    expect(s.days).toBe(5);
    expect(s.capped).toBe(true);
  });
});

describe('fullWeek', () => {
  const steps = (date: string) => ({ date, garmin: { steps: 6000, workouts: [] } });
  const weigh = (date: string) => ({ date, kg: 85 });
  const input: AchievementInput = {
    ...base,
    entries: food('2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'),
    days: ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'].map(steps),
    weighIns: ['2026-09-27', '2026-09-29', '2026-09-30'].map(weigh),
  };

  it('scores the days with food, steps and a real weigh-in', () => {
    const w = fullWeek(input, '2026-09-30');
    expect(w.start).toBe('2026-09-27');
    expect(w.days.map((d) => d.state)).toEqual(['full', 'partial', 'full', 'full', 'open', 'open', 'open']);
    expect([w.full, w.of, w.perfect]).toEqual([3, 7, false]);
  });

  it('leaves today open until it is full', () => {
    const w = fullWeek({ ...input, weighIns: input.weighIns.filter((x) => x.date !== '2026-09-30') }, '2026-09-30');
    expect(w.days[3].state).toBe('open');
  });

  it('counts only the days on or after the goal start', () => {
    const w = fullWeek({ ...input, goal: { ...base.goal, startDate: '2026-09-29' } }, '2026-09-30');
    expect(w.days.slice(0, 2).map((d) => d.state)).toEqual(['open', 'open']);
    expect([w.full, w.of]).toEqual([2, 5]);
  });

  it('is perfect when every day is full', () => {
    const week = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'];
    const w = fullWeek({ ...base, entries: food(...week), days: week.map(steps), weighIns: week.map(weigh) }, '2026-09-22');
    expect([w.full, w.of, w.perfect]).toEqual([7, 7, true]);
  });
});
