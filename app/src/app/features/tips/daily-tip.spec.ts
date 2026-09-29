import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NOW, seededRepository, type FakeRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { testGoal } from '../../../../../domain/testing.ts';
import { EMPTY_TIP_STATE, TIP_ROTATION, TIPS } from '../../domain';
import { DailyTip } from './daily-tip';
import { DailyTipService } from './daily-tip.service';

afterEach(() => vi.useRealTimers());

// A goal that starts today: no finished day yet, so no reason from yesterday.
const startsToday = (repo: FakeRepository) => (repo.goals = [{ ...testGoal, startDate: '2026-09-27' }]);

async function setup(prepare: (repo: FakeRepository) => void = () => undefined) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  const repo = seededRepository();
  repo.tipState = EMPTY_TIP_STATE;
  prepare(repo);
  TestBed.configureTestingModule({ imports: [DailyTip], providers: [provideRouter([]), { provide: KalRepository, useValue: repo }] });
  const state = TestBed.inject(KalState);
  state.start('u1');
  state.refreshNow();
  const service = TestBed.inject(DailyTipService);
  const fixture = TestBed.createComponent(DailyTip);
  await fixture.whenStable();
  return { fixture, repo, service, state, el: fixture.nativeElement as HTMLElement };
}

describe('DailyTip', () => {
  it('shows the next rotation tip on the first open of the day', async () => {
    const { el } = await setup(startsToday);
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(el.textContent).toContain(TIP_ROTATION[0].title);
    expect(el.querySelector('.why')).toBeNull();
  });

  it('closes with "הבנתי", saving the day and advancing the rotation', async () => {
    const { el, repo, service, fixture } = await setup(startsToday);
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('הבנתי')) as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(repo.savedTipStates.at(-1)).toMatchObject({ lastDate: '2026-09-27', rotation: 1, lastTipId: TIP_ROTATION[0].id });
    expect(service.pick()).toBeNull();
  });

  it('stays closed once today was shown', async () => {
    const { service } = await setup((repo) => (repo.tipState = { ...EMPTY_TIP_STATE, lastDate: '2026-09-27' }));
    expect(service.pick()).toBeNull();
  });

  it('picks a tip for a strong reason from yesterday, with the reason line', async () => {
    // Yesterday (09-26) is after the goal start and has no food: the day is penalized.
    const { el, service } = await setup();
    const pick = service.pick()!;
    expect(pick.reason?.code).toBe('not_logged');
    expect(TIPS.filter((t) => t.topic === 'tracking')).toContain(pick.tip);
    expect(el.querySelector('.why')?.textContent).toContain('אתמול הרישום לא הושלם');
  });

  it('stars the tip from the dialog', async () => {
    const { el, repo, fixture, service } = await setup();
    const id = service.pick()!.tip.id;
    (el.querySelector('.star') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(repo.savedTipStates.at(-1)?.starred).toEqual([id]);
    expect(el.querySelector('.star')?.getAttribute('aria-pressed')).toBe('true');
  });
});
