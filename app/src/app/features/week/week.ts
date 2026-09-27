import { Component, computed, DestroyRef, effect, inject, signal, viewChild, type ElementRef } from '@angular/core';
import type { Chart } from 'chart.js';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { KalState } from '../../core/kal-state';
import { addDays } from '../../domain';
import { fontsReady, weekChart } from '../../shared/charts';
import { fmt, shortDate } from '../../shared/format';
import { canGoBack, weekView, type WeekView } from './week.logic';

@Component({
  selector: 'app-week',
  imports: [LucideChevronLeft, LucideChevronRight],
  template: `
    @if (view(); as v) {
      <header class="row">
        <button type="button" aria-label="שבוע קודם" [disabled]="!canGoBack(v.summary.start, today())" (click)="shift(-7)"><svg lucideChevronRight [size]="18"></svg></button>
        <h2><span class="num">{{ shortDate(v.summary.start) }}–{{ shortDate(v.summary.end) }}</span></h2>
        <button type="button" aria-label="שבוע הבא" [disabled]="v.summary.end >= today()" (click)="shift(7)"><svg lucideChevronLeft [size]="18"></svg></button>
      </header>

      <div class="kpis">
        <div class="card">
          <div class="muted small">גירעון ממוצע</div>
          <div class="num value">{{ fmt(v.summary.avgDeficitKcal) }}</div>
          <div class="muted small">יעד <span class="num">{{ fmt(v.summary.targetDeficitKcal) }}</span></div>
        </div>
        <div class="card">
          <div class="muted small">שינוי במגמה</div>
          <div class="num value">{{ v.summary.trendChangeKg === null ? '—' : fmt(v.summary.trendChangeKg, 1) + ' kg' }}</div>
          <div class="muted small">מתוכנן <span class="num">{{ fmt(v.summary.plannedChangeKg, 1) }}</span></div>
        </div>
        <div class="card">
          <div class="muted small">ממוצע נכנס</div>
          <div class="num value">{{ fmt(v.summary.avgInKcal) }}</div>
          <div class="muted small"><span class="num">{{ v.summary.daysLogged }}</span> ימים מלאים</div>
        </div>
        <div class="card">
          <div class="muted small">ממוצע חלבון</div>
          <div class="num value">{{ v.summary.avgProtein === null ? '—' : fmt(v.summary.avgProtein) + 'g' }}</div>
        </div>
      </div>

      <div class="chart"><canvas #chart aria-label="נכנס מול יצא לפי יום"></canvas></div>

      @if (v.missing.length > 0) {
        <div class="alert danger">ימים חסרים: <span class="num">{{ missingText(v) }}</span></div>
      }
    }
  `,
  styles: `
    header { margin-block: 8px; }
    .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-block: 12px; }
    .value { font-size: 20px; font-weight: 500; }
    .chart { position: relative; height: 200px; margin-block: 12px; }
  `,
})
export class Week {
  private readonly state = inject(KalState);
  protected readonly fmt = fmt;
  protected readonly shortDate = shortDate;
  protected readonly today = this.state.today;
  protected readonly canGoBack = canGoBack;
  private readonly weekDate = signal(this.state.today());
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('chart');
  private chart: Chart | undefined;
  private drawToken = 0;

  protected readonly view = computed(() => {
    const profile = this.state.profile();
    const goal = this.state.goal();
    if (!profile || !goal) return null;
    return weekView({
      date: this.weekDate(),
      today: this.state.today(),
      entries: this.state.entries(),
      days: this.state.days(),
      profile,
      goal,
      weighIns: this.state.weighIns(),
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

  protected missingText(v: WeekView): string {
    return v.missing.map(shortDate).join(', ');
  }

  private async draw(canvas: HTMLCanvasElement, v: WeekView): Promise<void> {
    const token = ++this.drawToken;
    await fontsReady();
    if (token !== this.drawToken) return;
    this.chart?.destroy();
    this.chart = weekChart(canvas, v.labels, v.inKcal, v.outKcal, v.missingIdx);
  }
}
