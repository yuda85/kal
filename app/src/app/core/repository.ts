import type { Day, Entry, Goal, MacroTargets, PlannedWrites, Profile, Recipe, WeighIn } from '../domain';

export type Unsubscribe = () => void;

export interface ProfileComputed {
  bmrKcal: number;
  macroTargets: MacroTargets;
  updatedAt: string;
}

export interface SetupWrite {
  profile: Profile;
  computed: ProfileComputed;
  goal: Goal;
  previousGoalId: string | null;
  weighIn: WeighIn | null;
}

export abstract class KalRepository {
  abstract watchProfile(uid: string, cb: (p: Profile | null) => void): Unsubscribe;
  abstract watchGoals(uid: string, cb: (goals: Goal[]) => void): Unsubscribe;
  abstract watchEntries(uid: string, from: string, cb: (entries: Entry[]) => void): Unsubscribe;
  abstract watchDays(uid: string, cb: (days: Day[]) => void): Unsubscribe;
  abstract watchWeighIns(uid: string, cb: (weighIns: WeighIn[]) => void): Unsubscribe;
  abstract watchRecipes(uid: string, cb: (recipes: Recipe[]) => void): Unsubscribe;
  abstract applyWrites(uid: string, writes: PlannedWrites, days: Day[]): Promise<void>;
  abstract saveEntry(uid: string, entry: Entry): Promise<void>;
  abstract deleteEntry(uid: string, id: string): Promise<void>;
  abstract deleteRecipe(uid: string, id: string): Promise<void>;
  abstract saveSetup(uid: string, setup: SetupWrite): Promise<void>;
}
