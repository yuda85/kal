import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { KalState } from './kal-state';
import { LinkIntake } from './link-intake';

// Angular runs a route's canActivate guards concurrently, so each guard must stand on its own.

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const state = inject(KalState);
  const router = inject(Router);
  await auth.ready;
  const user = auth.user();
  if (!user) return router.parseUrl('/login');
  state.start(user.uid);
  await state.whenLoaded();
  return true;
};

export const setupGuard: CanActivateFn = async (_route, routerState) => {
  const auth = inject(AuthService);
  const state = inject(KalState);
  const router = inject(Router);
  const intake = inject(LinkIntake);
  await auth.ready;
  const user = auth.user();
  if (!user) return router.parseUrl('/login');
  state.start(user.uid);
  await state.whenLoaded();
  if (!state.profile() || !state.goal()) return router.parseUrl('/setup');
  if (intake.pending() && !routerState.url.startsWith('/confirm')) return router.parseUrl('/confirm');
  return true;
};
