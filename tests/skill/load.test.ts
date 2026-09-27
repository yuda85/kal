import { describe, expect, it } from 'vitest';
import { loadData, loadRecipes } from '../../.claude/skills/kal/scripts/lib/load.ts';
import { FISH_BALLS, testGoal, testProfile } from '../../domain/testing.ts';
import { fakeReader } from './fake-reader.ts';

describe('loadData', () => {
  it('maps documents to domain types', async () => {
    const d = await loadData(fakeReader(), '2026-09-27', '2026-09-27');
    expect(d.profile.heightCm).toBe(178);
    expect(d.goal).toEqual(testGoal);
    expect(d.weighIns).toEqual([{ date: '2026-09-27', kg: 85 }]);
    expect(d.days[0].date).toBe('2026-09-27');
    expect(d.entries.map((e) => e.id)).toEqual(['e1']);
    expect(d.recipes[0].id).toBe('fish-balls');
  });

  it('falls back to the goal flagged active', async () => {
    const { id: _id, ...goalData } = testGoal;
    const d = await loadData(fakeReader({ user: { ...testProfile, activeGoalId: undefined }, goals: [{ id: 'g9', data: goalData }] }), '2026-09-27', '2026-09-27');
    expect(d.goal.id).toBe('g9');
  });

  it('explains a missing profile or goal', async () => {
    await expect(loadData(fakeReader({ user: null }), '2026-09-27', '2026-09-27')).rejects.toThrow('no profile');
    await expect(loadData(fakeReader({ goals: [] }), '2026-09-27', '2026-09-27')).rejects.toThrow('no active goal');
  });
});

describe('loadRecipes', () => {
  it('returns recipes as domain objects', async () => {
    const recipes = await loadRecipes(fakeReader());
    expect(recipes).toEqual([{ id: 'fish-balls', name: 'קציצות דגים', aliases: ['קציצות'], ingredients: FISH_BALLS, yield: { units: 20, unitName: 'קציצה' } }]);
  });
});
