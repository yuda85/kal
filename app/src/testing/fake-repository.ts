import { FISH_BALLS, testGoal, testProfile } from '../../../domain/testing.ts';
import { EMPTY_TIP_STATE, type Day, type Entry, type Goal, type PlannedWrites, type Profile, type Recipe, type TipState, type WeighIn } from '../app/domain';
import { KalRepository, type SavedVideo, type SetupWrite, type Unsubscribe } from '../app/core/repository';

export const NOW = new Date('2026-09-27T10:00:00Z');

export class FakeRepository extends KalRepository {
  profile: Profile | null = null;
  goals: Goal[] = [];
  entries: Entry[] = [];
  days: Day[] = [];
  weighIns: WeighIn[] = [];
  recipes: Recipe[] = [];
  applied: { uid: string; writes: PlannedWrites }[] = [];
  savedEntries: Entry[] = [];
  deletedEntries: string[] = [];
  deletedRecipes: string[] = [];
  setups: SetupWrite[] = [];
  tipState: TipState = EMPTY_TIP_STATE;
  savedTipStates: TipState[] = [];
  videos: SavedVideo[] = [];
  deletedVideos: string[] = [];
  writeMode: 'resolve' | 'hang' | 'permission-denied' = 'resolve';

  private result(): Promise<void> {
    if (this.writeMode === 'hang') return new Promise<void>(() => undefined);
    if (this.writeMode === 'permission-denied') {
      return Promise.reject(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }));
    }
    return Promise.resolve();
  }

  watchProfile(_uid: string, cb: (p: Profile | null) => void): Unsubscribe {
    cb(this.profile);
    return () => undefined;
  }
  watchGoals(_uid: string, cb: (g: Goal[]) => void): Unsubscribe {
    cb(this.goals);
    return () => undefined;
  }
  watchEntries(_uid: string, from: string, cb: (e: Entry[]) => void): Unsubscribe {
    cb(this.entries.filter((e) => e.date >= from));
    return () => undefined;
  }
  watchDays(_uid: string, cb: (d: Day[]) => void): Unsubscribe {
    cb(this.days);
    return () => undefined;
  }
  watchWeighIns(_uid: string, cb: (w: WeighIn[]) => void): Unsubscribe {
    cb(this.weighIns);
    return () => undefined;
  }
  watchRecipes(_uid: string, cb: (r: Recipe[]) => void): Unsubscribe {
    cb(this.recipes);
    return () => undefined;
  }
  applyWrites(uid: string, writes: PlannedWrites): Promise<void> {
    this.applied.push({ uid, writes });
    return this.result();
  }
  saveEntry(_uid: string, entry: Entry): Promise<void> {
    this.savedEntries.push(entry);
    return this.result();
  }
  deleteEntry(_uid: string, id: string): Promise<void> {
    this.deletedEntries.push(id);
    return this.result();
  }
  deleteRecipe(_uid: string, id: string): Promise<void> {
    this.deletedRecipes.push(id);
    return this.result();
  }
  saveSetup(_uid: string, setup: SetupWrite): Promise<void> {
    this.setups.push(setup);
    return this.result();
  }
  watchTipState(_uid: string, cb: (state: TipState) => void): Unsubscribe {
    cb(this.tipState);
    return () => undefined;
  }
  saveTipState(_uid: string, state: TipState): Promise<void> {
    this.savedTipStates.push(state);
    return this.result();
  }
  watchVideos(_uid: string, cb: (videos: SavedVideo[]) => void): Unsubscribe {
    cb(this.videos);
    return () => undefined;
  }
  deleteVideo(_uid: string, id: string): Promise<void> {
    this.deletedVideos.push(id);
    return this.result();
  }
}

export function seededRepository(): FakeRepository {
  const repo = new FakeRepository();
  repo.profile = testProfile;
  repo.goals = [testGoal];
  repo.weighIns = [{ date: '2026-09-27', kg: 85 }];
  repo.days = [{ date: '2026-09-27', garmin: { steps: 15200, workouts: [{ type: 'running', durationMin: 45, kcal: 520, steps: 6000 }] } }];
  repo.entries = [{ id: 'seed0001', date: '2026-09-27', time: '08:10', name: 'יוגורט', kcal: 320, protein: 20, carbs: 40, fat: 8, source: 'link' }];
  // Today's tip already closed, so the daily-tip dialog stays out of unrelated tests.
  repo.tipState = { ...EMPTY_TIP_STATE, lastDate: '2026-09-27' };
  repo.recipes = [{ id: 'fish-balls', name: 'קציצות דגים', aliases: ['קציצות'], ingredients: FISH_BALLS, yield: { units: 20, unitName: 'קציצה' } }];
  return repo;
}
