import { inject } from '@angular/core';
import { type CanMatchFn, Router } from '@angular/router';
import { AuthzService } from '../authz/authz.service';
import type { PermissionRule } from '../authz/permissions';
import { SessionStore } from './session.store';

/** Signed in with an active account; pending accounts go to /pending. */
export const authGuard: CanMatchFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  if (!session.isAuthenticated()) return router.createUrlTree(['/login']);
  if (session.isPending()) return router.createUrlTree(['/pending']);
  return true;
};

export const pendingGuard: CanMatchFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  if (!session.isAuthenticated()) return router.createUrlTree(['/login']);
  return session.isPending() ? true : router.createUrlTree(['/']);
};

export const guestGuard: CanMatchFn = () => {
  const session = inject(SessionStore);
  return session.isAuthenticated() ? inject(Router).createUrlTree(['/']) : true;
};

/**
 * Route data `{ permissions: PermissionRule }`. Hides routes the user can't
 * use (UX only — the API enforces the real rule).
 */
export const permissionGuard: CanMatchFn = (route) => {
  const rule = route.data?.['permissions'] as PermissionRule | undefined;
  if (!rule) return true;
  const authz = inject(AuthzService);
  const allowed = 'any' in rule ? authz.hasAnyPermission(rule.any) : authz.hasAllPermissions(rule.all);
  return allowed || inject(Router).createUrlTree(['/forbidden']);
};
