---
name: kal
description: Log food, meal-prep recipes, weigh-ins, steps and workouts to the kal calorie tracker, and answer questions about calories and macros eaten, what is left today, and weekly progress. Use whenever the user says what they ate or drank, mentions a recipe or meal prep, gives a weight, steps or a workout, or asks how much is left or how the week looks.
---

# kal — conversational calorie logging

You never write to the database. Read with `read.ts`, then build a link with `link.ts`. The user taps the link and confirms in the app.

Reply in the user's language (usually Hebrew). Keep replies short.

## Commands

```bash
node .claude/skills/kal/scripts/read.ts profile        # goal, trend, BMR, macro targets, plan status, ETA, report gap
node .claude/skills/kal/scripts/read.ts day [date]     # intake, out breakdown, target, remaining, macros, warnings
node .claude/skills/kal/scripts/read.ts week [date]    # the Sun–Sat week containing date: averages, missing days
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
{"op":"activity","steps":9200}
{"op":"activity","workouts":[{"type":"football","durationMin":60,"kcal":550}]}
```

Use `activity` only when Garmin missed something or its sync is broken. Manual steps replace Garmin steps for that day; manual workouts are added to Garmin workouts.

A workout alone switches a day from the activity-level estimate to "BMR + steps + workouts". If `read.ts day` shows `expenditure.steps` 0 (no Garmin data), ask for today's total steps and send them in the same op: `{"op":"activity","steps":8500,"workouts":[...]}`.

## Questions (no link)

Answer from `read.ts` output. Round kcal and grams to whole numbers.

- "כמה נשאר היום?" → `day` → `remainingKcal`, protein vs target.
- "איך השבוע?" → `week` → `avgDeficitKcal` vs `targetDeficitKcal`, `daysLogged`, `missingDays`, `trendChangeKg` vs `plannedChangeKg`.
- "מתי אגיע ליעד?" → `profile` → `eta`, `status`; mention `reportGap.alert` if true.

## Limits (`link.ts` rejects values outside these)

Entry kcal 0–5000 · macros 0–500 g · weight 30–300 kg · steps 0–100000 · workout 1–600 min and 0–3000 kcal · per-100 g kcal 0–900 and macros 0–100 g.

## Errors

- `link error: …` → fix the JSON and try once more.
- `config.json needs projectId and uid` → ask the user to copy them from the app's Settings screen into `.claude/skills/kal/config.json`.
- A fetch error in a cloud session → the environment's network settings may need `firestore.googleapis.com` allowed.
