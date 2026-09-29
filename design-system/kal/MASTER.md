# kal — Design System (MASTER)

Global source of truth for UI. A page file in `pages/<page>.md`, if present, overrides this file for that page.

Derived from the ui-ux-pro-max skill (`"calorie nutrition tracker minimal mobile dashboard" --design-system`, variance 2, motion 2, density 6), with the adjustments listed under **Deviations**.

## Direction

- **Style:** Minimalism & Swiss — clean, functional, high contrast, generous white space, grid-based, no decoration.
- **Platform:** Mobile-first PWA, Hebrew, `dir="rtl"`. Desktop is the same layout, centered, max width 480px.
- **Tone:** One hero number per screen. Color only where it carries meaning.

## Color tokens

Define as CSS custom properties on `:root`; dark values under `@media (prefers-color-scheme: dark)`. Components use tokens only, never raw hex.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--bg` | `#F8FAFC` | `#0B0F14` | Page |
| `--card` | `#FFFFFF` | `#111827` | Cards, sheets |
| `--fg` | `#0F172A` | `#F1F5F9` | Primary text |
| `--fg-muted` | `#475569` | `#94A3B8` | Secondary text |
| `--border` | `#E2E8F0` | `#1F2937` | Hairlines |
| `--primary` | `#0F6E56` | `#34D399` | Primary action (FAB, Save) |
| `--on-primary` | `#FFFFFF` | `#052E22` | Text/icons on primary |
| `--out` | `#1D9E75` | `#34D399` | Calories out, on-track status |
| `--in` | `#EA580C` | `#FB923C` | Calories in, macros |
| `--neutral-bar` | `#888780` | `#6B7280` | Neutral data: weigh-in dots, target line, logged-deficit tint |
| `--danger` | `#DC2626` | `#F87171` | Over cap, missing day, destructive |
| `--warning-bg` / `--warning-fg` | `#FEF3C7` / `#92400E` | `#422006` / `#FCD34D` | Constraint warnings |
| `--success-bg` / `--success-fg` | `#D1FAE5` / `#047857` | `#064E3B` / `#6EE7B7` | Status chips |
| `--danger-bg` / `--danger-fg` | `#FEE2E2` / `#B91C1C` | `#450A0A` / `#FCA5A5` | Red flag: no food logged |
| `--missing` | `#EA580C` | `#FB923C` | Orange row edge: steps or weight not entered (non-text, ≥ 3:1) |
| `--missing-bg` / `--missing-fg` | `#FFEDD5` / `#9A3412` | `#431407` / `#FDBA74` | Orange flag: steps or weight not entered |
| `--star` | `#B45309` | `#FBBF24` | Filled star on a saved tip (paired with `aria-pressed` and label) |

Status is never conveyed by color alone: always pair with text and/or an icon.

## Typography

- **Font:** Heebo (Google Fonts, variable 100–900, Hebrew + Latin). Weights used: 400, 500, 700.
- **Numbers:** `font-variant-numeric: tabular-nums`. Numeric strings (`1,650 / 2,100`, `88.2 kg`) are wrapped with `dir="ltr"` / `unicode-bidi: isolate` so they never reorder inside RTL text.
- **Scale:** hero 34px/500 · screen title 15–17px/500 · body 15px/400 (never below 12px) · caption 12px · line-height 1.5.

## Spacing and shape

- Spacing scale (4px base): 4, 8, 12, 16, 24, 32.
- Radius: 8px controls, 12px cards, 20px sheets.
- Hairline borders; no shadows except the bottom sheet.
- Touch targets ≥ 44×44px; ≥ 8px between targets.
- Respect `env(safe-area-inset-*)` for bottom nav, FAB, and sheets.

## Layout and RTL

- CSS logical properties only (`margin-inline-start`, `padding-inline-end`, `inset-inline-end`).
- FAB sits at the inline end (bottom-left in RTL).
- Chart time axes stay left-to-right (chart convention); legends and tooltips are RTL.
- Bottom navigation: 5 tabs (היום, שבוע, משקל, מתכונים, טיפים), icon + label, active tab uses `--out`.

## Components

- **Bullet bar:** 8px track (`--card` on `--bg` contrast), fill color by meaning, 2px marker for caps/targets, label and `value / target` text above.
- **KPI card:** muted 11–12px label, 16–20px/500 value, one-line context below.
- **Entry row:** time (muted, tabular) · name · kcal (end-aligned); hairline divider.
- **Bottom sheet (quick-add):** segmented tabs ארוחה · משקל (activity moved to the check-in sheet); macros hidden behind "+ מאקרו".
- **Hero (Today):** "נשאר לאכול" label; the remaining number (hero 34px/500) with "מתוך <target>" (20px/400, `--fg-muted`) on the same baseline.
- **Check-in sheet:** bottom sheet; opens with the honesty block ("תהיה כנה": what was skipped or avoided, "המטרה היא מעקב, לא שיפוט") next to the owner's photo (96px, 9:16, chosen once from the phone, kept only on the device; a dashed "הוספת תמונה" slot until then, "החלפת תמונה" under it after); food status line (danger when the day would be penalized); steps input with the default as placeholder; workout type chips (44px); calories and optional duration inputs only when a type is chosen, with the active-vs-total hint (and a walk/run-as-steps hint for Cardio); optional weight with the carried weight as placeholder; לא עכשיו · שמירה.
- **Target card (Today, "איך נבנה היעד היום"):** an equation row read right to left: שורף היום − גירעון (goal pace under it) (± מגבלת קלוריות when the kcal constraint moved the target) = יעד לאכילה; numbers 22px/500 (target 700), labels 12px muted, operators muted. Under a hairline, "ממה מורכבת השריפה": במנוחה (BMR), יומיום ועיכול (כולל 3,500 צעדים), steps above or below 3,500 with the count or "לא הוזנו", one line per workout; values end-aligned, signed with a real minus, zero muted. Monochrome: typography carries the hierarchy. Numbers are rounded so they add up on screen. A screen-reader sentence carries the equation.
- **Week rows:** finished days get a 3px row edge and a text flag: red (`--danger`, `--danger-bg/fg`) "לא הוזן אוכל · נחשב 3,200"; orange (`--missing`, `--missing-bg/fg`) "חסר: צעדים · משקל". Today and days before the goal start are never flagged.
- **Month calendar:** 7-column grid from Sunday; each cell shows the day number and the workout type as text; background is supplementary (deficit / surplus / not logged "!"). Deficit days get a grey `--neutral-bar` tint, never green: only the weight reality check may look like "on track". The check-in food line is neutral when the day is logged, danger when it would be penalized.
- **Weight screen:** hero = this week's change (34px/500, `--out` when down) with "ממוצע השבוע · שבוע שעבר" under it; progress bar (bullet-bar track) start → target with "ירדו · נשארו"; reality line full width; weekly chart; "השקילות השבוע" rows (day · kg, missing day muted "לא נשקלת"); report-gap card; add button.
- **Tip card:** card with a muted 12px topic label, title 16px/600, body 15px/400 line-height 1.6 (`--fg`), optional action line 14px/500 `--out` with an arrow icon; star button 44×44 at the inline end (outline `--fg-muted`, filled `--star` when starred, `aria-pressed`).
- **Video card:** like a tip card; a 48×64 play tile (`--border` background, play icon), title, "Instagram · 28.9" muted, the take as a quote with a 3px `--out` inline-start border, "צפייה" (opens a new tab) and a delete icon button (confirm dialog).
- **Filter chips:** 36px high (44px hit area), pill, `--border` outline; active chip `--primary` fill with `--on-primary` text; one row that scrolls sideways inside itself.
- **Daily tip dialog:** `role="dialog"`, `aria-modal`, 60% black scrim, centred card (radius 20px), "טיפ היום · <topic>", the reason line as a `--missing-bg/fg` pill when there is one, title 20px/600, body, action line, then star toggle and a primary "הבנתי" (focused on open). No close on scrim tap or Escape: it is closed with "הבנתי".
- **Toast:** short, past tense ("נשמר"), 3s, above the bottom nav.
- **Confirm dialog:** only for delete.

## Charts (Chart.js)

| Screen | Chart | Encoding |
|---|---|---|
| Today | Bullet bars (CSS) | kcal `--out`, protein/carbs/fat `--in` (every macro has a target), cap marker |
| Week | Grouped bars | in `--in` (counted intake: a penalized day shows 3,200), out `--out`; penalized day = dashed `--danger` outline + marked row |
| Weight | Weekly line (inline SVG, not Chart.js) | one point per week (mean of real weigh-ins) `--neutral-bar`, current week `--out` and larger; change above each point, 10–11px muted; no plan or target line; axis fits the data |

Every chart has a text summary next to it (hero number, status chip, or KPI cards) so no information lives only in the chart.

## Icons

Lucide via `@lucide/angular` (standalone `<svg lucideX>` components), outline, 18–22px. No emoji as icons. Icon-only buttons get `aria-label`.

## Motion

CSS transitions 150–250ms, `ease-out`, on opacity/transform only. Honor `prefers-reduced-motion: reduce` (no transitions). No animation libraries.

## Forms

- Visible labels, never placeholder-only.
- `inputmode="decimal"` for kcal, grams, kg; `inputmode="numeric"` for steps.
- Inline errors next to the field; validate on blur and submit.

## Deviations from the skill output

| Skill suggested | Using | Why |
|---|---|---|
| Inter | Heebo | Inter has no Hebrew glyphs |
| Primary `#059669` with black text | `#0F6E56` with white text | White on `#059669` fails 4.5:1 |
| Mint background `#ECFDF5` | Neutral `#F8FAFC` | Keep green for meaning only |
| Hero + Testimonials pattern | Not used | Landing-page pattern; this is an app |
| GSAP scroll reveal | CSS transitions | No animation dependency needed |
| (no RTL match in the database) | Guidance above | General RTL practice, not a database result |

## Pre-delivery checklist

- [ ] Text contrast ≥ 4.5:1 in light and dark
- [ ] Touch targets ≥ 44px; safe areas respected
- [ ] Focus states visible; keyboard reachable
- [ ] `prefers-reduced-motion` respected
- [ ] No color-only status
- [ ] Numbers isolated LTR and tabular
- [ ] Layout checked at 375px and 768px, no horizontal scroll
