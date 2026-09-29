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
import { formatMoney, TbDatePipe, TbMoneyPipe } from '../../shared/format';
import { EmptyState } from '../../shared/ui/bits';
import { ConfirmService } from '../../shared/ui/confirm';
import { PageHeader } from '../../shared/ui/page-header';
import { SearchInput } from '../../shared/ui/search-input';
import { StatusBadge } from '../../shared/ui/status-badge';
import { OrgApi } from '../organizations/org.api';
import { ClubApi, download } from './club.api';
import type { Payment } from './club.models';
import { RecordPaymentDialog, type PaymentTarget } from './record-payment-dialog';

const STATUSES = ['PAID', 'REFUNDED', 'PENDING', 'FAILED', 'CANCELLED'];
const PURPOSES = ['MEMBERSHIP', 'BOOKING', 'TOURNAMENT_ENTRY', 'COACHING', 'OTHER'];
const isoDay = (date: Date | null) =>
  date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : null;

/**
 * Payments: /payments (everything the user may see) and
 * /clubs/:id/payments (one club, with "record a payment").
 */
@Component({
  selector: 'tb-payments-page',
  imports: [FormsModule, ButtonModule, DatePickerModule, SelectModule, TableModule, PageHeader, SearchInput, StatusBadge, EmptyState, TbDatePipe, TbMoneyPipe, RecordPaymentDialog],
  template: `
    <tb-page-header [title]="t('payments.title')" [subtitle]="club.value()?.name ?? t('payments.subtitle')">
      <p-button [label]="t('payments.export')" icon="pi pi-download" severity="secondary" [outlined]="true" [loading]="exporting()" (onClick)="export()" />
      @if (id() && canRecord()) {
        <p-button [label]="t('payments.record')" icon="pi pi-plus" (onClick)="recordTarget.set({ purpose: 'OTHER' })" />
      }
    </tb-page-header>

    <section class="sums">
      @for (total of totals(); track total.status) {
        <article class="tb-card sum" [attr.data-status]="total.status">
          <span class="label">{{ t('payments.totals.' + total.status) }}</span>
          <strong>{{ total.amount | tbMoney }}</strong>
        </article>
      }
    </section>

    <div class="tb-card list-card">
      <div class="filters">
        <tb-search-input [value]="list.query().q" [placeholder]="t('payments.searchPlaceholder')" (search)="list.update({ q: $event })" />
        <p-select [options]="statusOptions()" [ngModel]="list.query().filters['status'] ?? null" (ngModelChange)="list.update({ status: $event })" [placeholder]="t('payments.status')" [showClear]="true" />
        <p-select [options]="purposeOptions()" [ngModel]="list.query().filters['purpose'] ?? null" (ngModelChange)="list.update({ purpose: $event })" [placeholder]="t('payments.purpose')" [showClear]="true" />
        <p-select [options]="methodOptions()" [ngModel]="list.query().filters['methodKey'] ?? null" (ngModelChange)="list.update({ methodKey: $event })" [placeholder]="t('payments.method')" [showClear]="true" />
        <p-datepicker [ngModel]="fromDate()" (ngModelChange)="setDate('from', $event)" [placeholder]="t('payments.from')" [showIcon]="true" [showClear]="true" dateFormat="dd/mm/yy" />
        <p-datepicker [ngModel]="toDate()" (ngModelChange)="setDate('to', $event)" [placeholder]="t('payments.to')" [showIcon]="true" [showClear]="true" dateFormat="dd/mm/yy" />
        @if (list.hasFilters()) {
          <p-button [label]="t('list.clearFilters')" [text]="true" severity="secondary" icon="pi pi-filter-slash" (onClick)="list.clearFilters()" />
        }
        <span class="total">{{ t('list.total', { count: page()?.total ?? 0 }) }}</span>
      </div>
      <p-table [value]="page()?.items ?? []" [lazy]="true" [loading]="payments.isLoading()" [paginator]="true" [rows]="list.query().pageSize" [first]="list.first()" [totalRecords]="page()?.total ?? 0" [rowsPerPageOptions]="[20, 50, 100]" (onLazyLoad)="list.onLazyLoad($event)" dataKey="id" styleClass="tb-table">
        <ng-template #header>
          <tr>
            <th>{{ t('payments.columns.date') }}</th>
            <th>{{ t('payments.columns.reference') }}</th>
            @if (!id()) {
              <th>{{ t('payments.columns.organization') }}</th>
            }
            <th>{{ t('payments.columns.payer') }}</th>
            <th>{{ t('payments.columns.purpose') }}</th>
            <th>{{ t('payments.columns.method') }}</th>
            <th class="right">{{ t('payments.columns.amount') }}</th>
            <th>{{ t('payments.columns.status') }}</th>
            <th><span class="tb-sr-only">{{ t('list.actions') }}</span></th>
          </tr>
        </ng-template>
        <ng-template #body let-p>
          <tr>
            <td class="mono tb-muted">{{ p.paidAt | tbDate }}</td>
            <td class="mono">
              {{ p.reference }}
              @if (p.externalReference) {
                <div class="tb-muted small">{{ p.externalReference }}</div>
              }
            </td>
            @if (!id()) {
              <td>{{ p.organization.name }}</td>
            }
            <td>{{ p.payer ? p.payer.firstname + ' ' + p.payer.lastname : (p.payerName ?? '—') }}</td>
            <td>
              {{ t('paymentPurposes.' + p.purpose) }}
              @if (p.booking) {
                <div class="tb-muted small">{{ p.booking.court.name }} · {{ p.booking.startTime | tbDate }}</div>
              }
            </td>
            <td>{{ t('paymentMethods.' + p.methodKey) }}</td>
            <td class="mono right" [class.struck]="p.status === 'REFUNDED'">{{ p.amount | tbMoney }}</td>
            <td>
              <tb-status-badge kind="payment" [value]="p.status" />
              @if (p.refundReason) {
                <div class="tb-muted small">{{ p.refundReason }}</div>
              }
            </td>
            <td class="right">
              @if (p.status === 'PAID' && canRefund(p)) {
                <p-button [label]="t('payments.refund')" size="small" [text]="true" severity="danger" (onClick)="refund(p)" />
              }
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="9"><tb-empty-state [message]="list.hasFilters() ? t('list.emptyFiltered') : t('list.empty')" icon="pi pi-wallet" /></td></tr>
        </ng-template>
      </p-table>
    </div>

    @if (id()) {
      <tb-record-payment-dialog [clubId]="id()!" [(target)]="recordTarget" (recorded)="onRecorded($event)" />
    }
  `,
  styleUrl: '../admin/admin-list.scss',
  styles: `
    .sums { display: grid; gap: var(--tb-space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); margin-bottom: var(--tb-space-6); }
    .sum { display: flex; flex-direction: column; gap: var(--tb-space-1); padding: var(--tb-space-4) var(--tb-space-5); }
    .sum strong { font-size: var(--tb-text-2xl); }
    .sum[data-status='PAID'] strong { color: var(--tb-tone-success-fg); }
    .sum[data-status='REFUNDED'] strong { color: var(--tb-tone-accent-fg); }
    .label { color: var(--tb-text-muted); }
    .small { font-size: var(--tb-text-xs); }
    .right { text-align: right; }
    .struck { text-decoration: line-through; color: var(--tb-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly api = inject(ClubApi);
  private readonly orgApi = inject(OrgApi);
  private readonly authz = inject(AuthzService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  /** Club id on /clubs/:id/payments; absent on /payments. */
  readonly id = input<string>();

  protected readonly club = resource({ params: () => this.id(), loader: ({ params }) => this.orgApi.club(params) });
  protected readonly list = injectListQuery(['status', 'purpose', 'methodKey', 'from', 'to']);
  private readonly apiQuery = computed(() => {
    const q = this.list.query();
    const { from, to } = q.filters;
    return {
      ...q,
      filters: {
        ...q.filters,
        organizationId: this.club.value()?.organizationId,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
      },
    };
  });
  protected readonly payments = resource({
    // On a club page, wait for the club's organization id.
    params: () => (this.id() && !this.club.value() ? undefined : this.apiQuery()),
    loader: ({ params }) => this.api.payments(params),
  });
  protected readonly page = linkedSignal<ReturnType<typeof this.payments.value>, ReturnType<typeof this.payments.value>>({
    source: () => this.payments.value(),
    computation: (value, previous) => value ?? previous?.value,
  });
  protected readonly totals = computed(() => {
    const byStatus = new Map<string, number>();
    for (const total of this.page()?.totals ?? []) {
      if (total.status === 'PAID' || total.status === 'REFUNDED') {
        byStatus.set(total.status, (byStatus.get(total.status) ?? 0) + Number(total.amount));
      }
    }
    return ['PAID', 'REFUNDED'].map((status) => ({ status, amount: byStatus.get(status) ?? 0 }));
  });

  private readonly methods = resource({ loader: () => this.api.paymentMethods() });
  protected readonly methodOptions = computed(() => (this.methods.value() ?? []).map((m) => ({ label: this.t(`paymentMethods.${m.key}`), value: m.key })));
  protected readonly statusOptions = computed(() => STATUSES.map((s) => ({ label: this.t(`status.payment.${s}`), value: s })));
  protected readonly purposeOptions = computed(() => PURPOSES.map((p) => ({ label: this.t(`paymentPurposes.${p}`), value: p })));
  protected readonly fromDate = computed(() => (this.list.query().filters['from'] ? new Date(`${this.list.query().filters['from']}T00:00:00`) : null));
  protected readonly toDate = computed(() => (this.list.query().filters['to'] ? new Date(`${this.list.query().filters['to']}T00:00:00`) : null));

  protected readonly canRecord = computed(() => {
    const orgId = this.club.value()?.organizationId;
    return !!orgId && this.authz.hasPermission('payment.record', { organizationId: orgId });
  });
  protected readonly recordTarget = signal<PaymentTarget | null>(null);
  protected readonly exporting = signal(false);

  protected canRefund(payment: Payment) {
    return this.authz.hasPermission('payment.refund', { organizationId: payment.organization.id });
  }

  protected setDate(key: 'from' | 'to', date: Date | null) {
    void this.list.update({ [key]: isoDay(date) });
  }

  protected onRecorded(payment: Payment) {
    this.toasts.add({ severity: 'success', summary: this.t('payments.recorded', { reference: payment.reference }) });
    this.payments.reload();
  }

  protected async refund(payment: Payment) {
    const result = await this.confirm.ask({
      title: this.t('payments.refundTitle'),
      message: this.t('payments.refundBody', { amount: formatMoney(payment.amount, this.i18n.lang()), reference: payment.reference }),
      confirmLabel: this.t('payments.refund'),
      severity: 'danger',
      reason: 'required',
    });
    if (!result?.reason) return;
    try {
      await this.api.refund(payment.id, result.reason);
      this.toasts.add({ severity: 'success', summary: this.t('payments.refunded') });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
    this.payments.reload();
  }

  protected async export() {
    this.exporting.set(true);
    try {
      download(await this.api.exportPayments(this.apiQuery()), `payments-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    } finally {
      this.exporting.set(false);
    }
  }
}
