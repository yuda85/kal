import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { FakeRepository, NOW, seededRepository } from '../../testing/fake-repository';
import { AuthService } from './auth.service';
import { setupGuard } from './guards';
import { KalState } from './kal-state';
import { LinkIntake } from './link-intake';
import { KalRepository } from './repository';

function run(repo: FakeRepository, user: { uid: string } | null, url = '/') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: KalRepository, useValue: repo },
      { provide: AuthService, useValue: { ready: Promise.resolve(), user: signal(user) } },
    ],
  });
  TestBed.inject(KalState).now.set(NOW);
  return TestBed.runInInjectionContext(() => setupGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)) as Promise<boolean | UrlTree>;
}

const path = (r: boolean | UrlTree) => (r instanceof UrlTree ? r.toString() : r);

describe('setupGuard', () => {
  it('lets a set-up user in without waiting for another guard', async () => {
    expect(path(await run(seededRepository(), { uid: 'u1' }))).toBe(true);
  });

  it('sends a user without a profile to the wizard', async () => {
    expect(path(await run(new FakeRepository(), { uid: 'u1' }))).toBe('/setup');
  });

  it('sends a signed-out visitor to login', async () => {
    expect(path(await run(seededRepository(), null))).toBe('/login');
  });

  it('sends a pending Claude link to the confirm screen', async () => {
    const result = run(seededRepository(), { uid: 'u1' });
    TestBed.inject(LinkIntake).pending.set('abc');
    expect(path(await result)).toBe('/confirm');
  });

  it('does not loop when already heading to confirm', async () => {
    const result = run(seededRepository(), { uid: 'u1' }, '/confirm');
    TestBed.inject(LinkIntake).pending.set('abc');
    expect(path(await result)).toBe(true);
  });
});
