import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NOW, seededRepository, type FakeRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { LinkIntake } from '../../core/link-intake';
import { KalRepository } from '../../core/repository';
import { Toast } from '../../core/toast';
import { encodePayload, type Op } from '../../domain';
import { CheckInService } from '../checkin/checkin.service';
import { Confirm } from './confirm';

async function open(ops: Op[] | string, repo: FakeRepository = seededRepository()) {
  TestBed.configureTestingModule({ imports: [Confirm], providers: [provideRouter([]), { provide: KalRepository, useValue: repo }] });
  const state = TestBed.inject(KalState);
  state.now.set(NOW);
  state.start('u1');
  TestBed.inject(LinkIntake).pending.set(typeof ops === 'string' ? ops : encodePayload({ v: 1, ops }));
  const fixture = TestBed.createComponent(Confirm);
  await fixture.whenStable();
  return { fixture, repo, el: fixture.nativeElement as HTMLElement };
}

const shakshuka: Op = { op: 'add', id: 'abcd1234', date: '2026-09-27', time: '13:10', name: 'שקשוקה', kcal: 420, protein: 22 };
const balls: Op = { op: 'add', id: 'efgh5678', date: '2026-09-27', time: '13:15', name: '3 קציצות', kcal: 188, protein: 18.1, carbs: 10.9, fat: 7.8, recipeId: 'fish-balls', qty: 3 };

describe('Confirm', () => {
  it('lists the items with their numbers', async () => {
    const { el } = await open([shakshuka]);
    expect(el.textContent).toContain('שקשוקה');
    expect(el.textContent).toContain('420');
  });

  it('shows an invalid-link screen for a broken payload', async () => {
    const { el } = await open('bm90IGpzb24');
    expect(el.textContent).toContain('קישור לא תקין');
  });

  it('marks an entry that is already saved', async () => {
    const { el } = await open([{ ...shakshuka, id: 'seed0001' } as Op]);
    expect(el.textContent).toContain('כבר נשמר');
  });

  it('recomputes a recipe entry when the quantity changes', async () => {
    const { fixture, el } = await open([balls]);
    el.querySelector<HTMLButtonElement>('button[aria-label="יותר"]')!.click();
    await fixture.whenStable();
    expect(el.textContent).toContain('251');
  });

  it('lets the quantity be typed, in grams for cooked-weight recipes', async () => {
    const { fixture, el } = await open([balls]);
    const input = el.querySelector<HTMLInputElement>('input[aria-label="כמות"]')!;
    input.value = '5';
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(el.textContent).toContain('313');
  });

  it('keeps the list and shows an inline error for an invalid edited value', async () => {
    const { fixture, repo, el } = await open([shakshuka]);
    const input = el.querySelector<HTMLInputElement>('input[aria-label="קלוריות"]')!;
    input.value = '6000';
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(el.querySelector('.error')?.textContent).toContain('kcal');
    expect(el.textContent).toContain('שקשוקה');
    expect(repo.applied).toEqual([]);
  });

  it('previews all four macro bars', async () => {
    const { el } = await open([shakshuka]);
    expect(el.querySelectorAll('.preview app-bullet-bar')).toHaveLength(4);
  });

  it('includes a logged activity in the after-save preview', async () => {
    const { fixture } = await open([{ op: 'activity', id: 'act12345', date: '2026-09-27', workouts: [{ type: 'הליכה', durationMin: 60, kcal: 300 }] }]);
    const preview = (fixture.componentInstance as unknown as { preview(): { date: string; targetKcal: number } }).preview();
    // base target 2050.3 + walk 300 kcal, counted as entered
    expect(preview.targetKcal).toBeCloseTo(2350.3, 0);
  });

  it('previews the day of a weight-only link', async () => {
    const { fixture } = await open([{ op: 'weight', date: '2026-09-26', kg: 84 }]);
    expect((fixture.componentInstance as unknown as { preview(): { date: string } }).preview().date).toBe('2026-09-26');
  });

  it('warns when protein would pass the cap', async () => {
    const { el } = await open([{ ...shakshuka, protein: 111 } as Op]);
    expect(el.textContent).toContain('מעל התקרה');
  });

  it('saves without waiting for the write and clears the link', async () => {
    const repo = seededRepository();
    repo.writeMode = 'hang';
    const { fixture, el } = await open([shakshuka, { op: 'weight', date: '2026-09-27', kg: 88.4 }], repo);
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(repo.applied).toHaveLength(1);
    expect(repo.applied[0].writes.entries[0]).toMatchObject({ id: 'abcd1234', source: 'link' });
    expect(repo.applied[0].writes.weights).toHaveLength(1);
    expect(TestBed.inject(LinkIntake).pending()).toBeNull();
    expect(TestBed.inject(Toast).message()).toBe('נשמר');
  });

  it('does not reopen the check-in after a check-in link for today is saved', async () => {
    const { fixture, el } = await open([{ op: 'activity', id: 'checkin', date: '2026-09-27', steps: 9000 }]);
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(TestBed.inject(CheckInService).dismissedFor()).toBe('2026-09-27');
  });
});
