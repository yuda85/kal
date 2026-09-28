import { bmr } from './bmr.ts';
import { addDays, dateRange, daysBetween, weekStart } from './dates.ts';
import { expenditure, kcalPerStep, type Expenditure } from './expenditure.ts';
import { plannedWeight } from './plan.ts';
import { settingsOf } from './settings.ts';
import { KCAL_PER_KG, macroTargets } from './targets.ts';
import { trendOn, trendSeries } from './trend.ts';
import type { Day, Entry, Goal, Profile, Range, WeighIn } from './types.ts';

export type MacroKey = 'kcal' | 'protein' | 'carbs' | 'fat';

export interface Warning {
  code: 'over_max' | 'below_bmr';
  macro?: MacroKey;
  value: number;
  limit: number;
}

export interface Intake {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  kcalWithoutMacros: number;
}

export interface MacroLine {
  value: number;
  target: number | null;
  min: number | null;
  max: number | null;
}

export interface DaySummary {
  date: string;
  entries: Entry[];
  intake: Intake;
  expenditure: Expenditure;
  trendKg: number;
  deficitKcal: number;
  targetKcal: number;
  remainingKcal: number;
  macros: Record<MacroKey, MacroLine>;
  warnings: Warning[];
  imputed: boolean;
  countedKcal: number;
}

export interface DayInput {
  date: string;
  entries: Entry[];
  day?: Day;
  profile: Profile;
  goal: Goal;
  weighIns: WeighIn[];
  today?: string;
}

const MACRO_KEYS: MacroKey[] = ['kcal', 'protein', 'carbs', 'fat'];

export function sumIntake(entries: Entry[]): Intake {
  const t: Intake = { kcal: 0, protein: 0, carbs: 0, fat: 0, kcalWithoutMacros: 0 };
  for (const e of entries) {
    t.kcal += e.kcal;
    t.protein += e.protein ?? 0;
    t.carbs += e.carbs ?? 0;
    t.fat += e.fat ?? 0;
    if (e.protein === null && e.carbs === null && e.fat === null) t.kcalWithoutMacros += e.kcal;
  }
  return t;
}

function line(value: number, target: number | null, range: Range | undefined): MacroLine {
  return { value, target, min: range?.min ?? null, max: range?.max ?? null };
}

export function summarizeDay(input: DayInput): DaySummary {
  const { date, profile, goal } = input;
  const settings = settingsOf(profile);
  const entries = input.entries.filter((e) => e.date === date).sort((a, b) => a.time.localeCompare(b.time));
  const trendKg = trendOn(trendSeries(input.weighIns), date) ?? goal.startWeightKg;
  const bmrKcal = bmr(profile, trendKg, date);
  const exp = expenditure(input.day, {
    weightKg: trendKg,
    heightCm: profile.heightCm,
    bmrKcal,
    defaultSteps: settings.defaultSteps,
  });
  const c = profile.constraints;
  const targetKcal = Math.min(
    Math.max(exp.out - goal.dailyDeficitKcal, c.kcal?.min ?? Number.NEGATIVE_INFINITY),
    c.kcal?.max ?? Number.POSITIVE_INFINITY,
  );
  const intake = sumIntake(entries);
  const targets = macroTargets(trendKg, c);
  const macros: Record<MacroKey, MacroLine> = {
    kcal: line(intake.kcal, targetKcal, c.kcal),
    protein: line(intake.protein, targets.protein, c.protein),
    carbs: line(intake.carbs, targets.carbs, c.carbs),
    fat: line(intake.fat, targets.fat, c.fat),
  };
  const warnings: Warning[] = [];
  for (const key of MACRO_KEYS) {
    const m = macros[key];
    if (m.max !== null && m.value > m.max) warnings.push({ code: 'over_max', macro: key, value: m.value, limit: m.max });
  }
  // Judge the goal on a typical day (default steps, no workout), not on the partial day.
  const typicalTarget = bmrKcal + kcalPerStep(trendKg, profile.heightCm) * settings.defaultSteps - goal.dailyDeficitKcal;
  if (typicalTarget < 0.75 * bmrKcal) warnings.push({ code: 'below_bmr', value: typicalTarget, limit: bmrKcal });
  // A finished day without enough food counts as the missing-day penalty.
  const imputed =
    input.today !== undefined && date < input.today && date >= goal.startDate && intake.kcal < settings.lowDayThresholdKcal;
  return {
    date,
    entries,
    intake,
    expenditure: exp,
    trendKg,
    deficitKcal: goal.dailyDeficitKcal,
    targetKcal,
    remainingKcal: targetKcal - intake.kcal,
    imputed,
    countedKcal: imputed ? settings.missingDayKcal : intake.kcal,
    macros,
    warnings,
  };
}

export interface RangeInput {
  today: string;
  entries: Entry[];
  days: Day[];
  profile: Profile;
  goal: Goal;
  weighIns: WeighIn[];
}

export interface RangeSummary {
  start: string;
  end: string;
  days: DaySummary[];
  daysLogged: number;
  imputedDays: number;
  avgInKcal: number | null;
  avgOutKcal: number | null;
  avgDeficitKcal: number | null;
  avgProtein: number | null;
  workoutsCount: number;
  trendChangeKg: number | null;
  weightDeficitKcal: number | null;
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

function summarizeRange(start: string, end: string, input: RangeInput): RangeSummary {
  const dayByDate = new Map(input.days.map((d) => [d.date, d]));
  const dates = dateRange(start, end).filter((d) => d <= input.today);
  const days = dates.map((date) =>
    summarizeDay({
      date,
      today: input.today,
      entries: input.entries,
      day: dayByDate.get(date),
      profile: input.profile,
      goal: input.goal,
      weighIns: input.weighIns,
    }),
  );
  const finished = days.filter((d) => d.date < input.today && d.date >= input.goal.startDate);
  const logged = finished.filter((d) => !d.imputed);
  const lastDate = dates.at(-1) ?? start;
  const series = trendSeries(input.weighIns);
  const weighedInRange = input.weighIns.some((w) => w.date >= start && w.date <= lastDate);
  const trendEnd = weighedInRange ? trendOn(series, lastDate) : null;
  const before = trendOn(series, addDays(start, -1));
  // Without a trend point before the range, measure from the first of at least two weigh-ins inside it.
  const inRange = series.filter((p) => p.date >= start && p.date <= lastDate);
  const from = before !== null ? { date: addDays(start, -1), kg: before } : inRange.length > 1 ? inRange[0] : null;
  const span = from ? daysBetween(from.date, lastDate) : 0;
  const trendChangeKg = trendEnd !== null && from !== null && span > 0 ? trendEnd - from.kg : null;
  return {
    start,
    end,
    days,
    daysLogged: logged.length,
    imputedDays: finished.length - logged.length,
    avgInKcal: average(finished.map((d) => d.countedKcal)),
    avgOutKcal: average(finished.map((d) => d.expenditure.out)),
    avgDeficitKcal: average(finished.map((d) => d.expenditure.out - d.countedKcal)),
    avgProtein: average(logged.map((d) => d.intake.protein)),
    workoutsCount: days.reduce((n, d) => n + d.expenditure.workouts.length, 0),
    trendChangeKg,
    weightDeficitKcal: trendChangeKg === null || span <= 0 ? null : (-trendChangeKg * KCAL_PER_KG) / span,
  };
}

export interface WeekInput extends RangeInput {
  date: string;
}

export interface WeekSummary extends RangeSummary {
  targetDeficitKcal: number;
  plannedChangeKg: number;
}

export function summarizeWeek(input: WeekInput): WeekSummary {
  const start = weekStart(input.date);
  const range = summarizeRange(start, addDays(start, 6), input);
  const lastDate = range.days.at(-1)?.date ?? start;
  return {
    ...range,
    targetDeficitKcal: input.goal.dailyDeficitKcal,
    plannedChangeKg: plannedWeight(input.goal, lastDate) - plannedWeight(input.goal, addDays(start, -1)),
  };
}

export interface MonthInput extends RangeInput {
  month: string;
}

export interface MonthSummary extends RangeSummary {
  month: string;
  workoutsPerWeek: number | null;
}

export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function summarizeMonth(input: MonthInput): MonthSummary {
  const range = summarizeRange(`${input.month}-01`, monthEnd(input.month), input);
  const elapsed = range.days.length;
  return { ...range, month: input.month, workoutsPerWeek: elapsed === 0 ? null : (range.workoutsCount * 7) / elapsed };
}
