import { celebrationText, type Segment } from './celebration.logic';

describe('celebrationText', () => {
  const c = (kind: any, value: number, target = false) => ({ key: 'k', kind, value, target });
  const join = (s: Segment[]) => s.map((x) => x.text).join('');
  const nums = (s: Segment[]) => s.filter((x) => x.num).map((x) => x.text);

  it('words each kind, never "on track" for logging or steps', () => {
    expect(join(celebrationText(c('streak', 7)).title)).toBe('7 ימים ברצף!');
    expect(join(celebrationText(c('streak', 7)).line)).toBe('דיווחת יום אחרי יום. הדיווח הכן הוא מה שגורם לכל השאר לעבוד.');
    expect(join(celebrationText(c('week', 7)).line)).toBe('7 מתוך 7 ימים מלאים: אוכל, צעדים ושקילה.');
    expect(join(celebrationText(c('steps-streak', 3)).title)).toBe('3 ימים ברצף מעל 10,000 צעדים!');
    expect(join(celebrationText(c('steps-day', 14200)).line)).toBe('14,200 צעדים היום.');
    expect(join(celebrationText(c('steps-week', 9125)).line)).toBe('ממוצע של 9,125 צעדים ביום.');
    expect(join(celebrationText(c('weight', 4)).title)).toBe('ירדת 4 ק״ג!');
    expect(join(celebrationText(c('weight', 10, true)).title)).toBe('הגעת ליעד!');
  });

  it('marks numbers with num: true so they render in .num', () => {
    expect(nums(celebrationText(c('steps-streak', 3)).title)).toEqual(['3', '10,000']);
    expect(nums(celebrationText(c('steps-day', 14200)).line)).toEqual(['14,200']);
  });
});
