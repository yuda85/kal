import type { DaySummary } from '../../domain';
import { fmt } from '../../shared/format';

export const STALE_SYNC_HOURS = 6;

export function staleSyncHours(lastSyncAt: string | undefined, now: Date): number | null {
  if (!lastSyncAt) return null;
  const hours = Math.floor((now.getTime() - new Date(lastSyncAt).getTime()) / 3_600_000);
  return hours >= STALE_SYNC_HOURS ? hours : null;
}

export function breakdownText(s: DaySummary): string {
  const e = s.expenditure;
  return `BMR ${fmt(e.bmr)} · צעדים ${fmt(e.steps)}${e.stepsSource === 'default' ? '*' : ''} → ${fmt(e.stepsKcal)} · אימונים → ${fmt(e.workoutsKcal)}`;
}
