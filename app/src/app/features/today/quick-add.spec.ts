import { TestBed } from '@angular/core/testing';
import { NOW, seededRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Toast } from '../../core/toast';
import { QuickAdd } from './quick-add';
import { QuickAddService } from './quick-add.service';

afterEach(() => vi.useRealTimers());

async function open(repo = seededRepository()) {
  TestBed.configureTestingModule({ imports: [QuickAdd], providers: [{ provide: KalRepository, useValue: repo }] });
  const state = TestBed.inject(KalState);
  state.now.set(NOW);
  state.start('u1');
  TestBed.inject(QuickAddService).open('meal');
  const fixture = TestBed.createComponent(QuickAdd);
  await fixture.whenStable();
  return { fixture, repo, el: fixture.nativeElement as HTMLElement };
}

function type(el: HTMLElement, selector: string, value: string) {
  const input = el.querySelector<HTMLInputElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('QuickAdd', () => {
  it('shows a validation error and saves nothing without kcal', async () => {
    const { fixture, repo, el } = await open();
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(el.querySelector('.error')?.textContent).toContain('קלוריות');
    expect(repo.applied).toEqual([]);
  });

  it('shows the protocol error instead of throwing for an over-long name', async () => {
    const { fixture, repo, el } = await open();
    type(el, 'input[name=name]', 'א'.repeat(101));
    type(el, 'input[name=kcal]', '500');
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(el.querySelector('.error')?.textContent).toContain('name');
    expect(repo.applied).toEqual([]);
  });

  it('stamps a meal with the real current date even if the clock signal is stale', async () => {
    const { fixture, repo, el } = await open();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    TestBed.inject(KalState).now.set(new Date('2026-09-26T10:00:00Z'));
    type(el, 'input[name=kcal]', '400');
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(repo.applied[0].writes.entries[0].date).toBe('2026-09-27');
  });

  it('edits an entry in place, keeping its id and source', async () => {
    const repo = seededRepository();
    TestBed.configureTestingModule({ imports: [QuickAdd], providers: [{ provide: KalRepository, useValue: repo }] });
    const state = TestBed.inject(KalState);
    state.now.set(NOW);
    state.start('u1');
    TestBed.inject(QuickAddService).edit(repo.entries[0]);
    const fixture = TestBed.createComponent(QuickAdd);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    type(el, 'input[name=kcal]', '300');
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(repo.savedEntries).toEqual([{ ...repo.entries[0], kcal: 300 }]);
    expect(repo.applied).toEqual([]);
  });

  it('deletes an entry after confirmation', async () => {
    const repo = seededRepository();
    TestBed.configureTestingModule({ imports: [QuickAdd], providers: [{ provide: KalRepository, useValue: repo }] });
    const state = TestBed.inject(KalState);
    state.now.set(NOW);
    state.start('u1');
    TestBed.inject(QuickAddService).edit(repo.entries[0]);
    const fixture = TestBed.createComponent(QuickAdd);
    await fixture.whenStable();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.danger')!.click();
    await fixture.whenStable();
    expect(repo.deletedEntries).toEqual(['seed0001']);
    expect(TestBed.inject(Toast).message()).toBe('נמחק');
  });

  it('saves a meal without waiting for the write', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const repo = seededRepository();
    repo.writeMode = 'hang';
    const { fixture, el } = await open(repo);
    type(el, 'input[name=kcal]', '500');
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(repo.applied).toHaveLength(1);
    expect(repo.applied[0].writes.entries[0]).toMatchObject({ kcal: 500, source: 'form', date: '2026-09-27' });
    expect(TestBed.inject(Toast).message()).toBe('נשמר');
    expect(TestBed.inject(QuickAddService).tab()).toBeNull();
  });
});
