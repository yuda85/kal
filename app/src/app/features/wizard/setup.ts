import {
  addDays,
  DEFAULT_BASE_FACTOR,
  ageOn,
  bmr,
  dailyDeficit,
  isValidDate,
  macroTargets,
  makeGoal,
  settingsOf,
  typicalTarget,
  type Constraints,
  type Goal,
  type PacePreset,
  type Profile,
  type Sex,
} from '../../domain';
import type { SetupWrite } from '../../core/repository';

export interface ConstraintFields {
  kcalMin: number | null;
  kcalMax: number | null;
  proteinMin: number | null;
  proteinMax: number | null;
  carbsMax: number | null;
  fatMax: number | null;
}

export interface SetupForm {
  sex: Sex;
  birthDate: string;
  heightCm: number | null;
  currentWeightKg: number | null;
  bodyFatPct: number | null;
  targetWeightKg: number | null;
  preset: PacePreset;
  customPaceKgPerWeek: number | null;
  constraints: ConstraintFields;
}

const PRESET_FRACTION = { relaxed: 0.005, aggressive: 0.01 } as const;

function range(min: number | null, max: number | null) {
  const r: { min?: number; max?: number } = {};
  if (min !== null) r.min = min;
  if (max !== null) r.max = max;
  return Object.keys(r).length > 0 ? r : undefined;
}

function toConstraints(c: ConstraintFields): Constraints {
  const out: Constraints = {};
  const kcal = range(c.kcalMin, c.kcalMax);
  const protein = range(c.proteinMin, c.proteinMax);
  const carbs = range(null, c.carbsMax);
  const fat = range(null, c.fatMax);
  if (kcal) out.kcal = kcal;
  if (protein) out.protein = protein;
  if (carbs) out.carbs = carbs;
  if (fat) out.fat = fat;
  return out;
}

export function initialForm(profile: Profile | null, goal: Goal | null, latestKg: number | null): SetupForm {
  const c = profile?.constraints ?? {};
  return {
    sex: profile?.sex ?? 'male',
    birthDate: profile?.birthDate ?? '',
    heightCm: profile?.heightCm ?? null,
    currentWeightKg: latestKg,
    bodyFatPct: profile?.bodyFatPct ?? null,
    targetWeightKg: goal?.targetWeightKg ?? null,
    preset: goal?.preset ?? 'relaxed',
    customPaceKgPerWeek: goal?.preset === 'custom' ? goal.paceKgPerWeek : null,
    constraints: {
      kcalMin: c.kcal?.min ?? null,
      kcalMax: c.kcal?.max ?? null,
      proteinMin: c.protein?.min ?? null,
      proteinMax: c.protein?.max ?? null,
      carbsMax: c.carbs?.max ?? null,
      fatMax: c.fat?.max ?? null,
    },
  };
}

function inRange(v: number | null, min: number, max: number): boolean {
  return v !== null && Number.isFinite(v) && v >= min && v <= max;
}

export function validateStep(step: number, f: SetupForm, today: string): string | null {
  if (step === 0) {
    if (!isValidDate(f.birthDate) || !inRange(ageOn(f.birthDate, today), 14, 100)) return 'תאריך לידה לא תקין';
    if (!inRange(f.heightCm, 120, 230)) return 'גובה: בין 120 ל-230 ס״מ';
    if (!inRange(f.currentWeightKg, 30, 300)) return 'משקל: בין 30 ל-300 ק״ג';
    if (f.bodyFatPct !== null && !inRange(f.bodyFatPct, 3, 60)) return 'אחוז שומן: בין 3 ל-60';
  }
  if (step === 1) {
    if (!inRange(f.targetWeightKg, 30, 300)) return 'משקל יעד: בין 30 ל-300 ק״ג';
    if (f.currentWeightKg !== null && f.targetWeightKg! >= f.currentWeightKg) return 'משקל היעד צריך להיות נמוך מהמשקל הנוכחי';
    if (f.preset === 'custom' && !inRange(f.customPaceKgPerWeek, 0.1, 1.5)) return 'קצב מותאם: בין 0.1 ל-1.5 ק״ג בשבוע';
  }
  if (step === 2) {
    const c = f.constraints;
    const values = [c.kcalMin, c.kcalMax, c.proteinMin, c.proteinMax, c.carbsMax, c.fatMax];
    if (values.some((v) => v !== null && !inRange(v, 0, 10000))) return 'מגבלות: מספרים חיוביים בלבד';
    if (c.kcalMin !== null && c.kcalMax !== null && c.kcalMin > c.kcalMax) return 'קלוריות: המינימום גבוה מהמקסימום';
    if (c.proteinMin !== null && c.proteinMax !== null && c.proteinMin > c.proteinMax) return 'חלבון: המינימום גבוה מהמקסימום';
  }
  return null;
}

function paceOf(f: SetupForm): number | null {
  if (f.preset === 'custom') return f.customPaceKgPerWeek;
  return f.currentWeightKg === null ? null : f.currentWeightKg * PRESET_FRACTION[f.preset];
}

/** The summary step: what a typical day (default steps, no workout) looks like under this goal. */
export function previewSetup(f: SetupForm, today: string, baseFactor = DEFAULT_BASE_FACTOR) {
  const pace = paceOf(f);
  if (f.currentWeightKg === null || f.heightCm === null || f.targetWeightKg === null || pace === null || !isValidDate(f.birthDate)) return null;
  const profile = { sex: f.sex, birthDate: f.birthDate, heightCm: f.heightCm, ...(f.bodyFatPct !== null ? { bodyFatPct: f.bodyFatPct } : {}) };
  const constraints = toConstraints(f.constraints);
  const bmrKcal = bmr(profile, f.currentWeightKg, today);
  const deficitKcal = dailyDeficit(pace);
  const typicalTargetKcal = typicalTarget(bmrKcal, baseFactor, deficitKcal, constraints);
  const days = Math.ceil(((f.currentWeightKg - f.targetWeightKg) / pace) * 7);
  return {
    bmrKcal,
    deficitKcal,
    typicalTargetKcal,
    macros: macroTargets(f.currentWeightKg, typicalTargetKcal, constraints),
    etaDate: addDays(today, days),
  };
}

export function buildSetup(
  f: SetupForm,
  ctx: { today: string; time: string; goalId: string; previousGoal: Goal | null; previousProfile: Profile | null; latestKg: number | null },
): SetupWrite {
  const weight = f.currentWeightKg!;
  const prev = ctx.previousGoal;
  const prevSettings = ctx.previousProfile?.settings;
  const sameGoal =
    prev !== null &&
    prev.targetWeightKg === f.targetWeightKg &&
    prev.preset === f.preset &&
    (f.preset !== 'custom' || prev.paceKgPerWeek === f.customPaceKgPerWeek);
  const goal = sameGoal
    ? prev
    : makeGoal({
        id: ctx.goalId,
        startDate: ctx.today,
        startWeightKg: weight,
        targetWeightKg: f.targetWeightKg!,
        preset: f.preset,
        ...(f.preset === 'custom' && f.customPaceKgPerWeek !== null ? { customPaceKgPerWeek: f.customPaceKgPerWeek } : {}),
      });
  const constraints = toConstraints(f.constraints);
  const profile: Profile = {
    sex: f.sex,
    birthDate: f.birthDate,
    heightCm: f.heightCm!,
    ...(f.bodyFatPct !== null ? { bodyFatPct: f.bodyFatPct } : {}),
    constraints,
    settings: {
      lowDayThresholdKcal: prevSettings?.lowDayThresholdKcal ?? 800,
      defaultSteps: prevSettings?.defaultSteps ?? 3500,
      missingDayKcal: prevSettings?.missingDayKcal ?? 3200,
      ...(prevSettings?.baseFactor !== undefined ? { baseFactor: prevSettings.baseFactor } : {}),
    },
    activeGoalId: goal.id,
    ...(ctx.previousProfile?.garminLastSyncAt ? { garminLastSyncAt: ctx.previousProfile.garminLastSyncAt } : {}),
  };
  const bmrKcal = bmr(profile, weight, ctx.today);
  const typical = typicalTarget(bmrKcal, settingsOf(profile).baseFactor, goal.dailyDeficitKcal, constraints);
  return {
    profile,
    // The macro plan of a typical day; each day's own plan follows that day's target.
    computed: { bmrKcal, macroTargets: macroTargets(weight, typical, constraints), updatedAt: ctx.today },
    goal,
    previousGoalId: sameGoal ? null : (prev?.id ?? null),
    // Editing without touching the weight must not invent or overwrite a weigh-in.
    weighIn: ctx.previousProfile !== null && weight === ctx.latestKg ? null : { date: ctx.today, kg: weight, time: ctx.time },
  };
}
