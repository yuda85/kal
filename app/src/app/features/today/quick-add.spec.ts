import { TestBed } from '@angular/core/testing';
import { NOW, seededRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Toast } from '../../core/toast';
import { QuickAdd } from './quick-add';
import { QuickAddService } from './quick-add.service';

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

  it('saves a meal without waiting for the write', async () => {
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
