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
    expect(state.todaySummary()!.remainingKcal).toBeCloseTo(2298.934 - 320, 2);
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

  it('penalizes a finished day without food and exposes the weight reality', () => {
    const state = setup();
    expect(state.dayFor('2026-09-26')!.imputed).toBe(true);
    expect(state.dayFor('2026-09-27')!.imputed).toBe(false);
    expect(state.recentEnergy()).toHaveLength(14);
    expect(state.recentEnergy().at(-1)).toMatchObject({ date: '2026-09-26', inKcal: 3200 });
    expect(state.reality()!.status).toBe('no_data');
  });

  it('works with a legacy profile that still has an activity level', () => {
    const state = setup();
    expect(state.todaySummary()!.expenditure.stepsSource).toBe('garmin');
  });

  it('waits for days and weigh-ins before whenLoaded resolves', async () => {
    const repo = seededRepository();
    repo.watchDays = () => () => undefined;
    const state = setup(repo);
    const first = await Promise.race([state.whenLoaded().then(() => 'loaded'), new Promise((r) => setTimeout(() => r('waiting'), 20))]);
    expect(first).toBe('waiting');
  });

  it('computes the achievements once everything has loaded', () => {
    const state = setup();
    expect(state.loaded()).toBe(true);
    expect(state.entriesLoaded()).toBe(true);
    // seeded: weigh-in 85 kg against a 90 → 80 goal
    expect(state.achievements()!.weight.reachedKg).toBe(4);
    expect(state.achievementInput()!.entriesFrom).toBe('2026-06-29');
  });

  it('reports entries as not loaded until they arrive', () => {
    const repo = seededRepository();
    repo.watchEntries = () => () => undefined;
    expect(setup(repo).entriesLoaded()).toBe(false);
  });
});
