import { TestBed } from '@angular/core/testing';
import { FakeRepository, NOW, seededRepository } from '../../testing/fake-repository';
import { KalRepository } from './repository';
import { KalState } from './kal-state';

function setup(repo: FakeRepository = seededRepository()) {
  TestBed.configureTestingModule({ providers: [{ provide: KalRepository, useValue: repo }] });
  const state = TestBed.inject(KalState);
  state.now.set(NOW);
  state.start('u1');
  return state;
}

describe('KalState', () => {
  it('computes today from the shared domain', () => {
    const state = setup();
    expect(state.today()).toBe('2026-09-27');
    expect(state.goal()!.id).toBe('g1');
    expect(state.todaySummary()!.remainingKcal).toBeCloseTo(2050.316 - 320, 2);
  });

  it('rolls today over after midnight in Israel', () => {
    const state = setup();
    state.now.set(new Date('2026-09-27T21:05:00Z'));
    expect(state.today()).toBe('2026-09-28');
    expect(state.todaySummary()!.entries).toEqual([]);
  });

  it('refreshes the clock when the app returns to the foreground', () => {
    const state = setup();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T04:30:00Z'));
    document.dispatchEvent(new Event('visibilitychange'));
    vi.useRealTimers();
    expect(state.today()).toBe('2026-09-28');
  });

  it('resolves whenLoaded once profile and goals arrived', async () => {
    const state = setup();
    await expect(state.whenLoaded()).resolves.toBeUndefined();
  });

  it('returns no summary without a profile', () => {
    const repo = new FakeRepository();
    const state = setup(repo);
    expect(state.todaySummary()).toBeNull();
  });

  it('previews a day with extra entries', () => {
    const state = setup();
    const extra = { id: 'x1', date: '2026-09-27', time: '12:00', name: 'x', kcal: 500, protein: null, carbs: null, fat: null, source: 'link' as const };
    expect(state.dayFor('2026-09-27', { entries: [...state.entries(), extra] })!.intake.kcal).toBe(820);
  });

  it('stops listening and clears data', () => {
    const state = setup();
    state.stop();
    expect(state.uid()).toBeNull();
    expect(state.entries()).toEqual([]);
  });
});
