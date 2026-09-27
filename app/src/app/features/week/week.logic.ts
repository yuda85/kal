import { ENTRY_WINDOW_DAYS } from '../../core/kal-state';
import { addDays, dateRange, missingDays, summarizeWeek, type WeekInput, type WeekSummary } from '../../domain';
import { dayLetter, shortDate } from '../../shared/format';

export interface WeekView {
  summary: WeekSummary;
  missing: string[];
  labels: string[];
  inKcal: (number | null)[];
  outKcal: (number | null)[];
  missingIdx: number[];
}

/** Entries older than the loaded window are not in memory, so older weeks would look empty. */
export function canGoBack(weekStartDate: string, today: string): boolean {
  return addDays(weekStartDate, -7) >= addDays(today, -ENTRY_WINDOW_DAYS);
}

export function weekView(input: WeekInput): WeekView {
  const summary = summarizeWeek(input);
  const from = summary.start > input.goal.startDate ? summary.start : input.goal.startDate;
  const missing = missingDays(from, summary.end, input.today, input.entries, input.profile.settings.lowDayThresholdKcal);
  const dates = dateRange(summary.start, summary.end);
  const byDate = new Map(summary.days.map((d) => [d.date, d]));
  return {
    summary,
    missing,
    labels: dates.map((d) => `${dayLetter(d)} ${shortDate(d)}`),
    inKcal: dates.map((d) => byDate.get(d)?.intake.kcal ?? null),
    outKcal: dates.map((d) => byDate.get(d)?.expenditure.out ?? null),
    missingIdx: dates.flatMap((d, i) => (missing.includes(d) ? [i] : [])),
  };
}
