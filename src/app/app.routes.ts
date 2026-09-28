import type { Routes } from '@angular/router';
import { authGuard, guestGuard, passwordChangeGuard, pendingGuard, permissionGuard } from './core/auth/guards';

// Every feature is lazy-loaded. Feature routes that need a permission declare
// it as `data: { permissions }` with `canMatch: [permissionGuard]`.
export const routes: Routes = [
  {
    path: 'login',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/access/access-pages').then((m) => m.RegisterPage),
  },
  {
    path: 'change-password',
    canMatch: [passwordChangeGuard],
    loadComponent: () => import('./features/access/access-pages').then((m) => m.ForcedPasswordPage),
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
        path: 'users',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['user.view'] } },
        loadComponent: () => import('./features/admin/users/users-list.page').then((m) => m.UsersListPage),
      },
      {
        path: 'users/:id',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['user.view'] } },
        loadComponent: () => import('./features/admin/users/user-detail.page').then((m) => m.UserDetailPage),
      },
      {
        path: 'roles',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['role.view'] } },
        loadComponent: () => import('./features/admin/roles/roles.page').then((m) => m.RolesPage),
      },
      {
        path: 'access-requests',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['access_request.review'] } },
        loadComponent: () =>
          import('./features/admin/access-requests/access-requests.page').then((m) => m.AccessRequestsPage),
      },
      {
        path: 'audit-logs',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['audit.view'] } },
        loadComponent: () => import('./features/admin/audit/audit-log.page').then((m) => m.AuditLogPage),
      },
      {
        path: 'access',
        loadComponent: () => import('./features/access/access-pages').then((m) => m.AccessPage),
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
