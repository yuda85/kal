import type { DayEnergy } from './checks.ts';
import { addDays, daysBetween } from './dates.ts';
import { KCAL_PER_KG } from './targets.ts';
import { trendOn, trendSeries } from './trend.ts';
import type { Goal, WeighIn } from './types.ts';

export const REALITY_WINDOW_DAYS = 14;
export const REALITY_MIN_WEIGHINS = 4;

export type RealityStatus = 'no_data' | 'gaining' | 'stalled' | 'on_track';

export interface Reality {
  from: string;
  to: string;
  weighInCount: number;
  status: RealityStatus;
  trendChangeKg: number | null;
  plannedChangeKg: number;
  loggedDeficitKcal: number | null;
  weightDeficitKcal: number | null;
}

export function realityCheck(input: { today: string; goal: Goal; weighIns: WeighIn[]; energy: DayEnergy[] }): Reality {
  const to = input.today;
  const from = addDays(to, -(REALITY_WINDOW_DAYS - 1));
  const weighInCount = input.weighIns.filter((w) => w.date >= from && w.date <= to).length;
  const series = trendSeries(input.weighIns);
  const before = trendOn(series, addDays(from, -1));
  const firstInWindow = series.find((p) => p.date >= from && p.date <= to);
  const startKg = before ?? firstInWindow?.kg ?? null;
  const startDate = before !== null ? addDays(from, -1) : (firstInWindow?.date ?? to);
  const endKg = trendOn(series, to);
  const trendChangeKg = startKg !== null && endKg !== null && weighInCount > 0 ? endKg - startKg : null;
  // The goal pace over the window until the trend reaches the target (the plan line itself is flat on its first days and after its end).
  const plannedChangeKg = endKg !== null && endKg <= input.goal.targetWeightKg ? 0 : (-input.goal.paceKgPerWeek * REALITY_WINDOW_DAYS) / 7;
  const span = daysBetween(startDate, to);
  const energy = input.energy.filter((e) => e.date >= from && e.date < to && e.date >= input.goal.startDate);
  const loggedDeficitKcal = energy.length === 0 ? null : energy.reduce((s, e) => s + (e.outKcal - e.inKcal), 0) / energy.length;
  const weightDeficitKcal = trendChangeKg === null || span <= 0 ? null : (-trendChangeKg * KCAL_PER_KG) / span;
  let status: RealityStatus;
  if (weighInCount < REALITY_MIN_WEIGHINS || trendChangeKg === null) status = 'no_data';
  else if (trendChangeKg > 0.1) status = 'gaining';
  else if (plannedChangeKg < 0 && trendChangeKg > plannedChangeKg * 0.5) status = 'stalled';
  else status = 'on_track';
  return { from, to, weighInCount, status, trendChangeKg, plannedChangeKg, loggedDeficitKcal, weightDeficitKcal };
}
