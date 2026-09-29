# Weekly Weight Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 84-day daily weight chart with a weekly view (this week's change, progress to goal, weekly means chart, this week's weigh-ins) and use one weekly-change rule everywhere (spec §16).

**Architecture:** A new `domain/weekly.ts` owns the mean-of-real-weigh-ins rule; `summarizeRange` uses it for `weightChangeKg`. The weight screen's view model (`weight.logic.ts`) computes everything including SVG chart geometry; the template renders it as inline SVG. Chart.js is no longer used on the weight screen.

**Tech Stack:** TypeScript domain (vitest, `npm test`), Angular 20 standalone components with signals (`cd app && npx ng test --watch=false`).

## Global Constraints

- All calculations live in `domain/`; the app imports it only via `app/src/app/domain.ts`.
- `domain/` is erasable-syntax TypeScript: no enums, namespaces, parameter properties; `.ts` import extensions; `import type` for types; zero runtime dependencies.
- UI text is Hebrew, RTL. Numbers use `class="num"`; minus is a real minus (`−`).
- Weeks run Sunday to Saturday (`weekStart`). Carried weights never count in means.
- The trend (EWMA) still drives the reality check, ETA, report gap, BMR and protein.
- Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Domain weekly means

**Files:**
- Create: `domain/weekly.ts`, `domain/weekly.test.ts`
- Modify: `domain/index.ts` (export)

**Interfaces:**
- Produces:
  - `meanWeight(weighIns: WeighIn[], from: string, to: string): number | null`
  - `weightChange(weighIns: WeighIn[], start: string, end: string, today: string): number | null`
  - `interface WeekWeight { start: string; meanKg: number | null; count: number; changeKg: number | null }`
  - `weeklyWeights(weighIns: WeighIn[], from: string, today: string): WeekWeight[]`

- [ ] **Step 1: Write the failing test** — `domain/weekly.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { meanWeight, weeklyWeights, weightChange } from './weekly.ts';

const weighIns = [
  { date: '2026-09-15', kg: 86 }, // week of 09-13
  { date: '2026-09-17', kg: 85 },
  { date: '2026-09-26', kg: 85.2 }, // week of 09-20 (Saturday)
  { date: '2026-09-27', kg: 85 }, // week of 09-27
  { date: '2026-09-29', kg: 84.5 },
];

describe('meanWeight', () => {
  it('averages the real weigh-ins in the range', () => {
    expect(meanWeight(weighIns, '2026-09-27', '2026-10-03')).toBeCloseTo(84.75, 10);
  });
  it('is null without a weigh-in', () => {
    expect(meanWeight(weighIns, '2026-09-18', '2026-09-25')).toBeNull();
  });
});

describe('weightChange', () => {
  it('compares the range mean up to today with the previous range of the same length', () => {
    expect(weightChange(weighIns, '2026-09-27', '2026-10-03', '2026-09-30')).toBeCloseTo(-0.45, 10);
  });
  it('ignores weigh-ins after today', () => {
    expect(weightChange(weighIns, '2026-09-27', '2026-10-03', '2026-09-27')).toBeCloseTo(-0.2, 10);
  });
  it('is null when either range has no weigh-in', () => {
    expect(weightChange(weighIns, '2026-09-13', '2026-09-19', '2026-09-30')).toBeNull();
    expect(weightChange(weighIns, '2026-10-04', '2026-10-10', '2026-10-05')).toBeNull();
  });
});

describe('weeklyWeights', () => {
  const weeks = weeklyWeights(weighIns, '2026-09-15', '2026-09-30');

  it('lists every week from the start week to this week', () => {
    expect(weeks.map((w) => w.start)).toEqual(['2026-09-13', '2026-09-20', '2026-09-27']);
  });
  it('gives each week its mean, weigh-in count and change from the week before', () => {
    expect(weeks[0]).toEqual({ start: '2026-09-13', meanKg: 85.5, count: 2, changeKg: null });
    expect(weeks[1].meanKg).toBeCloseTo(85.2, 10);
    expect(weeks[1].changeKg).toBeCloseTo(-0.3, 10);
    expect(weeks[2].count).toBe(2);
    expect(weeks[2].changeKg).toBeCloseTo(-0.45, 10);
  });
  it('leaves a week without weigh-ins empty', () => {
    const gap = weeklyWeights([{ date: '2026-09-15', kg: 86 }, { date: '2026-09-29', kg: 85 }], '2026-09-13', '2026-09-30');
    expect(gap[1]).toEqual({ start: '2026-09-20', meanKg: null, count: 0, changeKg: null });
    expect(gap[2].changeKg).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run domain/weekly.test.ts`
Expected: FAIL, cannot resolve `./weekly.ts`.

- [ ] **Step 3: Implement** — `domain/weekly.ts`

```ts
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
```

Add to `domain/index.ts` after the `trend.ts` line: `export * from './weekly.ts';`

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run domain/weekly.test.ts` → PASS. Then `npm run typecheck` → no errors.

- [ ] **Step 5: Commit**

```bash
git add domain/weekly.ts domain/weekly.test.ts domain/index.ts
git commit -m "feat(domain): weekly weight means and the weekly change rule"
```

---

### Task 2: One weekly change in summaries, the week screen and the skill

**Files:**
- Modify: `domain/summary.ts` (`RangeSummary`, `summarizeRange`), `domain/summary.test.ts`
- Modify: `app/src/app/features/week/week.ts:37-38`
- Modify: `.claude/skills/kal/SKILL.md:73`

**Interfaces:**
- Consumes: `weightChange` from Task 1.
- Produces: `RangeSummary.weightChangeKg: number | null` (replaces `trendChangeKg`); `weightDeficitKcal = −weightChangeKg × 7700 / range length in days`.

- [ ] **Step 1: Update tests** — in `domain/summary.test.ts` `describe('summarizeWeek')`:
  - Rename the test `'compares the trend change with the plan prorated to the elapsed days'` to `'compares the weekly change with the plan prorated to the elapsed days'` and replace its first two lines with:
    ```ts
    // mean (85 + 84.5) / 2 = 84.75 vs last week's 85.2
    expect(w.weightChangeKg).toBeCloseTo(-0.45, 10);
    ```
  - `'reports no trend change for a week without weigh-ins'` → rename to `'reports no weekly change for a week without weigh-ins'`, assert `noWeights.weightChangeKg` is null.
  - In `'returns null averages when nothing is logged'`: `expect(empty.weightChangeKg).toBeNull();`
  - In `'counts workouts and the weight-implied deficit'` replace the comment and the deficit assertion with:
    ```ts
    // −0.45 kg over the 7-day week
    expect(ww.weightDeficitKcal).toBeCloseTo((0.45 * 7700) / 7, 6);
    ```
  - Replace the whole test `'measures the weight trend from the first weigh-in when none came before the week'` with:
    ```ts
    it('reports no weekly change without a weigh-in the week before', () => {
      const inside = [{ date: '2026-09-27', kg: 85 }, { date: '2026-09-29', kg: 84.5 }];
      const ww = summarizeWeek({ date: '2026-09-30', today: '2026-09-30', entries: weekEntries, days: [], profile: testProfile, goal: testGoal, weighIns: inside });
      expect(ww.weightChangeKg).toBeNull();
      expect(ww.weightDeficitKcal).toBeNull();
    });
    ```
  - `'reports no trend change from a single weigh-in'` → rename to `'reports no weekly change from a single weigh-in'`, assert on `one.weightChangeKg`.
  - In `describe('summarizeMonth')` add:
    ```ts
    it('compares the month mean with the previous equal-length span', () => {
      const mm = summarizeMonth({
        month: '2026-09', today: '2026-09-15', entries, days, profile: testProfile, goal: testGoal,
        weighIns: [{ date: '2026-08-20', kg: 88 }, { date: '2026-09-05', kg: 87 }, { date: '2026-09-12', kg: 86 }],
      });
      // 86.5 vs 88 (08-01..08-31); deficit over the 30-day month
      expect(mm.weightChangeKg).toBeCloseTo(-1.5, 10);
      expect(mm.weightDeficitKcal).toBeCloseTo((1.5 * 7700) / 30, 6);
    });
    ```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run domain/summary.test.ts` → FAIL (`weightChangeKg` undefined).

- [ ] **Step 3: Implement** — in `domain/summary.ts`:
  - `RangeSummary`: rename `trendChangeKg: number | null;` to `weightChangeKg: number | null;`
  - In `summarizeRange`, delete the block from `const lastDate = dates.at(-1) ?? start;` through `const trendChangeKg = …;` (lines computing `series`, `weighedInRange`, `trendEnd`, `before`, `inRange`, `from`, `span`, `trendChangeKg`) and put in its place:
    ```ts
    // Mean of real weigh-ins vs the previous range of the same length (§16); the trend stays for status and ETA.
    const weightChangeKg = weightChange(input.weighIns, start, end, input.today);
    const length = daysBetween(start, end) + 1;
    ```
  - In the returned object replace the two weight lines with:
    ```ts
    weightChangeKg,
    weightDeficitKcal: weightChangeKg === null ? null : (-weightChangeKg * KCAL_PER_KG) / length,
    ```
  - Add `import { weightChange } from './weekly.ts';` and remove imports that are now unused (`npm run typecheck` names them).

- [ ] **Step 4: Week screen label** — `app/src/app/features/week/week.ts` lines 37–38 become:
  ```html
  <div class="muted small">שינוי במשקל (ממוצע)</div>
  <div class="num value">{{ v.summary.weightChangeKg === null ? '—' : fmt(v.summary.weightChangeKg, 1) + ' kg' }}</div>
  ```

- [ ] **Step 5: Skill** — `.claude/skills/kal/SKILL.md` line 73: replace `` `trendChangeKg` vs `plannedChangeKg` `` with `` `weightChangeKg` (mean of this week's weigh-ins vs last week's) vs `plannedChangeKg` ``. Line 81 is about `profile.reality` and stays.

- [ ] **Step 6: Verify**

Run: `npm test` → all pass. `npm run typecheck` → clean. `grep -rn "trendChangeKg" app/src domain .claude` → only `reality.ts`, `reality.test.ts`, `reality-line*` and SKILL.md line 81.

- [ ] **Step 7: Commit**

```bash
git add domain/summary.ts domain/summary.test.ts app/src/app/features/week/week.ts .claude/skills/kal/SKILL.md
git commit -m "feat: week and month weight change from weigh-in means"
```

---

### Task 3: Weight view model and kg formatting

**Files:**
- Modify: `app/src/app/shared/format.ts`, `app/src/app/shared/format.spec.ts`
- Rewrite: `app/src/app/features/weight/weight.logic.ts`, `app/src/app/features/weight/weight.logic.spec.ts`

**Interfaces:**
- Consumes: `weeklyWeights`, `WeekWeight` (Task 1) via `../../domain`.
- Produces:
  - `signedKg(n: number): string` — one decimal, real minus: `−0.5`, `+0.3`, `0`.
  - `WEIGHT_WEEKS = 12`, `CHART_W = 300`, `CHART_H = 150`
  - `interface ChartPoint { x: number; y: number; kg: number; label: string; changeKg: number | null; current: boolean }`
  - `interface WeeklyChart { points: ChartPoint[]; lines: string[]; ticks: { y: number; kg: number }[] }`
  - `interface WeightView { thisWeek: WeekWeight; lastWeek: WeekWeight | null; currentKg: number | null; startKg: number; targetKg: number; lostKg: number | null; leftKg: number | null; progress: number; chart: WeeklyChart; days: { date: string; kg: number | null }[]; eta: string | null; gap: ReportGap | null }`
  - `weightView(input: { today: string; goal: Goal; weighIns: WeighIn[]; energy: DayEnergy[]; lowDayThresholdKcal: number }): WeightView`
  - `weeklyChart(weeks: WeekWeight[], thisWeekStart: string): WeeklyChart`

- [ ] **Step 1: Write failing tests**

Append to `format.spec.ts` (and add `signedKg` to its import):
```ts
it('signs kilograms with one decimal and a real minus', () => {
  expect(signedKg(-0.46)).toBe('−0.5');
  expect(signedKg(0.3)).toBe('+0.3');
  expect(signedKg(-0.04)).toBe('0');
});
```

Replace `weight.logic.spec.ts` with:
```ts
import { testGoal } from '../../../../../domain/testing.ts';
import { CHART_H, weeklyChart, weightView } from './weight.logic';

// testGoal: starts 2026-09-01 at 90 kg, target 80.
const weighIns = [
  { date: '2026-09-15', kg: 88 },
  { date: '2026-09-17', kg: 87 },
  { date: '2026-09-26', kg: 87.2 },
  { date: '2026-09-27', kg: 86.8 },
  { date: '2026-09-29', kg: 86.4 },
];
const input = { today: '2026-09-30', goal: testGoal, weighIns, energy: [], lowDayThresholdKcal: 800 };

describe('weightView', () => {
  const v = weightView(input);

  it('leads with this week against last week', () => {
    expect(v.thisWeek.start).toBe('2026-09-27');
    expect(v.thisWeek.meanKg).toBeCloseTo(86.6, 10);
    expect(v.thisWeek.changeKg).toBeCloseTo(-0.6, 10);
    expect(v.lastWeek?.meanKg).toBeCloseTo(87.2, 10);
  });

  it('measures progress from the start weight with the latest week mean', () => {
    expect(v.currentKg).toBeCloseTo(86.6, 10);
    expect(v.lostKg).toBeCloseTo(3.4, 10);
    expect(v.leftKg).toBeCloseTo(6.6, 10);
    expect(v.progress).toBeCloseTo(0.34, 10);
  });

  it('lists this week from Sunday to today', () => {
    expect(v.days).toEqual([
      { date: '2026-09-27', kg: 86.8 },
      { date: '2026-09-28', kg: null },
      { date: '2026-09-29', kg: 86.4 },
      { date: '2026-09-30', kg: null },
    ]);
  });

  it('falls back to the last weighed week when this week has none', () => {
    const early = weightView({ ...input, weighIns: weighIns.slice(0, 3) });
    expect(early.thisWeek.meanKg).toBeNull();
    expect(early.currentKg).toBeCloseTo(87.2, 10);
  });

  it('shows a gain as an empty bar', () => {
    const up = weightView({ ...input, weighIns: [{ date: '2026-09-29', kg: 91 }] });
    expect(up.lostKg).toBeCloseTo(-1, 10);
    expect(up.progress).toBe(0);
    expect(up.leftKg).toBeCloseTo(11, 10);
  });

  it('charts the weeks since the goal started', () => {
    // 09-01 is a Tuesday: weeks of 08-30, 09-06, 09-13, 09-20, 09-27
    expect(v.chart.points.map((p) => p.label)).toEqual(['13.9', '20.9', 'השבוע']);
    expect(v.chart.lines).toHaveLength(1);
  });
});

describe('weeklyChart', () => {
  const week = (start: string, meanKg: number | null, changeKg: number | null = null) => ({ start, meanKg, count: meanKg === null ? 0 : 1, changeKg });

  it('puts heavier weeks higher and marks the current week', () => {
    const c = weeklyChart([week('2026-09-20', 87), week('2026-09-27', 86, -1)], '2026-09-27');
    expect(c.points[0].y).toBeLessThan(c.points[1].y);
    expect(c.points[0].x).toBeLessThan(c.points[1].x);
    expect(c.points[1]).toMatchObject({ current: true, label: 'השבוע', changeKg: -1 });
    expect(c.ticks).toHaveLength(3);
    for (const p of c.points) expect(p.y).toBeGreaterThan(0), expect(p.y).toBeLessThan(CHART_H);
  });

  it('breaks the line over a week without weigh-ins', () => {
    const c = weeklyChart([week('2026-09-13', 88), week('2026-09-20', null), week('2026-09-27', 86)], '2026-09-27');
    expect(c.points).toHaveLength(2);
    expect(c.lines).toHaveLength(0);
  });

  it('draws a single week as one centred point', () => {
    const c = weeklyChart([week('2026-09-27', 86)], '2026-09-27');
    expect(c.points).toHaveLength(1);
    expect(c.lines).toHaveLength(0);
  });

  it('has no points without weigh-ins', () => {
    expect(weeklyChart([week('2026-09-27', null)], '2026-09-27').points).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd app && npx ng test --watch=false` → FAIL (`signedKg`, `weeklyChart`, new view fields missing).

- [ ] **Step 3: Implement**

`format.ts`, after `signed`:
```ts
/** A weight change with one decimal and a real minus: −0.5, +0.3, 0. */
export function signedKg(n: number): string {
  const r = Math.round(n * 10) / 10;
  return r > 0 ? `+${fmt(r, 1)}` : r < 0 ? `−${fmt(-r, 1)}` : '0';
}
```

`weight.logic.ts` (whole file):
```ts
import {
  addDays,
  dateRange,
  eta,
  reportGap,
  trendSeries,
  weekStart,
  weeklyWeights,
  type DayEnergy,
  type Goal,
  type ReportGap,
  type WeekWeight,
  type WeighIn,
} from '../../domain';
import { shortDate } from '../../shared/format';

export const WEIGHT_WEEKS = 12;
export const CHART_W = 300;
export const CHART_H = 150;
const PLOT = { left: 34, right: CHART_W - 16, top: 26, bottom: 118 };

export interface ChartPoint {
  x: number;
  y: number;
  kg: number;
  label: string;
  changeKg: number | null;
  current: boolean;
}

export interface WeeklyChart {
  points: ChartPoint[];
  /** SVG polyline `points` strings; the line breaks over weeks without weigh-ins. */
  lines: string[];
  ticks: { y: number; kg: number }[];
}

export interface WeightView {
  thisWeek: WeekWeight;
  lastWeek: WeekWeight | null;
  currentKg: number | null;
  startKg: number;
  targetKg: number;
  lostKg: number | null;
  leftKg: number | null;
  /** 0..1 of the way from the start weight to the target. */
  progress: number;
  chart: WeeklyChart;
  days: { date: string; kg: number | null }[];
  eta: string | null;
  gap: ReportGap | null;
}

export function weeklyChart(weeks: WeekWeight[], thisWeekStart: string): WeeklyChart {
  const kgs = weeks.flatMap((w) => (w.meanKg === null ? [] : [w.meanKg]));
  if (kgs.length === 0) return { points: [], lines: [], ticks: [] };
  const mid = (Math.max(...kgs) + Math.min(...kgs)) / 2;
  const half = Math.max(0.5, (Math.max(...kgs) - Math.min(...kgs)) / 2) + 0.2;
  const hi = mid + half;
  const lo = mid - half;
  const y = (kg: number) => PLOT.top + ((hi - kg) / (hi - lo)) * (PLOT.bottom - PLOT.top);
  const x = (i: number) => (weeks.length === 1 ? (PLOT.left + PLOT.right) / 2 : PLOT.left + (i * (PLOT.right - PLOT.left)) / (weeks.length - 1));

  const points: ChartPoint[] = [];
  const lines: string[] = [];
  let run: string[] = [];
  weeks.forEach((w, i) => {
    if (w.meanKg === null) {
      if (run.length > 1) lines.push(run.join(' '));
      run = [];
      return;
    }
    const current = w.start === thisWeekStart;
    const point = { x: x(i), y: y(w.meanKg), kg: w.meanKg, label: current ? 'השבוע' : shortDate(w.start), changeKg: w.changeKg, current };
    points.push(point);
    run.push(`${point.x},${point.y}`);
  });
  if (run.length > 1) lines.push(run.join(' '));
  return { points, lines, ticks: [hi, mid, lo].map((kg) => ({ kg, y: y(kg) })) };
}

export function weightView(input: { today: string; goal: Goal; weighIns: WeighIn[]; energy: DayEnergy[]; lowDayThresholdKcal: number }): WeightView {
  const { today, goal, weighIns } = input;
  const thisStart = weekStart(today);
  const all = weeklyWeights(weighIns, goal.startDate < today ? goal.startDate : today, today);
  const thisWeek = all.at(-1)!;
  const lastWeek = all.at(-2) ?? null;
  const currentKg = [...all].reverse().find((w) => w.meanKg !== null)?.meanKg ?? null;
  const span = goal.startWeightKg - goal.targetWeightKg;
  const lostKg = currentKg === null ? null : goal.startWeightKg - currentKg;
  const kgByDate = new Map(weighIns.map((w) => [w.date, w.kg]));
  const series = trendSeries(weighIns, today);
  return {
    thisWeek,
    lastWeek,
    currentKg,
    startKg: goal.startWeightKg,
    targetKg: goal.targetWeightKg,
    lostKg,
    leftKg: currentKg === null ? null : Math.max(0, currentKg - goal.targetWeightKg),
    progress: lostKg === null || span <= 0 ? 0 : Math.min(1, Math.max(0, lostKg / span)),
    chart: weeklyChart(all.slice(-WEIGHT_WEEKS), thisStart),
    days: dateRange(thisStart, today).map((date) => ({ date, kg: kgByDate.get(date) ?? null })),
    eta: eta(series, goal, today),
    gap: reportGap({ today, goal, energy: input.energy, series, lowDayThresholdKcal: input.lowDayThresholdKcal }),
  };
}
```

Note: the test `'charts the weeks since the goal started'` expects only weeks with a mean as points (weeks 08-30 and 09-06 have none) and one line for the three consecutive weighed weeks. `addDays` is imported only if typecheck needs it; remove it if unused.

- [ ] **Step 4: Run to verify they pass**

Run: `cd app && npx ng test --watch=false` → the new specs pass. `weight.ts` still references removed fields, so a compile error there is expected until Task 4; if the test runner refuses to build, do Task 4 before running and commit Tasks 3 and 4 together.

- [ ] **Step 5: Commit** (with Task 4 if the build requires it)

```bash
git add app/src/app/shared/format.ts app/src/app/shared/format.spec.ts app/src/app/features/weight/weight.logic.ts app/src/app/features/weight/weight.logic.spec.ts
git commit -m "feat(app): weekly weight view model"
```

---

### Task 4: Weight screen template, remove the old chart

**Files:**
- Rewrite: `app/src/app/features/weight/weight.ts`
- Modify: `app/src/app/shared/charts.ts` (delete `weightChart`, lines 91–122)

**Interfaces:**
- Consumes: `weightView`, `WeightView`, `CHART_W`, `CHART_H` (Task 3); `signedKg`, `fmt`, `shortDate`, `dayLetter` from `shared/format`; `realityLine`.

- [ ] **Step 1: Replace `weight.ts`**

```ts
import { Component, computed, inject } from '@angular/core';
import { KalState } from '../../core/kal-state';
import { dateRange } from '../../domain';
import { dayLetter, fmt, shortDate, signedKg } from '../../shared/format';
import { realityLine } from '../../shared/reality-line';
import { QuickAddService } from '../today/quick-add.service';
import { CHART_H, CHART_W, weightView } from './weight.logic';

@Component({
  selector: 'app-weight',
  template: `
    @if (view(); as v) {
      <section class="hero">
        @if (v.thisWeek.meanKg !== null) {
          @if (v.thisWeek.changeKg !== null) {
            <div class="big"><span class="num" dir="ltr" [class.down]="v.thisWeek.changeKg < 0">{{ signedKg(v.thisWeek.changeKg) }}</span> <small>ק״ג השבוע</small></div>
          }
          <div class="muted small">ממוצע השבוע <span class="num">{{ fmt(v.thisWeek.meanKg, 1) }}</span>
            @if (v.lastWeek?.meanKg != null) { · שבוע שעבר <span class="num">{{ fmt(v.lastWeek!.meanKg, 1) }}</span> }
          </div>
        } @else {
          <div class="title">עוד לא נשקלת השבוע</div>
          @if (v.lastWeek?.changeKg != null) {
            <div class="muted small">שבוע שעבר <span class="num" dir="ltr">{{ signedKg(v.lastWeek!.changeKg!) }}</span> ק״ג</div>
          }
        }
      </section>

      @if (v.lostKg !== null) {
        <section class="progress">
          <div class="track" role="img" [attr.aria-label]="progressLabel()"><i [style.width.%]="v.progress * 100"></i></div>
          <div class="ends small muted">
            <span>התחלה <span class="num">{{ fmt(v.startKg, 1) }}</span></span>
            <span>{{ v.lostKg >= 0 ? 'ירדו' : 'עלו' }} <span class="num">{{ fmt(v.lostKg >= 0 ? v.lostKg : -v.lostKg, 1) }}</span> · נשארו <span class="num">{{ fmt(v.leftKg, 1) }}</span></span>
            <span>יעד <span class="num">{{ fmt(v.targetKg, 1) }}</span></span>
          </div>
        </section>
      }

      <p class="alert" [class]="reality().tone">
        {{ reality().text }}@if (v.eta && reality().tone !== 'neutral') { · צפי <span class="num">{{ shortDate(v.eta) }}</span> }
      </p>

      @if (v.chart.points.length > 0) {
        <section class="card">
          <h3 class="small">ממוצע לשבוע</h3>
          <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="chartLabel()">
            @for (t of v.chart.ticks; track $index) {
              <line class="grid" x1="30" [attr.x2]="W" [attr.y1]="t.y" [attr.y2]="t.y" />
              <text class="tick" x="0" [attr.y]="t.y + 3">{{ fmt(t.kg, 1) }}</text>
            }
            @for (l of v.chart.lines; track $index) {
              <polyline class="line" [attr.points]="l" />
            }
            @for (p of v.chart.points; track p.label) {
              <circle [class.now]="p.current" [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="p.current ? 6 : 4" />
              @if (p.changeKg !== null) {
                <text class="change" [class.now]="p.current" [attr.x]="p.x" [attr.y]="p.y - 11">{{ signedKg(p.changeKg) }}</text>
              }
              <text class="label" [class.now]="p.current" [attr.x]="p.x" [attr.y]="H - 8">{{ p.label }}</text>
            }
          </svg>
        </section>
      }

      <section class="days">
        <h3 class="small muted">השקילות השבוע</h3>
        @for (d of v.days; track d.date) {
          <div class="row day" [class.missing]="d.kg === null">
            <span>{{ dayLetter(d.date) }} <span class="num">{{ shortDate(d.date) }}</span>{{ d.date === today() ? ' · היום' : '' }}</span>
            <span>@if (d.kg === null) { לא נשקלת } @else { <span class="num">{{ fmt(d.kg, 1) }}</span> }</span>
          </div>
        }
      </section>

      @if (v.gap; as g) {
        <section class="card gap">
          <div class="row"><span>בדיקת דיווח · <span class="num">{{ gapDays(g.from, g.to) }}</span> ימים</span>
            <span [class.error]="g.alert">{{ g.incompleteDays > 0 ? 'לא נבדק' : g.alert ? 'פער' : 'תקין' }}</span></div>
          @if (g.incompleteDays > 0) {
            <div class="muted small">חסרים <span class="num">{{ g.incompleteDays }}</span> ימים מלאים, אי אפשר לבדוק את הדיוק.</div>
          } @else {
            <div class="muted small">צפוי <span class="num">{{ fmt(g.expectedChangeKg, 1) }}</span> · בפועל <span class="num">{{ fmt(g.actualChangeKg, 1) }}</span> kg</div>
            @if (g.alert) {
              <div class="small">פער של כ-<span class="num">{{ fmt(g.gapKcalPerDay) }}</span> קל׳ ביום בין הדיווח למשקל</div>
            }
          }
        </section>
      }

      <button type="button" class="add" (click)="quickAdd.open('weight')">+ הוספת שקילה</button>
    }
  `,
  styles: `
    .hero { margin-block: 12px 4px; }
    .big { font-size: 34px; font-weight: 500; line-height: 1.2; }
    .big small { font-size: 15px; font-weight: 400; color: var(--fg-muted); }
    .down { color: var(--out); }
    .title { font-size: 17px; font-weight: 500; }
    .progress { margin-block: 12px; }
    .track { height: 8px; border-radius: 999px; background: var(--border); overflow: hidden; }
    .track i { display: block; height: 100%; background: var(--out); border-radius: 999px; }
    .ends { display: flex; justify-content: space-between; gap: 8px; margin-top: 4px; }
    .alert { margin-block: 12px; }
    .card { margin-block: 12px; }
    h3 { margin: 0 0 6px; font-weight: 500; }
    svg { display: block; width: 100%; height: auto; direction: ltr; }
    .grid { stroke: var(--border); }
    .tick, .change, .label { font-size: 10px; fill: var(--fg-muted); font-variant-numeric: tabular-nums; }
    .change, .label { text-anchor: middle; }
    .change.now, .label.now { fill: var(--fg); font-weight: 700; }
    .line { fill: none; stroke: var(--neutral-bar); stroke-width: 2; }
    circle { fill: var(--neutral-bar); }
    circle.now { fill: var(--out); }
    .days { margin-block: 12px; }
    .day { padding: 8px 2px; border-bottom: 1px solid var(--border); }
    .day.missing { color: var(--fg-muted); }
    .gap { margin-block: 12px; }
    .add { width: 100%; }
  `,
})
export class WeightPage {
  private readonly state = inject(KalState);
  protected readonly quickAdd = inject(QuickAddService);
  protected readonly fmt = fmt;
  protected readonly signedKg = signedKg;
  protected readonly shortDate = shortDate;
  protected readonly dayLetter = dayLetter;
  protected readonly W = CHART_W;
  protected readonly H = CHART_H;
  protected readonly today = this.state.today;
  protected readonly reality = computed(() => realityLine(this.state.reality()));

  protected readonly view = computed(() => {
    const profile = this.state.profile();
    const goal = this.state.goal();
    if (!profile || !goal) return null;
    return weightView({
      today: this.state.today(),
      goal,
      weighIns: this.state.weighIns(),
      energy: this.state.recentEnergy(),
      lowDayThresholdKcal: profile.settings.lowDayThresholdKcal,
    });
  });

  /** The chart's content as a sentence, for screen readers. */
  protected readonly chartLabel = computed(() => {
    const points = this.view()?.chart.points ?? [];
    return 'ממוצע משקל לשבוע: ' + points.map((p) => `${p.label} ${fmt(p.kg, 1)}`).join(', ');
  });

  protected readonly progressLabel = computed(() => {
    const v = this.view();
    return v ? `${fmt(v.progress * 100)}% מהדרך ליעד` : '';
  });

  protected gapDays(from: string, to: string): number {
    return dateRange(from, to).length;
  }
}
```

Check `KalState.today` is a signal (`this.state.today()` is used elsewhere); if it is a `computed`, `protected readonly today = this.state.today;` works as is.

- [ ] **Step 2: Delete `weightChart`** from `app/src/app/shared/charts.ts` (the function at lines 91–122). Remove any import that becomes unused.

- [ ] **Step 3: Verify**

Run: `cd app && npx ng test --watch=false` → all pass. `cd app && npx ng build` → builds. `npm test && npm run typecheck` → pass.

- [ ] **Step 4: Look at it** — `cd app && npx ng serve`, open http://localhost:4310/ (weight tab) at 375px wide, light and dark: hero, bar, alert, chart, list, no horizontal scroll.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/features/weight/weight.ts app/src/app/shared/charts.ts
git commit -m "feat(app): weight screen by week with an inline SVG chart"
```

---

## Self-review

- Spec §16 coverage: weekly rule (T1), summaries/week/month/skill (T2), hero + fallbacks + first week (T3 view, T4 template), progress bar with "עלו" (T3/T4), reality line full width and no trend number (T4), weekly chart ≤ 12 weeks, breaks, labels, current emphasized, axis fits (T3/T4), this-week list (T3/T4), gap card and add button unchanged (T4), `weightChart` removed (T4). MASTER.md was updated with the spec.
- Types: `WeekWeight`, `weightChangeKg`, `WeightView`, `WeeklyChart`, `ChartPoint`, `signedKg` are used with the same names in every task.
