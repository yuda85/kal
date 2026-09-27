import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { firebaseConfig } from '../../core/firebase-config';
import { KalState } from '../../core/kal-state';
import { Toast } from '../../core/toast';

export function skillConfigJson(uid: string): string {
  return JSON.stringify({ baseUrl: 'https://yuda85.github.io/kal/', projectId: firebaseConfig.projectId, uid }, null, 2);
}

@Component({
  selector: 'app-settings',
  imports: [RouterLink],
  template: `
    <h2>הגדרות</h2>
    <section class="card stack">
      <a routerLink="/setup">עריכת פרופיל, יעד ומגבלות</a>
      <div class="muted small">סנכרון Garmin אחרון: <span class="num">{{ lastSync() }}</span></div>
    </section>

    <section class="card stack">
      <h3>חיבור ל-Claude</h3>
      <p class="muted small">העתק לקובץ <span class="num">.claude/skills/kal/config.json</span> בריפו:</p>
      <pre class="num">{{ config() }}</pre>
      <button type="button" (click)="copy()">העתקה</button>
    </section>

    <button type="button" class="signout" (click)="signOut()">התנתקות</button>
  `,
  styles: `
    section { margin-block-end: 12px; }
    pre { background: var(--bg); border-radius: var(--radius); padding: 8px; overflow-x: auto; font-size: 12px; margin: 0; }
    .signout { width: 100%; color: var(--danger); }
  `,
})
export class Settings {
  private readonly state = inject(KalState);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  protected readonly config = computed(() => skillConfigJson(this.state.uid() ?? ''));
  protected readonly lastSync = computed(() => {
    const at = this.state.profile()?.garminLastSyncAt;
    return at ? new Date(at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : 'עדיין לא';
  });

  protected async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.config());
    this.toast.show('הועתק');
  }

  protected async signOut(): Promise<void> {
    this.state.stop();
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
