import { dateRange } from './dates.ts';
import type { WeighIn } from './types.ts';

export const TREND_ALPHA = 0.1;

export interface TrendPoint {
  date: string;
  kg: number;
  /** No weigh-in that day: the day counts the previous weight. */
  carried?: boolean;
}

/**
 * EWMA over one weight per day, from the first weigh-in to `until` (or the last weigh-in).
 * A day without a weigh-in carries the previous weight, so gaps do not stall the trend. Carried weights are computed, never written.
 */
export function trendSeries(weighIns: WeighIn[], until?: string): TrendPoint[] {
  const kgByDate = new Map([...weighIns].sort((a, b) => a.date.localeCompare(b.date)).map((w) => [w.date, w.kg]));
  const dates = [...kgByDate.keys()];
  if (dates.length === 0) return [];
  const last = dates.at(-1)!;
  let kg = kgByDate.get(dates[0])!;
  let trend = kg;
  return dateRange(dates[0], until !== undefined && until > last ? until : last).map((date) => {
    const weighed = kgByDate.get(date);
    if (weighed !== undefined) kg = weighed;
    trend += TREND_ALPHA * (kg - trend);
    return weighed === undefined ? { date, kg: trend, carried: true } : { date, kg: trend };
  });
}

export function trendOn(series: TrendPoint[], date: string): number | null {
  let result: number | null = null;
  for (const point of series) {
    if (point.date > date) break;
    result = point.kg;
  }
  return result;
}

/** The weight that counts for a date: its own weigh-in, or the latest one before it, carried. */
export function weightOn(weighIns: WeighIn[], date: string): { kg: number; carried: boolean } | null {
  let latest: WeighIn | null = null;
  for (const w of weighIns) if (w.date <= date && (latest === null || w.date > latest.date)) latest = w;
  return latest === null ? null : { kg: latest.kg, carried: latest.date !== date };
}
