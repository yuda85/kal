import { describe, expect, it } from 'vitest';
import { achievements, dueCelebrations, earnedCelebrations, fullWeek, loggingStreak, stepsAchievements, weightMilestones, type AchievementInput } from './achievements.ts';
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

describe('stepsAchievements', () => {
  const g = (date: string, steps: number) => ({ date, garmin: { steps, workouts: [] } });

  it('counts days at 10,000 or more back from yesterday, with no grace', () => {
    const days = [g('2026-09-26', 9000), g('2026-09-27', 12000), { date: '2026-09-28', manual: { steps: 10000 } }, g('2026-09-29', 10500), g('2026-09-30', 4000)];
    const s = stepsAchievements({ ...base, days });
    expect(s.streak).toEqual({ days: 3, start: '2026-09-27', todayCounted: false });
    const on = stepsAchievements({ ...base, days: [...days.slice(0, 4), g('2026-09-30', 11000)] });
    expect(on.streak).toEqual({ days: 4, start: '2026-09-27', todayCounted: true });
  });

  it('keeps the best day, and marks today when it beats a previous best', () => {
    const days = [g('2026-09-23', 14200), g('2026-09-24', 8000), g('2026-09-30', 9000)];
    expect(stepsAchievements({ ...base, days }).bestDay).toEqual({ date: '2026-09-23', steps: 14200 });
    const beat = stepsAchievements({ ...base, days: [...days.slice(0, 2), g('2026-09-30', 15000)] });
    expect(beat.bestDay).toEqual({ date: '2026-09-30', steps: 15000 });
    expect(beat.todayIsBest).toBe(true);
  });

  it('never calls the first day with steps a record', () => {
    const s = stepsAchievements({ ...base, days: [g('2026-09-30', 9000)] });
    expect(s.bestDay).toEqual({ date: '2026-09-30', steps: 9000 });
    expect(s.todayIsBest).toBe(false);
  });

  it('keeps the best finished week with at least 5 days of steps', () => {
    const week13 = ['2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'].map((d) => g(d, 8000));
    const week20 = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23'].map((d) => g(d, 12000));
    const four = stepsAchievements({ ...base, days: [...week13, ...week20] });
    expect(four.bestWeek).toEqual({ date: '2026-09-13', steps: 8000 });
    expect(four.lastWeekIsBest).toBe(false);
    const five = stepsAchievements({ ...base, days: [...week13, ...week20, g('2026-09-24', 12000)] });
    expect(five.bestWeek).toEqual({ date: '2026-09-20', steps: 12000 });
    expect(five.lastWeekIsBest).toBe(true);
  });
});

describe('weightMilestones', () => {
  // testGoal: 90 → 80 kg from 2026-09-01; the weight is the latest week's mean
  it('has a milestone every 2 kg and the target last', () => {
    const m = weightMilestones(testGoal, [], '2026-09-30');
    expect(m.milestones).toEqual([2, 4, 6, 8, 10]);
    expect([m.lostKg, m.reachedKg]).toEqual([null, null]);
    expect(m.next).toEqual({ kg: 2, target: false, leftKg: 2 });
  });

  it('shows the last one reached and how far the next is, from the current mean', () => {
    const m = weightMilestones(testGoal, [{ date: '2026-09-27', kg: 86.8 }, { date: '2026-09-29', kg: 86.4 }], '2026-09-30');
    expect(m.reachedKg).toBe(2);
    expect(m.next?.kg).toBe(4);
    expect(m.next?.leftKg).toBeCloseTo(0.6, 10);
  });

  it('counts a milestone reached exactly, despite float subtraction', () => {
    const goal = { ...testGoal, startWeightKg: 92.2, targetWeightKg: 83 };
    const m = weightMilestones(goal, [{ date: '2026-09-29', kg: 88.2 }], '2026-09-30');
    expect(m.reachedKg).toBe(4);
    expect(m.milestones.at(-1)).toBeCloseTo(9.2, 10);
  });

  it('reaches the target', () => {
    const m = weightMilestones(testGoal, [{ date: '2026-09-29', kg: 79.5 }], '2026-09-30');
    expect(m.reachedTarget).toBe(true);
    expect(m.reachedKg).toBe(10);
    expect(m.next).toBeNull();
  });

  it('follows the mean back up', () => {
    const m = weightMilestones(testGoal, [{ date: '2026-09-22', kg: 85.9 }, { date: '2026-09-29', kg: 86.5 }], '2026-09-30');
    expect(m.reachedKg).toBe(2);
  });
});

describe('celebrations', () => {
  const g = (date: string, steps: number) => ({ date, garmin: { steps, workouts: [] } });
  const eightDays = food('2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29');

  it('earns every streak milestone of the current run, keyed by its start', () => {
    const a = achievements({ ...base, entries: eightDays });
    const keys = earnedCelebrations(a, 'g1', base.today).map((c) => c.key);
    expect(keys).toContain('streak-7-2026-09-22');
    expect(keys).not.toContain('streak-14-2026-09-22');
  });

  it('earns no streak celebration once the streak is capped', () => {
    const a = achievements({ ...base, entries: eightDays, entriesFrom: '2026-09-22' });
    expect(a.logging.capped).toBe(true);
    expect(earnedCelebrations(a, 'g1', base.today).filter((c) => c.kind === 'streak')).toEqual([]);
  });

  it('earns weight milestones per goal, the target by name', () => {
    const a = achievements({ ...base, goal: testGoal, weighIns: [{ date: '2026-09-29', kg: 79.5 }] });
    const weight = earnedCelebrations(a, 'g1', base.today).filter((c) => c.kind === 'weight');
    expect(weight.map((c) => c.key)).toEqual(['weight-g1-2', 'weight-g1-4', 'weight-g1-6', 'weight-g1-8', 'weight-g1-target']);
    expect(weight.at(-1)!.target).toBe(true);
  });

  it('earns a record day and a steps streak', () => {
    const days = [g('2026-09-27', 10500), g('2026-09-28', 11000), g('2026-09-29', 12000), g('2026-09-30', 12500)];
    const kinds = earnedCelebrations(achievements({ ...base, days }), 'g1', base.today).map((c) => c.key);
    expect(kinds).toContain('steps-streak-3-2026-09-27');
    expect(kinds).toContain('steps-day-2026-09-30');
  });

  it('shows only unseen celebrations, the highest of each kind', () => {
    const a = achievements({ ...base, goal: testGoal, weighIns: [{ date: '2026-09-29', kg: 85 }] });
    const earned = earnedCelebrations(a, 'g1', base.today);
    expect(dueCelebrations(earned, []).map((c) => c.key)).toEqual(['weight-g1-4']);
    expect(dueCelebrations(earned, ['weight-g1-2', 'weight-g1-4'])).toEqual([]);
  });

  it('celebrates a new run again', () => {
    const run1 = earnedCelebrations(achievements({ ...base, entries: eightDays }), 'g1', base.today);
    const later = food('2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06');
    const run2 = earnedCelebrations(achievements({ ...base, today: '2026-10-07', entries: later }), 'g1', '2026-10-07');
    expect(dueCelebrations(run2, run1.map((c) => c.key)).map((c) => c.key)).toEqual(['streak-7-2026-09-30']);
  });
});
