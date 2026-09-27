import { describe, expect, it } from 'vitest';
import { mergeManual, planWrites, rescaleAdd } from './apply.ts';
import type { AddOp, Payload } from './link.ts';
import { FISH_BALLS } from './testing.ts';

const payload: Payload = {
  v: 1,
  ops: [
    { op: 'add', id: 'abcd1234', date: '2026-09-27', time: '13:10', name: 'שקשוקה', kcal: 420, protein: 22 },
    { op: 'add', id: 'efgh5678', date: '2026-09-27', time: '13:15', name: '3 קציצות', kcal: 188, protein: 18.1, carbs: 10.9, fat: 7.8, recipeId: 'fish-balls', qty: 3 },
    { op: 'recipe', id: 'fish-balls', name: 'קציצות דגים', aliases: ['קציצות'], ingredients: FISH_BALLS, yield: { units: 20 } },
    { op: 'weight', date: '2026-09-27', kg: 88.4 },
    { op: 'activity', id: 'act12345', date: '2026-09-27', steps: 9200, workouts: [{ type: 'football', durationMin: 60, kcal: 550 }] },
  ],
};

describe('planWrites', () => {
  const w = planWrites(payload, { source: 'link', time: '14:00' });

  it('maps an add op to an entry with null for unknown macros', () => {
    expect(w.entries[0]).toEqual({ id: 'abcd1234', date: '2026-09-27', time: '13:10', name: 'שקשוקה', kcal: 420, protein: 22, carbs: null, fat: null, source: 'link' });
  });

  it('keeps recipeId and qty on recipe entries', () => {
    expect(w.entries[1]).toMatchObject({ recipeId: 'fish-balls', qty: 3 });
  });

  it('stores recipes with computed numbers', () => {
    expect(w.recipes[0].perUnit!.kcal).toBeCloseTo(62.66, 6);
    expect(w.recipes[0].per100g).toBeNull();
  });

  it('stamps weigh-ins with the save time', () => {
    expect(w.weights).toEqual([{ date: '2026-09-27', kg: 88.4, time: '14:00' }]);
  });

  it('tags manual workouts with the link id', () => {
    expect(w.activities).toEqual([
      { date: '2026-09-27', linkId: 'act12345', steps: 9200, workouts: [{ type: 'football', durationMin: 60, kcal: 550, linkId: 'act12345' }] },
    ]);
  });

  it('marks form entries as form', () => {
    expect(planWrites(payload, { source: 'form', time: '14:00' }).entries[0].source).toBe('form');
  });
});

describe('mergeManual', () => {
  const activity = { date: '2026-09-27', linkId: 'act12345', steps: 9200, workouts: [{ type: 'football', durationMin: 60, kcal: 550, linkId: 'act12345' }] };

  it('adds workouts and replaces steps', () => {
    const yoga = { type: 'yoga', durationMin: 30, kcal: 100, linkId: 'other111' };
    expect(mergeManual({ steps: 100, workouts: [yoga] }, activity)).toEqual({ steps: 9200, workouts: [yoga, activity.workouts[0]] });
  });

  it('is idempotent for the same link', () => {
    const once = mergeManual(undefined, activity);
    expect(mergeManual(once, activity)).toEqual(once);
  });

  it('keeps existing steps when the activity has none', () => {
    expect(mergeManual({ steps: 5000 }, { date: '2026-09-27', linkId: 'x1234567', workouts: [] }).steps).toBe(5000);
  });
});

describe('rescaleAdd', () => {
  const recipe = { id: 'fish-balls', name: 'קציצות דגים', aliases: [], ingredients: FISH_BALLS, yield: { units: 20 } };
  const op: AddOp = { op: 'add', id: 'efgh5678', date: '2026-09-27', time: '13:15', name: 'קציצות', kcal: 188, protein: 18.1, carbs: 10.9, fat: 7.8, recipeId: 'fish-balls', qty: 3 };

  it('recomputes from the recipe', () => {
    expect(rescaleAdd(op, recipe, 4)).toMatchObject({ qty: 4, kcal: 251, protein: 24.1, fat: 10.4 });
  });

  it('scales proportionally when the recipe is gone', () => {
    const plain: AddOp = { op: 'add', id: 'efgh5678', date: '2026-09-27', time: '13:15', name: 'x', kcal: 450, protein: 36, qty: 3 };
    const out = rescaleAdd(plain, undefined, 2);
    expect(out).toMatchObject({ qty: 2, kcal: 300, protein: 24 });
    expect(out.carbs).toBeUndefined();
  });

  it('treats a missing qty as 1', () => {
    const single: AddOp = { op: 'add', id: 'efgh5678', date: '2026-09-27', time: '13:15', name: 'x', kcal: 100 };
    expect(rescaleAdd(single, undefined, 2).kcal).toBe(200);
  });
});
