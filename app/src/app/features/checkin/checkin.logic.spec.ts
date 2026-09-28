import { checkInError, checkInWrites, initialCheckIn, shouldPromptCheckIn } from './checkin.logic';

const late = new Date('2026-09-28T19:30:00Z'); // 22:30 in Israel
const early = new Date('2026-09-28T15:00:00Z'); // 18:00

describe('check-in logic', () => {
  it('prompts from 22:00 until the day is checked in or dismissed', () => {
    expect(shouldPromptCheckIn(late, undefined, false)).toBe(true);
    expect(shouldPromptCheckIn(early, undefined, false)).toBe(false);
    expect(shouldPromptCheckIn(late, { date: '2026-09-28', checkedInAt: 'x' }, false)).toBe(false);
    expect(shouldPromptCheckIn(late, undefined, true)).toBe(false);
  });

  it('prefills from the day and today\'s weigh-in', () => {
    const day = { date: '2026-09-28', manual: { steps: 8000, workouts: [{ type: 'Push', kcal: 350, linkId: 'checkin' }] } };
    expect(initialCheckIn(day, { date: '2026-09-28', kg: 92.2 })).toEqual({ steps: 8000, workoutType: 'Push', workoutKcal: 350, weightKg: 92.2 });
    expect(initialCheckIn(undefined, undefined)).toEqual({ steps: null, workoutType: null, workoutKcal: null, weightKg: null });
  });

  it('validates steps, workout calories and weight', () => {
    expect(checkInError({ steps: -1, workoutType: null, workoutKcal: null, weightKg: null })).toContain('צעדים');
    expect(checkInError({ steps: 8000, workoutType: 'Push', workoutKcal: null, weightKg: null })).toContain('אימון');
    expect(checkInError({ steps: null, workoutType: null, workoutKcal: null, weightKg: 20 })).toContain('משקל');
    expect(checkInError({ steps: 8000, workoutType: 'Push', workoutKcal: 350, weightKg: 92 })).toBeNull();
  });

  it('writes steps, a replaceable check-in workout, the weigh-in and the check-in mark', () => {
    const w = checkInWrites({ steps: 8000, workoutType: 'Push', workoutKcal: 350, weightKg: 92.2 }, '2026-09-28', late);
    expect(w.activities).toEqual([{ date: '2026-09-28', linkId: 'checkin', steps: 8000, workouts: [{ type: 'Push', kcal: 350, linkId: 'checkin' }] }]);
    expect(w.weights).toEqual([{ date: '2026-09-28', kg: 92.2, time: '22:30' }]);
    expect(w.checkIns).toEqual(['2026-09-28']);
  });

  it('clears the check-in workout when "no workout" is chosen', () => {
    expect(checkInWrites({ steps: null, workoutType: null, workoutKcal: null, weightKg: null }, '2026-09-28', late).activities[0].workouts).toEqual([]);
  });

  it('leaves unchanged values alone so data saved elsewhere survives', () => {
    const initial = { steps: 8000, workoutType: null, workoutKcal: null, weightKg: 92.2 };
    const w = checkInWrites({ ...initial }, '2026-09-28', late, initial);
    expect(w.activities).toEqual([{ date: '2026-09-28', linkId: 'checkin' }]);
    expect(w.weights).toEqual([]);
    expect(w.checkIns).toEqual(['2026-09-28']);
  });
});
