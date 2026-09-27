import { describe, expect, it } from 'vitest';
import { addDays, ageOn, dateRange, daysBetween, isValidDate, localDate, localTime, weekStart } from './dates.ts';

describe('localDate / localTime in Asia/Jerusalem', () => {
  it('uses the Israeli date just after local midnight in summer (UTC+3)', () => {
    const at = new Date('2026-09-26T21:30:00Z');
    expect(localDate(at)).toBe('2026-09-27');
    expect(localTime(at)).toBe('00:30');
  });

  it('uses the Israeli date just after local midnight in winter (UTC+2)', () => {
    const at = new Date('2026-12-31T22:30:00Z');
    expect(localDate(at)).toBe('2027-01-01');
    expect(localTime(at)).toBe('00:30');
  });
});

describe('calendar math', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-09-01', '2026-09-27')).toBe(26);
    expect(daysBetween('2026-09-27', '2026-09-01')).toBe(-26);
  });

  it('lists an inclusive range, empty when reversed', () => {
    expect(dateRange('2026-09-29', '2026-10-01')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
    expect(dateRange('2026-10-02', '2026-10-01')).toEqual([]);
  });

  it('computes age in full years', () => {
    expect(ageOn('1991-09-27', '2026-09-27')).toBe(35);
    expect(ageOn('1991-09-28', '2026-09-27')).toBe(34);
  });

  it('finds the Sunday that starts the week', () => {
    expect(weekStart('2026-09-27')).toBe('2026-09-27');
    expect(weekStart('2026-10-03')).toBe('2026-09-27');
    expect(weekStart('2026-09-26')).toBe('2026-09-20');
  });

  it('validates calendar dates', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('26-2-1')).toBe(false);
  });
});
