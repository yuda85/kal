import {
  inject,
  Injector,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  type ApplicationConfig,
  isDevMode,
} from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';
import { FirestoreKalRepository } from './core/firestore-repository';
import { LinkIntake } from './core/link-intake';
import { KalRepository } from './core/repository';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: KalRepository, useClass: FirestoreKalRepository },
    provideAppInitializer(() => {
      const intake = inject(LinkIntake);
      const injector = inject(Injector);
      intake.capture();
      // A link opened into an already-loaded tab only changes the hash: no reload, no initializer.
      addEventListener('hashchange', () => {
        intake.capture();
        if (intake.pending()) void injector.get(Router).navigateByUrl('/confirm');
      });
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
