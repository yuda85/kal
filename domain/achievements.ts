import { kcalByDate } from './checks.ts';
import { addDays, dateRange, weekStart } from './dates.ts';
import { enteredSteps } from './expenditure.ts';
import { STEPS_GOAL } from './steps.ts';
import { currentWeight } from './weekly.ts';
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
  const graced = new Set<string>();
  let days = 0;
  let start: string | null = null;
  let capped = false;
  for (let date = addDays(input.today, -1); ; date = addDays(date, -1)) {
    if (date < input.entriesFrom) {
      capped = true;
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

export type DayState = 'full' | 'partial' | 'open';

export interface FullWeek {
  start: string;
  /** Sunday to Saturday. open: today not full yet, the future, or before the goal start. */
  days: { date: string; state: DayState }[];
  full: number;
  /** The week's days on or after the goal start. */
  of: number;
  perfect: boolean;
}

/** §19: a full day has logged food, entered steps and a real weigh-in (a finished day with no flag). */
export function fullWeek(input: AchievementInput, date: string): FullWeek {
  const start = weekStart(date);
  const kcal = kcalByDate(input.entries);
  const dayByDate = new Map(input.days.map((d) => [d.date, d]));
  const weighed = new Set(input.weighIns.map((w) => w.date));
  const isFull = (d: string) =>
    (kcal.get(d) ?? 0) >= input.lowDayThresholdKcal && enteredSteps(dayByDate.get(d)) !== null && weighed.has(d);
  const days = dateRange(start, addDays(start, 6)).map((d): { date: string; state: DayState } => {
    if (d < input.goal.startDate || d > input.today) return { date: d, state: 'open' };
    if (isFull(d)) return { date: d, state: 'full' };
    return { date: d, state: d === input.today ? 'open' : 'partial' };
  });
  const of = days.filter((d) => d.date >= input.goal.startDate).length;
  const full = days.filter((d) => d.state === 'full').length;
  return { start, days, full, of, perfect: of > 0 && full === of };
}

/** A finished week needs this many days with entered steps to hold the weekly record. */
export const BEST_WEEK_MIN_DAYS = 5;

export interface StepsRecord {
  /** The day, or the week's Sunday. */
  date: string;
  steps: number;
}

export interface StepsAchievements {
  streak: { days: number; start: string | null; todayCounted: boolean };
  bestDay: StepsRecord | null;
  bestWeek: StepsRecord | null;
  /** Today passed the best day before it (only when there was one). */
  todayIsBest: boolean;
  /** Last week (finished) passed the best week before it (only when there was one). */
  lastWeekIsBest: boolean;
}

/** Earliest wins a tie; records must be sorted by date. */
function best(records: StepsRecord[]): StepsRecord | null {
  return records.reduce<StepsRecord | null>((b, r) => (b === null || r.steps > b.steps ? r : b), null);
}

export function stepsAchievements(input: AchievementInput): StepsAchievements {
  const dayRecords = input.days
    .flatMap((d) => {
      const steps = enteredSteps(d);
      return steps === null || d.date > input.today ? [] : [{ date: d.date, steps }];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const stepsOn = new Map(dayRecords.map((r) => [r.date, r.steps]));

  let days = 0;
  let start: string | null = null;
  for (let date = addDays(input.today, -1); (stepsOn.get(date) ?? 0) >= STEPS_GOAL; date = addDays(date, -1)) {
    days += 1;
    start = date;
  }
  const todaySteps = stepsOn.get(input.today) ?? null;
  const todayCounted = todaySteps !== null && todaySteps >= STEPS_GOAL;
  if (todayCounted) {
    days += 1;
    start ??= input.today;
  }

  const previousDay = best(dayRecords.filter((r) => r.date < input.today));
  const lastWeek = addDays(weekStart(input.today), -7);
  const weekRecords: StepsRecord[] = [];
  if (dayRecords.length > 0) {
    const weekly = new Map<string, { sum: number; count: number }>();
    for (const r of dayRecords) {
      const w = weekStart(r.date);
      const bucket = weekly.get(w) ?? { sum: 0, count: 0 };
      bucket.sum += r.steps;
      bucket.count += 1;
      weekly.set(w, bucket);
    }
    for (let w = weekStart(dayRecords[0].date); w <= lastWeek; w = addDays(w, 7)) {
      const bucket = weekly.get(w);
      if (bucket && bucket.count >= BEST_WEEK_MIN_DAYS) weekRecords.push({ date: w, steps: bucket.sum / bucket.count });
    }
  }
  const bestWeek = best(weekRecords);
  return {
    streak: { days, start, todayCounted },
    bestDay: best(dayRecords),
    bestWeek,
    todayIsBest: previousDay !== null && todaySteps !== null && todaySteps > previousDay.steps,
    lastWeekIsBest: best(weekRecords.filter((r) => r.date < lastWeek)) !== null && bestWeek?.date === lastWeek,
  };
}

export const MILESTONE_KG = 2;
/** Weights subtract in floats (92.2 − 88.2 = 3.9999999); a milestone counts within this. */
const EPSILON_KG = 1e-6;

export interface WeightMilestones {
  /** Start weight − current weight (§16), or null without a weigh-in. */
  lostKg: number | null;
  /** kg below the start weight: every 2 kg, the last one the target. */
  milestones: number[];
  reachedKg: number | null;
  reachedTarget: boolean;
  next: { kg: number; target: boolean; leftKg: number } | null;
}

export function weightMilestones(goal: Goal, weighIns: WeighIn[], today: string): WeightMilestones {
  const span = goal.startWeightKg - goal.targetWeightKg;
  const milestones: number[] = [];
  for (let kg = MILESTONE_KG; kg < span - EPSILON_KG; kg += MILESTONE_KG) milestones.push(kg);
  if (span > 0) milestones.push(span);
  const current = currentWeight(weighIns, goal.startDate < today ? goal.startDate : today, today);
  const lostKg = current === null ? null : goal.startWeightKg - current;
  const reached = lostKg === null ? [] : milestones.filter((m) => lostKg + EPSILON_KG >= m);
  const nextKg = milestones[reached.length];
  return {
    lostKg,
    milestones,
    reachedKg: reached.at(-1) ?? null,
    reachedTarget: milestones.length > 0 && reached.length === milestones.length,
    next: nextKg === undefined ? null : { kg: nextKg, target: nextKg === span, leftKg: nextKg - (lostKg ?? 0) },
  };
}

export interface Achievements {
  logging: LoggingStreak;
  thisWeek: FullWeek;
  lastWeek: FullWeek;
  steps: StepsAchievements;
  weight: WeightMilestones;
}

export function achievements(input: AchievementInput): Achievements {
  return {
    logging: loggingStreak(input),
    thisWeek: fullWeek(input, input.today),
    lastWeek: fullWeek(input, addDays(input.today, -7)),
    steps: stepsAchievements(input),
    weight: weightMilestones(input.goal, input.weighIns, input.today),
  };
}

export const STREAK_MILESTONES = [7, 14, 30, 60];
export const STEPS_STREAK_MILESTONES = [3, 7, 14, 30];

export type CelebrationKind = 'weight' | 'week' | 'streak' | 'steps-streak' | 'steps-week' | 'steps-day';

export interface Celebration {
  key: string;
  kind: CelebrationKind;
  /** kg, days, steps or the week's day count, by kind. */
  value: number;
  target: boolean;
}

/** `users/{uid}/meta/celebrations`: the keys already shown. */
export interface CelebrationState {
  seen: string[];
}

/** Everything the data earns right now, ascending within each kind (§19). */
export function earnedCelebrations(a: Achievements, goalId: string, today: string): Celebration[] {
  const out: Celebration[] = [];
  const add = (kind: CelebrationKind, key: string, value: number, target = false) => out.push({ kind, key, value, target });
  const { weight, logging, steps } = a;
  for (const kg of weight.milestones) {
    if (weight.reachedKg === null || kg > weight.reachedKg) break;
    const target = weight.reachedTarget && kg === weight.milestones.at(-1);
    add('weight', `weight-${goalId}-${target ? 'target' : kg}`, kg, target);
  }
  for (const w of [a.lastWeek, a.thisWeek]) if (w.perfect && w.of === 7) add('week', `week-${w.start}`, w.of);
  // A capped run's start moves every day; it would celebrate again daily.
  if (logging.start !== null && !logging.capped) {
    for (const n of STREAK_MILESTONES) if (logging.days >= n) add('streak', `streak-${n}-${logging.start}`, n);
  }
  if (steps.streak.start !== null) {
    for (const n of STEPS_STREAK_MILESTONES) if (steps.streak.days >= n) add('steps-streak', `steps-streak-${n}-${steps.streak.start}`, n);
  }
  if (steps.lastWeekIsBest && steps.bestWeek) add('steps-week', `steps-week-${steps.bestWeek.date}`, steps.bestWeek.steps);
  if (steps.todayIsBest && steps.bestDay) add('steps-day', `steps-day-${today}`, steps.bestDay.steps);
  return out;
}

const LADDERS: CelebrationKind[] = ['weight', 'streak', 'steps-streak'];

/** `<kind>-<n>-<run start>`, for the two streak kinds only. */
const STREAK_KEY = /^(streak|steps-streak)-(\d+)-(\d{4}-\d{2}-\d{2})$/;

/** A streak key with a later (or equal) run start counts as seen too: a run that breaks and restarts earlier is new. */
function seenBySameOrLaterRun(key: string, seen: string[]): boolean {
  const m = STREAK_KEY.exec(key);
  if (!m) return false;
  const [, kind, n, start] = m;
  return seen.some((s) => {
    const sm = STREAK_KEY.exec(s);
    return sm !== null && sm[1] === kind && sm[2] === n && sm[3] >= start;
  });
}

/** What to show: earned and not seen; a milestone ladder (weight, streak, steps-streak) shows only its highest. */
export function dueCelebrations(earned: Celebration[], seen: string[]): Celebration[] {
  const seenKeys = new Set(seen);
  const unseen = earned.filter((c) => !seenKeys.has(c.key) && !seenBySameOrLaterRun(c.key, seen));
  const top = new Map<CelebrationKind, Celebration>();
  for (const c of unseen) if (LADDERS.includes(c.kind)) top.set(c.kind, c);
  return unseen.filter((c) => !LADDERS.includes(c.kind) || top.get(c.kind) === c);
}
