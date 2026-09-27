import { dayLetter, fmt, num, shortDate, warningText } from './format';

describe('format', () => {
  it('formats numbers with separators and a dash for missing values', () => {
    expect(fmt(1650.4)).toBe('1,650');
    expect(fmt(18.06, 1)).toBe('18.1');
    expect(fmt(null)).toBe('—');
    expect(fmt(Number.NaN)).toBe('—');
  });

  it('parses input values, empty as null', () => {
    expect(num('')).toBeNull();
    expect(num(' 12.5 ')).toBe(12.5);
    expect(num('abc')).toBeNull();
  });

  it('writes warnings in Hebrew', () => {
    expect(warningText({ code: 'over_max', macro: 'protein', value: 131.2, limit: 120 })).toBe('חלבון 131 גרם, מעל התקרה של 120 גרם');
    expect(warningText({ code: 'over_max', macro: 'kcal', value: 2400, limit: 2200 })).toBe('קלוריות 2,400, מעל התקרה של 2,200');
    expect(warningText({ code: 'below_bmr', value: 1500, limit: 1792.5 })).toBe('היעד היומי (1,500) נמוך מה-BMR (1,793): הקצב אגרסיבי מדי');
  });

  it('writes short Hebrew dates', () => {
    expect(dayLetter('2026-09-27')).toBe('א׳');
    expect(dayLetter('2026-10-03')).toBe('ש׳');
    expect(shortDate('2026-09-07')).toBe('7.9');
  });
});
