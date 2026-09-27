import { testGoal, testProfile } from '../../../../../domain/testing.ts';
import { buildSetup, initialForm, previewSetup, validateStep, type SetupForm } from './setup';

const form: SetupForm = {
  sex: 'male',
  birthDate: '1991-05-10',
  heightCm: 178,
  currentWeightKg: 90,
  bodyFatPct: null,
  activityLevel: 'moderate',
  targetWeightKg: 80,
  preset: 'relaxed',
  customPaceKgPerWeek: null,
  constraints: { kcalMin: null, kcalMax: null, proteinMin: null, proteinMax: 120, carbsMax: null, fatMax: null },
};
const ctx = { today: '2026-09-27', time: '10:00', goalId: 'g2', previousGoal: null, previousProfile: null };

describe('buildSetup', () => {
  it('creates profile, goal, computed values and the first weigh-in', () => {
    const s = buildSetup(form, ctx);
    expect(s.goal).toMatchObject({ id: 'g2', startDate: '2026-09-27', startWeightKg: 90, targetWeightKg: 80, preset: 'relaxed', active: true });
    expect(s.goal.dailyDeficitKcal).toBeCloseTo(495, 6);
    expect(s.profile).toMatchObject({ sex: 'male', heightCm: 178, activityLevel: 'moderate', activeGoalId: 'g2', constraints: { protein: { max: 120 } } });
    expect(s.profile.settings.lowDayThresholdKcal).toBe(800);
    expect(s.computed.macroTargets.protein).toBe(120);
    expect(s.weighIn).toEqual({ date: '2026-09-27', kg: 90, time: '10:00' });
    expect(s.previousGoalId).toBeNull();
  });

  it('keeps the goal when editing without goal changes', () => {
    const s = buildSetup({ ...form, targetWeightKg: 80, preset: 'relaxed' }, { ...ctx, previousGoal: testGoal, previousProfile: testProfile });
    expect(s.goal).toBe(testGoal);
    expect(s.previousGoalId).toBeNull();
  });

  it('starts a new goal when the target changes', () => {
    const s = buildSetup({ ...form, targetWeightKg: 78 }, { ...ctx, previousGoal: testGoal, previousProfile: testProfile });
    expect(s.goal.id).toBe('g2');
    expect(s.previousGoalId).toBe('g1');
  });

  it('keeps the Garmin sync stamp of an existing profile', () => {
    const s = buildSetup(form, { ...ctx, previousProfile: { ...testProfile, garminLastSyncAt: '2026-09-27T06:00:00Z' } });
    expect(s.profile.garminLastSyncAt).toBe('2026-09-27T06:00:00Z');
  });
});

describe('validateStep', () => {
  it('requires a valid profile', () => {
    expect(validateStep(0, { ...form, heightCm: null }, '2026-09-27')).toContain('גובה');
    expect(validateStep(0, { ...form, birthDate: '2026-02-30' }, '2026-09-27')).toContain('תאריך');
    expect(validateStep(0, form, '2026-09-27')).toBeNull();
  });

  it('requires a target below the current weight and a custom pace when chosen', () => {
    expect(validateStep(2, { ...form, targetWeightKg: 95 }, '2026-09-27')).toContain('נמוך');
    expect(validateStep(2, { ...form, preset: 'custom', customPaceKgPerWeek: null }, '2026-09-27')).toContain('קצב');
  });

  it('checks that constraint minimums are not above maximums', () => {
    expect(validateStep(3, { ...form, constraints: { ...form.constraints, proteinMin: 150, proteinMax: 120 } }, '2026-09-27')).toContain('חלבון');
  });
});

describe('initialForm and previewSetup', () => {
  it('prefills from an existing profile and goal', () => {
    const f = initialForm(testProfile, testGoal, 85);
    expect(f).toMatchObject({ heightCm: 178, currentWeightKg: 85, targetWeightKg: 80, preset: 'relaxed' });
    expect(f.constraints.proteinMax).toBe(120);
  });

  it('previews BMR, deficit, a typical target and an ETA', () => {
    const p = previewSetup(form, '2026-09-27')!;
    // BMR: 10·90 + 6.25·178 − 5·35 + 5 = 1842.5
    expect(p.bmrKcal).toBeCloseTo(1842.5, 6);
    expect(p.deficitKcal).toBeCloseTo(495, 6);
    expect(p.typicalTargetKcal).toBeCloseTo(1842.5 * 1.55 - 495, 6);
    // (90 − 80) / 0.45 kg per week × 7 = 155.6 → 156 days after 2026-09-27
    expect(p.etaDate).toBe('2027-03-02');
  });
});
