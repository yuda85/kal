import { Component, computed, DestroyRef, effect, inject, viewChild, type ElementRef } from '@angular/core';
import type { Chart } from 'chart.js';
import { KalState } from '../../core/kal-state';
import { addDays, dateRange, GAP_WINDOW_DAYS } from '../../domain';
import { fontsReady, weightChart } from '../../shared/charts';
import { fmt, shortDate } from '../../shared/format';
import { QuickAddService } from '../today/quick-add.service';
import { STATUS_TEXT, weightView, type WeightView } from './weight.logic';

@Component({
  selector: 'app-weight',
  template: `
    @if (view(); as v) {
      <section class="row head">
        <div>
          <div class="num big">{{ v.trendKg === null ? '—' : fmt(v.trendKg, 1) + ' kg' }}</div>
          <div class="muted small">מגמה · יעד <span class="num">{{ fmt(goalKg(), 1) }}</span></div>
        </div>
        @if (v.status; as s) {
          <span class="alert" [class.success]="s !== 'behind'" [class.warning]="s === 'behind'">
            {{ statusText[s] }}@if (v.eta) { · צפי <span class="num">{{ shortDate(v.eta) }}</span> }
          </span>
        }
      </section>

      <div class="chart"><canvas #chart aria-label="מגמת משקל מול תוכנית ויעד"></canvas></div>

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
    .head { margin-block: 12px; align-items: flex-start; }
    .big { font-size: 26px; font-weight: 500; }
    .chart { position: relative; height: 220px; margin-block: 12px; }
    .gap { margin-block: 12px; }
    .add { width: 100%; }
  `,
})
export class WeightPage {
  private readonly state = inject(KalState);
  protected readonly quickAdd = inject(QuickAddService);
  protected readonly fmt = fmt;
  protected readonly shortDate = shortDate;
  protected readonly statusText = STATUS_TEXT;
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('chart');
  private chart: Chart | undefined;
  private drawToken = 0;

  protected readonly goalKg = computed(() => this.state.goal()?.targetWeightKg ?? null);

  protected readonly view = computed(() => {
    const profile = this.state.profile();
    const goal = this.state.goal();
    if (!profile || !goal) return null;
    const today = this.state.today();
    const energy = dateRange(addDays(today, -GAP_WINDOW_DAYS), addDays(today, -1)).map((date) => {
      const s = this.state.dayFor(date)!;
      return { date, inKcal: s.intake.kcal, outKcal: s.expenditure.out };
    });
    return weightView({ today, goal, weighIns: this.state.weighIns(), energy, lowDayThresholdKcal: profile.settings.lowDayThresholdKcal });
  });

  constructor() {
    effect(() => {
      const v = this.view();
      const canvas = this.canvas();
      if (v && canvas) void this.draw(canvas.nativeElement, v);
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  protected gapDays(from: string, to: string): number {
    return dateRange(from, to).length;
  }

  private async draw(canvas: HTMLCanvasElement, v: WeightView): Promise<void> {
    const token = ++this.drawToken;
    await fontsReady();
    if (token !== this.drawToken) return;
    this.chart?.destroy();
    this.chart = weightChart(canvas, v.labels, v.trend, v.plan, v.target, v.points);
  }
}
