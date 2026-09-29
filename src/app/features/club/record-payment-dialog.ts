import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatMoney } from '../../shared/format';
import { ClubApi } from './club.api';
import type { Payment, PaymentPurpose } from './club.models';

/** What a payment is recorded against (fixed by the caller), if anything. */
export interface PaymentTarget {
  purpose: PaymentPurpose;
  membershipId?: string;
  bookingId?: string;
  /** Shown in the header: "Babacar Sy · Annuel". */
  label?: string;
  /** Prefilled amount and upper bound (what remains due). */
  amount?: number;
  max?: number;
}

/**
 * Records money received at the desk: amount, method (cash, Wave, Orange
 * Money…) and the transaction number. The API checks the target belongs to
 * the club and the amount doesn't exceed what's due.
 */
@Component({
  selector: 'tb-record-payment-dialog',
  imports: [FormsModule, ButtonModule, DialogModule, InputNumberModule, InputTextModule, MessageModule, SelectModule],
  template: `
    <p-dialog
      [visible]="target() !== null"
      (visibleChange)="!$event && target.set(null)"
      [modal]="true"
      [header]="target()?.label ? t('payments.recordFor', { what: target()!.label }) : t('payments.record')"
      [style]="{ width: 'min(480px, 94vw)' }"
      [draggable]="false"
    >
      @if (target(); as tg) {
        @if (error()) {
          <p-message severity="error" class="msg">{{ error() }}</p-message>
        }
        @if (!tg.membershipId && !tg.bookingId) {
          <div class="tb-field">
            <label for="pay-purpose">{{ t('payments.purpose') }}</label>
            <p-select inputId="pay-purpose" [options]="purposes()" [ngModel]="purpose()" (ngModelChange)="purpose.set($event)" appendTo="body" [fluid]="true" />
          </div>
          <div class="tb-field">
            <label for="pay-payer">{{ t('payments.payerName') }}</label>
            <input pInputText id="pay-payer" [ngModel]="payerName()" (ngModelChange)="payerName.set($event)" maxlength="120" />
          </div>
        }
        <div class="tb-field">
          <label for="pay-amount">{{ t('payments.amount') }}</label>
          <p-inputnumber inputId="pay-amount" [ngModel]="amount()" (ngModelChange)="amount.set($event)" [min]="1" [max]="tg.max ?? 100000000" [fluid]="true" />
          @if (tg.max !== undefined) {
            <span class="tb-field-hint">{{ t('payments.remaining', { amount: money(tg.max) }) }}</span>
          }
        </div>
        <div class="tb-field">
          <label for="pay-method">{{ t('payments.method') }}</label>
          <p-select inputId="pay-method" [options]="methodOptions()" [ngModel]="methodKey()" (ngModelChange)="methodKey.set($event)" optionLabel="label" optionValue="value" appendTo="body" [fluid]="true" />
        </div>
        @if (methodKey() !== 'CASH') {
          <div class="tb-field">
            <label for="pay-ref">{{ t('payments.externalReference') }}</label>
            <input pInputText id="pay-ref" [ngModel]="externalReference()" (ngModelChange)="externalReference.set($event)" maxlength="80" />
            <span class="tb-field-hint">{{ t('payments.externalHint') }}</span>
          </div>
        }
        <ng-template #footer>
          <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="target.set(null)" />
          <p-button [label]="t('payments.submit')" icon="pi pi-check" [disabled]="!valid()" [loading]="saving()" (onClick)="submit()" />
        </ng-template>
      }
    </p-dialog>
  `,
  styles: `
    .msg { display: block; margin-bottom: var(--tb-space-4); }
    input { width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordPaymentDialog {
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly api = inject(ClubApi);

  readonly clubId = input.required<string>();
  /** Open the dialog by setting a target; null closes it. */
  readonly target = model<PaymentTarget | null>(null);
  readonly recorded = output<Payment>();

  private readonly methods = resource({ loader: () => this.api.paymentMethods() });
  protected readonly methodOptions = computed(() =>
    (this.methods.value() ?? []).map((m) => ({
      label: this.i18n.has(`paymentMethods.${m.key}`) ? this.t(`paymentMethods.${m.key}`) : m.label,
      value: m.key,
    })),
  );
  protected readonly purposes = computed(() =>
    (['BOOKING', 'COACHING', 'OTHER'] as PaymentPurpose[]).map((p) => ({ label: this.t(`paymentPurposes.${p}`), value: p })),
  );

  protected readonly amount = signal<number | null>(null);
  protected readonly methodKey = signal('CASH');
  protected readonly externalReference = signal('');
  protected readonly purpose = signal<PaymentPurpose>('OTHER');
  protected readonly payerName = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly valid = computed(() => {
    const amount = this.amount();
    const max = this.target()?.max;
    return !!amount && amount > 0 && (max === undefined || amount <= max) && !this.saving();
  });

  constructor() {
    // Reset the form each time the dialog opens.
    effect(() => {
      const target = this.target();
      if (!target) return;
      this.amount.set(target.amount ?? null);
      this.methodKey.set('CASH');
      this.externalReference.set('');
      this.purpose.set(target.purpose === 'MEMBERSHIP' || target.purpose === 'BOOKING' ? target.purpose : 'OTHER');
      this.payerName.set('');
      this.error.set(null);
    });
  }

  protected money(amount: number) {
    return formatMoney(amount, this.i18n.lang());
  }

  protected async submit() {
    const target = this.target();
    const amount = this.amount();
    if (!target || !amount) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const payment = await this.api.recordPayment(this.clubId(), {
        purpose: target.membershipId || target.bookingId ? target.purpose : this.purpose(),
        membershipId: target.membershipId,
        bookingId: target.bookingId,
        amount,
        methodKey: this.methodKey(),
        externalReference: this.methodKey() === 'CASH' ? undefined : this.externalReference().trim() || undefined,
        payerName: this.payerName().trim() || undefined,
      });
      this.target.set(null);
      this.recorded.emit(payment);
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }
}
