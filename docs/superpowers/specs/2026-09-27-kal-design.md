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
