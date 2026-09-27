import type { Routes } from '@angular/router';
import { authGuard, setupGuard } from './core/guards';
import { Shell } from './shell/shell';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login').then((m) => m.Login) },
  { path: 'setup', canActivate: [authGuard], loadComponent: () => import('./features/wizard/wizard').then((m) => m.Wizard) },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard, setupGuard],
    children: [
      { path: '', loadComponent: () => import('./features/today/today').then((m) => m.Today) },
      { path: 'confirm', loadComponent: () => import('./features/confirm/confirm').then((m) => m.Confirm) },
      { path: 'week', loadComponent: () => import('./features/week/week').then((m) => m.Week) },
      { path: 'weight', loadComponent: () => import('./features/weight/weight').then((m) => m.WeightPage) },
      { path: 'recipes', loadComponent: () => import('./features/recipes/recipes').then((m) => m.Recipes) },
      { path: 'settings', loadComponent: () => import('./features/settings/settings').then((m) => m.Settings) },
    ],
  },
  { path: '**', redirectTo: '' },
];
