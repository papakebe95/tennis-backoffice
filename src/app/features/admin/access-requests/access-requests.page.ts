import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, resource } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { ApiError } from '../../../core/api/api';
import { I18nService } from '../../../core/i18n/i18n.service';
import { injectListQuery } from '../../../shared/data/list-query';
import { TbAgoPipe, TbDatePipe } from '../../../shared/format';
import { EmptyState, UserCell } from '../../../shared/ui/bits';
import { ConfirmService } from '../../../shared/ui/confirm';
import { PageHeader } from '../../../shared/ui/page-header';
import { SearchInput } from '../../../shared/ui/search-input';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { AdminApi } from '../admin.api';
import type { AccessRequest, AccessRequestDetail } from '../admin.models';

const TABS = ['OPEN', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'] as const;

@Component({
  selector: 'tb-access-requests-page',
  imports: [RouterLink, ButtonModule, DrawerModule, SkeletonModule, TableModule, PageHeader, SearchInput, StatusBadge, UserCell, EmptyState, TbDatePipe, TbAgoPipe],
  templateUrl: './access-requests.page.html',
  styleUrls: ['../admin-list.scss', './access-requests.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRequestsPage {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  /** ?request= : the request open in the drawer. */
  readonly request = input<string>();

  protected readonly tabs = TABS;
  protected readonly list = injectListQuery(['status'], { sort: 'createdAt:asc' });
  protected readonly status = computed(() => this.list.query().filters['status'] ?? 'OPEN');
  protected readonly requests = resource({ params: () => this.list.query(), loader: ({ params }) => this.api.accessRequests(params) });
  protected readonly page = linkedSignal<ReturnType<typeof this.requests.value>, ReturnType<typeof this.requests.value>>({
    source: () => this.requests.value(),
    computation: (value, previous) => value ?? previous?.value,
  });

  protected readonly detail = resource({
    params: () => this.request(),
    loader: ({ params }) => this.api.accessRequest(params),
  });
  protected readonly drawerOpen = computed(() => !!this.request());

  protected count(tab: (typeof TABS)[number]): number | null {
    const counts = this.page()?.counts;
    if (!counts) return null;
    if (tab === 'OPEN') return (counts.PENDING ?? 0) + (counts.INFO_REQUESTED ?? 0);
    if (tab === 'ALL') return null;
    return counts[tab] ?? 0;
  }

  protected setTab(tab: (typeof TABS)[number]) {
    void this.list.update({ status: tab === 'OPEN' ? null : tab });
  }

  protected open(id: string | null) {
    void this.router.navigate([], { queryParams: { request: id }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected organizationLabel(r: AccessRequest): string {
    if (r.organization) return r.organization.name;
    if (r.proposedOrganization) return this.t('accessRequests.newOrganization', { name: r.proposedOrganization.name });
    return this.t('accessRequests.none');
  }

  protected isOpen(r: AccessRequest) {
    return r.status === 'PENDING' || r.status === 'INFO_REQUESTED';
  }

  protected async approve(r: AccessRequestDetail) {
    const name = `${r.user.firstname} ${r.user.lastname}`;
    const result = await this.confirm.ask({
      title: this.t('accessRequests.approveTitle'),
      message: this.t('accessRequests.approveBody', {
        name,
        role: r.organization || r.proposedOrganization ? `${r.role.name} · ${this.organizationLabel(r)}` : r.role.name,
      }),
      detail: !r.organization && r.proposedOrganization
        ? this.t('accessRequests.approveCreates', { org: r.proposedOrganization.name })
        : undefined,
      confirmLabel: this.t('accessRequests.approve'),
      reason: 'optional',
    });
    if (result) await this.run(() => this.api.approveRequest(r.id, result.reason), 'accessRequests.approved');
  }

  protected async reject(r: AccessRequestDetail) {
    const result = await this.confirm.ask({
      title: this.t('accessRequests.rejectTitle'),
      message: this.t('accessRequests.rejectBody'),
      confirmLabel: this.t('accessRequests.reject'),
      severity: 'danger',
      reason: 'optional',
    });
    if (result) await this.run(() => this.api.rejectRequest(r.id, result.reason), 'accessRequests.rejected');
  }

  protected async requestInfo(r: AccessRequestDetail) {
    const result = await this.confirm.ask({
      title: this.t('accessRequests.requestInfoTitle'),
      message: this.t('accessRequests.requestInfoBody'),
      confirmLabel: this.t('access.send'),
      reason: 'required',
      reasonLabel: this.t('accessRequests.question'),
    });
    if (result?.reason) await this.run(() => this.api.requestInfo(r.id, result.reason!), 'accessRequests.infoRequested');
  }

  private async run(action: () => Promise<unknown>, successKey: string) {
    try {
      await action();
      this.toasts.add({ severity: 'success', summary: this.t(successKey) });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
    this.detail.reload();
    this.requests.reload();
  }
}
