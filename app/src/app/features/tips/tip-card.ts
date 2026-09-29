import { Component, input, output } from '@angular/core';
import { LucideArrowLeft, LucideStar } from '@lucide/angular';
import { TOPIC_LABEL, type Tip } from '../../domain';

@Component({
  selector: 'app-tip-card',
  imports: [LucideArrowLeft, LucideStar],
  template: `
    <article class="card tip">
      <div class="head">
        <div class="text">
          @if (showTopic()) {
            <div class="topic">{{ topicLabel[tip().topic] }}</div>
          }
          <h3>{{ tip().title }}</h3>
        </div>
        <button type="button" class="star" [class.on]="starred()" [attr.aria-pressed]="starred()"
          [attr.aria-label]="starred() ? 'הסר משמורים' : 'סמן כשמור'" (click)="toggle.emit()">
          <svg lucideStar [size]="20" [attr.fill]="starred() ? 'currentColor' : 'none'"></svg>
        </button>
      </div>
      <p>{{ tip().body }}</p>
      @if (tip().action; as action) {
        <p class="action"><svg lucideArrowLeft [size]="16" aria-hidden="true"></svg>{{ action }}</p>
      }
    </article>
  `,
  styles: `
    .tip { display: grid; gap: 6px; padding: 14px 16px; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .text { min-width: 0; }
    .topic { font-size: 12px; color: var(--fg-muted); margin-bottom: 2px; }
    h3 { font-size: 16px; font-weight: 600; line-height: 1.4; margin: 0; }
    p { margin: 0; line-height: 1.6; }
    .action { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500; color: var(--out); }
    .action svg { flex: none; }
    .star { flex: none; border: none; background: none; padding: 0; margin-block-start: -10px; margin-inline-end: -12px; color: var(--fg-muted); }
    .star.on { color: var(--star); }
  `,
})
export class TipCard {
  readonly tip = input.required<Tip>();
  readonly starred = input(false);
  readonly showTopic = input(false);
  readonly toggle = output<void>();
  protected readonly topicLabel = TOPIC_LABEL;
}
