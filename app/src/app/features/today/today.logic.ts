import type { DaySummary } from '../../domain';
import { fmt } from '../../shared/format';

export const STALE_SYNC_HOURS = 6;

export function staleSyncHours(lastSyncAt: string | undefined, now: Date): number | null {
  if (!lastSyncAt) return null;
  const hours = Math.floor((now.getTime() - new Date(lastSyncAt).getTime()) / 3_600_000);
  return hours >= STALE_SYNC_HOURS ? hours : null;
}

export interface WaterfallRow {
  label: string;
  value: number;
  kind: 'base' | 'plus' | 'minus' | 'total';
  note?: string;
}

export function waterfallRows(s: DaySummary, defaultSteps: number): WaterfallRow[] {
  const e = s.expenditure;
  const rows: WaterfallRow[] = [
    { label: 'BMR', value: Math.round(e.bmr), kind: 'base' },
    { label: 'יומיום ועיכול', value: Math.round(e.dailyLifeKcal), kind: 'plus' },
  ];
  const stepsKcal = Math.round(e.stepsKcal);
  rows.push({
    label: 'צעדים',
    value: stepsKcal,
    kind: stepsKcal < 0 ? 'minus' : 'plus',
    note: e.stepsSource === 'default' ? `${fmt(defaultSteps)} · לא הוזנו` : `${fmt(e.steps)} מתוך בסיס ${fmt(defaultSteps)}`,
  });
  for (const w of e.workouts) rows.push({ label: w.type, value: Math.round(w.kcal), kind: 'plus' });
  rows.push({ label: 'גירעון', value: -Math.round(s.deficitKcal), kind: 'minus' });
  const clamp = Math.round(s.targetKcal - (e.out - s.deficitKcal));
  if (clamp !== 0) rows.push({ label: 'מגבלת קלוריות', value: clamp, kind: clamp > 0 ? 'plus' : 'minus' });
  rows.push({ label: 'יעד', value: Math.round(s.targetKcal), kind: 'total' });
  return rows;
}
