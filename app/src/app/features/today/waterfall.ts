import { Component, computed, input } from '@angular/core';
import { fmt } from '../../shared/format';
import type { WaterfallRow } from './today.logic';

@Component({
  selector: 'app-waterfall',
  template: `
    <div class="muted small title">איך נבנה היעד היום</div>
    @for (r of layout(); track $index) {
      <div class="line" [class.total]="r.kind === 'total'">
        <span class="label">{{ r.label }}@if (r.note) { <span class="muted"> ({{ r.note }})</span> }</span>
        <span class="track"><i [class]="r.kind" [style.inset-inline-start.%]="r.start" [style.width.%]="r.width"></i></span>
        <span class="num value">{{ r.kind === 'plus' ? '+' : '' }}{{ fmt(r.value) }}</span>
      </div>
    }
  `,
  styles: `
    :host { display: block; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-card); padding: 10px 12px; }
    .title { margin-block-end: 6px; }
    .line { display: grid; grid-template-columns: 96px 1fr 56px; align-items: center; gap: 6px; font-size: 12px; min-height: 22px; }
    .line.total { border-block-start: 1px solid var(--border); padding-block-start: 4px; font-weight: 500; }
    .track { position: relative; height: 12px; }
    .track i { position: absolute; inset-block: 0; border-radius: 3px; }
    .track i.base { background: var(--neutral-bar); }
    .track i.plus { background: var(--out); }
    .track i.minus { background: var(--in); }
    .track i.total { background: var(--primary); }
    .value { text-align: end; }
  `,
})
export class Waterfall {
  readonly rows = input.required<WaterfallRow[]>();
  protected readonly fmt = fmt;

  protected readonly layout = computed(() => {
    const rows = this.rows();
    let running = 0;
    let peak = 1;
    const spans = rows.map((r) => {
      if (r.kind === 'base' || r.kind === 'total') {
        running = r.value;
        peak = Math.max(peak, r.value);
        return { ...r, from: 0, to: r.value };
      }
      const from = running;
      running += r.value;
      peak = Math.max(peak, from, running);
      return { ...r, from: Math.min(from, running), to: Math.max(from, running) };
    });
    return spans.map((s) => ({ ...s, start: (s.from / peak) * 100, width: Math.max(1, ((s.to - s.from) / peak) * 100) }));
  });
}
