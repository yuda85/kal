---
name: kal
description: Log food, meal-prep recipes, weigh-ins, steps and workouts to the kal calorie tracker, and answer questions about calories and macros eaten, what is left today, and weekly progress. Use whenever the user says what they ate or drank, mentions a recipe or meal prep, gives a weight, steps or a workout, or asks how much is left or how the week looks. Also use when the user shares a reel, short or video about weight loss with their takeaway, to save it to the app's tips tab.
---

# kal — conversational calorie logging

You never write to the database. Read with `read.ts`, then build a link with `link.ts`. The user taps the link and confirms in the app.

Reply in the user's language (usually Hebrew). Keep replies short.

## Commands

```bash
node .claude/skills/kal/scripts/read.ts profile        # goal, trend, BMR, typical-day target and macros, weight reality, ETA, report gap
node .claude/skills/kal/scripts/read.ts day [date]     # intake, out breakdown, target, remaining, macros, warnings
node .claude/skills/kal/scripts/read.ts week [date]    # the Sun–Sat week containing date: averages (avgSteps: finished days with entered steps), missing days, stepsEntered / weighedIn per day
node .claude/skills/kal/scripts/read.ts month [YYYY-MM] # workouts, penalized days, logged vs weight deficit
node .claude/skills/kal/scripts/read.ts recipes        # saved recipes with per-unit / per-100 g values
```

Build links by passing the JSON on stdin through a **quoted heredoc** — never as a single-quoted argument, because Hebrew names often contain an ASCII apostrophe (קוטג', צ'יפס, ג'חנון) that would break the shell quoting:

```bash
node .claude/skills/kal/scripts/link.ts --open <<'EOF'
{"ops":[{"op":"add","name":"צ'יפס","kcal":300}]}
EOF
```

`link.ts` prints two lines: the confirm link, then a JSON summary `{"items":[{name,kcal,protein,carbs,fat,date,time}],"totalKcal":N}` with the final numbers (including ones it computed from recipes). Use the summary for your reply so it always matches the link.

Dates are `YYYY-MM-DD` in Asia/Jerusalem. In a desktop session use `--open`. In a cloud or mobile session leave out `--open` and give the link.

## Logging food

1. Run `read.ts recipes` (once per conversation) and `read.ts day`.
2. For each item the user mentions:
   - **Matches a saved recipe name or alias** → `{"op":"add","name":"3 קציצות דגים","recipeId":"fish-balls","qty":3}`. Leave out kcal and macros; `link.ts` computes them. `qty` is units when the recipe has units, grams when it only has a cooked weight. If two recipes match, ask which one.
   - **Anything else** → estimate `kcal`, `protein`, `carbs`, `fat` for the portion eaten. Use Israeli Ministry of Health food composition values (or the package label) as the reference. Cooked vs raw matters; count cooking oil. Ask for the amount only when an estimate would be a guess (for example "a plate of pasta"). Otherwise state the assumption ("assumed 200 g cooked").
   - When the user gives only calories ("500 calories"), send just `kcal`.
   - Date and time default to now. For "yesterday" or "this morning", set `"date"` and `"time"` explicitly.
3. If the `day` output plus the new items would pass a constraint `max` (for example protein), say so in the reply.
4. Build **one link** for everything in the message with the heredoc form above.
5. Reply with the link, one line per item from the summary line (`name — kcal · P/C/F g`), and "remaining today after this: X kcal" (`remainingKcal` from `read.ts day` minus the summary's `totalKcal`).

## Recipes (meal prep)

Collect ingredients with raw grams and the yield: number of units (with a unit name such as "קציצה") or the total cooked weight. `id` is a short English slug. The same `id` again replaces the recipe (a new batch): start from the saved `ingredients` in `read.ts recipes` and change only what the user changed. A recipe op and an add op that uses it can go in the same link.

```json
{"op":"recipe","id":"fish-balls","name":"קציצות דגים","aliases":["קציצות","קציצות דג"],
 "ingredients":[{"name":"פילה אמנון","grams":500,"per100":{"kcal":96,"protein":20,"carbs":0,"fat":1.7}}],
 "yield":{"units":20,"unitName":"קציצה"}}
```

## Weight and activity

```json
{"op":"weight","kg":88.4}
{"op":"activity","id":"checkin","steps":9200,"workouts":[{"type":"Push","kcal":350}]}
```

- Every `activity` op uses `"id":"checkin"`, with `"date"` for a past day. `steps` replaces the day's steps; `workouts` replaces the day's check-in workouts, so send the day's full list (run `read.ts day <date>` first and keep the manual workouts already there); `[]` removes them; an op without `workouts` keeps them. An op with `steps` closes the day (the app stops its 22:00 prompt); a workout logged during the day without steps does not. `kcal`: Garmin's "Active calories" when the owner has them (no `durationMin`); otherwise the workout's total calories plus `durationMin`, and the resting share (already in BMR) is subtracted. For a walk or run also send the workout's `steps` from Garmin, so they are not counted again in the day's steps. Types: Upper, Lower, Push, Pull, Legs, Full body, Cardio, אחר.
- A day burns BMR × 1.2 (digestion and daily movement, including 3,500 steps); steps above 3,500 and workouts add to it, fewer steps take away. A day without steps counts as 3,500. The owner's steps goal is 10,000 (`STEPS_GOAL`); the week screen colours each day under 4,500 / under 10,000 / goal / over 13,000. That grades steps only, never weight progress. A finished day with less than 800 kcal of food counts as 3,200 (the owner's penalty rule); logging real food removes it.
- A day without a weigh-in carries the previous weight into the trend (computed, never stored); a `weight` op for that date replaces it. `weighedIn` tells whether a day has a real weigh-in.
- Macro targets follow the day's calorie target: protein 1.8 g per kg of trend, fat 30% of the calories, carbs the rest; the owner's constraints win.

## Videos (tips tab)

The owner sends a link to a reel or short and what they took from it. Save it with a `video` op; do not open or summarize the video.

```json
{"op":"video","url":"https://www.instagram.com/reel/…","title":"למה רעבים בערב","take":"לסגור מטבח ב-21:00","topic":"hunger"}
```

- `title`: a short Hebrew title you write from what the owner said (up to 80 characters). `take`: the owner's takeaway in their words, lightly cleaned up (up to 280). `url`: the https link as sent, without tracking parameters when they are obvious (`?igsh=…`, `?si=…`).
- `topic`, one of: `tracking` מעקב ורישום, `protein` חלבון, `hunger` רעב ושובע, `water` מים, `fiber` סיבים וירקות, `fat` שומן ושמנים, `carbs` פחמימות, `sleep` שינה ולחץ, `social` אירועים ובחוץ, `movement` תנועה, `mindset` ראש.
- No take given → ask for one line: the take is the point of the list.

## Questions (no link)

Answer from `read.ts` output. Round kcal and grams to whole numbers.

- "כמה נשאר היום?" → `day` → `remainingKcal`, and protein, carbs and fat vs their targets (`macros.*.target`).
- "איך השבוע?" → `profile` and `week` → lead with `profile.reality`; then `avgDeficitKcal` next to `weightDeficitKcal`, `weightChangeKg` (mean of this week's weigh-ins vs last week's) vs `plannedChangeKg`, `workoutsCount`, `imputedDays`.
- "איך החודש?" → `profile` and `month` → lead with `profile.reality`; then `workoutsCount`, `workoutsPerWeek`, `imputedDays`, `avgDeficitKcal` next to `weightDeficitKcal`.
- "מתי אגיע ליעד?" → `profile` → `eta` and `reality.status`; mention `reportGap.alert` if true.

## Progress answers: the scale is the judge

Never say or imply "on track" because of steps, workouts or a logged deficit. Lead every progress answer with `profile.reality`:
- `no_data` → say there are not enough weigh-ins to know, and ask for a weigh-in.
- `gaining` / `stalled` → say so plainly, with `trendChangeKg` vs `plannedChangeKg`.
- `on_track` → only then say on track.
Always put the logged deficit next to the weight deficit (`reality.loggedDeficitKcal` / `reality.weightDeficitKcal` from `profile`; `avgDeficitKcal` / `weightDeficitKcal` from `week` and `month`), and mention penalized days (`imputedDays`) in weekly and monthly answers.

In weekly answers, also list the finished days the app marks for missing data and ask for them: red = no food (`imputed`), orange = no steps (`stepsEntered: false`) or no weigh-in (`weighedIn: false`). Carried weights and default steps are placeholders, not data.

## Limits (`link.ts` rejects values outside these)

Entry kcal 0–5000 · macros 0–500 g · weight 30–300 kg · steps 0–100000 · workout 0–3000 kcal (duration optional, 1–600 min) · per-100 g kcal 0–900 and macros 0–100 g.

## Errors

- `link error: …` → fix the JSON and try once more.
- `config.json needs projectId and uid` → ask the user to copy them from the app's Settings screen into `.claude/skills/kal/config.json`.
- A fetch error in a cloud session → the environment's network settings may need `firestore.googleapis.com` allowed.
