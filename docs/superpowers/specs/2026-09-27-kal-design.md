# kal — Design Spec

- **Date:** 2026-09-27
- **Status:** Draft — awaiting owner review
- **Repo:** `github.com/yuda85/kal` (public) · local `~/dev/dedv/kal`
- **App URL:** `https://yuda85.github.io/kal/`
- **Firebase project:** `trainerio-cf81a` (created for kal)

## 1. Goal and principles

A personal calorie and macro tracker whose **primary input is conversation with Claude**. The owner describes what he ate in free text ("3 fish balls from the meal prep"), Claude computes calories and macros, and the result lands in a simple dashboard showing calories in vs out, weekly averages, and progress toward a weight goal.

Principles:

1. **Conversation first.** Logging by talking to Claude is the core feature. Everything else supports it.
2. **Simple over clever.** No feature, abstraction, or model that the owner did not ask for. When in doubt, pick the simpler option.
3. **The system owns the math.** Garmin is a sensor (steps, workouts), not the source of truth for energy expenditure.
4. **No secrets on the Claude side.** Claude reads public data and writes only through links the owner confirms.
5. **Hebrew, RTL, mobile-first PWA.**

Single user (the owner). Data is stored per user id, so more users would work, but multi-user is not a goal.

## 2. Scope

**In scope (v1)**

- Food logging via Claude (link + confirm) and via a quick-add form in the app
- Meal-prep recipes (ingredients → totals → per unit / per 100 g)
- Full macros (kcal, protein, carbs, fat); macros optional per entry
- Energy expenditure model: BMR + steps + workouts
- Automatic Garmin sync (steps, workouts) with manual fallback
- Weigh-ins (manual), weight trend, goal plan line, ETA
- Weekly report: averages, in vs out, missing days, report-gap check
- First-run wizard: profile, activity fallback, goal, macro constraints
- Macro constraints (e.g. protein max 120 g) with warnings
- Claude skill with read and link scripts

**Out of scope (v1)**

- Adaptive TDEE / calibration of the expenditure model
- Editing or deleting entries through links (done in the app)
- Smart-scale sync, body fat per weigh-in
- Thermic effect of food and non-step NEAT (deliberately omitted, see §6)
- Barcode scanning, food database UI, social features, notifications

## 3. Architecture

```
Claude Code session on the repo
  └─ skill kal ─ read.ts ──(REST, no auth)──────────────┐
             └─ link.ts → https://yuda85.github.io/kal/#p=…   │
                                  │                      ▼
Owner taps link → Angular PWA (Firebase Auth) ──write──→ Firestore
                                  ▲                      ▲
                           reads (live)                  │
GitHub Action (cron 3h) ─ garmin_sync.py ─(Admin SDK)────┘
Push to main ─ GitHub Action ─ build + test ─→ GitHub Pages
```

| Component | Tech | Responsibility |
|---|---|---|
| App | Angular 21 (standalone, signals, zoneless), `@angular/pwa`, Firebase JS SDK, Chart.js, `@lucide/angular` icons | Wizard, dashboard, confirm screen, quick-add, recipes, settings |
| Domain | Framework-free TypeScript, zero dependencies | All calculations; shared by app and skill scripts |
| Store | Firestore (Spark / free tier) | All user data |
| Auth | Firebase Auth, Google sign-in (popup, `prompt=select_account`; a hint after 20 s if the popup hangs, the iOS home-screen risk) | App writes only |
| Garmin sync | Python 3.12, `garminconnect`, `firebase-admin`, GitHub Actions | Pull steps and workouts every 3 h |
| Skill | `.claude/skills/kal/` — `SKILL.md`, `read.ts`, `link.ts` | Conversation → link; answer questions from data |
| Hosting | GitHub Pages via Actions | Static app |

### Repo layout

```
kal/
├── app/                        Angular 21 PWA
│   └── src/app/
│       ├── core/               firebase init, auth, Firestore data services
│       ├── features/
│       │   ├── wizard/         first-run setup
│       │   ├── today/          main screen + quick-add sheet
│       │   ├── week/           weekly report
│       │   ├── weight/         trend vs plan, weigh-ins
│       │   ├── confirm/        link handler (#p=…)
│       │   ├── recipes/        list + detail
│       │   └── settings/       profile, goal, constraints, CLI info
│       └── shared/
├── domain/                     pure TS: bmr, expenditure, targets, trend, plan, checks, link codec
├── sync/                       garmin_sync.py, bootstrap_tokens.py, tests/
├── .claude/
│   ├── skills/kal/             SKILL.md, read.ts, link.ts, config.json
│   └── settings.json           permission allowlist for the scripts
├── .github/workflows/
│   ├── deploy.yml              push to main → test → build → Pages
│   └── garmin-sync.yml         cron every 3 h + workflow_dispatch
├── design-system/kal/MASTER.md UI source of truth
├── firestore.rules
├── firebase.json               rules + emulator config
├── docs/
└── CLAUDE.md
```

**Domain sharing.** `domain/` is imported by the Angular app (tsconfig path alias) and by the skill scripts, which run with Node's native TypeScript support. Domain code must use only erasable TypeScript (no enums, namespaces, or parameter properties). If importing `.ts` extensions breaks the Angular build, fall back to a small `tsc` build of `domain/` to JS. If cloud sessions run a Node version without native TS, the scripts run via `npx tsx`. Both fallbacks are decided during implementation.

**Hosting.** Built with `--base-href /kal/`; `index.html` is copied to `404.html` so deep routes work on Pages. The URL fragment is reserved for link payloads, so the router uses path location.

**Firebase config** (including `apiKey`) is committed; it is not a secret. Security comes from the rules.

## 4. Data model

All data lives under `users/{uid}`. Dates are `YYYY-MM-DD` in `Asia/Jerusalem`. Units: kg, cm, kcal, grams.

```
users/{uid}                              profile
  sex: 'male' | 'female'
  birthDate, heightCm
  bodyFatPct?: number                    optional; enables Katch-McArdle
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'high'   fallback only
  constraints: { kcal?, protein?, carbs?, fat? }  each { min?, max? }
  settings: { lowDayThresholdKcal: 800 }
  computed: { bmrKcal, macroTargets: { protein, carbs?, fat? }, updatedAt }
  activeGoalId, garminLastSyncAt?

users/{uid}/goals/{goalId}
  startDate, startWeightKg, targetWeightKg
  preset: 'relaxed' | 'aggressive' | 'custom'
  paceKgPerWeek, dailyDeficitKcal, active: boolean

users/{uid}/entries/{id}                 one food item
  date, time ('HH:mm'), name
  kcal, protein?, carbs?, fat?           null = unknown
  recipeId?, qty?                        reference only; numbers are a snapshot
  source: 'link' | 'form'

users/{uid}/days/{date}                  expenditure inputs
  garmin?: { steps, workouts: [{ type, durationMin, kcal, steps? }],
             totalKcal, activeKcal, restingKcal, syncedAt }     raw, display only except steps/workouts
  manual?: { steps?: number,
             workouts?: [{ type, durationMin, kcal }] }

users/{uid}/weights/{date}               one weigh-in per day, last write wins
  kg, time

users/{uid}/recipes/{slug}
  name, aliases: string[]
  ingredients: [{ name, grams, per100: { kcal, protein, carbs, fat } }]
  yield: { units?: number, unitName?: string, cookedGrams?: number }
  totals, perUnit?, per100g?             computed by domain on save
  updatedAt
```

Decisions:

- **Entries store a snapshot** of numbers, so editing a recipe for a new batch never rewrites history.
- **`days` and `weights` are keyed by date**, so Garmin and manual input merge into one document without conflicts.
- **Computed profile values are persisted** (`computed.*`, goal `dailyDeficitKcal`) so they are visible in Firestore; the skill still computes through `domain/`.

### Security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isOwner(uid) {
      return request.auth != null
        && request.auth.uid == uid
        && exists(/databases/$(db)/documents/owners/$(uid));
    }

    match /users/{uid}/{doc=**} {
      allow read: if true;
      allow write: if isOwner(uid);
    }

    match /owners/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }
  }
}
```

- Only uids registered in `owners/{uid}` (created by hand in the Firebase console) can write, so a stranger signing in with Google cannot store data in the project.
- The app keeps entries from the last 90 days in memory (older weeks are not browsable in the app; Claude's `read.ts` reads any range).
- Public read is intentional (owner accepted it; lets Claude read without credentials). Side effect: anyone can list user ids.
- The Garmin Action uses the Admin SDK (bypasses rules) with a service account limited to `Cloud Datastore User`.

## 5. Link protocol

### Format

```
https://yuda85.github.io/kal/#p=<base64url(UTF-8 JSON)>

{ "v": 1, "ops": [ Op, … ] }
```

| Op | Fields |
|---|---|
| `add` | `id`, `date`, `time`, `name`, `kcal`, `protein?`, `carbs?`, `fat?`, `recipeId?`, `qty?` |
| `recipe` | `id` (slug), `name`, `aliases`, `ingredients`, `yield` |
| `weight` | `date`, `kg` |
| `activity` | `id`, `date`, `steps?`, `workouts?` |

Validation ranges (reject the whole link if any value is outside):

| Field | Range |
|---|---|
| `kcal` (entry) | 0–5000 |
| macros (entry) | 0–500 g |
| `kg` | 30–300 |
| `steps` | 0–100000 |
| workout `durationMin` / `kcal` | 1–600 / 0–3000 |
| `ingredients[].grams` | 0–10000 |

### Rules

- `link.ts` always writes `date` (and `time` for `add`), so a link tapped the next day still lands on the right day.
- **Idempotent:** `add.id` is the Firestore document id. Re-opening or refreshing the link overwrites the same document. The confirm screen shows "already saved" when the id exists.
- **Recipes are recomputed** by `domain/` on save. Claude sends ingredients and yield only.
- Unknown `v`, bad JSON, or out-of-range values → "invalid link" screen, nothing saved.
- The fragment never reaches a server.

### Confirm screen

- Lists every op in readable Hebrew.
- Shows the day after saving: kcal vs target, macro bullets.
- Warns on constraint breaches (e.g. "protein 131 g, above the 120 g cap").
- Quantity and kcal are editable inline before saving. Changing `qty` on an entry with `recipeId` recomputes from the recipe's `perUnit` (from Firestore, or from a `recipe` op in the same link); without a recipe it scales the entry's numbers proportionally.
- The app removes the `#p=` fragment with `history.replaceState` as soon as it starts (also when a link opens into an already-open tab); the payload stays in memory until Save or Cancel.
- Save → toast "נשמר" → navigate to Today. Manual workouts carry the activity `id` as `linkId`, so re-opening a link never duplicates them.
- Not signed in → sign in first, fragment preserved, return to confirm.

**Security:** anyone can craft a link, but nothing is written without the owner's tap on Save, and the screen shows exactly what will be written. All payload text renders as text, never HTML.

## 6. Calculation engine (`domain/`)

```
age        = full years from birthDate
trend      = EWMA(α = 0.1) over daily weigh-ins, skipping gaps
             (the wizard's current weight is saved as today's weigh-in, so trend always exists)

bmr        = bodyFatPct set
               ? 370 + 21.6 × trend × (1 − bodyFatPct/100)            Katch-McArdle
               : 10·trend + 6.25·heightCm − 5·age + (male ? 5 : −161)  Mifflin-St Jeor

steps      = manual.steps ?? garmin.steps ?? 0
workouts   = (garmin.workouts ?? []) + (manual.workouts ?? [])
stepsKcal  = max(0, steps − Σ workouts.steps) × 0.5 × trend × (0.415 × heightCm / 100) / 1000
workoutNet = max(0, w.kcal − bmr / 1440 × w.durationMin)          per workout
out        = bmr + stepsKcal + Σ workoutNet
```

- **Today:** `bmr` counts the full day; steps and workouts count what has synced so far. Food budget grows as the owner moves.
- **No Garmin data and no manual input for a day:** `out = bmr × activityFactor` (sedentary 1.2, light 1.375, moderate 1.55, high 1.725). This is the only use of `activityLevel`.
- **Deliberately conservative:** thermic effect of food and non-step movement are not counted. The model underestimates by roughly 150–300 kcal/day, which favors weight loss.

### Goal and targets

```
paceKgPerWeek    = preset relaxed 0.5% · aggressive 1.0% of startWeightKg per week, or custom
dailyDeficitKcal = paceKgPerWeek × 7700 / 7
target(day)      = out(day) − dailyDeficitKcal          warn if target < bmr
protein target   = min(1.8 × trend, constraints.protein.max ?? ∞)
carbs, fat       = no target; constraints only if set
```

### Weekly report

- Average in, average out, average net deficit vs target deficit
- Average protein
- Days logged out of 7
- Trend change for the week vs planned change

### Plan, ETA, checks

```
plan(d)   = startWeightKg − paceKgPerWeek × weeksSince(startDate, d)
status    = |trend − plan| ≤ 0.5 kg ? on track : (trend < plan ? ahead : behind)
ETA       = date where a linear fit of the last 28 days of trend reaches targetWeightKg
            (none if fewer than 14 weigh-ins or slope ≥ 0)

missing   = past day with no entries, or logged kcal < lowDayThresholdKcal (800)

gap       = from goal week 3 only, window = last 14 days:
            expectedΔ = Σ(in − out) / 7700
            actualΔ   = trend(end) − trend(start)
            gapKcalPerDay = (actualΔ − expectedΔ) × 7700 / 14
            alert when gapKcalPerDay > 300: "gap of ~X kcal/day between logs and weight"
```

The gap alert says "gap", not "you under-reported": it can be missed meals or model error.

## 7. Garmin sync

- `sync/garmin_sync.py`, Python 3.12, `garminconnect` + `firebase-admin`.
- Each run pulls **the last 3 days** (covers late watch syncs):
  - Daily stats: steps, total / active / resting kcal (raw, display only)
  - Activities: type, duration, calories, steps
- Writes `users/{uid}/days/{date}.garmin` with merge. **Never touches `manual`.** Updates `users/{uid}.garminLastSyncAt`.
- Auth: `sync/bootstrap_tokens.py` runs once locally (supports MFA) and prints a token string. The owner stores it as the `GARMIN_TOKENS` secret; it lasts about a year.
- Secrets: `GARMIN_TOKENS`, `FIREBASE_SA` (service account JSON, role `Cloud Datastore User`), `KAL_UID`.
- Workflow `garmin-sync.yml`: `cron: '0 */3 * * *'` + `workflow_dispatch`, timeout 5 min.
- Logging at `WARNING`; tokens and keys are never printed.
- Failure visibility: GitHub emails on failed runs; the app shows "last Garmin sync X ago" and, after 6 h, suggests manual steps/workout entry.

## 8. Claude skill

`.claude/skills/kal/`, loaded automatically in any Claude Code session on this repo (local or cloud). Installing on a new machine = `git clone`.

### `SKILL.md` flow

1. **Log food:** run `read.ts profile`, `read.ts recipes`, `read.ts day` → match recipes by `aliases` (ask if ambiguous) → otherwise estimate per-100 g values (prefer Israeli Ministry of Health food data as reference) → ask for grams only when the estimate would be a wild guess → state assumptions → build ops → `link.ts` → reply with the link, a one-line summary, and "remaining today after this".
2. **Create or update a recipe:** collect ingredients with grams and the yield (units or cooked weight) → `recipe` op (can be combined with an `add` op in the same link).
3. **Weigh-in or manual activity:** `weight` / `activity` ops.
4. **Questions** ("how much is left today?", "protein this week?", "weekly summary"): answer from `read.ts day|week`. No link.
5. Before producing a link, check constraints and warn in chat (e.g. protein cap).

### Scripts

| Script | Usage | Output |
|---|---|---|
| `read.ts` | `profile` · `day [date]` · `week [date]` · `recipes` | Flat JSON computed through `domain/` (entries, totals, out breakdown, target, remaining, macro progress, averages) |
| `link.ts` | JSON ops on stdin; `--open` | Validates, fills `date`/`time`/`id`, prints the URL; `--open` opens it in the browser (desktop) |

`config.json`: `{ "baseUrl": "https://yuda85.github.io/kal/", "projectId": "<firebase-project-id>", "uid": "<uid>" }` — not secrets.

`read.ts` uses the Firestore REST API without credentials (`runQuery` for date ranges).

### Permissions

`.claude/settings.json` allowlists the two scripts and `open https://yuda85.github.io/kal/*`, so logging needs no permission prompts. Cloud sessions may need `firestore.googleapis.com` allowed in the environment's network settings.

## 9. UI

Details and tokens: `design-system/kal/MASTER.md`.

- **Navigation:** bottom tabs — היום · שבוע · משקל · מתכונים. Settings via the gear in the header.
- **Today:** one hero number ("נשאר לאכול"), formula line (target = out − deficit), bullet bars for kcal / protein / carbs / fat with constraint markers, expenditure breakdown line, entry list (tap an entry → edit / delete; delete asks for confirmation), FAB `+`.
- **Quick-add sheet:** tabs ארוחה · משקל · פעילות. Meal = kcal (required) + name (optional) + collapsed "+ מאקרו".
- **Confirm:** see §5.
- **Week:** KPI cards (average deficit vs target, trend change vs plan, average in, average protein), grouped in/out bars per day, missing days marked with dashed outline and a text alert.
- **Weight:** trend number + status chip (on track / ahead / behind + ETA), line chart (trend solid, plan dashed, target dotted, weigh-ins as dots), report-gap card, "add weigh-in" button.
- **Recipes:** list with per-unit values; detail shows ingredients. Creation happens through Claude.
- **Wizard:** steps profile (sex, birth date, height, current weight, optional body fat %) → activity (fallback) → goal (target, pace preset) → constraints (skippable) → summary (BMR, deficit, target kcal, ETA). Step indicator, Back, and Skip on optional steps. Finishing creates the profile, the first goal, and today's weigh-in.
- **Settings:** edit profile/goal/constraints; shows `uid` and `projectId` for the skill `config.json`; Garmin last-sync status.

## 10. Error handling

- Firestore offline persistence (`persistentLocalCache`): writes made offline sync later.
- Invalid link → dedicated error screen, nothing saved.
- Garmin stale > 6 h → banner with manual-entry shortcut.
- Auth: Google popup. If popups misbehave in the iOS home-screen PWA, add email/password sign-in.
- Writes from the confirm screen and quick-add are not awaited (offline-safe); a failed write shows a "השמירה נכשלה" toast. The first-run wizard awaits its save and, on `permission-denied`, shows the uid and the `owners/{uid}` fix.

## 11. Testing

| Area | Tool | Notes |
|---|---|---|
| `domain/` | Vitest | Highest priority: every formula, edge cases (no weigh-ins, no Garmin, workouts with steps, constraints, gap window) |
| Link codec | Vitest + `node --test` | Hebrew UTF-8 round-trip; validation ranges; idempotent ids |
| Firestore rules | `@firebase/rules-unit-testing` + emulator | Public read; write only by owner; unauthenticated write denied |
| Garmin sync | pytest | Recorded Garmin JSON fixtures; merge never overwrites `manual` |
| App | Vitest component tests | Confirm screen, quick-add validation |
| CI | `deploy.yml` | Tests + build must pass before Pages deploy |

## 12. Owner setup (manual, once)

Claude does not create cloud resources or sign in on the owner's behalf. Step-by-step guide: `docs/setup.md`.

1. Pushing uses the `JudahAero` gh account (owner approved).
2. Firebase project `trainerio-cf81a` with a web app; its config is in `app/src/app/core/firebase-config.ts`.
3. Enable Authentication → Google; add `yuda85.github.io` to authorized domains.
4. Create Firestore (nearest region); paste `firestore.rules` into the console; after the first sign-in create `owners/{uid}`.
5. Create a service account with role `Cloud Datastore User` → JSON key → GitHub secret `FIREBASE_SA`.
6. Run `bootstrap_tokens.py` locally → GitHub secret `GARMIN_TOKENS`.
7. Sign in to the app once → copy `uid` from Settings → GitHub secret `KAL_UID` and skill `config.json`.
8. GitHub Pages source = GitHub Actions.

## 13. Risks

| Risk | Mitigation |
|---|---|
| `garminconnect` is unofficial and may break | Manual steps/workouts; stale-sync banner |
| Google popup sign-in in iOS standalone PWA | Test early; email/password fallback |
| Node version in cloud sessions lacks native TS | `npx tsx` fallback |
| Cloud session network blocks Firestore or Pages | Allow domains in environment settings |
| Claude's nutrition estimates are wrong | Confirm screen shows and allows editing numbers; Claude states assumptions |
| Public read exposes all data | Accepted by owner |

## 14. Daily check-in, missing-day penalty, weight reality check (added 2026-09-28)

Garmin sync (§7) is postponed. Until it exists, the owner closes each day by hand. This section overrides §6 and §9 where they conflict.

### Principle: the scale is the judge

Calories from steps, workouts and deficit are an estimate; the weight trend is the truth. The app must never suggest the owner is on track because of logged steps or workouts when the weight does not confirm it:

- Every "on track" status is derived from the weight trend only. With too few weigh-ins the status is "not enough weigh-ins", never green.
- Wherever a logged deficit is shown, the deficit implied by the weight trend is shown next to it.
- "Remaining to eat" is a neutral number, not a success color.
- No automatic budget correction (calibration stays out of scope, §2); the app shows the truth and the owner decides.

### Expenditure model (replaces the activity-level fallback)

```
steps      = manual.steps ?? garmin.steps ?? settings.defaultSteps (3500)
out        = bmr × settings.baseFactor (1.2) + stepsKcal(steps − defaultSteps) + Σ workout calories
workout    = max(0, kcal − bmr/1440 × durationMin)   manual and Garmin alike; without durationMin, kcal as entered
```

Changed 2026-09-28 after the owner's review. BMR plus steps left out digestion and daily movement (about 15–20% of a day's burn) and put a rest-day target about 500 kcal below what the owner's history shows. BMR × 1.2 is the usual desk-day estimate and already includes the default 3,500 steps, so only steps above (or below) it change the day. A workout's total calories include its resting share, which BMR already counts: the owner enters Garmin's "active calories" without a duration, or the total with the duration. `baseFactor` is stored in settings so the owner can move it after 3–4 weeks of comparing the logged deficit with the weight deficit; there is no automatic correction.

- `activityLevel` is no longer asked for or used (kept optional in stored profiles).
- Manual workouts: `{ type, kcal, durationMin? }`, `type` from Upper, Lower, Push, Pull, Legs, Full body, Cardio, אחר. The check-in sheet asks for calories and an optional duration.
- The "target below BMR" warning fires when a typical day's target (`bmr × baseFactor − deficit`) is below 75% of BMR.

### Missing-day penalty

- A day that has ended (date < today), on or after the goal start, with logged food below `lowDayThresholdKcal` (800) counts as `settings.missingDayKcal` (3200) calories in, and is marked "not logged, counted as 3,200".
- The penalty is computed, never written. Logging real food for that day removes it.
- It applies to every calculation: week and month averages, the reality check and the report-gap check.

### Daily check-in

- Opening the app from 22:00 (Asia/Jerusalem) shows a "close the day" sheet until that day is checked in. "Not now" closes it until the next app open. A button on Today opens it any time.
- Fields: steps; workout (none or a type), its calories and an optional duration (a walk or run is logged as steps, not as a workout); optional weigh-in; a food status line ("X kcal logged" or "nothing logged, the day will count as 3,200").
- Saving writes `days/{date}.manual.steps`, the check-in workout (tagged `linkId: "checkin"`, so saving again replaces it) and `checkedInAt`. It can be edited any time.
- Claude can do the same through an `activity` link op.
- The quick-add sheet no longer has an activity tab; steps and workouts go through the check-in, or through Claude with `id: "checkin"` for a past day. An `activity` op without `workouts` keeps the day's workouts; `workouts: []` removes them.

### UI

- Today: a weigh-in chip at the top ("+ weigh-in today" when missing); a reality line under the budget; a waterfall "how today's target is built" (BMR, daily life and digestion, steps against the 3,500 base with a mark when defaulted, each workout, minus deficit, equals target); a "close the day" button.
- Week tab gets a Week | Month switch.
  - Week: workouts count and the type per day, penalized days marked, logged deficit next to the weight deficit, the report-gap alert.
  - Month: a calendar grid, each day showing its workout type, a background for deficit / surplus / not logged, and totals (workouts, workouts per week, days not logged, logged vs weight deficit).
- The wizard loses the activity step.

### Reality check (domain)

- Window: the last 14 days.
- Status by weight trend only: `no_data` if fewer than 4 weigh-ins in the window, or while the trend has no point before the window (a new goal's first two weeks); `gaining` if the trend rose more than 0.1 kg; `stalled` if it fell less than half the planned amount (the goal pace over the 14 days while the trend is above target); otherwise `on_track`.
- Logged deficit per day = mean(out − counted intake); weight deficit per day = −(trend change) × 7700 / days.
- The logged deficit uses only days on or after the goal start.
- The alert "the log shows a deficit the scale does not confirm" uses the existing report-gap rule (gap > 300 kcal/day, from goal day 21).

## 15. Today clarity, planned macros, honest check-in, carried weights, missing-data marks (added 2026-09-29)

Owner requests of 2026-09-29. This section overrides §4, §6, §9 and §14 where they conflict.

### Today

- The hero shows the remaining number with "מתוך <target>" next to it. The formula line under the hero is gone: the target card shows it.
- Every macro bar shows value / target.
- The target card ("איך נבנה היעד היום") replaces the waterfall. First an equation, read right to left: שורף היום − גירעון (with the goal pace under it) = יעד לאכילה, with a fourth term when the kcal constraint moved the target. Then "ממה מורכבת השריפה": resting (BMR), daily life and digestion (including the default 3,500 steps), steps above or below the default with the count (or "לא הוזנו"), and each workout. The numbers are rounded so they add up on screen.

### Planned macros

```
protein = 1.8 × trend                              constraints win (unchanged)
fat     = 30% of the day's calorie target / 9      constraints win
carbs   = (target − protein × 4 − fat × 9) / 4, ≥ 0, constraints win
```

- Computed per day from that day's target, so a day with more steps or a workout plans more fat and carbs.
- The wizard summary shows the plan for a typical day (default steps, no workout, inside the kcal constraint) and saves it in `computed.macroTargets` (`carbs` and `fat` are numbers now).

### Carried weights

- A day without a weigh-in carries the previous weight. The trend is an EWMA over one weight per day from the first weigh-in (§6's "skipping gaps" no longer holds). Carried weights are computed, never written; a real weigh-in for that day replaces the carried one.
- Data sufficiency counts real weigh-ins only: the reality check (4 in 14 days), the ETA (14 in 28 days) and a week's trend change (two inside the week when none came before it). The scale stays the judge.
- The check-in weight field shows the carried weight as its placeholder.

### Check-in

- Opens with "תהיה כנה": a prompt to log what was skipped or avoided, stating that the goal is tracking, not judging.
- Next to it, the owner's photo, chosen once from the phone and kept only on that device (local storage), never in Firestore or the public repo.

### Week

- Finished days on or after the goal start are flagged: red when no food was logged (the missing-day penalty), orange when steps or a real weigh-in are missing, with the missing items named ("חסר: צעדים · משקל") so the owner can send them to Claude later.
- `read.ts week` and `month` rows carry `stepsEntered` and `weighedIn`.

## 16. Weight screen by week, one weekly change everywhere (added 2026-09-30)

Owner request of 2026-09-30. The 84-day daily chart was mostly empty, its axis stretched to the target, and its header number (trend) did not match the weigh-in shown on Today. This section overrides §9, §14 and §15 where they conflict.

### Weekly change (domain)

- Weeks run Sunday to Saturday (`weekStart`).
- A week's weight = the mean of its real weigh-ins. Carried weights never count. A week without a weigh-in has no weight.
- A range's weight change = mean of real weigh-ins in the range (up to today) − mean of real weigh-ins in the previous range of the same length. `null` when either has none. Weight deficit per day = −change × 7700 / range length in days.
- `RangeSummary.trendChangeKg` becomes `weightChangeKg` with this rule, for the week and the month (month vs the previous equal-length span). Week screen label: "שינוי במשקל (ממוצע)".
- Mid-week, this week's mean covers only the days so far; the weigh-in list shows what it is made of.
- The trend (EWMA) keeps driving everything else: the reality check, ETA, report gap, BMR and protein.

### Weight screen, top to bottom

1. Hero: this week's change ("−0.5 ק״ג השבוע", green when down, neutral otherwise), with "ממוצע השבוע X · שבוע שעבר Y" under it. No weigh-in this week: "עוד לא נשקלת השבוע" and last week's change, labeled as such. First week: this week's mean only.
2. Progress bar from `startWeightKg` to `targetWeightKg`: "התחלה X · ירדו A · נשארו B · יעד Y". Current = the mean of the latest week with a weigh-in. Above the start the bar is empty and reads "עלו A".
3. The reality line (status, ETA) as a full-width alert. The trend number no longer appears at the top.
4. Weekly chart: one point per week from the goal's start week, the last 12 at most; the line breaks over weeks without a weigh-in; the change above each point that has a previous week; the current week emphasized and labeled "השבוע". The axis fits the data (no plan or target line). A single week shows one point.
   - Zoom into a week (owner request of 2026-09-30): tapping a week (the full height of its column, keyboard reachable) switches the chart to that week's days, Sunday to Saturday, each labeled by its day letter (future days of this week stay as empty slots). One point per real weigh-in with its weight above it, today emphasized, the line breaks over a day without one, and the week's mean as a dashed line. The axis fits that week's weigh-ins. The card title becomes "השבוע" or "שבוע 20.9", with a dashed legend "ממוצע X" under it (outside the chart, so it never covers a day's weight) and a "כל השבועות" button back. The choice is not saved: the screen opens on the weekly chart.
5. "השקילות השבוע": one row per day from Sunday to today, the real weigh-in or a muted "לא נשקלת". While zoomed into an earlier week: "השקילות בשבוע 20.9" with all seven days.
6. The report-gap card and "+ הוספת שקילה", unchanged.

The chart is inline SVG in the template (no Chart.js); `weightChart` is removed.

## 17. Tips tab, saved videos, daily tip (added 2026-09-30)

Owner request of 2026-09-30: one place for bite-size know-how that makes the cut easier and keeps motivation up. Decided with the owner: vertical cards, stars pin a tip to the top, no reordering, videos added by Claude through a confirm-link with the owner's take, a daily tip in a blocking dialog on the first open of the day, no push notifications. Decided by Claude while the owner was away (review in the morning): the rest of this section.

### Content

- 50 tips written by Claude, stored in the repo (`domain/tips-data.ts`), each `{ id, topic, title, body, action? }`: a title of up to ~8 words, a body of 1–2 sentences, and an optional one-line "what to do today". New or changed tips are a code change.
- 11 topics, in this order: `tracking` מעקב ורישום · `protein` חלבון · `hunger` רעב ושובע · `water` מים · `fiber` סיבים וירקות · `fat` שומן ושמנים · `carbs` פחמימות · `sleep` שינה ולחץ · `social` אירועים ובחוץ · `movement` תנועה · `mindset` ראש.
- Tips are general, practical and conservative; no supplements, no medical claims.

### Data

```
users/{uid}/meta/tips      { starred: string[], rotation: number, lastDate?: string, lastTipId?: string, recent: string[] }
users/{uid}/videos/{id}    { url, title, take, topic, addedAt }
```

- `meta/tips` is written by the app (star, daily tip closed). A missing document means no stars, rotation 0, never shown.
- Videos are written only through a confirm-link, like everything Claude sends.
- Rules unchanged: `users/{uid}/**` is already public-read, owner-write.

### Link op `video`

`{ op: 'video', id, url, title, take, topic }` — `id` 4–32 `[a-z0-9]` (filled by `link.ts`), `url` https up to 500 characters, `title` up to 80, `take` (the owner's takeaway, in their words) up to 280, `topic` one of the 11. The confirm screen shows "סרטון: <title> · <topic>". The owner sends Claude a link and their take; Claude writes a short title, picks the topic and builds the link. Claude does not open or summarize the video.

### Daily tip

- On the first open of a day (`meta/tips.lastDate` ≠ today, after data loaded, not on the confirm screen), a dialog shows one tip and must be closed with "הבנתי". It also has a star toggle. Closing writes `lastDate = today`, `lastTipId`, and `recent` (the last 14 tip ids). Leaving the app without closing shows the same tip again next open.
- The evening check-in never opens on top of it; it waits until the tip is closed.
- Which tip: the rotation by default — `TIPS[rotation % 50]`, and closing a rotation tip advances `rotation`. A strong reason from yesterday overrides it, checked in this order on yesterday's finished day (on or after the goal start):

| Reason | Rule | Topic | Line shown |
|---|---|---|---|
| not logged | the day was penalized (`imputed`) | tracking | אתמול הרישום לא הושלם |
| calories over | counted intake > target + 300 | hunger | אתמול: 2,750 מתוך 2,341 |
| fat over | fat > 120% of its target | fat | אתמול: שומן 98g מתוך 78g |
| carbs over | carbs > 120% of its target | carbs | אתמול: פחמימות 310g מתוך 244g |
| protein low | protein < 70% of its target | protein | אתמול: חלבון 100g מתוך 166g |

- A reason tip is the first tip of that topic not in `recent` (or the topic's first tip when all are recent), and does not advance the rotation.

### Tips tab

- Fifth bottom tab "טיפים" (lightbulb icon), after מתכונים. Route `/tips`.
- A row of filter chips (scrolls sideways inside itself): הכל · שמורים · סרטונים · then the 11 topics.
- "הכל": starred tips first under "שמורים", then each topic as a section with its tips followed by its videos. Topics with nothing to show are hidden.
- Tip card: topic label, title, body, the action line (accent colour, with an arrow icon), a star button (44px, `aria-pressed`, "סמן כשמור" / "הסר משמורים").
- Video card: a play icon tile, title, platform ("Instagram", "YouTube", "TikTok" or the host) and date, the owner's take as a quote, "צפייה" opens the link in a new tab, and a delete button with a confirm dialog. Videos have no stars.
- Empty video state: "שלח לי בצ'אט קישור לסרטון והטייק שלך, ואני אוסיף אותו כאן."

## 18. Steps on the week screen (added 2026-09-30)

Owner request of 2026-09-30: see the daily steps average for a week and the steps of each day.

### Data (domain)

- `RangeSummary.avgSteps` = mean steps of the finished days (before today, on or after the goal start) whose steps were entered (`manual.steps ?? garmin.steps`). `stepsDays` = how many such days. A day without entered steps counts as the default 3,500 for calories only: it is a placeholder, not data, and never enters the average. Today is left out while its steps are still coming in. `null` / `0` when no day qualifies.
- `read.ts week` and `month` carry both fields. Steps are still entered through the check-in or through Claude with an `activity` op (`steps`, with `date` for a past day).

### Week screen

- A "צעדים" card between the in/out chart and the day rows, for the week on screen.
- Top: the average (26px/500) with "ממוצע ליום", then a dashed legend "לפי N ימים שהסתיימו" ("לפי יום אחד שהסתיים"); without a qualifying day: "—" and "עוד אין יום שהסתיים עם צעדים".
- Chart (inline SVG): seven slots Sunday to Saturday labeled by day letter; one bar per day with entered steps, from zero, with the count above; the average as a dashed line. Bars are neutral; today's bar is emphasized and labeled "עד עכשיו". A finished day on or after the goal start without steps gets a short dashed orange outline with "לא הוזן" (the same rule as the row flag "חסר: צעדים"). Today without steps, future days and days before the goal start stay empty.
