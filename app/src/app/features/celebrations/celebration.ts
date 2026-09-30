import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, viewChild, type AfterViewInit, type ElementRef } from '@angular/core';
import { LucideFlag, LucideFlame, LucideFootprints, LucideSparkles, LucideTrophy } from '@lucide/angular';
import { CelebrationService } from './celebration.service';
import { celebrationText } from './celebration.logic';

@Component({
  selector: 'app-celebration',
  imports: [LucideFlag, LucideFlame, LucideFootprints, LucideSparkles, LucideTrophy, NgTemplateOutlet],
  host: { '(document:keydown.escape)': 'celebrate.close()' },
  template: `
    @if (celebrate.due(); as items) {
      @if (items.length > 0) {
        <div class="scrim"></div>
        <div class="confetti" aria-hidden="true">
          @for (i of pieces; track i) { <i [style.--a]="i * 22.5 + 'deg'"></i> }
        </div>
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="celebration-title">
          @if (items.length === 1) {
            <div class="icon" [class]="items[0].kind">
              @switch (items[0].kind) {
                @case ('streak') { <svg lucideFlame [size]="32" aria-hidden="true"></svg> }
                @case ('week') { <svg lucideSparkles [size]="32" aria-hidden="true"></svg> }
                @case ('weight') { <svg lucideFlag [size]="32" aria-hidden="true"></svg> }
                @case ('steps-week') { <svg lucideTrophy [size]="32" aria-hidden="true"></svg> }
                @default { <svg lucideFootprints [size]="32" aria-hidden="true"></svg> }
              }
            </div>
            <h2 id="celebration-title"><ng-container *ngTemplateOutlet="segs; context: { $implicit: text(items[0]).title }"></ng-container></h2>
            <p class="line"><ng-container *ngTemplateOutlet="segs; context: { $implicit: text(items[0]).line }"></ng-container></p>
          } @else {
            <h2 id="celebration-title">כמה הישגים חדשים</h2>
            <ul class="list">
              @for (c of items; track c.key) {
                <li>
                  <b><ng-container *ngTemplateOutlet="segs; context: { $implicit: text(c).title }"></ng-container></b>
                  <span class="muted"><ng-container *ngTemplateOutlet="segs; context: { $implicit: text(c).line }"></ng-container></span>
                </li>
              }
            </ul>
          }
          <button #ok type="button" class="primary" (click)="celebrate.close()">יאללה</button>
        </section>
      }
    }
    <ng-template #segs let-list>
      @for (s of list; track $index) {@if (s.num) {<span class="num">{{ s.text }}</span>} @else {{{ s.text }}}}
    </ng-template>
  `,
  styles: `
    .scrim { position: fixed; inset: 0; background: rgb(0 0 0 / 0.6); z-index: 10; }
    .dialog {
      position: fixed; z-index: 11; inset-inline: 16px; top: 50%; transform: translateY(-50%);
      max-width: 400px; margin-inline: auto; max-height: calc(100dvh - 48px); overflow-y: auto; text-align: center;
      background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 24px 20px 20px;
    }
    .icon { width: 64px; height: 64px; margin: 0 auto 12px; border-radius: 50%; display: grid; place-items: center; color: var(--on-primary); background: var(--out); }
    .icon.streak { background: var(--in); }
    .icon.week, .icon.steps-week { background: var(--great); }
    h2 { font-size: 22px; font-weight: 700; margin: 0 0 6px; }
    .line { margin: 0 0 20px; color: var(--fg-muted); line-height: 1.6; }
    .list { list-style: none; margin: 0 0 20px; padding: 0; text-align: start; display: grid; gap: 10px; }
    .list li { display: grid; }
    .list .muted { font-size: 13px; }
    button { width: 100%; }
    .confetti { position: fixed; z-index: 12; top: 40%; left: 50%; width: 0; height: 0; pointer-events: none; }
    .confetti i { position: absolute; width: 6px; height: 10px; border-radius: 2px; opacity: 0; background: var(--out); }
    .confetti i:nth-child(4n + 1) { background: var(--great); }
    .confetti i:nth-child(4n + 2) { background: var(--in); }
    .confetti i:nth-child(4n + 3) { background: var(--star); }
    /* §19: a short burst, a recorded exception to the 150–250 ms motion rule; none under reduced motion. */
    @media (prefers-reduced-motion: no-preference) {
      .confetti i { animation: burst 900ms ease-out forwards; }
      .dialog { animation: rise 200ms ease-out; }
    }
    @keyframes burst {
      from { opacity: 1; transform: translate(0, 0) rotate(0); }
      to { opacity: 0; transform: translate(calc(cos(var(--a)) * 140px), calc(sin(var(--a)) * 140px + 80px)) rotate(540deg); }
    }
    @keyframes rise { from { opacity: 0; transform: translateY(calc(-50% + 12px)); } }
  `,
})
export class CelebrationDialog implements AfterViewInit {
  protected readonly celebrate = inject(CelebrationService);
  protected readonly text = celebrationText;
  protected readonly pieces = Array.from({ length: 16 }, (_, i) => i);
  private readonly ok = viewChild<ElementRef<HTMLButtonElement>>('ok');

  ngAfterViewInit(): void {
    this.ok()?.nativeElement.focus();
  }
}
