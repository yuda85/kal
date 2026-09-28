import {
  addDays,
  dateRange,
  eta,
  plannedWeight,
  reportGap,
  trendOn,
  trendSeries,
  type DayEnergy,
  type Goal,
  type ReportGap,
  type WeighIn,
} from '../../domain';
import { shortDate } from '../../shared/format';

export const WEIGHT_WINDOW_DAYS = 84;

export interface WeightView {
  trendKg: number | null;
  plannedKg: number;
  eta: string | null;
  gap: ReportGap | null;
  labels: string[];
  trend: (number | null)[];
  plan: number[];
  target: number[];
  points: (number | null)[];
}

export function weightView(input: { today: string; goal: Goal; weighIns: WeighIn[]; energy: DayEnergy[]; lowDayThresholdKcal: number }): WeightView {
  const { today, goal } = input;
  const series = trendSeries(input.weighIns);
  const dates = dateRange(addDays(today, -(WEIGHT_WINDOW_DAYS - 1)), today);
  const trendByDate = new Map(series.map((p) => [p.date, p.kg]));
  const kgByDate = new Map(input.weighIns.map((w) => [w.date, w.kg]));
  const trendKg = trendOn(series, today);
  const plannedKg = plannedWeight(goal, today);
  return {
    trendKg,
    plannedKg,
    eta: eta(series, goal, today),
    gap: reportGap({ today, goal, energy: input.energy, series, lowDayThresholdKcal: input.lowDayThresholdKcal }),
    labels: dates.map(shortDate),
    trend: dates.map((d) => trendByDate.get(d) ?? null),
    plan: dates.map((d) => plannedWeight(goal, d)),
    target: dates.map(() => goal.targetWeightKg),
    points: dates.map((d) => kgByDate.get(d) ?? null),
  };
}
