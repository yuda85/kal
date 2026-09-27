import type { WeighIn } from './types.ts';

export const TREND_ALPHA = 0.1;

export interface TrendPoint {
  date: string;
  kg: number;
}

export function trendSeries(weighIns: WeighIn[], alpha = TREND_ALPHA): TrendPoint[] {
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const out: TrendPoint[] = [];
  let trend: number | undefined;
  for (const w of sorted) {
    trend = trend === undefined ? w.kg : trend + alpha * (w.kg - trend);
    out.push({ date: w.date, kg: trend });
  }
  return out;
}

export function trendOn(series: TrendPoint[], date: string): number | null {
  let result: number | null = null;
  for (const point of series) {
    if (point.date > date) break;
    result = point.kg;
  }
  return result;
}
