import { dateRange, missingDays, summarizeWeek, type WeekInput, type WeekSummary } from '../../domain';
import { dayLetter, shortDate } from '../../shared/format';

export interface WeekView {
  summary: WeekSummary;
  missing: string[];
  labels: string[];
  inKcal: (number | null)[];
  outKcal: (number | null)[];
  missingIdx: number[];
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
