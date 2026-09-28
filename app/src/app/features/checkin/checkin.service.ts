import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CheckInService {
  readonly open = signal(false);
  /** The date the owner closed or saved the check-in for in this app session. */
  readonly dismissedFor = signal<string | null>(null);

  constructor() {
    // "Not now" lasts until the app is opened again.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.dismissedFor.set(null);
    });
  }

  show(): void {
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
  }

  dismiss(date: string): void {
    this.dismissedFor.set(date);
    this.open.set(false);
  }
}
