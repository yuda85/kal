export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high';
export type PacePreset = 'relaxed' | 'aggressive' | 'custom';

export interface Range {
  min?: number;
  max?: number;
}

export interface Constraints {
  kcal?: Range;
  protein?: Range;
  carbs?: Range;
  fat?: Range;
}

export interface Profile {
  sex: Sex;
  birthDate: string;
  heightCm: number;
  bodyFatPct?: number;
  activityLevel?: ActivityLevel;
  constraints: Constraints;
  settings: { lowDayThresholdKcal: number; defaultSteps?: number; missingDayKcal?: number };
  activeGoalId?: string;
  garminLastSyncAt?: string;
}

export interface Goal {
  id: string;
  startDate: string;
  startWeightKg: number;
  targetWeightKg: number;
  preset: PacePreset;
  paceKgPerWeek: number;
  dailyDeficitKcal: number;
  active: boolean;
}

export interface Entry {
  id: string;
  date: string;
  time: string;
  name: string;
  kcal: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  recipeId?: string;
  qty?: number;
  source: 'link' | 'form';
}

export interface Workout {
  type: string;
  durationMin?: number;
  kcal: number;
  steps?: number;
  linkId?: string;
}

export interface Day {
  date: string;
  garmin?: {
    steps: number;
    workouts: Workout[];
    totalKcal?: number;
    activeKcal?: number;
    restingKcal?: number;
    syncedAt?: string;
  };
  manual?: {
    steps?: number;
    workouts?: Workout[];
  };
  checkedInAt?: string;
}

export interface WeighIn {
  date: string;
  kg: number;
  time?: string;
}

export interface Per100 {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Ingredient {
  name: string;
  grams: number;
  per100: Per100;
}

export interface RecipeYield {
  units?: number;
  unitName?: string;
  cookedGrams?: number;
}

export interface Recipe {
  id: string;
  name: string;
  aliases: string[];
  ingredients: Ingredient[];
  yield: RecipeYield;
}
