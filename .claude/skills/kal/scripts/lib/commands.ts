import {
  addDays,
  bmr,
  computeRecipe,
  dateRange,
  eta,
  GAP_WINDOW_DAYS,
  isValidDate,
  localDate,
  macroTargets,
  missingDays,
  monthEnd,
  plannedWeight,
  REALITY_WINDOW_DAYS,
  realityCheck,
  reportGap,
  settingsOf,
  summarizeDay,
  summarizeMonth,
  summarizeWeek,
  trendOn,
  trendSeries,
  typicalTarget,
  weekStart,
  type DaySummary,
} from '../../../../../domain/index.ts';
import type { FirestoreReader } from './firestore.ts';
import { loadData, type KalData } from './load.ts';

export interface Deps {
  reader: FirestoreReader;
  now: Date;
}

function dayOf(d: KalData, date: string, today: string) {
  return summarizeDay({
    date,
    today,
    entries: d.entries,
    day: d.days.find((x) => x.date === date),
    profile: d.profile,
    goal: d.goal,
    weighIns: d.weighIns,
  });
}

function row(s: DaySummary) {
  return {
    date: s.date,
    inKcal: s.intake.kcal,
    countedKcal: s.countedKcal,
    imputed: s.imputed,
    outKcal: s.expenditure.out,
    protein: s.intake.protein,
    entries: s.entries.length,
    workouts: s.expenditure.workouts.map((w) => w.type),
    stepsEntered: s.expenditure.stepsSource !== 'default',
    weighedIn: s.weighedIn,
  };
}

async function profile(deps: Deps, today: string) {
  const from = addDays(today, -Math.max(GAP_WINDOW_DAYS, REALITY_WINDOW_DAYS));
  const d = await loadData(deps.reader, from, today);
  const series = trendSeries(d.weighIns, today);
  const trendKg = trendOn(series, today) ?? d.goal.startWeightKg;
  const bmrKcal = bmr(d.profile, trendKg, today);
  const typicalTargetKcal = typicalTarget(bmrKcal, settingsOf(d.profile).baseFactor, d.goal.dailyDeficitKcal, d.profile.constraints);
  const plannedKg = plannedWeight(d.goal, today);
  const energy = dateRange(from, addDays(today, -1)).map((date) => {
    const s = dayOf(d, date, today);
    return { date, inKcal: s.countedKcal, outKcal: s.expenditure.out };
  });
  return {
    profile: d.profile,
    goal: d.goal,
    trendKg,
    bmrKcal,
    typicalTargetKcal,
    macroTargets: macroTargets(trendKg, typicalTargetKcal, d.profile.constraints),
    plannedKg,
    eta: eta(series, d.goal, today),
    reality: realityCheck({ today, goal: d.goal, weighIns: d.weighIns, energy }),
    reportGap: reportGap({ today, goal: d.goal, energy, series, lowDayThresholdKcal: d.profile.settings.lowDayThresholdKcal }),
  };
}

async function week(deps: Deps, date: string, today: string) {
  const start = weekStart(date);
  const d = await loadData(deps.reader, start, addDays(start, 6));
  const w = summarizeWeek({ date, today, entries: d.entries, days: d.days, profile: d.profile, goal: d.goal, weighIns: d.weighIns });
  return {
    ...w,
    days: w.days.map(row),
    missingDays: missingDays(
      w.start > d.goal.startDate ? w.start : d.goal.startDate,
      w.end,
      today,
      d.entries,
      d.profile.settings.lowDayThresholdKcal,
    ),
  };
}

async function month(deps: Deps, month: string, today: string) {
  const end = monthEnd(month);
  const d = await loadData(deps.reader, `${month}-01`, today < end ? today : end);
  const m = summarizeMonth({ month, today, entries: d.entries, days: d.days, profile: d.profile, goal: d.goal, weighIns: d.weighIns });
  return { ...m, days: m.days.map(row) };
}

async function recipes(deps: Deps, today: string) {
  const d = await loadData(deps.reader, today, today);
  return d.recipes.map((r) => {
    const numbers = computeRecipe(r.ingredients, r.yield);
    return { id: r.id, name: r.name, aliases: r.aliases, ingredients: r.ingredients, yield: r.yield, perUnit: numbers.perUnit, per100g: numbers.per100g };
  });
}

export async function run(args: string[], deps: Deps): Promise<unknown> {
  const [command = 'day', arg] = args;
  const today = localDate(deps.now);
  if (command === 'month') {
    const m = arg ?? today.slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new Error(`invalid month: ${m} (use YYYY-MM)`);
    return month(deps, m, today);
  }
  if (arg !== undefined && !isValidDate(arg)) throw new Error(`invalid date: ${arg} (use YYYY-MM-DD)`);
  const date = arg ?? today;
  switch (command) {
    case 'profile':
      return profile(deps, today);
    case 'day': {
      const d = await loadData(deps.reader, date, date);
      return dayOf(d, date, today);
    }
    case 'week':
      return week(deps, date, today);
    case 'recipes':
      return recipes(deps, today);
    default:
      throw new Error(`unknown command: ${command}. Use profile | day [date] | week [date] | month [YYYY-MM] | recipes`);
  }
}
