import { Component, computed, input } from '@angular/core';
import { fmt } from './format';

@Component({
  selector: 'app-bullet-bar',
  template: `
    <div class="row head"><span>{{ label() }}</span><span class="num">{{ text() }}</span></div>
    <div class="track">
      <i class="fill" [class]="tone()" [class.over]="over()" [style.width.%]="pct()"></i>
      @if (markerPct() !== null) {
        <i class="marker" [style.inset-inline-start.%]="markerPct()"></i>
      }
    </div>
  `,
  styles: `
    :host { display: block; margin-block-end: 10px; }
    .head { font-size: 13px; margin-block-end: 4px; }
    .track { position: relative; height: 8px; background: var(--border); border-radius: 4px; }
    .fill { position: absolute; inset-block: 0; inset-inline-start: 0; border-radius: 4px; background: var(--neutral-bar); }
    .fill.out { background: var(--out); }
    .fill.in { background: var(--in); }
    .fill.over { background: var(--danger); }
    .marker { position: absolute; inset-block: -3px; width: 2px; background: var(--fg); }
  `,
})
export class BulletBar {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly target = input<number | null>(null);
  readonly max = input<number | null>(null);
  readonly unit = input<'' | 'g'>('');
  readonly tone = input<'out' | 'in' | 'neutral'>('neutral');

  private readonly scale = computed(() => Math.max(this.target() ?? 0, this.max() ?? 0, this.value(), 1));
  protected readonly pct = computed(() => Math.min(100, (this.value() / this.scale()) * 100));
  protected readonly markerPct = computed(() => {
    const max = this.max();
    return max === null ? null : (max / this.scale()) * 100;
  });
  protected readonly over = computed(() => {
    const max = this.max();
    return max !== null && this.value() > max;
  });
  protected readonly text = computed(() => {
    const u = this.unit();
    const limit = this.target() ?? this.max();
    const value = `${fmt(this.value())}${u}`;
    return limit === null ? value : `${value} / ${fmt(limit)}${u}`;
  });
}
