import { TestBed } from '@angular/core/testing';
import { testGoal } from '../../../../../domain/testing.ts';
import { seededRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Week } from './week';

describe('Week styles', () => {
  it('never paints logged-deficit days in an on-track colour', () => {
    const css = (Week as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('');
    const rule = css.match(/\.cell\.deficit[^{]*\{[^}]*\}/)![0];
    expect(rule).not.toContain('--out');
    expect(rule).not.toContain('--success');
    expect(rule).not.toContain('--primary');
  });
});

describe('Week steps', () => {
  it('shows the daily steps average and a bar per day with steps', async () => {
    // Seeded: 15,200 Garmin steps on Sunday 09-27. Today is Tuesday 09-29; Monday has none.
    TestBed.configureTestingModule({ imports: [Week], providers: [{ provide: KalRepository, useValue: seededRepository() }] });
    const state = TestBed.inject(KalState);
    state.now.set(new Date('2026-09-29T10:00:00Z'));
    state.start('u1');
    const fixture = TestBed.createComponent(Week);
    await fixture.whenStable();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.steps')!;
    expect(card.querySelector('.avg')!.textContent).toContain('15,200');
    expect(card.textContent).toContain('לפי יום אחד שהסתיים');
    expect(card.querySelectorAll('rect.bar')).toHaveLength(1);
    expect(card.querySelectorAll('rect.missing')).toHaveLength(1);
    // 15,200 steps: a great day, with the gradient, a sparkle, the goal line and the legend
    const great = card.querySelector('rect.bar.great')!;
    expect(great.getAttribute('fill')).toMatch(/^url\(.*#steps-great\)$/);
    expect(card.querySelectorAll('.sparkle')).toHaveLength(1);
    expect(card.querySelector('line.goal')).not.toBeNull();
    expect(card.textContent).toContain('יעד 10,000');
    expect(card.querySelector('.tiers')!.textContent).toContain('מעל 13,000');
    const records = card.querySelector('.records')!;
    expect(records.textContent).toContain('רצף 10K');
    expect(records.textContent).toContain('15,200');
    expect(records.textContent).toContain('27.9');
  });
});

describe('Week KPI copy', () => {
  it('labels the average-in context line "ימים מדווחים", not "ימים מלאים" (that phrase is the full-week card)', async () => {
    TestBed.configureTestingModule({ imports: [Week], providers: [{ provide: KalRepository, useValue: seededRepository() }] });
    const state = TestBed.inject(KalState);
    state.now.set(new Date('2026-09-29T10:00:00Z'));
    state.start('u1');
    const fixture = TestBed.createComponent(Week);
    await fixture.whenStable();
    const kpis = (fixture.nativeElement as HTMLElement).querySelectorAll('.kpis .card');
    const avgInCard = [...kpis].find((c) => c.textContent?.includes('ממוצע נכנס'))!;
    expect(avgInCard.textContent).toContain('ימים מדווחים');
    expect(avgInCard.textContent).not.toContain('ימים מלאים');
  });
});

describe('Week steps record, singular day count', () => {
  it('shows a 1-day 10K streak as "יום אחד", with no number span', async () => {
    // Seeded: 15,200 Garmin steps on Sunday 09-27, nothing before it. Today is Monday 09-28: streak is 1 day.
    TestBed.configureTestingModule({ imports: [Week], providers: [{ provide: KalRepository, useValue: seededRepository() }] });
    const state = TestBed.inject(KalState);
    state.now.set(new Date('2026-09-28T10:00:00Z'));
    state.start('u1');
    const fixture = TestBed.createComponent(Week);
    await fixture.whenStable();
    const streakBlock = (fixture.nativeElement as HTMLElement).querySelector('.records')!.children[0] as HTMLElement;
    expect(streakBlock.textContent).toContain('יום אחד');
    expect(streakBlock.querySelector('.num')).toBeNull();
  });
});

describe('Week full week', () => {
  it('scores the week on screen with a dot per day', async () => {
    // Seeded Sunday 09-27: 320 kcal (under 800), 15,200 steps, weigh-in → not full. Today is Tuesday 09-29.
    TestBed.configureTestingModule({ imports: [Week], providers: [{ provide: KalRepository, useValue: seededRepository() }] });
    const state = TestBed.inject(KalState);
    state.now.set(new Date('2026-09-29T10:00:00Z'));
    state.start('u1');
    const fixture = TestBed.createComponent(Week);
    await fixture.whenStable();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.fullweek')!;
    expect(card.textContent).toContain('שבוע מלא');
    expect(card.textContent).toContain('0/7');
    expect([...card.querySelectorAll('.dots li')].map((d) => d.className)).toEqual(['partial', 'partial', 'open', 'open', 'open', 'open', 'open']);
  });

  it('renders no full-week card for a week entirely before the goal start', async () => {
    const repo = seededRepository();
    repo.goals = [{ ...testGoal, startDate: '2026-10-04' }]; // after the week on screen (09-27–10-03)
    TestBed.configureTestingModule({ imports: [Week], providers: [{ provide: KalRepository, useValue: repo }] });
    const state = TestBed.inject(KalState);
    state.now.set(new Date('2026-09-29T10:00:00Z'));
    state.start('u1');
    const fixture = TestBed.createComponent(Week);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.fullweek')).toBeNull();
  });
});
