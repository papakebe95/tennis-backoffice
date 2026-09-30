import { ChangeDetectionStrategy, Component, computed, effect, inject, model, output, resource, signal } from '@angular/core';
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
import { ClubApi } from '../club/club.api';
import { InsightsApi } from '../insights/insights.api';

export interface EntryPaymentTarget {
  registrationId: string;
  name: string;
  remaining: number;
}

/** Takes (part of) an entry fee at the desk: amount, method, transaction number. */
@Component({
  selector: 'tb-entry-payment-dialog',
  imports: [FormsModule, ButtonModule, DialogModule, InputNumberModule, InputTextModule, MessageModule, SelectModule],
  template: `
    <p-dialog [visible]="!!target()" (visibleChange)="!$event && target.set(null)" [modal]="true" [header]="t('entryPayment.title') + ' · ' + (target()?.name ?? '')" [style]="{ width: 'min(460px, 94vw)' }" [draggable]="false">
      @if (target(); as tg) {
        @if (error()) {
          <p-message severity="error" class="msg">{{ error() }}</p-message>
        }
        <div class="tb-field">
          <label for="ep-amount">{{ t('payments.amount') }}</label>
          <p-inputnumber inputId="ep-amount" [ngModel]="amount()" (ngModelChange)="amount.set($event)" [min]="1" [max]="tg.remaining" [fluid]="true" />
          <span class="tb-field-hint">{{ t('entryPayment.due', { amount: money(tg.remaining) }) }}</span>
        </div>
        <div class="tb-field">
          <label for="ep-method">{{ t('payments.method') }}</label>
          <p-select inputId="ep-method" [options]="methodOptions()" [ngModel]="methodKey()" (ngModelChange)="methodKey.set($event)" optionLabel="label" optionValue="value" appendTo="body" [fluid]="true" />
        </div>
        @if (methodKey() !== 'CASH') {
          <div class="tb-field">
            <label for="ep-ref">{{ t('payments.externalReference') }}</label>
            <input pInputText id="ep-ref" [ngModel]="reference()" (ngModelChange)="reference.set($event)" maxlength="80" />
          </div>
        }
        <ng-template #footer>
          <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="target.set(null)" />
          <p-button [label]="t('entryPayment.collect')" icon="pi pi-check" [loading]="saving()" [disabled]="!valid()" (onClick)="submit()" />
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
export class EntryPaymentDialog {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly api = inject(InsightsApi);
  private readonly clubApi = inject(ClubApi);

  readonly target = model<EntryPaymentTarget | null>(null);
  readonly paid = output<void>();

  private readonly methods = resource({ params: () => (this.target() ? true : undefined), loader: () => this.clubApi.paymentMethods() });
  protected readonly methodOptions = computed(() =>
    (this.methods.value() ?? []).map((m) => ({ label: this.i18n.has(`paymentMethods.${m.key}`) ? this.t(`paymentMethods.${m.key}`) : m.label, value: m.key })),
  );
  protected readonly amount = signal<number | null>(null);
  protected readonly methodKey = signal('CASH');
  protected readonly reference = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly valid = computed(() => {
    const a = this.amount();
    return !!a && a > 0 && a <= (this.target()?.remaining ?? 0) && !this.saving();
  });

  constructor() {
    effect(() => {
      const tg = this.target();
      if (!tg) return;
      this.amount.set(tg.remaining);
      this.methodKey.set('CASH');
      this.reference.set('');
      this.error.set(null);
    });
  }

  protected money(v: number) {
    return formatMoney(v, this.i18n.lang());
  }

  protected async submit() {
    const tg = this.target();
    const amount = this.amount();
    if (!tg || !amount) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.api.payEntry(tg.registrationId, {
        amount,
        methodKey: this.methodKey(),
        externalReference: this.methodKey() === 'CASH' ? undefined : this.reference().trim() || undefined,
      });
      this.target.set(null);
      this.paid.emit();
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }
}
