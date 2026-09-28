import { Component, computed, inject } from '@angular/core';
import { LucidePlus } from '@lucide/angular';
import { KalState } from '../../core/kal-state';
import { BulletBar } from '../../shared/bullet-bar';
import { fmt, warningText } from '../../shared/format';
import { QuickAddService } from './quick-add.service';
import { breakdownText, staleSyncHours } from './today.logic';

@Component({
  selector: 'app-today',
  imports: [BulletBar, LucidePlus],
  template: `
    @if (summary(); as s) {
      <section class="hero">
        <div class="muted small">נשאר לאכול</div>
        <div class="big num" [class.over]="s.remainingKcal < 0">{{ fmt(s.remainingKcal) }}</div>
        <div class="muted small">
          יעד <span class="num">{{ fmt(s.targetKcal) }}</span> = יצא <span class="num">{{ fmt(s.expenditure.out) }}</span>
          − גירעון <span class="num">{{ fmt(s.deficitKcal) }}</span>
        </div>
      </section>

      @if (staleHours(); as h) {
        <div class="alert warning row">
          <span>סנכרון Garmin אחרון לפני <span class="num">{{ h }}</span> שעות</span>
          <button type="button" (click)="quickAdd.open('activity')">הזנה ידנית</button>
        </div>
      }
      @for (w of s.warnings; track $index) {
        <div class="alert warning">{{ warningText(w) }}</div>
      }

      <section class="bars">
        <app-bullet-bar label="קלוריות" [value]="s.intake.kcal" [target]="s.targetKcal" [max]="s.macros.kcal.max" tone="out" />
        <app-bullet-bar label="חלבון" unit="g" [value]="s.intake.protein" [target]="s.macros.protein.target" [max]="s.macros.protein.max" tone="in" />
        <app-bullet-bar label="פחמימות" unit="g" [value]="s.intake.carbs" [max]="s.macros.carbs.max" />
        <app-bullet-bar label="שומן" unit="g" [value]="s.intake.fat" [max]="s.macros.fat.max" />
        @if (s.intake.kcalWithoutMacros > 0) {
          <p class="muted small"><span class="num">{{ fmt(s.intake.kcalWithoutMacros) }}</span> קל׳ בלי פירוט מאקרו</p>
        }
      </section>

      <p class="breakdown muted small">{{ breakdown() }}</p>

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
    .big { font-size: 34px; font-weight: 500; color: var(--out); }
    .big.over { color: var(--danger); }
    .bars { margin-block: 12px; }
    .breakdown { background: var(--card); border-radius: var(--radius); padding: 6px 8px; }
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
  protected readonly breakdown = computed(() => {
    const s = this.summary();
    return s ? breakdownText(s) : '';
  });
  protected readonly staleHours = computed(() => staleSyncHours(this.state.profile()?.garminLastSyncAt, this.state.now()));
}
