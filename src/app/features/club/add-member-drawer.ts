import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatMoney } from '../../shared/format';
import { UserCell } from '../../shared/ui/bits';
import { SearchInput } from '../../shared/ui/search-input';
import { ClubApi } from './club.api';
import type { Candidate } from './club.models';

/** Add a platform player as a club member, with a plan and an optional first payment. */
@Component({
  selector: 'tb-add-member-drawer',
  imports: [FormsModule, ButtonModule, DatePickerModule, DrawerModule, InputNumberModule, InputTextModule, MessageModule, SelectModule, TextareaModule, UserCell, SearchInput],
  template: `
    <p-drawer [(visible)]="visible" position="right" styleClass="tb-drawer tb-drawer-lg" [header]="t('members.addDrawer.title')" (onHide)="reset()">
      @if (error()) {
        <p-message severity="error" class="msg">{{ error() }}</p-message>
      }
      @if (!picked()) {
        <div class="tb-field">
          <label>{{ t('members.addDrawer.search') }}</label>
          <tb-search-input [value]="query()" [placeholder]="'77 123 45 67'" (search)="query.set($event)" />
          <span class="tb-field-hint">{{ t('members.addDrawer.searchHint') }}</span>
        </div>
        <ul class="candidates">
          @for (c of candidates.value() ?? []; track c.id) {
            <li>
              <button type="button" [disabled]="c.alreadyMember" (click)="picked.set(c)">
                <tb-user-cell [firstname]="c.firstname" [lastname]="c.lastname" [secondary]="c.phone" />
                @if (c.alreadyMember) {
                  <small>{{ t('members.addDrawer.alreadyMember') }}</small>
                } @else {
                  <i class="pi pi-chevron-right" aria-hidden="true"></i>
                }
              </button>
            </li>
          } @empty {
            @if (query().length >= 2 && !candidates.isLoading()) {
              <li class="tb-muted">{{ t('members.addDrawer.noResult') }}</li>
            }
          }
        </ul>
      } @else {
        <div class="picked">
          <tb-user-cell [firstname]="picked()!.firstname" [lastname]="picked()!.lastname" [secondary]="picked()!.phone" size="lg" />
          <p-button icon="pi pi-times" [text]="true" severity="secondary" (onClick)="picked.set(null)" [ariaLabel]="t('common.cancel')" />
        </div>
        <div class="tb-field">
          <label for="am-plan">{{ t('members.plan') }}</label>
          <p-select inputId="am-plan" [options]="planOptions()" [ngModel]="planId()" (ngModelChange)="selectPlan($event)" appendTo="body" [fluid]="true" />
        </div>
        <div class="two">
          <div class="tb-field">
            <label for="am-start">{{ t('members.addDrawer.startsAt') }}</label>
            <p-datepicker inputId="am-start" [ngModel]="startsAt()" (ngModelChange)="startsAt.set($event)" dateFormat="dd/mm/yy" [showIcon]="true" appendTo="body" [fluid]="true" />
          </div>
          <div class="tb-field">
            <label for="am-number">{{ t('members.addDrawer.number') }}</label>
            <input pInputText id="am-number" [ngModel]="number()" (ngModelChange)="number.set($event)" maxlength="20" />
            <span class="tb-field-hint">{{ t('members.addDrawer.numberHint') }}</span>
          </div>
        </div>
        <div class="tb-field">
          <label for="am-notes">{{ t('members.addDrawer.notes') }}</label>
          <textarea pTextarea id="am-notes" rows="2" [autoResize]="true" [ngModel]="notes()" (ngModelChange)="notes.set($event)" maxlength="500"></textarea>
        </div>
        <h3>{{ t('members.addDrawer.firstPayment') }}</h3>
        <div class="two">
          <div class="tb-field">
            <label for="am-amount">{{ t('payments.amount') }}</label>
            <p-inputnumber inputId="am-amount" [ngModel]="amount()" (ngModelChange)="amount.set($event)" [min]="0" [max]="planPrice()" [fluid]="true" />
          </div>
          <div class="tb-field">
            <label for="am-method">{{ t('payments.method') }}</label>
            <p-select inputId="am-method" [options]="methodOptions()" [ngModel]="methodKey()" (ngModelChange)="methodKey.set($event)" appendTo="body" [fluid]="true" />
          </div>
        </div>
        @if (amount() && methodKey() !== 'CASH') {
          <div class="tb-field">
            <label for="am-ref">{{ t('payments.externalReference') }}</label>
            <input pInputText id="am-ref" [ngModel]="externalReference()" (ngModelChange)="externalReference.set($event)" maxlength="80" />
          </div>
        }
      }
      <ng-template #footer>
        <div class="footer">
          <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
          <p-button [label]="t('members.addDrawer.submit')" icon="pi pi-check" [disabled]="!picked() || !planId()" [loading]="saving()" (onClick)="submit()" />
        </div>
      </ng-template>
    </p-drawer>
  `,
  styles: `
    .msg { display: block; margin-bottom: var(--tb-space-4); }
    .candidates { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--tb-space-2); }
    .candidates button { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: var(--tb-space-3); padding: var(--tb-space-3); border: 1px solid var(--tb-border); border-radius: var(--tb-radius-md); background: var(--tb-surface); font: inherit; cursor: pointer; text-align: left; }
    .candidates button:hover:not(:disabled) { border-color: var(--tb-primary-300); background: var(--tb-primary-50); }
    .candidates button:disabled { opacity: 0.6; cursor: default; }
    .candidates small { color: var(--tb-text-muted); }
    .picked { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--tb-space-5); padding: var(--tb-space-3); border-radius: var(--tb-radius-md); background: var(--tb-primary-50); }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 var(--tb-space-4); }
    input, textarea { width: 100%; }
    h3 { font-size: var(--tb-text-md); margin: var(--tb-space-2) 0 var(--tb-space-3); }
    .footer { display: flex; justify-content: flex-end; gap: var(--tb-space-2); width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddMemberDrawer {
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly api = inject(ClubApi);
  private readonly toasts = inject(MessageService);

  readonly clubId = input.required<string>();
  readonly visible = model(false);
  /** Emits the new member's id. */
  readonly added = output<string>();

  protected readonly query = signal('');
  protected readonly candidates = resource({
    params: () => (this.visible() && this.query().length >= 2 ? { club: this.clubId(), q: this.query() } : undefined),
    loader: ({ params }) => this.api.candidates(params.club, params.q),
  });
  private readonly plans = resource({ params: () => (this.visible() ? this.clubId() : undefined), loader: ({ params }) => this.api.plans(params) });
  private readonly methods = resource({ params: () => (this.visible() ? true : undefined), loader: () => this.api.paymentMethods() });

  protected readonly planOptions = computed(() =>
    (this.plans.value() ?? [])
      .filter((p) => p.active)
      .map((p) => ({ label: `${p.name} · ${formatMoney(p.price, this.i18n.lang())}`, value: p.id })),
  );
  protected readonly methodOptions = computed(() =>
    (this.methods.value() ?? []).map((m) => ({ label: this.t(`paymentMethods.${m.key}`), value: m.key })),
  );

  protected readonly picked = signal<Candidate | null>(null);
  protected readonly planId = signal<string | null>(null);
  protected readonly planPrice = computed(() => Number(this.plans.value()?.find((p) => p.id === this.planId())?.price ?? 0));
  protected readonly startsAt = signal<Date>(new Date());
  protected readonly number = signal('');
  protected readonly notes = signal('');
  protected readonly amount = signal<number | null>(null);
  protected readonly methodKey = signal('CASH');
  protected readonly externalReference = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected selectPlan(planId: string) {
    this.planId.set(planId);
    this.amount.set(this.planPrice() || null);
  }

  protected reset() {
    this.query.set('');
    this.picked.set(null);
    this.planId.set(null);
    this.startsAt.set(new Date());
    this.number.set('');
    this.notes.set('');
    this.amount.set(null);
    this.methodKey.set('CASH');
    this.externalReference.set('');
    this.error.set(null);
  }

  protected async submit() {
    const user = this.picked();
    const planId = this.planId();
    if (!user || !planId) return;
    const start = this.startsAt();
    this.saving.set(true);
    this.error.set(null);
    try {
      const member = await this.api.addMember(this.clubId(), {
        userId: user.id,
        planId,
        startsAt: new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())).toISOString(),
        membershipNumber: this.number().trim() || undefined,
        notes: this.notes().trim() || undefined,
        payment: this.amount()
          ? { amount: this.amount()!, methodKey: this.methodKey(), externalReference: this.externalReference().trim() || undefined }
          : undefined,
      });
      this.toasts.add({ severity: 'success', summary: this.t('members.addDrawer.added') });
      this.visible.set(false);
      this.added.emit(member.id);
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }
}
