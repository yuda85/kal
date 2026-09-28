import { REALITY_MIN_WEIGHINS, type Reality } from '../domain';
import { fmt } from './format';

export function realityLine(r: Reality | null): { text: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (!r) return { text: 'אין עדיין נתוני משקל', tone: 'neutral' };
  const change = `${fmt(r.trendChangeKg, 1)} ק״ג ב-14 יום, התוכנית ${fmt(r.plannedChangeKg, 1)}`;
  switch (r.status) {
    case 'no_data':
      if (r.weighInCount >= REALITY_MIN_WEIGHINS) {
        return { text: `צריך שקילות לאורך 14 יום כדי לדעת אם אתה בקצב (יש ${r.weighInCount} שקילות)`, tone: 'neutral' };
      }
      return { text: `אין מספיק שקילות כדי לדעת אם אתה בקצב (${r.weighInCount} מתוך 4 ב-14 יום)`, tone: 'neutral' };
    case 'gaining':
      return { text: `המשקל עלה: ${change}`, tone: 'danger' };
    case 'stalled':
      return { text: `המשקל כמעט לא ירד: ${change}`, tone: 'warning' };
    case 'on_track':
      return { text: `בקצב לפי המשקל: ${change}`, tone: 'success' };
  }
}
