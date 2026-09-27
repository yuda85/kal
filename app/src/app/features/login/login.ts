import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

const STUCK_HINT = 'החלון לא נפתח או נתקע? נסה שוב, או פתח את האתר ישירות בדפדפן ולא מהמסך הראשי.';

function authMessage(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'חלון ההתחברות נסגר. נסה שוב.';
  if (code === 'auth/popup-blocked') return 'הדפדפן חסם את החלון. אפשר חלונות קופצים לאתר ונסה שוב.';
  if (code === 'auth/unauthorized-domain') return 'הדומיין לא מאושר ב-Firebase (Authentication → Settings → Authorized domains).';
  return STUCK_HINT;
}

@Component({
  selector: 'app-login',
  template: `
    <section class="stack login">
      <h1>kal</h1>
      <p class="muted">מעקב קלוריות</p>
      <button class="primary" type="button" [disabled]="busy()" (click)="signIn()">התחברות עם Google</button>
      @if (hint(); as h) {
        <p class="alert warning" role="alert">{{ h }}</p>
      }
    </section>
  `,
  styles: `.login { max-width: 360px; margin: 20vh auto 0; padding: 0 16px; text-align: center; }`,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly hint = signal<string | null>(null);

  async signIn(): Promise<void> {
    this.busy.set(true);
    this.hint.set(null);
    const timer = setTimeout(() => this.hint.set(STUCK_HINT), 20_000);
    try {
      await this.auth.signInWithGoogle();
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.hint.set(authMessage(e));
    } finally {
      clearTimeout(timer);
      this.busy.set(false);
    }
  }
}
