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
  planStatus,
  plannedWeight,
  reportGap,
  summarizeDay,
  summarizeWeek,
  trendOn,
  trendSeries,
  weekStart,
} from '../../../../../domain/index.ts';
import type { FirestoreReader } from './firestore.ts';
import { loadData, type KalData } from './load.ts';

export interface Deps {
  reader: FirestoreReader;
  now: Date;
}

function dayOf(d: KalData, date: string) {
  return summarizeDay({
    date,
    entries: d.entries,
    day: d.days.find((x) => x.date === date),
    profile: d.profile,
    goal: d.goal,
    weighIns: d.weighIns,
  });
}

async function profile(deps: Deps, today: string) {
  const from = addDays(today, -GAP_WINDOW_DAYS);
  const d = await loadData(deps.reader, from, today);
  const series = trendSeries(d.weighIns);
  const trendKg = trendOn(series, today) ?? d.goal.startWeightKg;
  const plannedKg = plannedWeight(d.goal, today);
  const energy = dateRange(from, addDays(today, -1)).map((date) => {
    const s = dayOf(d, date);
    return { date, inKcal: s.intake.kcal, outKcal: s.expenditure.out };
  });
  return {
    profile: d.profile,
    goal: d.goal,
    trendKg,
    bmrKcal: bmr(d.profile, trendKg, today),
    macroTargets: macroTargets(trendKg, d.profile.constraints),
    plannedKg,
    status: planStatus(trendKg, plannedKg),
    eta: eta(series, d.goal, today),
    reportGap: reportGap({ today, goal: d.goal, energy, series }),
  };
}

async function week(deps: Deps, date: string, today: string) {
  const start = weekStart(date);
  const d = await loadData(deps.reader, start, addDays(start, 6));
  const w = summarizeWeek({ date, today, entries: d.entries, days: d.days, profile: d.profile, goal: d.goal, weighIns: d.weighIns });
  return {
    ...w,
    days: w.days.map((s) => ({
      date: s.date,
      inKcal: s.intake.kcal,
      outKcal: s.expenditure.out,
      protein: s.intake.protein,
      entries: s.entries.length,
    })),
    missingDays: missingDays(w.start, w.end, today, d.entries, d.profile.settings.lowDayThresholdKcal),
  };
}

async function recipes(deps: Deps, today: string) {
  const d = await loadData(deps.reader, today, today);
  return d.recipes.map((r) => {
    const numbers = computeRecipe(r.ingredients, r.yield);
    return { id: r.id, name: r.name, aliases: r.aliases, yield: r.yield, perUnit: numbers.perUnit, per100g: numbers.per100g };
  });
}

export async function run(args: string[], deps: Deps): Promise<unknown> {
  const [command = 'day', arg] = args;
  if (arg !== undefined && !isValidDate(arg)) throw new Error(`invalid date: ${arg} (use YYYY-MM-DD)`);
  const today = localDate(deps.now);
  const date = arg ?? today;
  switch (command) {
    case 'profile':
      return profile(deps, today);
    case 'day': {
      const d = await loadData(deps.reader, date, date);
      return dayOf(d, date);
    }
    case 'week':
      return week(deps, date, today);
    case 'recipes':
      return recipes(deps, today);
    default:
      throw new Error(`unknown command: ${command}. Use profile | day [date] | week [date] | recipes`);
  }
}
