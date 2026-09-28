import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { ApiError } from '../../core/api/api';
import { SessionStore } from '../../core/auth/session.store';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TbDatePipe } from '../../shared/format';
import { EmptyState } from '../../shared/ui/bits';
import { ConfirmService } from '../../shared/ui/confirm';
import { StatusBadge } from '../../shared/ui/status-badge';
import type { AccessRequest } from '../admin/admin.models';
import { AccessRequestForm } from './access-request-form';
import { AccessApi, type AccessRequestInput } from './access.api';

/**
 * The signed-in user's access requests: status, the administrator's
 * questions (answered here), cancellation, and a form for a new request.
 * Used on the pending page and on /access.
 */
@Component({
  selector: 'tb-my-access-requests',
  imports: [FormsModule, ButtonModule, MessageModule, TextareaModule, StatusBadge, EmptyState, AccessRequestForm, TbDatePipe],
  template: `
    <div class="head">
      <h2>{{ t('access.title') }}</h2>
      @if (!composing()) {
        <p-button [label]="t('access.new')" icon="pi pi-plus" [outlined]="true" size="small" (onClick)="composing.set(true)" />
      }
    </div>

    @if (composing()) {
      <section class="compose">
        @if (error()) {
          <p-message class="msg" severity="error">{{ error() }}</p-message>
        }
        <tb-access-request-form (value)="draft.set($event)" />
        <div class="compose-actions">
          <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="composing.set(false)" />
          <p-button [label]="t('register.submit')" icon="pi pi-send" [disabled]="!draft()" [loading]="sending()" (onClick)="submit()" />
        </div>
      </section>
    }

    @for (r of requests.value() ?? []; track r.id) {
      <article class="request">
        <header>
          <div>
            <strong>{{ r.role.name }}</strong>
            @if (r.organization || r.proposedOrganization) {
              <span class="tb-muted"> · {{ r.organization?.name ?? r.proposedOrganization?.name }}</span>
            }
          </div>
          <tb-status-badge kind="accessRequest" [value]="r.status" />
        </header>
        <small class="tb-muted">{{ t('access.submittedOn', { date: (r.createdAt | tbDate: 'date') }) }}</small>
        @if (r.status === 'INFO_REQUESTED') {
          <div class="question">
            <span class="label">{{ t('access.question') }}</span>
            <p>{{ r.infoRequest }}</p>
            <label [for]="'answer-' + r.id" class="label">{{ t('access.yourAnswer') }}</label>
            <textarea pTextarea [id]="'answer-' + r.id" rows="3" [autoResize]="true" [(ngModel)]="answers[r.id]" maxlength="1000"></textarea>
            <p-button [label]="t('access.send')" icon="pi pi-send" size="small" [disabled]="!answers[r.id]?.trim()" (onClick)="respond(r)" />
          </div>
        }
        @if (r.decisionReason) {
          <p class="reason">{{ t('access.decisionReason', { reason: r.decisionReason }) }}</p>
        }
        @if (r.status === 'PENDING' || r.status === 'INFO_REQUESTED') {
          <p-button [label]="t('access.cancel')" severity="secondary" [text]="true" size="small" (onClick)="cancel(r)" />
        }
      </article>
    } @empty {
      @if (!requests.isLoading() && !composing()) {
        <tb-empty-state [message]="t('access.empty')" icon="pi pi-send" />
      }
    }
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-4); }
    .head { display: flex; justify-content: space-between; align-items: center; gap: var(--tb-space-3); }
    h2 { font-size: var(--tb-text-lg); }
    .compose { padding: var(--tb-space-5); border: 1px solid var(--tb-primary-200); border-radius: var(--tb-radius-lg); background: var(--tb-surface); }
    .compose-actions { display: flex; justify-content: flex-end; gap: var(--tb-space-2); }
    .msg { display: block; margin-bottom: var(--tb-space-4); }
    .request { display: grid; gap: var(--tb-space-2); padding: var(--tb-space-4); border: 1px solid var(--tb-border); border-radius: var(--tb-radius-md); background: var(--tb-surface); }
    .request header { display: flex; justify-content: space-between; align-items: center; gap: var(--tb-space-3); }
    .question { display: grid; gap: var(--tb-space-2); padding: var(--tb-space-3); border-radius: var(--tb-radius-md); background: var(--tb-tone-info-bg); }
    .question p { margin: 0; }
    .question p-button { justify-self: end; }
    .label { font-size: var(--tb-text-xs); font-weight: var(--tb-weight-semibold); text-transform: uppercase; letter-spacing: 0.05em; color: var(--tb-tone-info-fg); }
    textarea { width: 100%; }
    .reason { margin: 0; color: var(--tb-text-muted); font-style: italic; }
    p-button { justify-self: start; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyAccessRequests {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(AccessApi);
  private readonly session = inject(SessionStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  protected readonly requests = resource({ loader: () => this.api.mine() });
  protected readonly composing = signal(false);
  protected readonly draft = signal<AccessRequestInput | null>(null);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected answers: Record<string, string> = {};

  protected async submit() {
    const draft = this.draft();
    if (!draft) return;
    this.sending.set(true);
    this.error.set(null);
    try {
      await this.api.create(draft);
      this.composing.set(false);
      this.toasts.add({ severity: 'success', summary: this.t('access.submitted') });
      this.requests.reload();
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.sending.set(false);
    }
  }

  protected async respond(request: AccessRequest) {
    const answer = this.answers[request.id]?.trim();
    if (!answer) return;
    await this.run(() => this.api.respond(request.id, answer), 'access.answered');
    delete this.answers[request.id];
  }

  protected async cancel(request: AccessRequest) {
    const ok = await this.confirm.ask({
      title: this.t('access.cancelTitle'),
      confirmLabel: this.t('access.cancel'),
      severity: 'danger',
    });
    if (ok) await this.run(() => this.api.cancel(request.id), 'access.cancelled');
  }

  private async run(action: () => Promise<unknown>, successKey: string) {
    try {
      await action();
      this.toasts.add({ severity: 'success', summary: this.t(successKey) });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
    this.requests.reload();
    // An approval may have happened meanwhile: refresh what the user can do.
    await this.session.loadProfile().catch(() => undefined);
  }
}
