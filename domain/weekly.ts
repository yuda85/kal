import { addDays, daysBetween, weekStart } from './dates.ts';
import type { WeighIn } from './types.ts';

function inRange(weighIns: WeighIn[], from: string, to: string): WeighIn[] {
  return weighIns.filter((w) => w.date >= from && w.date <= to);
}

/** Mean of the real weigh-ins from `from` to `to` (carried weights never count), or null without one. */
export function meanWeight(weighIns: WeighIn[], from: string, to: string): number | null {
  const kgs = inRange(weighIns, from, to).map((w) => w.kg);
  return kgs.length === 0 ? null : kgs.reduce((a, b) => a + b, 0) / kgs.length;
}

/** The range's mean (up to today) minus the mean of the previous range of the same length. */
export function weightChange(weighIns: WeighIn[], start: string, end: string, today: string): number | null {
  const length = daysBetween(start, end) + 1;
  const now = meanWeight(weighIns, start, end < today ? end : today);
  const before = meanWeight(weighIns, addDays(start, -length), addDays(start, -1));
  return now === null || before === null ? null : now - before;
}

export interface WeekWeight {
  /** Sunday. */
  start: string;
  meanKg: number | null;
  count: number;
  changeKg: number | null;
}

/** One row per week, Sunday to Saturday, from the week of `from` to this week. */
export function weeklyWeights(weighIns: WeighIn[], from: string, today: string): WeekWeight[] {
  const weeks: WeekWeight[] = [];
  for (let start = weekStart(from); start <= today; start = addDays(start, 7)) {
    const end = addDays(start, 6);
    const last = end < today ? end : today;
    weeks.push({
      start,
      meanKg: meanWeight(weighIns, start, last),
      count: inRange(weighIns, start, last).length,
      changeKg: weightChange(weighIns, start, end, today),
    });
  }
  return weeks;
}
