import { STEPS_GOAL, type Celebration } from '../../domain';
import { fmt } from '../../shared/format';

const WEIGHT_LINE = 'לפי ממוצע השקילות השבועי.';

/** A run of text; `num: true` segments render in `<span class="num">` (app-wide rule: numbers in `.num`). */
export interface Segment {
  text: string;
  num: boolean;
}

const t = (text: string): Segment => ({ text, num: false });
const n = (value: number): Segment => ({ text: fmt(value), num: true });

/** §19 copy: logging and steps never say "on track"; only a weight milestone speaks about weight. */
export function celebrationText(c: Celebration): { title: Segment[]; line: Segment[] } {
  switch (c.kind) {
    case 'streak':
      return { title: [n(c.value), t(' ימים ברצף!')], line: [t('דיווחת יום אחרי יום. הדיווח הכן הוא מה שגורם לכל השאר לעבוד.')] };
    case 'week':
      return { title: [t('שבוע מושלם!')], line: [n(c.value), t(' מתוך '), n(c.value), t(' ימים מלאים: אוכל, צעדים ושקילה.')] };
    case 'steps-streak':
      return { title: [n(c.value), t(' ימים ברצף מעל '), n(STEPS_GOAL), t(' צעדים!')], line: [t('ממשיכים ללכת.')] };
    case 'steps-day':
      return { title: [t('שיא צעדים חדש!')], line: [n(c.value), t(' צעדים היום.')] };
    case 'steps-week':
      return { title: [t('שבוע שיא בצעדים!')], line: [t('ממוצע של '), n(c.value), t(' צעדים ביום.')] };
    case 'weight':
      return c.target
        ? { title: [t('הגעת ליעד!')], line: [t(WEIGHT_LINE)] }
        : { title: [t('ירדת '), n(c.value), t(' ק״ג!')], line: [t(WEIGHT_LINE)] };
  }
}
