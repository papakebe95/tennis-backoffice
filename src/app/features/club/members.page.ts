import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ApiError } from '../../core/api/api';
import { AuthzService } from '../../core/authz/authz.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectListQuery } from '../../shared/data/list-query';
import { TbDatePipe, TbMoneyPipe } from '../../shared/format';
import { EmptyState, UserCell } from '../../shared/ui/bits';
import { PageHeader } from '../../shared/ui/page-header';
import { SearchInput } from '../../shared/ui/search-input';
import { StatusBadge } from '../../shared/ui/status-badge';
import { OrgApi } from '../organizations/org.api';
import { AddMemberDrawer } from './add-member-drawer';
import { ClubApi, download } from './club.api';
import { MemberDrawer } from './member-drawer';
import { PlansDrawer } from './plans-drawer';

const MEMBER_STATUSES = ['ACTIVE', 'SUSPENDED', 'LEFT'];
const PAYMENT_STATUSES = ['PAID', 'PARTIALLY_PAID', 'PENDING', 'OVERDUE', 'EXPIRED'];

/** /clubs/:id/members */
@Component({
  selector: 'tb-members-page',
  imports: [FormsModule, ButtonModule, SelectModule, TableModule, PageHeader, SearchInput, StatusBadge, UserCell, EmptyState, TbDatePipe, TbMoneyPipe, AddMemberDrawer, MemberDrawer, PlansDrawer],
  template: `
    <tb-page-header [title]="t('members.title')" [subtitle]="club.value()?.name ?? t('members.subtitle')">
      <p-button [label]="t('members.export')" icon="pi pi-download" severity="secondary" [outlined]="true" [loading]="exporting()" (onClick)="export()" />
      <p-button [label]="t('members.plans')" icon="pi pi-tags" severity="secondary" [outlined]="true" (onClick)="plansOpen.set(true)" />
      @if (canManage()) {
        <p-button [label]="t('members.add')" icon="pi pi-user-plus" (onClick)="addOpen.set(true)" />
      }
    </tb-page-header>

    <div class="tb-card list-card">
      <div class="filters">
        <tb-search-input [value]="list.query().q" [placeholder]="t('members.searchPlaceholder')" (search)="list.update({ q: $event })" />
        <p-select [options]="paymentOptions()" [ngModel]="list.query().filters['paymentStatus'] ?? null" (ngModelChange)="list.update({ paymentStatus: $event })" [placeholder]="t('members.paymentStatus')" [showClear]="true" [attr.aria-label]="t('members.paymentStatus')" />
        <p-select [options]="statusOptions()" [ngModel]="list.query().filters['status'] ?? null" (ngModelChange)="list.update({ status: $event })" [placeholder]="t('members.status')" [showClear]="true" [attr.aria-label]="t('members.status')" />
        <p-select [options]="planOptions()" [ngModel]="list.query().filters['planId'] ?? null" (ngModelChange)="list.update({ planId: $event })" [placeholder]="t('members.plan')" [showClear]="true" [attr.aria-label]="t('members.plan')" />
        @if (list.hasFilters()) {
          <p-button [label]="t('list.clearFilters')" [text]="true" severity="secondary" icon="pi pi-filter-slash" (onClick)="list.clearFilters()" />
        }
        <span class="total">{{ t('list.total', { count: page()?.total ?? 0 }) }}</span>
      </div>
      <p-table
        [value]="page()?.items ?? []"
        [lazy]="true"
        [loading]="members.isLoading()"
        [paginator]="true"
        [rows]="list.query().pageSize"
        [first]="list.first()"
        [totalRecords]="page()?.total ?? 0"
        [rowsPerPageOptions]="[20, 50, 100]"
        sortMode="multiple"
        [multiSortMeta]="list.sortMeta()"
        (onLazyLoad)="list.onLazyLoad($event)"
        (onSort)="list.onSort($event)"
        dataKey="id"
        [rowHover]="true"
        styleClass="tb-table"
      >
        <ng-template #header>
          <tr>
            <th pSortableColumn="lastname">{{ t('members.columns.member') }} <p-sorticon field="lastname" /></th>
            <th pSortableColumn="membershipNumber">{{ t('members.columns.number') }} <p-sorticon field="membershipNumber" /></th>
            <th>{{ t('members.columns.plan') }}</th>
            <th pSortableColumn="expiresAt">{{ t('members.columns.expires') }} <p-sorticon field="expiresAt" /></th>
            <th>{{ t('members.columns.due') }}</th>
            <th>{{ t('members.columns.payment') }}</th>
            <th>{{ t('members.columns.level') }}</th>
            <th>{{ t('members.columns.status') }}</th>
          </tr>
        </ng-template>
        <ng-template #body let-m>
          <tr class="clickable" (click)="open(m.id)" (keydown.enter)="open(m.id)" tabindex="0">
            <td><tb-user-cell [firstname]="m.user.firstname" [lastname]="m.user.lastname" [secondary]="m.user.msisdn" /></td>
            <td class="mono">{{ m.membershipNumber }}</td>
            <td>{{ m.currentMembership?.plan?.name ?? t('members.none') }}</td>
            <td class="mono tb-muted">{{ m.currentMembership ? (m.currentMembership.expiresAt | tbDate: 'date') : t('members.none') }}</td>
            <td class="mono">{{ m.remainingDue ? (m.remainingDue | tbMoney) : '—' }}</td>
            <td>
              @if (m.paymentStatus) {
                <tb-status-badge kind="membershipPayment" [value]="m.paymentStatus" />
              }
            </td>
            <td class="tb-muted">{{ m.user.playerProfile ? t('levels.' + m.user.playerProfile.level) : '—' }}</td>
            <td><tb-status-badge kind="member" [value]="m.status" /></td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="8"><tb-empty-state [message]="list.hasFilters() ? t('list.emptyFiltered') : t('list.empty')" icon="pi pi-users" /></td></tr>
        </ng-template>
      </p-table>
    </div>

    <tb-add-member-drawer [clubId]="id()" [(visible)]="addOpen" (added)="open($event); members.reload()" />
    <tb-plans-drawer [clubId]="id()" [(visible)]="plansOpen" [canManage]="canManagePlans()" (changed)="plans.reload()" />
    <tb-member-drawer [clubId]="id()" [memberId]="member() ?? null" [canManage]="canManage()" (closed)="open(null)" (changed)="members.reload()" />
  `,
  styleUrl: '../admin/admin-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersPage {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(ClubApi);
  private readonly orgApi = inject(OrgApi);
  private readonly authz = inject(AuthzService);
  private readonly router = inject(Router);
  private readonly toasts = inject(MessageService);

  /** Route param (club id) and ?member= (open record). */
  readonly id = input.required<string>();
  readonly member = input<string>();

  protected readonly club = resource({ params: () => this.id(), loader: ({ params }) => this.orgApi.club(params) });
  protected readonly plans = resource({ params: () => this.id(), loader: ({ params }) => this.api.plans(params) });
  protected readonly list = injectListQuery(['status', 'paymentStatus', 'planId'], { sort: 'lastname:asc' });
  private readonly apiQuery = computed(() => {
    const q = this.list.query();
    return { ...q, filters: { status: q.filters['status'], paymentStatus: q.filters['paymentStatus'], planId: q.filters['planId'] } };
  });
  protected readonly members = resource({
    params: () => ({ id: this.id(), query: this.apiQuery() }),
    loader: ({ params }) => this.api.members(params.id, params.query),
  });
  protected readonly page = linkedSignal<ReturnType<typeof this.members.value>, ReturnType<typeof this.members.value>>({
    source: () => this.members.value(),
    computation: (value, previous) => value ?? previous?.value,
  });

  private readonly orgId = computed(() => this.club.value()?.organizationId);
  protected readonly canManage = computed(() => !!this.orgId() && this.authz.hasPermission('member.manage', { organizationId: this.orgId() }));
  protected readonly canManagePlans = computed(
    () => !!this.orgId() && this.authz.hasPermission('membership.plan.manage', { organizationId: this.orgId() }),
  );

  protected readonly statusOptions = computed(() => MEMBER_STATUSES.map((s) => ({ label: this.t(`status.member.${s}`), value: s })));
  protected readonly paymentOptions = computed(() =>
    PAYMENT_STATUSES.map((s) => ({ label: this.t(`status.membershipPayment.${s}`), value: s })),
  );
  protected readonly planOptions = computed(() => (this.plans.value() ?? []).map((p) => ({ label: p.name, value: p.id })));

  protected readonly addOpen = signal(false);
  protected readonly plansOpen = signal(false);
  protected readonly exporting = signal(false);

  protected open(memberId: string | null) {
    void this.router.navigate([], { queryParams: { member: memberId }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected async export() {
    this.exporting.set(true);
    try {
      download(await this.api.exportMembers(this.id(), this.apiQuery()), `members-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (error) {
      if (!(error instanceof ApiError)) this.toasts.add({ severity: 'error', summary: this.t('errors.server') });
    } finally {
      this.exporting.set(false);
    }
  }
}
