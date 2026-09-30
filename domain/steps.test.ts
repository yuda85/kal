import { describe, expect, it } from 'vitest';
import { STEPS_GOAL, stepsTier } from './steps.ts';

describe('stepsTier', () => {
  it('grades a day against the 10,000-step goal', () => {
    expect(STEPS_GOAL).toBe(10000);
    expect(stepsTier(0)).toBe('low');
    expect(stepsTier(4499)).toBe('low');
    expect(stepsTier(4500)).toBe('mid');
    expect(stepsTier(9999)).toBe('mid');
    expect(stepsTier(10000)).toBe('goal');
    expect(stepsTier(13000)).toBe('goal');
    expect(stepsTier(13001)).toBe('great');
  });
});
