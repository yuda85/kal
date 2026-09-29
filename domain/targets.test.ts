import { describe, expect, it } from 'vitest';
import { dailyDeficit, dailyTarget, macroTargets, makeGoal, typicalTarget } from './targets.ts';

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

describe('dailyTarget and typicalTarget', () => {
  it('subtracts the deficit and keeps the kcal constraint', () => {
    expect(dailyTarget(2500, 500, {})).toBe(2000);
    expect(dailyTarget(2500, 500, { kcal: { min: 2100 } })).toBe(2100);
    expect(dailyTarget(2500, 500, { kcal: { max: 1800 } })).toBe(1800);
  });

  it('burns BMR × baseFactor on a typical day', () => {
    expect(typicalTarget(1800, 1.2, 500, {})).toBeCloseTo(1660, 10);
    expect(typicalTarget(1800, 1.2, 500, { kcal: { min: 1700 } })).toBe(1700);
  });
});

describe('macroTargets', () => {
  it('plans 1.8 g protein per kg, fat as 30% of the calories and carbs from the rest', () => {
    const t = macroTargets(85, 2000, {});
    expect(t.protein).toBeCloseTo(153, 10);
    expect(t.fat).toBeCloseTo(600 / 9, 10);
    expect(t.carbs).toBeCloseTo((2000 - 153 * 4 - 600) / 4, 10);
    expect(t.protein * 4 + t.carbs * 4 + t.fat * 9).toBeCloseTo(2000, 10);
  });

  it('raises protein to the constraint min', () => {
    expect(macroTargets(85, 2000, { protein: { min: 160 } }).protein).toBe(160);
  });

  it('caps protein at the constraint max and gives the calories to carbs', () => {
    expect(macroTargets(85, 2000, { protein: { max: 120 } }).protein).toBe(120);
    expect(macroTargets(60, 2000, { protein: { max: 120 } }).protein).toBeCloseTo(108, 10);
    expect(macroTargets(85, 2000, { protein: { max: 120 } }).carbs).toBeCloseTo((2000 - 480 - 600) / 4, 10);
  });

  it('keeps fat and carbs inside their constraints', () => {
    expect(macroTargets(85, 2000, { fat: { max: 50 }, carbs: { max: 150 } })).toMatchObject({ fat: 50, carbs: 150 });
  });

  it('never plans negative carbs', () => {
    expect(macroTargets(120, 900, {}).carbs).toBe(0);
  });
});
