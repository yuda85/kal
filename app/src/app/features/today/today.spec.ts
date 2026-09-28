import { TestBed } from '@angular/core/testing';
import { NOW, seededRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { CheckInService } from '../checkin/checkin.service';
import { Today } from './today';

async function render(now = NOW) {
  TestBed.configureTestingModule({ imports: [Today], providers: [{ provide: KalRepository, useValue: seededRepository() }] });
  const state = TestBed.inject(KalState);
  state.now.set(now);
  state.start('u1');
  state.now.set(now);
  const fixture = TestBed.createComponent(Today);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('Today', () => {
  it('shows the weigh-in chip, the reality line and the target waterfall', async () => {
    const el = await render();
    expect(el.textContent).toContain('85');
    expect(el.textContent).toContain('אין מספיק שקילות');
    expect(el.textContent).toContain('BMR');
    expect(el.textContent).toContain('יעד');
    expect(el.querySelector('.big')!.classList).not.toContain('good');
  });

  it('opens the check-in automatically after 22:00', async () => {
    await render(new Date('2026-09-27T19:30:00Z'));
    expect(TestBed.inject(CheckInService).open()).toBe(true);
  });

  it('does not open the check-in before 22:00', async () => {
    await render();
    expect(TestBed.inject(CheckInService).open()).toBe(false);
  });
});
