import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthzService } from '../../core/authz/authz.service';
import { WorkspaceStore } from '../../core/context/workspace.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { PageHeader } from '../../shared/ui/page-header';
import { AnnouncementsPanel } from './announcements-panel';
import type { AnnouncementTarget } from './insights.models';

/** /clubs/:id/announcements and /federations/:id/announcements. */
@Component({
  selector: 'tb-announcements-page',
  imports: [PageHeader, AnnouncementsPanel],
  template: `
    <tb-page-header [title]="t('announcements.title')" [subtitle]="t('announcements.subtitle')" />
    <tb-announcements-panel [target]="target()" [canSend]="canSend()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnouncementsPage {
  protected readonly t = inject(I18nService).t;
  private readonly authz = inject(AuthzService);
  private readonly workspaces = inject(WorkspaceStore);
  private readonly kind = inject(ActivatedRoute).snapshot.data['kind'] as 'club' | 'federation';

  readonly id = input.required<string>();
  protected readonly target = computed<AnnouncementTarget>(() => ({ kind: this.kind, id: this.id() }));
  /** The organization behind the page: the federation itself, or the club's (from the workspace). */
  private readonly organizationId = computed(() =>
    this.kind === 'federation' ? this.id() : (this.workspaces.organization()?.clubId === this.id() ? this.workspaces.organization()?.id : undefined),
  );
  protected readonly canSend = computed(() => this.authz.hasPermission('notification.broadcast', { organizationId: this.organizationId() }) || this.authz.hasGlobalPermission('notification.broadcast'));
}
