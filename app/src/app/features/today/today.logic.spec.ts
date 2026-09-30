import { staleSyncHours, streakChip, targetBreakdown } from './today.logic';

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

  it('builds the equation and the burn lines, marking defaulted steps', () => {
    const b = targetBreakdown(summary(), 3500, 0.92);
    expect(b).toMatchObject({ burn: 2648, deficit: 1009, clamp: 0, target: 1639, pace: '0.92 ק״ג בשבוע' });
    expect(b.lines).toEqual([
      { label: 'במנוחה', note: 'BMR', kcal: 1915 },
      { label: 'יומיום ועיכול', note: 'כולל 3,500 צעדים', kcal: 383 },
      { label: 'צעדים', note: 'לא הוזנו', kcal: 0 },
      { label: 'אימון', note: 'Push', kcal: 350 },
    ]);
    expect(b.summary).toBe('יעד לאכילה 1,639: שורף היום 2,648, פחות גירעון 1,009');
  });

  it('adds the kcal constraint to the equation when it moved the target', () => {
    const raised = targetBreakdown(summary({ targetKcal: 1800 }), 3500, 0.92);
    expect(raised).toMatchObject({ burn: 2648, deficit: 1009, clamp: 161, clampLabel: 'מינימום קלוריות', target: 1800 });
    const capped = targetBreakdown(summary({ targetKcal: 1500 }), 3500, 0.92);
    expect(capped).toMatchObject({ clamp: -139, clampLabel: 'מקסימום קלוריות' });
    expect(capped.burn - capped.deficit + capped.clamp).toBe(capped.target);
  });

  it('names extra and missing steps with the count', () => {
    const more = { bmr: 1915, dailyLifeKcal: 383, steps: 8200, stepsSource: 'manual', stepsKcal: 148, workouts: [], workoutsKcal: 0, out: 2446 };
    expect(targetBreakdown(summary({ expenditure: more, targetKcal: 1437 }), 3500, 0.92).lines[2]).toEqual({ label: 'צעדים נוספים', note: '8,200 היום', kcal: 148 });
    const fewer = { bmr: 1915, dailyLifeKcal: 383, steps: 2000, stepsSource: 'manual', stepsKcal: -49, workouts: [], workoutsKcal: 0, out: 2249 };
    expect(targetBreakdown(summary({ expenditure: fewer, targetKcal: 1240 }), 3500, 0.92).lines[2]).toEqual({ label: 'פחות צעדים', note: '2,000 היום', kcal: -49 });
  });

  it('never prints a signed zero for the steps line', () => {
    const e = { bmr: 1915, dailyLifeKcal: 383, steps: 3490, stepsSource: 'manual', stepsKcal: -0.3, workouts: [], workoutsKcal: 0, out: 2297.7 };
    expect(Object.is(targetBreakdown(summary({ expenditure: e, targetKcal: 2297.7 - 1009 }), 3500, 0.92).lines[2].kcal, 0)).toBe(true);
  });

  it('rounds so the numbers on screen add up', () => {
    const e = { bmr: 1922.6, dailyLifeKcal: 384.52, steps: 3512, stepsSource: 'manual', stepsKcal: 0.4, workouts: [], workoutsKcal: 0, out: 2307.52 };
    const b = targetBreakdown(summary({ expenditure: e, deficitKcal: 507.27, targetKcal: 2307.52 - 507.27 }), 3500, 0.46);
    expect(b.target).toBe(1800);
    expect(b.burn - b.deficit).toBe(b.target);
    expect(b.lines.reduce((sum, l) => sum + l.kcal, 0)).toBe(b.burn);
  });

  describe('streakChip', () => {
    const s = { days: 12, capped: false, graceUsedThisWeek: false, todayCounted: true, start: '2026-09-19' };

    it('shows the count and whether today already counts', () => {
      expect(streakChip(s)).toEqual({ count: '12', today: true, one: false, label: 'רצף דיווח 12 ימים, היום כבר דווח' });
      expect(streakChip({ ...s, todayCounted: false })!.label).toBe('רצף דיווח 12 ימים, היום עוד לא דווח');
    });

    it('marks a capped streak with a plus, and hides an empty one', () => {
      expect(streakChip({ ...s, capped: true, days: 85 })!.count).toBe('85+');
      expect(streakChip({ ...s, days: 0, todayCounted: false, start: null })).toBeNull();
    });

    it('reads "יום אחד" for a 1-day streak, without a number', () => {
      const one = streakChip({ ...s, days: 1, todayCounted: true })!;
      expect(one.one).toBe(true);
      expect(one.label).toBe('רצף דיווח יום אחד, היום כבר דווח');
    });

    it('keeps the "N+ ימים" form for a capped streak even when the number reads 1', () => {
      const cappedOne = streakChip({ ...s, days: 1, capped: true, todayCounted: false })!;
      expect(cappedOne.one).toBe(false);
      expect(cappedOne.label).toBe('רצף דיווח 1+ ימים, היום עוד לא דווח');
    });
  });
});
