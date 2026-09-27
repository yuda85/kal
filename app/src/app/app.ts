import { Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { KalState } from './core/kal-state';
import { LinkIntake } from './core/link-intake';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  constructor() {
    const intake = inject(LinkIntake);
    const state = inject(KalState);
    const router = inject(Router);
    effect(() => {
      if (intake.pending() && state.profile() && state.goal()) void router.navigateByUrl('/confirm');
    });
  }
}
