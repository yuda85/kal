import type { DaySummary, LoggingStreak } from '../../domain';
import { fmt } from '../../shared/format';

export const STALE_SYNC_HOURS = 6;

export function staleSyncHours(lastSyncAt: string | undefined, now: Date): number | null {
  if (!lastSyncAt) return null;
  const hours = Math.floor((now.getTime() - new Date(lastSyncAt).getTime()) / 3_600_000);
  return hours >= STALE_SYNC_HOURS ? hours : null;
}

export interface BurnLine {
  label: string;
  note: string;
  kcal: number;
}

/** "How today's target is built": burn − deficit (± the kcal constraint) = target, and what the burn is made of. */
export interface TargetBreakdown {
  burn: number;
  deficit: number;
  pace: string;
  /** How far the kcal constraint moved the target; 0 when it did not. */
  clamp: number;
  clampLabel: string;
  target: number;
  lines: BurnLine[];
  /** The equation as one sentence, for screen readers. */
  summary: string;
}

export function targetBreakdown(s: DaySummary, defaultSteps: number, paceKgPerWeek: number): TargetBreakdown {
  const e = s.expenditure;
  // Rounded so the numbers on screen add up: burn − deficit + clamp = target (the hero's number), and the lines sum to burn.
  const target = Math.round(s.targetKcal);
  const deficit = Math.round(s.deficitKcal);
  const clamped = Math.round(s.targetKcal - (e.out - s.deficitKcal)) !== 0;
  const burn = clamped ? Math.round(e.out) : target + deficit;
  const clamp = target - burn + deficit;
  const stepsKcal = Math.round(e.stepsKcal) || 0; // no signed zero
  const lines: BurnLine[] = [
    { label: 'במנוחה', note: 'BMR', kcal: Math.round(e.bmr) },
    { label: 'יומיום ועיכול', note: `כולל ${fmt(defaultSteps)} צעדים`, kcal: Math.round(e.dailyLifeKcal) },
    {
      label: stepsKcal > 0 ? 'צעדים נוספים' : stepsKcal < 0 ? 'פחות צעדים' : 'צעדים',
      note: e.stepsSource === 'default' ? 'לא הוזנו' : `${fmt(e.steps)} היום`,
      kcal: stepsKcal,
    },
    ...e.workouts.map((w) => ({ label: 'אימון', note: w.type, kcal: Math.round(w.kcal) })),
  ];
  lines[0].kcal += burn - lines.reduce((sum, l) => sum + l.kcal, 0); // the base absorbs the rounding
  const clampLabel = clamp > 0 ? 'מינימום קלוריות' : 'מקסימום קלוריות';
  const clampText = clamp === 0 ? '' : `, ${clamp > 0 ? 'ועוד' : 'פחות'} ${fmt(Math.abs(clamp))} בגלל ${clampLabel}`;
  return {
    burn,
    deficit,
    pace: `${fmt(paceKgPerWeek, 2)} ק״ג בשבוע`,
    clamp,
    clampLabel,
    target,
    lines,
    summary: `יעד לאכילה ${fmt(target)}: שורף היום ${fmt(burn)}, פחות גירעון ${fmt(deficit)}${clampText}`,
  };
}

export interface StreakChip {
  count: string;
  today: boolean;
  label: string;
  /** A 1-day, uncapped streak reads "יום אחד" instead of the count and "ימים". */
  one: boolean;
}

/** The Today chip (§19); null without a streak. */
export function streakChip(s: LoggingStreak): StreakChip | null {
  if (s.days === 0) return null;
  const one = !s.capped && s.days === 1;
  const count = s.capped ? `${s.days}+` : String(s.days);
  const daysText = one ? 'יום אחד' : `${count} ימים`;
  return { count, today: s.todayCounted, one, label: `רצף דיווח ${daysText}, ${s.todayCounted ? 'היום כבר דווח' : 'היום עוד לא דווח'}` };
}
