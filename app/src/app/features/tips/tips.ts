import { Component, computed, inject, signal } from '@angular/core';
import { LucideExternalLink, LucidePlay, LucideTrash2 } from '@lucide/angular';
import { KalState } from '../../core/kal-state';
import { KalRepository, type SavedVideo } from '../../core/repository';
import { Toast } from '../../core/toast';
import { localDate, TOPIC_LABEL, videoPlatform } from '../../domain';
import { shortDate } from '../../shared/format';
import { DailyTipService } from './daily-tip.service';
import { TipCard } from './tip-card';
import { FILTERS, tipSections, type TipFilter } from './tips.logic';

@Component({
  selector: 'app-tips',
  imports: [TipCard, LucideExternalLink, LucidePlay, LucideTrash2],
  template: `
    <div class="chips" role="tablist" aria-label="סינון טיפים">
      @for (f of filters; track f.key) {
        <button type="button" role="tab" class="chip" [class.on]="filter() === f.key" [attr.aria-selected]="filter() === f.key" (click)="filter.set(f.key)">
          {{ f.label }}@if (f.key === 'videos' && videoCount() > 0) { <span class="count num">{{ videoCount() }}</span> }
        </button>
      }
    </div>

    @for (s of sections(); track s.key) {
      <section class="section">
        <h2>{{ s.title }}</h2>
        <div class="list">
          @for (t of s.tips; track t.id) {
            <app-tip-card [tip]="t" [starred]="starred().includes(t.id)" [showTopic]="s.key === 'starred'" (toggle)="daily.toggleStar(t.id)" />
          }
          @for (v of s.videos; track v.id) {
            <article class="card video">
              <div class="play" aria-hidden="true"><svg lucidePlay [size]="20"></svg></div>
              <div class="info">
                <h3>{{ v.title }}</h3>
                <div class="muted small">{{ platform(v.url) }} · <span class="num">{{ added(v) }}</span>@if (filter() === 'videos') { · {{ topicLabel[v.topic] }} }</div>
                <blockquote>{{ v.take }}</blockquote>
                <div class="row actions">
                  <a class="watch" [href]="v.url" target="_blank" rel="noopener noreferrer"><svg lucideExternalLink [size]="16" aria-hidden="true"></svg>צפייה</a>
                  <button type="button" class="icon" [attr.aria-label]="'מחיקת הסרטון ' + v.title" (click)="remove(v)"><svg lucideTrash2 [size]="18"></svg></button>
                </div>
              </div>
            </article>
          }
        </div>
      </section>
    } @empty {
      <p class="card empty muted">
        @if (filter() === 'starred') {
          עוד לא שמרת טיפים. לחיצה על הכוכב בכרטיס מצמידה אותו לכאן.
        } @else {
          שלח לי בצ'אט קישור לסרטון והטייק שלך, ואני אוסיף אותו כאן.
        }
      </p>
    }
  `,
  styles: `
    .chips {
      display: flex; gap: 8px; overflow-x: auto; margin: 4px -16px 8px; padding: 4px 16px;
      scrollbar-width: none; overscroll-behavior-x: contain;
    }
    .chips::-webkit-scrollbar { display: none; }
    .chip { flex: none; min-height: 36px; border-radius: 999px; padding: 0 14px; font-size: 14px; position: relative; }
    .chip::after { content: ''; position: absolute; inset: -4px 0; }
    .chip.on { background: var(--primary); color: var(--on-primary); border-color: transparent; font-weight: 500; }
    .count { margin-inline-start: 4px; font-size: 12px; opacity: 0.8; }
    .section { margin-block: 16px 24px; }
    h2 { font-size: 15px; font-weight: 500; color: var(--fg-muted); margin: 0 0 8px; }
    .list { display: grid; gap: 10px; }
    .video { display: flex; gap: 12px; padding: 14px 16px; }
    .play { flex: none; width: 48px; height: 64px; border-radius: var(--radius); background: var(--border); display: grid; place-items: center; color: var(--fg); }
    .info { flex: 1; min-width: 0; display: grid; gap: 4px; }
    h3 { font-size: 16px; font-weight: 600; line-height: 1.4; margin: 0; }
    blockquote { margin: 4px 0 0; padding-inline-start: 10px; border-inline-start: 3px solid var(--out); line-height: 1.6; }
    .actions { justify-content: flex-start; margin-top: 4px; }
    .watch { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; margin-inline-start: -12px; font-weight: 500; color: var(--out); text-decoration: none; }
    .icon { border: none; background: none; padding: 0; color: var(--fg-muted); margin-inline-start: auto; }
    .empty { margin-top: 16px; line-height: 1.6; }
  `,
})
export class Tips {
  private readonly state = inject(KalState);
  private readonly repo = inject(KalRepository);
  private readonly toast = inject(Toast);
  protected readonly daily = inject(DailyTipService);
  protected readonly filters = FILTERS;
  protected readonly topicLabel = TOPIC_LABEL;
  protected readonly platform = videoPlatform;
  protected readonly filter = signal<TipFilter>('all');
  protected readonly starred = this.daily.starred;
  protected readonly videoCount = computed(() => this.state.videos().length);
  protected readonly sections = computed(() => tipSections(this.filter(), this.starred(), this.state.videos()));

  protected added(v: { addedAt: string }): string {
    return shortDate(localDate(new Date(v.addedAt)));
  }

  protected remove(v: SavedVideo): void {
    const uid = this.state.uid();
    if (!uid || !confirm(`למחוק את הסרטון "${v.title}"?`)) return;
    this.repo.deleteVideo(uid, v.id).catch(() => this.toast.show('המחיקה נכשלה'));
  }
}
