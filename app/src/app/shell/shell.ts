import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideCalendarDays, LucideChefHat, LucideHouse, LucideScale, LucideSettings } from '@lucide/angular';
import { Toast } from '../core/toast';
import { QuickAdd } from '../features/today/quick-add';
import { QuickAddService } from '../features/today/quick-add.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideHouse, LucideCalendarDays, LucideScale, LucideChefHat, LucideSettings, QuickAdd],
  template: `
    <header class="top row">
      <strong>kal</strong>
      <a routerLink="/settings" aria-label="הגדרות" class="icon"><svg lucideSettings [size]="20"></svg></a>
    </header>
    <main><router-outlet /></main>
    @if (toast.message(); as message) {
      <div class="toast" role="status">{{ message }}</div>
    }
    @if (quickAdd.tab()) {
      <app-quick-add />
    }
    <nav class="tabs" aria-label="ניווט">
      <a routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }"><svg lucideHouse [size]="20"></svg>היום</a>
      <a routerLink="/week" routerLinkActive="on"><svg lucideCalendarDays [size]="20"></svg>שבוע</a>
      <a routerLink="/weight" routerLinkActive="on"><svg lucideScale [size]="20"></svg>משקל</a>
      <a routerLink="/recipes" routerLinkActive="on"><svg lucideChefHat [size]="20"></svg>מתכונים</a>
    </nav>
  `,
  styles: `
    :host { display: block; max-width: 480px; margin-inline: auto; min-height: 100dvh; }
    .top { position: sticky; inset-block-start: 0; padding: 12px 16px; background: var(--bg); z-index: 2; }
    .icon { display: inline-grid; place-items: center; min-width: 44px; min-height: 44px; }
    main { padding: 0 16px calc(88px + env(safe-area-inset-bottom)); }
    .tabs {
      position: fixed; inset-inline: 0; inset-block-end: 0; display: flex; justify-content: space-around;
      background: var(--card); border-block-start: 1px solid var(--border);
      padding: 6px 0 calc(6px + env(safe-area-inset-bottom)); z-index: 3;
    }
    .tabs a { display: grid; justify-items: center; gap: 2px; min-width: 64px; min-height: 44px; font-size: 11px; color: var(--fg-muted); text-decoration: none; }
    .tabs a.on { color: var(--out); }
    .toast {
      position: fixed; inset-inline: 16px; inset-block-end: calc(80px + env(safe-area-inset-bottom));
      background: var(--fg); color: var(--bg); border-radius: var(--radius); padding: 10px 14px; text-align: center; z-index: 5;
    }
  `,
})
export class Shell {
  protected readonly toast = inject(Toast);
  protected readonly quickAdd = inject(QuickAddService);
}
