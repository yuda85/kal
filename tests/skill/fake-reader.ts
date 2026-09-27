import type { FirestoreReader } from '../../.claude/skills/kal/scripts/lib/firestore.ts';
import { FISH_BALLS, testGoal, testProfile } from '../../domain/testing.ts';

export function fakeReader(overrides: Partial<Record<'user' | 'goals' | 'weights' | 'days' | 'entries' | 'recipes', unknown>> = {}): FirestoreReader {
  const { id: _id, ...goalData } = testGoal;
  const data: Record<string, any> = {
    user: testProfile,
    goals: [{ id: 'g1', data: goalData }],
    weights: [{ id: '2026-09-27', data: { kg: 85 } }],
    days: [{ id: '2026-09-27', data: { garmin: { steps: 15200, workouts: [{ type: 'running', durationMin: 45, kcal: 520, steps: 6000 }] } } }],
    entries: [
      { id: 'e1', data: { date: '2026-09-27', time: '08:10', name: 'יוגורט', kcal: 320, protein: 20, carbs: 40, fat: 8, source: 'link' } },
      { id: 'e2', data: { date: '2026-09-20', time: '08:10', name: 'old', kcal: 999, protein: null, carbs: null, fat: null, source: 'form' } },
    ],
    recipes: [{ id: 'fish-balls', data: { name: 'קציצות דגים', aliases: ['קציצות'], ingredients: FISH_BALLS, yield: { units: 20, unitName: 'קציצה' } } }],
    ...overrides,
  };
  return {
    user: async () => data.user,
    list: async (c: string) => data[c],
    entriesBetween: async (from: string, to: string) => data.entries.filter((e: any) => e.data.date >= from && e.data.date <= to),
  } as FirestoreReader;
}
