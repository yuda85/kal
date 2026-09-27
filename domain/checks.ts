import { addDays, dateRange, daysBetween } from './dates.ts';
import { KCAL_PER_KG } from './targets.ts';
import { trendOn, type TrendPoint } from './trend.ts';
import type { Entry, Goal } from './types.ts';

export function kcalByDate(entries: Entry[]): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const e of entries) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.kcal);
  return byDate;
}

export function missingDays(from: string, to: string, today: string, entries: Entry[], thresholdKcal: number): string[] {
  const byDate = kcalByDate(entries);
  return dateRange(from, to).filter((d) => d < today && (byDate.get(d) ?? 0) < thresholdKcal);
}

export const GAP_WINDOW_DAYS = 14;
export const GAP_SKIP_DAYS = 14;
export const GAP_MIN_DAYS = 7;
export const GAP_ALERT_KCAL = 300;

export interface DayEnergy {
  date: string;
  inKcal: number;
  outKcal: number;
}

export interface ReportGap {
  from: string;
  to: string;
  expectedChangeKg: number;
  actualChangeKg: number;
  gapKcalPerDay: number;
  incompleteDays: number;
  alert: boolean;
}

export interface ReportGapInput {
  today: string;
  goal: Goal;
  energy: DayEnergy[];
  series: TrendPoint[];
  lowDayThresholdKcal: number;
}

export function reportGap(input: ReportGapInput): ReportGap | null {
  const to = addDays(input.today, -1);
  const windowStart = addDays(input.today, -GAP_WINDOW_DAYS);
  const earliest = addDays(input.goal.startDate, GAP_SKIP_DAYS);
  const from = windowStart > earliest ? windowStart : earliest;
  const days = daysBetween(from, to) + 1;
  if (days < GAP_MIN_DAYS) return null;

  const trendStart = trendOn(input.series, addDays(from, -1));
  const trendEnd = trendOn(input.series, to);
  if (trendStart === null || trendEnd === null) return null;

  const energyByDate = new Map(input.energy.map((e) => [e.date, e]));
  let net = 0;
  let incompleteDays = 0;
  for (const date of dateRange(from, to)) {
    const e = energyByDate.get(date);
    if (!e) return null;
    net += e.inKcal - e.outKcal;
    if (e.inKcal < input.lowDayThresholdKcal) incompleteDays += 1;
  }

  const expectedChangeKg = net / KCAL_PER_KG;
  const actualChangeKg = trendEnd - trendStart;
  const gapKcalPerDay = ((actualChangeKg - expectedChangeKg) * KCAL_PER_KG) / days;
  // Unlogged days are already reported by missingDays; alert only on fully logged windows.
  const alert = incompleteDays === 0 && gapKcalPerDay > GAP_ALERT_KCAL;
  return { from, to, expectedChangeKg, actualChangeKg, gapKcalPerDay, incompleteDays, alert };
}
