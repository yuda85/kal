import { bmr } from './bmr.ts';
import { addDays, dateRange, weekStart } from './dates.ts';
import { expenditure, kcalPerStep, type Expenditure } from './expenditure.ts';
import { plannedWeight } from './plan.ts';
import { settingsOf } from './settings.ts';
import { macroTargets } from './targets.ts';
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

export interface WeekInput {
  date: string;
  today: string;
  entries: Entry[];
  days: Day[];
  profile: Profile;
  goal: Goal;
  weighIns: WeighIn[];
}

export interface WeekSummary {
  start: string;
  end: string;
  days: DaySummary[];
  daysLogged: number;
  avgInKcal: number | null;
  avgOutKcal: number | null;
  avgDeficitKcal: number | null;
  targetDeficitKcal: number;
  avgProtein: number | null;
  trendChangeKg: number | null;
  plannedChangeKg: number;
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

export function summarizeWeek(input: WeekInput): WeekSummary {
  const start = weekStart(input.date);
  const end = addDays(start, 6);
  const dayByDate = new Map(input.days.map((d) => [d.date, d]));
  const dates = dateRange(start, end).filter((d) => d <= input.today);
  const days = dates.map((date) =>
    summarizeDay({
      date,
      entries: input.entries,
      day: dayByDate.get(date),
      profile: input.profile,
      goal: input.goal,
      weighIns: input.weighIns,
    }),
  );
  const threshold = input.profile.settings.lowDayThresholdKcal;
  const logged = days.filter((d) => d.date < input.today && d.intake.kcal >= threshold);
  const lastDate = dates.at(-1) ?? start;
  const series = trendSeries(input.weighIns);
  const weighedThisWeek = input.weighIns.some((w) => w.date >= start && w.date <= lastDate);
  const trendEnd = weighedThisWeek ? trendOn(series, lastDate) : null;
  const trendStart = trendOn(series, addDays(start, -1));
  return {
    start,
    end,
    days,
    daysLogged: logged.length,
    avgInKcal: average(logged.map((d) => d.intake.kcal)),
    avgOutKcal: average(logged.map((d) => d.expenditure.out)),
    avgDeficitKcal: average(logged.map((d) => d.expenditure.out - d.intake.kcal)),
    targetDeficitKcal: input.goal.dailyDeficitKcal,
    avgProtein: average(logged.map((d) => d.intake.protein)),
    trendChangeKg: trendEnd !== null && trendStart !== null ? trendEnd - trendStart : null,
    plannedChangeKg: plannedWeight(input.goal, lastDate) - plannedWeight(input.goal, addDays(start, -1)),
  };
}
