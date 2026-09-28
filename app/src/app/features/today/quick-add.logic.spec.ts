import { activityError, activityPayload, editedEntry, mealError, mealPayload, weightError, weightPayload } from './quick-add.logic';

const now = new Date('2026-09-27T10:00:00Z');
const meal = { name: '', kcal: 500, protein: null, carbs: null, fat: null };

describe('meal', () => {
  it('requires kcal between 1 and 5000 and macros between 0 and 500', () => {
    expect(mealError({ ...meal, kcal: null })).toContain('קלוריות');
    expect(mealError({ ...meal, kcal: 6000 })).toContain('קלוריות');
    expect(mealError({ ...meal, protein: 600 })).toContain('חלבון');
    expect(mealError(meal)).toBeNull();
  });

  it('builds an add op with a default name and only the macros given', () => {
    expect(mealPayload({ ...meal, protein: 30 }, now, 'abcd1234')).toEqual({
      v: 1,
      ops: [{ op: 'add', id: 'abcd1234', date: '2026-09-27', time: '13:00', name: 'ארוחה', kcal: 500, protein: 30 }],
    });
  });

  it('edits an entry keeping its id, date and source', () => {
    const entry = { id: 'e1', date: '2026-09-27', time: '08:10', name: 'יוגורט', kcal: 320, protein: 20, carbs: 40, fat: 8, source: 'link' as const };
    expect(editedEntry(entry, { name: 'יוגורט יווני', kcal: 300, protein: 25, carbs: null, fat: null })).toEqual({
      ...entry, name: 'יוגורט יווני', kcal: 300, protein: 25, carbs: null, fat: null,
    });
  });
});

describe('weight', () => {
  it('validates the range and builds a weight op', () => {
    expect(weightError(20)).toContain('משקל');
    expect(weightError(null)).toContain('משקל');
    expect(weightPayload(88.4, now)).toEqual({ v: 1, ops: [{ op: 'weight', date: '2026-09-27', kg: 88.4 }] });
  });
});

describe('activity', () => {
  it('needs steps or a complete workout', () => {
    expect(activityError({ steps: null, type: '', minutes: null, kcal: null })).toContain('צעדים');
    expect(activityError({ steps: null, type: '', minutes: 30, kcal: 200 })).toContain('סוג');
    expect(activityError({ steps: 9000, type: '', minutes: null, kcal: null })).toBeNull();
  });

  it('asks for the day steps when logging a workout on a day without steps', () => {
    const run = { steps: null, type: 'ריצה', minutes: 30, kcal: 300 };
    expect(activityError(run, false)).toContain('צעדים');
    expect(activityError(run, true)).toBeNull();
    expect(activityError({ ...run, steps: 8000 }, false)).toBeNull();
  });

  it('builds an activity op with an id', () => {
    expect(activityPayload({ steps: 9000, type: 'כדורגל', minutes: 60, kcal: 550 }, now, 'act12345')).toEqual({
      v: 1,
      ops: [{ op: 'activity', id: 'act12345', date: '2026-09-27', steps: 9000, workouts: [{ type: 'כדורגל', durationMin: 60, kcal: 550 }] }],
    });
  });
});
