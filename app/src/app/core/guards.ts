import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { KalState } from './kal-state';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const state = inject(KalState);
  const router = inject(Router);
  await auth.ready;
  const user = auth.user();
  if (!user) return router.parseUrl('/login');
  state.start(user.uid);
  return true;
};

export const setupGuard: CanActivateFn = async () => {
  const state = inject(KalState);
  const router = inject(Router);
  await state.whenLoaded();
  return state.profile() && state.goal() ? true : router.parseUrl('/setup');
};
