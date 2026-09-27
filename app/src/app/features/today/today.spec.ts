import { TestBed } from '@angular/core/testing';
import { NOW, seededRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Today } from './today';

describe('Today', () => {
  it('shows what is left to eat, the entries and the breakdown', async () => {
    TestBed.configureTestingModule({ imports: [Today], providers: [{ provide: KalRepository, useValue: seededRepository() }] });
    const state = TestBed.inject(KalState);
    state.now.set(NOW);
    state.start('u1');
    const fixture = TestBed.createComponent(Today);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('נשאר לאכול');
    expect(text).toContain('1,730');
    expect(text).toContain('יוגורט');
    expect(text).toContain('צעדים 15,200');
  });
});
