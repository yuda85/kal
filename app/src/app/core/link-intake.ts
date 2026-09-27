import { Injectable, signal } from '@angular/core';
import { payloadParam } from '../domain';

@Injectable({ providedIn: 'root' })
export class LinkIntake {
  readonly pending = signal<string | null>(null);

  capture(
    loc: Pick<Location, 'hash' | 'pathname' | 'search'> = location,
    hist: Pick<History, 'replaceState'> = history,
  ): void {
    const encoded = payloadParam(loc.hash);
    if (!encoded) return;
    this.pending.set(encoded);
    hist.replaceState(null, '', loc.pathname + loc.search);
  }

  clear(): void {
    this.pending.set(null);
  }
}
