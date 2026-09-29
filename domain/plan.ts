import { addDays, daysBetween } from './dates.ts';
import type { TrendPoint } from './trend.ts';
import type { Goal } from './types.ts';

export type PlanStatus = 'on_track' | 'ahead' | 'behind';

export const PLAN_TOLERANCE_KG = 0.5;
export const ETA_WINDOW_DAYS = 28;
export const ETA_MIN_POINTS = 14;

export function plannedWeight(goal: Goal, date: string): number {
  const planned = goal.startWeightKg - (goal.paceKgPerWeek * daysBetween(goal.startDate, date)) / 7;
  return Math.min(goal.startWeightKg, Math.max(goal.targetWeightKg, planned));
}

export function planStatus(trendKg: number, plannedKg: number): PlanStatus {
  if (Math.abs(trendKg - plannedKg) <= PLAN_TOLERANCE_KG) return 'on_track';
  return trendKg < plannedKg ? 'ahead' : 'behind';
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function eta(series: TrendPoint[], goal: Goal, today: string): string | null {
  const from = addDays(today, -ETA_WINDOW_DAYS);
  const points = series.filter((p) => p.date > from && p.date <= today);
  // Enough real weigh-ins, not carried days.
  if (points.filter((p) => !p.carried).length < ETA_MIN_POINTS) return null;
  const last = points[points.length - 1];
  if (last.kg <= goal.targetWeightKg) return last.date;
  const xs = points.map((p) => daysBetween(points[0].date, p.date));
  const ys = points.map((p) => p.kg);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < points.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  if (slope >= 0) return null;
  const days = (goal.targetWeightKg - last.kg) / slope;
  return addDays(last.date, Math.ceil(Math.round(days * 1e6) / 1e6));
}
