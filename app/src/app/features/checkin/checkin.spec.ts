import { TestBed } from '@angular/core/testing';
import { seededRepository, type FakeRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Toast } from '../../core/toast';
import { CheckIn } from './checkin';
import { CheckInService } from './checkin.service';

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

async function open(prepare: (repo: FakeRepository) => void = () => undefined) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-27T19:30:00Z'));
  const repo = seededRepository();
  repo.writeMode = 'hang';
  prepare(repo);
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

  it('asks for honesty about what was not logged, without judging', async () => {
    const { el } = await open();
    expect(el.textContent).toContain('תהיה כנה');
    expect(el.textContent).toContain('המטרה היא מעקב, לא שיפוט');
  });

  it('offers to add a photo until one is chosen on this device', async () => {
    const { el } = await open();
    expect(el.querySelector('.photo img')).toBeNull();
    expect(el.querySelector('.add-photo')!.textContent).toContain('הוספת תמונה');
  });

  it('shows the photo saved on this device', async () => {
    localStorage.setItem('kal.checkinPhoto', 'data:image/jpeg;base64,AAAA');
    const { el } = await open();
    expect(el.querySelector<HTMLImageElement>('.photo img')!.getAttribute('src')).toBe('data:image/jpeg;base64,AAAA');
    expect(el.textContent).toContain('החלפת תמונה');
  });

  it('shows the carried weight a day without a weigh-in will count', async () => {
    const { el } = await open((repo) => (repo.weighIns = [{ date: '2026-09-25', kg: 85.4 }]));
    expect(el.querySelector<HTMLInputElement>('input[name=weight]')!.placeholder).toBe('85.4 אם לא תזין');
  });

  it('shows no weight hint once today is weighed', async () => {
    const { el } = await open();
    expect(el.querySelector<HTMLInputElement>('input[name=weight]')!.placeholder).toBe('');
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
    const minutes = el.querySelector<HTMLInputElement>('input[name=workoutMin]')!;
    minutes.value = '55';
    minutes.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(repo.applied[0].writes.activities[0]).toMatchObject({ steps: 9000, workouts: [{ type: 'Push', kcal: 350, durationMin: 55 }] });
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

  it('reports a logged day neutrally, never as a success', async () => {
    const { el } = await open((repo) => {
      repo.entries = [...repo.entries, { id: 'lunch001', date: '2026-09-27', time: '13:00', name: 'צהריים', kcal: 600, protein: null, carbs: null, fat: null, source: 'link' }];
    });
    expect(el.querySelector('.alert.neutral')?.textContent).toContain('920');
    expect(el.querySelector('.alert.success')).toBeNull();
  });

  it('saving without changes keeps the steps and workouts stored for the day', async () => {
    const { fixture, repo, el } = await open();
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(repo.applied[0].writes.activities).toEqual([{ date: '2026-09-27', linkId: 'checkin' }]);
    expect(repo.applied[0].writes.weights).toEqual([]);
  });

  it('tells the owner to log a walk or run as steps, so it is not counted twice', async () => {
    const { fixture, el } = await open();
    el.querySelector<HTMLButtonElement>('button[data-type="Cardio"]')!.click();
    await fixture.whenStable();
    expect(el.textContent).toContain('הליכה או ריצה');
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
