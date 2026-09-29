import { computed, inject, Injectable, signal } from '@angular/core';
import {
  addDays,
  dateRange,
  localDate,
  realityCheck,
  REALITY_WINDOW_DAYS,
  summarizeDay,
  type Day,
  type DayEnergy,
  type DaySummary,
  type Entry,
  type Goal,
  type Profile,
  type Reality,
  type Recipe,
  type TipState,
  type WeighIn,
} from '../domain';
import { KalRepository, type SavedVideo, type Unsubscribe } from './repository';

export const ENTRY_WINDOW_DAYS = 90;

@Injectable({ providedIn: 'root' })
export class KalState {
  private readonly repo = inject(KalRepository);
  private unsubscribers: Unsubscribe[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private loaded: Promise<void> = Promise.resolve();
  // Timers are suspended while a phone app sits in the background; refresh the clock on return.
  private readonly onForeground = () => {
    if (document.visibilityState === 'visible') this.refreshNow();
  };

  readonly uid = signal<string | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly goals = signal<Goal[]>([]);
  readonly entries = signal<Entry[]>([]);
  readonly days = signal<Day[]>([]);
  readonly weighIns = signal<WeighIn[]>([]);
  readonly recipes = signal<Recipe[]>([]);
  /** `undefined` until the tips document arrives. */
  readonly tipState = signal<TipState | undefined>(undefined);
  readonly videos = signal<SavedVideo[]>([]);
  readonly now = signal(new Date());

  readonly today = computed(() => localDate(this.now()));
  readonly goal = computed(() => {
    const goals = this.goals();
    return goals.find((g) => g.id === this.profile()?.activeGoalId) ?? goals.find((g) => g.active) ?? null;
  });
  readonly todaySummary = computed(() => this.dayFor(this.today()));
  readonly todayDay = computed(() => this.days().find((d) => d.date === this.today()));
  readonly todayWeighIn = computed(() => this.weighIns().find((w) => w.date === this.today()));
  /** The finished days of the reality window, with the missing-day penalty applied. */
  readonly recentEnergy = computed<DayEnergy[]>(() => {
    if (!this.goal() || !this.profile()) return [];
    const today = this.today();
    return dateRange(addDays(today, -REALITY_WINDOW_DAYS), addDays(today, -1)).map((date) => {
      const s = this.dayFor(date)!;
      return { date, inKcal: s.countedKcal, outKcal: s.expenditure.out };
    });
  });
  readonly reality = computed<Reality | null>(() => {
    const goal = this.goal();
    if (!goal || !this.profile()) return null;
    return realityCheck({ today: this.today(), goal, weighIns: this.weighIns(), energy: this.recentEnergy() });
  });

  start(uid: string): void {
    if (this.uid() === uid) return;
    this.stop();
    this.uid.set(uid);
    let pending = 4;
    let resolve!: () => void;
    this.loaded = new Promise<void>((r) => (resolve = r));
    const once = () => {
      let done = false;
      return () => {
        if (done) return;
        done = true;
        pending -= 1;
        if (pending === 0) resolve();
      };
    };
    const profileArrived = once();
    const goalsArrived = once();
    const daysArrived = once();
    const weighInsArrived = once();
    const from = addDays(this.today(), -ENTRY_WINDOW_DAYS);
    this.unsubscribers = [
      this.repo.watchProfile(uid, (p) => {
        this.profile.set(p);
        profileArrived();
      }),
      this.repo.watchGoals(uid, (g) => {
        this.goals.set(g);
        goalsArrived();
      }),
      this.repo.watchEntries(uid, from, (e) => this.entries.set(e)),
      this.repo.watchDays(uid, (d) => {
        this.days.set(d);
        daysArrived();
      }),
      this.repo.watchWeighIns(uid, (w) => {
        this.weighIns.set(w);
        weighInsArrived();
      }),
      this.repo.watchRecipes(uid, (r) => this.recipes.set(r)),
      this.repo.watchTipState(uid, (t) => this.tipState.set(t)),
      this.repo.watchVideos(uid, (v) => this.videos.set(v)),
    ];
    this.timer = setInterval(() => this.refreshNow(), 60_000);
    document.addEventListener('visibilitychange', this.onForeground);
    addEventListener('pageshow', this.onForeground);
  }

  refreshNow(): void {
    this.now.set(new Date());
  }

  stop(): void {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
    clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onForeground);
    removeEventListener('pageshow', this.onForeground);
    this.uid.set(null);
    this.profile.set(null);
    this.goals.set([]);
    this.entries.set([]);
    this.days.set([]);
    this.weighIns.set([]);
    this.recipes.set([]);
    this.tipState.set(undefined);
    this.videos.set([]);
  }

  whenLoaded(): Promise<void> {
    return this.loaded;
  }

  dayFor(date: string, overrides: { entries?: Entry[]; weighIns?: WeighIn[]; days?: Day[] } = {}): DaySummary | null {
    const profile = this.profile();
    const goal = this.goal();
    if (!profile || !goal) return null;
    return summarizeDay({
      date,
      today: this.today(),
      entries: overrides.entries ?? this.entries(),
      day: (overrides.days ?? this.days()).find((d) => d.date === date),
      profile,
      goal,
      weighIns: overrides.weighIns ?? this.weighIns(),
    });
  }
}
