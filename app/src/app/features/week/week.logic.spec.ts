import { makeEntry, testGoal, testProfile } from '../../../../../domain/testing.ts';
import { canGoBack, canGoBackMonth, monthView, shiftMonth, STEPS_BOTTOM, weekView } from './week.logic';

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
    expect(v.inKcal.slice(0, 4)).toEqual([1800, 3200, 3200, 0]);
    expect(v.inKcal.slice(4)).toEqual([null, null, null]);
    expect(v.outKcal[0]).toBeGreaterThan(0);
  });

  it('marks penalized past days and their positions', () => {
    expect(v.imputedIdx).toEqual([1, 2]);
    expect(v.rows.filter((r) => r.imputed).map((r) => r.date)).toEqual(['2026-09-28', '2026-09-29']);
  });
});

describe('week rows', () => {
  it('shows the workout types, the net and penalized days', () => {
    const v = weekView({
      date: '2026-09-30',
      today: '2026-09-30',
      entries: [makeEntry({ date: '2026-09-27', kcal: 1800 })],
      days: [{ date: '2026-09-27', manual: { workouts: [{ type: 'Push', kcal: 350 }] } }],
      profile: testProfile,
      goal: testGoal,
      weighIns: [{ date: '2026-09-27', kg: 85 }],
    });
    expect(v.rows[0]).toMatchObject({ date: '2026-09-27', types: ['Push'], imputed: false });
    expect(v.rows[1]).toMatchObject({ date: '2026-09-28', imputed: true });
    expect(v.rows[1].net).toBeGreaterThan(0);
  });
});

describe('missing inputs', () => {
  const input = {
    date: '2026-09-30',
    today: '2026-09-30',
    entries: [makeEntry({ date: '2026-09-27', kcal: 1800 }), makeEntry({ date: '2026-09-28', kcal: 1900 })],
    days: [{ date: '2026-09-27', manual: { steps: 8000 } }],
    profile: testProfile,
    goal: testGoal,
    weighIns: [{ date: '2026-09-27', kg: 85 }, { date: '2026-09-30', kg: 84.8 }],
  };

  it('lists the steps and weigh-in each finished day still lacks, never today', () => {
    const v = weekView(input);
    expect(v.rows.map((r) => r.missing)).toEqual([[], ['steps', 'weight'], ['steps', 'weight'], []]);
    expect(v.rows[2].imputed).toBe(true);
  });

  it('asks for nothing before the goal started', () => {
    const v = weekView({ ...input, goal: { ...testGoal, startDate: '2026-09-29' } });
    expect(v.rows.map((r) => r.missing)).toEqual([[], [], ['steps', 'weight'], []]);
  });
});

describe('steps chart', () => {
  const input = {
    date: '2026-09-30',
    today: '2026-09-30',
    entries: [],
    days: [
      { date: '2026-09-27', garmin: { steps: 6420, workouts: [] } },
      { date: '2026-09-28', manual: { steps: 9180 } },
      { date: '2026-09-30', garmin: { steps: 4310, workouts: [] } },
    ],
    profile: testProfile,
    goal: testGoal,
    weighIns: [],
  };
  const c = weekView(input).steps;

  it('has a slot for each day, Sunday to Saturday', () => {
    expect(c.slots.map((s) => s.label)).toEqual(['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']);
    expect(c.slots[1].x - c.slots[0].x).toBeCloseTo(c.slots[2].x - c.slots[1].x, 10);
  });

  it('draws entered steps as bars from zero with the count above', () => {
    expect(c.slots.map((s) => s.kind)).toEqual(['bar', 'bar', 'missing', 'bar', 'empty', 'empty', 'empty']);
    expect(c.slots.map((s) => s.note)).toEqual(['6,420', '9,180', 'לא הוזן', '4,310', null, null, null]);
    for (const s of c.slots.filter((s) => s.kind === 'bar')) expect(s.y + s.height).toBeCloseTo(STEPS_BOTTOM, 10);
    expect(c.slots[1].height / c.slots[0].height).toBeCloseTo(9180 / 6420, 10);
  });

  it('marks today, whose steps are still coming in', () => {
    expect(c.slots.map((s) => s.current)).toEqual([false, false, false, true, false, false, false]);
  });

  it('colours each bar by its steps tier, today included', () => {
    expect(c.slots.map((s) => s.tier)).toEqual(['mid', 'mid', null, 'low', null, null, null]);
  });

  it('always reaches the 10,000-step goal line, above the bars under it', () => {
    expect(c.goal.steps).toBe(10000);
    expect(c.goal.y).toBeLessThan(c.slots[1].y);
    expect(c.goal.y).toBeLessThan(c.mean!.y);
  });

  it('lets a great day rise above the goal line', () => {
    const great = weekView({ ...input, days: [...input.days, { date: '2026-09-29', manual: { steps: 14200 } }] }).steps;
    expect(great.slots[2].tier).toBe('great');
    expect(great.slots[2].y).toBeLessThan(great.goal.y);
    expect(great.slots[2].y + great.slots[2].height).toBeCloseTo(STEPS_BOTTOM, 10);
  });

  it('draws the mean of the finished days as a line', () => {
    expect(c.mean?.steps).toBe(7800);
    expect(c.mean!.y).toBeGreaterThan(c.slots[1].y);
    expect(c.mean!.y).toBeLessThan(c.slots[0].y);
  });

  it('never asks for steps before the goal started', () => {
    const early = weekView({ ...input, days: [], goal: { ...testGoal, startDate: '2026-09-29' } }).steps;
    expect(early.slots.map((s) => s.kind)).toEqual(['empty', 'empty', 'missing', 'empty', 'empty', 'empty', 'empty']);
    expect(early.mean).toBeNull();
  });
});

describe('monthView', () => {
  const v = monthView({
    month: '2026-09',
    today: '2026-09-15',
    entries: [makeEntry({ date: '2026-09-02', kcal: 1500 })],
    days: [{ date: '2026-09-02', manual: { workouts: [{ type: 'Legs', kcal: 400 }] } }],
    profile: testProfile,
    goal: { ...testGoal, startDate: '2026-09-02' },
    weighIns: [{ date: '2026-09-02', kg: 85 }],
  });

  it('lays out the calendar from Sunday with leading blanks', () => {
    // 2026-09-01 is a Tuesday
    expect(v.cells.slice(0, 2)).toEqual([null, null]);
    expect(v.cells[2]).toMatchObject({ date: '2026-09-01', day: 1, status: 'before' });
    expect(v.label).toBe('ספטמבר 2026');
  });

  it('marks workouts, deficits, penalties, today and the future', () => {
    const cell = (d: number) => v.cells.find((c) => c?.day === d)!;
    expect(cell(2)).toMatchObject({ types: ['Legs'], status: 'deficit' });
    expect(cell(3).status).toBe('imputed');
    expect(cell(15).status).toBe('today');
    expect(cell(16).status).toBe('future');
  });

  it('moves between months only while the previous month is fully loaded', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(canGoBackMonth('2026-09', '2026-09-28')).toBe(true);
    expect(canGoBackMonth('2026-07', '2026-09-28')).toBe(false);
    expect(canGoBackMonth('2026-06', '2026-09-28')).toBe(false);
  });
});
