import { inject, provideAppInitializer, provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { FirestoreKalRepository } from './core/firestore-repository';
import { LinkIntake } from './core/link-intake';
import { KalRepository } from './core/repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: KalRepository, useClass: FirestoreKalRepository },
    provideAppInitializer(() => inject(LinkIntake).capture()),
  ],
};
