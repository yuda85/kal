import { Injectable, signal } from '@angular/core';
import type { Entry } from '../../domain';

export type QuickAddTab = 'meal' | 'weight';

@Injectable({ providedIn: 'root' })
export class QuickAddService {
  readonly tab = signal<QuickAddTab | null>(null);
  readonly editing = signal<Entry | null>(null);

  open(tab: QuickAddTab = 'meal'): void {
    this.editing.set(null);
    this.tab.set(tab);
  }

  edit(entry: Entry): void {
    this.editing.set(entry);
    this.tab.set('meal');
  }

  close(): void {
    this.tab.set(null);
    this.editing.set(null);
  }
}
