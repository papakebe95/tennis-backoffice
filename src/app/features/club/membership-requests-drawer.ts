import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { SelectModule } from 'primeng/select';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TbAgoPipe } from '../../shared/format';
import { EmptyState, UserCell } from '../../shared/ui/bits';
import { ConfirmService } from '../../shared/ui/confirm';
import { ClubApi } from './club.api';
import type { MembershipRequest } from './club.models';

/**
 * Players who asked, from the app, to join the club. Accepting makes them
 * members on the chosen plan (a former member keeps their number);
 * declining tells them why.
 */
@Component({
  selector: 'tb-membership-requests-drawer',
  imports: [FormsModule, ButtonModule, DrawerModule, SelectModule, EmptyState, UserCell, TbAgoPipe],
  template: `
    <p-drawer [(visible)]="visible" position="right" styleClass="tb-drawer tb-drawer-lg" [header]="t('membershipRequests.title')">
      <p class="tb-muted hint">{{ t('membershipRequests.hint') }}</p>
      <ul class="requests">
        @for (r of requests.value()?.items ?? []; track r.id) {
          <li>
            <div class="who">
              <tb-user-cell [firstname]="r.user.firstname" [lastname]="r.user.lastname" [secondary]="r.user.msisdn + ' · ' + (r.user.playerProfile?.classification?.code ?? 'NC')" />
              <small class="tb-muted">{{ r.createdAt | tbAgo }}</small>
            </div>
            @if (r.previousMembership) {
              <span class="tag">{{ t('membershipRequests.former', { number: r.previousMembership.membershipNumber }) }}</span>
            }
            @if (r.message) {
              <p class="message">« {{ r.message }} »</p>
            }
            <div class="decide">
              <p-select
                [options]="planOptions()"
                [ngModel]="planFor(r)"
                (ngModelChange)="choose(r.id, $event)"
                [placeholder]="t('members.plan')"
                appendTo="body"
                [attr.aria-label]="t('members.plan')"
                styleClass="plan"
              />
              <p-button [label]="t('membershipRequests.approve')" icon="pi pi-check" size="small" [disabled]="!planFor(r) || busy() === r.id" [loading]="busy() === r.id" (onClick)="approve(r)" />
              <p-button [label]="t('membershipRequests.decline')" icon="pi pi-times" size="small" severity="danger" [text]="true" [disabled]="busy() === r.id" (onClick)="decline(r)" />
            </div>
          </li>
        } @empty {
          <li><tb-empty-state [message]="t('membershipRequests.empty')" icon="pi pi-user-plus" /></li>
        }
      </ul>
    </p-drawer>
  `,
  styles: `
    .hint { margin: 0 0 var(--tb-space-4); font-size: var(--tb-text-sm); }
    .requests { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--tb-space-3); }
    .requests > li { border: 1px solid var(--tb-border); border-radius: var(--tb-radius-md); padding: var(--tb-space-3) var(--tb-space-4); display: grid; gap: var(--tb-space-2); }
    .who { display: flex; justify-content: space-between; align-items: center; gap: var(--tb-space-3); }
    .tag { justify-self: start; font-size: var(--tb-text-xs); padding: 1px 8px; border-radius: var(--tb-radius-full); background: var(--tb-tone-info-bg); color: var(--tb-tone-info-fg); }
    .message { margin: 0; color: var(--tb-text-muted); font-style: italic; }
    .decide { display: flex; flex-wrap: wrap; gap: var(--tb-space-2); align-items: center; }
    :host ::ng-deep .plan { min-width: 200px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembershipRequestsDrawer {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(ClubApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  readonly clubId = input.required<string>();
  readonly plans = input<{ id: string; name: string; active: boolean }[]>([]);
  readonly visible = model(false);
  /** A member was added: the member's id. */
  readonly approved = output<string>();
  readonly changed = output<void>();

  protected readonly requests = resource({
    params: () => (this.visible() ? this.clubId() : undefined),
    loader: ({ params }) => this.api.membershipRequests(params, 'PENDING'),
  });
  protected readonly planOptions = computed(() => this.plans().filter((p) => p.active).map((p) => ({ label: p.name, value: p.id })));
  private readonly chosen = signal<Record<string, string>>({});
  protected readonly busy = signal<string | null>(null);

  /** The plan picked here, else the one the player asked for. */
  protected planFor(r: MembershipRequest) {
    return this.chosen()[r.id] ?? r.plan?.id ?? null;
  }

  protected choose(id: string, planId: string) {
    this.chosen.update((c) => ({ ...c, [id]: planId }));
  }

  protected async approve(r: MembershipRequest) {
    const planId = this.planFor(r);
    if (!planId) return;
    this.busy.set(r.id);
    try {
      const member = await this.api.approveMembershipRequest(r.id, { planId });
      this.toasts.add({ severity: 'success', summary: this.t('membershipRequests.approved', { name: `${r.user.firstname} ${r.user.lastname}` }) });
      this.requests.reload();
      this.changed.emit();
      this.approved.emit(member.id);
    } catch (raw) {
      this.toasts.add({ severity: 'error', summary: describeError(ApiError.from(raw), this.t) });
    } finally {
      this.busy.set(null);
    }
  }

  protected async decline(r: MembershipRequest) {
    const answer = await this.confirm.ask({
      title: this.t('membershipRequests.declineTitle'),
      message: `${r.user.firstname} ${r.user.lastname}`,
      confirmLabel: this.t('membershipRequests.decline'),
      severity: 'danger',
      reason: 'required',
      reasonLabel: this.t('membershipRequests.reasonLabel'),
    });
    if (!answer?.reason) return;
    this.busy.set(r.id);
    try {
      await this.api.declineMembershipRequest(r.id, answer.reason);
      this.toasts.add({ severity: 'success', summary: this.t('membershipRequests.declined') });
      this.requests.reload();
      this.changed.emit();
    } catch (raw) {
      this.toasts.add({ severity: 'error', summary: describeError(ApiError.from(raw), this.t) });
    } finally {
      this.busy.set(null);
    }
  }
}
