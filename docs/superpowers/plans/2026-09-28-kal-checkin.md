# kal Daily Check-in, Penalty and Reality Check — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the activity-level estimate with a daily check-in (steps, workout type and its calories, weigh-in), count days without food as 3,200 kcal, make the weight trend the only judge of progress, and add a monthly view with workout counts.

**Architecture:** All rules live in `domain/` (settings defaults, expenditure with default steps and as-entered workout calories, missing-day penalty inside `summarizeDay`, shared range summaries for week and month, `realityCheck`). The app gets a check-in sheet, a redesigned Today (weigh-in chip, reality line, waterfall), and a Week | Month switch. The Claude skill reads the same domain results.

**Tech Stack:** unchanged from plan 2 (Angular 21, Vitest, Firebase 12, Chart.js, @lucide/angular; root TS 7 + Vitest).

**Spec:** `docs/superpowers/specs/2026-09-27-kal-design.md` §14 (added 2026-09-28). UI: `design-system/kal/MASTER.md`.

## Global Constraints

- The scale is the judge: every "on track" status — Today, the Weight tab, Week/Month and the Claude skill — comes from `realityCheck` (weight trend only). `no_data` (fewer than 4 weigh-ins in 14 days) is never green. The old `planStatus` chip and the skill's `status` field go away. "Remaining to eat" is a neutral color. Month-calendar deficit days get a neutral tint, never the success token.
- Settings defaults (stored optionally in `profile.settings`, read through `settingsOf`): `lowDayThresholdKcal` 800, `defaultSteps` 3500, `missingDayKcal` 3200.
- Expenditure: `bmr + stepsKcal(manual ?? garmin ?? defaultSteps) + workouts`; manual workouts count their `kcal` as entered; Garmin workouts keep the BMR-share subtraction. No activity factor anywhere.
- Penalty: date < today, date ≥ goal.startDate, logged kcal < 800 → counted as 3200; computed only, never written; used by week, month, reality, the report-gap check (Weight and Week tabs) and the skill.
- Target-below-BMR warning: typical day `bmr + stepsKcal(defaultSteps) − deficit < 0.75 × bmr`.
- Check-in: opens from 22:00 Asia/Jerusalem (after days and weigh-ins have loaded) until the day has `checkedInAt`. "Not now" dismisses until the app next comes to the foreground. Saving the sheet, or confirming a link with `id: "checkin"` for today, dismisses it too. The sheet's workout carries `linkId: "checkin"` so re-saving replaces it.
- Activity ops: `steps` replaces the day's steps; `workouts` replaces that link id's workouts (`[]` removes them); an op without `workouts` keeps the day's workouts.
- Workout types: Upper, Lower, Push, Pull, Legs, Full body, Cardio, אחר. `durationMin` is optional.
- Reality: window 14 days; planned change = −pace × 14 / 7 while the trend is above target, else 0; the logged deficit uses only days ≥ goal start; `gaining` if trend change > +0.1 kg; `stalled` if planned < 0 and change > 0.5 × planned; else `on_track`.
- Writes stay non-awaited in the UI (offline-safe). App imports domain only via `app/src/app/domain.ts`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A past day with only a coffee logged (< 800 kcal) must count as 3,200 everywhere (week, month, reality, report gap, skill) → Task 1, Task 2, Task 3 (month test) and Task 7 tests.
2. Re-saving the check-in must replace, not add, the day's workout; a Claude op with `id: "checkin"` and only steps must keep that workout → Task 1 (`planWrites`, `mergeManual`) and Task 5 tests.
3. Few weigh-ins must never show green anywhere → Task 2 (`no_data`), Task 3 (no skill `status`), Task 4 (`realityLine`, Weight tab) tests.
4. The check-in must not open before data loads, reopen right after saving, after a confirmed check-in link, or after "not now" → Task 4 (`whenLoaded`), Task 5 and Task 6 tests.
5. Existing profiles in Firestore have `activityLevel` and no new settings fields → Task 1 (`settingsOf`) and Task 4 tests use a legacy profile.

## Deviation notes

1. Spec §14 says the below-BMR warning fires when `bmr + stepsKcal(defaultSteps) − deficit < bmr`. With the conservative model that is true for almost every deficit, so the warning would always show. Implemented as `< 0.75 × bmr`.
2. Spec §14 does not define "the planned amount" for `stalled`. The plan line's own change is 0 on the goal's first days and after its end date, which would read as on track; the plan's pace over the window is used instead.
3. The quick-add sheet loses its activity tab: the check-in sheet is the only in-app place for steps and workouts, and past days go through Claude with `id: "checkin"`. Two entry paths with different replace/add rules would confuse.

Spec §14 and MASTER.md are updated in Task 8.

---

### Task 1: Domain — settings, expenditure, penalty, workouts without duration, check-in writes

**Files:**
- Create: `domain/settings.ts`
- Modify: `domain/types.ts`, `domain/expenditure.ts`, `domain/summary.ts` (summarizeDay only), `domain/link.ts`, `domain/apply.ts`, `domain/index.ts`, `domain/testing.ts`
- Test: `domain/settings.test.ts`, `domain/expenditure.test.ts` (rewrite), `domain/summary.test.ts`, `domain/link.test.ts`, `domain/apply.test.ts`

**Interfaces:**
- Produces: `settingsOf(p: Pick<Profile, 'settings'>): Settings` (`{ lowDayThresholdKcal, defaultSteps, missingDayKcal }`); `WORKOUT_TYPES`; `ExpenditureOptions { weightKg; heightCm; bmrKcal; defaultSteps }`; `WorkoutBurn { type; kcal; source: 'manual' | 'garmin' }`; `Expenditure { bmr; steps; stepsSource: 'manual' | 'garmin' | 'default'; stepsKcal; workouts: WorkoutBurn[]; workoutsKcal; out }` (no `source`, no `ACTIVITY_FACTORS`); `DayInput.today?: string`; `DaySummary.imputed: boolean`, `DaySummary.countedKcal: number`; `Workout.durationMin?`; `Day.checkedInAt?`; `Profile.activityLevel?`; `Profile.settings { lowDayThresholdKcal; defaultSteps?; missingDayKcal? }`; `CHECKIN_LINK_ID = 'checkin'`; `PlannedWrites.checkIns: string[]`; `ActivityWrite.workouts?: Workout[]` (absent keeps the day's workouts; `[]` removes this link's).

- [ ] **Step 1: Write the failing tests**

`domain/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { settingsOf } from './settings.ts';

describe('settingsOf', () => {
  it('fills defaults for a legacy profile', () => {
    expect(settingsOf({ settings: { lowDayThresholdKcal: 800 } })).toEqual({ lowDayThresholdKcal: 800, defaultSteps: 3500, missingDayKcal: 3200 });
  });

  it('keeps stored values', () => {
    expect(settingsOf({ settings: { lowDayThresholdKcal: 900, defaultSteps: 4000, missingDayKcal: 3000 } })).toEqual({ lowDayThresholdKcal: 900, defaultSteps: 4000, missingDayKcal: 3000 });
  });

  it('survives a profile without settings', () => {
    expect(settingsOf({} as never).missingDayKcal).toBe(3200);
  });
});
```

Replace `domain/expenditure.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { expenditure, kcalPerStep } from './expenditure.ts';
import type { Day } from './types.ts';

const opts = { weightKg: 85, heightCm: 178, bmrKcal: 1792.5, defaultSteps: 3500 };
const run = { type: 'running', durationMin: 45, kcal: 520, steps: 6000 };

describe('kcalPerStep', () => {
  it('uses 0.5 kcal/kg/km with stride 0.415 x height', () => {
    expect(kcalPerStep(85, 178)).toBeCloseTo(0.03139475, 10);
  });
});

describe('expenditure', () => {
  it('uses the default steps when none were entered', () => {
    const e = expenditure(undefined, opts);
    expect(e.stepsSource).toBe('default');
    expect(e.steps).toBe(3500);
    expect(e.out).toBeCloseTo(1792.5 + 3500 * kcalPerStep(85, 178), 8);
  });

  it('adds Garmin step calories to BMR', () => {
    const e = expenditure({ date: '2026-09-27', garmin: { steps: 10000, workouts: [] } }, opts);
    expect(e.stepsSource).toBe('garmin');
    expect(e.stepsKcal).toBeCloseTo(313.9475, 4);
  });

  it('removes workout steps and the BMR share of Garmin workouts', () => {
    const e = expenditure({ date: '2026-09-27', garmin: { steps: 15200, workouts: [run] } }, opts);
    expect(e.stepsKcal).toBeCloseTo(288.8317, 4);
    expect(e.workouts).toEqual([{ type: 'running', kcal: expect.closeTo(463.984375, 6), source: 'garmin' }]);
    expect(e.out).toBeCloseTo(2545.316075, 4);
  });

  it('lets manual steps replace Garmin steps and never goes negative', () => {
    const e = expenditure({ date: '2026-09-27', garmin: { steps: 15200, workouts: [run] }, manual: { steps: 5000 } }, opts);
    expect(e.stepsSource).toBe('manual');
    expect(e.stepsKcal).toBe(0);
  });

  it('counts manual workout calories as entered, without a duration', () => {
    const day: Day = { date: '2026-09-27', manual: { steps: 8000, workouts: [{ type: 'Push', kcal: 350 }] } };
    const e = expenditure(day, opts);
    expect(e.workouts).toEqual([{ type: 'Push', kcal: 350, source: 'manual' }]);
    expect(e.workoutsKcal).toBe(350);
  });
});
```

In `domain/summary.test.ts`, replace the test `'warns when the target falls below BMR'` with:

```ts
  it('warns when a typical day target falls far below BMR', () => {
    const goal = { ...testGoal, dailyDeficitKcal: 1500 };
    const w = summarizeDay({ date, entries: [], profile: testProfile, goal, weighIns });
    const warning = w.warnings.find((x) => x.code === 'below_bmr')!;
    expect(warning.limit).toBe(1792.5);
    expect(warning.value).toBeCloseTo(1792.5 + 3500 * 0.03139475 - 1500, 2);
  });
```

and add inside `describe('summarizeDay', …)`:

```ts
  it('counts a finished day with too little food as the missing-day penalty', () => {
    const coffee = [makeEntry({ date: '2026-09-26', kcal: 2 })];
    const past = summarizeDay({ date: '2026-09-26', today: '2026-09-27', entries: coffee, profile: testProfile, goal: testGoal, weighIns });
    expect(past.imputed).toBe(true);
    expect(past.countedKcal).toBe(3200);
    expect(past.intake.kcal).toBe(2);
  });

  it('never penalizes today or days before the goal', () => {
    expect(summarizeDay({ date, today: date, entries: [], profile: testProfile, goal: testGoal, weighIns }).imputed).toBe(false);
    expect(summarizeDay({ date: '2026-08-20', today: date, entries: [], profile: testProfile, goal: testGoal, weighIns }).imputed).toBe(false);
  });

  it('keeps real intake once enough food is logged', () => {
    const s = summarizeDay({ date: '2026-09-26', today: date, entries: [makeEntry({ date: '2026-09-26', kcal: 1900 })], profile: testProfile, goal: testGoal, weighIns });
    expect(s.imputed).toBe(false);
    expect(s.countedKcal).toBe(1900);
  });
```

In `domain/link.test.ts` add inside `describe('validatePayload', …)`:

```ts
  it('accepts a workout without a duration', () => {
    const op = { op: 'activity', id: 'checkin', date: '2026-09-27', workouts: [{ type: 'Push', kcal: 350 }] };
    expect(validatePayload({ v: 1, ops: [op] })).toEqual({ v: 1, ops: [op] });
  });
```

In `domain/apply.test.ts` add inside `describe('planWrites', …)`:

```ts
  it('marks the day checked in for a check-in activity', () => {
    const w2 = planWrites({ v: 1, ops: [{ op: 'activity', id: 'checkin', date: '2026-09-27', steps: 9000 }] }, { source: 'link', time: '22:10' });
    expect(w2.checkIns).toEqual(['2026-09-27']);
    expect(w.checkIns).toEqual([]);
  });

  it("keeps the day's workouts when an activity op has only steps", () => {
    const steps = planWrites({ v: 1, ops: [{ op: 'activity', id: 'checkin', date: '2026-09-27', steps: 9000 }] }, { source: 'link', time: '22:10' });
    expect(steps.activities[0]).toEqual({ date: '2026-09-27', linkId: 'checkin', steps: 9000 });
    const existing = { steps: 5000, workouts: [{ type: 'Push', kcal: 350, linkId: 'checkin' }] };
    expect(mergeManual(existing, steps.activities[0])).toEqual({ steps: 9000, workouts: existing.workouts });
  });
```

- [ ] **Step 2: Run to verify failure**

Run (root): `npx vitest run domain`
Expected: FAIL — `./settings.ts` missing; expenditure/summary/link/apply tests fail on the new fields.

- [ ] **Step 3: Implement**

`domain/settings.ts`:

```ts
import type { Profile } from './types.ts';

export interface Settings {
  lowDayThresholdKcal: number;
  defaultSteps: number;
  missingDayKcal: number;
}

export function settingsOf(profile: Pick<Profile, 'settings'>): Settings {
  const s: Partial<Settings> = profile.settings ?? {};
  return {
    lowDayThresholdKcal: s.lowDayThresholdKcal ?? 800,
    defaultSteps: s.defaultSteps ?? 3500,
    missingDayKcal: s.missingDayKcal ?? 3200,
  };
}
```

`domain/types.ts` changes:
- `Profile.activityLevel: ActivityLevel;` → `activityLevel?: ActivityLevel;`
- `settings: { lowDayThresholdKcal: number };` → `settings: { lowDayThresholdKcal: number; defaultSteps?: number; missingDayKcal?: number };`
- `Workout.durationMin: number;` → `durationMin?: number;`
- `Day` gains `checkedInAt?: string;` (after `manual?`).

Replace `domain/expenditure.ts` with:

```ts
import type { Day } from './types.ts';

export const WORKOUT_TYPES = ['Upper', 'Lower', 'Push', 'Pull', 'Legs', 'Full body', 'Cardio', 'אחר'] as const;

export interface ExpenditureOptions {
  weightKg: number;
  heightCm: number;
  bmrKcal: number;
  defaultSteps: number;
}

export interface WorkoutBurn {
  type: string;
  kcal: number;
  source: 'manual' | 'garmin';
}

export interface Expenditure {
  bmr: number;
  steps: number;
  stepsSource: 'manual' | 'garmin' | 'default';
  stepsKcal: number;
  workouts: WorkoutBurn[];
  workoutsKcal: number;
  out: number;
}

export function kcalPerStep(weightKg: number, heightCm: number): number {
  const strideKm = (0.415 * heightCm) / 100 / 1000;
  return 0.5 * weightKg * strideKm;
}

export function expenditure(day: Day | undefined, opts: ExpenditureOptions): Expenditure {
  const manualSteps = day?.manual?.steps;
  const garminSteps = day?.garmin?.steps;
  const steps = manualSteps ?? garminSteps ?? opts.defaultSteps;
  const stepsSource = manualSteps !== undefined ? 'manual' : garminSteps !== undefined ? 'garmin' : 'default';
  const garmin = day?.garmin?.workouts ?? [];
  const manual = day?.manual?.workouts ?? [];
  const workoutSteps = [...garmin, ...manual].reduce((sum, w) => sum + (w.steps ?? 0), 0);
  const stepsKcal = Math.max(0, steps - workoutSteps) * kcalPerStep(opts.weightKg, opts.heightCm);
  const bmrPerMin = opts.bmrKcal / 1440;
  const workouts: WorkoutBurn[] = [
    // Garmin reports gross workout calories; its resting share is already in BMR.
    ...garmin.map((w) => ({ type: w.type, kcal: Math.max(0, w.kcal - bmrPerMin * (w.durationMin ?? 0)), source: 'garmin' as const })),
    // Manual workouts are the calories burned in the workout, as the owner enters them.
    ...manual.map((w) => ({ type: w.type, kcal: Math.max(0, w.kcal), source: 'manual' as const })),
  ];
  const workoutsKcal = workouts.reduce((sum, w) => sum + w.kcal, 0);
  return { bmr: opts.bmrKcal, steps, stepsSource, stepsKcal, workouts, workoutsKcal, out: opts.bmrKcal + stepsKcal + workoutsKcal };
}
```

`domain/summary.ts` (summarizeDay part):
- Imports: replace `import { ACTIVITY_FACTORS, expenditure, type Expenditure } from './expenditure.ts';` with `import { expenditure, kcalPerStep, type Expenditure } from './expenditure.ts';` and add `import { settingsOf } from './settings.ts';`.
- `DaySummary` gains `imputed: boolean;` and `countedKcal: number;`.
- `DayInput` gains `today?: string;`.
- In `summarizeDay`: add `const settings = settingsOf(profile);` after the destructuring; change the expenditure options to `{ weightKg: trendKg, heightCm: profile.heightCm, bmrKcal, defaultSteps: settings.defaultSteps }`; replace the below-BMR block with:

```ts
  // Judge the goal on a typical day (default steps, no workout), not on the partial day.
  const typicalTarget = bmrKcal + kcalPerStep(trendKg, profile.heightCm) * settings.defaultSteps - goal.dailyDeficitKcal;
  if (typicalTarget < 0.75 * bmrKcal) warnings.push({ code: 'below_bmr', value: typicalTarget, limit: bmrKcal });
  // A finished day without enough food counts as the missing-day penalty.
  const imputed =
    input.today !== undefined && date < input.today && date >= goal.startDate && intake.kcal < settings.lowDayThresholdKcal;
```

- Return object gains `imputed,` and `countedKcal: imputed ? settings.missingDayKcal : intake.kcal,`.

`domain/link.ts`: in `checkWorkout` make duration optional: `checkNumber(w, 'durationMin', LIMITS.durationMin, path, errors, true);`.

`domain/apply.ts`:
- Add `export const CHECKIN_LINK_ID = 'checkin';`.
- `PlannedWrites` gains `checkIns: string[];`; `planWrites` initialises `checkIns: []`; in `case 'activity':` after pushing the activity add `if (op.id === CHECKIN_LINK_ID) out.checkIns.push(op.date);`.
- `ActivityWrite.workouts: Workout[];` → `workouts?: Workout[];`. In `planWrites`' activity case replace the `workouts:` line with `...(op.workouts !== undefined ? { workouts: op.workouts.map((w) => ({ ...w, linkId: op.id })) } : {}),`.
- Replace `mergeManual` with:

```ts
export function mergeManual(existing: Day['manual'], a: ActivityWrite): { steps?: number; workouts: Workout[] } {
  const steps = a.steps ?? existing?.steps;
  // An op without workouts keeps the day's workouts; `workouts: []` removes this link's.
  const workouts =
    a.workouts === undefined
      ? (existing?.workouts ?? [])
      : [...(existing?.workouts ?? []).filter((w) => w.linkId !== a.linkId), ...a.workouts];
  return { ...(steps !== undefined ? { steps } : {}), workouts };
}
```

`domain/index.ts`: add `export * from './settings.ts';`.

`domain/testing.ts`: `testProfile` keeps `activityLevel: 'moderate'` (a legacy field) — no change needed.

- [ ] **Step 4: Run to verify pass**

Run (root): `npm test && npm run typecheck`
Expected: all PASS. Fix any other root test that relied on `source: 'fallback'` or `ACTIVITY_FACTORS` by updating the expectation to the new model and ledgering it.

- [ ] **Step 5: Commit**

```bash
git add domain
git commit -m "feat(domain): default steps, as-entered workout calories, missing-day penalty, check-in writes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Domain — week and month summaries, reality check

**Files:**
- Create: `domain/reality.ts`
- Modify: `domain/summary.ts` (week section → shared range), `domain/index.ts`
- Test: `domain/summary.test.ts` (week tests + month), `domain/reality.test.ts`

**Interfaces:**
- Consumes: Task 1 `DaySummary.imputed/countedKcal`, `settingsOf`.
- Produces:
  - `RangeInput { today; entries; days; profile; goal; weighIns }`, `RangeSummary { start; end; days; daysLogged; imputedDays; avgInKcal; avgOutKcal; avgDeficitKcal; avgProtein; workoutsCount; trendChangeKg; weightDeficitKcal }`
  - `WeekInput extends RangeInput { date }`, `WeekSummary extends RangeSummary { targetDeficitKcal; plannedChangeKg }`, `summarizeWeek`
  - `MonthInput extends RangeInput { month: 'YYYY-MM' }`, `MonthSummary extends RangeSummary { month; workoutsPerWeek: number | null }`, `summarizeMonth`, `monthEnd(month): string`
  - `REALITY_WINDOW_DAYS = 14`, `REALITY_MIN_WEIGHINS = 4`, `RealityStatus = 'no_data' | 'gaining' | 'stalled' | 'on_track'`, `Reality { from; to; weighInCount; status; trendChangeKg; plannedChangeKg; loggedDeficitKcal; weightDeficitKcal }`, `realityCheck({ today, goal, weighIns, energy }): Reality`

- [ ] **Step 1: Write the failing tests**

In `domain/summary.test.ts`, inside `describe('summarizeWeek', …)`:
- Replace `'averages only completed logged days'` with:

```ts
  it('averages every finished day, counting days without food as 3,200', () => {
    expect(w.daysLogged).toBe(2);
    expect(w.imputedDays).toBe(1);
    expect(w.avgInKcal).toBeCloseTo((1800 + 2000 + 3200) / 3, 6);
    expect(w.avgProtein).toBe(105);
    expect(w.avgDeficitKcal).toBeCloseTo(w.avgOutKcal! - w.avgInKcal!, 6);
  });
```

- Replace `'does not count under-logged days in the averages'` with:

```ts
  it('counts an under-logged finished day as the penalty', () => {
    const partial = summarizeWeek({
      date: '2026-09-30',
      today: '2026-09-30',
      entries: [...weekEntries, makeEntry({ date: '2026-09-29', kcal: 300 })],
      days: [],
      profile: testProfile,
      goal: testGoal,
      weighIns: weekWeighIns,
    });
    expect(partial.daysLogged).toBe(2);
    expect(partial.avgInKcal).toBeCloseTo((1800 + 2000 + 3200) / 3, 6);
  });
```

- Add:

```ts
  it('counts workouts and the weight-implied deficit', () => {
    const days = [
      { date: '2026-09-27', manual: { workouts: [{ type: 'Push', kcal: 350 }] } },
      { date: '2026-09-29', manual: { workouts: [{ type: 'Legs', kcal: 400 }] } },
    ];
    const ww = summarizeWeek({ date: '2026-09-30', today: '2026-09-30', entries: weekEntries, days, profile: testProfile, goal: testGoal, weighIns: weekWeighIns });
    expect(ww.workoutsCount).toBe(2);
    // trend −0.088 kg over the 4 days from 09-26 to 09-30
    expect(ww.weightDeficitKcal).toBeCloseTo((0.088 * 7700) / 4, 1);
  });
```

Add a new describe at the end of `domain/summary.test.ts` (and add `summarizeMonth, monthEnd` to the import from `./summary.ts`):

```ts
describe('summarizeMonth', () => {
  const entries = [makeEntry({ date: '2026-09-02', kcal: 2000 }), makeEntry({ date: '2026-09-03', kcal: 2100 })];
  const days = [
    { date: '2026-09-02', manual: { workouts: [{ type: 'Push', kcal: 300 }] } },
    { date: '2026-09-09', manual: { workouts: [{ type: 'Pull', kcal: 300 }] } },
  ];
  const m = summarizeMonth({ month: '2026-09', today: '2026-09-15', entries, days, profile: testProfile, goal: testGoal, weighIns: [] });

  it('covers the month up to today', () => {
    expect(m.start).toBe('2026-09-01');
    expect(m.end).toBe('2026-09-30');
    expect(m.days).toHaveLength(15);
  });

  it('counts workouts, per-week rate and penalized days', () => {
    expect(m.workoutsCount).toBe(2);
    expect(m.workoutsPerWeek).toBeCloseTo((2 * 7) / 15, 6);
    // goal starts 09-01: 1..14 finished, 2 logged, 12 penalized
    expect(m.daysLogged).toBe(2);
    expect(m.imputedDays).toBe(12);
  });

  it('knows month lengths', () => {
    expect(monthEnd('2026-02')).toBe('2026-02-28');
    expect(monthEnd('2028-02')).toBe('2028-02-29');
  });
});
```

`domain/reality.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { realityCheck } from './reality.ts';
import { testGoal } from './testing.ts';

const today = '2026-09-27';
const series = (days: number, start: number, perDay: number) =>
  Array.from({ length: days }, (_, i) => ({ date: addDays(today, i - days + 1), kg: start + perDay * i }));

describe('realityCheck', () => {
  it('says no_data with fewer than 4 weigh-ins in 14 days', () => {
    const r = realityCheck({ today, goal: testGoal, weighIns: [{ date: '2026-09-20', kg: 86 }, { date: today, kg: 85 }], energy: [] });
    expect(r.status).toBe('no_data');
    expect(r.weighInCount).toBe(2);
  });

  it('says gaining when the trend rose', () => {
    expect(realityCheck({ today, goal: testGoal, weighIns: series(30, 88, 0.05), energy: [] }).status).toBe('gaining');
  });

  it('says stalled when the trend fell less than half the plan', () => {
    const r = realityCheck({ today, goal: testGoal, weighIns: series(30, 88, 0), energy: [] });
    expect(r.status).toBe('stalled');
    expect(r.plannedChangeKg).toBeCloseTo(-0.9, 6);
  });

  it('says on_track when the trend follows the plan', () => {
    expect(realityCheck({ today, goal: testGoal, weighIns: series(40, 90, -0.07), energy: [] }).status).toBe('on_track');
  });

  it('puts the logged deficit next to the weight deficit', () => {
    const energy = Array.from({ length: 13 }, (_, i) => ({ date: addDays(today, i - 13), inKcal: 1800, outKcal: 2350 }));
    const r = realityCheck({ today, goal: testGoal, weighIns: series(30, 88, 0), energy });
    expect(r.loggedDeficitKcal).toBeCloseTo(550, 6);
    expect(r.weightDeficitKcal).toBeCloseTo(0, 6);
  });

  it('ignores days before the goal start in the logged deficit', () => {
    const goal = { ...testGoal, startDate: addDays(today, -5) };
    const energy = Array.from({ length: 13 }, (_, i) => {
      const date = addDays(today, i - 13);
      return { date, inKcal: date < goal.startDate ? 0 : 1800, outKcal: 2350 };
    });
    expect(realityCheck({ today, goal, weighIns: series(30, 88, 0), energy }).loggedDeficitKcal).toBeCloseTo(550, 6);
  });

  it('expects the goal pace from the first day and while above target', () => {
    const fresh = realityCheck({ today, goal: { ...testGoal, startDate: today }, weighIns: series(30, 88, 0), energy: [] });
    expect(fresh.plannedChangeKg).toBeCloseTo(-0.9, 6);
    expect(fresh.status).toBe('stalled');
    const atTarget = realityCheck({ today, goal: { ...testGoal, targetWeightKg: 90 }, weighIns: series(30, 88, 0), energy: [] });
    expect(atTarget.plannedChangeKg).toBe(0);
    expect(atTarget.status).toBe('on_track');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (root): `npx vitest run domain/summary.test.ts domain/reality.test.ts`
Expected: FAIL — `summarizeMonth`, `monthEnd`, `./reality.ts` missing; week tests fail on the new averages.

- [ ] **Step 3: Implement**

In `domain/summary.ts` replace everything from `export interface WeekInput` to the end of the file with:

```ts
export interface RangeInput {
  today: string;
  entries: Entry[];
  days: Day[];
  profile: Profile;
  goal: Goal;
  weighIns: WeighIn[];
}

export interface RangeSummary {
  start: string;
  end: string;
  days: DaySummary[];
  daysLogged: number;
  imputedDays: number;
  avgInKcal: number | null;
  avgOutKcal: number | null;
  avgDeficitKcal: number | null;
  avgProtein: number | null;
  workoutsCount: number;
  trendChangeKg: number | null;
  weightDeficitKcal: number | null;
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

function summarizeRange(start: string, end: string, input: RangeInput): RangeSummary {
  const dayByDate = new Map(input.days.map((d) => [d.date, d]));
  const dates = dateRange(start, end).filter((d) => d <= input.today);
  const days = dates.map((date) =>
    summarizeDay({
      date,
      today: input.today,
      entries: input.entries,
      day: dayByDate.get(date),
      profile: input.profile,
      goal: input.goal,
      weighIns: input.weighIns,
    }),
  );
  const finished = days.filter((d) => d.date < input.today && d.date >= input.goal.startDate);
  const logged = finished.filter((d) => !d.imputed);
  const lastDate = dates.at(-1) ?? start;
  const series = trendSeries(input.weighIns);
  const weighedInRange = input.weighIns.some((w) => w.date >= start && w.date <= lastDate);
  const trendEnd = weighedInRange ? trendOn(series, lastDate) : null;
  const trendStart = trendOn(series, addDays(start, -1));
  const trendChangeKg = trendEnd !== null && trendStart !== null ? trendEnd - trendStart : null;
  const span = daysBetween(addDays(start, -1), lastDate);
  return {
    start,
    end,
    days,
    daysLogged: logged.length,
    imputedDays: finished.length - logged.length,
    avgInKcal: average(finished.map((d) => d.countedKcal)),
    avgOutKcal: average(finished.map((d) => d.expenditure.out)),
    avgDeficitKcal: average(finished.map((d) => d.expenditure.out - d.countedKcal)),
    avgProtein: average(logged.map((d) => d.intake.protein)),
    workoutsCount: days.reduce((n, d) => n + d.expenditure.workouts.length, 0),
    trendChangeKg,
    weightDeficitKcal: trendChangeKg === null || span <= 0 ? null : (-trendChangeKg * KCAL_PER_KG) / span,
  };
}

export interface WeekInput extends RangeInput {
  date: string;
}

export interface WeekSummary extends RangeSummary {
  targetDeficitKcal: number;
  plannedChangeKg: number;
}

export function summarizeWeek(input: WeekInput): WeekSummary {
  const start = weekStart(input.date);
  const range = summarizeRange(start, addDays(start, 6), input);
  const lastDate = range.days.at(-1)?.date ?? start;
  return {
    ...range,
    targetDeficitKcal: input.goal.dailyDeficitKcal,
    plannedChangeKg: plannedWeight(input.goal, lastDate) - plannedWeight(input.goal, addDays(start, -1)),
  };
}

export interface MonthInput extends RangeInput {
  month: string;
}

export interface MonthSummary extends RangeSummary {
  month: string;
  workoutsPerWeek: number | null;
}

export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function summarizeMonth(input: MonthInput): MonthSummary {
  const range = summarizeRange(`${input.month}-01`, monthEnd(input.month), input);
  const elapsed = range.days.length;
  return { ...range, month: input.month, workoutsPerWeek: elapsed === 0 ? null : (range.workoutsCount * 7) / elapsed };
}
```

Update the imports at the top of `domain/summary.ts`: `import { addDays, dateRange, daysBetween, weekStart } from './dates.ts';` and `import { KCAL_PER_KG, macroTargets } from './targets.ts';`.

`domain/reality.ts`:

```ts
import type { DayEnergy } from './checks.ts';
import { addDays, daysBetween } from './dates.ts';
import { KCAL_PER_KG } from './targets.ts';
import { trendOn, trendSeries } from './trend.ts';
import type { Goal, WeighIn } from './types.ts';

export const REALITY_WINDOW_DAYS = 14;
export const REALITY_MIN_WEIGHINS = 4;

export type RealityStatus = 'no_data' | 'gaining' | 'stalled' | 'on_track';

export interface Reality {
  from: string;
  to: string;
  weighInCount: number;
  status: RealityStatus;
  trendChangeKg: number | null;
  plannedChangeKg: number;
  loggedDeficitKcal: number | null;
  weightDeficitKcal: number | null;
}

export function realityCheck(input: { today: string; goal: Goal; weighIns: WeighIn[]; energy: DayEnergy[] }): Reality {
  const to = input.today;
  const from = addDays(to, -(REALITY_WINDOW_DAYS - 1));
  const weighInCount = input.weighIns.filter((w) => w.date >= from && w.date <= to).length;
  const series = trendSeries(input.weighIns);
  const before = trendOn(series, addDays(from, -1));
  const firstInWindow = series.find((p) => p.date >= from && p.date <= to);
  const startKg = before ?? firstInWindow?.kg ?? null;
  const startDate = before !== null ? addDays(from, -1) : (firstInWindow?.date ?? to);
  const endKg = trendOn(series, to);
  const trendChangeKg = startKg !== null && endKg !== null && weighInCount > 0 ? endKg - startKg : null;
  // The goal pace over the window until the trend reaches the target (the plan line itself is flat on its first days and after its end).
  const plannedChangeKg = endKg !== null && endKg <= input.goal.targetWeightKg ? 0 : (-input.goal.paceKgPerWeek * REALITY_WINDOW_DAYS) / 7;
  const span = daysBetween(startDate, to);
  const energy = input.energy.filter((e) => e.date >= from && e.date < to && e.date >= input.goal.startDate);
  const loggedDeficitKcal = energy.length === 0 ? null : energy.reduce((s, e) => s + (e.outKcal - e.inKcal), 0) / energy.length;
  const weightDeficitKcal = trendChangeKg === null || span <= 0 ? null : (-trendChangeKg * KCAL_PER_KG) / span;
  let status: RealityStatus;
  if (weighInCount < REALITY_MIN_WEIGHINS || trendChangeKg === null) status = 'no_data';
  else if (trendChangeKg > 0.1) status = 'gaining';
  else if (plannedChangeKg < 0 && trendChangeKg > plannedChangeKg * 0.5) status = 'stalled';
  else status = 'on_track';
  return { from, to, weighInCount, status, trendChangeKg, plannedChangeKg, loggedDeficitKcal, weightDeficitKcal };
}
```

`domain/index.ts`: add `export * from './reality.ts';`.

- [ ] **Step 4: Run to verify pass**

Run (root): `npm test && npm run typecheck`
Expected: all PASS. `commands.ts` is untouched here and still compiles (`WeekInput` keeps its shape); its output changes in Task 3.

- [ ] **Step 5: Commit**

```bash
git add domain
git commit -m "feat(domain): week/month range summaries with penalty and workouts; weight reality check" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Claude skill — counted energy, reality, month, check-in instructions

**Files:**
- Modify: `.claude/skills/kal/scripts/lib/commands.ts`, `.claude/skills/kal/SKILL.md`
- Test: `tests/skill/commands.test.ts`

**Interfaces:**
- Consumes: `summarizeMonth`, `realityCheck`, `REALITY_WINDOW_DAYS`, `DaySummary.countedKcal/imputed`.
- Produces: `read.ts profile` gains `reality`; `read.ts week` rows `{ date, inKcal, countedKcal, imputed, outKcal, protein, entries, workouts: string[] }` plus `workoutsCount`, `imputedDays`, `weightDeficitKcal`; new `read.ts month [YYYY-MM]` → `{ month, start, end, workoutsCount, workoutsPerWeek, daysLogged, imputedDays, avgDeficitKcal, weightDeficitKcal, trendChangeKg, days: rows }`.

- [ ] **Step 1: Write the failing tests**

In `tests/skill/commands.test.ts`:
- Replace the `week` test's row expectation with:

```ts
    expect(out.days[0]).toEqual({ date: '2026-09-27', inKcal: 320, countedKcal: 320, imputed: false, outKcal: expect.any(Number), protein: 20, entries: 1, workouts: ['running'] });
    expect(out.workoutsCount).toBe(1);
```

- In the `profile` test replace `expect(out.status).toBe('ahead');` with `expect(out).not.toHaveProperty('status');` and `expect(out.reality.status).toBe('no_data');` (the plan-based status said "ahead" from a single weigh-in).
- Add:

```ts
  it('month: summarizes the month with workouts and penalized days', async () => {
    const out = (await run(['month', '2026-09'], { reader: fakeReader(), now: new Date('2026-09-28T10:00:00Z') })) as any;
    expect(out.month).toBe('2026-09');
    expect(out.workoutsCount).toBe(1);
    // 09-01..09-27 are finished; only 09-20 (999 kcal) is logged, 09-27 (320 kcal) is penalized
    expect(out.daysLogged).toBe(1);
    expect(out.imputedDays).toBe(26);
    expect(out.days.find((d: any) => d.date === '2026-09-27')).toMatchObject({ inKcal: 320, countedKcal: 3200, imputed: true, workouts: ['running'] });
    expect(out.days.find((d: any) => d.date === '2026-09-20').imputed).toBe(false);
  });

  it('rejects an invalid month', async () => {
    await expect(run(['month', '2026-13'], { reader: fakeReader(), now })).rejects.toThrow('invalid month');
  });
```

- [ ] **Step 2: Run to verify failure**

Run (root): `npx vitest run tests/skill/commands.test.ts`
Expected: FAIL — rows lack the new fields; `month` is an unknown command.

- [ ] **Step 3: Implement**

In `.claude/skills/kal/scripts/lib/commands.ts`:
- Add to the domain import: `realityCheck`, `REALITY_WINDOW_DAYS`, `summarizeMonth`, `type DaySummary`.
- Add a row mapper:

```ts
function row(s: DaySummary) {
  return {
    date: s.date,
    inKcal: s.intake.kcal,
    countedKcal: s.countedKcal,
    imputed: s.imputed,
    outKcal: s.expenditure.out,
    protein: s.intake.protein,
    entries: s.entries.length,
    workouts: s.expenditure.workouts.map((w) => w.type),
  };
}
```

- `dayOf` passes `today` through: add a `today` parameter and pass `today` to `summarizeDay`; every caller passes the command's `today`.
- In `profile`: load from `addDays(today, -Math.max(GAP_WINDOW_DAYS, REALITY_WINDOW_DAYS))`; energy uses `inKcal: s.countedKcal`; add `reality: realityCheck({ today, goal: d.goal, weighIns: d.weighIns, energy })` to the result; delete the `status: planStatus(trendKg, plannedKg),` line and the `planStatus` import (every status now comes from `reality`).
- In `week`: `days: w.days.map(row)`, keep `missingDays`.
- Add:

```ts
async function month(deps: Deps, month: string, today: string) {
  const start = `${month}-01`;
  const d = await loadData(deps.reader, start, today < `${month}-31` ? today : `${month}-31`);
  const m = summarizeMonth({ month, today, entries: d.entries, days: d.days, profile: d.profile, goal: d.goal, weighIns: d.weighIns });
  return { ...m, days: m.days.map(row) };
}
```

- In `run`, before the date validation: `if (command === 'month') { const m = arg ?? today.slice(0, 7); if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new Error(`invalid month: ${m} (use YYYY-MM)`); return month(deps, m, today); }` — move `const today = localDate(deps.now);` above it.
- Update the unknown-command message to `profile | day [date] | week [date] | month [YYYY-MM] | recipes`.

In `.claude/skills/kal/SKILL.md`:
- Commands block: add `node .claude/skills/kal/scripts/read.ts month [YYYY-MM] # workouts, penalized days, logged vs weight deficit`.
- Replace the "Weight and activity" section body with:

````markdown
```json
{"op":"weight","kg":88.4}
{"op":"activity","id":"checkin","steps":9200,"workouts":[{"type":"Push","kcal":350}]}
```

- A day summary uses `"id":"checkin"` and marks the day checked in. `steps` replaces the day's steps; `workouts` replaces the day's check-in workouts (`[]` removes them); an op without `workouts` keeps them. `kcal` is the calories burned in the workout as the owner reads them in Garmin; no duration needed. Types: Upper, Lower, Push, Pull, Legs, Full body, Cardio, אחר.
- A day without steps counts as 3,500 steps. A finished day with less than 800 kcal of food counts as 3,200 (the owner's penalty rule); logging real food removes it.
````

- Replace the three bullets under `## Questions (no link)` with:

```markdown
- "כמה נשאר היום?" → `day` → `remainingKcal`, protein vs target.
- "איך השבוע?" → `profile` and `week` → lead with `profile.reality`; then `avgDeficitKcal` next to `weightDeficitKcal`, `trendChangeKg` vs `plannedChangeKg`, `workoutsCount`, `imputedDays`.
- "איך החודש?" → `profile` and `month` → lead with `profile.reality`; then `workoutsCount`, `workoutsPerWeek`, `imputedDays`, `avgDeficitKcal` next to `weightDeficitKcal`.
- "מתי אגיע ליעד?" → `profile` → `eta` and `reality.status`; mention `reportGap.alert` if true.
```

- Add a new section before "Limits":

```markdown
## Progress answers: the scale is the judge

Never say or imply "on track" because of steps, workouts or a logged deficit. Lead every progress answer with `profile.reality`:
- `no_data` → say there are not enough weigh-ins to know, and ask for a weigh-in.
- `gaining` / `stalled` → say so plainly, with `trendChangeKg` vs `plannedChangeKg`.
- `on_track` → only then say on track.
Always put the logged deficit next to the weight deficit (`reality.loggedDeficitKcal` / `reality.weightDeficitKcal` from `profile`; `avgDeficitKcal` / `weightDeficitKcal` from `week` and `month`), and mention penalized days (`imputedDays`) in weekly and monthly answers.
```

- [ ] **Step 4: Run to verify pass**

Run (root): `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/kal tests/skill
git commit -m "feat(skill): month command, reality check, counted intake and check-in guidance" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: App core — today-aware summaries, reality everywhere, check-in writes, wizard and confirm updates

**Files:**
- Create: `app/src/app/shared/reality-line.ts`
- Modify: `app/src/app/core/kal-state.ts`, `app/src/app/core/firestore-repository.ts`, `app/src/app/features/wizard/setup.ts`, `app/src/app/features/wizard/wizard.ts`, `app/src/app/features/confirm/confirm.logic.ts`, `app/src/app/features/weight/weight.logic.ts`, `app/src/app/features/weight/weight.ts`
- Test: `app/src/app/shared/reality-line.spec.ts`, `app/src/app/core/kal-state.spec.ts`, `app/src/app/features/wizard/setup.spec.ts`, `app/src/app/features/wizard/wizard.spec.ts`, `app/src/app/features/confirm/confirm.logic.spec.ts`, `app/src/app/features/confirm/confirm.spec.ts`, `app/src/app/features/weight/weight.logic.spec.ts`

**Interfaces:**
- Consumes: Task 1 `DaySummary.imputed/countedKcal`, `PlannedWrites.checkIns`; Task 2 `realityCheck`, `REALITY_WINDOW_DAYS`, `Reality`.
- Produces: `KalState.dayFor` passes `today`; `KalState.recentEnergy: Signal<DayEnergy[]>` (the 14 finished days before today, `inKcal` = counted intake); `KalState.reality: Signal<Reality | null>`; `KalState.todayDay: Signal<Day | undefined>`; `KalState.todayWeighIn: Signal<WeighIn | undefined>`; `whenLoaded()` also waits for the first days and weigh-ins snapshots; `realityLine(r: Reality | null): { text: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }` in `shared/reality-line.ts`; `WeightView` loses `status` (and `STATUS_TEXT` is deleted); repository writes `checkedInAt` for `writes.checkIns`; wizard has 4 steps (profile, goal, constraints, summary) and no activity level.

- [ ] **Step 1: Write the failing tests**

`app/src/app/shared/reality-line.spec.ts`:

```ts
import { realityLine } from './reality-line';

describe('realityLine', () => {
  it('never praises missing data', () => {
    expect(realityLine(null)).toEqual({ text: 'אין עדיין נתוני משקל', tone: 'neutral' });
    expect(realityLine({ status: 'no_data', weighInCount: 2 } as never)).toEqual({ text: 'אין מספיק שקילות כדי לדעת אם אתה בקצב (2 מתוך 4 ב-14 יום)', tone: 'neutral' });
  });

  it('says what the scale says', () => {
    expect(realityLine({ status: 'gaining', trendChangeKg: 0.3, plannedChangeKg: -0.9 } as never).tone).toBe('danger');
    expect(realityLine({ status: 'stalled', trendChangeKg: -0.2, plannedChangeKg: -0.9 } as never)).toEqual({ text: 'המשקל כמעט לא ירד: -0.2 ק״ג ב-14 יום, התוכנית -0.9', tone: 'warning' });
    expect(realityLine({ status: 'on_track', trendChangeKg: -1, plannedChangeKg: -0.9 } as never).tone).toBe('success');
  });
});
```

`kal-state.spec.ts` add:

```ts
  it('penalizes a finished day without food and exposes the weight reality', () => {
    const state = setup();
    expect(state.dayFor('2026-09-26')!.imputed).toBe(true);
    expect(state.dayFor('2026-09-27')!.imputed).toBe(false);
    expect(state.recentEnergy()).toHaveLength(14);
    expect(state.recentEnergy().at(-1)).toMatchObject({ date: '2026-09-26', inKcal: 3200 });
    expect(state.reality()!.status).toBe('no_data');
  });

  it('works with a legacy profile that still has an activity level', () => {
    const state = setup();
    expect(state.todaySummary()!.expenditure.stepsSource).toBe('garmin');
  });

  it('waits for days and weigh-ins before whenLoaded resolves', async () => {
    const repo = seededRepository();
    repo.watchDays = () => () => undefined;
    const state = setup(repo);
    const first = await Promise.race([state.whenLoaded().then(() => 'loaded'), new Promise((r) => setTimeout(() => r('waiting'), 20))]);
    expect(first).toBe('waiting');
  });
```

`setup.spec.ts`:
- Remove `activityLevel: 'moderate',` from `form`.
- In `'creates profile, goal…'` replace the `toMatchObject` for profile with `{ sex: 'male', heightCm: 178, activeGoalId: 'g2', constraints: { protein: { max: 120 } } }` and add `expect(s.profile).not.toHaveProperty('activityLevel');` and `expect(s.profile.settings).toEqual({ lowDayThresholdKcal: 800, defaultSteps: 3500, missingDayKcal: 3200 });`.
- `validateStep` indices: goal checks use step `1`, constraint checks use step `2`.
- `previewSetup` test: replace the typical-target expectation with `expect(p.typicalTargetKcal).toBeCloseTo(1842.5 + 3500 * 0.5 * 90 * (0.415 * 178) / 100 / 1000 - 495, 4);`.

`wizard.spec.ts`: in `openSummary` remove `activityLevel` from the form and use `w.step.set(3)`; in the skip test use `w.step.set(2)`.

`confirm.logic.spec.ts`: the activity expectation becomes `'פעילות (27.9): 9,200 צעדים · כדורגל 550 קל׳ (60 דק׳)'` and add `expect(describeOp({ op: 'activity', id: 'checkin', date: '2026-09-27', workouts: [{ type: 'Push', kcal: 350 }] }, [])).toBe('פעילות (27.9): Push 350 קל׳');`.

`confirm.spec.ts`, test `'includes a logged activity in the after-save preview'`: replace the comment and expectation with

```ts
    // base target 2050.3 + walk 300 kcal, counted as entered
    expect(preview.targetKcal).toBeCloseTo(2350.3, 0);
```

`weight.logic.spec.ts`: rename `'computes status against the plan and a flat target line'` to `'computes the plan and a flat target line'` and delete its `expect(v.status).toBe('ahead');` line.

- [ ] **Step 2: Run to verify failure**

Run (app): `npx ng test --watch=false`
Expected: FAIL — `reality-line` missing, `recentEnergy`/`reality`/`imputed` missing, confirm preview 2275.6 ≠ 2350.3, typing errors.

- [ ] **Step 3: Implement**

`app/src/app/shared/reality-line.ts`:

```ts
import type { Reality } from '../domain';
import { fmt } from './format';

export function realityLine(r: Reality | null): { text: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (!r) return { text: 'אין עדיין נתוני משקל', tone: 'neutral' };
  const change = `${fmt(r.trendChangeKg, 1)} ק״ג ב-14 יום, התוכנית ${fmt(r.plannedChangeKg, 1)}`;
  switch (r.status) {
    case 'no_data':
      return { text: `אין מספיק שקילות כדי לדעת אם אתה בקצב (${r.weighInCount} מתוך 4 ב-14 יום)`, tone: 'neutral' };
    case 'gaining':
      return { text: `המשקל עלה: ${change}`, tone: 'danger' };
    case 'stalled':
      return { text: `המשקל כמעט לא ירד: ${change}`, tone: 'warning' };
    case 'on_track':
      return { text: `בקצב לפי המשקל: ${change}`, tone: 'success' };
  }
}
```

(`fmt` uses `en-US`, so `-0.2` prints with an ASCII hyphen-minus, as the spec expects.)

In `app/src/styles.css`, after `.alert.success`, add `.alert.neutral { background: var(--card); color: var(--fg-muted); border: 1px solid var(--border); }`.

`kal-state.ts`:
- Import `dateRange`, `realityCheck`, `REALITY_WINDOW_DAYS`, `type DayEnergy`, `type Reality` from `../domain`.
- In `dayFor` add `today: this.today(),` to the `summarizeDay` input.
- In `start()`: `let pending = 4;`, add `const daysArrived = once();` and `const weighInsArrived = once();`, and change the two watchers to

```ts
      this.repo.watchDays(uid, (d) => {
        this.days.set(d);
        daysArrived();
      }),
      this.repo.watchWeighIns(uid, (w) => {
        this.weighIns.set(w);
        weighInsArrived();
      }),
```

  (The check-in prompt and its prefill need the day and today's weigh-in; the guards already await `whenLoaded`, so no screen renders before them.)
- Add:

```ts
  readonly todayDay = computed(() => this.days().find((d) => d.date === this.today()));
  readonly todayWeighIn = computed(() => this.weighIns().find((w) => w.date === this.today()));
  /** The finished days of the reality window, with the missing-day penalty applied. */
  readonly recentEnergy = computed<DayEnergy[]>(() => {
    if (!this.goal() || !this.profile()) return [];
    const today = this.today();
    return dateRange(addDays(today, -REALITY_WINDOW_DAYS), addDays(today, -1)).map((date) => {
      const s = this.dayFor(date)!;
      return { date, inKcal: s.countedKcal, outKcal: s.expenditure.out };
    });
  });
  readonly reality = computed<Reality | null>(() => {
    const goal = this.goal();
    if (!goal || !this.profile()) return null;
    return realityCheck({ today: this.today(), goal, weighIns: this.weighIns(), energy: this.recentEnergy() });
  });
```

`firestore-repository.ts` `applyWrites`, before `return batch.commit();`:

```ts
    for (const date of writes.checkIns) {
      batch.set(doc(this.col(uid, 'days'), date), { checkedInAt: new Date().toISOString() }, { merge: true });
    }
```

`setup.ts`:
- Remove the `ACTIVITY_FACTORS` and `ActivityLevel` imports; import `kcalPerStep`.
- `SetupForm` loses `activityLevel`; `initialForm` loses it.
- `validateStep`: goal checks under `step === 1`, constraint checks under `step === 2`.
- `previewSetup`: `typicalTargetKcal: bmrKcal + kcalPerStep(f.currentWeightKg, f.heightCm) * 3500 - deficitKcal,`.
- `buildSetup`: add `const prevSettings = ctx.previousProfile?.settings;` (the name `prev` is already the previous goal); the profile drops `activityLevel` and gets `settings: { lowDayThresholdKcal: prevSettings?.lowDayThresholdKcal ?? 800, defaultSteps: prevSettings?.defaultSteps ?? 3500, missingDayKcal: prevSettings?.missingDayKcal ?? 3200 }`.

`wizard.ts`:
- `STEPS = ['פרופיל', 'יעד', 'מגבלות', 'סיכום']`.
- Delete the `@case (1)` activity block; renumber goal `@case (1)`, constraints `@case (2)`, summary `@case (3)`; the skip button shows on `step() === 2`.

`confirm.logic.ts` activity case: `for (const w of op.workouts ?? []) parts.push(`${w.type} ${fmt(w.kcal)} קל׳${w.durationMin ? ` (${fmt(w.durationMin)} דק׳)` : ''}`);`.

`weight.logic.ts`: remove `planStatus`, `type PlanStatus`, `STATUS_TEXT` and the `status` field of `WeightView` and of the returned object. Everything else stays.

`weight.ts`:
- Imports: drop `addDays`, `dateRange`… only if unused (keep `dateRange` for `gapDays`); drop `GAP_WINDOW_DAYS` and `STATUS_TEXT`; add `import { realityLine } from '../../shared/reality-line';`.
- Replace the status chip block (`@if (v.status; as s) { … }`) with:

```html
        <span class="alert" [class]="reality().tone">
          {{ reality().text }}@if (v.eta && reality().tone !== 'neutral') { · צפי <span class="num">{{ shortDate(v.eta) }}</span> }
        </span>
```

- Class: delete `statusText`; add `protected readonly reality = computed(() => realityLine(this.state.reality()));`; in `view` replace the local `energy` computation with `energy: this.state.recentEnergy()` in the `weightView` call.

- [ ] **Step 4: Run to verify pass**

Run (app): `npx ng test --watch=false && npx ng build --base-href /kal/`
Expected: PASS; build OK. (Today still uses `breakdownText`; if it fails to compile because `source` is gone, update `today.logic.ts` `breakdownText` to `BMR ${fmt(e.bmr)} · צעדים ${fmt(e.steps)}${e.stepsSource === 'default' ? '*' : ''} → ${fmt(e.stepsKcal)} · אימונים → ${fmt(e.workoutsKcal)}` and its spec accordingly, and ledger it; it is replaced in Task 6. The Today Garmin banner still opens quick-add's activity tab until Task 5.)

- [ ] **Step 5: Commit**

```bash
git add app/src
git commit -m "feat(app): today-aware summaries, weight reality on Today and Weight, check-in writes; wizard without activity level" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Check-in sheet; quick-add without the activity tab

**Files:**
- Create: `app/src/app/features/checkin/checkin.logic.ts`, `app/src/app/features/checkin/checkin.service.ts`, `app/src/app/features/checkin/checkin.ts`
- Modify: `app/src/app/shell/shell.ts`, `app/src/app/features/today/quick-add.ts`, `app/src/app/features/today/quick-add.logic.ts`, `app/src/app/features/today/quick-add.service.ts`, `app/src/app/features/confirm/confirm.ts`
- Test: `app/src/app/features/checkin/checkin.logic.spec.ts`, `app/src/app/features/checkin/checkin.spec.ts`, `app/src/app/features/today/quick-add.logic.spec.ts`, `app/src/app/features/confirm/confirm.spec.ts`

**Interfaces:**
- Produces: `CheckInDraft { steps; workoutType; workoutKcal; weightKg }` (all `number | null` except `workoutType: string | null`), `CHECKIN_HOUR = '22:00'`, `shouldPromptCheckIn(now, day, dismissed): boolean`, `initialCheckIn(day, weighIn): CheckInDraft`, `checkInError(d): string | null`, `checkInWrites(d, date, now): PlannedWrites`; `CheckInService { open; dismissedFor; show(); close(); dismiss(date) }`; `CheckIn` component (`app-checkin`); `QuickAddTab = 'meal' | 'weight'`.

- [ ] **Step 1: Write the failing tests**

`checkin.logic.spec.ts`:

```ts
import { checkInError, checkInWrites, initialCheckIn, shouldPromptCheckIn } from './checkin.logic';

const late = new Date('2026-09-28T19:30:00Z'); // 22:30 in Israel
const early = new Date('2026-09-28T15:00:00Z'); // 18:00

describe('check-in logic', () => {
  it('prompts from 22:00 until the day is checked in or dismissed', () => {
    expect(shouldPromptCheckIn(late, undefined, false)).toBe(true);
    expect(shouldPromptCheckIn(early, undefined, false)).toBe(false);
    expect(shouldPromptCheckIn(late, { date: '2026-09-28', checkedInAt: 'x' }, false)).toBe(false);
    expect(shouldPromptCheckIn(late, undefined, true)).toBe(false);
  });

  it('prefills from the day and today\'s weigh-in', () => {
    const day = { date: '2026-09-28', manual: { steps: 8000, workouts: [{ type: 'Push', kcal: 350, linkId: 'checkin' }] } };
    expect(initialCheckIn(day, { date: '2026-09-28', kg: 92.2 })).toEqual({ steps: 8000, workoutType: 'Push', workoutKcal: 350, weightKg: 92.2 });
    expect(initialCheckIn(undefined, undefined)).toEqual({ steps: null, workoutType: null, workoutKcal: null, weightKg: null });
  });

  it('validates steps, workout calories and weight', () => {
    expect(checkInError({ steps: -1, workoutType: null, workoutKcal: null, weightKg: null })).toContain('צעדים');
    expect(checkInError({ steps: 8000, workoutType: 'Push', workoutKcal: null, weightKg: null })).toContain('אימון');
    expect(checkInError({ steps: null, workoutType: null, workoutKcal: null, weightKg: 20 })).toContain('משקל');
    expect(checkInError({ steps: 8000, workoutType: 'Push', workoutKcal: 350, weightKg: 92 })).toBeNull();
  });

  it('writes steps, a replaceable check-in workout, the weigh-in and the check-in mark', () => {
    const w = checkInWrites({ steps: 8000, workoutType: 'Push', workoutKcal: 350, weightKg: 92.2 }, '2026-09-28', late);
    expect(w.activities).toEqual([{ date: '2026-09-28', linkId: 'checkin', steps: 8000, workouts: [{ type: 'Push', kcal: 350, linkId: 'checkin' }] }]);
    expect(w.weights).toEqual([{ date: '2026-09-28', kg: 92.2, time: '22:30' }]);
    expect(w.checkIns).toEqual(['2026-09-28']);
  });

  it('clears the check-in workout when "no workout" is chosen', () => {
    expect(checkInWrites({ steps: null, workoutType: null, workoutKcal: null, weightKg: null }, '2026-09-28', late).activities[0].workouts).toEqual([]);
  });
});
```

`checkin.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { seededRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Toast } from '../../core/toast';
import { CheckIn } from './checkin';
import { CheckInService } from './checkin.service';

afterEach(() => vi.useRealTimers());

async function open() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-27T19:30:00Z'));
  const repo = seededRepository();
  repo.writeMode = 'hang';
  TestBed.configureTestingModule({ imports: [CheckIn], providers: [{ provide: KalRepository, useValue: repo }] });
  const state = TestBed.inject(KalState);
  state.start('u1');
  state.refreshNow();
  TestBed.inject(CheckInService).show();
  const fixture = TestBed.createComponent(CheckIn);
  await fixture.whenStable();
  return { fixture, repo, el: fixture.nativeElement as HTMLElement };
}

describe('CheckIn', () => {
  it('shows the food logged today', async () => {
    const { el } = await open();
    expect(el.textContent).toContain('320');
  });

  it('saves without waiting, closes, and does not reopen today', async () => {
    const { fixture, repo, el } = await open();
    const steps = el.querySelector<HTMLInputElement>('input[name=steps]')!;
    steps.value = '9000';
    steps.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('button[data-type="Push"]')!.click();
    await fixture.whenStable();
    const kcal = el.querySelector<HTMLInputElement>('input[name=workoutKcal]')!;
    kcal.value = '350';
    kcal.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(repo.applied[0].writes.activities[0]).toMatchObject({ steps: 9000, workouts: [{ type: 'Push', kcal: 350 }] });
    expect(repo.applied[0].writes.checkIns).toEqual(['2026-09-27']);
    const service = TestBed.inject(CheckInService);
    expect(service.open()).toBe(false);
    expect(service.dismissedFor()).toBe('2026-09-27');
    expect(TestBed.inject(Toast).message()).toBe('נשמר');
  });

  it('"not now" dismisses for today', async () => {
    const { fixture, el } = await open();
    el.querySelector<HTMLButtonElement>('button[data-action="later"]')!.click();
    await fixture.whenStable();
    expect(TestBed.inject(CheckInService).dismissedFor()).toBe('2026-09-27');
  });
});

describe('CheckInService', () => {
  it('forgets "not now" when the app comes back to the foreground', () => {
    const service = TestBed.inject(CheckInService);
    service.dismiss('2026-09-27');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(service.dismissedFor()).toBeNull();
  });
});
```

In `confirm.spec.ts` add (import `CheckInService` from `../checkin/checkin.service`):

```ts
  it('does not reopen the check-in after a check-in link for today is saved', async () => {
    const { fixture, el } = await open([{ op: 'activity', id: 'checkin', date: '2026-09-27', steps: 9000 }]);
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(TestBed.inject(CheckInService).dismissedFor()).toBe('2026-09-27');
  });
```

In `quick-add.logic.spec.ts` delete the whole `describe('activity', …)` block and the `activityError, activityPayload` imports (the activity tab moves into the check-in).

- [ ] **Step 2: Run to verify failure**

Run (app): `npx ng test --watch=false`
Expected: FAIL — check-in files missing.

- [ ] **Step 3: Implement**

`checkin.logic.ts`:

```ts
import { CHECKIN_LINK_ID, localTime, type Day, type PlannedWrites, type WeighIn } from '../../domain';

export const CHECKIN_HOUR = '22:00';

export interface CheckInDraft {
  steps: number | null;
  workoutType: string | null;
  workoutKcal: number | null;
  weightKg: number | null;
}

export function shouldPromptCheckIn(now: Date, day: Day | undefined, dismissed: boolean): boolean {
  return !dismissed && !day?.checkedInAt && localTime(now) >= CHECKIN_HOUR;
}

export function initialCheckIn(day: Day | undefined, weighIn: WeighIn | undefined): CheckInDraft {
  const workout = day?.manual?.workouts?.find((w) => w.linkId === CHECKIN_LINK_ID);
  return {
    steps: day?.manual?.steps ?? day?.garmin?.steps ?? null,
    workoutType: workout?.type ?? null,
    workoutKcal: workout?.kcal ?? null,
    weightKg: weighIn?.kg ?? null,
  };
}

export function checkInError(d: CheckInDraft): string | null {
  if (d.steps !== null && (d.steps < 0 || d.steps > 100000)) return 'צעדים: מספר בין 0 ל-100000';
  if (d.workoutType !== null && (d.workoutKcal === null || d.workoutKcal < 0 || d.workoutKcal > 3000)) return 'קלוריות אימון: מספר בין 0 ל-3000';
  if (d.weightKg !== null && (d.weightKg < 30 || d.weightKg > 300)) return 'משקל: מספר בין 30 ל-300';
  return null;
}

export function checkInWrites(d: CheckInDraft, date: string, now: Date): PlannedWrites {
  return {
    entries: [],
    recipes: [],
    weights: d.weightKg !== null ? [{ date, kg: d.weightKg, time: localTime(now) }] : [],
    activities: [
      {
        date,
        linkId: CHECKIN_LINK_ID,
        ...(d.steps !== null ? { steps: d.steps } : {}),
        workouts: d.workoutType !== null ? [{ type: d.workoutType, kcal: d.workoutKcal!, linkId: CHECKIN_LINK_ID }] : [],
      },
    ],
    checkIns: [date],
  };
}
```

`checkin.service.ts`:

```ts
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CheckInService {
  readonly open = signal(false);
  /** The date the owner closed or saved the check-in for in this app session. */
  readonly dismissedFor = signal<string | null>(null);

  constructor() {
    // "Not now" lasts until the app is opened again.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.dismissedFor.set(null);
    });
  }

  show(): void {
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
  }

  dismiss(date: string): void {
    this.dismissedFor.set(date);
    this.open.set(false);
  }
}
```

`checkin.ts`:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Toast } from '../../core/toast';
import { settingsOf, WORKOUT_TYPES } from '../../domain';
import { dayLetter, fmt, num, shortDate } from '../../shared/format';
import { checkInError, checkInWrites, initialCheckIn, type CheckInDraft } from './checkin.logic';
import { CheckInService } from './checkin.service';

@Component({
  selector: 'app-checkin',
  imports: [LucideX],
  template: `
    <div class="backdrop" (click)="later()"></div>
    <section class="sheet card stack" role="dialog" aria-modal="true" aria-label="סגירת יום">
      <div class="row">
        <strong>סגירת יום · {{ title() }}</strong>
        <button type="button" class="icon" aria-label="סגירה" (click)="later()"><svg lucideX [size]="18"></svg></button>
      </div>

      <label>צעדים היום
        <input name="steps" type="number" inputmode="numeric" [placeholder]="stepsHint()" [value]="draft().steps ?? ''" (input)="patch('steps', num($any($event.target).value))" />
      </label>

      <div class="stack tight">
        <span class="label">אימון היום?</span>
        <div class="chips">
          <button type="button" class="chip" [class.on]="draft().workoutType === null" (click)="patch('workoutType', null)">בלי אימון</button>
          @for (t of types; track t) {
            <button type="button" class="chip" [attr.data-type]="t" [class.on]="draft().workoutType === t" (click)="patch('workoutType', t)">{{ t }}</button>
          }
        </div>
      </div>
      @if (draft().workoutType !== null) {
        <label>קלוריות שנשרפו באימון (מ-Garmin)
          <input name="workoutKcal" type="number" inputmode="decimal" [value]="draft().workoutKcal ?? ''" (input)="patch('workoutKcal', num($any($event.target).value))" />
        </label>
      }

      @if (food(); as f) {
        <p class="alert" [class.success]="f.ok" [class.danger]="!f.ok">{{ f.text }}</p>
      }

      <label>משקל (לא חובה)
        <input name="weight" type="number" inputmode="decimal" [value]="draft().weightKg ?? ''" (input)="patch('weightKg', num($any($event.target).value))" />
      </label>

      @if (error(); as e) {
        <p class="error" role="alert">{{ e }}</p>
      }
      <div class="row">
        <button type="button" data-action="later" (click)="later()">לא עכשיו</button>
        <button type="button" class="primary" (click)="save()">שמירה</button>
      </div>
    </section>
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / 0.35); z-index: 10; }
    .sheet { position: fixed; inset-inline: 0; inset-block-end: 0; max-width: 480px; margin-inline: auto; z-index: 11;
      border-radius: 20px 20px 0 0; padding-block-end: calc(16px + env(safe-area-inset-bottom)); max-height: 90dvh; overflow-y: auto; }
    .tight { gap: 6px; }
    .label { font-size: 13px; color: var(--fg-muted); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { min-height: 44px; border-radius: 999px; padding: 0 12px; font-size: 13px; }
    .chip.on { background: var(--primary); color: var(--on-primary); border-color: transparent; }
    .icon { border: none; background: none; }
  `,
})
export class CheckIn {
  private readonly state = inject(KalState);
  private readonly repo = inject(KalRepository);
  private readonly toast = inject(Toast);
  private readonly service = inject(CheckInService);
  protected readonly types = WORKOUT_TYPES;
  protected readonly num = num;

  private readonly date = this.state.today();
  private readonly initial = initialCheckIn(this.state.todayDay(), this.state.todayWeighIn());
  protected readonly draft = signal<CheckInDraft>({ ...this.initial });
  protected readonly error = signal<string | null>(null);
  protected readonly title = computed(() => `${dayLetter(this.date)} ${shortDate(this.date)}`);
  protected readonly stepsHint = computed(() => {
    const profile = this.state.profile();
    return profile ? `${fmt(settingsOf(profile).defaultSteps)} אם לא תזין` : '';
  });
  protected readonly food = computed(() => {
    const s = this.state.todaySummary();
    const profile = this.state.profile();
    if (!s || !profile) return null;
    const settings = settingsOf(profile);
    if (s.intake.kcal >= settings.lowDayThresholdKcal) return { ok: true, text: `אוכל: נרשמו ${fmt(s.intake.kcal)} קל׳ היום` };
    return { ok: false, text: `נרשמו רק ${fmt(s.intake.kcal)} קל׳. אם לא תזין, היום ייחשב ${fmt(settings.missingDayKcal)}` };
  });

  protected patch<K extends keyof CheckInDraft>(key: K, value: CheckInDraft[K]): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
    this.error.set(null);
  }

  protected save(): void {
    const uid = this.state.uid();
    if (!uid) return;
    const draft = this.draft();
    const error = checkInError(draft);
    this.error.set(error);
    if (error) return;
    this.state.refreshNow();
    // An unchanged weight is not written again (keeps the morning weigh-in time).
    const toWrite = { ...draft, weightKg: draft.weightKg === this.initial.weightKg ? null : draft.weightKg };
    this.repo.applyWrites(uid, checkInWrites(toWrite, this.date, this.state.now()), this.state.days()).catch(() => this.toast.show('השמירה נכשלה'));
    this.toast.show('נשמר');
    this.service.dismiss(this.date);
  }

  protected later(): void {
    this.service.dismiss(this.date);
  }
}
```

`shell.ts`: import `CheckIn` and `CheckInService`; add `CheckIn` to `imports`; inject `protected readonly checkin = inject(CheckInService);`; after the quick-add block add `@if (checkin.open()) { <app-checkin /> }`.

`confirm.ts`: add `private readonly checkin = inject(CheckInService);` (import from `../checkin/checkin.service`) and, in `save()` right after `const writes = planWrites(...)`, add:

```ts
    const today = this.state.today();
    if (writes.checkIns.includes(today)) this.checkin.dismiss(today);
```

`quick-add.service.ts`: `export type QuickAddTab = 'meal' | 'weight';`.

`quick-add.logic.ts`: delete `ActivityDraft`, `hasWorkout`, `activityError`, `activityPayload`.

`quick-add.ts`: remove the activity tab entry, the `@case ('activity')` block, the `activity` signal, `patchActivity`, the activity branch in `save()` (the `else` branch), and their imports. The final `else` becomes the weight branch: change `} else if (tab === 'weight') {` to `} else {` and delete the old `else { … activity … }`.

- [ ] **Step 4: Run to verify pass**

Run (app): `npx ng test --watch=false && npx ng build --base-href /kal/`
Expected: PASS; build OK. Fix any remaining reference to `quickAdd.open('activity')` (Today's Garmin banner) by pointing it at the check-in in Task 6; if it blocks compilation now, change it to `quickAdd.open('meal')` and ledger it.

- [ ] **Step 5: Commit**

```bash
git add app/src
git commit -m "feat(app): daily check-in sheet; activity moves out of quick-add" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Today — weigh-in chip, reality line, target waterfall, check-in trigger

**Files:**
- Create: `app/src/app/features/today/waterfall.ts`
- Modify: `app/src/app/features/today/today.logic.ts`, `app/src/app/features/today/today.ts`
- Test: `app/src/app/features/today/today.logic.spec.ts` (rewrite), `app/src/app/features/today/today.spec.ts`

**Interfaces:**
- Consumes: `KalState.reality/todayDay/todayWeighIn` and `realityLine` (Task 4), `CheckInService` and `shouldPromptCheckIn` (Task 5).
- Produces: `interface WaterfallRow { label: string; value: number; kind: 'base' | 'plus' | 'minus' | 'total'; note?: string }`, `waterfallRows(s: DaySummary, defaultSteps: number): WaterfallRow[]`, `staleSyncHours` (kept); component `Waterfall` (`app-waterfall`, input `rows`).

- [ ] **Step 1: Write the failing tests**

Replace `today.logic.spec.ts` with:

```ts
import { staleSyncHours, waterfallRows } from './today.logic';

const summary = (over: Record<string, unknown> = {}) =>
  ({
    expenditure: { bmr: 1915, steps: 3500, stepsSource: 'default', stepsKcal: 115, workouts: [{ type: 'Push', kcal: 350, source: 'manual' }], workoutsKcal: 350, out: 2380 },
    deficitKcal: 1009,
    targetKcal: 1371,
    ...over,
  }) as never;

describe('today logic', () => {
  it('reports a stale Garmin sync after 6 hours', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    expect(staleSyncHours('2026-09-27T05:30:00Z', now)).toBe(6);
    expect(staleSyncHours(undefined, now)).toBeNull();
  });

  it('builds the target waterfall and marks defaulted steps', () => {
    expect(waterfallRows(summary(), 3500)).toEqual([
      { label: 'BMR', value: 1915, kind: 'base' },
      { label: 'צעדים', value: 115, kind: 'plus', note: '3,500 · לא הוזנו' },
      { label: 'Push', value: 350, kind: 'plus' },
      { label: 'גירעון', value: -1009, kind: 'minus' },
      { label: 'יעד', value: 1371, kind: 'total' },
    ]);
  });

  it('adds a constraint row when the target was clamped', () => {
    const rows = waterfallRows(summary({ targetKcal: 1500 }), 3500);
    expect(rows.at(-2)).toEqual({ label: 'מגבלת קלוריות', value: 129, kind: 'plus' });
  });
});
```

Replace `today.spec.ts` with:

```ts
import { TestBed } from '@angular/core/testing';
import { NOW, seededRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { CheckInService } from '../checkin/checkin.service';
import { Today } from './today';

async function render(now = NOW) {
  TestBed.configureTestingModule({ imports: [Today], providers: [{ provide: KalRepository, useValue: seededRepository() }] });
  const state = TestBed.inject(KalState);
  state.now.set(now);
  state.start('u1');
  state.now.set(now);
  const fixture = TestBed.createComponent(Today);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('Today', () => {
  it('shows the weigh-in chip, the reality line and the target waterfall', async () => {
    const el = await render();
    expect(el.textContent).toContain('85');
    expect(el.textContent).toContain('אין מספיק שקילות');
    expect(el.textContent).toContain('BMR');
    expect(el.textContent).toContain('יעד');
    expect(el.querySelector('.big')!.classList).not.toContain('good');
  });

  it('opens the check-in automatically after 22:00', async () => {
    await render(new Date('2026-09-27T19:30:00Z'));
    expect(TestBed.inject(CheckInService).open()).toBe(true);
  });

  it('does not open the check-in before 22:00', async () => {
    await render();
    expect(TestBed.inject(CheckInService).open()).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (app): `npx ng test --watch=false`
Expected: FAIL — `waterfallRows` missing; Today lacks the new elements.

- [ ] **Step 3: Implement**

Replace `today.logic.ts` with:

```ts
import type { DaySummary } from '../../domain';
import { fmt } from '../../shared/format';

export const STALE_SYNC_HOURS = 6;

export function staleSyncHours(lastSyncAt: string | undefined, now: Date): number | null {
  if (!lastSyncAt) return null;
  const hours = Math.floor((now.getTime() - new Date(lastSyncAt).getTime()) / 3_600_000);
  return hours >= STALE_SYNC_HOURS ? hours : null;
}

export interface WaterfallRow {
  label: string;
  value: number;
  kind: 'base' | 'plus' | 'minus' | 'total';
  note?: string;
}

export function waterfallRows(s: DaySummary, defaultSteps: number): WaterfallRow[] {
  const e = s.expenditure;
  const rows: WaterfallRow[] = [{ label: 'BMR', value: Math.round(e.bmr), kind: 'base' }];
  const steps: WaterfallRow = { label: 'צעדים', value: Math.round(e.stepsKcal), kind: 'plus' };
  if (e.stepsSource === 'default') steps.note = `${fmt(defaultSteps)} · לא הוזנו`;
  rows.push(steps);
  for (const w of e.workouts) rows.push({ label: w.type, value: Math.round(w.kcal), kind: 'plus' });
  rows.push({ label: 'גירעון', value: -Math.round(s.deficitKcal), kind: 'minus' });
  const clamp = Math.round(s.targetKcal - (e.out - s.deficitKcal));
  if (clamp !== 0) rows.push({ label: 'מגבלת קלוריות', value: clamp, kind: clamp > 0 ? 'plus' : 'minus' });
  rows.push({ label: 'יעד', value: Math.round(s.targetKcal), kind: 'total' });
  return rows;
}
```

`waterfall.ts`:

```ts
import { Component, computed, input } from '@angular/core';
import { fmt } from '../../shared/format';
import type { WaterfallRow } from './today.logic';

@Component({
  selector: 'app-waterfall',
  template: `
    <div class="muted small title">איך נבנה היעד היום</div>
    @for (r of layout(); track $index) {
      <div class="line" [class.total]="r.kind === 'total'">
        <span class="label">{{ r.label }}@if (r.note) { <span class="muted"> ({{ r.note }})</span> }</span>
        <span class="track"><i [class]="r.kind" [style.inset-inline-start.%]="r.start" [style.width.%]="r.width"></i></span>
        <span class="num value">{{ r.kind === 'plus' ? '+' : '' }}{{ fmt(r.value) }}</span>
      </div>
    }
  `,
  styles: `
    :host { display: block; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-card); padding: 10px 12px; }
    .title { margin-block-end: 6px; }
    .line { display: grid; grid-template-columns: 96px 1fr 56px; align-items: center; gap: 6px; font-size: 12px; min-height: 22px; }
    .line.total { border-block-start: 1px solid var(--border); padding-block-start: 4px; font-weight: 500; }
    .track { position: relative; height: 12px; }
    .track i { position: absolute; inset-block: 0; border-radius: 3px; }
    .track i.base { background: var(--neutral-bar); }
    .track i.plus { background: var(--out); }
    .track i.minus { background: var(--in); }
    .track i.total { background: var(--primary); }
    .value { text-align: end; }
  `,
})
export class Waterfall {
  readonly rows = input.required<WaterfallRow[]>();
  protected readonly fmt = fmt;

  protected readonly layout = computed(() => {
    const rows = this.rows();
    let running = 0;
    let peak = 1;
    const spans = rows.map((r) => {
      if (r.kind === 'base' || r.kind === 'total') {
        running = r.value;
        peak = Math.max(peak, r.value);
        return { ...r, from: 0, to: r.value };
      }
      const from = running;
      running += r.value;
      peak = Math.max(peak, from, running);
      return { ...r, from: Math.min(from, running), to: Math.max(from, running) };
    });
    return spans.map((s) => ({ ...s, start: (s.from / peak) * 100, width: Math.max(1, ((s.to - s.from) / peak) * 100) }));
  });
}
```

`today.ts` changes:
- Imports: add `effect`, `Waterfall` (`./waterfall`), `CheckInService` (`../checkin/checkin.service`), `shouldPromptCheckIn` (`../checkin/checkin.logic`), `realityLine` (`../../shared/reality-line`), `waterfallRows` (replaces `breakdownText`), `settingsOf` (`../../domain`), `LucideScale`, `LucideMoon`. The component's `imports` array becomes `[BulletBar, LucidePlus, LucideScale, LucideMoon, Waterfall]`.
- Template, at the top (before the hero):

```html
      <div class="row top">
        <button type="button" class="chip" [class.missing]="!weighIn()" (click)="quickAdd.open('weight')">
          <svg lucideScale [size]="16"></svg>
          @if (weighIn(); as w) { <span class="num">{{ fmt(w.kg, 1) }}</span> ק״ג } @else { + שקילה היום }
        </button>
        <button type="button" class="chip" (click)="checkin.show()"><svg lucideMoon [size]="16"></svg> סגירת יום</button>
      </div>
```

- The hero number loses the green: `.big { … color: var(--fg); }` (keep `.big.over { color: var(--danger); }`).
- Under the formula line add `<p class="alert reality" [class]="reality().tone">{{ reality().text }}</p>` (`.alert.neutral` is global since Task 4).
- Replace `<p class="breakdown muted small">{{ breakdown() }}</p>` with `<app-waterfall [rows]="waterfall()" />`.
- The Garmin banner button calls `checkin.show()`.
- Class body:

```ts
  protected readonly checkin = inject(CheckInService);
  protected readonly weighIn = this.state.todayWeighIn;
  protected readonly reality = computed(() => realityLine(this.state.reality()));
  protected readonly waterfall = computed(() => {
    const s = this.summary();
    const profile = this.state.profile();
    return s && profile ? waterfallRows(s, settingsOf(profile).defaultSteps) : [];
  });

  constructor() {
    effect(() => {
      const today = this.state.today();
      if (!this.checkin.open() && shouldPromptCheckIn(this.state.now(), this.state.todayDay(), this.checkin.dismissedFor() === today)) {
        this.checkin.show();
      }
    });
  }
```

- Remove `breakdown`. Add chip styles: `.top { margin-block: 8px; } .chip { min-height: 44px; border-radius: 999px; padding: 0 12px; display: inline-flex; gap: 6px; align-items: center; } .chip.missing { border-color: var(--primary); color: var(--primary); }`.

- [ ] **Step 4: Run to verify pass**

Run (app): `npx ng test --watch=false && npx ng build --base-href /kal/`
Expected: PASS; build OK.

- [ ] **Step 5: Commit**

```bash
git add app/src
git commit -m "feat(app): Today shows the weigh-in, the weight reality and how the target is built" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Week | Month

**Files:**
- Modify: `app/src/app/features/week/week.logic.ts`, `app/src/app/features/week/week.ts`
- Test: `app/src/app/features/week/week.logic.spec.ts`

**Interfaces:**
- Consumes: `summarizeWeek`, `summarizeMonth`, `monthEnd`, `reportGap`, `trendSeries`, `settingsOf`, `ENTRY_WINDOW_DAYS`, `KalState.recentEnergy`, `KalState.reality`, `realityLine`.
- Produces: `WeekRow { date; label; types: string[]; net: number; imputed: boolean }`; `WeekView { summary; rows; labels; inKcal; outKcal; imputedIdx }` (`missing`/`missingIdx` removed); `MonthCell { date; day: number; types: string[]; status: 'deficit' | 'surplus' | 'imputed' | 'today' | 'future' | 'before' }`; `MonthView { summary: MonthSummary; label: string; cells: (MonthCell | null)[] }`; `monthView(input: MonthInput): MonthView`; `canGoBackMonth(month, today): boolean`; `shiftMonth(month, delta): string`.

- [ ] **Step 1: Write the failing tests**

In `week.logic.spec.ts`:
- Change the import to `import { canGoBack, canGoBackMonth, monthView, shiftMonth, weekView } from './week.logic';`.
- In `'fills values up to today and leaves the future empty'` change the first expectation to `expect(v.inKcal.slice(0, 4)).toEqual([1800, 3200, 3200, 0]);` (09-28 has no food and 09-29 only 300, so both count as 3,200).
- Replace the test `'lists missing past days and their positions'` with:

```ts
  it('marks penalized past days and their positions', () => {
    expect(v.imputedIdx).toEqual([1, 2]);
    expect(v.rows.filter((r) => r.imputed).map((r) => r.date)).toEqual(['2026-09-28', '2026-09-29']);
  });
```

- Append:

```ts
describe('week rows', () => {
  it('shows the workout types, the net and penalized days', () => {
    const v = weekView({
      date: '2026-09-30',
      today: '2026-09-30',
      entries: [makeEntry({ date: '2026-09-27', kcal: 1800 })],
      days: [{ date: '2026-09-27', manual: { workouts: [{ type: 'Push', kcal: 350 }] } }],
      profile: testProfile,
      goal: testGoal,
      weighIns: [{ date: '2026-09-27', kg: 85 }],
    });
    expect(v.rows[0]).toMatchObject({ date: '2026-09-27', types: ['Push'], imputed: false });
    expect(v.rows[1]).toMatchObject({ date: '2026-09-28', imputed: true });
    expect(v.rows[1].net).toBeGreaterThan(0);
  });
});

describe('monthView', () => {
  const v = monthView({
    month: '2026-09',
    today: '2026-09-15',
    entries: [makeEntry({ date: '2026-09-02', kcal: 1500 })],
    days: [{ date: '2026-09-02', manual: { workouts: [{ type: 'Legs', kcal: 400 }] } }],
    profile: testProfile,
    goal: { ...testGoal, startDate: '2026-09-02' },
    weighIns: [{ date: '2026-09-02', kg: 85 }],
  });

  it('lays out the calendar from Sunday with leading blanks', () => {
    // 2026-09-01 is a Tuesday
    expect(v.cells.slice(0, 2)).toEqual([null, null]);
    expect(v.cells[2]).toMatchObject({ date: '2026-09-01', day: 1, status: 'before' });
    expect(v.label).toBe('ספטמבר 2026');
  });

  it('marks workouts, deficits, penalties, today and the future', () => {
    const cell = (d: number) => v.cells.find((c) => c?.day === d)!;
    expect(cell(2)).toMatchObject({ types: ['Legs'], status: 'deficit' });
    expect(cell(3).status).toBe('imputed');
    expect(cell(15).status).toBe('today');
    expect(cell(16).status).toBe('future');
  });

  it('moves between months only while the previous month is fully loaded', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(canGoBackMonth('2026-09', '2026-09-28')).toBe(true);
    expect(canGoBackMonth('2026-07', '2026-09-28')).toBe(false);
    expect(canGoBackMonth('2026-06', '2026-09-28')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (app): `npx ng test --watch=false`
Expected: FAIL — `imputedIdx`, `rows`, `monthView`, `shiftMonth`, `canGoBackMonth` missing; inKcal still `[1800, 0, 300, 0]`.

- [ ] **Step 3: Implement**

Replace `week.logic.ts` with:

```ts
import { ENTRY_WINDOW_DAYS } from '../../core/kal-state';
import { addDays, dateRange, summarizeMonth, summarizeWeek, type DaySummary, type MonthInput, type MonthSummary, type WeekInput, type WeekSummary } from '../../domain';
import { dayLetter, shortDate } from '../../shared/format';

export interface WeekRow {
  date: string;
  label: string;
  types: string[];
  net: number;
  imputed: boolean;
}

export interface WeekView {
  summary: WeekSummary;
  rows: WeekRow[];
  labels: string[];
  inKcal: (number | null)[];
  outKcal: (number | null)[];
  imputedIdx: number[];
}

function rowOf(d: DaySummary): WeekRow {
  return {
    date: d.date,
    label: `${dayLetter(d.date)} ${shortDate(d.date)}`,
    types: d.expenditure.workouts.map((w) => w.type),
    net: d.countedKcal - d.expenditure.out,
    imputed: d.imputed,
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
    rows: summary.days.map(rowOf),
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
```

Replace `week.ts` with:

```ts
import { Component, computed, DestroyRef, effect, inject, signal, viewChild, type ElementRef } from '@angular/core';
import type { Chart } from 'chart.js';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { KalState } from '../../core/kal-state';
import { addDays, reportGap, settingsOf, trendSeries } from '../../domain';
import { fontsReady, weekChart } from '../../shared/charts';
import { fmt, shortDate } from '../../shared/format';
import { realityLine } from '../../shared/reality-line';
import { canGoBack, canGoBackMonth, monthView, shiftMonth, weekView, type WeekView } from './week.logic';

@Component({
  selector: 'app-week',
  imports: [LucideChevronLeft, LucideChevronRight],
  template: `
    <div class="seg" role="tablist">
      <button type="button" role="tab" [class.on]="mode() === 'week'" [attr.aria-selected]="mode() === 'week'" (click)="mode.set('week')">שבוע</button>
      <button type="button" role="tab" [class.on]="mode() === 'month'" [attr.aria-selected]="mode() === 'month'" (click)="mode.set('month')">חודש</button>
    </div>

    @if (mode() === 'week') {
      @if (view(); as v) {
        <header class="row">
          <button type="button" aria-label="שבוע קודם" [disabled]="!canGoBack(v.summary.start, today())" (click)="shift(-7)"><svg lucideChevronRight [size]="18"></svg></button>
          <h2><span class="num">{{ shortDate(v.summary.start) }}–{{ shortDate(v.summary.end) }}</span></h2>
          <button type="button" aria-label="שבוע הבא" [disabled]="v.summary.end >= today()" (click)="shift(7)"><svg lucideChevronLeft [size]="18"></svg></button>
        </header>

        <div class="kpis">
          <div class="card">
            <div class="muted small">גירעון לפי הלוג</div>
            <div class="num value">{{ fmt(v.summary.avgDeficitKcal) }}</div>
            <div class="muted small">לפי המשקל <span class="num">{{ fmt(v.summary.weightDeficitKcal) }}</span> · יעד <span class="num">{{ fmt(v.summary.targetDeficitKcal) }}</span></div>
          </div>
          <div class="card">
            <div class="muted small">שינוי במגמה</div>
            <div class="num value">{{ v.summary.trendChangeKg === null ? '—' : fmt(v.summary.trendChangeKg, 1) + ' kg' }}</div>
            <div class="muted small">מתוכנן <span class="num">{{ fmt(v.summary.plannedChangeKg, 1) }}</span></div>
          </div>
          <div class="card">
            <div class="muted small">ממוצע נכנס</div>
            <div class="num value">{{ fmt(v.summary.avgInKcal) }}</div>
            <div class="muted small"><span class="num">{{ v.summary.daysLogged }}</span> ימים מלאים · <span class="num">{{ v.summary.imputedDays }}</span> לא הוזנו</div>
          </div>
          <div class="card">
            <div class="muted small">אימונים</div>
            <div class="num value">{{ v.summary.workoutsCount }}</div>
            <div class="muted small">חלבון ממוצע <span class="num">{{ v.summary.avgProtein === null ? '—' : fmt(v.summary.avgProtein) + 'g' }}</span></div>
          </div>
        </div>

        @if (gap(); as g) {
          @if (g.alert) {
            <div class="alert warning">הלוג מראה גירעון שהמשקל לא מאשר: כ-<span class="num">{{ fmt(g.gapKcalPerDay) }}</span> קל׳ ביום</div>
          }
        }

        <div class="chart"><canvas #chart aria-label="נכנס מול יצא לפי יום"></canvas></div>

        <ul class="rows">
          @for (r of v.rows; track r.date) {
            <li class="row" [class.imputed]="r.imputed">
              <span>{{ r.label }}</span>
              <span>
                @for (t of r.types; track $index) { <span class="tag">{{ t }}</span> }
                @if (r.imputed) { <span class="small">לא הוזן · נחשב <span class="num">{{ fmt(missingKcal()) }}</span></span> }
              </span>
              <span class="num">{{ r.net > 0 ? '+' : '' }}{{ fmt(r.net) }}</span>
            </li>
          }
        </ul>
      }
    } @else {
      @if (monthData(); as mv) {
        <header class="row">
          <button type="button" aria-label="חודש קודם" [disabled]="!canGoBackMonth(month(), today())" (click)="month.set(shiftMonth(month(), -1))"><svg lucideChevronRight [size]="18"></svg></button>
          <h2>{{ mv.label }}</h2>
          <button type="button" aria-label="חודש הבא" [disabled]="month() >= today().slice(0, 7)" (click)="month.set(shiftMonth(month(), 1))"><svg lucideChevronLeft [size]="18"></svg></button>
        </header>

        <p class="alert" [class]="reality().tone">{{ reality().text }}</p>

        <div class="kpis three">
          <div class="card"><div class="muted small">אימונים</div><div class="num value">{{ mv.summary.workoutsCount }}</div></div>
          <div class="card"><div class="muted small">בשבוע</div><div class="num value">{{ fmt(mv.summary.workoutsPerWeek, 1) }}</div></div>
          <div class="card"><div class="muted small">לא הוזנו</div><div class="num value">{{ mv.summary.imputedDays }}</div></div>
        </div>
        <p class="muted small">גירעון ביום: לפי הלוג <span class="num">{{ fmt(mv.summary.avgDeficitKcal) }}</span> · לפי המשקל <span class="num">{{ fmt(mv.summary.weightDeficitKcal) }}</span></p>

        <div class="cal head">
          @for (d of weekdays; track d) { <span>{{ d }}</span> }
        </div>
        <div class="cal">
          @for (c of mv.cells; track $index) {
            @if (c) {
              <div class="cell" [class]="c.status"><span class="num">{{ c.day }}</span><span class="t">{{ c.status === 'imputed' ? '!' : c.types.join(' ') }}</span></div>
            } @else {
              <div></div>
            }
          }
        </div>
      }
    }
  `,
  styles: `
    header { margin-block: 8px; }
    .seg { display: flex; gap: 4px; margin-block: 8px; }
    .seg button { flex: 1; }
    .seg .on { background: var(--primary); color: var(--on-primary); border-color: transparent; }
    .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-block: 12px; }
    .kpis.three { grid-template-columns: repeat(3, 1fr); }
    .value { font-size: 20px; font-weight: 500; }
    .chart { position: relative; height: 200px; margin-block: 12px; }
    .rows { list-style: none; margin: 0; padding: 0; }
    .rows li { padding-block: 6px; border-block-end: 1px solid var(--border); font-size: 13px; }
    .rows li.imputed { color: var(--danger); }
    .tag { border: 1px solid var(--border); border-radius: 999px; padding: 0 8px; font-size: 11px; margin-inline-end: 4px; }
    .cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
    .cal.head { font-size: 11px; color: var(--fg-muted); text-align: center; margin-block-end: 3px; }
    .cell { min-height: 44px; border-radius: 6px; padding: 2px 4px; font-size: 11px; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--border); }
    /* Deficit is what the log says, not a verdict: a neutral tint, never the success token. */
    .cell.deficit { background: color-mix(in srgb, var(--out) 12%, transparent); }
    .cell.surplus { background: var(--warning-bg); color: var(--warning-fg); }
    .cell.imputed { background: color-mix(in srgb, var(--danger) 15%, transparent); color: var(--danger); font-weight: 500; }
    .cell.today { outline: 2px solid var(--primary); }
    .cell.future, .cell.before { color: var(--fg-muted); border-style: dashed; }
    .t { font-weight: 500; font-size: 10px; }
  `,
})
export class Week {
  private readonly state = inject(KalState);
  protected readonly fmt = fmt;
  protected readonly shortDate = shortDate;
  protected readonly today = this.state.today;
  protected readonly canGoBack = canGoBack;
  protected readonly canGoBackMonth = canGoBackMonth;
  protected readonly shiftMonth = shiftMonth;
  protected readonly weekdays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  protected readonly mode = signal<'week' | 'month'>('week');
  protected readonly month = signal(this.state.today().slice(0, 7));
  private readonly weekDate = signal(this.state.today());
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('chart');
  private chart: Chart | undefined;
  private drawToken = 0;

  protected readonly reality = computed(() => realityLine(this.state.reality()));
  protected readonly missingKcal = computed(() => {
    const profile = this.state.profile();
    return profile ? settingsOf(profile).missingDayKcal : null;
  });

  private readonly input = computed(() => {
    const profile = this.state.profile();
    const goal = this.state.goal();
    if (!profile || !goal) return null;
    return { today: this.state.today(), entries: this.state.entries(), days: this.state.days(), profile, goal, weighIns: this.state.weighIns() };
  });

  protected readonly view = computed(() => {
    const input = this.input();
    return input ? weekView({ ...input, date: this.weekDate() }) : null;
  });

  protected readonly monthData = computed(() => {
    const input = this.input();
    return input ? monthView({ ...input, month: this.month() }) : null;
  });

  protected readonly gap = computed(() => {
    const input = this.input();
    if (!input) return null;
    return reportGap({
      today: input.today,
      goal: input.goal,
      energy: this.state.recentEnergy(),
      series: trendSeries(input.weighIns),
      lowDayThresholdKcal: settingsOf(input.profile).lowDayThresholdKcal,
    });
  });

  constructor() {
    effect(() => {
      const v = this.view();
      const canvas = this.canvas();
      if (v && canvas) void this.draw(canvas.nativeElement, v);
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  protected shift(days: number): void {
    this.weekDate.update((d) => addDays(d, days));
  }

  private async draw(canvas: HTMLCanvasElement, v: WeekView): Promise<void> {
    const token = ++this.drawToken;
    await fontsReady();
    if (token !== this.drawToken) return;
    this.chart?.destroy();
    this.chart = weekChart(canvas, v.labels, v.inKcal, v.outKcal, v.imputedIdx);
  }
}
```

(The week's penalized days are listed in the rows, so the old "ימים חסרים" alert and `missingText` are gone. The report-gap alert here is the same rule the Weight tab uses, on the same `recentEnergy`.)

- [ ] **Step 4: Run to verify pass**

Run (app): `npx ng test --watch=false && npx ng build --base-href /kal/`
Expected: PASS; build OK.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/features/week
git commit -m "feat(app): week rows with workouts, penalties and the report-gap alert; month calendar view" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Docs, gates, deploy

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-kal-design.md` (§14 below-BMR rule), `design-system/kal/MASTER.md`, `docs/setup.md` (nothing new for the owner — skip if unchanged)

- [ ] **Step 1: Docs**

- Spec §14: replace "The "target below BMR" warning judges a typical day: `bmr + stepsKcal(defaultSteps) − deficit < bmr`." with "The "target below BMR" warning fires when a typical day's target (`bmr + stepsKcal(defaultSteps) − deficit`) is below 75% of BMR."
- Spec §14 Reality check: after "`stalled` if it fell less than half the planned amount" add "(the goal pace over the 14 days while the trend is above target)", and add the line "The logged deficit uses only days on or after the goal start."
- Spec §14 Daily check-in: add "The quick-add sheet no longer has an activity tab; steps and workouts go through the check-in, or through Claude with `id: "checkin"` for a past day. An `activity` op without `workouts` keeps the day's workouts; `workouts: []` removes them."
- MASTER.md: change the quick-add line to "**Bottom sheet (quick-add):** segmented tabs ארוחה · משקל (activity moved to the check-in sheet); macros hidden behind "+ מאקרו"." and add "**Check-in sheet:** bottom sheet; steps input with the default as placeholder; workout type chips (44px); calories input only when a type is chosen; food status line (danger when the day would be penalized); optional weight; לא עכשיו · שמירה."
- MASTER.md Components: add "Waterfall (Today): rows BMR / steps / workouts / deficit / target; signed values next to every bar; defaulted steps carry a note." and "Month calendar: 7-column grid from Sunday; each cell shows the day number and the workout type as text; background is supplementary (deficit / surplus / not logged '!')." Charts table: Week bars use counted intake; penalized days get the dashed outline.

- [ ] **Step 2: Full gate**

Run (root): `npm run typecheck && npm test && (cd app && npx ng test --watch=false && npx ng build --base-href /kal/)`
Expected: all PASS; build clean.

- [ ] **Step 3: Commit and push**

```bash
git add docs design-system
git commit -m "docs: check-in, penalty and reality rules" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push
```

- [ ] **Step 4: CI and live check**

Wait for `gh run list --repo yuda85/kal --limit 2` to show `test` and `deploy` succeeded on the pushed commit; then `curl -s -o /dev/null -w "%{http_code}" https://yuda85.github.io/kal/` → 200, and `node .claude/skills/kal/scripts/read.ts profile` shows a `reality` block for the owner's data.
