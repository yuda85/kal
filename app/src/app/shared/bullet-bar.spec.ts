import { TestBed } from '@angular/core/testing';
import { BulletBar } from './bullet-bar';

async function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(BulletBar);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('BulletBar', () => {
  it('shows value over target', async () => {
    const el = await render({ label: 'קלוריות', value: 1460, target: 1980 });
    expect(el.textContent).toContain('1,460 / 1,980');
  });

  it('marks values over the max and draws the cap marker', async () => {
    const el = await render({ label: 'חלבון', value: 131, target: 120, max: 120, unit: 'g' });
    expect(el.querySelector('.fill')!.classList).toContain('over');
    expect(el.querySelector('.marker')).not.toBeNull();
    expect(el.textContent).toContain('131g / 120g');
  });

  it('shows the plain value without a target', async () => {
    const el = await render({ label: 'שומן', value: 52, unit: 'g' });
    expect(el.textContent).toContain('52g');
    expect(el.querySelector('.marker')).toBeNull();
  });
});
