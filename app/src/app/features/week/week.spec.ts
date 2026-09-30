import { TestBed } from '@angular/core/testing';
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
  });
});
