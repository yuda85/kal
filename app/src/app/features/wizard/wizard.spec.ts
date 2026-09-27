import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FakeRepository, NOW, seededRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Wizard } from './wizard';

async function openSummary(repo: FakeRepository) {
  TestBed.configureTestingModule({ imports: [Wizard], providers: [provideRouter([]), { provide: KalRepository, useValue: repo }] });
  const state = TestBed.inject(KalState);
  state.now.set(NOW);
  state.start('uid-123');
  const fixture = TestBed.createComponent(Wizard);
  const w = fixture.componentInstance as unknown as { form: { set(v: unknown): void }; step: { set(v: number): void }; save(): Promise<void> };
  w.form.set({
    sex: 'male', birthDate: '1991-05-10', heightCm: 178, currentWeightKg: 90, bodyFatPct: null, activityLevel: 'moderate',
    targetWeightKg: 80, preset: 'relaxed', customPaceKgPerWeek: null,
    constraints: { kcalMin: null, kcalMax: null, proteinMin: null, proteinMax: null, carbsMax: null, fatMax: null },
  });
  w.step.set(4);
  await fixture.whenStable();
  return { fixture, w };
}

describe('Wizard editing', () => {
  it('prefills the latest real weigh-in and keeps saved constraints when skipping', async () => {
    const repo = seededRepository();
    repo.weighIns = [{ date: '2026-09-20', kg: 86 }, { date: '2026-09-27', kg: 85 }];
    TestBed.configureTestingModule({ imports: [Wizard], providers: [provideRouter([]), { provide: KalRepository, useValue: repo }] });
    const state = TestBed.inject(KalState);
    state.now.set(NOW);
    state.start('u1');
    const fixture = TestBed.createComponent(Wizard);
    const w = fixture.componentInstance as unknown as { form(): { currentWeightKg: number; constraints: { proteinMax: number | null } }; step: { set(v: number): void }; skip(): void };
    expect(w.form().currentWeightKg).toBe(85);
    w.step.set(3);
    w.skip();
    expect(w.form().constraints.proteinMax).toBe(120);
  });
});

describe('Wizard', () => {
  it('saves the setup through the repository', async () => {
    const repo = new FakeRepository();
    const { w } = await openSummary(repo);
    await w.save();
    expect(repo.setups).toHaveLength(1);
    expect(repo.setups[0].profile.activeGoalId).toBe(repo.setups[0].goal.id);
  });

  it('shows the uid and the owner-registration fix on permission-denied', async () => {
    const repo = new FakeRepository();
    repo.writeMode = 'permission-denied';
    const { fixture, w } = await openSummary(repo);
    await w.save();
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('uid-123');
    expect(text).toContain('owners');
  });
});
