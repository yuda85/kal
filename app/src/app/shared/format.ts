import type { MacroKey, Warning } from '../domain';

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function fmt(n: number | null | undefined, digits: 0 | 1 = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return (digits === 1 ? oneDecimal : whole).format(n);
}

export function num(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export const MACRO_LABEL: Record<MacroKey, string> = {
  kcal: 'קלוריות',
  protein: 'חלבון',
  carbs: 'פחמימות',
  fat: 'שומן',
};

export function warningText(w: Warning): string {
  if (w.code === 'below_bmr') {
    return `היעד היומי (${fmt(w.value)}) נמוך מה-BMR (${fmt(w.limit)}): הקצב אגרסיבי מדי`;
  }
  const macro = w.macro ?? 'kcal';
  const unit = macro === 'kcal' ? '' : ' גרם';
  return `${MACRO_LABEL[macro]} ${fmt(w.value)}${unit}, מעל התקרה של ${fmt(w.limit)}${unit}`;
}

const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

export function dayLetter(date: string): string {
  return DAY_LETTERS[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

export function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(d)}.${Number(m)}`;
}
