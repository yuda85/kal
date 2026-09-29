import { Component, computed, inject, viewChild, type AfterViewInit, type ElementRef } from '@angular/core';
import { LucideArrowLeft, LucideLightbulb, LucideStar } from '@lucide/angular';
import { TOPIC_LABEL } from '../../domain';
import { DailyTipService } from './daily-tip.service';
import { reasonText } from './tips.logic';

@Component({
  selector: 'app-daily-tip',
  imports: [LucideArrowLeft, LucideLightbulb, LucideStar],
  template: `
    @if (daily.pick(); as p) {
      <div class="scrim"></div>
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="daily-tip-title">
        <div class="kicker"><svg lucideLightbulb [size]="16" aria-hidden="true"></svg>טיפ היום · {{ topicLabel[p.tip.topic] }}</div>
        @if (p.reason; as r) {
          <p class="why">{{ reason(r) }}</p>
        }
        <h2 id="daily-tip-title">{{ p.tip.title }}</h2>
        <p class="body">{{ p.tip.body }}</p>
        @if (p.tip.action; as action) {
          <p class="action"><svg lucideArrowLeft [size]="16" aria-hidden="true"></svg>היום: {{ action }}</p>
        }
        <div class="actions">
          <button type="button" class="star" [class.on]="starred()" [attr.aria-pressed]="starred()" (click)="daily.toggleStar(p.tip.id)">
            <svg lucideStar [size]="18" [attr.fill]="starred() ? 'currentColor' : 'none'" aria-hidden="true"></svg>{{ starred() ? 'שמור' : 'לשמור' }}
          </button>
          <button #ok type="button" class="primary" (click)="daily.close()">הבנתי</button>
        </div>
      </section>
    }
  `,
  styles: `
    .scrim { position: fixed; inset: 0; background: rgb(0 0 0 / 0.6); z-index: 10; }
    .dialog {
      position: fixed; z-index: 11; inset-inline: 16px; top: 50%; transform: translateY(-50%);
      max-width: 448px; margin-inline: auto; max-height: calc(100dvh - 48px); overflow-y: auto;
      background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 20px;
    }
    .kicker { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--fg-muted); margin-bottom: 12px; }
    .why { display: inline-block; margin: 0 0 12px; padding: 4px 10px; border-radius: 999px; font-size: 13px; background: var(--missing-bg); color: var(--missing-fg); }
    h2 { font-size: 20px; font-weight: 600; line-height: 1.35; margin: 0 0 8px; }
    .body { margin: 0 0 10px; line-height: 1.6; }
    .action { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 14px; font-weight: 500; color: var(--out); }
    .action svg { flex: none; }
    .actions { display: flex; gap: 8px; margin-top: 20px; }
    .actions button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
    .star.on { color: var(--star); }
    @media (prefers-reduced-motion: no-preference) {
      .dialog { animation: rise 200ms ease-out; }
      .scrim { animation: fade 200ms ease-out; }
    }
    @keyframes rise { from { opacity: 0; transform: translateY(calc(-50% + 12px)); } }
    @keyframes fade { from { opacity: 0; } }
  `,
})
export class DailyTip implements AfterViewInit {
  protected readonly daily = inject(DailyTipService);
  protected readonly topicLabel = TOPIC_LABEL;
  protected readonly reason = reasonText;
  private readonly ok = viewChild<ElementRef<HTMLButtonElement>>('ok');
  protected readonly starred = computed(() => {
    const p = this.daily.pick();
    return p ? this.daily.starred().includes(p.tip.id) : false;
  });

  ngAfterViewInit(): void {
    this.ok()?.nativeElement.focus();
  }
}
