import type { Routes } from '@angular/router';
import { authGuard, guestGuard, pendingGuard } from './core/auth/guards';

// Every feature is lazy-loaded. Feature routes that need a permission declare
// it as `data: { permissions }` with `canMatch: [permissionGuard]`.
export const routes: Routes = [
  {
    path: 'login',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'pending',
    canMatch: [pendingGuard],
    loadComponent: () => import('./features/auth/pending.page').then((m) => m.PendingPage),
  },
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () => import('./core/layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'forbidden',
        data: { variant: 'forbidden' },
        loadComponent: () => import('./features/errors/error.page').then((m) => m.ErrorPage),
      },
      {
        path: '**',
        data: { variant: 'notFound' },
        loadComponent: () => import('./features/errors/error.page').then((m) => m.ErrorPage),
      },
    ],
  },
  // Signed out on an unknown URL: the auth guard above sends them to /login.
  { path: '**', redirectTo: 'login' },
];
