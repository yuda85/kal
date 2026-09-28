import type { Reality } from '../domain';
import { fmt } from './format';

export function realityLine(r: Reality | null): { text: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (!r) return { text: 'אין עדיין נתוני משקל', tone: 'neutral' };
  const change = `${fmt(r.trendChangeKg, 1)} ק״ג ב-14 יום, התוכנית ${fmt(r.plannedChangeKg, 1)}`;
  switch (r.status) {
    case 'no_data':
      return { text: `אין מספיק שקילות כדי לדעת אם אתה בקצב (${r.weighInCount} מתוך 4 ב-14 יום)`, tone: 'neutral' };
    case 'gaining':
      return { text: `המשקל עלה: ${change}`, tone: 'danger' };
    case 'stalled':
      return { text: `המשקל כמעט לא ירד: ${change}`, tone: 'warning' };
    case 'on_track':
      return { text: `בקצב לפי המשקל: ${change}`, tone: 'success' };
  }
}
