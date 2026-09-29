import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Toast } from '../../core/toast';
import { addDays, closeDailyTip, pickDailyTip, tipReason, toggleStar, type TipState } from '../../domain';

@Injectable({ providedIn: 'root' })
export class DailyTipService {
  private readonly state = inject(KalState);
  private readonly repo = inject(KalRepository);
  private readonly toast = inject(Toast);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Today's tip while it has not been closed yet; null otherwise (including on the confirm screen). */
  readonly pick = computed(() => {
    const tips = this.state.tipState();
    const goal = this.state.goal();
    if (!tips || !goal || !this.state.profile()) return null;
    const today = this.state.today();
    if (tips.lastDate === today || this.url().startsWith('/confirm')) return null;
    const yesterday = addDays(today, -1);
    return pickDailyTip(tips, tipReason(yesterday >= goal.startDate ? this.state.dayFor(yesterday) : null));
  });

  readonly starred = computed(() => this.state.tipState()?.starred ?? []);

  close(): void {
    const tips = this.state.tipState();
    const pick = this.pick();
    if (!tips || !pick) return;
    this.save(closeDailyTip(tips, pick, this.state.today()));
  }

  toggleStar(id: string): void {
    const tips = this.state.tipState();
    if (tips) this.save(toggleStar(tips, id));
  }

  private save(next: TipState): void {
    const uid = this.state.uid();
    if (!uid) return;
    this.state.tipState.set(next);
    this.repo.saveTipState(uid, next).catch(() => this.toast.show('השמירה נכשלה'));
  }
}
