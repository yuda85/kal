import { describe, expect, it } from 'vitest';
import { run } from '../../.claude/skills/kal/scripts/lib/commands.ts';
import { FISH_BALLS, testGoal } from '../../domain/testing.ts';
import { fakeReader } from './fake-reader.ts';

const now = new Date('2026-09-27T10:00:00Z');

describe('read commands', () => {
  it('day: returns the day summary', async () => {
    const out = (await run(['day', '2026-09-27'], { reader: fakeReader(), now })) as any;
    expect(out.date).toBe('2026-09-27');
    expect(out.intake.kcal).toBe(320);
    expect(out.remainingKcal).toBeCloseTo(2298.934 - 320, 2);
  });

  it('day: defaults to today in Israel', async () => {
    const out = (await run(['day'], { reader: fakeReader(), now })) as any;
    expect(out.date).toBe('2026-09-27');
  });

  it('week: summarizes the week with missing days', async () => {
    const out = (await run(['week', '2026-09-27'], { reader: fakeReader(), now })) as any;
    expect(out.start).toBe('2026-09-27');
    expect(out.daysLogged).toBe(0);
    expect(out.missingDays).toEqual([]);
    expect(out.days[0]).toEqual({ date: '2026-09-27', inKcal: 320, countedKcal: 320, imputed: false, outKcal: expect.any(Number), protein: 20, entries: 1, workouts: ['running'] });
    expect(out.workoutsCount).toBe(1);
  });

  it('profile: returns trend, targets and plan status', async () => {
    const out = (await run(['profile'], { reader: fakeReader(), now })) as any;
    expect(out.trendKg).toBe(85);
    expect(out.bmrKcal).toBeCloseTo(1792.5, 6);
    expect(out.macroTargets.protein).toBe(120);
    expect(out).not.toHaveProperty('status');
    expect(out.reality.status).toBe('no_data');
    expect(out.eta).toBeNull();
    expect(out.reportGap).toBeNull();
  });

  it('recipes: returns per-unit numbers and the saved ingredients', async () => {
    const out = (await run(['recipes'], { reader: fakeReader(), now })) as any[];
    expect(out[0].id).toBe('fish-balls');
    expect(out[0].perUnit.kcal).toBeCloseTo(62.66, 6);
    expect(out[0].per100g).toBeNull();
    expect(out[0].ingredients).toEqual(FISH_BALLS);
  });

  it('week: never lists days before the goal started as missing', async () => {
    const { id: _id, ...goalData } = testGoal;
    const reader = fakeReader({ goals: [{ id: 'g1', data: { ...goalData, startDate: '2026-09-29' } }] });
    const out = (await run(['week', '2026-09-27'], { reader, now: new Date('2026-10-01T10:00:00Z') })) as any;
    expect(out.missingDays).toEqual(['2026-09-29', '2026-09-30']);
  });

  it('month: summarizes the month with workouts and penalized days', async () => {
    const out = (await run(['month', '2026-09'], { reader: fakeReader(), now: new Date('2026-09-28T10:00:00Z') })) as any;
    expect(out.month).toBe('2026-09');
    expect(out.workoutsCount).toBe(1);
    // 09-01..09-27 are finished; only 09-20 (999 kcal) is logged, 09-27 (320 kcal) is penalized
    expect(out.daysLogged).toBe(1);
    expect(out.imputedDays).toBe(26);
    expect(out.days.find((d: any) => d.date === '2026-09-27')).toMatchObject({ inKcal: 320, countedKcal: 3200, imputed: true, workouts: ['running'] });
    expect(out.days.find((d: any) => d.date === '2026-09-20').imputed).toBe(false);
  });

  it('rejects an invalid month', async () => {
    await expect(run(['month', '2026-13'], { reader: fakeReader(), now })).rejects.toThrow('invalid month');
  });

  it('rejects unknown commands and invalid dates', async () => {
    await expect(run(['nope'], { reader: fakeReader(), now })).rejects.toThrow('unknown command');
    await expect(run(['day', '2026-13-01'], { reader: fakeReader(), now })).rejects.toThrow('invalid date');
  });

  it('profile: counts an under-logged day as the penalty in the reality check', async () => {
    const weights = ['2026-09-10', '2026-09-20', '2026-09-24', '2026-09-26', '2026-09-27'].map((id) => ({ id, data: { kg: 85 } }));
    const entries = [{ id: 'c1', data: { date: '2026-09-26', time: '08:00', name: 'קפה', kcal: 2, protein: null, carbs: null, fat: null, source: 'link' } }];
    const out = (await run(['profile'], { reader: fakeReader({ weights, entries }), now })) as any;
    // 13 finished days 09-14..09-26, none logged: every day counts 3,200 in
    expect(out.reality.loggedDeficitKcal).toBeLessThan(0);
    const day = (await run(['day', '2026-09-26'], { reader: fakeReader({ weights, entries }), now })) as any;
    expect(out.reality.loggedDeficitKcal).toBeCloseTo(day.expenditure.out - 3200, 0);
  });
});
