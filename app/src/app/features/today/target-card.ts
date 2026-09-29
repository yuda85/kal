import { Component, input } from '@angular/core';
import { fmt, signed } from '../../shared/format';
import type { TargetBreakdown } from './today.logic';

@Component({
  selector: 'app-target-card',
  template: `
    @let b = breakdown();
    <h2>איך נבנה היעד היום</h2>
    <p class="sr-only">{{ b.summary }}</p>
    <div class="eq" [class.four]="b.clamp !== 0" aria-hidden="true">
      <div class="term"><span class="v num">{{ fmt(b.burn) }}</span><span class="l">שורף היום</span></div>
      <span class="op">−</span>
      <div class="term"><span class="v num">{{ fmt(b.deficit) }}</span><span class="l">גירעון</span><span class="l">{{ b.pace }}</span></div>
      @if (b.clamp !== 0) {
        <span class="op">{{ b.clamp > 0 ? '+' : '−' }}</span>
        <div class="term"><span class="v num">{{ fmt(abs(b.clamp)) }}</span><span class="l">{{ b.clampLabel }}</span></div>
      }
      <span class="op">=</span>
      <div class="term total"><span class="v num">{{ fmt(b.target) }}</span><span class="l">יעד לאכילה</span></div>
    </div>
    <div class="sub">ממה מורכבת השריפה</div>
    <dl>
      @for (l of b.lines; track $index) {
        <div class="line">
          <dt>{{ l.label }} <span class="note">· {{ l.note }}</span></dt>
          <dd class="num" [class.zero]="l.kcal === 0">{{ $first ? fmt(l.kcal) : signed(l.kcal) }}</dd>
        </div>
      }
    </dl>
  `,
  styles: `
    :host { display: block; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-card); padding: 12px 16px; }
    h2 { font-size: 15px; margin: 0 0 12px; }
    .eq { display: flex; align-items: flex-start; }
    .term { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .v { font-size: 22px; font-weight: 500; line-height: 32px; }
    .four .v { font-size: 19px; }
    .total .v { font-weight: 700; }
    .l { font-size: 12px; color: var(--fg-muted); line-height: 1.4; }
    .op { flex: none; font-size: 20px; line-height: 32px; color: var(--fg-muted); padding-inline: 2px; }
    .sub { font-size: 12px; color: var(--fg-muted); border-block-start: 1px solid var(--border); margin-block-start: 12px; padding-block-start: 8px; }
    dl { margin: 0; }
    .line { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-block: 5px; }
    .note { color: var(--fg-muted); font-size: 13px; }
    dd { margin: 0; }
    dd.zero { color: var(--fg-muted); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  `,
})
export class TargetCard {
  readonly breakdown = input.required<TargetBreakdown>();
  protected readonly fmt = fmt;
  protected readonly signed = signed;
  protected readonly abs = Math.abs;
}
