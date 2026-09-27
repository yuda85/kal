import { describe, expect, it } from 'vitest';
import { bmr } from './bmr.ts';

const male = { sex: 'male' as const, birthDate: '1991-05-10', heightCm: 178 };

describe('bmr', () => {
  it('uses Mifflin-St Jeor for a man without body fat', () => {
    // 10*85 + 6.25*178 - 5*35 + 5
    expect(bmr(male, 85, '2026-09-27')).toBeCloseTo(1792.5, 10);
  });

  it('uses Mifflin-St Jeor for a woman without body fat', () => {
    // 10*60 + 6.25*165 - 5*30 - 161
    expect(bmr({ sex: 'female', birthDate: '1996-01-01', heightCm: 165 }, 60, '2026-09-27')).toBeCloseTo(1320.25, 10);
  });

  it('uses Katch-McArdle when body fat is known', () => {
    // 370 + 21.6 * 85 * 0.85
    expect(bmr({ ...male, bodyFatPct: 15 }, 85, '2026-09-27')).toBeCloseTo(1930.6, 10);
  });

  it('uses the age on the given date', () => {
    expect(bmr(male, 85, '2026-05-09') - bmr(male, 85, '2026-05-10')).toBeCloseTo(5, 10);
  });
});
