import { describe, expect, it } from 'vitest';
import { dailyDeficit, macroTargets, makeGoal } from './targets.ts';

const base = { id: 'g1', startDate: '2026-09-01', startWeightKg: 90, targetWeightKg: 80 };

describe('dailyDeficit', () => {
  it('converts weekly pace to a daily deficit at 7700 kcal/kg', () => {
    expect(dailyDeficit(0.5)).toBeCloseTo(550, 10);
  });
});

describe('makeGoal', () => {
  it('uses 0.5% of start weight per week for relaxed', () => {
    const g = makeGoal({ ...base, preset: 'relaxed' });
    expect(g.paceKgPerWeek).toBeCloseTo(0.45, 10);
    expect(g.dailyDeficitKcal).toBeCloseTo(495, 10);
    expect(g.active).toBe(true);
  });

  it('uses 1% of start weight per week for aggressive', () => {
    const g = makeGoal({ ...base, preset: 'aggressive' });
    expect(g.paceKgPerWeek).toBeCloseTo(0.9, 10);
    expect(g.dailyDeficitKcal).toBeCloseTo(990, 10);
  });

  it('uses the custom pace', () => {
    const g = makeGoal({ ...base, preset: 'custom', customPaceKgPerWeek: 0.3 });
    expect(g.dailyDeficitKcal).toBeCloseTo(330, 10);
  });

  it('rejects a custom preset without a positive pace', () => {
    expect(() => makeGoal({ ...base, preset: 'custom' })).toThrow('custom pace');
    expect(() => makeGoal({ ...base, preset: 'custom', customPaceKgPerWeek: 0 })).toThrow('custom pace');
  });

  it('rejects a target that is not below the start weight', () => {
    expect(() => makeGoal({ ...base, targetWeightKg: 90, preset: 'relaxed' })).toThrow('target weight');
  });
});

describe('macroTargets', () => {
  it('targets 1.8 g protein per kg', () => {
    expect(macroTargets(85, {})).toEqual({ protein: 153, carbs: null, fat: null });
  });

  it('raises protein to the constraint min', () => {
    expect(macroTargets(85, { protein: { min: 160 } }).protein).toBe(160);
  });

  it('caps protein at the constraint max', () => {
    expect(macroTargets(85, { protein: { max: 120 } }).protein).toBe(120);
    expect(macroTargets(60, { protein: { max: 120 } }).protein).toBeCloseTo(108, 10);
  });
});
