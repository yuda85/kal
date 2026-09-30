import { STEPS_GOAL, type Celebration } from '../../domain';
import { fmt } from '../../shared/format';

const WEIGHT_LINE = 'לפי ממוצע השקילות השבועי.';

/** §19 copy: logging and steps never say "on track"; only a weight milestone speaks about weight. */
export function celebrationText(c: Celebration): { title: string; line: string } {
  switch (c.kind) {
    case 'streak':
      return { title: `${c.value} ימים ברצף!`, line: 'דיווחת כל יום. הדיווח הכן הוא מה שגורם לכל השאר לעבוד.' };
    case 'week':
      return { title: 'שבוע מושלם!', line: `${c.value} מתוך ${c.value} ימים מלאים: אוכל, צעדים ושקילה.` };
    case 'steps-streak':
      return { title: `${c.value} ימים ברצף מעל ${fmt(STEPS_GOAL)} צעדים!`, line: 'ממשיכים ללכת.' };
    case 'steps-day':
      return { title: 'שיא צעדים חדש!', line: `${fmt(c.value)} צעדים היום.` };
    case 'steps-week':
      return { title: 'שבוע שיא בצעדים!', line: `ממוצע של ${fmt(c.value)} צעדים ביום.` };
    case 'weight':
      return c.target ? { title: 'הגעת ליעד!', line: WEIGHT_LINE } : { title: `ירדת ${fmt(c.value)} ק״ג!`, line: WEIGHT_LINE };
  }
}
