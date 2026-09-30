import { celebrationText } from './celebration.logic';

describe('celebrationText', () => {
  const c = (kind: any, value: number, target = false) => ({ key: 'k', kind, value, target });

  it('words each kind, never "on track" for logging or steps', () => {
    expect(celebrationText(c('streak', 7)).title).toBe('7 ימים ברצף!');
    expect(celebrationText(c('week', 7)).line).toBe('7 מתוך 7 ימים מלאים: אוכל, צעדים ושקילה.');
    expect(celebrationText(c('steps-streak', 3)).title).toBe('3 ימים ברצף מעל 10,000 צעדים!');
    expect(celebrationText(c('steps-day', 14200)).line).toBe('14,200 צעדים היום.');
    expect(celebrationText(c('steps-week', 9125)).line).toBe('ממוצע של 9,125 צעדים ביום.');
    expect(celebrationText(c('weight', 4)).title).toBe('ירדת 4 ק״ג!');
    expect(celebrationText(c('weight', 10, true)).title).toBe('הגעת ליעד!');
  });
});
