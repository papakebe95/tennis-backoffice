import { ChangeDetectionStrategy, Component, inject, input, model, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TbMoneyPipe } from '../../shared/format';
import { ClubApi } from './club.api';
import type { Plan } from './club.models';

interface PlanDraft {
  id: string | null;
  name: string;
  durationMonths: number | null;
  price: number | null;
  description: string;
  active: boolean;
}

/** The club's membership plans: list, create, edit, stop offering. */
@Component({
  selector: 'tb-plans-drawer',
  imports: [FormsModule, ButtonModule, DrawerModule, InputNumberModule, InputTextModule, MessageModule, ToggleSwitchModule, TbMoneyPipe],
  template: `
    <p-drawer [(visible)]="visible" position="right" styleClass="tb-drawer" [header]="t('members.plansDrawer.title')" (onHide)="draft.set(null)">
      @if (draft(); as d) {
        @if (error()) {
          <p-message severity="error" class="msg">{{ error() }}</p-message>
        }
        <div class="tb-field">
          <label for="plan-name">{{ t('members.plansDrawer.name') }}</label>
          <input pInputText id="plan-name" [ngModel]="d.name" (ngModelChange)="patch({ name: $event })" maxlength="60" />
        </div>
        <div class="two">
          <div class="tb-field">
            <label for="plan-duration">{{ t('members.plansDrawer.duration') }}</label>
            <p-inputnumber inputId="plan-duration" [ngModel]="d.durationMonths" (ngModelChange)="patch({ durationMonths: $event })" [min]="1" [max]="60" [fluid]="true" />
          </div>
          <div class="tb-field">
            <label for="plan-price">{{ t('members.plansDrawer.price') }}</label>
            <p-inputnumber inputId="plan-price" [ngModel]="d.price" (ngModelChange)="patch({ price: $event })" [min]="0" [fluid]="true" />
          </div>
        </div>
        <div class="tb-field">
          <label for="plan-description">{{ t('members.plansDrawer.description') }}</label>
          <input pInputText id="plan-description" [ngModel]="d.description" (ngModelChange)="patch({ description: $event })" maxlength="300" />
        </div>
        <label class="switch">
          <p-toggleswitch [ngModel]="d.active" (ngModelChange)="patch({ active: $event })" />
          {{ t('members.plansDrawer.active') }}
        </label>
        <div class="actions">
          <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="draft.set(null)" />
          <p-button [label]="t('members.plansDrawer.save')" icon="pi pi-check" [disabled]="!d.name.trim() || !d.durationMonths || d.price === null" [loading]="saving()" (onClick)="save()" />
        </div>
      } @else {
        <ul class="plans">
          @for (p of plans.value() ?? []; track p.id) {
            <li [class.inactive]="!p.active">
              <div>
                <strong>{{ p.name }}</strong>
                <span class="tb-muted">{{ t('members.plansDrawer.months', { count: p.durationMonths }) }} · {{ t('members.plansDrawer.memberships', { count: p._count?.memberships ?? 0 }) }}</span>
                @if (!p.active) {
                  <small>{{ t('members.plansDrawer.inactive') }}</small>
                }
              </div>
              <span class="price">{{ p.price | tbMoney }}</span>
              @if (canManage()) {
                <p-button icon="pi pi-pencil" [text]="true" severity="secondary" [ariaLabel]="t('roles.save')" (onClick)="edit(p)" />
              }
            </li>
          } @empty {
            <li class="tb-muted">{{ t('list.empty') }}</li>
          }
        </ul>
        @if (canManage()) {
          <p-button [label]="t('members.plansDrawer.new')" icon="pi pi-plus" [outlined]="true" (onClick)="edit(null)" />
        }
      }
    </p-drawer>
  `,
  styles: `
    .msg { display: block; margin-bottom: var(--tb-space-4); }
    .plans { list-style: none; margin: 0 0 var(--tb-space-5); padding: 0; display: grid; gap: var(--tb-space-2); }
    .plans li { display: flex; align-items: center; gap: var(--tb-space-3); padding: var(--tb-space-3) var(--tb-space-4); border: 1px solid var(--tb-border); border-radius: var(--tb-radius-md); }
    .plans li.inactive { opacity: 0.6; }
    .plans li div { flex: 1; display: flex; flex-direction: column; }
    .plans small { color: var(--tb-tone-warning-fg); }
    .price { font-weight: var(--tb-weight-semibold); white-space: nowrap; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 var(--tb-space-4); }
    input { width: 100%; }
    .switch { display: flex; align-items: center; gap: var(--tb-space-3); margin-bottom: var(--tb-space-5); }
    .actions { display: flex; justify-content: flex-end; gap: var(--tb-space-2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlansDrawer {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(ClubApi);
  private readonly toasts = inject(MessageService);

  readonly clubId = input.required<string>();
  readonly visible = model(false);
  readonly canManage = input(false);
  readonly changed = output<void>();

  protected readonly plans = resource({ params: () => (this.visible() ? this.clubId() : undefined), loader: ({ params }) => this.api.plans(params) });
  protected readonly draft = signal<PlanDraft | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected edit(plan: Plan | null) {
    this.error.set(null);
    this.draft.set(
      plan
        ? { id: plan.id, name: plan.name, durationMonths: plan.durationMonths, price: Number(plan.price), description: plan.description ?? '', active: plan.active }
        : { id: null, name: '', durationMonths: 12, price: null, description: '', active: true },
    );
  }

  protected patch(changes: Partial<PlanDraft>) {
    const d = this.draft();
    if (d) this.draft.set({ ...d, ...changes });
  }

  protected async save() {
    const d = this.draft();
    if (!d || !d.durationMonths || d.price === null) return;
    const body = { name: d.name.trim(), durationMonths: d.durationMonths, price: d.price, description: d.description.trim() || undefined, active: d.active };
    this.saving.set(true);
    this.error.set(null);
    try {
      if (d.id) await this.api.updatePlan(d.id, { ...body, description: body.description ?? null });
      else await this.api.createPlan(this.clubId(), body);
      this.toasts.add({ severity: 'success', summary: this.t('members.plansDrawer.saved') });
      this.draft.set(null);
      this.plans.reload();
      this.changed.emit();
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }
}
