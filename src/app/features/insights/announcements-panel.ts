import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TbDatePipe } from '../../shared/format';
import { EmptyState } from '../../shared/ui/bits';
import { ConfirmService } from '../../shared/ui/confirm';
import { InsightsApi } from './insights.api';
import type { AnnouncementTarget } from './insights.models';

/**
 * Compose and send an announcement (as notifications) to a tournament's
 * entrants — all or one table —, a club's members or a federation's players,
 * and see what was sent before.
 */
@Component({
  selector: 'tb-announcements-panel',
  imports: [FormsModule, ButtonModule, InputTextModule, SelectModule, TextareaModule, EmptyState, TbDatePipe],
  template: `
    @if (canSend()) {
      <section class="tb-card compose">
        <h2 class="tb-card-title">{{ t('announcements.compose') }}</h2>
        @if (events().length) {
          <div class="tb-field">
            <label for="an-audience">{{ t('announcements.audience') }}</label>
            <p-select inputId="an-audience" [options]="audienceOptions()" [ngModel]="eventId()" (ngModelChange)="eventId.set($event)" appendTo="body" [fluid]="true" />
          </div>
        }
        <div class="tb-field">
          <label for="an-title">{{ t('announcements.subject') }}</label>
          <input pInputText id="an-title" [ngModel]="title()" (ngModelChange)="title.set($event)" maxlength="120" />
        </div>
        <div class="tb-field">
          <label for="an-body">{{ t('announcements.message') }}</label>
          <textarea pTextarea id="an-body" rows="4" [autoResize]="true" [ngModel]="body()" (ngModelChange)="body.set($event)" maxlength="1000"></textarea>
          <span class="tb-field-hint">{{ body().length }} / 1000</span>
        </div>
        <div class="actions">
          <span class="tb-muted">{{ t('announcements.reach', { count: reach() }) }}</span>
          <p-button [label]="t('announcements.send')" icon="pi pi-send" [disabled]="!valid()" [loading]="sending()" (onClick)="send()" />
        </div>
      </section>
    }

    <section class="tb-card">
      <h2 class="tb-card-title">{{ t('announcements.history') }}</h2>
      <ul class="history">
        @for (a of data.value()?.items ?? []; track a.id) {
          <li>
            <div class="head">
              <strong>{{ a.title }}</strong>
              <small class="tb-muted">{{ a.createdAt | tbDate }}</small>
            </div>
            <p>{{ a.body }}</p>
            <small class="tb-muted">
              {{ a.event?.name ?? t('announcements.audiences.' + a.audience) }} · {{ t('announcements.reach', { count: a.recipientCount }) }}
              @if (a.sentBy) {
                · {{ t('announcements.by', { name: a.sentBy.firstname + ' ' + a.sentBy.lastname }) }}
              }
            </small>
          </li>
        } @empty {
          <li><tb-empty-state [message]="t('announcements.empty')" icon="pi pi-megaphone" /></li>
        }
      </ul>
    </section>
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-5); max-width: 880px; }
    .compose input, .compose textarea { width: 100%; }
    .actions { display: flex; align-items: center; justify-content: flex-end; gap: var(--tb-space-4); }
    .history { list-style: none; margin: 0; padding: 0; display: grid; }
    .history li { padding: var(--tb-space-3) 0; border-top: 1px solid var(--tb-border); display: grid; gap: var(--tb-space-1); }
    .history li:first-child { border-top: 0; }
    .head { display: flex; justify-content: space-between; gap: var(--tb-space-3); }
    .history p { margin: 0; white-space: pre-line; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnouncementsPanel {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(InsightsApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  readonly target = input.required<AnnouncementTarget>();
  readonly canSend = input(false);
  /** Tournament tables, to address one of them. */
  readonly events = input<{ id: string; name: string }[]>([]);

  protected readonly data = resource({ params: () => this.target(), loader: ({ params }) => this.api.announcements(params) });
  protected readonly title = signal('');
  protected readonly body = signal('');
  protected readonly eventId = signal<string | null>(null);
  protected readonly sending = signal(false);

  protected readonly audienceOptions = computed(() => [
    { label: `${this.t('announcements.everyone')} (${this.data.value()?.reach.all ?? '…'})`, value: null },
    ...this.events().map((e) => ({ label: `${e.name} (${this.data.value()?.reach.byEvent[e.id] ?? '…'})`, value: e.id })),
  ]);
  protected readonly reach = computed(() => {
    const reach = this.data.value()?.reach;
    if (!reach) return 0;
    const eventId = this.eventId();
    return eventId ? (reach.byEvent[eventId] ?? 0) : reach.all;
  });
  protected readonly valid = computed(() => this.title().trim().length >= 3 && this.body().trim().length >= 3 && this.reach() > 0 && !this.sending());

  protected async send() {
    const answer = await this.confirm.ask({
      title: this.t('announcements.confirmTitle'),
      message: this.title().trim(),
      detail: this.t('announcements.confirmMessage', { count: this.reach() }),
      confirmLabel: this.t('announcements.send'),
    });
    if (!answer) return;
    this.sending.set(true);
    try {
      const sent = await this.api.announce(this.target(), { title: this.title().trim(), body: this.body().trim(), eventId: this.eventId() ?? undefined });
      this.toasts.add({ severity: 'success', summary: this.t('announcements.sent', { count: sent.recipientCount }) });
      this.title.set('');
      this.body.set('');
      this.data.reload();
    } catch (raw) {
      this.toasts.add({ severity: 'error', summary: describeError(ApiError.from(raw), this.t) });
    } finally {
      this.sending.set(false);
    }
  }
}
