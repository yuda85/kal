import { addDays, weekStart } from './dates.ts';
import type { Day, Entry, Goal, WeighIn } from './types.ts';

/** How many days of entries the app and `read.ts` load; a logging streak cannot see past it. */
export const ENTRY_WINDOW_DAYS = 90;

export interface AchievementInput {
  today: string;
  goal: Goal;
  entries: Entry[];
  days: Day[];
  weighIns: WeighIn[];
  lowDayThresholdKcal: number;
  /** The first date whose entries are loaded. */
  entriesFrom: string;
}

function kcalByDate(entries: Entry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) out.set(e.date, (out.get(e.date) ?? 0) + e.kcal);
  return out;
}

export interface LoggingStreak {
  days: number;
  /** The run reaches the first loaded day: the real streak may be longer ("N+"). */
  capped: boolean;
  graceUsedThisWeek: boolean;
  todayCounted: boolean;
  /** The first logged day of the run, or null without one. */
  start: string | null;
}

/** §19: logged days back from yesterday, one missed day absorbed per Sunday–Saturday week; today only adds. */
export function loggingStreak(input: AchievementInput): LoggingStreak {
  const kcal = kcalByDate(input.entries);
  const logged = (date: string) => (kcal.get(date) ?? 0) >= input.lowDayThresholdKcal;
  const windowFirst = input.entriesFrom > input.goal.startDate;
  const floor = windowFirst ? input.entriesFrom : input.goal.startDate;
  const graced = new Set<string>();
  let days = 0;
  let start: string | null = null;
  let capped = false;
  for (let date = addDays(input.today, -1); ; date = addDays(date, -1)) {
    if (date < floor) {
      capped = windowFirst;
      break;
    }
    if (logged(date)) {
      days += 1;
      start = date;
      continue;
    }
    const week = weekStart(date);
    if (graced.has(week)) break;
    graced.add(week);
  }
  const todayCounted = logged(input.today);
  if (todayCounted) {
    days += 1;
    start ??= input.today;
  }
  return { days, capped, graceUsedThisWeek: graced.has(weekStart(input.today)), todayCounted, start };
}
