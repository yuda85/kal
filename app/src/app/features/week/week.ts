import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, signal, viewChild, type ElementRef } from '@angular/core';
import type { Chart } from 'chart.js';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { KalState } from '../../core/kal-state';
import { addDays, fullWeek, reportGap, settingsOf, STEPS_GOAL, STEPS_GREAT, STEPS_LOW, trendSeries } from '../../domain';
import { fontsReady, weekChart } from '../../shared/charts';
import { fmt, shortDate } from '../../shared/format';
import { realityLine } from '../../shared/reality-line';
import { canGoBack, canGoBackMonth, monthView, shiftMonth, STEPS_BOTTOM, STEPS_H, STEPS_W, weekView, type MissingInput, type WeekView } from './week.logic';

const MISSING_LABEL: Record<MissingInput, string> = { steps: 'צעדים', weight: 'משקל' };

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

        <div class="kpis">
          <div class="card">
            <div class="muted small">גירעון לפי הלוג</div>
            <div class="num value">{{ fmt(v.summary.avgDeficitKcal) }}</div>
            <div class="muted small">לפי המשקל <span class="num">{{ fmt(v.summary.weightDeficitKcal) }}</span> · יעד <span class="num">{{ fmt(v.summary.targetDeficitKcal) }}</span></div>
          </div>
          <div class="card">
            <div class="muted small">שינוי במשקל (ממוצע)</div>
            <div class="num value">{{ v.summary.weightChangeKg === null ? '—' : fmt(v.summary.weightChangeKg, 1) + ' kg' }}</div>
            <div class="muted small">מתוכנן <span class="num">{{ fmt(v.summary.plannedChangeKg, 1) }}</span></div>
          </div>
          <div class="card">
            <div class="muted small">ממוצע נכנס</div>
            <div class="num value">{{ fmt(v.summary.avgInKcal) }}</div>
            <div class="muted small"><span class="num">{{ v.summary.daysLogged }}</span> ימים מדווחים · <span class="num">{{ v.summary.imputedDays }}</span> לא הוזנו</div>
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

        <section class="card steps">
          <div class="muted small">צעדים</div>
          <div class="avg"><span class="num">{{ v.summary.avgSteps === null ? '—' : fmt(v.summary.avgSteps) }}</span><small>ממוצע ליום</small></div>
          <div class="legend small muted">
            @if (v.steps.mean) {
              <span><i></i>{{ v.summary.stepsDays === 1 ? 'לפי יום אחד שהסתיים' : 'לפי ' + v.summary.stepsDays + ' ימים שהסתיימו' }}</span>
            } @else {
              <span>עוד אין יום שהסתיים עם צעדים</span>
            }
            <span><i class="goal"></i>יעד <span class="num">{{ fmt(STEPS_GOAL) }}</span></span>
          </div>
          <svg [attr.viewBox]="'0 0 ' + SW + ' ' + SH" role="img" [attr.aria-label]="stepsLabel()">
            <defs>
              <linearGradient id="steps-great" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" class="from" />
                <stop offset="1" class="to" />
              </linearGradient>
            </defs>
            <line class="base" x1="10" [attr.x2]="SW - 10" [attr.y1]="SB" [attr.y2]="SB" />
            @for (s of v.steps.slots; track $index) {
              @if (s.kind !== 'empty') {
                <rect [class]="s.kind + (s.tier ? ' ' + s.tier : '')" [attr.fill]="s.tier === 'great' ? greatFill : null"
                  [attr.x]="s.x - 11" [attr.y]="s.y" width="22" [attr.height]="s.height" rx="3" />
                <text class="note" [class.now]="s.current" [attr.x]="s.x" [attr.y]="s.y - 5">{{ s.note }}</text>
                @if (s.tier === 'great') {
                  <path class="sparkle" [attr.transform]="'translate(' + s.x + ' ' + (s.y - 22) + ')'" d="M0-6L1.8-1.8 6 0 1.8 1.8 0 6-1.8 1.8-6 0-1.8-1.8Z" />
                }
              }
              <text class="label" [class.now]="s.current" [attr.x]="s.x" [attr.y]="SB + 16">{{ s.label }}</text>
              @if (s.current && s.kind === 'bar') {
                <text class="label" [attr.x]="s.x" [attr.y]="SB + 28">עד עכשיו</text>
              }
            }
            <line class="goal" x1="10" [attr.x2]="SW - 10" [attr.y1]="v.steps.goal.y" [attr.y2]="v.steps.goal.y" />
            @if (v.steps.mean; as m) {
              <line class="mean" x1="10" [attr.x2]="SW - 10" [attr.y1]="m.y" [attr.y2]="m.y" />
            }
          </svg>
          @if (records(); as r) {
            <div class="records">
              <div><div class="muted small">רצף 10K</div><div>@if (r.streak.days === 1) {יום אחד} @else {<span class="num">{{ r.streak.days }}</span> ימים}</div></div>
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
          <div class="tiers small muted">
            <span><i class="low"></i>מתחת ל-<span class="num">{{ fmt(STEPS_LOW) }}</span></span>
            <span><i class="mid"></i>עד <span class="num">{{ fmt(STEPS_GOAL) }}</span></span>
            <span><i class="goal"></i>יעד</span>
            <span><i class="great"></i>✦ מעל <span class="num">{{ fmt(STEPS_GREAT) }}</span></span>
          </div>
        </section>

        <ul class="rows">
          @for (r of v.rows; track r.date) {
            <li class="row" [class.imputed]="r.imputed" [class.gap]="r.missing.length > 0">
              <span class="day">{{ r.label }}</span>
              <span class="mid">
                @for (t of r.types; track $index) { <span class="tag">{{ t }}</span> }
                @if (r.imputed) { <span class="flag food">לא הוזן אוכל · נחשב <span class="num">{{ fmt(missingKcal()) }}</span></span> }
                @if (r.missing.length > 0) { <span class="flag input">חסר: {{ missingText(r.missing) }}</span> }
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
    .fullweek { display: flex; align-items: center; justify-content: space-between; margin-block: 12px; }
    .fullweek.perfect { border-color: var(--great); }
    .dots { display: flex; gap: 5px; list-style: none; margin: 0; padding: 0; }
    .dots li { width: 14px; height: 14px; border-radius: 50%; border: 1.5px dashed var(--fg-muted); }
    .dots li.full { background: var(--out); border-color: var(--out); border-style: solid; }
    .dots li.partial { border: 1.5px solid var(--missing); }
    .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-block: 12px; }
    .kpis.three { grid-template-columns: repeat(3, 1fr); }
    .value { font-size: 20px; font-weight: 500; }
    .chart { position: relative; height: 200px; margin-block: 12px; }
    .steps { margin-block: 12px; }
    .avg { display: flex; align-items: baseline; gap: 8px; font-size: 26px; font-weight: 500; line-height: 1.3; }
    .avg small { font-size: 13px; font-weight: 400; color: var(--fg-muted); }
    .legend, .tiers { display: flex; flex-wrap: wrap; gap: 4px 12px; }
    .legend i { display: inline-block; width: 14px; border-top: 1px dashed var(--fg-muted); vertical-align: middle; margin-inline-end: 4px; }
    .legend i.goal { border-top: 2px solid var(--out); }
    .records { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; margin-top: 8px; font-size: 16px; font-weight: 500; }
    .records .small { font-weight: 400; }
    .tiers { margin-top: 4px; }
    .tiers i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-inline-end: 4px; }
    .steps svg { display: block; width: 100%; height: auto; direction: ltr; margin-top: 6px; }
    .steps .base { stroke: var(--border); }
    /* Traffic light against the steps goal (§18): it grades steps only, never weight progress. */
    .steps rect.low, .tiers .low { fill: var(--danger); background: var(--danger); }
    .steps rect.mid, .tiers .mid { fill: var(--in); background: var(--in); }
    .steps rect.goal, .tiers .goal { fill: var(--out); background: var(--out); }
    .tiers .great { background: linear-gradient(to top, var(--out), var(--great)); }
    .steps stop.from { stop-color: var(--out); }
    .steps stop.to { stop-color: var(--great); }
    .steps .sparkle { fill: var(--great); }
    .steps rect.missing { fill: none; stroke: var(--fg-muted); stroke-dasharray: 3 2; }
    .steps .goal { stroke: var(--out); stroke-width: 1.5; }
    .steps .mean { stroke: var(--fg-muted); stroke-dasharray: 4 3; }
    .steps text { font-size: 10px; fill: var(--fg-muted); text-anchor: middle; font-variant-numeric: tabular-nums; }
    .steps text.now { fill: var(--fg); font-weight: 700; }
    .rows { list-style: none; margin: 0; padding: 0; }
    .rows li { padding-block: 6px; padding-inline-start: 8px; border-block-end: 1px solid var(--border); border-inline-start: 3px solid transparent; font-size: 13px; }
    /* Red: no food logged. Orange: steps or a weigh-in missing. Always with text, never color alone. */
    .rows li.gap { border-inline-start-color: var(--missing); }
    .rows li.imputed { color: var(--danger); border-inline-start-color: var(--danger); }
    .day { flex: none; }
    .mid { flex: 1; display: flex; flex-wrap: wrap; gap: 4px; }
    .flag { font-size: 12px; border-radius: 999px; padding: 0 8px; }
    .flag.food { color: var(--danger-fg); background: var(--danger-bg); }
    .flag.input { color: var(--missing-fg); background: var(--missing-bg); }
    .tag { border: 1px solid var(--border); border-radius: 999px; padding: 0 8px; font-size: 11px; margin-inline-end: 4px; }
    .cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
    .cal.head { font-size: 11px; color: var(--fg-muted); text-align: center; margin-block-end: 3px; }
    .cell { min-height: 44px; border-radius: 6px; padding: 2px 4px; font-size: 11px; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--border); }
    /* Deficit is what the log says, not a verdict: a grey tint; only the weight reality check may look like "on track". */
    .cell.deficit { background: color-mix(in srgb, var(--neutral-bar) 15%, transparent); }
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
  protected readonly SW = STEPS_W;
  protected readonly SH = STEPS_H;
  protected readonly SB = STEPS_BOTTOM;
  protected readonly STEPS_GOAL = STEPS_GOAL;
  protected readonly STEPS_LOW = STEPS_LOW;
  protected readonly STEPS_GREAT = STEPS_GREAT;
  /** Absolute: with <base href="/"> Safari resolves a bare url(#id) against the base, not this page. */
  protected readonly greatFill = `url(${inject(DOCUMENT).location.href.split('#')[0]}#steps-great)`;
  protected readonly mode = signal<'week' | 'month'>('week');
  protected readonly month = signal(this.state.today().slice(0, 7));
  private readonly weekDate = signal(this.state.today());
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('chart');
  private chart: Chart | undefined;
  private drawToken = 0;

  protected readonly reality = computed(() => realityLine(this.state.reality()));
  protected missingText(missing: MissingInput[]): string {
    return missing.map((m) => MISSING_LABEL[m]).join(' · ');
  }

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

  protected readonly full = computed(() => {
    const input = this.state.achievementInput();
    if (!input) return null;
    const f = fullWeek(input, this.weekDate());
    return f.of === 0 ? null : f;
  });

  protected readonly records = computed(() => this.state.achievements()?.steps ?? null);

  /** The steps chart as a sentence, for screen readers. */
  protected readonly stepsLabel = computed(() => {
    const v = this.view();
    if (!v) return '';
    const days = v.steps.slots
      .filter((s) => s.kind !== 'empty')
      .map((s) => `${s.label} ${s.note}${s.current ? ' עד עכשיו' : ''}`)
      .join(', ');
    const mean = v.summary.avgSteps === null ? '' : `. ממוצע ${fmt(v.summary.avgSteps)}`;
    return `צעדים לפי יום: ${days || 'אין'}${mean}. יעד ${fmt(STEPS_GOAL)}`;
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
      series: trendSeries(input.weighIns, input.today),
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
