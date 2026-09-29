import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ApiError } from '../../core/api/api';
import { AuthzService } from '../../core/authz/authz.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectListQuery } from '../../shared/data/list-query';
import { TbDatePipe, TbMoneyPipe } from '../../shared/format';
import { EmptyState, UserCell } from '../../shared/ui/bits';
import { ConfirmService } from '../../shared/ui/confirm';
import { PageHeader } from '../../shared/ui/page-header';
import { SearchInput } from '../../shared/ui/search-input';
import { StatusBadge } from '../../shared/ui/status-badge';
import { OrgApi } from '../organizations/org.api';
import { ClubApi } from './club.api';
import type { ClubBooking, Payment } from './club.models';
import { RecordPaymentDialog, type PaymentTarget } from './record-payment-dialog';

const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** /clubs/:id/bookings — the club's bookings, with cancellation and payment. */
@Component({
  selector: 'tb-bookings-page',
  imports: [FormsModule, ButtonModule, DatePickerModule, SelectModule, TableModule, PageHeader, SearchInput, StatusBadge, EmptyState, UserCell, TbDatePipe, TbMoneyPipe, RecordPaymentDialog],
  template: `
    <tb-page-header [title]="t('bookings.title')" [subtitle]="club.value()?.name ?? t('bookings.subtitle')" />
    <div class="tb-card list-card">
      <div class="filters">
        <tb-search-input [value]="list.query().q" [placeholder]="t('fedPlayers.searchPlaceholder')" (search)="list.update({ q: $event })" />
        <p-datepicker [ngModel]="fromDate()" (ngModelChange)="setDate('from', $event)" [placeholder]="t('bookings.from')" [showIcon]="true" dateFormat="dd/mm/yy" />
        <p-datepicker [ngModel]="toDate()" (ngModelChange)="setDate('to', $event)" [placeholder]="t('bookings.to')" [showIcon]="true" dateFormat="dd/mm/yy" [minDate]="fromDate()" />
        <p-select [options]="courtOptions()" [ngModel]="list.query().filters['courtId'] ?? null" (ngModelChange)="list.update({ courtId: $event })" [placeholder]="t('bookings.court')" [showClear]="true" />
        <p-select [options]="statusOptions()" [ngModel]="list.query().filters['status'] ?? null" (ngModelChange)="list.update({ status: $event })" [placeholder]="t('users.status')" [showClear]="true" />
        <span class="total">{{ t('list.total', { count: page()?.total ?? 0 }) }}</span>
      </div>
      <p-table [value]="page()?.items ?? []" [lazy]="true" [loading]="bookings.isLoading()" [paginator]="(page()?.total ?? 0) > list.query().pageSize" [rows]="list.query().pageSize" [first]="list.first()" [totalRecords]="page()?.total ?? 0" (onLazyLoad)="list.onLazyLoad($event)" dataKey="id" styleClass="tb-table">
        <ng-template #header>
          <tr>
            <th>{{ t('bookings.columns.when') }}</th>
            <th>{{ t('bookings.columns.court') }}</th>
            <th>{{ t('bookings.columns.player') }}</th>
            <th class="right">{{ t('bookings.columns.price') }}</th>
            <th>{{ t('bookings.columns.paid') }}</th>
            <th>{{ t('bookings.columns.status') }}</th>
            <th><span class="tb-sr-only">{{ t('list.actions') }}</span></th>
          </tr>
        </ng-template>
        <ng-template #body let-b>
          <tr [class.cancelled]="b.status === 'CANCELLED'">
            <td class="mono">
              {{ b.startTime | tbDate }}
              @if (b.lookingForPartner) {
                <div class="small partner"><i class="pi pi-user-plus" aria-hidden="true"></i> {{ t('bookings.partner') }}</div>
              }
            </td>
            <td>{{ b.court.name }}</td>
            <td><tb-user-cell [firstname]="b.user.firstname" [lastname]="b.user.lastname" [secondary]="b.user.msisdn" /></td>
            <td class="mono right">{{ b.price ? (b.price | tbMoney) : '—' }}</td>
            <td>
              @if (b.status !== 'CANCELLED' && b.price) {
                <span class="pay" [class.ok]="b.fullyPaid">{{ b.fullyPaid ? t('bookings.paid') : t('bookings.unpaid') }}</span>
              }
            </td>
            <td>
              <tb-status-badge kind="booking" [value]="b.status" />
              @if (b.cancelReason) {
                <div class="tb-muted small">{{ b.cancelReason }}</div>
              }
            </td>
            <td class="right nowrap">
              @if (b.status !== 'CANCELLED') {
                @if (!b.fullyPaid && b.price && canRecord()) {
                  <p-button icon="pi pi-wallet" size="small" [text]="true" [ariaLabel]="t('payments.record')" (onClick)="pay(b)" />
                }
                @if (canManage()) {
                  <p-button [label]="t('bookings.cancel')" size="small" [text]="true" severity="danger" (onClick)="cancel(b)" />
                }
              }
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="7"><tb-empty-state [message]="t('list.empty')" icon="pi pi-calendar" /></td></tr>
        </ng-template>
      </p-table>
    </div>
    <tb-record-payment-dialog [clubId]="id()" [(target)]="payTarget" (recorded)="onRecorded($event)" />
  `,
  styleUrl: '../admin/admin-list.scss',
  styles: `
    .small { font-size: var(--tb-text-xs); }
    .partner { color: var(--tb-primary-700); }
    .right { text-align: right; }
    .nowrap { white-space: nowrap; }
    .cancelled td { color: var(--tb-text-subtle); }
    .pay { font-size: var(--tb-text-xs); font-weight: var(--tb-weight-semibold); color: var(--tb-tone-warning-fg); }
    .pay.ok { color: var(--tb-tone-success-fg); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly api = inject(ClubApi);
  private readonly orgApi = inject(OrgApi);
  private readonly authz = inject(AuthzService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  readonly id = input.required<string>();

  protected readonly club = resource({ params: () => this.id(), loader: ({ params }) => this.orgApi.club(params) });
  private readonly courts = resource({ params: () => this.id(), loader: ({ params }) => this.orgApi.courts(params) });
  protected readonly courtOptions = computed(() => (this.courts.value()?.courts ?? []).map((c) => ({ label: c.name, value: c.id })));
  protected readonly statusOptions = computed(() => ['CONFIRMED', 'PENDING', 'CANCELLED'].map((s) => ({ label: this.t(`status.booking.${s}`), value: s })));

  protected readonly list = injectListQuery(['from', 'to', 'courtId', 'status']);
  /** Default window: today and the next 7 days. */
  protected readonly fromDate = computed(() => new Date(`${this.list.query().filters['from'] ?? isoDay(new Date())}T00:00:00`));
  protected readonly toDate = computed(() => {
    const to = this.list.query().filters['to'];
    return to ? new Date(`${to}T00:00:00`) : new Date(this.fromDate().getTime() + 7 * 86_400_000);
  });
  private readonly apiQuery = computed(() => {
    const q = this.list.query();
    const end = new Date(this.toDate());
    end.setHours(23, 59, 59, 999);
    return { ...q, filters: { courtId: q.filters['courtId'], status: q.filters['status'], from: this.fromDate().toISOString(), to: end.toISOString() } };
  });
  protected readonly bookings = resource({
    params: () => ({ id: this.id(), query: this.apiQuery() }),
    loader: ({ params }) => this.api.bookings(params.id, params.query),
  });
  protected readonly page = linkedSignal<ReturnType<typeof this.bookings.value>, ReturnType<typeof this.bookings.value>>({
    source: () => this.bookings.value(),
    computation: (value, previous) => value ?? previous?.value,
  });

  private readonly orgId = computed(() => this.club.value()?.organizationId);
  protected readonly canManage = computed(() => !!this.orgId() && this.authz.hasPermission('booking.manage', { organizationId: this.orgId() }));
  protected readonly canRecord = computed(() => !!this.orgId() && this.authz.hasPermission('payment.record', { organizationId: this.orgId() }));
  protected readonly payTarget = signal<PaymentTarget | null>(null);

  protected setDate(key: 'from' | 'to', date: Date | null) {
    void this.list.update({ [key]: date ? isoDay(date) : null });
  }

  protected pay(b: ClubBooking) {
    const remaining = Math.max(0, Number(b.price) - b.paid);
    this.payTarget.set({
      purpose: 'BOOKING',
      bookingId: b.id,
      label: `${b.court.name} · ${b.user.firstname} ${b.user.lastname}`,
      amount: remaining,
    });
  }

  protected onRecorded(payment: Payment) {
    this.toasts.add({ severity: 'success', summary: this.t('payments.recorded', { reference: payment.reference }) });
    this.bookings.reload();
  }

  protected async cancel(b: ClubBooking) {
    const result = await this.confirm.ask({
      title: this.t('bookings.cancelTitle'),
      message: this.t('bookings.cancelBody'),
      confirmLabel: this.t('bookings.cancel'),
      severity: 'danger',
      reason: 'required',
    });
    if (!result?.reason) return;
    try {
      await this.api.cancelBooking(b.id, result.reason);
      this.toasts.add({ severity: 'success', summary: this.t('bookings.cancelled') });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
    this.bookings.reload();
  }
}
