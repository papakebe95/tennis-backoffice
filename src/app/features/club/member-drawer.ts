import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DrawerModule } from 'primeng/drawer';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { ApiError } from '../../core/api/api';
import { AuthzService } from '../../core/authz/authz.service';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatMoney, TbDatePipe, TbMoneyPipe } from '../../shared/format';
import { UserCell } from '../../shared/ui/bits';
import { ConfirmService } from '../../shared/ui/confirm';
import { StatusBadge } from '../../shared/ui/status-badge';
import { OrgApi } from '../organizations/org.api';
import { ClubApi } from './club.api';
import type { MemberDetail, MemberStatus, Payment } from './club.models';
import { RecordPaymentDialog, type PaymentTarget } from './record-payment-dialog';

/** A member's record: current period, payments, renewal, status, history. */
@Component({
  selector: 'tb-member-drawer',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    DrawerModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    SkeletonModule,
    TabsModule,
    TextareaModule,
    UserCell,
    StatusBadge,
    TbDatePipe,
    TbMoneyPipe,
    RecordPaymentDialog,
  ],
  templateUrl: './member-drawer.html',
  styleUrl: './member-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberDrawer {
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly api = inject(ClubApi);
  private readonly orgApi = inject(OrgApi);
  private readonly authz = inject(AuthzService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  readonly clubId = input.required<string>();
  readonly memberId = input<string | null>(null);
  readonly canManage = input(false);
  readonly closed = output<void>();
  readonly changed = output<void>();

  protected readonly member = resource({
    params: () => this.memberId() ?? undefined,
    loader: ({ params }) => this.api.member(params),
  });
  private readonly club = resource({ params: () => this.clubId(), loader: ({ params }) => this.orgApi.club(params) });
  private readonly orgId = computed(() => this.club.value()?.organizationId);
  protected readonly canRecord = computed(() => !!this.orgId() && this.authz.hasPermission('payment.record', { organizationId: this.orgId() }));
  protected readonly canRefund = computed(() => !!this.orgId() && this.authz.hasPermission('payment.refund', { organizationId: this.orgId() }));

  // Inline edit of number / notes
  protected readonly number = signal('');
  protected readonly notes = signal('');
  protected readonly editDirty = computed(() => {
    const m = this.member.value();
    return !!m && (this.number() !== m.membershipNumber || this.notes() !== (m.notes ?? ''));
  });

  // Payment dialog
  protected readonly paymentTarget = signal<PaymentTarget | null>(null);

  // Renewal dialog
  protected readonly renewing = signal(false);
  private readonly plans = resource({ params: () => (this.renewing() ? this.clubId() : undefined), loader: ({ params }) => this.api.plans(params) });
  private readonly methods = resource({ params: () => (this.renewing() ? true : undefined), loader: () => this.api.paymentMethods() });
  protected readonly planOptions = computed(() =>
    (this.plans.value() ?? [])
      .filter((p) => p.active)
      .map((p) => ({ label: `${p.name} · ${formatMoney(p.price, this.i18n.lang())}`, value: p.id })),
  );
  protected readonly methodOptions = computed(() =>
    (this.methods.value() ?? []).map((m) => ({ label: this.t(`paymentMethods.${m.key}`), value: m.key })),
  );
  protected readonly renewPlanId = signal<string | null>(null);
  protected readonly renewAmount = signal<number | null>(null);
  protected readonly renewMethod = signal('CASH');
  protected readonly renewError = signal<string | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      const m = this.member.value();
      if (!m) return;
      this.number.set(m.membershipNumber);
      this.notes.set(m.notes ?? '');
    });
  }

  protected payCurrent(m: MemberDetail) {
    const period = m.currentMembership;
    if (!period) return;
    this.paymentTarget.set({
      purpose: 'MEMBERSHIP',
      membershipId: period.id,
      label: `${m.user.firstname} ${m.user.lastname} · ${period.plan?.name ?? ''}`,
      amount: m.remainingDue,
      max: m.remainingDue,
    });
  }

  protected onRecorded(payment: Payment) {
    this.toasts.add({ severity: 'success', summary: this.t('payments.recorded', { reference: payment.reference }) });
    this.refresh();
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
    await this.run(() => this.api.refund(payment.id, result.reason!), 'payments.refunded');
  }

  protected async setStatus(status: MemberStatus) {
    const id = this.memberId();
    if (!id) return;
    const result = await this.confirm.ask({
      title: this.t(`members.detail.confirm.${status}.title`),
      message: this.t(`members.detail.confirm.${status}.body`),
      confirmLabel: this.t('common.confirm'),
      severity: status === 'ACTIVE' ? 'primary' : 'danger',
      reason: status === 'ACTIVE' ? 'optional' : 'required',
    });
    if (!result) return;
    await this.run(() => this.api.setMemberStatus(id, status, result.reason), 'members.detail.statusChanged');
  }

  protected async saveDetails() {
    const id = this.memberId();
    if (!id) return;
    await this.run(
      () => this.api.updateMember(id, { membershipNumber: this.number().trim(), notes: this.notes().trim() || null }),
      'members.detail.saved',
    );
  }

  protected openRenew(m: MemberDetail) {
    this.renewPlanId.set(m.currentMembership?.plan?.id ?? null);
    this.renewAmount.set(null);
    this.renewMethod.set('CASH');
    this.renewError.set(null);
    this.renewing.set(true);
  }

  protected selectRenewPlan(planId: string) {
    this.renewPlanId.set(planId);
    const price = this.plans.value()?.find((p) => p.id === planId)?.price;
    this.renewAmount.set(price ? Number(price) : null);
  }

  protected async renew() {
    const id = this.memberId();
    const planId = this.renewPlanId();
    if (!id || !planId) return;
    this.busy.set(true);
    this.renewError.set(null);
    try {
      await this.api.renew(id, {
        planId,
        payment: this.renewAmount() ? { amount: this.renewAmount()!, methodKey: this.renewMethod() } : undefined,
      });
      this.renewing.set(false);
      this.toasts.add({ severity: 'success', summary: this.t('members.detail.renewed') });
      this.refresh();
    } catch (raw) {
      this.renewError.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.busy.set(false);
    }
  }

  protected score(match: MemberDetail['matches'][number]) {
    return match.sets.map((s) => `${s.player1Games}-${s.player2Games}`).join(' ');
  }

  protected opponent(match: MemberDetail['matches'][number], userId: string) {
    const other = match.player1.id === userId ? match.player2 : match.player1;
    return other ? `${other.firstname} ${other.lastname}` : (match.player2Name ?? '—');
  }

  private async run(action: () => Promise<unknown>, successKey: string) {
    this.busy.set(true);
    try {
      await action();
      this.toasts.add({ severity: 'success', summary: this.t(successKey) });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.status !== 403 && error.messages.length) {
        this.toasts.add({ severity: 'warn', summary: this.t('errors.title'), detail: error.messages.join(' ') });
      }
    } finally {
      this.busy.set(false);
    }
    this.refresh();
  }

  private refresh() {
    this.member.reload();
    this.changed.emit();
  }
}
