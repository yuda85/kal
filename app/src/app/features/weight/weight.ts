import { Component, computed, inject, signal } from '@angular/core';
import { LucideFlag } from '@lucide/angular';
import { KalState } from '../../core/kal-state';
import { dateRange } from '../../domain';
import { dayLetter, fmt, shortDate, signedKg } from '../../shared/format';
import { realityLine } from '../../shared/reality-line';
import { QuickAddService } from '../today/quick-add.service';
import { CHART_H, CHART_W, weekTitle, weightView } from './weight.logic';

@Component({
  selector: 'app-weight',
  imports: [LucideFlag],
  template: `
    @if (view(); as v) {
      <section class="hero">
        @if (v.thisWeek.meanKg; as mean) {
          @if (v.thisWeek.changeKg !== null) {
            <div class="big"><span class="num" dir="ltr" [class.down]="v.thisWeek.changeKg < 0">{{ signedKg(v.thisWeek.changeKg) }}</span> <small>ק״ג השבוע</small></div>
          }
          <div class="muted small">ממוצע השבוע <span class="num">{{ fmt(mean, 1) }}</span>@if (v.lastWeek?.meanKg; as last) { · שבוע שעבר <span class="num">{{ fmt(last, 1) }}</span> }</div>
        } @else {
          <div class="title">עוד לא נשקלת השבוע</div>
          @if (v.lastWeek?.changeKg; as change) {
            <div class="muted small">שבוע שעבר <span class="num" dir="ltr">{{ signedKg(change) }}</span> ק״ג</div>
          }
        }
      </section>

      @if (v.lostKg !== null) {
        <section class="progress">
          <div class="track" role="img" [attr.aria-label]="progressLabel()"><i [style.width.%]="v.progress * 100"></i></div>
          <div class="ticks" aria-hidden="true">
            @for (t of v.ticks; track $index) { <b [class.on]="t.reached" [style.inset-inline-start.%]="t.pct"></b> }
          </div>
          <div class="ends small muted">
            <span>התחלה <span class="num">{{ fmt(v.startKg, 1) }}</span></span>
            <span>{{ v.lostKg >= 0 ? 'ירדו' : 'עלו' }} <span class="num">{{ fmt(v.lostKg >= 0 ? v.lostKg : -v.lostKg, 1) }}</span> · נשארו <span class="num">{{ fmt(v.leftKg, 1) }}</span></span>
            <span>יעד <span class="num">{{ fmt(v.targetKg, 1) }}</span></span>
          </div>
          @if (v.milestones.next; as n) {
            <p class="next small"><svg lucideFlag [size]="15" aria-hidden="true"></svg>{{ n.target ? 'היעד' : 'אבן הדרך הבאה' }}: <span class="num" dir="ltr">−{{ fmt(n.kg, 1) }}</span> ק״ג · עוד <span class="num">{{ fmt(n.leftKg, 1) }}</span></p>
          } @else if (v.milestones.reachedTarget) {
            <p class="next small"><svg lucideFlag [size]="15" aria-hidden="true"></svg>הגעת ליעד</p>
          }
        </section>
      }

      <p class="alert" [class]="reality().tone">
        {{ reality().text }}@if (v.eta && reality().tone !== 'neutral') { · צפי <span class="num">{{ shortDate(v.eta) }}</span> }
      </p>

      @if (v.chart.points.length > 0 || v.selectedWeek) {
        <section class="card">
          @if (v.selectedWeek; as s) {
            <div class="row zoom">
              <div>
                <h3 class="small">{{ weekTitle(s, v.thisWeek.start) }}</h3>
                @if (v.chart.mean; as m) {
                  <div class="legend small muted"><i></i>ממוצע <span class="num">{{ fmt(m.kg, 1) }}</span></div>
                }
              </div>
              <button type="button" class="back small" (click)="week.set(null)">כל השבועות</button>
            </div>
          } @else {
            <h3 class="small">ממוצע לשבוע</h3>
          }
          <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="group" [attr.aria-label]="chartLabel()">
            <g aria-hidden="true">
              @for (t of v.chart.ticks; track $index) {
                <line class="grid" x1="30" [attr.x2]="W" [attr.y1]="t.y" [attr.y2]="t.y" />
                <text class="tick" x="0" [attr.y]="t.y + 3">{{ fmt(t.kg, 1) }}</text>
              }
              @if (v.chart.mean; as m) {
                <line class="mean" x1="30" [attr.x2]="W" [attr.y1]="m.y" [attr.y2]="m.y" />
              }
              @for (l of v.chart.lines; track $index) {
                <polyline class="line" [attr.points]="l" />
              }
              @for (p of v.chart.points; track p.key) {
                <circle [class.now]="p.current" [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="p.current ? 6 : 4" />
                @if (p.note !== null) {
                  <text class="change" [class.now]="p.current" [attr.x]="p.x" [attr.y]="p.y - 11">{{ p.note }}</text>
                }
              }
              @for (l of v.chart.labels; track $index) {
                <text class="label" [class.now]="l.current" [attr.x]="l.x" [attr.y]="H - 8">{{ l.text }}</text>
              }
            </g>
            @if (!v.selectedWeek) {
              @for (p of v.chart.points; track p.key) {
                <rect class="hit" role="button" tabindex="0" [attr.x]="p.x - v.chart.slot / 2" y="0" [attr.width]="v.chart.slot" [attr.height]="H"
                  [attr.aria-label]="weekTitle(p.key, v.thisWeek.start) + ' · ממוצע ' + fmt(p.kg, 1) + ' · הצגת ימים'"
                  (click)="week.set(p.key)" (keydown.enter)="week.set(p.key)" (keydown.space)="$event.preventDefault(); week.set(p.key)" />
              }
            }
          </svg>
        </section>
      }

      <section class="days">
        <h3 class="small muted">{{ v.selectedWeek && v.selectedWeek !== v.thisWeek.start ? 'השקילות ב' + weekTitle(v.selectedWeek, v.thisWeek.start) : 'השקילות השבוע' }}</h3>
        @for (d of v.days; track d.date) {
          <div class="row day" [class.missing]="d.kg === null">
            <span>{{ dayLetter(d.date) }} <span class="num">{{ shortDate(d.date) }}</span>{{ d.date === today() ? ' · היום' : '' }}</span>
            @if (d.kg === null) {
              <span>לא נשקלת</span>
            } @else {
              <span class="num">{{ fmt(d.kg, 1) }}</span>
            }
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
    .ticks { position: relative; height: 6px; }
    .ticks b { position: absolute; top: 0; width: 2px; height: 6px; background: var(--fg-muted); }
    .ticks b.on { background: var(--out); }
    .next { margin: 6px 0 0; }
    .next svg { color: var(--out); vertical-align: -3px; margin-inline-end: 6px; }
    .ends { display: flex; justify-content: space-between; gap: 8px; margin-top: 4px; }
    .alert { margin-block: 12px; }
    .card { margin-block: 12px; }
    h3 { margin: 0 0 6px; font-weight: 500; }
    .card svg { display: block; width: 100%; height: auto; direction: ltr; }
    .grid { stroke: var(--border); }
    .tick, .change, .label { font-size: 10px; fill: var(--fg-muted); font-variant-numeric: tabular-nums; }
    .change, .label { text-anchor: middle; }
    .change.now, .label.now { fill: var(--fg); font-weight: 700; }
    .line { fill: none; stroke: var(--neutral-bar); stroke-width: 2; }
    .mean { stroke: var(--fg-muted); stroke-dasharray: 4 3; }
    .hit { fill: transparent; cursor: pointer; outline: none; }
    .hit:focus-visible { stroke: var(--primary); stroke-width: 2; }
    .zoom { margin-bottom: 6px; }
    .zoom h3 { margin: 0; }
    .legend i { display: inline-block; width: 14px; border-top: 1px dashed var(--fg-muted); vertical-align: middle; margin-inline-end: 4px; }
    .back { padding: 0 12px; }
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
  protected readonly weekTitle = weekTitle;
  protected readonly shortDate = shortDate;
  protected readonly dayLetter = dayLetter;
  protected readonly W = CHART_W;
  protected readonly H = CHART_H;
  protected readonly today = this.state.today;
  protected readonly reality = computed(() => realityLine(this.state.reality()));
  /** Week start the chart is zoomed into; null shows every week. */
  protected readonly week = signal<string | null>(null);

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
      week: this.week(),
    });
  });

  /** The chart's content as a sentence, for screen readers. */
  protected readonly chartLabel = computed(() => {
    const v = this.view();
    if (!v) return '';
    const points = v.chart.points.map((p) => `${p.label} ${fmt(p.kg, 1)}`).join(', ');
    if (!v.selectedWeek) return 'ממוצע משקל לשבוע: ' + points;
    const mean = v.chart.mean ? `, ממוצע ${fmt(v.chart.mean.kg, 1)}` : '';
    return `${weekTitle(v.selectedWeek, v.thisWeek.start)}, משקל לפי יום: ${points}${mean}`;
  });

  protected readonly progressLabel = computed(() => {
    const v = this.view();
    return v ? `${fmt(v.progress * 100)}% מהדרך ליעד` : '';
  });

  protected gapDays(from: string, to: string): number {
    return dateRange(from, to).length;
  }
}
