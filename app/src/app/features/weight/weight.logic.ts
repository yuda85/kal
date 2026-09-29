import {
  dateRange,
  eta,
  reportGap,
  trendSeries,
  weekStart,
  weeklyWeights,
  type DayEnergy,
  type Goal,
  type ReportGap,
  type WeekWeight,
  type WeighIn,
} from '../../domain';
import { shortDate } from '../../shared/format';

export const WEIGHT_WEEKS = 12;
export const CHART_W = 300;
export const CHART_H = 150;
const PLOT = { left: 34, right: CHART_W - 16, top: 26, bottom: 118 };

export interface ChartPoint {
  x: number;
  y: number;
  kg: number;
  label: string;
  changeKg: number | null;
  current: boolean;
}

export interface WeeklyChart {
  points: ChartPoint[];
  /** SVG polyline `points` strings; the line breaks over weeks without weigh-ins. */
  lines: string[];
  ticks: { y: number; kg: number }[];
}

export interface WeightView {
  thisWeek: WeekWeight;
  lastWeek: WeekWeight | null;
  currentKg: number | null;
  startKg: number;
  targetKg: number;
  lostKg: number | null;
  leftKg: number | null;
  /** 0..1 of the way from the start weight to the target. */
  progress: number;
  chart: WeeklyChart;
  days: { date: string; kg: number | null }[];
  eta: string | null;
  gap: ReportGap | null;
}

export function weeklyChart(weeks: WeekWeight[], thisWeekStart: string): WeeklyChart {
  const kgs = weeks.flatMap((w) => (w.meanKg === null ? [] : [w.meanKg]));
  if (kgs.length === 0) return { points: [], lines: [], ticks: [] };
  const max = Math.max(...kgs);
  const min = Math.min(...kgs);
  const mid = (max + min) / 2;
  const half = Math.max(0.5, (max - min) / 2) + 0.2;
  const hi = mid + half;
  const lo = mid - half;
  const y = (kg: number) => PLOT.top + ((hi - kg) / (hi - lo)) * (PLOT.bottom - PLOT.top);
  const x = (i: number) => (weeks.length === 1 ? (PLOT.left + PLOT.right) / 2 : PLOT.left + (i * (PLOT.right - PLOT.left)) / (weeks.length - 1));

  const points: ChartPoint[] = [];
  const lines: string[] = [];
  let run: string[] = [];
  weeks.forEach((w, i) => {
    if (w.meanKg === null) {
      if (run.length > 1) lines.push(run.join(' '));
      run = [];
      return;
    }
    const current = w.start === thisWeekStart;
    const point = { x: x(i), y: y(w.meanKg), kg: w.meanKg, label: current ? 'השבוע' : shortDate(w.start), changeKg: w.changeKg, current };
    points.push(point);
    run.push(`${point.x},${point.y}`);
  });
  if (run.length > 1) lines.push(run.join(' '));
  return { points, lines, ticks: [hi, mid, lo].map((kg) => ({ kg, y: y(kg) })) };
}

export function weightView(input: { today: string; goal: Goal; weighIns: WeighIn[]; energy: DayEnergy[]; lowDayThresholdKcal: number }): WeightView {
  const { today, goal, weighIns } = input;
  const thisStart = weekStart(today);
  const weeks = weeklyWeights(weighIns, goal.startDate < today ? goal.startDate : today, today);
  const currentKg = [...weeks].reverse().find((w) => w.meanKg !== null)?.meanKg ?? null;
  const span = goal.startWeightKg - goal.targetWeightKg;
  const lostKg = currentKg === null ? null : goal.startWeightKg - currentKg;
  const kgByDate = new Map(weighIns.map((w) => [w.date, w.kg]));
  const series = trendSeries(weighIns, today);
  return {
    thisWeek: weeks.at(-1)!,
    lastWeek: weeks.at(-2) ?? null,
    currentKg,
    startKg: goal.startWeightKg,
    targetKg: goal.targetWeightKg,
    lostKg,
    leftKg: currentKg === null ? null : Math.max(0, currentKg - goal.targetWeightKg),
    progress: lostKg === null || span <= 0 ? 0 : Math.min(1, Math.max(0, lostKg / span)),
    chart: weeklyChart(weeks.slice(-WEIGHT_WEEKS), thisStart),
    days: dateRange(thisStart, today).map((date) => ({ date, kg: kgByDate.get(date) ?? null })),
    eta: eta(series, goal, today),
    gap: reportGap({ today, goal, energy: input.energy, series, lowDayThresholdKcal: input.lowDayThresholdKcal }),
  };
}
