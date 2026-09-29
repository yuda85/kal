import { FISH_BALLS } from '../../../../../domain/testing.ts';
import { describeOp } from './confirm.logic';

describe('describeOp', () => {
  it('describes weigh-ins, recipes and activity in Hebrew', () => {
    expect(describeOp({ op: 'weight', date: '2026-09-27', kg: 88.4 }, [])).toBe('שקילה: 88.4 ק״ג (27.9)');
    expect(describeOp({ op: 'recipe', id: 'fish-balls', name: 'קציצות דגים', aliases: [], ingredients: FISH_BALLS, yield: { units: 20, unitName: 'קציצה' } }, [])).toBe('מתכון: קציצות דגים · 63 קל׳ לקציצה');
    expect(describeOp({ op: 'activity', id: 'act12345', date: '2026-09-27', steps: 9200, workouts: [{ type: 'כדורגל', durationMin: 60, kcal: 550 }] }, [])).toBe('פעילות (27.9): 9,200 צעדים · כדורגל 550 קל׳ (60 דק׳)');
    expect(describeOp({ op: 'activity', id: 'checkin', date: '2026-09-27', workouts: [{ type: 'Push', kcal: 350 }] }, [])).toBe('פעילות (27.9): Push 350 קל׳');
    expect(describeOp({ op: 'video', id: 'vid12345', url: 'https://youtu.be/a', title: 'חלבון בבוקר', take: 'יוגורט', topic: 'protein' }, [])).toBe('סרטון: חלבון בבוקר · חלבון');
  });
});
