import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { ApiError } from '../../../core/api/api';
import { SessionStore } from '../../../core/auth/session.store';
import { AuthzService } from '../../../core/authz/authz.service';
import { CanDirective } from '../../../core/authz/can.directive';
import { I18nService } from '../../../core/i18n/i18n.service';
import { auditActionLabel, TbAgoPipe, TbDatePipe } from '../../../shared/format';
import { ConfirmService } from '../../../shared/ui/confirm';
import { EmptyState, UserCell } from '../../../shared/ui/bits';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { AdminApi } from '../admin.api';
import type { UserDetail } from '../admin.models';
import { AssignRoleDrawer } from './assign-role-drawer';

type Grant = UserDetail['grants'][number];

@Component({
  selector: 'tb-user-detail-page',
  imports: [
    RouterLink,
    ButtonModule,
    DialogModule,
    SkeletonModule,
    TabsModule,
    TagModule,
    CanDirective,
    StatusBadge,
    UserCell,
    EmptyState,
    AssignRoleDrawer,
    TbDatePipe,
    TbAgoPipe,
  ],
  templateUrl: './user-detail.page.html',
  styleUrl: './user-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserDetailPage {
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly api = inject(AdminApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);
  protected readonly authz = inject(AuthzService);
  private readonly session = inject(SessionStore);

  /** Route param. */
  readonly id = input.required<string>();

  protected readonly user = resource({ params: () => this.id(), loader: ({ params }) => this.api.user(params) });
  protected readonly isSelf = computed(() => this.session.user()?.id === this.id());

  protected readonly activeGrants = computed(() => (this.user.value()?.grants ?? []).filter((g) => !g.revokedAt));
  protected readonly pastGrants = computed(() => (this.user.value()?.grants ?? []).filter((g) => g.revokedAt));

  // Permission descriptions and modules, when the viewer may read the catalog.
  private readonly catalog = resource({
    params: () => (this.authz.hasGlobalPermission('role.view') ? true : undefined),
    loader: () => this.api.permissions(),
  });

  /** Effective permissions grouped by where they apply. */
  protected readonly permissionScopes = computed(() => {
    const byKey = new Map((this.catalog.value() ?? []).map((p) => [p.key, p]));
    const groups = new Map<string, { label: string; permissions: Set<string> }>();
    for (const grant of this.activeGrants()) {
      const id = grant.organization?.id ?? grant.competition?.id ?? 'global';
      const label = grant.organization?.name ?? grant.competition?.name ?? this.t('users.platform');
      const group = groups.get(id) ?? { label, permissions: new Set<string>() };
      grant.permissions.forEach((p) => group.permissions.add(p));
      groups.set(id, group);
    }
    return [...groups.values()].map((group) => ({
      label: group.label,
      permissions: [...group.permissions].sort().map((key) => ({
        key,
        description: byKey.get(key)?.description ?? key,
      })),
    }));
  });

  // Changes made to this account, from the audit log.
  protected readonly activity = resource({
    params: () => (this.authz.hasGlobalPermission('audit.view') ? this.id() : undefined),
    loader: ({ params }) =>
      this.api.auditLogs({ page: 1, pageSize: 20, filters: { entityType: 'User', entityId: params } }),
  });

  protected readonly assignOpen = signal(false);
  protected readonly temporaryPassword = signal<string | null>(null);
  protected readonly copied = signal(false);

  protected scopeOf(grant: Grant): string {
    return grant.organization?.name ?? grant.competition?.name ?? this.t('users.platform');
  }

  protected canRevoke(grant: Grant): boolean {
    const scope = grant.organization
      ? { organizationId: grant.organization.id }
      : grant.competition
        ? { competitionId: grant.competition.id }
        : undefined;
    return scope ? this.authz.hasPermission('user.roles.assign', scope) : this.authz.hasGlobalPermission('user.roles.assign');
  }

  protected actionLabel(action: string) {
    return auditActionLabel(this.i18n, action);
  }

  protected async setStatus(status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED') {
    const result = await this.confirm.ask({
      title: this.t(`users.confirm.${status}.title`),
      message: this.t(`users.confirm.${status}.body`),
      confirmLabel: this.t(status === 'ACTIVE' ? 'users.actions.activate' : status === 'SUSPENDED' ? 'users.actions.suspend' : 'users.actions.disable'),
      severity: status === 'ACTIVE' ? 'primary' : 'danger',
      reason: status === 'ACTIVE' ? 'optional' : 'required',
    });
    if (!result) return;
    await this.run(() => this.api.setUserStatus(this.id(), status, result.reason), 'users.statusChanged');
  }

  protected async resetPassword() {
    const result = await this.confirm.ask({
      title: this.t('users.reset.title'),
      message: this.t('users.reset.body'),
      confirmLabel: this.t('users.actions.resetPassword'),
      severity: 'warn',
    });
    if (!result) return;
    try {
      const { temporaryPassword } = await this.api.resetPassword(this.id());
      this.copied.set(false);
      this.temporaryPassword.set(temporaryPassword);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error; // already shown as a toast
    }
    this.user.reload();
  }

  protected async copyPassword() {
    const value = this.temporaryPassword();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      this.copied.set(true);
    } catch {
      // Clipboard blocked: the password stays selectable on screen.
    }
  }

  protected async revoke(grant: Grant) {
    const result = await this.confirm.ask({
      title: this.t('users.revokeTitle'),
      message: this.t('users.revokeBody', { role: grant.role.name, scope: this.scopeOf(grant) }),
      confirmLabel: this.t('users.revoke'),
      severity: 'danger',
      reason: 'optional',
    });
    if (!result) return;
    await this.run(() => this.api.revokeRole(this.id(), grant.id, result.reason), 'users.roleRevoked');
  }

  protected onAssigned() {
    this.toasts.add({ severity: 'success', summary: this.t('users.roleAssigned') });
    this.user.reload();
    this.activity.reload();
  }

  private async run(action: () => Promise<unknown>, successKey: string) {
    try {
      await action();
      this.toasts.add({ severity: 'success', summary: this.t(successKey) });
    } catch (error) {
      // The error interceptor already showed it; keep the page consistent.
      if (!(error instanceof ApiError)) throw error;
    }
    this.user.reload();
    this.activity.reload();
  }
}
