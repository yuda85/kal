import { localDate, localTime, type Entry, type Payload } from '../../domain';

export interface MealDraft {
  name: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

const MACROS = [
  ['protein', 'חלבון'],
  ['carbs', 'פחמימות'],
  ['fat', 'שומן'],
] as const;

export function mealError(d: MealDraft): string | null {
  if (d.kcal === null || d.kcal <= 0 || d.kcal > 5000) return 'קלוריות: מספר בין 1 ל-5000';
  for (const [key, label] of MACROS) {
    const v = d[key];
    if (v !== null && (v < 0 || v > 500)) return `${label}: מספר בין 0 ל-500`;
  }
  return null;
}

export function mealPayload(d: MealDraft, now: Date, id: string): Payload {
  return {
    v: 1,
    ops: [
      {
        op: 'add',
        id,
        date: localDate(now),
        time: localTime(now),
        name: d.name.trim() || 'ארוחה',
        kcal: d.kcal!,
        ...(d.protein !== null ? { protein: d.protein } : {}),
        ...(d.carbs !== null ? { carbs: d.carbs } : {}),
        ...(d.fat !== null ? { fat: d.fat } : {}),
      },
    ],
  };
}

export function editedEntry(entry: Entry, d: MealDraft): Entry {
  return { ...entry, name: d.name.trim() || entry.name, kcal: d.kcal!, protein: d.protein, carbs: d.carbs, fat: d.fat };
}

export function weightError(kg: number | null): string | null {
  return kg === null || kg < 30 || kg > 300 ? 'משקל: מספר בין 30 ל-300' : null;
}

export function weightPayload(kg: number, now: Date): Payload {
  return { v: 1, ops: [{ op: 'weight', date: localDate(now), kg }] };
}

export interface ActivityDraft {
  steps: number | null;
  type: string;
  minutes: number | null;
  kcal: number | null;
}

function hasWorkout(d: ActivityDraft): boolean {
  return d.type.trim() !== '' || d.minutes !== null || d.kcal !== null;
}

export function activityError(d: ActivityDraft): string | null {
  if (d.steps === null && !hasWorkout(d)) return 'הזן צעדים או אימון';
  if (d.steps !== null && (d.steps < 0 || d.steps > 100000)) return 'צעדים: מספר בין 0 ל-100000';
  if (hasWorkout(d)) {
    if (d.type.trim() === '') return 'סוג האימון חסר';
    if (d.minutes === null || d.minutes < 1 || d.minutes > 600) return 'משך: בין 1 ל-600 דקות';
    if (d.kcal === null || d.kcal < 0 || d.kcal > 3000) return 'קלוריות אימון: בין 0 ל-3000';
  }
  return null;
}

export function activityPayload(d: ActivityDraft, now: Date, id: string): Payload {
  return {
    v: 1,
    ops: [
      {
        op: 'activity',
        id,
        date: localDate(now),
        ...(d.steps !== null ? { steps: d.steps } : {}),
        ...(hasWorkout(d) ? { workouts: [{ type: d.type.trim(), durationMin: d.minutes!, kcal: d.kcal! }] } : {}),
      },
    ],
  };
}
