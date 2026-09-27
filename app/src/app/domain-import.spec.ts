import { bmr, localDate } from './domain';

describe('shared domain', () => {
  it('is importable from the app', () => {
    expect(bmr({ sex: 'male', birthDate: '1991-05-10', heightCm: 178 }, 85, '2026-09-27')).toBeCloseTo(1792.5, 6);
    expect(localDate(new Date('2026-09-26T21:30:00Z'))).toBe('2026-09-27');
  });
});
