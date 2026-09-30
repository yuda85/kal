import { TestBed } from '@angular/core/testing';
import { NOW, seededRepository, type FakeRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { EMPTY_TIP_STATE } from '../../domain';
import { CelebrationService } from './celebration.service';

// Seeded: goal 90 → 80, weigh-in 85 on 09-27 → weight milestones 2 and 4 earned.
async function setup(prepare: (repo: FakeRepository) => void = () => undefined) {
  const repo = seededRepository();
  prepare(repo);
  TestBed.configureTestingModule({ providers: [{ provide: KalRepository, useValue: repo }] });
  const state = TestBed.inject(KalState);
  state.now.set(NOW);
  state.start('u1');
  const service = TestBed.inject(CelebrationService);
  TestBed.tick();
  return { repo, service };
}

describe('CelebrationService', () => {
  it('first run: saves what is already earned as seen, without a dialog', async () => {
    const { repo, service } = await setup();
    expect(repo.savedCelebrations[0].seen).toEqual(['weight-g1-2', 'weight-g1-4']);
    expect(service.due()).toEqual([]);
  });

  it('shows the highest new one of each kind, and close marks all as seen', async () => {
    const { repo, service } = await setup((r) => (r.celebrations = { seen: [] }));
    expect(service.due().map((c) => c.key)).toEqual(['weight-g1-4']);
    service.close();
    expect(repo.savedCelebrations.at(-1)!.seen).toEqual(['weight-g1-2', 'weight-g1-4']);
    expect(service.due()).toEqual([]);
  });

  it('waits while the daily tip is open', async () => {
    const { service } = await setup((r) => {
      r.celebrations = { seen: [] };
      r.tipState = EMPTY_TIP_STATE;
    });
    expect(service.due()).toEqual([]);
  });

  it('waits for the entries before seeding or showing anything', async () => {
    const { repo, service } = await setup((r) => (r.watchEntries = () => () => undefined));
    expect(repo.savedCelebrations).toEqual([]);
    expect(service.due()).toEqual([]);
  });

  it('keeps a seen celebration seen when the data no longer earns it', async () => {
    const { repo, service } = await setup((r) => {
      r.celebrations = { seen: ['weight-g1-2', 'weight-g1-4', 'weight-g1-6'] };
    });
    expect(service.due()).toEqual([]);
    service.close();
    expect(repo.savedCelebrations.at(-1)!.seen).toContain('weight-g1-6');
  });
});
