import { TestBed } from '@angular/core/testing';
import { NOW, seededRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { WeightPage } from './weight';

async function render() {
  const repo = seededRepository();
  // NOW is Sunday 2026-09-27: a weigh-in last Friday, and today's.
  repo.weighIns = [
    { date: '2026-09-25', kg: 86 },
    { date: '2026-09-27', kg: 85 },
  ];
  TestBed.configureTestingModule({ imports: [WeightPage], providers: [{ provide: KalRepository, useValue: repo }] });
  const state = TestBed.inject(KalState);
  state.now.set(NOW);
  state.start('u1');
  const fixture = TestBed.createComponent(WeightPage);
  await fixture.whenStable();
  return fixture;
}

describe('WeightPage', () => {
  it('zooms into a tapped week and back to every week', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    const weeks = el.querySelectorAll<SVGRectElement>('rect.hit');
    expect(weeks).toHaveLength(2);

    weeks[0].dispatchEvent(new MouseEvent('click'));
    await fixture.whenStable();
    expect(el.querySelector('.zoom h3')!.textContent).toContain('שבוע 20.9');
    expect(el.querySelector('.zoom .legend')!.textContent).toContain('ממוצע 86');
    expect(el.querySelector('.days h3')!.textContent).toContain('השקילות בשבוע 20.9');
    expect(el.querySelectorAll('.day')).toHaveLength(7);
    expect(el.querySelector('rect.hit')).toBeNull();

    el.querySelector<HTMLButtonElement>('button.back')!.click();
    await fixture.whenStable();
    expect(el.querySelector('.zoom')).toBeNull();
    expect(el.querySelectorAll('rect.hit')).toHaveLength(2);
  });

  it('names the next weight milestone', async () => {
    const el = (await render()).nativeElement as HTMLElement;
    // mean 85 this week against a 90 kg start: 4 kg reached, 6 kg next
    expect(el.querySelector('.next')!.textContent).toContain('אבן הדרך הבאה');
    expect(el.querySelector('.next')!.textContent).toContain('−6');
    expect(el.querySelectorAll('.ticks b.on')).toHaveLength(2);
  });
});
