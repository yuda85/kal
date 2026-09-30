import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Toast } from '../../core/toast';
import { dueCelebrations, earnedCelebrations, type Celebration } from '../../domain';
import { DailyTipService } from '../tips/daily-tip.service';

@Injectable({ providedIn: 'root' })
export class CelebrationService {
  private readonly state = inject(KalState);
  private readonly repo = inject(KalRepository);
  private readonly toast = inject(Toast);
  private readonly dailyTip = inject(DailyTipService);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Everything earned now; null until every source and the celebrations document have arrived. */
  private readonly earned = computed(() => {
    const a = this.state.achievements();
    const goal = this.state.goal();
    if (!a || !goal || !this.state.loaded() || !this.state.entriesLoaded() || this.state.celebrationState() === undefined) return null;
    return earnedCelebrations(a, goal.id, this.state.today());
  });

  /** §19: shown after the daily tip, never on the confirm screen. */
  readonly due = computed<Celebration[]>(() => {
    const earned = this.earned();
    const doc = this.state.celebrationState();
    if (!earned || !doc || this.dailyTip.pick() || this.url().startsWith('/confirm')) return [];
    return dueCelebrations(earned, doc.seen);
  });

  constructor() {
    // First run: what is already earned counts as seen, so the update does not open a flood of dialogs.
    effect(() => {
      const earned = this.earned();
      if (earned && this.state.celebrationState() === null) untracked(() => this.save(earned.map((c) => c.key)));
    });
  }

  close(): void {
    const earned = this.earned();
    const doc = this.state.celebrationState();
    if (!earned || !doc) return;
    this.save([...new Set([...doc.seen, ...earned.map((c) => c.key)])]);
  }

  private save(seen: string[]): void {
    const uid = this.state.uid();
    if (!uid) return;
    const next = { seen };
    this.state.celebrationState.set(next);
    this.repo.saveCelebrations(uid, next).catch(() => this.toast.show('השמירה נכשלה'));
  }
}
