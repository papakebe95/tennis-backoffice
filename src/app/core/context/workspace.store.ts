import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { GrantedOrganization } from '../auth/auth.models';
import { AuthzService } from '../authz/authz.service';

/**
 * The workspace the user is working in: the platform (global grants), one of
 * their organizations, or one of their tournaments. It decides which
 * scope-dependent menu entries show (a club's courts, a federation's clubs…).
 * Users with several clubs switch between them here instead of seeing a
 * merged view.
 */
export type Workspace =
  | { kind: 'platform' }
  | { kind: 'organization'; organization: GrantedOrganization }
  | { kind: 'competition'; competition: { id: string; name: string } };

const STORAGE_KEY = 'tb.workspace';

export const workspaceId = (workspace: Workspace): string =>
  workspace.kind === 'platform'
    ? 'platform'
    : workspace.kind === 'organization'
      ? `org:${workspace.organization.id}`
      : `competition:${workspace.competition.id}`;

@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  private readonly authz = inject(AuthzService);
  private readonly selectedId = signal<string | null>(readStored());

  readonly available = computed<Workspace[]>(() => [
    ...(this.authz.hasGlobalAccess() ? [{ kind: 'platform' } as const] : []),
    ...this.authz.organizations().map((organization) => ({ kind: 'organization', organization }) as const),
    ...this.authz.competitions().map((competition) => ({ kind: 'competition', competition }) as const),
  ]);

  /** The selected workspace, or the first available one. */
  readonly current = computed<Workspace | null>(() => {
    const all = this.available();
    return all.find((w) => workspaceId(w) === this.selectedId()) ?? all[0] ?? null;
  });

  readonly organization = computed(() => {
    const current = this.current();
    return current?.kind === 'organization' ? current.organization : null;
  });

  readonly competition = computed(() => {
    const current = this.current();
    return current?.kind === 'competition' ? current.competition : null;
  });

  constructor() {
    effect(() => {
      const current = this.current();
      if (!current) return;
      try {
        localStorage.setItem(STORAGE_KEY, workspaceId(current));
      } catch {
        // ignore: only a convenience
      }
    });
  }

  select(workspace: Workspace) {
    this.selectedId.set(workspaceId(workspace));
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
