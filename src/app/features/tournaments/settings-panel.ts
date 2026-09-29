import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { ConfirmService } from '../../shared/ui/confirm';
import type { TournamentDetail } from './tournament.models';
import { TournamentApi } from './tournament.api';
import type { TournamentCan } from './tournament-detail.page';
import { toTournamentInput, TournamentFields, tournamentFormErrors, tournamentFormFrom } from './tournament-fields';

/** The "Settings" tab: general information, and deleting a draft. */
@Component({
  selector: 'tb-settings-panel',
  imports: [ButtonModule, MessageModule, TournamentFields],
  template: `
    @let d = tournament();
    <section class="tb-card">
      <h2 class="tb-card-title">{{ t('tournaments.form.general') }}</h2>
      @if (!editable()) {
        <p-message severity="secondary" class="msg">{{ t('tournaments.settings.readonly') }}</p-message>
      }
      @if (error()) {
        <p-message severity="error" class="msg">{{ error() }}</p-message>
      }
      <tb-tournament-fields [(value)]="form" [disabled]="!editable()" />
      @if (editable()) {
        <div class="actions">
          <p-button [label]="t('common.save')" icon="pi pi-check" [loading]="saving()" [disabled]="!dirty() || !!errors().length" (onClick)="save()" />
        </div>
      }
    </section>

    @if (d.status === 'DRAFT' && can()('tournament.delete')) {
      <section class="tb-card danger">
        <h2 class="tb-card-title">{{ t('tournaments.settings.danger') }}</h2>
        <p class="tb-muted">{{ t('tournaments.settings.deleteMessage') }}</p>
        <p-button [label]="t('tournaments.settings.delete')" icon="pi pi-trash" severity="danger" [outlined]="true" (onClick)="remove()" />
      </section>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-5); max-width: 880px; }
    .msg { display: block; margin-bottom: var(--tb-space-4); }
    .actions { display: flex; justify-content: flex-end; margin-top: var(--tb-space-4); }
    .danger { border-color: var(--tb-tone-danger-bg); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPanel {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(TournamentApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);
  private readonly router = inject(Router);

  readonly tournament = input.required<TournamentDetail>();
  readonly can = input.required<TournamentCan>();
  readonly changed = output<TournamentDetail>();

  protected readonly form = linkedSignal(() => tournamentFormFrom(this.tournament()));
  protected readonly editable = computed(() => this.tournament().editable && this.can()('tournament.update'));
  protected readonly errors = computed(() => tournamentFormErrors(this.form()));
  protected readonly dirty = computed(
    () => JSON.stringify(toTournamentInput(this.form())) !== JSON.stringify(toTournamentInput(tournamentFormFrom(this.tournament()))),
  );
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async save() {
    this.saving.set(true);
    this.error.set(null);
    try {
      const updated = await this.api.update(this.tournament().id, toTournamentInput(this.form()));
      this.toasts.add({ severity: 'success', summary: this.t('tournaments.settings.saved') });
      this.changed.emit(updated);
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove() {
    const answer = await this.confirm.ask({
      title: this.t('tournaments.settings.deleteTitle'),
      message: this.tournament().name,
      detail: this.t('tournaments.settings.deleteMessage'),
      confirmLabel: this.t('tournaments.settings.delete'),
      severity: 'danger',
    });
    if (!answer) return;
    try {
      await this.api.remove(this.tournament().id);
      this.toasts.add({ severity: 'success', summary: this.t('tournaments.settings.deleted') });
      void this.router.navigate(['/tournaments']);
    } catch (raw) {
      this.toasts.add({ severity: 'error', summary: describeError(ApiError.from(raw), this.t) });
    }
  }
}
