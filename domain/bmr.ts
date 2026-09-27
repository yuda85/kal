import { ageOn } from './dates.ts';
import type { Profile } from './types.ts';

export type BmrProfile = Pick<Profile, 'sex' | 'birthDate' | 'heightCm' | 'bodyFatPct'>;

export function bmr(p: BmrProfile, weightKg: number, date: string): number {
  if (p.bodyFatPct != null) {
    return 370 + 21.6 * weightKg * (1 - p.bodyFatPct / 100);
  }
  const age = ageOn(p.birthDate, date);
  return 10 * weightKg + 6.25 * p.heightCm - 5 * age + (p.sex === 'male' ? 5 : -161);
}
