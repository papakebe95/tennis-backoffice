import { computed, inject, Injectable } from '@angular/core';
import { SessionStore } from '../auth/session.store';
import type { AccessGrant, GrantedOrganization } from '../auth/auth.models';
import type { Permission, PermissionRule } from './permissions';

/** Where a check applies. Omitted: "held anywhere". */
export interface ScopeRef {
  organizationId?: string;
  competitionId?: string;
}

interface PermissionIndex {
  global: Set<string>;
  byOrganization: Map<string, Set<string>>;
  byCompetition: Map<string, Set<string>>;
  anywhere: Set<string>;
  roles: Set<string>;
}

/**
 * Mirrors the API's authorization for UX only — menus, route guards and
 * action buttons. The API re-checks every call against the stored resource;
 * nothing here is a security boundary.
 *
 * All checks go through this service; components never test role names.
 */
@Injectable({ providedIn: 'root' })
export class AuthzService {
  private readonly session = inject(SessionStore);

  readonly grants = computed<AccessGrant[]>(() => this.session.profile()?.grants ?? []);
  private readonly index = computed(() => buildIndex(this.grants()));

  /** Organizations the user holds any grant in, deduplicated. */
  readonly organizations = computed<GrantedOrganization[]>(() => {
    const seen = new Map<string, GrantedOrganization>();
    for (const grant of this.grants()) {
      if (grant.organization) seen.set(grant.organization.id, grant.organization);
    }
    return [...seen.values()];
  });

  readonly competitions = computed(() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const grant of this.grants()) {
      if (grant.competition) seen.set(grant.competition.id, grant.competition);
    }
    return [...seen.values()];
  });

  readonly hasGlobalAccess = computed(() => this.index().global.size > 0);

  /**
   * True when `permission` is held for `scope`: a global grant, or a grant on
   * that organization/competition. Without a scope: held anywhere.
   */
  hasPermission(permission: Permission, scope?: ScopeRef): boolean {
    const index = this.index();
    if (!scope) return index.anywhere.has(permission);
    if (index.global.has(permission)) return true;
    if (scope.organizationId && index.byOrganization.get(scope.organizationId)?.has(permission)) return true;
    if (scope.competitionId && index.byCompetition.get(scope.competitionId)?.has(permission)) return true;
    return false;
  }

  /** Global grants only (platform administration screens). */
  hasGlobalPermission(permission: Permission): boolean {
    return this.index().global.has(permission);
  }

  hasAnyPermission(permissions: readonly Permission[], scope?: ScopeRef): boolean {
    return permissions.some((p) => this.hasPermission(p, scope));
  }

  hasAllPermissions(permissions: readonly Permission[], scope?: ScopeRef): boolean {
    return permissions.every((p) => this.hasPermission(p, scope));
  }

  /**
   * Evaluates a rule in a workspace scope: 'global' counts global grants
   * only; an organization/competition scope also counts grants on it; no
   * scope (no workspace) allows nothing.
   */
  allows(rule: PermissionRule, scope: ScopeRef | 'global' | null): boolean {
    const check = (p: Permission) =>
      scope === 'global' ? this.hasGlobalPermission(p) : scope ? this.hasPermission(p, scope) : false;
    return 'any' in rule ? rule.any.some(check) : rule.all.every(check);
  }

  /** Role membership, for display only — prefer permission checks. */
  hasRole(roleKey: string): boolean {
    return this.index().roles.has(roleKey);
  }
}

export function buildIndex(grants: readonly AccessGrant[]): PermissionIndex {
  const index: PermissionIndex = {
    global: new Set(),
    byOrganization: new Map(),
    byCompetition: new Map(),
    anywhere: new Set(),
    roles: new Set(),
  };
  const add = (map: Map<string, Set<string>>, id: string, permissions: string[]) => {
    const set = map.get(id) ?? new Set<string>();
    permissions.forEach((p) => set.add(p));
    map.set(id, set);
  };
  for (const grant of grants) {
    index.roles.add(grant.roleKey);
    grant.permissions.forEach((p) => index.anywhere.add(p));
    if (grant.scope === 'GLOBAL') grant.permissions.forEach((p) => index.global.add(p));
    else if (grant.scope === 'ORGANIZATION' && grant.organization) {
      add(index.byOrganization, grant.organization.id, grant.permissions);
    } else if (grant.scope === 'COMPETITION' && grant.competition) {
      add(index.byCompetition, grant.competition.id, grant.permissions);
    }
  }
  return index;
}
