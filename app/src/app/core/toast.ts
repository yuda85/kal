import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Toast {
  private readonly text = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;
  readonly message = this.text.asReadonly();

  show(text: string): void {
    this.text.set(text);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.text.set(null), 3000);
  }
}
