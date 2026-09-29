import { ENTRY_WINDOW_DAYS } from '../../core/kal-state';
import { addDays, dateRange, summarizeMonth, summarizeWeek, type DaySummary, type MonthInput, type MonthSummary, type WeekInput, type WeekSummary } from '../../domain';
import { dayLetter, shortDate } from '../../shared/format';

export type MissingInput = 'steps' | 'weight';

export interface WeekRow {
  date: string;
  label: string;
  types: string[];
  net: number;
  imputed: boolean;
  /** What a finished day still lacks (steps, a real weigh-in), so the owner can send it later. */
  missing: MissingInput[];
}

export interface WeekView {
  summary: WeekSummary;
  rows: WeekRow[];
  labels: string[];
  inKcal: (number | null)[];
  outKcal: (number | null)[];
  imputedIdx: number[];
}

function rowOf(d: DaySummary, finished: boolean): WeekRow {
  const missing: MissingInput[] = [];
  if (finished && d.expenditure.stepsSource === 'default') missing.push('steps');
  if (finished && !d.weighedIn) missing.push('weight');
  return {
    date: d.date,
    label: `${dayLetter(d.date)} ${shortDate(d.date)}`,
    types: d.expenditure.workouts.map((w) => w.type),
    net: d.countedKcal - d.expenditure.out,
    imputed: d.imputed,
    missing,
  };
}

/** Entries older than the loaded window are not in memory, so older weeks would look empty. */
export function canGoBack(weekStartDate: string, today: string): boolean {
  return addDays(weekStartDate, -7) >= addDays(today, -ENTRY_WINDOW_DAYS);
}

export function weekView(input: WeekInput): WeekView {
  const summary = summarizeWeek(input);
  const dates = dateRange(summary.start, summary.end);
  const byDate = new Map(summary.days.map((d) => [d.date, d]));
  return {
    summary,
    rows: summary.days.map((d) => rowOf(d, d.date < input.today && d.date >= input.goal.startDate)),
    labels: dates.map((d) => `${dayLetter(d)} ${shortDate(d)}`),
    inKcal: dates.map((d) => byDate.get(d)?.countedKcal ?? null),
    outKcal: dates.map((d) => byDate.get(d)?.expenditure.out ?? null),
    imputedIdx: dates.flatMap((d, i) => (byDate.get(d)?.imputed ? [i] : [])),
  };
}

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export interface MonthCell {
  date: string;
  day: number;
  types: string[];
  status: 'deficit' | 'surplus' | 'imputed' | 'today' | 'future' | 'before';
}

export interface MonthView {
  summary: MonthSummary;
  label: string;
  cells: (MonthCell | null)[];
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Only offer a month whose first day is inside the loaded entry window; otherwise unloaded days would look penalized. */
export function canGoBackMonth(month: string, today: string): boolean {
  return `${shiftMonth(month, -1)}-01` >= addDays(today, -ENTRY_WINDOW_DAYS);
}

export function monthView(input: MonthInput): MonthView {
  const summary = summarizeMonth(input);
  const byDate = new Map(summary.days.map((d) => [d.date, d]));
  const lead = new Date(`${summary.start}T12:00:00Z`).getUTCDay();
  const cells = dateRange(summary.start, summary.end).map((date): MonthCell => {
    const d = byDate.get(date);
    const base = { date, day: Number(date.slice(8)), types: d ? d.expenditure.workouts.map((w) => w.type) : [] };
    if (date > input.today) return { ...base, status: 'future' };
    if (date === input.today) return { ...base, status: 'today' };
    if (date < input.goal.startDate) return { ...base, status: 'before' };
    if (d!.imputed) return { ...base, status: 'imputed' };
    return { ...base, status: d!.countedKcal <= d!.expenditure.out ? 'deficit' : 'surplus' };
  });
  const [y, m] = input.month.split('-').map(Number);
  return { summary, label: `${MONTHS[m - 1]} ${y}`, cells: [...Array.from({ length: lead }, () => null), ...cells] };
}
