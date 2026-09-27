import { FISH_BALLS } from '../../../../../domain/testing.ts';
import { recipeRow } from './recipes.logic';

describe('recipeRow', () => {
  it('shows per-unit numbers for unit recipes', () => {
    const row = recipeRow({ id: 'fish-balls', name: 'קציצות דגים', aliases: ['קציצות'], ingredients: FISH_BALLS, yield: { units: 20, unitName: 'קציצה' } });
    expect(row).toMatchObject({ id: 'fish-balls', name: 'קציצות דגים', aliases: 'קציצות', perLabel: '63 קל׳ לקציצה' });
    // per unit: protein 6.03, carbs 3.635, fat 2.6 → one decimal
    expect(row.macros).toBe('P 6 · C 3.6 · F 2.6');
  });

  it('shows per-100 g numbers for cooked-weight recipes', () => {
    expect(recipeRow({ id: 'stew', name: 'תבשיל', aliases: [], ingredients: FISH_BALLS, yield: { cookedGrams: 1000 } }).perLabel).toBe('125 קל׳ ל-100 ג׳');
  });
});
