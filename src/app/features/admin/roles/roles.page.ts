import { ChangeDetectionStrategy, Component, computed, effect, inject, input, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ApiError } from '../../../core/api/api';
import type { OrganizationType, RoleScope } from '../../../core/auth/auth.models';
import { AuthzService } from '../../../core/authz/authz.service';
import { describeError } from '../../../core/http/interceptors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { EmptyState } from '../../../shared/ui/bits';
import { ConfirmService } from '../../../shared/ui/confirm';
import { PageHeader } from '../../../shared/ui/page-header';
import { AdminApi } from '../admin.api';
import type { PermissionEntry, Role } from '../admin.models';

const SCOPES: RoleScope[] = ['GLOBAL', 'ORGANIZATION', 'COMPETITION'];
const ORG_TYPES: OrganizationType[] = ['FEDERATION', 'CLUB', 'COMMUNITY'];

/** Editable copy of a role. */
interface Draft {
  name: string;
  description: string;
  scope: RoleScope;
  organizationType: OrganizationType | null;
  selfRegistrable: boolean;
  permissions: Set<string>;
}

@Component({
  selector: 'tb-roles-page',
  imports: [
    FormsModule,
    ButtonModule,
    CheckboxModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    SkeletonModule,
    TabsModule,
    TagModule,
    TextareaModule,
    ToggleSwitchModule,
    PageHeader,
    EmptyState,
  ],
  templateUrl: './roles.page.html',
  styleUrl: './roles.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPage {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly toasts = inject(MessageService);
  private readonly confirm = inject(ConfirmService);
  protected readonly canManage = inject(AuthzService).hasGlobalPermission('role.manage');

  /** ?role= query param: the role being edited. */
  readonly role = input<string>();

  protected readonly roles = resource({ loader: () => this.api.roles() });
  protected readonly catalog = resource({ loader: () => this.api.permissions() });

  protected readonly selected = computed(() => this.roles.value()?.find((r) => r.id === this.role()) ?? null);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly saving = signal(false);

  protected readonly scopeOptions = computed(() => SCOPES.map((s) => ({ label: this.t(`roleScope.${s}`), value: s })));
  protected readonly orgTypeOptions = computed(() => [
    { label: this.t('roles.anyOrganization'), value: null },
    ...ORG_TYPES.map((type) => ({ label: this.t(`organizationType.${type}`), value: type })),
  ]);

  /** Catalog grouped by module, in catalog order. */
  protected readonly modules = computed(() => {
    const groups = new Map<string, PermissionEntry[]>();
    for (const entry of this.catalog.value() ?? []) {
      groups.set(entry.module, [...(groups.get(entry.module) ?? []), entry]);
    }
    return [...groups.entries()].map(([module, permissions]) => ({ module, permissions }));
  });

  protected readonly readOnly = computed(() => !this.canManage || !!this.selected()?.isSystem);
  protected readonly dirty = computed(() => {
    const role = this.selected();
    const draft = this.draft();
    if (!role || !draft) return false;
    return (
      draft.name !== role.name ||
      draft.description !== (role.description ?? '') ||
      draft.scope !== role.scope ||
      draft.organizationType !== role.organizationType ||
      draft.selfRegistrable !== role.selfRegistrable ||
      draft.permissions.size !== role.permissions.length ||
      role.permissions.some((p) => !draft.permissions.has(p))
    );
  });

  // New-role dialog
  protected readonly creating = signal(false);
  protected readonly newRole = signal({ key: '', name: '', scope: 'ORGANIZATION' as RoleScope });
  protected readonly createError = signal<string | null>(null);

  constructor() {
    // Reset the draft whenever the selection (or its saved state) changes.
    effect(() => {
      const role = this.selected();
      this.draft.set(role ? toDraft(role) : null);
    });
  }

  protected select(role: Role) {
    void this.router.navigate([], { queryParams: { role: role.id }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected discard() {
    const role = this.selected();
    this.draft.set(role ? toDraft(role) : null);
  }

  protected patch(changes: Partial<Draft>) {
    const draft = this.draft();
    if (draft) this.draft.set({ ...draft, ...changes });
  }

  protected allowed(entry: PermissionEntry): boolean {
    const scope = this.draft()?.scope;
    return !!scope && entry.scopes.includes(scope);
  }

  protected toggle(key: string, on: boolean) {
    const draft = this.draft();
    if (!draft) return;
    const permissions = new Set(draft.permissions);
    if (on) permissions.add(key);
    else permissions.delete(key);
    this.draft.set({ ...draft, permissions });
  }

  protected toggleModule(entries: PermissionEntry[], on: boolean) {
    const draft = this.draft();
    if (!draft) return;
    const permissions = new Set(draft.permissions);
    for (const entry of entries) {
      if (!entry.scopes.includes(draft.scope)) continue;
      if (on) permissions.add(entry.key);
      else permissions.delete(entry.key);
    }
    this.draft.set({ ...draft, permissions });
  }

  protected moduleState(entries: PermissionEntry[]): boolean {
    const draft = this.draft();
    const available = entries.filter((e) => draft && e.scopes.includes(draft.scope));
    return available.length > 0 && available.every((e) => draft!.permissions.has(e.key));
  }

  protected moduleCount(entries: PermissionEntry[]): number {
    const draft = this.draft();
    return draft ? entries.filter((e) => draft.permissions.has(e.key)).length : 0;
  }

  protected async save() {
    const role = this.selected();
    const draft = this.draft();
    if (!role || !draft) return;
    this.saving.set(true);
    try {
      // Permissions not grantable at the new level are dropped with it.
      const permissions = [...draft.permissions].filter((key) =>
        this.catalog.value()?.find((e) => e.key === key)?.scopes.includes(draft.scope),
      );
      await this.api.updateRole(role.id, {
        name: draft.name.trim(),
        description: draft.description.trim(),
        scope: draft.scope,
        organizationType: draft.scope === 'ORGANIZATION' ? draft.organizationType : null,
        selfRegistrable: draft.selfRegistrable,
      });
      await this.api.setRolePermissions(role.id, permissions);
      this.toasts.add({ severity: 'success', summary: this.t('roles.saved') });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    } finally {
      this.saving.set(false);
      this.roles.reload();
      this.catalog.reload();
    }
  }

  protected async remove() {
    const role = this.selected();
    if (!role) return;
    const ok = await this.confirm.ask({
      title: this.t('roles.deleteTitle'),
      message: this.t('roles.deleteBody', { name: role.name }),
      confirmLabel: this.t('roles.delete'),
      severity: 'danger',
    });
    if (!ok) return;
    try {
      await this.api.deleteRole(role.id);
      this.toasts.add({ severity: 'success', summary: this.t('roles.deleted') });
      void this.router.navigate([], { queryParams: { role: null }, queryParamsHandling: 'merge' });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
    this.roles.reload();
  }

  protected openCreate() {
    this.newRole.set({ key: '', name: '', scope: 'ORGANIZATION' });
    this.createError.set(null);
    this.creating.set(true);
  }

  protected async create() {
    const { key, name, scope } = this.newRole();
    this.createError.set(null);
    try {
      const role = await this.api.createRole({ key: key.trim().toUpperCase(), name: name.trim(), scope, permissions: [] });
      this.creating.set(false);
      this.toasts.add({ severity: 'success', summary: this.t('roles.created') });
      this.roles.reload();
      this.select(role);
    } catch (raw) {
      this.createError.set(describeError(ApiError.from(raw), this.t));
    }
  }

  protected setNewRole(changes: Partial<{ key: string; name: string; scope: RoleScope }>) {
    this.newRole.set({ ...this.newRole(), ...changes });
  }
}

function toDraft(role: Role): Draft {
  return {
    name: role.name,
    description: role.description ?? '',
    scope: role.scope,
    organizationType: role.organizationType,
    selfRegistrable: role.selfRegistrable,
    permissions: new Set(role.permissions),
  };
}
