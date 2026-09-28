import { TestBed } from '@angular/core/testing';
import { seededRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Toast } from '../../core/toast';
import { CheckIn } from './checkin';
import { CheckInService } from './checkin.service';

afterEach(() => vi.useRealTimers());

async function open() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-27T19:30:00Z'));
  const repo = seededRepository();
  repo.writeMode = 'hang';
  TestBed.configureTestingModule({ imports: [CheckIn], providers: [{ provide: KalRepository, useValue: repo }] });
  const state = TestBed.inject(KalState);
  state.start('u1');
  state.refreshNow();
  TestBed.inject(CheckInService).show();
  const fixture = TestBed.createComponent(CheckIn);
  await fixture.whenStable();
  return { fixture, repo, el: fixture.nativeElement as HTMLElement };
}

describe('CheckIn', () => {
  it('shows the food logged today', async () => {
    const { el } = await open();
    expect(el.textContent).toContain('320');
  });

  it('saves without waiting, closes, and does not reopen today', async () => {
    const { fixture, repo, el } = await open();
    const steps = el.querySelector<HTMLInputElement>('input[name=steps]')!;
    steps.value = '9000';
    steps.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('button[data-type="Push"]')!.click();
    await fixture.whenStable();
    const kcal = el.querySelector<HTMLInputElement>('input[name=workoutKcal]')!;
    kcal.value = '350';
    kcal.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(repo.applied[0].writes.activities[0]).toMatchObject({ steps: 9000, workouts: [{ type: 'Push', kcal: 350 }] });
    expect(repo.applied[0].writes.checkIns).toEqual(['2026-09-27']);
    const service = TestBed.inject(CheckInService);
    expect(service.open()).toBe(false);
    expect(service.dismissedFor()).toBe('2026-09-27');
    expect(TestBed.inject(Toast).message()).toBe('נשמר');
  });

  it('"not now" dismisses for today', async () => {
    const { fixture, el } = await open();
    el.querySelector<HTMLButtonElement>('button[data-action="later"]')!.click();
    await fixture.whenStable();
    expect(TestBed.inject(CheckInService).dismissedFor()).toBe('2026-09-27');
  });
});

describe('CheckInService', () => {
  it('forgets "not now" when the app comes back to the foreground', () => {
    const service = TestBed.inject(CheckInService);
    service.dismiss('2026-09-27');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(service.dismissedFor()).toBeNull();
  });
});
