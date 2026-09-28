import { realityLine } from './reality-line';

describe('realityLine', () => {
  it('never praises missing data', () => {
    expect(realityLine(null)).toEqual({ text: 'אין עדיין נתוני משקל', tone: 'neutral' });
    expect(realityLine({ status: 'no_data', weighInCount: 2 } as never)).toEqual({ text: 'אין מספיק שקילות כדי לדעת אם אתה בקצב (2 מתוך 4 ב-14 יום)', tone: 'neutral' });
  });

  it('says what the scale says', () => {
    expect(realityLine({ status: 'gaining', trendChangeKg: 0.3, plannedChangeKg: -0.9 } as never).tone).toBe('danger');
    expect(realityLine({ status: 'stalled', trendChangeKg: -0.2, plannedChangeKg: -0.9 } as never)).toEqual({ text: 'המשקל כמעט לא ירד: -0.2 ק״ג ב-14 יום, התוכנית -0.9', tone: 'warning' });
    expect(realityLine({ status: 'on_track', trendChangeKg: -1, plannedChangeKg: -0.9 } as never).tone).toBe('success');
  });
});
