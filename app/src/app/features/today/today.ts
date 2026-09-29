import { Component, computed, effect, inject } from '@angular/core';
import { LucideMoon, LucidePlus, LucideScale } from '@lucide/angular';
import { KalState } from '../../core/kal-state';
import { settingsOf } from '../../domain';
import { BulletBar } from '../../shared/bullet-bar';
import { fmt, warningText } from '../../shared/format';
import { realityLine } from '../../shared/reality-line';
import { shouldPromptCheckIn } from '../checkin/checkin.logic';
import { CheckInService } from '../checkin/checkin.service';
import { QuickAddService } from './quick-add.service';
import { TargetCard } from './target-card';
import { staleSyncHours, targetBreakdown } from './today.logic';

@Component({
  selector: 'app-today',
  imports: [BulletBar, LucidePlus, LucideScale, LucideMoon, TargetCard],
  template: `
    @if (summary(); as s) {
      <div class="row top">
        <button type="button" class="chip" [class.missing]="!weighIn()" (click)="quickAdd.open('weight')">
          <svg lucideScale [size]="16"></svg>
          @if (weighIn(); as w) { <span class="num">{{ fmt(w.kg, 1) }}</span> ק״ג } @else { + שקילה היום }
        </button>
        <button type="button" class="chip" (click)="checkin.show()"><svg lucideMoon [size]="16"></svg> סגירת יום</button>
      </div>

      <section class="hero">
        <div class="muted small">נשאר לאכול</div>
        <div class="big">
          <span class="num" [class.over]="s.remainingKcal < 0">{{ fmt(s.remainingKcal) }}</span>
          <span class="of">מתוך <span class="num">{{ fmt(s.targetKcal) }}</span></span>
        </div>
        <p class="alert reality" [class]="reality().tone">{{ reality().text }}</p>
      </section>

      @if (staleHours(); as h) {
        <div class="alert warning row">
          <span>סנכרון Garmin אחרון לפני <span class="num">{{ h }}</span> שעות</span>
          <button type="button" (click)="checkin.show()">הזנה ידנית</button>
        </div>
      }
      @for (w of s.warnings; track $index) {
        <div class="alert warning">{{ warningText(w) }}</div>
      }

      <section class="bars">
        <app-bullet-bar label="קלוריות" [value]="s.intake.kcal" [target]="s.targetKcal" [max]="s.macros.kcal.max" tone="out" />
        <app-bullet-bar label="חלבון" unit="g" [value]="s.intake.protein" [target]="s.macros.protein.target" [max]="s.macros.protein.max" tone="in" />
        <app-bullet-bar label="פחמימות" unit="g" [value]="s.intake.carbs" [target]="s.macros.carbs.target" [max]="s.macros.carbs.max" tone="in" />
        <app-bullet-bar label="שומן" unit="g" [value]="s.intake.fat" [target]="s.macros.fat.target" [max]="s.macros.fat.max" tone="in" />
        @if (s.intake.kcalWithoutMacros > 0) {
          <p class="muted small"><span class="num">{{ fmt(s.intake.kcalWithoutMacros) }}</span> קל׳ בלי פירוט מאקרו</p>
        }
      </section>

      @if (breakdown(); as b) {
        <app-target-card [breakdown]="b" />
      }

      <ul class="entries">
        @for (e of s.entries; track e.id) {
          <li>
            <button type="button" class="entry" (click)="quickAdd.edit(e)">
              <span class="muted num">{{ e.time }}</span>
              <span class="name">{{ e.name }}</span>
              <span class="num">{{ fmt(e.kcal) }}</span>
            </button>
          </li>
        } @empty {
          <li class="muted small">עוד לא נרשם כלום היום</li>
        }
      </ul>

      <button type="button" class="fab primary" aria-label="הוספה" (click)="quickAdd.open('meal')"><svg lucidePlus [size]="22"></svg></button>
    }
  `,
  styles: `
    :host { display: block; padding-block-end: 72px; } /* keep the last entry clear of the FAB */
    .hero { text-align: center; padding: 16px 0 8px; }
    .big { display: flex; justify-content: center; align-items: baseline; gap: 8px; font-size: 34px; font-weight: 500; }
    .big .over { color: var(--danger); }
    .of { font-size: 20px; font-weight: 400; color: var(--fg-muted); }
    .bars { margin-block: 12px; }
    .top { margin-block: 8px; }
    .chip { min-height: 44px; border-radius: 999px; padding: 0 12px; display: inline-flex; gap: 6px; align-items: center; }
    .chip.missing { border-color: var(--primary); color: var(--primary); }
    .reality { margin-block: 8px 0; }
    .entries { list-style: none; margin: 12px 0 0; padding: 0; border-block-start: 1px solid var(--border); }
    .entry { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; width: 100%; border: none;
      border-block-end: 1px solid var(--border); border-radius: 0; background: none; text-align: start; }
    .fab { position: fixed; inset-inline-end: 16px; inset-block-end: calc(80px + env(safe-area-inset-bottom));
      width: 56px; height: 56px; border-radius: 50%; padding: 0; display: grid; place-items: center; z-index: 4; }
  `,
})
export class Today {
  private readonly state = inject(KalState);
  protected readonly quickAdd = inject(QuickAddService);
  protected readonly fmt = fmt;
  protected readonly warningText = warningText;
  protected readonly summary = this.state.todaySummary;
  protected readonly staleHours = computed(() => staleSyncHours(this.state.profile()?.garminLastSyncAt, this.state.now()));
  protected readonly checkin = inject(CheckInService);
  protected readonly weighIn = this.state.todayWeighIn;
  protected readonly reality = computed(() => realityLine(this.state.reality()));
  protected readonly breakdown = computed(() => {
    const s = this.summary();
    const profile = this.state.profile();
    const goal = this.state.goal();
    return s && profile && goal ? targetBreakdown(s, settingsOf(profile).defaultSteps, goal.paceKgPerWeek) : null;
  });

  constructor() {
    effect(() => {
      const today = this.state.today();
      const day = this.state.todayDay();
      if (this.checkin.open()) {
        // A sheet that opened by itself goes away once the day turns out to be checked in (e.g. on another device).
        if (this.checkin.auto() && day?.checkedInAt) this.checkin.close();
      } else if (shouldPromptCheckIn(this.state.now(), day, this.checkin.dismissedFor() === today)) {
        this.checkin.show(true);
      }
    });
  }
}
