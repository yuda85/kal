import {
  addDays,
  currentWeight,
  dateRange,
  eta,
  meanWeight,
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
import { dayLetter, fmt, shortDate, signedKg } from '../../shared/format';

export const WEIGHT_WEEKS = 12;
export const CHART_W = 300;
export const CHART_H = 150;
const PLOT = { left: 34, right: CHART_W - 16, top: 26, bottom: 118 };

export interface ChartPoint {
  x: number;
  y: number;
  kg: number;
  /** Week start or day: the slot's date. */
  key: string;
  label: string;
  /** Text above the point: the week's change, or the day's weight. */
  note: string | null;
  current: boolean;
}

export interface LineChart {
  points: ChartPoint[];
  /** SVG polyline `points` strings; the line breaks over slots without weigh-ins. */
  lines: string[];
  ticks: { y: number; kg: number }[];
  /** Axis labels: under each point, or under every slot when `allLabels`. */
  labels: { x: number; text: string; current: boolean }[];
  /** Horizontal distance between slots: the width of a slot's tap area. */
  slot: number;
  mean: { y: number; kg: number } | null;
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
  /** Week start the chart is zoomed into, or null for the weekly chart. */
  selectedWeek: string | null;
  chart: LineChart;
  days: { date: string; kg: number | null }[];
  eta: string | null;
  gap: ReportGap | null;
}

interface Slot {
  key: string;
  label: string;
  kg: number | null;
  note: string | null;
  current: boolean;
}

function lineChart(slots: Slot[], meanKg: number | null = null, allLabels = false): LineChart {
  const kgs = slots.flatMap((s) => (s.kg === null ? [] : [s.kg]));
  const slot = slots.length === 1 ? PLOT.right - PLOT.left : (PLOT.right - PLOT.left) / (slots.length - 1);
  if (kgs.length === 0) return { points: [], lines: [], ticks: [], labels: [], slot, mean: null };
  const max = Math.max(...kgs);
  const min = Math.min(...kgs);
  const mid = (max + min) / 2;
  const half = Math.max(0.5, (max - min) / 2) + 0.2;
  const hi = mid + half;
  const lo = mid - half;
  const y = (kg: number) => PLOT.top + ((hi - kg) / (hi - lo)) * (PLOT.bottom - PLOT.top);
  const x = (i: number) => (slots.length === 1 ? (PLOT.left + PLOT.right) / 2 : PLOT.left + i * slot);

  const points: ChartPoint[] = [];
  const lines: string[] = [];
  let run: string[] = [];
  slots.forEach((s, i) => {
    if (s.kg === null) {
      if (run.length > 1) lines.push(run.join(' '));
      run = [];
      return;
    }
    const point = { x: x(i), y: y(s.kg), kg: s.kg, key: s.key, label: s.label, note: s.note, current: s.current };
    points.push(point);
    run.push(`${point.x},${point.y}`);
  });
  if (run.length > 1) lines.push(run.join(' '));
  return {
    points,
    lines,
    ticks: [hi, mid, lo].map((kg) => ({ kg, y: y(kg) })),
    labels: slots.flatMap((s, i) => (allLabels || s.kg !== null ? [{ x: x(i), text: s.label, current: s.current }] : [])),
    slot,
    mean: meanKg === null ? null : { kg: meanKg, y: y(meanKg) },
  };
}

export function weekTitle(start: string, thisWeekStart: string): string {
  return start === thisWeekStart ? 'השבוע' : `שבוע ${shortDate(start)}`;
}

export function weeklyChart(weeks: WeekWeight[], thisWeekStart: string): LineChart {
  return lineChart(
    weeks.map((w) => {
      const current = w.start === thisWeekStart;
      return {
        key: w.start,
        label: current ? 'השבוע' : shortDate(w.start),
        kg: w.meanKg,
        note: w.changeKg === null ? null : signedKg(w.changeKg),
        current,
      };
    }),
  );
}

/** One slot per day of the week from `start` (Sunday to Saturday), with the week's mean as a line. */
export function dayChart(weighIns: WeighIn[], start: string, today: string): LineChart {
  const end = addDays(start, 6);
  const kgByDate = new Map(weighIns.map((w) => [w.date, w.kg]));
  return lineChart(
    dateRange(start, end).map((date) => {
      const kg = kgByDate.get(date) ?? null;
      return { key: date, label: dayLetter(date), kg, note: kg === null ? null : fmt(kg, 1), current: date === today };
    }),
    meanWeight(weighIns, start, end < today ? end : today),
    true,
  );
}

export function weightView(input: {
  today: string;
  goal: Goal;
  weighIns: WeighIn[];
  energy: DayEnergy[];
  lowDayThresholdKcal: number;
  /** Week start to zoom into; omitted for the weekly chart. */
  week?: string | null;
}): WeightView {
  const { today, goal, weighIns } = input;
  const thisStart = weekStart(today);
  const selectedWeek = input.week ?? null;
  const daysStart = selectedWeek ?? thisStart;
  const daysEnd = addDays(daysStart, 6);
  const from = goal.startDate < today ? goal.startDate : today;
  const weeks = weeklyWeights(weighIns, from, today);
  const currentKg = currentWeight(weighIns, from, today);
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
    selectedWeek,
    chart: selectedWeek === null ? weeklyChart(weeks.slice(-WEIGHT_WEEKS), thisStart) : dayChart(weighIns, selectedWeek, today),
    days: dateRange(daysStart, daysEnd < today ? daysEnd : today).map((date) => ({ date, kg: kgByDate.get(date) ?? null })),
    eta: eta(series, goal, today),
    gap: reportGap({ today, goal, energy: input.energy, series, lowDayThresholdKcal: input.lowDayThresholdKcal }),
  };
}
