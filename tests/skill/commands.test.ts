import { describe, expect, it } from 'vitest';
import { run } from '../../.claude/skills/kal/scripts/lib/commands.ts';
import { fakeReader } from './fake-reader.ts';

const now = new Date('2026-09-27T10:00:00Z');

describe('read commands', () => {
  it('day: returns the day summary', async () => {
    const out = (await run(['day', '2026-09-27'], { reader: fakeReader(), now })) as any;
    expect(out.date).toBe('2026-09-27');
    expect(out.intake.kcal).toBe(320);
    expect(out.remainingKcal).toBeCloseTo(2050.316 - 320, 2);
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
    expect(out.days[0]).toEqual({ date: '2026-09-27', inKcal: 320, outKcal: expect.any(Number), protein: 20, entries: 1 });
  });

  it('profile: returns trend, targets and plan status', async () => {
    const out = (await run(['profile'], { reader: fakeReader(), now })) as any;
    expect(out.trendKg).toBe(85);
    expect(out.bmrKcal).toBeCloseTo(1792.5, 6);
    expect(out.macroTargets.protein).toBe(120);
    expect(out.status).toBe('ahead');
    expect(out.eta).toBeNull();
    expect(out.reportGap).toBeNull();
  });

  it('recipes: returns per-unit numbers', async () => {
    const out = (await run(['recipes'], { reader: fakeReader(), now })) as any[];
    expect(out[0].id).toBe('fish-balls');
    expect(out[0].perUnit.kcal).toBeCloseTo(62.66, 6);
    expect(out[0].per100g).toBeNull();
  });

  it('rejects unknown commands and invalid dates', async () => {
    await expect(run(['nope'], { reader: fakeReader(), now })).rejects.toThrow('unknown command');
    await expect(run(['day', '2026-13-01'], { reader: fakeReader(), now })).rejects.toThrow('invalid date');
  });
});
