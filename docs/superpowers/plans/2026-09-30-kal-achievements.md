# Achievements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Streaks, full weeks, step records, weight milestones and one-time celebrations, all computed from the data kal already loads.

**Architecture:** Pure functions in `domain/achievements.ts` compute everything from entries, days and weigh-ins; the app shows them on the existing screens (Today chip, Week card, steps card, Weight bar) and `read.ts achievements` returns the same object to Claude. The only stored state is `users/{uid}/meta/celebrations = { seen: string[] }`, so each celebration shows once; a missing document means first run and is filled silently.

**Tech Stack:** TypeScript domain (erasable syntax, Vitest), Angular 21 standalone components with signals, Firestore, `@lucide/angular` icons, inline SVG/CSS only.

**Spec:** `docs/superpowers/specs/2026-09-27-kal-design.md` §19 (with §16 current weight, §18 steps card). Read §19 before any task.

## Global Constraints

- All calculations live in `domain/`; the app and the skill scripts import it; never duplicate a formula (CLAUDE.md).
- `domain/` is framework-free TypeScript: erasable syntax only (no enums, namespaces, parameter properties), `.ts` import extensions, `import type` for types, zero runtime dependencies.
- The app imports `domain/` only via `app/src/app/domain.ts` (`from '../../domain'`).
- UI text is Hebrew, RTL. Numbers in `<span class="num">`. Colours only from tokens in `app/src/styles.css`; status never by colour alone.
- Claude never writes to Firestore; only the app writes the celebrations document.
- Logging and steps achievements never say "on track"; only a weight milestone speaks about weight.
- Conventional Commits; every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Push to `main` at the end of Tasks 7, 10, 12 and 15 with: `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin main` (the keychain helper fails in this environment).
- Gates: `npm test`, `npm run typecheck` (root); `cd app && npx ng test --watch=false`, `cd app && npx ng build`. Known and unrelated: 14 tests in `checkin.spec.ts` / `checkin-photo.spec.ts` fail on local Node 26 (`localStorage` undefined) and pass in CI (Node 24). Report them, do not fix them here.
- Single app test file: `cd app && npx ng test --watch=false --include=src/app/<path>.spec.ts`. Single domain test: `npx vitest run domain/<file>.test.ts`.

## Review Focus

1. **Entries arrive after days and weigh-ins** → celebrations must not be evaluated (or the first-run document seeded) until profile, goals, days, weigh-ins, entries and the celebrations document have all arrived; otherwise the seed misses keys and a flood of dialogs follows. Test in Task 14 ("waits for the entries before seeding").
2. **Float subtraction at a milestone** (92.2 − 88.2 = 3.9999999) → the 4 kg milestone still counts. Test in Task 5.
3. **Saturday and Sunday missed in a row** → two different weeks, both absorbed by grace; two misses in the same week break. Test in Task 2.
4. **A streak older than the 90-day entry window** → shows "N+" and never re-celebrates every day (its run start moves daily). Test in Task 6 ("no streak celebration once capped").
5. **A weigh-in that moves the weekly mean back above a milestone** → the bar shows the current state; a celebration already seen is not shown again. Test in Task 5 (current state) and Task 14 (seen keys stay seen).

---

## File Structure

- Create `domain/achievements.ts`: `ENTRY_WINDOW_DAYS`, `AchievementInput`, `loggingStreak`, `fullWeek`, `stepsAchievements`, `weightMilestones`, `achievements`, celebration keys (`earnedCelebrations`, `dueCelebrations`), `CelebrationState`.
- Create `domain/achievements.test.ts`.
- Modify `domain/expenditure.ts` (+ test): export `enteredSteps`.
- Modify `domain/weekly.ts` (+ test): export `currentWeight`.
- Modify `domain/index.ts`: export `./achievements.ts`.
- Modify `.claude/skills/kal/scripts/lib/commands.ts`, `tests/skill/commands.test.ts`, `.claude/skills/kal/SKILL.md`: `read.ts achievements`.
- Modify `app/src/app/core/kal-state.ts` (+ spec): `loaded`, `entriesLoaded`, `entriesFrom`, `achievementInput`, `achievements`, `celebrationState`.
- Modify `app/src/app/core/repository.ts`, `firestore-repository.ts`, `app/src/testing/fake-repository.ts`: celebrations document.
- Modify `app/src/app/features/today/today.logic.ts` (+ spec), `today.ts` (+ spec): streak chip; check-in waits for a celebration.
- Modify `app/src/app/features/week/week.ts` (+ spec), `week.logic.ts`: full week card, step records row.
- Modify `app/src/app/features/weight/weight.logic.ts` (+ spec), `weight.ts`: milestone ticks and next milestone.
- Create `app/src/app/features/celebrations/celebration.logic.ts` (+ spec), `celebration.service.ts` (+ spec), `celebration.ts` (+ spec); modify `app/src/app/shell/shell.ts`.
- Docs: spec §19 fixes (Task 7), `design-system/kal/MASTER.md` (Tasks 10, 12, 15).

---

### Task 1: Shared rules — entered steps and current weight

**Files:**
- Modify: `domain/expenditure.ts`, `domain/expenditure.test.ts`
- Modify: `domain/weekly.ts`, `domain/weekly.test.ts`
- Modify: `app/src/app/features/weight/weight.logic.ts`

**Interfaces:**
- Produces: `enteredSteps(day: Day | undefined): number | null`; `currentWeight(weighIns: WeighIn[], from: string, today: string): number | null`.

- [ ] **Step 1: Write the failing tests**

In `domain/expenditure.test.ts` change the import to `import { enteredSteps, expenditure, kcalPerStep } from './expenditure.ts';` and append:

```ts
describe('enteredSteps', () => {
  it('takes manual steps over Garmin, and null without either', () => {
    expect(enteredSteps({ date: 'd', manual: { steps: 9000 }, garmin: { steps: 4000, workouts: [] } })).toBe(9000);
    expect(enteredSteps({ date: 'd', garmin: { steps: 4000, workouts: [] } })).toBe(4000);
    expect(enteredSteps({ date: 'd', manual: { workouts: [] } })).toBeNull();
    expect(enteredSteps(undefined)).toBeNull();
  });
});
```

In `domain/weekly.test.ts` change the import to `import { currentWeight, meanWeight, weeklyWeights, weightChange } from './weekly.ts';` and append:

```ts
describe('currentWeight', () => {
  it('is the mean of the latest week with a real weigh-in', () => {
    const w = [
      { date: '2026-09-15', kg: 88 },
      { date: '2026-09-17', kg: 87 },
      { date: '2026-09-22', kg: 86.5 },
    ];
    // the week of 09-27 (today 09-30) has none, so the week of 09-20 counts
    expect(currentWeight(w, '2026-09-01', '2026-09-30')).toBe(86.5);
    expect(currentWeight([], '2026-09-01', '2026-09-30')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run domain/expenditure.test.ts domain/weekly.test.ts`
Expected: FAIL — `enteredSteps` / `currentWeight` is not exported.

- [ ] **Step 3: Implement**

In `domain/expenditure.ts`, above `expenditure`:

```ts
/** Steps the owner entered for a day: manual, else Garmin; null when neither (the day then counts `defaultSteps`). */
export function enteredSteps(day: Day | undefined): number | null {
  return day?.manual?.steps ?? day?.garmin?.steps ?? null;
}
```

and replace the first four lines of `expenditure` with:

```ts
  const entered = enteredSteps(day);
  const steps = entered ?? opts.defaultSteps;
  const stepsSource = day?.manual?.steps !== undefined ? 'manual' : entered !== null ? 'garmin' : 'default';
```

In `domain/weekly.ts`, append:

```ts
/** The weight that counts now (§16): the mean of the latest week, from the week of `from`, with a real weigh-in. */
export function currentWeight(weighIns: WeighIn[], from: string, today: string): number | null {
  return [...weeklyWeights(weighIns, from, today)].reverse().find((w) => w.meanKg !== null)?.meanKg ?? null;
}
```

In `app/src/app/features/weight/weight.logic.ts`, add `currentWeight` to the domain import and in `weightView` replace

```ts
  const weeks = weeklyWeights(weighIns, goal.startDate < today ? goal.startDate : today, today);
  const currentKg = [...weeks].reverse().find((w) => w.meanKg !== null)?.meanKg ?? null;
```

with

```ts
  const from = goal.startDate < today ? goal.startDate : today;
  const weeks = weeklyWeights(weighIns, from, today);
  const currentKg = currentWeight(weighIns, from, today);
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run domain/expenditure.test.ts domain/weekly.test.ts domain/summary.test.ts` then `cd app && npx ng test --watch=false --include=src/app/features/weight/weight.logic.spec.ts`
Expected: PASS (the summary and weight tests prove nothing changed).

- [ ] **Step 5: Commit**

```bash
git add domain/expenditure.ts domain/expenditure.test.ts domain/weekly.ts domain/weekly.test.ts app/src/app/features/weight/weight.logic.ts
git commit -m "refactor(domain): enteredSteps and currentWeight as shared rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Logging streak

**Files:**
- Create: `domain/achievements.ts`, `domain/achievements.test.ts`
- Modify: `domain/index.ts`

**Interfaces:**
- Consumes: `addDays`, `weekStart` (`./dates.ts`).
- Produces:

```ts
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
export interface LoggingStreak { days: number; capped: boolean; graceUsedThisWeek: boolean; todayCounted: boolean; start: string | null }
export function loggingStreak(input: AchievementInput): LoggingStreak;
```

- [ ] **Step 1: Write the failing tests**

Create `domain/achievements.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loggingStreak, type AchievementInput } from './achievements.ts';
import { makeEntry, testGoal } from './testing.ts';

// 2026-09-27 is a Sunday; today is Wednesday 2026-09-30.
const base: AchievementInput = {
  today: '2026-09-30',
  goal: { ...testGoal, startDate: '2026-08-01' },
  entries: [],
  days: [],
  weighIns: [],
  lowDayThresholdKcal: 800,
  entriesFrom: '2026-07-02',
};
const food = (...dates: string[]) => dates.map((date) => makeEntry({ date, kcal: 1500 }));

describe('loggingStreak', () => {
  it('counts logged days back from yesterday; today adds once logged and never breaks', () => {
    // 09-24 missed (grace of the week of 09-20), 09-23 missed too: the streak stops there
    const entries = [...food('2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29'), makeEntry({ date: '2026-09-30', kcal: 300 })];
    const s = loggingStreak({ ...base, entries });
    expect(s).toEqual({ days: 5, capped: false, graceUsedThisWeek: false, todayCounted: false, start: '2026-09-25' });
    const logged = loggingStreak({ ...base, entries: [...entries, makeEntry({ date: '2026-09-30', kcal: 600 })] });
    expect(logged.days).toBe(6);
    expect(logged.todayCounted).toBe(true);
  });

  it('absorbs one missed day per week and stops at the second', () => {
    const entries = food('2026-09-21', '2026-09-22', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-29');
    // 09-28 missed (week of 09-27 grace), 09-23 missed (week of 09-20 grace), 09-20 missed: second in its week
    const s = loggingStreak({ ...base, entries });
    expect(s.days).toBe(7);
    expect(s.start).toBe('2026-09-21');
    expect(s.graceUsedThisWeek).toBe(true);
  });

  it('absorbs a missed Saturday and Sunday in a row: they are different weeks', () => {
    const entries = food('2026-09-24', '2026-09-25', '2026-09-28', '2026-09-29');
    const s = loggingStreak({ ...base, entries });
    expect(s.days).toBe(4);
    expect(s.start).toBe('2026-09-24');
  });

  it('does not count a day under the threshold', () => {
    const entries = [makeEntry({ date: '2026-09-29', kcal: 799 }), makeEntry({ date: '2026-09-28', kcal: 799 })];
    expect(loggingStreak({ ...base, entries }).days).toBe(0);
  });

  it('never reaches before the goal start', () => {
    const entries = food('2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29');
    const s = loggingStreak({ ...base, entries, goal: { ...base.goal, startDate: '2026-09-28' } });
    expect(s.days).toBe(2);
    expect(s.capped).toBe(false);
  });

  it('is capped when it reaches the start of the loaded entries', () => {
    const entries = food('2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29');
    const s = loggingStreak({ ...base, entries, entriesFrom: '2026-09-25' });
    expect(s.days).toBe(5);
    expect(s.capped).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run domain/achievements.test.ts`
Expected: FAIL — cannot find module `./achievements.ts`.

- [ ] **Step 3: Implement**

Create `domain/achievements.ts`:

```ts
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
```

In `domain/index.ts` add `export * from './achievements.ts';` after `export * from './steps.ts';`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run domain/achievements.test.ts && npm run typecheck`
Expected: PASS, typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add domain/achievements.ts domain/achievements.test.ts domain/index.ts
git commit -m "feat(domain): logging streak with one grace day per week

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Full week

**Files:**
- Modify: `domain/achievements.ts`, `domain/achievements.test.ts`

**Interfaces:**
- Consumes: `AchievementInput`, `kcalByDate` (Task 2), `enteredSteps` (Task 1), `dateRange`.
- Produces:

```ts
export type DayState = 'full' | 'partial' | 'open';
export interface FullWeek { start: string; days: { date: string; state: DayState }[]; full: number; of: number; perfect: boolean }
export function fullWeek(input: AchievementInput, date: string): FullWeek;
```

- [ ] **Step 1: Write the failing tests**

Add `fullWeek` to the test import and append:

```ts
describe('fullWeek', () => {
  const steps = (date: string) => ({ date, garmin: { steps: 6000, workouts: [] } });
  const weigh = (date: string) => ({ date, kg: 85 });
  const input: AchievementInput = {
    ...base,
    entries: food('2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'),
    days: ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'].map(steps),
    weighIns: ['2026-09-27', '2026-09-29', '2026-09-30'].map(weigh),
  };

  it('scores the days with food, steps and a real weigh-in', () => {
    const w = fullWeek(input, '2026-09-30');
    expect(w.start).toBe('2026-09-27');
    expect(w.days.map((d) => d.state)).toEqual(['full', 'partial', 'full', 'full', 'open', 'open', 'open']);
    expect([w.full, w.of, w.perfect]).toEqual([3, 7, false]);
  });

  it('leaves today open until it is full', () => {
    const w = fullWeek({ ...input, weighIns: input.weighIns.filter((x) => x.date !== '2026-09-30') }, '2026-09-30');
    expect(w.days[3].state).toBe('open');
  });

  it('counts only the days on or after the goal start', () => {
    const w = fullWeek({ ...input, goal: { ...base.goal, startDate: '2026-09-29' } }, '2026-09-30');
    expect(w.days.slice(0, 2).map((d) => d.state)).toEqual(['open', 'open']);
    expect([w.full, w.of]).toEqual([2, 5]);
  });

  it('is perfect when every day is full', () => {
    const week = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'];
    const w = fullWeek({ ...base, entries: food(...week), days: week.map(steps), weighIns: week.map(weigh) }, '2026-09-22');
    expect([w.full, w.of, w.perfect]).toEqual([7, 7, true]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run domain/achievements.test.ts`
Expected: FAIL — `fullWeek` is not exported.

- [ ] **Step 3: Implement**

Change the imports at the top of `domain/achievements.ts` to:

```ts
import { addDays, dateRange, weekStart } from './dates.ts';
import { enteredSteps } from './expenditure.ts';
import type { Day, Entry, Goal, WeighIn } from './types.ts';
```

Append:

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run domain/achievements.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add domain/achievements.ts domain/achievements.test.ts
git commit -m "feat(domain): full-week score from food, steps and weigh-ins

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Steps streak and records

**Files:**
- Modify: `domain/achievements.ts`, `domain/achievements.test.ts`

**Interfaces:**
- Consumes: `STEPS_GOAL` (`./steps.ts`), `enteredSteps`.
- Produces:

```ts
export const BEST_WEEK_MIN_DAYS = 5;
export interface StepsRecord { date: string; steps: number }
export interface StepsAchievements {
  streak: { days: number; start: string | null; todayCounted: boolean };
  bestDay: StepsRecord | null;
  bestWeek: StepsRecord | null;
  todayIsBest: boolean;
  lastWeekIsBest: boolean;
}
export function stepsAchievements(input: AchievementInput): StepsAchievements;
```

- [ ] **Step 1: Write the failing tests**

Add `stepsAchievements` to the test import and append:

```ts
describe('stepsAchievements', () => {
  const g = (date: string, steps: number) => ({ date, garmin: { steps, workouts: [] } });

  it('counts days at 10,000 or more back from yesterday, with no grace', () => {
    const days = [g('2026-09-26', 9000), g('2026-09-27', 12000), { date: '2026-09-28', manual: { steps: 10000 } }, g('2026-09-29', 10500), g('2026-09-30', 4000)];
    const s = stepsAchievements({ ...base, days });
    expect(s.streak).toEqual({ days: 3, start: '2026-09-27', todayCounted: false });
    const on = stepsAchievements({ ...base, days: [...days.slice(0, 4), g('2026-09-30', 11000)] });
    expect(on.streak).toEqual({ days: 4, start: '2026-09-27', todayCounted: true });
  });

  it('keeps the best day, and marks today when it beats a previous best', () => {
    const days = [g('2026-09-23', 14200), g('2026-09-24', 8000), g('2026-09-30', 9000)];
    expect(stepsAchievements({ ...base, days }).bestDay).toEqual({ date: '2026-09-23', steps: 14200 });
    const beat = stepsAchievements({ ...base, days: [...days.slice(0, 2), g('2026-09-30', 15000)] });
    expect(beat.bestDay).toEqual({ date: '2026-09-30', steps: 15000 });
    expect(beat.todayIsBest).toBe(true);
  });

  it('never calls the first day with steps a record', () => {
    const s = stepsAchievements({ ...base, days: [g('2026-09-30', 9000)] });
    expect(s.bestDay).toEqual({ date: '2026-09-30', steps: 9000 });
    expect(s.todayIsBest).toBe(false);
  });

  it('keeps the best finished week with at least 5 days of steps', () => {
    const week13 = ['2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'].map((d) => g(d, 8000));
    const week20 = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23'].map((d) => g(d, 12000));
    const four = stepsAchievements({ ...base, days: [...week13, ...week20] });
    expect(four.bestWeek).toEqual({ date: '2026-09-13', steps: 8000 });
    expect(four.lastWeekIsBest).toBe(false);
    const five = stepsAchievements({ ...base, days: [...week13, ...week20, g('2026-09-24', 12000)] });
    expect(five.bestWeek).toEqual({ date: '2026-09-20', steps: 12000 });
    expect(five.lastWeekIsBest).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run domain/achievements.test.ts`
Expected: FAIL — `stepsAchievements` is not exported.

- [ ] **Step 3: Implement**

Add `import { STEPS_GOAL } from './steps.ts';` to the imports and append:

```ts
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
    for (let w = weekStart(dayRecords[0].date); w <= lastWeek; w = addDays(w, 7)) {
      const inWeek = dayRecords.filter((r) => r.date >= w && r.date <= addDays(w, 6));
      if (inWeek.length >= BEST_WEEK_MIN_DAYS) weekRecords.push({ date: w, steps: inWeek.reduce((s, r) => s + r.steps, 0) / inWeek.length });
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run domain/achievements.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add domain/achievements.ts domain/achievements.test.ts
git commit -m "feat(domain): 10K steps streak, best day and best week

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Weight milestones

**Files:**
- Modify: `domain/achievements.ts`, `domain/achievements.test.ts`

**Interfaces:**
- Consumes: `currentWeight` (Task 1).
- Produces:

```ts
export const MILESTONE_KG = 2;
export interface WeightMilestones {
  lostKg: number | null;
  milestones: number[];
  reachedKg: number | null;
  reachedTarget: boolean;
  next: { kg: number; target: boolean; leftKg: number } | null;
}
export function weightMilestones(goal: Goal, weighIns: WeighIn[], today: string): WeightMilestones;
```

- [ ] **Step 1: Write the failing tests**

Add `weightMilestones` to the test import and append:

```ts
describe('weightMilestones', () => {
  // testGoal: 90 → 80 kg from 2026-09-01; the weight is the latest week's mean
  it('has a milestone every 2 kg and the target last', () => {
    const m = weightMilestones(testGoal, [], '2026-09-30');
    expect(m.milestones).toEqual([2, 4, 6, 8, 10]);
    expect([m.lostKg, m.reachedKg]).toEqual([null, null]);
    expect(m.next).toEqual({ kg: 2, target: false, leftKg: 2 });
  });

  it('shows the last one reached and how far the next is, from the current mean', () => {
    const m = weightMilestones(testGoal, [{ date: '2026-09-27', kg: 86.8 }, { date: '2026-09-29', kg: 86.4 }], '2026-09-30');
    expect(m.reachedKg).toBe(2);
    expect(m.next?.kg).toBe(4);
    expect(m.next?.leftKg).toBeCloseTo(0.6, 10);
  });

  it('counts a milestone reached exactly, despite float subtraction', () => {
    const goal = { ...testGoal, startWeightKg: 92.2, targetWeightKg: 83 };
    const m = weightMilestones(goal, [{ date: '2026-09-29', kg: 88.2 }], '2026-09-30');
    expect(m.reachedKg).toBe(4);
    expect(m.milestones.at(-1)).toBeCloseTo(9.2, 10);
  });

  it('reaches the target', () => {
    const m = weightMilestones(testGoal, [{ date: '2026-09-29', kg: 79.5 }], '2026-09-30');
    expect(m.reachedTarget).toBe(true);
    expect(m.reachedKg).toBe(10);
    expect(m.next).toBeNull();
  });

  it('follows the mean back up', () => {
    const m = weightMilestones(testGoal, [{ date: '2026-09-22', kg: 85.9 }, { date: '2026-09-29', kg: 86.5 }], '2026-09-30');
    expect(m.reachedKg).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run domain/achievements.test.ts`
Expected: FAIL — `weightMilestones` is not exported.

- [ ] **Step 3: Implement**

Add `import { currentWeight } from './weekly.ts';` to the imports and append:

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run domain/achievements.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add domain/achievements.ts domain/achievements.test.ts
git commit -m "feat(domain): weight milestones every 2 kg up to the target

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: All achievements and the celebration keys

**Files:**
- Modify: `domain/achievements.ts`, `domain/achievements.test.ts`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:

```ts
export interface Achievements { logging: LoggingStreak; thisWeek: FullWeek; lastWeek: FullWeek; steps: StepsAchievements; weight: WeightMilestones }
export function achievements(input: AchievementInput): Achievements;
export const STREAK_MILESTONES = [7, 14, 30, 60];
export const STEPS_STREAK_MILESTONES = [3, 7, 14, 30];
export type CelebrationKind = 'weight' | 'week' | 'streak' | 'steps-streak' | 'steps-week' | 'steps-day';
export interface Celebration { key: string; kind: CelebrationKind; value: number; target: boolean }
export interface CelebrationState { seen: string[] }
export function earnedCelebrations(a: Achievements, goalId: string, today: string): Celebration[];
export function dueCelebrations(earned: Celebration[], seen: string[]): Celebration[];
```

Note the spec change made in Task 7: logging streak milestones stop at 60, and a capped streak (older than the entry window) earns no streak celebration, because its run start moves every day and would re-celebrate daily; 60 logged days always fit in the 90-day window.

- [ ] **Step 1: Write the failing tests**

Add `achievements, dueCelebrations, earnedCelebrations` to the test import and append:

```ts
describe('celebrations', () => {
  const g = (date: string, steps: number) => ({ date, garmin: { steps, workouts: [] } });
  const eightDays = food('2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29');

  it('earns every streak milestone of the current run, keyed by its start', () => {
    const a = achievements({ ...base, entries: eightDays });
    const keys = earnedCelebrations(a, 'g1', base.today).map((c) => c.key);
    expect(keys).toContain('streak-7-2026-09-22');
    expect(keys).not.toContain('streak-14-2026-09-22');
  });

  it('earns no streak celebration once the streak is capped', () => {
    const a = achievements({ ...base, entries: eightDays, entriesFrom: '2026-09-22' });
    expect(a.logging.capped).toBe(true);
    expect(earnedCelebrations(a, 'g1', base.today).filter((c) => c.kind === 'streak')).toEqual([]);
  });

  it('earns weight milestones per goal, the target by name', () => {
    const a = achievements({ ...base, goal: testGoal, weighIns: [{ date: '2026-09-29', kg: 79.5 }] });
    const weight = earnedCelebrations(a, 'g1', base.today).filter((c) => c.kind === 'weight');
    expect(weight.map((c) => c.key)).toEqual(['weight-g1-2', 'weight-g1-4', 'weight-g1-6', 'weight-g1-8', 'weight-g1-target']);
    expect(weight.at(-1)!.target).toBe(true);
  });

  it('earns a record day and a steps streak', () => {
    const days = [g('2026-09-27', 10500), g('2026-09-28', 11000), g('2026-09-29', 12000), g('2026-09-30', 12500)];
    const kinds = earnedCelebrations(achievements({ ...base, days }), 'g1', base.today).map((c) => c.key);
    expect(kinds).toContain('steps-streak-3-2026-09-27');
    expect(kinds).toContain('steps-day-2026-09-30');
  });

  it('shows only unseen celebrations, the highest of each kind', () => {
    const a = achievements({ ...base, goal: testGoal, weighIns: [{ date: '2026-09-29', kg: 85 }] });
    const earned = earnedCelebrations(a, 'g1', base.today);
    expect(dueCelebrations(earned, []).map((c) => c.key)).toEqual(['weight-g1-4']);
    expect(dueCelebrations(earned, ['weight-g1-2', 'weight-g1-4'])).toEqual([]);
  });

  it('celebrates a new run again', () => {
    const run1 = earnedCelebrations(achievements({ ...base, entries: eightDays }), 'g1', base.today);
    const later = food('2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06');
    const run2 = earnedCelebrations(achievements({ ...base, today: '2026-10-07', entries: later }), 'g1', '2026-10-07');
    expect(dueCelebrations(run2, run1.map((c) => c.key)).map((c) => c.key)).toEqual(['streak-7-2026-09-30']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run domain/achievements.test.ts`
Expected: FAIL — `achievements` is not exported.

- [ ] **Step 3: Implement**

Append to `domain/achievements.ts`:

```ts
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
  for (const w of [a.lastWeek, a.thisWeek]) if (w.perfect) add('week', `week-${w.start}`, w.of);
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

/** What to show: earned and not seen, only the highest of each kind. */
export function dueCelebrations(earned: Celebration[], seen: string[]): Celebration[] {
  const seenKeys = new Set(seen);
  const top = new Map<CelebrationKind, Celebration>();
  for (const c of earned) if (!seenKeys.has(c.key)) top.set(c.kind, c);
  return earned.filter((c) => top.get(c.kind) === c);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run domain/achievements.test.ts && npm test && npm run typecheck`
Expected: PASS; typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add domain/achievements.ts domain/achievements.test.ts
git commit -m "feat(domain): achievements and one-time celebration keys

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `read.ts achievements`, SKILL.md, spec fixes — push #1

**Files:**
- Modify: `.claude/skills/kal/scripts/lib/commands.ts`, `tests/skill/commands.test.ts`, `.claude/skills/kal/SKILL.md`
- Modify: `docs/superpowers/specs/2026-09-27-kal-design.md` (§19)

**Interfaces:**
- Consumes: `achievements`, `ENTRY_WINDOW_DAYS` (Tasks 2, 6).
- Produces: `run(['achievements'], deps)` → `Achievements`.

- [ ] **Step 1: Write the failing test**

In `tests/skill/commands.test.ts`, before the `profile` test:

```ts
  it('achievements: returns streaks, the full week, step records and weight milestones', async () => {
    // fake reader: 320 kcal and 15,200 Garmin steps on 09-27, weigh-in 85 kg on 09-27, goal 90 → 80
    const out = (await run(['achievements'], { reader: fakeReader(), now: new Date('2026-09-28T10:00:00Z') })) as any;
    expect(out.logging.days).toBe(0);
    expect(out.steps.bestDay).toEqual({ date: '2026-09-27', steps: 15200 });
    expect(out.steps.streak.days).toBe(1);
    expect(out.weight.reachedKg).toBe(4);
    expect(out.weight.next).toEqual({ kg: 6, target: false, leftKg: 1 });
    expect(out.thisWeek.of).toBe(7);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/skill/commands.test.ts`
Expected: FAIL — `unknown command: achievements`.

- [ ] **Step 3: Implement**

In `.claude/skills/kal/scripts/lib/commands.ts` add `achievements` and `ENTRY_WINDOW_DAYS` to the domain import (alphabetical), then above `export async function run`:

```ts
async function achievementsOf(deps: Deps, today: string) {
  const from = addDays(today, -ENTRY_WINDOW_DAYS);
  const d = await loadData(deps.reader, from, today);
  return achievements({
    today,
    goal: d.goal,
    entries: d.entries,
    days: d.days,
    weighIns: d.weighIns,
    lowDayThresholdKcal: settingsOf(d.profile).lowDayThresholdKcal,
    entriesFrom: from,
  });
}
```

In `run`'s `switch`, before `default`:

```ts
    case 'achievements':
      return achievementsOf(deps, today);
```

and change the error text to `unknown command: ${command}. Use profile | day [date] | week [date] | month [YYYY-MM] | recipes | achievements`.

In `.claude/skills/kal/SKILL.md`, after the `read.ts week` line in the commands block add:

```
node .claude/skills/kal/scripts/read.ts achievements        # logging streak (grace, today), this/last full week, 10K streak, step records, weight milestones
```

and after the steps-goal sentence in "Weight and activity" add:

```
- Achievements (§19): you may name the logging streak or how close a record or milestone is ("if you log today, it is day 7"; "2,300 steps to your best day"). A logging or steps achievement never means "on track"; only a weight milestone speaks about weight.
```

In spec §19 apply these fixes:
- "Logging streak 7, 14, 30, 60, 90" → "logging streak 7, 14, 30, 60 (no streak celebration once the streak is capped: its run start moves every day)".
- "it reads \"90+\"" → "it reads \"N+\"".
- `users/{uid}/state/celebrations` → `users/{uid}/meta/celebrations` (next to `meta/tips`).
- Today chip: add "shown from a 1-day streak".

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/skill/commands.test.ts && npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit and push #1**

```bash
git add .claude/skills/kal/scripts/lib/commands.ts tests/skill/commands.test.ts .claude/skills/kal/SKILL.md docs/superpowers/specs/2026-09-27-kal-design.md
git commit -m "feat(skill): read.ts achievements

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin main
```

---

### Task 8: KalState — load signals and achievements

**Files:**
- Modify: `app/src/app/core/kal-state.ts`, `app/src/app/core/kal-state.spec.ts`
- Modify: `app/src/app/features/week/week.logic.ts` (import only)

**Interfaces:**
- Consumes: `achievements`, `ENTRY_WINDOW_DAYS`, `AchievementInput`, `settingsOf`.
- Produces on `KalState`: `loaded: Signal<boolean>` (profile, goals, days, weigh-ins arrived), `entriesLoaded: Signal<boolean>`, `entriesFrom: Signal<string>`, `achievementInput: Signal<AchievementInput | null>`, `achievements: Signal<Achievements | null>`. `ENTRY_WINDOW_DAYS` now comes from the domain (`kal-state.ts` no longer defines it).

- [ ] **Step 1: Write the failing tests**

Append inside `describe('KalState', ...)` in `kal-state.spec.ts`:

```ts
  it('computes the achievements once everything has loaded', () => {
    const state = setup();
    expect(state.loaded()).toBe(true);
    expect(state.entriesLoaded()).toBe(true);
    // seeded: weigh-in 85 kg against a 90 → 80 goal
    expect(state.achievements()!.weight.reachedKg).toBe(4);
    expect(state.achievementInput()!.entriesFrom).toBe('2026-06-29');
  });

  it('reports entries as not loaded until they arrive', () => {
    const repo = seededRepository();
    repo.watchEntries = () => () => undefined;
    expect(setup(repo).entriesLoaded()).toBe(false);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd app && npx ng test --watch=false --include=src/app/core/kal-state.spec.ts`
Expected: FAIL — `loaded` / `achievements` do not exist.

- [ ] **Step 3: Implement**

In `kal-state.ts`:
- Remove `export const ENTRY_WINDOW_DAYS = 90;`; add `achievements`, `ENTRY_WINDOW_DAYS`, `settingsOf`, `type AchievementInput`, `type Achievements` to the domain import.
- Add signals next to the others:

```ts
  /** Profile, goals, days and weigh-ins have arrived (the same moment `whenLoaded` resolves). */
  readonly loaded = signal(false);
  readonly entriesLoaded = signal(false);
  /** The first date whose entries are loaded. */
  readonly entriesFrom = signal(addDays(localDate(new Date()), -ENTRY_WINDOW_DAYS));
  readonly achievementInput = computed<AchievementInput | null>(() => {
    const profile = this.profile();
    const goal = this.goal();
    if (!profile || !goal) return null;
    return {
      today: this.today(),
      goal,
      entries: this.entries(),
      days: this.days(),
      weighIns: this.weighIns(),
      lowDayThresholdKcal: settingsOf(profile).lowDayThresholdKcal,
      entriesFrom: this.entriesFrom(),
    };
  });
  readonly achievements = computed<Achievements | null>(() => {
    const input = this.achievementInput();
    return input ? achievements(input) : null;
  });
```

- In `start`: after `const from = addDays(this.today(), -ENTRY_WINDOW_DAYS);` add `this.entriesFrom.set(from);`; change `if (pending === 0) resolve();` to

```ts
        if (pending === 0) {
          this.loaded.set(true);
          resolve();
        }
```

  and the entries watcher to

```ts
      this.repo.watchEntries(uid, from, (e) => {
        this.entries.set(e);
        this.entriesLoaded.set(true);
      }),
```

- In `stop`: add `this.loaded.set(false);` and `this.entriesLoaded.set(false);`.

In `app/src/app/features/week/week.logic.ts` replace `import { ENTRY_WINDOW_DAYS } from '../../core/kal-state';` by adding `ENTRY_WINDOW_DAYS` to its domain import. Check nothing else imports it from kal-state: `grep -rn "ENTRY_WINDOW_DAYS" app/src` (fix any other import the same way).

- [ ] **Step 4: Run to verify they pass**

Run: `cd app && npx ng test --watch=false --include=src/app/core/kal-state.spec.ts --include=src/app/features/week/week.logic.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/core/kal-state.ts app/src/app/core/kal-state.spec.ts app/src/app/features/week/week.logic.ts
git commit -m "feat(app): load signals and achievements in the app state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Today — streak chip

**Files:**
- Modify: `app/src/app/features/today/today.logic.ts`, `today.logic.spec.ts`, `today.ts`, `today.spec.ts`

**Interfaces:**
- Consumes: `KalState.achievements`, `LoggingStreak`.
- Produces: `streakChip(s: LoggingStreak): StreakChip | null` with `StreakChip = { count: string; today: boolean; label: string }`.

- [ ] **Step 1: Write the failing tests**

In `today.logic.spec.ts` add `streakChip` to the import and append:

```ts
describe('streakChip', () => {
  const s = { days: 12, capped: false, graceUsedThisWeek: false, todayCounted: true, start: '2026-09-19' };

  it('shows the count and whether today already counts', () => {
    expect(streakChip(s)).toEqual({ count: '12', today: true, label: 'רצף דיווח 12 ימים, היום כבר דווח' });
    expect(streakChip({ ...s, todayCounted: false })!.label).toBe('רצף דיווח 12 ימים, היום עוד לא דווח');
  });

  it('marks a capped streak with a plus, and hides an empty one', () => {
    expect(streakChip({ ...s, capped: true, days: 85 })!.count).toBe('85+');
    expect(streakChip({ ...s, days: 0, todayCounted: false, start: null })).toBeNull();
  });
});
```

In `today.spec.ts` append inside `describe('Today', ...)`:

```ts
  it('shows the logging streak chip, dashed while today is not logged yet', async () => {
    // seeded: 320 kcal today (under 800), nothing before → no streak; add yesterday's food
    const el = await render(NOW, (repo) => repo.entries.push({ ...repo.entries[0], id: 'y1', date: '2026-09-26', kcal: 1500 }));
    const chip = el.querySelector('.chip.streak')!;
    expect(chip.textContent).toContain('1');
    expect(chip.textContent).toContain('היום?');
    expect(chip.classList).toContain('pending');
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd app && npx ng test --watch=false --include=src/app/features/today/today.logic.spec.ts --include=src/app/features/today/today.spec.ts`
Expected: FAIL — `streakChip` is not exported; no `.chip.streak`.

- [ ] **Step 3: Implement**

In `today.logic.ts` change `import type { DaySummary } from '../../domain';` to `import type { DaySummary, LoggingStreak } from '../../domain';` and append:

```ts
export interface StreakChip {
  count: string;
  today: boolean;
  label: string;
}

/** The Today chip (§19); null without a streak. */
export function streakChip(s: LoggingStreak): StreakChip | null {
  if (s.days === 0) return null;
  const count = s.capped ? `${s.days}+` : String(s.days);
  return { count, today: s.todayCounted, label: `רצף דיווח ${count} ימים, ${s.todayCounted ? 'היום כבר דווח' : 'היום עוד לא דווח'}` };
}
```

In `today.ts`:
- Add `LucideFlame` to the lucide import and the `imports` array; add `streakChip` to the `./today.logic` import.
- Add to the class: `protected readonly streak = computed(() => { const a = this.state.achievements(); return a ? streakChip(a.logging) : null; });`
- In the template, first inside `<div class="row top">`:

```html
        @if (streak(); as k) {
          <span class="chip streak" [class.pending]="!k.today" role="img" [attr.aria-label]="k.label">
            <svg lucideFlame [size]="16" aria-hidden="true"></svg><span class="num">{{ k.count }}</span> ימים@if (!k.today) {<span> · היום?</span>}
          </span>
        }
```

- In `styles` after `.chip.missing`:

```css
    .chip.streak { border: 1px solid var(--border); background: var(--card); }
    .chip.streak svg { color: var(--in); }
    .chip.streak.pending { border-style: dashed; color: var(--fg-muted); }
    .chip.streak.pending svg { color: var(--fg-muted); }
```

- [ ] **Step 4: Run to verify they pass**

Run: the Step 2 command.
Expected: PASS (all Today tests, including the existing ones).

- [ ] **Step 5: Commit**

```bash
git add app/src/app/features/today/
git commit -m "feat(app): logging streak chip on Today

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Week — full week card — push #2

**Files:**
- Modify: `app/src/app/features/week/week.ts`, `week.spec.ts`
- Modify: `design-system/kal/MASTER.md`

**Interfaces:**
- Consumes: `KalState.achievementInput`, `fullWeek(input, date)`.

- [ ] **Step 1: Write the failing test**

Append to `week.spec.ts`:

```ts
describe('Week full week', () => {
  it('scores the week on screen with a dot per day', async () => {
    // Seeded Sunday 09-27: 320 kcal (under 800), 15,200 steps, weigh-in → not full. Today is Tuesday 09-29.
    TestBed.configureTestingModule({ imports: [Week], providers: [{ provide: KalRepository, useValue: seededRepository() }] });
    const state = TestBed.inject(KalState);
    state.now.set(new Date('2026-09-29T10:00:00Z'));
    state.start('u1');
    const fixture = TestBed.createComponent(Week);
    await fixture.whenStable();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.fullweek')!;
    expect(card.textContent).toContain('שבוע מלא');
    expect(card.textContent).toContain('0/7');
    expect([...card.querySelectorAll('.dots li')].map((d) => d.className)).toEqual(['partial', 'partial', 'open', 'open', 'open', 'open', 'open']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx ng test --watch=false --include=src/app/features/week/week.spec.ts`
Expected: FAIL — no `.fullweek`.

- [ ] **Step 3: Implement**

In `week.ts` add `fullWeek` to the domain import. Add to the class:

```ts
  protected readonly full = computed(() => {
    const input = this.state.achievementInput();
    return input ? fullWeek(input, this.weekDate()) : null;
  });
```

In the template, right after the week `</header>`:

```html
        @if (full(); as f) {
          <section class="card fullweek" [class.perfect]="f.perfect" [attr.aria-label]="'שבוע מלא ' + f.full + ' מתוך ' + f.of + ' ימים'">
            <div>
              <div class="muted small">{{ f.perfect ? '✦ שבוע מושלם' : 'שבוע מלא' }}</div>
              <div class="num value">{{ f.full }}/{{ f.of }}</div>
            </div>
            <ol class="dots" aria-hidden="true">
              @for (d of f.days; track d.date) { <li [class]="d.state"></li> }
            </ol>
          </section>
        }
```

In `styles`:

```css
    .fullweek { display: flex; align-items: center; justify-content: space-between; margin-block: 12px; }
    .fullweek.perfect { border-color: var(--great); }
    .dots { display: flex; gap: 5px; list-style: none; margin: 0; padding: 0; }
    .dots li { width: 14px; height: 14px; border-radius: 50%; border: 1.5px dashed var(--fg-muted); }
    .dots li.full { background: var(--out); border-color: var(--out); border-style: solid; }
    .dots li.partial { border: 1.5px solid var(--missing); }
```

In `design-system/kal/MASTER.md`, after the "Week steps card" component line add:

```
- **Full week card (§19):** card under the week header; muted "שבוע מלא" (perfect: "✦ שבוע מושלם" and a `--great` border), N/M at 20px/500, seven 14px dots from Sunday: full = `--out` fill, finished and not full = `--missing` outline, open (today not full yet, future, before the goal) = dashed `--fg-muted`. `aria-label` carries the score.
```

- [ ] **Step 4: Run the gates**

Run: `cd app && npx ng test --watch=false --include=src/app/features/week/week.spec.ts --include=src/app/features/today/today.spec.ts` then the full gates (`npm test`, `npm run typecheck`, `cd app && npx ng test --watch=false`, `cd app && npx ng build`).
Expected: PASS except the 14 known check-in failures.

- [ ] **Step 5: Commit and push #2**

```bash
git add app/src/app/features/week/week.ts app/src/app/features/week/week.spec.ts design-system/kal/MASTER.md
git commit -m "feat(app): full week score on the week screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin main
```

---

### Task 11: Steps card — records row

**Files:**
- Modify: `app/src/app/features/week/week.ts`, `week.spec.ts`

**Interfaces:**
- Consumes: `KalState.achievements().steps` (`StepsAchievements`).

- [ ] **Step 1: Write the failing test**

In `week.spec.ts`, inside `describe('Week steps', ...)`'s existing test, append after the last expectation:

```ts
    const records = card.querySelector('.records')!;
    expect(records.textContent).toContain('רצף 10K');
    expect(records.textContent).toContain('15,200');
    expect(records.textContent).toContain('27.9');
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx ng test --watch=false --include=src/app/features/week/week.spec.ts`
Expected: FAIL — no `.records`.

- [ ] **Step 3: Implement**

In `week.ts` add to the class:

```ts
  protected readonly records = computed(() => this.state.achievements()?.steps ?? null);
```

In the steps card template, between `</svg>` and `<div class="tiers ...">`:

```html
          @if (records(); as r) {
            <div class="records">
              <div><div class="muted small">רצף 10K</div><div><span class="num">{{ r.streak.days }}</span> ימים</div></div>
              <div>
                <div class="muted small">שיא יום</div>
                <div class="num">{{ r.bestDay ? fmt(r.bestDay.steps) : '—' }}</div>
                @if (r.bestDay; as b) { <div class="muted small num">{{ shortDate(b.date) }}</div> }
              </div>
              <div>
                <div class="muted small">שיא שבוע</div>
                <div class="num">{{ r.bestWeek ? fmt(r.bestWeek.steps) : '—' }}</div>
                @if (r.bestWeek; as b) { <div class="muted small num">{{ shortDate(b.date) }}</div> }
              </div>
            </div>
          }
```

In `styles`:

```css
    .records { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; margin-top: 8px; font-size: 16px; font-weight: 500; }
    .records .small { font-weight: 400; }
```

- [ ] **Step 4: Run to verify it passes**

Run: the Step 2 command.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/features/week/week.ts app/src/app/features/week/week.spec.ts
git commit -m "feat(app): 10K streak and step records on the steps card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Weight — milestone ticks and next milestone — push #3

**Files:**
- Modify: `app/src/app/features/weight/weight.logic.ts`, `weight.logic.spec.ts`, `weight.ts`, `weight.spec.ts`
- Modify: `design-system/kal/MASTER.md`

**Interfaces:**
- Consumes: `weightMilestones(goal, weighIns, today)`.
- Produces on `WeightView`: `milestones: WeightMilestones`, `ticks: { pct: number; reached: boolean }[]`.

- [ ] **Step 1: Write the failing tests**

In `weight.logic.spec.ts`, inside `describe('weightView', ...)` (goal 90 → 80, this week's mean 86.6):

```ts
  it('marks the 2 kg milestones on the bar and names the next one', () => {
    expect(v.ticks).toEqual([
      { pct: 20, reached: true },
      { pct: 40, reached: false },
      { pct: 60, reached: false },
      { pct: 80, reached: false },
    ]);
    expect(v.milestones.next).toMatchObject({ kg: 4, target: false });
    expect(v.milestones.next!.leftKg).toBeCloseTo(0.6, 10);
  });
```

In `weight.spec.ts`, append inside `describe('WeightPage', ...)`:

```ts
  it('names the next weight milestone', async () => {
    const el = (await render()).nativeElement as HTMLElement;
    // mean 85 this week against a 90 kg start: 4 kg reached, 6 kg next
    expect(el.querySelector('.next')!.textContent).toContain('אבן הדרך הבאה');
    expect(el.querySelector('.next')!.textContent).toContain('−6');
    expect(el.querySelectorAll('.ticks b.on')).toHaveLength(2);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd app && npx ng test --watch=false --include=src/app/features/weight/weight.logic.spec.ts --include=src/app/features/weight/weight.spec.ts`
Expected: FAIL — `ticks` / `.next` missing.

- [ ] **Step 3: Implement**

In `weight.logic.ts`: add `weightMilestones` and `type WeightMilestones` to the domain import; add to `WeightView`:

```ts
  milestones: WeightMilestones;
  /** Ticks on the progress bar at every milestone before the target, as % of the way. */
  ticks: { pct: number; reached: boolean }[];
```

In `weightView`, before `return`:

```ts
  const milestones = weightMilestones(goal, weighIns, today);
  const ticks = span <= 0 ? [] : milestones.milestones.slice(0, -1).map((kg) => ({
    pct: (kg / span) * 100,
    reached: milestones.reachedKg !== null && kg <= milestones.reachedKg,
  }));
```

and add `milestones, ticks,` to the returned object.

In `weight.ts`: add `imports: [LucideFlag]` to the component (import `LucideFlag` from `@lucide/angular`). In the progress section, right after the `.track` div:

```html
          <div class="ticks" aria-hidden="true">
            @for (t of v.ticks; track $index) { <b [class.on]="t.reached" [style.inset-inline-start.%]="t.pct"></b> }
          </div>
```

and after the `.ends` div:

```html
          @if (v.milestones.next; as n) {
            <p class="next small"><svg lucideFlag [size]="15" aria-hidden="true"></svg>{{ n.target ? 'היעד' : 'אבן הדרך הבאה' }}: <span class="num" dir="ltr">−{{ fmt(n.kg, 1) }}</span> ק״ג · עוד <span class="num">{{ fmt(n.leftKg, 1) }}</span></p>
          } @else if (v.milestones.reachedTarget) {
            <p class="next small"><svg lucideFlag [size]="15" aria-hidden="true"></svg>הגעת ליעד</p>
          }
```

Styles:

```css
    .ticks { position: relative; height: 6px; }
    .ticks b { position: absolute; top: 0; width: 2px; height: 6px; background: var(--fg-muted); }
    .ticks b.on { background: var(--out); }
    .next { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; }
    .next svg { color: var(--out); }
```

In `design-system/kal/MASTER.md`, in the "Weight screen" component line after the progress bar clause add: `, with a 2px tick every 2 kg (reached `--out`, others `--fg-muted`) and "אבן הדרך הבאה: −4 ק״ג · עוד 0.7" under it (flag icon, "הגעת ליעד" at the target)`.

- [ ] **Step 4: Run the gates**

Run: the Step 2 command, then the full gates.
Expected: PASS except the 14 known check-in failures.

- [ ] **Step 5: Commit and push #3**

```bash
git add app/src/app/features/weight/ design-system/kal/MASTER.md
git commit -m "feat(app): weight milestone ticks and the next milestone

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin main
```

---

### Task 13: Celebrations document plumbing

**Files:**
- Modify: `app/src/app/core/repository.ts`, `app/src/app/core/firestore-repository.ts`, `app/src/testing/fake-repository.ts`, `app/src/app/core/kal-state.ts`, `app/src/app/core/kal-state.spec.ts`

**Interfaces:**
- Consumes: `CelebrationState` (Task 6).
- Produces: `KalRepository.watchCelebrations(uid, cb: (s: CelebrationState | null) => void): Unsubscribe`, `saveCelebrations(uid, s: CelebrationState): Promise<void>`; `FakeRepository.celebrations: CelebrationState | null` (default `null`), `savedCelebrations: CelebrationState[]`; `KalState.celebrationState: WritableSignal<CelebrationState | null | undefined>` (`undefined` until the document arrives, `null` when it does not exist).

- [ ] **Step 1: Write the failing test**

Append inside `describe('KalState', ...)`:

```ts
  it('tracks the celebrations document: null when it does not exist', () => {
    expect(setup().celebrationState()).toBeNull();
    const repo = seededRepository();
    repo.celebrations = { seen: ['weight-g1-2'] };
    expect(setup(repo).celebrationState()).toEqual({ seen: ['weight-g1-2'] });
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx ng test --watch=false --include=src/app/core/kal-state.spec.ts`
Expected: FAIL — `celebrations` / `celebrationState` do not exist.

- [ ] **Step 3: Implement**

`repository.ts`: add `CelebrationState` to the domain type import and, after `saveTipState`:

```ts
  abstract watchCelebrations(uid: string, cb: (state: CelebrationState | null) => void): Unsubscribe;
  abstract saveCelebrations(uid: string, state: CelebrationState): Promise<void>;
```

`firestore-repository.ts`: add `type CelebrationState` to the domain import and, after `saveTipState`:

```ts
  private celebrationsDoc(uid: string) {
    return doc(this.db, 'users', uid, 'meta', 'celebrations');
  }

  watchCelebrations(uid: string, cb: (state: CelebrationState | null) => void): Unsubscribe {
    return onSnapshot(this.celebrationsDoc(uid), (s) => cb(s.exists() ? { seen: ((s.data() as Partial<CelebrationState>).seen ?? []) } : null));
  }

  saveCelebrations(uid: string, state: CelebrationState): Promise<void> {
    return setDoc(this.celebrationsDoc(uid), state);
  }
```

`fake-repository.ts`: add `type CelebrationState` to the domain import; fields after `savedTipStates`:

```ts
  /** null: the document does not exist yet (first run). */
  celebrations: CelebrationState | null = null;
  savedCelebrations: CelebrationState[] = [];
```

and methods after `saveTipState`:

```ts
  watchCelebrations(_uid: string, cb: (state: CelebrationState | null) => void): Unsubscribe {
    cb(this.celebrations);
    return () => undefined;
  }

  saveCelebrations(_uid: string, state: CelebrationState): Promise<void> {
    this.savedCelebrations.push(state);
    this.celebrations = state;
    return this.result();
  }
```

`kal-state.ts`: add `type CelebrationState` to the domain import; signal after `tipState`:

```ts
  /** `undefined` until the celebrations document arrives; `null` when it does not exist (first run). */
  readonly celebrationState = signal<CelebrationState | null | undefined>(undefined);
```

watcher after the tip-state watcher: `this.repo.watchCelebrations(uid, (c) => this.celebrationState.set(c)),`; in `stop`: `this.celebrationState.set(undefined);`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx ng test --watch=false --include=src/app/core/kal-state.spec.ts && cd app && npx ng build`
Expected: PASS; build compiles (the Firestore repository implements both new methods).

- [ ] **Step 5: Commit**

```bash
git add app/src/app/core/ app/src/testing/fake-repository.ts
git commit -m "feat(app): celebrations document in the repository and state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: CelebrationService

**Files:**
- Create: `app/src/app/features/celebrations/celebration.service.ts`, `celebration.service.spec.ts`

**Interfaces:**
- Consumes: `KalState.{achievements, goal, today, uid, loaded, entriesLoaded, celebrationState}`, `DailyTipService.pick`, `earnedCelebrations`, `dueCelebrations`.
- Produces: `CelebrationService.due: Signal<Celebration[]>` (empty while the daily tip is open, on `/confirm`, or before everything loaded), `close(): void`.

- [ ] **Step 1: Write the failing tests**

Create `celebration.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { NOW, seededRepository, type FakeRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { EMPTY_TIP_STATE } from '../../domain';
import { CelebrationService } from './celebration.service';

// Seeded: goal 90 → 80, weigh-in 85 on 09-27 → weight milestones 2 and 4 earned.
async function setup(prepare: (repo: FakeRepository) => void = () => undefined) {
  const repo = seededRepository();
  prepare(repo);
  TestBed.configureTestingModule({ providers: [{ provide: KalRepository, useValue: repo }] });
  const state = TestBed.inject(KalState);
  state.now.set(NOW);
  state.start('u1');
  const service = TestBed.inject(CelebrationService);
  TestBed.tick();
  return { repo, service };
}

describe('CelebrationService', () => {
  it('first run: saves what is already earned as seen, without a dialog', async () => {
    const { repo, service } = await setup();
    expect(repo.savedCelebrations[0].seen).toEqual(['weight-g1-2', 'weight-g1-4']);
    expect(service.due()).toEqual([]);
  });

  it('shows the highest new one of each kind, and close marks all as seen', async () => {
    const { repo, service } = await setup((r) => (r.celebrations = { seen: [] }));
    expect(service.due().map((c) => c.key)).toEqual(['weight-g1-4']);
    service.close();
    expect(repo.savedCelebrations.at(-1)!.seen).toEqual(['weight-g1-2', 'weight-g1-4']);
    expect(service.due()).toEqual([]);
  });

  it('waits while the daily tip is open', async () => {
    const { service } = await setup((r) => {
      r.celebrations = { seen: [] };
      r.tipState = EMPTY_TIP_STATE;
    });
    expect(service.due()).toEqual([]);
  });

  it('waits for the entries before seeding or showing anything', async () => {
    const { repo, service } = await setup((r) => (r.watchEntries = () => () => undefined));
    expect(repo.savedCelebrations).toEqual([]);
    expect(service.due()).toEqual([]);
  });

  it('keeps a seen celebration seen when the data no longer earns it', async () => {
    const { repo, service } = await setup((r) => {
      r.celebrations = { seen: ['weight-g1-2', 'weight-g1-4', 'weight-g1-6'] };
    });
    expect(service.due()).toEqual([]);
    service.close();
    expect(repo.savedCelebrations.at(-1)!.seen).toContain('weight-g1-6');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx ng test --watch=false --include=src/app/features/celebrations/celebration.service.spec.ts`
Expected: FAIL — cannot find `./celebration.service`.

- [ ] **Step 3: Implement**

Create `celebration.service.ts`:

```ts
import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Toast } from '../../core/toast';
import { dueCelebrations, earnedCelebrations, type Celebration } from '../../domain';
import { DailyTipService } from '../tips/daily-tip.service';

@Injectable({ providedIn: 'root' })
export class CelebrationService {
  private readonly state = inject(KalState);
  private readonly repo = inject(KalRepository);
  private readonly toast = inject(Toast);
  private readonly dailyTip = inject(DailyTipService);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Everything earned now; null until every source and the celebrations document have arrived. */
  private readonly earned = computed(() => {
    const a = this.state.achievements();
    const goal = this.state.goal();
    if (!a || !goal || !this.state.loaded() || !this.state.entriesLoaded() || this.state.celebrationState() === undefined) return null;
    return earnedCelebrations(a, goal.id, this.state.today());
  });

  /** §19: shown after the daily tip, never on the confirm screen. */
  readonly due = computed<Celebration[]>(() => {
    const earned = this.earned();
    const doc = this.state.celebrationState();
    if (!earned || !doc || this.dailyTip.pick() || this.url().startsWith('/confirm')) return [];
    return dueCelebrations(earned, doc.seen);
  });

  constructor() {
    // First run: what is already earned counts as seen, so the update does not open a flood of dialogs.
    effect(() => {
      const earned = this.earned();
      if (earned && this.state.celebrationState() === null) untracked(() => this.save(earned.map((c) => c.key)));
    });
  }

  close(): void {
    const earned = this.earned();
    const doc = this.state.celebrationState();
    if (!earned || !doc) return;
    this.save([...new Set([...doc.seen, ...earned.map((c) => c.key)])]);
  }

  private save(seen: string[]): void {
    const uid = this.state.uid();
    if (!uid) return;
    const next = { seen };
    this.state.celebrationState.set(next);
    this.repo.saveCelebrations(uid, next).catch(() => this.toast.show('השמירה נכשלה'));
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: the Step 2 command.
Expected: PASS. If the first test sees no save, the effect has not flushed: keep `TestBed.tick()` in `setup` (Angular 21 flushes root effects there).

- [ ] **Step 5: Commit**

```bash
git add app/src/app/features/celebrations/
git commit -m "feat(app): celebration service with a silent first run

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Celebration dialog, ordering with the check-in — push #4

**Files:**
- Create: `app/src/app/features/celebrations/celebration.logic.ts`, `celebration.logic.spec.ts`, `celebration.ts`, `celebration.spec.ts`
- Modify: `app/src/app/shell/shell.ts`, `app/src/app/features/today/today.ts`, `today.spec.ts`
- Modify: `design-system/kal/MASTER.md`

**Interfaces:**
- Consumes: `CelebrationService.{due, close}`, `Celebration`, `STEPS_GOAL`, `fmt`.
- Produces: `celebrationText(c: Celebration): { title: string; line: string }`; component `CelebrationDialog` (`<app-celebration />`; named so it does not clash with the domain `Celebration` type).

- [ ] **Step 1: Write the failing tests**

Create `celebration.logic.spec.ts`:

```ts
import { celebrationText } from './celebration.logic';

describe('celebrationText', () => {
  const c = (kind: any, value: number, target = false) => ({ key: 'k', kind, value, target });

  it('words each kind, never "on track" for logging or steps', () => {
    expect(celebrationText(c('streak', 7)).title).toBe('7 ימים ברצף!');
    expect(celebrationText(c('week', 7)).line).toBe('7 מתוך 7 ימים מלאים: אוכל, צעדים ושקילה.');
    expect(celebrationText(c('steps-streak', 3)).title).toBe('3 ימים ברצף מעל 10,000 צעדים!');
    expect(celebrationText(c('steps-day', 14200)).line).toBe('14,200 צעדים היום.');
    expect(celebrationText(c('steps-week', 9125)).line).toBe('ממוצע של 9,125 צעדים ביום.');
    expect(celebrationText(c('weight', 4)).title).toBe('ירדת 4 ק״ג!');
    expect(celebrationText(c('weight', 10, true)).title).toBe('הגעת ליעד!');
  });
});
```

Create `celebration.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { NOW, seededRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { CelebrationDialog } from './celebration';

describe('Celebration dialog', () => {
  it('shows the new milestone and closes with יאללה', async () => {
    const repo = seededRepository();
    repo.celebrations = { seen: [] };
    TestBed.configureTestingModule({ imports: [CelebrationDialog], providers: [{ provide: KalRepository, useValue: repo }] });
    const state = TestBed.inject(KalState);
    state.now.set(NOW);
    state.start('u1');
    const fixture = TestBed.createComponent(CelebrationDialog);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="dialog"]')!.textContent).toContain('ירדת 4 ק״ג!');
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(repo.savedCelebrations.at(-1)!.seen).toContain('weight-g1-4');
  });
});
```

In `today.spec.ts` append inside `describe('Today', ...)`:

```ts
  it('waits with the check-in while a celebration is open', async () => {
    await render(new Date('2026-09-27T19:30:00Z'), (repo) => (repo.celebrations = { seen: [] }));
    expect(TestBed.inject(CheckInService).open()).toBe(false);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd app && npx ng test --watch=false --include=src/app/features/celebrations/celebration.logic.spec.ts --include=src/app/features/celebrations/celebration.spec.ts --include=src/app/features/today/today.spec.ts`
Expected: FAIL — missing modules; the check-in opens.

- [ ] **Step 3: Implement**

Create `celebration.logic.ts`:

```ts
import { STEPS_GOAL, type Celebration } from '../../domain';
import { fmt } from '../../shared/format';

const WEIGHT_LINE = 'לפי ממוצע השקילות השבועי.';

/** §19 copy: logging and steps never say "on track"; only a weight milestone speaks about weight. */
export function celebrationText(c: Celebration): { title: string; line: string } {
  switch (c.kind) {
    case 'streak':
      return { title: `${c.value} ימים ברצף!`, line: 'דיווחת כל יום. הדיווח הכן הוא מה שגורם לכל השאר לעבוד.' };
    case 'week':
      return { title: 'שבוע מושלם!', line: `${c.value} מתוך ${c.value} ימים מלאים: אוכל, צעדים ושקילה.` };
    case 'steps-streak':
      return { title: `${c.value} ימים ברצף מעל ${fmt(STEPS_GOAL)} צעדים!`, line: 'ממשיכים ללכת.' };
    case 'steps-day':
      return { title: 'שיא צעדים חדש!', line: `${fmt(c.value)} צעדים היום.` };
    case 'steps-week':
      return { title: 'שבוע שיא בצעדים!', line: `ממוצע של ${fmt(c.value)} צעדים ביום.` };
    case 'weight':
      return c.target ? { title: 'הגעת ליעד!', line: WEIGHT_LINE } : { title: `ירדת ${fmt(c.value)} ק״ג!`, line: WEIGHT_LINE };
  }
}
```

Create `celebration.ts`:

```ts
import { Component, inject, viewChild, type AfterViewInit, type ElementRef } from '@angular/core';
import { LucideFlag, LucideFlame, LucideFootprints, LucideSparkles, LucideTrophy } from '@lucide/angular';
import { CelebrationService } from './celebration.service';
import { celebrationText } from './celebration.logic';

@Component({
  selector: 'app-celebration',
  imports: [LucideFlag, LucideFlame, LucideFootprints, LucideSparkles, LucideTrophy],
  template: `
    @if (celebrate.due(); as items) {
      @if (items.length > 0) {
        <div class="scrim"></div>
        <div class="confetti" aria-hidden="true">
          @for (i of pieces; track i) { <i [style.--a]="i * 22.5 + 'deg'"></i> }
        </div>
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="celebration-title" (keydown.escape)="celebrate.close()">
          @if (items.length === 1) {
            <div class="icon" [class]="items[0].kind">
              @switch (items[0].kind) {
                @case ('streak') { <svg lucideFlame [size]="32" aria-hidden="true"></svg> }
                @case ('week') { <svg lucideSparkles [size]="32" aria-hidden="true"></svg> }
                @case ('weight') { <svg lucideFlag [size]="32" aria-hidden="true"></svg> }
                @case ('steps-week') { <svg lucideTrophy [size]="32" aria-hidden="true"></svg> }
                @default { <svg lucideFootprints [size]="32" aria-hidden="true"></svg> }
              }
            </div>
            <h2 id="celebration-title">{{ text(items[0]).title }}</h2>
            <p class="line">{{ text(items[0]).line }}</p>
          } @else {
            <h2 id="celebration-title">כמה הישגים חדשים</h2>
            <ul class="list">
              @for (c of items; track c.key) {
                <li><b>{{ text(c).title }}</b><span class="muted">{{ text(c).line }}</span></li>
              }
            </ul>
          }
          <button #ok type="button" class="primary" (click)="celebrate.close()">יאללה</button>
        </section>
      }
    }
  `,
  styles: `
    .scrim { position: fixed; inset: 0; background: rgb(0 0 0 / 0.6); z-index: 10; }
    .dialog {
      position: fixed; z-index: 11; inset-inline: 16px; top: 50%; transform: translateY(-50%);
      max-width: 400px; margin-inline: auto; max-height: calc(100dvh - 48px); overflow-y: auto; text-align: center;
      background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 24px 20px 20px;
    }
    .icon { width: 64px; height: 64px; margin: 0 auto 12px; border-radius: 50%; display: grid; place-items: center; color: var(--on-primary); background: var(--out); }
    .icon.streak { background: var(--in); }
    .icon.week, .icon.steps-week { background: var(--great); }
    h2 { font-size: 22px; font-weight: 700; margin: 0 0 6px; }
    .line { margin: 0 0 20px; color: var(--fg-muted); line-height: 1.6; }
    .list { list-style: none; margin: 0 0 20px; padding: 0; text-align: start; display: grid; gap: 10px; }
    .list li { display: grid; }
    .list .muted { font-size: 13px; }
    button { width: 100%; }
    .confetti { position: fixed; z-index: 12; top: 40%; left: 50%; width: 0; height: 0; pointer-events: none; }
    .confetti i { position: absolute; width: 6px; height: 10px; border-radius: 2px; opacity: 0; background: var(--out); }
    .confetti i:nth-child(4n + 1) { background: var(--great); }
    .confetti i:nth-child(4n + 2) { background: var(--in); }
    .confetti i:nth-child(4n + 3) { background: var(--star); }
    /* §19: a short burst, a recorded exception to the 150–250 ms motion rule; none under reduced motion. */
    @media (prefers-reduced-motion: no-preference) {
      .confetti i { animation: burst 900ms ease-out forwards; }
      .dialog { animation: rise 200ms ease-out; }
    }
    @keyframes burst {
      from { opacity: 1; transform: translate(0, 0) rotate(0); }
      to { opacity: 0; transform: translate(calc(cos(var(--a)) * 140px), calc(sin(var(--a)) * 140px + 80px)) rotate(540deg); }
    }
    @keyframes rise { from { opacity: 0; transform: translateY(calc(-50% + 12px)); } }
  `,
})
export class CelebrationDialog implements AfterViewInit {
  protected readonly celebrate = inject(CelebrationService);
  protected readonly text = celebrationText;
  protected readonly pieces = Array.from({ length: 16 }, (_, i) => i);
  private readonly ok = viewChild<ElementRef<HTMLButtonElement>>('ok');

  ngAfterViewInit(): void {
    this.ok()?.nativeElement.focus();
  }
}
```

`shell.ts`: import `CelebrationDialog` (from `../features/celebrations/celebration`) and `CelebrationService`; add `CelebrationDialog` to `imports`; add `protected readonly celebrate = inject(CelebrationService);`; in the template after the daily-tip block:

```html
    @if (celebrate.due().length > 0) {
      <app-celebration />
    }
```

`today.ts`: inject `CelebrationService` (`private readonly celebrate = inject(CelebrationService);`) and change the check-in condition to

```ts
      } else if (!this.dailyTip.pick() && this.celebrate.due().length === 0 && shouldPromptCheckIn(this.state.now(), day, this.checkin.dismissedFor() === today)) {
```

`design-system/kal/MASTER.md`: after the "Daily tip dialog" component line add:

```
- **Celebration dialog (§19):** like the daily tip (scrim, centred card, radius 20px) but centred text: a 64px circle icon (streak `--in` flame, full week / best week `--great`, weight `--out` flag, steps `--out` footprints), title 22px/700, one muted line, a full-width primary "יאללה" (focused on open; Escape closes). Several at once: "כמה הישגים חדשים" and a list. Opens after the daily tip and before the 22:00 check-in.
```

and in "Deviations from the skill output" add the row:

```
| CSS transitions 150–250ms only | A 900 ms confetti burst on the celebration dialog (transform and opacity, 16 pieces, none under reduced motion) | The owner asked for a celebration that feels special (§19) |
```

- [ ] **Step 4: Run the gates and check it in a preview**

Run: the Step 2 command, then the full gates.
Expected: PASS except the 14 known check-in failures.

Preview (the app needs a Google sign-in, so render the component instead): write a throwaway `app/src/app/features/celebrations/zz-dump.spec.ts` that renders `Celebration` with `repo.celebrations = { seen: [] }` (and a second case with two kinds due, e.g. add a 7-day food streak), writes `document.head` styles plus the component HTML to the scratchpad with `(globalThis as any).process.getBuiltinModule('fs').writeFileSync(...)`, delete the spec, serve the scratchpad with a temporary `.claude/launch.json` static server, and check it at 375 px in dark and light. Remove `.claude/launch.json` afterwards. Also look at Today (chip), Week (full card, records) and Weight (ticks) the same way.

- [ ] **Step 5: Commit and push #4**

```bash
git add app/src/app/features/celebrations/ app/src/app/shell/shell.ts app/src/app/features/today/today.ts app/src/app/features/today/today.spec.ts design-system/kal/MASTER.md
git commit -m "feat(app): celebration dialog after the daily tip, before the check-in

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin main
```
